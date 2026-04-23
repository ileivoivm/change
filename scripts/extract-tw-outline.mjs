// Extract Taiwan county outlines as a GeoJSON FeatureCollection of LineStrings
// (just the rings — no fill). Used as a faint reference overlay in the 3D scene.
// Output: data/processed/tw-outline.geo.json

import { feature } from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';

const topo = JSON.parse(readFileSync('data/raw/twCounty.topo.json', 'utf8'));
const key = Object.keys(topo.objects)[0];
const geo = feature(topo, topo.objects[key]);

const features = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  const polys =
    g.type === 'Polygon' ? [g.coordinates]
    : g.type === 'MultiPolygon' ? g.coordinates
    : [];
  for (const poly of polys) {
    // outer ring only (index 0)
    features.push({
      type: 'Feature',
      properties: { name: f.properties?.name || '' },
      geometry: { type: 'LineString', coordinates: poly[0] },
    });
  }
}

const out = { type: 'FeatureCollection', features };
writeFileSync('data/processed/tw-outline.geo.json', JSON.stringify(out));
console.log(`wrote ${features.length} rings`);
