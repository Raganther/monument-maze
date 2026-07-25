import { G } from '../core/globals.js';
import { isGoalObjective } from '../config/modes.js';
import { FACES, _upY } from '../core/constants.js';
import { cellKey, cellToPoint, pointToCell } from '../core/grid.js';
import { neighborsOf } from '../world/graph.js';
import { blocked, gems, holes } from '../world/level.js';

// ---------- fairness: measure the level, derive the clock ----------
// BFS step-distances over the real walkable graph (rails sever seams,
// holes are impassable for routing — falling in is not a route).
export function bfsFrom(fi, u, v){
  const dist = new Map([[cellKey(fi,u,v), 0]]);
  const q = [[fi,u,v]];
  for (let h = 0; h < q.length; h++){
    const [a,b,c] = q[h];
    const d0 = dist.get(cellKey(a,b,c));
    for (const [nf,nu,nv] of neighborsOf(a,b,c)){
      const k = cellKey(nf,nu,nv);
      if (dist.has(k) || blocked.has(k) || holes.has(k)) continue;
      dist.set(k, d0 + 1);
      q.push([nf,nu,nv]);
    }
  }
  return dist;
}

// failsafe: if a gem is somehow unreachable, move it to a reachable cell
export function relocateGem(g, dist){
  const keys = [...dist.keys()].filter(k => k !== cellKey(2,2,2));
  const k = keys[(Math.random()*keys.length)|0];
  const [fi,u,v] = k.split(',').map(Number);
  g.face = fi;
  g.pos = cellToPoint(fi, u, v);
  g.mesh.quaternion.setFromUnitVectors(_upY, FACES[fi].n);
}

// greedy nearest-neighbour tour through all gems: a solid upper-ish bound on
// the walking the level actually demands
export function shortestTour(){
  let cur = [2,2,2];
  const remaining = gems.slice();
  let steps = 0, guard = 0;
  while (remaining.length && guard++ < 40){
    const dist = bfsFrom(cur[0], cur[1], cur[2]);
    let bi = -1, bd = Infinity;
    for (let i = 0; i < remaining.length; i++){
      const c = pointToCell(remaining[i].face, remaining[i].pos);
      const d = dist.get(cellKey(remaining[i].face, c.u, c.v));
      if (d !== undefined && d < bd){ bd = d; bi = i; }
    }
    if (bi < 0){ relocateGem(remaining[0], dist); continue; }
    steps += bd;
    const g = remaining.splice(bi, 1)[0];
    const c = pointToCell(g.face, g.pos);
    cur = [g.face, c.u, c.v];
  }
  return steps;
}

// the clock is derived from the measured tour: always beatable, with a slack
// margin that tightens as levels climb — difficulty without impossibility
export function fairTimeLimit(){
  let steps;
  if (isGoalObjective() && G.finishKey){
    steps = bfsFrom(2,2,2).get(G.finishKey) || 80;       // the one true path
  } else {
    steps = shortestTour();
  }
  const perStep = 0.42;                              // seconds per step, decent pace
  const slack = Math.max(1.15, 1.8 - G.level * 0.07);
  return Math.max(20, Math.ceil(steps * perStep * slack) + 6);
}

// ---------- HUD ----------
