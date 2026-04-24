import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeBounds, makeProjector, projectFeature, voxelize } from './geo.js';
import { colorForDistrict, partyColor, NEUTRAL } from './palette.js';
import ntpcGeo from '../data/processed/ntpc-districts.geo.json';
import tpeGeo from '../data/processed/tpe-districts.geo.json';
import restGeo from '../data/processed/tw-rest-districts.geo.json';
import villageGeo from '../data/processed/ntpc-villages.geo.json';
import v1997 from '../data/processed/ntpc-1997-villages.json';
import v2001 from '../data/processed/ntpc-2001-villages.json';
import v2005 from '../data/processed/ntpc-2005-villages.json';
import v2010 from '../data/processed/ntpc-2010-villages.json';
import v2014 from '../data/processed/ntpc-2014-villages.json';
import v2018 from '../data/processed/ntpc-2018-villages.json';
import v2022 from '../data/processed/ntpc-2022-villages.json';

const VILLAGE_ELECTIONS = {
  1997: v1997, 2001: v2001, 2005: v2005, 2010: v2010,
  2014: v2014, 2018: v2018, 2022: v2022,
};
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

const ELECTIONS = { 1997: e1997, 2001: e2001, 2005: e2005, 2010: e2010, 2014: e2014, 2018: e2018, 2022: e2022 };
const YEARS = [1997, 2001, 2005, 2010, 2014, 2018, 2022];
let currentYear = 2022;

const VOXEL_CELL = 0.45;
const VILLAGE_CELL = 0.20;
const VOXEL_HEIGHT = 0.9;
const CONTEXT_HEIGHT = 0.25;
const WORLD_SIZE = 36; // NTPC+TPE spans this longer axis
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
camera.position.set(-13.19, 98.58, 30.58);

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
controls.target.set(-12.71, -8.73, 12.83);

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
  const isContext = layer !== 'ntpc';
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
    const election = layer === 'ntpc' ? electionByStem[stem] : null;

    let baseColor;
    if (layer === 'ntpc') {
      baseColor = election ? colorForDistrict(election.results) : NEUTRAL;
    } else {
      // context layers (tpe / rest) → soft gray
      baseColor = layer === 'tpe' ? 0xb8b2a6 : 0xbab5a8;
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
  const allFeatures = [...ntpcGeo.features, ...tpeGeo.features];
  const bounds = computeBounds(allFeatures);
  const projector = makeProjector(bounds, WORLD_SIZE);

  // Rest of Taiwan first (drawn behind visually due to lower height)
  const restCount = buildLayer(restGeo.features, projector, {
    height: CONTEXT_HEIGHT,
    layer: 'rest',
    interactive: false,
  });
  const tpeCount = buildLayer(tpeGeo.features, projector, {
    height: CONTEXT_HEIGHT,
    layer: 'tpe',
    interactive: true,
  });
  const ntpcCount = buildLayer(ntpcGeo.features, projector, {
    height: VOXEL_HEIGHT,
    layer: 'ntpc',
    interactive: true,
  });

  buildBorders();
  villageGroup = buildVillageLayer(projector);
  refreshHud(ntpcCount, tpeCount, restCount);
}

// Track NTPC district meshes so we can hide them when switching to village mode.
function isNtpcDistrictMesh(m) {
  return m.userData?.layer === 'ntpc';
}

function setViewMode(mode) {
  if (mode === viewMode) return;
  if (drilledDistrict) exitDrill(false); // cancel drill when user manually toggles
  viewMode = mode;
  const ntpcDistrictMeshes = districtMeshes.filter(isNtpcDistrictMesh);
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
  if (!mesh || mesh.userData.layer !== 'ntpc') return;
  // 1997/2001 CEC didn't publish village-level data — fall back to 2022
  // only for those. Other years (2005+) drill in place.
  if (!villageVotes.villages.length) setYear(2022);
  drilledDistrict = mesh.userData.townName;
  const stem = drilledDistrict.slice(0, -1);

  // hide every NTPC district mesh (including the clicked one)
  districtMeshes.filter(isNtpcDistrictMesh).forEach(m => m.visible = false);

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
  if (!drilledDistrict) {
    if (flyHome) tweenCamera(INITIAL_CAM_POS.clone(), INITIAL_TARGET.clone());
    setHover(null);
    writeUrl();
    return;
  }
  drilledDistrict = null;
  districtMeshes.filter(isNtpcDistrictMesh).forEach(m => m.visible = true);
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
    m => m.userData.layer === 'ntpc' && m.userData.townName.slice(0, -1) === stem
  );
  if (mesh) drillInto(mesh);
}

// Rebuild the left panel list (idempotent — safe to call after year change)
function rebuildVillagePanel() { renderPanel(); }

// Select a village (from panel): drill into its district, zoom closer, pin bubble
function selectVillage(v) {
  const key = v.townName.slice(0, -1) + '/' + v.villageName.slice(0, -1);
  const vm = villageMeshes.find(m => m.userData.villageKey === key);
  if (!vm) return;
  const townStem = v.townName.slice(0, -1);
  if (!drilledDistrict || drilledDistrict.slice(0, -1) !== townStem) {
    drillByStem(townStem);
  }
  panZoomWithPitch(vm.userData.centroid, 15, 42, (Math.random() - 0.5) * 100);
  sticky = false;
  setHover(vm);
  sticky = true;
  pulseMesh = vm;
  selectedVillageKey = key;
  updateCardState();
  layoutCards();
  writeUrl();
}

function unselectVillage() {
  if (!selectedVillageKey) return;
  selectedVillageKey = null;
  sticky = false;
  pulseMesh = null;
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
// Format: ?y=YYYY&d=中和&v=安和
// Year always written so 2022/2026/... are unambiguous in shared links.
function writeUrl() {
  const params = new URLSearchParams();
  params.set('y', String(currentYear));
  if (drilledDistrict) params.set('d', drilledDistrict.slice(0, -1));
  if (sticky && hovered?.userData?.layer === 'village') {
    params.set('v', hovered.userData.villageName.slice(0, -1));
  }
  const qs = params.toString();
  history.replaceState({}, '', qs ? `?${qs}` : location.pathname);
}

function parseAndApplyUrl() {
  const p = new URLSearchParams(location.search);
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

let hudVoxelCounts = { ntpc: 0, tpe: 0, rest: 0 };
function refreshHud(ntpc, tpe, rest) {
  if (ntpc !== undefined) hudVoxelCounts = { ntpc, tpe, rest };
  const data = ELECTIONS[currentYear];
  const topTwo = data.overall?.results?.slice(0, 2) || [];
  const vs = topTwo.map(r => `${r.name}（${r.partyName.replace(/(黨|中國|民主|主黨|中國國)/g, '').slice(0, 2) || r.partyName}）`).join(' vs ');
  hud.innerHTML = `<b>${data.election}</b><br />
    ${vs}<br />
    <span style="opacity:.6">新北 ${hudVoxelCounts.ntpc} · 台北 ${hudVoxelCounts.tpe} · 其他 ${hudVoxelCounts.rest} 方塊</span>`;
}

try {
  bootstrap();
  buildTimeline();
  updateTimelineActive();
  buildVillagePanel();
  wireViewToggle();
  parseAndApplyUrl();
} catch (err) {
  hud.innerHTML = `<b>載入失敗</b><br />${err.message}`;
  console.error(err);
}

// ─────────── hover + floating label ───────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerInside = false;

const labelEl = document.getElementById('label');
const labelBubble = labelEl.querySelector('.bubble');
const tmpVec = new THREE.Vector3();

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  pointerInside = true;
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
    // district mode: click an NTPC district to drill
    const targets = districtMeshes.filter(m => m.userData.layer === 'ntpc' && m.visible);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (hit) drillInto(hit.object);
  } else {
    // drilled: single-click a village to highlight + pin; empty click only
    // unselects. Never exits drill (use 新北市 / Home / ESC for that).
    const targets = villageMeshes.filter(m => m.visible);
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
  }
});

// Double-click on a village → pin bubble + glow + URL update
renderer.domElement.addEventListener('dblclick', (e) => {
  const p = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
  raycaster.setFromCamera(p, camera);
  const hits = raycaster.intersectObjects(villageMeshes.filter(m => m.visible), false);
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
      labelBubble.innerHTML = `<div class="row"><span class="tag">新北市 ${tName}</span><span class="name">${vName}</span></div>
        <div class="sub">查無里級資料</div>`;
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

    labelBubble.innerHTML = `
      <div class="row"><span class="tag">${tName}</span><span class="name">${vName}</span></div>
      <div class="winner" style="color:${winColor}">${v.winner} 勝 ${v.margin.toFixed(1)}%</div>
      <div class="cands">${rows}</div>
      ${flipBlock}`;
    return;
  }

  const tag = mesh.userData.layer === 'tpe' ? '台北市'
    : mesh.userData.layer === 'rest' ? mesh.userData.countyName
    : '新北市';

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
  const targets = viewMode === 'village'
    ? [...districtMeshes.filter(m => m.userData.layer !== 'ntpc'), ...villageMeshes]
    : districtMeshes;
  const hits = raycaster.intersectObjects(targets, false);
  setHover(hits.length > 0 ? hits[0].object : null);
}

function updateLabelPosition() {
  if (!hovered) return;
  tmpVec.copy(hovered.userData.centroid);
  tmpVec.y += hovered.position.y + 0.3;
  tmpVec.project(camera);
  const x = (tmpVec.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
  labelEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
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
  const meta = overall
    ? `${overall.name.slice(0, 1)} ${overall.rate.toFixed(0)}% ${abbrParty(overall.partyName)}`
    : '無資料';
  cityCard.innerHTML = `
    <div class="name">新北市</div>
    <div class="meta">${data.year} · ${meta}</div>`;
  cityCard.title = '回到全局視角';
  cityCard.addEventListener('click', () => { sticky = false; exitDrill(true); });
  listEl.appendChild(cityCard);

  // ── district tiles ──
  const districts = data.districts.slice().sort((a, b) => a.area.localeCompare(b.area));

  const villageCountByStem = new Map();
  const src = villageVotes.villages.length ? villageVotes.villages : v2022.villages;
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
    card.addEventListener('click', () => drillByStem(d.stem));
    if (drilledDistrict && drilledDistrict.slice(0, -1) === d.stem) card.classList.add('active');
    listEl.appendChild(card);
  }

  layoutCards();

  // Repopulate village cards if we're still drilled (e.g. year change while drilled)
  if (drilledDistrict) renderVillagesFor(drilledDistrict.slice(0, -1));
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

  const cols = 5;
  const tileW = 180, tileH = 106, gap = 6;
  const cityH = 141, cityGap = 10;
  const rows = Math.ceil(districts.length / cols);
  const gridW = cols * tileW + (cols - 1) * gap;
  const gridH = rows * tileH + (rows - 1) * gap;
  const totalH = cityH + cityGap + gridH;
  const gridStartX = Math.round((W - gridW) / 2);
  const gridStartY = Math.round((H - totalH) / 2);

  // Breadcrumb geometry (only used when drilled)
  const bcCityW = 240, bcChipW = 192, bcH = 77, bcGap = 10;
  const hasVillageChip = drilled && !!selectedVillageKey;
  const bcTotalW = bcCityW + bcGap + bcChipW + (hasVillageChip ? bcGap + bcChipW : 0);
  const bcStartX = Math.round((W - bcTotalW) / 2);
  const bcY = 32;
  const bcVillageX = bcStartX + bcCityW + bcGap + bcChipW + bcGap;

  if (drilled) {
    city.classList.add('compact');
    city.style.left = bcStartX + 'px';
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
  const villageCards = Array.from(document.querySelectorAll('.card-village:not(.clearing)'));
  if (drilled && villageCards.length > 0) {
    const n = villageCards.length;
    const vCols = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(n))));
    const vTileW = 125, vTileH = 70, vGap = 5;
    const vGridW = vCols * vTileW + (vCols - 1) * vGap;
    const vStartX = Math.round((W - vGridW) / 2);
    const vStartY = bcY + bcH + 20;
    for (let i = 0; i < n; i++) {
      const card = villageCards[i];
      if (selectedVillageKey && card.dataset.villageKey === selectedVillageKey) {
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

function setYear(newYear) {
  if (!ELECTIONS[newYear] || newYear === currentYear) return;
  // Full reset on year change — close any drill / selection, clear hover so
  // we re-render the panel from scratch without stale card state.
  if (drilledDistrict || selectedVillageKey || sticky) exitDrill(true);
  currentYear = newYear;
  electionByStem = rebuildElectionByStem(newYear);
  villageVoteMap = rebuildVillageVoteMap(newYear);
  const now = performance.now();

  // District color tween
  for (const mesh of districtMeshes) {
    if (mesh.userData.layer !== 'ntpc') continue;
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

compassEl.addEventListener('click', () => {
  const dist = 42;
  const pitch = Math.PI * 0.30;
  const y = dist * Math.sin(pitch);
  const planar = dist * Math.cos(pitch);
  tweenCamera(
    new THREE.Vector3(0, y, -planar),
    new THREE.Vector3(0, 0, 0)
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
