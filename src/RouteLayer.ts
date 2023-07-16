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

const routeColor = "#4466aa";
const highlightColor = "#ff4422";

export default class RouteLayer {
  source: VectorSource<LineString>;
  layer: VectorLayer<VectorSource<LineString>>;
  highlightedRef: string | null = null;

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

    const styleFunction = (feature: FeatureLike, resolution: number) => {
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
}
