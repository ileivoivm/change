// Minimal geo helpers for projecting lon/lat to a local XZ plane
// and sampling polygons onto a voxel grid.

export function computeBounds(features) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of features) {
    eachPolygonRing(f.geometry, ring => {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    });
  }
  return { minLon, maxLon, minLat, maxLat };
}

export function eachPolygonRing(geom, fn) {
  if (!geom) return;
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) fn(ring);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) for (const ring of poly) fn(ring);
  }
}

// Build a projector that maps lon/lat → world XZ with uniform scale,
// centered at origin and fitting within `worldSize` on the longer axis.
export function makeProjector(bounds, worldSize = 40) {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const cLon = (minLon + maxLon) / 2;
  const cLat = (minLat + maxLat) / 2;
  const kLat = 111; // km per degree lat
  const kLon = 111 * Math.cos((cLat * Math.PI) / 180);
  const widthKm = (maxLon - minLon) * kLon;
  const heightKm = (maxLat - minLat) * kLat;
  const scale = worldSize / Math.max(widthKm, heightKm);

  return {
    scale,
    widthKm,
    heightKm,
    project([lon, lat]) {
      const x = (lon - cLon) * kLon * scale;
      const z = -(lat - cLat) * kLat * scale; // north → -Z
      return [x, z];
    },
  };
}

// Ray-casting point-in-polygon for a [[x,z],...] ring
function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersect = (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Project a feature's geometry to projected rings (outer and holes).
// Returns polygons: [{outer, holes: [...]}], each already in world XZ.
export function projectFeature(feature, projector) {
  const polys = [];
  const push = (poly) => {
    const rings = poly.map(ring => ring.map(p => projector.project(p)));
    polys.push({ outer: rings[0], holes: rings.slice(1) });
  };
  const g = feature.geometry;
  if (!g) return polys;
  if (g.type === 'Polygon') push(g.coordinates);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach(push);
  return polys;
}

export function pointInPolys(x, z, polys) {
  for (const { outer, holes } of polys) {
    if (pointInRing(x, z, outer)) {
      let inHole = false;
      for (const h of holes) if (pointInRing(x, z, h)) { inHole = true; break; }
      if (!inHole) return true;
    }
  }
  return false;
}

// Voxelize: returns array of [x, z] center coordinates (world) of cells
// inside the polygon, on an axis-aligned grid with `cell` size.
export function voxelize(polys, cell) {
  if (polys.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const { outer } of polys) {
    for (const [x, z] of outer) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  const ix0 = Math.floor(minX / cell);
  const ix1 = Math.ceil(maxX / cell);
  const iz0 = Math.floor(minZ / cell);
  const iz1 = Math.ceil(maxZ / cell);
  const cells = [];
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = (ix + 0.5) * cell;
      const z = (iz + 0.5) * cell;
      if (pointInPolys(x, z, polys)) cells.push([x, z]);
    }
  }
  return cells;
}
