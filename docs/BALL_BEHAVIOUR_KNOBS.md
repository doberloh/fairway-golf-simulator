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
against 142 real-world targets in about a second and names the source of each.
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
| `pinE`, `pinMu` | the flagstick's give and grip. Raise `pinMu` and a ball rolling into the stick climbs it and pops back out |
| `dt` | the cup's time step. Not a tuning knob |
| `FLAGSTICK_HOLE_R` (`src/physics.js`) | the stick's size inside the hole. At the drawn inch nothing can be holed with it in |

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

How a keyboard, mouse, touch or controller golfer strikes the ball (since 14
October 2026; it replaced the power slider, the per-shot shape sliders and the
ball-flight profile). It decides only the five launch numbers; nothing after
impact. Every number here is **placed**, chosen by feel, and RESEARCH.md *The
Swing Meter* says so.

| Knob | What it changes |
|---|---|
| `DIFFICULTIES` | per golfer: how fast the marker runs (`rise`, seconds from start to full), the strike zone and perfect band half-widths, and whether the target allows for the wind (`wind`, Easy only) |
| `OVERSWING`, `OVERSWING_CARRY`, `OVERSWING_SLOW` | how far past full the bar runs, what that is worth (+5% carry, the only way past the bag), and how slowly the marker crawls through it (a quarter speed) before holding at its end for the tap |
| `strikeZone` | what narrows the zone: rough (×0.8), sand (×0.7), each step of added spin (×0.85), Flop (×0.8), overswing (down to half); under 40% of the bar it widens (×1.5) |
| `strikeEffect` | what a miss does: at the zone's edge 1.25° off line and 5° of spin axis, growing to four times that. **Early is right, late is left**, for everyone |
| `CURVE_AXIS` | Draw and Fade: ±8° of spin axis, with the start line turned the other way by as much as it bends (`curveCompensation`) so it lands on the aim line |
| `shapedLaunch` heights | Low −4°, High +4° launch; near the green a wedge's Bump & run is 55% of its launch on half its spin, Flop +10° |
| `SPIN_SCALE` | the spin setting (X, the Spin box): −1 is 75% of the club's spin, +1 to +3 add a tenth each |
| `HEIGHT_SPIN`, `KIND_SPIN` | **the guard that a ball with no spin added never comes back**: High and Flop carry less of the club's spin (85% and 68%), and the four wedges carry 85% to 90% on the meter. Found by sweeping every short club, height and power on soft, medium and firm greens from Stimp 8 to 13, level and into a 2% rise, against the ball model of 11 November 2026; `tests/swing-meter.test.mjs` holds it |
| `LIE_SPEED` | **the lie, for every golfer**: semi-rough keeps 96% of ball speed, rough 90%, sand 80% (72% until 14 October 2026). A launch monitor's measured speed takes the same share unless the round switches it off (`monitorLie`) |
| `RUN_UP` | the marker starts at the bar's left edge and runs this far (the miss area, 0.3 bar lengths) to the strike line; taps before it are ignored |
| `SWING_RANGES`, `swingZoom` | a short full shot's bar: half or quarter of the club's full carry, the shortest that holds the circle with a quarter to spare; `startSwing`'s `zoom` runs a half bar 12% and a quarter bar 25% slower (putts too) |
| `PUTT_RANGES` | how far the putting bar reaches: a quarter of the putter's roll up to six times it, so a putt can cross any green at any Stimp; `puttSpeedFor`'s cap (3x the putter's speed) has to allow the longest |
| `targetShare` | the blue target marker: the circle's distance through `playsLike` (slope and air always, wind only where the difficulty's `wind` is true -- Easy), then the bar share for that carry with the lie's lost speed made up |

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
