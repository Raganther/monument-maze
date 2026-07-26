import { G } from '../core/globals.js';
import { CELL, FACES, _upY } from '../core/constants.js';
import { cellKey, cellNeighbours, cellToPoint } from '../core/grid.js';
import { levelComplete } from '../game/lifecycle.js';
import { bfsFrom } from '../gen/fairness.js';
import { placeReachGoal } from '../gen/maze.js';
import { SOLVED, deadline, verifyLevel } from '../gen/verify.js';
import { _planeZ } from './holes.js';
import { bevelAmount, bevelledBox, edgeMat } from '../render/blockgeo.js';
import { faceLift } from '../render/player.js';
import { updateGemHUD } from '../ui/hud.js';
import { blocked, holes, pushBlocks, pushPads, rails } from '../world/level.js';

// ---------- push-block puzzle (PUZZLE objective) ----------
// Sokoban on the cube surface: push blocks onto target pads. State lives in
// pushBlocks (cellKey -> mesh); pads are target cells. You win when every block
// sits on a pad. Pushing respects the movement graph, so blocks slide across
// cube edges just as the player does.
G.pushGroup = null;

export function clearPushPuzzle(){
  pushBlocks.clear();
  pushPads.clear();
  G.pushGroup = null;
}

// find the cell you reach stepping from (fi,u,v) in world-direction D, using the
// same edge-aware graph the player moves on. Returns [nf,nu,nv] or null.
export function cellStep(fi, u, v, D){
  let bestC = null, bestDot = 0.9;
  for (const [nf, nu, nv, , dir] of cellNeighbours(fi, u, v)){
    const d = dir.dot(D);
    if (d > bestDot){ bestDot = d; bestC = [nf, nu, nv]; }
  }
  return bestC;
}

// Propose ONE block/pad pair by reverse-pushing a block away from its pad.
// This is only a heuristic for a *likely* layout - reverse-pushing ignores
// whether the player can actually get behind the block to shove it back, which
// is why the result must always be proven before it is used.
function proposeOne(walkKeys, usedBlock, usedPad){
  const padK = walkKeys[(Math.random()*walkKeys.length)|0];
  if (padK === cellKey(2,2,2) || usedPad.has(padK) || usedBlock.has(padK)) return null;

  let curK = padK;
  const steps = 2 + (Math.random()*3|0);
  for (let s = 0; s < steps; s++){
    const [cf, cu, cv] = curK.split(',').map(Number);
    const opts = cellNeighbours(cf, cu, cv).filter(([nf,nu,nv,mk,dir]) => {
      const nk = cellKey(nf,nu,nv);
      if (blocked.has(nk) || holes.has(nk) || usedBlock.has(nk) || usedPad.has(nk)
          || nk === cellKey(2,2,2)) return false;
      if (mk && rails.has(mk)) return false;    // don't seed a block across a wall
      const behind = cellStep(nf, nu, nv, dir);
      if (!behind) return false;
      const behindK = cellKey(...behind);
      return !blocked.has(behindK) && !holes.has(behindK);
    });
    if (!opts.length) break;
    const [nf,nu,nv] = opts[(Math.random()*opts.length)|0];
    curK = cellKey(nf,nu,nv);
  }
  if (curK === padK) return null;                 // didn't move off the pad
  return { block: curK, pad: padK };
}

export function placePushPuzzle(){
  clearPushPuzzle();
  G.pushGroup = new THREE.Group();
  G.levelGroup.add(G.pushGroup);
  const count = Math.min(1 + (G.level >> 1), 4);   // 1-4 blocks

  // Grow the puzzle one proven pair at a time.
  //
  // Each candidate is staged as bare keys and the WHOLE board is re-solved
  // before it is kept, so every block that survives is known to be pushable to
  // its pad alongside all the others - the interference case the old per-block
  // filter missed. Growing beats proposing N at once and backing off: a pair
  // that does not work costs one re-roll instead of the whole set.
  //
  // Meshes are built only at the end, so a rejected candidate costs nothing.
  const walkKeys = [...bfsFrom(2, 2, 2).keys()];
  const blocks = [], pads = [];
  const usedBlock = new Set(), usedPad = new Set();
  const outOfTime = deadline(2200);

  for (let n = 0; n < count && !outOfTime(); n++){
    let added = false;
    for (let attempt = 0; attempt < 12 && !added && !outOfTime(); attempt++){
      const pair = proposeOne(walkKeys, usedBlock, usedPad);
      if (!pair) continue;
      pushBlocks.set(pair.block, { mesh: null });
      pushPads.set(pair.pad, null);
      if (verifyLevel().result === SOLVED){
        blocks.push(pair.block); pads.push(pair.pad);
        usedBlock.add(pair.block); usedPad.add(pair.pad);
        added = true;
      } else {
        pushBlocks.delete(pair.block);
        pushPads.delete(pair.pad);
      }
    }
    if (!added) break;             // board is saturated; keep what is proven
  }

  pushBlocks.clear(); pushPads.clear();
  for (let i = 0; i < blocks.length; i++){
    addPushPad(pads[i]);
    addPushBlock(blocks[i]);
  }
  refreshPads();
  updateGemHUD();
  // nothing provable on this board - fall back to a plain reach goal rather
  // than leaving the player a puzzle that cannot be finished
  if (pushBlocks.size === 0) placeReachGoal();
}


export function addPushBlock(k){
  const [fi, u, v] = k.split(',').map(Number);
  const n = FACES[fi].n;
  const base = cellToPoint(fi, u, v);
  const geo = bevelledBox(G.BLOCK*0.82, G.BLOCK*0.82, G.BLOCK*0.82, bevelAmount()*1.4);
  const mat = new THREE.MeshLambertMaterial({ color:0xc8794a });   // warm clay, stands out
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.position.copy(base).addScaledVector(n, CELL*0.41 + faceLift(fi));
  mesh.quaternion.setFromUnitVectors(_upY, n);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  G.pushGroup.add(mesh);
  pushBlocks.set(k, { mesh });
}

export function addPushPad(k){
  const [fi, u, v] = k.split(',').map(Number);
  const n = FACES[fi].n;
  const base = cellToPoint(fi, u, v);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CELL*0.24, CELL*0.38, 20),
    new THREE.MeshBasicMaterial({ color:0xe0a03a, side:THREE.DoubleSide,
      transparent:true, opacity:0.85 }));
  ring.position.copy(base).addScaledVector(n, 0.02 + faceLift(fi));
  ring.quaternion.setFromUnitVectors(_planeZ, n);
  G.pushGroup.add(ring);
  pushPads.set(k, ring);
}

// try to push the block at cell bk in world-direction D. Returns the new block
// cell if it moved, else null. Called when the player steps into a block.
// scratch vectors/quaternions for push-block animation
export const _pbTmp = new THREE.Vector3();
export const _pbQ = new THREE.Quaternion();
export const _pbTmp2 = new THREE.Vector3();
export const _pbQ2 = new THREE.Quaternion();
export function tryPush(bk, playerCellK, D){
  try { return tryPushInner(bk, playerCellK, D); }
  catch(err){ console.error('push error:', err); return null; }
}
export function tryPushInner(bk, playerCellK, D){
  const [bfi, bu, bv] = bk.split(',').map(Number);
  // The push direction D is expressed in the PLAYER's face frame. When the block
  // sits on a different face (across an edge), D isn't a valid tangent of the
  // block's face, so we can't use it directly. Instead we pick the block's exit
  // that continues the push line: the neighbour cell the player is shoving toward
  // (furthest from the player along the shove line).
  const playerPos = playerCellK ? cellToPoint(...playerCellK.split(',').map(Number)) : null;
  let dest = null, destDir = null, destSeam = null;
  if (playerPos){
    const bPos = cellToPoint(bfi, bu, bv);
    const shove = bPos.clone().sub(playerPos);   // world heading player->block
    let best = -Infinity;
    for (const [nf, nu, nv, mk, dir] of cellNeighbours(bfi, bu, bv)){
      const nPos = cellToPoint(nf, nu, nv);
      const away = nPos.clone().sub(playerPos).dot(shove);
      const score = dir.dot(shove) + away * 0.001;
      if (score > best){ best = score; dest = [nf, nu, nv]; destDir = dir.clone(); destSeam = mk; }
    }
  } else {
    dest = cellStep(bfi, bu, bv, D);
    if (dest){
      for (const [nf, nu, nv, mk, dir] of cellNeighbours(bfi, bu, bv))
        if (nf === dest[0] && nu === dest[1] && nv === dest[2]){ destDir = dir.clone(); destSeam = mk; break; }
    }
  }
  if (!dest || !destDir) return null;            // block at edge with nowhere to go
  const dk = cellKey(...dest);
  // a wall (rail) on the seam blocks the block just as it blocks the player —
  // the block can't be shoved through a wall it can't pass.
  if (destSeam && rails.has(destSeam)) return null;
  if (blocked.has(dk) || holes.has(dk) || pushBlocks.has(dk)) return null;
  const rec = pushBlocks.get(bk);
  if (rec.anim) return null;                      // already mid-push, ignore
  const [nfi, nu, nv] = dest;
  const sameFace = (nfi === bfi);
  // the block's move direction on ITS OWN face, used for the flip axis
  const bD = destDir;

  // update the LOGICAL position immediately so chained pushes and the win check
  // stay correct; the mesh catches up via the animation below.
  pushBlocks.delete(bk);
  pushBlocks.set(dk, rec);

  const fromPos = rec.mesh.position.clone();
  const fromQ = rec.mesh.quaternion.clone();
  const nN = FACES[nfi].n;
  const toPos = cellToPoint(nfi, nu, nv).addScaledVector(nN, CELL*0.41 + faceLift(nfi));
  const toQ = new THREE.Quaternion().setFromUnitVectors(_upY, nN);

  if (sameFace){
    rec.anim = { kind:'slide', t:0, dur:150, fromPos, toPos };
  } else {
    const oldN = FACES[bfi].n;
    let axis = new THREE.Vector3().crossVectors(oldN, bD);
    if (axis.lengthSq() < 1e-9){
      // degenerate — a zero axis becomes NaN and crashes WebGL. Fall back to slide.
      rec.anim = { kind:'slide', t:0, dur:180, fromPos, toPos };
      refreshPads(); updateGemHUD();
      return dk;
    }
    axis.normalize();
    const oldCentre = cellToPoint(bfi, bu, bv);
    const edgeMid = oldCentre.clone()
      .addScaledVector(bD, CELL/2)
      .addScaledVector(oldN, -CELL/2);
    const testEnd = (ang) => _pbTmp2.copy(fromPos).sub(edgeMid)
      .applyQuaternion(_pbQ2.setFromAxisAngle(axis, ang)).add(edgeMid);
    const half = Math.PI/2;
    const dPos = testEnd(half).distanceTo(toPos);
    const dNeg = testEnd(-half).distanceTo(toPos);
    const sign = dPos <= dNeg ? 1 : -1;
    const outN = oldN.clone().add(nN).normalize();    // bulge out over the edge
    rec.anim = { kind:'flip', t:0, dur:220, fromPos, fromQ, toPos, toQ, axis, edgeMid, sign, outN };
  }

  refreshPads();
  updateGemHUD();
  return dk;
}

// advance push-block animations; called each frame
export function tickPushBlocks(dt){
  try {
  for (const rec of pushBlocks.values()){
    const a = rec.anim;
    if (!a) continue;
    a.t += dt;
    const raw = Math.min(1, a.t / a.dur);
    const e = raw < 0.5 ? 2*raw*raw : 1 - Math.pow(-2*raw+2, 2)/2;   // ease in-out
    if (a.kind === 'slide'){
      rec.mesh.position.lerpVectors(a.fromPos, a.toPos, e);
    } else {
      // tumble over the edge: interpolate position along an arc that bulges out
      // past the edge (so it swings over, not through the cube), while rotating
      // 90° for the roll. Exact landing is snapped at raw>=1, so the arc only
      // needs to read as a believable tumble.
      _pbTmp.lerpVectors(a.fromPos, a.toPos, e);
      // lift the midpoint outward along the average of the two face normals
      const bulge = Math.sin(e * Math.PI) * CELL * 0.33;
      _pbTmp.addScaledVector(a.outN, bulge);
      rec.mesh.position.copy(_pbTmp);
      _pbQ.setFromAxisAngle(a.axis, e * (Math.PI/2) * a.sign);
      rec.mesh.quaternion.copy(_pbQ).multiply(a.fromQ);
    }
    // NaN guard: a non-finite position/quaternion crashes the WebGL renderer
    const _p = rec.mesh.position;
    if (!Number.isFinite(_p.x) || !Number.isFinite(_p.y) || !Number.isFinite(_p.z)){
      rec.mesh.position.copy(a.toPos);
      if (a.toQ) rec.mesh.quaternion.copy(a.toQ);
      rec.anim = null;
      continue;
    }
    if (raw >= 1){
      rec.mesh.position.copy(a.toPos);
      if (a.toQ) rec.mesh.quaternion.copy(a.toQ);   // flips reorient; slides don't
      rec.anim = null;
      refreshPads();
      if (puzzleSolved()) levelComplete();
    }
  }
  } catch(err){
    console.error('push animation error:', err);
    // never let an animation glitch spam or crash: snap all to their targets
    for (const rec of pushBlocks.values()) if (rec.anim){
      rec.mesh.position.copy(rec.anim.toPos);
      if (rec.anim.toQ) rec.mesh.quaternion.copy(rec.anim.toQ);
      rec.anim = null;
    }
  }
}

// light up pads that have a block on them
export function refreshPads(){
  for (const [pk, ring] of pushPads){
    const on = pushBlocks.has(pk);
    ring.material.color.setHex(on ? 0x66c7a5 : 0xe0a03a);
    ring.material.opacity = on ? 1.0 : 0.85;
  }
}

export function puzzleSolved(){
  for (const pk of pushPads.keys()) if (!pushBlocks.has(pk)) return false;
  return pushPads.size > 0;
}

