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

**Online play with friends in other houses** -- branch `online-play`, from 19
November 2026 (the owner, reversing the 20 October "no servers" choice that
had turned networked multiplayer down). Live matches, no accounts, each
player's profile kept on their own machine and shared on joining, private
rooms. Its terms are in AGENTS.md, *This branch: online play with friends*;
its plan, log and status page in the worktree's `docs/studies/online-play/`
(local). Decided 19 November: the relay is Cloudflare's (RESEARCH, *Online
play: where the relay can live*); the owner makes the account and deploys it.
Built and tested on the branch the same day (docs/ONLINE_PLAY.md); still owed
before it can be called done:

- [ ] **The owner plays a round with a friend in another house**, over the
  deployed relay (built in since 20 November 2026): host and guest each way
  round, a phone on the PC's `run_fairway_server` with the launch monitor
  armed, a ball in the water, a dropped connection, a scramble, the
  scorecard on both screens before the next tee, and a third friend
  dropping in mid-round (let in to watch, seated from the next tee) and a
  player leaving and coming back to their own card. Nothing online has been
  played by a person.
- [ ] **Both screens lost the relay at once, one smoke run in six** (20
  November 2026; RESEARCH, *Once, both screens lost the relay together*).
  Cause unknown; smoke now logs refused messages and unexpected closes. If
  it comes back, read those lines before anything else.
- [ ] **Three or four players in the browser.** Node plays every format with
  three; the browser journey plays two.
- [ ] **Seen in no browser yet** (each is played by the Node rounds' rules):
  a scramble's ball chosen by a guest; a net round's strokes for a guest
  (their own index, from their device); the course of the week online; a
  hidden host landing a guest's flight at once (its computer golfers wait
  until shown); *Play on without them*; the room open again for a second
  round; a watcher in a browser seated and then playing shots, and a
  browser guest leaving and coming back to their own golfer.
- [ ] **The owner's three of 20 November, fixed, seen in smoke only**: the
  room code on the pause list's *Online room* and nowhere else (not seen
  on a phone, where it is under the top bar's Menu); *Results only* for a
  computer golfer on a guest's screen; a guest told when the host leaves,
  and not asked to save.
- [ ] **The source archive with `relay/`** (tools/package_release.py now
  packs it; the packager has not been run since).
- [ ] **Safari and Firefox** as host and as guest (the smoke journeys are
  Chromium).

The Fairway Tour goal merged and was released as 0.9.19 (19 November 2026;
DONE.md, *The Fairway Tour and computer golfers*); what it left is under
*Play the current build by hand* and *Known wrong*.

## Known wrong

- [ ] **Ultra: about two more stalls a minute with three computer golfers**
  (fairway-tour, 18 November 2026; RESEARCH, *After the minimap fix*). The
  goal asked for a round with three golfers to be no worse than 0.9.18 with
  one person, on Low, Phone and Ultra. Phone and Low met it; Ultra's mean and
  p99 are better but frames over 50 ms read 108 against 85 over twelve
  minutes, and the worst frame 253 against 216 ms. The extra ones come
  150-270 ms after a computer strike. An unminified profile of them holds
  the renderer setting up programs and uniforms (`setProgram`, `upload`)
  and the shot card's layout read (`placeShotCard`), the same work as
  after the person's strike, and no golfer code; the branch against itself
  read 21 against 21 over three loads. **Why it comes more often after a
  computer strike is not known.** A guess, untested: its camera follows a
  ball to views not drawn before. If so, a way in is to draw the landing
  area once, off screen, in the pre-shot moment (`preflyComputerShot`
  already flies the ball there), or set up a hole's programs at its start
  (the phone's *Half a second at a new hole* below). `placeShotCard`'s
  layout read is worth taking out either way. Measure with
  `tools/frame-round.mjs --tier ultra --rounds 12`, every load counted.
  Whether a person playing feels them: `node tools/phone-probe.mjs --script
  tools/probe-frames.js` writes each frame over 50 ms with whose strike came
  before it and how long before. First played 19 November 2026, the owner
  on a Mac mini (Apple M4, Chrome, Ultra, 60 Hz screen), one Endless round
  with computer golfers, about five minutes ("It went pretty smoothly"):
  mean 16.8-17.5 ms in play, one minute with no frame over 50 ms, and **no
  stall 150-270 ms after a computer strike** (the nearest, 67 ms at 1.35 s).
  What it did show: 0.5-1.7 s while the course loaded, one of 1.2 s before
  the first shot, and 0.9 s at the move to the second hole (the phone's
  *Half a second at a new hole* below, on a Mac too). One machine, one
  short round: it says the harness's Ultra gap is not obvious to a player
  there, not that it is gone.

- [ ] **The grass should be darker on every landscape** (the owner, 15
  November 2026, looking at the painted ground on the iPhone: "overall
  across all biomes i want the grass to be darker. Lets make it a todo").
  Every tier, not only the phone. Where: the landscapes' turf colours
  (biomes.js palettes, the ground's tints in ground.js) and the near grass
  (vegetation.js), kept in step so the blades still match the ground under
  them. A palette is a record change (`node tools/biome-fingerprint.mjs
  --check` should stay silent; no `GENERATOR_VERSION`). Needs pictures of
  several landscapes before and after for the owner, which use the graphics
  card. Not started.

- [ ] **The phone: what the phone-performance branch left** (15 November
  2026; the whole journey is in DONE.md, *The game is too slow on an iPhone*,
  and RESEARCH, *The first figures from a real phone* onward). The owner's
  iPhone now holds the 30 fps cap in play (it was 14-20); the phone's chip
  runs fast for a burst and then at about two fifths of it, which a web page
  cannot change. Left:
  - **Hitches of 80-240 ms, a few a minute**: a ground picture's repaint
    (ground-bake.js) stalls on its first and last band, or another, while
    the bands between cost 0-1 ms; not the painting, not the mipmaps. Not
    known why. The cheap way round without the cause: repaint less often,
    and when the player will not notice (the ball at rest, a hole's change).
    Seen again 19 November 2026 (tools/probe-frames.js, the owner's iPhone,
    Safari, a hole with computer golfers on the fairway-tour build): about
    three a shot, for the person's shots and the computers' alike -- 85-120
    ms on the strike's own frame, 130-190 ms 4-10 s after it, a smaller one
    soon after -- and 500-610 ms at the move to the second hole; mean frame
    17-18 ms.
  - **Half a second at a new hole** (programs built then: the recorder names
    ShaderMaterial, MeshToonMaterial, Far ground). Not the phone alone: a
    Mac mini (M4, Ultra) showed 0.9 s at the move to a second hole (19
    November 2026, tools/probe-frames.js).
  - **Hiding the graphics options on a phone** (the owner's idea of 14
    November, held "until its figures are good"; they are now).
  - **45 a second sustained** (the owner's first target) needs about half
    the sustained frame cut.
  - **No Android has been tried.** One Watch this device run would say much.
  - **Not seen by the owner:** the slope grid and flow on by default on the
    PC (main.js `READING_DEFAULT`), the green lines' new width on a desktop
    (unchanged at one pixel a point), Measure and Watch this device on the
    PC, the Phone tier on any landscape but the Pacific Northwest and the
    Redwood Coast.
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

- [ ] **Low from high above is slower than 0.9.14** (found 14 November 2026, the
  frame-rate pass; released in 0.9.15). Mountain on Low, 250 m over the first
  tee: the whole frame 1.39 to 1.61 ms on this machine (16%), 215 to 229
  draws, all on the processor's side; the card's work is level and from a tee
  it is 18% less. Small here, several times larger on the machines Low is
  for. Not looked into: the far ground's pieces and the far trees are the
  likely draws. One landscape measured.
- [ ] **A course takes about a second longer to load than 0.9.14** (found 13
  November 2026). 0.56 s of it is the ground shader the surroundings rework
  grew (measured); the rest is not found. docs/history/SURROUNDINGS.md, *The
  second of course load*.
- [ ] **A load of the game runs in one of two modes on the owner's machine,
  and nobody knows why** (found 14 November 2026; the same in 0.9.14). Card-bound, or
  held up on the processor's side with the card two-thirds busy and the frame
  up to twice as long for the same draws; it comes in runs. Seen only in
  headless Chrome with the frame rate uncapped, so it may be the harness and
  not what a player gets. Every frame comparison needs four loads a build
  until it is understood. docs/history/SURROUNDINGS.md, *A load runs in one
  of two modes*.
- [ ] **The `phone-portrait` smoke journey failed once** (19 November 2026,
  the full run on the camera build): "one tap further moved the target 0.30
  yd, not 1" -- the aim pad steps a foot inside 20 yd, so the tap on the
  course before it had landed near the ball. Run again alone on the same
  course (`--endless-seed DRIFT-3902-1`) it passed. Where the tap lands
  depends on the camera at that moment; a step that waits for the camera to
  settle, or taps far enough out, would end it. bench/ab/smoke-camera.txt
  (local).

- [ ] **The `look` smoke journey failed once** (fairway-tour's final build,
  18 November 2026, 12:36 run): "six putts from two yards and the ball never
  dropped", on an Endless hole (seed WINDROW-5141-2, hole 2). Passed 4 of 4
  alone straight after, and in the full runs before and after (46 of 46,
  13:16). The step putts straight at the cup with a fixed pull, so a steep
  green can beat it; not shown, as the screenshot was overwritten by the
  passing reruns (the journey writes one file name). A person's putt runs no
  code the branch changed that day. Where: tools/smoke.mjs, *holing out
  plays a flourish over the cup*.
- [ ] **The `no-late-shaders` smoke journey failed once** on round F3's build
  (Ultra, a drawn Lowcountry nine, seed HOLLOW-1812: one lit shader built 142
  ms after the course appeared), passed ten times alone, and passed in the
  full run on the released build. Not traced. tools/late-shaders.mjs lists
  what a named course builds late.

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

- [ ] **The pull-and-push swing, on the owner's iPhone** (branch
  `pull-push-swing`, 15-17 November 2026; RESEARCH *The pull-and-push
  swing*). The owner swung it on the phone and the PC, with a controller,
  and signed off the rest on 17 November (DONE, same heading). Still open:
  - **The CARRY and TOTAL chips** (17 November): checked by the smoke
    harness, not yet seen by a person. Each is written once, when the ball
    lands and when it stops. The PULL chip before them is gone (the owner,
    same day), also not yet seen by a person.
  - **The meter skins colour nothing now.** They coloured the three-tap
    bar, which is gone; the rewards still unlock them and the Look tab still
    shows them as "The Swing Meter's look". For the owner to decide: the pad
    wears them, or they are retired.
  - **For the owner to decide:** whether putts' lines come back on the
    course between putts (they are kept only for the hole's summary).
  - **phone-landscape failed once in three runs** (17 November 2026). Its
    first shot struck and stopped, with CARRY 172 and TOTAL 190 written and
    the shot card up. Skip was then tapped, and the game still said the ball
    was in flight 30 s later; nothing errored. It passed in the full run
    before and in a run alone after. Not found: whether the tap missed
    (the report row above the button changes as the numbers arrive) or the
    flight's end waited on something.
  - `lab.state().lastStroke` holds the last reading, with its sample count.

- [ ] **Play the current build by hand** (0.9.19, 19 November 2026). What has
  been built and seen only in captures, measurements or smoke runs, and still
  exists in the game. The archive has each item's full list.
  - **Release 0.9.19** (19 November 2026: the Fairway Tour merged; the
    computer golfers' features marked BETA). Every smoke journey on the
    release build is in DISTRIBUTION_REVIEW's addendum. The owner played
    on the branch on the phone and a Mac mini (the order of play "works
    flawlessly"; the rings, the orange line and the hidden computer aim
    liked); none of what follows was looked at item by item.
  - **Order of play** (0.9.19). Play's Rules step, *Order of play*: *Rules
    of golf* (honours, then the ball farthest from the hole) or *Hole out
    in turn* (the default). Tested in tests/play-order.test.mjs and the
    round matrix, every format with both orders; the `relief` smoke
    journey checks the setting is on screen; no journey plays the *Rules
    of golf* order. To check by hand: a scramble of two teams taking
    turns; a ball out of bounds off the tee waiting for the others; the
    choice kept for the next round. Other golfers' balls are not drawn
    while they wait (as in match play), which may read oddly with turns
    passing every shot.
  - **Follow the flight again, and a putt camera that stops** (0.9.19).
    Camera settings, *Shot camera*: *Follow the flight* (default) or
    *Television*. Tested in tests/chase-camera.test.mjs. To check by hand:
    a drive, a curving shot and a pitch past the pin -- the camera trails
    and never swings round; a long putt -- the camera glides after the
    ball and stops 2 m short, then only turns; a short putt -- no move;
    Television as before; the review fly-up after a full shot with either.
    Frame figures in RESEARCH were taken with the television camera.
  - **Bold putting rings, a blaze-orange aim line, no aim line for a
    computer golfer** (0.9.19; the owner liked them on the phone). Tested:
    which ring lights (tests/putting-rings.test.mjs). Not looked at item by
    item: Dartboard's three rings, only the inner one round the ball lit;
    no map aim mark on a computer golfer's turn. The fat rings are a
    renderer change on every tier: frame cost not measured (a profile
    needs the owner's word).
  - **The Fairway Tour and computer golfers, by hand** (0.9.19, BETA in the game; built 17-18 November 2026;
    PLAYING *Computer golfers*, *Handicaps and Stableford*, *The caddie and
    strokes gained*, *The Fairway Tour*). **Seen in smoke journeys, not by a
    person** (cpu-group, tour-event, net-stableford, tour-file; their
    pictures in bench/shots/smoke): a computer golfer made in the seat
    editor playing its hole out and handing the turn over, its turn card
    and flight; a Quick season's hub, an event started, the field made
    ready, the group of four, the leaderboard line, the first shot; Play
    offering Stableford and Net, a net Stableford round with its strokes,
    the caddie's line; the editor, a tour shared and opened again.
    **Not seen at all**: whether computer golfers feel like real players
    over a whole round (their pace, the three watch settings, their words);
    Adaptive in a round; their relief and a computer team's scramble pick
    on screen; a reload mid-hole replaying a computer golfer's shot; a whole
    event -- four rounds, the cut, round complete's event block, the next
    event, a season's end and the next season; the XP popup and the tour
    achievements; My profile's Fairway Tour and Strokes gained sections;
    round complete's strokes gained and net ranking; the typed handicap
    box; the builder's test round with its new golfers (about 11 s for a
    nine, slower than before); a built course in a tour file.
  - **The Fairway Tour, not built** (0.9.19; each written up in RESEARCH or
    PLAYING): your playoff is drawn, not played on the course; the
    scorecard's stroke dots and net row (round complete shows net totals;
    the card is gross); net skins during the round (the mid-round skins line
    counts gross; round complete's is net); pictures for the event cards in
    a tour file; a full 3.2 GB tour file written and read in a browser (the
    ZIP64 path is tested on a small file); the hole model checked against
    the computer golfers' own rounds hole by hole; the bogey golfer's
    rating offset fitted (rating.js `OVER.bogey`, placed).
  - **The swing report's last change** (0.9.18; the owner swung the pad on
    the iPhone and the PC and signed it off on 17 November, DONE *The
    pull-and-push swing, on the owner's iPhone*): the Carry and Total chips
    filling in on landing and stopping, and the row without the PULL
    distance, seen only in smoke pictures.
  - **The woods past the property line** (0.9.17; seen in captures of all
    fifteen landscapes and one built course, DONE *The course's woods
    carried past its line*): a round played near the boundary on a wooded
    landscape, on the PC and the Phone setting; a built course with Trees
    set to No trees.
  - **The phone** (0.9.16; played on the owner's iPhone, Pacific Northwest
    and Redwood Coast only, and the owner signed off the painted ground, the
    trees from above and the green lines): the Phone setting on the other
    thirteen landscapes; the green reading on by default on the PC, and the
    downhill markers' new speeds there; Measure and Watch this device on a
    PC; any Android phone.
  - **The surroundings and the faster trees** (0.9.15; the owner signed off
    the look on 13 November and found every landscape faster on the branch
    the same night; the released build has two changes after that, neither
    played). **Trunks on High and Ultra swap to their far copy with no
    fade**: walk or fly toward a wood and watch for a trunk popping or a
    crown left without one. **Shadows far off come from one mesh a kind of
    tree**: look for a shadow missing or doubled across a valley. The
    builder's Surroundings block has not been used by a person. Eleven of
    the fifteen landscapes' final pictures were not looked at one by one.
    **Frame rate was measured on one desktop graphics card only**: no
    phone, no laptop, no machine without a graphics card.
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
