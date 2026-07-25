import { G } from '../core/globals.js';
import { FEATURES, timerActive } from './features.js';
import { MODE } from './modes.js';
import { generateBridges } from '../mechanics/bridges.js';
import { generateHoles } from '../mechanics/holes.js';
import { generateOneWays } from '../mechanics/oneways.js';
import { generatePortals } from '../mechanics/portals.js';
import { generateRails } from '../mechanics/rails.js';
import { generateObstacles } from '../mechanics/towers.js';

// Attaches the FEATURES gen()/onGem() hooks to the registry.
//
// These bodies live here rather than beside their data so that
// config/features.js stays a leaf: a mechanic needs featureOn(), and the
// registry needs the mechanic's generator, which is a cycle if both sides sit
// in one module. Splitting the data from the wiring breaks it. The hooks are
// only ever invoked from buildLevel(), long after every module has evaluated.
FEATURES.towers.gen = function(){ generateObstacles(Math.min(Math.round((20 + G.level*8) * MODE().density), 80)); };
FEATURES.rails.gen = function(){ generateRails(Math.min(8 + G.level*3, 26)); };
FEATURES.holes.gen = function(){ generateHoles(Math.min(3 + G.level*2, 14)); };
FEATURES.bridges.gen = function(){ generateBridges(Math.min(2 + G.level, 8)); };
FEATURES.portals.gen = function(){ generatePortals(Math.min(2 + (G.level >> 1), 4)); };
FEATURES.bonusTime.onGem = function(){ if (timerActive()) G.timeLeft += 3; };
FEATURES.oneways.gen = function(){ generateOneWays(Math.min(2 + (G.level >> 1), 8)); };
