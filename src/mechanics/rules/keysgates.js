// Coloured keys and the gates they open.
//
// This mechanic exists partly to be played and partly as the proof that the
// framework works: it introduces a genuinely new kind of state - an inventory
// that changes which cells are passable - and it did not require a single line
// of change in core/sim.js, core/solver.js or any other mechanic. It declares
// three hooks and the solver picks it up.
//
// Note what it does NOT set: movementInert. Holding a key changes where you
// can walk, so the solver's tour shortcut correctly refuses to apply and falls
// back to the full state search. That is the contract doing its job - a
// mechanic cannot accidentally opt into an optimisation that would be unsound
// for it.
import { gates, keys } from '../../world/level.js';

export default {
  id: 'keys',
  enabled(){ return gates.size > 0 || keys.size > 0; },

  // bitmask of colours currently held
  initState(){ return 0; },

  // a gate blocks unless its colour is in the inventory
  blocks(cellK, S){
    const colour = gates.get(cellK);
    return colour !== undefined && !(S.m.keys & (1 << colour));
  },

  onEnter(cellK, S){
    const colour = keys.get(cellK);
    if (colour === undefined) return undefined;
    return S.m.keys | (1 << colour);
  },

  key(S){ return String(S.m.keys); },
};
