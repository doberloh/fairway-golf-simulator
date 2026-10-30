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
| 2. People | built: cart paths with bridges and free relief; hole names, flags by pin position and the crest for both designers; an Architect course's founding and the architect's note; stakes, yardage posts and rakes (ten iterations); the clubhouse, solid, one per landscape (ten iterations). The bridge deck is still drawn, not solid (*Deviations*) |
| 3. The field | built, without the study's baked field (*Deviations*): collection areas (a hazard-slot kind the shader paints and the lie reads), lobed bunker complexes, thin collars where fairways run into greens, divot wear. Not done: greens turned to the approach, per-band mowing heights, native mower lines (*Deviations*) |
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

### Phase 2: people, second half (30 October 2026)

ARCHITECT_VERSION 4 (markings), 5 (the clubhouse). Classic unchanged.

- **Markings** (markings.js; Blender pack architect_people, ten iterations):
  red stakes round ponds and along creeks near play, white stakes where the
  boundary nears play, yardage posts at 100, 150 and 200 yd, a rake along
  every bunker's edge; instanced, standing ones inked.
- **The clubhouse** (clubhouse.js; Blender pack architect_clubhouses, ten
  iterations): sited near the first tee and the last green, facing the tee,
  sized by club, terraced on a slope, a 40 m lawn kept clear, the path
  linked to its door. Solid: `world.buildings` boxes join the houses' box
  routine in physics.js, never out of bounds; drops avoid it (main.js).
- **The ingest's int16 box** (found on the rake): a per-model scale for the
  Architect's families; eleven shipped models wrap the same way (TODO).
- Tests: tests/markings.test.mjs, tests/clubhouse.test.mjs.

### Phase 3: the hand (30 October 2026)

ARCHITECT_VERSION 6. Classic's fingerprint unchanged.

- **Collection areas** (architect.js; the study, workstream D): on the styles
  that play along the ground -- Links, Sandhills, Minimalist, Golden Age,
  Heathland, Raynor -- an oval of fairway-height grass off the front corner
  the green drains toward (the other front corner when a bunker sits
  there). A hazard slot of a new kind: renderer.js writes it with meta.y -1,
  the ground shader paints it fairway over rough or semi-rough only, and
  course.js `localSurface` plays it the same way. It takes one of the hole's
  twelve slots.
- **Bunker complexes** (the study, workstream C): on Heathland & Sandbelt,
  Sandhills, Golden Age, Modern and Minimalist, about half the bunkers over
  7 m grow one lobe over their rim -- a smaller oval, a hazard of its own --
  so the sand has capes and bays. A fairway bunker's lobe grows away from
  the fairway. (The first count, two lobes on any bunker over 5.5 m, put 51
  on nine Heathland holes and doubled the sand.)
- **Thin collars** on Links (0.75 m), Sandhills (0.9 m) and Minimalist
  (1.0 m): the fairway runs on into the green, whatever the club mows
  elsewhere.
- **Wear** (markings.js `placeWear`; the study, workstream N): divots on the
  tees, thickest on par 3s (irons; USGA's par-3 tee area doubled for that
  reason), a few on every back tee and scattered in the landing zones, by
  club and age; one instanced mesh of small dark patches.
- **The profiler** learned a group, `architect` (Classic against Architect
  on Low, three landscapes).
- Tests: two more in tests/architect.test.mjs.

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
- **The surface field is not built** (the study's engine piece: a baked
  texture of distances to every surface edge, read by the lie and the
  shader). The ground shader is at its sixteen-texture limit, and a new
  texture meant replacing a data texture both designers share -- a change
  Classic's look would ride on. Phase 3's pieces went into what exists
  instead: a hazard-slot kind (collection areas), more hazards (lobes), a
  setting (collars) and a decal mesh (wear). What that leaves undone:
  **greens turned to the approach** (a rotation the hole table has no free
  channel for), **per-band mowing heights** read as heights, and **native
  mower lines** where mown rough meets native grass. The sculpting and
  real-courses studies still need the field; it stays the first piece of
  either.
- **A clubhouse on a slope stands on a terrace** -- its floor level with the
  high side and a stone wall down to the low -- rather than on levelled
  ground: levelling is earthworks (phase 5). On Mountain, where nowhere falls
  less than 4.4 m across a members' footprint, it falls back to a municipal
  footprint on up to 6.5 m.
- **The bridge deck is drawn, not yet solid**: a plank deck and rails over a
  creek, procedural, which a ball flies through into the water. IDEAS' note
  stands (a height override failed: a ball under the deck landed on it); the
  solid deck comes with the bridge kit in phase 5 (water made by people).
- **Rulings so far**: free relief from a cart path (relief.js `pathRelief`);
  a building is solid and never out of bounds. The rest of the study's table
  (ground under repair, no-play zones, the desert as a penalty area, drop
  zones, walls and roads played as they lie, the electric fence) comes with
  the features that need them.
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

### Frame time on Low (30 October 2026, after phase 3)

`node tools/profile.mjs --only architect`, one run, seed PROFILE, nine holes,
on this machine's RTX 4090 (so the real-GPU arm: headroom, not a weak card).
Frame = CPU + GPU medians.

| Landscape | Classic | Architect | Change | Draw calls |
| --- | --- | --- | --- | --- |
| Midwest | 1.70 + 1.22 = 2.92 ms | 1.60 + 0.83 = 2.43 ms | -17% (fewer trees in play) | 414 -> 426 |
| PNW | 1.20 + 1.18 = 2.38 ms | 1.50 + 1.05 = 2.55 ms | +7% | 376 -> 440 |
| Links | 1.20 + 1.07 = 2.27 ms | 1.40 + 1.06 = 2.46 ms | +8% | 347 -> 354 |

Inside the goal's 10% on all three. The added draws are the paths, the
markings (instanced, twelve meshes), the clubhouse, its ink and the wear.
Re-measured at the end of the goal.

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
| 30 Oct, phase 3 | capture `arch-p3a` (Midwest, Links; Heathland, Municipal): a hole from behind, a green, the first tee | 5%, 38 °C | no errors; divots on the tee, a collection area beside a green, lobed bunkers seen |
| 30 Oct, phase 3 | profile `--only architect` (six cases, Low) | 5%, 39 °C | 1.5 minutes, no errors; *Frame time on Low* |
| 30 Oct, phase 2 | captures `arch-c1` to `arch-c11` (sixteen runs of one to three landscapes): the clubhouses' iterations, all ten landscapes, the last on Low | 1-7%, 38-41 °C each | every course built in 4-17 s with no errors |

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

### architect_clubhouses (ten clubhouses, one per landscape)

Each iteration was made on all ten together; "game" is a capture of every
landscape named.

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | sheet | ten distinct silhouettes; the chalet's gable, the stonehouse's twin gables and chimneys, the manor's turret, the clapboard's cupola and the shingle's dormers read at once; the lodge and farmhouse were one big brown roof plane, the pavilion's overhang hid its posts, the adobe's vigas were too short to see |
| 2 | sheet | a fascia board along every eave and a ridge cap; cross gables over the lodge's entrance and the farmhouse's middle bay; the pavilion's posts 4.8 m and its overhang 1.1 m; vigas 1 m long |
| 3 | game, all ten (`arch-c1` to `arch-c4`) | Midwest's white farmhouse and red roof, the Island pavilion, the Links stonehouse and Autumn's clapboard read well in their landscapes; the manor came out squat (every building drawn at the club's one height); the Mountain chalet stood hidden in its wood; Lakeshore's shingle was dull |
| 4 | game: Haunted, Mountain, Lakeshore (`arch-c5`) | each building as tall as its own model for its width (clubhouse.js `CLUBHOUSE_ASPECT`): the manor tall and crooked with lit windows; 15 m clear of trees round every clubhouse; Lakeshore's walls lighter. The chalet still hidden |
| 5 | game: Mountain, Redwood, PNW (`arch-c6`, `arch-c7`) | a 40 m lawn in front of every clubhouse, toward the first tee (clubhouse.js `inForecourt`): the PNW and Redwood lodges stand open on their lawns with the path to the door. Mountain had **no clubhouse at all**: its flattest site fell 4.4 m |
| 6 | game: Mountain, Links, Autumn (`arch-c8`) | a terrace: the floor level with the high side and a stone wall down to the low (renderer.js), a site may fall 4.5 m, and on steep land a municipal footprint on ground falling 6.5 m. The chalet stands on its terrace; the terrace walls and the Links stone read too dark. (A 6.8 m plinth in the model was tried first and dropped: the ingest stands a model on its lowest point, so it raised the whole building.) |
| 7 | game: Mountain, Links, Midwest (`arch-c9`) | the terrace a warm pale stone, the Links stone and slate lighter; the Links front still in shade (it faces its tee, away from the afternoon sun: honest) |
| 8 | sheet | a flagpole and flag by every door (inside the footprint's width: outside it, it widened every model and the game drew each building narrower), dark shutters on the farmhouse and clapboard; the height table re-measured (a test now holds it to the models) |
| 9 | game, all ten (`arch-c10`) | every clubhouse its landscape's own, a flag by the door, a lawn and the path in front: adobe on a terrace with its vigas, the manor's lit windows, the pavilion by the sea |
| 10 | game, **Low tier**: Midwest, Haunted, Island, close to and from the first tee (`arch-c11`) | all read on Low; from the tee the farmhouse sits behind the hole's sign as a clubhouse should |

Cost: a nine-hole course carries about 300 markings, drawn as twelve
instanced meshes (six kinds, two parts each, and the ink of the standing
ones) -- a dozen draw calls and a few thousand triangles. Measured with the
rest of phase 2 on Low (*Measures*).
