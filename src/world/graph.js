import { CELL, FACES, H, N } from '../core/constants.js';
import { basisOf, cellKey, cellToPoint, faceIndexOf, pointToCell, railKey } from '../core/grid.js';
import { blocked, holes, oneways, pathCells, pathFaces, portals, rails } from './level.js';

export function walkable(faceIdx, u, v){
  if (blocked.has(cellKey(faceIdx, u, v))) return false;
  if (pathFaces.has(faceIdx) && !pathCells.has(cellKey(faceIdx, u, v))) return false;
  return true;
}

// ---------- surface graph ----------
// Neighbours in the true movement graph. NOTE: any feature that changes how
// the player moves MUST be taught here — the solvability check, the clock, and
// the solution trail all walk this graph. If it lies, they all lie.
export function neighborsOf(fi, u, v, _hops){
  const out = [];
  // stepping onto a portal doesn't let you walk on from it: it delivers you to
  // the partner, so this cell's real exits are the partner's exits.
  const here = cellKey(fi, u, v);
  const link = portals.get(here);
  if (link && link.pair && (_hops || 0) < 4){
    const [pf, pu, pv] = link.pair.split(',').map(Number);
    return neighborsOf(pf, pu, pv, (_hops || 0) + 1);
  }
  // one-way cell: you may only leave in the arrow's direction. This makes the
  // graph DIRECTED — the solvability check, clock, and solution trail all walk
  // this same function, so teaching it here keeps all three honest.
  const oneWay = oneways.get(here);
  const n = FACES[fi].n;
  const [ta, tb] = basisOf(n);
  const P0 = cellToPoint(fi, u, v);
  for (const base of [ta, tb]){
    for (const s of [1, -1]){
      const d = base.clone().multiplyScalar(s);
      // one-way: skip any exit that isn't the permitted direction
      if (oneWay && d.dot(oneWay) < 0.9) continue;
      // a rail on this seam severs the connection
      if (rails.has(railKey(P0.clone().addScaledVector(d, CELL/2)))) continue;
      const cand = P0.clone().addScaledVector(d, CELL);
      const inside =
        Math.abs(cand.dot(ta)) <= H - CELL/2 + 1e-4 &&
        Math.abs(cand.dot(tb)) <= H - CELL/2 + 1e-4;
      if (inside){
        const c = pointToCell(fi, cand);
        out.push([fi, c.u, c.v]);
      } else {
        const toP = P0.clone().addScaledVector(d, CELL/2).addScaledVector(n, -CELL/2);
        const nf = faceIndexOf(d);
        const c = pointToCell(nf, toP);
        out.push([nf, c.u, c.v]);
      }
    }
  }
  return out;
}

export function surfaceConnected(){
  const total = 6*N*N - blocked.size - holes.size;
  const startK = cellKey(2,2,2);
  if (blocked.has(startK)) return false;
  const seen = new Set([startK]);
  const stack = [[2,2,2]];
  while (stack.length){
    const [fi,u,v] = stack.pop();
    for (const [nf,nu,nv] of neighborsOf(fi,u,v)){
      const k = cellKey(nf,nu,nv);
      if (seen.has(k) || blocked.has(k) || holes.has(k)) continue;
      seen.add(k); stack.push([nf,nu,nv]);
    }
  }
  return seen.size === total;
}

