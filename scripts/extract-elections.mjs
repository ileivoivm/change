// Unified extractor for NTPC/台北縣 mayoral elections 1997-2018.
// Handles two CEC CSV formats:
//   plain:  01,001,00,000,0000,臺北縣
//   quoted: "'01","'001","'00","'000","'0000","臺北縣"
//
// Dynamically finds the county's prv/city code by matching the name.
// Writes data/processed/ntpc-{year}-mayor.json per election.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Strip CSV quoting + Excel-guard apostrophe: `"'65"` → `65`
function parseLine(line) {
  if (!line.trim()) return null;
  return line.split(',').map(s => s.replace(/^\s*"?'?|"?\s*$/g, ''));
}

function readCsv(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map(parseLine)
    .filter(r => r && r.length > 1);
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

// CEC uses different party codes pre- and post-2010. Normalize to post-2010
// canonical codes so the frontend palette doesn't care about which era the
// data came from.
const LEGACY_TO_CANONICAL = {
  '1': '1',     // 中國國民黨
  '2': '16',    // 民主進步黨
  '3': '90',    // 親民黨
  '4': '95',    // 台灣團結聯盟
  '5': '74',    // 新黨
  '7': '106',   // 無黨團結聯盟
  '99': '999',  // 無黨籍
};
function canonicalParty(code) {
  return LEGACY_TO_CANONICAL[code] || code;
}

function extract({ dir, year, date, title, countyName, stripSuffix }) {
  const elbase = readCsv(`${dir}/elbase.csv`);
  const elcand = readCsv(`${dir}/elcand.csv`);
  const elctks = readCsv(`${dir}/elctks.csv`);
  const elpaty = readCsv(`${dir}/elpaty.csv`);

  const code = findCountyCode(elbase, countyName);
  if (!code) throw new Error(`${year}: county ${countyName} not found`);

  const parties = {};
  for (const [code, name] of elpaty) parties[code] = name;

  const candidates = {};
  for (const r of elcand) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    const no = r[5], name = r[6], rawPartyCode = r[7];
    if (r[3] === '000') {
      const partyCode = canonicalParty(rawPartyCode);
      candidates[no] = {
        name,
        partyCode,
        partyName: parties[rawPartyCode] || '無',
      };
    }
  }

  const districtNames = {};
  for (const r of elbase) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' || r[4] !== '0000') continue;
    districtNames[r[3]] = r[5];
  }

  const tickets = {};
  for (const r of elctks) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' || r[4] !== '0000') continue;
    const area = r[3];
    // columns: prv, city, ??, area, village, ??, cand_no, votes, rate, [winner]
    const candNo = r[6];
    const votes = parseInt(r[7], 10);
    const rate = parseFloat(r[8]);
    if (!tickets[area]) tickets[area] = {};
    tickets[area][candNo] = { votes, rate };
  }

  const districts = Object.entries(districtNames).map(([area, name]) => {
    const stem = stripSuffix ? name.replace(new RegExp(`(${stripSuffix})$`), '') : name.slice(0, -1);
    const t = tickets[area] || {};
    const results = Object.entries(t).map(([no, v]) => ({
      name: candidates[no]?.name || `候選人${no}`,
      partyCode: candidates[no]?.partyCode || '999',
      partyName: candidates[no]?.partyName || '無黨籍',
      votes: v.votes,
      rate: v.rate,
    })).filter(r => Number.isFinite(r.votes));
    results.sort((a, b) => b.votes - a.votes);
    const winner = results[0];
    const runnerUp = results[1];
    return {
      area, name, stem,
      winner: winner?.name,
      winnerParty: winner?.partyName,
      winnerPartyCode: winner?.partyCode,
      margin: winner && runnerUp ? winner.rate - runnerUp.rate : 0,
      results,
    };
  });
  districts.sort((a, b) => a.area.localeCompare(b.area));

  const out = {
    election: title,
    year,
    date,
    source: 'CEC via kiang/db.cec.gov.tw',
    candidates: Object.values(candidates),
    districts,
  };
  // Sum votes across districts to determine overall winner
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
  out.overall = { results: totalArr, winner: totalArr[0]?.name };

  const path = `data/processed/ntpc-${year}-mayor.json`;
  writeFileSync(path, JSON.stringify(out, null, 2));
  return { year, count: districts.length, overall: totalArr[0] };
}

// Note: 2009 skipped — 台北縣 did not hold 2009 election because 五都升格
// was pending (周錫瑋 stayed in office until 2010-12-24 升格新北市).
const ELECTIONS = [
  { year: 1997, date: '1997-11-29', title: '1997 台北縣長（14屆）', dir: 'data/raw/1997-縣市長', countyName: '臺北縣' },
  { year: 2001, date: '2001-12-01', title: '2001 台北縣長（15屆）', dir: 'data/raw/2001-縣市長', countyName: '臺北縣' },
  { year: 2005, date: '2005-12-03', title: '2005 台北縣長（16屆）', dir: 'data/raw/2005-縣市長', countyName: '臺北縣' },
  { year: 2010, date: '2010-11-27', title: '2010 新北市長（1屆·首任）', dir: 'data/raw/2010-直轄市長', countyName: '新北市' },
  { year: 2014, date: '2014-11-29', title: '2014 新北市長（2屆）', dir: 'data/raw/2014-直轄市長', countyName: '新北市' },
  { year: 2018, date: '2018-11-24', title: '2018 新北市長（3屆）', dir: 'data/raw/2018-直轄市長', countyName: '新北市' },
  { year: 2022, date: '2022-11-26', title: '2022 新北市長（4屆）', dir: 'data/raw/2022-直轄市長-prv', countyName: '新北市' },
];

for (const e of ELECTIONS) {
  try {
    const r = extract(e);
    console.log(`✓ ${e.year}: ${r.count} districts, 當選 ${r.overall?.name} (${r.overall?.partyName}) ${r.overall?.rate}%`);
  } catch (err) {
    console.log(`✗ ${e.year}: ${err.message}`);
  }
}
