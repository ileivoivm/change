// home-canvas.js — Taiwan voxel backdrop for the home screen.
// Pre-computed voxel positions (tw-home-voxels.json) are rendered with the
// same Three.js style as the city pages: BoxGeometry + InstancedMesh +
// ambient/directional lighting. Static single-frame render (no animation loop).

import * as THREE from 'three';
import voxelData from '../data/processed/tw-home-voxels.json';

// ── Visual constants ───────────────────────────────────────────────────────────
const VOXEL_H     = 0.55;           // voxel height (flat-ish for backdrop feel)
const VOXEL_COLOR = 0xc9c3b8;       // warm neutral gray — same family as page bg
const AMB_COLOR   = 0xfff8ee;       // warm ambient light
const DIR_COLOR   = 0xfffcf0;       // slightly warm directional light
const DIR_POS     = [22, 60, 18];   // light from upper-right front

// Canvas aspect: slightly wider than portrait to give the angled 3D view room
export const TW_ASPECT = 0.65;

export function initHomeCanvas(canvasEl) {
  if (!canvasEl) return null;

  // ── Canvas size ──────────────────────────────────────────────────────────────
  const dpr = Math.min(window.devicePixelRatio, 2);
  const isMobile = window.innerWidth < 640;
  let cssW, cssH;
  if (isMobile) {
    cssW = window.innerWidth;
    cssH = Math.round(cssW / TW_ASPECT);
  } else {
    cssH = window.innerHeight;
    cssW = Math.round(cssH * TW_ASPECT);
  }

  canvasEl.style.width  = cssW + 'px';
  canvasEl.style.height = cssH + 'px';
  canvasEl.width  = cssW * dpr;
  canvasEl.height = cssH * dpr;

  // ── Renderer ────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(cssW, cssH, false);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;

  // ── Scene ───────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();

  // Lighting — same warm two-light rig as city pages
  scene.add(new THREE.AmbientLight(AMB_COLOR, 0.85));
  const dirLight = new THREE.DirectionalLight(DIR_COLOR, 1.1);
  dirLight.position.set(...DIR_POS);
  scene.add(dirLight);

  // ── Camera: perspective, elevated south-east view ───────────────────────────
  // Taiwan in our projection spans roughly X: ±14, Z: -25 to +26
  const aspect = cssW / cssH;
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 500);
  // Position: elevated, slightly south-east of center so the island "floats"
  camera.position.set(14, 50, 62);
  camera.lookAt(2, 0, 2);

  // ── InstancedMesh ────────────────────────────────────────────────────────────
  const { cell, cells } = voxelData;
  const geo = new THREE.BoxGeometry(cell * 0.93, VOXEL_H, cell * 0.93);
  const mat = new THREE.MeshLambertMaterial({ color: VOXEL_COLOR });
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);

  const m4 = new THREE.Matrix4();
  cells.forEach(([x, z], i) => {
    m4.makeTranslation(x, VOXEL_H / 2, z);
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // ── Render (static) ─────────────────────────────────────────────────────────
  renderer.render(scene, camera);
  return renderer;
}
