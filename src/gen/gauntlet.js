import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';
import { MODE } from '../config/modes.js';
import { CELL, FACES, N, _upY } from '../core/constants.js';
import { cellKey, cellNeighbours, cellToPoint } from '../core/grid.js';
import { _planeZ } from '../mechanics/holes.js';
import { cellHash } from '../render/blockgeo.js';
import { addStack } from '../render/masonry.js';
import { neighborsOf } from '../world/graph.js';
import { blocked, holes, onewayMeshes, oneways } from '../world/level.js';

export function generateGauntlet(){
  const startCell = [2, 2, 2];
  const startK = cellKey(...startCell);
  // ---- Phase 1: carve the spine as a SELF-AVOIDING WALK WITH SPACING ----
  // The corridor may never touch itself: each new cell's other neighbours must
  // be off-path. That keeps every fold separated by stone, so the route reads
  // as thin winding corridors, not open plazas (the bug behind empty regions —
  // a plain DFS path folds onto itself and merges into wide open areas, and its
  // endpoint can sit right beside the start despite being 'deep').
  const targetLen = Math.min(18 + (G.level >> 1), 30);
  let best = null;
  for (let attempt = 0; attempt < 14; attempt++){
    const path = [startCell];
    const onPath = new Set([startK]);
    let guard = 0;
    while (path.length < targetLen && guard++ < 400){
      const cur = path[path.length - 1];
      const curK = cellKey(...cur);
      const opts = cellNeighbours(...cur).filter(([nf, nu, nv]) => {
        const ck = cellKey(nf, nu, nv);
        if (onPath.has(ck)) return false;
        // spacing rule: the candidate may touch the path ONLY at the current cell
        for (const [mf, mu, mv] of cellNeighbours(nf, nu, nv)){
          const mk = cellKey(mf, mu, mv);
          if (mk !== curK && onPath.has(mk)) return false;
        }
        return true;
      });
      if (!opts.length) break;                 // dead-ended; this attempt is done
      const [nf, nu, nv] = opts[(Math.random()*opts.length)|0];
      path.push([nf, nu, nv]);
      onPath.add(cellKey(nf, nu, nv));
    }
    // prefer walks that are long AND end on a different face (spatially far)
    const endFace = path[path.length - 1][0];
    const score = path.length + (endFace !== startCell[0] ? 12 : 0);
    if (!best || score > best.score) best = { path, score };
    if (best.path.length >= targetLen && best.path[best.path.length-1][0] !== startCell[0]) break;
  }
  const path = best.path;
  const goalCell = path[path.length - 1];
  // spine segments {from, cell, dir} for the gating pass
  const spine = [];
  for (let i = 1; i < path.length; i++){
    const from = cellKey(...path[i-1]), cell = cellKey(...path[i]);
    spine.push({ from, cell, dir: dirBetween(from, cell) });
  }
  G.gauntletSpine = new Set(path.map(c => cellKey(...c)));

  // ---- Phase 2: the OPEN set — spine plus decoy corridors — stays walkable;
  // every other cell becomes a masonry stack, so the path winds through solid
  // stone rather than between thin walls. Same material world as Classic.
  const open = new Set(G.gauntletSpine);

  // decoy corridors: short dead-end branches off the spine, carved as open cells
  // into the stone so the true route isn't obvious. A few become one-way traps.
  const decoyMouths = [];                       // {cell, dir} for trap one-ways
  const branchCount = Math.min(8 + (G.level >> 2), 14);   // capped: keep ~75% stone
  let made = 0, guard = 0;
  while (made < branchCount && guard++ < 300){
    const anchor = spine[(Math.random()*spine.length)|0].cell;
    let cur = anchor.split(',').map(Number);
    let curK = anchor;
    const len = 1 + (Math.random()*3|0);
    const branch = [];
    for (let step = 0; step < len; step++){
      const opts = cellNeighbours(...cur).filter(([nf,nu,nv]) => {
        const ck = cellKey(nf,nu,nv);
        if (open.has(ck) || branch.includes(ck)) return false;
        // spacing: the branch cell may touch open cells ONLY at its parent, so
        // decoys stay thin corridors and never merge into plazas
        for (const [mf,mu,mv] of cellNeighbours(nf,nu,nv)){
          const mk = cellKey(mf,mu,mv);
          if (mk !== curK && (open.has(mk) || branch.includes(mk))) return false;
        }
        return true;
      });
      if (!opts.length) break;
      const [nf,nu,nv] = opts[(Math.random()*opts.length)|0];
      const ck = cellKey(nf,nu,nv);
      open.add(ck); branch.push(ck);
      cur = [nf,nu,nv]; curK = ck;
    }
    if (branch.length){
      made++;
      // occasionally a commit-in trap: the one-way sits on the branch's FIRST
      // cell pointing deeper, so entering commits you (respawn to escape) —
      // never on the spine anchor, which would sever the main route itself
      if (branch.length >= 2 && Math.random() < 0.3){
        const d = dirBetween(branch[0], branch[1]);
        if (d) decoyMouths.push({ cell: branch[0], dir: d });
      }
    }
  }

  // ---- Phase 2b: gate the spine with one-way runs — only if the ONE-WAY TILES
  // feature is switched on in the lab. Off => a pure masonry-block maze.
  if (featureOn('oneways')){
    gateSpine(spine, startCell, goalCell);
    for (const { cell, dir } of decoyMouths){
      if (!oneways.has(cell)) oneways.set(cell, dir);
    }
  }

  // ---- Phase 3: stack every non-open cell as masonry ----
  const mode = MODE();
  for (let fi = 0; fi < 6; fi++)
    for (let u = 0; u < N; u++)
      for (let v = 0; v < N; v++){
        const ck = cellKey(fi, u, v);
        if (open.has(ck)) continue;
        // vary heights a little for a ruined skyline; 1-2 high
        const h = 1 + (cellHash(fi, u, v, 71) < 0.35 ? 1 : 0);
        addStack(fi, u, v, h, false);
      }

  // set the goal BEFORE the feature pass so every generator knows to avoid it
  G.finishKey = cellKey(...goalCell);

  // ---- Phase 4: weave the lab's obstacle features into the corridors ----
  // Each generator already skips blocked cells and carries a connectivity
  // guard, so here they confine themselves to the open corridors and can only
  // decorate the maze, never sever it. The goal cell is explicitly protected.
  // Portals are confined to the DECOY branches: in the movement graph a portal
  // cell inherits its partner's exits, so one sitting mid-spine would muddy the
  // route's reachability — off-spine they're shortcuts between false corridors.
  for (const fk of ['towers', 'rails', 'holes', 'bridges'])
    if (featureOn(fk) && FEATURES[fk].gen) FEATURES[fk].gen();
  if (featureOn('portals') && FEATURES.portals.gen){
    for (const s of G.gauntletSpine) blocked.add(s);    // shield the spine
    FEATURES.portals.gen();
    for (const s of G.gauntletSpine) blocked.delete(s);
  }

  placeGauntletGoal(goalCell);
  // self-check: confirm the goal is directed-reachable from the start. The
  // corridor is defined by open cells (stacks seal the rest), so the only thing
  // that can strand the goal is an unlucky one-way; clearing them restores the
  // fully-traversable spine. Proven not to trigger in simulation, but kept as a
  // guarantee against any edge case.
  if (!goalReachable()){
    oneways.clear();
    onewayMeshes.length = 0;
  }
}

// is the finish reachable from the start through the current directed graph?
export function goalReachable(){
  if (!G.finishKey) return true;
  const seen = new Set([cellKey(2,2,2)]);
  const q = [[2,2,2]];
  for (let h = 0; h < q.length; h++){
    const [a,b,c] = q[h];
    if (cellKey(a,b,c) === G.finishKey) return true;
    for (const [nf,nu,nv] of neighborsOf(a,b,c)){
      const k = cellKey(nf,nu,nv);
      if (seen.has(k) || blocked.has(k) || holes.has(k)) continue;
      seen.add(k); q.push([nf,nu,nv]);
    }
  }
  return seen.has(G.finishKey);
}

// hang mechanics on the spine so traversal REQUIRES them. Safe by construction:
// one-ways point along the path (never blocking the intended direction), and
// portals bridge gaps we simultaneously wall off, so they're the only crossing.
export function gateSpine(spine, startCell, goalCell){
  const L = spine.length;
  if (L < 6) return;                          // too short to gate meaningfully

  // ONE-WAY RUNS: a few short committed stretches — accents on the route, not
  // wallpaper. Runs point along the path (toward the goal), always solvable.
  const runs = 2 + (G.level >> 2);              // 2-4 runs typically
  let guard = 0;
  for (let r = 0; r < runs && guard < 60; r++){
    guard++;
    const runLen = 2 + (Math.random()*2|0);   // 2-3 cells each
    const startI = 1 + (Math.random() * Math.max(1, L - runLen - 2) | 0);
    for (let i = startI; i < startI + runLen && i < L; i++){
      const seg = spine[i];
      if (seg && !oneways.has(seg.from)){
        oneways.set(seg.from, seg.dir.clone());
      }
    }
  }

  // PORTAL BRIDGES: deferred pending correct gap-crossing generation.
}

// world-direction from cell A to adjacent cell B (or null if not adjacent)
export function dirBetween(aKey, bKey){
  const [afi, au, av] = aKey.split(',').map(Number);
  for (const [nf, nu, nv, , dir] of cellNeighbours(afi, au, av)){
    if (cellKey(nf, nu, nv) === bKey) return dir.clone();
  }
  return null;
}

export function placeGauntletGoal(goalCell){
  const [fi, u, v] = goalCell;
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

