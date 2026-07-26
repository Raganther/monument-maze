// The single finish tile used by the REACH objective. Stateless: the win
// condition is just "be standing on it".
import { G } from '../../core/globals.js';

export default {
  id: 'goalcell',
  enabled(){ return !!G.finishKey; },
  movementInert: true,
  targets(){ return [G.finishKey]; },
  goal(S){ return S.at === G.finishKey; },
};
