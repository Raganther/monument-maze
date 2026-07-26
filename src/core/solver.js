// One search, over whatever mechanics happen to be switched on.
//
// The solver knows nothing about gems, portals or blocks. It walks the state
// graph that sim.js exposes and stops when sim.isGoal() is satisfied, so a
// mechanic added tomorrow is verified today's way with no change here.
//
// The result is deliberately three-valued. The old per-feature checker
// returned false when it ran out of budget, and the generator read that as
// "unsolvable, drop a block" - so a level nobody had proven got shipped. An
// exhausted search is not evidence of anything, and UNKNOWN says so.

import { initialState, isGoal, successors } from './sim.js';
import { stateKey } from './state.js';

export const SOLVED      = 'SOLVED';
export const UNSOLVABLE  = 'UNSOLVABLE';
export const UNKNOWN     = 'UNKNOWN';

const DEFAULTS = {
  maxStates: 250000,
  budgetMs: 4000,
  start: '2,2,2',
};

// BFS. Returns { result, moves, expanded } where `moves` is the winning path
// as a list of states (empty unless SOLVED) - the SOLUTION trail reads it, and
// the runtime-equivalence test replays it.
export function solve(rules, opts = {}){
  const { maxStates, budgetMs, start } = { ...DEFAULTS, ...opts };
  const active = rules.filter(r => !r.enabled || r.enabled());

  const S0 = initialState(active, start);
  if (isGoal(S0, active)) return { result: SOLVED, moves: [S0], expanded: 0 };

  const seen = new Set([stateKey(S0, active)]);
  const queue = [S0];
  const prev = new Map();                 // stateKey -> [parentKey, state]
  const t0 = now();
  let expanded = 0, head = 0;

  while (head < queue.length){
    if (++expanded > maxStates) return { result: UNKNOWN, moves: [], expanded };
    if ((expanded & 511) === 0 && now() - t0 > budgetMs)
      return { result: UNKNOWN, moves: [], expanded };

    const S = queue[head++];
    const sk = stateKey(S, active);

    for (const next of successors(S, active)){
      const nk = stateKey(next, active);
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, [sk, next]);
      if (isGoal(next, active))
        return { result: SOLVED, moves: reconstruct(prev, nk, S0, active), expanded };
      queue.push(next);
    }
  }
  // the frontier is genuinely empty - every reachable state has been seen and
  // none of them wins. This one really is impossible.
  return { result: UNSOLVABLE, moves: [], expanded };
}

// Which cells can the player ever stand on? Used by generators that want to
// place something reachable without caring about the objective.
export function reachableCells(rules, start = '2,2,2'){
  const active = rules.filter(r => !r.enabled || r.enabled());
  const S0 = initialState(active, start);
  const seen = new Set([stateKey(S0, active)]);
  const cells = new Set([S0.at]);
  const queue = [S0];
  for (let h = 0; h < queue.length && h < 200000; h++){
    for (const next of successors(queue[h], active)){
      const nk = stateKey(next, active);
      if (seen.has(nk)) continue;
      seen.add(nk); cells.add(next.at); queue.push(next);
    }
  }
  return cells;
}

function reconstruct(prev, endKey, S0, active){
  const out = [];
  let k = endKey;
  while (prev.has(k)){
    const [pk, st] = prev.get(k);
    out.push(st);
    k = pk;
  }
  out.push(S0);
  return out.reverse();
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
