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
one to four** -- 27 challenges, six seeds each, 648 plays and over 5,000 balls
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
  `challenge-spots`, `weekly`, `player-colours`, `bag`.
- **The ball** -- `core` (flight), `low-spin`, `landing`, `spin-back`, `skid`,
  `firmness`, `refinement`, `green-refinement`, `cup`, `rim`, `pins`,
  `obstacle-collision`, `solid-colliders`, `homes`, `swing-meter`,
  `dispersion`, `plays-like`, `aim-preview`, `range`, `lab`.
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
| `challenge`, `weekly` | the Challenges screen's five tabs and 27 cards, closest to the pin to its results with nothing saved as a round, a putting challenge holing out, a range one on the range, a long drive; the course of the week |
| `range`, `studio` | the driving range; Course studio grows and saves a course |
| `monitor`, `monitor-phone`, `bridge-bundle`, `server-program` | launch monitor through a pretend bridge, on a phone, and the shipped programs |
| `hud-reachable`, `text-size`, `phone-portrait`, `phone-landscape`, `home-screen-hint` | layout from desktop to phone, larger text, a hole by touch |
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
