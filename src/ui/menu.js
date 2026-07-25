import { G } from '../core/globals.js';
import { startDrone } from '../audio/drone.js';
import { audio } from '../audio/sfx.js';
import { featureOn } from '../config/features.js';
import { MODES } from '../config/modes.js';
import { START_LEVEL, buildLevel, hideOverlay } from '../game/lifecycle.js';

// ---------- menu ----------
export const menuEl = document.getElementById('menu');
export const modeList = document.getElementById('modeList');
for (const key of Object.keys(MODES)){
  const m = MODES[key];
  const btn = document.createElement('div');
  btn.className = 'modeBtn';
  btn.innerHTML = '<div class="mname">' + m.name + '</div><div class="mdesc">' + m.desc + '</div>';
  btn.addEventListener('click', () => startMode(key));
  modeList.appendChild(btn);
}
export function startMode(key){
  audio();                      // browsers need a user gesture to start audio
  if (featureOn('drone')) startDrone();
  G.modeKey = key;
  G.level = START_LEVEL;
  buildLevel();
  menuEl.style.display = 'none';
  hideOverlay();
  G.phase = 'play';
}
export function openMenu(){
  G.phase = 'menu';
  menuEl.style.display = 'flex';
}
document.getElementById('menuBtn').addEventListener('click', openMenu);
addEventListener('keydown', e => { if (e.code === 'Escape' && G.phase === 'play') openMenu(); });

