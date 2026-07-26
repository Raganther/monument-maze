// A rail sits on the seam between two cells and severs it, in both
// directions, for the player and for anything being pushed.
import { rails } from '../../world/level.js';

export default {
  id: 'rails',
  exitAllowed(_from, exit){ return !rails.has(exit.seam); },
};
