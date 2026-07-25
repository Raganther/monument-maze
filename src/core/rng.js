// Deterministic per cell (hash-seeded) so a given block is always laid the same.
export function seededRand(seed){
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967295; };
}
