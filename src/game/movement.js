import { G } from '../core/globals.js';
import { sfxBreath, sfxWood } from '../audio/sfx.js';
import { featureOn, speed } from '../config/features.js';
import { AXES, CELL, FLIP_MS, H, SLIDE_MS, SWIVEL_MS } from '../core/constants.js';
import { basisOf, cellKey, faceIndexOf, pointToCell, railKey } from '../core/grid.js';
import { stopChargeTone } from './lifecycle.js';
import { tryPush } from '../mechanics/pushblocks.js';
import { Nf, P, PSIZE, faceLift, player } from '../render/player.js';
import { CAM_DIR, _invCamQ, world } from '../render/scene.js';
import { updateFaceHUD } from '../ui/hud.js';
import { walkable } from '../world/graph.js';
import { oneways, portalFX, pushBlocks, rails } from '../world/level.js';

// ---------- movement state machine ----------
G.state = 'idle';
G.peeked = false;  // cube rotated for a look-around, player may be hidden
G.tw = null;

export const _mid = new THREE.Vector3();
export const _wDir = new THREE.Vector3(), _sDir = new THREE.Vector3();

// Direction selection: candidates are the 4 grid axes of the current face,
// scored in screen space. On the top-position plane they project to perfect
// diagonals and tie, so a ±45° bias breaks the tie — and its handedness
// (diagBias) flips at edge crossings so the held key keeps meaning 'forward'
// whichever side you arrived from (heading continuity).
G.diagBias = 1;
export function pickDir(sx, sy, bias, qOverride){
  const wq = qOverride || world.quaternion;
  // With SKEWED VIEW the four directions project to distinct screen angles, so
  // the tie is broken by geometry — no bias needed (and it would fight the view).
  if (featureOn('skewView') && !featureOn('freeCam')){
    let best = null, bestScore = 0.25;
    for (const a of AXES){
      if (Math.abs(a.dot(Nf)) > 0.5) continue;
      _wDir.copy(a).applyQuaternion(wq);
      _sDir.copy(_wDir).applyQuaternion(_invCamQ);
      const score = _sDir.x*sx + _sDir.y*sy;
      if (score > bestScore){ bestScore = score; best = a; }
    }
    return best;
  }
  // Under the free camera there's no fixed convention to snap to, so ties are
  // broken against the camera's own angle — deterministic at any orbit.
  const b = featureOn('freeCam')
    ? (Math.cos(G.camAz) * Math.sin(G.camAz) >= 0 ? 1 : -1)
    : bias;
  const bx = (sx + b*sy) * Math.SQRT1_2;
  const by = (sy - b*sx) * Math.SQRT1_2;
  let best = null, bestScore = 0.25;
  for (const a of AXES){
    if (Math.abs(a.dot(Nf)) > 0.5) continue;
    _wDir.copy(a).applyQuaternion(wq);
    _sDir.copy(_wDir).applyQuaternion(_invCamQ);
    const score = _sDir.x*sx + _sDir.y*sy + 0.2*(_sDir.x*bx + _sDir.y*by);
    if (score > bestScore){ bestScore = score; best = a; }
  }
  return best;
}

export function tryStep(sx, sy, resolveQ){
  if (G.state !== 'idle' || G.phase !== 'play') return;
  G.autoPush = null;                    // a deliberate move overrides the tile's push
  const D = pickDir(sx, sy, G.diagBias, resolveQ);
  if (!D) return;
  executeStep(D, resolveQ, sx, sy);
}

// perform a step in cube-local direction D. Shared by player input and the
// one-way auto-push, so both obey the same edge/wall/one-way rules. sx/sy are
// the originating screen coords (for heading continuity after a crossing); the
// auto-push has none, so they fall back to the resolved direction itself.
export function executeStep(D, resolveQ, sx, sy){
  if (G.state !== 'idle' || G.phase !== 'play') return;

  // one-way tile: refuse to leave against the arrow (matches neighborsOf, so
  // what the player can do equals what the solver planned). Instead of a dead
  // stop, the player lurches at the invisible barrier and springs back.
  const hereFi = faceIndexOf(Nf);
  const hereC = pointToCell(hereFi, P);
  const owDir = oneways.get(cellKey(hereFi, hereC.u, hereC.v));
  if (owDir && D.dot(owDir) < 0.9){
    G.state = 'bounce';
    sfxWood(140, 0.11, 0.55, 2);            // a dull thud against the barrier
    sfxBreath(320, 520, 0.18, 0.06);        // a little rebound whoosh
    G.tw = { t:0, dur:260, fromP:P.clone(), pushDir:D.clone() };
    return;
  }

  // moving off a portal before its dwell expires: you've declined it
  if (G.portalArmed){
    const fx = portalFX.get(G.portalArmed.key);
    if (fx) fx.charge = 0;
    G.portalArmed = null;
    stopChargeTone();
  }

  if (rails.has(railKey(_mid.copy(P).addScaledVector(D, CELL/2)))){
    sfxWood(150, 0.09, 0.5, 3);      // bump: a blocked move should be heard
    return;
  }

  const cand = P.clone().addScaledVector(D, CELL);
  const [ta, tb] = basisOf(Nf);
  const inside =
    Math.abs(cand.dot(ta)) <= H - CELL/2 + 1e-4 &&
    Math.abs(cand.dot(tb)) <= H - CELL/2 + 1e-4;

  if (inside){
    const fi = faceIndexOf(Nf);
    const c = pointToCell(fi, cand);
    // push block? try to shove it; if it moves, the player follows into its cell
    const destK = cellKey(fi, c.u, c.v);
    if (pushBlocks.has(destK)){
      const pc = pointToCell(fi, P);
      if (tryPush(destK, cellKey(fi, pc.u, pc.v), D)){
        sfxWood(90, 0.14, 0.6, 2);
        // follow the block into its old cell, in sync, so the player's face
        // stays in contact with the block rather than leaving a gap
        if (walkable(fi, c.u, c.v)){
          G.state = 'slide';
          G.tw = { t:0, dur:150, fromP:P.clone(), toP:cand };
        }
      } else sfxWood(150, 0.09, 0.5, 3);                        // block won't budge
      return;
    }
    if (!walkable(fi, c.u, c.v)){ sfxWood(150, 0.09, 0.5, 3); return; }  // bump
    G.state = 'slide';
    // slight random pitch so repeated steps don't machine-gun
    sfxWood(380 + Math.random()*90, 0.045, 0.28, 8);
    G.tw = { t:0, dur:SLIDE_MS * speed(), fromP:P.clone(), toP:cand };
  } else {
    const toP = P.clone().addScaledVector(D, CELL/2).addScaledVector(Nf, -CELL/2);
    const nfIdx = faceIndexOf(D);
    const lc = pointToCell(nfIdx, toP);
    // push block across the edge? shove it, player stays on this face
    const destK = cellKey(nfIdx, lc.u, lc.v);
    if (pushBlocks.has(destK)){
      const pfi = faceIndexOf(Nf);
      const pc = pointToCell(pfi, P);
      if (tryPush(destK, cellKey(pfi, pc.u, pc.v), D)) sfxWood(90, 0.14, 0.6, 2);
      else sfxWood(150, 0.09, 0.5, 3);
      return;
    }
    if (!walkable(nfIdx, lc.u, lc.v)) return;

    // decide against where the view is SETTLING to, not its mid-flight state
    const decideQ = resolveQ || (G.viewEase ? G.viewEase.toQ : world.quaternion);
    const worldN = D.clone().applyQuaternion(decideQ);
    const axis = new THREE.Vector3().crossVectors(Nf, D).normalize();
    const c0 = P.clone().addScaledVector(Nf, PSIZE/2 + 0.01 + faceLift(faceIndexOf(Nf)));
    const c1 = toP.clone().addScaledVector(D, PSIZE/2 + 0.01 + faceLift(nfIdx));
    const bulge = Nf.clone().add(D).normalize();
    const q0 = player.quaternion.clone();

    // destination visible from the current camera -> the player flips over the
    // edge (cube static). Genuinely on the far side -> the cube swivels to
    // bring that plane into view, player riding along. Uses a back-face test
    // (dot > 0) rather than a margin: at axis-aligned camera angles a face can
    // sit exactly edge-on, and a margin would swivel when it needn't.
    if (worldN.dot(CAM_DIR) > 0.001){
      G.state = 'flip';
      sfxBreath(900, 400, 0.3, 0.12);        // the player tumbling over an edge
      G.tw = { t:0, dur:FLIP_MS * speed(), fromP:P.clone(), toP, axis, c0, c1, bulge, q0 };
    } else {
      // rotate the cube about the shared edge so the new face takes the old
      // one's place. If a view settle is in flight, start from its target so
      // the two rotations compose instead of fighting.
      const baseQ = G.viewEase ? G.viewEase.toQ.clone() : world.quaternion.clone();
      G.viewEase = null;
      const qLocal = new THREE.Quaternion().setFromUnitVectors(D, Nf);
      G.state = 'swivel';
      sfxBreath(500, 180, 0.5, 0.2);         // the whole cube turning: deeper, longer
      G.tw = { t:0, dur:SWIVEL_MS * speed(), fromP:P.clone(), toP, axis, c0, c1, bulge, q0,
             fromQ: world.quaternion.clone(),
             toQ: baseQ.multiply(qLocal).normalize() };
    }
    // heading continuity: after the crossing, the key that carried you over
    // must keep meaning 'forward' (which is -oldNormal on the new face).
    // Flip the diagonal handedness if that's what forward requires.
    const cont = Nf.clone().negate();
    Nf.copy(D);
    // auto-push has no screen coords: project D to screen so scoring still works
    let ssx = sx, ssy = sy;
    if (ssx === undefined){
      _sDir.copy(D).applyQuaternion(resolveQ || world.quaternion).applyQuaternion(_invCamQ);
      ssx = _sDir.x; ssy = _sDir.y;
    }
    for (const b of [G.diagBias, -G.diagBias]){
      const p = pickDir(ssx, ssy, b);
      if (p && p.dot(cont) > 0.9){ G.diagBias = b; break; }
    }
    updateFaceHUD();
  }
}

