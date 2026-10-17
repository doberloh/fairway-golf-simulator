# Fairway: project handoff

**Start with [ARCHITECTURE.md](ARCHITECTURE.md)**, the short version of this file. This one is long -- about 80 thousand tokens -- and is meant to be searched, not read top to bottom: `grep -n "^## \|^### " docs/PROJECT_HANDOFF.md` lists its sections, and every trap in ARCHITECTURE.md names the phrase to search for here.

Validation: all 79 gameplay/physics/generation tests passed on September 11, 2026 (82 including the bridge suite); production single-file build passed and reproduced the released `dist/index.html` byte for byte. Browser checks inspected channel passage through fairways, the staged shoreline, feathered waterlines and cartoon ripples, plus large-lake maps/reflections, camera tree disappearance/restoration, flyover heatmap orbit and preference restoration; no shader/runtime errors were logged. Hardware testing remains deferred.

Updated September 11, 2026. This guide is for a developer or coding agent joining without the original conversation. Read INSTALLATION.md for device setup and build/run procedures, README.md for player instructions, PROCEDURAL_GENERATION.md for generation rationale, RESEARCH.md for physics/protocol sources, and TODO.md for remaining work.

## Product and design decisions

Fairway is a portable, single-file, browser-based golf simulator. Manual play is offline; the optional local launch-monitor bridge is a separate Node process. There is no account service, hosted backend, telemetry, purchased asset pack, or external font dependency. Keep the offline build working when extending the project.

The user chose **Cartoon as the only art style**. Preserve crisp turf boundaries, mowing stripes, moving vegetation, biome identity, real-size ball/cup geometry, and one continuous landscape containing every hole. There is one sanctioned exception to the crisp-boundary rule: where a creek or river runs through a playing surface, the turf classification is blended and the mowing stripes fade, because a hard fairway edge crossing a soft bank reads as a drawn line. The relaxation fades out with distance from the water and applies to channels only — never to ponds, bunkers or ordinary turf edges. Do not widen it without asking. Do not reintroduce art-style selectors or a finite catalogue of complete hole templates. Overall footprint choices are permitted: they guide land use while individual holes remain generated from seeded continuous parameters.

Courses have 9 or 18 holes. Eighteen-hole par is bounded to 68–72, nine-hole par to 34–36. Yardage continues changing outside the range that changes par; hole par mix/order is seeded. All blue/white/red tees are generated, with the playing tee chosen in the round controls. Par 3s never dogleg. Course regeneration rebuilds surroundings and starts a new round; changing holes retains the existing world. The title is the biome with a smaller seed below it.

The game supports 1–4 golfers, stroke play, scramble, best-ball match play with teams, and skins for two to four. In stroke play and skins, each golfer finishes the entire hole before the next golfer starts. There are hole-out, dartboard and decimal putting modes, editable club yardages/flight profiles, green Stimp and surface roll settings, penalty-free sim drops, mulligans, saved/exported rounds and scorecard CSVs. Three green-reading tools can coexist, switched from the map header, and the map frames the green and paints its contours once the ball is on it. UI panels can be dragged and resized and save independently of the round.

The latest work adds camera tree clearance, fairway-centered initial aim, a fairway/green-orbit flyover, large lakes, downhill reflective streams with biome banks, fairway-side homes, broader green surrounds, fitted pond banks, rivers/creeks, 14 footprint choices with previews, persistent/live shot results, flag lifting on putts, and presentation delays. Physical launch monitor testing is deliberately deferred. Do not describe protocol compatibility as verified device compatibility.

## Start and build

Use Node 22.12 or newer (development used Node 26). From this directory:

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite serves http://127.0.0.1:5173. `vite.config.js` uses the single-file plugin, targets ES2022, and inlines assets. `dist/index.html` is the actual offline app, approximately 15.8 MB uncompressed and 6.5 MB gzipped. Most of that is the generated redwood forest, shipped whole rather than at reduced detail because measurement showed the geometry costs nothing on this path. This figure sat at "approximately 1.2 MB" for months after the mesh ingest landed, which is how the shipped archives came to be 124 commits stale without anyone noticing. Open it directly in a WebGL 2 browser with hardware acceleration, or serve it locally. **Opening it directly by `file://` URL is confirmed working** on the 25 September build -- unzip the portable archive, double-click `Fairway.html`, and it plays. That is the central portability claim and it had gone unverified long enough for the last confirmation to predate the mesh ingest, when the file was an eighth of its present size. The browser automation used for development disallows file-URL navigation, so this check cannot be scripted and has to be done by hand; it is worth repeating whenever the build gains something structurally new, because what breaks a file URL is a fetch, a worker or a module boundary, not a megabyte.

Pinned dependencies. Runtime -- the only ones that can reach a shipped file: Three.js 0.186.0 (MIT), ws 8.21.3 (MIT), Lucide 1.44.0 (ISC). Build and tooling: Vite 8.3.0, vite-plugin-singlefile 2.3.3, @dgreenheck/ez-tree 1.1.0 (MIT, bakes geometry that ships), Playwright 1.63.0 (Apache-2.0, drives the profiler). The lockfile uses the public Yarn registry mirror and integrity hashes. Preserve LICENSE and THIRD_PARTY_NOTICES.txt when distributing. The owner selected MIT for project-authored code; third-party terms remain separate. Read `docs/DISTRIBUTION_REVIEW.md` and `docs/DEPENDENCY_INVENTORY.json` before adding or changing dependencies -- the packager refuses to build while the inventory disagrees with the lockfile, so a new dependency is a documentation change before it is a build. Full licenses are imported as raw text into main.js and displayed offline in Help. Avoid dependency upgrades incidentally during graphics work; Three shader patches depend on the current shader include structure.

**The four platform downloads are the PRODUCT** (`Fairway-Windows.zip`, `Fairway-macOS-AppleSilicon.zip`, `Fairway-macOS-Intel.zip`, `Fairway-Linux.zip`, written into `release/`; they replaced `Fairway-portable.zip` on 1 October 2026). Each is flat: `run_fairway_server` for that computer, Fairway.html, LICENSE, THIRD_PARTY_NOTICES.txt, ATTRIBUTION.md, README.md and PLAYING.md, and the bridge bundle in `server-source/fairway-bridge.mjs` (see *Shipping the bridge to players*). Its README is `docs/PORTABLE_README.md`, not the repository's -- the root one links into `docs/` and explains `npm ci`, which is a page of dead links to somebody who unzipped a game. INSTALLATION.md is the build-from-source guide and ships only in the source archive. Nothing else -- it used to ship the architecture handoff, the open defect list, the research measurements and AGENTS.md, none of which is anything a player needs. `Fairway-source.zip` keeps the repository's own layout and carries source, tests, bridge, package files, build configuration and the documentation set, without node_modules. Rebuild before repackaging, then run `python3 tools/package_release.py` (Windows: `py tools/package_release.py`). This allowlist-based script packages only files git tracks -- a stray file in the working tree cannot ride along -- and verifies notices, dependency inventory and archived bytes, and writes RELEASE_SHA256.txt. ZIPs are not automatically refreshed by `npm run build`. The packager refuses if the bridge bundle is missing or older than `bridge/server.mjs` or anything in `src/`, refuses if a platform's `run_fairway_server` is missing or older than that bundle, and writes `run_fairway_server` with Unix execute permission (0755) -- a ZIP entry copied from Windows has none, and a Mac or Linux machine will not run the program without it. Add new release source directories/documents to its allowlist.

## File map

Grouped by what a file is for, because a newcomer's question is "where does
water live", not "what comes after `course.js` alphabetically". Every `src/`
module, every tool and every committed baseline is listed. Add a file, add a
row -- this table went a long stretch with sixteen modules and fifteen tools
missing from it, and still carrying a row for `src/water.js`, which had been
deleted.

Documentation is not in this table. [docs/README.md](README.md) is its index.

### Making a world

Everything that turns a seed into ground. `course.js` is the centre of it; the rest were pulled out of it by concern.

| File | Responsibility |
| --- | --- |
| src/settings-schema.js | Every generation setting's default, bounds, category and help text; validation, migration and both version numbers |
| src/course.js | Biomes, seeded hole geometry, world landforms, basins, surface queries, ecology |
| src/course-plan.js | Target yardage, bounded pars, tee distances and the green contour (tilt, ridges, dish, tier) |
| src/routing.js | Candidate hole placement, corridor collision checks and world/local transforms |
| src/footprints.js | Fourteen footprint names, curves and SVG preview icons |
| src/haunts.js | Haunted Hollow's moving and glowing parts: draws the solid pumpkins and toadstools generation placed (`world.props`), the carved lantern faces that light with `solar.lamplight`, the ghosts patrolling loops over each hole, and from dusk the bats round the tall trees and the will-o'-the-wisps over the ponds. Updated every frame from `render()`; scenery only, nothing in it is decided here |
| src/biomes.js | EVERY BIOME IS ONE RECORD -- palette, light, landform, plant mix, rock and grass density. It was seven tables and forty-eight conditionals across eight files; adding a landscape now means adding a record |
| src/species.js | What a plant species IS, independently of which biome grows it. Two named sets rather than two similar array literals in two files: tall enough to size like a tree, and solid enough to stop a ball, are different questions |
| src/course-names.js | Seeded course names, so the box is already filled when somebody wants to play. NO WORD HERE MAY NAME A REAL GOLF DESTINATION -- see the denylist test |
| src/terrain-grid.js | Adaptive connected terrain mesh and matching contact interpolation |
| src/landscape-edge.js | Distant terrain joined to the detailed ground perimeter |
| src/ground.js | Ground material, GPU course-data atlases, crisp surface classification, shared shoreline bands |
| src/streams.js | The drainage model, river/creek routing off it, downhill grading, spatial query, biome bank colors and reflective channel geometry |
| src/lakes.js | Large-lake open-space candidate selection and procedural bank profiles |
| src/water-bodies.js | What the renderer needs about a body of water beyond its geometry: the probe hide/restore pair, and surface flow. Free of three, so both are testable |
| src/homes.js | Dry/gentle housing sites, tree exclusion footprints, terrain-fitted foundations and varied cartoon house meshes |
| src/vegetation.js | Instanced biome trees, shrubs, grass and rock geometry |

### Moving a ball

The simulation proper. Metres, seconds, kilograms and radians throughout.

| File | Responsibility |
| --- | --- |
| src/physics.js | Flight/contact integration, cup capture, monitor shot normalization |
| src/contact.js | The bounce as something that takes TIME, rather than one instant with a restitution. The only model that reproduces a spun ball hopping, standing up and coming back |
| src/cup.js | Cup geometry and the ANALYTIC capture model, kept as the documented reference and anchor. `simulateShot` no longer uses it: the simulator resolves the rim as a real surface |
| src/turf.js | Surface roll, Stimp and contact constants |
| src/firmness.js | Turf firmness, kept as a separate axis from green speed. Speed is what a ball does once it is rolling; firmness is what happens the moment it lands |
| src/clubs.js | Every kind of club (`CLUB_KINDS`: launch, spin, monitor code), the stock bag, a golfer's bag checked (`validateBag`) and made playable (`bagClubs`, ball speed solved to each carry); `manualLaunch`, a club's plain strike at a share of its speed, and `spinForPower` |
| src/swing-meter.js | The Swing Meter (14 October 2026): three taps judged on their own times into the five launch numbers; the bar in yards (`speedForCarry`), overswing, difficulty, the strike zone, curve / height / spin dial (`shapedLaunch`), the putting bar (`puttRange`), and the lie table every golfer plays under (`LIE_SPEED`, `monitorLie`) |
| src/progression.js | XP and levels (Phase 4, 14 October 2026): the amounts (`XP`, `XP_MULT`), the level curve (`levelOf`), hole and shot XP, and the keyed ledger (`award`, `takeBack`) a mulligan takes back from |
| src/dispersion.js | Groups recorded shots by the club that hit them and reports a centre and a standard distance. A read of what was hit, never a model of what might be |
| src/shot-data.js | WHAT A SHOT IS WORTH SHOWING, IN ONE LIST. The five numbers the model runs on, plus every extra a launch monitor may send. A missing reading renders as a dash, never as a zero. Also `liveRecord` (the shot part way through its flight, for the shot panel's live tiles) and `moveField` (a dragged tile's new order) |
| src/plays-like.js | PLAYS LIKE, BY GEOMETRY. The club in hand at full swing is flown in today's wind, altitude and temperature over made-up open ground, and where it falls through the hole's height (`crossing`) is compared with where the same strike falls back to level in still air at sea level; the hole's distance is scaled by the ratio. Two flights. Searching for the ball speed that lands at the hole was the first version and was rejected (RESEARCH, *Plays like, by geometry*). main.js draws it under the flag marker's yards (`drawPlaysLike`), recomputed only when the ball, the pin, the club, the wind or the ball-flight settings change. |
| src/shot-views.js | Reduces a trajectory to down-the-line and across-the-line numbers and draws the 2D side and plan plots |

### Playing a round

Rules, scoring, and the things that persist between sessions.

| File | Responsibility |
| --- | --- |
| src/game.js | Round rules, team selection, score state, undo and sim drops |
| src/challenges.js | THE CHALLENGES AS ONE TABLE (16 October 2026): 27 rows of plain data -- where each plays, how its balls are placed and scored, its bronze, silver and gold -- read by the Challenges screen, the bar, the results, the records, the medals and the tests; records and medals, the Challenge Course's fixed settings (`challengeCourseSettings`) |
| src/challenge-play.js | A challenge being played, as a state machine with no DOM: whose turn, which ball, what each ball scored (`scoreBall`), when it ends, the results; and what a flight says a ball did (`ballFacts`: where it landed, how it curved) |
| src/challenge-spots.js | Where a challenge's balls go and which hole it uses, asked of a hole through a small adapter (`holeAdapter`): round the green, in a bunker, behind one, on the centre line, over water, on the green; the zone, the calls |
| src/round-goals.js | ROUNDS WITH A GOAL (Sudden death, Bogey-free nine): which rounds can carry one (`goalProblem`, called by `Round`) and each golfer's goal read from the card (`goalStatus`). Never changes how a round is played |
| src/skins.js | The skins format: who won each hole and for how many, the carry, the winner, and the banner and scorecard lines -- worked from the stroke card, never stored |
| src/sound.js | **Every sound, synthesised with the Web Audio API -- no recordings.** What a sound is: strikes, landings per surface, trunk, canopy, rock, flagstick, house, cup, score stings and the ambience engine. No DOM; takes a live or offline AudioContext, so the owner's report (tools/sound-lab) inlines this very file. `FINAL` holds the owner's signed-off choice for every sound (four rounds, 13 October 2026); `tests/sound.test.mjs` fails if a sound the game can play is not signed off. Change a sound by changing its recipe or `FINAL`, then rebuild the report for the owner to hear |
| src/audio.js | **WHEN THE GAME MAKES A SOUND.** The game's side: one AudioContext made on the first click, tap or key (nothing before), suspended while the page is hidden; strikes (keyboard shots only -- **no club sound with a launch monitor**, the owner's rule), each simulateShot contact as the drawn ball reaches it, the canopy (`canopyContacts`, sound only), the cup, the score sting with the hole-out banner, and the ambience from biome, wind, temperature, night and `nearestWater`. The Sound window's settings live in their own store (`fairway-sound-v1`), never in a course or a round. **A sound is never scheduled in the past**: Web Audio does not skip the missed part of a late sound, it moves the whole sound to now -- round 4 started each strike 0.43 s early to let the whoosh lead the ball, and the whoosh played after the crack (the owner heard the swing run backwards). The game strike has a 0.1 s lead instead (`strike(..., {lead})`). Inland water's options (round 6) are `WATERS`/`waterPlayer` in sound.js: **sample-level** -- thousands of grains a second written into fifth-of-a-second buffers queued back to back on the audio clock, because a creek needs about 2,000 bubbles a second and a Web Audio node each would be hundreds of thousands of nodes a minute. A recipe's `base` holds the owner's sliders; `WATER_FOR` names the signed-off sound for each kind of water (pond, river, creek; round 8). **The ambience plays the kind nearest the listener** (`set({waterKind, waterDist, waterPan})`, from audio.js's `nearestWater`/`waterKindAt`), cross-faded when it changes; the sea keeps its surf. Water is made at most 0.6 s ahead so its main-thread cost comes in 2-3 ms slices, not a burst. Heard on `docs/reports/sounds/water.html` |
| src/scoring.js | How a round stands against par. Apart from the game and the page because it is the same small calculation in three places and decides what colour a number turns |
| src/putting.js | Dartboard/decimal putting and fractional score formatting |
| src/range.js | The driving range. Not a hole with the bends taken out -- a hole's corridor wanders and necks down at the green, and every one of those is wrong for a practice bay |
| src/range-report.js | The range session's exports: `sessionCsv` (every shot, a golfer's units, sides as words so a formula guard never mangles a number) and `sessionReport` (the PDF: summary, club table, short game, a dispersion chart and carry bars per golfer, every shot). Pure; tests/range-report.test.mjs |
| src/pdf.js | A PDF written by hand: the two standard Helvetica faces (nothing embedded), text, lines, rectangles, circles and ellipses, and the byte-offset table a reader needs. No dependency; the test checks every offset lands on its object |
| src/presentation.js | Three-second replay/scorecard constants and live distance calculation |
| src/endless.js | Endless-run seeding, per-hole settings, and `endlessSettings` — the normalisation the menu backdrop and a run must share, and which must stay idempotent |
| src/round-library.js | Rounds in progress, kept on this device. The sibling of course-library.js and deliberately the opposite kind of store |
| src/course-library.js | Named courses in localStorage, and the portable export/import code |
| src/profile.js | The player's profile: name, running stats, personal bests, round history and their own bag, one versioned record. COUNTERS / BESTS / SCORE_TYPES are the registry the page draws from |
| src/handicap.js | The sim handicap: WHS differentials, hole caps and the best-8-of-20 table, with courses rated from length alone |
| src/player-colours.js | A colour per golfer, so four people's tracers can be told apart at the end of a hole |

### Drawing it

The renderer and everything patched into it. A change to any of these can move a frame -- see the profiling rule in AGENTS.md.

| File | Responsibility |
| --- | --- |
| src/renderer.js | Three scene lifecycle, ball/cup/flag, camera modes, pond geometry and minimap drawing. `projectMarker` clamps a world point to a screen rectangle; `cameraHeading` is the camera bearing in the same `atan2(x, z)` convention the wind uses; `setPinOut` keeps the flagstick standing on the green (since 15 October 2026; it is lifted as a putt nears the cup -- the attended pin)|
| src/graphics.js | Device-local quality tiers and frame cap, and the one table every graphics knob reads |
| src/textures.js | Procedural textures and foliage animation shader hooks |
| src/mesh-assets.js | Decodes that geometry and instances it under the biome palette. `farParts` derives a tree's thinned twin -- a third of its leaf sprays, each grown to keep the crown full -- at load, for shadows beyond the nearest cascade and for distant crowns; only crowns of `TWIN_MIN_TRIANGLES` or more use one |
| src/gen-pool.js | The workers that compute the ground grid's heights while a course generates (B2). Every call resolves to null rather than failing, which sends the grid back to the main thread |
| src/textures.js (windMaterial) | Everything that moves in the wind, in one vertex patch. **Trunks bend now, and that is safe only because the bend grows with the square of height**: under a centimetre at 3 m up a 60 m trunk, so the trunk the physics collides with and the one drawn agree wherever a ball can be. A lever that moved the base, or a much larger bend, would let a ball visibly pass through a trunk or bounce off air. Shadows do not sway (three's depth material does not carry the patch). A procedural tree's pieces carry a per-instance `treeRoot`; **any per-instance attribute a wind material reads must also be packed by `instance-cull.js`**, which reorders instance buffers as the view changes -- it packs matrices, colours and `treeRoot` and nothing else, and an unpacked attribute silently pairs one tree's leaves with another tree's root |
| src/course-plan.js (greens) | `greenContour` is the putting surface: a per-green recipe (`greenRecipe`, drawn from the seed and the hole and cached per hole object in a WeakMap) of character, tilt and false front. **The recipe must depend only on the seed and the hole**, never on call order or on settings other than through the comparisons made at call time: the generation workers regenerate the world on their own and must build the same greens. `greenPedestal` (raised and punchbowl greens) is added to the green's height inside the terrain blend in `course.js`'s `height`, NOT into `greenContour` -- it is constant over the putting surface, so the pin chooser and the green-reading overlay, which read the contour, never see it |
| src/auto-resolution.js | Automatic resolution (F4): which fraction of the tier's pixels to draw, from the frame intervals it is fed. Pure, so `tests/auto-resolution.test.mjs` drives it with a pretend machine. `main.js` feeds it and `GolfView.setResolutionScale` applies it; **`applyQuality` keeps the current scale, so anything else that sets the pixel ratio must go through `setResolutionScale`** or the two will fight. The scale is only ever at or below 1: it may draw fewer pixels than the tier, never more |
| src/ground.js (HOLE_ATLAS) and texture units | **Every lit fragment shader may use at most 16 texture units, and the ground's is the hungriest**: 7 data textures, the mist's water field, the toon ramp, the sun's shadow map(s) (3 on High and Ultra), and one per shadow-casting floodlight. Over 16 the program fails to link and THE GROUND DISAPPEARS -- shipped once, at night with the lights on. The four per-hole tables are one texture (`HOLE_ATLAS`, a 35-texel row per hole: route, tees, cups, hazards); add a per-hole value there, not as a new texture. `tests/flood-shadows.test.mjs` counts the ground's samplers and fails if a tier's `floodShadows` would leave no unit spare -- if it fails after you add a texture, lower that tier's count or pack something |
| src/main.js (the first frames, behind a cover) | **What gets built is first drawn under a cover, never on screen.** The first real frames of a new scene carry one-off costs nothing earlier can reach (the first render with a moving camera, the cull's first sort, the grass ring): 117-217 ms on Ultra. So the splash fades only after `smoothFrames` (three frames under 40 ms, at most 2 s) with the menu already open beneath it, and `whileGenerating` holds its overlay the same way (at most 1 s). The menu reached from a round opens INSIDE that wait (`growBackdrop`). Anything new that opens a scene must do the same, or its first frames are a stutter on the first thing the player sees. The smoke harness's `menuReady` waits for the splash to be gone for the same reason |
| src/renderer.js (compiled where it is drawn) | **Every pre-compile must bind the render target the frame really draws into (`asDrawn`)**, because three picks a program's version partly from it (tone mapping, colour space). Ultra draws the scene into bloom's target; every warm-up compiled with the screen bound, so on Ultra they built versions no frame used and the first switch of the floodlights built every lit program for real in one frame -- 12-16 s frozen on nine holes, 26 s on eighteen, nothing on High, which has no bloom. `withStandIns` and `ready` go through `asDrawn`; a new warm-up must too. The `floodlit-night` smoke journey fails if switching the lights on freezes for more than half a second |
| src/renderer.js (state compiled ahead) | To build programs for a state the scene is not in yet (floodlights on, floodlight shadows switched), use `compilePrograms` while the state is held and `whenLinked` on what it returns. **Not `compileAsync`**: it waits on each material's CURRENT program, and once the state is put back the next frame makes the old ones current, so it resolves at once and the switch that follows freezes (2.3 s, measured) |
| src/style.css (the play area's height) | **`#app` is a column and `#world` takes what the top bar leaves (`flex:1`)** -- never give the play area a height of its own computed from the bar's. It used to be the screen minus a guessed bar height per size, and when a later rule changed the bar the guesses left an 18 px strip under the course at most sizes for weeks. The bar's height rules can change freely now |
| src/physics.js (contacts) | **simulateShot records every contact for the sound** (`result.contacts`: time, what was met, speed into it, where) -- each turf bounce, water, a trunk, rock, prop, mast, flagstick or house. Recorded only; nothing in the flight reads it, and a new kind of contact needs a sound in audio.js's `CONTACT` or it plays as rough |
| src/physics.js (after the ball lands) | **Three rules from 2 October, each held by `tests/landing.test.mjs`.** (1) A rolling contact can only grip as hard as it is pressed: the cup wall's vertical friction is capped at `WALL_FRICTION` times the press of going round, and when the rolling solution needs more the ball SLIDES, with its spin about the direction of travel (`wall.turn`) tracked separately. A model that assumes rolling without checking the grip will produce motion no surface can -- a slow ball circled the inside of the cup three and a half times that way. The lip EDGE regime got the same cap on 3 October (`lipGrip`, `edge.slip`); with it the full 360-degree lip-out is gone, a known trade-off (docs/reports/LIP_GRIP_REPORT.md). (2) Sand takes the spin: after a sand contact the ball keeps none. (3) Nothing here knows about keyboard power -- `clubs.js` decides a manual shot's spin (`spinForPower`), and a measured monitor shot is never touched. `node tools/landing-scorecard.mjs` runs every rollout anchor at once; docs/reports/BALL_LANDING_REPORT.md is the study. `node tools/green-fit.mjs` scores and fits the green's landing (see THE GREEN IS FITTED AS ONE PIECE) |
| tools/capture/ | Pictures and clips of the game -- the website's media, which lives in the website's own repository since 7 October 2026. Saves under `bench/shots/media/` (not committed; `MEDIA_OUT` moves it), and the owner picks what is copied to the site. **A time of day is a sun height, not a clock reading** (`hourFor` in capture.mjs): the warm light follows the sun's elevation and every biome's sun climbs differently, and "golden hour" taken at 5:48 PM was plain afternoon with the sun 19 degrees up. **`capture.mjs` captures at pixel density 2 and refuses anything below Ultra at full resolution**: the game draws no more pixels than the screen's density allows (`pixelCeiling`), so a density-1 page renders at 1x whatever the tier says -- the first set of website pictures was taken that way and looked soft. `build-hooked.mjs` builds the game with `window.__view`, `__takeShot` and `__play` added by a Vite transform -- src/ is never edited, because editing main.js for a hook and reverting it by hand once discarded real uncommitted work -- and it fails loudly if the line it attaches to has changed. Its `SWAP` builds with another version of a source file loaded in place of the src/ one (a before/after without editing src/), and fails if a swapped file was never loaded -- the one mistake that would film the unchanged game and call it the after. `openGame` takes a `quality` for clips that study the ball rather than the scenery (the spin-back report uses High). `gallery.mjs`, `clips.mjs` (WebM from the canvas: no video encoder exists in the toolchain) and `features.mjs` drive that build |
| tools/sound-lab/ | The game's sounds, **synthesised live with the Web Audio API -- no recordings** (owner's rule: any asset must be CC0 and credited; synthesis needs neither). The synthesiser is `src/sound.js` (it began here as `synth.js` and moved unchanged when the sounds went into the game, 13 October 2026). `build.mjs` inlines it into the local listening report, `docs/reports/sounds/index.html` (takes A/B/C per sound, sliders, notes, a "Copy my notes" block the owner pastes back). `check.mjs` renders everything offline and prints levels. **The ambience never loops**: wind is a random gust process over noise, birds are individuals with their own songs that arrive and leave, water is hundreds of separate bubbles, planes fly a computed path. **The limiter hides overs**: check.mjs turns it off, and the first strikes came out 7 dB over full scale before it did. **One bird at a time** (owner's rule): every song and every goose honk goes through `birdSong`/`geese`, which wait for `birdUntil`; check.mjs fails if two ever overlap -- a new bird call that sings outside that path breaks the rule silently. **A take can carry `base` knobs** (round 2 bakes the owner's sliders into take A); the report's sliders multiply on top, so whenever takes absorb sliders the report's storage key (`fairway-sound-lab-v2`) must move on too, or the owner's old sliders apply twice. Water runs through one gain set by distance to water (`set({waterDist})`). **Round 3 signed the sounds off**: `FINAL` folds the owner's sliders into a single take per sound, and the report's storage key is `fairway-sound-lab-v3`; score stings (`SCORES`, `score`, `scoreSting`), the flagstick and the house were added. `cc0-candidates.json` is the record of the CC0 search the owner turned down; nothing reads it. **Round 4 signed off the rest and the sounds went into the game** (src/audio.js); the report's storage key is now `fairway-sound-lab-v4` |
| tools/build-server.mjs | `npm run server`: `run_fairway_server` for four platforms, compiled with Bun from `dist/fairway-bridge.mjs` into `release/server/<platform>/`. `tools/package_release.py` refuses to package a server older than the bundle, and packs one download per platform into `release/` |
| src/ui-scale.js and the Text size zoom | **The whole app is CSS-zoomed** (`#app{zoom:var(--ui-zoom)}`, made `zoom` times smaller in CSS pixels so it still fills the screen). Three rules follow, and breaking any of them breaks the interface only at sizes other than 100%, where nothing else will notice: (1) **screen-size rules are `@container app` queries, never `@media`** -- a media query sees the screen, not the zoomed app; only pointer, hover and reduced-motion queries stay `@media`. (2) **screen units divide by the zoom**: write `calc(100dvh / var(--ui-zoom,1))`, never a bare `vh`/`vw`/`dvh`. (3) **`getBoundingClientRect` and pointer coordinates are SCREEN pixels; `clientWidth`, `offsetWidth` and inline `left`/`top` are the app's CSS pixels** -- divide the first by `uiZoom()` before mixing them (layout.js, popups.js, `hudInsets` in main.js do). The renderer sizes its canvas from its container's `clientWidth` and carries the zoom in its pixel ratio (`pixelCeiling`), so the course is drawn at the screen's full resolution at any size. Sizes are capped where the screen would shrink below 1280x720 (`maxTextSize`), the smallest desktop size `hud-reachable` checks. The `text-size` smoke journey plays at 150% and 200% |
| src/renderer.js (shader warm-up) | **Every lit material a player can reach must be in the scene when `ready` runs, and must be DRAWN in its one frame under the loading screen**, not only compiled: on Windows the browser finishes a program on its first real draw, so a program built behind the overlay but first drawn during play still freezes that frame (70 ms or more each). Anything that grows meshes later -- the near-field grass and the forest floor, which fill tiles as the camera moves -- leaves one hidden zero-sized stand-in per material in `view.standIns`; `ready` shows them through its compile and first frame, and `warmUp` and `warmFloodlights` through their compiles (`withStandIns`). A stand-in must be the same KIND of mesh as the real thing (instanced, with instance colours, receiving shadow), or it builds a different program. Also: an instanced mesh with no instance colours is a different program from one with them -- an empty grass tile was one, and is now hidden. **The god rays are the exception the scene compile cannot see**: their mask draws through an override material and only with the sun in shot, so `ready`'s frame runs the pass regardless (`warm`) -- see *God rays*. The `no-late-shaders` smoke journey fails if a lit program is built after a course appears (B7), and, after turning the camera a full circle, if a program of ANY kind is: an unlit one is cheap alone, but the first program the page waits for waits behind the browser's whole queue (8 s in the owner's Chrome, 9 October) |
| src/renderer.js (far plane) | `camera.far` follows the fog's end every frame (5% past it), and **the sky dome follows the camera, scaled to fit inside the far plane**. Anything that renders the scene from somewhere other than the camera must put the sky back at the origin at full size first, or it is outside the dome and sees nothing -- `probeCapture` does this for the water probes; a new offscreen pass would need the same |
| src/renderer.js (water edges) | Each body of water is one of four kinds for its edge (`WATER_EDGES`: sea, river, creek, still), and each kind is its own shader program. **The sea knows its depth from `seaDepthMap`, a half-float texture of the terrain's coarse height grid**; it fades out over its last 35 cm, which is what stops the waterline flickering on a shelving beach. If the terrain's heights ever stop matching `groundGrid.values` near a coast (refinement, or shaping applied after the grid), the sea's edge and the drawn shore will part. The map is cached per course and cleared at build (`this.seaDepth=null`). **Streams carry their flow per vertex** (`flow`, the local downstream velocity, and `chan`, metres downstream and across, from `streamFrame`): the ripples and foam read those, not one direction per body, so a new way of building channel geometry must supply both or its water will stand still |
| src/occlusion.js | The soft shade under trees and rocks (U1): how much sky each texel of ground loses to the trunks, crowns and boulders around it, baked per course on the ownership atlas's grid and carried in the red channel of the ground's `cover` texture. Also read by the Ultra forest floor (U6) to decide where ferns grow |
| src/owner-atlas.js | The ground shader's ownership atlas: its size and the questions each texel asks, shared by `ground.js` and the generation workers, which compute three of its four channels while the course is planted |
| src/gen-worker.js | One such worker: generates its own copy of the world from the same settings and stops at the grid. Built as a classic script embedded in the single file -- a page opened from disk may start a classic blob worker in Chromium, not a module one |
| src/instance-cull.js | Draws only the part of each course-wide instanced mesh (trees, deadfall, rocks, ground cover, homes, floodlights) that the camera can see or whose shadow it can see, and gives each shadow map only the trees inside it -- as thinned twins from the middle cascade out on High and Ultra (grown trees only: a cartoon crown is never thinned) |
| src/asset-meshes.js | GENERATED. Packed CC0 geometry, int16 positions and int8 normals |
| src/shot-visuals.js | Wind debris, strike effects, aiming/tracer helpers |
| src/roll-hop.js | The cosmetic skip of a rolling ball: a random, seeded, surface-limited lift of the DRAWN ball only, applied in main.js's flight playback. The simulated position, the trail and the camera never see it. Ships OFF (`ROLL_HOP.enabled: false`, 6 October); `lab.rollHop(true)` switches it on |
| src/clouds.js | Cartoon cloud meshes drifting on the wind, and the discs they shade with |
| src/cloud-shadows.js | Projects those discs onto the ground, patched into every lit material |
| src/mist.js | Height fog and the mist that pools in hollows at dawn. Two analytic layers in one fragment patch, no render pass |
| src/godrays.js | Additive crepuscular rays for the high tier, composited over the finished frame |
| src/bloom.js | Bright-pass glow; the one effect that needs the rendered colour back |
| src/daylight.js | A live clock and the light that follows from it. Deliberately outside courseSettings: the hour belongs to the session, not to the landscape |
| src/floodlights.js | Course floodlighting for night play, placed by published sports-lighting practice rather than taste. Every pole is a light because none of them casts a shadow |
| src/green-reading.js | The slope grid and its flow, ONE half-metre surface over the green whose shader draws both (`readingSurface`): lines every 1.5 m through the cup in a frame the renderer gives it (`updateGreenGrid`): in play, the SHOT's frame -- `main`'s `setUpTurn` hands the starting aim to `setReadingHeading` and the grid keeps it while the player aims (following the camera every frame turned the grid with every nudge of the aim, which the owner found hugely disorienting) -- and the hole's axes for other cameras. Light runs along the lines downhill at one speed per slope band (one speed per point would drift out of phase and turn to noise), on every band including the gentlest; only dead-level ground is still. Slope and fall per vertex from `greenGradient`, the putting surface's own. Faded where a square is under ~10 px. Plus the contour heat map on the exact ground triangles |
| src/green-map.js | The same contour field as a cached top-down tile, plus green bounds for the map |
| src/course-map.js | Shared map bounds and invertible coordinate projection |
| src/camera.js | Camera offset and return-to-play helpers; the old chase pose, now the fallback for a full shot, and the putt follow |
| src/tv-camera.js | The television pair for a full shot -- when to cut and where the landing camera stands (`planShotCamera`) -- and the whole-shot review pose (`planReview`). Pure; tested on a flat world |
| src/camera-tours.js | Fairway aim targets, tree/camera bounds and the hole-orbit flyover with its terrain/canopy clearance ring |
| src/camera-prefs.js | How you look at the course, kept on this device. A camera is a property of the ROOM, so it does not travel inside a shared round |
| src/projector.js | The field of view a simulator bay actually has. In a bay this is a measurement, not a look: one vertical angle lines the drawing up with the room. The screen is two measured sides, width and height in inches (5 October; a saved diagonal and stock shape are converted by `validateCamera`). The height sets the angle; the width gives the SHAPE, and in a bay the camera's aspect is that shape, not the window's (`cameraRig().aspect`, applied by the renderer's `fitAspect` on every `setCamera` and resize), because a projector stretches the window onto the screen. Anything reading `camera.aspect` follows it; anything that takes the canvas's shape instead would disagree with the bay. A mat off the screen's centre is a LENS SHIFT (`lensShift`), never a sideways camera: the renderer sets three's `filmOffset` (`applyLensShift`, again on every resize because it is in film-width units), and the view cull widens its frustum by the same amount -- anything else that rebuilds the camera's frustum from fov and aspect alone must do the same or it will cut the shifted side |

### The interface

What a player touches. `main.js` is large and its DOM paths are not covered by the tests -- there is a section on that below.

| File | Responsibility |
| --- | --- |
| index.html | Static app shell, canvas and primary HUD element IDs |
| src/main.js | App state, controls/drawers, shot orchestration, monitor connection, save validation, animation loop |
| src/style.css | Responsive interface, custom HUD layout, studio previews |
| src/layout.js | The MEASURED space the default layout fits into: writes --controls-top, --weather-bottom, --card-bottom and --tools-bottom onto #world. It was the saved draggable/resizable HUD layout until 17 October 2026, when the 1.0 interface fixed the layout (*The 1.0 round screen*); the grips, drags and saved places (`fairway-layout-v2`, deleted once on start) are gone, and `reset`/`setVariant` are kept as no-ops |
| src/round-hud.js, src/round-hud.css | The 1.0 round screen: what each corner piece says (hole slab, conditions, golfer cards, club panel, keys, ball light) and how large it is drawn (`hudScale`), and where each sits. Pure module with a Node test; the stylesheet only applies in play and off a phone |
| src/diagnostic.js | The block a tester pastes into a bug report: build stamp, device, GPU, frame rate and the last few errors. Assembled on demand, copied to the clipboard, NEVER transmitted |
| src/popups.js | Tools that stay out on the course -- yardage book, green grid, camera controls -- beside the shot rather than over it |
| src/lab.js | Measurement arithmetic — shot/drop planning, the launch solver, slope and outcome readouts — that the `window.lab` console API drives. No world and no presets; the bench is the driving range |
| src/ui-layout.js | The 1.0 interface's layout rules as arithmetic: the design canvas for a screen shape (1280 x 720/800/960), the header/content/footer bands, the 12-column grid on the leaning sheet (`gridFor`), and the canvas on a screen with the Text size (`canvasFrame`). Pure; *The 1.0 interface: layout rules* |
| src/ui-palette.js | Which biome's colours a screen wears (`screenBiome`: the course in play, the course being chosen, or the course of the week), the shared under-par red, and the contrast check every palette passes. Pure |
| src/ui-kit.js, src/ui-kit.css | The 1.0 interface's building kit: root, sheet, `place`, panel, row, item, tile, stack, switch, picker, segment slider, tabs, chip, level tag, key hint, as HTML strings; every class `uk-`, every rule scoped to `.uk`. Also the `@font-face` rules. Built, tested, not yet used by any screen (phase 0) |
| src/fonts/ | Saira Condensed 700 and 800, Latin, woff2, with `OFL.txt`; inlined into the page by the build |

### Outside the game

None of this ships inside `dist/index.html`. The bake tools are the exception in one direction only: the geometry they write does ship, the library that wrote it does not.

| File | Responsibility |
| --- | --- |
| bridge/server.mjs | Optional local TCP/WebSocket bridge and static build server |
| tools/build-meshes.mjs | Ingests vendor/*.glb into src/asset-meshes.js |
| tools/mesh-read.mjs | Reads a vendored pack, GLB or OBJ, grouped by the palette role each material maps to. Its own module because two tools read these packs |
| tools/bake-assets.mjs | Composes new trees out of the packs already owned, into vendor/baked_assets/ |
| tools/bake-trees.mjs | Bakes redwood and fir variants with ez-tree (MIT, devDependency, never shipped) into vendor/baked_assets/. What ships is geometry, not a library |
| tools/grow.mjs | Grows the redwood grove from nothing -- no imported models, no generator library. Writes vendor/grown-redwood-forest/, which is NOT committed because grow.mjs reproduces it exactly |
| tools/grow-lib.mjs | The plant geometry that does the growing: triangles put together by hand |
| tools/asset-preview.mjs | A contact sheet for every model in vendor/, so choosing one is looking rather than guessing. Two crown models were once picked by reading file names and both were wrong |
| tools/glb-survey.mjs | Lists what is actually inside a pack's GLB files before anything is ingested |
| tools/tree-spacing.mjs | How close trees actually stand, measured against how wide their crowns are |
| tools/fetch-references.py | Pulls reference photographs from Wikimedia Commons into a scratch folder. REFERENCES, not assets: nothing derived from them is a copy |
| tools/package_release.py | Verified source/portable ZIP packaging and checksums |
| tools/make-icons.mjs | Draws the home-screen icons in `public/` from the brandmark path, through Playwright. Rerun only if the mark changes |
| public/ | Copied beside the page by the build: home-screen icons and `manifest.webmanifest`, for a HOSTED copy. The manifest is linked only over http(s) |
| tools/release.mjs | What `npm run release` runs: finds a Python under any of its three names, then runs the packager ONCE and exits with its code. A shell `||` chain cannot tell a missing interpreter from a failed packaging, which would hide the refusals the packager exists to make |

### Measuring it

Every one of these imports its geometry from `src/` and never reimplements it. Four measurements in this project have lied, and all four lied by recomputing the thing they were checking.

| File | Responsibility |
| --- | --- |
| tools/bench.mjs | Measures the generator across many courses in parallel; `npm run bench` |
| tools/bench-worker.mjs | One bench worker: builds the courses it is given and measures them there, because a generated world is full of closures and cannot cross a thread boundary |
| tools/metrics.mjs | What a course is measured on, and the rules that must stay at zero |
| tools/fixtures.mjs | The three fixture sizes a measurement runs over |
| tools/biome-fingerprint.mjs | THE ARBITER FOR `GENERATOR_VERSION`. Hashes each biome's record and its generated ground separately; only a ground change owes a bump |
| tools/profile.mjs | What a frame costs and what it is spent on. Minutes of a machine at full tilt -- run it deliberately. The `sun` group is the only one that turns the camera to the sun (`lab.camera` `look: 'sun'`, `pitch: 'sun'`), so the only one that sees the god rays' cost |
| tools/profile-probe.js | Injected into the page before anything else runs. Wraps WebGL and requestAnimationFrame from OUTSIDE the game, so it cannot be fooled by the app reporting on itself. A frame is every callback sharing an animation timestamp -- it once counted each callback as a frame, and the harness's own counting callback made every frame two samples (half the triangles, medians near the fastest frame). Anything that counts frames in the page may add callbacks freely now |
| tools/gpu-probe.mjs | Which GPU a Playwright browser actually got. Asked before anything is measured, because headless Chromium falls back to software silently |
| tools/smoke.mjs | `npm run smoke`. Opens the BUILT file by `file://` in a real browser and plays it: menu panels and every tab, an Endless hole from tee to holed putt to the next hole and a replay there, a Surprise-me nine, the range, a golfer building their own bag and a second golfer's bag taking over on their turn, the studio saving a course with its bar clear of an open panel at five sizes, whether every play-screen control can actually be clicked at five screen sizes, and (GPU only) that an Ultra course builds no lit shader after it appears, nor during its first shot; and (Phases 5-7, 14 October 2026) a challenge played out with nothing saved as a round, the course of the week started and remembering its week, and the look picker with a frame, a skin on the meter in play and a flourish drawn at a hole-out. Fails on any uncaught error, any `console.error`, and ANY network request. Drives by the names a player reads; uses `window.lab` only to look |
| tools/shot-sink.mjs | Somewhere for the game to put a screenshot of itself. The game photographs itself in whatever browser is open and posts the frame here -- no headless browser, no second rendering path |
| bench/baseline.json | The last saved measurement, for `--since` |
| bench/profile-baseline.json | The last saved frame profile, for `--since`. Re-saved 28 September after the probe fix; anything older counted every frame twice |
| bench/biome-fingerprints.json | The stored fingerprints, with the generator version they were taken at |
| tests/*.test.mjs | Node test-runner regression suites; no external test framework |

### Measuring the generator

**The grid's heights are computed on other cores (B2), and that rests on two things staying true.** Generation must be DETERMINISTIC -- each worker generates its own copy of the world from the same settings, so a world that depended on timing, `Math.random` or anything else outside the seed would give the workers different land from the main thread's. And the grid must go on being built only by `makeGroundGridSteps`: `makeGroundGridPooled` feeds that same function answers computed elsewhere in the order it asks for them, so a change to the grid builder is automatically a change to both paths, but a SECOND grid builder would not be. `lab.ground()` hashes the built grid and says how many workers built it; the hash must not depend on the workers.

**Per-point work in the ground grid is where generation goes** -- a million-plus samples on an eighteen. Anything asked of every point should be rejected cheaply first, by a world box around the region where the answer can be anything but "no" (`worldBoxOf` turns a rectangle in a hole's frame into one; see the refinement boxes, the basin boxes and the green-shaping skip in `course.js`). Such a shortcut must give EXACTLY the old answer, and `node tools/biome-fingerprint.mjs --check` is how that is proved: a shortcut that moves one sample moves the ground hash.

`npm run bench` builds many courses in parallel and reports what they came out like. Every metric shares one generation pass and the courses are spread across all cores, which is a measured 25x against doing it serially — the point being that measuring before and after a change has to be cheap enough to actually do.

- `node tools/bench.mjs --tier quick` — four courses, about seven seconds. For iterating.
- `node tools/bench.mjs --tier full` — thirty courses, about twenty seconds. For confirming.
- `--save` stores the run as the baseline, `--since` prints what moved.
- `--set blindTees=50` sweeps one control.

A world is full of closures and cannot cross a thread boundary, so each worker runs the metrics too and returns plain numbers. **A metric imports its geometry from `src` and never reimplements it** — four measurements in this project's history have lied, and every one recomputed the thing it was checking.

## Application modes

`appMode` is one of `menu`, `studio` or `play`, and `setMode` is the only way to change it. Studio has its own top-nav tab beside Play, and `syncNav` lights whichever tab matches the mode, so the studio never looks like Play with extra furniture; a panel that owns a tab (the scorecard) claims the highlight while it is open. The mode drives `#world`'s `data-mode`, which hides the play HUD in studio via CSS, and gates input: `takeShot` refuses outside play, and the keyboard and gamepad aim handlers do nothing outside it.

Generation controls exist **only** in studio and course selection **only** in play, which is what stops one mode quietly changing the other's state. A course owns its hole count, so the round panel no longer offers one; `startRoundOn(courseSettings, group)` merges a course over the live settings and builds the Round from `next.holes`.

While the menu is up the scene shows a **one-hole showcase** with the camera circling it. `loadMenuBackdrop` grows it as **hole one of a real endless run** — `endlessSettings(endlessHole(newRunSeed(), 0))` — and registers its world under the cache key `loadCourse` will later ask for, so choosing Endless adopts that seed and that world and starts playing the hole already on screen, with no regeneration and no overlay. That makes `endlessSettings` load-bearing and it must stay **idempotent**: `loadCourse` normalises settings through it on the way in, so if it were not a fixed point the world key would move, the cache would miss, and the player would watch a different hole appear than the one they picked. It lives in `endless.js` so both sides call the same function and it can be tested without a DOM. Menu holes therefore vary 135–615 yd by par shape rather than being a fixed 420. It uses `holes:1`, which `planCourse` and `generateWorld` accept purely for this purpose — nine and eighteen remain the only choices a player sees, and `holes` stays a two-option field in the schema. It builds in about a quarter of a second against roughly two for a nine, so opening Fairway no longer grows a course nobody asked for. A saved round is parsed at boot but held in `pendingRound` until the player chooses Continue; `leaveBackdrop` is what makes the next `loadCourse` build the real thing. Panels opened from the menu hide the overlay and keep `appMode` at `menu`, so the play HUD stays hidden behind them.

Studio keeps a throwaway single-player Round alive so the renderer, camera, map and surface queries all keep working — only the play HUD is hidden. It opens in free flight with no panel over it: keys are ignored while a panel is open, which they must be because the seed field is a text input, so auto-opening the settings panel meant the studio always started with its camera parked. That throwaway Round is also why leaving matters — `guardStudio` wraps every route out (both nav tabs, the brand, Leave studio and the course-info menu) and offers save, discard or stay. It treats the landscape as saved when any library course was generated from exactly these settings, so a course loaded from the library and left alone does not nag. Nothing regenerates on a slider change: a rebuild is seconds of frozen tab, so edits set `studioDirty` and the studio bar says so until **Regenerate**.

**COURSE STUDIO'S SETTINGS TAKE THE PLAY AREA** (the owner, 15 October 2026): `.drawer[data-panel=course]` runs from the top of `#world` to the bottom, and in the studio the same observer below sets its `top` to where the course starts plus the bar's full height plus 28 px -- measured from the sheet's own box, because the sheet's containing block is the page, not `#world` (the first version wrote the bar's height alone and slid the sheet under the top bar), so the bar sits in a strip above it, exactly where the lift puts it, and never goes `compact`. With no bar (the setup sheet over the menu) it goes to the top. Only this panel; the owner chose to leave every other window alone. The `studio` smoke journey checks the sheet leaves no course showing besides that strip, desktop to phone.

**THE STUDIO BAR RIDES ABOVE AN OPEN PANEL.** The bar and every panel (`#drawer`) are both pinned to the bottom of the course, the bar one layer up, so until 12 October 2026 any panel opened in the studio had its lowest rows and buttons under the bar. A ResizeObserver in main.js (on `#world`, `#drawer` and the bar, written a frame later as layout.js does) sets `--panel-lift` on the bar to the open panel's height; where the room left above the panel cannot hold the bar plus 26 px — a phone on its side — it adds `compact`, which drops the caption and the button words (the words stay in the DOM as accessible names). **Rejected:** hiding the bar while a panel is open, because Regenerate is the button the Settings panel tells you to press and must be in reach beside the sliders. The bar also takes `width:max-content`: centred with `left:50%`, an absolute box shrinks to half the screen, which stacked its four buttons one per row on a phone held upright. The `studio` smoke journey opens Settings at five sizes and fails if the bar overlaps the panel, leaves the course, or has a button that cannot be clicked. **What breaks if this is lost:** a panel's bottom row is unreachable in the studio, which no play-screen check sees. `applyStudioSettings` reads every rendered control and validates the whole object before a rebuild starts, so a bad combination is refused in milliseconds rather than after ten seconds of terrain.

`setMode('play')` restores the camera when it finds free flight. `setUpTurn` no longer swaps the camera mode at all (see the putting-camera note below), so without that a round entered from the studio starts in free flight and silently refuses every shot.

## Data flow and units

**THE SPLASH LIVES IN `index.html`, NOT IN SCRIPT.** Boot builds the renderer, restores a saved round and grows the menu backdrop before `openMenu()` stamps a mode on the shell, and until that stamp lands the play HUD is what is on screen over an empty canvas. Anything script builds arrives after the span it is supposed to cover. `dismissSplash()` runs after `openMenu()` AND in the fatal handler -- drop the second call and a WebGL failure shows a black screen with the explanation hidden behind it.

**CAMERA MOVES FLY; THEY DO NOT CUT.** `setCamera` snapped whenever the move exceeded sixty metres, which is every move worth watching. `view.flyCamera(p, aim)` resolves the destination by calling `setCamera` itself -- there is one definition of where the play camera stands and a second copy would drift -- then flies there along a path from `makeCameraFlight`. While `camFlight` is set the renderer drives the camera outright and the damping is switched off, because a spring and a path fight each other and round off the path's ends. `setCamera` and `follow` both clear it: an explicit reposition wins, and a ball in the air outranks a camera move.

**A FLIGHT CLEARS THE CANOPY, NOT THE DIRT.** Trees reach 29 m on this generator and are not in the height field, so a path that clears `world.height` alone flies through them. The floor is terrain or canopy, whichever is higher, from `world.trees` filtered to a box around the route. The clearance TAPERS TO NOTHING at both ends on purpose -- a flight ends on a player camera a metre and a half off the turf, and an untapered floor would tell it that pose is metres too low and start by rocketing upward.

**A SPECIMEN IS THE ONE OBSTRUCTION ALLOWED ON THE LINE OF PLAY.** `blocksLaunch` takes a `within` argument for this: scatter planting is judged over the whole carry, a feature only over the near stretch (`FEATURE.standoff`). An oak in the middle of a fairway is supposed to be on the line -- what makes it fair is `FEATURE.gap` of open grass down one side, not an empty centre. The scatter tests run with `fairwayFeature: 0` deliberately; leaving features on would have them forbid the thing that feature exists to build. Feature trees ride in `world.trees` and feature stones in `world.rocks`, both marked `feature`, so they draw and collide through the paths everything else uses.

**EVERYTHING SOLID IS A VERTICAL CYLINDER IN ONE INDEX.** Trunks, boulders and lit floodlight masts all go through the same swept-circle test in `simulateShot`; an obstacle supplies `radius` or falls back to `trunkRadius`. Do not add a second collision routine. **Haunted Hollow's pumpkins and toadstools are `world.props`, the same cylinder as wide as their model (`PROP_MODELS` in species.js, measured).** **Boulders are `world.rocks`, generated in course.js** -- they used to be placed by the renderer, which is exactly why nothing could collide with them, and the renderer now READS that list. **Masts are passed in through `options.poles`** and only when `view.floodlit`, because the floodlight group is hidden otherwise and colliding with an invisible mast is worse than not colliding with a visible one. **Flagsticks come in through `options.flagsticks`**: every hole's stick at its regulated base radius, this hole's only while it is in; a strike counts as `flagHits`. Deadfall is decorative by decision, not oversight. Houses are the one exception to the cylinder, an oriented box in the same loop, and **A HOUSE'S ROTATION IS A WORLD ANGLE**: `toLocal` moves a house's centre into the hole's frame but not its angle, so in that frame it is turned by its rotation less the hole's. Until 13 October 2026 it was not, and a third of every house on a turned hole disagreed with the drawing; the box also stood 2.6 m above the roof. `tests/solid-colliders.test.mjs` fires real shots at the drawn walls and roofs.

**THE FINGERPRINT HASHES AN EXPLICIT LIST.** Anything new that a player can see and that generation decides has to be added to it, or a change to it goes unnoticed forever. Rocks were missed for exactly as long as they were a render-time invention.

**NO BACKTICKS INSIDE ground.js SHADER COMMENTS.** The fragment shader is a JS template literal, so a backtick in a GLSL comment ends the string and breaks the module -- the failure reads as a syntax error hundreds of lines away, at whatever the parser hits next. This has now happened three times in this project.

**`groundPoint` IS OBJECT SPACE AND `cameraPosition` IS WORLD SPACE.** They coincide only because the course group and the terrain mesh both carry an identity transform. Any view-dependent shader term relies on that; put a transform on either and those terms silently start lying.

**THE GROUND SHADER IS A CHAIN OF `.replace()` CALLS, AND EVERY LINK IS LOAD-BEARING.** ground.js builds the fragment shader by replacing three of three.js's own `#include` anchors: `common` carries helper functions at GLOBAL scope, while `color_fragment` is inside `main()` and carries statements. `FRAGMENT_ANCHORS` in the structure test is the list, and it shrinks when a link is retired -- `normal_fragment_maps` was one, dropped when the sun cue stopped touching the lighting normal. Delete a link and its block does not vanish -- it is appended to whichever chunk precedes it. That is how the whole body once ended up at global scope, where `vec2 wp=groundPoint.xz;` is a non-constant global initialiser: GLSL refuses it, the program fails to link, and every draw raises INVALID_OPERATION, so THE GROUND SIMPLY DOES NOT DRAW. Nothing else catches it -- `node --check` passes, the bundler passes, the whole suite passes, and the app boots with no fatal card, because a shader failure is not a JS exception. `tests/ground-shader-structure.test.mjs` checks the chain and that each anchor still exists in the three version in use.

**NEVER EDIT A SHADER WITH A SCRIPTED REPLACE WHOSE REPLACEMENT YOU HAVE NOT PRINTED.** This was caused by a line that evaluated to `s.replace(anchor, '')` -- an accidental empty replacement that silently deleted a chain link while printing a success message.

**A UNIFORM CAN BE FULLY PLUMBED AND STILL DEAD.** Declared, written, exposed on a slider and reported back correctly -- while nothing in the shader body reads it. `greenBandSoft` shipped that way for two commits. `tests/green-cue-wiring.test.mjs` reads ground.js and fails if any cue uniform is never referenced; keep new cues on that list. And when deleting a shader block, delete the BLOCK -- not the span between two anchors, which is how the line using greenBandSoft went with it.

**THE TOON RAMP PINS A FLAT SURFACE, SO LIGHTING-BASED CUES DIE AT MIDDAY.** The ground is a `MeshToonMaterial` with a four-step ramp (90, 145, 205, 245), sampled at `dot(normal,light)*0.5+0.5`. Texel centres sit at .125/.375/.625/.875, so anything past .875 is clamped flat -- which a near-flat green reaches above about 48 degrees of sun. Tilting the normal the LIGHTING uses therefore does nothing in daylight: measured brightness span across a green was 0 out of 255 WITH and WITHOUT the cue at 50, 65 and 80 degrees. That was the first fix attempted and it is a dead end in this art style. Any cue meant to show shape has to modulate the turf COLOUR instead. The one that carries a green now is the grass sheen (`cueSheen`), which depends on where the VIEWER is rather than where the sun is, so it works at noon; the sun-based `greenSun` measured 0.2 of 255 at midday and was removed (RESEARCH.md *Reading the ground, again*). Ground shading takes its bearing from the `sunDir` uniform, which the renderer refreshes in `updateDaylight` whenever the clock moves and seeds again in `setGroundCues`. Bump `customProgramCacheKey` whenever the shader body changes.

**A SAVED GRAPHICS RECORD BEATS A NEW DEFAULT.** Graphics settings persist, so anyone who has opened the panel carries the old numbers and changing `GREEN_READ` alone reaches nobody. Raise `GREEN_READ_GEN` and every saved record adopts the new defaults once, while anything the player sets afterwards sticks. Rescaling a slider counts as a new default: slope darkening (since removed) was once halved so 50 meant what 100 used to, and without the gen bump every existing save would have kept reading the old number at twice the intended strength. Removing a setting needs no migration -- `clean()` only copies the keys it knows, so a removed key simply drops out of a saved record.

**BUILD A SLIDER WITH `slider()`, NEVER BY HAND.** `wireSliders` wires every range in a panel to an output named `<id>Value` using the input's own `data-unit`, and `slider()` emits both. Hand-written markup that names the readout anything else leaves wireSliders looking up nothing -- it used to throw on EVERY input event while the slider itself still worked, so the only symptom was a console filling up. Three older sliders (`labFirmness`, `labStimp`, `timeHour`) have no readout at all, so the lookup is guarded now; the guard is not optional.

**A CONSOLE FULL OF ERRORS IS EVIDENCE, NOT NOISE.** These were visible during verification and were written off as a stale buffer from a probe script. They were real, and a player found them. When the same error survives a reload, reproduce it deliberately before deciding it is old.

**THE GREEN CUES ARE GRAPHICS, NOT GENERATION.** `greenDefinition` and `greenBands` live in graphics.js with the other ground cues, persist to localStorage, and write uniforms live -- no rebuild, no recompile, no generator bump. `greenCues()` is the ONE mapping from slider to uniform; the panel, the renderer and `lab.greenRead` all go through it so they cannot drift. Definition 0 must keep returning lift 0 / bend 1 / bands 1, which is the old look exactly, and there is a test on both ends of that.

**A TEST SUITE CANNOT SEE A MISSING IMPORT IN renderer.js.** Nothing in the suite loads it, so `node --check`, the bundler and all 494 tests passed while the app died on boot with the fatal card. Any change to renderer.js or ground.js gets opened in a browser before it is called done.

**A GREEN HAS THE LEAST SLOPE AND NEEDS THE MOST READING.** Every shading cue is proportional to slope, so the flattest surface on the course gets the weakest cue -- measured at half the brightness range ordinary terrain gets. When strengthening it, EXAGGERATE THE NORMAL rather than raising the gain: gain clips against the clamp so steep ground saturates and gentle ground stays invisible.

**OUTLINE HARMONICS ARE SCALED AT GENERATION, NEVER AT READ TIME.** A green's radius and a bunker's are `size * (1 + harmonics)`, and the GLSL in ground.js carries the SAME formula -- three waves for a green from the route texture, two for a hazard from `meta.z`/`meta.w`. Both textures pack whatever the hole and the bunker carry, so scaling the stored values keeps paint and lie as one set of numbers. Scaling in the shader would put the arithmetic in two places, which is how the apron was painted as fairway and played as semi-rough. `meta` is a FULL vec4 -- adding a third bunker harmonic means changing the hazard texture layout.

**ONE HARMONIC MUST NEVER OWN THE OUTLINE.** `spreadHarmonics` pulls the waves toward equal as a shape slider rises, and it is not cosmetic: the three-lobed wave is drawn always-positive and largest, so it leads on 69 of 81 greens, and amplifying the drawn mix turns that into a clean three-lobed flower -- two lobes and a shaft once the aspect stretches it. Do not "simplify" this back to a plain scale.

**THE AMPLITUDE CAP IS A SAFETY RULE, NOT A TASTE ONE.** `GREEN_SHAPE.cap` (0.34) and `BUNKER_SHAPE.cap` (0.30) bound the sum of the harmonics so the radius stays positive; past them an outline folds through itself and every distance test reading it starts answering nonsense. A green-side bunker is fitted to the green AFTER its outline is scaled -- reverse that ordering and a raggeder bunker eats into the fringe the fit exists to protect.

**A GREEN'S SHOULDER DOES NOT FOLLOW ITS OUTLINE.** It is blended on the nominal size, so a shaped green that bulges outward has less room for its shoulder and gets steeper ground around it. Measured and filed; any test that samples 'just outside the green' must march out using `greenDistance` rather than assume a fixed radius.

**THE TEE FAN IS COMBINED; THE SHOT TEST IS PER TEE.** `blocksLaunch` judges each tee's own line and is height-aware. `teeFans`/`inTeeFan` refuse planting inside the convex hull of ALL THREE tees' wedges and ignore height, because a tree the ball flies over still blocks the view from the back tee. Keep them separate: merging them would either let trees into the view or start rejecting shots that are fine.

**THE VIEW TEST IS FOR WHAT CAN BE LOWER THAN THE EYE (12 October 2026).** Bushes (the `GROUND_PLANTS`, 0.8-2.9 m) were exempt from both tests above -- the planting line read `if(!small&&(...))` -- and houses were kept only 28 m from each tee in a circle, so both stood between golfers and their landing areas: 232 bushes and 4 houses on 12 planted courses. The fan cannot simply be applied to them, because it ignores height and ankle-high cover in front of a tee is wanted. `blocksView(corridors, x, z, topY, pad)` asks the real question: inside a tee's own forward wedge (the fan's `FAN_NEAR` and `FAN_ANGLE`, per tee), does the top rise above the line from the eye (`TEE_EYE`, 1.6 m) to the ground at the target (`aimY`, now carried on each launch corridor)? Planting refuses a bush on it (`r` as the pad); house siting refuses a house on it at the tallest a house is built (11 m) and half its footprint's diagonal, through a callback, because homes.js cannot import course.js (course.js imports it). The launch corridors are therefore built before the houses now -- pure, so moving them changed nothing. On a downhill hole whose ground near the tee already rises above that line, any bush there counts as blocking; that only refuses cover where the view is already marginal. `teeclear` carries `bushInTheTeeView` and `houseInTheTeeView` as invariants; trees, which the fan refuses outright, are not re-judged by this.

**GREEN SURROUNDS ARE ASYMMETRIC ON PURPOSE.** `greenApproaches` gives each green the direction its shot comes from, taken from the middle of the hole 70 m short so a dogleg is handled. `GREEN.open` protects that arc at EVERY setting of `greenTrees`; the slider moves only the back and flanks. Note mown ground reaches about 24 m from a green centre, so a keep-out below that does nothing except remove the taper -- which is how the first tuning produced a wall at 266% of course density. And `greenApproaches` is NOT `greenGuards`: that name is already a local inside generateWorld and silently shadowed the export.

**`nearest().d` IS SIGNED, AND IT IS NOT THE MOWN EDGE.** It measures distance outside a hole's corridor ENVELOPE, which near a tee is far wider than the turf anyone mows -- 99% of the rough around a tee sits at a NEGATIVE d, as deep as -34 m. A rule of the form `d < k` therefore bans the whole tee surround while `surface()` is calling that same ground rough, and that is exactly what made tee boxes read as clear-cut. `EDGE` in course.js ramps acceptance instead of stepping it, with its own negative-distance ramp near tees. A hard step also produces a PILE-UP: refused candidates get pushed outward and bunch at the boundary.

**A TEE SHOT OWNS ITS LAUNCH CORRIDOR.** `blocksLaunch` in course.js refuses anything standing where the nominal shot would pass through it, and world trees, rocks and deadfall all consult it. Three things about it are load-bearing. It is a WEDGE THAT ONLY LOOKS FORWARD, because trees beside and behind a tee are wanted -- they give the box something to sit in and hide the terracing basin. It aims along `fairwayAim`, NOT `teeAim`: teeAim is the bearing the tee pad is squared to and on one hole it pointed 35 degrees away from the played line. And it tests HEIGHT, not a fixed length -- a fixed 90 m wedge let an 80 m fir through at 118 m while needlessly refusing boulders the ball flies thirty metres over.

**A PAR THREE IS PLAYED TO THE GREEN.** Any harness that checks the tee shot must carry to the target the hole actually sets. Firing a constant 210 m measured trees behind the green on par threes and reported them as blockers -- 14 false failures in one pass.

**NEVER ASSUME A CANOPY HEIGHT; ASK `canopyTop`.** A comment in camera-tours.js said trees reach 29 m. Redwoods top out at 186 m on this generator, and that stale number put the arrival camera 40 m inside a tree. `makeHoleTour` still carries the same assumption and orbits 91 m inside a redwood canopy -- filed, not fixed, because lifting the ring changes the shot. Any new camera work asks the trees.

**GENERATION YIELDS; `generateWorld` STILL DOES NOT.** `generateWorldSteps` is the generator and `generateWorld` is a synchronous drain over it, so the tests, the bench and the fingerprint tool are unaffected and MUST STAY THAT WAY -- a test that awaited generation would be testing the driver. The app goes through `generateProgressively` in main.js, which paces against the frame clock. Adding a yield anywhere new: it must sit BETWEEN rows, never inside one, or the fingerprints move.

**`prepareWorld` AND `loadCourse` MUST KEY ON THE SAME THING.** Both call `settleSettings`, which is why it was extracted -- `prepareWorld` builds the world into the cache and `loadCourse` reads it, and if the two ever compute a different key the cache misses silently and a different course appears than the one chosen. `settleSettings` is safe to run twice on purpose; the yardage rescale inside it stops applying once `settings.holes` equals `round.holes`.

**PACING IS NOT FREE AND A HIDDEN TAB IS NOT PACED.** See RESEARCH.md for the budget table. The driver checks `document.hidden`: a background tab fires no frames and clamps timers, so pacing it would turn an eight-second course into minutes.

**GENERATION IS 81% `makeGroundGrid`,** measured, so yielding between phases would buy almost nothing. See RESEARCH.md. A Web Worker cannot take it: `generateWorld` returns closures.

**CHECK APEX, NOT ONLY CARRY, WHENEVER THE AERODYNAMICS MOVE.** A ball with too little lift flies flatter and a flatter ball carries less induced drag, so the two errors cancel in carry and leave it looking correct. That is exactly how `liftCap` held every shot of a GC3 session 8% low while carry agreed to within 1.4%. Apex, descent angle and hang time are the quantities that catch a shape error; carry alone cannot.

**THE FIRMNESS TESTS PIN A 7-IRON'S ARRIVAL ON PURPOSE,** so a flight refit does not read as a bounce regression. Change the aerodynamics and `ARRIVAL`, `WANT` and `LADDER` in `tests/firmness.test.mjs` all need re-deriving -- the test that compares flying the ball there against delivering it there exists to tell you so. When re-deriving, take spin from the LAST AIRBORNE sample: the simulator applies the bounce and records it in the same step, so the first sample at ground level is already post-bounce and reads about a sixth of the real value.

**FRAME COST IS MEASURED BY `npm run profile`, AND PACING IS NOT COST.** `tools/profile.mjs` drives a headless Chromium and instruments WebGL from outside the game. It measures the time spent INSIDE the frame callback plus a GPU timer query spanning it -- never the interval between frames, which in headless Chromium is a virtual 60 Hz display whatever the vsync flags say. It proves that property on a blank page and refuses to report if it fails. Two arms: the real GPU for headroom, a software rasteriser for 'no graphics card'. Run `npm run gpu` if you doubt which you got -- default flags give SwiftShader silently. The one exception to the rule: on the software arm the interval IS the measure, because its work happens off the main thread after the callback returns.

**A HITCH THAT COMES EVERY 200 MS IS NOT THE GAME'S.** Something on the development machine (not identified) sometimes produces a burst of 25-100 ms frames at exactly 5 Hz for a whole sample, in any biome, about one run in four, and lifts the median 1-2 ms with it; and one browser kept across a sweep makes later cases worse. Haunted Hollow was reported at twice its real cost because of it (RESEARCH, *Frame cost, measured -- and the hitch that was not ours*). Before blaming content for a hitch, record WHEN the slow frames happen (`window.__prof.frames` gives the gaps) and re-run in a fresh browser; a hitch the content causes lands at the same moment every run, as Giant Redwood's does.

**AN UNCAPPED PROFILE SHOWS STALLS A PLAYER DOES NOT SEE.** `tools/profile.mjs` turns vsync and the frame-rate limit off, so frames queue up behind the graphics card, and a large upload landing in that queue stalls Chrome's GPU process. The redwood course's 157-195 ms "hitch" at the start of the opening descent is exactly that: the instance cull's rebuild (every 4 m of camera travel, about 83,000 instances and 6.7 MB on that course) colliding with queued frames. At normal 60 fps pacing it does not happen at all. Before acting on a worst-frame or p99 figure, run the case once at normal pacing; and when a stall appears, the frame that waits is rarely the frame that caused it -- look at what the frames before it uploaded (RESEARCH, *The redwood hitch: an uncapped-profiler stall*).

**GRAPHICS TIERS MAY NOT TOUCH A PLAYED SURFACE,** which is why none of them thins the planting even though vegetation is what the frame is spent on. Trunks are collidable; two players on different tiers must hit the same trees.

**A HOLE'S SKELETON BELONGS TO `course-plan.js`, NOT THE BUILDER.** `holeLine` computes the playing line, the length and the tees from the seed alone, and both `generateCourse` and `planScorecard` call it -- so the card shown before a course is built and the course that gets built cannot disagree. It consumes a contiguous prefix of the hole's seeded stream and the order of the draws inside it is load-bearing: one added, removed or reordered moves every pond, bunker and contour on that hole. There is one seeded generator, exported from `course-plan.js` and re-exported by `course.js` as `random`; do not add a second.

**HOLE LENGTHS ARE BOUNDED BY PAR** (`PAR_YARDS`), and the course length is distributed by water-filling inside those bands rather than by scaling every hole. A requested total the bands cannot reach is clamped, and `plan.yards` is what the course measures while `plan.requested` is what was asked for.

**SCREEN BEARINGS ARE COUNTER-CLOCKWISE, CSS ROTATION IS CLOCKWISE.** Everything angular in this codebase is `atan2(x, z)` -- wind direction, camera heading, aim -- and looking along +z puts local +x on the LEFT, which `mapPoint` depends on. Any of those bearings driving a CSS `rotate` has to be negated. A test written against the easy case cannot catch this: wind downrange with the camera looking downrange is zero either way round, so the mirror only shows when the camera leaves the axis.

**`project` is not safe for a marker.** It reports whether a point is in the depth range and nothing about the sides, and behind the camera the perspective divide is by a negative w, so both axes flip and a label lands on the opposite side from its subject. Use `projectMarker`, which reads front-or-behind from camera space and clamps to a rectangle the caller measures.

`main.js` loads/validates settings and a Round, builds `generateWorld(settings)`, selects `world.holes[round.hole]`, and passes the world to the renderer. A hole contains playing-local geometry/functions and `toWorld`/`toLocal`. The Round stores current golfer/team lies in the current hole's local coordinates. Three meshes and the full-course map use world coordinates; the hole map and physics use local coordinates. Never mix these implicitly.

One scene unit is one metre. Physics uses metres, seconds, kilograms and radians internally; manual/monitor launch interfaces use degrees, mph and rpm where indicated. `YARD = 0.9144`; a foot is 0.3048 m. Golf ball radius is 0.021335 m and cup radius is 0.053975 m. Do not enlarge the physical ball to make it visible; use visual rings/tracers instead.

Playing-local +z points down the initial hole line. +x is screen-left in the standard shot view. For hole rotation θ:

```
worldX = originX + localX*cos(θ) + localZ*sin(θ)
worldZ = originZ - localX*sin(θ) + localZ*cos(θ)
```

Aim keyboard directions account for that handedness. Course-wide wind is transformed into each hole's local frame before flight. Camera horizontal offset translates position and target together to retain the original viewing direction. Ball tracking centers the flight; returning from free flight resolves a putting view when the current lie is on a green.

## Generation pipeline and important invariants

1. Merge defaults, plan seeded par mix/yardages, and create local holes. Fairway edges have independent smooth width control points, variable starts and tapers. Generate green contour/outline, tee pads and hazard candidates.
2. Route all holes together. Multiple seeded trials evaluate candidate positions/rotations, walking distance, footprint proximity and corridor overlap. If packing fails, expand the footprint. The icons describe **intended** shapes, not guaranteed exact silhouettes. Individual holes remain procedural.
3. Build biome landforms around all corridors. Shape tees and greens with continuous support, not by switching height functions at nearest-hole boundaries. Green surroundings now blend over 40–100 m depending on height difference; modifier bounds must contain the full support or seams return.
4. Settle the ground to a level shelf under every pond before fitting basins. `pondSites` reads each target off `land` (the base landform) and eases the surrounding ground toward it inside `shapedLand`, **before** the green/tee modifiers, so those still override it and a pond can never flatten a green. Then request large lakes in open ground before fitting all pond/lake basins. `lakes.js` searches seeded candidates outside playing corridors and within course bounds, prefers gentler low ground, and appends accepted profiles to a nearby hole. Each hole has at most four pond slots in the GPU atlas. `world.largeLakes` and `lakeOwner` override nearest-hole ownership for large features that extend across ownership tiles. Fit ponds against actual shaped land. Sample rim elevations; shrink a pond with excessive rim spread and reject one that still cannot fit. Select a flat level below the low rim and outer-bank samples. Use a broad smooth bank transition and excavated basin. Keep the same `hazardProfile`/`ovalRadius` data in water outlines, terrain, ground shader, surface queries and maps. Do not restore a center-height-only water level.
5. Solve the land's drainage once, then read every channel off that one answer. Greens, tees, bunkers, fitted ponds and the playing corridors are RAISED in the working height field rather than steered around, so water flows past them the way it flows past a hill and each route stays a pure descent. Meander is applied afterwards as a bounded lateral offset, never as a rotation of the heading. See "Watercourses that follow the land" in RESEARCH.md, which records two earlier path-based attempts and why both failed the same way. Legacy note, since the code no longer does this: channels used to draw their own bearing, three harmonic wavelengths, amplitudes and phases; a single shared bearing made rivers and creeks offset copies of one curve. Obstacle avoidance picks the passing side once per obstacle from the undisturbed line, then applies a low-passed displacement built from a Gaussian whose amplitude is inflated 1.45x so the detour clears the obstacle radius while staying smooth. The previous hard clamp snapped the corridor to a flat-top envelope and produced a trapezoid with a corner at each influence boundary. Two Chaikin passes and a curvature relaxation follow, holding the bend radius above roughly 1.8x the channel width so the bank strip cannot fold; stations end up about 2.6 m apart. Routing tries a generous sand berth, then a tight one, then sand-blind; `generateWorld` washes out any bunker a sand-blind channel crosses, and must drop that bunker's basin with it or the terrain keeps an unexplained bowl. Paths may cross fairways; unsuitable paths are skipped after bounded attempts. Each candidate is graded in both directions; choose the direction and route requiring less excavation. Station levels remain below the sampled ground, descend at least 0.015%, and have a maximum longitudinal grade of 2.5%. Recompute normals after reversing stations, then compute the mitered offset scale. Wide valley shoulders blend into the terrain, with pond rims/tees/greens protected. A spatial index supplies channel membership, width, level and bed depth. Carving and water rendering use the same stations.
6. Build a connected adaptive ground mesh: roughly 3 m background spacing, six subdivisions per refined cell (about 0.5 m). Refine greens, bunkers, lake shorelines and channels. Transition triangles share vertices with refined cells. `groundHeight` uses barycentric interpolation on these same triangles, including transition fans. Physics must not use an unrelated smooth height field while rendering this mesh.
7. Place homes only on rough, dry, gently sloping sites away from tee/green complexes; space homes apart and exclude trees from their footprints. Populate biome vegetation and conifer straw patches. Ground cover is shared with vegetation generation.

Current housing controls: enabled flag, density and setback from semi-rough. River controls: river count 0–2, creek count 0–3, independent widths, depth, meandering. Creek depth is 60% of selected channel depth. Large-lake controls: count 0–3 (`lakes`) and typical diameter 60–460 m (`lakeSize`, default 160); use the existing pond depth range. Ordinary ponds span roughly 90 m on average, so lakes exist for genuinely large water rather than for merely bigger ponds. Pond banks sit a fixed gap outside the fairway edge and grow outward, so enlarging a pond moves it away from play; enlarging `rz` instead extends it along the hole and is limited by hole length. At the top of the lake range, corridor clearance leaves room for well under half the requested lakes on a nine-hole course. Homes, streams and large lakes default off to preserve an ordinary course until selected. Counts are upper targets: terrain constraints can produce fewer.

### Invariants a generated course must satisfy

These are asserted by `npm run bench`, which prints each as a rule that has to stay at zero and names the offending course when one does not. They are not preferences.

- No tee sits below the tee in front of it. No tee pad lands on a green, in water, in sand, or on another hole. Every marker stands on some pad.
- No channel station falls inside a fairway, on a green, or inside a pond or lake it did not create.
- No pond crosses a fairway. No two water bodies overlap.

Three more hold by construction rather than by a check, and breaking them is how the corresponding bug comes back:

- **A channel cannot cross itself**, because every step of its route is strictly lower than the last. Applying meander as a rotation of the heading destroys this — a rotation integrates and a constant bend is a circle. The measured result was 12 to 19 full circles per channel.
- **A corridor ridge must keep rising inward.** Clamping the corridor distance at zero gives every point inside a corridor the same raise, and a constant offset preserves the gradient underneath it exactly — the corridor becomes a plateau water runs straight through.
- **Paint and lie are decided separately.** The ground shader classifies from corridor geometry and never calls `surface()`. A change to one that is not made in the other produces a perfect measurement and no visible change, or a visible change the ball does not feel. `TEE_PAD`, `TEE_APRON`, `TEE_ROUND` and `teeBox` are shared between the two for exactly this reason.

### Tees are sited, not placed

A hole commits to a rough tee area before any terrain exists, because everything else on the hole is built from it — where the fairway starts, where ponds and bunkers go. Once the land exists each pad is re-sited: it tries a few dozen nearby positions and takes the one the ground already suits, scoring flat ground, a clear shot line, sitting above the tee in front of it, and lateral separation from its neighbour.

The bounds matter. A pad may move freely across the hole and up to 20 m along it, which keeps the hole's committed geometry intact; yardage is recomputed from where the tee actually ends up, so the card cannot lie about the hole.

Two things are easy to get wrong here and both have been:

- **The facing must be computed after siting, not before.** A tee squared to the shot from where it used to be is squared to nothing.
- **The blindness check must read terrain that includes tee pads**, and must cast from the real tee position. Reading the pad-free field makes it structurally unable to see the tee box in front of it, which is the one thing players notice.

The pad (the ground) is separate from the tee marker (where you stand). A marker can carry a pad of its own size and position, or none at all and stand on a neighbour's.

**Known scope:** houses are solid — `simulateShot` resolves an oriented-box overlap and reflects only incoming motion, so a ball against a wall stays playable. Bouncing costs nothing; the optional `residentialOB` setting adds a penalty stroke and is off by default and off for every migrated course. Streams have monotonically descending profiles and smooth valley cutouts, but are not a drainage/hydraulics solver or a connected tributary network. Because levels only descend, a channel is trimmed to the longest run whose bed stays within `MAX_CUT` of the ground beside it and faded out at a trimmed end; a route that cannot hold a long enough run is rejected, so a steep course can end up with fewer channels than were requested — `shortfall()` surfaces that. Tee pads terrace against the shaped field rather than the raw landform, on a ramp that widens with the drop it absorbs; the pad height itself is sampled once per tee. Two separate anchors decide where a hole's corridor begins: `mowStart` is where mown turf starts and is what `fairwayWidth`, the ground shader and both maps read, while `fairwayStart` stays the hazard anchor for bunker and pond placement. They are equal on par fours and fives and diverge only on par threes, which get a short green approach rather than a fairway — move the wrong one and a par three silently loses its hazards. `TEE_PAD` and `TEE_APRON` in course.js size both the pad and its mown collar, and ground.js interpolates the same numbers into the shader — change them in one place only. The collar shifts trees and houses back, since both site themselves off the classified surface. A channel is still a segment strip rather than a constrained bank/water triangulation; tight-bend folding is prevented by the generation-time curvature cap, not by the mesher, so re-check that cap before widening rivers, raising meander amplitude or adding confluences. Channel geometry carries three vertices per station — both banks and a centre — with a `shore` weight that feathers the surface alpha at the waterline; ponds, lakes and the ocean supply no such attribute and fall back to the WebGL default of 0, so they still end on a uniform alpha at their shoreline. There are no footbridges. Every pond, lake and stream is the same material and reflects its own surroundings from a cubemap probe captured where that body sits. There is no planar mirror and nothing is chosen between bodies, so water cannot change character as the camera moves. What this gives up is parallax: a probe is taken from one point, so its reflection does not shift as you walk the way a mirror's would. Ripples are generated in the shader and stream flow is a single direction along the channel; neither represents simulated flow velocity. See TODO.md for improvements.

## Firmness is a separate axis from speed

`firmness.js` owns it. The value is TruFirm/GS3 penetration in inches — lower is firmer — and it rides in the turf config beside `stimp`, so it reaches every physics call site the same way. `turfConfig` accepts a preset name or a number and normalises to a number; anything unrecognised reads as Normal rather than throwing, because an old save has no firmness at all.

**The four preset depths are the USGA's published GS3 bands and are not free to move.** They are not tuning knobs: each one sits on a named band from Green Section Record vol. 62 no. 22, the bands are quoted in RESEARCH.md (the page 403s to automated fetch; the saved copy is local, under `docs/sources/`, and not in the repository), and a test asserts each preset is still inside its band. If a setting feels wrong, change the *multipliers* — which are the unanchored part — rather than sliding a depth off the band it is named for.

**Normal is exactly the model that was there before.** All three multipliers are 1 at `NORMAL_FIRMNESS` by construction, asserted by test. That is what pins the scale, and it is why an existing course plays precisely as it did — get this wrong and every saved round changes underneath its owner.

It feeds three constants in the bounce: restitution (square root of the depth ratio — restitution is a velocity ratio, energy is its square), Penner's contact tilt (proportional — the same crater read as an angle), and the Coulomb grip limit (weakly, to the 0.35 power).

Three things it deliberately does **not** touch, each for a reason worth keeping:

- **Sand.** `firmnessApplies` excludes it. A bunker is not turf and the instrument is not used on it.
- **The cup, the rim and the putt skid.** The rim's rolling resistance derives from the green's Stimp, and a Stimp reading is taken on that green — it already contains that green's firmness. Multiplying again double-counts. The skid constant is separately anchored to a measured 15% skid share.
- **Rolling deceleration.** Left to Stimp and the turf-roll settings so the axes stay independent, which is what lets weather drive them separately later.

Course setting: four names in the turf panel. The lab drives the raw number, because the point of the lab is the ground between the presets.

## The lab is an instrument, not a mode

**The mode is gone.** There used to be a `labMode` with its own world (`LAB_SETTINGS`), a floating `#labBar`, a menu entry, twelve putt presets and four approach presets. It was removed on 2026-09-15 and the driving range took the job. The reasoning: the lab's world had already been redefined as the range (`LAB_SETTINGS` was `{...RANGE_SETTINGS, seed:'LAB'}`), so the mode was a second front door onto the same flat bench, carrying a second HUD, a second set of turf controls, a second shot-entry box and thirty-six `labMode` branches through `main.js`. What was actually being reached for is three controls.

**What replaced it: a `lab` tool panel in the range.** Green firmness, green speed in Stimp, and a box to fire a shot from typed numbers. Reached from *Lab tools* in the tools tray, which `updateHUD` shows only while `rangeMode` is on. It is a `TOOL_PANELS` member, so it is a draggable popup like the rest.

**`syncLabTool()` updates it in place; it is never re-rendered.** A re-render would replace the shot-data textarea mid-keystroke and drop the caret — the exact trap the old floating bar documented and worked around. The function no-ops when the panel is not open, which is why every caller can call it unconditionally.

**Presets were removed, not relocated.** The user asked for it, and the replacement is better: `lab.batch`, `lab.drops`, `lab.scatter` and `lab.lipSweep` ask the same questions as a sweep and answer with a distribution rather than one ball, which is what the fitting work actually used. `PRESETS` and `APPROACH_PRESETS` are deleted from `src/lab.js` along with `LAB_SETTINGS`.

**The measurement half survives, and is the reason the removal stopped where it did.** `src/lab.js` keeps its arithmetic — `shotPlan`, `solveLaunch`, `greenSlope`, `envelope`, `outcome`, `dropPlan`, `dropOutcome`, `jitterStream`, `groupStats` — and `window.lab` keeps every method that runs against the loaded course: `batch`, `drops`, `scatter`, `clearScatter`, `lipSweep`, `envelope`, `slope`, `drop`, `strike`, `launch`, `firmness`, `stimp`, `greenAt`, `slowmo`, `eyeHeight`, `reading`, `state`, `last`. `lab.open()` is now "go to the range" and `lab.green({difficulty})` rebuilds the range and reports the slope it made. Every physics fit in this project was done with these; deleting them would have left a future physics change with nothing to measure against.

**`tests/lab.test.mjs` was repointed at `RANGE_SETTINGS`.** All fifteen pass unchanged apart from the world they build, which is the proof that the range is a real bench: its green is flat to below 1e-6 gradient at the pin, big enough for the roll-outs, and `greenDifficulty` still gives it a green that reads. The two preset tests were deleted with the presets. Leaving them asserting things about a world the app no longer builds would have been coverage of dead config.

**It is not a second physics model.** The shot it fires is the shot the game fires, on a course the generator built, and the launch speed is solved with the same roll preview the aim line is drawn from.

**A typed shot is not a club shot.** `takeShot` records `latest.typed = !!data`, and `recordRangeShot` names the row *Launch monitor* when it is set. This covers both the Lab tools box and a real connected monitor, and it replaced a `labSource()` that guessed from `labState`. Reading `$('club')` for these would have stamped whatever club was showing in the selector against a shot that never came from it.

**Manual swings are allowed on the range.** The old lab refused them — `if(labMode&&!data)` — because club, aim and power decided nothing on a bench where every shot was a solved preset. With presets gone the range takes both: swing it, or type it.

**The shot-data box takes one message, the way a launch monitor sends one.** It accepts GSPro **Open Connect v1** JSON — the `BallData` block with `Speed`, `VLA`, `HLA`, and either `TotalSpin` + `SpinAxis` or `BackSpin` + `SideSpin` — and also five bare numbers in the order the label lists them, `111, 20, 0, 6500, 0`, for typing a test case by hand. Enter fires; shift-Enter makes a newline. `lab.strike()` takes either form.

**Those five are the whole input set**: ball speed, launch angle, launch direction, spin rate, spin axis. Everything further a Garmin R50 reports describes the CLUB, which never enters this model.

**Left and right are the golfer's, and a hole's local +x is the golfer's LEFT.** Launch direction (`hla`) and spin axis are taken as a launch monitor reports them -- positive starts the ball right, positive curves it right -- and `simulateShot` negates both as they enter the flight, because a hole plays along local +z and the camera's screen-right is -x there (renderer.js, *Which side is right*). Every sideways READING follows the same rule: `offlineOf` (range.js), `offline` (shot-data.js) and `shotProfile` (shot-views.js) all call -x positive, right. `aim` is the one exception -- it is a bearing in the hole's own frame, set by the aim line the player can see, so it never needed a convention. **What breaks if this is lost:** every monitor shot and every shape set on the slider flies the mirror image of what it says, and the readout still agrees with the monitor, so nobody at a desk notices. That shipped until 5 October 2026 and was found on the first session with a real R50.

**This replaced five sliders, which were wrong twice over** — they fired a shot on release, so every adjustment launched a ball, and a launch monitor does not hand you five knobs, it hands you one message.

## The green's centre and the cup are different points

They used to be one, which is why hole locations could not move at all. `h.green` is the centre of the putting surface and never moves; `h.pin` is where the cup is cut and moves with the setup. Everything that is about the **green** keys off `h.green` / `h.worldGreen`: `greenDistance`, `greenContour`, greenside bunker fitting, the tree exclusion ring, the corridor collision disc in `routing.js`, stream green-protection, the ground shader's green atlas, the 2D map outline and the minimap disc, the green-reading overlay's shape test, and the flyover orbit. Everything that is about the **cup** keys off `h.pin` / `h.worldPin`: `simulateShot`, the flagstick and cup meshes, the putting-distance rings, and the green-reading overlay's cup discard.

Two of those went wrong and are worth knowing about, because neither produced an error:

- **The corridor collision disc was centred on the cup.** Moving a pin moved the volume routing packs holes against, which moved the next hole, which rerouted the course and changed the terrain under all of it. A pin must move nothing. `tests/pins.test.mjs` asserts all four pin days produce a byte-identical layout.
- **The ground shader derived the green's boundary from the cup.** The painted green tracked the pin, so the grass on screen was offset from the green `surface()` actually reports — a ball could sit on painted green and be in the fringe — and every pin looked dead centre because the green was being drawn around it.
- **And fixing that broke the cup cut-out, which nobody noticed for weeks.** The atlas held ONE vec4 per hole and the shader used its `xy` for two different jobs: the green's boundary and the `discard` that punches the hole. Moving the atlas to `h.green` fixed the boundary and silently moved the cut-out to the middle of every green — no hole at the pin, a hole through the centre. The atlas is now TWO texels per hole, green in column 0 and pin in column 1, sampled at u = .25 and .75 with `NearestFilter` set explicitly rather than relying on the `DataTexture` default. If you add anything else to that atlas, check which of the two points it describes.
- **Do not put a backtick in a GLSL comment.** The shader is a template literal, so a backtick ends the string early and `node --check` reports a missing `)` several hundred characters later, nowhere near the comment that caused it.

If you add anything that pairs `greenSize`/`greenAspect` with a position, it is describing the green, so it takes `h.green`.

**A green's bumps scale with the green** (generator 36, 15 October 2026). Greens are real size since 36 (`holeLine`: radius 10-15 m, a median of about 6,150 sq ft), and every mound, tier face, ridge and bowl in `greenShape` takes its width AND height times `r.k` = greenSize / `GREEN_REF` (17.5, the old mean). Their PLACES were always a share of the green; their sizes were metres, and on the smaller greens that stacked the slopes. Scaled, a putt feels the same slopes as on the old greens (median 1.03% before and after). **Change a feature's size in `greenRecipe` knowing it is multiplied by `k`**, and anything new on the putting surface should scale the same way, or the green's slopes drift with its size. **The Green size setting rides on this** (`greenScale`, 60-160%, SCHEMA_VERSION 11): it multiplies the drawn radius in `holeLine` by the share, taken FIRST (`x*(pct/100)`, so 100% multiplies by exactly 1 and saved courses are unchanged -- `x*pct/100` need not give back x), and `k` carries it into every bump.

## Hole locations

`choosePin(h, index, rng)` in `course.js` cuts the cup from the green's own contour, before the world exists, using its own RNG stream (`seed-pin-index`) so it cannot shift trees, bunkers or streams by consuming draws from the shared one.

Difficulty is **slope**. `pinDay` (Thursday–Sunday) sets a target slope and a hard cap; the cap exists because on a Stimp 10 green a ball will not sit still much past three per cent. Room between the cup and the edge is a **safety floor, not a second dial** — that is what the USGA figure is. Scoring it as a target (penalising too much room as well as too little) pulled every cup on a course to within inches of the same contour; one-sided, they spread from 3 m to 18 m. `ROOM_FLOOR` is an absolute 3 m on every day and every green.

Candidates are scored in one pass rather than filtered through a ladder of relaxations: the ladder reads tidier and falls off a cliff, because on a severe green no location satisfies a Thursday setup, every stage rejects everything, and the cup lands wherever the last-resort sort left it. The weights state the priority outright — never put the cup where a ball cannot rest, then hit the day's slope, then the day's room.

Bands rotate front, middle, back by hole index starting at the front (`pinBandFor`). The band constrains depth only; sideways placement is free. `pinBand: 'centre'` is a bench override used by the lab, and returns the green's centre exactly — going through a band would still let the cup slide sideways.

## Shaders are compiled before play, not during it

Nothing precompiled, so every material variant was built the first time an object using it entered view — which is during play, as the ball flies or the camera turns. Measured over 900 frames of a sweeping aim on a fresh course, the first pass produced a burst of six frames between 21 and 71 ms; a second pass over the same ground produced none and compiled zero shaders, which is what a first-appearance cost looks like rather than a per-frame one.

`GolfView.warmUp()` now runs at the end of `build` and again on each `setHole`, calling `renderer.compile(scene, camera)`. Per hole as well as per course because the flag, cup, rings and ball are per-hole objects and a first compile of any of them lands mid-shot; compiling an already-compiled scene is a program-cache lookup, so the repeat is free. It is wrapped in try/catch — a failure to precompile must not stop a course loading.

It also drains the near-field grass queue against a **70 ms budget** first. The grass builds lazily and shares one material, so with no tile yet made a scene walk cannot find it and it would compile on the player's first step. The budget matters because `setHole` also runs on a plain hole change, with no loading overlay to hide behind.

Result on a fresh 9-hole course, 900 frames of sweeping aim: 116 shaders compiled at load, 10 during play, worst frame 65 ms down from a 71 ms burst; on a course that has been played once, p99 is 11 ms and worst is 20–25 ms.

**`compile` creates the programs; it does not wait for them.** The driver links them on its own threads (`KHR_parallel_shader_compile`), and the first frame that draws with one blocks until it is linked -- so the loading overlay went away and the picture froze, cold, for 1.9 s on nine holes and 3.5 s on eighteen (RTX 4090). `GolfView.ready()` closes that: `whileGenerating`, which every course build passes through, awaits it before hiding the overlay (showing *Preparing the graphics*). It awaits `compileAsync` -- the page stays live, the spinner turns -- and then draws one real frame under the overlay, which makes whatever `compile` never sees (shadow-map depth programs, the god-ray mask, bloom). Measured, that frame is 7-10 ms: `compileAsync` had already covered almost everything. It MOVES the wait rather than removing it -- press-play-to-smooth is unchanged on nine holes -- and the frozen picture is what it removes. `lab.scene().ready` reports the two halves.

**While `ready` waits, the game loop does not draw** (`tick` checks `view.readying`). It used to: the loop kept rendering the new course behind the overlay, a frame that used a program the driver had not finished blocked the page until it was linked, and the "live" wait froze anyway. **The water's probes are taken inside `ready`** too, after the first `compileAsync` (`probeDue`, `takeDueProbes`), because a probe renders the scene and rendering it during `build` made the card finish every program on the spot -- 0.8 s of frozen page mid-build. The probe used to hide everything added to the group after the water (planting, homes, the ball), to see exactly what it saw mid-build; since 10 October it does not -- a course loaded with ponds reflecting no trees until the sun's first move, and the planting's render-target programs were built on that first move instead (1.3 s on Medium). **`ready` compiles the scene against the probe target (`asProbe`) before taking the probes**: a render target needs different programs from the screen (no tone mapping, linear colour), and only Ultra's bloom target made them the same. The probe changes the water's program (it gains an environment map), so `ready` compiles once more before the first frame. A build that never passes through `ready` gets its probes on its first rendered frame. **`view.retiring`** is set by `whileGenerating` for the length of a build: starting a round moves the clock from the menu's hour to the player's, and `updateDaylight` used to re-photograph every pond of the menu scene about to be thrown away -- 1.6 s of the wait.

**Why the wait WAS that long: the floodlight lamps were in every lit shader.** Every pole is a spot light (`FLOOD_LAMP_CAP` 192, above the 141 of the longest course), and three writes the visible spot-light count into every lit material's program, so while the lamps were always visible each course needed its own programs -- the menu backdrop's could not be reused -- and longer courses bigger ones. B6 hides them while off and builds the lit programs after the course is on screen, which takes the wait to 0.1-0.8 s: see *Lights: the light count is in every shader*.

## Lines are written in place, not replaced

`setAim` runs on every frame an arrow key is held. It used to build a `Vector3` per point for ~334 points, flatten them into a fresh array and swap in a whole new `LineGeometry` — about 44 KB and several hundred throwaway objects a frame, 2.6 MB/s at 60 Hz. The cost was never CPU time, which measured 0.06 ms; it was garbage, and it surfaced as an occasional 90 ms frame with no shader compiling and no terrain tile building to blame.

`writeLine(line, flat, count)` allocates the buffer once at the length needed and rewrites it after that, with `instanceCount` deciding how much of it draws and `addUpdateRange` uploading only the written part. `aimScratch` holds the reusable point buffer. Measured during a sustained aim sweep, `bufferData` calls per frame went from **4 to 0** — no GPU buffer allocation at all — replaced by in-place `bufferSubData` updates.

Two things to keep:

- **`setAim` and `setAimPath` write the same line**, so they must both go through `writeLine`. One replacing the geometry while the other rewrites it in place would undo the other's buffer whenever the club changed.
- **`frustumCulled` is off for a written-in-place line.** Whatever sits past `instanceCount` is stale, and `computeBoundingSphere` reads the whole attribute, so the sphere would be wrong and the line could be culled from a view it is plainly inside.

`setTrail` still replaces its geometry every frame during flight. It was measured at 0.05 ms and left alone deliberately — the same treatment would work if it ever matters.



## Floodlights: every pole is a light, because none of them casts a shadow

`floodlights.js` decides where the poles stand — pure, hole-local, no renderer — and `RESEARCH.md` carries the figures and their sources. `polesFor(hole)` runs them alternating down the corridor at three times the mounting height apart, stopping short of the green, then flanks each green with a pair at 45° either side of the line of play. `activePoles(poles, focus, limit)` picks the few worth lighting.

This began as four live lights following the ball, on the assumption that a scene with sixty spot lights does not render. **That assumption was wrong and was measured rather than argued**: lighting every pole on a night course costs nothing — 8.5 ms median either way — because none of them casts a shadow, which is the expensive part of a light. Shadow maps are what cannot be afforded sixty of; the fragment loop over sixty shadowless spot lights the GPU absorbs.

So every pole is a live `SpotLight`, and the geometry is instanced into two draw calls for a whole course. `FLOOD_LAMP_CAP` sits at 192, above the 141 the longest eighteen-hole course produces, so in practice the nearest-first fallback (`activePoles`) never runs — it exists so a future course that grows past the cap degrades instead of stalling.

Things that are the way they are for a reason:

- **The fallback follows the ball, not the camera.** A camera chasing a ball down a fairway is behind the action, and lighting from it lights the ground the ball has already left. This only matters past the cap.
- **They cast no shadows, and that is what makes lighting all of them free.** A shadow map per light is the whole budget; the sun is below the horizon when these are on, so CSM has nothing to draw anyway.
- **They are built at course build and hidden, not built on demand.** Building them when the box is ticked would put their material exactly where the grass was — created after the scene walk that registers cascade materials, and therefore lit by all three cascades at once. Built in `build`, the ordinary registration finds them. The lamp heads are `MeshBasicMaterial` and genuinely unlit, so only the masts need registering.
- **Toggling is free.** Nothing is built or disposed; it is a visibility flag and four intensities. Three caches shader programs per light count, so the first toggle in a session links new programs and later ones do not — which is why a zero-recompile reading on a toggle is not evidence the lights are inert.
- **The greenside pair sits behind the green, never in front of it**, and clears the fringe and semi rough by ten yards — a pole in the line of play shines back at the player standing in it, and one in the collar is in play from a missed approach.
- **Green poles aim at the green**, fairway poles at the middle of their own corridor. Aiming a green pole at `h.center(z)` points it at a corridor centre extrapolated past the end of the hole, which is nowhere.

Verified by measuring frame luminance rather than by looking: at 1 a.m., switching them on takes mean luminance from 54 to 80 of 255 and the share of pixels above 120 from 1.9% to 8.3%, with frame time identical on and off.

## The menu borrows the clock, and gives it back

The backdrop shows its own hour, drawn from the same seed as the hole, from `MENU_HOURS` in daylight.js — daylight only, dawn to golden hour, since 1 October (it had night and dusk slots, so a floodlit hole came round as one of the looks; the owner judged a dark hole a poor first picture). Floodlights on the backdrop follow that hour's darkness, **not** the player's preference; every slot is daylight now, so they stay off, but the flag stays so a night slot can come back as a decision rather than a code change.

It used to inherit the player's clock, and once floodlights existed that showed: somebody who had been putting at one in the morning saw nothing but dark floodlit holes from then on. Hole *generation* was never the problem — all seven biomes, all fourteen footprints and 136–610 yd still come up — the presentation was pinned.

Two things make the loan safe, and both are needed:

- **`view.borrowedClock` suppresses the periodic save.** The clock writes itself to storage every 30 seconds, so without this the menu's hour would overwrite the player's within half a minute of sitting on the menu.
- **`claimClock()` ends the loan the moment the player touches any clock control.** Otherwise leaving the menu would silently undo a time they had just set. Every handler in the clock popover calls it first.

`restoreClock()` runs from `leaveBackdrop`, which also clears the world key, so a world is always built after it. **That pairing is load-bearing: the hour it puts back can be null.** A device that has never set the clock has no hour (`loadDaylight` gives null), and only `GolfView.build` swaps a null hour for the biome's default; everywhere else -- `solarState`, `advance`, the sky -- reads it as 0:00. The endless adopt path keeps the menu's world, so it must not restore: until 16 October 2026 it did, and every Endless run started off the menu on a fresh device (every smoke run, on GitHub and here) was played at 12:00 AM under the stars, though the hole had just been shown in daylight. It now claims the clock (`claimClock`) and starts the round at the hour the hole was shown at, through `roundHour` in daylight.js -- **Endless off the menu keeps the showcase hour**, as PLAYING.md and the 30 September note had said all along while the code put the player's clock back. "Start at my local time" still wins. An endless run that grows its first hole (a replay, or Endless chosen mid-round) starts at midday like a course from Play (PLACED; it used to follow the player's clock). Guarded by `tests/floodlights.test.mjs`. **Anything new that leaves the menu without rebuilding has the same trap.**

## Weather lives in the clock panel

`fog` joins `floodlights` and `glowBall` in the daylight record, and is the first control that is about weather rather than time — more will want to sit beside it. Off, both the low sheet and the broad haze go to zero density. **The scene fog stays**: it is the distance cue the whole landscape is drawn against, and removing it shows the edge of the world rather than a clear day. Measured at dawn, when the sheet is strongest, turning it off takes mean frame luminance from 128 to 87 of 255.

## The planting is drawn from the camera's view, not the course's

Every tree model, rock shape, clump of ground cover, home and floodlight part is ONE `InstancedMesh` spread over the whole course. Its bounding sphere is therefore the course, three's frustum test never rejects it, and before `src/instance-cull.js` every instance was drawn every frame -- the trees behind the camera included -- and drawn again into each of the three shadow cascades on High and Ultra. Redwood drew about 181 M triangles a frame on High from any tee.

`cullInstances(view.group)` runs at the end of `build`, after the last instanced mesh exists. It sorts each mesh's instances into 64 m squares of the course and keeps a private copy of the matrices and colours. When the camera has moved 4 m or turned 4 degrees (or the sun has moved, or something was hidden), `update` tests the squares -- a few hundred boxes, not tens of thousands of instances -- and copies the instances of the visible squares to the front of each mesh's buffer, pulling `count` back to match. **Each mesh keeps its one draw call**: splitting meshes per square would have let three do the culling, but Redwood has about 80 model/role meshes and that would have turned 600 draw calls into thousands, trading graphics time for processor time a weak machine has less of.

What is kept, and why each margin exists:

- **Squares in a view 7 degrees wider than the camera's, on every side**, and everything within 60 m -- so the few metres and degrees between rebuilds never uncover a gap at the edge of the screen.
- **Squares whose shadow falls into view.** Each square's box is stretched away from the sun by the length of the shadow its tallest thing casts (height over the tangent of the sun's elevation, capped at 1 km). Without this, a tree just off screen loses its shadow and the shadow on screen vanishes with it.

The numbers these were chosen at are live in the lab: `lab.cullTune({near, margin, shadows, shadowCap})`, `lab.scene()` lists what the course built by group with the heaviest meshes, and its `cull` field the squares and instances held and what the last rebuild cost; `lab.hole(n)` jumps to hole n's tee (0-based), because the first tee is the worst place to judge a cull from -- it stands at the edge of the course with the whole of it ahead.

The traps:

- **A culled mesh no longer holds instance `i` at index `i`.** Never `setMatrixAt` on one after the build. To hide an instance, set its flag in `mesh.userData.cullHidden` (a `Uint8Array` in the ORIGINAL order) and call `view.cull.dirty()`. That is how `clearCameraTrees` hides the tree the camera is standing in; it used to write a zero matrix at the original index, which on a culled mesh zeroes whichever tree happens to be packed there.
- **Anything that renders the scene from somewhere other than the camera must call `view.cull.showAll()` first.** The water's reflection probes do; without it every pond photographs a course with its back half missing. The next frame's `update` puts the cull back.
- **The sun direction must actually reach `update`.** The first version passed it only when `this.sun.castShadow` was true -- and with cascaded shadows the main sun does NOT cast, the cascades' lights do. The shadow margin silently did nothing: at 6:24 pm on Redwood the long shadows across the foreground changed on a quarter of the screen with the cull on. If shadows at the edge of the view ever pop as the camera turns, check this first.
- **Meshes built after `cullInstances` are not culled**, and a mesh whose instances MOVE after the build must opt out with `userData.noCull = true` (the near-field grass tiles do). A new course-wide instanced thing belongs before the call in `build`.
- **`frustumCulled` is off on every culled mesh** and `computeBoundingSphere` on one sees only what is currently held. Both would otherwise leave three testing a stale sphere and dropping a mesh that has since come into view.
- **Do not change a culled buffer's usage to `DynamicDrawUsage`.** It is the obvious hint for a buffer rewritten as the camera moves, and on Windows it tripled High's graphics time (12.6 -> 33 ms) for the whole page -- but only on a page opened after another in the same browser, so a single fresh load never shows it and `npm run profile`, which opens the tiers one after another, did. The buffers keep whatever usage they were built with. RESEARCH.md *Drawing only what is in view* has the runs.
- **Each shadow map draws a prefix of the same buffer.** Instances are written in order of the first shadow map that needs their square, and `onBeforeShadow` cuts `count` to that map's prefix (`onAfterShadow` puts it back). The renderer passes the shadow-casting lights to `update` AFTER `csm.update()` and after placing their shadow cameras (`light.shadow.updateMatrices`), because the test is against where the maps are this frame. A shadow camera the cull was not told about -- a floodlight's -- draws everything, as before.
- **Layers cannot do this.** Three tests an object's `layers` against the MAIN camera in the shadow pass too, so putting a mesh on a layer only one cascade enables changes nothing. The hooks are the mechanism.
- **The shadow twin is never drawn into the picture.** It shares its mesh's instance buffer (no upload, always the same trees) -- and its instance COLOURS, which a shadow ignores but which decide the shared material's program: without them three switched that program twice per twin in every pass that met it (RESEARCH, *Wasted drawing*) -- and zeroes its own `count` in `onBeforeRender`, which also keeps it out of the god-ray mask and the water probes. It draws only into maps from the tier's `thinShadowsFrom` on.
- **A far crown mesh holds exactly the squares its full mesh does not.** `farTrees` (per tier) makes a second leaf mesh per model for crowns small on screen; the full mesh skips thin squares and the far mesh takes only them, so no crown is drawn twice or lost. It has its own buffer (different trees) and casts its own shadow with the thinned shape. It adds a draw per map and to the picture, which is why it is off on High and Ultra. **ONLY A CROWN OF MANY SPRAYS GETS A TWIN** (`TWIN_MIN_TRIANGLES`, 2000 leaf triangles), shadow twin and far mesh alike: thinning keeps a third of the pieces and grows each, which a grown redwood's thousands of sprays survive and a Kenney cartoon crown -- 40-170 triangles in a few flat faces -- does not. Its twin came apart into floating shards, and since a cartoon tree is short, 84-93% of all crowns past 60 m on Low and Medium were drawn that way until 16 October (the owner: "a mangled mess"). `tests/instance-cull.test.mjs` holds it.
- **A SHADOW'S NORMAL OFFSET GOES WITH ITS TEXEL.** `shadowBias.normal` is in metres and must be at least about a texel of the map it serves, or every crown shades itself in diagonal stripes, which the toon ramp turns into hard bands. Low's 512 map over its span is ~0.6 m a texel (offset .7), Medium's 2048 ~0.2 m (.35), High and Ultra's nearest cascade a few centimetres (.055). Change a tier's `shadow.size` or `shadowSpan` and this moves with it. The floodlights take `shadowBias.flood` instead: their maps cover a pool a few dozen metres across, and the sun's offset would lift their shadows off the trunks. RESEARCH.md *Low and Medium trees: striped crowns and shards*.
- **Each cascade's shadow camera is fitted to its slice every frame** (`fitCascadeDepth`): far plane at the slice's deepest corner plus 200 m, starting 1 km sunward of it (`CASCADE_SUNWARD`), with the constant bias scaled by 2 km / far so it stays the same distance in metres. CSM's fixed 2 km depth left 1-3.4 km of the far cascade outside its map depending on heading -- distant shadows that came and went as the camera turned. Anything that changes the cascades' reach or split has to leave this in place.
- **Cascade edges are the tier's `cascadeSplits` (100 m, 500 m on High and Ultra), except in the overview.** `GolfView.cascadeSplitter` is CSM's custom split callback; it reads `config.mode` at the moment CSM recomputes, and `render` calls `csm.updateFrustums()` whenever the overview is entered or left as well as when the reach changes -- without the mode check, High (whose reach is the same in the overview) would keep 100 m edges on a camera hundreds of metres up and put the whole course in one coarse map. Do not turn on CSM `fade`: it recompiles every lit material and the ground shader comes out white.
- **Never give the map that shades the nearest trees a twin.** A crown shades itself from the same map, and a twin whose grown sprays do not sit where the drawn ones are darkens every near crown -- which is why Low and Medium, whose one map covers the player's surroundings, have `thinShadowsFrom: Infinity`, and High and Ultra start at 1.
- **Rendering only.** `world.trees`, collision and everything physics reads are untouched; a tree that is not drawn is still exactly where it was, which is why no generator version is involved.

## Near-field grass is built on a budget

`addNearbyGrass` caches fine blades in 24 m tiles around the camera, and the way those tiles are *scheduled* is the load-bearing part.

Building the ring in one frame is what made the camera hitch. Crossing a tile boundary meant five new tiles at once — 8,000 candidate blades, each costing a `surface`, `groundCover` and `height` query against the world, then a matrix and a colour for the ~85% that survive. **Measured at 37 ms**, better than two dropped frames, every 24 m the camera travelled; the first ring of twenty-five was **127 ms**. It fired on camera movement, which is when a frame can least afford it.

Now the ring is reconciled the moment the camera changes tile, but tiles are built **one per frame** from a queue sorted nearest-first, so the ground under the camera fills before the edge of the ring. Worst-case work in a single frame went from 25 tiles to 1. A tile that falls out of range is **parked** with its buffers intact in a 32-entry LRU rather than thrown away — walking back over ground you just left is the common case and used to rebuild all of it; in a walk-out-and-back simulation 43 tiles came back from the cache instead of being rebuilt.

Blades are written straight into the `InstancedMesh` and its `count` pulled back to what survived, rather than cloned into arrays and copied in afterwards — that was two throwaway objects per blade, about 2,500 a tile, and cost 13%.

Two things to keep in mind if you touch this:

- **Parked tiles are outside `view.group`**, so the scene walk in `disposeCourse` cannot find them. They are disposed through a `view.resources` entry; remove that and each course leaks a ring of buffers.
- **`w.surface()` is 85% of what remains** — 5.8 ms of a 6.8 ms tile, because it re-runs a nearest-hole search over every hole for all 1,600 candidates. Hoisting that per tile is the obvious next win and is not done: a 24 m tile is small against hole spacing, but it can still straddle two corridors, and `surface` is the same query physics uses for lie classification, so it wants its own change and its own verification rather than being folded in here.

### Adding a biome

Everything a biome decides lives in `src/biomes.js`: `DEFAULTS` holds every field (the count used to be written here and drifted; read the object), `TRAITS` lists only what each biome does differently, and the two are merged once. A biome that says nothing behaves like the old generic case.

To add one: add the key to `BIOME_KEYS` in settings-schema, add a palette entry, a traits entry and an interface palette (`INTERFACE`: the six colours the 1.0 interface wears on that biome's courses; `tests/ui-palette.test.mjs` refuses a biome without one, or one whose text is unreadable -- *The 1.0 interface: layout rules*), and add its species to `FAMILY_OF` in mesh-assets.js if it introduces any. Nothing else in the generator should need editing — and if it does, that is a field missing from the record rather than a conditional to write.

**Three per-biome tables still live outside the record**, and Haunted Hollow (9 October) had to touch all three: the course-name word lists in `src/course-names.js` (a test fails if a biome has none, and every word is searched with "golf" first -- see the denylist test), the fog profile in `src/mist.js` `PROFILES` (**no test: a biome missing from it silently takes Midwest's fog**), and `tools/fixtures.mjs` / `tools/profile.mjs`, which list biomes by hand so a new one is not measured until it is added. The per-biome grass texture density in `textures.js` falls back to 1, which is fine.

**What else a biome can ask for (9 October, Haunted Hollow's second pass).** `props` -- solid giant props per hole, placed in course.js and drawn by haunts.js; `ghosts` -- ghosts per hole, haunts.js only; `roughTint` -- what the Cartoon ground lifts the rough toward (23%, renderer.js; an olive by default, which turned a violet rough to mud); `mapTurf` -- the semi-rough, fairway and green colours of the 2D maps, which are otherwise the same for every biome. Defaults reproduce exactly what every other biome had.

**The night additions (9 October): `moon`, `bats`, `wisps`.** `moon` draws a disc into the sky shader -- after the stars, before the clouds -- with an angular size, a horizon and a high colour, and how much it shows by day; null (every biome but Haunted Hollow) leaves the sky shader's moon branch at zero, so those skies are unchanged. Its position is `solar.moonDiscDirection`, which runs `MOON_LEAD` (about 1.25 h) ahead of the moonlight's own arc so it is already up at Dusk; late at night the disc therefore stands a little away from where the moonlight's shadows come from. `bats` and `wisps` are per-hole counts drawn by haunts.js and shown by `solar.lamplight`.

**ANYTHING INSTANCED THAT MOVES MUST SET `userData.noCull`.** `cullInstances` takes every InstancedMesh in the course group at build time and, on each rebuild, rewrites its instance buffer from the matrices recorded then -- so a bat posed every frame would be snapped back to where it was built and drawn only where its build position was in view. The bats and wisps set the flag; the lantern faces, which never move, are culled like the pumpkins they sit on.

**NIGHT-ONLY MESHES DRAW NO INSTANCES BY DAY RATHER THAN BEING HIDDEN.** The scene compile under the loading screen only builds programs for visible objects, so a mesh hidden until dusk would build its program in the first frame after sunset. The bats and wisps stay visible with `count` 0. Measured: switching the clock from afternoon to dusk costs one 58-68 ms frame with them and the same without them -- that frame is the existing clock-jump work, not theirs.

**An additive sprite drew a dark square instead of a glow.** A halo of point sprites round each lit lantern face came out as a dark square behind the face -- with the mist patch kept off it too, so it is something later in the frame. It was dropped rather than chased; the lit face reads on its own. If a glow is wanted, find that first.

**The forest floor is a field now.** `deadfall` is how many pieces; `floor` is what they are, as `[family, share]` pairs drawn from PICK families -- the grove's logs, stumps and mossy boulders by default, Haunted Hollow's pumpkins and toadstools among its logs. `addDeadfall` in vegetation.js owns each family's size and colours, so a new floor family needs a line there too.

**Bark colour is per species, not per biome**: the `barks` table in `addModelSpecies`. A dead tree has no leaves, so its bark is the whole identity -- the gnarled oak, the pale snag, the dead willow and `deadoak` each have one. `deadoak` deliberately shares the desert's `arid` family (its dead hardwoods) under a different species name, so it can take its own bark without touching the desert.

**A model whose material names mislead the role classifier gets a `ROLE_OVERRIDE`** in `tools/build-meshes.mjs`, per family, rather than a change to `ROLE_OF`. Kenney names its pumpkin's body `leafsFall` and its stem `grass`, so by name it was all leaf and painted one colour; the toadstools are all `accent`. Changing `ROLE_OF` itself would re-role models every biome already ships. It reads GLB materials only. After any re-ingest, compare the old and new `src/asset-meshes.js` part by part: adding thirteen models left all 238 existing parts byte-identical.

If the biome wants props no other biome uses, add the family to `PICK` in `tools/build-meshes.mjs` and rerun it -- the packs in `vendor/` hold far more than ships, so check there before going looking for assets. A PICK entry is a file name; three of the packs are Quaternius nature packs sharing 31 names, so an ambiguous one is an error and you disambiguate with `megakit:Pine_1`. `KEEP_ROLES` drops the parts of a model a family does not draw -- the conifer crowns keep their leaves and throw their trunks away. What a species IS, as opposed to which biome grows it, lives in `src/species.js`.

**Generating a model rather than finding one:** `node tools/bake-trees.mjs` runs ez-tree (MIT, a devDependency, never shipped) in Node and writes redwood variants into `vendor/baked_assets/`, from where they go through the normal ingest. Reach for this when the shape you want does not exist in any pack -- a bare-columned giant does not. Re-run `node tools/build-meshes.mjs` afterwards.

**Textured models carry a `uvSpan`.** Texture coordinates are packed into 16 bits against the part's own range rather than against 0..1, because bark tiles far outside the unit square and the old packing silently clamped it. An atlas has no span and is unaffected. If you add anything textured, check that `uvSpan` survives into what is drawn.

**The redwood biome draws entirely from `vendor/grown-redwood-forest`,** at full detail, all of it, all the time -- 33.6 M vertices a frame and still at the display's refresh cap. There was a two-level LOD here and it was removed: the arithmetic that justified it was never benchmarked, and the benchmark that appeared to confirm it was reading the 120 Hz vsync interval. The generator still bakes `_Far` twins; nothing ingests them. **If you add a species, it draws whole.** Before adding an LOD back, measure with something capable of reporting zero -- see RESEARCH.md.

**`vendor/grown-redwood-forest/` is grown from nothing.** `node tools/grow.mjs` writes 153 models built out of
triangles by `tools/grow-lib.mjs` -- no imported geometry, no texture, no generator library. Proportions and
colours come from 315 reference photographs recorded in REFERENCES.md; `python tools/fetch-references.py`
gets them again. Review it with the contact sheet, not the single-model viewer:
`node tools/asset-preview.mjs grown-redwood-forest && npx vite build --config vite.sheet.config.js`, then open
`dist/sheet.html`.

**`vendor/baked_assets/` is a dumping ground for composed models**, not a vendored pack. **It is not committed** (since 30 September; `.gitignore` says why): it lives on the owner's machine, nothing reads it at build time, and the ingested result `src/asset-meshes.js` is what the repository carries. Re-running the bake tools needs the folder locally. `node tools/bake-assets.mjs` builds trees out of the CC0 packs -- a bare bole stretched out of a `DeadTree`, a crown borrowed from elsewhere, redwood proportions applied -- and `node tools/bake-trees.mjs` builds the ez-tree generated ones. Both write there, both are re-runnable, and nothing in the folder should be edited by hand.

**Choosing a model: `npm run assets`** builds `dist/assets.html`, a self-contained page showing every model in `vendor/` at a height you type, beside a 1.8 m figure, with its silhouette profile and the `pack:Name` string a PICK entry wants. Two crowns were picked by reading file names and both were wrong; this exists so that stops happening. `node tools/tree-spacing.mjs [biome] [seed]` answers "is this too dense" in numbers.

**Then run `node tools/biome-fingerprint.mjs --check`.** It hashes what every biome generates and fails if an existing one moved. A new biome shows up as `new` and the others must be unchanged; re-save with `--save` once you are satisfied.

This replaced seven tables and 48 conditionals across eight files. The one that mattered most took a biome as an INDEX into `['desert','mountain','links','island']`, so an unknown name silently became −1 in the ground shader.

### Material flags say one thing each

`userData.cloudMesh` means the material IS a cloud and must not be shaded by one. `userData.cloudShadowed` means cloud shadows have already been patched into it. `userData.mist` and `userData.cloudFaded` are the equivalent markers for their own patches.

Both cloud flags were once `userData.clouds`, set by `applyCloudShadows` on every material it patched and by `clouds.js` on the one cloud material. Anything later asking "is this a cloud?" got yes from thirty-four materials. A per-cloud opacity patch keyed on it, every lit material took a fade attribute only the cloud geometry carries, a missing attribute reads zero, and the whole course went invisible at the one graphics tier that turns clouds on — with nothing in the console.

**A flag that means "I have processed this" must be named for the processing**, never for the thing. The two readings are indistinguishable at the call site.

Note also that anything behind a quality gate is only exercised at the tiers that enable it. Clouds, god rays, bloom and mist are all gated; testing at Medium proves nothing about them.

## Rendering changes require coordinated updates

`ground.js` encodes hole ownership, playing curves, green/tee parameters, cup openings, hazards, pond bank profiles and stream segments in data textures. Owner tiles select nearby data; shader math preserves crisp edges at higher precision than the ownership texture. The stream index occupies a channel of the owner texture and resolves to two pixels per segment, carrying endpoints, both widths, the channel index and the valley shoulder. Because one segment is stored per owner texel, `channelInfo` is evaluated for the stored segment and its two neighbours in the same channel, keeping the nearest; without that, fragments beside a station join picked the wrong segment and stepped. `shoreBands` sizes the shoreline and `shoreTint` paints it, for ponds, lakes and channels alike; ponds no longer get a sand bed and sand collar. The whole profile shrinks by one factor on mown turf so it keeps its shape rather than re-proportioning, and the taper runs over a distance proportional to the body — a river begins narrowing its bank roughly 70 m before a fairway. A short taper made the band's outer contour swing inward faster than 45°, which drew a hard line along the corridor edge. The taper reads `mownTaper`, a smooth-min/smooth-max blend of the corridor and green-ring distances; hard `min`/`max` creased where a corridor's side met its end and put a straight wedge in the bank. The softened classification uses the exact `mownEdge` instead, so it stays aligned with the crisp one. **The softening is colour only**: `localSurface` and every contact query still switch at the true boundary, so near a channel the visible turf edge and the playable one differ by a couple of metres. Its band cap differs by body: a channel uses 80% of its valley shoulder, while a pond uses a tighter fixed cap because the owner atlas stops carrying a hole's hazards a short way outside them. The shore is three bands — saturated margin, damp earth, then a fade straight to the surrounding cut — sized from the body's width and capped so the band always reaches the surrounding turf colour before the owner atlas stops marking the fragment. Band width also depends on the surface being crossed: mown turf (`kind` 1–4) keeps roughly a third of the margin that unmaintained ground gets, because one width wide enough to look right in rough ate deep into any fairway or green a channel crossed. The band therefore pinches at a fairway edge and widens again beyond it, which is deliberate. Biome bank tints are warmed and darkened into earth; used raw they read as slightly duller grass beside a green fairway. Do not reintroduce an intermediate damp-turf stage: holding a near-constant tint of whatever turf is there traced every channel as a coloured ribbon rather than reading as a bank. For the same reason `vegetation.js` keeps instanced grass off the painted earth band via `onShoreBank`; the band widths live in `streams.js` as `shoreBands` and the ground shader mirrors that formula, so change both together. Streams do not reuse bunker sand. Large lakes override owner selection on both CPU and GPU. When adding a surface, update CPU surface/contact queries, GPU classification, terrain carving, geometry, minimap, physics response and tests together.

**A HAZARD MUST SIT ON GROUND ITS OWN HOLE OWNS.** The shader paints only the owner's hazards (the owner atlas: a large lake's hole within 7 m of it, else `nearest`), but every hole's bunker excavation and pond shelf apply to the ground everywhere. So a hazard reaching onto a neighbour's ground is dug out there and painted, and played, as the neighbour's rough. Ponds were filtered for this from the start; bunkers were not until generator 34, and about one in twenty was a grassed-over bowl with a white sliver along a staircase edge (the staircase is the atlas's 1.75 m texels). `bench bunkers` holds the rule as an invariant and `tests/bunker-ground.test.mjs` fails without it. Anything new that is dug into the ground and painted per hole needs the same filter.

The ground is one mesh, not overlapping fairway/rough overlays. Bunkers are locally excavated with smooth normals. Reintroducing coplanar surface meshes creates the screenshot artifacts that prompted earlier fixes. Distant land must retain the detailed mesh's exact boundary. Cup holes and green overlays must agree on real dimensions.

Trees/grass mostly use instancing and shader animation. Each trunk, branch and canopy instance retains its owning tree and original matrix. Camera clearance tests a padded cylinder around each tree; all of that tree’s instances are zero-scaled while the camera is inside and restored when it leaves. This is visual only: physics still collides with trunks. The test runs after camera movement, and uploads only changed instance batches. New homes currently use individual meshes; high densities increase draw calls. Dispose geometry, materials, data textures, reflections and green overlays when rebuilding the world. Avoid disposing shared resources multiple times. Keep animation uniforms shared where intended.

## Flyover and initial aim

`fairwayAim` walks forward along the current hole’s centerline by the selected club’s carry. It targets that fairway point rather than taking a shortcut toward a dogleg pin; near the end of the route or on the green it targets the pin. Explicit user aim points remain supported. All outputs here use hole-local coordinates.

`makeHoleTour` circles the whole hole: the main menu backdrop's camera put over a hole in play, with the same framing — radius `max(150, length × 0.85)` and height `max(55, length × 0.3)` about the hole's midpoint — at `FLYOVER_RATE = MENU_ORBIT_RATE × 1.5` = 0.1125 rad/s. One lap is 55.9 s, then `pose.done`. It replaced an arc-length Catmull–Rom run up the fairway joined to a tight green orbit, which showed a hole a piece at a time and never its shape in the landscape.

Terrain clearance is solved **once per hole**, not clamped per frame. A per-frame `max(orbit, ground + clearance)` works but puts a corner in the path wherever the ground crosses it. Instead the whole ring is measured up front — 96 samples, each taking the highest ground across its arc *and* 10 m to either side of the flight line, because the ridge between two samples is higher than either and a canopy standing off the line still gets in the way — then smoothed with six passes that may only raise a value. The camera therefore rises to meet a ridge before it arrives and settles after it. `CLEARANCE` is 34 m because this generator grows 29 m trees; sampling points alone let clearance fall to 19.3 m on mountain terrain, under the canopy. Measured on full mountain and full forest it holds 34 m of ground clearance and passes ~10 m over the tallest trees.

Main owns a transient `tour` state: it temporarily hides putting-distance rings and disables reading overlays, and restores prior reading settings on completion or cancellation. There is no longer a moment where the camera arrives at the green, so the contour heatmap is no longer switched on partway through. The button, Escape, return-to-ball, another camera, a drawer or a hole jump exits the tour. Shots are blocked during tours; score, lie and shot history remain unchanged. The map follows the camera. It returns to the proper player/putting camera.

## Shots, scoring and presentation

**Dispersion is a READ, not a model, and the tests say so first.** `dispersionByClub` groups the session's shots by club and reports a centre, a standard distance and the worst ball. It invents nothing: the leading test fires ten identical shots and asserts the radius is exactly **0**, because the simulator has no strike-quality model by design and the honest circle for ten identical balls is a dot. If that test ever reports a radius, something is generating scatter nobody hit.

**An ellipse that contains every ball, not a circle at one standard distance.** The circle was the wrong shape twice over. Dispersion is not round — long and short is a different miss from left and right, and most clubs group about half as wide as they are deep — so a circle either swallowed the sides or spilled past the ends. And a standard distance describes about two thirds of a group, which meant a third of the balls sat outside the mark drawn for them.

`groupEllipse` takes its SHAPE from the group's covariance, so the ellipse lies along the way the club actually misses rather than along the aim line, and its SIZE from the requirement that every ball is inside. Three things that look like polish and are not:

- **Touching the extremes on each axis is not containment.** A ball out on the diagonal can be inside both axis bounds and still outside the ellipse. The scale factor `k` is the smallest one that takes the last such ball in, and a test builds exactly that case.
- **A collinear group leaves one axis at zero**, which divides by zero and draws an invisible ellipse. A 4% floor makes it a sliver — the truthful picture of a group with no width.
- **Identical shots still return `long: 0, wide: 0`.** Inflating a point into a shape would be drawing a miss nobody hit, which is the same rule the rest of the simulator runs on.

A test also pins the other direction: the tightest-fitting ball must reach at least 0.95 of the ellipse. Containment alone is satisfied by an ellipse twice the size of the group — honest and useless.

The legend reports both axes, long first (`31 × 11 yd`), because a group 40 yards deep and 12 wide is a very different club from one that is 20 by 20 and a single number cannot say which you have.

**The world angle is the canvas angle, with no correction.** The map negates both axes and scales them equally, which is a 180° rotation, and an ellipse is symmetric under that.

**`clubKey` is what it was hit with; `club` is where the numbers came from.** These differ for a launch-monitor shot, whose `club` reads *Launch monitor*. Grouping on that put a driver and a 7 iron into one circle with a **63.7 yd radius** — two clubs a hundred yards apart averaged into a number describing neither. Found by hitting real shots through the finished feature, not by reading the code. The selector is the player's own statement of what they are hitting, which is exactly how a monitor session works: you pick the club in the app and the device sends the ball. Nothing is inferred from the ball data.

**Three shots minimum, and the legend states the count.** Two balls define a line through their own midpoint and a radius that means nothing. A circle from three balls and one from forty look identical on the map, so the legend carries `n` beside the club.

**Club colours are hashed from the name, not assigned from a palette in order.** Assigned in order, a club changes colour the moment you pick up a different one and the legend shuffles mid-session.

**The circles are drawn with a dark under-stroke.** They land on greens and fairways, which are mid-tone greens themselves, and a single coloured hairline on top of those was visible in a screenshot and invisible at a glance.

**LOCAL +X IS THE PLAYER'S LEFT, AND THE CODE ALSO CALLS IT "RIGHT".** In a hole's own frame the hole plays along +z, and three.js builds a camera's screen-right as `cross(up, eye - target)`, which is -x when you face +z. Checked across nine holes at nine rotations: the sign of the cross product between the play direction and local +x is identical on all of them, so `toWorld` is a rotation with no mirror and this holds everywhere. `fairwayWidth(h, z, 0, +1)` is nevertheless named the "right" edge -- that is a naming convention for which edge is which and it does NOT agree with the player's view. Anything positioned by eye (the hole sign) must use the geometric answer; anything reading those width helpers must use theirs. Do not "fix" one to match the other without checking every caller.

**THE GENERATOR'S OWN SIGHTLINE STARTS 12 METRES OUT.** `sightline` walks from d=12 because that is past its own tee pad, which means nothing in the generator has ever looked at the ground immediately in front of a tee -- exactly where a shoulder ramping up to higher natural ground would sit. Any metric built on it inherits the blind spot. `tools/metrics.mjs` `blind` therefore walks its OWN ray from 2 m for the near reading, mirroring `sightline` in every other respect. Measured with that: all 25 blind tee shots are caused by ground 96 to 190 m out, and none by the tee.

**ANYTHING WITH A BODY IS JUDGED BY THE BODY, NEVER BY THE POINT IT GREW FROM.** Trees have always passed their trunk width into `blocksLaunch`; rocks passed nothing, so a boulder up to 1.65 scale across was tested as a dimensionless point, against a ceiling of `y+scale` that is not its height either -- a stone is drawn up to 0.9 scale above its centre and sunk a quarter of it, so its crown is at `y + 1.15 scale`. Build the geometry first and test THAT, which is the order the specimen obstacles already used and the comment there already explains. `rock.top` and `rock.reach` are the two numbers physics reads and they are the two the placement rules must read as well.

**A PLACEMENT RULE MUST BE APPLIED TO EVERY KIND OF BODY OR IT IS NOT A RULE.** `inTeeFan` -- the combined cone from all three tees, which is what stops something standing in the view from the back box -- was consulted by trees and by nothing else. Rocks never called it. Measured across four courses: four rocks standing in a tee shot and 41 in the view. `tools/metrics.mjs` now carries `teeclear`, which calls the generator's own `blocksLaunch`, `inTeeFan` and (since bushes and houses were found doing the same thing, 12 October 2026) `blocksView` against the FINISHED world; it is the only kind of check that catches a rule applied unevenly, because the generator's own answer during placement was "nothing is in the way".

**A SILENT FALLBACK IN SPECIES SELECTION GREW A 29-METRE BUSH.** The fairway feature picked `bio.plants.find(k => !GROUND_PLANTS.has(k))` and fell back to `bio.plants[0]`. On LINKS every species is ground cover -- gorse, heather, shrub -- so the fallback chose gorse and the feature then sized it by `bio.canopy`, 13 to 29 m. A biome with no tree now gets a rock. When a lookup has a fallback, ask what the fallback DOES on the one input that needs it; this one had been there since the feature shipped and every other biome leads with a real tree.

**THE BIOME FINGERPRINT HASHES TWO THINGS AND ONLY ONE OWES A VERSION BUMP.** `recordHash` covers the biome's own fields -- name, title, palette, light -- and `fingerprint` covers what the generator built. A record change is a LOOK: it cannot move a ball or rebuild the ground under a saved round, so it owes nothing. A ground change owes `GENERATOR_VERSION`. They were one hash until 25 September 2026, when renaming three biome titles made the tool report "output moved for an unchanged seed, so it has to go up" -- which was false, and the kind of false that teaches people to ignore the check. If you split or add to either hash, re-save the baseline once: every stored hash shifts by construction and that first `--check` is a migration artefact, not a finding.

**NO NAME IN `course-names.js` OR A BIOME TITLE MAY BE A REAL GOLF DESTINATION.** Place names are weak as trade marks; a real resort's name on a course inside a product being sold is a different proposition. The lists carried Bandon, Dornoch, Kintyre and Saguaro, and the titles carried Bandon Ridge, Turtle Bay and Saguaro Dunes. `tests/course-names.test.mjs` holds a denylist that cannot be complete and is not meant to be -- **search a candidate word together with the word "golf" before adding it.**

**THE DIAGNOSTIC IS COPIED, NEVER SENT, AND THAT IS A PUBLISHED CLAIM.**
`src/diagnostic.js` gathers a build stamp, the device, the GPU, the frame rate
and the last few errors, and hands them to the clipboard. It has no `fetch`, no
image, no beacon, and must never acquire one. DISTRIBUTION_REVIEW verifies that
the built file makes **zero runtime network requests** -- re-verified with the
diagnostic in place, and the only request the page makes is the page itself.
Adding telemetry to this module is not a feature; it breaks a claim the project
publishes about itself.

**THE BUILD STAMP IS INJECTED, NOT WRITTEN DOWN.** `vite.config.js` defines
`__FAIRWAY_BUILD__` with the short git commit and the build time. It is
therefore **undefined under the test runner**, which imports `src/` directly,
and a bare reference to an undefined `define` is a ReferenceError that takes
the module down on import -- so every read goes through `buildStamp()`, which
guards it. A build from the source archive has no git repository and gets a
timestamp alone; that is a normal way to build this, not a failure.

**THE BUILT PAGE STATES ITS VERSIONS IN ITS FIRST LINES.** `vite.config.js`
puts `<meta name="fairway-versions" content="generator=N schema=M">` at the
top of `<head>` (`head-prepend`: injected at the end of the head, it lands
after the 16 MB inline script). The website, in its own repository since
7 October 2026, builds its demo from the released `Fairway.html` and has no
`src/` to import, so this tag is how it writes a sample course code the game
will not flag as made by an older version. **Removing or renaming it breaks
the website's build**, which refuses a game without it.

**A COURSE'S NAME IS NOT A GENERATION SETTING, AND MUST NEVER BECOME ONE.** `settings.courseName` rides on the live settings object and is answered for the card by `playingCourseName()`. It is filtered out by `courseSettings()` before anything is stored, and it is not in `worldKeyFor`, so naming a course can never move a metre of its ground or invalidate a saved round. It is deliberately NOT a `SETTINGS` entry for the same reason -- adding it there would make it a control, put it in the world key and demand a schema bump for a piece of text.

**ANYTHING GENERATED RATHER THAN CHOSEN FALLS BACK TO ITS OWN SUGGESTION.** `suggestCourseName` is seeded from the course's seed and biome, so the fallback is stable: a surprise course is called the same thing before and after somebody saves it, two people holding the same code see the same suggestion, and a name declined once is the same name a minute later. An ENDLESS run is named from `round.seed` rather than from the settings, because the settings are rebuilt for every hole -- named from those, the course would rename itself on each tee.

**TWO BIOMES MAY SHARE A FIRST WORD OR A SECOND WORD, NEVER BOTH.** The word lists in `course-names.js` overlap on purpose, because cedar and hollow each genuinely belong in more than one landscape -- but an overlap in both halves means the same name can come out of two different places. "Cedar Hollow" was reachable from the Pacific Northwest and the Midwest. `tests/course-names.test.mjs` checks this against the LISTS rather than a sample, because a sample that happens not to collide is not the rule.

**COPYING NEEDS THE OLD WAY AS A FALLBACK.** `navigator.clipboard` requires a secure context AND a focused document, and it REJECTS rather than prompting when it is not -- which is every embedded preview and any window that lost focus between the click and the promise. `copyText()` falls back to `execCommand('copy')` through an off-screen textarea; off-screen rather than `display:none`, because a hidden element cannot be selected and the copy silently does nothing. Both the Tools window's Copy course code and the library's Get code go through it.

**PLAY AND COURSE STUDIO ARE WAYS IN, so `syncNav` hides them from the top-bar menu once you are in one.** Offering "Play" to somebody already playing means starting a different round from what looks like a settings menu, and "Course studio" mid-round is a guarded exit dressed as a nav item. Main menu stays, and is where both of them live.

**THE SHOT TILES REPLACED THE GRID** (11 October 2026, main.js *THE SHOT TILES*): every ticked number is its own box in `#shotTiles`, dragged anywhere, its place a fraction of the playing area saved per set in `fairway-shot-tiles-v1`. **Where an unmoved tile sits (13 October 2026, `placeTiles`):** bigger than a phone, in a row along the foot of the course, each tile its own width (made all as wide as the widest, eight no longer fitted one row at 1440 x 900), centred in the room between the play window and the map, extra rows stacking upward; on a phone, three across the top from the left edge to the wind (and, held sideways, the camera button), past the play window if it reaches the top. Tried and rejected the same day: one column down the left beside the play window -- the owner asked for the bottom instead. Also rejected: hanging the tiles under the play window, which shrinks to its shot line in flight and would drag them up the screen every shot. Until 13 October they sat in rows beside the shot bar and followed it. **A phone has its own set** (`'phone'` in shot-data.js, `fairway-shot-data-phone-v1`): at most three, carry, total and backspin until chosen, the same whether a monitor is armed or not. Which set is on screen is `tileSet()`, and whether the phone layout is in force is read off the stylesheet (`--phone:1` inside the phone container query), never worked out again in JS, so the tiles cannot disagree with the rest of the screen; `syncTileSet` reloads the set when arming or a resize changes it. `#shotPanel` is now only the bar: state, caption, Skip, countdown, a penalty or hole-out note, and the fold, which hides the tiles. `gridHTML` draws the tiles and returns nothing, so `renderResult` and the rest still call it. It redraws the folded carry-and-total summary too: `renderResult` used to leave it on the last number counted in flight ("16 carry" beside a carry tile reading 219, found 13 October 2026). Columns and drag-to-reorder went with the grid. The paragraph below describes the step before, kept for the reasoning. SUPERSEDED:  since 11 October (the owner, after trying it): Ball, Club, Result and the monitor's own, each a bordered section of the SAME width (equal grid columns, `--groups`; tiles wrap inside a section; stacked on a phone), each number a bordered tile, bold and sized off the screen width (`cqw`). A ticked section ALWAYS shows, blank or not: it used to drop out when every number in it was blank, which with no club data was always, and the owner took the tick for broken. The "measured"/"simulated" notes beside the headings went, at the owner's word.

**THE SHOT PANEL IS DRAWN FROM A RECORD, AND DURING A FLIGHT THAT RECORD IS READ AT THE FLIGHT'S CLOCK.** Every state of the shot readout -- in the air, just played, played ten minutes ago, a replay, a range session -- renders one function (`renderShotPanel`, through `gridHTML`) from one record into one panel (`#shotPanel`, 10 October 2026). It used to be three separate fixed stat blocks that each decided for themselves what a shot was worth showing, and until 10 October three readouts as well: the flight bar, the monitor's big-numbers card and the last-shot fold. The record is `cardRecord()`, NOT `lastShot`: `takeShot` writes lastShot before the ball has left the club and the entire flight is simulated in that same instant, so drawing the finished record during a flight puts the carry, total and apex on screen while the ball is still climbing -- a bug that only appears on screen, because every number in it is correct. Until 10 October a live flight therefore showed `priorShot`. Now it shows `liveRecord(flight.record, flight.elapsed)` (shot-data.js): the strike's numbers as they are, and carry, total, apex, hang and offline as far as the ball has got, with descent and landing speed blank until touchdown. Carry freezes at the first touchdown, where it equals the model's carry exactly because physics.js measures both the same way at that instant. The owner asked for numbers that count up with the ball; that reverses the 26 September rule that carry and total never show in flight, and is not a return of the bug, because a number that climbs with the ball reads where it is, not where it will finish. `drawLiveTiles` rewrites only the result tiles, every frame, and only when their text changes. `priorShot` is kept for the mulligan and the replay chain; anywhere lastShot is cleared, priorShot is still cleared too.

**`refreshShotGrid` REPLACES THE GRID ONLY.** `renderResult` writes a hole-out, a penalty or conceded putts above the grid, and a Continue button with it. Changing the tiles (Shot data, a dragged tile, arming the monitor) must not wipe those, so it swaps the `.shot-grid`/`.shot-groups` element in place; `renderShotPanel` redraws the lot and is for the panel's own states. The caption (whose shot, which club, the range session) lives in the header (`#shotCaption`), out of reach of `renderResult` -- as the first line of the grid it was replaced by "In a penalty area" whenever a shot found water, which made the `monitor` smoke journey fail on whichever random courses put its shot in a pond.

**HANG TIME IS `result.hang`, THE TIME TO FIRST TOUCHDOWN.** The tile read `result.time`, which is when the ball STOPPED: a drive that hangs 6.5 s and rolls for four more showed 10.8 s. `simulateShot` now returns `hang` beside `carry`, set at the same instant. RESEARCH's hang figures were never affected -- `tools/flight-fit.mjs` and every study measured strike to touchdown from the points -- only the number on screen was wrong. A record saved before `hang` existed shows a dash.

**NOTHING A LAUNCH MONITOR SENDS BEYOND THE FIVE MAY REJECT A SHOT.** `parseLaunchMessage` validates ball speed, launch, direction, spin and axis hard, because a bad one means the model cannot run and playing the shot would be inventing it. `readExtras` beside it is the opposite case by design: club speed, attack angle, path, face, the spin split and the device's own distances reach a readout and nothing else, so there is no `throw` and no range check anywhere in it. A device sending a string where a number belongs, or a `ClubData` that is not an object, must not be able to stop a real ball being played. Extras are normalised to SI at that boundary like the five; angles stay in degrees, spins in rpm, face impact in millimetres.

**ONE REGISTRY DEFINES WHAT A SHOT NUMBER IS.** `SHOT_FIELDS` in `shot-data.js` carries the id, label, unit, group and formatter for every field, and the grid, the panel checklist, the validation of a saved layout and the tests all derive from it. Add a field there and it appears in all four; add it in two places and they drift. A field's `get` may return a string, which uses the unit declared beside it, or `{value, unit}` to replace the unit for one reading -- which is how sided values put the side AFTER the unit, since the other way round strands the degree sign ("1.1L °") and turns face impact into "2.1 heel mm". A value never carries its own unit, because the tile sets the number at 17px and the unit at 9px; a `get` returning "5400 rpm" as one string gets sized as a number and overflows the column, which is how the card once printed "5400 ...". There is a test on exactly that.

**A BLANK IS NOT A ZERO.** A field the device never sent renders a dash and stays in place, dimmed. A zero is a reading -- "your club path was dead straight" -- and printing one for a number nobody measured is the kind of lie that gets acted on. The tile stays rather than disappearing because a tile that comes and goes as a monitor warms up moves every other tile with it. The DEFAULT set is exactly the eight fields a keyboard shot can fill, for the same reason: a player with no monitor must not open the game to a grid of dashes.

**The shot readout is its own panel, and Copy course code is in the Tools window.** `#shotResult` has moved three times: a floating glass panel, then a section of the course card, then (September) the `.last-shot` section at the foot of the shot controls, and since 10 October 2026 the shot panel (`#shotPanel`), a HUD panel of its own registered with layout.js as "Shot data" -- title bar, grip, resize corner, saved place. The September rule was that it is never a panel of its own, because a panel inside a panel reads as a mistake; that held while it sat INSIDE the controls. The owner asked for it to be movable and resizable on its own, and for the in-flight bar to become it, which only a separate panel can be. `#shotToggle` folds it to carry and total (`shot-open` on `#world`, saved under `fairway-shot-open-v2`; never chosen, open on a big screen and folded on a phone). Its tiles scroll inside it when it runs out of height; the controls no longer share a scroller with the numbers, so the old "only the numbers scroll" rule has nothing left to protect. **Since 13 October 2026 it is back inside the play window**, at the owner's request, once the numbers had become tiles and all it held was a line: `#shotPanel` is a section near the top of `#shotControls` (under `#monState`), and `drawMonitorState` moves the same element under the light in `#monitorPanel` when a monitor is armed and back when it is not -- one element, so every id and handler stays. It is no longer a layout.js panel; a saved position for it is never read. The caption takes its own line under the header (a quarter-width window cannot hold it beside the label), except on a phone, where the label is hidden and the caption shares the header with Skip and the fold. The fold now starts OPEN everywhere, phones included, because a phone's three tiles are meant to be seen; a choice already saved is kept.

**One panel chrome, named once.** The HUD grew its panels before the tool windows existed and the two drifted: radius 9, 10 and 12 across six panels and two different drop shadows, so a popup beside the map read as a different kind of object rather than the same kind in a different place. `--panel-radius` and `--panel-shadow` are the single definition; nine shadow declarations and six radii collapsed onto them.

**Two families, one rule: `--font-display` is Georgia, `--font-ui` is Inter.** Display text is the course title, panel headings and the large numeric readouts you glance at; everything else — labels, buttons, tables, small print — is the UI face. That was always the intent, applied unevenly: `.result-stats strong` and `.hole-info strong` are large numbers sitting inches from `.live-score-par strong`, which was already serif, so the card showed two different fonts for the same kind of number, and `.shot-list-head h2` was the one sans panel heading. Naming both families as tokens is what makes the rule checkable rather than remembered.

CAUTION, and it cost a debugging round: the substitution pass that replaced every `Georgia` literal with `var(--font-display)` ran over the whole file INCLUDING the line defining the token, producing `--font-display:var(--font-display)`. A self-referencing custom property is invalid at computed-value time, so every use fell back to the inherited family and the entire UI came out sans — title included. It builds and it validates; only reading a computed style catches it.

**The tools tray is one panel, not six floating chips.** `.view-tools` had no container at all: each `.tool` carried its own glass background, border, shadow and backdrop blur, so the column read as six unfinished fragments beside panels that are single boxes — and its drag handles had nowhere sensible to sit, which is why they were hanging outside it. It now takes the same chrome as every other panel (`--panel-radius`, `--panel-shadow`, glass, border, blur) and the buttons drop their own, since glass inside glass stacks a blur over a blur and rings every icon inside an already-bordered box. Natural width is 51px: a 37px button plus 12px padding plus the border.

The handles came back inside with it — the grip as a short grab strip along the top, which is what a tool window's title bar is, and the resize in the corner where a tool window's sits. Two pinned widths in the `max-width:560px` block were exact fits for their contents (`66px` for two 30px columns and a 6px gap), so the new padding overflowed them; both grew by the 12px it adds.

**Arrange UI is gone, and `layout.sync` with it — which broke the app.** Once nothing was gated behind arrange mode, a button promising a mode you enter to arrange things was the exact misconception the change removed. The toolbar went, `toggle` went, the `editing` state went, and 18 dead `layout?.editing` gates came out with them. Reset moved to the tools tray beside *Reset tool windows*, each now named for what it puts back.

THE TRAP, and it cost a broken build: `layout.sync()` had a comment saying “several places in main.js call it”, and I deleted the function anyway. `layout?.sync()` guards `layout` being null, NOT `sync` being absent — so every HUD update threw, the fatal handler caught it, and `#world` was replaced by the WebGL-unsupported card. The page looked like a driver problem. Grep for callers before deleting from a returned object, and believe the comment.

**Sim drop and Putting options are disabled on the range.** A practice ground has no round to drop into and no penalty to avoid, and its putting mode is forced to hole-out — the putting panel would have edited the setting for your NEXT round while appearing to change where you are. Mulligan already disabled itself there because `round.history` never fills. A dedicated putting mode is planned; until then it is simply not offered. **Both carry the reason in their `title`**, as the three reading toggles do: a dimmed control with no explanation reads as broken, and "where is putting?" on a practice ground is a reasonable thing to go looking for. The putting button's title is otherwise the current mode, so the range case replaces it rather than adding to it.

**RETIRED 17 October 2026: the round's layout is fixed** (UI_1_0_PLAN 5.1, the owner's call; *The 1.0 round screen*). The history below is kept because it says why a title bar and not the whole panel, which still holds for tool windows. **Every HUD panel moved and resized at all times, not inside a mode.** Arranging used to be a MODE — press *Arrange UI*, dashed outlines appear over seven panels, drag, press Done — which meant the answer to "can I move this?" was no until you remembered the mode existed, while the tool windows beside them dragged whenever you liked. Two behaviours for the same question. `createLayout` now gives each panel a live grip and resize corner. Arrange mode has since been deleted outright -- once nothing was gated behind it, a button promising a mode you enter to arrange things was the misconception the change removed; *Reset panel layout* moved to the tools tray. It works in play, free flight, the studio, the range and the menu backdrop with no per-mode code.

**A title bar, not the whole panel (5 October).** Every HUD panel now carries the same bar a tool window has (`.hud-head`, built in `layout.js`), and on a phone the old corner grip instead. Three traps found building it. **The bar goes FIRST in a panel's markup, except on the weather and the flight controls**, which the stylesheet picks contents out of by position (`.weather>div:nth-child(2)`, `.explore-bar>div:first-child`): there a bar put first shifted every one of them, and the wind readout collapsed onto one line, so those two are marked `'last'` in `sections` and lifted to the top with `order:-1`. That lift only works while a panel is a flex box. The first version lifted every panel that way, and it failed twice: the course card is a plain block, so its bar sat mid-card over the word "Links"; and the shot controls are a flex column only in their default place (`.bottom-area:not(.hud-custom)`), so the moment a player MOVED that panel its bar dropped to the bottom (6 October). A new panel goes first unless something picks its contents out by position -- and then it has to stay a flex box moved or not. And it is a real row pulled over the panel's padding with negative margins (padding measured per panel into `--hud-pt/-pr/-pl` by `pads()`), not drawn in a deepened top border: that needed no measuring, but any panel with overflow hidden or auto clips its border area, which is the map, the course card and every panel once resized, and the bar vanished. The shot-controls column is see-through, so its bar brings its own glass and joins the card under it. The bar cost that column 37px, which at 1280x720 pushed the last-shot fold button under the keyboard hints (`hud-reachable` caught it); below 760px of height the sections pack 8px top and bottom instead of 13px.

**The top bar is layer 50, above every panel (6 October).** The top menu's dropdown is a child of the top bar, so it can never stack above the bar itself. The bar was at layer 5; the panel title bars are sticky at 6 and tool windows at 30, so the open menu drew UNDER the Shot controls bar and its first three items -- Play, Course studio, Main menu -- could not be clicked. Nothing in the menu tested it, because the journeys that leave a round clicked *Main menu* before a panel was underneath it. The profile smoke journey found it. Anything that must cover the top bar sits above 50: the shot list (60), the main menu (80), the notices and welcome (90), the loading screen (95). A new layer between 6 and 50 is fine; one that must cover the bar has to go above 50.

**Not the whole panel.** These are not inert boxes: the map is click-to-aim and drag-to-pan, the shot controls are sliders and a swing button. Making the panel itself draggable would take those gestures from the controls that own them. Verified that dragging inside the map still pans the map (59 m) and leaves the panel where it was, and that a click still moves the aim point.

**The handles live INSIDE each panel, and a MutationObserver puts them back.** An overlay tracking a panel from outside has to be re-synced every time the panel changes size on its own — and these do constantly — so an always-visible overlay would spend half its life in the wrong place. Inside, they track for free. The cost is that `innerHTML` sweeps them away, which is exactly what `showLiveResult` does to `#shotResult` on every shot: the first build left the two most frequently rebuilt panels unmovable, and because the rest worked it read as intermittent rather than total. Each panel now carries a `childList` observer that re-appends its handles; the re-append fires the observer once more, whose check then passes, so it settles rather than looping. Do not replace this with a re-append at the call sites — the one that forgets is the one nobody notices.

## The play screen: the hole in the top bar, the shot panel on the left

Redrawn in September from mockups the owner approved, for every screen size.
**The course card is gone from play.** The hole, par, yardage and pin are in
the top bar (`.hole-strip`, ids `holeNumber`, `holePar`, `holeDistance`,
`holePin` unchanged, so `updateHUD` writes them where it always did) with a
score chip per golfer (`#scoreChips`). **Since 7 October it is one grid**: every
label on one line, every value on one baseline and one size, a thin rule
between the four stats. The hole reads `1/18` (no leading zero -- "01" read as
"O1" in the old serif) and the pin's day moved into its label (`#holePinLabel`,
"Pin · Thu") so the value is one word. Phones keep the same grid, smaller, with
YARDS shortened to YDS and PIN hidden as before; the hole number is no longer
the odd one out (it used to be bigger with no label).

**One typeface, the device's own.** `--font-ui` is the system interface font
(Segoe UI on Windows, San Francisco on Apple, Roboto on Android) -- what the
logo was always drawn in -- and `--font-display` is an alias of it, so the 25
rules that once set Georgia now follow. Canvas text painted into the scene
(yardage markers and the like) uses the same stack through `UI_FONT` in
renderer.js. Inter used to head the list but was never shipped, so it only
appeared on a machine that happened to have it installed. Nothing is bundled:
Segoe UI and San Francisco cannot be redistributed, and every device already
has its own. Headings that were a 400-weight serif take weight 600 in a block at
the foot of style.css, and numbers that change in place are tabular so a digit
changing does not shift its neighbours. Rejected: bundling a webfont (Barlow,
Inter and three others were mocked up) -- the owner chose the logo's font, and
the logo was never a bundled font. **The shot controls are a panel down the
left** (`.bottom-area`, still, so the drag registry and every rule keyed on it
kept working), only as tall as what is in it, with the shot button inside it.
The shot line (`#shotPanel`) is a section at the top of that panel, and the number tiles
sit in a row along the bottom of the course between the controls and the map (since 13 October
2026; before that the line was a panel of its own along the bottom, with the tiles beside it). On the right: the wind at the top, the camera
strip down the edge, the map at the foot. `.course-info` survives for free
flight, where it names the course, and is hidden everywhere else in play.

What it replaced, and why it was replaced rather than patched: the shot
controls spanned the bottom of the screen and the card the top left, so on a
phone the two of them covered most of the course, and the card needed its own
"Shot details" fold to fit at all. That fold is gone with the card.

**On a phone** (below 560 px wide OR below 500 px tall, both ways up) the top
bar is the menu button, the hole, the chip of whoever is up with a count of the
others, the clock's gear and a **Tools** button (`#barTools`); the shot controls are
the shot line, the club, the power and the shot button; three number tiles run
along the top beside the wind (and, held sideways, beside the camera button
too) -- the foot of a phone has 16 px between the controls and the map, and the
top has room now the course card is not shown in play;
the camera strip folds behind `#camButton` (class `cams-open` on `#world`,
closed by picking a camera, tapping elsewhere or Escape); the map sits in the
bottom-right corner with the aim pad under it. The tee picker, the aim arrows
and the Swing Meter button leave the phone's panel; the curve, height and spin
pickers stay as one row of 46 px buttons, spin a single button that steps round
like X (the desktop's - / + pair is under a thumb's width), and held sideways
`#clubHint` goes so the Swing button keeps its height -- `npm run smoke`'s
*every control a round needs is a thumb wide* caught both on 14 October 2026.

**The safe area is read, not assumed.** The viewport asks for
`viewport-fit=cover`, so on an iPhone the page runs edge to edge instead of
being letterboxed away from the notch, and every panel pads itself with
`env(safe-area-inset-*)` through four variables on `#world` -- `--edge-t`,
`--edge-l`, `--edge-r`, `--edge-b` -- which are 16 px (10 on a phone) plus the
inset, and the inset is zero on anything that is not a phone. The top bar pads
its sides the same way. The status bar stays `black`, not translucent: with
`black` the page starts below it, and nothing needs to go under it.

`createLayout` still writes measurements onto `#world` as CSS variables, a
frame after any watched element resizes:

| variable | what it is |
|---|---|
| `--controls-top` | the top of whatever bar has taken the foot of the screen: the drop, free-flight or scramble bar. The map sits above it while exploring |
| `--weather-bottom` | the bottom of the weather panel; the phone hangs the camera button, and a phone held sideways the map, under it |
| `--weather-w` | the weather panel's width; a phone held sideways sets the camera button beside it |
| `--card-bottom`, `--tools-bottom` | the course card and the camera strip, still measured, no longer read by the play layout |

**Written a frame later, not inside the ResizeObserver.** Changing a variable
inside the callback that resizes an observed element trips Chrome's
"ResizeObserver loop completed with undelivered notifications", which is an
ERROR event -- and the smoke test fails on error events, correctly.

**Every rule skipped `.hud-custom`** (until 17 October 2026, when nothing could be dragged any more). A panel the player dragged kept their
geometry. **The saved layout key went to `fairway-layout-v2`** with the redraw:
a position saved for the old bottom bar would have parked the new panel across
the course. Everyone starts from the new defaults once.

**The layout lives in one section of `style.css`**, "The play screen: the hole
in the top bar, the shot panel on the left", rather than as edits to the packed
rules above it -- and those packed rules are strong: several set `display` on
`.aim-control`, `.shape-button`, `.bar-tools`-like icon buttons and
`#clockIcon` with selectors that beat a bare class. **When a rule in the new
section does nothing, suspect specificity first**; the phone's Tools button and
its pin both failed that way, and the fix was a longer selector, not
`!important`.

**The playing area cannot scroll, not even by script** -- `#world{overflow:clip}`.
`overflow:hidden` still lets the browser scroll an element to bring a tapped or
focused control into view, and a Tools window that ran past the bottom of a
phone held sideways did exactly that: the whole HUD slid up under the top bar
and stayed there. New tool windows also open fitted to the screen now
(`cascade` in `popups.js`); they used to open 128 px down whatever the height.

**A ball in the air clears the screen** (`in-flight` on `#world`, set from
`flight` every frame, so a shot, a replay, a skip and a settle all agree). The
camera strip, the camera button, the aim pad and the keyboard hints fade over
0.2 s -- a placed number, quick enough not to feel like a delay. The shot
controls and the launch monitor window do not fade: since 13 October 2026 they
shrink at once to the shot line, the one section of them that stays, because
the line is Skip and the live readout (between 10 and 13 October they went
altogether, and the line was a bar of its own; before 10 October, bigger than a
phone, they folded to their last-shot numbers). A fade would hold the window at
full height until it ended. The top bar, the wind, the map, the tiles and the
shot line stay. **The map follows the ball**: during a flight it is
redrawn every 60 ms, framed on `flight.origin` -- not `round.position`, which
`round.takeShot` has already moved, and which the map's fit is built around,
so the map would reframe mid-flight -- and `drawFlightOnMap` draws the line so
far and the ball over it. **The flight lives in the shot line and the tiles.** History: on 26 September the owner
replaced a live readout (ticking speed, spin, distance and height) with a flight
bar (`#flightBadge`) carrying only what was fixed at the strike; on 10 October
the owner asked for the opposite -- every number at the strike and carry and
total counting up -- in one panel that also keeps them afterwards, and the bar
went. The panel's header says *Ball in flight* or *Ball rolling*, or the
replay's name, with Skip beside it and a pulsing dot; `liveLine` writes the
end-of-flight countdown over that label. The tiles come from the record the
flight carries (`flight.record`, which a replay sets too).

**Markers keep clear of panels by their SHAPE.** `hudInsets` treats a panel
running most of the height as a side to keep beside (the laptop's shot
controls on the left, strip and map on the right) and a panel along the bottom as a
floor to keep above (a phone's panel, map and pad). Treating the phone's panel
as a side squeezed the markers into a sliver beside the map, and the cap then
let them sit on top of it.

**A game screen never scrolls; a menu may.** The main menu scrolls INSIDE
itself if it ever must.

**Two behaviours from the first phone layout survive**: starting a sim drop
closes the Tools window, and a toast is click-through (`pointer-events:none` --
it only ever holds text).

**How it is checked.** `tools/smoke.mjs`'s `hud-reachable` journey visits nine
sizes -- desktop, four laptops, an iPad both ways up, a phone both ways up --
and at each asks the browser what is under every control on the menu and the
play screen, whether the page can scroll, and how much of the course shows,
with the shot panel folded and open. `phone-portrait` and `phone-landscape` play
a hole by touch alone. `monitor` plays with a pretend launch monitor -- see the
next section. Measured when the redraw landed: every control reachable at
every size, no page scrolls, and the course visible, folded, on 63% to 75% of a
laptop, tablet or desktop screen (39% to 65% with the old bottom bar and
course card), 60% of a phone held sideways (was 36%) and 65% upright (was
45%). Opened, the last shot costs at most 6 points, and 12 on a phone upright. Re-measured with the shot panel
along the bottom (10 October 2026): folded 53% (1280x720) to 74% (1920x1080), open 50% to 72%;
a phone held sideways 56% folded and 44% open, upright 65% and 54%. NOT re-measured since the line moved into the play window and the tiles went to the foot (13 October 2026): `hud-reachable` has not been run on it. The browser
only EMULATES a phone -- a real iPhone's Safari, its safe-area insets (zero in
emulation) and a real phone's GPU are still checked by hand.

## The 1.0 interface: layout rules

The interface is being rebuilt on branch `ui-1-0` (approved 17 October 2026
after twelve rounds of mockups; the plan and the mockups are the owner's local
`docs/reports/UI_1_0_PLAN.md` and `docs/reports/ui-1-0/`). Phase 0 laid the
foundations and changed nothing a player sees: the typeface, the palettes, the
layout arithmetic and the kit. The rules below are what every rebuilt screen
keeps; `src/ui-layout.js` holds them as numbers and its test holds every
screen shape to them.

- **One slant, 12 degrees.** The coloured box leans; text and pictures inside
  it stand straight (`uk-p` is skewed -12, its wrapper `uk-pi` +12).
- **A design canvas 1280 wide, as tall as the screen's shape needs**: 720 on
  16:9, 800 on 16:10, 960 on 4:3, scaled to fill the screen. Wider than 16:9 the
  canvas widens (21:9 is 1680 x 720); taller screens get room, never bars.
  Narrower than 4:3 (an upright phone) is `narrow`, with no sheet: phones lean
  row by row and are phase 5.
- **Bands:** header 24 to 64, content 96 to 104 above the bottom, footer 80
  from the bottom and 56 tall.
- **The content leans as one sheet** about its middle line; the boxes in it
  never lean on their own. So every left edge in a column lies on one slanted
  line and every gap is the same from top to bottom.
- **Twelve columns, 14 apart, measured along the middle line.** The column
  width comes from the sheet's height so the leaning corners land exactly on
  60 px margins: the middle-line margin is 60 + half the sheet height x tan 12
  degrees (about 115 on 16:9, giving 74.6 px columns; narrower on taller
  screens, because a taller sheet leans further). Every box starts and ends on
  a column edge: place it with `place(grid, column, span, y)`, never by eye.
- **Sizes:** panels padded 16 top and bottom, 36 at the sides; rows 48, list
  items 56, tiles 96; type 13 (labels, capitals), 18 (body), 24 (values), 36
  (titles), 56 (hero numbers); a label above its value.
- **Selection** is an outline that follows the slanted shape (drop shadows of
  the box), and the current tab is filled. No inner boxes.
- **Colours come from the biome** (`ui` in each biome record): in a round the
  course's, in the lobby and studio the course being chosen, everywhere else
  the course of the week, so the menus change colour every Monday. Red for
  under par is one colour everywhere (`UNDER_PAR`). Every palette passes a
  contrast check over a white and a black picture: 4.5 for ordinary text, 3
  only for the large under-par numbers. **Not checked, and weak:** text on the
  dark end of a highlighted box's gradient (`onHot` on `a2`) is 2.3 to 5.5,
  lowest on Giant Redwood; it reads in the mockups because the text sits on the
  light end, and a screen that puts text at the dark end must not. Giant
  Redwood's and Haunted Hollow's accent `a1` is almost the under-par red
  (contrast 1.0), so an under-par score is never written on an accent.
- **The typeface** is Saira Condensed, 700 and 800, inlined (DISTRIBUTION_REVIEW,
  *Addendum, 17 October 2026*). It has no italic: the slanted numbers are the
  browser's slant, which **the old stylesheet turns off page-wide**
  (`:root{font-synthesis:none}`); `.uk` turns it back on for style only. Without
  that the hero numbers come out upright and nothing errors.

**The canvas and the Text size.** `canvasFrame({width, height, zoom})` takes
the screen in CSS pixels and the Text size. At 100% the canvas fills the
screen (`drawn`: each design pixel is drawn 1.5 CSS pixels on a 1920 x 1080
screen, 0.8 on a 1024 x 768 one). The Text size
multiplies that, and the canvas gives up design room by the same factor so it
still fills the screen exactly -- the rule the Text size has always followed,
"laid out as a window z times smaller". Scaling the 1280 canvas up instead
would run it off the screen; scaling it to fit regardless would make the Text
size do nothing. **PLACED:** the canvas never gets narrower than 1024 design
pixels (125% on 16:9); past that a larger Text size still enlarges the old
interface but not the canvas. The canvas root goes inside `#app`, which the
stylesheet already zooms, so the root's own transform is `drawn / zoom`
(`scale`), never `drawn` -- applying both multiplies the Text size twice. A
pointer's design position is `(clientX - root left) / drawn`. Not yet wired:
phase 1 is the first screen on the canvas.

**SKEWING A PARENT AND STRAIGHTENING A COLOURED CHILD MAKES AN UPRIGHT BLOCK.**
Found in the mockups when the sheet started leaning as one: a coloured box
inside the leaning sheet, given the straightening skew so its text would
stand up, came out as an upright rectangle -- the two skews cancel on the
colour as well as the text, so the slant vanished from exactly the boxes that
should show it, with nothing wrong in the markup. Inside the sheet the panel
itself does not transform (`.uk-sheet .uk-p{transform:none}`), only its
contents are straightened, and the straightening wrappers (`uk-pi`, `uk-u`)
never carry a colour. `tests/ui-kit.test.mjs` refuses a background on them.

**A SHORT SHARED CLASS NAME SILENTLY RESTYLES ANOTHER SCREEN.** In the mockups
a highlight class called `hl` written for one screen restyled boxes on
another that happened to use the same name, and nothing said so; the
stylesheet the kit sits beside is 180 KB of short names. So every kit class
starts `uk-` and every kit rule is scoped to `.uk`; `tests/ui-kit.test.mjs`
refuses either slipping. Keep new screens' own classes prefixed the same way.

## The 1.0 round screen

Phase 1 of the 1.0 interface (17 October 2026, branch `ui-1-0`).
`src/round-hud.js` decides what each piece says, `src/round-hud.css` where it
sits, `drawRoundHud` in main.js fills it on every `updateHUD`. **Built without
being seen**: the owner allowed the browser pane for this phase, then asked for
the phases to run overnight with nothing on the graphics card, so none of it has
been looked at (TODO, *The 1.0 interface*).

**Where everything went.** Hole slab (number in the biome's gradient, course
name and pin, "PAR 4 / 412 YDS") top left, and under it the conditions (wind
with its arrow, plays like, the rise in feet). Golfer cards top right: the
golfer up gets the big card (ball in frame ring, title, level tag, XP bar,
score), everyone else a plate; a card does what a score chip does
(`pickGolfer`). The map down the right, straight, under the cards. The club
bottom left (the hot block holds the code, the real `#club` select is the
name), the keys under it (the Esc one clickable; on the range an R key opens
the range controls). The lie line and, when a monitor is connected but not
armed, its strip above the club. The shape chips above the meter, the Swing
Meter bottom middle; with a monitor armed the meter gives way to the ball light
(the monitor window, restyled: its word, who is up, the Armed switch, Reconnect
only once the device is lost). The pin tag is the flag label, restyled. The
last-shot line keeps a place under the conditions until phase 2's shot card.
A faint logo bottom right.

**Gone from the round:** the top bar, the shot controls window, the weather
window, the camera strip, the Swing button (the bar is the tap target, and
Space), the aim buttons and the typed aim distance (arrows and the map aim;
the typed distance has no home yet), temperature and the weather words (in the
pause list's conditions line).

**Esc opens the top bar as a pause list** until phase 3's pause screen: the
same elements, laid out as rows (`#app.rh-paused .topbar`), plus Resume, the
tee picker and the Swing Meter button (moved there from the shot controls;
both were already hidden on a phone), a row of camera buttons (they press the
camera strip's own, `data-proxy`) and the conditions. Any press in it closes
it, except the clock and the tee picker, which are worked in place. While it is
up the game's keys are ignored; the round itself does not stop. **Smoke
journeys reach top-bar controls through `t.chrome()` and `t.menuItem()`**,
which open the list where the round screen hides the bar.

**Phones (phase 5, 17 October 2026) have their own round screen** (`src/round-phone.css`, the phone query): the same pieces at the phone's real size, sideways and upright as the round-12 mockups place them -- the hole top left, golfer chips top right, a small straight map, the slanted three-by-three aim pad (the old pad's buttons, so their names and the hold-to-sweep still work), the club bottom left, a narrow Swing Meter you tap to swing (no Swing button), a MENU chip in place of Escape that opens the same pause list as one scrolling column. #world carries `--hud1` in the phone query too, so main.js treats a phone as the round screen; `phoneScreen()` still says it is a phone. Touch targets are 44 px (the phone journeys check it: the club picker was 36 tall until they did). On a phone the main menu's rows lean one by one, one height, two columns sideways. The sheets on a phone are unchanged. **Only in play and off a phone.** Every rule sits inside the inverse of the
phone query (`min-width:561px and min-height:501px` on `#app`), and #world
carries `--hud1:1` there so main.js asks the same question (`hud1`, read on
each `updateHUD`). A phone keeps today's round screen until phase 5.

**Size.** Every piece is laid out in design pixels and zoomed by `--hud-z`
(`hudScale`): the 1280 canvas's scale, but never wider than the screen over
`ROUND_MIN_WIDTH` (1160, PLACED: the room the club panel and the meter need
side by side), never below 0.75. **The Text size barely enlarges the round
screen on 16:9** -- the pieces already span it at 100%, so it can add about a
tenth; on taller and wider shapes the same. That is a departure from "the Text
size still multiplies it" and is the owner's to overrule. The map's canvas is
drawn at the device pixel ratio times the zoom so it stays sharp.

**ENTER AND SPACE IN A MENU.** The game's keydown handler cancels Enter and
Space (they swing and finish a shot) in every mode, so a menu driven by arrows
could not choose anything; the focus listener presses the focused button
itself while `focusScope()` names a screen. **The Esc list is a three-column
grid on the old top bar** (`#app.rh-paused .topbar`): the old bar's
`align-items:center` centred each column until `align-items:start`, and its
own width rules shrink the monitor label to nothing, so the list overrides
both. **The shot card is kept clear of the foot and the map** in
`placeShotCard`, or a short shot's card covers the meter.

**THE SHOT CONTROLS ARE `display:contents`**, so the children they kept (the
club, the lie, the shape chips, the monitor strip, the shot line) can be pinned
where the design puts them without moving them in the markup -- ids, handlers
and the phone's layout untouched. The trap: **any new child of `.shot-controls`
lands loose at the top left of the course** unless round-hud.css gives it a
place or hides it.

**A LABEL THE FRAME LOOP POSITIONS IS SCALED BY `transform`/`scale`, NEVER
`zoom`.** The flag and aim labels get inline `left`/`top` every frame;
`zoom` would multiply those too and throw the label off its flag.

**AN AUTHOR `display` BEATS `[hidden]`.** Every restyled piece that is hidden
by the attribute (the monitor window, the monitor strip) needs its own
`[hidden]{display:none}` or a `:not([hidden])`, or it shows when it should not.

**Shot moments (phase 2, 17 October 2026; also not seen).** `src/shot-display.js`
says which numbers show: on a course a **card** pops up beside where the ball
came to rest (`#shotCard`, placed every frame by `placeShotCard`, scaled by
transform like the flag label) with the total large and carry, ball speed and
offline under it, and fades after 6 s (`CARD_HOLD_MS`, PLACED); on the range
the **tiles** stay, in a fixed grid top right with carry lit, and the golfer
cards move under the hole slab. **Tab** shows every number as tiles until
pressed again (the keys list moved to ? and the Esc list's Help). The player's
choice -- automatic, always the card, always tiles -- is the Esc list's *Shot
numbers* row, kept per device under `fairway-shot-display-v1`. On the round
screen `placeTiles` clears the tiles' inline places and returns, and tiles
do not drag: the stylesheet lays them out. `src/celebration.js` says which
**banner** a hole-out earns: the full-width band in the course's gradient for a
birdie or better (any hole in one), a quiet strip otherwise, in / hold / out
200 / 1500 / 300 ms and never past two seconds, by test; the banner gets
`leaving` as it starts to go and `flashTurn` names the next golfer then,
not after. The XP flying to the card is not built. The **scorecard** between
holes fills the screen in the course's colours, the finished hole's number
flashing (`th.rh-done`), each score marked as on paper (`paperMark`: a
circle round a birdie, two round an eagle, a square round a bogey, two round
worse); its columns do not lean -- the cells are text, not wrappers, and a
leaning table with upright numbers needs them rebuilt. **Round complete**
(`roundCompleteHtml`, at the head of the final card, not in match play):
standings with ties sharing a place and the winner in the gradient, each
golfer's XP this round (`xpThisRound`, the ledger entries keyed to the
round), level, and the handicap the round moved (`handicapLine`: the
profile summary with and without this round); New round, Save card, Main
menu. "Play again with the same group" and the round's three highlights are
not built.

**A COLOURED BOX WITH TEXT IT CANNOT WRAP LEANS BY A PSEUDO-ELEMENT.** The
restyled controls carry text nodes that cannot be counter-skewed, so the
slanted panel is a `::before` behind them (`isolation:isolate` on the box), the
box itself stays upright, and the text with it -- the kit's rule (only the
colour leans) by another route.

## The 1.0 sounds (wired in 17 October 2026)

Phase 4 of the 1.0 interface (17 October 2026). `src/chiptune.js` holds the
family C tunes the owner picked in the mockups (prog metal, clean tone,
half-time grooves with an echoing lead) for hole in one, eagle, birdie, par,
bogey, level up, round complete and XP counting, and the six interface sounds
(menu move, select, back, toggle, locked, monitor ready), as event lists in
sixteenth notes, with the player ported from the mockup (`playChip`: pulse
guitars and leads, triangle bass, noise drums, a dotted-eighth echo; never
scheduled in the past; its noise is a fixed sequence so a tune sounds the same
twice). **They are wired in** (the owner: "you can also wire all the new
sounds i agreed on", 17 October 2026; `CHIP_SIGNED_OFF` records it). audio.js
plays them: `score` sends hole in one, eagle, birdie, par and bogey to family
C and albatross, double bogey and worse to the 14 October jingle (`CHIP_FINAL`;
PLACED, family C has no tune for them); `moment('level' | 'xp' | 'round')`;
`ui('move' | 'select' | 'back' | 'toggle' | 'locked' | 'ready')`, with
interface sounds within 45 ms of the last skipped. main.js calls them from the
XP popup (fill and level-up; its `gain` take stays), the results (round
complete, once per round), `moveFocus`, a captured click on the main menu or
Esc list, Escape, the green-reading buttons, a pointerdown on a locked look and
`drawMonitorState` turning green while armed. Levels are `CHIP_LEVELS`
(0.32 / 0.22), measured by check.mjs. **The marimba stings are deleted**
(`INSTRUMENTS`, `score()`, `FINAL.scores`); `SCORES` keeps each score's name and
notes for the stings report. TRAP: the sound-lab main page inlines chiptune.js
inside a function scope (`/*CHIP*/`), because pasted beside sound.js its short
names (`L`, `D`, `B`, `noise`, `pulse`) would collide.

## The 1.0 menus and windows

Phase 3 of the 1.0 interface (17 October 2026, branch `ui-1-0`; **not seen**,
like phases 1 and 2). Off a phone only, like the round screen.

**Arrows and a controller** (`src/ui-focus.js`, tested): on the main menu and
the Esc list, the arrows -- or a controller's d-pad or left stick -- move the
focus to the button in that direction (nearest along it, sideways distance
counting double; a single column or row wraps), Enter or the pad's A presses
it, B or Start backs out of the Esc list, and Start pauses a round. A capturing
keydown listener takes the arrows before the game does, but only while
`focusScope()` names a screen; a text box, slider or drop-down keeps its own.
The test walks every layout the menus use: every button reachable from every
other, none a dead end. **The panels and tool windows are not on it yet** --
they keep Tab.

**The main menu** is the approved title screen by restyling the old markup
(`src/ui-screens.css`): the logo top left, one list down the left (each tile a
slanted row; the focused one, or Play when nothing is focused, in the
gradient), the links under it, the main golfer's card on the right
(`drawMenuCard`: ball in frame, name, title and level, XP into the level, the
challenge of the week), the keys at the foot. Menus wear the course of the
week's palette, the studio its own landscape's, a round its course's
(`applyHudPalette`, on every `setMode`).

**Every other panel and window is restyled, not rebuilt.** The old stylesheet's
own variables are set from the palette for everything under #app (`--glass`
is the panel colour, `--accent` the light end of the gradient with `--on-hot`
text, `--font-display` Saira Condensed), so the sheets, tool windows and
dialogues take the biome's colours and the typeface; the main buttons and tabs
lean (pseudo-element), headings are the italic capitals. Their layouts are the
old ones (the lobby, monitor setup, profile hub and settings since rebuilt, below):
challenges, course of the week, saved courses, studio, launch monitor setup
and range controls of the plan are **not rebuilt on the kit** (TODO). **The
Esc list gains the standings**: each golfer, how far through, against par.

**THE SHEETS ARE OUTSIDE #app.** `#drawer` (every sheet: the lobby, My profile,
saved courses, challenges, the course of the week, launch monitor setup, help,
the scorecard) and the dialogues (`.version-notice`: the welcome, leave and
version notices) are children of body. So nothing keyed on #app reaches them:
not the app's container queries, not the palette (now set on the page root,
`applyHudPalette`), not #app's Text size zoom, and not `--hud-z`. Their 1.0
rules are in `src/ui-sheets.css`, matched by `@media` on the screen's size,
scaled by `--sheet-z` (the round screen's scale times the Text size, on the
root), with the old variables mapped to the palette there. Found by the first
look on 17 October 2026: the sheets were still green, and the phase 2
scorecard and round-complete styles, written under the app's query, had never
applied at all (moved to ui-sheets.css).

**The sheets as 1.0 screens (17 October 2026, second pass).** Full screen,
the header band (the screen's name, Esc back), each control a slanted panel
in a stack, the main button (`[data-panel-action]`) bottom right in the
gradient, tabs as slanted chips. The other sheets keep their tabs: My
profile is the hub with the Look locker as a tab, as designed. Not in the
course studio, whose sheet takes the play area. An open sheet is in
`focusScope` (arrows, menu sounds; B closes it).

**The 1.0 lobby is the mockup's layout** (`src/ui-lobby.js`, 17 October
2026, third pass): three columns -- the course (a picture panel in the
landscape's colours, the name panel, Change course ◀ ▶, Surprise me, then
Course studio, Manage & share and Delete), the golfers (a row each: colour
bar, the ball in its frame, the name, LV and HCP; + Add player; the tees;
the lie-penalty note), the format and rules (four tiles, then ◀ ▶ pickers
for putting, out of bounds and the lie penalty) -- and saved rounds along
the foot. The lobby wears the colours of the course being chosen
(`lobbyBiome`, cleared when the sheet closes). **MOVED, NOT REBUILT:**
renderPanel still writes the old lobby and wires it; `buildLobby` then moves
those very nodes into the columns, so every id, handler and rule is the old
one. A tile or arrow sets the real drop-down and fires its change; a
picker's drop-down lies see-through over its value, so clicking the value
opens the list and Playwright's selectOption still works (`#roundOB`); the
format drop-down stays in the page, hidden (the skins journey sets it). The
tabs ride in the footer band and scroll to a column -- pulled up into the
header they were clipped by the scrolling content. **PLACED:** tees are one
choice for the group, as the round rules have it, not chips on each golfer's
row as drawn; the course picture is the landscape's colours, not a
photograph (none exists before the course is built); the format's note and
putting's note stay under their controls (the mockup has none); "your best"
on the course is not shown; saved rounds scroll into view on 16:9 (the
mockup shows them on 4:3 only). A phone stacks the columns in the old look.

**Launch monitor setup is the mockup's layout the same way**
(`src/ui-monitor-setup.js`): three numbered steps on the left, ticked from
the game's own state (bridge connected; a device talking; armed -- a step
is never done ahead of the bridge), with the moved Arm switch under them;
the status on the right -- the ball light, bridge and device rows, the
address box, the last shot, Connect bridge and Try a sample shot (its JSON
folded under *Edit the sample shot*). `monitorSetup.paint()` redraws it on
a status message, the Arm switch and every `updateHUD` while it is open. The
old notes and connector list run along the foot (PLACED).

**My profile is the hub** (`src/ui-profile-hub.js`): the golfers' chips (the old
`.profile-switch`) fixed in the header band; the left stack (who, level and
bar, sim handicap, playing since); six tabs. `renderProfile` still writes the
old page and adds the hub's own blocks (`hubBlocks`: `.ph-since`,
`.ph-overview`, `.ph-preview`); `buildProfileHub` sorts the rest by heading
(`tabOfHeading`) -- **a new heading on the profile page needs a line in
`SECTION_TAB`, or its section lands on whichever tab came before it**. Every
choice on the page redraws it, so the tab shown lives in main.js
(`profileHubTab`). On the Locker tab the left stack swaps to what is worn now
(the locker mockup's live preview), by CSS on `.ph[data-tab]`.

**Pause is two columns** (the Esc list, reshaped toward the mockup): Paused,
Resume and every action down the left; the course, standings, tee, Swing Meter,
shot numbers, cameras and conditions on the right. **Settings: help on
demand.** In the tool windows each control's explanation shows while it has the
focus, and ? (with the focus in a window or a sheet) shows them all
(`#app.rh-help`).

**Settings is one screen from the menu** (`src/ui-settings.js`, 17 October
2026, third pass): Camera & bay, Graphics and Sound opened as sheets get the
category list down the left (Camera & bay, Graphics, Sound, Launch monitor,
Help & controls -- each opens its own sheet; the mockup's Display, Controls,
Data & backup and About map onto these, PLACED), every group shown at once in
two columns of rows, and the help line at the foot for the focused row. CSS
only turns the real controls into rows: a tick box is drawn as an ON/OFF
switch (`appearance:none`), a drop-down as a value with ▶, a slider as a
segment bar filled to `--fill` (the track is masked into segments). **One
focus listener for good:** #drawerContent outlives every sheet, so
`buildSettings` wires `focusin` once and swaps `root.stFocus`; adding a
listener per render piled them up. In a round the same panels are tool
windows and keep their own layout.

**`#app>*` RESETS THE OLD VARIABLES.** A rule in style.css that sets
`--glass` or `--accent` on a deeper element still wins there; one that
reads them gets the palette. `--accent` is now the LIGHT end of the gradient
and its text `--on-hot` -- the dark end (`--a2`) under light text fails the
contrast check on Giant Redwood (*The 1.0 interface: layout rules*).

## Playing by touch

A tap on the course aims wherever the finger lands, and at 200 yards a
fingertip covers several yards of fairway: on a phone a tap got you close and
nothing got you exact. Four pieces fix that, each with a rule.

- **The aim pad (`#aimPad`) sits in a phone's bottom-right corner**, under the
  map, a child of `#world`. It was first a child of the old bottom bar, riding
  above it, which moved with the bar for free; with the shot panel on the left
  and the shot button in it, the pad went to the other thumb, and it now hides
  itself wherever the panel hides (the "where it hides" rules). Phones only:
  everywhere else the aim arrows are in the panel. Its buttons are disabled by
  the same test that gates them, `canNudgeAim()`, set in `updateHUD` beside the
  swing button.
- **Nudges are half a degree and a yard a tap** (`AIM_TAP_DEGREES`,
  `AIM_TAP_YARDS`). "Further" moves `aimRange` for a full shot, but for a putt
  it moves POWER, because a putt's length comes from its power and the roll
  preview ignores `aimRange`. `holdToRepeat` drives the pad and the bar's
  arrows: the press is exactly one tap, and a hold past 0.35 s repeats at a
  rate climbing from 3 to 24 taps a second. A pointer's own `click` is
  ignored because its press already stepped; a click with `detail` 0 is a
  keyboard press on the focused button and counts once. **Symptom if the
  press and the click both step: every tap moves twice.** `contextmenu` is
  cancelled, because a long press on Android opens one and ends the sweep.
- **The big map is the SAME canvas**, with `aim-view` on `#world` laying the
  `.minimap` panel over the course. Its rules are `!important` because a
  player may have dragged or sized the map, and those positions are inline
  styles. `setAimView` resets the zoom both ways -- a zoom chosen on the big
  map means nothing on a thumbnail. **A touch tap on the thumbnail opens it
  instead of aiming** (`mapPointerType`); a mouse still aims from the
  thumbnail. It closes itself in the frame loop whenever a ball is in the air,
  a panel is open, the flyover runs or the menu is up -- checked every frame
  rather than at each of those starts, because each starts several ways. The
  enlarge button sits ON the canvas, lifted by a negative margin and paid back
  below, so the panel is exactly as tall as before; the header (it pushed the
  button off the panel on a tablet and, allowed to wrap, made the map 25 px
  taller on a laptop) and the footer (squeezed out of the panel on a small
  screen held sideways) were both tried and rejected.
- **Two fingers zoom the map.** Every pointer on it is tracked in
  `mapPointers`; with two down, the change in spread zooms about the OLD
  midpoint and the change in midpoint then pans. Zooming about the new
  midpoint in the old frame and panning as well moves the map twice.

**No browser gestures in play**: `touch-action: manipulation` on `#world` and
the top bar stops a double tap zooming the page (it intersects with the
`none` already on the scene and the map, so those keep their own gestures);
`overscroll-behavior: none` on the page stops a pull-down reloading it;
`user-select: none` stops a held arrow selecting the words beside it.
Pinch-zoom of the page is deliberately left alone outside the scene and the
map -- it is how someone who cannot read the small print reads it.

**Thumb-sized targets without moving anything.** On a coarse pointer, small
top-bar, camera and map buttons get an invisible `::after` margin reaching
48 px, `inset: min(0px, calc(50% - 24px))`, so nothing already bigger shrinks
and the button looks the same. Where two buttons are closer than that the
margins meet halfway. **A container that clips clips the margin too**: the
score chips (in a strip that hides overflow) and the last-shot line (in the
panel) are therefore 44 px tall outright on a touch screen. And **the margin
is measured from the nearest positioned ancestor**: "Copy course code" moved
into the Tools window, lost its own positioning there, and its margin
stretched across the whole window -- every tap in Tools landed on it. It has
no margin now; it is a full-size button. Panel grips are left small on purpose -- a generous
grip steals taps from the controls beside it.

**The Add to Home Screen hint** (`#homeHint`) shows on the menu once
(`fairway-home-hint-v1`), only on iOS -- an iPad calls itself a Mac and is told
apart by its touch points -- only over http(s), and never inside the installed
app (`display-mode: standalone`, or Safari's own `navigator.standalone`).

**Checked by** `touchAiming` in both phone journeys -- a tap on the pad turns
exactly half a degree, further is exactly a yard, the pin button matches the
bar's Aim at pin, a held arrow sweeps and stops when the finger lifts, the
thumbnail opens the big map, a pinch zooms it, a tap on it aims, Done puts it
away unzoomed -- and a probe that walks outward from the middle of every
control a round needs and fails anything under 44 px to a finger that is not
sharing the space with a neighbour. Two fingers go through Chrome's own touch
input over the DevTools protocol (`fingers`), because Playwright's
touchscreen can only tap. `home-screen-hint` runs as an iPhone on a served
copy. **Launch-monitor mode is checked without a monitor.** The `monitor` journey
answers the game's WebSocket itself with Playwright's `routeWebSocket`, sending
what `bridge/server.mjs` sends -- status messages for red, amber and green, and
a shot message -- and checks the panel's words, which controls go and stay,
that the shot is ACKed as accepted, the grouped numbers in the shot panel and
the device named in its caption, that the numbers stay while the next ball is
found and teed, that armed the shot controls give way to the launch monitor window, that ↑ moves the aim point (not the power) and the pin label gives way while it does, and that the window's Armed switch brings the controls back. **The route has to exist before the
page loads**: Playwright patches the page's WebSocket as the document starts,
so a route added after load never sees the connection and the game reports
`ERR_CONNECTION_REFUSED`. Journeys may declare `prepare(page)` for that; it
runs before `goto`.

**Use the smoke harness, not the in-app browser pane, for touch work**:
at an emulated phone size the pane delivered clicks at half the coordinates,
so a tap aimed at the pad landed on the course, swung the aim 170 degrees and
once started the flyover -- which looks exactly like a bug in the pad.

**`.view-tools` gets its grip outside its own box.** It is a 30px column of buttons, and a grip inside its top-left corner sits on the first button and steals its clicks. On a right-edge panel, just outside the left edge is still on screen.

**Handles are dim, not hidden.** Seven permanently bright grips on the playing area is worse than the problem it solves; an invisible affordance is no affordance, and a touch screen has no hover. They sit at 0.22 opacity, rise on panel hover, and go fully bright while any panel is being dragged so you can see what you are lining up against.

**The map pans and zooms, and the nav rides on the canvas.** `mapLayout` still fits the frame to the hole (or the whole course); `nav` — `{zoom, x, z}` — then scales and shifts that fitted frame, so zoom 1 with no offset is byte-for-byte the map as it was. The state is stored as `canvas.mapNav` beside the existing `canvas.mapTransform`, NOT threaded through `drawMap`: five call sites in four different places draw this map, and an argument is how one of them ends up without it — which would read as the map resetting itself in that one mode. Storing it on the canvas is what makes pan and zoom work identically in play, free flight, the studio and the menu backdrop with no per-mode code at all.

**The drag re-anchor must carry the pointer id.** `mapPixels` returns `{x, y}` and nothing else, so re-anchoring with a bare `mapDrag = p` dropped the id — and the very next move failed its own `e.pointerId !== mapDrag.id` guard and returned. The map moved exactly once and stopped, which reads as the drag breaking rather than as a limit being reached. This is `main.js` DOM code and the suite cannot reach it; it was found by logging `mapNav.x` after each of six synthetic moves and seeing the same number six times.

**The pan limit is measured against the viewport, not just the content.** The first version clamped the centre to the content's own half-extent, which at the fitted zoom let a hole map move about fifty pixels before stopping dead — the same symptom as the id bug, from a different cause, which is why both had to be fixed. The rule is now "the content must still overlap the viewport by at least half a screen", so the limit grows as you zoom out: the further out you are, the more empty ground there is to swing across.

**A drag is not a click.** The map has always been click-to-aim. A pointer that moves more than 5 px sets `mapMoved`, and the click that the browser sends afterwards is swallowed — otherwise every drag fires an aim at wherever the finger came up. Verified in the browser: dragging leaves the aim readout unchanged, clicking moves it.

**`mapPosition` is the inverse of `mapPoint`, and click-to-aim rests on that staying true once the frame can move.** A test round-trips world points through both at several zooms and pans, because a broken inverse does not look broken — it just aims somewhere the player did not click.

**Zoom is about the pointer, not the centre.** `zoomAbout` recovers the fitted centre as `cx - panX`, so it never has to recompute the layout to find its own origin. Zooming about the centre instead makes the map crawl away from whatever you were trying to look at.

**The pan clamp binds, deliberately, and one test says so.** The viewport centre is held inside the fitted content box, so the course can be pushed to the edge of the frame but never off it — an unclamped drag loses the map and nothing on screen says which way to drag back. The consequence: on a long thin hole at zoom 1 the x axis has slack in view but no content to pan over, so zooming about a corner there cannot hold that corner exactly. That is correct, and the zoom test asserts stillness from a zoomed-in start (where the gesture is actually used) with a separate centre-only test isolating the arithmetic from the clamp.

**`panBy` adds its offsets, and the first version subtracted them.** `mapPoint` is `w/2 - (p - c) * scale`, so screen position grows WITH the centre: raising `cx` slides the picture right. Reasoning from "+x is screen-left" — true of the world axis, irrelevant to the centre — produced a map that ran away from the pointer at twice the speed it should have followed it. The test caught it, not the browser.

**The nav resets with the world.** `loadCourse` calls `resetMapNav()`, because a pan and zoom belong to the thing being shown; carrying them onto the next hole leaves you looking at empty ground. Double-clicking the map resets it too — a zoomed map with no way home is a trap — and the title gains a `· 2.6×` suffix whenever the map is not showing the whole thing, so a map left zoomed does not read as half a hole and a generation bug.

**Saved courses is a menu tile; saved rounds moved into the round panel.** The course library was only reachable from inside the round panel and the studio, which made it feel like a sub-feature of starting a round. It is now a tile beside Course studio, tabbed like every other menu dialogue: *Your courses*, *Save a course*, *Import & export*. Saved rounds left the main menu and the in-game nav for the round panel's fourth tab, beside the import/export that makes them — moving the entry without moving the LIST would have stranded every saved round.

**Course files are additive, and that is deliberate.** A code carries one course as pasteable text; a file carries the whole library, which is the backup case codes are a bad fit for. The import adds and never replaces: wiping a library with one click on the wrong file is not a mistake anyone recovers from. Unreadable entries are counted and reported rather than aborting the whole import.

**AN ENDLESS ROUND EXPORTED TO A FILE CAME BACK AS THE WRONG COURSE.** `saveRecord` writes a PLACEHOLDER settings object for an endless run — correctly, because an endless hole is a seed and a hole number, not a landscape — and `resumeRound` knew to regrow it with `endlessSettings(endlessHole(seed,hole))`. The file-import path did not: it did `settings={...DEFAULT_COURSE,...d.settings}`, so an imported endless run built a default nine-hole course with the run's hole number pointing into it. Both paths now agree. Saving and resuming from the library was always fine; only the file round-trip was broken.

CAUTION: `PANEL_TITLES` already had a `library:` key further along the object. Adding a second one silently lost to it — the last key wins in an object literal — and the panel kept its old title while every other change appeared to work.

**There is no putting camera any more.** A `putt` mode used to replace `player` the instant the ball reached a green — eye 1.1 m up, 1.8 m behind the ball, field of view clamped to 53 — and the flight follow framed a putt differently too. The cost was that the camera a player had set up was silently replaced on every green, and the *Game camera* panel looked dead there because height, distance and offset were all being overridden. It reads as a broken tool, and it was reported as one.

Removed in five places: the automatic swap in `playCameraMode`, the swap in `setUpTurn`, the one in `replayShot` that picked a camera from the shot, the renderer's dedicated placement and FOV clamp, and the `putting` flag passed to `flightCameraPose`. The option is gone from the camera select. `playCameraMode` survives as the identity function rather than being deleted at its call sites — it is the one place that decision was made, and leaving it there keeps it in one place if it is ever wanted again.

A save written before this still carries `mode:'putt'`, so the restore coerces it to `player`. Without that the player lands in a mode the select cannot display and the renderer no longer places — it would fall through to the default branch and look right by luck rather than by design.

**The 2D views are a tool, not a takeover.** Side-on and top-down are the two shapes the 3D view cannot make — it looks down the one axis each of them measures — but they are also not what you want on screen while you are hitting. So *Shot views* is a `TOOL_PANELS` popup you open, and it draws nothing until you do. `drawShotViews()` is a no-op when the panel is closed, which is why every caller can call it without asking whether anyone is looking.

**`viewShot` follows play until a row pins it.** Null means "the last shot", so an open panel is live; choosing *View* on a shot-list row pins that record and closes the list. Every new shot clears the pin — a panel that jumped to the live ball the moment you opened an old row would make the row unreadable, and one that stayed pinned forever would quietly stop being about the shot you just hit.

**`shotProfile` and `offlineOf` must agree, and a test asserts it against each other rather than against a worked example.** Both reduce a shot to how far off the AIM line it finished — not off the line to the green — so a shot aimed at the 250 target and hit straight reads straight in the plot and in the OFFLINE column alike. Checking them against each other stops them disagreeing, but it cannot stop both being wrong the same way, and they were: until 5 October both called local +x "right", which is the golfer's left. `tests/range.test.mjs` and `tests/shot-views.test.mjs` now pin which way is right on its own, against the renderer's rule.

**Height is measured from where the ball was struck, as if the ground were flat.** `shotProfile` subtracts the first trajectory point's height from every sample — the same reference `simulateShot` measures `apex` from, so the plot's apex label and the APEX readout are one number, and `tests/shot-views.test.mjs` checks the two against each other over rolling ground. It is not clamped: a ball that finishes below the tee is drawn below the line, and one on a raised green finishes above it. **Rejected, and what it looked like:** until 12 October 2026 height was clearance above the turf under each sample (`course.height`, clamped at zero). It sounded right — "how far off the ground" — but on a course it bent a smooth flight over every hump and hollow under it, so the curve read as lumpy, and the apex it labelled was a different number from the shot's own APEX. The owner reported it as "the height plot changes with the terrain the ball flies over".

**The plan view draws the golfer's right DOWN the canvas.** The ball runs left to right across it, so this is a map of the shot from above, turned so the shot runs along it. `frame` draws larger values higher, so `drawPlanView` plots `-off` (`planValue`); `off` itself stays positive-right, because `offlineOf` and the R/L label depend on that. **What it looked like when wrong:** until 12 October 2026 the plot drew `+off`, so every slice bent toward the top — the golfer's left, seen that way — beside a label correctly saying R. The test reads the drawing calls from a stand-in canvas and checks a ball finished right lands below the aim line. The distance label sits between the finish and the aim line, the one place the track never runs; just above or below the dot it sat on the incoming curve.

**Two plot rules that are not cosmetic.** The plan view forces a SYMMETRIC cross-axis with a 2 m floor: without it, a dead straight shot has a span near zero and any rounding wobble fills the plot with what looks like a slice. And `distanceTicks` picks its step off a ladder so the step is never larger than the shot — a fixed 5-yard grid left a four-yard putt with no gridlines at all, a bare axis that reads as a broken plot rather than as a short shot. The test suite caught that one, not the browser.

**Any recorded shot can be replayed, and the record is the shot rather than a request to re-run it.** `replayShot(record=lastShot,label,state)` took no argument before; the shot list passes a row's own record. The row keeps `replay:lastShot`, whose `result.points` is the SAME array `pushTrail` holds, so a shot still on the field costs nothing extra; past `SHOT_LINE_MAX` the payload is dropped (the row would otherwise be the only thing keeping a ~660-point flight alive in a session with no end) and the row's Replay button goes disabled with a title saying why.

REJECTED: re-simulating from the five launch numbers. It would have been exact and unbounded — `simulateShot` has no `Math.random` and `localWind` is a pure function of settings, both measured rather than assumed — but it reads the world as it is NOW, and on a range the green moves and the firmness changes. A replay that quietly shows a different roll than the one you hit is worse than no replay.

**`flight.origin` closed a latent bug this exposed.** The live distance readout computed `flight.replay?lastShot.shot.origin:latest.shot.origin`, which is right only when the replay IS the last shot. Every flight now carries the origin it was struck from. Confirmed live: replaying shot 1 of a three-shot session peaked at 162.9 yd, which is that row's own total.

**SUPERSEDED by the lab-mode removal — kept for the reasoning.** `recordRangeShot` ran under `rangeMode` only, so the lab's *Shot data* chip opened a list that was always empty even though the lab shares the range's player card. The lab now records too, from a line placed BEFORE the range branch's early return — the lab does not take that return, because it plays a real one-hole round on the practice green and the round half below still has to run. It is also before `round.takeShot`, so `round.active` is still the golfer who hit rather than whoever the turn advanced to. `labSource()` supplies the club column: the preset name for an approach, *Launch monitor* for a `strike` line, *Putt · N ft* for a putt — reading `$('club')` would have stamped whatever club was last picked on the range against every lab row, since the lab hides the selector and fires its own shots. Tracers are deliberately NOT drawn for lab shots: they are putts and short approaches onto one green, and fifty lines across it would cover the thing being watched. `enterLab` now clears `rangeShots` as well — only `enterRange` did, so walking from the range into the lab carried the range's rows in and numbered the first lab shot after them.

**Shot lines are capped at the ceiling, not at the setting.** A range session leaves one tracer per shot, which is one `Line2` held forever and, after twenty minutes, an unreadable mat. `SHOT_LINE_MAX` (50), `SHOT_LINE_DEFAULT` (10), `cleanShotLines`, `loadShotLines` and `saveShotLines` live in `range.js` with their own `fairway-range-lines-v1` key — device-local like the graphics tier, and deliberately NOT in `settings`, which `courseFallback` rebuilds on the way out of the range and would drop it every visit. `pushTrail` trims `holeTrails` to `SHOT_LINE_MAX` in practice modes and `visibleTrails()` hands `setShotHistory` the last `shotLinePref` of them, so raising the slider shows lines that are already there instead of only affecting shots yet to be hit. The range panel's slider runs 0–50 and applies on drag.

**`practiceShots`, because the trail array stopped being a count.** The practice card's SHOT number read `holeTrails.length+1`. Capping that array would have frozen the number at 51 forever, so the count is its own counter now, reset with the trails by `resetTrails()` and decremented by `mulligan`. The lab still counts correctly through this even though it records no shot rows — that is a separate open bug.

**AN ENDLESS WORLD HOLDS ONE HOLE, INDEX 0, WHATEVER HOLE THE PLAYER IS ON.** `round.hole` counts up through the run; the world is regrown for each hole and only ever has `world.holes[0]`. Anything that turns a round's hole number into a drawn hole goes through `worldHole(n)` in main.js, which answers 0 in endless and `n` otherwise. Replay did not, and asked the renderer for `world.holes[round.hole]`: on endless hole 1 that happened to be right, and from hole 2 on it was undefined, threw on every frame and left the round unplayable (fixed 6 October; the `endless-round` smoke journey now replays a shot on hole 2). Shot records keep the round's hole number, so a replay converts it the same way.

**Endless asks before it builds.** `menuEndless` opens a setup panel rather than dropping you straight into a run, the way play, the studio and the range already did. It is the round panel's `round` key with a third variant flag, `endlessSetup`: no course picker — endless grows each hole from the run's own seed, so a course would be one it immediately discards — and no match play, because `Round` rejects `endless` with `mode:'match'` outright (a match ends when the lead exceeds the holes remaining, and there is no last hole). What is left is format, tees, putting and the group. `startEndless(group)` and `buildEndless(group)` now take that group instead of reading `round.players` and forcing `mode:'stroke'`.

**`formatFields()` / `wireFormatFields()` are the shared round half.** The round panel and the endless panel both render and wire format, tees and putting from these, with `FORMAT_NOTES` holding the four format explanations (and `FORMAT_NAMES` what Saved rounds and a golfer's history call each). `wireFormatFields` returns the format-note redraw so the caller can hand it to `groupEditor` as its change callback. `{match:false}` drops the match option; skins stays, since it needs no last hole. `wireFormatFields` also picks the mode defensively — `modes.includes(round.mode)?round.mode:'stroke'` — because arriving at the endless panel from a match-play round would otherwise leave the select showing nothing.

**The way into a mode rides with the tabs.** *Start fresh round*, *Start an endless run*, *Open the driving range* and *Grow this landscape* each used to sit at the foot of one section, which meant the tab you happened to be on decided whether the way in was on screen at all. `groupPanelContent` now moves the panel's action into the right-hand end of the tab row. It is found by `data-panel-action`, NOT by `.primary`: half a dozen panels have a primary Save button that must stay exactly where it is, and a `.primary` selector would have picked those up too.

The CSS has to undo `.drawer .primary`, which sets `width:100%` and `margin-top:18px` for a full-bleed button at the foot of a sheet. Inherited in the tab row those made the action fill its own line and push the tabs off it entirely — which is what the first version shipped, and what a screenshot caught rather than the DOM assertions, since every structural check passed while it looked wrong.

**Every variant of the round panel is tabbed, including the range.** The range setup dialogue had a green-distance field before any heading and one `<h3>` after it, so it came out as a single scroll where its neighbours tab. It now opens with `<h3>The green</h3>`, giving two named sections, and `groupPanelContent(content, name==='round')` forces tabs for all three variants rather than only endless.

**Tabs come from heading count, and the endless panel had to ask.** `groupPanelContent` tabs a panel at `TAB_THRESHOLD` (3) `<h3>` sections and lays fewer out as columns. Endless has two, each a full sheet on its own, so it arrived as one long scroll. The function takes a `tabAlways` argument — passed as `endlessSetup&&name==='round'` at the single call site — which lowers the threshold to 2 for that render only. It is an argument rather than a flag on the element because the same `content` node is reused by every panel and a stale dataset value would silently tab the next one.

**The panel title follows the variant, not the key.** `panelTitle(name)` reads *Driving range*, *Endless run* or *Your next round* for the one `round` key. All four used to read "Your next round", which was wrong on three of them.

**One putting setting, two surfaces, and a copy held apart from practice rounds.** The round panel's *Format & tees* section renders the mode select and the 1/2/3-putt distance fields inline — it used to be a button in *Your group* that opened the putting panel, which was a second click to reach one setting and put it under the wrong heading. `PUTTING_MODES`, `PUTTING_NOTES`, `puttingFields(id,p)`, `readPutting(id)`, `applyPutting(cfg)` and `puttingGuard()` in `main.js` are the shared pieces; the round panel and the tools-tray *Putting options* panel both build from them, so the option list and the explanatory notes have one definition. The round-panel fields apply on change with no save button of their own; the tray panel keeps its *Apply putting mode* button because it is a popup the player dismisses.

**The range must not eat the choice.** It builds a throwaway `Round` forced to `{mode:'holeout'}`, and that round used to be the only copy of the setting: a visit to the range silently reset a player's Dartboard or Decimal mode, and *Start fresh round* from inside the range carried hole-out into the new round. `savedPutting` now holds the player's own choice across practice. `rememberPutting()` captures it on the way in (guarded on `!rangeMode&&!labMode`, so lab→range does not overwrite it), `playerPutting()` is what both surfaces read and edit, `applyPutting` writes to `savedPutting` while practice is live and to `round.putting` otherwise, and `restorePutting()` hands it back and forgets it — called from `restoreCourse()` on the way out and from `buildRoundOn()` for a round started from inside practice.

**Panel names are the player's words, not the code's.** The camera panel is *Game camera* (it was "find your angle"), the putting panel is *Putting options* (it was "hole out", which is also the name of one of the three modes inside it and therefore read as a mode switch), and the shot-result panel is *Shot information*. The `PANEL_TITLES` map in `main.js` is the single place these are set; the panel keys (`camera`, `putting`, `shot`) are unchanged, so renaming one is a title edit and nothing else.

**The top bar carries a live score, one chip per golfer.** `drawScoreChips` renders every player's colour, name, running relation to par and a note (the shot they are on, or *In*), the one who is up lit; it replaced the course card's single player row and the Scorecard chip, and a tap on any chip opens the card (on a practice ground it hands the mat over, or opens the shot list). The score is tinted behind the number — progressively red over par, green under, neutral at level — from `toPar(player)` against `roundPars()`. The scorecard shows the same relation per player. `roundPars()` is the awkward part: a normal round reads par off the built world, but an endless run has thrown away every landscape except the one it is standing on, so it reads `round.pars`, which `loadCourse` records per hole as it goes. Do not make the scorecard read par from `world.holes` — it will be wrong for endless from hole two onward.

**A round cannot be started from inside a round.** The play panel offers course selection only from the menu; reaching it mid-round used to let a player silently abandon a scored round with no confirmation.

**Presentation holds, all in `presentation.js` so they are testable without a DOM.** `CAMERA_HOLD` is 1.5 s (in main.js, not here) — the old chase camera stays on the ball at address that long before chasing it; since 10 October it applies only when a full shot has no television plan (*A FULL SHOT IS FILMED BY TWO CAMERAS*). `REVIEW_HOLD_SECONDS` (4.5) replaces the settle hold while the camera shows the whole shot. `SHOT_HOLD_SECONDS` and `REPLAY_HOLD_SECONDS` are 3 s each, holding on the final lie so the player sees where it finished. **A holed ball holds `HOLED_HOLD_SECONDS` (1.2) instead** (14 October 2026): three seconds on an empty cup read to the owner as the game freezing before the XP came up. `HOLE_REVEAL_MS` is 3000, the LEAST the scorecard waits after the hole-out: `showHoleCompletion` then re-checks every `SCORECARD_RECHECK_MS` while `xpBusy()` (the XP popup or a level-up banner up or queued) and opens `SCORECARD_AFTER_XP_MS` after they clear -- it used to open on the popup mid-fill and blur it out. A golfer with no profile earns no XP, and the card opens at 3 s as before. **THE HOLE-OUT BANNER WATCHES THE CARD, NOT THE SHOT** (`announceHoleOut` in main.js, its label from `holeOutLabel` in scoring.js): the caller notes which seats had a score for the hole before the action (`cardedSeats`) and announces whoever gained one. That is the only signal every format agrees on -- `event.complete` from `takeShot` is true on a scramble ball that was merely awarded putts as a candidate, and a scramble team's score is written by `chooseScramble` with no shot at all. So both `finishShot` and the pick bar's accept wrap their call; anything new that writes `cards[i][hole]` must too, or its hole-out goes unannounced. The banner lasts 2.7 s, inside `HOLE_REVEAL_MS`, so it is gone before the scorecard opens; if either number moves, keep it that way. The XP popup does not wait for the banner, only for its sting (`XP_AFTER_STING`, 1.6 s from the banner); the two sit apart, the popup at the top. The level-up banner, in the banner's place, does wait for it. All three let taps through (`pointer-events: none`): the level-up banner did not, and blocked whatever was under the middle of the screen for its 2.8 s. Its CSS animation runs on the frame clock while the hide is a timer, so in a headless browser rendering in software the banner can be hidden before a frame of it is drawn -- a harness artefact, not a bug; freeze its animations to look at it. The 8-second scorecard countdown then advances. These are separate numbers on purpose: they were one, and tuning the settle hold moved the strike delay with it.

**The shot panel reads live during flight.** Ball speed in mph and spin in rpm come from the recorded path, which carries `v` and `w` per point; near the cup the sampler switches to every step rather than every fourth, so a lip-out is not four samples long.


`takeShot` validates the current state, builds a shot from either manual inputs or measured monitor data, computes a deterministic recorded result, then creates a `flight` animation state. Flight playback runs faster than real time (1.7×), but the new presentation holds use real frame elapsed time. `finishShot` calls `round.takeShot` once for normal play. Replay uses the recorded path and must never call scoring or alter undo history.

`lastShot` is session-only and includes the original hole, aim, origin and result. Replaying restores that hole's scene context and temporarily follows the shot, then returns to the current round lie/camera. It holds the final recorded point for **3 real seconds**. Explicit skip controls can still finish playback immediately. The shot-result panel stays open before play, during flight, after landing, during exploration and after hole changes. Live shot distance is horizontal displacement from launch, not cumulative flight arc length; final carry/total/apex are retained.

A tracer is cleared when its shot is over rather than left hanging over the next one. Every tracer played on the hole is kept in `holeTrails` and drawn all at once on hole-out by `view.setShotHistory`, under `view.summaryOrbit` — a slow high orbit framed off the hole's own length, so a 130-yard par three is not framed from where a 600-yard par five is. The ball, ring and aim line hide for it and the player's camera settings are restored exactly on the way out; `loadCourse`, `advanceHole` and a mulligan all end it, and a mulligan pops the tracer it un-plays. One `Line2` cannot hold several strokes — it would draw a line across the fairway from one shot's end to the next one's start — so the history is a pool of lines, one per shot.

Selecting the putter and taking the shot lifts that hole's pole/flag group by 3 m. The hole view resets flag positions; replay lifts it again for a putt. The lift itself is visual, but the stick is a collision obstacle whenever it is standing: main.js passes `flagsticks:{current}` to simulateShot, false exactly when the stick is pulled (ball on the green, or the putter in hand). **THE FLAGSTICK IS SOLID WHILE IT STANDS IN THE HOLE** (physics.js). **FLAGSTICKS STAY VISIBLE FROM ANYWHERE** (renderer.js, `holdFlagsticks`): past about 36 px tall on screen the stick and flag are drawn larger, up to 10x, and the pole never under 2 px -- drawing only; the stick's dimensions live in physics.js so the drawing and the collider share them. Only with the player's switch on: **Larger flags far away** (`graphics.distantFlags`, OFF by default since 14 October; `view.setDistantFlags`, read every frame). Off, `holdFlagsticks` still runs and places every stick at scale 1, so turning it off puts a grown stick straight back to size.

After hole completion, wait **3 seconds** with the cup/result visible before opening the scorecard. Then the existing **8-second** countdown advances to the next hole. The final round stays on the scorecard. Opening another panel, starting a flyover, replaying, regenerating, or explicitly pausing cancels pending automatic advancement. Preserve timer cleanup in `cancelAdvance` to prevent a stale callback from advancing a different round.

`Round` owns stroke/putt counts, team candidate choices, penalties and turn order. Decimal putting returns 1–3 interpolated putts, rounded for scores; dartboard uses 1/2/3. The approach stroke counts separately. Scramble applies automatic putts only after selecting the candidate. Mulligan restores snapshots (up to 30). Sim drop starts at the current lie and applies no penalty. Water/out-of-bounds currently use simplified one-stroke plus replay-from-previous-lie rules.

Physics is research-informed, not hardware-calibrated commercial simulation: midpoint integration at 240 Hz, aerodynamic drag/lift/spin, wind/altitude/temperature, compliant bounce/contact approximation, roll/slopes and Stimp. Cup capture is geometric, not a speed rule: one contact test against the rim as a surface — a torus above lip height, the cylinder below, agreeing where they meet — carried through time as a rolling rigid-body contact, which is what lets a ball ride the lip and come back out. Two sign errors and a gap between those two tests each produced plausible-looking wrong behaviour without erroring, and `tests/rim.test.mjs` holds one assertion per bug that shipped; read it before touching the rim. Trunks resolve penetration and only reflect inward velocity; canopies have no collision. Read RESEARCH.md before changing equations or claiming a new accuracy level.

## Persistence, settings and safe extension

- `fairway-round-v1` localStorage stores `{version, schema, generator, settings, round, camera}`. Round serialization includes bounded undo history. Export/import provides portable JSON.
- `fairway-courses-v1` stores the named course library as `{version, courses:[{id, name, created, schema, generator, settings}]}`. A record holds **generation settings only** — `courseSettings` strips turf, club yardages, flight profile and art style, so a shared course never carries the author's own gear, and never a round, a lie or a score. A course's stored `generator` is preserved rather than refreshed on load: that is what lets the library flag a course whose landscape no longer matches how it was designed. One unreadable entry is skipped rather than discarding the whole library.
- Export codes are `FW1.<base64url payload>.<checksum>`. The payload carries the schema version, the generator version, the name, and **only the settings that differ from the defaults**, which keeps a typical code a few hundred characters rather than eight hundred. Base64 is UTF-8 safe because names are free text. On import the checksum catches a truncated paste, an older schema is migrated, and a *newer* schema is refused outright rather than guessed at.
- `fairway-layout-v1`, then `-v2`, stored relative panel positions and sizes until the layout was fixed on 17 October 2026; `layout.js` deletes `-v2` once on start, and nothing reads either.
- Last-shot replay is not persisted. Geometry/functions are regenerated from settings and seed rather than serialized.
- The live `settings` object starts as `{...DEFAULT_COURSE, style:'cartoon'}`. It was a hand-written partial copy holding 11 of the 38 keys, which was invisible until something read it before a course had been loaded: Course studio renders each control straight from it, so the 27 missing keys drew `undefined` captions over sliders the browser had silently parked at the midpoint of their range — spacing read 37 where its default is 18. Never write a second copy of a default.
- `src/settings-schema.js` is the single source of truth for every generated-course setting: default, bounds, step, unit, category, help text and kind. Defaults (`DEFAULT_COURSE`), validation (`validateSettings`), migration (`migrateSettings`), the world rebuild key and the studio sliders all derive from it. **Adding a generation setting means adding one schema entry** — not a default here, a slider there and a bounds list somewhere else, which is how the previous hand-written validator drifted. The studio panel renders itself from `CATEGORIES` and `SETTINGS`: group headings, order, labels, bounds, step, unit and the help text behind each hint button. Only `holes`, `courseYards`, `seed`, `biome`, `footprint` and `homes` are written by hand, because they are not plain sliders; everything else appears automatically. A test asserts every setting lands in exactly one rendered category, so a new entry cannot be added and silently never shown. Round validates its own serialized state separately. Add matching GPU parameters if a setting changes surfaces.
- Two versions, and they are not interchangeable. `SCHEMA_VERSION` describes the shape of a settings object; renaming, adding or removing a control bumps it and `MIGRATIONS` upgrades old saves silently. `GENERATOR_VERSION` describes the behaviour of the generator; any change that moves ground for a given seed bumps it, and it **cannot** be migrated, because the settings are still valid — they simply build different terrain. A mismatch is therefore put to the player through `showVersionNotice`, which blocks shots until they choose to continue on the rebuilt landscape or start a fresh round on the same course. Reproducing retired geometry exactly would mean keeping every old generator alive; that was considered and rejected as an unbounded maintenance cost.
- Bump `GENERATOR_VERSION` whenever generated output changes for an unchanged seed. Forgetting is the failure mode that silently moves a saved ball, and no test can catch it for you. AGENTS.md states the rule for both numbers; keep the two in agreement. Generator 11 is current: water is excavated with a cut bank rather than a ramp, the ocean gained a foreshore and a beach, islands carry no inland water, and `nearest` stopped tearing the landform past every green -- that last one moves ground on every course, with or without water. SCHEMA_VERSION stays at 4: no control was added, renamed, removed or re-ranged.
- Generation blocks the main thread. `whileGenerating` paints a status overlay, waits for a frame **or a timeout** — a background tab fires no `requestAnimationFrame`, and waiting on one alone hangs the boot — and only then runs the work. It is a message, not progress: nothing can advance while the thread is locked. See TODO.md for what real progress would take, and why a Web Worker is not the answer.
- `fairway-profiles-v1` stores the players' profiles as `{version, main, profiles:[{id, name, created, counters, bests, rounds, removed, bag?, meter?, hand?, input?, xp, xpLog, xpDaily?, xpRange?, xpNew?}]}`, version 3 since XP (14 October 2026; migration 2 -> 3 starts everyone at 0 XP with `xpNew`). It has its own `PROFILE_VERSION` (2) and `MIGRATIONS` in profile.js, separate from the settings schema; version 1 was the single-profile record the first build wrote under `fairway-profile-v1`, which is read once, becomes the main profile, and is removed. See *The profiles* below.
- Old three-hole saves are upgraded to a fresh nine-hole round with their players/format. File-URL localStorage behavior varies across browsers; export saves before transferring or troubleshooting.

## Launch monitor bridge

**Private-network browsers may drive the bridge, and it takes TWO settings.** The origin check was loopback-only, which is why a phone on the LAN got a 403. `isLocalOrigin` now accepts loopback plus the three RFC 1918 blocks — 10/8, 172.16/12, 192.168/16 — and `file://`'s `null`. But widening it alone changes nothing: the HTTP/WS server still binds `127.0.0.1`, so the phone cannot reach the port at all. `FAIRWAY_HTTP_HOST` binds it somewhere reachable, and the bridge prints a warning line when it is not loopback.

**It PARSES the origin rather than pattern-matching it, and that is load-bearing.** A regex over the raw string passes `http://192.168.1.50.evil.com`, which contains a private address. Handing it to `URL` and testing `hostname` exactly removes that whole class — there is no suffix to smuggle anything onto.

**The parser also canonicalises, which is the half that is easy to miss.** Measured, not assumed: `010.0.0.1` becomes `8.0.0.1` (octal — public, refused for the right reason), `0x0a.0.0.1` and `167772161` both become `10.0.0.1` (private, allowed), `10.0.0` becomes `10.0.0.0`, and `999.1.1.1`, `10.0.0.0.1` and `192.0168.1.1` throw. Every alternate spelling arrives as four plain octets, so a range check on those is the entire test. A guard against leading zeros was written and then deleted: `hostname` never contains one.

**This is a real widening and it is not authenticated.** Anything on your network that can reach the port can drive the simulator — start rounds, take shots. That is the trade for playing on a phone while the bridge runs on the desktop. The TCP connector port has always carried the same caveat.

**Shipping the bridge to players.** Running `bridge/server.mjs` meant `npm ci` (every dependency and all the test tooling) and a build -- nothing a player can be asked for, and the portable README claimed an "included bridge" it did not include. `npm run build` now also runs `tools/build-bridge.mjs`, which bundles the bridge, `ws` and the physics it validates shots with into **`dist/fairway-bridge.mjs`** (about 130 kB, needs only Node.js 20+). **Players get it compiled** (1 October 2026): `tools/build-server.mjs` (`npm run server`) compiles the bundle with Bun into **`run_fairway_server`** for Windows, macOS Apple Silicon, macOS Intel and Linux (60-82 MB each, into `release/server/`), and each platform's download carries its own beside `Fairway.html`, with the bundle itself in `server-source/` (the LGPL obligation for the JavaScriptCore inside Bun -- see DISTRIBUTION_REVIEW -- and a Node.js route). The Node start scripts it replaced are gone. Inside a compiled program the bundle's own URL is a path in Bun's virtual filesystem (`B:/~BUN/root/` on Windows, `/$bunfs/root/` elsewhere, and the `~` arrives percent-encoded -- the first test matched nothing and the program silently did nothing), so **`COMPILED` switches three things**: the game is looked for beside the EXECUTABLE (`process.execPath`), the browser side listens on every address by default, and it runs as the main program. The macOS builds come out ad-hoc signed (LC_CODE_SIGNATURE present), which Apple Silicon needs to run them at all. The programs are not signed with a paid certificate; the download's README says how to get past SmartScreen and Gatekeeper. **The server serves the web manifest** (`/manifest.webmanifest`, carried inside the bundle as `globalThis.__FAIRWAY_MANIFEST__`), so a phone can add the game to its home screen from it; it used to answer 404, leaving only a bookmark. **The bridge finds the game beside it** (`PAGE_CANDIDATES`: `Fairway.html`, `index.html`, `../Fairway.html`, `../dist/index.html`; `FAIRWAY_HTML` overrides) -- it used to read only `../dist/index.html`, which is where the source tree keeps it and nowhere a player has it. **ONE script listens on every address** (`FAIRWAY_HTTP_HOST=all`, i.e. 0.0.0.0) and prints two links (`addressLines`): 127.0.0.1 for this computer, and this computer's home-network address for a phone. There were two scripts, one per case, and the "for a phone" one listened on the home network ONLY, so the computer's own browser could not use 127.0.0.1 while it ran -- it was never the superset it looked like. The owner asked why there were two; the answer did not justify it. **The firewall is the gate**: the first run asks whether Node.js may use the network; allowed on a private network, a phone plays; refused, the computer still does, since loopback is not firewalled. The cost is that prompt, once, for players who never use a phone. The phone link is chosen by `lanAddresses`, which ranks private IPv4 addresses 192.168 first, then 172.16/12, then 10/8, and pushes adapters named like a VPN or virtual machine last: on the machine this was written on, a VPN's 10.x address came before the real 192.168.x one, and picked blind the phone would have been sent to the VPN. The others are printed in case the guess is wrong. Both are unit-tested; binding every address was NOT run here, because it raises the firewall prompt on the owner's machine. Bun was chosen over Node's single-executable feature (owner, 1 October) because Node's macOS builds must be signed on a Mac, while Bun signs its cross-compiled ones; the cost is Bun's LGPL JavaScriptCore, handled as DISTRIBUTION_REVIEW describes. **Checked by** the `bridge-bundle` journey, which starts the built bundle as its own process on free ports -- the runner does this for any journey with `bridge: true` -- loads the game from it, connects, sends a real Open Connect shot from a pretend connector on its TCP port, watches it fly, and checks the connector hears `200`. **`server-program`** does the same against this computer's compiled `run_fairway_server` (`bridge: 'program'`, skipped until `npm run server` has built it), because inside Bun the WebSocket library runs on Bun's own implementation; it passes on Windows. The macOS and Linux programs have not been run on those systems.

**The phone plays with a monitor from the page the BRIDGE serves, never from a hosted copy.** A secure (`https`) page may not open the bridge's unencrypted `ws://` connection -- Safari blocks it, and a self-signed `wss://` fails too (RESEARCH.md, *A launch monitor on an iPhone*). The owner tried the options that would let a hosted copy connect -- a Tailscale certificate, a home-made root certificate, a tunnel -- and set them aside on 27 September as too much setup. So: the monitor panel's address defaults to `ws://` + the page's own host when the page is plain `http` (it came from the bridge), else `ws://127.0.0.1:1922`; a successful connection is remembered in `fairway-bridge-url-v1`; and a page loaded over `https` says in the panel why it cannot connect and what to open instead. **The phone's top bar has no "Connect monitor"** -- it was hidden for room in the layout redraw with no other way in, and the owner found it on an iPhone -- so the panel is also **Launch monitor** in the main menu and in Tools, at every size. Checked by the `monitor-phone` journey: a served page on a phone's screen, a pretend bridge at the page's own address, the menu route, the pre-filled address, Tools, and the address surviving a reload.

**Connectors send `ShotDataOptions` flat as well as nested, and both are valid.** Found on 2026-09-16 against a real connector, which is the first time any physical device has been pointed at this. Its idle frame is `{"ContainsBallData":false,"ContainsClubData":false,"LaunchMonitorIsReady":false,"LaunchMonitorBallDetected":false,"IsHeartBeat":false}` — no `ShotDataOptions` wrapper and no `BallData`. Read strictly that is a malformed shot, and `parseLaunchMessage` threw `BallData is missing`. GSPro accepts it, so this must. `const opts=d.ShotDataOptions??d` reads either shape, and a frame carrying any of the five known status keys but no `BallData` is a status frame rather than an error. A payload carrying none of them still throws, so widening this did not turn every malformed message into a silently ignored one — there is a test for exactly that.

**The device's own readiness reaches the browser, and drives the shot controls.** `parseLaunchMessage` returns null for status frames, so `LaunchMonitorIsReady` and `LaunchMonitorBallDetected` were being thrown away — the game could not tell "no monitor" from "monitor hunting for a ball" from "ball on the mat", which is exactly what a player standing over a shot needs. `readDeviceStatus` in `physics.js` reads either option shape and **never throws**: it runs in the same loop as the framing check, where a throw is read as an unrecoverable stream and closes the connection, so a frame it cannot make sense of must simply be no status at all.

The bridge relays it on the existing `status` message, and **only when it changes** — a connector heartbeats every second or two and the HUD does not need to redraw for that. A departed device clears it rather than leaving the last state stuck on screen.

**The tint is an inset box-shadow with a 9999px spread, not an overlay.** A `::before` overlay is absolutely positioned, which paints it ABOVE the card's non-positioned flex children — the tint would sit on top of the club name. An inset shadow paints above the background and below the content, which is exactly what a tint is. The cost is that the card's own drop shadow has to be restated in every rule and every keyframe, because `box-shadow` does not merge across declarations; getting that wrong drops the card's elevation on one state only.

**The strip above the shot bar is gone entirely, and the aim point is marked in the world.** `#aimLabel` mirrors `#flagLabel`: projected onto `aimPoint` every frame through `view.project`, at `height + 3 m` rather than the pin's `+6`, because it marks a spot on the ground and a label at flag height over bare fairway reads as a second pin. It hides during flight, in free flight, while dropping, and — deliberately — when the aim point is within 8 m of the pin, where the two markers would pile into one unreadable heap. That last rule means a par three aimed at the flag shows only the flag, which is correct and can look like the feature is missing.

**The aim marker's caption is a constant, and on the green the marker goes away entirely.** It briefly reported what the putt preview measured — *TO WHERE IT STOPS · OFF THE GREEN* — which was accurate and useless: with a putter selected on a tee box 561 yards out it read “12 · TO WHERE IT STOPS · OFF THE GREEN”. The surface report is gone, the variable that computed it is gone, and the `<small>` is static markup again so nothing can write to it.

**The main menu stays on screen behind a sheet opened from it.** It used to be hidden outright, taking the wordmark with it — and the topbar that carries the brand everywhere else is `display:none` in menu mode, so a panel opened from the menu floated over a landscape with no branding anywhere. `syncMenuOverlay` now adds `.menu-behind` instead: the masthead stays, the deck goes (the tiles are exactly what the sheet replaced, and leaving them would offer two routes to the same places), and the bottom half of the menu's scrim goes with it because the drawer's own backdrop already dims that band.

THE TRAP: `.main-menu` is `position:fixed; z-index:80` and the drawer is 21, so simply leaving it visible covers the panel it just opened. `.menu-behind` drops it to 19 — below `#drawerBackdrop` (20) — and sets `pointer-events:none`. It is also `aria-hidden` with `aria-modal` removed in that state, because the sheet is the dialog now and two modals at once is no dialog at all. The full-screen overlays are unaffected: `#generating` is 95 and `.version-notice` (which `#leaveNotice` uses) is 90.

### The mulligan reaches back one shot, on this hole

**`canMulligan()` is the gate, and it is about the HOLE.** `history` is thirty shots deep and runs across hole boundaries, so on a fresh tee with nothing hit the top of it was the last shot of the previous hole: pressing Mulligan rewound a whole hole and unrecorded its score. Nothing you had done on the hole you were standing on was undone, which is the one thing the button claims to do. The rule is that the top of the history has to belong to `this.hole`. Holing out does NOT end the chance — the card sits up for a few seconds before the next tee and taking back the putt that just dropped is reasonable — so it is the hole number that decides, not `holeComplete`.

**The button says why it is off**: "Nothing to take back on this hole yet" is a different answer from "finish the shot first", and a dimmed control with no explanation reads as broken.

**A mulligan takes one tracer with it, and leaves the rest.** `holeTrails.pop()` before `loadCourse()` did nothing at all, because `loadCourse` calls `resetTrails()` — it is the routine that grows a NEW HOLE, where no shot has been hit. So every tracer on the hole vanished and the summary showed only what came after. The handler now keeps `holeTrails.slice(0, -1)` across the reload and puts it back afterwards: the reset is right for every other caller, and this is the one place that has to restore something. `lab.state().trails` reports the count, because tracers are drawn at the END of a hole and a shot quietly vanishing is otherwise invisible until then.

### Removing a golfer, and choosing a scramble ball

**A HOLE NOBODY SCORED IS A GAP, AND A SAVE MUST TAKE A GAP.** A golfer who joins mid-round has no score for the holes before, and a scramble team that forms mid-round has no team score for them: those rows are sparse arrays, and `JSON.stringify` writes each gap as `null`. `Round.restore` checked every entry with `score`, which refuses `null` -- so from the first hole a joined golfer finished, every save of that round was refused: Continue silently dropped it (`pendingRound=null`), the library would not open it, and the mulligan, which restores its own JSON snapshots, threw. It now allows `null` and `undefined` in `cards`, `puttCards` and `teamCards` and turns them back into empty slots (`slot`, `gaps`). Found 16 October 2026 by the round matrix, not by a player; no hand-written test had saved a round after somebody joined and finished a hole.

**`setPlayers` matches on SEAT, not on list position, and that was a real data bug.** It resized every per-player array by length — slot `i` kept slot `i`, truncated from the end — while the editor removes the row you clicked. So removing the first of two golfers deleted the SECOND one's card and handed the first one's strokes, ball and scorecard to whoever was left, under the remaining name. Draft rows now carry `seat`, the id the golfer already holds; `setPlayers` reads each slot from its seat and treats an entry without one as new. `seat` is stripped when `this.players` is built — persisted, it would be read back as a seat in a group that has since changed.

**The first golfer could not be removed at all.** The row's delete button was gated on `i`, so row zero never had one and the only way to drop the first name was to remove everyone else and retype it. The rule is that a round needs ONE golfer, so the gate is now `draft.length > 1` on every row.

**`confirm()` is gone from the apply flow, and that is why it looked broken.** A native dialog is suppressed outright in some embedded browsers, and a suppressed `confirm` returns false — so Apply did nothing at all, silently, with no way to tell that from a bug. It arms instead, naming who is leaving, the way the course list arms its delete. The armed state is keyed on the exact set of leavers and is cleared whenever the draft changes underneath it, so it cannot still read "Remove Alex? Press again" after Alex has been added back.

**A scramble selection is not a turn.** `setUpTurn` returns early during `scrambleSelection` and opens the picker instead: nobody is up, and setting a club, a power and an aim line for `round.position` would offer a shot from a lie the team may be about to abandon. That early return is also the path a reload takes back into a half-made selection, which is why restoring mid-choice reopens the picker rather than stranding the round.

**`setCandidateBalls(list, active)`** draws every ball the team hit, at its own lie, in `playerColour` of the golfer who hit it, each with a depth-test-disabled beam — occluding the beam behind a rise is exactly when you most need to see where the ball is. Pooled at four like the tracers. The playing ball is hidden while the choice is open: there is no single ball yet, and leaving it on the course puts a second mesh inside whichever candidate it is sitting on. `lab.state().picks` reports the visible ones, because they are meshes and there is nothing in the DOM to check.

**The duplicate lists are gone.** The result panel and the scorecard each used to render their own row of candidate buttons. With a persistent HUD bar they were a second way to answer the same question, and the worse one.

### Water, and the ground's own shape

**A REFLECTION MUST NEVER RENDER DURING AN OVERRIDE PASS.** The ambient occlusion pass (since removed) rendered the scene with `scene.overrideMaterial` set to a normal material, and `onBeforeRender` still fires for every object while it does — so the Water drew its reflection in normal colours and left them in the target. The wrapper returns early when `scene.overrideMaterial` is set, which covers any future override pass too. Anything else that renders the scene into its own target has the same exposure.

**REFLECTIONS OFF HIDES THE REFLECTOR; IT DOES NOT JUST STOP DRAWING.** Skipping the render alone leaves the shader sampling a stale target, which looks like a working reflection until the camera moves — that is why the switch appeared to do nothing. `setReflections(false)` hides `this.water` and shows the reflected body's own plain mesh.

**THE QUALITY DROPDOWN NEVER TOUCHES THE FEATURE SWITCHES.** `saveGraphics({...graphics, quality})` spreads the stored settings, `applyQuality` only sets pixel ratio, shadow sizes and cascades, and a tier change that forces a rebuild re-applies every cue through `build`. Relief, slope tint, contours, stripes, terrain shadows and reflections are independent of it in both directions.

**THERE IS NO PLANAR REFLECTOR ANY MORE, AND THAT IS DELIBERATE.** A planar reflection is a second render of the whole scene — 1.9 ms of a 10.4 ms frame on ultra — so a course can afford one, while a generated course carries eight to thirteen bodies of water. The mirror therefore had to be handed between bodies as the camera moved, and every handoff was one pond turning from water into varnish and another turning back. That popping was reported repeatedly and was never fixable by scoring the choice better; the cause was having two classes of water. Now there is one. `src/water.js` (the vendored three.js `Water`), `throttleReflection`, `updateWater`, `pickReflector` and `lab.reflectionEvery` are all gone. Do not reintroduce a single shared mirror — if real mirrors are ever wanted, they have to be per-body and capped, so that no body ever gains or loses one while it is on screen.

**STILL BODIES ARE MADE CLEAR, NOT TEXTURED.** `dressStillWater` drives alpha from a Fresnel term — `0.02 + 0.98·(1−|n·v|)⁵` — so a body is 22% of its depth opacity looking down into it and full looking across. Being able to see into water is what reads as water; a mirror is not. The normal map is kept quiet (scale 0.3) to break the specular into glints rather than to be a visible pattern.

**THREE ONLY ALLOWS ONE `onBeforeCompile` PER MATERIAL.** `dressStillWater` set one over the top of `shoreFade`'s and silently removed the shoreline alpha fade from every pond. The shore-fade GLSL is now shared constants that both paths splice in. Anything else that patches a water material has to compose, not assign.

**THE PROBE PASS MUST PUT THE WATER BACK.** `probeCapture` (used by `refreshWaterEnvironment` and the one-pond-a-frame retake) hides every body before capturing, or the probes photograph other water and their own surface. It restores from `shown`, which holds BODIES; restoring `m.visible` there set a property on the wrapper and left every mesh hidden, so the course showed water-coloured ground where its ponds were. `lab.state().water.hiddenBodies` is the guard: more than one hidden body means something is covering a pond.

**RIPPLES ARE PROCEDURAL ONLY WHEN REFLECTIONS ARE OFF.** With no reflection on the surface the ripples are all there is, and a tiled normal map reads as a tile at pond scale. `WATER_NOISE` is world-position value noise — two octaves on crossing drifts, a swell warping the chop, normal from finite differences — with no tile and no texture read. It is behind the `waterProcedural` uniform, set by `setReflections`, because with reflections on the image does the work and the tiled map costs nothing. Changing the branch changes the program, so `customProgramCacheKey` is `still-water-clear-v2`. `lab.waterRipple(chop, swell, speed)` tunes it live.

**WATER SPEED IS `WATER_SPEED`, ONE CONSTANT IN `renderer.js`.** Every drift rate in the water shaders is a fixed number multiplied by the ripple clock, so the rates are ratios to each other and the clock is the speed: `waterTime` advances by `dt * waterSpeed`. Changing the one constant moves the chop, the swell and the stream flow cycle together, with no shader recompile. It ships at 10, chosen by the owner against the course rather than derived from anything. It is deliberately NOT a game setting — wave speed is a look the course ships with, not something to hand a player.

**THERE IS NO WATER TEXTURE AT ALL ANY MORE.** Both hand-built normal maps are gone with the planar reflector. The surface is generated in the fragment shader from the world position, so there is nothing to tile, nothing to mipmap and nothing to inline into the offline build. This matters because pond UVs arrive from `ShapeGeometry` in WORLD METRES: any texture tiled against them repeated about every metre, which aliased to a flat grey wash at distance and read as an obvious repeat up close. Both were real reported bugs; neither is reachable now.

**THE WATER ENVIRONMENT IS A PROBE PER BODY; `scene.environment` IS STILL SKY ONLY.** `refreshWaterEnvironment` renders a 128² cubemap from a `CubeCamera` at EACH body in turn, biggest first and capped at `WATER_PROBE_CAP`, convolves each and assigns it as that body's `envMap` -- bodies past the cap borrow the nearest probe. One shared probe was tried first and read as nothing: every pond reflected the same patch of trees. The material must also be near-mirror (roughness 0.05, metalness 0.62) or PMREM's roughness blur turns the course into a wash — so all bodies reflect terrain and trees at no per-frame cost, having given up parallax. `scene.environment` is left alone because it feeds every prop, and a house window should not mirror terrain. The water hides itself during the capture or it photographs its own surface. It must be taken WHERE THE WATER IS BUILT: `addSky` runs first, so the refresh it triggers finds no bodies and returns, and the next one is an elevation threshold away.

**A SECOND RENDER REDRAWS EVERY SHADOW MAP.** Three's `render` redraws all shadow maps while `renderer.shadowMap.autoUpdate` is on, whatever is being rendered, and the frame has already drawn them. So every pass that renders the scene again switches it off around itself: the god-ray mask, and the probes (`probeCapture`, which lets the first face draw them once with `fresh` at build, before any frame has). Anything new that renders the scene from elsewhere needs the same. Before this, the probes made 48 identical redraws of every cascade per refresh. **THE PONDS ARE RETAKEN ONE A FRAME WHEN THE SUN MOVES**: the 6-degree threshold queues them (`queueWaterProbes`), `render` takes one a frame (`stepWaterProbes`, before the cull update that puts back what `showAll` exposed), into each pond's own texture so no material changes; build, a tier change and switching reflections on still take everything at once. RESEARCH, *Wasted drawing*.

**THE PMREM GENERATORS ARE KEPT.** `refreshEnvironment` (the sky) and `refreshWaterEnvironment` (the ponds) run every 6 degrees of sun, and each takes its generator from `pmremFor('sky')` / `pmremFor('water')`, made once and never disposed. A generator made and disposed per call takes its blur and GGX programs with it, so every refresh compiled them again: 130-160 ms a threshold on an RTX 4090 at Low, against 4-7 ms kept, and the time slider froze at every one it crossed. Keep the two jobs apart: a generator rebuilds both programs whenever it is handed a cube of a different size, and the sky (256) and the water (the tier's size) differ. Anything new that convolves an environment takes its own `pmremFor` job, never `new T.PMREMGenerator` inline. RESEARCH, *The time slider hitched*.

**A stream is a last-resort reflector**, scored at `STREAM_PENALTY` (1%) of its fill. A creek threads a whole course, so it was constantly in contention and took the reflection off the pond beside you as you walked. It still wins when there is no still water at all, which is a common course.

**EVERY GRAPHICS FEATURE DISCUSSED IS NOW A SWITCH,** in two groups because they are not the same kind of thing. *Reading the ground* -- relief, slope tint, contours, mowing stripes -- are uniforms on the ground material and cost nothing measurable. *Costs a frame* -- terrain shadows and water reflections -- are real per-frame work and are labelled as such in the panel.

**THE BALL DOES NOT CAST A SHADOW, AND MUST NOT BE SET TO.** A golf ball is 0.16 of a shadow-map texel on low and 0.47 on ultra -- measured, not estimated -- so `castShadow` on it drew nothing at any tier and cost a draw call in the shadow pass doing it. `ballShadow` is a soft disc under the ball instead, spreading and fading together as it rises, placed by `placeBallShadow` from `setBall`, which is the only place the ball is ever moved. It leans and stretches away from the sun rather than a second cast shadow being drawn, because at a resting ball's scale the two marks are the same mark — 2.5 cm apart at a 41° sun. Offset and stretch are capped by `BALL_SHADOW_REACH` and `BALL_SHADOW_STRETCH`; uncapped, a low sun draws a runway and a ball in flight tows its shadow into the next fairway. `lab.ballShadow(widthCm, ink)` tunes it live and replays from `ballShadowAt`, NOT from the shadow's own position — the shadow is offset now, so replaying its position walks it further from the sun on every call.

**The cascades were checked too.** High and ultra use CSM, not the single shadow camera, so the earlier measurement covered only low and medium. The near cascade is 418 m deep on a 4096² map: 0.26 of a ball. Two texels would need 31,383² . Do not revisit this by raising a shadow map.

**EVERY RASTER TILE ON THE MAP GOES THROUGH `tilePlacement`.** The full-course terrain background was the one exception, drawn as a hand-rolled rectangle at `w/2 - halfX*scale`, which assumes the map centre is the world origin. It is, until a pan or an off-centre zoom moves it — and `zoomAbout` pans whenever you zoom about anything but the exact middle. The terrain then drifted from the course by 95 px after one wheel notch and 882 px by zoom 6.5, on a 376 px map. It was correct at rest, so it hid for a long time. `tests/course-map.test.mjs` now pins tile corners against `mapPoint` through a zoom sequence.

**THE HOLE BOUNDARY IS RESOLVED IN THE SHADER, NOT JUST SAMPLED.** `holeDistance` reproduces what `nearest` measures, and the fragment goes to the nearest candidate among its four neighbouring atlas texels. Gated by `fwidth(owner.r)` so only quads a boundary crosses pay. Two traps, both live: it must measure against `curves.w` (`h.width`, the RAW corridor half width) and NOT `curves.y/z` (`fairwayWidth`, which carries end caps and the green blend); and it must DECLINE when any candidate texel has the lake flag in alpha, because a lake overrides nearest-hole ownership and resolving would undo it. Verified against `nearest` over 24,955 samples: worst error 1.79 m, different hole at 0.032% against the atlas's 0.13%. The residual is `curves` resolution (512 samples over ~580 m), so the boundary is smooth but can sit ~1 m off.

**THE OWNER ATLAS IS SIZED FROM THE COURSE, NOT A FLAT 512.** It was square over a course that is not, giving 2.88 x 4.26 m texels and a staircase on every hole boundary that stepped further along z than across x. `OWNER_TEXEL` (1.75 m) makes texels square; `OWNER_MAX` caps the total. Owner error against true ownership went 0.35% to 0.13%, VRAM 4 to 16 MB, and the atlas build about 0.5 s to 2.1 s — it is one `nearest` call per texel, so resolution costs load time as well as memory. This SHRINKS the staircase; resolving the boundary among the four neighbouring texels in the shader would remove it, and is deferred.

**`surface()` DECIDES THE SEA FROM `height`, NOT `land`.** The ocean plane is at `waterLevel` and the ground beneath it is the shaped height; asking the raw landform instead scored 1512 cells of one island course as water while the ground stood a median 0.88 m — and up to 6.13 m — above the sea. `isSea` in generation still uses `land` and has to, because ponds and channels are placed before a ground mesh exists. When checking this, measure on ISLAND only: elsewhere a pond sits well above `waterLevel` and every inland pond reads as a fault.

**`nearest` RAMPS THE GREENSIDE ALLOWANCE; IT MUST NEVER SWITCH IT.** The original `zz === h.length ? ... : 0` was an exact float equality on a clamped coordinate and stepped the distance by 17 m instantly, tearing `land` past every green in every biome — worst measured step 10.87 m on mountain. `GREEN_RAMP` spreads it, and the ramp runs BEYOND the green (`smooth((p.z - h.length)/GREEN_RAMP)`), never up to it: a two-sided ramp reshapes the ground the green sits in and breaks the surround-slope test. Anything else in `nearest` that switches on an equality is the same bug waiting.

**THE SHORELINE REFINEMENT IS A STRADDLE TEST ON THE GRID'S OWN CORNERS, NOT A HEIGHT BAND.** `makeGroundGrid` passes each cell's four sampled corner heights to `refine`, so the predicate asks whether the waterline crosses that cell — exactly, and for free. Do not replace it with a band: tested at the centre a band misses any shore steeper than it is wide (23.3% of the waterline missed when it asked `land`, 12.2% when it asked `analyticHeight`), and widening it sweeps in the entire seabed because the ocean is only `waterMax` deep. Re-sampling the corners inside the predicate works but doubles generation. The version below is kept for the record of what a band costs.

**(HISTORICAL) THE SHORELINE REFINEMENT BAND WAS ±0.4 m AND THAT WAS NOT ARBITRARY.** `|land| < 2.5` reads as "near the waterline" and is the whole seabed, because the ocean is only `waterMax` deep and that defaults to 2.5 — it produced 22.1 M triangles and 44 s of generation. ±0.4 m gives the same 0.50 m waterline smoothness for 1.9 M triangles and 4.9 s. Check the triangle count if you widen it.

**THE CHANNEL SOFTEN BLOCK MUST NOT REPAINT TEES.** It rebuilds the classification from corridor geometry, which has no idea a tee is there, so a tee beside a creek loses its own surface. `teeGround` suppresses it. Island tees looked right while inland ones did not, because islands have no channels -- that asymmetry is the signature.

**A TEE PAD IS PROTECTED FROM `carve` BY `flat`, NOT BY `r`.** The carve threshold is `o.r - 22` and a tee's `r` is 18, so it was minus four and 11% of the carve landed on the pad. `flat` is separate from `r` on purpose: `r` is what channel ROUTING must clear, and raising it pushes channels away from every tee on the course. Tee pads are also in the ground grid's refinement list now; they were the only playing surface that was not.

**DO NOT LEVEL A PAD BY RETURNING ITS OWN LEVEL INSIDE IT.** Tried: it makes the interior perfect and puts a step at the boundary, worst spread 0.46 m to 0.59 and nine tees over 0.4 m against four. The weighted blend is what keeps a pad continuous with its ramp.

**`foreshore` IS GATED ON THE COAST, NEVER ON HEIGHT ALONE.** Keyed on elevation it reshaped entire courses — a links tee 510 m inland dropped 2.3 m — and worse, its curve amplifies gradients by up to 1.67, which was the source of both the steep edges and the tee pads that stopped sitting flat. It takes the coastal blend as its second argument. The gate `(0.06, 0.24)` is tuned: tighter costs beach width, looser starts reaching inland again.

**THE CUT SCALES WITH THE BODY (`cutFor`).** A 3 m creek must not get a lake's freeboard and lip; flat, it measured a median slope of 0.33 three metres out against 0.01 before. Ponds and lakes still take the full `WATER_FREEBOARD`/`WATER_LIP`.

**THE BEACH BLOCK RUNS AFTER THE TEE BLOCK.** It sets `kind=5` on rough ground and the tee apron only claims ground that is still rough, so ordered the other way every low-lying coastal tee loses its mown collar in the PAINT while the lie keeps it.

**A CHANNEL MUST BE WORTH DRAWING.** Preferring on-course coverage tripled the visible length of a river but allowed stubs; there is a minimum run, or a channel comes back 191 m and reads as a fragment.

**WATER HAS A CUT BANK; THE SEA HAS A BEACH.** `WATER_FREEBOARD` and `WATER_LIP` in streams.js give ponds, lakes and channels a bunker-like edge, in two stages — ease to a rim one freeboard above the water across the body's shelf, then cut over the lip. Do NOT collapse that to one stage: cutting straight from natural ground measured a 7.81 m cliff on uneven rims. The shore bands were widened to match a ramp that no longer exists and are now a lip; both copies of that formula must move together.

**The ocean gets `foreshore` instead, and it is a LANDFORM change.** The island coast measured forty-five degrees, so no classification rule could have made a beach. `foreshore` eases ground between sea level and `BEACH_TOP` toward the water, anchored at zero so the waterline does not move — verified at 66.4% water cover before and after. It must rejoin the terrain with a continuous SLOPE, not just a continuous height: a power curve anchored at both ends builds a seventy-degree wall at the top of the beach. Sand switches on `BEACH_RISE` in both ground.js and `surface()`, and claims ROUGH ONLY in both (`kind<.5`, `found==='rough'`) — letting it take mown turf turned 19.4% of the island corridor into beach. When checking this, measure the mown CENTRELINE: lateral proxies all leak, on fairway bunkers, on the rough between tee and `mowStart`, and on ground owned by a neighbouring hole.

**AN ISLAND CARRIES NO INLAND WATER.** `NO_INLAND_WATER` in course.js gates ponds, lakes and channels off for that biome. It is applied at the three points of consumption, and streams are switched off by handing `generateStreams` a settings object with `rivers` and `creeks` zeroed rather than by teaching streams.js about biomes — the two files would otherwise import each other, and `NO_INLAND_WATER` being a `const` makes that circle a temporal-dead-zone trap rather than a merely ugly one. The settings themselves are never rewritten, so the values survive a switch to island and back.

**WATER BELONGS ON LAND, AND `isSea` IS THE ONLY TEST FOR IT.** Defined next to `land` in course.js, it answers true only for the two biomes that have a coast — elsewhere `land` may go negative in a deep valley with no sea there, and treating that as ocean would refuse ponds and trim channels on dry ground. It reads the RAW landform, never `shapedLand`: shaping is what water bodies do to the land, so no body may decide it is on dry ground because another already dug a hole there. Pond siting clamps its terrain samples at the waterline (`Math.max(0, land(...))`) because the seabed is not steep ground — unclamped it cost every island course all of its ponds — and refuses a site outright if the centre or rim is in open water. `generateStreams` takes `isSea` and keeps only the longest run of stations on land.

**THE MOWN OUTLINE IS ROUNDED BY `BAND_ROUND`, IN BOTH HALVES.** The fairway beside water is an intersection, so it has a sharp corner; `smoothMax` in course.js and `smax` in ground.js round it by the same 2 m arc. The lie needs `fairwayDepth` (how far outside the corridor) and `ovalDistance` (metres from a pond's outline, built the same way the shader builds `hd`) to do it — a plain margin test cannot round anything. Lakes keep the unrounded test on purpose: `lakeOwner` answers inside-or-out rather than a distance. Do NOT try to make semi-rough a uniform offset of the mown region instead: that is a distance transform, `surface()` is a point query, and it would need a fourth baked representation to keep in step. Priced at 25.2 m against 32.2 m of worst swath for 1.04% of the ground, and declined.

**THE MOWN BAND AROUND WATER IS TWO EDITS THAT MUST STAY IN STEP.** `ground.js` paints it (downgrade `kind==2.` to semi within **`pb.z + margin`** of a pond or **`b.z + margin`** of a channel, and push the softened channel rebuild out by the same amount or the blend repaints fairway over it) and `course.js` `surface()` gives the ball the matching lie. Both read the hole's own `semiRough`, so the band scales with the setting and a zero turns it off. **The band starts at the shore's OUTER stop, not at the water**: the wet and damp soil is painted over anything inside it, so a band measured from the waterline is invisible — at a 6 m setting the soil already reaches 7.14 m. `shoreBands` in streams.js is the shared formula and `tests/water-terrain.test.mjs` compares it against the shader's copy; they had already drifted once. **The first attempt changed only `surface()` and was completely invisible** — the ground shader classifies from corridor geometry and never calls `surface()` — so it moved no pixels while silently putting a semi lie on ground drawn as fairway. If you touch one, touch the other, and bump `customProgramCacheKey` in ground.js. The sea is excluded on purpose: a coastline is not mown around.

**PONDS MAY NOW CROSS A FAIRWAY.** `gap` used to be anchored outside the semi-rough with no way back in. It now subtracts a `reach` that is zero most of the time, a partial bite about one in six, and a full crossing about one in twelve. Splits are capped by measurement rather than by construction — the test asserts the longest carry stays under 200 m and fewer than 40% of holes are split.

**THE SEMI-ROUGH CARRIES NO BLADES.** `addNearbyGrass` used to plant on `['rough','semi']` with semi blades at 3.5 cm — stubble costing a full instance each, measured at **13.5% of all near-field grass instances** around a mid-fairway point. The semi-rough's job is to read as *between* fairway and rough, and its mown height already says that; geometry on top was not adding information. If this is ever reversed, note that `onShoreBank` takes the semi flag as its fourth argument.

**PLANTS USE `windVec`, NOT A FIXED BEARING.** `windMaterial` used to displace along a hard-coded diagonal while `shot-visuals.js`, `clouds.js` and the HUD arrow all agreed on a real one. One uniform now, on the shared `(sin a, cos a)` convention, with the gust phase taken ALONG it so gusts travel downwind instead of every plant shimmering to its own clock. `lab.state().wind` reports the vector the shader has, which is how the disagreement was found. Note `breeze` still floors at 0.55, so zero wind is not perfectly still despite what the HUD says -- left deliberately, see RESEARCH.md.

`setTerrainShadows` is a MESH flag, so it changes the shadow pass and not a shader program. `setReflections` no longer switches a reflection on and off -- it swaps each body's `envMap` between its own probe and nothing, choosing whether water mirrors the course or only the sky. Free either way, so it is not in the panel's "costs a frame" group. `setOcclusion` builds and disposes the AO pass on demand -- the module owns its own render targets and has a `dispose`, so there was never a reason for it to be decided at course-build time, and `needsRebuild`'s occlusion clause only governs a TIER change now.

**ALL THREE GROUND CUES ARE SWITCHABLE, AS UNIFORMS AND NEVER AS DEFINES.** `graphics.relief`, `graphics.slopeTint` and `graphics.contours` live in the graphics store; `view.setGroundCues()` writes into uniform objects held on `material.userData.cues`, created outside `onBeforeCompile` so they can be reached afterwards. A define would be part of the program key and would recompile every lit material in the scene — the floodlight trap. Measured: one frame, zero programs. `build` re-applies them per course, because the ground material is rebuilt with the world. `lab.state().cues` reports them as the SHADER has them, which is the only way to tell a surviving setting from a panel that merely thinks it applied one.

**THE GROUND SHADER SHOWS SHAPE WITHOUT THE SUN,** which matters because a cast shadow only reads at a low one. Three cues, none of them costing a frame:

- **Directional relief**, a raking light on a fixed bearing. The green has always had it at a gain of 4; mown turf and rough get 2.6.
- **Local relief**, baked. `localReliefField` in `ground.js` blurs the ground grid at `RELIEF_RADIUS` (15 m) and stores `height - average` per vertex, normalised by its own 90th percentile. `groundGeometry` attaches it as the `localRelief` attribute for BOTH the regular and the refined grid, sampling bilinearly so refined vertices between base cells get a sensible value. THE RADIUS IS THE PARAMETER: a few metres is surface texture, tens of metres is landform, 15 m is the roll a golfer reads.
- **Slope tint**, the only cue on the turf that works in HUE rather than value. TUNED TO MEASURED SLOPES: a fairway runs 3.3 degrees at the median and 9.5 at the 99th percentile, rough 7.5 and 29, a green 0.6. Mown ground and rough get separate ranges (0.035-0.16 and 0.10-0.45) because one curve either does nothing on a fairway or saturates the rough. It first shipped at 0.12-0.55 and touched 0.0% of the fairway; the second attempt had the right range and a strength of under 1%, which was equally invisible. BEFORE TUNING ANY VISUAL EFFECT HERE, sample the field it runs over and print the number it will produce -- all three failures in this feature were a magnitude guessed rather than measured. Everything else competes for brightness; a slope drying out is free of them, and true. Measured as `length(n.xz)/n.y` (the tangent) rather than `1 - n.y`, which barely moves across the range a fairway occupies. Applied as a multiplier on the biome's own turf colour so each biome dries toward its own dry, and gained by surface as irrigation: green 0.15, fringe 0.35, fairway 0.55, rough 1.0.
- **Mowing stripes that follow the ground**, via a height term in the stripe coordinate and a contrast that varies with the normal along the mow direction. TWO TRAPS, both hit: the anti-alias fade must be measured on the PLAN coordinate, not the bent one, or the height term feeds its own suppression and the bands vanish on slopes; and the contrast term must SCALE rather than add, or it crosses zero and a whole class of slope loses its stripes entirely.

**The textbook curvature does not work and was measured before being built.** The discrete Laplacian moves 0.3% of a real hole: a bunker lip is hundreds of times more curved than a fairway roll. A screen-space crease term built from the same quantity shipped briefly and was removed for the same reason, plus it varied with camera distance. Do not reintroduce either.

**`localRelief` is a custom attribute on a shared material.** The landscape skirt uses the same material and has no such attribute, so it reads the default 0 — no relief, which is correct for a distant backdrop. Anything else given that material has to be checked for the same.

 Directional relief (a raking light on a fixed bearing) and crease darkening (`length(fwidth(normal))`, high where the surface bends, near zero on any plane) — both off the normal the vertex shader already passes, both free. The crease term is divided by `length(fwidth(groundPoint))`, the fragment's world footprint: without that normalisation a screen-space derivative makes the effect a function of camera distance, which reads as fog. The green keeps the much stronger relief gain it has always had, because it is being read for a putt.

**Mowing stripes already existed** and are computed in the PLAN from `p.x`/`p.y`, so they do not bend over a roll. Making them follow the surface is a real change, not a tweak.

### Lights: the light count is in every shader

**THE FLOODLAMPS ARE HIDDEN WHILE OFF, AND BOTH STATES' SHADERS ARE BUILT IN ADVANCE.** Three counts the VISIBLE lights in a scene and compiles every lit material against that count — so showing 57 spot lights for the first time recompiles the entire scene: 2541 ms of frozen picture on the switch-on, measured, and why the lamps were once kept visible from birth at zero intensity. That cost every course the same bill at LOAD instead: programs carrying every lamp (57 on nine holes, 141 on eighteen), different per course, 2-3.5 s of the loading screen's graphics wait (B6). Now `addFloodlights` builds them hidden, `setFloodlights` shows and lights them together, and `warmFloodlights` builds the programs for WHICHEVER STATE IS NOT SHOWING -- lamps flipped for one `compileAsync` walk and put back synchronously. **Since 30 September it runs inside `ready`, behind the loading screen, and the overlay waits for its programs to link** -- the owner wanted the work in the wait rather than in play. (It used to be sent for by the first `render` after the overlay went, `nightWarmDue`, which is still the fallback for anything that reaches the screen without `ready`.) **A switch that lands while a build is still running waits for it** (`floodWarming`) with the game running -- now only reachable on a hole change, which warms again with no overlay. **Every round starts with the floodlights off** (`lightsOffForRound` in main.js), and a round built through Play starts at midday unless "Start at my local time" is ticked (`clockForRound`, rule in `roundHour`; Endless off the menu keeps the showcase hour instead, *The menu borrows the clock*). The ball's point light is still built visible at zero -- one light, the same on every course. **It is not a child of the ball** (15 October 2026): three counts a light only if it and every parent are visible, and the ball is hidden on the menu's showcase hole, in the end-of-hole flyover and while a team picks its ball. As a child, each of those took the light with it, every lit program was built (or kept) for "no point light", and the ball's next appearance -- or its disappearance -- rebuilt every lit program in view: 35-40 programs and 1.8 s frozen on a first visit when Endless adopts the menu's hole (no loading screen), 14-17 lit programs as the hole-out flyover began on a course built through Play. It now sits beside the ball in the course group, follows it in `render`, and is dark while the ball is hidden (`ballLightPower` holds what `updateGlowBall` wants). **Never parent a light to anything that is ever hidden.** Guarded by the `ball-light-shaders` and `ball-light-hole-out` smoke journeys, which count programs first DRAWN after the watch starts -- counting programs created, the first draft passed on the broken build. Anything else that adds a light must be warmed the same way or its first appearance will stall.

**`warmFloodlights` runs on EVERY warm, not once per course.** `setHole` warms again per hole because the flag, the cup, the rings and the ball are per-hole objects built after the course was — a one-shot guard there left exactly those three materials compiling on the first toggle, which was 270 ms on an eighteen-hole studio world. Compiling an already-compiled scene is a cache lookup.

**THE SAMPLER BUDGET IS THE REAL CEILING ON LIGHTS, AND IT IS ONE UNIT.** Every shadow-casting spot light costs a texture sampler in every lit fragment shader; WebGL guarantees 16, and three CSM cascades, the toon gradient, the environment map and the ground atlases spend almost all of them. Measured by walking the count up: one caster links, TWO does not. A program that fails to link does not draw — so six casters made the GROUND ITSELF disappear, with no JavaScript error and nothing in the frame times to suggest it. `quality.floodShadows` is 0 on every tier for that reason and not because of milliseconds. Anything that adds a sampler to the lit path — another cascade, a new atlas, a light cookie — is spending the same single unit. **Pack new ground data into a texture the ground already samples.** The soft shade under trees (U1) does exactly that: `cover` used to be a second, linearly filtered copy of the float ownership atlas, of which the shader read one channel; it is now a byte texture of its own with the occlusion in red and the straw in green.

**TWO THINGS ARE IN THE PROGRAM KEY, NOT ONE.** The count of visible lights is what made the floodlight toggle cost 2541 ms. The count of SHADOW-CASTING lights is the same kind of trap: switching `castShadow` per hole would recompile the scene on every tee. So the casters are a fixed few, set when the course is built — `quality.floodShadows`, four on high and six on ultra, none below — and `orderPoles(poles, hole, focus, limit)` hands those front lamps to the hole being played. The poles move between the lamps; the flag never moves. `shadow.autoUpdate` follows `floodlit`, which is what stops six depth passes running in daylight; a stale map behind a lamp at zero intensity contributes nothing.

**The terrain casts its own shadow.** It only ever received one, so a ridge did not darken the hollow behind it. One draw call per cascade over geometry that already exists — 8.6 ms against 8.5 ms, inside the noise. The normal bias that stops a self-shadowing surface from acne-ing lives in the quality tiers and is shared with the cascades, so raise it there, never here.

**`lab.floodShadows(n)`** switches shadow casting on for the nearest n lamps. Shadow-casting lights are the one graphics decision with a hard cost — an extra depth render of the scene per light per frame — and this is how that is measured instead of guessed at. The numbers are in RESEARCH.md.

### The camera, and the bay it is standing in

**A FULL SHOT IS FILMED BY TWO CAMERAS AND A REVIEW** (`src/tv-camera.js`, 10 October 2026). The owner's complaint was that the follow camera gave no idea of the ball's flight path: it rode 24 m behind the ball and 11 m up, 25 degrees off its line (`flightCameraPose`), so the ball sat still in the frame while the ground slid past, and neither height nor curve read. The owner asked for a television feel, on one condition: the player sees the shot's shape before any cut. So: the camera the player aimed from STAYS PUT and turns to keep the ball in frame (`tvShot`/`tvFollow` in renderer.js, `trackingBall` so it looks straight at the ball), the tracer drawing the climb and the curve across a still frame; at `cutAt` -- the apex plus 40% of the way down to touchdown -- it CUTS, with no flight between, to a landing camera standing 22-52 m short of the landing spot and 18-30 m to one side of it, 7 m up, chosen from eight places as the one with no ground and the fewest tree crowns between it and the landing (`planShotCamera`). It can stand there before the ball arrives because the whole flight is simulated at the strike. A shot carrying under 64 m never cuts; a putt keeps `followPose`. **After the owner tried it (11 October)**: a chip's single camera eases in BEHIND the ball over 0.8 s and follows it (it had only turned, and sat at the tee), and the landing camera, once the ball is down, swings round behind it over 2.2 s so the roll-out is watched toward where it finishes -- 12-14 m back, 4-5 m up, along `plan.dir`, all placed. The plan is made in `takeShot` (`shotCameraPlan`) and, for a replay, after `setHole` puts the replayed shot's hole back -- before it, the plan was worked out against the wrong hole. All the distances are placed numbers, chosen on screen.

**THE REVIEW.** When the ball stops, the camera FLIES (`tvReview`, a `makeCameraFlight`) to a three-quarter side view of the whole shot, tee to rest (`planReview`: back far enough to fit 1.6 times the shot's length across the frame -- 1.25 put the tee end of a drive under the map -- above the apex, looking at the middle a little below half its height), and the settle hold grows from 3 s to 4.5 s (`REVIEW_HOLD_SECONDS`) to give it time. `finishShot` then flies from there to the next lie (`flyCamera` with `from`) instead of the cut `setCamera` makes for anything over 60 m. Enter still skips; `review` in the camera settings (*Show the whole shot when the ball stops*) turns it off; `follow` off turns off both cameras, as it always turned off the chase. A dead end worth knowing: FSX players complain about waiting through a post-shot bird's-eye tracer (REFERENCES, *The UI pass*), which is why this one is short, skippable and switchable.

**THE OLD CHASE IS THE FALLBACK.** `flightCameraPose` and `CAMERA_HOLD` are still there for a full shot with no plan (a plan that threw, a world not yet built), and `followPose` is still the putt camera. Nothing about them changed.

**THE DESCENT ONTO A NEW HOLE IS SLOWER AND GOES THROUGH THE TREES** (camera-tours.js, `makeCameraFlight` with `arrival`). It ran at the cruise speed every camera move uses, capped at 2.6 s, arcing up over every canopy; the owner asked for it slower and through the trees, which hide while the camera is inside them anyway (`clearCameraTrees`). It takes 3.5-5.5 s now (40 m/s, placed) and clears only the ground. **Not profiled**: `clearCameraTrees` scans every tree each frame the camera moves and rewrites instance buffers as trees hide and show, so a slow pass through a forest does more of that than the arc over it did. A graphics profile was not run (AGENTS.md: ask first); the redwood biome is where to look if it ever stutters.

**Camera settings are DEVICE preferences now, in `fairway-camera-v1`.** They used to live in the round's autosave, which made them a property of the round: discard the round and your bay setup went with it, and a round shared with someone else arrived carrying their screen size. A camera describes the room you are standing in, so it sits with graphics, the panel layout and the clock. `loadCamera()` seeds `view.config` when the view is constructed; `validateCamera` clamps each field on its own, so one bad number cannot cost the rest of a setup.

**`cameraRig(config)` is what places the player camera, not the raw config.** With `sim` off it is the four sliders. With `sim` on the three placement numbers stop being taste: the eye is at eye height, the ball sits its own distance in front, the lateral offset is FORCED TO ZERO — a golfer stands behind the ball, not beside it — and the field of view is whatever the bay's geometry gives. The ball can fall below the bottom of the frame at that height, which is correct: it is below your eyeline in the room too. If the bay measurements cannot produce an angle the chosen field of view is kept rather than the view collapsing.

**ON THE GREEN THE CAMERA BACKS OFF UNTIL THE BALL IS IN FRAME.** `framedForBall(rig)` raises the setback to `height / tan(halfFov * BALL_FRAME)` and changes nothing else — same eye height, same line, same angle. A putt is aimed from the ball, so the ball has to be on screen; everywhere else it may sit below the bottom edge, which is where it is in the room. `setCamera` applies it when `h.surface(p.x, p.z) === 'green'`.

BALL_FRAME is 0.85 for a reason: it leaves margin for the view axis's own downward tilt, and it makes the rule a NO-OP for the broadcast rig, which at nine metres up and twenty-three back already has the ball at 81% of its half-angle. A camera that is already showing the ball is returned unchanged — the same object, which a test asserts, so the rule cannot quietly start moving cameras that were fine.

**Only the player camera takes the bay's angle.** Overview and the green view keep the chosen one — neither is a view from where anybody is standing, so a bay's measurements say nothing about them.

**THE MENU BACKDROP OWNS THE LIVE CAMERA while it is up**, forcing free flight so it can orbit the showcase hole. The camera panel therefore shows the SAVED view in its select rather than `view.config.mode`, and writes the select's value back rather than whatever the orbit left behind. Without that, opening the panel from the main menu saved "free flight" and the next launch started in it. Anything else that persists from the menu has the same trap.

**The putt follow is the same camera, pointed at the hole.** `followPose(hole, p, aim, aimAtCup)` calls `flightCameraPose` unchanged and replaces only the TARGET. The eye is identical to any other shot — one camera for every shot was settled when the separate putt rig was removed and nothing here brings it back — but while the ball is rolling the look is halfway between the ball and the cup, sliding toward the ball when it would leave the frame (15 October 2026: pinned on the cup, as it was, a putt that ran past or wide rolled out of the picture -- the owner). A hole with no pin falls straight back to the ordinary pose.

**THE PANEL HAS NO VIEW PICKER, and that is the point.** It used to carry a "Camera view" select offering player, overview, green and free flight -- three of which are buttons on the tools tray that are on screen the whole time, and the fourth of which had no button at all. A mode selector inside a settings panel made the view you happen to be looking THROUGH into a saved preference, which is how opening the panel from the main menu once saved "free flight" and greeted the next launch with it. The select is gone, the green view got a tray button beside the other three cameras, and `mode` is never written from the panel.

**One section, and which controls are in it depends on `sim`.** A bay and a desk answer the same question in incompatible ways, so rendering both sets meant two groups of controls that contradict each other with one of them inert. Toggling `sim` re-renders the panel rather than leaving dead sliders on screen.

**`flyToWater` is deleted with the "Go somewhere" section.** Explore the whole course duplicated the tray's free-flight button, and the waterside viewpoint was its only caller -- once the section went, the method was unreachable. Anything that wants it back wants the button back too.

**A round no longer carries the camera.** `saveRecord` writes `roundCamera()` -- the three green-reading flags and nothing else -- and `applyRoundCamera` is the only thing that reads one back. Camera settings describe the room you are standing in: they have to be the same in play, the range and the studio, they have to survive discarding a round, and they must not arrive inside a round somebody shares. The replay path still restores the whole config, because that is a snapshot taken seconds earlier in the same session.

**`lab.state().camera`** reports the rig as the camera is actually set up, including the computed field of view — which is derived rather than stored, so the camera itself is the only honest place to read it.

### Whose turn it is

**`round.order` is the playing order for the hole, and it is the only thing that decides who is next.** Stroke play was already "keep the same golfer until their ball is holed", but it found the next one with `done.findIndex(d => !d)` — array position, which is the order the names were typed in. `nextInOrder()` walks `order` instead, so honours actually moves the turn rather than only the first tee shot.

**HONOURS: lowest score on the previous hole tees off first.** `honoursOrder()` sorts the previous hole's cards ascending. Three things it has to get right and all three are tested: `sort` is stable so a tie keeps the order the group already had (reshuffling two golfers who both made four is noise — nothing on that hole separated them); a golfer with no card for that hole goes to the BACK, because an undefined score sorts to the front, which is the one place a mid-round joiner has not earned; and fractional scores from dartboard or decimal putting rank like any other number.

**It is a per-player array like every other one.** `setPlayers` repairs it the way it repairs `cards` and `positions` — a golfer who leaves takes their slot with them, one who joins goes to the back. `toJSON` carries it for free (`{...this}`), and `restore` rebuilds it from group order unless the save holds a clean permutation of the player ids. A save written before honours existed has no `order` at all, and an order missing a golfer would drop them from the hole entirely — worse than losing whose turn it was — so anything that is not a permutation is discarded rather than patched.

**Match play is unchanged in substance**: farthest from the pin, shot by shot. It now filters `order` rather than `players`, so when distances tie — which is exactly the situation on the tee, where every ball sits on the same spot — honours breaks it instead of player index.

### A colour per golfer

**`src/player-colours.js` assigns a colour by SEAT, not by name or by shot.** Four hues — gold 43, cyan 190, indigo 255, magenta 315 — hashing a name would change a golfer's colour when they rename themselves, and four hashes cannot be spaced round the wheel on purpose the way four positions can. `playerColour` is the identity chip and the scorecard dot; `playerTracer` is the same hue lifted and desaturated, because a two-pixel line against grass, water and sky needs more light than a filled chip.

**RED AND GREEN ARE RESERVED, and the test checks that against `parTint` itself rather than against a comment.** Over-par red and under-par green are painted on the same cards these colours appear on, so a golfer whose colour was either would be reporting a score they had not shot. `PAR_OVER_HUE` and `PAR_UNDER_HUE` are asserted to match what `parTint` actually returns, every player hue is at least 35° from both, and the four are at least 50° from each other — so changing the tint fails the test instead of silently creating a collision.

**Tracers carry the golfer, and the line pool is why the colour is set every frame.** `pushTrail(points, player = round.active)` records who hit it, taken before `round.takeShot` advances the turn. `setShotHistory` takes `{points, colour}` and sets `line.material.color` on EVERY pass, not only when a line is created: `shotLines` is a pool reused across holes and players, so setting it at construction leaves trail 2 wearing whoever hit trail 2 on the previous hole. The bare-array and missing-colour branches are defensive only — every caller goes through `pushTrail` — and exist so a trail from anywhere else draws in the old amber rather than the black an unset `Color` gives.

**`lab.state().shotLines`** reports each visible tracer's actual material colour. The colour lives on a material, not in the DOM, so it is the only way to check from outside that a golfer's line, chip and scorecard dot agree.

**A fifth player wraps rather than throwing.** A group is capped at four, but a colour lookup is not where that should be discovered — an undefined colour paints a tracer black.

### Saving: one slot, two libraries, and what each is for

**Four stores, on purpose.** `fairway-profiles-v1` is the players: their names, totals and histories, kept apart from every round and course so exporting, sharing or deleting either never touches it. `fairway-round-v1` is the ONE slot behind *Continue* — the round you were last playing, unnamed, overwritten constantly. `fairway-courses-v1` is up to 200 named courses: settings and a name, never a score, so the same course suits any group and a shared one cannot carry the author's club distances. `fairway-rounds-v1` is up to 40 named rounds: the whole situation, full settings included, because a round has to resume with the settings it was played with. A golfer's BAG is not one of them any more: since 12 October 2026 it lives in their profile (*THE BAG IS THE GOLFER'S*). Device preferences (time, graphics, popups, layout, range lines) live in their own keys and deliberately never travel.

**Transports:** an `FW1.…` code is one course as pasteable text; `fairway-courses.json` is the whole library, for a backup or a move; `fairway-round.json` is the live round; `fairway-scorecard.csv` is the card. Course-file import is ADDITIVE and never replaces, because an import that wiped a library would be an unrecoverable one-click mistake — the cost is that re-importing the same file duplicates it, and there is no dedupe yet.

**THE MENU BACKDROP MUST NOT BE SAVED, and `save()` now refuses to.** The showcase hole builds a throwaway `Round` for the camera to circle. Something on the way into the menu called `save()` with it, so after any visit to the menu the one slot held a fresh nine-hole round nobody had played, and the next launch offered *Continue* on it. Found while fixing the discard bug below, which it also caused: clearing the slot did nothing, because the backdrop grew immediately afterwards and wrote itself straight back in. Anything added that writes during the menu has to check `menuBackdrop` the same way.

**`clearSave()` is the only `removeItem` in the app, and only the ROUND guard calls it.** The discard hint reads *"This round and its scores are gone"*; before this it cleared `pendingRound` in memory and left the slot alone, so a reload offered *Continue* on the round the player had just been told was gone. The studio guard deliberately does NOT clear it — leaving a landscape unsaved has nothing to do with the round waiting behind *Continue*, and clearing it there would throw away someone else's work.

**`PLAY_KEYS` / `playScope` in `settings-schema.js`: what belongs to the golfer rather than to the ground.** `clubYardages` (since 12 October 2026 only a round's legacy copy of the old device-wide distances -- see *THE BAG IS THE GOLFER'S*), and `turf` are NOT schema fields (`flightProfile` was one of them until the Swing Meter replaced it on 14 October 2026; SCHEMA_VERSION 10 drops it from old saves) — they ride along in the same object and are validated by their own modules — so anything that rebuilds settings from `DEFAULT_COURSE` drops them silently, not back to a visible default but gone. That is how an endless run reset a player's bag: a driver set to 225 yd was back at 250 after one reload, because each endless hole rebuilt `settings` around a seed and the next autosave wrote the stripped copy to disk. Four sites now carry the scope across: entering endless, growing each endless hole, `saveRecord`, and resume/import. `style` is deliberately excluded — endless forces cartoon and that is the mode's choice, not a loss. A test asserts these keys are absent from `DEFAULT_COURSE`, so if one ever becomes a schema field the mechanism is flagged as obsolete rather than left running.

**Carrying the keys is half of it; `applyPlaySettings()` makes them live.** Boot and import each did this by hand and `resumeRound` did not, so resuming a round saved under different settings played it with the CURRENT ones while the panels showed the saved ones. (That bug was found on the bag, when the bag was a setting.)

**THE BAG IS THE GOLFER'S (12 October 2026).** Each profile may carry `bag`: up to 14 clubs, each `{id, name, kind, carry}` -- a name the player chose, a kind from `CLUB_KINDS` (which sets launch, spin and the monitor code), and a carry. `clubs` in main.js is always the bag of whoever is up: `syncClubs()` re-reads it at the start of every turn (`setUpTurn`), after every bag edit and in `applyPlaySettings`, and rebuilds the club picker (and the monitor window's copy) only when the clubs in it change. `bagFor(player)`: the profile's bag, else the stock bag for a profiled golfer; a golfer with no profile on this device plays the round's legacy `clubYardages`, else stock. **Invariants:** the putter's id is always `putter` (`validateBag` forces it) because the game asks "is this the putter?" by id in a dozen places; a bag holds exactly one; names differ ignoring case, because the picker, the shot list and the dispersion legend show names. A shot records its club's `kind` as well as its name, and the longest-drive best asks `kind==='driver'` -- it asked for the label "Driver", which a renamed driver would have silently stopped counting. **Superseded:** the rule that a round resumes under the bag it was saved with; the bag now travels in the profile and its backup file. **The old distances convert once:** at startup `adoptDeviceBag` gives every golfer without a bag the round slot's `clubYardages` (`adoptDistances` in profile.js) and deletes them from the settings. The editor (`renderBag`) is the *My bag* tool in play -- opening on whoever is up, with a *Whose bag* picker when the group has several golfers -- and *Edit <name>'s bag* on the profile page, which returns there after saving. The `bag` smoke journey drives all of it, including the picker switching when the second golfer is up.

**Importing a round is entering play, on top of whatever is already there.** It assigned `round` outright with no guard, so the round in progress was simply gone — while every other way out of play asks first. It also never called `setMode('play')`, so importing from the main menu built the course, said "Saved round restored" and left you looking at the menu. The file is read and validated BEFORE `guardRound`, so an unreadable file does not first make you answer a question about your round, and the input is cleared afterwards — without that the same file cannot be chosen twice running, because the input still holds it and picking it again fires no change event.

**A button that acts on "the thing you are in" has to know whether you are in one.** `settings` and `round` are module-level and outlive what they described, so at the main menu both name the backdrop. *Save the course you are playing* therefore saved `DEFAULT_COURSE` under a biome's name on a fresh launch — a course the player had never seen — and after an endless run failed outright with `Holes is not a recognised option.`, because an endless world is `holes: 1` and `validateSettings` refuses it. `savableCourse()` now answers with either a label naming the course (*Save "Midwest"*) or the reason there is nothing to save, and the panel renders the reason plus a route to Course studio instead of a button that cannot work. *Export the round you are playing* is disabled with the same kind of reason when `appMode !== 'play'`, the range is open, or the backdrop is up.

**Export moved onto the row.** The Saved rounds tab listed saved rounds and then offered an export of the LIVE one underneath — a different round from any on screen, so the obvious reading of the button was the one thing it did not do. Each card exports itself, in the same record shape `saveRecord` writes and the import reads: a round on the shelf and the round in your hands are one format.

**Rename exists now, and the dedupe is what makes it bearable.** `renameCourse` and `renameRound` had been implemented and tested with no UI calling either. Both lists rename in place: a card swaps to an input row, Enter commits, Escape cancels, and the panel re-renders the way every other list action does. Course-file import stays additive — an import that wiped a library would be an unrecoverable one-click mistake — but a course whose NAME and normalised GENERATION SETTINGS both match one you already have is now counted and skipped, so re-importing a backup no longer doubles the library. Settings rather than id, because a shared or round-tripped course has a different id and is the same landscape; the identity is checked BEFORE saving so a duplicate never spends a slot against the 200-course cap. Four tests pin that identity across a code round trip, across a file, against play-scope keys that never travel, and against object key order — `JSON.stringify` only works as a key because `courseSettings` builds from `generationKeys()` in a fixed order.

**`panelTab` remembers which tab a panel was on.** Every list action re-renders the whole panel, and `show(0)` threw you back to the first tab each time — which made renaming two courses in a row a chore and deleting two rounds a puzzle. Remembered per panel and by TITLE rather than index, because the round panel's sections differ between play, endless and the range; a remembered title that no longer exists falls back to the first tab.

**Focus has to wait for layout.** `groupPanelContent` runs after `renderPanel` returns and rebuilds the panel by emptying the root and re-appending its sections, which blurs whatever was focused. A rename input focused during render came out unfocused; it is focused in a `requestAnimationFrame` instead. Anything else that wants focus on open has the same problem.

**Still open, and known.** Saved-round delete is one click while course delete in the round panel is a two-tap arm. `save()` swallows quota errors, so a full store means *Continue* silently stops updating.

### Penalty relief

**A ball in trouble waits in the round.** `Round.takeShot` with a `hazard`
counts the stroke, records `round.relief = {player, hazard, from, cross,
puttStroke}` and returns; nothing else -- another shot, a sim drop, the hole
ending -- can happen until `takeRelief({spot, penalty}, pin)` is given the
choice. The penalty is added THEN, because E-5 costs two and everything else
one. In a scramble the dropped ball becomes the team's candidate carrying its
penalty, which `chooseScramble` adds if the team takes it. `relief` is saved and
restored with the round, follows its golfer through `setPlayers` (and goes with
them if they leave), and is cleared by a mulligan, which returns to before the
shot.

**The rules are in relief.js and nowhere else.** It is pure: the course comes in
as `ground` (`surface`, `out`, `blocked`, `area`, `ownFairway`), which main.js
builds from the hole -- `outOfBounds` is the same function physics.js stops a
ball with, so the boundary cannot be in two places. Where the ball crossed the
edge is computed in `finishShot` from the ball's own path, before the round
records the shot. `setUpTurn` checks `round.relief` first, which is also how a
reload comes back to the choice.

**`lab.trouble('water' | 'out')`** sends the current ball at the nearest water
or straight out of bounds through the real `finishShot`; the `relief` smoke
journey uses it on a course built with `lab.course({water: 100, lakes: 2})`.
A `lab.course` player now carries `hand: 'RH'`: without it `validateSave`
refused the save, and a lab round could never be continued after a reload --
found by that journey.

**A swallowed error is a failure (`no-swallowed-errors`).** The smoke harness fails on anything that reaches the console, but an error something catches and ignores never does. This journey sets the browser's debugger to stop on every exception, caught or not, while the game starts, builds an 18-hole course and plays a shot, and fails on any. Today there are none; a `try{...}catch{}` that starts swallowing one on that path will fail it -- which is the point, and the reason to look at what is being thrown before quieting it.

**The build overlay is two halves.** `whileGenerating` maps generation's own progress onto the first half of the bar (`GROWING_SHARE`) and spends the second on `view.ready()`, which is mostly `compileAsync` and cannot report progress, so `creepProgress` moves the bar on a slowing curve paced by the last graphics stage (`graphicsMs`, first set by the menu's quiet startup build). The page is live during the compile, so the creep tells the truth about work happening; it stops short of the end until the work is done.

**Any smoke journey can meet water.** Courses are random, so a tee shot in a journey that is not about relief can find a pond, and then nothing but a relief choice can be played. The first full run after relief went in found exactly that: the phone journey's tee shot went in, and *Sim drop* opened over the relief bar. Sim drop now refuses while relief waits (and its button is disabled), and the journeys that drop afterwards call `reliefFirst`, which takes whatever drop is offered.

**The out-of-bounds rule** is `round.outOfBounds` (`'stroke'` or `'e5'`), set in
Format & tees, applied to the live round and kept as a preference
(`fairway-rules-v1`, read into `Round.defaultOutOfBounds` before the first round
is made).

### The profiles

**Every golfer is a profile, by id.** A round's player carries `profile`, the id of the profile it is; `Round.setPlayers` passes it through, so a golfer who stays keeps counting to the same profile and one who joins counts to theirs from their first shot. `profileOf(player)` looks the id up, and falls back to the name (ignoring case) only for a player with no id -- a save from before profiles. Names are unique on a device for the same reason: a name is what a player picks from a list, and two the same would make the list a guess.

**The main profile** is `store.main`: the first one made (by the welcome), player 1 in every new group because `useMainProfile()` sets `Round.defaultPlayer` to it, and the one the menu tile and My profile open on. It is otherwise a profile like any other -- every seat records -- and it cannot be deleted until main is handed on. The owner asked for exactly that: "users can select who the main profile or player 1 is ... other than that there should be no difference."

**The group editor is where profiles are made.** Each row is a `<select>` of profiles not already in the group, plus *New player...*, which opens a name box. `readDraft()` turns the draft into players and is the ONE place a new player becomes a profile: a typed name that already belongs to a profile is that profile, an empty name or the same golfer twice throws before anything is created, and every caller shows the message. Because all four group setups -- round, endless, range and a mid-round change -- go through `groupEditor`/`readDraft`, adding a golfer anywhere makes them a profile. Rejected: free-text names matched to profiles by spelling (the first build's rule). A typo made a stranger, and a friend called Alex was silently merged with the placeholder.

**A removed round stays removed.** `removeRound` takes the entry out and adds its id to the profile's `removed` list (last 200), and `tallyShot` and `syncHole` skip any id on it -- otherwise a round removed while still being played would be written straight back by its next finished hole. Old records have no list, which reads as empty, so it needed no migration.

**A backup is merged, never poured over.** `exportProfiles` writes the whole store as a file (`kind: 'fairway-profiles'`); `importProfiles` reads any version `normalise` knows, the first build's single profile included, and merges: a new player is added, the same player (same id) keeps whichever copy was active more recently -- counters cannot be added together without counting shots twice -- and a different player with a taken name is renamed "Name (2)". The device's main profile stays main. A file that is not a backup throws before anything changes.

**A rename follows the golfer.** `followRename` renames that profile's players in the round on screen, a round waiting behind *Continue* and an open group editor, so the card and the history keep agreeing.

**The history copies the scorecard; it never keeps score itself.** `save()` runs whenever the round changes -- a shot, a scramble choice, a mulligan, a golfer joining or leaving -- and ends in `syncProfile()`, which writes every seat's card cell for the current hole into that golfer's history entry, or removes it when a mulligan has un-holed it. So the history cannot disagree with the card. `syncProfile` skips the write when no golfer's record for the hole has moved, because `save()` also runs for a green-reading toggle. A mulligan is counted for whoever is up after it, which is the golfer whose ball was taken back. Running totals (shots, sand, water, trees) are counted once per ball in `finishShot` by `recordProfileShot`, BEFORE `save()`, from facts taken before `round.takeShot` moved the turn on. Fairway hit and green in regulation are written on the hole's own record rather than counted, so a mulligan overwrites them instead of counting twice.

**Rounds have an id now.** `Round.uid` rides through every save, restore and mulligan and is what a history entry is keyed by, so a round left and resumed is one entry. A save from before it existed gets a fresh one on load. Generated in the constructor; `Round.restore` passes it through.

**What breaks if this goes wrong.** A profile write that throws must not throw out of a shot: `storeProfiles` catches, halves every history and tries once more, then gives up quietly. The store is normalised field by field on load -- a bad counter, round or whole profile is dropped, not the store, and a `main` that points at nothing falls back to the first profile. A counter added to `COUNTERS` needs no migration (old records read zero); a change to the record's SHAPE bumps `PROFILE_VERSION` and adds a `MIGRATIONS` entry with a test.

**Every tool that opens the game must seed a profile.** With none, the welcome sits over the menu at z-index 90. smoke.mjs (except the `fresh` journey that tests the welcome), tools/profile.mjs and tools/capture/capture.mjs all set `fairway-profiles-v1` (one main profile) in an init script, and only when it is absent, because init scripts run again on every reload.

**Replay this course** restarts a course from the generation settings the entry kept (migrated and validated like a library course) and an endless run from its seed (`startEndless(group, seed)`). An entry from an older generator replays on today's generator and is marked as such.

### The green, read from above

**The map frames the green whenever the ball is on it, and paints the contour field top-down.** `mapLayout` takes a `focus` argument; `focus:'green'` fits `greenBounds` instead of the hole. This exists because the 3D contour overlay is only legible from where you are not standing: read from the ball, the far half of the green is a few pixels tall, which is exactly the half you are trying to judge. The map is already a top-down view, so it gets the same field.

**`src/green-map.js` is pure apart from one function.** `greenBounds`, `heatField`, `heatColor` and `contourBand` are testable in Node; only `greenHeatTile` needs a 2D context. Bounds are SAMPLED from `greenRadius` around 64 bearings rather than assumed circular -- greens are stretched by `greenAspect` and their outline wobbles with the hole seed, so a circle clips the side you were reading.

**`lo` and `hi` come from the putting surface ALONE.** Include the sampled surround and a green sitting in a hollow scales itself against the bank behind it: the putting surface then occupies a sliver of the ramp and reads as uniformly flat, which is the opposite of what the tool is for. A test asserts the range equals the on-green range and that the surround exceeds it, so the test would fail if the sampling widened again.

**The ramp matches `createGreenReading` exactly** -- hue `(1-t)*0.64`, saturation 0.88, lightness 0.48, contours every 10 cm. `heatColor` returns HSL so the two renderers cannot drift apart through one rounding to hex; the tile's own pixel loop converts by hand and has to agree with it. Two views of one green that disagreed would be worse than one view. Contours are drawn as band EDGES -- a pixel whose band differs from the one left or above it -- so a flat green simply draws none rather than needing a special case.

**THE TILE IS PROJECTED, NOT FITTED INTO A BOX — and the first version got this wrong.** `mapPoint` is `w/2 - (p - c) * scale` on BOTH axes, so the map is the world turned through 180 degrees. The tile's pixel (0,0) is minimum x and minimum z, which belongs bottom-RIGHT on screen. The first version projected the two corners and normalised the destination rectangle, which puts the image at the right size in the right place and half a turn out: the high side of the green painted over the low side. A green-reading tool that reads exactly backwards, and it looks entirely plausible while doing it — reported from a screenshot, not caught by anything. `tilePlacement` in `course-map.js` now derives a translate/scale from `mapPoint` itself, so the negative scales carry the flip and the tile cannot disagree with the outline drawn over it. Three tests pin it, including one asserting the scales are negative, so the day the map stops negating its axes the placement does not silently become a no-op. Measured in the browser: the painted tile covers 99.3% of the green disc, and 45.8% if rotated the old way.

**The field is sampled at PIXEL CENTRES**, `(i + 0.5) / n`, not `i / (n - 1)`. The grid is drawn as an image covering the bounds rectangle, where texel `i` spans `[i, i+1]`; corner-to-corner sampling put the whole field half a texel out of register with the ground it describes.

**The tile is cached per green.** The map redraws about twelve times a second and the field is thousands of `course.height` calls. The key covers everything that reshapes the surface; a pin moving does not, because a cup is cut into the green rather than reshaping it. The cache clears above four entries: one green at a time is all the map ever shows, so it exists to survive redraws, not to hold a course.

**The three toggles live on the map header, not in a panel.** They were checkboxes inside a *Green reading* tool window, which meant covering the green with a drawer to change how you were looking at it. `.map-reading` holds `#readSlope`, `#readFlow` and `#readHeat`; the `reading` panel and its `TOOL_PANELS` / `POPUP_SIZE` / `PANEL_TITLES` entries are deleted. They hide below 560px, where the map is 104px wide and the header already drops its icons.

**On a flat range green all of it is inert**, with the buttons carrying the reason in their title: the grid paints everything "under 1%" blue and the heat map everything "lower ground" blue, which has already been reported once as a rendering fault. A range green with a slope set up (16 October 2026) reads like any other -- the switch follows `shapes(activeGreen(course).setup)`.

**Ask the green question, do not cache it.** `updateExplorer` runs BEFORE `updateHUD` when a shot finishes, so reading the cached `ballOnGreen` for the map title left the heading one pass behind the picture. `onGreen()` does the surface lookup at both call sites; `ballOnGreen` stays for the aim-marker suppression below, which is set and read inside the same pass.

**On the green the aim marker shows too, since 14 October 2026.** `ballOnGreen` used to suppress it by hand, because it sat feet from the flag marker and the roll preview line already drew where the putt finished. The putt preview is gone (the owner's call: a straight line to the aim, and the break read from the green), so the aim point is the putt's intended length and is shown for every golfer, as it always was off a monitor. The flag is `updateHUD`'s lie, cached rather than re-derived, because the render loop asks sixty times a second and `course.surface` is not free.

**(Superseded: `aimCaption` is gone, see above, and since 14 October 2026 so is the putt preview it described.)** **The caption carries what the number measures.** `aimCaption` was module state set by `updateAim`: *TO AIM POINT* for a normal shot, *TO WHERE IT STOPS · OFF THE GREEN* for a putt preview, because a putt preview ends where the ball stops rather than where you pointed and whether that is still on the green is the whole point of it. That sentence used to live in the strip; removing the strip without moving it would have thrown the information away.

**The tee selector sits in the shot panel** under the club -- what you are hitting with, and what you are hitting from. It leaves the panel in monitor mode and on a phone: the owner's call is that a tee is picked before playing, in the round's Format & tees, and both of those panels are short of height.

CAUTION when editing the mode-hiding rules: they are long selector LISTS where the `#world[data-mode=…]` prefix belongs to each item individually. Inserting `.aim-label` after a comma made it a bare selector and `display:none!important` in every mode — the element measured 0×0 and looked like a projection bug. The give-away is a computed `display:none` on something whose own rule says `flex`.

**THE KEYBOARD SHORTCUTS OF 10 OCTOBER 2026** follow GSPro's where they can: **A** resets the aim to what the turn started with (`resetAim`, through `defaultAim`, which `setUpTurn` now calls too, so the two can never disagree; by hand on the green it resets the putt's power as well), **I/K** change club beside Q/E, **H** hides everything over the course (`hud-hidden` on `#app`: the top bar and every child of `#world` but the canvas, the toast and the key list; H or Escape brings it back), **Tab** lists the keys (`#keysHelp`; its ↑ ↓ line says Power or Aim point by mode), and **G** steps the camera to the aim point, the green, and back to the ball. GSPro uses F3 for that; F3 is the browser's Find. The aim-point view is a camera mode of its own (`target`, renderer.js `setCamera`), 34 m short of the aim ring along the line from the ball and 22 m up, both placed; with no ring drawn it falls back to the view from the ball. Rejected: a rangefinder (GSPro's R), turned down by the owner.

**THE AIM AND PIN LABELS TAKE TURNS** (10 October 2026). The flag marker is the one at rest; the player moving the aim -- `touchAim()`, called from every input path and from nothing that sets aim up on its own -- fades it (`.faded`) and fades the aim marker in, for `AIM_LABEL_HOLD` (1 s, placed) after the last touch. It closes the TODO "The flag marker and the aim marker overlap on screen", which they did from the tee at 1280x720 and 1366x768: the 8 m rule only stopped the two POINTS coinciding, never the two LABELS. The 8 m rule now applies only at rest: while aiming the pin's label is faded, and the rule had made the aim label vanish as the aim crossed the pin (owner, 11 October). Rejected: moving one label aside, which still leaves two numbers to read at a glance, and the owner asked for the turn-taking.

**The pin distance was on screen twice** — once in `#flagLabel` beside the flag and once as `#bottomPin` in the strip above the shot bar. The strip's copy is gone. NOTE the loop that fed it: `for(const id of ['bottomPin','explorePin'])$(id).textContent=…` would have thrown on a null and taken every line of `updateHUD` below it, which is most of the HUD. `#explorePin` is a separate readout in the flight bar and shares the `.pin-readout` class, so `querySelector('.pin-readout')` finds THAT one first — worth knowing before concluding the removal failed.

**Red, amber, green, or nothing.** `monitorState()` is off with no bridge (a player who never uses a monitor should not see a permanently red light), red for bridge-but-no-device, amber for device-but-no-ball, green for ball detected. Armed, the colour outlines the launch monitor window (`#monitorPanel`) and the word heads it; connected but not armed, the same outline and word sit on a slim strip at the top of the shot controls (`#monState`); the top bar repeats it. The window's dot FLASHES, at the owner's request (10 October 2026): red quickly, amber slowly while the device hunts, and green glows steadily, because a light that keeps blinking while you stand over a shot is the opposite of helpful. The outline still breathes amber and pulses green once. Each state also carries words -- *No monitor* / *Finding ball* / *Ready*, with a line saying what to do -- since a colour alone is not a message and roughly one man in twelve cannot separate the red from the green. **Reconnect** (close and reopen the bridge at the address last used) is always in the window. **Hit by hand** went on 10 October: the window's Armed switch disarms, which brings the shot controls back, and was the same act under a second name.

**`armed` is per turn; `armSwitch` is the device's Armed switch** (Phase 3, mixed groups, 14 October 2026). Every switch -- the window's, the strip's, Connect monitor's -- sets `armSwitch`; `syncArmed` (at the start of `setUpTurn`, `setUpRangeTurn` and `updateHUD`) sets `armed` to `armSwitch` while connected AND the golfer up plays with the monitor (game.js `playsWith`: `input` 'meter' is the Swing Meter, anything else -- every golfer and save from before -- follows the switch). Everything that read `armed` still does, so a round with nobody on the Swing Meter plays exactly as before, and a monitor shot on a Swing Meter turn is refused by the existing unarmed check; `sendPlayer`'s `ready` follows `armed` too, and `Handed` comes from the round's player, whose hand the group editor now saves to the profile. **Never set `armed` directly**: the next `updateHUD` overwrites it. `input` rides through `Round.setPlayers`, so a switch mid-round is a group change. The group editor shows *plays with* and the hand only once a bridge has connected on the device (`bridgeSeen`: connected, or `BRIDGE_KEY` remembered). Losing the bridge on a monitor golfer's turn turns the switch off with a toast, and the Swing Meter is what comes up. **Departures from the spec:** an old round's golfers follow the switch rather than all being put on the Swing Meter (the same thing unless the monitor is armed, and it keeps old monitor rounds playing as they did); and the bridge drop is a toast and the meter rather than an offer button, because the meter is already there.

**The launch monitor window keys on `armed`, not on connection.** With a monitor armed, ball speed, launch, direction, spin and axis all come off the device, so the Swing Meter, the curve / height / spin pickers and the swing button decide nothing, and `takeShot` already refuses a manual swing. Keying it on mere connection would take the swing button from someone who connected a monitor but never armed it, leaving them unable to hit at all. Armed, `monitor-armed` on `#world` hides the shot controls altogether and `#monitorPanel` shows: the light, the Armed switch, the shot line (moved in from the shot controls, 13 October 2026), the club (`#monClub`, a mirror of `#club`, which everything still reads) and Reconnect. **The aim controls went with them** (10 October 2026), reversing the owner's 26 September call that they stay: the owner asked for a window with nothing but the club, the light, Reconnect and the switch, and for aiming with a monitor to be the keyboard, the mouse and the map. To make that enough, **aim is unlocked for every club while armed**: ↑/↓ walk the aim point (`walkReach`; since the Swing Meter, 14 October 2026, they do the same by hand -- the power they used to set is gone), the aim pad's ˄ ˅ step it a yard, or a foot inside twenty yards, and the PUTTER aims at a point like any club -- since the Swing Meter every putt is aimed at a length by the circle, armed or not, and `setUpTurn` starts every putt aimed at the hole, the whole distance; by hand the circle's length is the putt's length, drawn as a straight line. The walk rate is placed, not measured: 15% of the distance a second, never under 2 yd/s, quickening to four times that over 1.5 s of holding. Armed, the shot panel's numbers are GROUPED (`groupedGridHTML`), the groups side by side, each as wide as its share of the tiles: Ball (measured), Club (from the monitor; shown with dashes when the device sends none, since 11 October -- it used to drop out) and Result (simulated). **The two ways of playing keep separate Shot data** (`loadShotData(mode)`, `fairway-shot-data-monitor-v1` beside the hand set's v2): the monitor set starts as the player's hand set if they ever chose one, and as `MONITOR_FIELDS` -- twelve, the five, four club numbers and carry, total, offline -- otherwise. Before 10 October monitor mode showed eighteen fixed tiles unless the player had chosen their own. **The shot panel keeps a place per mode too** (layout.js `setVariant`; a moved panel's place is stored under `.shot-panel@monitor` while armed). The window has one place: it only exists in one mode. **The big numbers card** (`#shotCard`) that came up when a monitor shot settled and waited for the next ball to be teed went on 10 October 2026: the shot panel shows the same numbers, live during the flight and kept until the next shot, for every shot rather than only a monitor's. A timer had been rejected for it because it runs out while you are still looking; the panel has no timer either. The class goes on `#shotControls` itself, so it follows every mode that shows that bar — verified in play and on the range.

**The bridge passes on every club a bag can hold, and a club it does not know never closes the browser's connection.** Its list of accepted club codes was typed out for the eight stock clubs; once a golfer's bag could hold any of nineteen kinds (12 October 2026), choosing a 4 iron, a hybrid or a gap wedge sent a code missing from the list, the bridge treated the whole message as bad and closed the browser's socket, and the game fell back to "Connect monitor" -- with or without a device attached. The owner found it by switching clubs. `CLUB_CODES` in bridge/server.mjs is now read from `CLUB_KINDS` (clubs.js), so a kind added later is accepted without anyone remembering the bridge, and a player block it cannot use is logged and ignored -- the last good club is kept and the armed flag beside it still applies. Checked by `tests/bridge.test.mjs` (every kind's code reaches a device; an unknown one keeps the connection) and by hand on 13 October against the real bridge with a pretend device: every club in a mixed bag reached the device and a shot was accepted.

**Every response carries the Player block, not just the 201.** GSPro does this, and a real connector's log showed why it matters: it parses a Player out of each reply and was printing its own empty defaults — `"Player":{"Handed":"","Club":"","DistanceToTarget":0}` — on every heartbeat, because the bridge sent only `Code` and `Message`. A connector that tracks club changes from the response stream rather than only from the 201 would never see one.

**Still unsent: `DistanceToTarget`.** The same connector evaluates a device mode from club and distance (`MODE_EVAL source=SIM_201 club=7I distM=n/a`), and `n/a` is because the browser's player message carries only `Handed` and `Club`. Sending it would let a device switch itself into putting mode on the green. NOT done yet because the units are unverified — the device log says `distM`, the protocol is nominally yards, and guessing wrong would switch modes at the wrong distance, which is worse than not switching at all.

**Framing errors close the connection; validation errors do not.** A desynced stream cannot be recovered, so dropping it is right. One unusable shot is a different thing: the stream after it is fine. Closing on it put the connector into a reconnect loop where every retry sent the same rejected frame — which is what the field log showed. The `data` handler now has two `try` blocks, and a test asserts both halves: an unusable shot leaves the socket open, unframeable bytes close it.

**Verbose logging exists because none of this was visible.** `npm run bridge:debug` (also `--debug`, `-v`, `FAIRWAY_LOG=debug`) prints every raw payload in, every reply code out, connects and disconnects, browser arm state, and each shot decoded into mph/degrees/rpm. That decoded line is the valuable one: wrong units and swapped spin fields both look correct in the raw JSON. It is off by default — a working connector sends a shot every thirty seconds plus heartbeats between, and logging all of it drowns the one line that matters — and payloads are capped at 400 characters so a misbehaving connector cannot flood the terminal with 64 KB.

The npm script exists because `FAIRWAY_LOG=debug npm run bridge` is bash syntax and PowerShell rejects it outright. Connector software is usually Windows, so that is most of the people who will want it.


`npm run bridge` listens on loopback TCP 1921 for Open Connect v1 JSON and HTTP/WebSocket 1922 for the browser. It can serve the built app. The browser must connect and explicitly arm live shots. Raw TCP/Bluetooth cannot be served directly by the offline browser.

The bridge frames TCP messages, validates origins and shot payloads, handles duplicates, and acknowledges success only after the browser accepts a shot. A busy/unarmed browser rejects shots; there is no hidden queue. Measured monitor data bypass manual power/launch/shape biases but still uses course wind and turf contact. Device connectivity is distinct from bridge connectivity. Environment variables and platform-specific instructions are in README.md. Protocol sources and limitations are in RESEARCH.md. Do not open new network exposure as part of ordinary graphics work.

## Verification and release workflow

Use targeted Node tests while editing, then the full relevant suites. `npm test` also includes the local bridge suite, which needs permission to bind local ports. The graphics/gameplay set can run without that suite:

```sh
node --test tests/core.test.mjs tests/world.test.mjs tests/landscape.test.mjs tests/play.test.mjs tests/refinement.test.mjs tests/course-variety.test.mjs tests/green-refinement.test.mjs tests/atmosphere-routing.test.mjs tests/landscape-edge.test.mjs tests/course-living.test.mjs tests/waterways-tours.test.mjs
```

The waterways-tours suite covers monotonic grades in both directions, above-facing channel geometry and matching levels, lake size/ownership/clearances, fairway aim, continuous rotated-hole tour poses and tree bounds. The course-living suite covers all 14 previews/routings, water below outer banks, submerged channel beds/protected tees/greens, housing exclusion, green shoulders and presentation timing helpers. Existing suites cover complete rounds, rollback, protocol normalization, deterministic worlds, procedural variety, mesh seams, ball contact, cup-edge capture, wind/flight convergence and maps. Timing helpers alone cannot prove browser presentation; also inspect the real UI.

**`npm run smoke` automates the wiring half of the list below**: it drives
step 3's sim drop beside the cup, the putt, the three-second reveal, the
scorecard and the next hole, and step 5's drop onto a green, in a real browser
on the built file, failing on any error. What it cannot judge is how things
LOOK -- the flag lifting, the cup drop, the contour tile, reflections, banks --
and it plays at most two golfers, so a whole multi-golfer round, match play and
scramble selection stay manual ON SCREEN. Their RULES are covered:
`tests/round-matrix.test.mjs` plays every format with every group in Node
(docs/TESTING.md, which maps every layer of testing). **The formats are listed
once, `FORMATS` in game.js**, read by `Round`, the save import in main.js and
the matrix, whose first test fails until its scorer plays every format listed.
Treat the list as the
visual pass after the smoke test is green.

Manual/browser regression sequence:

1. Generate 9 and 18 holes; try Square, Figure eight and Island chain, plus Links/Mountain/Island at high elevation. Inspect the full map and free-flight view. Check par/tee yardages and straight par 3s.
2. Enable homes and one river/creek. Inspect banks, fairway crossings, roofs/foundations and tee/green clearance. Test zero counts/off too. For extreme settings, fewer sites is valid; flooded tees are not.
3. Sim-drop near a cup; aim at pin; take a low-power putt. Check flag lift, visible cup drop, three-second reveal, scorecard and subsequent automatic advance. Check multiple golfers and scramble selection when changing this flow.
4. Take a long shot and watch the live distance. Replay from a later hole; check its three-second final hold and return to the correct lie without score changes. Try cancel/skip and a new round while timers exist.
5. Enable all three green-reading layers from the map header. Sim-drop onto a green and confirm the map frames it under a `GREEN · CONTOURS` heading with the contour tile painted, then move off and confirm the hole map returns. Check the three toggles are disabled with an explanatory title on the range. Return from free flight with the ball on a green. Check the persistent shot panel with a custom layout and at a narrow viewport.
6. Generate large lakes and inspect their full-course maps, shorelines and water lies. Check river reflection and muted banks through fairways in multiple biomes. Enter/leave a canopy in free flight; the whole tree should disappear/reappear. Run and cancel a flyover with all three reading tools enabled, verify only heatmap during the orbit and restored preferences afterward.
7. Check browser shader/runtime errors, save/reload and export/import. Rebuild the single HTML and verify it has no external script or stylesheet URLs. Repackage both archives with all documentation.

Potentially expensive configurations have over a million ground vertices and thousands of plants; one 18-hole Links generation with homes and two streams took about eight seconds locally before final refinements. This is a diagnostic observation, not a performance guarantee. See the worker/LOD work in TODO.md.

## Graphics tiers

`src/graphics.js` holds one table — low, medium, high — and every graphics knob reads from it: pixel ratio, shadow map size and radius, fog near/far for play and overview, grass density, foliage detail, anisotropy, cascade count, god-ray strength and the planar water reflector's resolution (512 / 768 / 1536; medium is the value that was hardcoded). `GolfView.applyQuality` applies everything that can change live; `needsRebuild` says when grass or foliage density has changed, because those are baked into the scene graph and need `view.build` to run again. The world itself is never rebuilt — the same terrain is simply drawn with more or less of it.

Two rules hold this together. **Medium began as exactly what the renderer did before tiers existed** -- every number the literal that used to be hardcoded -- and it is the default, so changing it changes everyone's picture: move it for a fault on screen, never for taste (its trees' shadow offset moved on 16 October, below). And **nothing in the tier may touch `world.height`, hazards or any played surface** — a tier is a display preference, so two players on different tiers play an identical course. That is also why the preference lives in its own `fairway-graphics-v1` localStorage key rather than in course settings: putting it in `courseSettings` would stamp a GPU tier into every saved course and make `GENERATOR_VERSION` treat a tier change as a different landscape.

High adds cascaded shadow maps (`three/addons/csm/CSM.js`), three cascades out to 2.5 km, so a tree casts a shadow wherever it stands instead of only inside the ~370 m box that follows the camera on medium. **CSM assigns `material.onBeforeCompile` rather than wrapping it**, and this project patches shaders that way in seven places, so `setupCascadeMaterial` saves the existing callback, lets CSM install its own, and then calls both. That works only because the chunk targets are disjoint: ours touch `<common>`, `<color_fragment>`, `<begin_vertex>`, `<clipping_planes_fragment>`, `<opaque_fragment>` and `<project_vertex>`, while CSM touches `<lights_pars_begin>` and `<lights_fragment_begin>`. **Check that before adding any shader patch that reaches into the lights chunks.** **Every lit material must be registered**, and `GolfView.isLit` is the list: Standard, Physical, Toon, Lambert and Phong. Only `MeshBasicMaterial` is genuinely unlit. Missing one is not a small bug — a lit material without CSM's define falls through to three's stock lighting loop, which sums all three cascade lights at full intensity, and because each cascade's shadow map covers only its own depth band, a fragment shadowed in one is still lit by the other two. That triples the light and thins shadows to about a third, silently. It shipped once: the turf and every tree are `MeshToonMaterial`, the predicate only named Standard and Physical, and the whole picture washed out with nothing in the console. `registerCascadeMaterials` now re-runs on hole change and water rebuild, and warns by name if any lit material escapes it.

Two materials do not live in the scene graph when registration runs, and each was wrong for its own reason. Both are worth knowing before adding anything that renders.

**The grass was invisible to registration, and to the warning.** Near-field grass tiles are built lazily as the camera moves, so at registration time that group holds no meshes at all and a scene walk finds nothing to register — the material exists, but only as a closure variable in `addNearbyGrass`. It was lit by all three cascades at once and stayed lit inside shadows the ground beneath it was already in. The fix is `view.lazyMaterials`: a material with no mesh yet pushes itself there and `register` walks that list as well as the graph. The subtler half is that **the audit had the same blind spot** — it walked only the scene graph, so it dutifully reported nothing wrong. A guard has to check every place the thing it guards checks, or it is worse than no guard, because it reads as a clean bill of health.

**The water is excluded on purpose and re-registered every frame.** It is deliberately not routed through `surfaceMaterial`: it needs metalness and a reflection, and `MeshToonMaterial` has neither, so water is the one lit surface in a cartoon frame that stays PBR. That exclusion is correct, but it means water never picks up cascade registration from the normal path — and the reflector can *replace* the material when it rebuilds, which silently un-registers it. So `updateWater` re-checks `water.material.userData.csm` every frame and registers it again if it has gone. It is a cheap flag test, and the alternative is water that brightens by 3× the first time the reflector rebuilds and never recovers.

The general shape of this trap: **anything built lazily, or rebuilt by something other than `build`, will escape a one-time scene walk.** The floodlights planned for night play will be in exactly that position if they are created on demand.

The ordering inside `register` also matters and is not arbitrary. Mist is applied first and *without* the `isLit` test, because unlit materials still take fog and the landscape ring on the horizon is `MeshBasicMaterial` — leaving it out hangs a crisp edge of world behind a hazy course. Clouds are applied *after* cascades, because CSM assigns `onBeforeCompile` rather than wrapping it, so anything installed before it is lost.

`PCFSoftShadowMap` is **removed** from three's runtime — setting it logs a warning and silently falls back to hard PCF. Shadow softness comes from `light.shadow.radius`, which the PCF chunk spreads over a Vogel disk. Medium keeps radius 1, three's default and the edge it has always had; high uses 3.5. CSM owns its own directional lights, so `makeCascades` zeroes the single sun; a rebuild recreates it, which is why turning cascades on or off goes through `needsRebuild`.

Terrain grid resolution is deliberately **not** a tier. `makeGroundGrid` feeds `world.height`, which serves both rendering and ball contact, so a denser grid would move where the ball lands.

GPU timings on this hardware are noisy: medium alone measured 1.85, 5.43 and 4.14 ms across three runs of the same scene, so treat any single figure as indicative and never quote a delta from one pair of samples. Both tiers sat inside the 8.33 ms budget at 120 Hz on an RTX 4090 in every run.

Frame colour, by contrast, is highly repeatable, and it is the right acceptance test for a lighting change. Read the framebuffer with `gl.readPixels` inside a nested `requestAnimationFrame` (so the app has drawn) and compare mean luminance, mean saturation and the darkest decile between tiers from the same camera. High must land within a few percent of medium on luminance and saturation: measured 134.3 vs 134.6 luminance and 0.506 vs 0.506 saturation. A tier that brightens the frame has a lighting bug, not a nicer look. Use `EXT_disjoint_timer_query_webgl2` to measure — wall-clock frame times read a flat 8.5 ms everywhere because of vsync and tell you nothing.

### God rays

`src/godrays.js` runs on the high tier only. It is deliberately **not** built on `EffectComposer`: routing the scene through a render target costs the canvas its MSAA, and high looking more jagged than medium would be a bad trade for light shafts. The scene still renders straight to the canvas exactly as before, and the pass draws one extra full-screen quad on top with additive blending. Nothing reads the scene colour back and nothing blurs it, so the sharp turf boundaries the art direction rests on are untouched — that is the narrow condition postprocessing was allowed under.

Each frame the pass renders an occlusion mask at quarter resolution — sky hidden, clear colour white, every solid thing drawn flat black through `scene.overrideMaterial` — then smears it radially away from the sun's projected screen position. Two details are load-bearing. The sun must be in shot: the pass early-returns when it is behind the camera or far outside the frame, which also means it costs nothing most of the time (draw calls jump from ~127 to ~242 only when the sun comes into view). And each tap is weighted by its distance from the sun. Without that weighting the whole sky becomes the emitter and the frame fills with a flat wash and no beams at all, which is what the first version did.

**THE GOD RAYS ARE WARMED BEHIND THE LOADING SCREEN, AND ONLY SOLID THINGS GO IN THE MASK.** Because the pass is skipped with the sun out of shot, and draws through its own override material, nothing in the shader warm-up ever built its programs: the black material needs one per KIND of object (instanced or not, with instance colours or not, with normals or not), plus the composite. They were built the first time a player faced the sun -- 8 s frozen in the owner's Course studio on Ultra. `ready`'s frame now passes `warm` (from `view.readying`): the pass runs whatever the sun is doing, at intensity 0 so the composite discards everything, and with frustum culling off for the mask so kinds behind the camera are drawn too. The mask render switches `renderer.shadowMap.autoUpdate` off and back on: every `render` redraws all shadow maps otherwise, and the frame has just drawn them -- left on, a sun-facing frame drew the cascades twice (RESEARCH, *The god rays drew every shadow map twice*). Lines, points and sprites (`isLine`, `isPoints`, `isSprite`, `isLineSegments2`) are hidden for the mask every frame: they block no sun, and the aim line, which appears only in play, was the last late program. Anything new drawn into the scene that is neither solid nor one of those kinds needs the same thought. RESEARCH, *The studio froze when the camera turned to the sun*.

### What each body of water reflects

Every body reflects its own surroundings from its own cubemap probe, and that never changes while you play. `setReflections(on)` does not switch a reflection on and off — it chooses what the probes hold: the course, or the sky alone. Both are free per frame, so the setting is a look rather than a cost, and it is no longer in the panel's "costs a frame" group.

`src/water-bodies.js` holds the two things about a body that are not geometry, kept free of three so they can be unit tested: the probe hide/restore pair, and `flowFor`, which gives a creek a direction along its channel and still water none. The file replaces `water-reflector.js`, whose whole job — scoring which pond deserved the one mirror — no longer exists.

## Imported geometry

Trees, bushes, cacti and palms are drawn from CC0 model packs rather than built
from primitives, wherever the packs cover the species. `tools/build-meshes.mjs`
is the ingestion step: it reads `vendor/<pack>/*.glb`, strips every material,
classifies each primitive by its material name into a **role** (bark, leaf,
stone, dirt, accent), normalises the model to unit height centred on x/z, and
writes `src/asset-meshes.js` with int16 positions and int8 normals. Re-run it
after changing the `PICK` list; nothing else regenerates that file.

Discarding the source materials is the point, not an optimisation. The packs
colour surfaces with a `baseColorFactor` per material, and an imported colour
would fight `world.bio` instead of serving it. Because only a role survives, one
imported pine renders correctly in all seven biomes, and autumn still shifts hue
per tree through `t.shade`.

`addModelSpecies` in vegetation.js decides which model each tree is, then varies
height, girth, lean and tint per instance. **Instances are scaled by height with the model's own proportions kept** — deriving the width from `t.r` instead made a saguaro as wide as it was tall, because `t.r` is a foliage radius that the procedural cactus never used either. Nothing downstream depends on the visual width: `trunkRadius()` in physics.js derives collision from tree height, not from `t.r` — a model alone would be one silhouette
stamped repeatedly, which is the problem the procedural work in the same file was
solving. Instance colour carries the whole tint so a single white material per
role serves a stand, and each instanced mesh registers in `view.treeInstances`
so camera-tree clearing keeps working.

**Species the packs do not cover keep their procedural shapes.** Palo verde and
mesquite now map to the `arid` family (Quaternius dead trees, which read far
closer than a green canopy would), but **ocotillo, agave and hala stay
procedural** — spindly canes and a ground rosette are shapes these packs simply
do not contain, and a wrong silhouette is worse than a simple one. `FAMILY_OF` in mesh-assets.js is
the mapping; a kind absent from it falls through to `addSpecies`.

The ingester reads GLB (Kenney) and OBJ (Quaternius). Watch the vertex budget
when adding from the latter: its models are several times denser, and pulling in
coverage Kenney already provided took the packed geometry from 417 KB to 1.34 MB
for no visible gain. Quaternius earns its place only in the desert, where Kenney
has two cacti and nothing arid at all.

Houses are the exception to the materials rule. The Kenney suburban buildings
carry a shared texture atlas rather than a colour per material, so their UVs are
kept (quantised to uint16) and `colormap.png` ships base64 in the same module.
**Four atlases ship, not one.** Each is a palette grid, so a building takes all
of its colour from whichever it is drawn with and every roof in that atlas is
identical — one atlas made every roof on the course the same green. Kenney's three
recoloured variations fix that; `instanceModels` buckets on `entry.variant` as
well as model and role so each atlas gets its own material. Two things about the
atlas are load-bearing: it must be sampled with
`NearestFilter`, because it is a grid of flat swatches that bilinear filtering
bleeds together, and **`flipY` must be false** — glTF puts the UV origin at the
top left while a `THREE.Texture` defaults to the bottom left, and getting it
wrong samples the mirrored swatch, which shows up as green roofs and walls.

`addHomes` fits each building to the **same width x height x depth box that
`simulateShot` collides against**, so what is drawn and what the ball hits are
the same object; the models are boxy enough that filling the box costs no
visible distortion, and matching the collider matters more than preserving their
aspect. `generateHomes` is untouched, so siting, foundations and the
`residentialOB` rule all behave exactly as before and no saved course changes.
A test asserts the drawn extents track each home's collider within 0.6 m.

`meshAtlas()` returns null when `Image` is undefined, so the house path builds
under Node for tests instead of throwing.

Cost: 71 models, 729 KB packed, 1006 KB as a base64 module, about +1.03 MB on
the built file. `vendor/` holds the complete packs (20 MB) as provenance and is in
neither the build nor the release archives.

### Cloud shadows, occlusion and bloom

Three effects, and **four tiers** rather than three: measured together these take
high from about 4.8 ms to 8.3 ms of an 8.33 ms frame at 120 Hz, so the two that
need the frame itself moved to a new **ultra** tier and high keeps a budget it
can hold. Medium is still pixel-identical to what Fairway always rendered.

**Cloud shadows are IN and have been for some time** -- they predate the rule that documentation ships with the change, which is why they were only ever written up here and not in the README. They are now in both. (`cloud-shadows.js`, high and ultra.) They add no render pass at all.
They patch every lit material and attenuate `reflectedLight.directDiffuse` at
`<lights_fragment_end>` — after the lights have accumulated, which is where "how
much sun reaches here" is one number. Ambient is left alone, because a cloud
blocks the sun and not the sky. **Chunk ownership is now three deep**: CSM holds
`<lights_fragment_begin>` and `<lights_pars_begin>`, ground.js holds `<common>`,
`<color_fragment>` and `<begin_vertex>`, and this holds `<lights_fragment_end>`
and `<project_vertex>`. Check that list before adding a fourth patch. World
position is taken *after* `<project_vertex>` because instanced meshes carry their
transform in `instanceMatrix`, and a position captured before it is wrong for
every instance but the first.

**Ambient occlusion has been REMOVED.** It worked and was measured: from a tee it reached 5.4% of the frame at a mean multiplier of 0.997, for a full extra render of the scene with an override material. Ambient occlusion shades where surfaces MEET, and an open fairway is close to the worst case for it — a tree line at the edge, a bunker lip, otherwise sky and grass. Local relief in the ground shader does the same job for the ground, for free, and better. It is gone rather than defaulted off: a switch nobody should turn on is not a setting.

**Bloom** (`bloom.js`, ultra) is the only effect that cannot avoid a render
target, and a render target costs the scene **two** things a normal material
does for itself. three skips tone mapping entirely unless the render target is
null (`WebGLPrograms.js`: `if ( currentRenderTarget === null ... )`) and writes
the working colour space — linear — instead of sRGB (`WebGLRenderer.js`, the
`colorSpace` ternary). The composite therefore ends with `<tonemapping_fragment>`
and `<colorspace_fragment>`, in that order. Omitting them renders the whole tier
untonemapped and ungamma'd, which looks like a much darker, oddly warm picture
and is easy to mistake for an effect being too strong. Do **not** add the
matching `_pars_` includes: three already injects both into a ShaderMaterial's
fragment prefix, and a second copy fails to compile on `toneMappingExposure`.

The bright-pass threshold reads those **linear, untonemapped** values, so it
belongs above 1.0 where only sun, sky and speculars live. At 0.78 most of a
sunlit fairway bloomed, which measured as +13% mean luminance and -25%
saturation against the identical scene — a wash rather than a glow.
 The scene draws into a **multisampled** target (`samples: 4`) which
resolves with anti-aliasing intact; get that wrong and ultra looks softer than
medium. Occlusion and god rays composite into that same target before the bright
pass, so they bloom with the scene instead of being pasted over the result.

Frame colour is the acceptance test for any of this, and the comparison is only
valid **within one page load**: switching tier rebuilds the scene but keeps the
world and camera, whereas reloading lands the studio camera somewhere else and
moves mean luminance by 15% on its own. Ultra should sit within a couple of
percent of high on mean and saturation. It used to be checked with a dark-decile
test as well — the darkest tenth falling about twice as far as the mean, which
was ambient occlusion shading rather than dimming — and that check went with the
feature. Measured before removal: mean -1.8%, saturation +1.4%, dark decile -4.0%.

**GPU cost depends enormously on where the camera points, not just the tier.**
The god-ray pass renders the whole scene a second time (its mask -- since 9
October without redrawing the shadow maps, which it used to do too), and it
only runs when the sun is in frame, so the same tier measures 4.8 ms looking one way and 9.8 ms
looking another. Compare tiers only within one page load *and* one camera
position. Measured in a single sun-facing view: medium 2.3 ms, high 9.8 ms, ultra
13.3 ms — which puts high over the 8.33 ms budget of a 120 Hz display in that
view, and is what the frame cap is for.

A cloud optimisation was tried and reverted, and the measurement is worth keeping:
moving the field from the fragment shader to the vertex shader gave **exactly the
same 9.83 ms**, proving the noise was never the bottleneck, while interpolating
one scalar across triangles flattened the shade away. The god-ray scene pass is
the cost.

### Clouds

`src/clouds.js` builds actual clouds: seeded clusters of low-poly blobs, instanced
into one mesh, drifting on the course's own wind and wrapping inside a box so the
sky never empties. Each cloud also publishes a **disc** — centre and radius — and
`cloud-shadows.js` patches every lit material to project those discs down the sun
direction onto the ground. Shadows therefore land where the sun would actually
throw them, offset from the cloud rather than directly beneath it, and follow the
terrain for free.

**A noise-field version came first and was removed.** It shaded the ground from a
function nobody could point at: soft, global, and with no way to check it beyond
watching frame luminance wobble. That ambiguity cost several rounds — including a
vertex-shader "optimisation" that measured at exactly the same 9.83 ms, proving
the noise was never the cost, while flattening the shade away entirely. Discrete
clouds are better art *and* testable: `tests/clouds.test.mjs` asserts the discs
sit on their clouds, that clouds move more than 80 m in ten seconds, that they
wrap after half an hour instead of escaping, and that a shadow lands at the
sun-projected point rather than under the cloud.

**Sizing is a coverage calculation, not a guess.** The first attempt scattered 14
clouds over a 44 km² box — about 9% of sky covered, so usually no cloud was near
the course at all and there was nothing to see. 16 clouds of 300–540 m radius in a
14.7 km² box is 8.9 km² of disc, 60% of the area, landing near 45% of sky once
overlap is counted. If clouds ever look sparse or crowded, that is the arithmetic
to redo.

Clouds do not cast into the shadow map: at 640 m the cascade covering them would
only smear the result and would compete with the tree shadows for resolution. The
cloud material sets `userData.clouds` so the shadow patch skips it — a cloud is
above the weather, not under it.

## The range is a hole, and must stay one

`range.js` hand-builds one hole object filling the same contract `generateCourse` returns, and `generateWorld` branches to it on `settings.range`. Everything past that branch — routing, terrain, ground textures, vegetation, physics, map, floodlights, firmness — treats it as an ordinary hole and needs no special case. Keep it that way: the moment the range needs its own `surface()`, its own renderer path or its own physics, the painted ground and the ball's lie are free to drift apart, and that drift is silent.

**`course.js` and `range.js` are a circular import.** `course.js` imports `buildRange`; `range.js` imports `localSurface` and `TEE_PAD`. Function declarations hoist, so calling `localSurface` later is safe — but a `const` like `TEE_PAD` is still uninitialised while `range.js`'s top level runs, and touching it out there throws `Cannot access 'TEE_PAD' before initialization` for anything that imports `course.js` first, which is everything. Read course.js bindings **inside functions only**.

**`worldKeyFor` includes `range` and deliberately excludes `rangeGreen`.** `range` is not a schema key, so without it a course and the range sharing every slider value hash identically and the cached world is handed back for both. `rangeGreen` stays out because moving the green is four floats in the cup atlas and must not throw the landscape away.

**`loadCourse` must not rescale the range.** It rewrites `holes` and `courseYards` to match the round; the range branch short-circuits that, because the whole point is the same 500 yards every visit.

**A hole needs a real `bio`.** The range first shipped with `bio: null` on the theory that a practice ground has no region. `updateHUD` reads `course.bio.name` and `course.bio.temperature`, and the flight model reads `course.bio.altitude`, so `loadCourse` threw *after* building and drawing the world but *before* reaching `setMode('play')`. The symptom is worth recognising: the range rendered perfectly with the main menu still sitting on top of it, and the only trace was one caught promise rejection in the console. If a mode ever appears to load but will not take over the screen, look for a throw between `loadCourse` and `setMode`.

**A contoured green cannot be slid, only regrown.** A flat green is four floats in the cup atlas and slides in place. A contoured one has its shape baked into the world's height field, so sliding it puts the cup on flat ground while the contours stay where the green used to be — and nothing complains. `setRangeGreen` branches on `greenDifficulty` and clears `worldKey` before `loadCourse` on the contoured path; `greenDifficulty` is a generation key, so that clear is what makes the world actually regrow instead of being reused from cache.

This branch lived in `labGreenAt`, and removing the lab mode left `setRangeGreen` carrying the whole job with only the cheap half of it — invisible while `RANGE_SETTINGS.greenDifficulty` is 0, and silently wrong the moment a sloped bench was asked for. `tests/range.test.mjs` now asserts the rule directly: slide a difficulty-70 green and the slope under the cup collapses to under a quarter of what regrowing gives. The test says in its own failure message that if the two ever match, the branch can go.

**THE RANGE'S GREENS ARE A LIST (16 October 2026).** `h.greens` holds every putting surface -- the centre green first, the six targets, the short-game green -- each a small hole-shaped record (`green`, `pin`, `greenSize`, `greenAspect`, the waves, `phase`) so `greenDistance` and `greenRadius` work on it unchanged. **`greenDistance` on a hole with `greens` is the nearest edge of any green not `hidden`**, so `localSurface`, the maps, challenge spots and the putting aids all see every green with no change of their own; the ground shader loops over the same greens from `HOLE_ATLAS.greens` (three texels each, the count in the pin texel's third channel, written by `writeRangeGreens`). Keep the two loops the same rule -- the painted-ground test walks the range, short-game green included, and requires paint and lie to agree everywhere. **One cup is live at a time**: the physics capture in `course.pin` and nowhere else, so `h.green`, `h.pin` and the cached `worldGreen`/`worldPin` are the green being PLAYED TO (`setActiveGreen`: the one nearest the aim from the mats, within 12 m of its edge, or the station's green), while the hole's own `greenSize` and waves stay the centre green's, because the shader's route texel reads them for the first green. The renderer's `this.flagsticks[0]` follows the live cup (`refreshRangeGreens`), so lifting the pin lifts the right one; the others ride after it in the same array so they sway and keep their scale. **A target the centre green covers is `hidden`** (`hideCovered`): not drawn, not a green, and never the live cup. **A shaped range green is in the ground** -- `rangeGreensShape` in course.js, faded to level 8 m past the fringe -- so a set-up change regrows; the world key carries it (`rangeKey`). The set-ups are device-local (`fairway-range-greens-v1`), never in a save.

**The bench is built to order.** `enterRange(options)` takes `difficulty`, `seed`, `stimp`, `firmness` and `green`. It took none of the first three when the lab mode was removed, so `lab.green({difficulty:35})` quietly built a dead flat green and then honestly reported a slope of zero — the instrument was not lying about the result, but it was ignoring the request. `lab.open()` with no options resets the bench to flat, which is the clean starting state for a measurement.

**`lab.greenAt` throws rather than no-opping.** `setRangeGreen` returns silently when `rangeMode` is off, which is right for a slider and wrong for a console call — a measurement that quietly did not move the green would be attributed to the physics. It now names the problem, rejects a distance outside `GREEN_RANGE`, and reports where the green actually ended up rather than what was asked for.

## A hosted copy installs to a home screen; the portable file never knows

Hosted -- Netlify, Cloudflare Pages, GitHub Pages -- Fairway can be added to a
phone's home screen and open like an app. Four pieces, and one rule about each:

- **The icons travel INSIDE what asks for them, never beside it.** The
  owner's Netlify site was password-protected (until it went public on 7 October
  2026) so it could not be scraped, and Netlify answers every request without the visitor's login with a 401. A
  phone adding a page to its home screen fetches the icon ON ITS OWN, without
  Safari's login -- so the first version, which linked icon files, got 401s
  and iOS fell back to a screenshot. Now the 180 px home-screen icon is a data
  URL inside `index.html`, and the manifest's three icons are data URLs inside
  `manifest.webmanifest`. Both are WRITTEN by `node tools/make-icons.mjs`,
  which draws the PNGs in `public/` from the brandmark path through Playwright
  and then embeds them -- change them there, never by hand. The PNGs stay in
  `public/` as the source and as the conventional files a public host serves.
  `public/` is copied beside the page by the build, so `dist/` IS the upload;
  the packager includes it in the source archive.
- **The manifest is linked by `main.js`, and only over http or https.** A
  `<link rel="manifest">` is fetched as the page loads; opened from disk there
  is nothing beside the file to fetch, and it fails with an error in the
  console -- while the portable file promises no requests. **Never make it a
  static link in `index.html`.** Its addresses are relative, so it works at a
  site's root and in a sub-folder alike. **It is linked with
  `crossorigin="use-credentials"`**: a manifest is fetched WITHOUT the
  visitor's login unless the link asks, so behind a password it came back 401
  even with the page itself loaded. It stays a real file rather than a data
  URL because Chrome treats `start_url` as invalid unless it shares an origin
  with the manifest, and a data URL has none.
- **The iPhone tags are static**, in `index.html`: metas cost no request.
  The status bar is `black`, not `black-translucent` -- translucent slides the
  game under the clock and the notch, and nothing yet keeps the controls clear
  of those.
- **The tab icon is an inline SVG data URL**, so the page never asks a server
  for `/favicon.ico` -- which a browser does on its own, and which on a host
  without one is a 404 in the console.

The fullscreen button hides where `document.fullscreenEnabled` is false: an
iPhone's Safari has no element fullscreen, and the button did nothing there,
silently.

**Checked by `tools/smoke.mjs`'s `home-screen` and `home-screen-private`
journeys**, the only ones that serve the game rather than open it from disk.
The private one runs behind a local server that behaves like Netlify's
password protection -- 401 to anything without the login -- logs in first, and
fails on any 401 at all. Both ask Chrome's own manifest parser and install
check (through the DevTools protocol), decode every icon, and play. Built
against the version before this fix, the private journey goes red, and a
direct probe showed the manifest and the icon both refused with 401 while the
page loaded fine -- the owner's symptom exactly. Every other journey opens the file from disk and fails on any request,
which is what proves the portable file never grew a manifest. What no test can
reach is Safari on an iPhone -- the home-screen behaviour itself is checked on
the phone.

## `T` is three.js, and a local `T` breaks its whole function

Seventeen modules import the library as `import * as T from 'three'`. In any
of them, **a local binding named `T` shadows the library for the entire
function it sits in**, not just from its own line down -- `const` and `let` are
scoped to the block. Every earlier `new T.Vector3()` in that function then
reaches an uninitialised variable and throws a `ReferenceError` on every call.

**What it looked like.** `GolfView.projectMarker` named the edges of a
rectangle `L`, `R`, `T` and `B`. From 19 September it threw on every frame the
ball sat on a green -- 393 exceptions in six seconds of putting, measured -- and
nobody noticed for six days, because the frame loop requests the next frame
before it does anything else, so the game kept running and simply skipped the
rest of each frame. The putting distance marker that function exists for never
positioned itself once: on every green there was **no distance on screen at
all**. The aim label, which is meant to hide on the green, was never hidden,
because hiding it was the line after the throw.

`node --check` parses it; the bundler emits it; no unit test called that
function. It was found by `tools/smoke.mjs` dropping a ball beside the pin.

**`tests/three-namespace.test.mjs` now refuses any binding named `T` in a
module that imports three as `T`**, and calls `projectMarker` directly. If you
need a name for the top of something, it is `top`.

## Escape closes what is in front; an arrow tap is owed to the next frame

**Escape's order is: shot list, menu dropdown, clock, leave notice, OPEN PANEL,
tool windows, then tour and drop.** An open panel is always in front of every
tool window -- `openTool` closes the panel when a tool opens, never the reverse
-- so a tool window can only ever sit behind a panel's blur. Escape used to
take the tool windows first: with Tools open behind the scorecard, the first
press shut the window the player could not see, and the scorecard in front of
them needed a second. The tool window is left open for when the panel is gone.

**A key pressed and released between two frames still counts, once.** Aim and
power move while an arrow is held, read once per frame from `keys`. A tap that
never overlapped a frame used to do nothing -- impossible to notice at 60 fps,
where a human tap spans several frames, and real on a machine managing 20,
where Help's "← / → fine tune" could simply not happen. Every key-down also
lands in `tapped`, which the frame loop treats as held for exactly one frame
and clears once per RENDERED frame -- after the frame cap, and whether or not
the aim block ran, so a tap made behind an open panel is dropped rather than
saved up and fired later. Holding is unchanged.

Both were found by `tools/smoke.mjs` and both are checked there: its Endless
journey taps with no frame between key-down and key-up, and its Surprise-me
journey presses Escape once with Tools open behind the scorecard. Each check
fails on the build before the fix.

## The simulator never invents ball data

Ball speed, launch angle, spin rate and spin axis are **inputs**. They come from a launch monitor, or from the Swing Meter, which is how a golfer without one makes them -- a stand-in for a swing, not a model of a golfer.

So nothing in here may alter an input **out of sight** to change an outcome. No strike-quality model, no shot dispersion, no "amateurs spin it less" curve. A thinned wedge already arrives as 4,000 rpm instead of 9,000 because that is what the monitor measured; manufacturing the same effect internally would count it twice, and would be flatly wrong the moment real monitor data is attached.

**The one thing applied on top is the round's lie rule (the owner's decision, 14 October 2026).** From semi-rough, rough or sand a launch monitor's measured BALL SPEED is multiplied by the same share a Swing Meter shot loses there -- 96%, 90%, 80% (`LIE_SPEED`, `monitorLie` in swing-meter.js) -- so a monitor golfer and a meter golfer in the same rough lose the same distance. Launch, direction, spin and axis are never touched. The measured number is kept beside the played one (`shot.lie.before`, `measured: true`), and it is the one shown and recorded: the ball speed tile reads what the monitor sent, with the penalty beside it in red (shot-data.js `liePenaltyNote`), and *Fastest ball speed* counts the measured speed. Format & tees can switch it off for the round (`round.monitorLie`); then a monitor ball flies exactly as measured from every lie, as it did before. **What changed in the rule, and what did not:** it used to say nothing may alter an input at all. The reason behind it -- never count a mishit twice, never hide a manufactured effect -- still holds, and a lie penalty is neither. It is a rule of the round, like a penalty stroke, stated in the interface before the shot ("Rough · −10% ball speed") and shown beside the number after it. Anything that is not a stated, visible round rule is still ruled out.

This rules out a whole family of plausible-sounding features, and the reasoning is worth keeping because they keep suggesting themselves. Twice now analysis has stalled on "we need a model of how well the ball was struck" — once for range dispersion, once for why a tour wedge sucks back and an amateur's does not. Both were the wrong question. The right one is always: **given these measured numbers, is the outcome correct?**

Anything downstream of impact is fair game: how the ball flies, how it bounces, how it rolls. Anything that would reach back and change what arrived is not -- unless it is the stated lie rule above, shown beside what arrived.

**The range never touches the round.** `finishShot` branches to the range path *before* `round.takeShot`, so no stroke is recorded, no hole can complete and nothing advances. The ball goes back to the mat (or to its chip or putt spot, or stays where it stopped while a putt is played out: `rangeAfterShot`), the tracer joins the session's shot history and the readout updates. `setUpRangeTurn` is deliberately not `setUpTurn`'s body: that one picks a club from the distance to the pin and aims at the fairway, which on a range means moving the green silently swaps your club. On the mats the range keeps the club you chose and aims at the green; a chip or putt station picks by distance. **`setUpTurn` hands every range turn to `setUpRangeTurn`** (outside a range challenge, which sets its own), so `loadCourse` -- after a regrow, say -- lands on the station, not on a hole's tee logic.

**The range box opens itself, and has its own button.** `Range controls` is an ordinary tool window — draggable, and it remembers where it was put — but `enterRange` opens it rather than waiting for the player to find it, and leaving the range or entering the lab closes it. Closed, it comes back from `#rangeControls` on the view bar (shown only on the range, lit by `syncTools` while open) as well as from the Tools tray: the tray's button alone was a menu away and the owner reported, twice, that there was no way back. `renderRangePanel` builds and wires everything in it each time it renders (`renderRangeBox` re-renders an open one in place), so there is no startup binding to keep in step.

**The Swing Meter replaced the shot-shape sliders and the ball-flight profile (14 October 2026).** Until then `Shot shape` held a one-shot spin axis, launch adjustment and spin adjustment in rpm, and under them a ball-flight profile (speed, launch, spin and axis biases with high/low/draw/fade presets) that stayed with the player across clubs and rounds; the power slider set a share of the club's speed. All of it went. The owner asked for a game's three-tap meter, with the shape chosen as a curve, a height and a spin dial before the swing. The panel id `shot` is now the Swing Meter's window: the difficulty of whoever is up (kept in their profile, `meter.difficulty`, absent reads as Normal), and what shape, spin and the lie do. **The flight profile is gone from saves too**: SCHEMA_VERSION 10's migration drops it, and `applyPlaySettings` deletes a copy already in memory. Rejected: keeping the profile as a hidden multiplier on the meter -- it would have been a second, invisible way to move every carry off the bag, which is exactly what the bag replaced.

**Short shots: a run-up from the far left, and a zoomed, slower bar** (the owner's call, 14 October 2026). `riseAt` starts the marker at `MISS_AT` (the bar's left edge) and reaches the strike line after `RUN_UP` rises; `tap` ignores a second tap made before the strike line. For a full shot `swingContext` picks `zoom` with `swingZoom` (half or quarter of the club's full carry when the circle fits with a quarter to spare), and every bar number follows it: the ticks (`fullCarry * zoom`), the hatch, the target (`targetShare / zoom`), the carry (`swingLaunch` multiplies the bar share by `zoom`) and the chip-widening of the strike zone, which reads the share of the CLUB (`strikeZone`'s `share`), not of the bar. `startSwing`'s `zoom` slows a zoomed bar; a putt passes its zoom as `puttRange` over the putter's full roll.

**XP is a ledger, not a running count** (Phase 4, 14 October 2026; progression.js). Every award is kept in the golfer's profile under a key that says what earned it -- `<round>:h<hole>` for a hole, `<round>:h<hole>:s<stroke>:number|shot` for a shot, `<round>:round` and `<round>:win` for a round -- so `award` can be called again with the same key and only the difference moves `xp`. The hole's XP is worked out in `syncProfile` from the card on every save, exactly as the history is, so a mulligan that un-holes a putt takes it back; a shot's XP is awarded in `recordProfileShot` under its stroke, and the mulligan handler calls `takeBack` from the restored stroke on. **Never add XP by adding to `xp`** except the two awards with no key (the daily bonus, `xpDaily`; the range trickle, `xpRange`), which nothing can take back. The multiplier is the golfer's difficulty for the way they struck their last shot on the hole (`shotInputs`), 1 off a monitor. The level is `levelOf(xp)`, never stored. The ledger keeps the newest 400 entries. The level-up banner (`#levelUp`) waits for the hole-out banner to clear.

**Rewards are one table** (Phase 5, 14 October 2026; rewards.js). `REWARDS` lists every unlock as level, kind, id and name -- badges, tracers, ball finishes, flourishes, titles, meter skins, challenges -- and nothing else says what a level gives: the level-up banner (`unlocksBetween(from, to)`, every level a gain crossed, a badge's own frame left out; in rewards.js with a test since 15 October 2026, it was a loop in main.js), the look picker on My profile and what is worn all read it. Wearable now: ball, tracer, title (`WEARABLE`). A golfer's choice is `profile.worn` ({ball, tracer, title}), kept by id whether or not it is earned; **what shows is always `wornItem(worn, kind, level)`**, which falls back to the starting look when the level is too low -- a mulligan can take back the XP that earned it. `setProfileWorn` refuses what is not earned. Absent `worn` reads as the starting look, so no profile migration. tests/rewards.test.mjs holds the table to the spec's counts and every tracer and finish to a look. **Since 15 October 2026 every reward is also checked one by one** (the owner cannot reach most of them without weeks of play): shut a level early and open at its level, worn only from its level, achievement titles only with their achievement, the banner's list for every level 2-50 -- and **an AGREED list pins each reward's level**, because the other checks read levels from the table and so cannot see a reward given the wrong one. Moving a reward means editing that list on purpose. tests/profile.test.mjs checks the save refuses every wearable item a level early. The `level-up` smoke journey plays the one real path: a golfer 5 XP short of level 2 sees Sky padlocked and cannot put it on, finishes a hole, reads "Level 2 / New tracer: Sky" on the banner, and then puts it on.

**One picture, one source** (ball-finishes.js). A finish is a rule: colour at a direction from the ball's centre. `finishTexels` fills the ball's 256x128 texture from it in three.js's sphere layout; `ballPixels` draws the face-on picture from the same rule (the profile picture, cached per finish and size as a data URL by `ballPicture` in main.js; the turning close-up in the hole-out banner, redrawn each frame at 72 px while the banner is up). Patterns that need noise sample 3D value noise on the unit sphere, so there is no seam or pole pinch. A test compares a texel with the rule. Cartoon style is MeshToon, so roughness does nothing on the course; it only shapes the picture's highlight (Chrome and Gold paint their shine into the colours).

**A LOOK IS NEVER A NEW SHADER.** A program built on first draw is a frozen frame (B7). So: the ball ALWAYS has a texture map (Classic white included), and a finish is a texel rewrite (`setBallFinish`); every tracer line -- the live line, its comet head and bright core, and the end-of-hole lines -- is one LineMaterial with `vertexColors` and `dashed` on (`tracerMaterial`; solid is a 1,000 km dash), so a style is uniforms and buffers only; the glints are a Points pool registered as a stand-in (one black point far below the ground until used). no-late-shaders now also hits the first shot and requires no shader during its flight. **Vertex colours are linear**: the style's sRGB hex goes through `linear()` in renderer.js -- without it every tracer drew washed out (a sunset as pale pink, the seat gold as cream). The night tint still lerps the materials' colour toward the ball's glow. Live style per turn: `updateHUD` calls `view.setTracer(id, seat tracer colour)` and `view.setBallFinish(id)` for the golfer who is up; `pushTrail` records each trail's style so the summary draws it (`summaryStyle`: its colours, dash and zigzag, nothing moving). **No seat colour on a tracer anywhere** (the owner, 15 October 2026, reversing spec 7.4): the styles that used to borrow it have colours of their own, Classic the original amber. Not yet checked by eye (owner's machine was in use): Lightning, Ribbon, Fire, Starfall, Rainbow in flight; the summary lines; the level-up list; titles on the scorecard; the phone layouts with the look picker.

**Achievements count once, through the ledger** (Phase 7, 14 October 2026; achievements.js). The rules are pure: `holeAchievements` (a hole's score), `roundAchievements` (a finished round's card, the golfer's index, whether the floodlights were on, the landscape) and `countedAchievements` (counters and progress against their goals). main.js gathers them in `syncProfile` -- the hole's every time the card moves, the round's once (`markOnce(progress, '<round>:done')`, because syncProfile runs on every save) -- and in `recordProfileShot` for On the Dot, then `payAchievements`: `earn` marks new ones on `profile.achievements` and `award(prof, 'ach:<id>', xp)` pays them. **Sand saves** need the hole's sand strokes: `tallyShot` records `card[hole].sand` (stroke numbers from the lie 'sand'), and `sandSave` is the hole finished within one stroke of the last one -- counted once per hole by `markOnce`. **On the number** is counted when its XP is paid on a course (not on the range, which pays a capped trickle). `progress` = {rounds, biomes, weeks, once}; `counters.sandSaves` and `counters.onNumber` are ordinary counters (on My profile). A title from an achievement is `ach-<id>` (rewards.js `ACHIEVEMENT_TITLES`); `isUnlocked`/`wornItem` take the golfer's achievements for those. Absent fields read as nothing earned, so no profile migration.

**The course of the week is the date and the generator, and stroke play only** (weekly.js; stroke only since 15 October 2026 -- `formatFields({strokeOnly: true})` and the group forced to stroke, since its bests are strokes for the eighteen). Seed `WEEK-<year>-<ww>` from the ISO week in local time, landscape `BIOME_KEYS[weekIndex % 9]` (weeks since Monday 1 January 2024), eighteen holes at `DEFAULT_COURSE`. Bests are kept under `weekKey` = seed @ g`GENERATOR_VERSION`, because a generator bump grows a different course from the same seed -- so **a GENERATOR_VERSION bump starts every week's records afresh**, by design. The round carries `round.weekly` (validated in `Round`, kept through saves); `weeklyRoundDone` runs once when it is finished: the golfer's gross to `profile.weekly` (`recordWeekly`), 150 XP once per week key, 50 for beating the week's best, and the week index to `progress.weeks` for Streak. **Changing `DEFAULT_COURSE`, `BIOME_KEYS`' order or the seed format changes every copy's course of the week** -- treat them as part of it.

**The challenge of the week is the date and `WEEKLY_POOLS`** (16 October 2026; weekly.js `weeklyChallenge`, main.js *THE CHALLENGE OF THE WEEK*). Weeks are `weekIndex`; a pool covers the weeks from its `from` and runs in cycles as long as itself; each cycle is the pool shuffled by `seeded('CHALLENGE-WEEK-<from>-<cycle>')`, and week n of the cycle plays its n-th. **A shipped pool row is never edited**: adding a challenge would move every week's pick on the copies that know it and not on the others, so a new pool is appended with `from` a future week (tests/challenge-week.test.mjs pins this week's and next week's picks, and checks a later pool leaves every earlier week alone). Hole rule `spots` challenges (water, greenside sand, short side) stay out of the pool, because Island courses have no inland water; a course of the week that still cannot host the pick plays the first of `next` (the rest of the cycle) that it can, and says so. Course ones play on `weeklySettings()` with spots seeded `<week seed>:<hole>:<id>`; range ones on the range. The play carries `challenge.week = {key, index}`; at the end `recordChallengeWeek` keeps the week's best and medal under `challengeWeekKey` -- `CHAL-<yyyy>-<ww>:<id>@g<generator>`, the generator left out for range ones (the range does not change with it) -- in `profile.challengeWeek` (60 kept), and pays the week's own XP into the same one ledger entry as the play. The week's play does NOT write the challenge's own record (a different course), but its medal does count. `progress.chalWeeks` holds the weeks played, for Weekly Regular.

**Rounds with a goal are real rounds** (16 October 2026; round-goals.js, main.js *ROUNDS WITH A GOAL*). Sudden death is `startEndless` with `goal: 'suddendeath'`, Bogey-free nine `startRoundOn` on the Challenge Course's nine with `goal: 'bogeyfree'`; `challenge` stays null, so they save, resume, go in the history, count for the handicap and pay round XP as any round. `Round` validates and keeps `goal` (`goalProblem`: Sudden death only on an endless stroke run, Bogey-free nine only nine holes of stroke play). The goal never changes play; `syncProfile` hands each golfer to `roundGoalDone` once their goal is decided (`goalStatus`), paid once a round (`markOnce` `<uid>:goal`, ledger `<uid>:goal`), and `checkGoalOver` opens the results card once everyone's is, once a round a session. **A sudden-death run is not finished when everyone is out** -- an endless run never is; it can go on and nothing more counts. A mulligan that takes back the bogey after the goal was paid does not take the medal back (paid once). tests/round-matrix.test.mjs plays both goals with every group and putting mode, checking the goal after every hole and through saves.

**A practice challenge is not a round** (Phase 7, 14 October 2026; a table of 36 since 16 October 2026 -- challenges.js the table, challenge-play.js the rules, challenge-spots.js where balls go, main.js *THE CHALLENGES IN PLAY*). A challenge sets the global `challenge`; while it is set, `save()` writes nothing (no Continue slot, no history), `syncProfile` and `recordProfileShot` return at once, `roundWorthSaving` is false, mulligans are refused, and `finishShot` hands the ball to `challengeShot` straight after drawing it -- **`round.takeShot` is never called**, so the round never moves. **Set-up is one shared function**: challenge-spots.js `planChallenge` (which hole, its spots or the spots across holes, the range targets, the seed for the calls) and `playContext` (each golfer's driver, hand, zone and the club asked of them) -- main.js `startChallenge`/`beginChallenge` call them, and so does tests/challenge-virtual.test.mjs, so the play-through test plays exactly what a player gets; never set a challenge up any other way. **The club a challenge asks for is settled per golfer at the start** (`challengeClub`): its own kind if the bag holds one, else the nearest in carry -- the stock bag has no 8-iron, and before this One club could not be scored with it (the Node play-through found it, 16 October 2026); `challengeClub` in main.js and `scoreBall` both read `ctx[seat].club`. **A challenge across holes** (Every par 3, Greens in regulation, Scrambler, Putting tour, Bingo Bango Bongo; hole rule `course`, `spotsAcross`) carries `hole` on every spot, `pins` and `lengths` by hole; `placeForTurn` changes `round.hole` and reloads when the turn's hole is not this one (saving stands aside: `challenge` is set). **Knockouts and Bingo Bango Bongo** are orders of their own in challenge-play.js (`knockoutBall`, `holesBall`), for two to four (`who: 'group'`, refused alone in `newPlay` and on the screen); Bingo Bango Bongo keeps every golfer's ball in the engine (`st.pos`) and `placeForTurn` puts them all down. **main.js only places balls**: `challengeShot` builds `ballFacts` from the flight and hands them to `playBall`, which says what the ball scored, whether the same golfer plays on (and from where) and whether the play is over; `placeForTurn` then puts the next ball on its spot, back on the tee or the mat, or where the last stopped, and sets `challenge.aimAt` (the range target, the zone or the called carry), which `defaultAim` and `challengeClub` (from `setUpTurn`) start the turn on. **Hole challenges play on ONE FIXED COURSE**, the Challenge Course (`challengeCourseSettings`, seed `CHALLENGE-1`, the owner's call of 16 October 2026): `startChallenge` grows it through `startRoundOn`, picks the hole with `chooseHole` (a rule, then the first hole whose spots fit), sets `round.hole` and reloads. tests/challenge-spots.test.mjs proves the course hosts every challenge; **if a generator change breaks that, move the seed on (`CHALLENGE-2`) and write it down -- never loosen the test**. Records and medals are kept across such a change. **Range challenges** go through `enterRange({players, challenge: true})`, which opens no range tools for them, and then set `challenge` -- **with `challengeStarting` held around both**, because entering the range saves the round slot (it keeps the course to go back to); without it a range challenge wrote the slot, which the smoke journey caught on 16 October 2026; `finishShot` reaches `challengeShot` before the range's own recording, so range shots and range XP stand aside by themselves. Starting a challenge while on the range leaves it first (`rangeMode=false; restoreCourse()`), or a course challenge would play in range mode. **Putting is hole out while a challenge lasts** (`rememberPutting`, then `round.putting.mode = 'holeout'`); the golfer's own setting comes back with the next round through `restorePutting`. **Every path that replaces `round` clears `challenge`** (`challenge=null;round=...`) -- a new one must too, or the next round plays as a challenge with no saves. **The pay is one ledger entry per golfer per play** (`chal:<play>:<seat>`), worked out by progression.js `challengePay` at the end, never per ball: a 10-ball challenge paying per ball would push 10 entries into the 400-entry ledger each time and could push out the round entries a mulligan still needs. **Old records become medals once**: `settleMedals` runs `medalsFromRecords` the first time a profile is seen with no `medals` (before its first pay, on the Challenges screen and on My profile), and an empty `medals` is kept on purpose to say it has run. Skins was a challenge (a stroke round labelled `round.challenge === 'skins'`) until 16 October 2026, when it became a round format (*Skins is a round format*, below); its record stays in `profile.challenges`. **All are open from the start** (the owner, 15 and 16 October 2026): the reward table holds one `challenge` row, `challenges`, at level 1, and no row carries a level. **Two more ways a round is replaced** -- every `round=new Round(...)` (the backdrop, a fresh round on the same course, the version notice) -- clear it too; and while a challenge's course grows, `startRoundOn(..., {quiet: true})` sets `challengeStarting`, which stops `save()` writing the course's hole-0 round into the Continue slot and the history before `challenge` is set. It is set inside the build, never before the leave-this-round guard: a guard answered "Stay" never builds, and a flag set earlier would have stopped all saving for the session. **`startChallenge` holds it again while it moves to the challenge's hole** (`loadCourse` saves, and `challenge` is set only once the hole is loaded, because the play needs the hole's pin): without it the Challenge Course's round landed in the Continue slot, which the smoke journey caught on 16 October 2026. `syncProfile` stands aside for it too. The challenge bar sits beside the shot controls, not at the top centre, where the game's messages come up. `lab.state().challenge` shows the play read-only for the harness. The smoke journey `challenge` walks the five tabs, plays closest to the pin to its results card, checks nothing reached the round slot or the history, and starts a putting, a range and a long-drive challenge.

**Skins is a round format** (the owner, 16 October 2026; skins.js for the rule, game.js for the mode, main.js *SKINS*). `round.mode === 'skins'`, two to four golfers (refused below two in `Round` and in `setPlayers`), played and ordered exactly like stroke play -- each golfer holes out, honours to the lowest -- and allowed in an endless run, not in the course of the week. **Skins are worked out from the card every time, never stored**: `skins(cards, decidedHoles(round))` gives each decided hole's winner and value, the skins each seat has won, the carry and what the next hole is worth. A hole is contested among the golfers with a score on it, so a golfer who joins mid-round plays for skins from that hole (the challenge version stopped counting at the first hole anyone had no score on, freezing every skin after a golfer joined). Any tie for lowest carries ("one tie, all tie"); skins carried past the last hole go unclaimed. Scores compare to two decimals (decimal putting). Where it shows: the Format choice and its note (`FORMAT_NOTES.skins`), each top-bar chip's skins (`drawScoreChips`), the course subtitle when skins have carried to the hole (`updateHUD`), a line under the last golfer's hole-out banner (`skinsBannerLine`), the scorecard's top line (`skinsStatus`), its Skins row and the CSV. **XP: 30 a skin (`XP.skin`), one ledger key a hole** (`<round>:skin:h<n>`), re-worked for every hole up to the one being played on each save (`skinsXp`), so a mulligan that undoes the winning putt takes the skins back and a hole decided by a golfer with no profile is still paid; `<round>:win` (50) to the most skins alone (`wonRound` -> `skinsWinner`); the record `challenges.skins` once at the finish (`skinsRoundDone`). **A round the old challenge already paid at its finish** (ledger key `<round>:skins`) is not paid again per hole. **Old saves:** `Round.restore` runs `upgradeSave`, which turns `mode: 'stroke', challenge: 'skins'` into `mode: 'skins'` and drops `challenge` -- every way a round comes back (Continue, Saved rounds, an imported file, each mulligan snapshot) goes through it; round-library's summary lists such a round as skins. No SCHEMA_VERSION (no settings object changed), no GENERATOR_VERSION, no PROFILE_VERSION (the record kept its place). A skins save does not load in 0.8 or earlier, whose `Round` refuses the mode. Rejected: a sudden-death playoff for a tied last hole, net skins with handicap strokes, rising hole values, picking up once beaten (RESEARCH.md *Skins as a format*).

**The golfer's circle and the turn flash** (15 October 2026). The top-bar chip's circle is `golferMark`: the framed ball picture, the level over it, and the seat colour as a dot on its edge (the seat colour still ties the chip to the scorecard row); a golfer with no profile keeps the coloured initial. `flashTurn`, called at the end of `setUpTurn`, shows the same in the middle of the screen for 1.9 s: in a group when the golfer up changes or a hole begins (key: round, hole, seat -- the same golfer playing on is not a new turn), alone only at a hole's start; never on the range, behind the menu, at a team pick or a relief choice; it waits for the loading screen to go, **and for the hole-out and level-up banners** -- when one golfer holes out and the turn passes, the flash used to land on top of their banner (smoke, 15 October 2026). No backdrop blur on it, since it can come up while the camera moves.

**The owner's round of 15 October 2026 (looks, pin, cameras, cup).** *Frames break out:* an animated frame's picture sits in a `.frame-fx` wrapper (`framedPicture`) whose ::before (behind, z -1 under `isolation`) and ::after layers burn, sparkle, ripple or drift beyond the ring; static frames stay a plain img. *Flourishes, simple to grand:* `flourishFor` -- ace (lantern, level 1, `SECRET_FLOURISHES`: off the tab until `achievements.ace`), chip-in for par or better (20), eagle (12), every birdie fireworks (30) over birdie confetti (5), par sparkles (2); level 50 is `goldFlourishes`, a palette passed to `playFlourish(..., {gold})`, never a flourish of its own. *The attended pin:* `setPinOut` no longer hides the stick on the green; a shot struck with the pin out in the physics (`lastShot.pinOut`: on the green or the putter in hand) lifts it (`liftFlag`) once the drawn ball is within `PIN_ATTEND_M` (3 m) of the cup, and `setUpTurn` lowers it again unless the hole is over -- **the physics are unchanged: a putt was and is played with the pin out**. *Cameras:* `makeCameraFlight(..., {throughTrees})` skips the canopy (ground still cleared) for the shot review out (`tvReview`) and the flight back from it (`flyCamera` with `from`); an aimed putt off the bay uses `puttAimPose` (`PUTT_RIG`: 6.5 m back, 2.2 m up, looking 2.5 m past the cup, never under the ground behind); the rolling putt's look (`followPose`) is halfway between ball and cup, sliding to a quarter and then to the ball whenever the ball would be more than `PUTT_BALL_ANGLE` (18 degrees) off it -- the old "cup stays still" rule lost the ball past the hole, and its tests were rewritten. *The cup:* `cupHits` / `CUP_RATTLE` -- each knock softer and sooner than the last, then a skitter; tests/sound.test.mjs holds the order.

**Every level from 2 to 50 brings something** (15 October 2026): five levels were left empty when the flourish ladder moved, and were filled with a reward each (Smoke tracer 14, Grinder title 22, Sunset meter skin 27, Lightning frame 36, Lava ball 43); tests/rewards.test.mjs fails if any level goes empty again, and if an animated frame lacks either of its two style.css rules (the ring, `[data-anim=…]`, and the effect outside it, `[data-fx=…]`) -- without them it shows as a still ring and nothing says so.

**Frames are their own reward** (15 October 2026; until then a frame was a badge's). The table has kind `frame`: each badge's frame at its level (same id), nine plain colours at level 1 (`plain-*`), fourteen animated at higher levels. `FRAMES` holds each one's look: two metal stops, or `solid`, or `anim` (spin, flames, sparkle, water, leaves, lightning) with three colours that `frameAttr` hands to style.css as `--f1..--f3` and `data-anim`; the movement is a registered `--frame-turn` angle and a flicker or twinkle filter, still for reduced motion. The level-up banner leaves out a badge's own frame (it would repeat the badge). Plain colours from the start too: eight solid balls (`solid-*` in ball-finishes.js) and eight plain tracers. **Locked items are not greyed** -- full colour, a padlock (`LOCK`) and the level. The tracer tab draws each style as a small SVG flight (`tracerPreview`: its colours, head, core, dash, zigzag, glints, moving); the **Flourishes** tab lists each with `FLOURISH_WHEN` and plays it on its own canvas through `playFlourish`.

**Frames, meter skins and flourishes** (Phase 6, 14 October 2026; rewards.js, flourishes.js). A frame is a BADGE worn (`REWARD_KIND.frame = 'badge'`); an empty choice means the newest badge earned (`wornItem` -> `highestBadge`). `framedPicture` draws it as the picture's own padding over a conic gradient of the badge's two stops (`FRAMES`); Fairway Master's turns by a CSS `@property` angle. The level chip (`levelBadge`) is filled with the highest badge's gradient and ink. **Meter skins are data, not stylesheets**: `METER_SKINS` holds each skin's colours, `applyMeterSkin` sets them on #swingMeter as `--sm-*` custom properties for the golfer up (from `updateHUD`), and the stylesheet reads them with Classic as the fallback -- so a skin can never move a zone. The overswing border and a target out of range keep their own colours (`.sm-target:not(.out)`). **tests/rewards.test.mjs holds every skin legible**: the zone composited over the track's `base`, the perfect band and the target, separated by luminance contrast (zone vs track and band vs zone at least 1.5, target vs track at least 3) in normal vision and simulated deuteranopia and protanopia -- a new skin that fails is refused, not eyeballed. **Flourishes are 2D, on purpose**: a canvas overlay (#flourish) drawn for a few seconds, anchored each frame at `view.screenPoint(course.pin)` -- a projection, nothing drawn in the scene -- with **every particle drawn relative to it** (spawned about zero, shifted to the cup each frame), so a burst follows the cup as the camera pulls back; launched at the cup's first screen place and left there, a burst that began with the cup off screen flew out of view and drew nothing (smoke, 15 October 2026, once in eight runs) -- so they build no shader and cost no 3D frame time. `flourishFor` picks the rarest earned for the hole (ace, chip-in, eagle, birdie, par save, any hole-out); chip-in is passed from `finishShot` (holed from off the green, not the tee shot); a par save reads the hole's `gir` from the golfer's card. Reduced motion skips them; one plays at a time. **The overlay has no z-index and follows the course canvas in the page**, so every panel and banner draws over it; with a z-index it drew bursts over the shot controls. The smoke journey `look` holes out at level 50 and checks pixels were drawn.

**The XP popup reports what `award` paid** (14 October 2026). `award` returns the change it made, and `syncProfile` / `recordProfileShot` turn each positive change into labelled lines (`holeXpParts`, `shotXpParts` in progression.js -- the same parts the totals are summed from, so the words and the numbers cannot disagree) and hand them to `queueXpGain` with the XP before. Gains for the same golfer that arrive before the popup shows merge; popups queue. The bar animates from `levelOf(before)` to `levelOf(after)`, running over once per level crossed. Lines are shown before the multiplier, with the multiplier as its own line; the total is what was paid. **One sound at a time** (the owner, same day): the popup waits `XP_AFTER_STING` (1.6 s) after the hole-out banner appears, past the longest chiptune sting (about 1.05 s) -- it waited for the whole banner until the owner found the screen still for too long; the fill starts `XP_FILL_AT` after the gain; on a level-up the bar holds at the top for `XP_LEVEL_AT`, the level-up sound plays alone for `XP_LEVEL_HOLD`, and only then does the next fill start; the big level-up banner waits for the popup and its queue to clear. The report's demo (tools/sound-lab/xp.html) copies the same constants -- keep them in step. Sounds: `gameAudio.xpSound` (gain, fill, levelUp), the owner's picks since 14 October 2026 (`XP_FINAL` in sound.js), held to them by tests/sound.test.mjs. **The hole-out stings are chiptune** (signed off 14 October 2026): `gameAudio.score` plays a score's chiptune sting (`chipSting`) from `CHIP_FINAL` -- take D, the game jingles, for every score, with the owner's sliders -- and falls back to the marimba `score` only for a score missing from it, which tests/sound.test.mjs forbids. The marimba stings and the other three chip takes stay in sound.js for the stings report's comparison; they are not played.

**Overswing crawls and holds** (the owner's call, 14 October 2026): past the full line `riseAt` runs at `1/OVERSWING_SLOW` of the speed and stops at `1 + OVERSWING`, and nothing sets the power but the second tap -- `advance` no longer does it at the end. `inOverswing` drives the meter's flashing (`.over`, a steady glow under reduced motion) and the overswing sound. **The colours were swapped the same day**: the strike zone is yellow (an OK strike) and the perfect band green.

**The Swing Meter's sounds play only on the Swing Meter** (signed off 14 October 2026, `METER_FINAL` in sound.js): `gameAudio.meterStart` with the first tap, `meterMove` every frame of the swing, `meterStop` on release or cancel, and `meterSound` for the second tap, entering overswing (once a swing) and the strike -- perfect, zone, miss or duff. A putt is two taps and plays no strike sound. They live in the effects volume.

**A Swing Meter tap is judged on its own time, never on a frame.** `startSwing` / `tap` / `advance` take times on the input's clock (`event.timeStamp`, or `performance.now()` when a pad is read), and `markerAt` is a function of the time since the first tap. The frame loop only DRAWS the marker and lets the clock finish a swing nobody tapped (overswing runs out; the marker runs past the strike zone). So a slow frame, a stall or a hidden tab cannot move a result, and the tests prove the same three times give the same shot at 20, 60 and 144 frames a second. **Do not move judging into the frame loop**: a tap read on the next frame is late by up to a frame, more on a slow machine, and the miss would be the machine's, not the golfer's. A swing is cancelled -- no stroke -- when the page is hidden, on Escape before the distance is set, and when a turn is set up under it.

**A harness tap that has to land is stamped with its moment, never timed by a frame.** The same rule, from outside. `tools/smoke.mjs`'s `tapOnTarget` used to watch the marker frame by frame and tap once it had passed the target: right on a GPU, and up to a bar-length late with no GPU, where a frame lasts most of a second and a putt's marker crosses the bar in about 1.6 s. Every putt ran long and GitHub's smoke step failed "six putts from two yards" on both 0.8 merges. It now reads the swing's start and pace from `lab.state().swing` (a look), works out when the marker reaches the target, and sends a DevTools mouse press carrying that time as its `timestamp`, which Chromium makes the event's own `timeStamp`. Likewise **holed or not is asked of the game** (`lab.state().holeComplete`, set in the same step that ends the flight), never inferred from whether the scorecard turned up within a fixed wait: with no GPU it takes longer, and the 0.6 and 0.6.1 merges failed by putting again on a hole already holed. Any new journey that needs a swing to go where it is aimed uses `tapOnTarget`; three taps at fixed gaps only prove a shot happens.

**Mid-swing, the whole screen is the tap target** (`#swingCatcher`, a transparent layer over `#world`, shown only while a swing is in progress). Before the first tap only the Swing button and the bar start one, so tapping the course still aims. On a phone a thumb cannot miss; on a desktop a click anywhere counts. It sits under the toast and over everything else. The spec had "the lower third of the screen is the tap target"; the whole screen during the swing does that job better and leaves the aim pad and map alone before it.

**The bar is in yards, and the putting bar zooms.** The full line is the club's carry with the chosen curve, height and spin at its full speed, solved against the ball model on level ground in still air; half the bar is half that carry (`speedForCarry`, bisected, cached per quarter yard). A full clean swing with the club's own shape is the bag's carry. A putt's bar is roll on a flat green at today's Stimp, and its full line is a quarter, a half or all of the putter's roll -- whichever first holds the putt the circle asks for with a quarter to spare (`puttRange`). That zoom was added in building, not in the spec: spread over the whole roll, a nine-foot putt was a tenth of the bar and a tenth of a second to stop in.

**With no spin added, nothing spins back.** The owner's rule. The club's own spin at each height is set below the come-back point by sweeping (RESEARCH.md *The Swing Meter*), not by eye, and `tests/swing-meter.test.mjs` sweeps the corner where one was ever found. Raising `HEIGHT_SPIN`, `KIND_SPIN` or a club kind's stock spin can break it. With spin added, whatever the physics does is the golfer's choice. A ball landing into a slope steeper than about 2% can roll back by gravity whatever its spin; that is the course, not the strike, and is not what the rule guards.

**The target marker is the ball model's answer, worked out at most ten times a second.** `targetShare` (swing-meter.js) turns the circle's distance into the carry it plays like through `playsLike` -- the same two flights as the PLAYS label -- with the wind passed only when the golfer's difficulty allows it (Easy; the owner's call), then reads the bar share off the ball model, making up the lie's lost speed. A putt's marker is the circle's length on a flat green (since 14 October 2026; before, the length the roll preview was solved for). `drawTarget` keys on everything it depends on and, while the aim is moving, runs at most every 100 ms with a trailing run when it stops: a full shot's answer is two flights and a bisection. **Out of reach is the full line, never the overswing zone.** **The circle follows the club** (`followClub`) until the golfer places it: `rangePlaced` (a click, ↑ ↓, the pad, the distance box) keeps the distance; `aimTurned` (← →) keeps the line and takes the new club's carry along it; neither, and the club change re-runs `defaultAim`. Both reset with the turn and with A.

**On the Swing Meter the meter carries its own three numbers** (the owner's call, 14 October 2026). `meter-mode` on `#world` (`meterMode`: not armed, and the record on show is not a typed or lab shot) hides `#shotTiles`, the fold and the line's carry/total summary. The meter stays up through a Swing Meter flight (`meterFlight`; not a replay, not a typed shot) with `#smResult` -- carry, total and apex from the same `shotGrid` the tiles read, redrawn every frame by `drawLiveTiles` -- and keeps them after the ball stops for the golfer who hit it, on that hole, until their next swing starts; the row itself never hides on the Swing Meter -- a swing under way, another golfer or a new hole shows dashes -- because a row that vanished on the first tap made lining up the next shot jarring (the owner, 14 October 2026). Armed, the tiles are exactly as before. Shot data's hand set (`panelFields`) is kept and still editable, but it drives only the tiles, so on the Swing Meter it shows nowhere; the shot list and Shot information are unchanged.

**A putt is aimed at a length by the circle, for every golfer, and drawn as a straight line** (the owner's call, 14 October 2026). There is no putt preview any more, for any way of playing: `updateAim` draws `setAim` at 15 mm for the putter, and the break is read from the green's grid, flow and heat map. Until that day the line was the roll preview -- the break for the circle's length (`puttLineSpeed`), all of it on Easy and Normal, the first third on Hard (`pathShare`, a `putRead` per difficulty) -- and the lie readout carried a note saying how much of the read showed. All of that went. **The Swing Meter's putt target is the circle's length on a flat green**, so the marker does not read the slope either. **A putt is two taps on every difficulty** (`puttAccuracy` is false; Hard had a third). **The putting bar reaches across any green**: `PUTT_RANGES` runs from a quarter of the putter's roll to six times it -- the widest green is about 80 yd and the slowest Stimp (6) leaves the putter about 18 yd -- and `puttSpeedFor` allows up to three times the putter's speed. On the green, and only for a putt, the bar is not held to the bag.

**The bar keeps the swing that was struck** (`lastSwing`, `shownSwing`, `frozenAt`): the distance stop and the strike stay on the bar while that ball is moving (`shownSwing` needs a live, non-replay `flight`), and the bar is clean once it stops -- the owner first asked for them to stay after the shot, then for them to go once the ball stops (both 14 October 2026). The strike zone stays as that swing's (`zonesFor` at its power) until then.

**Shot data belongs in the Shot information panel, never the hole card.** The card carries “Range / N/A / Range” plus the live distance, and that is all it should ever carry — there is no round to report.

**`worldPin` and `worldGreen` are cached, not derived.** `routeHoles` computes them once at generation time and also replaces whatever `toWorld` the builder wrote with the real routed transform — for the range that is a translation of about −224 m in z, not the identity `buildRange` hands it. Anything that moves a green or a cup has to refresh both, because most of the scene reads the cached pair rather than `h.green`: the flagstick, the cup meshes, the green-reading mesh and the overview camera. `moveRangeGreen` does this; a test builds through `generateWorld` specifically so the transform is non-identity, since a bare `buildRange` hole would pass either way.

**Moving the green is cheap only while it is flat.** The ground shader reads the green's position, size and shape from the cup atlas, so the painted surface follows a few floats and a `needsUpdate` (`refreshRangeGreens`). The terrain does not: `generateWorld` shapes the ground to each range green with a slope at build time (`rangeGreensShape`). So a flat centre green slides, and a shaped one regrows (`shapes(centreSetup(settings))`, the key `rangeKey` carrying its distance only then). Do not copy the slide to a real hole without rebuilding the ground grid.

**The range forces the green-reading tools off on entry.** They are a putting aid, and on a flat green the slope grid paints everything "under 1%" blue and the heat map paints everything "lower ground" blue, so the green becomes a featureless blue disc that reads as a rendering fault. They can be turned on again over a range green with a slope (the short-game green is random contours by default). The lab wants them on. Anything else that builds a flat green should do the same.

## Aerodynamics are fitted; release is the open problem

`AERO` in `src/physics.js` holds the lift and drag constants, fitted 6 October against Trackman's PGA and LPGA tour averages, a GC3 session and the owner's R50 session (`node tools/flight-fit.mjs`, data private). Lift is a power law in the spin parameter S = wR/v, CL = liftK·S^liftP − liftC. **No club ever enters the calculation** — S comes from the ball's own speed and spin, both of which a launch monitor measures. Peak height's typical miss is 1.7–5.5% and carry's 1.5–2.5% per source. **Spin decay is part of it and it feeds the bounce**: `spinTau` is held at the published rate (21.5 s at 100 mph, faster at higher speed) because a slower decay delivers more spin to the green, and fitted freely it tripled a tour wedge's spin-back. **The bounce tests pin a 7 iron's arrival** (tests/firmness.test.mjs, `ARRIVAL`): any flight change moves it, the test comparing flown with delivered says so, and it is re-pinned by the method its comment gives — not by loosening the tolerance. **Lift must be zero at zero spin**: the fitted square root bottoms out at 0.07, so `liftTaper` fades it to nothing below S 0.04. Remove it and a knuckleball floats 50% further than a ball with no lift could (6 October, `tests/low-spin.test.mjs`); move it above 0.044 and it starts bending real low-spin drives, which the fit never saw.

`simulateShot` reports `descentAngle` alongside `landingSpeed`, both taken from the velocity at first touchdown. Do not re-derive either from `points`: the touchdown sample is recorded *after* the impulse is applied, so it gives the post-bounce state, and hunting local minima finds a later, smaller hop instead. This has caused five separate bad measurements in this project.

**What is still wrong:** release. Irons stop far too fast (7-iron 3.0 yd against a measured 13; a wedge finishes behind its pitch mark) while the driver runs slightly long. The error is ordered by spin, so the bounce over-responds to it. RESEARCH.md has the table and the reasoning, including a correction to an earlier hypothesis that had the error pointing the other way.

**Bounce work must use a controlled arrival.** `tests/firmness.test.mjs` delivers the ball at a pinned speed/descent/spin rather than flying it there, so a flight change cannot masquerade as a bounce regression. A companion test checks the pinned arrival has not gone stale against the flight; if it fails, re-pin it from the last airborne sample, never from the touchdown sample.


## The bounce, spin, and why a ball comes back

`SPIN_GAIN` in `contact.js` is **3/2**, not the rigid-sphere 5/2, and the `CONTACT` table in `physics.js` carries a per-surface `spin` column rising with the mowing height (green 1.5 to rough 2.5).

**This one number decides whether a golf ball can return.** A bounce removes slip at (1 + spinGain) times the rate it removes forward speed. At 5/2 that was enough to drive every full shot to ROLLING inside the contact, and rolling is topspin by definition, so no shot at any spin rate could come back. The reversals the model did produce came from ploughing, which is why they showed up on soft ground rather than firm greens.

The **roll phase needs no changes and should not be touched** for this: `groundStep` already models slip as `v - w` with sliding friction converging the two, and a ball that settles with enough backspin rolls backwards on its own. The bounce was destroying the spin before it got there.

**Do not fit this to published total-minus-carry tables.** They demand a 9,304 rpm wedge landing at 51 degrees release ten yards. Four fits against them stalled at 37–40% with parameters railing, and every fit that moved release did it by cutting friction — the mechanism the spin response runs on, which flattens the curve completely. Fit to behaviour instead, and keep the 7-iron spin-response curve (release against backspin, 3,000 to 13,000 rpm) as the regression instrument: it should release at ordinary spin and cross zero near 9,600 rpm.

## The range replaces `settings`, so it has to put it back

`enterRange` assigns `settings` wholesale from `RANGE_SETTINGS` rather than merging into it. That is deliberate — it is a different world, one hand-built hole with a fixed seed, no elevation and a flat green — but it means the player's own course settings are gone while either is open.

`rememberCourse()` stores them on the way in (guarded on `!settings.range`, so a second entry does not overwrite the stored copy) and `restoreCourse()` puts them back in `returnToMenu`, which is the single choke point — "the one way out of play or the studio". Anything added later that leaves the lab or range by another route must call it, or `range: true` leaks and the next world built is a driving range.

## Fit a surface against the clubs that land on it

Two separate fits, and they must stay separate. Firmness reaches greens and
fringe only, so the fairway is decoupled from it entirely.

- **Fairway** — driver, 3 wood, 5 iron layup, against the published tour totals
  (21 / 19 / 15 yd). Those figures are real for these clubs.
- **Green** — 56 degree wedge, pitching wedge, 9 iron, 7 iron, against tour
  backspin of 15-20 FEET.

**The published total-minus-carry figures are only valid for the surface the shot
finishes on.** A driver's 275 carry / 296 total is a fairway roll-out. A pitching
wedge's 136/146 is not, because that shot lands on a green. Four fits were spent
trying to make a 9,304 rpm wedge release ten yards on a fairway before this was
spotted, and every one of them stalled at 37-40% error with parameters railing.

**A softer green checks harder, and spins back more.** Firmness acts by how much
spin the landing takes off (`SPIN_BY_FIRMNESS`, physics.js), not by digging --
ploughing came out flat across the firmness range on a green when fitted. Soft
spinning back most is the owner's call (13 October 2026), how simulators treat
it; the one measured study (Haake) points the other way, recorded in RESEARCH.md.

**THE GREEN IS FITTED AS ONE PIECE.** Its `cor`, `tilt`, `mu`, `spin`,
`PLOUGH_BY_FIRMNESS`, `SPIN_BY_FIRMNESS` and `LANDING_SPIN.slowBounce` are fitted
together by `tools/green-fit.mjs` against the owner's come-back table, Haake's
measured green bounce, a 7 iron, chips and pitches; the collar (`fringe`) moves
by the same ratios. Moving one by hand undoes the others -- change a target and
refit. Less come-back, a 7 iron that stops and a forward first hop pull against
each other in this model; the owner chose the hop, so the 7 iron and pitches run
about 3 yd further than they did before. **A green bounces lower than a
fairway** on purpose: measured, not assumed (the ladder test says why).

**Never fit a surface against a single club.** The green fitted to the wedge
alone looked excellent there and left a 7 iron running 12.3 yd; the fairway
fitted to the driver alone left the 5 iron six yards short.

## The top bar describes whatever is on screen

`updateHUD` branches on `practice = rangeMode`. A practice ground has no hole number, no par and no pin position for the week, so those read "Lab"/"Range" and em dashes. **DISTANCE stays real in both** — it is where the green has been put, and it follows `rangeGreenYards`, not the tee yardage.

**The player card carries the real group.** The practice mode used to build a Round with a single invented golfer named "Range", which put a made-up name on the card and discarded whoever was actually set up to play. They now pass `round.players` through, so however many players are configured come to the range with their own names.

**The score chip shows the shot you are ON, not strokes to par.** A practice ground has no par. In practice mode it reads `holeTrails.length + 1` — that array holds COMPLETED shots, so the one being addressed is the next index. A session therefore opens on SHOT 1 rather than a zero that reads like nothing has loaded, and it ticks over as each ball settles. The caption switches between SHOT and TO PAR.

The trap this fixed: only `rangeMode` was ever handled, while the lab — a second flag over the same world, since removed — inherited the round furniture and sat announcing "HOLE 01 / 09 · PAR 4 · PIN THU front" over a flat bench green. **Anything keyed on `rangeMode` alone should be checked against `labMode` too** — the lab is a range with a different name on it.

## `main.js` DOM paths are not covered by the tests

A free variable in `main.js` ships. `node --check` parses it happily, the bundler emits it, and `npm test` never runs it, because the suite exercises physics, generation and round state — not the DOM update paths. The browser is the first thing that objects, at runtime, with a `ReferenceError`.

This has already bitten once: `practice` was computed inside `updateHUD` and then used in `drawLiveScore`, which is a different function. Everything passed; the page threw.

**So when editing `main.js`, check the scope by hand, then ask to run `npm run smoke`** (it uses the graphics card; AGENTS.md *Nothing runs on the graphics card unless the owner asks*). `updateHUD` and `drawLiveScore` both render parts of the same card and read like one function, which is exactly why a value drifted between them.

`npm run smoke` is the answer to "load the built page and click things", done the same way every time: it opens the built file in a real browser, walks the main paths a player takes, and fails on any uncaught error or `console.error`. Its first full run found a `ReferenceError` in the renderer that had been throwing sixty times a second on every green for six days. **What it does NOT walk is still only checked by hand**: multi-player rounds, scramble selection, match play, the lab, the launch-monitor panel with a live bridge, a round saved and continued, and every tool window during play. Say which of those a change touches, and check it.

## Practice sessions record per player, and the topbar chip changes job

**Who is hitting is chosen, never rotated.** `takeShot` only advances the golfer when a hole completes, which never happens on a practice ground, so the active player is stable by default. Clicking the player card cycles it and it stays where it is put. With one player there is nothing to click.

**Every range shot records `player` and `playerName`**, so the shot list filters to one golfer. `rangeShots` has carried the full launch-monitor set from the start — ball speed, launch, spin, axis, carry, total, offline, apex, landing speed — so the list is presentation over data that already existed.

**The `Scorecard` chip becomes `Shot data` on a practice ground** and opens the active golfer's shots. `data-panel="score"` was REMOVED from that button rather than relying on handler order: the generic `[data-panel]` wiring runs later in setup and silently clobbered the explicit handler when it was left in place. An explicit handler with no attribute cannot be beaten by file order. The shot number on the player card opens the same list.

The overlay closes on its backdrop, its close button, and Escape — the Escape branch is registered ahead of the menu and panel branches so it is not swallowed.

## The range gets a setup dialogue, like every other mode

`openRangePanel()` sets `rangeSetup` and opens the **round** panel, which renders a practice-group variant: who is hitting, and how far away the green is. The course picker, format, tees and putting mode all belong to a round and none of them mean anything on a range, so that branch drops them. **The element ids match the round panel's**, so anything reading those fields works unchanged.

The same branch serves twice. Opened from the menu it says **"Open the driving range"** and builds the world on commit. Opened from the avatar while already practising it says **"Apply to this session"**, changes the group in place, and touches nothing else — which is the gap that existed before: the group could be carried INTO the range but never edited once there, because the only thing that committed player edits was "Start fresh round", and that leaves.

**Shots already recorded are never rewritten.** They store the player index they were hit under and the name recorded with them, so dropping a golfer from the group leaves their session readable under the name it was hit with rather than silently swallowing it. `round.active` falls back to 0 if the selected golfer no longer exists.

`closePanel` clears `rangeSetup` the same way it clears `studioSetup`, so backing out of the dialogue returns to the menu instead of stranding the flag.

## One group editor, and a group that can change mid-round

**`groupEditor(hostId, start, onChange)`** renders the player rows for both the round panel and the practice one: a **+** under the last row while there is room, and a **trash** on every golfer but the first. The first is whoever owns the session and there has to be one.

**It holds a draft rather than scraping the DOM at commit time.** The old panel had a 1-4 count dropdown beside a list of rows, and those two can disagree — a dropdown says three while the rows show two. A single draft array cannot. `readDraft()` is what every caller commits from, including `readGroup()`, which no longer reads a count select because there is not one.

**`Round.setPlayers(next, tees)`** resizes every per-player array in step, matched by position:

- a golfer who **stays** keeps their scorecard, their strokes on this hole and where their ball is sitting
- one who **joins** starts from the tee with nothing behind them — their earlier holes stay empty rather than invented, because `cards` is indexed by hole and the scorecard guards every cell with `Number.isFinite`, so a missing hole reads as not played
- one who **leaves** takes their card with them, which is why the button confirms first on a round in progress

It re-runs the same validation the constructor does, including match play needing both teams, and clamps `active` onto a golfer who still exists and has not finished.

**"Apply to this session"** appears in the round panel during play and endless, and in the practice panel on the range and in the lab. It never rebuilds the world.

**Removing the golfer whose turn it is is allowed.** If everyone still in the round has holed out once they are gone, the hole is finished there and then via `showHoleCompletion` — the same routine a holed putt runs, so the summary, the scorecard and the countdown to the next tee are identical to any other hole. Reusing it matters: a second path to "hole over" would drift from the real one.

**Removal is confirmed by name before anything is lost**, because a scorecard leaves with its golfer and there is no undo. A failure from `setPlayers` raises a toast as well as the inline error — the inline error alone reads as the button doing nothing.

## One thrown error in a panel kills every handler below it

Panel bodies wire their controls in a single run after setting `innerHTML`. **A `ReferenceError` part way through that run stops the rest of it**, so the buttons above the error work and everything below is inert — with nothing in the console tying the dead buttons to the cause.

This shipped once. `formatNote` was defined on the line next to `renderPlayers`, and removing the second took the first with it. The round panel then threw on render, and **"Surprise me", "Start fresh round", the course picker and the studio shortcut all went dead together** while the panel still looked completely normal.

Two things follow. **Deleting a line means checking what else lived on its neighbours** — this file packs several definitions per line. And **`npm test` cannot see it**: it never renders a panel, so all 301 passed with the panel broken. `npm run smoke` can, and exists largely because of this: it opens every panel the main menu offers, presses every tab in each, and presses "Surprise me & play" by name.

