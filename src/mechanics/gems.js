import { G } from '../core/globals.js';
import { sfxBell } from '../audio/sfx.js';
import { FEATURES, featureOn } from '../config/features.js';
import { CELL, FACES, N, _upY } from '../core/constants.js';
import { cellKey, cellToPoint, faceIndexOf } from '../core/grid.js';
import { levelComplete } from '../game/lifecycle.js';
import { awakenKeystone } from './keystone.js';
import { Nf, P, faceLift } from '../render/player.js';
import { updateGemHUD } from '../ui/hud.js';
import { walkable } from '../world/graph.js';
import { gems, holes, portals } from '../world/level.js';

// ---------- gems ----------
G.gemCount = 0; G.gemsTotal = 0;
export const gemGeo = new THREE.OctahedronGeometry(CELL*0.22);
export const gemMat = new THREE.MeshLambertMaterial({ color:0xd9a63a, emissive:0x8a5f10, emissiveIntensity:0.5 });

export function spawnGems(count){
  const taken = new Set([cellKey(2,2,2)]);
  let made = 0, guard = 0;
  while (made < count && guard++ < 800){
    const fi = (Math.random()*6)|0;
    const u = (Math.random()*N)|0, v = (Math.random()*N)|0;
    const k = cellKey(fi,u,v);
    if (taken.has(k) || holes.has(k) || portals.has(k) || !walkable(fi,u,v)) continue;
    taken.add(k);
    const pos = cellToPoint(fi, u, v);
    const m = new THREE.Mesh(gemGeo, gemMat.clone());
    m.castShadow = true;
    m.position.copy(pos).addScaledVector(FACES[fi].n, CELL*0.35 + faceLift(fi));
    m.quaternion.setFromUnitVectors(_upY, FACES[fi].n);
    G.levelGroup.add(m);
    gems.push({ face:fi, pos, mesh:m, taken:false, phase:Math.random()*6 });
    made++;
  }
  return made;
}

export function checkGem(){
  const fi = faceIndexOf(Nf);
  for (const g of gems){
    if (!g.taken && g.face === fi && g.pos.distanceTo(P) < CELL*0.4){
      g.taken = true;
      G.levelGroup.remove(g.mesh);
      G.gemCount++;
      // ascending pentatonic — a collection run reads as a phrase, not repetition
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
      const semis = scale[Math.min(G.gemCount - 1, scale.length - 1)];
      sfxBell(523.25 * Math.pow(2, semis/12), 0.7, 0.22);
      for (const fk of Object.keys(FEATURES))
        if (FEATURES[fk].on && FEATURES[fk].onGem) FEATURES[fk].onGem();
      updateGemHUD();
      if (G.gemCount >= G.gemsTotal){
        if (featureOn('keystone') && G.keystoneCell) awakenKeystone();
        else levelComplete();
      }
    }
  }
}

