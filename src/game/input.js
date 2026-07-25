import { G } from '../core/globals.js';
import { audio } from '../audio/sfx.js';
import { tryStep } from './movement.js';
import { settleView } from './view.js';

// ---------- input ----------
export const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup',   e => keys[e.code] = false);
export function pollKeys(){
  const moving = keys['ArrowUp'] || keys['KeyW'] || keys['ArrowDown'] || keys['KeyS'] ||
                 keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'];
  // settle the view and step on the SAME press — the camera eases back while
  // the player moves, rather than the snap eating the first keystroke.
  // While Q/E is held you're steering: don't fight it, just move.
  const steering = keys['KeyQ'] || keys['KeyE'];
  let resolveQ = null;
  if (moving && G.peeked && !steering) resolveQ = settleView();
  if (keys['ArrowUp']    || keys['KeyW']) return tryStep(0, 1, resolveQ);
  if (keys['ArrowDown']  || keys['KeyS']) return tryStep(0,-1, resolveQ);
  if (keys['ArrowLeft']  || keys['KeyA']) return tryStep(-1,0, resolveQ);
  if (keys['ArrowRight'] || keys['KeyD']) return tryStep(1, 0, resolveQ);
}
// swipe to move — but not when the drag starts on the UI (lab panel, menu),
// where a drag means scrolling
G.swipe = null;
addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('#lab, #menu, #hud, #touchControls')) return;
  G.swipe = { x:e.clientX, y:e.clientY };
});
addEventListener('pointerup', e => {
  if (!G.swipe) return;
  const dx = e.clientX - G.swipe.x, dy = e.clientY - G.swipe.y;
  G.swipe = null;
  if (Math.hypot(dx,dy) < 18) return;
  if (Math.abs(dx) > Math.abs(dy)) tryStep(Math.sign(dx), 0);
  else tryStep(0, -Math.sign(dy));
});

// ---------- on-screen touch controls ----------
// The D-pad drives the SAME key flags the poll reads, so all the settle/steer
// logic applies exactly as with a real keyboard. Movement buttons fire a single
// step per tap; turn buttons hold the spin while pressed.
export const DIR_KEY = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' };
export function bindHoldButton(el, onDown, onUp){
  if (!el) return;
  const down = e => { e.preventDefault(); onDown(); };
  const up   = e => { e.preventDefault(); onUp && onUp(); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}
// direction buttons mirror the keyboard exactly: press sets the key flag, release
// clears it. pollKeys (each idle frame) turns that into one step per tap and a
// natural repeat when held — honouring movement state, portals, one-ways, etc.
for (const el of document.querySelectorAll('#dpad .dbtn[data-dir]')){
  const k = DIR_KEY[el.dataset.dir];
  bindHoldButton(el,
    () => { audio(); keys[k] = true; },
    () => { keys[k] = false; });
}
// turn buttons: hold to spin the cube (same as holding Q / E)
bindHoldButton(document.getElementById('tQ'),
  () => { audio(); keys['KeyQ'] = true; }, () => { keys['KeyQ'] = false; });
bindHoldButton(document.getElementById('tE'),
  () => { audio(); keys['KeyE'] = true; }, () => { keys['KeyE'] = false; });

// detect touch capability and tag the body so controls show even on hybrids
if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
addEventListener('touchstart', () => document.body.classList.add('touch'), { once:true, passive:true });

