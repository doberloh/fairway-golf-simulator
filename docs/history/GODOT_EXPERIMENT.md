# The Godot experiment

**Stopped by the owner on 15 November 2026, after six rounds and the cost
of a move: "Lets abort the godot experiment entirely".** Never merged; the
branch is kept. This page is its journal as the branch left it, word for
word, brought to main when the experiment stopped: the commands, files and
the branch's rules it names are on that branch only. What came back to the
game: the course's woods carried past its line (RESEARCH, *The course's
woods carried past its line*). The verdict, with its figures: RESEARCH, *The
Godot experiment, stopped*; IDEAS.md, *Turned down*.

Branch `godot-experiment`, begun 15 November 2026 from main aa16b9aa (0.9.16),
in its own worktree. The owner: "I really want to see what the engine can do
... focus heavily on amazing lighting along with our haze/morning and evening
fog. And how light interacts with it."

It came from IDEAS.md, *A native Godot version, tried on one hole first*
(Claude's opinion, asked by the owner the same day). The owner picked it, so
it left IDEAS.md for this page. The case for and against a full move is
kept at the end.

## The rules while it is a branch

AGENTS.md, *On the godot-experiment branch, every look decision is open*:

- Any earlier look decision may be overturned. That covers Cartoon-only
  graphics, the palettes, the light, the water and the trees.
- Ask the owner first, each time. A yes covers only the decision asked about.
- Nothing else is loosened. Seeds, course codes, real ball and cup sizes, the
  rules and scoring, and the graphics-card and gaming rules all hold.
- The JavaScript game stays the one source of truth.
- The section goes when the branch merges or is dropped.

**Godot draws on the graphics card.** The editor and every run of the scene
need the owner's word in that turn, like smoke and captures. Read the card
with `node tools/gpu-gate.mjs` first, and close Godot before the turn ends.

## The shape of it

1. **Export, in Node (no card).** A tool, `tools/godot-export.mjs`, builds a
   course from its seed with the game's own generator, and writes one hole as
   a package. The package holds:
   - the height grid;
   - the surface of every cell (tee, fairway, green, rough, bunker, water and
     so on);
   - the trees and plants, each with its kind, place, size and turn;
   - the water;
   - the tee and the cup;
   - the landscape's light and hour.

   Nothing is recomputed on the Godot side: the export imports its geometry
   from `src` (the rule in AGENTS.md, *Measure with tools/bench.mjs*).
2. **A Godot 4 project in `godot/`**, using the Forward+ renderer (the
   desktop one). It reads the package and builds:
   - the ground as a mesh;
   - a material for each surface;
   - the trees as multimeshes of the models already in `vendor/` (.glb loads
     natively);
   - the water.

   Godot's import cache (`godot/.godot/`) is git-ignored. The Godot program
   itself lives outside the repository. Tools find it through the `GODOT`
   environment variable, never a machine path written in a file.
3. **The light, which is the point.** The plan is to use the following, then
   tune them:
   - a sun with soft, far-reaching shadows;
   - a physical sky;
   - Godot's volumetric fog, in which the sun's shadows fall, so shafts come
     through the trees;
   - forward scattering, so the fog glows toward a low sun;
   - height fog lying low in hollows and over water at dawn;
   - fog volumes for pooled mist;
   - bounce light (SDFGI) and contact shading (SSAO and SSIL);
   - bloom;
   - a filmic tone curve;
   - exposure that adapts.
4. **Three moods and a clock.** Early-morning mist, a clear midday and an
   evening haze. An hour slider runs from first light to dusk, and there is a
   free camera.
5. **Pictures beside the current game.** Each picture is taken at the same
   seed, hole, spot and hour as one from the current game, so the difference
   is plain. The frame time on the PC is measured too.

Phones are not the first target. A native iPhone build needs Xcode on a Mac to
sign it. This experiment is first about what the desktop renderer can show.

## Decided

The owner answered on 15 November 2026:

- **Godot 4.7.2**, the current stable version (18 August 2026), in the
  standard build (no .NET), scripted in GDScript.
  - The download was `Godot_v4.7.2-stable_win64.exe.zip`, 86 MB, from
    godotengine.org's own release storage.
  - Its SHA-512 matched the one Godot publishes.
  - It is unpacked in `%USERPROFILE%\Tools\Godot-4.7.2`, outside the
    repository.
  - **Not under AppData.** The first copy went to
    `%LOCALAPPDATA%\Godot-4.7.2`. The Claude desktop app is a packaged
    Windows app, and Windows gives a packaged app's processes their own
    private copy of AppData. So the file was there for Claude's tools, but
    the owner's terminal and Explorer said "cannot find" (15 November 2026).
    A tool meant for the owner goes in a plain folder, never AppData.
- **The look: both, side by side.**
  - First, the new light on the cartoon look: the game's own models, palette
    and surface map, and only the light, shadows, fog and haze new.
  - Then a more natural pass on the same hole. The `natural` switch (N) is in
    the ground shader, but that pass has not been worked on yet.
- **The landscape:** Pacific Northwest (`pacnw`), seed FAIRWAY, hole 1, a par 5.
- **The graphics card:** Godot may run on it for the rest of that session
  whenever the gate reads idle, through `tools/gpu-run.mjs --goal
  godot-experiment`, with `tools/gpu-watch.mjs` running. The rule stops if a
  game starts. A later session asks again.

## How the light is set up (main.gd)

PLACED means the value was set by eye; none is taken from a source. Each is
the first value that looked right, and each is open to the owner.

- **The sun.** It moves with the clock for the course's own latitude (47.6°),
  on 22 September (`DAY_OF_YEAR` 265), chosen for mist in the morning and a
  long evening (PLACED).
  - Low, it turns warm and weaker.
  - It has soft shadows in four cascades out to 1 km.
  - It lights the fog: `light_volumetric_fog_energy` 3 (PLACED).
- **The sky** is Godot's physical sky with lit clouds and an evening
  afterglow (`sky.gdshader`; *Third round*). Its haze (Mie) and turbidity
  rise in mist and evening.
- **Three layers of air:**
  - **Exponential fog** gives the blue distance on the far hills.
  - **Volumetric fog** is the air the sun's shadows fall through, with
    forward scattering (anisotropy 0.6 to 0.78). This is what makes the glow
    round a low sun, and the shadow a ridge throws across the mist.
  - **A low mist volume**, morning only. It is a wide box centred 6 m below
    the tee, its density falling with height (`FogMaterial` density 0.02,
    falloff 0.3, lit by the sky; PLACED), so hollows and the pond fill and treetops stand
    out.
- **The moods** (PLACED, all of them):

  | | Mist | Clear | Evening |
  | --- | --- | --- | --- |
  | Hour | 7:00 | 11:00 | 17:36 |
  | Volumetric density | 0.0009, with the low mist | 0.0002 | 0.0011 |
  | Exponential density | 0.00016 | 0.00009 | 0.00018 |

- **The rest:**
  - bounce light (SDFGI, 6 cascades);
  - SSAO, SSIL and screen-space reflections, for the ponds;
  - the ACES tone curve (AgX at first; *Third round* says why not);
  - soft-light bloom;
  - a fixed exposure that rises as the sun drops, and a sky fill light
    (adaptive exposure at first; *Third round*);
  - MSAA 4x with TAA.

**The cartoon paint.** A model's vertex colours multiply its part's colour,
stored halved (mesh-assets.js). The material named `bark` takes the species'
bark colour, and the others take its leaf colour, as vegetation.js does
(season-tints.js summer, else its `shades` and `barks` tables). Without this
every tree drew white: the first round's pictures.

## First pictures (15 November 2026)

The pictures are in `godot/shots/` (git-ignored). They were taken at
1920x1080 on the RTX 4090, through the gate.

**The card's time a frame:** 3.7 to 5.8 ms over every view and mood, with
SDFGI, volumetric fog and all 18,456 plants drawn. Godot's own measure,
averaged over the last 60 of 150 frames.

This is not yet a fair comparison with the game. The game's Ultra on the same
view has not been measured, and Godot is not yet drawing the grass, the far
forest's trees, the streams or the game's other world pieces. Speed is not
claimed from this figure.

**What works:**

- Facing a low sun, the tree line stands backlit in glowing mist, with warm
  rims on the crowns.
- From 85 m up in the morning, mist lies in the valley, and the left ridge
  throws a long shadow across it as a dark band. That is light and fog
  working together, which the browser game cannot draw.
- The evening reads warm.

**What does not, yet:**

- **Far hills.** They are smooth, treeless domes, and in the evening the haze
  turns them nearly white. The game draws far forest on them (far-trees.js);
  the export does not carry it yet.
- **Ground.** It is flat paint, so the near ground in shadow is a dark,
  featureless plane.
- **Light shafts.** No distinct shafts between the trunks yet: the forest has
  no gaps at the angles tried.
- **Mowing stripes.** They run along x only, not along each hole.
- **Not exported:** streams, large lakes, long grass, rocks, houses and the
  other world pieces. This first hole has none of the streams or lakes.

**Tried and changed** (first round to fourth):

- **Fog.** Volumetric density was 0.011 at first. Every view went white,
  midday included.
- **Ground sheen.** With specular 0.3, the ground shone toward a low sun. It
  is now 0.12, with roughness at least 0.85.
- **The "fairway" camera.** It was first placed on the straight line from tee
  to pin and landed in the woods: the hole doglegs. It now follows the hole's
  own centre line (`h.center`).
- **Mist volume.** A box 30 m deep, centred 12 m above the low ground, at
  density 0.05: everything near it white.

## Second round: far forest, natural pass, the game beside it (15 November 2026)

The owner asked for three things: trees on the far hills, then the natural
pass, then pictures of the current game from the same spots.

**Which tree models are drawn** (the owner asked):

| Trees | Model | Range |
| --- | --- | --- |
| The course's own | Full detail, the same .glb the game draws up close | Out to 420 m |
| The course's own | The model's far version | Past 420 m |
| The forest past the line | Far versions only | Everywhere |

The game draws that forest as flat pictures of the models (far-trees.js).

### What was built

**The far forest.** The export carries the game's own surround trees: 129,843
of them, from surround.js `surroundTrees` with Ultra's `cell` of 256, out to
5.9 km. They are drawn in 1,500 m squares (597 batches). With 512 m squares
there were 4,014 batches, which was too many draw calls.

**Per-tree shade.** Each tree is a little lighter or darker, as vegetation.js
`varyColour` does: 0.88 to 1.12, by its shade. This is on in both looks.

**Grass tufts.** These are in both looks, because the game has them too. There
are 312,794 tufts, on a jittered 0.55 m grid over the rough and a third as many
over the semi, within 120 m of the hole (PLACED).

- Each tuft is twelve bent, tapering blades, dark at the base and light at the
  tip.
- They move in a little wind and are lit through from behind.
- They are drawn to 140 m and cast no shadow.

**The natural pass (N).** The ground uses detail pictures painted once at
start-up:

- one of grass blades, 26,000 strokes on 512 px;
- one of pine needles, 9,000 strokes.

Each is used at two sizes turned against each other, mipmapped, with a bump
map made from the same strokes. On top of that:

- the turf is greyed and darkened a little;
- the rough has dry patches;
- sand gets grains;
- leaves are a little greyer and darker;
- the tuft tips are drier.

Every count, length and shade is PLACED.

**A dead end in the natural pass.** The first try was procedural value noise
for the blades and bump. At a few hundred metres from the origin the sine hash
lost float precision, and the ground showed small squares. A better hash and
coordinates kept near the origin removed the squares, but the noise still read
as blotches. The painted stroke pictures replaced it.

**The comparison.** `tools/capture/godot-compare.mjs` photographs the game's
capture build. It uses:

- Ultra, at 1920x1080 and density 1;
- `placeCamera` on the export's own spots, with the interface and ball hidden;
- the game's own dawn, noon and golden hour (capture.mjs `hourFor`), for the
  moods mist, clear and evening.

It writes the game's sun direction beside each picture. The Godot shots take
that direction as a sixth field, so both are lit from the same place.
`tools/capture/godot-sheets.mjs` lays each mood out as a sheet: per spot, the
game, then Godot cartoon, then Godot natural. The sheets are in
`godot/shots/` (git-ignored).

### What the sheets show

The first sheets were rendered with AgX, a sky of turbidity 3.5 and leaf
backlight at 0.8x. **The current game looked better in most pictures.** It
had:

- a blue sky with its clouds;
- deep, saturated toon greens;
- far hills that are forested with open slopes;
- valley mist that reads cleanly from above.

Godot made the cartoon trees pastel and the midday sky grey.

**Corrections, one pass:**

- ACES instead of AgX, which drained the cartoon's colour;
- a cleaner midday sky: turbidity 2, Mie 0.0015, and a bluer Rayleigh colour;
- saturation 1.15;
- leaf backlight 0.3x the leaf colour (0.5x natural).

After that the greens and the sky are close to the game's.

**Still behind the game:**

- **Clouds.** Godot has none yet. The game's clouds do a lot of its picture.
- **Midday trees.** At noon the sunlit tops of the conifers burn nearly white.
  The models' paint times two, under a sun of energy 3.4, goes past what ACES
  keeps; the game's toon ramp caps it.
- **The far hills.** At midday they read milky and pale green. The game's are
  dark forest with tan open slopes, from its own far-ground paint, which the
  export does not carry.
- **The rough.** The tufts make it read as tall grass, not the game's short
  rough.

**Where Godot is ahead:**

- The sun's shadows fall through the fog.
- Low light glows in the crowns.
- Tufts move and are lit through.
- The fine turf of the natural pass.

None of these is in the browser game.

**The card's time a frame** with the far forest and grass is 6.3 to 10.6 ms
over the 30 comparison shots (Godot's measure). The tee views are the
heaviest. The game's own frame time on these spots was not measured: its
capture runs at density 1 with the display's cap, which is not a fair
comparison. Speed is still not claimed either way.

## Third round: iterating until Godot looks better (15 November 2026)

The owner: "continue iterating on anything and everything until you feel
like godot actually looks better than our three.js version. I believe that
the peformance gains of godot are going to be massive and should be worth
it. If im wrong, tell me." They also gave a standing yes to every visual
change in the Godot scene, models included (AGENTS.md).

### The speed question, measured first

**How it was measured:**

- **The game** (`tools/capture/godot-timing.mjs`): the capture build, Ultra,
  1920x1080 at density 1, at the export's five spots and the game's three
  hours. Chrome ran with its frame cap and vsync off, so a frame takes as long
  as its work. The measure is the median time between frames over 4 s, after
  2.5 s to settle.
- **Godot:** the same measure (`run_shots` "wall": vsync off, the median of the
  last 60 frames).

All three columns are on the owner's RTX 4090, in ms a frame:

| Spot | The game, Ultra | Godot, as drawn | Godot, lean |
| --- | --- | --- | --- |
| tee (clear) | 6.9 | 8.6 to 9.4 | 6.2 |
| fairway (clear) | 5.8 | 6.4 to 6.9 | 4.2 |
| green (clear) | 5.5 | 7.9 to 8.8 | 6.0 |
| back of the green (clear) | 2.6 | 6.9 to 7.8 | 5.0 |
| from 85 m up (clear) | 7.8 | 7.2 | 4.0 |
| all 15 spot-and-hour shots | 1.5 to 8.3 | 6.4 to 10.2 | not measured |

- **"Godot, as drawn"** is every effect on: bounce light (SDFGI), volumetric
  fog, SSAO, SSIL, SSR, four 8192 shadow cascades, MSAA 4x with TAA, 312,794
  grass tufts, and full-detail trees to 420 m.
- **"Godot, lean"** (`--lean=1`) is about the game's own feature set: none of
  SDFGI, volumetric fog, SSIL, SSR or TAA; two cascades at 4096; MSAA 2x.
  Midday only.

**The answer: not massive, on this PC.**

- **As drawn**, Godot is slower than the game at most spots, because it does
  far more in each frame.
- **Lean**, it is about level: faster at three spots (by 10 to 50%), slower at
  two. It is still drawing grass and full-detail trees the game does not.
- **The phone was not measured.** A native iPhone build needs a Mac and
  Xcode. Where Godot might gain most (Metal directly, no browser) is the
  phone, and that is untested.

### What changed in the look

Each bullet names the problem a sheet showed and the fix. Every number is
PLACED.

- **The trees: their own shader (`tree.gdshader`).**
  - Problem: the paint times two put sunlit conifer tops past a physical
    albedo, so they burned white.
  - Fix: the albedo is capped at 0.62. The light wraps 0.35 past a crown's
    edge, as the game's toon ramp does. Light comes through the leaves from
    behind (0.55).
- **The sky: Godot's own physical sky with clouds on it (`sky.gdshader`).**
  - The first clouds, fractal noise, read as grey smears beside the game's.
    They became round puffs: a grid of cells, each holding a few overlapping
    blobs, with a broken rim.
  - The puffs are shaded away from the sun and toward their base, and tinted
    salmon at evening.
  - An afterglow was added: this sky model leaves the evening sky dark
    overhead, which is physically true and duller than the game's pink.
- **The tone curve: ACES, not AgX.** AgX drained the cartoon's colour.
  Saturation is 1.05.
- **Exposure, and a sky fill light.** Exposure is now fixed, rising 50% as
  the sun drops. A shadowless sky fill light shines from above, tinted by the
  sky, at 0.35 rising to 1.1 at a low sun. The dead ends are below.
- **Bounce light (SDFGI)** is stronger at a low sun (1 to 2.8).
- **The air.**
  - The haze is thinner and darker, so far hills read as hills.
  - Sun scatter is only 0.06 at midday; before, looking toward the noon sun
    gave a white wall.
  - **The morning mist lies low.** The general fog is 0.0009, and the mist
    volume is 0.02 with a falloff of 0.3, lit by the whole sky (ambient inject
    0.75).
- **The ground and the far hills.**
  - The rough is painted 22% lighter, as the game paints it.
  - Tufts are a third shorter.
  - The far hills are dark forest, with open slopes on about a quarter of
    them.
- **The natural pass** is no longer darker than the cartoon look (turf ×1.02
  instead of ×0.9).

### Dead ends, kept so nobody repeats them

- **Adaptive exposure.** Looking down on a dark forest, it brightened the
  picture to mint trees and cream hills.
  - Capping how far it brightens (`auto_exposure_max_sensitivity` 320) changed
    nothing visible.
  - A fixed exposure alone left the evening ground black, even at three times
    the light.
  - What lit the shade was the fill light, not exposure.
- **`ambient_light_energy` alone.** With SDFGI on, the shade is lit by SDFGI,
  so raising ambient did nothing visible.
- **Dense general fog for the morning** (0.004 to 0.007). Every view went
  milky, worst from above, where the sight line runs through hundreds of
  metres of it.
- **Fractal-noise clouds.** At every cover and softness tried, they read as
  smears or wisps.

### The verdict, honestly

These are the fifteen spot-and-hour pictures of the cartoon look, against
the game's.

**Ground level (tee, fairway, green, back of the green): Godot wins or ties
in most.**

- **Evening:** Godot is better. Lit greens, warm light on the trunks, the
  sky glows and the depth reads.
- **Morning:** Godot is as good or better: low mist along the fairway, tree
  lines fading into it, and the sun glowing through the crowns.
- **Midday:** a tie. The game's sky is still a little lighter and bluer; the
  clouds are now comparable.

**From 85 m up: the game still wins, in all three moods.**

- Godot's trees seen from above are paler.
- Its far hills are milkier.
- Its morning view is hazier, where the game's mist lies in clear bands.

So Godot looks better where the game is played, and not yet in the aerial
view.

## Fourth round: the view from above (15 November 2026)

The owner: "Fix the aerial view", and asked how to fly about in it.

**Flying about.** Double-click `godot/fly.cmd`. It opens a 1600x900 window
and uses the graphics card. The controls:

- **Look:** the right mouse button.
- **Fly:** WASD.
- **Down and up:** Q and E.
- **Faster:** Shift, five times.
- **Speed:** the scroll wheel sets the flying speed, 2 to 300 m/s.
- **Mood:** 1 mist, 2 clear, 3 evening.
- **Clock:** [ and ].
- **Camera spots:** V cycles them.
- **Ground:** N switches the natural ground.
- **Picture:** P saves one.
- **Help:** H hides it.

The help and a frame counter sit on the screen. `--size=WxH` sets the window.

**How the cause was found.** Switches turned one effect off at a time
(`--off=fill,fog,vol,sdfgi,ssao,ssil,glow`, plus `showshade`, which paints
the shade map on the ground). The results:

- **The far haze milked the hills.** With it off they came out crisp.
- **The trees' own lighting made them mint.** Neither bounce light, fill
  light, SSIL nor bloom changed them.
- Seen from above, nearly every surface is a sunlit crown, and Godot lit it
  at the sun's full strength. The game's toon ramp holds a sunlit crown near
  its own colour.

**The fixes:**

- **The crowns.** They take a share of the sun: 0.55 at noon, rising to 0.85
  at a low sun (`sun_gain`, PLACED). Under a low sun they still glow.
- **The tree light** is flat toward the sun, as the game's ramp is.
- **The haze** is thinner and darker: exponential density 0.00004 at midday,
  aerial perspective 0.1.
- **The far hills** are dark teal forest, with open slopes on about a fifth
  of them.
- **The shade under trees** is the game's own: occlusion.js's map, exported
  as `shade.u8`. It is applied as in ground.js, and as occlusion of the light
  too, with a 32 m blur so a stand's floor reads as a whole.
- **Bounce light and SSIL** are weaker at a high sun.
- **The sky fill light** is 0.12 at noon (it was 0.35).
- **The morning mist** reaches the treetops, thinner: density 0.0075,
  falloff 0.11. Lying under 30 m crowns, it could not be seen from above.

**A dead end.** The exported shade map turned out to be mostly rings at each
trunk's foot (the game's is the same). It cannot darken a whole stand by
itself, hence the blur.

**Seen on the sheets:**

- **Midday from above:** a deep green forest, now close to the game's.
- **Evening from above:** close. Godot's is a little lighter and greener.
- **Morning from above:** mist lies among the trees. The game's distinct mist
  bands are still a little nicer.
- **Ground level:** kept. Morning at ground level is a touch hazier than
  last round, the price of mist that shows from above.

**The card's time:** 6.4 to 10.1 ms a frame over the 15 cartoon shots.

## Fifth round: the owner's notes (15 November 2026)

The owner, after flying it: "The lighting is clearly more capable in godot",
then five things wrong, and later a screenshot of red and olive stripes past
the property line, and "I dont think its even the same color".

### What changed, by note

- **"A ton of mid day mist/haze."** The atmosphere now runs on the game's own
  clock: the export writes daylight.js `solarState` and `mistAmount` every
  quarter hour (`meta.clock`), and `apply_time` reads the sun, the key light,
  the moon, the haze and the mist from it, nights included (key 4). Noon's
  haze is next to nothing (fog density 0.00004).
- **Mist "in the morning/evening/night hours ... into the low parts of the
  ground".** A mist bed (`mist.u8`): 16 m cells 700 m round the property,
  each column's top 22 m over the lowest ground within 200 m, smoothed, never
  over 45 m above the course's low ground (its 20th percentile), fading over
  the last 6 m; a FogVolume reads it as a 3D density texture, by the hour's
  `mistAmount`. Density 0.028 was a whiteout at ground level; 0.011 (PLACED).
- **"Trees in the distance do not fill out the landscape."** Two causes. The
  far paint was missing (next note), and the export had dropped far-trees.js's
  growth: a far tree is drawn up to twice its size as its sites thin
  (`farGrowth`), and past 700 m a quarter wider -- a narrow one up to 1.85
  times -- and a sixth into the ground. surround.bin now carries the grown
  height and spread and how far into the 700 m each tree stands; main.gd
  widens and sinks it the same way.
- **"Tufts of grass just sort of popping out of flat ground ... more
  texture."** The game's turf detail atlas (turf-detail.js) is exported and
  laid on the course's ground as ground.js lays it (rough strokes at 2.2 m
  and a turned copy, mown nap, sand grain, stone; ×1.4, PLACED). The tufts
  are shaded root to tip as vegetation.js shades a blade: 0.62 of the rough's
  colour at the root to 1.12 at the tip, light through a blade cut from 0.6
  to 0.2. Round 5's lightened tips rendered as pale straw blades.
- **The stripes past the line, and two colours meeting.** The course's ground
  past the line repeated the surface map's last row outward. Now
  `farpaint.gdshaderinc`, a port of ground.js's far ground and far forest
  (the same whole-number `coverHash`, the 380 m woods, the 900 m meadows, the
  wandering edge, groves, clusters, floor and canopy), paints both that band
  and the far ring; it first rendered cream because it was handed the rough
  lightened 0.22, and the property's patches and turf detail were missing on
  the far side. Both fixed; the far paint darkens to four fifths by 400 m
  past the line, not at it (PLACED: Godot's sun lights a flat meadow harder
  than the game's toon ramp).
- **"We dont blend the trees out into the surrounding landscape. We need to
  make that fix at the root."** That was the game's own fault too: the rim
  stand ran to the line, the country's pattern began there, and outside the
  line trees stood 12 m apart against the stand's 9. Fixed in the game
  (src/edge-woods.js; PROJECT_HANDOFF *The course's woods carry on past its
  line*; RESEARCH has the numbers): the course's woods carry on 180 m past
  the line at their own density and give way raggedly to the country. The
  export hands Godot the same 32 numbers. **It is a change to the game on
  this branch**: if the experiment is dropped, it must be taken to main by
  itself.
- A timing bug: with fewer than about 60 frames the slowest-tenth index ran
  past the end, the script stopped, and Godot stayed open until killed.

### Every look decision of the game, and where Godot stands

The owner: "Go through and look through all our graphical decisions and
determine if they exist in the godot version yet, and if they are needed."
Judged against what the experiment is for (light, haze and fog, and whether
Godot can look better).

| The game's | In Godot? | Needed? |
| --- | --- | --- |
| Landscape record's palette (turf, rough, green, sand, rock, leaves) | Yes, from the export | Yes |
| Mowing stripes, green bands | Stripes yes; the green's bent bands no | Bands only for putting views |
| Turf detail atlas (strokes, nap, grain, stone) | Yes (this round) | Yes |
| Ground cues: relief, slope tint, sheen, dry patches | Patches only; Godot's own normals give relief | Slope tint and dry patches: yes, they are most of the game's ground colour from above |
| Occlusion under trees and rocks (occlusion.js) | Yes (`shade.u8`) | Yes |
| Forest floor under stands (vegetation.js U6), long grass | No | Long grass yes -- it is what reads as "native" ground; the floor partly covered by the shade |
| Grass tufts | Yes, shaded as the game's | Yes |
| The course's trees, near and far versions | Yes, the same models | Yes |
| Trees moving in the wind (textures.js `windMaterial`) | Yes (sixth round), the game's own bend | Yes |
| Far trees past the line (surround.js), grown and widened | Yes (this round) | Yes |
| Far ground and far forest paint | Yes (this round) | Yes |
| Far ring relief, crags, baked shade | Relief yes; baked shade no | Shade small; Godot's GI and shadows do most of it |
| Snow on tops, seasons, autumn colour | No | Not for one Pacific Northwest summer hole |
| Water: probe reflections, shallows by depth, ripples | SSR and its own ripples; shallows by depth (sixth round) | Yes |
| Water mirror twins of trees | No (SSR instead) | No, while SSR holds up |
| Sky, sun disc, clouds, cloud shadows | Physical sky, puff clouds, cloud shadows (sixth round) | Yes |
| Stars and the moon at night | Moonlight and stars (sixth round); no drawn moon disc | A moon disc for night views |
| Mist and haze by the hour (daylight.js) | Yes (this round), as volumetric fog | Yes -- the point of the experiment |
| God rays | Volumetric fog does them | Yes, already |
| Shadow reach (3.5 km on Ultra) | 1 km | Only seen from the air |
| Houses, clubhouse, walls, paths, roads, bridges | No | Yes before any judgement of a whole course; not for one hole of woods |
| Tee markers, flag, cup, ball | Flag only | Markers and ball for play views |
| Rocks and boulders | No | Yes on landscapes that have them |
| Floodlights | No | Only for night play |
| Wildlife, ball trail, HUD | No | No (the game's job) |

## Sixth round: wind, cloud shadows, stars, shallows (15 November 2026)

The owner picked the first group of the inventory: "Yes, start group 1".

- **Trees in the wind.** tree.gdshader moves a tree as textures.js
  `windMaterial` does, every number the game's: the whole tree bends from its
  root with the gusts (fronts carried downwind at the wind's speed), sways
  about that lean at its natural rate (3 H^-0.75 swings a second), a smaller
  crosswind sway a quarter-turn behind, and the leaves rustle on top. Each
  instance carries its root and height (MultiMesh custom data); the course's
  wind and each kind's stiffness come from the export (`meta.wind`;
  species.js `swayOf`, moved there from vegetation.js so both read it). Seen:
  two pictures of the tee view seconds apart differ in 1.3% of the trees'
  band and 3.8% of the near grass, where two at the same moment match to the
  pixel. The course's wind is 4 mph, so it is gentle, as in the game.
- **Cloud shadows.** The cloud layer moved into `clouds.gdshaderinc`, shared
  by the sky and the ground, grass, trees and far hills, which find the cloud
  along the ray toward the key light (the game's `cloudShadowAt`, its 0.08
  floor under a low sun) and take a share of that light only -- "a cloud
  blocks the sun, not the sky". The ground, grass and far hills got a light
  function of their own for it (Lambert where Godot's default was Burley's,
  and no specular). The sky is fixed in the world now (from the camera's own
  place), so a shadow lies under its cloud. **0.75 of the sun, not the
  game's 0.45** (PLACED): at 0.45 nothing could be seen from 85 m up at noon;
  Godot lights the shade with far more sky light than the toon ramp. Cost:
  7.69 ms against 7.34 with them off, the high view (about 5%).
- **A sky shader does not see a global uniform changed after it starts**:
  the first test sky stayed at the project's cover while the shadows took
  the new one. The sky keeps its own copy of the layer's numbers, set beside
  the globals in one place (main.gd `set_clouds`). Measured after: the
  test's cover 0.7 put 9.6% of the top of the picture under cloud against
  8.1%; dawn's 0.18, 4.3%.
- **Stars**, as renderer.js draws them (`starLayer`, two layers of cells on
  the dome, twinkling), turned about the game's pole by the hour, by the
  clock's starness, under the clouds.
- **Shallows at the shore.** The water is opaque (its screen-space
  reflections need that), so it cannot show its bed; the export writes how
  deep each metre is (`shore.u8`, 0 to 3 m), and over the last 0.7 m the
  water turns to the bank's mud and stops being a mirror, its edge wobbled by
  the ripples (PLACED). The game's own still water reads a depth map for its
  shallows too (PROJECT_HANDOFF *STILL WATER READS THE SEA'S DEPTH MAP*).
- **A grey window, and why.** A test switch declared a name the function
  already had; Godot refused the whole script and showed a grey window that
  never loaded (the owner saw it; `fly.cmd` would have done the same). The
  scene is now loaded headless (`--headless --quit-after 3`, a few seconds,
  no graphics card) after every script change, before any window opens. Two
  more names clashed inside the shaders (`cell`, `size`): every name in
  clouds.gdshaderinc starts `cl_` or `cloud_`.

## Next

1. From the inventory above, in order: long grass, the ground's slope tint
   and dry patches (the likeliest reason the far hills read too light). (The
   mist from above, once item one here, is the mist bed of the fifth round;
   wind, cloud shadows, stars and shallows are the sixth.)
2. Clouds with more height (a second, higher layer, or real volumetric
   clouds).
3. Light shafts between trunks: views along gaps, and finer volumetric
   froxels near the camera.
4. The phone: Godot's Mobile renderer on the owner's iPhone. This is the only
   place a big speed gain could still be found. It needs a Mac with Xcode, or
   a test of Godot's web export.
5. Other landscapes. Everything so far is one hole of the Pacific Northwest.

## Why one hole, and not a move (from IDEAS.md, 15 November 2026)

**What Godot gives on a PC.** Godot 4's desktop renderer talks to the card
directly. It has what WebGL in a browser lacks:

- softer shadows;
- bounce light;
- volumetric fog;
- screen-space reflections;
- modern anti-aliasing and upscaling;
- automatic level of detail and occlusion;
- grass on the graphics card.

**What it gives on the iPhone.** A native iPhone app skips the browser's
layers: the benchmark's 10 ms readback, and WebGL translated to Metal. It can
also read the phone's heat state and ease off before the phone throttles. It
would not stop the iPhone changing speed by itself (RESEARCH, *The hold, on
the iPhone*).

**Against a full move:**

- It would lose the offline single file, the browser demo and opening a link
  on a phone. Godot's web export is a large download, on its weakest renderer.
- It would put the iPhone behind the App Store.
- Every seed and course code would produce different ground, unless the
  generator were ported to the last decimal.
- The ground shader, materials, menus, Course Builder, sounds, launch-monitor
  bridge and 1,632 tests would all be rewritten.
- Checking the look needs the card.

**The test instead.** Keep the JavaScript game (generation, physics, rules and
tests) as the one source of truth, and let Godot only draw a course it is
handed. Build one hole of one landscape, and measure it against the current
game.

**A middle path for Ultra alone** would be three.js's WebGPU renderer, which
does its work on the card inside the browser. Its catches: the materials must
be rewritten in its node language, and it was found slower for scenes made of
many meshes.

The cost: large for this test, and very large for a move.

## Journal

- **15 November 2026.** The branch and worktree were made. The rule went into
  AGENTS.md and the idea moved here from IDEAS.md.
- **15 November 2026, later.** The owner answered the four questions under
  *Decided*. Godot 4.7.2 was downloaded and checked. Then were built:
  - `tools/godot-export.mjs`, which writes:
    - the ground mesh (655,034 vertices);
    - the far ring to 13 km (83,237 vertices);
    - surfaces every half metre (2058x3133, 11 kinds);
    - 18,456 plants of 7 kinds, with their models and colours;
    - 3 ponds;
    - six camera spots.
  - The Godot project in `godot/`.

  Six rounds of pictures followed on the card (gpu-run, about a minute each).
  These are the first pictures above.
- **15 November 2026, second round.** The owner: "Trees and natural pass and
  then do current game pics to compare from same spots." Built:
  - the far forest;
  - grass tufts;
  - the natural pass;
  - the game's comparison capture (15 pictures);
  - 30 Godot shots lit by the game's suns;
  - three sheets.

  One correction pass on the tone curve, sky and leaf light followed. See
  *Second round*.
- **15 November 2026, third round.** The owner asked for iteration until
  Godot looks better, and for the truth about speed. First the game and Godot
  were timed the same way. Then about fourteen rounds of pictures were taken
  on the card, all through gpu-run with gpu-watch running. See *Third round*:
  - Godot looks better at ground level and not yet from above.
  - Speed is not massively better on the PC.
