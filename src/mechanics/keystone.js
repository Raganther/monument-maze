import { G } from '../core/globals.js';
import { sfxBell } from '../audio/sfx.js';
import { CELL, FACES, _upY } from '../core/constants.js';
import { cellKey, cellToPoint, faceIndexOf, pointToCell } from '../core/grid.js';
import { levelComplete } from '../game/lifecycle.js';
import { bfsFrom } from '../gen/fairness.js';
import { bevelAmount, bevelledBox } from '../render/blockgeo.js';
import { Nf, P } from '../render/player.js';
import { drawTrail } from '../render/trail.js';
import { updateGemHUD } from '../ui/hud.js';
import { gems, holes, portals } from '../world/level.js';

// place the keystone: a low shrine dais on a walkable cell, as far from the
// start as reachability allows, so reaching it is a genuine journey. Walkable
// and reachable, so it never blocks solvability — it's a destination, not a wall.
export function placeKeystone(){
  const dist = bfsFrom(2, 2, 2);              // steps from the start cell
  let best = null, bestD = -1;
  for (const [k, d] of dist){
    const [fi, u, v] = k.split(',').map(Number);
    if (fi === 2 && u === 2 && v === 2) continue;
    if (holes.has(k) || portals.has(k)) continue;
    // avoid sitting on a gem cell
    let onGem = false;
    for (const g of gems){ const gc = pointToCell(g.face, g.pos);
      if (g.face === fi && gc.u === u && gc.v === v){ onGem = true; break; } }
    if (onGem) continue;
    if (d > bestD){ bestD = d; best = k; }
  }
  if (!best) return;
  G.keystoneCell = best;
  const [fi, u, v] = best.split(',').map(Number);
  const n = FACES[fi].n;
  const base = cellToPoint(fi, u, v);
  const q = new THREE.Quaternion().setFromUnitVectors(_upY, n);
  const g = new THREE.Group();
  g.position.copy(base); g.quaternion.copy(q);
  G.levelGroup.add(g);
  G.keystoneGroup = g;
  // a low two-tier dais with a small standing stone — reads as a shrine, but
  // flat enough to stand on
  const daisMat = new THREE.MeshLambertMaterial({ color:0xe0d0b8 });
  const d1 = new THREE.Mesh(bevelledBox(CELL*0.9, CELL*0.12, CELL*0.9, bevelAmount()), daisMat);
  d1.position.set(0, CELL*0.06, 0); d1.castShadow = true; d1.receiveShadow = true;
  g.add(d1);
  const d2 = new THREE.Mesh(bevelledBox(CELL*0.6, CELL*0.1, CELL*0.6, bevelAmount()), daisMat);
  d2.position.set(0, CELL*0.17, 0); d2.castShadow = true; d2.receiveShadow = true;
  g.add(d2);
  // a small dormant marker stone in the centre — glows gently even while
  // dormant so you can spot the shrine, then blazes when awake
  const markMat = new THREE.MeshLambertMaterial({ color:0xb8a89a, emissive:0x4a3a2a });
  const mark = new THREE.Mesh(new THREE.ConeGeometry(CELL*0.16, CELL*0.5, 5), markMat);
  mark.position.set(0, CELL*0.47, 0); mark.rotation.y = Math.PI/5;
  mark.castShadow = true;
  g.add(mark);
  G.keystoneGroup.userData.mark = mark;
  // a faint dormant light column — thin and dim, a candle not a beacon — so the
  // shrine reads as "something here" from across the surface before it wakes
  const dormMat = new THREE.MeshBasicMaterial({
    color:0xe8c890, transparent:true, opacity:0.18,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
  const dormCol = new THREE.Mesh(
    new THREE.CylinderGeometry(CELL*0.06, CELL*0.14, CELL*1.1, 5, 1, true), dormMat);
  dormCol.position.set(0, CELL*0.9, 0);
  g.add(dormCol);
  G.keystoneGroup.userData.dormant = dormCol;
}

// ---------- keystone: the awakened monument that ends the level ----------
// When KEYSTONE is on, collecting every gem doesn't finish the level — instead
// it awakens one monument, and the player must journey to it and dwell there.
// The monument is an ordinary reachable cell (solvability already guarantees a
// path to it), so this composes without touching the movement graph.
G.keystoneCell = null;  // "fi,u,v" of the chosen monument
G.keystoneGroup = null;  // its mesh group, for the awaken glow
G.keystoneAwake = false;
G.keystoneCharge = 0;  // dwell progress 0..1
G.keystoneBeacon = null;  // the light column shown when awake
export const KEYSTONE_DWELL = 500;

export function awakenKeystone(){
  if (G.keystoneAwake || !G.keystoneCell) return;
  G.keystoneAwake = true;
  const [fi, u, v] = G.keystoneCell.split(',').map(Number);
  const n = FACES[fi].n;
  const base = cellToPoint(fi, u, v);
  // a rising column of warm light so it calls to you across the surface
  const col = new THREE.Color(0xffd98a);
  const geo = new THREE.CylinderGeometry(CELL*0.18, CELL*0.42, CELL*3.2, 5, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: col, transparent:true, opacity:0.0,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
  G.keystoneBeacon = new THREE.Mesh(geo, mat);
  G.keystoneBeacon.position.copy(base).addScaledVector(n, CELL*1.6);
  G.keystoneBeacon.quaternion.setFromUnitVectors(_upY, n);
  G.levelGroup.add(G.keystoneBeacon);
  const light = new THREE.PointLight(0xffd98a, 0, 4, 2);
  light.position.copy(base).addScaledVector(n, CELL*0.8);
  G.levelGroup.add(light);
  G.keystoneBeacon.userData.light = light;
  if (G.keystoneGroup && G.keystoneGroup.userData.mark){
    G.keystoneGroup.userData.mark.material.emissive.setHex(0xffb060);
  }
  if (G.keystoneGroup && G.keystoneGroup.userData.dormant){
    G.keystoneGroup.userData.dormant.visible = false;   // bright beacon takes over
  }
  sfxBell(392, 1.4, 0.2);                     // a low chime: the way is open
  setTimeout(() => sfxBell(587.33, 1.6, 0.2), 140);
  updateGemHUD();
  drawTrail();
}

export function tickKeystone(dt){
  // gently breathe the dormant shrine so it's spottable before it wakes
  if (G.keystoneGroup && !G.keystoneAwake && G.keystoneGroup.userData.dormant){
    const t = performance.now() * 0.001;
    G.keystoneGroup.userData.dormant.material.opacity = 0.12 + 0.10*Math.sin(t*1.5);
    G.keystoneGroup.userData.dormant.rotation.y += 0.005;
  }
  if (!G.keystoneBeacon) return;
  const t = performance.now() * 0.001;
  const pulse = 0.6 + 0.4*Math.sin(t*2);
  const on = 0.35 + G.keystoneCharge * 0.5;
  G.keystoneBeacon.material.opacity = on * pulse;
  G.keystoneBeacon.userData.light.intensity = (0.6 + G.keystoneCharge*1.5) * pulse;
  G.keystoneBeacon.rotation.y += 0.01;
  // are we standing on the keystone?
  if (G.state === 'idle' && G.phase === 'play'){
    const fi = faceIndexOf(Nf);
    const c = pointToCell(fi, P);
    if (cellKey(fi, c.u, c.v) === G.keystoneCell){
      G.keystoneCharge = Math.min(1, G.keystoneCharge + dt/KEYSTONE_DWELL);
      if (G.keystoneCharge >= 1) levelComplete();
    } else {
      G.keystoneCharge = Math.max(0, G.keystoneCharge - dt/250);
    }
  }
}

// ---------- GAUNTLET: path-first gated puzzle generation ----------
// Instead of filling randomly then checking solvability, we DESIGN the solution
// first: carve one winding critical path from start to goal, then hang the
// mechanics (one-way runs, mandatory portal bridges, tunnels) ONTO that path so
// they're load-bearing — the route only works if you use them. Everything off
// the path is walled into dead-ends and escapable traps to hide the route.

// geometric neighbours of a cell: [nf, nu, nv, seamKey, dir] for each of 4 sides
