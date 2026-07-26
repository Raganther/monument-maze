// Linked doorways. Standing on a mouth, you may drop through to its partner.
//
// In play a portal arms a short dwell: keep walking and you cross straight
// over it, linger and it pulls you through. So a portal cell offers BOTH the
// ordinary compass exits and the trip to its partner, and that is what is
// modelled here - the teleport is an extra move, not a replacement for
// walking. (The old graph replaced a portal cell's exits with its partner's,
// which quietly lost the walk-across option.)
import { enter } from '../../core/sim.js';
import { portals } from '../../world/level.js';

export default {
  id: 'portals',
  extraMoves(S, rules){
    const link = portals.get(S.at);
    if (!link || !link.pair) return null;
    return [enter(S, link.pair, rules)];
  },
};
