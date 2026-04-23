// Extract 台北縣 (= 新北市 pre-2010) and 台北市 townships from twTown topojson.
// Merge multi-geometries per TOWNNAME into a single MultiPolygon feature.
// Writes two files:
//   data/processed/ntpc-districts.geo.json  — primary (新北)
//   data/processed/tpe-districts.geo.json   — context (台北市)

import { feature } from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';

const topo = JSON.parse(readFileSync('data/raw/twTown.topo.json', 'utf8'));
const geo = feature(topo, topo.objects.layer1);

function extract(countyName) {
  const merged = new Map();
  for (const f of geo.features) {
    if (f.properties.COUNTYNAME !== countyName) continue;
    const { TOWNNAME } = f.properties;
    const geom = f.geometry;
    if (!geom) continue;
    if (!merged.has(TOWNNAME)) {
      merged.set(TOWNNAME, {
        type: 'Feature',
        properties: { COUNTYNAME: countyName, TOWNNAME },
        geometry: { type: 'MultiPolygon', coordinates: [] },
      });
    }
    const polys =
      geom.type === 'Polygon' ? [geom.coordinates]
      : geom.type === 'MultiPolygon' ? geom.coordinates
      : [];
    merged.get(TOWNNAME).geometry.coordinates.push(...polys);
  }
  return { type: 'FeatureCollection', features: [...merged.values()] };
}

const ntpc = extract('台北縣');
const tpe = extract('台北市');

// Rest-of-Taiwan: every township except 台北縣 & 台北市
function extractRest() {
  const merged = new Map();
  for (const f of geo.features) {
    const { COUNTYNAME, TOWNNAME } = f.properties;
    if (COUNTYNAME === '台北縣' || COUNTYNAME === '台北市') continue;
    const key = `${COUNTYNAME}/${TOWNNAME}`; // qualified to avoid same-name towns in different counties
    const geom = f.geometry;
    if (!geom) continue;
    if (!merged.has(key)) {
      merged.set(key, {
        type: 'Feature',
        properties: { COUNTYNAME, TOWNNAME, KEY: key },
        geometry: { type: 'MultiPolygon', coordinates: [] },
      });
    }
    const polys =
      geom.type === 'Polygon' ? [geom.coordinates]
      : geom.type === 'MultiPolygon' ? geom.coordinates
      : [];
    merged.get(key).geometry.coordinates.push(...polys);
  }
  return { type: 'FeatureCollection', features: [...merged.values()] };
}
const rest = extractRest();

writeFileSync('data/processed/ntpc-districts.geo.json', JSON.stringify(ntpc));
writeFileSync('data/processed/tpe-districts.geo.json', JSON.stringify(tpe));
writeFileSync('data/processed/tw-rest-districts.geo.json', JSON.stringify(rest));

console.log(`台北縣: ${ntpc.features.length} districts`);
console.log(`台北市: ${tpe.features.length} districts`);
console.log(`其他: ${rest.features.length} 鄉鎮市區 (含離島)`);
