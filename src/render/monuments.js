import { G } from '../core/globals.js';
import { CELL, FACES, _upY } from '../core/constants.js';
import { cellKey, cellToPoint } from '../core/grid.js';
import { seededRand } from '../core/rng.js';
import { bevelAmount, bevelledBox, capMat, stoneA, stoneB, stoneMat } from './blockgeo.js';
import { blocked } from '../world/level.js';

// ---------- monuments: occasional landmarks, one cell each ----------
// Each occupies a single cell's footprint exactly as a block does, so it
// registers as an ordinary blocked cell — the movement graph and solvability
// system never know the difference. Pure silhouette on top of a normal block.
export function addMonument(kind, faceIdx, u, v){
  blocked.add(cellKey(faceIdx, u, v));
  const f = FACES[faceIdx];
  const base = cellToPoint(faceIdx, u, v);
  const q = new THREE.Quaternion().setFromUnitVectors(_upY, f.n);
  const g = new THREE.Group();
  g.position.copy(base);
  g.quaternion.copy(q);
  G.levelGroup.add(g);
  const mk = (w, h, d, up, mat) => {
    const m = new THREE.Mesh(bevelledBox(w, h, d, bevelAmount()), mat || stoneA);
    m.position.set(0, up + h/2, 0);   // local: +y is out of the face
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const tint = (i) => stoneMat(i % 2 ? stoneB : stoneA, faceIdx, u, v, i);

  if (kind === 'ziggurat'){
    // three stacked tiers, each smaller — a stepped monument
    mk(G.BLOCK,        CELL*0.5, G.BLOCK,        0,        tint(0));
    mk(G.BLOCK*0.68,   CELL*0.42, G.BLOCK*0.68,  CELL*0.5, tint(1));
    mk(G.BLOCK*0.38,   CELL*0.36, G.BLOCK*0.38,  CELL*0.92, tint(2));
  } else if (kind === 'obelisk'){
    // a broad-based tapering monument — wide foot, narrowing to a capped point
    const foot = mk(G.BLOCK*0.72, CELL*0.4, G.BLOCK*0.72, 0, tint(0));   // solid plinth
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(G.BLOCK*0.2, G.BLOCK*0.46, CELL*1.5, 4),
      tint(1));
    shaft.position.set(0, CELL*0.4 + CELL*0.75, 0);
    shaft.rotation.y = Math.PI/4;
    shaft.castShadow = true; shaft.receiveShadow = true;
    g.add(shaft);
    // a small pyramid cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(G.BLOCK*0.21, CELL*0.4, 4), capMat);
    cap.position.set(0, CELL*0.4 + CELL*1.5 + CELL*0.2, 0);
    cap.rotation.y = Math.PI/4;
    cap.castShadow = true;
    g.add(cap);
  } else if (kind === 'stepPyramid'){
    // a squat stepped pyramid — four shrinking tiers, low and broad
    mk(G.BLOCK,      CELL*0.32, G.BLOCK,      0,        tint(0));
    mk(G.BLOCK*0.76, CELL*0.30, G.BLOCK*0.76, CELL*0.32, tint(1));
    mk(G.BLOCK*0.52, CELL*0.28, G.BLOCK*0.52, CELL*0.62, tint(2));
    mk(G.BLOCK*0.28, CELL*0.26, G.BLOCK*0.28, CELL*0.90, tint(3));
  } else if (kind === 'pillars'){
    // a pair of standing stones flanking a low slab — a shrine
    const l = mk(G.BLOCK*0.26, CELL*1.25, G.BLOCK*0.34, 0, tint(0)); l.position.x = -G.BLOCK*0.3;
    const r2 = mk(G.BLOCK*0.26, CELL*1.25, G.BLOCK*0.34, 0, tint(1)); r2.position.x = G.BLOCK*0.3;
    mk(G.BLOCK*0.5, CELL*0.3, G.BLOCK*0.5, 0, tint(2));                // low altar between
  } else if (kind === 'monolith'){
    // a single leaning slab — a standing stone, tilted just off vertical
    const slab = mk(G.BLOCK*0.5, CELL*1.6, G.BLOCK*0.28, 0, tint(0));
    slab.rotation.z = 0.11;
    slab.position.x = -CELL*0.08;
  } else if (kind === 'cairn'){
    // a rough pile — stacked stones of shrinking size, slightly offset
    const seed = seededRand((faceIdx*31 + u*7 + v*13 + 61) >>> 0);
    let yy = 0;
    const tiers = 4;
    for (let i = 0; i < tiers; i++){
      const sz = G.BLOCK * (0.8 - i*0.16);
      const hh = CELL * (0.34 - i*0.04);
      const st = mk(sz, hh, sz, yy, tint(i));
      st.position.x = (seed() - 0.5) * G.BLOCK * 0.18;   // rough offset
      st.position.z = (seed() - 0.5) * G.BLOCK * 0.18;
      st.rotation.y = (seed() - 0.5) * 0.5;
      yy += hh;
    }
  } else if (kind === 'arch'){
    // two legs and a lintel — a gateway you can't pass but can see through
    const legW = G.BLOCK*0.3;
    const l1 = mk(legW, CELL*1.3, G.BLOCK, 0, tint(0)); l1.position.x = -G.BLOCK*0.32;
    const l2 = mk(legW, CELL*1.3, G.BLOCK, 0, tint(1)); l2.position.x =  G.BLOCK*0.32;
    mk(G.BLOCK, CELL*0.34, G.BLOCK, CELL*1.3, tint(2));   // lintel across the top
  }
}
export const MONUMENTS = ['ziggurat', 'obelisk', 'arch', 'stepPyramid', 'pillars', 'monolith', 'cairn'];

