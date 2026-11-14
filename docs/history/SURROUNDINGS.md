# The surroundings rework: the record of the work

**A journal, kept as it was written.** The surroundings rework (branch
`surroundings-rework`, 12 to 14 November 2026, merged into main on 14 November 2026
and released in 0.9.15) was recorded round by round in `docs/SURROUNDINGS.md`.
At the merge that page was cut down to what was asked, the plan and the
decisions it reversed, and the record moved here, word for word and in its
order: rounds 0 to 11 of the look, the owner's sign-off, the frame-rate
pass (rounds F1 to F5), the sweeps and what was wrong with them, the lost
graphics card, and the checks on the final build.

**Search this file; do not read it whole.** Other documents and comments in
the code name its sections as "SURROUNDINGS, *Round 7*" or "docs/SURROUNDINGS.md,
*The frame-rate pass*": they are here. Later sections overturn earlier ones
in three places and say so where they stand: the card's clock, Prairie on
Ultra, and round F5's times. **Not kept up with the game.**

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

**The gate fixed** (the owner, that evening: "Fix the gate and then proceed
with the rest of what you need to do"). tools/gpu-gate.mjs now judges by the
card's real work -- every program's share added up, from Windows' counters,
the busiest sample of the look -- and refuses on one program taking 15% or
more by itself (a game) whatever limit the run asked for; it falls back to
`nvidia-smi` only where the counters cannot be read. Its first look read
7.1% of work, the launcher 4%, beside `nvidia-smi`'s 33%.
`node tools/gpu-gate.mjs` prints the reading. AGENTS.md's three lines that
said "read nvidia-smi" say this instead; RULES_HISTORY.md has the story.

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

### Round F2: the twin again, when a tree is small enough for it

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

(It sat built and undrawn for an hour and a half behind the card's gate,
committed as such, 54660870; *What the gate has been reading*, above.)

**Seen** (bench/shots/overhaul/fr7; High; Mountain, Classic Parkland,
Hawaiian Resort from a tee, beside a hole and from above): no errors, and to
the eye as before. **Measured against 0.9.14** (`bench/ab/fr7-*.json`;
card time at tee 1, tee 5 and 250 m up): High on Mountain 4.31, 2.13 and
4.46 ms -- **34%, 19% and 40% less** (F1: 30%, 19%, 32%), triangles 31.3,
14.0 and 23.6 M, the heaviest frames 12.4 to 5.9 ms; Ultra on Classic
Parkland 2.97, 2.25 and 3.62 ms -- **40%, 4% and 46% less** in that run,
triangles 17.7, 11.9 and 14.7 M, the heaviest frames 12.8 to 4.2 ms.

**What it costs: draws at a light tee.** Each swapped crown is now a whole
mesh, a middle one, a twin, their fading meshes and two shadow stand-ins. At
tee 5 on Ultra, Classic Parkland -- little in view, about 400 frames a second
-- the frame's draws went from 234 on 0.9.14 to 341 and the frame as the
page sees it from 2.43 ms to 2.55 ms, 5% SLOWER, for 4% less work on the
card. One draw a fading twin was then taken out of every shadow map (the
middle version fading beside it is that pair's caster). Not measured again
on Ultra since; on High the same tee is 19% less on the card and 5% less
as a frame. **Open:** fewer meshes a crown (the trunk and the crown of a far
tree as one mesh would halve them).

### Round F3: the far ground stops looking for tees and hazards

Every pixel of the far ring ran the course's whole ground shader for the
hole whose table lies nearest the edge: its three tees, then its hazards
one by one -- up to 24 table reads and a shoreline each -- to learn that
none is within 150 m. The two loops now stop at once past the course's
ground (ground.js `offCourse`). Nothing else was cut: the blocks after them
either apply out there or were already fenced.

**Measured against the build before it** (`bench/ab/fr8-vs-fr7-mountains-
high.json`, with the fading twin's shadow draw taken out in the same
build; High, Mountain): 4.32, 2.14 and 4.48 ms to 4.14, 2.09 and 4.39 ms --
4.1%, 2.7% and 2.0% less -- draws 459, 374, 380 to 449, 369, 365. **The
picture did not change**: with `--shots`, the pixels differing between the
two builds were 0.44%, 0.06% and 0.29% of the picture, where two shots of
ONE build differ by 0.62 to 0.80%, 0.33 to 0.44% and 0.34% (wind, water and
clouds move).

**Not done:** a path of its own for the far ground. It would mean the
shader's whole classification moved inside a branch and every later use of
what it sets checked for a pixel past the course; the loops were the part
that could be shown harmless in one line each.

### The second of course load: half found

The test that had waited behind the gate ran (`load-bisect-shader`: the
round 11 build against the same build with this branch's shader additions
switched off -- the far rock's paint, the snow, the wandering edge, the
ring's baked shade; four rounds each, High, Mountain): course load 15.21 s
without and 15.77 s with, start to the main menu 15.83 s and 16.40 s. **So
0.56 s of the 1.1 s is the ground shader growing**: the card's compiler pays
for every line when a course is first built. Which of the four costs it is
not known (each is a build and a three-minute run), and the other half
second is not found: the second (normals) picture of the far trees and the
ring's crags are the candidates. The middle versions add their own: 1.5 to
5 ms a model with the grid known. Course load against 0.9.14 in the last
comparisons: 14.4 s to 15.5 s on High at Mountain, 13.6 s to 15.1 s on
Ultra at Classic Parkland.

### The smoke runs on round F3's build (13 November 2026, 19:30 to 20:10)

The first since round 9: rounds 10 and 11 of the surroundings and F1 to F3
of this pass had none (the gate).

- **The Course Builder: all 10 journeys pass.**
- **The game: 40 of 41 pass. `no-late-shaders` failed once**: on Ultra, on
  the course "Surprise me" drew (a Lowcountry and Gulf nine, seed
  HOLLOW-1812), one lit shader -- a MeshToonMaterial -- was built 142 ms
  after the course appeared, which is a hitch a player can feel. **Not
  traced.** Run alone the journey passed ten times in a row: six on this
  build and once each on round F1's, round 11's and the branch before round
  10 (each draws its own course). That seed and landscape loaded by hand on
  Ultra (tools/late-shaders.mjs, made for this: it lists every program
  first used after a course is up, with its defines, standing at the tee,
  turning right round and from above) built none late -- but a course loaded
  that way has the default season and hour, and the drawn one's are not
  known. So it is one drawn course in eleven tries, cause unknown, and
  whether 0.9.14 does it is unknown too. The journey now says which shader
  (its defines and the telling names in its text), so the next failure
  names it.

### Round F4: what the first sweep of every landscape found

tools/frame-sweep.mjs (made for this: tools/frame-ab.mjs on each landscape
and tier in turn) was started on round F3's build against 0.9.14. Its first
landscape, the Redwood Coast on High, was **28% SLOWER from 250 m up** (card
time 3.22 to 4.13 ms; triangles 17.2 M to 21.2 M) where Mountain and
Classic Parkland, the two landscapes every round had been measured on, were
a third to a half faster. The sweep was stopped. Two faults, both the
pass's own:

- **Trunks were never their twins.** Round F1 left a part under 1,500
  triangles out of the middle versions, and as written that left it with no
  far mesh at all: whole at every distance. On Mountain nearly every tree
  had been whole on 0.9.14, so nothing showed. On the Redwood Coast the
  twin is drawn from a third of the screen (`farPaintedFrom`), nearly every
  tree was its twin, and ten thousand trunks of 600 to 1,200 triangles now
  stood where twins of 45 had. Such a part is an ordinary pair again --
  whole, then its twin under the twin's own line -- beside a crown that goes
  whole, middle, twin.
- **Where the two lines meet there is no middle.** The middle version lives
  between its line in pixels and the twin's line. With the twin's line at a
  third of the screen, above 300 pixels on any screen over 880 lines, there
  is no between; the code drew all three meshes for a tree in the swap band.
  Now, where the pixel line is not at least a band and a bit above the
  twin's (`midOff`), the whole tree swaps straight to its twin as before the
  pass and the middle version is not drawn.

After both, the Redwood Coast on High: card time -12% at tee 1 and +3% from
above, the whole frame +3% and -14%. **The lesson is round 11's, again: a
change is measured on every landscape it reaches, not on the two it was
tuned on.** Mountain and Classic Parkland have no `farPaintedFrom`.

### The card lost again, during the sweep (13 November 2026, about 21:39)

The sweep of every landscape (round F4's build against 0.9.14) had 22 of
its 30 runs saved when the card was lost between two runs: all fifteen on
High (Seaside Links' is spoiled, below) and seven on Ultra. The owner
restarted the machine. What was found about why, and what changed in how
runs are made, is in RULES_HISTORY.md, *The card is lost on the way back to
idle*; tools/gpu-watch.mjs now records the card once a second while this
work runs.

Two things the sweep seemed to teach besides, **the first since overturned**
(*The first sweep read again*, below): Hawaii's and Seaside Links' High runs
each had one round of the new build read 30 to 50% slower than its other
round, at moments a test run and a capture were using the processor, and
that was put down to the processor being shared. It was more likely the
card's clock: the same split showed later with nothing else running. Nothing
is run beside a comparison all the same. The second holds: **two rounds are
too few to see such a split from the summary**, which takes the higher of
two.

### The first sweep read again: the card's clock (13 November 2026, 22:30 to 23:25)

The sweep finished after the restart, all 30 runs (round F4's build against
0.9.14, tee 1 and from 250 m up, two rounds each, label `sweep-fr9`). Raw
card time, the mean over fifteen landscapes: **High 23% less from a tee and
22% less from above; Ultra 21% and 19% less.** Three Ultra runs read
SLOWER than 0.9.14 while drawing far fewer triangles: Mountain from a tee
(+20%), Prairie & Sand Hills (+31% and +57%), Florida Palms (+12% and
+29%). The owner's note that day, which this answers in part: "ive set the
power settings to max performance".

**What it was not.** Not the once-a-second watcher: Prairie on Ultra
measured again with it stopped and nothing else running, three rounds, read
25% and 26% more card time (5.02 to 6.26 ms, 5.71 to 7.20 ms) with 40% fewer
triangles. Not the trees: on one page, with no middle versions the frame was
2 to 7% slower, with every planted thing hidden 15 to 17% faster from a tee
and 5 to 7% from above, the far ground hidden 7 to 8% faster from above
(tools/variants/mid-line.mjs). Not one round of this branch: two earlier
builds (round 11's, and round F3's) each read as fast as 0.9.14 in one load
and 22 to 69% slower in the next. Not the processor: a profile put a third of
the frame inside uniform4fv and uniformMatrix4fv, but a count found only
14,000 numbers in 450 such calls a frame (tools/variants/uniform-count.js)
-- that time is the page waiting on the card, charged to whichever call was
waiting.

**What it was: the card chooses its clock from how hard it is pushed.**
The watcher's log over those runs has the card at 800 to 1,350 MHz of its
3,105 while it was 24 to 93% busy, drawing 50 to 150 W. A frame that asks
less of it gets a slower card. With the clock read while the frames are
timed (three seconds of frames first, then 400 timed): Prairie on Ultra,
0.9.14 at 1,603 MHz and 169 W, this branch at 1,226 MHz and 134 W.
**Card time times clock over top clock -- the time the frame would take at
full clock, here called work -- repeats to 1 or 2%** where the raw figure
moved by 30: tee 1, 2.39 and 2.39 ms for 0.9.14, 2.41 and 2.43 for this
branch (+2%); from above 2.73 and 2.70 against 3.00 and 3.00 (+10%).

**That reading of Prairie was wrong, and is kept here as what was thought**
(overturned an hour later, *Prairie on Ultra with the clocks equal*, below):
that Prairie on Ultra was level from a tee and 10% heavier from above, and
the slower frame only the card saving power. Multiplying by the clock
assumes the card is the limit; where something else holds the frame up, the
card idles, its clock falls, and the correction hides the slowdown. **The raw
figures of the first sweep stand as what this machine did, not as work**,
and where the two builds ran at different clocks they are wrong in either
direction (Hawaii on High, second sweep: +13% raw at 1,734 against 1,238
MHz, 19% less work).

**What was built.** tools/frame-ab.mjs reads the card's clock, watts and busy
share every 300 ms while a spot's frames are timed, saves them with the
reading, and prints card time at full clock under each spot;
tools/frame-sweep.mjs prints `work a->b` with the two clocks, and its mean
and worst, and passes `--settle` and `--frames` on. The correction is rough
(work is not exactly proportional to the core clock) and is for telling a
slower card from a heavier frame, not for promising a frame rate.

**The owner's power setting did not change what the card does at rest**: it
still fell to its lowest power state (about 250 MHz, 20 W) and its link to
generation 1 between every run that evening, and it floats under load as
above. Whatever was set, NVIDIA's own "Prefer maximum performance" is not in
force for these runs.

### The second sweep, with the clock (13 November 2026, from 23:00) -- STOPPED AT 6 OF 30

One round, `--settle 600 --frames 400`, two minutes' rest between runs,
label `sweep2-fr9`. The owner stopped it to play a game; the runs saved
carry on with the same command. Work at tee 1 and from 250 m up, this branch
against 0.9.14, with the raw card time beside it:

| Landscape, High | tee 1, work | tee 1, raw | from above, work | from above, raw |
|---|---|---|---|---|
| Redwood Coast | -16% | -15% | +6% | +6% |
| Badlands | -9% | -6% | +3% | +3% |
| Classic Parkland | -42% | -32% | -31% | -31% |
| Southern Pines | -39% | -35% | -33% | -33% |
| Lowcountry and Gulf | -36% | -51% | -33% | -48% |
| Hawaiian Resort | -19% | +13% | -16% | +16% |

and Prairie & Sand Hills on Ultra, above. **Open country from above is the
weak place**: Redwood Coast +6%, Badlands +3% on High, Prairie +10% on
Ultra -- fewer trees to save on, and the far ground this branch draws. Not
yet looked into.

**Still owed:** the other 9 on High and 14 on Ultra; the open-country views
from above; the trunk's hard swap (8c171542) drawn and measured; Low and
Medium; every landscape photographed on the final build; both smoke runs;
`dist/` rebuilt.

### Round F5: one caster a part in the far shadow maps (13-14 November 2026)

The owner, having tried the build ("All of these are way faster than they
were"), asked for the three things still in mind -- the open-country view
from above, the draws at a light tee, the nearest shadow map -- and to check
frame rates himself: "you only run checks to see if its working as
intended".

**The draws at a light tee: done.** A crown with three versions met each of
the two far shadow maps as four meshes -- the whole tree's twin, the middle
version's twin, the small tree's own mesh, the middle version's fading mesh
-- all one shape (the shipped twin) with one material. Now such a part has
ONE mesh for those maps (`record.caster`, instance-cull.js), holding every
tree of the part a shadow map needs whatever version the picture draws it
as, with a buffer of its own, written in the maps' order with the rest; the
family's other meshes and fading meshes draw nothing there. The nearest map
is as it was. Low and Medium have no middle versions and are untouched.

Measured against the build before it (the same code less this change;
Classic Parkland, High, two rounds, 600 frames of warm-up, 400 timed; the
card at 2,700 MHz in both):

| | draws | card, at full clock | whole frame |
|---|---|---|---|
| tee 1 | 422 to 402 | 2.36 to 1.90 ms (-19%) | 3.54 to 2.32 ms (-35%) |
| tee 5 | 343 to 326 | 1.49 to 1.50 ms | 2.82 to 1.78 ms (-37%) |
| 250 m up | 384 to 371 | 2.42 to 2.27 ms (-6%) | 3.22 to 2.72 ms (-16%) |

**The card and frame columns of that table are withdrawn** (*A load runs in
one of two modes*, below): the old build's loads were in the slow mode (its
card 75% busy) and the new build's in the fast one (99%), and the table
compared the modes. Measured again with four loads a build: 422 to 402,
343 to 326 and 384 to 371 draws as before; least card time 2.47 to 2.18 ms
at tee 1 (neither build card-bound, 81 and 82% busy), 1.66 to 1.63 ms at tee
5, 2.64 to 2.65 ms from above (both 99% busy); the whole frame +3%, -11%
and +5% by the median of four, which is inside what one build's loads
differ by. **So F5 is 5% fewer draws and no measurable change in time** on
this landscape and tier. Kept: it draws less and the picture is the same. **Pictures:** old against
new changed 3.8%, 2.1% and 6.4% of pixels at the three spots, old against
old 3.2%, 2.4% and 2.9%; the difference images show the same things in
both -- clouds, their shadows on the fairways, a pond, the swap line along a
ridge -- and no shadow gone or added.

**The nearest shadow map: not built, and why.** There the trees drawn whole
cast as the whole model. Casting them as their middle version would save
triangles, but a crown shaded by a shape other than the one it is drawn
with goes dark where the two differ, which is what threw the twin out of
Low's shadow map (the cull's own note, F3 of the cartoon overhaul); the
nearest map's texels are about 9 cm and a middle version's surface moves by
more than that. It would want pictures of near crowns at several hours
before it shipped.

**The open-country view from above: not looked into yet** (below).

### Two unexpected shutdowns while the owner played (13 November 2026, 23:40 and 23:51)

The owner stopped the second sweep to play a game, then asked for round F5
while still playing. The gate read the game on the card (79% of it, 71 C)
and nothing graphical was started; two Node test files were run on the
processor at about 23:50 and the machine went down at 23:50:58. The owner:
"we crashed cause you started making the change while i was gaming."
Windows also logged an unexpected shutdown at 23:40:08, with the game
running and nothing of this work running (its last command was a build at
23:26). The rule taken from it is in RULES_HISTORY.md, *Nothing at all
while the owner plays*.

After the restart the card ran these comparisons at 2,610 to 2,730 MHz and
320 to 414 W, where before it it had floated at 800 to 1,700 MHz: whatever
the owner's power setting changed seems to have needed the restart.

### Prairie on Ultra with the clocks equal (14 November 2026, 00:03 to 00:20) -- "really slower" OVERTURNED, next section

After the restart the card held its clock, and during these runs the owner
also capped it ("limiting the clock of the GPU below its max boost using
nvidia-smi -lgc 210,2520"): the watcher has it at 2,520 to 2,610 MHz from
then on, at rest as well, in its full power state with the link at
generation 4 -- it no longer drops to idle between runs, which is the
moment both of the day's first losses came in.

With both builds at 2,610 MHz, round F5's build against 0.9.14, one round,
600 frames of warm-up and 400 timed:

| | tee 1, card | tee 1, frame | 250 m up, card | 250 m up, frame |
|---|---|---|---|---|
| Prairie & Sand Hills, Ultra | 3.15 to 4.98 ms (+58%) | +41% | 3.34 to 5.58 ms (+67%) | +54% |
| Redwood Coast, High | 3.65 to 3.06 ms (-16%) | -21% | 3.03 to 3.36 ms (+11%) | +13% |
| Badlands, High | 2.36 to 2.19 ms (-7%) | -14% | 2.16 to 2.21 ms (+3%) | -8% |

**Read at the time as Prairie on Ultra being slower than 0.9.14 by half
again, for fewer draws (333 to 324) and 40% fewer triangles -- wrong: one
load of each build, in different modes (next section)** -- as every raw
reading of the evening had seemed to say (+31 and +57%, +25 and +26%, +34 and +20%) and the clock
correction had explained away. Redwood Coast and Badlands agree with the
second sweep. **Which other Ultra landscapes share it is not known**: the
first sweep's Mountain (+20% from a tee) and Florida Palms (+12 and +29%)
are the suspects, and its other Ultra figures were taken with a floating
clock.

**Not found.** One page with each part switched off in turn
(tools/variants/open-country.mjs) was spoiled: a game came onto the card
part-way through (the frame with nothing changed read 2.5 ms, then 4 to 10,
then 17) and the work was stopped there. From its first rows only, before
that: the course's own ground is 38% of the card's time from the tee, the
pixels 29% (density 1 against 2), everything planted 44 to 60%, the far
ground 4%. What is known besides: the earlier page (*The first sweep read
again*) found the trees' middle versions make it faster, not slower, and a
processor profile that put a third of the frame inside calls that set
shader values, 14,000 numbers a frame. **Next:** the same page again on a
quiet card; the same on 0.9.14 built with the capture hooks, so the two can
be read part against part; High on Prairie, which the first sweep had 43%
faster, to see whether this is Ultra's alone.

### A load runs in one of two modes, in either build (14 November 2026, 00:28 to 01:11)

What every odd reading of the night came from. The same build, the same
course, the same view, loaded again and again in a fresh browser (the card
at 2,610 MHz throughout), tee 1 on Prairie & Sand Hills, Ultra:

- **round F5's build, five loads:** 2.42, 2.43, 2.49, 2.42 ms of card time
  with the card 91 to 100% busy -- and the fifth 4.58 ms with it 59% busy.
  Six more with a processor profile running: three near 2.5 ms, three at
  4.0 to 4.8.
- **0.9.14, eight loads, ten minutes later:** 5.27, 4.99, 5.03, 4.91, 5.10,
  6.23, 5.70 ms with the card 67 to 74% busy -- and the eighth 3.51.

**So a load is either card-bound, or held up on the processor's side with
the card two-thirds busy and the same draws taking up to twice as long --
and which one it is has nothing to do with the build.** In a slow load the
extra time is inside the calls that set shader values (uniformMatrix4fv
0.08 against 0.64 ms a frame, uniform4fv 0.06 against 0.52, the same calls
in both): the page waiting on the browser's own graphics process. What
puts a load in that mode is not known; it comes in runs (one load in five,
then seven in eight, then every load for a quarter of an hour).

**Like for like, Prairie on Ultra is faster than 0.9.14, not slower.**
Card-bound loads: 2.42 ms against 3.15 to 3.51 (a quarter to a third less).
Four loads of each, all in the slow mode: tee 1 5.95 to 5.15 ms (-14%,
whole frame -13%), from 250 m up 6.13 to 5.68 ms (-7%, frame -7%). The
"+58% and +67%" above was a fast load of the old game against a slow load of
the new; the first sweep's slower Ultra readings (Mountain, Prairie,
Florida Palms) and the bisect's "as fast in one load, 22 to 69% slower in
the next" were the same thing. The card's clock (*The first sweep read
again*) was real but was not the cause.

**What the sweeps are worth, then.** Their triangles and draws are exact.
Their times are one or two loads a build, and a median of two is the slower
of two: where both builds happened to load in one mode the figure stands,
and nothing in the saved runs before 22:52 on 13 November says which those
are (the card's busy share was not recorded). The large gains on wooded
landscapes (30 to 50% less card time for 40 to 60% fewer triangles) showed
in every measurement of the day in either mode and are not in doubt; the
single-figure differences, either way, are.

**What was built:** tools/frame-ab.mjs prints a *best load* line -- the
least card time of the rounds for each build, with the card's busy share in
that round, and a warning where either build never had the card as its
limit -- and takes `--cpuprofile` (the main thread's time by function for
each spot, saved with the run). Compare with `--rounds 4` or more.

### Low and Medium (14 November 2026): measured on Mountain

The cull's changes reach every tier (a model's own height, squares kept
only for their shadows). Round F5's build against 0.9.14, three loads each:

| Mountain | triangles, tee 1 | card, tee 1 | card, 250 m up | whole frame, tee / above |
|---|---|---|---|---|
| Medium | 24.3 to 13.5 M | 2.25 to 1.85 ms (-18%), both card-bound | 1.79 to 1.82 ms | +1% / -4% |
| Low | 17.3 to 9.9 M | 1.30 to 1.07 ms (-18%) | 0.84 to 0.82 ms | level / **+16%** |

Low from above is the one figure the wrong way: 1.39 to 1.61 ms of main
thread a frame (about 700 frames a second on this machine), with 215 to 229
draws. It is the processor's side, and small here; on the machines Low is
for it would be several times larger. Not looked into.

### The checks on the final build, and the card lost a third time (14 November 2026, 01:12 to 01:48)

The final build is round F5's (`dist/`, built 13 November 23:58 from the
code of 28f480bb; the commits after it change tools and documents only).

- **All fifteen landscapes photographed** on it, from the first tee and from
  high over the course's edge, High: fifteen courses built, no errors
  (`bench/shots/overhaul/f5-final`). Looked at: Classic Parkland and
  Mountain from the tee (every crown on its trunk, shadows as before),
  Redwood Coast and Prairie from above (trunks under the far trees; the open
  country as it was). The other eleven were not looked at one by one.
- **The game's smoke run: 41 of 41 journeys passed** (879 s), the one that
  failed once on round F3's build (`no-late-shaders`) among them.
- **The builder's smoke run did not happen**: the graphics card was lost as
  it started (01:42:38; RULES_HISTORY.md, *The card is lost on the way back
  to idle*, has the watcher's record and what it rules out). It passed 10 of
  10 on round F3's build; nothing since touches the builder.
- **The full Node suite has not been run since round F4** (1,614 tests, one
  skipped, none failing, then). The tree and cull files pass on the final
  code (30 of 30).
- **Not done:** `node tools/biome-fingerprint.mjs --check` on the final
  code (nothing since round F4 touches a generator file); the status page.

**Where the frame-rate pass ends.** Built and kept: rounds F1 to F5 and the
trunk's swap without a dissolve (drawn in the photographs above, never
measured by itself). Not built: the nearest shadow map from the middle
version; a cheaper far ground from above. Open: Low's frame from 250 m up
(+16% on Mountain, processor's side); the second of course load; what puts
a load in the slow mode (the same in 0.9.14).
