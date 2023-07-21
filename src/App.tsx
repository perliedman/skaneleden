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
import RouteLayer from "./RouteLayer";
import { Feature, MapBrowserEvent } from "ol";
import { toLonLat, transform } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { LineString } from "ol/geom";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");
register(proj4);

function App() {
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);

  const map = useLmMap(mapContainer);
  const routeLayer = useRouteLayer(map);
  const [selectedSegment, setSelectedSegment] = useState<Record<
    string,
    string
  > | null>(null);
  const [waypoints, setWaypoints] = useState<Coordinate[]>([]);

  useEffect(() => {
    const containerElement = mapContainer.current;
    if (containerElement && map && routeLayer) {
      let longpress = false;
      const onClick = (e: MapBrowserEvent<any>) => {
        if (!longpress) {
          const segment = routeLayer.getSegmentAtPixel(map, e.pixel);
          let ref: string | null = null;
          if (segment) {
            ref = segment.name;
            setSelectedSegment(segment);
          } else {
            setSelectedSegment(null);
          }
          routeLayer.setHighlightedRef(ref);
        }
        longpress = false;
      };
      map.on("click", onClick);

      const onLongPress = (e: MouseEvent) => {
        longpress = true;
        e.preventDefault();
        const coord = map.getEventCoordinate(e);
        setWaypoints((waypoints) => [
          ...waypoints,
          toLonLat(coord, "EPSG:3006"),
        ]);
      };

      containerElement.addEventListener("contextmenu", onLongPress);

      return () => {
        map.un("click", onClick);
        containerElement.removeEventListener("contextmenu", onLongPress);
      };
    }
  }, [map, routeLayer]);

  const route = useMemo(() => {
    if (routeLayer && waypoints.length > 1) {
      const route = routeLayer.route(waypoints);
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
  }, [routeLayer, waypoints]);

  useEffect(() => {
    if (map && route) {
      const routeLayer = new VectorLayer({
        source: new VectorSource({
          features: [new Feature(new LineString(route.routeCoordinates))],
        }),
        style: new Style({
          stroke: new Stroke({
            color: "purple",
            width: 8,
          }),
        }),
        zIndex: 2,
      });

      map.addLayer(routeLayer);

      return () => {
        map.removeLayer(routeLayer);
      };
    }
  }, [map, route]);

  route && console.log(route);

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
      {(selectedSegment || route) && (
        <div className="absolute top-0 left-0 right-0 h-16 p-4 bg-white flex flex-row items-center space-x-4 shadow">
          {route ? (
            <>
              <div className="text-lg">
                Planerad rutt:{" "}
                <span className="font-bold">
                  {route.routeDistance.toFixed(1)} km
                </span>
              </div>
              <button onClick={() => setWaypoints([])}>X</button>
            </>
          ) : selectedSegment ? (
            <>
              <div className="font-bold text-lg">
                {selectedSegment.name
                  .replace("Skåneleden", "SL")
                  .replace("Etapp", "E")}
              </div>
              <div>{selectedSegment.distance} km</div>
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

function useRouteLayer(map: Map | null) {
  const [routeLayer, setRouteLayer] = useState<RouteLayer | null>(null);
  useEffect(() => {
    if (map) {
      const routeLayer = new RouteLayer();
      map.addLayer(routeLayer.layer);
      map
        .getView()
        .fit(routeLayer.source.getExtent(), { padding: [50, 50, 50, 50] });
      setRouteLayer(routeLayer);

      return () => {
        map.removeLayer(routeLayer.layer);
      };
    }
  }, [map]);

  return routeLayer;
}

export default App;
