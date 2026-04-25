// home-canvas.js — Taiwan outline map rendered with Three.js for the home screen.
// Style: clean 2D editorial outline (à la Benesse/ANDO gallery access maps).
// Uses tw-outline.geo.json (outer ring of each county/city polygon).
//
// Render layers:
//   1. Filled polygon mesh  — slightly lighter than page background, creates
//      the "island as white form" effect the reference maps use.
//   2. Outline LineSegments — muted olive-green, thin & crisp.

import * as THREE from 'three';
import twOutline from '../data/processed/tw-outline.geo.json';

// ── Visual constants ───────────────────────────────────────────────────────────
const FILL_COLOR    = 0xd9d3ca;  // slightly lighter than page bg #c5bdb1
const OUTLINE_COLOR = 0x4e7860;  // muted forest-green (matches reference hue)
const FILL_OPACITY  = 0.82;
const LINE_OPACITY  = 0.80;

// Canvas aspect (width / height). Wider than the raw island (0.47) to give
// breathing room for Penghu/Matsu/Kinmen and left/right margins.
export const TW_ASPECT = 0.72;

export function initHomeCanvas(canvasEl) {
  if (!canvasEl) return null;

  // ── Canvas size ──────────────────────────────────────────────────────────────
  // Desktop: portrait, full-viewport-height on the right side.
  // Mobile:  landscape island, full-viewport-width centered as watermark.
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
  renderer.setSize(cssW, cssH, false);   // false = don't touch CSS dimensions
  renderer.setClearColor(0x000000, 0);   // fully transparent

  // ── Orthographic camera: looking along -Z, Y = north ───────────────────────
  const worldH = 60;
  const worldW = worldH * (cssW / cssH);  // match actual canvas aspect
  const camera = new THREE.OrthographicCamera(
    -worldW / 2,  worldW / 2,
     worldH / 2, -worldH / 2,
    0.1, 100
  );
  camera.position.z = 50;

  const scene = new THREE.Scene();

  // ── Projection: lon/lat → world XY (Y-up, north = +Y) ─────────────────────
  // Hard-coded on Taiwan's main island so Kinmen/Matsu (far west) don't shift
  // the center and shrink the main body. Offshore islands still render in their
  // correct relative positions.
  const cLon = 121.0;   // main island center longitude
  const cLat = 23.65;   // main island center latitude
  const kLat = 111;
  const kLon = 111 * Math.cos(cLat * Math.PI / 180);
  // Scale: fit ~3.5° lat (main island height ≈ 389 km) in 88% of world height
  const scale = (worldH * 0.88) / (3.5 * kLat);

  function proj(lon, lat) {
    return [
      (lon - cLon) * kLon * scale,
      (lat - cLat) * kLat * scale,   // +Y = north
    ];
  }

  // ── Layer 1: filled polygons (island form) ──────────────────────────────────
  const fillMat = new THREE.MeshBasicMaterial({
    color: FILL_COLOR,
    transparent: true,
    opacity: FILL_OPACITY,
    side: THREE.DoubleSide,
  });
  for (const f of twOutline.features) {
    const coords = f.geometry.coordinates;
    if (coords.length < 3) continue;

    const shape = new THREE.Shape();
    const [x0, y0] = proj(coords[0][0], coords[0][1]);
    shape.moveTo(x0, y0);
    for (let i = 1; i < coords.length; i++) {
      const [xi, yi] = proj(coords[i][0], coords[i][1]);
      shape.lineTo(xi, yi);
    }
    shape.closePath();

    const geom = new THREE.ShapeGeometry(shape);
    geom.translate(0, 0, -0.5); // slightly behind the outline
    scene.add(new THREE.Mesh(geom, fillMat));
  }

  // ── Layer 2: outlines (county rings as LineSegments) ───────────────────────
  const lineVerts = [];
  for (const f of twOutline.features) {
    const coords = f.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x0, y0] = proj(coords[i][0],     coords[i][1]);
      const [x1, y1] = proj(coords[i + 1][0], coords[i + 1][1]);
      lineVerts.push(x0, y0, 0,  x1, y1, 0);
    }
    // close the ring
    const last  = coords[coords.length - 1];
    const first = coords[0];
    const [xl, yl] = proj(last[0],  last[1]);
    const [xf, yf] = proj(first[0], first[1]);
    lineVerts.push(xl, yl, 0,  xf, yf, 0);
  }
  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: OUTLINE_COLOR,
    transparent: true,
    opacity: LINE_OPACITY,
  });
  scene.add(new THREE.LineSegments(lineGeom, lineMat));

  // ── Render (static — no animation loop needed) ─────────────────────────────
  renderer.render(scene, camera);

  return renderer;
}
