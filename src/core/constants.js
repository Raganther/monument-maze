// ---------- layout ----------
export const N = 6;
export const H = 3;
export const CELL = (2*H) / N;
export const SLIDE_MS = 150;
export const FLIP_MS  = 340;
export const SWIVEL_MS = 480;

export const FACES = [
  { n:new THREE.Vector3( 1,0,0), name:'EAST',   color:'#e08e79' },
  { n:new THREE.Vector3(-1,0,0), name:'WEST',   color:'#84b6a6' },
  { n:new THREE.Vector3(0, 1,0), name:'TOP',    color:'#eec170' },
  { n:new THREE.Vector3(0,-1,0), name:'BOTTOM', color:'#9a8fb8' },
  { n:new THREE.Vector3(0,0, 1), name:'SOUTH',  color:'#d98ba0' },
  { n:new THREE.Vector3(0,0,-1), name:'NORTH',  color:'#7f9bc4' },
];
export const AXES = [
  new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
  new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
  new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1),
];


export const _upY = new THREE.Vector3(0,1,0);
export const HOLE_OPEN = CELL * 0.78;   // opening size (matches the alpha-cut window)
export const HOLE_DEPTH = CELL * 1.15;
