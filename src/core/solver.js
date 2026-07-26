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

  // Peel off the inert collectibles if they can be toured on their own.
  //
  // Gems never change what the player can do, so if every one of them sits in
  // a single strongly connected component of the board as it starts out, they
  // can all be picked up before anything else happens - and the rest of the
  // level can then be solved without carrying a 2^12 bitmask through every
  // state. That is the difference between 3.5M states and 900.
  //
  // If a gem is behind a gate the tour proof fails and we fall through to the
  // full joint search, which is slower but exact. The shortcut only ever
  // removes work it has proven to be redundant.
  const inertGoals = active.filter(r => r.goal && r.movementInert && r.targets);
  if (inertGoals.length && canTour(active, S0, inertGoals)){
    const rest = active.filter(r => !inertGoals.includes(r));
    if (!rest.some(r => r.goal))
      return { result: SOLVED, moves: [], expanded: 0, via: 'tour' };
    return search(rest, initialState(rest, start), { maxStates, budgetMs });
  }
  return search(active, S0, { maxStates, budgetMs });
}

function search(active, S0, { maxStates, budgetMs }){

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

// Can every inert target be visited without changing the board at all?
//
// "Inert" means picking the thing up alters nothing about where the player may
// walk - gems, and position goals. If all of them lie in ONE strongly
// connected component of the board as it stands, they can be toured in any
// order and the player can come back, so their ordering carries no
// information and does not belong in the search state.
//
// Two conditions keep this sound:
//
//   - only edges that leave every non-inert slice UNCHANGED are counted. A
//     step that shoves a block would alter the board, so a route depending on
//     one is not a free tour and must not be assumed reversible.
//   - the targets must share a single SCC, not merely be reachable. Reachable
//     is not enough on a directed board: a one-way tile can let you visit a
//     gem and then strand you away from the next one.
//
// The answer is only ever used to REMOVE work already proven redundant. When
// it is false the caller runs the exact joint search instead.
function canTour(active, S0, inertGoals){
  const targets = [];
  for (const r of inertGoals) targets.push(...r.targets());
  if (!targets.length) return false;

  const boardSlices = active.filter(r => r.key && !r.movementInert);
  const sig = S => boardSlices.map(r => r.key(S)).join('|');
  const base = sig(S0);

  const adj = new Map();
  const order = [];
  const stack = [S0.at];
  adj.set(S0.at, []);
  while (stack.length){
    const at = stack.pop();
    order.push(at);
    const outs = adj.get(at);
    for (const nxt of successors({ at, m: S0.m }, active)){
      if (sig(nxt) !== base) continue;       // this edge moved something: not free
      outs.push(nxt.at);
      if (!adj.has(nxt.at)){ adj.set(nxt.at, []); stack.push(nxt.at); }
    }
  }
  for (const t of targets) if (!adj.has(t)) return false;  // unreachable: let BFS rule

  // Kosaraju: one pass for finish order, one on the reversed graph for SCCs
  const seen = new Set(), finish = [];
  const visit = (root) => {
    const st = [[root, 0]];
    if (seen.has(root)) return;
    seen.add(root);
    while (st.length){
      const top = st[st.length - 1];
      const outs = adj.get(top[0]) || [];
      if (top[1] < outs.length){
        const n = outs[top[1]++];
        if (!seen.has(n)){ seen.add(n); st.push([n, 0]); }
      } else { finish.push(top[0]); st.pop(); }
    }
  };
  for (const n of order) visit(n);

  const radj = new Map();
  for (const [a, outs] of adj) for (const b of outs){
    if (!radj.has(b)) radj.set(b, []);
    radj.get(b).push(a);
  }
  const comp = new Map();
  let cid = 0;
  for (let i = finish.length - 1; i >= 0; i--){
    const root = finish[i];
    if (comp.has(root)) continue;
    const st = [root];
    comp.set(root, cid);
    while (st.length){
      const n = st.pop();
      for (const p of (radj.get(n) || [])) if (!comp.has(p)){ comp.set(p, cid); st.push(p); }
    }
    cid++;
  }

  const c0 = comp.get(targets[0]);
  for (const t of targets) if (comp.get(t) !== c0) return false;  // split: ordering matters
  return true;
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
