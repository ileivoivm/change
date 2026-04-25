// Generalized village boundary + vote extractor for 六都.
//
// Usage:
//   node scripts/extract-villages.mjs                → ntpc (backward-compat)
//   node scripts/extract-villages.mjs --city tpe
//   node scripts/extract-villages.mjs --city tyc
//   node scripts/extract-villages.mjs --city txg
//   node scripts/extract-villages.mjs --city tnn
//   node scripts/extract-villages.mjs --city khh
//   node scripts/extract-villages.mjs --city all
//
// Outputs per city:
//   data/processed/{city}-villages.geo.json       — 里 boundary FeatureCollection
//   data/processed/{city}-{year}-villages.json    — per-year village vote results
//
// Boundary source: data/raw/twVillage.topo.json (uses pre-merger county names
// e.g. '台中縣'+'台中市' for the merged 臺中市; that's why geoCountyNames is a list).
//
// Village rows in elctks: the aggregate polling-station row uses r[5]='0' (pre-2022)
// or '0000' (2022); individual-station rows use non-zero codes — skip those.

import { feature } from 'topojson-client';
import { readFileSync, writeFileSync } from 'node:fs';

// ─── Boundary source (loaded once) ──────────────────────────────────────────

const topo = JSON.parse(readFileSync('data/raw/twVillage.topo.json', 'utf8'));
const _topoKey = Object.keys(topo.objects)[0];
const _allVillages = feature(topo, topo.objects[_topoKey]).features;

function buildBoundaryGeo(countyNames) {
  const merged = new Map();
  for (const f of _allVillages) {
    const p = f.properties;
    if (!countyNames.includes(p.COUNTYNAME)) continue;
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
  return { type: 'FeatureCollection', features: [...merged.values()] };
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseLine(line) {
  if (!line.trim()) return null;
  return line.split(',').map(s => s.replace(/^\s*"?'?|"?\s*$/g, ''));
}
function readCsv(p) {
  return readFileSync(p, 'utf8').split('\n').map(parseLine).filter(r => r && r.length > 1);
}

// ─── Party normalisation ──────────────────────────────────────────────────────

const LEGACY_TO_CANONICAL = {
  '1': '1', '2': '16', '3': '90', '4': '95', '5': '74', '7': '106', '99': '999',
};
const canonParty = c => LEGACY_TO_CANONICAL[c] || c;

function findCityCode(elbase, searchName) {
  for (const row of elbase) {
    if (row[5] && row[5].includes(searchName) && row[3] === '000') {
      return { prv: row[0], city: row[1] };
    }
  }
  return null;
}

// ─── Vote extractor ───────────────────────────────────────────────────────────

function extractVillageVotes({ dir, year, date, title, searchName, outputPrefix }) {
  const elbase = readCsv(`${dir}/elbase.csv`);
  const elcand = readCsv(`${dir}/elcand.csv`);
  const elctks = readCsv(`${dir}/elctks.csv`);
  const elpaty = readCsv(`${dir}/elpaty.csv`);

  const code = findCityCode(elbase, searchName);
  if (!code) throw new Error(`${year}: "${searchName}" not found in ${dir}/elbase.csv`);

  const parties = {};
  for (const [c, n] of elpaty) parties[c] = n;

  const candidates = {};
  for (const r of elcand) {
    if (r[0] !== code.prv || r[1] !== code.city || r[3] !== '000') continue;
    const canonical = canonParty(r[7]);
    candidates[r[5]] = { name: r[6], partyCode: canonical, partyName: parties[r[7]] || '無' };
  }

  // District names and village metadata from elbase
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

  // Aggregate village votes (r[5]=tbox, keep only the aggregate row where tbox parses to 0)
  const tickets = {};
  for (const r of elctks) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' || r[4] === '0000') continue;
    if (r[4].startsWith('0A') || r[4].startsWith('0B')) continue;
    if (parseInt(r[5], 10) !== 0) continue;
    const fullKey = `${r[3]}-${r[4]}`;
    const votes = parseInt(r[7], 10), rate = parseFloat(r[8]);
    if (!tickets[fullKey]) tickets[fullKey] = {};
    tickets[fullKey][r[6]] = { votes, rate };
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

  const outPath = `data/processed/${outputPrefix}-${year}-villages.json`;
  writeFileSync(outPath, JSON.stringify({ election: title, year, date, count: villages.length, villages }, null, 2));
  return villages.length;
}

// ─── City configs ─────────────────────────────────────────────────────────────
// geoCountyNames: COUNTYNAME(s) in twVillage.topo.json (pre-merger names).
// elections: same pattern as extract-elections.mjs — each entry has searchName
//   to handle city renames across eras.

const CITIES = {
  tpe: {
    outputPrefix: 'tpe',
    geoCountyNames: ['台北市'],
    elections: [
      { year: 1994, date: '1994-12-03', title: '1994 台北市長 里級', dir: 'data/raw/1994-直轄市長',     searchName: '臺北市' },
      { year: 1998, date: '1998-12-05', title: '1998 台北市長 里級', dir: 'data/raw/1998-直轄市長',     searchName: '臺北市' },
      { year: 2002, date: '2002-12-07', title: '2002 台北市長 里級', dir: 'data/raw/2002-直轄市長',     searchName: '臺北市' },
      { year: 2006, date: '2006-12-09', title: '2006 台北市長 里級', dir: 'data/raw/2006-直轄市長',     searchName: '臺北市' },
      { year: 2010, date: '2010-11-27', title: '2010 台北市長 里級', dir: 'data/raw/2010-直轄市長',     searchName: '臺北市' },
      { year: 2014, date: '2014-11-29', title: '2014 台北市長 里級', dir: 'data/raw/2014-直轄市長',     searchName: '臺北市' },
      { year: 2018, date: '2018-11-24', title: '2018 台北市長 里級', dir: 'data/raw/2018-直轄市長',     searchName: '臺北市' },
      { year: 2022, date: '2022-11-26', title: '2022 台北市長 里級', dir: 'data/raw/2022-直轄市長-prv',  searchName: '臺北市' },
    ],
  },

  ntpc: {
    outputPrefix: 'ntpc',
    geoCountyNames: ['台北縣'],
    elections: [
      { year: 1997, date: '1997-11-29', title: '1997 台北縣長 里級',       dir: 'data/raw/1997-縣市長',       searchName: '臺北縣' },
      { year: 2001, date: '2001-12-01', title: '2001 台北縣長 里級',       dir: 'data/raw/2001-縣市長',       searchName: '臺北縣' },
      { year: 2005, date: '2005-12-03', title: '2005 台北縣長 里級',       dir: 'data/raw/2005-縣市長',       searchName: '臺北縣' },
      { year: 2010, date: '2010-11-27', title: '2010 新北市長（1屆） 里級', dir: 'data/raw/2010-直轄市長',     searchName: '新北市' },
      { year: 2014, date: '2014-11-29', title: '2014 新北市長（2屆） 里級', dir: 'data/raw/2014-直轄市長',     searchName: '新北市' },
      { year: 2018, date: '2018-11-24', title: '2018 新北市長（3屆） 里級', dir: 'data/raw/2018-直轄市長',     searchName: '新北市' },
      { year: 2022, date: '2022-11-26', title: '2022 新北市長（4屆） 里級', dir: 'data/raw/2022-直轄市長-prv',  searchName: '新北市' },
    ],
  },

  tyc: {
    outputPrefix: 'tyc',
    geoCountyNames: ['桃園縣'],
    elections: [
      { year: 1997, date: '1997-11-29', title: '1997 桃園縣長 里級', dir: 'data/raw/1997-縣市長',       searchName: '桃園縣' },
      { year: 2001, date: '2001-12-01', title: '2001 桃園縣長 里級', dir: 'data/raw/2001-縣市長',       searchName: '桃園縣' },
      { year: 2005, date: '2005-12-03', title: '2005 桃園縣長 里級', dir: 'data/raw/2005-縣市長',       searchName: '桃園縣' },
      { year: 2009, date: '2009-12-05', title: '2009 桃園縣長 里級', dir: 'data/raw/2009-縣市長',       searchName: '桃園縣' },
      { year: 2014, date: '2014-11-29', title: '2014 桃園市長 里級', dir: 'data/raw/2014-直轄市長',     searchName: '桃園市' },
      { year: 2018, date: '2018-11-24', title: '2018 桃園市長 里級', dir: 'data/raw/2018-直轄市長',     searchName: '桃園市' },
      { year: 2022, date: '2022-11-26', title: '2022 桃園市長 里級', dir: 'data/raw/2022-直轄市長-prv',  searchName: '桃園市' },
    ],
  },

  txg: {
    outputPrefix: 'txg',
    // twVillage uses pre-merger names; combine both for complete boundary coverage
    geoCountyNames: ['台中市', '台中縣'],
    elections: [
      { year: 2010, date: '2010-11-27', title: '2010 台中市長（合併） 里級', dir: 'data/raw/2010-直轄市長',    searchName: '臺中市' },
      { year: 2014, date: '2014-11-29', title: '2014 台中市長 里級',         dir: 'data/raw/2014-直轄市長',    searchName: '臺中市' },
      { year: 2018, date: '2018-11-24', title: '2018 台中市長 里級',         dir: 'data/raw/2018-直轄市長',    searchName: '臺中市' },
      { year: 2022, date: '2022-11-26', title: '2022 台中市長 里級',         dir: 'data/raw/2022-直轄市長-prv', searchName: '臺中市' },
    ],
  },

  tnn: {
    outputPrefix: 'tnn',
    geoCountyNames: ['台南市', '台南縣'],
    elections: [
      { year: 2010, date: '2010-11-27', title: '2010 台南市長（合併） 里級', dir: 'data/raw/2010-直轄市長',    searchName: '臺南市' },
      { year: 2014, date: '2014-11-29', title: '2014 台南市長 里級',         dir: 'data/raw/2014-直轄市長',    searchName: '臺南市' },
      { year: 2018, date: '2018-11-24', title: '2018 台南市長 里級',         dir: 'data/raw/2018-直轄市長',    searchName: '臺南市' },
      { year: 2022, date: '2022-11-26', title: '2022 台南市長 里級',         dir: 'data/raw/2022-直轄市長-prv', searchName: '臺南市' },
    ],
  },

  khh: {
    outputPrefix: 'khh',
    geoCountyNames: ['高雄市', '高雄縣'],
    elections: [
      { year: 2010, date: '2010-11-27', title: '2010 高雄市長（合併） 里級', dir: 'data/raw/2010-直轄市長',    searchName: '高雄市' },
      { year: 2014, date: '2014-11-29', title: '2014 高雄市長 里級',         dir: 'data/raw/2014-直轄市長',    searchName: '高雄市' },
      { year: 2018, date: '2018-11-24', title: '2018 高雄市長 里級',         dir: 'data/raw/2018-直轄市長',    searchName: '高雄市' },
      { year: 2022, date: '2022-11-26', title: '2022 高雄市長 里級',         dir: 'data/raw/2022-直轄市長-prv', searchName: '高雄市' },
    ],
  },
};

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cityFlag = args[args.indexOf('--city') + 1];

const targetKeys = !cityFlag
  ? ['ntpc']
  : cityFlag === 'all'
    ? Object.keys(CITIES)
    : [cityFlag];

for (const key of targetKeys) {
  const city = CITIES[key];
  if (!city) {
    console.error(`Unknown city: "${key}". Valid: ${Object.keys(CITIES).join(', ')}, all`);
    process.exit(1);
  }

  console.log(`\n=== ${key.toUpperCase()} ===`);

  // Boundaries
  const geo = buildBoundaryGeo(city.geoCountyNames);
  const geoPath = `data/processed/${city.outputPrefix}-villages.geo.json`;
  writeFileSync(geoPath, JSON.stringify(geo));
  console.log(`boundaries: ${geo.features.length} villages → ${geoPath}`);

  // Per-year votes
  for (const e of city.elections) {
    try {
      const n = extractVillageVotes({ ...e, outputPrefix: city.outputPrefix });
      console.log(`✓ ${e.year}: ${n} villages`);
    } catch (err) {
      console.log(`✗ ${e.year}: ${err.message}`);
    }
  }
}
