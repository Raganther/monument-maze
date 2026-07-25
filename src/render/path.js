import { G } from '../core/globals.js';
import { CELL, FACES, _upY } from '../core/constants.js';
import { cellKey, cellToPoint } from '../core/grid.js';
import { pathCells, pathFaces } from '../world/level.js';

export const TILE_H = CELL * 0.12;
export const tileMat = new THREE.MeshLambertMaterial({ color:0xf6ecdc });
export const tileGeo = new THREE.BoxGeometry(CELL * 0.98, TILE_H, CELL * 0.98);
export function addPath(faceIdx, cells){
  pathFaces.add(faceIdx);
  const f = FACES[faceIdx];
  const q = new THREE.Quaternion().setFromUnitVectors(_upY, f.n);
  for (const [u, v] of cells){
    pathCells.add(cellKey(faceIdx, u, v));
    const t = new THREE.Mesh(tileGeo, tileMat);
    t.position.copy(cellToPoint(faceIdx, u, v)).addScaledVector(f.n, TILE_H/2);
    t.quaternion.copy(q);
    G.levelGroup.add(t);
  }
}

