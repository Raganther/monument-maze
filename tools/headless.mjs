// Boots enough of the game to run generation and the solver under Node, with
// no browser and no WebGL.
//
// The trick is that everything the solver touches - grid maths, the level
// containers, the rules - only needs THREE's Vector3 maths, never a renderer.
// So we load three's ES build, publish it as the global the game expects, and
// stub the DOM surface the rendering modules poke at on import. Nothing here
// affects the browser build.
import * as THREE from '../vendor/three.module.js';

// a module namespace is frozen, so publish a mutable copy we can stub into
globalThis.THREE = { ...THREE };

// --- minimal DOM so the render/ui modules survive being imported ----------
const noop = () => {};
const mkCanvasCtx = () => new Proxy({}, {
  get: (_t, k) => {
    if (k === 'canvas') return { width: 4, height: 4 };
    if (k === 'getImageData' || k === 'createImageData')
      return (w = 4, h = 4) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop: noop });
    if (k === 'measureText') return () => ({ width: 0 });
    return noop;
  },
});
const mkEl = (tag = 'div') => {
  const el = {
    tagName: tag, style: {}, dataset: {}, children: [], className: '', id: '',
    width: 4, height: 4, textContent: '', innerHTML: '',
    appendChild: c => (el.children.push(c), c),
    append: (...cs) => el.children.push(...cs),
    prepend: (...cs) => el.children.unshift(...cs),
    removeChild: noop, remove: noop, insertBefore: c => c,
    replaceChildren: noop, cloneNode: () => mkEl(tag),
    addEventListener: noop, removeEventListener: noop,
    setAttribute: noop, getAttribute: () => null,
    querySelector: () => mkEl(), querySelectorAll: () => [],
    getContext: () => mkCanvasCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
    focus: noop, click: noop, toDataURL: () => '',
  };
  return el;
};
globalThis.document = {
  createElement: mkEl,
  getElementById: () => mkEl(),
  querySelector: () => mkEl(),
  querySelectorAll: () => [],
  addEventListener: noop, removeEventListener: noop,
  body: mkEl('body'), documentElement: mkEl('html'),
};
globalThis.window = globalThis;
globalThis.innerWidth = 1024;
globalThis.innerHeight = 768;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = noop;
globalThis.removeEventListener = noop;
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = noop;
globalThis.performance ??= { now: () => Date.now() };
globalThis.AudioContext = function(){ throw new Error('no audio headless'); };

// WebGLRenderer needs a real context; give it something inert. The game only
// calls setSize/render/shadowMap on it, none of which we need.
globalThis.THREE.WebGLRenderer = function(){
  return {
    domElement: mkEl('canvas'),
    setSize: noop, setPixelRatio: noop, render: noop, dispose: noop,
    shadowMap: {}, outputEncoding: 0, toneMapping: 0,
    setClearColor: noop, getContext: () => mkCanvasCtx(),
  };
};

// deterministic randomness so a failing level can be reproduced exactly
export function seedRandom(seed){
  let s = (seed >>> 0) || 1;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
