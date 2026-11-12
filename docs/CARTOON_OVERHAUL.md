# The cartoon overhaul

Branch `cartoon-overhaul`, begun 25 October 2026 from main at e3b6288 (ten
landscapes, Cartoon), **merged into main on 27 October 2026** at the owner's
word ("This is the GFX overhaul i want"), at generator 52; not released. The owner's brief is local (`docs/reports/cartoon-overhaul-goal.md`);
this page is the committed record of what the overhaul is doing, why, what it
has set aside, and how far it got. **It is the first thing to read before
more work on the look.**

The aim, in the owner's words: keep the Cartoon style, but make it look
designed rather than "cobbled together" -- every model remade in Blender, every
texture redone, landscapes that feel hand-crafted while staying generated from a
seed, and the rendering and lighting polished -- **without losing frame rate**.
When the owner comes back to play it, it should look familiar, and much better.

**This page was cut down on 12 November 2026** (the owner: retire the
journals of finished branches). It keeps what still governs work on the look:
the rules the overhaul set aside and how to undo each, the art direction, the
ground types, the tools, and how a round ran with its lessons. **The record of
the work itself -- the status table, the baselines, the landscape plan for the
ten landscapes of that day, the two later goals, every round of every model,
texture and light, the frame-rate pass and *Reading the ground* -- is in
[history/CARTOON_OVERHAUL.md](history/CARTOON_OVERHAUL.md), word for word.** A
section this page calls "below" and does not hold (*Rounds*, *Lighting*,
*Frame rate*, *Reading the ground*) is there. Search it; do not read it
whole. Most of the ten landscapes it names have since been retired or remade
(Haunted Hollow on 2 November 2026, the pare to fifteen on 5-8 November).

## Rules set aside

Every rule of AGENTS.md (or a doc it points to) that this branch sets aside is
listed here: the rule, why, what changed, and how to restore it. The owner
asked for this list so the suspension is visible after the fact. Generation and
graphics rules may be set aside where they block the look; nothing else may.

| Rule | Why it was set aside | What changed | How to restore |
| --- | --- | --- | --- |
| *Landscapes stay as they are for a seed* (the spirit of GENERATOR_VERSION discipline, AGENTS.md *Three version numbers*, then *Two version numbers*) | The overhaul exists to redesign every landscape | A seed makes a different course on this branch than on main. GENERATOR_VERSION is still bumped for each change, so an older save is flagged. AGENTS.md said so in *On the cartoon-overhaul branch, landscapes are meant to change* until the merge | Done at the merge (27 October 2026): AGENTS.md *The cartoon look is main's* -- a seed keeps its course again on main |

| *Unmown ground is rough* -- every planting rule asked `surface === 'rough'` (trees, boulders, Haunted Hollow's props, houses, deadfall, grass), and the tests held it | Ground between the holes is now nine types of its own (rock, hardpan, heather...) | Each rule asks `allows(surface, what)` (grounds.js): rough allows everything, rock and scree no trees, a wash nothing tall. Tests updated to ask the same: course-living, homes, haunted-props, landscape | Make every ground type answer like rough in `ALLOWS`, or drop the recipes |
| *A stream's faded end keeps its full channel's water level and narrows to 8% of its width* (streams.js `downhillProfile`) | The new dune crests stood a faded creek head 8.7 m under the ground: water lying on a dune | Across a fade the level rises toward the surveyed ground, and the channel narrows to no less than 1.2 m (the ground mesh's finest cells are 0.5 m). Every biome's creeks moved a little at their ends | Revert those two lines in `downhillProfile` |
| Three collider and prop tests' setups (solid-colliders' wall shot, haunted-props' pumpkin roll) | The new ground decided their results, not what they test: a prairie swale rolled a wall shot into the wall, the next house down a denser street was hit, a pumpkin's run-up crossed heather and a pond | The wall shot is lofted 4 degrees and fired with only its house standing; the pumpkin's whole run-up must be rough | Revert the test edits (and generator 37) |

| *Every crown on Ultra is the whole tree* (graphics.js, Ultra's `farTrees: 0`, the owner's "Ultra stays amazing") | The stands put 10,000-16,000 painted crowns on a course; drawn whole that is tens of millions of triangles | Painted trees swap to their shipped far twin (the same lobes, faceted) below 3% of the screen's height on Ultra, 5% on High (`farPainted`); the grown trees keep `farTrees: 0` | Set Ultra's `farPainted` to 0 |
| *The tee surround is never a clear-cut* (tools/metrics.mjs `teeSurroundClearCut`, tests/tee-corridor.test.mjs) measured every trunked tree against rough alone | A stand stands back from every tee by design, so counted in the average it made every tee look bare (35 courses failed with the surrounds unchanged); its needles turn rough into pine straw | Both measure the open scatter alone (`!t.stand`), per hectare of ground that can hold a tree (`allows(s, 'trees')`); the corridor test counts the open scatter against its target | Drop the `stand` filters (and the stands) |

(More rows are added as each is set aside, in the same commit as the change.)

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

- **The High and Ultra frame-rate gap was accepted** (*Frame rate*, below):
  "220 frames per second is still way higher than a golf sim actually needs."
  **Withdrawn 9 November 2026**: "Large courses in the builder can tank
  framerates even on this PC" -- every tier and device is in scope again
  (AGENTS.md). The open worry then was low-end machines on Low -- Low went from about 0.55 to
  1.0 ms a frame on Autumn on the 4090, and the software `weak` group has not
  been run (TODO; it needs the owner's word each time -- a software run once
  took the machine down).
- **Every PLACED look choice was approved** as sensible: the Clear reading
  of the ground as the default, crisp cartoon shadows, ink outlines on the tee
  furniture only, the flag's wind ripple, the house shade at the walls.
- **Merged on 27 October 2026**, after two more goals on the branch (the
  polish goal and the far-landscape and mowing goal). Until then single-turn
  requests followed on the branch under the goal's computer and
  rule-suspension terms; those ended with the merge (AGENTS.md, *The cartoon
  look is main's*).
- **To play it:** `dist/index.html` built from main, opened straight from
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
4. Before handing over: `npm test` (run with `npm test -- --jobs 3` when
   memory is short; `--test-concurrency=3` before tools/test.mjs), `node tools/biome-fingerprint.mjs --check` after any
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
