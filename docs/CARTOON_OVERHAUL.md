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
| 4. Assets, biome by biome | in progress: every tree, shrub, grass, brush, rock, house and Haunted Hollow prop pack remade, three or more rounds each (*Rounds*, below); still to come: course props (flags, tee markers, signs), flowers, the houses' foundations and gardens, and the rounds past three toward the addendum's ten |
| 5. Rendering and lighting | in progress: five rounds of the light (*Lighting*, below), rendering only |
| 6. Frame-rate pass | first pass done (*Frame rate*, below): Links, Island and Redwood at or under main; the rest over, by numbers written there |
| 7. Hand-over and showcase | first pass (26 October): every smoke journey that can run green (37; `server-program` skips itself until the standalone server is built, as on main), `npm run build` fresh, the generator bench all clear, the showcase built (`tools/capture/overhaul-showcase.mjs`); to be redone after the rounds still owed |

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
(`src/grounds.js`, to come) with a Node test: how a ball bounces, rolls and
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
| `tools/frame-tris.mjs` | A frame's triangles model by model, from one spot (GPU gate) |
| `tools/frame-spikes.mjs` | What each long frame spent its time on, camera still or orbiting (GPU gate) |
| `tools/profile.mjs --build --json --against --biome` | Main's kept build profiled beside the branch's, tier ladders on any landscape |
| `tools/surface-map.mjs` | A course's surfaces and ground types from above, 2 m a pixel, on the CPU -- for judging routing and shared fairways |
| `tools/gpu-gate.mjs` `foreignJobs` | Waits while a Playwright browser or Blender that is not ours is on the card (the realistic-graphics goal runs in another folder) |

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

### Ground textures (turf detail) -- three rounds, in the game

`tools/turf-detail.mjs` paints the turf detail atlas (RESEARCH *The overhaul's
turf detail*); the ground types' own patterns are in ground.js `groundPaint`.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Rough strokes read as dirt specks; nap as static; stone pitted like rivets | -- |
| 2 | (game) mown detail invisible | Light blades with small dark feet, 1,500 clumps; nap at 60%; no pits |
| 3 | (game) good; hardpan's cracks large and bold | Fairway .16, green .10, grit .24; hardpan plates halved and faint |

Pictures: `bench/shots/overhaul/rounds/turf-r1..2.png`, in the game
`turf-r2/`, `turf-r3/`.

### Boulders -- three rounds, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | Round stones threw spikes (bevel overran the hull) | -- |
| 2 | Round stones coarse, capped in moss; sandstone beds all one size | Round stones as a lumpy sphere flattened underneath |
| 3 | (game) good: red sandstone hoodoos in the Desert, lichened talus on Mountain | Smoother, crown moss only, beds varied, blocks seated |

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

### Uncleared stands and the far forest -- five rounds, generator 40

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

Pictures: `stands-r2/` to `stands-r5/`. Next: fewer, smaller evergreen
blotches in Autumn's far hills; the desert's bosque waits for the desert pack.

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

### The redwood grove -- three rounds

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) Grown trees in a realistic hand, 13,000-53,000 triangles | The cartoon_redwood pack. Fir, hemlock, cedar alike; seedling sparse; salal flat |
| 2 | As round 1 | Cedar drooping, hemlock feathery; tanoak light; seedling full; salal a mound |
| 3 | Redwood crown skimpy | Fuller, deeper crown. In the game: a cathedral grove; trunks perhaps too orange |

Pictures: `rounds/redwood-r1..3.png`, in the game `redwood-r3/`.

### Lakeshore's plants -- three rounds, one in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) lakeshore.py's plainer hand | The cartoon_lakeshore pack. Cottonwood broccoli; dune grass thin |
| 2 | As round 1 | Cottonwood clouds on great limbs; fuller dune grass -- celery |
| 3 | Celery | Splayed tussocks |
| 4 | (game) Tall marram hid the ball from the tee | No tall grass within 10 m of a tee; marram splayed (long grass round 4) |

Pictures: `rounds/lakeshore-r1..3.png`, `rounds/grass-r4.png`, in the game `lakeshore-r3/`, `lakeshore-r4/`.

### Lighting -- five rounds, rendering only

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

Still wrong after five: a noon desert has little shape from the light (its
dunes are gentle and the noon sun high -- the shading cues in ground.js carry
it); the redwood trunk at golden hour is a garish red with black bands (an
asset round, not a light one); edges/outlines, ambient occlusion beyond the
contact pools, clouds, water and wind have not had their rounds yet.

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

### Course furniture -- one round, in the game

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | (before) A sphere for a tee marker, a box on a cylinder for the sign, no bench | The cartoon_course pack: a moulded marker, a timber sign under a gable cap with the hole's card in front, a bench and a ball washer at every tee |

Still to do: the gable cap reads flat from the front; the flagstick and cup
keep their exact sizes (the ball plays against them) and are not remade.
Pictures: `rounds/course-r1.png`, in the game `course-r1/` (view `h1-teekit`).
