import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';
import { PSIZE, player } from './player.js';
import { world } from './scene.js';

// ---------- see through: fade whatever hides the player ----------
// A raycast from the camera to the player each frame. Anything it hits on the
// way fades out; everything else fades back. Works for any obstacle type —
// towers, tunnels, wall fins — without special-casing them.
export const occRay = new THREE.Raycaster();
export const occFaded = new Map();      // mesh -> { mat, target }
export const _occFrom = new THREE.Vector3(), _occTo = new THREE.Vector3(), _occDir = new THREE.Vector3();
export const _occUp = new THREE.Vector3(0, 1, 0);

export function updateSeeThrough(dt){
  const on = featureOn('seeThrough');
  const hitNow = new Set();
  if (on && G.levelGroup && G.phase === 'play'){
    _occTo.copy(player.position);
    world.localToWorld(_occTo);                       // player is a child of world
    // orthographic view: cast from a point offset back along the view direction
    _occDir.copy(G.camera.position).normalize();
    const back = _occDir.clone().negate();
    // a spread of rays across the player's silhouette, so a block clipping its
    // edge fades too rather than only dead-centre hits
    const rx = new THREE.Vector3().crossVectors(_occDir, _occUp).normalize();
    const ry = new THREE.Vector3().crossVectors(rx, _occDir).normalize();
    const r = PSIZE * 0.5;
    const offs = [[0,0], [r,0], [-r,0], [0,r], [0,-r]];
    for (const [ox, oy] of offs){
      _occFrom.copy(_occTo).addScaledVector(rx, ox).addScaledVector(ry, oy)
              .addScaledVector(_occDir, 60);
      occRay.set(_occFrom, back);
      occRay.far = 60 - 0.6;                          // stop just short of the player
      const hits = occRay.intersectObjects(G.levelGroup.children, false);
      for (const h of hits){
        const m = h.object;
        if (!m.isMesh || !m.material) continue;
        // only solid obstacles: skip additive glow planes and anything already transparent
        if (m.material.blending === THREE.AdditiveBlending) continue;
        if (m.material.transparent && !occFaded.has(m)) continue;
        hitNow.add(m);
        if (!occFaded.has(m)){
          // materials are shared between meshes — clone so only this one fades
          const mat = m.material.clone();
          mat.transparent = true;
          m.userData._origMat = m.material;
          m.material = mat;
          occFaded.set(m, { mat, target: 0 });
        }
        occFaded.get(m).target = 1;
      }
    }
  }
  // ease every tracked mesh toward its target, restoring finished ones
  const fade = FEATURES.seeThrough.slider.value / 100;
  const k = 1 - Math.exp(-9 * dt / 1000);
  for (const [m, rec] of occFaded){
    if (!hitNow.has(m)) rec.target = 0;
    const want = rec.target ? fade : 1;
    rec.mat.opacity += (want - rec.mat.opacity) * k;
    if (rec.target === 0 && rec.mat.opacity > 0.995){
      // fully restored — hand the shared material back and drop the clone
      if (m.userData._origMat) m.material = m.userData._origMat;
      rec.mat.dispose();
      occFaded.delete(m);
    }
  }
}
export function clearSeeThrough(){
  for (const [m, rec] of occFaded){
    if (m.userData._origMat) m.material = m.userData._origMat;
    rec.mat.dispose();
  }
  occFaded.clear();
}

