import { G } from '../core/globals.js';
import { sfxBreath, sfxWood } from '../audio/sfx.js';
import { featureOn, timerActive } from '../config/features.js';
import { isGoalObjective } from '../config/modes.js';
import { CELL, FACES, HOLE_DEPTH, _upY } from '../core/constants.js';
import { cellKey, faceIndexOf, pointToCell } from '../core/grid.js';
import { keys, pollKeys } from './input.js';
import { PORTAL_DWELL, buildLevel, emergeFromPortal, failLevel, levelComplete, respawn, startChargeTone, startFall, startPortal, stopChargeTone } from './lifecycle.js';
import { executeStep } from './movement.js';
import { spin, updateSkew, updateSkewSign } from './view.js';
import { checkGem } from '../mechanics/gems.js';
import { tickKeystone } from '../mechanics/keystone.js';
import { tickPushBlocks } from '../mechanics/pushblocks.js';
import { applyPalette } from '../render/blockgeo.js';
import { Nf, P, PSIZE, faceLift, placePlayer, player, playerTargetQuat } from '../render/player.js';
import { applyCamera, renderer, scene, setupCamera, world } from '../render/scene.js';
import { updateSeeThrough } from '../render/seethrough.js';
import { dots, drawTrail } from '../render/trail.js';
import { updateTimeHUD } from '../ui/hud.js';
import { gems, holes, oneways, portalFX, portals } from '../world/level.js';

// ---------- easing ----------
export const easeSlide = t => 1 - (1-t)*(1-t);
export const easeFlip  = t => t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
export const _flipV = new THREE.Vector3(), _flipQ = new THREE.Quaternion();

// ---------- main loop ----------
G.last = performance.now();
export function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(50, now - G.last); G.last = now;

  if (G.phase === 'menu'){
    if (featureOn('freeCam')){ G.camAz += 0.00035 * dt; applyCamera(); }
    else world.rotateY(0.00035 * dt);   // gentle attract-mode spin
  }

  if (G.phase === 'play' && timerActive()){
    G.timeLeft -= dt / 1000;
    if (G.timeLeft <= 0){ G.timeLeft = 0; updateTimeHUD(); failLevel(); }
    else {
      updateTimeHUD();
      // a soft tick in the last ten seconds, quickening as it runs out
      if (G.timeLeft <= 10){
        const step = G.timeLeft <= 3 ? 0.25 : G.timeLeft <= 6 ? 0.5 : 1;
        if (Math.floor(G.timeLeft/step) !== Math.floor((G.timeLeft + dt/1000)/step))
          sfxWood(1200, 0.04, 0.16, 12);
      }
    }
  }

  // camera rotation runs regardless of movement state — hold Q/E while walking
  if (G.phase === 'play'){
    if (keys['KeyQ'])      spin(1, dt);
    else if (keys['KeyE']) spin(-1, dt);
  }
  if (G.phase === 'play' && G.state === 'idle'){
    pollKeys();
  } else if (G.tw){
    G.tw.t += dt;
    const raw = Math.min(1, G.tw.t / G.tw.dur);
    if (G.state === 'fall'){
      const k = raw * raw; // accelerate downward
      player.position.copy(G.tw.c0).addScaledVector(G.tw.n, -k * HOLE_DEPTH);
      player.scale.setScalar(Math.max(0.35, 1 - 0.5 * k));
      if (raw >= 1) respawn();
    } else if (G.state === 'bounce'){
      // out-and-back: a quick lurch toward the barrier, then a spring return.
      // sin gives a smooth there-and-back; the cube visibly refuses the move.
      const push = Math.sin(raw * Math.PI) * CELL * 0.32;
      const local = G.tw.fromP.clone().addScaledVector(G.tw.pushDir, push);
      P.copy(local);
      player.position.copy(P).addScaledVector(Nf, PSIZE/2 + 0.01 + faceLift(faceIndexOf(Nf)));
      // a tiny recoil tilt into the barrier for physicality
      const tilt = Math.sin(raw * Math.PI) * 0.18;
      const axis = new THREE.Vector3().crossVectors(Nf, G.tw.pushDir).normalize();
      _flipQ.setFromAxisAngle(axis, tilt);
      player.quaternion.copy(_flipQ);
      if (raw >= 1){
        P.copy(G.tw.fromP);
        player.position.copy(P).addScaledVector(Nf, PSIZE/2 + 0.01 + faceLift(faceIndexOf(Nf)));
        player.quaternion.identity();
        G.tw = null; G.state = 'idle';
      }
    } else if (G.state === 'portalIn'){
      const k = raw * raw;
      player.position.copy(G.tw.c0).addScaledVector(G.tw.n, -k * HOLE_DEPTH);
      player.scale.setScalar(Math.max(0.4, 1 - 0.5 * k));
      if (raw >= 1) emergeFromPortal(G.tw.dest);
    } else if (G.state === 'portalOut'){
      const k = 1 - (1 - raw) * (1 - raw);
      world.quaternion.copy(G.tw.fromQ).slerp(G.tw.toQ, k);
      player.position.copy(G.tw.c1).addScaledVector(Nf, -HOLE_DEPTH * (1 - k));
      player.scale.setScalar(0.5 + 0.5 * k);
      if (raw >= 1){
        world.quaternion.copy(G.tw.toQ);
        player.scale.setScalar(1);
        G.tw = null; G.state = 'idle';
        drawTrail();
      }
    } else {
      if (G.state === 'slide'){
        P.copy(G.tw.fromP).lerp(G.tw.toP, easeSlide(raw));
      } else {
        const k = easeFlip(raw);
        P.copy(G.tw.fromP).lerp(G.tw.toP, k);
        if (G.state === 'swivel') world.quaternion.copy(G.tw.fromQ).slerp(G.tw.toQ, k);
        _flipV.copy(G.tw.c0).lerp(G.tw.c1, k)
          .addScaledVector(G.tw.bulge, Math.sin(Math.PI * k) * CELL * 0.45);
        player.position.copy(_flipV);
        _flipQ.setFromAxisAngle(G.tw.axis, k * Math.PI / 2);
        player.quaternion.copy(_flipQ).multiply(G.tw.q0);
      }
      if (raw >= 1){
        P.copy(G.tw.toP);
        if (G.tw.toQ){ world.quaternion.copy(G.tw.toQ).normalize(); }
        G.tw = null; G.state = 'idle';
        updateSkewSign();      // cube has settled: favour the plane we're on
        const fi = faceIndexOf(Nf);
        const c = pointToCell(fi, P);
        const hereK = cellKey(fi, c.u, c.v);
        if (holes.has(hereK)) startFall();
        else if (portals.has(hereK)){
          G.portalArmed = { key: hereK, t: 0 };
          startChargeTone(hereK);
        }
        else {
          checkGem();
          if (isGoalObjective() && G.finishKey === hereK) levelComplete();
          else drawTrail();
          // one-way tile: it carries you onward — a short beat, then a push in
          // the arrow's direction, so stepping on commits you across it
          const owDir = oneways.get(hereK);
          if (owDir && G.state === 'idle'){
            G.autoPush = { dir: owDir.clone(), t: performance.now() + 130 };
          }        }
      }
    }
  }

  if (G.state !== 'flip' && G.state !== 'swivel' && G.state !== 'fall'
      && G.state !== 'portalIn' && G.state !== 'portalOut'){
    placePlayer(P);
    player.quaternion.slerp(playerTargetQuat(), 1 - Math.exp(-0.012*dt*60));
  }

  // portal light: steady, with a flare on activation and a visible charge-up
  // one-way auto-push: after landing on an arrow tile and a short beat, the
  // tile carries the player onward in its direction (with a soft push sound)
  if (G.autoPush && G.state === 'idle' && G.phase === 'play'){
    if (now >= G.autoPush.t){
      const dir = G.autoPush.dir;
      G.autoPush = null;
      sfxWood(300, 0.05, 0.3, 6);            // a gentle shove onward
      sfxBreath(600, 750, 0.14, 0.05);
      executeStep(dir, world.quaternion);
    }
  } else if (G.autoPush && G.state !== 'idle' && G.state !== 'bounce'){
    // player did something else mid-beat that isn't a bounce — cancel the push
    // (bounce means they tried the wrong way and are still on the tile)
  }

  // while the player dwells on it
  const t = now * 0.001;
  for (const fx of portalFX.values()){
    fx.flare = Math.max(0, fx.flare - dt/450);
    const f = 1 + fx.flare * 2.5 + (fx.charge || 0) * 1.6;
    fx.lightMat.opacity = Math.min(0.85, 0.32 * f);
    fx.light.intensity  = 0.45 * (1 + fx.flare * 3.5 + (fx.charge || 0) * 2);
  }

  // gem idle animation
  for (const g of gems){
    if (g.taken) continue;
    g.mesh.rotateOnAxis(_upY, 0.015);
    g.mesh.position.copy(g.pos).addScaledVector(
      FACES[g.face].n,
      CELL*0.35 + faceLift(g.face) + Math.sin(t*2 + g.phase)*CELL*0.06
    );
  }

  // solution trail: a pulse flows along the dots toward the goal
  for (const d of dots){
    const w = Math.sin(t*3 - d.i*0.45);
    d.mesh.material.opacity = 0.28 + 0.34 * Math.max(0, w);
    d.mesh.scale.setScalar(d.base * (0.85 + 0.3 * Math.max(0, w)));
  }

  // independent camera settle — runs alongside movement, never blocks it.
  // Yields to crossings, which own the cube's rotation while they animate.
  if (G.viewEase){
    if (G.state === 'swivel' || G.state === 'portalOut'){
      G.viewEase = null;                    // the crossing takes over
    } else {
      G.viewEase.t += dt;
      const k = Math.min(1, G.viewEase.t / G.viewEase.dur);
      world.quaternion.copy(G.viewEase.fromQ).slerp(G.viewEase.toQ, easeFlip(k));
      if (k >= 1){ world.quaternion.copy(G.viewEase.toQ).normalize(); G.viewEase = null; }
    }
  }

  // portal dwell: linger on a portal and it takes you; step away and it doesn't
  if (G.portalArmed && G.phase === 'play' && G.state === 'idle'){
    G.portalArmed.t += dt;
    const fx = portalFX.get(G.portalArmed.key);
    if (fx) fx.charge = Math.min(1, G.portalArmed.t / PORTAL_DWELL);
    if (G.portalArmed.t >= PORTAL_DWELL){
      const k = G.portalArmed.key;
      G.portalArmed = null;
      stopChargeTone();
      startPortal(k);
    }
  }

  if (G.phase === 'play') updateSkew(dt);
  if (G.phase === 'play') tickKeystone(dt);
  if (G.phase === 'play') tickPushBlocks(dt);
  updateSeeThrough(dt);

  renderer.render(scene, G.camera);
}

applyPalette();        // set the default stone palette before first build
buildLevel();          // decorative backdrop behind the menu
requestAnimationFrame(frame);

addEventListener('resize', () => {
  setupCamera();
  renderer.setSize(innerWidth, innerHeight);
});
