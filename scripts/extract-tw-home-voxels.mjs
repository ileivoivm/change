// Bake all-Taiwan voxel positions for the home screen backdrop.
// Uses twCounty.topo.json (766 township polygons), applies the same fixed
// projection as home-canvas.js, and writes [[x, z], ...] pairs.
//
// Output: data/processed/tw-home-voxels.json
//   { cells: [[x, z], ...], cell: CELL }

import { feature } from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';

// ── Fixed projection matching home-canvas.js ──────────────────────────────────
const cLon  = 121.0;
const cLat  = 23.65;
const kLat  = 111;
const kLon  = 111 * Math.cos(cLat * Math.PI / 180);
const worldH = 60;
const scale  = (worldH * 0.88) / (3.5 * kLat);
// Projects lon/lat → [x, z] where X=east, Z=south (Three.js XZ ground plane)
function proj([lon, lat]) {
  return [
    (lon - cLon) * kLon * scale,
   -(lat - cLat) * kLat * scale,   // Z = south (negate lat for Three.js Z-axis)
  ];
}

// ── Polygon helpers ───────────────────────────────────────────────────────────
function eachRing(geom, fn) {
  if (!geom) return;
  if (geom.type === 'Polygon')      geom.coordinates.forEach(fn);
  if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(fn));
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
      inside = !inside;
  }
  return inside;
}

function voxelizePolygon(rings, cell) {
  // rings[0] = outer, rings[1..] = holes (projected to [x,z])
  const projected = rings.map(r => r.map(proj));
  const outer = projected[0];
  const holes  = projected.slice(1);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of outer) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  const cells = [];
  const ix0 = Math.floor(minX / cell), ix1 = Math.ceil(maxX / cell);
  const iz0 = Math.floor(minZ / cell), iz1 = Math.ceil(maxZ / cell);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const cx = (ix + 0.5) * cell, cz = (iz + 0.5) * cell;
      if (!pointInRing(cx, cz, outer)) continue;
      let inHole = false;
      for (const h of holes) if (pointInRing(cx, cz, h)) { inHole = true; break; }
      if (!inHole) cells.push([cx, cz]);
    }
  }
  return cells;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const CELL = 0.8;   // world units — ~5.9 km/voxel, balances detail vs count

const topo = JSON.parse(readFileSync('data/raw/twCounty.topo.json', 'utf8'));
const geo  = feature(topo, topo.objects[Object.keys(topo.objects)[0]]);

const seen  = new Set();   // deduplicate cells that share grid square
const cells = [];

for (const f of geo.features) {
  eachRing(f.geometry, ring => {
    const poly = f.geometry.type === 'Polygon'
      ? f.geometry.coordinates
      : null;
    if (!poly) return;          // handled via MultiPolygon iteration below
    for (const [cx, cz] of voxelizePolygon(poly, CELL)) {
      const key = `${Math.round(cx * 100)},${Math.round(cz * 100)}`;
      if (!seen.has(key)) { seen.add(key); cells.push([cx, cz]); }
    }
  });
  if (f.geometry?.type === 'MultiPolygon') {
    for (const poly of f.geometry.coordinates) {
      for (const [cx, cz] of voxelizePolygon(poly, CELL)) {
        const key = `${Math.round(cx * 100)},${Math.round(cz * 100)}`;
        if (!seen.has(key)) { seen.add(key); cells.push([cx, cz]); }
      }
    }
  }
}

writeFileSync('data/processed/tw-home-voxels.json', JSON.stringify({ cell: CELL, cells }));
console.log(`✓ tw-home-voxels.json — ${cells.length} voxels at cell=${CELL}`);
