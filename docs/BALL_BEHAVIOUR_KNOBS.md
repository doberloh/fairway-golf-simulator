# What changes what

A plain-language map of every number that tunes the ball and which part of its
behaviour it moves. Written so a request can name an OUTCOME and we both know
which knob it lands on. Rewritten 11 November 2026 for the rebuilt ball model;
**docs/BALL_PHYSICS.md** says what each number rests on.

The vocabulary used throughout:

- **carry** — where the ball first touches down.
- **first hop** — the bounce off the pitch mark. It has a *height* and a
  *length* (how far forward before the second bounce).
- **run** (or release, or run-out) — where it finishes, measured from the pitch
  mark. Positive is forward, negative means it came back past its own mark.
- **check** — the ball stopping short after a hop. **Come-back** (zip-back) —
  finishing behind its pitch mark.
- **grip** and **skid** — the two things a spinning ball can do in a bounce.
  Gripping, it spends all its backspin in one bite. Skidding, it keeps some for
  the next bounce.

## The one rule

**Change a number, then run `node tools/ball-bench.mjs`.** It scores the ball
against 149 real-world targets in about a second and names the source of each.
A change that makes one shot look right and fails the bench has traded a
measurement for a feeling. To try a value without writing it:

```sh
node tools/ball-bench.mjs --set green.mu=.55,.45,.40 --set ROLL.power=.4
node tools/ball-bench.mjs --shot 120,16.3,7097        # one shot, hop by hop, on each firmness
node tools/ball-bench.mjs --land 22,51,9100,green,3   # from landing numbers, into a 3% upslope
```

Fitting a surface against ONE club looks excellent on that club and wrecks the
rest. Every green is checked against every club that lands on one.

## What the player sets — `turfConfig` in `src/turf.js`

| Setting | Range | What it changes |
|---|---|---|
| Green speed (`stimp`) | 6 to 15 ft | how far a ball ROLLS on a green: putts, and the last part of every chip and approach. Nothing about the landing |
| Green firmness (`greenFirmness`) | soft, medium, firm | what a ball does when it LANDS on a green or collar: first hop, whether spin grips or skids, run |
| Fairway firmness (`courseFirmness`) | soft, medium, firm | the same on tees, fairways, semi-rough and rough: how high and how often a drive bounces, how far it runs |
| `CONDITION_PRESETS` | Everyday, Club, Tournament | the three at once: 8.5 / soft / medium, 10 / medium / medium, 12 / firm / firm |

## Per-surface table — `SURFACES` in `src/turf.js`

One row per surface. A column written `[soft, medium, firm]` moves with that
surface's firmness. The wild ground types' rows are in `src/grounds.js` (`turf`).

| Column | What you see when you RAISE it |
|---|---|
| `e0` | gentle hops come back higher: more small bounces before the ball settles. A dropped ball's bounce |
| `eHi` | a full shot's first hop is a little higher. Small effect: most of a first hop's height comes from `tilt` |
| `tilt` | the first hop is HIGHER and SHORTER: the pitch mark stands the ball up, and more forward speed is lost. The main lever on first-hop shape and on how far a low shot runs |
| `mu` | the ball grips more easily: spin is spent sooner, a spun shot checks on its first bounce instead of its second. Only matters when the limit binds; chips and gentle bounces |
| `shear` | the most spin one bounce can take off a FULL shot (m/s of ball speed). Raise it and full shots grip instead of skid: less hop-forward, less come-back on the next bounce |
| `arm` | (lower = more come-back.) Below 1 a skidding ball keeps more backspin for the speed it loses, so a spun wedge checks harder and comes back further |
| `dig` | a hard landing loses more of its forward speed in its own pitch mark: shorter run for full shots, steeper ones most. Gentle bounces are untouched |
| `grab` | every contact loses forward speed and spin: long grass. Rough stops a ball with this |
| `slide` | a skidding ball slows faster: a shorter skid on a putt, a quicker check once a spun ball is on the ground |
| `stimp` | (not greens) the surface rolls further: fairway run after the bouncing stops |

### Which one do I reach for?

| I want | Reach for |
|---|---|
| full irons to run less on medium greens | `green.dig` (middle value) up; or `green.tilt` up |
| wedges to come back more on firm greens | `green.arm` (firm value) down a little; check the `spin` section of the bench |
| nothing to come back on soft greens | `green.dig` (soft value) up: the pitch mark swallows it either way |
| chips to roll further | `TILT.power` up a little (gentle bounces dig less), or `SEVERITY.power` up (medium and soft behave more like firm for a chip) |
| a higher, shorter first bounce on fairways | `fairway.tilt` up |
| drives to run further on firm fairways | `fairway.dig` (firm value) down, or `fairway.stimp` (firm value) up |
| more visible bounces after a drive lands | `fairway.e0` up |
| rough to stop the ball harder | `rough.grab` up |
| putts to skid less | `green.slide` up |
| long putts to run further without touching short ones | `ROLL.power` down (and re-check the TrackMan putt in the bench) |

## Laws shared by every surface

| Knob | Where | What it changes |
|---|---|---|
| `TILT.power` | `src/bounce.js` | how the pitch-mark tilt grows with speed into the ground. Lower: gentle bounces dig relatively more, so chips and later bounces lose more. 0.7, fitted |
| `TILT.fade` | `src/bounce.js` | over how many degrees before grazing the tilt dies away. Lower it too far and a rolling ball is kicked into the air |
| `SEVERITY.power`, `digMax` | `src/bounce.js` | how quickly firmness comes into play as landings get harder, and how far past the reference impact `dig` keeps growing |
| `E_FAST` | `src/turf.js` | the speed into the ground (20 m/s) at which restitution reaches `eHi` |
| `SETTLE_SPEED` | `src/physics.js` | a bounce that leaves slower than this (0.3 m/s, a 5 mm hop) is over: the ball is on the ground |
| `ROLL.power` | `src/turf.js` | how much harder mown turf resists a faster-rolling ball. 0 is a flat deceleration; 0.42 is fitted to a measured long putt. The Stimp is exact at any value |
| `ROLL.floor` | `src/turf.js` | below this speed (0.5 m/s) the resistance is flat. Sets the steepest slope a ball can stop on |

## Flight — `AERO` in `src/aero.js`

Refit with `node tools/flight-fit.mjs --fit`; never by hand. Check peak height,
landing angle and time in the air, not only carry.

| Knob | What it changes |
|---|---|
| `liftMax`, `liftHalf` | lift against spin ratio: how high every shot flies and how steeply it lands. `liftHalf` lower gives low-spin shots (drives) more lift |
| `dragBase` | drag at a drive's low spin ratio: drive carry |
| `dragRise`, `dragHalf` | how drag grows with spin ratio: iron and wedge carry, and how steeply they come down |
| `dragLow`, `lowRe`, `lowReWidth` | extra drag on a slow ball: chips, pitches, the end of a high wedge |
| `spinTau` | how fast spin dies in the air: spin at landing, so everything a ball does on a green |
| `windHeight`, `windShear`, `windFloor` | the height the stated wind is at, and how much slower it is near the ground: how much less a low shot is moved than a high one |

## The hole — `CUP` in `src/cup.js`

| Knob | What it changes |
|---|---|
| `rimE` | the rim's bounce. Raise it and firmer centred putts drop (a ball popped up by the back rim comes down in the hole): Holmes, 1.63 m/s at 0, 1.97 at 0.3 |
| `rimMu`, `wallMu` | grip of the rim and the liner: how long a ball rides round before it drops or lips out |
| `wallE`, `floorE` | how much a ball rattles off the liner and the bottom |
| `hardE`, `hardSpeed` | how dead the cup is to a HARD hit: by `hardSpeed` m/s into the rim, wall or floor the bounce has fallen to `hardE`. Raise `hardSpeed` and a ball flown into the hole starts bouncing back out |
| `pinE`, `pinMu` | the flagstick's give and grip. Raise `pinMu` and a ball rolling into the stick climbs it and pops back out |
| `dt` | the cup's time step. Not a tuning knob |
| `FLAGSTICK_HIT_R`, `FLAGSTICK_HOLE_R` (`src/physics.js`) | the stick a ball meets: 0.75 in across in the air, 0.5 in inside the hole. The drawn stick (`FLAGSTICK_TOP_R`, `FLAGSTICK_BASE_R`) is wider and is the picture only; at the drawn inch nothing could be holed with it in |

## Things that are NOT knobs

- **The Stimp.** A released ball runs exactly the reading at any `ROLL`
  setting. Do not tune a green's speed anywhere but the player's setting.
- **Whether a ball grips or skids, drops or lips out.** Neither is decided
  anywhere; both fall out of the numbers above. A request to "make it lip out
  less" is a request about `rimE` or `rimMu`.
- **Graphics quality.** No tier touches a played surface.
- **The firm green.** It is fitted to the USGA and R&A's launcher measurements
  as one piece (`tilt`, `eHi`, `mu`, `shear`, `arm` together). Moving one alone
  breaks the `firmgreen` section of the bench.

## The Swing Meter — `src/swing-meter.js`

What a golfer's swing does to the ball (since 14 October 2026; it replaced the
power slider, the per-shot shape sliders and the ball-flight profile; on the
pull-push-swing branch its three-tap bar went for the pull and push, below).
It decides only the five launch numbers; nothing after impact. Every number
here is **placed**, chosen by feel, and RESEARCH.md *The Swing Meter* says so.

| Knob | What it changes |
|---|---|
| `DIFFICULTIES` | per golfer: the strike zone and perfect band half-widths (in lengths of a full swing; the pull and push turns them into degrees), and whether the blue stop allows for the wind (`wind`, Easy only) |
| `OVERSWING`, `OVERSWING_CARRY` | how far past full a pull runs and what that is worth (+5% carry, the only way past the bag) |
| `strikeZone` | what narrows the zone: rough (×0.8), sand (×0.7), each step of added spin (×0.85), Flop (×0.8), overswing (down to half); under 40% of a full swing it widens (×1.5) |
| `strikeEffect` | what a miss does: at the zone's edge 1.25° off line and 5° of spin axis, growing to four times that. **Right of the line is right, left is left**, for everyone |
| `CURVE_AXIS` | Draw and Fade: ±8° of spin axis, with the start line turned the other way by as much as it bends (`curveCompensation`) so it lands on the aim line |
| `shapedLaunch` heights | Low −4°, High +4° launch; near the green a wedge's Bump & run is 55% of its launch on half its spin, Flop +10° |
| `SPIN_SCALE` | the old spin steps (−1 is 75% of the club's spin, +1 to +3 add a tenth each), read only for a shape with no spin dot: tests and older records; the game sets spin with `SPIN_DOT` (below) |
| `HEIGHT_SPIN` | what a height does to the club's spin, from the geometry of the strike: Low 0.92, High 1.08, Bump & run 0.5, Flop 0.85. Nothing here is tuned to what the ball does on the green; `node tools/meter-landings.mjs` prints that |
| `LIE_SPEED` | **the lie, for every golfer**: semi-rough keeps 96% of ball speed, rough 90%, sand 85% (PLACED). A launch monitor's measured speed takes the same share unless the round switches it off (`monitorLie`) |
| `LIE_SPIN` (`lieSpin`) | **the flyer**: grass takes spin from a lofted shot. `from` (16 degrees of launch) is where it starts, `full` (28) where the whole `loss` is reached: rough 0.45, semi-rough 0.20. Raise `loss.rough` and wedges out of the rough run further; raise `from` and fewer clubs are touched. Sand has no loss |
| `SWING_RANGES`, `swingZoom` | a short full shot's pull: half or quarter of the club's full carry, the shortest that holds the circle with a quarter to spare |
| `PUTT_RANGES` | how far a putt's pull reaches: a thirty-second of the putter's roll (so a tap-in is still a real pull, 16 November 2026) up to six times it, so a putt can cross any green at any Stimp; `puttSpeedFor`'s cap (3x the putter's speed) has to allow the longest |
| `targetShare` | the blue stop: the circle's distance through `playsLike` (slope and air always, wind only where the difficulty's `wind` is true -- Easy), then the share of a pull for that carry with the lie's lost speed made up |

## The pull-and-push swing — `src/swing-stroke.js`

How a golfer swings on the experimental branch `pull-push-swing` (15-16
November 2026; the three-tap bar is gone): pull back for the distance, push up
through the line to strike and finish in a shot cell, on the swing pad the
Swing button opens or with a controller's right stick. It hands `swingLaunch`
the same strike terms `strikeEffect` does, so everything above still applies.
All PLACED; RESEARCH.md *The pull-and-push swing*.

| Knob | What it changes |
|---|---|
| `STROKE.degPerBar` | how many degrees of push drift equal one length of the strike zone (120: Normal's zone about 8° each side) |
| `STROKE.lineHla` | what a start off the line costs: 2.5° of launch direction per zone width, to four times that |
| `STROKE.shapeFrom`, `shortStart` | the shape point the push or pull is read from: 0.3 of a full pull below the strike line (or half the pull); a stretch to the finish under 24 px reads against the aim line instead |
| `STROKE.laneAt`, `STROKE_LAYERS` `straight` / `lane` | where the ball starts, picked by the finish: the Push column centred 22° to the RIGHT, the Pull 22° to the left; half-widths straight 8 / 6 / 4°, lanes 12 / 9 / 6° (Easy / Normal / Hard). Widen them and picking a start gets easier. (Draw and Fade columns until 16 November 2026: the curve is the spin dot's now) |
| swing-meter.js `pushStart` | how far off the aim a Push or Pull starts: as far as the spin dot's full side spin bends that club back (about 4.6° driver, 4.9° 7 iron, 2.5° sand wedge at full speed), so push plus full draw lands on the aim. Raise `SPIN_DOT.axis` and both widen together |
| `STROKE.laneMissHla` | a finish that misses a column: 1.5° more (or less) start off the aim per lane width |
| `STROKE.lowBelow`, `highFrom` | the shot cells' rows: a finish under 0.2 of a full pull past the line is Low, from 0.5 High |
| `STROKE.settle`, `throughMax`, `throughCap` | when the follow-through ends and the ball leaves: still for 90 ms, 600 ms after the strike, or 0.7 of a full pull past the line (also the top of the pad) |
| `STROKE.backRatio`, `backPerfect`, `backZone`, `backSpeed` | the backswing: the pace cue plays it at 3 times the ideal push, and on Hard (`STROKE_LAYERS` `back`) the backswing's time over the push's own is judged against 3 : 1 for a pull of at least 0.4 -- within 1.2 times either way (2.5 to 3.6 : 1) free, 2% of ball speed lost at 1.6 times (1.9 or 4.8 : 1), 4% at most |
| main.js `PAD_LINGER` | how long the swing pad stays after a shot before it shuts: 1000 ms |
| `PAD`, `padSize` | the swing pad's size: 40% of the screen's height (220 to 420 px), a full pull of (height - 36) / 1.82, 1.5 full pulls wide |
| swing-meter.js `SPIN_DOT` | the spin ball, and so the draw and fade: `more` (+30% spin at the bottom), `less` (−25% at the top), `axis` (10° of spin axis at the edge: left a draw, right a fade), `zone` (0.85 narrowing per third down / half across) |
| `STROKE.tempo`, `tempoShort`, `tempoPad` | the ideal push: 250 ms for a full pull, 60% of that for a tiny one; 150 ms for a controller's stick |
| main.js `STICK_*` | the right stick as a thumb: starts past 0.25 down, a full deflection (0.95) is the end of overswing, the strike line 0.3 up from the middle, full deflection up is 0.65 of a full pull of follow-through, back in the middle 300 ms is no stroke |
| `STROKE_LAYERS` | per difficulty: whether tempo and the backswing's 3 : 1 are judged, the tempo window (`tempoZone`, `tempoPerfect`), how much the aim line leans (`lean`), whether yards and the blue stop show while pulling |
| `strokeEffect` tempo | rushed: left, 1.2° lower launch and up to 2% hotter per zone width; lazy: right and 3% less ball speed per zone width; overswing narrows the window to half at its end |
| `STROKE.leanPerDegree`, `leanMax` | the aim line's lean per degree of side slope (1.5) and its most (15°) |

## How to ask for a change

Naming the outcome is enough; the knob follows from it. Useful shapes:

- *"on a firm green the first hop should be higher and go further"*
- *"ordinary shots should hold a soft green better"*
- *"a ripped wedge should come back further than it does, but only on firm"*
- *"the driver should run out more on a fairway"*
- *"a 20 ft putt should need less speed"*

Worth knowing: some things **cannot both be had**, and it is better to hear it
than to have one quietly traded for the other.

- **Spin decides when a ball stops sliding, not how fast it is then going.** On
  hard ground a ball that lands with a given speed and spin ends up rolling at
  the same speed however the friction is set. Only the turf giving way (`tilt`,
  `dig`, `arm`) changes where it finishes. So "more friction" does not mean
  "stops sooner".
- **A green cannot both hold a 5 iron and let a wedge come back a long way.**
  What holds the 5 iron (a deep pitch mark) also swallows the wedge. Soft greens
  stop everything near its mark; the long come-backs are on firm, fast ones.
- **Putt speed.** Fairway models the skid, so a 10 ft putt on Stimp 10 needs
  5.3 mph; GSPro needs 4.1. Making Fairway match it means removing the skid
  (docs/BALL_PHYSICS.md, *The putt speed question*), which every laboratory
  measurement says is there.
