import Text from "ol/style/Text";
import pois from "./data/amenities.json";
import CircleStyle from "ol/style/Circle";
import Cluster from "ol/source/Cluster";
import GeoJSON from "ol/format/GeoJSON";
import { useEffect, useMemo } from "react";
import { Feature, Map } from "ol";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import { Pixel } from "ol/pixel";

export type PoiGroup = "food" | "basics" | "transport";

export function usePois(
  map: Map | null,
  visibleGroups: Record<PoiGroup, boolean>
): { getPoisAtPixel: (pixel: Pixel) => Feature[] } {
  const features = new GeoJSON().readFeatures(pois, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3006",
  });
  const source = useMemo(() => new VectorSource(), []);
  useEffect(() => {
    const filteredFeatures = features.filter(
      (f) =>
        visibleGroups[amenityGroup[(f.get("amenity") as string | null) || ""]]
    );
    source.clear();
    source.addFeatures(filteredFeatures);
  });
  const layer = useMemo(() => {
    const cluster = new Cluster({ source });

    return new VectorLayer({
      source: cluster,
      style: function (feature) {
        const features = feature.get("features") as Feature[];
        const size = features.length;
        if (!size || size === 1) {
          const amenity =
            (features[0].get("amenity") as string | null) || "generic";
          poiStyle.getText()?.setText(icon[amenity] || icon["generic"]);
          return poiStyle;
        }
        const style = clusterStyle;
        style.getText()?.setText(size.toString());
        return style;
      },
      zIndex: 7,
    });
  }, [source]);
  useEffect(() => {
    if (map) {
      map.addLayer(layer);
      return () => {
        map.removeLayer(layer);
      };
    }
  });

  return useMemo(
    () => ({
      getPoisAtPixel: (pixel) =>
        (map?.getFeaturesAtPixel(pixel, {
          layerFilter: (mapLayer) => mapLayer === layer,
        }) as Feature[]) || [],
    }),
    [layer, map]
  );
}

export function Poi({ poi }: { poi: Feature }) {
  const features = (poi.get("features") as Feature[]) || [];

  return (
    <div className="flex flex-col items-start">
      {features.slice(0, features.length > 6 ? 5 : 6).map((poi) => {
        let title: string;
        const name = poi.get("name") as string | null;
        const amenity = poi.get("amenity") as string;
        if (name) {
          title = `${name} (${amenityName[amenity]})`;
        } else {
          title = amenityName[amenity];
        }
        return (
          <div className="font-bold text-lg">
            <i className="fas mr-3">{icon[amenity]}</i>
            {title}
          </div>
        );
      })}
      {features.length > 6 ? (
        <div className="font-bold text-lg">
          ...och {features.length - 5} fler saker
        </div>
      ) : null}
    </div>
  );
}

const poiStyle = new Style({
  image: new CircleStyle({
    radius: 10,
    stroke: new Stroke({ color: "red", width: 1 }),
    fill: new Fill({ color: "yellow" }),
  }),
  text: new Text({
    fill: new Fill({
      color: "#000",
    }),
    font: "normal 12px FontAwesome",
  }),
});
const clusterStyle = new Style({
  image: new CircleStyle({
    radius: 10,
    stroke: new Stroke({
      color: "#fff",
    }),
    fill: new Fill({
      color: [0x33, 0x99, 0xcc, 192],
    }),
  }),
  text: new Text({
    offsetX: 1,
    fill: new Fill({
      color: "#fff",
    }),
  }),
});

const icon: Record<string, string> = {
  cafe: "\uf0f4",
  restaurant: "\uf2e7",
  pub: "\ue0b3",
  fast_food: "\uf805",
  biergarten: "\ue0b3",
  drinking_water: "\ue006",
  bench: "\uf4b8",
  picnic_table: "\ue32d",
  parking: "\uf540",
  toilets: "\uf7bd",
  shelter: "\ue537",
  generic: "\uf6ec",
};

const amenityName: Record<string, string> = {
  cafe: "Café",
  restaurant: "Restaurang",
  pub: "Pub",
  fast_food: "Snabbmat",
  biergarten: "Pub",
  drinking_water: "Dricksvatten",
  bench: "Bänk",
  picnic_table: "Bord",
  parking: "Parkering",
  toilets: "Toalett",
  shelter: "Vindskydd",
  generic: "",
};

const amenityGroup: Record<string, PoiGroup> = {
  cafe: "food",
  restaurant: "food",
  pub: "food",
  fast_food: "food",
  biergarten: "food",
  drinking_water: "basics",
  bench: "basics",
  picnic_table: "basics",
  parking: "transport",
  toilets: "basics",
  shelter: "basics",
  generic: "basics",
};
