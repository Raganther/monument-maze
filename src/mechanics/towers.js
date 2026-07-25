import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';
import { N } from '../core/constants.js';
import { cellKey } from '../core/grid.js';
import { addStack } from '../render/masonry.js';
import { MONUMENTS, addMonument } from '../render/monuments.js';
import { surfaceConnected } from '../world/graph.js';
import { blocked, monumentCells } from '../world/level.js';

// ---------- procedural maze ----------
export function generateObstacles(count){
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 40){
    const fi = (Math.random()*6)|0;
    const u = (Math.random()*N)|0, v = (Math.random()*N)|0;
    if (fi === 2 && u === 2 && v === 2) continue;
    const k = cellKey(fi,u,v);
    if (blocked.has(k) || k === G.finishKey) continue;
    blocked.add(k);
    if (!surfaceConnected()){ blocked.delete(k); continue; }
    // occasionally this landmark becomes a little monument instead of a stack.
    // Rare by construction — most cells stay flat, so they read as landmarks.
    const monO = featureOn('monuments') ? FEATURES.monuments.slider.value / 100 : 0;
    if (monO > 0 && Math.random() < monO * 0.22){
      const kind = MONUMENTS[(Math.random()*MONUMENTS.length)|0];
      addMonument(kind, fi, u, v);
      monumentCells.push(cellKey(fi, u, v));
      placed++;
      continue;
    }
    // mostly flat so the surface stays readable, but the occasional stack —
    // and the rare capped tower — keeps the skyline charming. Rarity is what
    // makes a tower a landmark instead of clutter.
    let h = 1;
    if (Math.random() < 0.18) h++;
    if (Math.random() < 0.2) h++;           // ~3.5% reach three
    addStack(fi, u, v, h, h >= 3);          // every tower gets its pyramid cap
    placed++;
  }
}

// procedural rails: same discipline as blocks — any rail that would seal
// off a region is rejected, so the surface always stays one walkable whole
