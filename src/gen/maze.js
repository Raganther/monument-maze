import { G } from '../core/globals.js';
import { CELL, FACES, H, N, _upY } from '../core/constants.js';
import { basisOf, cellKey, cellToPoint, faceIndexOf, pointToCell, railKey } from '../core/grid.js';
import { bfsFrom } from './fairness.js';
import { _planeZ } from '../mechanics/holes.js';
import { addRail } from '../render/rails.js';
import { rails } from '../world/level.js';

// ---------- maze mode: one perfect maze over the whole surface ----------
// Start with every seam walled (cube edges included), then carve a randomized
// depth-first spanning tree over all 216 cells. Result: every cell reachable,
// exactly one route between any two — the strongest solvability guarantee
// there is. Remaining walls become rails.
G.finishKey = null;

export function generateMaze(){
  const dirs = ['+u','-u','+v','-v'];
  const tmp = new THREE.Vector3();
  // enumerate every seam, keyed by midpoint (shared seams collapse, even
  // across cube edges) with one representative (face, cell, dir) for the mesh
  const wall = new Map();
  for (let fi = 0; fi < 6; fi++){
    const [ta, tb] = basisOf(FACES[fi].n);
    for (let u = 0; u < N; u++) for (let v = 0; v < N; v++){
      const c = cellToPoint(fi, u, v);
      for (const d of dirs){
        const ax = (d[1]==='u' ? ta : tb).clone().multiplyScalar(d[0]==='+' ? 1 : -1);
        const mk = railKey(tmp.copy(c).addScaledVector(ax, CELL/2));
        if (!wall.has(mk)) wall.set(mk, [fi, u, v, d]);
      }
    }
  }
  // randomized DFS carve from the start cell
  const visited = new Set([cellKey(2,2,2)]);
  const stack = [[2,2,2]];
  while (stack.length){
    const [fi, u, v] = stack[stack.length - 1];
    const n = FACES[fi].n, [ta, tb] = basisOf(n);
    const P0 = cellToPoint(fi, u, v);
    const opts = [];
    for (const base of [ta, tb]) for (const s of [1, -1]){
      const d = base.clone().multiplyScalar(s);
      const mk = railKey(tmp.copy(P0).addScaledVector(d, CELL/2));
      const cand = P0.clone().addScaledVector(d, CELL);
      const inside =
        Math.abs(cand.dot(ta)) <= H - CELL/2 + 1e-4 &&
        Math.abs(cand.dot(tb)) <= H - CELL/2 + 1e-4;
      let nf, cc;
      if (inside){ nf = fi; cc = pointToCell(fi, cand); }
      else {
        const toP = P0.clone().addScaledVector(d, CELL/2).addScaledVector(n, -CELL/2);
        nf = faceIndexOf(d); cc = pointToCell(nf, toP);
      }
      if (!visited.has(cellKey(nf, cc.u, cc.v))) opts.push([nf, cc.u, cc.v, mk]);
    }
    if (!opts.length){ stack.pop(); continue; }
    const [nf, nu, nv, mk] = opts[(Math.random()*opts.length)|0];
    wall.delete(mk);                                   // carve the passage
    visited.add(cellKey(nf, nu, nv));
    stack.push([nf, nu, nv]);
  }
  // register every wall key first, THEN build meshes — the end-context checks
  // (mitre vs flat) need to see the complete layout
  for (const mk of wall.keys()) rails.add(mk);
  for (const [, [fi, u, v, d]] of wall) addRail(fi, u, v, d);
}

// the finish sits at the farthest cell from the start along the maze
export function placeReachGoal(){
  const dist = bfsFrom(2, 2, 2);
  let bk = null, bd = -1;
  for (const [k, d] of dist) if (d > bd){ bd = d; bk = k; }
  G.finishKey = bk;
  const [fi, u, v] = bk.split(',').map(Number);
  const pos = cellToPoint(fi, u, v);
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(CELL*0.8, CELL*0.8),
    new THREE.MeshBasicMaterial({ color:0x66c7a5 }));
  tile.position.copy(pos).addScaledVector(FACES[fi].n, 0.015);
  tile.quaternion.setFromUnitVectors(_planeZ, FACES[fi].n);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(CELL*0.18, CELL*0.5, 4),
    new THREE.MeshLambertMaterial({ color:0x66c7a5, emissive:0x1f5f49, emissiveIntensity:0.6 }));
  cone.position.copy(pos).addScaledVector(FACES[fi].n, CELL*0.3);
  cone.quaternion.setFromUnitVectors(_upY, FACES[fi].n);
  G.levelGroup.add(tile, cone);
}

