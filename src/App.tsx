import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import "ol/ol.css";
import WMTSGrid from "ol/tilegrid/WMTS";
import WMTS from "ol/source/WMTS";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import RouteNetwork from "./RouteNetwork";
import { Feature, Geolocation, MapBrowserEvent } from "ol";
import { toLonLat, transform } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Modify from "ol/interaction/Modify";
import { LineString, Point } from "ol/geom";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import { outlinedStyle } from "./map-style";
import Circle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");
register(proj4);

function App() {
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);

  const map = useLmMap(mapContainer);
  const routeNetwork = useRouteNetwork(map);

  const { waypoints, clearWaypoints, selectedSegment } = useWaypoints(
    map,
    mapContainer,
    routeNetwork
  );

  const route = useMemo(() => {
    if (routeNetwork && waypoints.length > 1) {
      const route = routeNetwork.route(waypoints);
      if (route) {
        const { path: routeCoordinates, weight: routeDistance } = route;
        return {
          routeCoordinates: routeCoordinates.map((c) =>
            transform(c as Coordinate, "EPSG:4326", "EPSG:3006")
          ),
          routeDistance,
        };
      }
    }
    return null;
  }, [routeNetwork, waypoints]);

  useRouteLayer(map, route);
  useGeolocation(map);

  const showInfo = selectedSegment || waypoints.length > 1;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
        ref={mapContainer}
      />
      {showInfo && (
        <div className="absolute top-0 left-0 right-0 h-16 p-4 bg-white flex flex-row justify-between items-center space-x-4 shadow">
          {route ? (
            <>
              <div className="text-lg">
                Planerad tur:{" "}
                <span className="font-bold">
                  {route.routeDistance.toFixed(1)} km
                </span>
              </div>
              <button onClick={clearWaypoints} className="text-2xl">
                ×
              </button>
            </>
          ) : selectedSegment ? (
            <>
              <div className="font-bold text-lg">
                {selectedSegment.name
                  ?.replace("Skåneleden", "SL")
                  .replace("Etapp", "E")}
              </div>
              <div>{selectedSegment.distance} km</div>
            </>
          ) : waypoints.length > 1 ? (
            <>
              <div>Kunde inte hitta en väg mellan de här punkterna 🤔</div>{" "}
              <button onClick={clearWaypoints} className="text-2xl">
                ×
              </button>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}

function useLmMap(containerRef: MutableRefObject<HTMLDivElement | null>) {
  const [map, setMap] = useState<Map | null>(null);
  useEffect(() => {
    if (containerRef.current) {
      const apiKey = "37042918-314e-32e3-a668-e6f62a0cf410";
      const extent = [-1200000, 4700000, 2600000, 8500000];
      const maxZoom = 9;
      const zoomLevels = Array.from({ length: maxZoom + 1 }, (_, k) => k);
      const resolutions = zoomLevels.map((z) => 4096 / Math.pow(2, z));
      const matrixIds = zoomLevels.map((z) => z.toString());

      const tileGrid = new WMTSGrid({
        tileSize: 256,
        extent: extent,
        resolutions: resolutions,
        matrixIds: matrixIds,
      });

      const topowebb = new TileLayer({
        extent: extent,
        source: new WMTS({
          url:
            "https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/token/" +
            apiKey +
            "/",
          // url: 'https://minkarta.lantmateriet.se/map/topowebbcache',
          layer: "topowebb",
          format: "image/png",
          matrixSet: "3006",
          tileGrid: tileGrid,
          version: "1.0.0",
          style: "default",
          crossOrigin: "anonymous",
        }),
        zIndex: 0,
      });

      const map = new Map({
        target: containerRef.current,
        layers: [topowebb],
        view: new View({
          center: [616542, 6727536],
          zoom: 2,
          resolutions,
        }),
      });
      setMap(map);

      return () => map.setTarget(undefined);
    }
  }, [containerRef]);

  return map;
}

function useRouteNetwork(map: Map | null) {
  const [routeNetwork, setRouteNetwork] = useState<RouteNetwork | null>(null);
  useEffect(() => {
    if (map) {
      const routeNetwork = new RouteNetwork();
      map.addLayer(routeNetwork.layer);
      map
        .getView()
        .fit(routeNetwork.source.getExtent(), { padding: [50, 50, 50, 50] });
      setRouteNetwork(routeNetwork);

      return () => {
        map.removeLayer(routeNetwork.layer);
      };
    }
  }, [map]);

  return routeNetwork;
}

const iconStyle = new Style({
  image: new Icon({
    anchor: [0.5, 32],
    anchorXUnits: "fraction",
    anchorYUnits: "pixels",
    src: "marker.svg",
  }),
});

function useWaypoints(
  map: Map | null,
  mapContainer: MutableRefObject<HTMLDivElement | null>,
  routeNetwork: RouteNetwork | null
) {
  const [selectedSegment, setSelectedSegment] = useState<Record<
    string,
    string
  > | null>(null);
  const [waypoints, setWaypoints] = useState<Coordinate[]>([]);

  useEffect(() => {
    const containerElement = mapContainer.current;
    if (containerElement && map && routeNetwork) {
      let longpress = false;
      const onClick = (e: MapBrowserEvent<any>) => {
        if (!longpress) {
          const segment = routeNetwork.getSegmentAtPixel(map, e.pixel);
          let ref: string | null = null;
          if (segment) {
            ref = segment.name;
            setSelectedSegment(segment);
          } else {
            setSelectedSegment(null);
          }
          routeNetwork.setHighlightedRef(ref);
        }
        longpress = false;
      };
      map.on("click", onClick);

      const onLongPress = (e: MouseEvent) => {
        longpress = true;
        e.preventDefault();
        const coord = routeNetwork.getClosestNetworkCoordinate(
          toLonLat(map.getEventCoordinate(e), "EPSG:3006")
        );

        setWaypoints((waypoints) => {
          const nextWaypoints = [...waypoints];
          if (nextWaypoints.length > 0) {
            nextWaypoints[1] = coord;
          } else {
            nextWaypoints.push(coord);
          }
          return nextWaypoints;
        });
      };

      containerElement.addEventListener("contextmenu", onLongPress);

      return () => {
        map.un("click", onClick);
        containerElement.removeEventListener("contextmenu", onLongPress);
      };
    }
  }, [map, mapContainer, routeNetwork]);

  useWaypointsLayer(map, routeNetwork, waypoints, setWaypoints);

  return { waypoints, clearWaypoints: () => setWaypoints([]), selectedSegment };
}

function useWaypointsLayer(
  map: Map | null,
  routeNetwork: RouteNetwork | null,
  waypoints: Coordinate[],
  setWaypoints: (waypoints: Coordinate[]) => void
) {
  const features = useMemo(
    () =>
      waypoints.map(
        (c, index) =>
          new Feature({
            geometry: new Point(transform(c, "EPSG:4326", "EPSG:3006")),
            index,
          })
      ),
    [waypoints]
  );
  const source = useMemo(() => new VectorSource({ features }), [features]);
  const layer = useMemo(
    () => new VectorLayer({ source, zIndex: 3, style: iconStyle }),
    [source]
  );

  useEffect(() => {
    if (map && routeNetwork) {
      const modify = new Modify({
        hitDetection: layer,
        source,
        style: undefined,
      });

      modify.on("modifyend", (e) => {
        const features = e.features.getArray();
        if (features.length > 0) {
          const [feature] = features;
          const index = features[0].get("index") as number;
          const coordinate = routeNetwork.getClosestNetworkCoordinate(
            transform(
              (feature.getGeometry() as Point).getCoordinates(),
              "EPSG:3006",
              "EPSG:4326"
            )
          );
          const coordinates = [...waypoints];
          coordinates[index] = coordinate;
          setWaypoints(coordinates);
        }
      });

      map.addInteraction(modify);

      return () => {
        map.removeInteraction(modify);
      };
    }
  }, [map, routeNetwork, source, setWaypoints, waypoints]);

  useEffect(() => {
    if (map) {
      map.addLayer(layer);

      return () => {
        map.removeLayer(layer);
      };
    }
  }, [map, layer]);
}

export default App;

function useRouteLayer(
  map: Map | null,
  route: { routeCoordinates: Coordinate[]; routeDistance: number } | null
) {
  useEffect(() => {
    if (map && route) {
      const routeLayer = new VectorLayer({
        source: new VectorSource({
          features: [new Feature(new LineString(route.routeCoordinates))],
        }),
        style: outlinedStyle("purple", 8),
        zIndex: 2,
      });

      map.addLayer(routeLayer);

      return () => {
        map.removeLayer(routeLayer);
      };
    }
  }, [map, route]);
}

function useGeolocation(map: Map | null) {
  useEffect(() => {
    if (map) {
      const geolocation = new Geolocation({
        trackingOptions: {
          enableHighAccuracy: true,
        },
        projection: "EPSG:3006",
      });
      geolocation.setTracking(true);

      const positionFeature = new Feature();

      geolocation.on("change:position", () => {
        const coordinates = geolocation.getPosition();
        if (coordinates) {
          positionFeature.setGeometry(
            coordinates ? new Point(coordinates) : undefined
          );
        }
      });

      const layer = new VectorLayer({
        source: new VectorSource({
          features: [positionFeature],
        }),
        style: new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({
              color: "#4466aa",
            }),
            stroke: new Stroke({
              color: "#fff",
              width: 2,
            }),
          }),
        }),
        zIndex: 5,
      });

      map.addLayer(layer);

      return () => {
        map.removeLayer(layer);
      };
    }
  }, [map]);
}
