# Fairway: architecture in brief

**Read this first.** It is the short map: what Fairway is, where everything
lives, the units, the generation pipeline, and the traps that have actually
bitten. Every point names the section of a longer document that has the
detail.

**The long documents are for searching, not reading.** PROJECT_HANDOFF.md is
about 150 thousand tokens, DONE.md about 165 thousand, RESEARCH.md about 280
thousand. Reading any of them whole spends a large share of a session before
any work starts. Instead:

```sh
grep -n "^## \|^### " docs/PROJECT_HANDOFF.md   # its sections, with line numbers
grep -n -i "cup\|capture" docs/*.md             # every doc that mentions a subject
```

then read only the sections that match. TODO.md is open work only and short
enough to read whole; what was finished is in DONE.md. RESEARCH.md is one dated
section per finding.

**Keep this file short** -- under about 40 KB. It summarises; it never becomes
the only place something is written. A new file, invariant or trap gets its
full explanation in PROJECT_HANDOFF.md and one line here.

## What Fairway is

A golf simulator that runs as **one HTML file** in a WebGL 2 browser, offline,
with no account, backend, telemetry or fetched fonts. An optional local bridge
(a separate Node program, shipped compiled as `run_fairway_server`) connects a
launch monitor. Every course is **generated from a seed**: one continuous
landscape holding 9 or 18 holes, in one of fifteen landscapes (the work on 15 real golf looks, branch `us-golf-courses`: Classic Parkland has replaced six, Southern Pines three, Lowcountry and Gulf three, Florida Palms two, Hawaiian Resort one, Desert Resort two, Pacific Northwest (`pacnw`) Puget Sound, California Coast (`calcoast`) three, Seaside Links (`seaside`) three, Desert Mountain (`dmountain`) four and Mountain (`mountains`) seven and Prairie & Sand Hills (`prairie`) four, their keys kept in `OLD_KEYS`; the Badlands and Northern Woods keep their keys with new trees; no cart paths, clubhouse, road or lot on a generated course since 8 November 2026, course.js `facilities` [No facilities for now]; the Redwood Coast keeps its key with new trees), first of nine: (the regions of the USA, plus Scottish Links: Puget Sound, Sonoran, Rockies, Scottish Links, Heartland, Keys, Redwood Coast, New England, Lake Dunes -- renamed from their old keys on 2 November 2026, when Haunted Hollow was removed; the US landscapes goal grows the list to forty, TODO *US landscapes*), Cartoon art style only.
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
| `npm test` | Every regression suite (`tools/test.mjs`: each file its own process, longest first); must pass before committing. `npm run test:changed` / `test:fast` while working (TESTING.md) |
| `npm run build` | `dist/index.html`, the single-file game, `dist/builder.html`, the course builder, plus the bridge bundle |
| `npm run smoke` | Builds, then plays the built file in a real browser; after any interface change, **only when the owner asks** (it uses the graphics card) |
| `node tools/biome-fingerprint.mjs --check` | Did generated ground move? If yes, `GENERATOR_VERSION` must go up |
| `node tools/bench.mjs --tier quick` | Measures the generator over many courses; `--since` compares with the baseline |
| `npm run profile` | Frame cost. Minutes of full GPU load: ask the owner first (a "GPU allowed" `/goal` may run single `--only` groups; AGENTS.md) |
| `npm run release` | Builds everything, cuts and verifies the zips into `release/` |

Every command is in COMMAND_CHEAT_SHEET.md.

## Where things live

**Making a world**
- `src/settings-schema.js` -- every generation setting: default, bounds, help text; `STARTING_CHOICES` / `STARTING_COURSE` (the owner's starting course) and `surpriseSettings`; `GENERATOR_VERSION`, `SCHEMA_VERSION`, migrations
- `src/course.js` -- biomes applied, seeded hole geometry, landforms, surface queries (`surface()`), ecology; `generateWorld`
- `src/course-plan.js` -- yardage, par bounds, tee distances, the green contour; owns each hole's skeleton (`holeLine`) and the one seeded RNG
- `src/tees.js` -- the six tee sets (black to red), the nearest a course has (`teeFor`, `teeOn`), a built course's sets (`courseSets`), OpenStreetMap's tee tags (`setsFromTag`); pure
- `src/routing.js` -- placing holes together (a links also side by side, `routeParallel`, its return tees offered further back by `shifts`); `src/footprints.js` -- the 14 footprint shapes
- `src/regions.js` -- every landscape, built or not (`LANDSCAPES`: key, player name, region, place, tropical), the eighteen `REGIONS`, and `OLD_KEYS` (the keys before 2 November 2026, read as their new ones by the settings migration, course files, the profile and old endless seeds); a key is never renamed once shipped. `src/biomes.js` -- every landscape is one record: its region's tables (`TRAITS`, `PALETTES`, `INTERFACE`, `WORLD`, keyed by region) with its own `LAND` entry laid over them; a key in `LAND` is a landscape a player can pick (`BIOME_KEYS`, held to it by tests/landscapes-complete.test.mjs); `src/surround.js` -- the trees past the property line (the surroundings rework, 12 November 2026; docs/SURROUNDINGS.md): the landscape's own stand carried outward to the tier's reach, by the far forest's cover, open meadows and treeline, each on the ground AS DRAWN and off water, never in `world.trees` (`surroundTrees`, `SURROUND_TREES`, `coverHash`; pure; the bench's `surround` checks it); `src/far-trees.js` -- draws each of those sites as an upright picture of the course's own model, from an atlas baked when the course is built (`bakeTreeAtlas`, `addFarTrees`; needs the renderer, no Node test); `src/surround-sides.js` -- the record a built course may carry for its own surroundings, `surround: {sides: {n, e, s, w}, height, cover}`: its nine kinds, player names, `normaliseSurround`, `seaLevelUnder` (pure); `src/far-woods.js` -- what is left of the far woods (removed 12 November 2026): `FAR_SHAPES`, the flat-based shapes the water mirror's twins are built from; `src/tree-seat.js` -- how far each plant is drawn into the ground so no foot hangs over a slope, and the slope a ground cover lies along (trunk footprints measured from the models; the bench's `seated` metric checks it); `src/species.js` -- what a plant species is
- `src/seasons.js` -- the seasons, pure: a date's, a round's (today's or picked, fixed at the round's start, tropical always summer), each region's winter, each landscape's spring bloom (`BLOOM`, `bloomIn`), the turf and the far forest's colours in a season (`seasonPalette`), who goes bare. `src/twigs.js` -- the branches of a tree bare in winter, pure, grown from the model's own crown (space colonisation; mesh-assets.js `bareParts` merges them into the bark). `src/season-tints.js` (generated) -- each species' colours in each season. Looks only: the Season setting is never ground -- PROJECT_HANDOFF *THE SEASONS*.
- `src/terrain-grid.js` -- the adaptive ground mesh and its contact heights; `src/landscape-edge.js` -- distant terrain to 13 km (its relief one function, `ringRelief`; Mountain's peaked range, `ringPeaks`; Desert's mesas, `ringMesas`; a built course's own sides, `sidedRelief`; how fine it is, `RING_DETAIL`, which a tier may coarsen through graphics.js `farGround`; the ring as plain arrays, `ringMesh`, drawn in 24 pieces, `landscapeChunks`, and its height as drawn, `drawnGround`, which anything standing on the ring must use, with the detail it is drawn with -- see PROJECT_HANDOFF *STAND ON THE GROUND AS DRAWN*)
- `src/ground.js` -- the ground material and the GPU data textures it reads; `src/turf-detail.js` (generated by `tools/turf-detail.mjs`; never edit) -- the turf detail atlas it multiplies in
- `src/streams.js`, `src/lakes.js`, `src/water-bodies.js` -- rivers and creeks, large lakes, water for the renderer; `src/water-mirror.js` -- trees in still water: low-poly twins of the bank's trees turned over about each pond's level and drawn into a half-size picture each frame (High and Ultra, `mirrorTwins`), read by the pond where it is a mirror
- `src/homes.js`, `src/vegetation.js` -- houses; trees, shrubs, grass and rocks, Lakeshore Dunes' beach driftwood, and the far heath (domes past the near heather cushions)
- `src/blowouts.js` -- Lakeshore Dunes' wind-torn sand in the dune rough: one baked field the lie and the ground shader both read; tests/blowouts.test.mjs
- `src/plant-families.js` -- which family of models each species is drawn from, with no models behind it (the worker asks it)
- `src/seat-core.js` -- a plant's seat in the ground as arithmetic, with no models behind it; tree-seat.js reads a tree's foot off its model
- `src/country.js` -- the soft fields `land` reads: the country's long shape, the distance from a corridor with no crease in it (generator 85)
- `src/landforms.js` -- each biome's country between the holes (the cartoon overhaul): crags, mesas, dunes, prairie, coral, moor, and (generator 76, terrain true to place) steps, karst, glacial, knobs, channels, volcanic, sandridges, lowland and the Badlands' badlands (carved by a one-pass drainage network, `carve`, `carvedField`; the one recipe that `sinks` rather than fades), chosen per landscape by biomes.js TERRAIN; relief added to the landform and ground types baked on the atlas like the blowouts; tests/landforms.test.mjs, tests/terrain-true.test.mjs
- `src/stands.js` -- uncleared forest and thicket round the property and between the holes (the cartoon overhaul): where a stand grows and the hashed grid it is planted from; tests/stands.test.mjs
- `src/grounds.js` -- the ground types a ball plays from besides turf (rock, scree, hardpan, waste sand, pine straw, leaves, heather, native grass, coral): one row each that every surface table reads, and what may stand on each; tests/grounds.test.mjs
- `src/course-names.js` -- seeded course names; `src/hole-names.js` -- a name for every hole: its water, bend, length or the land's words, Home last; `src/crest.js` -- a course's crest (an SVG string)
- **Architect is gone** (removed 2 November 2026, the US landscapes goal: real people build courses in the Course Builder instead; docs/ARCHITECT_COURSES.md is in git history). Its world pieces stayed and are the generator's, on every course but the range. `src/world-stream.js` -- `worldStream(...parts)`, the named seeded stream each world piece draws from, so adding one never moves another. `src/golfer-table.js` -- generated by `tools/golfer-table.mjs`, never edited (the markings' landing zones). `src/biomes.js`'s `WORLD` -- each landscape's world kit in one block (edge, fountain, clubhouse, path, bridge, story, life, colours).
- `src/roads.js` -- the public road along the clubhouse's side of the property (out of bounds beyond it), the parking lot beside the clubhouse and the drive between, routed with every fairway blocked (the US landscapes goal, phase 4); the fairway homes' streets, lanes and mailboxes (`placeStreets`, `driveFrame`, `mailboxAt`); road objects have a cart path's shape, so paths.js's index and tests work on them; tests/roads.test.mjs, the bench's `roadOnPlay`, `roadOverWater`, `driveToNowhere` and `roadOnHouse`
- The world pieces, each pure with its test of the same name: `src/paths.js` (cart paths, bridges -- every path over water or a ravine is one, `findBridges` -- `pathIndex` for the lie), `src/clubhouse.js` (sited, sized, terraced, solid), `src/markings.js` (stakes, posts, rakes, divots), `src/waterworks.js` (rip-rap, tie walls, fountains; the fountain's moving water is `src/fountain.js`, drawn by `addFountains`), `src/story.js` (walls and `wallBoxes`, farm, ruins, landmarks), `src/life.js` (animals, drawn only, never on Low; the people went on 2 November 2026, and tournament week's `occasion.js` and `leaderboard.js` with them), `src/yardage-book.js` (the PDF book), `src/surface-field.js` (the baked surface field: bunkers past the twelve slots, painted and played from the same bytes). Drawn by renderer.js's `addPaths`, `addMarkings`, `addBuildings`, `addWaterworks`, `addStory`, `addLife` from the `tools/blender/architect_*.py` packs.

**Moving a ball**
- **docs/BALL_PHYSICS.md is the ball model in full** (rebuilt 11 November 2026); docs/BALL_BEHAVIOUR_KNOBS.md says which number moves what; `node tools/ball-bench.mjs` scores it against 149 real measurements in a second
- `src/physics.js` -- `simulateShot`: one shot from the club face to rest (air, bounces, slide and roll, trees and houses, the hole); `groundStep`, `rollPreview`; monitor shot normalisation
- `src/aero.js` -- the air: drag, lift, spin decay, density, wind that is slower near the ground; `AERO`, `flyBall`
- `src/turf.js` -- the three course conditions (`turfConfig`: green speed, green firmness, fairway firmness; `CONDITION_PRESETS`), one row per surface (`turfOf`), the Stimpmeter and rolling (`ROLL`), putt lengths in closed form
- `src/bounce.js` -- one impact of a spinning ball: the pitch mark's tilt, the rebound, the turf's grip on the spin (`bounce`, `TILT`, `SEVERITY`)
- `src/cup.js` -- the hole as rigid contacts: green, rim, wall, floor, flagstick (`cupSim`, `captureSpeed`, `CUP`)
- `src/clubs.js` -- every kind of club, a golfer's bag checked and made playable
- `src/swing-meter.js` -- the Swing Meter: three taps into the launch numbers, the bar in yards, the target marker, curve / height / spin, and the lie table every golfer plays under
- `src/shot-data.js`, `src/shot-views.js`, `src/dispersion.js` -- what a shot shows, its plots, grouping by club
- `src/plays-like.js` -- what the shot to the hole plays like, from two flights of the ball model

**Playing a round**
- `src/game.js` -- round rules, teams, scores, undo, drops; `src/relief.js` -- penalty relief
- `src/scoring.js`, `src/putting.js`, `src/presentation.js` -- against par, putting modes (hole out, dartboard, decimal, gimme circle: `PUTTING_MODES`), replay timing
- `src/round-goals.js` -- rounds with a goal (Sudden death, Bogey-free nine): which rounds can carry one, each golfer's goal from the card
- `src/skins.js` -- the skins format: who won each hole, the carry, the winner, its banner and scorecard lines
- `src/range.js` -- the driving range (a hand-built hole): its greens as a list (centre, six targets, short game), their slopes and cups, chip and putt spots; `src/endless.js` -- endless runs
- `src/range-report.js`, `src/pdf.js` -- the range session as a CSV and a PDF report; a hand-written PDF, no dependency
- `src/round-library.js`, `src/course-library.js` -- saved rounds, saved courses and course codes; `src/rival.js` -- a friend's challenge: the shot grid, the round's shot log, the challenge code, the card comparison
- `src/profile.js`, `src/handicap.js`, `src/player-colours.js` -- players, the sim handicap, a colour per seat
- `src/progression.js` -- XP and levels: what earns XP, the level curve, and the ledger a mulligan takes back from
- `src/rewards.js` -- what each level unlocks (one table), what a golfer wears, and the tracer styles; `src/ball-finishes.js` -- the ball finishes, one colour rule each for the 3D ball and its picture
- `src/achievements.js` -- the achievements, their rules and counts; `src/weekly.js` -- the course of the week and the challenge of the week from the date (a retired landscape's weeks go to the one named in `retired`); `src/challenges.js` -- the challenges as one table (27), their medals and records (the skins record too), the Challenge Course, and the rules every challenge plays (`CHALLENGE_RULES`, `challengeGroup`); `src/challenge-play.js` -- a challenge being played: turns, what a ball scores, the results; `src/challenge-spots.js` -- where its balls go and which hole it uses
- `src/flourishes.js` -- the hole-out flourishes, drawn flat on a canvas over the cup
- `src/sound.js` -- every sound, synthesised (no recordings); `src/audio.js` -- when the game plays each one, the Sound window's settings
- `src/chiptune.js` -- the 1.0 interface's chiptune (prog metal, clean, family C): the moments and interface sounds as data, and their player; wired in through audio.js (17 October 2026), the marimba stings deleted

**Drawing it**
- `src/renderer.js` -- the three.js scene, ball, cup, flag, cameras, maps
- `src/graphics.js` -- quality tiers; the one table every graphics setting reads
- `src/textures.js`, `src/mesh-assets.js`, `src/asset-meshes.js` (generated; never edit) -- textures, wind, imported models
- `src/instance-cull.js`, `src/occlusion.js`, `src/owner-atlas.js` -- drawing only what is seen, soft shade, ground ownership
- `src/low-trees.js` -- Low's rule for drawing fewer trees, never the hole's (pure; tests/low-trees.test.mjs)
- `src/built-field.js`, `src/bake-pool.js`, `src/bake-worker.js` -- a built course's field of distances to its outlines, baked in bands of rows on other cores (tests/built-field.test.mjs)
- `src/ground-lod.js` -- the ground drawn as squares, coarser with distance, within a pixel or two of the ground the ball meets (pure; tests/ground-lod.test.mjs)
- `src/clouds.js`, `src/cloud-shadows.js`, `src/mist.js`, `src/godrays.js`, `src/bloom.js`, `src/daylight.js`, `src/floodlights.js` -- sky, light and atmosphere
- `src/map-relief.js` -- the maps' relief shading, lit from the top left of the screen (pure; tests/map-relief.test.mjs) [Relief on the maps]
- `src/green-reading.js`, `src/green-map.js`, `src/course-map.js` -- reading a green, the maps
- `src/camera.js`, `src/camera-tours.js`, `src/camera-prefs.js`, `src/projector.js` -- cameras (and the turn a drag gives the green and aim point views, `stepOrbit`), flyovers, the simulator bay
- `src/tv-camera.js` -- a full shot filmed by a tee camera and a landing camera, and the whole-shot view after it
- `src/gen-pool.js`, `src/gen-worker.js` -- workers that compute ground heights while a course generates
- `src/shot-visuals.js`, `src/roll-hop.js`, `src/auto-resolution.js` -- tracers and effects, automatic resolution

**The interface**
- `index.html` -- the app shell and its element IDs; `src/main.js` -- app state, controls, shot orchestration, the frame loop
- `src/style.css`, `src/layout.js`, `src/ui-scale.js` -- styling, the measured space the default layout fits (panels no longer drag; the map and the Tab shot numbers do, `hud-places.js`), the Text size zoom. The old interface's hidden pieces and their styles were removed on 18 October 2026: four jobs still ran through them (PROJECT_HANDOFF *Hidden was not unused*). Layout rules added that day: rows follow a tall box's lean, and the info i goes with its name (PROJECT_HANDOFF *A full-width row inside a tall leaning box*, *Info icons*)
- `src/round-hud.js`, `src/round-hud.css` -- the 1.0 round screen (in play, off a phone): what each corner piece says and how large, and where it sits; Esc opens the top bar as a pause list; round complete's standings
- `src/round-phone.css` -- the 1.0 round screen on a phone, sideways and upright (the aim pad, the tapped meter, one bar of Menu, Map, Views and Fly, the map behind Map, free flight's fly pad), and the phone's main menu rows
- `src/ui-steps.js` -- step-by-step setup sheets (round 13): the steps along the top, one step's content centred, keys and Back / Next along the foot, the screen's main button on the last step; Esc and the sheet's Back go back a step (`escapeStep`, main.js `panelBack`)
- Trap: a mesh that the play camera may clear must set `userData.cullHidden` -- PROJECT_HANDOFF *THE PLAY CAMERA CLEARS WHAT IS IN ITS WAY*.
- `src/ui-lobby.js` -- Play, the one way into every round (UI/UX pass, 21 October 2026): its first step, Game, is six game types (`GAME_TYPES`, `playSteps`: the course of the week, Endless, a saved course, a friend's challenge, Surprise me, New course in studio); each but Surprise me adds its own step second -- The week (main.js `weeklyPage`), Landscape (`landscapePage`), Course (the shelf and an import box), The challenge; then golfer seats with their own tees, format cards with teams, rules and a summary; mid-round, Golfers & rules; `nameSize` for a seat's name; tests/ui-lobby.test.mjs
- `src/ui-monitor-setup.js` -- 1.0 launch monitor setup: moves the monitor panel's controls into the mockup's three ticked steps and status column; `monitorSteps`, `monitorLight`, `lastShotLine` tested in tests/ui-monitor-setup.test.mjs
- `src/ui-profile-hub.js` -- 1.0 My profile hub: sorts the old profile page by its headings into six tabs, golfer chips in the header, the left stack; `tabOfHeading`, `overviewTiles` tested in tests/ui-profile-hub.test.mjs
- `src/ui-settings.js` -- 1.0 settings: Camera & bay, Graphics and Sound from the menu get the category list, all groups as rows, and the focused row's help line; in a round, the tabs of the one Settings window (`SETTINGS_TABS`); tests/ui-settings.test.mjs
- `src/ui-menu-screens.js` -- (round 14) also `buildHelp`: keys & help as topics, page and that page's keys -- Challenges in three steps as Play's (V2: Challenge -- banner, categories, cards, detail; Golfers; Rules -- fixed, `CHALLENGE_RULE_ROWS`) and saved courses (a shelf of cards, each with its own buttons as icons): the old sheets' nodes placed on the mockups' grids
- `src/quiet-right-click.js` -- the right button does nothing in the game, stopped once before any listener hears it; tests/quiet-right-click.test.mjs
- `src/landscape-map.js` -- the map of the landscapes, pure: the projection (Albers, Alaska and Hawaii as insets), a landscape for a point or a place (`landscapeAt`: door 2's suggestion), shapes as SVG paths; `src/us-map-data.js` -- GENERATED by `tools/us-map.mjs` from the study's partition (local) and Natural Earth, never edited: each landscape's shape, projected, and the globe's land; `src/globe.js` -- the little globe on a landscape thumbnail, an SVG string, land cut at the horizon; `src/ui-map.js` -- the clickable map (`landscapeMap`) and the thumbnails' globes (`addGlobe`) in the studio, Endless and the builder's doors 1 and 2; `src/seasons.js` -- a date's season, a round's season (summer only until the seasons are drawn), a record's look in a season
- `src/ui-studio.js` -- 1.0 course studio: the slab, "N settings changed" chip, keys and tool column while flying; the settings sheet (one screen from the menu and in the studio: landscapes as pictures)'s category counts, changed dots and what-changed column; `settingsChanges` tested in tests/ui-studio.test.mjs
- `src/ui-range-controls.js` -- 1.0 range controls: the range window's controls sorted into two columns by its own headings, the session-by-club table (from range-report.js `clubTable`), the lab row; tests/ui-range-controls.test.mjs
- `src/ui-dropdown.js`, `src/ui-dropdown.css` -- the 1.0 drop-down over a native select (which stays, see-through, for its id, value and handlers); `dropdownEverywhere` gives it to every select a player sees; tests/ui-dropdown.test.mjs
- (`src/course-model.js`, `src/model-framing.js`, `src/model-cards.js` -- the tiny 3D course models on the cards -- were removed in the 1.0 polish; pictures took their place.) `src/landscape-shots.js` -- the landscape pictures the build inlines (`src/shots/*.webp`); `src/course-file.js` -- a saved course as a `.fairway` file with its picture, and the save step's suggested views; `src/course-pictures.js` -- where saved courses' pictures are kept (IndexedDB, falling back to localStorage); both tested
- `src/course-picture.js` -- a course's picture drawn top-down from its own routing (generateCourse + routeHoles, no terrain) in the biome's map colours; `pictureQueue` fills a list one picture per idle moment; tests/course-picture.test.mjs
- `src/ui-windows.js`, `src/ui-windows.css` -- the 1.0 windows: `makeWindow` (title, line, rows); square since 28 October 2026 (the lean code went with the slant). tests/ui-windows.test.mjs
- `src/ui-sheets.css` -- the sheets (#drawer, outside #app) as 1.0 screens: full screen, square control stacks (slanted until 28 October 2026), the lobby on the grid; the scorecard and round complete
- `src/ui-focus.js`, `src/ui-screens.css` -- the 1.0 menus: arrows and a controller between buttons (main menu, Esc list), the main menu's title-screen look and golfer card, and the 1.0 colours and type carried into every panel and window
- `src/phone-view.js` -- how far the picture is moved up on a phone so the ball stands above the swing meter (`phoneLift`), and which camera views are moved (`liftsView`); renderer.js `applyLensShift` applies it with `setViewOffset`; tests/phone-view.test.mjs
- `src/hud-places.js` -- where the map and the Tab shot numbers sit once the player has dragged them (fractions of the playing area, kept per device, held on screen); main.js drags and draws them
- `src/shot-display.js`, `src/celebration.js` -- the 1.0 shot moments: the pop-up shot card or the tiles, and for how long; which banner a hole-out earns (two seconds at most), and the paper scorecard's marks
- The 1.0 interface (branch `ui-1-0`; phase 0): `src/ui-layout.js` -- the design canvas, bands and 12-column grid (a leaning one until 28 October 2026), and the canvas with the Text size; `src/ui-palette.js` -- which biome's colours a screen wears, and the contrast check; `src/ui-kit.js`, `src/ui-kit.css` -- the building kit and the `@font-face` rules; `src/fonts/` -- Saira Condensed (OFL), inlined by the build
- `src/keys.js` -- every key a round answers to, the tool column and the swing strip, one table for the ? list, Help and the tools; tests/keys.test.mjs
- `src/last-play.js` -- Play again: the last setup Play started (kind, saved course, golfers, format), offered on the main menu; tests/last-play.test.mjs
- `src/tips.js` -- the loading tips (splash, through vite.config.js, and the wait while a course grows), each with the keys it names; tests/tips.test.mjs checks them against keys.js
- `src/picture-loop.js` -- the landscape pictures on the cards, cross-faded on one timer, opacity only; tests/picture-loop.test.mjs. The pictures are taken by `tools/capture/biome-shots.mjs`
- Trap: yellow means chosen, white means the cursor; a focus rule drawn in `--hot` brings back the double yellow boxes -- PROJECT_HANDOFF *ONE LOOK FOR CHOSEN, ONE FOR THE CURSOR*.
- `src/ui-motion.css` -- the menus' motion (sheets, boxes, the menu cursor, presses), none under reduced motion. Traps: never a transform on #drawer; a highlighted box's gradient ends on `--a2-text` -- PROJECT_HANDOFF *MOTION IN THE MENUS*, *A HIGHLIGHTED BOX'S GRADIENT ENDS ON*.
- `tools/ui-motion-check.mjs` -- the menus' motion against the checklist: lengths, cheap properties only, interrupted ends whole, nothing under reduced motion
- `tools/ui-pad-check.mjs` -- a pretend controller at six sizes: the d-pad through the main menu, Play and the pause list, A into a round, B and Start (UI_POLISH.md T2)
- `tools/ui-movable-check.mjs` -- the map and the shot numbers dragged at six sizes: they follow the pointer, stop inside the playing area, stay inside after a resize, and a double click puts them back (UI_POLISH.md T3)
- `tools/ui-flows.mjs` -- presses from the main menu into each mode, mouse and keys (by ui-focus.js's own rule); UI_POLISH.md *The way into every mode*
- `src/popups.js` -- tools beside the shot; `src/diagnostic.js` -- Report a problem; `src/lab.js` -- the `window.lab` console API

**Fairway Course Builder** (the second program in every download; docs/COURSE_BUILDER.md is the record)
- `builder.html`, `vite.builder.config.js` -- the builder's page, built single-file after the game into `dist/builder.html` (`Fairway Builder.html` in the zips), with its own `fairway-builder-versions` line
- `src/builder/` -- the builder: `builder.js` (the shell and its three doors; `useMenus`, the menus every screen shares), `menu.js` (the menu bar and the shortcuts sheet), `shortcuts.js` (keys and menus as rules, pure; tests/builder-shortcuts.test.mjs), `icons.js` (the tool palette's icons), `pen.js` (the pen's curve through clicked nodes, the same points drawn and filled, pure; tests/builder-pen.test.mjs), `steady.js` (the steadied brush, pure, used by door 2 and the 3D editor; tests/builder-steady.test.mjs), `autosave.js` (door 2's draft kept in the browser's IndexedDB, its own database, and offered back), `map-checks.js` (OpenStreetMap's holes checked against the course traced under them, and the fixes offered, pure; tests/builder-map-checks.test.mjs), `skin.js` (Skin from the land: the landscape's rock and apron painted from the land's slopes, a pure module, tests/builder-skin.test.mjs), `tree-names.js` (the trees' names for the Place tree picker), `tree-shape.js` (the 3D editor's stand-in shape for a species; tests/built-world.test.mjs), `picture-file.js` (a picture as a saved file holds it: JPEG and where it sits; tests/builder-reopen.test.mjs), `tree-plan.js` (the trees placed for the player: sizes off, which species; tests/builder-tree-plan.test.mjs), `hole-marks.js` (a hole's marks found and moved on the 2D plan; tests/builder-marks.test.mjs), `lidar-coverage.js` (how much of the box searched a survey and the folder cover; tests/lidar-coverage.test.mjs), `water-bed.js` (a pond's bed dug and banks graded, bunkers' bowls and creeks' channels, tests/water-bed.test.mjs), `layer-ops.js` (what both editors do to a layer: edge smoothing, Extrapolate, zones, anchors; tests/builder-parity.test.mjs), `cover.js` (ground cover: what a landscape offers, one dab; tests/builder-cover.test.mjs), `preview-items.js` and `preview.js` (the model of what a tool lays, a small still picture of the game's own models; tests/builder-preview.test.mjs), `draft-from-doc.js` (Back to 2D from any course), `game-view.js` and `game-look.js` (Game view: the game's GolfView over the 3D editor, no tools; tests/builder-game-view.test.mjs), `door-generate.js` (door 1: the settings, grow, take over), `door-real.js` (door 2 in six steps on one plan: the LIDAR and the property, the land, the trace -- a picture, auto or manual, the tools -- the holes, the name, the painted review), `plan-view.js` (door 2's plan: layers at the land's cells, zoomed and dragged, each with an opacity, the LIDAR under the picture or over it), `layers.js` (surfaces in layers, pure: a mask each, the topmost shown in the game's own field order, hidden from view only; `layersFor` the layers a landscape offers; the trace step's and the editor's; tests/layers.test.mjs), `trace-edit.js` (the trace being drawn, pure: brushes, outlines, smoothing, tidying, extrapolating, filling outside the course boundary, trees, houses, moving one shape, tree or house, undo; tests/trace-edit.test.mjs), `osm.js` (OpenStreetMap's golf features laid as layers, trees, houses from its buildings, the course boundary and hole markers; whose trees, the LIDAR's and the map's (`mergeTrees`); fetched only when pressed, ODbL credited; tests/osm.test.mjs), `lidar-search.js` (door 2's LIDAR search: the sources over a place -- USGS 3DEP, IGN and swisstopo downloaded in the page, rockyweb's tiles through the bridge or the browser's downloads, 36 state portals and national agencies linked; each download carries the file to keep, read back instead of downloaded again; tests/lidar-search.test.mjs), `lidar-folder.js` (the player's LIDAR folder: picked once and remembered, every download written there and read from there, its files listed and told over the place; tests/lidar-folder.test.mjs), `tips.js` (every button's tooltip, by tool or label, given by builder.js `el`; tests/builder-tips.test.mjs), `tree-clear.js` (crowns drawn in off greens and tees, door 2's trace and the editor; tests/tree-clear.test.mjs), `osm-course.js` (which of a club's courses, its OpenStreetMap holes, moved with the refined map and fitted to the traced greens and tees; tests/osm-course.test.mjs), `round-trip.js` (what Back to 2D takes from the 3D editor into door 2's trace; tests/round-trip.test.mjs), `saving.js` (Save on every screen, one click to the same file; tests/builder-saving.test.mjs), `draft.js` (a door 2 draft, .fairway-draft; tests/builder-draft.test.mjs), `imagery.js` (Google, Bing and free national aerial imagery as Web Mercator tiles, placed on the land, and laid flat as the map door 2 shows before the LIDAR, `mapFrame`; the builder's only network use, at the player's request; tests/imagery.test.mjs), `real-course.js` (door 2's steps, pure: land from the sources, a picture laid by position or matched points, the LIDAR drawn as relief, brightness or slope, the course document; tests/real-course.test.mjs), `editor.js` (the editor's screen), `view.js` (its working 3D view), `editing.js` (the editing model, pure: surfaces as a grid of codes, the land, holes, water, trees, houses, undo; tests/builder-editing.test.mjs), `checks.js` (what breaks a rule; tests/builder-checks.test.mjs), `test-round.js` (the virtual golfer plays the course being edited), `builder.css`
- `src/zip.js` -- a ZIP written and read by hand on the browser's own CompressionStream; `src/course-doc.js` -- a built course as a document and as a `.fairway` version-2 file (land, patches, outlines, holes, water, trees); `BUILT_VERSION` in settings-schema.js; tests of the same names
- `src/built-world.js` -- `worldFromDoc`: the generator's world contract from a built document (land sampler, the baked built field and `builtSurface`, built holes, trees, creeks, houses from the file's footprints); `src/freeze.js` -- `freezeWorld`: a generated world as a built document (door 1's Take it over); `src/contour.js` -- outlines from a mask (marching squares, Douglas-Peucker); `src/built-store.js` -- built files kept in IndexedDB by hash, parsed when a round on one starts
- `src/lidar/` -- the builder's LIDAR: `las.js` (LAS/LAZ/COPC), `laz.js` (laz-perf's WebAssembly inlined, never fetched), `geotiff.js` (GeoTIFF by hand, windowed), `formats.js` (E57, PLY, PTS, PTX, XYZ, ASCII and float grids, HGT; `openSource` for any of them), `geo.js` (UTM, degrees, and Lambert conformal conic or transverse Mercator from a file's WKT -- State Plane; tests/lidar-geo.test.mjs), `ept.js` (Entwine point tiles: the octree's pieces over a box, Web Mercator; tests/lidar-ept.test.mjs), `land.js` (points to a ground grid, canopy and trees), `trace.js` (the auto trace, LIDAR first with the picture as fallback, and from the picture alone before any hole is marked; `refineTrace` refines a starting trace such as OpenStreetMap's from the picture or the LIDAR; tests/lidar-trace.test.mjs); tests/lidar-readers.test.mjs; `tools/real-course.mjs` -- a real course built end to end by door 2's steps and measured (the owner's Worthington data; local); `tools/trace-bench.mjs` -- the trace scored on generated courses turned into a survey and a picture; `tools/built-compare.mjs` -- a real course's saved file against USGS's DEM, OpenStreetMap and the card (its `source.origin`); `tools/imagery-fetch.mjs` -- the auto trace's test courses, one a landscape (OpenStreetMap and NAIP, local); `tools/imagery-bench.mjs` -- the auto trace from the picture alone on those courses, scored against OpenStreetMap with its edges measured (specks, pocks, raggedness); `tools/osm-holes.mjs` -- a real course's holes and reference outlines from OpenStreetMap, shared by the scripted build and the local `builder-door-2-worthington` journey; `tools/lidar-compare.mjs` -- a real course's LIDAR against another pipeline's products and USGS's DEM (local data); `tools/lidar-home.mjs` -- where real courses' LIDAR lives, `bench/lidar/<course>/` (git-ignored: Worthington, the test courses, the owner's Washington surveys); `tools/lidar-fetch.mjs` -- the test courses' 3DEP tiles into it; `tools/lidar-bench.mjs` -- the auto trace from the LIDAR alone on the nine courses, scored against OpenStreetMap; `tools/lidar-search.mjs` -- door 2's LIDAR search and download run on a real place and checked against the same survey's tiles
- `tools/builder-smoke.mjs` -- the builder's page driven in a real browser by file://, failing on any error or network request (journeys in `tools/builder-journeys/`); `tools/build-courses.mjs` -- every course in bench/lidar built as door 2 builds one (OpenStreetMap refined with the LIDAR), to bench/courses/; `tools/play-built.mjs` -- each opened in the built game and a tee shot played; `tools/builder-look.mjs` -- a course file opened in the editor and a green photographed from a few heights, with the close-up sheet's numbers; `tools/freeze-compare.mjs` -- a generated course against its frozen copy (surfaces, ground, holes, trees, virtual-golfer strokes); `tools/freeze-capture.mjs` -- the two photographed from the same poses in the built game

**Outside the game**
- `bridge/server.mjs` -- the launch-monitor bridge (and `/lidar`, which fetches USGS rockyweb tiles for the builder's page, USGS hosts and local pages only); `tools/build-server.mjs` compiles it per platform
- `tools/package_release.py`, `tools/release.mjs` -- the zips; `public/` -- icons and manifest copied beside the page
- `tools/test.mjs` -- the Node suite's runner: longest first by `bench/test-times.json`, `--changed`, `--fast`, `--save-times`; `tests/worlds.mjs` -- the course cache and `measured` (many courses built on worker threads, `tests/measure-worker.mjs`, measured by a module under `tests/measure/`)
- `tools/build-meshes.mjs` -- model ingest: every picked `vendor/blender-cartoon_*/` model into `src/asset-meshes.js`
- `tools/blender/` -- models built in Blender, headless, from committed scripts (`run.mjs <pack> --render`; shared helpers `fairway_blender.py` and `cartoon.py`), written to `vendor/blender-<pack>/` as `Blender_*.glb` (docs/BLENDER_ASSETS.md); the cartoon overhaul's library `cartoon.py` (vertex paint, bent crown normals, a toon contact sheet) and its packs `cartoon_*.py`; `inspect.mjs <pack>` prints what a pack wrote
- `tools/blender/grown.py` -- trees built as they grow: tapering wood, limbs, needle sprays and leaf clusters, no filler (BLENDER_ASSETS *Built as it grows*)
- `tools/blender/iterate.mjs` -- one round of a pack beside its reference pictures (the US landscapes goal: fifteen rounds a model; `--season`, `--far`, `--log`); `tools/blender/logs/<id>.md` -- each model's rounds, one line a round; `tools/blender/cartoon_pacific.py` -- Puget Sound's and Redwood Coast's own plants (BLENDER_ASSETS *The US landscapes packs*)
- `tools/blender/dump-tints.mjs` -- every pack's four seasons (its LOOK table) dumped through Blender into src/season-tints.js; re-run after a pack's colours change.
- `tools/bench.mjs`, `tools/metrics.mjs`, `tools/biome-fingerprint.mjs`, `tools/profile.mjs`, `tools/smoke.mjs` -- measurement and checks
- `tools/gpu-lock.mjs` -- one graphics job at a time across processes (a lock directory in bench/ab/), taken by `gpuGate`, `gpu-run.mjs` and the Blender launchers (`tools/blender/run.mjs`, `iterate.mjs`), inherited by a gated job's children
- `tools/vertex-report.mjs` -- each vendor folder's vertices shaded per triangle, and what joining them could save (IDEAS.md, *Join and reorder every shipped model's vertices*).
- `tools/meshy-run.mjs` and `tools/meshy/<pack>.json` -- makes a pack's plants on Meshy's API, pictures first for the owner to approve, then models: a trial for AI foliage, its results land in bench/meshy (local), and the redwood pack's 14 trees ship from vendor/blender-meshy_redwood; `tools/blender/meshy_far.py` rebuilds a far version from a full model, `meshy_game.py` turns a full model into the game's form, `meshy_parts.py` is what they share, `meshy_colours.py` lists a model's colour groups for choosing its flower colours (BLENDER_ASSETS, *Trying models from Meshy*).
- `tools/software-crash.mjs` (the software renderer at Low and Medium, a fresh browser a case, logging how far each gets), `tools/frame-ab.mjs` (two builds measured alternately, pictures compared; `--built` a course file, `--scene` what the scene holds, `fly` spots), `tools/builder-frames.mjs` (the Course Builder's waits and frames on a course file), `tools/far-cluster.mjs` (far versions made when the models are packed), `tools/frame-variants.mjs` (ideas tried live, processor profile, page restyles), `tools/frame-tris.mjs` (a frame's triangles model by model), `tools/frame-spikes.mjs` (what each long frame spent its time on), `tools/frame-look.mjs` (two hooked builds with the clock stopped: pictures compared exactly, the interface checked), `tools/frame-motion.mjs` (the same round frame for frame on a virtual clock, a shot and a camera flight), `tools/devices.mjs` (device profiles), `tools/gpu-gate.mjs` (the gate for unattended GPU runs; `tools/gpu-run.mjs` runs any command through it and logs it), `tools/png-diff.mjs`, `tools/variants/` -- frame time
- `tools/ui-audit.mjs` -- every screen at sixteen sizes read for layout bugs (rules in `tools/ui-audit-rules.mjs`, tested; explained findings in `tools/ui-audit-known.json`; four sizes side by side, a contact sheet per screen, `--quick` for a round of fixes; docs/UI_POLISH.md)
- `tools/ball-bench.mjs` -- the ball against real measurements (flight, firm-green landings, club run-outs, spin, chips, fairway, Stimp, putts, break, the hole, slopes), each check naming its source; `--set` tries a constant, `--shot` and `--land` trace one shot hop by hop; `tools/flight-fit.mjs` fits the air to the published flights in `tools/flight-targets.mjs` and the owner's private sessions; `tools/ball-paths.mjs` draws a ball from pitch mark to rest as SVG, against another checkout's ball when asked
- `tools/meter-landings.mjs` -- what the Swing Meter's own shots do on each green and out of the rough (the table in BALL_PHYSICS *The strike*)
- `tools/capture/` -- pictures and clips of the game (`landscape-models.mjs`: every model a landscape draws, one picture each), 4K stills and frame-by-frame 4K60 clips (`record.mjs`, `mux.mjs`), and `motion.mjs`, which measures a clip's camera shake from its frames (docs/CAPTURE.md); `overhaul.mjs`, the cartoon overhaul's fixed views of a landscape from any build (docs/CARTOON_OVERHAUL.md; `--built <file>` a course file, the `edge-eye` views from just inside the property line); `builder-skin.mjs`, Skin from the land pressed in the real builder on a real course; `builder-site.mjs`, the builder's trace step for the website, no surface preview open; `tools/landing-report/` -- the owner's local reports
- `tools/golfer-table.mjs` -- bakes src/golfer-table.js; `tools/us-map.mjs` -- writes src/us-map-data.js (the map of the landscapes and the globe) from the study's partition and Natural Earth
- `tools/gen-time.mjs` -- how long an 18-hole course takes to generate, per landscape (the wait a player sees); `tools/ground-shares.mjs` -- what share of a course each surface and ground type is; `tools/surface-map.mjs` -- a course's surfaces from above as a PNG, on the CPU
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
3. Lay the holes on the long shape of the country (hills and landforms everywhere, country.js); blend tees and greens in.
4. Level ground under ponds, place large lakes, fit every basin.
5. Solve drainage once and read every river and creek off it.
6. Build the adaptive ground mesh; physics reads the same triangles.
7. Place homes, then vegetation and ground cover.

**Anything that changes generated ground for an unchanged seed bumps
`GENERATOR_VERSION`** -- the fingerprint check is the arbiter (AGENTS.md,
*Three version numbers*).

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
- One designer since Architect went (2 November 2026): a course's stamp is `generatorFor(settings)`, never `GENERATOR_VERSION` (a built course's is `BUILT_STAMP + BUILT_VERSION`), and each world piece draws from its own `worldStream`. [ONE DESIGNER, ONE WORLD]
- `leftWidth` is a hole's -x side everywhere (PROJECT_HANDOFF *leftWidth is the -x side*).
- Greens shaped one after another drag each other (PROJECT_HANDOFF *greens shaped in turn drag each other*).
- A new landscape is not done until tests/landscapes-complete.test.mjs passes for it: its `LANDSCAPES` and `LAND` entries, its region's (or its own) world kit, course names of its own, hole names, a crest motif, a picture and a map shape (PROJECT_HANDOFF *Adding a biome*, *Adding a biome: the world kit*).
- No road or lot lies on anything played, ever: the drive is routed with play blocked, and the bench's `roadOnPlay` invariant holds it at zero -- PROJECT_HANDOFF *THE ROADS*.
- A fairway home's front, drive and mailbox face its street, away from the fairway (`rotation` turned half round; the collider is the same box); a drive no street reaches is not built. The bench's fixture has homes off, so run it with `--set homes=true` -- RESEARCH *The fairway homes' streets*.
- A landscape's world pieces (story, animals, clubhouse, path) come from biomes.js `worldOf(key)`, never a region-keyed table indexed by the landscape -- PROJECT_HANDOFF *REGIONS, THEN LANDSCAPES*.
- A landscape key is stored in every save, code and file, so it is never renamed once shipped; the old keys of 2 November 2026 live in regions.js `OLD_KEYS` and settings-schema.js MIGRATIONS 16 -- PROJECT_HANDOFF *A LANDSCAPE'S KEY IS FOREVER*.
- The order of seeded draws inside a hole is load-bearing; one added or moved shifts every pond, bunker and contour on that hole. One RNG, in course-plan.js. [A HOLE'S SKELETON]
- `generateWorld` must stay synchronous; only `generateWorldSteps` yields, and only between rows, or fingerprints move. [GENERATION YIELDS]
- `prepareWorld` and `loadCourse` must compute the same cache key (`settleSettings`), or a different course appears than the one chosen. [MUST KEY ON THE SAME THING]
- `endlessSettings` must stay idempotent: the menu backdrop is hole one of a real endless run. [Application modes]
- Trees are refused anywhere in the tee fan; bushes and houses only where they rise into the eye line (`blocksView`). [THE VIEW TEST IS FOR WHAT CAN BE LOWER]
- The fingerprint hashes an explicit list; anything new that generation decides and a player can see must join it. [THE FINGERPRINT HASHES]
- `nearest().d` is signed and is not the mown edge; use ramps, not steps. [IS SIGNED]
- Outline harmonics are scaled at generation, never in the shader; keep the amplitude caps. [OUTLINE HARMONICS], [AMPLITUDE CAP]
- Tees are re-sited after the land exists; face them after siting, and check blindness on terrain that includes the pads. [Tees are sited, not placed]
- A rock tee's outcrop is laid after the corridor fade, keeps a falling lane in front of each pad so no drive is blind, and opens the wild ground's gates; course.js `perchOpen` and ground.js `perchOpen` are the same numbers. [Tees up on the rock]
- Desert Mountain's holes are routed round its ranges (routing.js reads `rangeShareOf`), which stand on the big mountain's side only; the landform moves with the course's `shift`. [Holes routed round the ranges]
- The California Coast's cliff line is averaged over 160 m and its sea kept deep. [Sandstone cliffs]
- Never assume a canopy height; ask `canopyTop` (redwoods reach 186 m). [NEVER ASSUME A CANOPY HEIGHT]
- A painted model (the cartoon packs) carries `color` and `flex`: its crown never receives the shadow map and is never thinned into a twin. [A PAINTED CROWN]
- An InstancedMesh that moves must set `userData.noCull`, or the instance cull puts it back where it was built. [ANYTHING INSTANCED THAT MOVES]
- A new biome is one record plus tables outside it: course-name words, a fog profile (missing, it silently takes Midwest's), the tool fixture lists, the landscape pictures (biome-shots.mjs), the ambience, the capture list, and a debut week in the course of the week's rotation. [Per-biome tables still live outside the record]
- Blowouts are one baked field read by both `surface()` and the ground shader: rough only, painted last, clear of water, inside the atlas. [BLOWOUTS ARE ONE BAKED FIELD]
- The ground types are baked the same way, asked a, b, floor, fallen and painted in reverse; a new one is a row in grounds.js; planting asks `allows`, not `=== 'rough'`; the relief fades from the corridor alone, never through `open()`. [THE GROUND TYPES ARE ONE BAKED FIELD TOO]
- An off-screen pass drawn only when something is in view builds its shaders late -- PROJECT_HANDOFF *AN OFF-SCREEN PASS IS DRAWN ON ITS FIRST FRAME*.
- A hole's centre line read past its end creases the ground along a straight line through every tee and green -- PROJECT_HANDOFF *A CENTRE LINE READ PAST ITS END*.
- Shared links fairways widen before `holeBoxes`, count every hole's pond in the strip, and judge parallel where the fairways lie -- PROJECT_HANDOFF *SHARED FAIRWAYS WIDEN BEFORE ANYTHING MEASURES A CORRIDOR*.
- Every program is drawn once behind the loading screen; a thing first drawn in play stalls a frame -- PROJECT_HANDOFF *EVERY PROGRAM IS DRAWN ONCE BEHIND THE LOADING SCREEN*
- The fountain is moving water the renderer draws, reset per course -- PROJECT_HANDOFF *THE FOUNTAIN MOVES, SO IT IS NOT A MODEL*
- A world piece is one draw (merged or instanced), and markings are off on Low -- PROJECT_HANDOFF *A WORLD PIECE IS ONE DRAW, NOT ONE PER PART*
- The builder's layers stack in the game's own field order, saved as overlapping outlines -- PROJECT_HANDOFF *The builder's layers stack in the game's own field order*
- 3DEP's Entwine copy is Web Mercator, carried to UTM point by point; the bridge's `/lidar` fetches USGS hosts for local pages only -- PROJECT_HANDOFF *3DEP's Entwine copy is in Web Mercator*
- Door 2's course is the trace plus what the 3D editor sent back -- PROJECT_HANDOFF *Door 2 makes its course from the trace AND*
- A built hole's yards and the builder's scorecard and par are one routine, built-world.js `builtLine` -- PROJECT_HANDOFF *The builder's card is the game's card*
- A built file naming no tee set is the old blue, white and red spread by distance; never read a tee set without `teeOn`/`teeFor` -- PROJECT_HANDOFF *A BUILT COURSE IS A WORLD FROM A FILE* (24)
- Door 2 keeps every LIDAR download in the player's LIDAR folder and finds it again by name (a USGS square by survey, middle and size) -- PROJECT_HANDOFF *A download is kept, and found again, by its name*
- Door 2 reads a real place relative to itself: cells no finer than the survey's spacing, water as silence away from the survey's edge, sand and water against the course's own fairway, mown ground smoothed -- PROJECT_HANDOFF *Door 2 reads a real place relative to itself*
- A course file's builder section stays its last part and the game never reads it -- PROJECT_HANDOFF *A course file's builder section*
- A built course stands at its real height: what is placed or painted by height measures from `world.skyBase` -- COURSE_BUILDER *Built courses at their real height*
- A built course (the course builder) is a world from a file: its lie and paint read one field in one order, its holes' frames face their greens, `settings.built` is its file's hash and must not leak into another round, and only `BUILT_VERSION` moves it -- PROJECT_HANDOFF *A BUILT COURSE IS A WORLD FROM A FILE*
- The cart paths are what is drawn: joins land on drawn lines, nothing is built on a path, the strip has a point every 2 m -- PROJECT_HANDOFF *THE PATH NETWORK IS THE LINE DRAWN*
- Every path over water or a ravine is a bridge, the clubhouse's link included (`findBridges` runs again once it is laid); the bench's `pathOverWater` must be zero -- PROJECT_HANDOFF *EVERY PATH OVER WATER IS A BRIDGE*
- Anything the generator imports is in the page twice: the worker must not reach the models -- PROJECT_HANDOFF *THE WORKER CARRIES NO MODELS*
- A term added to `land` outside `countryAt`, or anything read from the nearest hole, brings the bowl and the crease back -- PROJECT_HANDOFF *THE COUNTRY IS ONE SURFACE*
- A test file that builds many courses on one thread sets the whole suite's wait -- PROJECT_HANDOFF *A FILE IS ONE THREAD*
- The cull draws a `cullReach` mesh only so far and a `shadowNear` one into the nearest shadow map only -- PROJECT_HANDOFF *A MESH CAN BE DRAWN ONLY SO FAR*.
- Stand trees (`stand: true`) are not the open scatter: metrics of planting near play leave them out; painted trees swap to a shipped twin by `farPainted` -- PROJECT_HANDOFF *A STAND IS NOT THE SCATTER*.
- The far trees' material keeps `#include <begin_vertex>` and has no program cache key of its own, or they stand bright in front of the haze -- PROJECT_HANDOFF *THE SURROUNDINGS ARE THE COURSE'S OWN TREES, AS PICTURES*.
- The far forest's floor (ground.js) and the trees on it (surround.js) read one whole-number hash, `coverHash`, and one `FAR_OPEN`; change both or neither -- PROJECT_HANDOFF *THE SURROUNDINGS ARE THE COURSE'S OWN TREES, AS PICTURES*.
- A far mountainside is crags in the ring (sized by the ring's cell, the fifth argument of `ringRelief().at`; a range may be rounded instead, `ringRound`), a baked `farShade`, and NO pattern in the rock's paint (`cragFace`: three were tried and turned down); `farPlants` must be plants the course grows; no far plant on over 40 degrees (`FAR_STEEP`) or above a landscape's `farLine` -- PROJECT_HANDOFF *A FAR MOUNTAINSIDE*
- A far tree's picture has no light in it: colours and normals are baked apart and the scene lights each pixel; mirror the picture and its normal's red must mirror too -- PROJECT_HANDOFF *The atlas is TWO pictures*
- A built course's `surround` is scenery (never `BUILT_VERSION`); a water side stands the sea under the lowest of the land, and the record travels beside `treePlan` through the builder -- PROJECT_HANDOFF *A COURSE'S OWN SURROUNDINGS*.
- A sea among the holes (`sea` without `edgeCoast`, Lowcountry and Gulf's creeks) needs the ground near the sea, the marsh above the beach band and the band its own colour -- PROJECT_HANDOFF *A sea among the holes*.
- Graphics tiers never touch a played surface; two players on different tiers hit the same trees. Only Low may leave trees undrawn, never the hole being played's (9 Nov). [GRAPHICS TIERS MAY NOT TOUCH]
- A fading tree's level rides in its instance colour's red (steps of four); a material on a culled tree mesh without ditherFade draws it red. [AN INSTANCE'S RED CARRIES ITS DISSOLVE]
- The drawn ground is squares of varying detail; never raycast it, pick along world.height. [THE DRAWN GROUND IS NOT THE GROUND]
- The range is a hand-built hole and must keep filling the same contract. [The range is a hole]
- The range's greens are a list that `greenDistance` and the ground shader both loop over -- keep the two the same rule; one cup is live at a time (`course.pin`). [THE RANGE'S GREENS ARE A LIST]
- A meter skin is colours only, set as custom properties; tests hold every skin's zone, band and target apart for colour-blind players. [Frames, meter skins and flourishes]
- A practice challenge never calls `round.takeShot` and saves nothing; every path that replaces `round` clears `challenge`; hole challenges play on one fixed Challenge Course, which a test proves hosts them all -- move its seed on, never loosen the test; a challenge is set up only through `planChallenge`/`playContext`. [A practice challenge is not a round]
- Rounds with a goal are real rounds (`round.goal`); the goal never changes play, and a sudden-death run is never finished. [Rounds with a goal are real rounds]
- The course of the week is the date plus `DEFAULT_COURSE`, `STARTING_CHOICES` (the owner's starting course, settings-schema.js), `WEEKLY_ROTATION`, `WEEKLY_COURSE` (its length, drawn from the week's seed; both from week 149) and the generator; changing any changes it on every copy, and a new landscape or a new course joins on a week of its own, never by being appended.
- A new course starts as `STARTING_COURSE`, not `DEFAULT_COURSE`, in four places only (the course of the week, Surprise me, the builder's Generate door, the Challenge Course); the defaults never move, because a missing key in a code, an Endless hole, the range and the fingerprints all mean the default, and Endless stays wide on purpose. [The starting course is not the defaults] [The course of the week is the date]
- The challenge of the week is the date plus `WEEKLY_POOLS`; a pool row is never edited once shipped -- a new pool starts at a future week. [The challenge of the week is the date]
- A friend's challenge plays only on the same version (package.json plus commit) and re-flies its shots: `gridShot` stays before `simulateShot`, and anything new `simulateShot` reads must travel in the code. [A friend's challenge is the version]
- A tracer style or ball finish is uniforms and buffers, never a new program: every tracer line is one dashed, vertex-coloured material, the ball always has a texture, and tracer colours go in linear. [A LOOK IS NEVER A NEW SHADER]

**Physics**
- Change a ball number, then run `node tools/ball-bench.mjs`: it must stay at every check passing. Check peak height, landing angle and time in the air, not only carry, whenever the air moves -- landing angle is the most sensitive input to how far a ball runs. (docs/BALL_PHYSICS.md)
- The firm green's bounce numbers (`tilt`, `eHi`, `mu`, `shear`, `arm`) are fitted together to the USGA's launcher tests; never move one alone. (BALL_PHYSICS *What the firm green was fitted to*)
- Nothing decides whether a ball grips or skids, drops or lips out: both fall out of the contacts. A rule added to force either is the old model coming back. (BALL_PHYSICS *The bounce*, *The hole*)
- A rolling ball that stops with its centre over the hole is not at rest, and a ball on a bank too steep for the surface rolls back down it: the old model froze both. (`simulateShot`)
- A ball meets a real flagstick (0.75 in in the air, 0.5 in in the hole) whatever is drawn (2 in tapering to 1 in). (`FLAGSTICK_HIT_R`, `FLAGSTICK_HOLE_R`; BALL_PHYSICS *The hole*)
- The lie takes speed (`LIE_SPEED`) and, out of grass, a high-spinning shot's spin (`lieSpin`, the flyer), from Swing Meter and monitor shots alike. (BALL_PHYSICS *The strike*)
- `src/golfer-table.js` (the markings' landing zones) was baked from the OLD ball and is deliberately not re-baked: doing so moves generated markings and owes a `GENERATOR_VERSION` bump.
- Everything solid is a vertical cylinder in one collision index, except buildings -- houses and a course's `world.buildings` (the clubhouse) -- which are oriented boxes in one shared routine; add no third. A club building is never out of bounds. [EVERYTHING SOLID]
- A house's rotation is a world angle: in a hole's frame subtract the hole's. The flagstick is solid only while it stands in the hole. [A HOUSE'S ROTATION IS A WORLD ANGLE], [THE FLAGSTICK IS SOLID]
- The simulator never invents ball data; the one thing applied on top is the round's stated lie rule, shown beside the measured number. [The simulator never invents ball data]
- Every number in the ball is measured or PLACED on its own reasoning; no ruling about the ball from before 11 November 2026 is used, and the Swing Meter trims no spin to make a ball stop (`HEIGHT_SPIN` is strike geometry only). `node tools/meter-landings.mjs` prints what its shots do. (BALL_PHYSICS *The strike*)

**Shaders and drawing**
- The ground shader is a chain of `.replace()` anchors; every link is load-bearing, and `tests/ground-shader-structure.test.mjs` checks it. Never script a shader edit whose replacement you have not printed. [THE GROUND SHADER IS A CHAIN]
- No backticks inside ground.js shader comments: the shader is a JS template literal. [NO BACKTICKS]
- A uniform can be fully plumbed and still dead; keep cue uniforms on the wiring test. [A UNIFORM CAN BE FULLY PLUMBED]
- On a built course, anything in ground.js after the `BUILT_COURSE` block that reads a hole row's shapes (greenD, the tee pad) must read the baked field instead. [A BUILT COURSE'S MOWING READS THE BUILT EDGES]
- Live floodlamps are room in every lit shader: past the card's budget the lit ground draws as nothing (floodlights.js `lampBudget`, at most 96). [A LIVE LAMP IS ROOM IN EVERY LIT SHADER]
- The toon ramp flattens lighting at midday; a shape cue must change colour, not the lighting normal. [THE TOON RAMP]
- textures.js patches three's ramp and tone-mapping chunks at import (coloured ramp, `GRADE`). [THE RAMP IS COLOURED]
- Every lit fragment shader gets at most 16 texture units, and the ground is the hungriest; its four float tables are one texture (`packTables`), the hole table read by `texelFetch` -- PROJECT_HANDOFF *ONE TEXTURE FOR EVERY TABLE*. [HOLE_ATLAS] A hole's twelve hazard slots hold three kinds: bunkers, ponds (meta.y the pond's index) and a collection area (meta.y -1; Architect made them, nothing generates one now, and the slot stays for built courses); a bunker past them is the surface field's -- PROJECT_HANDOFF *THE SURFACE FIELD*.
- A turned green (`greenTurn`) is one shape only if everything round a green asks `greenPoint`/`greenOffset` -- PROJECT_HANDOFF *A GREEN TURNED TO ITS APPROACH*.
- `groundPaint` is called twice (`paintLayer`), three times in a built course's program, and no more: each call is a second of every first start on Windows. [`groundPaint` IS CALLED TWICE]
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
- The far shadow cascades are redrawn less often (the middle and the far each every fourth frame, on different frames) and Ultra's nearest map has its own size and texel snap; a map not redrawn keeps its own matrices, and anything that moves the cascades sets `cascadeForce`. [THE FAR CASCADES ARE REDRAWN LESS OFTEN]
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
- The frame loop writes to the page only what changed (`setText`, `setHidden`, `setClass`, `setStyle`), and the renderer reads the canvas size through `cssSize()`: a same-value write still restyles the page. [THE FRAME LOOP WRITES TO THE PAGE ONLY WHAT CHANGED]
- A console full of errors is evidence, not noise. [A CONSOLE FULL OF ERRORS]
- The studio bar rides above an open panel; anything else pinned to the studio's bottom edge has to join that lift. [THE STUDIO BAR RIDES ABOVE]
- (Until 28 October 2026, when the boxes went square) a leaning picture is an exact clip-path shape (never a skewed layer in an overflow-hidden box, never clipped and skewed both), outlined with `--trace`; a picture over its caption leans from its foot and the caption from its head, one shape; grids gain columns as the screen widens; scroll boxes are padded by the lean. [THE WIDE-SCREEN RULE], [A picture over its caption is one shape]
- The studio's windows are the menu's sheets on every screen and the bar steps aside while one is open; the old strip under the bar is retired. [THE STUDIO'S WINDOWS ARE THE MENU'S SHEETS]
- The shot panel draws one record; in flight it is read at the flight's clock, and `refreshShotGrid` swaps the grid only, never what `renderResult` wrote above it. [READ AT THE FLIGHT'S CLOCK], [REPLACES THE GRID ONLY]
- The shot line is one element that `drawMonitorState` moves between the shot controls and the launch monitor window; JS learns "phone" from the stylesheet's `--phone`, never by measuring. [back inside the play window], [Where an unmoved tile sits]
- The bridge's accepted club codes come from `CLUB_KINDS`; a typed list once dropped the connection on any non-stock club. [passes on every club a bag can hold]
- 1.0 sheets: #drawer and the notices are outside #app -- no app query, palette, Text size zoom or `--hud-z` reaches them; ui-sheets.css uses @media and `--sheet-z`. [THE SHEETS ARE OUTSIDE #app]
- 1.0 round screen: the lie lives in the club box and the picks and Skip in the meter's row, moved at boot [THE FOOT, COMPACTED]
- 1.0 round screen: the shot controls are `display:contents`, so a new child lands loose unless round-hud.css places it; labels the frame loop positions scale by transform, never zoom; an author `display` beats `[hidden]`. [THE SHOT CONTROLS ARE `display:contents`]
- 1.0 interface: **square boxes since 28 October 2026** -- no skew, no lean, square rings (PROJECT_HANDOFF "SQUARE, NOT SLANTED"); 1.0 interface: skewing a parent and straightening a coloured child leaves the block upright -- only text and pictures are straightened. [SKEWING A PARENT AND STRAIGHTENING]
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
- **TODO.md** -- open work only; fine to read whole.
- **DONE.md** -- the record of what was built, and what was ruled out. Search it.
- **history/** -- the round-by-round journals of finished branches (the cartoon overhaul, the 1.0 polish). Search them for why; `docs/*.md` does not reach them.
- **IDEAS.md** -- what could be built; read only when looking for something new.
- **TESTING.md** -- what is tested, by which layer, and what only a person checks.
- **RESEARCH.md** -- every number, its source and the measurement behind it.
- **BALL_BEHAVIOUR_KNOBS.md** -- which tuning value changes which ball behaviour.
- **PROCEDURAL_GENERATION.md** -- what the generator produces and why.
- **PLAYING.md** -- everything a player sees and presses.
