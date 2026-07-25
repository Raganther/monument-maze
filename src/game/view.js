import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';
import { H } from '../core/constants.js';
import { Nf, P } from '../render/player.js';
import { CAM_DIR, ISO_EL, applyCamera, world } from '../render/scene.js';

// ---------- free look: spin the cube to any angle ----------
// A purely visual rotation — the player's face and position never change.
// Hold Q/E to turn the cube continuously about the vertical screen axis.
// Movement then snaps to the nearest clean orientation first, so direction
// scoring is never ambiguous (it ties at 45°).
export const SCREEN_UP = new THREE.Vector3(0, 1, 0);
export const SPIN_SPEED = 1.7;                 // radians per second
export const _spinQ = new THREE.Quaternion();
export function spin(dir, dt){
  if (G.phase !== 'play') return;
  // allowed mid-step: rotating while the player moves is the point
  if (G.state === 'swivel' || G.state === 'portalIn' || G.state === 'portalOut') return;
  if (featureOn('freeCam')){
    // orbit the camera; the cube stays put. The swivel handles hidden planes.
    G.camAz += dir * SPIN_SPEED * dt / 1000;
    applyCamera();
    return;
  }
  G.viewEase = null;                    // manual input takes the wheel
  _spinQ.setFromAxisAngle(SCREEN_UP, dir * SPIN_SPEED * dt / 1000);
  world.quaternion.premultiply(_spinQ).normalize();
  G.peeked = true;
}
// is the player's face turned toward the camera?
export function playerVisible(q){
  return Nf.clone().applyQuaternion(q || world.quaternion).dot(CAM_DIR) > 0.001;
}

// the skew we want right now (signed), in radians
export function skewTarget(){
  if (!featureOn('skewView') || featureOn('freeCam')) return 0;
  return G.skewSign * FEATURES.skewView.slider.value * Math.PI/180;
}

// Elevation help for the two blind zones of a fixed camera. Both scale with
// how deep into the zone the player is, so it eases in.
export function elevTarget(){
  if (!featureOn('skewView') || featureOn('freeCam')) return ISO_EL;
  const S = FEATURES.skewView.sliders;
  const lift = S[0].value * Math.PI/180, dip = S[1].value * Math.PI/180;
  // keep the view usable: too flat and the planes go edge-on, too steep and
  // the sides vanish
  const clamp = e => Math.min(1.30, Math.max(0.22, e));   // ~12.5° .. ~74.5°
  // where is the player, in world space, on the cube?
  const wp = P.clone().applyQuaternion(world.quaternion);
  const wn = Nf.clone().applyQuaternion(world.quaternion);
  if (Math.abs(wn.y) < 0.5){
    // side plane: the further down, the lower the view drops
    const depth = Math.min(1, Math.max(0, (H*0.35 - wp.y) / (H * 1.35)));
    return clamp(ISO_EL - lift * depth);
  }
  if (wn.y > 0.5){
    // top plane: the further toward the far edge, the higher the view rises
    const away = CAM_DIR.clone().setY(0).normalize().negate();
    const d = wp.clone().setY(0).dot(away) / H;          // -1 near .. +1 far
    const depth = Math.min(1, Math.max(0, (d - 0.05) / 0.95));
    return clamp(ISO_EL + dip * depth);
  }
  return ISO_EL;
}
// ease the camera skew and elevation toward their targets
export function updateSkew(dt){
  const ts = skewTarget(), te = elevTarget();
  const ds = Math.abs(G.skewCur - ts), de = Math.abs(G.elevCur - te);
  if (ds < 0.0005 && de < 0.0005){
    if (G.skewCur !== ts || G.elevCur !== te){
      G.skewCur = ts; G.elevCur = te; applyCamera();
    }
    return;
  }
  const k = 1 - Math.exp(-6 * dt / 1000);
  G.skewCur += (ts - G.skewCur) * k;
  G.elevCur += (te - G.elevCur) * k;
  applyCamera();
}
// on arriving at a new plane, mirror the skew if this plane is the squashed one.
// A side plane is 'favoured' when the camera has swung toward it.
export function updateSkewSign(){
  if (!featureOn('skewView') || featureOn('freeCam')) return;
  const wn = Nf.clone().applyQuaternion(world.quaternion);
  if (Math.abs(wn.y) > 0.5) return;          // top/bottom: no side preference
  // camera azimuth swings toward +z as skew grows: favour whichever side plane
  // the player is on
  const wantSign = wn.z > 0.5 ? 1 : (wn.x > 0.5 ? -1 : G.skewSign);
  G.skewSign = wantSign;
}
// settle the free-spun view: snap to the nearest grid-square orientation, then
// quarter-turn as needed until the player's face is back in view
// Settle the free-spun view. This runs ALONGSIDE the player's step, not before
// it: it starts an independent camera-only ease and reports the settled
// orientation so the step resolves against where the view is going, not where
// it currently is. One key press = snap and step, together.
G.viewEase = null;  // { t, dur, fromQ, toQ } — camera only, never blocks
export function settleView(){
  G.peeked = false;
  let target;
  if (featureOn('freeCam')){
    // free camera: rotate the CUBE so the player's plane faces the camera
    if (playerVisible()) return null;
    target = world.quaternion.clone();
    const axis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 4 && !playerVisible(target); i++){
      target = new THREE.Quaternion()
        .setFromAxisAngle(axis, Math.PI/2).multiply(target).normalize();
    }
    if (!playerVisible(target)) return null;
  } else {
    target = snapToGrid(world.quaternion);
    for (let i = 0; i < 4 && !playerVisible(target); i++){
      target = new THREE.Quaternion()
        .setFromAxisAngle(SCREEN_UP, Math.PI/2)
        .multiply(target).normalize();
    }
  }
  if (world.quaternion.angleTo(target) < 0.02) return null;
  G.viewEase = { t:0, dur:340, fromQ: world.quaternion.clone(), toQ: target.clone() };
  return target;
}
// nearest orientation whose axes are camera-aligned (grid square on screen)
export function snapToGrid(q){
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const cols = [
    new THREE.Vector3().setFromMatrixColumn(m, 0),
    new THREE.Vector3().setFromMatrixColumn(m, 1),
    new THREE.Vector3().setFromMatrixColumn(m, 2),
  ];
  const snap = v => {
    const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
    const i = a.indexOf(Math.max(...a));
    const o = new THREE.Vector3();
    o.setComponent(i, Math.sign(v.getComponent(i)) || 1);
    return o;
  };
  const x = snap(cols[0]);
  let y = snap(cols[1]);
  if (Math.abs(x.dot(y)) > 0.5) y = snap(cols[2]);       // degenerate: use z
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, z)).normalize();
}
