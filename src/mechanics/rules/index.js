// The rule registry.
//
// This list is the entire integration surface for a new gameplay dynamic:
// write a module that implements whichever sim.js hooks your mechanic needs,
// add it here, and the solver, the generator's solvability check and the
// SOLUTION trail all understand it immediately. Nothing else has to change.
//
// Order matters only for interact(): the first mechanic that can resolve a
// blocked destination wins, so put anything that clears a path before the
// things that merely block one.
import towers    from './towers.js';
import rails     from './rails.js';
import oneways   from './oneways.js';
import holes     from './holes.js';
import portals   from './portals.js';
import pushblocks from './pushblocks.js';
import keysgates from './keysgates.js';
import gems      from './gems.js';
import goalcell  from './goalcell.js';
import keystone  from './keystone.js';

export const RULES = [
  // movement constraints
  towers, rails, oneways, holes, keysgates,
  // things that change the board
  pushblocks, portals,
  // objectives
  gems, goalcell, keystone,
];

export default RULES;
