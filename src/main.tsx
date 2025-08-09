import React from "react";
import ReactDOM from "react-dom/client";
import App from "hike-site/src/App";
import { FeatureCollection, LineString, Point } from "geojson";
import trail from "./data/trail.json";
import pois from "./data/pois.json";
import About from "./About";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App
      trail={trail as FeatureCollection<LineString>}
      pois={pois as FeatureCollection<Point>}
      AboutComponent={About}
    />
  </React.StrictMode>
);
