import { FEATURES } from '../config/features.js';
import { CELL, FACES, H, HOLE_OPEN, N } from '../core/constants.js';
import { cellToPoint } from '../core/grid.js';
import { seededRand } from '../core/rng.js';
import { activeFacePalette, faceColor, world } from './scene.js';
import { holeList, portalList } from '../world/level.js';

// ---------- the cube ----------

// Per-face canvases: redrawn each level so hole openings can be cut straight
// out of the surface (alphaTest discards the erased pixels, revealing the
// shaft geometry sunk inside the cube).
export const faceCanvases = [], faceTextures = [];
export function drawFaceBase(fi){
  const c = faceCanvases[fi];
  const g = c.getContext('2d');
  g.clearRect(0,0,512,512);
  g.fillStyle = faceColor(fi); g.fillRect(0,0,512,512);
  if (activeFacePalette().ruin){
    const wx = FEATURES.facePalette.sliders[0].value / 100;   // WEATHERING
    const mo = FEATURES.facePalette.sliders[1].value / 100;   // VEGETATION
    if (wx > 0) drawStoneTexture(g, fi, wx);
    if (mo > 0) drawVegetation(g, fi, mo);
  }
  const s = 512 / N;
  g.strokeStyle = 'rgba(60,45,70,0.16)'; g.lineWidth = 2;
  for (let i=1;i<N;i++){
    g.beginPath(); g.moveTo(i*s,0); g.lineTo(i*s,512); g.stroke();
    g.beginPath(); g.moveTo(0,i*s); g.lineTo(512,i*s); g.stroke();
  }
  g.strokeStyle = 'rgba(60,45,70,0.35)'; g.lineWidth = 8;
  g.strokeRect(0,0,512,512);
}

// procedural aged-stone surface, scaled by amount (0..1)
export function drawStoneTexture(g, fi, amt){
  const rnd = seededRand((fi*2654435761 + 12345) >>> 0);
  g.save();
  for (let i = 0; i < 90; i++){
    const x = rnd()*512, y = rnd()*512, r = 20 + rnd()*90;
    const dark = rnd() < 0.5;
    const a = (0.03 + rnd()*0.06) * amt;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, (dark ? 'rgba(50,42,38,' : 'rgba(255,252,245,') + a + ')');
    grad.addColorStop(1, (dark ? 'rgba(50,42,38,0)' : 'rgba(255,252,245,0)'));
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
  }
  for (let i = 0; i < 900; i++){
    g.fillStyle = rnd() < 0.5 ? 'rgba(40,34,30,' + (0.05*amt) + ')'
                              : 'rgba(255,250,240,' + (0.05*amt) + ')';
    g.fillRect(rnd()*512, rnd()*512, 2, 2);
  }
  g.strokeStyle = 'rgba(50,44,38,' + (0.05*amt) + ')';
  for (let i = 0; i < 6; i++){
    const x = rnd()*512;
    g.lineWidth = 6 + rnd()*22;
    g.beginPath(); g.moveTo(x, 0);
    g.bezierCurveTo(x + (rnd()-0.5)*40, 180, x + (rnd()-0.5)*50, 340, x + (rnd()-0.5)*30, 512);
    g.stroke();
  }
  g.strokeStyle = 'rgba(40,34,30,' + (0.14*amt) + ')'; g.lineWidth = 1.5;
  for (let i = 0; i < 5; i++){
    let x = rnd()*512, y = rnd()*512;
    g.beginPath(); g.moveTo(x, y);
    const steps = 3 + (rnd()*4|0);
    for (let s = 0; s < steps; s++){
      x += (rnd()-0.5)*140; y += (rnd()-0.5)*140;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

// moss and lichen creeping over the stone — pools along the lower edge and in
// corners where damp collects, thinning toward the top. amount 0..1 grows it.
export function drawVegetation(g, fi, amt){
  const rnd = seededRand((fi*40503 + 907) >>> 0);
  g.save();
  const greens = ['#6f8f4e', '#7fa05a', '#5c7d42', '#8aa668', '#647f48'];
  // patches: probability weighted toward the bottom of the face (higher y)
  const n = Math.round(60 + amt * 200);
  for (let i = 0; i < n; i++){
    // bias y downward: moss grows up from the base
    const yb = Math.pow(rnd(), 0.5);          // skew toward 1 (bottom)
    if (rnd() > amt * (0.35 + 0.65*yb)) continue;   // sparser higher up
    const x = rnd()*512, y = yb*512;
    const r = 6 + rnd()*34;
    const col = greens[(rnd()*greens.length)|0];
    const a = 0.10 + rnd()*0.28;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, hexA(col, a));
    grad.addColorStop(0.7, hexA(col, a*0.5));
    grad.addColorStop(1, hexA(col, 0));
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
  }
  // speckle of brighter lichen dots on top of the moss
  const dots = Math.round(amt * 400);
  for (let i = 0; i < dots; i++){
    const yb = Math.pow(rnd(), 0.6);
    g.fillStyle = hexA(greens[(rnd()*greens.length)|0], 0.25);
    g.fillRect(rnd()*512, yb*512, 2 + rnd()*3, 2 + rnd()*3);
  }
  g.restore();
}
export function hexA(hex, a){
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}
export const cubeMats = FACES.map((f, fi) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  faceCanvases.push(c);
  drawFaceBase(fi);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  faceTextures.push(t);
  return new THREE.MeshLambertMaterial({ map:t, alphaTest:0.5 });
});
export const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(2*H, 2*H, 2*H), cubeMats);
cubeMesh.receiveShadow = true;
world.add(cubeMesh);

// Maps a cube-local point to face-texture pixels. Derived from BoxGeometry's
// buildPlane UV conventions per face (order: +x,-x,+y,-y,+z,-z):
// [uComponent, uDir, vComponent, vDir] with s = .5 + cu/(2H*uDir), t = .5 - cv/(2H*vDir)
export const UV_TABLE = [
  [2,-1, 1,-1],  // +x
  [2, 1, 1,-1],  // -x
  [0, 1, 2, 1],  // +y
  [0, 1, 2,-1],  // -y
  [0, 1, 1,-1],  // +z
  [0,-1, 1,-1],  // -z
];
export function updateFaceTextures(){
  for (let fi = 0; fi < 6; fi++) drawFaceBase(fi);
  const sz = (512/N) * (HOLE_OPEN/CELL);
  for (const [fi,u,v] of holeList.concat(portalList)){
    const p = cellToPoint(fi, u, v);
    const [uc, ud, vc, vd] = UV_TABLE[fi];
    const s = 0.5 + p.getComponent(uc) / (2*H*ud);
    const t = 0.5 - p.getComponent(vc) / (2*H*vd);
    faceCanvases[fi].getContext('2d')
      .clearRect(s*512 - sz/2, (1-t)*512 - sz/2, sz, sz);
  }
  for (const tx of faceTextures) tx.needsUpdate = true;
}

