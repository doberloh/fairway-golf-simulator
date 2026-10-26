# The cartoon overhaul

Branch `cartoon-overhaul`, begun 25 October 2026 from main at e3b6288 (ten
landscapes, Cartoon). The owner's brief is local (`docs/reports/cartoon-overhaul-goal.md`);
this page is the committed record of what the overhaul is doing, why, what it
has set aside, and how far it has got. **It is the first thing to read before
touching the branch.**

The aim, in the owner's words: keep the Cartoon style, but make it look
designed rather than "cobbled together" -- every model remade in Blender, every
texture redone, landscapes that feel hand-crafted while staying generated from a
seed, and the rendering and lighting polished -- **without losing frame rate**.
When the owner comes back to play it, it should look familiar, and much better.

## Status

| Phase | State |
| --- | --- |
| 0. Plan and baselines | done: captures of `main`, generation times, the bench, this plan |
| 1. Tools | the Blender library and paint pipeline done (`cartoon.py`, `inspect.mjs`, paint carried into the game); more as needed |
| 2. Landscape generation | done (three rounds): a landform recipe per landscape, nine ground types that play (`src/grounds.js`, `src/landforms.js`), generator 37; shared links fairways (three rounds), generator 38; uncleared stands and the far forest (five rounds), generator 40; desert plants (41), the brush (42), pumpkins and toadstools (43) |
| 3. Ground textures | done (three rounds): the turf detail atlas, the ground types' painted patterns |
| 4. Assets, biome by biome | every tree, shrub, grass, brush, rock, house and Haunted Hollow prop pack remade, three or more rounds each (*Rounds*, below); the wildflowers, heather, the houses' gardens and footings, the tee furniture and the flag likewise. Rounds past three toward the addendum's ten have been given where a picture showed something still wrong, not as a count |
| 5. Rendering and lighting | twenty-four rounds of the light (*Lighting*, below), rendering only |
| 5b. Reading the ground | done (the owner, 26 October 2026: "insert a phase for ground readability ... too many complicated settings"): four rounds (*Reading the ground*, below); the Clear default approved |
| 6. Frame-rate pass | done (*Frame rate*, below): Links, Island and Redwood at or under main; the rest over, by numbers written there -- the gap on High and Ultra accepted by the owner (*Working on the branch*); Low on weak machines not yet measured |
| 8. After the goal | the goal ended 26 October 2026 and the owner reviewed it; single-turn requests follow on this branch under the same terms (*Working on the branch*); not merged |
| 7. Hand-over and showcase | third pass (26 October, after the late rounds: water, sand, edges, wind, clouds, occlusion, flag, furniture, drives): `npm run build` fresh; the journeys those touch (boot, endless-round, no-late-shaders, range, range-greens, floodlit-night, surprise-round) green, but `endless-round` failed once in seven runs, on seed HARROW-4021, stopped at the scorecard -- six reruns on six other courses passed and the cause is not found (TODO); all 37 were green at the second pass, before these rounds; every landscape recaptured (`latest/`, 24 views each, no page errors); the showcase rebuilt (885 pictures). Fourth pass, after shadows and the drives: all 37 journeys green (`server-program` skipping itself as on main); `endless-round` then ran 8 more times on 8 courses, all green -- 15 of 16 since the one failure, which did not recur |

### Rounds, counted (26 October 2026)

Every asset, texture and light topic the brief names, with its rounds (a round
is made, rendered, judged and written down; a round that judged and changed
nothing is counted only where it says so). Details under *Rounds* and
*Lighting* below.

| Item | Rounds | Where |
| --- | --- | --- |
| Broadleaves, conifers | 5, 4 | *Broadleaves*, *Conifers*, *Frame rate* |
| Shrubs, long grass, brush, desert plants | 4, 3, 3, 3 | their sections |
| Wildflowers, heather | 3, 7 | their sections |
| Island trees, Haunted Hollow's dead trees, deadfall, pumpkins and toadstools, the redwood grove, Lakeshore's plants | 3 each (redwood 4) | their sections |
| Boulders, cliffs and cut banks | 4, 7 | *Boulders*, *Landforms*, *Cliffs* |
| Houses, gardens and footings | 3, 3 | their sections |
| Tee sign, ball washer | 4 (made; roof turned; underside; gable ends), 3 (made; squared housing; upright) | *Course furniture* |
| Tee marker, bench | 3 (made; judged close to, unchanged; inked), 2 (made; inked) | *Course furniture* |
| Flag | 3 (numbered; downwind; both sides) | *Course furniture* |
| Turf, rough, ground types' patterns | 3 | *Ground textures*, *Landforms* |
| Bunker sand | 3 (rounds 4-6 of the textures) | *Ground textures* |
| Paths (a house's drive -- the course has no other) | 7 | *Ground textures* |
| Ramp, rim, bounce, grading, sky, haze, dawn, dusk, night, floodlit | 5 (lighting 1-5, all ten landscapes) | *Lighting* |
| Clouds | 3 | *Lighting* 6, 7, 18 |
| Water | 4 | *Lighting* 8, 9, 14, 15 |
| Edges | 3 (one rejected) | *Lighting* 10, 16, 17 |
| Wind | 3 | *Lighting* 11-13 |
| Ambient occlusion | 3 on houses (rounds 19-21); the forests' floor shade came with the stands (*Uncleared stands*: wider and deeper pools so woods read as woods) | *Lighting*, *Uncleared stands* |
| Cast shadows | 3 (judged; crisp; checked on High) | *Lighting* 22-24 |
| Reading the ground | 4 | *Reading the ground* |

Every landscape, by its own landform recipe (biomes.js `landform`,
landforms.js) and ground types -- generated per seed, judged in the fixed
views of every landscape (`latest/` against `main/` in the showcase). The
landforms, ground types and transitions had three rounds together
(*Landforms and ground types*), the stands and far forest six, the links
fairways three; each landscape's own plants are counted above.

| Landscape | Landform | Ground types between the holes |
| --- | --- | --- |
| Pacific Northwest | crags, 22 m, two cliff steps | rock; pine straw under the stands |
| Desert | mesas 22-48 m and dry washes | hardpan floor (with strata on banks), wash, rock |
| Mountain | crags, 70 m, four cliff steps, scree fans | rock, scree |
| Links | dunes and hummocks (5 m), shared fairways | marram, heather |
| Midwest | prairie swales | native prairie |
| Island | coral ironshore along the coast | coral |
| Giant Redwood | crags as PNW's, lower (16 m), at the owner's word (the same country) | rock; duff under the giants |
| Autumn | crags, 9 m, with summit rock | rock; leaf litter under the hardwoods |
| Haunted Hollow | moor and tussock | heather (dead) |
| Lakeshore Dunes | dunes (4 m), no heather, its blowouts kept | marram |

## Rules set aside

Every rule of AGENTS.md (or a doc it points to) that this branch sets aside is
listed here: the rule, why, what changed, and how to restore it. The owner
asked for this list so the suspension is visible after the fact. Generation and
graphics rules may be set aside where they block the look; nothing else may.

| Rule | Why it was set aside | What changed | How to restore |
| --- | --- | --- | --- |
| *Landscapes stay as they are for a seed* (the spirit of GENERATOR_VERSION discipline, AGENTS.md *Two version numbers*) | The overhaul exists to redesign every landscape | A seed makes a different course on this branch than on main. GENERATOR_VERSION is still bumped for each change, so an older save is flagged. AGENTS.md says so in *On the cartoon-overhaul branch, landscapes are meant to change* | Rewrite that AGENTS.md section before any merge to main |

| *Unmown ground is rough* -- every planting rule asked `surface === 'rough'` (trees, boulders, Haunted Hollow's props, houses, deadfall, grass), and the tests held it | Ground between the holes is now nine types of its own (rock, hardpan, heather...) | Each rule asks `allows(surface, what)` (grounds.js): rough allows everything, rock and scree no trees, a wash nothing tall. Tests updated to ask the same: course-living, homes, haunted-props, landscape | Make every ground type answer like rough in `ALLOWS`, or drop the recipes |
| *A stream's faded end keeps its full channel's water level and narrows to 8% of its width* (streams.js `downhillProfile`) | The new dune crests stood a faded creek head 8.7 m under the ground: water lying on a dune | Across a fade the level rises toward the surveyed ground, and the channel narrows to no less than 1.2 m (the ground mesh's finest cells are 0.5 m). Every biome's creeks moved a little at their ends | Revert those two lines in `downhillProfile` |
| Three collider and prop tests' setups (solid-colliders' wall shot, haunted-props' pumpkin roll) | The new ground decided their results, not what they test: a prairie swale rolled a wall shot into the wall, the next house down a denser street was hit, a pumpkin's run-up crossed heather and a pond | The wall shot is lofted 4 degrees and fired with only its house standing; the pumpkin's whole run-up must be rough | Revert the test edits (and generator 37) |

| *Every crown on Ultra is the whole tree* (graphics.js, Ultra's `farTrees: 0`, the owner's "Ultra stays amazing") | The stands put 10,000-16,000 painted crowns on a course; drawn whole that is tens of millions of triangles | Painted trees swap to their shipped far twin (the same lobes, faceted) below 3% of the screen's height on Ultra, 5% on High (`farPainted`); the grown trees keep `farTrees: 0` | Set Ultra's `farPainted` to 0 |
| *The tee surround is never a clear-cut* (tools/metrics.mjs `teeSurroundClearCut`, tests/tee-corridor.test.mjs) measured every trunked tree against rough alone | A stand stands back from every tee by design, so counted in the average it made every tee look bare (35 courses failed with the surrounds unchanged); its needles turn rough into pine straw | Both measure the open scatter alone (`!t.stand`), per hectare of ground that can hold a tree (`allows(s, 'trees')`); the corridor test counts the open scatter against its target | Drop the `stand` filters (and the stands) |

(More rows are added as each is set aside, in the same commit as the change.)

## Baselines (main, 25 October 2026)

Taken before any change, so every later number has something to stand against.
All local, under `bench/shots/overhaul/` (git-ignored):

- **Pictures**: `tools/capture/overhaul.mjs main <biomes> --build bench/shots/overhaul/main-build/index.html`
  -- nine fixed views per landscape (back tee at eye height, behind the first
  green, the same at golden hour, the second hole from the side, a green close
  to, the edge of the rough, the land beside a hole, two overviews), and for
  the lighting rounds four more of the second hole (dawn, dusk a degree and a
  half after sunset, moonlit night, floodlit night) that main's baseline was
  not taken with, seed
  `overhaul`, nine holes. `main-build/index.html` is main's capture build, kept
  so the baseline can be retaken.
- **Generation**: `node tools/gen-time.mjs` -- an 18-hole course per landscape,
  three seeds, one Node process: 2.2 to 3.1 s each (Mountain 2.22, Desert 2.29,
  PNW 2.41, Redwood 2.53, Haunted 2.66, Lakeshore 2.70, Links 3.01, Midwest
  3.04, Autumn 3.10), Island 5.86 s. Saved as `gen-time-main.json`.
- **The generator bench**: `node tools/bench.mjs --tier full`: 45 courses, every
  invariant zero (`bench-main-full.txt`).
- **Frame rate**: `bench/profile-baseline.json` (committed) is main's; the
  overhaul re-measures main on an idle card before the frame-rate pass and
  compares tier by tier.

## Art direction

**Familiar, but designed.** The palettes, the landscapes' names and characters,
the mowing stripes and the soft toon light all stay. What changes is that every
shape is chosen.

What the baseline pictures show is wrong, in order of how much it costs the
look:

1. **Trees are a kit, not a forest.** The broadleaf family includes
   cube-crowned and plateau-crowned Kenney trees; conifers are stacked cones of
   two kinds; the imported models are lit flat (their toon material has no ramp,
   so it bottoms out at 70%, `toonRamp` in textures.js), so a crown is one
   tone with faceted edges.
2. **Landscapes are the same hills everywhere**: one rolling function scaled by
   three numbers per biome. A "mountain" course is green hills under a grey
   ring; a desert is the same hills painted tan with speckle.
3. **Rocks are squashed icosahedra** (flat-shaded, four shapes) -- grey pebbles
   at any size.
4. **Ground cover between holes is one tone** with a scatter of blades.

### Shape language

- **Crowns are a few big masses**, each a cloud of overlapping soft lobes, with
  gaps the sky shows through. A crown's silhouette reads at 200 m; its lobes
  read at 30 m. No cubes, no gems, no single spheres.
- **Conifers are drooping skirts**: tiers that hang and overlap, a ragged lower
  edge, a leader that leans a little; spruce dense and dark, pine open with a
  rounded top, fir narrow.
- **Trunks taper and flare**: a root flare at the ground, a lean, a fork; bark
  as a darker value, never a plain cylinder.
- **Rocks are chunky planes**: bevelled slabs and rounded granite, each built
  for its biome (red sandstone with strata in the desert, angular grey scree in
  the mountains, rounded granite in New England, coral ironshore on the
  island), seated into the ground with a skirt.
- **Grass is clumps, not blades**: tufts that lean together, light at the tips.

### Shading

The techniques the stylised-nature community uses, all available here:

- **Sphere-projected normals on foliage**: each lobe's normals are blended about
  80% toward the direction from the crown's centre (Inasa Fujio's stylised tree
  tutorial; the "anime foliage pipeline"; REFERENCES), so a crown shades as one
  soft body with a light side and a shade side instead of many facets.
- **Painted occlusion**: vertex colour darkens a crown's core and underside and
  lightens its sun-side tips; a rock's base and cracks; a trunk's foot.
- **One ramp for everything**, the same one the ground uses, including the
  imported models that had none -- eight steps since the lighting's round 2,
  and coloured: each landscape's shade side leans toward its own cool hue
  (`light.shade` in biomes.js, textures.js `rampSteps`).
- **Rim light** on foliage silhouettes, tinted by the sky (Fresnel; Barla's
  cell shading) -- built in the lighting's round 1 (textures.js `rimLit`).
- **Per-biome grading**: each landscape's light and colour stated in its record.

## Landscapes (the research, in brief)

Each biome gets landforms and ground of its own, drawn from what lies between
the holes on the real courses of its kind. Sources are in LANDSCAPE_RESEARCH.md
and REFERENCES.md; this is the plan.

| Landscape | Real reference | Between the holes | New ground |
| --- | --- | --- | --- |
| Mountain (Alpine Reserve) | Banff Springs: cliffs of Mt Rundle over the fairways, holes in a river valley; Crans-sur-Sierre: larch and meadow | Rock outcrops and cliff bands on the valley sides, scree fans below them, alpine meadow, conifers stepping up the slopes and thinning out | rock, scree, alpine meadow |
| Desert (Vermilion Basin) | Troon North: bare desert, massive granite boulders, ravines and foothills, a "desert" drop rule; Sedona: red sandstone buttes | Desert floor (hardpan and decomposed granite), boulder piles, dry washes, sandstone buttes and mesas on the horizon | hardpan, wash, rock |
| Links (North Sea Links) | Trump International / Bandon / Chambers Bay: marram-covered dunes up to 30 m, gorse, fescue, revetted pot bunkers | Tall marram dunes, blowouts, heather and gorse patches, firm fescue | marram, heather |
| Midwest (Prairie Run) | ThunderHawk, Red Tail Run: oak and hickory groves, restored prairie (switchgrass, big bluestem) | Mown parkland under oaks, tall prairie in out-of-play ground | prairie |
| Island (Leeward Cay) | Teeth of the Dog: jagged coral rock along the shore, paspalum, sea grape | Coral ironshore at the waterline, sand, palms | coral |
| Pacific Northwest (Sitka Bluff) | Bandon, Chambers Bay: fescue, gorse, sand, fir and shore pine behind | Forest floor (duff) under conifers, fern banks, mossy basalt | duff, rock |
| Giant Redwood (Cathedral Grove) | Redwood forest floor | Duff and sorrel under the giants | duff |
| Autumn (Copper Hollow) | Stonebridge, Post 273, Sugarloaf: granite ledge outcrops among maples and birch | Leaf litter under the hardwoods, granite ledges, stone walls | leaves, rock |
| Haunted Hollow (Gloaming Moor) | Moorland | Dead heather moor, peat | heather (dead) |
| Lakeshore Dunes (Beacon Dunes) | Harbor Shores, Arcadia Bluffs | Kept: dunes, blowouts, woods behind | (marram) |

Transitions between ground types are soft: a field of shares rather than a
boundary, painted and played from the same numbers (the blowouts' pattern:
one field baked on the ground atlas's grid, read by both `surface()` and the
ground shader).

## New ground types in play

A new ground type is not paint. Each one has, in one pure module
(`src/grounds.js`) with a Node test: how a ball bounces, rolls and
spins on it, how a shot comes out of it, its sound, its colour on the maps, its
name on the HUD, and whether it is in play or a hazard. Every value is PLACED
unless a source is given, and is listed in RESEARCH.md.

## Tools

| Tool | What it does |
| --- | --- |
| `tools/capture/overhaul.mjs` | The fixed views of any landscape from any build (above); gated and logged on the graphics card |
| `tools/gen-time.mjs` | How long an 18-hole course takes to generate, per landscape |
| `tools/capture/compare-rounds.mjs` | Rounds side by side for one landscape (a row per view, a column per round), or `--across` one round for many landscapes; light work, no game |
| `tools/capture/overhaul-showcase.mjs` | The showcase page (`docs/reports/cartoon-overhaul-showcase.html`, local): every landscape main against the branch with sliders, the light and asset rounds with their notes from this page, the ground types and their maps, the wait, size and frame rate, the rules set aside |
| `tools/capture/wind-sequence.mjs` | One camera on a windy course, a still every so often -- the wind judged without video |
| `tools/frame-tris.mjs` | A frame's triangles model by model, from one spot (GPU gate) |
| `tools/frame-spikes.mjs` | What each long frame spent its time on, camera still or orbiting (GPU gate) |
| `tools/profile.mjs --build --json --against --biome` | Main's kept build profiled beside the branch's, tier ladders on any landscape |
| `tools/surface-map.mjs` | A course's surfaces and ground types from above, 2 m a pixel, on the CPU -- for judging routing and shared fairways |
| `tools/gpu-gate.mjs` `foreignJobs` | Waits while a Playwright browser or Blender that is not ours is on the card (the realistic-graphics goal runs in another folder) |
| `tools/gpu-run.mjs --goal cartoon-overhaul --util 30 --temp 80 --rest 1 -- <command>` | Any graphics-card command (smoke, profile) through the same gate, logged with the card's readings before and after |
| `tools/capture/build-hooked.mjs` | The capture build (`bench/shots/dist-exp/`): the working tree with the capture hooks; rebuild it before every capture after a code change |
| `tools/blender/run.mjs <pack> --render` | Runs a Blender pack (`tools/blender/cartoon_*.py`), exports its `.glb` files to `vendor/` and renders its contact sheet to `bench/shots/blender/`; then `node tools/build-meshes.mjs` ingests them |

## Working on the branch

### Where it stands (26 October 2026, after the goal)

The goal ended and the owner looked at the work: "really amazing work". Their
calls, which stand until they say otherwise:

- **The High and Ultra frame-rate gap is accepted** (*Frame rate*, below):
  "220 frames per second is still way higher than a golf sim actually needs."
  The open worry is low-end machines on Low -- Low went from about 0.55 to
  1.0 ms a frame on Autumn on the 4090, and the software `weak` group has not
  been run (TODO; it needs the owner's word each time -- a software run once
  took the machine down).
- **Every PLACED look choice was approved** as sensible: the Clear reading
  of the ground as the default, crisp cartoon shadows, ink outlines on the tee
  furniture only, the flag's wind ripple, the house shade at the walls.
- **Not merged** -- the owner asked for it to wait. Single-turn requests now
  follow on this branch, under the goal's computer and rule-suspension terms
  (AGENTS.md, *On the cartoon-overhaul branch, the goal's working rules
  outlive it*).
- **To play it:** `dist/index.html` in this worktree, opened straight from
  disk, or `npm run dev`. Houses are off by default (course settings).

### How a round ran

Each asset, texture or light topic: find what is wrong in a picture, change
one thing, capture, judge against the last round and the reference, write the
round into its table here (what was wrong, what changed, the picture's
folder), and say so in RESEARCH with the numbers, PLACED where they were
chosen by eye. A round that changes nothing is written down as judged and is
not counted as a change. Typical loop:

1. Blender assets: edit `tools/blender/cartoon_<pack>.py`, run
   `node tools/blender/run.mjs cartoon_<pack> --render`, look at the sheet,
   copy it to `bench/shots/overhaul/rounds/<name>-r<n>.png`, then
   `node tools/build-meshes.mjs`. A model's real height is passed where the
   game builds it (the ingest makes every model one unit tall).
2. In the game: `node tools/capture/build-hooked.mjs`, then
   `node tools/capture/overhaul.mjs <label> <up to three biomes> --views a,b`.
   Pictures land in `bench/shots/overhaul/<label>/<biome>/` (git-ignored).
   Options: `--homes` (house views; `--houses 1,4` picks which), `--tier
   high`, `--cues '<json>'`, `--seed`. Views worth knowing: `h1-teekit`,
   `h1-sign-near`, `h1-markers`, `h2-flag`, `h2-flag-back`, `h2-bunker`,
   `h1-pond`, `h1-cliff`, `h1-heath`, `h2-putt`, `h2-green-b`, and the four
   hours of `h2-side` (`h2-dawn`, `h2-dusk`, `h2-night`, `h2-flood`).
3. A rendering change that could move a frame: `node tools/gpu-run.mjs ...
   -- node tools/profile.mjs --only <group> --build <file> --json` against
   main's kept build (`bench/shots/overhaul/main-build/`).
4. Before handing over: `npm test` (run with `--test-concurrency=3` when
   memory is short), `node tools/biome-fingerprint.mjs --check` after any
   generation-side file, `npm run build`, smoke through `gpu-run`, the
   `latest/` set recaptured in batches of at most three landscapes, and
   `node tools/capture/overhaul-showcase.mjs`.

### Lessons

- **Judge close to.** The tee sign read right at 25 m and wrong at 3.6 m (a
  black gable end), and the ball washer read as a mailbox -- views close to
  were added and found both.
- **Find the cause before tuning.** Ponds' brown smears were blamed first on
  the mirror, then on the bed showing through; both changes did little. The
  ripples scattering the reflection were the cause. A drive's "mud" was a
  colour-space slip, not its colour. A faint house shade was the grass blades
  covering the ground, proved by a deliberately exaggerated test.
- **A fix can reveal an older fault.** Laying a drive on the ground showed it
  had always floated beside raised footings, and that the grass grew through
  it; the scatters now keep off drives.
- **Shell edits on Windows.** Windows PowerShell's `Get-Content`/`Set-Content`
  read and wrote ground.js in the wrong encoding (an em dash mangled) and
  added a byte-order mark; restore from git and redo with the editor. Scripts
  that write docs go through the editor too (backticks), and commit messages
  with double quotes go through `git commit -F <file>`. The worktree refuses
  complex shell commands; a short script written with the editor runs fine.
- **A smoke failure is read before it is rerun** -- keep the whole log
  (`Out-File`), not its last lines; the one endless-round failure could not be
  explained because its failing step was not kept.

## Rounds

Each asset, texture and lighting change goes through at least three rounds:
research, make, render, judge beside the references and the last round, write
down what is wrong, redo. The rounds are recorded below as they happen, with
their pictures kept under `bench/shots/overhaul/` for the showcase.

**Order.** The plan's phases put assets after landscape and ground. The first
two tree packs went first anyway, because the paint pipeline (Blender to the
game) had to be proved before anything else was built on it, and trees were
the biggest single complaint. Landscape generation comes next.

### Broadleaves (oak, maple, aspen, alder) -- three rounds, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Oaks were flat pancakes on thin stems (acacias); aspens and alders stacked balls (topiary); paint too timid to see | -- |
| 2 | Oaks mushroom-capped (a smooth lid); aspens upright lozenges (a cypress) | One dome per oak over a trunk twice as thick, limbs showing; one crown per aspen and alder; paint range doubled |
| 3 | (sheet) good; (game) trunks nearly black at the foot, crowns speckled with shadow acne | Lobes standing proud of the oak's dome; rounder, smaller aspen lobes; trunk paint lifted; painted crowns no longer receive the shadow map |

### Conifers (spruce, pine, cedar) -- three rounds, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Spruces clip-art Christmas trees (thin skirts, arrowhead tips); pines bonsai | -- |
| 2 | Spruce and cedar skirts still star-pointed; spruce tops showing trunk between tiers | Thicker skirts, fewer tiers, a tapering top; twice the pine pads, bigger, merged into one flat-topped crown |
| 3 | (game) pines read as stylised umbrella pines -- kept; Mountain's lodgepole may want a narrower form (later) | Each bough a rounded scallop; upper tiers overlap |

Pictures: `bench/shots/overhaul/rounds/broadleaf-r1..3.png`, `conifer-r1..3.png`;
in the game `bench/shots/overhaul/trees-r3/` and `trees-r4/` against `main/`.

### Landforms and ground types -- three rounds, in the game

Recipes, numbers and measurements: RESEARCH *The overhaul's landforms* and
*The overhaul's ground types*; how it works: PROCEDURAL_GENERATION *The
country between the holes*; the invariant: PROJECT_HANDOFF *THE GROUND TYPES
ARE ONE BAKED FIELD TOO*.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Crags covered a fifth of the forest courses (the ridged field sits near its crest); flat rock decals beside fairways where the fade had squashed a crag; slopes banded like agate; rock textured as brickwork; white scree ribbons; orange pine-straw rings; a wireframe crack net on hardpan; saturated heather blocks | -- |
| 2 | (Mountain, Desert, Links) much better; strata still thin lines like contours; heather still hard purple | Cluster mask; rock decided from the finished slope; terraces read through noise; warped 9 m rock planes; darker scree; duller straw; faint warped cracks; wider soft edges |
| 3 | (all ten seen) heather a little grey -- wants its plants (asset phase) | Strata as broad bands of tone; heather muted and soft-clumped |

Pictures: `bench/shots/overhaul/land-r1/`, `land-r2/`, `land-r3/` against
`main/`. Not played: the new lies are seen only in pictures and in Node
(TODO).

### Ground textures (turf detail, sand) -- four rounds, in the game

`tools/turf-detail.mjs` paints the turf detail atlas (RESEARCH *The overhaul's
turf detail*); the ground types' own patterns are in ground.js `groundPaint`.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Rough strokes read as dirt specks; nap as static; stone pitted like rivets | -- |
| 2 | (game) mown detail invisible | Light blades with small dark feet, 1,500 clumps; nap at 60%; no pits |
| 3 | (game) good; hardpan's cracks large and bold | Fairway .16, green .10, grit .24; hardpan plates halved and faint |
| 4 | (bunker sand, close to: view `h2-bunker`) A flat cream field: rake lines at 2.5% unseen, the faces like the floor, no dish | Rake lines at 7%, fading by their own on-screen spacing; the steep faces a warmer, darker, damp sand (ground.js). A raked bunker with depth, no shimmer from 25 m |
| 5 | (sand) The lines one straight sine across every bunker: corduroy, not raking | The sand in patches about 4 m across, each raked in arcs about its own centre 6-14 m off, meeting at seams as a raker's strokes do; each furrow a groove under a lit ridge (`sand-r2/`) |
| 6 | (sand) The arcs faint at the player's feet | A third deeper (`sand-r3/`, Midwest, Desert, Haunted) |

Pictures: `bench/shots/overhaul/rounds/turf-r1..2.png`, in the game
`turf-r2/`, `turf-r3/`, `sand-r0/`, `sand-r1/`.

**Paths**: the brief lists them among the textures; the course draws no cart
or walking paths at all, and adding them would be new routing work, not a
texture. The one paved surface is a house's drive, which had two rounds
(homes.js `pavingTexture`, views `house-1`/`house-2` with `--homes`): round 1
a flat grey slab made poured concrete -- 3 m panels, a joint down the middle,
a smoother border (`paths-r1/`); round 2 paler, because at the slab's grey it
read as mud beside the lawn (`paths-r2/`). Round 3, Desert (the one warm
landscape; `--houses` picks the house with a garage): sandstone pavers 0.8 x
0.4 m -- read as a wooden deck, and showed the drive had always been laid at
the foundation's height, hanging over the falling ground (`paths-r3/`). Round
4: square 0.6 m flags with softer joints, and the drive laid on the ground,
tilted to it end to end (`paths-r4/`) -- still too dark. Round 5: the darkness
was a colour-space slip in the texture (linear values written as sRGB), which
was also round 1's "mud"; fixed, and the concrete back to the slab's grey
(`paths-r5/`). On Midwest the rough's grass now grew up through the drive:
the houses stand on raised footings, so the old drive had been floating.
Round 6 kept level lots at the old height -- every lot counted as falling
(`paths-r6/`, `paths-r7/`). Round 7: drives on the ground everywhere, and the
three grass scatters keep off them (homes.js `onDrive`, a test) (`paths-r9/`).

### Boulders -- four rounds, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Round stones threw spikes (bevel overran the hull) | -- |
| 2 | Round stones coarse, capped in moss; sandstone beds all one size | Round stones as a lumpy sphere flattened underneath |
| 3 | (game) good: red sandstone hoodoos in the Desert, lichened talus on Mountain | Smoother, crown moss only, beds varied, blocks seated |
| 4 | (game) On a slope a stone's flat base sat level at its centre and its downhill edge hung in the air -- the desert's sandstone slabs most of all | Drawn tilted to the ground's slope (at most 22 degrees) and sunk by the rise across its half-width, so its top stays at the collider's and its foot goes into the ground (vegetation.js; `rocks-r4/`) |

Pictures: `bench/shots/overhaul/rounds/rocks-r1..3.png`, in the game `rocks-r3/`.

## The owner's addendum (25 October 2026)

Mid-goal the owner asked for more (the full words are in the local brief):
**ten rounds per asset** (everything already at three goes round again); a
**library of brush, bushes and long grass** for every landscape; **thick
brush or uncleared forest** on parts of every course, the perimeter above all,
with something of the kind even in the desert; on **links**, **large shared
fairways** (Chambers Bay) and long grass, thicker ground-cover bushes and
rocks between the holes; and no expense spared on extra assets anywhere. The
work below is reorganised around it: each new asset family and landscape
feature has its rounds table, and the earlier tables continue to round 10.

### Shrubs -- three rounds so far, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Heather big blobs; naupaka mushroom trees; fern sparse; bramble little trees | -- |
| 2 | Bramble canes like poles; naupaka a pancake | Heather a mat of shoots; naupaka a filled dome; fern denser; bramble a core under arches |
| 3 | (game) Links shrubs small and sparse | Naupaka a full dome; bramble arches low and leafed |

Pictures: `bench/shots/overhaul/rounds/shrubs-r1..3.png`, in the game `shrubs-r3/`.

### Shared links fairways -- three rounds, generator 38

Judged from above (`node tools/surface-map.mjs <seed> 18 <out.png> links`, on
the CPU), against the Old Course's shared 1st/18th (about 118 m) and Chambers
Bay's 26-96 m fairways (RESEARCH, *Shared links fairways*).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Widening alone shared 0-3 holes a course; random routing seldom sets holes close and parallel. At a 95 m reach, square "rungs" between holes that only glanced past each other | Routing offers each long hole a tee beside an earlier one, at the least clearance |
| 2 | Doglegs failed the parallel test; a pond the neighbour's ground would later lose blocked the strip; par 3s took the side-by-side places | Parallel judged where the fairways lie; such ponds ignored, every hole's pond in the strip counted; par 3s neither take nor give a place; back nine paired with the front |
| 3 | Rungs still cut square; shares too wide | Fairways 1.3 times as wide; reach 85 m, parallel within 26 degrees, runs of 80 m, 60 m tapers. Four to six of 18 holes share |

Pictures: `bench/shots/overhaul/links-share/`. Not yet seen in the game.

### Uncleared stands and the far forest -- six rounds, generator 40

Dense forest, bosque or thicket on every course but the Giant Redwood
(src/stands.js; RESEARCH, *The overhaul's stands*), judged against the
owner's three photographs. Painted trees now ship far twins
(BLENDER_ASSETS, *The cartoon packs*) so the stands can be drawn.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) An even orchard thinning to nothing 135 m out; bare hills | A rim and patches of stand on every course but Redwood. In the game: PNW and Mountain read as forest cut for the holes, but as single trees on bare ground, the edge far back, the hills beyond bare, and the Desert's bosque a dead orchard of the old procedural mesquite |

Pictures: `bench/shots/overhaul/stands/` (from above), `stands-r1/` (in the
game). Next: closer and closed edges, a dark forest floor, forest on the far
hills, the desert pack.

Rounds 2-5 of the stands (continuing the table above):

| Round | What was wrong | What changed |
| --- | --- | --- |
| 2 | Edges far back; single trees on bare ground | Edges 15-20 m nearer play; stand trees 1.2 times as big; a deeper, wider shade under a stand (generator 40) |
| 3 | Bare hills past the course | The far forest, painted on the landscape rings (ground.js `farForest`) |
| 4 | Mountain's faces stretched the crowns into scales; Autumn flat salmon from afar | No canopy on steep ground; a fourth colour; darker far average |
| 5 | Autumn still uniform at distance | Groves of one colour about 70 m across, which survive distance |
| 6 | From above (the overview), the groves alone: smooth 70 m blobs, camouflage | A middle scale: organic clusters of crowns about 26 m across, each one of the four leaf colours, fading to their average where a cluster is under a pixel; the groves blended half toward the forest's average (ground.js; rendering only) |

Pictures: `stands-r2/` to `stands-r5/`, `farforest-r6/`. The desert's
bosque has had its own rounds since (*Desert plants*).

### Desert plants -- three rounds, generator 41

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Kenney cacti, dead hardwoods for palo verde and mesquite, procedural ocotillo and agave | The cartoon_desert pack. Palo verde lollipops; mesquite pancakes; cholla flames; prickly pear one blob; agave grass-thin |
| 2 | As round 1 | Palo twigs carry lobe clouds; rounder mesquite; smaller cholla joints; pads apart; agave leaves twice as broad. Palo 11,000 faces |
| 3 | Palo too heavy for a bosque; cholla still flames | Palo lobes a quarter the triangles; cholla joints chained on arms. In the game: a green bosque at last, a little savanna-like |

Pictures: `rounds/desert-r1..3.png`, in the game `desert-r3/`.

### Long grass -- three rounds of the models, two in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Only thin procedural blades; tall grass was the short tuft stretched into brown spikes | The cartoon_grass pack: eight grasses. Hair-thin and see-through |
| 2 | Gone at any distance | Broader, more blades, a core mound -- a faceted rock under the tall ones |
| 3 | The mound | Smaller, flatter, smoother. In the game: too sparse; colonies doubled and the near tall grass became the biome's clumps |

Pictures: `rounds/grass-r1..3.png`, in the game `grass-r3/`, `grass-r4/`.

### Brush -- three rounds, generator 42

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) No creosote, brittlebush, sagebrush, bracken or huckleberry; nothing under the stands | The cartoon_brush pack. Creosote a houseplant; bracken thin |
| 2 | As round 1 | Creosote an airy vase of small clumps; bracken fronds filled |
| 3 | Brittlebush and sagebrush mounds read as hexagons | More, smaller lobes. In the game: an understory under every stand, a share drawn per tier |

Pictures: `rounds/brush-r1..3.png`, in the game `brush-r3/`.

### Island trees -- three rounds, and one in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Kenney palms, a procedural hala | The cartoon_island pack. Palm crown a pom-pom; hala bare branches |
| 2 | As round 1 | Long broad fronds; hala forking to big rosettes. Leaflets saw-teeth |
| 3 | Saw-teeth | Overlapping leaflets. In the game: crowns culled from below, a brown knob |
| 4 | (game) | Thin leaves two-sided; a small green crown shaft |

Pictures: `rounds/island-r1..3.png`, in the game `island-r3/`, `island-r4/`.

### Haunted Hollow's dead trees -- three rounds

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Three packs in three hands | The cartoon_haunted pack. Gnarled limbs thin; snag a pole |
| 2 | As round 1 | Gnarled chunky and clawing; snag thicker |
| 3 | Dead oak a textbook tree | Thicker, twisted limbs. In the game: snags' bare wood green, now pale |

Pictures: `rounds/haunted-r1..3.png`, in the game `haunted-r3/`.

### Houses -- three rounds, one in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Kenney's building kit | The cartoon_houses pack, a model per generated form. Flat walls; slab roof |
| 2 | As round 1 | Shutters, sills, corner boards, plinth, roof undersides, brick chimney |
| 3 | Roof one slab | Shingle courses. In the game: walls short of the collider |
| 4 | (game) | Walls fitted to the collider and recentred |

Pictures: `rounds/houses-r1..3.png`, in the game `houses-r3/`, `houses-r4/`.

### Pumpkins and toadstools -- three rounds, generator 43

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Kenney's | The cartoon_props pack. Toadstools golf tees |
| 2 | As round 1 | Stout stalks, broad caps |
| 3 | Warts too few to read | More, bigger warts; every pumpkin round for the lantern face |

Pictures: `rounds/props-r1..3.png`, in the game `props-r3/`.

### Deadfall -- three rounds

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Grown logs, stumps and boulders in another hand | The cartoon_deadfall pack. Logs pipes; stumps a crown of teeth; rocks low-poly |
| 2 | As round 1 | Sagging logs with stubs and moss blankets; small splinters; smoother rocks |
| 3 | Stump moss inside the trunk | Moss on the skin |

Pictures: `rounds/deadfall-r1..3.png`, in the game `deadfall-r3/`.

### The redwood grove -- four rounds

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Grown trees in a realistic hand, 13,000-53,000 triangles | The cartoon_redwood pack. Fir, hemlock, cedar alike; seedling sparse; salal flat |
| 2 | As round 1 | Cedar drooping, hemlock feathery; tanoak light; seedling full; salal a mound |
| 3 | Redwood crown skimpy | Fuller, deeper crown. In the game: a cathedral grove; trunks perhaps too orange |
| 4 | (game) At golden hour the trunks were pillar-box red (bark #8a4a32 under a low warm sun and the colour grade) | Bark a dulled cinnamon, #7a5242; red cedar #735040. The black bands on a trunk at golden hour are the tiers' real shadows, kept |

Pictures: `rounds/redwood-r1..3.png`, in the game `redwood-r3/`, `redwood-r4/`.

### Lakeshore's plants -- three rounds, one in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) lakeshore.py's plainer hand | The cartoon_lakeshore pack. Cottonwood broccoli; dune grass thin |
| 2 | As round 1 | Cottonwood clouds on great limbs; fuller dune grass -- celery |
| 3 | Celery | Splayed tussocks |
| 4 | (game) Tall marram hid the ball from the tee | No tall grass within 10 m of a tee; marram splayed (long grass round 4) |

Pictures: `rounds/lakeshore-r1..3.png`, `rounds/grass-r4.png`, in the game `lakeshore-r3/`, `lakeshore-r4/`.

### Lighting -- twenty-four rounds, rendering only

All judged on Autumn, Desert and Links (Haunted from round 4), round 5 on all
ten, at noon, golden hour, dawn, dusk, night and floodlit night
(`light-r0` .. `light-r5`; sheets from `tools/capture/compare-rounds.mjs`).
Numbers are in RESEARCH, *The overhaul's lighting*.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Washed out: crowns one tone and greyed by the tone curve, shade sides grey, one olive bounce for every landscape | A coloured ramp (each landscape's shade hue); a sky rim on painted crowns; the bounce takes the ground's colour; the colour given back after the tone curve |
| 2 | Rim too strong on pale crowns; a noon dune no darker than the flat; dusk one muddy grey-blue | Thinner rim, more sun behind; eight ramp steps where there were four; an afterglow under the set sun and a pink band opposite |
| 3 | Desert noon still flat; dusk brown | The sky's flat fill cut from 1.15 to .95, the sun 2.8 to 3.05; a lavender twilight between the orange dusk and the night |
| 4 | At night the mist on the far hills was brighter than the sky (it read as snow); desert sand bleached at noon | The mist lifted toward white by day only; the desert's own exposure .9 |
| 5 | The desert's exposure darkened its night too | A landscape's exposure applies by day; the floodlit view added -- all ten judged |
| 6 | (clouds) Each cloud four to seven faceted balls, lit facet by facet: a cream lump | Seven to twelve finer puffs on a flat base, their normals leaning toward the cloud's centre so it lights as one body, a cool underside and a sky rim |
| 7 | The rim made each outline brighter than the cloud | A thinner, quieter rim; a cooler, deeper underside |
| 8 | (water, from a pond's bank at noon: view `h1-pond`) The sea knew its depth, a pond did not: one flat colour bank to bank | Still water reads the sea's depth map (the ground grid): over the last 0.9 m toward the bank it lifts toward a sunlit sandy green and thins -- a hairline, because a pond's bank is cut |
| 9 | The shallows a hairline | Over 1.8 m of depth, stronger: a lit rim and a pale shelf beside a dark middle (`water-r1/`, `water-r2/`) |
| 10 | (edges) No edge treatment at all | Tried and REJECTED: a solid surface darkened where it turns from the eye (an "inked" edge, no outline pass) on trunks, boulders and houses. Invisible in the captures (`edges-r1/`): trunks are already dark, stones are small. A real outline pass would cost frames -- an idea for the owner (IDEAS, *Drawn outlines*) |
| 11 | (wind) Not judged in stills | Checked, not changed: a sequence of stills on a 22 mph Midwest course, 1.2 s apart (`tools/capture/wind-sequence.mjs`, `wind-r0/`). The near crown's top moves a few tenths of a metre and its light changes as it bends toward and away from the sun -- wind, not frenzy. The model is anchored to measured trees (RESEARCH, *How a tree moves in the wind*); a cartoon exaggeration would be a guess against the owner's earlier call, so it is left for the owner to ask for |
| 12 | (wind) The flag stood out to one side whatever the wind, alone of everything that moves | It flies downwind and ripples with the wind's strength (the furniture table's round 4) |
| 13 | (wind) Do the flag, the crowns and the clouds agree? | Checked in a sequence aimed at a flag with woods behind (`wind-sequence.mjs --cam`, `wind-r3/`): the flag streams, the clouds drift and the crowns lean the same way. Not changed |
| 14 | (water, from a pond's bank: `h1-pond` on Midwest, Autumn, Lakeshore) Every pond smeared with brown blotches: muddy, not clean | Tried first: deep water kept mostly opaque, in case the bed showed through -- no change (`water-r4/`), kept anyway for a clean body. Then a little less mirror (metalness .62 to .38, reflections 2.1 to 1.3): a little cleaner (`water-r3/`) |
| 15 | (water) The blotches are the reflected woods and their dark floor, scattered by the ripples | In the cartoon style a pond's ripples bend the reflection a third as far: the woods come back as broad soft bands, the water clear teal (`water-r5/`). The sea, rivers and creeks keep their chop |
| 16 | (edges) After round 10, still no edge treatment | An inked outline -- the model again, inside out, pushed out along its normals and drawn dark (the inverted hull) -- on the tee furniture only, a handful of pieces a hole: 1.2 cm. The props read crisp and drawn (`edges-r2/`) |
| 17 | (edges) At 1.2 cm the props looked drawn in a second hand beside the uninked trees | 0.8 cm: definition, not a new style (`edges-r3/`). Kept. On trees, rocks and houses it would double their geometry on a frame already over main's -- not done (IDEAS, *Drawn outlines*) |
| 18 | (clouds) A near cloud from below was a stack of flat discs: each puff had its own flat base at its own height | Every puff stands on its cloud's one base; the big middle ones dome highest -- a fair-weather cumulus (`clouds-r3/`, view `h2-flag` on Links) |
| 19 | (ambient occlusion, a house close to: `--homes` views) A house stood on the lawn as if pasted there: the baked shade (occlusion.js) knew trees and boulders, not houses | Not changed yet: judged (`paths-r2/`) |
| 20 | (occlusion) | Houses join the bake: a pool hugging each house's turned footprint, .45 out to 2.5 m; the forest floor (Ultra's ferns and sticks), which grows where that bake is deep, reads the trees' and rocks' share alone, so it never gathers at a wall (`ao-r2/`). Not visible: the bake's texels are 1.75 m and the footing covers the first |
| 21 | (occlusion) Still not seen | .7 out to 4 m (`ao-r3/`). Faint in rough all the same: a test at .95 out to 12 m (`ao-probe/`) showed the pool, so the bake reaches the screen -- the rough's grass blades stand over the ground and are not darkened by it. It shows on bare, sandy and mown ground. Darkening the blades too is the next step if the owner wants it |
| 22 | (cast shadows, `h1-teekit`, `h1-golden`, `h2-side` on Midwest, Desert, PNW) Colour right -- cool on warm sand, deep in the woods -- but every edge a photograph's blur under drawn trees: the tiers spread the shadow filter 3.5 (High) and 4 (Ultra) texels | Judged; not changed |
| 23 | (shadows) | In the cartoon style the spread is four tenths of the tier's, never under three's own 1 (Low and Medium unchanged). The sign's shadow a clean drawn shape, a desert tree's shows its limbs (`shadow-r2/`). The filter's sample count is fixed: no cost |
| 24 | (shadows) Do crisp edges step or speckle on High, whose map is coarser than Ultra's nearest? | Checked on High (`shadow-r3-high/`, new `--tier` on overhaul.mjs) and at golden hour on PNW: no stepping, no acne. Not changed |

Still wrong: a noon desert has little shape from the light (its dunes are
gentle and the noon sun high -- the shading cues in ground.js carry it).
Cast shadows: rounds 22-24 (crisp edges in the cartoon style). The redwood trunk's
garish red at golden hour was an asset round (redwood bark '#7a5242').
Clouds: `clouds-r1/` .. `clouds-r3/`.

## Frame rate -- the first pass (25 October 2026)

Measured on the RTX 4090 with `tools/profile.mjs`, main's kept build
(`bench/shots/overhaul/main-build/`, e3b6288) and the branch's capture build
profiled one after the other through the GPU gate; graphics time per frame,
median, 1600x900 at pixel ratio 2. Runs under `bench/shots/overhaul/frames/`
(local). Every change below is rendering only.

**Landscapes, High, player view** (main -> branch at the start -> now):

| Landscape | main | start | now | triangles a frame, main -> now |
| --- | --- | --- | --- | --- |
| PNW | 1.93 | 5.51 | 4.51 | 4.2 M -> 25.8 M |
| Desert | 2.14 | 4.13 | 3.92 | 4.6 M -> 25.3 M |
| Mountain | 1.81 | 5.79 | 4.16 | 3.8 M -> 25.7 M |
| Links | 3.04 | 9.48 | 3.36 | 5.8 M -> 11.9 M |
| Midwest | 2.00 | 8.16 | 4.12 | 4.7 M -> 30.4 M |
| Island | 3.39 | 3.23 | 2.92 | 5.1 M -> 9.6 M |
| Redwood | 5.87 | 2.86 | 2.10 | 62.6 M -> 9.0 M |
| Autumn | 1.88 | 7.69 | 4.51 | 4.6 M -> 36.9 M |
| Haunted | 3.00 | 6.99 | 4.47 | 11.5 M -> 38.5 M |
| Lakeshore | 2.92 | 6.00 | 3.95 | 11.8 M -> 26.0 M |

**Tiers, Autumn** (main -> now): Low 0.55 -> 1.00 ms, Medium 1.06 -> 1.62,
High 1.88 -> 4.51, Ultra 2.07 -> 5.69. On Redwood every tier is faster than
main (Low 2.34 -> 0.77, Ultra 6.09 -> 2.97).

**What was done**, in order, each measured:

1. *Lighter crown lobes* (broadleaves round 5, shrubs round 4, conifers
   round 4; the redwood grove already used 80-face lobes): the finest lobe was a 320-face
   icosphere; it is a twelve-sided sphere of 144 faces. A maple crown 9,700 ->
   4,400 triangles, a pine 5,400-6,400 -> 2,400-2,900, the model file 7,984 ->
   6,911 KB. The 80-face icosphere was tried first and REJECTED: hexagons on
   every outline (`rounds/broadleaf-r4.png`). Autumn 77 -> 45 M triangles.
2. *Long grass drawn only so far*: a reach per tier (Low 90 m, Medium 130,
   High 190, Ultra 260), over whose last 40% each clump sinks into the
   ground; whole squares past it are not drawn. Links 11 -> 3.5 ms.
3. *Gorse and shrub far twins*, with a far twin's tiny flowers drawn as
   four-face cones rather than twenty.
4. *A bush's shadow only in the nearest map* (ground plants): 5% of a Desert
   frame.
5. *Low and Medium swap to twins sooner*: 30% and 25% of the screen's height
   (were 15%), 10-17% of a Low frame.

**Measured and not done**: twins sooner on High (8%: 1%; 12%: 4-6% -- not
worth the facets); the trees' wind gust noise (no cost: -0.2% to +0.9% when
patched correctly; `tools/variants/ultra-trees.mjs` "gust noise constant"
reported 29-42% and is VOID -- its patch stops some meshes drawing, as the
frame-rate goal found, draws 182 -> 150); twins everywhere on Low (only 16-20%:
Low's cost is how many plants there are, not their detail); the far forest
painted on the hills (nothing).

**The gap, and why it stays.** What is left is the number of plants: the
stands put thousands of solid trees in view (154,000 instances built on
Autumn), and none can be left undrawn without a ball hitting an invisible
trunk. High and Ultra cost 2-3.6 ms more than main on this card -- about 220
frames a second on High where main ran 530; a card a fifth as fast would see
roughly five times both. The levers left all cost the look the owner asked
for: thinner stands, twins at mid distance, no tree shadows in the far
cascade (15% of a Desert frame).

**Hitches.** The profiler's worst frames moved between 12 and 390 ms from run
to run, on main's build too (main's Haunted worst 73 ms, PNW 42).
`tools/frame-spikes.mjs`: with the camera still, no long frame is the game's
(one 21 ms frame in 600, all outside its code); orbiting a green, the cull
rebuilds 166-172 times at about 1.6 ms and the near-field grass builds a tile
in about 6 ms, and the one long frame (116-124 ms) comes early, the first time
the camera turns onto new ground, spent waiting on the card outside the
game's code with no program compiled -- the driver's first use of something,
as main shows. Not fixed; the TODO entry says what to check in play.

### Course furniture and the flag -- seven rounds, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) A sphere for a tee marker, a box on a cylinder for the sign, no bench | The cartoon_course pack: a moulded marker, a timber sign under a gable cap with the hole's card in front, a bench and a ball washer at every tee |
| 2 | (the flag) A plain orange rectangle on the stick | The hole's number in white on the flag's colour, as clubs print them (renderer.js `flagCloth`; the range's flags stay plain). The stick and cup keep their exact sizes. Picture: `flag-r1/` (view `h2-flag`) |
| 3 | The sign's gable cap ran across the sign, so from the tee it was one flat red board; the ball washer's round lump read as an apple on a stick | The cap turned to run front to back: its triangle faces the player as a little roof, taller (2.52 m to the ridge) with a deeper overhang. The washer a squared housing with a domed lid. In the game both read at 25 m |
| 4 | (the flag) The cloth stood out to the same side whatever the wind, rippled the same in a calm as in a gale, and its ripple moved its edge off the stick | It flies downwind (renderer.js `holdFlagsticks` turns it to `windDirection`, the bearing the wind blows toward) and ripples faster and deeper the stronger the wind (1.6 + 0.13 x mph a second; at the free edge 6 cm in a calm, 13 cm at 10 mph, 25 cm at 25 mph -- PLACED by eye), its edge held against the stick. The range's flags too. Picture: `flag-r2/` (views `h2-flag`, `h2-green-b`) |
| 5 | (the flag) From behind, the number read mirrored | The cloth is two one-sided faces back to back, the back one's picture flipped, in one geometry so the ripple moves both: the number reads right from both sides (`flag-r3/`, new view `h2-flag-back`) |
| 6 | (close to: new views `h1-sign-near`, 3.6 m, and `h1-markers`, 5 m) The washer read as a mailbox; a black triangle under the sign's roof | The washer upright, as a plunger washer is: a pale cap and the plunger's T-handle on top (1.27 m). The black was the roof's front gable end in the board's near-black green -- rounds 6 and 7 first blamed the underside (made timber, its normals bent up to catch light), which was not it; the gable ends timber, lighter at the peak (`course-r4/` .. `course-r6/`) |
| 7 | (the markers, close to) Read as tee markers, not balls -- a squat dome on a collar | Not changed. They and the bench take the inked outline (the lighting table's rounds 16-17) |

The flagstick and cup keep their exact sizes (the ball plays against them)
and are not remade; the marker and bench were judged right in round 1.
Pictures: `rounds/course-r1.png` .. `rounds/course-r3.png`; in the game
`course-r1/`, `course-r3/` .. `course-r6/` (views `h1-teekit`, `h1-sign-near`,
`h1-markers`), `flag-r1/` .. `flag-r3/`, `edges-r2/`, `edges-r3/`.

### Heather -- rounds 4 to 7 (rounds 1-3 under *Landforms and ground types*)

| Round | What was wrong | What changed |
| --- | --- | --- |
| 4 | Heather read as mud from above: flat mauve | A mat of cushions, olive-brown, flecked with purple bloom (none where the tint is not purple: a dead moor) -- darker, still dirt |
| 5 | Dirt, burnt; the flecks too fine to count from afar | The heather's own hue at two-thirds, denser bloom -- Haunted's moor went a mottled pink |
| 6 | Still a burnt patch on Links | The hue at three-quarters where it blooms: a textured mauve heath. Not yet a heath: flat paint cannot give it volume; low heather clumps in the near field are the next round. One patch on Links ends in a straight soft edge, unexplained |

| 7 | Flat paint has no volume | Near the camera (the 48 m ring of grass tiles) heather grows low cushions of the heather model, three in ten of the tiles' candidates, 30-55 cm: blooming purple on Links, dark brown with dusty flecks on Haunted's moor (vegetation.js; decoration, as the forest floor) |

Pictures: in the game `heather-r4/` .. `heather-r7/` (Links, Haunted; view `h1-heath`).

### Wildflowers -- three rounds, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) A 20-face gem on a grass tip | The cartoon_flowers pack: daisy, aster, cup. The cup's petals lay flat, a white blob |
| 2 | As round 1 | The cup's petals stand up. In the game: 8 M triangles of flowers in a Midwest frame, a quarter of it |
| 3 | Far too costly | Flat two-triangle petals (a daisy 900 -> 250 triangles); drawn only to two-fifths of the long grass's reach, sinking before it -- 0.09 M |

Pictures: `rounds/flowers-r1..3.png`, in the game `flowers-r2/`, `flowers-r3/`.

## Reading the ground (26 October 2026)

The owner asked for a phase of its own: can a player read the ground --
fairways, greens, their slopes -- and are there too many settings for it?
Judged at three views (behind the green from 30 m up, a green from 24 m at
2.4 m, a putt from 9 m at a putter's eye) on Midwest, Links and Desert; the
captures `read-r0/` .. `read-r3map/` (`--cues` on tools/capture/overhaul.mjs
sets the cues for a set).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Fairways read well -- stripes, collars, bunker edges. A green from a player's eye is a flat pale oval: its slope does not show at noon, and its sheen is capped at 10% whatever the setting | Tried green definition 85 and bands 65: the bands show on a putt; contour lines at a metre draw one line on a green or none |
| 2 | The sheen cap; contours too coarse for a green | The putting surface's cap opens with definition above its default (to about 18% at 85); contours every 10 cm on greens and fringes |
| 3 | Seven controls for one question; 10 cm lines 3 m apart on a 3% green | One choice, **Natural / Clear / Map lines**, Clear the default (PLACED -- the owner's tuned 50/40 is Natural); contours every 5 cm on greens, a little darker; turf colour variation and the shade under trees left the panel, fixed at 60 |
| 4 | Does Clear's freer sheen swim as the camera moves? | Checked, not changed: the same green from 45 degrees round (view `h2-green-b`), Natural and Clear -- the darker and lighter regions stay where they were on both. A straight vertical step in the fairway's tone across the approach, in both, is not this phase's (TODO) |

Natural is what the owner tuned through September and October; making Clear
the default reverses that tuning for anyone who has not chosen, and is the
owner's to overrule (graphics.js `READING_DEFAULT`). Not yet looked at: the
green-reading overlays (the grid and beads) beside the new contours, and
Clear's sheen in motion rather than from two still angles (round 4).

### Gardens and footings -- three rounds, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) A fence of thin boxes, a garden of seven-sided balls, a wide pale-grey concrete plinth under every house | The cartoon_garden pack: picket fence, boxwood dome, flowering bush, topiary cone. The dome a lumpy blob, the flowers big white discs, the cone a stepped tree |
| 2 | As round 1 | A smooth clipped dome; smaller, more flower heads; a twelve-tier cone that reads as one surface. In the game (homes.js): shrubs about a metre, small beside a house; the plinth still concrete |
| 3 | Shrubs too small; the plinth | Shrubs 1.15-1.6 m; the footing in the landscape's rock darkened toward soil, 9 cm proud of the walls (was 17.5) |

Pictures: `rounds/garden-r1..2.png`, in the game `garden-r2/`, `garden-r3/` (`--homes` views).

### Cliffs and cut banks -- rounds 4 to 7 (rounds 1-3 under *Landforms and ground types*)

Judged close to (view `h1-cliff`: the steepest ground within 220 m of the
first green, from 40 m off) on Mountain, Desert, PNW and Redwood.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 4 | The desert floor's crack net stretched up a steep bank: crazy paving where a mesa's side shows layers | On steep ground the hardpan shows strata of the landscape's rock in its own colour, each with a lit lip and a shadow under it (ground.js) |
| 5 | Mountain's and PNW's rock faces read as paving slabs too | The rock's broad planes softened to tone, and the same ledges added on steep rock -- the slabs stayed: not from the planes |
| 6 | The slabs are the turf-detail atlas's stone channel (cracked plates laid from above), stretched on a face | Held to 30% on steep rock: PNW's cliff a clean face |
| 7 | The same plates on gentle granite read as laid tiles | Held to 55% there: softer; they stand for jointed slab rock, the rock's earlier intent, and stay |

Pictures: in the game `cliff-r3/` .. `cliff-r7/`.
