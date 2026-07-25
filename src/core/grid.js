import { AXES, CELL, FACES, H, N } from './constants.js';

// ---------- face / cell helpers ----------
export function faceIndexOf(normal){
  for (let i=0;i<FACES.length;i++) if (FACES[i].n.dot(normal) > 0.9) return i;
  return 2;
}
export function basisOf(normal){
  const perp = AXES.filter(a => Math.abs(a.dot(normal)) < 0.5 && (a.x+a.y+a.z) > 0);
  return [perp[0], perp[1]];
}
export function cellToPoint(faceIdx, u, v){
  const f = FACES[faceIdx];
  const [ta, tb] = basisOf(f.n);
  const p = f.n.clone().multiplyScalar(H);
  p.addScaledVector(ta, (u - (N-1)/2) * CELL);
  p.addScaledVector(tb, (v - (N-1)/2) * CELL);
  return p;
}
export function pointToCell(faceIdx, p){
  const [ta, tb] = basisOf(FACES[faceIdx].n);
  return {
    u: Math.round(p.dot(ta)/CELL + (N-1)/2),
    v: Math.round(p.dot(tb)/CELL + (N-1)/2)
  };
}
export const cellKey = (fi,u,v) => fi + ',' + u + ',' + v;

export function cellNeighbours(fi, u, v){
  const out = [];
  const n = FACES[fi].n, [ta, tb] = basisOf(n);
  const P0 = cellToPoint(fi, u, v);
  const tmp = new THREE.Vector3();
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
    out.push([nf, cc.u, cc.v, mk, d.clone()]);
  }
  return out;
}


export const railKey = p =>
  Math.round(p.x/(CELL/2)) + ',' + Math.round(p.y/(CELL/2)) + ',' + Math.round(p.z/(CELL/2));
