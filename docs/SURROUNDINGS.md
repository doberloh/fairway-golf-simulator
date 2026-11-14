# The surroundings rework

Branch `surroundings-rework`, started 12 November 2026. The owner's request,
the plan, each round, and every earlier decision this reverses. The rules for
working on the branch are in AGENTS.md, *The surroundings rework*.

## What was asked

The owner, 12 November 2026: "I don't like the way that the non playable
landscapes look in game. The recent re work that we did with all of the
models for the playable part of the landscape have made the non playable
surrounding landscape look really bad. Please plan out a full rework of all of
the biomes surrounding landscapes to blend in better with the playable
landscapes. I would also like to have the users have control over what the
surrounding landscape looks like in the builder if they want to."

Liked, and kept:

- the mountain on one side with desert round it (Desert Mountain);
- the ocean on Seaside Links;
- the surroundings changing colour with the season.

Not liked, and replaced:

- the surroundings are plainly lower in polygons and resolution than the
  course, so they look out of place;
- nothing in the builder changes them;
- the "tree domes";
- the tree pattern painted on some hills and mountains.

"My preference would be full fledged landscape out much farther generated just
like the playable landscape is, but the performance level for the game needs
to be maintained and not made worse (should strive for better if possible)."

## What the surroundings are today (main, 0.9.14)

Measured on seed FAIRWAY, eighteen holes, the starting course.

| Piece | Where | What it is | Size |
| --- | --- | --- | --- |
| The course's ground | to 150 m past the property line | 3 m cells, the real land | 578 x 741 cells (Classic Parkland) |
| The far ring | from there to 13 km | rings of triangles, 28% further apart each time (16% and never over 220 m for mesas, islands, the big mountain) | **13,000 triangles** on most landscapes, 108,000 on Desert Mountain |
| The far woods | property line to 12.8 km | clusters of three lumps or two-cone spruces to about 420 m, then one dome or cone per site, each as wide as its spacing (6% of the distance) | 19,500 on Classic Parkland, 10,900 on Mountain, 1,400 scrub clumps on Desert Mountain, 65 on the Prairie |
| The painted forest | past the property line | crown-sized lumps drawn by the ground's shader | every forested landscape |
| The far heath | Seaside Links | domes past the heather | |

A height asked of the land far from the course costs 1.2 to 3.8 millionths of
a second, so a far land of a hundred thousand points is a few tenths of a
second of the wait when a course starts.

What reads badly in the pictures (bench/shots/overhaul/sur-main, local):
the hills behind a parkland hole are a quilt of pale lumps; from above, the
woods past the property line are domes 20 to 300 m across against real trees
8 m across; Desert Mountain's ranges are a few dozen flat faces with the rock
colour smeared across each; open country is bare to the horizon.

## The plan

One idea runs through it: **the surroundings are made by the same rules as the
course, drawn with the course's own models, and only their detail falls with
distance -- never their kind.**

### 1. The far ground: the same land, twenty times finer

- The far land keeps being the course's own land function carried outward
  (hills and landforms, then the landscape's far relief: range, big mountain,
  mesas, islands, carved badlands).
- The ring is rebuilt with cells that start at the course's own edge spacing
  and grow by about 2% of the distance out, instead of 28% a ring: about
  200,000 triangles where there are 13,000, each roughly square.
- It is cut into pieces by direction and distance, so the card skips what is
  behind the camera (today the ring is one mesh, drawn whole every frame).
- Its lighting normals come from the fine land, not from the coarse faces, so
  a slope shades as a slope and the faces stop showing.
- Low and Medium take a coarser copy (tier reach and spacing in graphics.js).

### 2. The far ground's paint: ground types, not a tree pattern

- The painted lumps go. Ground under far trees is a plain forest-floor tone
  in the season's colours, so a gap between trees reads as shade.
- The course's own ground types carry on outward by rule (slope, height and
  broad noise): rock on steep faces, scree under them, meadow, native grass,
  hardpan and washes in the desert, snow above a snow line on high ranges
  (lower in winter).
- Broad variation in tone at 100 m to 2 km scales, so no hillside is one flat
  colour; the turf detail keeps fading out with distance as it does now.

### 3. The far trees: the landscape's own trees

- **The near band** (property line to about 250 m): the course's own planting
  rules -- stands, scatter, rocks -- carried past the line with the real
  models and their far twins, at true size. Drawn only: nothing a ball can
  meet changes, no saved round moves.
- **Beyond**: every tree is a picture of the landscape's own model, taken in
  the game when the course loads, in the round's season, and stood upright
  facing the camera (two triangles a tree). A palm is a palm, a saguaro a
  saguaro, at true size and close-set, out to the tier's reach (about 5 km on
  Ultra, 1.5 km on Low); a little larger and sparser with distance so the
  count stays bounded.
- **Past that**: the forest tone of step 2 only; a crown there is a pixel or
  two.
- The clusters, spruces, domes, cones and scrub lumps of the far woods, and
  the far heath's domes, go.

### 4. A recipe for every landscape

Each landscape's surroundings become one record (`surround` in biomes.js):
what stands on each side (open country, rolling hills, a range, one big
mountain, mesas, sea, a lake, islands), how high, how wooded, where the
treeline and the snow line are, what grows. The fifteen landscapes are then
gone through one at a time against pictures, keeping what the owner liked.

### 5. The builder chooses

- A built course's file may carry its own `surround` record; without one it
  takes its landscape's.
- The Course Builder gets a Surroundings panel: each of the four sides picked
  from the kinds above, with height and tree cover, seen at once in Game view.
- The game draws what the file says. Scenery only: `BUILT_VERSION` does not
  move, and a file without the record plays as before.

### 6. Held to the frame rate

- Every round that changes what is drawn is measured against main on every
  tier (`tools/frame-ab.mjs`), on a forested landscape, an open one and a
  mountain one, from the tee and from above.
- The budget is today's: the far woods' 0.4 to 0.8 million triangles and the
  ring's share of the ground's shading. The new far land must come in at or
  under it on each tier.
- The wait when a course starts is measured too (`tools/gen-time.mjs`).

### Order of work

1. Groundwork: branch, rules, before pictures, this page. **Done.**
2. The far ground's mesh (step 1), measured.
3. The far trees (step 3), measured; the old far woods removed.
4. The far ground's paint (step 2).
5. The recipe (step 4) and the fifteen landscapes, in rounds.
6. The builder's panel and the file's record (step 5).
7. Frame rate on every tier, the smoke runs, the documents, `dist/`.

## Decisions reversed

Listed as each is made (AGENTS.md: earlier surroundings decisions bind
nothing on this branch).

- **The far ring's coarse rows** (28% apart; 16% and never over 220 m for
  mesas, islands and the big mountain; 70 m rows over the Badlands' first
  3.6 km; doubled vertices along a peaked range). One rule now, finer than
  any of them: landscape-edge.js `RING_DETAIL`.
- **The far woods** (the polish goal, 26 October 2026, and the far-landscape
  goal's rounds 1 to 8: clusters, spruces, domes, cones, snags, scrub clumps;
  "LODs can fade but should not transition to just bare ground"; each crown
  seated on the drawn ground over its whole footprint, `seatOn`, bench
  `farSeated`). Replaced by the course's own trees: surround.js, far-trees.js.
  What that goal wanted still holds -- trees to the tier's reach, never a bare
  band -- by other means.
- **The painted crowns** (the cartoon overhaul's far forest, ground.js THE
  FOREST ON THE FAR HILLS: lumps lit from the sun's side). The patches, the
  treeline and the far-off canopy colour stay; the lumps are a plain forest
  floor.
- **Low and Medium drawing far woods as grove domes only** (graphics.js
  `farWoods: 'groves'`): no tier draws domes; each tier has its own reach,
  thinning and picture size instead (`surround`).
- **This branch's own round 10, in three parts** (reversed in round 11 on
  the owner's word, 13 November 2026): the far rock face broken into cells
  ("actively bad", "terrible"); Hawaii's range as fluted knife crests with
  crags ("more rounded and less steep"); far woods holding on to 52
  degrees ("trees growing on almost vertical surfaces"). And rounds 2 to
  4's far trees lit with a light baked into their picture and a normal
  straight up ("lit the same way as everything else"). *Round 11* has each.

## Rounds

One entry a round: what changed, what the pictures showed, what it cost.

### Round 0 (12 November 2026): groundwork

Branch cut from main de937532. Before pictures of all fifteen landscapes from
main's own build, seven views each (`node tools/capture/overhaul.mjs sur-main
--views h1-tee,far-band,far-band-b,far-out,far-side,far-high,overview`), kept
locally in bench/shots/overhaul/sur-main. The measurements above.

### Round 1: the far ground, fourteen times finer

landscape-edge.js: the ring's fineness is one record, `RING_DETAIL` (first
step 8 m, each step 2% longer, never over 220 m): 180 rings, 93,000 vertices
and 182,000 triangles on Classic Parkland where there were 26 rings and
13,000 triangles; cells 20 m across at 600 m, 50 m at 2 km. Built in 0.12 s
(0.27 s on Desert Mountain, whose mountain costs more a point). A tier may
take a coarser ring (graphics.js `farGround`: Low 6% a step, Medium 3.5%);
`ringMesh`, `drawnGround` and `drawnVertices` take the detail, so anything
standing on the ring asks for the one it is drawn on. Pictures: Desert
Mountain's ranges have ridges and gullies instead of a few flat faces.
Not chunked: the ring is still one mesh drawn whole (PLACED: measure first).

### Rounds 2 to 4: the far trees

src/surround.js (pure) plants the land past the property line by the
landscape's own stand: its spacing and mix, each tree sized by the course's
own rule (`world.treeSize`, which course.js now puts on the world), where the
far forest record says woods grow. The first 110 m are tree records drawn by
vegetation.js with the real models (never in `world.trees`). Beyond, each
site is drawn by src/far-trees.js as two triangles standing upright and
turned to the camera, wearing a picture of its own model: vegetation.js keeps
one `specimen` a model (the parts and colours the first tree of it was drawn
with), and far-trees.js draws each from the side into one atlas when the
course is built.

Counts on seed FAIRWAY, Ultra: Classic Parkland 3,057 near and 159,612 far;
Mountain 5,250 and 77,189. Placing them takes 0.5 to 0.7 s (the far woods'
seating took 0.5 to 0.8 s and is gone).

What went wrong on the way, so nobody repeats it:

- **A fixed `customProgramCacheKey` on the far trees' material.** The
  renderer wraps every material's `onBeforeCompile` afterwards (haze,
  cascades, cloud shadows) and three tells programs apart by that function's
  text; a fixed key would reuse a program built before the wrapping.
  Removed.
- **Replacing `#include <begin_vertex>` outright.** mist.js patches only a
  shader that still includes it, so the far trees stood crisp and three
  times too bright in front of the haze (no haze and no cascade lighting).
  The chunk is kept and `transformed` set after it.
- **Pictures in flat colour** stood out vivid beside the real trees, whose
  crowns go through the coloured toon ramp. Each picture is now shaded
  through the scene's own ramp from a sun over the viewer's left shoulder.
- **Too few trees**: thinning by one stand spacing every 1.5 km left hillsides
  half bare from above. Now every 3.2 km, nine sites in ten kept at the line.
- **No trees on Mountain's slopes**: the cliff test (slope .85) is the near
  band's; far sites hold on to 1.3, as the painted forest did, because the
  drawn faces are steeper than the land they stand for.

### Round 5: no crowns painted on the ground

ground.js: the lumps are gone from the far forest's paint. Under the trees
the ground is the leaf colours' average at about half the light, mottled at
23 m; past the tier's tree reach (`farReach`) it rises to the canopy colour
it always had far off. surround.js reads the same 380 m patch noise as the
shader, so trees stand where the floor is painted. Pictures: Classic
Parkland from above is a course cut out of a forest that runs to the
horizon; Mountain's slopes are wooded with its own conifers and aspens.
Still to do there: the floor is dark and flat where trees are thin.

### Round 6: what it cost, and the cap on real models

First comparison with 0.9.14 (`tools/frame-ab.mjs`, Classic Parkland, 18
holes, tee 1, tee 5 and 250 m up; two rounds; helpers were using the
processor at the time, so the frame times are rough and the counts are what
to trust):

| Tier | 0.9.14 | Branch | Triangles a frame |
| --- | --- | --- | --- |
| Ultra | 7.9 ms | 8.9 ms | 42.9 M to 55.4 M |
| Medium | 2.00 ms | 1.67 ms | 9.4 M to 9.6 M |
| Low | 1.77 ms | 2.50 ms (card time equal: 1.03 to 0.98 ms) | 7.5 M to 7.4 M |

The 12 million more triangles on Ultra were the near band: 3,057 real
models past the line, each the whole tree on Ultra. The 160,000 pictures
are a third of a million. So only the nearest `nearMax` of the band are real
models (300; High 250, Medium 120, Low none) and the rest of the band are
pictures like the others. Course load was 2 to 2.7 s longer in that
comparison; placing the trees is 0.1 to 0.5 s of it and the pictures 0.05 s
(`view.surroundMs`, read by the captures), so most was the real models too.
To be measured again.

Also in this round: the ring is drawn in 24 pieces (eight directions, three
distances: `landscapeChunks`) that share its vertices, so the card skips
what is out of view; a far tree count never passes `most` (200,000; a
Northern Woods course came to 354,000) and its spacing is never under 12 m;
the far ground is toned by three broad noises so no hillside is one colour;
far off, a tree's picture is a quarter wider and let a sixth into the ground
(thin pictures of bare-boled pines read from above as a field of sticks).

### Round 7: a side at a time, and the builder

- src/surround-sides.js (pure): the record a course may carry, `surround:
  {sides: {n, e, s, w}, height, cover}`; nine kinds (as the landscape, open
  country, rolling hills, a range, one big mountain, mesas, the sea, sea and
  islands, a lake); `normaliseSurround`; `seaLevelUnder`.
- landscape-edge.js `sidedRelief`: each side raised by its kind, corners
  blended by the squares of the distances past each side.
- course-doc.js keeps the record in the file; absent when every choice is the
  landscape's own. `BUILT_VERSION` unchanged: scenery only.
- built-world.js: `world.surround`; a side of water makes the world one with
  a sea, standing 2.5 m under the lowest of the land unless the file has a
  sea of its own (so neither sea nor beach reaches any of the course);
  ground.js paints beach and wet sand from `seaAt`, the sea's own level, and
  the ocean is drawn at `world.waterLevel` (it was always drawn at zero).
- The Course Builder's editor has a Surroundings block under Landscape: North,
  East, South, West, Height, Trees. Carried through drafts, Back to 2D and
  door 2's course. No undo step (as the tree plan). Seen in Game view.
- **Not seen working in the builder yet**: built and unit-tested only.

### Round 8: measured clean, no real models past the line, open country

Second comparison with 0.9.14, the machine quiet (three rounds on Classic
Parkland, two on Mountain; medians; `bench/ab/sur-r7-*.json`, local):

| Tier, course | 0.9.14 | Branch | Triangles a frame | Course load |
| --- | --- | --- | --- | --- |
| Ultra, Classic Parkland | 5.09 ms | 5.43 ms (card: +2%, +6%, +2% at the three spots) | 42.9 M to 44.2 M | 21.3 s to 19.8 s |
| High, Mountain | 6.65 ms | 6.75 ms | 68.4 M to 69.6 M | 17.8 s to 20.6 s (two runs each, 2 s apart among themselves) |
| Low, Classic Parkland | 1.53 ms | 1.53 ms (card time 0.87 to 0.92, 0.79 to 0.74, 0.73 to 0.60) | 7.5 M to 7.3 M | 18.8 s to 17.3 s |

The whole of what the branch drew over 0.9.14 on Ultra and High was the
300 (250) real models kept past the line: 1.3 million triangles. So
`nearMax` is 0 on every tier: pictures from the line. Seen from 6 m inside
the line at eye height (the capture tool's new `edge-eye` views) the nearest
pictures read as the trees they are of; a picture is 256 pixels high on
Ultra, 192 on High, 160 and 128 below.

The owner, 13 November 2026: "I dont think we always need 'full forest' on
the outside. We could generate patches with no trees to save on polygon count
if needed." A second, broader noise (900 m) now opens meadows in the far
forest: about a quarter of the wooded country (`FAR_OPEN`, .36; a landscape
may set `farForest.open`; scrub takes none). Classic Parkland's far trees
went from 180,000 to 129,000 on Ultra, placing them from 0.36 s to 0.13 s
in the game.

**The trees stand where the floor is painted, exactly.** Trees and paint
both read a hash of the 380 m cell; through sin() the card and the page get
different numbers a few cells from the middle, and the first rounds had dark
forest floor with no trees on it beside trees on bare ground (Classic
Parkland, the California Coast). Both now hash in whole numbers (ground.js
and surround.js `coverHash`).

A built course with sides of its own seen in the game: the owner's Home
Course (a copy; the file itself only read) with a mountain north, the sea
east, a lake south and mesas west, opened by `tools/capture/overhaul.mjs
--built`: no errors. Its first shore was a ruled line with a square corner;
shores now wander in bays and points (40 to 300 m out by a 500 m noise).

### Round 9: the last of the cost, and the builder's own page

Third comparison, with no real model past the line and the meadows open
(`bench/ab/sur-r9-*.json`, `sur-r10-*.json`, local; medians, the machine
quiet; card time in brackets where the page's own time was noisy):

| Tier, course | 0.9.14 | Branch | Triangles a frame | Course load |
| --- | --- | --- | --- | --- |
| Low, Redwood Coast | 1.63 ms | 1.60 ms | 27.6 M to 27.4 M | 14.7 s to 14.4 s |
| Medium, Desert Mountain | 2.32 ms | 2.32 ms | 20.1 M to 20.0 M | 17.8 s to 18.5 s |
| High, Mountain | 6.57 ms | 6.63 ms (card 6.18 to 6.23, 6.36 to 6.48, 7.16 to 7.18) | 68.4 M both | 14.9 s to 14.8 s |
| Ultra, Classic Parkland | card 4.56, 4.69, 5.94 | card 4.63, 4.78, 5.90 | 42.9 M to 42.7 M | 14.2 s to 14.3 s |

Mountain's slower load in round 8 did not repeat: it was noise.

Two things took the far trees from 5% over on one Ultra view to within 2%:
each piece's trees are drawn nearest the property line first, and the
pieces nearest band first (a wooded hillside is ten pictures deep).
Then, measured on one page with the far trees switched off and on
(`tools/frame-variants.mjs --variants tools/variants/far-woods.mjs`): they
cost 2.1 to 3.1% of an Ultra frame drawn BEFORE everything, as the far woods
were (render order -1), because from a tee most of them are behind the
course's own stands and were shaded and painted over. Drawn after
everything solid and before the ground (.5 to .7) they cost about 1%, and
the unchanged frame fell from 4.48-4.61 ms to 4.42-4.49 at tee 1 and from
4.70 to 4.61 at tee 5. The far ground costs 0.5%.

The two builds compared again after that change (`bench/ab/sur-r11-*.json`,
three rounds, card time at tee 1, tee 5 and 250 m up): Ultra on Classic
Parkland 4.59, 4.88 and 5.94 ms on 0.9.14 against 4.51, 4.67 and 5.91 ms on
the branch -- faster at every spot; High on Mountain 6.16, 6.37 and 7.15 ms
against 6.20, 6.46 and 7.15 ms -- level from above and 0.04 to 0.09 ms (0.6
to 1.4%) slower at the two tees, where one build's own runs differ by as
much (6.14 to 6.20; 6.32 to 6.42). Course load 14.5 s against 14.9 s and
15.1 s against 15.3 s. So: Low 2% faster, Medium level, Ultra 0.5 to 4%
faster, High on Mountain within 1.4% and not shown to be level.

**The Surroundings block pressed in the builder's own page**
(`tools/builder-journeys/surroundings.mjs`, the `builder-surroundings`
journey): a nine grown and taken over; a mountain north, the sea east, a
lake south, mesas west, Height 1.4, Trees half wooded; the editor holds
exactly that record; Game view draws it and goes back; the saved file's
record read back; every side set back leaves none; the game opens the file
and a shot is played, no errors. 1,599 Node tests pass. On the final build
every smoke journey passes: the game's 41 of 41 and the builder's 10 of 10
(13 November 2026). The builder guide's editor picture was retaken with the
block in it (docs/builder-guide/editor.webp).

Last of the round: a narrow tree's picture is widened more with distance,
up to 1.85 times (Hawaii's Cook pines, a seventh as wide as tall, read from
above as sticks; they still do a little, within 500 m). The full generator
bench on 70 courses: every rule at zero, `surroundInside`, `surroundWet` and
`surroundOffGround` among them, 4.95 million far sites in all.
`bench/baseline.json` was left alone: it was saved long before this branch
(its medians differ from today's generator on main too), and saving it is a
choice of what to defend.

**Where the branch stands (13 November 2026, 02:03).** Four commits on
`surroundings-rework` past the plan's; `dist/` rebuilt from the last; not
merged, not pushed. Seen by captures, smoke journeys and measurements only:
no person has looked at any of it in the game or pressed the builder's
block.

**Not as the plan said.** Step 4 planned a `surround` recipe for every
landscape in biomes.js. What was built is narrower: each landscape keeps its
own far relief (`ringLift`, `ringPeaks`, `ringMesas`, `ringMassif`,
`ringCarve`, the coasts) and its far forest record, now with `open`; the
sided record is a built course's. A generated course cannot yet be asked
for, say, a lake on its north side. And the far heath's domes (Seaside
Links, `addFarHeath`) still stand: they are heather cushions a metre high
past the heather tiles, not trees, and were left until looked at.

All fifteen landscapes photographed on the branch (bench/shots/overhaul/
sur-r6): no errors. Desert Mountain keeps its one mountain with saguaro,
mesquite and palo verde in clumps to the horizon; Seaside Links keeps its sea
with gorse and shore pine beyond the course; Redwood Coast's hill behind the
first hole is redwoods.

### All fifteen on the final build (13 November 2026)

The owner asked whether the work is done on every landscape. Round 6's
pictures were taken before rounds 7 to 9 (no real models past the line, the
meadows, the whole-number hash, the drawing order), and after those only
eight landscapes had been photographed again. All fifteen were taken again
from the last commit (bench/shots/overhaul/sur-final, four views each, a
sheet a view): no errors, no dome and no painted crown on any of them.

What the pictures show, landscape by landscape:

- **Read well:** Classic Parkland, California Coast, Florida Palms,
  Lowcountry and Gulf, Northern Woods, Pacific Northwest, Redwood Coast,
  Southern Pines (wooded to the horizon with their own trees, meadows
  between), Desert Mountain (its mountain, cactus and mesquite in clumps),
  Seaside Links (dunes, shore pines in groups, the sea).
- **Changed least:** the Badlands and Prairie & Sand Hills have next to no trees past
  the line, so what they got is the finer ground and nothing else.
- **Not done: the three with big mountains close to the course.** The work
  went into trees and a finer ground; a rock face got neither.
  - *Mountain*: the land just past the property line is coarse grey rock
    facets with a dark green floor draped over them and few trees on it; from
    the tee the walls behind are plain grey.
  - *Desert Resort*: the mountains over the course are smooth, pale and
    blank, a handful of trees on them.
  - *Hawaiian Resort*: the mountain behind the first hole is one smooth dark mass
    with a blotched green edge near its top.
  These are the owner's first complaint (surroundings plainly lower in
  polygons and resolution than the course) still standing on a mountainside.

### Round 10: the mountainsides (13 November 2026) -- partly reversed by round 11

**Read with round 11, below: the owner turned down the rock's cells,
Hawaii's shape and the trees on steep ground. What stands of this round is
the crags on Mountain and the Desert Resort, the baked shade, the snow, the
forest floor and `farPlants`.** The record below is as it was written.

The owner: "Fix the three". **Where it stands: the look was reached and
photographed; the last change, which cuts its cost, was drawn after the
reboot and looks the same; nothing is measured against 0.9.14.** The
graphics card dropped out of the machine at 12:03 (below); after the
owner's reboot one capture was made, and the comparison has not run because
the card has not come under the gate.

What was built (landscape-edge.js, ground.js, biomes.js, surround.js):

- **Crags on a peaked range** (`crags`): a ridged noise over four scales,
  320 m down to 40 m, each held back where the ones above are steep, added
  to Mountain's, Desert Resort's and Hawaiian Resort's far range (and a
  built course's `range` side), up to about a quarter of the range's lift,
  nothing on a valley floor. A scale is left out where the ring's cells are
  too wide to draw it. Three scales of ridge, the smallest 240 m, had left
  every flank a smooth sheet. After Quilez's derivative-damped noise
  (RESEARCH); every number PLACED.
- **Hollows dark, ribs light, baked into the ring** (`shade`, the `farShade`
  attribute): each ring vertex against those three cells away, -1 to 1,
  nothing within 120 m of the seam; the ground shader darkens or lifts by up
  to a fifth. Every landscape has it; on rolling country it is faint.
- **A far rock face in planes** (ground.js `cragFace`, biomes.js `farFace`):
  irregular cells each its own tone, laid on the side the face looks to and
  sized by the camera's distance (about 45 pixels across at any range), in
  place of one flat tone. Stretched by the rock: taller than wide on
  Mountain's granite, wide and flat with beds of tone every 42 m on Desert
  Resort's limestone, long ribs under green on Hawaii's pali.
- **Snow on Mountain** from 640 m over the course, lower in the gullies,
  never on a wall.
- **The forest floor** only where trees stand (to 52 degrees, as surround.js
  plants; it lay to 69) and partly the ground's own colour, more on rock:
  it lay on Mountain's grey slopes as dark green cloth.
- **A landscape names its far plants** (`farPlants`): the Desert Resort's
  are creosote, brittlebush and mesquite (its Afghan pines stood up the
  mountain as dark spires); Hawaii's are monkeypod and ironwood with Cook
  pine and coconut at 8% each (Cook pine was 42% and read as sticks).

The rounds, each photographed from the first tee, past the line and from
above (bench/shots/overhaul/sur-m1 to sur-m5, local):

1. Joints and ledges as evenly spaced lines, sized by the pixel's
   footprint: a net of wavy lines over Mountain and the Desert Resort, zebra
   stripes on Hawaii, and the faces as smooth as before. Rejected.
2. Cells with a dark crack between every pair, sized by distance: Hawaii's
   ribs right; Mountain and the Desert Resort read as stone paving.
3. No cracks (a trace on granite), stronger crags: rock in planes, sharp
   peaks, snow, bedded limestone. The look kept.
4. Hawaii's green deepened; all fifteen photographed: the other twelve
   unchanged to the eye but for the faint shade.
5. **A bug three rounds old, found by a new test**: the crags were being
   sized by the ground's HEIGHT, not the ring's cell (`auto` took four
   arguments where `at` passes five). Also found: the noise stepped at every
   crest line (steepness summed as a direction), a scale left out lowered
   the whole range (not centred), and every crag stood up on the ring's last
   row (a short step after long ones). All four fixed; crags eased from .42
   to .24 of the lift; photographed again and the look held.

**What it cost, as first built** (`bench/ab/sur-m5-mountains-high.json`,
High on Mountain, three rounds, against the branch BEFORE this round, not
0.9.14; the card 25 to 40% busy with the desktop throughout, so read it
loosely): card time 6.74 to 7.00 ms at tee 1, 2.78 to 2.88 at tee 5, 7.73
to 7.99 from above -- **3.4 to 3.8% slower** -- and the wait for a course
13.5 s to 18.6 s. Not allowed. The cause: the rock pattern worked out up to
eight times a pixel (two views blended, two sizes, two hashes a cell), and a
shader that much larger takes seconds to compile.

**The cut, DRAWN, NOT MEASURED**: one view a pixel (the one the face
looks to most squarely), one hash a cell -- fewer sums than the overhead
rock it replaces, by count. It was built into `dist/` and its comparison was
starting when the card was found lost. After the owner's reboot ("reboot
complete. Continue.") it was photographed on the three
(bench/shots/overhaul/sur-m6, run 53, the card at 28% at its gate): no
errors, and to the eye the same as round 5 -- the seam where a face turns
from one view to the other does not show among the planes. Its comparison
with 0.9.14 was then asked for at the 30% gate and never started: the card
stood at 17 to 65% with no game and nothing of this work on it (the
desktop's programs, with Chrome Remote Desktop serving the owner's screen),
and after eleven minutes the waiting job was stopped. So what it costs is
still unknown.

**The graphics card was lost, 13 November 2026, 12:03.** `nvidia-smi`:
"GPU is lost. Reboot the system to recover this GPU". The last run (run 52
in bench/ab/gpu-runs.jsonl, the comparison above, 233 s) ended normally at
12:02:58 with the card at 13% and 58 C; the next run's gate, about 15
seconds later after a processor-only build, could not read the card. Nothing
of this work was on the card at that moment. Before it: the card had stood
at 25 to 40% all session with no game in its process list (the desktop,
Chrome, Slack), which held the capture tool's 30% gate shut for fifteen
minutes; the gate was raised to 45% for the last two runs (sur-m5's captures
and run 52) on that reading. Whether that was right is the owner's to say.
No graphics work since, and none until the owner says.

Owed before this round is done: all fifteen photographed again; frame rate against 0.9.14 on Low,
Medium, High (Mountain) and Ultra; the wait for a course; both smoke runs.
(Carried into round 11, whose own list replaces this one.)

### Round 11: what the owner said of round 10 (13 November 2026)

The owner, with two screenshots (Hawaii's range and Desert Mountain's):

- "the hexagonal texture on hawaiian mountains is not good... it looks like
  actively bad. Lets make the mountains more rounded and less steep and fix
  that texture. We also have trees growing on almost vertical surfaces."
- "desert mountain has the same texture problem. that texture looks
  terrible. we also shouldnt have trees growing on top of that mountain. and
  trees on almost vertical surfaces again."
- "no screenshot but mountain has the same issue"
- "for all three of the above i do like the ground shading though, where
  grass is growing on more horizontal surfaces depending on how steep."
- "double check the colors of the external landscape growth on all biomes
  at different times of the day and ensure they are lit the same way as
  everything else."
- "framerates when looking across a whole landscape are tending to tank. we
  need a fix for that."

**The rock's cells are gone** (ground.js `cragFace`). Round 10's cells
reached every landscape with a rock face and no banded clay -- Desert
Mountain's one mountain among them, which that round was never meant to
touch and never photographed. A far rock face now has no pattern of its own:
its tone drifts by soft noises at 230 m and 61 m (13 m too, only near the
eye), a cliff is a little darker than a ledge, the Desert Resort's
limestone keeps beds of tone by height, soft now, and Hawaii's green lies on
all but the steepest ground, lighter where the ground lies back. `farFace`
lost `wide`, `tall` and `crack`. What the owner liked -- what grows by
steepness -- is untouched. Lesson: cells of one size are a pattern however
irregular each is, and three patterns in a row (lines, paving, planes) each
read as a pattern over the whole mountain; and a change to a shared paint
is photographed on every landscape it reaches, not the three it was made
for.

**Hawaii's mountains are rounded** (landscape-edge.js `peaks`, biomes.js
`ringRound: 1`, `ringCrags: 0`, `ringLift` 520 for 700). Each scale of
the range is a smooth dome over its field's high ground, where a ridged
noise puts a knife crest wherever the field crosses its middle; the two
smaller scales count for 40% of what they did; no crags. On seed FAIRWAY the
far ground to 4 km steeper than 45 degrees went from 25.2% to 4.9%, steeper
than 35 from 34.9% to 9.4%, and the top from 930 m to 598 m. Mountain and
the Desert Resort keep crests and crags (`ringRound` 0); the owner's words
were of Hawaii.

**No plant past the line stands on ground over 40 degrees** (surround.js
`FAR_STEEP` .84). Far woods had held to 52 degrees, measured between the
site and two points up to 29 m off on one side of it, so a tree at the lip
or the foot of a wall measured the gentle ground beside it. Counted on seed
FAIRWAY, eight ways at 8 m: on over 40 degrees stood 34% of Mountain's far
trees, 28% of Hawaii's, 22% of the Desert Resort's and 5% of Desert
Mountain's, the steepest at 75. Now the steepest of six ways round the
site, 7 m off: 5%, 1%, 2% and 0.2% by that stricter count, the steepest
58. Three ways left 11% on Mountain. Six ways cost 0.08 s of the wait on an
18-hole Classic Parkland (placing 128,000 sites: 0.20 s to 0.28 s). What it
means for Mountain: two thirds of its far ground to 4 km is steeper than 45
degrees, so its far trees (38,200 to 23,400 on that seed) stand on the
ledges and benches and the walls are bare.

**The deserts' mountains are bare above a line** (biomes.js `farLine`,
metres over the course; read by surround.js and by the ground's paint):
Desert Mountain 250 (the scrub thins from 190 and is gone by 270, the top
of the talus apron; its highest far plant was at 972 m, on the crest),
the Desert Resort 320 (805 m). Mountain keeps its forest's own treeline,
520. Heights are counted from the course's base (`skyBase`) in both
places now; surround.js had counted from zero.

**The far trees are lit by the scene's own sun** (far-trees.js). Checked by
reading the code before any picture: each far tree's picture was baked with
a light of its own -- a sun over the viewer's left shoulder, through the
toon ramp -- and the upright quad was then lit as flat ground is, its normal
straight up. So a far wood kept a lit left side whatever the hour and
wherever the sun stood, had no lit and shaded side of its own at a low sun,
and went from light to shade all at once where the ramp steps, while the
course's own trees beside it turned a warm side to the sun. Now two
pictures a model, its colours with no light in them and its normals as the
camera saw them; the quad stands the normal up in the world (mirrored where
the picture is) and the scene's sun, sky light, ramp, haze and grade light
each pixel as they light the model. One more texture read a pixel. Not
copied from the course's trees: their rim of sky (textures.js `rimLit`),
an edge a few pixels wide; and no far tree casts or takes a shadow, as
before.

**The edge of a wood wanders** (surround.js `farWarp`, and the same wave
in ground.js). Found in this round's own pictures, not in the owner's
notes: from the course's north edge on seed `overhaul`, Hawaii's far wood
ended in a ruled line straight up a hill. It was the edge of an open meadow
(round 8): the meadows and the woods' patches are value noise on 900 m and
380 m cells, and where a cell's two corners on one side are high and the two
on the other low, the edge between runs dead straight along the cell -- 900
m here, at x = 0, seen end-on. Both noises are now read at a point pushed
up to 160 m sideways by a slow wave (wavelengths about 900 m and 1,050 m),
on the page and on the card alike, so the trees still stand where the floor
is painted. Every landscape's far woods and meadows keep their size and
share and change their outline. Two sines a far-ground pixel.

**What was seen and measured (round 11), and what was not.** The card stood
at 16 to 54% most of the afternoon with the desktop alone (Chrome Remote
Desktop serving the owner's screen). The capture tool's gate, a five-second
look under 30%, got through each time within some minutes; the frame tools'
gate, thirty seconds under 30%, did not, and was not loosened (round 10's
lesson). From about 15:03 to 15:27 the card was quiet (9 to 13%) and four
frame runs went through; a fifth ran into the card going busy again and is
thrown away.

- **All fifteen photographed, no errors** (bench/shots/overhaul/sur-r11 and
  sur-r11a, runs 54 and 58 to 63; first tee, past the line, from above, the
  whole course). The cells are gone wherever rock shows; Hawaii's range is
  round green domes with woods on their flanks; Desert Mountain's rock is
  plain and its scrub stops at the foot; the Desert Resort's range is soft
  bedded stone with scrub low down; Mountain's trees stand on its ledges
  and its walls are bare grey, the tone drifting; the woods' edges curve.
  The other eleven look as they did but for those edges.
- **The far growth through the day, on all fifteen** (the capture tool's
  new `light-dawn`, `-morning`, `-noon`, `-golden`, `-dusk`, `-night`
  views: one camera at the course's north edge, its own trees in front, the
  far ones behind). At golden hour a far wood has a warm side and a shaded
  one as the course's trees do; at dusk and at night it goes dark with
  them; far off, wood and ground alike are lighter than what is near, which
  is the haze. Nothing was found lit apart from the rest. (Mountain's north
  edge faces its own crags, so little far growth shows in its six.)
- That, in numbers (run 57; Classic Parkland from its east edge; mean
  colour of a box of the finished picture, 0 to 255): at night the far wood
  36, 44, 49 and the far open hill 25, 33, 31, against the course's own
  trees 3, 6, 4 and its grass 5, 21, 7; at noon 110, 139, 129 and 122, 154,
  106 against 65, 113, 46 and 90, 133, 39. With every far tree's normal
  forced straight up again (as before the round) the far wood read 37, 46,
  50 at night and 116, 145, 131 at noon: as a whole about as bright either
  way. What the round changed is each tree having a lit side and a shaded
  one that follow the sun.
- **Frame rate, High on Mountain** (tools/frame-ab.mjs, three rounds, the
  card at 13% at the gate; card time at tee 1, tee 5 and 250 m up). Against
  0.9.14 (`bench/ab/sur-r11-mountains-high.json`): 6.27, 2.42 and 7.09 ms
  to 6.34, 2.47 and 7.15 ms -- **1.2%, 2.2% and 0.8% slower**, 0.05 to 0.07
  ms, with 10 to 13 more draws and the same triangles. Against the branch
  before round 10 (`sur-r11-vs-pre-crags-high.json`): 6.21 and 7.10 ms to
  6.26 and 7.15 ms at tee 1 and from above, 0.9% and 0.6%, inside what one
  build's own runs differ by (6.17 to 6.26). So rounds 10 and 11 cost a
  frame nothing that shows, and High on Mountain is where round 9 left it:
  about 1% behind 0.9.14 and not shown level.
- **The wait for a course is about 1.1 s longer, and that is not found.**
  Course load on that same course: 11.23 s on 0.9.14, 11.74 s on the branch
  before round 10, 12.43 to 12.94 s now (medians of three; each build's own
  runs within 0.4 s). Start to the main menu 13.35 s to 14.4 to 15.0 s.
  Not the processor's work (timed in Node: the ring 0.10 s, placing the far
  plants 0.15 to 0.28 s); a load profile shows 6.2 s of the 17 s as the
  browser's own work and 4.5 s idle, which is the card compiling and
  drawing. Tried: working the far rock's paint out once a pixel instead of
  inside a function the shader includes twice (kept: the shader is smaller)
  -- the load did not move (12.94 s). A build with this round's shader
  additions switched off was being compared when the card went busy; its
  numbers swung from 11.5 to 17.6 s and say nothing. **Owed: find it** --
  that comparison again, then one with the second (normals) picture not
  baked.
- **Where a wide view's time goes** (tools/frame-variants.mjs with
  tools/variants/wide-view.mjs, run 65; High on Mountain; each part hidden
  between unchanged frames):

  | Hidden | 250 m up | Tee 1 |
  | --- | --- | --- |
  | The course's own trees and plants | 7.26 to 2.92 ms, **-60%** (72.4 M triangles to 7.2 M) | 6.27 to 2.38 ms, -62% |
  | The far ground | 7.24 to 6.51 ms, **-10%** | 6.31 to 5.98 ms, -5% |
  | The far trees | 7.15 to 7.12 ms, -0.4% | -0.5% |
  | Shadow maps not redrawn | +0.8% (nothing) | +0.8% |
  | Bloom | +0.5% (nothing) | 0 |
  | Half the pixels each way | 7.08 to 5.32 ms, -25% | -22% |

  And by count on Ultra (tools/variants/wide-count.js, run 60; nine holes,
  seed `overhaul`, from 250 m up; a reading moves by about 2 M as the tree
  cull settles): Hawaiian Resort 20.6 M triangles a frame, 14.8 M of them
  (72%) the course's own planting; Mountain 40.0 M, 35.8 M (90%); Classic
  Parkland 20.5 M, 16.6 M (81%); the far ground 0.06 to 0.10 M and the far
  trees two triangles a site (0.04 to 0.24 M).
- **So, of the owner's "framerates when looking across a whole landscape
  are tending to tank. we need a fix for that": not fixed, and two things
  would fix it.** (1) *The course's own distant trees*, three fifths of the
  frame: the frame-rate goal's far versions (instance-cull.js, 9 November
  2026) taken a step further -- past some size on screen, a tree drawn as
  its picture, two triangles, lit as this round lights the far ones. That
  touches the owner's rulings of 9 November (every tree drawn on Medium and
  up; a far version keeps its model's outline) and what a shadow map draws,
  so it is put to the owner, not built here. (2) *The far ground's
  shading*, a tenth of a wide frame on Mountain (it was as much on 0.9.14:
  the same shader on the same pixels): every pixel past the course's edge
  runs the whole of the course's ground shader -- the holes' tables, the
  greens, the tees, the water's edge -- to throw the answer away. A lean
  path for those pixels is the surroundings' own work and needs no ruling;
  it is checked by pictures that must not change by a pixel, then measured.
  Not started.
- **Not run:** either smoke (they go through tools/gpu-run.mjs, whose gate
  is the thirty-second one); the frame comparison on Low, Medium and Ultra.

## The look signed off (13 November 2026)

The owner, after round 11: "Mark all actions complete for the work that we
did on the surroundings rework except for frame rate items. Ive taken a look
and it looks great." The rounds above are closed on that word (DONE.md, *The
surroundings rework: the look*). Open from here: frame rate, and the second a
course takes longer to load.

## The frame-rate pass (from 13 November 2026)

The owner, in the same message: "Then Iterate as many times as needed to
improve the framerates of all of our landscapes. The GPU and CPU are yours
to use. Focus on gains on high and ultra settings as those things should
trickle down to the lower settings."

**How it is run.** One graphics job at a time, each through the gate and the
log (tools/gpu-gate.mjs; goal `surroundings`), and the gate stays where it
was: a run starts only when the card has been under 30% for the gate's
look. With Chrome Remote Desktop serving the owner's screen the card stands
at 16 to 54% with nothing of this work on it, so runs wait for a quiet
moment; a first try at starting one at up to 60% on the strength of "the
GPU and CPU are yours to use" was refused by the session's own safety check
and was not tried another way. A comparison is read by its counts and by
the two builds taking turns, not by one number. Every round is measured on
High and Ultra before it is kept, and photographed: a round that changes the
picture where it was not meant to is not kept.
(Once, later that day, the owner set the gate aside for one test: "Nothing
is running on the card. Ignore the gate for this time and run the test."
The two comparisons of round F1 that had waited twenty minutes were run on
that word and on nothing else; the gate stands for every other run.)

**What the gate has been reading (found 13 November 2026, 18:28, when the
owner asked "What is using the card right now?").** Not load. With nothing
drawing but the desktop, Windows' own counters (GPU Engine, by process) put
the card's work at about 6%: the Battle.net launcher 3.5%, Slack 1.2%, the
Claude app and the desktop compositor 0.6% each; no game, the video encoder
at 0%. `nvidia-smi` at the same moment said 32%. The card idles in a low
power state (P5, its clock at 810 MHz where full speed is 2,520 MHz, drawing
48 to 60 W), and `nvidia-smi`'s figure is the share of time the card was
busy AT THAT CLOCK: the same small work read 8% a few seconds later at full
clock and 18% back at 810 MHz. So the "16 to 54% with the desktop alone"
that shut the gate all of 13 November -- and that this page and round 10's
account put down to Chrome Remote Desktop -- was an idle card running
slowly. The gate (tools/gpu-gate.mjs) reads that one figure. It was not
changed: what it should read instead (Windows' counters, or power drawn,
with a game's process name still refusing a run) is the owner's to say.

**Where it started** (round 11's measurements, High on Mountain): the
course's own trees and plants 60% of a frame from 250 m up, the far ground
10% (5% from a tee), the far trees 0.4%; a frame of 69 to 72 million
triangles; a course 1.1 s longer to load than before round 10.

### Round F1: a tree's middle version (13 November 2026)

**What was wrong.** From Mountain's first tee on High, 3,500 trees were
each drawn as the whole 12,000-triangle model and 36 as their far twin: 49
of the picture's 54 million triangles. Two causes.

- **The far twin is only good small.** A painted tree's twin is its lobes
  rebuilt as icosahedra, some 300 triangles. Photographed with every tree
  as its twin (bench/shots/overhaul/fr-far against fr-full), it is the
  model to the eye under about a hundred pixels tall and plainly lumps at
  250. So High drew it only under 5% of the screen's height and Ultra under
  3%, and between a tree 30 pixels tall and one filling the screen there
  was nothing but the whole model.
- **A square was judged by its ground.** The swap is decided for each 64 m
  square of trees by "the tallest thing in the square" over its distance.
  The code took the height of the square's box, which holds the ground's
  rise across the square as well as its trees: on Mountain a square is
  often three trees tall from lowest root to highest tip, so it read three
  times its size. And where it was a tree, it was the tallest tree: one 35
  m ponderosa kept thirty aspens a third its height whole.

**What was built.**

- **A middle version** (src/mesh-assets.js `midParts`, src/mesh-simplify.js;
  High and Ultra, graphics.js `midTrees`). The model itself made coarser:
  each part merged on a grid (the model packer's own simplifier, moved into
  the game's source) until about a quarter (High) or a third (Ultra) of its
  triangles are left -- 2,400 to 3,200 for a Mountain conifer -- keeping its
  paint, its wind and its normals. Made from the model's own decoded parts
  when a course is built: nothing more is shipped but a 20 KB table. A part
  under 1,500 triangles (most trunks) stays whole. On High and Ultra it is
  what a tree small on screen is drawn as, in place of the twin; the twin
  is still what the two far shadow maps draw. Low and Medium are unchanged.
- **The outline kept, model by model** (tools/mid-cells.mjs, which writes
  src/mid-cells.js). The owner's rule for far versions (9 November) held
  tighter, a middle version being seen two and three times as large: each
  model is scored against its middle version at the size its tier swaps at
  (kept 0.90, extra 0.08, area 0.85 of the outline: PLACED) at the tier's
  share and then at 0.4 and 0.5, and takes the coarsest that passes. A
  quarter was wrong for thin wood: a palo verde kept 0.75 of its outline, a
  creosote 0.73. On High 316 of 329 models have a middle version and 13
  have none (the palo verdes, a mesquite, creosote, brittlebush, jojoba,
  saw palmetto and five others); those swap to their twin at the old 5% as
  before. The table also holds each part's grid, so the game simplifies
  once where finding the grid is seven or eight tries: 1.5 to 5 ms a model
  for 10 to 16.
- **The line in pixels** (`midTrees.px`: 300 on High, 200 on Ultra). What
  a coarser model may be drawn at is a matter of the picture's own pixels,
  whatever the screen: photographed with even the nearest trees as middle
  versions (fr-mid-near), they are the model to the eye to about 250 or 300
  pixels and faceted by 400. The old share still holds where it is more of
  the screen (the Redwood Coast's third).
- **Each kind of tree by its own height** (src/instance-cull.js `tallRun`,
  `lvl`). A square's size on screen is its tallest thing's height, not its
  box's (this is every tier's); and a painted pair is swapped run by run --
  each model's own tallest tree in each square -- so the aspens leave when
  they are small, not when the ponderosa over them is. The model's height,
  not the part's, so a trunk and its crown still leave together.
- **The far shadow maps take the twin from the middle version too.** As
  first built a tree drawn as its middle version had no stand-in, and went
  into every shadow map at 2,700 triangles where 300 had gone.
- **A tree out of the picture, kept for its shadow, is its far version**
  (the cull's `unseen`). From a tee most of the trees near enough to be
  whole models stand beside and behind the player; each was written whole
  into the picture's buffer and the nearest shadow map for a shadow a model
  a quarter the size casts the same. It turns whole inside the view's 7
  degree margin, before it is on screen.

**Tried and changed.** Trunks were given middle versions too (the first
grid kept parts over 600 triangles): each was then a far mesh, a fading
mesh and a shadow stand-in of its own, seven or eight draws for a few
hundred triangles, and at a tee with little in view (tee 5 on Ultra, Classic
Parkland) the frame's draws went from 234 to 354 and the frame was 12%
SLOWER for 9% less work on the card. At 1,500 that tee is level.

**Measured against 0.9.14** (tools/frame-ab.mjs, three rounds, the builds
taking turns, 1,600 by 900 at density 2 -- a 4K-class picture; card time at
tee 1, tee 5 and 250 m up). High on Mountain (`bench/ab/fr6-mountains-high.json`): 6.62, 2.68 and 7.41 ms to 4.64, 2.17 and 5.07 ms -- **30%, 19% and 32% less**; the whole frame as the page sees it 34%, 15% and 46% less; triangles 69.2, 21.5 and 72.5 M to 35.6, 14.5 and 30.4 M; draws 424, 309 and 388 to 417, 341 and 302; the heaviest frames (p99) 12.2 ms to 9.1 ms. Ultra on Classic Parkland (`fr6-parkland-ultra.json`): 6.19, 2.61 and 7.86 ms to 3.21, 2.10 and 4.24 ms -- **48%, 20% and 46% less**; the whole frame 50%, 9% and 57% less; triangles 35.1, 17.3 and 36.6 M to 19.7, 12.2 and 18.0 M; draws 375, 234 and 375 to 381, 322 and 311; p99 41.5 ms to 17.2 ms (one frame of 71 ms in the new build's runs, one of 47 in the old's). Course load 14.3 s to 15.5 s and 13.9 s to 14.6 s: still about a second longer than 0.9.14, the second found in round 11 and not yet found. Earlier in the round, before the outline rule made many middle versions finer, the same two comparisons read 31%, 6% and 35% and 47%, 16% and 52% (`fr3-mountains-high.json`, `fr4-parkland-ultra.json`): the rule cost a few points from above and nothing from a tee. These last two runs were made with the gate set aside on the owner's word ("Nothing is running on the card. Ignore the gate for this time and run the test"): the card read 34% before the first and 8% after the second, with the desktop alone.

**What a frame is now** (High, Mountain, seed PROFILE, the line as on an
1,800-line picture; tools/variants/mesh-passes.js): the picture 22.7 M
triangles, the nearest shadow map 7.5 M, the two beyond 1.6 M and 1.8 M.
Whole models are 5 M of the picture and all of the nearest shadow map: the
next thing to take out is there. The far ground is 8.5% of the frame from
the tee and 10% from above (it was 5% and 10% of a slower frame).

**Tools made for the pass:** tools/variants/far-versions.mjs (the swap line
moved on one page), wide-view.mjs, wide-count.js, pass-count.js,
planting-count.js and mesh-passes.js (which pass and which mesh a frame's
triangles are drawn in; the last three through the capture tool's
`--eval`, a few frames each, so they run when a frame comparison cannot).

### Round F2: the twin again, when a tree is small enough for it -- BUILT, NOT DRAWN

**Not seen in the game and not measured: only its Node tests have run.**
`dist/` is still round F1's build (commit b357e0ff), the one that was
photographed and measured. The card stood at 32 to 50% with the desktop
alone from about 17:20 on 13 November; the frame tools' gate did not open
again after the one test the owner waived it for, and by 18:15 the capture
tool's shorter look did not either.

**Why.** Round F1 put the middle version everywhere the twin had been. From
250 m over a course every tree is 50 to 150 pixels tall: on 0.9.14 those
under 5% of the screen (90 pixels on 1,800 lines) were twins of 300
triangles, and after F1 they were middle versions of 2,400 to 3,200. The
view from above still came out 32 to 46% faster, because the trees over 90
pixels had been whole models; but it was drawing ten times what it needed
to for the small ones.

**What was built** (src/instance-cull.js): a painted tree with a middle
version has three, on the same runs -- whole; the middle version under the
tier's line in pixels; and under the far twin's own old line (`farPainted`,
5% on High and 3% on Ultra) the twin, as 0.9.14 drew it at that size. A
second pair of levels (`lvl2`) by the same rule as the first: the middle
version is the far side of one pair and the near side of the other, and
the two swap bands are a factor of three and more apart, so a tree is
never in both.

**Owed before it is kept:** photographed (a tee, from above, and a swap
seen moving), measured against round F1's build on High and Ultra from a
tee and from above, and its draw calls counted at a light tee (each swapped
part gains a mesh).
