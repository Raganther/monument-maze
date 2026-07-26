import { G } from '../core/globals.js';

// ---------- level content (rebuilt every level) ----------
G.levelGroup = null;
export const blocked = new Set();


export const monumentCells = [];
export const rails = new Set();
export const oneways = new Map();        // cellKey -> allowed exit direction (Vector3)
export const onewayMeshes = [];
export const wallRep = new Map();        // seamKey -> [fi,u,v,dir] mesh representative
export const gauntletWallSeams = new Set(); // spine seams walled for portal bridges
export const pathFaces = new Set();
export const pathCells = new Set();
export const holes = new Set();
export const holeList = [];
export const bridged = new Set();
export const portals = new Map();       // cellKey -> { pair: cellKey }
export const portalList = [];           // [fi,u,v] for texture cutting
export const portalFX = new Map();      // cellKey -> { lightMat, light, flare }
export const gems = [];
export const pushBlocks = new Map();     // current cellKey -> { mesh }
export const pushPads = new Map();       // pad cellKey -> mesh
export const keys = new Map();           // cellKey -> colour index
export const gates = new Map();          // cellKey -> colour index that opens it
