# Monument Maze

A puzzle on six planes — roll a cube around the surface of a larger cube,
collecting gems across all six faces.

## Running it

The game is ES modules, so it needs to be served over HTTP —
opening `index.html` straight off disk (`file://`) will not work, because
browsers refuse module imports from `file://` origins.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or

```bash
npx serve
```

Three.js is vendored in `vendor/` so the game runs completely offline, with
no CDN dependency.

## Layout

```
index.html            page shell: HUD markup, styles, entry point
src/
  main.js             entry point — imports every module in load order
  core/               geometry, constants, shared mutable state, PRNG
  config/             the MODES and FEATURES registries, and their wiring
  world/              level containers (blocked cells, rails, portals…) + movement graph
  mechanics/          one module per gameplay dynamic
  render/             Three.js scene, materials, meshes, textures
  gen/                level generation and the fairness/clock model
  audio/              synthesised sound effects and the drone
  ui/                 HUD, menu, and the LAB panel
  game/               lifecycle, movement state machine, input, main loop
vendor/three.js       r128, vendored
```

### Two conventions worth knowing

**`core/globals.js` — the `G` object.** ES modules forbid assigning to an
imported binding, but level state is written from many places (generation,
movement, the clock, the LAB). Those values live on one object, `G`, so the
writes stay legal and "what varies per level" is visible in one place.

**`config/wiring.js`.** A mechanic needs `featureOn()`, and the FEATURES
registry needs the mechanic's generator — putting both in one module is an
import cycle. So `config/features.js` holds the data, and `wiring.js` attaches
the `gen()` / `onGem()` hooks once both halves exist.

## The LAB

`LAB` in the HUD opens the feature panel. Every entry is one `FEATURES` record
in `src/config/features.js`; the panel builds itself from that registry, so
adding an entry there makes it appear automatically. Toggling anything rebuilds
the level immediately.

## Adding a gameplay mechanic

Mechanics are meant to be combined freely, which means any combination has to
generate levels that can actually be finished. That guarantee comes from one
place: **the game and the solver share a single set of rules**, in
`src/core/sim.js`. Nothing about a specific mechanic lives in the solver.

A mechanic is two files:

**1. The rule** — `src/mechanics/rules/<name>.js`. Implement only the hooks you
need; all are optional:

| hook | meaning |
|---|---|
| `exitAllowed(from, exit, S)` | veto leaving a cell in a direction. `exit.mover` is `'player'` or the id of whatever is being shoved |
| `blocks(cellKey, S)` | the cell cannot be stood on right now |
| `interact(from, exit, S, rules)` | the destination is blocked but you can clear it (a push) → new state |
| `extraMoves(S, rules)` | successors that aren't a compass step (a portal) |
| `onEnter(cellKey, S)` | slice update on arriving (picking something up) |
| `goal(S)` | your win condition — **AND**-ed with every other mechanic's |
| `key(S)` | canonical slice identity for the visited set |
| `initState()` | your slice of the search state; omit if stateless |
| `enabled()` | whether you're active this level |

Register it in `src/mechanics/rules/index.js`. That's the whole integration —
the solver, the solvability check and the SOLUTION trail all pick it up.

**2. Generation and meshes** — `src/mechanics/<name>.js`. Place things, then
prove them: stage a candidate and call `verifyLevel()` from `src/gen/verify.js`,
keeping it only on `SOLVED`. `src/mechanics/keysgates.js` is the worked example
— it grows one proven pair at a time, so a gate can never seal off the key that
opens it.

Two rules of thumb:

- **Never treat `UNKNOWN` as success.** The solver returns `SOLVED`,
  `UNSOLVABLE` or `UNKNOWN` (budget exhausted). Only the first means anything.
  Shipping on a timeout is exactly how the old movable-block code produced
  impossible levels.
- **Only set `movementInert: true` if collecting your thing genuinely cannot
  change where the player may walk.** It lets the solver skip your state
  entirely; it is unsound for anything that opens, moves, or blocks.

## Verifying

```bash
node tools/verify.mjs            # sweep mechanic combinations x levels x seeds
node tools/verify.mjs --quick
node tools/probe.mjs 1 9 puzzle +keysgates    # one level: seed, level, mode, toggles
node tools/diagnose.mjs 1 9                   # why is this board unsolvable?
```

These run the real game headless under Node — no browser, no WebGL — via
`tools/headless.mjs`. `verify.mjs` exits non-zero if any generated level is
unsolvable or unproven, so it works as a pre-commit check.
