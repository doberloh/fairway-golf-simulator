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

Only its triangles, its normals and the **name** of each material; build-meshes
drops everything else and normalises the model to unit height, centred on x/z
and standing on y = 0. The material name decides the role the game paints
(`ROLE_OF` in `tools/mesh-read.mjs`):

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
