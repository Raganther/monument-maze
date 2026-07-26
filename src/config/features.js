import { MODE } from './modes.js';
import { holes, oneways, portals, rails } from '../world/level.js';

// ---------- feature lab ----------
// Gameplay elements as switches: flip one on to test it, off to shelve it —
// no code surgery either way. Three hook shapes cover everything:
//   gen()   runs during level build (adds content/data)
//   onGem() runs on collect (events)
//   plain values the engine reads (see speed())
export const FEATURES = {
  towers: {
    name:'TOWERS', desc:'the stacked cube obstacles',
    on:true,
  },
  rails: {
    name:'RAILS', desc:'thin walls along the grid seams',
    on:true,
  },
  holes: {
    name:'HOLES', desc:'open pits — fall in, start over',
    on:false,
  },
  bridges: {
    name:'TUNNELS', desc:'stone tunnels to pass through — sides are walled',
    on:true,
  },
  portals: {
    name:'PORTALS', desc:'linked doorways — matching colours connect',
    on:true,
  },
  timer: {
    name:'TIME LIMIT', desc:'the clock itself — off for pure exploration',
    on:false,
  },
  bonusTime: {
    name:'TIME BONUS', desc:'+3s for every gem collected',
    on:false,
  },
  sprint: {
    name:'SPRINT', desc:'snappier movement animations',
    on:false,
  },
  sound: {
    name:'SOUND', desc:'wood, bells and breath — all synthesised',
    on:true,
    slider: { min:0, max:100, step:5, value:60, unit:'%' },
  },
  drone: {
    name:'DRONE', desc:'a slow pad in C — the key the gems ring in',
    on:false,
    slider: { min:0, max:100, step:5, value:45, unit:'%' },
  },
  masonry: {
    name:'MASONRY', desc:'blocks built from smaller stones — hand-laid, not cast',
    on:true,
    slider: { min:0, max:100, step:1, value:50, unit:'%' },
    sliders: [
      { key:'rough', label:'ROUGHNESS', min:0, max:100, step:5, value:20, unit:'%',
        hint:'uneven heights and missing stones — quarried, not tidy' },
      { key:'heightVar', label:'HEIGHT VARIATION', min:0, max:100, step:5, value:75, unit:'%',
        hint:'tumbledown skyline — some blocks low, some stacked tall (visual only)' },
    ],
  },
  blockGap: {
    name:'BLOCK GAP', desc:'spacing between neighbouring blocks — flush or inset',
    on:true,
    slider: { min:0, max:16, step:1, value:0, unit:'%' },
  },
  oneways: {
    name:'ONE-WAY TILES', desc:'arrows you can only cross one way — commitment and routing',
    on:true,
  },
  keysgates: {
    name:'KEYS & GATES', desc:'coloured keys open the gates that match them',
    on:false,
    slider: { min:1, max:4, step:1, value:2, unit:'' },
  },
  keystone: {
    name:'KEYSTONE', desc:'collect the gems, then journey to the awakened monument to finish',
    on:false,
  },
  monuments: {
    name:'MONUMENTS', desc:'occasional little landmarks — ziggurats, obelisks, arches',
    on:true,
    slider: { min:0, max:100, step:5, value:60, unit:'%' },
  },
  facePalette: {
    name:'FACE PALETTE', desc:'the six cube-face colours — from pastel to ancient stone',
    on:true,
    slider: { min:0, max:9, step:1, value:9, unit:'' },
    sliders: [
      { key:'texture', label:'WEATHERING', min:0, max:100, step:5, value:100, unit:'%',
        hint:'strength of the aged-stone mottling, streaks and cracks' },
      { key:'moss', label:'VEGETATION', min:0, max:100, step:5, value:75, unit:'%',
        hint:'moss and lichen creeping over the stone' },
    ],
  },
  palette: {
    name:'STONE PALETTE', desc:'the base stone colours — tuned to sit against the pastel faces',
    on:true,
    slider: { min:0, max:6, step:1, value:1, unit:'' },
    sliders: [
      { key:'weather', label:'WEATHERING', min:0, max:100, step:5, value:30, unit:'%',
        hint:'mottling and stains aged into the stone surface' },
      { key:'moss', label:'VEGETATION', min:0, max:100, step:5, value:25, unit:'%',
        hint:'moss creeping up the lower stones' },
    ],
  },
  tint: {
    name:'STONE VARIATION', desc:'each block a slightly different shade — weathered, never cloned',
    on:true,
    slider: { min:0, max:100, step:1, value:15, unit:'%' },
  },
  bevels: {
    name:'BEVELS', desc:'softened edges that catch the light — crafted, not default',
    on:false,
    slider: { min:0, max:14, step:1, value:6, unit:'%' },
  },
  shadows: {
    name:'SHADOWS', desc:'blocks cast onto the faces — grounds them in the space',
    on:true,
    slider: { min:0, max:100, step:5, value:75, unit:'%' },
  },
  seeThrough: {
    name:'SEE THROUGH', desc:'obstacles hiding the player fade out',
    on:false,
    slider: { min:5, max:70, step:5, value:22, unit:'%' },
  },
  solution: {
    name:'SOLUTION', desc:'breadcrumb trail along the route — a testing tool',
    on:false,
  },
  freeCam: {
    name:'FREE CAMERA', desc:'orbit freely; the cube stays put and you move relative to the view',
    on:false,
  },
  skewView: {
    name:'SKEWED VIEW', desc:'offset the locked angle so forward is obvious on the top plane',
    on:true,
    slider: { min:0, max:40, step:1, value:20, unit:'\u00b0' },
    sliders: [
      { key:'lift', label:'SIDE DROP', min:0, max:30, step:1, value:0, unit:'\u00b0',
        hint:'lower the view on the side planes' },
      { key:'dip', label:'TOP RISE', min:0, max:30, step:1, value:0, unit:'\u00b0',
        hint:'raise the view at the top plane\u2019s far edge' },
    ],
  },
};
export const featureOn = k => FEATURES[k].on;
export const speed = () => featureOn('sprint') ? 0.55 : 1;
export const timerActive = () => MODE().timer && featureOn('timer');

