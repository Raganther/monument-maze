// Why is a push-block level unsolvable? Cross-checks the new solver against
// the board directly, so a wrong solver cannot quietly justify a wrong fix.
import { seedRandom } from './headless.mjs';

const seed = Number(process.argv[2] || 1);
const lvl  = Number(process.argv[3] || 9);
seedRandom(seed);

const { FEATURES } = await import('../src/config/features.js');
await import('../src/config/wiring.js');
const { G } = await import('../src/core/globals.js');
const { RULES } = await import('../src/mechanics/rules/index.js');
const { solve, reachableCells } = await import('../src/core/solver.js');
const { initialState, exitsOf, step, successors } = await import('../src/core/sim.js');
const L = await import('../src/world/level.js');
const { buildLevel } = await import('../src/game/lifecycle.js');
const { oneways, rails } = L;

G.modeKey = 'puzzle';
G.level = lvl;
buildLevel();

const active = RULES.filter(r => !r.enabled || r.enabled());
console.log('active rules:', active.map(r => r.id).join(', '));
console.log('blocks:', [...L.pushBlocks.keys()].join('  '));
console.log('pads  :', [...L.pushPads.keys()].join('  '));

const S0 = initialState(active, '2,2,2');

// which cells can the player reach at all, blocks frozen where they start?
const reach = reachableCells(active);
console.log('\nplayer can reach %d cells', reach.size);
for (const pad of L.pushPads.keys())
  console.log('  pad %s reachable by player: %s', pad, reach.has(pad));

// from the start state, is ANY push legal anywhere the player can get to?
let pushes = 0;
const seen = new Set(), q = [S0];
for (let h = 0; h < q.length && h < 20000; h++){
  const S = q[h];
  for (const exit of exitsOf(S.at)){
    const nxt = step(S, exit, active);
    if (!nxt) continue;
    if (nxt.m.push && nxt.m.push.join() !== S.m.push.join()){
      pushes++;
      if (pushes <= 8) console.log('  legal push: %s -> %s (player at %s)',
        S.m.push.filter(b => !nxt.m.push.includes(b)).join(),
        nxt.m.push.filter(b => !S.m.push.includes(b)).join(), S.at);
    }
    const k = nxt.at + '|' + (nxt.m.push || []).join();
    if (seen.has(k)) continue;
    seen.add(k); q.push(nxt);
  }
}
console.log('\ntotal distinct legal pushes found from start: %d', pushes);

// how much does each rule contribute to the impossibility?
console.log('\n-- dropping one rule at a time --');
for (const drop of ['rails', 'oneways', 'towers']){
  const subset = active.filter(r => r.id !== drop);
  const r = solve(subset, { budgetMs: 3000 });
  console.log(`  without ${drop.padEnd(8)} -> ${r.result} (expanded ${r.expanded})`);
}
const full = solve(active, { budgetMs: 3000 });
console.log(`  full ruleset      -> ${full.result} (expanded ${full.expanded})`);
