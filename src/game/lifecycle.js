import { G } from '../core/globals.js';
import { audio, sfxBell, sfxSweep, sfxWood } from '../audio/sfx.js';
import { FEATURES, featureOn, timerActive } from '../config/features.js';
import { MODE } from '../config/modes.js';
import { FACES } from '../core/constants.js';
import { cellToPoint } from '../core/grid.js';
import { elevTarget, skewTarget } from './view.js';
import { fairTimeLimit } from '../gen/fairness.js';
import { placeReachGoal } from '../gen/maze.js';
import { spawnGems } from '../mechanics/gems.js';
import { placeKeystone } from '../mechanics/keystone.js';
import { drawOneways } from '../mechanics/oneways.js';
import { clearPushPuzzle, placePushPuzzle } from '../mechanics/pushblocks.js';
import { clearKeysGates, generateKeysGates } from '../mechanics/keysgates.js';
import { updateFaceTextures } from '../render/cube.js';
import { Nf, P, PSIZE, faceLift, placePlayer, player, playerTargetQuat } from '../render/player.js';
import { CAM_DIR, applyCamera, applyShadows, world } from '../render/scene.js';
import { clearSeeThrough } from '../render/seethrough.js';
import { drawTrail } from '../render/trail.js';
import { levelChip, timeChip, updateFaceHUD, updateGemHUD, updateTimeHUD } from '../ui/hud.js';
import { lvlNum } from '../ui/lab.js';
import { blocked, bridged, gauntletWallSeams, gems, holeList, holes, monumentCells, onewayMeshes, oneways, pathCells, pathFaces, portalFX, portalList, portals, rails, wallRep } from '../world/level.js';

// ---------- level lifecycle ----------
export const START_LEVEL = 25;
G.level = START_LEVEL;
G.timeLeft = 0;
G.phase = 'menu';  // 'menu' | 'play' | 'wait'
export const overlay = document.getElementById('overlay');
export const overlayText = document.getElementById('overlayText');
export function showOverlay(text){ overlayText.textContent = text; overlay.style.opacity = 1; }
export function hideOverlay(){ overlay.style.opacity = 0; }

export function buildLevel(){
  clearSeeThrough();
  if (G.levelGroup) world.remove(G.levelGroup);
  G.levelGroup = new THREE.Group();
  world.add(G.levelGroup);
  blocked.clear(); rails.clear(); pathFaces.clear(); pathCells.clear(); holes.clear(); holeList.length = 0; bridged.clear();
  oneways.clear(); onewayMeshes.length = 0;
  G.gauntletSpine = null; gauntletWallSeams.clear(); wallRep.clear();
  clearPushPuzzle();
  clearKeysGates();
  portals.clear(); portalList.length = 0; portalFX.clear();
  gems.length = 0; G.gemCount = 0;
  monumentCells.length = 0;
  G.keystoneCell = null; G.keystoneGroup = null; G.keystoneAwake = false;
  G.keystoneCharge = 0; G.keystoneBeacon = null;

  const mode = MODE();
  G.finishKey = null;
  const obj = mode.objective;

  // ONE shared layout for every objective: run all the lab's gen() hooks so the
  // board is the open, breathable Classic layout — sparse blocks, monuments,
  // negative space — regardless of objective. (maze/walls-only is retired; the
  // open board is nicer and every objective inherits every dynamic.)
  for (const k of Object.keys(FEATURES))
    if (FEATURES[k].on && FEATURES[k].gen) FEATURES[k].gen();

  // the objective layer: what you place on top, and what winning means
  if (obj === 'collect'){
    G.gemsTotal = spawnGems(Math.min(4 + G.level, 12));
    if (featureOn('keystone')) placeKeystone();
  } else if (obj === 'reach'){
    // a single goal on a far reachable cell — the open board becomes a journey
    G.gemsTotal = 0;
    placeReachGoal();
  } else if (obj === 'puzzle'){
    // Sokoban-style state puzzle: push blocks onto target pads. Winning is a
    // CONFIGURATION (every block on a pad), not reaching a point — the board
    // has state, and you change it by pushing. Lives on the same open board.
    G.gemsTotal = 0;
    placePushPuzzle();
  }

  // Keys and gates go on AFTER the objective, not in the feature pass above,
  // because each pair is kept only if the board still solves - and there is
  // nothing to solve for until the objective exists. Placing a gate earlier
  // would be proving a level with no win condition.
  if (featureOn('keysgates'))
    generateKeysGates(FEATURES.keysgates.slider.value);

  updateFaceTextures();   // cut any hole openings out of the face surfaces
  G.timeLeft = fairTimeLimit();

  world.quaternion.set(0,0,0,1);
  P.copy(cellToPoint(2, 2, 2));
  Nf.copy(FACES[2].n);
  player.quaternion.copy(playerTargetQuat());
  G.state = 'idle'; G.tw = null; G.peeked = false; G.portalArmed = null; G.autoPush = null;
  G.skewSign = 1; G.skewCur = skewTarget(); G.elevCur = elevTarget(); applyCamera();

  levelChip.textContent = mode.name + ' \u00b7 ' + G.level;
  lvlNum.textContent = G.level;
  timeChip.style.display = timerActive() ? '' : 'none';
  drawOneways();
  updateFaceHUD(); updateGemHUD(); updateTimeHUD();
  applyShadows();
  drawTrail();
}

// falling into a hole: sink, shrink, and reappear at the start cell
export function startFall(){
  G.state = 'fall';
  sfxSweep(300, 70, 0.5, 0.16, 'sine');     // down we go
  G.tw = { t:0, dur:550, c0:player.position.clone(), n:Nf.clone() };
}
export function respawn(){
  sfxWood(90, 0.18, 0.45, 2);               // the thud at the bottom
  player.scale.setScalar(1);
  world.quaternion.set(0,0,0,1);
  P.copy(cellToPoint(2, 2, 2));
  Nf.copy(FACES[2].n);
  player.quaternion.copy(playerTargetQuat());
  G.tw = null; G.state = 'idle';
  updateFaceHUD();
  placePlayer(P);
  drawTrail();
}

// stepping into a portal: sink into the shaft, then rise out of the partner
// while the cube rotates to bring the destination face up into view
// Stepping onto a portal doesn't take you immediately: it arms a short dwell.
// Keep moving and you cross straight over; linger and it pulls you through.
// A portal is a choice, not a trap.
export const PORTAL_DWELL = 420;
G.portalArmed = null;  // { key, t }
G.autoPush = null;  // { dir, t } — pending one-way forward push

// a rising tone while the player dwells on a portal — cut short if they leave
G.chargeVoice = null;
export function startChargeTone(key){
  if (!featureOn('sound')) return;
  const ac = audio(); if (!ac) return;
  stopChargeTone();
  const fx = portalFX.get(key);
  const n = fx && fx.note ? fx.note : 440;
  const t = ac.currentTime, dur = PORTAL_DWELL/1000;
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(n * 0.75, t);
  o.frequency.exponentialRampToValueAtTime(n * 2, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.1, t + dur * 0.5);
  o.connect(g); g.connect(G.masterGain);
  o.start(t);
  G.chargeVoice = { o, g };
}
export function stopChargeTone(){
  if (!G.chargeVoice || !G.actx) return;
  const t = G.actx.currentTime;
  G.chargeVoice.g.gain.cancelScheduledValues(t);
  G.chargeVoice.g.gain.setValueAtTime(G.chargeVoice.g.gain.value, t);
  G.chargeVoice.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  G.chargeVoice.o.stop(t + 0.08);
  G.chargeVoice = null;
}

export function startPortal(cellK){
  G.state = 'portalIn';
  const dest = portals.get(cellK).pair;
  const fxA = portalFX.get(cellK), fxB = portalFX.get(dest);
  if (fxA){ fxA.flare = 1; fxA.charge = 0; }
  if (fxB) fxB.flare = 1;
  // each pair has its own note, so a portal sounds like itself
  const n = fxA && fxA.note ? fxA.note : 440;
  sfxSweep(n * 2, n * 0.5, 0.38, 0.16, 'triangle');    // falling in
  G.tw = { t:0, dur:380, c0:player.position.clone(), n:Nf.clone(), dest };
}
export function emergeFromPortal(destKey){
  const fx = portalFX.get(destKey);
  if (fx) fx.flare = 1;
  const n = fx && fx.note ? fx.note : 440;
  sfxSweep(n * 0.5, n * 2, 0.42, 0.16, 'triangle');    // rising out
  const [fi, u, v] = destKey.split(',').map(Number);
  P.copy(cellToPoint(fi, u, v));
  Nf.copy(FACES[fi].n);
  player.quaternion.copy(playerTargetQuat());
  updateFaceHUD();
  const c1 = P.clone().addScaledVector(Nf, PSIZE/2 + 0.01 + faceLift(fi));
  // rotate the cube so the destination face faces the camera
  // rotate the cube so the destination face faces the camera
  const worldN = Nf.clone().applyQuaternion(world.quaternion);
  const aim = featureOn('freeCam') ? CAM_DIR.clone() : new THREE.Vector3(0, 1, 0);
  const qd = worldN.dot(aim) < -0.99
    ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI)
    : new THREE.Quaternion().setFromUnitVectors(worldN, aim);
  G.state = 'portalOut';
  G.tw = { t:0, dur:560, fromQ: world.quaternion.clone(),
         toQ: qd.multiply(world.quaternion.clone()).normalize(), c1 };
}

export function levelComplete(){
  G.phase = 'wait';
  // a small rising chord
  sfxBell(523.25, 1.1, 0.18);
  setTimeout(() => sfxBell(659.25, 1.1, 0.18), 90);
  setTimeout(() => sfxBell(783.99, 1.4, 0.2), 180);
  showOverlay('LEVEL ' + G.level + ' CLEAR');
  setTimeout(() => { G.level++; buildLevel(); hideOverlay(); G.phase = 'play'; }, 1500);
}
export function failLevel(){
  G.phase = 'wait';
  sfxSweep(220, 110, 0.9, 0.16, 'triangle');
  sfxWood(80, 0.5, 0.3, 1.5);
  showOverlay('OUT OF TIME');
  setTimeout(() => { buildLevel(); hideOverlay(); G.phase = 'play'; }, 1500);
}

