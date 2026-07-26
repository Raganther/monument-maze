// Quick interactive probe: generate one level with a given feature set and
// report what the solver makes of it.
//
//   node tools/probe.mjs [seed] [level] [mode] [+feat,-feat,...]
//   node tools/probe.mjs 1 9 puzzle +oneways,+portals
import { seedRandom } from './headless.mjs';

const seed  = Number(process.argv[2] || 1);
const level = Number(process.argv[3] || 5);
const mode  = process.argv[4] || 'collect';
const toggles = (process.argv[5] || '').split(',').filter(Boolean);
seedRandom(seed);

const { FEATURES } = await import('../src/config/features.js');
await import('../src/config/wiring.js');
const modes = await import('../src/config/modes.js');
const { G } = await import('../src/core/globals.js');
const { RULES } = await import('../src/mechanics/rules/index.js');
const { solve } = await import('../src/core/solver.js');
const level_ = await import('../src/world/level.js');

for (const t of toggles){
  const key = t.slice(1);
  if (FEATURES[key]) FEATURES[key].on = t[0] === '+';
  else console.warn('unknown feature:', key);
}

// build a level the way buildLevel() does, minus the rendering
const { buildLevel } = await import('../src/game/lifecycle.js');
G.modeKey = mode;
G.level = level;
buildLevel();

console.log('feature set:', Object.keys(FEATURES).filter(k => FEATURES[k].on).join(', '));
console.log('board: blocked=%d rails=%d oneways=%d portals=%d holes=%d gems=%d blocks=%d pads=%d keys=%d gates=%d',
  level_.blocked.size, level_.rails.size, level_.oneways.size, level_.portals.size,
  level_.holes.size, level_.gems.length, level_.pushBlocks.size, level_.pushPads.size,
  level_.keys.size, level_.gates.size);

const t0 = Date.now();
const r = solve(RULES);
console.log(`solver: ${r.result}  expanded=${r.expanded}  moves=${r.moves.length}  ${Date.now()-t0}ms`);
