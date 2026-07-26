// Stone. The oldest rule in the game: you cannot walk into a block.
//
// Also covers the maze-mode corridor mask (pathFaces/pathCells), which marks
// whole faces where only the carved cells are floor.
import { blocked, pathCells, pathFaces } from '../../world/level.js';

export default {
  id: 'towers',
  blocks(cellK){
    if (blocked.has(cellK)) return true;
    const fi = Number(cellK.slice(0, cellK.indexOf(',')));
    if (pathFaces.has(fi) && !pathCells.has(cellK)) return true;
    return false;
  },
};
