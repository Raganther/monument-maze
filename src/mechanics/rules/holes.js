// An open pit. Stepping in is not fatal - you sink and reappear at the start
// cell, keeping whatever you had already collected - but the solver treats a
// hole as simply impassable.
//
// That is deliberate and it is the conservative direction: it can only make
// the solver believe in FEWER routes than really exist, so a level it passes
// is certainly solvable. Claiming a route through a hole would be the
// dangerous error. It also matches how holes are placed in the first place:
// generateHoles() only keeps a pit if the surface stays connected without it.
import { holes } from '../../world/level.js';

export default {
  id: 'holes',
  blocks(cellK){ return holes.has(cellK); },
};
