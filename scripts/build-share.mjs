// Pre-generate share pages + OG PNGs for every 2022 village in ntpc.
//
// Outputs to dist/ (alongside Vite's build output):
//   dist/share/2022/{districtStem}/{villageStem}/index.html
//       — tiny HTML with OG meta + JS redirect to SPA
//   dist/og/2022/{districtStem}/{villageStem}.png
//       — 1200×630 PNG (social card)
//
// Usage:  npm run build     (vite build → then this)
//         npm run build:share

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PARTY_COLORS } from '../src/palette.js';

// ───────── config ─────────
const SITE_BASE = process.env.SITE_BASE || 'https://ileivoivm.github.io/change';
const DIST = 'dist';
const YEAR = 2022;
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
  const { district, village, winner, loser, margin, flip } = ctx;
  const winColor = partyHex(winner.partyCode);
  const loseColor = partyHex(loser.partyCode);
  const winPct = winner.rate;
  const losePct = loser.rate;

  // Helper: candidate row (satori needs explicit display: flex everywhere).
  const row = (c, color, pct) => h('div', {
    style: { display: 'flex', alignItems: 'center', marginBottom: 8 },
  },
    h('div', { style: { display: 'flex', width: 22, height: 22, borderRadius: 4, background: color, marginRight: 14 } }),
    h('div', { style: { display: 'flex', fontWeight: 700, marginRight: 14 } }, c.name),
    h('div', { style: { display: 'flex', color: '#888', fontSize: 24, marginRight: 'auto' } }, c.partyName),
    h('div', { style: { display: 'flex', fontWeight: 700, marginRight: 16 } }, `${fmt(c.votes)} 票`),
    h('div', { style: { display: 'flex', fontWeight: 700, color: color, minWidth: 110, justifyContent: 'flex-end' } }, `${pct.toFixed(1)}%`),
  );

  return h('div', {
    style: {
      width: '1200px', height: '630px',
      background: '#f3f1ea',
      display: 'flex', flexDirection: 'column',
      padding: '50px 60px',
      fontFamily: 'Noto Sans TC',
      color: '#2a2a2a',
    },
  },
    // tag
    h('div', {
      style: { display: 'flex', fontSize: 26, color: '#888', letterSpacing: 2, fontWeight: 500 },
    }, `新北市 · ${district}`),

    // big title
    h('div', {
      style: {
        display: 'flex', marginTop: 10,
        fontSize: 140, fontWeight: 900, lineHeight: 1.0,
        color: '#1a1a1a', letterSpacing: 2,
      },
    }, village),

    // bar
    h('div', {
      style: {
        display: 'flex', width: '100%', height: 28,
        borderRadius: 14, overflow: 'hidden', marginTop: 36,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    },
      h('div', { style: { display: 'flex', width: `${winPct}%`, height: '100%', background: winColor } }),
      h('div', { style: { display: 'flex', width: `${losePct}%`, height: '100%', background: loseColor } }),
    ),

    // candidate rows
    h('div', {
      style: { display: 'flex', flexDirection: 'column', marginTop: 20, fontSize: 32 },
    },
      row(winner, winColor, winPct),
      row(loser, loseColor, losePct),
    ),

    // flip call — strongest visual element
    h('div', {
      style: {
        display: 'flex', alignItems: 'center',
        marginTop: 30, padding: '22px 30px',
        background: loseColor, color: '#fff',
        borderRadius: 16, fontSize: 44, fontWeight: 900,
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
        fontSize: 20, color: '#888',
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
  const { district, village, dStem, vStem, winner, loser, margin, flip } = ctx;
  const spaUrl = `${SITE_BASE}/?y=${YEAR}&d=${encodeURIComponent(dStem)}&v=${encodeURIComponent(vStem)}`;
  const shareUrl = `${SITE_BASE}/share/${YEAR}/${encodeURIComponent(dStem)}/${encodeURIComponent(vStem)}/`;
  const ogImageUrl = `${SITE_BASE}/og/${YEAR}/${encodeURIComponent(dStem)}/${encodeURIComponent(vStem)}.png`;

  const title = `${district} ${village} — ${loser.partyName}翻盤需 ${fmt(flip.swing)} 票`;
  const desc = `2022 新北市長：${winner.name} ${fmt(winner.votes)} 票 vs ${loser.name} ${fmt(loser.votes)} 票｜差距 ${margin.toFixed(1)}%`;

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
<script>location.replace(${JSON.stringify(spaUrl)});</script>
</body>
</html>
`;
}

// ───────── main ─────────
async function main() {
  const fontBuffer = await ensureFont();
  const data = JSON.parse(readFileSync(`data/processed/ntpc-${YEAR}-villages.json`, 'utf8'));

  let ok = 0, skip = 0;
  const t0 = Date.now();

  for (const v of data.villages) {
    const flip = flipMath(v.results);
    if (!flip) { skip++; continue; }

    const dStem = stem(v.townName);
    const vStem = stem(v.villageName);
    const ctx = {
      district: v.townName, village: v.villageName,
      dStem, vStem,
      winner: flip.winner, loser: flip.loser,
      margin: v.margin, flip,
    };

    const html = shareHtml(ctx);
    writeFileRec(join(DIST, 'share', String(YEAR), dStem, vStem, 'index.html'), html);

    const png = await renderPng(fontBuffer, ctx);
    writeFileRec(join(DIST, 'og', String(YEAR), dStem, `${vStem}.png`), png);

    ok++;
    if (ok % 100 === 0) {
      console.log(`  ${ok}/${data.villages.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  }

  console.log(`\n✓ ${ok} share pages + PNGs generated`);
  if (skip) console.log(`  (${skip} villages skipped — no winner/runner-up)`);
  console.log(`  total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
