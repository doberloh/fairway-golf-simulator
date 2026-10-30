# Architect courses

Branch `architect-courses`, begun 30 October 2026 from main at 239fbfb
(generator 52, schema 11), under the owner's goal to build the whole local
study `docs/studies/HUMAN_BUILT_COURSES_SPEC.md` (not committed; pass 9),
phases 0 to 7 in order. **This page is the committed record: what was built,
the decisions taken, what was rejected, where the build departed from the
study, and the GPU and Blender logs. Read it first whenever the work resumes.**

The aim: a second way to build a course. **Classic** is the generator Fairway
has always had, every course grown from the studio's sliders, and it stays the
default and never changes. **Architect (beta)** designs a course the way people
build one -- a plan for every hole, every hazard placed against the shots
golfers play, greens designed round their hole locations, holes routed from a
clubhouse, then paths, stakes, walls, a history and some life -- from four
dials (style, club, age, the land's story), the seed, the landscape and the
number of holes.

## Status

| Phase | State |
| --- | --- |
| 0. The switch | built: the `designer` setting and the four dials, `ARCHITECT_VERSION` and the per-course stamp, saves, codes, files and challenge codes, the studio, a fingerprint per designer, the baselines; Architect builds exactly what Classic builds at its defaults |
| 1. Purpose | not started |
| 2. People | not started |
| 3. The field | not started |
| 4. Home | not started |
| 5. Built | not started |
| 6. Story | not started |
| 7. Occasion | not started |

## The owner's decisions (the goal text, 30 October 2026)

- Name "Architect", an option labelled beta. **Classic always exists and stays
  the default.**
- Classic gets only the free extras -- flags coloured by pin position, hole
  names, a crest -- and its ground fingerprint never changes; an extra that
  would move it stays out of Classic, with the reason written here.
- An Architect course is chosen by style, club, age, story and seed; landscape
  and 9/18 holes stay; wind and pin day stay round conditions. The architect
  decides everything else -- length, elevation, bunkers, trees, houses, water.
- Surprise me, the course of the week, the Challenge Course and endless runs
  stay Classic.
- Architect plays at most **1.5 strokes per 18** harder than Classic for the
  virtual golfer.
- Walls, buildings and stands are solid: a capsule or box in the one collision
  index. Rulings as the study's table.
- Island water stays on the coast. Animals and distant people, calm, none on
  Low. Tournament dressing on Championship venues only. Haunted Hollow: ruins
  and lanterns, never graves.
- All twelve styles; Golden Age, Links and Parkland first.
- GPU and CPU free to use without asking, when the computer is free; the card
  read first, a busy card waited out; a crash pauses GPU work, a second ends it.
- Every Blender asset at least ten iterations, logged here.
- The showcase is local and short (about thirty pictures); the rest is for the
  owner to find in the game.
- No merge, push or release.

## Decisions taken from the study

Each is the study's recommendation, taken because the owner's goal said to
choose by it.

- **One pipeline with a switch at each decision, not a copied generator.**
  The study's reason holds: a copy means every terrain, water and speed fix
  made twice, and drift. Where the designers differ is a named seam
  (PROJECT_HANDOFF *TWO DESIGNERS, ONE WORLD*).
- **Architect's random numbers are its own** -- named streams per step and per
  hole (`seed|arch|<what>|<hole>`), never Classic's stream.
- **Phase 0 builds an Architect identical to Classic** at its defaults, so the
  plumbing is proven before any decision changes.

## Built

### Phase 0: the switch (30 October 2026)

- **The settings** (settings-schema.js): `designer` (Classic, Architect (beta);
  default Classic) and the dials `archStyle` (By landscape or one of twelve),
  `archClub` (Municipal, Members' club, Resort, Championship venue), `archAge`
  (New, Mature, Old, Restored) and `archStory` (None, A little, A lot), in a new
  studio heading, *Architect (beta)*. A choice field may carry `names`, the
  words a player reads; the values are what saves carry. SCHEMA_VERSION 12;
  the migration writes nothing, because a save without a designer takes the
  default and so is Classic.
- **What Architect keeps** (`ARCHITECT_KEEPS`): the designer, holes, seed,
  landscape, the four dials, wind, wind direction and pin day. Everything else
  is the architect's (`DECIDED_KEYS`), hidden in the studio and overwritten in
  generation.
- **designer.js** `designSettings`: Classic settings come back as the same
  object, untouched -- which is the guarantee that Classic cannot move;
  Architect settings get the architect's values for every decided key. It is
  idempotent and called at every entry into generation (`planCourse`,
  `planScorecard`, `generateCourse`, `routeHoles`, `generateWorldSteps`).
  `designerScope` drops the decided keys from what a saved course or a code
  carries: they are recomputed on load.
- **architect-styles.js**: the twelve styles as records, the styles each
  landscape leans toward (`BIOME_STYLES`, the study's landscape table), the
  fallback for a landscape without a row, and `styleOf` (By landscape draws
  from the seed on its own stream). `architectChoices` is phase 0's: Classic's
  defaults.
- **The version stamp.** `ARCHITECT_VERSION` = 1. A course keeps one integer,
  `generator`, as it always has: Classic's is `GENERATOR_VERSION`, Architect's
  `GENERATOR_VERSION*1000 + ARCHITECT_VERSION` (`generatorFor`). Saves, saved
  courses, course files, course codes, challenge codes, the diagnostic report
  and the world cache key all use it; the stale-course notices compare a
  record's stamp with `generatorFor` its own settings.
- **The fingerprint** learned `--designer architect`, with its own store
  (`bench/biome-fingerprints-architect.json`); Architect's two seeds vary the
  dials (defaults; championship, old, a lot). Classic's check unchanged.
- **The studio** shows each designer its own controls (`shownFor`), keeps the
  scorecard for an Architect course without its length controls ("The
  architect sets the length from the style and the club"), and redraws when
  the designer changes.
- Tests: tests/designer.test.mjs.

## Rejected

- **A second field for Architect's version** in every record (`architect: n`
  beside `generator`), the study's first plan. Every reader of a save, a
  course, a file, a course code and a challenge code checks
  `Number.isInteger(generator)`; a second field meant teaching all of them and
  every format. One integer stamp per course says the same thing and leaves a
  Classic record byte-for-byte what it was.
- **Resolving the architect's settings once in main.js** (`settleSettings`).
  The scorecard, the course pictures and the tools call the generator without
  main.js, so each would have had to remember; resolving at every entry, and
  idempotently, cannot be forgotten.

## Deviations from the study

- **The version stamp** (above): one integer, not a second field.
- **Bridge decks** (study, *Collisions*: "a height override in its footprint").
  IDEAS.md's *Bridges over creeks* recorded that a height override was tried
  and removed -- a ball flying under the deck landed on it. A bridge is built
  as a solid with an underside instead (phase 2).

## Measures

### Baselines (Classic, 30 October 2026, before any change)

- **The wait to build an 18-hole course** (`tools/gen-time.mjs`, Node, three
  seeds, median): PNW 4.51 s, Desert 4.92, Mountain 4.44, Links 4.45,
  Midwest 4.15, Island 6.70, Redwood 3.32, Autumn 4.71, Haunted 3.59,
  Lakeshore 3.40. The goal's limit: Architect at most 2 s more in each.
- **The bench** (standard tier): 231 bunkers on 108 holes; Classic's
  placement is the baseline the landing-zone measure has to beat (phase 1).
- **The fingerprints**: Classic unchanged at generator 52; Architect stored at
  52 / architect 1.

## GPU run log

Every run reads `nvidia-smi` first (the goal: wait if a game runs or the card
is above about 30%).

| When | What | Card before | Result |
| --- | --- | --- | --- |
| 30 Oct, phase 0 | smoke `architect-studio`, `studio` | 4%, 38 °C, no game | studio passed; architect-studio failed -- the dials are on their own tab of the sheet, which the journey had not opened (the harness, not the game) |
| 30 Oct, phase 0 | smoke `architect-studio` (journey fixed; the designer moved to the head of Course) | 4%, 39 °C | passed |

## Blender iteration log

None yet.
