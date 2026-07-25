import { G } from '../core/globals.js';
import { FACES, HOLE_DEPTH, HOLE_OPEN, N, _upY } from '../core/constants.js';
import { basisOf, cellKey, cellToPoint } from '../core/grid.js';
import { surfaceConnected } from '../world/graph.js';
import { blocked, holeList, holes } from '../world/level.js';

export const shaftWallMat = new THREE.MeshLambertMaterial({ color:0x2c2536, side:THREE.DoubleSide });
export const shaftFloorMat = new THREE.MeshLambertMaterial({ color:0x140f1e });

export function addHole(faceIdx, u, v){
  holes.add(cellKey(faceIdx, u, v));
  holeList.push([faceIdx, u, v]);
  const n = FACES[faceIdx].n;
  const [ta, tb] = basisOf(n);
  const base = cellToPoint(faceIdx, u, v);        // opening, flush with the face
  const q = new THREE.Quaternion().setFromUnitVectors(_upY, n);

  // four walls descending inward
  const wallGeo = new THREE.PlaneGeometry(HOLE_OPEN, HOLE_DEPTH);
  for (const [dir, side] of [[ta,1],[ta,-1],[tb,1],[tb,-1]]){
    const w = new THREE.Mesh(wallGeo, shaftWallMat);
    w.position.copy(base)
      .addScaledVector(dir, side * HOLE_OPEN/2)
      .addScaledVector(n, -HOLE_DEPTH/2);
    // plane's +z should face inward (toward shaft center = -dir*side)
    const zAxis = dir.clone().multiplyScalar(-side);
    const yAxis = n.clone().multiplyScalar(-1);    // down the shaft
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
    w.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    G.levelGroup.add(w);
  }
  // floor at the bottom
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HOLE_OPEN, HOLE_OPEN), shaftFloorMat);
  floor.position.copy(base).addScaledVector(n, -HOLE_DEPTH);
  floor.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_planeZ, n));
  G.levelGroup.add(floor);
}
export const _planeZ = new THREE.Vector3(0,0,1);

// same discipline again: a hole that would sever the only route is rejected
export function generateHoles(count){
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 40){
    const fi = (Math.random()*6)|0;
    const u = (Math.random()*N)|0, v = (Math.random()*N)|0;
    if (fi === 2 && u === 2 && v === 2) continue;
    const k = cellKey(fi,u,v);
    if (blocked.has(k) || holes.has(k) || k === G.finishKey) continue;
    holes.add(k);
    if (!surfaceConnected()){ holes.delete(k); continue; }
    holes.delete(k);
    addHole(fi, u, v);
    placed++;
  }
}

// bridges: hollow arches — pass through along the axis, the legs wall the sides.
// The side-blocking IS the rail system: each bridge adds its two side seams to
// the rails set, so movement rules and connectivity checks come for free.
// The deck sits at block height, ready to become walkable when layers arrive.
