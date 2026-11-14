# Fairway TODO: open work

**This file holds open work only; everything finished is in
[DONE.md](DONE.md)** (the owner, 12 November 2026 -- it was the foot of this
file, under `# Done`, and was 97% of it). **A finished entry moves there in
the same pass that finishes it**, under a copy of its heading here, with what
was built; it is never ticked and left. Never nest an open item under a
finished one. A TODO entry named in another document and not found here is
finished: search DONE.md, and never read it whole.

**An open checkbox is a claim about the code as it stands right now.** If a change
makes an entry untrue, close it in the same pass and say what replaced it. One
entry here once asserted the exact opposite of what the physics did, which is how
a correct behaviour nearly got "fixed" back into a bug.

**Pared down twice at the owner's request: 16 October and 11 November 2026.**
By 11 November the open list had grown back to 233 entries (and 45 ticked ones
never moved down), most of them "built, not played" notes for screens,
landscapes and releases that had since been replaced. Every entry open that
morning is kept word for word in DONE.md under *The open list before the 11
November 2026 prune*, with a table saying what became of each: closed (and
why), merged into an entry below, moved to IDEAS.md, or carried over. The 16
October originals are under *The open list before the 16 October prune*.
**The entries below are short on purpose; "was:" names the original in the 11
November archive, which has the full reasoning, the measurements and the
how-to.** Read it before starting one.

**How the list stays short** (the release rule is the owner's, 12 November
2026, and is in AGENTS.md, *Pushing to GitHub*; the other two were PLACED by
Claude at the 11 November prune, and the owner may overrule them):

- **One entry holds what nobody has played**, *Play the current build by
  hand*. A change that is built and not seen adds a line to it (what to check,
  and where) instead of a new entry, and a line leaves when the owner has
  looked or the thing it names is gone.
- **A release's entry replaces the last release's.** Only the newest release
  can be downloaded, so only it is owed a play.
- **A finished goal's entry moves to DONE.md when it merges**; what it left
  behind becomes one short entry here.

**Ideas are not here.** A feature, look or mode nobody has decided to build
goes in [IDEAS.md](IDEAS.md), not in this list. An entry here is something
wrong, unfinished, or owed a check.

## Next feature

- [ ] **Plan the Fairway Tour with the owner, before any code** (the owner, 9
  November 2026: "Fairway tour is going to be our next feature"). Three steps,
  each worth shipping alone: computer opponents who miss the way a golfer of
  their handicap misses; a tournament weekend of four rounds against a field,
  with a leaderboard and a cut; a season across the landscapes, kept offline in
  the profile. To settle first: how a computer golfer's miss is modelled and
  anchored, how a field's scores are made without playing every shot, whether
  built courses host events, what a season rewards. Rules in pure modules with
  Node tests; any new format joins the round matrix. Large. (was: same heading)

## Known wrong

- [ ] **A friend's challenge can throw as its round starts, now and then**
  (12 November 2026, the 0.9.14 smoke run: `friend-challenge` failed once in
  four runs and passed the other three). The journey's first swing found no
  course under it -- the page's "Cannot read properties of undefined (reading
  'toLocal')" -- and the game itself threw "Cannot read properties of null
  (reading 'x')". The play screen is up, with the loading cover down, a
  moment before the course exists; a key pressed in that moment reaches code
  that expects one. Nothing in this path changed in 0.9.14. Find the gap
  (main.js `startRivalRound`, `startRoundOn`) and hold input until the
  course is there; then see whether the other ways into a round share it.
- [ ] **A built tee's stripes can turn where two holes meet** (8 November
  2026; Worthington's 1st). The stripes follow the hole that owns the ground;
  a tee's own hole would need to be in the baked field. Small. (was: *A built
  tee's bands can turn where two holes meet*)
- [ ] **Green surrounds are steeper than intended.** The shoulder blends off
  the green's nominal size, not its outline, so a green that bulges gets a
  steeper bank (worst 0.709 against an intended 0.6 at the defaults). Fix:
  blend off the outline, with a top grade round green complexes. Moves ground:
  a `GENERATOR_VERSION` bump. (was: same heading)
- [ ] **Watercourses: endings and junctions.** A channel cannot flow into a
  pond; where two channels meet, or one meets a pond, the water is a strip of
  segments, not a proper join; some endings fade out on a hillside. Re-check
  the curvature cap before widening rivers past 30 m. (was: same heading)
- [ ] **The shot panel forgets its numbers on a reload.** `lastShot` is memory
  only, so a resumed round shows dashes mid-hole. Decide first whether a shot
  from an earlier session should look as though it just happened. (was: same
  heading)
- [ ] **Frame rate: what the 9 November goal left** (released as 0.9.11).
  High and Ultra miss 120 a second at the 95th percentile on the large built
  courses (their heavy frames redraw a far shadow map, 8-15 ms). Eighteen
  plants have no far version and are drawn whole at every distance (both
  ocotillos, the halas, sotol and others; it costs Low most on Dinosaur
  Mountain): far versions made by hand in Blender (`far_twin`) for the thickly
  planted ones would win it back, and tools/build-meshes.mjs prints the list.
  **The owner's call:** a tier for phones, whose stand-ins are far from their
  targets (iPhone 13 on Medium estimated 43-161 ms a frame). (was: *Frame rate
  on every tier and device*)
- [ ] **Medium crashes its page on a machine with no graphics card, now and
  then** (tools/software-crash.mjs, 4 November 2026; Low runs, and such a
  machine starts on Low). Cause not found; it comes and goes between builds.
  Any run of it is asked for first: a software-rendered run took the PC down
  on 13 October. (was: *Left when the owner cleared the goal*)
- [ ] **The smoke step on GitHub still fails now and then.** Six of the last
  eight pushes to main were green on 11 November 2026; the 9 November push
  failed in the smoke step. When it has stayed green for a good run, make it a
  required check in `tools/github-protect.mjs`, not before. (was: *The smoke
  step fails on GitHub, in `endless-round`*)
- [ ] **Look leftovers on the fifteen landscapes** (5-9 November 2026; each
  small). The limb fix has not reached the Redwood Coast's Meshy trees (a
  re-run of `--far` and `--convert` is free; the owner decides). The
  brittlebush is shardy close up. Southern Pines' trunks are dark in deep
  shade; a dark patch sits low on Sabal palm 2's trunk. Winter's bare
  hardwoods look thin and dead (the branches are the game's, twigs.js, not
  Meshy's; the owner: "keep a note for later"). The grasses are to be
  regenerated on Meshy at the end (the owner, 5 November). The landscape menu
  pictures were taken with cart paths and clubhouses and may still show them.
  (was: *Models to check*, *The limb fix...*, *One look left in Southern
  Pines*, *Bare tree branches*, *Regenerate the grasses on Meshy*)

- [ ] **Frame rate on High and Ultra, every landscape (branch
  `surroundings-rework`, from 13 November 2026; docs/SURROUNDINGS.md, *The
  frame-rate pass*).** The owner, 13 November 2026, after looking at the
  surroundings ("it looks great"; that work is in DONE.md): "Iterate as many
  times as needed to improve the framerates of all of our landscapes. The
  GPU and CPU are yours to use. Focus on gains on high and ultra settings as
  those things should trickle down to the lower settings." Where it started
  (High on Mountain, 13 November): from 250 m over the first tee the
  course's own trees and plants are 60% of a frame, the far ground 10% (5%
  from a tee), the far trees 0.4%; the branch 1.2%, 2.2% and 0.8% slower
  than 0.9.14 at two tees and from above. **Also open, found that day: a
  course takes about 1.1 s longer to load** than before round 10 of the
  surroundings (11.7 s to 12.8 s on Mountain; not the processor's work).
  **Rounds F1 to F3 (13 November): a tree's middle version on High and
  Ultra, its twin again when it is small, and the far ground's two loops.**
  Against 0.9.14, card time at tee 1, tee 5 and from 250 m up: High on
  Mountain 34%, 19% and 40% less (and 2 to 4% more off that with F3); Ultra
  on Classic Parkland 40%, 4% and 46% less. **Wrong: at a light tee on Ultra
  (tee 5, Classic Parkland, about 400 frames a second) the frame is 5%
  SLOWER** for 46% more draws; one draw a crown was taken out since and it
  is not measured again. **Owed:** every landscape measured and photographed
  on High and Ultra; Low and Medium measured (the cull's changes reach
  them). **Smoke on round F3's build: the builder 10 of 10, the game 40 of
  41 -- `no-late-shaders` failed once** (Ultra, a drawn Lowcountry nine, seed
  HOLLOW-1812: one lit shader built 142 ms after the course appeared) and
  passed ten times run alone; not traced, and not known to be this
  branch's. The journey now names the shader; tools/late-shaders.mjs loads
  a named course and lists what is built late. **Course load is about a second longer than
  0.9.14**: 0.56 s of it is the ground shader this branch grew (measured),
  the rest not found. Next: fewer meshes a crown; whole models in the
  nearest shadow map; which shader addition costs the load.
  **The graphics card was lost twice on 13 November (12:03 and about
  21:39), each time in the gap after a full-load run ended.** Windows records
  nothing for it; the suspicion is the card's drop to idle (its link falls
  from generation 4 to 1) failing now and then, and the checks are the
  owner's (RULES_HISTORY, *The card is lost on the way back to idle*).
  tools/gpu-watch.mjs records the card each second while graphics work runs.
  **Every landscape was measured once (the first sweep, all 30 runs): raw
  card time 19 to 23% less on average, with three Ultra runs reading slower
  -- and those readings are the card's clock, not the game.** This card
  slows its clock for a lighter frame; the tools now read the clock and give
  card time at full clock ("work"). **WRONG ABOUT PRAIRIE: with the
  clock capped and equal (14 November), Prairie & Sand Hills on Ultra is 58%
  slower from a tee and 67% from 250 m up than 0.9.14, for fewer draws and
  triangles. Not found** (the page that would find it was spoiled by a game
  starting): SURROUNDINGS, *Prairie on Ultra with the clocks equal*, has what
  to run next. Mountain and Florida Palms on Ultra are suspects. **A second sweep with the
  clock is 6 of 30 done** (stopped 13 November 23:24 for the owner's game;
  `node tools/frame-sweep.mjs --goal surroundings --a bench/ab/base-0914.html
  --b bench/ab/fr9.html --tiers high,ultra --spots tee1,flyhigh --rounds 1
  --settle 600 --frames 400 --label sweep2-fr9 --util 30 --temp 75 --rest 2`
  carries on): High so far 9 to 42% less work from a tee; **from above, open
  country is 3 to 10% heavier** (Redwood Coast, Badlands, Prairie), not
  looked into. The trunk's hard swap (8c171542) is still not drawn or
  measured, and `dist/` is the build before it.
  **Round F5 (14 November): one shadow caster a part in the far maps** --
  Classic Parkland on High, 5% fewer draws and the whole frame 16 to 37%
  shorter than the build before it; pictures unchanged. Measured on that
  one landscape and tier only. The nearest shadow map was left alone (a
  crown shaded by another shape goes dark). **The owner has played the
  build before F5 and found every landscape faster; the build with F5 and
  the trunk's hard swap is not played.**
  What each round did, measured, and what is still owed is in SURROUNDINGS,
  *The frame-rate pass*; this entry is rewritten as it goes.

## The owner's calls

- [ ] **Cart paths, the clubhouse, the road and the lot are off on generated
  courses** (the owner, 8 November 2026; course.js `facilities`; generator
  102). Bring them back, or take the code out. To bring them back the public
  road must first bend round the Badlands' formations and Desert Mountain's
  ranges (a to-do test in terrain-true), and the paths still have their old
  blemishes: 9 dead ends and 86 sharp corners over the bench's courses on
  ground too steep for a walkable turn, and stubs past junctions on Classic
  Parkland. Until this is settled every "not played" note about paths,
  bridges, the clubhouse, streets and their houses is closed. (was: *No cart
  paths, clubhouse, road or lot on a generated course*, *Cart paths with no
  right angles and no dead ends*, *Small cart path blemishes on Classic
  Parkland*)
- [ ] **Small calls on the round screen and the look.** The skins value of
  the hole being played is not shown anywhere on the round screen. The typed
  aim distance has no home there (arrows and the map still aim). Text size
  enlarges the round screen only about a tenth on 16:9 (`ROUND_MIN_WIDTH`):
  right for the bay? After an albatross the scorecard waits about 7 s longer
  than after a birdie: a celebration or a stall? The Redwood Coast borrows the
  parkland fog (`tests/mist.test.mjs` `BORROWS`): give it its own? (was: five
  entries of those names under *The 1.0 interface*, *The cartoon overhaul* and
  *Graphics*)

## Only the owner can check

Hardware, browsers and hands the development machine does not have. Nothing
here is a claim of support until it is done.

- [ ] **Play the current build by hand** (0.9.14, 12 November 2026). What has
  been built and seen only in captures, measurements or smoke runs, and still
  exists in the game. The archive has each item's full list.
  - **The surroundings' frame rate** (branch `surroundings-rework`; the look
    was signed off by the owner on 13 November 2026 and is in DONE.md).
    **Frame rate was measured on one desktop graphics card only**: no phone,
    no laptop, no machine without a graphics card.
  - **The rebuilt ball** (0.9.13; the owner played the branch on 12 November
    and said it "feels way better", naming no single check): the hole-out
    banner, the cameras and the cup sound against a ball that now falls and
    rattles in; a drive's four or five bounces from the tee and the TV
    cameras; a wedge from the rough running out 5 to 6 yd; the lie line's
    "· wedges spin less" and the spin tile's lie tag, on a phone too; the
    seven pickers in Play's rules step on a phone; the range's Lab firmness
    slider and its three chips.
  - **The starting course** (0.9.14; every smoke journey passed on it, the
    game's 41 and the builder's 9, which proves it works and not how it
    looks or plays). The Challenge Course, new in every hole: each
    challenge's hole and spots making sense to a golfer -- *Every par 3* is
    three balls now, where the short course had seven; *Over the water*
    and the short side, where the tests' steady golfer scored nothing; the
    tee challenges' fairway. The
    course of the week: The week's page saying about 6,400 to 6,850 yards
    and par 71 or 72 (week 46: 6,420 yards, par 71, one par 3 and seventeen
    par 4s); the holes reading as ordinary par 4s from the tee; whether the
    five holes that still bend make the tee look set off to one side (the
    bends are as sharp as before, 45 degrees: that angle is what to look at
    next); the lake, the 80% trees and the strongly shaped greens and
    bunkers looking right in each landscape, and the frame rate with them.
    Surprise me: a rolled nine with the same fairways, greens and trees.
    The Course Builder: *Generate and modify* opening on the new figures,
    and a course file opened there keeping its own (the builder guide has
    no picture of that door's sliders, so none is owed).
  - **The gimme circle** (0.9.13; tested in Node only -- the 41 smoke
    journeys pass, and none of them chooses this mode): the
    circle drawn and easy to see at 3 ft and at 30 ft; the size field showing
    only for this mode, in the rules step and in Putting options, with the
    ring distances hidden; the shot card saying "Gimme"; the scorecard
    counting the stroke.
  - **The fifteen landscapes** (0.9.8 to 0.9.10; signed off from captures): a
    round on a few. A drive off a rock tee and a ball on a rock flank on
    Desert Mountain; the Badlands' holes round its formations; the cactus,
    palm and redwood far versions on High; Florida Palms' open scatter; the 22
    remade models; relief shading on the course map and the hole map (a
    hollow look means the light is upside down; no stutter on a pan or zoom);
    a course or round saved before the pare opening on its new landscape.
  - **The frame-rate work** (0.9.11): trees dissolving into their far versions
    (does it shimmer?); Low's thinning far from the hole and its fade-in as you
    walk and fly; seams in the distant ground; a large built course's load.
  - **The builder** (0.9.12): a built course with four or more tee sets in a
    round (seat buttons, Playing tee, scorecard); tee markers on a narrow
    built tee; Build it myself from a drawn box on the real services; Game
    view on a small course and a big one; a pond drawn on a hillside, played;
    painted rocks and bushes (does a ball hit them?); a pond and a creek
    deleted; the cost readout and its weight note.
  - **The look** (the cartoon overhaul, 0.9.5, where it outlived the old
    landscapes): pond reflections on High and Ultra and wavelets at the banks;
    diamond-mown greens and tee stripes not shimmering as the camera moves;
    Reading the ground (Natural, Clear, Map lines) changing a green at once;
    the lie on rock, hardpan, heather and waste sand agreeing with the painted
    edge; Seaside Links' shared fairways from the tee; the ball easy to find
    at dusk and at night. (Its "no line where near trees become far woods"
    went with the far woods; see *The surroundings*, above.)
  - **The interface** (0.9 to 0.9.6): a controller through every menu; VIEWS,
    FLY and the fly pad with a thumb; the bay's projector; the hole-out and
    menu sounds, loud or quiet (`CHIP_LEVELS`, chiptune.js); whether the green
    marker still shows a flag after the stick is pulled.
  - **A friend's challenge**, end to end: a code out, pasted in, their dashed
    shot lines, their row on the scorecard.
  (was: the twelve *Release 0.9 ... 0.9.12* entries and every "built, not
  played" entry of the sections archived on 11 November; *The rebuilt ball:
  play it, then merge*; *The gimme circle: play it*)
- [ ] **A real launch monitor through the bridge.** Everything is checked
  against a pretend bridge. Check: the ball arrives and the numbers update;
  the club data against the device's own app; reconnecting, duplicated shots,
  putting. **And one deliberate fade**: the R50's export signs sidespin
  opposite to its spin axis, so a fade could arrive as a draw. Record the
  operating system, firmware and connector version. (was: same heading)
- [ ] **A launch-monitor session with ROLL**: the first check of the rebuilt
  ball against real ground. Chips at 10, 20 and 30 yd, a 50 yd pitch, a 7 iron
  onto a green, a driver on a fairway, each with its run-out and surface;
  compare with `node tools/ball-bench.mjs --shot`; fit nothing to one device.
  (was: same heading)
- [ ] **A launch monitor from the iPhone, loaded from the bridge.** Start the
  bridge with `FAIRWAY_HTTP_HOST` set to the computer's address, open
  `http://<address>:1922` on the phone, Launch monitor, Connect bridge, arm,
  hit. (was: same heading)
- [ ] **run_fairway_server on a real Mac and a Linux machine.** Built and
  tested on Windows only. (was: same heading)
- [ ] **A real phone, an iPad and a weak laptop: the frame rate.** No real
  phone's graphics have been measured; Report a problem shows the tier and
  frame rate, so the test produces numbers to state honestly on the page. Low
  against main on a machine with no graphics card (`profile.mjs --only weak`)
  is also unmeasured, and is asked for first, every time. (was: same heading;
  *Low on a weak machine, measured against main*)
- [ ] **Other browsers, and what the smoke test does not walk:** Safari,
  Firefox and Edge opening the file (and keeping a saved course's picture when
  it is opened straight from disk); a multi-player stroke round to the end,
  match play, scramble selection, a round saved and continued, export and
  import round trips. The rules of every format are played in Node; what is
  left is the screens. (was: *What the smoke test does not walk, by hand*;
  *Course pictures from a file opened straight from disk*)
- [ ] **Google and Bing imagery in the builder with a real key.** Tested
  against a fake fetch only; the owner's own key is the check. (was: same
  heading)

## Course Builder

- [ ] **A real course's doglegs, checked by a person.** Since 10 November 2026
  door 2 finds a dogleg's bend from the traced fairway (**Find the doglegs**;
  map-checks.js `bendFor`). Not played, and Worthington's yards against its
  card not measured again (they were short by a median 22 yards, and its test
  round scored 96 against par 71, the golfers aiming through trees). (was:
  same heading)
- [ ] **The automatic trace is weak on sand, and far from done from the LIDAR
  alone.** Sand overlaps OpenStreetMap's bunkers 27% at Worthington (target
  80%). From the LIDAR alone, before the holes: green 12%, tee 5%, fairway
  19%, sand 9%, water 21% over nine courses; next would be fairway corridors
  by width and a green's bunkers round it. Refining OpenStreetMap from the
  LIDAR is measured on Worthington only. (was: *Sand is the trace's weakest
  surface*, *The auto trace from the LIDAR alone*, *Refining OpenStreetMap's
  trace from the LIDAR*)

## Getting the word out

- [ ] **Ten testers, recruited one message at a time.** A request for help,
  not a launch. Go where simulator owners already are (the golf-simulator
  subreddits, GolfSimulatorForum, the GSPro community, home-simulator Facebook
  groups, each monitor's owner community) and check which are alive first.
  Issues is where reports go. (was: same heading)
- [ ] **Then one public moment, not a drip.** Hacker News, the procedural
  generation and WebGL communities, the three.js showcase and the simulator
  forums, the same week, one post each, each leading with the play link. Say
  plainly that launch-monitor support is untested and that it was built with
  Claude Code. Donation wording rules are in DISTRIBUTION_REVIEW. (was: same
  heading)

## Housekeeping

- [ ] **What the rebuilt ball still owes** (merged and released as 0.9.13, 12
  November 2026; all 41 smoke journeys passed on the released build that
  afternoon, DONE.md, *Release 0.9.13*). **The website's sample shots** and
  any clip made with the old ball; since 0.9.14 its course-of-the-week and
  challenge screenshots also show the old short courses. **A re-bake of `src/golfer-table.js`**, which was made with the old ball;
  it moves generated markings, so it is a `GENERATOR_VERSION` bump and wants
  its own reason. (was: *The rebuilt ball: play it, then merge*)
- [ ] **Clean up after the retired landscapes** (42 pared to 15, 6-8 November
  2026). Unused now: the retired landscapes' entries in course-names, crest,
  hole-names, renderer, seasons and the palettes; models no landscape plants
  (kept so far, because built courses name trees by species); the island code
  (`ringIslands`: no landscape has far islets since the Keys left. The
  islets themselves are reached again since 12 November 2026, by a built
  course's *Sea and islands* side, so landscape-edge.js `isles` stays); the karst recipe and the `upInto` trial in landforms.js; pine needles
  (`fallen`) taken from a region by a landscape that plants no conifer. Also
  check whether the per-hole tree list (`h.trees` in `generateCourse`) is
  still dead code, and that Classic Parkland's eight weekly slots a cycle and
  Southern Pines' four are wanted. Do every landscape at once; run the
  fingerprint. (was: *Clean up after the retired landscapes*, *The island code
  has no landscape*, *Pine needles under trees the landscape does not plant*,
  *The per-hole tree list is dead code*)
- [ ] **Upgrade `vite-plugin-singlefile` 2.3.3 to 2.3.4.** It clears the three
  high-severity advisories in the build tools (micromatch and braces leave the
  tree). Build-time only, no player is exposed; but it is the plugin the
  one-file build depends on, so it means a build, a size check, the
  attribution files and a smoke run. The owner's call. (was: *Three
  high-severity advisories in the build tools*; *`vite-plugin-singlefile`
  2.3.4 would clear the `braces` audit warning*)
- [ ] **laz-perf's copyright line** in THIRD_PARTY_NOTICES.txt was written
  from its repository's description, not its LICENSE file (the npm package
  ships none). The builder has shipped with it since 0.9.7: confirm it. (was:
  same heading)
- [ ] **A course takes seconds to build, and that is the test suite's whole
  cost.** A full run builds about 520 courses (about 205 s with the processor
  full); three-quarters of a build is "Building the ground", spread over
  routing, `nearest`, the shaped height and the hole widths, nothing on its
  own. A faster build is also a shorter wait to start a round. Must leave the
  fingerprints silent. (was: same heading)
- [ ] **Fewer, smaller documents, the rest of the 1 October plan.** This
  file's finished work moved to DONE.md on 12 November 2026 (650 KB of 680),
  and the journals of the cartoon overhaul and the 1.0 polish to
  `docs/history/` (160 KB). Not started: the same for PROJECT_HANDOFF's dated
  narrative (the file is about 610 KB), DISTRIBUTION_REVIEW's addendum per
  release (130 KB) and COURSE_BUILDER's goal journals (155 KB); merging
  LANDSCAPE_RESEARCH into RESEARCH. The plan, with its
  order and its traps, is in DONE.md's 16 October archive. (was: same
  heading)
