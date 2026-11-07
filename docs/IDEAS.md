# Fairway ideas

**Things that could be built and that nobody has decided to build.** Not a
to-do list: nothing here is owed, broken or promised. TODO.md holds what is
wrong, unfinished or owed a check; this file holds what might be nice.

**How it is used** (the rules are in AGENTS.md, *Ideas live in IDEAS.md*):

- **Read it only when looking for something new to build**, or to add an idea.
  It is not part of starting work, and not part of the documentation sweep
  after a change -- unless the change builds, kills or alters an idea here.
- **An idea is a few lines**: what it is, why it would be good, roughly what
  it costs (small, medium, large) and where in the code it would go. Detail
  belongs in RESEARCH or TODO once it is picked.
- **When the owner picks one, it leaves this file** and becomes work: an entry
  in TODO's open list, or straight onto a branch.
- **When the owner turns one down, it moves to *Turned down*** as one line with
  the reason, so it is not suggested again.
- Anyone can add one -- the owner, or Claude when an idea comes up during
  other work. Say who and when.

Where an idea came from TODO, "was:" names the original, kept word for word in
TODO.md under *The open list before the 16 October prune* in `# Done`, which
often has the how-to already worked out.

## Ways to play

- **Stableford, foursomes and net scoring.** Stableford (points per hole, so a
  blow-up hole costs little), foursomes (alternate shot) and net scores off the
  sim handicap the game already keeps. Match play has no handicaps today.
  Rules go in a pure module beside `scoring.js` with Node tests. Small to
  medium. (Claude, 16 October 2026)
- **Computer opponents.** Golfers to play against, each missing the way a
  real golfer of their handicap misses: a solo player gets a match, and match
  play gets an opponent. The ball model is shared, so they only need a choice
  of club and aim and a believable miss. Medium. (Claude, 16 October 2026)
- **A tournament weekend.** Four rounds on one course against a field of
  computer opponents, with a leaderboard and a cut. Needs computer opponents
  first. Large. (Claude, 16 October 2026)
- **Tees per golfer.** Each golfer plays their own tee, with mixed-tee scoring
  and the CSVs to match. Medium. (was: *Per-player tee choice*)
- **A course built for your game.** The generator lays out holes around the
  golfer's own launch-monitor misses: bunkers where their driver's miss
  lands, par 3s at the carries they like least ("test me"), or holes that
  suit their stock shape ("flatter me"). The course tightens as their spread
  does, so it shows progress, and a challenge code carrying the pattern lets
  a friend play "the course my slice built". No sim we know of does this, and
  nothing leaves the machine. The pieces: `dispersion.js` already turns a
  club's shots into an ellipse (`groupEllipse`), and the profile keeps the
  bag's distances -- but not shots kept by club across sessions, so a
  per-club pattern has to be stored first. Then a pure module from pattern
  to landing zones, with Node tests, and hazard placement and hole lengths
  in `course-plan.js` / `course.js` reading it. Opt-in, so existing seeds
  keep their courses; a saved round stores the pattern it was built from,
  or it rebuilds differently; too few shots falls back to an ordinary
  course. Large: it is generation (fingerprint, bench, old saves).
  (Claude, asked by the owner for one standout feature, 29 October 2026)

## Practice

- **Twists for the challenge of the week**: a wind of the week, a club of the
  week, a tee of the week -- seeded from the date like the pick, so still the
  same on every copy. Left out of the first version on purpose. Small.
  (Claude, 16 October 2026)

- **The range's session averages as tiles**, so average carry and spread can
  be ticked on like any other field. Small. (was: *The range's own session
  summary is still its own thing*)
- **Strokes gained.** The profile already counts fairways, greens in
  regulation and putts; strokes gained says which part of the game costs the
  most shots. Pure module with tests. Medium. (Claude, 16 October 2026)

## Around a round

- **A caddie's club suggestion.** "Plays like" already works out what the shot
  plays like; matching that against the golfer's own bag distances suggests a
  club. Small. (Claude, 16 October 2026)
- **Share a shot as a clip.** Record the last shot from the canvas as a short
  video to save and share -- an ace, a long putt. Good for word of mouth.
  Small to medium; check the cost on a weak machine. (Claude, 16 October 2026)
- **Replays you can keep and control**: save shots, pause, scrub, choose the
  camera, kept apart from score and undo, with a size bound. Medium. (was:
  *Replay persistence and controls*)
- **Play offline from a phone's home screen.** A service worker keeping a copy,
  its cache named by the build stamp, never registered when the file is opened
  from disk, and a smoke journey that goes offline and reloads. Small to
  medium. (was: *It needs a connection every time it opens*)

## Weather and looks

- **Drawn outlines on High and Ultra.** A screen-space edge pass on the depth
  and normals (or the inverted-hull trick on trees and rocks) would give the
  cartoon look ink lines round crowns, trunks and stones. The cheap version --
  darkening a surface where it turns from the eye -- was tried in the cartoon
  overhaul and showed nothing (CARTOON_OVERHAUL *Lighting*, round 10): trunks
  are already dark and stones small. A real pass costs a frame the branch is
  already over main by. The inverted hull is now on the tee furniture only
  (0.8 cm, rounds 16-17), where it costs nothing; on trees and rocks it would
  double their geometry. Medium; wants a profile. (Claude, 26 October 2026)
- **Rain and a wet course.** Rain to look at, and a course that plays wet:
  softer, slower greens and less roll. The firmness and green-speed settings
  already do the playing half; the drawing half costs frames and wants a
  profile. Medium. (Claude, 16 October 2026)
- **Greens that read at midday**, five options in order of payoff: a smooth
  lighting ramp for the putting surface alone (the four-step toon ramp clamps
  a near-flat green to one brightness above about 48 degrees of sun); cross-cut
  bands; contour lines on greens only, off by default (BUILT on the
  cartoon-overhaul branch as part of *Map lines*, 26 October 2026: 5 cm on
  greens, a metre elsewhere -- not greens-only); shading baked from each
  green's shape; slope in hue. Graphics only. Expect an improvement, not a
  solved problem: part of why a green reads flat is the low viewing angle.
  Medium. (was: the entries under *Greens read better if the art style bends
  for greens only*)
- **A glow round the lit lanterns** in Haunted Hollow. An additive halo drew a
  dark square behind every face; find what does that first. Small. (was: same
  heading)
- **A third crown shape for the trees** -- a single-mass conifer, or a plume
  built from overlapping foliage. Medium. (was: *Only two crown shapes*)

- **Bare winter trees, or better limbs, from Meshy 7.1.** One test on white oak 1 gave
  very good tapering limbs and almost no leaves, a bare winter tree from a summer picture.
  Those could stand as winter or dead trees, or be the wood under Meshy 6 leaves, which
  would suit real taper and limbs. Rough cost: 30 credits a tree, plus joining two
  models in tools/blender/meshy_game.py. Noticed by Claude, 6 November 2026.

## Under the hood

- **Washington's surveys listed in the builder, through the bridge.** The
  Washington Lidar Portal answers what covers a box only to its own page,
  and its download needs the pass its page hands a browser, so door 2 now
  opens it on the place and the player draws a box there. Fairway's bridge
  (a program, which needs no allow-origin) could ask the portal's `/query`
  for door 2, which would list Washington's surveys beside USGS's and give
  each its download link, the browser fetching the ZIP with the portal's
  pass (opened once). Why: three clicks on another site fewer, for the
  owner's own state. Small to medium: bridge/server.mjs `lidarTarget` and a
  POST route, lidar-search.js a `wa` source, door-real.js `searchAll`; only
  while the bridge runs. The same may suit other state portals with a query
  of their own (not checked). Claude, 1 November 2026 (RESEARCH, *Finding
  LIDAR from the builder*).
- **Spin at the rim.** A putt reaches the lip carrying only rolling spin; one
  with sidespin should take the lip differently. Medium. (was: *Spin-dependent
  rim behaviour*)
- **A camera that frames one tee complex from above**, to show the tee stagger
  rather than argue it from numbers. Small. (was: *No picture of a tee complex
  from above*)
- **Lower-polygon grown trees, made in Blender** -- the owner asked, during
  the frame-rate goal (22-23 October), that a need for lower-polygon models be
  noted and not acted on. It is needed: on Redwood the trees are about 70% of
  an Ultra frame even after the goal's -21%, and nothing that keeps the same
  models moved them -- not their wind math, not drawing them nearest first,
  not their shading of hidden crowns (RESEARCH.md, *Frame time on Ultra*).
  The redwoods are 13-53 thousand triangles a tree (43.6 M built across 81
  tree meshes on seed PROFILE); a set at roughly a third, kept to the same
  silhouettes, would be the largest frame win left, on every tier. Large
  (asset work); vendor/ and tools/build-meshes.mjs, tools/grow.mjs. Claude,
  23 October 2026. *Cheaper since the same evening*: Blender is installed and
  a headless pipeline exists (`tools/blender/`, docs/BLENDER_ASSETS.md), built
  for Lakeshore Dunes. A redwood remake would be a new pack script there;
  Blender may use the graphics card without asking (AGENTS.md).

### Join and reorder every shipped model's vertices

**What.** Give every shipped model what the Meshy trees got: vertices joined where they
can be, triangles in the order the graphics card's vertex cache likes. The card shades
a vertex once if the next triangle reuses it soon, so the order alone can halve its
work, with no change to how a model looks.

**Why it is worth writing down.** On the Redwood Coast it took Low from 3.34 ms a frame
to about 1.9 ms (RESEARCH.md, *Why the Meshy trees were slow*). That frame is bound by
vertices, not pixels: the card took the same time at a third of the pixels. **But do not
expect that gain everywhere.** That landscape's trees were the worst in the game and
fill nearly all of it. Across all 46 folders in vendor the game already shades 0.74
vertices a triangle, where 0.6 is about as good as it gets (`tools/vertex-report.mjs`,
5 November 2026). The owner was told at first that every shipped model had the problem;
that was wrong, and this entry replaces it.

**Where the gain is**, shaded per triangle and triangles in the folder:

| Folder | Shaded/tri | Triangles | Vertices now, exact join, position join |
| --- | --- | --- | --- |
| cartoon_pacific | 1.37 | 45,306 | 61,452, 52,270, 48,131 |
| cartoon_southpines | 1.24 | 49,243 | 61,093, 36,137, 31,941 |
| cartoon_prairiegrass | 1.62 | 9,631 | 15,583, 13,654, 12,036 |
| cartoon_island | 1.48 | 10,818 | 15,982, 15,808, 10,744 |
| cartoon_grass | 1.75 | 3,438 | 6,008, 5,232, 4,596 |
| cartoon_rocks | 1.69 | 3,840 | 6,082, 6,078, 2,178 |
| cartoon_houses, cartoon_streets, the architect folders | 1.6-2.0 | under 5,000 each | flat-shaded, little to join |

Run `node tools/vertex-report.mjs` for today's figures; `--models` for each model. Weigh a
folder by how many instances a course plants, not by its triangles: grass and sprays
planted by the thousand matter far more than a clubhouse.

**The worst are the trees built by `tools/blender/grown.py`** (*Built as it grows*): bay
laurel, bigleaf maple and madrone shade 2.15-2.19 a triangle and their far versions 1.5,
because each thin leaf owns its vertices. The redwood pack's were the same (2.51) until
Meshy replaced them. Reordering cannot help those: a model cannot shade fewer than its
vertices divided by its triangles. Their cure is in grown.py, sharing vertices along a
spray, or fewer vertices through a different leaf shape.

**How to build it.**

1. In `tools/build-meshes.mjs`, after `extract` and before quantising (the loop over
   `byRole`), join vertices identical in position, normal and paint. That is safe.
   Joining by position alone smooths facets, so only do that with the owner's eye on it.
2. Reorder each part's triangles and renumber vertices by first use. `cache_order` and
   `by_first_use` in `tools/blender/meshy_parts.py` are the method, Tom Forsyth's
   linear-speed one: port it to JavaScript. It took 12,000 triangles a few
   seconds a model in Python, which is fine in a build step, and 627 models will add to that.
3. Rebuild `src/asset-meshes.js`. It should shrink. Every model's bytes will change, where
   the tool has so far kept them stable, so say so in the commit.

**Traps, each met on the way.**

- **Part order:** `farParts` (mesh-assets.js) uses a far version only if its parts match the
  model's, role for role and in order, and silently falls back to a thinned full model
  otherwise. The sign is triangles doubling (44-52 M against 22 M). Keep bark first.
- **One-sided faces:** the game draws one side, so a join must not merge faces with
  opposite normals, which the exact join cannot do but a position join could.
- **Paint and wind:** a vertex carries paint and flex (`COLOR_0`); join on those too.
- **Nothing moves on the course:** model shape is unchanged, so the fingerprint should stay
  silent, but run `node tools/biome-fingerprint.mjs --check` to be sure.

**How to measure.** Build both with hooks, from the same source, and alternate them on an
idle card; another job on the card spoilt one run here.

```bash
OUT=bench/shots/dist-a node tools/capture/build-hooked.mjs
```

```bash
node tools/frame-ab.mjs --goal <name> --cap 200 --util 30 --temp 80 --rest 1 --tier low --biome puget --rounds 2 --a <before.html> --b <after.html>
```

`--cap` counts every run under that goal name, so a cap below the log's total stops the
run at once. Start with a landscape that plants the worst folders (cartoon_pacific,
cartoon_southpines). Check that the trees look the same, then take it landscape by
landscape: `--device weak-laptop` for a weak machine, whose figures are an estimate.

**Rough cost.** Half a day for the exact join and reorder, and a look at a few landscapes.
Expect a modest gain outside the folders above. **Who and when:** the owner, 5 November
2026, to be decided later.

## New biomes (9 October)

Sixteen landscapes the owner and Claude drew up together, with what each would
cost, cheapest first within each group. Haunted Hollow was picked first and
built. Lakeshore Dunes, not on this list, was asked for by the owner on 23
October 2026 from a photograph of Harbor Shores and built. A biome is one record in `src/biomes.js` (PROJECT_HANDOFF *Adding a
biome*), so "settings only" means one record plus a course-name list and a mist
profile. "Unused models" means the model is already in `vendor/` and goes in
through `PICK` in `tools/build-meshes.mjs`; check it in `npm run assets` before
choosing, because picking by file name has been wrong twice. Altitude and
temperature are biome fields and feed the air the ball flies through, so
several of these play differently as well as look different.

**Picked: every region of the USA** (the owner, 2 November 2026). The idea of
1 November -- 39 landscapes under 18 regions, with seasons, roads and a
clickable map -- is now the goal on the `course-builder` branch: TODO.md
*US landscapes*, the local study docs/studies/us-landscapes/ (PLAN.md). The
ideas it covers left this list with it: Heathland / Sandbelt (the Pine
Barrens), Volcanic Coast (Hawaii), Winter (the winter season, snow for looks
only), Nordic Birch (the North Woods), Lowcountry Marsh, Spring Blossom (the
spring season's flowering), Countryside (the Heartland's fields) and Red
Rock Canyon. Haunted Hollow, built from this list, is being removed (the
owner, 2 November 2026).

**Settings only, no new assets**

- **High Plateau.** Wide dry golden grassland near 2,500 m under a pale sky; thin air carries the ball noticeably farther. Palette, landform and Links-style `tallGrass`.
- **Highland Moor.** Steep, almost treeless hills of heather and bracken, grey outcrops, dark lochs, low heavy sky. Mountain's `hills` with a very low `treeDensity` and Links' heather. Looks best with the course's lake setting up -- a biome does not control how much water a course gets.

**Unused models once in vendor/** -- the Kenney and Quaternius packs these name
were removed from the repository on 27 October 2026 (they are in git history
before then, and the packs are CC0 and still published); an idea below now
means building its models in Blender (docs/BLENDER_ASSETS.md) or fetching a
pack again, with its credit put back in ATTRIBUTION.md.

- **Mushroom Grove.** Fairytale: giant red and tan toadstools as the trees, twisted trees and flowers between. Kenney `mushroom_*` and MegaKit `Mushroom_Common` / `Mushroom_Laetiporus` scaled to tree height; stalks collide like trunks. The only purely fanciful idea, so it turns on whether the game should stay realistic.
- **Rainforest.** Dense layered green: palms, big-leafed plants (`Plant_1_Big`, `Plant_7_Big`), ferns, mossy rock, warm wet haze. The work is density -- jungle without hiding every fairway.

**Some new building**

- **Mediterranean Cliffs.** Umbrella pines, narrow cypresses, gnarled olives, terracotta houses (`warm`), deep blue sea along one edge. The umbrella pine is a bare trunk with a flat crown -- the trick `tools/bake-assets.mjs` used for the first redwoods; cypress is a stretched `tree_cone`; olive from `TwistedTree`. Three tree builds, none from scratch.
- **Savanna.** Golden tall grass and flat-topped acacias. No acacia in any pack, so it would be built in Blender, as every model is now (the redwoods were once grown by `tools/grow.mjs`, removed 27 October 2026). A wrong silhouette sinks the biome, so this is the costliest of the tree-led ideas.
- **Ancient Ruins.** Broken columns, obelisks and stone heads in the rough between holes (Kenney `statue_column`, `statue_columnDamaged`, `statue_obelisk`, `statue_head`, `statue_ring`). Less a biome than a scenery layer several biomes could switch on -- Mediterranean and Rainforest especially. Placement would likely borrow how `homes.js` picks sites.

## Turned down

One line each: the idea, when, and the owner's reason.

- **Leaderboards for the course of the week** (20 October 2026). Scrapped by the owner after seeing the three ways to do it: friends' scores swapped as codes, a public board on the website (a service to run and moderate), or the game posting scores itself (breaks "nothing ever sent anywhere").
- **Networked multiplayer** (20 October 2026). The owner wanted it with no servers of their own; across the internet that still needs an address-check service, or a relay for about one connection in ten, and Netlify cannot be the relay (no lasting connections; a free site over its limit is suspended for the month). The owner picked *Challenge a friend by code* instead (now built, TODO *Challenge a friend*) and does not expect to ask again. The study is `docs/reports/MULTIPLAYER_FEASIBILITY.md` (local); RESEARCH *Challenge a friend* has the Netlify sources.
- **A rock-built waterfall for Desert Resort** (5 November 2026). Offered after the landscape was built, for the waterfalls at Wynn, Southern Highlands and Canyon Gate. The owner declined: "No rock waterfalls please." No reason given.
