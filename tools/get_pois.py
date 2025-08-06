import geopandas as gpd
import requests
from shapely.geometry import Point, Polygon
import json

# --- CONFIGURATION ---
GEOJSON_FILE = "src/data/skaneleden.json"  # Replace with your path
BUFFER_DISTANCE_METERS = 250
AMENITY_FILTER = [
    "cafe",
    "restaurant",
    "pub",
    "fast_food",
    "biergarten",
    "drinking_water",
    "toilets",
    "shelter",
    "bench",
    "picnic_table",
    "parking",
]


def poi_filter(poi):
    tags = poi.get("tags", {})
    amenity = tags.get("amenity")
    return amenity != "shelter" or tags.get("shelter_type") in [
        "picnic_shelter",
        "weather_shelter",
        "lean_to",
        "basic_hut",
    ]


# --- STEP 1: Load trail and buffer it ---
trail_gdf = gpd.read_file(GEOJSON_FILE)

# Project to metric (Web Mercator), buffer, then back to WGS84
trail_buffer = (
    trail_gdf.to_crs(epsg=3006).buffer(BUFFER_DISTANCE_METERS).to_crs(epsg=4326)
)
buffer_union = gpd.GeoSeries(trail_buffer.unary_union, crs="EPSG:4326")

# Get bounding box for Overpass
minx, miny, maxx, maxy = buffer_union.total_bounds

# --- STEP 2: Query Overpass for amenities in bbox ---
# Build Overpass query
overpass_url = "https://overpass-api.de/api/interpreter"
amenity_filters = "".join(
    f'node["amenity"="{a}"]({miny},{minx},{maxy},{maxx});' for a in AMENITY_FILTER
)

query = f"""
[out:json][timeout:60];
(
  {''.join(f'node["amenity"="{a}"]({miny},{minx},{maxy},{maxx});' for a in AMENITY_FILTER)}
  {''.join(f'way["amenity"="{a}"]({miny},{minx},{maxy},{maxx});' for a in AMENITY_FILTER)}
  {''.join(f'relation["amenity"="{a}"]({miny},{minx},{maxy},{maxx});' for a in AMENITY_FILTER)}
);
out body geom;
"""

response = requests.get(overpass_url, params={"data": query})
data = response.json()

# --- STEP 3: Filter results within buffer ---
features = []
for el in [el for el in data["elements"] if poi_filter(el)]:
    geometry_type = el["type"]
    tags = el.get("tags", {})

    if geometry_type == "node":
        pt = Point(el["lon"], el["lat"])

    elif geometry_type in ["way", "relation"] and "geometry" in el:
        coords = [(pt["lon"], pt["lat"]) for pt in el["geometry"]]

        # Try to make a polygon (must be closed for Polygon)
        try:
            if coords[0] != coords[-1]:
                coords.append(coords[0])  # Ensure closed
            polygon = Polygon(coords)
            pt = polygon.centroid
        except Exception as e:
            continue  # Skip invalid geometries

    else:
        continue  # Skip if we don't know how to handle

    # Check if point is within buffer
    if buffer_union.iloc[0].contains(pt):
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [pt.x, pt.y],
                },
                "properties": tags,
            }
        )

# --- STEP 4: Save or print ---
output_geojson = {
    "type": "FeatureCollection",
    "features": features,
}

with open("src/data/amenities.json", "w") as f:
    json.dump(output_geojson, f, indent=2)

print(
    f"Found {len(features)} nearby amenities within {BUFFER_DISTANCE_METERS}m of trail."
)
