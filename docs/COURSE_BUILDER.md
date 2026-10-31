# Fairway Course Builder

The record of the course builder: a second program in every download that
makes courses Fairway plays from a file. Branch `course-builder`, begun 31
October 2026. The design comes from a local study (`docs/studies/`, never
committed) marked up by the owner on 31 October; this document carries its
design, the owner's decisions and the sources, and records what was built,
stage by stage, with what each was measured against. **Read it first when
working on the builder.**

While the branch is open, AGENTS.md's *On the course-builder branch, the
graphics card and processor are free* holds: smoke runs, captures, profiles
and the pane need no asking; the goal does not stop for the owner, and every
stage is proven by data. The owner plays the result at the end. **Anything
nobody has played is reported as not played** (AGENTS.md, *Built is not
working*).

---

## What it is

| | |
| --- | --- |
| **The program** | `Fairway Builder.html`, a second single-file page beside `Fairway.html` in each of the four zips, built from the same source by `vite.builder.config.js`. Offline: it reads the files a player brings and writes `.fairway` files; it fetches nothing |
| **Door 1: Generate and modify a course** | Any landscape, Classic or Architect, every studio setting; grow it as often as wanted, then *take it over*: the world is frozen into a course document and every tool works on it |
| **Door 2: Generate a real life course** | LIDAR of a real place (every open form) and an aerial picture; the property chosen; tees and greens marked by hand; an auto trace that tries the LIDAR first and falls back on the picture; any landscape for the look |
| **Door 3: Open a course file** | A built file continues in the editor; a seeded file opens in door 1 with its settings filled in |
| **The editor** | Real-time ground shaping, surface paint and outlines, holes, water, trees, checks, a test round, save |
| **The game** | Plays a course from a seed (as today) **or from a built file**; places pins itself at the start of each round on a built course; marks such a course "built" or "real land" |

**Nothing here changes a generated course.** Classic and Architect generation,
the course of the week, Endless, challenges and the range are untouched; both
fingerprints stay silent at every stage.

## The owner's decisions (31 October 2026)

The owner took the study's recommendations, then answered the rest:

| # | Decision | Settled as |
| --- | --- | --- |
| 1 | The program's shape | A second single-file page in each zip; a native helper (a Bun program like `run_fairway_server`) only if a measured point cloud is too big for a browser tab |
| 2 | Files or seeds | Files for every course a player builds or keeps; the game's own play modes (course of the week, Endless, Surprise me, challenges, course codes) stay seeds |
| 3 | Pins per round | On built courses; generated courses keep their fixed pins per course (varied by pin day) |
| 4 | A friend's challenge on a built course | Allowed when both players have the same file (the challenge carries the file's hash); refused in plain words otherwise |
| 5 | "Every form of LIDAR" | Every open form read directly; the two closed ones (Esri zLAS, MrSID) by a named free converter |
| 6 | Built courses in the game | In the saved shelf with a "built" or "real land" mark; never the course of the week, a challenge or Endless |
| 7 | Sharing | **"Courses should be able to be shared as a file between users"** -- every built course, generated or real, is a `.fairway` file a player hands to another. The legal note on real courses (South Korea has protected course designs since February 2026; trademarks everywhere) stays a known risk; the owner has decided to allow it |
| 8 | Haunted Hollow | Always offered in the builder; a built Haunted Hollow course plays in any season |
| 9 | Hole counts | 9 or 18 |
| 10 | Property and detail | Cap 3 x 3 km; land at 1 m, greens and tees at 0.25 m -- PLACED, confirmed or changed by stage 1's measurement |
| -- | OpenStreetMap | A future idea, in IDEAS.md (*Under the hood*) -- not in this goal |
| -- | Tracing | **From the LIDAR first, falling back on the satellite picture** (*LIDAR first, the picture as fallback*) |
| -- | Tees and greens | Marked by hand on either door; Fairway places the pins |

## Course files

**Every course a player keeps is a file; every course the game makes is a
seed.** One reader returns a *course document* for either:

- **A seeded course**: `course-file.js`'s version-1 JSON -- name, settings,
  seed, generator stamp, picture. Grown by the generator on load.
- **A built course**: `.fairway` version 2, a ZIP (`zip.js`, hand-written on
  the browser's own CompressionStream; any unzip tool opens it) holding
  `course.json`, `land.bin`, `patches.bin` and `trees.bin` (`course-doc.js`).
  Nothing is generated when it loads.

| Part | What | Notes |
| --- | --- | --- |
| `course.json` | name, landscape, the designer it came from, extent, every surface as outlines (green, fairway, tee, sand, semi, path, native, waste; a polygon is rings, the first outer), water (outline, level, kind), holes (number, par, stroke index, tee sets, green, the line with its bends), credits, source notes, where it came from (seed and settings, or null), picture, `builtVersion` | Coordinates in world metres, rounded to the centimetre |
| `land.bin` | the land's height grid | Heights to the centimetre (PLACED) as 16-bit steps above the lowest point, each row differenced so the deflate finds the runs; a relief over 655 m takes a coarser step |
| `patches.bin` | finer grids on greens and tees | Same encoding |
| `trees.bin` | every tree a ball can hit: x, z, height, crown, trunk, role | 24 bytes a tree. The landscape picks the species drawn; the sizes are stored, so a tree plays the same in every landscape |

**Limits a file is checked against** (PLACED; `LIMITS` in course-doc.js): 16
million land samples (a 3 x 3 km property at 1 m is 9 million), 4 million in
patches, 200 thousand trees, 2 million outline points, 9 or 18 holes. A file
over them, damaged, or from a newer Fairway is refused in plain words.

**The same course makes the same bytes** (a fixed date in every ZIP entry), so
a built course's identity is its file's hash -- the friend's challenge check
and the game's cache key.

**`BUILT_VERSION`** (settings-schema.js) is how the game turns a built
document into a world. A built course never runs the generator, so
`GENERATOR_VERSION` and `ARCHITECT_VERSION` cannot move it; `BUILT_VERSION`
can, and is bumped with a line whenever a built course's ground, lie or trees
would change for an unchanged file.

## The game: a world from a file

The single biggest piece (stage 1). `worldFromDoc(doc)` returns the same world
object `generateWorld` does, from stored data: height from a sampler over the
land and patches through the same ground mesh, so the ball and the picture
agree; surfaces from a baked field the shader and `surface()` both read; holes
from records; water from stored outlines and levels; trees from the list; the
landscape's far ring past the property. Clubhouse, cart paths, markings and
story are not carried in the first version. The test that proves it: a
generated course frozen and rebuilt from its file compared with the generated
world -- surfaces at many points, heights, tees, greens, pins and the virtual
golfer's strokes.

## Pins

Fairway places the pins at the start of every round on a built course; the
builder never places one. `choosePin`'s day limits (`PIN_DAYS`: 1.0-3.2%
slope, 3-5 m from the edge) applied to the stored green outline and the 0.25 m
patch; banded front, middle or back along the approach; seeded per round and
stored, so saved rounds and a friend's challenge replay the same cups. The
builder's checks flag a green with too little legal room for a day's pins.

## The editor

Ground brush (raise, lower, smooth, flatten, level to a height, ramp,
roughen, restore) in real time on the frozen grid -- the builder draws the
land as a height texture displacing a tiled mesh, so a stroke is a small
texture update and the next frame shows it. Surface paint and outlines,
holes (tees, green, the line, bends, par, stroke index, renumbering), water
(outline and level), trees (place, remove, thin, paint a wood), bunker and
green shaping from the architect's recipes, checks with fly-to, a test round
by the virtual golfer, undo and redo, plan and 3D views, autosave.

## Real land: LIDAR

**Every open form, read directly**: LAS 1.0-1.4 (point formats 0-10), LAZ
(laz-perf compiled to WebAssembly), COPC (an ordinary LAZ 1.4 file), E57, PLY,
ASCII points (XYZ, TXT, CSV, PTS, PTX), GeoTIFF and Cloud Optimized GeoTIFF,
Esri ASCII grid, XYZ grids, Esri float grid and BIL, ERDAS Imagine, SRTM HGT.
**The two closed forms** -- Esri zLAS and MrSID LiDAR -- are named with a free
converter (Esri's LAS Optimizer or rapidlasso's LASliberator for zLAS).
Several tiles at once, of mixed forms. Ground from class 2 (or a ground filter
on an unclassified cloud), gaps filled, water flattened to its shoreline;
trees from canopy height peaks; position and units from the files themselves
(US survey feet converted and shown), reprojection only when sources differ
(proj4js).

## The picture, and LIDAR first

Pictures are for tracing and are never drawn in the game. In order of how
little lining up they need: the LIDAR's own colour or intensity; a
georeferenced picture (GeoTIFF, or JPEG/PNG/WebP with a world file); any
picture lined up by three or more matching points on the shaded relief; the
relief itself. An auto-align nudge after any of them. The builder states the
imagery licence position when a picture is loaded (Google, Bing and Esri
imagery: assume tracing forbidden; NAIP is public domain).

### LIDAR first, the picture as fallback

The owner, 31 October 2026: tracing of ground, trees, water, sand and the rest
is attempted from the LIDAR first and falls back on the picture where the
LIDAR cannot decide.

1. The LIDAR proposes, with a confidence per cell.
2. Where it is confident, it decides.
3. The picture decides below the confidence threshold (PLACED, set from
   measurement), where the LIDAR has no data, or where the file lacks the
   attribute a rule needs.
4. Where neither can, the cell is left rough and shaded for review.
5. Every outline records its source (LIDAR, picture, both, hand); the builder
   shows it as a layer.

| Surface | LIDAR first | Picture when |
| --- | --- | --- |
| Ground height | ground returns | never -- a picture has no height; no LIDAR at all takes the generator's land |
| Trees | canopy over 2 m, many returns a pulse | coverage gaps; leaf-off or leaf-out flights (crowns widened, never heightened) |
| Water | class 9, or flat with weak or no returns | no class 9 and returns over it; water drawn since the flight |
| Sand | a smooth hollow, bright in intensity | no intensity; intensity not separating; flat waste areas |
| Greens and tees | the smoothest raised pad round each mark | the edge (mowing differences are under the LIDAR's ~10 cm noise) |
| Fairway against rough | roughness and intensity, tried first | usually -- mowing heights differ by centimetres |
| Paths | narrow, smooth, intensity | gravel and worn paths |
| Buildings | class 6, or flat planes with single returns | unclassified roofs the filter is unsure of |

**No LIDAR at all**: a course still goes through door 2 on a picture alone --
every surface from the picture, the land from the generator under the
outlines, greens and bunkers by the architect's recipes; the builder and the
card say the land is not the real land. **Measured three ways**: LIDAR alone,
picture alone, LIDAR first with the picture as fallback, surface by surface.

The auto trace ships no trained model: per-surface rules (a short function
each), then a small classifier trained on the player's own corrections for
this course, then outlines by marching squares. Measured on **synthetic
courses** (a generated course turned into a fake LIDAR file and a fake aerial
picture, scored against its known surfaces; target PLACED: greens and bunkers
80% overlap, fairways 70%) and on the real test course.

## The test course

The owner named **GreatLIFE Golf & Fitness (Worthington Country Club),
Worthington, Minnesota** -- 18 holes, par 71 -- as the real course for the
LIDAR stages. Its data is the owner's local copy, downloaded on 12 October
2026 for another simulator, **read in place and never committed or shipped**,
nor any built copy of the course (tests that need it skip when it is absent):

- **The input**: four USGS 3DEP tiles as delivered (project
  MN_MissouriRiverBigSioux_2021_B21), 1 km each, about 255 MB of LAZ; QL1,
  flown 27 April - 23 May 2022, about 12.6 points per m² on the course; LAS 1.4
  point format 6 (intensity, no colour), about 45 million points; NAD83(2011)
  / UTM 15N (EPSG:6344), NAVD88 metres.
- **References to compare against** (the other simulator's products): the
  same tiles with vegetation and buildings classed; 0.5 m ground, surface and
  canopy-height grids; 2,413 trees (1,610 on the course) with height and crown.
  Its OpenStreetMap extract holds the course boundary and buildings only.
- **Also compared against**: USGS's own 0.5 m bare-earth DEM for the flight,
  NAIP aerial pictures of Nobles County, and the club's published scorecard
  (downloaded or read during the goal; none committed).

## Stages

| # | Stage | Status |
| --- | --- | --- |
| 0 | Groundwork: this record, OSM to IDEAS, the builder page and its build, the file format | **Built** (below) |
| 1 | The game plays a file: `worldFromDoc`, the field-only shader path, freezing, the frozen-against-generated comparison | **Built** (below); not played by a person |
| 2 | Pins per round on built courses | **Built** (below) |
| 3 | Builder shell and door 1 | **Built** (below); not played by a person |
| 4 | Real-time ground shaping | **Built** (below); not played by a person |
| 5 | The editor's tools, checks, test round | **Built** (below); not played by a person |
| 6 | LIDAR readers; Worthington's ground and trees against the references | |
| 7 | Door 2 end to end on Worthington | |
| 8 | Auto trace, LIDAR first, measured three ways | |
| 9 | Release-ready: docs sweep, distribution review, notices | |

### Stage 0 (31 October 2026)

- **`builder.html`** and **`vite.builder.config.js`**: the builder's page,
  built single-file after the game in `npm run build` into
  `dist/builder.html` (108 KB at stage 0), with its own version line
  (`fairway-builder-versions`: generator, schema, built). The game's
  `fairway-versions` tag is untouched.
- **`src/builder/`**: the shell (`builder.js`, `builder.css`) with the three
  doors; doors 1 and 2 and the editor are placeholders until their stages.
- **`src/zip.js`** and **`src/course-doc.js`**: the container and the built
  document, with tests (`tests/zip.test.mjs` -- including Python's zipfile
  reading what it writes -- and `tests/course-doc.test.mjs`).
- **`BUILT_VERSION`** 1 in settings-schema.js.
- **The packager** (`tools/package_release.py`) puts `Fairway Builder.html`
  in every zip and `dist/builder.html` in `RELEASE_SHA256.txt`, and refuses a
  stale builder build. **Owed before a release**: check the website's demo
  check reads `RELEASE_SHA256.txt` by name, so the second line does not
  confuse it (AGENTS.md, *What the website takes from here*).
- **`tools/builder-smoke.mjs`**: the builder's own smoke harness, file:// and
  no requests, like the game's; journey `builder-opens` passed (31 October,
  through `tools/gpu-run.mjs`).

### Stage 1 (31 October 2026): the game plays a file

- **`src/built-world.js`** -- `worldFromDoc(doc, settings)`: the generator's
  world contract from a built document. The land a bilinear sampler over the
  stored grid with the 0.25 m patches faded in over 1.5 m (PLACED); the same
  adaptive ground mesh the generator builds, refined on greens, tees, sand and
  within 3 m of water. The surfaces **one baked field in two RGBA8 textures**:
  sand, green, fairway, tee; water, semi-rough, and the ground types as a code
  plus a distance (so all ten ground types and the cart path travel, not one
  "native" channel -- the first version's, rejected on its numbers). Texel half
  a metre, coarser only where a course is wider than 2048 texels (about 1 m
  for a big eighteen); the field reaches 6 m either side of an edge (PLACED).
  The lie, `builtSurface`, and the paint, ground.js's built branch, read it in
  one order. Holes: the game's hole object on the back tee facing the green,
  its centre line the stored line, widths measured off the fairway field,
  greens answered exactly from their outline (`greenDistance` asks a built
  hole). Trees with stored trunks and crowns, drawn as their stored species
  while the course wears the landscape it came from, else by role
  (`speciesFor`). Creeks and rivers as the generator's own stations through
  the same channel lookup (`streamIndex`, extracted from `generateStreams`
  unchanged -- both fingerprints silent).
- **`src/freeze.js`** -- `freezeWorld`: door 1's *Take it over*. Shapes traced
  where shapes exist (greens, bunkers, ponds, lakes, tees and their collars,
  the fairway and semi-rough corridors, cart paths), the ground types, beach
  and blowouts from a 1 m raster (`src/contour.js`), the land at a third of
  the ground mesh's spacing each way, every green, tee and bunker at 0.25 m.
  Not carried: houses, clubhouse, boulders, haunted props, walls, markings,
  life.
- **`src/built-store.js`** and **main.js**: a built `.fairway` opened from
  Saved courses (Import courses from a file, or dropped on the screen) is
  kept in IndexedDB by its hash, listed in the library with the hash as
  `settings.built`, played through the same path as any saved course, and
  saved back out as its own file; a built course has no code (it refuses one
  in plain words). The game's ground shader paints it (the `builtOn` branch),
  the renderer draws its ponds and lakes from their outlines, the maps draw
  its outlines. A saved round on a built course carries the hash and resumes
  by loading the file first. `BUILT_STAMP + BUILT_VERSION` is its stamp.
- **Measured** (RESEARCH *Course builder: a world from a file*): surfaces
  97.1-99.7% the same at every 2 m on every landscape; the ground within
  0.4 cm at the 95th percentile; greens within 0.12 cm at the median; every
  par, tee and green the same; eight virtual golfers within their error on
  three landscapes; from above, 1.4% of pixels differ in the built game; the
  shader's new branch costs Classic nothing measurable on any tier.
- **Not seen by a person**: no one has played a built course in the game.
  The capture tool played one (lab.course) and photographed it.

- **Low, a built course against its generated original** (`profile.mjs --only built`, real GPU, 31 October): Midwest 0.83 against 0.99 ms of graphics time, PNW 1.07 against 1.20, Links 0.93 against 0.96 -- a frozen copy costs no more, and a little less (it carries no houses or props). The first measurement had PNW's copy 25% dearer: the frozen trees had lost the generated forest's `stand` and `under` marks, so Low drew every understory plant. Both now ride in the stored role (+8, +16).
- **Every landscape loads** its frozen copy in the built game (a nine each, Low, 2.6-13 s, no error). The first try found Links hanging: `addFarHeath` (vegetation.js) read the generated landscape's `landform` record, which a built world does not have, threw while the course was being drawn, and left the load waiting for ever -- the profiler's first two runs stalled there (*Graphics card log*). Heather on a built course is now its own outlines.

### Stage 2 (31 October 2026): pins per round

- **A built course's cups are cut when a round starts**: `placeBuiltPins`
  (built-world.js) runs the generator's own `choosePin` on every hole -- the
  hole's band, the pin day's slope and room from the edge -- reading the
  slope off the stored ground (`greenSlopeAt` asks a built hole's height) and
  the room off the green's outline. Seeded by the round: `Round.pinSeed`
  (game.js; a round's own id unless told otherwise), passed to the world as
  `settings.builtPins` and in the world key, so a new round is a new world and
  a resumed round finds the same cups.
- **A friend's challenge on a built course** carries the file's hash and the
  challenger's pin seed (rival.js `b`, `p`); played without the file it is
  refused in plain words ("ask for its .fairway file").
- **Generated courses keep their pins** (one per course, varied by pin day).
- Tested: tests/built-pins.test.mjs (every cup on its green, 2 m or more from
  the edge, under 6% slope, Thursday and Sunday; the same seed the same cups;
  the seed through a save and through a challenge code).

### Stage 3 (31 October 2026): the builder's shell and door 1

- **Door 1** (`src/builder/door-generate.js`): the game's own settings
  schema as a form (every setting, by category, Architect's shown for
  Architect), *Grow this course* in slices so the page keeps painting, a
  picture from above, *Take it over* (freeze.js) into the editor.
- **The editor** (`editor.js`, `view.js`, `editing.js`, `checks.js`): a
  working 3D view (the land as plain meshes, every stored sample to about
  1 km a side and coarser past it to stay under 2.2 million vertices, PLACED;
  the surfaces one texture in the landscape's colours, patched where a brush
  paints; trees as coloured cones; water, tees, flags and lines), the tool
  column, the holes and checks on the right, undo and redo (Ctrl+Z, Ctrl+Y),
  the landscape switch, Save as a .fairway file.
  **Decided: the editor's view is not the game's picture.** The game's
  renderer builds a whole course in seconds; a brush needs the next frame. So
  the editor draws its own plain view, and how the course looks in Fairway is
  seen by opening the saved file in the game. The spec's "looks in the
  builder the way it will in the game" is not met by the editor's view.
- **The editing model** (`editing.js`, pure): the surfaces as a grid of codes
  while editing (half a metre, coarser past 4096 cells a side), painted and
  filled, traced back into outlines on save -- untouched, a document keeps its
  own outlines; the land changed in place on its grid and patches; undo for
  every tool (a drag is one step).
- **Measured**: the `builder-door-1` smoke journey grows a nine, takes it
  over, raises the ground with a drag, paints sand, undoes and redoes, saves
  the file (a ZIP over 100 KB), opens it in the built game and plays a tee
  shot on it (59 s, passed 31 October). The builder page is 907 KB (three.js
  and the generator now ride in it).
- **Not played by a person.**

### Stage 4 (31 October 2026): shaping the ground in real time

- **Real time, measured** (`builder-shaping` journey, a frozen nine, RTX
  4090): a brush dab -- the model's change and the view's redraw of the ground
  it reached -- takes **3.8-4.0 ms at the median, 7.8-8.9 ms at worst**; the
  frames after it stay at the display's 16.4 ms. A forty-dab drag is one undo.
- **The game plays the ground as shaped.** The first shaped hill (9 m over
  12 m) played 0.41 m low on its top: the game's ground mesh is 3 m apart away
  from greens, tees and sand, and a coarse triangle cut the hill's crown. A
  built world now refines any cell whose middle stands more than 6 cm (PLACED)
  off its corners -- everywhere on land that did not come from the generator
  (LIDAR), and inside the boxes the player shaped on a taken-over course (the
  editor records them, `landEdits` in the file). After it: 28.06 m in the
  builder, 28.06 m in the game. **Rejected: refining by that rule everywhere**,
  which made a frozen Mountain worse (99th percentile 1.1 -> 14.5 cm, worst
  1.35 m): there the stored land IS the generator's coarse triangles, and a
  refined cell across a crag's crease swapped them for a smoother surface.
- `BUILT_VERSION` stays 1: no built file has left the branch.

### Stage 5 (31 October 2026): the editor's tools, checks and a test round

- **The tools**: shape (raise, lower, smooth, flatten, ramp, roughen,
  restore), paint every surface and ground type, fill an outline, draw a pond
  (its level just under its lowest bank), **draw a creek** (stations every
  2 m, the water never rising downstream, the channel cut into the land, the
  same station record a generated creek has so the game draws and plays it;
  drawn from either end, it runs from the higher one), **dig a bunker** (sand in
  a disc and a hollow under it, 0.6 m at the middle, PLACED), plant and clear
  trees, place each hole's tees, green and bends, par, the landscape, undo and
  redo for every one.
- **Checks** (`checks.js`): a tee off its pad or in water, a green mark off
  its green, a green too small for a cup 3 m from the edge, a green steeper
  than 6% on average, a green under a pond's level, a tree on a green -- each
  with where it is.
- **A test round** (`test-round.js`): the virtual golfer (tests/
  virtual-golfer.mjs, unchanged) plays every hole twice -- a steady golfer and
  a looser one -- with the round's own rules and pins, and reports strokes
  against par and any hole not finished in 40 (where the ball was left). A
  frozen nine plays in 1.9 s.
- **Measured**: the `builder-tools` journey drives every tool by its button
  and the mouse, undoes, runs the checks and a test round, saves, and finds
  each change in the file read back in Node (passed, 11 s). Its test round
  found holes 2 and 3 unplayable -- the journey's creek is drawn across both
  landing areas and every drive ran down its banks into the water, back to the
  tee each time under stroke and distance: the report working as meant.
- **Not built in stage 5**: creeks and ponds cannot be moved or deleted once
  drawn except by Undo; holes cannot be added or removed (a course stays 9 or
  18); green contour stamps beyond the brush. In TODO.

## PLACED, and rules the build decided

Numbers placed rather than measured, and rules the study left open, so the
owner can overrule them:

- Heights stored to the centimetre; the file's limits (above).
- Land 1 m, greens and tees 0.25 m; the 3 x 3 km cap.
- A fixed ZIP entry date (1 January 2026), so a file's hash is its identity.
- The built field: half a metre (coarser past 2048 texels), 6 m either side of
  an edge; a patch fades into the land over 1.5 m; a ground type's texel step
  where two types meet.
- Freezing: the ground types from a 1 m raster, simplified to 0.35 m.
- A built course's file is kept by a 96-bit prefix of its SHA-256.
- The editor: the land drawn at every stored sample to about 1 km a side,
  coarser past it (under 2.2 million vertices); the surfaces edited at half a
  metre (coarser past 4096 cells a side), traced back simplified to 0.35 of a
  cell; a brush's raise or lower 0.5 m a dab at full strength.
- The checks: a green needs 3 m of room for a cup (Sunday's), and over 6%
  average slope is too steep to putt.
- The game's mesh refined where it misses the land by over 6 cm (shaped or
  LIDAR ground).
- A drawn creek: width half the brush (1.5-12 m), water 0.4 m under the ground
  at its head, 0.7 m deep, banks graded 1 in 2; a dug bunker 0.6 m deep.
- The test round: two golfers (steady, loose), stuck after 40 strokes.

## Graphics card log

Every run through `tools/gpu-run.mjs --goal course-builder` (30%, 80 °C, a
minute apart; the card read before each), 31 October 2026:

| # | What | Result |
| --- | --- | --- |
| 1 | `builder-smoke` (builder-opens) | passed |
| 2-3 | `freeze-capture` (Midwest, High) | pictures; no error |
| 4-5 | `profile --only tiers`, main's build then the branch's | Classic unchanged on every tier |
| 6 | `profile --only built` | **stalled** on Links' frozen copy (a page error left the load waiting); stopped by hand after about 13 minutes at full load, 68 °C, its headless browsers closed by hand. A second run stalled at the same case and was stopped the same way; the cause was then found without the card and fixed |
| 7 | `profile --only built` (after the fix) | all six cases |
| 8-10 | `builder-smoke` | door 1 failed on the harness (a button name), then on the editor (its land drawn facing down), then passed |
| 11-12 | `builder-smoke --only builder-shaping` | failed (the hill played 0.41 m low), then passed after the refinement |
| 13 | `builder-smoke --only builder-tools` | passed |

## Sources

- The study's sources, read 31 October 2026 (search results; to be read in
  full where a stage depends on them): laz-perf (https://github.com/hobuinc/laz-perf;
  Apache-2.0 per Alpine's package metadata, to confirm in its LICENSE); COPC
  (https://copc.io/); Esri's zLAS and LAS Optimizer
  (https://lidarmag.com/?p=6066) and rapidlasso's LASliberator
  (https://rapidlasso.de/new-lasliberator-frees-lidar-from-closed-format/);
  libE57Format, BSL-1.0 (https://dfsg-new-queue.debian.org/reviews/libe57format);
  geotiff.js, MIT (https://geotiffjs.github.io/); proj4js, MIT, NTv2
  (https://github.com/proj4js/proj4js); another simulator's builders on a 2 m
  grid for green contours (https://www.linkscorner.org/phpBB/viewtopic.php?p=22916,
  a forum post: weak).
- The test course's LIDAR: USGS 3DEP, MN_MissouriRiverBigSioux_2021_B21,
  work unit MN_MORiverBigSioux_1_B21
  (https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/MN_MissouriRiverBigSioux_2021_B21/MN_MORiverBigSioux_1_B21).
- The real-courses study's sources (USGS 3DEP, the Environment Agency, NAIP,
  OpenStreetMap's golf tags and ODbL) are in RESEARCH.md once a stage uses
  them.
