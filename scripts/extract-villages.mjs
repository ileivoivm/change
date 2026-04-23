// Extract 台北縣 / 新北市 boundaries (once) + village-level votes for
// every historical election (1997, 2001, 2005, 2010, 2014, 2018, 2022).
//
// Outputs:
//   data/processed/ntpc-villages.geo.json  — FeatureCollection of 里 polygons (1982 baseline)
//   data/processed/ntpc-{year}-villages.json — per-year village vote results

import { feature } from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';

// ─── boundaries ─────────────────────────────────────────
const topo = JSON.parse(readFileSync('data/raw/twVillage.topo.json', 'utf8'));
const key = Object.keys(topo.objects)[0];
const geo = feature(topo, topo.objects[key]);

const merged = new Map();
for (const f of geo.features) {
  const p = f.properties;
  if (p.COUNTYNAME !== '台北縣') continue;
  if (!f.geometry) continue;
  const vid = p.VILLAGEID;
  if (!merged.has(vid)) {
    merged.set(vid, {
      type: 'Feature',
      properties: {
        VILLAGEID: vid,
        COUNTYNAME: p.COUNTYNAME,
        TOWNNAME: p.TOWNNAME,
        VILLAGENAM: p.VILLAGENAM,
      },
      geometry: { type: 'MultiPolygon', coordinates: [] },
    });
  }
  const polys =
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
    : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates
    : [];
  merged.get(vid).geometry.coordinates.push(...polys);
}
const outGeo = { type: 'FeatureCollection', features: [...merged.values()] };
writeFileSync('data/processed/ntpc-villages.geo.json', JSON.stringify(outGeo));
console.log(`boundaries: ${outGeo.features.length} villages`);

// ─── CSV utils ───────────────────────────────────────────
function parseLine(line) {
  if (!line.trim()) return null;
  return line.split(',').map(s => s.replace(/^\s*"?'?|"?\s*$/g, ''));
}
function readCsv(p) {
  return readFileSync(p, 'utf8').split('\n').map(parseLine).filter(r => r && r.length > 1);
}

// CEC party codes were different pre-2010
const LEGACY_TO_CANONICAL = {
  '1': '1', '2': '16', '3': '90', '4': '95', '5': '74', '7': '106', '99': '999',
};
const canonParty = c => LEGACY_TO_CANONICAL[c] || c;

function findCountyCode(elbase, countyName) {
  for (const row of elbase) {
    const name = row[5];
    if (name && name.includes(countyName) && row[3] === '000') {
      return { prv: row[0], city: row[1] };
    }
  }
  return null;
}

// ─── extractor ──────────────────────────────────────────
function extractVillageVotes({ dir, year, date, title, countyName }) {
  const elbase = readCsv(`${dir}/elbase.csv`);
  const elcand = readCsv(`${dir}/elcand.csv`);
  const elctks = readCsv(`${dir}/elctks.csv`);
  const elpaty = readCsv(`${dir}/elpaty.csv`);

  const code = findCountyCode(elbase, countyName);
  if (!code) throw new Error(`${year}: ${countyName} not found`);

  const parties = {};
  for (const [c, n] of elpaty) parties[c] = n;

  const candidates = {};
  for (const r of elcand) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] !== '000') continue;
    const canonical = canonParty(r[7]);
    candidates[r[5]] = {
      name: r[6],
      partyCode: canonical,
      partyName: parties[r[7]] || '無',
    };
  }

  // District names + village records
  const townByArea = {};
  const villageInfo = {};
  for (const r of elbase) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' && r[4] === '0000') continue;
    if (r[4] === '0000') { townByArea[r[3]] = r[5]; continue; }
    if (r[4].startsWith('0A') || r[4].startsWith('0B')) continue;
    const fullKey = `${r[3]}-${r[4]}`;
    villageInfo[fullKey] = { area: r[3], villageCode: r[4], townName: null, villageName: r[5] };
  }
  for (const k of Object.keys(villageInfo)) {
    villageInfo[k].townName = townByArea[villageInfo[k].area];
  }

  // Tickets per village
  const tickets = {};
  for (const r of elctks) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' || r[4] === '0000') continue;
    if (r[4].startsWith('0A') || r[4].startsWith('0B')) continue;
    const fullKey = `${r[3]}-${r[4]}`;
    const cand = r[6], votes = parseInt(r[7], 10), rate = parseFloat(r[8]);
    if (!tickets[fullKey]) tickets[fullKey] = {};
    tickets[fullKey][cand] = { votes, rate };
  }

  const villages = Object.entries(villageInfo).map(([key, v]) => {
    const t = tickets[key] || {};
    const results = Object.entries(t).map(([no, vv]) => ({
      name: candidates[no]?.name || '',
      partyCode: candidates[no]?.partyCode || '999',
      partyName: candidates[no]?.partyName || '無',
      votes: vv.votes,
      rate: vv.rate,
    })).filter(r => Number.isFinite(r.votes));
    results.sort((a, b) => b.votes - a.votes);
    const winner = results[0], runnerUp = results[1];
    return {
      key,
      area: v.area,
      villageCode: v.villageCode,
      townName: v.townName,
      villageName: v.villageName,
      winner: winner?.name,
      winnerPartyCode: winner?.partyCode,
      winnerPartyName: winner?.partyName,
      margin: winner && runnerUp ? winner.rate - runnerUp.rate : 0,
      results,
    };
  });
  villages.sort((a, b) => a.key.localeCompare(b.key));

  const path = `data/processed/ntpc-${year}-villages.json`;
  writeFileSync(path, JSON.stringify({ election: title, year, date, count: villages.length, villages }, null, 2));
  return villages.length;
}

const ELECTIONS = [
  { year: 1997, date: '1997-11-29', title: '1997 台北縣長（14屆） 里級', dir: 'data/raw/1997-縣市長', countyName: '臺北縣' },
  { year: 2001, date: '2001-12-01', title: '2001 台北縣長（15屆） 里級', dir: 'data/raw/2001-縣市長', countyName: '臺北縣' },
  { year: 2005, date: '2005-12-03', title: '2005 台北縣長（16屆） 里級', dir: 'data/raw/2005-縣市長', countyName: '臺北縣' },
  { year: 2010, date: '2010-11-27', title: '2010 新北市長（1屆） 里級', dir: 'data/raw/2010-直轄市長', countyName: '新北市' },
  { year: 2014, date: '2014-11-29', title: '2014 新北市長（2屆） 里級', dir: 'data/raw/2014-直轄市長', countyName: '新北市' },
  { year: 2018, date: '2018-11-24', title: '2018 新北市長（3屆） 里級', dir: 'data/raw/2018-直轄市長', countyName: '新北市' },
  { year: 2022, date: '2022-11-26', title: '2022 新北市長（4屆） 里級', dir: 'data/raw/2022-直轄市長-prv', countyName: '新北市' },
];

for (const e of ELECTIONS) {
  try {
    const n = extractVillageVotes(e);
    console.log(`✓ ${e.year}: ${n} villages`);
  } catch (err) {
    console.log(`✗ ${e.year}: ${err.message}`);
  }
}
