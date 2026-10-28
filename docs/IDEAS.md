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
- **Scalloped bunker edges**: the fingers of grass that reach into sandbelt
  bunkers. Needs a third outline harmonic and a new hazard-texture layout. Only
  if the current shaping is not enough on screen. Medium. (was: *True scalloped
  edges need a data channel that does not exist*)
- **Bridges over creeks.** Channels cross walking routes with no deck. A height
  override was tried and removed (a ball flying under the deck landed on it);
  a real one needs a solid with an underside. Medium. (was: *Bridges and
  crossings*)

## Under the hood

- **Spin at the rim.** A putt reaches the lip carrying only rolling spin; one
  with sidespin should take the lip differently. Medium. (was: *Spin-dependent
  rim behaviour*)
- **Routing quality measures** in the bench: forced carries, recovery space,
  green-to-tee walks, the finishing hole's return. Medium. (was: *Routing
  quality metrics*)
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

- **Cart paths.** A paved path winding from each green to the next tee
  through the rough, as in the owner's Harbor Shores photograph: a ribbon
  painted in the ground shader with its own lie (a path is "cart path" relief
  under the Rules), routed with the green-to-tee walk the router already
  measures. Medium: it is generation (a new surface, the fingerprint, old
  saves) and a new relief rule. Kept out of the Lakeshore Dunes goal on
  purpose. Claude, from the owner's goal text, 23 October 2026.

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

**Settings only, no new assets**

- **Heathland / Sandbelt.** Sandy scrubby rough, purple heather, scattered pines, firm fast ground -- the Melbourne sandbelt and English heathland style, not represented yet. Desert's `sandLand` rough, Links' `heather`, PNW's `pine`.
- **Volcanic Coast.** Black lava rock in the rough, bright green fairways, dark blue sea along one edge (`edgeCoast`), palms and low scrub. Island's species with a dark rock palette.
- **High Plateau.** Wide dry golden grassland near 2,500 m under a pale sky; thin air carries the ball noticeably farther. Palette, landform and Links-style `tallGrass`.
- **Highland Moor.** Steep, almost treeless hills of heather and bracken, grey outcrops, dark lochs, low heavy sky. Mountain's `hills` with a very low `treeDensity` and Links' heather. Looks best with the course's lake setting up -- a biome does not control how much water a course gets.

**Unused models once in vendor/** -- the Kenney and Quaternius packs these name
were removed from the repository on 27 October 2026 (they are in git history
before then, and the packs are CC0 and still published); an idea below now
means building its models in Blender (docs/BLENDER_ASSETS.md) or fetching a
pack again, with its credit put back in ATTRIBUTION.md.

- **Winter.** Snow-covered trees and green playing surfaces cut through white rough, low sun, cold air (shorter carries), pale blue light. The Quaternius packs carry `_Snow` versions of nearly every tree, bush, rock, stump and log (`PineTree_Snow`, `BirchTree_Snow`, `Willow_Snow`, `Rock_Snow`, `TreeStump_Snow`, `WoodLog_Snow`, `Bush_Snow`). Decide whether snowy rough PLAYS differently or only looks it: today the lie is plain rough whatever colour it is painted.
- **Nordic Birch.** White-trunked birch stands with pines, mossy granite boulders, many lakes, a long low northern sun. `BirchTree_*`, `Rock_Moss`.
- **Mushroom Grove.** Fairytale: giant red and tan toadstools as the trees, twisted trees and flowers between. Kenney `mushroom_*` and MegaKit `Mushroom_Common` / `Mushroom_Laetiporus` scaled to tree height; stalks collide like trunks. The only purely fanciful idea, so it turns on whether the game should stay realistic.
- **Rainforest.** Dense layered green: palms, big-leafed plants (`Plant_1_Big`, `Plant_7_Big`), ferns, mossy rock, warm wet haze. The work is density -- jungle without hiding every fairway.
- **Lowcountry Marsh.** Flat wet Carolina-coast ground: live oaks, willows, lots of water, warm humid haze. `Willow`, `tree_oak`. Kenney's `hanging_moss` and `lily_large`/`Lilypad` are there too, but draping moss on branches and floating pads on ponds are new code -- a second step.

**Some new building**

- **Spring Blossom.** Pink and white flowering trees and flowering bushes (`Bush_Flowers`, `Bush_Large_Flowers`). Autumn's per-species leaf colours are written into `vegetation.js` for autumn only (`leafFall`); making the tint a biome field is small and lets any biome recolour its trees.
- **Mediterranean Cliffs.** Umbrella pines, narrow cypresses, gnarled olives, terracotta houses (`warm`), deep blue sea along one edge. The umbrella pine is a bare trunk with a flat crown -- the trick `tools/bake-assets.mjs` used for the first redwoods; cypress is a stretched `tree_cone`; olive from `TwistedTree`. Three tree builds, none from scratch.
- **Savanna.** Golden tall grass and flat-topped acacias. No acacia in any pack, so it would be built in Blender, as every model is now (the redwoods were once grown by `tools/grow.mjs`, removed 27 October 2026). A wrong silhouette sinks the biome, so this is the costliest of the tree-led ideas.
- **Countryside.** Rolling farmland: wheat and corn fields, fences and hedgerows, scattered oaks and farmhouses. Kenney `crops_*`, `fence_*`, Quaternius `Wheat`, `Corn`. Laying out fields in rows beside the holes is a new placement system, not a plant list.
- **Ancient Ruins.** Broken columns, obelisks and stone heads in the rough between holes (Kenney `statue_column`, `statue_columnDamaged`, `statue_obelisk`, `statue_head`, `statue_ring`). Less a biome than a scenery layer several biomes could switch on -- Mediterranean and Rainforest especially. Placement would likely borrow how `homes.js` picks sites.
- **Red Rock Canyon.** Flat-topped mesas and red cliff walls, juniper scrub, red earth. Kenney's cliff kit (`cliff_*`, including waterfall pieces) is vendored, but the landform fields only say how high and how far hills rise -- not flat tops or sheer walls. New landform work, so it moves generation and needs the fingerprint and bench run like any terrain change. The costliest and riskiest idea here.

## Turned down

One line each: the idea, when, and the owner's reason.

- **Leaderboards for the course of the week** (20 October 2026). Scrapped by the owner after seeing the three ways to do it: friends' scores swapped as codes, a public board on the website (a service to run and moderate), or the game posting scores itself (breaks "nothing ever sent anywhere").
- **Networked multiplayer** (20 October 2026). The owner wanted it with no servers of their own; across the internet that still needs an address-check service, or a relay for about one connection in ten, and Netlify cannot be the relay (no lasting connections; a free site over its limit is suspended for the month). The owner picked *Challenge a friend by code* instead (now built, TODO *Challenge a friend*) and does not expect to ask again. The study is `docs/reports/MULTIPLAYER_FEASIBILITY.md` (local); RESEARCH *Challenge a friend* has the Netlify sources.
