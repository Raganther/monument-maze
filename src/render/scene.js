import { G } from '../core/globals.js';
import { FEATURES, featureOn } from '../config/features.js';
import { H } from '../core/constants.js';

// ---------- renderer / scene / fixed iso camera ----------
export const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();

G.camera = undefined;
export const ISO_EL = Math.atan(1/Math.SQRT2);      // the classic isometric elevation
export const _invCamQ = new THREE.Quaternion();     // world -> screen
export const CAM_DIR = new THREE.Vector3(1,1,1).normalize();   // camera view direction
// free-camera orbit: azimuth around the cube, elevation above it
G.camAz = Math.PI/4; G.camEl = Math.atan(1/Math.SQRT2);  // matches the locked iso view
// SKEWED VIEW mirrors left/right so neither side plane is permanently the
// squashed one. It flips only when the player changes plane — never mid-walk,
// which would swing the view and change what the keys mean underfoot.
G.skewSign = 1; G.skewCur = 0; G.elevCur = Math.atan(1/Math.SQRT2);
export const CAM_R = Math.sqrt(12*12*3);   // the classic (12,12,12) isometric distance
export function applyCamera(){
  if (featureOn('freeCam')){
    G.camera.position.set(
      CAM_R * Math.cos(G.camEl) * Math.cos(G.camAz),
      CAM_R * Math.sin(G.camEl),
      CAM_R * Math.cos(G.camEl) * Math.sin(G.camAz));
    G.camera.up.set(0, 1, 0);
  } else {    // locked view. SKEWED VIEW offsets the azimuth off the symmetric isometric:
    // at 0° the top plane's four directions project to identical diagonals, so
    // nothing on screen says which way is forward. Offsetting breaks that tie
    // geometrically — one direction reads clearly up-screen. The offset mirrors
    // (skewSign) so neither side plane stays squashed forever.
    const az = Math.PI/4 + G.skewCur;
    const el = G.elevCur;
    G.camera.position.set(
      CAM_R * Math.cos(el) * Math.cos(az),
      CAM_R * Math.sin(el),
      CAM_R * Math.cos(el) * Math.sin(az));
    G.camera.up.set(0, 1, 0);
  }
  G.camera.lookAt(0, 0, 0);
  // a NaN anywhere in the camera blanks the whole render — never let one through
  if (!Number.isFinite(G.camera.position.x + G.camera.position.y + G.camera.position.z)){
    console.warn('camera NaN guarded; falling back to isometric');
    G.skewCur = 0; G.elevCur = ISO_EL;
    G.camera.position.set(12, 12, 12);
    G.camera.up.set(0, 1, 0);
    G.camera.lookAt(0, 0, 0);
  }
  _invCamQ.copy(G.camera.quaternion).invert();
  CAM_DIR.copy(G.camera.position).normalize();
}
export function setupCamera(){
  const aspect = innerWidth / innerHeight;
  const S = H * 2.1;
  G.camera = new THREE.OrthographicCamera(-S*aspect, S*aspect, S, -S, 0.1, 100);
  applyCamera();
}
setupCamera();

// lighting: a soft sky fill plus a directional sun. The balance between them
// IS the shadow strength — more fill washes shadows out, less deepens them.
export const hemi = new THREE.HemisphereLight(0xfff6e8, 0xb8a6c4, 1.05);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 0.4);
sun.position.set(8, 14, 6);
// shadow frustum: tight around the cube (plus stacks) so the map stays sharp
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
export const SR = H * 2.4;
sun.shadow.camera.left = -SR; sun.shadow.camera.right = SR;
sun.shadow.camera.top = SR;   sun.shadow.camera.bottom = -SR;
sun.shadow.camera.near = 1;   sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0015;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// Shadow strength trades the sun against the sky fill: a stronger sun casts
// deeper shadows, and the fill drops to let them read. At zero it's the
// original flat lighting.
export function applyShadows(){
  const on = featureOn('shadows');
  const s = on ? FEATURES.shadows.slider.value / 100 : 0;
  renderer.shadowMap.enabled = on && s > 0;
  sun.castShadow = on && s > 0;
  sun.intensity = 0.4 + s * 0.75;
  hemi.intensity = 1.05 - s * 0.42;
  scene.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
}

// Six-colour face schemes — the whole world's palette. Order matches FACES:
// EAST, WEST, TOP, BOTTOM, SOUTH, NORTH. Each is a cohesive set where no two
// adjacent faces clash and the top (the main play surface) stays legible.
export const FACE_PALETTES = [
  { name:'Sorbet',    cols:['#e08e79','#84b6a6','#eec170','#9a8fb8','#d98ba0','#7f9bc4'] }, // original
  { name:'Dusk',      cols:['#d98a8a','#7d9fb0','#e6b98a','#8f82a8','#c98aa8','#6f8bb0'] }, // muted, cooler
  { name:'Meadow',    cols:['#a8c88a','#7bb0a0','#e6d488','#b0a8c0','#e0a890','#88a8c0'] }, // fresh greens/warm
  { name:'Candy',     cols:['#f2a0b0','#8fd0c0','#ffd98a','#c0a8e0','#f2a0c8','#90c0e8'] }, // brighter, playful
  { name:'Terracotta',cols:['#d88a6a','#9aa87a','#e0b070','#a89078','#cc8888','#8898a0'] }, // earthy, warm
  { name:'Nocturne',  cols:['#b0708a','#5f8a90','#c0a070','#70688f','#a0708f','#5a7090'] }, // deep, dim, moody
  // ---- ruin sets: desaturated aged stone, textured surfaces ----
  { name:'Weathered Stone', ruin:true,
    cols:['#b0a290','#9aa596','#c4b48f','#9c95a0','#b39a94','#93a0a8'] }, // earthy, six muted tones
  { name:'Mossy Ruins', ruin:true,
    cols:['#9ba883','#8fa891','#b3ac82','#93998a','#a89a86','#8a9c95'] }, // green/ochre lichen
  { name:'Bleached Bone', ruin:true,
    cols:['#d8cfbe','#cdd0c6','#dcd2bb','#cbc6c8','#d4c7bd','#c4cbcd'] }, // pale sun-worn
  { name:'Sunken Temple', ruin:true,
    cols:['#8a9488','#7f9498','#9a9880','#84838f','#918980','#7c8a92'] }, // dim, damp, shadowed
];
export function activeFacePalette(){
  const idx = featureOn('facePalette')
    ? Math.max(0, Math.min(FACE_PALETTES.length - 1, FEATURES.facePalette.slider.value)) : 0;
  return FACE_PALETTES[idx];
}
export function faceColor(fi){ return activeFacePalette().cols[fi]; }


export const world = new THREE.Group();
scene.add(world);
