// Generate, then prove it.
//
// The rule every generator here follows: a level is only accepted once the
// solver has actually found a win from the start cell, with every enabled
// mechanic in play at once. Not "each feature checked itself" - the whole
// board, together, which is the only check that composes.
//
// A budget-exhausted search (UNKNOWN) is treated exactly like a failure. It is
// not evidence of solvability, and shipping on it is how the old code produced
// impossible levels.
import { RULES } from '../mechanics/rules/index.js';
import { SOLVED, solve } from '../core/solver.js';

export { SOLVED, UNSOLVABLE, UNKNOWN } from '../core/solver.js';

// Is the board, exactly as it currently stands, winnable?
export function verifyLevel(opts = {}){
  return solve(RULES, { budgetMs: 700, maxStates: 120000, ...opts });
}

// Try `propose()` until the board it leaves behind verifies.
//
// propose(attempt) sets up the board and returns a value (or false to skip);
// rollback() undoes it. Returns the accepted proposal, or null if every
// attempt failed - callers must handle null rather than shipping the last try.
export function proposeUntilSolvable(propose, rollback, attempts = 12, opts){
  for (let i = 0; i < attempts; i++){
    const candidate = propose(i);
    if (candidate === false || candidate == null){ rollback(); continue; }
    const { result } = verifyLevel(opts);
    if (result === SOLVED) return candidate;
    rollback();
  }
  return null;
}
