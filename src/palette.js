// Party-colored palette with saturation gradient for close races.
//
// Design:
//   A square's color is ALWAYS the winning party's hue — never the runner-up's.
//   Margin is encoded as saturation via a linear ramp:
//     margin = 0     → pale / desaturated winner color  (still clearly that party)
//     margin = 10%   → roughly midway
//     margin ≥ 20%   → fully saturated party color
//
//   Previous design lerped loser→winner by margin/20, which meant a 1.3%
//   KMT win landed at ~6.5% of the way from DPP green to KMT blue — i.e.
//   nearly pure loser color. That was misleading and is the bug this fixes.

const MARGIN_THRESHOLD = 20;

// Close-race anchor: mixed with 75% off-white. Fixed value chosen so the
// pale tint is still recognizably party-colored against the scene beige.
const CLOSE_WHITE_MIX = 0.75;

// Party codes as defined by CEC / kiang/db.cec.gov.tw
// 1 = 中國國民黨 (KMT, blue)
// 16 = 民主進步黨 (DPP, green)
// 350 = 台灣民眾黨 (TPP, aquamarine / 白色 but we use cyan)
// 999 = 無黨籍 (Independent, warm gray)
export const PARTY_COLORS = {
  '1':   { name: '國民黨', hex: 0x2060b0 },
  '16':  { name: '民進黨', hex: 0x2aa046 },
  '74':  { name: '新黨',   hex: 0xd9a74c }, // pan-blue yellow/gold
  '90':  { name: '親民黨', hex: 0xed7d31 }, // pan-blue orange
  '95':  { name: '台聯',   hex: 0xc8b42e }, // pan-green olive
  '106': { name: '無盟',   hex: 0x9a9486 }, // 無黨團結聯盟
  '267': { name: '時代力量', hex: 0xe6a61f },
  '350': { name: '民眾黨', hex: 0x3bb5c4 },
  '355': { name: '台澎黨', hex: 0x9459c2 },
  '356': { name: '台灣維新', hex: 0x6a7fc0 },
  '203': { name: '共和黨',   hex: 0xb85555 },
  '306': { name: '動保黨',   hex: 0x7aac6c },
  '320': { name: '龍黨',     hex: 0x8e6e45 },
  '343': { name: '天一黨',   hex: 0xa9a9a9 },
  '999': { name: '無黨籍',   hex: 0xaa9478 },
  DEFAULT: { name: '其他',  hex: 0xcccccc },
};

function hexToRgb(hex) {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}
function rgbToHex({ r, g, b }) {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
function lerpColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

export function partyColor(code) {
  return (PARTY_COLORS[code] || PARTY_COLORS.DEFAULT).hex;
}
export function partyName(code) {
  return (PARTY_COLORS[code] || PARTY_COLORS.DEFAULT).name;
}

// Pale (low-saturation) version of a party color — keeps the hue readable
// but drops intensity so close races sit near a shared "almost neutral" zone.
function paleVersion(hex) {
  const { r, g, b } = hexToRgb(hex);
  const w = 220; // off-white anchor
  return rgbToHex({
    r: r * (1 - CLOSE_WHITE_MIX) + w * CLOSE_WHITE_MIX,
    g: g * (1 - CLOSE_WHITE_MIX) + w * CLOSE_WHITE_MIX,
    b: b * (1 - CLOSE_WHITE_MIX) + w * CLOSE_WHITE_MIX,
  });
}

// Given a district's sorted results (descending by votes), return a color.
// Color is always keyed to the winner's party; margin drives saturation.
export function colorForDistrict(results) {
  if (!results || results.length === 0) return 0xb8b2a6;
  const winner = results[0];
  const runnerUp = results[1];
  const winnerHex = partyColor(winner.partyCode);
  if (!runnerUp) return winnerHex;
  const margin = winner.rate - runnerUp.rate; // always >= 0
  const t = Math.min(margin / MARGIN_THRESHOLD, 1);
  return lerpColor(paleVersion(winnerHex), winnerHex, t);
}

// Fallback neutral (unknown district) palette for graceful degradation.
export const NEUTRAL = 0xc4beae;
