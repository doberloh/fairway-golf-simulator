# The ball

How a golf ball flies, lands, bounces, rolls and drops in Fairway, what each
part is built on, and what it was measured against. Written 11 November 2026,
when the whole model was rebuilt (branch `ball-physics-rework`). Everything
about the ball in older documents describes the model this replaced.

**To change how the ball behaves, start at docs/BALL_BEHAVIOUR_KNOBS.md**: it
says which number moves which behaviour. This document says why the numbers are
what they are.

**To check a change, run `node tools/ball-bench.mjs`.** It scores the ball
against 145 real-world targets and names the source of each. It takes about a
second.

A number marked **PLACED** is a judgement, not a measurement: nobody has
published it. A number marked **FITTED** was found by a tool against the data
named beside it.

## The short version

| Part | File | What it is | Held to |
| --- | --- | --- | --- |
| The air | `src/aero.js` | Drag, lift from spin, spin dying away, air density, wind that is slower near the ground | TrackMan's normalised 6 iron in calm and wind, its 60-row driver chart, the 2023 tour averages, the owner's GC3 and R50 sessions, the USGA's worked example |
| The ground | `src/turf.js` | One row of numbers per surface, moved by the three course conditions | below |
| The bounce | `src/bounce.js` | One impact: the pitch mark, the rebound, the turf's grip on the spin | USGA and R&A launcher tests on a championship green (57 balls) |
| Rolling | `src/turf.js`, `src/physics.js` | Skid, then roll, on real slopes | The Stimpmeter; a TrackMan-measured putt; architects' slope charts; AimPoint's break charts |
| The hole | `src/cup.js` | A rigid ball meeting the rim, wall, floor and flagstick | Holmes's capture tests; Cal Poly's and Molinari's flagstick tests |
| A whole shot | `src/physics.js` | `simulateShot`: all of the above, plus trees, houses, water and the boundary | every test that plays a shot |

## The three course conditions

A player sets three things, and only three (`turf.js`, `turfConfig`):

- **Green speed**, the Stimpmeter reading, 6 to 15 ft. Decides how far a ball
  rolls on a green and nothing else.
- **Green firmness**: soft, medium or firm. Decides what a ball does when it
  lands on a green or its collar.
- **Fairway firmness**: soft, medium or firm. The same for tees, fairways,
  semi-rough and rough.

Three presets set all three at once (`CONDITION_PRESETS`): **Everyday course**
(Stimp 8.5, soft greens, medium fairways), **Club course** (10, medium, medium,
the default) and **Tournament** (12, firm, firm). The values are PLACED, on the
USGA's guide for ordinary play (slow 8, medium 10, fast 12 ft).

They are asked in the rules step when a round is set up and can be changed
during a round (Golfers & rules, or Settings, Turf). Inside the code firmness is
a number from -1 (soft) to +1 (firm), so the range's lab can set anything
between.

**What firm, medium and soft mean.** FIRM is a measured thing: the USGA's
championship-green launcher tests (below). SOFT and MEDIUM are PLACED from the
R&A's 2008 launcher tests on six British greens, where the same 5 iron ran
anything from 0 to 14 yd and a sand wedge from -1 to +3, and from Haake's
finding that soft greens stop a ball in one bite whatever its spin.

**Soft does not mean more spin-back.** Haake's 721 impacts on 16 greens found
two kinds of green. On soft, wet ones the ball loses all its backspin in the
first bounce, leaves slowly and steeply, and stops near its mark: spin hardly
changes where it finishes. On firm, sandy ones the ball skids through the first
bounce, keeps backspin, and checks or comes back on the second. The longest
come-backs are on firm, fast greens.

Older saves and challenge codes carried one firmness and three roll
percentages. `turfConfig` reads them: Burnt and Firm become firm, Normal
medium, Soft soft; a fairway roll of 125% or more becomes firm, 80% or less soft.

## The air

A ball in flight feels gravity, drag against its motion, and lift at right
angles to it from its spin. Both depend on two numbers the ball carries: the
**spin ratio** S (how fast its surface is moving compared with its speed
through the air) and the **Reynolds number** (speed times size over the air's
stickiness).

- **Lift** rises steeply with spin ratio and then flattens:
  `CL = liftMax x S / (S + liftHalf)`. No spin, no lift, with no extra rule.
- **Drag** is a floor plus a part that grows with spin ratio, slowly at a
  drive's low ratio, quickly through an iron's, flattening at a wedge's:
  `CD = dragBase + dragRise x S^2 / (S^2 + dragHalf^2)`. A slow ball (a chip,
  the end of a high wedge) is below the dimples' critical Reynolds number and
  drags more (`dragLow`).
- **Spin dies away** at a rate proportional to airspeed and air density
  (`spinTau`: 21.5 s to fall to 37% at 100 mph). Smits and Smith measured
  23.8 s and Tavares 18.9 s. A drive lands with about three quarters of its spin.
- **The spin axis stays fixed in space** while the ball flies, as a gyroscope's does.
- **Wind** is the speed 20 m up and falls off toward the ground as height to
  the power 0.16 (open, mown country), flat below half a metre. The profile's
  shape is PLACED (the usual one for open terrain); the 20 m is chosen so that
  a stated wind does to a 6 iron what TrackMan's table says a wind of that
  speed does (10 and 20 mph headwinds: -18 and -41 yd; here -18.0 and -41.8).
  A chip feels a little over half the wind a high iron does at its peak.

FITTED 11 November 2026 with `tools/flight-fit.mjs`:

| Source | What it is | Carry, typical miss |
| --- | --- | --- |
| TrackMan's normalised 6 iron (130 mph, 14.7 deg, 6,088 rpm, 77 F, sea level), calm and in 10 and 20 mph head and tail winds | model output with stated air and stated wind: the best target there is | 0.6% (peak height 0.4%, landing angle 0.4 deg, wind effect within 1 yd) |
| TrackMan's driver optimizer chart, 60 rows | model output | 1.3% (average 0.1%) |
| TrackMan's 2023 tour averages, 23 clubs | measured, but raw: weather and altitude not removed | 2.3% |
| The owner's GC3 session, 111 shots | Foresight's model | 1.7% |
| The owner's R50 session, 115 shots | Garmin's model, air stated | 2.3% |
| USGA's worked example (160 mph, 10 deg, 2,520 rpm, 75 F: 257.6 yd in 6.39 s) | the only published flight time | 259.2 yd in 6.29 s |

The constants were not fitted to a wind tunnel and came out on one: at a
drive's speed and spin they give CD 0.219 and CL 0.153, where Acushnet measured
0.222 and 0.152 on a production ball (US patent 6,913,550).

What the old model got wrong: a straight-line drag, fitted to irons, left every
drive 5% short (a tour drive carried 262 yd against TrackMan's 275) and landed
long clubs 3 to 7 degrees too flat. Landing angle is the single most sensitive
input to how far a ball then runs.

**Still open.** The tour table's long irons land 3 to 5 degrees steeper than
this model (and than TrackMan's own normalised 6 iron, which it matches). The
tour table is raw; the normalised row was followed. No published coefficients
exist above a spin ratio of 0.3 (a full wedge is at 0.45), so the wedge end
rests on the trajectories alone.

## The bounce

One impact, three things (`bounce.js`):

1. **The pitch mark.** The ball digs in and pushes against the front wall of
   the mark it is making, so the surface it bounces off is tilted back toward
   where it came from (Penner 2002, after Haake). This is what turns a drive's
   forward speed into a first bounce over a metre high: a flat surface with the
   same restitution gives 30 cm. The tilt grows with the speed into the ground
   (to the power 0.7, FITTED: in proportion fits the measured first bounce a
   little better, but runs a pitch too far and takes the later bounces out of a
   drive) and with how glancing the arrival is, is nothing
   for a ball dropped straight down, and fades out for a ball skimming in
   almost flat (or a rolling ball would be kicked into the air at every touch).
2. **The rebound.** Restitution along that tilted face falls from about a half
   for a gentle hop to about an eighth for a full shot, because a hard landing
   spends its energy making the mark (Penner 2001 on a lawn; Haake's drop tests
   on greens agree: 0.23 at 10 m/s). That is why a ball bounces three or four
   times, each bounce a larger share of the last.
3. **The grip on the spin.** Friction acts on the point of the ball touching
   the ground, against the way that point is sliding. With backspin that point
   is moving FORWARD faster than the ball, so friction slows the ball and takes
   off backspin together. Two limits apply and the smaller wins:
   - `mu` times how hard the ball is pressed in (ordinary friction), and
   - `shear`, the most the turf can hold a ball back before it tears. Turf is
     strong against a ball coming down on it and weak sideways (Haake). This is
     why the USGA measured the SAME 4,690 rpm taken off every full shot
     whatever its speed and angle; ordinary friction would take more off a
     harder landing.

   If the limit is enough to stop the sliding, the ball **grips**: it leaves
   rolling off the tilted face with all its backspin spent, and with a lot of
   spin and a steep arrival that sends it backwards. If not, it **skids**: it
   keeps some backspin, hops forward, and the next, gentler bounce grips. That
   is the hop and check. Which happens is not chosen anywhere.

Two smaller things: turf pushes back a little ahead of the ball's centre, so
friction turns the ball slightly less than a hard floor's would (`arm`; Haake's
film shows 2 to 5 mm), which is what brings a spun wedge back on a firm green;
and long grass, sand and the pitch mark of a hard landing swallow a share of
the ball's travel beyond friction (`grab`, `dig`).

**Firmness only counts when there is a pitch mark.** A full shot craters a soft
green and barely marks a firm one; a chip marks neither. So a soft or medium
surface is played as its firm self plus a share of the difference that grows
with how hard the ball arrives (`SEVERITY`). Without this, chips on a medium
green stopped far too soon.

**Spin about the vertical is left out of the bounce.** A draw's or fade's
tilted spin axis is partly a ball turning like a top. It twists on the spot and
drives the ball nowhere; only the tilted pitch-mark face would make it kick
sideways, and that face is a stand-in, not a wall. PLACED.

### What the firm green was fitted to

The USGA and R&A fired 57 balls from a launcher at a green built to USGA spec
and dried, cut and rolled to championship firmness, Stimp 10 to 11 ("Second
Report on the Study of Spin Generation", 2007, section 6.8): 66, 75 and 85 ft/s,
30 to 55 degrees, about 2,000 to 12,000 rpm. Their regressions (angle in
degrees below horizontal, spin in rpm):

    rebound speed (ft/s)      = 70.65 - 1.02 x angle             R2 0.92
    rebound angle (deg)       = 1.48 x angle - 27.08             R2 0.84
    rebound backspin (rpm)    = spin - 4690                      R2 0.97
    first bounce (ft)         = 72.3 - 1.2 x angle               R2 0.91
    total bounce and roll (ft) = 246 - 3.54 x angle - 0.0065 x spin   R2 0.90

The model's firm green, over 54 landings spanning that range, on average:
rebound speed 0.2 ft/s high, angle 0.8 degrees low, spin taken off within 30
rpm, first bounce exact, total run 5 ft long. Shot by shot the typical miss is
3 ft/s, 5 degrees, 4.5 ft of first bounce and 13 ft of total run, which is
about the regressions' own scatter. So on that green a degree steeper is
worth 3.5 ft less run, the same as 545 rpm more spin; a ball finishes level with
its pitch mark at 52 degrees with 9,500 rpm; and nothing under about 4,700 rpm
comes back at all.

### What the other surfaces rest on

| Surface | Rests on | Kind |
| --- | --- | --- |
| Medium and soft greens | R&A 2008 (5 iron 0 to 14 yd, sand wedge -1 to +3 yd across six greens); Haake's soft-green runs of 1.3 to 2.5 m for a 5 iron whatever its spin | PLACED |
| Fairway, firm | Tour drives that found the fairway, 2007: 30.1 +/- 3.5 yd of run (USGA, 19 venues) | fitted to it |
| Fairway, medium | USGA 2018 launcher tests on four everyday fairways: 17.8 +/- 13.3 yd; first bounce about a metre high, 3 to 9 yd long (R&A 2008) | fitted to it |
| Fairway, soft | One irrigation cycle cost 7.7 yd, over 12 yd for a shallow landing (USGA 2018) | PLACED from it |
| Fairway and tee rolling | A Stimpmeter rolled 5 ft 8 in on a 0.4 in fairway and 3 ft 4 in on a dense tee (USGA 2018) | measured |
| Semi-rough, rough, sand, the wild ground types | Nothing measured exists for a ball LANDING in rough or sand | PLACED, ordered by how much grass or sand there is |

### Chips

TrackMan's "Chip Shot Code" (about 6,000 chips) measured launch and spin by
loft; its roll figures are the author's estimates. With a 10 yd carry on a
medium green at Stimp 10 the model rolls a 7 iron 4.9 times its carry (TrackMan:
more than 3.5), a pitching wedge 2.5 (2.5), a gap wedge 1.4 (1.5) and a sand
wedge 0.7 (1 or less). On a firm green at Stimp 12.5: 6.1, 3.2, 1.9 and 0.9.

## Rolling

A **Stimpmeter** releases a ball already rolling at 1.83 m/s and the reading is
how far it runs on the level. That fixes the green's average deceleration and
nothing else. A released ball in the game runs the reading exactly.

**A putt does not start out rolling.** It leaves the face sliding, and the
green spins it up to a roll, which costs about two sevenths of its speed and
10 to 20% of its length (Perry, Brouillette, Pope, Cochran and Stobbs; Quintic:
"up to 30%"). Launch monitors report the speed before that loss.

**Rolling resistance rises gently with speed** (`ROLL`: deceleration goes as
speed to the power 0.42 above 0.5 m/s, flat below, scaled so a Stimpmeter
release still runs exactly the reading). FITTED to one real long putt and
supported by three other things:

- TrackMan measured a 12.1 mph putt that skidded 70 in and ran 38 ft 10 in. A
  flat deceleration needs a Stimp 7.5 green for that; the model at Stimp 10
  runs 38 ft 11 in with a 68 in skid.
- Ping's overhead-camera study (Burritt and Henrikson 2024) measured friction
  falling as the ball slowed on three surfaces of four.
- Quintic's last foot of roll: a ball at 1 mph runs 12 in on Stimp 9.5, where a
  flat deceleration gives 7.
- The USGA's championship-green run-outs are shorter than a flat deceleration allows.

The flat part below 0.5 m/s is what lets a ball stop on a slope at all. It puts
the steepest slope a ball will rest on at 6.9%, 5.5% and 4.5% for Stimp 8, 10
and 12, where the architects' chart (Lemons, USGA Green Section Record 2008)
has 7.0, 5.8 and 4.9. That was not fitted.

Slope acts on a rolling ball with five sevenths of gravity. The model's break
agrees with AimPoint's published charts to within about 15% with no constant
fitted to them.

The speed law is for mown turf only (greens, collars, fairways, tees). Long
grass, sand and bare ground slow a ball the same at any speed and hold one on a
far steeper bank.

### The putt speed question

Simulators disagree here by 30%, and the owner should know which side Fairway
is on. On Stimp 10, a 10 ft putt:

- needs **5.3 mph** in Fairway and in TGC 2019, which model the skid;
- needs **4.1 mph** in GSPro, which treats the monitor's ball speed as if the
  ball were already rolling at short range.

4.1 mph is the Stimpmeter's own release speed, not a measurement of a struck
putt. The lab evidence is all on the skid's side, so it was followed. If putts
feel short against another simulator, this is why.

| Level putt | Stimp 8 | Stimp 10 | Stimp 12 |
| --- | --- | --- | --- |
| 5 ft | 4.0 mph | 3.5 | 3.2 |
| 10 ft | 6.0 | 5.3 | 4.8 |
| 20 ft | 9.1 | 8.1 | 7.3 |
| 30 ft | 11.6 | 10.3 | 9.4 |
| 40 ft | 13.8 | 12.3 | 11.2 |
| 60 ft | 17.6 | 15.7 | 14.3 |

## The hole

Nothing in `cup.js` decides whether a putt drops. There is no capture speed,
no lip-out rule and no scripted fall. Once a ball reaches the hole it is stepped
4,000 times a second as a rigid sphere under gravity; wherever it overlaps the
green, the sharp rim, the cylinder below it, the floor or the flagstick, it is
pushed out and given the impulse a collision gives. A slow putt topples over the
front edge and drops; a firm one crosses the opening falling, meets the back
wall below its equator and stays in, or meets the back rim above it and hops
out; one that catches the side rides the rim and falls or horseshoes.

What comes out, against what is published:

| | Model | Published |
| --- | --- | --- |
| Fastest centred putt caught | 1.77 m/s | 1.63 with no rim bounce, up to 1.97 with a lively one (Holmes 1991); Cal Poly holed every centred putt at 8 ft past and almost none at 9 to 12 ft past |
| A quarter of the way to the edge | 1.56 | 1.53 (Penner's fit of Holmes) |
| Half way | 1.22 | 1.22 |
| Three quarters | 0.71 | 0.71 |
| 5 degrees uphill against downhill | 1.10 times | 1.10 (Penner) |

The rim's own bounce (`CUP.rimE`, 0.10) is the one number chosen to put the
centred limit there; Holmes notes a narrow rim bounces less than turf does.

**A hard hit inside the cup is dead.** The rim, wall and floor bounce a putt
rattling in at walking pace; a ball that flies into the hole off a full shot
arrives at ten times the speed, and by 9 m/s into a surface the bounce is down
to almost nothing (`hardE`, `hardSpeed`, PLACED), as a green's is under a hard
landing. Without it a slam dunk came back out of the cup a metre high, which
the owner saw in the first picture taken of the new ball. A wedge, a 7 iron or
a pitch flown into the hole now stays in.

**The flagstick** gives and is smooth (`pinE` 0.10, `pinMu` 0.10, PLACED to
match the tests): a square hit all but stops the ball, so a centred putt drops
at up to 3.6 m/s with the stick in, while one glancing it 15 to 25 mm off centre
is knocked out slightly more often than with it out. That is what Mase (Cal
Poly, 2019) and Molinari found.

**Inside the hole the stick is half an inch across**, its real size
(`FLAGSTICK_HOLE_R`). It is DRAWN an inch across at the green, the owner's call
of 15 October 2026 for visibility, which leaves 41.3 mm beside it for a 42.7 mm
ball: nothing could ever be holed with it in.

## What a whole shot does (`simulateShot`)

In the air it is integrated at 240 steps a second (midpoint), the same at any
frame rate. At each touchdown `bounce` is called. When a bounce comes back off
the ground slower than 0.3 m/s (a hop 5 mm high, Penner's own switch) the ball
is on the ground and slides or rolls from there. A ball whose path crosses the
hole is handed to `cupSim` and handed back when it leaves or rests. Trees,
rocks, poles and standing flagsticks are vertical cylinders; houses, club
buildings, walls and bridge decks are boxes.

A ball that lands with backspin left and stops still has that spin, and the
ground then drags it backwards: that is how a ball comes back. A ball that
stops over the hole falls in.

The result now also carries `landingSpin` (rpm at first touchdown) and
`bounces`.

## Things the model does not do

- **Grain.** Putting with or against the grain moves a Stimpmeter roll by
  24 to 30 in (Penn State). No published directional model exists.
- **Wet, dew, time of day.** The three conditions are the player's to set.
- **Plugging.** A ball does not bury in a soft green or a bunker; it stops in
  or just past its mark.
- **Sideways kick from side spin** (above).
- **Different balls.** Haake found ball construction makes no difference to
  the turf; cover material moved a wedge's finish by half a yard (R&A 2008).

## Tools

| Tool | What it does |
| --- | --- |
| `node tools/ball-bench.mjs` | The ball against 145 real-world targets, by section, each naming its source. `--only greens,cup`, `--json`, `--set green.mu=.5,.3,.2` to try a constant without writing it, `--shot 120,16.3,7097` or `--land 22,51,9100` for one shot hop by hop on each firmness. Exits 1 on any failure. |
| `node tools/flight-fit.mjs` | The air model against the published flights and the owner's private sessions (`docs/sources/private/`, not in the repository). `--fit` searches for better constants and prints them. |
| `tools/flight-targets.mjs` | The published flights, as data. |
| `node tools/ball-paths.mjs [--against other/src/physics.js] > paths.html` | Side-on pictures (SVG) of what a ball does from its pitch mark to rest, this ball against another checkout's when asked: a drive on a fairway, a 7 iron, a spun wedge, a chip. Processor only. |
| `tests/ball-bench.test.mjs` | Runs the bench inside `npm test`, one test per section. |
| `tests/aero.test.mjs`, `bounce.test.mjs`, `turf.test.mjs`, `cup.test.mjs` | The rules each part must keep whatever its numbers are: a bounce never adds energy, firmer never bounces lower, a release runs exactly its Stimp, the hole never speeds a ball up. |

## Sources

Read for this model, with what was taken. The four research reports written on
10 and 11 November 2026 (local, `docs/studies/ball-physics/`) hold the full
tables, the pages that could not be fetched, and the sources read and not used.

**The air**
- TrackMan, tour averages and the normalised 6-iron tables:
  https://www.trackman.com/blog/golf/introducing-updated-tour-averages ,
  https://www.trackman.com/blog/golf/normalization-feature-explained . The tour
  table's own footnote: weather and altitude are not removed.
- TrackMan, driver optimizer charts (2010):
  https://wishongolf.com/wp-content/uploads/2012/07/TrackMan-Driver-Optimization_2010.pdf
- Acushnet, US patent 6,913,550 (measured drag and lift of a production ball):
  https://patents.google.com/patent/US6913550B2/en
- USGA, indoor test range model and worked example, US patent 6,186,002:
  https://patents.google.com/patent/US6186002
- Bearman and Harvey (1976); Smits and Smith (1994); Lyu, Kensrud, Smith and
  Tosaya, "Aerodynamics of golf balls in still air" (2018): the shapes of the
  curves. Lyu publishes no fitted coefficients. Smits and Smith's own fit runs
  about 40% high on drag at a drive's speed against measured modern balls and
  was not used.
- TrackMan on spin axis and curve: https://www.trackman.com/blog/golf/spin-axis
- Titleist on altitude (1.16% per 1,000 ft):
  https://www.titleist.com/teamtitleist/gb/b/weblog/posts/the-effect-of-altitude-on-golf-ball-performance

**The ground**
- A. R. Penner, "The run of a golf ball", Can. J. Phys. 80, 931 (2002):
  http://www.raypenner.com/golf-run.pdf . The tilted contact face. His tilt
  formula is fitted to ONE impact and grows with total speed; the Bristol data
  below fit a constant tilt slightly better, so the scaling here is different.
- A. R. Penner, Am. J. Phys. 69, 563 (2001): http://www.raypenner.com/golf-loft.pdf .
  Restitution against impact speed.
- S. J. Haake, PhD thesis, Aston (1989): https://publications.aston.ac.uk/id/eprint/15132 .
  721 impacts on 16 greens; two kinds of green; the shear weakness of turf.
- USGA and R&A, "Second Report on the Study of Spin Generation" (2007), section 6.8:
  https://www.jga.or.jp/jga/html/rules/image/info_groove_second_report_spin_generation_en.pdf
- R&A, "An Investigation into Ball-Turf Impact Characteristics" (2008); USGA and
  R&A, "Agronomic Impacts on Bounce and Roll Distance" (2018 launcher tests):
  both at assets.randa.org (full links in the local report 03).
- Biber, Champneys and Szalai, "Measurements and linearized models for golf ball
  bounce on a green", Sports Engineering 26, 50 (2023):
  https://link.springer.com/article/10.1007/s12283-023-00442-4 ; arXiv:2208.11685.
  1,023 bounces. Their fitted values (their Table 3) could not be read.
- TrackMan, "The Chip Shot Code": https://www.trackman.com/blog/golf/the-chip-shot-code
- Not obtained: Roh and Lee (2010); Cross, "Bounce of a golf ball on the green"
  (2025, paywalled), which re-analyses Haake's data and would be worth buying
  if a second model is ever wanted beside Penner's.

**Putting and the hole**
- B. W. Holmes, "Dialogue concerning the Stimpmeter", Phys. Teach. 24, 401
  (1986): https://doi.org/10.1119/1.2342065 . The 1.83 m/s release.
- B. W. Holmes, "Putting: how a golf ball and hole interact", Am. J. Phys. 59,
  129 (1991): https://doi.org/10.1119/1.16592
- A. R. Penner, "The physics of putting", Can. J. Phys. 80, 83 (2002).
- S. K. Perry (2002), https://doi.org/10.1119/1.1517882 ; M. Brouillette (2010),
  https://doi.org/10.1016/j.proeng.2010.04.136 ; Pope et al. (2014),
  https://doi.org/10.1016/j.proeng.2014.06.109 : the skid.
- Burritt and Henrikson, "Modeling golf ball roll with a variable coefficient
  of friction", Sports Engineering 27:39 (2024):
  https://doi.org/10.1007/s12283-024-00481-5 (abstract only).
- P. Hurrion (Quintic), https://www.paulhurrion.com/media/entering-the-drop-zone/
- The TrackMan-measured 12.1 mph putt: a GolfWRX post quoting TrackMan; the
  green's speed is not given, so Stimp 10 is assumed.
- Lemons' slope chart, in Bevard and Zontek, USGA Green Section Record, Jul/Aug
  2008, as read by Mangum: http://www.waddengolfacademy.com/putting/Geoff%20Mangeum%20Slope%20&%20Break.pdf
- The Brede correction: https://www.asianturfgrass.com/post/the-brede-equation/
- Flagstick: Mase (Cal Poly) with Golf Digest, 2019,
  https://www.australiangolfdigest.com.au/putting-with-the-flagstick-in-could-be-a-mistake-new-golf-digest-study-shows/ ;
  Molinari, https://clubhouse.swingu.com/tour/molinari-conducts-scientific-flagstick-in-putting-experiment

**Other simulators** (what players judge a ball model by)
- Pureplay Golf (Early Access 6 November 2026): https://pureplaygolf.com/ ;
  first look, https://golfsimulatorvideos.com/2026/10/pureplay-golf-simulator-software-first-look/ .
  Nothing is published about its model. The praise rests on five shots: a
  10,000 rpm wedge that comes back a little, a 1,700 rpm chip that bounces and
  rolls out, a mid-iron's release, a drive's run, a putt that matches the Stimp.
- GSPro 4.0, "Physics 2.1" (3 November 2026): https://gsprogolf.com/change-log.html .
  Cut its conditions to green firmness, fairway firmness and Stimp the same week.
- No product publishes a restitution, a friction or a spin-retention figure.
