// Mutable cross-module state.
//
// ES modules forbid assigning to an imported binding, and this game's level
// state is written from many places (generation, movement, the clock, the
// lab). Collecting it on one object keeps those writes legal and, more
// usefully, makes "what actually varies per level" explicit in one place.
export const G = {};
