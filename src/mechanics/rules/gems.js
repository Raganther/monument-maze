// Gems. The state slice is a bitmask of which ones have been picked up, so
// the search can tell "standing here having collected 3 of 5" apart from
// "standing here having collected 4 of 5" - the same cell, but not the same
// position in the puzzle.
//
// The win condition is "all of them", which sim.isGoal() ANDs with whatever
// else is switched on. Turn KEYSTONE on as well and the solver looks for a
// state that satisfies both, with no coordination code between them.
import { cellKey, pointToCell } from '../../core/grid.js';
import { gems } from '../../world/level.js';

let index = new Map();          // cellKey -> bit position
let full = 0;

function reindex(){
  index = new Map();
  full = 0;
  gems.forEach((g, i) => {
    if (i >= 30) return;        // bitmask headroom; levels cap at 12
    const c = pointToCell(g.face, g.pos);
    index.set(cellKey(g.face, c.u, c.v), i);
    full |= (1 << i);
  });
}

export default {
  id: 'gems',
  enabled(){ return gems.length > 0; },
  initState(){ reindex(); return 0; },
  onEnter(cellK, S){
    const bit = index.get(cellK);
    if (bit === undefined) return undefined;
    return (S.m.gems | (1 << bit));
  },
  goal(S){ return (S.m.gems & full) === full; },
  key(S){ return String(S.m.gems); },
};
