# Testing Fairway

What is checked, by what, and what nobody checks but a person. Written 16
October 2026; keep it true when a suite or a smoke journey is added, removed or
changes what it covers.

## Four layers, and what each can see

| Layer | Command | Runs on | What it can see | What it cannot |
| --- | --- | --- | --- | --- |
| **Node tests** | `npm test` | the processor, about 3-4 minutes | the rules, the ball, the generator, saves -- every pure module | anything `main.js` wires up, anything drawn |
| **Generator checks** | `node tools/biome-fingerprint.mjs --check`, `node tools/bench.mjs --tier quick` | the processor, seconds | whether generated ground moved; course invariants that must be zero | how a course looks |
| **Smoke test** | `npm run smoke` | **the graphics card**, about 5 minutes for all | the built single file in a real browser: buttons, panels, journeys a player takes, any error or network request | whether it LOOKS right; real phones, real monitors |
| **Frame profile** | `npm run profile` | **the graphics card**, minutes at full load | what a frame costs | correctness |

**The graphics card rule** (AGENTS.md): the smoke test and the profile run only
when the owner asks in that turn, and never while `nvidia-smi` shows the card
busy. The Node tests and generator checks can run any time.

**GitHub** runs `npm test`, the ground check, and three smoke journeys (`boot`,
`range`, `endless-round`) under a software renderer on every push
(`.github/workflows/test.yml`). The smoke step there is slow and has not yet
gone green reliably -- TODO, *Found on GitHub*.

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
and seed, so it can be replayed exactly.

| Format | 1 golfer | 2 | 3 | 4 | Teams | Endless |
| --- | --- | --- | --- | --- | --- | --- |
| Stroke play | yes | yes | yes | yes | all on one side, and split | yes |
| Match play | refused | 1 v 1 | 2 v 1, 1 v 2 | every split, 1 v 3 to 3 v 1 | every split with both sides | refused |
| Scramble | yes | yes | yes | yes | every split, one team of four included | yes |
| Skins | refused | yes | yes | yes | all on one side, and split | yes |
| Stroke with a goal | Sudden death (endless) and Bogey-free nine, 1-4 golfers, golfers coming and going; the goal checked after every hole and through saves |  |  |  |  |  |

Each under all three putting modes (hole out, dartboard, decimal), both
out-of-bounds rules, over 3 holes, then 9 and 18 with group changes.

**A new format cannot skip it.** The formats are listed once, `FORMATS` in
`src/game.js`, which the round, the save import and this suite all read. The
suite's first test fails if `FORMATS` holds a format its scorer does not play
(its `PLAYED` table), so adding one means teaching the scorer that format's
rules -- AGENTS.md, *Game rules live in pure modules with Node tests*.

Other round suites pin one behaviour each with a hand-written card:
`core` (formats finish, scramble penalties), `play` (putting modes, mulligans,
sim drops), `honours` (playing order, golfers added, removed and reordered),
`relief` (water and out of bounds under the Rules), `skins`, `mixed-groups`
(monitor and Swing Meter golfers together), `endless`, `round-library` and
`course-library` (saving), `weekly`, `challenges`.

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
Course and the real range: slopes, rough, water, trees, the cup. Each
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
the courses several suites share.

- **A round and its records** -- `round-matrix`, `core`, `play`, `honours`,
  `relief`, `skins`, `mixed-groups`, `endless`, `round-library`,
  `course-library`, `scoring`, `handicap`, `profile`, `progression`, `rewards`,
  `achievements`, `challenges`, `challenge-play`, `challenge-matrix`,
  `challenge-spots`, `challenge-week`, `challenge-virtual`, `weekly`, `player-colours`, `bag`,
  `range-report` (the range's CSV and PDF: the numbers, and a PDF a reader accepts).
- **The ball** -- `core` (flight), `low-spin`, `landing`, `spin-back`, `skid`,
  `firmness`, `refinement`, `green-refinement`, `cup`, `rim`, `pins`,
  `obstacle-collision`, `solid-colliders`, `homes`, `swing-meter`,
  `dispersion`, `plays-like`, `aim-preview`, `range` (every green, the aim
  arc, slopes, cups, chip and putt spots), `lab`.
- **Making a course** -- `world`, `landscape`, `landscape-edge`,
  `course-variety`, `course-living`, `course-names`, `atmosphere-routing`,
  `exotic-shapes`, `fairway-features`, `green-*`, `bunker-ground`,
  `tee-corridor`, `water-*`, `waterways-tours`, `vegetation-variety`,
  `generation-steps`, `parallel-ground`, `settings-schema`, `haunted-props`.
- **Drawing, by structure only** (no test loads `renderer.js`) --
  `ground-shader-structure`, `green-cue-wiring`, `glsl-reserved`,
  `three-namespace`, `flood-shadows`, `instance-cull`, `occlusion`, `clouds`,
  `mist`, `daylight`, `floodlights`, `haunts`, `distant-flags`,
  `auto-resolution`, `ui-scale`, `roll-hop`.
- **Cameras and maps** -- `camera-flight`, `approach-camera`, `tv-camera`,
  `projector`, `course-map`, `green-map`, `shot-views`, `shot-data`.
- **The capture tools** -- `capture-mux` (the MP4 and WebM files the clip
  recorder writes hold together: boxes and elements fill the file, the frame
  tables name every frame, key frames marked; docs/CAPTURE.md). Whether a clip
  plays is checked in a browser at the end of every recording.
- **The 1.0 interface** (branch `ui-1-0`, from phase 0) -- `ui-layout` (the
  canvas for 16:9, 16:10, 4:3 and 21:9, the bands, the leaning sheet's corners
  on the 60 px margins at every height, columns that never overlap, the canvas
  filling the screen at every Text size and its 1024 floor), `ui-palette`
  (every biome has a complete palette and no two share one, readable text over
  a light and a dark picture, which biome each screen wears, the menus
  following the week), `ui-kit` (every class `uk-` and every rule scoped to
  `.uk`, no colour on a straightening wrapper, the stylesheet's sizes match the
  rules, the two font files are local woff2 with their licence, text escaped).
  `round-hud` (phase 1: what the round screen's pieces say -- hole slab, conditions,
  club, scores with a real minus, golfer cards, keys, the ball light -- and
  how large they are drawn: the club panel and the meter, and the slab and the
  cards, never meet at any tested size or Text size).
  `shot-moments` (phase 2: the card on a course and tiles on the range, the
  player's choice and Tab winning, a putt popping no card, the card's hold and
  fade, the range's eight tiles being real fields, the choice kept per device;
  birdie or better earning the band, every banner under two seconds with the
  next turn announced as it leaves, the paper card's marks), and `round-hud`'s
  round-complete helpers (places with ties, XP this round, the handicap line).
  Round 14: the reachability and thumb checks skip a select under a 1.0
  drop-down (`.dd-native`: its field is the control) and measure the whole
  club box (`.club-control`, which opens the bag) rather than `#club`.
  On a big screen the flight check now expects no flight panel, Skip in the
  meter's title (`#smSkip`) and the launch strip; the range journey opens
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
  has a tile). `ui-monitor-setup` (the setup screen's steps tick in order
  and never ahead of the bridge, the ball light's words match the round
  screen's, the last shot in mph, degrees and rpm). `ui-profile-hub` (every
  heading the old profile page writes has a hub tab; the overview's eight
  numbers and their dashes). The `profile`, `bag`, `look` and `level-up`
  journeys press the hub's Locker, Bag and History tabs before reaching in.
  `ui-settings` (the category list opens known sheets and holds every
  settings screen). `ui-studio` (what counts as a changed studio setting, how
  a change reads, and the schema reading clean against itself).
  `ui-range-controls` (the range window's session table reads the report's
  club table: balls, average carry, spread). `ui-dropdown` (round 14: the 1.0 drop-down's rows -- groups, locked choices, notes -- and its cursor). `model-framing` (round 14: the tiny course models -- five landscapes x four
  box shapes, the box always full of ground and every tee and green in view at
  both ends of the sway; each landscape's trees; the same course, the same
  model). `course-picture` (a course's
  picture lays out every hole, the same course the same way, fills its frame
  and draws inside it). `endless` also checks a run pinned to a landscape (every hole in it, the
  plain seed unchanged). `round-tees` (each golfer starts from their own tee,
  falls back to the round's, joins at their own, and keeps it through a save).
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

## The smoke journeys

`tools/smoke.mjs` plays the built file in Chromium and fails on any uncaught
error, `console.error` or network request; a failed journey leaves a
screenshot in `bench/shots/smoke/`. `--only a,b` runs some; `--software` runs
without the graphics card (much slower; it once crashed this machine -- ask).

| Journey | What it plays |
| --- | --- |
| `boot` | opens from file:// and reaches the menu |
| `endless-round` | one golfer: clubs, aim, cameras, the Swing Meter, a tee shot, a drop, putting out, the scorecard, the next hole |
| `surprise-round` | a nine-hole course, every in-round tool opens |
| `mixed-group` | two golfers, one on the monitor and one on the Swing Meter |
| `skins` | a two-golfer skins round starts; chips and the Skins row |
| `relief` | water and out of bounds, through a reload, both rules |
| `profile`, `bag`, `look`, `level-up` | players, bags, looks, levels |
| `challenge`, `challenge-week`, `weekly` | the Challenges screen's seven tabs and 36 cards, closest to the pin to its results with nothing saved as a round, a putting challenge holing out, a range one on the range, a long drive; the challenge of the week from its card to a ball played, nothing saved as a round; `challenge-more`: seven tabs and 36 cards, Every par 3 moving from hole to hole, a head-to-head refused alone and played by two, Bogey-free nine and Sudden death started as real rounds that save; the course of the week |
| `range`, `range-greens`, `studio` (round 13: the settings are the whole-screen sheet with Grow this landscape and no bar, desktop to phone) | the driving range; `range-greens`: Range controls closed and reopened from the view bar, a ball finishing on the 100 target's green, the putt and chip stations on the short-game green, a slope that regrows it and can be read, and the CSV and PDF downloads; Course studio grows and saves a course |
| `monitor`, `monitor-phone`, `bridge-bundle`, `server-program` | launch monitor through a pretend bridge, on a phone, and the shipped programs |
| `menu-panels` | (round 14) the driving range's steps are pressed by name: The range, Golfers |
| (round 14) every journey | `press(name)` goes to an open step sheet's last step first when the button is not on screen -- the start buttons (Start an endless run, Play the course of the week) are on the Golfers step now, as a player would find them |
| `hud-reachable`, `text-size`, `phone-portrait`, `phone-landscape`, `home-screen-hint` | layout from desktop to phone, larger text, a hole by touch (since round 13 the menu journeys on a phone open the 1.0 sheets, laid out for a phone) |
| `no-late-shaders`, `ball-light-shaders`, `ball-light-hole-out`, `floodlit-night`, `no-swallowed-errors`, `sound` | no stalls, no hidden errors, lights and sound |

**What the smoke test does not play:** a whole multi-golfer round to its last
hole, match play, scramble selection, a three- or four-golfer group. The rules
for all of those are covered in Node (above); the screens for them are not.

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
- **Slow suites** are the ones that build courses; reuse `tests/worlds.mjs`.
  The suite's wall time is set by its slowest file (TODO, *The test suite's
  wall time*).
