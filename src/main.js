import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { computeBounds, makeProjector, projectFeature, voxelize } from './geo.js';
import { colorForDistrict, candidateColor, partyColor, NEUTRAL, PARTY_COLORS } from './palette.js';
import ntpcGeo from '../data/processed/ntpc-districts.geo.json';
import tpeGeo  from '../data/processed/tpe-districts.geo.json';
import tycGeo  from '../data/processed/tyc-districts.geo.json';
import txgGeo  from '../data/processed/txg-districts.geo.json';
import tnnGeo  from '../data/processed/tnn-districts.geo.json';
import khhGeo  from '../data/processed/khh-districts.geo.json';
import restGeo from '../data/processed/tw-rest-districts.geo.json';
import ntpcVillageGeo from '../data/processed/ntpc-villages.geo.json';
import tpeVillageGeo  from '../data/processed/tpe-villages.geo.json';
import tycVillageGeo  from '../data/processed/tyc-villages.geo.json';
import txgVillageGeo  from '../data/processed/txg-villages.geo.json';
import tnnVillageGeo  from '../data/processed/tnn-villages.geo.json';
import khhVillageGeo  from '../data/processed/khh-villages.geo.json';
import v1997 from '../data/processed/ntpc-1997-villages.json';
import v2001 from '../data/processed/ntpc-2001-villages.json';
import v2005 from '../data/processed/ntpc-2005-villages.json';
import v2010 from '../data/processed/ntpc-2010-villages.json';
import v2014 from '../data/processed/ntpc-2014-villages.json';
import v2018 from '../data/processed/ntpc-2018-villages.json';
import v2022 from '../data/processed/ntpc-2022-villages.json';
import tv1994 from '../data/processed/tpe-1994-villages.json';
import tv1998 from '../data/processed/tpe-1998-villages.json';
import tv2002 from '../data/processed/tpe-2002-villages.json';
import tv2006 from '../data/processed/tpe-2006-villages.json';
import tv2010 from '../data/processed/tpe-2010-villages.json';
import tv2014 from '../data/processed/tpe-2014-villages.json';
import tv2018 from '../data/processed/tpe-2018-villages.json';
import tv2022 from '../data/processed/tpe-2022-villages.json';
import yv1997 from '../data/processed/tyc-1997-villages.json';
import yv2001 from '../data/processed/tyc-2001-villages.json';
import yv2005 from '../data/processed/tyc-2005-villages.json';
import yv2009 from '../data/processed/tyc-2009-villages.json';
import yv2014 from '../data/processed/tyc-2014-villages.json';
import yv2018 from '../data/processed/tyc-2018-villages.json';
import yv2022 from '../data/processed/tyc-2022-villages.json';
import xv2010 from '../data/processed/txg-2010-villages.json';
import xv2014 from '../data/processed/txg-2014-villages.json';
import xv2018 from '../data/processed/txg-2018-villages.json';
import xv2022 from '../data/processed/txg-2022-villages.json';
import nv2010 from '../data/processed/tnn-2010-villages.json';
import nv2014 from '../data/processed/tnn-2014-villages.json';
import nv2018 from '../data/processed/tnn-2018-villages.json';
import nv2022 from '../data/processed/tnn-2022-villages.json';
import kv2010 from '../data/processed/khh-2010-villages.json';
import kv2014 from '../data/processed/khh-2014-villages.json';
import kv2018 from '../data/processed/khh-2018-villages.json';
import kv2022 from '../data/processed/khh-2022-villages.json';

// ─────────── city routing (determined early so all constants can use it) ───────────
// ?city=ntpc / ?city=tpe / etc.  → which city's data to show
// Legacy share links (no city=)  → treat as ntpc (the only city pre-M9)
const _sp = new URLSearchParams(location.search);
const _cityParam = _sp.get('city')
  || (_sp.has('y') || _sp.has('d') || _sp.has('v') ? 'ntpc' : null);
const CITY_CONFIG = CITY_CONFIGS[_cityParam] || CITY_CONFIGS.ntpc;


const ALL_VILLAGE_ELECTIONS = {
  ntpc: { 1997: v1997, 2001: v2001, 2005: v2005, 2010: v2010, 2014: v2014, 2018: v2018, 2022: v2022 },
  tpe:  { 1994: tv1994, 1998: tv1998, 2002: tv2002, 2006: tv2006, 2010: tv2010, 2014: tv2014, 2018: tv2018, 2022: tv2022 },
  tyc:  { 1997: yv1997, 2001: yv2001, 2005: yv2005, 2009: yv2009, 2014: yv2014, 2018: yv2018, 2022: yv2022 },
  txg:  { 2010: xv2010, 2014: xv2014, 2018: xv2018, 2022: xv2022 },
  tnn:  { 2010: nv2010, 2014: nv2014, 2018: nv2018, 2022: nv2022 },
  khh:  { 2010: kv2010, 2014: kv2014, 2018: kv2018, 2022: kv2022 },
};
const VILLAGE_ELECTIONS = ALL_VILLAGE_ELECTIONS[CITY_CONFIG.key] || ALL_VILLAGE_ELECTIONS.ntpc;
// Which years actually have village-level data (non-empty)
const VILLAGE_YEARS = Object.entries(VILLAGE_ELECTIONS)
  .filter(([, d]) => (d.villages || []).length > 0)
  .map(([y]) => Number(y));
let villageVotes = VILLAGE_ELECTIONS[CITY_CONFIG.defaultYear];
import e1997 from '../data/processed/ntpc-1997-mayor.json';
import e2001 from '../data/processed/ntpc-2001-mayor.json';
import e2005 from '../data/processed/ntpc-2005-mayor.json';
import e2010 from '../data/processed/ntpc-2010-mayor.json';
import e2014 from '../data/processed/ntpc-2014-mayor.json';
import e2018 from '../data/processed/ntpc-2018-mayor.json';
import e2022 from '../data/processed/ntpc-2022-mayor.json';
import te1994 from '../data/processed/tpe-1994-mayor.json';
import te1998 from '../data/processed/tpe-1998-mayor.json';
import te2002 from '../data/processed/tpe-2002-mayor.json';
import te2006 from '../data/processed/tpe-2006-mayor.json';
import te2010 from '../data/processed/tpe-2010-mayor.json';
import te2014 from '../data/processed/tpe-2014-mayor.json';
import te2018 from '../data/processed/tpe-2018-mayor.json';
import te2022 from '../data/processed/tpe-2022-mayor.json';
import ye1997 from '../data/processed/tyc-1997-mayor.json';
import ye2001 from '../data/processed/tyc-2001-mayor.json';
import ye2005 from '../data/processed/tyc-2005-mayor.json';
import ye2009 from '../data/processed/tyc-2009-mayor.json';
import ye2014 from '../data/processed/tyc-2014-mayor.json';
import ye2018 from '../data/processed/tyc-2018-mayor.json';
import ye2022 from '../data/processed/tyc-2022-mayor.json';
import xe2010 from '../data/processed/txg-2010-mayor.json';
import xe2014 from '../data/processed/txg-2014-mayor.json';
import xe2018 from '../data/processed/txg-2018-mayor.json';
import xe2022 from '../data/processed/txg-2022-mayor.json';
import ne2010 from '../data/processed/tnn-2010-mayor.json';
import ne2014 from '../data/processed/tnn-2014-mayor.json';
import ne2018 from '../data/processed/tnn-2018-mayor.json';
import ne2022 from '../data/processed/tnn-2022-mayor.json';
import ke2010 from '../data/processed/khh-2010-mayor.json';
import ke2014 from '../data/processed/khh-2014-mayor.json';
import ke2018 from '../data/processed/khh-2018-mayor.json';
import ke2022 from '../data/processed/khh-2022-mayor.json';
import { CITY_CONFIGS } from './city-configs.js';

const ALL_ELECTIONS = {
  ntpc: { 1997: e1997, 2001: e2001, 2005: e2005, 2010: e2010, 2014: e2014, 2018: e2018, 2022: e2022 },
  tpe:  { 1994: te1994, 1998: te1998, 2002: te2002, 2006: te2006, 2010: te2010, 2014: te2014, 2018: te2018, 2022: te2022 },
  tyc:  { 1997: ye1997, 2001: ye2001, 2005: ye2005, 2009: ye2009, 2014: ye2014, 2018: ye2018, 2022: ye2022 },
  txg:  { 2010: xe2010, 2014: xe2014, 2018: xe2018, 2022: xe2022 },
  tnn:  { 2010: ne2010, 2014: ne2014, 2018: ne2018, 2022: ne2022 },
  khh:  { 2010: ke2010, 2014: ke2014, 2018: ke2018, 2022: ke2022 },
};
const ELECTIONS = ALL_ELECTIONS[CITY_CONFIG.key] || ALL_ELECTIONS.ntpc;
const ALL_VILLAGE_GEO = { ntpc: ntpcVillageGeo, tpe: tpeVillageGeo, tyc: tycVillageGeo, txg: txgVillageGeo, tnn: tnnVillageGeo, khh: khhVillageGeo };
const villageGeo = ALL_VILLAGE_GEO[CITY_CONFIG.key] || ntpcVillageGeo;
const ALL_DISTRICT_GEO = { ntpc: ntpcGeo, tpe: tpeGeo, tyc: tycGeo, txg: txgGeo, tnn: tnnGeo, khh: khhGeo };
// Fallback village list (for district card counts when current year has no village data)
const ALL_FALLBACK_VILLAGES = { ntpc: v2022.villages, tpe: tv2022.villages, tyc: yv2022.villages, txg: xv2022.villages, tnn: nv2022.villages, khh: kv2022.villages };
const fallbackVillages = ALL_FALLBACK_VILLAGES[CITY_CONFIG.key] || v2022.villages;
const YEARS = CITY_CONFIG.years;
let currentYear = CITY_CONFIG.defaultYear;

const VOXEL_CELL = 0.45;
const VILLAGE_CELL = 0.20;
const VOXEL_HEIGHT = 0.9;
const CONTEXT_HEIGHT = 0.25;
const WORLD_SIZE = CITY_CONFIG.worldSize;

// ─────────── share tower config ───────────
// Cloudflare Worker endpoint (Stage T0 deployed by 小C 2026-04-26).
// Source: worker/src/index.js, deployed via `npx wrangler deploy`.
// CORS allowed origins: github pages production + localhost:5173/5200 dev.
const TALLY_WORKER_URL = 'https://change-tw.ileivoivm.workers.dev';
const TOWER_VILLAGE_THRESHOLD = 10;
const TOWER_DISTRICT_THRESHOLD = 50;
const TOWER_SCALE = 0.8; // h = log(count - threshold + 1) * TOWER_SCALE
const TOWER_NEAR = 40;   // camera dist below → show village towers
const TOWER_FAR  = 60;   // camera dist above → show district towers
let viewMode = 'district'; // 'district' | 'village'

// ─────────── scene ───────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcd9e9);
scene.fog = new THREE.Fog(0xdcd9e9, 120, 720); // halved — visible at long range

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  1600
);
camera.position.set(...CITY_CONFIG.camera.position);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 10;
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(...CITY_CONFIG.camera.target);

// ─────────── lights ───────────
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b3a0, 0.45));

const sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
sun.position.set(18, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const s = 30;
sun.shadow.camera.left = -s;
sun.shadow.camera.right = s;
sun.shadow.camera.top = s;
sun.shadow.camera.bottom = -s;
sun.shadow.bias = -0.0005;
scene.add(sun);

// ─────────── ground ───────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshBasicMaterial({ color: 0xdcd9e9 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
scene.add(ground);

// ─────────── election lookup ───────────
let electionByStem = {};
function rebuildElectionByStem(year) {
  const data = ELECTIONS[year];
  const m = {};
  for (const d of data.districts) m[d.stem] = d;
  return m;
}
electionByStem = rebuildElectionByStem(currentYear);

// ─────────── build districts ───────────
const hud = document.getElementById('hud-stats');
const districtMeshes = []; // for raycasting (primary + tpe context, skip rest)

// Global voxel ownership (used for border extraction after all layers are built)
const voxelOwner = new Map(); // "ix,iz" → { townKey, layer, height }
const layerData = []; // per-layer data preserved for border pass

// Village layer (里級) — lives in its own THREE.Group, toggled by viewMode.
const villageMeshes = [];
let villageGroup = null;
const villageBorderMap = new Map(); // townStem → LineSegments2 (one per district)
const villageLineMats = [];          // all LineMaterials — need resolution update on resize
let districtLineMat = null;          // LineMaterial for district borders — needs resolution update
let districtBorderLine = null; // LineSegments2 — hidden while drilled into a district
let drilledDistrict = null; // townName of currently drilled district (e.g. "永和市") or null
let selectedVillageKey = null; // "townStem/villageStem" of the village shown as 3rd breadcrumb chip, or null
let sticky = false; // when true, hover raycast won't override bubble (used for village selections from list)
let hovered = null; // currently hovered mesh (district or village) — declared here to avoid TDZ for URL writes
let pulseMesh = null; // mesh currently glowing (selected village or drilled-district announce)
let drillFlashUntil = 0; // perf-time until which the just-drilled district shimmers
// When true (toggled by Space / empty-canvas click / 新北市 tap at top level,
// or drilled district chip tap), the active grid fades out and only the
// breadcrumb chips remain — frees the viewport for 3D exploration.
//
// Mobile starts collapsed: on narrow screens the 3-col × 10-row district
// grid fills the whole viewport, leaving no canvas pixels to grab for
// OrbitControls rotation. Showing the map first (with 新北市 chip as
// a one-tap expand) matches the user's initial-version experience.
const isMobile = () => window.innerWidth < 640;
let cardsCollapsed = isMobile();
function updateMapScrim() {
  // The scrim is only for expanded choice grids:
  // - top level district cards
  // - drilled village cards
  // Breadcrumb-only states and floating bubbles leave the map clear.
  const districtCardsOpen = !!_cityParam && !drilledDistrict && !cardsCollapsed;
  const villageCardsOpen = !!_cityParam && !!drilledDistrict && !cardsCollapsed && !selectedVillageKey;
  const chooserCardsVisible = districtCardsOpen || villageCardsOpen;
  document.body.classList.toggle('map-scrim-visible', chooserCardsVisible);
}
function toggleCardsCollapsed() {
  cardsCollapsed = !cardsCollapsed;
  layoutCards();
}
// Match geo features to vote data via stem + stem keys
let villageVoteMap = new Map();
function rebuildVillageVoteMap(year) {
  const m = new Map();
  const data = VILLAGE_ELECTIONS[year] || { villages: [] };
  for (const v of data.villages) {
    const key = v.townName.slice(0, -1) + '/' + v.villageName.slice(0, -1);
    m.set(key, v);
  }
  villageVotes = data;
  return m;
}
villageVoteMap = rebuildVillageVoteMap(currentYear);

// ─────────── village 25-year history ───────────
// Key: "townStem/villageStem" → { years: {YYYY: {partyCode, margin}}, flips, dataYears, dominantPartyCode }
// Built once at startup; currentYear highlighting is applied at render time.
const villageHistoryMap = (() => {
  const m = new Map();
  for (const year of YEARS) {
    const data = VILLAGE_ELECTIONS[year];
    for (const v of (data?.villages || [])) {
      const k = v.townName.slice(0, -1) + '/' + v.villageName.slice(0, -1);
      let entry = m.get(k);
      if (!entry) {
        entry = { years: {}, townName: v.townName, villageName: v.villageName };
        m.set(k, entry);
      }
      entry.years[year] = { partyCode: v.winnerPartyCode, winner: v.winner, margin: v.margin };
    }
  }
  // Aggregate per-village stats
  for (const entry of m.values()) {
    const seq = YEARS.map(y => entry.years[y]?.partyCode).filter(Boolean);
    let flips = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) flips++;
    entry.flips = flips;
    entry.dataYears = seq.length;
    // Dominant party = mode (useful for 「永 X 鐵板」 label)
    const tally = {};
    for (const c of seq) tally[c] = (tally[c] || 0) + 1;
    entry.dominantPartyCode = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  return m;
})();

function renderVillageHistoryStrip(townName, villageName) {
  const k = townName.slice(0, -1) + '/' + villageName.slice(0, -1);
  const entry = villageHistoryMap.get(k);
  // Only years with published village-level data (2005–2022). CEC 1997/2001 未公開里級，
  // 若硬塞灰格會讓視覺 71% 失效資料，反而誤導——我們老實只畫有資料的 5 場。
  const years = VILLAGE_YEARS; // [2005, 2010, 2014, 2018, 2022]
  const spanLabel = `${years[0]} → ${years[years.length - 1]}`;

  const squares = years.map(y => {
    const data = entry?.years[y];
    if (!data) {
      return `<span class="hsq no-data" title="${y} · 本里無對應資料"></span>`;
    }
    const hex = '#' + candidateColor({ name: data.winner, partyCode: data.partyCode }).toString(16).padStart(6, '0');
    const cls = y === currentYear ? 'hsq current' : 'hsq';
    const title = y === currentYear ? `${y}（目前）` : `切至 ${y}`;
    return `<span class="${cls}" style="background:${hex}" data-year="${y}" title="${title}"></span>`;
  }).join('');

  // Meta line — identity label. Identity 字在前（粗體），factual 描述在後，三型平行。
  // 永藍/永綠/永白 用台灣慣用語；其他政黨 fallback 到黨名。
  const permanentLabel = (code) => {
    if (code === '1') return '永藍里';
    if (code === '16') return '永綠里';
    if (code === '350') return '永白里';
    const n = PARTY_COLORS[code]?.name || '單黨';
    return `永 ${n} 里`;
  };

  let meta = `近 ${years.length} 場里長選舉`;
  if (entry && entry.dataYears >= 2) {
    if (entry.flips === 0) {
      meta = `<b>${permanentLabel(entry.dominantPartyCode)}</b> · ${entry.dataYears} 場未翻轉`;
    } else if (entry.flips === 1) {
      meta = `<b>翻轉里</b> · 翻過 1 次`;
    } else {
      meta = `<b>搖擺里</b> · 翻過 ${entry.flips} 次`;
    }
  } else if (entry && entry.dataYears === 1) {
    meta = `僅 ${Object.keys(entry.years)[0]} 一場里級資料`;
  }

  return `<div class="history">
    <div class="hs-label"><span>${years[0]}</span><span>${years[years.length - 1]}</span></div>
    <div class="hs-row">${squares}</div>
    <div class="hs-meta">${meta}</div>
  </div>`;
}

// ─────────── share counts + tower state ───────────
let shareCounts = {};            // key "{city}-{townName}-{villageName}" → {shares,views}
let shareCountsByStem = {};      // key "{tStem}/{vStem}" → {shares,views}（命名 fallback）
let districtShareCounts = new Map(); // distStem → aggregate total
// Filled by rebuildTowers() to enable raycasting → data lookups
const villageOrder   = []; // [{ townName, villageName, centroid, count }]
const districtOrder  = []; // [{ stem, centroid, count }]
let villageTowerShaft  = null;
let villageTowerTop    = null;
let districtTowerShaft = null;
let districtTowerTop   = null;

function makeMaterial({ color, isContext }) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: isContext ? 0.95 : 0.82,
    metalness: 0,
    transparent: isContext,
    opacity: isContext ? 0.55 : 1.0,
  });
}

function buildLayer(features, projector, opts) {
  const { height, layer, interactive } = opts;
  const cubeGeo = new THREE.BoxGeometry(VOXEL_CELL * 0.96, height, VOXEL_CELL * 0.96);
  const isContext = layer !== CITY_CONFIG.key;
  let totalVoxels = 0;

  // First pass: voxelize + populate voxelOwner globally
  const perFeature = [];
  features.forEach((f) => {
    const polys = projectFeature(f, projector);
    let raw = voxelize(polys, VOXEL_CELL);
    if (raw.length === 0) {
      // Fallback for tiny districts (e.g. 中區/東區/南區 in txg) whose polygon
      // is smaller than one VOXEL_CELL.  Place a single centroid cell so the
      // mesh exists and drillByStem / card-clicks work correctly.
      let sx = 0, sz = 0, count = 0;
      for (const poly of polys) for (const [px, pz] of poly.outer) { sx += px; sz += pz; count++; }
      if (count === 0) return; // truly empty geometry — skip
      raw = [[sx / count, sz / count]];
    }
    const cells = raw.map(([x, z]) => ({
      x, z,
      ix: Math.round(x / VOXEL_CELL - 0.5),
      iz: Math.round(z / VOXEL_CELL - 0.5),
    }));
    const townKey =
      f.properties.KEY
        || `${layer}/${f.properties.COUNTYNAME}/${f.properties.TOWNNAME}`;
    for (const c of cells) voxelOwner.set(`${c.ix},${c.iz}`, { townKey, layer, height });
    perFeature.push({ feature: f, cells, townKey });
  });

  // Second pass: build meshes
  perFeature.forEach(({ feature: f, cells, townKey }) => {
    const townName = f.properties.TOWNNAME;
    // slice(0,2) matches extract-elections.mjs stem logic and handles 2-char
    // names like 中區/東區/南區/西區/北區 (台中市舊轄區) correctly.
    const stem = townName.slice(0, 2);
    const election = layer === CITY_CONFIG.key ? electionByStem[stem] : null;

    let baseColor;
    if (layer === CITY_CONFIG.key) {
      baseColor = election ? colorForDistrict(election.results) : NEUTRAL;
    } else {
      // context layers → soft gray
      baseColor = 0xddd6c7;
    }

    const mat = makeMaterial({ color: baseColor, isContext });
    const mesh = new THREE.InstancedMesh(cubeGeo, mat, cells.length);
    mesh.castShadow = !isContext;
    mesh.receiveShadow = true;

    let cx = 0, cz = 0;
    const m = new THREE.Matrix4();
    cells.forEach(({ x, z }, i) => {
      m.makeTranslation(x, height / 2, z);
      mesh.setMatrixAt(i, m);
      cx += x; cz += z;
    });
    mesh.instanceMatrix.needsUpdate = true;
    cx /= cells.length; cz /= cells.length;

    mesh.userData = {
      townName,
      countyName: f.properties.COUNTYNAME,
      townKey,
      layer,
      baseColor,
      isContext,
      baseY: 0,
      centroid: new THREE.Vector3(cx, height, cz),
      election,
    };
    scene.add(mesh);
    if (interactive) districtMeshes.push(mesh);
    totalVoxels += cells.length;
  });

  layerData.push({ layer, height, perFeature });
  return totalVoxels;
}

// ─────────── border extraction ───────────
// white: between different districts (but NOT both inside 'rest' layer)
// black: coastline (empty neighbor = outside land)
function buildBorders() {
  const white = [];
  const black = [];
  const half = VOXEL_CELL / 2;
  const neighbors = [
    { dx: 0, dz: -1, a: [-half, -half], b: [ half, -half] }, // north
    { dx: 0, dz:  1, a: [-half,  half], b: [ half,  half] }, // south
    { dx: -1, dz: 0, a: [-half, -half], b: [-half,  half] }, // west
    { dx:  1, dz: 0, a: [ half, -half], b: [ half,  half] }, // east
  ];

  for (const { height, perFeature } of layerData) {
    const topY = height + 0.01;
    for (const { cells, townKey } of perFeature) {
      for (const { ix, iz, x, z } of cells) {
        for (const n of neighbors) {
          const key = `${ix + n.dx},${iz + n.dz}`;
          const nb = voxelOwner.get(key);
          if (nb && nb.townKey === townKey) continue; // same district → skip
          if (!nb) {
            // coastline edge — drop at both heights for visibility; flat on ground is enough
            black.push(x + n.a[0], 0.05, z + n.a[1], x + n.b[0], 0.05, z + n.b[1]);
          } else {
            // district-to-district boundary
            const me = voxelOwner.get(`${ix},${iz}`);
            if (me?.layer === 'rest' && nb.layer === 'rest') continue; // no internal lines within rest layer
            white.push(x + n.a[0], topY, z + n.a[1], x + n.b[0], topY, z + n.b[1]);
          }
        }
      }
    }
  }

  // White district borders: use LineSegments2 for linewidth > 1 support
  if (white.length > 0) {
    const geo = new LineSegmentsGeometry();
    geo.setPositions(white);
    districtLineMat = new LineMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      linewidth: 1.3,  // px — 1.3× vs village gray lines (1px)
      depthWrite: false,
      fog: true,
    });
    districtLineMat.resolution.set(window.innerWidth, window.innerHeight);
    districtBorderLine = new LineSegments2(geo, districtLineMat);
    districtBorderLine.renderOrder = 2;
    scene.add(districtBorderLine);
  }
  // Black coastline removed — no outer border drawn
}

function buildVillageLayer(projector) {
  const group = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(VILLAGE_CELL * 0.96, VOXEL_HEIGHT, VILLAGE_CELL * 0.96);
  const owner = new Map();
  const perVillage = [];

  for (const f of villageGeo.features) {
    const polys = projectFeature(f, projector);
    const raw = voxelize(polys, VILLAGE_CELL);
    if (raw.length === 0) continue;
    const cells = raw.map(([x, z]) => ({
      x, z,
      ix: Math.round(x / VILLAGE_CELL - 0.5),
      iz: Math.round(z / VILLAGE_CELL - 0.5),
    }));
    const key = f.properties.TOWNNAME.slice(0, -1) + '/' + f.properties.VILLAGENAM.slice(0, -1);
    for (const c of cells) owner.set(`${c.ix},${c.iz}`, key);
    perVillage.push({ feature: f, cells, key });
  }

  for (const { feature: f, cells, key } of perVillage) {
    const vote = villageVoteMap.get(key);
    const color = vote ? colorForDistrict(vote.results) : NEUTRAL;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
    const mesh = new THREE.InstancedMesh(cubeGeo, mat, cells.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    let cx = 0, cz = 0;
    cells.forEach(({ x, z }, i) => {
      m.makeTranslation(x, VOXEL_HEIGHT / 2, z);
      mesh.setMatrixAt(i, m);
      cx += x; cz += z;
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Snap centroid to the voxel cell closest to the arithmetic mean. For
    // irregular village shapes (L / U / donut) the raw mean can land in a
    // gap between voxels, leaving the share-tower's shaft visibly floating
    // off-grid. Snapping guarantees the shaft sits on top of an actual voxel.
    const meanX = cx / cells.length;
    const meanZ = cz / cells.length;
    let bestCell = cells[0];
    let bestDist = Infinity;
    for (const c of cells) {
      const d = (c.x - meanX) ** 2 + (c.z - meanZ) ** 2;
      if (d < bestDist) { bestDist = d; bestCell = c; }
    }
    mesh.userData = {
      layer: 'village',
      townName: f.properties.TOWNNAME,
      villageName: f.properties.VILLAGENAM,
      villageKey: key,
      baseColor: color,
      baseY: 0,
      isContext: false,
      centroid: new THREE.Vector3(bestCell.x, VOXEL_HEIGHT, bestCell.z),
      vote,
    };
    group.add(mesh);
    villageMeshes.push(mesh);
  }

  // Per-district village borders: one LineSegments2 per district.
  // Only the drilled district's lines are shown; others stay hidden.
  const half = VILLAGE_CELL / 2;
  const topY = VOXEL_HEIGHT + 0.01;
  const neighbors = [
    { dx: 0, dz: -1, a: [-half, -half], b: [ half, -half] },
    { dx: 0, dz:  1, a: [-half,  half], b: [ half,  half] },
    { dx: -1, dz: 0, a: [-half, -half], b: [-half,  half] },
    { dx:  1, dz: 0, a: [ half, -half], b: [ half,  half] },
  ];

  // Group villages by town stem
  const perVillageByTown = new Map();
  for (const { feature: f, cells, key } of perVillage) {
    const townStem = f.properties.TOWNNAME.slice(0, -1);
    if (!perVillageByTown.has(townStem)) perVillageByTown.set(townStem, []);
    perVillageByTown.get(townStem).push({ cells, key });
  }

  for (const [townStem, villages] of perVillageByTown) {
    const white = [];
    for (const { cells, key } of villages) {
      for (const { ix, iz, x, z } of cells) {
        for (const n of neighbors) {
          const nb = owner.get(`${ix + n.dx},${iz + n.dz}`);
          if (nb === key) continue;               // same village → skip
          if (!nb) continue;                       // void edge → skip (no coast lines)
          if (nb.split('/')[0] !== townStem) continue; // different district → skip
          white.push(x + n.a[0], topY, z + n.a[1], x + n.b[0], topY, z + n.b[1]);
        }
      }
    }
    if (white.length === 0) continue;
    const geo = new LineSegmentsGeometry();
    geo.setPositions(white);
    const mat = new LineMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      linewidth: 1.3,
      depthWrite: false,
      fog: true,
    });
    mat.resolution.set(window.innerWidth, window.innerHeight);
    villageLineMats.push(mat);
    const lines = new LineSegments2(geo, mat);
    lines.renderOrder = 2;
    lines.visible = false; // hidden by default; shown only when this district is drilled
    group.add(lines);
    villageBorderMap.set(townStem, lines);
  }

  group.visible = false;
  scene.add(group);
  return group;
}

function bootstrap() {
  const key = CITY_CONFIG.key;
  const mainGeo = ALL_DISTRICT_GEO[key];

  // ntpc uses combined ntpc+tpe bounds to preserve calibrated camera coordinates.
  // All other cities center on their own features.
  const boundsFeatures = key === 'ntpc'
    ? [...ntpcGeo.features, ...tpeGeo.features]
    : mainGeo.features;
  const bounds = computeBounds(boundsFeatures);
  const projector = makeProjector(bounds, WORLD_SIZE);

  // restGeo covers all Taiwan EXCEPT ntpc and tpe. For cities other than ntpc/tpe,
  // filter out the main city's county so it doesn't double-render under the main layer.
  const mainCountyNames = CITY_CONFIG.geoCountyNames;
  const restFeatures = (key === 'ntpc' || key === 'tpe')
    ? restGeo.features
    : restGeo.features.filter(f => {
        const cn = f.properties.COUNTYNAME || (f.properties.KEY || '').split('/')[0];
        return !mainCountyNames.includes(cn);
      });

  const restCount = buildLayer(restFeatures, projector, { height: CONTEXT_HEIGHT, layer: 'rest', interactive: false });

  // ntpc↔tpe act as each other's named context sibling; all other cities get ntpc+tpe as generic gray.
  let contextCount = 0;
  if (key === 'ntpc') {
    contextCount = buildLayer(tpeGeo.features, projector, { height: CONTEXT_HEIGHT, layer: 'tpe',  interactive: true });
  } else if (key === 'tpe') {
    contextCount = buildLayer(ntpcGeo.features, projector, { height: CONTEXT_HEIGHT, layer: 'ntpc', interactive: true });
  } else {
    buildLayer(ntpcGeo.features, projector, { height: CONTEXT_HEIGHT, layer: 'ntpc', interactive: true });
    buildLayer(tpeGeo.features,  projector, { height: CONTEXT_HEIGHT, layer: 'tpe',  interactive: true });
  }

  const mainCount = buildLayer(mainGeo.features, projector, { height: VOXEL_HEIGHT, layer: key, interactive: true });

  buildBorders();
  villageGroup = buildVillageLayer(projector);
  scene.add(towerGroup);
  refreshHud(mainCount, contextCount, restCount);
}

// Track main city district meshes (not tpe/rest context) for visibility toggling.
function isMainCityMesh(m) {
  return m.userData?.layer === CITY_CONFIG.key;
}

function setViewMode(mode) {
  if (mode === viewMode) return;
  if (drilledDistrict) exitDrill(false); // cancel drill when user manually toggles
  viewMode = mode;
  const ntpcDistrictMeshes = districtMeshes.filter(isMainCityMesh);
  if (mode === 'village') {
    ntpcDistrictMeshes.forEach(m => m.visible = false);
    if (villageGroup) villageGroup.visible = true;
    villageMeshes.forEach(m => m.visible = true);
    villageBorderMap.forEach(lines => { lines.visible = false; }); // hide in full-city village view
    if (districtBorderLine) districtBorderLine.visible = false;
  } else {
    ntpcDistrictMeshes.forEach(m => m.visible = true);
    if (villageGroup) villageGroup.visible = false;
    if (districtBorderLine) districtBorderLine.visible = true;
  }
  document.getElementById('view-toggle')?.classList.toggle('on', mode === 'village');
  const lbl = document.getElementById('view-toggle-label');
  if (lbl) lbl.textContent = mode === 'village' ? '里' : '區';
}

// ─────────── drill into a single district ───────────
function drillInto(mesh) {
  if (!mesh || mesh.userData.layer !== CITY_CONFIG.key) return;
  // Some years (ntpc 1997/2001) have no village-level data — fall back to defaultYear.
  if (!villageVotes.villages.length) setYear(CITY_CONFIG.defaultYear);
  // Preserve current collapse state on drill. If the user already has the
  // cards expanded (tapped 新北市 chip on mobile), drilling a district
  // should show its village grid — not silently re-collapse and hide it.
  // If they're in map-view (cards collapsed), stay that way.
  drilledDistrict = mesh.userData.townName;
  const stem = drilledDistrict.slice(0, -1);

  // hide every NTPC district mesh (including the clicked one)
  districtMeshes.filter(isMainCityMesh).forEach(m => m.visible = false);

  // show only villages inside the drilled district
  if (villageGroup) villageGroup.visible = true;
  let matched = 0;
  for (const v of villageMeshes) {
    const match = v.userData.townName.slice(0, -1) === stem;
    v.visible = match;
    if (match) matched++;
  }
  // Show only this district's village borders
  villageBorderMap.forEach((lines, ts) => { lines.visible = ts === stem; });
  if (districtBorderLine) districtBorderLine.visible = false; // hide district lines while in village view

  // Camera: keep angle, pan + zoom toward district centroid
  panZoomTo(mesh.userData.centroid, 14);
  drillFlashUntil = performance.now() + 1100;
  writeUrl();

  // update UI
  viewMode = 'village';
  document.getElementById('view-toggle')?.classList.add('on');
  const lbl = document.getElementById('view-toggle-label');
  if (lbl) lbl.textContent = '里';

  // expand the drilled district in the left panel, collapse others
  updatePanelDrill(stem);
}

function exitDrill(flyHome = true) {
  sticky = false;
  pulseMesh = null;
  selectedVillageKey = null;
  // Preserve collapse state across drill exit — if user was exploring the
  // district grid before drilling, return to that view; if they were in
  // map-view with breadcrumb only, stay there.
  if (!drilledDistrict) {
    if (flyHome) tweenCamera(INITIAL_CAM_POS.clone(), INITIAL_TARGET.clone());
    setHover(null);
    writeUrl();
    return;
  }
  drilledDistrict = null;
  districtMeshes.filter(isMainCityMesh).forEach(m => m.visible = true);
  if (villageGroup) villageGroup.visible = false;
  villageMeshes.forEach(m => m.visible = true);
  villageBorderMap.forEach(lines => { lines.visible = false; }); // reset all village borders
  if (districtBorderLine) districtBorderLine.visible = true; // restore district lines on exit
  viewMode = 'district';
  document.getElementById('view-toggle')?.classList.remove('on');
  const lbl = document.getElementById('view-toggle-label');
  if (lbl) lbl.textContent = '區';
  updatePanelDrill(null);
  if (flyHome) tweenCamera(INITIAL_CAM_POS.clone(), INITIAL_TARGET.clone());
  writeUrl();
}

// Drill into a district by townName stem (e.g. "永和") — used by panel clicks
function drillByStem(stem) {
  const mesh = districtMeshes.find(
    m => m.userData.layer === CITY_CONFIG.key && m.userData.townName.slice(0, -1) === stem
  );
  if (mesh) drillInto(mesh);
}

// Rebuild the left panel list (idempotent — safe to call after year change)
function rebuildVillagePanel() { renderPanel(); }

// Select a village (from panel): drill into its district, zoom closer, pin bubble.
// ~16 villages (e.g. 蘆洲 福安里, 保佑里) exist in post-1982 vote data but have
// no 1982 geo polygon, so there's no voxel mesh. We still want the panel click
// to feel alive — drill into the district, pin the bubble, select the card.
function selectVillage(v) {
  const key = v.townName.slice(0, -1) + '/' + v.villageName.slice(0, -1);
  const vm = villageMeshes.find(m => m.userData.villageKey === key);
  const townStem = v.townName.slice(0, -1);
  if (!drilledDistrict || drilledDistrict.slice(0, -1) !== townStem) {
    drillByStem(townStem);
  }
  if (vm) {
    panZoomWithPitch(vm.userData.centroid, 15, 42, (Math.random() - 0.5) * 100, autoPanForBubble);
    sticky = false;
    setHover(vm);
    sticky = true;
    pulseMesh = vm;
    labelEl.classList.add('locked');
  } else {
    // Fall back to the district mesh — the user still gets feedback: the
    // camera flies in, the panel card stays selected, and a synthetic bubble
    // is pinned above the district centroid so the viewer sees vote numbers
    // (or a "no data" note) even though there's no voxel to glow.
    const dm = districtMeshes.find(
      m => m.userData.layer === CITY_CONFIG.key && m.userData.townName.slice(0, -1) === townStem
    );
    if (dm) panZoomWithPitch(dm.userData.centroid, 15, 42, (Math.random() - 0.5) * 100, autoPanForBubble);
    // A duck-typed stub that satisfies setHover / renderBubble /
    // updateLabelPosition — no Three.js mesh, just the fields they read.
    const ghostCentroid = dm
      ? dm.userData.centroid.clone()
      : new THREE.Vector3();
    const ghost = {
      userData: {
        layer: 'village',
        townName: v.townName,
        villageName: v.villageName,
        vote: v && v.results ? v : null,
        isContext: false,
        baseY: 0,
        centroid: ghostCentroid,
      },
      position: { y: 0 },
      material: { emissive: { setHex() {} }, emissiveIntensity: 0 },
    };
    sticky = false;
    setHover(ghost);
    sticky = true;
    pulseMesh = null;
    labelEl.classList.add('locked');
  }
  selectedVillageKey = key;
  // On mobile, selecting a village via card pins the bubble and shifts the
  // focus from "browse cards" to "read result + explore map". Collapse the
  // village grid so the canvas is free to rotate/pan — otherwise the grid
  // still covers the middle of the screen and the user can't rotate even
  // though the bubble is showing. Tap the district breadcrumb chip to
  // re-expand the grid. (Matches user report: "透過卡片從區點到里，進到
  // 對話框，鏡頭不能轉".)
  if (isMobile()) cardsCollapsed = true;
  updateCardState();
  layoutCards();
  writeUrl();
  // autoPanForBubble runs as the panZoomWithPitch tween's onComplete callback
  // (see selectVillage above) so the pitch tween finishes first. Older code
  // queued via requestAnimationFrame here and the second tween clobbered the
  // pitch mid-flight.
}

function autoPanForBubble() {
  const dist = camera.position.distanceTo(controls.target);
  const worldH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const worldPerPx = worldH / window.innerHeight;

  const viewDir = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
  const screenUp = new THREE.Vector3()
    .copy(camera.up)
    .addScaledVector(viewDir, -camera.up.dot(viewDir))
    .normalize();

  // Shift selected village to upper 1/4 of viewport so bubble content has
  // room to expand downward. Moving camera in -screenUp direction shifts the
  // scene upward on screen, placing the village above centre.
  const shiftPx = window.innerHeight * 0.125;
  const delta = screenUp.clone().multiplyScalar(shiftPx * worldPerPx);
  tweenCamera(camera.position.clone().add(delta), controls.target.clone().add(delta), 350);
}

function unselectVillage() {
  if (!selectedVillageKey) return;
  selectedVillageKey = null;
  sticky = false;
  pulseMesh = null;
  labelEl.classList.remove('locked');
  if (drilledDistrict) {
    // Zoom back out to district view
    const mesh = districtMeshes.find(m => m.userData.townName === drilledDistrict);
    if (mesh) panZoomWithPitch(mesh.userData.centroid, 14, 42);
  }
  updateCardState();
  layoutCards();
  writeUrl();
}

function panZoomTo(targetVec, distance = 20) {
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  const newPos = new THREE.Vector3().copy(targetVec).addScaledVector(dir, distance);
  tweenCamera(newPos, targetVec.clone(), 800);
}

// Pan / zoom while forcing a specific pitch. Preserves current azimuth
// unless `deltaAzimuthDeg` is passed — e.g. selectVillage passes a random
// value in [-50, +50] for a small rotational transition between villages.
function panZoomWithPitch(targetVec, distance, pitchDeg, deltaAzimuthDeg = 0, onComplete) {
  const dx = camera.position.x - controls.target.x;
  const dz = camera.position.z - controls.target.z;
  const azimuth = Math.atan2(dx, dz) + (deltaAzimuthDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const y = distance * Math.sin(pitch);
  const planar = distance * Math.cos(pitch);
  const newPos = new THREE.Vector3(
    targetVec.x + planar * Math.sin(azimuth),
    targetVec.y + y,
    targetVec.z + planar * Math.cos(azimuth),
  );
  tweenCamera(newPos, targetVec.clone(), 800, onComplete);
}

// ─────────── URL sync (share links) ───────────
// Format: ?city=ntpc&y=YYYY&d=中和&v=安和
// city= is always preserved so back-navigation works correctly.
// Year always written so 2022/2026/... are unambiguous in shared links.
function writeUrl() {
  const params = new URLSearchParams();
  params.set('city', CITY_CONFIG.key);
  params.set('y', String(currentYear));
  if (drilledDistrict) params.set('d', drilledDistrict.slice(0, -1));
  if (sticky && hovered?.userData?.layer === 'village') {
    params.set('v', hovered.userData.villageName.slice(0, -1));
  }
  history.replaceState({}, '', `?${params.toString()}`);
}

function parseAndApplyUrl() {
  const p = new URLSearchParams(location.search);
  // 'city' param is routing-only; already consumed above as CITY_CONFIG
  const yStr = p.get('y');
  const d = p.get('d');
  const v = p.get('v');
  const y = yStr ? parseInt(yStr, 10) : null;
  if (y && ELECTIONS[y] && y !== currentYear) setYear(y);

  if (v) {
    // Find vote record that matches both v and (d if given)
    const match = villageVotes.villages.find(x =>
      x.villageName.slice(0, -1) === v && (!d || x.townName.slice(0, -1) === d)
    );
    if (match) {
      // selectVillage handles drill if needed
      setTimeout(() => selectVillage(match), 50);
      return;
    }
  }
  if (d) setTimeout(() => drillByStem(d), 50);
}

// ─────────── tally + share tracking (T1 / T2) ───────────
const TALLY_DEDUP_MS = 30 * 60 * 1000; // 30 minutes
// In dev (Vite localhost), bypass the sessionStorage dedup so the developer
// can hammer the share button to verify counts go up. Production keeps full
// dedup so a refresh-spamming user can't inflate counts. Worker also bypasses
// its IP lock when Origin is localhost (see worker/src/index.js).
const TALLY_DEV_UNLIMITED = !!import.meta.env.DEV;

function isDedupActive(dedupKey) {
  if (TALLY_DEV_UNLIMITED) return false;
  try {
    const t = sessionStorage.getItem('tally:' + dedupKey);
    return t ? Date.now() - Number(t) < TALLY_DEDUP_MS : false;
  } catch { return false; }
}
function markDedup(dedupKey) {
  if (TALLY_DEV_UNLIMITED) return;
  try { sessionStorage.setItem('tally:' + dedupKey, String(Date.now())); } catch {}
}

// Returns true iff the Worker confirms the event was actually counted (counted:
// true). Client-side dedup hits + Worker-side IP-lock hits both return false so
// callers can skip optimistic UI updates that would lie about the server state.
async function postTally(townName, villageName, event) {
  if (!TALLY_WORKER_URL) return false;
  const key = `${CITY_CONFIG.key}-${townName}-${villageName}`;
  const dedupKey = key + ':' + event;
  if (isDedupActive(dedupKey)) return false;
  markDedup(dedupKey);
  try {
    const r = await fetch(`${TALLY_WORKER_URL}/tally`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: CITY_CONFIG.key, district: townName, village: villageName, event }),
    });
    if (!r.ok) return false;
    const data = await r.json().catch(() => null);
    return data?.counted === true;
  } catch {
    return false;
  }
}

// Optimistic local +1 in place of an extra GET /counts after a successful
// /tally. Mirrors the aggregation fetchShareCounts() does so the bubble line,
// district tally, and tower thresholds all see the new value immediately.
function bumpLocalShareCount(townName, villageName, event) {
  const fullKey = `${CITY_CONFIG.key}-${townName}-${villageName}`;
  const tStem = townName.slice(0, -1);
  const vStem = villageName.slice(0, -1);
  const stemKey = `${tStem}/${vStem}`;
  const field = event === 'share' ? 'shares' : 'views';

  const cur = shareCounts[fullKey] || { city: CITY_CONFIG.key, district: townName, village: villageName, shares: 0, views: 0 };
  shareCounts[fullKey] = { ...cur, [field]: (cur[field] || 0) + 1, lastUpdate: Date.now() };
  window.shareCounts = shareCounts;

  const stemAcc = shareCountsByStem[stemKey] || (shareCountsByStem[stemKey] = { shares: 0, views: 0 });
  stemAcc[field] = (stemAcc[field] || 0) + 1;

  districtShareCounts.set(tStem, (districtShareCounts.get(tStem) || 0) + 1);

  rebuildTowers();
  refreshVillageCardDots();
  refreshTallyLineInBubble();
}

async function fetchShareCounts() {
  if (!TALLY_WORKER_URL) return;
  try {
    const r = await fetch(`${TALLY_WORKER_URL}/counts?city=${CITY_CONFIG.key}`);
    if (!r.ok) return;
    const data = await r.json();
    // Worker returns { city, counts }; pull out .counts.
    const counts = data.counts || {};
    shareCounts = counts;
    window.shareCounts = counts; // debug: console.table(window.shareCounts)
    districtShareCounts = new Map();
    // Stem-based index lets villages from either naming convention (1982
    // GeoJSON「永和市」 vs modern vote data「永和區」) find their counts.
    // Without this, village cards (vote names) never matched KV keys
    // (mesh names) and the 燈塔點亮 dot never appeared.
    shareCountsByStem = {};
    for (const [key, v] of Object.entries(counts)) {
      // key: "{city}-{townName}-{villageName}", e.g. "ntpc-板橋區-留侯里"
      const parts = key.split('-');
      if (parts.length < 3) continue;
      const townName = parts[1];
      const villageName = parts[2];
      const tStem = townName.slice(0, -1);
      const vStem = villageName.slice(0, -1);
      const shares = v.shares || 0;
      const views  = v.views  || 0;
      districtShareCounts.set(tStem, (districtShareCounts.get(tStem) || 0) + shares + views);
      const stemKey = `${tStem}/${vStem}`;
      const acc = shareCountsByStem[stemKey] || (shareCountsByStem[stemKey] = { shares: 0, views: 0 });
      acc.shares += shares;
      acc.views  += views;
    }
    rebuildTowers();
    refreshVillageCardDots();
    refreshTallyLineInBubble();
  } catch {}
}

// Sync the small 「燈塔點亮」 dot on every visible `.card-village`. Called
// after fetchShareCounts so a freshly-incremented village whose count just
// crossed TOWER_VILLAGE_THRESHOLD gets its dot without a full panel rebuild.
function refreshVillageCardDots() {
  const cards = document.querySelectorAll('.card-village');
  if (!cards.length) return;
  for (const card of cards) {
    const key = card.dataset.villageKey;
    if (!key) continue;
    const [tStem, vStem] = key.split('/');
    const v = villageVotes.villages.find(x =>
      x.townName.slice(0, -1) === tStem && x.villageName.slice(0, -1) === vStem
    );
    if (!v) continue;
    const count = getTotalForVillage(v.townName, v.villageName);
    const lit = count >= TOWER_VILLAGE_THRESHOLD;
    const nameEl = card.querySelector('.name');
    if (!nameEl) continue;
    let dot = nameEl.querySelector('.tower-dot');
    if (lit && !dot) {
      dot = document.createElement('span');
      dot.className = 'tower-dot';
      nameEl.appendChild(dot);
    } else if (!lit && dot) {
      dot.remove();
    }
    if (dot) dot.title = `燈塔已點亮 · 累積 ${count} 次`;
  }
}

// Surgically update only the `.tally-count` line in the currently-pinned
// bubble — avoids re-rendering the whole bubble (which would clobber the
// share button's "已複製 ✓" textContent micro-feedback set by the click handler).
function refreshTallyLineInBubble() {
  if (!sticky) return;
  const tallyEl = labelBubble.querySelector('.tally-count');
  if (!tallyEl) return;
  const tName = tallyEl.dataset.town;
  const vName = tallyEl.dataset.village;
  if (!tName || !vName) return;
  const { shares: tShares, views: tViews } = getTallyForVillage(tName, vName);
  const totalCount = tShares + tViews;
  const VILLAGE_TOWER_THRESHOLD = TOWER_VILLAGE_THRESHOLD;
  if (totalCount >= VILLAGE_TOWER_THRESHOLD) {
    const level = towerLevel(totalCount, VILLAGE_TOWER_THRESHOLD);
    tallyEl.classList.add('lit');
    if (level >= TOWER_MAX_LEVEL) {
      tallyEl.innerHTML = `🏯 燈塔 <b>Lv.${TOWER_MAX_LEVEL}（MAX）</b> · 累積 <b>${totalCount}</b> 次 · 已達最高等級`;
    } else {
      const nextRemain = TOWER_STEP_BUCKET - ((totalCount - VILLAGE_TOWER_THRESHOLD) % TOWER_STEP_BUCKET);
      tallyEl.innerHTML = `🏯 燈塔 <b>Lv.${level}</b> · 累積 <b>${totalCount}</b> 次 · 還差 <b>${nextRemain}</b> 次升 Lv.${level + 1}`;
    }
  } else {
    const remain = VILLAGE_TOWER_THRESHOLD - totalCount;
    tallyEl.classList.remove('lit');
    tallyEl.innerHTML = `分享點亮燈塔 · 進度 <b>${totalCount}/${VILLAGE_TOWER_THRESHOLD}</b>（還差 ${remain} 次）`;
  }
}

function getTotalForVillage(townName, villageName) {
  // Direct exact-key lookup first (fastest path).
  const key = `${CITY_CONFIG.key}-${townName}-${villageName}`;
  const v = shareCounts[key];
  if (v) return (v.shares || 0) + (v.views || 0);
  // Stem-based fallback: KV may have been written with a different naming
  // convention (1982「永和市」 vs 現代「永和區」). Match on first-N-chars
  // stem so cards built from vote data still find counts written by the
  // share-btn (which uses GeoJSON 1982 names).
  const stemKey = `${townName.slice(0, -1)}/${villageName.slice(0, -1)}`;
  const s = shareCountsByStem[stemKey];
  return s ? (s.shares || 0) + (s.views || 0) : 0;
}

// Same fallback logic, for callers that need shares/views split (eg. tally bubble).
function getTallyForVillage(townName, villageName) {
  const key = `${CITY_CONFIG.key}-${townName}-${villageName}`;
  const v = shareCounts[key];
  if (v) return { shares: v.shares || 0, views: v.views || 0 };
  const stemKey = `${townName.slice(0, -1)}/${villageName.slice(0, -1)}`;
  const s = shareCountsByStem[stemKey];
  return { shares: s?.shares || 0, views: s?.views || 0 };
}

// ─────────── tower rendering (T3) ───────────
// Shaft: half the original thickness (0.05 → 0.025) so towers feel like
// thin reeds against the chunky voxels. Subtle glow.
const _shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 8);
const _shaftMat = new THREE.MeshStandardMaterial({
  color: 0xfff5d6, emissive: 0xfff5d6, emissiveIntensity: 0.5,
  roughness: 0.4, metalness: 0.1,
});
// Top sphere: MeshBasicMaterial so the per-instance color renders at full
// brightness (no lighting / fog drag-down), reading as a "lit lantern".
// Colour is set per instance via `setColorAt` based on share count:
//   count = 10  → #FCE327 (warm yellow)
//   count = 100 → #FC8654 (warm orange)
//   linear lerp between, clamped above/below.
const _topGeo = new THREE.SphereGeometry(0.15, 12, 12);
const _topMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, // multiplied by per-instance colour; white = identity
  toneMapped: false,
  fog: false,
});
const TOWER_TOP_COLOR_LO = new THREE.Color(0xFCE327); // count = threshold
const TOWER_TOP_COLOR_HI = new THREE.Color(0xFC8654); // count >= 100
function towerTopColor(count, threshold, target = new THREE.Color()) {
  // 0 at threshold, 1 at 100 (interpreted as 100 absolute, not threshold+90).
  // For districts (threshold=50) the gradient still reaches HI at count=100.
  const span = Math.max(1, 100 - threshold);
  const t = Math.max(0, Math.min(1, (count - threshold) / span));
  return target.copy(TOWER_TOP_COLOR_LO).lerp(TOWER_TOP_COLOR_HI, t);
}
const towerGroup = new THREE.Group();

// Discrete step height: every TOWER_STEP_BUCKET (10) shares above the
// threshold climbs one level. Capped at TOWER_MAX_LEVEL (10) so a runaway
// village can't tower over the whole map. User feedback:
// 「燈塔最多 10 級（也就是 100 分享），目前燈塔的高度 *2」.
const TOWER_STEP_BUCKET = 10;
const TOWER_STEP_HEIGHT = 1.0; // doubled from 0.5 for taller silhouettes
const TOWER_MAX_LEVEL   = 10;
function towerLevel(count, threshold) {
  if (count < threshold) return 0;
  return Math.min(
    TOWER_MAX_LEVEL,
    Math.floor((count - threshold) / TOWER_STEP_BUCKET) + 1,
  );
}
function towerH(count, threshold) {
  return towerLevel(count, threshold) * TOWER_STEP_HEIGHT;
}

function buildTowerIM(records, threshold) {
  // records: [{ centroid, count, ... }] — only entries where count >= threshold
  const n = records.length;
  if (n === 0) return { shaft: null, top: null };
  const shaft = new THREE.InstancedMesh(_shaftGeo, _shaftMat, n);
  const top   = new THREE.InstancedMesh(_topGeo,   _topMat,   n);
  shaft.frustumCulled = false;
  top.frustumCulled   = false;
  const m4 = new THREE.Matrix4();
  const _tmpColor = new THREE.Color();
  records.forEach((rec, i) => {
    const { centroid, count } = rec;
    // Use precomputed `rec.level` (set in rebuildTowers; village + district
    // share the same formula). Falls back to threshold-based calc for
    // legacy callers that don't pre-set level.
    const lvl = rec.level ?? towerLevel(count, threshold);
    const h   = lvl * TOWER_STEP_HEIGHT;
    // Shaft: scale Y by h so the unit cylinder becomes h tall; center at h/2 above voxel top
    m4.makeScale(1, h, 1);
    m4.setPosition(centroid.x, VOXEL_HEIGHT + h / 2, centroid.z);
    shaft.setMatrixAt(i, m4);
    // Top sphere: sits at tip of shaft, colour derived from share count.
    m4.makeTranslation(centroid.x, VOXEL_HEIGHT + h + 0.15, centroid.z);
    top.setMatrixAt(i, m4);
    // Use rec.baseColor when available (already lerped with village threshold);
    // otherwise compute on the fly with the supplied threshold.
    const colorSrc = rec.baseColor || towerTopColor(count, threshold, _tmpColor);
    top.setColorAt(i, colorSrc);
  });
  shaft.instanceMatrix.needsUpdate = true;
  top.instanceMatrix.needsUpdate   = true;
  if (top.instanceColor) top.instanceColor.needsUpdate = true;
  return { shaft, top };
}

function rebuildTowers() {
  // Remove old tower meshes
  while (towerGroup.children.length) towerGroup.remove(towerGroup.children[0]);
  villageOrder.length  = 0;
  districtOrder.length = 0;
  villageTowerShaft  = null; villageTowerTop    = null;
  districtTowerShaft = null; districtTowerTop   = null;

  // Village towers — deduplicate by villageKey since离島 / 斷裂 villages
  // can show up as multiple GeoJSON features (= multiple villageMeshes for
  // the same logical village). Without dedup, each feature gets its own
  // tower → 「明明只有一根，卻畫兩根」.
  const seenVillage = new Set();
  const vRecs = villageMeshes
    .filter(m => {
      const k = m.userData.villageKey
        || `${m.userData.townName}/${m.userData.villageName}`;
      if (seenVillage.has(k)) return false;
      seenVillage.add(k);
      return true;
    })
    .map(m => {
      const tName = m.userData.townName;
      const vName = m.userData.villageName;
      const count = getTotalForVillage(tName, vName);
      return {
        townName:      tName,
        villageName:   vName,
        centroid:      m.userData.centroid,
        count,
        // `level` is the visible height tier (1..10). Stored on the record so
        // village + district towers can share the same height formula → LOD
        // swap doesn't change apparent height.
        level:         towerLevel(count, TOWER_VILLAGE_THRESHOLD),
        meshRef:       m,                               // tickTowerLift follows voxel Y
        _lastLift:     -Infinity,
        // Star-twinkle state (per-instance random phase + period 2–6s)
        baseColor:     towerTopColor(count, TOWER_VILLAGE_THRESHOLD).clone(),
        twinklePhase:  Math.random() * Math.PI * 2,
        twinklePeriod: 2 + Math.random() * 4,
      };
    })
    .filter(r => r.count >= TOWER_VILLAGE_THRESHOLD);
  if (vRecs.length > 0) {
    const { shaft, top } = buildTowerIM(vRecs, TOWER_VILLAGE_THRESHOLD);
    villageTowerShaft = shaft; villageTowerTop = top;
    towerGroup.add(shaft); towerGroup.add(top);
    villageOrder.push(...vRecs);
  }

  // District towers (main city only).
  // Position the district tower at the count-weighted average of its lit
  // villages, NOT at the district's administrative geometric centroid.
  // Otherwise, when the camera zooms past the LOD threshold (dist=50), the
  // village tower vanishes from the village voxel and the district tower
  // pops in at a totally different XZ — looks like 「塔跳動」. By aligning
  // to the activity centroid, the LOD swap stays close to where the user's
  // eye was, making the transition feel continuous.
  const districtVoxelCentroid = new Map(); // stem → { x, z, total }
  for (const v of vRecs) {
    const stem = v.townName.slice(0, -1);
    const acc  = districtVoxelCentroid.get(stem) || { x: 0, z: 0, total: 0 };
    acc.x     += v.centroid.x * v.count;
    acc.z     += v.centroid.z * v.count;
    acc.total += v.count;
    districtVoxelCentroid.set(stem, acc);
  }
  const dRecs = districtMeshes
    .filter(m => m.userData.layer === CITY_CONFIG.key)
    .map(m => {
      const stem  = m.userData.townName.slice(0, -1);
      const count = districtShareCounts.get(stem) || 0;
      const acc   = districtVoxelCentroid.get(stem);
      // Use weighted-average village centroid when available; otherwise
      // fall back to the district mesh's own centroid (eg. district sum
      // ≥ 50 from many small villages none of which individually hit the
      // village threshold).
      const cx = acc && acc.total > 0 ? acc.x / acc.total : m.userData.centroid.x;
      const cz = acc && acc.total > 0 ? acc.z / acc.total : m.userData.centroid.z;
      return {
        stem,
        centroid:      new THREE.Vector3(cx, VOXEL_HEIGHT, cz),
        count,
        // Same level formula as village towers: a district at count=52 →
        // Lv.5, height 5.0 — matches whatever its tallest village tower
        // looked like at zoom-in. LOD swap = same height, no shrink/grow.
        level:         towerLevel(count, TOWER_VILLAGE_THRESHOLD),
        meshRef:       m,
        _lastLift:     -Infinity,
        // Same colour formula too: a Lv.5 lantern is the same #FCE327→#FC8654
        // shade whether the camera shows the village or district layer.
        baseColor:     towerTopColor(count, TOWER_VILLAGE_THRESHOLD).clone(),
        twinklePhase:  Math.random() * Math.PI * 2,
        twinklePeriod: 2 + Math.random() * 4,
      };
    })
    .filter(r => r.count >= TOWER_DISTRICT_THRESHOLD);
  if (dRecs.length > 0) {
    const { shaft, top } = buildTowerIM(dRecs, TOWER_DISTRICT_THRESHOLD);
    districtTowerShaft = shaft; districtTowerTop = top;
    towerGroup.add(shaft); towerGroup.add(top);
    districtOrder.push(...dRecs);
  }

  updateTowerLOD();
}

function updateTowerLOD() {
  // Single threshold (no overlap) — old code had `< TOWER_FAR (60)` for
  // village + `> TOWER_NEAR (40)` for district which created a 40–60 dist
  // band where BOTH layers rendered. Symptom: in mid-zoom users would see
  // a village tower AND a district tower for the same area, looking like
  // 「明明只有一根，卻畫兩根」. Pick a single midpoint so only one layer
  // is visible at any zoom.
  const dist = camera.position.distanceTo(controls.target);
  const showVillage  = dist < 50;
  const showDistrict = !showVillage;
  if (villageTowerShaft)  { villageTowerShaft.visible  = showVillage;  villageTowerTop.visible   = showVillage; }
  if (districtTowerShaft) { districtTowerShaft.visible = showDistrict; districtTowerTop.visible  = showDistrict; }
}

// Sync each tower's Y position with its voxel's current `position.y`. The
// voxel can lift on hover (+0.4) or breathe via the gold pulse (+0.4 ±0.15).
// Without this, towers sit at static Y and visually detach from the voxel
// — user feedback: 「voxel 上下移動時，燈塔要連動，不然很怪」.
//
// Hot-path notes:
// - Skip records where lift hasn't changed since last frame (most are 0).
// - Single InstancedMesh.setMatrixAt + needsUpdate — cheap.
const _liftMat  = new THREE.Matrix4();
const _zeroMat  = new THREE.Matrix4().makeScale(0, 0, 0);
function syncTowerLift(records, shaftIM, topIM, threshold) {
  if (!shaftIM || !topIM) return;
  let dirty = false;
  // When drilled into a district, hide village towers from OTHER districts.
  // Reason: those towers stay at their real world XZ but visually feel like
  // they're hovering near the camera target. User feedback: 「永和區的燈塔
  // 位置，當我切換到中和區時，他一樣畫在正中央」.
  const drilledStem = drilledDistrict ? drilledDistrict.slice(0, -1) : null;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const isVillageRec = !!rec.villageName;
    const hideForDrill = isVillageRec && drilledStem
      && rec.townName.slice(0, -1) !== drilledStem;
    const lift = rec.meshRef ? rec.meshRef.position.y : 0;
    // Combine lift state + hide state in a single key so a switch from
    // visible→hidden (or vice versa) re-writes the matrix.
    const stateKey = hideForDrill ? 'hidden' : lift;
    if (stateKey === rec._lastLift) continue;
    rec._lastLift = stateKey;
    if (hideForDrill) {
      shaftIM.setMatrixAt(i, _zeroMat);
      topIM.setMatrixAt(i, _zeroMat);
    } else {
      // Use precomputed `rec.level` (set in rebuildTowers with village
      // formula for both village and district records) so the LOD swap at
      // dist=50 doesn't change the apparent height.
      const h = (rec.level ?? towerLevel(rec.count, threshold)) * TOWER_STEP_HEIGHT;
      _liftMat.makeScale(1, h, 1);
      _liftMat.setPosition(rec.centroid.x, VOXEL_HEIGHT + lift + h / 2, rec.centroid.z);
      shaftIM.setMatrixAt(i, _liftMat);
      _liftMat.makeTranslation(rec.centroid.x, VOXEL_HEIGHT + lift + h + 0.15, rec.centroid.z);
      topIM.setMatrixAt(i, _liftMat);
    }
    dirty = true;
  }
  if (dirty) {
    shaftIM.instanceMatrix.needsUpdate = true;
    topIM.instanceMatrix.needsUpdate = true;
  }
}

function tickTowerLift() {
  syncTowerLift(villageOrder,  villageTowerShaft,  villageTowerTop,  TOWER_VILLAGE_THRESHOLD);
  syncTowerLift(districtOrder, districtTowerShaft, districtTowerTop, TOWER_DISTRICT_THRESHOLD);
}

// Star-twinkle: each top sphere oscillates brightness 0.4–1.0 with its own
// random period (2–6 s) + phase. Looks like a sky of slowly-blinking stars
// rather than a synchronised metronome. Period range tuned per user
// feedback (initial 0.5–2 s felt too rapid → 「燈塔亮暗太快，改 2-6 秒」).
const _twinkleColor = new THREE.Color();
function twinkleLayer(records, topIM, nowSec) {
  if (!topIM || records.length === 0) return;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec.baseColor) continue;
    if (rec._lastLift === 'hidden') continue;          // skip drilled-out instances
    const angle      = (nowSec / rec.twinklePeriod) * Math.PI * 2 + rec.twinklePhase;
    const wave       = 0.5 + 0.5 * Math.sin(angle);    // 0..1
    const brightness = 0.4 + 0.6 * wave;               // 0.4..1.0 (never fully dark)
    _twinkleColor.copy(rec.baseColor).multiplyScalar(brightness);
    topIM.setColorAt(i, _twinkleColor);
  }
  if (topIM.instanceColor) topIM.instanceColor.needsUpdate = true;
}
function tickTowerTwinkle(now) {
  const nowSec = now / 1000;
  twinkleLayer(villageOrder,  villageTowerTop,  nowSec);
  twinkleLayer(districtOrder, districtTowerTop, nowSec);
}

function checkTowerHit() {
  const targets = [];
  if (villageTowerShaft?.visible)  { targets.push(villageTowerShaft,  villageTowerTop); }
  if (districtTowerShaft?.visible) { targets.push(districtTowerShaft, districtTowerTop); }
  if (!targets.length) return null;
  const hits = raycaster.intersectObjects(targets, false);
  if (!hits.length) return null;
  const { object, instanceId } = hits[0];
  if ((object === villageTowerShaft || object === villageTowerTop) && instanceId < villageOrder.length) {
    return { isVillage: true, ...villageOrder[instanceId] };
  }
  if ((object === districtTowerShaft || object === districtTowerTop) && instanceId < districtOrder.length) {
    return { isVillage: false, ...districtOrder[instanceId] };
  }
  return null;
}

function makeTowerGhost(hit) {
  // Both village and district records pre-compute `level` with the village
  // formula so hover tooltip / bubble height anchor lines up with what's
  // drawn. Fall back to recompute if record lacks the field.
  const lvl = hit.level ?? towerLevel(hit.count, TOWER_VILLAGE_THRESHOLD);
  const h   = lvl * TOWER_STEP_HEIGHT;
  const tipY = VOXEL_HEIGHT + h + 0.15;
  return {
    userData: {
      layer: 'tower', isTower: true, isContext: false, baseY: 0,
      centroid: new THREE.Vector3(hit.centroid.x, tipY, hit.centroid.z),
      townName:    hit.isVillage ? hit.townName    : hit.stem,
      villageName: hit.isVillage ? hit.villageName : '',
      count: hit.count,
    },
    position: { y: 0 },
    material: { emissive: { setHex() {} }, emissiveIntensity: 0 },
  };
}

function updatePanelDrill(stem) {
  // Capture previously-drilled chip before we flip classes, then let
  // layoutCards set its new destination (grid slot or banner if switching).
  const oldChip = document.querySelector('.card-district.active');

  updateCardState();
  layoutCards();

  // Fade old villages toward wherever the old chip is now headed
  clearVillages(oldChip);

  // Spawn villages for the newly drilled district
  if (drilledDistrict) renderVillagesFor(drilledDistrict.slice(0, -1));
}

// Sync card classes to drill / village selection state.
//   district: drilled gets .active, the rest get .faded when drilled
//   village:  selected gets .active, the rest get .faded when a village is selected
function updateCardState() {
  const drilledStem = drilledDistrict ? drilledDistrict.slice(0, -1) : null;
  for (const c of document.querySelectorAll('.card-district')) {
    const isDrilled = drilledStem && c.dataset.stem === drilledStem;
    c.classList.toggle('active', !!isDrilled);
    c.classList.toggle('faded', !!drilledStem && !isDrilled);
  }
  for (const c of document.querySelectorAll('.card-village:not(.clearing)')) {
    const isSelected = selectedVillageKey && c.dataset.villageKey === selectedVillageKey;
    c.classList.toggle('active', !!isSelected);
    c.classList.toggle('faded', !!selectedVillageKey && !isSelected);
  }
}

let hudVoxelCounts = { main: 0, context: 0, rest: 0 };
function refreshHud(main, context, rest) {
  if (main !== undefined) hudVoxelCounts = { main, context, rest };
  const data = ELECTIONS[currentYear];
  const topTwo = data.overall?.results?.slice(0, 2) || [];
  const vs = topTwo.map(r => `${r.name}（${r.partyName.replace(/(黨|中國|民主|主黨|中國國)/g, '').slice(0, 2) || r.partyName}）`).join(' vs ');
  hud.innerHTML = `<b>${data.election}</b><br />
    ${vs}<br />
    <span style="opacity:.6">${CITY_CONFIG.hud.mainLabel} ${hudVoxelCounts.main} · ${CITY_CONFIG.hud.contextLabel ? CITY_CONFIG.hud.contextLabel + ' ' + hudVoxelCounts.context + ' · ' : ''}其他 ${hudVoxelCounts.rest} 方塊</span>`;
}

// ─────────── routing ───────────
// ?city=ntpc        → init full Three.js scene (current experience)
// ?y=&d=&v= only    → backward-compat: old share links have no city param;
//                     treat as ntpc (the only city that existed before M9)
// no params at all  → home screen
if (!_cityParam) {
  // Home screen: show the city-picker, hide city-page chrome
  document.getElementById('home-screen').removeAttribute('hidden');
  document.getElementById('timeline').style.display = 'none';
  document.getElementById('timeline-hint').style.display = 'none';
  document.getElementById('controls').style.display = 'none';
  document.getElementById('label').style.display = 'none';
  document.getElementById('village-panel').style.display = 'none';
} else {
  // City page: hide home screen, show back button, init scene
  document.getElementById('city-back-btn').style.display = 'flex';

  try {
    bootstrap();
    buildTimeline();
    updateTimelineActive();
    buildVillagePanel();
    wireViewToggle();
    parseAndApplyUrl();
    // View tracking removed: counting every ?ref=share landing burned 2 reads
    // + 2 writes per visitor on the Worker, and a single viral village could
    // chew through the KV daily budget on views alone. Only the share button
    // press counts toward 燈塔 progression now.
    fetchShareCounts();
    // Update timeline hint dynamically based on which years have village data
    const missingVillageYears = YEARS.filter(y => !VILLAGE_YEARS.includes(y));
    const hintEl = document.getElementById('timeline-hint');
    if (hintEl) {
      if (missingVillageYears.length === 0) {
        hintEl.textContent = `所有 ${YEARS.length} 屆均有里級資料 · 低於 1% 候選人不顯示`;
      } else {
        const firstVillageYear = Math.min(...VILLAGE_YEARS);
        hintEl.textContent = `里級資料自 ${firstVillageYear} 起 · ${missingVillageYears.join(' / ')} 中選會未公開里級 · 低於 1% 候選人不顯示`;
      }
    }
  } catch (err) {
    hud.innerHTML = `<b>載入失敗</b><br />${err.message}`;
    console.error(err);
  }
}

// ─────────── hover + floating label ───────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerInside = false;

const labelEl = document.getElementById('label');
const labelBubble = labelEl.querySelector('.bubble');
const leaderSvg  = document.getElementById('label-leader');
const leaderLine = leaderSvg ? leaderSvg.querySelector('line') : null;
const tmpVec = new THREE.Vector3();

// Share button: copies pre-rendered /share/YYYY/{d}/{v}/ URL to clipboard so
// FB/Threads can fetch OG metadata. Only exists on 2022 villages.
// Events stop propagation so the underlying canvas doesn't also receive the
// pointer (which would trigger OrbitControls / drill handling).
const stopEvt = (e) => { e.stopPropagation(); };
for (const ev of ['pointerdown', 'pointerup', 'click', 'dblclick']) {
  labelBubble.addEventListener(ev, (e) => {
    if (e.target.closest('.share-btn')) stopEvt(e);
    // History strip squares are interactive too — prevent pointerdown from
    // bubbling to the canvas (would otherwise feel like a drag / deselect).
    if (e.target.closest('.hsq[data-year]')) stopEvt(e);
  });
}

// Celebratory firework burst at the share button's centre. Pure CSS animation;
// JS just injects ~20 particles (with random angle / distance / colour) and
// removes the layer after they fade out. Triggered after a successful share.
const FIREWORK_COLORS = ['#FCE327', '#FC8654', '#FFD56B', '#FFA060', '#FFEAA0', '#FFB740'];
function launchFireworks(originEl) {
  if (!originEl) return;
  const rect = originEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const layer = document.createElement('div');
  layer.className = 'fireworks-layer';
  layer.style.left = cx + 'px';
  layer.style.top  = cy + 'px';

  // Initial flash ring
  const flash = document.createElement('span');
  flash.className = 'fireworks-flash';
  layer.appendChild(flash);

  // Outer "main" burst — large, far-flung. User asked for 更浮誇:
  // 18 → 38 particles, 70-120 → 160-280 spread, longer animation.
  const PARTICLES = 38;
  for (let i = 0; i < PARTICLES; i++) {
    const angle = (i / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const dist = 160 + Math.random() * 120;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30; // upward bias for "rising rocket" feel
    const p = document.createElement('span');
    p.className = 'fireworks-particle';
    p.style.color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
    p.style.background = 'currentColor';
    p.style.setProperty('--dx', dx.toFixed(1) + 'px');
    p.style.setProperty('--dy', dy.toFixed(1) + 'px');
    p.style.setProperty('--gravity', (60 + Math.random() * 40).toFixed(1) + 'px');
    p.style.animationDelay = (Math.random() * 80).toFixed(0) + 'ms';
    p.style.animationDuration = (1100 + Math.random() * 400).toFixed(0) + 'ms';
    layer.appendChild(p);
  }

  // Mid-ring — fills the gap between sparks and main burst
  const MID = 16;
  for (let i = 0; i < MID; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 50;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 15;
    const m = document.createElement('span');
    m.className = 'fireworks-particle';
    m.style.color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
    m.style.background = 'currentColor';
    m.style.setProperty('--dx', dx.toFixed(1) + 'px');
    m.style.setProperty('--dy', dy.toFixed(1) + 'px');
    m.style.setProperty('--gravity', (40 + Math.random() * 25).toFixed(1) + 'px');
    m.style.animationDelay = (Math.random() * 100).toFixed(0) + 'ms';
    m.style.animationDuration = (950 + Math.random() * 300).toFixed(0) + 'ms';
    layer.appendChild(m);
  }

  // Inner sparks — bright cluster around the origin
  const SPARKS = 22;
  for (let i = 0; i < SPARKS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 40;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const s = document.createElement('span');
    s.className = 'fireworks-particle spark';
    s.style.color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
    s.style.background = 'currentColor';
    s.style.setProperty('--dx', dx.toFixed(1) + 'px');
    s.style.setProperty('--dy', dy.toFixed(1) + 'px');
    s.style.setProperty('--gravity', '20px');
    s.style.animationDelay = (Math.random() * 100).toFixed(0) + 'ms';
    layer.appendChild(s);
  }

  document.body.appendChild(layer);
  // Outer animation duration up to 1500ms + delay 80ms ≈ 1.6s; 2000ms safe.
  setTimeout(() => layer.remove(), 2000);
}
// Shared year-jump helper used by both the strip hover/scrub and click paths.
// Returns true if it actually fired (so the caller can stopPropagation only
// when a real jump happened).
function jumpBubbleToYear(y) {
  if (!y || y === currentYear || !ELECTIONS[y]) return false;
  // Preserve drill + pin: strip acts as a per-village scrubber, not a
  // global year reset. setYear() re-assigns `userData.vote` on every
  // village mesh for the new year, so we just re-render the same mesh
  // to pick up the updated vote / strip highlight.
  setYear(y, { preserveContext: true });
  const mesh = pulseMesh || hovered;
  if (mesh) {
    // Ghost-pinned villages (those without a 1982 voxel polygon — e.g. 蘆洲
    // 福安里, 永和 新里 — ~16 cases) are plain objects not in villageMeshes,
    // so setYear's per-mesh vote refresh skips them. Re-pull their vote
    // from the freshly-rebuilt villageVoteMap so the bubble shows the
    // newly-selected year's candidates, not the year the ghost was born.
    if (mesh.userData?.layer === 'village' && !mesh.userData.villageKey) {
      const tn = mesh.userData.townName || '';
      const vn = mesh.userData.villageName || '';
      const key = tn.slice(0, -1) + '/' + vn.slice(0, -1);
      mesh.userData.vote = villageVoteMap.get(key) || null;
    }
    renderBubble(mesh);
  }
  return true;
}

labelBubble.addEventListener('click', async (e) => {
  // Strip squares: click to jump year. Same sticky gate — only the pinned
  // / highlighted village allows year scrub.
  const hsq = e.target.closest('.hsq[data-year]');
  if (hsq) {
    e.stopPropagation();
    if (!sticky) return;
    jumpBubbleToYear(Number(hsq.dataset.year));
    return;
  }

  const btn = e.target.closest('.share-btn');
  if (!btn || btn.disabled) return;
  e.stopPropagation();

  const townName    = btn.dataset.town;
  const villageName = btn.dataset.village;
  if (!townName || !villageName) return;

  // Build canonical share URL.
  // For 2022 villages in any of the six 直轄市 there's a pre-built static
  // OG page at /share/{city}/{area}/{villageCode}/index.html with FB / LINE /
  // Threads-friendly og:image + og:title / og:description. Use that so
  // social-platform crawlers get a village-specific preview card. Its IIFE
  // redirect (see scripts/build-share.mjs) preserves any query string —
  // including ?ref=share — so the human receiver still triggers the view
  // tally on the SPA.
  //
  // Path uses CEC-issued numeric codes (area=3-digit district, villageCode=
  // 4-digit village within district) — stable, ASCII, easier to share. The
  // legacy Chinese-stem path /share/{city}/{區}/{里}/ is still generated for
  // backward compat, so FB/LINE-cached old links keep working.
  // Always build share URLs against the production origin: dev / staging
  // testers paste links to friends, who hit the canonical site. Hard-coded
  // so a stray import.meta.env.BASE_URL value or a future Vite config tweak
  // can't smuggle a leading character into the clipboard string (one user
  // hit `ahttps://...` in Messenger; couldn't reproduce in source — but
  // hardening the construction means it's structurally impossible now).
  const SHARE_ORIGIN = 'https://ileivoivm.github.io';
  const SHARE_BASE_PATH = '/change';
  const hasOgPage = currentYear === 2022; // all six cities have OG for 2022
  const match = villageVotes.villages.find(x =>
    x.townName === townName && x.villageName === villageName
  );
  const useNumeric = hasOgPage && match?.area && match?.villageCode;
  let pathname;
  let search;
  if (useNumeric) {
    pathname = `${SHARE_BASE_PATH}/share/${CITY_CONFIG.key}/${match.area}/${match.villageCode}/`;
    search = '?ref=share';
  } else if (hasOgPage) {
    // Fallback: numeric IDs not found (data missing area/villageCode for this
    // village) — fall back to Chinese-stem path, which is also generated.
    const dStem = encodeURIComponent(townName.slice(0, -1));
    const vStem = encodeURIComponent(villageName.slice(0, -1));
    pathname = `${SHARE_BASE_PATH}/share/${CITY_CONFIG.key}/${dStem}/${vStem}/`;
    search = '?ref=share';
  } else {
    // No pre-built OG for non-2022 years — share the SPA URL directly.
    pathname = `${SHARE_BASE_PATH}/`;
    search = '?' + new URLSearchParams({
      city: CITY_CONFIG.key,
      y:    String(currentYear),
      d:    townName.slice(0, -1),
      v:    villageName.slice(0, -1),
      ref:  'share',
    }).toString();
  }
  // Use the URL constructor: it validates / normalises and refuses to be
  // prefixed with anything outside the parts we passed in. Belt and braces.
  let url = new URL(pathname + search, SHARE_ORIGIN).toString();
  // Last-line defence — if anything ever slipped a non-protocol char in
  // front of the URL, slice it off rather than copy garbage to clipboard.
  if (!/^https:\/\//.test(url)) {
    const i = url.indexOf('https://');
    url = i > 0 ? url.slice(i) : SHARE_ORIGIN + pathname + search;
  }

  // Copy URL to clipboard with three-tier fallback so the user always sees
  // 「已複製 ✓」 instead of an iOS share sheet or a system prompt() popup.
  //
  //   1. navigator.clipboard.writeText (modern; needs user activation + focus)
  //   2. document.execCommand('copy') via a hidden textarea (legacy fallback;
  //      works even when navigator.clipboard rejects with "Document is not
  //      focused" — the bug behind 「有時有 popup 有時沒有」)
  //   3. inline button feedback 「複製失敗 · 請手動選取」 — never popup
  //
  // Set the success label first so the visual feedback is locked in even
  // if the user clicks away mid-copy.
  const orig = btn.textContent;
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch {
    // Hidden textarea + execCommand fallback. Works in iframes / unfocused
    // documents that block navigator.clipboard. Cleanup on next tick.
    //
    // readonly + autocomplete/autocorrect/autocapitalize/spellcheck off so
    // the iOS / Android virtual keyboard's predictive text and any browser
    // autofill cannot mutate the selection between select() and copy. This
    // is the suspected route for stray characters appearing on pasted URLs.
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.setAttribute('autocomplete', 'off');
      ta.setAttribute('autocorrect', 'off');
      ta.setAttribute('autocapitalize', 'off');
      ta.setAttribute('spellcheck', 'false');
      ta.setAttribute('aria-hidden', 'true');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { /* fall through */ }
  }
  if (copied) {
    btn.textContent = '已複製 ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1600);
  } else {
    btn.textContent = '複製失敗 · 再試一次';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }
  // Celebratory burst fires unconditionally — the meaningful share is the
  // postTally write below (always happens), and clipboard occasionally
  // rejects on focus changes / iframes. The ceremony is about pressing
  // the button, not about clipboard succeeding.
  launchFireworks(btn);

  // Fire tally; on success, optimistic local +1 instead of refetching the
  // whole city's counts (each /counts call previously cost 1 list + N KV
  // gets — burning the free-tier read budget on every share click).
  const counted = await postTally(townName, villageName, 'share');
  if (counted) bumpLocalShareCount(townName, villageName, 'share');
  else refreshTallyLineInBubble();
});

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  // Only treat the pointer as "inside the map" when it's actually over the
  // canvas — if it's over a panel card (pointer-events: auto) the raycast
  // would otherwise pick the voxel *under* the card, showing a wrong bubble
  // and letting card clicks feel like they fell through to the map.
  pointerInside = e.target === renderer.domElement;
});
window.addEventListener('pointerleave', () => { pointerInside = false; });

// click detection (distinct from drag) — used for drill-in / drill-out
let pointerDown = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
  const elapsed = performance.now() - pointerDown.t;
  pointerDown = null;
  if (moved > 4 || elapsed > 450) return; // drag, not click
  handleCanvasClick(e.clientX, e.clientY);
});

function handleCanvasClick(cx, cy) {
  const p = { x: (cx / window.innerWidth) * 2 - 1, y: -(cy / window.innerHeight) * 2 + 1 };
  raycaster.setFromCamera(p, camera);

  // Tower click jumps directly to that village/district regardless of the
  // current drill state — works at top-level (district mode) AND when already
  // drilled into a different district. User feedback: 「我如果點選燈塔的
  // 圓圈，也會快速切換到該里」.
  const towerHit = checkTowerHit();
  if (towerHit) {
    if (towerHit.isVillage) {
      const voteData = villageVoteMap.get(towerHit.townName.slice(0, -1) + '/' + towerHit.villageName.slice(0, -1));
      if (voteData) selectVillage(voteData);
      else drillByStem(towerHit.townName.slice(0, -1));
    } else {
      drillByStem(towerHit.stem);
    }
    return;
  }

  if (!drilledDistrict) {
    // district mode: click an NTPC district to drill; empty canvas toggles
    // the card overlay (same as Space / 新北市 tap).
    const targets = districtMeshes.filter(m => m.userData.layer === CITY_CONFIG.key && m.visible);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (hit) drillInto(hit.object);
    else toggleCardsCollapsed();
  } else {
    // drilled: single-click a village to highlight + pin; empty click only
    // unselects. Never exits drill (use 新北市 / Home / ESC for that).
    // Filter by both visibility AND drilled stem — same belt-and-braces as
    // updateHover — so a click never resolves to a different district's village.
    const stem = drilledDistrict.slice(0, -1);
    const targets = villageMeshes.filter(
      (m) => m.visible && m.userData.townName.slice(0, -1) === stem
    );
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) {
      if (selectedVillageKey) unselectVillage();
    } else {
      const v = hit.object.userData.vote;
      if (v) selectVillage(v);
      else { sticky = false; pulseMesh = null; }
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (selectedVillageKey) unselectVillage();
    else if (drilledDistrict) exitDrill();
    else if (cardsCollapsed) { cardsCollapsed = false; layoutCards(); }
  }
  // Space toggles the active cards overlay so viewers can freely explore
  // the 3D map: district grid at top level, village grid when drilled.
  // Same behavior is wired to 新北市 tap (top level), drilled district chip
  // tap (drilled), and empty-canvas click.
  if (e.key === ' ' || e.code === 'Space') {
    // Don't hijack Space if user is typing in an input
    const tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    e.preventDefault();
    toggleCardsCollapsed();
  }
});

// Double-click on a village → pin bubble + glow + URL update
renderer.domElement.addEventListener('dblclick', (e) => {
  const p = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
  raycaster.setFromCamera(p, camera);
  // Same scoping rule: when drilled, only the drilled district's villages
  // can resolve. Prevents dblclick on a far-away village from derailing drill.
  const stem = drilledDistrict ? drilledDistrict.slice(0, -1) : null;
  const pool = stem
    ? villageMeshes.filter((m) => m.visible && m.userData.townName.slice(0, -1) === stem)
    : villageMeshes.filter((m) => m.visible);
  const hits = raycaster.intersectObjects(pool, false);
  if (hits.length === 0) return;
  const vm = hits[0].object;
  const v = vm.userData.vote;
  if (!v) return;
  selectVillage(v);
});

function renderBubble(mesh) {
  const { townName, isContext, election } = mesh.userData;

  // Tower tooltip (T4)
  if (mesh.userData.isTower) {
    const fmt = n => n.toLocaleString('en-US');
    const label = mesh.userData.villageName
      ? `${mesh.userData.townName} ${mesh.userData.villageName}`
      : `${mesh.userData.townName}（${CITY_CONFIG.nameZh}）`;
    const count = mesh.userData.count;
    // Always use the village threshold for level — village & district towers
    // share the same height/colour scale so the LOD swap doesn't change
    // the displayed Lv. number either.
    const level = towerLevel(count, TOWER_VILLAGE_THRESHOLD);
    const lvLabel = level >= TOWER_MAX_LEVEL ? `Lv.${TOWER_MAX_LEVEL}（MAX）` : `Lv.${level}`;
    labelBubble.innerHTML = `
      <div class="row"><span class="name">${label}</span></div>
      <div class="sub">🏯 ${lvLabel} · 已被分享 ${fmt(count)} 次</div>`;
    return;
  }

  if (mesh.userData.layer === 'village') {
    const v = mesh.userData.vote;
    const vName = mesh.userData.villageName;
    const tName = mesh.userData.townName;
    if (!v) {
      labelBubble.innerHTML = `<div class="row"><span class="tag">${CITY_CONFIG.nameZh} ${tName}</span><span class="name">${vName}</span></div>
        <div class="sub">${currentYear} 年無里級資料</div>
        ${renderVillageHistoryStrip(tName, vName)}`;
      return;
    }
    const fmt = n => n.toLocaleString('en-US');
    const rows = v.results.filter(r => r.rate >= 1).map(r => {
      const hex = '#' + candidateColor(r).toString(16).padStart(6, '0');
      return `<div class="cand">
        <span class="swatch" style="background:${hex}"></span>
        <span class="cn">${r.name}</span>
        <span class="cp">${r.partyName}</span>
        <span class="cv">${fmt(r.votes)}</span>
        <span class="cr">${r.rate.toFixed(1)}%</span>
      </div>`;
    }).join('');
    const winColor = '#' + candidateColor(v.results[0]).toString(16).padStart(6, '0');

    // Flip math for the runner-up: swing = votes that must change sides
    // (gap closes at 2× leverage); mobilize = new votes all flowing to loser.
    let flipBlock = '';
    if (v.results.length >= 2 && v.results[0].votes > v.results[1].votes) {
      const w = v.results[0], l = v.results[1];
      const gap = w.votes - l.votes;
      const swing = Math.ceil((gap + 1) / 2);
      const mobilize = gap + 1;
      const loserColor = '#' + candidateColor(l).toString(16).padStart(6, '0');
      flipBlock = `<div class="flip">
        <div class="flip-head" style="color:${loserColor}">${l.name}（${l.partyName}）翻盤需</div>
        <div class="flip-row"><b>${fmt(swing)}</b> 票改投 <span class="dim">（1 票 = 2 差距）</span></div>
        <div class="flip-row">或爭取 <b>${fmt(mobilize)}</b> 張新票 <span class="dim">（全流向落後方）</span></div>
      </div>`;
    }

    // Share button: clipboard on all platforms (avoids surprising iOS share sheet).
    // data-town/data-village carry full names (with suffix) for the tally key.
    const shareBlock = `<button class="share-btn" data-town="${tName}" data-village="${vName}">複製分享連結、點亮燈塔</button>`;

    // Tally readout — gives the share-presser instant visual feedback before
    // hitting the 里塔 ≥10 / 區塔 ≥50 thresholds. Always shown so the
    // "分享點亮燈塔" mechanism is discoverable; 0 / 9 / 50+ all visible.
    // Uses stem-aware lookup so naming mismatches (1982 vs modern) resolve.
    const { shares: tShares, views: tViews } = getTallyForVillage(tName, vName);
    const totalCount = tShares + tViews;
    const VILLAGE_TOWER_THRESHOLD = TOWER_VILLAGE_THRESHOLD;
    let tallyBlock;
    if (totalCount >= VILLAGE_TOWER_THRESHOLD) {
      const level = towerLevel(totalCount, VILLAGE_TOWER_THRESHOLD);
      if (level >= TOWER_MAX_LEVEL) {
        tallyBlock = `<div class="tally-count lit" data-town="${tName}" data-village="${vName}">🏯 燈塔 <b>Lv.${TOWER_MAX_LEVEL}（MAX）</b> · 累積 <b>${totalCount}</b> 次 · 已達最高等級</div>`;
      } else {
        const nextRemain = TOWER_STEP_BUCKET - ((totalCount - VILLAGE_TOWER_THRESHOLD) % TOWER_STEP_BUCKET);
        tallyBlock = `<div class="tally-count lit" data-town="${tName}" data-village="${vName}">🏯 燈塔 <b>Lv.${level}</b> · 累積 <b>${totalCount}</b> 次 · 還差 <b>${nextRemain}</b> 次升 Lv.${level + 1}</div>`;
      }
    } else {
      const remain = VILLAGE_TOWER_THRESHOLD - totalCount;
      tallyBlock = `<div class="tally-count" data-town="${tName}" data-village="${vName}">分享點亮燈塔 · 進度 <b>${totalCount}/${VILLAGE_TOWER_THRESHOLD}</b>（還差 ${remain} 次）</div>`;
    }

    labelBubble.innerHTML = `
      <div class="row"><span class="tag">${tName}</span><span class="name">${vName}</span></div>
      <div class="winner" style="color:${winColor}">${v.winner} 勝 ${v.margin.toFixed(1)}%</div>
      <div class="cands">${rows}</div>
      ${flipBlock}
      ${renderVillageHistoryStrip(tName, vName)}
      ${tallyBlock}
      ${shareBlock}`;
    return;
  }

  const tag = mesh.userData.layer === 'rest'
    ? mesh.userData.countyName
    : mesh.userData.layer === CITY_CONFIG.key
      ? CITY_CONFIG.nameZh
      : CITY_CONFIGS[mesh.userData.layer]?.nameZh || mesh.userData.countyName || '';

  if (isContext) {
    labelBubble.innerHTML = `<div class="row"><span class="tag">${tag}</span><span class="name">${townName}</span></div>
      <div class="sub">（參考 · 無選舉資料）</div>`;
    return;
  }
  if (!election) {
    labelBubble.innerHTML = `<div class="row"><span class="tag">${tag}</span><span class="name">${townName}</span></div>
      <div class="sub">查無 2022 選舉資料</div>`;
    return;
  }
  const rows = election.results.filter(r => r.rate >= 1).map(r => {
    const hex = '#' + candidateColor(r).toString(16).padStart(6, '0');
    return `<div class="cand">
      <span class="swatch" style="background:${hex}"></span>
      <span class="cn">${r.name}</span>
      <span class="cp">${r.partyName}</span>
      <span class="cr">${r.rate.toFixed(1)}%</span>
    </div>`;
  }).join('');
  const winColor = '#' + candidateColor(election.results[0]).toString(16).padStart(6, '0');
  labelBubble.innerHTML = `
    <div class="row"><span class="tag">${tag}</span><span class="name">${election.name}</span></div>
    <div class="winner" style="color:${winColor}">${election.winner} 勝 ${election.margin.toFixed(1)}%</div>
    <div class="cands">${rows}</div>`;
}

function setHover(mesh) {
  if (hovered === mesh) return;
  if (hovered) {
    hovered.material.emissive.setHex(0x000000);
    hovered.position.y = hovered.userData.baseY;
  }
  hovered = mesh;
  if (mesh) {
    mesh.material.emissive.setHex(0x332211);
    mesh.material.emissiveIntensity = 0.5;
    mesh.position.y = mesh.userData.isContext ? 0.1 : 0.4;
    document.body.style.cursor = 'pointer';
    renderBubble(mesh);
    labelEl.classList.toggle('context', mesh.userData.isContext);
    // `locked` mirrors `sticky` — when the village is pinned (gold-glow),
    // the strip becomes interactive (hover-scrub). Otherwise the strip is
    // view-only to prevent drive-by hover from scrubbing years.
    labelEl.classList.toggle('locked', sticky);
    labelEl.classList.add('visible');
    if (leaderSvg) leaderSvg.classList.add('visible');
  } else {
    document.body.style.cursor = '';
    labelEl.classList.remove('visible');
    if (leaderSvg) leaderSvg.classList.remove('visible');
  }
}

function updateHover() {
  if (sticky) return;
  if (!pointerInside) { setHover(null); return; }
  raycaster.setFromCamera(pointer, camera);

  // T4: tower hover — only in district view (not drilled)
  if (!drilledDistrict && viewMode !== 'village') {
    const towerHit = checkTowerHit();
    if (towerHit) {
      setHover(makeTowerGhost(towerHit));
      return;
    }
  }

  let targets;
  if (drilledDistrict) {
    // Drilled into a district: ONLY villages inside it are hoverable. We filter
    // explicitly by townName (not just visible) because an earlier report had
    // bubbles firing for other districts' villages even after drill hid them.
    // Explicit name match is a belt-and-braces guarantee — no other district's
    // village mesh, no TPE/rest context, can trigger the bubble.
    const stem = drilledDistrict.slice(0, -1);
    targets = villageMeshes.filter(
      (m) => m.visible && m.userData.townName.slice(0, -1) === stem
    );
  } else if (viewMode === 'village') {
    // Village mode via toggle (not drilled): all visible villages + gray
    // context districts are fair game.
    targets = [...districtMeshes.filter(m => m.userData.layer !== 'ntpc'), ...villageMeshes];
  } else {
    targets = districtMeshes;
  }
  const hits = raycaster.intersectObjects(targets, false);
  setHover(hits.length > 0 ? hits[0].object : null);
}

function updateLabelPosition() {
  if (!hovered) return;
  // Project the voxel's TOP face position (where the share-tower starts) —
  // this is the anchor point the leader line connects back to.
  tmpVec.copy(hovered.userData.centroid);
  const baseY = tmpVec.y + hovered.position.y;
  tmpVec.y = baseY;
  tmpVec.project(camera);
  const W = window.innerWidth;
  const Hh = window.innerHeight;
  const voxelX = (tmpVec.x * 0.5 + 0.5) * W;
  const voxelY = (-tmpVec.y * 0.5 + 0.5) * Hh;

  // Anchor the bubble ABOVE-LEFT of the voxel so the share-tower stays
  // visible (towers stand directly above the voxel centroid; centered
  // bubble would cover them). Bubble's bottom-right corner sits at
  // (anchorX, anchorY) with translate(-100%, -100%).
  const margin = 12;
  const gap = 24;       // horizontal breathing room between bubble and tower
  const liftY = 40;     // bubble lifted above voxel so leader line has length
  const bw = labelBubble.offsetWidth;
  let anchorX = voxelX - gap;
  let anchorY = voxelY - liftY;
  // Clamp so bubble stays fully on screen.
  anchorX = Math.max(margin + bw, Math.min(W - margin, anchorX));
  anchorY = Math.max(margin + labelBubble.offsetHeight, Math.min(Hh - margin, anchorY));
  labelEl.style.transform = `translate(${anchorX}px, ${anchorY}px) translate(-100%, -100%)`;

  // Leader line: from bubble's bottom-right corner (anchorX, anchorY) to
  // the voxel top (voxelX, voxelY). User feedback: 「bubble 下方的黑線，
  // 要接回 voxel 的位置，也就是預設燈塔的起點」.
  if (leaderLine) {
    leaderLine.setAttribute('x1', anchorX);
    leaderLine.setAttribute('y1', anchorY);
    leaderLine.setAttribute('x2', voxelX);
    leaderLine.setAttribute('y2', voxelY);
  }
}

// ─────────── village list panel ───────────
// ─────────── flat card panel ───────────
function abbrParty(name) {
  const m = {
    '中國國民黨': 'KMT', '民主進步黨': 'DPP', '台灣民眾黨': 'TPP',
    '新黨': 'NP', '親民黨': 'PFP', '台灣團結聯盟': 'TSU',
    '時代力量': 'NPP', '無黨籍及未經政黨推薦': 'IND', '無黨': 'IND',
  };
  return m[name] || name?.slice(0, 3) || '';
}
function hexToCss(n) { return '#' + n.toString(16).padStart(6, '0'); }
// margin (0–100) → strip width px: sqrt curve so small leads still show colour
function marginToStripW(margin) {
  return (3 + Math.sqrt(Math.max(0, Math.min(margin, 45)) / 45) * 18).toFixed(1) + 'px';
}
function textColorFor(n) {
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  // perceptual brightness (0-255)
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return y < 150 ? '#ffffff' : '#1a1a1a';
}

function buildVillagePanel() {
  renderPanel();
}

function renderPanel() {
  const listEl = document.getElementById('village-list');
  if (!listEl) return;
  listEl.innerHTML = '';  // also clears any village cards

  const data = ELECTIONS[currentYear];
  if (!data) return;

  // ── city tile ──
  const overall = data.overall?.results?.[0];
  const cityCard = document.createElement('div');
  cityCard.className = 'card card-city';
  const cityHex = overall ? colorForDistrict(data.overall.results) : NEUTRAL;
  const cityMargin = overall?.margin ?? 0;
  cityCard.style.setProperty('--c', hexToCss(cityHex));
  cityCard.style.setProperty('--w', marginToStripW(cityMargin));
  cityCard.innerHTML = `
    <div class="name">${CITY_CONFIG.nameZh}</div>
    <hr class="card-divider">
    <div class="meta">${data.year}</div>`;
  cityCard.title = '回到全局視角 / 收合卡片';
  cityCard.addEventListener('click', () => {
    sticky = false;
    // At top level the city card is redundant with Space / empty-canvas click:
    // all three toggle the card overlay. When drilled, it still exits back.
    if (drilledDistrict) exitDrill(true);
    else toggleCardsCollapsed();
  });
  listEl.appendChild(cityCard);

  // ── district tiles ──
  const districts = data.districts.slice().sort((a, b) => a.area.localeCompare(b.area));

  const villageCountByStem = new Map();
  const src = villageVotes.villages.length ? villageVotes.villages : fallbackVillages;
  for (const v of src) {
    const s = v.townName.slice(0, -1);
    villageCountByStem.set(s, (villageCountByStem.get(s) || 0) + 1);
  }

  for (const d of districts) {
    const card = document.createElement('div');
    card.className = 'card card-district';
    card.dataset.stem = d.name.slice(0, -1); // use slice(0,-1) to match drillStem / drilledStem
    const hex = colorForDistrict(d.results);
    card.style.setProperty('--c', hexToCss(hex));
    card.style.setProperty('--w', marginToStripW(d.margin));
    const count = villageCountByStem.get(d.stem) ?? '';
    const metaText = count ? `${count}里 ${d.margin.toFixed(1)}%` : `${d.margin.toFixed(1)}%`;
    card.innerHTML = `
      <div class="name">${d.name}</div>
      <hr class="card-divider">
      <div class="meta">${metaText}</div>`;
    card.title = `${d.winner} ${d.results[0]?.rate.toFixed(1)}%`;
    card.addEventListener('click', () => {
      // drillStem: use d.name.slice(0,-1) so 2-char names ("中區"→"中") are
      // consistent with writeUrl / drillByStem which both use slice(0,-1).
      const drillStem = d.name.slice(0, -1);
      // Not drilled / drilled into a different district → drill in.
      if (!drilledDistrict || drilledDistrict.slice(0, -1) !== drillStem) {
        drillByStem(drillStem);
        return;
      }
      // Already drilled into this district: the chip is the 2nd breadcrumb.
      //  - If a village is selected (3-level [市][區][里] state), tapping
      //    the 區 chip drops back to 2-level [市][區] — dismiss the pinned
      //    bubble and re-expand the village grid on mobile so the viewer
      //    clearly sees the "went up one level" result (user report:
      //    "點選三重區卡片，要順間回到[新北][三重] 二階的狀態").
      //  - No village selected → toggle grid visibility (rotation mode).
      if (selectedVillageKey) {
        unselectVillage();
        if (isMobile() && cardsCollapsed) {
          cardsCollapsed = false;
          layoutCards();
        }
      } else {
        toggleCardsCollapsed();
      }
    });
    if (drilledDistrict && drilledDistrict.slice(0, -1) === d.name.slice(0, -1)) card.classList.add('active');
    listEl.appendChild(card);
  }

  // Re-apply drill / selection visual state BEFORE positioning so `.faded`
  // hides non-drilled districts. Without this, setYear with preserveContext
  // (strip-click year jump) rebuilds district cards into their grid slots
  // and they visually overlap the village grid below the breadcrumb.
  updateCardState();
  layoutCards();

  // Repopulate village cards if we're still drilled (e.g. year change while drilled)
  if (drilledDistrict) {
    renderVillagesFor(drilledDistrict.slice(0, -1));
    // renderVillagesFor appends cards without .faded/.active — re-apply state so
    // non-selected villages fade when a village is pinned (strip-jump case).
    updateCardState();
  }
}

// Create village cards for a given district stem, starting at the chip position
// (so they "emerge" from the breadcrumb) and animating into a grid below.
function renderVillagesFor(stem) {
  const villages = villageVotes.villages.filter(v => v.townName.slice(0, -1) === stem);
  if (!villages.length) return;

  const listEl = document.getElementById('village-list');
  if (!listEl) return;

  const chip = document.querySelector(`.card-district[data-stem="${stem}"]`);
  if (!chip) return;
  const cl = parseFloat(chip.style.left);
  const ct = parseFloat(chip.style.top);
  const cw = parseFloat(chip.style.width);
  const ch = parseFloat(chip.style.height);

  for (const v of villages) {
    const vCard = document.createElement('div');
    vCard.className = 'card card-village';
    vCard.dataset.villageKey = `${v.townName.slice(0, -1)}/${v.villageName.slice(0, -1)}`;
    const hex = colorForDistrict(v.results);
    vCard.style.setProperty('--c', hexToCss(hex));
    vCard.style.setProperty('--w', marginToStripW(v.margin));
    // 燈塔點亮指示：里若已累積到 ≥ TOWER_VILLAGE_THRESHOLD（10）次分享，
    // 在里名右邊放一個暖橘小圓點，跟地圖上的燈塔對得起來。
    const tallyCount = getTotalForVillage(v.townName, v.villageName);
    const lit = tallyCount >= TOWER_VILLAGE_THRESHOLD;
    const litDot = lit
      ? `<span class="tower-dot" title="燈塔已點亮 · 累積 ${tallyCount} 次"></span>`
      : '';
    vCard.innerHTML = `
      <div class="name">${v.villageName}${litDot}</div>
      <hr class="card-divider">
      <div class="meta">${v.margin.toFixed(0)}%</div>`;
    vCard.title = `${v.winner} ${v.results[0]?.rate.toFixed(1)}% vs ${v.results[1]?.name ?? ''} ${v.results[1]?.rate.toFixed(1) ?? ''}%`;
    vCard.addEventListener('click', (e) => {
      e.stopPropagation();
      if (vCard.dataset.villageKey === selectedVillageKey) unselectVillage();
      else selectVillage(v);
    });

    // Start at chip position, invisible — next frame we move them out
    vCard.style.left = cl + 'px';
    vCard.style.top = ct + 'px';
    vCard.style.width = cw + 'px';
    vCard.style.height = ch + 'px';
    vCard.style.opacity = '0';
    listEl.appendChild(vCard);
  }

  requestAnimationFrame(() => {
    for (const c of document.querySelectorAll('.card-village:not(.clearing)')) {
      c.classList.add('tween');
      c.style.opacity = '';
    }
    layoutCards();
  });
}

// Fade villages back into the given target (or wherever active now is),
// then remove from DOM. Marked `.clearing` so concurrent render/layout
// passes ignore them — otherwise stale fade-out cards pollute the new
// village grid count and positions.
function clearVillages(targetEl) {
  const vs = Array.from(document.querySelectorAll('.card-village:not(.clearing)'));
  if (!vs.length) return;

  const t = targetEl || document.querySelector('.card-district.active');
  for (const v of vs) {
    v.classList.add('clearing');
    if (t) {
      v.style.left = t.style.left;
      v.style.top = t.style.top;
      v.style.width = t.style.width;
      v.style.height = t.style.height;
    }
    v.style.opacity = '0';
    v.style.pointerEvents = 'none';
  }
  setTimeout(() => { for (const v of vs) v.remove(); }, 440);
}

// Position city + district cards.
//  - Default: Metro-style centered grid
//  - Drilled: city + selected district as a [新北市][區名] breadcrumb at top,
//             other districts stay in grid positions (faded, invisible)
function layoutCards() {
  const W = window.innerWidth, H = window.innerHeight;
  const city = document.querySelector('.card-city');
  const districts = Array.from(document.querySelectorAll('.card-district'));
  if (!city || districts.length === 0) return;

  const drilled = !!drilledDistrict;
  const drilledStem = drilled ? drilledDistrict.slice(0, -1) : null;
  // Collapsed applies in both modes:
  //  - top level: hide district grid (Space / empty-canvas / 新北市 tap)
  //  - drilled:   hide village grid (drilled district chip tap)
  // CSS picks the right thing to hide based on `drilled` + `cards-collapsed`.
  document.body.classList.toggle('drilled', drilled);
  document.body.classList.toggle('cards-collapsed', cardsCollapsed);
  updateMapScrim();

  const mobile = W < 640;
  const sidePad = mobile ? 8 : 0;

  // Reserve space for timeline (pill + hint + padding) at bottom — any card
  // placed below this line is unclickable because the timeline covers it.
  // Mobile timeline is tighter (~76+16 hint+tl), desktop 92+64+padding.
  const TIMELINE_RESERVE = mobile ? 80 : 130;
  const TOP_RESERVE = mobile ? 16 : 28;
  const availH = H - TIMELINE_RESERVE - TOP_RESERVE;

  const cols = mobile ? 3 : 5;
  const gap = mobile ? 5 : 6;
  const tileW = mobile ? Math.floor((W - 2 * sidePad - (cols - 1) * gap) / cols) : 180;
  let tileH = mobile ? 64 : 106;
  let cityH = mobile ? 74 : 141;
  let cityGap = mobile ? 8 : 10;
  const rows = Math.ceil(districts.length / cols);
  const gridW = cols * tileW + (cols - 1) * gap;
  let gridH = rows * tileH + (rows - 1) * gap;
  let totalH = cityH + cityGap + gridH;

  // If total card stack exceeds the viewport's safe area, shrink tileH / cityH
  // proportionally so the last row still lands above the timeline.
  // 下限設在合理可讀範圍，避免完全壓扁。
  if (totalH > availH) {
    const scale = availH / totalH;
    tileH = Math.max(48, Math.floor(tileH * scale));
    cityH = Math.max(52, Math.floor(cityH * scale));
    cityGap = Math.max(4, Math.floor(cityGap * scale));
    gridH = rows * tileH + (rows - 1) * gap;
    totalH = cityH + cityGap + gridH;
  }

  const gridStartX = Math.round((W - gridW) / 2);
  // Clamp startY so the bottom of the stack never crosses into the timeline zone
  const centeredY = Math.round((H - totalH) / 2);
  const gridStartY = Math.max(TOP_RESERVE, Math.min(centeredY, H - TIMELINE_RESERVE - totalH));

  // Breadcrumb geometry (only used when drilled)
  const hasVillageChip = drilled && !!selectedVillageKey;
  const bcH = mobile ? 46 : 77;
  const bcGap = mobile ? 6 : 10;
  const bcY = mobile ? 12 : 32;
  const bcCityW = mobile
    ? Math.max(66, Math.floor((W - 2 * sidePad - bcGap * (hasVillageChip ? 2 : 1)) * 0.28))
    : 240;
  const bcChipW = mobile
    ? Math.floor((W - 2 * sidePad - bcCityW - bcGap * (hasVillageChip ? 2 : 1)) / (hasVillageChip ? 2 : 1))
    : 192;
  const bcTotalW = bcCityW + bcGap + bcChipW + (hasVillageChip ? bcGap + bcChipW : 0);
  const bcStartX = Math.round((W - bcTotalW) / 2);
  const bcVillageX = bcStartX + bcCityW + bcGap + bcChipW + bcGap;

  if (drilled) {
    city.classList.add('compact');
    city.style.left = bcStartX + 'px';
    city.style.top = bcY + 'px';
    city.style.width = bcCityW + 'px';
    city.style.height = bcH + 'px';
  } else if (cardsCollapsed) {
    // City-only breadcrumb centered at top. Reuse the drilled breadcrumb
    // city width so the tween between states matches geometry.
    city.classList.add('compact');
    city.style.left = Math.round((W - bcCityW) / 2) + 'px';
    city.style.top = bcY + 'px';
    city.style.width = bcCityW + 'px';
    city.style.height = bcH + 'px';
  } else {
    city.classList.remove('compact');
    city.style.left = gridStartX + 'px';
    city.style.top = gridStartY + 'px';
    city.style.width = gridW + 'px';
    city.style.height = cityH + 'px';
  }

  for (let i = 0; i < districts.length; i++) {
    const card = districts[i];
    const c = i % cols, r = Math.floor(i / cols);
    const gridX = gridStartX + c * (tileW + gap);
    const gridY = gridStartY + cityH + cityGap + r * (tileH + gap);

    if (drilled && card.dataset.stem === drilledStem) {
      // Selected district becomes breadcrumb chip right of city
      card.classList.add('compact');
      card.style.left = (bcStartX + bcCityW + bcGap) + 'px';
      card.style.top = bcY + 'px';
      card.style.width = bcChipW + 'px';
      card.style.height = bcH + 'px';
    } else {
      card.classList.remove('compact');
      card.style.left = gridX + 'px';
      card.style.top = gridY + 'px';
      card.style.width = tileW + 'px';
      card.style.height = tileH + 'px';
    }
  }

  // Village grid — centered below breadcrumb when drilled.
  // Selected village card leaves the grid to become the 3rd breadcrumb chip.
  // On mobile, the grid goes inside a scrollable #village-list so districts
  // with many villages (e.g. 板橋 126 里) remain fully reachable; cards are
  // then absolute-positioned relative to that container instead of window.
  const villageCards = Array.from(document.querySelectorAll('.card-village:not(.clearing)'));
  const villageList = document.getElementById('village-list');
  if (drilled && villageCards.length > 0) {
    const n = villageCards.length;
    const vGap = mobile ? 4 : 5;
    // Cap columns by available viewport width so the grid never spills
    // off-screen (each column needs ~100px minimum to stay readable).
    const vAvailW = W - 2 * sidePad - (mobile ? 0 : 32);
    const MIN_COL_W = mobile ? 90 : 100;
    const vColCapByWidth = Math.floor((vAvailW + vGap) / (MIN_COL_W + vGap));
    const vColCapBase = mobile ? 3 : 14;
    const vColCap = Math.min(vColCapBase, Math.max(3, vColCapByWidth));
    const vCols = mobile
      ? Math.min(3, Math.max(2, Math.ceil(Math.sqrt(n))))
      : Math.min(vColCap, Math.max(3, Math.ceil(Math.sqrt(n))));
    let vTileW = mobile
      ? Math.floor((W - 2 * sidePad - (vCols - 1) * vGap) / vCols)
      : Math.min(125, Math.floor((vAvailW - (vCols - 1) * vGap) / vCols));
    let vTileH = mobile ? 48 : 70;
    const vRows = Math.ceil(n / vCols);

    // Desktop: shrink vTileH so the grid fits between breadcrumb and timeline.
    // Mobile uses scrollable #village-list (bounded by top/bottom) so no shrink.
    if (!mobile) {
      const breadcrumbBottom = bcY + bcH + 20;
      const vAvailableH = H - breadcrumbBottom - TIMELINE_RESERVE;
      const vGridH = vRows * vTileH + (vRows - 1) * vGap;
      if (vGridH > vAvailableH) {
        const scale = vAvailableH / vGridH;
        vTileH = Math.max(40, Math.floor(vTileH * scale));
      }
    }

    const vGridW = vCols * vTileW + (vCols - 1) * vGap;
    const vStartX = Math.round((W - vGridW) / 2);

    // Scroll mode (mobile): vStartY is relative to the scroll container's
    // top. Desktop uses window-relative coords via position:fixed.
    const mobileScroll = mobile;
    const vStartY = mobileScroll ? 8 : bcY + bcH + 20;

    if (mobileScroll) {
      villageList.style.top = (bcY + bcH + 10) + 'px';
      villageList.style.bottom = (TIMELINE_RESERVE - 16) + 'px'; // above timeline + hint
    } else {
      villageList.style.top = '';
      villageList.style.bottom = '';
    }

    for (let i = 0; i < n; i++) {
      const card = villageCards[i];
      if (selectedVillageKey && card.dataset.villageKey === selectedVillageKey) {
        // Breadcrumb chip — always window-fixed (kept outside scroll area).
        card.classList.add('compact');
        card.style.left = bcVillageX + 'px';
        card.style.top = bcY + 'px';
        card.style.width = bcChipW + 'px';
        card.style.height = bcH + 'px';
      } else {
        card.classList.remove('compact');
        const c = i % vCols, r = Math.floor(i / vCols);
        card.style.left = (vStartX + c * (vTileW + vGap)) + 'px';
        card.style.top = (vStartY + r * (vTileH + vGap)) + 'px';
        card.style.width = vTileW + 'px';
        card.style.height = vTileH + 'px';
      }
    }
  } else {
    villageList.style.top = '';
    villageList.style.bottom = '';
  }

  // Enable transitions after first placement (no-op on subsequent calls).
  requestAnimationFrame(() => {
    city.classList.add('tween');
    for (const c of districts) c.classList.add('tween');
  });
}

window.addEventListener('resize', layoutCards);

// ─────────── view toggle ───────────
function wireViewToggle() {
  const el = document.getElementById('view-toggle');
  if (!el) return;
  el.addEventListener('click', () => {
    setViewMode(viewMode === 'district' ? 'village' : 'district');
  });
}

// ─────────── year timeline UI ───────────
function buildTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;
  const winnerShort = {
    '民主進步黨': 'DPP', '中國國民黨': 'KMT', '台灣民眾黨': 'TPP',
  };
  YEARS.forEach((y, idx) => {
    if (idx > 0) {
      const arrow = document.createElement('div');
      arrow.className = 'arrow';
      arrow.textContent = '›';
      el.appendChild(arrow);
    }
    const data = ELECTIONS[y];
    const overall = data.overall?.results?.[0];
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.dataset.year = y;
    tick.innerHTML = `<span class="year">${y}</span><span class="who">${overall?.name || '—'} · ${winnerShort[overall?.partyName] || ''}</span>`;
    tick.addEventListener('click', () => setYear(y));
    el.appendChild(tick);
  });
}
function updateTimelineActive() {
  const el = document.getElementById('timeline');
  if (!el) return;
  el.querySelectorAll('.tick').forEach(x => {
    x.classList.toggle('active', Number(x.dataset.year) === currentYear);
  });
}

// ─────────── year switching + color tween ───────────
const COLOR_TWEEN_MS = 600;
const tmpColor = new THREE.Color();

function setYear(newYear, { preserveContext = false } = {}) {
  if (!ELECTIONS[newYear] || newYear === currentYear) return;
  // Default: full reset on year change — close any drill / selection, clear
  // hover so we re-render the panel from scratch without stale card state.
  // With `preserveContext: true` (used by in-bubble strip year-jump), we keep
  // drill state, keep the pinned village, and let the caller re-render the
  // bubble after meshes are updated. This makes the strip feel like a mini
  // timeline scrubber for one village, rather than a hard context reset.
  if (!preserveContext && (drilledDistrict || selectedVillageKey || sticky)) {
    exitDrill(true);
  }
  currentYear = newYear;
  electionByStem = rebuildElectionByStem(newYear);
  villageVoteMap = rebuildVillageVoteMap(newYear);
  const now = performance.now();

  // District color tween
  for (const mesh of districtMeshes) {
    if (mesh.userData.layer !== CITY_CONFIG.key) continue;
    const stem = mesh.userData.townName.slice(0, -1);
    const election = electionByStem[stem];
    const targetHex = election ? colorForDistrict(election.results) : NEUTRAL;
    mesh.userData.tweenFrom = mesh.material.color.clone();
    mesh.userData.tweenTo = new THREE.Color(targetHex);
    mesh.userData.tweenStart = now;
    mesh.userData.baseColor = targetHex;
    mesh.userData.election = election;
  }

  // Village color tween — if year has no village data, go NEUTRAL
  for (const mesh of villageMeshes) {
    const v = villageVoteMap.get(mesh.userData.villageKey);
    const targetHex = v ? colorForDistrict(v.results) : NEUTRAL;
    mesh.userData.tweenFrom = mesh.material.color.clone();
    mesh.userData.tweenTo = new THREE.Color(targetHex);
    mesh.userData.tweenStart = now;
    mesh.userData.baseColor = targetHex;
    mesh.userData.vote = v || null;
  }

  rebuildVillagePanel();
  if (hovered) renderBubble(hovered);
  refreshHud();
  updateTimelineActive();
  writeUrl();
}

function tickColorTween(now) {
  const tweenMesh = (mesh) => {
    const start = mesh.userData.tweenStart;
    if (start == null) return;
    const t = Math.min(1, (now - start) / COLOR_TWEEN_MS);
    const k = 1 - Math.pow(1 - t, 3);
    mesh.material.color.lerpColors(mesh.userData.tweenFrom, mesh.userData.tweenTo, k);
    if (t >= 1) mesh.userData.tweenStart = null;
  };
  for (const mesh of districtMeshes) tweenMesh(mesh);
  for (const mesh of villageMeshes) tweenMesh(mesh);
}

// Pulse the selected village with a golden glow; also flash newly-drilled district
const GLOW_HEX = 0xffc966;
function tickPulse(now) {
  // 1. Selected village: breathing golden glow
  if (pulseMesh) {
    const t = (Math.sin(now * 0.004) + 1) * 0.5; // 0..1 every ~1.5s
    pulseMesh.material.emissive.setHex(GLOW_HEX);
    pulseMesh.material.emissiveIntensity = 0.35 + 0.65 * t;
    pulseMesh.position.y = (pulseMesh.userData.baseY ?? 0) + 0.4 + 0.15 * t;
  }
  // 2. Drill flash: villages in drilled district shimmer for ~1s on entry
  if (drillFlashUntil > now && drilledDistrict) {
    const k = (drillFlashUntil - now) / 1100;
    const stem = drilledDistrict.slice(0, -1);
    for (const vm of villageMeshes) {
      if (!vm.visible) continue;
      if (vm === pulseMesh) continue;
      if (vm.userData.townName.slice(0, -1) !== stem) continue;
      vm.material.emissive.setHex(GLOW_HEX);
      vm.material.emissiveIntensity = 0.7 * k;
    }
  } else if (drillFlashUntil !== 0 && drillFlashUntil <= now) {
    // Flash ended: clear emissive on village meshes (except sticky pulseMesh)
    for (const vm of villageMeshes) {
      if (vm === pulseMesh) continue;
      vm.material.emissive.setHex(0x000000);
      vm.material.emissiveIntensity = 1;
    }
    drillFlashUntil = 0;
  }
}

// ─────────── compass + camera tween ───────────
const compassEl = document.getElementById('compass');
const needleEl = document.getElementById('compass-needle');

// initial camera state — remembered for Home button
const INITIAL_CAM_POS = camera.position.clone();
const INITIAL_TARGET = controls.target.clone();

let camTween = null;
function tweenCamera(toPos, toTarget, duration = 700, onComplete) {
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const start = performance.now();
  // Disable OrbitControls during tween — its internal spherical state would
  // otherwise override our manual camera.position sets when we change pitch.
  controls.enabled = false;
  camTween = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const k = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(fromPos, toPos, k);
    controls.target.lerpVectors(fromTarget, toTarget, k);
    camera.lookAt(controls.target);
    if (t >= 1) {
      camTween = null;
      controls.enabled = true;
      if (onComplete) onComplete();
    }
  };
}

// Compass cycles the camera through 北 → 東 → 南 → 西 → 北 (clockwise).
// Coord convention (from geo.js): north = -Z, east = +X. Each cardinal is
// the camera POSITION (camera looks back toward target), so "北視角" places
// the camera to the north of the target so you're looking south.
const COMPASS_DIRS = [
  { x:  0, z: -1 }, // 北 (camera at north, looking south — the default)
  { x:  1, z:  0 }, // 東
  { x:  0, z:  1 }, // 南
  { x: -1, z:  0 }, // 西
];
let compassIdx = 0;
compassEl.addEventListener('click', () => {
  const dist = 42;
  const pitch = Math.PI * 0.30;
  const y = dist * Math.sin(pitch);
  const planar = dist * Math.cos(pitch);
  // Pivot around the current controls.target so the cycle works at any
  // zoom / drill level — not just when centered at origin.
  const t = controls.target.clone();
  const dir = COMPASS_DIRS[compassIdx];
  compassIdx = (compassIdx + 1) % COMPASS_DIRS.length;
  tweenCamera(
    new THREE.Vector3(t.x + planar * dir.x, y, t.z + planar * dir.z),
    t
  );
});

// Home button — also exits drill if currently drilled
const homeEl = document.getElementById('home');
if (homeEl) {
  homeEl.addEventListener('click', () => {
    if (drilledDistrict) exitDrill();
    else tweenCamera(INITIAL_CAM_POS.clone(), INITIAL_TARGET.clone());
  });
}

// Help / 燈塔規則 modal: open on button click, close on backdrop click,
// 'X' button, or ESC. The modal is a `<div hidden>` in index.html — toggle
// the `hidden` attribute to show/hide.
const helpBtnEl    = document.getElementById('help-btn');
const helpModalEl  = document.getElementById('help-modal');
if (helpBtnEl && helpModalEl) {
  const closeHelp = () => helpModalEl.setAttribute('hidden', '');
  const openHelp  = () => helpModalEl.removeAttribute('hidden');
  helpBtnEl.addEventListener('click', openHelp);
  helpModalEl.querySelector('.help-backdrop')?.addEventListener('click', closeHelp);
  helpModalEl.querySelector('.help-close')?.addEventListener('click', closeHelp);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !helpModalEl.hasAttribute('hidden')) {
      closeHelp();
      e.stopPropagation(); // don't also exit drill / unselect
    }
  }, true); // capture phase: run before the existing ESC handler below
}

// ─────────── Search modal (cross-city village/district lookup) ───────────
// Type 「永和 安和」 → 直接跳到 安和里。多 token 必須全部命中（city / district
// / village 任一欄位 includes 即算）。在當前城市內跳轉走 selectVillage /
// drillByStem 不重新載入；跨城市時走 location.assign 觸發整頁路由。
const searchBtnEl    = document.getElementById('search-btn');
const searchModalEl  = document.getElementById('search-modal');
const searchInputEl  = document.getElementById('search-input');
const searchResultsEl= document.getElementById('search-results');

// Build a flat searchable index across all six 直轄市 using the 2022 village
// data already imported at module init (no extra network).
const SEARCH_INDEX = (() => {
  const idx = [];
  for (const [cityKey, cfg] of Object.entries(CITY_CONFIGS)) {
    const cityName = cfg.nameZh;
    const data = ALL_VILLAGE_ELECTIONS[cityKey]?.[2022];
    const villages = data?.villages || [];
    const seenDistricts = new Set();
    for (const v of villages) {
      const tName = v.townName;
      const vName = v.villageName;
      if (!seenDistricts.has(tName)) {
        seenDistricts.add(tName);
        idx.push({
          type: 'district',
          city: cityKey,
          cityName,
          districtName: tName,
          dStem: tName.slice(0, -1),
          haystack: `${cityName} ${tName}`,
        });
      }
      idx.push({
        type: 'village',
        city: cityKey,
        cityName,
        districtName: tName,
        dStem: tName.slice(0, -1),
        villageName: vName,
        vStem: vName.slice(0, -1),
        haystack: `${cityName} ${tName} ${vName}`,
      });
    }
  }
  return idx;
})();

let searchActiveIdx = 0;
let searchCurrentResults = [];

function searchFilter(q) {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const ranked = [];
  for (const item of SEARCH_INDEX) {
    if (!tokens.every(t => item.haystack.includes(t))) continue;
    // Base: district outranks village so 「松山」 surfaces 松山區 first
    // (broad context above specific point). Two-token queries like
    // 「松山 三民」 will boost the matching village above its district via
    // the village-stem exact bonus below.
    let score = item.type === 'district' ? 5 : 3;
    for (const t of tokens) {
      // Exact name / stem match — strongest signal that token IS this thing
      if (item.dStem === t || item.districtName === t) score += 12;
      if (item.type === 'village' && (item.vStem === t || item.villageName === t)) score += 14;
      // City-name exact match (eg. 「台北市」) gates result-set without
      // dominating ranking
      if (item.cityName === t) score += 1;
    }
    ranked.push({ item, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 12).map(r => r.item);
}

function renderSearchResults(results) {
  searchCurrentResults = results;
  if (!results.length) {
    const q = searchInputEl.value.trim();
    searchResultsEl.innerHTML = q
      ? `<div class="search-empty">找不到「${q}」相符的城市 / 區 / 里</div>`
      : '';
    return;
  }
  searchResultsEl.innerHTML = results.map((r, i) => {
    const path = r.type === 'village'
      ? `${r.districtName}<span class="sep">·</span><b>${r.villageName}</b>`
      : `<b>${r.districtName}</b>`;
    const typeTag = r.type === 'village' ? '里' : '區';
    return `<div class="search-result${i === searchActiveIdx ? ' active' : ''}" data-idx="${i}" role="option">
      <span class="city-tag">${r.cityName}</span>
      <span class="path">${path}</span>
      <span class="type-tag">${typeTag}</span>
    </div>`;
  }).join('');
}

function searchNavigate(item) {
  if (!item) return;
  if (item.city === CITY_CONFIG.key) {
    // Same city: navigate without reload via existing handlers.
    if (currentYear !== 2022) setYear(2022);
    if (item.type === 'village') {
      const v = villageVotes.villages.find(x =>
        x.townName.slice(0, -1) === item.dStem &&
        x.villageName.slice(0, -1) === item.vStem
      );
      if (v) selectVillage(v);
      else drillByStem(item.dStem);
    } else {
      drillByStem(item.dStem);
    }
  } else {
    // Cross-city: full reload with new ?city= so all city-scoped imports
    // (geo / votes / vote map) re-init.
    const sp = new URLSearchParams({
      city: item.city,
      y: '2022',
      d: item.dStem,
    });
    if (item.type === 'village') sp.set('v', item.vStem);
    location.assign(`?${sp}`);
  }
  closeSearchModal();
}

function openSearchModal() {
  if (!searchModalEl) return;
  searchModalEl.removeAttribute('hidden');
  searchInputEl.value = '';
  searchActiveIdx = 0;
  renderSearchResults([]);
  // Defer focus so the modal animates in cleanly
  setTimeout(() => searchInputEl.focus(), 0);
}

function closeSearchModal() {
  if (!searchModalEl) return;
  searchModalEl.setAttribute('hidden', '');
}

if (searchBtnEl && searchModalEl) {
  searchBtnEl.addEventListener('click', openSearchModal);
  searchModalEl.querySelector('.search-backdrop')?.addEventListener('click', closeSearchModal);

  searchInputEl.addEventListener('input', () => {
    searchActiveIdx = 0;
    renderSearchResults(searchFilter(searchInputEl.value));
  });

  searchInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearchModal();
      e.stopPropagation();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!searchCurrentResults.length) return;
      searchActiveIdx = (searchActiveIdx + 1) % searchCurrentResults.length;
      renderSearchResults(searchCurrentResults);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!searchCurrentResults.length) return;
      searchActiveIdx = (searchActiveIdx - 1 + searchCurrentResults.length) % searchCurrentResults.length;
      renderSearchResults(searchCurrentResults);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      searchNavigate(searchCurrentResults[searchActiveIdx]);
    }
  });

  searchResultsEl.addEventListener('click', (e) => {
    const row = e.target.closest('.search-result');
    if (!row) return;
    const idx = parseInt(row.dataset.idx, 10);
    searchNavigate(searchCurrentResults[idx]);
  });

  // Global hotkeys: 「/」 or Cmd/Ctrl+K to open. Skip when user is typing
  // in another input / textarea so it doesn't hijack form fields elsewhere.
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      openSearchModal();
    }
  });
}

// Zoom +/- buttons
function zoomBy(factor) {
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
  dir.multiplyScalar(factor);
  const newPos = new THREE.Vector3().addVectors(controls.target, dir);
  const dist = dir.length();
  if (dist < controls.minDistance || dist > controls.maxDistance) return;
  tweenCamera(newPos, controls.target.clone(), 300);
}
document.getElementById('zoom-in')?.addEventListener('click', () => zoomBy(0.7));
document.getElementById('zoom-out')?.addEventListener('click', () => zoomBy(1.4));

function updateCompassNeedle() {
  const dx = camera.position.x - controls.target.x;
  const dz = camera.position.z - controls.target.z;
  const azimuth = Math.atan2(dx, dz);
  const deg = (azimuth * 180) / Math.PI + 180;
  needleEl.setAttribute('transform', `rotate(${deg})`);
}

// ─────────── camera readout ───────────
const camPosEl = document.getElementById('cam-pos');
const camTargetEl = document.getElementById('cam-target');
const camDistEl = document.getElementById('cam-dist');
const camAzEl = document.getElementById('cam-az');
const camPitchEl = document.getElementById('cam-pitch');

function fmt(n) { return n.toFixed(2).padStart(7); }

function updateCameraReadout() {
  if (!camPosEl) return;
  const p = camera.position, t = controls.target;
  camPosEl.textContent = `${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}`;
  camTargetEl.textContent = `${fmt(t.x)}, ${fmt(t.y)}, ${fmt(t.z)}`;
  const dx = p.x - t.x, dy = p.y - t.y, dz = p.z - t.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const planar = Math.sqrt(dx * dx + dz * dz);
  // azimuth: compass-style, 0° when camera is south of target (looking north)
  const azRad = Math.atan2(dx, dz);
  const azDeg = ((azRad * 180) / Math.PI + 360) % 360;
  // pitch: 0° horizontal, 90° looking straight down
  const pitchDeg = (Math.atan2(dy, planar) * 180) / Math.PI;
  camDistEl.textContent = `${dist.toFixed(2)}`;
  camAzEl.textContent = `${azDeg.toFixed(1)}°`;
  camPitchEl.textContent = `${pitchDeg.toFixed(1)}°`;
}

// ─────────── loop ───────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (districtLineMat) districtLineMat.resolution.set(window.innerWidth, window.innerHeight);
  villageLineMats.forEach(m => m.resolution.set(window.innerWidth, window.innerHeight));
});

(function tick() {
  const now = performance.now();
  if (camTween) camTween(now);
  controls.update();
  updateHover();
  updateLabelPosition();
  updateCompassNeedle();
  updateCameraReadout();
  tickColorTween(now);
  tickPulse(now);
  tickTowerLift();
  tickTowerTwinkle(now);
  updateTowerLOD();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
})();
