import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';
import { CELL } from '../core/constants.js';

// ---------- bevelled blocks ----------
// three r128 has no rounded box, so build one: subdivide a box and project
// every vertex onto a rounded-box surface (clamp to the inner box, push out
// by the radius). Gives a true bevel on all twelve edges and eight corners.
export function makeRoundedBox(w, h, d, r, seg){
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = g.attributes.position;
  const cx = w/2 - r, cy = h/2 - r, cz = d/2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++){
    v.fromBufferAttribute(pos, i);
    c.set(
      Math.max(-cx, Math.min(cx, v.x)),
      Math.max(-cy, Math.min(cy, v.y)),
      Math.max(-cz, Math.min(cz, v.z)));
    v.sub(c);
    const len = v.length();
    if (len > 1e-6) v.multiplyScalar(r / len);
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
export const bevelAmt = () => featureOn('bevel') ? FEATURES.bevel.slider.value / 100 : 0;

// A box with all twelve edges softened. Three r128 has no bevelled box, so:
// extrude a rounded-corner square (rounds the 4 vertical edges) with bevelling
// enabled (rounds the 8 top/bottom edges). The result catches light along
// every corner — the trick that makes low-poly geometry look crafted.
export function makeBevelBox(w, h, d, r){
  r = Math.min(r, Math.min(w, d) * 0.32, h * 0.45);
  const x = w/2 - r, z = d/2 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -d/2);
  shape.lineTo(x, -d/2);
  shape.quadraticCurveTo(w/2, -d/2, w/2, -z);
  shape.lineTo(w/2, z);
  shape.quadraticCurveTo(w/2, d/2, x, d/2);
  shape.lineTo(-x, d/2);
  shape.quadraticCurveTo(-w/2, d/2, -w/2, z);
  shape.lineTo(-w/2, -z);
  shape.quadraticCurveTo(-w/2, -d/2, -x, -d/2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - r*2, bevelEnabled: true,
    bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3,
  });
  g.rotateX(-Math.PI/2);                      // extrude axis z -> y
  g.translate(0, -(h/2 - r) + r, 0);          // recentre on the origin
  g.computeVertexNormals();
  return g;
}

export function buildBlockGeo(){
  const r = bevelAmount();
  if (r < 0.001) return new THREE.BoxGeometry(G.BLOCK, CELL, G.BLOCK);
  return makeBevelBox(G.BLOCK, CELL, G.BLOCK, r);
}

G.BLOCK = CELL;  // block footprint, driven by the BLOCK GAP slider
export function blockSize(){
  const gap = featureOn('blockGap') ? FEATURES.blockGap.slider.value / 100 : 0;
  return CELL * (1 - gap);
}
export const stoneA = new THREE.MeshLambertMaterial({ color:0xded0c2 });
export const stoneB = new THREE.MeshLambertMaterial({ color:0xcdbcae });
export const capMat = new THREE.MeshLambertMaterial({ color:0xe08e79 });

// Curated stone palettes, each a cohesive pair of course tones plus a cap
// accent, tuned to sit against the saturated pastel faces without competing.
// Kept light and low-saturation so the coloured faces stay the loud element.
export const STONE_PALETTES = [
  { name:'Warm Stone',  a:0xded0c2, b:0xcdbcae, cap:0xe08e79 },  // original earthy beige
  { name:'Bone',        a:0xf2ece1, b:0xe4dccd, cap:0xd98c74 },  // pale porcelain
  { name:'Sandstone',   a:0xe6d3ac, b:0xd4bd93, cap:0xcf8b5a },  // golden desert
  { name:'Cool Grey',   a:0xd8dade, b:0xc3c6cc, cap:0x9aa6b2 },  // neutral slate
  { name:'Blush Stone', a:0xecdcda, b:0xdcc7c6, cap:0xc98d8f },  // faint warm pink
  { name:'Lavender Ash',a:0xd9d6e0, b:0xc6c2d2, cap:0x9d93b8 },  // cool violet-grey
  { name:'Chalk',       a:0xf0f0ee, b:0xe1e2e2, cap:0xb9b4ac },  // near-white minimal
];
// smooth value noise over 3D position — used to pool moss and band weathering
// across the whole cube surface, flowing over block boundaries. Deterministic.
export function vnoise(x, y, z){
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const fade = t => t*t*t*(t*(t*6-15)+10);
  const h = (a,b,c) => {
    let n = (a*374761393 + b*668265263 + c*2147483647) >>> 0;
    n = (n ^ (n >>> 13)) * 1274126177 >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const lerp = (a,b,t) => a + (b-a)*t;
  return lerp(
    lerp(lerp(h(xi,yi,zi),   h(xi+1,yi,zi),   u), lerp(h(xi,yi+1,zi),   h(xi+1,yi+1,zi),   u), v),
    lerp(lerp(h(xi,yi,zi+1), h(xi+1,yi,zi+1), u), lerp(h(xi,yi+1,zi+1), h(xi+1,yi+1,zi+1), u), v),
    w);
}
// fractal noise: a couple of octaves for more organic pooling
export function fnoise(x, y, z){
  return vnoise(x, y, z) * 0.65 + vnoise(x*2.3+11, y*2.3+7, z*2.3+3) * 0.35;
}

export function applyPalette(){
  const idx = featureOn('palette')
    ? Math.max(0, Math.min(STONE_PALETTES.length - 1, FEATURES.palette.slider.value)) : 0;
  const p = STONE_PALETTES[idx];
  // clear any old texture maps (superseded by world-space tinting)
  for (const mat of [stoneA, stoneB]){ if (mat.map){ mat.map.dispose(); mat.map = null; mat.needsUpdate = true; } }
  stoneA.color.setHex(p.a);
  stoneB.color.setHex(p.b);
  capMat.color.setHex(p.cap);
  clearTintCache();                   // tinted clones derive from these — refresh
}

// A box with chamfered edges. Built by extruding a rounded rectangle profile
// with a bevel on the extrusion — so every edge catches a sliver of light,
// which is what separates 'crafted' low-poly from 'default cube'.
export function bevelledBox(w, h, d, r){
  if (r < 0.0015) return new THREE.BoxGeometry(w, h, d);
  r = Math.min(r, w/2 - 0.002, h/2 - 0.002, d/2 - 0.002);
  // ExtrudeGeometry's bevelSize expands the profile OUTWARD by r on every side,
  // and bevelThickness adds r to each end of the extrusion — so the profile is
  // inset by r and the depth shortened by 2r to land on the requested size.
  const iw = w/2 - r, id = d/2 - r;          // inset half-extents
  const cr = Math.min(r, iw*0.5, id*0.5);    // corner rounding within the inset
  const sw = iw - cr, sd = id - cr;
  const shape = new THREE.Shape();
  shape.moveTo(-sw, -id);
  shape.lineTo(sw, -id);
  shape.quadraticCurveTo(iw, -id, iw, -sd);
  shape.lineTo(iw, sd);
  shape.quadraticCurveTo(iw, id, sw, id);
  shape.lineTo(-sw, id);
  shape.quadraticCurveTo(-iw, id, -iw, sd);
  shape.lineTo(-iw, -sd);
  shape.quadraticCurveTo(-iw, -id, -sw, -id);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - r*2, bevelEnabled: true,
    bevelSize: r, bevelThickness: r, bevelSegments: 2, curveSegments: 2,
  });
  g.rotateX(-Math.PI/2);                     // extrude along +y
  g.translate(0, -(h/2 - r), 0);             // recentre on the origin
  g.computeVertexNormals();
  return g;
}
export function bevelAmount(){
  return featureOn('bevels') ? FEATURES.bevels.slider.value / 100 * CELL * 0.09 : 0;
}

G.blockGeo = null; G.blockEdges = null;
export const edgeMat = new THREE.LineBasicMaterial({ color:0x5c4a5e, transparent:true, opacity:0.3 });

// rebuild the block geometry when the bevel size changes
export function applyBevels(){
  G.BLOCK = blockSize();       // pick up the current gap setting
  const r = bevelAmount();
  if (G.blockGeo) G.blockGeo.dispose();
  if (G.blockEdges) G.blockEdges.dispose();
  G.blockGeo = bevelledBox(G.BLOCK, CELL, G.BLOCK, r);
  G.blockEdges = new THREE.EdgesGeometry(G.blockGeo, 30);
  // the bevel does the edge-definition job with light, so the ink can back off
  edgeMat.opacity = r > 0.0015 ? 0.12 : 0.3;
}
applyBevels();                 // build the initial geometry

// Stone variation: a stable per-cell lightness shift so no two blocks match,
// yet a given block is always the same shade (a hash of its cell, not random —
// otherwise it would shimmer on every rebuild). Cloned materials are cached and
// reused so we don't make hundreds of them per level.
export function cellHash(fi, u, v, i){
  let h = (fi*131 + u*17 + v*7 + i*4099) >>> 0;
  h = (h ^ (h >>> 13)) * 0x5bd1e995 >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967295;                 // 0..1
}
export const tintCache = new Map();
export function clearTintCache(){
  for (const mat of tintCache.values()){ if (mat.map) mat.map.dispose(); }
  tintCache.clear();
}
G.tintTimer = null; G.monTimer = null; G.gapTimer = null; G.masTimer = null; G.palTimer = null;
export const _mossCol = new THREE.Color(0x6f8f4e);
// per-block weathered texture: painted by sampling the shared noise field at
// the block's WORLD position, so the fine mottled detail (real moss/staining,
// not a flat tint) flows continuously across blocks and never repeats.
export function makeWeatherTex(baseHex, wx, wy, wz, weather, moss){
  const S = 64;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const base = new THREE.Color(baseHex);
  const img = g.createImageData(S, S);
  const dat = img.data;
  const mCol = _mossCol;
  for (let py = 0; py < S; py++){
    for (let px = 0; px < S; px++){
      // world coord of this texel: block origin + fraction across the block
      const fx = px / S, fy = py / S;
      const sx = wx + fx * 1.0, sy = wy + fy * 1.0, sz = wz;
      // sample noise at several scales: low for regional pooling, high for the
      // fine mottle within a block that makes it read as moss, not a flat fill
      const wN = fnoise(sx*1.6+40, sy*1.6+40, sz*1.6+40) * 0.6
               + fnoise(sx*9.0+40, sy*9.0+40, sz*9.0+40) * 0.4;
      const mN = fnoise(sx*1.3, sy*1.3, sz*1.3) * 0.45
               + fnoise(sx*5.0, sy*5.0, sz*5.0) * 0.30
               + fnoise(sx*13.0, sy*13.0, sz*13.0) * 0.25;
      let rr = base.r, gg = base.g, bb = base.b;
      // weathering: darken where the field is high, lighten where low — mottle
      if (weather > 0){
        const d = (wN - 0.5) * weather * 0.5;
        rr -= d; gg -= d; bb -= d;
      }
      // moss: blend toward green where the moss field is high. The threshold
      // pulls back hard at low slider values so moss stays in pools/patches
      // rather than blanketing — only the greenest areas grow at low settings.
      if (moss > 0){
        const thresh = 0.72 - moss * 0.42;      // 0.72 (sparse) -> 0.30 (lush)
        const cover = Math.max(0, mN - thresh) / (1 - thresh) * (0.6 + moss*0.4);
        const k = Math.min(0.82, cover);
        rr = rr + (mCol.r - rr) * k;
        gg = gg + (mCol.g - gg) * k;
        bb = bb + (mCol.b - bb) * k;
      }
      const o = (py*S + px) * 4;
      dat[o]   = Math.max(0, Math.min(255, rr*255));
      dat[o+1] = Math.max(0, Math.min(255, gg*255));
      dat[o+2] = Math.max(0, Math.min(255, bb*255));
      dat[o+3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  return t;
}

export function stoneMat(base, fi, u, v, i){
  const tintOn = featureOn('tint');
  const weather = featureOn('palette') ? FEATURES.palette.sliders[0].value / 100 : 0;
  const moss    = featureOn('palette') ? FEATURES.palette.sliders[1].value / 100 : 0;

  // plain per-block lightness variation only (no weathering/moss): cheap tinted clone
  if (weather <= 0 && moss <= 0){
    if (!tintOn) return base;
    const amt = FEATURES.tint.slider.value / 100;
    if (amt <= 0) return base;
    const shift = (cellHash(fi, u, v, i) - 0.5) * 2 * 0.14 * amt;
    const step = Math.round(shift * 40);
    const key = (base === stoneA ? 'A' : 'B') + step;
    let mat = tintCache.get(key);
    if (!mat){
      mat = base.clone();
      const hsl = {}; base.color.getHSL(hsl);
      mat.color.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + step/40)));
      tintCache.set(key, mat);
    }
    return mat;
  }

  // weathering/moss on: per-block texture sampled at world position. Quantise
  // the position to a grid so nearby blocks can share a cached texture — keeps
  // the material count sane while still flowing across the surface.
  const wx = fi*4 + u, wy = v + i, wz = (u + v*7 + fi*13) * 0.13;
  const gx = Math.round(wx), gy = Math.round(wy), gz = Math.round(wz*3);
  const key = (base === stoneA ? 'A' : 'B') + 'w' + Math.round(weather*10)
            + 'm' + Math.round(moss*10) + ':' + gx + ',' + gy + ',' + gz;
  let mat = tintCache.get(key);
  if (!mat){
    mat = base.clone();
    mat.color.setHex(0xffffff);            // texture carries the colour
    mat.map = makeWeatherTex('#'+base.color.getHexString(), gx, gy, gz*0.33, weather, moss);
    mat.needsUpdate = true;
    tintCache.set(key, mat);
  }
  return mat;
}

