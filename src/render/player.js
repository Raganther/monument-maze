import { CELL, FACES, _upY } from '../core/constants.js';
import { cellToPoint, faceIndexOf } from '../core/grid.js';
import { TILE_H } from './path.js';
import { world } from './scene.js';
import { pathFaces } from '../world/level.js';

// ---------- player ----------
export const PSIZE = CELL * 0.62;
export const player = new THREE.Mesh(
  new THREE.BoxGeometry(PSIZE, PSIZE, PSIZE),
  new THREE.MeshLambertMaterial({ color:0xfaf5ea })
);
player.castShadow = true;
world.add(player);

export const P = cellToPoint(2, 2, 2);
export const Nf = FACES[2].n.clone();
export function playerTargetQuat(){
  return new THREE.Quaternion().setFromUnitVectors(_upY, Nf);
}
export function faceLift(fi){ return pathFaces.has(fi) ? TILE_H : 0; }
export function placePlayer(pos){
  player.position.copy(pos)
    .addScaledVector(Nf, PSIZE/2 + 0.01 + faceLift(faceIndexOf(Nf)));
}

