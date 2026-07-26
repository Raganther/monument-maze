// The awakened monument. With KEYSTONE on, collecting every gem does not end
// the level - it wakes a monument, and you must then journey to it and dwell.
//
// The rule only contributes "be standing on the keystone". The "collect every
// gem first" half is already the gems rule's goal, and sim.isGoal() ANDs the
// two, so the ordering falls out on its own: any state satisfying both is a
// win, and no state satisfies both without having taken every gem.
import { G } from '../../core/globals.js';
import { featureOn } from '../../config/features.js';

export default {
  id: 'keystone',
  enabled(){ return featureOn('keystone') && !!G.keystoneCell; },
  movementInert: true,
  targets(){ return [G.keystoneCell]; },
  goal(S){ return S.at === G.keystoneCell; },
};
