# What changes what

A plain-language map of every number we tune and which part of the ball's
behaviour it moves. Written so a request can name an OUTCOME and we both know
which knob it lands on.

The vocabulary used throughout:

- **carry** — where the ball first touches down.
- **first hop** — the bounce off the pitch mark. It has a *height* (how high) and
  a *distance* (how far forward before the second bounce).
- **release** (or run-out) — where it finishes, measured from the pitch mark.
  Positive is forward, negative means it came back past its own mark.
- **check** — the ball stopping short. **Zip-back** — the ball finishing behind
  its mark.

---

## The one rule that overrides everything

**A ball never leaves its FIRST bounce travelling backwards**, on any surface, at
any firmness. Ploughing and tilt can stop a ball; they cannot push it back, since
there is nothing behind it to push against. Reversal comes from backspin acting
on the hops and roll that follow. Enforced in `physics.js`; see the
`bounces === 0` floor.

---

## Per-surface contact table — `CONTACT` in `src/physics.js`

One row per surface: green, fringe, fairway, tee, semi, rough, sand -- and,
since the cartoon overhaul, one per ground type (rock, coral, scree,
hardpan, waste sand, pine straw, leaves, heather, native grass). **Those rows
are not edited here**: physics writes them from `src/grounds.js`, which holds
every number for each type in one place -- `contact` (this table's knobs,
with `ground` and `canopy` instead of `plough`), `roll` (the rolling
deceleration, m/s², against rough's 3.8; not scaled by the turf roll
sliders), `slide` (skid friction), `lie` (the share of ball speed kept),
`hop`, `relief`, `sound`, `killsSpin`. All PLACED; `tests/grounds.test.mjs`
holds the orderings (rock bounces hardest, heather deadest, hardpan runs, no
restitution over 0.24). To make a ball run further on hardpan, lower its
`roll`; to make rock kick less, lower its `cor`.

| knob | what it physically is | raise it and… | lower it and… |
|---|---|---|---|
| `cor` | restitution — how bouncy the surface is | **hop goes higher**, more bounces | hop dies, ball stays down |
| `tilt` | the ball climbing out of its own crater | hop gets **steeper and shorter**, more of the rebound turns backward | hop gets **flatter and longer** |
| `mu` | friction | **both** forward speed and backspin are stripped harder | ball keeps its pace **and** its spin |
| `plough` | turf ahead being shoved out of the way | forward speed killed **without** touching spin | ball runs on |
| `spin` | how much tangential impulse becomes spin change | backspin destroyed faster; ball reaches rolling and leaves with **topspin** | backspin survives the bounce |

**`plough` is the sum of two things**, and this is why ordering it used to
produce contradictions:

- `GROUND` — how far the ball sinks. About the soil. Firmest first: fairway/tee,
  semi, rough, fringe, green. A fairway is native soil; a green is a watered
  rootzone kept receptive.
- `CANOPY` — how much the grass grabs. About mowing height only. A green is
  shaved to nothing; rough is 50 mm deep.

The two orders genuinely disagree, and the ball feels the sum.

### Which one do I reach for?

- *"the hop is too high"* → `cor`
- *"the hop pops up instead of going forward"* → `tilt` down (costs height) or
  `plough` down (keeps height)
- *"it doesn't run out enough"* → `plough` down
- *"it won't come back"* → `mu` down or `spin` down, both of which keep backspin
- *"it comes back too easily on an ordinary shot"* → `spin` up

`mu` is the strongest single lever because it moves forward speed and spin
**together** — lower friction means the ball keeps its pace *and* the spin to
bring it home, which is why a firm green skips a ball forward and *then* rips it
back.

---

## Firmness — `src/firmness.js` and the `*_BY_FIRMNESS` tables

Firmness is a **greens measurement** (inches of penetration on a TruFirm or GS3)
and applies to **greens and their collars only**. Fairway, tee, semi and rough
ignore it entirely — use their roll percentages instead.

| knob | moves | effect across Soft → Burnt |
|---|---|---|
| `BOUNCE_BY_FIRMNESS` | `cor` | **hop height** grows with firmness |
| `SPIN_BY_FIRMNESS` | `spin` at the landing | **firmer takes more spin off**, so Soft spins back most and Burnt almost never. **This is the come-back dial** |
| `LANDING_SPIN.slowBounce` | `spin` on later bounces | below this impact speed (8.15 m/s into the turf) the transfer rises toward the rigid 2.5, so the small hops after a landing cannot turn spin into backward speed. Raise it and pitches start running; lower it and the come-back grows |
| `PLOUGH_BY_FIRMNESS` | `plough` | flat across firmness on a green — see below |
| `gripScale` | `mu` | weak; friction takes spin and speed together and cannot express firmness cleanly |

**A SOFTER GREEN CHECKS HARDER.** A soft, receptive green grips a spinning ball
and stops it; a firm one is harder to hold because the ball bounces and runs.
That is why course setups FIRM greens to protect par, and it is the single thing
this model had backwards for a long time. The television backspin everyone
pictures happens on *receptive* greens, not the baked ones players complain they
cannot hold.

The mechanism is `SPIN_BY_FIRMNESS`: a ball skids across hard tight turf and the surface
takes the spin off it, while a soft green closes round the ball and cushions the
contact so the spin survives to walk it home. **Backspin the ball still has when
it settles is the only thing that can bring it back.**

**Ploughing is flat across firmness on a green**, and the fit put it there rather
than being told to. A putting surface is tight, sand-based and shallow-marking;
how firm it is barely changes how far a ball sinks.

**How far a ball comes back, and the first hop** (13 October 2026; RESEARCH.md,
*Spin-back reined in*). Flat green, Stimp 10, a full wedge landing at 52 degrees:
8,500 rpm checks on every green; 10,000 starts (0.3 yd on Normal); 12,000 comes
back 4.4 / 3.2 / 1.4 / 0.5 yd from Soft to Burnt. A steeper landing comes back
sooner. The wedge hops about 2 ft on Normal and still goes forward first. To
move any of this, change the targets in `tools/green-fit.mjs` and refit: the
green's `cor`, `tilt`, `mu`, `spin`, `PLOUGH_BY_FIRMNESS`, `SPIN_BY_FIRMNESS`
and `slowBounce` are fitted together, and moving one by hand undoes the others.
**The trade inside it:** less come-back, a 7 iron that stops, and a forward first
hop pull against each other; the owner chose the hop, so a tour 7 iron runs
about 10 yd on a Normal green and a 50 yd pitch about 10.

---

## Flight — `AERO` in `src/physics.js`

Fitted against measured tour carry and apex. One curve for every shot, keyed only
on the spin parameter. **No club ever enters it.**

| knob | effect |
|---|---|
| `liftK`, `liftP`, `liftC` | how much lift spin generates (CL = liftK · S^liftP − liftC) → **carry and apex**. Fitted 6 October against Trackman, a GC3 and the owner's R50 |
| `liftCap` | ceiling on lift; binds on the highest-spin clubs |
| `liftTaper` | below this spin parameter (0.04) lift fades smoothly to zero, so a ball with no spin gets no lift. Touches only knuckleballs: the lowest-spin real shots seen are at 0.044 and up. Placed, not published |
| `spinDrag` | extra drag from spin → shortens high-spin shots |
| `dragBase`, `dragCrisis` | drag past the dimples' drag crisis, and the extra below it → how fast a ball slows, most of all slow, high wedges |
| `spinTau` | how fast the ball loses spin in flight: 21.5 s at 100 mph, quicker at higher speed, so a driver sheds spin faster than a wedge. **Feeds spin-back**: a slower decay delivers more spin to the green (fitted freely it tripled a tour wedge's spin-back on a Soft green), so it is held at the published rate |

Descent angle falls out of these; it is not set directly.

**The skip of a rolling ball is not a physics knob.** `src/roll-hop.js` lifts the drawn ball a few centimetres at random while it rolls (most on fairways, least on a green; the owner set the heights by eye on 6 October). Nothing in this file is affected by it: the simulation, where the ball stops and every readout ignore it. It ships switched off (`ROLL_HOP.enabled`).

---

## Roll-out — `src/turf.js`

| knob | effect |
|---|---|
| `stimp` | green rolling resistance. **Putting lives here** |
| `fairway` / `semi` / `rough` roll % | rolling resistance off the green (30–180%, lower = more resistance) |
| `ROLL_SPEED_GAIN` | how much resistance rises with speed. Flat below 1.83 m/s so putting is untouched; only fast approach roll-outs change |
| `SLIDE_FRICTION`, `SLIDE_BASE` | the skid before true rolling begins |

The Stimpmeter measures a ball released at **1.83 m/s**. Anything faster is
extrapolation, which is what `ROLL_SPEED_GAIN` exists to correct.

---

## Contact model — `src/contact.js`

| knob | effect |
|---|---|
| `SPIN_GAIN` | default spin transfer; the per-surface `spin` column overrides it |
| `normalDamping` | solved to hit a wanted restitution — not set by hand |
| `NORMAL_RATE`, `TANGENT_RATE` | **no effect on outcome.** The model is scale-invariant in these: stiffening the spring shortens the contact by the same factor. Contact *duration* cannot change a bounce |
| `wall`, `craterRelief` | crater asymmetry. Both inert — `wall` is ploughing in disguise, `craterRelief` only acts while the ball moves backward *during* contact, which never happens |

---

## Things that are NOT knobs

- **The club.** Nothing in the model knows which club was swung. Everything comes
  from the five launch-monitor numbers: ball speed, launch angle, launch
  direction, spin rate, spin axis. Direction and axis mean what the monitor
  means: positive starts the ball right and curves it right (a fade), negative
  left (a draw). Until 5 October the game flew both mirrored.
- **Contact duration.** See above — structurally cannot matter.
- **Dispersion.** Not modelled. The simulator never invents ball data. The
  Swing Meter's misses are the golfer's own timing, and the lie's ball-speed
  penalty on a monitor shot is a stated round rule shown beside the measured
  number, not a model of the strike (PROJECT_HANDOFF *The simulator never
  invents ball data*).

---

## What each surface is anchored to

Not house numbers — measurements, each pointed at the surface the shot really
finishes on. This distinction cost four failed fits before it was spotted: the
published tour "total minus carry" figures are real fairway roll-outs for a
driver and meaningless for a wedge, because a wedge lands on a **green**.

| surface | fitted against | anchor |
|---|---|---|
| fairway | driver, 3 wood, 5 iron layup | published totals — 21 / 19 / 15 yd |
| green | full wedge across spin and firmness, steep wedge, 7 iron, pitches, chips (`tools/green-fit.mjs`) | the owner's come-back table inside tour backspin 15–20 **feet** max; Haake's measured green bounce |

Since 13 October 2026 the green is fitted to the owner's come-back table, which
sits inside that 15-20 ft (12,000 rpm on Soft: 4.4 yd), and to the one measured
bounce on a real green (Haake: 18.6 m/s at 44.4 deg leaves at 2.78 m/s up, 4.28
forward), with `tools/green-fit.mjs`. **A green now bounces lower than a
fairway**: the fairway is fitted to measured tee turf, native soil, and a green
is a watered sand rootzone.

Other fixed points, none of them chosen by us:

- The first bounce goes **forward**; reversal begins at the **second**. Titleist
  slow-motion footage.
- A ball needs roughly **7,500 rpm** to hold a green at all.
- A full 56 degree wedge spins **8,500–10,500 rpm**. The 10,400 rpm 7 iron this
  model was previously tuned against is not a shot anybody hits.
- **Chipping** is checked against carry-to-roll ratios, and the published ones
  disagree by a factor of three: a pitching wedge is 1:3 (GolfWRX, Golf Sidekick),
  1:2 (Personal Golf Instruction) or 1:1 (Golf Distillery); a lob wedge 1:1, 1:0.5
  or about 1:0.3. The model's 1:1.9, 1:0.9 (56°) and 1:0.5 (60°) sit inside that
  spread for every club. It was once recorded as a defect against the 1:3 chart
  alone; it is not one, and nothing should be tuned toward any single chart
  (2 October, RESEARCH.md *After the ball lands*).

**Sanity check for any hand-written short-game input:** spin per mph of ball
speed. A full tour pitching wedge is **91 rpm per mph**, and a chip cannot exceed
its own club's full-swing figure -- the clubhead is barely moving. Trackman's chips
average 1,500-3,000 rpm over carries of 1.25 to 24 yards, which puts a lofted chip
nearer 100 rpm per mph than the 40-65 this file once called realistic; that band
was a judgement with no source and is withdrawn. Testing chips at 3,800 rpm once
produced 173 rpm per mph and made the model look badly wrong when the input was
the problem.

**A club's full-swing launch and spin** come from its kind, `CLUB_KINDS` in `clubs.js` (stock eight unchanged; eleven more placed between them on 12 October 2026 -- RESEARCH.md *The bag belongs to the player*). They change apex, descent and roll, never carry: the ball speed is solved to the carry the golfer typed.

**Keyboard, touch and controller spin** is `spinForPower` in `clubs.js`: spin in
proportion to power for chips (the same spin per mph as the full shot), the square
root of power for pitches and full swings, blended between 30% and 70% power.
The square root alone gave a 10% wedge 337 rpm per mph and spun chips back behind
their marks. Anchored on Trackman: chips 1,500-3,000 rpm, a 50 yard wedge about
6,500. Since 14 October 2026 "power" here is the Swing Meter's ball speed as a
share of the club's full-swing speed.

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
| `HEIGHT_SPIN`, `KIND_SPIN` | **the guard that a ball with no spin added never comes back**: High and Flop carry less of the club's spin, and the pitching and lob wedges carry 95% and 85% on the meter. Found by sweeping, not chosen; `tests/swing-meter.test.mjs` sweeps the corner where a come-back was ever found. Raising any of these can break that rule |
| `LIE_SPEED` | **the lie, for every golfer**: semi-rough keeps 96% of ball speed, rough 90%, sand 80% (72% until 14 October 2026). A launch monitor's measured speed takes the same share unless the round switches it off (`monitorLie`) |
| `RUN_UP` | the marker starts at the bar's left edge and runs this far (the miss area, 0.3 bar lengths) to the strike line; taps before it are ignored |
| `SWING_RANGES`, `swingZoom` | a short full shot's bar: half or quarter of the club's full carry, the shortest that holds the circle with a quarter to spare; `startSwing`'s `zoom` runs a half bar 12% and a quarter bar 25% slower (putts too) |
| `PUTT_RANGES` | how far the putting bar reaches: a quarter of the putter's roll up to six times it, so a putt can cross any green at any Stimp; `puttSpeedFor`'s cap (3x the putter's speed) has to allow the longest |
| `targetShare` | the blue target marker: the circle's distance through `playsLike` (slope and air always, wind only where the difficulty's `wind` is true -- Easy), then the bar share for that carry with the lie's lost speed made up |

**Sand takes the spin.** A ball landing in a bunker keeps no spin past that
contact (`physics.js`, after the bounce), so in sand only gravity moves it back.

**The cup wall grips no harder than the ball presses into it**: `WALL_FRICTION`,
the green's own sliding friction (0.305), times the press of going round. Raise it
and slow balls ride the inside of the cup longer (at the old unlimited grip, up to
three and a half laps); lower it and fast balls lose the grip to horseshoe out.
The lip EDGE above the wall follows the same rule (3 October): it grips at most
`WALL_FRICTION` times the ball's press on it, and the ball slides over the edge
when rolling would need more. Lip-outs ride up to about two thirds of a lap
(212 degrees at Stimp 10, 231 at 13), and that barely moves across a friction
of 0.3 to 0.7 -- what limits it is the instants the ball is barely pressing on
the lip. The full 360-degree lip-out it removed is the trade-off;
docs/reports/LIP_GRIP_REPORT.md.

## How to ask for a change

Naming the outcome is enough — the knob follows from it. Useful shapes:

- *"on a firm green the first hop should be higher and go further"*
- *"ordinary shots should hold a soft green better"*
- *"a ripped wedge should come back further than it does, but only on firm"*
- *"the driver should run out more on a fairway"*

Worth knowing: some pairs **cannot both be satisfied**, and it is better to hear
it than to have one quietly traded for the other. Two live examples —

- `plough` ordered by ground firmness alone makes rough run further than fairway;
  ordered by canopy alone makes a fairway softer than a green. Hence the split.
- Fitting a surface against ONE club looks excellent on that club and wrecks the
  rest. A green fitted to a 56 degree wedge alone left a 7 iron running 12.3 yd
  on it; a fairway fitted to the driver alone left the 5 iron six yards short.
  Every surface is fitted against every club that actually lands on it.
