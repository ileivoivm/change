// Pull latest village-level demographics from MOI 戶政司 ODRP014
// (村里戶數、單一年齡人口×性別) for each of the six 直轄市.
//
// Endpoint: https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP014/{yyymm}
//   yyymm = 民國年月（114年1月 → 11401，115年3月 → 11503）
//   COUNTY filter accepts the official 「臺」 (NOT 「台」) form
//
// Output: data/processed/{city}-demographics.json
//   Compact per-village summary (households, sex, age buckets, median age,
//   estimated voter count = age 20+). 200+ raw fields per row → ~10 fields
//   here so the JSON imports cleanly into Vite without bloating bundle.
//
// Usage:
//   node scripts/extract-villages-demographics.mjs           # all six cities, 11503
//   YYYMM=11502 node scripts/extract-villages-demographics.mjs
//   CITY=ntpc node scripts/extract-villages-demographics.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const YYYMM = process.env.YYYMM || '11503';
const ONLY  = process.env.CITY || null;

const CITIES = [
  { key: 'ntpc', countyName: '新北市' },
  { key: 'tpe',  countyName: '臺北市' },   // 官方用「臺」，「台」會回 OD-0102-S 查無資料
  { key: 'tyc',  countyName: '桃園市' },
  { key: 'txg',  countyName: '臺中市' },
  { key: 'tnn',  countyName: '臺南市' },
  { key: 'khh',  countyName: '高雄市' },
];

async function fetchAllPages(yyymm, county) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP014/${yyymm}?PAGE=${page}&COUNTY=${encodeURIComponent(county)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.responseCode !== 'OD-0101-S') {
      if (page === 1) throw new Error(`No data for ${county} ${yyymm}: ${j.responseMessage}`);
      break;
    }
    all.push(...(j.responseData || []));
    const totalPage = Number(j.totalPage || 1);
    if (page >= totalPage) break;
    page++;
  }
  return all;
}

// Sum people across an age range (inclusive). 100+ is a single bucket.
function sumAgeRange(rec, lo, hi) {
  let s = 0;
  for (let a = lo; a <= Math.min(hi, 99); a++) {
    const k = String(a).padStart(3, '0');
    s += Number(rec[`people_age_${k}_m`] || 0) + Number(rec[`people_age_${k}_f`] || 0);
  }
  if (hi >= 100) {
    s += Number(rec.people_age_100up_m || 0) + Number(rec.people_age_100up_f || 0);
  }
  return s;
}

function estimateMedianAge(rec) {
  const total = Number(rec.people_total || 0);
  if (!total) return null;
  let cum = 0;
  const half = total / 2;
  for (let a = 0; a <= 100; a++) {
    const isLast = a === 100;
    const m = isLast ? Number(rec.people_age_100up_m || 0) : Number(rec[`people_age_${String(a).padStart(3, '0')}_m`] || 0);
    const f = isLast ? Number(rec.people_age_100up_f || 0) : Number(rec[`people_age_${String(a).padStart(3, '0')}_f`] || 0);
    cum += m + f;
    if (cum >= half) return a;
  }
  return null;
}

function summarize(rec, countyName) {
  // site_id is 縣市+鄉鎮市區 like "新北市板橋區"; strip county prefix to get townName
  const siteId = rec.site_id || '';
  const townName = siteId.startsWith(countyName) ? siteId.slice(countyName.length) : siteId;
  const pop = Number(rec.people_total || 0);
  const popM = Number(rec.people_total_m || 0);
  const popF = Number(rec.people_total_f || 0);
  return {
    townName,
    villageName: rec.village,
    districtCode: rec.district_code,
    households: Number(rec.household_no || 0),
    pop, popM, popF,
    voters20up: sumAgeRange(rec, 20, 100),
    medianAge: estimateMedianAge(rec),
    age: {
      a0_19:  sumAgeRange(rec, 0, 19),
      a20_39: sumAgeRange(rec, 20, 39),
      a40_59: sumAgeRange(rec, 40, 59),
      a60up:  sumAgeRange(rec, 60, 100),
    },
  };
}

function ensureDir(path) { mkdirSync(dirname(path), { recursive: true }); }

async function main() {
  const cities = ONLY ? CITIES.filter(c => c.key === ONLY) : CITIES;
  if (ONLY && cities.length === 0) {
    console.error(`Unknown CITY: ${ONLY}. Valid: ${CITIES.map(c => c.key).join(', ')}`);
    process.exit(1);
  }
  for (const city of cities) {
    const t0 = Date.now();
    console.log(`[${city.key}] fetching ${city.countyName} ${YYYMM}…`);
    const raw = await fetchAllPages(YYYMM, city.countyName);
    const villages = raw.map(r => summarize(r, city.countyName));
    const outPath = `data/processed/${city.key}-demographics.json`;
    ensureDir(outPath);
    writeFileSync(outPath, JSON.stringify({ yyymm: YYYMM, generatedAt: new Date().toISOString(), villages }));
    console.log(`[${city.key}] ${villages.length} villages · ${((Date.now()-t0)/1000).toFixed(1)}s → ${outPath}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
