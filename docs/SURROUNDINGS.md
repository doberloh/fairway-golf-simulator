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

### Round 10: the mountainsides (13 November 2026) -- UNFINISHED: drawn, not measured

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
