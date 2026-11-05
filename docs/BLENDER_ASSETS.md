# Models built in Blender

Since 23 October 2026 Fairway's models are built in **Blender**, from scripts
in this repository, rather than taken from a CC0 pack or grown by a script --
and since 27 October 2026 every model is: the packs, the grown redwoods and
the tools that made them were removed once the cartoon overhaul had remade
all of it. This page is how to recognise them, remake them and add more.
The first set is the Lakeshore Dunes pack (RESEARCH.md, *Lakeshore Dunes, the
tenth biome*). The owner expects to rework other biomes' assets this way, so
the layout below is meant to be copied.

## How to tell a Blender model

Everything about a Blender model says so, three times over:

| Where | Name |
| --- | --- |
| The script that builds it | `tools/blender/<pack>.py` (the shared helpers are `tools/blender/fairway_blender.py`) |
| The files it writes | `vendor/blender-<pack>/Blender_<Model>_<n>.glb` |
| Its key in the game (`MESH_MODELS`, `PICK`) | `Blender_<Model>_<n>`, picked as `'blender:Blender_<Model>_<n>'` in `tools/build-meshes.mjs` |

Every model the game ships is named `Blender_...`. Until 27 October 2026
others came from somewhere else -- the Kenney and Quaternius packs, the grown
redwood forest, the baked trees -- and were removed then.

## The pipeline

```
tools/blender/<pack>.py  --(Blender, headless)-->  vendor/blender-<pack>/*.glb
                                                   bench/shots/blender/<pack>.png  (contact sheet, --render)
vendor/**/*.glb          --(node tools/build-meshes.mjs)-->  src/asset-meshes.js
```

1. `node tools/blender/run.mjs <pack> --render` starts Blender headless
   (`-b --factory-startup`) on the pack's script. It finds Blender from
   `$BLENDER` or the usual install folder (`C:/Program Files/Blender
   Foundation/Blender <version>/blender.exe` on Windows). The script writes one
   `.glb` per model and, with `--render`, a contact sheet: one tile per model,
   framed to its own size beside a 1.8 m red post for scale, the model's name
   written underneath. The sheet goes to `bench/shots/blender/` (git-ignored).
   **Look at it before ingesting**; a model is judged from this sheet first and
   from the game second.
2. `node tools/build-meshes.mjs` ingests every PICK entry, Blender ones
   included. Re-running it must leave every other model's parts byte-identical.
   Check with the part-by-part comparison in PROJECT_HANDOFF *Adding a biome*.
3. Wire the species in: `FAMILY_OF` in `src/mesh-assets.js` maps a species to
   its family, colours go in the `shades`, `barks` and `accents` tables in
   `addModelSpecies` (vegetation.js), and a ground plant goes in
   `GROUND_PLANTS` (species.js). Spread-sized families go in `SPREAD_SIZED`.

The `.glb` files are **committed**: they are small (the Lakeshore pack is
about 1 MB), and committing them means a clone without Blender still runs
`build-meshes` and gets the same `src/asset-meshes.js`. Blender is not a
dependency of the game, the build or the tests, only of remaking these models.
The scripts draw every random number from `random.Random(<model name>)`, so a
pack rebuilds the same, and adding a model never changes another one.

## What the game keeps from a model

Only its triangles, its normals, the **name** of each material and -- for the
cartoon packs below -- its **vertex paint**; build-meshes drops everything else
and normalises the model to unit height, centred on x/z and standing on y = 0.
Custom normals survive (they are the normals). The material name decides the
role the game paints (`ROLE_OF` in `tools/mesh-read.mjs`):

| Material name | Role | Painted from |
| --- | --- | --- |
| `leaves` | leaf | the species' `shades` entry, tinted per tree |
| `bark` | bark | the species' `barks` entry, or one brown |
| `accent` | accent | the species' `accents` entry, or the leaf colour |
| `stone`, `dirt` | stone, dirt | the biome's rock and rough |

So in a pack script, name each material for its role and nothing else.
`fairway_blender.Mesh` does this for you: `mesh.face(points, 'leaf')`. The
colours set on materials in Blender are for the contact sheet only.

Rules the game imposes, learnt the hard way:

- **Build at real size in metres, Z up.** The exporter turns it Y up; the game
  rescales anyway, but proportions are what survive, so they must be real.
- **One object per model.** `export_pack` joins everything; build-meshes bakes
  a node's scale and translation but not its rotation, so nothing may rely on
  an object transform.
- **The game's materials are single-sided.** A flat blade or leaf card needs a
  second face pointing the other way (`fb.blade` in fairway_blender.py, and
  `cartoon.py`'s grass blades, are two-sided).
- **Under 65,536 vertices a part** (the indices are 16-bit). Low poly is the
  point anyway: one instance of a cottonwood is about 3,000 vertices after
  export and a course plants hundreds.
- **Sizing:** a tree is scaled by its height. A family in `SPREAD_SIZED` is
  scaled so its RADIUS matches the plant's spread, which suits low wide things
  (the dune grass patches, the juniper mats). A tall narrow model in a
  spread-sized family comes out huge, which is why the common juniper's vase
  is its own family (`juniperbush`).

## Blender and the graphics card

Blender may use the graphics card without asking (AGENTS.md, the Blender
exception, 23 October 2026). The contact sheet renders with EEVEE on the GPU.
Read `nvidia-smi` first and do not start while a game is running, run one
Blender at a time, and make sure it has exited afterwards (`run.mjs` waits for
it).

## The packs

### lakeshore (23 October 2026; removed 27 October 2026)

The first pack, kept here as its record: replaced by `cartoon_lakeshore`
(below) in the cartoon overhaul, and its script and folder removed on 27
October 2026. `tools/blender/lakeshore.py`, 17 models, for Lakeshore Dunes:

| Model | Species (family) | What it is | Vertices after export |
| --- | --- | --- | --- |
| `Blender_DuneGrass_1`-`_3` | `dunegrass` (`dunegrass`) | A patch of American beachgrass: 10-14 tussocks of 16 blades, green below and straw at the tips (the accent role), 2-2.7 m across | 2,240-2,940 |
| `Blender_Cottonwood_1`-`_3` | `cottonwood` (`cottonwood`) | Heavy trunk forking a quarter to a third of the way up into 3-4 ascending limbs, crown a ragged open cluster of foliage lumps | 2,841-3,599 |
| `Blender_BlackOak_1`-`_3` | `blackoak` (`blackoak`) | Black oak: a crooked trunk forking low into wandering limbs, a wide dense dark crown, 15-19 m | 2,482-3,490 |
| `Blender_SugarMaple_1`, `_2` | `sugarmaple` (`sugarmaple`) | Sugar maple: a straight trunk well up into a dense egg-shaped crown | 1,585 |
| `Blender_Juniper_1`, `_2` | `juniper` (`juniper`) | Creeping juniper mats, about 3.5 m across | 312-408 |
| `Blender_Juniper_3` | `commonjuniper` (`juniperbush`) | A common juniper's low vase | 348 |
| `Blender_Driftwood_1`-`_3` | beach decoration (`driftwood`) | Bleached logs, one with its root wad, 3-4 m long | 200-452 |

Together they added 663.4 KB to the module (`src/asset-meshes.js`, 14,690.1
to 15,353.5 KB), about 3.6% of the built page. What was tried and changed is in
RESEARCH.md: the first cottonwood was an umbrella pine (thin trunk, leaves
only at the limb ends), the first grass was scattered weeds (too few blades,
leaning too far), and the first juniper mats looked like lily pads (a few flat
plates rather than many rounded lumps). The black oak and sugar maple came
second, after the first look in the game: the shared Kenney broadleaf family
(`oak`, `maple`) includes cube-crowned trees that jarred here, and changing
that family would change six other biomes.

Since the cartoon overhaul (below) `oak` and `maple` no longer draw from the
Kenney broadleaf family either; Lakeshore keeps its own black oak and sugar
maple.

## The cartoon packs (the cartoon overhaul, from 25 October 2026)

The cartoon overhaul (merged 27 October 2026) remade every model in one hand
(docs/CARTOON_OVERHAUL.md). Its packs are built from a shared library,
`tools/blender/cartoon.py`, on top of `fairway_blender.py`, and add two things
every earlier model lacked:

- **Vertex paint.** `cartoon.PaintMesh` gives each vertex an RGBA colour,
  exported as glTF `COLOR_0` (`export_vertex_color='ACTIVE'`). RGB is a
  multiplier on the colour the game paints the role with, **stored halved**,
  so 0.5 is "as painted" and 1.0 is twice as bright; the game reads it back as
  `color` (byte / 127.5), which every stock three.js shader multiplies into the
  instance colour. Alpha is the vertex's **wind flex** (0 rooted, 1 a leaf
  tip), read as `flex` by `windMaterial` (textures.js) so a crown's outer
  lobes flutter and its core holds still. Only models from a `blender-*`
  pack carry paint into the game (`tools/build-meshes.mjs`): a pack model with
  colours of its own would otherwise change bytes nobody asked to change.
- **Bent normals.** Foliage normals are blended about 80% toward the direction
  from the crown's centre (`add_lump(..., crown=, blend=)`), saved as custom
  normals, so a crown lights as one soft body. A painted crown therefore does
  not receive the shadow map (vegetation.js): sampled against it, the bent
  normals put each lobe's shadow lookup on the wrong side and the crown comes
  up speckled. It still casts. And it is never given a thinned twin by the
  instance cull (instance-cull.js): it is thirty-odd lobes, not thousands of
  sprays -- keeping a third of them leaves bubbles floating apart.
- **A far twin, shipped.** Instead, `export(..., far=True)` builds every model
  a second time as `<name>_Far` with `cartoon.FAR` set: each lobe an
  icosahedron (20 triangles instead of 320-1,280), each tube half its sides,
  each conifer skirt two rim points a bough instead of four. Same seed, same
  draws: every `add_lump` and `add_tube` takes ONE number from the builder's
  stream and jitters from a stream of its own (`own_stream`), so how many
  vertices a lobe has never moves anything built after it, and the twin has
  the full model's silhouette and paint with only its facets changed. An oak
  goes from 9,765 faces to 817, a pine from 5,929 to 717 -- about 330 KB for
  all twenty (before the frame-rate pass below). They are ingested as the
  `fartwin` family (never planted); `mesh-assets.js` `farParts` hands one out
  part for part, and the cull draws it where a crown is small on screen, by
  the tier's `farPainted` line (graphics.js). Introducing `own_stream`
  re-jittered every full model once (the lobes' bumps moved; their places did
  not). A far twin draws a tiny non-leaf lump -- a flower, a berry, under
  15 cm -- as a four-face cone, and keeps it, so the twin still has every
  role its model has.
- **The finest lobe is a twelve-sided sphere** (the frame-rate pass):
  `add_lump(subdiv=3)`, `cloud_crown`'s default, is a UV sphere of 12 segments
  and 7 rings, 144 faces, where it was a 320-face icosphere. A maple crown
  9,700 -> 4,400 triangles. The 80-face icosphere was tried and rejected:
  hexagonal outlines (CARTOON_OVERHAUL *Frame rate*).

The library's shapes: `cloud_crown` (a crown as a cloud of soft lobes on an
ellipsoid, flattened underneath), `skirt` (one conifer tier: a drooping star
of boughs, each ending in a rounded scallop), `trunk` (flared, tapering,
leaning, painted dark at the foot), `limb`, `hull_rock` (a bevelled convex
hull, with strata or a moss top), `tuft` (a clump of two-sided blades, dark at
the root). The contact sheet is drawn with a toon material (`toon_material`):
a soft three-step ramp times the paint times a role colour, close to how the
game lights it.

`node tools/blender/inspect.mjs <pack>` prints each model's vertices and
triangles per role and the range of its paint -- run it before judging a
sheet, because a paint that never reached the file looks like a weak paint.

Every sheet a round draws is copied to `bench/shots/overhaul/rounds/<pack>-r<n>.png`
(local) for the showcase.

### cartoon_broadleaf

(Its broadleaf trees were reworked silhouette first on 2 November 2026:
*The silhouette pass on the packs before the goal*, below.)

`tools/blender/cartoon_broadleaf.py`, 11 models: `Blender_Oak_1`-`_3`
(family `oaktree`), `Blender_Maple_1`-`_3` (`mapletree`), `Blender_Aspen_1`-`_3`
(`aspentree`), `Blender_Alder_1`, `_2` (`aldertree`). 3,500-6,500 vertices
each. Replaces the Kenney broadleaf family for `oak`, `maple`, `aspen`, `alder`
everywhere. The aspen's accent is its dark trunk scars (`accents` in
vegetation.js). Rounds and what each fixed: the pack script's header and
CARTOON_OVERHAUL.md *Rounds*.

### cartoon_conifer

`tools/blender/cartoon_conifer.py`, 9 models: `Blender_Spruce_1`-`_3`
(`sprucetree`), `Blender_Pine_1`-`_3` (`pinetree`), `Blender_Cedar_1`-`_3`
(`cedartree`). Replaces the Kenney conifer family for `spruce`, `pine`,
`cedar`.

### cartoon_rocks

`tools/blender/cartoon_rocks.py`, 12 models: `Blender_BoulderRound_1`-`_4`
(family `boulderround`, granite corestones, a lumpy sphere flattened
underneath, `cartoon.pebble_rock`), `Blender_BoulderAngular_1`-`_4`
(`boulderangular`, frost-split talus, a sharp bevelled hull),
`Blender_BoulderLayered_1`-`_4` (`boulderlayered`, sandstone beds stacked
and worn back, some with a broken block on top). A biome picks its family with
`rockStyle` and mosses the upward faces (the accent role) with `rockMoss`.
They replace the four squashed icosahedra vegetation.js used to build. Every
boulder is drawn to the collider the generator built for it (bottom at
centre - sy, top at `top`, half-widths sx and sz), and turns about the
vertical with a slight tilt only -- a model rests on its base. 5,300 vertices
for all twelve.

### cartoon_shrubs

`tools/blender/cartoon_shrubs.py`, 18 models, three each: `Blender_Shrub_*`
(`shrubbush`), `Blender_Gorse_*` (`gorsebush`, yellow flowers as the accent),
`Blender_Heather_*` (`heatherbush`, a low mat with purple shoot tops),
`Blender_Naupaka_*` (`naupakabush`, a mound of leaf rosettes, white
half-flowers), `Blender_Fern_*` (`fernbush`), `Blender_Bramble_*`
(`bramblebush`, arching canes over a dark core, black berries). They replace
the one Kenney `bush` family the six species shared. Heather, naupaka, fern and
bramble are sized by their spread (`SPREAD_SIZED`). Their flowers are in the
models now, so vegetation.js no longer sticks gem-shaped flowers on gorse and
heather. 33,700 vertices for all eighteen.

### cartoon_desert

(Its broadleaf trees were reworked silhouette first on 2 November 2026:
*The silhouette pass on the packs before the goal*, below.)

`tools/blender/cartoon_desert.py`, 18 models: `Blender_Palo_*` (`palotree`:
several low green trunks, an airy crown of small lobes on twigs, yellow
flowers), `Blender_Mesquite_*` (`mesquitetree`: a crooked trunk, arching
stems, a broad open dome), `Blender_Saguaro_*` (`saguaro`: a ribbed column
with J arms, cream flowers), `Blender_Cholla_*`, `Blender_PricklyPear_1` and
`Blender_Barrel_1` (`cholla`, the low cacti), `Blender_Ocotillo_*`
(`ocotillo`: wands from the root crown, leaves after rain, red tips) and
`Blender_Agave_*` (`agaveplant`, sized by spread). `ribbed()` in the pack
builds a cactus column pleated into ribs, painted darker in the grooves.
Palo verde and mesquite ship far twins (`export(far=<names>)` now takes a
set of names: a small plant's twin saves nothing). They replace Kenney's
cacti, the Kenney dead hardwoods that stood in for palo verde and mesquite,
and the procedural ocotillo and agave.

### cartoon_grass

`tools/blender/cartoon_grass.py`, 17 clumps of long grass, a family each:
`grassfescue`, `grassmarram`, `grassbluestem` (three-fingered "turkey foot"
heads), `grassalpine` (with flowers), `grassbunch` (desert), `grasssedge`,
`grasstussock` (Haunted Hollow's; built, not shipped since it was removed) and `grassplume` (Island). Each is 40-200
faces of two-sided blades (`fb.blade`) round a low mound, green at the root
and the accent toward the tip, painted by height, normals straight up (the
game lights grass like the ground). Decoration only: vegetation.js
`addLongGrass` plants them in colonies on the wild ground, and the near-field
tall grass uses the first family's first model.

### cartoon_brush

`tools/blender/cartoon_brush.py`, 10 shrubs light enough to plant by the
thousand (lobes of 80 triangles): `Blender_Creosote_*` (`creosotebush`: an
open vase of thin stems strung with small olive leaf clumps, yellow flowers),
`Blender_Brittlebush_*` (`brittlebush`: a silver mound, daisies on stalks),
`Blender_Sagebrush_*` (`sagebrush`), `Blender_Bracken_*` (`brackenfern`:
triangular fronds of serrated leaflets) and `Blender_Huckleberry_*`
(`huckleberrybush`). 465-1,500 faces each. They are the understory of the
stands and fill the open Desert and Mountain.

### cartoon_island

(Its broadleaf trees were reworked silhouette first on 2 November 2026:
*The silhouette pass on the packs before the goal*, below.)

`tools/blender/cartoon_island.py`, 7 trees: `Blender_Palm_*` (`palm`: a curved
ringed column, a crown of 15-20 arching fronds of overlapping leaflets,
coconuts) and `Blender_Hala_*` (`halatree`: prop roots, a forked trunk, a
dense crown of strap-leaf rosettes, orange fruit). They replace Kenney's palms
and the procedural hala. Their leaves are single faces, so vegetation.js draws
the leaf part two-sided (`THIN_LEAVES`; also bracken and ocotillo). No far
twins: flat leaves gain nothing from one.

### cartoon_houses

`tools/blender/cartoon_houses.py`, 8 fairway homes, two of each form homes.js
chooses (`Blender_House_Gable_*`, `_Hip_*`, `_Saltbox_*`, `_Lshape_*`): a unit
box of walls, a roof in shingle courses with eaves (two-sided, so it does not
vanish from below), shuttered windows with sills, a door, corner boards and a
plinth, a brick chimney, some with a porch. Four roles, each tinted per house
from a street's palette (homes.js `WALLS`, `ROOFS`, warm versions for warm
biomes): `stone` walls, `bark` roof and shutters and chimney, `accent` trim,
`dirt` glass and door. 80-110 faces. homes.js fits the WALLS to the collider
box, measured off the walls' own part and recentred on them (`wallExtents`:
the ingest centres a model on its whole box and scales it to unit height,
chimney included); the eaves and a porch roof overhang it. They replace
Kenney's building kit, whose texture atlases (about 63 KB) no longer ship.

### cartoon_deadfall

`tools/blender/cartoon_deadfall.py`, the forest floor (vegetation.js
`addDeadfall`, the Giant Redwood and Haunted Hollow): `Blender_Log_*` (`log`,
built lying down -- a model is unit height, so its height is its thickness --
sagging, with limb stubs, a sawn or splintered end and a blanket of moss
cushions), `Blender_Stump_*` (`stump`: root flares, a cut or splintered top,
moss on one side) and `Blender_MossRock_*` (`mossrock`: `pebble_rock` with a
moss cap). They replace the grown nurse logs, stumps and boulders. Kenney's
`rock`, `grass`, `flower` and the grown `litter` families, which nothing drew
any more, are no longer taken.

### cartoon_redwood

(Its broadleaf trees were reworked silhouette first on 2 November 2026:
*The silhouette pass on the packs before the goal*, below.)

`tools/blender/cartoon_redwood.py`, the Giant Redwood's forest in the
overhaul's hand: `Blender_Redwood_*` (a fluted, flared red column bare for
two-thirds of its height, a ragged crown of drooping tiers and clumps),
`Blender_Fir_*`, `Blender_Hemlock_*` (feathery, a drooping leader),
`Blender_RedCedar_*` (a buttressed fluted foot, long drooping sprays),
`Blender_Tanoak_*`, `Blender_Seedling_*`, and the floor's `Blender_SwordFern_*`,
`Blender_Salal_*` and `Blender_Sorrel_1`. `fluted_trunk` pleats a trunk into
flutes, deepest at the foot. Crown widths are the generator's (species.js
`CROWN_FRACTION`: half-width over height 0.095 redwood, 0.17 fir and hemlock,
0.19 red cedar). 1,000-1,900 faces a tree, with far twins, against the grown
grove's 13,000-53,000: the model module fell from 19.8 MB to 7.8 MB. The
grown models (tools/grow.mjs) no longer ship; `thinSprays` is
kept, and tested on a built crown, should a grown model return.

### cartoon_garden

`tools/blender/cartoon_garden.py`: a fairway home's garden, where homes.js drew
a fence of thin boxes and seven-sided balls: a picket fence section (1.6 m,
two capped posts, two rails, eight pointed pickets; `bark` the frame,
`accent` the pickets) and three clipped shrubs -- a boxwood dome, a flowering
mophead bush (`accent` the flowers, one colour a house from homes.js
`BLOOMS`) and a topiary cone. Ingested as `gardenfence` and `gardenshrub`;
homes.js instances them with the houses, so a street is a few draw calls.
The foundation stays a box, now a stone footing in the landscape's rock.

### cartoon_flowers

`tools/blender/cartoon_flowers.py`: the rough's wildflowers, where a 20-face
gem sat on a grass tip -- an ox-eye daisy (three stems, rayed heads), an aster
tuft (narrow leaves, five small heads) and a cup (a buttercup or lily on bare
stems). Petals are flat two-triangle blades drawn two-sided (round 3; a
daisy of 20-face petal lumps was 900 triangles), `accent` coloured per
landscape (`scatter.flowers`), `bark` the eye, `leaf` the stems. Ingested
as the `wildflower` family. The pack's contact sheet stands them beside a
30 cm reference (`ct.export(..., figure=.3)`; a person's height made them
specks).

### cartoon_course

`tools/blender/cartoon_course.py`: what stands at every tee, in the overhaul's
hand, where renderer.js `addHoleDetails` drew a sphere for a tee marker and a
box on a cylinder for the sign. A moulded marker (a squat dome on a collar,
11 cm, `accent` coloured per tee), a hole sign (two timber posts and a gable
roof whose ridge runs front to back, 2.52 m to the ridge, round a 1.0 x
1.25 m board whose centre is 1.55 m up; the game lays the hole's card on a
face 5 cm in front of it -- `furniture()`'s height and the face's divisor must
both be 2.52), a slatted bench and a plunger ball washer (an upright housing,
a pale cap, the plunger's T-handle on top and a towel; 1.27 m, the height
renderer.js gives it). The sign's gable ends and its roof's underside are
timber; the underside's normals are bent up so it lights from below the eaves. Ingested as the `coursefurniture` family, never
planted; renderer.js `furniture(name, height, colours)` builds one at its
real height (the ingest makes every model one unit tall). Decoration: nothing
a ball hits, as the sign never was. The plain shapes stay as the fallback.

### cartoon_lakeshore

(Its broadleaf trees were reworked silhouette first on 2 November 2026:
*The silhouette pass on the packs before the goal*, below.)

`tools/blender/cartoon_lakeshore.py` remakes Lakeshore Dunes' set (lakeshore.py,
built before the overhaul with no paint or bent normals) in the overhaul's
hand under names of their own, `Blender_Lake*`, so the old pack stays as main
has it: cottonwood (a furrowed trunk forking into great limbs, each carrying a
cloud), black oak, sugar maple (with far twins), creeping and vase junipers,
dune grass patches of splayed tussocks, and bleached driftwood (now drawn
painted).

## The world packs (Architect's, from 30 October 2026)

Models every generated course places round its holes -- the clubhouse,
markings, bridges, the land's story, its animals. Built for Architect
courses (30 October 2026; docs/ARCHITECT_COURSES.md, in git history, holds
their iteration log) and kept when Architect was removed on 2 November 2026,
so the packs keep their `architect_` names. Each model was iterated at least
ten times; under the US landscapes goal a model gets at least fifteen, each
logged in tools/blender/logs/<id>.md.

**A model longer than two of its own heights** -- a rake lying on the grass
-- does not fit the ingest's int16 box (positions are stored at 16384 a
model height, two heights each way) and wraps round to the far side. Such
a model carries its own scale, `q`, written beside it and read by
mesh-assets.js (build-meshes.mjs). At first only the Architect's families had
it; since 31 October 2026 every family does (the owner), which unwrapped
eleven models drawn folded since they were ingested: Tussock_1 and _2 (q
12248, 11202), Log_1 to _3 (13645, 15347, 11307), Sorrel_1 (11162),
LakeDuneGrass_3 (16335), LakeJuniper_1 and _2 (6789, 5541), LakeDriftwood_1
and _2 (6673, 8727). A model that fits keeps 16384 and its bytes. **A pack script must not
import another pack's script**: importing runs that script's own export, into
this pack's folder (architect_people copies cartoon_course.py's `block`).

### architect_people

`tools/blender/architect_people.py`: what a club puts out on a course it looks
after -- a penalty-area stake (0.92 m, painted to a dark earth collar, a
pyramid cap; red in the game), the boundary's white stake (1.05 m), a
yardage post (0.64 m, a dark plinth, a coloured band, a chamfered cap; dark
green in the game with a red, white or blue band) and a bunker rake (1.6 m
built, drawn 2.3 m: true size was nothing from a fairway). Ingested as the
`coursemarkings` family, never planted; renderer.js `addMarkings` draws them
instanced from markings.js, the standing ones inked. The sheet uses a 0.4 m
scale post: the default 1.8 m post is wider than a stake and hid all four.

### architect_clubhouses

`tools/blender/architect_clubhouses.py`: one clubhouse a landscape (the
study's landscape table): a timber lodge (PNW), an adobe with a tower and
vigas (Desert), a chalet (Mountain), a twin-gabled stone links house (Links),
a two-storey farmhouse with a porch (Midwest), an open hipped pavilion
(Island), a log lodge (Giant Redwood), a clapboard house with a cupola
(Autumn), a crooked manor with a turret (Haunted Hollow's, built but not shipped since 2 November 2026) and a shingled house
with dormers (Lakeshore Dunes); each with fascia and ridge trim, a flag by
the door. Built round a 26 x 16 m footprint, front at -Y; ingested as the
`clubhouse` family with its own scale (`q`); renderer.js
`addBuildings` fits each to its building's box and inks it, coloured per
landscape (walls, roof, trim, glass), and
draws a terrace wall under it on a slope. clubhouse.js `CLUBHOUSE_ASPECT`
is each model's height for its width, measured off the ingested model; a
test holds it to the models, so **re-measure it whenever a clubhouse changes
shape**.

### architect_story

`tools/blender/architect_story.py`: the land's story, each model drawn to
the footprint story.js gives it (front at -Y) so the game fits it to its
solid box undistorted: a 2 m dry-stone wall section (1.1 m, coursed stones and
a coping) and a hedge section (1.6 m), a standing stone (2 m; painted white
it is the Dell's aiming stone), a post lantern, a gambrel barn (11 x 15 m, its
doors in the gable), a silo, a windpump, a roofless chapel and cottage, a
timber mine head, a round sugar-mill tower, a banded lighthouse and a church
with a spire. Ingested as the `storypieces` family with its own scale;
renderer.js `addBuildings` fits the buildings to their boxes (coloured by piece
and landscape) and `addStory` instances the walls in 2 m sections, the
stones and the lanterns. The walls are drawn uninked (inked, their small
stones went black).

### architect_life

`tools/blender/architect_life.py`: life on a course, each
facing -Y at its real size -- a sheep (a fleece of lumps on short legs, a dark
face), a goose, a doe and a bull elk (inset coat-coloured legs, a full body),
a heron, a roadrunner and a gliding bird (a gull white, a raven black).
Ingested as the `lifeforms` family with its own scale; renderer.js `addLife`
draws them instanced, a quarter to a half larger than life, and moves them,
never on Low. (The four walking golfers, the mower, tournament week's pack
`architect_occasion.py` and the shared body `figures.py` were removed on 2
November 2026: the owner.)

### architect_water

`tools/blender/architect_water.py`: what a builder puts at a course's
water. Two 2 m **bridge bays** -- timber (3.0 m wide, 1.25 m tall:
stringers, nine planks, a post each corner, two rails) and stone (3.1 m, 1.08
m: a slab, parapets with a coping) -- the deck's top 0.30 m up both; renderer.js
`addPaths` lays as many as a span needs, fitted to the path's width and to
the solid deck (`b.deck`), inked. Three **rip-rap** stones (about 0.7 x 0.35
m, angular), a **tie wall** section (2.4 m of ten ties, 0.9 m tall, a waler on
its +X face, which turns to the water). The **fountain** was a model here
(4.0 m, nine iterations) until the owner's review asked for it to move; the
renderer now draws its water (src/fountain.js). Ingested as the `waterworks` family
with its own scale (`q`: the tie wall is 2.7 heights long);
renderer.js `addWaterworks` draws them instanced. **The tube helper draws one
ring a radius** (`add_tube`): give it a radius for every point, or the tube
stops after the first stretch -- the old fountain's streams were invisible
for eight iterations.

## The US landscapes packs (from 2 November 2026)

The models the US landscapes goal adds (the owner's plan, docs/studies/
us-landscapes/PLAN.md section 5, local): one pack a region, built in the
cartoon hand from `cartoon.py`, each model iterated **at least fifteen times
against its reference pictures** (the owner: "All Models need to be
iterated on at minimum 15 times while comparing to real pictures").

**How a round runs.** `node tools/blender/iterate.mjs <pack> <round>`
first waits at the graphics card's gate (tools/gpu-gate.mjs, since 3
November 2026, when the PC went down at the eighteenth of a two-hour run
of renders started back to back, some with the card over 30% busy): two
minutes' rest since the last graphics job (`FAIRWAY_GPU_REST`), the card
under 30% busy and 75 °C over 30 seconds, nobody else's job on it; each
render is logged in bench/ab/gpu-runs.jsonl under `FAIRWAY_GPU_GOAL`
(us-landscapes). It then builds the pack, keeps each model's sheet tile (`FAIRWAY_TILES` in
fairway_blender.py) and lays every model beside the first three of the
study's pictures for it (photos/models/<id>/, local) on one sheet,
bench/shots/blender/iter/<pack>/r<round>.png, with each model's own row
saved as <id>-r<round>.png (local). `--season spring|autumn|winter` draws
the pack in that season's colours (the pack's `LOOK` table, from the
study's models/<id>.md *Seasons*); `--far` puts each far twin beside its
model. What was wrong and what changed go into tools/blender/logs/<id>.md,
one line a round (`--log notes.json`), committed; a model is not done
below fifteen lines. The pack names its models' study ids in
`# REFS id=Model,...` comment lines.

**Sheet changes for it.** A plant under a third of the post's height gets a
30 cm post (the 0.35 m iris was invisible beside 1.8 m); a pack may give
each model its own sheet colours (`export(..., tints=)`), so a yellow broom
and a pink rhododendron are not both drawn in the pack's one accent. Both
are sheet-only: the game paints roles from the species tables.

**Budgets** (PLACED, from the overhaul's packs, `inspect.mjs`): a tree
about 4,500-5,500 triangles (the cartoon oak 5,100), a shrub 2,000-3,500,
a flower a few hundred. Two traps found on the way: `cloud_crown`'s lobes
are cheapest at its default (`subdiv=3` draws a 12 x 7 sphere, 144
triangles; `subdiv=2` is a 320-face icosphere), and every `cloud_crown`
adds a 320-face filled core, most of the cost of a small clump -- so
`cloud_crown(..., core=False)` (added for these packs; the default keeps
every earlier pack's bytes).

### cartoon_pacific

`tools/blender/cartoon_pacific.py`, 14 models and 8 far twins: what Puget
Sound and Redwood Coast lacked. Seventeen rounds for the dogwood, fifteen
for the rest; each log says what each round found.

| Model | Species (family) | What it is | Triangles |
| --- | --- | --- | --- |
| `Blender_Madrone_1` (three stems), `_2` | `madrone` | Two leaning red stems, crooked limbs, an open domed evergreen crown of clumps with the limbs showing; white flowers in spring, orange-red berries in autumn (accent) | 4,600 |
| `Blender_GarryOak_1` | `garryoak` | A short heavy trunk, crooked limbs, a broad lumpy crown wider than tall | 4,700 |
| `Blender_BigleafMaple_1` | `bigleafmaple` | A heavy trunk under a tall broad oval crown | 4,400 |
| `Blender_PacificDogwood_1` | `pacificdogwood` | Three tiers of flat sprays, cream four-petal bracts over and round them (accent) | 4,100 |
| `Blender_BayLaurel_1` | `baylaurel` | Several leaning stems under a dense dome reaching toward the ground | 4,500 |
| `Blender_VineMaple_1` | `vinemaple` | Eight splayed stems, a full rounded mass of leaves | 1,000 |
| `Blender_OregonGrape_1` | `oregongrape` | Upright holly-leaved clumps, yellow flowers or blue berries (accent) | 2,600 |
| `Blender_ScotchBroom_1` | `scotchbroom` | A rounded mound of fine switches, solid yellow in flower (accent) | 2,800 |
| `Blender_PacificRhododendron_1` | `rhododendron` | Leggy stems with leaf whorls down them, pink trusses (accent) | 1,800 |
| `Blender_DouglasIris_1` | `douglasiris` | An arching clump of grassy leaves, lavender flowers among the tips | 750 |

**Count triangles, not Blender's faces** (`inspect.mjs`): the lobes are
mostly quads, so a model's triangles run 1.6-1.8 times its faces. The pack
met its budgets by faces after round 12 and was still double by triangles;
round 18 was the second cost pass, after the game's A/B.

The deciduous ones (Garry oak, bigleaf maple, dogwood, vine maple) go bare
in winter by drawing without their leaf and flower parts, their branches
grown from the model's own leaf part when a round asks (src/twigs.js,
mesh-assets.js `bareParts`), not as separate models: a pack makes no bare
variant, and every deciduous model has its twig layer for nothing. A
species' crown must still be its leaf part's outline, since that is what
the twigs fill.

**Every variant ships** (since 2 November 2026, the owner: "I dont want to
end up not using the models we create"). For a day only one variant of the
madrone, Garry oak, bigleaf maple and bay laurel shipped: a variant is a
draw call per part, full and far, in the frame and the shadow pass, and
with both Puget Sound's Low frame had risen 24% (RESEARCH, *The Pacific
pack*); that cost waits for the goal's performance pass (TODO).

### cartoon_mountain

`tools/blender/cartoon_mountain.py`, 6 models (two variants of each tree)
and 4 far twins: what the Rockies lacked. Fifteen rounds each, logged.

| Model | Species (family) | What it is | Triangles |
| --- | --- | --- | --- |
| `Blender_Lodgepole_1`, `_2` | `lodgepole` | A tall straight pole with dead stubs up its bare lower half, a narrow uneven crown above | 970-1,100 |
| `Blender_BlueSpruce_1`, `_2` | `bluespruce` | A broad silver-blue cone to the ground, lighter new growth at the top | 2,050 |
| `Blender_WillowThicket_1` | `willowthicket` | A rounded grey-green mound on fine red shoots | 3,390 |
| `Blender_Columbine_1` | `columbine` | A low leafy spread, blue-and-white star flowers held above it (bark is the white cup, accent the blue) | 1,130 |
| `Blender_Lupine_1` | `lupine` | Purple flower spikes, florets proud of them, over a palmate base (accent) | 1,075 |
| `Blender_SplitRailFence_1` | `storyrail` (never planted) | One 2 m panel of six heavy split rails; the game lays panels along a wall's run, every other one turned 30 degrees each way, for the zig-zag | 108 |

The fence is the Rockies' story wall (biomes.js WORLD.mountain
`story.walls: 'rail'`): renderer.js addStory draws it, story.js gives it
a 1.3 m wide solid box (`WALL_WIDTH`) so a ball meets the zig-zag's
width. Willow thicket is a ground plant and keeps its colour in winter; bare
stems for it are still owed (TODO *Seasons, still to do*).

### Silhouette first (the owner, 2 November 2026)

"The trees all look like big green fluffy balls on the trunks... every
tree is gonna end up looking kind of the same." The style stays (soft
lobed clumps, flat colour, ink); what changes is that **every species is
modelled to be recognised by its outline alone**, a black shape at
thumbnail size, and not confused with another tree in the game: crown
shape (vase, umbrella, spire, shelves, fan, broad and flat), how much
trunk and limb shows, lobe scale and edge, and sky through an open crown.
A tree's crown is never one default ellipsoid `cloud_crown`; it is built
from parts placed to make its species' outline. The packs from New
England on were briefed this way from their first round, Heartland from
round 4; the Pacific, mountain and dry-and-lake packs were made before it
(TODO, *Silhouette lineup*).

### cartoon_drylake

`tools/blender/cartoon_drylake.py`, 5 models and 2 far twins, seventeen
rounds each: what the Sonoran and Lake Dunes lacked.

| Model | Species (family) | What it is | Triangles |
| --- | --- | --- | --- |
| `Blender_Ironwood_1`, `_2` | `ironwood` | After the silhouette pass: short split trunks and crooked limbs forking into twigs, many small ragged sprays making a broad open grey-green dome with sky through it | 4,510-5,070 |
| `Blender_Jojoba_1` | `jojoba` | A dense grey-green mound leafy to the ground, leaf flakes on its skin | 3,250 |
| `Blender_SandCherry_1` | `sandcherry` | A low sprawl of thin dark stems, narrow leaves, small blossoms (accent: white in spring, dark cherries in summer) | 3,100 |
| `Blender_PierLight_1` | story piece `pierlight` | Grand Haven's red pierhead light on its concrete pier end: red tower (accent), dark railed gallery and iron (bark), pale lantern and deck (stone); front -Y, pier along Y | 800 |

The pier light is Lake Dunes' landmark (story.js `STORY_PIECES.pierlight`,
drawn 24 m on an 8.4 by 16.8 m footing). Painting its accent #f2efe6
makes a white light like St. Joseph's.

### cartoon_heartland and cartoon_newengland

Two packs worked by agents on 2 November 2026, silhouette first (the
Heartland's trees from round 16 of 23, New England's from round 1 of 16).

| Model | Species (family) | Outline | Triangles |
| --- | --- | --- | --- |
| `Blender_AmericanElm_1`, `_2` | `americanelm` | A vase: limbs fanning up from a low fork to an umbrella over the top quarter, sky under it | 4,060-4,780 |
| `Blender_Shagbark_1`, `_2` | `shagbark` | A long straight trunk bare to 40%, a narrow ragged column of clumps on short level branches | 3,340 |
| `Blender_BurOak_1`, `_2` | `buroak` | A massive short trunk, heavy level limbs crooking up, ragged clumps with gaps, far wider than tall | 4,310-5,060 |
| `Blender_PrairieForbs_1` | `prairieforbs` | Grass with blazing star, coneflowers and black-eyed Susans (purple accent, gold stone, dark cones bark) | 860 |
| `Blender_CornPatch_1` | story prop `corn` | Five rows of thirteen corn plants, 5 by 6.4 m, rows along Y | 2,730 |
| `Blender_RedBarn_1` | story piece `redbarn` | A red gambrel barn, white trim, cupola, lean-to and a banded silo; 24 by 21 m, front -Y | 770 |
| `Blender_PaperBirch_1`, `_2` | `paperbirch` | White stems with black marks splaying from one root, small clumps up the top half, sky between | 3,070-4,660 |
| `Blender_WhitePine_1`, `_2` | `whitepine` | Separate level shelves of ragged tufts (flat stars) on a tall dark trunk; `_1` flagged to the lee | 4,390-4,960 |
| `Blender_BalsamFir_1`, `_2` | `balsamfir` | A narrow regular sharp spire to the ground | 1,440-1,680 |
| `Blender_AmericanBeech_1`, `_2` | `americanbeech` | A smooth grey trunk under a broad low dome on long level limbs | 4,470 |
| `Blender_FieldWall_1` | story wall `field` | One 2 m section of tumbled fieldstone, lichen on a third (accent), 1.05 m | 550 |
| `Blender_CoveredBridge_1` | bridge `covered` | A red board bridge, gabled roof, open portals, stone abutments; spans X, 24 m by 5 m, deck 2.6 m above its base | 330 |

The barn replaces the farmstead's barn and silo in the Heartland (story.js
`farm: 'redbarn'`), with up to twelve corn patches behind it; New England's
walls are `field` and its bridges `covered` (renderer.js draws one covered
bridge a crossing, stretched to the span, at its own width and height).
Leaf fall turns only broadleaves (vegetation.js `EVERGREEN`, `FALL_HUE`).

### cartoon_keys

`tools/blender/cartoon_keys.py`, 9 models and 5 far twins, fifteen rounds
each, silhouette first; every one ships (generator 62).

| Model | Species (family) | Outline | Triangles |
| --- | --- | --- | --- |
| `Blender_RoyalPalm_1`, `_2` | `royalpalm` | A tall smooth pale-grey column swelling mid-way, a fat bright-green crownshaft (accent), a round head of arching fronds | 1,100-1,200 |
| `Blender_TravelersPalm_1` | `travelerspalm` | A flat 190-degree fan of ragged paddle leaves in one plane on a ringed post | 1,380 |
| `Blender_SeaGrape_1` | `seagrape` | A broad dome scalloped by round leaf plates, rose grape strings under its edge (accent) | 2,470 |
| `Blender_Mangrove_1` | `mangrove` | A dark rounded cap low over a cage of arching prop roots | 3,410 |
| `Blender_GumboLimbo_1` | `gumbolimbo` | Thick crooked copper limbs carrying loose flat leaf rosettes, sky between | 4,830 |
| `Blender_Banyan_1` | `banyan` | A fused trunk, level limbs and sixteen root columns under a broad low canopy, about 30 m across | 4,460 |
| `Blender_Bougainvillea_1` | `bougainvillea` | A mound of magenta bract sprays (accent) with green showing | 3,340 |
| `Blender_Hibiscus_1` | `hibiscus` | A vase of glossy leaf masses on splayed stems, big red flowers (accent) | 2,750 |

### The silhouette pass on the packs before the goal (2 November 2026)

The owner's note that the trees read as "big green fluffy balls on the
trunks" was back-ported to every broadleaf already in the game, by three
agents (logs in tools/blender/logs/<id>.md; the pictures they worked from
are the study's photos/models/<id>/, fetched for the pass). Every reworked
model is at or below its old triangle count; names and variants are
unchanged. The pack sections above describe the trees before the pass.

| Pack | Trees reworked (rounds) | Outline now |
| --- | --- | --- |
| cartoon_pacific | Garry oak, bigleaf maple, dogwood, bay laurel (10 more each) | oak wider than tall on elbowed limbs; maple four big lobed masses on a Y fork; dogwood thin level shelves; bay a haystack with a hanging skirt |
| cartoon_drylake | ironwood (8 more) | an open, ragged, twiggy dome with sky through it |
| cartoon_broadleaf | oak, maple, aspen, alder (10) | oak a few heavy masses with notches; maple a dense upright egg, the only gapless crown; aspen a narrow ragged column on a white pole; alder a pointed loose oval |
| cartoon_lakeshore | cottonwood, black oak, sugar maple (10) | cottonwood a huge two-tier open crown on four great limbs; black oak crooked, leaning, lopsided; sugar maple broad, dense and round-topped |
| cartoon_desert | palo verde, mesquite (9) | palo verde a see-through umbrella of specks on green limbs; mesquite low, wide, flat-topped and dark with hanging tassels |
| cartoon_island | hala (7) | a leaning trunk on a cone of prop roots, candelabra arms ending in drooping spiky mops |
| cartoon_redwood | tanoak (9) | a tall narrow ragged column of olive shelves (narrower: 11 and 9.5 m) |

Left as they were: the madrone (already itself), the shrubs and flowers,
the cacti, palms, conifers and ground plants. The reworks had fewer rounds
than a new model's fifteen; they are reworks of models that had their own.

### cartoon_streets

`tools/blender/cartoon_streets.py`, 7 pieces at real size, fifteen rounds
each, front -Y, origin on the ground at the footprint's centre: street lamp
(acorn, 5 m), mailbox, lot light pole (9.2 m, two heads), wheel stop (1.83
m), bag drop (a hipped canopy 10.8 by 6.8 m), planted island (2.5 by 5.5 m,
its middle clear for a tree) and cart barn (40 by 12 m). The game places
all of them (roads.js `streetFurniture`, `placeCartBarn` and `mailboxAt`).

### The packs made for the new landscapes (2-3 November 2026)

Modelled by agents, fifteen rounds or more each, silhouette first, and all
in the game since phase 8c, each with its landscapes (the South's four,
`cartoon_southpines`, `cartoon_southoaks`, `cartoon_piedmont` and
`cartoon_southcoast`, went in with phase 5: every variant, a far twin for
each tree, the plantation clubhouse as `clubhouse.js` `clubhouseModel`;
`cartoon_texas` and `cartoon_deserts` with phase 6, every variant and
the pecans' and palms' far twins, the limestone as the boulder family
`boulderlimestone`; `cartoon_calcoast`, `cartoon_calinland` and
`cartoon_westmtn` with phase 7, the basalt and granite as boulder
families, the sea stacks offshore and the volcano as a horizon backdrop
(renderer.js `addSeaStacks`, `addBackdrop`); `cartoon_highdesert` and
`cartoon_plains` with phase 8a, the rimrock and hoodoos as boulder
families and the ranch pieces as story pieces (story.js), the plains' red
cedar as `easternredcedar`, apart from the redwood pack's western
`RedCedar`; `cartoon_appalachia` and `cartoon_neparkland` with phase 8b, the
Appalachian rhododendron as `rosebay` (the Puget pack's Pacific one keeps
the family `rhododendron`), the cabin, tobacco barn and shingled windmill
as story pieces, the horse fence a wall kind, the Tudor clubhouse a
clubhouse kind; `cartoon_north` and `cartoon_hawaii` with phase 8c, Hawaii's
ironwood as `casuarina` (`ironwood` is the desert's), the lava a boulder
family, the log cabin a ruin and the dock a story prop). Each script's header and `LOOK`/`BARK` tables hold its
colours and roles; each model's log holds its rounds.

**The owner's additions of 3 November 2026.** `cartoon_badlands`: the
Yellow Mounds (the Badlands' boulder family `boulderbadlands`), Rocky
Mountain juniper (far twins), green ash (far twin), chokecherry,
leadplant and the bison (lifeforms), fifteen rounds each and the four
seasons. Its spires, sawtooth wall, clinker butte, horizon wall and
cannonball concretion were built (sixteen rounds) and **cut**: the owner
wants the landscape's formations generated from the ground, as the other
landscapes' are (landforms.js `badlands`, ground.js strata); their logs
close with the reason. The lesson for the next rock: a turned (lathed)
shape reads as a cone however it is banded, and stripes coloured face by
face zigzag on a slope -- slice the faces at each bed's level instead
(tried in round 17, dropped with the models). `cartoon_prairiegrass`:
tall fescue, little bluestem, switchgrass, Indiangrass, blue grama and
western wheatgrass as long-grass families (`grasstallfescue`,
`grasslittlebluestem`, `grassswitch`, `grassindian`, `grassgrama`,
`grasswheat`; biomes.js `GRASSES`), fifteen rounds each and the four
seasons. Lessons: a clump reads only when dense (twice the blades of the
old families) and wide at the root -- every reference is a fountain; a
panicle is a cloud of short branches along the stem's top third, not a
star at its tip. Two things only the game showed (3 November 2026): a pack's
LOOK table reaches the game through src/season-tints.js alone, so run
tools/blender/dump-tints.mjs when a pack lands, or its colours live only in
the contact sheets (every long grass was the landscape's one colour until
then); and a model is scaled by its height, so a tuft of arching blades that
barely rises (`Blender_TallFescue_2`, radius 3.3 heights) lies six metres
across at 0.9 m tall -- vegetation.js `GRASS_WIDEST` squeezes it in.

**Desert Resort (5 November 2026).** `cartoon_resort`: Afghan pine
(`afghanpine`, a full layered egg to the ground with the trunk seen only near
it), African sumac (`africansumac`, a broad crown on a fork, its tufts round
the lobes) and pampas grass (`pampasgrass`, a mound of arching leaves and a
fan of cream plumes), sixteen rounds each, two variants, far twins for the two
trees (about 5,000, 5,300 and 3,800 triangles at their largest). Lessons: a
pine's egg is many small masses, not a few big ones (54 for the 16 m variant;
rounds 1-5 read as balls on a post); a crown's underside needs tufts too, or it
ends in a hard flat line; a plume fan has to spread as wide as the mound, or it
reads as a bouquet stuck in the top. Run build-meshes BEFORE dump-tints: tints
join through the model module, so a new pack's species are missing from
src/season-tints.js until build-meshes has written them.
