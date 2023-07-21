import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Circle from "ol/style/Circle";
import LineString from "ol/geom/LineString";
import Fill from "ol/style/Fill";

import routeData from "./data/skaneleden.json";
import Feature, { FeatureLike } from "ol/Feature";
import { Pixel } from "ol/pixel";
import Map from "ol/Map";
import PathFinder from "geojson-path-finder";
import { Coordinate } from "ol/coordinate";
import RBush from "rbush";
import knn from "rbush-knn";

const routeColor = "#4466aa";
const highlightColor = "#ff4422";

type GeoJSONPoint = {
  type: "Point";
  coordinates: Coordinate;
};

type GeoJSONLineString = {
  type: "LineString";
  coordinates: Coordinate[];
};

type GeoJSONFeature<T> = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: T;
};

type FeatureCollection<T> = {
  type: "FeatureCollection";
  features: GeoJSONFeature<T>[];
};

export default class RouteLayer {
  source: VectorSource<LineString>;
  layer: VectorLayer<VectorSource<LineString>>;
  highlightedRef: string | null = null;
  pathFinder: PathFinder<void, Record<string, unknown>>;
  coordinatesIndex: CoordinateRBush;

  constructor() {
    const features = new GeoJSON().readFeatures(routeData, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3006",
    }) as Feature<LineString>[];
    const source = (this.source = new VectorSource<LineString>({
      features,
    }));

    const style = [
      new Style({
        image: new Circle({
          radius: 5,
          fill: new Fill({
            color: "white",
          }),
          stroke: new Stroke({
            color: "#4466aa",
            width: 2,
          }),
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: "black",
          width: 7,
        }),
        zIndex: 0,
      }),
      new Style({
        stroke: new Stroke({
          color: "white",
          width: 6,
        }),
        zIndex: 1,
      }),
      new Style({
        stroke: new Stroke({
          color: routeColor,
          width: 3,
        }),
        zIndex: 2,
      }),
    ];

    const styleFunction = (feature: FeatureLike) => {
      const relations = feature.get("@relations") as Array<{
        reltags: Record<string, string>;
      }>;
      let isHighlighted = false;
      if (relations && relations.length > 0) {
        const [relation] = relations;
        const { reltags } = relation;
        const ref = reltags.name;
        isHighlighted = ref === this.highlightedRef;
      }
      style[3]
        .getStroke()
        .setColor(isHighlighted ? highlightColor : routeColor);

      return style;
    };

    this.layer = new VectorLayer({
      source,
      style: styleFunction,
      zIndex: 1,
    });

    this.pathFinder = new PathFinder(routeData);
    this.coordinatesIndex = new CoordinateRBush();
    const coordinates = (
      routeData as FeatureCollection<GeoJSONLineString | GeoJSONPoint>
    ).features
      .filter(isLineString)
      .map((feature) => feature.geometry.coordinates)
      .flat(1);
    this.coordinatesIndex.load(coordinates);
  }

  getSegmentAtPixel(map: Map, pixel: Pixel) {
    const features = map.getFeaturesAtPixel(pixel, {
      layerFilter: (layer) => layer === this.layer,
      hitTolerance: 10,
    });
    if (features.length > 0) {
      const [feature] = features;
      const [relation] = feature.get("@relations") as Array<{
        reltags: Record<string, string>;
      }>;
      return relation.reltags;
    }
  }

  setHighlightedRef(ref: string | null) {
    this.highlightedRef = ref;
    this.source.changed();
  }

  route(waypoints: Coordinate[]) {
    const [startX, startY] = waypoints[0];
    const [endX, endY] = waypoints[waypoints.length - 1];
    const [start] = knn<Coordinate>(this.coordinatesIndex, startX, startY, 1);
    const [end] = knn<Coordinate>(this.coordinatesIndex, endX, endY, 1);
    return this.pathFinder.findPath(point(start), point(end));
  }
}

class CoordinateRBush extends RBush<Coordinate> {
  toBBox([x, y]: Coordinate) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  compareMinX(a: Coordinate, b: Coordinate) {
    return a[0] - b[0];
  }
  compareMinY(a: Coordinate, b: Coordinate) {
    return a[1] - b[1];
  }
}
function isLineString(
  feature: GeoJSONFeature<GeoJSONLineString | GeoJSONPoint>
): feature is GeoJSONFeature<GeoJSONLineString> {
  return feature.geometry.type === "LineString";
}

function point(coordinates: Coordinate) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates },
  };
}
