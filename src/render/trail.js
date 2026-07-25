import { G } from '../core/globals.js';
import { featureOn } from '../config/features.js';
import { isGoalObjective } from '../config/modes.js';
import { CELL, FACES } from '../core/constants.js';
import { cellKey, cellToPoint, faceIndexOf, pointToCell } from '../core/grid.js';
import { Nf, P, faceLift } from './player.js';
import { world } from './scene.js';
import { neighborsOf } from '../world/graph.js';
import { blocked, gems, holes, portals } from '../world/level.js';

// ---------- solution trail: the route, drawn as breadcrumbs ----------
// The pathfinding already exists (the clock is sized from it) — this just
// renders it. BFS with parent links so a route can be walked back.
export function bfsPaths(fi, u, v){
  const start = cellKey(fi,u,v);
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const q = [[fi,u,v]];
  for (let h = 0; h < q.length; h++){
    const [a,b,c] = q[h];
    const kFrom = cellKey(a,b,c);
    for (const [nf,nu,nv] of neighborsOf(a,b,c)){
      const k = cellKey(nf,nu,nv);
      if (dist.has(k) || blocked.has(k) || holes.has(k)) continue;
      dist.set(k, dist.get(kFrom) + 1);
      prev.set(k, kFrom);
      q.push([nf,nu,nv]);
    }
  }
  return { dist, prev };
}
export function tracePath(prev, target){
  const out = [];
  let k = target;
  while (k !== undefined){ out.push(k); k = prev.get(k); }
  return out.reverse();
}

// the route from where the player stands: the exit in maze mode, otherwise a
// greedy tour through whatever gems remain
export function computeRoute(){
  const fi = faceIndexOf(Nf);
  const c = pointToCell(fi, P);
  let cur = [fi, c.u, c.v];
  const route = [];
  // keystone awake: the goal is the keystone, not the gems (they're all gone)
  if (G.keystoneAwake && G.keystoneCell){
    const { prev } = bfsPaths(cur[0], cur[1], cur[2]);
    return tracePath(prev, G.keystoneCell);
  }
  if (isGoalObjective()){
    if (!G.finishKey) return route;
    const { prev } = bfsPaths(cur[0], cur[1], cur[2]);
    return tracePath(prev, G.finishKey);
  }
  const left = gems.filter(g => !g.taken);
  let guard = 0;
  while (left.length && guard++ < 40){
    const { dist, prev } = bfsPaths(cur[0], cur[1], cur[2]);
    let bi = -1, bd = Infinity;
    for (let i = 0; i < left.length; i++){
      const gc = pointToCell(left[i].face, left[i].pos);
      const d = dist.get(cellKey(left[i].face, gc.u, gc.v));
      if (d !== undefined && d < bd){ bd = d; bi = i; }
    }
    if (bi < 0) break;
    const g = left.splice(bi, 1)[0];
    const gc = pointToCell(g.face, g.pos);
    const leg = tracePath(prev, cellKey(g.face, gc.u, gc.v));
    route.push(...(route.length ? leg.slice(1) : leg));
    cur = [g.face, gc.u, gc.v];
  }
  return route;
}

export const trailGroup = new THREE.Group();
world.add(trailGroup);
export const dotGeo = new THREE.SphereGeometry(CELL*0.09, 10, 8);
export const dots = [];
export function clearTrail(){
  for (const d of dots) trailGroup.remove(d.mesh);
  dots.length = 0;
}
export function drawTrail(){
  clearTrail();
  if (!featureOn('solution') || G.phase !== 'play') return;
  const route = computeRoute();
  route.forEach((k, i) => {
    if (i === 0) return;                       // skip the cell we're standing on
    const [fi, u, v] = k.split(',').map(Number);
    // a portal on the route is a deliberate hop, not a walk-through — mark it
    const isPortal = portals.has(k);
    const mesh = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
      color: isPortal ? 0xffffff : 0x5c4a5e, transparent:true, opacity:0.5 }));
    mesh.position.copy(cellToPoint(fi, u, v))
      .addScaledVector(FACES[fi].n, CELL*0.22 + faceLift(fi));
    if (isPortal) mesh.scale.setScalar(1.6);
    trailGroup.add(mesh);
    dots.push({ mesh, i, base: isPortal ? 1.6 : 1 });
  });
}

