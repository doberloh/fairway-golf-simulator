# The surroundings rework

Branch `surroundings-rework`, 12 to 14 November 2026: **merged into main on
14 November 2026 and released in 0.9.15.** This page keeps what was asked, the plan and
every earlier decision the work reversed. **The record of the work, round by
round -- every section other documents name as "SURROUNDINGS, *Round N*" or
"*The frame-rate pass*" -- is in
[history/SURROUNDINGS.md](history/SURROUNDINGS.md), word for word.** The
branch's own rules (the graphics card free, earlier rulings on the far land
not binding) ended with the merge.

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

## What still governs, after the merge

- **The far land is the landscape's own country**: the ground the ring
  draws at the course's fineness, the landscape's own trees as pictures of
  its models to the horizon, no domes, no tree pattern painted on a hill.
  What must stay true of it is in PROJECT_HANDOFF.md (*A FAR MOUNTAINSIDE*,
  and the far trees' and far ground's sections); its numbers in RESEARCH.md,
  *The surroundings rework*.
- **Kept by the owner's word:** Desert Mountain's one mountain with desert
  round it, the sea on Seaside Links, the surroundings changing with the
  season.
- **The Course Builder chooses each side's surroundings**
  (docs/COURSE_BUILDER.md, BUILDER_GUIDE.md); a file without the choice
  plays as before.
- **A tree has three versions on High and Ultra** (PROJECT_HANDOFF.md, *A TREE
  HAS THREE VERSIONS ON HIGH AND ULTRA*); the grids are written by
  `tools/mid-cells.mjs` and a test fails if they are stale.
- **Measuring a frame on this machine:** four loads a build and the best
  load of each (`tools/frame-ab.mjs`), because a load of either build runs
  in one of two modes (history, *A load runs in one of two modes*).
- **Open after the merge** (TODO.md): Low's frame from high above, the
  second of course load, what puts a load in the slow mode. Ideas not built
  (IDEAS.md): near shadows from the middle version, a cheaper far ground.
