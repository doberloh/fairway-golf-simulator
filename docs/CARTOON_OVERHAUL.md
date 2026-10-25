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
| 1. Tools | in progress |
| 2. Landscape generation | not started |
| 3. Ground textures | not started |
| 4. Assets, biome by biome | not started |
| 5. Rendering and lighting | not started |
| 6. Frame-rate pass | not started |
| 7. Hand-over and showcase | not started |

## Rules set aside

Every rule of AGENTS.md (or a doc it points to) that this branch sets aside is
listed here: the rule, why, what changed, and how to restore it. The owner
asked for this list so the suspension is visible after the fact. Generation and
graphics rules may be set aside where they block the look; nothing else may.

| Rule | Why it was set aside | What changed | How to restore |
| --- | --- | --- | --- |
| *Landscapes stay as they are for a seed* (the spirit of GENERATOR_VERSION discipline, AGENTS.md *Two version numbers*) | The overhaul exists to redesign every landscape | A seed makes a different course on this branch than on main. GENERATOR_VERSION is still bumped for each change, so an older save is flagged. AGENTS.md says so in *On the cartoon-overhaul branch, landscapes are meant to change* | Rewrite that AGENTS.md section before any merge to main |

(More rows are added as each is set aside, in the same commit as the change.)

## Baselines (main, 25 October 2026)

Taken before any change, so every later number has something to stand against.
All local, under `bench/shots/overhaul/` (git-ignored):

- **Pictures**: `tools/capture/overhaul.mjs main <biomes> --build bench/shots/overhaul/main-build/index.html`
  -- nine fixed views per landscape (back tee at eye height, behind the first
  green, the same at golden hour, the second hole from the side, a green close
  to, the edge of the rough, the land beside a hole, two overviews), seed
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
- **A soft three-step ramp** for everything, the same one the ground uses,
  including the imported models that today have none.
- **Rim light** on foliage silhouettes, tinted by the sky (Fresnel; Barla's
  cell shading).
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
| `tools/gpu-gate.mjs` `foreignJobs` | Waits while a Playwright browser or Blender that is not ours is on the card (the realistic-graphics goal runs in another folder) |

## Rounds

Each asset, texture and lighting change goes through at least three rounds:
research, make, render, judge beside the references and the last round, write
down what is wrong, redo. The rounds are recorded below as they happen, with
their pictures kept under `bench/shots/overhaul/` for the showcase.
