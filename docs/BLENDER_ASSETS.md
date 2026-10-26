# Models built in Blender

Since 23 October 2026 some of Fairway's models are built in **Blender**, from
scripts in this repository, rather than taken from a CC0 pack or grown by
`tools/grow.mjs`. This page is how to recognise them, remake them and add more.
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

Anything not named `Blender_...` came from somewhere else: the Kenney and
Quaternius packs (ATTRIBUTION.md), the grown redwood forest
(`tools/grow.mjs`), or the baked trees (`tools/bake-*.mjs`).

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
  second face pointing the other way (`_blade_two_sided` in lakeshore.py).
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

### lakeshore (23 October 2026)

`tools/blender/lakeshore.py`, 17 models, for Lakeshore Dunes:

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

The `cartoon-overhaul` branch remakes every model in one hand
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
`grasstussock` (Haunted Hollow) and `grassplume` (Island). Each is 40-200
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

`tools/blender/cartoon_island.py`, 7 trees: `Blender_Palm_*` (`palm`: a curved
ringed column, a crown of 15-20 arching fronds of overlapping leaflets,
coconuts) and `Blender_Hala_*` (`halatree`: prop roots, a forked trunk, a
dense crown of strap-leaf rosettes, orange fruit). They replace Kenney's palms
and the procedural hala. Their leaves are single faces, so vegetation.js draws
the leaf part two-sided (`THIN_LEAVES`; also bracken and ocotillo). No far
twins: flat leaves gain nothing from one.

### cartoon_haunted

`tools/blender/cartoon_haunted.py`, 10 dead trees from one crooked branching
helper (`crooked`, `branch`): `Blender_Gnarled_*` (a short twisted trunk, thick
limbs hooking up and clawing down), `Blender_Snag_*` (a broken conifer: jagged
top, stubs, bark peeling to pale wood -- the accent), `Blender_DeadWillow_*`
(a split trunk, long whips hanging) and `Blender_DeadOak_*` (`deadoaktree`, a
twisted spreading skeleton). 320-950 faces each. They replace the MegaKit's
gnarled oaks (about 7,500 vertices each), the Ultimate Stylized snags,
Kenney's dead willows and the Kenney dead hardwoods (`arid`, now gone); the
model module is about 650 KB smaller for it.

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

### cartoon_props

`tools/blender/cartoon_props.py`, Haunted Hollow's props: `Blender_Pumpkin_1..3`
(a ribbed lathe, 8-12 ribs, a twisted stem) and `Blender_Toadstool_RedGroup`,
`_RedTall` and `_TanGroup` (domed caps flecked with white warts, stout stalks
with a ring). Built to the Kenney models' proportions, because two things are
laid on them: the collision radius (species.js `PROP_MODELS`, re-measured --
pumpkins 0.71, the groups 0.65 and 0.77, the single 0.35) and the lantern face
(haunts.js `faceGeometry`, on a body 0.67-0.70 of its height in half-width), so
every pumpkin is round, not squashed. haunts.js draws them painted.

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
grown models (tools/grow.mjs) no longer ship on this branch; `thinSprays` is
kept, and tested on a built crown, for main's sake.

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

`tools/blender/cartoon_lakeshore.py` remakes Lakeshore Dunes' set (lakeshore.py,
built before the overhaul with no paint or bent normals) in the overhaul's
hand under names of their own, `Blender_Lake*`, so the old pack stays as main
has it: cottonwood (a furrowed trunk forking into great limbs, each carrying a
cloud), black oak, sugar maple (with far twins), creeping and vase junipers,
dune grass patches of splayed tussocks, and bleached driftwood (now drawn
painted).
