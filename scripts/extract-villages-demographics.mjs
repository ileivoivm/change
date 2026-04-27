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
const EDU_YYY = process.env.EDU_YYY || '113';   // ODRP020 年度，最新 113 (2024)
const ONLY  = process.env.CITY || null;

const CITIES = [
  { key: 'ntpc', countyName: '新北市' },
  { key: 'tpe',  countyName: '臺北市' },   // 官方用「臺」，「台」會回 OD-0102-S 查無資料
  { key: 'tyc',  countyName: '桃園市' },
  { key: 'txg',  countyName: '臺中市' },
  { key: 'tnn',  countyName: '臺南市' },
  { key: 'khh',  countyName: '高雄市' },
];

async function fetchAllPages(yyymm, county, dataset = 'ODRP014') {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://www.ris.gov.tw/rs-opendata/api/v1/datastore/${dataset}/${yyymm}?PAGE=${page}&COUNTY=${encodeURIComponent(county)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.responseCode !== 'OD-0101-S') {
      if (page === 1) throw new Error(`No data for ${dataset}/${yyymm} ${county}: ${j.responseMessage}`);
      break;
    }
    all.push(...(j.responseData || []));
    const totalPage = Number(j.totalPage || 1);
    if (page >= totalPage) break;
    page++;
  }
  return all;
}

// ODRP020「各村里教育程度資料」每 row 51 欄，性別 × 畢業/肄業細分 11 種學歷。
// 我們聚合成 4 桶（研究所以上 / 大學專科 / 高中職 / 國中以下），畢業+肄業
// 一律算進對應桶（肄業也代表教育階段達到該層）。
function summarizeEducation(eduRec) {
  const sum = (...keys) => keys.reduce((s, k) => s + Number(eduRec[k] || 0), 0);
  const grad = 'graduated', ungrad = 'ungraduated';

  // 研究所以上 = 博士 + 碩士
  const graduate = sum(
    `edu_doctor_${grad}_m`,   `edu_doctor_${grad}_f`,
    `edu_doctor_${ungrad}_m`, `edu_doctor_${ungrad}_f`,
    `edu_master_${grad}_m`,   `edu_master_${grad}_f`,
    `edu_master_${ungrad}_m`, `edu_master_${ungrad}_f`,
  );
  // 大學專科 = 大學 + 二技 + 五專最後 2 年
  const college = sum(
    `edu_university_${grad}_m`,                `edu_university_${grad}_f`,
    `edu_university_${ungrad}_m`,              `edu_university_${ungrad}_f`,
    `edu_juniorcollege_2ys_${grad}_m`,         `edu_juniorcollege_2ys_${grad}_f`,
    `edu_juniorcollege_2ys_${ungrad}_m`,       `edu_juniorcollege_2ys_${ungrad}_f`,
    `edu_juniorcollege_5ys_final2y_${grad}_m`, `edu_juniorcollege_5ys_final2y_${grad}_f`,
    `edu_juniorcollege_5ys_final2y_${ungrad}_m`, `edu_juniorcollege_5ys_final2y_${ungrad}_f`,
  );
  // 高中職 = 高中（普通）+ 高職
  const senior = sum(
    `edu_senior_${grad}_m`,            `edu_senior_${grad}_f`,
    `edu_senior_${ungrad}_m`,          `edu_senior_${ungrad}_f`,
    `edu_seniorvocational_${grad}_m`,  `edu_seniorvocational_${grad}_f`,
    `edu_seniorvocational_${ungrad}_m`, `edu_seniorvocational_${ungrad}_f`,
  );
  // 國中以下 = 國中 + 國小 + 自修 + 不識字 (15+ 人口扣掉前三桶 fallback 同等)
  const junior = sum(
    `edu_junior_${grad}_m`,    `edu_junior_${grad}_f`,
    `edu_junior_${ungrad}_m`,  `edu_junior_${ungrad}_f`,
    `edu_primary_${grad}_m`,   `edu_primary_${grad}_f`,
    `edu_primary_${ungrad}_m`, `edu_primary_${ungrad}_f`,
    `edu_selfeducation_m`,     `edu_selfeducation_f`,
    `edu_illiterate_m`,        `edu_illiterate_f`,
  );

  const total15up = Number(eduRec.edu_age_15up_total || 0)
    || (graduate + college + senior + junior);
  return { total15up, graduate, college, senior, junior };
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
    console.log(`[${city.key}] fetching ${city.countyName} age (${YYYMM}) + edu (${EDU_YYY})…`);
    // 抓兩個資料集
    const [ageRaw, eduRaw] = await Promise.all([
      fetchAllPages(YYYMM, city.countyName, 'ODRP014'),
      fetchAllPages(EDU_YYY, city.countyName, 'ODRP020'),
    ]);
    // 教育資料用 district_code 索引（兩個資料集共享）
    const eduByCode = new Map();
    for (const e of eduRaw) eduByCode.set(e.district_code, e);

    const villages = ageRaw.map(r => {
      const base = summarize(r, city.countyName);
      const edu = eduByCode.get(r.district_code);
      if (edu) base.education = summarizeEducation(edu);
      return base;
    });
    const outPath = `data/processed/${city.key}-demographics.json`;
    ensureDir(outPath);
    writeFileSync(outPath, JSON.stringify({
      yyymm: YYYMM,
      eduYyy: EDU_YYY,
      generatedAt: new Date().toISOString(),
      villages,
    }));
    const eduMatched = villages.filter(v => v.education).length;
    console.log(`[${city.key}] ${villages.length} villages · edu matched ${eduMatched} · ${((Date.now()-t0)/1000).toFixed(1)}s → ${outPath}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
