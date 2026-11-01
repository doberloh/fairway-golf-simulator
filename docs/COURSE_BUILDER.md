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
on an unclassified cloud), gaps filled and relaxed smooth, a traced pond's
floor carved a metre under its level; trees from canopy height peaks;
position and units from the files themselves (US survey feet converted and
shown); UTM and degrees converted by Fairway itself, any other map grid lined
up by matching points (proj4js was not added: stage 6).

## The picture, and LIDAR first

Pictures are for tracing and are never drawn in the game. In order of how
little lining up they need: the LIDAR's own colour or intensity; a
georeferenced picture (GeoTIFF, or JPEG/PNG/WebP with a world file); any
picture lined up by three or more matching points on the shaded relief; the
relief itself. (An auto-align nudge after any of them: not built; TODO.) The builder states the
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
| Sand | rougher than mown turf (raked), a little darker to the laser than the fairway, low -- measured at stage 8; the design's "a smooth hollow, bright in intensity" was wrong on both counts | the LIDAR has no intensity, or where the LIDAR does not call it and the picture's pale, ungreen patch is not road-smooth |
| Greens and tees | the smoothest raised pad round each mark | the edge (mowing differences are under the LIDAR's ~10 cm noise) |
| Fairway against rough | smooth open ground near the hole's line only (a weak call) | always where there is a picture -- mowing heights differ by centimetres |
| Paths | not traced yet (TODO) | |
| Buildings | not traced yet (TODO) | |

**No LIDAR at all**: a course still goes through door 2 on a picture alone --
every surface from the picture, the land from the generator under the
outlines, greens and bunkers by the architect's recipes; the builder and the
card say the land is not the real land. **Measured three ways**: LIDAR alone,
picture alone, LIDAR first with the picture as fallback, surface by surface.

The auto trace ships no trained model: per-surface rules (a short function
each), then outlines by marching squares. (The study's next step, a small
classifier trained on the player's own corrections for this course, is not
built; TODO.) Measured on **synthetic
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
- **Also compared against**: USGS's own 1 m bare-earth DEM for the flight,
  NAIP aerial pictures of Nobles County, and the club's published scorecard
  (downloaded or read during the goal; none committed).

## The amended goal (the owner, 31 October 2026, after testing)

After trying the builder, the owner amended the goal:

1. **Door 2 in this order**: load the LIDAR; build the land; **choose auto
   trace or manual trace**; place each hole's **tee, aim and green markers**;
   name the course; edit mode. The picture to trace over is part of tracing.
   So the auto trace now runs **before** any hole is marked: it must find
   greens and fairways from the picture and the land alone, and the markers
   come after, onto what was traced.
2. **Manual trace is built**: the player traces any ground type, places tree
   zones and single trees, water -- everything -- with brushes that paint as
   well as outlines, and smoothing on shapes.
3. **Zoom and drag on the tracing and LIDAR views**, for precision.
4. **Ten iterations on the auto trace's detection of course features, the
   picture first** (the LIDAR in a later loop), on real courses from
   different parts of the world matching Fairway's landscapes, Haunted Hollow
   aside -- and **no jagged or pock-marked edges** on what is drawn.

5. **Google and Bing imagery for the picture**, searched for by place,
   **sized automatically** onto the land and **dragged into line by hand**
   where needed (the owner, later the same day). Both need the player's own
   key and both limit tracing in their terms; the builder goes online only
   when the player asks for imagery -- an exception to "no network in either
   page" that the owner's request makes, kept to that one button.
6. **Research free imagery to use beside Google** (the owner): findings in
   RESEARCH.md, *Free aerial imagery for the builder*; the open services found
   are offered in the builder where they cover the land, with no key.

The four parts of the study's tracing design not yet built -- paths and
buildings in the trace, the alignment nudge, a review layer, a classifier
learnt from corrections -- wait for that later loop (TODO).

## Stages

| # | Stage | Status |
| --- | --- | --- |
| 0 | Groundwork: this record, OSM to IDEAS, the builder page and its build, the file format | **Built** (below) |
| 1 | The game plays a file: `worldFromDoc`, the field-only shader path, freezing, the frozen-against-generated comparison | **Built** (below); not played by a person |
| 2 | Pins per round on built courses | **Built** (below) |
| 3 | Builder shell and door 1 | **Built** (below); not played by a person |
| 4 | Real-time ground shaping | **Built** (below); not played by a person |
| 5 | The editor's tools, checks, test round | **Built** (below); not played by a person |
| 6 | LIDAR readers; Worthington's ground and trees against the references | **Built** (below) |
| 7 | Door 2 end to end on Worthington | **Built** (below); not played by a person |
| 8 | Auto trace, LIDAR first, measured three ways | **Built** (below) |
| 9 | Release-ready: docs sweep, distribution review, notices | **Done** (below); not merged or released |

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

### Stage 6 (31 October 2026): LIDAR read, Worthington's ground

- **The readers** (`src/lidar/`): `las.js` (LAS 1.0-1.4, point formats 0-10,
  read by hand; LAZ and COPC through laz-perf, the LASzip decoder compiled to
  WebAssembly, Apache-2.0 -- the one dependency added, and only to the
  builder's page, its WebAssembly inlined and handed in as `wasmBinary` so it
  never fetches: `laz.js`), `geotiff.js` (GeoTIFF, BigTIFF, Cloud Optimized:
  strips or tiles, none/LZW/Deflate/PackBits, both predictors, 8-64-bit,
  GeoKeys and no-data, a window decoded alone -- read by hand rather than
  through geotiff.js and its eight dependencies), `formats.js` (E57 with its
  pages, packets and pose; PLY ASCII and binary; PTS; PTX; XYZ/TXT/CSV with or
  without a header; Esri ASCII grid; Esri float grid and BIL with their .hdr;
  SRTM HGT; the form told from name and first bytes), `geo.js` (UTM and
  latitude-longitude both ways, Snyder's series on GRS80; which pairs of map
  grids it can line up), `land.js` (points gridded a cell at a time, never
  held whole: ground from classes 2 and 8, an unclassified cloud's ground from
  a progressive morphological filter, tops of everything, the laser's
  brightness, colour, water and building shares, cells with no return;
  holes filled from their edges; trees found as canopy peaks).
- **Not read, and said so with how to convert**: Esri zLAS and MrSID (closed
  formats; Esri's free LAS Optimizer, rapidlasso's LASliberator, Extensis'
  tools), ERDAS Imagine and the old USGS DEM (open; not read yet: GDAL to
  GeoTIFF). **proj4js was not added**: Fairway converts UTM and degrees
  itself, which covers most open data; another map grid lines up by matching
  points by hand (stage 7). A departure from the study, which named proj4js.
- **Units**: a file's units from its GeoKeys (3076 horizontal, 4099 vertical)
  or its WKT, metres, international feet or US survey feet each way, shown
  and converted; Worthington's tiles are EPSG 6344 in metres both ways.
- **Worthington, measured** (`tools/lidar-compare.mjs`, the owner's local
  copy, 0.5 m cells over the 819 x 734 m property): all four raw tiles,
  45,411,335 points, read with Fairway's own readers in 23 s (about 5.5 s a
  tile); the survey's own ground class kept 70% of points; 6.3% of cells had no
  ground return and were filled.
  **Ground against USGS's own 1 m bare-earth DEM** (downloaded, 266 MB, LZW
  with the floating-point predictor -- also the real test of the LZW reader):
  **median 0.7 cm, 95th percentile 2.8 cm, 99th 5.3 cm** where the survey saw
  ground; filled cells median 2.6 cm, 95th 24 cm (1.3 and 8 cm since stage
  7 relaxed filled ground). **Against the other
  simulator's 0.5 m terrain model**: median 0.4 cm, 95th 1.5 cm. **Canopy**
  against its canopy model, where either is over 2 m: median 28 cm (the
  95th percentile is 8.9 m: crown edges, one saying tree and the other ground).
  **Trees**: theirs 1,984 on the property, Fairway's 1,839; 1,405 within 3 m
  of each other (71% of theirs, 76% of ours; since stage 7, 1,792 and 1,404,
  71% and 78%), height error median 0.34-0.66 m,
  crown 0.9 m. At 1 m cells the trees matched 61% and 84%.
- **Tested**: tests/lidar-readers.test.mjs writes one small survey in every
  form (LAS formats 0-3, 6-8 and 10; GeoTIFF plain, Deflate with the float
  predictor, LZW, tiled; E57 across packets and pages with a pose; PLY both
  ways; PTS; PTX with its transform; XYZ both ways; ASCII grid; float grid;
  HGT), reads each back, grids it (classified and filtered ground, the tree at
  its height), and reads a real Worthington LAZ when `FAIRWAY_LIDAR_TEST`
  names the folder.

### Stage 7 (31 October 2026): door 2 end to end

- **Door 2's steps** (`src/builder/real-course.js`, pure, run by the page and
  by the scripted build alike): `landFromSources` gathers every source onto
  one grid over the property and the 150 m past it the game's mesh needs;
  `pictureOnLand` lays a picture on that grid by its own position (geo.js) or
  by points matched by hand (`affineFromPairs`, least squares, reporting the
  worst pair's error in metres), each tile filling only what the ones before
  left; `docFromLand` makes the built document -- the traced surfaces as
  outlines (marching squares, simplified), each pond its outline with its
  level just under its lowest tenth of shore and its floor carved a metre
  below (the survey's ground there was filled in from the shore, so it stood
  at the water's own level), the holes with par from length where none is
  given, the trees on rough and semi only, conifer when narrow for their
  height. With no trace, each green is a 12 m disc and each tee a pad.
- **The page** (`src/builder/door-real.js`): six steps down the left beside a
  plan of the land (shaded relief, the picture, the trace over it, the marks
  and lines). The LIDAR files with their .prj/.hdr; a first look at a quarter
  of the points and a property box dragged on it (to 3 x 3 km); the land; a
  picture by position, by matched points, or the survey's own colour; the
  holes clicked tee then green; the trace three ways; the landscape, name and
  credit; then the editor.
- **Measured on Worthington** (`tools/real-course.mjs`, the owner's tiles and
  four NAIP 2021 quarter-quads lined up by position, together covering 100%
  of the land; holes marked from OpenStreetMap's 18 numbered greens, each
  given the tee that best fits the club's card -- near the yardage, near the
  previous green, not another hole's): the land 2,359 x 2,189 cells at 0.5 m
  (1,179 x 1,094 m with the margin), 15.3 million points, in 26 s; the file
  **3.2 MB** with 4,484 trees and 10 ponds, made in 71 s. **Lengths against the
  card** (blue): median 22 yards off, worst 84; 5,889 yards against the card's
  6,282 -- the built holes run straight from tee to green and the card
  measures round the doglegs; hole 2's tee is missing from OpenStreetMap, so
  the nearest pad was taken (228 yards for the card's 173). **The test round**:
  96 against par 71, nothing stuck (a generated Midwest eighteen: 65 and 68
  against 68). The first round stuck 70 cm from two cups -- the survey's
  centimetre noise left pits on the greens; greens and tees are now averaged
  over 2.5 m and fairways 1.5 m when the course is made.
- **Driven in the browser**: the `builder-door-2` journey makes a survey (a
  LAS file of a nine-hole parkland with a pond, bunkers and trees), brings it
  in, builds the land, marks nine holes by clicking the plan, traces, opens the
  editor, saves, and the game plays a tee shot on the file (passed, 41 s). Its
  first runs found three real faults: a survey of a point a square metre
  gridded at half a metre left most cells empty and every empty cell read as
  water (the cell is now never finer than the points' spacing); the land past
  the survey's edge, where nothing came back, became a lake (water must not run
  to the edge); and a filled pond's floor carried its rim's bumps inward in
  streaks, 25% steep (filled ground is now relaxed smooth -- which also brought
  Worthington's filled cells to a median 1.3 cm off USGS's DEM, from 2.6, and
  the 95th percentile to 8 cm from 24).
- **Worthington through the page** (the `builder-door-2-worthington`
  journey, local only: it runs when `FAIRWAY_LIDAR_TEST` names the owner's
  folder): the four raw LAZ tiles chosen in the builder, the property dragged
  round the club on the relief, the land built, the four NAIP tiles chosen one
  after another, eighteen holes clicked on the plan where OpenStreetMap's
  greens and the card's tees are (`tools/osm-holes.mjs`, the same marks as the
  scripted build), traced LIDAR first, named, opened in the editor and saved
  -- **60 s from the first file to the saved course**, 135 s with the
  measuring and a tee shot in the game. The page's file, measured by
  `tools/built-compare.mjs` (which reads only the saved file; a real course's
  file now keeps its place, `source.origin` and `source.epsg`): **ground on
  open land against USGS's DEM median 0.6 cm, 95th 2.9, 99th 5.9** (688,125
  points a metre apart); against the other pipeline's terrain model 0.4, 2.0
  and 4.9 cm; outlines against OpenStreetMap greens 62%, tees 25%, fairways
  37%, sand 28%, water 47% (tees 28% once the missed pads below were given); the same surface as the scripted build's file on
  97.7% of the property and the same ground to 0.7 cm; lengths against the card
  as the scripted build's; the test round 90.5 against par 71, nothing stuck
  (95.5 after the pads below: the golfers' dispersion moves a few strokes);
  4,522 trees, 8 ponds, 3.2 MB. It also found the first tee playing from
  semi-rough -- the trace had drawn no tee under that mark -- and a green or
  tee the trace misses now gets the plain one under its mark.
- **Low, measured** (`profile --only built --built-file`, the page's file
  against a generated Midwest eighteen, 31 October 2026, RTX 4090): the real
  course 0.70 ms of processor time a frame (median) and 0.81 ms of graphics
  card, the generated one 1.00 and 1.18 -- 190 draws and 7.0 million
  triangles against 252 and 12.0 million. A real course from door 2 costs Low
  less than a generated one.
- **Not seen by a person**: in TODO.

### Stage 8 (31 October 2026): the auto trace, LIDAR first

`src/lidar/trace.js`, with no trained model: a rule per surface over each
cell, every call keeping its source (LIDAR, picture, both) and how sure it was.

- **The course is its own yardstick.** Each hole's approach (15-45 m short of
  the green along the line into it) is fairway on nearly every hole; what it
  looks like there -- to the laser and in the picture -- is what sand and
  water are told from. Fixed colours and brightness failed at once on real
  data: a picture's colours and a survey's brightness change with the camera,
  the month and the course.
- **Water**: LIDAR -- the survey's class 9, or silence (no return from the cell
  and most of the metre round it), or very dark to the laser on level ground,
  in patches of 60 m² and more that are thick (not roads) and partly silent,
  never running to the survey's edge. Picture -- darker than the fairway and
  far less green (NDVI where there is near-infrared), in patches, refused
  where the LIDAR has a bright return.
- **Sand**, within 70 m of a hole's line: LIDAR -- rougher than mown turf at a
  metre's scale (raked sand and the lip), a little darker to the laser than
  the fairway, low, where the laser reached, and not plainly turf in a
  picture if there is one. Picture -- much brighter than the fairway and not
  green, refused where the LIDAR measures ground as smooth as a road or roof.
  Both in patches of 4-1,500 m², not longer than 60 m.
- **Greens and tees** grow from the player's marks over smooth pad; with a
  picture the colour finds the collar and the LIDAR only refuses what is
  plainly not a pad. **Fairways** grow from the hole lines through the
  fairway's colour (nearer it than the rough's, the rough sampled 30-60 m off
  the lines); the LIDAR alone can only say "smooth open ground near the line".
  **Semi-rough** a 2 m collar.
- **What the first rules got wrong, measured** (Worthington, `--diagnose`
  inside OpenStreetMap's outlines): sand was guessed bright to the laser and
  is darker (0.69 against the fairway's 0.79: grass reflects the laser's
  infrared strongly) and rougher (2.5 cm against 0.7); water returns a fifth
  of the fairway's brightness; and in the August picture roads, car parks and
  dry rough were as pale as the sand -- a million cells called sand, 4,024 of
  them OpenStreetMap's bunkers. Patches, a length limit, the LIDAR's
  smoothness veto and the 70 m from a line took that to 2,281.

**Measured three ways** -- overlap with the truth (intersection over union),
per cent:

| | Green | Tee | Fairway | Sand | Water |
| --- | --- | --- | --- | --- | --- |
| Generated courses, LIDAR alone | 56 | 75 | 19 | 33 | 79 |
| Generated courses, picture alone | 99 | 95 | 79 | 54 | 99 |
| Generated courses, **LIDAR first** | **99** | **97** | **79** | **43** | **98** |
| Worthington, LIDAR alone | 28 | 23 | 33 | 16 | 45 |
| Worthington, picture alone | 62 | 30 | 34 | 21 | 29 |
| Worthington, **LIDAR first** | **62** | **24** | **34** | **27** | **36** |

The generated courses (`tools/trace-bench.mjs`, every landscape, 9 holes) are
a fake survey and a fake picture of a course whose every surface is known;
Worthington is scored against OpenStreetMap's hand-drawn outlines (23 greens,
26 tees, 16 fairways, 20 bunkers, 8 water hazards and ponds), which are
themselves rough: a fairway drawn as a line down the middle, bunkers missing.
On Worthington the LIDAR-first rule beats either witness alone on sand and
gives the LIDAR's water (98% of the LIDAR's water cells inside a mapped pond);
on generated courses the LIDAR's sand calls lower the picture's (54 to 43) --
the fake survey's pale native grass is as rough and dark to the laser as its
sand. (It was 39 until the picture's patches kept the cells the LIDAR had
already called sand: left out, they broke its bunkers into pieces too small to
keep. Requiring the LIDAR's sand to lie 3 cm under its surroundings, as
Worthington's bunkers do, was tried and lowered it to 44 on four landscapes
from 50 -- the generated bunkers are shallow; not kept.) Looked at by eye
(`real-course.mjs --crop`), one of OpenStreetMap's bunkers by the clubhouse
greens is dark in the August picture -- shadow or wet sand -- and is not
found. **The study's
targets** (greens and bunkers 80%, fairways 70%, PLACED) are met on generated
courses for greens and fairways, not for sand, and not on Worthington. The
LIDAR alone cannot find a green's collar (it runs on into the approach) or a
fairway's edge -- what the picture is for. A trace takes 2-3 s.

### Stage 9 (31 October 2026): ready for the owner

- **The documents swept** for the builder: the player's guide (PLAYING.md,
  *Fairway Course Builder*: the three doors, door 2's six steps, where LIDAR
  can be had, the editor), the portable README's line for the second page,
  the distribution review (sizes, offline proof, what a built file carries and
  what it never does, what is owed before a release), REFERENCES (the data
  the builder was measured against), and the design's claims the build
  overturned, corrected where they stood (bright sand, proj4js, the
  classifier, paths and buildings).
- **Sizes**: the builder's page 1,374,433 bytes; the game's 14,846,858 against
  main's 14,820,197 built the same day (+0.18%), still one file.
- **Checks at the end**: `npm test` (1,291 pass, the real-LAZ test skipped
  without the owner's folder named); both fingerprints silent -- no
  generated course moved at any stage, so no generator or schema number was
  bumped (`BUILT_VERSION` was introduced at 1 and how the game reads a built
  file has not changed since); `npm run build`; every builder journey.
- **Not done here, and why**: the release zips were not made (they need the
  server programs built, and nothing is being released); the free-GPU rule in
  AGENTS.md stays until the merge, where it is removed with its pointers and
  TESTING.md's sentence, as it says.
- **Owed before a release carrying the builder** (TODO): the owner's play of
  both programs; the website's `RELEASE_SHA256.txt` check confirmed to read
  `Fairway.html`'s line by name; laz-perf's copyright line confirmed.

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
- LIDAR: 0.5 m cells to 2.25 km² of property, 1 m past it; the ground filter's
  windows (1-10 m) and thresholds (0.3 m, slope 0.3, cap 3 m); a tree is a
  canopy peak over 2 m within 2 m plus a tenth of its height, its crown out to
  where the canopy falls under half, its height the highest raw canopy within
  its window, peaks found on the canopy smoothed once (3 x 3).
- Door 2: the land's cell never finer than the survey's point spacing,
  rounded up to the half metre; a first look at the land from at most 4
  million points; filled ground relaxed 40 passes; a traced pond's level 15 cm
  under its lowest tenth of shore and its floor a metre under that; greens and
  tees averaged over 2.5 m and fairways over 1.5 m; par from length (to 250
  yards a three, to 470 a four); a tree a conifer when its crown is under a
  fifth of its height; with no trace a green a 12 m disc and a tee a 6 x 10 m
  pad.
- The trace: SURE 0.6 (a call at least this sure decides); the approach 15-45
  m short of the green as the fairway's yardstick; water a patch of 60 m², at
  least 2.5 m thick (area over edge), a fifth of it silent, darker than the
  fairway by 10 and its NDVI 0.45 under; silence a cell with no return and
  60% of the 1.5 m round it the same; sand within 70 m of a line, 4-1,500 m²,
  1.2 m thick, at most 60 m long, LIDAR rougher than 1.4 cm and 0.05 darker
  than the fairway, the picture 30 brighter and 0.08 less green (NDVI 0.25
  under), refused where the ground is smoother than 1 cm; a green grown to 24
  m and a tee to 9 m from its mark, the colour within 38 of the mark's, the
  LIDAR's smoothness and slope limits doubled when a picture decides the
  edge; the fairway within 70 m of a line, nearer its colour than 0.85 of the
  rough's distance; semi-rough a 2 m collar; a call under 0.45 left rough.

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
| 14-16 | `builder-smoke --only builder-door-2` | failed on the harness (it measured the hidden picture canvas), then twice on the tee shot (water traced everywhere: empty cells of a sparse survey, then the land past its edge, then the picture's water rule without near-infrared) |
| 17 | `builder-smoke --only builder-door-2` | passed (41 s) |
| 18 | `builder-smoke` (all five journeys) | passed |
| 19 | `builder-smoke --only builder-door-2-worthington` | passed (135 s) |
| 20 | `profile --only built --built-file` (Worthington's file from the page) | both cases; figures in stage 7 |
| 21 | `builder-smoke` (all six journeys, Worthington's included) | passed |

## Sources

- The study's sources, read 31 October 2026 (search results; to be read in
  full where a stage depends on them): laz-perf (https://github.com/hobuinc/laz-perf;
  Apache-2.0 per Alpine's package metadata, to confirm in its LICENSE); COPC
  (https://copc.io/); Esri's zLAS and LAS Optimizer
  (https://lidarmag.com/?p=6066) and rapidlasso's LASliberator
  (https://rapidlasso.de/new-lasliberator-frees-lidar-from-closed-format/);
  libE57Format, BSL-1.0 (https://dfsg-new-queue.debian.org/reviews/libe57format);
  geotiff.js, MIT (https://geotiffjs.github.io/) and proj4js, MIT, NTv2
  (https://github.com/proj4js/proj4js) -- both considered and not added
  (stage 6); another simulator's builders on a 2 m
  grid for green contours (https://www.linkscorner.org/phpBB/viewtopic.php?p=22916,
  a forum post: weak).
- USGS 3DEP 1 m DEM for the test course, USGS_1M_15_x28y484_MN_MissouriRiverBigSioux_2021_B21
  (https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/MN_MissouriRiverBigSioux_2021_B21/TIFF/USGS_1M_15_x28y484_MN_MissouriRiverBigSioux_2021_B21.tif,
  found through https://tnmaccess.nationalmap.gov/api/v1/products), EPSG 26915,
  LZW with the floating-point predictor. NAIP 2021 0.6 m, m_4309527_ne_15_060_20210821,
  from Microsoft's Planetary Computer (https://planetarycomputer.microsoft.com/api/stac/v1,
  collection naip; public domain). OpenStreetMap's golf features in the course
  box through the Overpass API (https://overpass-api.de; ODbL; local only, as a
  reference). All saved under bench/shots/lidar/ (ignored), none committed.
- Snyder, J. P. (1987), *Map Projections: A Working Manual*, USGS Professional
  Paper 1395, pp. 61-64: the UTM series in geo.js.
- The test course's LIDAR: USGS 3DEP, MN_MissouriRiverBigSioux_2021_B21,
  work unit MN_MORiverBigSioux_1_B21
  (https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/MN_MissouriRiverBigSioux_2021_B21/MN_MORiverBigSioux_1_B21).
- The real-courses study's sources (USGS 3DEP, the Environment Agency, NAIP,
  OpenStreetMap's golf tags and ODbL) are in RESEARCH.md once a stage uses
  them.
