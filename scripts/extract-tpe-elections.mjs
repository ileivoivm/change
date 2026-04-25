// Extract 台北市長 mayoral elections 1994–2022 from CEC CSV files.
// Sources: kiang/db.cec.gov.tw  voteData/{year}直轄市長/
//
// Output: data/processed/tpe-{year}-mayor.json
//   Same schema as ntpc-{year}-mayor.json — compatible with palette.js + main.js.
//
// Party code normalization: legacy (1994–2006) codes → canonical post-2010 codes.

import { readFileSync, writeFileSync } from 'node:fs';

function parseLine(line) {
  if (!line.trim()) return null;
  return line.split(',').map(s => s.replace(/^\s*"?'?|"?\s*$/g, ''));
}
function readCsv(path) {
  return readFileSync(path, 'utf8').split('\n').map(parseLine).filter(r => r && r.length > 1);
}
function findCountyCode(elbase, countyName) {
  for (const row of elbase) {
    const name = row[5];
    if (name && name.includes(countyName) && row[3] === '000') {
      return { prv: row[0], city: row[1] };
    }
  }
  return null;
}

// Legacy (1994–2009) party codes → canonical post-2010 codes
// (same as extract-elections.mjs so the frontend palette stays consistent)
const LEGACY_TO_CANONICAL = {
  '1': '1',    // 中國國民黨
  '2': '16',   // 民主進步黨
  '3': '90',   // 親民黨
  '4': '95',   // 台灣團結聯盟
  '5': '74',   // 新黨
  '7': '106',  // 無黨團結聯盟
  '99': '999', // 無黨籍
};
function canonicalParty(code) {
  return LEGACY_TO_CANONICAL[code] || code;
}

function extract({ dir, year, date, title }) {
  const elbase = readCsv(`${dir}/elbase.csv`);
  const elcand = readCsv(`${dir}/elcand.csv`);
  const elctks = readCsv(`${dir}/elctks.csv`);
  const elpaty = readCsv(`${dir}/elpaty.csv`);

  const code = findCountyCode(elbase, '臺北市');
  if (!code) throw new Error(`${year}: 臺北市 not found in elbase`);

  const parties = {};
  for (const [pCode, pName] of elpaty) parties[pCode] = pName;

  // Candidates at city total level (dept=000)
  const candidates = {};
  for (const r of elcand) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] !== '000') continue;
    const no = r[5], name = r[6], rawPartyCode = r[7];
    const partyCode = canonicalParty(rawPartyCode);
    candidates[no] = { name, partyCode, partyName: parties[rawPartyCode] || '無' };
  }

  // District names from elbase (dept != 000, li = 0000)
  const districtNames = {};
  for (const r of elbase) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' || r[4] !== '0000') continue;
    districtNames[r[3]] = r[5];
  }

  // Vote tickets at district level
  // elctks columns: prv, city, area_code(01), dept, li, tbox, cand_no, votes, rate, victor
  const tickets = {};
  for (const r of elctks) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' || r[4] !== '0000') continue;
    const dept = r[3];
    const candNo = r[6];
    const votes = parseInt(r[7], 10);
    const rate = parseFloat(r[8]);
    if (!tickets[dept]) tickets[dept] = {};
    tickets[dept][candNo] = { votes, rate };
  }

  const districts = Object.entries(districtNames).map(([area, name]) => {
    const stem = name.slice(0, 2);
    const t = tickets[area] || {};
    const results = Object.entries(t)
      .map(([no, v]) => ({
        name: candidates[no]?.name || `候選人${no}`,
        partyCode: candidates[no]?.partyCode || '999',
        partyName: candidates[no]?.partyName || '無黨籍',
        votes: v.votes,
        rate: v.rate,
      }))
      .filter(r => Number.isFinite(r.votes))
      .sort((a, b) => b.votes - a.votes);
    const winner = results[0];
    const runnerUp = results[1];
    return {
      area, name, stem,
      winner: winner?.name || '',
      winnerParty: winner?.partyName || '',
      winnerPartyCode: winner?.partyCode || '',
      margin: winner && runnerUp ? Math.round((winner.rate - runnerUp.rate) * 100) / 100 : 0,
      results,
    };
  });
  districts.sort((a, b) => a.area.localeCompare(b.area));

  // Overall totals across all districts
  const totals = {};
  for (const d of districts) {
    for (const r of d.results) {
      if (!totals[r.name]) totals[r.name] = { ...r, votes: 0 };
      totals[r.name].votes += r.votes;
    }
  }
  const totalArr = Object.values(totals).sort((a, b) => b.votes - a.votes);
  const allVotes = totalArr.reduce((s, r) => s + r.votes, 0);
  totalArr.forEach(r => { r.rate = +(r.votes / allVotes * 100).toFixed(2); });

  const out = {
    election: title,
    year,
    date,
    source: 'CEC via kiang/db.cec.gov.tw',
    candidates: Object.values(candidates),
    districts,
    overall: { results: totalArr, winner: totalArr[0]?.name },
  };

  const path = `data/processed/tpe-${year}-mayor.json`;
  writeFileSync(path, JSON.stringify(out, null, 2));
  return { year, count: districts.length, overall: totalArr[0] };
}

const ELECTIONS = [
  { year: 1994, date: '1994-12-03', title: '1994 台北市長（1屆直轄）', dir: 'data/raw/1994-直轄市長' },
  { year: 1998, date: '1998-12-05', title: '1998 台北市長（2屆直轄）', dir: 'data/raw/1998-直轄市長' },
  { year: 2002, date: '2002-12-07', title: '2002 台北市長（3屆直轄）', dir: 'data/raw/2002-直轄市長' },
  { year: 2006, date: '2006-12-09', title: '2006 台北市長（4屆直轄）', dir: 'data/raw/2006-直轄市長' },
  { year: 2010, date: '2010-11-27', title: '2010 台北市長（5屆）',     dir: 'data/raw/2010-直轄市長' },
  { year: 2014, date: '2014-11-29', title: '2014 台北市長（6屆）',     dir: 'data/raw/2014-直轄市長' },
  { year: 2018, date: '2018-11-24', title: '2018 台北市長（7屆）',     dir: 'data/raw/2018-直轄市長' },
  { year: 2022, date: '2022-11-26', title: '2022 台北市長（8屆）',     dir: 'data/raw/2022-直轄市長-prv' },
];

for (const e of ELECTIONS) {
  try {
    const r = extract(e);
    console.log(`✓ ${e.year}: ${r.count} districts, 當選 ${r.overall?.name} (${r.overall?.partyName}) ${r.overall?.rate}%`);
  } catch (err) {
    console.error(`✗ ${e.year}: ${err.message}`);
  }
}
