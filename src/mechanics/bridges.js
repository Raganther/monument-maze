import { G } from '../core/globals.js';
import { CELL, FACES, N } from '../core/constants.js';
import { basisOf, cellKey, cellToPoint, railKey } from '../core/grid.js';
import { bevelAmount, bevelledBox, edgeMat, stoneA, stoneB } from '../render/blockgeo.js';
import { surfaceConnected } from '../world/graph.js';
import { blocked, bridged, holes, rails } from '../world/level.js';

export const BR_CLEAR = CELL * 0.78;    // tunnel clearance (player is 0.62 tall)
export const BR_DECK_T = CELL * 0.22;
export const BR_LEG_W = CELL * 0.12;
G.bridgeLegGeo = undefined; G.bridgeDeckGeo = undefined; G.bridgeLegEdges = undefined; G.bridgeDeckEdges = undefined;
export function rebuildBridgeGeo(){
  for (const g of [G.bridgeLegGeo, G.bridgeDeckGeo, G.bridgeLegEdges, G.bridgeDeckEdges])
    if (g) g.dispose();
  const b = bevelAmount();
  G.bridgeLegGeo = bevelledBox(CELL, BR_CLEAR, BR_LEG_W, Math.min(b, BR_LEG_W*0.3));
  G.bridgeDeckGeo = bevelledBox(CELL * 1.06, BR_DECK_T, CELL, Math.min(b, BR_DECK_T*0.3));
  G.bridgeLegEdges = new THREE.EdgesGeometry(G.bridgeLegGeo, 30);
  G.bridgeDeckEdges = new THREE.EdgesGeometry(G.bridgeDeckGeo, 30);
}
rebuildBridgeGeo();

export function addBridge(faceIdx, u, v, alongU){
  const n = FACES[faceIdx].n;
  const [ta, tb] = basisOf(n);
  const along = alongU ? ta : tb;
  const across = alongU ? tb : ta;
  const base = cellToPoint(faceIdx, u, v);
  const zA = new THREE.Vector3().crossVectors(along, n);
  const q = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(along, n, zA));
  for (const s of [1, -1]){
    const leg = new THREE.Mesh(G.bridgeLegGeo, stoneB);
    leg.castShadow = true; leg.receiveShadow = true;
    leg.position.copy(base)
      .addScaledVector(across, s * (CELL/2 - BR_LEG_W/2))
      .addScaledVector(n, BR_CLEAR/2);
    leg.quaternion.copy(q);
    leg.add(new THREE.LineSegments(G.bridgeLegEdges, edgeMat));
    G.levelGroup.add(leg);
  }
  const deck = new THREE.Mesh(G.bridgeDeckGeo, stoneA);
  deck.castShadow = true; deck.receiveShadow = true;
  deck.position.copy(base).addScaledVector(n, BR_CLEAR + BR_DECK_T/2);
  deck.quaternion.copy(q);
  deck.add(new THREE.LineSegments(G.bridgeDeckEdges, edgeMat));
  G.levelGroup.add(deck);
}

export function generateBridges(count){
  const tmp = new THREE.Vector3();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 40){
    const fi = (Math.random()*6)|0;
    const u = 1 + ((Math.random()*(N-2))|0);   // interior cells only
    const v = 1 + ((Math.random()*(N-2))|0);
    if (fi === 2 && u === 2 && v === 2) continue;
    const k = cellKey(fi,u,v);
    if (blocked.has(k) || holes.has(k) || bridged.has(k) || k === G.finishKey) continue;
    const alongU = Math.random() < 0.5;
    const [ta, tb] = basisOf(FACES[fi].n);
    const across = alongU ? tb : ta;
    const c = cellToPoint(fi,u,v);
    const k1 = railKey(tmp.copy(c).addScaledVector(across,  CELL/2));
    const k2 = railKey(tmp.copy(c).addScaledVector(across, -CELL/2));
    if (rails.has(k1) || rails.has(k2)) continue;
    rails.add(k1); rails.add(k2);
    if (!surfaceConnected()){ rails.delete(k1); rails.delete(k2); continue; }
    bridged.add(k);
    addBridge(fi, u, v, alongU);   // the seam keys stay: they are the walls
    placed++;
  }
}

