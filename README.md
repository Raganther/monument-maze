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
