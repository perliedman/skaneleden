# Skåneleden

A small webapp to view and plan hikes along [Skåneleden](https://www.skaneleden.se/).

## Updating the source data

The source data is stored in `src/data/skaneleden.json`, the data is fetched from [OpenStreetMap](https://openstreetmap.org/) using [Overpass Turbo](https://overpass-turbo.eu/).

This is the query used to get the GeoJSON:

```
[out:json][timeout:25];
rel(1014050);
(._;>>;);
out;
```
