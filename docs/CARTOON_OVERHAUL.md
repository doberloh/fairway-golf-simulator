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
| `tools/gpu-run.mjs --goal cartoon-overhaul --util 30 --temp 80 --rest 1 -- <command>` | Any graphics-card command (smoke, profile) through the same gate, logged with the card's readings before and after; `--util 50` only while the owner watches over remote desktop (AGENTS.md) |
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
- **When a change makes no difference, ask the scene.** Four rounds of the
  links tee fade changed the wrong scatter; a short probe listing the meshes
  standing tall by the tee (instance heights near a point) found the right
  one at once.
- **A smoke failure is read before it is rerun** -- keep the whole log
  (`Out-File`), not its last lines; the one endless-round failure could not be
  explained because its failing step was not kept.

## The polish goal (26 October 2026)

The second goal on the branch, after the owner played the first: floating
trees, the empty band before the distant scenery and real geometry for it,
Mountain's crags and its grass-to-rock banding, Desert's stacks, the shared
links fairways, Haunted Hollow made seasonal, water depth colour, the links
tee surrounds and the tee boxes' mowing. The brief is local
(`docs/reports/cartoon-polish-goal.md`). Frame rate: at most 5% slower per
tier than the branch at the goal's start, never by making the hole in play
look worse. Each item's rounds are recorded under it below.

**Frame rate, measured.** The goal's starting build (f8603aa, kept as
`bench/ab/start.html`) against the finished one, played alternately in the
same session (`tools/frame-ab.mjs`, two rounds, spots play1, tee5, tee9; the
card shared with the owner's remote-desktop session at 30-40%, which is why a
saved baseline from an idle card could not be compared fairly -- frame-ab
and the capture tool take `--util` for that now). Graphics frame, mean of
spots: Autumn Low 1.50 -> 1.43 ms (-4.4%), Medium 1.48 -> 1.46 (-1.2%), High
3.01 -> 3.12 (+3.4%), Ultra 3.79 -> 3.75 (-1.0%); Mountain Medium 1.52 -> 1.54
(+1.4%), High 2.63 -> 2.53 (-4.0%). Every tier within 5%; nothing on the
hole in play was made plainer -- the savings that paid for the far woods came
from drawing them before the ground and culling them by sector. The p95
frame moved +12% on Autumn High and +9% on Mountain High between rounds of
the same build too (the same noise the first goal found), so it is not read.

### Haunted Hollow is seasonal

The owner: "should only be active in the month of October, through the first
week of November, but add a toggle in the settings to activate it." Built as a
pure rule (`src/seasons.js`, tests/seasons.test.mjs); main.js asks it.

- **The window** (PLACED): 1 October to 7 November inclusive, by the player's
  own clock.
- **Not offered out of season**: Course studio's landscape grid and cards,
  Surprise me (it rolls again), a fresh Endless run and the menu's backdrop
  hole, the Endless landscape picker. **Never locked out**: a picker keeps the
  landscape already chosen, and loading a saved round or course, a shared code
  or a friend's challenge never asks.
- **Endless runs** are one seed; whether Haunted Hollow may be rolled rides in
  it as a mark (`!`), added when a run starts out of season. A marked run's
  Haunted Hollow rolls become a stand-in drawn from the seed; an unmarked seed
  -- every earlier run, every run started in season -- grows what it always
  did.
- **The course of the week** is everyone's, so it asks the season of the
  week's Monday, not the player: out of season Haunted Hollow's turn plays
  Autumn (PLACED: the nearest in mood), from week 149 (Monday 9 November 2026)
  so no week already shown changes. The rotation's function stays
  self-contained (the start splash runs a copy of it), tested.
- **The setting** "Haunted Hollow all year" sits in Settings, Graphics, beside
  the look of the course: a graphics-record field (`hauntedAllYear`, off), an
  old record loads with it off. **Departure from the brief:** the brief asked
  for a course-settings schema entry and a `SCHEMA_VERSION` bump; the course
  settings ride inside every saved course and shared code, so a player
  preference there would travel to friends. The graphics record is the
  player's own; its load is the migration, and it is tested.
- Achievements: *Ghost Hunter* comes with any round in Haunted Hollow, so in
  season, with the setting on, or on a saved course; *Globetrotter* (nine
  landscapes) is reachable with the nine others.

### Floating trees -- four rounds (polish goal)

The owner: "Trees appear to be floating in some cases. Need to make sure the
trunks are fully into the ground." Judged by a bench metric first
(`node tools/bench.mjs seated --set trees=65`: a plant whose drawn foot stands
more than 3 cm above the ground anywhere under it, checked on its own points),
then in the game (`polish-r0/` before, `trees-r3/` after: `h1-cliff`,
`far-band`, `h3-between`, `h3-edge` on Mountain, PNW, Autumn).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 0 | A tree stood at the ground's height under its centre, on a flat foot leaned up to 0.05 rad: on a slope its downhill side hung in the air | (judged; the metric added) |
| 1 | -- | Every plant drawn down by its seat (`src/tree-seat.js`): the drop under its footprint, the lean's lift, 2 cm. The footprint measured from the models (widest base in the bottom 2%). Floating: 3,661 of 65,178 (quick tier) to 123 -- but a spruce's "base" was its ground-sweeping boughs (3.5 m), sinking it metres deep |
| 2 | Boughs counted as base; ground covers on steep stand floors hung up to 2.4 m | The footprint is the trunk's bark alone; ground covers lie along the slope (to 40 degrees) and are seated against it by their stems, at most half their height; trees 5 cm under. 61 left, nearly all covers on cliff faces |
| 3 | No seat can hold a fern on a wall, and a tree spanning a cliff's lip was drawn up to 18 m into the ground | Generation (44): no cover on ground steeper than 40 degrees, no trunk where the ground falls more than 15% of its height within a tenth of it. 8 cm margin, covers to 75%. Every landscape: 2 of 588,000 left |
| 4 | A shrub on a 45-degree step under a 39-degree average; two conifers over crag steps between the seat's rings | The cover steepness also measured at half the span; the seat on four rings of 24 points. **0 of 588,521** on every landscape (full tier) |

Cost: the seat is 96 ground samples a plant, measured once as a course is
drawn: 0.11-0.15 s on an 18-hole course here (Autumn 30,245 plants, 147 ms).
Drawing only -- the generator's `y` and every collider are unchanged; the
planting rules (generator 44) are the only change to what is generated.

### Tee boxes' mowing -- five rounds (polish goal)

The owner: "tee boxes need smaller mow stripes and a cleanup mow line." A tee
was one flat colour, no stripes at all (`polish-r0/`, `tee-top`). ground.js,
the tee pad's mowing. Views `tee-top` (above), `h1-teekit`, `h1-markers`;
Midwest, Links, Autumn, Desert (`tee-r1/` .. `tee-r5/`).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | No mowing on a tee at all | Bands 0.8 m wide in the pad's own frame, running with the line of play, and a clean-up lap 0.55 m wide inside the pad's edge, the other way from the bands |
| 2 | The pad's mown collar is the same colour, so the bands stopped partway in and the lap drew a frame inside the green | Bands and lap over the whole mown tee, the lap on its outer, visible edge |
| 3 | From the tee the bands read broad and loud | 0.6 m bands, contrast .09 to .075 |
| 4 | A tee nobody had played from | Divots in the strip players use -- across the markers' span, from just behind them to 3 m back -- quarter-metre cells, one in seven, paler (sand-and-seed filled) |
| 5 | The divots were square cells, blocky close to | Each an oval, longer along the line of play (about 7 x 11 cm), at its own spot in its cell |

### Links tee surrounds -- five rounds (polish goal)

The owner: "There needs to be a better fade into taller grass from the tee
boxes on the links course." Views `tee-surround` (from behind and to the side,
eye height), `h1-teekit`, `tee-top`; Links and Lakeshore (`polish-r0/`,
`teefade-r1/` .. `teefade-r5/`). Decoration only: the ground and its lie are
unchanged.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 0 | A wall of tall fescue right to the tee's edge; the only rule was "not tall within 10 m of the tee's point" in one scatter, round the point not the mown shape | (judged) |
| 1 | -- | `teeFade` (vegetation.js): distance from the nearest mown tee's edge (its pad and collar, the shape ground.js paints); nothing tall within 1.2 m, then rising in height and in how much grows over 5.8 m. Applied to the long-grass colonies and the tiled grass's tall clumps -- no visible change at the tee |
| 2 | 15% still let through at the edge | None at all inside the clear margin; density rising with the fade's 0.7th power -- still no visible change |
| 3 | -- | The course-wide blade scatter's extra height on native ground faded too -- no change |
| 4 | -- | The planted ground cover (marram, dune grass) shortened toward the tee -- no change. Three rounds of fixes to the wrong thing |
| 5 | Asked the running game what stood tall within 12 m of the tee: the course-wide blades, up to 1.7 m -- on Links every blade is long (its scatter is the tall-grass kind), not only on native ground | All of those blades fade to 30% at the edge. The tee now sits on low grass rising into the fescue over a few metres |

Lesson (also under *Lessons*): when a change makes no visible difference,
ask the scene what is drawn there before changing a fourth thing.

### Water depth colour -- six rounds (polish goal)

The owner: "are the water depth colors reversed? It looks lighter colored in
the middle where it's deeper and should probably be darker?" **Diagnosis: yes,
reversed.** A pond's shallows let the bed through (opacity down to .72 of a
near-clear .22 looking down), and the bed under a pond is the dark bank colour,
so the rim went brown; the deep middle was opaque and showed the water's own
bright colour and the sky. Views `pond-top` (from 45 m up) and `h1-pond` (from
the bank), noon; Midwest, Desert, Autumn, Lakeshore, Island, Links
(`polish-r0/`, `water-p1/` .. `water-p6/`). renderer.js WATER_EDGES.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Reversed (above) | Still water's body is its depth's own colour, lit by the light it receives: the biome's water darker toward the deep, a sunlit sandy teal toward the bank, nearly opaque so the bed no longer decides. Direction right -- everything milky and pale |
| 2 | Milky under the full sun | Both darker, the deep much darker and bluer: a dark teal heart, lighter shallows |
| 3 | From the bank, a flat milky sheet: the body covered the reflection | The body's share falls with the grazing angle (Schlick): looked into, its depth colour; looked across, a mirror |
| 4 | From the bank still no trees in the water | The calm mirror back up (metalness .38 -> .5, reflection 1.3 -> 1.8). No visible change: the reflection probe holds the sky, not the trees -- left as found, written down |
| 5 | The sea and the big lakes one flat colour shore to horizon | The same depth body for the sea: a pale shelf over the first metres, deep blue by eight |
| 6 | Lakeshore's lake unchanged: most of it lies past the ground map, where the blend was switched off | Past the map the depth counts as deep. Lakeshore's lake is shallow a long way out, so its near water is rightly the pale shelf |

### Mountain: the grass-to-rock banding and craggy mountains -- five rounds each (polish goal)

The owner: "There is weird banding where the terrain changes from grass to
rock" and "our 'mountains' are very smooth". Judged on Mountain from the
overview, the first tee, `h2-side` and a new view `crag-face` (the nearest big
crag from 160 m), with `far-band-b` (`polish-r0/`, `crag-r1/` .. `crag-r5/`).

**Diagnosis.** A crag was one smooth ridged field, terraced into four cliff
bands, with rock painted on each band's riser and grass on its tread: a
rounded knoll ringed rock-grass-rock-grass like agate. The rock texture added
a stratum every 6.5 m of height -- ten more horizontal lines up a 70 m crag.
The far range was three summed sine waves: rolling green ridges.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | The rings, and the rounded knolls | Mountain's recipe takes `jag` (landforms.js): a sharper ridged field at a third of the crag scale bends the cliff bands round spurs and couloirs; rock where the finished ground is steep, the threshold wandering with two scales of noise, so it comes through the turf in tongues and outcrops; scree on the moderate slopes at the foot. The rings were gone; the faces plain sloping planes |
| 2 | Faces too smooth | Spurs at a quarter of the scale; the faces roughened at 23 m and 9 m, five times as deep. From above: knife-edged crests, broken spurs |
| 3 | Fine horizontal stripes up every face: sandstone strata on granite | The rock paint (ground.js, all crag landscapes) takes vertical joints every 5-6 m along the face with lit edges, strongest on the steepest rock; the strata under half. From 160 m the crags read as cliffs: buttresses, ledges, vertical cracks |
| 4 | The far range: rolling green waves | Mountain's landscape ring takes `ringPeaks` (landscape-edge.js): a ridged-noise field, crests squared to knife edges, summits where two ridge systems cross, spurs off them. Peaks and snowy aretes behind the valley |
| 5 | The nearest far faces single flat planes, hundreds of metres wide | The peaked range twice as dense along each ring, and a finer 240 m set of ridges on the high ground for those vertices to show |

Still to judge in play: the nearest far face stays pale under the haze (the
distant-scenery item's rounds take it up). Generator 45 (Mountain only); every
bench rule holds on every landscape and no plant floats on the new crags.

### Shared links fairways, rounds 4 to 13 (polish goal; rounds 1-3 below)

The owner: "that is going to need at least 10 more iterations to make the
fairways look smoothly conjoined ... it shouldn't look forced, it needs to
look like it was thought through." They were in (generator 38). Judged from
above with `tools/surface-map.mjs` (CPU) on the seeds `overhaul` and
`LINKS-A` .. `LINKS-D` (18 holes), pictures `share-r0/` .. `share-r9/`, and
measured: every pair of holes whose fairways come within 40 m, the samples
that touch and those a sliver (1.5-8 m) apart (`bench/shots/overhaul/
_sharepairs.mjs`, scratch), and why each sample did or did not join
(`shareFairways` takes a `debug` sink).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 4 (r0) | Square "rungs": two fairways joined over a short stretch made an H; V notches where a join stopped | (judged) |
| 5 (r1) | -- | `close` (gaps in a join up to 70 m filled), `blur` (the shared edge averaged over 40 m), `ease` 60 -> 110 m. Almost no change |
| 6 (r2) | The taper ran the reach to nothing, so the edge met the fairway's own edge a third of the way down and the rest was unseen | The taper runs to the fairway's own width. No change to the H |
| 7 (r3) | The rungs' square ends are where a join reaches the end of its allowed stretch at full width | The join tapers to the stretch's ends. The rungs were gone -- and those pairs no longer joined, standing a sliver of rough apart |
| 8 (r4) | Joins near the stretch's ends now lost | The stretch from 10 m past the mown start to 25 m short of the green (were 25 and 40). One pair merged with a long tongue; another kept its sliver |
| 9 (r5) | A sliver of rough a metre or three wide wherever two fairways nearly touch but cannot join (a tee or green end) -- the most forced thing on a links | `strip` (`keepStrips`): there each edge pulls back to leave at least 10 m of rough. It spread into joined stretches too |
| 10 (r6) | -- | Strips eased over a third of the distance and never into a joined stretch. Slivers: tens of samples a pair -> one or two |
| 11 (r7) | 10 m read as a line from above; joins still lumpy | Strip 14 m, blur 60 m. H shapes left on two courses |
| 12 (r8) | Measured why (the debug sink): on a links fairways start 90-120 m out, so two holes running opposite ways overlap only in the middle -- the join fills that overlap, a crossbar, and each far end has nothing to join | Ease 170 m, so a crossbar's ends run out as long diagonals |
| 13 (r9) | Short overlaps still made crossbars | A join only over at least 140 m of overlap (was 80); shorter ones get a clean strip. Zero to four joined holes in 18 (were four or five), each one merged shape -- a split fairway -- not rungs |
| 14 (r10) | A hole "shared" with no partner (the default seed's 15): a bulge toward a fairway that never came to meet it | A widening kept only if a partner it reached for widened and reached back |
| 15 (r11) | Still: S3's 1 and 2 each widened, on different stretches, and stayed 16.5 m apart | Checked on the result: a widened hole whose edges touch no other fairway anywhere gives its widening back. Real joins: 2, 2, 2, 0, 2, 4 holes on six seeds -- fewer than the first goal's count, which included bulges that never touched. S5 shows the target: one large merged double fairway with a long tongue of rough, parallel neighbours behind clear strips |

Generator 46 (Links only). Every bench rule holds on every landscape;
tests/shared-fairways adds: a shared hole always touches a partner, and no
pair of fairways leaves a sliver of rough (more than three places). Its count
threshold went from ten to six joined holes over three courses -- the count
is lower because it now counts only real joins (written here as a decision,
not loosened to pass). Not yet seen in the game.

### Desert rock stacks -- five rounds (polish goal)

The owner: "some still look like there are floating rocks at the top of the
stacks." The stacks are the layered sandstone boulders
(`tools/blender/cartoon_rocks.py` `layered_rock`, Desert's `rockStyle`).
Judged on the Blender sheet (`rounds/stack-r1.png` .. `stack-r5.png`) and in
the game (view `rock-near`, the boulder nearest the first green;
`stack-r3/` .. `stack-r5/`).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Each bed a lens, pointed underneath, touching the bed below at a narrow waist; the top block perched on it | Beds flat underneath as well as on top (`hull_rock` takes `flat_bottom`) |
| 2 | Flattened, a bed spans only the middle of its ellipsoid, so beds spaced by their full height left gaps and the top block hung in the air (the sheet showed it plainly) | Each piece starts from the measured top of the one below, 4 cm into it. On the sheet every piece rests on the next |
| 3 | (in the game) A wide slab on a narrow one, over a dark undercut | (judged) A bed's random size could make it wider than the one below |
| 4 | -- | Each bed at most 95% as wide as the one below: the stack tapers up, as a weathered butte does. In the game hardly different -- the undercut stayed |
| 5 | The undercut is each bed's own shape: cut from the middle of an ellipsoid, its sides bulge and curl in underneath and throw a dark band under its own lip | Beds cut from a thin band at the equator (flat top and bottom at 0.75), so their sides stand nearly upright; beds nearly in line (offsets halved) |

A model change only: the stacks' sizes and colliders are the generator's and
did not move (fingerprint silent).

### The far woods -- eight rounds (polish goal)

The owner: "it still looks like there is a band of completely empty space
before those textured pieces start. Fix that and then can we make those an
actual 3d mesh of some sort?" -- and during the rounds: "There needs to be 3d
objects all the way to the edge of the landscape where relevant (really tall
mountains obviously don't need trees all the way to the top, and desert
probably doesn't need THICK coverage). LODs can obviously fade but should not
transition to just bare ground ever."

**Diagnosis.** The stands end at the property line; the course's ground runs
150 m past it; the painted far forest faded in over 70 m past THAT -- about
220 m of bare ground between the last tree and the painted woods
(`polish-r0/` `far-band`). Views `far-band`, `far-band-b` (from the course's
edge, 25 m up), `overview`, `h1-tee` (`farwoods-r1/` .. `farwoods-r5/`).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | The band | `src/far-woods.js` places crowns past the property line by the painting's own cover, treeline and cliffs; vegetation.js draws them as one instanced mesh (lumps, or cones on the conifer landscapes). The painting now starts at the property line, over 40 m (ground.js `farProp`) |
| 2 | Cones read as spikes, lumps as balls | Two-tier spruces; broadleaf clusters of three lumps |
| 3 | The crowns ended in a line at their reach | Thinning and shrinking over the last stretch |
| 4 | The owner: 3D to the landscape's edge, never bare | Distance bands out to 12.8 km (the landscape ring's reach): spacing 13 m at the line, about 6% of the distance beyond, so the count stays bounded (4,000-17,000 a course); near 420 m clusters, beyond single low grove domes standing for a stand of trees. Autumn's woods run unbroken to the horizon; Mountain's stop at its treeline; Desert's are a thin scatter |
| 5 | On Mountain's steep ring faces the domes were green plates | Conifer groves as tall cones; every grove sunk by its slope; groves held to gentler ground (0.65) |
| 6 | (frame rate) The woods cost 9-11% of a Medium frame, 3-6% of High (an A/B on one page, `tools/variants/far-woods.mjs`) | Cheaper lumps (20 faces) and no shadow received -- no change: it was not the triangles |
| 7 | (frame rate) One mesh round the whole course drew all its crowns every frame | Twelve sectors, each culled out of view: High 2.7-3.6%. Medium still 7-14%, so Medium (as Low) draws grove domes only |
| 8 | (frame rate) The cost is filling pixels over ground already shaded by its long shader | The woods drawn before the ground (`renderOrder -1`), so the ground behind them is never shaded: from the play camera the woods now SAVE 5-10% on Medium and High; from tee 5 they cost about 0.08 ms on Low and Medium |

Tests: tests/far-woods.test.mjs (outside the property, never in water,
deterministic, wooded in the first 60 m and in every kilometre out to 12 km,
coarser with distance; Low and Medium draw groves, never nothing).

## The far-landscape and mowing goal (26 October 2026)

The third goal on the branch, after the owner looked at the polish goal's
build. The brief is local (`docs/reports/cartoon-distance-goal.md`). Nine
items: the far landscape on all ten landscapes (ten rounds, every round
judged on every landscape); the tee's clean-up lap as one continuous pass;
ten more rounds of links shared fairways; diamond-mowed greens; the straight
tone step on Midwest hole 2; trees in the ponds' reflections (fifteen
rounds); waves at the water's edge (twenty); the tee pad's colour; and a
smoke run that can replay an Endless seed. Frame rate: at most 5% slower per
tier than the goal's start, measured on every landscape the far landscape
changes, Low and Medium first. The wait as a course loads is written down.

**The start**, kept for comparisons: `bench/ab/start-distance.html` (the
built game at 90dc61d), and a capture build of it,
`bench/shots/dist-start/` -- made by `bench/shots/overhaul/_startbuild.mjs`
(scratch), which swaps every source file changed since 90dc61d back to its
starting text through `build-hooked.mjs`'s SWAP. The polish goal's last
pictures (`latest/`) are kept as `dist-r0/`.

**The Endless replay** (the goal's last item): `node tools/smoke.mjs --only
endless-round --endless-seed HARROW-4021`, whole logs kept
(`bench/shots/overhaul/harrow-4021*.log`, local). The first try failed on the
harness's own seed check (the map names the course, `HARROW-4021-1`); fixed.
Then two passes and one failure at "putt out" with the scorecard on screen
counting down: the run holes its par-5 first in 2, an albatross, and the card
comes about 12 s after the journey's checks (4.9 s after a birdie) -- right
on the harness's 12 s wait. **The harness was wrong, not the game**: the wait
is 30 s now, and four replays since are green. Whether that long a pause
after an albatross feels right is left for the owner in TODO.

**New views** (tools/capture/overhaul.mjs): `far-out` and `far-side` stand
40 m past the property line, 45 m up, looking out (south and west), and
`far-high` 160 m up over the course's edge -- `far-band` stands inside the
course and on the wooded landscapes looks into its own trees.

### The far landscape (far-landscape goal)

The owner: "I don't like the way that the distance geometry turned out ...
Lakeshore Dunes and Links have trees underwater? Desert has sort of a clear
line where it transitions and rocks don't look great out there. I think we
need more plateaus. Iterate. iterate. iterate. Floating assets out in the
distance landscape doesn't look good."

**Diagnosis.**
- **The "trees underwater"** were the painted far forest (ground.js, THE
  FOREST ON THE FAR HILLS), painted on the sea bed as on any ground; the
  clear shelf showed its crowns through the water (`dist-r0/links/far-band`).
  Only one far grove in 2,394 actually reached the sea.
- **The floating** was the far woods standing on the landscape's fine relief
  (`ringRelief`, sampled where each crown stands) while the ring DRAWS that
  relief as triangles up to hundreds of metres wide: a crown's centre stood
  up to 150 m over the drawn valley (Lakeshore, Desert), and a grove's
  bowl-shaped underside lifted its rim off flat ground by a tenth of its
  width. On Desert the hovering olive slabs are the "rocks" out there.
- **Desert's line**: the painted canopy starts at the property line as a
  dense regular carpet of crowns over the sand and stops at a hard edge.

**The metric** (`node tools/bench.mjs farSeated`, every course, no setting):
every far crown and grove, in each form it may be drawn as, checked on its
own sixty points against `drawnGround` -- the ring's own triangles: its flat
base no more than 2% of its radius (at least 30 cm) above the ground
anywhere under it (PLACED: under a pixel at a crown that size's distance),
and none of it in water. Before: hundreds floating on every landscape (up
to 150 m); after round 1: **0 of 920,167** on the full tier.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | The two faults above | The ring as plain arrays (`ringMesh`) and `drawnGround`, its height at any point, read from the triangles the renderer draws; `drawnVertices` lists the drawn vertices under a footprint. Every far shape flat-based at its origin (`FAR_SHAPES`, `farWoodGeometry`; the three lumps of a cluster cut on one floor), seated by `seatOn`: held under rings of samples on its rim (spaced for the slope) and every drawn vertex under it, a grove tilted to the ground's plane (to 30 degrees) -- a canopy follows its hill -- and drawn at two thirds the size, twice at most, where the ground under it is so broken it would be buried past a third of its height; any part over water leaves it out. The painting stops a metre above the sea (`farSea`). The sea is clear on Links and Lakeshore; the groves sit on the hills (`far-r1/`) |
| 2 | Desert's line at the ground's edge, Mountain's pale streaks, and no plateaus | The ring takes the landscape's own ground (ground.js, THE FAR RING'S OWN GROUND): its floor carried on past the course's ground (Desert's hardpan), its rock on steep faces (`ringFace`: rock, Desert's layered banks, none on the dune and island coasts), patterns settling to their average where under a pixel. Desert's far land as mesas and buttes (`ringMesas`, landscape-edge.js): a 4 km field warped by 700 m, two tiers (0.62 and 0.36 of the lift, cliffs a few rows wide) with talus aprons, over a quiet floor; its rings 16% apart up to 220 m (were 28%, unbounded) and 2.5 times as many round -- 96,801 triangles (CPU relief maps `ring/desert-mesa1.png`, a scatter of jagged fragments, then `-mesa2.png`, broad tables). Captures pending |
| 3 | Each landscape's own far features: Island's horizon was empty sea; Haunted Hollow's near far woods were purple lumps reading as living woods; Autumn's far land was a flat plain of identical domes | Island's far sea raises five islets (`ringIslands`, landscape-edge.js `isles`: low hills 24-70 m with a beach skirt, 260-780 m across, 2.5-6 km out, on the denser rings; the far woods plant them -- `ring/island-isles2.png`; a first cut gave rings of land, three's smoothstep not taking reversed edges). Haunted Hollow's near crowns are clumps of three bare dead trunks with broken limbs (`snags`). Autumn's far woods a fifth evergreen (`farForest.evergreen`: spruces near, cones far, in its fourth colour), and its far land rising to 170 m (was the default 70). Links' inland ring already carries its dunes (13-40 m): left. Captures pending |
| 4 | The LOD seam: a line round the course at 420 m, 6 m crowns inside, 19 m domes outside | Each site switches from crown to grove somewhere in a 240 m band (300-540 m, by its own hash), and a near crown grows with its band's spacing (to 40% of it), so the two sizes meet |
| -- | Rounds 1-4 captured together on all ten landscapes (`g3-r1/`, views far-out, far-side, far-high, far-band; the goal's start in `far-r0/`) | Judged: no floating anywhere; Links' and Lakeshore's shallows clear; Island's islets on the horizon; Desert's mesas read as tables, buttes mid-distance; Midwest, PNW, Giant Redwood wooded to the horizon. Wrong: Desert a dense shrubland (round 4's growing crowns) under a dark painted carpet, its mesa sides sand; Links' near far-crowns faceted olive boulders over the dunes; Mountain's far faces still in long pale vertical streaks; Autumn's evergreens a plantation of dark spikes; Haunted Hollow's far groves living canopy mounds; a straight line across Island's sea where the ground map ends |
| 5 | The above | Desert and Links as SCRUB (`farForest.scrub`): low clumps (`scrub`, 0.54 r tall) at their own small size, thinning with distance, and the painted canopy's strength per landscape (`paint`: Desert 0, Links 0.35). Haunted Hollow's far woods dead trunks to the horizon (`dead`; grey floor, `paint` 0.45). Autumn's evergreens a tenth (were a fifth). The ring's faces rock from a gentler steepness (0.74-0.9 of up, the coarse facets put a mesa's cliff at 40-50 degrees), and the steeper the plainer (no vertical smears); Desert's faces its red rock. The sea's depth carries on past the ground map, deepening over 400 m (renderer.js WATER_EDGES `sea`). Captured (`g3-r2/`, all ten): Desert a desert at last -- bare sand, sparse scrub, red-rock mesas on the horizon and buttes mid-distance with banded red sides; Links scrub dotted over the dunes, no boulders; Haunted Hollow a purple moor with sparse dead trunks to the horizon. Still wrong: Mountain's pale streaks (not the pattern -- whole steep facets bare of the painted forest, pale rock under the haze); Autumn's evergreens still stand out |
| 6 | Mountain's streaks: past the course's ground the painted forest gave up at 42 degrees, and the ring's coarse facets are steeper than the land they stand for; the bare rock under them pale | Past the course's ground the painted forest holds to 55 degrees (0.36-0.58 of up, was 0.5-0.74); the far rock darker (0.78 of the rock's colour, was 0.93); Autumn's evergreens 6%. Captured (`g3-r3/`, all ten): Mountain's streaks gone, its slopes wooded to the snow; Island's islet on the horizon; Lakeshore, PNW and Giant Redwood wooded to the edge. Still wrong: Desert's and Links' scrub spread evenly, dots on a cloth; Desert's buttes sand-coloured cones, red rock only on an edge; Autumn's far evergreen cones standing up past the horizon as a row of pale spikes; Haunted Hollow's painted floor a cobbled pattern of round patches |
| 7 | The above | Scrub in clumps: a second, finer patchwork (150 m) keeps about two sites in five, gathered, with bare ground between (far-woods.js). A mesa landscape's ring faces turn to rock from 0.86 of up (others 0.74; ground.js `ringFaceFrom`), so a butte's 25-40 degree sides on the coarse rows show their red rock. An evergreen among broadleaves is a dark dome far off, not a cone (`EVERGREEN.grove`). Haunted Hollow's painting 0.25 (was 0.45). Scenery and paint: the fingerprint unchanged. Captured (`g3-r4/`): Desert's buttes red rock on every side, tables on the horizon; Autumn's evergreens dark crowns in the canopy, no spikes on its horizon; Haunted Hollow's moor calmer. But the scrub only thinner, still even: the patchwork's values gather round a half, so a gate from 0.5 to 0.7 thinned without gathering |
| 8 | Scrub thinned, not clumped | The clump gate narrow, 0.53-0.58, so the patchwork cuts into clumps and bare gaps (Desert 2,006 far sites, Links 1,132; round 7 1,674 and 958). Captured (`g3-r5/`): from high over Desert (`far-high`) the scrub now lies in clumps with bare sand between; from 45 m up at the property line (`far-out`) the view sits inside one 150 m clump, evenly spaced within it -- as creosote grows, each bush holding its own ground -- and left so |
| 9 | Lakeshore's far land a wall-to-wall carpet of identical crowns under a full painted canopy -- on a landscape named for its dunes | Dune woods: cover 0.5 (was 0.75) and the painting 0.6, so open dune and meadow lie between the woods (7,723 far sites, were 12,851). Captured (`g3-r6/lakeshore/far-out`, `far-high`): dune woodland -- woods broken by open dune, meadow and sand blowouts, as its name says |

The wait (measured each round on an 18-hole course, seed `overhaul`,
against the goal's start; scratch `_fartime.mjs`): after round 4, placing
the far woods takes 0.30-0.53 s (start 0.05-0.12): PNW +0.41 s, Giant
Redwood +0.39, Autumn +0.34, Desert +0.31 and its denser ring +0.09 (ring
0.11 s, was 0.02) -- under the goal's half second, written down as a real
cost. What brought it down from 4.2 s (round 1's first cut): lakes and
creeks asked directly instead of the whole surface classifier at every
sample; a crown seated only in the form its tier draws; the treeline, water
and slope tests on the drawn ground; fewer fixed samples with refinement
only where the ground bends (83 lookups a crown, was 119); the ground
lookup without an object per triangle.

### The tee's clean-up lap (far-landscape goal)

The owner: "The clean up pass on the tee box should not make a checker
pattern. It should just be one continuous pass." **Diagnosis:** the lap took
the bands' tone turned over (ground.js, the tee pad's mowing, `tband`), so
wherever a light band met it the lap went dark and vice versa -- a checker
round the pad.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | The checker | One tone all the way round (`-0.55` of the bands' contrast): a mower's single lap. Captured (`g3-r1/*/tee-top`, `h1-teekit`): one continuous darker ring round the pad, no checker |
| 2 | One flat dark ring reads as a border painted on, not a pass of a mower | The one pass shades as a pass does: grass laid away from you light, toward you dark, by the lap's way of travel (along the pad's outline, from the pad's own rounded-box distance) against the view, turning smoothly as it goes round -- never in steps. Captured (`g3-r5/*/h1-teekit`): one continuous pass round the pad, no checker anywhere -- but so faint from the tee it barely reads (`tee-surround` in `g3-r4/` stood too far off to judge) |
| 3 | The lap barely there | The lap at half again the bands' contrast (0.11, the bands 0.075). Ground shader key v64. Captured (`g3-r6/*/h1-teekit`): the lap reads from the tee as one continuous pass round the pad, lighter along the side running away, no checker |
| 4 | The lap's inner edge a pixel-sharp line, which reads as paint | Soft over 8 cm at least, as a mower's edge is. Ground key v68. Captured (`g3-r9/*/h1-teekit`): the lap's inner edge soft, the pass still one continuous ring |
| 5 | The tee's bands were fixed tones while its lap shaded with the view | The bands shade with the view too: the passes run along the line of play, so from the tee one band is light, the next dark, swapped looking back, and side on they all but vanish (the view along the pad's axis, x 1.3, clamped). Captures pending |

**The tee pad's colour** (the goal's item 8; TODO: "the tee pad reads as
one flat, very saturated green"). Round 1: the pad and collar in their own
turf, half fairway, half fringe, 15% toward grey (it wore the semi-rough's
colour) -- captured: in the family, but minty against the fairway beside it.
Round 2: two thirds fairway, a third fringe, 4% darker, full saturation --
captured (`g3-r2/*/tee-top`): in the family everywhere, Desert's deep and
rich against its sand. Round 3: 10% toward grey -- captured (`g3-r3/*/tee-top`):
in the fairway's family on every landscape, Links' pad a soft dune-turf green,
Desert's still the deepest green on the course but no longer minty. The three
rounds done; left there.

### Diamond-mowed greens (far-landscape goal)

The owner: "I want greens to be diamond mowed." A green was cut in single
bands 1.6 m wide along one line (ground.js, MOWING STRIPES THAT FOLLOW THE
GROUND). Its clean-up lap had the tee's fault: the bands' tone turned over,
laid on top of them, a checker at the green's edge.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Single bands; a checker lap | Two passes crossing at right angles, each 45 degrees off the old line, with the same period, bend and fade as before: each spot carries both passes' tones -- light, dark, or a middle tone where they differ -- diamonds. The lap REPLACES the passes' tone with one of its own (0.55 of the contrast below the middle). Paint only. Captured (`g3-r1/*/h2-putt`, `h2-green`; again `g3-r3/`): diamonds plain on the putt, faint from the approach, the lap one tone |
| 2 | Hard-edged, the diamonds read as tiles | Soft edges: grass laid one way shades into grass laid the other over about a hand's width (the step widened by 0.45 of a period's half-wave each side). Captured (`g3-r4/*/h2-putt`): far too soft -- each pass nearly a plain wave, and two waves averaged left a faint blur; on Links' putt the diamonds all but gone |
| 3 | The lap one flat tone round the green | That one pass shades as a pass does (the tee lap's round 2): light where its way of travel runs away from you, dark toward you, turning smoothly round the green. Its way of travel is the edge distance's slope over the ground, recovered from the screen's own derivatives (world position against the green's edge distance) and turned a right angle. Ground shader key v63. Captures pending (round 4's pictures cannot judge it: the passes beside it had lost their contrast) |
| 4 | Round 2's blur | The soft edge 0.15 of the half-wave each side (was 0.45): a crisp diamond whose edges do not step. Captured (`g3-r5/links/h2-putt`): the diamonds back, crisp and gentle; from 24 m (`h2-green`) they fade into the green's tone, as the bands always have at that distance |
| 5 | Gone from the approach | Each pass holds its pattern until a period is 5 pixels across (was 8) before fading to the middle tone (the fade is what keeps a fine pattern from shimmering). Ground key v65. Captures pending |
| 6 | The collar one flat tone round the diamonds and their lap | The collar mown in its own lap (ground.js, THE COLLAR'S LAP): shaded by its way of travel round the green against the view, as the green's lap (round 3), at 0.06 -- gentler than the green's -- and faded where the collar is under a pixel or two across. A capture view of a range target green (`range-green`, with `--course '{"range":true}'`) for "plus the range greens". Ground key v67. Captured (`g3-r8/links/h2-green`, `g3-r8-range/midwest/range-green`): the collar shades gently round the green; the range's 100-yard target green is diamond-mowed with its lap, as the course's are |
| 7 | The diamonds were painted tones, the same from every side; cut grass is light laid away from you and dark laid toward you | Each pass shades with the view: pass 1 travels along pass 2's normal and pass 2 along pass 1's, and each band's tone is its light or dark times how squarely its line of travel runs with the view (x 0.33 each, so the two together reach the old range). A diamond turns from light to dark as you walk round the green; at no view do both passes vanish (they cross at right angles). Ground key v70. Captures pending |

### Trees in still water (far-landscape goal)

The owner: "Trees in calm ponds' reflections, from the bank and a tee ...
Be efficient here." Fifteen rounds. A pond reflected a cube probe taken from
its middle 4 m up (renderer.js, REFLECTIONS ON EVERY BODY): right for the
sky, wrong for a bank -- a tree beside the water sits elsewhere in a mirror
seen from across the pond than in a picture taken from its middle -- and
the polish goal found its trees did not show at all (`dist-r0/midwest/h1-pond`:
a flat teal sheet under a wooded bank).

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | No trees in the water | `src/water-mirror.js`: twins of the trees round each still pond (the far woods' cluster or spruce, sized to the tree's crown and height, with a trunk), turned over about that pond's own level, drawn each frame with the ordinary camera into a picture half the screen's size, unlit; still water reads it at its own pixel, nudged by the ripples, lit by the light the water gets, as far as the surface is a mirror (renderer.js WATER_EDGES `still`). High and Ultra only (`mirrorTwins`), and drawn only while a still pond is within 700 m. Captured (`g3-r1/lakeshore/h1-pond`): the bank's trees in the water, trunks down from the waterline, crowns below, where a mirror puts them -- but pale and washed out, the trunks posts |
| 2 | Pale; trunks too heavy | The twins at 0.55 of their lit colour (were 0.8), mixed by min(0.92, 2.2 x Schlick + 0.35) (was 1.6 x + 0.15); trunks 1.4% of the height (were 2.5%). Captured (`g3-r2`): darker, but on Lakeshore scattered faceted patches with stick trunks, and from close to (`shore-near`, Midwest, PNW) crowns lie in the near water as flat patches |
| 3 | Only trees within 30 m of the rim mirrored, so a wood's edge reflected as a few patches; the facets showed | Trees within 60 m plus their height; trunks 40% of the height (were 55%); the picture read as four taps 1.5 of its pixels apart, averaged (a surface softens a reflection) |
| 4 | Its strength had a floor of 0.35 of the mirror, so looking steeply into near water still showed crowns | By the mirror term alone, min(0.92, 2.8 x Schlick). Captured (`g3-r3/*/h1-pond`): Lakeshore's far bank reflected as a wood of crowns, the best yet; but the trunks still posts, and on Midwest and PNW a few crowns lie mid-pond as separate patches |
| 5 | Trunks as posts; the facets | No trunks; the picture read four taps 6 of its pixels apart (was 1.5) |
| 6 | Without trunks the crowns float mid-pond, cut off from the bank: between a bank and its trees' reflected crowns lies the shade under them | Each tree's foot to its crown a dark column (7 sides, open), 0.7 of the crown's width, at 0.32 of the crown's colour: the reflected woods' shadowed floor, joining crown to bank. Captured (`g3-r4/*/h1-pond`, `shore-near`): the far bank's woods now stand in the water as one dark reflected band joined to the bank, crowns below it -- Midwest's pond reads as still water under a wood for the first time; no posts, no floating patches. Close to, the columns show as soft vertical slabs, which reads as the shade under trees |
| 7 | In Autumn's pond (`g3-r5/autumn/h1-pond`) the columns, in the crowns' own orange at a third, stood as a row of orange-brown boxes | The columns half toward a dark neutral (#1e2418), so neighbours merge into one dark band, and narrower at the foot (0.7 of the top). Captures pending |
| 8 | The sky's probe showed right up to the shore: nothing in the water said the bank rises there | The bank itself: a skirt per pond from its own outline (the ShapeGeometry its water is made from), from the waterline 1.5 m out and 0.5 m up, turned over like the trees, in the rough's colour at 0.45 toward the shade tone -- a thin dark band under the waterline that the reflected woods hang from. Test: under the water, outside the pond. Captured with round 9 (`g3-r7/`): a dark band under each far bank's waterline |
| 9 | Round 7 captured (`g3-r6/autumn/h1-pond`): the columns merge into one dark band, but the reflection is mostly that band, with small orange crowns at its foot -- above the water these broadleaves fill most of their height | Crowns a third larger (1.35 of the crown radius) and up to three quarters of the tree (was 70%), so the columns shorten to the trunk zone. Captured (`g3-r7/autumn/h1-pond`, `midwest/h1-pond`): the autumn wood turned over in the water, big crowns over a short dark trunk band joined to the bank; Midwest's pond likewise |
| 10 | Every pond broke its reflection the same, calm or blowing | By the wind (`mirrorWind`, 0 calm to 1 at 15 mph): the ripples nudge the picture 0.006-0.024 and soften it over 3-9 pixels -- a calm pond near a true mirror, a windy one broken up; at the default 4 mph about as before. Captured (`g3-r9/`, the default 4 mph): as before, as intended -- the wind's range waits for a windy round in play |
| 11 | Only trees over 3 m were mirrored, so the first metre of each reflection under the bank was empty | Bushes too: 1.2 m and up, where they stand within 15 m of the rim (trees keep 60 m plus their height). Captures pending |

**Diagnosis of the old reflection** (round 0): every Midwest and Autumn pond
had its probe, and the probe holds the trees -- its six faces read back
from the game (scratch `_probe2.mjs`, `diag-probe/face0-5.png`) show sky,
clouds, the treeline and the ground. A pond swapped for a plain mirror of
its probe (`diag-mirror/`, the capture tool's `--eval`) came out black, not
yet explained. A test of the pond at three probe strengths
(`_probe3.mjs`) hung with its browser open on 26 October 22:40 (local) and
was stopped; retried once after ten minutes, it ran (`diag-probe/ponds.png`):
from the bank at eight times its strength the probe turns the pond pale sky,
and without it the pond loses only that -- the trees the probe holds, seen
from its middle and softened by its blur and the ripples, never survive to
the screen. So the twins carry the trees and the probe the sky.

### The straight tone step (far-landscape goal)

TODO: "a straight step in the fairway's tone, Midwest hole 2" (seed
`overhaul`, view `h2-green-b`); the owner: "Seen mostly around greens but
can extend far out from the greens." Five rounds.

**Diagnosis.** Not paint: the course's own classification agreed with the
paint everywhere (a scan for surface changes at hole-ownership boundaries
found 2 points in 160 m), the fairway tapers smoothly into the green, and no
shaping box was short of its blend. The capture tool's `--eval` painted the
ground by its shading direction (`diag-normals/`), and with the contrast
stretched the direction broke along one straight line, flat plane on one
side, natural slope on the other. A map of the ground's slope breaks
(scratch `_crease.mjs`, the second difference of `w.height` at 0.25 m)
showed two straight lines over 120 m, through the green's front, at one
fixed distance along the hole: a step 0.32 m high over 4.5 m. It was the
**false front** (course-plan.js greenContour): the ground in front of a
false-fronted green is dropped 0.3-0.9 m over a few metres -- and the drop
had no sideways limit, so the green's shoulder carried a straight step out
through the rough on both sides, which the cartoon light's steps drew as a
line.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | The false front's drop ran the width of the world | Across the green's own width only, fading over 12 m beyond each side: the putting surface unchanged, the long lines gone from the crease map (`diag-normals/crease-h2c.png`: only the short crease across the green's width remains). Generator 49 (every landscape's ground moved beside false-fronted greens) |
| 2 | Look elsewhere | Crease maps round four more greens (Midwest 1, Autumn 2, Links 3, Desert 4; `crease/sheet.png`): no long straight crease left; Autumn's false front ends 12 m past its green. Short stair-stepped lines on Links and Desert lie in the coarse ground, not at the refined cells' edge (`crease/links-h3-cells.png`, refined cells tinted): sharp local features (a tee's terrace) drawn in 3 m steps by the grid -- short, and not the owner's line. Left as found |
| 3 | In the game (`g3-r2/midwest/h2-green-b`) the line was still there. Diagnosed again with `--eval`: shadows off, the ground's and the plants' shadows off, every other caster off -- the tones either side measured identical in every picture (`_pix.mjs`: 66,122,1 against 51,115,21), so not a shadow (an earlier reading by eye said it was). It is COLOUR: the slope tint yellows mown turf between about 1 and 6 degrees (ground.js, `dry`), so any crease in the ground is a colour line -- here the false front's own crease, now confined to the green's width but still straight across it, and this view looks along it | The false front's drop starts along an ellipse of the green's proportions, 74% of the way to its front edge, so the crease curves round the front as the edge does (`diag-normals/crease-h2d.png`). Generator 50. Captured (`g3-r3/midwest/h2-green-b`): the straight line before the green gone, the dark band at its front curving with it. A soft olive patch remains across the approach, its edge irregular -- and the same view on Links shows one in the same place |
| 4 | Is the patch a cloud's shadow? Both views are at noon with clouds overhead, and the crease map round the green (`cmp/crease-r3.png`, 160 m) shows no line under it | The same views captured with cloud shadows off (`--eval`, `cloudDepth` 0; `g3-r4-noclouds/`): the band is still there on both. Not a shadow. A map of the ground's slope alone (scratch `_slopemap2.mjs`, white at a tangent of 0.1, `cmp/slope2-mw-h2.png`) showed a straight line through the green's end, square across the hole, out through the rough on both sides -- and the approach band in the picture is the slope tint lying on one side of it |
| 5 | The line through the green's end. Probed across it (scratch `_owner.mjs`, the generator's own nearest-hole distance and analytic height): the distance from the hole JUMPED 0.76 m half a metre before the hole's end, and the slope kinked there. Two faults, both at every hole's end in every landscape: (1) a hole's side widths are widened by its centre line's slope, read between points half a metre either side -- in the last half metre the point ahead fell past the green, where the centre line stops, so the slope read halved and the width dropped 1.3 m (28.98 to 27.67 m) in half a metre; (2) past the end the distance was taken from the end point, ignoring the way the centre line was running, a kink along the same line. The hills fade in by that distance, so the ground creased, and the slope tint (which yellows mown turf from a tangent of 0.015) drew it | (1) The slope read from points kept inside the hole (course.js `lean`); (2) past either end the centre line carries straight on along its end direction, so the distance turns smoothly and still rounds the green's back (`ends`). Probed again: no jump, no kink (`_owner.mjs`: the slope -0.124 to -0.117 smoothly across where it stepped). The line is gone from the slope map (`cmp/slope4-mw-h2.png`). Looked elsewhere: Links' hole 2 (`cmp/slope4-li-h2.png`) has a long straight-looking edge that probes as the hill rising smoothly off the corridor, and a small kink (0.03) in the rough where the next hole's tee takes the ground over -- left as found. Generator 52; every landscape's ground moved. tests/green-surround's "the approach does not creep in as the slider rises" checked any 2 m movement either way; on PNW the nearest approach tree moved OUT (53.4 to 57.3 m, all past the 46 m clearance) as the planting reshuffled, so the check is now one-sided, as its own words say. Captured (`g3-r5/midwest/h2-green-b` against `g3-r4-noclouds/`; `cmp/r5-tone.png`): the straight edge is gone; what remains is a soft, lighter band where the ground falls from the green's front shoulder -- the slope tint drawing a real slope, with no crease in it. Links' same view likewise. The five rounds done; the TODO entry says what to check in play |

### Waves at the water's edge (far-landscape goal)

The owner: "Waves on the edges of ponds, lakes, ocean, rivers, creeks, 20
iterations on making them look more realistic and not just reading as a
sine wave on the edge. Be efficient with this as well." Twenty rounds.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | A pond's foam (renderer.js FOAM_FRAG) was one band breathing in and out with a sine of the world position, the same way all round | Wavelets ARRIVE: two trains running along the shore (metres along the outline, `shoreLength`, each a whole number of wavelets round so they meet where it closes), each wavelet its own reach from a slow noise; a lip at each front and a thinner wash left behind it. The foam strip closed with a copy of its first point, so the along-shore coordinate never wraps inside a quad. Captured (`g3-r2/*/shore-near`, a new close view of the first shoreline): the pond's foam thin broken lines at the bank; Island's surf broken patches along the beach |
| 2 | Before the foam, nothing on a pond's water said a wavelet was coming in | Wavelet crests running in along the depth lines toward the bank (so they follow its shape), in the last 0.7 m of depth, broken along their length by a drifting noise, catching the light (renderer.js WATER_EDGES `still`). Captured (`g3-r3/*/h1-pond`, `shore-near`): on Lakeshore too many white streaks over the whole near water; Island's surf broken patches along the beach, believable |
| 3 | Crests everywhere | Crests only between 0.08 and 0.4 m deep, gated by a broad drifting noise so whole stretches of shore are quiet, and dimmer (a lift of 0.1-0.12, was brighter). Captured (`g3-r4/`): the white streaks gone from the open water; a few flecks near the bank where it is shallow |
| 4 | Seen from a tee, a pond had no edge at all: its wavelets are small | The wet line where water meets bank, always there, 3-12 cm wide and breathing slowly along the shore, faintly laced (renderer.js FOAM_FRAG, `wet`; shore foam key v4). Captured (`g3-r4/midwest/shore-near`): a thin pale line traces the whole bank, with small lips lapping in here and there -- the edge of still water; from across the pond (`h1-pond`) it holds the outline without a white ring |
| 5 | Rivers and creeks carried foam drifting with the flow and nothing else: running water had no waves of its own | STANDING ripples (renderer.js WATER_EDGES `river`, `creek`): chevrons pointing downstream, fixed to the bed while the water and its foam pass through them, in patches where the bed is rough (a slow noise in the channel's own coordinates) -- faint on a river, stronger toward its banks, tighter and brighter on a creek. Water key v18. The fixed course has no running water, so the capture tool takes `--course '{"rivers":1,"creeks":2}'` and a view of the nearest stream (`stream-near`). Captured (`g3-r5-streams/`): Midwest's and PNW's creeks dark water with a few white flecks; the riffles too fine to see from the bank (crests 0.6 m apart); Mountain's camera stood in a tree's crown |
| 6 | Riffles finer than a pixel from the bank | Creek crests 1.25 m apart (were 0.6), in more and stronger patches (0.55); river crests 2 m apart (were 1.1). Water key v19. The stream view 6 m up. Captured (`g3-r6-streams/`): still not judgeable -- Midwest's creek in a tree's shade, seen from too far; Mountain's camera again in a crown. The view now stands 4 m beyond the bank, 4 m up, at noon, at the nearest stretch with no tree within 7 m; and a new view of the surf (`sea-near`), since `shore-near` on Island looks along the beach with the sea at the frame's edge |
| 7 | On the sea every swash ran up to the same line, a metronome | Waves in sets: each 9 s cycle its own reach, 45% to all of the run-up, from a hash of the cycle's number (renderer.js WATER_EDGES `sea`, `reachK`); where neighbouring stretches of coast change cycle the swash is fully back, so no seam. Water key v20. Captured (`g3-r7/island/sea-near`, the new surf view): a lacy swash band along the sand, laced unevenly; sets cannot be told from one picture -- the owner's eye in play |
| 8 | A pond lapped the same all round, whatever the wind | Wavelets build across open water and land on the bank the wind blows onto: each point of the foam strip carries how squarely its bank faces downwind, scaled by the wind's strength (full at 12 mph; `foamWind`), and the wavelets reach 0.45-1.25 of their run and their lips 0.5-1 of their strength by it; the wet line is the same everywhere. At the default 4 mph the banks differ gently. Shore foam key v5. Captures pending |
| 9 | Rivers and creeks had no edge line, where ponds now have one | The wet line at a river's and a creek's bank (the outer 7% of the half-width, at 0.35, laced on a river). Water key v21. Captured with round 10 -- see there |
| 10 | Seen in `g3-r7-streams/`: a creek's water began in a hard square edge across the channel, and the riffles showed as white dashes, not Vs | Each channel's water fades in over its first 3 m and out over its last (streams.js `chanEnd`, metres to the end; read only by the river and creek shaders). Water key v22. Captured (`g3-r8-streams/`): **every river and creek failed to compile** -- the fragment shader used `vChanEnd`, declared only in the vertex patch (the capture tool logged the shader error on all three; the streams drew no water). Declared in WATER_NOISE as well; water key v25. Mountain's view now clear of crowns. Recaptured (`g3-r9-streams/`): the water back on every stream, and where Midwest's creek begins it fades in, no square edge |
| 11 | Lakeshore's freshwater lake is drawn as sea, and swashed like the ocean -- long 9 s run-ups up the beach | A lake's swash its own (`seaSwash`, from the landscape's `lakeWaves`): a 5 s cycle and 0.6 of the run-up; the ocean keeps 9 s and all of it. Water key v24. Captures pending |
| 12 | The sea's line of breakers ran unbroken all round the coast | The breakers come and go in stretches: gated by a broad noise (about 80 m across) drifting slowly along the coast. Captures pending |
| 13 | A creek's riffles showed as white dashes, not Vs | Broader crests (0.3-0.85 of the wave, were 0.45-0.9), an opener V (0.35 a metre across, was 0.6), in more of the bed (gate 0.3-0.55) and stronger (0.7). Captures pending |
| 14 | Where the sea's swash runs up a beach the sand stayed dry-coloured to the waterline | Wet sand (ground.js WET SAND): on a landscape with a sea, sand from the water's edge to about 0.45 m above it (and under it) darkened to about three quarters, toward a cool grey, stronger toward the water; sand only (red at least green), so low grass keeps its colour. Ground key v69, water key v26. Captures pending |
| 15 | Round 9 (`g3-r9-streams/mountain`): the wet line ran down both banks of a creek as an unbroken white line and its riffles as dashes down the middle -- the creek read as a road | The streams' wet line faint (0.14, was 0.35) and broken by noise; a creek's riffles softer (0.4, was 0.7). Water key v27. Captures pending |
| 16 | Every pond's wavelets the same length, 7.3 and 11.9 m, whatever its size | As long as the water lets them grow: a small pond's fetch is short, so its wavelets come shorter and closer -- 0.6 of the length on a pond 180 m round, rising to 1.2 on one 360 m and more. Shore foam key v6. Captures pending |

### Links shared fairways, the far-landscape goal's rounds

The owner: "10 more passes on making thoughtful fairway connections on
links." Judged from above (`tools/surface-map.mjs`, which now takes
`--share '<json>'` to try a rule before writing it) on the seeds `overhaul`,
`LINKS-A` .. `LINKS-D` and `S5` (18 holes; `share3-r0/` ..), and measured:
every pair of holes whose fairways run within 26 degrees of parallel for 60 m
or more, with the rough between them (scratch `_sidebyside.mjs`), and why
each join was refused (`shareFairways`' debug sink, which now also names a
run too short, a partner that did not reach back, a hole touching nothing,
and each pair's coverage).

**Diagnosis.** Of 35 side-by-side pairs on six courses, 4 were joined;
LINKS-A, -B and -C shared nothing. Most of the rest are STAGGERED: two holes
out and back whose fairways each lie beside the other's teeing ground (a
links fairway starts 85-110 m out), so they overlap only in the middle.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | The 140 m minimum refused real pairs | Tried 100 m: two crossbars came back (`overhaul` 9-15, LINKS-B 8-9: fairways crossing at an angle, joined over their middle). Kept 140 m this round (judged) |
| 2 | Each hole decided alone; later passes undid half-made joins | A join is decided for the PAIR, from both holes (`cover`): taken only where the two fairways run alongside for a share of each one's shareable stretch. Measured: the crossbars cover 60-63% of both fairways, the double fairways 66-100% |
| 3 | Pairs taken stood 5-16 m apart and were then given back ("touches nothing"): the taper toward the fairway's ends ran 100 m in (ease x 0.6), leaving 27 m of a 230 m stretch at full width | That taper over 36 m (`endEase`); the pair's coverage judged on the mean of its two holes (LINKS-D's 1-2 covers 62% / 85% and is one big merged fairway). Links: run 100 m, cover 0.66. Joined holes per course 2, 2, 0, 2, 4, 4 (were 2, 0, 0, 0, 2, 4): LINKS-A's 11-12 and LINKS-C's 9-10 are new double fairways, no crossbar on any (`share3-r3/`, the rule as set) |
| 4 | Most side-by-side pairs are staggered by the routing itself: a hole routed back beside another starts level with the last green, so its fairway (85-110 m out) lies beside the other's teeing ground | routing.js: a hole running back beside another is also offered its tee further back past the green's level, scored by its walk as any placement is. Tried 30 and 60 m: 31 joined holes on ten courses (were 20), but `overhaul` lost its pair (0) as the routing chose differently (`share3-r4/`). S3 shows a triple shared area (1-2-3) |
| 5 | Which shifts | Swept over ten courses: none 20, 30+60 m 31, 25+50 m 31, 40 m 32, **60 m 38**, every course 2 or more (`overhaul` 5, LINKS-A 2, -B 6, -C 3, -D 5, S5 4, S1 4, S2 4, S3 3, S4 2). Links `routeParallel.shifts: [60]`. From above each join is one broad double fairway with a natural notch (`share3-r5/`) |
| 6 | Where a join runs out, the rough between the two fairways narrowed over the whole 170 m ease to a hairline point: a long sliver | Each side keeps half a strip (7 m) of rough until the last quarter of its taper, then closes on a circle's profile (`roundTip`): a rounded tip about a strip wide. Over ten courses the samples with a 1.5-8 m sliver between fairways fell from 50 to 42, strips of 8-20 m rose from 270 to 278 (scratch `_slivers.mjs`; maps `share3-r6b/`). Generator 48 |
| 7 | A double fairway was a bare lawn: nothing on it said two holes share it, or which side to play | Pot bunkers on the seam (course.js `seamBunkers`, Links `seam: 2`): up to two a join of 60 m or more (one under 90 m), 3.6-5.2 m across, 38% of the way from the lower-numbered hole's line to its partner's, in the middle half of the join, 45 m apart -- the Old Course's Coffins and Principal's Nose. Over six courses 1-5 each (`overhaul` 2, LINKS-A 1, -B 5, -C 1, -D 2, S5 1; `share3-r7/`). The biome fingerprint is silent (its two nine-hole Links courses have no join long enough); generator 51 all the same. A new capture view from each shared hole's tee (`share-tee`, `share-tee-b`) for judging from the game. Captured (`g3-r5/links/share-tee*`): the seam bunkers too small to see from the tee -- and so was the shared fairway itself: waist-high grass filled the 100 m carry in front of the tee and hid the broad fairway beyond, a thin green strip on the horizon |
| 8 | From the tee the fairway the golfer aims at was hidden by the grass in the carry | The carry kept short (vegetation.js `carryFade`): inside a hole's corridor between its tee (from 30 m behind) and the start of its fairway, the tiled tall grass, the long blades and the long-grass colonies grow short, rising to full height over 8 m outside the corridor -- a links' rough is played over, but the architect keeps the line to the fairway low. Links only (`scatter.tallGrass`); decoration, no generator change. 8.6% of a Links course; 18 ms per 110,000 asks. Test: the carry clear at its middle, full height beside it and on the fairway. Captures pending |
| 9 | Found in the shader, not yet seen: a fairway's mowing bands were laid from each hole's own origin, so where two holes share a fairway the two patterns meet in a seam down its middle -- bands offset where the holes run opposite ways (most of the pairs, out and back), turned where they run at an angle -- though a double fairway is mown as one | A fairway's bands measured from the world's origin along the hole's direction folded to one sense (ground.js, A FAIRWAY'S BANDS IN THE WORLD): for a lone hole only their phase moves; two holes running either way along each other mow as one, and at an angle the bands bend at the seam rather than break. Greens keep their own frame (the diamonds belong to the green). Ground key v66. A view from above the first shared fairway (`share-top`). Captured (`g3-r7/links/share-top`): the shared fairway's bands run across it as one pattern, no seam |

Generator 47, then 48, then 51 (Links only). Every bench rule clear on the standard tier.
tests/shared-fairways' count (at least two holes on each of three courses,
six in all) holds with room: `overhaul` 5, S1 4, S3 3.

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
