// Pre-generate share pages + OG PNGs for every 2022 village across the six
// directly-governed municipalities (六都).
//
// Outputs to dist/ (alongside Vite's build output):
//   dist/share/{city}/{districtStem}/{villageStem}/index.html
//       — tiny HTML with OG meta + JS redirect to SPA
//   dist/og/{city}/{districtStem}/{villageStem}.png
//       — 1200×630 PNG (social card)
//
// Backward-compat: ntpc 2022 cards are also written to the legacy paths
//   dist/share/2022/{districtStem}/{villageStem}/index.html
//   dist/og/2022/{districtStem}/{villageStem}.png
// so that FB / LINE / Threads URLs already crawled (30-day cache) still work.
//
// Usage:  npm run build     (vite build → then this)
//         npm run build:share
//         CITY=tpe npm run build:share   (build only one city)
//         LIMIT=20 npm run build:share   (limit count per city for testing)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PARTY_COLORS } from '../src/palette.js';

// ───────── config ─────────
const SITE_BASE = process.env.SITE_BASE || 'https://ileivoivm.github.io/change';
const DIST = 'dist';
const YEAR = 2022;

// Per-city display config + history-strip year span. The strip shows the
// chosen years so viewers see the arc of one village across multiple
// elections; cities that didn't exist in their current form before 2010
// (台中/台南/高雄 縣市合併) only show 2010-2022.
const CITIES = [
  { key: 'ntpc', cityName: '新北市', mayorRole: '新北市長', historyYears: [2005, 2010, 2014, 2018, 2022] },
  { key: 'tpe',  cityName: '台北市', mayorRole: '台北市長', historyYears: [2002, 2006, 2010, 2014, 2018, 2022] },
  { key: 'tyc',  cityName: '桃園市', mayorRole: '桃園市長', historyYears: [2005, 2009, 2014, 2018, 2022] },
  { key: 'txg',  cityName: '台中市', mayorRole: '台中市長', historyYears: [2010, 2014, 2018, 2022] },
  { key: 'tnn',  cityName: '台南市', mayorRole: '台南市長', historyYears: [2010, 2014, 2018, 2022] },
  { key: 'khh',  cityName: '高雄市', mayorRole: '高雄市長', historyYears: [2010, 2014, 2018, 2022] },
];

const FONT_CACHE = '.cache/NotoSansTC-Medium.otf';
const FONT_URL = 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Medium.otf';

// ───────── helpers ─────────
const hex6 = n => '#' + n.toString(16).padStart(6, '0');
const partyHex = code => hex6((PARTY_COLORS[code] || PARTY_COLORS.DEFAULT).hex);
const partyName = code => (PARTY_COLORS[code] || PARTY_COLORS.DEFAULT).name;
const fmt = n => n.toLocaleString('en-US');
const stem = s => s.slice(0, -1); // 雙溪區 → 雙溪, 長源里 → 長源
const esc = s => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

async function ensureFont() {
  if (!existsSync(FONT_CACHE)) {
    mkdirSync(dirname(FONT_CACHE), { recursive: true });
    console.log('fetching Noto Sans TC (first run, ~8MB)…');
    const buf = await fetch(FONT_URL).then(r => {
      if (!r.ok) throw new Error(`font fetch failed: ${r.status}`);
      return r.arrayBuffer();
    });
    writeFileSync(FONT_CACHE, Buffer.from(buf));
  }
  return readFileSync(FONT_CACHE);
}

function writeFileRec(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

// ───────── village 17-year history ─────────
// Loads all per-year village JSON once, returns:
//   Map<townStem/villageStem, { years: { [y]: partyCode }, flips, dominantPartyCode, dataYears }>
// townName varies across years (台北縣 板橋市 → 新北市 板橋區), so we key on
// stem (drop the trailing 市/區/里) which stays stable. Same approach the
// app uses in main.js → villageHistoryMap.
function loadVillageHistory(city) {
  const m = new Map();
  for (const y of city.historyYears) {
    const path = `data/processed/${city.key}-${y}-villages.json`;
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    for (const v of data.villages || []) {
      const key = stem(v.townName) + '/' + stem(v.villageName);
      let entry = m.get(key);
      if (!entry) {
        entry = { years: {} };
        m.set(key, entry);
      }
      entry.years[y] = v.winnerPartyCode;
    }
  }
  // Aggregate flips + dominant party
  for (const entry of m.values()) {
    const seq = city.historyYears.map(y => entry.years[y]).filter(Boolean);
    let flips = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) flips++;
    entry.flips = flips;
    entry.dataYears = seq.length;
    const tally = {};
    for (const c of seq) tally[c] = (tally[c] || 0) + 1;
    entry.dominantPartyCode = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  return m;
}

// Identity label — matches the in-app strip so shared cards feel continuous
// with the site. Permanent labels (永藍/永綠/永白) use Taiwanese convention;
// anything else falls back to party name for forward-compat if a new party
// sweeps a village's history.
function permanentLabel(code) {
  if (code === '1') return '永藍里';
  if (code === '16') return '永綠里';
  if (code === '350') return '永白里';
  const n = (PARTY_COLORS[code] || {}).name || '單黨';
  return `永 ${n} 里`;
}

function identityMeta(entry, historyYears) {
  if (!entry || entry.dataYears < 2) {
    return { label: null, sub: `近 ${historyYears.length} 場里長選舉` };
  }
  if (entry.flips === 0) {
    return { label: permanentLabel(entry.dominantPartyCode), sub: `${entry.dataYears} 場未翻轉` };
  }
  if (entry.flips === 1) {
    return { label: '翻轉里', sub: '翻過 1 次' };
  }
  return { label: '搖擺里', sub: `翻過 ${entry.flips} 次` };
}

// ───────── flip math ─────────
function flipMath(results) {
  if (!results || results.length < 2) return null;
  const [w, l] = results;
  const gap = w.votes - l.votes;
  if (gap <= 0) return null;
  return {
    winner: w,
    loser: l,
    gap,
    swing: Math.ceil((gap + 1) / 2),
    mobilize: gap + 1,
  };
}

// ───────── SVG (satori) layout ─────────
// satori takes React-like objects; we build with plain object literals.
const h = (type, props = {}, ...children) => ({
  type,
  props: { ...props, children: children.flat().filter(c => c != null && c !== false) },
});

function ogLayout(ctx) {
  const { district, village, winner, loser, margin, flip, history, meta, historyYears } = ctx;
  const winColor = partyHex(winner.partyCode);
  const loseColor = partyHex(loser.partyCode);
  const winPct = winner.rate;
  const losePct = loser.rate;

  // Helper: candidate row (satori needs explicit display: flex everywhere).
  const row = (c, color, pct) => h('div', {
    style: { display: 'flex', alignItems: 'center', marginBottom: 6 },
  },
    h('div', { style: { display: 'flex', width: 20, height: 20, borderRadius: 4, background: color, marginRight: 14 } }),
    h('div', { style: { display: 'flex', fontWeight: 700, marginRight: 14 } }, c.name),
    h('div', { style: { display: 'flex', color: '#888', fontSize: 22, marginRight: 'auto' } }, c.partyName),
    h('div', { style: { display: 'flex', fontWeight: 700, marginRight: 16 } }, `${fmt(c.votes)} 票`),
    h('div', { style: { display: 'flex', fontWeight: 700, color: color, minWidth: 104, justifyContent: 'flex-end' } }, `${pct.toFixed(1)}%`),
  );

  // 17-year history strip — 5 squares for 2005/2010/2014/2018/2022. The 2022
  // square is outlined so the viewer instantly locates "the year this card is
  // about". Years without village-level data for this specific village show a
  // muted hatched tile (rare — ~1% of villages).
  const stripSquare = (y) => {
    const code = history?.years[y];
    const isCurrent = y === YEAR;
    if (!code) {
      return h('div', {
        style: {
          display: 'flex', flex: 1, height: 34,
          borderRadius: 5,
          background: '#e5e3dc',
        },
      });
    }
    const color = partyHex(code);
    return h('div', {
      style: {
        display: 'flex', flex: 1, height: 34,
        borderRadius: 5,
        background: color,
        ...(isCurrent ? {
          border: '3px solid #1a1a1a',
          transform: 'scale(1.06)',
        } : {}),
      },
    });
  };

  const stripLabels = h('div', {
    style: {
      display: 'flex', width: '100%',
      fontSize: 16, color: '#aaa', fontWeight: 600,
      letterSpacing: 1, marginBottom: 4,
    },
  },
    ...historyYears.map((y, i) => h('div', {
      style: {
        display: 'flex', flex: 1,
        justifyContent: i === 0 ? 'flex-start' : (i === historyYears.length - 1 ? 'flex-end' : 'center'),
      },
    }, String(y))),
  );

  const stripRow = h('div', {
    style: { display: 'flex', width: '100%', gap: 8, alignItems: 'center' },
  }, ...historyYears.map(stripSquare));

  const stripMeta = h('div', {
    style: {
      display: 'flex', alignItems: 'baseline',
      marginTop: 8, fontSize: 20, color: '#666',
      letterSpacing: 1,
    },
  },
    meta.label ? h('div', {
      style: { display: 'flex', fontWeight: 800, color: '#1a1a1a', marginRight: 10 },
    }, meta.label) : null,
    h('div', { style: { display: 'flex' } }, meta.sub),
  );

  return h('div', {
    style: {
      width: '1200px', height: '630px',
      background: '#f3f1ea',
      display: 'flex', flexDirection: 'column',
      padding: '44px 60px',
      fontFamily: 'Noto Sans TC',
      color: '#2a2a2a',
    },
  },
    // tag
    h('div', {
      style: { display: 'flex', fontSize: 24, color: '#888', letterSpacing: 2, fontWeight: 500 },
    }, `新北市 · ${district}`),

    // big title
    h('div', {
      style: {
        display: 'flex', marginTop: 6,
        fontSize: 116, fontWeight: 900, lineHeight: 1.0,
        color: '#1a1a1a', letterSpacing: 2,
      },
    }, village),

    // bar
    h('div', {
      style: {
        display: 'flex', width: '100%', height: 22,
        borderRadius: 11, overflow: 'hidden', marginTop: 22,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    },
      h('div', { style: { display: 'flex', width: `${winPct}%`, height: '100%', background: winColor } }),
      h('div', { style: { display: 'flex', width: `${losePct}%`, height: '100%', background: loseColor } }),
    ),

    // candidate rows (2022 race)
    h('div', {
      style: { display: 'flex', flexDirection: 'column', marginTop: 14, fontSize: 28 },
    },
      row(winner, winColor, winPct),
      row(loser, loseColor, losePct),
    ),

    // 17-year strip: year labels / squares / identity meta
    h('div', {
      style: {
        display: 'flex', flexDirection: 'column',
        marginTop: 18, paddingTop: 16,
        borderTop: '1px solid rgba(0,0,0,0.08)',
      },
    }, stripLabels, stripRow, stripMeta),

    // flip call — strongest visual element
    h('div', {
      style: {
        display: 'flex', alignItems: 'center',
        marginTop: 20, padding: '18px 28px',
        background: loseColor, color: '#fff',
        borderRadius: 14, fontSize: 36, fontWeight: 900,
        letterSpacing: 1,
      },
    },
      `${loser.partyName} 翻盤需 ${fmt(flip.swing)} 票改投`,
    ),

    // footer
    h('div', {
      style: {
        display: 'flex', marginTop: 'auto',
        justifyContent: 'space-between', alignItems: 'center',
        fontSize: 18, color: '#888',
      },
    },
      h('div', { style: { display: 'flex' } }, '2022 新北市長 · 台灣選戰版圖'),
      h('div', { style: { display: 'flex' } }, 'ileivoivm.github.io/change'),
    ),
  );
}

async function renderPng(fontBuffer, ctx) {
  const svg = await satori(ogLayout(ctx), {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Noto Sans TC', data: fontBuffer, weight: 500, style: 'normal' }],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}

// ───────── HTML template ─────────
function shareHtml(ctx) {
  const { city, district, village, dStem, vStem, winner, loser, margin, flip } = ctx;
  const cityKey = city.key;
  const cityName = city.cityName;
  const mayorRole = city.mayorRole;
  const dEnc = encodeURIComponent(dStem);
  const vEnc = encodeURIComponent(vStem);
  const spaUrl = `${SITE_BASE}/?city=${cityKey}&y=${YEAR}&d=${dEnc}&v=${vEnc}`;
  const shareUrl = `${SITE_BASE}/share/${cityKey}/${dEnc}/${vEnc}/`;
  const ogImageUrl = `${SITE_BASE}/og/${cityKey}/${dEnc}/${vEnc}.png`;

  const title = `${cityName}・${district} ${village} — ${loser.partyName}翻盤需 ${fmt(flip.swing)} 票`;
  const desc = `${YEAR} ${mayorRole}：${winner.name} ${fmt(winner.votes)} 票 vs ${loser.name} ${fmt(loser.votes)} 票｜差距 ${margin.toFixed(1)}%`;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>${esc(title)} | CHANGE</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(spaUrl)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="CHANGE 台灣選戰版圖">
<meta property="og:url" content="${esc(shareUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="zh_TW">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImageUrl)}">

<!-- 故意不用 <meta http-equiv="refresh">：FB / LinkedIn / Slack 的
     crawler 會跟著 meta-refresh 跳到 SPA 根頁，抓不到本頁的 OG tag。
     人類瀏覽器會走下面的 <script> 被導到互動地圖，crawler 無 JS 會
     停在這頁讀 OG，兩邊各得其所。-->
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif;
    background: #f3f1ea; color: #2a2a2a; padding: 24px; }
  .card { max-width: 520px; padding: 32px; background: #fff;
    border-radius: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
  .tag { font-size: 13px; color: #888; letter-spacing: 1px; }
  h1 { margin: 6px 0 14px; font-size: 32px; }
  .row { margin: 6px 0; font-size: 15px; }
  .flip { font-size: 19px; font-weight: 700; color: ${esc(partyHex(loser.partyCode))}; margin-top: 14px; }
  .hint { margin-top: 20px; font-size: 13px; color: #888; }
  a { color: #2a7a9a; }
</style>
</head>
<body>
<div class="card">
  <div class="tag">新北市 · ${esc(district)}</div>
  <h1>${esc(village)}</h1>
  <div class="row"><b>${esc(winner.name)}</b>（${esc(winner.partyName)}）${fmt(winner.votes)} 票 · ${winner.rate.toFixed(1)}%</div>
  <div class="row"><b>${esc(loser.name)}</b>（${esc(loser.partyName)}）${fmt(loser.votes)} 票 · ${loser.rate.toFixed(1)}%</div>
  <div class="flip">${esc(loser.partyName)} 翻盤需 ${fmt(flip.swing)} 票改投</div>
  <div class="hint">正在開啟互動地圖… 若未跳轉請 <a href="${esc(spaUrl)}">點這裡</a>。</div>
</div>
<script>
// Preserve ?ref=share (Share Tower view tally) when redirecting into the SPA.
// Any other query params on this OG card URL also flow through.
(function () {
  var spa = ${JSON.stringify(spaUrl)};
  var incoming = location.search;
  if (incoming && incoming.length > 1) {
    spa += spa.indexOf('?') >= 0 ? '&' + incoming.slice(1) : incoming;
  }
  location.replace(spa);
})();
</script>
</body>
</html>
`;
}

// ───────── main ─────────
async function buildCity(city, fontBuffer, limitPerCity) {
  const dataPath = `data/processed/${city.key}-${YEAR}-villages.json`;
  if (!existsSync(dataPath)) {
    console.log(`  [${city.key}] skip — no ${YEAR} village data`);
    return { ok: 0, skip: 0 };
  }
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const history = loadVillageHistory(city);
  console.log(`  [${city.key}] history: ${history.size} villages across ${city.historyYears.length} years`);

  let ok = 0, skip = 0;
  const t0 = Date.now();

  for (const v of data.villages) {
    if (ok >= limitPerCity) break;
    const flip = flipMath(v.results);
    if (!flip) { skip++; continue; }

    const dStem = stem(v.townName);
    const vStem = stem(v.villageName);
    const vHistory = history.get(dStem + '/' + vStem);
    const meta = identityMeta(vHistory, city.historyYears);
    const ctx = {
      city,
      district: v.townName, village: v.villageName,
      dStem, vStem,
      winner: flip.winner, loser: flip.loser,
      margin: v.margin, flip,
      history: vHistory, meta,
      historyYears: city.historyYears,
    };

    const html = shareHtml(ctx);
    writeFileRec(join(DIST, 'share', city.key, dStem, vStem, 'index.html'), html);

    const png = await renderPng(fontBuffer, ctx);
    writeFileRec(join(DIST, 'og', city.key, dStem, `${vStem}.png`), png);

    // Backward-compat: ntpc 2022 also writes to legacy paths so previously
    // shared FB / LINE / Threads URLs (cached for 30 days) still resolve.
    if (city.key === 'ntpc') {
      writeFileRec(join(DIST, 'share', String(YEAR), dStem, vStem, 'index.html'), html);
      writeFileRec(join(DIST, 'og', String(YEAR), dStem, `${vStem}.png`), png);
    }

    ok++;
    if (ok % 100 === 0) {
      console.log(`  [${city.key}] ${ok}/${data.villages.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  }
  console.log(`  [${city.key}] ✓ ${ok} cards · ${skip} skip · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { ok, skip };
}

async function main() {
  const fontBuffer = await ensureFont();
  const tStart = Date.now();
  const onlyCity = process.env.CITY;
  const cities = onlyCity ? CITIES.filter(c => c.key === onlyCity) : CITIES;
  if (onlyCity && cities.length === 0) {
    console.error(`Unknown CITY: ${onlyCity}. Valid: ${CITIES.map(c => c.key).join(', ')}`);
    process.exit(1);
  }
  const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

  let totalOk = 0, totalSkip = 0;
  for (const city of cities) {
    const { ok, skip } = await buildCity(city, fontBuffer, LIMIT);
    totalOk += ok;
    totalSkip += skip;
  }

  console.log(`\n✓ ${totalOk} share pages + PNGs across ${cities.length} cities`);
  if (totalSkip) console.log(`  (${totalSkip} villages skipped — no winner/runner-up)`);
  console.log(`  total ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
