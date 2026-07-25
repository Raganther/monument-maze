import { G } from '../core/globals.js';
import { audio } from './sfx.js';

// ---------- the drone: a slow pad in C, the key the gems ring in ----------
// Everything else is tuned to this — the gem scale is C pentatonic and the
// portal notes are drawn from it, so collection phrases land consonant
// against the bed rather than fighting it.
G.drone = null;
export function startDrone(){
  const ac = audio(); if (!ac || G.drone) return;
  const t = ac.currentTime;
  const out = ac.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(1, t + 4);        // fade in slowly
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
  lp.connect(out); out.connect(G.droneGain);
  // a slow filter sweep so the pad breathes
  const lfo = ac.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 0.045;
  const lfoAmt = ac.createGain(); lfoAmt.gain.value = 260;
  lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency);
  lfo.start(t);
  const voices = [];
  // C2 root, C3 octave, G3 fifth, C4 — an open, unresolved stack
  const notes = [65.41, 130.81, 196.00, 261.63];
  const amps  = [0.30, 0.20, 0.13, 0.07];
  notes.forEach((f, i) => {
    // two detuned oscillators per note: slow beating gives it life
    for (const cents of [-5, +5]){
      const o = ac.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = cents;
      const g = ac.createGain(); g.gain.value = amps[i] * 0.5;
      o.connect(g); g.connect(lp);
      o.start(t);
      voices.push(o);
    }
  });
  // a distant shimmer riding on top
  const src = ac.createBufferSource(); src.buffer = G.noiseBuf; src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
  const ng = ac.createGain(); ng.gain.value = 0.012;
  const nlfo = ac.createOscillator();
  nlfo.type = 'sine'; nlfo.frequency.value = 0.07;
  const nAmt = ac.createGain(); nAmt.gain.value = 0.008;
  nlfo.connect(nAmt); nAmt.connect(ng.gain);
  nlfo.start(t);
  src.connect(bp); bp.connect(ng); ng.connect(out);
  src.start(t);
  G.drone = { out, voices, extra: [lfo, nlfo, src] };
}
export function stopDrone(){
  if (!G.drone || !G.actx) return;
  const t = G.actx.currentTime;
  G.drone.out.gain.cancelScheduledValues(t);
  G.drone.out.gain.setValueAtTime(G.drone.out.gain.value, t);
  G.drone.out.gain.linearRampToValueAtTime(0, t + 1.2);
  for (const o of G.drone.voices) o.stop(t + 1.4);
  for (const o of G.drone.extra) o.stop(t + 1.4);
  G.drone = null;
}

