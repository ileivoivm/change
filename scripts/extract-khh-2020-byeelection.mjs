#!/usr/bin/env node
/**
 * extract-khh-2020-byeelection.mjs
 *
 * Fetches 2020-08-15 高雄市長補選（3屆）district-level results from CEC API
 * and writes data/processed/khh-2020-mayor.json
 *
 * Source: CEC db.cec.gov.tw BEL/C1 themeId=4f9c64c708b10bbee8ff568fcc3529b8
 * prv_code=64 (高雄市), vote_date=2020-08-15
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROCESSED = join(__dirname, '../data/processed');

const THEME_ID = '4f9c64c708b10bbee8ff568fcc3529b8';
const BASE = 'https://db.cec.gov.tw/static/elections/data';
const HEADERS = {
  'Referer': 'https://db.cec.gov.tw/',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; CHANGE-project/1.0)',
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Party code → short code mapping (extend as needed)
const PARTY_SHORT = {
  '16': 'DPP',
  '1': 'KMT',
  '350': 'TPP',
  '0': 'IND',
};

async function main() {
  const KEY = '64_000_00_000_0000';

  console.log('Fetching district-level tickets…');
  const ticketsRaw = await fetchJSON(
    `${BASE}/tickets/BEL/C1/00/${THEME_ID}/D/${KEY}.json`
  );
  const rows = ticketsRaw[KEY];
  console.log(`  → ${rows.length} rows`);

  // Group by dept_code
  const byDept = {};
  for (const r of rows) {
    if (!byDept[r.dept_code]) byDept[r.dept_code] = [];
    byDept[r.dept_code].push(r);
  }

  // Derive candidate list from first district (sorted by cand_no)
  const firstDept = Object.keys(byDept).sort()[0];
  const candidates = byDept[firstDept]
    .sort((a, b) => a.cand_no - b.cand_no)
    .map(r => ({
      name: r.cand_name,
      partyCode: String(r.party_code),
      partyName: r.party_name,
    }));

  console.log('Candidates:', candidates.map(c => `${c.name}(${c.partyCode})`).join(', '));

  // Build districts array
  const districts = Object.keys(byDept).sort().map(dept => {
    const dRows = byDept[dept].sort((a, b) => a.cand_no - b.cand_no);
    const winner = dRows.find(r => r.is_victor === '*');
    const others = dRows
      .filter(r => r.is_victor !== '*')
      .sort((a, b) => b.ticket_percent - a.ticket_percent);
    const margin = winner
      ? Math.round((winner.ticket_percent - others[0].ticket_percent) * 100) / 100
      : 0;
    const name = dRows[0].area_name;
    return {
      area: dept,
      name,
      stem: name.slice(0, 2),
      winner: winner ? winner.cand_name : '',
      winnerParty: winner ? winner.party_name : '',
      winnerPartyCode: winner ? String(winner.party_code) : '',
      margin,
      results: dRows.map(r => ({
        name: r.cand_name,
        partyCode: String(r.party_code),
        partyName: r.party_name,
        votes: r.ticket_num,
        rate: r.ticket_percent,
      })),
    };
  });

  const output = {
    election: '2020 高雄市長補選（3屆）',
    year: 2020,
    date: '2020-08-15',
    source: `CEC db.cec.gov.tw BEL/C1 themeId=${THEME_ID}`,
    candidates,
    districts,
  };

  const outPath = join(PROCESSED, 'khh-2020-mayor.json');
  mkdirSync(PROCESSED, { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`  ${districts.length} districts`);

  // Quick sanity check
  const dppWins = districts.filter(d => d.winnerPartyCode === '16').length;
  const kmtWins = districts.filter(d => d.winnerPartyCode === '1').length;
  console.log(`  DPP wins: ${dppWins}, KMT wins: ${kmtWins}`);
}

main().catch(e => { console.error(e); process.exit(1); });
