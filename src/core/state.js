// A LevelState is everything that can change while the level is being played.
//
// The static board — which cells are stone, where the rails and arrows and
// portal mouths are — lives in world/level.js and never changes once a level
// is generated. Anything a *move* can alter lives here instead, in one place,
// so the solver can hold thousands of hypothetical states at once without
// touching the real board.
//
//   at  the player's cell, as a "fi,u,v" key
//   m   one slice per stateful mechanic, keyed by mechanic id
//
// States are treated as immutable: every transition returns a new object and
// shares the slices that did not change.

export function makeState(at, slices = {}){
  return { at, m: slices };
}

// A new state with one mechanic's slice replaced, sharing the rest.
export function withSlice(S, id, slice){
  if (S.m[id] === slice) return S;
  return { at: S.at, m: { ...S.m, [id]: slice } };
}

export function withAt(S, at){
  return S.at === at ? S : { at, m: S.m };
}

// Canonical identity for the visited set. Two states with the same key are
// interchangeable, so a mechanic's key() must fold away anything that does not
// affect what the player can do next - otherwise the search revisits the same
// position under a thousand different names and never terminates.
export function stateKey(S, rules){
  let k = S.at;
  for (const r of rules) if (r.key) k += '|' + r.key(S);
  return k;
}
