import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';

// ---------- sound: wood, bells and breath, all synthesised ----------
// No samples — keeps the game a single self-contained file, and pure synthesis
// suits the geometric abstraction better than recorded foley would.
G.actx = null; G.masterGain = null; G.droneGain = null; G.noiseBuf = null;
export function audio(){
  if (!featureOn('sound') && !featureOn('drone')) return null;
  if (!G.actx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    G.actx = new AC();
    G.masterGain = G.actx.createGain();      // sound effects
    G.masterGain.connect(G.actx.destination);
    G.droneGain = G.actx.createGain();       // the pad, on its own fader
    G.droneGain.connect(G.actx.destination);
    // shared noise buffer for the wood and breath voices
    const n = G.actx.sampleRate * 0.5;
    G.noiseBuf = G.actx.createBuffer(1, n, G.actx.sampleRate);
    const d = G.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random()*2 - 1;
  }
  if (G.actx.state === 'suspended') G.actx.resume();
  G.masterGain.gain.value = featureOn('sound')
    ? FEATURES.sound.slider.value / 100 * 0.5 : 0;
  G.droneGain.gain.value = featureOn('drone')
    ? FEATURES.drone.slider.value / 100 * 0.35 : 0;
  return G.actx;
}

// a filtered noise burst — the wood-block family (steps, thuds, bumps)
export function sfxWood(freq, dur, gain, q){
  if (!featureOn('sound')) return;
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = G.noiseBuf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q || 6;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(G.masterGain);
  src.start(t); src.stop(t + dur + 0.02);
}

// detuned inharmonic partials through a soft lowpass — the bell family.
// Real bells aren't integer harmonics; the slight detune gives gentle beating.
export function sfxBell(freq, dur, gain){
  if (!featureOn('sound')) return;
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(6000, freq * 7), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.6), t + dur);
  lp.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g); g.connect(G.masterGain);
  // partial, amplitude, decay scale, detune cents — higher partials die sooner
  const parts = [
    [1.00, 1.00, 1.00,  0],
    [2.01, 0.42, 0.72, +3],
    [2.76, 0.22, 0.55, -4],
    [3.94, 0.12, 0.40, +6],
    [5.42, 0.06, 0.28, -7],
  ];
  for (const [mult, amp, dscale, cents] of parts){
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    o.detune.value = cents;
    const og = ac.createGain();
    og.gain.setValueAtTime(amp, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur * dscale);
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // a soft strike transient so it has a body, not just a tone
  const src = ac.createBufferSource(); src.buffer = G.noiseBuf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq * 2; bp.Q.value = 1.5;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(gain * 0.25, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(bp); bp.connect(ng); ng.connect(G.masterGain);
  src.start(t); src.stop(t + 0.08);
}

// a filtered noise sweep — the breath family (flips, swivels, portals)
export function sfxBreath(f0, f1, dur, gain){
  if (!featureOn('sound')) return;
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = G.noiseBuf; src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + dur*0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(G.masterGain);
  src.start(t); src.stop(t + dur + 0.02);
}

// a swept chorus through a moving filter — portals in/out. Three detuned
// voices plus a fifth give it body; the filter follows the pitch so it
// blooms rather than whistles.
export function sfxSweep(f0, f1, dur, gain, type){
  if (!featureOn('sound')) return;
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f0 * 4, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f1 * 4), t + dur);
  lp.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.15);
  g.gain.setValueAtTime(gain, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g); g.connect(G.masterGain);
  // voice: pitch multiplier, amplitude, detune cents
  const voices = [[1, 1, -6], [1, 0.9, +7], [1.5, 0.35, +2], [0.5, 0.5, -3]];
  for (const [mult, amp, cents] of voices){
    const o = ac.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0 * mult, t);
    o.frequency.exponentialRampToValueAtTime(f1 * mult, t + dur);
    o.detune.value = cents;
    const og = ac.createGain(); og.gain.value = amp;
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // a breath of air under the sweep so it feels like passage, not just tone
  const src = ac.createBufferSource(); src.buffer = G.noiseBuf; src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 1.8;
  bp.frequency.setValueAtTime(f0 * 1.5, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(120, f1 * 1.5), t + dur);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(gain * 0.4, t + dur * 0.3);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(ng); ng.connect(G.masterGain);
  src.start(t); src.stop(t + dur + 0.05);
}

