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
landscape holding 9 or 18 holes, in one of nine biomes, Cartoon art style only.
Ball and cup are real size (42.67 mm, 107.95 mm). 1-4 golfers; stroke play,
match play, scramble, skins, endless; a driving range and a course studio.
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
| `npm run smoke` | Builds, then plays the built file in a real browser; after any interface change, **only when the owner asks** (it uses the graphics card) |
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
- `src/clubs.js` -- every kind of club, a golfer's bag checked and made playable
- `src/swing-meter.js` -- the Swing Meter: three taps into the launch numbers, the bar in yards, the target marker, curve / height / spin, and the lie table every golfer plays under
- `src/shot-data.js`, `src/shot-views.js`, `src/dispersion.js` -- what a shot shows, its plots, grouping by club
- `src/plays-like.js` -- what the shot to the hole plays like, from two flights of the ball model

**Playing a round**
- `src/game.js` -- round rules, teams, scores, undo, drops; `src/relief.js` -- penalty relief
- `src/scoring.js`, `src/putting.js`, `src/presentation.js` -- against par, putting modes, replay timing
- `src/round-goals.js` -- rounds with a goal (Sudden death, Bogey-free nine): which rounds can carry one, each golfer's goal from the card
- `src/skins.js` -- the skins format: who won each hole, the carry, the winner, its banner and scorecard lines
- `src/range.js` -- the driving range (a hand-built hole): its greens as a list (centre, six targets, short game), their slopes and cups, chip and putt spots; `src/endless.js` -- endless runs
- `src/range-report.js`, `src/pdf.js` -- the range session as a CSV and a PDF report; a hand-written PDF, no dependency
- `src/round-library.js`, `src/course-library.js` -- saved rounds, saved courses and course codes; `src/rival.js` -- a friend's challenge: the shot grid, the round's shot log, the challenge code, the card comparison
- `src/profile.js`, `src/handicap.js`, `src/player-colours.js` -- players, the sim handicap, a colour per seat
- `src/progression.js` -- XP and levels: what earns XP, the level curve, and the ledger a mulligan takes back from
- `src/rewards.js` -- what each level unlocks (one table), what a golfer wears, and the tracer styles; `src/ball-finishes.js` -- the ball finishes, one colour rule each for the 3D ball and its picture
- `src/achievements.js` -- the achievements, their rules and counts; `src/weekly.js` -- the course of the week and the challenge of the week from the date; `src/challenges.js` -- the challenges as one table (27), their medals and records (the skins record too), the Challenge Course; `src/challenge-play.js` -- a challenge being played: turns, what a ball scores, the results; `src/challenge-spots.js` -- where its balls go and which hole it uses
- `src/flourishes.js` -- the hole-out flourishes, drawn flat on a canvas over the cup
- `src/sound.js` -- every sound, synthesised (no recordings); `src/audio.js` -- when the game plays each one, the Sound window's settings
- `src/chiptune.js` -- the 1.0 interface's chiptune (prog metal, clean, family C): the moments and interface sounds as data, and their player; wired in through audio.js (17 October 2026), the marimba stings deleted

**Drawing it**
- `src/renderer.js` -- the three.js scene, ball, cup, flag, cameras, maps
- `src/graphics.js` -- quality tiers; the one table every graphics setting reads
- `src/textures.js`, `src/mesh-assets.js`, `src/asset-meshes.js` (generated; never edit) -- textures, wind, imported models
- `src/instance-cull.js`, `src/occlusion.js`, `src/owner-atlas.js` -- drawing only what is seen, soft shade, ground ownership
- `src/clouds.js`, `src/cloud-shadows.js`, `src/mist.js`, `src/godrays.js`, `src/bloom.js`, `src/daylight.js`, `src/floodlights.js` -- sky, light and atmosphere
- `src/green-reading.js`, `src/green-map.js`, `src/course-map.js` -- reading a green, the maps
- `src/camera.js`, `src/camera-tours.js`, `src/camera-prefs.js`, `src/projector.js` -- cameras (and the turn a drag gives the green and aim point views, `stepOrbit`), flyovers, the simulator bay
- `src/tv-camera.js` -- a full shot filmed by a tee camera and a landing camera, and the whole-shot view after it
- `src/gen-pool.js`, `src/gen-worker.js` -- workers that compute ground heights while a course generates
- `src/shot-visuals.js`, `src/roll-hop.js`, `src/auto-resolution.js` -- tracers and effects, automatic resolution
- `src/haunts.js` -- Haunted Hollow's giant pumpkins and toadstools (placed by course.js, solid), lantern faces, ghosts, bats and will-o'-the-wisps

**The interface**
- `index.html` -- the app shell and its element IDs; `src/main.js` -- app state, controls, shot orchestration, the frame loop
- `src/style.css`, `src/layout.js`, `src/ui-scale.js` -- styling, the measured space the default layout fits (panels no longer drag; the map and the Tab shot numbers do, `hud-places.js`), the Text size zoom. The old interface's hidden pieces and their styles were removed on 18 October 2026: four jobs still ran through them (PROJECT_HANDOFF *Hidden was not unused*). Layout rules added that day: rows follow a tall box's lean, and the info i goes with its name (PROJECT_HANDOFF *A full-width row inside a tall leaning box*, *Info icons*)
- `src/round-hud.js`, `src/round-hud.css` -- the 1.0 round screen (in play, off a phone): what each corner piece says and how large, and where it sits; Esc opens the top bar as a pause list; round complete's standings
- `src/round-phone.css` -- the 1.0 round screen on a phone, sideways and upright (the slanted aim pad, the tapped meter, a MENU chip), and the phone's main menu rows
- `src/ui-steps.js` -- step-by-step setup sheets (round 13): the steps along the top, one step's content centred, keys and Back / Next along the foot, the screen's main button on the last step
- `src/ui-lobby.js` -- Play, the one way into every round (UI/UX pass, 21 October 2026): its first step, Game, is six game types (`GAME_TYPES`, `playSteps`: the course of the week, Endless, a saved course, a friend's challenge, Surprise me, New course in studio); each but Surprise me adds its own step second -- The week (main.js `weeklyPage`), Landscape (`landscapePage`), Course (the shelf and an import box), The challenge; then golfer seats with their own tees, format cards with teams, rules and a summary; mid-round, Golfers & rules; `nameSize` for a seat's name; tests/ui-lobby.test.mjs
- `src/ui-monitor-setup.js` -- 1.0 launch monitor setup: moves the monitor panel's controls into the mockup's three ticked steps and status column; `monitorSteps`, `monitorLight`, `lastShotLine` tested in tests/ui-monitor-setup.test.mjs
- `src/ui-profile-hub.js` -- 1.0 My profile hub: sorts the old profile page by its headings into six tabs, golfer chips in the header, the left stack; `tabOfHeading`, `overviewTiles` tested in tests/ui-profile-hub.test.mjs
- `src/ui-settings.js` -- 1.0 settings: Camera & bay, Graphics and Sound from the menu get the category list, all groups as rows, and the focused row's help line; in a round, the tabs of the one Settings window (`SETTINGS_TABS`); tests/ui-settings.test.mjs
- `src/ui-menu-screens.js` -- (round 14) also `buildHelp`: keys & help as topics, page and that page's keys -- 1.0 challenges (banner, categories, cards, detail), course of the week (picture, earlier weeks, fact rows) and saved courses (a shelf of cards, each with its own buttons as icons): the old sheets' nodes placed on the mockups' grids
- `src/ui-studio.js` -- 1.0 course studio: the slab, "N settings changed" chip, keys and tool column while flying; the settings sheet (one screen from the menu and in the studio: landscapes as pictures)'s category counts, changed dots and what-changed column; `settingsChanges` tested in tests/ui-studio.test.mjs
- `src/ui-range-controls.js` -- 1.0 range controls: the range window's controls sorted into two columns by its own headings, the session-by-club table (from range-report.js `clubTable`), the lab row; tests/ui-range-controls.test.mjs
- `src/ui-dropdown.js`, `src/ui-dropdown.css` -- the 1.0 drop-down over a native select (which stays, see-through, for its id, value and handlers); `dropdownEverywhere` gives it to every select a player sees; tests/ui-dropdown.test.mjs
- `src/course-model.js` -- the tiny 3D model of a whole course for its card: `modelPlan` (the real holes from `layoutFor`, in model units), `modelData` (pure: ground, holes, water, trees, flags as arrays), `buildCourseModel` (a three.js scene)
- `src/model-framing.js` -- frames a tiny model in its box (pure, three.js handed in): tilt from the box's shape, as close as every tee and green allows, the box always full of ground; tests/model-framing.test.mjs
- `src/model-cards.js` -- draws the tiny models into the cards with the game's own renderer (one offscreen target, read back into a 2D canvas per card), one model per timer tick, the selected card first and the only one that sways
- `src/course-picture.js` -- a course's picture drawn top-down from its own routing (generateCourse + routeHoles, no terrain) in the biome's map colours; `pictureQueue` fills a list one picture per idle moment; tests/course-picture.test.mjs
- `src/ui-windows.js`, `src/ui-windows.css` -- the 1.0 windows: `makeWindow` (title, line, rows) and `leanAsOne`, which lines a column's rows up as one leaning block; tests/ui-windows.test.mjs
- `src/ui-sheets.css` -- the sheets (#drawer, outside #app) as 1.0 screens: full screen, slanted control stacks, the lobby on the grid; the scorecard and round complete
- `src/ui-focus.js`, `src/ui-screens.css` -- the 1.0 menus: arrows and a controller between buttons (main menu, Esc list), the main menu's title-screen look and golfer card, and the 1.0 colours and type carried into every panel and window
- `src/hud-places.js` -- where the map and the Tab shot numbers sit once the player has dragged them (fractions of the playing area, kept per device, held on screen); main.js drags and draws them
- `src/shot-display.js`, `src/celebration.js` -- the 1.0 shot moments: the pop-up shot card or the tiles, and for how long; which banner a hole-out earns (two seconds at most), and the paper scorecard's marks
- The 1.0 interface (branch `ui-1-0`; phase 0): `src/ui-layout.js` -- the design canvas, bands and 12-column leaning grid, and the canvas with the Text size; `src/ui-palette.js` -- which biome's colours a screen wears, and the contrast check; `src/ui-kit.js`, `src/ui-kit.css` -- the building kit and the `@font-face` rules; `src/fonts/` -- Saira Condensed (OFL), inlined by the build
- `src/keys.js` -- every key a round answers to, the tool column and the swing strip, one table for the ? list, Help and the tools; tests/keys.test.mjs
- `src/popups.js` -- tools beside the shot; `src/diagnostic.js` -- Report a problem; `src/lab.js` -- the `window.lab` console API

**Outside the game**
- `bridge/server.mjs` -- the launch-monitor bridge; `tools/build-server.mjs` compiles it per platform
- `tools/package_release.py`, `tools/release.mjs` -- the zips; `public/` -- icons and manifest copied beside the page
- `tools/build-meshes.mjs`, `tools/grow.mjs`, `tools/bake-*.mjs` -- model ingest and growing trees
- `tools/bench.mjs`, `tools/metrics.mjs`, `tools/biome-fingerprint.mjs`, `tools/profile.mjs`, `tools/smoke.mjs` -- measurement and checks
- `tools/green-fit.mjs` -- fits how a ball lands on a green (first hop, check, come-back) against its targets
- `tools/capture/` -- pictures and clips of the game, 4K stills and frame-by-frame 4K60 clips (`record.mjs`, `mux.mjs`), and `motion.mjs`, which measures a clip's camera shake from its frames (docs/CAPTURE.md); `tools/landing-report/` -- the owner's local reports
- `tools/sound-lab/` -- the owner's listening report, built from `src/sound.js`, and its offline level check
- `tools/github-protect.mjs` -- the repository's GitHub protections
- `tests/*.test.mjs` -- the regression suites (`round-matrix` plays every format with every group; `challenge-virtual` plays every challenge through the ball model with `tests/virtual-golfer.mjs`, a Swing Meter golfer in Node); `bench/*.json` -- saved baselines. docs/TESTING.md maps what is tested and how

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
- Trees are refused anywhere in the tee fan; bushes and houses only where they rise into the eye line (`blocksView`). [THE VIEW TEST IS FOR WHAT CAN BE LOWER]
- The fingerprint hashes an explicit list; anything new that generation decides and a player can see must join it. [THE FINGERPRINT HASHES]
- `nearest().d` is signed and is not the mown edge; use ramps, not steps. [IS SIGNED]
- Outline harmonics are scaled at generation, never in the shader; keep the amplitude caps. [OUTLINE HARMONICS], [AMPLITUDE CAP]
- Tees are re-sited after the land exists; face them after siting, and check blindness on terrain that includes the pads. [Tees are sited, not placed]
- Never assume a canopy height; ask `canopyTop` (redwoods reach 186 m). [NEVER ASSUME A CANOPY HEIGHT]
- An InstancedMesh that moves must set `userData.noCull`, or the instance cull puts it back where it was built. [ANYTHING INSTANCED THAT MOVES]
- A new biome is one record plus three tables outside it: course-name words, a fog profile (missing, it silently takes Midwest's), and the tool fixture lists. [per-biome tables still live outside the record]
- Graphics tiers never touch a played surface; two players on different tiers hit the same trees. [GRAPHICS TIERS MAY NOT TOUCH]
- The range is a hand-built hole and must keep filling the same contract. [The range is a hole]
- The range's greens are a list that `greenDistance` and the ground shader both loop over -- keep the two the same rule; one cup is live at a time (`course.pin`). [THE RANGE'S GREENS ARE A LIST]
- A meter skin is colours only, set as custom properties; tests hold every skin's zone, band and target apart for colour-blind players. [Frames, meter skins and flourishes]
- A practice challenge never calls `round.takeShot` and saves nothing; every path that replaces `round` clears `challenge`; hole challenges play on one fixed Challenge Course, which a test proves hosts them all -- move its seed on, never loosen the test; a challenge is set up only through `planChallenge`/`playContext`. [A practice challenge is not a round]
- Rounds with a goal are real rounds (`round.goal`); the goal never changes play, and a sudden-death run is never finished. [Rounds with a goal are real rounds]
- The course of the week is the date plus `DEFAULT_COURSE`, `BIOME_KEYS` order and the generator; changing any changes it on every copy. [The course of the week is the date]
- The challenge of the week is the date plus `WEEKLY_POOLS`; a pool row is never edited once shipped -- a new pool starts at a future week. [The challenge of the week is the date]
- A friend's challenge plays only on the same version (package.json plus commit) and re-flies its shots: `gridShot` stays before `simulateShot`, and anything new `simulateShot` reads must travel in the code. [A friend's challenge is the version]
- A tracer style or ball finish is uniforms and buffers, never a new program: every tracer line is one dashed, vertex-coloured material, the ball always has a texture, and tracer colours go in linear. [A LOOK IS NEVER A NEW SHADER]

**Physics**
- Check apex, descent and hang time, not only carry, whenever the aerodynamics move. [CHECK APEX]
- The firmness tests pin a 7-iron's arrival; a flight refit means re-deriving them. [THE FIRMNESS TESTS]
- The green's bounce and spin constants are fitted together by tools/green-fit.mjs; never move one by hand. [THE GREEN IS FITTED AS ONE PIECE]
- Everything solid is a vertical cylinder in one collision index; do not add a second routine. [EVERYTHING SOLID]
- A house's rotation is a world angle: in a hole's frame subtract the hole's. The flagstick is solid only while it stands in the hole. [A HOUSE'S ROTATION IS A WORLD ANGLE], [THE FLAGSTICK IS SOLID]
- The simulator never invents ball data; the one thing applied on top is the round's stated lie rule, shown beside the measured number. [The simulator never invents ball data]
- With no spin added, a Swing Meter ball never spins back; the club's own spin is set below the come-back point by sweeping. [With no spin added, nothing spins back]

**Shaders and drawing**
- The ground shader is a chain of `.replace()` anchors; every link is load-bearing, and `tests/ground-shader-structure.test.mjs` checks it. Never script a shader edit whose replacement you have not printed. [THE GROUND SHADER IS A CHAIN]
- No backticks inside ground.js shader comments: the shader is a JS template literal. [NO BACKTICKS]
- A uniform can be fully plumbed and still dead; keep cue uniforms on the wiring test. [A UNIFORM CAN BE FULLY PLUMBED]
- The toon ramp flattens lighting at midday; a shape cue must change colour, not the lighting normal. [THE TOON RAMP]
- Every lit fragment shader gets at most 16 texture units, and the ground is the hungriest. [HOLE_ATLAS]
- Shaders compile before play, under the loading cover, against the render target actually drawn into -- the probes' cube target too (`asProbe`). [Shaders are compiled before play]
- Rendering the scene a second time redraws every shadow map unless `shadowMap.autoUpdate` is off around it; the god rays and the pond probes switch it off. [A SECOND RENDER REDRAWS EVERY SHADOW MAP]
- The god rays draw through their own override material and only with the sun in shot; the loading screen's frame warms them, and only solid things go in their mask. [THE GOD RAYS ARE WARMED]
- `T` is three.js; a local variable named `T` breaks its whole function. [`T` is three.js]
- Never pass `T` itself as a value: the bundler then keeps all of three.js, file loaders and their fetch() included. [Never hand `T` itself on as a value]
- Never make a PMREMGenerator per refresh; take a kept one from `pmremFor`, one per cube size, or every 6 degrees of sun recompiles its shaders. [THE PMREM GENERATORS ARE KEPT]
- No test loads renderer.js: open the game in a browser after changing it or ground.js. [A TEST SUITE CANNOT SEE]
- Slow frames every 200 ms are the machine, not the game; time them and re-run in a fresh browser before blaming content. [A HITCH THAT COMES EVERY 200 MS]
- A light counts only while it and its parents are visible, and every lit shader is built for the count: never parent a light to something that hides (the ball's glow light sits beside the ball). [IT IS NOT A CHILD OF THE BALL]
- Flagsticks can be drawn larger with distance so they never vanish (Graphics, "Larger flags far away", off by default); drawing only, the ball hits the real stick. [FLAGSTICKS STAY VISIBLE FROM ANYWHERE]
- A tier's shadow normal offset is at least a texel of its map, or crowns shade themselves in stripes; only a crown of many sprays (the grown trees) gets a thinned twin -- a cartoon crown's comes apart into shards. [A SHADOW'S NORMAL OFFSET GOES WITH ITS TEXEL], [ONLY A CROWN OF MANY SPRAYS]
- The profiler runs uncapped; a stall it shows may vanish at 60 fps. Check worst frames at normal pacing before acting. [AN UNCAPPED PROFILE SHOWS STALLS]

**Interface and state**
- The splash lives in `index.html`; `dismissSplash()` runs after `openMenu()` and in the fatal handler; its week colours come from `window.__FAIRWAY_SPLASH__`, written in by vite.config.js from biomes.js and weekly.js. [THE SPLASH LIVES]
- An unset clock hour is null and reads as midnight; only a world build replaces it, so a round that keeps its world sets the hour itself (`roundHour`). [The menu borrows the clock]
- `appMode` changes only through `setMode`; generation controls only in the studio, course choice only in play. [Application modes]
- A saved graphics record beats a new default; raise `GREEN_READ_GEN` to move everyone. [A SAVED GRAPHICS RECORD]
- Build a slider with `slider()`, never by hand. [BUILD A SLIDER]
- One thrown error while a panel wires itself kills every handler below it. [One thrown error in a panel]
- `main.js` DOM paths are not covered by the tests; that is what `npm run smoke` is for. [`main.js` DOM paths]
- XP is a keyed ledger: award by key, never add to `xp` directly; the level is derived. [XP is a ledger, not a running count]
- `armed` is worked out per turn from the Armed switch (`armSwitch`) and how the golfer up plays; never set it directly. [`armed` is per turn]
- A Swing Meter tap is judged on its own timestamp, never on a frame; the frame loop only draws the marker. [A Swing Meter tap is judged on its own time]
- The smoke harness taps by stamping the moment, never on a frame, and asks the game whether a putt dropped. [A harness tap that has to land]
- Escape closes what is in front first. [Escape closes what is in front]
- Anything new that writes a hole's score must wrap itself for the hole-out banner, or that hole-out goes unannounced. [THE HOLE-OUT BANNER WATCHES THE CARD]
- A console full of errors is evidence, not noise. [A CONSOLE FULL OF ERRORS]
- The studio bar rides above an open panel; anything else pinned to the studio's bottom edge has to join that lift. [THE STUDIO BAR RIDES ABOVE]
- A leaning picture is an exact clip-path shape (never a skewed layer in an overflow-hidden box, never clipped and skewed both), outlined with `--trace`; a picture over its caption leans from its foot and the caption from its head, one shape; grids gain columns as the screen widens; scroll boxes are padded by the lean. [THE WIDE-SCREEN RULE], [A picture over its caption is one shape]
- The studio's windows are the menu's sheets on every screen and the bar steps aside while one is open; the old strip under the bar is retired. [THE STUDIO'S WINDOWS ARE THE MENU'S SHEETS]
- The shot panel draws one record; in flight it is read at the flight's clock, and `refreshShotGrid` swaps the grid only, never what `renderResult` wrote above it. [READ AT THE FLIGHT'S CLOCK], [REPLACES THE GRID ONLY]
- The shot line is one element that `drawMonitorState` moves between the shot controls and the launch monitor window; JS learns "phone" from the stylesheet's `--phone`, never by measuring. [back inside the play window], [Where an unmoved tile sits]
- The bridge's accepted club codes come from `CLUB_KINDS`; a typed list once dropped the connection on any non-stock club. [passes on every club a bag can hold]
- 1.0 sheets: #drawer and the notices are outside #app -- no app query, palette, Text size zoom or `--hud-z` reaches them; ui-sheets.css uses @media and `--sheet-z`. [THE SHEETS ARE OUTSIDE #app]
- 1.0 round screen: the shot controls are `display:contents`, so a new child lands loose unless round-hud.css places it; labels the frame loop positions scale by transform, never zoom; an author `display` beats `[hidden]`. [THE SHOT CONTROLS ARE `display:contents`]
- 1.0 interface: skewing a parent and straightening a coloured child leaves the block upright -- only text and pictures are straightened. [SKEWING A PARENT AND STRAIGHTENING]
- 1.0 interface: a short shared class name silently restyles another screen; every kit class is `uk-`, every rule scoped to `.uk`. The canvas root inside `#app` scales by `drawn / zoom`, never `drawn`. [A SHORT SHARED CLASS NAME], [The canvas and the Text size]

**Saving and players**
- Four stores, each for one thing: the round slot, saved rounds, saved courses, profiles. [Saving: one slot, two libraries]
- A hole nobody scored (a golfer who joined mid-round) is a gap, saved as null; `Round.restore` must accept it. [A HOLE NOBODY SCORED IS A GAP]
- The bag is the golfer's, re-read every turn; the putter's id is always `putter`. [THE BAG IS THE GOLFER'S]
- Players are matched by seat, not list position; colours are by seat. [Removing a golfer], [A colour per golfer]
- A ball in trouble waits in the round until relief is taken. [Penalty relief]
- Skins are worked from the card, never stored; an old Skins-challenge save becomes a skins round in `Round.restore`. [Skins is a round format]
- No club sound with a launch monitor; nothing audible before the first input; one bird at a time; never schedule a sound in the past -- Web Audio plays it whole, late. [WHEN THE GAME MAKES A SOUND]

**Packaging and the outside world**
- The built page makes no network requests, by design and by test; the manifest is linked by script, only over http(s). [A hosted copy installs]
- The built page opens with a `fairway-versions` tag the website reads; do not remove it. [THE BUILT PAGE STATES ITS VERSIONS]
- The packager ships only files git tracks and refuses stale builds. [Start and build]

## Where else to look

- **docs/README.md** -- which document answers which question.
- **TODO.md** -- open work above `# Done`, the record of what was built below it.
- **IDEAS.md** -- what could be built; read only when looking for something new.
- **TESTING.md** -- what is tested, by which layer, and what only a person checks.
- **RESEARCH.md** -- every number, its source and the measurement behind it.
- **BALL_BEHAVIOUR_KNOBS.md** -- which tuning value changes which ball behaviour.
- **PROCEDURAL_GENERATION.md** -- what the generator produces and why.
- **PLAYING.md** -- everything a player sees and presses.
