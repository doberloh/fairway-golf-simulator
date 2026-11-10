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
| **Door 1: Generate and modify a course** | Any landscape, every studio setting (Architect too until it was removed, 2 November 2026); grow it as often as wanted, then *take it over*: the world is frozen into a course document and every tool works on it |
| **Door 2: Generate a real life course** | LIDAR of a real place (every open form) and an aerial picture; the property chosen; tees and greens marked by hand; an auto trace that tries the LIDAR first and falls back on the picture; any landscape for the look |
| **Door 3: Open a course file** | A built file continues in the editor; a seeded file opens in door 1 with its settings filled in |
| **The editor** | Real-time ground shaping, surface paint and outlines, holes, water, trees, checks, a test round, save |
| **The game** | Plays a course from a seed (as today) **or from a built file**; places pins itself at the start of each round on a built course; marks such a course "built" or "real land" |

**Nothing here changes a generated course.** Generation,
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
| `trees.bin` | every tree a ball can hit: x, z, height, crown, trunk, role | 24 bytes a tree. The landscape picks the species drawn, in its planting shares among those of the tree's height; the sizes are stored, so a tree plays the same in every landscape |

**The builder's section** (the owner, 5 November 2026: "The game doesn't need to
load all of that, but when reopening a builder file, we need to have
everything"). A course saved from the editor after door 2 ends with one more
part, `builder.zip`: a whole door 2 draft (draft.js, version 3), stored, as if
Back to 2D had just been pressed (round-trip.js `withEditorWork`). It holds
everything a course alone loses: the survey's grids (canopy, brightness, water,
buildings, returns), every surveyed tree, the trace's exact layers and hidden
ones, the boundary and the property box, the survey's names and map grid, the
place searched for, the choices made, OpenStreetMap's download as it came with
its trees and the course picked (the features, the Course picker, the boundary
and the holes are made again from it), and the pictures. **Back to 2D on a file
that has one opens that session**, not the stand-in `draft-from-doc.js` makes.
Nothing the ball touches is in it, so no version number moved.

- **The game never unpacks it** (`readBuiltFile` turns the part down by name;
  a broken section does not stop a course loading) **and does not keep it**
  (built-store.js `playableFile`). Written last, so the file without it is byte
  for byte the file that never had one: same hash, same course, same challenge.
  The 64 MB limit is on what is kept; the file itself may run to a gigabyte.
- **Pictures** go as JPEG at quality .9 (PLACED), the plain pixels if too big
  for a canvas, with `place` for how each sits on the land: tiles, a map
  position, or the hand-matched pairs (picture-file.js). Encoded once.
- **Save a copy to share** writes the course alone.
- **Decided, with what was turned down.** A second file kind for the builder's
  work: the owner asked for it in the `.fairway`, and one file cannot be lost
  from its pair. Google's and Bing's pictures left out of saved files: the
  owner's call was to keep them, with the sharing copy leaving them out; the
  provider's terms are said where the key is asked for. The LIDAR files
  themselves: gigabytes, and the land built from them is kept; door 2 keeps
  their names. Undo history: not kept. OpenStreetMap's parsed features rather
  than its download: the download can be read again when the parser learns
  something. Image-service keys never go in any file.
- **A file from before this** has no section. `draft-from-doc.js` gives it back
  what it does hold: its map grid and middle (`source`), so fetching pictures
  and OpenStreetMap work, and its trees, which fetching the map used to replace.
  Its survey's unit was not stored, so it is read as metres: right for UTM,
  wrong for a State Plane survey in feet (TODO). New files store the whole
  `crs` and the place searched for in `source`.
- **Bug this closed:** on a draft reopened with OpenStreetMap's data, the Trees
  choice had nothing behind it, and "OpenStreetMap's only" emptied the course of
  trees. A version 2 draft now hides the choice.

**The trees placed for you** (`treePlan`, the owner, 5 November 2026: turn "LIDAR
height and width mapping" off, and "select what trees are automatically placed").
An optional field of the course, set live in both editors (builder/tree-plan.js):
`sizes: 'landscape'` keeps each tree's place and gives it the size of its species
(built-world.js `treeAt`, hashed from where it stands; PLACED: the species' range
in the generator, the crown from its table, the trunk at 0.027 of the height), and
`species` is the list of the landscape's trees to use, in their shares. What the
survey stored is not touched, so both can be undone at any time. It changes what is
drawn and what a ball hits, from the file's own field, so no `BUILT_VERSION`; a
course with no plan has no field and keeps its bytes. **Left alone:** a tree with a
species of its own, one placed or sized by hand (role +32), and bushes. A course
grown by the generator stores every tree's species, so the plan does nothing to its
trees until they lose it. The whole-course size slider does not reach trees sized
by the landscape. With sizes off the height rule (`speciesFor`) has no height to
fit, so the shares alone decide.

**Limits a file is checked against** (PLACED; `LIMITS` in course-doc.js): 16
million land samples (a 3 x 3 km property at 1 m is 9 million), 4 million in
patches, 200 thousand trees, 2 million outline points, 9 or 18 holes. A file
over them, damaged, or from a newer Fairway is refused in plain words.

**The same course makes the same bytes** (a fixed date in every ZIP entry), so
a built course's identity is its file's hash -- the friend's challenge check
and the game's cache key.

**`BUILT_VERSION`** (settings-schema.js) is how the game turns a built
document into a world. A built course never runs the generator, so
`GENERATOR_VERSION` cannot move it (nor could `ARCHITECT_VERSION`, retired with Architect); `BUILT_VERSION`
can, and is bumped with a line whenever a built course's ground, lie or trees
would change for an unchanged file. **2** since 1 November 2026: each green on
its own (built-world.js `greenParts`) -- a file stores all its greens as one set
of outlines, and every hole took the whole set as its green, so cups were cut
wherever the search reached (Worthington's hole 3 on the practice green).

## The game: a world from a file

The single biggest piece (stage 1). `worldFromDoc(doc)` returns the same world
object `generateWorld` does, from stored data: height from a sampler over the
land and patches through the same ground mesh, so the ball and the picture
agree; surfaces from a baked field the shader and `surface()` both read (and
since 8 November 2026 the green's and the tee's mowing read their edges from it
too: ground.js `greenD=dGreen`, `teeBuilt`); holes
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
green shaping by recipe (the generator's own), checks with fly-to, a test round
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
shown); UTM, degrees, and any Lambert conformal conic or transverse Mercator
grid described in the file (every US State Plane zone, since 1 November 2026)
converted by Fairway itself, any other map grid lined up by matching points
(proj4js was not added: stage 6).

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
outlines, greens and bunkers by the generator's recipes; the builder and the
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
2026 for another simulator, **never committed or shipped**, nor any built
copy of the course (tests that need it skip when it is absent). Read in place
until 1 November 2026; since then a copy is in the git-ignored
`bench/lidar/worthington/` at the owner's request (amendment 13), found by
tools/lidar-home.mjs `worthingtonDir` (`FAIRWAY_LIDAR_TEST` still overrides):

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
4. **Up to fifty iterations on the auto trace's detection of course
   features from the picture, then up to fifty from the LIDAR** (first asked
   as ten, the picture first; the owner raised it to fifty each later the
   same night), on real courses from
   different parts of the world matching Fairway's landscapes, Haunted Hollow
   aside -- and **no jagged or pock-marked edges** on what is drawn.

5. **Google and Bing imagery for the picture**, searched for by place,
   **sized automatically** onto the land and **dragged into line by hand**
   where needed (the owner, later the same day). Both need the player's own
   key and both limit tracing in their terms; the builder goes online only
   when the player asks for imagery -- an exception to "no network in either
   page" that the owner's request makes, kept to that one button.
   **Then: until the trace matches OpenStreetMap, with no limit on the
   iterations** (the owner, 1 November 2026: "iterate till we match open
   street map to a percentage across the biomes ... no iteration limit. Set
   the percentage to 90% and let's start there"), for the picture and the
   LIDAR alike: **90% overlap with OpenStreetMap across the landscapes**, with
   no specks, pocks or jagged edges. OpenStreetMap's outlines are hand-drawn
   and sometimes missing (TPC Scottsdale maps 9 fairways in 60 ha of rough),
   so beside the overlap the bench reports how much of what OpenStreetMap
   maps is found and how much of what is drawn is mapped -- which says
   whether a shortfall is the trace's or the map's.
9. **OpenStreetMap first** (the owner, 1 November 2026: "reverse the order.
   Pull in the open maps tracing first. Give the user the option to keep it.
   Or use it as a starting point to build LIDAR or Image traces"): door 2's
   trace step fetches the course's golf features from OpenStreetMap (at the
   player's press; ODbL, credited in the course) as layers, with its numbered
   holes as markers; the player keeps it, or refines it -- the self-taught
   classifier learning from OpenStreetMap's outlines instead of the rules,
   from the picture or the LIDAR. Moved from IDEAS.md, where OpenStreetMap
   import waited.
10. **After testing, a list** (the owner, 1 November 2026): OpenStreetMap
    then fit to the LIDAR as the best path, shored up; clearer instructions
    for Google's imagery; a **course boundary**, outside it forest and the
    like fading into the outskirts as a generated course's do; the
    **landscape chosen in the trace step** and every surface it allows in
    the list (rough among them); **extrapolate** any layer outward (semi
    round fairways, fringe round greens); **every layer shown in a sensible
    drawing order**, empty ones marked; **instructions top-middle** that
    stay while a tool is in use; a **house zone**; a clear **erase brush**;
    and **finer tracing** -- the tracer's cells looked pixellated.

    **Built (1 November 2026), not yet played by a person**, in order of the
    list: the landscape chosen in the trace step, its ground types offered
    (`layersFor`, layers.js) -- rough was missing because it is no layer,
    the bottom of the stack, and is now listed last; every offered layer
    listed in the game's order with its area or *empty*; **Extrapolate**
    (trace-edit.js `extrapolate`); a **banner** top middle naming what the
    tool does; the brushes named **Paint brush**, **Erase brush**, **Erase
    all layers**; **Google's key instructions** under the key box and Bing's
    state (no new keys since 30 June 2025); a **course boundary** drawn or
    taken from OpenStreetMap's `leisure=golf_course`, and **Fill outside
    it** (trace-edit.js `fillOutside`); **houses** -- a House tool, a House
    zone, OpenStreetMap's buildings as houses (osm.js `homeOfFootprint`),
    stored in the course file (`homes`) and stood by the game
    (built-world.js `builtHomes`); and the **smooth view**. OpenStreetMap
    then fit to the LIDAR, shored up the same day: lined up by its bunkers', ponds' and
    greens' edges, its shapes kept; every damaged test map came back within half
    a metre, and OpenStreetMap itself turned out to lie 1-3 m off most real
    places (RESEARCH, *OpenStreetMap is itself off the place*). The door says
    Refine with the LIDAR is the recommended path.

    Decided, with what was turned down:
    - **Finer tracing: the outlines drawn, not a finer grid.** The game never
      saw the cells: each layer goes into the course as smoothed outlines
      (since 1 November 2026 relaxed eight passes, simplified to a tenth of
      a cell, one pass of corner cutting; until then simplified to 0.6 of a
      cell, two passes), so the tracer now draws exactly those (`layerRings`, real-course.js). A grid
      four times finer would have cost sixteen times the memory and every
      brush stroke's time on a 3 km property, and still shown steps.
    - **A green's fringe is not an extrapolated layer**: the game already
      mows a collar round every green (the course's fringe width). There is
      no fringe layer to paint, and adding one would draw two fringes.
    - **Outside the boundary, the survey's trees stay.** They are real; the
      wood is added only where none stands. Wiping them would have thinned a
      boundary that is already a wood.
    - **Houses are footprints; the game builds them.** A file stores where a
      house stands, which way it faces and its size; its form, roof, porch
      and garden come from a hash of where it stands, as the generator draws
      its own. A file without houses plays exactly as before, so
      `BUILT_VERSION` did not move.
    - **The landscape filters the list, not the course.** A built course
      takes any ground type in any landscape; a layer already holding
      something stays listed, marked *not this landscape's*.
7. **Layers** (the owner, 1 November 2026): "the concept of layers so things
   can be easily painted in the trace step" -- each surface its own layer, so
   painting one never wipes another -- "exposed in the editor as well in real
   time".
8. **The whole painted course seen before the editor** (the owner): door 2's
   sixth step, *Review*.
6. **Research free imagery to use beside Google** (the owner): findings in
   RESEARCH.md, *Free aerial imagery for the builder*; the open services found
   are offered in the builder where they cover the land, with no key.

11. **The LIDAR and the picture together, and the picture locked** (the
    owner, 1 November 2026: "display the lidar data along with the
    satellite data with different opacities, then we need to be able to drag
    the satellite picture to align and lock/unlock it"). **Built the same
    day, not yet played by a person**: the trace step's **Viewing** -- the
    LIDAR as shaded relief, the laser's brightness or slope
    (real-course.js `lidarTexels`), an opacity each for the LIDAR, the
    picture and the trace, and either of the first two on top (plan-view.js
    `setAlpha`, `setOrder`); the picture **locked** until **Unlock the
    picture**, then dragged or nudged with the arrow keys (a quarter metre,
    a metre with Shift), and locked again by **Lock the picture** or any
    other tool. Decided: *unlocked only while the Align tool is held* --
    a separate lock beside the tool would let a brush stroke drag the
    picture, which is what a lock is for; *slope as edges* -- the line-up
    (trace.js `lineUp`) finds OpenStreetMap's offset from slope, so the
    player sees the edges the machine reads; the slope runs dark (flat) to
    white at 25%, PLACED.
12. **Move one shape** (the owner, 1 November 2026: "also need the ability
    to move individual shapes, not sure if we have that"). There was none --
    not in the trace step, nor in the editor, whose Move moves the view.
    **Built in the trace step the same day, not yet played by a person**:
    **Move shape** (trace-edit.js `pickAt`, `move`) picks up a house or tree
    under the pointer, else one layer's patch -- the chosen layer's where it
    covers the point, else the topmost shown -- and puts it down where the
    pointer is let go, by whole cells, one undo step, drawn in outline
    while dragged. The editor has the same tool since that night. Decided: *a patch is all of a layer that touches* --
    a semi sheet drawn round three fairways moves as one; splitting it is
    the erase brush's job. *By whole cells*, so the move never resamples a
    shape's edge. Moving one in the editor and turning one (door 2 and the editor) were
    built the same night.

13. **A list after testing, 1 November 2026** (the owner):
    - **The LIDAR in the repository, not committed**: the test courses'
      tiles for each landscape and Worthington's, and the many other surveys
      in the owner's Downloads (and Documents) identified by course and
      moved in. Home: `bench/lidar/<course>/`, git-ignored. (This replaces
      "Worthington read in place": the owner asked for a copy here. It is
      still never committed or shipped.)
    - **Save from any point in the builder**; once saved, one click saves
      again to the same file; a new file only when the course is renamed.
    - **Search for LIDAR before door 2's first step**, using every source
      known, and **download it in the builder** (online only when pressed,
      as the imagery and OpenStreetMap are).
    - **Fetched imagery kept** (Google, Bing, USGS and the rest) when the
      player changes modes, rather than fetched again.
    - **WASD flying in the builder's 3D view**, and **the 3D view given the
      trace's resolution treatment** -- surfaces drawn as the smoothed
      outlines the course will have, not cells.
    Found on the way: **State Plane surveys could not be placed.** The
    owner's Washington surveys are NAD83(HARN) / Washington South in US feet
    (EPSG 2927), and the builder worked only UTM and degrees -- so imagery,
    OpenStreetMap and the LIDAR search could not find where they are. Fixed
    the same day: geo.js `projectionOf` works Lambert conformal conic and
    transverse Mercator grids from the file's own WKT (every US State Plane
    zone, the British grid and the like), checked against IOGP Guidance Note
    7-2's worked examples to 2 cm (tests/lidar-geo.test.mjs).

14. **Rockyweb, and every state's survey** (the owner, 1 November 2026:
    "figure out how to gain access to rockyweb for LIDAR. there has to be a
    way. And add sources for each states survey as well. Washington has one,
    i bet other states do too"). Rockyweb.usgs.gov -- where the National
    Map's LAZ tiles are -- answers a page's request with the file but no
    `Access-Control-Allow-Origin`, and refuses the browser's preflight (405),
    so a page cannot read it (checked 1 November 2026). Two ways round it,
    both legitimate: **the browser downloads the tiles as files** (a
    download is no cross-origin read) and the builder reads them from the
    player's LIDAR folder (showDirectoryPicker, Chrome and Edge; elsewhere
    the player brings the files -- first a separate "downloads folder",
    which amendment 15 made the one LIDAR folder); and **Fairway's own bridge**
    (the local program a launch monitor talks to) fetching them for the page.
    And a source for each state with its own LIDAR programme, linked from
    door 2's search where it covers the place.

    **Built that night (13 and 14), not yet played by a person:** the LIDAR
    in `bench/lidar/<course>/` (Worthington copied; Battle Creek, Salish
    Cliffs and Snohomish moved from the owner's Downloads, identified by
    their own positions; the test courses' tiles as tools/lidar-fetch.mjs
    brings them); **Save** in the top bar on every screen and Ctrl+S
    (saving.js), door 2's **drafts** (draft.js), **Save again** to the same
    file, a new file on a new name; **every picture kept** with its own
    lining up and **Showing** to switch, and a session's imagery reused;
    **WASD** in the editor and its surfaces drawn from the smoothed outlines
    (the editor saves those too now); **Find LIDAR** (lidar-search.js): USGS
    3DEP's square from its Entwine copy (measured against the owner's
    Worthington tiles: the same ground to 0.1 cm), IGN LiDAR HD's tiles,
    rockyweb's whole tiles through **the bridge's `/lidar`** or **the
    browser's own downloads** (read from the LIDAR folder since amendment
    15), **36 state portals** and the national agencies as
    links; **State Plane** placed. RESEARCH, *Finding LIDAR from the
    builder*. Decided, with what was turned down:
    - **A draft is its own file kind** (`.fairway-draft`), not a course file
      with extras: a half-traced course has no holes to validate, and the
      game would refuse it in words that do not say why.
    - **Door 2 saves a draft at every step, the playable course from the
      editor**: a draft opens back where it was; a course file opens in the
      editor. Saving a course at the review step was turned down -- reopening
      it would lose the trace step's layers' history and the pictures' lining
      up. (Since 5 November 2026 a course saved from the editor carries the
      whole draft: *Course files*, *The builder's section*.)
    - **The rockyweb downloads are spaced 4 s apart** and read from a folder
      the player picks (the LIDAR folder, amendment 15), because the
      browser, not the page, saves them; a
      proxy on the internet was not considered (it would see every player's
      requests).
    - **USGS's Entwine copy rather than the Planetary Computer's COPC**: both
      answer a page, but at Worthington only Entwine had the newest survey,
      and Entwine downloads only the square.

15. **Downloads kept, finding made clearer, trees and the boundary as the
    player chooses** (the owner, 1 November 2026, after building Nile Shrine
    in the builder):
    - "when downloading LIDAR files into the browser. Are those files
      saved?, make sure that they go somewhere local always. We don't want
      the user needing to re download the files. Maybe we just only allow
      downloading to the downloads folder? what do you think?" -- **They were
      not**: a square or tile downloaded in the page lived only in the page,
      and a draft keeps the land, not the LIDAR. Now **every download is
      written to the player's LIDAR folder** (lidar-folder.js), one folder
      picked once (Downloads suggested) and remembered by the browser, and
      **read from there instead of downloaded again** by the same name
      (lidar-search.js `kept`); a USGS square is kept as a ZIP of its
      Entwine pieces with the square written in it (`squareName`,
      `eptZipSource`). Where the browser cannot pick a folder (Firefox,
      Safari), each download is saved the browser's way, into its download
      folder. **Downloads-only was not chosen as the rule**: a page cannot
      write into the download folder except by a download, cannot tell
      whether a picked folder is it, and a player who keeps LIDAR elsewhere
      (the owner's own `fairway-courses` folder) would be refused; so the
      folder is the player's, and Downloads the suggestion -- the folder
      that makes rockyweb's and the portals' files arrive by themselves.
    - "for other sources like WA DNR, can we link directly to the
      downloads or does the user really need to do manual work?" --
      **Partly.** Washington's portal answers what covers a box only to its
      own page (`POST /query`, no Access-Control-Allow-Origin), and its
      download link (`download?geojson=<box>&ids=<datasets>`, a ZIP made to
      order) answers 403 unless the browser carries the pass the portal's
      page hands it (a `dlgate` cookie, two hours) -- checked 1 November
      2026: in a browser that had opened the portal the link gave
      `custom_download.zip` at once; without the cookie, 403. So the builder
      cannot make that link itself, but it **opens the portal on the course**
      (its address takes `#lat:lon:zoom`), leaving three clicks there (a
      box, the newest Point Cloud, Download), and **reads the ZIP the portal
      gives** from the LIDAR folder. Not built, and possible: Fairway's
      bridge asking the portal's `/query` for the page, which would let the
      builder list Washington's surveys itself and give the download link
      (the browser still fetching it, with the portal's pass): in IDEAS.md. The other 35
      portals are links to their own pages; whether each takes a place in
      its address was not checked one by one.
    - "change the text 'download its whole tiles' to 'download all tiles'"
      -- done.
    - "can we add on hover tooltips for buttons?" -- every button in the
      builder has one: from tips.js by its tool or its label when made
      without its own (builder.js `el`), the editor's tools from their
      hints, and a test that every fixed label has one
      (tests/builder-tips.test.mjs).
    - "When searching a course and showing results. Make it clear the
      results can be clicked." -- each place found is a button with "Use ›"
      under a line saying to click one (door 2's Find LIDAR and the trace
      step's place search).
    - "I tried to build the nile shrine golf course ... when i started
      building the course i had tree data, but then after i imported open
      street maps i lost the trees. We need to give the user options for
      tree data to be merged with OSM." -- **The cause**: door 2 kept the
      LIDAR's trees only where OpenStreetMap had no tree or wood of its own;
      one mapped tree dropped every surveyed one. Now a **Trees** choice
      beside OpenStreetMap: the LIDAR's with OpenStreetMap's added where no
      LIDAR tree stands within 6 m (the default, PLACED), the LIDAR's only,
      or OpenStreetMap's only (osm.js `mergeTrees`, one undo step).
      Measured on Nile Shrine: RESEARCH, *Whose trees*.
    - "Nile shrine LIDAR is here ... Please bring this folder into our
      untracked LIDAR folder." -- moved to bench/lidar/nile-shrine (four
      rockyweb tiles of USGS WA_KingCounty_2021_B21, State Plane Washington
      North, US feet).
    - "When loading LIDAR files in step 1. Show the coverage of the files in
      highlighted yellow." -- every cell within 10 m of one a point or height
      landed in (PLACED; real-course.js `coverage`), yellow over the relief
      at step 1, each file's box outlined yellow with its name; the property
      box is white now, so yellow means the files.
    - "When filling outside the course boundaries, give the option to remove
      OSM data or keep it." -- **Remove what is there** (the default, as
      before, and now the houses outside too) or **Keep what is there**: the
      surfaces and houses outside stay, the landscape's floor goes only on
      bare ground, and no tree is planted on a surface or a house
      (trace-edit.js `fillOutside` `keep`).
    - "builder needs to tell the user to put the files in the folder once
      they are done downloading." -- a portal opened from the search, and
      rockyweb's tiles, both say so: put the files (a ZIP is fine; the
      builder unpacks it) in the LIDAR folder, then **Load from the folder**,
      which lists the folder's LIDAR files and ticks those over the place
      searched for. Rockyweb's tiles are read as each arrives when the
      LIDAR folder is Downloads.
    **Built that day, not yet played by a person**; the builder-lidar-folder
    journey drives the folder with a stand-in (a script cannot answer the
    folder dialog), so Chrome's own folder dialog, its leave-to-use prompt on
    a later visit, and the folder remembered between visits are for the
    owner to see.

16. **The owner's second list that day** (1 November 2026, after trying
    door 2 and the editor):
    - "the trees dropdown trails off the edge of the menu" -- it sat in a
      two-column row; now on its own line, and no select or field in the
      steps is wider than the column.
    - "we need to add 're do' ctrl+shift+z" -- door 2 took Ctrl+Shift+Z as
      Undo (it only checked Z); it redoes now, as in the editor.
    - "when there is more than a single aim point, what does that do in
      game?" -- answered from the code (built-world.js `builtLine`): the
      hole's line runs from the back tee through every aim point in turn to
      the green, so two make a double dogleg; the yards are measured along
      it, the computer golfers and the tee shot aim along it, and a point no
      farther down the hole than the one before (or within a metre of the
      green) is skipped. The holes step now says so, and names a hole whose
      aim point the game would skip.
    - "We need to add a scorecard section to the 'holes' step", then "let
      the user set the par. per hole and edit the card (not yardage tho)" --
      the **Scorecard**: par and handicap index set per hole (or worked out:
      par from the blue yards, the index down the card), and the blue, white
      and red yards as the game measures them, not editable; Out, In and
      Total. The editor's **Par +** became a par select.
    - "window needs to properly resize when its moved or changed" -- both
      views followed size changes already; a window moved to a screen of
      another pixel density changes no size, so neither heard of it. They
      watch the density too now (builder.js `onWindowChange`). Found on the way, by the journey's screenshot: coming back from the 3D editor, door 2's plan canvas kept a stale pixel size that the layout let set its height, pushing the zoom bar and the notes below the window; the canvas now takes its height from its box, never the other way (builder.css), and the journey checks the bar is inside the window.
    - Fill outside, removing: "We should also remove trees that had been
      placed from the LIDAR. Remove EVERYTHING outside the course boundary
      before filling" -- every surface, house and tree outside comes off
      first, the survey's trees too.
    - "When in the 3d editor. Only allow the user to paint or place ground
      and objects from that biome" -- the editor's Paint and Outline offer
      the landscape's own layers (layers.js `layersFor`, as door 2 does);
      trees planted are the landscape's own species (kind -1); another
      landscape picked, the tools change.
    - "the 3d editor needs to look like the biome you are editing as well.
      Everything looks like just pine trees right now" -- the editor's sky
      and its trees are the landscape's: a shape for the species the game
      draws at that tree (`drawnSpecies`, tree-shape.js; until 5 November
      2026 one shape for the whole landscape, its `treeKind`, so Desert
      Palms showed no palm) in its tree colour, each tree its own shade, on a
      trunk (view.js). Stand-ins still: the game draws the real models.
    - "add a button to go back to the 2d editor from the 3d editor" --
      **Back to 2D**, when the course came from door 2: door 2 shown again
      as it was left, at the review. First decided that what was changed in
      3D was not carried back, so it asked first; the owner then asked for
      both directions the same day, and since then the work goes with it
      (below, *Back and forth*) and it asks nothing.
    - "close needs a double confirm if its going to fully close the project
      in the builder" -- Close asks twice, the second time saying what is
      unsaved; door 2's Back to the start asks twice once there is work.
    - "when importing a course. The yardage seems off. I think we might need
      to change things in the builder to make that import correctly?" --
      **Measured, not a loss in the import**: on the Worthington file the
      game's blue yards equal the builder's line to within a yard on every
      hole (the same routine now: builtLine). What makes it look off: (1)
      **players start on the white tees**, which are the builder's *middle*
      tees -- Worthington's hole 1 plays 287 from white, 337 from blue; (2)
      **a hole marked straight measures straight**, where a club's card
      measures round its doglegs (Worthington: 22 yards short at the median
      without bends); (3) **par was worked from the straight line** -- now
      from the yards along the line. The scorecard shows all three tees as
      the game will play them, so it no longer surprises after import.
    - "we need to make sure that we don't have trees encroaching massively
      over greens and tees. Lets add a function to 'clear trees from tees
      and greens' that will resize tree shapes" -- in door 2's trace tools
      and the editor (tree-clear.js): a crown over a green or tee drawn in to
      stop 1.5 m short of it (PLACED), a tree left with under 1.2 m of crown
      (PLACED) or standing on it taken out; one undo.
    - "In the editor, allow the user to adjust the tree height scale. show
      in real time" -- **Tree height**, 0.5 to 2 times, every tree redrawn as
      it is dragged; saved into the trees' heights, crowns and trunks when
      the course is saved (editing.js `treeScale`). At first only the height
      and trunk grew, so a 2x tree was as wide as before; asked "would tree
      height adjustments also change the tree diameter?", the owner chose
      the crown's width growing with the height (one slider, the whole tree
      in proportion) over a second slider for width. The crown's width is
      what a ball meets, so a bigger scale is also more tree to play
      around. Clear trees from tees and greens measures at the scale, so the
      crowns saved stop short of the green; raising the scale after clearing
      can reach over it again.
    - "let me be able to set scale per tree in the editor as well" --
      **Size a tree**: click a tree (the one whose crown holds the point)
      and **This tree**, 0.25 to 3 times (PLACED, the whole scale's bounds
      widened), sizes it from what it was when picked -- height, crown and
      trunk together, written into that tree's record, with Tree height
      still applied on top when saved. The picked tree is ringed; a drag is
      one Undo; Undo, Redo, Clear trees from tees and greens or another tool
      lets it go (editing.js `treeAt`, `sizeTree`). One tree at a time, not
      a brush: a brush of sizes was not asked for.
    - "the edges of things are also extremely blurry in the 3d editor" and
      "the traces i see in the 2d editor dont match the crispness of the
      edges in the 3d editor" -- nothing had changed: the editor drew every
      surface into one picture of the whole course, which on the owner's
      Worthington file is a third of a metre a texel (12 million texels,
      view.js `SMOOTH_TEXELS`), so close up each texel is a soft block and
      an edge a soft staircase, where door 2's plan draws the outlines at
      the screen's own pixels. Fixed with **a close-up sheet** (view.js
      `closeUp`): the same outlines drawn again into 2048 texels a side over
      a square round where the camera looks, its side twice the camera's
      distance, 30 to 300 m (1.5 to 15 cm a texel), faded into the course's
      picture at its edge, redrawn once the camera keeps still for 150 ms
      (all PLACED). Rejected: a finer whole-course picture (four texels a
      cell on an eighteen is 80 million texels, about 330 MB on the card,
      too much for the machines Low is for), and outlines as draped meshes
      (they would have to follow every hill). Measured on that file: the
      redraw takes 1 ms at a 30 m square, 5 ms at 93 m, 35 ms at 300 m; an
      800 m square took 270 ms for texels no finer than the course's, hence
      the 300 m cap. 21 MB more on the card with its mipmaps.
      `tools/builder-look.mjs <file>` photographs a hole's green from a few
      heights and prints the square and its time.
    - Found on the way: **"null" beside Close** in the top bar when a course
      file was opened from the start page (a left-out Back to 2D button
      written as text); builder.js `topTools` drops it.
    - "some sort of issue with meshes lining up properly in the 3d editor"
      (a screenshot: a green's edge doubled, a soft strip beside a sharp
      one) -- the land itself had no step there (measured across hole 1's
      green on the owner's file: a centimetre a quarter metre at most). The
      whole-course picture was mapped onto the ground as a share of the
      editor's width, but the grid is a whole number of cells and the
      picture a whole number of texels, neither quite that width: its edges
      sat up to half a metre off the close-up's. Mapped texel for texel now
      (view.js). The dark ring the screenshot also shows round that green is
      the trace's own: a metre of fairway collar.
    - "some sort of edge smoothing issue ... This kind of thing is all
      over" -- notches along every edge: `layerRings` simplified the
      traced staircase away (0.6 of a cell) and then rounded it, and a stair
      corner simplifying kept turned into a notch. It now relaxes the
      staircase first (each point to its neighbours, eight passes),
      simplifies to a tenth of a cell and rounds once (all PLACED). Measured
      on shapes rasterised at half a metre: a 12 m circle 29 cm off with an
      18-degree notch before, 16 cm and none after; an ellipse 25 cm and 31
      degrees, 15 cm and 4.5; a band 12 cm and 11 degrees, 7 cm and 2. One
      routine, so the trace step, the editor and a saved course all change
      together; a file already saved plays as before (`BUILT_VERSION`
      unchanged, nothing the game reads moved).
    - The close-up square is now centred halfway between the ground under
      the camera and what it looks at, its side 2.2 times the camera's
      distance: centred on the target, the ground just below the camera
      -- the biggest on the screen -- sat at the square's fading edge.
    - "Do the work to allow the user to go back and forth between 2d and 3d
      work. while keeping changes made in both directions" -- **Back and
      forth** (round-trip.js `fromEditor`, door-real.js `remount`). Back
      to 2D brings home, against the course as the editor opened it: each
      layer the editor changed (its outlines filled onto the trace's grid;
      a layer it did not touch stays exactly as traced, since filling
      outlines back smooths a little each time); the shaping, as a height
      difference on the land's own grid (`st.landEdits`, added after the
      survey is smoothed and before ponds are carved, so a hill raised in
      3D stays where it was raised when a green is moved in 2D); the holes
      (tees, aim points, greens; a par or index set in 3D stays set, one it
      did not touch stays worked out); the trees, Tree height baked in,
      with those the editor planted, moved or sized marked `kept` so the
      course keeps them wherever they stand (the others meet door 2's rule
      again: none on turf, sand or water); houses; creeks, which door 2
      cannot draw and carries through to the course; the name and the
      landscape. Hidden layers come back hidden. A draft keeps the shaping
      and creeks (draft version 2); building the land anew from the LIDAR
      drops them, as they belong to that land. Not carried: a pond's level
      set in 3D (worked out again from its shore) and land detail finer
      than the land's grid (door 2's courses have no finer patches).
      Measured in tests/round-trip.test.mjs and the builder-door-2 journey
      (sand painted and a hill raised in 3D, back in the trace, both there
      when the editor opens again); not played by a person.
    **Built that day, not yet played by a person** (the journeys drive each:
    builder-door-2, builder-door-2-osm, builder-lidar-folder, builder-tools).
17. **Every course in the LIDAR folder, built** (the owner, 1 November 2026:
    "build me a working version of every course in the LiDAR folder ...
    also build Druids glen golf course in Washington state ... think about
    the flow that the user will take building a course from start to finish
    and clean up any inconsistency in the builder as well as the main sim
    ... Prefer open street map tracing with LiDAR cleanup ... Make sure that
    open street maps holes actually line up with the holes on the real
    courses"). **`tools/build-courses.mjs`** builds each course as door 2
    does, with door 2's own modules: the course's boundary from
    OpenStreetMap, the land from its survey (3DEP's Entwine copy fetched
    where the folder has none: Druids Glen), the map laid as layers,
    refined with the LIDAR, the holes picked, moved and fitted, the trees
    merged, the course made, read back as the game reads it, and played by
    the virtual golfers. The courses, their map answers, a plan picture each
    and a report go to the git-ignored `bench/courses/<course>/`;
    **`tools/play-built.mjs`** opens each in the built game and plays a tee
    shot. What building them found and changed:
    - **OpenStreetMap's holes did not line up** in four ways, all fixed in
      a new module, `osm-course.js`, which door 2 and the tool share:
      refining moved the map by a shift (up to 6.5 m: Northwood) and left
      its holes where they were (`shiftHoles`); a club's second course
      overwrote the first's hole numbers (`osmCourses`, door 2's new
      **Course** choice); the map's par was read and thrown away; and every
      hole had one tee, the line's first point. **`fitHoles`** now puts each
      green mark on the green it reaches and gives each hole the tee boxes
      along its line -- back, middle, front -- so white and red are real
      tees. Door 2's holes step has **Fit holes to the trace** for holes
      marked by hand or after an auto trace.
    - **A map with numbered greens and no hole lines** (Worthington's): each
      green's tee is chosen for all holes at once (the Hungarian method,
      `assign`) by the walk from the green before, the share of the line
      over mown ground and under trees, the far end of the hole's fairway,
      and a scorecard when there is one (`card.json` beside the course, or
      `osmHoles({card})`). Against Worthington's card: 11 of 18 holes within
      10% with the card, 9 without; the rest are holes whose tee the map
      never drew. RESEARCH, *OpenStreetMap's holes on the ground*.
    - **Holes that line up**: checked against the real Stadium Course,
      TPC Scottsdale's 15th to 18th were built at 551, 161, 329 and 443
      yards (the card: 553, 163, 332, 442), the course 7,251 yards par 71
      (7,261, par 71).
    - **Greens a putt can hold**: Arcadia Bluffs' greens kept ridges of up
      to 17% inside them, and the golfers took 40 and 45 strokes on two;
      `docFromLand` now averages a green over 5 m, eased into the ground
      round it over 3 m (RESEARCH, *Greens a putt can hold*). 167 strokes
      against par 72 before, 87 after.
    - **The test round laid up** (test-round.js): its golfer is the same
      golfer every shot, so a drive into a pond replayed from the tee went
      into it again -- Battle Creek's 13th and 14th, 40 strokes each. After
      a second penalty from one spot it changes the shot: more club, aimed
      12% past the flag, when it went for the green and fell short; else a
      lay-up at 70% of the way; one step more each penalty after (PLACED).
      Battle Creek 183 strokes before, 94.5 after; Key West 129 before, 97.5
      after (its 5th, a pond short-left of the green, still 21.5).
    - **A club's nine**: Breckenridge's Bear nine is numbered 1-9 with a
      stray 12 beside it; a course with 1-9 and not all 18 is built as nine
      (door 2 and the tool).
    - **The game**: opening the same built file twice added it to Saved
      courses twice; it is now recognised by its hash. A built file over 64
      MB was told "smaller than 2 MB"; it is told its size and the limit.
    The courses built, and what each report says, are in RESEARCH, *Every
    course in bench/lidar, built*. **Not played by a person**, nor any of
    the door 2 changes above.

**The work remaining** (written into the goal at the owner's request, 1
November 2026), in the order it will be done:

- **Checked on the graphics card** (done 1 November: npm test and every
  builder journey after each change).
- **The other test courses' LIDAR** (tools/lidar-fetch.mjs, rate-limited by
  rockyweb; the Entwine copy the builder now uses is faster), then the LIDAR
  iterations and OpenStreetMap
  lined up with the LIDAR on each, as on Worthington.
- **Worthington end to end through door 2 in the browser**
  (door-real-worthington.mjs), compared with the references: the other
  simulator's classed tiles, grids and trees, USGS's 1 m DEM, NAIP and the
  scorecard.
- **The auto trace towards 90% overlap with OpenStreetMap** across the
  landscapes, from the picture and the LIDAR, with no specks, pocks or
  jagged edges (amendment 5). At iteration 52, from the picture alone and
  against the lined-up map: greens 31, fairways 31, sand 35, water 38.
- **Houses shown and edited in the editor**: done 1 November 2026 -- drawn
  as blocks with a pale front, a House tool and Clear houses, in the
  editor's undo and its file (editing.js addHome, removeHomes).
- **Move shape in the editor**: done 1 November 2026 (editing.js pickAt,
  moveShape; the builder-tools journey drags a bunker and undoes it).
  **Turning a shape**: done the same night (trace-edit.js turn,
  turnedCells; editing.js turnShape; door 2's and the editor's Turn shape).
- **Swiss LV95**: done 1 November 2026 -- swisstopo's approximate formulas
  (geo.js, to about a metre; LV03 too), and swissSURFACE3D found and
  downloaded in the page (its tiles state no grid: the catalogue's EPSG 2056
  is given them). A square in Bern: 11.5 million points, placed and built.
- **The builder's LIDAR checks a person can only do**: the rockyweb tiles
  through the LIDAR folder and through the owner's bridge (restarted to
  have `/lidar`), IGN downloaded in the page, Chrome's real save dialog,
  Chrome's folder dialog and the folder remembered on a later visit,
  Washington's portal opened on the course and its ZIP loaded.
- **Reported as not played** until the owner plays it: every one of these.

The parts of the study's tracing design not yet built -- the alignment nudge, a review layer, a classifier
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

**Where the goal stands (1 November 2026).** Stages 0-9 were built in order
and committed as each passed `npm test` and `npm run build` (62e9cbc stage 0,
502a3aa 1-3, f640390 4-5, 51def4a 6, 959334e 7-8, c974e34 9); the owner's
amendments 1-14 (*The amended goal*) were built on top, each committed the
same way, the last c2732ef. Held throughout: the Classic and Architect
fingerprints silent at every commit (checked again on a9f4b68); the game one
file, 14,848,264 bytes against main's 14,820,197 (+0.19%); Low measured for
the built-course shader path (*Stage 7*: a real course 0.81 ms of graphics
time against a generated eighteen's 1.18); the game's page makes no request;
the builder's only network use is what the owner's amendments asked for, at
the player's press (imagery, OpenStreetMap, LIDAR -- DISTRIBUTION_REVIEW).
The amendments against the spec's stages (each extends one; none adds a
stage): stage 5, the editor -- 7 (layers in the editor), 13 (WASD, the
smoothed surfaces, Save); stage 7, door 2 -- 1 (the step order), 2 (manual
trace), 3 (zoom and drag), 5 and 6 (imagery), 7 (layers), 8 (the painted
review), 9 (OpenStreetMap first), 10 (the 1 November list), 11 (the LIDAR
and the picture together, the lock), 12 (move a shape), 13 (find and
download LIDAR, kept pictures, drafts), 14 (rockyweb, state portals), 15 (the
LIDAR folder, tooltips, whose trees, keep or remove outside, coverage), 16
(the scorecard, Back to 2D, the landscape's look and tools, clearing trees,
tree height, redo, resizing); stage
8, the auto trace -- 4 and 5 (the iterations to 90%: picture 52 so far,
LIDAR 9), 10's OpenStreetMap lined up by the LIDAR; stage 6, the readers --
13's State Plane; stage 1, the game -- BUILT_VERSION 2 (each green its own).
**The fingerprints at every stage**, checked again on 1 November 2026 by
checking each commit out in its own worktree (`biome-fingerprint.mjs
--check`, Classic and `--designer architect`): 62e9cbc, 502a3aa, f640390,
51def4a, 959334e, c974e34 and 2cac003 -- "every existing biome is unchanged"
for both, every one.
Only stage 1 changed the ground shader on this branch (502a3aa), and Low was
measured there (*Stage 1*: a built course against its generated original,
no dearer).
OpenStreetMap import went into IDEAS.md at stage 0 and left it when the
owner picked it (amendment 9), as IDEAS.md's rules say. Worthington end to
end through door 2's page (the builder-door-2-worthington journey, on
c2732ef's code): ground against USGS's 1 m DEM 0.6 cm at the median, against
the other simulator's DTM 0.4 cm; its surfaces against OpenStreetMap; its
lengths against the club's card (median 22 yards short, the straight lines
of unbent holes); NAIP as the picture; a test round 101.5 against par 71,
nothing stuck; the trace measured three ways (LIDAR, picture, both: *Stage
8*, RESEARCH). Worthington's survey is read from a git-ignored copy in the
repository since amendment 13 (the owner's request), never committed. **Not
done, by the goal's own terms**: the owner playing the result -- nothing in
the builder has been played by a person (TODO lists what to check).

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
  while the course wears the landscape it came from, else by role, in the
  landscape's planting shares among the species of the tree's height
  (`speciesFor`; a survey's narrow or wide reading says nothing of the species,
  and is ignored: RESEARCH, *A survey sees a shape, not a species*). Creeks and rivers as the generator's own stations through
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
  in plain words). The game's ground shader paints it (the `BUILT_COURSE` branch, in a built course's program only),
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
  schema as a form (every setting, by category), *Grow this course* in
  slices so the page keeps painting, a
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
  with where it is. **And a course's weight** (`courseWeight`, 9 November 2026,
  the frame-rate goal; the owner: "We might need to add some optimization
  options into the builder"): past 25,000 trees or 400 houses (PLACED, from
  Dinosaur Mountain and Troon North) a note names them, says how many trees
  stand more than 250 m from every hole's line, and points at where those stand
  thickest -- trees an author may thin, a choice left to the author because a
  ball can hit them. Dinosaur Mountain: 45,223 trees, 600 houses, 32,076 far
  from play.
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
  itself, and since 1 November 2026 any Lambert conformal conic or transverse
  Mercator grid from the file's WKT (State Plane: geo.js `projectionOf`);
  another map grid lines up by matching points by hand (stage 7). A departure from the study, which named proj4js.
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
  its height), and reads a real Worthington LAZ when its survey is in
  bench/lidar/worthington (or `FAIRWAY_LIDAR_TEST` names the folder).

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
  journey, local only: it runs when Worthington's survey is in
  bench/lidar/worthington, or `FAIRWAY_LIDAR_TEST` names the folder): the four raw LAZ tiles chosen in the builder, the property dragged
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

### Roads (3 November 2026)

The US landscapes plan (PLAN 4: "roads anywhere in the builder"). Road
is offered in every landscape's Paint and Outline lists (layers.js) --
Outline Road is the parking-lot tool -- and door 2's OpenStreetMap step lays
roads (`highway=*` lines, painted their width: osm.js `ROAD_WIDTH`, from 5 m
for a service drive to 14 for a motorway, PLACED from US lane widths of
3-3.7 m; footways, tracks, cycleways and golf paths are not roads) and
parking lots (`amenity=parking` areas, not underground or multi-storey) as
the road layer. A course stores them as its `road` surface (ground code
11), which the game already drew and played as road, so no BUILT_VERSION
step.

### Skin from the land (3 November 2026)

The owner: "In the builder, we should add an option that the user can
click to do a best effort at skinning the landscape based on height ...
Allow the user to paint it or indicate as such if they dont want to auto
paint it. for all landscapes." The editor's **Skin from the land** (under
Paint; src/builder/skin.js, editing.js `skinFromLand`) reads the land as
shaped now: ground steeper than 0.6 (31 degrees) is the landscape's face
-- the first rock-like kind its landform names (rock for the Badlands, the
crags, the mesas, the lava; hardpan for the Piedmont's and SoCal's clay),
or where it names none its own first kind (native grass on a dune or a
prairie, waste on a sand ridge) -- and gentler ground (from 0.22) within
12 m below a face is its apron (the landform's next kind: scree, hardpan,
waste, heather). Never within 6 m of the holes' turf, sand, paths or water.
Added to the layers beside what was painted, one undo step; painting by
hand needs nothing new -- the Paint brushes and Outline were always there.
All four thresholds PLACED. A file only changes when the button is
pressed, so the button owes no BUILT_VERSION step.

**Seen in the real builder (3 November 2026, tools/capture/builder-skin.mjs,
no person yet).** The button, Undo and Redo pressed on two real surveys;
each undo put every layer back cell for cell, the Layers list showed the
new layers, Erase took a dragged stroke off one, and the saved course held
them. Bully Pulpit, its painted ground taken off first: 31 ha of rock on
the survey's steep breaks and 56 ha of bare clay below, the buttes east of
the holes reading as buttes and the flats left grass, in 9.7 seconds at
0.55 m. Chambers Bay: 6.3 ha of face and 19.6 ha of apron along the bluff
and the dunes' sides, in 5-7 seconds at 0.5 m; opened in the game too.
Three things it found: the fallback was rock, so Chambers Bay's dunes went
grey stone in a landscape whose Paint list has no rock (now only the
landscape's own kinds, native grass there; the test holds every landscape
to `layersFor`); the page froze with no word for those seconds (it now says
"Reading the land..." first); and where two ground types met the game's
edge was a staircase a metre wide, because a point took the texel it fell
in, which the skin makes common: a point now takes the type with the most
weight among the four texels round it, in ground.js and `builtGroundAt`
alike (BUILT_VERSION 3).

**Desert Mountain, on Troon North (9 November 2026).** The owner: "can we do
that for the desert mountain course as well? Does that code path work across
all landscapes?" It is one path for every landscape -- each takes its face and
apron from its own landform, and the test holds all fifteen to their own Paint
list -- but TPC Scottsdale, the bench's Desert Mountain course, has no
mountain in its survey (the canal's banks were all it found). So Troon
North's Monument was built (tools/build-courses.mjs `troon-north`, skinned;
par 72, 6,902 yd from the back; the virtual golfers 80.5, none stuck; a tee
shot played in the game). Its granite tors read as rock; the apron, waste
sand, blotched their flanks white, so a desert's apron is now its floor,
hardpan (RESEARCH, *The builder skins the land*). Seen in the game, not played
by a person. Two things door 2 needed for it: the map's boundary there is
the club's, round the Monument and the Pinnacle both numbered 1 to 18, so
its holes mixed; a boundary whose hole lines carry two `golf:course:name`s
is now two courses in the picker (osm-course.js `only`); and the build
tool takes a course's own square (`bbox`) and which of the two (`course`).
Nothing a file stores changed: no BUILT_VERSION step.

### The owner's first feedback (4 November 2026)

The owner's list after first looking at the goal's work, built with nothing
run on the graphics card (the owner was playing): **none of this has been seen
working**; the model is tested in Node, the page has not been opened.

- **Select shape** replaces Move shape and Turn shape in the 3D editor (and in
  2D, the same day: *The two editors at parity*). Click selects and outlines; drag inside moves; drag
  an anchor turns. editing.js `holdShape`, `ringsOf`, `onPick`; view.js
  `select`, `carry`, `ghost`, `anchorAt`.
- **Live, and how:** a surface comes off the grid when it is picked up, and
  from then on only its outline and a filled picture of it are moved, a few
  hundred points laid on the land each move; the surface texture is redrawn
  when it is picked up and put down. Rejected: rewriting the cells every frame
  (a fairway is about 160,000 cells and `drawCells` a rectangle each, a
  million on the box of a big one). So the picture is flat across a bump, drawn
  over the ground without depth, and the real edge arrives on letting go. A
  tree and a rock move their one instance, a house its small list.
- **A pond carried** moves its water body and digs itself in where it lands;
  the pit it left stays, for the player to fill with **Fill to surrounding**.
- **Fill to surrounding** (editing.js `shape`, op `fill`): reads 48 points round
  the brush's edge; the target runs from each in to their average, so it follows
  a slope, and it only raises. 3D editor only: the 2D plan has no ground tools.
  Rejected: a plane through the rim (a bowl on a saddle does not fit one), and
  the plain brush falloff (filled the middle, left the sides).
- **Water** (water-bed.js, used by the editor and door 2): see RESEARCH *A
  pond's bed*. Every Save digs every body, so a saved course comes right when
  opened and saved again. **`BUILT_VERSION` stays 3**: it is the file's land
  that changes, on saving, so an unchanged file plays as it did.
- **Ground cover** (cover.js): rocks are a new optional `rocks` list in the
  file; an older game drops them and an older file has none, so neither needs
  a version. Bushes and flowers are stored trees of the shrub role with their
  species in `treeKinds`: nothing new for the game. Both go through Back to
  2D and drafts. In both editors since the same day (trace-edit.js `paintCover`,
  the rules shared in cover.js); 2D draws rocks as grey discs and plants as the
  small crowns trees have. The editor draws rocks as grey stones and low plants as mounds;
  the game draws the models.
- **The preview** (preview.js, preview-items.js): the game's models in a small
  panel, one still picture, drawn when it changes or is dragged. **This puts
  the game's 25 MB of models in the builder's page** (DISTRIBUTION_REVIEW).
  PLACED, for the owner to overrule: a stand-in would not be "the 3d model".
  Colours are the species' summer tint or the landscape's tree colour, not
  vegetation.js's per-species tables, so a few differ from the game. A painted
  surface shows a plain disc of its colour with what the game grows on it.
  The models are the full ones the game draws close up. The owner asked for
  high resolution on first seeing it: what was coarse was the picture, so it
  went from 248 to 340 pixels wide, drawn at twice the screen's density, in the
  game's toon shading, with a shadow. Not seen.
- **Back to 2D** was there only for a course fresh from door 2. draft-from-doc.js
  makes a door 2 draft from any course, on door 2's grid; patches go onto that
  one grid, so detail finer than it goes on a first trip. Its land is marked
  `method` 'course', and docFromLand does not smooth it as it smooths a survey:
  it did at first, which took a little off a green's contours at every trip
  (the owner had it fixed the same day). Heights hold still from then on.
  **Auto trace and Manual trace still start a new trace** on such a course and
  would replace its layers; not guarded, and not tried.
- **Rough in the editors** is the landscape's summer rough (seasons.js `GREEN`).
- **The tools in sections** (the owner, of two bare numbers always on show:
  "This is confusing and is always showing. Do we need to have a separate Trees
  section?"). Yes: the 2D tools are grouped Surfaces, Trees, Ground cover,
  Houses, Shapes, and the 3D editor's Water and trees is split. Each option has
  its name and shows only while its tool is held (`data-for`): brush size, tree
  height, trees a hectare, the cover's sizes; in 3D the whole Brush group too.
  Left always on show in 2D: the layer picker, because a stroke's layer can be
  changed with any tool in hand and the journeys do, and Extrapolate. The 3D
  **Tree height** slider is now named **Every tree's size**, as it is. Not seen.

### Place tree picks the tree (5 November 2026)

The owner: "when i select 'place tree' i can select what tree to place." Both
editors offer the landscape's own trees by name (tree-names.js, cover.js
`treeChoices`: its plant list and its stands'), with "Any of the landscape's"
first, as it was. The preview shows the one picked at the height set. The tree
is stored with its species; the game draws it while the landscape grows it, which
now counts its stands as well as its plant list (built-world.js: drawing only, no
`BUILT_VERSION`). Names PLACED by the common name of each model's species, and two
older keys share a name, so a landscape shows one of them. Not seen on screen.

### Marks that drag (5 November 2026)

The owner: "make it so i can drag pieces around when placing the holes and
markers." On door 2's holes step a press on any tee, aim point or green picks it
up, on any hole, within 12 screen pixels (PLACED), the hole in hand first; a press
on open ground places the mark in hand, as before. The hole's line follows live;
the yards and the scorecard when it lands. In the 3D editor, **Drag markers** does
the same for tees, bends and greens (14 pixels, PLACED), one undo a drag; door 2's
step has no undo, and never had. Not seen on screen.

### The wait shows itself (5 November 2026)

The owner: "when getting data from open street map, we need to indicate processing
or progress of some sort." The busy screen (builder.js `setBusy`) now has a spinner
for everything, turned by the browser so it moves while the page works, and takes
a `share` for a bar and a `cancel` for a button. OpenStreetMap uses both: the seconds
counted while the server thinks (its query allows 90 s, and it says nothing until
it answers), the megabytes as they arrive (no total is sent, so the bar does not
creep), then each stage of laying it out. Cancel stops the wait and changes nothing.

### How much the LIDAR covers, and only what is missing (5 November 2026)

The owner: "before downloading we need to signify how much of the course is going
to be covered by the tiles", and "the builder should notice your previously
downloaded tiles and only download whats needed, then combine them to same folder
or zip."

- **Coverage** (lidar-coverage.js): each survey found shows a small map of the
  square, north up, green saved, gold to download, dark no data, and its share in
  words; the first line says what every survey covers together. Read from the
  USGS tiles' `boundingBox`, the Entwine copies' published outlines, IGN's tile
  geometry and swisstopo's `bbox`, all in degrees (checked 4 November 2026). **It
  measures the square searched for, not the course**, whose edge is not known
  until it is traced. A tile's box is its full square, so a survey's tile can
  promise ground it has no points on; an Entwine outline is the truer of the two.
- **Whole tiles** were already fetched only when missing, by name and size; the
  button now says how many before it is pressed. A search reads the folder only
  if it is already open this visit: it must not raise a prompt.
- **USGS squares** were the gap: a square was kept by its middle and size, so a
  different size or a nudge downloaded all of it again, into a second ZIP. The
  Entwine pieces are the same whichever square asks, so door 2 gathers the pieces
  of every kept square of the survey that touches the new one, fetches only the
  rest, and writes one combined ZIP named for the whole extent, with a list of
  the squares in it (`squares`), so asking again needs no network. **The ZIPs it
  replaces are removed**, once the new one is in the folder at its full size;
  only ever the builder's own. Squares of a survey that do not touch stay apart,
  so one survey over two courses is not read whole for each. A ZIP rather than a
  folder of pieces: Load from the folder and the files a player moves stay one
  file each.

### The two editors at parity (4 November 2026)

The owner: "we need to bring parity between the 2d and 3d editor", then to go
ahead with all of it, trees to scatter rather than lie in a line, and a Place tree
for single ones. Rules that exist twice drift, so what both do now lives once:
layer-ops.js (edge smoothing, Extrapolate, tree and house zones, anchors),
cover.js (what may stand where, the tree brush), water-bed.js (bowls, creeks,
beds), skin.js. tests/builder-parity.test.mjs tries each in both.

- **3D gained:** Water in Paint and Outline, which reads its bodies from the layer
  when a stroke ends (editing.js `settleWater`: levels kept where a body overlaps
  one, beds dug, one undo with the stroke), and fixes erased water leaving its
  sheet; Erase brush, Erase all layers, Smooth edges, Smooth all edges, Tidy
  specks, Extrapolate, on a picked layer; Place tree, Tree brush, Tree zone, House
  zone; a tree refused on turf, sand, water, paths and roads, which it never was.
  Plant trees is gone: it laid a row of one size along the pointer. Strength now
  shows for ground shaping only; cover and trees have How thick.
- **2D gained:** Select shape in place of Move shape and Turn shape (trace-edit.js
  `hold`, as editing.js `holdShape`), Tree brush, Size a tree, Every tree's size,
  Skin from the land, Dig a bunker, Draw a creek, a 60 m brush.
- **A bunker dug and a creek drawn in 2D change no ground on the plan.** They are
  records kept with the trace (undoable, in drafts), and docFromLand digs them
  from the ground as it stands, so a green moved later is not fighting a dug
  height. Back from 3D, the creeks the plan drew stay its own lines
  (round-trip.js `ownCreeks`), or they would be cut twice.
- **Every tree's size in 2D** is applied when the course is made, as the 3D
  slider is at Save, and back from 3D it is 1, the trees carrying it.
- **Left alone on purpose:** ground shaping stays 3D (heights cannot be judged
  from above); the survey's steps stay 2D; Check and Test round stay 3D.
- **Not done:** a pit left by erasing water is not filled: use Fill to surrounding.
  Skin in 2D reads the land as it stands, without bunkers or creeks not yet made.

Every box and drop-down is dark by one rule at the top of builder.css (the owner
found white boxes with white text): each had been styled place by place.

Tested in Node; **neither screen has been opened by the build**, and the builder
journeys, changed for Select shape and Place tree, have not been run.

### Built courses at their real height (4 November 2026)

The owner saw Bully Pulpit's clouds inside the ground. A generated course sits
round height 0, and clouds (640 m), the haze's floor (the water level) and a
mountain landscape's rock line, snow line and far treeline were fixed heights. A
survey keeps its real one: Bully Pulpit's ground is 690-784 m, Breckenridge's
2,809-2,896 m, Scottsdale's 455-479 m, against clouds at about 575-705 m and
below. On Breckenridge the snow line (550-750 m) should have turned its ground
white too: worked out from the shader, not seen. `world.skyBase` (built-world.js `skyBaseOf`) is
now what those measure from; a generated course has none and is unchanged.
Drawing only, so no `BUILT_VERSION`. Not seen in the game. Left alone: the
beach and wet-sand lines, which belong to a real sea at height 0.

### Game view (4 November 2026)

The owner: "go from the 3d preview to actual in game graphics and back again in
a quick way ... NOT have any editing tools in the Real game preview." A button
in the 3D editor (src/builder/game-view.js, its rules in game-look.js): the
game's own GolfView, lazily imported, drawing `worldFromDoc(editor.toDoc())` on
a canvas over the editor. **Not seen working**: it was built without running the
graphics card, so neither the picture nor the times below have been checked.

- **The view stays**, hidden by `visibility` (its size comes from its box), and
  each side stops drawing while the other shows (view.js `pause`). So no edit
  means no rebuild (`changeMark`), and only one picture is ever being drawn; two
  WebGL contexts are alive, which is the memory cost, unmeasured.
- **Timed without the card, on three LIDAR 18s**: gathering a painted course
  0.65-0.86 s, `worldFromDoc` 3.7-4.7 s (Node; `view.build` is unmeasured).
  The first look also pays for the shaders; the ground program alone was 2.0-2.3
  s three times over on the RTX 4090.
- **Season and graphics rebuild the drawing, not the world**: the same world
  through `view.build`, as the game's own settings do. Time of day is only the
  clock. None of them saved: `borrowedClock`, rate 0, nothing written.
- **Size**: the game's drawing code joins the builder's page: 26.6 to 28.2 MB
  (1.1 MB more gzipped).
- **What the picture costs** (9 November 2026, the frame-rate goal): the bar
  shows frames a second, the processor's work in a frame, and the triangles and
  draws in it, every half second, read from the renderer's own counts -- so a
  heavy spot is seen while building. **Rejected: builder-only drawing switches**
  (fewer trees, a coarser ground in Game view only): Game view is there to show
  what a player sees, and every fix to the game's drawing reaches it anyway.
- **The wait to open it, measured on Dinosaur Mountain** (tools/builder-frames.mjs,
  RTX 4090): 45-51 s before 9 November 2026 -- building the course 21 s, of
  which 16 s baking the field of distances to every outline on one core --
  29 s after, the field baked in bands on other cores (bake-pool.js): building
  5.3 s, drawing 4.7 s, preparing the graphics 18.9 s (the shader programs,
  already compiled in parallel; left). Frames there 6-17 ms before, 3-9 ms after.
- **Rejected**: opening the game's page beside the builder (file:// pages cannot
  hand each other a course reliably, and it is 36 MB and a full start every time);
  dressing the editor's own view as the game (it answers a brush in a frame because
  it is not the game); throwing the view away on return (the long wait every time).

## The LIDAR folder's tick boxes (5 November 2026)

The owner: "The builder only gives you one tick mark to select files." Every
file had its box, but a long name such as USGS_LPC_MN_MissouriRiverBigSioux_2021_B21_287_4833.laz
cannot wrap, and door 2's inputs are allowed to shrink (`min-width:0`), so the
box took all the squeeze: measured 0 px on those rows, 4 and 10 on others, 13 on
a short name. The rows could still be ticked by their names, unseen. The box no
longer shrinks and a long name now wraps anywhere. **Tick all** and **Untick all**
came with it, for a folder of many tiles.

## PLACED, and rules the build decided

Numbers placed rather than measured, and rules the study left open, so the
owner can overrule them:

- Heights stored to the centimetre; the file's limits (above).
- Land 1 m, greens and tees 0.25 m; the 3 x 3 km cap.
- A fixed ZIP entry date (1 January 2026), so a file's hash is its identity.
- The builder's section: a saved picture's JPEG quality .9; a picture is kept as
  plain pixels past 16,000 a side or 120 million in all; a file the game will
  open runs to 1 GB, of which 64 MB may be the course.
- The built field: half a metre (coarser past 2048 texels), 6 m either side of
  an edge; a patch fades into the land over 1.5 m; where two ground types
  meet, the type with the most weight among the four texels round a point.
- Freezing: the ground types from a 1 m raster, simplified to 0.35 m.
- A built course's file is kept by a 96-bit prefix of its SHA-256.
- The editor: the land drawn at every stored sample to about 1 km a side,
  coarser past it (under 2.2 million vertices); the surfaces edited at half a
  metre (coarser past 4096 cells a side), traced back as door 2 does since 1
  November 2026 (`layerRings`: the staircase relaxed, simplified to a tenth of
  a cell, corners rounded; first 0.35 of a cell with the staircase kept, then
  0.6 of a cell, which left notches); the 3D view's surfaces drawn from those
  outlines at up to 4 texels a cell and 12 million texels, and again round
  the camera at 1.5 to 15 cm a texel (`closeUp`); a brush's raise or lower 0.5 m a dab at full strength.
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

## The landscapes' new keys and the map (2 November 2026)

The US landscapes goal renamed seven landscapes' keys (regions.js
`OLD_KEYS`). A `.fairway` file naming an old key opens on the new one
(course-doc.js `validateDoc`), so no file needs rewriting and BUILT_VERSION
does not move: how a stored course plays is unchanged. Door 1 shows the map
of the landscapes over its landscape list; door 2 suggests the landscape
from where the survey lies (landscape-map.js `landscapeAt` at the land's
centre, taken unasked when the land is built unless one was chosen) and
marks the survey on the map; a survey off the map, or in a landscape not
built yet, says so.

## The builder-ux goal (branch `builder-ux`, from 9 November 2026)

By 9 November 2026 the owner had played every part of the builder that TODO
listed as "not played by a person" (those entries are closed in TODO's
`# Done`). The owner's verdict: the layer rule (paint goes under the layers
above it) and Skin from the land are right and stay; a real course takes
about 15 minutes with OpenStreetMap data, which is fast; but "The UI is
extremely basic and really confusing. It needs to run more like an MS
Paint/real 3d editor than what it does today."

What the goal is to do, in short: make the layer rule visible; steady the
brush so strokes come out smooth; turn every outline tool into a pen with
nodes, a live preview of the curve that will be filled, and closing on the
first node; give the steps a clear flow; add a one-press "Build it for me"
from a course name; make the pictures under the course sharp (the free US
tiles stop at about 1.7 m a pixel, and big courses are cut to 400 tiles,
src/builder/imagery.js `zoomFor`); and a UI/UX pass over every flow, with a
paint-program layout (menu bar, tool palette, options, layers, status bar)
in the game's own interface kit. Claude added: moving and deleting ponds,
creeks and holes, doglegs from the trace, named undo with a history, an
automatic draft, first-visit tips, plain wording, and checks at small and
large screen sizes. The owner added, on 10 November 2026: a measure tool and
live yardages, copy and paste, a hole navigator, brightness and contrast for
the picture, a clear step from the builder into the game, a player's guide
with screenshots shipped in the zips (`Fairway Builder Guide.html`, kept
current by every builder change: AGENTS.md's documentation list), a test
that old course files and drafts still open, and **the auto trace moved into
an Experimental menu** ("so that users dont think its going to do a good
job"), with no more work on its accuracy.

Nothing is built yet. The full brief, with the targets, the order of work
and the graphics-card precautions, is local: docs/studies/builder-ux/GOAL.md.
Findings, decisions and what was rejected go into this section as the work
lands.

### Every builder journey green (10 November 2026)

The goal's first job: the builder's smoke had run 6 of 8 since before the
frame-rate goal, the same two failing on main. Both were found before
anything changed:

- **builder-door-2** (harness wrong): it expected the Scottish Links' round
  shrubs in the 3D editor. Seaside Links, which replaced it on 8 November,
  grows shore pines, drawn as cones (tree-shape.js `standIn`); the journey
  looked only at round crowns and found none, so the tree-size check read 0.
  It now checks the cones, and only meshes that hold trees.
- **builder-door-2-worthington** (harness wrong twice, the builder once):
  it expected Heartland where the landscapes now say Classic Parkland. Then
  **a real bug**: a press within 12 pixels of *any* hole's mark picked that
  mark up and made its hole the current one, so placing the 10th tee beside
  the 9th green took the 9th green -- nine of Worthington's eighteen holes
  could not be marked by clicking. Now a press on another hole's mark waits:
  a drag of 5 pixels takes it, a click places the mark in hand on the hole
  being marked (hole-marks.js `pressOn`; tests/builder-marks.test.mjs). The
  current hole's own marks pick up at once, as before. Then the harness ran
  out of memory handing the 49-megabyte file to the game as an array of
  numbers; it goes as base64 now.

All eight pass (builder-ux, 10 November 2026). The owner, the same morning:
Worthington's OpenStreetMap holes are "completely wrong. Many holes pointing
to the wrong place" -- the journey clicks where the map says, which tests the
clicking, not the course; wrong map data is item 24 of the goal.

### The new layout, first stage (10 November 2026)

Door 2 is now laid out as a paint program (items 8 and 5 of the goal, the
first stage; the 3D editor follows): **menus** along the top (File, Edit,
View, Tools, Help; menu.js, with the rules in shortcuts.js and a Node test),
every command with its key and the keys working everywhere but a text box;
a **step bar** of chips (done ticked, current filled, unreachable dimmed
with the reason) with what the step still needs and **one Next button** at
its right end; a **tool palette** of icons with their keys down the left of
the plan (TOOL_LIST in door-real.js); the step's **panel on the right** --
in the trace step Tool options (only the tool in hand's), Layers (the chosen
one marked, and a line saying what a stroke on it goes under), Skin from the
land in its own box, then folding sections (OpenStreetMap, Picture, Viewing,
Landscape, Course boundary, Clean up, Experimental), which are open is kept
for the session; and a **status bar** of one fixed height with Undo, Redo,
what the tool does, what just happened (each cut to one line, the full text
on hover), the pointer's place and the ground's height, and the zoom.

Rejected on the way: a status bar that wraps. The first build let a long
message wrap to a second line, which made the bar taller and moved the plan
under the mouse mid-drag (the builder-door-2 journey's picture drag lost
4 m of its 4 m north). One line each, cut short, is steadier.

**The auto trace is in Experimental now** (item 23; the owner: "so that
users dont think its going to do a good job"), in the trace step's folding
section and under Tools > Experimental, with a line saying what to expect;
**Manual trace** became **Draw it myself**, beside OpenStreetMap as the two
ways to start. Not seen by a person.

### The pen and the steadied brush (10 November 2026)

Items 3 and 2 of the goal, on door 2's plan (the 3D editor follows with its
layout). **The pen** (pen.js): a node at every click, the curve through them
drawn live on to the pointer, a dotted line back to the first node, the
first node growing yellow when a click there would close the shape; closed,
the shape fills faintly and its nodes drag; Enter or Apply fills it. The
same pen for Outline fill, Tree zone, House zone, the boundary and creeks.
The fill is the curve shown, not the nodes' polygon smoothed afterwards.
**The steadied brush** (steady.js): Paint, Erase and Erase all trail the
pointer on a string (Steadiness, 50 by default), lay their dabs evenly, catch
up when let go, and smooth the stroke's edge inside the stroke. Numbers and
sources: RESEARCH, *The builder's pen and steadied brush*. Checked by the
builder-door-2 journey (the pen's nodes, Backspace, closing on the first
node, a dragged node, the bowed fill; a shaky stroke 12.5 m wide plain and
7.5 m steadied). Not seen by a person.

### The 3D editor: one brush, one pen, menus (10 November 2026)

The editor's Paint and Outline groups listed every surface of the landscape
as a button each -- 22 buttons that were two tools. Now **Surfaces** holds
one **Paint brush** and one **Pen** for the layer chosen in its list or by
clicking a row of Layers (the chosen row marked), with the line saying what
it goes under, Erase, Erase all, Smooth edges and Skin from the land. The
brush is steadied (steady.js, as door 2's: the string measured in metres
where the stroke starts, from the camera); the pen draws pen.js's curve
through the nodes and fills it (the first node, a double-click or Enter;
Shift for a corner; Backspace). **PLACED:** in 3D a click on the first node
fills at once -- there is no adjusting the nodes after closing, as there is
on door 2's plan, because a node on uneven ground is hard to pick up again in
perspective. **The menus** (useMenus) give the editor File (Save a copy to
share, Back to 2D, Close), Edit, View (From above F, This hole, Game view G)
and Tools with keys; W, A, S, D, Q and E are left to the camera's flying, so
Erase and Smooth edges have no key here. **Not done:** the editor's left
column is still a column of grouped buttons, not door 2's icon palette with
the options on the right. The journeys choose the layer and press the one
brush or pen. Not seen by a person.

### Layers made clear, steps that say what they are for (10 November 2026)

Item 1 (the owner: the layer rule "is great. Its just not clear thats how it
works"): the layers' shown/hidden word buttons are **eyes** (icons.js
`eyeButton`, both editors), struck through and red while hidden; the chosen
layer is marked; under the "Painting" choice a line says what the layer goes
under; and when a brush stroke in door 2 went in under a higher layer, its
path flashes yellow for under two seconds where it went and the status bar
says so ("The semi-rough went in under the sand and fairway, which stay on
top"), the first time with the rule in words (door-real.js `underNote`).
Rejected: drawing the hidden part of every stroke for as long as it is
hidden -- the plan would show two layers at once and read as a mistake.
Item 5: each step's panel opens with a line saying what the step is for
(`INTRO`). The tool preview, which sat over a corner of the plan, folds to
its title line (preview.js). Checked by the builder-door-2 journey (the line
and the message for semi under sand). Not seen by a person.

### Skin from the land, given its place (10 November 2026)

Item 4 (the owner: "amazing, sets it apart"). Its output is unchanged. On
door 2's plan it has its own box under the layers; it says what it painted
in hectares ("scree on 3.2 ha of steep ground, hardpan on 5.1 ha below
it"); and **Before (hold)** draws the trace as it was before the skin for as
long as it is held (Space or Enter toggles it from the keyboard). PLACED: a
held button rather than a slider between the two -- the eye compares two
whole pictures better by flicking than by a wipe. The 3D editor keeps its
button in Surfaces, with no compare. Not seen by a person; no journey runs
the skin on a survey steep enough (tools/capture/builder-skin.mjs does, on
real courses).

### Sharp pictures (10 November 2026)

Item 7. In the United States the first picture source is now USGS's NAIP Plus
image service, asked for 1,024-pixel blocks at the land's own cell size (never
finer than 30 cm): on Worthington, 0.30 m a pixel against the tile cache's
1.73 m. The tile cap is 640, up from 400, so a big course keeps its zoom.
Details and the measurement: RESEARCH, *Sharper pictures for the builder*.
Checked by the builder-door-2 journey (offered first, asked for blocks, with a
stand-in server) and tests/imagery.test.mjs. Not seen by a person in the
builder; the saved file's growth not measured.

### Build it for me (10 November 2026)

Item 6. At the top of door 2's first step: a course's name and one press,
and door 2's own steps run in turn (`buildForMe`): the place (a golf course
on the map wins over the town it is named after; several of the same name
are listed to pick from, and the build goes on), the USGS survey covering
most of the 1.5 km square (newest on a tie) downloaded through Entwine, the
land, the first free picture source (USGS NAIP in the US), OpenStreetMap laid
and refined with the LIDAR, the club's holes, boundary and name; then the
review, or the holes step if the map left holes unmarked. It stops with
what to do by hand when there is no survey that downloads in the page, or
no course on the map. The folder for the LIDAR is asked for first, while the
press still counts. **Worthington Country Club, real services: 3 min 52 s,
18 of 18 holes** (RESEARCH, *Build it for me, on a real course*); the
builder-build-for-me journey runs it with every service stood in for. Not
yet: a Cancel between the steps (each step's own wait has its words; the
OpenStreetMap wait has its Cancel). Not seen by a person.

### Checking the map (10 November 2026)

Item 24 (the owner: "a solution for incomplete OSM data"; Worthington's map
"completely wrong"). The holes step opens with **Checking the map**
(map-checks.js): what the map holds against what the course needs, and each
thing to check with Show and, where one suits, Fix, red rings on the plan,
and Take the fixes offered (three rounds, a plain button that says they are
guesses). Build it for me stops on the holes step when there is anything to
check, saying how many holes and whether the map is unreliable; and when
OpenStreetMap does not answer it says so and leaves the trace step ready to
ask again (it used to start a blank trace, which read as "no course here").
On Worthington: 9 of 18 holes flagged, the map called unreliable; the fixes
straighten the lines down the fairways but cannot settle the map's numbering
(RESEARCH, *Checking OpenStreetMap's holes, on Worthington*). Checked by the
builder-build-for-me journey (a club with one hole drawn wrong). Not built:
typing the card's yards as a witness; scoring on damaged maps of the bench
courses. Not seen by a person.

### Measure, live yardages, copy and paste (10 November 2026)

Items 17 and 18, on door 2's plan. **Measure** (M) draws a line between two
clicks with its yards, metres and the rise or fall from the land
(door-real.js `measureWords`); while a hole's aim point or green is placed,
the yards from the back tee (or the last aim point) follow the pointer, with
the yards along the hole when placing a green after aim points. **Copy,
Paste at the pointer, Duplicate, Delete** (Ctrl+C, Ctrl+V, Ctrl+D, Delete in
the Edit menu) work on what Select shape has chosen, through trace-edit.js
`copy` and `remove` (one undo step each; a deleted shape comes off its own
layer only). PLACED: a paste lands centred on the pointer, Duplicate 15 m to
the south-east; the copy comes selected. The 3D editor has neither yet. Not
seen by a person.
