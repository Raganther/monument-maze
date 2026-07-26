// The rules of movement, in one place.
//
// This is the whole point of the framework. The game and the solver both call
// step(), so they cannot disagree about what is legal - and "the verifier
// modelled a move the runtime refuses" is exactly the class of bug that made
// levels generate unsolvable. A mechanic teaches its rule here by implementing
// the hooks below; nothing about any specific mechanic lives in this file.
//
// A rule object may implement any of:
//
//   exitAllowed(from, exit, S)  veto leaving `from` along `exit`. `exit.mover`
//                               is 'player' for a step, or the id of whatever
//                               is being shoved - a rail stops both, an arrow
//                               only stops the player.
//   blocks(cellKey, S)          the cell cannot be stood on right now
//   interact(from, exit, S, rules)
//                               the dest is blocked, but this mechanic can
//                               resolve it (pushing a block) -> new state
//   extraMoves(S)               successor states that are not a compass step
//                               (stepping into a portal mouth)
//   onEnter(cellKey, S)         slice update on arriving (picking a gem up)
//   goal(S)                     this mechanic's win condition
//   key(S)                      canonical slice identity for the visited set
//
// All of them are optional. A purely static mechanic (stone blocks) implements
// blocks() alone and costs the search nothing, because it contributes no state.

import { cellKey, cellNeighbours } from './grid.js';
import { makeState, withSlice } from './state.js';

export const parseCell = k => k.split(',').map(Number);

// The four compass exits from a cell, as
// { to, seam, dir } - destination key, seam key, direction vector.
export function exitsOf(cellK){
  const [fi, u, v] = parseCell(cellK);
  return cellNeighbours(fi, u, v).map(([nf, nu, nv, seam, dir]) => ({
    to: cellKey(nf, nu, nv), seam, dir, from: [fi, u, v], mover: 'player',
  }));
}

// Build the starting state by asking every active rule for its initial slice.
export function initialState(rules, at){
  const slices = {};
  for (const r of rules) if (r.initState){
    const s = r.initState();
    if (s !== undefined) slices[r.id] = s;
  }
  return makeState(at, slices);
}

// Attempt one compass step. Returns the resulting state, or null if the move
// is illegal. `exit` comes from exitsOf().
export function step(S, exit, rules){
  // 1. may we leave this cell in this direction at all?  (one-way arrows,
  //    rails on the seam). Checking this BEFORE anything else is what keeps a
  //    push honest: a block you cannot walk into is a block you cannot shove.
  for (const r of rules)
    if (r.exitAllowed && !r.exitAllowed(exit.from, exit, S)) return null;

  // 2. is the destination occupied?
  let S2 = S;
  if (isBlocked(exit.to, S2, rules)){
    // some mechanic may be able to clear it - that is what a push is
    let resolved = null;
    for (const r of rules) if (r.interact){
      const out = r.interact(exit.from, exit, S2, rules);
      if (out){ resolved = out; break; }
    }
    if (!resolved) return null;
    S2 = resolved;
    // whatever it did, we still have to be able to stand there afterwards
    if (isBlocked(exit.to, S2, rules)) return null;
  }

  return enter(S2, exit.to, rules);
}

export function isBlocked(cellK, S, rules){
  for (const r of rules) if (r.blocks && r.blocks(cellK, S)) return true;
  return false;
}

// Arrive on a cell: move the player there and let every mechanic react.
export function enter(S, cellK, rules){
  let out = { at: cellK, m: S.m };
  for (const r of rules) if (r.onEnter){
    const slice = r.onEnter(cellK, out);
    if (slice !== undefined) out = withSlice(out, r.id, slice);
  }
  return out;
}

// Every state reachable from S in one move.
export function successors(S, rules){
  const out = [];
  for (const exit of exitsOf(S.at)){
    const next = step(S, exit, rules);
    if (next) out.push(next);
  }
  for (const r of rules) if (r.extraMoves){
    for (const next of r.extraMoves(S, rules) || []) out.push(next);
  }
  return out;
}

// The level is won when every active mechanic that has an opinion is satisfied.
// This AND is what makes combinations compose: turn two objectives on and the
// solver looks for a state that satisfies both, with no extra code.
export function isGoal(S, rules){
  let any = false;
  for (const r of rules) if (r.goal){
    any = true;
    if (!r.goal(S)) return false;
  }
  return any;      // a level with no objective at all is never "won"
}
