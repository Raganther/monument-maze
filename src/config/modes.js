import { G } from '../core/globals.js';

// ---------- mode registry ----------
// A mode is data, not a copy of the code. New experiments = new entries here
// (plus, if needed, a feature system gated behind a flag). Every mode shares
// the one engine: movement, generation, rendering.
// OBJECTIVES sit on top of ONE shared open layout. The layout generator is the
// same for all three (the breathable Classic board — sparse blocks, monuments,
// negative space); the objective only decides what's placed on top and what
// "winning" means. This keeps every lab dynamic available to every objective.
export const MODES = {
  collect: {
    name: 'COLLECT',
    desc: 'Gather every gem across the six planes.',
    timer: true,
    density: 1.0,
    objective: 'collect',
  },
  reach: {
    name: 'REACH',
    desc: 'Find the single goal and get there.',
    timer: false,
    density: 1.0,
    objective: 'reach',
  },
  puzzle: {
    name: 'PUZZLE',
    desc: 'Solve the maze — no clock, no rush.',
    timer: false,
    density: 1.0,
    objective: 'puzzle',
  },
};
G.modeKey = 'collect';
export const MODE = () => MODES[G.modeKey];
// goal-based objectives (reach a single finish) vs gem collection
export const isGoalObjective = () => MODE().objective === 'reach' || MODE().objective === 'puzzle';

