import { G } from '../core/globals.js';
import { CELL, FACES, N } from '../core/constants.js';
import { basisOf, cellKey, cellToPoint } from '../core/grid.js';
import { faceLift } from '../render/player.js';
import { neighborsOf } from '../world/graph.js';
import { blocked, holes, onewayMeshes, oneways, portals } from '../world/level.js';

// ---------- one-way tiles ----------
// Arrows you can only cross in one direction. This makes the movement graph
// DIRECTED, so placement must preserve reachability: after adding an arrow we
// run a directed flood-fill from the start and reject it if it strands any
// cell. Undirected connectivity is no longer enough.
export function directedReachCount(){
  const start = cellKey(2,2,2);
  const seen = new Set([start]);
  const q = [[2,2,2]];
  for (let h = 0; h < q.length; h++){
    const [a,b,c] = q[h];
    for (const [nf,nu,nv] of neighborsOf(a,b,c)){
      const k = cellKey(nf,nu,nv);
      if (seen.has(k) || blocked.has(k) || holes.has(k)) continue;
      seen.add(k); q.push([nf,nu,nv]);
    }
  }
  return seen.size;
}
export function totalWalkable(){
  let n = 0;
  for (let fi=0; fi<6; fi++) for (let u=0; u<N; u++) for (let v=0; v<N; v++){
    const k = cellKey(fi,u,v);
    if (!blocked.has(k) && !holes.has(k)) n++;
  }
  return n;
}
// how many cells can reach the start (reverse reachability). Combined with
// forward reachability, this proves strong connectivity: if every cell reaches
// start AND start reaches every cell, then any cell can reach any other —
// which is what a gem TOUR needs, not just single-target reachability.
export function reverseReachCount(){
  // BFS on the REVERSED directed graph: cell X can reach start iff start is
  // reachable following edges backward from... easier: find all cells that can
  // reach start by checking, for each cell, whether start is forward-reachable.
  // Cheaper: build reverse adjacency once and flood from start.
  const revAdj = new Map();
  const cells = [];
  for (let fi=0; fi<6; fi++) for (let u=0; u<N; u++) for (let v=0; v<N; v++){
    const k = cellKey(fi,u,v);
    if (blocked.has(k) || holes.has(k)) continue;
    cells.push([fi,u,v]);
  }
  for (const [fi,u,v] of cells){
    for (const [nf,nu,nv] of neighborsOf(fi,u,v)){
      const nk = cellKey(nf,nu,nv);
      if (blocked.has(nk) || holes.has(nk)) continue;
      if (!revAdj.has(nk)) revAdj.set(nk, []);
      revAdj.get(nk).push(cellKey(fi,u,v));    // edge fi->nf reversed
    }
  }
  const start = cellKey(2,2,2);
  const seen = new Set([start]);
  const q = [start];
  for (let h = 0; h < q.length; h++){
    for (const p of (revAdj.get(q[h]) || [])){
      if (!seen.has(p)){ seen.add(p); q.push(p); }
    }
  }
  return seen.size;
}
export function generateOneWays(count){
  const target = totalWalkable();
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 30){
    tries++;
    const fi = (Math.random()*6)|0, u = (Math.random()*N)|0, v = (Math.random()*N)|0;
    const k = cellKey(fi,u,v);
    if (fi === 2 && u === 2 && v === 2) continue;
    if (blocked.has(k) || holes.has(k) || oneways.has(k) || portals.has(k)) continue;
    const exits = neighborsOf(fi, u, v);
    if (exits.length < 2) continue;            // don't trap dead-ends
    const [ta, tb] = basisOf(FACES[fi].n);
    const dirs = [ta, ta.clone().negate(), tb, tb.clone().negate()];
    const dir = dirs[(Math.random()*4)|0];
    oneways.set(k, dir);
    // STRONG connectivity: start reaches all AND all reach start. Only then can
    // a gem tour always continue from wherever it currently stands.
    if (directedReachCount() < target || reverseReachCount() < target){
      oneways.delete(k);                        // would strand the tour — reject
      continue;
    }
    placed++;
  }
}

// draw a chevron arrow on each one-way cell, pointing the way you may leave
export const onewayGeo = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0.30, 0); shape.lineTo(-0.18, 0.24); shape.lineTo(-0.06, 0);
  shape.lineTo(-0.18, -0.24); shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();
export const onewayMat = new THREE.MeshBasicMaterial({
  color:0xf5b942, transparent:true, opacity:0.9, side:THREE.DoubleSide,
  depthWrite:false });
export function drawOneways(){
  for (const [k, dir] of oneways){
    const [fi, u, v] = k.split(',').map(Number);
    const n = FACES[fi].n;
    const base = cellToPoint(fi, u, v);
    const m = new THREE.Mesh(onewayGeo, onewayMat);
    m.position.copy(base).addScaledVector(n, CELL*0.04 + faceLift(fi));
    const zAxis = n.clone();
    const xAxis = dir.clone().normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    m.scale.setScalar(CELL * 0.95);
    G.levelGroup.add(m);
    onewayMeshes.push(m);
  }
}

