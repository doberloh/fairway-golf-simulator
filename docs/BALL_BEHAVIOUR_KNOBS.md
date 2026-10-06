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

One row per surface: green, fringe, fairway, tee, semi, rough, sand.

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
| `spinScale` (`SPIN_SCRUB`) | `spin` | **firmer scrubs more spin off**; soft cushions and lets it survive |
| `PLOUGH_BY_FIRMNESS` | `plough` | flat across firmness on a green — see below |
| `gripScale` | `mu` | weak; friction takes spin and speed together and cannot express firmness cleanly |

**A SOFTER GREEN CHECKS HARDER.** A soft, receptive green grips a spinning ball
and stops it; a firm one is harder to hold because the ball bounces and runs.
That is why course setups FIRM greens to protect par, and it is the single thing
this model had backwards for a long time. The television backspin everyone
pictures happens on *receptive* greens, not the baked ones players complain they
cannot hold.

The mechanism is `spinScale`: a ball skids across hard tight turf and the surface
takes the spin off it, while a soft green closes round the ball and cushions the
contact so the spin survives to walk it home. **Backspin the ball still has when
it settles is the only thing that can bring it back.**

**Ploughing is flat across firmness on a green**, and the fit put it there rather
than being told to. A putting surface is tight, sand-based and shallow-marking;
how firm it is barely changes how far a ball sinks.

---

## Flight — `AERO` in `src/physics.js`

Fitted against measured tour carry and apex. One curve for every shot, keyed only
on the spin parameter. **No club ever enters it.**

| knob | effect |
|---|---|
| `liftGain`, `liftOffset`, `liftFloor` | how much lift spin generates → **carry and apex** |
| `liftCap` | ceiling on lift; binds on the highest-spin clubs |
| `liftTaper` | below this spin parameter (0.04) lift fades smoothly to zero, so a ball with no spin gets no lift. Touches only knuckleballs: the lowest-spin real shots seen are at 0.044 and up. Placed, not published |
| `spinDrag` | extra drag from spin → shortens high-spin shots |

Descent angle falls out of these; it is not set directly.

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
- **Dispersion.** Not modelled. The simulator never invents ball data.

---

## What each surface is anchored to

Not house numbers — measurements, each pointed at the surface the shot really
finishes on. This distinction cost four failed fits before it was spotted: the
published tour "total minus carry" figures are real fairway roll-outs for a
driver and meaningless for a wedge, because a wedge lands on a **green**.

| surface | fitted against | anchor |
|---|---|---|
| fairway | driver, 3 wood, 5 iron layup | published totals — 21 / 19 / 15 yd |
| green | 56 wedge, pitching wedge, 9 iron, 7 iron | tour backspin 15–20 **feet** max |

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

**Keyboard, touch and controller spin** is `spinForPower` in `clubs.js`: spin in
proportion to power for chips (the same spin per mph as the full shot), the square
root of power for pitches and full swings, blended between 30% and 70% power.
The square root alone gave a 10% wedge 337 rpm per mph and spun chips back behind
their marks. Anchored on Trackman: chips 1,500-3,000 rpm, a 50 yard wedge about
6,500.

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
