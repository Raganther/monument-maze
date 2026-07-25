import { G } from '../core/globals.js';
import { CELL, FACES, H } from '../core/constants.js';
import { basisOf, cellToPoint, railKey } from '../core/grid.js';
import { rails } from '../world/level.js';

G.gauntletSpine = null;  // Set of spine cellKeys (the intended path)
export const RAIL_H = CELL * 0.22, RAIL_W = CELL * 0.09;
export const railMat = new THREE.MeshLambertMaterial({ color:0x7a6a80 });
export const railGeo = new THREE.BoxGeometry(CELL * 1.06, RAIL_H, RAIL_W);
// wall whose run reaches the rim: its end is MITRED at 45° — cut on the same
// bisector plane the edge fins stand on, so wrap-around walls meet each other
// (and the fins) perfectly flush, like picture framing
export function makeMiterWallGeo(){
  const L = CELL * 0.53 + CELL * 0.5;   // inner overhang to the rim
  const E = 0.008;                      // hair's-width back-off: two meeting
  const s = new THREE.Shape();          // mitres never share the same plane
  s.moveTo(0, 0);
  s.lineTo(L - E, 0);
  s.lineTo(L + RAIL_H - E, RAIL_H);     // 45° mitre, backed off by E
  s.lineTo(0, RAIL_H);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: RAIL_W, bevelEnabled:false });
  g.translate(0, 0, -RAIL_W/2);
  return g;
}
export const railMiterGeo = makeMiterWallGeo();
// flat rim end for walls with nothing to meet: square cut exactly at the edge,
// anchored at the inner end like the mitre so both position identically
export const RAIL_RUN = CELL * 1.03;
export const railFlatGeo = new THREE.BoxGeometry(RAIL_RUN, RAIL_H, RAIL_W);
railFlatGeo.translate(RAIL_RUN/2, RAIL_H/2, 0);

export function addRail(faceIdx, u, v, dir){
  const f = FACES[faceIdx];
  const [ta, tb] = basisOf(f.n);
  const axis = (dir[1] === 'u' ? ta : tb).clone().multiplyScalar(dir[0] === '+' ? 1 : -1);
  const along = dir[1] === 'u' ? tb : ta;
  const m = cellToPoint(faceIdx, u, v).addScaledVector(axis, CELL/2);
  rails.add(railKey(m));

  const zl = new THREE.Vector3().crossVectors(along, f.n);
  const q = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(along, f.n, zl));

  const onCubeEdge = Math.abs(m.dot(axis)) > H - 1e-4;
  if (onCubeEdge){
    // an edge-running wall is a single standard-thickness fin standing on the
    // edge's angular bisector — one wall doing one wall's job
    const up = f.n.clone().add(axis).normalize();
    const fin = new THREE.Mesh(railGeo, railMat);
    fin.castShadow = true; fin.receiveShadow = true;
    fin.position.copy(m).addScaledVector(up, RAIL_H/2);
    fin.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      along, up, new THREE.Vector3().crossVectors(along, up)));
    G.levelGroup.add(fin);
    return;
  }

  // in-face wall; if its run reaches the rim, the end depends on context:
  // something continues past it (a wrapping wall on the far face, or an edge
  // fin flanking the endpoint) -> 45° mitre to meet it flush.
  // nothing continues (open edge passage) -> clean flat cut at the rim.
  const runCoord = m.dot(along);
  const atEdge = Math.abs(runCoord) > H - CELL/2 - 1e-4;
  if (atEdge){
    const sgn = Math.sign(runCoord);
    const end = m.clone().addScaledVector(along, sgn * CELL/2);      // on the edge
    const mirror = m.clone().addScaledVector(along, sgn * CELL/2)
                            .addScaledVector(f.n, -CELL/2);          // seam across the rim
    const hasPartner =
      rails.has(railKey(mirror)) ||
      rails.has(railKey(end.clone().addScaledVector(axis,  CELL/2))) ||
      rails.has(railKey(end.clone().addScaledVector(axis, -CELL/2)));
    const xDir = along.clone().multiplyScalar(sgn);
    const mesh = new THREE.Mesh(hasPartner ? railMiterGeo : railFlatGeo, railMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.copy(m).addScaledVector(along, -sgn * CELL * 0.53);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      xDir, f.n, new THREE.Vector3().crossVectors(xDir, f.n)));
    G.levelGroup.add(mesh);
    return;
  }
  const mesh = new THREE.Mesh(railGeo, railMat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.position.copy(m).addScaledVector(f.n, RAIL_H/2);
  mesh.quaternion.copy(q);
  G.levelGroup.add(mesh);
}

// walkway tiles: shelved system, kept ready
