import { G } from '../core/globals.js';
import { startDrone, stopDrone } from '../audio/drone.js';
import { audio } from '../audio/sfx.js';
import { FEATURES } from '../config/features.js';
import { keys } from '../game/input.js';
import { buildLevel, stopChargeTone } from '../game/lifecycle.js';
import { elevTarget, skewTarget } from '../game/view.js';
import { rebuildBridgeGeo } from '../mechanics/bridges.js';
import { STONE_PALETTES, applyBevels, applyPalette, clearTintCache } from '../render/blockgeo.js';
import { updateFaceTextures } from '../render/cube.js';
import { FACE_PALETTES, applyCamera, applyShadows } from '../render/scene.js';
import { clearSeeThrough } from '../render/seethrough.js';
import { drawTrail } from '../render/trail.js';

// ---------- lab panel ----------
// Built straight from the FEATURES registry: add an entry there and it
// appears here automatically. Toggling rebuilds the level so the change
// takes effect immediately.
export const labEl = document.getElementById('lab');
export const featList = document.getElementById('featList');
// lab organised into collapsible categories so 24 toggles stay navigable
export const LAB_CATEGORIES = [
  { name:'OBJECTIVE',  keys:['keystone', 'keysgates', 'oneways', 'timer', 'bonusTime', 'sprint'] },
  { name:'OBSTACLES',  keys:['towers', 'rails', 'holes', 'bridges', 'portals', 'monuments'] },
  { name:'STONEWORK',  keys:['masonry', 'blockGap', 'bevels', 'tint', 'palette'] },
  { name:'WORLD',      keys:['facePalette', 'shadows'] },
  { name:'CAMERA',     keys:['skewView', 'freeCam', 'seeThrough'] },
  { name:'AUDIO',      keys:['sound', 'drone'] },
  { name:'TESTING',    keys:['solution'] },
];
// build one collapsible section per category, each holding its feature rows
for (const cat of LAB_CATEGORIES){
  const header = document.createElement('div');
  header.className = 'labCat';
  header.innerHTML = '<span class="catName">' + cat.name + '</span><span class="catChev">\u25be</span>';
  featList.appendChild(header);
  const body = document.createElement('div');
  body.className = 'catBody';
  featList.appendChild(body);
  header.addEventListener('click', () => {
    const collapsed = body.classList.toggle('collapsed');
    header.querySelector('.catChev').textContent = collapsed ? '\u25b8' : '\u25be';
  });
  for (const key of cat.keys){
    if (FEATURES[key]) buildFeatureRow(key, body);
  }
}

export function buildFeatureRow(key, container){
  const f = FEATURES[key];
  let sl = null;                       // declared before the handler closes over it
  const row = document.createElement('div');
  row.className = 'featRow';
  row.innerHTML =
    '<div><div class="fname">' + f.name + '</div>' +
    '<div class="fdesc">' + f.desc + '</div></div>' +
    '<div class="tog"></div>';
  const tog = row.querySelector('.tog');
  const sync = () => tog.classList.toggle('on', f.on);
  sync();
  row.addEventListener('click', () => {
    f.on = !f.on;
    sync();
    if (sl) sl.style.display = f.on ? 'block' : 'none';
    if (G.phase === 'menu') return;
    // display-only switches must not regenerate the level under test
    if (key === 'solution') drawTrail();
    else if (key === 'facePalette'){ updateFaceTextures(); }
    else if (key === 'palette'){ applyPalette(); buildLevel(); }
    else if (key === 'tint'){ clearTintCache(); buildLevel(); }
    else if (key === 'monuments') buildLevel();
    else if (key === 'masonry') buildLevel();
    else if (key === 'blockGap'){ applyBevels(); buildLevel(); }
    else if (key === 'bevels'){ applyBevels(); rebuildBridgeGeo(); buildLevel(); }
    else if (key === 'shadows') applyShadows();
    else if (key === 'sound'){ if (f.on) audio(); else stopChargeTone(); }
    else if (key === 'drone'){ if (f.on){ audio(); startDrone(); } else stopDrone(); }
    else if (key === 'seeThrough'){ if (!f.on) clearSeeThrough(); }
    else if (key === 'freeCam' || key === 'skewView'){
      if (key === 'skewView') G.skewCur = skewTarget();
      applyCamera();
    }
    else buildLevel();
  });
  container.appendChild(row);

  // live sliders for features that declare them — tune while playing
  const slDefs = [];
  if (f.slider) slDefs.push(Object.assign({ key:'main', label:null }, f.slider));
  if (f.sliders) for (const s of f.sliders) slDefs.push(s);
  if (slDefs.length){
    sl = document.createElement('div');
    sl.style.display = f.on ? 'block' : 'none';
    for (const def of slDefs){
      const row = document.createElement('div');
      row.className = 'featSlider';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = def.min; inp.max = def.max; inp.step = def.step; inp.value = def.value;
      const val = document.createElement('span');
      const labelFor = (dk, v) =>
        (key === 'palette' && dk === 'main' && STONE_PALETTES[v]) ? STONE_PALETTES[v].name
        : (key === 'facePalette' && dk === 'main' && FACE_PALETTES[v]) ? FACE_PALETTES[v].name
        : v + (def.unit || '');
      val.textContent = labelFor(def.key, def.value);
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (def.key === 'main') f.slider.value = v; else def.value = v;
        val.textContent = labelFor(def.key, v);
        if (key === 'skewView'){ G.skewCur = skewTarget(); G.elevCur = elevTarget(); }
        if (key === 'sound' && G.masterGain) G.masterGain.gain.value = v/100 * 0.5;
        if (key === 'drone' && G.droneGain) G.droneGain.gain.value = v/100 * 0.35;
        if (key === 'shadows') applyShadows();
        if (key === 'tint'){
          clearTimeout(G.tintTimer);
          G.tintTimer = setTimeout(() => { clearTintCache(); buildLevel(); }, 140);
        }
        if (key === 'facePalette') updateFaceTextures();
        if (key === 'palette'){
          applyPalette();
          clearTimeout(G.palTimer);
          G.palTimer = setTimeout(() => buildLevel(), 140);
        }
        if (key === 'monuments'){
          clearTimeout(G.monTimer);
          G.monTimer = setTimeout(() => buildLevel(), 140);
        }
        if (key === 'masonry'){
          clearTimeout(G.masTimer);
          G.masTimer = setTimeout(() => buildLevel(), 140);
        }
        if (key === 'blockGap'){
          clearTimeout(G.gapTimer);
          G.gapTimer = setTimeout(() => { applyBevels(); buildLevel(); }, 140);
        }
        applyCamera();
      });
      if (def.label){
        const lbl = document.createElement('div');
        lbl.className = 'slLabel';
        lbl.textContent = def.label;
        lbl.title = def.hint || '';
        sl.appendChild(lbl);
      }
      row.append(inp, val);
      sl.appendChild(row);
    }
    container.appendChild(sl);
  }
}
document.getElementById('labBtn').addEventListener('click', () => {
  labEl.style.display = labEl.style.display === 'flex' ? 'none' : 'flex';
});
document.getElementById('labClose').addEventListener('click', () => {
  labEl.style.display = 'none';
});

// level selector: jump straight to any level with the current feature set —
// the point of the lab is testing combinations without grinding there
export const lvlNum = document.getElementById('lvlNum');
export function setLevel(n){
  G.level = Math.max(1, Math.min(99, n));
  lvlNum.textContent = G.level;
  if (G.phase !== 'menu') buildLevel();
}
document.getElementById('lvlDown').addEventListener('click', () => setLevel(G.level - 1));
document.getElementById('lvlUp').addEventListener('click', () => setLevel(G.level + 1));

