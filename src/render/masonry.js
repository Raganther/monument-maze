import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';
import { CELL, FACES, _upY } from '../core/constants.js';
import { cellKey, cellToPoint } from '../core/grid.js';
import { seededRand } from '../core/rng.js';
import { bevelAmount, bevelledBox, capMat, cellHash, edgeMat, stoneA, stoneB, stoneMat } from './blockgeo.js';
import { blocked } from '../world/level.js';

// ---------- masonry: blocks built from smaller stones ----------
// A cell block can be laid up from several smaller stones instead of cast as
// one — different sizes, slightly loose, like hand-set masonry. Purely visual:
// the cell is still one blocked cell, this just fills its volume differently.
// build the little stones that fill one cell-block, into group g (local space,
// +y out of the face), spanning y in [0, CELL]. w,d are the block footprint.
export function layStones(g, w, d, faceIdx, u, v, tier, topTier, vh){
  const rnd = seededRand((faceIdx*131 + u*17 + v*7 + tier*2749) >>> 0);
  const r = bevelAmount() * 0.6;
  const rough = featureOn('masonry') ? (FEATURES.masonry.sliders[0].value / 100) : 0;
  const inset = 0.008;                        // hairline mortar line
  const visH = CELL * (vh || 1);              // total rendered height (visual only)
  let placed = 0;
  const put = (cx, cy, cz, sw, sh, sd, matIdx) => {
    const m = new THREE.Mesh(bevelledBox(sw, sh, sd, Math.min(r, sh*0.3, sw*0.3)),
                             stoneMat(matIdx % 2 ? stoneB : stoneA, faceIdx, u, v, tier*8 + matIdx));
    m.position.set(cx, cy, cz);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    placed++;
  };

  // Courses stacked bottom to top. The masonry rule: nothing rests on air, so
  // a course can only ever be as wide as — or narrower than — the one below it.
  // The base is always solid and full-width; breaking-up happens toward the top.
  // more courses when the block stands taller, so extra height reads as extra
  // stacked stones rather than one stretched course
  const extraCourses = (vh || 1) > 1.2 ? 1 : 0;
  const courses = 1 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.35 ? 1 : 0) + extraCourses;
  const heights = [];
  for (let c = 0; c < courses; c++) heights.push(0.6 + rnd()*0.8);
  const hSum = heights.reduce((a,b)=>a+b, 0);

  // each course occupies a footprint window [lo,hi] along one axis; it must sit
  // within the window of the course below it (so it's always supported)
  const along = rnd() < 0.5;                  // which horizontal axis we split on
  let winLo = 0, winHi = 1;                   // full width at the base
  let y = 0;
  for (let c = 0; c < courses; c++){
    const isTop = (c === courses - 1);
    const ch = visH * heights[c] / hSum;
    const winW = winHi - winLo;

    // how many stones this course breaks into — more likely higher up
    const breakBias = c / Math.max(1, courses - 1);
    const n = 1 + (rnd() < 0.4 + 0.4*breakBias ? 1 : 0) + (rnd() < 0.2*breakBias ? 1 : 0);
    const segs = [0];
    for (let i = 1; i < n; i++) segs.push(segs[i-1] + (0.7 + rnd()*0.6));
    const segSpan = segs[n-1] + (0.7 + rnd()*0.6);

    // the course as a whole may occupy less than the full window below (inset
    // from one or both sides) — but always stays inside it, so it's supported
    let cLo = winLo, cHi = winHi;
    if (c > 0 && rough > 0 && rnd() < rough * 0.6){
      const shrink = rnd() * rough * 0.35 * winW;
      if (rnd() < 0.5) cLo += shrink; else cHi -= shrink;
    }
    const cW = cHi - cLo;

    for (let s = 0; s < n; s++){
      const p0 = (s === 0 ? 0 : segs[s]) / segSpan;
      const p1 = (s+1 < n ? segs[s+1] : segSpan) / segSpan;
      const lo = cLo + cW * p0, hi = cLo + cW * p1;
      let sh = ch, cy = y + sh/2;

      // roughness only erodes the TOP course: drop stones and shave heights,
      // never touching the supporting courses below
      if (rough > 0 && topTier && isTop){
        const isLastPossible = (s === n - 1 && placed === 0);
        if (rnd() < rough * 0.3 && !isLastPossible) continue;
        const cut = rnd() * rough * 0.55 * ch;
        sh = Math.max(CELL*0.12, ch - cut);
        cy = y + sh/2;                         // rests on the course floor
      }

      const mid = (lo + hi) / 2 - 0.5;         // centre offset from cell centre
      const size = (hi - lo);
      if (along){
        put(mid * w, cy, 0, size * w - inset, sh - inset, cW * d - inset, c*3 + s);
      } else {
        put(0, cy, mid * d, cW * w - inset, sh - inset, size * d - inset, c*3 + s);
      }
    }

    // the next course must sit within THIS course's footprint window
    winLo = cLo; winHi = cHi;
    y += ch;
  }

  if (placed === 0){
    put(0, CELL*0.3, 0, w - inset, CELL*0.6, d - inset, 0);
  }
  return placed;
}

// Purely-visual height variation for masonry obstacle blocks: a tumbledown
// skyline where some render short, some full, some with an extra course
// stacked above. This does NOT touch the logical `height` — the cell is still
// the same solid obstacle in routing; only what's drawn changes.
export function masonryVisualHeight(faceIdx, u, v){
  const hv = featureOn('masonry') ? FEATURES.masonry.sliders[1].value / 100 : 0;
  if (hv <= 0) return 1;                          // full cube, as before
  const r = cellHash(faceIdx, u, v, 5171);
  // map to discrete levels so it reads as whole stones/courses, not a smooth
  // stretch: 0.35, 0.5, 0.7, 1.0 (full), 1.35, 1.7 — biased toward full
  const levels = [0.35, 0.5, 0.7, 1.0, 1.0, 1.0, 1.35, 1.7];
  const pick = levels[Math.floor(r * levels.length)];
  // hv scales how far from full we allow: at low hv most stay near 1
  return 1 + (pick - 1) * hv;
}

export function addStack(faceIdx, u, v, height, cap){
  blocked.add(cellKey(faceIdx, u, v));
  const f = FACES[faceIdx];
  const base = cellToPoint(faceIdx, u, v);
  const q = new THREE.Quaternion().setFromUnitVectors(_upY, f.n);
  const masO = featureOn('masonry') ? FEATURES.masonry.slider.value / 100 : 0;
  // visual height only applies to the topmost tier of a masonry stack
  const vHeight = masonryVisualHeight(faceIdx, u, v);
  for (let i = 0; i < height; i++){
    // this tier is either one cast block or laid up from smaller stones
    const rnd = (cellHash(faceIdx, u, v, i * 977) );
    const isTop = (i === height - 1);
    if (masO > 0 && rnd < masO){
      const g = new THREE.Group();
      g.position.copy(base).addScaledVector(f.n, CELL * i);
      g.quaternion.copy(q);
      G.levelGroup.add(g);
      // only the top tier stretches/shrinks visually; lower tiers stay solid
      layStones(g, G.BLOCK, G.BLOCK, faceIdx, u, v, i, isTop, isTop ? vHeight : 1);
    } else {
      const m = new THREE.Mesh(G.blockGeo, stoneMat(i % 2 ? stoneB : stoneA, faceIdx, u, v, i));
      m.position.copy(base).addScaledVector(f.n, CELL * (i + 0.5));
      m.quaternion.copy(q);
      m.castShadow = true; m.receiveShadow = true;
      m.add(new THREE.LineSegments(G.blockEdges, edgeMat));
      G.levelGroup.add(m);
    }
  }
  if (cap){
    const c = new THREE.Mesh(new THREE.ConeGeometry(G.BLOCK*0.62, CELL*0.8, 4), capMat);
    c.castShadow = true;
    c.position.copy(base).addScaledVector(f.n, CELL * height + CELL * 0.4);
    c.quaternion.copy(q);
    c.rotateOnAxis(_upY, Math.PI/4);
    G.levelGroup.add(c);
  }
}

// rails: shelved system, kept ready
