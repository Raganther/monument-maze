// A one-way tile: once you are standing on it you may only leave along the
// arrow. This is what makes the movement graph directed.
//
// Note that this is an *exit* rule, not an entry rule - it constrains leaving
// the cell you are on, not arriving at the next one. The runtime enforces it
// the same way (game/movement.js refuses the step and bounces the player), and
// because sim.step() consults this before resolving a push, a block standing
// beyond an arrow is correctly treated as unpushable. Checking reachability of
// the pushing cell alone - which is all the old verifier did - misses exactly
// that case, and it is why movable-block levels came out impossible.
import { cellKey } from '../../core/grid.js';
import { oneways } from '../../world/level.js';

export default {
  id: 'oneways',
  exitAllowed(from, exit){
    // Arrows constrain the player, not cargo: the runtime's tryPush() never
    // consults them, so neither may we. Being stricter here would be safe but
    // would reject layouts that really are solvable.
    if (exit.mover !== 'player') return true;
    const arrow = oneways.get(cellKey(from[0], from[1], from[2]));
    return !arrow || exit.dir.dot(arrow) > 0.9;
  },
};
