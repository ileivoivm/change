import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeBounds, makeProjector, projectFeature, voxelize } from './geo.js';
import { colorForDistrict, partyColor, NEUTRAL, PARTY_COLORS } from './palette.js';
import ntpcGeo from '../data/processed/ntpc-districts.geo.json';
import tpeGeo from '../data/processed/tpe-districts.geo.json';
import restGeo from '../data/processed/tw-rest-districts.geo.json';
import ntpcVillageGeo from '../data/processed/ntpc-villages.geo.json';
import tpeVillageGeo  from '../data/processed/tpe-villages.geo.json';
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

// ─────────── city routing (determined early so all constants can use it) ───────────
// ?city=ntpc / ?city=tpe / etc.  → which city's data to show
// Legacy share links (no city=)  → treat as ntpc (the only city pre-M9)
const _sp = new URLSearchParams(location.search);
const _cityParam = _sp.get('city')
  || (_sp.has('y') || _sp.has('d') || _sp.has('v') ? 'ntpc' : null);
const CITY_CONFIG = CITY_CONFIGS[_cityParam] || CITY_CONFIGS.ntpc;


const NTPC_VILLAGE_ELECTIONS = { 1997: v1997, 2001: v2001, 2005: v2005, 2010: v2010, 2014: v2014, 2018: v2018, 2022: v2022 };
const TPE_VILLAGE_ELECTIONS  = { 1994: tv1994, 1998: tv1998, 2002: tv2002, 2006: tv2006, 2010: tv2010, 2014: tv2014, 2018: tv2018, 2022: tv2022 };
const VILLAGE_ELECTIONS = CITY_CONFIG.key === 'tpe' ? TPE_VILLAGE_ELECTIONS : NTPC_VILLAGE_ELECTIONS;
// Which years actually have village-level data (non-empty)
const VILLAGE_YEARS = Object.entries(VILLAGE_ELECTIONS)
  .filter(([, d]) => (d.villages || []).length > 0)
  .map(([y]) => Number(y));
let villageVotes = VILLAGE_ELECTIONS[2022];
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
import { CITY_CONFIGS } from './city-configs.js';

const NTPC_ELECTIONS = { 1997: e1997, 2001: e2001, 2005: e2005, 2010: e2010, 2014: e2014, 2018: e2018, 2022: e2022 };
const TPE_ELECTIONS  = { 1994: te1994, 1998: te1998, 2002: te2002, 2006: te2006, 2010: te2010, 2014: te2014, 2018: te2018, 2022: te2022 };
const ELECTIONS = CITY_CONFIG.key === 'tpe' ? TPE_ELECTIONS : NTPC_ELECTIONS;
const villageGeo = CITY_CONFIG.key === 'tpe' ? tpeVillageGeo : ntpcVillageGeo;
// Fallback village list (for district card counts when current year has no village data)
const fallbackVillages = (CITY_CONFIG.key === 'tpe' ? tv2022 : v2022).villages;
const YEARS = CITY_CONFIG.years;
let currentYear = CITY_CONFIG.defaultYear;

const VOXEL_CELL = 0.45;
const VILLAGE_CELL = 0.20;
const VOXEL_HEIGHT = 0.9;
const CONTEXT_HEIGHT = 0.25;
const WORLD_SIZE = CITY_CONFIG.worldSize;
let viewMode = 'district'; // 'district' | 'village'

// ─────────── scene ───────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f1ea);
scene.fog = new THREE.Fog(0xf3f1ea, 120, 720); // halved — visible at long range

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
  new THREE.MeshStandardMaterial({ color: 0xe4dfd2, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
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
const villageBorderLines = [];
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
      entry.years[year] = { partyCode: v.winnerPartyCode, margin: v.margin };
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
    const hex = '#' + partyColor(data.partyCode).toString(16).padStart(6, '0');
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
    const raw = voxelize(polys, VOXEL_CELL);
    if (raw.length === 0) return;
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
    const stem = townName.slice(0, -1);
    const election = layer === CITY_CONFIG.key ? electionByStem[stem] : null;

    let baseColor;
    if (layer === CITY_CONFIG.key) {
      baseColor = election ? colorForDistrict(election.results) : NEUTRAL;
    } else {
      // context layers → soft gray
      baseColor = 0xb8b2a6;
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

  function addLines(positions, color, opts = {}) {
    if (positions.length === 0) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: opts.opacity ?? 0.85,
      fog: opts.fog !== false,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geom, mat);
    lines.renderOrder = opts.renderOrder ?? 2;
    scene.add(lines);
  }
  addLines(white, 0xffffff, { opacity: 0.85 });
  addLines(black, 0x1a1a1a, { opacity: 0.9, renderOrder: 3, fog: false });
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
    mesh.userData = {
      layer: 'village',
      townName: f.properties.TOWNNAME,
      villageName: f.properties.VILLAGENAM,
      villageKey: key,
      baseColor: color,
      baseY: 0,
      isContext: false,
      centroid: new THREE.Vector3(cx / cells.length, VOXEL_HEIGHT, cz / cells.length),
      vote,
    };
    group.add(mesh);
    villageMeshes.push(mesh);
  }

  // Borders (village-level): white between different villages, black on void
  const half = VILLAGE_CELL / 2;
  const topY = VOXEL_HEIGHT + 0.01;
  const white = [], black = [];
  const neighbors = [
    { dx: 0, dz: -1, a: [-half, -half], b: [ half, -half] },
    { dx: 0, dz:  1, a: [-half,  half], b: [ half,  half] },
    { dx: -1, dz: 0, a: [-half, -half], b: [-half,  half] },
    { dx:  1, dz: 0, a: [ half, -half], b: [ half,  half] },
  ];
  for (const { cells, key } of perVillage) {
    for (const { ix, iz, x, z } of cells) {
      for (const n of neighbors) {
        const nb = owner.get(`${ix + n.dx},${iz + n.dz}`);
        if (nb === key) continue;
        if (!nb) {
          black.push(x + n.a[0], 0.05, z + n.a[1], x + n.b[0], 0.05, z + n.b[1]);
        } else {
          white.push(x + n.a[0], topY, z + n.a[1], x + n.b[0], topY, z + n.b[1]);
        }
      }
    }
  }
  function pushLines(arr, color, opts = {}) {
    if (arr.length === 0) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: opts.opacity ?? 0.85,
      fog: opts.fog !== false,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geom, mat);
    lines.renderOrder = opts.renderOrder ?? 2;
    group.add(lines);
    villageBorderLines.push(lines);
  }
  pushLines(white, 0xffffff, { opacity: 0.7 });
  pushLines(black, 0x1a1a1a, { opacity: 0.9, renderOrder: 3, fog: false });

  group.visible = false;
  scene.add(group);
  return group;
}

function bootstrap() {
  // Determine which district GeoJSON is the "main" city and which is the context sibling.
  // For ntpc: preserve existing calibrated camera (bounds from ntpc+tpe combined).
  // For tpe: center on tpe alone; ntpc appears as context layer.
  const isTpe = CITY_CONFIG.key === 'tpe';
  const mainGeo     = isTpe ? tpeGeo  : ntpcGeo;
  const contextGeo  = isTpe ? ntpcGeo : tpeGeo;
  const contextKey  = isTpe ? 'ntpc'  : 'tpe';

  const boundsFeatures = isTpe ? mainGeo.features : [...ntpcGeo.features, ...tpeGeo.features];
  const bounds = computeBounds(boundsFeatures);
  const projector = makeProjector(bounds, WORLD_SIZE);

  const restCount    = buildLayer(restGeo.features,    projector, { height: CONTEXT_HEIGHT, layer: 'rest',       interactive: false });
  const contextCount = buildLayer(contextGeo.features, projector, { height: CONTEXT_HEIGHT, layer: contextKey,   interactive: true });
  const mainCount    = buildLayer(mainGeo.features,    projector, { height: VOXEL_HEIGHT,   layer: CITY_CONFIG.key, interactive: true });

  buildBorders();
  villageGroup = buildVillageLayer(projector);
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
    villageBorderLines.forEach(l => l.visible = true);
  } else {
    ntpcDistrictMeshes.forEach(m => m.visible = true);
    if (villageGroup) villageGroup.visible = false;
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
  // Hide village borders during drill (voxel cube edges give enough structure at zoom)
  villageBorderLines.forEach(l => l.visible = false);

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
  villageBorderLines.forEach(l => l.visible = true);
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
    panZoomWithPitch(vm.userData.centroid, 15, 42, (Math.random() - 0.5) * 100);
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
    if (dm) panZoomWithPitch(dm.userData.centroid, 15, 42, (Math.random() - 0.5) * 100);
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
function panZoomWithPitch(targetVec, distance, pitchDeg, deltaAzimuthDeg = 0) {
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
  tweenCamera(newPos, targetVec.clone(), 800);
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
    // Update timeline hint dynamically based on which years have village data
    const missingVillageYears = YEARS.filter(y => !VILLAGE_YEARS.includes(y));
    const hintEl = document.getElementById('timeline-hint');
    if (hintEl) {
      if (missingVillageYears.length === 0) {
        hintEl.textContent = `所有 ${YEARS.length} 屆均有里級資料`;
      } else {
        const firstVillageYear = Math.min(...VILLAGE_YEARS);
        hintEl.textContent = `里級資料自 ${firstVillageYear} 起 · ${missingVillageYears.join(' / ')} 中選會未公開里級`;
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

// Hover scrub: sliding across strip squares jumps years without a click.
// Uses pointerover (bubbles) so event delegation via .closest() works, and
// also fires on touch-drag across squares for the same scrubber feel on mobile.
// IMPORTANT: only interactive when the village is pinned (gold-glow / sticky).
// Drive-by hover over an unpinned bubble must NOT scrub years — users were
// accidentally triggering year jumps just from mouse tracking near the strip.
labelBubble.addEventListener('pointerover', (e) => {
  if (!sticky) return;
  const hsq = e.target.closest('.hsq[data-year]');
  if (!hsq) return;
  const y = Number(hsq.dataset.year);
  jumpBubbleToYear(y);
});

labelBubble.addEventListener('click', async (e) => {
  // Strip squares: click path kept as a fallback for taps that don't drag
  // (hover-only wouldn't work on a single tap-no-drag touch). Same sticky
  // gate — only the pinned / highlighted village allows year scrub.
  const hsq = e.target.closest('.hsq[data-year]');
  if (hsq) {
    e.stopPropagation();
    if (!sticky) return;
    jumpBubbleToYear(Number(hsq.dataset.year));
    return;
  }

  const btn = e.target.closest('.share-btn');
  if (!btn) return;
  e.stopPropagation();
  const d = btn.dataset.d, v = btn.dataset.v;
  // Always use the canonical production URL so social-platform crawlers
  // (FB, Threads, LINE) can fetch the share page even when the user
  // copies the link from a dev / localhost session.
  const shareBase = import.meta.env.DEV
    ? 'https://ileivoivm.github.io/change'
    : location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = `${shareBase}/share/2022/${encodeURIComponent(d)}/${encodeURIComponent(v)}/`;
  try {
    await navigator.clipboard.writeText(url);
    const orig = btn.textContent;
    btn.textContent = '已複製 ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1600);
  } catch {
    prompt('複製這個連結分享：', url);
  }
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
    const rows = v.results.map(r => {
      const hex = '#' + partyColor(r.partyCode).toString(16).padStart(6, '0');
      return `<div class="cand">
        <span class="swatch" style="background:${hex}"></span>
        <span class="cn">${r.name}</span>
        <span class="cp">${r.partyName}</span>
        <span class="cv">${fmt(r.votes)}</span>
        <span class="cr">${r.rate.toFixed(1)}%</span>
      </div>`;
    }).join('');
    const winColor = '#' + partyColor(v.winnerPartyCode).toString(16).padStart(6, '0');

    // Flip math for the runner-up: swing = votes that must change sides
    // (gap closes at 2× leverage); mobilize = new votes all flowing to loser.
    let flipBlock = '';
    if (v.results.length >= 2 && v.results[0].votes > v.results[1].votes) {
      const w = v.results[0], l = v.results[1];
      const gap = w.votes - l.votes;
      const swing = Math.ceil((gap + 1) / 2);
      const mobilize = gap + 1;
      const loserColor = '#' + partyColor(l.partyCode).toString(16).padStart(6, '0');
      flipBlock = `<div class="flip">
        <div class="flip-head" style="color:${loserColor}">${l.name}（${l.partyName}）翻盤需</div>
        <div class="flip-row"><b>${fmt(swing)}</b> 票改投 <span class="dim">（1 票 = 2 差距）</span></div>
        <div class="flip-row">或爭取 <b>${fmt(mobilize)}</b> 張新票 <span class="dim">（全流向落後方）</span></div>
      </div>`;
    }

    // Always render the share button so bubble height stays stable across
    // year scrubbing (user report: "bubble 才不會乎大呼小"). Pre-rendered
    // OG cards only exist for 2022, so older years show it disabled/greyed.
    const shareBlock = currentYear === 2022
      ? `<button class="share-btn" data-d="${tName.slice(0, -1)}" data-v="${vName.slice(0, -1)}">複製分享連結</button>`
      : `<button class="share-btn disabled" disabled title="僅 2022 年提供預先產生的分享卡片">複製分享連結</button>`;

    labelBubble.innerHTML = `
      <div class="row"><span class="tag">${tName}</span><span class="name">${vName}</span></div>
      <div class="winner" style="color:${winColor}">${v.winner} 勝 ${v.margin.toFixed(1)}%</div>
      <div class="cands">${rows}</div>
      ${flipBlock}
      ${renderVillageHistoryStrip(tName, vName)}
      ${shareBlock}`;
    return;
  }

  const tag = mesh.userData.layer === 'rest' ? mesh.userData.countyName
    : mesh.userData.layer === CITY_CONFIG.key ? CITY_CONFIG.nameZh
    : CITY_CONFIG.key === 'tpe' ? '新北市' : '台北市';

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
  const rows = election.results.map(r => {
    const hex = '#' + partyColor(r.partyCode).toString(16).padStart(6, '0');
    return `<div class="cand">
      <span class="swatch" style="background:${hex}"></span>
      <span class="cn">${r.name}</span>
      <span class="cp">${r.partyName}</span>
      <span class="cr">${r.rate.toFixed(1)}%</span>
    </div>`;
  }).join('');
  const winColor = '#' + partyColor(election.winnerPartyCode).toString(16).padStart(6, '0');
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
  } else {
    document.body.style.cursor = '';
    labelEl.classList.remove('visible');
  }
}

function updateHover() {
  if (sticky) return;
  if (!pointerInside) { setHover(null); return; }
  raycaster.setFromCamera(pointer, camera);
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
  tmpVec.copy(hovered.userData.centroid);
  tmpVec.y += hovered.position.y + 0.3;
  tmpVec.project(camera);
  const W = window.innerWidth;
  const x = (tmpVec.x * 0.5 + 0.5) * W;
  const y = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
  // Clamp X so the bubble (centered on x via translate -50%) stays inside the
  // viewport — matters on narrow phones where the bubble would otherwise fall
  // off screen when the anchored voxel is near an edge.
  const margin = 12;
  const bw = labelBubble.offsetWidth;
  const half = bw / 2;
  const cx = Math.max(half + margin, Math.min(W - half - margin, x));
  labelEl.style.transform = `translate(${cx}px, ${y}px) translate(-50%, -100%)`;
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
  cityCard.style.background = hexToCss(cityHex);
  cityCard.style.color = textColorFor(cityHex);
  cityCard.innerHTML = `
    <div class="name">${CITY_CONFIG.nameZh}</div>
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
    card.dataset.stem = d.stem;
    const hex = colorForDistrict(d.results);
    card.style.background = hexToCss(hex);
    card.style.color = textColorFor(hex);
    const count = villageCountByStem.get(d.stem) ?? '';
    const metaText = count ? `${count}里 ${d.margin.toFixed(1)}%` : `${d.margin.toFixed(1)}%`;
    card.innerHTML = `
      <div class="name">${d.name}</div>
      <div class="meta">${metaText}</div>`;
    card.title = `${d.winner} ${d.results[0]?.rate.toFixed(1)}%`;
    card.addEventListener('click', () => {
      // Not drilled / drilled into a different district → drill in.
      if (!drilledDistrict || drilledDistrict.slice(0, -1) !== d.stem) {
        drillByStem(d.stem);
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
    if (drilledDistrict && drilledDistrict.slice(0, -1) === d.stem) card.classList.add('active');
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
    vCard.style.background = hexToCss(hex);
    vCard.style.color = textColorFor(hex);
    vCard.innerHTML = `
      <div class="name">${v.villageName}</div>
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
function tweenCamera(toPos, toTarget, duration = 700) {
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
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
})();
