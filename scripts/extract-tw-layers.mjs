// Extract Taiwan county boundaries into two separate layers:
//   tw-coast.geo.json   — outer coastline only (land meets sea)
//   tw-borders.geo.json — interior county borders only (shared between counties)
//
// Uses topojson.mesh() filter trick:
//   (a === b) → arc belongs to only one geometry = outer boundary = coast
//   (a !== b) → arc shared by two geometries = interior county border
//
// Output format: GeoJSON Feature with MultiLineString geometry.

import { mesh } from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';

const topo = JSON.parse(readFileSync('data/raw/twCounty.topo.json', 'utf8'));
const key  = Object.keys(topo.objects)[0];
const obj  = topo.objects[key];

// mesh() returns a raw MultiLineString geometry (not a GeoJSON Feature)
const coast   = mesh(topo, obj, (a, b) => a === b);   // outer boundary
const borders = mesh(topo, obj, (a, b) => a !== b);   // interior lines

// Wrap as GeoJSON Feature for consistent import in frontend
const wrap = geom => ({ type: 'Feature', properties: {}, geometry: geom });
writeFileSync('data/processed/tw-coast.geo.json',   JSON.stringify(wrap(coast)));
writeFileSync('data/processed/tw-borders.geo.json', JSON.stringify(wrap(borders)));

const cLines = coast.coordinates.length;
const bLines = borders.coordinates.length;
console.log(`✓ tw-coast.geo.json   — ${cLines} line strings`);
console.log(`✓ tw-borders.geo.json — ${bLines} line strings`);
