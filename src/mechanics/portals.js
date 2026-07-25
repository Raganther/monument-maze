import { G } from '../core/globals.js';
import { CELL, FACES, HOLE_DEPTH, HOLE_OPEN, N } from '../core/constants.js';
import { basisOf, cellKey, cellToPoint } from '../core/grid.js';
import { _planeZ } from './holes.js';
import { blocked, bridged, holes, oneways, portalFX, portalList, portals } from '../world/level.js';

// ---------- portals: linked doorways, matching colours connect ----------
// Built like holes (a cut opening over a recessed shaft) but tinted per pair.
// Step in, sink, and rise out of the partner — the cube swivels to present
// the destination face. Portals only ADD connectivity, so every solvability
// guarantee holds untouched.
export const PORTAL_COLORS = [0xe8608a, 0x4fb3bf, 0xe0a83c, 0x8f6fd6];
export const LIGHT_H = CELL * 1.3;
export const portalLightGeo = new THREE.PlaneGeometry(HOLE_OPEN, LIGHT_H);
// vertical fade: opaque at the mouth, dissolving into the air at the top
export const lightGradTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0,    'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();

export function addPortalCell(fi, u, v, wallMat, floorMat, col){
  const n = FACES[fi].n;
  const [ta, tb] = basisOf(n);
  const base = cellToPoint(fi, u, v);
  const wallGeo = new THREE.PlaneGeometry(HOLE_OPEN, HOLE_DEPTH);
  for (const [dir, side] of [[ta,1],[ta,-1],[tb,1],[tb,-1]]){
    const w = new THREE.Mesh(wallGeo, wallMat);
    w.position.copy(base)
      .addScaledVector(dir, side * HOLE_OPEN/2)
      .addScaledVector(n, -HOLE_DEPTH/2);
    const zAxis = dir.clone().multiplyScalar(-side);
    const yAxis = n.clone().multiplyScalar(-1);
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
    w.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    G.levelGroup.add(w);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HOLE_OPEN, HOLE_OPEN), floorMat);
  floor.position.copy(base).addScaledVector(n, -HOLE_DEPTH);
  floor.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_planeZ, n));
  G.levelGroup.add(floor);
  // light rising straight out of the opening: four planes matching the shaft
  // walls, brightest at the mouth, fading naturally into the air. Where they
  // meet, the additive blend doubles — the column's corners shine brightest.
  const lightMat = new THREE.MeshBasicMaterial({
    color: col, map: lightGradTex, transparent:true, opacity:0.32,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
  for (const [dir, side] of [[ta,1],[ta,-1],[tb,1],[tb,-1]]){
    const p = new THREE.Mesh(portalLightGeo, lightMat);
    p.position.copy(base)
      .addScaledVector(dir, side * HOLE_OPEN/2)
      .addScaledVector(n, LIGHT_H/2);
    const zAxis = dir.clone().multiplyScalar(side);
    const xAxis = new THREE.Vector3().crossVectors(n, zAxis);
    p.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, n, zAxis));
    G.levelGroup.add(p);
  }
  const light = new THREE.PointLight(col.getHex(), 0.45, 2.8, 2);
  light.position.copy(base).addScaledVector(n, 0.5);
  G.levelGroup.add(light);
  portalFX.set(cellKey(fi,u,v), { lightMat, light, flare:0 });
}

export function generatePortals(pairs){
  const free = () => {
    for (let t = 0; t < 60; t++){
      const fi = (Math.random()*6)|0, u = (Math.random()*N)|0, v = (Math.random()*N)|0;
      const k = cellKey(fi,u,v);
      if (fi === 2 && u === 2 && v === 2) continue;
      if (blocked.has(k) || holes.has(k) || bridged.has(k) || portals.has(k)
          || oneways.has(k) || k === G.finishKey) continue;
      return { fi, u, v, k };
    }
    return null;
  };
  for (let i = 0; i < pairs; i++){
    const a = free(); if (!a) return;
    portals.set(a.k, {});                        // reserve before drawing b
    const b = free();
    if (!b){ portals.delete(a.k); return; }
    portals.set(a.k, { pair: b.k });
    portals.set(b.k, { pair: a.k });
    portalList.push([a.fi,a.u,a.v], [b.fi,b.u,b.v]);
    const col = new THREE.Color(PORTAL_COLORS[i % PORTAL_COLORS.length]);
    const note = [329.63, 392.00, 440.00, 523.25][i % 4];   // E4 G4 A4 C5
    const wallMat = new THREE.MeshLambertMaterial({
      color: col.clone().multiplyScalar(0.5), side: THREE.DoubleSide });
    const floorMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.3) });
    addPortalCell(a.fi, a.u, a.v, wallMat, floorMat, col);
    addPortalCell(b.fi, b.u, b.v, wallMat, floorMat, col);
    portalFX.get(a.k).note = note;
    portalFX.get(b.k).note = note;
  }
}

