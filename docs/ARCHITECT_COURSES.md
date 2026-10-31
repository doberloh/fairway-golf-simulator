# Architect courses

Branch `architect-courses`, begun 30 October 2026 from main at 239fbfb
(generator 52, schema 11), under the owner's goal to build the whole local
study `docs/studies/HUMAN_BUILT_COURSES_SPEC.md` (not committed; pass 9),
phases 0 to 7 in order. **This page is the committed record: what was built,
the decisions taken, what was rejected, where the build departed from the
study, and the GPU and Blender logs. Read it first whenever the work resumes.**

The aim: a second way to build a course. **Classic** is the generator Fairway
has always had, every course grown from the studio's sliders, and it stays the
default and never changes. **Architect (beta)** designs a course the way people
build one -- a plan for every hole, every hazard placed against the shots
golfers play, greens designed round their hole locations, holes routed from a
clubhouse, then paths, stakes, walls, a history and some life -- from four
dials (style, club, age, heritage -- named the land's story until the owner's review), the seed, the landscape and the
number of holes.

## Status

| Phase | State |
| --- | --- |
| 0. The switch | built: the `designer` setting and the four dials, `ARCHITECT_VERSION` and the per-course stamp, saves, codes, files and challenge codes, the studio, a fingerprint per designer, the baselines; Architect builds exactly what Classic builds at its defaults |
| 1. Purpose | built: the golfer table, the styles, clubs and ages as settings, a plan per hole with every hazard placed against a shot and its reason recorded, templates, fairways that swell, neck and tuck, greens that drain off a corner, the hole sequence, the tree line, avenues and dogleg corners. Greens turned to the approach came with the surface field (phase 3) |
| 2. People | built: cart paths with bridges and free relief; hole names, flags by pin position and the crest for both designers; an Architect course's founding and the architect's note; stakes, yardage posts and rakes (ten iterations); the clubhouse, solid, one per landscape (ten iterations). The bridge deck became solid in phase 5 |
| 3. The field | built: collection areas (a hazard-slot kind), lobed bunker complexes, thin collars where fairways run into greens, divot wear; then the surface field (*Phase 3, finished*): the ground shader's tables packed to free texture room, a baked field the paint and the lie both read, up to 24 hazards a hole through it, greens turned to the approach, heights read as heights, the mower's line at native grass |
| 4. Home | built: routed from the clubhouse -- each nine pulled home toward its turn, the 10th tee at the clubhouse, every hole within walking reach of home. 10 of 12 nines home on the bench (Classic 7), 19 of 24 on eighteen-hole courses (Classic 10); Links the hard case. Not done: double greens (*Deviations*) |
| 5. Built | built: mounds by style as real ground (framing, spectator banks, chocolate drops); rip-rap or tie walls along the faced edge of a pond and fountains in big ponds; a bridge kit (ten iterations) whose deck is solid, a ball at rest on it in the penalty area; paths that cross creeks rather than run along them; the fairway tucks on the right side (a phase 1 bug). Not done: levelled clubhouse ground, feeder slopes and arroyos (*Phase 5*) |
| 6. Story | built: the land's story (field walls, a farmstead, ruins, a landmark, a stone circle and lanterns; solid where they stand; ten iterations), the land's templates (Dell, Alps, Barranca, Pit), the age dial's history (grassed-over bunkers, a felled avenue's stumps) and life (animals and distant people, never on Low; ten iterations). Not built: tiger tees, a later pond, a rebuilt green, plaques (*Phase 6*, second half) |
| 7. Occasion | built: tournament week on a Championship venue -- stands, a scoreboard, TV towers and marquees (solid), gallery ropes and a crowd that fills from Thursday to Sunday, never on Low (ten iterations); the yardage book, a PDF a page a hole from the pause menu |

### The owner's review (30 October 2026)

The owner played Architect courses and sent a list (screenshots of paths
through greens and "spaghetti", fountains standing still, rakes beside rather
than in bunkers, divots pointing anywhere, stumps in lines, Links' merged
fairways, the Alps' look, setting names and explanations, the people, mower
and crowd models, a live scoreboard, the yardage book in the studio, and
hand tools the generator uses too). Worked through in order; each below.

**Cart paths, rebuilt** (ARCHITECT_VERSION 15; six iterations, the owner
asked for five). The old router pushed each point sideways off whatever it
landed on and joined holes with straight connectors -- zigzags, paths over
greens and tees, connectors across every hole between. Now a cost grid
(6 m) and A* (paths.js `costGrid`, `lineOf`):
greens, fringes, tees, sand and ponds blocked, with a dear margin a cell
wide; fairway x9 and semi-rough x5; up to +8 within 22 m of a green's
collar; ground steeper than 22% barred (end to end and through each step's
midpoint); ground already paved cheap (x0.3), so legs join one network.
Each hole: a leg from beside its tees to a pull-off well off its green, and
on to the next tee. The cells pulled straight wherever a run of up to 24
cells is no more than a little dearer, then rounded corner by corner.

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | numbers, four courses | nothing on any played surface, nothing within 10 m of a green; 1-6 sharp turns; 4-12 steps steeper than 25% (the straightening checked ground, not grade) |
| 2 | numbers | grade checked on straightened runs: steep steps 0-4; sharp turns 6-19 (a whole line fell back to its corners when any rounding failed) |
| 3 | numbers | rounded corner by corner: sharp turns 2-9; one sample brushed a bunker's edge |
| 4 | numbers | a margin round everything blocked: nothing touched; steep steps only on Redwood |
| 5 | game (`arch-pv5`: Redwood, Midwest, Links) | **Links: a gravel path sweeping round behind the green**, well clear of it and its bunkers; Midwest clear of green and fairways but with hard jogs where a straight run was refused for brushing a green's berth; a 30% step on a Redwood crag edge (the midpoint now checked against the real ground) |
| 6 | game (`arch-pv6`) | runs up to 24 cells and a little dearer: Midwest's path one smooth sweep round its green; steep steps 0 on every course, sharp turns 3-11 an eighteen |

Also: **paths on the map** (renderer.js `drawMap`, under the holes, at
their width) and **painted surfaces** (`pathTexture`: asphalt's chips and
edge lines, concrete's joints, gravel, shell, bark chips, granite, a
boardwalk's planks). The clubhouse's link is routed the same way. The walkers
go one way along the longest piece and round again (the owner: "no reason
they would be walking reverse"). **A path bridges a ravine wall to wall**:
the ravine's cells are exempt from the grade rule (the deck is level), so
the router no longer always walked round a Barranca's end and never built
its bridge (found by the template test, `tests/story.test.mjs`).

**Rakes in the bunkers** (the owner: "I'm a rakes go in the bunker kind of
person"): halfway in from the edge on the side away from the green, laid
across the sand (markings.js). **Divots point at the green**, with about
nine degrees of spread either way (they pointed anywhere). Tests: every rake
on sand at least a metre in; nine in ten divots within 16 degrees of the line
to the green.

**Trees sized by the course's age** (the owner: "can course maturity also
determine tree size?"): New 0.68 of full height, Mature 1, Old 1.18,
Restored 1.08, the crown's spread following at 70% of the change; ground
plants, brush and cholla unchanged. PLACED. **A restored course's stumps
scattered** (they stood in a line down the fairway, where the felled avenue
had been): 3-7 a hole, 6-40 m out past the semi-rough, a third in pairs.

**The dials explained**: each Architect choice shows a sentence under its
list saying what it does to the course, kept current as the choice changes
(settings-schema.js `describe`, main.js). **"The land's story" is now
"Heritage"** (the owner did not like the name).

**The arrows on the water** (screenshot 2) are the creek's flow ripples,
main's since the first commit (water-bodies.js `STREAM_FLOW`), on Classic
too. **Removed** at the owner's word ("We don't need them"): the chevrons on
creeks and rivers, for both designers; the drifting foam stays.

**Links: fairways joined in pairs only** (the owner, Links style, Members',
Old, A lot, 9 holes, ST-1: "one massive hole with 4 combined fairways ... I
do really like it"). Kept, but on an Architect course each fairway joins one
neighbour at most -- the longest joins first (course.js `shareFairways`,
`pairs`). On the owner's course holes 2, 3, 7 and 8 were one field; now 2+3
and 7+8, more than 20 m of rough between the pairs. Classic is unchanged.
Measured on six more seeds: never more than two holes to a fairway.

**The Alps, a broad hill** (the owner, PNW: "a really weird look"): the
ridge was 13 m wide for 5.5 m high -- a 66% face, a crease at its crest, and
round caps standing up either side of the fairway. Now 24 m for 5 m (about
a third), and every ridge (the Dell's dune too) fades into the land over the
outer quarter of its length at each end (architect.js `earthField`). Seen in
the game (`arch-alps1`, PNW P-2 hole 11): a rolling hill across the approach.
PLACED.

**The fountain, animated** (the owner: "it's probably not a Blender static
model, right?" -- it was). The renderer now draws moving water
(fountain.js, `Renderer.addFountains`): 480 drops flying parabolas from the
nozzle, apex 3.0-4.2 m, landing 0.3-3.2 m out, each stretched along its
flight; a jet core that breathes; a foam boil; three rings spreading; a
flickering skirt of foam where the crown lands. On every tier, at 30 updates
a second on Low; at most two a course. The Blender plume is gone (52 KB
off the bundle). Sizes PLACED from makers' pictures of 1-2 hp pond
aerators.

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | game (`arch-f1`, Midwest resort) | it rises and falls and the rings spread; the drops read as **popcorn**, the plume a narrow column |
| 2 | game (`arch-f2`) | smaller drops stretched along their flight, the crown landing wider: reads as spray, but a loose cloud from 30 m |
| 3 | game (`arch-f3`) | a translucent veil round the plume: **read as a glass dome**, dropped |
| 4 | game (`arch-f4`) | no veil; 480 drops and the jet up to the crown: a fountain from 11 m and from across the pond. Checked moving: one drop rose 3.1 m in 0.7 s, the jet's height changed |
| 5 | game (`arch-f5`) | a flickering skirt of foam where the crown lands: the plume stands on white water |

**The people, the mower and the crowd** (the owner: "need more iteration and
variety", "the mower does not look like a mower ... research as well",
"crowds need more variety"). One cartoon body for every figure
(tools/blender/figures.py): poses (walk, stand, clap, cheer, push, pull,
umbrella, seated), hats (cap, visor, sun hat, bucket), a skirt and
ponytail, eyes, a belt, a carry bag, push and pull trolleys, a golf
umbrella. Four walker bodies (bag, push trolley, pull trolley, bucket hat
and bag) and five spectators (cap; sun hat and skirt; umbrella; clapping in
a visor; a child cheering). The game dresses each figure from palettes --
six skin tones, eleven shirts, seven trousers, eight hats with matching
bags or umbrellas, six hair colours -- by a hash of figure, body and role
(renderer.js `PEOPLE_PALETTE`). Each body is drawn at its own measured
height (the ingest records `tall` for the people), a twentieth larger than
life for the walkers. Walkers bob and sway a little as they step; a fourball
now, not three. Spectators turn a little each; umbrellas only in the
standing gallery. **The mower** is a five-unit fairway reel mower from the
makers' figures (RESEARCH.md, *A fairway mower*): 2.58 m long, 2.59 m wide,
2.32 m to its canopy; three reels in front, two between the wheels, big
lugged front tyres under fenders, small rear ones, a seat, a column and
wheel, a roll bar with a sunshade, headlights, a greenkeeper in a hi-vis
shirt. It runs only on mown rough, and there is none on a landscape whose
rough all grows tall (Links, Lakeshore) -- it had waded through Midwest's
prairie and Links' marram.

### Blender and game iterations: people, mower, crowd (the owner's review)

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | sheets | walkers read as golfers (cap, bag with club heads, trolleys), the crowd as five people; the mower reads face-on (roll bar, tyres, reels). The umbrella's shaft ran in front of the face; a blob in front of the seat hid the driver's legs |
| 2 | sheets | stouter legs; the umbrella held to the side, smaller; a footplate for the blob |
| 3 | game (`arch-p3`, Midwest, Sunday) | the walkers' colours vary; the mower reads as a fairway mower; **the driver's shins showed under the mower**; the child and the umbrella were stretched to one height |
| 4 | game (`arch-p4`) | every body at its own measured height; the driver's feet on the footplate; the pull trolley's bag full size |
| 5 | game (`arch-p5`) | eyes, belts, ponytails; a sunshade canopy and headlights on the mower; walkers bob as they step. The push-trolley golfer reads side-on |
| 6 | game (`arch-p6`) | a fourball; spectators turned a little each. **Too many neighbours in the same navy shirt** |
| 7 | game (`arch-p7`) | colours by a hash (the stride had lined up across the five bodies): neighbours match as often as chance, 47 in 499. Stands full of colour -- and **a fifth of each stand under umbrellas** |
| 8 | game (`arch-p8`, and `arch-p8low` on Low) | umbrellas only in the standing gallery; Low draws no crowd and no walkers, as before |
| 9 | game (`arch-p9`, Links, Saturday) | the people read in Links' light; **the mower waded through marram** |
| 10 | game (`arch-p10`, PNW) | the people read in PNW's darker light |

The mower's own last three: 8, lugged turf tyres with grey rims and painted
hubs (plain discs read as black plates); 9 (`arch-m9-80`, `arch-m9-200`),
fenders over the front tyres and spiral blades on the reels -- side-on every
part reads, **but it was in Midwest's prairie**; 10 (`arch-m10`), its run
on mown rough only: working the rough by the trees.

**The scoreboard, live** (the owner: "Can we make the scoreboard on
championship day actually show the players score?"). leaderboard.js makes
the board from the round -- the golfers' scores to par today and holes
played, ranked among an invented field of seven (made-up initials and
surnames, one surname a board) whose scores advance hole by hole a hole or
two either side of the golfers; ties shared, under par in red, F for a
finished round, the golfers highlighted and never pushed off the board.
main.js feeds it whenever the scores change (`updateBoard`, from
`drawScoreChips`, and when a course is built); the renderer paints it on a
canvas over the model's white face, redrawn only when it changes. Seen in
the game (`arch-board1`: at the start of a round, everyone level; `arch-board2`:
a board set by hand mid-round, to see red numbers and ties). Not seen in a
played round. The field's spread of scores is PLACED.

**The yardage book in the studio** (the owner: "Need to be able to see the
yardage book in the course builder"): a *Yardage book* button in the
studio's bar and a row in its pause menu, for an Architect course, giving the
book of the course on screen -- the built one, not settings changed and not
yet regenerated (main.js `downloadYardageBook`, shared with the round's
menu). The `architect-studio` smoke journey presses it and checks a PDF
comes back, and checks the dials' sentences: passed on the GPU.

**The hand tools** (the owner: "Let it hand make bunkers, as well as greens,
slopes, fairways ... Make sure we don't break classic mode", and "I want the
generator to be able to use them as well"; ARCHITECT_VERSION 16,
SCHEMA_VERSION 13). hand-tools.js holds four shapes as small records in a
hole's own frame -- metres from the back tee, metres right of the line, so a
feature stays put however the hole is routed: a **bunker** (size, roundness,
0-3 lobes), the **green** (a scale on its size, its shape, a contour: as
designed, tilted, tiered, ridged, crowned, bowl, punchbowl, raised), a
**mound or hollow** (size and rise, -4 to +4 m) and a **fairway width**
change over a stretch. `applyHand` lays them on an Architect hole in
architectCourse, before the pin is chosen; mounds and hollows join the
world's earth field. Two hands use the same records:

- **The person**, in the studio's settings, Architect tab, *Hand tools*:
  pick a hole and a tool, set its sliders, or fly to a spot and press *Aim
  where I'm looking* (the hole and position under the middle of the view,
  `Renderer.groundAhead`), then *Add to this hole*; the hole's list shows
  each with a remove button; Grow applies them. Stored as the setting
  `archHand` -- the schema's first list (`kind: 'hand'`) -- so a saved course
  and a course code carry them (codes are JSON; an empty list is left out).
- **The generator**, from the seed: a third of holes get a signature by
  style (`designerHand`) -- a waste area of three or four bunkers run along
  the fairway's edge, a hogsback of mounds down the drive zone, a saddle of
  two framing mounds with the fairway narrowed between, spectacles (two
  bunkers side by side short of the green), a punchbowl green with a rim of
  mounds, or a tiered green with the approach widened. **Not on a landscape
  whose fairways run together** (the North Sea Links): its shared fairways
  are its signature, and a generated hogsback and punchbowl took both of the
  owner's ST-1 pairs apart (found by the pairs test). The person's hand
  tools still apply there.

Classic never reaches `applyHand` (only architectCourse calls it): the
Classic fingerprint is unchanged and a test builds a Classic course with
hand features set and finds it identical.

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | game (`arch-hand1`, Midwest HT-2 hole 2, with and without) | the hand bunker with two lobes reads as one cloverleaf of sand mid-fairway; the landing area visibly wider; **the 3 m mound invisible from above** (measured there: 2.96 m at its centre) |
| 2 | game (`arch-hand2-1`, `-2`: eye level) | the mound reads as a grassy hill with its own shadow; the punchbowl green sits sunk below its surround |
| 3 | smoke (`architect-studio`) | the interface driven: Hand tools shown, Aim, Add, the list, Grow, and the saved course carrying the bunker: passed |
| 4 | smoke picture (`bench/shots/smoke/hand-tools.png`) | the panel reads, and the studio lists "Hand-shaped features 0 -> 1" as a change; **the list said 8 m for a 7 m slider** (it had snapped to 7.5 on a 2.5 start) and the Hole and Tool names were small |
| 5 | game (`arch-hand5`, `-5b`: SIG-2) and numbers | labels follow each slider's real value; the generator's spectacles read across the fairway; **its waste areas sat 30-36 m off the line**, under the trees beyond a narrow fairway -- now laid along the fairway's own edge (four bunkers biting about 2 m into it, measured on two holes) |

Cost: the generator's signatures add a few bunkers and mounds to a third of
holes (no measurable wait); the hand list is applied once a hole.

**Twelve hazards a hole, found after** (ARCHITECT_VERSION 17): the ground
shader draws at most twelve hazards a hole (ground.js `HOLE_ATLAS`), and the
architect designs to that (`MAX_HAZARDS`), but the signatures and the hand
tools were laid past it -- 9 holes in 432 had 13 or 14, the extra bunkers
playing as sand and never drawn. Found counting hazards while writing the
custom-course study. 17 stopped `applyHand` at twelve; since 18 the bunkers
past the slots are drawn and played from the surface field and the limit is
24 (*Phase 3, finished*). A test builds courses with twenty hand bunkers on a
hole and holds every hole to the cap and its slots to twelve; the studio
refuses a bunker on a full hole with a message.

Cost: walkers and spectators are one instanced mesh per body part per body,
coloured per instance (no extra draws for the colours); the crowd five
bodies (was one), so five times the crowd's draw calls on Medium and up
(none on Low, where no crowd is drawn). Not profiled.

### Where the goal stands (30 October 2026, after the owner's review)

**Met** (each figure re-measured on the final code, 30 October 2026, after the
last change): every phase built and documented, and the owner's review list
worked through (above); npm test (1,226 since the surface field) and the build pass; the round
matrix (now on a real Classic and a real Architect nine too) and the virtual
golfer run on both designers -- **Architect 0.17 strokes per 18 harder**
(limit 1.5; -0.07 after the surface field); Classic's fingerprint unchanged from the start; the bench moved
(bunkers by a landing zone 80% against 27%, nines home 11 of 12 against 7);
**frame time on Low at or below Classic's in every landscape** by mean and by
median (the final run: processor -38% to +0.3%, graphics -48% to +0.4%);
**an eighteen builds at most 0.75 s slower** on
Architect (PNW; 0.84 s after the surface field; limit 2 s); **every smoke journey green**
(41 of 41 after the surface field; 40 of 40 on the graphics card, on the final code, the played-round journey
`architect-tournament` included -- `ball-light-hole-out`, which had failed
about 3 runs in 8 on main too, FIXED: programs first drawn only in play, a
pond out of view from the tee or a planting the cull had hidden, are now
drawn once behind the loading screen, PROJECT_HANDOFF *EVERY PROGRAM IS DRAWN
ONCE BEHIND THE LOADING SCREEN*; 20 runs of 20 passed after); the showcase saved
(docs/reports/architect-showcase/, local, 32 pictures): a hero hole in every
landscape (seed SC-3, each landscape's own style), four Classic-beside-
Architect pairs on that seed (Midwest, Autumn, Links, PNW), the Redan, Dell,
Cape, Pit, Barranca and Alps, a contact sheet for each of the six kits, first
against final for the fountain, the mower and the gallery, and ten course
codes to paste into the game (made by the game's own exporter; each checked
to import back as an Architect course).

**Moving, measured** (30 October 2026, the final code, Medium tier): every
animal and person's matrix read twice a second apart while the game ran --
Midwest 52 of 52 instances moved (deer, geese, the fourball, the mower;
longest step 1.8 m), Links 47 of 47 (sheep, gulls, the fourball; a circling
gull 10.6 m). The fountain likewise (a drop rose 3.1 m in 0.7 s). The bench on
the final code: bunkers by a landing zone 174 of 217 (80%) against Classic's
24 of 89 (27%), nines home 11 of 12 against 7, median walk 93 m against 98,
four to six concepts a nine, every invariant clear.

**Seen working in the game** (GPU captures, stills, and the smoke journeys'
clicks): every Blender kit in its landscapes and on Low; the rebuilt paths,
bridges, markings, clubhouses, mounds, pond edges; the fountain moving
(measured, a drop rising); walls, farms, ruins, landmarks, the stone circle;
the Dell, the Alps as a hill, the Barranca, the Pit, the Redan, the Cape;
the new people, crowd and mower; tournament week with the live board; the
hand tools driven in the studio (Aim, Add, Grow, saved) and their shapes on
the ground; the studio's yardage book downloaded; **a round played on an
Architect Championship course** (smoke journey `architect-tournament`:
from Saved courses, hole 1 played and holed out) **with the scoreboard
following it** -- before a shot the golfer on the board at "-", after the
hole-out "E, thru 1", the same score as the golfer's chip in the top bar. And **a hand-shaped
hole played through** (smoke journey `architect-hand-round`): every hand tool
on hole 1, two full shots, a drop by the pin of the punchbowl green, putts to
the hole-out, no error. After the surface field (GPU captures): a green turned
to its approach, from above; the step of the mowing heights at a fairway's
edge; the mower's line at native grass on Midwest; a bunker drawn from the
field. **Not seen by anyone**: a ball in a field bunker or on a turned
green in a round (the lie tested in Node);
anything played by a person; the walkers and animals in motion looked at
(measured moving, above, but seen only in stills); a ball against a wall, a stand or a bridge deck in a round
(Node tests only). The journeys' rounds, the hand-shaped one included, are
scripted: no person has played one.

## The owner's decisions (the goal text, 30 October 2026)

- Name "Architect", an option labelled beta. **Classic always exists and stays
  the default.**
- Classic gets only the free extras -- flags coloured by pin position, hole
  names, a crest -- and its ground fingerprint never changes; an extra that
  would move it stays out of Classic, with the reason written here.
- An Architect course is chosen by style, club, age, story and seed; landscape
  and 9/18 holes stay; wind and pin day stay round conditions. The architect
  decides everything else -- length, elevation, bunkers, trees, houses, water.
- Surprise me, the course of the week, the Challenge Course and endless runs
  stay Classic.
- Architect plays at most **1.5 strokes per 18** harder than Classic for the
  virtual golfer.
- Walls, buildings and stands are solid: a capsule or box in the one collision
  index. Rulings as the study's table.
- Island water stays on the coast. Animals and distant people, calm, none on
  Low. Tournament dressing on Championship venues only. Haunted Hollow: ruins
  and lanterns, never graves.
- All twelve styles; Golden Age, Links and Parkland first.
- GPU and CPU free to use without asking, when the computer is free; the card
  read first, a busy card waited out; a crash pauses GPU work, a second ends it.
- Every Blender asset at least ten iterations, logged here.
- The showcase is local and short (about thirty pictures); the rest is for the
  owner to find in the game.
- No merge, push or release.

## Decisions taken from the study

Each is the study's recommendation, taken because the owner's goal said to
choose by it.

- **One pipeline with a switch at each decision, not a copied generator.**
  The study's reason holds: a copy means every terrain, water and speed fix
  made twice, and drift. Where the designers differ is a named seam
  (PROJECT_HANDOFF *TWO DESIGNERS, ONE WORLD*).
- **Architect's random numbers are its own** -- named streams per step and per
  hole (`seed|arch|<what>|<hole>`), never Classic's stream.
- **Phase 0 builds an Architect identical to Classic** at its defaults, so the
  plumbing is proven before any decision changes.

## Built

### Phase 0: the switch (30 October 2026)

- **The settings** (settings-schema.js): `designer` (Classic, Architect (beta);
  default Classic) and the dials `archStyle` (By landscape or one of twelve),
  `archClub` (Municipal, Members' club, Resort, Championship venue), `archAge`
  (New, Mature, Old, Restored) and `archStory` (None, A little, A lot), in a new
  studio heading, *Architect (beta)*. A choice field may carry `names`, the
  words a player reads; the values are what saves carry. SCHEMA_VERSION 12;
  the migration writes nothing, because a save without a designer takes the
  default and so is Classic.
- **What Architect keeps** (`ARCHITECT_KEEPS`): the designer, holes, seed,
  landscape, the four dials, wind, wind direction and pin day. Everything else
  is the architect's (`DECIDED_KEYS`), hidden in the studio and overwritten in
  generation.
- **designer.js** `designSettings`: Classic settings come back as the same
  object, untouched -- which is the guarantee that Classic cannot move;
  Architect settings get the architect's values for every decided key. It is
  idempotent and called at every entry into generation (`planCourse`,
  `planScorecard`, `generateCourse`, `routeHoles`, `generateWorldSteps`).
  `designerScope` drops the decided keys from what a saved course or a code
  carries: they are recomputed on load.
- **architect-styles.js**: the twelve styles as records, the styles each
  landscape leans toward (`BIOME_STYLES`, the study's landscape table), the
  fallback for a landscape without a row, and `styleOf` (By landscape draws
  from the seed on its own stream). `architectChoices` is phase 0's: Classic's
  defaults.
- **The version stamp.** `ARCHITECT_VERSION` = 1. A course keeps one integer,
  `generator`, as it always has: Classic's is `GENERATOR_VERSION`, Architect's
  `GENERATOR_VERSION*1000 + ARCHITECT_VERSION` (`generatorFor`). Saves, saved
  courses, course files, course codes, challenge codes, the diagnostic report
  and the world cache key all use it; the stale-course notices compare a
  record's stamp with `generatorFor` its own settings.
- **The fingerprint** learned `--designer architect`, with its own store
  (`bench/biome-fingerprints-architect.json`); Architect's two seeds vary the
  dials (defaults; championship, old, a lot). Classic's check unchanged.
- **The studio** shows each designer its own controls (`shownFor`), keeps the
  scorecard for an Architect course without its length controls ("The
  architect sets the length from the style and the club"), and redraws when
  the designer changes.
- Tests: tests/designer.test.mjs.

### Phase 1: purpose (30 October 2026)

ARCHITECT_VERSION 2. Classic's fingerprint unchanged throughout.

- **The golfer table** (`tools/golfer-table.mjs` -> `src/golfer-table.js`):
  three golfers flown once through the ball model. Drives of 277, 224 and
  195 yd in total (RESEARCH *Architect courses: designing a hole*).
- **The dials as settings** (architect-styles.js `architectChoices`): each
  style's settings and its architect's own figures (`arch`: share of bunkers
  at the drive, bunker size, centreline and cross-bunker chances, template
  chance, concept weights); the club's length (6,250 to 7,250 yd for
  eighteen) and multipliers; the age's trees; the story's creek. Each style's
  bunker count was lowered once after the first count came out at 72-110 a
  course against a real 49-66 (now 44-80; Links about 107, as the Old Course's
  112).
- **The plan per hole** (architect.js `designHole`, through the seam
  `architectCourse` in course.js): a concept and, by the style's chance, a
  template; the preferred side; the landing zones from the golfer table; water
  first (a cape, a heroic carry, a go-for-it second, a par three's short side,
  a bail-out's price), then the drive bunkers, the lay-up's cross bunkers, the
  green's guard -- the front corner on the wrong side always -- and the
  templates' own sand. Every hazard records its reason; at most twelve a hole
  (the shader's limit). A heroic hole or a Cape needs water to carry, so
  without inland water neither is chosen.
- **The fairway** swells at the landing zones, necks before the green, and
  tucks round a bunker on its edge (a collar of 2.2 m of rough between turf and
  sand); a centreline bunker is not tucked (PROJECT_HANDOFF, the trap under
  *TWO DESIGNERS, ONE WORLD*).
- **The green** (course-plan.js `greenRecipe`, the seam): drains off a front
  corner, higher at the back; a Redan falls away on a diagonal; a Biarritz
  gets its swale; a punchbowl is sunken; a double plateau is tiered.
- **The sequence** (architect.js `sequenceCourse`, in `planCourse` so the card
  holds): a gentle opener, a strong finish, a short par four on the back nine,
  the par threes spread across their band.
- **The trees**: the open scatter cleared to a scalloped line instead of a fade
  of chance; avenues on Parkland, Golden Age and Raynor courses (more the
  older the course); a cluster at a dogleg's inside corner
  (architect.js `designedPlanting`).
- **The bench** learned `design` (tools/metrics.mjs): drive bunkers by a
  landing zone, green-to-tee walks, returning nines, concept and template
  variety, and the invariant *hazardWithoutReason*.
- **The surface map** tool takes `--set key=value`, so it draws Architect
  courses.
- Tests: tests/architect.test.mjs.

### Phase 2: people, first half (30 October 2026)

ARCHITECT_VERSION 3. Classic's fingerprint unchanged.

- **Cart paths** (paths.js; absorbs IDEAS *Cart paths*): one path a course,
  down each hole on its bail-out side 14 m past the rough, round the hole's
  hazards, past the green to a pull-off and behind it, then straight on to the
  next tee; smoothed twice; pushed sideways off greens, tees, sand and water;
  2.1-3.0 m wide by club; made of asphalt, bark, granite, shell, gravel or
  boardwalk by landscape. About 4.3 km for nine holes. A new ground type,
  `path` (grounds.js), the hardest surface in play; not natural ground, so
  nothing is planted or built on it. The renderer lays a strip on the same
  polyline. Free relief (relief.js `pathRelief`), taken for the player.
- **Bridges** (absorbs IDEAS *Bridges over creeks*): wherever the path crosses
  a creek or river, a plank deck with rails, drawn procedurally until the
  Blender bridge kit replaces it (phase 2's second half).
- **Free extras for both designers**, read from the built course and never in
  the world, so Classic's fingerprint cannot see them: **flags by pin
  position** (red front, white middle, blue back; course.js `PIN_FLAGS`),
  **hole names** (hole-names.js) in the hole panel, and the **crest**
  (crest.js) on the final scorecard.
- **Architect only**: the founding year and made-up architect (crest.js
  `courseIdentity`) on the final scorecard; the architect's note said as each
  hole is arrived at (main.js `architectNote`).
- Tests: tests/paths.test.mjs, tests/hole-names.test.mjs; smoke unchanged
  (no journey plays a ball onto a path).

### Phase 2: people, second half (30 October 2026)

ARCHITECT_VERSION 4 (markings), 5 (the clubhouse). Classic unchanged.

- **Markings** (markings.js; Blender pack architect_people, ten iterations):
  red stakes round ponds and along creeks near play, white stakes where the
  boundary nears play, yardage posts at 100, 150 and 200 yd, a rake along
  every bunker's edge; instanced, standing ones inked.
- **The clubhouse** (clubhouse.js; Blender pack architect_clubhouses, ten
  iterations): sited near the first tee and the last green, facing the tee,
  sized by club, terraced on a slope, a 40 m lawn kept clear, the path
  linked to its door. Solid: `world.buildings` boxes join the houses' box
  routine in physics.js, never out of bounds; drops avoid it (main.js).
- **The ingest's int16 box** (found on the rake): a per-model scale for the
  Architect's families; eleven shipped models wrap the same way (TODO).
- Tests: tests/markings.test.mjs, tests/clubhouse.test.mjs.

### Phase 3: the hand (30 October 2026)

ARCHITECT_VERSION 6. Classic's fingerprint unchanged.

- **Collection areas** (architect.js; the study, workstream D): on the styles
  that play along the ground -- Links, Sandhills, Minimalist, Golden Age,
  Heathland, Raynor -- an oval of fairway-height grass off the front corner
  the green drains toward (the other front corner when a bunker sits
  there). A hazard slot of a new kind: renderer.js writes it with meta.y -1,
  the ground shader paints it fairway over rough or semi-rough only, and
  course.js `localSurface` plays it the same way. It takes one of the hole's
  twelve slots.
- **Bunker complexes** (the study, workstream C): on Heathland & Sandbelt,
  Sandhills, Golden Age, Modern and Minimalist, about half the bunkers over
  7 m grow one lobe over their rim -- a smaller oval, a hazard of its own --
  so the sand has capes and bays. A fairway bunker's lobe grows away from
  the fairway. (The first count, two lobes on any bunker over 5.5 m, put 51
  on nine Heathland holes and doubled the sand.)
- **Thin collars** on Links (0.75 m), Sandhills (0.9 m) and Minimalist
  (1.0 m): the fairway runs on into the green, whatever the club mows
  elsewhere.
- **Wear** (markings.js `placeWear`; the study, workstream N): divots on the
  tees, thickest on par 3s (irons; USGA's par-3 tee area doubled for that
  reason), a few on every back tee and scattered in the landing zones, by
  club and age; one instanced mesh of small dark patches.

### Phase 3, finished: the surface field (30-31 October 2026)

ARCHITECT_VERSION 18. Classic's fingerprint unchanged. The owner, asked
whether to build the study's field or keep it as a deviation: "yes. Please
extend the limit on the surface fields. And leave room for more if
possible." Read as: build the field, lift the twelve-hazard limit through it,
and free texture room for the field's later layers.

- **Room first: seven samplers to four, then five.** The ground shader was at
  the budget its floodlight shadows were measured with (7 samplers of 16).
  The route curves, the per-hole table, the pond banks and the stream
  segments, four float textures, are one now (ground.js `packTables`, 1024
  floats wide, each table in its own rows; each was already laid in rows that
  divide 1024, so each copies in one block). The field takes one sampler;
  **two are free** for its later layers, on top of the one every tier keeps
  spare (tests/flood-shadows.test.mjs counts 5).
  - **A filtered read cost Classic 5-10% of its ground on Low.** The packed
    texture filters linearly, which the curves and banks need, and the hole
    table's thirty-odd reads a pixel went through the filter too. Read with
    `texelFetch` (GLSL ES 3.00, which three r186 compiles to): no filter, the
    exact texel, the old figures back (`tools/frame-ab.mjs`, Classic Low,
    old build against new, two rounds: mean frame -2%, within noise).
- **The surface field** (surface-field.js): a picture of the ground baked on
  the owner atlas's grid (1.75 m texels), one byte a channel, each a signed
  distance to an edge (0.5 on it; FIELD_RANGE 4 m either side, 3 cm a step,
  PLACED) so a linear filter draws a smooth edge. The ground shader paints
  from it and course.js `surface` plays from the same bytes, read the same
  way (`fieldAt`, as the blowouts are). **R: sand. G, B, A: free**, for the
  hand-drawn outlines, a native line or wear the sculpting and real-courses
  studies want. Classic bakes none and binds one empty texel the shader
  never reads.
- **The hazard limit, through the field.** A hole holds up to 24 hazards
  (hand-tools.js `HAZARD_CAP`, PLACED: twice the slots; past about two dozen
  a hole reads as a sand course). The shader's twelve slots take the
  collection areas, the ponds and the first bunkers; every bunker past them
  is marked `field` (`markOverflow`, after the hand tools) and drawn and
  played from the field. The lobes ARCHITECT_VERSION 17 trimmed are back,
  and a studio hole takes 24 hazards before it refuses one. The architect
  still designs to the twelve (`MAX_HAZARDS`).
  - **Seen**: a hole with sixteen hand bunkers (`arch-p3h`, Midwest, view
    `arch-field`): the field bunker drawn as a slot bunker is, sand, rake
    lines, lip and its rake. **Its outline is faceted** at the field's
    texel: a 4 m bunker spans about five texels and the filter is straight
    between them. A finer field (half the texel) would cost four times the
    memory; left as it is, the lie reading the same facets.
- **Greens turned to the approach** (the study, workstream A; architect.js
  `approachTurn`): the oval's depth laid along the line the second shot is
  played from -- the good player's drive on a par 4, the lay-up on a par 5,
  the back tee on a par 3 -- and on a strategic or heroic hole turned a
  further 0.35 rad (20 degrees) to open the green's length to the preferred
  side; the Redan 0.5 (29). Capped at 0.6 (34). All PLACED, by eye from the
  angled greens the study names; no source gives a figure. The turn is one
  number (`greenTurn`), in the pin texel's free fourth channel; the lie
  (`greenDistance`), the shape round a green (`greenPoint`, `greenOffset`:
  the greenside bunkers, the collection area, the three maps, the course
  picture, the yardage book, the green-reading heat map) and the green's
  fall, ridge, tier and false front all turn with it. Classic's turn is
  zero and **skipped, not multiplied by one**, so its arithmetic is the same
  to the bit (a test holds `greenDistance` to the old formula). Seen from
  above (`arch-turned`, Midwest).
- **Heights read as heights** (the study, D, pass 7): green about 0.15 in,
  fringe and fairway about 0.4, first cut 1.5, rough 2.5 (USGA; RESEARCH.md
  *Mowing heights*). Where a shorter cut meets a taller one, the taller grass
  shades the edge -- 30% at most on the short side, its lit tips 20% on the
  tall side, each scaled by the step in height (PLACED) -- over about two
  pixels, fading out past 0.5 m a pixel. Round 1 at 16% could not be seen
  at eye height; a debug build painting the reach red and blue confirmed it
  sat on every edge (`arch-p3f-debug`), and round 2 is seen (`arch-p3g`).
  Painted only; the lies were already per band.
- **The mower's line** (the study, D): where mown rough meets native grass
  (Links, Midwest, Lakeshore Dunes), the colour switches within 0.48-0.52
  of the field instead of 0.34-0.66, centred on the 0.5 the lie switches
  at, with a 20% shadow on the mown side and a 10% lit fringe on the
  native side. Seen (`arch-p3g`, Midwest): a clean cut edge.
- **Classic, measured unchanged**: the fingerprint silent; the same views
  from the last commit's build and this one (`frame-ab --shots`, Midwest,
  Low): 0.02-0.08% of pixels differ, below the 0.04-1.89% two runs of one
  build differ by (wind, water, clouds), frame time level.
### Phase 4: home (30 October 2026)

ARCHITECT_VERSION 7. Classic's fingerprint unchanged.

- **Routed from the clubhouse** (routing.js `homeArch`; the study, workstream
  F; ASGCA, *Solving the puzzle*: the clubhouse first, the 1st and 10th tees
  and the 9th and 18th greens round it). The first tee is the origin, where
  the clubhouse is sited. Each candidate placement of an Architect hole pays:
  - a pull toward home that grows through the nine (nothing on the first
    three holes, up to 2.6 a metre on the last);
  - for any hole ending further out than the holes left in its nine could walk
    back (about 300 m a hole, plus 140 m), eight a metre over, sixteen on the
    last hole;
  - for the green before the last, its distance from one last-hole length out;
  - on eighteen holes, the 10th tee's distance from home.
  An Architect course tries twelve routings, not five, and its last three holes
  of a nine 450 placements, not 150; the front nine's last green counts in
  choosing the routing.
- **What it bought** (the bench's `design` measure, standard tier, nine-hole
  courses): **10 of 12 nines home** (the 9th green within 200 m of the 1st tee)
  against Classic's 7; on eighteen-hole courses, six landscapes and two seeds,
  **19 of 24** against Classic's 10. Green-to-tee walks unchanged (median about
  100 m both). Links is the hard case -- its out-and-back pull to run beside
  itself (600 a hole, 1,200 for a back-nine partner) still carries two of its
  four nines 200-360 m out.
- **The fairway widths as tables**: the swell and tuck closures were 2.5 s of
  an Island course's build (a CPU profile: `tuckAt`, the widths and `gauss`,
  asked millions of times by `nearest`); sampled every half metre at the end of
  the design, an Island Architect course builds in 4.75 s against Classic's
  6.66.
- Tests: tests/clubhouse.test.mjs (nines home, against Classic).

- **The profiler** learned a group, `architect` (Classic against Architect
  on Low, three landscapes).
- Tests: two more in tests/architect.test.mjs.

### Phase 5: built ground and built water (30 October 2026)

ARCHITECT_VERSION 8. Classic's fingerprint unchanged.

- **Mounds by style** (architect.js `designMounds`, `moundField`; the study,
  workstream E): real ground, added at the end of `analyticHeight` before the
  creeks cut it, so the mesh, the collision heights and the surface queries
  are the one expression they always were. Framing mounds on Modern, Parkland
  and Tropical (long, low, 1-2.2 m, beyond the rough at the landing zones and
  by the green); spectator banks on Stadium (2.5-4 m, behind and beside the
  greens); chocolate drops on Golden Age and Raynor (small and steep, 1.4-2.4
  m, clustered near the greens); none on Links, Sandhills, Minimalist,
  Desert, Heathland or Mountain -- the land as found. Every mound is kept clear
  of every hole's tees, green, fairway and semi-rough, bunkers and ponds (not
  only its own hole's: a mound in one hole's rough can stand on the next
  one's fairway), and course.js drops any a creek or the sea would meet. All
  sizes PLACED. A nine-hole Midwest course carries about 25 (Parkland,
  Golden Age, Modern) or 7 (Stadium: big banks find less room).
- **Pond edges by style** (waterworks.js): rip-rap -- rough stones along the
  waterline, a second smaller row behind every other -- on Modern, Parkland,
  Tropical, Desert and Mountain, each in its landscape's own stone;
  railway-tie walls (Dye's sleepers) on Stadium; soft grass banks, which is
  to say nothing built, on Golden Age and Raynor (the study's pond edges by
  style), Links, Sandhills, Minimalist and Heathland. A first cut had Golden
  Age in stone and Modern in ties, against the study; corrected before commit. Only the side of a pond that
  faces play is dressed: the arc of the edge within 75 degrees of the nearest
  point of the hole's line, or of the green for a pond near it (PLACED).
  About 800 stones or 170 tie sections on a nine-hole course, instanced.
- **Fountains**: one in a big open pond (over 700 m2) on a resort or members'
  club of a dressed style (Parkland, Tropical, Stadium, Modern), two a course
  at most. Static: no animation.
- **A bridge's deck is solid** (physics.js). Its top is decided once in
  course.js (`b.deck`, 0.45 m over the higher of its ends and its middle), so
  the drawn deck and the solid one are the same plank; it is a box in the
  houses' grid with a floor, so a ball can pass beneath it, and one that comes
  down on it bounces off the planks. **A ball that comes to rest on a bridge
  is in the penalty area under it** (Rule 17.1a: a penalty area's edge runs
  straight up), so the game calls it in the water and the player takes
  relief as for any water.
- **Bridges cross creeks rather than running along them.** The first bridge
  capture showed a 30 m deck lying along a creek's bank: the path accepted a
  creek's water as readily as dry ground, and any point within 1.2 m of the
  water counted as wet. A path now takes dry ground first, and creek water only
  where none lies across its line within 20 m -- a real crossing; a bridge is
  the run of points in the water itself plus 3 m onto each bank. Bridges
  stay uncommon (about one course in four with creeks).
- **The bridge kit** (Blender pack architect_water, ten iterations): 2 m bays
  laid end to end, timber (posts, two rails, planks with gaps) or, on Links,
  Autumn and Haunted Hollow, stone (a slab and parapets with a coping),
  replacing phase 2's procedural deck.
- **A subtle bug found on the way: the fairway tucked on the wrong side.**
  Everywhere else in the game a hole's `leftWidth` is the -x side
  (`fairwayWidth(h,z,0,side)` reads it for side < 0); architect.js built
  `leftWidth` from the +x side's tucks. So the fairway narrowed opposite every
  side bunker, and the test asked the same swapped question and passed. What
  it looked like: measured on the real surface (scanning out from the centre
  line toward each side bunker), **the mown fairway stopped short of the sand
  on 4 of 23 side bunkers; after the fix, 22 of 23**. The posts (markings.js),
  the path's side (paths.js), the tree line and the mounds used the same
  swapped reading and are fixed with it, and the tests now read the game's
  convention.
- Not built in this phase, and why: **levelled ground under the clubhouse**
  (the terrace stands -- it reads well, and levelling would move the ground
  every other site test was tuned on); **feeder slopes and arroyos** (they
  belong with phase 6's ravines and barrancas, the land's story). The tie walls
  and the rip-rap are decoration: a ball that reaches them is in the water
  either way.
- Tests: tests/waterworks.test.mjs (Classic and Links bare, mounds in the
  rough and risen, rip-rap at the water, tie walls facing it, fountains in
  open water and none on a municipal course); tests/paths.test.mjs (a ball
  dropped on a bridge stops on its deck, in the penalty area; the bridge test
  now runs on a course that has one -- PATHS-T crosses no creek, so it had
  passed on nothing).

### Phase 6: the land's story, first half (30 October 2026)

ARCHITECT_VERSION 9. Classic's fingerprint unchanged.

- **The land's story** (story.js; the study, workstream L), by The land's
  story -- none, a little, a lot -- and each landscape its own remains:
  - **field walls**: dry-stone on Links, Autumn and Mountain, a leaning moor
    wall on Haunted Hollow, hedgerows on Midwest and PNW; three lines a
    little, six a lot, walked straight across the open ground between holes
    and broken wherever they would reach play, a path, water or a building;
  - **a farmstead** on Midwest and Autumn: a gambrel barn, its silo, and a
    windpump a lot;
  - **ruins**: a roofless chapel and cottage (Links, Haunted Hollow), a
    cottage (Lakeshore, Desert in adobe, PNW, Redwood, Autumn), a mine head
    (Mountain), a sugar-mill tower (Island);
  - **a landmark**, a lot of story only: a lighthouse (Links, Lakeshore) or a
    church spire (Autumn) about 150 m beyond a green, on its hole's line --
    placed only where its top half shows over the land from 120 m short of
    the green;
  - **a stone circle** in a clearing on the moor, and **lanterns** along
    Haunted Hollow's paths (the owner: ruins and lanterns, never graves).
  Everything stands out of play: buildings 38 m outside every corridor and
  walls 14 m, off every played surface, paths and water, clear of the
  clubhouse, never in front of a tee. Houses and trees keep off it (a story
  building keeps 20 m clear, a wall a stride either side, the circle its
  clearing). All counts and sizes PLACED.
- **Solid**: a story building is a box in `world.buildings` like the
  clubhouse; a wall is a box a straight run (`wallBoxes`, physics.js's
  houses' grid); never out of bounds. The props are decoration.
- **The land's templates** (architect.js; the study, workstream A's *pass 7*
  templates): holes whose character is a landform, recorded in the hole's
  design and added to the ground with the mounds (`earthField`):
  - **Dell** (par 3; Lahinch's 5th): a 3.6 m dune across the line 15 m
    short of a sunken green, a white aiming stone on its crest;
  - **Alps** (par 4; Prestwick's 17th): a 5.5 m ridge across the fairway 42 m
    short of the green, a bunker across the green's front beyond it;
  - **Barranca** (par 4; Pasatiempo's back nine): a ravine 4.5 m deep and 24
    m across between the drive and the green; the fairway stops at its lips
    (a hole's `gaps`, read by `fairwayWidth` so the shader and the lie
    agree), the cart path bridges it, and no tree grows in it across the
    line of play;
  - **Pit** (par 4; North Berwick's 13th): a dry-stone wall across the front
    of a sunken green, solid and in play, built whatever the story.
  Dune courses (Links, Sandhills, Heathland, Golden Age, Raynor) draw the
  Dell and the Pit; Golden Age, Raynor and Links the Alps; any par four that
  is not drivable may draw a Barranca. All sizes PLACED.
- **The trees kept out of a Barranca** were a bug found in the capture: near
  a green, the planting's corridor gate gives way to the green's own rule,
  which knew nothing of a ravine across the line; three trees stood in it.
  An Architect hole's gap is now still its corridor.
- **The story kit** (Blender pack architect_story, ten iterations, below).
- Tests: tests/story.test.mjs (Classic and None bare; every landscape's own
  pieces; everything out of play and nothing grown inside a building; a wall
  stops a ball and is not out of bounds; each template's landform, the
  Barranca's gap, bridge and treeless line, and the Pit's wall before its
  green).

### Phase 6: history and life, second half (30 October 2026)

ARCHITECT_VERSION 10. Classic's fingerprint unchanged.

- **The age dial's history** (the study, workstream O):
  - **grassed-over bunkers**: a 0.8 m hollow beside the fairway past the
    semi-rough, where sand was and is now mown -- on half the par fours and
    fives of a Municipal course, a third of an Old or Restored one (PLACED);
    in the ground with the mounds, on their own stream;
  - **a felled avenue**: a Restored course draws the mid-century avenue's
    line as an Old or Mature one would plant it, and leaves stumps there
    (the shipped stump model), not trees.
- **Life** (life.js; the study, workstream M): animals, cartoon and calm --
  sheep on Links, deer at the wood's edge (Midwest, Autumn, PNW), elk
  (Redwood, Mountain), a roadrunner in the Desert, geese on a pond's far
  bank, a heron by a pond, gulls circling over Links, Lakeshore and Island,
  ravens over Haunted Hollow -- and people far off: three golfers walking a
  stretch of the cart path, abreast, along its own points, and a greenkeeper
  on a ride-on mower working the rough between holes. Everything out of play
  (grazers and the mower 24-30 m outside every corridor and clear of trunks,
  birds 25-40 m up, walkers on the path), decoration only, drawn a quarter
  to a half larger than life, moved thirty times a second, **never on Low**
  (the frame loop hides the group). Rendering only: no version for it.
- **The life kit** (Blender pack architect_life, ten iterations, below).
- **Not built, and why**:
  - **tiger tees** -- a back tee standing alone behind the others. A tee is
    the card's: blue, white and red are fixed before the course is built
    (*the card before the course*), and a fourth, or the blue moved back,
    would change every yardage the card shows. Left for a change that can
    carry a fourth tee through the card, the rules and the round;
  - **a pond added later**, **a green rebuilt**, **plaques and memorial
    benches** -- each a small rule with no piece in the world yet to carry
    it (the shader has no per-green colour; the benches by the tees are
    Classic's furniture);
  - **animals that move off when a ball lands near** -- they stand out of
    play by placement, so a ball rarely comes near; the reaction would need
    the frame loop to hear of every landing.
- Tests: tests/life.test.mjs (Classic bare, every landscape its own life;
  nothing on a played surface or inside a tree, the walkers on the path, the
  birds up; hollows on an old municipal course, none on a new members' one;
  stumps on a restored course, none on an old one).

### Phase 7: the occasion (30 October 2026)

ARCHITECT_VERSION 11. Classic's fingerprint unchanged.

- **Tournament week** (occasion.js; the study, workstream Q), on a
  Championship venue only (the goal): grandstands behind and beside the
  last green and beside the signature par three (one with water, else the
  first), a scoreboard by the last green, TV towers behind it and by the par
  three, three hospitality marquees beside the clubhouse, gallery ropes down
  both sides of the last two holes from the landing zone to the green, and a
  crowd behind the ropes and in the stands. **The pin day says which day of
  the week it is**: about a third of the places filled on Thursday, half on
  Friday, three quarters on Saturday, every seat on Sunday (PLACED). Every
  day is a pin day here (the setting always has one), so the study's "off
  the pin days, the stands are empty frames" has no day to show; Thursday's
  thin crowd stands in for it.
- **Solid**: the stands, the scoreboard, the towers and the marquees are
  boxes in `world.buildings`, never out of bounds; a ball that reaches one
  bounces off and is played from where it ends. The ropes and the crowd are
  decoration, and the crowd is not drawn on Low.
- **The yardage book** (yardage-book.js; the study, workstream P): a
  printable PDF, a page a hole of an Architect course -- the hole drawn tee
  to green with its fairway and semi-rough edges, the green and its fall, the
  bunkers and ponds labelled with their carries from the back tee, the tees,
  both landing zones and what is left from each, the architect's note and
  each hazard's reason. From the menu while a round is paused (*Yardage
  book*, Architect courses only), written by the game's own PDF writer.
- **The tournament kit** (Blender pack architect_occasion, ten iterations,
  below).
- Tests: tests/occasion.test.mjs (only a Championship venue dressed; nothing
  on a played surface; a stand behind the last green facing it; the crowd
  more than doubling from Thursday to Sunday; a stand stops a ball and is
  not out of bounds); tests/yardage-book.test.mjs (a page a hole, the PDF
  well formed, every hole's name, par, note, carries and what is left).

### For the next landscape, style or template (30 October 2026)

ARCHITECT_VERSION 12. Classic's fingerprint unchanged.

- **One architect block per landscape** (biomes.js `ARCHITECT`): the styles
  it leans toward, its signature templates, its clubhouse, path and bridge,
  its story and its animals, and its colours -- gathered from the seven
  tables they had grown in (architect-styles.js, clubhouse.js, paths.js,
  story.js, life.js and three in renderer.js), which now read the block. The
  move alone changed nothing: the Architect fingerprint before and after it
  was the same. `ARCHITECT_GENERIC` sits under every block, so a landscape
  without one still builds.
- **Signature templates**: a landscape's block names the templates its land
  suggests (the study's landscape table) -- a Dell and a Cape on Links, an
  Alps on PNW, a Barranca in the Desert, a Redan on Mountain, a Redan or Road
  on Autumn, a Pit on Haunted Hollow, flat-ground templates on Midwest, a
  Cape on Island, a Dell on Lakeshore -- at two and a half times their odds
  (PLACED). That moved Architect courses (the version).
- **tests/biome-architect.test.mjs fails when a landscape has no block**, or
  a block names a style, template, clubhouse, path, ruin, landmark or animal
  that does not exist.
- PROJECT_HANDOFF gains *Adding a biome: the Architect side* (the block, its
  kit, what the ground does to the architect, both fingerprints, the virtual
  golfer), *Adding a style* and *Adding a template*; ARCHITECTURE one line
  pointing at them.

### The end of the goal: greens that trapped the golfer (30 October 2026)

ARCHITECT_VERSION 13. Classic's fingerprint unchanged.

- **What it looked like**: the virtual golfer measured Architect **4.9 strokes
  per 18 harder** than Classic, three rounds 32-41 over on one hole each.
  Traced (hole 9 of Midwest DIFFICULTY-3): from the semi-rough 6 m off the
  back of the green, every chip landed on the green and ran back to the
  golfer's feet, forty times; putting instead could not climb the bank. The
  green fell **8.7% under its pin where its own contour said 0.9%**.
- **The cause**: each green blends the land toward its own height over a
  shoulder up to 100 m wide when it sits lower, and the greens were applied
  one after another (course.js `shapedNoTees`) -- so a later, lower green
  dragged an earlier green's far edge down toward it. Routing the nines home
  (phase 4) puts the 9th and 18th greens 60-80 m apart and several metres
  apart in height; the 9th's back edge was the casualty. The steep pins had
  been there since phase 4 (the same three at every commit since), while
  the phase 1 measure ran on courses that did not yet route home.
- **The fix**: an Architect course's greens are blended together, weighted
  as overlapping pond shelves are (a weight that runs away as a green
  reaches full strength), so the green you stand on decides its own height
  and the ground stays continuous. Classic keeps its order exactly (its
  fingerprint is silent). Afterward: **every Architect pin at most 1.6%**
  (it was up to 20.7%), the ground near a pin over 6% on 0.3% of it
  (Classic 0.4%; it was 2.3%).
- **The measure** (`tools/architect-difficulty.mjs --seeds 4`, ten landscapes,
  four seeds, two golfers, 80 rounds a designer): **Architect 1.32 strokes
  per 18 harder than Classic** (Classic 0.89 over par, Architect 2.21) --
  inside the owner's 1.5. By landscape (eight rounds each, noisy): Haunted
  Hollow +4.0, PNW +4.0, Midwest +3.4, Autumn +1.6, Island +1.0, Lakeshore
  +1.0, Links +0.8, Mountain +0.1, Redwood -1.1, Desert -1.5. No hole left
  unfinished.
- **The tool learned two things**: an unfinished hole is named with its
  landscape, seed, plan and the lie it was left on; and a golfer whose last
  stroke left the ball where it was tries the other shot (a putt after a
  chip, a chip after a putt), as a real one would -- putting from every
  fringe instead stranded it below other banks on both designers.

- **The walk to the next tee, priced three times over** (routing.js, Architect
  only; ARCHITECT_VERSION 14). Routing home had lengthened the longest walks:
  the late holes' extra tries (450, not 150) were all made at the longest
  walk the search allows, about 290 m. Paying walk*0.9 again, then twice
  again: the median walk 100 -> 93 m (Classic 98), the longest twentieth
  283 -> 245 -> 234 m (Classic 191), nines home 10 -> 11 of 12. At walk*0.9
  extra the median had not moved; the stronger price is kept. **The virtual
  golfer after it: Architect 0.82 strokes per 18 harder than Classic**
  (Classic 1.09 over par, Architect 1.91; four seeds, 80 rounds a
  designer) -- shorter walks, shorter holes to come home.

## Rejected

- **A second field for Architect's version** in every record (`architect: n`
  beside `generator`), the study's first plan. Every reader of a save, a
  course, a file, a course code and a challenge code checks
  `Number.isInteger(generator)`; a second field meant teaching all of them and
  every format. One integer stamp per course says the same thing and leaves a
  Classic record byte-for-byte what it was.
- **Resolving the architect's settings once in main.js** (`settleSettings`).
  The scorecard, the course pictures and the tools call the generator without
  main.js, so each would have had to remember; resolving at every entry, and
  idempotently, cannot be forgotten.

- **Bunkers placed before the water** (phase 1's first order). The ponds were
  then refused wherever a bunker already stood -- a Modern course, water 60%,
  came out with one pond in eighteen holes. Water is placed first and the sand
  round it.
- **Classic's pond code reused for Architect** by refactoring it into a
  function both call. It would have touched Classic's draws; Architect has its
  own `pondAt` with the same shapes and refusals instead.

- **One bridge model stretched to its span.** Its posts would stretch with
  it, from 2 m apart on a short bridge to 10 on a long one; 2 m bays laid end
  to end keep the timber's rhythm on every span.
- **A fountain as tiers of falling spray** (iterations 4-6): read in the game
  as a snowy pine, then a white tent. A jet, a cloud of spray and falling
  streams reads as a fountain.
- **A creek's bank counted as wet** for a bridge (phase 2's rule, a point
  within 1.2 m of the water): along a creek it made a 30 m bridge lying beside
  the water.

- **Greens blended in turn on an Architect course** (Classic's way, kept for
  Classic): a lower neighbour's shoulder tilted a green under its pin.
- **Putting from every fringe and every close semi-rough lie** in the
  difficulty tool: it fixed the stuck chips and stranded the golfer below
  other banks.
- **A landmark placed by distance alone** (iteration 3): 220 m beyond a
  green it was a speck, and behind a dune it was not seen at all. It is
  placed where it shows from the fairway.
- **Inked field walls**: the furniture's outline, drawn round stones a few
  pixels high, turned every wall black.

- **Animals at true size** (iteration 3): a sheep in the marram 22 m off was
  a dot. They are drawn larger than life, as the rake is.
- **Walkers on a straight line between two path points**: on a bend they
  walked off the path. They follow its points.

- **The surface field as one more texture** beside the four float tables:
  it would have spent the ground's last unit below the floodlights' spare.
  The tables were packed instead, which freed three.
- **The packed tables read through the filter**: Classic's ground cost 5-10%
  more on Low. Fetched by texel.
- **A field at half the texel** for rounder field bunkers: four times the
  memory, for the bunkers past the twelfth only.
- **The green's turn multiplied in on every green** (a cosine of zero for
  Classic): the same numbers in exact arithmetic, but not promised to the
  bit. Classic skips the turn.
- **A diagonal green at a random angle**: a new draw would have moved every
  later decision on the hole. The turn comes from the hole's geometry and
  its concept.

## Deviations from the study

- **The study's "golfer simulated or tabled"**: tabled, as the study's pass 4
  said, from three golfers; the "course built for your game" idea would add a
  fourth from the player's own shots.
- **The version stamp** (above): one integer, not a second field.
- **Double greens and crossing holes are not built** (the study's links
  routing). Shared fairways come from the Links landscape's own routing,
  which Architect keeps; two holes sharing one putting surface with two cups
  would need two flags, two hole locations and a green the shader draws once
  for two holes -- left for later work.
- **The surface field holds one layer, sand past the twelve slots**, not
  every surface the study lists (green, fringe, fairway, first cut,
  collection, waste, path, native line, wear). The others are still drawn
  from the hole table's shapes, which already agree with the lie; the
  field's three free channels and the two free samplers are where the
  sculpting and real-courses studies' outlines go (*Phase 3, finished*).
  Greens turned to the approach, the heights and the native line were built
  without it.
- **A clubhouse on a slope stands on a terrace** -- its floor level with the
  high side and a stone wall down to the low -- rather than on levelled
  ground: levelling is earthworks (phase 5). On Mountain, where nowhere falls
  less than 4.4 m across a members' footprint, it falls back to a municipal
  footprint on up to 6.5 m.
- **The bridge deck is solid since phase 5** (it was drawn only, in phase 2):
  a box with a floor in the houses' grid (physics.js), not a height
  override -- IDEAS' note stands (a height override failed: a ball under the
  deck landed on it).
- **Rip-rap and tie walls are decoration, not solid** (the goal: walls are
  solid). They stand at the waterline, below the bank's top; a ball that
  reaches them is in the water either way, so a solid face would only change
  where a ball already in the penalty area stops.
- **Fountains are still** -- a static model, no moving spray or sound.
- **No relief from tournament week's structures** (the study's rulings:
  relief from a temporary immovable obstruction). A ball that reaches a
  stand, the scoreboard, a tower or a marquee bounces off it and is played
  from where it ends.
- **No TV tower pads off the pin days and no rough grown up for the week**:
  the setting always names a day, and the rough is the club's (a
  Championship venue already plays its rough long).
- **The land's story is placed after the routing, not before it** (the
  study: on the base landform, so the router can use it -- "a wall here
  makes a Pit green"). The holes are routed first and the story fills the
  ground between them; the templates that need a landform (Dell, Alps,
  Barranca, Pit) build it themselves, on the hole the architect chose. A
  router that reads the land's remains is left for later.
- **A barranca crosses square**, not at an angle (the study: "a ravine
  crossing the hole at an angle"), and its floor is rough, not sand or rock;
  it is played as it lies, not a penalty area (the desert-as-penalty-area
  local rule is not built).
- **No quarry, no road across a hole, no railway bank** (the study's
  workstream L): the walls, farm, ruins, landmarks and the four templates
  carry the story; those three wait.
- **Rulings so far**: free relief from a cart path (relief.js `pathRelief`);
  a building is solid and never out of bounds. The rest of the study's table
  (ground under repair, no-play zones, the desert as a penalty area, drop
  zones, walls and roads played as they lie, the electric fence) comes with
  the features that need them.
- **Bridge decks** (study, *Collisions*: "a height override in its footprint").
  IDEAS.md's *Bridges over creeks* recorded that a height override was tried
  and removed -- a ball flying under the deck landed on it. A bridge is built
  as a solid with an underside instead (phase 5).

## Measures

### Baselines (Classic, 30 October 2026, before any change)

- **The wait to build an 18-hole course** (`tools/gen-time.mjs`, Node, three
  seeds, median): PNW 4.51 s, Desert 4.92, Mountain 4.44, Links 4.45,
  Midwest 4.15, Island 6.70, Redwood 3.32, Autumn 4.71, Haunted 3.59,
  Lakeshore 3.40. The goal's limit: Architect at most 2 s more in each.
- **The bench** (standard tier): 231 bunkers on 108 holes; Classic's
  placement is the baseline the landing-zone measure has to beat (phase 1).
- **The fingerprints**: Classic unchanged at generator 52; Architect stored at
  52 / architect 1.

### Phase 1 (30 October 2026, ARCHITECT_VERSION 2)

- **How much harder** (`tools/architect-difficulty.mjs --seeds 3`: ten
  landscapes, three seeds, a steady and a looser virtual golfer, eighteen
  holes, 60 rounds a designer): Classic 1.98 over par, Architect 1.83 --
  **Architect 0.15 strokes per 18 easier**, inside the owner's limit. By
  landscape (six rounds each, so about ±2 strokes of noise): Island +4.5,
  Mountain +3.8, Haunted +3.3, Autumn +0.8, Links +0.5, Midwest +1.5,
  Lakeshore -2.2, Redwood -4.3, Desert -4.3, PNW -5.2. Re-measured at the
  end of the goal with four seeds: 1.32 harder (*greens that trapped the
  golfer*).
  An earlier run, on a build where the bunkers were placed before the water,
  showed one Island round at +73 -- not reproduced on the build after (the
  courses had changed); the tool now names any hole the golfer cannot finish
  in 40 strokes rather than hiding it.
- **The bench** (`design`, standard tier, 12 courses of 9): drive bunkers by a
  landing zone, **175 of 206 (85%) Architect against 24 of 89 (27%)
  Classic**; green-to-tee walks unchanged (median 98 m both; routing is phase
  4); returning nines 6 and 7 of 12; Architect uses 4-6 concepts and 0-4
  templates a nine; no hazard without a reason.
- **Bunkers per 18 holes** (three Midwest seeds a style): Golden Age 62, Raynor
  64, Links 107, Heathland 80, Sandhills 51, Parkland 48, Modern 47, Stadium
  65, Minimalist 52, Desert target 44, Mountain 45, Tropical 55; Classic 42.
  Ponds per 18: none on Links to about 15 on Stadium.

### The bench after the owner's review (30 October 2026, ARCHITECT_VERSION 16)

`node tools/bench.mjs design --tier standard`, and `--set designer=architect`:

| Measure | Classic | Architect |
| --- | --- | --- |
| Fairway bunkers by a landing zone | 24 of 89 (27%) | 179 of 224 (80%) |
| Nines home | 7 of 12 | 11 of 12 |
| Green-to-next-tee walk, median | 98 m | 93 m |
| ... p95 | 191 m | 225 m |
| Concepts a nine (variety) | -- | 4 to 6, median 5 |
| Templates a nine | -- | 0 to 4, median 2 |
| A hazard without a reason (invariant) | 0 | 0 |

**The first run broke the invariant: nine hazards without a reason**, all on
PNW -- the hand tools' lobes (hand-tools.js) had none. Each now has its
reason; a test holds it (tests/hand-tools.test.mjs). Only the reasons moved:
both fingerprints silent, no version.

### Every kit at once, on Low (30 October 2026)

The same tool, `--arch-tier low --arch-course
'{"archClub":"championship","pinDay":"Sunday","archStory":"lots"}'`: the
farm, ruins, landmark, walls, stands, scoreboard and towers all present
(Low draws no crowd, animals or markings). Mean processor ms, median
graphics ms, Classic / Architect:

| | CPU | GPU |
| --- | --- | --- |
| Midwest | 0.708 / 0.694 (-2.0%) | 1.00 / 0.74 (-25.3%) |
| Links | 0.635 / 0.603 (-5.0%) | 1.01 / 0.82 (-18.3%) |
| Haunted | 1.261 / 1.135 (-10.0%) | 1.51 / 1.40 (-7.5%) |
| Autumn | 0.869 / 0.710 (-18.3%) | 1.18 / 0.73 (-37.8%) |

### The crowd's cost, Medium and High (30 October 2026)

`node tools/profile.mjs --only architect --landscapes midwest,links,pnw
--arch-tier medium --arch-course '{"archClub":"championship","pinDay":"Sunday"}'
--frames 1200 --json <file>` (the two options added for this), and `high`:
a Championship venue on Sunday -- 1,102 spectators, the stands, the board,
the walkers -- against the Classic course of the same seed, mean processor
ms and median graphics ms:

| | Midwest | Links | PNW |
| --- | --- | --- | --- |
| Medium, CPU | 1.286 / 1.232 (-4.2%) | 1.459 / 1.518 (+4.0%) | 1.586 / 1.785 (+12.5%) |
| Medium, GPU | 1.57 / 1.44 (-8.5%) | 1.86 / 1.73 (-6.7%) | 1.98 / 2.00 (+0.9%) |
| High, CPU | 4.705 / 3.328 (-29.3%) | 3.386 / 2.738 (-19.1%) | 4.532 / 4.317 (-4.7%) |
| High, GPU | 4.28 / 2.99 (-30.0%) | 3.42 / 2.81 (-17.7%) | 4.54 / 4.28 (-5.7%) |

The goal's limit is for Low (no crowd drawn there); a tournament Sunday costs
PNW 12.5% more processor time on Medium than its Classic course, and nothing
like that anywhere else measured. Not acted on.

### The bench at the end of the goal (30 October 2026, ARCHITECT_VERSION 14)

`node tools/bench.mjs design --tier standard`, twelve courses of nine holes, each
designer:

| Measure | Classic | Architect |
| --- | --- | --- |
| Fairway bunkers by a landing zone | 24 of 89 (27%) | 156 of 189 (83%) |
| Nines home (9th green within 200 m of the 1st tee) | 7 of 12 | 11 of 12 |
| Green-to-next-tee walk, median | 98 m | 93 m |
| ... the longest twentieth (p95) | 191 m | 234 m |
| Concepts a nine (variety) | -- | 4 to 6, median 5 |
| Templates a nine | -- | 0 to 4, median 2 |
| A hazard without a reason (an invariant) | 0 | 0 |

The longest walks stay longer than Classic's: a course that comes home has
a hole or two that walk back to the turn.

### The wait to build at the end (30 October 2026, ARCHITECT_VERSION 16)

`node tools/gen-time.mjs`, both designers, every landscape, the last code:
PNW 3.47 / 4.22 s (+0.75), Desert 3.61 / 3.84 (+0.23), Mountain 3.23 / 3.77
(+0.54), Links 3.60 / 3.69 (+0.09), Midwest 3.41 / 3.18 (-0.23), Island
6.29 / 4.57 (-1.72), Redwood 3.01 / 3.30 (+0.29), Autumn 4.10 / 3.82 (-0.28),
Haunted 3.13 / 3.44 (+0.31), Lakeshore 3.12 / 3.22 (+0.10). **The worst PNW,
+0.75 s**; the run below read it at +1.66 with overlapping ranges.

### The wait to build after the owner's review (30 October 2026, ARCHITECT_VERSION 16)

`node tools/gen-time.mjs` and `--designer architect`, eighteen holes, three
seeds, median, Classic / Architect: PNW 3.81 / 5.47 s, Desert 4.00 / 4.61,
Mountain 3.73 / 4.37, Links 4.34 / 4.42, Midwest 3.99 / 3.49, Island 6.79 /
5.07, Redwood 3.34 / 3.65, Autumn 4.72 / 4.17, Haunted 4.30 / 3.69,
Lakeshore 4.39 / 3.51. **The worst, PNW, +1.66 s** (was Links +0.30 at
version 14) -- inside the goal's 2 s, but closer to it. The ranges overlap
(Classic 3.16-4.87, Architect 4.32-5.53 on PNW), and the likeliest cost is
the cart paths' cost grid and search (paths.js), which reads the real ground
at every step; not profiled. Four landscapes build faster on Architect.
**Profiled since** (`node --cpu-prof`, three PNW eighteens a designer): of
Architect's extra, most is `routeHoles` -- the routing from the clubhouse
with the walk to each next tee priced in, about 0.54 s a course -- and the
cart-path grid reading the real ground (`analyticHeight`), about 0.3 s a
course.

### The wait to build at the end of the goal (30 October 2026, ARCHITECT_VERSION 14)

`node tools/gen-time.mjs` and `--designer architect`, eighteen holes, three
seeds, median, Classic / Architect: PNW 4.06 / 4.19 s, Desert 4.40 / 3.84,
Mountain 3.61 / 3.83, Links 4.04 / 4.34, Midwest 3.69 / 3.01, Island 6.80 /
4.67, Redwood 3.24 / 3.41, Autumn 4.48 / 3.80, Haunted 3.78 / 3.52,
Lakeshore 3.39 / 3.03. **The worst, Links, +0.30 s**; five landscapes build
faster on Architect (Island by 2.1 s). Inside the goal's 2 s everywhere.

### The wait to build (30 October 2026, after phase 4)

`node tools/gen-time.mjs` and `--designer architect` (a new flag), eighteen
holes, three seeds, median: PNW 3.81 / 4.03 s (after the width tables), Desert
4.09 / 4.71, Mountain 3.53 / 4.45, Links 4.37 / 4.58, Midwest 3.77 / 3.84,
Island 6.66 / 4.75, Redwood 3.21 / 3.17, Autumn 4.51 / 4.73, Haunted 3.44 /
4.33, Lakeshore 3.50 / 4.01 (Classic / Architect). The worst, Mountain, +0.9 s;
inside the goal's 2 s everywhere. (Before the width tables Island was 11.03 s,
+4.4 s.) Re-measured at the end of the goal.

### After the surface field (31 October 2026, ARCHITECT_VERSION 18)

Every measure re-run on the final code of phase 3, finished.

| Measure | Classic | Architect |
| --- | --- | --- |
| Frame on Low, processor, mean ms (Midwest, PNW, Links) | 0.695, 0.825, 0.614 | 0.694, 0.603, 0.540 (-0.1%, -27%, -12%) |
| Frame on Low, graphics, mean ms | 1.008, 1.207, 1.004 | 0.742, 0.853, 0.680 (-26%, -29%, -32%) |
| An eighteen's build, median of 3 (worst gap) | PNW 3.39 s | PNW 4.23 s (+0.84 s; the others -0.9 to +0.51 s) |
| Strokes per 18 over par, virtual golfer, 40 rounds | 1.75 | 1.68 (-0.07: no harder) |
| Bunkers by a landing zone (bench, standard tier) | | 179 of 224 (80%) |
| Nines home | | 11 of 12 |
| Median walk to the next tee | | 93 m |

npm test 1,226 of 1,226; smoke 41 of 41; Classic's fingerprint silent;
every bench invariant clear.

**Every landscape on Low, re-run** (31 October, all ten, 1,200-frame
means): Architect below Classic in every one -- processor -0.3% (Island) to
-38.7% (Desert), graphics -0.7% (Island) to -47.3% (Lakeshore Dunes).

**On Ultra too** (the owner asked, 31 October 2026; `profile --only
architect --arch-tier ultra`, means): processor 5.56, 5.60, 5.17 ms on
Classic against 4.15, 3.76, 3.87 on Architect (-25%, -33%, -25%); graphics
5.01, 4.78, 4.26 against 3.35, 3.00, 3.09 (-33%, -37%, -27%); triangles
37.6, 29.8, 17.1 million against 17.2, 11.8, 8.1, though Architect makes
75-100 more draw calls (its kits). **Why: the trees.** On the profile seed
Architect plants 6,889 trees on Midwest against Classic's 15,167, 6,953 on
PNW against 17,524, and 5,994 on Links against 7,947 -- planting by design,
in stands, lines and avenues with the corridors open, where Classic
scatters to its density. The renderer changes of the review (merged
buildings, one path mesh a surface, batched furniture) serve both
designers. Giving Classic the same would be a planting change: every
Classic seed's trees move, a GENERATOR_VERSION bump, and the goal's
"Classic gets only free extras" -- the owner's call, not taken.

**The showcase refreshed on this code** (31 October): the ten Architect
hero holes and the six named holes recaptured (`arch-hero18`,
`arch-tpl18a`-`d`; the views and seeds as before), the ten course codes
re-exported with the new stamp and checked to import back as Architect.
The Classic halves of the pairs and the first-and-final pairs (pictures of
earlier tries, by their nature) are kept. Of the kits' contact sheets, life
and occasion predated the review's last model commit, so both were
re-rendered in Blender (`run.mjs architect_life --render`, then
`architect_occasion`; card 1%, one at a time, closed after): each rebuilt
its models byte-identical to the committed ones, and the sheets show the
final mower, walkers and spectators. Then the other four (people,
clubhouses, water, story) the same way, also byte-identical: all six sheets
are from the final models.

### Frame time on Low, every landscape: met (30 October 2026, the last measure)

After the tee furniture was batched (below) -- `node tools/profile.mjs
--only architect --landscapes all --frames 1200 --json <file>`, read as the
MEAN processor time a frame (the probe's `mean`: the median of a timer that
steps by 0.1 ms swung by up to 0.4 ms run to run and had read Autumn at +25%
to +28%) and the median graphics time; Chrome Remote Desktop's host was
using the card at about 30% throughout, for both designers alike.

| Landscape | CPU mean ms, Classic / Architect | Change | GPU ms | Change |
| --- | --- | --- | --- | --- |
| PNW | 0.862 / 0.602 | -30.1% | 1.19 / 0.77 | -35.0% |
| Desert | 1.062 / 0.671 | -36.8% | 1.34 / 0.94 | -30.0% |
| Mountain | 0.794 / 0.616 | -22.4% | 1.04 / 0.63 | -40.1% |
| Links | 0.603 / 0.533 | -11.7% | 0.98 / 0.64 | -35.2% |
| Midwest | 0.708 / 0.664 | -6.2% | 0.99 / 0.71 | -28.7% |
| Island | 0.549 / 0.552 | +0.6% | 0.87 / 0.87 | +0.1% |
| Redwood | 0.723 / 0.735 | +1.7% | 0.76 / 0.71 | -7.1% |
| Autumn | 0.900 / 0.817 | -9.2% | 1.18 / 1.03 | -12.5% |
| Haunted | 1.260 / 0.925 | -26.6% | 1.50 / 0.98 | -34.9% |
| Lakeshore | 0.840 / 0.633 | -24.6% | 1.12 / 0.60 | -46.2% |

**Every landscape within 10%; the worst Redwood, +1.7%.** **The tee furniture
batched** (the owner, 30 October 2026: "go ahead on all of this"): the tee
markers, signs, benches and ball washers -- main's, on both designers -- were
a group of meshes each, every part again for its ink and in the shadow pass;
now one InstancedMesh a model, colours and part. It halved every course's
draws on Low, Classic's too (Autumn Classic 426 -> 232, Architect 533 ->
259). Seen on a Classic course from three views, before and after: the same
pieces in the same places and colours (`tee-before`, `tee-exp`).

### Frame time on Low, every landscape (30 October 2026, after the review)

`node tools/profile.mjs --only architect --landscapes all` (the flag added
for this: the group had measured three landscapes), the real card, Low, the
profile course on each landscape. **First run: over 10% on four landscapes**
-- processor time +15% PNW, +13% Midwest and Redwood, +37.5% Autumn, and
Autumn drawing 589 calls against Classic's 426. Traced, piece by piece, by
hiding each part of the scene and counting the draws it saved:

- **Cart paths were a mesh a piece** (twenty-odd, some two points long):
  now one mesh a surface.
- **Buildings were a mesh a part**, each inked and in the shadow pass: now
  each building's parts merged, its colours baked into the vertices -- one
  mesh and one ink a building. Seen in the game: unchanged to look at.
- **Bridges were a group of meshes a 2 m bay** (a Barranca's bridge, spanned
  wall to wall, some 60 meshes): now instanced across every bay.
- **Stakes, posts and rakes, some forty draws, are not drawn on Low** -- Low
  already leaves out the animals and the crowd.

**Last run** (processor ms median, Classic / Architect; graphics ms; draws):

| Landscape | CPU | GPU | Draws |
| --- | --- | --- | --- |
| PNW | 1.30 / 1.30 | 1.24 / 0.82 | 376 / 315 |
| Desert | 1.60 / 1.40 | 1.49 / 0.99 | 407 / 329 |
| Mountain | 1.40 / 1.10 | 1.08 / 0.66 | 406 / 333 |
| Links | 1.40 / 1.10 | 1.07 / 0.67 | 347 / 245 |
| Midwest | 1.60 / 1.40 | 1.13 / 0.72 | 414 / 349 |
| Island | 1.40 / 1.30 | 0.94 / 0.93 | 381 / 321 |
| Redwood | 1.80 / 1.50 | 1.13 / 0.66 | 443 / 371 |
| Autumn | 1.60 / 2.00 | 1.30 / 1.66 | 426 / 533 |
| Haunted | 2.10 / 1.60 | 1.95 / 1.06 | 460 / 386 |
| Lakeshore | 1.60 / 1.40 | 1.33 / 0.66 | 426 / 328 |

(Superseded by *Frame time on Low, every landscape: met*, above: the tee
furniture was batched and the means read.) **Nine landscapes at or below
Classic on both. Autumn is not: +25% processor,
+28% graphics** (over four runs its processor median was 1.6-2.0 ms on
Classic and 2.0-2.4 on Architect; the timer steps by 0.1 ms and a case swings
by up to 0.4 ms run to run). Traced: Architect's own pieces now cost less than
the gap; the extra draws are the course's TEE FURNITURE -- the benches, ball
washers and signs main draws for every hole, 54 groups of separate meshes,
on both designers -- of which Architect's routing on that seed puts more
inside the profile camera's view and shadow (196 draws against 148, the
same groups). The fix is instancing the tee furniture: shared code, so it
would change Classic's drawing too, and waits for the owner (TODO).

### Frame time on Low at the end of the owner's review (30 October 2026, ARCHITECT_VERSION 16)

`node tools/profile.mjs --only architect`, the real graphics card (an RTX
4090, idle at 3% and 38 C for 30 s before), Low tier, default dials:

| Landscape | Classic CPU ms (median) | Architect | Change | Classic GPU ms | Architect |
| --- | --- | --- | --- | --- | --- |
| Midwest | 1.50 | 1.60 | +6.7% | 1.17 | 0.84 |
| PNW | 1.50 | 1.40 | -6.7% | 1.23 | 0.88 |
| Links | 1.30 | 1.20 | -7.7% | 1.05 | 0.70 |

Within the goal's 10% on every landscape measured; the graphics time is
lower on Architect (about half the triangles: 4.3-5.4 million against
8.3-10.6). On Low no crowd, walkers or animals are drawn; a fountain, the
live scoreboard and the hand-made shapes are. The crowd's five bodies were
not measured on Medium and up (TODO).

### Frame time on Low (30 October 2026, after phase 3)

`node tools/profile.mjs --only architect`, one run, seed PROFILE, nine holes,
on this machine's RTX 4090 (so the real-GPU arm: headroom, not a weak card).
Frame = CPU + GPU medians.

| Landscape | Classic | Architect | Change | Draw calls |
| --- | --- | --- | --- | --- |
| Midwest | 1.70 + 1.22 = 2.92 ms | 1.60 + 0.83 = 2.43 ms | -17% (fewer trees in play) | 414 -> 426 |
| PNW | 1.20 + 1.18 = 2.38 ms | 1.50 + 1.05 = 2.55 ms | +7% | 376 -> 440 |
| Links | 1.20 + 1.07 = 2.27 ms | 1.40 + 1.06 = 2.46 ms | +8% | 347 -> 354 |

Inside the goal's 10% on all three. The added draws are the paths, the
markings (instanced, twelve meshes), the clubhouse, its ink and the wear.
Re-measured at the end of the goal.

## GPU run log

Every run reads `nvidia-smi` first (the goal: wait if a game runs or the card
is above about 30%).

| When | What | Card before | Result |
| --- | --- | --- | --- |
| 30 Oct, phase 0 | smoke `architect-studio`, `studio` | 4%, 38 °C, no game | studio passed; architect-studio failed -- the dials are on their own tab of the sheet, which the journey had not opened (the harness, not the game) |
| 30 Oct, phase 0 | smoke `architect-studio` (journey fixed; the designer moved to the head of Course) | 4%, 39 °C | passed |
| 30 Oct, phase 2 | capture `arch-p2a`: an Architect Midwest course, four views (overhaul.mjs, `--course designer=architect`) | 6%, 41 °C | built in 13.8 s, no errors; paths, the pull-offs and a white middle flag seen |
| 30 Oct, phase 2 | smoke `architect-studio`, `studio`, `surprise-round`, `hud-reachable`, `no-swallowed-errors` | 6%, 40 °C | 5 of 5 passed |
| 30 Oct, phase 2 | captures `arch-p2b` to `arch-p2h` (seven runs, one at a time): the markings' iterations on Midwest, Links, Desert, Haunted Hollow and Midwest on Low | 4-7%, 39-40 °C each | every course built in 13-18 s with no errors |
| 30 Oct, phase 3 | capture `arch-p3a` (Midwest, Links; Heathland, Municipal): a hole from behind, a green, the first tee | 5%, 38 °C | no errors; divots on the tee, a collection area beside a green, lobed bunkers seen |
| 30 Oct, phase 4 | none: routing measured on the CPU (bench, builds) | -- | -- |
| 30 Oct, phase 6 | captures `arch-l3` to `arch-l10` (twelve runs of one to three landscapes): the life pack's iterations on Links, Redwood, Autumn, Midwest, PNW, Desert, Haunted Hollow and Lakeshore, one on Low | 3-5%, 38-40 °C each | every course built in 5-23 s with no errors |
| 30 Oct, phase 7 | the yardage book opened in the browser pane (a PDF, no game) | 4% | read as drawn: the plan, carries, notes |
| 30 Oct, phase 7 | captures `arch-w3` (week views), `arch-o4` to `arch-o10` (eight runs of one or two landscapes): the tournament kit's iterations on Midwest, Links and PNW, Thursday to Sunday, two on Low | 4-5%, 38-40 °C each | every course built in 8-18 s with no errors |
| 30 Oct, phase 6 | captures `arch-s3` to `arch-s10` (sixteen runs of one to three landscapes, one at a time): the story pack's iterations on Midwest, Links, Haunted Hollow, Autumn, Mountain, Island, Desert and PNW, the last on Low | 2-5%, 38-40 °C each | every course built in 5-18 s with no errors |
| 30 Oct, phase 5 | captures `arch-w3` to `arch-w10` (fourteen runs of one landscape, one at a time): the water pack's iterations on Midwest (Parkland, Stadium), Redwood, Autumn and Desert, the last on Low | 2-5%, 38-40 °C each | every course built in 13-17 s with no errors |
| 30 Oct, phase 3 | profile `--only architect` (six cases, Low) | 5%, 39 °C | 1.5 minutes, no errors; *Frame time on Low* |
| 30 Oct, phase 2 | captures `arch-c1` to `arch-c11` (sixteen runs of one to three landscapes): the clubhouses' iterations, all ten landscapes, the last on Low | 1-7%, 38-41 °C each | every course built in 4-17 s with no errors |

**The owner's review (30 October 2026, afternoon and evening)** -- every run
read `nvidia-smi` first; no crash, hang or driver error in any:

| When | What | Card before | Result |
| --- | --- | --- | --- |
| review | captures `arch-pv1` to `arch-pv6` (paths), `arch-f1` to `arch-f5` (fountain), `arch-fmove` (a drop measured moving) | 2-6%, 37-38 °C | no errors; the iterations in *The owner's review* |
| review | Blender `architect_life`, `architect_occasion` (people, mower, crowd: one process at a time, ten times each pack), `architect_water` (the sheet without the fountain) | 1-4% | every pack written, Blender closed after each |
| review | captures `arch-p3` to `arch-p10`, `arch-m9-*`, `arch-m10` (people, crowd, mower), `arch-alps1`, `arch-board1`, `arch-board2`, `arch-hand1` to `arch-hand5b` | 3-6% | no errors |
| review | captures for the showcase: `arch-hero` (ten landscapes, in four runs of at most three), `arch-pairc`, `arch-sc-*` (Redan, Cape, pairs) | 4-6% | no errors |
| review | smoke `architect-studio` (four runs as the yardage book and the hand tools were added), `architect-tournament` (three runs) | 3-4% | all passed in the end; the tournament journey's chip check corrected twice (the test, not the game) |
| review | smoke, all journeys (seven full runs) | 1-6% | 39/39, 39/39, 38/39, 39/40, 39/40, 40/40, 40/40 -- the failures all `ball-light-hole-out`, traced to main and fixed (*EVERY PROGRAM IS DRAWN ONCE*) |
| review | smoke `ball-light-hole-out` alone: about 80 runs across the bisect (main's build in a temporary worktree, removed after) | 3-5% | before the fix 3 in 8 failing on main; after it 20 of 20 |
| review | profiles `--only architect`: three landscapes, then all ten (median, then 1,200-frame means), Medium and High with a Championship crowd, every kit at once on Low, the final run on the final code | 2-6%, then about 30% while Chrome Remote Desktop's host was encoding the owner's session (both designers alike) | *Frame time on Low, every landscape: met*; *The crowd's cost* |
| 31 Oct, phase 3 finished | captures `cls-before`, `cls-after` (Classic, three landscapes, old build and new; the first new run showed a shader error, fixed), `cls-before2` (the noise control), `arch-p3f`, `arch-p3f-before`, `arch-p3f-debug`, `arch-p3g`, `arch-p3h` | 3-7%, 37-40 °C | no errors after the fix |
| 31 Oct, phase 3 finished | `frame-ab --shots` Classic Low Midwest, old build against new: one round (Classic 5-10% slower on the graphics card: the filtered table reads), then two rounds after `texelFetch` | 3-4% | level; pictures within the noise floor |
| 31 Oct, phase 3 finished | profile `--only architect` (six cases, Low) | 3%, 39 °C | 1.5 minutes, no errors; *Frame time on Low after the surface field* |
| 31 Oct, phase 3 finished | smoke, all journeys | 3% | 41 of 41 |
| 31 Oct, phase 3 finished | profile `--only architect --landscapes all` (twenty cases, Low) | 3%, 37 °C | 3.4 minutes, no errors |
| 31 Oct, phase 3 finished | captures `arch-hero18` (ten landscapes, four runs), `arch-tpl18a`-`d` (the showcase refresh); profile `--only architect --arch-tier ultra` (the owner's question) | 3-7%, 38-40 °C | no errors |
| review | captures for the tee furniture (before and after), the creek riffles (before and after; the owner then said not to bother), draw counts and frame times read through `window.__view` | 3-40% (the higher with the remote session) | no errors |

## Blender iteration log

The goal asks for at least ten iterations on every asset: render it, judge it
against the cartoon look and its neighbours, revise. An iteration is judged on
the pack's contact sheet (`bench/shots/blender/<pack>.png`) or in the game
(a capture named beside it), and says what changed.

### architect_people (stakes, yardage post, rake)

| # | Judged on | Stake / OB stake | Yardage post | Rake |
| --- | --- | --- | --- | --- |
| 1 | sheet | a 5 cm square timber stake, top two thirds painted, pyramid cap: reads as a stake, but a thread for a cartoon world, and the unpainted third looks like dirt. The sheet's 1 m scale post hid all four models (its radius scales with its height); the pack's sheet uses a 0.4 m post | a plain block with a red band: reads, but plain | a 1.6 cm handle and a 48 cm head: the handle is a thread |
| 2 | sheet | 7 cm (6 cm for OB), painted down to a 12% earth collar | a dark plinth, a chamfered cap | handle 2.2 cm |
| 3 | game (`arch-p2c`, Midwest, Parkland): pond stakes, the first 150-yd post, the first rake | stakes read clearly round a pond from its bank; in shade the red went maroon, so the game's red is brighter (#e64a34) | the white 150 band vanished on a white post: the body is dark green in the game, as many clubs paint them, so every band reads | the yellow head reads, but at true size it is nothing from a fairway: drawn a third larger (2.3 m), handle 3 cm |
| 4 | sheet | a steeper cap (its lit face catches the eye) | the band deeper (10 -> 14 cm) and proud of the post | twelve stouter teeth |
| 5 | game (`arch-p2d`, Links) | -- | dark green with its white band reads well in fescue | seen end-on: the camera and the rake both lay along the line out of the sand |
| 6 | game (`arch-p2e`, Desert) | stakes and posts take the furniture's ink, instanced: crisp cartoon stakes round a desert pond | inked | laid along the bunker's edge (markings.js), a dark grip; side-on it was **a stub**: the ingest's int16 box (two model heights) wrapped a model 27 heights long. Found and fixed with a per-model scale, `q`, for the Architect's families (build-meshes.mjs `OWN_SCALE`); eleven shipped models wrap the same way (TODO, *Eleven models wrap*) |
| 7 | game (`arch-p2f`, Desert) | -- | inked, reads on mown ground | full length at last, a yellow toothed head: reads as a rake beside the sand; the handle read as a dark stick |
| 8 | sheet | -- | -- | the handle lighter timber (#a9845a) and thinner (2.6 cm) |
| 9 | game (`arch-p2g`, Haunted Hollow) | red stakes along a creek's banks read against the purple | -- | reads clearly on the purple rough |
| 10 | game, **Low tier** (`arch-p2h`, Midwest) | bright and crisp round the pond on Low | -- | -- | 

### architect_clubhouses (ten clubhouses, one per landscape)

Each iteration was made on all ten together; "game" is a capture of every
landscape named.

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | sheet | ten distinct silhouettes; the chalet's gable, the stonehouse's twin gables and chimneys, the manor's turret, the clapboard's cupola and the shingle's dormers read at once; the lodge and farmhouse were one big brown roof plane, the pavilion's overhang hid its posts, the adobe's vigas were too short to see |
| 2 | sheet | a fascia board along every eave and a ridge cap; cross gables over the lodge's entrance and the farmhouse's middle bay; the pavilion's posts 4.8 m and its overhang 1.1 m; vigas 1 m long |
| 3 | game, all ten (`arch-c1` to `arch-c4`) | Midwest's white farmhouse and red roof, the Island pavilion, the Links stonehouse and Autumn's clapboard read well in their landscapes; the manor came out squat (every building drawn at the club's one height); the Mountain chalet stood hidden in its wood; Lakeshore's shingle was dull |
| 4 | game: Haunted, Mountain, Lakeshore (`arch-c5`) | each building as tall as its own model for its width (clubhouse.js `CLUBHOUSE_ASPECT`): the manor tall and crooked with lit windows; 15 m clear of trees round every clubhouse; Lakeshore's walls lighter. The chalet still hidden |
| 5 | game: Mountain, Redwood, PNW (`arch-c6`, `arch-c7`) | a 40 m lawn in front of every clubhouse, toward the first tee (clubhouse.js `inForecourt`): the PNW and Redwood lodges stand open on their lawns with the path to the door. Mountain had **no clubhouse at all**: its flattest site fell 4.4 m |
| 6 | game: Mountain, Links, Autumn (`arch-c8`) | a terrace: the floor level with the high side and a stone wall down to the low (renderer.js), a site may fall 4.5 m, and on steep land a municipal footprint on ground falling 6.5 m. The chalet stands on its terrace; the terrace walls and the Links stone read too dark. (A 6.8 m plinth in the model was tried first and dropped: the ingest stands a model on its lowest point, so it raised the whole building.) |
| 7 | game: Mountain, Links, Midwest (`arch-c9`) | the terrace a warm pale stone, the Links stone and slate lighter; the Links front still in shade (it faces its tee, away from the afternoon sun: honest) |
| 8 | sheet | a flagpole and flag by every door (inside the footprint's width: outside it, it widened every model and the game drew each building narrower), dark shutters on the farmhouse and clapboard; the height table re-measured (a test now holds it to the models) |
| 9 | game, all ten (`arch-c10`) | every clubhouse its landscape's own, a flag by the door, a lawn and the path in front: adobe on a terrace with its vigas, the manor's lit windows, the pavilion by the sea |
| 10 | game, **Low tier**: Midwest, Haunted, Island, close to and from the first tee (`arch-c11`) | all read on Low; from the tee the farmhouse sits behind the hole's sign as a clubhouse should |

Cost: a nine-hole course carries about 300 markings, drawn as twelve
instanced meshes (six kinds, two parts each, and the ink of the standing
ones) -- a dozen draw calls and a few thousand triangles. Measured with the
rest of phase 2 on Low (*Measures*).

### architect_water (bridge bays, rip-rap, tie wall, fountain)

| # | Judged on | Bridge bays | Rip-rap | Tie wall | Fountain |
| --- | --- | --- | --- | --- | --- |
| 1 | sheet | a timber bay (stringers, nine planks, posts, two rails) and a stone bay (slab, parapets, coping) read; the timber rails were threads | smooth pebbles: a river stone, not a quarried one | ten ties and a waler read edge-on | a spike with a tiny umbrella: the arcs were stunted (cause found at 9) |
| 2 | sheet | the rails a cartoon's thickness, posts stouter | ten hull points and a small bevel: angular, quarried | -- | a bell of separate lumps: confetti, not water |
| 3 | game (`arch-w3`, Midwest Parkland) | -- | a stone line along the waterline reads; pale and sparse | -- | inked and shaded like pebbles, **a grey stone mushroom** |
| 4 | game (`arch-w4`, Midwest; Redwood bridge) | the timber bridge reads strongly -- and **ran 30 m along the creek's bank** (paths.js: a bank within 1.2 m counted as wet) | darker per-landscape stone (pale stone went pink-white in the sun), 0.6 m apart, larger | -- | two tiers of drooping spray (the conifers' skirt), uninked, near white: reads as spray |
| 5 | game (`arch-w5`, Midwest Stadium; Redwood) | the path takes dry ground first; still along the bank | -- | **the tie walls read as Dye's sleepers**; too black, gaps on curves | wider raggeder tiers: **a snowy pine tree** |
| 6 | game (`arch-w6`) | bridges only over water itself, plus 3 m of bank: **crosses the creek's bend**, 12 m | -- | sections 2.2 m apart overlap round curves; a browner creosote | one wide bell: **a white tent** -- worse |
| 7 | game (`arch-w7`, Midwest Parkland) | -- | reads along both shores | -- | a jet and a cloud of spray (the trees' crown, white, lit as one body): **reads as a plume**, but its falling streams invisible |
| 8 | game (`arch-w8`; Autumn's stone bridge) | **the stone bridge crosses its creek squarely** and reads at once | -- | -- | twelve thicker streams, pure white: still no streams |
| 9 | sheet | -- | -- | -- | **the cause**: the tube helper draws one ring a radius, and two radii for five points drew only the first stretch of every stream (iteration 1's arcs too). One radius a point: a crown with twelve streams falling into a ring of foam |
| 10 | game, **Low tier** (`arch-w10`, Midwest Parkland; Desert) | -- | Desert's red stone edge reads as built | -- | reads as a fountain across its pond on Low |

Cost: a nine-hole Parkland course carries about 800 stones in three
instanced meshes, a Stadium one about 170 tie sections in two (and their
ink); a fountain is about 1,700 triangles, two a course at most; a bridge is a
handful of bays at about 100 faces each. Measured with the rest of phase 5 on
Low (*Measures*).

### architect_story (walls, a hedge, standing stone, lantern, farm, ruins, landmarks)

Each iteration was made on the whole pack; "game" names the captures.

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | sheet | thirteen models, drawn to story.js's footprints: the silo, windpump, ruined cottage, mine head, sugar mill, lighthouse, church, standing stone and lantern read at once; the barn showed only its roof slope from the front, and the chapel's gable stood whole |
| 2 | sheet | the barn turned: its gambrel gable with the big cross-braced doors and the hay door is its face, white trim along the gable (11 x 15 m); the chapel's front gable broken, its apex fallen |
| 3 | game (`arch-s3`: Midwest, Links, Haunted Hollow, a lot of story) | the farmstead reads at once; hedgerows read; the chapel reads on the dunes; **the stone walls drew near black** (the furniture's ink swamped their small stones); Haunted Hollow's ruins hidden in its wood |
| 4 | game (`arch-s4`: Links, Haunted Hollow) | walls uninked and their stone lighter: a grey dry-stone line on Links, a pale leaning wall on the moor; a story building keeps 20 m of trees off, and the chapel stands in its clearing; the landmark brought in from 220 to 150 m; the chapel's back gable broken too (whole, it read through the front as a house end) |
| 5 | game (`arch-s5`: Links, Autumn, Mountain, Island, Desert) | **the lighthouse floated** over a dune's slope and **a dune hid it** from the fairway: seated on the lowest ground under it, and placed only where its top half shows from 120 m short of the green -- then it stands on the line behind the green; Autumn's farmstead and stone wall, Island's sugar mill by the sea and Desert's adobe ruin read; the Mountain view stood inside a crag (the camera) |
| 6 | game (`arch-s6`: the Dell and Barranca on Autumn, the Alps on PNW; Mountain's mine head) | the Dell reads as a blind par three -- the mown approach climbs a dune, the green hidden beyond -- but its aiming stone was a speck; the Alps a great ridge between bunkers; the mine head and its wheel on the mountainside; the barranca unseen from eye height |
| 7 | game (`arch-s7`) | the aiming stone drawn 2.4 m; the barranca from 14 m up: a dip of rough across the hole between two fairways, the path beside -- and **three trees in the ravine across the line of play** (fixed in course.js: a gap is still the corridor) |
| 8 | game (`arch-s8`: the Pit on Links; the stone circle at dusk) | the Pit's wall a thin line from 150 m; the circle's stones crowded by the wood and lost in the dusk |
| 9 | game (`arch-s9`) | **the Pit**: a dry-stone wall across the front of the sunken green, seen from 70 m; **the stone circle** in its own 16 m clearing |
| 10 | game, **Low tier** (`arch-s10`: Midwest, Links, Haunted Hollow) | the farmstead, the chapel, the walls, the lighthouse on the line and the moor's ruins all read on Low |

Cost: a course with a lot of story carries three to five buildings (one
mesh each, inked), a few hundred wall sections in two instanced meshes, and
on Haunted Hollow about 150 lanterns and nine stones in three more.
Measured with the rest of phase 6 on Low (*Measures*).

### architect_life (sheep, goose, deer, elk, heron, roadrunner, bird, walker, mower)

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | sheet (face on) | the sheep (a fleece and a dark face), the walker with his bag, the elk's rack and the mower read; the sheep and deer stood high on their legs |
| 2 | sheet | the sheep lower on short legs; the deer's legs stouter and shorter |
| 3 | game (`arch-l3`: Links, Redwood, Autumn) | **at true size everything was a dot**: sheep specks in the marram at 22 m, the walkers small figures on Redwood's path; one stump of Autumn's felled avenue on its old line |
| 4 | game (`arch-l4`: Links, Redwood, Midwest) | drawn a quarter to a half larger than life (the rake's lesson), views at 10 m: **black-faced sheep in the marram**, **three golfers with their bags on Midwest's path**; the elk **read as a table** -- stick legs at its body's corners, a slab body, a pale belly plank under it |
| 5 | game (`arch-l5`: Redwood, Midwest) | legs inset, stout and coat-coloured to a dark hoof, a full body, no belly: the elk reads, and Midwest's doe stands at the wood's edge with her white tail |
| 6 | game (`arch-l6`: six landscapes) | the roadrunner running in the desert, a raven over Haunted Hollow, a heron by PNW's pond read; the geese were dark lumps; **the mower was in a wood** (placed before anyone asked where the trees were) |
| 7 | game (`arch-l7`) | life placed after the planting, clear of trunks; the mower tried at up to forty spots for a clear 30 m run: out in the open on Midwest and on a Links dune |
| 8 | game (`arch-l8`, Midwest) | the goose a lighter grey-brown with a wider white chin strap: **a Canada goose on the bank** |
| 9 | game, **Low tier** (`arch-l9`, Links) | no animals drawn on Low, as the goal asks |
| 10 | game (`arch-l10`: Links, Midwest) | the flock on Links; the golfers along the path's own points on both (a chord between two path points had walked them off it on a bend: found by the test) |

Cost: under forty animals and people a course, each kind one instanced mesh
per part, their matrices rewritten thirty times a second (a few dozen
matrices); none of it on Low. Measured with the rest of phase 6 (*Measures*).

### architect_occasion (grandstand, scoreboard, TV tower, marquee, rope, spectator)

| # | Judged on | What it showed, what changed |
| --- | --- | --- |
| 1 | sheet | all six read at once: the stepped stand with its event-green skirt and canopy, the scoreboard's names and numbers, the scaffold tower and its hooded camera, the peaked marquee, the rope's sag, a spectator in a sun hat |
| 2 | sheet | pennants on poles along the stand's canopy, so it reads as tournament week from down a fairway (the stand's footprint height becomes 8.6 m, or the game would squash its rows under the crowd) |
| 3 | game (`arch-w3` labels, Midwest, Sunday) | the scoreboard, the marquee by the clubhouse and a gallery in three shirt colours behind the rope read; **Sunday's crowd was a few strollers** (three a 6 m section); the stand behind the green small and dark from 95 m |
| 4 | game (`arch-o4`, Midwest, Sunday) | five a section; from 60 m out: **the full stand behind the last green, its pennants, a second stand, the scoreboard and the ropes** -- Sunday reads as Sunday |
| 5 | game (`arch-o5`, Thursday) | the stands nearly empty frames, the ropes thinly lined: the week has a beginning |
| 6 | game, **Low tier** (`arch-o6`, Sunday) | no crowd drawn; the stands, board and ropes stay |
| 7 | game (`arch-o7`, Links, Saturday) | the stands frame the last green in the dunes; **the scoreboard sank into the marram** on its 2.4 m legs |
| 8 | game (`arch-o7`, PNW, Saturday) | stands and a lined gallery along the closing hole in the forest |
| 9 | game (`arch-o9`, Links) | the board on 3 m legs (7.6 m overall): clear of the marram |
| 10 | game, **Low tier** (`arch-o10`, Links, Sunday) | stands, board and ropes on Low, no crowd |

Cost: three or four stands (one mesh each, inked), a scoreboard, two towers
and three marquees on a Championship venue only; about 70 rope sections and
up to about 1,100 spectators on Sunday (three instanced meshes of about 100
faces each), none of the crowd on Low.
