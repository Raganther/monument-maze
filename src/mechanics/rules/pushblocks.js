// Movable blocks. Walk into one and it slides one cell ahead of you; the win
// condition is a configuration - every block standing on a pad - rather than a
// place you reach.
//
// This is the mechanic the framework exists for. Its old verifier ran a
// separate Sokoban search with its own idea of the board, and disagreed with
// the game in three ways:
//
//   1. it checked only that the player could REACH the pushing cell, never
//      that they could LEAVE it in the pushing direction - so a block behind a
//      one-way arrow looked pushable and was not;
//   2. it located the pushing cell geometrically, ignoring rails, so the
//      player could be asked to stand somewhere they could never step from;
//   3. on a 250ms timeout it returned "unsolvable" and blocks were quietly
//      dropped, shipping a layout nobody had proven.
//
// None of those can recur here. There is no separate search: a push is an
// ordinary transition offered to sim.step(), which has already applied every
// exitAllowed() rule - rails and arrows included - before interact() is even
// called. The block's own destination is then tested with the same isBlocked()
// every other mechanic contributes to. And the budget lives in the solver,
// which reports UNKNOWN rather than a verdict it did not earn.
import { cellKey, cellNeighbours } from '../../core/grid.js';
import { isBlocked, parseCell } from '../../core/sim.js';
import { pushBlocks, pushPads } from '../../world/level.js';

// The cell one step from `cellK` along direction D, with its seam - the same
// wrap-around-the-edge walk the player makes.
function stepFrom(cellK, D){
  const [fi, u, v] = parseCell(cellK);
  for (const [nf, nu, nv, seam, dir] of cellNeighbours(fi, u, v))
    if (dir.dot(D) > 0.9) return { to: cellKey(nf, nu, nv), seam };
  return null;
}

export default {
  id: 'push',
  enabled(){ return pushBlocks.size > 0; },
  initState(){ return [...pushBlocks.keys()].sort(); },

  blocks(cellK, S){ return S.m.push.includes(cellK); },

  interact(from, exit, S, rules){
    const i = S.m.push.indexOf(exit.to);
    if (i < 0) return null;                       // nothing of ours in the way

    // Where the block would end up, following the same wrap-around-the-edge
    // walk the player makes.
    const onward = stepFrom(exit.to, exit.dir);
    if (!onward) return null;                     // block is against an edge

    // The block's own move is offered to every exit rule, tagged as cargo, so
    // a rail on its seam stops it exactly as it stops us.
    const blockExit = { ...onward, dir: exit.dir, from: parseCell(exit.to), mover: 'push' };
    for (const r of rules)
      if (r.exitAllowed && !r.exitAllowed(blockExit.from, blockExit, S)) return null;

    // Test the destination with this block lifted off the board, otherwise it
    // would collide with itself; everything else - stone, pits, the other
    // blocks - still applies, via the same isBlocked() the player uses.
    const without = S.m.push.filter((_, j) => j !== i);
    if (isBlocked(onward.to, { at: S.at, m: { ...S.m, push: without } }, rules)) return null;

    return { at: S.at, m: { ...S.m, push: [...without, onward.to].sort() } };
  },

  goal(S){
    for (const pad of pushPads.keys()) if (!S.m.push.includes(pad)) return false;
    return true;
  },
  key(S){ return S.m.push.join(';'); },
};
