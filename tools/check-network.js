import PathFinder from "geojson-path-finder";
import network from "../src/data/skaneleden.json" with { type: "json" };

const pathFinder = new PathFinder.default(network);
const vertices = Object.keys(pathFinder.graph.compactedVertices).map((id) => ({
  type: "Feature",
  properties: { id },
  geometry: { type: "Point", coordinates: id.split(",").map(Number) },
}));

let completed = 0;

let currentIslandId = 0;

for (const start of vertices) {
  for (const end of vertices) {
    if (
      start !== end &&
      (!start.properties.islandId || !end.properties.islandId)
    ) {
      const path = pathFinder.findPath(start, end);
      if (path) {
        const islandId =
          start.properties.islandId ||
          end.properties.islandId ||
          ++currentIslandId;
        start.properties.islandId = islandId;
        end.properties.islandId = islandId;
      }
    }
  }

  completed++;
  process.stderr.write(
    "\r" + Math.round((completed / vertices.length) * 100) + "%"
  );
}

for (const vertex of vertices) {
  if (!vertex.properties.islandId) {
    vertex.properties.islandId = currentIslandId++;
  }
}

process.stderr.clearLine();
console.error(`Found ${currentIslandId} islands.`);
console.log(
  JSON.stringify(
    {
      type: "FeatureCollection",
      features: vertices
        .map(({ properties: { id: startId, islandId } }) => {
          const neighbors = Object.keys(
            pathFinder.graph.compactedCoordinates[startId]
          );
          if (neighbors.length > 0) {
            return Object.keys(
              pathFinder.graph.compactedCoordinates[startId]
            ).map((endId) => ({
              type: "Feature",
              properties: { startId, endId, islandId },
              geometry: {
                type: "LineString",
                coordinates:
                  pathFinder.graph.compactedCoordinates[startId][endId],
              },
            }));
          } else {
            return [
              {
                type: "Feature",
                properties: { id: startId, islandId },
                geometry: {
                  type: "Point",
                  coordinates: startId.split(",").map(Number),
                },
              },
            ];
          }
        })
        .flat(),
    },
    null,
    2
  )
);
