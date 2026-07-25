import { CELL, FACES, N } from '../core/constants.js';
import { basisOf, cellKey, cellToPoint, railKey } from '../core/grid.js';
import { addRail } from '../render/rails.js';
import { surfaceConnected } from '../world/graph.js';
import { blocked, rails } from '../world/level.js';

export function generateRails(count){
  const dirs = ['+u','-u','+v','-v'];
  const tmp = new THREE.Vector3();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 40){
    const fi = (Math.random()*6)|0;
    const u = (Math.random()*N)|0, v = (Math.random()*N)|0;
    const dir = dirs[(Math.random()*4)|0];
    if (blocked.has(cellKey(fi,u,v))) continue;   // seams beside open floor only
    const [ta, tb] = basisOf(FACES[fi].n);
    const axis = (dir[1]==='u'?ta:tb).clone().multiplyScalar(dir[0]==='+'?1:-1);
    const key = railKey(tmp.copy(cellToPoint(fi,u,v)).addScaledVector(axis, CELL/2));
    if (rails.has(key)) continue;
    rails.add(key);
    if (!surfaceConnected()){ rails.delete(key); continue; }
    rails.delete(key);
    addRail(fi, u, v, dir);   // re-adds the key and builds the mesh
    placed++;
  }
}

// holes: real recessed shafts cut into the cube — walkable, that's the trap
