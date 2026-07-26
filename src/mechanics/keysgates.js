// Coloured keys and gates: generation and meshes.
//
// The rule half of this mechanic lives in mechanics/rules/keysgates.js. This
// file only decides where things go and what they look like; solvability is
// not its problem, because every candidate placement is proven by the shared
// solver before it is kept.
import { G } from '../core/globals.js';
import { CELL, FACES, _upY } from '../core/constants.js';
import { cellKey, cellToPoint } from '../core/grid.js';
import { SOLVED, deadline, verifyLevel } from '../gen/verify.js';
import { reachablePositions } from '../core/solver.js';
import { RULES } from './rules/index.js';
import { bevelAmount, bevelledBox, edgeMat } from '../render/blockgeo.js';
import { faceLift } from '../render/player.js';
import { gates, keys } from '../world/level.js';

export const KEY_COLORS = [0xe0a83c, 0x4fb3bf, 0xe8608a, 0x8f6fd6];
let group = null;

export function clearKeysGates(){
  keys.clear();
  gates.clear();
  group = null;
}

// Place `count` key/gate pairs. Each pair is staged, the whole board is
// re-solved, and only then kept - so a gate can never seal off the very key
// that opens it, nor anything else the level still needs.
export function generateKeysGates(count){
  clearKeysGates();
  group = new THREE.Group();
  G.levelGroup.add(group);

  // Candidate cells are gathered ONCE, and from the cheap position-only walk.
  // Calling the full joint reachability per attempt (4 colours x 14 tries) put
  // buildLevel() at ~15s on a busy level 15 - long enough that toggling
  // anything in the LAB felt like the game had hung. Placing a key or a gate
  // never makes a cell reachable that was not reachable before, so one
  // snapshot is a sound pool; the solver still re-proves the real board after
  // every pair.
  const pool = [...reachablePositions(RULES)].filter(k => k !== cellKey(2,2,2));

  const outOfTime = deadline(1500);
  const staged = [];
  for (let colour = 0; colour < Math.min(count, KEY_COLORS.length) && !outOfTime(); colour++){
    let placed = false;
    for (let attempt = 0; attempt < 14 && !placed && !outOfTime(); attempt++){
      const cells = pool.filter(k => !keys.has(k) && !gates.has(k));
      if (cells.length < 4) return finish(staged);

      const keyK  = cells[(Math.random()*cells.length)|0];
      const gateK = cells[(Math.random()*cells.length)|0];
      if (keyK === gateK) continue;

      keys.set(keyK, colour);
      gates.set(gateK, colour);
      if (verifyLevel().result === SOLVED){
        staged.push({ colour, keyK, gateK });
        placed = true;
      } else {
        keys.delete(keyK);
        gates.delete(gateK);
      }
    }
    if (!placed) break;
  }
  return finish(staged);
}

function finish(staged){
  for (const { colour, keyK, gateK } of staged){
    addKeyMesh(keyK, colour);
    addGateMesh(gateK, colour);
  }
  return staged.length;
}

function addKeyMesh(k, colour){
  const [fi, u, v] = k.split(',').map(Number);
  const n = FACES[fi].n;
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(CELL*0.16, CELL*0.05, 8, 16),
    new THREE.MeshLambertMaterial({ color: KEY_COLORS[colour] }));
  m.position.copy(cellToPoint(fi, u, v)).addScaledVector(n, CELL*0.3 + faceLift(fi));
  m.quaternion.setFromUnitVectors(_upY, n);
  m.castShadow = true;
  group.add(m);
}

function addGateMesh(k, colour){
  const [fi, u, v] = k.split(',').map(Number);
  const n = FACES[fi].n;
  const geo = bevelledBox(CELL*0.86, CELL*0.7, CELL*0.86, bevelAmount());
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    color: KEY_COLORS[colour], transparent: true, opacity: 0.55 }));
  m.position.copy(cellToPoint(fi, u, v)).addScaledVector(n, CELL*0.35 + faceLift(fi));
  m.quaternion.setFromUnitVectors(_upY, n);
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  group.add(m);
}
