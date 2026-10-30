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
| 1. Purpose | built: the golfer table, the styles, clubs and ages as settings, a plan per hole with every hazard placed against a shot and its reason recorded, templates, fairways that swell, neck and tuck, greens that drain off a corner, the hole sequence, the tree line, avenues and dogleg corners. Deferred: greens turned to the approach (phase 3; *Deviations*) |
| 2. People | first half built: cart paths with bridges and free relief; hole names, flags by pin position and the crest for both designers; an Architect course's founding and the architect's note. Still to come: stakes and posts, a clubhouse, the colliders they need |
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

### Phase 1: purpose (30 October 2026)

ARCHITECT_VERSION 2. Classic's fingerprint unchanged throughout.

- **The golfer table** (`tools/golfer-table.mjs` -> `src/golfer-table.js`):
  three golfers flown once through the ball model. Drives of 277, 224 and
  195 yd in total (RESEARCH *Architect courses: designing a hole*).
- **The dials as settings** (architect-styles.js `architectChoices`): each
  style's settings and its architect's own figures (`arch`: share of bunkers
  at the drive, bunker size, centreline and cross-bunker chances, template
  chance, concept weights); the club's length (6,250 to 7,250 yd for
  eighteen) and multipliers; the age's trees; the story's creek. Each style's
  bunker count was lowered once after the first count came out at 72-110 a
  course against a real 49-66 (now 44-80; Links about 107, as the Old Course's
  112).
- **The plan per hole** (architect.js `designHole`, through the seam
  `architectCourse` in course.js): a concept and, by the style's chance, a
  template; the preferred side; the landing zones from the golfer table; water
  first (a cape, a heroic carry, a go-for-it second, a par three's short side,
  a bail-out's price), then the drive bunkers, the lay-up's cross bunkers, the
  green's guard -- the front corner on the wrong side always -- and the
  templates' own sand. Every hazard records its reason; at most twelve a hole
  (the shader's limit). A heroic hole or a Cape needs water to carry, so
  without inland water neither is chosen.
- **The fairway** swells at the landing zones, necks before the green, and
  tucks round a bunker on its edge (a collar of 2.2 m of rough between turf and
  sand); a centreline bunker is not tucked (PROJECT_HANDOFF, the trap under
  *TWO DESIGNERS, ONE WORLD*).
- **The green** (course-plan.js `greenRecipe`, the seam): drains off a front
  corner, higher at the back; a Redan falls away on a diagonal; a Biarritz
  gets its swale; a punchbowl is sunken; a double plateau is tiered.
- **The sequence** (architect.js `sequenceCourse`, in `planCourse` so the card
  holds): a gentle opener, a strong finish, a short par four on the back nine,
  the par threes spread across their band.
- **The trees**: the open scatter cleared to a scalloped line instead of a fade
  of chance; avenues on Parkland, Golden Age and Raynor courses (more the
  older the course); a cluster at a dogleg's inside corner
  (architect.js `designedPlanting`).
- **The bench** learned `design` (tools/metrics.mjs): drive bunkers by a
  landing zone, green-to-tee walks, returning nines, concept and template
  variety, and the invariant *hazardWithoutReason*.
- **The surface map** tool takes `--set key=value`, so it draws Architect
  courses.
- Tests: tests/architect.test.mjs.

### Phase 2: people, first half (30 October 2026)

ARCHITECT_VERSION 3. Classic's fingerprint unchanged.

- **Cart paths** (paths.js; absorbs IDEAS *Cart paths*): one path a course,
  down each hole on its bail-out side 14 m past the rough, round the hole's
  hazards, past the green to a pull-off and behind it, then straight on to the
  next tee; smoothed twice; pushed sideways off greens, tees, sand and water;
  2.1-3.0 m wide by club; made of asphalt, bark, granite, shell, gravel or
  boardwalk by landscape. About 4.3 km for nine holes. A new ground type,
  `path` (grounds.js), the hardest surface in play; not natural ground, so
  nothing is planted or built on it. The renderer lays a strip on the same
  polyline. Free relief (relief.js `pathRelief`), taken for the player.
- **Bridges** (absorbs IDEAS *Bridges over creeks*): wherever the path crosses
  a creek or river, a plank deck with rails, drawn procedurally until the
  Blender bridge kit replaces it (phase 2's second half).
- **Free extras for both designers**, read from the built course and never in
  the world, so Classic's fingerprint cannot see them: **flags by pin
  position** (red front, white middle, blue back; course.js `PIN_FLAGS`),
  **hole names** (hole-names.js) in the hole panel, and the **crest**
  (crest.js) on the final scorecard.
- **Architect only**: the founding year and made-up architect (crest.js
  `courseIdentity`) on the final scorecard; the architect's note said as each
  hole is arrived at (main.js `architectNote`).
- Tests: tests/paths.test.mjs, tests/hole-names.test.mjs; smoke unchanged
  (no journey plays a ball onto a path).

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

- **Bunkers placed before the water** (phase 1's first order). The ponds were
  then refused wherever a bunker already stood -- a Modern course, water 60%,
  came out with one pond in eighteen holes. Water is placed first and the sand
  round it.
- **Classic's pond code reused for Architect** by refactoring it into a
  function both call. It would have touched Classic's draws; Architect has its
  own `pondAt` with the same shapes and refusals instead.

## Deviations from the study

- **Greens turned to the approach** (the study, workstream A) is deferred to
  phase 3. A green's outline is an oval aligned to the hole in the shader's
  hole table; turning it needs a rotation the shader does not read, which is
  the surface field's job. Phase 1 turns what the green does instead -- its
  drainage, the Redan's fall.
- **The study's "golfer simulated or tabled"**: tabled, as the study's pass 4
  said, from three golfers; the "course built for your game" idea would add a
  fourth from the player's own shots.
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

### Phase 1 (30 October 2026, ARCHITECT_VERSION 2)

- **How much harder** (`tools/architect-difficulty.mjs --seeds 3`: ten
  landscapes, three seeds, a steady and a looser virtual golfer, eighteen
  holes, 60 rounds a designer): Classic 1.98 over par, Architect 1.83 --
  **Architect 0.15 strokes per 18 easier**, inside the owner's limit. By
  landscape (six rounds each, so about ±2 strokes of noise): Island +4.5,
  Mountain +3.8, Haunted +3.3, Autumn +0.8, Links +0.5, Midwest +1.5,
  Lakeshore -2.2, Redwood -4.3, Desert -4.3, PNW -5.2. The three harder
  landscapes are re-measured with more seeds before the goal ends.
  An earlier run, on a build where the bunkers were placed before the water,
  showed one Island round at +73 -- not reproduced on the build after (the
  courses had changed); the tool now names any hole the golfer cannot finish
  in 40 strokes rather than hiding it.
- **The bench** (`design`, standard tier, 12 courses of 9): drive bunkers by a
  landing zone, **175 of 206 (85%) Architect against 24 of 89 (27%)
  Classic**; green-to-tee walks unchanged (median 98 m both; routing is phase
  4); returning nines 6 and 7 of 12; Architect uses 4-6 concepts and 0-4
  templates a nine; no hazard without a reason.
- **Bunkers per 18 holes** (three Midwest seeds a style): Golden Age 62, Raynor
  64, Links 107, Heathland 80, Sandhills 51, Parkland 48, Modern 47, Stadium
  65, Minimalist 52, Desert target 44, Mountain 45, Tropical 55; Classic 42.
  Ponds per 18: none on Links to about 15 on Stadium.

## GPU run log

Every run reads `nvidia-smi` first (the goal: wait if a game runs or the card
is above about 30%).

| When | What | Card before | Result |
| --- | --- | --- | --- |
| 30 Oct, phase 0 | smoke `architect-studio`, `studio` | 4%, 38 °C, no game | studio passed; architect-studio failed -- the dials are on their own tab of the sheet, which the journey had not opened (the harness, not the game) |
| 30 Oct, phase 0 | smoke `architect-studio` (journey fixed; the designer moved to the head of Course) | 4%, 39 °C | passed |
| 30 Oct, phase 2 | capture `arch-p2a`: an Architect Midwest course, four views (overhaul.mjs, `--course designer=architect`) | 6%, 41 °C | built in 13.8 s, no errors; paths, the pull-offs and a white middle flag seen |
| 30 Oct, phase 2 | smoke `architect-studio`, `studio`, `surprise-round`, `hud-reachable`, `no-swallowed-errors` | 6%, 40 °C | 5 of 5 passed |
| 30 Oct, phase 2 | captures `arch-p2b` to `arch-p2h` (seven runs, one at a time): the markings' iterations on Midwest, Links, Desert, Haunted Hollow and Midwest on Low | 4-7%, 39-40 °C each | every course built in 13-18 s with no errors |

## Blender iteration log

The goal asks for at least ten iterations on every asset: render it, judge it
against the cartoon look and its neighbours, revise. An iteration is judged on
the pack's contact sheet (`bench/shots/blender/<pack>.png`) or in the game
(a capture named beside it), and says what changed.

### architect_people (stakes, yardage post, rake)

| # | Judged on | Stake / OB stake | Yardage post | Rake |
| --- | --- | --- | --- | --- |
| 1 | sheet | a 5 cm square timber stake, top two thirds painted, pyramid cap: reads as a stake, but a thread for a cartoon world, and the unpainted third looks like dirt. The sheet's 1 m scale post hid all four models (its radius scales with its height); the pack's sheet uses a 0.4 m post | a plain block with a red band: reads, but plain | a 1.6 cm handle and a 48 cm head: the handle is a thread |
| 2 | sheet | 7 cm (6 cm for OB), painted down to a 12% earth collar | a dark plinth, a chamfered cap | handle 2.2 cm |
| 3 | game (`arch-p2c`, Midwest, Parkland): pond stakes, the first 150-yd post, the first rake | stakes read clearly round a pond from its bank; in shade the red went maroon, so the game's red is brighter (#e64a34) | the white 150 band vanished on a white post: the body is dark green in the game, as many clubs paint them, so every band reads | the yellow head reads, but at true size it is nothing from a fairway: drawn a third larger (2.3 m), handle 3 cm |
| 4 | sheet | a steeper cap (its lit face catches the eye) | the band deeper (10 -> 14 cm) and proud of the post | twelve stouter teeth |
| 5 | game (`arch-p2d`, Links) | -- | dark green with its white band reads well in fescue | seen end-on: the camera and the rake both lay along the line out of the sand |
| 6 | game (`arch-p2e`, Desert) | stakes and posts take the furniture's ink, instanced: crisp cartoon stakes round a desert pond | inked | laid along the bunker's edge (markings.js), a dark grip; side-on it was **a stub**: the ingest's int16 box (two model heights) wrapped a model 27 heights long. Found and fixed with a per-model scale, `q`, for the Architect's families (build-meshes.mjs `OWN_SCALE`); eleven shipped models wrap the same way (TODO, *Eleven models wrap*) |
| 7 | game (`arch-p2f`, Desert) | -- | inked, reads on mown ground | full length at last, a yellow toothed head: reads as a rake beside the sand; the handle read as a dark stick |
| 8 | sheet | -- | -- | the handle lighter timber (#a9845a) and thinner (2.6 cm) |
| 9 | game (`arch-p2g`, Haunted Hollow) | red stakes along a creek's banks read against the purple | -- | reads clearly on the purple rough |
| 10 | game, **Low tier** (`arch-p2h`, Midwest) | bright and crisp round the pond on Low | -- | -- | 

Cost: a nine-hole course carries about 300 markings, drawn as twelve
instanced meshes (six kinds, two parts each, and the ink of the standing
ones) -- a dozen draw calls and a few thousand triangles. Measured with the
rest of phase 2 on Low (*Measures*).
