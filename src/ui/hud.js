import { G } from '../core/globals.js';
import { MODE, isGoalObjective } from '../config/modes.js';
import { FACES } from '../core/constants.js';
import { faceIndexOf } from '../core/grid.js';
import { Nf } from '../render/player.js';
import { pushBlocks, pushPads } from '../world/level.js';

export const faceDot = document.getElementById('faceDot');
export const faceName = document.getElementById('faceName');
export const gemHud = document.getElementById('gems');
export const levelChip = document.getElementById('levelChip');
export const timeChip = document.getElementById('timeChip');
export function updateFaceHUD(){
  const f = FACES[faceIndexOf(Nf)];
  faceName.textContent = f.name;
  faceDot.style.background = f.color;
}
export function updateGemHUD(){
  if (MODE().objective === 'puzzle'){
    const on = [...pushPads.keys()].filter(k => pushBlocks.has(k)).length;
    gemHud.innerHTML = '&#9632; ' + on + ' / ' + pushPads.size + ' ON PADS';
    return;
  }
  if (isGoalObjective()){ gemHud.innerHTML = 'REACH THE GOAL'; return; }
  if (G.keystoneAwake){ gemHud.innerHTML = '&#9650; REACH THE KEYSTONE'; return; }
  gemHud.innerHTML = '&#9670; ' + G.gemCount + ' / ' + G.gemsTotal;
}
export function updateTimeHUD(){
  const s = Math.max(0, Math.ceil(G.timeLeft));
  timeChip.textContent = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
  timeChip.classList.toggle('low', G.timeLeft <= 10);
}

