# Fairway: architecture in brief

**Read this first.** It is the short map: what Fairway is, where everything
lives, the units, the generation pipeline, and the traps that have actually
bitten. Every point names the section of a longer document that has the
detail.

**The long documents are for searching, not reading.** PROJECT_HANDOFF.md is
about 80 thousand tokens, TODO.md about 90 thousand, RESEARCH.md about 140
thousand. Reading any of them whole spends a large share of a session before
any work starts. Instead:

```sh
grep -n "^## \|^### " docs/PROJECT_HANDOFF.md   # its sections, with line numbers
grep -n -i "cup\|capture" docs/*.md             # every doc that mentions a subject
```

then read only the sections that match. TODO.md's open work is everything above
`# Done`; RESEARCH.md is one dated section per finding.

**Keep this file short** -- under about 40 KB. It summarises; it never becomes
the only place something is written. A new file, invariant or trap gets its
full explanation in PROJECT_HANDOFF.md and one line here.

## What Fairway is

A golf simulator that runs as **one HTML file** in a WebGL 2 browser, offline,
with no account, backend, telemetry or fetched fonts. An optional local bridge
(a separate Node program, shipped compiled as `run_fairway_server`) connects a
launch monitor. Every course is **generated from a seed**: one continuous
landscape holding 9 or 18 holes, in one of eight biomes, Cartoon art style only.
Ball and cup are real size (42.67 mm, 107.95 mm). 1-4 golfers; stroke play,
match play, scramble, endless; a driving range and a course studio.
(PROJECT_HANDOFF *Product and design decisions*.)

The **product is the four platform zips** a release carries, each holding the
game, the server program and the player docs. The source is public under MIT at
https://github.com/doberloh/fairway-golf-simulator. The website is a separate,
private repository (AGENTS.md, *The website is not in this repository*).

## Building and checking

| Command | What it does |
| --- | --- |
| `npm run dev` | The game at http://127.0.0.1:5173 |
| `npm test` | Every regression suite (Node test runner); must pass before committing |
| `npm run build` | `dist/index.html`, the single-file game, plus the bridge bundle |
| `npm run smoke` | Builds, then plays the built file in a real browser; after any interface change |
| `node tools/biome-fingerprint.mjs --check` | Did generated ground move? If yes, `GENERATOR_VERSION` must go up |
| `node tools/bench.mjs --tier quick` | Measures the generator over many courses; `--since` compares with the baseline |
| `npm run profile` | Frame cost. Minutes of full GPU load: ask the owner first |
| `npm run release` | Builds everything, cuts and verifies the zips into `release/` |

Every command is in COMMAND_CHEAT_SHEET.md.

## Where things live

**Making a world**
- `src/settings-schema.js` -- every generation setting: default, bounds, help text; `GENERATOR_VERSION`, `SCHEMA_VERSION`, migrations
- `src/course.js` -- biomes applied, seeded hole geometry, landforms, surface queries (`surface()`), ecology; `generateWorld`
- `src/course-plan.js` -- yardage, par bounds, tee distances, the green contour; owns each hole's skeleton (`holeLine`) and the one seeded RNG
- `src/routing.js` -- placing holes together; `src/footprints.js` -- the 14 footprint shapes
- `src/biomes.js` -- every biome is one record; `src/species.js` -- what a plant species is
- `src/terrain-grid.js` -- the adaptive ground mesh and its contact heights; `src/landscape-edge.js` -- distant terrain
- `src/ground.js` -- the ground material and the GPU data textures it reads
- `src/streams.js`, `src/lakes.js`, `src/water-bodies.js` -- rivers and creeks, large lakes, water for the renderer
- `src/homes.js`, `src/vegetation.js` -- houses; trees, shrubs, grass and rocks
- `src/course-names.js` -- seeded course names

**Moving a ball**
- `src/physics.js` -- flight and contact, cup capture, monitor shot normalisation; `AERO`, `CONTACT`
- `src/contact.js` -- the bounce as something that takes time; `src/cup.js` -- the analytic capture reference
- `src/turf.js`, `src/firmness.js` -- roll and Stimp; firmness, kept separate from speed
- `src/clubs.js` -- stock and custom clubs, manual flight profiles
- `src/shot-data.js`, `src/shot-views.js`, `src/dispersion.js` -- what a shot shows, its plots, grouping by club

**Playing a round**
- `src/game.js` -- round rules, teams, scores, undo, drops; `src/relief.js` -- penalty relief
- `src/scoring.js`, `src/putting.js`, `src/presentation.js` -- against par, putting modes, replay timing
- `src/range.js` -- the driving range (a hand-built hole); `src/endless.js` -- endless runs
- `src/round-library.js`, `src/course-library.js` -- saved rounds, saved courses and course codes
- `src/profile.js`, `src/handicap.js`, `src/player-colours.js` -- players, the sim handicap, a colour per seat

**Drawing it**
- `src/renderer.js` -- the three.js scene, ball, cup, flag, cameras, maps
- `src/graphics.js` -- quality tiers; the one table every graphics setting reads
- `src/textures.js`, `src/mesh-assets.js`, `src/asset-meshes.js` (generated; never edit) -- textures, wind, imported models
- `src/instance-cull.js`, `src/occlusion.js`, `src/owner-atlas.js` -- drawing only what is seen, soft shade, ground ownership
- `src/clouds.js`, `src/cloud-shadows.js`, `src/mist.js`, `src/godrays.js`, `src/bloom.js`, `src/daylight.js`, `src/floodlights.js` -- sky, light and atmosphere
- `src/green-reading.js`, `src/green-map.js`, `src/course-map.js` -- reading a green, the maps
- `src/camera.js`, `src/camera-tours.js`, `src/camera-prefs.js`, `src/projector.js` -- cameras, flyovers, the simulator bay
- `src/gen-pool.js`, `src/gen-worker.js` -- workers that compute ground heights while a course generates
- `src/shot-visuals.js`, `src/roll-hop.js`, `src/auto-resolution.js` -- tracers and effects, automatic resolution

**The interface**
- `index.html` -- the app shell and its element IDs; `src/main.js` -- app state, controls, shot orchestration, the frame loop
- `src/style.css`, `src/layout.js`, `src/ui-scale.js` -- styling, draggable panels, the Text size zoom
- `src/popups.js` -- tools beside the shot; `src/diagnostic.js` -- Report a problem; `src/lab.js` -- the `window.lab` console API

**Outside the game**
- `bridge/server.mjs` -- the launch-monitor bridge; `tools/build-server.mjs` compiles it per platform
- `tools/package_release.py`, `tools/release.mjs` -- the zips; `public/` -- icons and manifest copied beside the page
- `tools/build-meshes.mjs`, `tools/grow.mjs`, `tools/bake-*.mjs` -- model ingest and growing trees
- `tools/bench.mjs`, `tools/metrics.mjs`, `tools/biome-fingerprint.mjs`, `tools/profile.mjs`, `tools/smoke.mjs` -- measurement and checks
- `tools/capture/` -- pictures and clips of the game; `tools/landing-report/` -- the owner's local reports
- `tools/github-protect.mjs` -- the repository's GitHub protections
- `tests/*.test.mjs` -- the regression suites; `bench/*.json` -- saved baselines

PROJECT_HANDOFF *File map* has a fuller line for every file.

## Units and coordinates

One scene unit is **one metre**. Physics runs in metres, seconds, kilograms and
radians; launch interfaces use degrees, mph and rpm. `YARD = 0.9144`. Never
enlarge the ball to make it visible -- use rings and tracers.

Each hole has its own **local** frame: +z down the hole's line, +x to the
player's LEFT. The round stores lies in local coordinates; meshes and the full
course map use world coordinates; physics and the hole map use local. Convert
with the hole's `toWorld`/`toLocal`, never implicitly. Every bearing is
`atan2(x, z)`, counter-clockwise -- a CSS rotation is clockwise, so negate it.
(PROJECT_HANDOFF *Data flow and units*.)

## The generation pipeline

In order (PROJECT_HANDOFF *Generation pipeline and important invariants*;
PROCEDURAL_GENERATION.md has the why):

1. Plan par, yardage and each hole's skeleton from the seed; green contours, tees, hazard candidates.
2. Route all holes together into the footprint.
3. Shape the biome's landforms around the corridors; blend tees and greens in.
4. Level ground under ponds, place large lakes, fit every basin.
5. Solve drainage once and read every river and creek off it.
6. Build the adaptive ground mesh; physics reads the same triangles.
7. Place homes, then vegetation and ground cover.

**Anything that changes generated ground for an unchanged seed bumps
`GENERATOR_VERSION`** -- the fingerprint check is the arbiter (AGENTS.md,
*Two version numbers*).

Rules every generated course keeps, checked by `npm run bench` as invariants
that must be zero: no tee below the tee in front of it, no tee pad on a green,
in water, in sand or on another hole; no channel inside a fairway, on a green
or in water it did not make; no pond across a fairway; no two water bodies
overlapping. And three that hold by construction: a channel cannot cross
itself (every step descends), a corridor ridge keeps rising inward, and paint
and lie are decided separately but from the same shared numbers.

## The traps

Each has cost real time. Search PROJECT_HANDOFF for the phrase in brackets.

**Generation**
- The order of seeded draws inside a hole is load-bearing; one added or moved shifts every pond, bunker and contour on that hole. One RNG, in course-plan.js. [A HOLE'S SKELETON]
- `generateWorld` must stay synchronous; only `generateWorldSteps` yields, and only between rows, or fingerprints move. [GENERATION YIELDS]
- `prepareWorld` and `loadCourse` must compute the same cache key (`settleSettings`), or a different course appears than the one chosen. [MUST KEY ON THE SAME THING]
- `endlessSettings` must stay idempotent: the menu backdrop is hole one of a real endless run. [Application modes]
- The fingerprint hashes an explicit list; anything new that generation decides and a player can see must join it. [THE FINGERPRINT HASHES]
- `nearest().d` is signed and is not the mown edge; use ramps, not steps. [IS SIGNED]
- Outline harmonics are scaled at generation, never in the shader; keep the amplitude caps. [OUTLINE HARMONICS], [AMPLITUDE CAP]
- Tees are re-sited after the land exists; face them after siting, and check blindness on terrain that includes the pads. [Tees are sited, not placed]
- Never assume a canopy height; ask `canopyTop` (redwoods reach 186 m). [NEVER ASSUME A CANOPY HEIGHT]
- Graphics tiers never touch a played surface; two players on different tiers hit the same trees. [GRAPHICS TIERS MAY NOT TOUCH]
- The range is a hand-built hole and must keep filling the same contract. [The range is a hole]

**Physics**
- Check apex, descent and hang time, not only carry, whenever the aerodynamics move. [CHECK APEX]
- The firmness tests pin a 7-iron's arrival; a flight refit means re-deriving them. [THE FIRMNESS TESTS]
- Everything solid is a vertical cylinder in one collision index; do not add a second routine. [EVERYTHING SOLID]
- The simulator never invents ball data. [The simulator never invents ball data]

**Shaders and drawing**
- The ground shader is a chain of `.replace()` anchors; every link is load-bearing, and `tests/ground-shader-structure.test.mjs` checks it. Never script a shader edit whose replacement you have not printed. [THE GROUND SHADER IS A CHAIN]
- No backticks inside ground.js shader comments: the shader is a JS template literal. [NO BACKTICKS]
- A uniform can be fully plumbed and still dead; keep cue uniforms on the wiring test. [A UNIFORM CAN BE FULLY PLUMBED]
- The toon ramp flattens lighting at midday; a shape cue must change colour, not the lighting normal. [THE TOON RAMP]
- Every lit fragment shader gets at most 16 texture units, and the ground is the hungriest. [HOLE_ATLAS]
- Shaders compile before play, under the loading cover, against the render target actually drawn into. [Shaders are compiled before play]
- `T` is three.js; a local variable named `T` breaks its whole function. [`T` is three.js]
- No test loads renderer.js: open the game in a browser after changing it or ground.js. [A TEST SUITE CANNOT SEE]

**Interface and state**
- The splash lives in `index.html`; `dismissSplash()` runs after `openMenu()` and in the fatal handler. [THE SPLASH LIVES]
- `appMode` changes only through `setMode`; generation controls only in the studio, course choice only in play. [Application modes]
- A saved graphics record beats a new default; raise `GREEN_READ_GEN` to move everyone. [A SAVED GRAPHICS RECORD]
- Build a slider with `slider()`, never by hand. [BUILD A SLIDER]
- One thrown error while a panel wires itself kills every handler below it. [One thrown error in a panel]
- `main.js` DOM paths are not covered by the tests; that is what `npm run smoke` is for. [`main.js` DOM paths]
- Escape closes what is in front first. [Escape closes what is in front]
- A console full of errors is evidence, not noise. [A CONSOLE FULL OF ERRORS]

**Saving and players**
- Four stores, each for one thing: the round slot, saved rounds, saved courses, profiles. [Saving: one slot, two libraries]
- Players are matched by seat, not list position; colours are by seat. [Removing a golfer], [A colour per golfer]
- A ball in trouble waits in the round until relief is taken. [Penalty relief]

**Packaging and the outside world**
- The built page makes no network requests, by design and by test; the manifest is linked by script, only over http(s). [A hosted copy installs]
- The built page opens with a `fairway-versions` tag the website reads; do not remove it. [THE BUILT PAGE STATES ITS VERSIONS]
- The packager ships only files git tracks and refuses stale builds. [Start and build]

## Where else to look

- **docs/README.md** -- which document answers which question.
- **TODO.md** -- open work above `# Done`, the record of what was built below it.
- **RESEARCH.md** -- every number, its source and the measurement behind it.
- **BALL_BEHAVIOUR_KNOBS.md** -- which tuning value changes which ball behaviour.
- **PROCEDURAL_GENERATION.md** -- what the generator produces and why.
- **PLAYING.md** -- everything a player sees and presses.
