# Testing Fairway

What is checked, by what, and what nobody checks but a person. Written 16
October 2026; keep it true when a suite or a smoke journey is added, removed or
changes what it covers.

## Four layers, and what each can see

| Layer | Command | Runs on | What it can see | What it cannot |
| --- | --- | --- | --- | --- |
| **Node tests** | `npm test` (whole suite); `npm run test:changed`, `npm run test:fast` (*Running the Node tests*) | the processor, about 3 1/2 minutes whole; seconds for the fast set | the rules, the ball, the generator, saves -- every pure module | anything `main.js` wires up, anything drawn |
| **Generator checks** | `node tools/biome-fingerprint.mjs --check`, `node tools/bench.mjs --tier quick` (and `seated --set trees=65`: no plant's drawn foot above its ground) | the processor, seconds | whether generated ground moved; course invariants that must be zero | how a course looks |
| **Smoke test** | `npm run smoke` | **the graphics card**, about 5 minutes for all | the built single file in a real browser: buttons, panels, journeys a player takes, any error or network request | whether it LOOKS right; real phones, real monitors |
| **Frame profile** | `npm run profile` | **the graphics card**, minutes at full load | what a frame costs | correctness |
| **Interface audit** | `node tools/ui-audit.mjs` (UI_POLISH.md) | **the graphics card**, about 14 minutes for every screen at sixteen sizes (four side by side), about 5 for `--quick` | every screen's layout at phone to 4K and both Text size ends: overlapping or cut-off text, things off screen or off-centre, two highlights alike, touch targets under 44 px, contrast read from the picture, text under the kit's floor; a picture of each | whether it works (the smoke test's job), whether it is pleasant |
| **Menu motion** | `node tools/ui-motion-check.mjs` (UI_POLISH.md) | **the graphics card**, under a minute | each animation in ui-motion.css runs 100-300 ms on opacity and transforms only, ends whole when interrupted (Esc while arriving, two presses on Next), lets the keys answer at once, and does not run under reduced motion | how it feels |
| **A controller alone** | `node tools/ui-pad-check.mjs` (UI_POLISH.md T2) | **the graphics card**, about three minutes | a pretend standard pad in `navigator.getGamepads`, at six sizes: the d-pad moves the main menu, Play and the pause list; A opens and presses; B closes a sheet with the cursor back on its tile; A alone starts the course of the week; Start pauses and B resumes | a real pad's own quirks (non-standard mappings, stick drift) |
| **The pieces a player moves** | `node tools/ui-movable-check.mjs` (UI_POLISH.md T3) | **the graphics card**, about two minutes | in a round at six sizes, the map (by its header) and the shot numbers (Tab) follow a drag, stop inside the playing area when dragged past it, stay inside when the window shrinks, and go back on a double click; on a phone the map stays in its own place (by design) |  a finger's drag on a real phone |
| **Presses into each mode** | `node tools/ui-flows.mjs` (UI_POLISH.md) | **the graphics card**, about two minutes | from the main menu to a swing ready, per mode: clicks, and arrows plus Enter by the game's own focus rule, actually pressed; a path the keys cannot finish fails | whether the screens look right |
| **Frame comparison** | `node tools/frame-ab.mjs --goal <name>` (two builds, alternately; `--season` for a season's costs; spots `menu`, `lobby`, `courses`, `studio` measure the menus, and every run reports the wait from start to the main menu, and `page ms`: the browser's whole main-thread time per frame, which the probe's CPU figure misses -- styles, layout, painting, timers), `node tools/frame-variants.mjs` (ideas live in one page); `--built <x.fairway>` on frame-ab, frame-variants, frame-look and frame-motion plays a built course from its file, frame-ab's `--scene` lists what the scene holds and `fly1`/`flyhigh` fly the camera; `node tools/builder-frames.mjs` times the Course Builder opening a course and its Game view, and measures their frames (`--editor-only`: the editor alone, about 40 s a run, for repeated comparisons -- the card's timer drops a whole page on some runs) | **the graphics card**, about a minute a run, through `tools/gpu-gate.mjs` | a change's frame time, draws and triangles against noise; pixels changed against two loads of one build; with `--device`, a phone or laptop's screen and processor and an ESTIMATE of its graphics; `tools/frame-look.mjs`: two hooked builds with the renderer's clock stopped, so wind, clouds and water stand still and every changed pixel is the code, plus the pin label, wind arrows, map and page errors; `tools/frame-motion.mjs`: the same round in both builds on a virtual clock (a driver, the TV cameras, the overview, free flight), each frame read inside the frame it shows, both rounds on one pin seed (a built course cuts new cups every round), the drawn camera recorded beside each picture | whether a person would notice; real devices; the menus and panels (the smoke test's job) |

**The graphics card rule** (AGENTS.md): the smoke test and the profile run only
when the owner asks in that turn, and never while `nvidia-smi` shows the card
busy. The one exception: a `/goal` whose text says "GPU allowed" may run single
profile groups (`--only`) without asking, within AGENTS.md's limits (*A `/goal`
that says "GPU allowed"*); smoke runs are still asked for. The Node tests and
generator checks can run any time.

**GitHub** runs `npm test`, the ground check, and three smoke journeys (`boot`,
`range`, `endless-round`) under a software renderer on every push
(`.github/workflows/test.yml`). The smoke step there is slow and has not yet
gone green reliably -- TODO, *Found on GitHub*.

## Running the Node tests

`npm test` runs `tools/test.mjs`, which starts every test file in its own
process, 31 at a time (cores less one), **longest first** by the times in
`bench/test-times.json`, prints one line per passing file and the whole
report of a failing one, and ends with the totals and the five slowest
files. Three other ways to run it:

| Command | Runs | About |
| --- | --- | --- |
| `npm run test:changed` (`node tools/test.mjs --changed [commit]`) | only the files that can see a change: every test whose imports (followed through every module) reach a file changed, staged or new since the last commit, or since the commit named. Docs alone run nothing | seconds to the whole suite, by what changed |
| `npm run test:fast` (`--fast`) | the 81 files that build no course -- 621 of the 1,236 tests: the rules, the ball, scoring, saves, challenges, the interface's pure modules | 2 seconds |
| `node --test tests/trace-edit.test.mjs` (copy and delete, builder-ux) | a shape, a tree and a house copied and deleted, the original kept, the layer under a deleted bunker showing, one undo each; the builder-door-2 journey measures 100 m (109 yd), duplicates a bunker with Ctrl+D and deletes it, each named in History (Duplicate, Delete) | 1 second |
| `node tools/capture/builder-guide.mjs` (through tools/gpu-run.mjs) | **the builder guide's pictures** (builder-ux): the built builder at 1440 x 900 on ten screens -- the doors, the map round Worthington with a box dragged round the course, Build it for me's warning over it (its place search and USGS tiles served from bench/shots/map-tiles, kept once on real services by bench/shots/map-first.mjs; without them the map is skipped and Build it for me shows only the name typed), the holes step with the map checks, the trace step, the layers, the pen, the shortcuts, the review, the 3D editor -- from a local real-course draft (bench/courses/worthington-builder.fairway-draft), as WebP in docs/builder-guide/; fails on a page error or any network request. Re-run after a builder change that alters a screen the guide shows | about 1 minute |
| `node tools/map-checks-bench.mjs [--skip-big]` (local courses) | **the map checks scored on real courses**: each built course in bench/courses with each hole damaged in turn -- its green swapped for the one two on, its tee moved 80 m, its green left out -- and how often the checks catch it, how often a fix puts it back, how often a wrong fix is offered, and the false alarms on the course as built | about 3 minutes |
| `node --test tests/builder-map-checks.test.mjs` | the map's holes checked against the traced course: greens and tees found as pieces, a matching map clean, a green mark off every green with the nearest offered, missing greens and tees, a length wrong for its par, two holes on one green, a tee far from the last green, a line past the boundary, the card as a witness, a line across the rough and two lines crossing, a hole drawn to the wrong green flagged to fix by hand with no green guessed (since 10 November 2026), the unreliable verdict and the checklist | 1 second |
| `node --test tests/tees.test.mjs tests/round-tees.test.mjs tests/osm-course.test.mjs` | **the six tee sets** (src/tees.js; 10 November 2026): the order, the nearest set a course has (a tie to the longer), the sets for a count, OpenStreetMap's tag values (Worthington's `blue;white;gold;red`, yellow as gold, championship as black), a built course's sets and back tee, a built hole playing each set from its tee or the nearest and an old file's back and front as blue, white and red; every set allowed in a round and a golfer on a set the course lacks playing the nearest; the map's tagged boxes, untagged boxes spread by distance (one box carrying every set), a box-less hole's own tee, and the course's sets from tags or the holes' dist:* keys | 1 second |
| `node --test tests/builder-pen.test.mjs tests/builder-steady.test.mjs` | the pen's curve passes through every node, closes without a kink, keeps Shift-click corners straight, never loops between close nodes; the steadied brush lays nothing for a shake inside its string, follows straight when pulled, leaves no gap, straightens a wobbling line threefold, and catches up when let go | 1 second |
| `node tools/builder-smoke.mjs --only builder-build-for-me` | **Build it for me** (builder-ux): the course found in door 2's one search bar (the golf course taken over the town of the same name without a click), the map shown (a stand-in USGS tile cache), both Build it for me and Build it myself waiting for a box, a 1.5 km box dragged round the course, Build it for me's warning ("might not always get it right") closed by Cancel and pressed again, Build it -- and door 2's steps run to the review with every service stood in for: the survey over the box downloaded, the box the property (1,495-1,580 m a side), the land, the NAIP picture, OpenStreetMap's nine holes lined up with the LIDAR and marked; then the same club with hole 3 drawn to hole 7's green, which stops on the holes step with the doubt and a fix, and the fix puts hole 3 back on its own green; between the two, door 2 opened again offers the first course back by name (the kept draft), and "." frames the next hole with the overview map showing; and Save the course for Fairway on the review writes the file, which the game opens and plays a tee shot on; at 1366 x 768 and 2560 x 1440 the step bar's Next, the status bar, the panel and the palette stay in the window with no sideways scroll. The same on a real course against the real services is `bench/shots/build-for-me.mjs` (local) | 3 seconds |
| `node --test tests/builder-shortcuts.test.mjs` | the builder's menus and keys as rules (shortcuts.js): a letter is a tool and Ctrl plus it is not, Ctrl is Ctrl or Command, a command with two keys, a text box keeps its typing and its own undo, the shortcuts sheet lists every key | 1 second |
| `node --test tests/builder-old-files.test.mjs` | **old files still open** (the builder-ux goal): a door 2 course file saved before the goal (`tests/fixtures/builder-ux/door2-a351f84.fairway`, with its builder's section) opens in the game as the same course -- holes, yards, trees, the lie and the ground on 576 points -- and in the builder as the same draft -- step, holes, every layer's painted cells, the picture. What it opened as is frozen in the `.expect.json` beside it; `UPDATE_OLD_FILES=1` rewrites that, only on purpose | 1 second |
| `node --test tests/water-bed.test.mjs tests/builder-cover.test.mjs tests/builder-preview.test.mjs tests/quiet-right-click.test.mjs tests/builder-game-view.test.mjs tests/builder-parity.test.mjs tests/lidar-coverage.test.mjs tests/builder-marks.test.mjs` | hole marks dragged in both editors; how much of a square the LIDAR covers, and a square combined from what is saved; a box not square named for both sides and read back as itself, and 150 m added round it (growBox); every tool the two editors share, tried in both; Game view's rules (when it rebuilds, the camera, no saving; not the picture, which no journey drives yet); a pond's bed; ground cover, holding a shape, Back to 2D from any course, rocks through the file; what the preview shows for each tool on each landscape; right click stopped in the game | |
| `node tools/test.mjs paths water` | files whose names hold those words | |
| `npm run test:times` (`--save-times`) | the whole suite, then stores each file's time for the ordering | 3 1/2 minutes |

`--list` names what a run would start and stops; `--jobs N` sets how many at
once (3 when memory is short -- the commit charge has run out before).
`--changed` is a check while working, never the gate: a commit gets the
whole suite.

**Where the time goes** (the audit of 31 October 2026, the owner: "testing is
taking a really long time"). 1,236 tests in 157 files. 81 files take under
3 s together; everything else is **building courses**: 521 builds in a whole
run, about three-quarters of each the ground grid every height is read from.
A file's tests run one after another in one process, so a file that builds
many courses on one thread is a queue however many cores sit idle, and the
suite waited for its longest file: `water-keep-out` (48 courses) took 177 s
by itself. Fixed in four ways:

- **Built on worker threads** (`tests/worlds.mjs` `measured`): the file names
  its courses and a measuring module under `tests/measure/` that runs on the
  thread that built each course and returns only numbers (a world holds
  functions and cannot cross a thread); the test asserts on the numbers,
  word for word what it asserted on the worlds. `water-keep-out` 177 s ->
  35 s, `fairway-features` 123 -> 20, `clubhouse` 100 -> 18 (and its
  clear-ground check now covers all ten landscapes, not four).
- **Split where the tests build different courses**: `water-terrain` into
  `water-shore` and `water-lakes` beside it, `landscape` into
  `landscape-water` and `landscape-biomes` -- tests that read the same
  courses kept together, so nothing is built twice.
- **The cache used**: `shared-fairways` built its 18-hole links afresh in
  every test (95 -> 32 s).
- **Longest first**: the plain runner sorts files by name, so a heavy file
  named water-* started last.

Whole suite: **285 s -> about 205 s** (273 and 286 before, 201 and 204
after). What is left is the processor, not the order: 31 files at once on
16 cores make every course build about two and a half times slower than
alone (`tee-corridor` 74 s alone, 187 s in the crowd), and the whole run is
about 4,700 file-seconds. Only less building makes it faster now: either a
cheaper course build (which would also shorten the wait to start a round --
TODO, *A course takes seconds to build*) or fewer courses in a test, which
narrows what it checks and is the owner's call.

**A new heavy test** (more than a few courses): build them with `measured`,
or give it a file of its own; never a fresh `generateWorld` where the cache
would do. A file over a minute alone (`bench/test-times.json`) is the next
thing to look at.

## Playing a round, in every format and group

The rules of a round live in `src/game.js` (`Round`) and `src/skins.js`, with no
DOM and no three.js, so whole rounds can be played in Node in moments.

**`tests/round-matrix.test.mjs` plays every format with every group** -- about
1,250 rounds and 65,000 shots in about 5 seconds. A seeded made-up golfer plays
each shot (long shots come up short, some go in water or out of bounds, short
ones are holed or left close), and a scorer written separately from game.js
checks the round after every shot: strokes, penalties, putts, whose turn it is,
honours on the next tee, match holes and the match result, scramble team shots,
skins and carries, when the round ends. Along the way it saves and restores the
round mid-hole, while a ball waits for relief and between holes; takes
mulligans and checks they put everything back; drops balls; and has golfers
join and leave between holes. A failure names the format, group, putting mode
and seed, so it can be replayed exactly. **On a real course**:
one test builds a real nine (Classic and Architect until 2 November 2026), plays every format
and group over it with each hole told its own par, and checks every golfer's
score to par against that course's pars.

| Format | 1 golfer | 2 | 3 | 4 | Teams | Endless |
| --- | --- | --- | --- | --- | --- | --- |
| Stroke play | yes | yes | yes | yes | all on one side, and split | yes |
| Match play | refused | 1 v 1 | 2 v 1, 1 v 2 | every split, 1 v 3 to 3 v 1 | every split with both sides | refused |
| Scramble | yes | yes | yes | yes | every split, one team of four included | yes |
| Skins | refused | yes | yes | yes | all on one side, and split | yes |
| Stroke with a goal | Sudden death (endless) and Bogey-free nine, 1-4 golfers, golfers coming and going; the goal checked after every hole and through saves |  |  |  |  |  |
| Course of the week | 18 holes of stroke play, 1-4 golfers, every putting mode; the week kept through a save, and each golfer's best for the week (first finish, only a better round replaces it) |  |  |  |  |  |
| A friend's challenge | 9 and 18 holes, 1-4 golfers against a friend's card; every golfer's comparison checked after every hole, the final line (beat, wins by, tied), the challenge kept through a save |  |  |  |  |  |

Each under every putting mode (putting.js `PUTTING_MODES`: hole out, dartboard,
decimal, gimme circle; the suite fails if a format misses one), both
out-of-bounds rules, over 3 holes, then 9 and 18 with group changes.

**A new format cannot skip it.** The formats are listed once, `FORMATS` in
`src/game.js`, which the round, the save import and this suite all read. The
suite's first test fails if `FORMATS` holds a format its scorer does not play
(its `PLAYED` table), so adding one means teaching the scorer that format's
rules -- AGENTS.md, *Game rules live in pure modules with Node tests*.

Other round suites pin one behaviour each with a hand-written card:
`core` (formats finish, scramble penalties), `play` (putting modes, mulligans,
sim drops), `putting-gimme` (the gimme circle: one putt inside, none outside,
the edge inside, off the green never; its size checked; an old save without
one loads at 3 ft; a scramble lie given; the one ring drawn), `honours` (playing order, golfers added, removed and reordered),
`relief` (water and out of bounds under the Rules), `skins`, `mixed-groups`
(monitor and Swing Meter golfers together), `endless`, `round-library` and
`course-library` (saving), `weekly`, `challenges`, `rival` (a friend's
challenge: the code made and read, refused when cut short, altered or from
another version, the gimme circle and its size carried, and an older code without one read at the default, the comparison, and shots read back from a code flying to the
same millimetre on a freshly grown course with trees and wind).

**`tests/challenge-matrix.test.mjs` plays every challenge with every group of
one to four** -- the 34 that are plays (the two rounds are in the round
matrix), two to four for head to head, six seeds each, 798 plays and over 5,000 balls
in under a second. A seeded made-up golfer plays each ball, and a referee
written separately from challenge-play.js checks whose turn it is after every
ball, when a golfer is out, when the play ends, each golfer's score, medal and
place. A second test plays an evening of 600 challenges and checks the pay:
each first medal once, repeat pay inside the day's allowance, a new best once
a challenge a day. What a single ball scores is pinned by hand in
`challenge-play` (which also flies the Swing Meter's High, Low, draw and fade
through the ball model, so High and low and Curve it stay reachable), and
`challenge-spots` checks on the real Challenge Course that it hosts every
challenge and every spot is on ground its challenge allows.
`challenge-matrix` also plays the head-to-heads: a referee of its own follows every
knockout (who is out each round, who wins) and checks every hole of Bingo
Bango Bongo by what must hold (the farthest plays, the first in has bongo, no
hole gives more than three points, the most points win); knockouts' ties and
the away rule are pinned by hand in `challenge-play`.

**`tests/challenge-virtual.test.mjs` plays every challenge through the ball
model**, in Node with no browser or graphics card, in about 20 seconds. A
golfer (`tests/virtual-golfer.mjs`) swings the Swing Meter with the game's
own functions -- the bar zoomed to the shot, the distance tapped where the
target marker sits, the strike as the marker runs back, a little seeded error
on each -- and the ball flies through `simulateShot` on the real Challenge
Course and the real range: slopes, rough, water, trees, the cup. It plays
as a person does where the ball asks for it: a putt is read for its slope
(about 17 cm of putt for each centimetre of rise at Stimp 10; without that
every uphill putt stopped a tenth short and only tap-ins were holed), and a
chip out of grass is landed shorter because it runs further (the flyer). Each
challenge is set up by the same `planChallenge`/`playContext` the game calls
and played to its end, one golfer and a group (two and three for head to
head); Sudden death and Bogey-free nine are played as real rounds, hole after
hole. A steady golfer must medal in at least half and score in nearly all. The
golfer does not read greens -- it putts straight at the hole -- so it putts
poorly on sloping greens, as such a golfer would. Its first run found One club
unwinnable with the stock bag (no 8-iron) and that "Hold the green" needs spin.
`challenge-week` checks the challenge of the week: the same date gives the
same pick (this week's and next week's are pinned), each cycle plays every
challenge in the pool once, a pool added later leaves earlier weeks alone,
the week's pay, and that the next nine weeks' courses host their picks.

**What the round tests do not cover:** `main.js` -- the round panel, the
buttons that hand the turn over, the scorecard and banner on screen, the XP
popup. That is wired code, checked only by the smoke test and by playing.

## The Node suites, by area

All in `tests/`, one file per subject; `tests/worlds.mjs` builds and memoises
the courses several suites share, and builds many at once on worker threads
(`measured`, with the measuring modules in `tests/measure/`).

- **A round and its records** -- `round-matrix`, `core`, `play`, `putting-gimme`, `honours`,
  `relief`, `skins`, `mixed-groups`, `endless`, `round-library`,
  `course-library`, `scoring`, `handicap`, `profile`, `progression`, `rewards`,
  `achievements`, `challenges`, `challenge-play`, `challenge-matrix`,
  `challenge-spots`, `challenge-week`, `challenge-virtual`, `weekly` (also: every week before Lakeshore Dunes' debut keeps the landscape it had, the debut week is the newcomer's, and the splash's copy of the rotation agrees), `far-woods` (the far woods: outside the property, never in water, deterministic, wooded from the property line to 12 km and coarser with distance; every crown's base no higher than the DRAWN ground under it; the drawn ground reproducing the ring's vertices; each far shape flat-based and no wider at its base than the seat assumes; Low and Medium groves only; Island's far woods on its islets went with the Keys, 7 November 2026), `water-mirror` (trees in still water: each twin under its own pond's level, straight below its tree; none for a tree far from still water, nor for the sea; a pond made from its outline gets its bank's reflection, under the water and outside the pond), `seasons` (Haunted Hollow's window to the minute, offered with and without the setting, a picker keeping a chosen landscape, an off-season endless run never rolling it and staying deterministic, the weekly stand-in only out of season and only from 9 November 2026, the splash's copy of the rotation, and an old graphics record loading with the setting off), `rival`, `player-colours`, `bag`,
  `range-report` (the range's CSV and PDF: the numbers, and a PDF a reader accepts).
- **The ball** (rebuilt 11 November 2026; docs/BALL_PHYSICS.md) -- `ball-bench`
  (runs `tools/ball-bench.mjs`: the ball against 148 real measurements, one
  test a section, so a failure names what a player would notice), `aero` (the
  air's rules, and the published flights), `bounce` (one impact's rules: never
  adds energy, firmer never bounces lower, grip or skid, the constant spin loss
  of a firm green), `turf` (the three conditions, old saves' settings read,
  every surface's row, a release runs exactly its Stimp), `cup` (the hole's
  capture curve, lip-outs, the flagstick, and the same hole inside a whole
  shot), `core` (flight), `landing`,
  `refinement`, `green-refinement`, `pins`,
  `obstacle-collision`, `solid-colliders`, `homes`, `swing-meter` (the lie's
  speed table, the flyer -- grass takes a lofted shot's spin and almost none of a
  long iron's -- from meter and monitor shots alike; nothing in it holds a ball to
  stopping or staying),
  `dispersion`, `plays-like`, `aim-preview`, `range` (every green, the aim
  arc, slopes, cups, chip and putt spots), `lab`.
- **Making a course** -- `world`, `landscape` (with `landscape-water` and
  `landscape-biomes`), `landscape-edge`,
  `course-variety`, `course-living`, `course-names`, `atmosphere-routing`,
  `exotic-shapes`, `fairway-features`, `green-*`, `bunker-ground`,
  `tee-corridor`, `water-*`, `waterways-tours`, `vegetation-variety`,
  `generation-steps`, `parallel-ground`, `settings-schema` (also: a save on the removed Haunted Hollow opens on New England; a save on every old landscape key, schema 16, opens on its new one and keeps the rest; an Architect save, schema 15, loads as an ordinary course without its designer or dials),
  `landscapes-complete` (the US landscapes goal: the keys a player can pick are exactly the built ones; every one has its record, interface, world, course names of its own, hole names, crest motif, picture and every season's look; every species it plants, in the open, in its stands and their understorey, has a model family with models in the game; no two share course names; every landscape in the USA has a map shape (all of them since Scottish Links left, 8 November 2026); every old key leads to a built landscape and the settings migration agrees; every planting list sums to one, since the open pick is cumulative and a species past 1 is never planted),
  `graphics` (a software renderer -- SwiftShader, llvmpipe, softpipe, Basic Render -- known by its name, a real card not; a machine with one starts on Low),
  `worker-imports` (course.js asks no module that reads the models, and the built page has them once), and the bench's `pathInParts` (a course's cart paths are one network);
  `country` (generator 85: a soft field keeps a plane and takes the point off a crease; no hole lies in a trough on three landscapes), and the bench's `teeCollarTilted`;
  `seasons` (snow winters' `snowTopped` is by eye, the `wall` capture view; a prairie grass in its own colours by the season, an older family in the landscape's, the bluebonnets' heads kept; a date's meteorological season, flipped south of the equator; a round's season today's or the one picked but never one not yet drawn, a tropical landscape always summer; a record's look in a season; every region's winter, the season's palette moving the turf and never the greens, the bare-in-winter rule; every landscape's spring bloom, its months and colours, falling in spring only and none where the months miss it, the wild ground taking it and never a green; tests/built-world and settings-schema carry the Season setting), `twigs` (the winter branches on the real models: the same every time, every twig joined to the tree, each species' twigs filling its own crown's width and height, a child never thicker than its parent, the twin far fewer triangles, a bare tree cheaper than in leaf with its wood in one part and the bark's own attributes, an aspen's trunk marks kept),
  `landscape-map` (the projection puts every landscape on the picture, Alaska and Hawaii in their insets, west left and north up; fifteen reference courses find their own landscape, Key West by the nearest shape, and 37 of 39 landscapes find themselves at their own place; the sea and Scotland are nowhere; an overlay wins over the shape under it; the globe an SVG with its dot, land cut at the horizon, and Hawaii's globe mostly sea),
  `far-heath` (the heath past the near tiles: domes only on heather, at the ground, in the cushions' colours, no shadow; every patch found, one a 2.6 m square within 10% of a full scan; a moor spaced out to the cap; thinner on Low, none without heather or without a reach; the grow-in and sink really in the compiled toon shader),
  `corridor-seam` (no bank where two holes' corridors meet: on played ground where the nearest hole changes, clear of sand, water, paths and tee pads, the sharpest bend under 0.3 -- Lakeshore HZ-2 and Links ST-1, which bent 0.94 and 0.56 with the fade off),
  `blowouts` (Lakeshore Dunes' sand: the field baked on the atlas grid and read back as a linear filter reads it, the gate off the playing lines, water clearance, about a tenth of the dune rough, nothing planted on it, no other biome building a field, and the ground shader asking the same questions in the same order -- a structure check, since no test runs the shader),
  `landforms` (the cartoon overhaul's country between the holes: every recipe names real ground types, the field baked and read back as the blowouts' is, a seed's own bytes, every gate keeping its ground off the playing lines (and the shader opening its gates on a rock tee's outcrop by course.js's own numbers, 7 November 2026), the range flat and plain, each landscape getting the ground it asks for -- off the corridor, clear of creeks, no tree on what will not hold one -- pine straw played from the bytes it is painted with, and the shader painting in the lie's order),
  `twigs` also checks every Meshy tree's bare winter branches are finite (8 November 2026: a zero distance had made 17 NaN);
  `roads`, `paths` and `clubhouse` build their courses with `facilities` on (off on a generated course since 8 November 2026), and terrain-true keeps the Badlands' road check as a to-do;
  `map-relief` (the maps' relief shading: flat ground unchanged, a slope facing the top left lit, its bounds; 8 November 2026);
  `rock-tees` (Desert Mountain's rock tees, 7 November 2026; its ranges' blind tee shots are measured by the bench's `blind`, not here: on two eighteens, two to four holes tee off an outcrop, the back tee on its pad more than 6 m above the start of the fairway, the fairway itself never rock, the line from the eye on the back tee to 60 m past the fairway's start never blocked, the outcrops' flanks rock; no other landscape grows one).
  `terrain-true` (no two landscapes share their ground; generator 76, terrain true to place: each landscape in biomes.js TERRAIN has the recipe its research names; every recipe finite, seeded and repeatable; the recipes make their shapes -- the Bluegrass's sinkholes, the Hill Country's treads, Ponderosa's cones, the Ozarks' hollows, Florida Palms' few metres (the Bayou's, then the Flatwoods', until they left); Desert Mountain taller, more of it hill and its tops piled with `boulders`, against the Sonoran; and a Florida Palms course is flat, under 6 m from low to high land and less than half Classic Parkland's; and the California Coast's 18 holes (Monterey's until 8 November 2026) have at least three with the sea within 80 m, below its cliff, with nothing in play wet; the Lowcountry's tidal creeks hold the sea in a marsh at the tide line with nothing in play wet, generator 80; the High Plains a flat table with bare playa floors and the Sand Hills' dunes over twice a links', generator 81; the Badlands carved, generator 83: tall summits, prairie between them, lowered and not squashed by the fade and gone at a corridor, the road on gentle ground, the far country standing up, and a built course's far land only rising).
  `builder-skin` (the builder's Skin from the land, src/builder/skin.js: every landscape names a face and an apron; a butte's steep sides painted rock with its apron below and its flat top and the plain left grass; every face and apron the landscape's own, `layersFor`, so no grey rock on a dune; nothing under the holes' turf; added beside hand painting or replacing it) -- and builder-editing's own case for the editor's one-undo-step skin.
  `shared-fairways` (the overhaul's links: an 18-hole links shares fairways on at least two holes a course and six across three seeds, never a par 3; no landscape outside the Links' region -- Seaside Links -- asks for it or gets it; a widened edge is fairway in the world; sharing is reproducible and a lone hole is left alone; a join carries pot bunkers on its seam, sand at the centre and ringed by fairway),
  `stands` (the overhaul's uncleared woods and thickets: every record whole and never reaching within 25 m of a corridor, a stand planted thicker than the open scatter, back from play and on ground that holds a tree, none on the Redwood or the range, the sites and field the seed's alone, and every landscape's far-forest record one the ground shader can take, and its long-grass record naming families the model module carries; the understory trunkless and inside stands only). `tee-corridor` counts the open scatter alone against its target and its tee surrounds, per hectare of ground that can hold a tree (a stand stands back from every tee by design). `instance-cull` (its thinned-twin checks on the rebuilt Redwood Coast's `Blender_RwRedwood_1` since 7 November 2026) holds that a painted crown swaps only to the far twin it ships (or, where the packing step refused one because none kept the outline, `MESH_NO_FAR`, is drawn whole), by `farPainted`, and -- since 9 November 2026, when every model over 1,500 triangles got a far version -- that every painted crown big enough to thin ships one and is drawn with it; that inside the swap's band a crown is held by both meshes with complementary dissolves and a mesh that does not swap carries no level; and that Low (`thinTrees`) thins far trees but never one of the hole, and keeps a flying camera's ring. `low-trees` (the rule itself: every hole of a generated and a built course walked tee to green, none of the hole's trees thinned, a square's share never under its trees'), `ground-lod` (the ground's squares cover it once from near and far, a leaf's triangles are exactly the grid's, and what is drawn coarse stands off the ground the ball meets by under the tolerance in pixels), `far-cluster` (a far version has fewer triangles, the same box, the paint and the winding, and is not made where it would not save; the outline score finds nothing lost in a model against itself and finds missing canes and a clump; thin canes are stepped up past an eighth, and get no far version where none keeps their area).
- **The roads and the homes' streets** (`tests/roads.test.mjs`): no road, street or lane on play, on water or through anything built; every drive left reaches a road down a lane; every street joined; a house's front away from the fairway; a mailbox on the verge. The bench's `roads` metric holds the same rules over every landscape, but its fixture has homes off: run `node tools/bench.mjs roads --tier full --set homes=true` after a change to them.
- **The world round the holes** (Architect's pieces, the generator's since 2 November 2026, on every course but the range; the Architect suites -- `designer`, `architect`, `biome-architect`, `hand-tools` -- went with it, and `occasion` and `leaderboard` with tournament week). `paths` (cart paths: a network a course long, never within 10 m of a green, no step steeper than 30%, a dozen sharp corners at most, the path its own lie and never on a green, tee, sand or water, nothing planted or built on it, out of play beside its hole, free relief off it stance and all and no nearer the hole, a creek it crosses bridged, and a ball dropped on a bridge stopping on its deck, in the penalty area; one network, every end on another piece or well clear of it, no short jog joined at both ends -- PA-2 Midwest, whose hole 10 pull-off sat in a pocket, included; no building or house on a path or with one through it, and the footprint test itself; no end stopping within 12 m past a junction or running on 8 m past a path it crosses; no more than 2% of ends folding back on themselves; **every path over water is a bridge**, on every landscape -- no path point over a stream, pond, lake or ravine off a bridge, the clubhouse's link included -- and `paths` holds the clubhouses' height table to the models). `waterworks` (each landscape dresses its ponds its own way; rip-rap at the water and never on a green, tee, sand or path; fountains in open water, two at most, only where the landscape has them). `paths` also holds the owner's rule of 2 November 2026 -- no right angles, no dead ends -- on the courses that meet it and as a budget on the rest; `roads` (no road or lot on anything played on seven landscapes; the lot beside the clubhouse, full or half size; a public road and a drive wherever a straight dry edge allows -- not on the Keys; a ball on a road reads Road, past the road is out of bounds), `story` (every landscape its own walls, farm, ruins, landmark and circle, the Heartland's corn by its red barn; everything out of play, off the paths and the water, nothing grown inside a building; a wall stops a rolled ball and is never out of bounds). `life` (every landscape its own animals; nothing on a played surface or inside a tree). `yardage-book` (a page a hole, the PDF well formed by the range report's check, every hole's number, name, par, carries and what is left). The pause menu's *Yardage book* item is not driven by a smoke journey. `clubhouse` (every landscape's course has one; clear ground, facing the first tee, nothing grown or built on it or its lawn; the path reaching its door; a ball fired at it stops against it and is never out of bounds for it, with residential out of bounds on or off). `markings` (stakes, posts and rakes, every kind present; none in water, on a path, green, tee or sand; every pond staked and every bunker raked; posts at their distance just off the fairway; every rake in its bunker's sand at least a metre in; nine divots in ten within 16 degrees of the line to the green). `surface-field` (bunkers past the slots and only those marked; no field without one; the baked field's 0.5 line on the bunker's edge within 15 cm; the packed table texture keeps each table where the shader reads it; a turned green is one shape to `greenDistance` and `greenPoint`, and an unturned one the plain formula to the bit). `fountain` (the owner's review: every drop a parabola from the nozzle, apex 2.9-4.3 m, landing within 3.5 m; the plume filled from the water to the top at any moment; it moves; the same seed draws the same fountain; rings spread and fade, the jet breathes about 3.7 m). `hole-names` (every hole named, all different, Home last, seeded; no famous hole's nickname; the crest an escaped SVG; the flag red front, white middle, blue back where the cup actually is).
- **The ground a ball plays from** -- `grounds` (the overhaul's ground types: a row in every table -- bounce, roll, skid, lie, relief rank, roll hop, sound, map colour, HUD label -- no restitution a dropped ball could gain height from, the orderings that make each one itself, what may stand on each, a pitch running further on rock than in heather, the shot card naming the ground).
- **Drawing, by structure only** (no test loads `renderer.js`) --
  `ground-shader-structure` (also: how many times the ground painter is called), `green-cue-wiring` (also: the ground-reading
  choice writes every cue, and an old record adopts it once), `glsl-reserved`,
  `three-namespace`, `flood-shadows` (five samplers since the tables were packed), `instance-cull` (also: a mesh with a reach drops
  whole squares past it and only those; a near-shadow plant casts into the nearest map alone), `occlusion`, `clouds`,
  `mist`, `daylight`, `floodlights` (also, since 8 November 2026, no more live lamps than a card's
  shaders hold: `lampBudget`), `distant-flags`,
  `auto-resolution`, `ui-scale`, `roll-hop`, `toon-ramp` (the overhaul's coloured
  ramp: grey without a shade colour, brighter step by step in every landscape,
  a shade colour moving the hue and not the brightness).
- **Cameras and maps** -- `waterways-tours` also checks `treeBlocksView` (a tree on
  the line or filling the frame near the camera is cleared, one behind the ball,
  behind the camera, far off to the side, or under the line is not);
  `camera-flight`, `approach-camera`, `tv-camera`,
  `camera-orbit` (the drag round the green and aim point views: no turn
  leaves the view as it was, a turn keeps distance and height, the tilt stops
  at 5 and 85 degrees and turns back at once, the wheel stops at a third and
  two and a half times as far), `projector`, `course-map`, `green-map`,
  `shot-views`, `shot-data`.
- **The capture tools** -- `capture-mux` (the MP4 and WebM files the clip
  recorder writes hold together: boxes and elements fill the file, the frame
  tables name every frame, key frames marked; docs/CAPTURE.md). Whether a clip
  plays is checked in a browser at the end of every recording.
- **The interface audit's rules** -- `ui-audit-rules` (tools/ui-audit-rules.mjs,
  the 1.0 polish): each rule shown a made-up layout that breaks it and one
  that keeps to it -- overlapping controls, leaning neighbours compared at
  their middle, tight lines of text, covered things skipped, clipped text and
  ellipses, off-screen with and without a scroll box, off-centre content,
  the double yellow boxes against chosen-yellow-beside-white-cursor, two
  cursors, touch targets, contrast and small text, and the known list.
- **Words and pictures on the menus** (the 1.0 polish) -- `tips` (every key a
  loading tip names is in keys.js, a tip naming a key lists it, 10-15 short
  plain tips, the splash reads the build's list), `picture-loop` (the
  landscape pictures' schedule, one picture loaded until the next fades in,
  reduced motion holds still, no card no timer, a card redrawn does not stack),
  `last-play` (Play again: kept as started, a friend's challenge never, a
  deleted course not offered, a damaged entry or refusing store harmless, at
  most four golfers, its line in plain words).
- **The 1.0 interface** (branch `ui-1-0`, from phase 0) -- `ui-layout` (the
  canvas for 16:9, 16:10, 4:3 and 21:9, the bands, the leaning sheet's corners
  on the 60 px margins at every height, columns that never overlap, the canvas
  filling the screen at every Text size and its 1024 floor), `ui-palette`
  (every biome has a complete palette and no two share one, readable text over
  a light and a dark picture, which biome each screen wears, the menus
  following the week), `ui-kit` (every class `uk-` and every rule scoped to
  `.uk`, no colour on a straightening wrapper, nothing leaning and no rounded
  corners (square since 28 October 2026), selection a square ring, the
  stylesheet's sizes match the rules, the two font files are local woff2
  with their licence, text escaped).
  `ui-settings` also checks every in-round setting is a tab of the one
  Settings window and only the monitor opens a screen. The smoke harness reaches
  settings through `t.settings(tab)` (pause → Settings → the tab), Tools with T
  on the round screen (the pause list's Tools row on a phone), the cameras with
  C and G, and the mid-round group through *Golfers & rules*.
  `keys` (UI/UX pass: every key listed once, Tab is the numbers and ? the
  list, each tool's key matches, the swing strip by input, main.js answers each
  key, a step passed without what it needs is not ticked, and Esc on a step
  sheet goes back one step, closing only from the first). The smoke harness's
  `closePanel`/`closeDrawer` press Escape until the sheet is gone, and
  `leaveMonitor` closes the Settings window that Esc in the monitor screen goes
  back to.
  `round-hud` (phase 1: what the round screen's pieces say -- hole slab, conditions,
  club, scores with a real minus, golfer cards, keys, the ball light, the
  camera's name beside the wind, the aim point's distance left to the hole -- and
  how large they are drawn: the club panel and the meter, and the slab and the
  cards, never meet at any tested size or Text size).
  `shot-moments` (phase 2: the card on a course and tiles on the range, the
  player's choice and Tab winning, a putt popping no card, the card's hold and
  fade, the range's eight tiles being real fields, the choice kept per device;
  birdie or better earning the band, every banner under two seconds with the
  next turn announced as it leaves, the paper card's marks), and `round-hud`'s
  round-complete helpers (places with ties, XP this round, the handicap line,
  and `roundResult`: a tie called a tie, skins ranked by skins won, match play
  by the team and its margin).
  Round 14: the reachability and thumb checks skip a select under a 1.0
  drop-down (`.dd-native`: its field is the control) and measure the whole
  club box (`.club-control`, which opens the bag) rather than `#club`.
  On a big screen the flight check now expects no flight panel, Skip in the
  meter (`#smSkip`) and the launch strip; since 28 October 2026 (the foot
  compacted) it expects `#smSkip` whenever the Swing Meter is in use, on a
  phone too, and the phone journeys tap whichever Skip shows (the meter's,
  or `#skipFlight` alone off the meter), press MAP before the map, and
  check VIEWS steps aim point, green and back and FLY reaches free flight,
  its fly pad a thumb wide, and comes back; in flight a phone (known by
  its bar, `#rhBar`) is expected to show no flight panel; the range journey opens
  Range controls from the tool column (`#rhTools [data-hud=range]`).
  `hud-places` (the map and the shot numbers once dragged: a place is a
  fraction of the playing area and comes back the same, a drag past the edge
  and a place from a wider window are held on screen, bad saves are
  dropped, an empty set removes the key).
  `ui-windows` (each row of a window is moved by its distance from the
  column's middle). `ui-focus` (phase 3: arrows and a controller -- every button reachable from
  every other in the menus' layouts, none a dead end, down goes to the next
  row, a single line wraps, the keys and pad directions). `ui-lobby` (the
  1.0 lobby: a picker's value and line are cut from the drop-down's own
  option text, every out-of-bounds rule reads as its short name, every format
  has a tile, and Play's steps for each game type: Game, its own step,
  then Golfers, Format and Rules). `swing-meter` also has `longestReach`,
  the default aim pulled back to what a full swing carries. `phone-view` holds
  the phone's lift to the measured layouts and to the views that follow the
  ball. `waterways-tours`
  holds a boulder, a house and a log to the same view test as a tree, and free
  flight to the play view's clearing until it has moved two metres. `challenges` also holds a challenge's
  group to the fixed rules (blue tees for all, stroke play, Rules of Golf, lie
  penalty on). `ui-monitor-setup` (the setup screen's steps tick in order
  and never ahead of the bridge, the ball light's words match the round
  screen's, the monitors listed are rēlā's, once each, the last shot in mph, degrees and rpm). `ui-profile-hub` (every
  heading the old profile page writes has a hub tab; the overview's eight
  numbers and their dashes). The `profile`, `bag`, `look` and `level-up`
  journeys press the hub's Locker, Bag and History tabs before reaching in.
  `ui-settings` (the category list opens known sheets and holds every
  settings screen). `ui-studio` (what counts as a changed studio setting, how
  a change reads, and the schema reading clean against itself).
  `ui-range-controls` (the range window's session table reads the report's
  club table: balls, average carry, spread). `ui-dropdown` (round 14: the 1.0 drop-down's rows -- groups, locked choices, notes -- and its cursor). (`model-framing`, which held the tiny course models to their boxes, went with
  the models in the 1.0 polish.) `course-file` (the 1.0 polish: a course and its
  picture round-trip through a `.fairway` file, play settings never travel, the
  course code is unchanged, anything else refused in plain words, a bad or
  oversized picture dropped and the course kept, an old file migrated, safe
  file names, the save step's views). `course-pictures` (where those pictures
  are kept: IndexedDB first, its own localStorage entry when that fails, a
  full or refusing store never throwing). `course-picture` (a course's
  picture lays out every hole, the same course the same way, fills its frame
  and draws inside it). `endless` also checks a run pinned to a landscape (every hole in it, the
  plain seed unchanged). `round-tees` (each golfer starts from their own tee,
  or the nearest set the course has, joins at their own, and keeps it through
  a save; the six sets allowed and nothing else).
  `chiptune` (phase 4: every tune well formed, the plan's eight moments, none
  longer than 7 s, interface sounds under 1.2 s, the score-to-moment rule, and
  the player never scheduling in the past). `sound` also holds the wiring
  (17 October 2026): the marimba stings are gone (no `INSTRUMENTS`, no
  `score`, no `FINAL.scores`), and the owner's signed-off list
  (`CHIP_SIGNED_OFF`) is exactly the moments and interface sounds there are.
  The kit is on no screen yet; the round screen is (in play, off a phone), and
  the smoke journeys reach the top bar's controls through `t.chrome()` /
  `t.menuItem()`, which open the Esc list where the round screen hides the bar
  (17 October 2026). On a phone the journeys tap the Swing Meter's bar (there
  is no Swing button), and reach Tools through the menu list;
  the 44 px thumb check covers the new pieces. All 37 journeys pass on the
  real GPU (17 October 2026, overnight; again on 18 October 2026, in 13 small
  batches, after the hidden old interface was removed).
- **Outside the game** -- `bridge` (the launch-monitor bridge), `diagnostic`
  (Report a problem), `sound`.

`tests/meshy-run.test.mjs` runs tools/meshy-run.mjs against a small stand-in for
Meshy, so it spends no credits: pictures, approving one, a model built only from
it, a stopped run not paying twice, a swapped picture refused, the key never
reaching a download or a file, and converting only what has its model and far version. The Blender steps
are not run by any test. It also holds the redwood pack to every shipped model, no broken tops and a cartoon picture prompt in the game's colours. No test
touches the real API.

## The smoke journeys

`tools/smoke.mjs` plays the built file in Chromium and fails on any uncaught
error, `console.error` or network request; a failed journey leaves a
screenshot in `bench/shots/smoke/`. `--only a,b` runs some; `--software` runs
without the graphics card (much slower; it once crashed this machine -- ask).
`--endless-seed HARROW-4021` makes every fresh Endless run take that seed
(the game's `lab.pinRun`; the journeys still press Start an endless run), so
a run that failed can be played again on the same holes; the journey checks
the run really is on it (the map names the course, the run's seed and the
hole's number: `HARROW-4021-1`). Replaying HARROW-4021 found the harness
wrong: after an albatross the scorecard comes about 12 s after the banner
and XP checks (4.9 s after a birdie), right on the old 12 s wait, so a holed
putt now waits 30 s for the card, and the journey logs how long it took.

| Journey | What it plays |
| --- | --- |
| `boot` | opens from file:// and reaches the menu |
| `endless-round` | one golfer: clubs, aim, cameras, the Swing Meter, a tee shot, a drop, putting out, the scorecard, the next hole. Logs the course and seed, and the hole's par and its hole-out banner ("BIRDIE! 3 strokes") on every run |
| `surprise-round` | a nine-hole course, every in-round tool opens |
| `mixed-group` | two golfers, one on the monitor and one on the Swing Meter |
| `skins` | a two-golfer skins round starts; chips and the Skins row |
| `relief` | water and out of bounds, through a reload, both rules |
| `profile`, `bag`, `look`, `level-up` | players, bags, looks, levels |
| `challenge`, `challenge-week`, `weekly` | the Challenges screen's seven tabs and 36 cards, closest to the pin to its results with nothing saved as a round, a putting challenge holing out, a range one on the range, a long drive; the challenge of the week from its card to a ball played, nothing saved as a round; `challenge-more`: seven tabs and 36 cards, Every par 3 moving from hole to hole, a head-to-head refused alone and played by two, Bogey-free nine and Sudden death started as real rounds that save; the course of the week |
| `friend-challenge` | a friend's challenge made in Node with the page's version (`window.lab.version`), pasted on Play's card and read, its nine-hole round started, the save remembering it and logging a shot, and the scorecard showing the friend's row. Passed on the real GPU on 20 October 2026, in 16 s |
| `range`, `range-greens`, `studio` (round 13: the settings are the whole-screen sheet with Grow this landscape and no bar, desktop to phone) | the driving range; `range-greens`: Range controls closed and reopened from the view bar, a ball finishing on the 100 target's green, the putt and chip stations on the short-game green, a slope that regrows it and can be read, and the CSV and PDF downloads; Course studio grows a course and saves it through the name box (20 October 2026), and it is listed in Saved courses from the menu |
| (note) `ball-light-hole-out`, 30 October 2026 | On a failure it now writes each late program's switches, and -- run with `--file bench/shots/dist-exp/index.html`, the capture build -- the mesh using it, to bench/shots/smoke/late-shaders.txt. That is what found the pond and the hidden planting first drawn in the hole-out flyover (PROJECT_HANDOFF *EVERY PROGRAM IS DRAWN ONCE BEHIND THE LOADING SCREEN*). |
| `course-pieces-round` (was `architect-round`; renamed 2 November 2026 when Architect went) | A saved generated course (Classic Parkland), with its markings and animals (no clubhouse or paths since 8 November 2026), played from Saved courses: two full shots down hole 1, a drop by the pin, putts to the hole-out, with no error |
| `landscape-map` (the US landscapes goal, 2 November 2026) | Course studio: the map over the landscape pictures, every built US landscape live on it and a globe on every picture; a region pressed picks its landscape, a picture pressed lights its region; pictures of the sheet on a desktop and a phone (bench/shots/smoke/landscape-map*.png) |
| `every-landscape` (the US landscapes goal) | Course studio grows every landscape a player can pick, once each, with no error: the built game has every landscape's record, models and pictures |
| `monitor`, `monitor-phone`, `bridge-bundle`, `server-program` | launch monitor through a pretend bridge, on a phone, and the shipped programs. A bridge that is missing (a bare `vite build` does not bundle it; `npm run build` does) or will not start fails `bridge-bundle` alone and the run goes on (the 1.0 polish: it used to end the run) |
| `menu-panels` | (round 14) the driving range's steps are pressed by name: The range, Golfers |
| (round 14) every journey | `press(name)` goes to an open step sheet's last step first when the button is not on screen -- the start buttons (Start an endless run, Play the course of the week) are on the Golfers step now, as a player would find them |
| `hud-reachable`, `text-size`, `phone-portrait`, `phone-landscape`, `home-screen-hint` | layout from desktop to phone, larger text, a hole by touch (since round 13 the menu journeys on a phone open the 1.0 sheets, laid out for a phone) |
| `no-late-shaders`, `ball-light-shaders`, `ball-light-hole-out`, `floodlit-night`, `no-swallowed-errors`, `sound` | no stalls, no hidden errors, lights and sound |

**What the smoke test does not play:** a whole multi-golfer round to its last
hole, match play, scramble selection, a three- or four-golfer group. The rules
for all of those are covered in Node (above); the screens for them are not.

### The builder's smoke journeys

`tools/builder-smoke.mjs` (`--software` to run it with the graphics card off: slower, and alone, as *smoke --software*) drives Fairway Course Builder's built page
(`dist/builder.html`) the same way and on the same terms: opened by file://,
a fresh page per journey (its save dialog, showSaveFilePicker, hidden so Save
downloads; a journey that tests the dialog puts a stand-in back), and a
journey fails on any uncaught error,
`console.error` or network request; a failure leaves a screenshot in
`bench/shots/builder-smoke/`. Journeys added by later stages register from
`tools/builder-journeys/`. It uses the graphics card (docs/COURSE_BUILDER.md).
`tools/builder-look.mjs <file.fairway> [--hole n] [--heights 15,40,120]` is
for looking, not a check: it opens a course file in the editor and
photographs a hole's green from each height (to `bench/shots/builder-look/`),
printing the close-up sheet's square, texel and redraw time
(COURSE_BUILDER amendment 16, *the close-up sheet*). **Every folding section is opened as it appears** (the builder-ux goal, 10 November 2026): door 2's side panel folds its sections (`details.cb-fold`), and the journeys click buttons inside them as a player would after opening one; a journey that wants them as they start sets `window.fairwayKeepFolds`.

| Journey | What it drives |
| --- | --- |
| `builder-opens` | the builder opens offline on its three doors with its version line; a door opens and Back returns |
| `builder-shaping` | a frozen nine opened from its file; forty raise dabs timed (the model and the view's redraw; fails over 33 ms a dab); one undo for the drag; saved, and the world the game builds from the file has the hill to the centimetre |
| `builder-tools` | every editor tool by its button and the mouse (outline, pond, creek, bunker, plant and clear trees, a green moved, a bunker dug in the open and carried off by Move shape and put back by Undo), Undo, the checks and a test round reporting, saved; each change found in the file read back in Node |
| `builder-door-2` | door 2 end to end in the owner's order (first Find the course: a place found, the map round it shown from a stand-in USGS tile cache, Build it for me and Build it myself waiting until a 1,200 x 900 m box is dragged round the place on it, then Build it myself: every source over the box searched -- the National Map stood in for -- its survey listed with both download buttons and Minnesota's own portal linked; then the trace step also: every layer listed water to rough with empty ones marked, the banner naming the brush, the smooth view drawn after a stroke, semi-rough extrapolated round the fairway, the landscape changed to a links for heather): a LIDAR survey made by the journey (LAS 1.2 with colour, a nine-hole parkland with a pond, bunkers and trees) brought in and the property boxed by a left drag; the land, started by Next: build the land alone (no second press); the place searched for and imagery fetched (both stood in for with `page.route` -- the journey's `t.allow` names those addresses, every other request still fails it), placed; the picture's opacity set, the LIDAR drawn on top as slope; the picture unlocked, dragged 6 m into line, nudged with the arrow keys (a quarter metre, a metre with Shift), locked, and a drag and an arrow after that move nothing; the wheel zooms and the right button drags the view; the auto trace, then a brush stroke, that bunker moved 12 m whole by Move shape (the banner naming it while dragged) and put back by Undo, a fairway painted over that bunker (the bunker stays: layers), the sand layer hidden (the view shows the fairway, the course keeps the bunker), an outline of heather, a tree zone and Undo; nine holes with an aim point; Save from step 4 (a stand-in save dialog: the first Save asks, the second and Ctrl+S write the same file, the bar names the draft), the course renamed and Save asking for a new file, the draft opened again from the start page back at step 5 with its sand, trees and holes; the name; the painted review (the bend in hole 1's line, the surfaces, the imagery's credit); the editor, which lists the same layers and hides one, draws its surfaces finer than its grid (from the outlines), and flies forward on W and down on Q; saved; the built game plays a tee shot on it; since amendment 16 also Ctrl+Shift+Z redoing a tree zone, Clear trees from tees and greens leaving no crown over a green, the scorecard (nine holes and a total, white as blue with one tee, no typed yards, a par and an index set and found in the course), in the editor only a links' own ground types, its sky and round trees, Tree height growing the trees taller and wider at once, Size a tree and This tree sizing one tree twice as tall and Undo putting it back, the view following a resized window, sand painted and a hill raised in 3D, Back to 2D (asking nothing) with both in the trace and the note saying so, and the plan filling its place, the editor again with both, and Close asking twice |
| `builder-door-2-worthington` | **local only** (registered when `FAIRWAY_LIDAR_TEST` names the owner's Worthington folder and bench/shots/lidar/ holds the NAIP tiles, the DEM, the OpenStreetMap extract and the card): door 2 through the page on the real tiles -- the property dragged, four pictures, eighteen holes clicked, traced, saved -- then the file measured by `tools/built-compare.mjs` (ground against USGS's DEM, fails over 5 cm at the median; outlines; lengths; a test round, fails if a hole sticks) and a tee shot played in the game; and the landscape suggested from where the survey lies -- Classic Parkland since the landscapes were pared to fifteen (Heartland before 8 November 2026), chosen unasked. Its holes are clicked where OpenStreetMap puts them, which the owner says is wrong for Worthington (many holes pointing the wrong way): the journey tests the clicking, not the map. The course file goes to the game as base64 (door-generate.mjs `playOneShot`): as an array of numbers it ran the harness out of memory |
| `builder-lidar-folder` | (Back to the start asking twice) door 2's LIDAR folder (a stand-in folder in the page; the National Map, Hobu's Entwine index and USGS's Entwine copy stood in for with `page.route`): the place found as a button, every shown button with a tooltip, Download all tiles offered, the map shown (a stand-in USGS tile cache) and a 1.5 km box dragged round the place on it, Build it myself, the box and 150 m past it downloaded once and kept in the folder as its ZIP, the box the property on the relief (1,495-1,580 m a side in the survey's grid, turned about 1.8 degrees from north), its coverage drawn yellow, door 2 opened again and the square read from the folder with nothing asked of USGS, Load from the folder, its tick box keeping its size, listing it ticked |
| `builder-door-2-osm` | door 2 from OpenStreetMap: the made-up survey, the place searched for and OpenStreetMap fetched (both stood in for with `page.route`), its surfaces laid where it draws them, its nine numbered holes set with hole 1 on its green and the map's par kept, a second course at the club picked by the Course choice with its own hole 1 and picked back, its course boundary and a building (as a house) taken, whose trees three ways (the survey's with the map's one in the open, the map's only, the survey's only), the outside of the boundary filled keeping the map's pond and house there, undone, and filled removing them, its nine numbered holes set as markers, credited, the trees choice inside the steps' column; kept as drawn; reviewed; in the editor the house drawn, one refused on the fairway, one stood on the rough by the House tool and undone; saved, and the game plays a tee shot |
| `builder-door-1` | door 1 end to end: grow a nine, take it over, raise the ground with a drag and paint sand (two undo steps), undo and redo, save the file; the built game opens it (lab.built) and a tee shot is played on it with the Swing Meter |

The builder's file format is tested in Node: `tests/zip.test.mjs` (the
container, its CRC, the same bytes for the same parts, a damaged file refused,
and Python's zipfile reading what it writes) and `tests/course-doc.test.mjs`
(heights to the centimetre, relief over 655 m, a built course round-tripped,
the same course making the same file, broken files refused in plain words).

A world from a built file: `tests/built-world.test.mjs` ((tests/stands.test.mjs: every landscape has stands now, and the Redwood Coast alone grows no long grass, on purpose) a surveyed tree draws in the landscape's shares among the species of its height, palms and conifers included (on Desert Palms' planting, kept as a fixture on Desert Resort's record since Desert Palms left, 7 November 2026), its narrow reading ignored, and the 3D editor's shape follows the same species; a hand-made document's lie
in the generator's order, field edges to a few centimetres, a patch fading
into the land, holes from records, trees keeping their sizes in any
landscape, the field's ground codes equal to ground.js's, and since the US
landscapes goal the same file on every one of the forty landscapes, each
stored tree drawn from that landscape's own planting), `tests/freeze.test.mjs`
(a generated nine with a creek and a lake, frozen, written, read and rebuilt:
surfaces over 99% the same at every 3 m, the ground within 1 cm at the 95th
percentile and greens within 0.5 cm at the median, every hole's par, tees,
green and length, the trees and their species, the world contract) and
`tests/contour.test.mjs` (outlines from a mask). The trees placed for the player: `tests/builder-tree-plan.test.mjs`. Reopening with everything: `tests/builder-reopen.test.mjs` (a course file's builder's section: the game neither unpacks nor keeps it, and the same course keeps its hash; a draft's pictures, map download and place; the editor's work added without touching the session; an older file's place and trees; a version 2 draft). Pins per round: `tests/built-pins.test.mjs` (and since BUILT_VERSION 2, greens stored as one set of outlines still cutting each hole's cup on its own green, a practice green beside it). Layers: `tests/layers.test.mjs` (the game's order, the topmost shown, a hidden layer kept in the course, a composite split into layers, a mask tidied), with a layers test each in `tests/trace-edit.test.mjs` and `tests/builder-editing.test.mjs` (a fairway painted through a bunker keeps it; erasing one layer shows the one under; saved as overlapping outlines). Door 2's manual trace: `tests/trace-edit.test.mjs` (brush, outline with an island, smoothing a sawtooth edge and its pocks, tidy, trees one at a time and by zone, undo and redo; extrapolating a layer under and over another; filling outside a boundary; houses one at a time, by zone and cleared); `tests/layers.test.mjs` also the layers each landscape offers; `tests/osm.test.mjs` also the course boundary joined from a relation, a building as a house, and whose trees (merged within 6 m, or either alone); `tests/trace-edit.test.mjs` also filling outside keeping what is there and every tree replaced at once; `tests/built-world.test.mjs` and `tests/course-doc.test.mjs` the houses a file stores, stood the same every time and dropped when broken. OpenStreetMap: `tests/osm.test.mjs` (an Overpass answer read into local metres and laid as layers, a cart path, a wood and a tree, a hole line drawn green-first turned round; the query; a busy server said so). Imagery: `tests/imagery.test.mjs` (Web Mercator both ways, Bing's quadkey, the zoom for a course, Google's and Bing's session and tile addresses and the free providers', against a fake fetch; the map shown before the LIDAR, a box drawn on it the size it was drawn in degrees and back). Door 2: `tests/real-course.test.mjs` (a picture lined up from matched points, and by its position; a second tile filling only the first's gaps; land, trace and marks made into a course the game's world accepts -- a pond carved below its level, a tree on a green dropped, a narrow tree a conifer) and `tests/lidar-trace.test.mjs` (a hand-made hole: each surface found by the LIDAR, by the picture and by both; the picture's sand used where the survey has no laser brightness, the LIDAR's where the picture has a gap; nothing traced under a tree or with no hole marked). `tools/imagery-bench.mjs --refine` damages OpenStreetMap (osm-holes.mjs `damageTruth`: every outline 4 m off, every other green and bunker left out) and scores what `refineTrace` recovers from the picture; `tools/real-course.mjs --refine [--damage x,z]` does the same on Worthington from its LIDAR and its picture; both score against OpenStreetMap lined up with the place first (`lineUpTruth`; `--raw` for the map as it lies); `tools/imagery-bench.mjs` scores the auto trace from the picture alone, before any hole is marked, on a real course for each landscape (local data from `tools/imagery-fetch.mjs`; RESEARCH, *The auto trace from the picture, iteration by iteration*), and `tools/trace-bench.mjs` scores the trace on every landscape and `tools/real-course.mjs` on Worthington (docs/COURSE_BUILDER.md, stages 7-8) -- or with `--course <key>` on any imagery-bench course whose survey is in bench/lidar (its picture and OpenStreetMap from bench/shots/imagery; no course file without a card); `tools/lidar-bench.mjs [--study]` scores the auto trace from the LIDAR alone, before any hole is marked, on all nine courses against OpenStreetMap lined up with the laser (the land built once a course at 1 m and cached), and with --study prints what each mapped surface is like to the laser. LIDAR: `tests/lidar-readers.test.mjs` (every open form written small and read back; the land gridded, classified and filtered; the real Worthington LAZ when its survey is in bench/lidar/worthington or `FAIRWAY_LIDAR_TEST` names it, and the owner's three Washington State Plane surveys placed at their courses, else skipped); `tests/lidar-geo.test.mjs` (Lambert conformal conic and transverse Mercator from a WKT against IOGP 7-2's worked examples, Washington South in US feet, UTM both ways, a grid not worked refused); `tests/lidar-ept.test.mjs` (the Entwine nodes over a box through a hierarchy split over files; Web Mercator both ways); `tests/lidar-search.test.mjs` (the sources over a place, state portals included; the National Map's tiles grouped into surveys with their Entwine copies and rockyweb tiles; IGN's tiles by mission -- a fake fetch); `tests/lidar-folder.test.mjs` (the LIDAR folder against a fake one: a file written and found whole, listed one folder down; a USGS square downloaded once and read back as its ZIP with no request, the same points; an IGN tile already kept not downloaded; which files lie over the place; swisstopo's grid by name); `tests/real-course.test.mjs` also where the files reach (step 1's yellow); `tests/builder-tips.test.mjs` (every fixed button label in the builder's source has a tooltip); `tests/osm-course.test.mjs` (a club's two courses each its own holes, the map's par kept, a number claimed twice reported; two courses in one boundary told apart by their hole lines' `golf:course:name` (Troon North); numbered greens given tees by the best pairing over all, a scorecard settling it; the Hungarian pairing; holes moved with the map, put on their green, given the tee boxes along their line, a back tee behind the map's); `tools/build-courses.mjs` builds every course in bench/lidar as door 2 does and writes a report (each hole's par, yards, whether it sits on its green and tees, the walk from the green before; the test round) with a plan picture, and `tools/play-built.mjs` opens each in the built game and plays a tee shot -- both by hand, not in npm test (their data is local); `tests/round-trip.test.mjs` (outlines filled onto a grid; a course made from a trace, edited in the editor -- a bunker, a hill, a tee moved, a par set, a tree planted, a house -- taken back to the trace and made again with all of them, the layers the editor did not touch exactly as traced, and nothing left to carry the second time); `tests/builder-draft.test.mjs` also a version 2 draft keeping the 3D editor's shaping and creeks; `tests/tree-clear.test.mjs` (crowns drawn in off a green, a tree with no room taken out; the editor's clearing as one undo, measured at its tree height scale, and that scale saved with the crowns; one tree sized from what it was when picked, the whole scale on top, one undo; a hole's yards along its line with a bend skipped, equal to the game's hole; door 2's par from the yards along a dogleg); `tests/bridge.test.mjs` also the bridge's `/lidar` route (USGS hosts only, local pages only, the private-network preflight); `tools/lidar-search.mjs` downloads a real square through the builder's code and compares its ground with the same survey's tiles in bench/lidar (Worthington: 0.1 cm at the 95th percentile); `tools/lidar-compare.mjs --data <folder> [--dem <usgs.tif>]` measures a real course. Saving: `tests/builder-saving.test.mjs` (one click to the same file, a new file for a new name or other work, a download where the browser has no save dialog) and `tests/builder-draft.test.mjs` (a door 2 draft written and read back -- land, layers, trees, houses, holes, OpenStreetMap's trace, the step; a course file or a newer draft refused). The editor: `tests/builder-editing.test.mjs` (houses stood on open ground and refused on turf, cleared, undone, written back; a bunker, a tree and a house moved and undone; every brush, paint and fill, a drag as one undo, undo and redo, records, the document given back plays what was edited) and `tests/builder-checks.test.mjs` (each check found on a course built to break it). `tools/freeze-compare.mjs`
measures every landscape and plays eight virtual golfers on both;
`tools/freeze-capture.mjs` photographs both in the built game (graphics card);
`node tools/profile.mjs --only built` times both on Low; `--built-file <x.fairway>` times that file (a real course from door 2) against a generated Midwest eighteen instead.

## Checked only by a person

Kept current in TODO.md, *The owner's hands-on checks*: a real launch monitor
through the bridge, the iPhone launch monitor, the server program on a Mac and
Linux, a real phone's frame rate, Safari and Firefox, and how anything looks.
A feature nobody has seen working is reported as not seen (AGENTS.md).

## Adding a test

- **A new game rule goes in its own module with a Node test** (AGENTS.md);
  `main.js` only wires it in. That is what makes the round matrix possible.
- **Make sure it can fail**: run it once against the code before the fix. A
  test that cannot fail has happened here more than once (RESEARCH.md, *A test
  that could not fail*).
- **A measurement imports its geometry from `src`**, never a copy of it.
- **Slow suites** are the ones that build courses; reuse `tests/worlds.mjs`,
  and build many with `measured` (*Running the Node tests*). Run
  `npm run test:times` after adding a heavy file, so it is started early.
