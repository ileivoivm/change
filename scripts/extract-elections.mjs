// Generalized mayoral election extractor for 六都.
//
// Usage:
//   node scripts/extract-elections.mjs                → ntpc (backward-compat)
//   node scripts/extract-elections.mjs --city tpe
//   node scripts/extract-elections.mjs --city tyc
//   node scripts/extract-elections.mjs --city txg
//   node scripts/extract-elections.mjs --city tnn
//   node scripts/extract-elections.mjs --city khh
//   node scripts/extract-elections.mjs --city all     → run every city
//
// Output: data/processed/{city}-{year}-mayor.json
// Schema identical to original ntpc-{year}-mayor.json.
//
// Handles CEC code changes across years:
//   2010直轄市: prv 重編（台北01、新北02、台中03、台南04、高雄05）
//   2014直轄市: prv 全面重編（台北63、新北65、桃園68、台中66、台南67、高雄64）
//   2009縣市長: 台灣省 prv 01→03（桃園縣 01,003→03,003）
//
// Each election entry carries its own searchName to handle city renames
// (e.g. 臺北縣→新北市, 桃園縣→桃園市).

import { readFileSync, writeFileSync } from 'node:fs';

// ─── CSV helpers ────────────────────────────────────────────────────────────

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

// Find prv/city code by matching the city name in elbase (city-level row: dept=000)
function findCityCode(elbase, searchName) {
  for (const row of elbase) {
    if (row[5] && row[5].includes(searchName) && row[3] === '000') {
      return { prv: row[0], city: row[1] };
    }
  }
  return null;
}

// ─── Party code normalisation ────────────────────────────────────────────────
// Legacy (1994–2009) codes → canonical post-2010 codes so the frontend palette
// never needs to care about which era the data came from.

const LEGACY_TO_CANONICAL = {
  '1':  '1',    // 中國國民黨
  '2':  '16',   // 民主進步黨
  '3':  '90',   // 親民黨
  '4':  '95',   // 台灣團結聯盟
  '5':  '74',   // 新黨
  '7':  '106',  // 無黨團結聯盟
  '99': '999',  // 無黨籍
};
function canonicalParty(code) {
  return LEGACY_TO_CANONICAL[code] || code;
}

// ─── Core extractor ──────────────────────────────────────────────────────────

function extract({ dir, year, date, title, searchName, outputPrefix }) {
  const elbase = readCsv(`${dir}/elbase.csv`);
  const elcand = readCsv(`${dir}/elcand.csv`);
  const elctks = readCsv(`${dir}/elctks.csv`);
  const elpaty = readCsv(`${dir}/elpaty.csv`);

  const code = findCityCode(elbase, searchName);
  if (!code) throw new Error(`${year}: "${searchName}" not found in ${dir}/elbase.csv`);

  const parties = {};
  for (const [pCode, pName] of elpaty) parties[pCode] = pName;

  // Candidates at city total level (dept=000)
  const candidates = {};
  for (const r of elcand) {
    if (r[0] !== code.prv || r[1] !== code.city || r[3] !== '000') continue;
    const no = r[5], name = r[6], rawPartyCode = r[7];
    const partyCode = canonicalParty(rawPartyCode);
    candidates[no] = { name, partyCode, partyName: parties[rawPartyCode] || '無' };
  }

  // District names: dept != 000 and li = 0000
  const districtNames = {};
  for (const r of elbase) {
    if (r[0] !== code.prv || r[1] !== code.city) continue;
    if (r[3] === '000' || r[4] !== '0000') continue;
    districtNames[r[3]] = r[5];
  }

  // Vote tallies at district level
  // elctks columns: prv, city, area, dept, li, tbox, cand_no, votes, rate, [victor]
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
    // First 2 chars as stem — works for all six cities across all eras:
    // 台北縣 鄉/鎮/市 (3 chars), 新北市 區 (3 chars), 直轄市 區 (3 chars), etc.
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
      margin: winner && runnerUp
        ? Math.round((winner.rate - runnerUp.rate) * 100) / 100
        : 0,
      results,
    };
  });
  districts.sort((a, b) => a.area.localeCompare(b.area));

  // City-wide totals
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

  const outPath = `data/processed/${outputPrefix}-${year}-mayor.json`;
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  return { year, count: districts.length, overall: totalArr[0] };
}

// ─── City configs ────────────────────────────────────────────────────────────
// Each election entry has its own searchName to handle mid-career renames.
// dataDir patterns:
//   {year}-直轄市長       — 2010–2018 (non-prv)
//   {year}-直轄市長-prv   — 2022 only (CEC split into two dirs)
//   {year}-縣市長         — pre-upgrade county elections

const CITIES = {
  tpe: {
    outputPrefix: 'tpe',
    elections: [
      { year: 1994, date: '1994-12-03', title: '1994 台北市長（1屆直轄）', dir: 'data/raw/1994-直轄市長',    searchName: '臺北市' },
      { year: 1998, date: '1998-12-05', title: '1998 台北市長（2屆直轄）', dir: 'data/raw/1998-直轄市長',    searchName: '臺北市' },
      { year: 2002, date: '2002-12-07', title: '2002 台北市長（3屆直轄）', dir: 'data/raw/2002-直轄市長',    searchName: '臺北市' },
      { year: 2006, date: '2006-12-09', title: '2006 台北市長（4屆直轄）', dir: 'data/raw/2006-直轄市長',    searchName: '臺北市' },
      { year: 2010, date: '2010-11-27', title: '2010 台北市長（5屆）',     dir: 'data/raw/2010-直轄市長',    searchName: '臺北市' },
      { year: 2014, date: '2014-11-29', title: '2014 台北市長（6屆）',     dir: 'data/raw/2014-直轄市長',    searchName: '臺北市' },
      { year: 2018, date: '2018-11-24', title: '2018 台北市長（7屆）',     dir: 'data/raw/2018-直轄市長',    searchName: '臺北市' },
      { year: 2022, date: '2022-11-26', title: '2022 台北市長（8屆）',     dir: 'data/raw/2022-直轄市長-prv', searchName: '臺北市' },
    ],
  },

  ntpc: {
    outputPrefix: 'ntpc',
    elections: [
      // 台北縣長（縣市長選舉，prv=01 city=001）
      { year: 1997, date: '1997-11-29', title: '1997 台北縣長（14屆）',         dir: 'data/raw/1997-縣市長',       searchName: '臺北縣' },
      { year: 2001, date: '2001-12-01', title: '2001 台北縣長（15屆）',         dir: 'data/raw/2001-縣市長',       searchName: '臺北縣' },
      { year: 2005, date: '2005-12-03', title: '2005 台北縣長（16屆）',         dir: 'data/raw/2005-縣市長',       searchName: '臺北縣' },
      // 升格後新北市長（直轄市，prv 02→65）
      { year: 2010, date: '2010-11-27', title: '2010 新北市長（1屆·首任）',     dir: 'data/raw/2010-直轄市長',    searchName: '新北市' },
      { year: 2014, date: '2014-11-29', title: '2014 新北市長（2屆）',          dir: 'data/raw/2014-直轄市長',    searchName: '新北市' },
      { year: 2018, date: '2018-11-24', title: '2018 新北市長（3屆）',          dir: 'data/raw/2018-直轄市長',    searchName: '新北市' },
      { year: 2022, date: '2022-11-26', title: '2022 新北市長（4屆）',          dir: 'data/raw/2022-直轄市長-prv', searchName: '新北市' },
    ],
  },

  tyc: {
    outputPrefix: 'tyc',
    elections: [
      // 桃園縣長（prv=01 city=003；2009 prv 改為 03）
      { year: 1997, date: '1997-11-29', title: '1997 桃園縣長',         dir: 'data/raw/1997-縣市長',       searchName: '桃園縣' },
      { year: 2001, date: '2001-12-01', title: '2001 桃園縣長',         dir: 'data/raw/2001-縣市長',       searchName: '桃園縣' },
      { year: 2005, date: '2005-12-03', title: '2005 桃園縣長',         dir: 'data/raw/2005-縣市長',       searchName: '桃園縣' },
      { year: 2009, date: '2009-12-05', title: '2009 桃園縣長',         dir: 'data/raw/2009-縣市長',       searchName: '桃園縣' },
      // 升格後桃園市長（直轄市 prv=68，2014-12-25 升格，選舉同年11月）
      { year: 2014, date: '2014-11-29', title: '2014 桃園市長（1屆）',  dir: 'data/raw/2014-直轄市長',    searchName: '桃園市' },
      { year: 2018, date: '2018-11-24', title: '2018 桃園市長（2屆）',  dir: 'data/raw/2018-直轄市長',    searchName: '桃園市' },
      { year: 2022, date: '2022-11-26', title: '2022 桃園市長（3屆）',  dir: 'data/raw/2022-直轄市長-prv', searchName: '桃園市' },
    ],
  },

  txg: {
    outputPrefix: 'txg',
    elections: [
      // 台中縣+台中市 2010-12-25 合併升格，選舉同年11月（prv=03→66）
      { year: 2010, date: '2010-11-27', title: '2010 台中市長（1屆合併）', dir: 'data/raw/2010-直轄市長',    searchName: '臺中市' },
      { year: 2014, date: '2014-11-29', title: '2014 台中市長（2屆）',     dir: 'data/raw/2014-直轄市長',    searchName: '臺中市' },
      { year: 2018, date: '2018-11-24', title: '2018 台中市長（3屆）',     dir: 'data/raw/2018-直轄市長',    searchName: '臺中市' },
      { year: 2022, date: '2022-11-26', title: '2022 台中市長（4屆）',     dir: 'data/raw/2022-直轄市長-prv', searchName: '臺中市' },
    ],
  },

  tnn: {
    outputPrefix: 'tnn',
    elections: [
      // 台南縣+台南市 2010-12-25 合併升格（prv=04→67）
      { year: 2010, date: '2010-11-27', title: '2010 台南市長（1屆合併）', dir: 'data/raw/2010-直轄市長',    searchName: '臺南市' },
      { year: 2014, date: '2014-11-29', title: '2014 台南市長（2屆）',     dir: 'data/raw/2014-直轄市長',    searchName: '臺南市' },
      { year: 2018, date: '2018-11-24', title: '2018 台南市長（3屆）',     dir: 'data/raw/2018-直轄市長',    searchName: '臺南市' },
      { year: 2022, date: '2022-11-26', title: '2022 台南市長（4屆）',     dir: 'data/raw/2022-直轄市長-prv', searchName: '臺南市' },
    ],
  },

  khh: {
    outputPrefix: 'khh',
    elections: [
      // 高雄縣+高雄市 2010-12-25 合併升格（prv=05→64）
      { year: 2010, date: '2010-11-27', title: '2010 高雄市長（1屆合併）', dir: 'data/raw/2010-直轄市長',    searchName: '高雄市' },
      { year: 2014, date: '2014-11-29', title: '2014 高雄市長（2屆）',     dir: 'data/raw/2014-直轄市長',    searchName: '高雄市' },
      { year: 2018, date: '2018-11-24', title: '2018 高雄市長（3屆）',     dir: 'data/raw/2018-直轄市長',    searchName: '高雄市' },
      { year: 2022, date: '2022-11-26', title: '2022 高雄市長（4屆）',     dir: 'data/raw/2022-直轄市長-prv', searchName: '高雄市' },
    ],
  },
};

// ─── CLI entry point ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cityFlag = args[args.indexOf('--city') + 1];

// Backward-compat: no --city flag → default to ntpc (original behaviour)
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
  for (const e of city.elections) {
    try {
      const r = extract({ ...e, outputPrefix: city.outputPrefix });
      console.log(`✓ ${e.year}: ${r.count} 區, 當選 ${r.overall?.name} (${r.overall?.partyName}) ${r.overall?.rate}%`);
    } catch (err) {
      console.log(`✗ ${e.year}: ${err.message}`);
    }
  }
}
