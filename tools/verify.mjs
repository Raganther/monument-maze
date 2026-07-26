// Sweep mechanic combinations x levels x seeds and prove every generated board
// is winnable. This is the regression net for the whole framework: if a new
// mechanic can produce an impossible level in combination with an old one, it
// shows up here rather than in someone's hands.
//
//   node tools/verify.mjs                 # default sweep
//   node tools/verify.mjs --seeds 20      # more seeds per case
//   node tools/verify.mjs --quick
import { seedRandom } from './headless.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const QUICK  = process.argv.includes('--quick');
const SEEDS  = Number(arg('seeds', QUICK ? 3 : 8));
const LEVELS = QUICK ? [1, 9] : [1, 3, 5, 9, 12, 15];

const { FEATURES } = await import('../src/config/features.js');
await import('../src/config/wiring.js');
const { G } = await import('../src/core/globals.js');
const { buildLevel } = await import('../src/game/lifecycle.js');
const { verifyLevel } = await import('../src/gen/verify.js');
const L = await import('../src/world/level.js');

// The gameplay mechanics worth combining. Purely cosmetic features (palettes,
// bevels, audio) cannot affect solvability, so sweeping them would only burn
// time - they are left at their defaults.
const GAMEPLAY = ['towers', 'rails', 'holes', 'bridges', 'portals', 'oneways', 'keystone'];
const BASE = Object.fromEntries(Object.keys(FEATURES).map(k => [k, FEATURES[k].on]));

const CASES = [];
for (const mode of ['collect', 'reach', 'puzzle']){
  CASES.push({ mode, on: [], label: 'bare' });
  for (const f of GAMEPLAY) CASES.push({ mode, on: [f], label: f });
  CASES.push({ mode, on: ['oneways', 'portals'], label: 'oneways+portals' });
  CASES.push({ mode, on: ['oneways', 'rails', 'holes'], label: 'oneways+rails+holes' });
  CASES.push({ mode, on: GAMEPLAY, label: 'everything' });
}

let pass = 0, fail = 0, unknown = 0;
const failures = [];
const t0 = Date.now();

for (const c of CASES){
  for (const lvl of LEVELS){
    for (let s = 1; s <= SEEDS; s++){
      for (const k of GAMEPLAY) FEATURES[k].on = c.on.includes(k);
      for (const k of Object.keys(FEATURES))
        if (!GAMEPLAY.includes(k)) FEATURES[k].on = BASE[k];

      seedRandom(s * 7919 + lvl * 104729);
      G.modeKey = c.mode;
      G.level = lvl;
      try { buildLevel(); }
      catch (e){
        fail++; failures.push({ ...c, lvl, s, result: 'BUILD-THREW', detail: e.message });
        continue;
      }

      const { result, expanded } = verifyLevel({ budgetMs: 2500, maxStates: 400000 });
      if (result === 'SOLVED') pass++;
      else {
        if (result === 'UNKNOWN') unknown++; else fail++;
        failures.push({
          ...c, lvl, s, result, expanded,
          board: `blocked=${L.blocked.size} rails=${L.rails.size} ow=${L.oneways.size} ` +
                 `portals=${L.portals.size} holes=${L.holes.size} gems=${L.gems.length} ` +
                 `blocks=${L.pushBlocks.size}/${L.pushPads.size} finish=${G.finishKey || '-'}`,
        });
      }
    }
  }
  process.stdout.write('.');
}

const total = pass + fail + unknown;
console.log(`\n\n${total} levels  ${pass} solved  ${fail} unsolvable  ${unknown} unknown` +
            `   (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

if (failures.length){
  console.log('\n--- failures ---');
  for (const f of failures.slice(0, 40))
    console.log(`  ${f.mode}/${f.label} lvl=${f.lvl} seed=${f.s}: ${f.result}` +
                (f.board ? `\n      ${f.board}` : '') + (f.detail ? `\n      ${f.detail}` : ''));
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
}
process.exit(failures.length ? 1 : 0);
