# Research and implementation notes

Reviewed September 10, 2026; the claim below corrected 1 October and again 6 October. Research informs the model architecture, and the coefficients below are approximations. **The measured agreement claimed is the flight fitted to three launch monitors** -- Trackman's published PGA and LPGA tour averages, a 111-shot GC3 session and the owner's 115-shot R50 session -- with peak height within 1.7 to 5.5% and carry within 1.5 to 2.5% (typical miss) on each; see *The flight refitted against three launch monitors*. The website says "around 3%", which those figures support. Nothing is claimed beyond them: no commercial calibration, no agreement with any device not named here, and roll still has no reference data at all.

## Open research

- [OpenFairway](https://github.com/digitalhand/openfairway), MIT-licensed golf physics project. Its architecture combines Reynolds/spin-dependent aerodynamics, spin decay, ground interaction, and launch-monitor normalization. [Aerodynamics.cs](https://github.com/digitalhand/openfairway/blob/main/addons/openfairway/physics/Aerodynamics.cs) documents ball-flight coefficient bounds and air-density calculation. Fairway is an independent JavaScript implementation; it does not bundle or claim to port OpenFairway's current calibration curves.
- [McNally et al., Combining Physics and Deep Learning Models To Simulate the Flight of a Golf Ball (CVPR Workshops 2023)](https://openaccess.thecvf.com/content/CVPR2023W/CVSports/papers/McNally_Combining_Physics_and_Deep_Learning_Models_To_Simulate_the_Flight_CVPRW_2023_paper.pdf). The accessible abstract/search text identifies drag/lift coefficient prediction as a core challenge. Full paper download was unavailable during implementation; no fitted coefficients or neural model from it are used.
- [Biber et al., Measurements and linearized models for golf ball bounce (2023)](https://arxiv.org/abs/2302.02758). Experiments over more than 1,000 bounces across two turf types show that frictional rigid-body models, including a Penner modification, do not capture every regime. This supports treating turf/bounce response as an approximation needing calibration; the paper's fitted model is not implemented.
- [libgolf](https://github.com/gdifiore/libgolf), a GPL-3.0 open-source trajectory library with aerodynamic, terrain, bounce, and roll abstractions and a WebAssembly route. Inspected as an alternative architecture; no code is bundled or copied.

## Equations and assumptions

Sphere: mass 0.04593 kg, radius 0.021335 m; projected area πr²; gravity 9.80665 m/s². Air density uses a dry-air exponential barometric approximation with biome temperature and altitude. Dynamic viscosity is fixed at 1.81×10⁻⁵ kg/(m·s), a simplification.

Wind direction is course-wide: its vector is rotated into each hole’s local playing coordinates before simulation, so changing hole orientation does not rotate the actual breeze. Airborne visual debris follows that same world direction. Relative velocity u = v − wind; Reynolds number Re = ρ|u|2r/μ; spin parameter S = |ω|r/max(|u|, 0.1). The independently chosen smooth drag approximation is Cd = 0.225 + 0.22 / (1 + exp((Re − 65000)/9000)) + 0.12 min(S, 0.8). Lift approximation is Cl = clamp(−0.05 + sqrt(0.0025 + 0.36S), 0, 0.32). These are bounded engineering approximations, not fitted values extracted from the cited papers. The flight acceleration is gravity plus −½ρACd|u|u/m and ½ρACl|u|²/m along normalized ω×u. Spin decays exponentially with a 24 s time constant. Midpoint integration uses a 1/240 s step; rendering interpolates the camera independently.

Ground and rendering now share the same connected triangle mesh. Heights used by ball contact are barycentric interpolations on those exact triangles, eliminating the former overlapping terrain patches and owner-boundary discontinuities. Ground slopes use finite differences over that mesh. Cells near greens and bunkers now refine from 3 m to approximately 0.5 m spacing, with shared vertices and transition triangles connecting to coarse terrain. This improves smoothness without disconnected overlays; rendered and collision heights still agree.

Bounce uses a Coulomb tangential impulse limited by the normal impulse, with solid-sphere inertia I = 2mR²/5 and an angular impulse that changes spin. A Penner-style effective contact-plane tilt represents yielding turf in front of the impact. All three contact constants are a per-surface table ordered by mowing height — see *The bounce ladder* below — rather than three ternaries sharing one `else`. Restitution falls as the canopy shortens (0.168 green to 0.052 sand) while tilt and friction rise with it (0.296 to 0.494 rad, 0.40 to 0.70). Tilt still decreases with incident normal speed below 12 m/s. **One row of that table is fitted measured data and the rest are scaled from it**; see *Anchoring the bounce to measured turf* below. The model distinguishes sliding contact from rolling and updates spin, but omits the full compliant-contact differential equations and their lift-off transitions.

Rolling uses effective deceleration rather than confusing rolling resistance with sliding friction. The green default is Stimp 10: a = 1.83² / (2 × Stimp × 0.3048) m/s². A 1.83 m/s level release therefore rolls exactly the selected distance in feet, within integration tolerance. Default effective decelerations are 0.95 m/s² on fringe, 1.45 on fairway/tee, 2.35 on semi-rough, 3.8 in rough and 6.0 in sand. Those non-green values are adjustable simulator presets, not universal agronomic constants. Fairway, semi-rough and rough roll percentages scale resistance inversely. Slopes include the 5/7 solid-sphere rotational-inertia factor; a bounded resistance impulse prevents friction from reversing motion or causing numerical creeping at rest. The previous green value (0.022g) corresponded to approximately Stimp 25.5, explaining excessive roll.

A struck ball is not a released one. A Stimpmeter ramp delivers a ball that is already rolling — that is the point of the ramp, and it is why the deceleration it measures is pure rolling resistance. A putt leaves the face sliding, and the turf has to spin it up before the Stimp figure describes it at all. The two arrived at the simulator indistinguishable, both {vla:0, spin:0}, and the model treated every putt as a ramp release: measured roll distance matched the pure-rolling closed form at a ratio of 1.000 at every launch speed.

Sliding at mu, a ball with no initial spin reaches true roll at 5/7 of launch speed, having covered 12 v^2 / (49 mu g); the roll that follows covers 25 v^2 / (98 a). Both go as v^2, so total distance stays exactly quadratic in launch speed and only the constant moves — which is why the skid could be added without the power control changing shape. mu is set to 0.305, chosen so the skid is 15% of a putt on a Stimp 10 green, the share reported for real putts and measured by launch monitors as skid distance. It is an effective value: a real putter has loft and delivers a little backspin, and this reproduces the observed skid rather than the launch mechanics behind it. Slower greens skid proportionally more (22.7% at Stimp 6, 10.5% at Stimp 15), bracketing the 10–20% band reported for real putts.

Balls settling from a bounce take their contact velocity from the spin the bounce computed, so a ball landing with backspin checks and one with topspin runs. That spin was previously discarded at the moment it mattered most.

The skid does not increase break, which was the first guess and is wrong. Sliding is not held by the rolling constraint so gravity acts in full rather than at 5/7, but the skid sheds speed about five times faster than rolling and lasts far less time than its share of the distance. Break is a time integral, so the shorter clock wins: measured over a matched run a struck putt breaks about 1.5% less than a released one.

Sliding friction presets: 0.305 on green, 0.35 fringe, 0.42 fairway/tee, 0.55 semi-rough, 0.70 rough, 0.95 sand. Like the rolling values these are simulator presets, not agronomic measurements.

The aim preview runs the shot rather than describing it. A putt's line and its ring come from the same ground integration the ball will use — the same function, not a matching one — so the two cannot drift apart. What it replaced was a closed form that assumed a flat green of unlimited extent: correct for a flat straight putt and wrong for every other, and wrong in the direction that matters, since a downhill putt is exactly when knowing where it finishes is worth most. Measured on a 4% cross-slope the preview now lands within 0.05 m of the ball at every speed tested, shows the break as a curve rather than a straight bearing, and reports the surface it stops on. A putt from a tee that would have been promised 30 yd of green now correctly predicts 14 and says it is off the green.

Cost is 0.17 ms per preview, which is why it can run on every aim change; clicking a spot on the green solves for the power that stops there by bisection through the same preview, at 1.7 ms.

Slope is deliberately absent from the capture criterion, and the reason is worth recording because the obvious correction makes the model worse. A hole cut into a sloping green has its far rim lower than its near one by chord x theta for a ball running downhill, which suggests the ball must fall further and that downhill putts should need a lower capture speed. Half of that is true. The other half is that a ball rolling down a slope is already descending at v x theta when it leaves the near rim, so over the crossing time chord/v it falls exactly chord x theta of its own accord. The two terms cancel and the criterion collapses to (1/2)g t^2 >= r with no theta in it. Adding the lowered far rim without the head start — what you get reasoning from the visible geometry alone — introduces roughly a 20% slope error in the required drop at 4%.

Once the ball's centre drops below the level of the green it is rolling on the wall of the cup, and that is a classical problem with a closed form rather than an approximation. A sphere rolling without slipping inside a vertical cylinder does not fall: its centre circles at constant angular speed and its height oscillates harmonically, gravity setting the depth it settles about rather than causing a steady descent. Working the rolling constraint through, with z' = r u and w the spin about the outward normal, gives theta'' = 0, u' = -5g/7r - (2/7) theta' w, and w' = theta' u, so u'' + (2/7) theta'^2 u = 0. The vertical motion is simple harmonic at sqrt(2/7) of the rate the ball goes round, so one full cycle takes 2 pi / sqrt(2/7) = 11.76 radians of azimuth and a ball dropping in at the rim returns to that level after sweeping about 337 degrees.

The dive depth is 7g / (2 theta'^2), which exceeds the 102 mm cup for any tangential speed below about 0.67 m/s at the wall — but only if the ball arrives at the wall spinning the right way, and for a long time in this model it did not. A ball rolling forward carries spin -v/R about the outward radial axis, not +v/R; substituting the wrong sign into the ground rolling constraint makes the contact point move at 2v instead of standing still. In u' = -5g/7r - (2/7) theta' w that sign is the whole result. With it right, the spin term pushes the ball UP the wall — the same effect as topspin climbing a wall — and the ball circles and comes back out. With it wrong the term simply adds to gravity, and every ball that reached the wall drilled into the bottom of the cup.

A third sign sits alongside those two and decides which WAY round the cup the ball goes. `tangential` is measured along (-u_z, u_x), which is the opposite of the direction theta increases in, because the position is rho(sin, cos) and so dP/dtheta points along (cos, -sin). When the edge and wall handoffs were unified onto the edge's convention the wall was left on the old one, so a ball rode the lip one way and reversed the instant it took the wall, running round the cup against its own direction of travel. Flipping rate and spin together leaves their product alone, and that product is what appears in the equation above, so capture speed, the effective hole, ride length and energy were all unchanged — the model was wrong in a way no measurement could see and only a person watching could. It is now held by a test that sweeps the entry conditions and asserts no ride ever turns back on itself. Swept across every line and speed, the longest ride that still escapes is 396 degrees, a full lap; true horseshoes exist, the ball leaving at 179 degrees, straight back at the player; and a ride stays shallow enough to watch, because the height oscillation above keeps the top of the ball at or near green level rather than sinking it out of sight.

What the rim is made of decides how long a ride lasts, and for a while it was made of nothing. The liner sits at least 25.4 mm below the putting surface and a ball that is lipping has by definition fallen less than its own radius, 21.3 mm, so the surface a lipping ball runs on is always cut turf and never the liner. Turf's rolling resistance is measured rather than chosen: a Stimpmeter is exactly that measurement, giving mu = a/g = 0.056 on a Stimp 10 green. Resistance is mu times the load the contact carries, and on the green that load is the ball's weight, which is what makes a the number the Stimpmeter reads. Inside the cup it is not: a ball going round the wall at 0.7 m/s is pressed into it at v^2/rho = 15 m/s^2, better than one and a half g, and at 1.2 m/s it is four g. So drag on a rim ride grows as the SQUARE of how fast the ball is going round, and there is no constant in it that is not measured.

This replaced two invented numbers — a constant 7 rad/s^2 on the wall and 6 on the lip, with no source — and the rim was otherwise lossless in the direction the ball was travelling: the normal component of an arriving ball was absorbed completely, but nothing took anything off it once it was running round. The correction takes the longest ride that still comes back out from 926 degrees to 396. Two and a half laps of the cup is not a thing that happens; one lap is, and famously so. Three consequences follow that were not arranged:

- A faster green holds a longer ride: Stimp 8 gives 370 degrees, Stimp 10 383, Stimp 13 701. Lower mu, less scrubbing.
- The effective hole stopped being patchy. It had been possible to miss at 34 mm off line and hole at 43, because near the boundary a ball could ride round and escape where a wider one rode round and dropped. With the ride damped, the first miss and the widest make agree to within half a millimetre at every entry speed.
- Every ride that survives keeps the ball's centre above the lip, because a ride that sinks has already lost the speed it needed to keep going round. What is on screen is a ball running round the top of the hole rather than vanishing into it.

Dead-centre capture does not move: 1.757 m/s before and 1.759 after. That is the right behaviour rather than a failure of the correction — a ball through the middle carries almost no speed round the cup, so the load at its contact is just its own weight and the resistance is the green's ordinary one. The 8% by which this exceeds Penner's 1.63 is therefore not a dissipation question. It is a geometry one: the lip here is a perfectly sharp circular edge, where a real cut edge is turf and is rounded over. Rounding it would let a firm putt ride up and out more easily and bring the number down, but we have no measured edge radius to use, so it is left sharp and the gap is recorded rather than closed with a chosen number.

Two limitations are stated rather than tuned around. Below 25.4 mm the wall really is plastic liner, and with no measured rolling resistance for it turf's value is used all the way down, which makes a deep rattle shorter than the real thing — though a ball that deep is captured either way. And resistance is taken linear in load, where a Hertzian contact would be slightly sub-linear; linear is the standard engineering form and the honest first-order extension of a coefficient measured at one load.

The rim is resolved as a surface rather than as a pair of events, and getting that wrong is what hid the sign error for so long. Above lip height the cup presents a sharp circular edge, so the ball's centre is constrained to lie a ball radius from the rim CIRCLE — a torus, with alpha giving the position around the tube: 90 degrees is a ball resting on the green beside the hole, 180 degrees is the top of the wall. Below lip height the edge is behind the ball and the cylinder is what stops it, so the centre stays inside Rcup - r. The two agree exactly at lip height, so the surface is continuous and the crossing, the edge and the wall are one thing.

Splitting it the other way — one test for "has the centre reached Rcup" to catch the far lip and another for "is the centre below the green and past Rcup - r" to catch the wall — leaves a wedge between them that the ball flies straight through. A putt 50 mm out with its centre 2 mm above the lip is 4.6 mm from the rim circle, buried in the rim, and nothing engaged until 54 mm; it was then snapped onto the wall a step later, 21 mm backwards. The same gap made the effective hole narrower 24 mm off line than 48 mm off line, which is nonsense the moment it is said out loud. Reaching the other way and using the rim circle below lip height as well is equally wrong in the opposite direction: it parks the ball five millimetres inside the cup wall and the hole swallows everything, capture running to 6 m/s.

Rim height follows the green rather than sitting level at the pin. A cup is cut straight down into a sloping surface, so the lip follows the turf and the far side of a downhill putt is genuinely lower. That lowering is one half of the cancellation described above; modelling the rim as a flat circle at the pin's height throws it away and makes downhill and flat identical.

This whole treatment replaced a far rim modelled as a step the ball pivots over, with the speed loss v' = v (1 - 5 drop / 7 r) from angular momentum about the edge. That in turn had replaced an impulse treatment with restitution and Coulomb friction, which rebounded the ball backward off the edge at every ordinary putting speed. The step was a real improvement but it was still an invented event bolted to the side of the geometry, and the violent fifty-degree deflections it advertised went with it: resolved as a surface, a single contact turns the ball by at most about thirty degrees, and everything bigger than that is a ride.

Free fall alone is set to Penner's free-fall figure of 1.31 m/s dead centre — 1.63 covers every mechanism together, so letting free fall reach it would count the far wall twice.

Validation against measurement, recorded rather than tuned away. Dead centre, the cup catches a ball arriving at up to 1.757 m/s against Penner's published 1.63 — generous by about 8%, and honestly so: the rim here is a perfectly sharp, perfectly elastic edge, where a real lip is turf over a liner set an inch down and takes something off the ball. Hurrion & Sheppard measured the effective hole on a Stimp 10 green as about 4% smaller at 0.23 m/s entry and about 25% smaller at 0.65. This model narrows it 2% at 0.23, and at 0.65 the measured 25% now falls between the first miss at 35% and the widest make at 18% — the boundary is genuinely not a clean edge, because near it a ball can ride round and drop where a slightly straighter one rides round and escapes. The earlier model gave a flat 4% at 0.65 and had no such band at all. The capture envelope from ten feet, scanned rather than bisected because rim rides make the set of speeds that hole genuinely patchy, runs: dead centre holes anything finishing up to 9.3 ft past, half an inch off line 8.2 ft, an inch 5.5 ft, an inch and a half 2.7 ft, two inches 0.4 ft. That sequence is monotone in offset for the first time; the wedge described above used to make an inch off line harder than an inch and a half.

Measured against the simulator from 6% uphill to 6% downhill: the launch speed that holes swings 24%, from 2.993 to 2.409 m/s, while the speed the ball is doing as it reaches the cup stays between 1.721 and 1.770 m/s. Downhill putts are harder because the ball arrives faster, which the roll model already accounts for, and not because the hole becomes fussier. A regression test holds the arrival-speed boundary flat across that slope range so the cancellation cannot be broken by restoring one of its halves.

## The hole flyover

The flyover is the main menu's camera put over a hole in play: the same framing, at one and a half times its rate (0.075 → 0.1125 rad/s, a 55.9 s lap). It replaced a run up the fairway joined to a tight green orbit, which showed a hole a piece at a time and never its shape in the landscape.

Terrain clearance is solved once per hole rather than clamped per frame. Clamping per frame works and puts a corner in the path wherever the ground crosses it; instead the ring is measured up front at 96 samples, each taking the highest ground across its own arc **and** ten metres to either side of the flight line, then smoothed by passes that may only raise a value. The camera therefore rises to meet a ridge before it arrives and settles after it. Sampling points alone is not enough: at this radius the samples sit about ten metres apart, the ridge between two of them is higher than either, and clearance fell to 19.3 m on mountain terrain — under the 29 m trees this generator grows. With the span sampled and a 34 m clearance, measured across full mountain and full forest, the camera holds 34 m above ground and passes about 10 m over the tallest canopies.

## Greens and hole locations

**Superseded 30 September (GENERATOR_VERSION 33): see *Greens with a character each* below.** Until then a putting surface here was one recipe for every green: a TILT, which is mostly drainage and is ordinarily two or three per cent; crossing RIDGES, the spines and swales that break a green into sections; a DISH, which is a punchbowl if it gathers and a turtleback if it sheds, the latter being what the Pinehurst greens are known for; and a TIER, whose face is the steepest ground a green has. The ridges were rounded square waves rather than sines, because a green is shelves with faces between them and a ball has to be able to stop somewhere -- which was right about pinnable ground and is also what put a step on nearly every green.

The slider is deliberately not linear. Most greens sit in the gentle half of the range and the severe ones are outliers, so the curve keeps the bottom and middle where they already were and spends the change at the top. Measured across five seeds on a flat site, sampling the whole putting surface, before GENERATOR_VERSION 33: at the default of 35 the mean slope was 1.2% with 1.3 ft of relief; at 100 it was 5.3% mean, 10.2% at the 95th percentile, 18.5% at the steepest tier face, and 5.6 ft of relief (the figures since then are in *Greens with a character each*). USGA guidance puts ordinary putting surfaces at 2 to 4 per cent, so the default sits under that and the top of the slider sits well past it, which is the intent: the top is meant to be Augusta and Oakmont rather than a municipal course. The one number that keeps it a golf green and not a hillside is that 14% of a severe surface is still under 2.5% — there is always somewhere to cut a hole.

Hole locations move through the week. The cup is no longer the centre of the green; the green has a centre and the cup is a point on it, and the two are separated everywhere — routing, bunkering, the collision disc that packs corridors, the tree exclusion, the flyover orbit and the green-reading overlay all key off the green, while the physics, the flagstick and the cup mesh key off the pin. Anchoring any of those at the cup means recutting a hole location rebuilds the course, which is what happened: the routing disc was centred on the pin, so moving a pin moved the collision volume, moved the next hole and rerouted everything under it.

Difficulty is slope. The cup wants ground level enough to let a ball come to rest beside it, and on greens running Stimp 10 and above a ball will not sit still much past three per cent, which is where the caps come from. Measured on severe greens: Thursday cuts at 1.59%, Friday 2.03%, Saturday 2.54%, Sunday 3.11%, and no day anywhere cuts past 4%.

How much green is left between the cup and an edge is a safety MINIMUM and not a second difficulty dial. That is what the USGA figure is — several paces, four or five for championship play, less as the setup tightens — and scoring it as a target rather than a floor is a mistake with a very visible result: penalising a location for having too much room as well as too little pulled every cup on the course to within inches of the same distance from the edge, hole after hole, all of them about five paces in. One-sided, the same courses spread from three metres to eighteen, and a Sunday pin on a severe green does not need to be tucked at all because the ground under it is already doing the work. Three metres is the absolute floor on any day, on any green.

Locations are chosen by scoring every candidate in one pass rather than by filtering through a ladder of relaxations. The ladder reads as tidier and fails badly: on a severe green no location satisfies a Thursday setup, every stage rejects everything, and the cup lands wherever the last-resort sort left it — measured at three and a half per cent on a day that asked for under two. The weights state the priority outright: never put the cup where a ball cannot rest, then hit the day's slope, then the day's room.

Front, middle and back rotate hole by hole starting at the front, so a round works its way around the greens instead of playing the same location every time.

The ball has a 42.67 mm diameter and the cup a 107.95 mm (4.25 in) diameter. Two depths, and they are not the same number: `CUP_DEPTH` is **101.6 mm**, the four inches the USGA requires, and it is the floor a ball actually rests on — its centre settles a ball radius above it, at -80.3 mm. The rendered bore is drawn 115 mm deep so the inside of the cup reads as dark below the ball rather than ending at it. The capture animation previously dropped the ball to an invented 115 mm and is now anchored to `CUP_DEPTH` like everything else. The liner starts 25.4 mm below turf. Rendering and physics share dimensions, with no enlarged putting ball or raised turf offsets. The locator ring is hidden within 5 m of the cup.

Capture is decided by one rule: the ball is caught if it falls at least its own radius while its centre crosses the opening. With chord = 2sqrt(Rcup^2 - d^2) for an incoming line offset d from the middle, that is a maximum entry speed of chord x sqrt(g / 2r), which is 1.6365 m/s dead centre against Penner's published full-capture figure of 1.63 m/s — 0.8% from geometry alone, nothing fitted. Off centre the envelope therefore falls as sqrt(1 - (d/Rcup)^2).

This replaced an earlier envelope of 1.63 x (1 - (d/Rcup)^2): the right value dead centre attached to the wrong shape. The difference is large where it matters, allowing 0.98 m/s at 0.8 Rcup where the old form allowed 0.59, and the old form turned away balls that had already fallen two and a half ball radii below the rim.

A ball that falls less than a radius still fell, and has to climb back out over a rim that turns it. Exit speed goes smoothly to zero as the drop approaches a full radius and to the entry speed as it approaches nothing, so holing out, lipping out and racing across the top are three readings of one number rather than separate cases. Before this the hole did nothing at all to a ball it did not swallow: measured on a flat Stimp 10 green, crossings at 0.6, 0.8, 0.95 and 1.05 of the cup radius all finished 1.310 m past it, identically. The rim turn and its energy loss are a documented approximation, not a reproduction of the full rigid-body treatment.

Cup sources reviewed for this update:

- [A. R. Penner, The physics of putting (2002)](https://raypenner.com/golf-putting.pdf), equation 23: entry-speed capture envelope as a function of impact offset. We implement the base envelope, not every slope correction in the paper.
- [Hogan & Antali, Mechanics of the golf lip out (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12585879/): modern rigid-body treatment of rim and wall interactions. The cup here is now a rolling rigid-body contact carried through time rather than a single impulse, which is what makes sustained lip-outs possible at all, but it is our own formulation from the classical cylinder and torus constraints and is not a reproduction of their solver.

Additional primary sources reviewed for this revision:

- [Biber, Modeling Golf Ball Bounce (SIAM, 2025)](https://www.siam.org/publications/siam-news/articles/modeling-golf-ball-bounce-experimental-observations-and-mathematical-analysis/): compliant turf, Coulomb slip and solid-sphere inertia, and why rigid contact cannot reproduce every observed bounce. This motivates our deformation approximation; we do not claim to implement the complete model.
- [Mahoney, Connaughton & Jang, Geometric Aspects of Strategic Putting (2016)](https://www.golfsciencejournal.org/api/v1/articles/5001-geometric-aspects-of-strategic-putting.pdf), pp. 41–43: squared-speed run distance, Stimp calibration, 1.83 m/s reference release, and speed-dependent capture.
- [Kensrud et al., Aerodynamics of Golf Balls in Still Air (2018)](https://www.mdpi.com/2504-3900/2/6/238): measured production-ball lift and drag; supports retaining Reynolds- and spin-dependent coefficients rather than constant drag.
- [Effect of dimple shape, occupancy, and volume ratio on aerodynamic characteristics of golf balls during rotation (2023)](https://www.jstage.jst.go.jp/article/transjsme/89/924/89_23-00083/_article/-char/en): ball-specific differences in measured aerodynamics. The present generic coefficient curves are not a recreation of those experiments.

Checks on level fairway, still air, 18°C, sea level:

| Input | Carry | Total | Apex |
|---|---:|---:|---:|
| 155 mph, 12.5°, 2,700 rpm | 242 yd | 286 yd | 82 ft |
| 105 mph, 20°, 6,500 rpm | 155 yd | 165 yd | 87 ft |
| 76 mph, 30°, 9,000 rpm | 90 yd | 92 yd | 60 ft |

These are reproducible simulator outputs, not comparisons to measured launch-monitor shots. The test suite uses broad plausible ranges and timestep comparisons. More accuracy requires a dataset containing launch conditions, ball model, atmospheric conditions, carry, landing velocity/spin, and surface-specific rollout; tune against held-out shots rather than a few distances.

### The contour overlay was unreadable from the place it is used

The 3D heat map has existed since the green-reading tools were added, and it is drawn correctly: height across the putting surface, blue low to red high, contour lines every 10 cm. The problem is the viewpoint. On the green the camera sits about eye height a few yards from the ball, so the surface is seen at a grazing angle and foreshortens into almost nothing — the far half of the green, which is the half a player is actually trying to judge, resolves to a few pixels of vertical extent. An overlay that is legible only when you fly above it is not a putting aid.

The first attempt was drawn half a turn out of register. The map's projection negates both axes, so fitting the tile into a destination rectangle derived from its projected corners places it correctly and orients it backwards — the high side of the green painted over the low side. Nothing about the result looks wrong: it is a plausible contour field on a plausible green, and it would have been read and putted against. It is worth stating plainly that every automated check in place passed, because the field was correct and only its placement was not; what caught it was looking at the picture. The tile is now placed by an affine derived from the same projection that draws the outline, so the two cannot disagree, and the test asserts texel centres land on the ground they were sampled from.

The fix required no new field. The course map is already an orthographic top-down view of the same coordinates, so `src/green-map.js` samples the same `course.height` onto a grid and paints it there, with the map framed on the green whenever the ball is on it. The one substantive decision is the normalisation: the colour range is taken from the putting surface alone, never from the sampled square around it. A green in a hollow measured against the bank behind it puts the whole putting surface into a narrow slice of the ramp, so a green with 1.3 ft of genuine relief renders as a single flat colour — the failure mode is silent and looks exactly like a green with no slope, which is why it is asserted in a test rather than left to inspection.

## Turf firmness

Firmness is a different axis from green speed, and conflating the two is the usual mistake. A green can be quick and soft — a Stimp 12 surface that still takes a pitch mark — or slow and baked hard. Speed is what a ball does once it is rolling and is owned by `rollDeceleration`; firmness is what happens the moment it lands.

**The unit is the instrument's.** The USGA's TruFirm, and the GS3 ball that has since replaced it, measure firmness by dropping a hemisphere shaped like a golf ball from a fixed height and recording how far it penetrates the surface, in inches — lower is firmer. The device exists specifically to *"recreate the effect of golf ball impacts"*, which is exactly the quantity this model needs, so firmness here **is** that penetration depth and nothing is invented to carry it. The TruFirm reads 0.1 in to 1.5 in with 0.003 in resolution below 1 in, which is the range the model will accept at all.

**The four presets are the USGA's own published bands.** The GS3 article gives a typical range of **0.300″–0.500″** and names the bands inside it, and the presets sit on those bands directly:

| preset | depth | USGA band |
|---|---|---|
| Burnt | 0.30″ | 0.300″–0.350″ — *Extremely Firm* |
| Firm | 0.37″ | 0.350″–0.400″ — *Firm* |
| Normal | 0.45″ | 0.400″–0.500″ — *likely suitable for most facilities* |
| Soft | 0.60″ | >0.500″ — *Receptive* |

Two caveats the article itself supplies. The readings are taken **after morning maintenance and before play**, so they are a starting condition rather than what the surface does at four in the afternoon — which is the right reading for a setting chosen before a round. And championship values are *"typically inappropriate for daily play"*, which is precisely the job Burnt is doing at the bottom of the typical range.

**What is anchored and what is not, plainly.** The unit, the direction, the instrument's range and now the four depths are all published. The *scale* is the one thing that is not: no source says how much further a ball runs at 0.30″ than at 0.45″, so it is pinned by making Normal reproduce the bounce the model already had. An existing course therefore plays exactly as it did, and every other setting is relative to it. A test asserts all three multipliers are exactly 1 at Normal.

The other gap is **surface coverage**: these are putting-green ranges, and fairways are not measured with this instrument at all. A baked links fairway in August is firmer than any maintained green ever reads. One value serves the whole course here, so the firm end of the scale is honest for a green and conservative for a fairway — worth revisiting if fairways ever get their own control.

**How it reaches the physics.** Three multipliers on constants that already existed:

- **Bounce.** The turf absorbs the energy that makes the crater, so a deeper crater returns less. Restitution goes as the square root of the depth ratio, because restitution is a velocity ratio and energy is its square: half the penetration returns about 1.4 times the speed.
- **Tilt.** Penner's effective contact plane tilts because the ball has to climb out of the depression it is making, and the depth of that depression is precisely what the instrument measures. Straight proportional — the same crater, read as an angle instead of a depth.
- **Grip.** Soft turf closes around the ball and gives the tangential impulse more to work against. Weakly, to the 0.35 power, because the Coulomb limit is already bounded by the normal impulse and firmness has moved that too.

Measured, a 7-iron carrying 155 yd — bounce height and rollout:

| | onto a green | onto fairway |
|---|---|---|
| Soft | 2.8 ft, 2.6 yd | 2.1 ft, 1.0 yd |
| Normal | 3.7 ft, 11.2 yd | 3.1 ft, 5.8 yd |
| Firm | 4.1 ft, 18.3 yd | 3.5 ft, 9.5 yd |
| Burnt | 4.5 ft, 25.9 yd | 3.8 ft, 14.0 yd |

The fairway column is lower than the green one because they stopped sharing a restitution — see *The bounce ladder* below. The green column is unchanged, which is deliberate: it is the anchored end.

Carry is untouched — firmness happens after the flight, and a test asserts it cannot move carry. The spread also depends on the club, as it should: on fairway, Burnt-minus-Soft is **17.8 yd for a 5-iron against 4.0 yd for a wedge**. A wedge arrives steep and spinning and stops nearly anywhere; a long iron arrives shallow and takes what the ground gives it. That falls out of the landing model rather than being scaled in, and a test asserts the ordering.

**Anchoring cost real range, and that is the point.** Before the published bands were in hand, Burnt sat at 0.20″ — entirely *below* the instrument's typical range — and ran that 7-iron 36.7 yd. Moving it to 0.30″ cut the extreme to 25.6 yd. The earlier setting was more dramatic and had nothing behind it.

**Deliberate exclusions.**

- **Sand.** A bunker is not turf; its condition is raked state and moisture rather than the same measurement, and the instrument is not used on it. A firmness control that silently changed bunkers would be claiming something with no basis.
- **The cup and the rim.** The rim's rolling resistance is derived from the green's Stimp, and a Stimp reading is taken *on that green* — it already includes whatever firmness that green has. Multiplying by firmness again would count the same property twice. The same argument applies to the putt skid constant, which is anchored to a measured 15% skid share.
- **Rolling deceleration.** Left entirely to Stimp and the turf-roll settings, so the two axes stay independent and can later be driven separately by weather.

Sources consulted:

- [USGA — 365 days with the TruFirm](https://www.usga.org/course-care/2013/10/365-days-with-the-trufirm-four-things-ive-learned-21474861011.html): the device and its use in championship setup. Returns 403 to automated fetch; only the search summary was readable.
- [PACE Turf — Evaluating USGA's TruFirm for greens firmness measurements](https://www.paceturf.org/journal/usga_trufirm_for_greens_firmness_measurements): correlates TruFirm against the Clegg impact tester. Read in full; reports **no numeric values**, so nothing was taken from it.
- [Turf-Tec — TruFirm product manual](https://www.turf-tec.com/Instructions/TruFirm-Instructions.pdf) and [FieldScout TruFirm listing](https://alphaomega-electronics.com/en/soil-compactation/2426-6490s-fieldscout-trufirm-turf-firmness-meter-with-bluetooth.html): the 0.1–1.5 in measuring range and 0.003 in resolution, which is what `FIRMNESS_RANGE` clamps to.
- [USGA — The GS3 ball: understanding the numbers](https://www.usga.org/content/usga/home-page/course-care/green-section-record/62/issue-22/gs3--understanding-the-numbers.html) (Green Section Record vol. 62 no. 22, 5 December 2024): **the source of the four preset depths.** Gives the typical 0.300″–0.500″ range and the named bands inside it, the after-maintenance-before-play measurement protocol, and the note that the ranges apply to all grass types. The page returns **403 to automated fetch** — it was read because the user saved it from a browser. The passage relied on, as the article prints it: firmness is how far the GS3's drop fixture penetrates the green, in inches, lower is firmer, measured shortly after morning maintenance and before play; *Typical Range of Values: 0.300"–0.500"*; **0.300"–0.350" Extremely Firm, 0.350"–0.400" Firm, 0.400"–0.500" Likely suitable for most facilities, >0.500" Receptive**; the ranges apply to all grass types. The saved page and that extract are kept locally under `sources/` (`usga-gs3-understanding-the-numbers.html`, `usga-gs3-firmness-ranges.txt`) and are not in the repository since 3 October 2026, which is why the passage is quoted here in full.
  - The same article publishes **smoothness** (0.0–16.0, under 5.0 being high quality) and **trueness** (0.0–7.0, under 1.0 high quality) ranges. Neither is modelled — the putt roll is currently perfectly true — but they are the anchors if a "green quality" axis is ever wanted, and they are in the saved copy.
- [Golfdom — What putting green firmness measurements actually tell us](https://www.golfdom.com/what-putting-green-firmness-measurements-actually-tell-us/): read in full; names the instruments but publishes no values, and notes ball-bounce data was still future work at the time.
- [Asian Turfgrass Centre — Four tools to measure surface hardness](https://www.asianturfgrass.com/post/surface-hardness-correlations/): consulted for how the instruments relate to one another; nothing taken.

## The water reflection, and why the planar one was removed

A planar reflection is a second render of the entire scene from the mirrored camera, so a course can afford **one**. Measured on ultra (2048² reflection target) with water in frame:

| Reflection rendered | every frame | every other frame | never |
|---|---|---|---|
| Frame (ms) | 10.4 | 9.4 | 8.5 |

**1.9 ms of a 10.4 ms frame — about 18%.** Halving the cadence gave back 1.0 ms and was the default for a long time.

That arithmetic is the whole problem, and it was eventually fatal. A generated course carries eight to thirteen bodies of water and the budget buys one mirror, so the mirror had to be handed from body to body as the camera moved. Every handoff was one pond turning from water into varnish and another turning back, and it was reported three separate times in different words — "reflections turning on and off based on which body is closest", "only one pond shows reflections", and finally "the water pops in and out and looks terrible while doing it". Scoring the choice better, adding hysteresis and matching the non-reflecting material to the reflecting one all reduced the size of the pop without touching its cause.

**The planar reflector is gone.** Every body is now the same material with the same cubemap treatment, so there is no second class of water to be promoted into and nothing that can change under the camera. The 1.9 ms comes back as well.

**Screen-space reflection was considered and rejected**, not on cost but on what it can see. SSR only reflects what is already on screen, and the defining water shot in golf is looking ACROSS a pond at the trees on the far bank — which are above the horizon line and frequently off screen or occluded. SSR fails exactly where it is wanted, and it fails by fading out at the screen edge, which is a moving artefact as the camera turns. It also needs its own full-screen normal and depth passes, so it is not the cheap option it sounds like.

**What three.js ships was checked before writing anything.** In 0.186 the MIT-licensed options are `Water.js` (the planar mirror we had), `Water2.js` (flow maps, over a `Reflector` **and** a `Refractor` — two scene renders per instance, so thirteen bodies is twenty-six), `Reflector`/`Refractor` themselves, and `SSRPass`. `WaterMesh` and `Water2Mesh`, the better-looking modern pair, import from `three/webgpu` and cannot run on a `WebGLRenderer`. None of them solves the handoff, because all of them are planar: one mirror is one plane. The technique worth taking from `Water2` is its flow handling, and that was taken — see below. CC0 asset libraries were checked too; ambientCG has no water surface material, water not being a scannable PBR surface.

What was done instead attacks the DIFFERENCE between a reflecting body and a still one rather than the switching:

- Still bodies now carry the reflector's own animated normal map, a little more roughness and a stronger environment map. A pond that is not reflecting still moves and still breaks the sky up, instead of being a sheet of tinted glass.
- A stream is scored at 1% of its fill (`STREAM_PENALTY`) so it only ever takes the reflector when there is no still water at all. A creek threads the whole course, so it was constantly coming into contention and pulling the reflection off the pond you were standing beside — and a two metre channel broken up by its own banks is the body that needs a mirror least.

### Ambient occlusion was drawing the reflection in normal colours

Reported as "ambient occlusion is causing water to look weird", with a screenshot of grey water under a band of magenta and cyan speckle. Those are `MeshNormalMaterial` colours, which narrowed it in one step.

The AO pass renders the whole scene with `scene.overrideMaterial` set to a normal material, to capture view-space normals. Every object's `onBeforeRender` still fires during that render — including the `Water`'s, which does a **full reflection render of its own**. With the override still set, the reflection was drawn entirely in normal colours and left in the target for the main pass to sample. The water was mirroring a picture of normals.

The reflection now refuses to draw whenever `scene.overrideMaterial` is set, which protects any future override pass for free.

### Ambient occlusion worked, had nothing to occlude, and was removed

"Ambient occlusion isn't doing anything at all" is the kind of report a look cannot settle, because on a golf course "I see no difference" and "it is broken" are indistinguishable. `lab.ao()` renders the occlusion term into a small target instead of multiplying it over the frame and reads it back. From the tee:

| | |
|---|---|
| mean multiplier | **0.997** |
| darkest pixel | 0.894 |
| share of frame touched | **5.4%** |

So it is running and it is correct — the darkest pixel is 10.6% down — but it reaches five per cent of the picture. Ambient occlusion shades where surfaces MEET, and an open fairway is the one scene with almost no contact geometry in it: a tree line at the edge, a bunker lip, and otherwise sky and grass. The effect is real and the scene has nothing for it to do.

That is worth stating rather than tuning away. Raising the strength scales 5% of the frame harder; widening the radius starts duplicating the local-relief cue, which is already doing that job better and for free.

**It was removed.** A full extra render of the scene for five per cent of the frame at a mean of 0.997 is the worst ratio of anything added here, and local relief covers the ground — the part of the picture that matters — for nothing. `src/ambient-occlusion.js`, the tier key, the `needsRebuild` clause, the panel switch and `lab.ao()` all went with it. Deleted rather than defaulted off: a switch nobody should turn on is not a setting.

### Two more found in the same report

**"The water reflections checkbox isn't doing anything" was true.** Setting the cadence to zero skipped the reflection render, but the water shader went on sampling the target — holding the last image drawn into it. A frozen reflection looks like a working one until the camera moves. Off now hides the reflector and shows the body's own plain mesh, which is what every other body on the course already is.

**And ambient occlusion did nothing below Ultra.** `render()` reads `view.quality.occlusion` and returns immediately on a zero, which every tier below ultra is — so a player switching AO on below ultra built the pass, ran it, and drew nothing. The tier is a default strength now rather than a permission: switched on by hand it borrows ultra's 0.55.

All three came from one screenshot. None would have appeared in a frame time, a shader link error, or a test.

### Water that is not reflecting: clarity, not texture

The first attempt at making a non-reflecting body look like water gave it a stronger, animated normal map, and the answer to that was "I don't want textured water, I want it to actually be clear". That was the right correction. A mirror is not what makes water read as water — being able to SEE INTO IT is.

**Fresnel is the whole trick.** One term, from the angle between the eye and the surface: `f = 0.02 + 0.98 · (1 − |n·v|)⁵`. Water reflects about 2% face on and ~100% at grazing, which is why a lake is a mirror from the tee and a window from a bridge over it. Looking down, alpha drops to 22% of the body's depth-based opacity and the bed shows through; looking across, it rises to full and takes a sky tint. It needs no reflection texture, so it costs nothing and applies to every body at once.

The normal map stays but is deliberately quiet — scale 0.3, roughness 0.14 — to break the specular into moving glints rather than to be a visible pattern. Two drifts cross at different scales so a repeating texture does not read as repeating, and the clock runs whatever else is happening.

Two bugs were found underneath this, and both are now unreachable — there is no water texture of any kind left, the surface being generated in the shader. They are recorded because the cause is a property of the GEOMETRY and will bite anything textured against it: pond UVs come out of `ShapeGeometry` in **world metres**, so a texture tiles roughly every metre, aliasing into a flat grey wash at distance and reading as an obvious repeat up close. The other was `waterNormals()`, built for three's `Water` shader, which amplifies it with its own `distortionScale`: at **nine parts in 255** it was indistinguishable from flat on a plain material.

### Reflections everywhere, from probes rather than mirrors

`scene.environment` was a PMREM of a scene containing **only a clone of the sky dome**. That is the whole reason a non-reflecting pond could never show anything but sky colour: there was nothing else in the map to show.

A **probe** is the cheap answer to the question a planar reflector answers expensively. A `CubeCamera` renders the course into a small cubemap, `PMREMGenerator.fromCubemap` convolves it, and a water material samples it as its `envMap` — once, not per frame.

**One probe for the whole course was not enough, and was reported as "only one pond reflects".** The first version took a single probe at the first body's centre and handed it to all thirteen, so every pond reflected the same patch of trees — at distance a soft green tint rather than a reflection, and indistinguishable from nothing. A pond reflects what is around THAT pond or it is not reflecting. It is now one probe per body, biggest first, capped at eight; past the cap a body borrows the nearest probe rather than falling back to sky, which would put one pond in a different world from its neighbour.

**The material also has to be smooth enough to show it.** PMREM blurs by roughness, and at roughness 0.14 with metalness 0.3 the course came back as a wash rather than an image. Water is a near-mirror: 0.05 roughness, 0.62 metalness, environment intensity 2.1.

Measured on a thirteen-body course: **8 distinct probes across 13 bodies, all 13 with an environment map, 8.4 ms — unchanged.** The six faces are 128 pixels square and the capture happens during generation, behind the screen that already says the landscape is being built.

What it gives up is parallax: the reflection comes from one point in the world rather than from each body's own position, so it does not line up the way a mirror does. That matters on still glass and does not on a rippled surface at fifty yards.

`scene.environment` is deliberately left as the sky-only map — it feeds every prop on the course, and a house window should not start mirroring terrain. The probe is assigned to the water materials alone.

**The probe has to be taken after the water exists.** `addSky` runs before the bodies are added, so the refresh it triggers finds nothing to probe for and returns; the next refresh is an elevation threshold away, which on a still afternoon never arrives. It is taken where the water is built.

**And it has to give the water back afterwards.** The probe pass hides every body first — a probe that can see other water surfaces bakes them in, and one that can see its own is a feedback loop — then restores what it hid. The restore wrote `visible` on the *body* objects rather than on their meshes, which sets a property nothing reads and leaves every mesh hidden. The visible result was that only one pond had any water on it; the rest showed the water-coloured ground underneath, which was reported, accurately, as ponds being covered by a flat texture. With the reflector removed, `hiddenBodies` should now be **zero at all times** — there is no longer any legitimate reason for a body of water to be invisible.

The instrument that would have caught it is now in `lab.state().water`: `hiddenBodies` should never exceed one, and only while the reflector is standing in for that body.

### Ripples with no tile in them

With reflections off there is nothing on the surface but the ripples, and at pond scale a tiled normal map **is** the thing you notice — the repeat was clearly visible even at a 7 m period with two drifts crossing. A texture cannot fix this; any texture repeats.

The reflections-off treatment is now value noise hashed from the world position, two octaves, each drifting on its own bearing, with a broad swell warping where the fine chop is sampled so the small waves ride over the big ones instead of lying on top of them. The normal comes from finite differences of that height field. There is no tile, no texture read, and the pattern is different at every pond on the course.

It costs about fifty hash operations per water fragment, which is why it is gated: with reflections **on** there is an image on the surface doing the work and the cheap tiled map is enough, so the noise is compiled in behind a uniform branch and never taken. `lab.state().water.procedural` says which path is live; `lab.waterRipple(chop, swell, speed)` sets the strengths and the pace without a rebuild.

### Rounding the corner a mower cannot cut

The fairway beside water is the intersection of two regions — inside the corridor, and clear of the water's reach — and an intersection has a sharp corner where its two boundaries cross. A mower arrives on an arc and cannot cut that corner, so the notch is not a shape any greenkeeper could leave. `BAND_ROUND` (2 m) replaces the plain `max` with a polynomial smooth-max in both the paint and the lie.

**The band's WIDTH was never the problem, and an earlier plan to "fix" it would have broken it.** The intended change was to place the band at `WATER_LIP + semiRough` instead of `shoreOuter + semiRough`, on the grounds that `shoreOuter` varies with body size and mownness. Working it through: with `reach = outer + semiRough` the VISIBLE band is `reach − outer` = exactly `semiRough`, always. The proposed replacement would have made it `LIP + semiRough − outer`, which varies with `outer` — introducing the very defect it claimed to remove. Withdrawn before it was built.

What actually varies is the total swath where a pond's band meets the corridor's own and the two add up: p90 22.5 m against 15.0 m without water. That is geometrically honest — more turf edges means more semi-rough — and removing it needs semi-rough rebuilt as a single uniform offset of the mown region.

**That option was priced on a real hole and declined.** A uniform offset is a distance transform, not a formula. The first draft of the comparison page wrote it as `max(fairD, semi − waterD)` and silently reproduced the rounded version exactly — both read 30.1 m, which is what gave it away. With a real chamfer transform it reads 25.2 m against today's 32.2 m, changing 1.04% of the ground. The reason it was declined is not the 1%: `surface()` is a POINT QUERY and a distance transform needs a GLOBAL GRID, so the lie would have to carry a fourth baked representation alongside the corridor curves, the owner atlas and the ground grid. Every bug in this area has come from two representations drifting apart.

Rounding, by contrast, is the same arithmetic on both sides. Measured course-wide at 2 m: **7 cells of 129,010 change, 0.01%** — a local change at pond corners and nothing else. `BAND_ROUND` is the dial if it wants to be more visible.

### Flow, taken from Water2

Pushing a wave field along a flow vector stretches it without bound: after a few seconds a creek is smeared into streaks. Three's `Water2` solves this with the method from Vlachos's SIGGRAPH 2010 water talk — sample the field at **two phases half a cycle apart, cross-fade between them, and reset each one while it is invisible**. The reset never shows because nothing is on screen at the moment it jumps. That is the part of `Water2` worth having, and it is now in our own shader without `Water2`'s Reflector and Refractor, which are the parts we cannot afford.

Still water skips it entirely. A pond's ripples move but the field they move through does not, so its flow vector is zero, the two phases are the same field, and the shader takes a single-sample path — which matters because ponds are most of the water on most courses and most of the water pixels. `flowFor` in `src/water-bodies.js` decides: zero for ponds, lakes and the ocean, and `STREAM_FLOW` along the channel for a creek or river, first station to last.

Speed is deliberately one number and not a rate per layer. Each drift in the shader is a rate times the ripple clock, so the rates are ratios to each other and the clock carries the pace: `WATER_SPEED` scales `dt` into `waterTime` and moves every layer together. Nothing recompiles, and 0 freezes the surface, which is the quickest way to tell a wave shape from a wave motion when judging either. It ships at 10, picked by eye against a generated course; there is no physical pace being matched here, so the number is a look and nothing else.

## The ball's shadow, which never existed

`ball.castShadow` was `true` from the beginning and had never once drawn anything. A golf ball is 4.3 cm across; the sun's shadow map covers the hole:

| Tier | Shadow map | Span | cm per texel | Ball |
|---|---|---|---|---|
| low | 1024² | 280 m | 27.3 | **0.16 texels** |
| medium | 2048² | 370 m | 18.1 | **0.24 texels** |
| high / ultra | 4096² | 370 m | 9.0 | **0.47 texels** |

Sub-texel at every tier, so the flag was paying for a draw call in the shadow pass to render nothing. Raising the resolution is not the answer either — going from 0.47 of a texel to two texels means a 16384² map for one 4.3 cm object.

What the ball needs is not a cast shadow but **contact darkening**: the ambient occlusion where a thing meets the ground, which is what actually tells the eye it is resting rather than hovering. That is a soft disc, generated as 64 pixels of greyscale with a squared falloff — squared because a linear gradient reads as a grey coin with an edge, and the point of the cue is to have no edge.

It **spreads and fades together** as the ball rises. Spreading alone gives a ball towing a dinner plate; fading alone gives a hard dot that blinks out. Both, and height comes off it for free. The fade is squared as well, so the darkening holds while the ball is near the turf — where it is doing its job — instead of being half gone by knee height. Measured through a real drive: 13 cm wide at 0.42 opacity on the turf, 46 cm at 0.07 at four and a half metres, invisible past eight, back to 13 cm on landing.

**At rest, a cast shadow and a contact shadow are very nearly the same mark**, which is why there is one mesh and not two. A resting ball's centre is 2.1 cm up, so with the sun at 41° its cast shadow is offset 2.5 cm — less than one ball width. The disc therefore leans and stretches away from the sun rather than a second shadow being drawn: offset by `lift · cot(elevation)`, stretched along that line by `1/sin(elevation)` — the projection of a sphere onto the ground — and left round when the sun is below the horizon, where what remains is contact occlusion, which does not care where the sun is. Measured in the running build at 41° elevation: offset 2.5 cm against a predicted 2.45, stretch 1.52 against a predicted 1/sin(41°) = 1.52.

Both the offset and the stretch are **capped** (1.5 m and 3×). A true shadow runs away from a ball in flight until the two are unrelated, and a mark that far from the ball has stopped being a cue about the ball; a sunrise would otherwise draw a runway.

**The cascades do not rescue the cast shadow either, and that was checked rather than assumed.** High and ultra use 3 cascades with `shadowFar` 2500, so the practical split puts the near cascade at **418 m deep on a 4096² map — 16.3 cm per texel, 0.26 of a ball.** The single-shadow-camera path on low and medium gives 0.16 and 0.24. For the ball to span two texels in the near cascade the map would have to be **31,383 pixels square.** There is no resolution at which this is the right mechanism.

## Where water is allowed to be, and what turf does when it gets there

Three faults, found by measuring rather than by looking.

**Channels were being drawn on the seabed.** A stream is laid across a span reaching well past the course and then trimmed — but only ever for the excavation budget, never for whether the ground existed. On an island that is most of the span: **2302 of 2452 stations at sea on one seed, 87–95% across three.** A river was being drawn along the ocean floor. Channels are now cut to the longest run that stays on land before anything else looks at them, and because `downhillProfile` already closes a trimmed end down to nothing, what is left fades out where it meets the water — which is what a mouth looks like. After: **0 of 624.**

**An island could not hold a pond at all**, measured at **zero ponds and zero lakes per island course against six of each on the same settings inland** — and chasing that measurement turned out to be the wrong response to it. The cause was real: the siting test asks how far ground rises across a pond's footprint, and on a coast the ground falls to minus the water depth within tens of metres of anywhere, so the sea read as a cliff and every site was rejected as too steep. Clamping the samples at the waterline made the test judge the land, and a separate check refused any pond whose centre or rim was in open water. That worked — 1.3 ponds per island course at the default setting, 4.0 at the maximum, 12 of 16 candidates correctly refused as drowned.

**The owner then ruled that an island should carry no inland water at all**, and that is the shipped behaviour: `NO_INLAND_WATER` switches off ponds, lakes, rivers and creeks for the island biome. The reasoning is better than the fix it replaced. An island is a narrow strip with sea on every side, so the ocean is already in play on most shots and a pond is both redundant and the hardest possible thing to site. It is the biome deciding what it is, not settings validation — the controls keep their values, so switching a course to island and back returns the water it had.

The clamping and the drowned check stay, because **links has a coast too** and had the same faults on it.

The sea test uses the raw landform, never `shapedLand`. Shaping is what ponds and channels do *to* the land, and no water body may decide it is on dry ground because another one already dug a hole there.

**The mown band around water took two attempts, and the first one was invisible.**

The first version was one clause in `surface()` downgrading `fairway` to `semi` within the semi-rough width of any water. It measured perfectly — 0 fairway cells touching water against 337 semi-rough cells — and **nothing on screen changed at all**, because `surface()` is the LIE and the ground shader is the PAINT, and the shader classifies turf from the hole's corridor geometry without ever consulting `surface()`. So the mown band still ran to the shore on screen, and across a crossing it ran under the water and out the other side, while the ball had quietly started taking a semi-rough lie on ground drawn as fairway. That is the failure `localSurface`'s own comment warns about, one function above.

The measurement was not wrong; it measured the wrong half. "0 fairway cells touch water" was a true statement about the classifier and said nothing about the pixels. **A visual change needs a check that can see pixels** — at minimum, proof that the shader source actually changed and still links.

The second version did both halves off the hole's `semiRough` — `ground.js` downgrading `kind==2.` to semi, `surface()` giving the matching lie — and was still wrong, for a reason worth keeping: **it measured the band from the water's edge, and the shore soil is painted on top of it.** At a 6 m semi-rough setting the wet-and-damp band already reaches **7.14 m**, so the entire 6 m of turf sat underneath it and nothing was visible. The turf still read as fairway running to the shore, and the report came back as "you butted the semi-rough to the water edge" — accurate, and the opposite of what was wanted.

The band is measured from the **shore's outer stop** now, so it begins where the soil finishes and the whole of it can be seen:

| semiRough | soil ends | band runs to | visible |
|---|---|---|---|
| 0 m | 7.14 m | 7.14 m | none — off, not floored |
| 2 m | 7.14 m | 9.14 m | 2 m |
| 6 m | 7.14 m | 13.14 m | 6 m |
| 15 m | 7.14 m | 22.14 m | 15 m |

It costs about two points of corridor: fairway goes from 30.7% of corridor cells to 28.7% on a water-heavy course.

Placing it needed the shore stops in JavaScript, and **the two copies of that formula had drifted** — `streams.js` scaled the wet stop by 0.6 and the damp increment by 0.25 where the shader used a single 0.32 for both, and carried no outer stop at all. They are one formula again, with a test comparing them, because the band is positioned from `outer` and a drift there puts green turf under brown soil.

The sea is deliberately excluded: a coastline is not mown around, the rough runs to the dunes and the beach takes over.

**And a pond could never reach play.** Banks are anchored outside the semi-rough and the gap could only push them further out, so water carried off the tee, or a pond pinching a fairway into two landing areas, were shapes the generator could not produce. A pond may now bite into the corridor (about one in six) or cross it (about one in twelve). The fairway is mown around a bite and genuinely stops and restarts at a crossing.

Splits were priced before they were allowed, because a split that needs a 300-yard carry is a broken hole rather than a design:

| | holes split | median carry | longest |
|---|---|---|---|
| default settings | 6% | 33 yd | 42 yd |
| water 100, 1 river, 2 creeks | 13% | 33 yd | 101 yd |

## The map's terrain slid off the course when you zoomed

Reported as fairways moving independently of the terrain on the map. The full-course terrain background was drawn as a plain rectangle:

```js
ctx.drawImage(world.mapBackground, w/2 - halfX*scale, h/2 - halfZ*scale, ...)
```

which silently assumes the map is centred on the world origin. It is — `mapLayout` sets `cx:0, cz:0` for the full map — right up until you touch it. `withNav` moves that centre for pan, and **`zoomAbout` sets a pan whenever you zoom about anything but the exact middle of the canvas**, which is what a mouse wheel over a map does. Everything else on the map is drawn through `mapPoint`, which is `w/2 - (p - c)*scale` and follows the centre. So the terrain scaled about the canvas while the course translated about the map centre.

| zoom | terrain drift from the course |
|---|---|
| 1.00 | 0 px |
| 1.60 | 95 px |
| 2.56 | 248 px |
| 6.55 | **882 px** |

On a map 376 px wide, 882 px is the terrain having left it entirely. **It was exactly correct at rest, which is why it survived**: the fault needs a pan or an off-centre zoom to appear at all, and the default view has neither.

The fix is to place it through `tilePlacement` like every other tile on the map — the helper written for precisely this, whose own comment says that deriving the placement from `mapPoint` means the tile cannot disagree with the outline drawn over it. This was the one tile not using it. The background is also generated in the standard orientation now (pixel 0,0 is minimum x and z) so the negative scales can carry the 180 degree flip, instead of the tile being pre-flipped to suit a call that assumed the map never moves.

Drift after: **0.000000 px at every zoom and pan**.

**This was not caused by the terrain work around it**, and the search for it burned real time — world geometry, routing, the owner atlas, shader linkage and GL state were all checked and all clean, because the fault was in a canvas draw call nothing had touched. What changed was its visibility: the island background paints ground below 2 m as sand, and the foreshore put a great deal more coastal ground below that line, so a drift that had always been there suddenly had something obvious to drift.

## The owner atlas, and a scoring bug hiding behind it

Reported as a stepped join where the ground behind one hole's tee meets the middle of another's fairway, **only on island**. Three island-specific explanations were tested and all three were wrong: texel size is effectively identical in every biome (island 2.88 x 4.26 m, everything else 2.61 x 4.39), the terrain crease at an ownership boundary is *worse* on pnw than island (p99 0.129 against 0.067), and painted water disagrees with the mesh near tees in only 0.35% of cells.

The defect is in every biome. What is island-specific is **where the junctions are**: the ground between holes there is water, so two holes' turf abuts at a handful of land bridges rather than continuously, and each one is framed against the sea. It was a general fault seen at the one place it could not hide.

The atlas was a flat 512 square over a course that is **1475 by 2180 m**, sampled NEAREST — so texels were 2.88 m across and 4.26 m along, and a boundary running east-west stepped half again as far as one running north-south. Against true ownership, **0.35% of samples got the wrong hole**: the band within one texel of a boundary.

Sized from the course now, at `OWNER_TEXEL` metres square:

| | texel | owner error | VRAM |
|---|---|---|---|
| before | 2.88 x 4.26 m | 0.35% | 4.0 MB |
| after | **1.75 x 1.75 m** | **0.13%** | 16.0 MB |

The cost is not only memory. The atlas is one `nearest` call per texel, and there are four times as many: **the build went from about 0.5 s to 2.1 s**, which lands on course load on top of generation. `OWNER_MAX` caps the total so an unusually large course gets a coarser atlas rather than an unbounded texture.

This makes the staircase smaller; it does not remove it. Resolving the boundary analytically in the shader — sample the four neighbouring texels, and where they disagree evaluate the true nearest among only those candidates — would, at no memory cost and with the extra work landing on the 0.13% of fragments that need it. It was considered and deferred.

### Resolving the boundary instead of shrinking it

Raising the atlas halved the staircase and the owner said it made no visible difference, which is fair: a boundary between two holes is a curve and an atlas is a grid, so resolution only ever buys a factor.

The boundary is resolved analytically now. `fwidth(owner.r)` gates the work — non-zero only on a quad the boundary actually crosses, which is exactly where a step can be seen — and inside that gate the four neighbouring texels supply the candidate holes. The fragment is assigned to whichever it is genuinely nearest, by the same measure `nearest` uses in course.js.

Two things had to be uploaded for that to be honest rather than approximately right:

**`nearest` measures against `h.width`, which is `max(leftWidth, rightWidth)` — the raw corridor half width — and NOT `fairwayWidth`**, which is what the `curves` texture carried. `fairwayWidth` adds the end caps and the green blend, so measuring against it would have answered a different question from the one the atlas was built with, and the resolve would have fought the data it was fixing. The spare fourth channel of `curves` now carries `h.width`.

**A lake overrides nearest-hole ownership outright**, and no analytic resolve can know that — it would hand the ground back to whichever hole is nearest and quietly undo the override. The atlas's spare alpha channel now flags texels a lake decided, and the resolve declines when any candidate carries the flag.

Checked by replaying the shader's arithmetic in JavaScript against `nearest` over 24,955 samples: **worst distance error 1.79 m, a different hole chosen at 0.032%** of samples, against the atlas's 0.13%. The residual is not the method but the `curves` texture — 512 samples across a span of about 580 m, so a little over a metre between samples, and a curvy hole's centreline interpolates. The boundary is therefore SMOOTH but can sit up to about a metre from ideal, which is the right trade: a smooth line slightly out of place reads far better than a stepped one exactly in place.

### A ball could be penalised for the sea while standing above it

Found while measuring the above. `surface()` decided ocean from `land`, the raw landform, while the ocean plane sits at `waterLevel` and the ground drawn under it is `height` — the landform plus every bit of hole shaping. On one island course they disagreed over **1512 sampled cells**, and not marginally: ground scored as a water hazard stood a **median 0.88 m above sea level and as much as 6.13 m**. A ball could come to rest on a visible hillock and be scored as though it were in the sea.

`surface()` asks `height` now, so the hazard is where the water visibly is. After: **0 cells**. Generation still uses `land` for this, in `isSea`, and must — ponds and channels are placed before there is a ground mesh to ask.

Note that measuring this only works on island, which carries no inland water. On any other biome a pond sits at its own level, metres above sea level, so comparing pond water against `waterLevel` counts every inland pond as a fault and means nothing.

## A tear at the end of every hole, in every course ever generated

Reported as jagged edges on water and on the edges of land masses, with a guess that it happened where two holes butt up against one another. The guess was right and the cause was one expression:

```js
d = hypot(...) - Math.max(h.width(zz) + semiRough,
                          zz === h.length ? 25 + fringe + semiRough : 0)
```

`zz` is the point's along-hole coordinate clamped to the hole. The instant a point passes the end of a hole `zz` becomes *exactly* `h.length`, that float equality fires, and the greenside allowance appears whole. Probed at one crossing: **`n.d` goes 57.04 m to 39.94 m across a quarter of a metre**, same owning hole either side, `n.other` perfectly continuous. The 17.1 m is `25 + fringe − width` to the digit.

`land` reads that distance, so the landform has been torn along a line past every green in every biome since it was written:

| biome | worst `land()` step per 0.25 m | after |
|---|---|---|
| mountain | 10.87 m (43 m/m) | 1.29 m |
| island | 7.18 m | **0.49 m** |
| pnw | 4.65 m | 0.57 m |
| links | 1.94 m | 0.62 m |

It shows on an island because a waterline draws it. The fix ramps the allowance in over `GREEN_RAMP`, and the ramp has to run **beyond** the green rather than up to it: starting it 30 m short reshaped the ground the green sits in and pushed the surround-slope test from passing to 0.624 against its 0.6 limit. One-sided, the allowance is exactly the corridor everywhere up to the green and grows only out past the end, where the step used to be. Continuous either way; only the far side moves.

**A wrong turn worth recording.** `n.other` was measured jumping up to 158 m at ownership changes along the coast and looked like the culprit. It was an artefact of the probe: `n.other` was being sampled *at* the traced waterline, so when the waterline tore 222 m sideways the two samples were 222 m apart and naturally disagreed. The test that means something is the continuity of `land` itself, sampled on a fixed grid — a cause has to be measured where it acts, not where its effect is visible.

### The shoreline refinement asked the wrong field, and then the wrong question

Twice. The first version asked `land`, the raw landform, while the mesh is built from `analyticHeight` — the landform plus hole shaping, pond basins and stream carving. Wherever those diverge the real waterline fell outside the band and kept the full 3 m tessellation: **23.3% of true waterline cells missed.** That is why halving the owner atlas changed nothing visible; a quarter of the shore had never been refined at all.

Pointing it at `analyticHeight` halved that to 12.2% and no further, because a height band is tested at the CELL CENTRE and therefore misses any shore steeper than the band is wide. Widening it does not work either: the ocean is only `waterMax` deep, so reaching a metre under sea level sweeps in the whole seabed — **4.6 million triangles and ten seconds** to refine water nobody can see through. Widening upward made coverage *worse*, which is what revealed the misses were on the underwater side.

Probing the cell's four corners is the right question — does this cell straddle the waterline — and cost five height evaluations per cell, taking generation to **10.2 s**.

The answer was that the grid already knows. `makeGroundGrid` samples every corner height before it builds the refinement mask, so handing those to the predicate makes the straddle test **exact and free**:

| | generation | triangles | waterline p90 |
|---|---|---|---|
| `land` band ±0.4 m | 4918 ms | 1.90 M | 0.50 m |
| `analyticHeight` band | 5487 ms | 1.85 M | 0.50 m |
| corner probes, re-sampled | 10156 ms | 1.90 M | 0.50 m |
| **corner heights from the grid** | **3262 ms** | **1.50 M** | **0.50 m** |

Better on every axis than any band: it refines the cells the waterline crosses and nothing else. The lesson generalises past water — a predicate asking whether a cell *straddles* anything cannot answer from its centre at any band width, and the grid is holding the corners it needs.

### And the shoreline was never refined

The ground mesh is 3 m, subdivided six ways to half a metre near channels, greens, ponds and bunkers. The coast was not on that list, so an island's edge was tessellated at the full 3 m: the second difference along the traced waterline had a 90th percentile of **exactly 3.00 m**, the grid admitting itself. Adding a shoreline clause takes it to **0.50 m**, the refined spacing.

The band has to be narrow, and the first attempt was not. `|land| < 2.5` looks like "near the waterline" and is actually **the entire seabed** — the ocean is only `waterMax` deep, which defaults to 2.5. It refined the whole 66% of an island course that is water: **22.1 million triangles and 44 seconds** of generation against a 2.6 second baseline.

| band | generation | triangles |
|---|---|---|
| ±2.5 m | 44.0 s | 22.1 M |
| ±1.2 m | 13.6 s | 6.4 M |
| ±0.8 m | 6.9 s | 3.0 M |
| **±0.4 m** | **4.9 s** | **1.9 M** |

±0.4 m reaches the same 0.50 m smoothness as the widest band. Non-coastal biomes pay nothing — the clause is a closure that returns false for them, and pnw generation was unchanged.

## Watercourses that follow the land

Three attempts, and the first two failed the same way for the same reason.

**A path is a local thing with no memory.** The original channel was a bearing and three harmonics — a sine wave drawn across the map with no reference to the ground — and the terrain entered only afterwards, as a budget: keep the longest run whose bed stays within `MAX_CUT` of the surface. So a channel imposed its own gradient and excavated whatever stood in the way: a median cut of 4.2 to 9.5 m below the land, reaching **21.1 m** on a mountain course, with one creek falling 5.2 m over ground that fell 0.5.

The second attempt replaced it with a downhill walk, which fixed the excavation and broke something worse. Meander was applied as a rotation of the heading — and a rotation *integrates*, so a constant bend is a circle. Measured, channels turned through **12.2 to 18.9 full circles** each, with **2716 self-overlapping station pairs** on one river. The curvature cap added to bound the bends did not prevent that; it set the radius of it.

Nothing in a path forbids returning to ground it has already crossed. That is the whole diagnosis, and no amount of tuning reaches it.

**Water does not choose a path. It occupies the one the land already has.** So the land is solved once, over a 10 m grid, and every channel is read off that single answer:

- **fill** — a priority flood grows inward from the map edge and the sea, always taking the lowest frontier cell, which floods every depression to exactly its spill height. A 1 mm epsilon leaves a faint gradient across each filled flat so it still has a direction to drain.
- **flow** — each cell points at its steepest lower neighbour on the *filled* surface.
- **drain** — accumulation, summed from the top of the ordering downward, so a cell's own total is complete before it is passed on.

A channel is then a walk **down** the flow directions, and it cannot spiral or cross itself however the meander is tuned, because every step is strictly lower than the last. That is a property of the construction rather than a number to tune, which is the entire reason for the rewrite.

Meander survives, but **as a lateral offset, never as a rotation** — an offset is bounded by its own amplitude however far the channel runs, and displacing a monotonically descending path sideways by a few metres cannot make it climb or close a loop. It is tapered to nothing at both ends so the mouth still meets the sea and the head still starts where the water does.

Three things fell out of the construction rather than being designed:

**Greens, tees and bunkers are raised, not steered around.** A 60 m bump is added to the working height field over each. Water then flows past them for the same reason it flows past a hill, and the route stays a pure descent — *steering* a path is exactly what reintroduces the ability to loop.

**A creek is a tributary, not an independent squiggle.** Seeds are taken in order of accumulation and specs are sorted rivers-first, so the river takes the largest catchment and the creeks take what drains into it. A river is not labelled a river; it is the path that drains the most land, which is what makes one.

**The grade had to be raised, and the old figure was never physical.** `STREAM_GRADE` bounds the fitted water surface, and at 0.025 a route down a real valley forced a **6.91 m** median excavation wherever the valley fell faster than the water was allowed to. A river runs at one or two per cent and a mountain creek at ten or more; 2.5 was a number, not a measurement. At 0.09 the cut drops to well under two metres.

After, measured on pnw and links:

| | channels | length | turning | self-overlaps | median cut |
|---|---|---|---|---|---|
| pnw | 3 | 566 / 354 / 362 m | 1.46 / 1.19 / 1.53 circles | **0** | 0.83 / 0.43 / 1.84 m |
| links | 3 | 514 / 509 / 363 m | 1.57 / 1.86 / 1.31 circles | **0** | 0.78 / 0.25 / 0.32 m |

Against 12.2–18.9 circles and 2716 overlaps from the walk. Roughly one and a half turns over half a kilometre is a river wandering across a landscape.

**Where they end.** A channel terminates at the sea, at a surviving lake, at another channel it has joined, or at a sink — a depression too large to have been flooded away. `SINK_FILL_AREA` is the dividing line, and it is deliberately generous at 40 000 m²: a terminal pond should read as a destination, not as a puddle every creek trips into. At 2500 the fill swallowed the valley floors themselves and a mountain course came back with one channel 289 m long. Across twenty courses the endings are **40 sink, 14 lake, 3 sea, 2 confluence**.

## The back tee was the low one, and a quarter of tee shots were blind

Reported together, and they turned out to be the same lever.

Each tee pad read its own height straight off the shaped landform at its own spot, and the three pads sit at 0%, 9% and 18% down the hole. So on any hole that climbs off the tee the order simply inverted — the back tee lowest, hitting up at the forward tees. That is not a bug in the shaping; there was never a rule saying the back tee should be the high one. Measured over 270 holes:

| | before | after |
|---|---|---|
| holes with at least one tee stacked backwards | **34%** | **0%** |
| blue below white by more than 0.5 m | 27% | 0% |
| white below red by more than 0.5 m | 33% | 0% |
| worst backwards step | −2.9 m | none; smallest forward step +0.1 m |
| blue tee shot with the sightline blocked over 1 m | **23%** | **3%** |
| white | 21% | 9% |
| red | 19% | 12% |

The tee complex is now levelled as one thing rather than as three independent pads, and two things happen there.

**The natural spread is compressed, then the order is enforced.** Clamping alone would guarantee the order too, but it does it by raising the back tee all the way to wherever the front one landed — a pimple with a 55 m ramp around it on steep ground. Pulling all three toward their mean first means the ordering costs a fraction of the natural difference rather than all of it, and every pad stays close to the ground it sits on. Pad flatness came out *better* than before, worst spread across a pad **0.35 m** against the 0.46 that had been signed off, and the slope leaving a pad never exceeds 0.14.

**The complex is lifted until the shot clears the ground in front of it.** This is what an architect does, and it is the cheap half of the blind-shot problem: the tee moves rather than the hillside, so the terrain the hole was generated around is untouched. Raising the eye by *L* lifts the sightline at fraction *u* of the way to the target by *L*(1−u), so clearing an obstruction of *h* at *u* costs *h*/(1−u) — a crest halfway out needs twice its own height in tee. Capped at 3.5 m, past which it stops being a raised tee and starts being a plinth; what the cap cannot clear stays a blind shot.

Three ideas were considered and rejected. **Always run the hole uphill** would have cost the good holes — the tee-to-green spread is −6.8 to +9.8 m and the downhill ones are the best views in the game — and it does not even address the cause, because blindness comes from an intermediate crest, which an uphill hole has just as readily. **One flat terrace** for all three pads works, but on a 400-yard hole the complex spans about 60 m and a dead-flat rectangle that long reads as a driving range. **Shaving the crest** guarantees the sightline, but reshapes exactly the terrain that makes a hole interesting.

### Two ways this broke a flat course, both caught by one test

`elevation: 0` promises flat ground, and it is the clearest possible statement of what these two rules must not do.

**A fixed step manufactures a staircase.** On dead-flat land all three pads are naturally level, and adding 0.35 m per tee built a 0.7 m mound where there was nothing. It also tilted the **driving range**, whose three mats sit side by side at the same distance from the green and must stay identical — flatness there is not a preference, it is the whole instrument. The step is scaled by the spread the ground already has, so it corrects an inversion and never invents one. Both cases fall out of that single change rather than needing a range flag.

**And the sightline ray cut the dogleg corner.** It was drawn as a straight line in world space from the tee to a point on the centreline 250 yards out. Those are the same line only on a straight hole. On a dogleg the straight line leaves the corridor and reads whatever is out there — on the flat course it found the neighbouring hole's green standing 2.3 m proud of the plain and raised the tee by the full 3.5 m cap to see over it. Sampled along the centreline instead, which is what the test was actually asking about all along.

A third numerical trap in the same three lines: `h/(1−u)` goes to infinity as the sample approaches the target, so a 0.35 m ripple at *u* = 0.9 asked for ten times its own height. The scan stops at three quarters of the way out and the divisor is floored — ground that close to the landing area is the landing area's own contour, and no amount of tee clears it anyway.

### What it did not fix

The forward tee improves least: red is still blocked over 1 m on 12% of holes against blue's 3%, because the lift is computed for the whole complex and red sits lowest within it after the ordering. Lifting each pad independently would close that, at the cost of the complex no longer reading as one piece of ground. The 4% of red tees still blocked by more than 3 m are holes where the required lift exceeded the cap.

## Where generation actually spends its time

Measured with `node --cpu-prof` over five `generateWorld` calls, warm, on this machine:

| course | wall time |
|---|---|
| 18 holes, feature-heavy (260 trees/hole, homes, 2 rivers, 2 creeks) | 8.4 s |
| 9 holes, same features | 2.9 s |
| 9 holes, defaults | 2.4 s |
| 1 hole (an endless hole) | 250 ms |
| the driving range | 94 ms |

Inclusive time, as a share of everything sampled:

| phase | share |
|---|---|
| **`makeGroundGrid`** | **81%** |
| `routeHoles` | 2.7% |
| `generateStreams` | 2.3% |
| `generateCourse` (all holes) | 1.0% |
| `generateHomes` | ~0% |

Self time is spread thin -- no single function is over 12% -- because the cost is
`makeGroundGrid` calling `analyticHeight` (53% inclusive) for every cell, which
calls `shapedLand`, `nearest`, `greenContour` and the rest in turn. Vegetation
does not appear: placing 18,720 trees is cheap next to sampling the ground.
(These shares predate 28 September; the three biggest per-cell costs were cut
then -- see *The ground grid stops asking every hole about every point*.)

**This settles how to make generation yield.** The standing plan was to make
`generateWorld` a `function*` yielding phase labels, with the caveat that it
would be worth little if one phase dominated. One phase is four fifths of the
work, so yielding between phases would hand the browser a frame roughly twice in
eight seconds. The grid itself has to chunk -- it is three row-major loops over
the same `(nx+1) x (nz+1)` field, so a row band is a natural unit and the
arithmetic per cell is unchanged, which is what keeps the biome fingerprints
identical. A Web Worker remains the wrong tool: `generateWorld` returns closures
(`toWorld`, `height`, `surface`) that cannot cross the boundary.

## What it costs to let go of the thread

Generation yields by row band now, and the driver hands the browser a frame
whenever a budget's worth of work has gone by. Pacing is not free. Measured on
the 18-hole feature-heavy course, where the blocking work itself is ~7.0 s
however it is sliced:

| budget | wall @60Hz | overhead | wall @120Hz | pauses | longest block |
|---|---|---|---|---|---|
| 8 ms | 10.83 s | +55% | 10.34 s | 570 | 8 ms |
| 12 ms | 9.32 s | +33% | 8.79 s | 414 | 12 ms |
| **24 ms** | **8.65 s** | **+24%** | 7.16 s | 221 | 24 ms |
| 50 ms | 8.63 s | +24% | 7.73 s | 113 | 50 ms |

A pause costs most of a frame regardless of what it cost to earn, so halving the
budget nearly doubles the overhead. 24 ms is the knee: past it the total stops
improving and below it the price climbs fast. The usual reason to want a small
budget is input latency, and it does not apply — a full-screen overlay is up, so
there is nothing behind it to click. What the budget buys here is the animation,
and 24 ms still returns a frame about every 33 ms.

**A hidden tab is not paced at all.** Pausing exists to let the browser paint and
to keep controls alive; a background tab does neither, and it fires no
`requestAnimationFrame`, so every pause would fall through to its timeout and an
eight-second course would take minutes. Background timers are clamped too, so
there is no short sleep to fall back on. The driver checks `document.hidden` and
runs straight through, resuming pacing if the tab comes back.

**Nothing about the output changed.** All eight biome fingerprints are identical
across the conversion — the yields sit between rows, and every loop runs in the
same order over the same cells producing the same floats. The synchronous
`generateWorld` still exists and is what the tests, the bench and the fingerprint
tool call; it drains the same generator with nothing between the steps.

## The lift cap, and the carry that hid it

A hundred shots from a GC3 -- a photometric unit with a good reputation for accuracy -- replayed through the flight model. Carry came out within 1.4%. Apex came out low on **every single one of the hundred**, by 8% on average and 11 to 14% above 9,000 rpm.

That is not scatter. One hundred out of one hundred in the same direction is a mechanism, and the mechanism was a single constant.

### What was wrong

`AERO.liftCap` was 0.2913. Lift rises with the spin parameter S until it is clamped there, and the clamp binds from **S = 0.342** upwards. Half of that session launched already clamped: past that point the ball received no more lift however hard it was spinning.

**Carry concealed it, and that is the part worth remembering.** On the clamped half, carry was out by two thirds of a yard -- better agreement than the unclamped half managed. A ball with too little lift flies flatter, and a flatter ball also carries less induced drag, so the two errors very nearly cancel in the one number anyone checks. The first session against SkyTrak reported carry within 2% and called the model good. It was good, in carry. Nobody had asked it about height.

| | n | carry error | apex error |
|---|---|---|---|
| launching at the cap | 50 | +0.68 yd | **-12.0 ft (-11.9%)** |
| launching below it | 50 | +4.39 yd (+2.2%) | -4.1 ft (-4.3%) |

### The plateau was never physical

Bearman and Harvey measured CL rising monotonically to S = 0.3. Smits and Smith took the range to **S = 1.4** -- described as the conditions experienced when using the full set of clubs -- and found CL slightly higher again, with no plateau anywhere in it. The square root already in this formula supplies the diminishing returns a cap was standing in for.

So the cap is a guard rail now rather than a shaping term: 0.60, which S does not reach until about 1.55, past anything Smits and Smith measured and far past any golf shot. It exists so an absurd input cannot produce an absurd force.

Lifting it alone left the ball carrying 3.6% too far, so `spinDrag` moved 0.2025 to 0.23 -- **toward** the published figures rather than away from them. Bearman and Harvey's own numbers imply a slope near 0.25 (CD rising 0.27 to 0.32 as S goes 0.1 to 0.3) and Smits and Smith report a stronger dependence still. The old value sat below both.

### Fitted on one device, tested on the other

The GC3 session was fitted; the 36-shot SkyTrak session was held out and never entered the cost. Descent angle was kept out of the cost as well, as it always has been here, so it stays an independent check rather than a fitted output.

| over 100 GC3 shots | before | after |
|---|---|---|
| Carry | +1.42% | **+1.25%** |
| Peak height | **-8.05 ft** | **-0.22 ft** |
| Offline (MAE) | 0.56 yd | **0.21 yd** |
| Descent angle (MAE) | 1.33 deg | 1.49 deg |
| Hang time | +0.24 s | +0.71 s |

Carry, apex and offline all improve. Descent and hang do not, and both are recorded rather than buried.

### The two devices disagree, and this change picks one

GC3 says the model flies 8% low. SkyTrak said it flew 5.5% high, on an overlapping spin range, and this change widens that to 7.4%. They cannot both be right and no amount of fitting reconciles them. The GC3 is the better instrument and it is the one trusted here -- **that is a judgement about the references, not a measurement**, and it is the first thing to revisit if a third device ever lands on the other side of it.

Two things make the GC3 the stronger reference beyond reputation: it reports total spin and spin axis directly rather than leaving them to be derived, and its hang time is given to hundredths where SkyTrak's is whole seconds and so cannot grade anything.

### Why greens look flat, and what reads as shape

A green is the flattest thing on the course by design — that is what makes it
puttable — and every shading cue in the ground shader is proportional to slope.
So the one surface a player most needs to read has the least to read from.

Measured, as the brightness multiplier the shader applies across a surface:

| green contour setting | green surface | ordinary terrain |
|---|---|---|
| 0% | 0.000 | 0.240 |
| **35% (the default)** | **0.129** | 0.240 |
| 70% | 0.313 | 0.240 |
| 100% | 0.400 | 0.240 |

At the default a green gets roughly half the shading range the ground around it
gets. Raising the contour setting fixes the look and changes how the hole plays,
so it is not the answer.

### The cue the flat measurement hides

Total brightness variation is a poor measure here, because most of it is the mow
bands rather than the shape. Blurring the bands away first — a box blur wider
than the 3.2 m band period — leaves the part a player reads as three-dimensional:

| option | shape contrast | band strength | blind slopes |
|---|---|---|---|
| shipped today | 0.084 | 0.119 | 0% |
| **A** exaggerate the shading normal | **0.262** | 0.110 | 3% |
| B add slope-magnitude shading | 0.088 | 0.117 | 0% |
| D mow bands follow the contour | 0.082 | 0.119 | 0% |
| A + D | 0.261 | 0.110 | 3% |
| **A + D + softer bands** | **0.309** | 0.064 | 2% |

**A is the win: 3.1× the shape contrast.** It exaggerates the shading NORMAL
rather than raising the gain, which matters — gain multiplies the response and
clips against the clamp, so steep parts saturate while gentle parts stay
invisible; tilting the normal rescales the whole range instead.

**B was rejected by its own measurement.** The existing relief is
`dot(normal, a fixed bearing)`, so ground tilted across that bearing should in
principle produce no cue however steep. On real greens that case is 0% — the
concern is theoretical and does not occur, so the term buys nothing.

**D scores nothing on this metric by construction** — the blur strips exactly the
band signal D lives in — but it is plainly visible in a render, and it is the
cue with a real-world mechanism behind it. Softening the bands raises shape
contrast from 0.262 to 0.309, because a strong regular pattern is what the eye
locks onto first.

### The cue never reached the light, and then the toon ramp ate it

Everything else here **tints the grass**. The lighting was untouched, so a
green's undulation was described by an albedo shift sitting under full sun and
tone mapping. The first attempt tilted the normal the **lighting** uses, which is
the textbook fix — and in this art style it is a dead end.

The cartoon ground is a `MeshToonMaterial` with a **four-step ramp**
(90, 145, 205, 245), and three.js samples it at `dot(normal, light) * 0.5 + 0.5`.
Texel centres sit at 0.125, 0.375, 0.625 and 0.875, so anything past 0.875 is
**clamped flat**. A near-flat green under a sun above roughly 48° lands there.
Measured brightness across a green, out of 255:

| sun elevation | without the cue | with the normal tilted | |
|---|---|---|---|
| 20° | span 3 | span 17 | works |
| 35° | span 3 | span 14 | works |
| 50° | span 0 | span 5 | pinned |
| 65° | span 0 | **span 0** | pinned |
| 80° | span 0 | **span 0** | pinned |

So it only ever worked at dawn and dusk. This is not a defect — it is the art
direction, and the shader's own comment says so: the raking-light cue exists
precisely because "a two metre roll casts no shadow at all" at midday.

**The cue asks the question directly instead.** Rather than tilting the normal
and hoping the ramp responds, it computes how much *more* light the patch would
catch if the green were as steep as the exaggeration makes it look, and applies
that to the turf colour. It follows the real sun through the day and nothing
clamps it:

| sun elevation | tilting the normal | following the sun in the tint |
|---|---|---|
| 20° | 6.7% | **23.4%** |
| 35° | 5.5% | **20.1%** |
| 50° | 2.0% | **15.2%** |
| 65° | 0.0% | **10.5%** |
| 80° | 0.0% | **4.6%** |

At 80° it is inherently small: with the sun overhead, tilting a surface barely
changes how much light it catches. That is physics, not a shortfall.

### What shipped (superseded 30 September)

**Three of these five were removed on 30 September** -- measured at noon they
barely moved a green, and the owner found the set made greens look unreal. See
*Reading the ground, again*. What follows is the record of what was built and
why.

Five graphics settings rather than two, because the owner asked to tune them and
set the defaults:

| setting | default | what it does |
|---|---|---|
| Green definition | 35 | tilts the shading normal, bends the mow bands to follow the surface |
| Mowing band strength | 10 | softens the bands so they stop competing with the shading |
| Sunlight on contours | 20 | shades by how much more light the exaggerated surface would catch |
| Slope darkening | 70 | darkens by tilt regardless of direction |
| Band grain | 0 | makes bands view-dependent, as real mowing stripes are |

**These are the second set the owner chose, and they invert the first.** The
first pass ran everything near full (100 / 20 / 100 / 50 / 65). Sitting with it,
the owner pulled definition, sunlight and grain right down and pushed slope
darkening up past what used to be full strength. The shape of that answer is
worth more than the numbers: **the cue that carries the reading is the
direction-free one.** Definition, sunlight and grain all key off a fixed compass
bearing or the viewer, so they describe a green as lit from somewhere — raise
them together and a green reads as a lit object rather than a shaped one. Slope
darkening has no bearing at all: it answers "how steep is this, anywhere", which
is the question a player is actually asking. The bands are nearly off because
they are pattern competing with shape.

**These were chosen on screen, not derived from the measurements, and that is the
right order of authority.** The two cues that measured no benefit are on: "0% of
greens" was measured on this generator at the settings of the day, and the owner
could see something the number could not.

Slope darkening was rescaled so that **50 is what 100 used to be**, leaving room
above it. A saved record carries `greenReadGen`; raising it makes every existing
record adopt new defaults once, because otherwise a saved preference beats a new
default and the change reaches nobody who has already opened the panel.

**A slider reported the right number while nothing read it.** `greenBandSoft` was
declared, plumbed, exposed and reported back correctly for two commits — and the
one line in the shader that used it had been deleted, because removing a
neighbouring block took the span between two anchors with it. The value reached
the GPU and the picture never changed. `tests/green-cue-wiring.test.mjs` now
reads the shader source and fails if any cue uniform is never referenced.

## Course names: swept for trade marks, and grown by 24x

Two problems with one set of word lists.

**Six names were real golf destinations.** Bandon and Turtle Bay were default
biome titles; Bandon, Dornoch, Kintyre and Saguaro were in the generator. Swept,
along with the titles Bandon Ridge, Turtle Bay and Saguaro Dunes. The rule is
now a test with a denylist in it, and the denylist cannot be complete -- the
instruction that matters is to search a candidate word together with the word
"golf" before adding it.

**And there were not many combinations.** Measured before and after:

| | per biome | across all eight |
|---|---|---|
| before | 10 x 10 words, ~100 names | ~800 |
| after | 30 x 20-22 words | **19,440** |

The invariant that stops two biomes producing the same name is now kept by a
simpler mechanism than before: **every first word is unique to its biome**, so
the first-word intersection of any two biomes is empty and second words can be
shared freely. The previous lists let both halves overlap and "Cedar Hollow" was
reachable from two different landscapes.

The length check is exhaustive rather than sampled now -- every first word
against every second word against the longest suffix -- because a sample that
happens to miss the longest pair is not a check. Longest possible name:
"Salmonberry Crossing Country Club", 33 characters against a limit of 40.

## The fingerprint told us to bump the generator, and it was wrong

Renaming three biome titles moved three fingerprints, and the tool said what it
always says: output moved for an unchanged seed, so `GENERATOR_VERSION` has to
go up.

**Nothing had moved.** Verified by hashing only the generated ground -- terrain
height and surface on a grid, every tree, every rock -- across the title change:

| biome | ground-only hash before | after |
|---|---|---|
| pnw | 0c1a18a1a8c94a5b | 0c1a18a1a8c94a5b |
| desert | 10796c20155acceb | 10796c20155acceb |
| island | 23bcdbbede91d5c9 | 23bcdbbede91d5c9 |

The fingerprint hashes the biome RECORD as well as the ground -- deliberately,
since a palette is worth watching -- and then reported both through one number
with one instruction attached. It now reports them separately: a record change
says plainly that no bump is owed, and a ground change still demands one. Both
paths were tested by making each kind of change and reading what it said.

**An arbiter that cries wolf gets ignored the one time it matters**, which is
exactly the failure `GENERATOR_VERSION` exists to prevent.

## The tee boxes, and where a blind tee shot actually comes from

Reported from play: ground in front of the tee boxes blocking the view to the
landing area. Owner's instruction was to measure before changing anything, and
the measurement says the assumption is wrong.

**Every blind tee shot is caused by ground 96 to 190 m out.** Over 945 tee
shots on 35 courses, 25 have more than a metre of ground in the way, and the
median distance to the obstruction is 167 m:

| where the worst obstruction sits | shots |
|---|---|
| within 30 m | 0 |
| 30 to 80 m | 0 |
| beyond 80 m | 25 |

That is a blind landing area -- a rise where the ball comes down -- and no
change to a tee pad can touch it.

**The generator could not have told us, because its own sightline starts 12 m
out.** Nothing in the code has ever looked at the ground immediately in front of
a tee. A metric that inherits the blind spot of the thing it checks cannot
report on it, so `blind` now walks from 2 m at a 2 m step and records the worst
obstruction within 40 m separately. Measured that way, ground near a tee stood
above the sight line on **8 of 945 shots** and above half a metre on 3.

### What the three tee changes actually did

Swept rather than chosen. Shortening the pad and steepening the front were
asked for on their own merits; the numbers say what they bought.

| | before | after |
|---|---|---|
| pad length | 9.0 m | 7.2 m |
| shoulder reach directly ahead | isotropic | 35% shorter |
| pairs of tees in line | 110 / 945 | 10 / 945 |
| closest two pads sideways | 0.00 m | 3.24 m |
| ground within 40 m above the sight line | 8 shots | 2 shots |
| blind shots over 1 m | 25 | 23 |
| median distance a tee slid from where the hole put it | 22.1 m | 20.8 m |

**The stagger is the change that earned its place.** It was already a scoring
preference and it compared each site against the PREVIOUS tee only -- blue can
sit in line with red while white is in line with neither. Against every tee
already placed, with the worst offender deciding the penalty, in-line pairs fall
by a factor of eleven and cost 1.3 m of median slide.

**The front drop-off was swept and 0.5 was rejected.** At 0.5 the ground around
a pad steepens from a median 6.3 degrees to 10.1 and a p95 of 21.5, for no
further gain: 0.35 reaches the same 2 shots at a median of 7.8 degrees. The
smallest change that clears it.

**Shortening the pad and steepening the front did not move blind shots at all,
and were never going to.** 25 to 23 is noise on a cause 100 m away. Recorded
because a change that made no difference is a result.

## What was standing in a tee shot, and how it got there

Reported from play: tee boxes blocked by rocks, in mountain and desert. Those
are the two biomes with the most stones (500 and 550 against 160 elsewhere) at
twice the scale, which is the shape of the answer.

`tools/bench.mjs teeclear` calls the generator's OWN `blocksLaunch` and
`inTeeFan` against the finished world, rather than re-deriving either. On the
four quick-tier courses, before:

| | rocks in a tee shot | rocks in the tee view |
|---|---|---|
| before | 4 | 41 |
| after | 0 | 0 |

Three separate faults, all of the same shape -- a rule applied to one kind of
body and not another:

- a rock was tested as a POINT, with no width, while a trunk has always passed
  its girth. A stone is up to 1.65 of its scale across.
- its ceiling was `y + scale`, which is not its height. It is drawn up to 0.9
  scale above centre and sunk a quarter of it, so the crown is `y + 1.15 scale`.
- it never consulted the tee fan at all.

On the full tier with trees planted (35 courses, 45,909 trunks, 8,037 stones)
the same check found **154 trunks over the line** on the fan test, because trees
padded the corridor test by their girth and the fan test by nothing. Both are
padded now. The cost is 31 trees out of 45,909, and the tee surround holds at
0.45 to 0.89 of course average density -- no sign of the clear-cut this work
was originally about.

**A feature placed in the fairway on purpose is excluded from the count.** The
first version of the metric did not exclude it and reported four breaches that
were the setting working: a specimen obstacle at 95 m or more is the hole, and
it obeys its own standoff rather than the blanket rule. A metric that reports a
feature as a fault is the fifth in this project's history to lie about the thing
it exists to watch.

## The giant bush in the middle of the fairway

The specimen picker chose `bio.plants.find(k => !GROUND_PLANTS.has(k))` and fell
back to `bio.plants[0]`. Links grows gorse, heather and shrub -- all three are
ground cover -- so the fallback chose **gorse**, and the feature then sized it by
the biome canopy at 13 to 29 m. A gorse bush three times the height of a house,
standing in a links fairway.

Every other biome leads its list with a real tree (pine, cactus, spruce, oak,
palm, redwood, maple), which is why it survived. A biome with no tree species
now gets a rock instead. Measured on a links course at 100% feature occurrence:
19 feature rocks, 0 feature trees; on midwest, 5 oaks and no rocks.

## How un-round a green and a bunker are

Both outlines are a radius that varies with angle: the nominal size times one
plus a few harmonics. A green carries three (two-, three- and five-lobed waves),
a bunker two. Measured over 108 greens and 284 bunkers, the amplitudes were small
enough that nothing was really a shape — widest radius over narrowest, and a
"bend" figure that is non-zero only where an outline turns back on itself:

| | widest/narrowest | bend |
|---|---|---|
| greens | 1.15 – **1.24** – 1.40 | 0.00 everywhere |
| bunkers | 1.11 – **1.48** – 2.40 | 0.00 everywhere |

A circle is 1.00 and 0.00; an ellipse is its aspect and 0.00. So every one of the
392 shapes measured was a smooth oval.

### Scaling the drawn mix was tried first, and it looked wrong

The first version scaled all three harmonics together, on the reasoning that it
would keep each green's own character. What it actually kept was **which harmonic
dominated** — and the three-lobed wave is drawn from `.025 + rng*.075`, always
positive and the largest of the three on average. Measured: it leads on **69 of
81 greens**, with the biggest harmonic owning half the wobble. Amplifying that
gives a clean three-lobed flower, and a three-lobed flower stretched by a green's
aspect ratio is two round lobes at one end and a tapering shaft. It was rejected
on sight.

A first attempt to diagnose it also failed, and the reason is worth keeping: the
descriptor measured how far an outline differs from its own 180° rotation, which
**cannot see harmonic 2 at all**, since that harmonic is symmetric under exactly
that rotation. It returned identical figures for four very different mixes.

So the sliders do two things: raise the amplitude, and pull the harmonics toward
equal so none of them runs away with the shape. Equal thirds of a modest total is
an irregular outline; one harmonic holding all of it is a flower.

| slider | greens (median) | bunkers (median) | biggest harmonic's share |
|---|---|---|---|
| 0% | 1.24 | 1.48 | 50% |
| 30% (default) | 1.42 | 1.63 | 45% |
| 100% | 1.74 | 1.83 | 33% |

**Evening the mix costs range, deliberately.** The rejected version reached a
median of 2.45 at full against 1.74 here — but that extra range was the flower.

**Scaling happens at generation, not at read time, and that is the important
part.** The route texture packs whatever the hole carries and the hazard texture
packs whatever the bunker carries, so the painted surface and the lie the ball
gets come from one set of numbers. Scaling in the shader instead would have meant
the same arithmetic in two places, which is how the apron was once painted as
fairway and played as semi-rough.

A cap on the total wave amplitude — 0.34 for greens, 0.30 for bunkers — is what
keeps a radius safely positive: at the cap the narrowest point of a green is
still comfortably over half its nominal radius, so an outline can pinch without
folding through itself.

### What it costs: green surrounds get steeper

Shaping a green steepens the ground falling away from it, because the shoulder is
blended on the green's NOMINAL size and does not follow the outline — so wherever
a shaped green bulges outward, its shoulder has less room.

| | slider 0 | 30 (default) | 60 | 100 |
|---|---|---|---|---|
| default terrain, steepest | 0.570 | 0.709 | 0.800 | 0.806 |
| harshest terrain, steepest | 0.685 | 0.795 | 0.945 | 1.032 |

On the eight seeds the surround characterisation test uses, at the harshest
settings the game offers, the steepest goes 1.056 at slider 0 to 1.372 at the
default and 1.933 at full. That test was re-pinned, and the shoulder blending is
filed as the real fix.

## Planting density around tees, across the fairway width slider

Measured with `node tools/bench.mjs surrounds --set trees=65`, which reports the
trees standing within 20 m of a tee as a multiple of that course's own average,
counted per hectare of ROUGH — mown turf can never hold a tree, so including it
in the denominator makes a surround look emptier than it is.

The keep-out near a tee is compared against `nearest().d`, the distance outside a
hole's corridor **envelope**, and that envelope grows with the fairway. A floor
fixed at −20 m therefore held at the default width and fell apart at the top of
the range:

| fairway width | fixed −20 m floor | scaled to the hole |
|---|---|---|
| 20 m | 0.75 | 0.71 |
| 38 m (default) | 0.46 | 0.68 |
| 60 m | 0.48 | 0.60 |
| 92 m | **0.25** | 0.53 |

Scaled, the floor is three times the corridor's half-width at that point. Across
all eight biomes and the whole width slider the surround now runs **0.34 to
0.90** of course average, against 0.03 at its worst before:

| biome | 20 m | 38 m | 60 m | 92 m |
|---|---|---|---|---|
| pnw | 0.81 | 0.68 | 0.59 | 0.53 |
| desert | 0.80 | 0.45 | 0.47 | 0.39 |
| mountain | 0.66 | 0.75 | 0.80 | 0.83 |
| links | — | — | — | — |
| midwest | 0.75 | 0.67 | 0.76 | 0.61 |
| island | 0.47 | 0.52 | 0.34 | 0.54 |
| redwood | 0.90 | 0.83 | 0.54 | 0.72 |
| autumn | 0.69 | 0.72 | 0.70 | 0.45 |

**Links reports nothing, and that is correct.** It plants gorse, heather and
shrub — all ground cover, zero trunked trees — so there is nothing for a tree
rule to act on. The metric refuses to report rather than printing zeros, because
the first version of it did print zeros and tripped its own clear-cut invariant
on courses that simply had no trees.

Tee shots stay clear throughout: 0 of 648 blocked on the line the hole asks for.

## What "agreeing with a launch monitor" is actually worth

A launch monitor does not hand back a measured apex; it derives one, from what it
can see, through its own model. A photometric unit and a radar-assisted one start
from different observations and reach different numbers for the same shot, which
is exactly what these two sessions show -- one says the flight is low, the other
says it is high, over an overlapping spin range.

So there is no single correct figure to converge on, and a model that matched one
device exactly would be reproducing that device's algorithm rather than the ball.
**The standard here is reasonable agreement across devices, not exact agreement
with any one of them**, and the residual against each is reported rather than
tuned away. A third source (a Garmin R50 session) is expected; three makes the
spread readable, because with two that disagree there is no way to tell which one
is off. That will be the last fit, and it is not expected to be perfect.

### A second fault, uncovered rather than caused

Hang time went from +0.24 s to +0.71 s, and it sits between 0.5 and 0.7 s for **every** value of `spinDrag` tried. It cannot be tuned out from here, which means it is not the price of this change; it is a separate problem this change made visible.

Matching the GC3 on apex while overshooting its hang says our ball takes longer to fall from the same height than theirs does. That is the shape of the descent rather than its scale, and the descent angle running steep says the same thing from another direction. Reworking how drag varies through the descent is its own investigation and is filed as one.

### What it cost downstream, and what it did not

Two pinned test anchors moved, both for the same reason and neither because the bounce changed. `ARRIVAL` in the firmness tests is a 7-iron's own landing conditions, pinned precisely so that a flight refit does not read as a bounce regression -- and the test that compares flying the ball there against delivering it there is what caught the pin going stale, which is the job it was written for. Re-derived: 22.57 m/s and 49.06 degrees at touchdown, 5068 rpm from the last airborne sample, cross-checked against `6500 * exp(-5.971/24)` to the rpm.

Deriving it is a trap worth naming. The simulator applies the bounce impulse and records the result in the same step, so the first sample at ground level is already post-bounce -- velocity collapsed from 22.54 to 5.16 m/s and spin from 5068 to 796. Reading it gives a plausible-looking number that is wrong by a factor of six.

The bounce tables were then re-pinned at the new arrival, and what matters survived: hop height and run-out still rise monotonically from Soft to Burnt, hop still falls straight down the mowing height from green to sand, and fairway still runs longest. Not one bounce parameter moved.

Nothing in generation moved either -- all eight biome fingerprints are unchanged, because ball flight is not terrain.

## What a frame actually costs

`tools/bench.mjs` has always measured generation and said nothing about drawing. The only frame numbers this project ever had were taken by hand, with a probe pasted into `renderer.js` and deleted afterwards, on one machine, on one course -- and the first of them was wrong in the way that matters most. `tools/profile.mjs` is the standing answer: a headless Chromium driven from the command line, instrumented from outside the game.

### The harness had to prove itself before it was believed, and twice it failed

**A blank page read 17.3 ms.** `--disable-gpu-vsync` and `--disable-frame-rate-limit` do not unthrottle animation frames in headless Chromium; it paces them to a virtual 60 Hz display regardless. So the interval between frames is the display's, not the renderer's -- the identical trap that produced the dead forest, caught this time by a check that runs before any number is trusted and refuses to continue.

The fix is to stop measuring pacing and measure **work**: the time spent inside the frame callback, and a `TIME_ELAPSED` GPU query spanning the same callback. Neither can be padded by a wait for the display, and both collapse to 0.000 ms on an idle page, which is what the check now asserts.

**Then low and medium measured identically.** Same triangles, same time, to three figures. That was the harness again: `applyQuality` does `setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio))`, and headless Chromium reports a device pixel ratio of 1, so low (1), medium (1.75) and ultra (2) all clamped to 1 and drew exactly the same pixels. The tiers' single biggest fill lever was absent from the measurement. Playwright's `deviceScaleFactor` fixes it.

**And the GPU is not the GPU unless you ask.** With default flags, headless Chromium silently uses SwiftShader. `tools/gpu-probe.mjs` exists to print the renderer string for each launch configuration, because a frame time from a software rasteriser answers a completely different question and looks exactly the same on the page. The real card also reports `MAX_TEXTURE_IMAGE_UNITS` of **16** where SwiftShader reports 32 -- which independently confirms the ceiling the floodlight-shadow comment describes.

Three measurement errors, all of the same species: a number that looked plausible and described something other than what was asked. That is now six in this project, and the pattern has never varied -- a filter, a clamp or a default that is reasonable in general and excludes exactly the case under test.

### What the frame is actually spent on

Measured on an RTX 4090, redwood, player view, 300 frames a case.

**CORRECTED 28 September: every number in this table was taken with a probe
that counted each frame twice** (*The profiler counted every frame twice*, at
the end of this file). The draws and triangles are HALF the true figures --
Redwood on High draws about 180 M triangles a frame, not 92.9 M -- and each
"GPU ms" is close to the FASTEST frame rather than the median. The ratios
between rows are roughly right, because every row was wrong the same way; the
conclusions below are marked where the corrected probe disagrees.

| tier | GPU ms | draws | triangles |
|---|---|---|---|
| low | 4.52 | 168 | 46.5 M |
| medium | 6.46 | 168 | 46.5 M |
| high | 12.66 | 289 | 92.9 M |
| ultra | 11.42 | 235 | 69.7 M |

**It is geometry, and it is almost entirely one biome.** Redwood draws 92.9 M triangles (truly about 186 M) where every other biome draws 3.1 to 4.6 M (truly 6-9 M) -- twenty times the load, for 12.66 ms against about 4. The grown grove is the whole story, exactly as the LOD removal predicted it would be on hardware that could not absorb it.

**Shadow cascades double it.** Medium has none and draws 46.5 M; high has three and draws 92.9 M for the same scene (truly 93 M and 186 M; the doubling stands). Each cascade re-renders the casters.

**Pixel ratio is real but secondary.** Halving it on high gives back 26% (12.72 to 9.36 ms), which matters and is nothing like the 20x that content does.

**Every ground-cue toggle is free.** Terrain shadows, relief shading, slope tint and mowing stripes each change the frame by under 0.05 ms -- inside the noise. They are arithmetic on values the shader already has, exactly as their comment claims, and they can stay on at every tier.

**And the reflections toggle does nothing at all.** On a course covered in water: 208 draws with reflections on, 208 with them off, 4.72 ms against 4.69. `setReflections(false)` nulls the `envMap` on each water material, which stops the sampling and does not stop the pass. The user-facing switch buys a change in appearance and no time whatever.

### A machine with no graphics card cannot run this at any setting

The software arm is the only one on this hardware that can fail. It does, by two orders of magnitude.

| case | frame interval | budget |
|---|---|---|
| low, software rasteriser | **3,034 ms** | 33.3 ms |
| medium, software rasteriser | 3,357 ms | 33.3 ms |

Three seconds a frame. A third of a frame per second, against a target of thirty. Retuning moved it 6%.

Two honest qualifications. SwiftShader is a pure-CPU rasteriser and is the floor, not a typical weak device -- real integrated graphics is perhaps one to two orders faster, which would put low somewhere between thirty and three hundred milliseconds and is the difference between playable and not. That range is an extrapolation and not a measurement, and the harness cannot narrow it without the hardware in the room. What it can say without hedging is that **tuning cannot close a hundredfold gap**, and that the in-callback CPU measure reads a flattering 2.6 ms for these same frames, because a software rasteriser does its work off the main thread after the callback returns. Only the interval sees it, and the interval is only meaningful when the renderer is slower than the display -- which is precisely this arm and nothing else.

### What was retuned, and what could not be

Low spends where a weak device loses time: pixel ratio to 0.75, so it draws smaller than the display and upscales, which is what phone games have always done and the only fill lever left once the ratio is already 1; shadow map to 512; anisotropy to 2; reflection buffer to 256, since the pass cannot currently be stopped. Medium was not touched -- `graphics.js` states outright that it is the frozen historical baseline.

Ultra was high with a glow on it: bloom, a bigger reflection buffer and overview shadows were the entire difference and measured 12.64 ms against high's 12.69. It now has half again the shadow texels (6144) reaching a kilometre further (3500 m).

**It also came out faster than high, which was not the intention -- and the corrected probe does not reproduce it.** On 28 September, fixed probe, the same sweep gave Ultra 15.17 ms against High 14.35, on the same 158 M triangles each; the finding below was probably the old probe's fastest-frame reading, not the frame. As first recorded: 11.42 ms against 12.66, on 69.7 M triangles against 92.9 M. Spreading three cascades over a longer distance moves the split planes apart, and fewer casters straddle two cascades and get drawn into both -- draws fell from 289 to 235. Better looking and cheaper, discovered rather than designed, and the only reason it is known is that the run was measured afterwards rather than assumed.

**A fourth cascade was considered and rejected on the file's own evidence.** Three already spend fifteen of the sixteen texture units the real GPU reports, alongside the toon gradient, the environment map and the ground atlases. A fourth would take the last unit or overflow it, and a program that fails to link draws nothing -- which is exactly how floodlight shadows came to be off on every tier.

**What could not be retuned is the thing that matters.** No tier knob touches vegetation. `grass` scales scatter grass, under 1% of the triangles on redwood. `foliage` sets the segment count of *drawn* trunks and canopies, so it does nothing at all on a biome whose plants are instanced mesh models -- which redwood now entirely is. And a tier may not simply plant fewer trees: `graphics.js` forbids affecting a played surface and trunks are collidable, so two players on different tiers must hit the same trees. The only legal lever is drawing fewer while colliding with all, which is a draw distance the renderer does not have. Filed, with the rest, in TODO.

## Is JavaScript the right thing to build this in?

Asked on 2026-09-20: keep going in JS, or port to a more efficient and robust engine later. Written down because the answer turns on measurements this project already has, and because "port it to a real engine" is the kind of decision that gets made on a feeling and is then very expensive to unmake.

**Short answer: stay. The efficiency premise does not survive the project's own numbers, and the thing a port would cost is the thing the product is.** But the honest version has conditions attached, and one of them is close enough to be worth watching.

### The efficiency case is already disproved, by this project, this week

The whole reason a level of detail was removed from the redwood biome is the measurement above: a grown grove draws **33.6 million vertices and 98 million triangles a frame and still holds the 120 Hz cap**. Instanced vertex throughput on this path is close to free. A renderer with that much headroom is not the thing holding the frame back, and moving it to another language cannot speed up a wait for the display.

That matters more than it sounds, because it is the exact argument a port usually rests on. "It would be faster in a real engine" is an assertion about a bottleneck nobody has located. This codebase has already been burned by that once, at the cost of a forest that looked dead.

**What IS slow is generation, not drawing.** The bench builds twelve courses in 8.4 s of wall time across twelve workers, from about 83 s of single-threaded work -- roughly seven seconds a course. That is real, it is felt when a course is grown, and it is pure arithmetic in one thread. It is also the one part a port would genuinely help, and the one part that does not need a port to fix: it is already parallelised across workers in the bench, and the hot paths are numeric loops that WebAssembly takes without disturbing anything else.

### What a port would cost, which is more than it first appears

**The deliverable is the product.** `dist/index.html` is one file, 15.8 MB, that opens by double-clicking with no install, no account and no internet. That is not a packaging detail, it is the thing that makes it possible to hand the sim to somebody. No general-purpose engine produces that artefact. Web exports from the big engines ship a runtime alongside the content, want a server, and are markedly larger; native builds are a download and an installer. Whatever is gained in frames is paid for in "can you just try this".

**446 tests run headless in about three minutes.** They cover physics, routing, water, greens, scoring and generation determinism, in a plain `node --test` with no display and no engine harness. Two of the most valuable tools in the repository -- the biome fingerprint and the bench -- exist because hashing what a generator produces and diffing it is trivial when the generator is a function you can import. Inside an engine, the same discipline is possible and is an order of magnitude more work to arrange. **A port does not carry the tests across; it carries the code across and leaves the tests to be rebuilt.**

**Determinism is load-bearing here and is a hazard in engines.** Seeds reproduce byte-identically -- proven by delete-and-regenerate hashing, and by a fingerprint that has caught unintended cross-biome movement several times in this repository's short recorded history. Engines encourage using their physics, and engine physics is the usual place determinism goes to die. The ball flight model is a custom integrator validated against a launch monitor at under 2% carry error with zero mean descent bias; handing that to a middleware solver would throw away the one number this project has that is checked against the outside world.

### Where "robust" is a fair criticism, and what it actually points at

The efficiency argument does not hold. The robustness one partly does, and it points somewhere cheaper than an engine.

`main.js` is over three thousand lines of very long lines, and nothing in the project is statically typed. The bugs this session produced are the signature of that: a wind bearing subtracted the wrong way round, a `project` used where it was unsafe, a scorecard preview that would have silently used default dogleg settings, two seeded generators that had to be proven identical by running twenty thousand draws through both. **None of those are problems an engine solves. Most of them are problems a type system either catches or makes obvious.**

If the goal is robustness, TypeScript is the move, and it is a fraction of the cost of a port -- incremental, file by file, with the tests as the safety net and nothing about the deliverable changing. That is the honest answer to the half of the question that has a real complaint behind it.

### The condition under which a port becomes right

There is a trajectory here that changes the answer, and it is already partly built: `parseLaunchMessage`, the GSPro Open Connect handling and `bridge/server.mjs` point at a simulator-bay product rather than a browser toy. If that becomes the main use -- a dedicated machine, a projector, a launch monitor, multiple displays, hardware latency budgets, photoreal ambitions -- then the browser stops being an advantage and starts being a constraint, and native becomes a reasonable conversation.

Even then the first step is not an engine. It is a desktop shell around what exists -- Tauri or similar -- which keeps every line of code and the whole test suite and buys the file system, real windows and no browser chrome. That is a weekend, not a rewrite.

### The order to do things in, if performance ever does bite

1. **Find out what actually binds the frame.** It is not vertices; that has been measured. Draw calls, shadow passes and fill are the candidates nobody has ruled out. This is the step that was skipped last time and it cost a fortnight of the wrong work.
2. **WebGPU before rewriting anything.** If the renderer turns out to be the limit, the API is a bigger lever than the language.
3. **WebAssembly for generation** if seven seconds a course becomes intolerable. Targeted at the numeric loops, leaving everything else alone.
4. **A desktop shell** if the product becomes a sim bay.
5. **An engine port** only if 1 through 4 have been done and something still does not fit -- which, on current evidence, is not the situation.

### The thing to be most careful about

The pull toward a port is strongest when a codebase feels unwieldy, and this one does in places. But "this file is three thousand lines" and "this language is too slow" are different complaints that feel identical from the inside, and only one of them is true here. A rewrite would answer the false one at enormous cost and leave the true one exactly where it is -- because the new codebase would be written by the same hands, under the same time pressure, without the 446 tests that currently stop it going wrong.

## A par 5 is not 723 yards

Reported from a generated course: a 723-yard par 5, on a card whose par 4s averaged under 400. Both halves of that sentence are the same bug seen from two ends.

### What the numbers were

Each hole took a base length by par -- 165, 385 or 545 -- jittered by a quarter either way with nothing bounding it, and then every hole on the course was multiplied by one factor to hit the requested total.

Nothing clamped a hole, so a par 4 ranged 289 to 481 before the rescale touched it. And because the rescale was **uniform**, a hole that jittered long raised the total, which lowered the factor, which shortened every other hole. The monster par 5 paid for itself out of the par 4s.

Measured over 400 seeds a length, against the USGA's own guideline for what may be called that par:

| requested | outside the guideline | worst par 5 | worst par 4 |
|---|---|---|---|
| 6,200 | 2.0% | 714 | 504 |
| 6,800 | 2.7% | 738 | 523 |
| 7,400 | 11.9% | 803 | 569 |
| 8,000 | 27.0% | 868 | 615 |
| 8,460 | 38.3% | 918 | 650 |

At 7,400 yards -- an ordinary championship length -- one hole in eight was already illegal.

### What the guideline actually says

The current USGA guidance (2020) is deliberately **overlapping**, because par is assigned on *effective* playing length rather than measured yardage: for men, par 3 under 260, par 4 240 to 490, par 5 450 to 710, par 6 over 670. An older non-overlapping table (250 / 251-470 / 471-690 / 691+) is still widely quoted and is what most secondary sources reproduce; both agree that 723 is not a par 5.

Those are the limits of what may legally be *called* a par, not a description of golf. A 700-yard par 5 is a par 6 waiting to be reclassified and a 240-yard par 4 is a par 3 with ambitions, so the bands used here are tighter than the guideline where the guideline is absurd:

| par | min | typical | max | guideline |
|---|---|---|---|---|
| 3 | 120 | 175 | 250 | under 260 |
| 4 | 300 | 410 | 490 | 240-490 |
| 5 | 470 | 540 | 640 | 450-710 |

At par 72 those maxima total 8,460, which is exactly the top of the course-length slider, so the full range stays reachable.

### Water-filling, not rescaling

Every hole starts at a typical length for its par, jittered within the band, and then the shortfall against the target is handed out **in proportion to the room each hole has left**. A hole near its ceiling absorbs almost none of an increase; one in the middle takes its share. Repeat to mop up what clamping refuses, and stop when every hole is against a stop -- at which point the target is not reachable with this par mix.

The jitter is asymmetric because the bands are: a par 4's typical sits 110 above its floor and 80 below its ceiling, and scaling one span by the other's width pushes it out on the narrow side every time.

Measured after: **0.0% outside the guideline at every length**, and the requested total hit exactly wherever the bands can reach it. At the very top the course comes up 44 yards short and says so -- `yards` is what the course measures and `requested` is what was asked for, because a slider bottoming out should be visible rather than met by inventing distance.

### The mix was drawn flat

Every combination in the list adds up to the right par, and they are not equally like golf. At par 72 the list runs from eighteen par 4s to six of each, and a flat draw picked the eighteen-par-4 course as often as the ordinary one. Weighted toward a fifth of the holes at each par, 4/10/4 now comes up 49% of the time and 9-hole courses land on 2/5/2 at 57%.

### The nines

Seeding always drove par order -- it was a seeded shuffle -- but a shuffle stacks both par 5s on the front often enough to notice. Each count is split as evenly as it divides, the odd hole going to a side the seed picks so it is not always the front, and then each nine is hill-climbed against a badness score that costs back-to-back 3s and 5s double what it costs opening or closing on a par 3. Bounded iterations from the same seeded stream, so it stays deterministic. Adjacent short-or-long pairs: 0.09 per course.

## One hole skeleton, shared by the card and the course

A scorecard before the course exists needs the real yardage off each tee, and the wrong way to get it is a second copy of the arithmetic that agrees until someone edits one of them.

`holeLine` is the hole's skeleton -- green size, the playing line, the length after the dogleg, where the tees sit and what each measures -- moved into `course-plan.js` and called by `generateCourse` and `planScorecard` alike. It consumes a **contiguous prefix** of the hole's own seeded stream; the builder calls it first and carries on with the same generator. The tee draws moved up into that prefix, because they used to sit after the fairway edges and a card cannot reach them without replaying edge generation it has no use for.

Checked against the thing it has to agree with: 324 tee yardages across eight courses, worst difference 0.499 yards, which is the card rounding to whole yards.

**There were two seeded generators.** `course.js` and `course-plan.js` each had one, written differently and producing identical streams -- proven over 20,000 draws before collapsing them into one. A card computed from one and a course grown from the other is a bug waiting for whoever edits either, and "two implementations that must never diverge" is not a promise anyone can keep.

## A pond whose middle stood above its own surface

Turned up when the new hole lengths made channels terminate in hollows far more often: 8 sink ponds across 48 worlds became 18, and one of the new ones reported as water while its centre sat four metres **above** the water plane.

Diagnosed rather than assumed. The basin is carved, correctly, eight metres off centre. `fitPondBasin` pulls the water level down to the lowest ground around the pond's outer transition -- deliberately, so a lake is never perched over its own downhill bank -- and on sloping ground that sets a plane deeper than the pond digs. A 24 m pond on 5.5 m of fall, digging 1.6 m, cannot reach it. The spread guard inside the fit cannot catch this, because it weighs the fall against a fixed 9 m without knowing how deep the pond is.

The guard asks the question that matters -- can this pond's deepest cut get its middle under its own surface -- and drops it if not. A channel that would have filled it fades out instead, which is already one of the two endings a sink is allowed.

**It lives in `sinkPond`, not in the shared fit.** Tried there first: it took lakes and ordinary ponds with it, which reach their water by other means and were not asking, and three more tests went red. Sink ponds land back at 6 across 48 worlds, against 8 before this branch.

## A test that was only ever testing its seed

`green surroundings have a broad transition instead of a narrow ridge` asserted that one seed's worst green surround measured under 0.6, and it passed because SHOULDERS came out at 0.582.

Across eight seeds on the same settings, the **old** code gave 0.582, 0.706, 0.597, 0.872, 0.676, 0.620, 0.588 and 0.647. Most were already over the line. The 0.6 was never a property of the generator; it was a property of the seed that happened to be written down, and the test was giving assurance it had not earned.

It samples eight seeds now and is labelled a characterisation test, pinned to what the generator measurably does so it catches a regression rather than a reshuffle. The intent -- a broad shoulder rather than a ridge, on the steepest settings the game offers -- is real, is not met, and is filed rather than quietly relaxed.

## Two bearings that agreed with each other and disagreed with the screen

The wind dial was turned by the wind bearing alone, so it pointed the same way whichever direction you faced. That is a weather report, not an aid: the number a golfer wants is how the wind lies against the shot in front of them. Subtracting the camera heading makes it screen-relative — straight up is wind going away from you, right is a crosswind running left to right.

It was subtracted the wrong way round, and the reason is worth keeping.

Both bearings are `atan2(x, z)`. They agree with each other perfectly, which is what made the mistake invisible. But that convention runs **counter-clockwise on screen**, because looking along +z puts local +x on the *left* — the same fact `mapPoint` is built on and documents in its own comment. CSS `rotate` is clockwise. So the arrow was mirrored, and turning the camera swung it the wrong way, which reads exactly as an arrow following the camera rather than holding still against the world.

**The obvious check cannot fail.** Wind straight downrange with the camera looking downrange is zero either way round. Any test written against the easy case passes on both the right answer and its mirror; the error only appears once the camera leaves that axis. A sign convention needs a case where the two candidates differ, and picking one is the entire test.

## The hole map was sitting on paper

Two complaints, three causes.

**The white surround.** `mapWater` is the colour *beyond* the generated land — sea on the island biome, a pale `#e0e5d5` on the other seven (a dark `#1e281c` since round 13, 17 October 2026: the big map in the studio showed the pale surround as wide white bands beside the course; PLACED, to sit with the 1.0 panels) — and it is laid down as the base coat for the whole canvas. On the full-course map the terrain tile paints over all of it, so that pale default only ever showed outside the world rectangle and nobody looked twice. Hole view draws no such tile, so the base coat *was* the surround: a hole on paper, ringed in near-white. In hole view it is the biome's own rough now, with a `mapGround` override for a biome that ever wants something else.

**The green went soft at high resolution**, and that was two things stacking. The contour tile is baked at 96x96, which is generous at hole scale where the green is a smudge and about four screen pixels per texel once the map frames the green; it is 256 there, built once per green and cached. Underneath that, the canvas backing store was hardcoded at `clientWidth x 2` rather than the display's own ratio, so anything sharper than 2x was already being upscaled by the compositor before the tile was magnified on top of it. Device ratio now, capped at 3. `mapPixels` divides by whatever ratio it finds, so pointer input followed without a change.

## The green, as a state the whole HUD reads

Three things key off one question — is the ball on the putting surface — and `localSurface` answers it exactly: it returns `'green'` when `greenDistance <= 0` and not otherwise, so `surface === 'green'` already *is* the strict test. A second `greenDistance` check elsewhere in the file was testing the same thing twice.

**The putter** was chosen by `surface === 'green' || d < 18`. That second clause handed you a putter from eighteen yards out — in the fringe, off a bank, out of a greenside bunker, anywhere at all so long as it was close. Gone. Short shots off the green now auto-pick the shortest club at full power, which is what the game has always done between 18 and 65 yards; the behaviour is not new, it just reaches further down. **Still open**: power should scale to the distance rather than defaulting to 100%.

**The pin comes out** -- since 15 October 2026 attended rather than gone: it stands in the cup while the putt is lined up and is lifted as the ball comes within about 3 m (the owner) -- which is what happens on a real green and takes the one object standing between ball and cup out of the read. The cup, its liner and the floor are separate objects and stay — it is the flagstick that goes, not the hole.

**The marker therefore names the hole**, and stops being a thing that floats over a flag and drifts off the edge. It clamps to the screen and points at the cup -- with a notch that orbits its ring, while the flag icon inside stays upright. It used to rotate the whole circle, which turned the flag upside down whenever the cup was below or behind the view (fixed 9 October).

That needed a marker projection of its own. `project` reports whether a point is within the depth range and says nothing about the sides — and behind the camera it is worse than useless, because the perspective divide is by a negative w, so both axes flip and the marker lands on the *opposite* side from the thing it marks. `projectMarker` reads front-or-behind from camera space, mirrors the flip back, clamps, and reports the screen bearing.

**It clamps to a measured rectangle, not an even inset.** An even margin assumes the four edges are equally free and they are not: on a laptop the left of the screen is the shot panel and the right the camera strip and the hole map; on a phone the panel, the map and the aim pad share the bottom. So a panel running most of the height is kept BESIDE and a panel along the bottom is kept BELOW -- treating a phone's panel as a side squeezed the markers into a sliver beside the map. The panels are draggable and resizable, so the rectangle is measured rather than tabulated, twice a second rather than per frame — `getBoundingClientRect` forces layout, and a panel that was just dragged can wait half a second to be noticed. It never gives up more than a third of the screen to a side, or half of it to the foot, because a marker squeezed into nothing is worse than one overlapping a panel. And it pushes out from the rectangle's *own* centre: through an off-centre rectangle, the screen centre lands short on one side and past the edge on the other.

## Debris that is carried rather than fired

The wind motes travelled in exact parallel lines at one speed, which reads as a texture being scrolled past the camera. Each one now has its own sway rate, bob rate and a little spread in how hard the wind pushes it.

The sway is a sideways **velocity** that swings through zero, not a position offset. Integrating a bounded oscillation gives a bounded weave across the airflow; adding an offset directly would let a mote settle permanently downwind of its own path. The perpendicular is taken from the wind vector itself, so the weave stays square to the airflow however hard it is blowing.

They have tails now as well. `gl_PointCoord` is screen space and axis-aligned, so a sprite cannot work out which way it is travelling — but the wind is one vector for the whole scene, so resolving it onto the camera's right and up axes once a frame gives every particle its screen direction from a single uniform. The shape is a semicircular head with a taper behind it, and it is deliberately **shape rather than an alpha gradient**: these sprites are a few pixels across, a gradient over that is invisible, and it would need a second injection point into three's fragment chain for nothing.

One known inconsistency: the tails point along the mean wind while each mote now wobbles slightly off it. Fixing that needs a per-particle direction attribute, and at this sprite size it has not been worth one.

## An aim line that belongs to the surface it is drawn on

A full shot's aim line is lifted 100 mm so it clears the ground it crosses: it describes a ball about to be in the air, and the ground in between is not the subject. `setAimPath` — the breaking-putt preview — inherited that number, and a putt is the opposite case. The line *is* the green. At 100 mm it floated two ball-heights up and appeared to leave from the top of the ball.

15 mm now, and the exact number is the point: the ball's centre sits one radius up at 21 mm, so 15 mm passes below its equator and the ball sits **on** the line rather than hanging off it. Flat on the surface would have looked painted on and left the ball floating above its own line. There is nothing to z-fight with either — the putting rings are already at 25 mm and the lie scatter at 35 mm.

## The flight model against a launch monitor

Thirty-six shots from a SkyTrak skills assessment (the owner's own export, pages 7 to 11, with the ball data extracted to `sources/skytrak-36-shots.txt`, kept locally and not in the repository since 3 October 2026; the export itself was deleted, and the extract is everything that was used from it) replayed through `simulateShot`, fed through the same conversion `parseLaunchMessage` uses for a live monitor: ball speed in mph, total spin as `hypot(back, side)`, spin axis as `atan2(side, back)`. The model was told nothing about which club was swung.

One note on the extraction, because it nearly poisoned the whole comparison: `pdftotext -layout` scrambles several of these tables, shuffling carry and offline between rows. `-table` reads them correctly. The parsed values were checked against the sheet's own per-target AVG rows -- nine targets by fourteen fields, zero mismatches -- which is the only reason to trust any of the numbers below.

| field | mean error | typical miss |
|---|---|---|
| Carry | −0.5 yd (−0.4%) | 2.9 yd (1.9%) |
| Descent angle | 0.00 deg | 1.40 deg |
| Apex height | +0.9 yd | 1.33 yd |
| Offline | +0.7 yd | 1.36 yd |

Carry is unbiased at under 2%, and descent angle — the one quantity that was never fitted to anything — averages exactly zero error. Offline holding to a yard and a third across shots straying up to 50 yards off line is the spin-axis handling being right.

**Four things limit what this proves.** SkyTrak measures ball speed, launch and spin optically and then *simulates* the flight itself, so this is model against model over shared measured inputs, not against ground truth. The export names no altitude or temperature, and across a plausible range the mean carry error moves from −1.2 to +1.0 yd, which contains the −0.5 yd bias. The sheet reports flight time in whole seconds only, so a 0.38 s typical miss is smaller than its own step size and that column cannot grade anything. And it is irons and wedges at 78 to 139 mph ball speed — no driver, so the high-speed end is untested.

**Roll and total are not a verdict**: the model's balls landed on a driving range, 23 of 36 in rough, and SkyTrak applies one assumed surface. Validating roll needs data with a stated landing surface.

Where the two disagree it is not random. Above a 13-yard apex the mean carry error is 0.00 yd; below it the model is 2.1 yd short, and the three worst shots are all low-launch long irons where SkyTrak reports carries that look long for the trajectory — 192 yards off an 11-yard apex, against our 183.

## The grove is grown now, and the level of detail it "needed" was imaginary

Every plant in the redwood biome comes from `tools/grow.mjs`. No borrowed crown, no drawn cylinder, no pack model. The mix went from three species and a christmas tree to nine:

    redwood .25   fir .13   hemlock .07   redcedar .07 (45% height)
    tanoak .05 (18%)   seedling .05 (4.5%)
    swordfern .19   salal .11   sorrel .08

On a nine-hole course that is 538 redwoods, 227 firs, 134 hemlocks, 157 cedars, 103 tanoaks, 115 seedlings and 949 plants on the floor -- **5.0 tall conifers per hectare**, which is where the literature puts old growth.

### The arithmetic that forced work nobody needed

Drawn at full detail the set came to 25 million vertices against the 3.7 million the whole course cost before. That number was frightening enough to act on, so every expensive species got baked twice, `Redwood_Giant_1` beside `Redwood_Giant_1_Far` at a twentieth of the vertices, and `view.clearCameraTrees` swapped them by distance.

It worked, and it was the wrong thing to build, and the owner is the one who noticed: *"the pop in is crazy. And the trees dont look lush at all. It looks like the forest is dead. Have we really benchmarked the full LoD on everything and proven its not achievable?"*

No. There had been arithmetic, not a benchmark.

### The benchmark that was also not a benchmark

So it got measured: time the render call, once with the swap on and once with every tree at full detail.

    level of detail on    1.0 M verts drawn     8.6 ms
    everything full      11.1 M verts drawn     9.1 ms

Half a millisecond for eleven times the geometry -- which reads as a real if trivial cost, and is nothing of the kind. **8.33 ms is the vsync interval on a 120 Hz display.** Both numbers were the monitor. The renderer was sitting in the driver waiting for the next refresh, and a timer wrapped around that wait can only ever return the refresh rate no matter what it is asked to draw. The measurement was incapable of reporting "free", which is the answer.

This is the sixth metric in this project to answer a different question than the one asked, after a UV-basis check that skipped exactly the degenerate triangles that were the bug, a pixel check that filtered for brown on grey bark, and an anisotropy score that called a stretched row "vertical". They fail the same way every time: a filter or a clamp that is reasonable in general quietly excludes the case under test. **Before trusting a number here, check that it is able to move.**

### What the honest measurement says

Frame pacing across 240 frames, against the scene's own vertex count rather than a wrapped timer:

    33.6 M vertices, 98 M triangles submitted per frame, 117.6 fps

Still pinned to the 120 Hz cap, with the whole forest at full detail and the foliage half again denser than the version that shipped the LOD. Instanced vertex throughput is close to free on this path; the frame is bound by something else entirely. The swap bought nothing measurable and cost the only thing that showed -- at any moment nearly every visible tree was the thinned twin, so the forest looked dead, and the boundary popped.

All of it came out. The generator still bakes the `_Far` twins and they are simply not ingested, one `PICK` entry away if weak hardware ever wants them.

### The forest looked dead for a second reason

The palette was measured off 315 photographs by clustering their greens and taking the dominant cluster. The dominant cluster in a photograph of a grove is `#323b23`, because **most of a photographed grove is in shade**. Taking the largest cluster as "the colour" paints every leaf the colour of a shadow, and then the sim shades it again.

The measured range runs `#323b23` to `#5f6d44` to `#798962` to `#9baf87` to `#bdce97`. Canopy foliage moved from the first of those to `#62784a`, understory to `#6b9046`, saplings to `#83ad55`. The renderer does its own shading; what it wants handed to it is the **lit** leaf, not the average one.

Density went up with it, since the vertex budget turned out not to exist: whorls 16 to 24, sprays 3 to 4, fern fronds 10 to 14, sorrel 16 to 26 plants a clump. A giant redwood is 27,304 vertices now against 11,460.

### What came out

`addTallConifers` is gone: 121 lines that drew a tapered cylinder and balanced a borrowed conifer crown on top. It existed only because no pack contained a bare-boled giant. So are the pack's logs, stumps, mossy rocks and the MegaKit fern -- the grown nurse log has moss only along its upper flank, the grown stump has root buttresses, and the grown fern is a shuttlecock of once-pinnate fronds rather than a generic leafy plant.

The build goes from 2.78 MB to **15.79 MB**, which is the part that does not matter.

### One thing the tests caught

The LOD work made `addVegetation` settle the near/far split as it built, which meant calling the camera-move handler directly -- and the vegetation tests build a view with **no camera**, because they only ever look at geometry. Three tests went red on `view.camera.position`. The handler returns early without a camera, and that guard stayed after the LOD left, because hiding the tree the camera stands inside still needs one.

## A grove grown from nothing, against 315 photographs

`vendor/grown-redwood-forest` holds 153 models -- trees, shrubs, ground cover, dead wood -- with **no imported vertex, no texture, and no generator library**. `tools/grow-lib.mjs` is about four hundred lines of triangles and `tools/grow.mjs` is the catalogue. The photographs decided the proportions; nothing was copied from them.

### Measuring 315 pictures

Search on Commons kept returning the same grove shots and gave *nothing* for the understory, the deadwood or the floor -- which is most of what a grove looks like at eye level. Categories fixed that. 315 images: 99 understory, 70 grove, 37 deadwood, 34 trunk, 24 canopy, 19 hemlock, 17 fir, 15 cedar. Provenance in REFERENCES.md, fetcher in `tools/fetch-references.py`.

Then two kinds of analysis, because they answer different questions.

**Statistics, on all 315.** Decoded in a browser canvas and clustered, per subject: dominant colours, mean saturation and value, and how much green sits in each sixteenth of the frame from top to bottom. That last one turned out to be the species test:

    grove       green by height, top to bottom   3 3 3 3 3 3 3 3 3 3 3 2 2 2 2 2
    trunk                                        2 2 2 2 2 2 1 2 1 1 1 1 1 1 1 1
    fir                                          3 3 3 3 4 4 4 4 5 5 5 6 6 6 5 4
    hemlock                                      3 4 4 4 4 4 5 5 5 5 5 5 5 4 4 4
    understory                                   5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 4

**Green decreases toward the ground in a redwood picture and increases in a fir one.** That single difference is most of what makes two conifers read as two species, and it is not something you would get from looking.

Colours, measured rather than chosen: bark clusters at `#2d251c` in shade and `#7c624c` in sun; canopy foliage `#323b23`–`#5f6d44`; understory foliage much brighter at `#4a6940`–`#739753`; moss on a nurse log brighter still. A grove averages 0.40 value with a fifth of it in deep shadow.

**Looking, on a chosen handful.** Statistics cannot tell you the shape of a frond. Reading the pictures gave the things that actually changed the geometry:

- **A redwood's foliage is a narrow vertical plume hugging the upper trunk**, not a cone on a pole -- with epicormic sprouts and burls breaking out of the bare bole far below it. Every previous attempt in this project, imported or generated, built the cone.
- The bark is **deeply fluted**, long parallel ridges the whole height.
- A **sword fern is a shuttlecock** of ten to twenty once-pinnate fronds leaving the crown near-vertical and arching over.
- **Moss sits on the top and upper flanks** of a log and nowhere else, and it is the brightest thing on the floor.
- A **snag is a dead giant**: short for its girth, bleached almost silver, with heavy broken stubs.

### What had to be built to draw it

Three primitives carry everything. A **tube** swept along a path, with a corrugated cross-section for bark fluting. A **spray** -- a tapered ribbon with a zig-zag edge -- gathered into fans for conifer foliage. A **frond** with paired leaflets for ferns. Plus a lumpy half-dome for moss, burls and boulders.

Five things were wrong on the first render and each is worth keeping:

**The flutes were invisible.** They existed in the silhouette and nowhere else, because the normal was taken from the axis rather than from the cross-section curve. Now `dr/da` by central difference gives the true 2D normal -- and the flutes still did not appear, because **the previewer was recomputing normals and throwing away the file's**. Both had to be fixed before a single ridge showed.

**Three sides per flute, minimum.** At ten sides and seven flutes the corrugation has nowhere to happen and aliases into a smooth cylinder.

**Foliage normals point up, not out.** A spray is one sheet, so half of it faces away from every light and renders black. Tilting the normals hard toward the sky makes it a soft mass lit from above. Then the black came back, because the geometry was drawn double-sided *and* duplicated: every triangle had a coincident twin with a flipped normal to z-fight with. The models now carry both faces and say so -- `# two-faced` in the MTL -- and anything reading them draws front side only.

**A plume is ragged.** Limbs on an even ladder read as a fir with a long trunk. Height, reach and angle are jittered hard and one in twelve is dropped.

**Two vertices per spray step, not three.** The third, down the centre line, folded the spray very slightly and was worth nothing at the distance any of this is seen from -- and it was a third of the vertex count of the most numerous thing in the catalogue. That one change took the set from 2.4 M vertices to 922 k.

### What is there

153 models, 922,164 vertices, mean 6,027, heaviest 27,647:

| | | |
|---|---|---|
| `Redwood_Giant_1-8` | 95 m | bole bare to 52-77%, plume, burls, sprouts |
| `Redwood_Mature_1-8`, `_Young_1-6`, `_Sapling_1-4` | 62/26/3.5 m | the age spread a grove needs |
| `Redwood_Leaner_1-2`, `_Burled_1-2` | 70 m | the odd ones |
| `DouglasFir_1-12` | 55 m | six crown shapes, some with broken tops |
| `Hemlock_1-8`, `RedCedar_1-8` | 40/45 m | lower, drooping, mid-heavy |
| `Tanoak_1-6`, `VineMaple_1-4` | 16/9 m | the broadleaf understorey |
| `Snag_1-7`, `Stump_1-6`, `Stump_Bare_1-3`, `RootWad_1-2` | | the dead, which old growth is full of |
| `NurseLog_1-8`, `FallenLog_1-4` | | mossed along the top only |
| `SwordFern_1-12`, `_Young_1-4` | 1.15/0.8 m | the plant you see most of |
| `Salal_1-6`, `Huckleberry_1-4`, `Sorrel_1-6` | | thicket, thicket, and the mat between |
| `Seedling_1-6`, `MossMound_1-6`, `Boulder_1-5`, `Litter_1-6` | | the floor |

### And a contact sheet, because a hundred and fifty is not one

`preview/sheet.html` draws every model in its own cell of one canvas -- scissor and viewport per cell, one renderer -- at its real height beside a 1.8 m figure. The single-model viewer is right for judging one thing and useless for judging a catalogue; the sheet is how the flat ferns, the twelve identical firs and the mast-thin snags were all caught in one look.

Its own bug is worth recording: `renderer.clear()` honours the scissor test, so clearing without first opening the scissor to the whole canvas leaves the previous layout's thumbnails sitting in every cell the new one does not reach.

## Twenty-two trees out of the packs we already own

No generator, no new dependency: every triangle comes from a CC0 pack already in `vendor/`. What is new is the **arrangement**, and that is where the redwood research lives -- a bare bole to roughly two thirds of the height, a crown about a sixth as wide as the tree is tall, a trunk a thirty-eighth as thick as it is tall, a swollen foot. No pack model has any of that.

`tools/bake-assets.mjs`, into `vendor/baked_assets`. Three operations do all of it:

**Stretch the bole.** A pack conifer branches a third of the way up, and scaling the whole model taller just gives a taller version of the same tree. So only the part *below* the first branch is stretched and everything above rides up unchanged -- a normal tree becomes a redwood bole with its own branch structure still on top. Where it first branches is measured, not assumed: the lowest band whose radius passes 6% of the model's height.

**Flare the foot**, as before: every published redwood diameter is quoted above the swollen base.

**Dress it.** Crowns are borrowed leaf geometry, either one mass capping the bole or sprays placed on a golden-angle spiral through a crown envelope that is widest just above its base and closes at the top.

### What the survey turned up

Two facts made the whole thing cheap. `DeadTree_1`–`DeadTree_10` in Ultimate Stylized Nature are **the same geometry as `NormalTree_1`–`NormalTree_10` with the foliage removed** -- identical vertex counts -- so the pack already ships ten bare boles with real branch structure, bare to between 30% and 50% of their height at trunk radii of 0.027 to 0.051. And the cheapest single-mass crowns are tiny: `Bush_Small` at 380 vertices, `Bush_Large` at 552, `PineTree_4` at 874.

That range matters more than it sounds. **`Redwood_Old_A` is 1,321 vertices** -- a 447-vertex bole and one 874-vertex crown -- against 17,000 for the cheapest generated redwood. Where the budget is vertices per frame rather than megabytes, a thirteen-times difference is the whole argument.

| | verts | |
|---|---|---|
| `Redwood_A`, `_B` | 3.4k, 3.8k | mature, capped |
| `Redwood_C`–`_F` | 23k–56k | mature, sprayed |
| `Redwood_Old_A`, `_B` | 1.3k, 20k | bole to three quarters, narrower crown |
| `RedwoodYoung_A`–`_C` | 1.3k–32k | half the girth, branched most of the way down |
| `DouglasFir_A`–`_C` | 5.7k–37k | narrower, branched lower |
| `RedCedar_A`, `_B` | 40k, 70k | mid-storey, foliage nearly to the ground |
| `BigleafMaple_A`, `_Autumn_A` | 26k | the understorey broadleaf |
| `Tanoak_A`, `Vine_Maple_A` | 21k, 13k | what you actually walk past |
| `RedwoodSnag_A`, `_B` | 2.7k, 2.8k | standing dead, no foliage at all |

### And the colour test misled me a fourth time

`BigleafMaple_A` first reported almost no foliage and a vast trunk. Nothing was wrong: `MapleTree_Leaves.png` is an **autumn** sheet, its foliage averaging `#452c28`, and the check that separates leaf from wood asks whether green exceeds red. Warm foliage counts as wood.

Measuring the sheet rather than trusting the classifier settled it in one step. The maple now wears the green `NormalTree` sheet and the autumn one keeps a variant of its own, which is a better outcome than the bug was a problem -- but the classifier has now been wrong about brown bark, grey bark, and orange leaves. **Any check that sorts pixels by colour is a guess about the art.**

## ez-tree's structure wearing Quaternius's foliage

Six more models in `vendor/baked_assets`, and the point of them is that the two sources have opposite strengths.

ez-tree gives a **trunk and a branch skeleton no pack contains**: a bare column with a buttressed foot and short limbs only near the top. Quaternius gives **foliage that already looks like this game** -- chunky, stylized, a solid mass rather than alpha-cut billboards -- and `PineTree_2` and `PineTree_4` are the two crowns across all six packs whose silhouette rises to a single peak instead of stacking into tiers.

The proportions come from neither: bare trunk to 64% of height, crown half-width 0.085 of the tree's height, trunk a thirty-eighth as thick as it is tall, 42% buttress. The same numbers the redwood research produced.

**Two ways of wearing it**, because it is not obvious which reads better and the previewer is for deciding that:

| | | verts |
|---|---|---|
| `StylizedRedwood_Cap_1` | one crown on the bare trunk -- the original silhouette, on a trunk that now has branches inside it | 5.6k |
| `StylizedRedwood_Cap_2` | wider and starting lower | 5.5k |
| `StylizedRedwood_Tufts_1` | a spray at the end of every main limb, branch bare behind it, which is what conifer foliage actually is | 34k |
| `StylizedRedwood_Tufts_2` | fewer, larger sprays | 23k |
| `StylizedFir_Tufts_1` | the fir skeleton: more limbs, starting lower, drooping | 51k |
| `StylizedFir_Cap_1` | the same skeleton capped instead | 7.1k |

**The caps are an order of magnitude cheaper** -- 5.5k against 34k -- because one crown is about a thousand vertices and a tuft variant wears thirty of them. Worth holding onto given that the whole set has to fit a frame budget rather than a disk.

Tufts are placed at branch tips, taking the longest runs first so the main limbs are dressed before their twigs, and then capped. Uncapped, a fir has a hundred and fifty tips and dressing all of them cost 155,000 vertices and a 20 MB file for foliage nobody could pick out.

The mechanism is small: the crown is read through the same `extractObj` the ingest uses, normalised the same way, copied once per placement into one merged mesh, and handed to the tree as an alpha-tested mesh -- so the OBJ writer, the silhouette profile and the buttress all treat it as foliage without knowing it came from somewhere else.

## Trunks painted, canopies textured

Three changes that all turn on the same distinction: **a leaf is a cut-out, a trunk is a surface.**

### No bark images at all

The trunks are untextured now and state a colour instead. That is the right side of the line: a surface is exactly what this project repaints from the biome palette, and carrying a bark image meant tiling it, crediting it, and -- as five attempts established -- getting its coordinates through a pipeline that was never built for tiling.

Each species names its own bark, written as the colour you would pick in an editor and converted on the way out, because **MTL `Kd` is linear**. Blender's exporter writes it that way and Quaternius's own files confirm it; putting sRGB numbers straight in produced a set of pale washed tans, which is what the first attempt at this looked like.

| | | |
|---|---|---|
| coast redwood | `#7a4a33` | cinnamon red-brown, darkening with weather |
| young redwood | `#8a5439` | brighter, the colour freshest on young bark |
| douglas fir | `#55483c` | dark grey-brown |
| western red cedar | `#7d5440` | reddish and fibrous |
| bigleaf maple | `#6b6653` | grey, and mossy in this climate |
| dead snag | `#8e8478` | weathered silver, all colour gone |

### The pack canopies were meant to be textured, and never were

`PineTree_2` and `PineTree_4` -- the crowns the game's redwoods and firs are wearing -- are fully mapped, and Ultimate Stylized Nature ships their sheet. Their **OBJ export simply never references it**, and the MegaKit's exports reference theirs as `C:/Leaves.png`, an absolute path from whichever machine exported the file.

Two rules fix both. Take only the file name from a `map_Kd`, and, failing that, look for an image named after the material -- Quaternius calls the sheet for `PineTree_Leaves` exactly `PineTree_Leaves.png`, which is a convention to follow rather than a guess. 92 of the 741 models in the previewer are textured now, against 12 before.

### The switch that keeps it out of the game

Reading textures has to be a choice, not a default, and it took two attempts to see why. Turning the lookup on grew the shipped geometry twice: first by attaching texture coordinates to parts whose sheet the game does not carry, and then -- more quietly -- because a UV seam splits a shared vertex, so parts that merely *had* a texture found for them gained vertices even after the coordinates were dropped.

So it is one switch, `wantTextures`, governing the lookup and the vertex splitting together. The ingest asks for it only for families whose image it ships, which today is houses and their atlas. The previewer always asks, because looking at models is what it is for. `src/asset-meshes.js` is byte-identical.

When the generated trees do ship, their family joins `TEXTURED_FAMILIES` **and** their leaf sheets have to be carried with them. One without the other is either wasted bytes or an untextured quad.

## The bark, third time, and how it was finally settled

Two wrong diagnoses in a row, both from reasoning about UVs instead of sampling what came out. The third attempt started by measuring, and the measurements are now part of the tools.

**What was actually wrong, in order.** First `v` was multiplied by 22, which does not stretch a tile but crams 22 into every section. Fixing that left `v` alone -- and left the mirroring, because ez-tree's `v` is 0,1,0,1, so **every vertex ring is a reflection axis**: forty horizontal mirror lines up a trunk, which read as banding however correctly the furrows point. And `u` was a fixed 8 tiles around, which squares the tile on one thickness of trunk and squeezes it on every other: 1.72 x 1.71 on a redwood, 0.44 x 1.70 on a cedar.

**The fix is to rebuild both coordinates from the geometry.** `v` is arc length along the branch, ring by ring, divided by a stated tile size -- a plain un-mirrored repeat of about two metres, following a branch rather than assuming everything is vertical. `u` comes from each ring's own circumference, so a tile is square on a six-metre bole and on a twig, and the slight shear between rings of different girth is what tapering wood does anyway.

| | trunk tile | aspect | texture-up vs world-up |
|---|---|---|---|
| before | 3.4 x 2.5, mirrored every ring | 1.37 | 0.996 |
| after | 1.7 x 1.8, plain repeat | 0.94 | 0.996 |

Across all six species the trunk aspect is now 0.89 to 0.98, where 1.00 is square.

### It was never the bake

Five attempts at "the bark is wrong", four of them spent inside `tools/bake-trees.mjs`, and the fault was two files downstream.

Both the ingest and the asset previewer packed texture coordinates like this:

    uv[i] = Math.max(0, Math.min(65535, Math.round(g.uv[i] * 65535)));

Sixteen bits across the range 0..1. That is correct for the only textured thing the project had ever carried -- a house, whose coordinates are positions in an atlas and never leave the unit square. Bark tiles: nine times around a trunk and fifty-eight times up it. **Every coordinate above 1.0 clamped to 1.0**, so the whole trunk arrived at the renderer holding a single row of the bark image, stretched its entire length. A smooth grey column with a chevron of moire wherever the clamp bit.

The bake had been correct since the third attempt. Each time I re-measured the OBJ and found it healthy, which it was, and then looked at a render of something else entirely.

The fix is to record the range and quantise against it: `uvSpan` per part, restored on load. Houses have no span and are untouched -- `src/asset-meshes.js` is byte-identical after the change.

**What would have caught it:** a check that runs on the thing being displayed. The pixel readback was the right instrument and I pointed it at the wrong question -- it measured *which way* the grain ran, and the grain ran vertically the whole time, because a single stretched row of pixels is vertical. The question that separates the two is *how much detail is there*, and on the same trunks that number went from a flat column to 7-21 units of gradient per pixel once the coordinates survived.

Anisotropy said "vertical" through the entire bug. It was answering honestly; it was the wrong question.

### And the metric was wrong twice over

The fix above was found only after the checks stopped lying. Both failures are worth keeping.

**It skipped the broken triangles.** Measuring the tile size and orientation means inverting the UV basis per triangle, and a basis that collapses divides by zero -- so there was a `if (Math.abs(det) < 1e-9) continue;` guard. Those skipped triangles *were the bug*: a third of the young redwood's trunk had two corners sharing a `v`, smearing the texture the full length of the tree, and the average of the surviving two thirds came back at 0.94 aspect and 0.996 aligned. Healthy numbers, computed from the parts that worked.

`tools/bake-trees.mjs` counts collapsed bases now and fails the bake, rather than any tool quietly averaging around them.

**It sampled the wrong pixels.** The readback filtered to "brown" pixels as a way of ignoring foliage -- `red > green + 8`. Willow bark is grey, so that condition excluded almost the entire trunk: the verdict "vertical, ratio 4.64" was computed from 54 pixels of branch. Widening it to "not green" put the sample at 5,000-16,000 pixels and the answer stayed vertical, but only by luck of what the 54 happened to be.

Four metrics in this project have now measured the wrong thing. The pattern each time is a filter that made the measurement convenient.

### The cause, finally

`v` is arc length along the branch, which needs to know where one branch ends and the next begins. The first version called a step a new branch if it was more than four times **the median step over the whole mesh**. On a tree with many short branches the median *is* the branch spacing -- so a young redwood's own longer trunk sections each looked like a new branch, reset to zero one after another, and the trunk carried the same `v` from root to crown.

The comparison is local now: a step is a new branch if it is more than four times **the step before it**. Plus a floor, so two rings landing on top of each other still advance `v` and cannot collapse a basis.

Measured on the real trunk run of every model -- the vertices before the first big positional jump, which is where ez-tree starts branch one:

    Redwood_1       rises 100 units, v 0 -> 64.0    1.56 units per tile
    RedwoodYoung_1  rises 100 units, v 0 -> 58.8    1.70
    RedwoodYoung_2  rises 100 units, v 0 -> 58.8    1.70
    DouglasFir_1    rises 100 units, v 0 -> 58.8    1.70
    RedCedar_1      rises 100 units, v 0 -> 58.8    1.70
    BigleafMaple_1  rises 130 units, v 0 -> 91.3    1.42

against a target of 1.7. The two that come in under it are the trees whose trunks curve, where arc length exceeds the vertical rise, which is the point of measuring along the branch rather than up the world.

Rendered grain, on thousands of pixels rather than dozens: vertical everywhere, anisotropy 1.6 to 6.7.

### Three ways to measure a texture, none of which is looking at it

Worth keeping, because each caught something the others could not:

- **The source image.** Draw it to a canvas and compare how fast brightness changes left-to-right against top-to-bottom. Both barks change faster across x, so their furrows run vertically in the image. That ruled out "the texture is rotated", which was my second guess.
- **The mapping.** From each triangle's positions and UVs, compute where the texture's own up-axis points in world space. On the trunk it is 0.996 aligned with world up -- so the mapping was never rotated either, and the fault had to be somewhere else.
- **The render.** `preserveDrawingBuffer` on the previewer's renderer, then read the pixels back and measure the same anisotropy on brown pixels only. This is the one that says what a person actually sees, and it is the check I should have run first.

The previewer keeps `preserveDrawingBuffer` on for exactly that reason. It costs a little performance in a tool where performance does not matter.

## The budget is frames, not megabytes

I had been quoting packed geometry as though it were the constraint on how many assets the grove can have. It is not, and the owner was right to push back. Both numbers, measured rather than estimated:

**File size.** Putting all twelve baked trees into `PICK` and building takes the single file from **2.78 MB to 10.84 MB** (gzip 4.23 MB), plus about 1.5 MB more once the four sprite sheets ship as base64. Twelve or thirty, it is still a file you can email, and the base64 decode at startup is a fraction of a second. There is enormous headroom here and variety is close to free.

**Frames.** This is the one that binds, and it has nothing to do with file size.

A grown redwood course holds **117,000 instances and 3.73 million vertices** if every one were visible. Of that, the 1,378 tall conifers are about 1.4 million — roughly a thousand vertices each, because a tree today is a nine-sided cylinder plus one borrowed crown of about 950.

The baked trees are 17k to 52k vertices each. Drawing the same 1,378 trees from them:

| | vertices, whole course |
|---|---|
| today | 3.7 M |
| redwoods and firs swapped for baked ones | ~35 M |
| plus cedars for the mid-storey | ~49 M |

Thirteen times the entire course as it stands, from the trees alone. That is a frame-rate problem on any hardware, and no amount of disk space touches it.

### So the lever is detail, not count

Ship as many species as we like — that cost is megabytes, and megabytes are available. What cannot happen is drawing a 23,000-vertex tree fourteen hundred times.

Two levels per species is the answer: the full model near the camera, a cheap one beyond it. We control both, because we generate them — the far version is the same parameters with fewer sections, fewer segments and a fraction of the leaves, and ez-tree also has `generateLODs` if we want it to do the reduction. Rough arithmetic: the forty-odd trees within about 120 m at full detail plus everything else at 1.5k comes to roughly 3 M vertices, which is what the course costs today.

The machinery half-exists. `view.treeInstances` already walks every instance each time the camera moves, to hide a tree the camera is standing inside, and the near-field grass already builds and drops tiles by camera distance.

## The bark ran sideways, and a forest rather than a tree

### `v` was never a ramp

The bark came out banded horizontally, with one vertical-looking stripe down a single slice of the trunk. The instinct is to blame the texture or the seam. The cause was an assumption about what ez-tree's UVs mean.

Its trunk coordinates are:

    u = 0.000  0.167  0.333  0.500  0.667  0.833  1.000    once around the ring
    v = 0      0      0      0      0      0      0        ring at the foot
    v = 1      1      1      1      1      1      1        next ring up
    v = 0      0      0      0      0      0      0        the one after

**`v` runs 0,1,0,1 — one tile per vertex ring, mirrored each time**, which is how it hides the horizontal seam between rings. It is not a ramp up the trunk. Scaling it by 22, the way you would scale an ordinary cylindrical unwrap, asked for twenty-two tiles inside *every single section*: the bark became fine horizontal banding, and the one stripe that looked right was the u-seam column where the whole texture is squashed into one step.

So `v` is left exactly as generated, and tile height is set by the number of **sections** instead — forty rings up the trunk is forty tiles, about one every three metres. Only `u` is scaled, by 4, to square the tile up. Worth remembering as a general point: a generated UV layout is a fact to look up, not a convention to assume.

### Twelve trees, not four

A grove needs more than one species, and the whole argument for generating is that a second species costs a function rather than a shopping trip.

| model | what it is | verts |
|---|---|---|
| `Redwood_1`–`_4` | mature, crowns starting 30–60% up | 17k–29k |
| `RedwoodYoung_1`, `_2` | half the girth for its height, branched nearly to the ground — nothing has self-pruned yet | 40k |
| `DouglasFir_1`, `_2` | narrower, spikier, distinctly drooping | 36k |
| `RedCedar_1`, `_2` | the mid-storey: branches to the ground, heavily drooping, dense | 52k |
| `BigleafMaple_1` | the only broadleaf, wide open crown | 8k |
| `RedwoodSnag_1` | a standing dead spar. No foliage, 1.2k verts, unmistakably old-growth | 1k |

Two of the four mature redwoods now carry their branches much lower (35% and 30%). An unbroken line of bare trunks all ending at the same height reads as a colonnade rather than a wood — a grove is a spread of ages, and that has to be visible in the silhouettes.

**Cost, stated plainly: 360k vertices over twelve models is roughly 3 MB of packed geometry, against a 2.78 MB game.** Not all twelve ship. That is what choosing in the previewer is for, and the cedars at 52k each are the first place to look.

## What a redwood actually looks like

The first bake was a redwood from memory. These are the published descriptions it was then matched against, and what each one changed.

Sources: [Britannica on coast redwood](https://www.britannica.com/plant/coast-redwood) · [Sequoia sempervirens](https://en.wikipedia.org/wiki/Sequoia_sempervirens) · [USFS, Coast Redwood Live Crown and Sapwood Dynamics](https://fs.usda.gov/treesearch/pubs/41818) · [Hyperion](https://en.wikipedia.org/wiki/Hyperion_(tree))

| what the sources say | what it changed |
|---|---|
| the trunk is "remarkably straight" with minimal taper | gnarliness .012 → .005, taper .82 → .90 |
| 3–6 m across, **"measured above the swollen bases"** | a buttress flare, below |
| "a conical crown, with horizontal to slightly drooping branches" | branch angle 102 → 96, and the crown is widest at its base |
| old-growth boles are long and branch-free; self-pruning lifts the crown with age | 26 branches rather than 42, and the older variant starts its crown at 72% |
| bark bright red-brown, soft and **fibrous**, up to 35 cm thick | a bark texture at last, below |

### The buttress is not something the library can express

Every published redwood diameter is quoted *above the swollen base*, which tells you how pronounced that base is. ez-tree tapers a branch uniformly and has no parameter for it, so the foot of the trunk is pushed outward after generating: 42% wider at ground level, easing to nothing by a fourteenth of the tree's height.

The first attempt looked like a cone stuck on the bottom, because the trunk had eleven vertex rings over its whole height and only the ground one fell inside the flare. At 26 rings there are two or three inside it and it reads as a swelling. Measured, as a percentage of the trunk just above the flare: **160 at the foot, 104 at 7%, 96 at 15%, 87 at 22%**, falling to 61 by mid-height.

### Bark, and which bark

The trunks were untextured because the game repaints every imported surface from the biome palette. That is right for a flat-shaded pack model and wrong for something with 35 cm of deeply furrowed bark: without a texture a redwood trunk is a smooth brown cylinder, which is the one thing it is not.

ez-tree ships four bark sets. The **willow** one is taken — deeply and vertically furrowed, the closest of the four to redwood — and specifically *not* the pine one, which looks right too but comes from texturecan, whose terms would need checking. Willow and oak are Poly Haven (`bark_willow_02`), which is CC0. Colour map only: the game is toon-shaded and reads no normal, roughness or ambient-occlusion map.

The tiling is **baked into the vertex coordinates** rather than left as a material setting, so it travels with the file: eight repeats around the trunk and twenty-two up it, which is about one tile every five metres on a 115 m tree.

### Measuring instead of squinting

`node tools/bake-trees.mjs --report` now prints, for each variant, the crown's silhouette band by band and the trunk's radius ring by ring. Both of the mistakes above — the cone-shaped buttress and a taper that was really a pine's — were found in those two rows rather than by looking at anything.

## Baking trees instead of shopping for them

Three crown models have now been chosen by looking at packs, and none of them was a redwood, because **nobody has made one**. Every conifer in every pack is conical to the ground; the shape we want — a bare column for two thirds of its height with a narrow crown on top — does not exist as an asset at any scale.

[ez-tree](https://github.com/dgreenheck/ez-tree) (MIT, Daniel Greenheck) generates a tree from parameters, which turns the problem from *finding* a redwood into *specifying* one.

### It runs at bake time, and never ships

The library is a devDependency. `node tools/bake-trees.mjs` runs it in Node, writes four variants as OBJ into `vendor/baked_assets/`, and from there they go through exactly the same ingest as a Kenney pine. **No library code and no runtime cost** — what ships is geometry.

Two things made that possible. `Tree` builds its meshes without a renderer, and it loads its bark and leaf textures at import time through three's `TextureLoader`, which wants a DOM — six lines of stub is enough, since an image that never loads does not matter to geometry.

### A redwood is four numbers

Starting from the `Pine Large` preset, what makes it a redwood rather than a pine:

- `branch.start[1] = .64` — branches begin two thirds of the way up, and nowhere below
- `branch.length[1] = 11` against a trunk of 100 — short branches, so the crown is narrow
- `branch.taper[0] = .82` — a column, not a cone
- `branch.radius[0] = .028 × length` — a coast redwood is about a thirty-fifth as thick as it is tall

Measured by the same silhouette profile the asset previewer uses: crown starts between 45% and 60% of height, **zero reversals** on all four. One mass on a bare column, which is what we have been trying to fake since the first attempt.

Cost: 18.5k to 27k vertices each, against about 900 for a pack conifer.

### Breaking the no-texture rule, once

Until now every imported surface was stripped of its material and repainted from the biome palette — the thing that lets one pine serve eight biomes instead of importing somebody else's art direction. ez-tree's leaves are billboard quads that rely on an alpha mask, and without it a leaf is a solid rectangle.

So the rule bends for exactly one thing: **a cut-out is not art direction**. One 1024×1024 indexed PNG with a `tRNS` chunk, 297 KB, shipped alongside the models; the bark stays untextured and takes the biome's colour like everything else. The ingest carries UVs through for a part whose material names an image, and the asset previewer renders it with `alphaTest`.

Not shipped into the game yet. The trees are baked and visible in the previewer, which is where the decision about them belongs.

## Nothing kept trees apart, and at 380 feet it showed

A screenshot of a mangled grove, and three separate faults behind it. All three were invisible at 13 to 29 metres and none of them was the tree the eye lands on.

### There was no spacing rule at all

Trees were placed at random points, rejected for surface and for distance from a corridor, and never once checked against each other. Measured on a 380-foot grove before the fix, with `tools/tree-spacing.mjs`:

| | before | after |
|---|---|---|
| distance to nearest tree, median | 8.6 m | 12.9 m |
| closest pair | **0.2 m** | 4.6 m |
| crown overlap, median | 41.6% | 10.0% |
| gap between trunk surfaces, worst | **−5.4 m** | +2.4 m |
| tall conifers per hectare | 13.8 | 9.0 |

A negative trunk gap is two six-metre trunks occupying the same space. That is not a tuning problem, it is a missing rule, and the reason it had never mattered is that a 20 m pine with a 3 m crown can stand 8 m from another one quite happily.

The rule is not "no overlap" — crowns in a closed canopy interlock, and a redwood grove is a closed canopy. It is that two crowns may not be mostly the same crown (55% of their combined radii), and that trunks may never intersect.

**It is off for the other seven biomes**, behind a `crownShare` of zero. Not because they would not benefit, but because switching it on relayouts every one of them to fix a problem none of them has. The first version was not gated, and the fingerprint reported seven biomes moved — which is the fingerprint doing its job.

### The cedar was also 380 feet tall

Tree height came from the biome, so raising the canopy raised *every* species in it. The redwood grove's cedars are Kenney conifers, conical to the ground, and they were being drawn at redwood height — a hundred-metre christmas tree standing inside a redwood. That is the shape in the screenshot.

A plant entry can carry a third number now, a height scale, so a biome can have a **mid-storey**: the cedar is 30% of canopy height, which puts it between the ferns and the giants where a forest actually keeps its younger trees.

### The canopy floated because a shared angle is not a shared line

The trunk leans about its middle; the crown leaned about its base, positioned on the vertical through the tree's centre. Same angle, different pivot — so the trunk's top moved sideways and the crown did not, by up to four metres on a 116 m tree. The crown is seated by taking the point out of the trunk's own matrix now, and the lean is a third of what it was, because a giant redwood is dead straight.

The other half was overlap. These crowns taper to a point at the bottom — `PineTree_2` is a third of its widest in its lowest band — so meeting the trunk top exactly left the solid foliage starting ten metres above the wood. The crown is sleeved 20% down the trunk instead of 8%.

## A contact sheet for 729 models

Two crown models have now been chosen by reading file names and both were wrong. `tools/asset-preview.mjs` plus `preview/` builds **dist/assets.html**, one self-contained page listing every model in `vendor/`, drawn at a height you type, beside a 1.8 m figure, painted in the same role colours the game uses, with the exact `pack:Name` string a PICK entry wants.

It also shows the **silhouette profile** and counts its reversals, which is the number that would have caught the wedding-cake pines before they shipped: one mass turns over once, a tiered conifer turns over at every plate. Models with four or more are flagged `tiered` in the list without being opened.

`npm run assets` regenerates it. It is a local tool and never ships.

Two things learned building it. Inlining three.js by hand does not work any more: since r17x `three.module.js` imports from `./three.core.js`, so an inline module tries to fetch that from the page and fails with a `SyntaxError` and no line number; concatenating the two bundles then collides on their internal names (`_m1$1`). The page is built by vite with the single-file plugin, exactly like the game. And a 12 MB inline module that throws looks identical to one that is still loading, so the page now prints its own error rather than staying dark.

## Giant means the trunk, and a crown must be one mass

Three things wrong at once, from a screenshot of a single tree.

### The crown was a wedding cake

The MegaKit's pines are tiered. Their radius alternates wide-narrow-wide **every band from the ground up**, which at redwood scale draws five separate green plates with daylight and bare trunk between them. Measured as a profile rather than judged by eye, the pattern is unmistakable, and it is worth measuring before picking a crown model:

    MegaKit Pine_1   F D B E C A B C B 8 B A 9 7 7 9 6 4 4 3   <- a stack
    PineTree_2       5 3 7 5 8 A B B D D F B A 8 8 8 9 6 4 2   <- a plume

Across all six vendored packs exactly two crowns rise to a single peak and fall: `PineTree_2` and `PineTree_4` from Ultimate Stylized Nature. Those are the two in use. Two shapes is thin variety, but the crown of a 380-foot tree sits seventy metres over your head and the trunk is what you actually look at.

### The drawn trunk and the collided trunk were different objects

The trunk was drawn at a fiftieth of the tree's height while `trunkRadius` in physics collided at 0.027 of it — **the drawn one was the thinner**, so a ball could pass through wood you could see. Nobody would notice at 29 m. At 380 feet the gap is over a metre.

The drawing now calls `trunkRadius` directly, so what you see is what you hit, and girth variety moved into the taper where nothing depends on it. The clamp that function carries went 2.4 m to 3.6 m: it exists to catch a nonsense height, not to be a real limit, and at 2.4 it was shaving a metre off the widest redwoods. At 3.6 it no longer binds on anything the generator makes.

Result: a 6.2 m trunk under an 80 m bare column, from a rule that was already in the codebase.

### 380 feet, and a tree that is actually that tall

The owner asked for a 380-foot maximum with the floor unchanged. Coast redwoods really do run to this.

Setting it exposed a quiet error: the trunk was a fraction of height with its own jitter and the crown was **another** fraction with its own, so the two stacked to as much as 112% of the stated height — a "380 foot" redwood drawn at 415. Physics collides with `t.h`, so the top 35 feet of those trees were scenery a ball flew through.

The crown takes whatever height the trunk leaves now. Every one of 906 redwoods measured in a grown course comes out at exactly its nominal height, and it reads better: a tree with less bare trunk has a deeper crown, which is what a tree with light down its flank actually does.

### Ground cover, again

The `fern` family is sized by spread rather than height, as before. Worth restating because the same fix now has two customers and the bush family still has the bug.

## Razor-thin redwoods: a width that was inherited instead of stated

The first redwoods came out as needles, and no two the same. The cause is worth writing down because it is a shape of bug rather than a number that was wrong.

The crown is borrowed from a conifer model and the trunk is drawn. To make a broad pack conifer read as a redwood the first version multiplied the model by a **narrow factor** of 0.40. But the borrowed models were not one width: Kenney's conifers range from 1-part-wide-in-10 to 1-in-4 in their own proportions. So the narrow factor did not set a width, it scaled **whatever width the model happened to have** — one tree's crown came out two and a half times another's in the same grove, and the narrow end of the range finished at roughly three metres of foliage on a thirty-six metre crown.

That is both complaints at once: the thin ones are thin, and the inconsistency is most of the mess.

The fix is to **state the width and divide the model's own out**, which is exactly what `addModelSpecies` already does with height and says so in a comment. A crown is now a stated fraction of the tree's own height — half-width 0.085 for a redwood, 0.115 for a douglas fir — so a 70 m tree carries a 12 m crown about two and a half times as tall as it is wide, whichever model was drawn. Measured in the running scene: crowns 8–12 m wide over 21–29 m tall, against 3–7 m over 36 m before.

Two smaller things came off the same thread. The drawn trunk tapered to 34% of its base, which is a spike rather than a column; it is 62% now. And the crown models ship as **leaf geometry only** — their own trunks are dropped at ingest, because a second trunk inside the drawn one is what made these look doubled up. Dropping them also paid for the new models: 218 KB back, so two packs' worth of additions cost 77 KB net.

### Ground cover is sized by its spread, not its height

A sword fern is a low clump about a metre and a half across. The imported `Fern_1`'s fronds reach nearly twice its height sideways, so scaling it to tree height the way every other species is scaled produced a **ten-metre bush**. Ferns are sized from `t.r` — the spread they were already given — and the height follows the model's proportions: 2–3 m across and under a metre tall, which is a fern.

The bush family still sizes by height and probably should not either, but six biomes draw from it and that is a change to look at on its own.

### Three Quaternius nature packs, 31 shared names

Adding the Ultimate Stylized Nature and Stylized Nature MegaKit packs put **31 model names in more than one pack**. `Plant_1` is in all three and means something different in each — and the fern family was using one of them. The ingest resolved a name by walking `vendor/` and taking the first hit, so vendoring a pack could silently swap the model under a shipped biome with nothing to notice.

An ambiguous name is an error now, and it names the packs and tells you how to disambiguate (`megakit:Pine_1`, where the part before the colon just has to appear in the directory name).

The same change fixed a bug that had not fired yet: lookup used `existsSync`, and **Windows matches file names case-insensitively where Linux does not**. Kenney ships `grass.obj` and Quaternius ships `Grass.obj`, so `grass` found two packs on Windows and one on Linux — a build that differs by operating system. Directory listings are compared exactly now.

## The forest floor was already in the repo

The redwood grove's floor was mown rough with columns standing in it. The obvious fix was to go and find CC0 logs, stumps, mossy rock and a real fern. **The search changed the answer: most of it was already vendored and simply not being shipped.**

`tools/build-meshes.mjs` ingests a hand-picked subset of each pack. Sitting unused in packs already credited as CC0 were seven mossy boulders, four fallen logs, seven stumps, more logs, hanging moss, and five leafy ground plants. Twenty-four of them are shipped now, and no licence question came with them.

Sources checked, recorded because the search is otherwise repeatable:

- [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) — CC0, glTF, 116 models including one actually called *Fern*, same creator as a pack we already ship. **The candidate if a real fern is wanted**, and the lowest-friction addition possible. ([Ultimate Stylized Nature](https://quaternius.com/packs/ultimatestylizednature.html), [MegaKit on Poly Pizza](https://poly.pizza/bundle/Stylized-Nature-MegaKit-T34GZFA0fm))
- [Stylized Nature & Forest Props Pack](https://verdealis.itch.io/stylized-nature-forest-props-pack-low-poly) — matches the brief almost exactly, 30–320 triangles, GLB. **Not CC0**: it forbids redistributing the source files, and this project ships its assets inside a single HTML file. Ruled out, and recorded so nobody buys it for this.
- [Meshy's CC0 tag](https://www.meshy.ai/tags/log) — generated-model licensing is not the same thing as a curated pack with a licence file inside it, which is what AGENTS.md requires.

### One species list written twice, differently

Two files each carried a hand-written list of "plants that are not really trees", and **they were not the same list** — physics included `ocotillo` and course.js did not. Neither was wrong: an ocotillo is tall enough to size like a tree and too spindly to stop a ball. But nothing said so, and adding a species meant finding both literals.

They are `GROUND_PLANTS` and `NO_TRUNK` in `src/species.js` now, one built from the other, with the reason for the difference written down. The file imports nothing, so physics can read it without pulling in three.

### Deadfall is anchored to trees, not scattered evenly

520 props per course, and **72% of them placed around an existing trunk** rather than at a uniform random point. Timber falls where timber grows; the same count spread evenly over the map reads as litter dropped on a lawn, while clustered around trunks it reads as a wood that has been standing a while. The rest are scattered so clearings are not conspicuously empty.

Sizing falls out of the ingest. Every model is normalised to unit height, so one number sizes it — but for a log lying down that "height" is its **thickness**, and the length follows from the model's own proportions. A log is therefore scaled far smaller than a stump and still ends up the longer object.

### What it cost, and what it does not do

24 new models: 71 shipped of 598 available, now 95. Packed geometry 1056 KB to 1238 KB, and the whole single-file build 2.59 MB to 2.78 MB. On a redwood course the floor is 877 instances across 31 draw calls, in its own `Deadfall` group so it can be counted from the console rather than guessed at.

**Nothing collides with any of it.** A ball rolls through a fallen log. That is worth knowing before anyone makes them bigger — at this size it reads as ground clutter, and at twice it would start to look like it should stop a ball.

The ferns are real fern models now (`swordfern`, its own species so that Pacific Northwest's generic bushes are untouched), but they are leafy ground plants rather than fronds. **Since resolved** — the MegaKit's `Fern_1` is an actual fern; see the section above.

## Giant Redwood, and what the eighth biome cost

The first biome added since biomes became one record. It is **one entry in `src/biomes.js`**, one line in `BIOME_KEYS`, two species in `FAMILY_OF`, and a tree builder — and the tree builder is there because of a shape the asset packs do not contain, not because the pipeline made it necessary.

### Moody is a set of numbers

Almost none of the atmosphere is new code. It is fields the engine already reads:

- **The sun sits at 18°** rather than the usual 28. Every biome carries its own sun elevation, and a low one rakes light through the trunks all day and gives the god rays something to cut across.
- **Fog takes its colour from the biome's sky**, so a desaturated grey-green sky *is* the haze between the trees. That one field does most of the work.
- A dark saturated palette with little contrast between fairway and semi, so the mown lines read as a suggestion rather than a stripe. Dark peaty water, wet grey rock, moss in the rough.

The landform is PNW's, deliberately — the owner asked for the same country, and the difference should be what grows on it.

### A redwood is a column with a crown on top

Every conifer in the CC0 packs is conical all the way to the ground. Scaled to seventy metres that is a giant Christmas tree, and the silhouette **is** the feeling of a grove: bare trunks running up out of the shade, the canopy only starting well above your head.

So the trunk is drawn and the crown is borrowed. A tapered seven-sided column carries an existing conifer squeezed to 40% of its natural width and lifted to the top, overlapping so there is no seam. One cheap cylinder per tree, and the packs supply the only part they are good at here.

**Height turned out to matter more than shape.** Tree heights were hardcoded at 13–29 m, so the first redwood grove was a pine wood with a dark tint. They are a biome field now, and a redwood runs **46–80 m**.

That exposed a second thing: `trunkRadius` in physics clamps collision at 0.8 m, which is right for a 29 m pine and wrong for a 70 m tree you cannot see past. The cap is 2.4 m now. It only binds above 29.6 m, which no existing biome reaches, so nothing else moved — and the fingerprint says so rather than the reasoning.

### The refactor earned itself on the first use

Two mistakes, both caught by `tools/biome-fingerprint.mjs` within seconds rather than by looking at a course and wondering.

Deriving the scenery tree height from the on-hole height changed the range from 12–27 to 11.96–27.96 — **a few centimetres, and it moved five biomes**. They were two hand-written ranges and they are two fields now.

The other was a missing comma in the new record, which is the kind of thing the suite catches anyway. The interesting one is the first: a difference that small is invisible to any amount of looking, and it would have shipped.

Final state: all seven existing biomes byte-identical, redwood new, 441 tests pass, every generator rule clear on the new biome.

### What is not done

The ferns are generic bushes — `fern` maps to the bush family, which is fine at distance and poor close up. Fallen logs, stumps and moss-covered rock would all be more redwood than anything currently scattered there. Those are the CC0 assets worth sourcing, now that there is something to judge them against. **Since resolved** — see *The forest floor was already in the repo* above: they were in `vendor/` the whole time.

## A biome becomes one record

Adding an eighth biome meant first finding out what a biome *is*, and the answer was: not one thing. Seven tables and **48 conditionals across eight files**.

| where it lived | what it held |
|---|---|
| `BIOME_KEYS`, settings-schema | the list the dropdown reads |
| `BIOMES`, course.js | palette, sun angle, altitude, temperature |
| `ecology`, course.js | the plant mix and its weights |
| `BANK_COLORS`, streams.js | the earth colour where a stream cuts through |
| `land()`, course.js | four hand-written branches for the hill shape |
| vegetation.js | rock and grass counts, blade size, tints, flower colours |
| homes / textures / routing / shot-visuals / landscape-edge | one-off tests apiece |

None of that was wrong for seven biomes grown one at a time. It is wrong for the eighth, because **there is no list of what a biome has to answer** — you find the places you missed by looking at the result.

The worst of them was in the ground shader:

    biome: ['desert','mountain','links','island'].indexOf(w.settings.biome)

A biome not in that array becomes **−1** and takes whichever branch that turns out to be. Nothing throws. It is now four named flags — `speckleRock`, `altitudeRock`, `litterAmount`, `seaBeach` — which a new biome sets or does not.

Everything now lives in `src/biomes.js`: defaults for all 45 fields, and per-biome traits listing only the differences. A biome that says nothing behaves exactly like the old generic case. Adding one is a single record plus whatever assets it needs.

The module imports nothing, which incidentally removes a cycle `range.js` documents a workaround for.

### Proving a refactor invisible

The whole point is that nothing changes, and "it looks the same" is not a check when a difference would be a metre of terrain here and one missing shrub there.

`tools/biome-fingerprint.mjs` hashes what each biome *generates* — ground height and surface across a grid, every hole's geometry, every tee, pond, bunker and tree, every house, every channel station, over two seeds each. Generation is deterministic, so the hash is exact.

All seven biomes came out **byte-identical**, and the full suite passes.

One detail worth recording: the first version of the fingerprint hashed the biome record by iterating its keys, which would have changed the moment the refactor added a field — proving nothing about the fields that were already there. It hashes an explicit list of the player-visible fields instead. **A fingerprint that moves when you add to it is not a fingerprint.**

What it does not cover is renderer-side work: vegetation scatter, textures, shot dust, the horizon ring and the shader itself all need a GPU. Those were converted by direct substitution — each conditional replaced by a field holding the value that conditional produced — and rest on the test suite and on reading. That is the weaker half and worth knowing.

## Clouds fade in, and one flag with two meanings blanked the course

A cloud that reaches the edge of its box wraps to the far side, which keeps the sky full without spawning anything near the camera. The wrap is still a four-kilometre jump, though, and at that size it reads as a pop — on the cloud and on the hard-edged shadow it drags across the course.

The first version watched for the wrap and faded in over a fixed time. That gives an arrival and no departure: a cloud still reached the far edge at full strength and blinked out. **Opacity is a function of where a cloud is, not of what just happened to it** — it fades with distance to the edge of the box, which does both ends from one rule. A cloud thins out as it approaches the boundary, wraps while it is invisible, and thickens again as it moves back in. Because the distance to the near edge is zero on *both* sides of the jump, there is no step at the moment it wraps.

The margin is a distance but it is set from the drift speed, so the fade takes the same few seconds on a still day and a blowing one. The shadow shares the same opacity, so a cloud and the shade it throws cannot come apart. Measured over three minutes of drift: opacity reaches 0.00 and 1.00, and the largest change in any single frame is **0.0067** — a pop would be 1.0.

### The flag

Adding that made the entire course invisible — at the Ultra tier only, with nothing in the console.

`applyCloudShadows` used `material.userData.clouds` as its own *already patched* marker, setting it on every material it touched. `clouds.js` used the same name to mean *this material is a cloud*, so `applyCloudShadows` would skip it. One name, two meanings, and nothing in either file said so.

The new per-cloud opacity keyed on it. Instead of the one cloud material it patched **thirty-four** — every lit material in the scene — and each of them then read a per-instance `aFade` attribute that only the cloud geometry actually has. A missing attribute reads as zero. Zero alpha. The whole course, invisible.

The flags are now `cloudMesh` (this *is* a cloud) and `cloudShadowed` (already patched), which are two different questions and now have two different names.

### What the hunt cost, and why

Four wrong turns, all avoidable:

- **Tested at the wrong graphics tier.** Clouds are quality-gated, so at Medium the code never ran and everything looked fine. The owner had to say "you need to set gfx to ultra". A change behind a quality gate has to be tested behind that gate.
- **Chased a console error that was not mine.** A `Cannot set properties of undefined` appeared on load, I assumed it was the new uniform, and only later checked HEAD — where the same error appears while the scene renders perfectly. Check whether an error predates the change before explaining it.
- **Guessed at causes four times** — a missing import, transparency sorting, shader chunk collisions, CSM wrapping order — when the bisect took two builds and named it exactly.
- **Believed a stale console.** The instrumentation logs persisted across reloads after the code was removed. The count not rising is the tell, and the honest check is whether the string is still in the bundle.

The bisect that actually worked: build with the patch, blank; build with the patch disabled and the shadow uniform kept, renders; build at HEAD, renders. Two builds, and it isolates the half. Then one log line inside the patch reported thirty-four materials where one was expected, which is the whole answer.

**The general trap is worth keeping.** A boolean on `userData` used as "I have processed this" is indistinguishable from one meaning "this is that kind of thing", and the second reader has no way to tell. If a flag is a processing marker, name it for the processing.

## A tee is a rectangle, and it points where you do

Four faults came off one screenshot: tee boxes hiding the fairway on downhill holes, tees too big, tees sitting in line with each other, and a par three's shared pad carrying dead ground in front of its forward marker. The previous section covers the sightline half. This is the shape half, and between them the reported problem is gone.

**An oval was never a tee.** It was what the code happened to have — ponds and bunkers are ovals — and a tee is mown in straight lines by a machine that turns at the corners. Owner's call, and it made the code simpler rather than harder: a rounded box is a proper signed distance in **metres**, so the shoulder that falls away from a pad reads it directly. The oval had to normalise into the ellipse and convert back along the ray to recover a distance at all.

**And it points where the player does.** The pad was axis-aligned in the hole's own frame while the markers on it were squared to `teeAim`. That was invisible while a pad was an oval and every tee sat on the centre line; it is glaring once a pad is a rectangle and tees sit a median 15 m off to one side. `fairwayMiddle` and `teeAim` moved into `course.js` for this — they were in `camera-tours.js`, which imports `course.js`, so the alternative was a second copy of "where does a tee point" and eventually two answers.

**Sizes uniformly down**, 12 × 16 m to **6 × 9**, with the mown collar following from 20 × 27 to 8.7 × 13. And the site score now prefers a lateral stagger, because a tee directly in front is a tee you look over.

| | before | after |
|---|---|---|
| shots blocked over 1 m, from the real tee | 74 (9%) | **19 (2%)** |
| of those, blocked by another tee | 23 | **2** |
| downhill shots blocked | 68 (14%) | **13 (3%)** |
| sideways gap between consecutive tees, lowest quarter | 1.5 m | **11.7 m** |
| sites needing real earthwork | 188 | **19** |

### Where a tee points

Two faults, and the second only became visible once the first was fixed.

**The facing was computed before the tees had moved.** Tees are sited on ground that suits them, which happens well after the hole is laid out — and the facing was set from where the hole first put each tee. A tee sited 37 m off the centre line came out squared 8 degrees when the geometry called for 62. That is why they still pointed the wrong way after the shapes landed: the rule was right and the input was stale. The facing is recomputed the moment a pad lands on its real site.

**And then the aim point itself.** The owner asked for the centre line about twenty yards ahead. Measured, that gives a **median turn of 44 degrees**, with two thirds of tees past 30 — because tees sit a median 18 m off the centre line, and aiming 18 m ahead is a 45 degree turn by arithmetic rather than by taste.

Four candidates, over 810 tees on ordinary courses and 324 on deliberately dogleg-heavy ones:

| aim point | turn, median / p95 / max | over 30° | dogleg: lines straying over 25 m off the hole |
|---|---|---|---|
| 20 yards ahead | 44 / 65 / 68 | 525 of 810 | — |
| the green | 4 / 14 / 27 | 0 | **40 of 324** |
| fairway midpoint | 11 / 31 / **78** | 43 | 3 |
| landing area | 6 / 19 / 27 | 0 | 11 |
| **as far as you can see straight** | **7 / 22 / 35** | **6** | **0** |

The two ends pull against each other. Aiming at the green gives the tidiest angles and points you into the trees on a dogleg — which is what the test forbidding markers squared to the pin has been saying all along. Aiming near the tee keeps you on the hole and turns you sideways. The midpoint is decent on doglegs and has a bad tail elsewhere: on a short hole it can be nearly beside the tee, which is where the 78 degrees comes from.

What resolves it is not a distance at all. Walk out along the middle of the fairway and stop where the straight line from **this** tee would begin leaving the corridor. That is the dogleg corner where there is one and the landing area where there is not — which is where a player aims in both cases, and it is the only candidate not trading one end against the other.

### The par three special case dissolved

Par threes had one long shared pad with the markers set down it, because three ovals 9 to 12 m apart could not help overlapping when each was 16 m long. That pad carried 8 m of dead ground in front of the forward marker — space that existed only so one shape could span every marker.

At 6 by 9 metres three ordinary pads fit down a short hole at honest spacing. So par threes have three separate tees again, the special case is deleted rather than improved, and the levelling rule that was already there gives the stepped form a real short hole has, for nothing.

This is the second time in this work that making something smaller removed a special case rather than shrinking it. Worth remembering when the next one appears.

### Two exceptions, both the driving range

The range came up twice, for the same underlying reason: its three mats sit side by side at the same distance and must be interchangeable.

Squaring each tee to the middle of the fairway turns the outer two by a few degrees, which stops them being the same mat — so range mats face straight down the field. This surfaced as a paint-versus-lie disagreement on 0.08% of the range, which is the sort of thing only a pixel-by-pixel check catches.

## The blindness check could not see tee boxes

Reported as: on a downhill hole the tee box in front of you hides the fairway. The check that decides whether a tee needs raising was reading `shapedNoTees` — the shaped land **with no tee pads in it**. It was structurally incapable of seeing the one thing being complained about.

It had a second fault of the same kind. It sampled down the hole's centre line, which was true when every tee sat on the centre line and stopped being true the moment tees were sited on ground that suits them: they now sit a median 19 m off it. It was measuring a shot nobody plays.

The centre line was there for a reason — a straight line to a point 250 yards along a curving hole leaves the corridor on a dogleg and reads whatever happens to be out there. That is still handled, but by ignoring ground well outside the corridor rather than by pretending the tee is somewhere else.

Measured from the real tee position, along the real shot line, over the finished ground:

| | before | after |
|---|---|---|
| shots blocked by more than 1 m | 103 of 810 (13%) | **74 (9%)** |
| downhill shots blocked | 89 of 500 (18%) | **68 (14%)** |
| obstruction, 90th percentile | 1.24 m | **0.88 m** |
| of the blocked shots, blocked by another tee | 19 | 23 |

**Beware the bench number here.** `blind.blockedOver1m` reports 27 before and 79 after, which reads as a threefold regression and is nothing of the sort: the metric was fixed in the same pass and now asks the honest question. The pair above is the only fair comparison, because it uses the same method on both sides. A measurement changing at the same time as the thing it measures is worth saying out loud, every time.

Pads are sited forward-most first, so by the time a back tee is judged the tees in front of it are placed and their levels are known. The check samples those directly.

**One fix that mattered less than expected.** Merging neighbouring pads to one level was undoing deliberate steps: a back tee raised to see over the tee in front would drag that tee up to meet it, which is exactly the view it was raised for. Merging is now limited to pads already within 1.2 m of each other — which is the right rule, and moved the tee-on-tee count by two. The remaining cases are mostly the lift cap.

### What is left

Tee-on-tee blocking is a third of the remaining blocked shots and barely moved. The tees are simply large: the mown collar is 20 by 27 metres, and a quarter of consecutive tee pairs sit within 1.5 m of each other sideways, which is in line. A par three's shared pad carries 8 m of dead ground in front of its forward marker for the same reason — one oval has to span every marker.

Those are shape problems, not sightline problems, and the owner's call is rounded rectangles at a uniformly smaller size. Smaller pads may also dissolve the par-three special case entirely: if three of them fit down a short hole without touching, par threes go back to three separate pads and the existing level rule gives the stair step for free.

## A quarter of the country's relief behind the tee

The previous section records four attempts at relaxing the corridor trough behind the tee, all of them measured as failures, and a conclusion to leave it alone. That conclusion was wrong, and it was wrong because of the number it was judged on.

Every sweep treated **"sites needing real earthwork" as a cost**. It is not. A tee cut into a hillside is the thing being asked for — the owner's words were that excavating into a hill to make things better is fine. Scored that way, the same settings read completely differently. The only true cost is a blind shot, and by the time the sweep was repeated, siting valued a clear view at 10 rather than 1.6, which absorbs most of it.

Swept again, with every rule clear at every setting:

| relief | tees cut into real ground | raised for sightline | blind shots | step between tees, p95 / worst | off the centre line |
|---|---|---|---|---|---|
| 0 | 115 | 124 | 33 | 2.7 / 5.6 m | 13 m |
| **0.25** | **201** | **113** | **27** | 5.9 / 20 m | 19 m |
| 0.5 | 327 | 124 | 47 | 10 / 36 m | 23 m |
| 0.75 | 394 | 147 | 54 | 14 / 55 m | 25 m |
| 1.0 | 446 | 155 | 73 | 16 / 74 m | 27 m |

A quarter is better than none on every axis at once — nearly twice as many tees genuinely cut into ground, *fewer* propped up to see over things, and *fewer* blind shots. Past it everything degrades together, and the height between two tees on the same hole stops being credible.

The lesson is not about terrain. It is that a sweep is only as good as the thing it optimises, and "needs earthwork" had been quietly standing in for "is bad" through four rounds of measurement that all looked rigorous.

### Elevation zero is a baseline, not a promise

The tee area keeps its relief whatever the elevation setting says; elevation raises the corridor from there. That is a deliberate change of meaning, made by the owner.

The **driving range** keeps its own exemption and stays dead level. Flatness there is not a preference, it is the instrument: any tilt is a variable the player did not set, quietly added to every carry.

The two tests that asserted "elevation 0 means flat" now say what still holds. One turns *both* terrain controls off — with nothing for a tee to follow, any height it has was invented here rather than found. The other measures the **mown corridor** rather than the whole hole, which is what "playing surfaces" meant all along.

### Two faults this uncovered

**A neighbouring hole's tee area was bleeding into a fairway.** The landform function only knows the *nearest* hole, not the hole whose ground you are standing on, so where two corridors run close the tee relief of one reached 1.45 m into the other's fairway. The relief now ends 20 m before mown turf begins, which leaves the margin that mistake needs.

**The green guard was unlevelling tee pads.** It exists to stop a tee's shoulder spilling across a green's maintained surround, and applied to the whole blend it also stopped levelling the pad itself — so a tee near a green followed the natural slope, and on one hole that left a marker sitting below the one in front of it. The shoulder still fades out; the pad does not.

## Raised tees everywhere, merged collars, and a landform theory that was wrong

Four faults reported off two screenshots. Three had straightforward causes. The fourth was the interesting one, and the theory behind it — mine as much as the owner's — turned out to be half wrong.

**Mown collars were overlapping on 12% of tee pairs.** Siting can move a tee across the hole and nothing told it to keep out of its neighbour's way. Worth noting the pads themselves clashed only 3 times in 648, so a check on pads alone would have reported this as fine; it is the collars that merge into one blob of green on screen.

**Three tees near each other built three separate humps** with saddles between, because each pad settled to its own level.

**A brown scar across a green's surround.** The tee-shaping guard stopped at the green's fringe plus four metres, which leaves the mown *surround* outside it — so a tee's shoulder could still fall across maintained turf. On the old gentle ramp nobody noticed. On the new short shoulder it is steep, and mown grass is tinted dry past about six degrees, so it reads as rough painted over semi-rough. It is neither: it is semi-rough tinted as though it were burnt.

### The landform theory, and why it was wrong

The fourth report was that the base landscape puts a basin in the ground wherever a tee goes, leaving raised tees everywhere. The mechanism looked obvious and I agreed with it on sight: hills only grow *away* from a playing corridor, so every corridor sits at base level with the land rising around it, and `nearest` counts the ground behind the tee as full corridor even though nothing is mown there. The start of every hole is a flat bowl.

That is all true. It is also not what was causing the problem, and three attempts at it each made things worse:

| | sites needing real earthwork | blind shots | ground under a tee, p95 |
|---|---|---|---|
| unchanged | 67 | 53 | 1.79 m |
| full countryside relief at the tee | 402 | 150 | 8.50 m |
| relief at 25 / 40 / 60% | 172 / 234 / 317 | 64 / 74 / 97 | 2.66 / 3.53 / 5.58 |
| raised to meet its surroundings, not roughened | 253 | 117 | 7.02 m |

**A flat bowl is easy to site a tee on.** Handing siting the full countryside gave it rougher ground, not better ground — the opposite of the intent. And the last variant, which raised the tee area to the average height around it without adding the noise, failed for a different reason: the raise has to come back down to the fairway somewhere, and there are only thirty-odd metres to do it in, so the tee area became a ramp instead of a plateau.

Reverted, and then measured the claim itself instead of its supposed cause:

- tee height against the country 60 m around it: median **0**, p10 −3.5, p90 +3.5
- tee height against its own fairway 120 m out: median +1.6
- **pads raised to clear a blind shot: 198 of 702, or 28%, by a median of 2.7 m**

Tees are not sitting in bowls. The mounds are the *sightline lift*, and there were a lot of them because siting weighted flat ground at 3 and a clear shot at 1.6 — so it would happily take a blind flat spot and then build a mound to see over. Reweighting a clear shot to 10 is where that stops buying anything:

| clear-shot weight | pads raised | blind shots |
|---|---|---|
| 1.6 | 198 | 53 |
| 6 | 134 | 42 |
| **10** | **122** | **36** |
| 14 | 122 | 36 |

Not a trade: both got better, because choosing a site you can see from is simply cheaper than building one.

### After all four

| | before | after |
|---|---|---|
| pads raised for sightline | 198 (28%) | **122 (18%)** |
| tee shots blocked over 1 m | 53 | **33** |
| blocked over 3 m | 7 | **5** |
| mown collars overlapping | 77 (12%) | **8 (1%)** |
| height step between adjacent tees, p95 | 3.46 m | 2.70 m |

Collar overlap is scored rather than forbidden. Forbidding it outright left 14 clashes instead of 8, because a tee on a tight hole would find nowhere legal to go and fall back to where it started — which is often the overlapping spot it was trying to escape. The worst site still beats no site.

Where two collars would still run into each other, the pads share a level so the shaping blends them into one platform instead of three humps. The highest wins, since dropping a tee to meet a lower neighbour would undo the sightline it was raised for.

**The corridor trough is still there and is left alone deliberately.** It does real work — it is what makes a hole read as a corridor from the tee — and every attempt to weaken it at the tee end measured worse. What remains true is that the ground behind a tee is flatter than the country around it. That is now a known property rather than a suspected fault.

## Tees sited on ground that suits them

Every tee used to go straight down the middle of the hole at a fixed fraction of its length, and the land was then forced to become a tee there. Every complaint about how they looked came from that one decision: the wide excavated footprint, the ramps reaching into greens, the sense of a pad dropped onto a hillside rather than built into it.

Turned round, each pad now tries forty-odd nearby sites and takes the one the ground already suits. Flat ground scores highest, which is the actual cure — the footprint only ever existed to absorb a drop we were creating ourselves.

Nothing in the scoring says "put the back tee on a rise" or "tuck the forward tee in beside the fairway". Those simply win where they are the flattest, clearest option, which is why the variety looks placed rather than sprinkled.

| | |
|---|---|
| pads that moved from where the hole first put them | 653 of 678 |
| how far a pad moved, median | 19.9 m |
| how far off the centre line a tee sits, median / p95 | 10.1 m / 36.4 m |
| unevenness of the chosen ground, median | 0.85 m |
| sites still needing real earthwork (over 1.5 m) | 67 of 678 |
| tee shots blocked over 1 m | 80 of 810 to **53** |

### Why the sites are bounded

Tees are chosen long before any terrain exists, and the rest of the hole is built from them — where the fairway starts, where ponds and bunkers go. Re-siting freely would pull the hole out from under its own features.

So the hole still commits to a rough tee area, and the pads are re-sited once the land exists: freely across the hole as far as the corridor allows, and up to 20 m along it. That is enough for every shape the owner described and little enough that nothing downstream moves. Yardage is recomputed from where the tee actually ends up, so the card cannot lie about the hole.

### A rounded shoulder, not a long ramp

The old reach grew with the drop — 14 m plus seven times it — so a tee needing a lift disturbed ground 40 m past its collar. That width existed only to keep the slope gentle, and the owner's call is that the slope does not matter provided the edge is round: a tee above its surroundings on a short curved bank reads as built, where the same tee at the centre of a 50 m saucer reads as excavated.

The shoulder is now short and the steepness is whatever the drop makes it. It flattens at both ends, so it meets the collar and the natural ground without a crease at either.

The obvious worry is that this just trades a saucer for a cliff, and the first attempt at it did look that way: the slope around a tee rose from 8.6° to 14.8° at the median with a 55° worst case. But the comparison that settles it is not against the old behaviour, it is **against the countryside the tee sits in**:

| | around a tee | ordinary rough |
|---|---|---|
| smoothness (angle between neighbouring surface normals), median | 2.4° | 0.8° |
| same, 95th percentile | **4.4°** | 13.7° |
| same, worst | **14.5°** | 37.1° |
| slope, median | 12.2° | 14.4° |
| slope, 95th percentile | **20.7°** | 43° |
| slope, worst | 51.4° | 57.6° |

Ground around a tee is now gentler and smoother than the landscape around it at every point except the median smoothness, where there is a deliberate shoulder and the countryside has nothing. The 55° figure was the mountain, not the tee. That is the whole answer to "is the edge acceptable", and it could not be reached by looking at the tee alone.

### Three things this broke

**The flat-course staircase, again.** Rewriting the block dropped the rule that the height step between tees scales with how uneven the ground actually is, so a dead-flat course got 0.70 m of rise and the driving range tilted. It is scaled by the chosen site's own unevenness now, which is zero on flat land. This is the second time the same fault has been introduced by the same kind of edit; the `elevation: 0` contract caught it both times.

**Four tests assumed the back tee was at the hole's origin.** `h.surface(0, 0) === 'tee'` was true only because a tee had always been placed there. It is an incidental fact, not a rule. They ask about the back tee's actual position now, and the real rule — every marker stands on some pad — is asserted directly.

**Nothing else.** The eight measured invariants held throughout: no pad on a green, in water, in sand or off its hole; no marker adrift; no tee below the one in front of it.

## One tee on a short hole, and earthworks that stay off greens

Two reported faults, measured over thirty courses before touching anything.

**Every par three had overlapping tees. All 66 of them**, and 21% of all tee pairs overlapped somewhere. The cause is arithmetic rather than bad luck: spacing between tees is a fraction of the hole's length, so on a short hole the three markers land 9 to 12 m apart while each pad is 16 m long. They cannot not overlap.

A real short hole answers this with one long tee and the markers set at different points down it, which is now what happens. The change that made it possible was separating two things that had always been one: the **pad** is the piece of ground, the **tee** is where you stand on it. A marker can carry a pad of its own size and position, or carry none and simply stand on a neighbour's. A tee that says nothing gets exactly the old behaviour, so the driving range and everything reading `TEE_PAD` are untouched.

The ground shader needed the pad's length per tee, and the data it already receives had an unused fourth slot per tee sitting there — so this cost nothing on the GPU side.

Result: **0 overlapping pads**, every marker still standing on one, par-three pads running 30 to 44 m long against 16 for an ordinary hole.

**Tee earthworks were reaching into greens.** 78 tees had raised ground reaching a green's area and the worst pushed 15 m inside one — the terrain seen clipping through a green and its fringe. Two causes. The reach itself was 14 m plus seven times the drop, so a 3.5 m lift disturbed ground nearly 40 m past the mown collar; three tees each reworking a 50 m circle is most of the ground at the start of a hole, and it reads as excavation rather than landscape. And greens are shaped first while tees are shaped last, so a tee's ramp simply overwrote whatever the green had decided.

The reach is halved, and tee shaping now fades out before it arrives at a green.

| | before | after |
|---|---|---|
| steepest patch on a green | 9.9° | **2.2°** |
| 95th percentile | 9.3° | **2.2°** |
| relief across a tee pad, worst | 0.58 m | **0.07 m** |
| relief across the mown collar, worst | 0.58 m | **0.18 m** |
| slope of the bank leaving a tee, median | 5.2° | 8.6° |

The last row is the trade and it is the right way round: a smaller footprint means a steeper bank, and 8.6° is still gentle.

### One missing dice roll moved a whole course

The first version of the short-hole branch drew one random number per tee where the long-hole branch drew two for all but the back tee. One missing draw shifts everything that reads the hole's seeded stream afterwards — ponds, bunkers, contours — so a green surround on a mountain course went from gentle to 39 degrees, nowhere near a tee, for a change that was supposed to be about tee layout.

It cost three separate investigations to find, because each one ruled out something that looked much more likely: disabling the green guard left it identical, and restoring the old ramp left it identical **to the last decimal place**, which is the tell. A number that does not move when you change the thing you suspect is not being produced by that thing.

Both branches now take the same draws in the same order.

### A route that cannot be used should not lose the channel

Two further failures came out of the terrain moving, and both were real weaknesses rather than bad luck.

A links seed came back with **no water at all**. Both of its routes had been found and then failed the profile fit — the bed would not stay within `MAX_CUT` — and a spec whose route failed simply produced nothing. It asks for four times as many candidate catchments as it needs now and takes the first that works.

And on a mountain seed two stations sat 19 m inside a fairway with a hundred metres of open ground beside them. Tracing the clearance loop showed why: the worst requirement cycled **29.4 → 24.2 → 29.4 → 24.2** and did that forever. Pushing the curve clear of the fairway made a bend that `relaxCurvature` then took straight back out. Damping does not help a two-state cycle, because nothing in it is converging.

When those two genuinely conflict, water does not belong on that line. The clearance pass reports failure and the route is rejected, which the fall-through above then handles. Channels placed went **up**, 87 of 90 to **90 of 90**, because a rejected route now costs a candidate rather than a channel.

## Finding the nearest hole was 15% of building a course

`nearest` answers "which hole is this patch of ground nearest, and how far outside its corridor does it sit". Every grid the generator builds asks it for every cell, and it measured against all nine holes every time, including ones on the far side of the property. The profile put it at **15.3% of a whole course**, and the centre-line work it drives -- `sideWidth`, `unitCenter`, `toLocal` -- at about **40% together**.

Each hole now carries a rough box around its centre line. The distance from a point to that box, less the widest the corridor ever gets, can never exceed the real answer, so once that lower figure is worse than the best hole found so far the hole is skipped without doing any of the real work. Two details make it bite: the hole that won the previous call is measured first, because ground is asked about in scans and the previous winner usually wins again; and the per-group minimum behind `other` is only kept on islands, which are the only courses that read it. Keeping it everywhere would have forced at least one measurement per group of three holes no matter where the point was, which is most of what the box saves.

| | before | after |
|---|---|---|
| 18-hole course, water on | 15.8 s | **8.4 s** |
| 9-hole course, water on | 5.2 s | **3.4 s** |
| 9-hole course, no water | 3.0 s | **1.7 s** |
| island (keeps the group minimums) | 3.6 s | 3.1 s |
| whole test suite | 217 s | **140 s** |
| full 30-course measurement sweep | 30 s | **20 s** |

The island gains least, and for the reason above: it is the one biome that still pays for the group bookkeeping.

**And it changes nothing about the courses.** That is the claim a speed change has to make, so it was checked twice: the measurement baseline reported nothing moved, and a fingerprint over eight courses -- roughly fifteen hundred height and surface samples each, plus every tee position and water level -- came back byte-identical before and after. This is the first change in the project where proving that took one command rather than an afternoon, which is the harness earning its place.

## A measurement harness, because measuring was the bottleneck

The generator is judged by measurement -- there is no other way to know whether a change to terrain made it better -- and for a long time every question was answered by a throwaway script that rebuilt the courses it needed for itself, single-threaded. One session spent most of an hour on a single function, and the arithmetic of why is unflattering:

| | |
|---|---|
| one 9-hole world, water on | 5.3 s |
| machine cores | 32 |
| cores in use | **1** |
| measurement scripts run in that session | ~25, each rebuilding 20-30 courses |
| redundant regeneration | roughly 50 of the 60 minutes |

Two multipliers were going unused, and they compose. Share one generation pass between every metric instead of each script building its own; and build the courses across the cores that are sitting there. `tools/bench.mjs` does both: **768 seconds of generation in 29.7 seconds of wall time, 25.8x.**

A generated world is full of closures -- `height`, `surface`, `toWorld` -- so it cannot be posted across a thread boundary. That is not an obstacle to work around, it is what settles the design: the worker runs the *metrics* too and returns plain numbers.

Three tiers, because the cost of asking is what decides how often you ask. `quick` is four courses in about seven seconds, cheap enough to run after every edit; `full` is thirty in thirty. The discipline of iterating small and confirming wide only works if the small one is genuinely cheap.

### It found a bug in its first full run

The suite was green. The harness, on a wider fixture, reported 58 channel stations inside a fairway on two courses -- both seed `S5`, which the test fixture does not include. That was a real consequence of the corridor ridge fix from the previous session, and a nicely circular one: **raising a corridor into a hill is what stops water crossing it, and a hill is also where water starts.** The upstream trace that finds a channel's head climbs the steepest parent, so it climbed the new hill and put a headwater 26.8 m inside hole 3, which then ran 29 stations down the fairway.

The keep-out pass downstream cannot repair that, because a source is not a detour -- there is no direction to push it that makes it belong. The head is excluded where it is chosen instead, and required to start 20 m clear, because stopping it at the first cell off the corridor left it on the fairway *edge* where meander walked it straight back on (29 to 18 to 20 across those attempts).

What finally closed it was a defect the trace proved rather than another guess. The clearance loop's step was capped at a flat 5 m and damped to 0.55, so it moved 2.75 m per round -- and the worst case was a head **87.5 m** inside a corridor, needing 32 rounds when it had 30. The trace showed it converging 87.5 to 15.6 by round 24 and then turning round and climbing again. Damping alone already lands short of the target every round, which is geometric and settles; it was the flat cap that made the approach linear and made it run out.

Zero violations, 87 of 90 channels still placed.

### Why the metrics import their geometry

`sightline` moved out of `course.js` as an export so the generator and the measurement call the same function. This is the one rule the harness has, and it is there because four measurements in this project have lied:

- pond clearance scaled a normalised oval distance by the **minor** axis, and reported eight breaches that had never happened
- the sightline ray was drawn straight through world space in one place and along the centreline in the other; on a dogleg those are different lines over different ground
- three beach measurements in a row disagreed before a mown-centreline metric settled it
- a lake-on-pond check consulted only the lakes that pass had placed

Every one recomputed what it was checking. A number that is wrong is worse than no number, because it gets acted on.

### The test suite: structure fixed, wall unchanged

The runner puts each file in its own process and runs them in parallel, so the suite's wall time is its slowest single *file*, not its total work. `water-terrain.test.mjs` was 326 s alone, more than the whole suite's 212 s wall.

Worlds are now memoized per file, and that file is split in two. Both are right, and **neither moved the wall**, which is still 217 s. Memoization only helps where a file builds the *same* course twice and that file mostly builds distinct ones; splitting helped that file and merely promoted the next one. Six files are still over 100 s, and the remaining fix is mechanical -- keep splitting, or cut fixture sizes and lose coverage.

Profiling one generation says where the real ceiling is: **`nearest` is 15.3% of a course**, and with `sideWidth`, `unitCenter` and `toLocal` the hole-centreline math is about 40%. `nearest` walks all nine holes on every call and has no spatial rejection. A world-space bounding box per hole, skipped when it cannot beat the running best, would cut most of that -- and unlike splitting test files it would speed up the tests, the harness and the game's own loading together. Sampling the corridor once per drainage cell rather than twice, tried here, was inside the noise; the calls that matter are elsewhere.

## A tee plateau shaped like a box, under paint shaped like an oval

Reported as odd shading artifacts around the raised tees. The tee surface and its mown collar are both ellipses — `localSurface` tests `(dx/6)² + (dz/8)² < 1` — but the ground was flattened over a *box*, `max(|dx| − 6, |dz| − 8)`. At each of the four corners the flat ground therefore jutted about 3 m past the painted tee, so the shading broke along a rectangle that nothing on screen agreed with.

The plateau also stopped at the pad rather than the apron, which left the mown collar sitting on the ramp: **0.33 m of relief at the median and 0.82 m at worst**, a maintained surface visibly tilting away from the dead-flat pad inside it.

Both are one change — normalise into the apron ellipse and convert back to metres along the ray, the same idiom the pond shelves use — plus a wider, gentler ramp.

| | before | after |
|---|---|---|
| worst angle between neighbouring surface normals around a pad | 2.6° median, 3.8° p99 | **0.8° median, 2.3° p99** |
| steepest ground around a pad | 10.1° median, 11.6° p90 | **5.0° median, 7.5° p90** |
| relief across the mown collar | 0.33 m median, 0.82 m max | **0.01 m median, 0.35 m max** |

`PAD_REACH`, the box within which a pad is considered at all, had to grow with the ramp: at 78 m a full-lift pad wanted 98 and got 64, so the falloff was cut off part way down. Median normal jump across that 68–92 m band, 11.7° to 8.5°.

## Blind tee shots became a dial

`blindTees` is the share of holes allowed to keep a blind tee shot instead of having the complex raised until the shot clears. Drawn per hole from its own seeded stream, so moving the dial does not reshuffle anything else. Only holes the land actually makes blind can be chosen, so the true rate tops out at whatever the terrain supplies.

| setting | holes chosen to stay blind | holes actually raised |
|---|---|---|
| 0 | 0 | 107 |
| 25 | 72 (27%) | 74 |
| 50 | 132 (49%) | 53 |
| 100 | 270 (100%) | 0 |

The default is 0, which is exactly the behaviour signed off in the previous pass. Worth knowing that the *observable* rate moves much less than the dial does — blue tee shots blocked by more than a metre run 5%, 6%, 6%, 11% across those four settings — because most of the 107 lifts are clearing sub-metre obstructions that were never blind enough to notice.

## The corridor ridge was a plateau, and it cost an hour

The keep-out that stops a channel crossing a fairway is a two-part mechanism: the drainage model raises corridors so routes go *between* holes, and a repair pass pushes the finished polyline clear of what meander and corner cutting put back. Changing the tee ramps moved the terrain, and the repair pass started failing. Five attempts at fixing the repair pass, in order:

1. Move `relaxCurvature` inside the convergence loop, since running it last meant nothing verified its work. **6 stations inside a fairway → 1.** A real bug, worth keeping.
2. Replace the finite-differenced push direction with an exact outward normal from `nearest`, which knows the hole and the centreline point. The difference is degenerate on the ridge halfway between two holes. **Kept — correct, though it moved the count to 4.**
3. Spread the displacement further so the detour is wider than the curvature limit. **Made it far worse, 1.6 m inside became 24 m:** a blur conserves the total displacement and crushes the peak, so a station needing 8 m moved 1.
4. Replace the blur with a tapered dilation, which keeps the peak and gains the width. **Correct in itself, still 4 stations.**
5. Damp the push and cap how far a station moves in a round, because a 32 m correction jumped clean across the next hole's centreline, flipped the outward normal and came back — measured oscillating 40 → 20 → 34 → 39 → 10 → 18 → 27 → 38 over ten rounds without settling. **Correct in itself, and still not zero.**

Every one of those was a better hammer. The nail was somewhere else. The ridge is

    CORRIDOR_RIDGE * (1 - max(0, c) / CORRIDOR_REACH) ** 2

and `max(0, c)` means that *inside* a corridor every point gets the same 22 m. **A constant offset preserves the gradient underneath it exactly.** The corridor was a raised plateau that water ran through precisely as it always had; the ridge only ever steered at the edges. That is why routes came out 40 m inside a fairway, and why a repair pass was being asked to do a router's job.

Letting the term grow past 1 makes a corridor an actual hill. **Zero violations, first try**, with 70 of 72 channels still placed and the median length unchanged at 446 m.

The lesson is about when to stop tuning. Attempts 1, 2, 4 and 5 all fixed genuine defects and are all still in the code — which is exactly what made the spiral convincing. The signal was not that any one of them was wrong; it was that each one moved the count (6, 4, 4, 4) without reaching zero. A repair pass that needs a third attempt is not under-tuned, it is repairing something that should not need repair.

## Where water is not allowed to go

Four rules, all owner decisions, all of them arriving after the drainage rewrite made the underlying routing trustworthy enough to constrain. Each was measured before it was asked for, and each was happening.

**A channel may not run over a green.** The drainage model raises greens 60 m in its working height field, so the *route* goes round them — and everything applied afterwards ignored that. Meander is up to 17 m of lateral offset, and corner cutting pulls a path across the inside of its own bends. Measured: water on **3 greens in 216**, as much as **16.2 m inside** one. Tapering the meander near a green fixes half of it at best, because corner cutting is the other half. So the *finished* polyline — the curve the player sees — is pushed clear and re-smoothed. Minimum clearance past a green edge is now **11.1 m**, and the median across all holes is unmoved at 270 m, which is the check that only the offending paths moved.

**A channel may not cross a playing corridor.** Rivers crossing fairways had been a feature, with its own blended-turf exception in the ground shader. Corridors are now raised in the drainage model the way greens are — a 22 m ridge over 45 m, lower than a green's dome because a corridor is a long wall and a course is mostly corridors; too high and the gaps between holes stop being a route and become a maze with no way through. **Zero stations inside a fairway**, 70 of 72 requested channels still placed, and the median length went *up*, 603 m against 461 before the constraint, because a channel following the gaps runs further than one cutting across.

**A channel may not run into standing water it did not create.** Two water surfaces meeting at different fitted levels is the same fault the lake-on-pond check was added for. Ponds and lakes already carried a routing radius; they now carry a keep-out as well. Measured across 151 bodies: nothing inside a pond, nothing inside a *shore band*, minimum gap **26 m** from the water edge.

*A false alarm worth recording.* The first measurement of this said 3 m and eight bodies breached. It was the metric: it converted the normalised oval distance to metres by scaling with the **minor** axis, which understates the true distance badly along the major one. Measured against the actual boundary polygon, nothing had ever been in breach. That is the fourth bad metric in this area of the code, and the same lesson each time — check what the number is measuring before believing what it says.

**A pond may bite into a fairway but may not cross one.** A pond that reaches the far side does not pinch a hole into two landing areas; it severs it, and the player walks round water the routing never planned a way past. The crossing branch is gone. What remains is bounded rather than rejected: `reach` never exceeds 0.70 of the half width and the shore is measured inward from the semi-rough edge, so the near bank cannot arrive at the centreline for any value the random stream can produce.

The first setting of that was too timid to be worth having — at 0.12 to 0.37 it reached past the fairway edge on 5% of ponds and never by more than 4.1 m, which is a shore beside a fairway rather than water in play. At 0.25 to 0.70 it is **one pond in six**, median 5.7 m and up to 13 m in, with **zero** crossings.

### The push has to be smooth along the path

Moving each station by what it needs and no more is what the first version of the keep-out did, and it put a corner wherever the requirement changed from one station to the next — at the edge of a pond's keep-out, or where a corridor ends. The tightest bend went to **0.00 of the half width**, which folds the inner bank through itself and flips the water quads face down; two existing tests caught it, one for curvature and one for normals.

The displacement is computed per station, smoothed along the path, and only then applied. Neighbouring stations move together, so the curve is *translated* rather than creased. Smoothing undershoots, so the requirement is recomputed and reapplied until it stops changing.

## A channel that ends in a hollow ends in a pond

The owner's choice over filling the sink or fading the channel out, and the requirement was that it be a **real pond object** — inheriting the cut bank, the shore band, the mown collar, the map outline, the reflection probe and the overlap rules, rather than becoming a second kind of water with its own copy of all of them. So the pond fit was extracted to `fitPondBasin` and the terminal pond goes through exactly it.

Getting there took three wrong answers, each of which the measurement caught.

**Every "sink" was the edge of the map.** The priority flood seeds the grid border and leaves it with no lower neighbour, so `down` is minus one there for precisely the same reason it is in a real depression. Reading that as a sink classified **all 44** of them as one, every single one sitting hard against the boundary — which is why every one failed the in-bounds test and not one pond was built. With the border told apart, the count went to **zero**: the fill's whole job is to give every cell a way out, so the only genuinely undrained cells are the sea, the border, and the depressions deliberately left unfilled. Those are the sinks, and the mask that marked them was called `lake` — a name that hid what it was. It is `sink` now.

**A channel stopped at the rim of the hollow, not the bottom.** Every cell of a surviving depression is undrained, so the descent broke the instant it arrived. Measured, channels were ending **3.5 to 21.0 m above** the floor of the bowl they had just reached. A channel now crosses to the bottom, stepping one cell at a time and taking, of the three neighbours that make progress toward the low point, whichever sits lowest — so it follows the shape of the bowl rather than cutting a chord across it.

**The pond was sized to the depression.** A surviving depression is a valley floor: 40 000 to 430 000 square metres, spanning 800 m. Its centroid sat **267 to 773 m** from where the channel actually arrived. The hollow says *where* the water collects; the channel says *how much*. The span survives only as a cap, so a pond never climbs out of the ground that holds it.

**And the channel ran straight through its own pond.** `carve` is the last thing `analyticHeight` applies, so it overrode the basin with the channel's own bed: the channel's water plane sat up to **3.1 m above** the pond it was draining into, over ground **2.5 m higher** than the pond's surface. Both halves of the join need the path while it is still editable and before the segment index is built from it, so the pond is created from a callback *during* routing rather than in a pass afterwards. The stations inside the water are dropped and the last 60 m is ramped down to the pond's level. The ramp only ever lowers a station, and both the existing levels and the ramp fraction fall toward the mouth, so the profile stays monotone — the one property the whole routing rewrite rests on.

Measured after: the mouth meets the shore within **0.1 to 3.0 m**, the two water levels agree **exactly** in five cases of six, and the sixth has the channel 0.90 m below the pond, which is a submerged mouth and correct. Worst uphill step anywhere along a channel: **0.0000 m**.

One bug in that ramp is worth keeping, because it failed loudly in exactly the right way. The distance-from-the-mouth array was seeded `[0]`, which puts the zero at index 0 — the wrong end. The last station's ramp fraction came back undefined, every level went `NaN`, and the measurement printed `NaN` in the one column that mattered rather than a plausible wrong number.

### The fill threshold, swept

`SINK_FILL_AREA` decides which depressions survive as terminal water. Over 24 courses, once corridors were being routed around:

| threshold | channels | median length | ended in a pond | faded out |
|---|---|---|---|---|
| 40 000 m² | 70 | 603 m | 1 | 17 |
| **15 000 m²** | **70** | **470 m** | **8** | **9** |
| 6 000 m² | 65 | 389 m | 14 | 1 |

15 000 is the one that is not a trade. It keeps every channel the larger figure did and shortens them only slightly, while turning ugly endings into real ones — a channel that fades out partway down a hillside has run out of cut budget, whereas a channel that ends in a pond has arrived somewhere. At 6 000 the fill stops doing its job: five channels are lost outright and the survivors are a third shorter, which is the model tripping into puddles again.

## A lake could be dropped on top of a pond

The separation test in `addLargeLakes` consulted `accepted` — the lakes this pass has already placed — and nothing else, so a lake was free to land on a pond that had existed since the hole was generated. Measured across twelve courses: **pond-pond overlaps 0, lake-lake 0, lake-pond 10.** The two working checks hid the missing one.

They do not merely touch. Each body carries its own fitted water level, so the worst overlapping pair had surfaces **14.19 m apart** — one body's plane hanging in the air over the other's basin, with two sets of banks cut through each other underneath.

Ponds are held in hole-local coordinates and lakes are placed in world coordinates, which is most of why the check was never written. Adding it costs nothing: **0 overlaps and all 36 requested lakes still placed.**

## Tees beside a creek, and a river that read as a trench

Reported on seed WANDER-7321 hole 5: tee boxes painted as plain semi-rough, and the channel in front of them too steep. Both were real and neither was the one I expected.

**The channel blend was repainting the tees.** Where a fragment is near a channel, the ground shader rebuilds the classification with softened boundaries -- a documented exception, granted so a hard fairway edge does not run through a soft bank. That rebuild is corridor geometry ONLY and knows nothing about tees, so a tee beside a creek came back painted as whatever the corridor says it is. Island tees looked correct throughout, which is the clue that solved it: islands carry no channels. The band work made it worse by pushing the rebuild's fairway term out by the shore band plus the semi-rough width. The rebuild is now suppressed over tee ground.

**A tee is flat where it is flat, and the tilt was three separate things.** `shapedLand` levels a pad exactly, and measured across the middle of one it holds 22.784 m to the millimetre. What moved it afterwards:

- `carve` runs after the shaping and its protection threshold is `o.r - 22`. A tee's `r` is 18, so the threshold was **minus four** -- about 11% of the channel carve still landed on the pad. Tees carry their own `flat` radius now, kept separate from `r` so channel routing still only clears 18 m of a tee rather than being pushed away from every one on the course.
- The ground mesh refines around greens, bunkers, ponds and channels, and never around tees. A 12 by 16 m pad on a 3 m grid is four cells across, with its edges wherever the grid falls.
- **And one attempted fix made it worse.** Returning the pad's own level exactly inside the pad, rather than the weighted blend, made the interior perfectly flat and put a STEP at the pad boundary -- worst spread 0.46 m to 0.59 and nine tees over 0.4 m against four. Reverted. The weighted blend is what keeps a pad continuous with its ramp, and the answer was never to abandon it.

Net: median tee spread 0.001 m to **0.000**, worst 0.46 to 0.50 -- the small rise being the ramp now resolved rather than averaged away by a coarse mesh.

**The river was a trench because the cut did not scale enough.** At the first scaling a 10 m river stood 0.95 m above its own water over a 2.16 m lip: 0.44, about 24 degrees. A pond is looked ACROSS and carries that happily; a channel is looked ALONG, and the same bank reads as an excavation. Channels now take roughly half the rise over a wider lip -- measured on the reported seed, the river's bank fell from 1.00 m to 0.58 m, near 0.11 rather than 0.44.

**And the tee is one piece of mown turf now**, pad and collar alike, which is the owner's preference -- made deliberately rather than left to the channel blend to do by accident on whichever holes happen to have a creek.

## Four regressions from the water work, and one cause behind two of them

Reported together: steep edges, tee pads no longer flat, channels much shorter, and the mown collar missing from tees.

**The foreshore was reshaping whole courses, not coasts.** It keyed on ELEVATION alone — anything below `BEACH_TOP` was eased toward sea level — so on links a tee **510 m from the water** fell from 11.34 m to 9.01 m. The drop was the smaller half of it. The easing curve `y·smooth(y/T)` has a derivative reaching about **1.67** in the middle of its range, so it AMPLIFIED every slope it touched by two thirds. That is both the steep edges and the tee pads: the worst pad spread grew 0.455 m to 0.760 m, which is that ratio exactly.

Gated on the coastal blend rather than on height, the shaping lives where the coast is. Worst pad spread returns to **0.46 m**, the original figure, and p99 to 0.25 against 0.23 before any of this. The gate had to be widened from `(0.15, 0.35)` to `(0.06, 0.24)` to keep the beach: at the first setting it measured 8 m against the 10 m that had been signed off, and at the second it is 10 m again with the tee figure unmoved.

**A three metre creek was getting a lake's cut bank.** `WATER_FREEBOARD` and `WATER_LIP` were applied flat, so a creek got the same metre-plus drop as a lake — a slot rather than a bank, measuring a median slope of 0.33 at three metres out where the old profile was 0.01. `cutFor` scales both with the body's width. Steep probes near channels on an inland course fall from **1.6% back to 0.8%**, against 0.7% before any of this work.

**Channels were not shorter where it counts.** Total length did halve, 4369 m to 2321 m, which is what prompted the report. But the portion ON THE COURSE went the other way — **447 m to 1666 m** — because ninety per cent of every channel used to be drawn off the map. What was genuinely wrong was stubs: one links channel came back 191 m, which reads as a fragment rather than as water crossing a landscape. Requiring a run worth drawing removes them, and the on-course figure rises again to 1862 m.

**And the beach was painting over the tee collars.** The beach block ran BEFORE the tee block and set `kind=5` on rough ground; the apron only claims ground that is still rough, so on a coastal course every low-lying tee silently lost its mown collar. `localSurface` settles the apron before the beach rule is consulted, so the LIE kept it and only the paint lost it — the same paint-and-lie split as ever, caused this time purely by the order of two blocks. The beach now runs after the tees.

## Cut banks for water, and a beach for the sea

**A pond read as a puddle in a saucer because it had neither of the two things that make a bunker read as excavated.** A bunker's floor sits about a metre below the ground around it and the ground is held flat to the rim before it drops. Water had a surface **0.18 m** below its lowest bank sample and a ramp **14 to 24 m** wide. Sharpening the edge alone would have produced an invisible 18 cm step, so freeboard and lip had to arrive together: the surface now sits `WATER_FREEBOARD` (1.1 m) down and the drop is spread over `WATER_LIP` (2.4 m). Measured across 352 pond rim samples: **25th to 75th percentile 1.10–1.11 m**, max 2.08.

The first attempt cut straight from natural ground to the water and produced a **7.81 m cliff** on uneven rims — the old ramp had been spreading that out of sight. The shipped profile is two stages: ground eases to a rim one freeboard above the water across the shelf the pond already owns, and only the last `WATER_LIP` metres are the cut, which makes the bank the freeboard by construction.

The painted bands were the same saucer in colour — on mown ground beside a 10 m pond the soil reached **7.14 m**. They are a lip now, **1.36 m**, so turf runs down the bank to meet a margin of wet soil the way turf sits over a bunker's rim.

**The ocean is excluded from all of that, because a coast is not an excavation.** It gets a beach instead, and the beach needed the landform changed rather than merely classified. Measured first: the island coast rose **a metre for every metre inland — forty-five degrees** — and the 4 m contour sat 8 m from the water. No classification rule makes a beach out of that; sand would have been a two-metre ribbon, and in fact the shader already carried an island-only sand TINT that never changed `kind`, so the shore looked sandy and played as rough.

`foreshore` eases ground between sea level and `BEACH_TOP` toward the water. It is anchored at zero, so **the waterline does not move** — island water cover measured 66.4% before and after. A plain power curve was tried first and rejected: anchored at both ends it meets the top of the beach at several times the natural gradient, putting a seventy-degree wall exactly where sand should be running out into dunes. Easing the height instead leaves both value and slope continuous at `BEACH_TOP`.

| BEACH_TOP | beach width (median) | sand cover |
|---|---|---|
| 8 m | 6 m | 2.7% |
| 12 m | 8 m | 4.0% |
| **16 m** | **10 m** | **5.5%** |
| 20 m | 14 m | 6.7% |

**The beach claims ROUGH ONLY, and letting it claim more was a real bug.** Allowing mown turf to become sand seemed obviously right — a fairway running to the sea ought to have sand between it and the water — and it turned **19.4% of the island corridor into beach across 24 of 27 holes**, reported as "sand fairways". The foreshore lowers a great deal of coastal ground below the sand line, so the sand line is no guide at all to where a hole stops being maintained. A hole is mown where it is mown; the beach starts where the maintained turf stops.

Measuring that fix was harder than making it, and three metrics in a row lied. Counting sand inside a lateral band around the corridor caught every fairway bunker. Counting points inside a hole's own fairway geometry caught the stretch between the tee and `mowStart`, which is genuinely rough. Counting them against the hole being iterated rather than the hole that OWNS the point caught ground a neighbouring hole is responsible for — the same ownership the shader's owner atlas uses. The metric that means what it says is the **mown centreline**, which is unambiguously fairway unless a hazard is on it: **0 sand cells of 3,788 on island and 3,649 on links.**

Sand is keyed to height above sea level, not distance, so a flat shore gets a broad beach and a steep one a narrow strip. It **plays** as sand as well as painting as sand, switching at `BEACH_RISE` in both the shader and the lie — the colour keeps fading for `BEACH_FADE` above that so the beach does not end on a contour line, and flipping the lie on the colour's midpoint instead would have put the two half a fade apart. Greens, fringes and tees keep their surface at any elevation, or a green shaped down near the sea would become a bunker.

## CC0 grass models: searched, and rejected on arithmetic

Asked whether a downloaded CC0 grass model could be the base of each grass type. Sources checked:

- [Poly Haven — Grass Medium 01](https://polyhaven.com/a/grass_medium_01): CC0, glTF/FBX/Blend, a dense tuft. **2 million triangles.**
- [OpenGameArt CC0 3D low poly](https://opengameart.org/content/cc0-assets-3d-low-poly), [itch.io CC0 3D collection](https://itch.io/c/4108149/cc0-3d-modelstextures), [Meshy CC0 grass](https://www.meshy.ai/tags/grass): CC0 and lower poly, but none near the budget below.
- [Sketchfab — Tree With Grass, CC0 textures](https://sketchfab.com/sketchfab.com): CC0 textures on a low-poly tree, not a grass base.

Nothing was taken, and the reason is not licensing or quality — it is that **this project's grass blade is three triangles**, and it is drawn between 4,200 and 800,000 times:

| | instances | triangles today | at 50 tris/model |
|---|---|---|---|
| links, ultra (`grass: 2`) | 800,000 | 2.4 M | **40 M** |
| most biomes, ultra | 220,000 | 0.66 M | 11 M |
| most biomes, low (`grass: .35`) | 38,500 | 0.12 M | 1.9 M |
| near-field tiles | 40,000 | 0.2 M | 2 M |

A 50-triangle model — already far below any of the assets found — is a **17× multiplier** on the single biggest instanced draw in the scene. The Poly Haven tuft at 2 M triangles would be 800 *billion* on a links course. Decimation to 3–8 triangles would leave nothing of the source model; at that point it is a hand-authored blade with extra provenance paperwork.

**Where an imported model would actually fit** is the near-field tuft only — 40,000 instances inside 24 m, where a 20–40 triangle tuft costs 0.8–1.6 M triangles. That is the one place the idea is affordable, and it is a separate decision from "the base of each grass type".

This is recorded because the search is otherwise repeatable: the assets exist, are properly CC0, and are the wrong shape for the problem.

## Wind that the whole scene agrees on

The course has always carried a wind bearing — `windDirection`, described in its own setting as the compass bearing the wind blows **toward** — and three systems read it: the ball's drift in `shot-visuals.js`, the clouds in `clouds.js`, and the HUD arrow. All three resolve it the same way, as `(sin a, cos a)` in world XZ.

The plants did not. `windMaterial` displaced along a hard-coded diagonal, `x + z*0.45`, with the gust phase taken from a second fixed diagonal. So on any given hole the ball faded one way, the clouds crossed the sky that way, the arrow pointed that way, and the grass leaned somewhere else. It moved, which is why it read as finished; it just moved wrongly.

The fix is one shared `windVec` uniform on the same convention. Two things changed with it:

**Displacement follows the wind**, with a lighter crosswind flutter on its own beat. Purely downwind reads as sliding along a rail; a blade wags.

**Gusts are phased ALONG the wind** rather than by position. `dot(instanceMatrix[3].xz, windVec)` means everything on the same line *across* the wind moves together and the gust travels downwind through the field. Phased by position on a fixed diagonal, every plant keeps its own schedule and a meadow shimmers instead of breathing — which is the difference between grass that is animated and grass that is in weather.

Neither costs anything: same instancing, same vertex shader, one more uniform.

**One inconsistency was left alone deliberately.** `breeze` is `0.55 + wind*0.07`, so a course set to zero wind still sways at 0.55 while the HUD reads "Perfectly still". Making it truly still is a one-character change and was not made, because dead-motionless vegetation may well look worse than the contradiction. It is the owner's call, not a bug to quietly fix.

## Reading undulation without relying on the sun

Terrain self-shadowing reads at a low sun and stops reading at a high one: at midday a two metre roll casts almost nothing. Two cues that do not depend on the sun's position were added to the ground shader, both off the surface normal the vertex shader already passes, so neither costs a texture read.

**Directional relief** tilts the turf's brightness toward a fixed low bearing — a raking light that is not the sun. The green has had this since green reading was built, at a gain of 4 clamped to 0.78–1.18, and it is why a green reads as a surface while the fairway behind it reads as a sheet. Mown turf and rough now get it at a gain of 1.5 clamped to 0.93–1.07: a green is being read for a putt, a fairway only has to look like ground.

**Crease darkening** uses the rate of change of the normal, `length(fwidth(n))`, which is high exactly where the surface bends — the lip of a hollow, the shoulder of a ridge — and near zero on anything flat however steep. It is normalised by the fragment's own world footprint, `length(fwidth(worldPosition))`, so the same roll reads the same from the tee and from underfoot; without that normalisation the effect is a function of camera distance and looks like fog. Capped at 13% darkening.

Measured cost of both: **8.5 ms median, unchanged** — they are arithmetic on a value already in the shader.

### Local relief replaced the crease term

The screen-space crease was measured against the alternative and lost. Sampling a real par 5 with 26 m of relief and shading it from straight above with no sun at all:

| Cue | ground marked (>3% change) | spread (sd) |
|---|---:|---:|
| Directional relief (shipping) | 86.7% | 0.100 |
| Discrete Laplacian — textbook curvature | **0.3%** | 0.004 |
| Local relief, 15 m radius | 69.5% | 0.079 |
| Local relief, 30 m radius | 81.3% | 0.082 |

**The textbook answer does not work.** A bunker lip or a green edge is hundreds of times more curved than a fairway roll, so any scale that fits them erases the rolls — which is also why the screen-space crease, built from the same quantity, was invisible.

**Local relief** — height minus the average height within a radius — has a radius to tune instead, and that radius is what selects the size of thing you see: a few metres gives surface texture, tens of metres gives landform, and **15 m is the roll a golfer is reading**. It is baked once at generation into a per-vertex attribute, so it costs nothing per frame and, unlike a screen-space derivative, never changes with camera distance. Normalised by the 90th percentile of its own magnitude rather than the maximum, so one cliff cannot flatten a whole course; a test asserts exactly that.

Applied at 0.15 off the green and 0.07 on it. The green gets less because it already carries a much stronger raking light of its own, and unlike the crease term this is smooth at the scale of a roll rather than noisy at the scale of a triangle, so it adds shape to a putting surface instead of grain.

### The three ground cues are switchable, and why they are uniforms

None of them costs anything worth measuring, so they are taste rather than performance and nobody should have to drop a quality tier to turn a look off. They live in the graphics store beside quality and the frame cap: `relief` and `slopeTint` default ON, `contours` OFF.

**They are UNIFORMS, never defines.** A define is part of the shader program key, so flipping one would recompile every lit material in the scene — the identical trap the floodlight toggle fell into for 2541 ms. A uniform is a float write. Measured: toggling any of the three costs one frame and compiles **zero** programs, and the ground material's program count stays at 51 across all three.

The uniform objects are created outside `onBeforeCompile` and handed to the shader by reference, so `setGroundCues` can write into them later; they are re-applied on every course build, because the ground material is rebuilt with the world and comes back at its own defaults. A test of that is a reload with the switches in a non-default state, which was run: relief off, slope off, contours on survived a full course rebuild.

**Coarse contours** draw a topographic line every metre of height across the whole course. The distance to a band edge is measured in BANDS rather than metres, so a line keeps its weight on a gentle slope and a steep one alike, and `fwidth` on the band coordinate gives its width in pixels — which is what lets the lines fade out where the ground is steep or far away instead of aliasing into moire. Frankly artificial, and the most legible of the three by a distance, because it turns a slope into a spacing you can count.

### Slope tint: the one cue that is not a brightness

Every other cue on the turf works in value — the raking light, the baked relief, the mowing stripes, the sun itself — so they all compete for the same channel, and a fairway carrying all of them ends up either washed out or muddy. Hue was unused, and it happens to be true: a slope sheds water and burns off first, a hollow holds it and stays lush. Greenkeepers water the tops of slopes for exactly this reason.

It also reinforces the baked relief instead of fighting it. The hollows local relief darkens are the ones that stay green; the crowns it lifts are the ones that go dry — two channels saying the same thing about the same ground.

Slope is measured as the TANGENT, `length(n.xz)/n.y`, not as `1 - n.y`. The latter is 0.06 at twenty degrees and 0.13 at thirty, which is almost nothing across the whole range a fairway occupies; the tangent is 0.36 and 0.58 over the same span.

**The first version then shipped with a threshold four times too high, and did nothing.** It ran from tan 0.12 to 0.55 — a guess at what "a slope" means, made without looking. Measured over a generated hole:

| surface | median | p90 | p99 |
|---|---|---|---|
| fairway | 0.057 (3.3°) | 0.151 (8.6°) | 0.167 (9.5°) |
| semi-rough | 0.065 (3.7°) | 0.150 (8.5°) | 0.167 (9.5°) |
| rough | 0.132 (7.5°) | 0.282 (15.7°) | 0.561 (29.3°) |
| green | 0.011 (0.6°) | 0.014 (0.8°) | 0.016 (0.9°) |

A golf course is **graded**. That curve touched 0.0% of the fairway and 0.1% of the semi-rough; the entire effect was happening in the rough, where it is least useful and least looked at.

**Mown ground and rough need separate ranges**, because one curve either does nothing on a fairway or saturates the rough into a single flat tone. Mown runs 0.035 to 0.16, rough 0.10 to 0.45, which puts each in its own middle: mean dryness went from 0.00 to 0.30 on fairway and 0.00 to 0.33 on semi, while rough moved 0.10 to 0.16 rather than pinning at 1.

Greens stay untinted at any threshold, and that is correct — they are graded to about half a degree and they are watered.

**And even with the range right, it was still invisible — because the strength was too.** Reported again, measured again. The mean colour change on a fairway pixel was **1.3, 0.7, 1.8 out of 255** — under one percent, with a worst case of 6. A hue shift that small does not survive a toon ramp, or anything else.

The tint is now `vec3(1.16, 1.00, 0.50)` against `vec3(1.10, 1.03, 0.80)`, the mown range starts at tan 0.015 instead of 0.035, and the fairway's own gain went from 0.55 to 1.0 — it was halving an effect already too small to see. Mean blue change on a fairway pixel: **15 to 20 of 255**, about ten times the first attempt.

Blue carries it. Grass drying loses blue first and gains a little red, while the green channel barely moves — holding green at exactly 1.0 is what keeps turf recognisably turf rather than turning it brown. Checked at full dryness across biomes: pnw fairway `83,134,55` goes to `96,134,28`; links rough `168,157,101` to `195,157,51`, which is fescue rather than damage; desert rough `185,153,103` to `215,153,52`. A stronger setting was tested and rejected — at `0.38` blue, desert rough reaches `226,156,39`, which is orange.

**The lesson, three times over in this file:** every failure here was a magnitude guessed rather than measured. The Laplacian was too fine for a fairway roll, the slope threshold too coarse for a fairway slope, and the tint itself too weak to see. Each took a minute to measure and each had shipped without being measured. The rule this earns: before tuning a visual effect, sample the field it runs over and print the number it will actually produce.

The shift is applied as a multiplier on whatever the biome's turf already is (`vec3(1.10, 1.03, 0.80)`), so a links course goes further into its own fescue and a desert course into its own sandstone, rather than every biome converging on one straw colour. Gain by surface, which is irrigation in effect: green 0.15, fringe 0.35, fairway 0.55, rough 1.0. Sand and water are excluded.

**A measurement caution recorded honestly.** The frame times taken earlier in this work (8.3–8.5 ms) and those taken after it (14.5–16.9 ms) are the SAME code at different machine states. An A/B on the spot — the shader with the tint against the checkpointed one without, built and measured minutes apart — gave 14.5–15.6 ms with and 15.7–16.9 ms without, which is to say no measurable cost. Only same-sitting comparisons in this file mean anything; the absolute numbers across sections do not.

### Mowing stripes now follow the ground

They had always been computed in the PLAN, a function of x and z only, so they ran dead straight over a roll and said nothing about it. On real turf a stripe is grass bent one way or the other and the mower follows the ground, so two things happen over a rise: the bands bend, and their light-dark contrast changes, because the angle the grass makes with the eye changes with the ground it grows on.

Both are nearly free. The bend is a height term in the stripe coordinate — continuous everywhere, unlike a true arc length, which is not integrable in closed form. The contrast comes from the component of the surface normal along the mowing direction, rotated into hole-local space because that is the space the stripes are laid out in. Contrast widens on ground falling away along the mow line and narrows on ground rising into it.

**Making them follow the ground then made them disappear from it — twice, by two separate mechanisms of my own.**

The first was the anti-alias fade. Stripes mix to neutral once a band is about a pixel wide, because past that there is nothing to draw but moire. That fade was measured on `fwidth(coord)` — and `coord` now carried the height term, which changes fastest exactly where the ground is steep or seen at a grazing angle. So the bands faded out on slopes and in the foreground, which is precisely where they had been changed to be useful. It is measured on the PLAN coordinate now: genuine screen compression still fades them, the bend no longer suppresses itself.

The second was the contrast term. `spread = .115 + along * .5` is additive, so it crosses zero at `along ≈ -0.23` — about eleven degrees tilted against the mow line — and a whole class of slope had no stripe contrast whatsoever. Scaling instead of adding, `spread = .115 * (1 + along * 2)` clamped to 0.06–0.20, keeps the bands present at every slope while still letting the ground modulate them.

Both were found from a screenshot of a near sloping green with no bands on it at all. Neither would have shown up in a frame time or a test.

Measured cost of both changes together: **8.5 ms median, unchanged.**

**The first version applied both to everything, and greens got worse.** The crease term is the rate of change of the normal, and a green is the most finely contoured surface on the course — so it produced the noisiest possible result exactly where the surface was already being shaded for reading a putt. Greens now keep their original relief term untouched and take no crease term at all, and water is excluded from both: it has its own shading, a reflection and a normal map of its own, and a raking light over the top of that reads as dirt. The fairway and rough gain went from 1.5 to 2.6 (clamp ±7% to ±12%) after the first pass turned out to be too subtle to see.

Worth recording that mowing stripes were proposed for this and already existed: fairway at a 12 m period and green at 3.2 m. They are computed in the PLAN, from `p.x` and `p.y` only, so they do not bend over a roll the way stripes on real turf do. Making them follow the surface is a separate change.

## Course floodlighting for night play

### Toggling the floodlights recompiled the whole scene

Three.js builds its lighting uniforms from the **visible** lights in a scene, and every lit material is compiled against that count. The lamps were created hidden and shown on the toggle, so switching the floodlights on changed the light count and forced a recompile of every lit material in the course. Measured on a nine-hole course with 57 lamps: **2541 ms** of frozen picture on the first switch-on, and **12 ms** on every toggle after it — the signature of a one-off compile. It was worse in Course studio, where the world is larger.

Two fixes were measured. Pre-compiling the floodlit variant during generation took it to **554 ms**, then **270 ms** once the masts were included in the warm-up walk — better, but still a visible hitch, because 22 and then 3 programs were still being built at toggle time.

The fix that worked then was to stop changing the count: the lamps were created **visible at zero intensity** and only their intensity was switched. The light count was constant, everything compiled once while the course was being generated, and the toggle was **18.7 ms in the studio with zero programs compiled**. This is the same reasoning the ball's point light already carried. **Reversed 28 September (B6):** that put every lamp into every lit shader at load, which is most of the 2-3.5 s the loading screen spends on the graphics card; the lamps are hidden while off again, and both states' programs are now built ahead -- see *Floodlit shaders built after the course is on screen*.

What it trades is a permanently wider light loop in every fragment, daylight included. Measured here that is inside the noise — **8.3 ms median with the lamps present against 8.5 ms without** — but it is real work, and a fragment-bound machine would feel it.

### What shadows from the poles would cost

Every shadow-casting light is an extra depth render of the whole scene, every frame. Measured on a nine-hole night course with 30 lamps, 1024² shadow maps, median frame time:

| Lamps casting | 0 | 1 | 2 | 4 | 8 | 12 | 20 | 30 |
|---|---|---|---|---|---|---|---|---|
| Frame (ms) | 8.3 | 8.5 | 8.5 | 8.6 | 10.2 | 9.8 | 9.7 | 12.9 |

All thirty casting is **+4.4 ms, about 50%** of the frame — survivable on this machine, and about 120 MB of shadow-map memory at 1024². The scaling is what rules it out at course scale rather than the nine-hole number: the longest eighteen builds **141** poles, which is roughly 141 extra depth passes and over half a gigabyte of maps. Four to eight of the nearest poles, at 512², sits in the 8.6–10.2 ms band and is the shape that would work. `lab.floodShadows(n)` is the instrument these numbers came from.

### Shadows from the poles on the hole you are playing

The table above rules out lighting a whole course with shadow-casting lamps, but not a handful of them. Which handful is not a question of distance alone: a pole on the next fairway throwing a shadow across a tree line nobody is looking at costs exactly as much as one over the ball.

Two things are part of a three.js shader program key, and both were traps. The **number of visible lights** is one, which is what made the toggle cost 2541 ms. The **number of shadow-casting lights** is the other, so switching `castShadow` per hole would have recompiled the scene on every tee. The casters are therefore a fixed few, decided when the course is built and never changed — four on high, six on ultra, none below — and `orderPoles` hands those lamps to the hole being played, nearest the ball first. The poles move between the lamps; the flag never does.

`shadow.autoUpdate` is what keeps them from costing anything in daylight. With it false three skips the depth pass entirely, and a stale map behind a lamp at zero intensity contributes nothing to the picture. Measured on ultra with six casters at 512²: **8.4 ms in daylight, 8.3 ms floodlit, zero programs compiled on the toggle** — the shadows are inside the noise, which the 1024² sweep above suggested they would be at this count.

**And then it did not render at all, for a reason frame time never hinted at.** Every shadow-casting spot light costs a TEXTURE SAMPLER in every lit fragment shader, and WebGL guarantees only `MAX_TEXTURE_IMAGE_UNITS` = 16. Three CSM cascades, the toon gradient map, the environment map and the ground's own data atlases already spend nearly all of them. Six casters pushed past the limit, the program failed to link — `FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)` — and a program that does not link does not draw, so the **ground disappeared**. It shipped that way and was caught by the person looking at it, not by any measurement here.

The ceiling was then found by walking the count up on a night course with the console watched:

| Casters | 1 | 2 | 3+ |
|---|---|---|---|
| Links | yes | **no** | no |

**Exactly one.** So floodlight shadows are off on every tier, and the constraint is a sampler budget, not milliseconds. Freeing a unit is what this needs — one cascade fewer on high, or packing the ground atlases — not a smaller cap. One caster does link, but a single pole throwing shadows while its neighbours throw none is arguably worse than none at all.

The ordering machinery is kept: `orderPoles` hands the lamps to the hole being played, which still decides which poles are LIT when a course has more poles than the lamp cap, and it is the mechanism any future caster budget would use.

### Terrain casts its own shadow

The ground received shadows but never cast them, so trees and buildings shaded the turf while the turf shaded nothing — a ridge did not darken the hollow behind it, and undulation was legible only from the green-reading overlays. It is one extra draw call per cascade over geometry that already exists: measured at **8.6 ms median against 8.5 ms** without, which is inside the noise. The normal bias that keeps a self-shadowing surface from turning into acne is per quality tier (0.15 on the lower two, 0.055 on the upper two) and is shared with the cascades.

Sports lighting is designed to published levels and layouts, so the poles here are placed from that guidance rather than by eye.

**Mounting height.** Driving ranges and golf practice facilities use poles of 30–60 ft (9–18 m); baseball fields use 70–100 ft, and some professional stadiums up to 120 ft. Taller poles reduce glare and widen the distribution, at the cost of dominating the skyline. Fairway uses **23 m (75 ft)** — the bottom of the ball-field band, not the golf one. It started at 18 m, the top of the golf band, and was raised after looking at it: a fairway is a far wider target than a driving-range bay, and the lower mast threw a pool that read as a street light rather than a lit hole. Both bands are published practice, so this is a choice between them rather than a departure from either, and the test asserts the union of the two so that leaving both has to be argued rather than typed.

**Spacing.** The governing rule is that pole spacing should stay **within three times the mounting height** for acceptable uniformity. Spacing is therefore derived from the height rather than set beside it: at 23 m it is 69 m between successive poles, and raising the mast widens it on its own. They alternate sides of the hole, so each side carries a pole roughly every 138 m. Alternating is not decoration — poles down one side light the far rough and leave the near tree line in shadow, and on a curved hole they all end up inside the dogleg.

**Coverage.** A single high-mast pole is quoted as covering a radius of 50–200 m depending on height, wattage, beam angle and aiming. Fairway stays near the low end, **62 m of useful radius** at 23 m of mast, and scales it with the height: a taller pole genuinely lights more ground, and pinning reach while raising the mast leaves gaps between the pools. Taking the high end would light a whole hole from two poles and look nothing like a lit course.

**Greens are lit from two directions, not one.** This is the same reason a ball field carries four poles rather than one tall one: the uniformity guidance asks for no more than 2:1 between the brightest and darkest part of the target, and a single direction cannot deliver it — every contour, every bunker lip and the flag itself throws a shadow across the putting surface with nothing to fill it. Each green gets a **pair flanking the back at 45° either side of the line of play**, so their two shadows fall in opposite directions across the surface and each fills the other's; the fairway run stops short rather than driving a pole between them. **Neither is placed in front of the green**: a pole between the fairway and the putting surface is in the line of play and shines straight back at the player standing in it, which is the one place sports lighting never puts one either. The pair clears the whole complex — surface, fringe and semi rough — by a further **10 yd**, so a missed approach cannot finish against one.

**Level.** Recreational outdoor play is specified at 200 lux, intermediate at 500, professional and broadcast at 750–1000; high-school baseball is commonly 500 lux infield and 300 outfield. A lit fairway is a recreational case, so the target here is the **200 lux** end. Uniformity guidance asks for a ratio of 2:1 or better between brightest and darkest, and 2.5:1 or better in an outfield, which is the same concern as the spacing rule above.

**What is adapted rather than taken.** These figures describe fixed installations designed for play under floodlight. Fairway gives every pole a real light — shadowless, so lighting all of them costs nothing measurable — rather than computing a full photometric solution, so the *placement* follows the standards and the *intensity* is set to look right in a toned, cartoon frame rather than to deliver a measured 200 lux. The poles are also kept a clear **18 yd beyond the semi rough** along the fairway, which is a playability decision and not a lighting one — a pole is an obstacle, and the lighting would rather they were closer in. Measured on a night course, switching them on lifts mean frame luminance from **54 to 80** on a 0–255 scale and takes the share of pixels above 120 from 1.9% to 8.3%, with frame time identical whether four poles are lit or all of them.

A note on measuring that, because it wasted time once: after a long session of repeated page loads the browser's numbers drift badly — frame medians doubled and the floodlights measured *faster* on than off, which is not a thing. The readings above are from a fresh load, alternating off/on/off/on, and they repeat. Treat any performance figure taken late in a heavily reloaded session as noise until it reproduces on a clean page.

Sources consulted:

- [PacLights — Baseball field lighting layout](https://www.paclights.com/learning-center/baseball-field-lighting-layout-plan-for-success/): pole counts and placement around a field.
- [PacLights — Baseball field lighting requirements](https://www.paclights.com/learning-center/baseball-field-lighting-requirements-explained/): illuminance by level of play.
- [LED Lighting Supply — Stadium lighting design](https://www.ledlightingsupply.com/photometric-plan/stadium-lighting-design): pole heights 40–100 ft, uniformity ratios.
- [LED Lighting Supply — Golf course lighting design](https://www.ledlightingsupply.com/photometric-plan/golf-course-lighting-design): fairway versus driving range as different lighting problems.
- [Access Fixtures — Driving range lighting design guide](https://www.accessfixtures.com/driving-range-lighting/): 30–50 ft mounting, 300–500 W fixtures.
- [REITA — Golf driving range lighting layout guide](https://reitalight.com/golf-driving-range-lighting-layout-guide/): the spacing-within-three-times-mounting-height rule.
- [Wikipedia — High-mast lighting](https://en.wikipedia.org/wiki/High-mast_lighting): 50–200 m coverage radius for a single mast.
- [FSG — Sports field lighting standards and layouts](https://fsg.com/sports-field-lighting-standards-layouts-complete-guide/): consulted for general layout practice; nothing taken beyond what the sources above already gave.
- [LEDVANCE — Basics of baseball field lighting](https://ledvance.com/en-us/professional-lighting/insights/blog/application/the-basics-of-baseball-field-lighting): consulted, no figure taken.

## Launch-monitor interfaces

[GSPro Open Connect v1 documentation](https://gsprogolf.com/GSProConnectV1.html) still documents version 1 and TCP port 921 at the research date. It describes DeviceID, ShotNumber, APIversion, BallData (Speed, HLA, VLA, TotalSpin/SpinAxis or BackSpin/SideSpin), ShotDataOptions, success code 200, and player/club code 201.

**The ClubData block, added 2026-09-24, and what is soft about it.** The card can
now show everything a monitor sends beyond the five the model runs on, which
meant reading a block the parser previously discarded. `readExtras` looks for
`ClubData.Speed`, `SpeedAtImpact`, `AngleOfAttack`, `Path`, `FaceToTarget`,
`Loft`, `Lie`, `ClosureRate`, `VerticalFaceImpact` and `HorizontalFaceImpact`,
plus `BallData.BackSpin`, `SideSpin`, `CarryDistance` and `TotalDistance`.

**These key names were written from knowledge of the v1 shape, NOT checked
against a fetched copy of the page in this pass, and the units on four of them
are assumptions.** Face impact is taken as millimetres and closure rate as
degrees per second; both are read as "whatever number arrived", so a device
using other units would print a wrong figure rather than fail. Nothing depends
on any of it -- a key that does not exist is simply a blank tile, and no extra
can reject a shot -- so the cost of being wrong here is a dash or a bad reading
on a readout, never a shot the player cannot hit. **It is still the first thing
to check when a real device is on the mat at the R50 session**, and a saved copy
of the page belongs under `sources/` the moment somebody can open it.

Smash factor and face to path are NOT in the protocol and are not sent by any
monitor. Both are derived here: smash is ball speed over club speed, face to
path is face-to-target minus path. Face to path stays blank when only one of its
two halves arrived, rather than reading the half as if it were the whole. The interface is openly documented; this does not mean the commercial simulator itself is open source. Fairway uses the documented message shape with its own server and does not redistribute GSPro.

The bridge defaults to unprivileged TCP port 1921; set FAIRWAY_TCP_PORT=921 only on a host configured to allow the standard privileged port. The bridge accepts fragmented and concatenated JSON objects, caps message sizes, validates ball data, relays one pending shot at a time, and waits for browser acceptance before acknowledging. The browser detects duplicate shot IDs. Reconnect starts a fresh duplicate window; don't resend historical shots after reconnect. Unexpected readiness/heartbeat frames with ContainsBallData=false or IsHeartBeat=true are acknowledged without creating shots. The optional 202 ready code is a community extension, not part of the original two-code specification.

Input convention: Units=Yards means Speed in mph; Units=Meters means Speed in km/h. Angles are degrees and spin RPM. The original public protocol's unit description is sparse. This convention is exposed explicitly because connector implementations can differ: verify metric behavior with a known-speed sample for each device. Unsupported units and missing/non-finite/out-of-range required ball values are rejected; there is no silent unit guessing.

Open-source connector projects inspected for integration paths:

| Path | Source | What is actually supported here |
|---|---|---|
| PiTrac | [PiTracLM/PiTrac](https://github.com/PiTracLM/PiTrac), [simulator integration docs](https://docs.pitrac.org/software/simulator-integration/) | Its Open Connect output can target the Fairway TCP listener; separate device/host configuration is needed. |
| Garmin R10 | [travislang/gspro-garmin-connect-v2](https://github.com/travislang/gspro-garmin-connect-v2) | Accept the community connector's normalized shot messages, not direct R10 Bluetooth. |
| Rapsodo MLM2PRO | [springbok/MLM2PRO-GSPro-Connector](https://github.com/springbok/MLM2PRO-GSPro-Connector) | Accept its Open Connect output; no bundled device driver. |
| OpenSkyPlus | [OpenSkyPlus/OpenSkyPlus](https://github.com/OpenSkyPlus/OpenSkyPlus) | Can receive an existing plugin's Open Connect output. OSP itself explicitly supports a limited set of monitors/apps; it is not universal hardware access. |

**rēlā's supported monitors** (read 21 October 2026, for the Launch monitor
screen's list, the owner's request). [rēlā's FAQ](https://docs.rela.golf/rela/faq/),
its Device Requirements table, names SkyTrak, GC2, FlightScope Xi/X2, GolfJoy,
Mevo+/Gen2, Square, Nova, Garmin R10, Full Swing KIT and Other; some need the
vendor's own app on the same PC (FlightScope Xi/X2, GolfJoy). Taken: the names
(`RELA_MONITORS`, ui-monitor-setup.js), with the makers' names added where
they are certain (Foresight GC2, FlightScope Mevo+); "Other" left out because
rēlā calls it "not a promise that every launch monitor will work". Read and
not used: [the docs' front page](https://docs.rela.golf/) and
[user guide](https://docs.rela.golf/rela/user-guide/), which have no list
(the guide names three putting devices -- LagKing, Right Edge Putt Tracker,
ROXOR JPutt Tracker -- and FSS needing Split Packets). None of these has been
tried with Fairway.

No physical launch monitor was available. Automated testing establishes framing, parsing, relay, readiness, origin checks, and acknowledgment behavior only. Actual device compatibility, licensing, connector installation, and firmware behavior must be checked on hardware. No claim of official vendor certification is made.

## Landscape and routing update

See [LANDSCAPE_RESEARCH.md](LANDSCAPE_RESEARCH.md) for the regional vegetation research, course aerial/map references, and procedural terrain/routing decisions.


## Cup dimensions and automatic putting

The modeled cup is 107.95 mm across; the ball rests on a floor 101.6 mm down (the USGA minimum) inside a bore drawn 115 mm deep. The rendered ball diameter is 42.67 mm. See [USGA hole dimensions](https://www.usga.org/content/usga/home-page/course-care/green-section-record/58/9/why-do-hole-edges-collapse-.html) and [USGA ball size](https://www.usga.org/equipment-standards/equipment-rules-2019/equipment-rules/part-4-rule-4.html). The white locator ring is a visual aid and is not the ball geometry.

Dartboard and decimal putting are simulator scoring conventions requested for this app, not Rules of Golf. Three user-selected distances control scoring. Decimal putting interpolates 1→2 and 2→3 between adjacent distances, rounded to two decimals; both automatic modes cap at three. Only the current green qualifies. The stroke that reached the green is counted separately. Team scramble applies the selected candidate's automatic putts.

## The driving range

A range is not a golf hole with the bends taken out. A generated hole wanders, draws its width from a random field, starts its fairway where the tee shot is expected to *land*, and necks into an approach at the green. Every one of those is right for a hole and wrong for a practice ground, whose whole value is that the surface is the same everywhere so the only thing changing between two shots is the shot.

**Dimensions.** 500 yd deep, 100 yd wide, dead flat, mown from 20 m behind the mats to the back of the field. Deeper than anyone carries on purpose, so a shot is never measured against the end of the property. Nothing is drawn from a seed — two visits are the same range, which is what makes it usable as an instrument.

**It is still a hole object, and that is the load-bearing decision.** The painted ground is GLSL in `ground.js`, and it never asks a hole what surface it is: it reads per-hole data textures built from `center(z)`, `fairwayWidth(h,z,…)`, the tee positions and the green. That shader is entirely generic over those, so a hole filling them honestly paints correctly with no shader work — and, more to the point, the painted ground and the classified lie *cannot* disagree, because both sides read the same functions. A bespoke `surface()` the shader knew nothing about would put the two out of step and the ground would then lie about the lie.

Two things had to change for a rectangle to be expressible that way:

- **`noNeck` on the hole**, read by `fairwayWidth`. It lives in that function rather than in the range builder because both the shader's width texture and `localSurface` call it; anywhere else and the painted corridor would drift from the classified lie.
- **`localSurface` tests the fairway before the green's semi collar.** See below — this was a real pre-existing bug.

**The green moves without shortening the field.** The shader reads the green's position from the `cups` atlas (`[green.x, green.z, greenSize, greenAspect]`), *not* from the hole's length; length only bounds the mown corridor. So the tools slider rewrites four floats and sets `needsUpdate`, and the field stays mown to 500 yd wherever the green stands. A test asserts the back of the field is still fairway at every green position.

**Every target is a real green (16 October 2026).** Until then the coloured targets were scenery: both the shader and `localSurface` knew exactly one green per hole, so a ball landing on the 150 target bounced as range turf. Now a hole may carry a LIST of greens (`h.greens`, range.js): `greenDistance` returns the nearest edge of any green in it, which makes `localSurface`, the hole map and the putting aids see every one, and the ground shader loops over the same list from a block of the per-hole table (`HOLE_ATLAS.greens`, three texels a green, the count in the third channel of the pin texel). Every course hole writes a count of zero, so its loop ends before its first read. The painted-ground test walks the whole range, short-game green included, and requires paint and lie to agree everywhere. Each target has a fringe, a collar, a cup and a flagstick; the colour moved to the flag, a painted ring just outside the fringe, and the sign.

Six of them, at 50 to 300 yd in 50 yd steps, alternating sides, the first on the golfer's right. The decisions in there:

- **The number is the distance from the mat, along the aim arc** (the owner's ask). They used to stand at z = their number and 33 m to the side, which made the 50 really **62 yd** from the mat and the 100 **106 yd**. Now each green's centre is exactly its number from the centre mat — everyone on the range plays off white (`enterRange`) — turned off the centre line rather than pushed sideways: lateral offset `min(30 m, 0.45 × distance)`, so the 50 sits 20.6 m off the line (27°) and the rest 30 m (16.5° at 100 yd, 5.4° at 300). **PLACED** by eye. A test asserts every target is its number to within 0.01 yd.
- **A target the centre green is standing on gives way to it.** The old rule derived the targets' offset from the centre green's reach so the slider could never drive the green through one; on the aim arc that would have swung the near targets 45-60° off the line. Instead a target whose rim comes within two fringes and two metres of the centre green is hidden — green, cup, flag, ring and sign — and is not a green while hidden (`hideCovered`). Slide the green to 150 and the 150 target is replaced by the green you put there. At most two are hidden at any slider stop (tested every 5 yd); at 150 only the 150 goes.
- **Target sizes grow with distance**: `6 + yards / 50` m, so 7 m at 50 yd to 12 m at 300, round (aspect 1) with small outline waves. **PLACED**: real ranges grow their far targets so they are about as hard to hit at any distance. Every one stays inside the 100 yd field with its fringe, and the 300's edge reaches 42.8 m of the 45.7 m half-width.
- **The colour ramp avoids cyan and azure**, because that band is what water and the slope-reading overlay occupy. The test checks this by **hue**, not by "is the blue channel largest": the first version rejected any blue-dominant colour and failed on the 250 yd purple, which is blue *and* red. Blue-violet is fine; teal is not.
- **The ramp is saturated past anything agronomic, on purpose.** It opened on a soft yellow and amber, and at midday on green turf those read as **sand** — the near discs looked like enormous waste bunkers rather than markings. Now the colour is only a ring and a flag, but the reason for the saturation stands.
- **Target flagsticks are 1.7 times a hole's and their cloth 2.2 times** (holdFlagsticks keeps the scale through the distant-flag growth), so they can be picked out from the mats, as the old 3.6 m sticks were. The physics' stick is the hole's own size wherever the live cup is: drawing only.
- **Aiming is choosing, from the mats.** The green nearest the aim point becomes the one played to — its cup is the live one (physics captures in `course.pin` and nowhere else), and the card's yardage and "Green" read it — but only within **12 m** of its edge, so an aim down the middle at 100 yd is not an aim at the 100 target 30 m to the side. **PLACED**; a first try at 25 m did exactly that.

**The short-game green (16 October 2026).** Beside the mats on the golfer's right: centre at x = -80 m, z = 18 m (about 90 yd from the mat, turned 77° right), 14 m by 1.15, so its collar clears the mown field by a stride and a chip never runs onto the range. **PLACED.** Range controls' *Hit from* puts the ball there: **Chip** from a set distance to the cup (5-60 yd, default 20) on ground that is not green — a chip asked for from closer than the green allows starts just off its edge — and **Putt** from 3-80 ft on the green (the longest putt that fits when the green is too small). *A new spot every ball* walks round the cup (golden-angle steps from a seeded start); *Play it out until it drops* keeps putting from where the ball stopped, within 40 yd of the cup. The club is picked by the distance (the putter on the green), and the lie is the real one — a chip from the semi pays the semi's ball-speed cost, where the mats pay none.

**Greens with a slope (16 October 2026).** The centre and short-game greens each take a set-up: flat, left to right, right to left (one plane falling across the green as seen from the mats, **0.5-4%**, default 1.5%), or random contours grown exactly as a course's greens are (`greenContour`, contour 10-90 on the course's green-slope scale, default 45, from a seed that *New green* steps). A shaped green is in the ground, so a change regrows the range (about 1.1 s, under the loading cover) and moving a shaped centre green rebuilds once on release. In the ground it is the contour inside the green and collar, **faded to the level field over 8 m** beyond the fringe and blended over a **12 m** shoulder (course greens use 40-100 m). **PLACED.** Faded because a tilted plane keeps rising past its edge: blended over a course green's shoulder it leaned the ground under the next target. A test holds every target and the field level under every set-up. Cups: cup 0 on a level green is its exact middle; on a random one the most central spot with 3 m of green round it and no more than **2.5%** under it (the flattest fifth on a green with nowhere that level), and *New cup* draws another. The bench's old request, `greenDifficulty` on the range's settings (`lab.green({difficulty})`), still grows the same contoured centre green from the same seed, so the lab's measurements did not move.

**The session's exports (16 October 2026).** *Export CSV* and *PDF report* in Range controls, from the shot rows the range has always kept (`recordRangeShot`, which now also records where a ball was played from and to, how far from that cup it finished, whether it dropped, and its descent angle). Nothing is re-derived. The files are in a golfer's units -- yards for carry, total and offline, feet for apex and a short-game finish, mph for ball speed -- and offline is a number with its side as a word (R or L), because the spreadsheet formula guard the scorecard uses (an apostrophe before a leading = + - @) would otherwise turn every left miss into text. The report's "±" is one standard deviation, as the range's readout has always used: one shank should not describe a session, and two shots in three fall inside it. The ring round each club on the dispersion chart is that standard deviation along and across the line, axis-aligned, drawn once a club has three shots -- a simpler picture than the map's ellipse (dispersion.js), which lies along the way the club misses. **Rejected:** a PDF library (jsPDF and the like are 300 KB and more of a 17 MB single file, for a few pages of text and lines), and the browser's print dialog over an HTML page (no file to keep without a second step, and it prints whatever the browser's margins decide). `src/pdf.js` writes the format by hand: the two standard Helvetica faces every reader carries, nothing embedded. **Its width table is Helvetica's advance widths as I recalled them from Adobe's published core-font metrics, not fetched**; they decide only where right-aligned text starts, figures are 556 in both faces, and the report rendered correctly in Chrome's viewer -- but a check against the AFM file is owed. Bold is approximated as 6% wider.

**The range's caption averages one club (16 October 2026).** "Average carry · offline spread" under the last shot was the whole session's -- a driver, a wedge and, since there are putts on the range, putts, averaged into a number describing no club. It is now the last shot's club's full shots; a chip or putt says how far from the cup it finished instead.

**No generator bump.** The range is never saved -- no round slot, no library -- so nothing old can rebuild under a ball, and `tools/biome-fingerprint.mjs --check` (which does not build the range) reported every biome unchanged. Courses are untouched: `greenDistance` only loops on a hole that has `greens`, and a course hole writes a count of zero into the atlas.

**The distance signs grow with distance.** A board legible at 50 yd is unreadable at 300, and every one of them is read from the same place — the mats — so holding the *angular* size roughly even is honest rather than a perspective trick. Real ranges make their far boards bigger for the same reason. Height runs `clamp(2.2 + yards * 0.014, 3, 7)` m. Each sign stands directly **behind** its target rather than beside it: beside would put the outer signs off the mown field, and behind keeps every one of them on the sight line a player actually uses.

## Field of view is a measurement in a bay, not a setting

On a laptop the field of view is a look: pick what frames the hole nicely. In a simulator bay it is geometry. The screen is a window, the golfer stands a measured distance from it, and there is exactly one vertical angle that makes what is drawn on the fabric line up with what would be there if the wall were not:

    vertical FOV = 2 * atan((screen height / 2) / distance to the screen)

Three.js takes the vertical angle and derives the horizontal one from the camera's aspect. In a bay that aspect is the measured screen's shape, not the canvas's (5 October): a projector stretches the window onto the screen, so a picture drawn in the window's shape is stretched whenever the two differ, and resizing the window would change the bay's geometry. Drawn in the screen's shape, the projector's stretch undoes itself. **Rejected:** keeping the canvas aspect, which is right only when window and screen happen to match. The cost is that on a display whose shape differs from the screen's (testing at a desk) the picture looks stretched; the panel says so.

Screens are sold by the diagonal, so the height comes from Pythagoras: `h = d / sqrt(1 + r²)` with `r` the width-over-height ratio. A 100 inch 16:9 screen is 49.03 inches tall; a 100 inch 4:3 screen is 60. Standing exactly as far back as the screen is tall gives `2 · atan(0.5)` = **53.13°**, which is a useful sanity check because it is close to the 53° the app has always shipped as its default — the old default was a laptop-sized guess that happens to describe someone standing about one screen-height away.

Since 5 October the panel asks for the two sides instead, as measured on the wall: the height is what the angle needs, the width gives the shape, and an impact screen is often no stock shape at all. A diagonal saved before that is converted with the formula above. The default bay is a 120 by 67.5 inch screen (the 138 inch 16:9 it used to be, to within half an inch) from 8 feet, which works out at **38.7°**. Nothing is sourced here; it is a starting point to correct, and the panel prints both the angle a bay gives and, for a hand-set angle, how far back you would have to stand to justify it — the two are exact inverses and a test asserts the round trip.

### The bay view cannot show the ball, and on the green that matters

A correct bay camera puts the eye at eye height with the ball about a metre in front. The ball is then `atan(1.75 / 0.9)` = **62.8°** below the horizontal, while a 100 inch screen at 6 feet gives a 37.6° frame — 18.8° from the axis to the top or bottom edge. The ball is nowhere near the picture, and that is correct: it is below your eyeline in the room too, and what is on the screen is where the ball is going.

It stops being correct on the green. A putt is aimed from the ball, so the ball has to be visible. There is no angle that fixes this — at eye height, a ball at your feet and a cup six metres away are 48° apart and the whole frame is 37.6° — so the camera has to move. Backing off along the same line, keeping the same eye height and the same angle:

    distance = height / tan(halfFOV · 0.85)

The 0.85 is how much of the half-angle the ball is allowed to use, leaving margin for the view axis's own slight downward tilt. For the bay above that is **6.11 m** behind the ball, which puts the ball 16.0° below the horizon inside an 18.8° half-frame, and a six metre putt's cup 6.6° below the axis — both comfortably in.

It is deliberately a no-op for the broadcast rig. Nine metres up and twenty-three back already has the ball at `atan(9/23)` = 21.4°, which is 81% of that rig's 26.5° half-angle: inside the frame, so the camera is not moved at all. One rule — "make sure the ball is in frame" — that changes nothing where nothing needs changing.

The result is clamped to 10–140°. A bay entered wrong — a zero distance, a screen size in metres against a distance in feet — would otherwise ask for a degenerate projection, and a camera that renders nothing is a worse answer than one that is merely not to scale.

**A mat off the screen's centre (1 October, branch `bay-stand-side`).** The
owner asked for a left/right offset in the bay. The golfer still looks straight
down the target line; what changes is that the screen is no longer centred on
it, so the correct view is an off-axis frustum -- the picture shifted sideways
without turning, as a projector's lens shift does. Standing `s` feet right of
centre, `d` feet back, the window spans the screen's width shifted by `s/d` of a
unit of depth to the left (`lensShift`). Applied as three's `filmOffset`. Checked
in the built game on the default bay (138" 16:9, 8 ft back): with the mat 3 ft
left the target line sits 23% in from the left edge, where the geometry says 20%
(30" of a 120"-wide screen); mirrored at 3 ft right. **Rejected:** sliding the
camera sideways (the desk mode's horizontal offset), which moves where you are
standing on the course rather than where the window is. The view cull rebuilds
its frustum from the field of view and the aspect, so it is widened by the same
shift, or trees on the far side would be culled.

## The flight camera

Three things decide where the camera sits while the ball is in the air, and all three changed together.

**It tightens across the whole shot, not just the end.** There are now two closings, and they do different jobs. `trackCloseness` is distance to the pin only, from 150 m down to 18 m, and takes the camera from 24 m back and 11 m up to 13 m and 6.5 m. It carries **no height gate**, because it is a gentle reframing rather than a move to turf level, and gating it on height would leave a shot that never gets low filmed from as far away at the green as it was off the tee. `approachCloseness` is the original one and keeps its height gate: it drops the camera to 1.45 m and 0.6 m, and a ball passing *over* the green at altitude must not trigger it or the camera would be hauled underground mid-flight.

Measured, a ball flying in at 1.5 m: 24.0 m at 200 yd, 19.4 at 100, 15.1 at 60, 13.2 at 30, 8.7 at 3. Rolling on the ground it carries on to 1.45 m at the cup.

**Nothing is filmed from dead behind any more.** Directly behind the ball is the worst seat in the house — the ball is a dot on its own trail and every shot looks identical, because nothing moves across the frame. Putts already had a quarter turn (45°, which puts the break across the screen instead of edge on). Full shots now get **25°**, and less than a putt for a reason: the hole has to stay in frame and it sits almost straight down the flight line, so against a half field of view near 32° a quarter turn would hang it on the edge.

**The camera trails the line to the HOLE, not the line the ball was struck on.** Those differ on anything that curves, and it is the hole that has to stay in view. Below 1.5 m from the cup that bearing is meaningless — at the cup it is undefined and one step either side swings a half turn — so it hands back to the shot's own aim, blended over the metres above it rather than snapped.

**The view leads toward the hole rather than sitting on the ball.** Looking straight at the ball would put the hole the full 25° off-axis; biasing the target 0.8 of the camera's own set-back rotates the axis about half of that, so the ball and the hole finish roughly equally off centre. Capped at half the remaining distance so it can never look past the hole itself. A test walks the whole approach at three ball heights and requires both the ball and the hole to stay inside 30° of the view axis. Putts keep framing the ball itself, which is what makes the break readable.

A note on the guard, because it cost a test failure: `followBearing` and both closeness functions already returned early on a hole with no pin, and the look-ahead did not — it dereferenced `hole.pin` and threw. An existing test in `refinement.test.mjs` builds exactly that hole to check the follow camera across every heading, and caught it immediately. With no pin the lead is zero and the camera frames the ball, which is the only sensible thing to look at.

**The camera waits 1.5 s before going after the ball** (was 0.75), long enough to see the strike rather than cutting away mid-swing. Putts wait not at all — the roll is the whole event and it is over in a couple of seconds.

### The lab works on the range now, and the approach presets were lying

**Since superseded, and the conclusion held:** on 2026-09-15 the lab mode was removed entirely and the range became the only bench. The finding below is why — the lab's world had already been redefined as the range, which left the mode as a second front door onto the same flat ground. The presets this section indicts went with it; sweeps (`lab.batch`, `lab.drops`, `lab.scatter`) do the measuring now, and they fire from a stated spot rather than from wherever a preset's carry happened to put them.

The lab used to build its own 260-yard hole. That hole was the problem, in two ways that compounded: a generated hole **doglegs**, so firing straight back from the pin wandered across rough, semi and fairway; and 260 yards is not enough runway for a 240-yard carry landing 60 short, so the driver preset started **46 m behind the tee**. Measured on the old world, the origin lie of each preset:

| preset | fired from | claimed |
|---|---|---|
| `green · wedge` | **rough** | — |
| `fairway · 5 iron` | **semi** | fairway |
| `fairway · driver` | **rough, 46 m behind the tee** | fairway |

None of it was visible from the readout, which reported carry and run only. The physics was never wrong; it was being asked the wrong question.

On the range the ball sits on the mat and the **green moves to suit the preset** — the opposite of walking the ball back from a fixed pin. Re-measured, every one of the twelve presets now lands where its name says: all eight `green ·` presets land **on the green**, 4–11 yd short of centre, and all four `fairway ·` presets land **on fairway**, their full `short` distance out.

**`short` on a fairway preset turned out to be load-bearing.** At 60 yd the two long clubs ran *onto the green mid-roll* and finished their run on putting turf, and the readout reported the mixture as fairway run. Measured at Burnt, the firmest setting and so the longest roll:

| preset | short 60 | short raised | overstated by |
|---|---|---|---|
| `fairway · driver` | 88.7 yd | **60.6 yd** (short 90) | 46% |
| `fairway · wood` | 60.1 yd | **48.2 yd** (short 80) | 25% |

**The ladder reproduces, and the one figure that does not is a hole-in-one.** Firing `green · 7 iron` through the real range from the mat against the synthetic all-green world the ladder was originally measured on:

| firmness | synthetic | through the range |
|---|---|---|
| Soft | 4.5 yd | 4.5 yd |
| Normal | 12.8 yd | **10.0 yd** |
| Firm | 18.9 yd | 18.9 yd |
| Burnt | 25.6 yd | 25.6 yd |

Normal differs because the ball **goes in the hole** (`holed: true`, off the lip). The pin sits at the centre of the range green, the preset lands 10 yd short, and at Normal it rolls exactly the 12.8 yd that takes it to the cup. The published figure is the correct roll-on-green number; the range agrees with it and then swallows the ball. Worth knowing before reading 10.0 as a discrepancy.

Driver onto fairway, clean roll with the green moved out of reach: Soft 21.6, Normal 35.6, Firm 43.9, Burnt 51.5 yd.

### The range reports what the ball did, and nothing about a round

Per shot: carry, total, offline, apex, ball speed, launch angle, spin and spin axis. The launch four are read back off the shot that was fired rather than re-derived — they are *inputs* to the model, so reporting them is reporting what was asked for, and real launch-monitor data lands in the same four slots when it arrives.

**Offline is measured across the line the shot was AIMED down, not from the green.** Those are different questions: aiming at the 250 target and finishing beside it is a straight shot, and calling it thirty yards offline because the green is elsewhere measures the wrong thing. The rotation is pinned by test rather than by inspection — a shot-direction sign error has shipped four separate times in this project, and it is invisible until somebody notices a fade reported as a draw. Verified live too: a +30° spin axis produced 43.5 yd **right**, with carry falling 155 → 152 and apex 87 → 77 ft.

Session dispersion is a **standard deviation**, not a min-to-max spread, so one shank cannot describe a session.

**A limitation, not a bug: the model is deterministic.** Two shots with the same club, power, aim and shape produce byte-identical results, so the offline spread reads ±0.0 yd until the player varies something. Measured directly — two identical 7-irons both carried 155 yd and finished 0.0 yd offline. A real range's value is largely in seeing your own dispersion, and that needs a strike-quality model that does not exist here. The stat is honest about what it measures; it just has nothing to measure yet.

### The painted ground disagreed with the lie, and had all along

`localSurface` tested the green's semi collar **before** the fairway, while the shader paints the mown corridor **over** that collar. So the apron short of every green was drawn as fairway and played as semi-rough.

Measured as the share of sampled area where the CPU lie and a faithful re-implementation of the shader's ordering disagree, before and after reordering the two checks:

| | before | after |
|---|---|---|
| course hole 1 | 0.87% | 0.36% |
| course hole 2 | 0.55% | 0.10% |
| course hole 3 | 0.39% | 0.08% |
| course hole 4 | 0.37% | 0.02% |
| the range | 1.37% | **0.00%** |

It was half a percent of a hole and invisible for as long as greens sat at the end of a necked corridor. Putting a green inside a full-width one made it 1.4% and a test caught it immediately. **This changes play on existing courses**: a ball on the apron now gets a fairway lie instead of semi-rough, which is what the player was already being shown.

**What still disagrees, and is not fixed here.** A course retains up to ~0.36% of `semi → rough` behind the green: the shader mows to `length + 8` and `fairwayWidth` stops at `length`. It is the forgiving direction — ground that looks like rough plays as semi — and it is a separate defect from the one above. The range itself is exactly 0.00%, and its test requires that, because with no hazards and no necking it is the one surface where exact agreement can be demanded.

## The flagstick, and the rule that does not exist

A flagstick has **no regulated height**. The Equipment Rules specify its *diameter* and say nothing whatever about how tall it is. This is worth writing down because the opposite is so widely assumed — the first pass at this section asserted a seven-foot minimum from memory, and the primary source does not contain one.

What is actually specified, from [The R&A — Part 8, Committee Equipment Requirements](https://www.randa.org/en/roe/the-rules-of-equipment/part-8-committee-equipment-requirements):

> Must have a diameter of no greater than 2 inches (50.8 mm) from the top of the pole to a point no less than 3 inches (76.2 mm) above the putting green surface.

> Must have a constant diameter of no greater than 0.75 inches (19 mm) from a point 3 inches (76.2 mm) above to 3 inches (76.2 mm) below the putting green surface.

**Superseded 15 October 2026** (see *Why our pins look small*: the owner chose an 8 ft stick, 2 in at the top tapering to 1 in at the green, over the Rules at the base, for visibility). As it was: the model against both: **14 mm** at the top against the 50.8 mm limit, and **18 mm** where it meets the green against the 19 mm limit — one millimetre of margin, so the base cannot be thickened without rechecking it. The pole tapers 0.29 mm across the 152 mm band the rule calls *constant*; that is left alone deliberately, being three tenths of a millimetre on a prop nobody measures.

**Height was seven feet by convention (eight since 15 October 2026), and then exactly seven feet.** It was 2.13 m — a tidy metric rounding of 7 ft that lands 3.6 mm short of it at 6.988 ft. Nothing was broken by that, but the cup beside it is specified to six significant figures (`CUP_RADIUS = 0.053975`, exactly 4.25 in), and one loose number in an otherwise exact set is the kind of thing that gets copied. It is now `7 * 0.3048`.

The driving range's target flagsticks are a separate thing at 3.6 m, and deliberately so: they are aiming markers read from the mats hundreds of yards away, not holes, and nothing in the Rules applies to them.

- [USGA — Equipment Rules, Part 8 Rule 2: The Flagstick](https://www.usga.org/equipment-standards/equipment-rules-2019/equipment-rules/part-8-rule-2.html): the same requirements from the USGA side. **403 to automated fetch**, so the R&A mirror above is what was actually read.

## The bounce ladder

A 756-shot 7-iron sweep turned up something the model had never been asked: **green, fringe, fairway and tee all bounced identically**, to four decimal places. They shared one restitution, because the contact constants were three nested ternaries whose final `else` swept up everything that was not sand, rough or semi.

A green is mown to about 3 mm and a fairway to 12–15. Four times the canopy cannot absorb the same energy, so the split is now explicit, as one table per surface rather than a ternary that hides which surfaces are sharing a row:

| surface | restitution | tilt | friction | plough | bounce | roll |
|---|---|---|---|---|---|---|
| green | 0.149 | 0.133 | 0.40 | 0.142 | 3.71 ft | 11.3 yd |
| fringe | 0.140 | 0.122 | 0.42 | 0.171 | 3.24 ft | 7.3 yd |
| fairway / tee | 0.131 | 0.119 | 0.44 | 0.189 | 2.92 ft | 5.4 yd |
| semi | 0.107 | 0.111 | 0.48 | 0.229 | 2.20 ft | 3.5 yd |
| rough | 0.084 | 0.085 | 0.55 | 0.314 | 1.48 ft | 1.6 yd |
| sand | 0.046 | 0.000 | 0.70 | 0.731 | 0.44 ft | 0.2 yd |

Restitution and climb both FALL with canopy; digging RISES. Sand has no climb at all and the most digging — it swallows a ball rather than launching it. These were refitted when the bounce became a contact that takes time; see below.

Bounce and roll are a stock 155 yd 7-iron at Normal firmness. **All three constants run with the canopy**: restitution falls as the mowing height falls, while tilt and friction rise with it — deeper to climb out of, and more grass to grab. A test asserts that *ordering* rather than the values; the order is what is defensible here. These remain engineering assumptions, the same caveat the original three ternaries carried.

**Tilt and friction were lumped worse than restitution was.** Restitution at least gave semi-rough its own value; tilt and friction gave it a putting green's, so a ball dug in and gripped identically on both and only its bounce differed. Semi, fairway and fringe all moved; rough and sand did not, being already distinct and already in the right order.

**Raising tilt can raise the bounce, which is not a contradiction.** Semi's first bounce went slightly UP (5.43 to 5.62 ft) even as its restitution stayed put, because Penner's tilt redirects forward momentum *upward* — deeper turf pops the ball rather than only deadening it. Its roll fell hard at the same time, 8.6 to 6.2 yd, which is the friction. A ball out of semi-rough now hops a little higher and stops far sooner, which is what semi-rough does.

**The fairway moved down rather than the green up**, for three reasons. A green has almost no canopy and is the natural anchor for that end of the ladder. Every published figure in this document was measured on a green, and raising it would have invalidated all of them at once. And green bounce was already on the high side — 9.2 ft at Normal for a surface meant to hold an iron — so lifting it would have made the more obvious problem worse.

**Still lumped, and left that way on purpose.** `tilt` and `mu` give semi-rough the same numbers as a green. That is wrong in exactly the way the restitution was, but semi already sits between fairway and rough on restitution, so correcting tilt and grip means *moving* semi rather than inserting beside it — a wider change than splitting the bounce, and a separate decision.

## Anchoring the bounce to measured turf

A 7-iron bounced **9.2 ft** off a green. That is roughly a basketball hoop, for a surface whose job is to hold an iron, and the whole ladder was scaled off it.

The anchor is [Harper, Kerwin et al., *Measurements and linearized models for golf ball bounce* (arXiv:2302.02758)](https://arxiv.org/abs/2302.02758). They bounced a ball **693 times off a well-maintained natural teeing area**, at 1.9–38.7 m/s and 16–90 degrees of incidence, filmed at 5,000–10,000 fps — and fitted **exactly the model this project uses**: Penner's tilted contact plane plus a restitution and Coulomb friction. Their Table 3, Campaign B:

| fit | restitution | friction |
|---|---|---|
| rigid, no tilt | 0.260 | 0.998 |
| Penner, speed-varying β | 0.222 | 0.999 |
| **Penner, fixed β = 18.4°** | **0.147** | 0.998 |

Our fairway restitution was **0.28** — above even their no-tilt fit, and nearly double their fixed-angle one. That is where the nine feet came from.

**The fixed-β pair is the one adopted**, verbatim, as the `tee` row: r = 0.147, β = 0.321 rad. The other Penner fit is the same data with β and r traded off, and it was rejected on the *roll* rather than the bounce — r = 0.222 with speed-varying β put a 7-iron 16.5 yd past its pitch mark on a fairway, against 5.4 for the pair chosen. Every other row is the old ladder scaled onto that anchor (cor ×0.525, tilt ×1.235), which keeps the canopy ordering while putting the whole thing on a measured footing.

**Campaign A was not used.** It is a premium *artificial* teeing turf glued to 38 mm of wood, and it fits at r = 0.42–0.54 — two to three times the natural surface. Using it would have made the problem worse, and it is a good reminder that "golf turf" in a dataset can mean a doormat.

**Friction was deliberately not anchored.** The paper fits µ at 0.85–1.0 in *every* campaign including the artificial one, which is the parameter pegging rather than measuring. Confirmed directly: raising ours from 0.44 to 0.95 changed a full-shot bounce by **nothing at all**, because the contact is already gripping and the Coulomb limit never binds there. It still matters where contact slips, so it kept its canopy ordering and its old values.

**What moved.** A 7-iron into a green at Normal: bounce 9.22 → 3.53 ft, roll 12.8 → 11.3 yd. The roll barely moved, which is the useful part — the firmness ladder was always about run-out and it survives intact, while the bounce stops being cartoonish. The measured surface was a *teeing area*, not a green; a green is mown tighter and rolled firmer, so it sits one step up the ladder rather than on the anchor itself.

## The flight was played back on fast-forward

Shots did not look like shots, and the reason was not the physics. The render loop advanced the trajectory clock at **1.7× real time**:

```
flight.elapsed += dt * 1.7 * timeScale
```

No comment, no recorded reason. What it did to hang time:

| club | carry | on screen, was | on screen, now |
|---|---|---|---|
| driver | 250 yd | 4.38 s | **7.45 s** |
| 3 wood | 220 yd | 4.29 s | 7.29 s |
| 5 iron | 185 yd | 3.58 s | 6.09 s |
| 7 iron | 155 yd | 3.91 s | **6.65 s** |
| 9 iron | 125 yd | 3.53 s | 6.00 s |
| wedge | 100 yd | 2.81 s | 4.77 s |

A real 7-iron hangs about six seconds. It was hanging under four.

**The multiplier was isolated to the trajectory clock**, which is why this was safe to change: both hold timers count real seconds and always did — `flight.hold += dt * timeScale` for the camera pickup, `flight.endHold += dt` for the settle pause — so neither the 1.5 s camera hold nor the 3 s settle moved. Verified on a live shot: a 7-iron on the range now takes **15.1 s** from strike to the badge clearing, against roughly 10 s before.

**Shots take about 70% longer to watch now.** That is the correct duration rather than a regression, but it is a real pacing change and the settle pause is the dial to reach for if a round starts to drag.

Left alone, and worth a look sometime: the simulated hang times are themselves 5–10% long against real figures — a driver at 7.45 s where tour data is nearer 6.5–7. Small, and a separate question from the playback clock that was hiding it.

## The ball was magnetised to the ground

After anchoring the restitution down, a 7-iron bounced **twice**: 3.53 ft, then 0.22 ft, then nothing. The second bounce came back at 6% of the first. Balls looked stuck.

That was a real consequence of the anchoring, and the fix came from the same paper's conclusions. Their own critique of the constant-restitution fit is that it implies a ball at rest would spontaneously lift off, which they call evidence

> "that a better model is nonlinear. Such nonlinearity could arise due to a dynamic transition elastic behaviour for low normal velocity and elasto-plastic behaviour for higher speed bounces."

So **0.147 is the fast-impact value.** Their dataset is dominated by fast impacts, where the ball craters the turf and most of the energy goes into making the hole. A slow impact does not crater — it is an elastic contact and returns far more. Every bounce after the first was a slow impact being charged the fast-impact price.

Restitution now rises as the impact slows: `cor x (1 + (GAIN-1) x exp(-|vn| / 4))`, with **GAIN = 3.5**.

**The gain is set by the one low-speed number checkable without equipment.** A golf ball dropped from shoulder height onto a green comes back to about knee height — roughly a third of the drop, so a restitution near sqrt(1/3) = 0.58. Green's 0.168 × 3.5 = 0.588. The same constant puts sand at 0.182, a ball that barely hops in a bunker. Both ends land right from one number.

**The measured anchor survives.** `PLASTIC_SPEED = 4` m/s is chosen so the gain is only ×1.02 at a 7-iron's ~19 m/s arrival, holding the fitted 0.147 to within 2%. Only the later, slower bounces are lifted.

**What it gave**, visible bounces over 10 mm, on a green at Normal:

| club | before | after | heights (ft) |
|---|---|---|---|
| driver | 3 | **6** | 7.43, 1.68, 0.58, 0.27, 0.14, 0.08 |
| 5 iron | 2 | 4 | 4.83, 0.86, 0.27, 0.11 |
| 7 iron | 2 | 3 | 3.71, 0.54, 0.15 |
| wedge | 1 | 2 | 2.25, 0.27 |

The decay ratio now *increases* down the sequence (×0.13 then ×0.23 for a 7-iron, against a flat ×0.06 before), which is the shape a velocity-dependent restitution should produce. Firmness now changes the bounce COUNT as well as the height — a 7-iron gets 2 bounces on a soft green and 5 on a burnt one.

**Where it was tempting to overreach.** Gain 4.5 gives a 7-iron five visible bounces instead of three, which is closer to what was asked for. It also implies a ball returning 57% of its drop height, which is a hard floor rather than turf. The drop test is the ceiling, and it was allowed to be.

## The bounce became something that takes time

A spun ball stood bolt upright on its first bounce — 88 degrees, forward speed already gone — where a real one hops forward, stands up over the next hop or two, and only then comes back. Four attempts at tuning the old model each bought that sequence by destroying something else, and there was a reason: **it is impossible.** Biber, Champneys and Szalai prove it in [arXiv:2208.11685](https://arxiv.org/abs/2208.11685):

> *"Starting from the rigid-body limit with an energetic or Poisson coefficient of restitution, it is shown that slip reversal during the contact phase cannot be captured in this case, which result generalises to the case of pure normal compliance. Yet, the introduction of linear tangential stiffness and damping does enable slip reversal."*

Our bounce was exactly that case: one instant, a restitution, Coulomb friction, plus normal compliance through the tilt. Slip reversal *within* the contact is the mechanism, and an instant has no within.

`contact.js` replaces it with a Kelvin-Voigt contact — spring and damper pressing up, another pair resisting sideways, friction capping what the sideways pair can hold. The ball is squashed for **0.497 ms** and the sliding-to-gripping switch happens inside that. Restitution stops being a parameter and emerges from the normal damping.

**What it produces**, wedge at 18,000 rpm on a firm green:

| hop | angle | forward speed | |
|---|---|---|---|
| 1 | 72° | +1.4 m/s | forward |
| 2 | 72° | +1.4 m/s | forward |
| 3 | 47° | −1.1 m/s | **back** |
| 4 | 43° | −1.1 m/s | back |

Finishing 12.1 yd behind the pitch mark. Steeper descent gives a more vertical first hop, as it should: the wedge's is 72° against a 7-iron's 62°.

### Ploughing had to be separated from climbing

The first fit failed on Soft, and the failure was instructive. Penner's tilt bundles two different things at a fixed ratio — the turf ahead **resisting** being shoved aside, and the ball **climbing** the crater wall. Soft turf does a great deal of the first and little of the second: a ball sinks in and stops, it is not launched. With only the tilt available, the short roll a soft green needs could be bought only by giving it the highest bounce of any surface, which is backwards.

So digging is its own term now. It opposes the centre's travel rather than the contact point's slip, and unlike friction it applies **no torque and no lift** — the turf presses on the whole leading face, roughly through the middle. Separating them is what let all four firmness settings hit both their bounce height and their rollout at once, to better than half a percent.

Tilt also stopped tracking firmness and now falls with canopy rather than rising, both for the same reason: it is the climb, and ploughing is the dig.

### What is anchored now, and what changed about that

The tee row used to be the paper's fitted pair verbatim — r = 0.147 with β = 0.321 rad. That pair described a **two**-term model. With a third term there is no single restitution that is the same quantity they fitted, so holding 0.147 would be numerology. **The anchor is behavioural instead**: every bounce height and rollout that pair produced is reproduced to better than half a percent, and a test checks those figures rather than a constant.

### Deep rough stopped tracking firmness, deliberately

Rough now moves 1.48 to 1.61 ft across the whole firmness range where a green moves 2.81 to 4.52. A ball landing in 50 mm of grass is caught by the grass and barely reaches the ground, so how firm that ground is hardly matters. The old model made rough track firmness as strongly as a green did, which was the less believable of the two. Rollout still responds everywhere; only bounce height goes flat, and the test permits it on rough alone.

**Cost:** 1.2× per shot (2.26 ms against 1.88), not the 2× estimated. The instantaneous bounce is still reachable with `compliant:false` for comparison.

## The crater wall is not a new degree of freedom

A real wedge sucks back because it lands in the pitch mark it just made and has to climb the front wall of it. Ploughing that pushes back equally in both directions can slow a ball but can never send it home, and the compliance paper states the requirement directly — horizontal stiffness must *"increase when the ball is moving to the right, and decrease when the ball reverses"*.

It was built (`wall` and `craterRelief` in contact.js: forward resistance grows with how buried the ball is, backward it retreats into its own hole). **It does not work, and the reason is worth recording so nobody builds it twice.**

Every shot digs almost exactly the same depth — **1.08 mm**, against 1.1 for a tour wedge, 1.0 for a mid-handicap and 0.8 for a beginner. So `wall × depth / radius` is a constant in all but name, and refitting the base plough absorbs it exactly. Measured:

| wall | relief | refit | wedge at 9,304 rpm |
|---|---|---|---|
| 0 | 1.00 | — | +0.9 yd |
| 40 | 0.15 | holds exactly | +1.1 yd |
| 80 | 0.10 | holds exactly | +1.0 yd |

The refit holds perfectly at every setting *and* the spin-back never changes. In a point-contact model the crater wall is ploughing wearing a different hat.

**What actually reverses a ball is ploughing relative to friction.** Ploughing takes forward speed away without unwinding the spin, so the spin survives to drive the ball home; friction takes both. A tour wedge reverses at a plough of about **0.40** — our fitted green value is **0.142**, roughly three times too little.

So there is a real tension, and it is not in the bounce:

- our **rollout figures** pin plough at 0.142
- **spin-back** needs it near 0.40

Those cannot both be right. The rollout figures were inherited from the instantaneous model, which scaled them from a measurement taken on a **teeing area**, and have never been checked against a real green. A 7-iron releasing 11.3 yd — about 34 feet — on a receptive green is on the generous side of what one actually does. If the true figure is nearer 5–8 yd, plough rises, and spin-back may simply fall out.

**That is the thread to pull, and it is a measurement question rather than a modelling one.** The parameters are left in place, defaulting to neutral, so the experiment does not have to be reconstructed.

## The aerodynamic curve, fitted

The lift and drag curve had never been fitted to anything. It was a plausible shape with plausible constants, and it was wrong in an **ordered** way: with measured tour inputs the irons flew about 10% too far and 15% too high while the driver flew 7% short and 23% low. Sorting the error by spin lines it up perfectly, which points at the spin term rather than at drag level — and the lift cap of 0.32 was binding for the 9-iron and the wedge, flattening exactly the clubs that were already wrong.

Five constants (`AERO` in `src/physics.js`) fitted by coordinate descent against six measured rows, ball speed / launch angle / spin in, carry and apex out. The fitted curve is **flatter**: less gain, a higher floor, a lower cap.

| | carry | apex | descent angle |
|---|---|---|---|
| before | 7.9% | 14.6% | 7.0% |
| after | **3.2%** | **3.7%** | **1.8%** |

**Descent angle was not in the fit.** It was measured afterwards and came out within a degree on every club from driver to wedge. A curve bent to hit two numbers does not land a third by luck, so the shape is believable rather than being an optimiser's residual. `simulateShot` now reports `descentAngle`, taken from the velocity at first touchdown in the same place `landingSpeed` is taken — the one instant it is defined.

**Sourcing.** Ball speed, carry and total are from the published Trackman tour averages ([neogolfclub mirror](https://www.neogolfclub.com/technology/tour-averages), driver 167 mph / 275 yd carry corroborated by [Trackman's own 2024 tour-averages post](https://www.trackman.com/blog/introducing-updated-tour-averages)). The landing-speed column of an earlier draft was discarded outright as unsourced.

The descent and apex columns were written from memory and were **later verified against sources, and both hold**:

- **Descent angle.** The PGA Tour average for a 7 iron is **50 degrees**, with pros targeting 48-50 ([Golf Digest](https://www.golfdigest.com/story/the-most-important-data-point-when-it-comes-to-your-next-irons-a), [golf.com](https://golf.com/instruction/approach-shots/what-is-descent-angle-equipment-metric-play-smart/)). Ours is **49**. The other irons fall inside the quoted mid-40s-to-50 band: 5 iron 46, 9 iron 51, PW 51. No exact tour figure was found for a driver; ours is 39 against "shallower than irons".
- **Apex.** The distinctive published claim is the FLATNESS rather than a height — *"the difference in Apex Height between Driver and Pitch Wedge is only 3 meters/yards"* ([Trackman](https://www.trackman.com/blog/golf/apex-height)). Ours is **3.7 yd**, driver 32.0 against PW 28.3. That is a far better test than any single number: it is a specific falsifiable shape, and a model with the lift curve wrong would miss it badly.

So the out-of-sample claim above stands rather than being provisional. The one miss is the **driver's absolute apex — 32 yd against a quoted 35** — which is the same gap as its carry (261 against 275) counted twice, not a separate defect.

### Release is still wrong, and now the bounce is genuinely implicated

The point of fixing the flight first was to find out whether the bounce was at fault or was simply being fed a badly-arriving ball. With the flight now correct to a few percent on all three of carry, apex and descent angle:

| club | release, ours | measured (total − carry) |
|---|---|---|
| driver | 28.8 | 21 |
| 3 wood | 19.4 | 19 |
| 5 iron | 9.2 | 15 |
| 7 iron | **3.0** | 13 |
| 9 iron | **0.3** | 11 |
| PW | **−0.3** | 10 |

The gradient runs with spin: the driver runs a little too far, the 3 wood is right, and everything below it stops far too fast — a wedge finishing *behind* its pitch mark on a fairway. **The bounce over-responds to spin.**

**This corrects the guess recorded in the section above.** That section supposed our rollouts were on the generous side and that the true 7-iron figure might be "nearer 5–8 yd", which would have raised plough and let spin-back fall out. The sourced totals say the opposite — real release is *longer* than what we produce, not shorter. Ploughing therefore cannot rise to buy spin-back without making release worse still, and the tension between the two is sharper than it looked, not softer.

### A test that measured two things at once

The anchor test fired a 7-iron through the flight and measured where it landed, so it was testing the flight and the bounce together. Refitting the curve moved every number in it and read as a bounce regression although not one bounce parameter had moved.

The bounce is now tested at a **controlled arrival** — the ball is delivered at a pinned speed, descent angle and spin rather than flown to it. `simulateShot` had already argued for this at the top of the function: *"launching one from a tee and hoping it arrives that way is not a controlled test."* A second test asserts the delivered ball and the flown one still agree, so the pinned arrival cannot silently go stale.

Pinning it exposed a trap worth recording. Reading arrival spin from the touchdown sample gives **2277 rpm**; the true arrival spin is **5114**. The simulator applies the impulse and records the point in the same step, so that sample is the *post-bounce* state — the same class of mistake as reading the post-bounce velocity, which this file already warns about. The correct figure comes from the last airborne sample and was cross-checked against the analytic decay `exp(-t/24)`, which agrees to the rpm.

## Why the ball does not zip back: two dead ends and the real shape of the problem

The compliant contact, the ploughing and the crater machinery all shipped and are live — `contact.js` is imported, and compliant is the default (`options.compliant!==false`). What never got switched on is the crater asymmetry: `WALL=0, CRATER_RELIEF=1`. The wall was found to be absorbed exactly by refitting the base plough and was neutralised on that basis, with the note that plough should rise instead. Plough never rose, because the rollout figures pinned it. **The conclusion got half-applied**, and the result is a bounce with symmetric loss and no asymmetry at all.

### The root cause: the bounce turns backspin into topspin

A wedge arriving at 22 m/s and 51° with 7,000 rpm of backspin leaves the first bounce at **−1,416 rpm**, which is topspin. The contact drives the ball all the way to **rolling**, and rolling is topspin by definition. A ball that leaves the turf with topspin cannot come back, whatever the crater, the plough or the firmness do afterwards.

| friction | vx out | spin out |
|---|---|---|
| 0.2 | 6.33 | **+2,082** (backspin kept) |
| 0.4 | 3.12 | **−1,509** (topspin) |
| 1.0 | 3.20 | −1,416 |
| 2.0 | 3.23 | −1,387 |

This is also why friction appears inert. Above about 0.4 the tangential spring grips and takes over from the Coulomb limit, so μ stops mattering — the earlier note that "the Coulomb limit never binds" survived the move to the compliant model for a different reason than it was written for.

### Dead end 1: `craterRelief` is inert

Relief only fires while the ball is moving *backwards during the contact*, which essentially never happens. Setting it to 0.15 alone moves a wedge from −0.3 yd to −0.2. A fit drove it to 1.0. The reversal seen when `wall` and relief were set together came entirely from `wall` — and the depth check confirms `wall` is plough in disguise: across the whole bag the ball digs d/R = 0.0589 to 0.0600, so `wall x buried` is a constant.

### Dead end 2: contact duration cannot matter, structurally

Sweeping `normalRate` over a 32x range — contact time 0.99 ms down to 0.03 — changes **nothing**: not release, not hop height, not the spin leaving the bounce, including in a direct call to `bounce()` that bypasses the flight entirely.

The model is scale-invariant in the rate. `dt` is derived from the contact period, so stiffening the spring shortens the contact by exactly the same factor; restitution depends only on the damping *ratio*, and the tangential impulse only on μ and the normal impulse. Time cancels out of both. **No value of the contact time will ever change a bounce**, so the published ~0.5 ms figure is a description of this model rather than a constraint on it.

### What the spin gain shows, and the problem it exposes

`SPIN_GAIN = 2.5` is the rigid-sphere value; a real ball's cover deforms and its contact patch has area, so less of the tangential impulse should become spin. It is now an option (`spinGain`) rather than a constant, defaulting to 2.5 so nothing moved. Lowering it does exactly what the mechanism predicts — backspin survives the bounce and the ball comes back:

| gain | driver | 7 iron | PW | wedge spin out | firm green |
|---|---|---|---|---|---|
| **2.5** (today) | 28.8 | 3.0 | −0.3 | −1,509 rpm | ran +1.5 |
| 2.0 | 24.4 | 1.0 | −1.4 | −867 | +0.5 |
| 1.5 | 18.5 | −0.7 | −3.0 | **+1,098** | **−1.3** |
| 1.0 | 11.5 | −1.6 | −8.3 | +3,065 | −13.2 |
| target | **21** | **13** | **10** | keep backspin | come back |

Hop height never moves (2.87 → 2.88 ft), confirming the normal direction is independent of all of this and the measured anchor is safe.

**But the spread is the real defect.** Measured release runs 21 yd for a driver down to 10 for a wedge, roughly 2:1. Ours runs 28.8 down to −0.3 — not a ratio, a collapse. Every tangential lever tried so far (plough, friction, crater, contact time, spin gain) slides the whole ladder up or down together; none of them changes its *shape*. The tangential loss is far too sensitive to spin, and that is a problem with the functional form rather than with any parameter value. `CONTACT_GAIN` in contact.js, incidentally, has been declared and unused since it was written.

## Does fitting to tour numbers make an amateur's shots right?

Yes for the bounce, and the reason is architectural: the bounce only ever sees ARRIVAL conditions — landing speed, descent angle, spin. It has no idea which club or which golfer produced them. But the fit set matters, and ours was much narrower than it looked.

**Our tour validation set barely varies the speed axis.** Across all six clubs, as the bounce sees them:

| | span |
|---|---|
| arrival spin | 2,043 → 7,130 rpm = **3.49x** |
| landing speed | 22.0 → 27.8 m/s = **1.26x** |

Tour full swings all arrive in a narrow speed band, so that set pins the SPIN response and says almost nothing about the SPEED response. The stock bag in this game lands as slow as **14.7 m/s** on a half wedge — a third below anything in the tour set — and partial wedges and three-quarter irons are exactly the scoring shots where it would show.

### The measurement behind the bounce already covers that range

Going back to the primary source settles it. [arXiv:2302.02758](https://arxiv.org/abs/2302.02758), read via [ar5iv](https://ar5iv.labs.arxiv.org/html/2302.02758), reports Campaign B (natural turf) spanning **1.93 to 38.7 m/s**. The measured data behind our bounce already covers the slow arrivals; it is the tour validation set that is narrow, not the anchor. Table 3 in full:

| Campaign B variant | r | mu | beta | error |
|---|---|---|---|---|
| Rigid | 0.260 | 0.998 | — | 35.0% |
| Penner, varying beta | 0.222 | 0.999 | k_P = 2.973e-4 | 21.3% |
| **Penner, fixed beta** | **0.147** | **0.998** | **18.4° = 0.321 rad** | **19.2%** |

**The project's recorded anchor is correct.** r = 0.147 with beta = 0.321 rad is the fixed-beta row verbatim. (The 0.260 that turns up first in a summary is the rigid variant, a different model.)

### But we departed from that row in two places, and both bite at low speed

**Friction.** The fitted row pairs r = 0.147 with **mu = 0.998**. We took its restitution and its tilt and use **mu = 0.40 on a green, 0.44 on a fairway** — numbers that are not from this paper. The earlier decision to leave friction alone rested on the Coulomb limit never binding; in the compliant model it saturates for a different reason (above about 0.4 the tangential SPRING grips and takes over), so that reasoning does not carry across.

**A speed-dependent tilt the paper explicitly rejected.** `physics.js` scales the tilt by `clamp(-incomingNormal/12, 0, 1)`. That is a speed dependence, and the paper tested precisely that — Penner's angle "depends linearly on the inbound angle and speed" — and found the **fixed** angle fitted better (19.2% against 21.3%). Measured, the clamp is inert for every full and three-quarter shot in the bag and only bites below that:

| shot | land m/s | clamp | release now | fixed beta | change |
|---|---|---|---|---|---|
| 7 iron 100% | 23.2 | 1.00 | 3.5 | 3.5 | 0.0 |
| 7 iron 50% | 17.9 | 0.67 | 17.5 | 15.2 | −2.3 |
| wedge 50% | 14.7 | 0.73 | 3.5 | 2.8 | −0.7 |
| driver 50% | 25.4 | 0.62 | 63.5 | 53.5 | **−10.0** |

So the answer to the question is: the tour set is fine for the spin axis and the paper covers the speed axis, but we are not currently using the paper's friction, and we are using a speed law it rejected. Both should be corrected before any low-speed behaviour is trusted — and neither is the release-spread defect, which remains the open problem.

Partial shots also expose that defect from the other side: a half 7-iron releases **17.5 yd** against a full one's 3.5. Less spin, much more roll — the same over-sensitivity, seen by varying power instead of club.

## Slice 2: the spin gain, and why a ball can now come back

One number changed, and it was the whole of it: `SPIN_GAIN` in contact.js, from the rigid-sphere **5/2 to 3/2**, with a per-surface ladder in the `CONTACT` table.

**The mechanism.** A bounce removes slip at (1 + spinGain) times the rate it removes forward speed. At 5/2 that factor is 3.5 — just enough to drive every full shot all the way to **rolling** inside the contact. Rolling is topspin by definition, so a wedge arriving with 7,000 rpm of backspin left the bounce at **−1,416 rpm**, exactly −vx/R. Nothing downstream can bring a topspun ball back, which is why no shot at any spin rate ever returned. The small reversals the model did produce came from **ploughing**, and that is why they appeared on soft ground rather than on the firm, quick greens where tour players actually spin a ball back.

Lower the gain and the ball stops short of rolling, keeps backspin, and the **roll phase carries it back on its own** — that phase already models slip correctly, so nothing there needed changing. The machinery for spin-back was already present; the bounce was destroying its fuel.

**Per surface, because you cannot spin a ball out of the rough.** A single global value made balls reverse out of deep grass, which is what a flier is the opposite of. The gain now runs with the canopy like every other column: green 1.5, fringe 1.7, fairway 1.85, semi 2.15, rough and sand at the 2.5 rigid ceiling. On mown turf the contact patch is small and its parts slip in different directions, so net torque falls short of force times radius; in deep grass the canopy takes hold over a large area and strips the spin. **The ordering is behavioural, not measured.**

### What it was fitted to, and what was abandoned

**The published total-minus-carry figures were abandoned as a fit target.** They demand a 9,304 rpm pitching wedge landing at 51 degrees release **ten yards**, which is not a shot that exists. Four separate fits against them stalled at 37–40% error with parameters railing to their bounds — plough to 0.02, fairway roll to 30%, friction cut by 83%. When every fit fails the same way the target is usually wrong, and the likeliest explanation is that those totals are computed from carry with a generic rollout assumption rather than measured. Worse, the fits that did move release did it by **cutting friction**, which flattened the spin response entirely (a 7-iron releasing 12.8 yd at 11,000 rpm). Friction is the mechanism the whole effect runs on.

Fitted instead to **what tour golf looks like**. RMS miss **11.7 yd to about 3.5 yd**:

| club | surface | target | before | after |
|---|---|---|---|---|
| driver | fairway | 21 | 28.8 | 22.9 |
| 3 wood | fairway | 19 | 19.4 | 14.1 |
| 5 iron | firm green | 6 | 30.6 | 12.4 |
| 7 iron | firm green | 2 | 12.6 | 2.4 |
| 9 iron | firm green | −1 | 3.7 | 0.3 |
| PW | firm green | −3 | 1.5 | −1.4 |

Best fit was 1.475; **1.5 is used because the data cannot tell those apart** (0.05 yd) and the extra digits would be invented precision. The 3 wood and 5 iron are the remaining misses.

**The curve now has the right shape**, which was the actual goal. A 7-iron on a firm green releases 44 yd at 3,000 rpm (a flier), 2.7 at a stock 7,000, and **crosses zero at about 9,600 rpm**, reaching −12.5 by 13,000.

### Three tests changed, and why none of it was papering over

- **The anchor's rollouts fell sharply** (Normal green 7.3 to 0.3 yd). That is the change working: the delivered ball carries 5,114 rpm, the case that moves most. Hop heights barely moved (3.56 to 3.59 ft) because they are the normal direction, untouched. The firmness order is now **non-monotonic** there (Soft 1.4 against Normal 0.3) — ploughing stopping a ball on soft ground while retained backspin holds it up on a quick one, competing at very small magnitudes. The flown-ball ordering test still passes.
- **`rough.total < fw.total`** became false for a 9,000 rpm wedge. Both reverse now, and the fairway ball backs up further (−0.6 yd) than the rough one (−0.3) because the canopy strips the spin. The assertion conflated "stops sooner" with "smaller total", which diverge once a ball goes backwards; it now compares how far the ball moves.
- **A slow chip by a trunk** runs 1.46 m where the test wanted 3. The arithmetic agrees: 3 m/s at 20 degrees carries 0.59 m and rolling from about 1.5 m/s adds 0.78. The old threshold encoded a bounce that barely slowed a slow ball. **This is the low-speed regime, which has no validation data at all**, so 1.46 is defensible rather than confirmed.

## Rolling resistance rises with speed (option 1)

A Stimpmeter releases its ball at **1.83 m/s**, and that is the only speed at which the number on the sheet means anything. The model was applying it flat to balls moving several times faster — a 2,000 rpm 7-iron enters its roll at 7.89 m/s, **4.3x the calibration speed**, and the roll alone then bought it most of its run-out.

### The first version was wrong in the hand, and the tests said so

The law was first written to scale at *every* speed, renormalised by `ln(1+k)/k` so the Stimpmeter integral came back exact. That is arithmetically correct and wrong to play: the renormalisation has to push the **low**-speed end down to pay for the high end, so a tap-in rolled **21% further** than before. Nothing about a ball creeping to a stop should change because fast balls were mismodelled.

The law is now **flat below 1.83 m/s and rises only above it**: `G(v) = 1` for `v <= vs`, else `1 + k(v/vs - 1)^2`. The Stimpmeter measures a ball decelerating from exactly 1.83 to rest — entirely inside the flat region — so its reading is preserved with no renormalisation at all, and every putt that never exceeds that speed is untouched to the bit.

| launch | putt run, gain off | gain on | change |
|---|---|---|---|
| 1.5 m/s | 4.0 ft | 4.0 | **0%** |
| 2.5 | 11.1 | 11.1 | **0%** |
| 3.0 | 16.1 | 16.1 | **0%** |
| 4.0 | 28.6 | 27.2 | −5% |
| 5.0 | 44.7 | 38.3 | −14% |

And what it buys, on a 7-iron into a green:

| spin | Normal, off | Normal, on |
|---|---|---|
| 2,000 (flier) | 40.9 yd | **26.3** |
| 3,200 (thin) | 21.1 | **17.9** |
| 5,000 | 4.8 | 4.8 |
| 6,500 (stock) | 0.3 | 0.3 |
| 10,400 | −2.7 | −2.7 |

**Realistic spins are untouched exactly.** Only fliers move, which is precisely the case that was wrong.

### What had to change to make it work

**The closed forms survived.** `integral(v dv / a(v))` still evaluates in closed form below the Stimp speed and by Simpson above it, so `struckDistance` stays analytic and `launchForDistance` inverts by bisection. `rollDeceleration` keeps its old signature and returns the flat base; only the rolling step in `groundStep` calls the new `rollDecelerationAt`.

**The integrator needed a midpoint.** While resistance was constant a first-order step was exact in it. Once it varies with speed, taking it at the leading edge leaves an O(dt) bias — and that bias showed up exactly where it would do most damage: **the Stimp run drifting with the integration timestep**, which is a thing a green speed must never do. Evaluating resistance at the midpoint of the step fixes it; the run is now timestep-independent to 0.0001 ft.

**Distance is no longer exactly quadratic in launch speed.** The skid still goes as v^2; the roll stops doing so above 1.83 m/s. Below that it is untouched, and a struck putt rolls from five sevenths of its launch speed, so everything up to about 2.5 m/s stays exactly quadratic — the whole range an ordinary putt lives in, which is why the power slider still feels the way it did.

**A test was comparing two different distances.** The break test built its released-ball speed as `sqrt(2 a d)`, the flat-law inverse. Once the law changed, that ball no longer covered the same distance as the struck one, and the difference read as a break regression. `releaseForDistance` now inverts the current law.

**The struck-versus-released gap narrows with speed** (0.599 at 2 m/s, 0.648 at 3, 0.753 at 4, 0.856 at 5) because a released ball starts rolling at the full launch speed and sits deeper in the penalised zone. A single flat threshold could not express that, so the test asserts the direction and the monotone trend instead.

**`ROLL_SPEED_GAIN = 1` is not anchored to anything.** Nobody has handed us a measurement of how turf resistance grows with speed. The shape is defensible and the Stimpmeter end is pinned exactly; the magnitude is a choice.

## Firmness is a greens measurement, and now only moves greens

`firmnessApplies` was every surface but sand and water. It is now **green and fringe only**.

**The instrument argues for it.** The unit is inches of penetration read by a TruFirm or GS3, and both are greens instruments — the USGA bands this scale is anchored to are greens bands. Sand was already excluded on exactly that reasoning, recorded in firmness.js as "a bunker is not turf, its condition is raked state and moisture, and the instrument is not used on it". That sentence is equally true of a fairway and truer of rough.

**And it played badly.** A soft setting reversed a well-struck ball off fairway, semi and rough. Measured, a 10,400 rpm 7 iron:

| surface | Soft | Normal | Firm |
|---|---|---|---|
| fairway | BACK −1.02 m | BACK −0.53 m | fwd 0.23 m |
| semi | BACK −0.82 m | BACK −0.49 m | vert −0.05 m |
| rough | BACK −0.45 m | BACK −0.25 m | vert 0.07 m |

At stock 6,500 rpm a soft setting still pulled the ball back off all three. Nothing short of mud does that.

### What it costs, measured

Firmness was worth **13 yards of driver release on a fairway** (8.0 at Soft to 21.0 at Burnt). That is gone. The fairway, semi and rough **roll percentages are untouched** and cover part of it:

| club | surface | roll % 30→180 | firmness used to give |
|---|---|---|---|
| driver | fairway | 10.3 → 19.5 (9.2) | 8.0 → 21.0 (13.0) |
| driver | semi | 8.8 → 14.8 (5.9) | 5.3 → 17.2 (12.0) |
| **7 iron** | **fairway** | **0.8 → 0.9 (0.2)** | −1.3 → 6.3 (7.6) |

**Roll % covers woods and does nothing for irons**, because an iron's release is nearly all bounce and roll % only touches what happens once the ball is already rolling. An iron into a fairway now plays the same on every course setting. That variation is genuinely gone, and it was the price.

### What it does not fix

A 1.6x spun 7 iron still comes back about **1.35 yd off a fairway at every setting**, because Normal itself does that — the plough-and-tilt budget problem, unchanged. Narrowing firmness removed the setting-dependent half, which was the frustrating half. It did not pretend to fix the rest.

A test now asserts the mirror of the old one: fairway, tee, semi and rough must be **provably invariant** across the whole firmness range, bounce and rollout alike, so this cannot quietly come back.

## The bounce cannot push a ball backwards; only spin can bring it back

Backward first hops were turning up on fairway, semi and rough, and no plough value fixed them — rough has the most ploughing and reversed the LEAST, semi has less and reversed more, so the ordering did not track. Measuring what each surface leaves the ball with settled it. A 1.6x spun 7 iron arriving at 14.38 m/s forward, 16.90 down, 8,280 rpm:

| surface | forward left | tilt kick back | net | spin kept |
|---|---|---|---|---|
| green | 2.62 | −0.64 | **+1.98** | 2,447 rpm |
| fringe | 1.55 | −0.59 | +0.96 | 1,338 |
| fairway | 0.72 | −0.57 | +0.14 | 366 |
| semi | 0.47 | −0.53 | **−0.06** | −316 |
| rough | 0.10 | −0.41 | **−0.31** | **−65** |

**Rough eats the spin, exactly as it should** — it keeps −1% against a green's 30%. So the backward hop there was never spin-driven. It was the TILT.

Penner's tilt rotates the contact normal against the direction of travel, so part of the rebound emerges as backward horizontal travel. That kick is nearly constant (0.41 to 0.64 m/s) because it scales with the rebound, which is 4.82 m/s on every surface. What varies is how much forward speed survives the contact — 2.62 on a green, 0.10 in rough. **Once the kick exceeds what is left, the ball leaves the bounce going backwards with no spin on it at all.**

That is not physical. Ploughing resists turf ahead being shoved aside and the tilt is the ball climbing its own crater; neither has anything behind the ball to push against.

### The rule, and the wrong version of it

The tangential component leaving the contact is floored at zero — **but only when the ball has no backspin left to justify going backwards**.

Flooring unconditionally was tried first and was wrong: it also killed the legitimate reversal, and a green's check fell from −2.6 yd to −0.3. The sign of the spin leaving the contact separates the two cases with no threshold to choose. A green keeps +2,447 rpm and may come back; rough keeps −65 and may not. **Reversal is not removed, it is moved to where it belongs** — a ball that keeps backspin is dragged home during the roll, which `groundStep` already models correctly.

Measured after: green unchanged at −2.6 yd, semi −1.1 → +0.0, rough −0.5 → +0.0, and no surface hops backward without spin.

**It also repaired something that had been recorded as a puzzle.** The bounce anchor's firmness ladder was non-monotonic — Soft ran 1.4 yd against Normal's 0.3 — and that was written up as two mechanisms competing at small magnitudes. It was not. Soft's 1.4 was a ball being kicked forward out of a reversal it should never have been in. It now reads 0.0 and the ladder rises with firmness the whole way.

### Still open

A fairway still hops backward at its current ploughing, because it keeps 366 rpm and is therefore allowed to. That one is the separate ordering problem: `plough` is ordered by mowing height, so a fairway digs 34% harder than a green and is modelled as the softer ground, which is backwards for native soil against a watered green.

## Ploughing is two things, and that is why every ordering of it contradicted something

`plough` was one number carrying two unrelated physical facts, and each attempt to order it broke whatever the other one was responsible for.

- Ordered by **canopy** (the original): a fairway dug 34% harder than a green, so the fairway was modelled as the *softer* ground. Backwards — a fairway is native soil, a green is a watered rootzone kept receptive.
- Ordered by **ground firmness**: a ball landing in rough ran **further** than one landing on a fairway (4.69 yd against 4.19). No golfer would recognise that.

Both orders are real. They are simply not the same order, and the ball feels the sum:

| surface | ground | canopy | total |
|---|---|---|---|
| fairway / tee | 0.0950 | 0.0150 | 0.1100 |
| semi | 0.1000 | 0.0800 | 0.1800 |
| rough | 0.1050 | 0.1700 | 0.2750 |
| fringe | 0.1150 | 0.0200 | 0.1350 |
| green | 0.1250 | 0.0000 | 0.1250 |
| sand | 0.1250 | 0.6062 | 0.7312 |

**Ground** runs firmest first — fairway, semi, rough, fringe, green. **Canopy** runs by mowing height — a green is shaved to nothing, rough is 50 mm deep. The two orders genuinely disagree: a fairway is firmer ground than a green *and* ploughs less in total, while rough is firmer ground than a green and ploughs far more.

### Friction came down 5% with it

Friction is the largest single term taking forward speed off a bounce — 7.67 of a green's 12.94 — and at the old values a hard-spun iron kept almost none, so its first hop went nowhere. The ladder moved from 0.40/0.42/0.44/0.48/0.55 to 0.38/0.399/0.418/0.456/0.5225.

A green tilt reduction was tried first and rejected: it buys forward carry by **flattening the hop** (3.3 ft down to 1.1) and it cost the Firm check, which is the behaviour that already looked right on screen. Ploughing and friction move the hop forward while holding the rise.

### Where it landed

Normal firmness, Stimp 10, and no first hop is negative on any surface:

| surface | stock 7 iron hop / release | driver release | spun 7 iron hop / release |
|---|---|---|---|
| fairway | +0.71 m / +3.4 | 18.0 | +0.32 m / +0.6 |
| semi | +0.69 / +2.5 | 12.8 | 0.00 / +0.0 |
| rough | +0.49 / +1.5 | 9.1 | 0.00 / +0.0 |
| fringe | +0.39 / +1.7 | 20.0 | +0.19 / −0.3 |
| green | +0.50 / +1.3 | 25.4 | +0.28 / **−3.1** |

Rough stops a ball sooner than a fairway (1.5 against 3.4), the green still checks and sucks back, and the driver reaches 18.0 yd on a fairway against its sourced 21 — up from 14.6.

A test that briefly failed under the ground-only ordering was **left standing as a todo rather than weakened**, and the split fixed it without its number moving. That is what a real fix looks like against a kept assertion.

## Re-anchored to reality: a 56 degree wedge, and the firmness ladder the wrong way round

Everything in the firmness work before this was fitted against **a 7 iron at 10,400 rpm**, which is not a shot anybody hits. A 7 iron spins about 7,000; 10,000 belongs to a wedge. The reference is now a full **56 degree wedge — 88 mph ball, 31 degrees, 10,000 rpm, carrying 103 yd** — which puts its spin mid-band for that club rather than at an invented extreme.

### The direction was backwards, and the sources are unanimous

- *"A soft, receptive green will grab a spinning ball much more effectively than a firm, fast green"* — [Caddie HQ](https://www.caddiehq.com/resources/how-to-check-a-golf-ball-on-the-green)
- *"Firmer greens make it harder for the ball to check, while softer greens help the ball stop more quickly"* — same
- Course designers *"purposely firm up the greens to protect par"*, and balls need roughly **7,500 rpm** to stick at all — [Golf Simulator Forum](https://golfsimulatorforum.com/forum/golf-simulator-brands-and-types/the-golf-club/78643-green-firmness-and-stimp)

The model had firm greens sucking a ball back hardest. That came from my own misreading: the dramatic television backspin happens on **receptive** greens, not the baked ones players complain they cannot hold.

### How far a ball actually comes back

**15 to 20 feet** — 5 to 6.7 yards — for a tour player, and 10+ feet will sometimes spin a ball off the green ([Practical Golf](https://practical-golf.com/how-to-spin-golf-ball-with-wedges)). Our ladder had been carrying figures three times that.

### The first bounce goes forward, and there is footage

Titleist's slow-motion study, via [golf.com](https://golf.com/news/titleists-slow-motion-video-of-backspinning-ball-mesmerizing/): *"The ball hits the ground and bounces **forward** while spinning backward, then it takes 13 backward revolutions in the air before it hits the ground for its **second bounce**, and the ball begins to move backward."*

First bounce forward; reversal begins at the second. The `bounces === 0` floor is therefore observationally grounded rather than a house rule — though the aim is for it to be a backstop that never fires, not the thing holding a surface up.

### Two surfaces, fitted separately, each against the clubs that land on it

**The published total-minus-carry figures were never unreliable. They were being pointed at the wrong surface.** A driver's 275 carry against 296 total is a real fairway roll-out. A pitching wedge's 136/146 is not, because that shot lands on a **green** — and four separate fits were spent trying to make a 9,304 rpm wedge release ten yards on a fairway.

**Fairway** — driver, 3 wood, 5 iron layup. Spin transfer raised to the rigid-sphere ceiling of 2.5, which is what closed the spin gradient; ploughing moved all three clubs together and left the 5 iron six yards short. Ground plough 0.0950 to 0.0650.

| club | release | target |
|---|---|---|
| driver | 22.7 | 21 |
| 3 wood | 19.0 | 19 |
| 5 iron | 13.1 | 15 |

RMS 1.47 yd, nothing reversing, every first hop forward.

**Greens** — 56 wedge, pitching wedge, 9 iron, 7 iron. Firmness now acts by **scrubbing spin off**, not by digging: a putting surface is tight and shallow-marking, and the fit put ploughing flat across the firmness range without being told to.

| club | Soft | Normal | Firm | Burnt |
|---|---|---|---|---|
| 56 wedge | **−6.4** | −2.2 | −0.4 | +1.1 |
| pitching wedge | −1.1 | +1.1 | +1.9 | +2.8 |
| 9 iron | +0.6 | +1.8 | +2.8 | +4.4 |
| 7 iron | +3.3 | +6.2 | +8.9 | +11.8 |

Softer holds, firmer releases, and more spin checks harder at every firmness.

### The trap that caught me twice

A fit against the **wedge alone** looked excellent on the wedge and left a 7 iron running **12.3 yd** on a Normal green — a green that does not hold. Fitting a surface needs every club that lands on it, which is the same lesson the fairway taught with the 5 iron.

## Chipping: the first validation the low-speed regime has ever had

Chipping is taught as a **carry-to-roll ratio**, which is a far better anchor than launch numbers because it is what every short-game lesson actually measures. Published ratios: a pitching wedge **1:3**, a 52 degree **1:2**, a 56 and a 60 **1:1** ([GolfWRX](https://forums.golfwrx.com/topic/1176930-chipping-which-club-to-use-carryroll-ratio/), [Golf Sidekick](https://www.golfsidekick.com/knowledge/golf-wedge-usage-guide/)). Trackman's own guidance puts a 54-60 degree wedge at roll no more than its carry on a medium green, about 1.5x its carry on a tour-fast one ([Trackman](https://www.trackman.com/blog/golf/the-chip-shot-code)).

This matters because the regime below about 20 m/s of arrival speed has had **no validation data at all** through this entire project. Now it has some, and the model partly fails it.

### The first attempt was my error, not the model's

Chips were first tested at 2,800-4,200 rpm, which produced ratios of 1:0.2 against a wanted 1:1. That spin is unphysical. A full pitching wedge is **91 rpm per mph of ball speed**; a 22 mph chip at 3,800 rpm is **173 rpm per mph** — nearly double a full swing, with a clubhead that is barely moving. Spin per unit of ball speed is the check that catches this, and it should be applied to any hand-written short-game input.

### With realistic spin, chips still roll too little -- against one chart (withdrawn 2 October)

**Withdrawn as a defect on 2 October** (*After the ball lands*, below): the 1:3 / 1:2 / 1:1 chart is one of three published ones, the others give a pitching wedge 1:2 and 1:1 and a lob wedge 1:0.5 and about 1:0.3, and the model's ratios sit inside that spread for every club. The 40-65 rpm per mph used for these inputs was a judgement with no source; Trackman's chips run nearer 100. The measurements below stand; the conclusion drawn from them does not.

At 40-65 rpm per mph, rising with loft:

| club | inputs | carry | roll | ratio | want |
|---|---|---|---|---|---|
| pitching wedge | 25, 21, 0, 1000, 0 | 27.9 | 51.7 | 1:1.9 | **1:3** |
| 52 degree | 23, 28, 0, 1100, 0 | 28.8 | 40.0 | 1:1.4 | **1:2** |
| **56 degree** | 22, 36, 0, 1150, 0 | 29.7 | 28.1 | **1:0.9** | **1:1** |
| 60 degree | 20, 45, 0, 1300, 0 | 25.5 | 12.2 | 1:0.5 | **1:1** |

The **56 degree is right**. The others are short, and the ordering is correct throughout — a pitching wedge runs, a lob wedge stops.

**Solving for the ratio drives the spin off a cliff.** To reach 1:3 a pitching wedge needs the spin floor — 100 rpm, four rpm per mph — and still only gets to 1:2.1. A 60 degree needs 150 rpm to reach 1:1. Those are not chips. So this WAS recorded as a genuine defect -- "the bounce over-checks at chipping speeds" -- and it is withdrawn: the target was one chart's, and the next two charts found put the model inside the published spread.

### `elasticGain` was the obvious suspect and it is not the cause

It raises restitution as impact slows, and the numbers looked damning: a full shot arrives with the gain at **1.04**, a chip at **1.62**. Almost all of its authority is in the chipping regime, so it should have been both the cause and a free fix.

Swept, it is neither:

| ELASTIC_GAIN | PW chip | 56 chip | 56 wedge on greens | fairway drv/3w/5i |
|---|---|---|---|---|
| 3.5 (today) | 1:1.9 | 1:0.9 | −6.4 / −2.2 / −0.4 / +1.1 | 22.7 / 19.0 / 13.1 |
| 2.5 | 1:1.8 | 1:0.9 | −6.6 / −2.1 / −0.3 / +1.1 | 20.9 / 17.7 / 12.9 |
| 2.0 | 1:1.7 | 1:0.9 | −7.0 / −2.1 / −0.2 / +1.2 | 20.7 / 17.4 / 12.8 |

Lowering it moves chips the **wrong way** (1.9 down to 1.7, away from the 1:3 target) and moves the **fairway by two yards** — a driver from 22.7 to 20.7, which would break a fit anchored to published totals.

The reason is that the gain applies at **every bounce, not just the first**. A full shot's later bounces are slow, so that is where its authority actually lands: it is a full-shot parameter wearing a low-speed disguise. Any chip fix has to come from something that acts at chipping speeds **and nowhere else**, which `elasticGain` is not.

## Hang time, checked and left alone

Measured from strike to first touchdown, with the aerodynamic refit in place:

| club | carry | apex | hang | vacuum-ballistic | ratio |
|---|---|---|---|---|---|
| driver | 261 | 96 ft | **6.59 s** | 4.87 | 1.35 |
| 3 wood | 248 | 101 | 6.80 | 5.01 | 1.36 |
| 7 iron | 175 | 95 | 6.10 | 4.86 | 1.26 |
| PW | 130 | 85 | 5.39 | 4.60 | 1.17 |
| 56 wedge | 103 | 79 | 4.99 | 4.45 | 1.12 |

**PGA Tour average hang time is 6.1-6.3 s**, essentially unchanged year to year. Stenson led the tour at 6.9; the longest single shot recorded is 8.2 ([Golf Digest](https://www.golfdigest.com/story/the-five-players-with-the-shortest-tee-shot-hang-time-and-the-drivers-they-use)). Our driver at 6.59 sits between the average and the leader.

TODO carried this as "5-10% long, driver 7.45 s" for a long time. That figure predates the lift refit: flattening the curve fixed carry and apex, and **hang time came down with them without anyone aiming at it**. Worth recording because the entry stayed open long after it stopped being true, and was still being quoted as a live defect.

The last column is the sanity check — what a ball reaching the same apex would hang for in a vacuum. The ratio runs **1.35 for the driver down to 1.12 for the wedge**: lift holds the fastest ball up proportionally longest and a wedge is nearly ballistic. Inverted, or much above 1.5, would mean the lift curve had gone wrong somewhere the carry fit could not see. It has not.

**Left alone deliberately.** The remaining 0.3 s against tour average would have to come out of lift, and lift was then fitted to carry (3.2%), apex (3.7%) and descent angle (1.8%) -- figures superseded by the 6 October refit (*The flight refitted against three launch monitors*). The driver's real gap is carry — 261 against a sourced 275 — and chasing that risks the descent angle the whole bounce model depends on.

**The number on screen was a different one, until 10 October 2026.** Everything above is strike to first touchdown, measured from the flight's points. The *Hang time* tile in Shot data read `result.time`, which is when the ball stops: the driver above, hanging 6.5 s, showed 10.8 s on its tile -- about four seconds of roll added. Nothing in the model or in any fit was affected; the tile was wrong. `simulateShot` now returns `hang`, set at the same instant as `carry`, and the tile reads that. (Measured on flat fairway, 155 mph, 12.5°, 2,700 rpm: hang 6.54 s, at rest 10.82 s.)

## A home-screen icon on a password-protected host

Not a physics question, but it took outside sources to answer, and two of them
did not answer it -- recorded so the next person does not repeat the search.

**The symptom.** The owner's Netlify site is password-protected so it cannot be
scraped. Added to an iPhone's home screen, it got a screenshot of the page as
its icon, with 401s in Netlify's log.

**What the sources established:**

- [Exclude .webmanifest from password protection -- Netlify Support Forums](https://answers.netlify.com/t/exclude-webmanifest-from-password-protection/7710).
  The same failure on another site: Netlify's site-wide password protection
  applies to every file, the manifest included, and a manifest fetched without
  the login gets a 401. The poster reported the `crossorigin` attribute on the
  manifest link fixed it; Netlify's reply offered path-scoped basic auth
  instead. **Taken:** `crossorigin="use-credentials"` on the manifest link.
  Also noted there and NOT acted on: `.webmanifest` files are not served
  compressed on Netlify, `manifest.json` would be.
- [Password Protection overview -- Netlify Docs](https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/).
  Where the setting lives (Project configuration > General > Visitor access >
  Password Protection, or "Project visibility" on credit-based plans; a team
  default under Team settings > Access & security). Pro plans and above. It
  says nothing about Netlify Drop sites being protected by default.
- [How to password-protect a Netlify site or deploy previews -- Netlify Knowledge Base](https://www.netlify.com/knowledge-base/how-to-password-protect-a-netlify-site-or-deploy-previews/).
  Consulted from the same search; nothing beyond the docs above.
- [Set Apple Touch Icon for any website -- The Hidden Blog, 2019](https://blog.notmyhostna.me/posts/set-apple-touch-icon-for-any-website).
  Useful for a different reason than expected: iOS reads the apple-touch-icon
  link from the page AT THE MOMENT it is added, honours one injected by script,
  and will fetch it from a completely different address. That made hosting the
  icon publicly elsewhere a sound fallback. It does NOT use a data URL.
- [Apple Touch Icon: The Complete Guide -- Premium Favicon Blog](https://www.premiumfavicon.com/blog/apple-touch-icon-guide).
  Confirms the screenshot fallback when no icon is found; says nothing about
  data URLs.

**What no source settled:** whether iOS honours an apple-touch-icon given as a
`data:image/png;base64,...` URL. A search for it found tricks and file paths,
never a data URL. **Tested on the device instead: it does.** Confirmed on the
owner's iPhone on 26 September 2026, behind Netlify's password protection -- the
flag icon, full screen from the home screen, the password asked once inside
the app. So the home-screen icon lives in `index.html` and the manifest's
icons in the manifest, both written by `tools/make-icons.mjs`, and a private
host never has a reason to refuse anything the home screen needs.

**Rejected:** a data-URL MANIFEST. Chrome treats a `start_url` as invalid
unless it shares an origin with the manifest, and a data URL has no origin, so
the manifest stays a real file fetched once with the login.

## Touch targets, and the gestures a game page has to switch off

For the phone controls on the `mobile-play` branch. Sources read, and what was
taken:

- [Accessibility -- Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)
  (the page renders by script; its text was read from
  [the JSON behind it](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json)).
  iOS and iPadOS: **default control size 44x44 pt, minimum 28x28 pt**. Spacing:
  "about 12 points of padding around elements that include a bezel", about 24
  around the visible edges of one without. **Taken:** 44 as the floor for
  every control a round needs, aimed at 48 so rounding and a clipping panel
  edge cannot take it under. **Departed from:** the spacing. The camera row's
  buttons are 30 px with a few pixels between them and there is no room on a
  phone for 12 pt of padding each; their invisible 48 px margins overlap and
  split the gap halfway. The top bar and camera row are to be redrawn on the
  `hud-layout` branch, which is where that gets fixed properly.
- [touch-action -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action).
  `manipulation` allows panning and pinch zoom and disables double-tap zoom;
  the browser **intersects** the values of the touched element and its
  ancestors, and the property is not inherited. **Taken:** `manipulation` on
  the whole play area, which cannot loosen the `none` the scene and the map
  already carry.
- [overscroll-behavior -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior).
  `contain` (and so `none`) disables the browser's own pull-to-refresh and
  swipe navigation. MDN marks it **not Baseline**, with Safari the gap; on an
  iPhone the home-screen app has no pull-to-refresh to begin with, so the
  risk is Safari in a tab. **Taken:** `none` on the page.
- [display-mode -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode).
  `standalone` matches an installed web app. MDN says nothing about iOS or
  about Safari's older, non-standard `navigator.standalone`; the hint checks
  both, and that `navigator.standalone` is still set by iOS is from general
  knowledge, not a source read here -- **the owner's iPhone is the check**.

**Numbers placed rather than published**, and worth revisiting on a real
phone: half a degree and one yard a tap, and the hold's climb from 3 to 24
steps a second after 0.35 s. Half a degree is 1.7 yards sideways at 200, which
is finer than a fingertip on the course and coarse enough that nobody taps
forty times; nothing published says what a golf aim step should be.

## The play screen's edges, and a launch monitor without a monitor

For the redraw on the `hud-layout` branch. Sources read, and what was taken:

- [viewport meta, `viewport-fit` -- MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport).
  `cover`: "The viewport is scaled to fill the device display", with the advice
  to use the safe-area inset variables so content is not lost. `auto` (the
  default) leaves the page letterboxed away from a notch. **Taken:**
  `viewport-fit=cover`, and every panel padded by the insets.
- [env() -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/env).
  `safe-area-inset-top/right/bottom/left` are 0 on a rectangular viewport and
  a px value where the display's shape or system UI takes space; `env()` takes
  a fallback as its second argument. Baseline, widely available since January
  2020. **Taken:** `env(safe-area-inset-*, 0px)` in four edge variables on the
  playing area and in the top bar's side padding. MDN's page does not say the
  insets need `viewport-fit=cover`; on iOS they are zero without it because
  the page is letterboxed -- general knowledge, not read here, and the owner's
  iPhone is the check.
- [overflow -- MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow).
  `hidden` clips but "content can also be scrolled to programmatically";
  `clip` clips and "programmatic scrolling is not possible". **Taken:**
  `overflow: clip` on the playing area, after a Tools window running off the
  bottom of a phone had the browser scroll the whole HUD up under the top bar.
- [WebSocketRoute -- Playwright docs](https://playwright.dev/docs/api/class-websocketroute).
  Mocks or intercepts a page's WebSocket; added in v1.48 (this project runs
  1.63). The page does not say when a route takes effect. **Measured here:** a
  route added after the page loaded never saw the connection (the game logged
  `ERR_CONNECTION_REFUSED`); added before `goto`, it did. The smoke harness's
  `prepare(page)` hook exists for that.

**Placed, not published:** the edge gutters (16 px, 10 on a phone), the
panel widths (268 px, 330 on a big screen, 190 on a phone upright and 178
sideways) and the map sizes. They came from the approved mockups and were
then checked by the layout sweep, not taken from any source.

## A launch monitor on an iPhone, and why the hosted copy cannot reach it

Asked on 27 September: can the Netlify copy, added to an iPhone's home screen,
connect to a launch monitor? It cannot, and no setting in the game changes
that. Sources read, and what each established:

- [Mixed Content, W3C](https://w3c.github.io/webappsec-mixed-content/). Only
  images, video and audio are "upgradeable"; everything else fetched insecurely
  from a secure page is **blockable**, and a WebSocket is not in the upgradeable
  set. Loopback addresses count as potentially trustworthy -- but the bridge is
  on the computer, not the phone, so from the phone it is a LAN address and
  gets no exemption.
- [MDN, the WebSocket constructor](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)
  and [MDN, Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content).
  Neither states the WebSocket case outright; MDN confirms only that loopback
  and `file:` count as secure. Read and not relied on.
- [WHATWG WebSockets](https://websockets.spec.whatwg.org/). Delegates the
  mixed-content decision to Fetch; nothing further.
- [Apple Developer Forums 120869](https://developer.apple.com/forums/thread/120869).
  Safari blocks `ws://` from an `https://` page, and a SELF-SIGNED certificate
  for `wss://` fails validation (-9807); certificate handling for WebSockets
  cannot be customised. An Apple DTS engineer's answer for apps was native
  messaging (`WKScriptMessage`), which a web page does not have.
- [Apple Developer Forums 792842](https://developer.apple.com/forums/thread/792842).
  On iOS 26 beta 3 a `wss://` socket to a LAN address failed "The certificate
  for this server is invalid" even with the page's certificate accepted --
  clicking through a warning does not make a socket trust it -- and an
  insecure LAN socket sometimes needed a second attempt. Reported fixed by
  beta 5. Worth knowing if a phone connects on the second try only.
- [Apple community 256075428](https://discussions.apple.com/thread/256075428),
  [254087609](https://discussions.apple.com/thread/254087609),
  [251351003](https://discussions.apple.com/thread/251351003) and
  [Chromium 40386732](https://issues.chromium.org/issues/40386732): the same
  block reported from the field; found by search, not read in full.
- [TN3179, Understanding local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy).
  The page would not render for an automated fetch. Search summaries say the
  check is a packet filter covering every networking API and that a web view
  counts as its app; whether Safari itself ever prompts on iOS was NOT settled.
  If a phone cannot reach the bridge at all, Settings > Privacy & Security >
  Local Network is the first place to look.
- [caniuse, Web Bluetooth](https://caniuse.com/web-bluetooth). Not supported in
  Safari on iOS or iPadOS. So a phone's browser cannot talk to a monitor
  directly either: a computer running the connector and the bridge is needed in
  every arrangement, and the phone is the screen.

**What does work, today:** the page loaded FROM the bridge. Run the bridge with
`FAIRWAY_HTTP_HOST` set to the computer's LAN address and open
`http://<that address>:1922` on the phone. The page is then plain `http`, its
socket plain `ws`, and there is no mixed content to block. Checked on 27
September against the real bridge code (served on loopback, in Chrome): the
page loads with no console errors and connects. The address box then defaulted
to `ws://127.0.0.1:1922`, which on a phone is the phone; it now defaults to the
address the page came from, and remembers the last one that connected.

**What it would take for the HOSTED copy to connect** -- all three need the
bridge to speak `wss://` with a certificate the phone trusts, and its origin
check (loopback and private addresses only) to accept the hosted site:

- [Tailscale HTTPS certificates](https://tailscale.com/kb/1153/enabling-https).
  Real Let's Encrypt certificates for `machine.tailnet.ts.net`, issued by DNS
  challenge, private key kept on the machine, trusted by Safari. Machine names
  are published in Certificate Transparency logs. The name resolves to a
  Tailscale address, so -- this is the reading of how the name works, not a
  quote -- the iPhone needs the Tailscale app. The cleanest of the three.
- [Apple: trust manually installed certificate profiles](https://support.apple.com/en-us/102390).
  A home-made root certificate installed as a profile must also be switched on
  under Settings > General > About > Certificate Trust Settings. Works, per
  device, and fiddly.
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
  A random public `https` address for a local service, no account, "testing
  and development only", 200 in-flight requests, no uptime promise; the page
  read did not confirm WebSockets. **Rejected** in any case: it puts the
  bridge, which has no authentication, on the public internet.

A native iPhone app, which could open any connection it liked, was weighed on
26 September and set aside (it needs a Mac with Xcode and a developer account).

## Shipping the bridge to players

For the `ship-bridge` branch, 27 September: how a player holding the portable
archive runs the launch-monitor bridge. Sources read:

- [Node.js: Single executable applications](https://nodejs.org/api/single-executable-applications.html).
  Stability 1.1, active development. Building for another platform is possible
  only with the code cache and snapshot off, and the page advises building on
  the target; macOS needs `codesign`, and signing on Windows is recommended.
  ES modules and CommonJS are both accepted as the entry.
- [Bun: Single-file executables](https://bun.com/docs/bundler/executables).
  `bun build --compile` cross-compiles for Windows, macOS and Linux, x64 and
  arm64, from one machine, bundling the runtime; macOS still wants `codesign`
  with a JIT entitlement to get past Gatekeeper.

**Decided:** neither, for now. Both give a program with no Node.js to install,
and both give an UNSIGNED one that Windows warns about and macOS refuses until
the player overrides it; signing costs money. What shipped is the step both
would start from -- the bridge bundled into one file (`tools/build-bridge.mjs`,
rolldown, already installed with Vite) -- run by Node.js, with a start script
per platform. **Placed, not published:** "Node.js 20 or newer" is the current
LTS line, not a measured minimum; the bundle was only run on Node 24.

## Where the frames and the wait go (27 September)

A review asked for by the owner: can the game run faster everywhere, look
better on Ultra, and build courses faster. The plan it produced is TODO.md
*OPUS5.5 GFX and OPTIMIZATIONS*; the measurements behind it are here. All on
the development machine (desktop RTX 4090), 1366x768 unless stated.

**Frames** (from `bench/profile-baseline.json`, 22 September, 1600x900 at 2x;
taken with the probe that counted every frame twice, so triangles are half the
true figure and times are near-fastest-frame -- see *The profiler counted every
frame twice*): Redwood draws 46.5 M triangles a frame on Low and Medium, 92.9 M
on High and 69.7 M on Ultra (truly about double); every other biome at High
draws 3.1-4.6 M. Graphics time per
frame at High: Redwood 12.7 ms, Island 8.1 ms, the rest 3.7-4.8 ms. Island
also spends 6.8 ms of processor time per frame against about 1 ms elsewhere,
unexplained. **Why Redwood:** each tree model is one `InstancedMesh` over the
whole course, so its bounding sphere spans the course and it is never frustum
culled -- every tree is drawn every frame and again for shadows.

**How much of a course a tee can see**, computed in Node from
`generateWorld` (Redwood, 9 holes, seed REPORT1, 2,225 trees; camera 6 m behind
the blue tee looking at the centreline 220 m out; horizontal half-angle from a
53 deg vertical field of view at 1366:768): averaged over the nine tees, 39% of
trees are in view, 16% in view and within 600 m, 13% within 250 m; counting a
tree as drawn if its ~120 m square is in view, 45%. The range between tees is
wide -- 14% (tee 5) to 78% (tee 1) in view -- because a tee at the course's edge
looks across all of it. The PNW course of the same seed gives the same
averages.

**The wait** (browser CPU profile of `window.lab.course`, unminified build so
function names are real): 9 holes PNW 6.37 s to ready plus 2.83 s to the first
frames -- generation 2.97 s (ground grid 2.52 s, of which `analyticHeight` 1.91
s and `nearest` 1.67 s), `view.build` 2.03 s (`groundMaterial` ~0.8 s,
`addVegetation` 0.50 s, `addGroundCover` 0.46 s, `prepareWorld` 0.38 s),
the rest screen updates while waiting. The first frames are almost entirely
shader compilation (`getProgramInfoLog` 3.5 s inclusive over the run). 18
holes PNW: 11.21 s + 5.35 s (generation 6.55 s). **The compile is a cold
cost**: the same courses loaded second in the same browser drew their first
frame in 0.12-0.14 s; a course's program count is ~35 whatever the biome.
Opening the game: 4.1 s to the menu on a fresh browser profile, 1.7-2.2 s on
later loads.

**Screenshots** (Redwood tee, 10:15 sim time, each tier): Low to Medium
sharpens shadows and triples grass; High adds 3D clouds, god rays and mist;
High and Ultra are practically identical. The overhead view shows the ground
past the course edge stretched into streaks.

### Drawing only what is in view (F1, 27 September)

`src/instance-cull.js`; the design and its traps are in PROJECT_HANDOFF
*The planting is drawn from the camera's view, not the course's*. Measured
from all nine blue tees of seed REPORT1 (`lab.hole(n)`, camera settled, 20
frames counted by `tools/profile-probe.js`), 1600x900 at 1x, 10:15 sim time,
with the cull on and then off in the same page (`lab.cullTune({near: 1e9})`
keeps everything):

| Course, tier | Triangles a frame, average of 9 tees | Draw calls |
| --- | --- | --- |
| Redwood, High | 241.4 M -> 143.1 M (-41%) | unchanged, 731 average |
| Redwood, Low | 90.8 M -> 55.0 M (-39%) | unchanged |
| Pacific Northwest, High | 6.2 M -> 5.5 M (-11%) | unchanged |

Per tee the share of instances kept runs from 93% (tee 1, which stands at the
course's edge with the whole of it ahead) to 24% (tee 9). The Pacific
Northwest gains little because its triangles are mostly the ground (1.24 M)
and one light ground-cover mesh; the cull is aimed at heavy trees.

**Frame time**, with the CORRECTED probe (28 September; see *The profiler
counted every frame twice*). Graphics ms per frame, median, Redwood seed
PROFILE, 1600x900 at 2x, 10:15, real GPU; the cull holding everything
(`lab.cullTune({near: 1e9})`, which is the pre-cull scene) -> the cull on:

| Tier | Tee 1 | Tee 5 | Tee 9 |
| --- | --- | --- | --- |
| Low | 4.60 -> 4.23 | 4.12 -> 2.44 | 4.24 -> 2.53 |
| High | 14.43 -> 13.85 | 11.55 -> 7.78 | 12.02 -> 8.24 |
| Ultra | 14.49 -> 13.91 | 11.67 -> 7.82 | 12.21 -> 8.48 |

Tee 1 is the cull's worst case (it keeps ~90% of the course; see above) and is
the only view `npm run profile` measures, which is why the profiler shows the
cull as a few per cent. From tees that look across less of the course it is a
third to two-fifths off. The processor time per frame tracks the graphics time
closely in every row (High tee 5: 10.9 -> 7.2 ms), because an unthrottled page
waits on the card inside its own callback.

The first before/after, taken with the old probe the night before (the same
sweep on commit f3ac8dc in a separate worktree, and tees 5 and 9 by the same
on/off switch), read High 12.62 -> 12.34 and tees 5 and 9 10.7 -> 7.2; its
direction was right and its values were near-fastest-frame readings.

**The trap the profile caught: do not mark the buffers dynamic.** The first
version set `DynamicDrawUsage` on every instance matrix and colour buffer it
managed -- the obvious hint for a buffer rewritten as the camera moves. The
profile came back with High at 33 ms and Ultra at 34, against 12.6 and 12.8
before the cull, with Low and Medium untouched (old probe: the direction and
the size are not in doubt, the exact values are near-fastest-frame readings). Reproduced in a scratch
harness it was steady for the whole page (eight 60-frame chunks, all 32-34 ms),
present even in frames where the cull rewrote nothing, the processor time was
~31 ms too (waiting on the card), and it happened ONLY on a page opened after
another in the same browser -- High opened first was 12.6 ms every time, which
is why the drawn-triangle measurements above never showed it. Twice-repeated
switches, each after a Medium page: leaving the buffers' usage as built, 12.1-12.5
ms; uploading whole buffers instead of the used range, 30-33; leaving empty
meshes visible, 30-33. The newly dynamic buffers were the ground cover's (the
trees' matrices were already dynamic and were fine before) and every instance
colour buffer. The likely mechanism is the driver (ANGLE over Direct3D 11)
placing dynamic buffers where the card reads them slowly -- High reads them five
times a frame (view, three cascades, god-ray mask) -- but that is inferred, not
confirmed. Leaving usage alone, the rewrites cost nothing measurable.

**Why some tees read double.** Tees 6, 8 and 9 on Redwood High drew 1,000+
calls and ~360 M triangles without the cull, twice their neighbours: the sun is
in shot there, so the god-ray pass (`src/godrays.js`) renders the whole scene a
second time as its occlusion mask. It uses a flat black override material at
reduced resolution, so the pixels are cheap, but every triangle is submitted
again; the cull reduces that pass too, since it draws the same meshes.

**Cost of the cull itself.** A rebuild (test ~400 squares, copy the held
instances, upload only the used part of each buffer) took 0.5-1.0 ms on this
machine; following a driven shot it ran 76 times in 9 s, about 8 a second.
It does nothing while the camera is still.

**Does anything look different?** Screenshots with the cull on and off at
the same instant, counting pixels that changed noticeably (sum of RGB
differences over 24), against two shots with the cull on taken 0.6 s apart
(the wind and clouds keep moving): at 18:24 on Redwood hole 4, 12,550 changed
against 11,345 for the still pair; at 19:18 and 06:24, about 6,300 against
4,200-5,500. That is the noise floor plus at most ~1,500 pixels of 1.44 M.

**The bug those screenshots caught.** The first version handed the sun's
direction to the cull only when `this.sun.castShadow` was set -- but with
cascaded shadows the main sun light does not cast, the cascades do. The
shadow allowance silently did nothing, and at 18:24 332,539 pixels changed:
the long evening shadows of trees just off screen were gone from the
foreground. Raising the shadow-length cap from 400 m to 4 km changed nothing
at all (the same 133 squares held each time), which is what gave it away.
With the direction passed, 400 m and 1.5 km caps both came down to the noise
floor; 1 km was kept for margin at the lowest sun.

**Rejected: one mesh per square of the course.** It is the textbook split and
lets three do the culling, but Redwood has ~80 model/role meshes; at ~25
squares a course that is ~2,000 draw calls instead of ~600, which is processor
time, and weak machines have less of that to spare than graphics. Also
rejected: three's `BatchedMesh` with per-object culling, which tests every
instance on the processor for every pass -- the main view and three cascades,
~88,000 instances each on Redwood.

## The profiler counted every frame twice (28 September)

**Symptom.** Timing tree shadows with a scratch script, each "control" row --
the scene restored exactly as it was -- reported the PREVIOUS row's graphics
time: 8.44 ms after a case at 8.43, although the triangle count had come back
to 77 M from 21 M. Every measurement taken that way was suspect.

**Cause.** `tools/profile-probe.js` wraps `requestAnimationFrame` and treated
EVERY callback as a frame of its own. The harness counts frames with a
requestAnimationFrame of its own (`profile.mjs` does, and so did every scratch
script), so each real frame arrived as two samples: the game's, and a
near-empty one from the counter. The stored baseline shows it plainly -- a
300-frame sample recorded 602 frames. Three consequences:

- draws, triangles, programs and textures per frame were divided by twice the
  real frame count, so every recorded figure is HALF the truth (Redwood High:
  92.9 M recorded, ~180 M drawn);
- every median -- CPU and GPU -- was taken over a 50/50 mix of real frames and
  nothing, which lands it at the boundary, near the FASTEST real frame, and
  lets it jump when the mix shifts by a sample (the control-row symptom);
- the 95th and 99th percentiles were roughly the real 90th and 98th.

**Fix.** A frame is every callback sharing an animation timestamp. The probe
still times each callback with its own `TIME_ELAPSED` query -- a query left
open between frames would, on Direct3D, time the wait for the display, which is
the trap this file exists to prevent -- and sums them into the frame they ran
in; CPU time is summed the same way. Queries are tagged with the sample they
belong to, so one left over from an earlier sample is recycled instead of
counted, and the last three frames of a sample are left out because their
queries may not have resolved. Checked by measuring the same still scene two
ways, polled and counted by a second callback: 13.88 / 13.66 / 13.58 / 13.36
ms, 202-204 frames for a 200-frame sample, 586 draws and 152 M triangles every
time.

**What it changes.** The corrected tier sweep (Redwood, seed PROFILE, tee 1,
1600x900 at 2x):

| Tier | GPU ms | CPU ms | Draws | Triangles |
| --- | --- | --- | --- | --- |
| Low | 5.69 | 5.00 | 308 | 79.4 M |
| Medium | 8.86 | 5.30 | 320 | 79.6 M |
| High | 14.35 | 12.80 | 582 | 159.4 M |
| Ultra | 15.17 | 13.70 | 586 | 158.3 M |

The CPU column is no longer a small independent number (it read 0.9-3.6 ms
before). On a page that is not waiting for the display, time the card is
behind is time the callback spends blocked in WebGL, so CPU follows GPU when
the GPU is the bottleneck -- High's 12.8 ms is mostly waiting, not game logic.
A truly processor-bound case (Island's unexplained 6.8 ms, F5 in TODO) needs
re-measuring before it is believed either way.

**Every profile number recorded before 28 September is affected**, including
`bench/profile-baseline.json`, which `--since` compares against. Until it is
re-saved from a full sweep, `--since` compares a correct run against a broken
one and its differences mean nothing. The places in this file that quote the
old figures are marked where they stand.

**Re-saved the same day** (full sweep, 29 cases, 15.8 minutes). Graphics ms
per frame, median: Redwood Low 5.63, Medium 8.82, High 14.12, Ultra 15.36 from
the first tee; the whole-hole overview on Redwood is the heaviest case in the
sweep at 27.66 (High) and 27.23 (Ultra), on 174 M triangles; every other biome
at High 5.02-8.74 (Island the highest, and its CPU median of 8.40 now tracks
its GPU the way every other case does, so its "processor-bound" reading was
probably the old probe); High at 1x, 1.5x and 2x pixels 10.69, 12.44, 14.36; a
water course's reflection toggle 7.16 against 7.20 (still nothing); the
software rasteriser 3.3-3.8 s a frame.

## Only the trees a shadow map can reach (F3, 28 September)

`src/instance-cull.js` and `farParts` in `src/mesh-assets.js`; the traps are in
PROJECT_HANDOFF *The planting is drawn from the camera's view, not the
course's*. All measurements with the corrected probe, Redwood seed PROFILE,
1600x900 at 2x, 10:15, real GPU.

**Where tree shadows go.** A scratch run that took trees out of one shadow map
at a time (High, first tee) found every cascade drawing the same ~35 M
triangles of tree: 152 M a frame with all three, 118 M without the far one, 83 M
with only one, 48 M with none. The view cull (F1) had made that true -- a
culled mesh has no bounding sphere worth testing, so three put every held tree
into every map -- and so had the cascades themselves (below).

Graphics ms per frame, trees' shadows as they were -> as they are now:

| Tier | Tee 1 | Tee 5 | Tee 9 |
| --- | --- | --- | --- |
| Low | 4.12 -> 3.23 | 1.89 -> 1.78 | 1.91 -> 1.73 |
| Medium | 6.37 -> 5.74 | 4.03 -> 4.01 | 4.33 -> 4.20 |
| High | 13.28 -> 11.42 | 7.91 -> 7.34 | 8.12 -> 7.55 |
| Ultra | 13.63 -> 11.87 | 7.75 -> 7.22 | 8.19 -> 7.64 |

(each the mean of two alternating samples on the same page, `lab.cullTune({shadowMaps,
thinShadowsFrom})` switching between them). Upper bound for comparison: trees
casting no shadow at all took High's tee 1 to 9.3 ms and tee 5 to 6.3.

**Two parts, and why each tier gets what it gets.**

1. *Each shadow map draws only the trees inside it.* The instances are written
   in order of the first map whose volume contains their square, and each map
   draws a prefix. Exact for a single map (Low and Medium), where it drew 22-66%
   of the held trees depending on the tee. For the cascades it bought almost
   nothing: the nearest cascade held 84-100% of the trees. That is three's
   `CSM`, not the cull -- each cascade's shadow camera is a square whose side is
   the DIAGONAL of its slice of the view, and with `practical` splits at
   lambda 0.5 over 2.5 km the nearest slice runs to ~420 m, so the nearest
   square is about a kilometre across. Tighter splits would sharpen near
   shadows as well as shrink the cost; filed in TODO, not done, because it
   changes the look.
2. *From the middle cascade out, a crown's shadow comes from its thinned twin*
   -- a third of the leaf sprays, each grown about its own centre so the crown
   keeps its fullness (`farParts`; the trunk is shared). High and Ultra only.

**Rejected for Low and Medium: the twin in the single map.** It was the first
plan -- one shadow texel on Low is over half a metre -- and the screenshots
threw it out. Low's one map covers the trees beside the player, and a crown
shades ITSELF from it; shaded by a twin whose grown sprays do not sit where the
drawn ones are, every near crown went visibly darker (113,000 changed pixels
at 10:15 against ~4,000 of frame-to-frame noise, all of it in the crowns). A
caster that stands in for a receiver has to be the same shape as the receiver.
On High and Ultra the nearest cascade keeps the whole tree, and the twin only
shades what is beyond ~420 m, where the same comparison came out at the noise
floor: Ultra 20,386 changed pixels at 10:15 against 23,058 between two frames
of the unchanged scene, and the difference image shows only wind in the
near-field grass and a drifting cloud edge.

**Lossless checks.** The same on/off screenshot comparison as F1, at 18:24 and
10:15 on hole 4: map trimming on Low 1,935 changed pixels against 922 of
noise, 8,428 against 5,694; Medium 9,083 against 6,226, 20,245 against
11,655. The difference images show only grass blades and the animated aim
line: no shadow moved.

**A measuring mistake worth recognising.** The first round of these
screenshots reported every tier and both hours at exactly ~6,150 changed
pixels. The script built its settings inside the page from `process.env`,
which does not exist there; the page's setup threw before storing anything, so
every "tier" was the default and every hour was midnight. Identical numbers
across cases that should differ is the symptom -- the same one the profiler's
double counting had.

**Three facts about three.js this rests on (0.186).** `Object3D.layers` cannot
split shadow maps: `WebGLShadowMap` tests an object's layers against the MAIN
camera's, not the shadow camera's, so a mesh cannot be put in one cascade and
not another that way (tried first; it changed nothing). `onBeforeShadow` and
`onAfterShadow` run around each object in each shadow map, with the shadow
camera as an argument, and a changed `count` is read after them -- that is the
mechanism. `onBeforeRender` works the same way for the picture, which is how
the twin is kept out of it.

**Cost of thinning.** 8-10 ms per tree model in the browser's thread (typed
arrays; the first version with Maps took 16-35), done once per model a course
uses: about 0.15 s on a Redwood course, High and Ultra only. Nothing is added
to the download: the grower's `_Far` twins would have added an estimated 4-5
MB to the single file.

## Distant crowns drawn thinned (F2, 28 September)

`farTrees` in `src/graphics.js`, the far meshes in `src/instance-cull.js`. A
crown whose square is shorter on screen than a share of the screen's height is
drawn as its thinned twin (`farParts`) by a second mesh with its own buffer;
the full mesh keeps the rest. Every held crown is drawn exactly once, nothing
within 60 m is ever thinned, a square stays thin until it grows 15% past the
line (so a camera sitting on the line does not flicker it), and a thinned crown
casts with the thinned shape -- F3 showed a crown shaded by a different shape
goes dark.

**It buys little, because almost every tree anyone sees is big on screen.** A
90 m redwood is 15% of the screen's height at ~600 m. Sweep, Redwood seed
PROFILE, graphics ms, and the share of crowns drawn thin:

| Cutoff | Low tee 1 | High tee 1 | Thin, tee 1 | Thin, tee 5 |
| --- | --- | --- | --- | --- |
| none | 3.27 | 11.84 | 0% | 0% |
| 6% | 3.25 | 11.61 | 3% | 3% |
| 10% | 3.13 | 11.45 | 14% | 3% |
| 15% | 2.81 | 10.78 | 43% | 4% |

From tee 5 no cutoff changed the frame at all.

**And it costs draw calls.** Each far mesh is one more draw in the picture and
in every shadow map. Measured on and off (two alternating samples each):

| Tier, cutoff | Tee 1 | Tee 5 | Tee 9 |
| --- | --- | --- | --- |
| Low, 15% | 3.15 -> 2.62 ms, 333 -> 385 calls | 1.78 -> 1.78, 279 -> 306 | 1.73 -> 1.72, 266 -> 298 |
| Medium, 15% | 5.72 -> 5.23, 334 -> 391 | 4.00 -> 4.02, 279 -> 304 | 4.14 -> 4.24, 266 -> 301 |
| High, 10% | 11.96 -> 11.71, 586 -> 753 | 7.42 -> 7.46, 523 -> 571 | 7.95 -> 7.89, 504 -> 566 |

High: 0.25 ms for 167 more draws, and nothing for 50-60 more everywhere else --
processor time spent to save no graphics time, so High is off. Ultra is off by
the owner's instruction that it stays amazing, and would have gained no more
than High. Low and Medium are ON at 15%, pending the owner: half a millisecond
of graphics from the edge tee against 25-57 more draws, and whether that trade
wins on a weak laptop -- the machine Low exists for -- cannot be measured on
this one.

**Since 16 October, grown trees only.** Every number here is Redwood's. On the
other biomes the cartoon crowns crossed the line far more often (84-93% of all
crowns) and their twins came apart into shards; only crowns of 2000 or more
leaf triangles get a twin now. *Low and Medium trees: striped crowns and
shards*, below.

**How it looks.** At 15% on High from the first tee, the changed pixels lie
only in the far band behind the green (plus wind and clouds); enlarged three
times, the thinned distant crowns read very slightly darker and are otherwise
the same trees. The 19 September swap looked dead because it swapped by
distance at ~120 m and "nearly every visible tree was the thinned twin"; this
one swaps by size on screen, and at its most aggressive setting 43% of crowns
from an edge tee and 4-8% from a mid-course one are thin.

**Where the frame actually goes, then.** With F1-F3 done, Redwood's cost is
full-detail crowns that are large on screen, drawn once into the picture and
three times into cascades that each cover a kilometre. The levers left are the
cascades themselves (F6, done the same day: see below), resolution (F4) and the crowns' own overdraw.

## Shadow cascades split where the player stands (F6, 28 September)

`cascadeSplits` in `src/graphics.js`, `GolfView.cascadeSplitter` in
`src/renderer.js`. High and Ultra end their first two shadow cascades 100 m and
500 m from the camera; the third runs to the tier's shadow reach as before.

**Why.** three's `CSM` with `practical` splits (lambda 0.5) put the first edge
at ~420 m on High's 2.5 km reach and ~590 m on Ultra's 3.5 km, and each
cascade's shadow camera is a square as wide as its slice's diagonal -- so the
nearest map was about a kilometre across, spent its texels on ground nobody
stands on, and held 84-100% of the trees in view (found doing F3).

**Measured** (Redwood, seed REPORT1, 1600x900 at 1x, graphics ms, two samples
each taken alternately, three's split -> 100/500):

| Tier, hour | Tee 4 | Tee 5 |
| --- | --- | --- |
| High, 10:15 | 12.30 -> 11.14 | 11.36 -> 9.92 |
| High, 18:24 | 12.59 -> 11.66 | 15.26 -> 14.90 |
| Ultra, 10:15 | 12.64 -> 11.93 | 11.21 -> 10.61 |
| Ultra, 18:24 | 12.74 -> 12.78 | 15.69 -> 15.84 |

**Judged by the owner** from a flip page of all eight views: Ultra
indistinguishable, High's gains worth having, the seam where the nearest
cascade hands over (~100 m, faintly visible on the evening shots) acceptable
without blending. The seam is the split's own: with every tree in every map
(`lab.cullTune({shadowMaps: false})`) it looked the same, so F3's per-map tree
lists do not cause it.

**Rejected: `fade`** (three's blend between neighbouring cascades). Turning it
on recompiles every lit material with `CSM_FADE`, and the ground's own shader
patch did not survive: the turf rendered white (and timed fastest, because it
was drawing the wrong thing). Not needed once the seam was judged acceptable.

**Not in the overview.** The overview camera is hundreds of metres up, so
fixed 100/500 m edges would put the whole course in the last cascade; there the
split is three's own, as before (High 483/1107/2500, Ultra 1597/3637/9000
measured), and `render` re-splits on the way in and out even on High, whose
reach does not change there.

## The first frame, paid for behind the loading screen (B1, 28 September)

`GolfView.ready()` in `src/renderer.js`, awaited by `whileGenerating` in
`src/main.js`. Measured in a COLD browser each time (a fresh Playwright launch
is a fresh profile with no shader cache on disk, as for a first-time player),
Pacific Northwest seed REPORT1, High, 1600x900, RTX 4090; time from
`lab.course` to frames running under 50 ms:

| | Before: build, then frozen first frame | After: build (incl. prep), then first frame |
| --- | --- | --- |
| 9 holes | 5.0-6.8 s, then 1.9 s frozen | 7.1-8.4 s, then 0.01 s |
| 18 holes | 9.1-10.4 s, then 3.4-3.5 s frozen | 12.5-13.3 s, then 0.01 s |

The preparation splits into `compileAsync` (2.0 s on nine holes, 3.5 s on
eighteen -- the page stays live) and one frame drawn under the overlay (7-10
ms). Total press-play-to-smooth is unchanged within run-to-run spread on nine
holes (7.0-8.9 s before, 7.2-8.6 after) and about a second shorter on eighteen
(12.6-13.9 before, 12.7-13.4 after); what went is the frozen picture after the
overlay.

**Why it is two seconds at all: the floodlights.** Every pole is a spot light
(57 on nine holes, 141 on the longest eighteen; `FLOOD_LAMP_CAP` is 192), and
three writes the spot-light count into every lit material's program. With the
cap set to 8 as an experiment, the same runs gave `compileAsync` 0-0.6 s
instead of 2.0 on nine holes (once 2 ms: the menu backdrop had already built
identical programs, which never happens when the count differs per course) and
0.6 s instead of 3.5 on eighteen; press-play-to-smooth 5.2-7.1 s on nine holes
and 9.6 s on eighteen. Not adopted: it would light only the lamps nearest the
play at night, which is a change to the look and the owner's to make -- and
the owner declined it. B6 got the same win another way: see *Floodlit shaders
built after the course is on screen*. The frame cost of 57-141 zero-intensity spot lights looped over by every
lit fragment in DAYLIGHT is unmeasured with the corrected probe; the note in
`updateFloodlights` saying it costs nothing was taken with the old one.

`renderer.debug.checkShaderErrors = false`, suggested in the plan, was not
needed: once the links are awaited, the diagnostic reads it forces cost
nothing measurable (the frame under the overlay is 7-10 ms).

## Floodlit shaders built after the course is on screen (B6, 28 September)

`addFloodlights`, `setFloodlights` and `warmFloodlights` in `src/renderer.js`.
The floodlight lamps are hidden while off, so a course that starts with the
floodlights off builds programs with no spot lights in them -- the same set on
every course, most of which the menu backdrop has already built -- and the
programs for the lit state are built in the background once the course is on
screen (and the unlit state's, for a course that starts floodlit).

**Rejected first: a cap on live lamps.** The measured win was the same (B1:
cap 8 took shader preparation from 2.0 to 0-0.6 s on nine holes and 3.5 to 0.6
s on eighteen), but at night only the lamps nearest the play would light
anything, and from the overhead view that is a different course. The owner
declined it. This keeps every pole a light and moves the cost instead.

**Measured** (cold browser each run, PNW, seed REPORT1, High; `main` and the
branch alternated, because the machine's speed drifted over the session):

| Run | `main`: build, of which graphics prep | Branch: build, of which graphics prep |
| --- | --- | --- |
| 1 | 10.52 s, 3.23 s | 8.27 s, 0.12 s |
| 2 | 12.42 s, 3.10 s | 9.23 s, 0.76 s |
| 3 | 11.98 s, 3.00 s | 9.16 s, 0.72 s |

Press play to smooth: 2.3-3.2 s shorter on nine holes. Earlier, faster runs of
the branch alone gave 0.12-0.14 s of graphics prep on nine holes and
0.12-0.78 s on eighteen.

**The switch.** Worst frame in the two seconds after switching (`lab.floodlights`),
five seconds after the course appeared: starting in daylight, on 30 ms / off 21
/ on 19; starting floodlit, off 22 / on 20 / off 19. No stall either way.

**The cost moved, not removed.** Sending for the night programs is one scene
walk that creates ~35 programs on the main thread; the first frame after the
overlay now takes ~0.2 s instead of ~0.01 s. The linking itself happens on the
driver's threads while the player looks at the tee.

**Night looks the same.** Floodlit at 21:30, the branch against `main`: player
view 3,520 changed pixels against 2,932 between two runs of `main`; overview
39,087 against 9,959 -- and the difference image shows only the outlines of
drifting clouds (they move with time since load, and the two builds reach the
screenshot at different moments); the floodlit holes do not differ.

**The switch, early -- found by the owner in the course creator.** The lit
programs are built in the background from the first frame after arrival, and
on eighteen holes (141 lamps) that takes ~6 s. The course creator is where the
switch gets reached for straight away, and a switch in that window made the
next frame use programs the driver had not finished: switched 0.3 s after an
eighteen-hole studio landscape appeared, the game froze for **5.3 s** (nine
holes: 2.1 s at 0.3 s, 0.9 s at 1.5 s, nothing after 4 s). Now a switch that
lands while the build is running waits for it with the game live
(`setFloodlights` / `floodWarming`): the lights come on 5.9 s after the switch
on eighteen holes and 2.1 s on nine, and the worst frame meanwhile is 48 and
36 ms. The wait is the driver's and is not shorter; the freeze is gone. The
latest request wins, and a pending switch never carries over to a course
rebuilt in the meantime.

**Unmeasured:** whether hiding 57-141 zero-intensity spot lights in daylight
also makes the daytime frame cheaper. It should (every lit fragment loops over
them); it is a frame-rate question and frame-rate work is paused.

## The scene build and the loading screen (B4, 28 September)

A CPU profile of `lab.course` in the browser (unminified build, PNW nine, High)
put the 3D scene build (`view.build`, one synchronous block, so the page is
frozen for all of it) at ~3.7 s on a busy afternoon:

| Part | Time | Of which |
| --- | --- | --- |
| `addGroundCover` | 1.4 s | `world.surface` for every candidate tuft, 1.2 s |
| `groundMaterial` | 1.0 s | `nearest` for every texel of the ownership atlas (up to 1 M), 0.8 s |
| `refreshWaterEnvironment` in `build` | 0.8 s | the card finishing programs on the spot (`getProgramInfoLog`), 0.75 s |

It also found two stalls OUTSIDE the build: (1) at the start of every round
the menu scene about to be discarded re-photographed its ponds, because the
clock moved from the menu's hour to the player's -- 1.58 s measured with a
trace; (2) during B1's wait the game loop kept drawing the new course, and
the first frame to touch an unfinished program froze the page.

**Done:** the water probes are taken inside `GolfView.ready` after the shaders
are built (with the later additions hidden, so the capture is the same one --
no longer, since 10 October: *Wasted drawing*),
the outgoing scene no longer refreshes its environment (`view.retiring`), and
the game loop does not draw while `ready` waits. Measured against the
`daylight-lamps` branch it sits on, alternated, cold browser: the longest
freeze of the page while loading 3.70 / 4.78 / 4.57 s -> 3.05 / 3.14 / 3.22 s.
Press-play-to-smooth was within the afternoon's noise either way. The ponds
look the same: enlarged, only the animated ripples differ between the two.

**Not done, and why.** The ground cover's `surface` calls and the atlas's
`nearest` calls cannot be made cheaper without changing their answers: the
cover's order of random draws depends on which candidates are rejected first
(testing its cheap `patch` roll before `surface` would move every tuft), and
the atlas has to agree with the lie at hole boundaries, which rules out
guessing a block's owner from its corners. Both are per-point work that could
run on other cores; that is B2.

**Tried and dropped** (no measurable gain, reverted): a straight-hole shortcut
and an unrolled wiggle sum in `course-plan.js`'s `unitCenter` -- bit-identical,
no faster.

## The ground grid stops asking every hole about every point (B3, 28 September)

`src/course.js`. The plan's B3 was a faster "which hole is nearest" lookup.
Counted first: it already measured only 1.21 holes a call on nine-hole courses
and 1.43 on eighteen (5.19 on Island, which keeps a minimum per group of holes),
because the existing box rejection and last-winner-first order do the work.
There was little to take. A CPU profile of an eighteen (PNW, seed REPORT1,
7.5 s) found the time elsewhere, all of it questions the ground grid asks of
every point it samples:

1. **Which cells get refined** (`makeGroundGridSteps`' predicate): every hole
   was asked about every cell -- green within 38 m, tee pads, ponds, bunkers --
   after turning the point into that hole's frame. 1.4 s of its own plus the
   frame changes, the single biggest item, and quadratic in the course (twice
   the holes times twice the cells). Now each hole has a world box around every
   one of those questions' reach, and a cell outside it is answered `false`
   without the frame change.
2. **Pond and bunker basins** in `analyticHeight`: every point asked every
   basin, again by frame change first. Now a world box per basin (flat numbers,
   rebuilt when the list changes) is tested first.
3. **The green shaping** in `shapedNoTees`: every point inside a hole's
   tee-to-green box (+180 m) computed the green's full contour (`greenContour`
   -> `greenShape` -> `plateau`, ~1 s) BEFORE finding out how much the green
   weighs there -- and past the widest shoulder (100 m) the weight is exactly
   zero, because `smooth` clamps at 1. The contour is now skipped there.

**Every shortcut is exact:** a box is the same test's region turned into the
world and bounded, so anything outside it got the answer "no" before too, and
the green skip only drops points whose blend was already exactly zero.
`node tools/biome-fingerprint.mjs --check` -- every biome's GROUND hash -- was
unchanged after each step, which is the proof; no `GENERATOR_VERSION` bump.

**Measured**, generation only (`generateWorld` in Node, best of three, seed
REPORT1, `main` and the branch run back to back):

| Course | Before | After |
| --- | --- | --- |
| PNW, 9 holes | 2.46 s | 1.37-1.45 s |
| PNW, 18 holes | 8.79 s | 4.19-4.25 s |
| Redwood, 9 | 3.19 s | 1.73-1.90 s |
| Island, 9 | 4.01 s | 2.76-2.91 s |
| Links, 18 | 10.26 s | 4.79-4.93 s |

About 40% off a nine and half an eighteen. The browser's press-play-to-smooth
could not be measured cleanly that afternoon (the owner's machine was busy:
`main` itself ran 14-16 s on nine holes against 7-8 s that morning), so the
generation figures are the ones to trust.

**Tried and dropped: rewriting `nearest` to allocate nothing** (no closure per
call, the frame change inline, one object for the winner only). Bit-identical
and measured no faster -- V8 was already removing those allocations -- so it
was reverted rather than kept as complexity for nothing.

**What is left** (profile of the same eighteen afterwards, 3.2 s): `nearest`
0.8 s inclusive (the one measurement a point genuinely needs), land shaping
and tee pads ~0.4 s, `routeHoles` 0.25 s, the grid's own bookkeeping ~0.4 s.

## The ground grid's heights on every core (B2, 28 September)

`src/gen-pool.js`, `src/gen-worker.js`, `makeGroundGridPooled` and
`sampleRows`/`sampleExtras` in `src/terrain-grid.js`.

**The earlier objection, and the way round it.** *Where generation actually
spends its time* ruled out a worker because a generated world is full of
closures that cannot cross a thread. The grid does not need the world to
cross: each worker generates its OWN copy from the same settings (generation
is deterministic) and stops at the grid (`generateWorldSteps(settings,
{capture: true})`), keeping only `analyticHeight` and the refinement question.
Nothing but numbers crosses: row bands of heights and mask bits, and lists of
points and their heights.

**Why the grid cannot come out different.** The main thread does not assemble
the grid a second way. `makeGroundGridPooled` runs the unchanged
`makeGroundGridSteps` twice -- a dry run that records where it asks for each
refined vertex, then the real run -- feeding it `sample` and `refine` answers
computed by the workers, in exactly the order it asks for them. The order of
vertices, the refinement, and every float are the serial ones by construction.
Held to the byte by `tests/parallel-ground.test.mjs` (PNW nine, Island nine,
Links eighteen, with bands and chunks handed back in reverse order), and in the
browser by `lab.ground()`: the same ground hash with workers and without, on
every course tried, twice.

**Browsers.** A page opened from disk (`file://`) may start a CLASSIC worker
from a blob URL in Chromium, and may not start a MODULE one (tested with a
scratch page: classic ok, module "worker error", data URL ok). So the worker is
built as a classic script and embedded (`?worker&inline`); it adds ~89 KB to
the single file (15.89 -> 15.98 MB). Firefox and Safari were not available to
test here; on any browser that refuses, or any worker error or 60 s timeout,
the pool answers null and the grid is built on the main thread as before --
the same course, only slower.

**How many.** One fewer than `navigator.hardwareConcurrency`, at most eight.
Not for one-hole worlds (the range, endless), where starting the workers costs
more than they save.

**Measured** in the browser (Chromium, this machine while busy with other
work, so absolute figures are high; workers off by hiding `Worker`, alternated):

| Course | Generation, workers off | Generation, 8 workers | Course ready, off -> on |
| --- | --- | --- | --- |
| PNW, 9 | 2.59 s | 1.88 s | 11.6-11.7 -> 9.2-10.6 s |
| PNW, 18 | 9.05 s | 3.42 s | 16.0-16.5 -> 13.9-14.2 s |
| Links, 18 | 12.14 s | 3.64 s | 18.0-18.7 -> 14.3-15.1 s |

The main thread's waits on the workers were 0.9-1.5 s for the rows (which
includes the workers finishing their own copy of the world) and 0.16-0.5 s
for the refined points. Generation is now a minority of the wait: the rest is
the scene build and the graphics card (B4's leftovers, below).

**The ownership atlas too.** The ground shader's record of which hole owns
each texel (up to a million of them, `nearest` per texel, 0.8 s of the scene
build) needs only what exists before the grid -- except its straw channel.
So the workers compute the hole, lake and stream channels from their own copy
(`owner-atlas.js`, shared with `ground.js` so the size and the questions cannot
drift apart), starting as soon as the grid's heights are in and running while
the main thread assembles the grid and plants; the ground material only adds
straw. Held to the byte against the loop `ground.js` used to run, both for the
main thread's own path and for worker bands handed back in reverse
(`tests/parallel-ground.test.mjs`). `largeLakes`/`lakeOwner` moved above the
grid in `course.js` so a worker holds them; nothing in them depends on the
grid. Measured (busy machine, alternated): the longest page freeze while
loading 6.58/6.97 -> 5.79/5.81 s, the build 11.6/12.6 -> 10.0/10.1 s.

**Left:** placing the ground cover asks `surface`, which needs the finished
grid for `height` -- tens of megabytes per worker to send without shared
memory, and shared memory is not available to a page opened from disk.

## Distant shadows that came and went with the camera's heading (29 September)

Reported by the owner from the course creator's free camera over a Redwood
eighteen: distant shadows changed as the camera turned, worst looking down.

**Cause, measured.** CSM gives each cascade's shadow camera a fixed depth range
-- `lightFar`, 2 km from a point `lightMargin` sunward of the slice. For each
cascade, the deepest corner of its slice of the view in its shadow camera's
space (`bench/shots/csm-clip.mjs`, scratch; Redwood eighteen, High, 16:30, eight
headings, from a tee and from 300 m up): the near and middle cascades always
fitted, and the FAR cascade's slice ran 1,040 to 3,404 m past the 2 km, by an
amount set by the heading relative to the sun. Everything in the overrun lies
outside the shadow map and reads as lit. The 400 m sunward margin had the same
shape of problem at the near end: a tree standing further sunward than that,
off to the side of the slice, could not throw its shadow in, and at a low sun
a tall tree's shadow runs further. Neither is from this week's shadow work --
three's own split has the same 2 km.

**Fix.** `GolfView.fitCascadeDepth`, every frame after `csm.update()`: each
shadow camera's far plane is set to the deepest corner of its slice plus 200 m
(ground below the corners, and a tree on it), never under 2 km; the sunward
margin is 1 km (`CASCADE_SUNWARD`), the same reach the view cull keeps for
off-screen casters. The constant shadow bias is in normalised depth, so it
would grow with the range and lift shadows off the ground; it is scaled by
2 km / far, which keeps it the same distance in metres as before. Remeasured:
no cascade overruns at any heading (the far one now reaches 3.8-6.2 km). The
bird's-eye view at 17:30 facing west now shades the distant forest the way the
foreground is shaded; near the tee the shadows are unchanged apart from a few
more long ones from trees now allowed to cast from further sunward.

## The ground past the course edge (U7, 29 September)

`src/landscape-edge.js`. Seen from the overview: the land around the course
ran in streaks radiating from it, and a thin light rectangle marked where the
course's ground met it.

**The streaks were sliver triangles.** Every landscape ring carried every
perimeter vertex (3 m apart at the course's edge) pushed outward, while the
rings were 12 m to 4 km apart -- so far out each triangle was tens of metres
along the ring and kilometres across it, about 70 to 1, and heights and normals
sampled finely one way and coarsely the other shaded as streaks. Now the rings
start 8 m apart and widen by 1.28 each step to 13 km, and each ring carries
only as many vertices as keep its spacing along the ring near its step outward
(at least 48); rings with different counts are stitched by walking both at
once. Worst aspect among triangles over 50 m: 6.6 to 1. Vertices: ~6,600
against ~20,000 before (Redwood nine); built in 19 ms.

**The rectangle was two things.** Normals: each mesh computed them from its own
triangles only, so they disagreed along the seam; `stitchSeam` gives both the
average. And tone: the course's ground carries a baked relief value per vertex
(`attachRelief` in ground.js) and the landscape had none, read as zero --
wherever the perimeter sat on a crown, that was a light line. The landscape now
takes the relief at the seam and fades it to nothing over the first 300 m.
Remaining: the rectangle is still faintly readable from straight above, where
the relief field ends; the ridges beyond it keep their creases, which are
the ridge shape the ring lift draws on purpose.

## Every surface in patches (U3, 29 September)

`src/ground.js`, the block before the fine grain. The owner's brief: colour
variation "tastefully for every surface, just like a real course has patches of
different colors". From world position (two octaves of smooth value noise at
the surface's own scale, plus a third, three times larger, for dry and lush
drifts), so patches stay put as the camera moves. Full strength per surface,
as a multiple of brightness either way, and the scale of a patch:

| Surface | Brightness | Scale | Dry / lush drift |
| --- | --- | --- | --- |
| Rough | +-18% | 30 m | strongest |
| Semi-rough | +-14% | 18 m | strong |
| Fairway, and mown tee ground | +-13% | 13 m | moderate |
| Fringe | +-8% | 8 m | light |
| Green | +-4.5% | 5 m | none (tone only) |
| Sand | +-11% | 9 m | damp patches instead |

The Graphics panel's *Turf colour variation* scales all of it; 60% is the
default the report was judged at, so a green varies about +-2.7%. Greens are
kept faint on purpose: every green-reading cue works in brightness, and a
patch at the scale of a break would compete with it. Dry drifts use the same
parched multiplier the slope tint uses (blue shed, a little red gained), so
they read as fescue rather than damage. Patches smaller than a few pixels are
held back (`fwidth`), so nothing shimmers at distance. No new texture, no
extra pass: a few noise lookups per ground fragment.

## Distance fading into the sky (U4, 29 September)

`src/mist.js` (the fog patch) and `updateDaylight` in `src/renderer.js`. Far
hills were the same green as near ones, which flattens a landscape more than
anything else. Every lit fragment is now drawn toward the horizon's colour by
distance (1 - exp(-d / 1800 m)), and toward the sun's colour in the sun's own
quarter (the view direction's dot with the sun, to the 6th power, at most
55%). Strength from the new graphics preference `haze`: 50% by default,
`AERIAL_MAX` .62 at 100%. Weather off leaves it on -- this is the air, not fog.

**Thinner looking down.** The first version greyed the whole bird's-eye view,
the ground straight below included: a camera 300 m up is 300-600 m from
everything it sees. Haze lives in the low air and a steep sight line crosses
little of it, so the effect falls to a fifth for sight lines steeper than
about 30 degrees (`steep` = |dy| / distance, eased between .12 and .55).
Sight lines near the horizon -- the far hills, from the tee or from the air --
keep all of it.

**Every tier.** The fog patch used to be registered only on tiers with mist
(High, Ultra). It is now registered everywhere, with mist densities zero where
the tier has none and the water field baked only where it has it, so Low and
Medium get the haze without paying for mist.

**Found on the way.** The overview showed U3's rough patches as camouflage --
30 m patches at 2-5 m a pixel. The patches now fade out below ~25 pixels
across rather than ~7, which keeps them at play and flyover heights and drops
them from a kilometre up.

## How a tree moves in the wind (U2, 29 September)

`windMaterial` in `src/textures.js` (`crown`, `leaf` and `rooted` modes),
`addModelSpecies` and `addSpecies` in `src/vegetation.js`, and the `treeRoot`
packing in `src/instance-cull.js`.

**What real trees do, and where it comes from.**

- A tree sways as ONE body in its first mode: the whole stem bends one way,
  curving more toward the top, as a damped oscillator. Field studies place a
  single accelerometer just below the main branching precisely because that
  one point represents the whole tree; sensors on branches pick up "higher
  order effects". Source: *Tree sway in response to wind*, Frontiers in Earth
  Science 2018,
  <https://www.frontiersin.org/journals/earth-science/articles/10.3389/feart.2018.00221/full>
  (read; example spectrum peaks near 0.2 Hz).
- The natural frequency rises with trunk diameter and falls with height:
  linear in DBH / H^2 over 602 trees of eight conifer species, pines lower than
  spruce and Douglas-fir for their size. Moore and Maguire 2004, *Natural sway
  frequencies and damping ratios of trees: concepts, review and synthesis of
  previous studies*, Trees 18: 195-203,
  <https://link.springer.com/article/10.1007/s00468-003-0295-6>. The paper
  itself is paywalled and was NOT read; the relationship and the tree count
  are from its abstract as quoted in search results. Figures quoted from other
  summaries in the same search: conifers dominantly 0.2-0.5 Hz, a 15 m tree
  about 0.4 Hz, trees generally 0.1-5 Hz. *An architectural understanding of
  natural sway frequencies in trees* (J. R. Soc. Interface 2019,
  <https://royalsocietypublishing.org/doi/10.1098/rsif.2019.0116>) returned
  403 and was not read.
- Games do this as "main bending" plus "detail bending": the whole plant is
  displaced along the wind by a factor that grows steeply with height, then
  each vertex is pulled back to its original distance from the root
  (`normalize(newPos) * length`) so the plant curves rather than shears; leaves
  add small high-frequency motion on top. Tiago Sousa, *Vegetation Procedural
  Animation and Shading in Crysis*, GPU Gems 3 ch. 16,
  <https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis>
  (read).
- Gusts are carried downwind at about the mean wind speed -- Taylor's "frozen
  turbulence" -- which is what makes honami, the waves that roll across a wheat
  field, and cat's paws on water. Finnigan 1979, *Turbulence in waving wheat*,
  Boundary-Layer Meteorology 16: 181,
  <https://ui.adsabs.harvard.edu/abs/1979BoLMe..16..181F/abstract> (abstract
  only). Dupont et al. 2010, *Modelling waving crops using large-eddy
  simulation*, <https://yakari.polytechnique.fr/Django-pub/documents/duponts2010rp-1pp.pdf>
  -- fetched, but the PDF could not be read here; its patch sizes and speeds are
  still to be taken from it.

**What was built from that.**

- *One bend for the whole tree.* Every part of an imported tree -- bark, limbs,
  foliage, flowers -- takes a single displacement that depends only on its
  height up the tree: the cantilever shape h^2 (3 - h) / 2 (h from 0 at the
  root to 1 at the top; the deflection of a beam loaded at its tip, where
  Crysis uses a similar steepening polynomial), along the wind plus a smaller
  crosswind sway a quarter-turn behind so the top traces an ellipse, then
  pulled back to its distance from the root. Only the leaves add a rustle of a
  few centimetres.
- *Its own sway.* 3 H^-0.75 swings a second, which gives 1.0 at 5 m, 0.39 at
  15 m (the 0.4 quoted), 0.23 at 30 m, 0.14 at 60 m -- inside the 0.2-0.5 Hz
  conifer range where the trees are conifer-sized. The exponent and constant
  are fitted to those quoted points, not taken from the paper: with no trunk
  diameters in the world data, DBH / H^2 cannot be evaluated directly.
- *How far.* Tip deflection = H x breeze x wind setting x species factor x
  (0.004 + 0.010 x gust + (0.002 + 0.004 x gust) x sway). On a 60 m redwood
  (species factor 0.7 for conifers) that is about a tenth of a metre on a still
  day and up to about 1.3 m at the peak of a gust in 15 mph. PLACED, not
  published: no source was found for tip deflection against wind speed, so
  these are judged on screen and are the first thing to revisit if one turns
  up.
- *Gusts as fronts.* The gust field is noise stretched across the wind (160 m)
  and short along it (45 m), with a 60 m by 17 m octave for texture, dragged
  downwind at the course's wind speed converted to m/s (at least 1.5 m/s).
  Every swaying thing samples it at its root, so a crosswind front bends the
  trees on the upwind side of a fairway first and the far side seconds later --
  the owner's description of what it should look like. Checked with the bend
  exaggerated 15 times over a Pacific Northwest fairway from above: bands of
  leaning trees with upright ones between, the bands moving in the direction
  the trees lean.

**The two versions before it, and why they were wrong.**

1. Leaves only, bark still -- so a trunk never moved from where it collides.
   Leaves swaying on a rigid trunk looked wrong to the owner at once.
2. Bark and leaves bent together, but the leaves also shivered fast across the
   crown (6.3 rad/s, up to 0.3 m at the top of a 60 m tree), and every tree
   bobbed at the same 1.2 rad/s. The owner still saw leaves and trunk moving
   separately: a crown moving by a rule the trunk does not share can never look
   attached, however the numbers are tuned.

The gust went through the same two steps: first one sine wave down the wind,
200 m crest to crest, crossing at 50 m/s, so everything in view swung together
back and forth through upright; then round noise patches, better, but a patch
has no front, so nothing showed a gust arriving on one side first.

**Procedural trees bend too.** The trees built from primitives (hala, ocotillo;
every other species has an imported model) are a trunk, branches and leaf
pieces, each its own instance, so an instance's own position says nothing
about which tree it belongs to. Each instance now carries `treeRoot` -- the
tree's root and height -- and bends about that. The instance cull repacks the
instance buffers every time the view changes, so it packs `treeRoot` alongside
the matrices and colours; without that a leaf would bend about another tree's
root.

**What does not move.** Cacti and agave (`STILL`): a saguaro is a column of
water in a skin, an agave's leaves are stiff blades, and the cactus model had
been swaying like a tree. Stones and soil at a tree's foot. And the SHADOWS:
three draws them with its own depth material, which does not carry the patch;
a 1 m shift at the top of a 60 m tree does not read in its shadow.

**Collision.** The bend is under a centimetre at 3 m up a 60 m trunk (about 3
mm at full gust), so the trunk physics collides with and the one drawn agree
wherever a ball can reach.

## Rough grass clumps (29 September)

`grassClump`, `groundShaded` and `groundLit` in `src/vegetation.js`.

The owner was not a fan of the near grass: "5 2D tufts in a circle". Close up
it read as dark scratches on the ground, for three reasons found in turn:

- **The shape.** Five single triangles placed at golden-angle points on a ring,
  every clump the same ring. Now seven blades from one root, each tapering in
  two segments and curving outward as it rises, at uneven angles (golden angle
  plus up to 37 degrees of jitter), heights 55-100% and lean 6-26% of the
  height. Seeded per course; instances rotate and size it.
- **The lighting.** A thin toon-shaded triangle facing away from the sun falls
  to the ramp's darkest step, and DoubleSide flips a back face's normal
  downward. Every blade normal now points straight up and is kept on both
  faces, so grass takes the light and shade of the turf it grows from. Colour
  runs from .62 at the root to 1.12 at the tip (times the instance colour).
- **The wind.** Grass bent by its height in MODEL units, the same for a 7 cm
  tuft and a metre of prairie, so the short rough was pushed further sideways
  than it was tall and lay flat. It now bends by its real height above the root
  (strength .2 near, .22 for the course-wide blades, .3 for the forest-floor
  ferns, retuned for world heights).

Short rough is also a little bigger (9-26 cm, 0.8 footprint, was 7-23 cm and
0.55). The course-wide blades kept their shape and took the lighting and root
shading. Cost: 21 triangles a clump against 5, in the 25 near tiles only.

## Foam and sun sparks on the ponds (U5, 29 September)

`addShoreFoam` and the glint term in `dressWater`, `src/renderer.js`.

**Foam.** A pond is one flat shape whose every vertex is on its outline, so
nothing on the water knows how far it is from the bank -- the stream shader's
`shore` fade has nothing to read on a pond, and `bankAtlas` holds the bank's
profile, not a distance on the water. So the foam is its own mesh: the outline
and a copy moved 1.4 m inward, 3 cm above the water. Its opacity is a band that
surges between about 0.3 and 0.6 of the strip's width along the shore, cut into
lace by two drifting noise layers, at most 42% opaque, all on 30% of the
water's clock -- at full speed the owner found the lapping frantic. **The first attempt read
as white tape round every pond** (colour #f3f7f4, 78%, a lower lace threshold);
it was toned down to a grey-green white and a sparser lace. Lit by the toon ramp,
so it dims with the evening. One draw per pond.

**Glint.** The view reflected off the rippled normal, compared with the sun's
direction and raised to the 700th power, then broken into sparks by fine noise
drifting with the ripples: a scatter of points around the sun's mirror image,
not a smooth blob. Fades out as the sun reaches the horizon.

**A trap found on the way, worth knowing before touching this shader again.**
The water's extra colour is written at `#include <opaque_fragment>`, and by then
three.js has already turned `diffuseColor` into `outgoingLight`. Changing
`diffuseColor.rgb` there does nothing on screen; only its alpha still counts.
The glint was invisible from every pose tried until it was added to
`outgoingLight` instead. An older line beside it, meant to brighten the water
toward grazing (`diffuseColor.rgb=mix(...,fres)`), had the same problem and had
never had any effect; the owner chose not to make it work, and it has been
removed. The fresnel term still sets the water's opacity, which is the part
that did work.

**Verified** by placing the camera on the sun's mirror line over the
Pacific Northwest pond (seed REPORT1, 16:00, sun 38 degrees up): sparks around the reflection
point and along the lit water, none on the shaded side. No outside sources.

## Soft shade under trees and rocks (U1, 29 September)

`src/occlusion.js`, the cover texture in `groundMaterial` and the `cueShade`
block in the ground shader (`src/ground.js`).

**The brief asked for screen-space ambient occlusion and got a bake instead.**
SAO or GTAO needs the scene drawn into a render target first, and routing the
scene through one costs the canvas its MSAA -- the reason the god rays avoid
EffectComposer. A multisampled target would have kept it, at the price of a
full-screen pass on every frame, and the pass would darken whatever the depth
buffer showed, fairways and bunker faces included. What the brief described is
narrower: trunks and rocks that look set down on the grass, forests deeper
than open rough. Every occluder is in the world data already, so the ground
can know exactly how much sky it loses without looking at the screen.

**The model.** Per texel, what reaches the ground is multiplied down by each
nearby occluder, so overlaps deepen without passing full dark:

| Occluder | Full strength inside | Gone by | Strength |
| --- | --- | --- | --- |
| Trunk (girth = 2.7% of height, max 3.6 m, as course.js pads launches) | half the girth | half girth + 2 m + 0.8 girth | 0.70 |
| Crown (`crownRadius`) | a quarter of the crown | 1.1 crowns | 0.22 |
| Boulder (`reach`) | 0.7 reach | 1.3 reach + 1.2 m | 0.60 |
| Ground plant (fern, shrub) | centre | 0.8 r + 0.4 m | 0.22 |

The shader multiplies the turf by one minus that, times the slider (default
60%), taking a little less out of blue than red and green so it reads as shade
under leaves rather than as dirt; half strength on greens. The strengths were
judged on screen, not taken from a source: at the first figures (0.5, 0.16,
0.45) the effect at the Redwood tee was only visible side by side.

**Where it lives, and why not in its own texture.** The lit shaders have one
texture sampler of headroom against the 16 WebGL guarantees (the note on
floodlight shadows in PROJECT_HANDOFF), and a seventeenth does not slow a
program, it stops it linking and the ground vanishes. The ground already
sampled the ownership atlas twice -- once exact, once linearly filtered as
`cover` for the straw -- and the second copy used one of its four float
channels. `cover` is now its own texture of bytes: red the occlusion, green
the straw. No new sampler, and a quarter of the memory the float copy took.
The cost is resolution: the ownership atlas's 1.75 m texels (2 m on an
eighteen), which is fine for something meant to be soft.

**Measured.** Bake time on REPORT1: PNW nine 8 ms (2342 trees), Redwood
eighteen 12 ms (4448), Links eighteen 4 ms, Desert nine 3 ms. No frame cost
beyond one texture read the shader already made.

## A forest floor on Ultra (U6, 29 September)

`floorTile` in `addNearbyGrass`, `src/vegetation.js`; `forestFloor` in the
Ultra tier.

Fern clumps (seven arching fronds, 0.6 to 1.5 m across, tinted from the
biome's tree colour toward a lighter green) and fallen sticks (0.35 to 1.65 m)
in the same 24 m tiles as the near grass and from their own seeded draw, so
they are where they were each time the camera returns. Up to 400 fern and 90
stick candidates a tile, each kept with probability 1.9 or 1.1 times the U1
occlusion at that spot -- so the floor gathers under the canopy and is nothing
on open rough -- and only on rough. Both shrink into the ground between 28 and
48 m out, as the grass does, so the edge of the tile ring is never seen.

**Decoration only, on purpose.** Nothing here is in the world, so physics
cannot know about it. That is acceptable only because none of it is taller
than an ankle: a ball rolling through a fern looks right, a ball rolling
through a log would not, which is why there are no logs. The first colour
(lerped 25-65% toward #9fbf5a) looked like paper cut-outs against the Redwood
rough; it was taken down to 12-50% toward #7fa24a.

**Cost.** Up to two more instanced draws per grass tile, 25 tiles in the ring
(a tile with no floor carries no empty meshes). The first half of the TODO
item -- full-detail trees further out on Ultra -- was already true: Ultra has
drawn every crown whole since F2 (`farTrees: 0`).

## What the ultra-looks branch costs a frame (29 September)

`npm run profile -- --only tiers`, Redwood player view, RTX 4090, graphics-card
milliseconds per frame (median). "Before" is the branch's starting point
(render-identical to main), swapped into `dist/` for the run; alternated twice.

| Tier | Before | Branch | Branch, forest floor off |
| --- | --- | --- | --- |
| Low | 2.90 | 3.05 | -- |
| Medium | 3.92 | 4.12 | -- |
| High | 7.09-7.11 | 7.20-7.28 | -- |
| Ultra | 7.45-7.59 | 8.44-8.73 | 7.58 |

So everything but the forest floor together -- patches, shade, haze, sway,
foam and glint, the landscape rings, the fitted shadow cascades -- costs about
0.15 ms on every tier, and the forest floor about 0.9 ms of graphics time and
about 1 ms of processor time on Ultra. Ultra at 8.4-8.7 ms is now just over a
120 Hz frame (8.33 ms) on this card where it was just under. Later runs that
evening were unusable -- High at 21 ms with nothing of the branch's changed --
with Chrome Remote Desktop and a busy browser on the machine; they are not in
the table. The baseline in `bench/profile-baseline.json` was not re-saved.

## Reading the ground, again (30 September)

Branch `ground-reading`. The owner's brief: many of the *Reading the ground*
settings do nothing; ground shading and slope tinting are liked but look odd on
desert and links; greens look flat even at the highest settings and the green
settings make them look unreal. Free rein over the settings; nothing about how
the course plays may change; the Ultra looks (patches, shade under trees) stay.

### What each setting actually did

Measured by `bench/shots/read-cues.mjs` (scratch): one setting changed at a
time through the real Graphics panel, High, 12:00, wind sway off so nothing
else moves, REPORT1; the change is the mean brightness shift over the ground
part of the frame, out of 255. A "nothing changed" control reads 0.00 on the
green view, so every figure below is the setting and not noise. A first run
read everything as zero because it read the canvas back after the frame had
been presented -- the pixels come back blank -- and was thrown away.

On a green, standing 12 m from the pin (Pacific Northwest; Links and Desert
within a few tenths):

| setting | before | after |
| --- | --- | --- |
| Contour lines on | 16.4 | 13.5 |
| Ground shading off | 2.9 | 2.1 |
| Green definition 0 / 100 | 0.4 / 0.8 | 4.5 / 5.3 |
| Mowing band strength 100 | 3.3 | 4.9 (as *Green mowing bands*) |
| Mowing stripes off | 1.2 | 5.7 |
| Sunlight on contours 0 / 100 | 0.04 / 0.15 | removed |
| Slope darkening 0 / 100 | 1.9 / 0.9 | removed |
| Band grain 100 | 0.9 | removed |
| Grass sheen off | -- | 4.4 (new) |

Sunlight on contours did nothing at noon for the reason already written above:
with the sun high, tilting a surface barely changes the light it catches.
Green definition barely moved anything because the only thing it fed that
still survived was the raking-light term. Slope darkening was the one green
cue that did something, and what it did was darken every green by about 8%
fairly evenly -- which read as dirtier turf, not shape.

### Why desert and links looked odd: slope tinting

Toggling each setting over the land (30 m up) showed it plainly: with slope
tinting on, the banks and dunes of Desert and Links were banded in saturated
gold and orange, and the semi-rough strip beside a sloping fairway went lime.
The tint multiplied the turf by (1.16, 1.00, 0.50) -- take out half the blue,
which on green grass reads as drying -- and did it to turf that was already
straw. The earlier write-up had measured the result and called it fescue:
desert rough at full dryness went to 215, 153, 52, which is orange.

**Fixed by drying only as far as the turf is green.** The same multiply, scaled
by how green the colour is (its green channel over its red and blue, relative
to its brightness, times 2.5, clamped): a fairway gets all of it, Pacific
Northwest rough (82, 98, 56) about half, Links and Desert rough nothing, since
dry grass has nowhere left to go.

**Rejected, twice, on the way:**
1. Mixing toward a straw colour at the turf's own brightness (`lum x (1.17,
   1.05, .74)`). It fixed the dunes and turned steep rough on a Pacific
   Northwest hillside grey-khaki and the desert grey -- odd in a new way.
2. The same with the greenness gate and a warmer straw (`1.3, 1.12, .62`). The
   rough was fine, but a sloping FAIRWAY washed out to a pale grey smear where
   it fell toward a pond: irrigated turf on a bank should yellow a little, not
   bleach. That is what sent it back to the original multiply.

### Ground shading comes from the sun's side

The raking light that makes a fairway read at noon was lit from a fixed
compass bearing, (-0.6, -0.5), whatever the hour -- for much of the day a
second light source arguing with the cast shadows, plainest on bare dunes. It
now takes its bearing from the sun's (`sunDir.xz`, already refreshed as the
clock moves), still at a fixed low angle so it reads at midday; with the sun
within a few degrees of overhead the bearing eases back to the fixed one
rather than swinging.

### Greens: how flat they really are

`bench/shots/green-shape.mjs` (scratch) samples the slope over the putting
surface of five greens from the world's own `height` and `surface`:

| Green slope & difficulty | overall tilt | variation about it | steepest |
| --- | --- | --- | --- |
| 0 | 0% | 0% | 0% |
| **35 (default)** | **0.5-1.4%** | **0.5-0.7%** | 1.4-3.3% |
| 70 | 1.2-3.3% | 1.3-1.8% | 3.4-8.0% |
| 100 | 2.1-5.9% | 2.3-3.3% | 6.0-14.4% |

At the default a green is very nearly a tilted plane: the shape a player reads
-- the variation about the tilt -- is about half a percent. No shading can show
contour that is not there, only exaggerate what is; raising *Green slope &
difficulty* in the studio is the way to have more of it, and that changes how
the course plays, which is the owner's call. For comparison, real putting
surfaces are commonly built at 1-3% with hole locations kept under about 3%
(NOT re-sourced in this pass; a figure to check before it is relied on).

### What the green gets now

- **Grass sheen** (new switch, on). Mown grass seen at a low angle is lighter
  than grass seen from above, and a player sees a green at a low angle -- about
  8-10 degrees from 10-12 m at eye height. At that angle a tilt of a degree or
  two changes the angle you see the turf at by a large fraction, so turf tipped
  away from you reads lighter and toward you darker, at any hour and with the
  sun anywhere. Implemented as `(1 - N.V)^4` against the same for flat ground,
  so level turf is untouched and nothing brightens toward the horizon. Mown
  turf only. On a green it uses the tilted shading normal, so *Green
  definition* drives it. **Strengths, after the owner saw it:** gain 1 on
  fairway and tee, clamped to 0.72-1.30 -- the owner liked what it did to
  fairways and asked to keep it; 1.2 on the green and 0.5 on the fringe,
  clamped to 0.90-1.10. The first build ran the green at 4.5 (after 2.2 had
  looked too faint on a still frame) with the fairway's clamp, and in play it
  looked like a graphical bug: the sheen depends on where you stand, so whole
  regions of a green changed tone as the camera moved. A still screenshot
  cannot show that, which is why the first tuning got it wrong.
- **The clean-up lap.** A green is cut in straight passes and then once round
  its edge, one mower's width, the other way from the passes it crosses; a band
  of different tone runs round every real green out to the collar. Drawn from
  0.65 m inside the edge to the edge (a greens mower cuts roughly 0.55-0.65 m;
  from memory, not re-sourced), anti-aliased and faded with distance, and part
  of the mowing pattern, so it goes with the stripes switch. The first cut ran
  from 0.95 to 0.4 m in and left a strip of plain green between the lap and the
  fringe, which the owner spotted. It traces the outline, and because it
  follows the ground it shows the edge rising and falling.
- **A fixed 7% darker tone.** Removing slope darkening left greens visibly
  paler than they had been; the tone is kept without the blotches.
- **Defaults** (`GREEN_READ_GEN` 4, so saved records adopt them once): green
  definition 50, green mowing bands 40. The bands were at 10 because they
  competed with slope darkening's shading; with the sheen doing that job they
  come back to where a green looks mown.

**What this does not do, stated plainly.** At the default difficulty, from a
standing view, a green still looks gentle, because it is: half a percent of
shape. The sheen makes the tilt and the larger rolls visible and changes as you
walk round, which is the cue a real green gives; it does not invent breaks,
and should not. The TODO entry *Greens that read at midday, five ideas not yet tried*
keeps the further options, with its own caveat about chasing the last of it.

All shading: `surface()`, the physics and the generator are untouched; the
biome fingerprints are unchanged and no version bump was owed. No outside
sources were consulted for this pass.

## Greens with a character each (30 September, GENERATOR_VERSION 33)

Branch `green-shapes`. `greenContour`, `greenRecipe`, `greenShape` and
`greenPedestal` in `src/course-plan.js`; the pedestal is applied in the green
blend in `course.js`'s `height`.

### What the owner saw, and what caused it

A screenshot of a green at an evening sun, from above: a bright diagonal band
across the surface and the shelf beside it in shade -- "tiered elevation on
many of our greens". Two things together:

1. **Nearly every green had a step.** The shape was one recipe for every green:
   a tilt, three crossing ridges drawn as rounded SQUARE waves
   (`tanh(2.1 sin t)`), a dish and a tier. Square waves are shelves with short
   steep faces between them, so almost every green carried one or two faces
   whatever the seed. The height maps of nine greens at 60% difficulty make it
   plain: five of them are the same diagonal lean with the contour lines bunched
   along one or two faces (`bench/shots/green-maps.mjs`, scratch).
2. **At a low sun the green's own raking light lit each face as a band.** The
   green-only directional relief (`ground.js`) ran at a gain of 4 on a shading
   normal tilted about 3x, and since the *Reading the ground* rebuild it comes
   from the sun's side -- so at a low sun a face turned toward it went bright and
   the shelf beside it dark, on top of the real light and shadows already
   showing it. Reproduced on Desert at 17:48 and 18:30 (hole 6 of REPORT1).

### Fixes

**The raking light eases off with the sun.** Full strength above about 33
degrees of sun elevation, a third of it below about 9 (`smoothstep(.15,.55,
sunDir.y)` on the sun direction's height), and a narrower range, 0.86-1.12
(was 0.78-1.18). At a low sun the real light carries the shape; this exists
for midday.

**Every green draws a character from its seed** (hole and seed, never the order
greens are asked about, so the generation workers build identical greens):

| character | share | what it is |
| --- | --- | --- |
| rolling | 32% | three or four broad smooth mounds and hollows (6-10.5 m radius) |
| tiered | 22% | one real tier: a step across the green, face 2.6-3.6 m wide |
| ridged | 20% | a single spine or swale with a smooth profile across the green |
| crowned | 14% | a turtleback that sheds balls off every side |
| bowl | 12% | a dish that gathers them to the middle |

Every green also has a drainage tilt -- two in three falling toward the
approach, the way greens are built to drain and to show their surface to the
shot -- and two small rolls so no green is clean. Only the tiered fifth have a
step. Domes and swales have flat tops and floors, which is what keeps level
ground for a cup.

**The top of the slope slider reaches further, at the owner's request.**
Surveyed across five seeds, the same method as the numbers above (flat site,
the whole putting surface):

| setting | before: mean / 95th pct / steepest / relief / under 2.5% | after |
| --- | --- | --- |
| 35 (default) | 1.22% / 2.6% / 4.2% / 1.3 ft / 94% | 1.06% / 1.9% / 4.5% / 1.1 ft / 99% |
| 70 | 3.00% / 6.3% / 10.4% / 3.1 ft / 45% | 3.46% / 6.3% / 14.6% / 3.7 ft / 28% |
| 100 | 5.39% / 11.4% / 18.6% / 5.6 ft / 12% | 7.23% / 14.5% / 26.7% / 7.2 ft / 7% |

**The studio warns past 75%** (`warn` on the schema entry): the slider turns red as it is dragged across, and the note under it and a toast once it is let go, at the owner's request. The note first appeared mid-drag; it sits in the field's label, so it grew the field, the panel's balanced columns reflowed, and the slider jumped 229 px out from under the cursor (measured with a real mouse drag) -- the owner saw it as a glitch and a stutter. Only the colour follows the drag now, because it changes nobody's size; the note waits for `change`, which a pointer fires on release and the keyboard on each step. Shown on release inside the field, it still reflowed the columns and the field hopped to another one, so the note is now a bubble floating over the panel (positioned on the field, flipped above it when the scrolling panel would cut it off below) and moves nothing: measured, the slider's position is the same before, during and after. Because it covers whatever is under it, it closes at the next click or tap, after 8 s, or when the value comes back under 75; the red stays as long as the value does. 75 is where the average slope (3.8%) passes the 3% the sources below give for most of a putting surface; 90 averages 5.5%, which is the old 100.

The curve stays superlinear, `s(0.6 + 0.4s^2) x 1.9`, now times
`1 + 6.1 max(0, s - 0.4)^2` (was `1 + 3.75 max(0, s - 0.6)^2` in the first cut
of this branch, and nothing before it). The default barely moves.

Three things had to change with it, each found by a test failing:

- **The tilt stops scaling with everything else.** Scaled fully, a 100% green
  leaned 5-7% and only 3.5% of it was flat enough for a cup
  (`tests/pins.test.mjs` wants more than 6%). Real severe greens are severe in
  their contours, not in leaning the whole surface. The tilt now grows fully to
  an amplitude of 1.3 and at 15% of the rate past it.
- **Severe greens' rolls are broader as well as taller.** Scaling only the
  height put a metre of relief into a few paces, and the slope under a putt
  jumped 5.3-5.9% in a metre (`tests/lab.test.mjs` allows 5%). Features spread
  up to 48% wider at the top (`1 + 1.2 max(0, s - 0.6)`).
- **A severe tier's face widens with its step.** At 100 a tier's step is about
  1.5 m, and on the default face width its steepest point was 32% -- a wall.
  The face widens in proportion once the amplitude passes 2.5; the steepest
  ground on any green at 100 is now 21-27%.

The default tilt was raised part-way through (draws of 1.6-2.7% x amplitude,
from 1.0-1.9%): the first cut left default greens tilting 0.35-0.65%, well
under the 1.5% surface-drainage minimum the sources below give, and gentler
than before at a time the owner was already finding greens flat.

### Raised greens, punchbowl greens and false fronts (SCHEMA_VERSION 9)

Three new settings, each a share of greens, drawn per green from its seed so
moving a slider changes which greens qualify without redrawing any shape.

- **Raised greens** (default 25%): the green and its collar lifted 0.9-1.6 m
  (3-5 ft) as one piece, with banks falling away over 5-8 m beyond the collar.
  Constant across the putting surface, so a putt cannot feel it; a chip has to
  climb it. From the fairway the surface hides behind its front bank and only
  the flag shows, as with a real elevated green.
- **Punchbowl greens** (default 10%): the same, sunk 0.6-1.1 m, surrounds
  rising around it. Raised takes priority if the two shares add past 100%.
- **False fronts** (default 20%): the front of the green, from 74% of its
  radius out to the edge and on through the collar, falling 0.55-0.9 m times
  (difficulty)^0.6 over 3.2-4.8 m -- at the default about 0.3-0.5 m (1-1.6 ft).
  In the putting surface itself (`greenContour`), so the pin chooser sees it;
  it starts beyond the front pin band, so it takes no hole locations.

A save from before (schema 8) migrates to none of the three rather than the
defaults; its greens change shape anyway, which GENERATOR_VERSION 33 tells the
player. The range sets all three to 0. The studio shows them under *Fairways &
greens*, derived from the schema entries.

**Placed, not published:** the character shares, mound sizes, tier widths and
bank widths are judgement. The false front's height and the raised green's
height are inside the ranges the sources give.

### Sources

- LINKS Magazine, *False Fronts: History, Evolution, and 10 of the Best*,
  <https://linksmagazine.com/false-fronts-history-evolution-and-10-of-the-best/>
  -- via search summary: a false front is a portion at the very front sloped
  back toward the fairway, often **one or two feet high at the edge**, too
  steep for a ball to rest; most common on Golden Age courses (1910-37).
  Not fetched in full.
- Hole19 glossary, *False Front*,
  <https://www.hole19golf.com/glossary/false-front> -- definition only.
- Golf Course Industry, *Getting back-to-front green slope right*,
  <https://www.golfcourseindustry.com/article/getting-back-to-front-green-slope-right/>
  -- via search summary: **1.33% the minimum upslope to stop shots, 1.5% the
  minimum for drainage**. A direct fetch returned no content.
- Golf Course Industry, *Slippery Slopes*,
  <https://www.golfcourseindustry.com/article/green-slopes-golf/> and the USGA
  Green Section Record, *Putting Green Speeds, Slopes, and "Non-Conforming"
  Hole Locations* (2008), <http://gsr.lib.msu.edu/2000s/2008/080721.pdf> --
  via search summary: most of a putting surface should not exceed **3%**; hole
  locations where combined downhill and cross slope is under **5.5%**. Neither
  was read in full; both are the first to read if the pin caps are revisited.
- Golf Info Guide, *Elevated Green (aka Push-up, Pedestal Green)*,
  <https://golf-info-guide.com/golf-terms/elevated-green-aka-push-up-or-pedestal-green-term/>
  -- via search summary: **most pedestal greens are raised less than 5 feet**
  above the fairway, some five or ten. Informal source.
- Fried Egg Golf, *Golf Course Architecture 101: Greens and Surrounds*,
  <https://thefriedegg.com/golf-course-architecture-101-part-4-greens-surrounds/>
  and Planet Golf's glossary,
  <https://www.planetgolf.com/news/a-glossary-of-golf-course-architecture> --
  appeared in the searches for push-up and punchbowl greens; nothing specific
  taken.

## F5: the three quick fixes (30 September)

Branch `f5-quick-fixes`. Frame times from `npm run profile` (RTX 4090) and
from a frame counter with vsync off, alternated against main built in the
same sitting.

**(a) The fog is the draw distance.** `camera.far` was a fixed 20 km while the
fog only faded what was drawn. It now ends 5% past the fog's end, per view
(player or overview), with a 1.5 km floor. The sky is a 7.5 km dome that a
nearer far plane would cut, so it follows the camera and is scaled to 90% of
the far plane; its colour depends on direction only, so neither changes its
look -- except for the water probes, which render the scene from each pond:
the sky goes back to full size at the origin for them and returns after.
**Measured, it saves nothing on the courses as generated.** From the player's
view on Low (fog ends at 3.5 km) a nine-hole course has nothing past the fog to
cut: draws 364 and triangles 42,369,644 identical before and after, 2.41 ms of
graphics time either way; Medium the same. The instance cull already reads
`camera.far`, so trees past it are dropped when there are any. Kept because it
is correct and costs nothing, and because it is the lever the tier ladder
claims to have -- but Low is cheaper because of its shadows, pixels and
planting, not its fog.

**(b) Reflections off.** The per-frame planar mirror went some time ago; the
setting now chooses what each body's cubemap probe shows. Profiled: 3.80 ms on,
3.78 ms off, identical draws -- no per-frame cost either way. What "off" did
not save was the probe itself: a render of the whole course from each body,
taken at build and every time the sun moves six degrees, measured at 40.7-66.3
ms a time on PNW and Midwest nine-hole courses (four and five bodies) -- most
of which, it turned out on 9 October, was a throwaway `PMREMGenerator`
recompiling its shaders, not the renders (*The time slider hitched*). It was
taken whether or not the water showed it. Off, `refreshWaterEnvironment` now
returns at once (0 ms), and switching reflections back on takes the probes.

**(c) Island.** Logged as 8.1 ms of graphics time at High and 6.8 ms of
processor time, twice the other biomes. Now, on the same profiler: 4.2 ms
graphics and 3.6 ms processor, against 2.3-3.3 ms for the other light biomes
(Redwood is heavier for its trees). With a frame counter, hiding one category
at a time (High, Island tee view, 3.1 ms a frame):

| hidden | Island saves | PNW saves |
| --- | --- | --- |
| scatter grass and flowers | 1.21 ms | 0.11 ms |
| trees and plants | 0.55 ms | 1.62 ms |
| near grass tiles | 0.17 ms | 0.18 ms |
| water (Island: the ocean) | 0.03 ms | 0.23 ms |

A CPU profile of steady frames on both shows only three.js's own drawing
calls at the top; nothing of ours stands out. **Island's remaining cost is its
scatter grass**: four times the blades of most biomes (400,000 candidates, tall
and 1.4 wide). **Tried and rejected:** fading those blades out between 220 and
360 m -- it saved nothing (1.17 ms against 1.21), because the cost is the
blades near the player, not the distant ones. Thinning Island's grass would
change how the biome looks; left as the owner's call. The ocean, a single 14 km
quad, costs nothing measurable.

## The water's edge, by kind (30 September)

Branch `water-edges`. `seaDepthMap`, `WATER_EDGES` and `addShoreFoam` in
`src/renderer.js`.

### The flicker on Island and Links

The ocean is a single 14 km quad at sea level; the coast is wherever it cuts
the terrain, whose triangles are 3 m across. On a gently shelving beach the
two surfaces are within a degree or two of each other, so (1) the waterline
followed the triangle facets as a sawtooth, and (2) the depth buffer could not
settle which surface was in front along a strip of it, so that strip changed
with every small camera move. Measured by photographing a shoreline, moving
the camera 15 cm and differencing: on Links the whole waterline changed as a
continuous line; after the fix it does not (only the ripples, which are
animated, differ).

**The fix is to let the sea know its depth.** The coarse height grid the
terrain is built from (`world.groundGrid.values`, 3 m) is uploaded as a
half-float texture -- half floats because linear filtering of full floats is not
guaranteed in WebGL2 on phones; near sea level that is millimetres. The sea's
shader samples it at each fragment, so it knows how deep it is, and fades its
opacity over the last 35 cm. There is no hard edge left to flicker, and the
bilinear heights make the shoreline smooth where the triangles made it
jagged. Past the grid the sea is treated as deep. The grid and the drawn
terrain agree except where the terrain was refined; coasts are not refined,
and the fade is wide enough to hide the few centimetres where they differ.

**Rejected:** a logarithmic depth buffer (it changes every shader in the scene
and gives up early depth rejection, for a problem confined to one edge); and
pulling the sea toward the camera with a depth offset (it moves the coastline
visibly at a distance and still leaves the sawtooth).

### Foam, by kind of water

| kind | what it is | how it is drawn |
| --- | --- | --- |
| sea | swash -- broken water running up the beach and draining back | a foam line at a depth that runs from 0.62 m to 0.03 m and back on a 30 s cycle (9 s of the water's clock, run at 30% as the ponds are), 30% uprush and 70% backwash, phased along the coast; thinner foam behind it; a faint breaker line at about 1.15 m depth |
| lake | wind-driven wavelets lapping, bigger than a pond's for more open water | the pond strip, 2.2 m wide (pond 1.4), coarser lace (0.75x), on 42% of the water's clock (pond 30%) |
| pond | unchanged, approved by the owner | the 1.4 m lapping strip |
| river | foam gathering along banks and on seams where currents meet, drifting downstream | lace stretched about two to one along the channel, carried at the water's own speed, strongest near the banks, with a faint seam |
| creek | shallow, fast, broken over its bed | scattered white flecks carried by the current, more toward the banks |

**Too fast, and all one way (the owner, after the first build).** The sea's
surf and foam now run on 30% of the water's clock, the same slowdown the
ponds took. Rivers and creeks were worse on two counts. The water's speed was
0.25 m/s and the foam drifted at more than twice that, so both were busy; the
water is now 0.12 m/s and the foam moves at exactly the water's speed. And a
channel had ONE flow direction, first station to last (`flowFor`), so where a
river bent back on itself its ripples and foam carried on the way it started.
Every station now has its own downstream tangent and its distance along the
channel (`streamFrame` in `water-bodies.js`, stored per vertex as `flow` and
`chan`): the ripples use the local flow in the same two-phase flow-map
sampling as before, and the foam is drawn in channel coordinates -- metres
downstream minus how far the water has carried it, and metres across -- so it
follows every bend exactly. Rotating a world-space noise pattern to the local
flow was not used: it swims visibly round a bend, because a small turn of a
large coordinate moves the sample a long way. Downstream is toward the lower
end of the channel, not the order its stations were stored in; a test holds
all three (`tests/water-bodies.test.mjs`).

The foam in the water's own shader is lit by the light the water's diffuse
received (divided back by the water's diffuse colour), so it dims at dusk with
everything else, and it is added to `outgoingLight` for the reason the glint
note gives. Each kind is its own shader program (`fairway-water-v4-<kind>`),
so the sea's texture read costs nothing on a pond.

**Tried and rejected on the way:** the first river foam stretched its lace
seven to one along the flow, and only the rare peaks survived the threshold --
thin white slashes that read as scratches on the water. The first sea foam was
too faint (a few white specks); the lace threshold came down and the lines
up.

**Cost.** Profiled on the biome group (High, RTX 4090): Island 4.09 ms of
graphics time against 4.17 before, Links 3.39 against 3.26 -- inside the
noise. One earlier run read Island at 6.5 ms and did not repeat.

**The numbers are placed, not published.** The sources describe the processes
(swash uprush faster and shorter than backwash, over seconds; foam collecting
in lines along banks and seams) but give nothing to set a foam width or a cycle
length by for a cartoon frame; the 9 s cycle and 0.62 m reach were chosen on
screen.

Sources:

- [Wikipedia -- Swash](https://en.wikipedia.org/wiki/Swash) (via search
  summary): swash is the turbulent layer of water washing up the beach after a
  wave breaks, uprush and backwash, with uprush faster and shorter; greater on
  flatter beaches.
- [Coastal Wiki -- Swash zone dynamics](https://www.coastalwiki.org/introduced/Swash_zone_dynamics)
  and [Swash zone](https://www.coastalwiki.org/wiki/Swash_zone) (via search
  summary): time scales of seconds to minutes; uprush up to 2 m/s on gently
  sloping foreshores.
- [Wikipedia -- Foam line](https://en.wikipedia.org/wiki/Foam_line) and
  [Lilly Center for Lakes & Streams -- Why is there foam in my river?](https://lakes.grace.edu/why-is-there-foam-in-in-my-river/)
  (via search summary): foam collects where currents meet into a seam, along
  shorelines and in eddies, downstream of rapids.
- Also returned and not used: [Swash Zone Dynamics (Springer)](https://link.springer.com/rwe/10.1007/978-3-319-93806-6_404),
  [Breaking wave (Wikipedia)](https://en.wikipedia.org/wiki/Breaking_wave),
  [ALMS -- Foam on surface waters](https://alms.ca/wp-content/uploads/2014/02/Foam.pdf).

## B7: the hitch after a course appears (30 September)

Branch `frame-and-lights`. `withStandIns` / `showStandIns` and `ready` in
`src/renderer.js`, `standIn` in `addNearbyGrass` (`src/vegetation.js`), and the
`no-late-shaders` smoke journey.

**What it looked like.** Cold browser, RTX 4090, 1600x900, `lab.course` (the
same path as Play): on Ultra, PNW eighteen holes, one frame of 165-188 ms at
2.83-2.88 s after the loading screen went, in every run. High on the same
course no longer showed it (it did when B7 was logged on 28 September, at 334
ms; the High case had since gone with other warm-up work). A CPU profile of
that frame is all `getProgramInfoLog` under three's `getUniforms`: a shader
program being built on its first draw.

**What it was.** Wrapping the renderer's per-object draw named it: two
`MeshToonMaterial` programs, about 75 ms each, for meshes under the group
"Living rough" -- the forest floor's ferns and sticks (Ultra only). They live in
the 24 m tiles that follow the camera, and grow only under canopy. The warm-up
behind the loading screen compiles by walking the scene, and at the
establishing pose the tiles round the camera held no floor at all, so there was
nothing to find. When the arrival brought the camera down among trees, the
first fern tile was drawn and its programs were built on the spot.

**Rejected on the way: compiling a stand-in is not enough.** The first fix
added one zero-sized instance of each late material and showed it only for
the compile. The programs were then created behind the loading screen -- and
the frame still froze, for the same 75 ms each. On Windows the browser draws
through Direct3D (ANGLE), which finishes a program only on the first real draw
that uses it; the one frame `ready` draws under the overlay exists to pay for
exactly that, and the stand-ins were hidden again before it. Showing them
through that frame too fixed it. Being zero-sized, they draw nothing visible.
(Also learned: three's `compile` walks every object whether visible or not,
so hiding does not keep a material out of the compile -- it keeps it out of
the draw.)

**A second case, on Island.** Ultra, Island nine, 111 ms at 0.1 s. A grass tile
where nothing grows -- the sea, a fairway -- never had a blade coloured, so its
mesh had no instance colours, which is a different program from every other
tile's, and it was built on that tile's first (empty) draw: 96 ms. Empty tiles
are now hidden (still kept, so the ring's bookkeeping is unchanged), unless the
floor grew something in them.

**Measured after,** one or two cold runs each, 6 s from ready: no frame over
40 ms on PNW, Island, Desert, Links or Mountain at High or Ultra. Redwood
eighteen on Ultra still shows two to four frames of 40-50 ms in its first
0.4 s; a profile of those shows 17-20 ms of our code (the grass ring filling,
one tile a frame) and the rest graphics-card time on the heaviest biome, not a
shader build -- left alone. Loading time on Ultra PNW eighteen, before and
after: build 6.4-6.8 s against 6.2-7.0 s, the first frame under the overlay
2.24-2.26 s against 2.28 s -- unchanged within run-to-run noise.

**What still builds after the course appears, by design or too small to
matter:** the floodlit programs (about 36, warmed in the background so the
lights switch without a stall, and not drawn until they are used); three
shadow-depth programs in the first 50-70 ms (5-20 ms together); and a
mist-tinted basic material and a sprite at the end of the arrival (2-3 ms).
None is a lit program, which is the kind that costs 70 ms or more. (Since 9
October: a cheap program can still freeze the page for seconds if it is the
first one waited for behind a queue -- *The studio froze when the camera turned
to the sun*. The guard now counts every kind.)

**The guard.** The `no-late-shaders` smoke journey switches to Ultra, plays
Surprise me, and fails if any lit program is created after the loading overlay
goes and then drawn. (Since 9 October it also turns the camera a full circle
and fails on a program of any kind.) It failed on the build before this fix (three late
`MeshToonMaterial` programs at 3.0-3.4 s on a random course) and passed four
times after on four different courses. GPU only.

## F4: automatic resolution (30 September)

**18 October 2026: the menus stepped it down before play.** The smoke journey
`text-size` failed now and then with the course drawn at 64% or 54% of the
screen's pixels on Low (75% expected). A startup trace (an Endless run at 150%
text, every frame, long task and canvas width for 7 s from the end of the
loading screen, three runs) found the canvas already one step down (1224 of
1440 px) at the first frame of play in all three, sharpening at 4.3-4.5 s;
in the 1.5 s before play there were 7-10 long tasks of 50-194 ms: the Endless
sheet building its course pictures and tiny models. Frames under 200 ms count
as slow, so the menu's own work stepped the resolution down, and the loading
screen held the step into the round; two steps meant about 8 s blurred.
**Fix:** frames are not judged while a menu or a sheet is up (as the loading
screen already was). After it, three runs out of three started at 1440 px and
stayed; `text-size` passed three times running.

Branch `frame-and-lights`. `src/auto-resolution.js` (the decision, pure and
unit-tested), `autoResolutionFrame` in `src/main.js` (feeding it),
`setResolutionScale` / `pixelCeiling` in `src/renderer.js` (applying it).

**Why the pixel ratio.** It is the only lever that trades picture for frame
time smoothly on any machine: every pixel costs the same fragment work, and a
phone has many pixels behind a small graphics chip. Measured before (TODO F4):
High on the 4090 at 1x pixels 10.7 ms, 1.5x 12.4 ms, 2x 14.4 ms. Bloom's
targets already size themselves from the canvas every frame, and the god-ray
mask sizes from the window rather than the pixel ratio, so nothing else had to
learn about it.

**What it aims for: 60 fps, or the cap when lower.** Not the display's own
rate. Chasing 120 on a 120 Hz display would soften an Ultra picture that is
playing perfectly well at 90 -- the behaviour the owner called annoying in
asking for a switch. So a fast display's extra frames are never bought with
sharpness; the switch is still there for anyone who dislikes any of it.

**How it knows there is room: it cannot, so it tries.** The display paces
frames, so a frame that took 6 ms and one that took 15 ms both arrive 16.7 ms
apart and the interval says nothing about headroom. After 4 s at the target
it steps one sharper; if that step runs slow within its first judged second it
steps back and DOUBLES the wait before the next try, up to 60 s, and a quiet
spell four times the wait halves it again. In the tests a machine that fits at
85% and not at 100% changes step at most 16 times in three minutes, where a
plain up-after-4-s rule would change about 60 times.

**Hitches are not the steady state.** A single frame over 200 ms straight
after a normal one (a water probe, a tile, a shader) is not counted. A long
frame after another long frame is: the first version ignored every frame over
200 ms, which would have left a machine too slow for any frame -- the one that
most needs it -- never stepping down.

**The thresholds are placed, not published**: a second's window, 15% over the
target to step down, 6% to count as steady, 0.6 s ignored after a change while
render targets reallocate, and the 85/72/60/50% steps. They are the usual
shape of such controllers rather than numbers from a source. Nobody has run it
on a real phone yet; that is the first thing to check (TODO, *A real phone,
an iPad and a weak laptop*).

**Checked in the built game** (High, PNW nine, 1600x900, processor slowed
eightfold through the browser's own throttling): pixel ratio 1 -> 0.72 in 2 s,
0.5 by 4 s; throttling lifted, 0.6, 0.72, 0.85, 1.0 at 5 s intervals; with the
switch off it never moved. Throttling the processor is not something fewer
pixels can fix, so the frame rate itself stayed at about 20 there -- it shows
the mechanism, not the benefit, which needs a machine limited by its graphics
chip.

## Floodlight shadows (30 September)

Branch `frame-and-lights`. `HOLE_ATLAS` (ground.js), `makeHazardAtlas`,
`setFloodShadows`, `compilePrograms` / `whenLinked` and `FLOOD_SHADOW_EVERY`
(renderer.js), the tiers' `floodShadows` (graphics.js),
`tests/flood-shadows.test.mjs`, the `floodlit-night` smoke journey.

**The budget, measured.** Each shadow-casting spot light is one texture unit in
every lit fragment shader; WebGL guarantees 16 (MAX_TEXTURE_IMAGE_UNITS on the
RTX 4090 through ANGLE is exactly 16, as on most phones). The ground is the
hungriest program. Counted from the linked program's active uniforms on a
floodlit night, PNW nine (`bench/shots/flood-samplers.mjs`, scratch):

| tier | before: ground uses | casters that link | after packing | casters that link | tier uses |
| --- | --- | --- | --- | --- | --- |
| Low, Medium | 13 | 3 | 10 | 6 (7 fails) | 5 |
| High, Ultra (3 cascades) | 15 | 1 (2 fails) | 12 | 4 (5 fails) | 3 |

The ground's samplers before: water field (mist), owners, cover, route, curves,
outer, hazards, cups, tees, banks, stream segments, the toon ramp, and the sun's
shadow map(s).

**What was packed, and why those.** `route` (3 texels a hole), `tees` (6), `cups`
(2) and `hazards` (24) were four RGBA float textures with one row per hole,
nearest-filtered, read texel by texel -- tables, not images. They are now one
35-texel-wide table (`HOLE_ATLAS`: route 0-2, tees 3-8, cups 9-10, hazards
11-34) read through one function. The renderer writes the cups and hazards
(and the range's moved green, `setRangeGreen`), the ground the route and tees.
Not packed: `curves`, `outer` and `banks` are linearly filtered along their
length, and `owners`, `cover` and the stream segments have their own sizes;
packing those is possible but buys units nothing needs yet. **Rejected:** a
cascade fewer on High at night, which was the other way to free a unit -- it
gives up moonlight shadows for the length of the course, for the sake of a few
lamps.

**Checked identical.** Fifteen views (two of a green, one back at the tee, on
five biomes, High, 15:30, wind off) against the build before: at most 0.012% of
pixels differ, the same as two runs of the same build (animated water).

**One unit kept spare.** At the limit, the next texture anyone adds to the
ground shader would make the ground disappear at night with the lights on --
the failure the first attempt shipped. `tests/flood-shadows.test.mjs` counts the
samplers the ground declares, adds the mist's, the ramp and the sun's maps, and
fails if a tier's casters would use the spare unit.

**Cost.** Frame time with vsync off, PNW nine, 22:00, floodlit: High 4.2 ms
with shadows and 4.2 without; Low 2.9 against 2.6. The maps are redrawn only
when a casting lamp moves to another pole, or the tree cull re-sorts because
the view moved, and at most every 200 ms: nothing at night moves but trees in
the wind. A floodlight's shadow draws the trees the view draws (the cull is
not told about spot lights), which is what a pool of lamplight near the shot
needs.

**What shows.** The lamps stand at the fairway's edges aimed across it, so
their shadows fall back into the trees: in view, trees shade each other and the
tree line takes an edge (0.5% of the frame changed in the test view). The
flagstick casts too.

**The switch, and a bug it found in the warm-up.** Which lamps cast is part of
every lit program's key, so switching rebuilds every lit material. Done the way
the B6 floodlight warm-up did it -- set the state, `compileAsync`, put the state
back -- switching OFF froze for 2.3 s. `compileAsync` waits on each material's
CURRENT program, and once the state is put back the next frame makes the old,
finished programs current again, so it resolved at once and the switch landed on
programs still linking. Now the scene is compiled synchronously while the state
is held, every program each material owns is noted (`compilePrograms`), and
those are waited on (`whenLinked`). After: the worst frame around a switch is
37-58 ms (the new programs' first draws), from 2.3 s. The B6 warm-up had the
same flaw -- a light switch in its first few seconds could stall -- and now uses
the same pair. **The first switch on a course is slow**: about 310 programs, of
which the last ten -- floodlit ones carrying all 57 lamps of a nine -- took about
14 s to link on Windows, measured before the render-target fix in *The
floodlight freeze on Ultra* below (4.4 s after it). The game runs smoothly
through it, so the switch says it is preparing and confirms when it lands;
every later switch on that course takes about a quarter of a second.

**The strength sliders.** Floodlight strength multiplies the lamps' intensity;
glow ball strength the ball's emissive glow, the light it throws and its halo
(the ring and the trail keep following the dark). 0-200% of the tuned values,
100% being exactly what was drawn before. Checked at 30%, 100% and 200% on a
floodlit PNW night.

## The floodlight freeze on Ultra, and the work moved into loading (30 September)

Branch `frame-and-lights`. `asDrawn`, `ready` and `warmUp(grassBudget)` in
`src/renderer.js`; `lightsOffForRound` and `middayForRound` (now `clockForRound`) in `src/main.js`;
the `floodlit-night` smoke journey. Reported by the owner: a massive freeze
when the floodlights came on, and a freeze after loading into a course.

**Measured** (`bench/shots/flood-freeze.mjs`, scratch: the Play path, then the
clock popover's "Floodlight the course" pressed as a player presses it; cold
browser, RTX 4090, 1600x900, PNW):

| | main | branch, before | after |
| --- | --- | --- | --- |
| first switch-on, Ultra nine | 11.3 s frozen | 16.1 s | 33 ms worst frame |
| first switch-on, Ultra eighteen | -- | 26.2 s | 50 ms |
| first switch-on, High nine | -- | none | 33 ms |
| loading floodlit, Ultra nine | -- | 23.9 s | (rounds now start unlit) |
| loading, Ultra nine | 7.1 s | 7.1 s | 6.8 s |
| loading, Ultra eighteen | -- | 10.0 s | 11.9 s |
| opening the game to the menu, Ultra | 4.6-7.7 s | -- | 3.1-5.5 s |
| a hole change, Ultra | 83-100 ms | 83 ms | 17 ms |

**Ultra only, which named it.** High showed no freeze at all. Ultra draws the
scene into bloom's off-screen target (bloom.js), and three picks a program's
version partly from the render target bound when it is built: tone mapping
applies on the screen and not into a target, and the output colour space
differs. Every warm-up compiled with the screen bound -- `ready`'s
`compileAsync`, `warmUp`'s `compile`, the floodlight warm-up -- so on Ultra all
of them built versions no frame ever used. At load that cost was hidden in the
first frame under the overlay (which built the real ones, synchronously), and
loading floodlit took 23.9 s; with the lights off, the floodlit set was
"warmed" in the wrong versions and built for real on the switch. B6 was
measured on High, which is why it was never seen. Fix: compile with the frame's
target bound (`asDrawn`, wrapped into `withStandIns` and `ready`). Loading got
faster with it, because the duplicate builds stopped.

**Rechecked 6 October, after two smoke failures that turned out to be a busy card.** On 5 October the `floodlit-night` journey froze for 7.05 s on `main` and 1.4 s on a branch, with the owner playing a game on the same RTX 4090 at the time. With the card free, every build from this fix onward (b7f9011, 47fc695, 00b4965, 35187fd, 0d7748d, 3e4f667, d58bf9e) measured a worst switch-on frame of 33-50 ms, including switching at once after loading and with automatic resolution on, and the journey passed 6 of 6. A shader build is GPU-driver work, so a card already running a game makes it slow; a smoke failure here means nothing unless the card was otherwise idle.

**Rejected on the way: fewer live lamps.** A throwaway build with 6, 12 and 24
live lamps instead of all 57 froze for 4.3, 5.1 and 7.1 s on the first
switch-on: the lamp count was not most of it -- switching the light count at
all swapped every lit program. (A lamp cap was also declined by the owner in
B6, for the overhead view at night.)

**Then the owner's direction: do the work while loading, start with the lights
off.** `ready` now runs the floodlight warm-up itself and waits for its programs
to link before the overlay goes. Every round starts with the floodlights off
(they used to follow the saved preference) and a round built through Play
starts at midday unless "Start at my local time" is ticked; Endless keeps the
showcase hole's hour (claimed here, but not built until 16 October: the code
put the player's clock back, *The smoke test on GitHub*). Cost: about 3 s more loading on an Ultra nine than with
the fix alone (3.5 -> 6.8 s), still a little under main.

**The hole change.** Not floodlights: `warmUp` spent up to 70 ms building the
near-field grass ring in one go, so the first frame would not be bare -- right
behind the loading screen, and a frozen frame on every hole change, where
there is no overlay (on main too). The hole change now builds none up front;
the ring fills a tile a frame (about 0.4 s), while the arrival camera is
still holding high over the new tee.

**The guard.** `floodlit-night` (GPU only) saves night with the lights on,
starts a Surprise round, checks it starts at midday with the lights off,
switches them on from the clock popover, and fails if the longest frame across
the switch exceeds 500 ms.

## The menu hole: daylight, and no stutter as it appears (1 October)

Branch `frame-and-lights`. `smoothFrames`, the boot sequence, `whileGenerating`
and `growBackdrop` in `src/main.js`; `MENU_HOURS` in `src/daylight.js`.
Reported by the owner: hitching on the main menu hole after the game loads.

**What it was.** Traced from page open (`bench/shots/menu-ratio.mjs`,
`menu-prof.mjs`, scratch; Ultra, cold browser): the stalls before the menu --
the hole's build (1.0-1.5 s), the water probes -- were all under the splash.
The visible one was the first frame of the game's own render loop, 117-217 ms,
which landed while the splash was fading. Not automatic resolution: the pixel
ratio never moved. After that, 20 s of the menu with nothing over 25 ms.

**The fix: let the first frames run under a cover.** The render loop starts and
the menu opens beneath the splash; the splash fades once three frames in a row
come under 40 ms, or after two seconds whatever happens (a slow machine is not
kept on a black screen). Four cold opens after: every long frame fell while
the splash was fully up, none after. `whileGenerating` holds its overlay the
same way (at most a second), and the menu reached from a round now opens inside
that wait instead of after it: from a round back to the menu, at most one 33 ms
frame after the overlay went, against 0.6 s and 3.7 s on main
(`bench/shots/menu-return.mjs`, scratch).

**Daylight only.** `MENU_HOURS` had three night hours and a dusk one at 19.4,
weighted so a floodlit hole came round now and then. Now nine hours from 6.4 to
17.8; the dusk slot went too, being near enough to dark on some biomes to read
as night. The test that required SOME dark visits now requires none.

## The slope grid squared to the camera, and light flowing on it (1 October)

Branch `green-grid-flow`. `readingSurface`, `READING_FRAGMENT` and
`createGreenReading` in `src/green-reading.js`; `updateGreenGrid` in
`src/renderer.js`. Asked for by the owner: in play mode the grid and the rolling
balls did not square themselves with the camera, and a better animation than the
balls, combined with the grid.

**Why it was not square.** The grid was line segments on the hole's own axes,
around the pin. The play camera looks from the ball toward the aim, which is
rarely straight down the hole -- from a putt 54 degrees off the hole's line, the
grid sat diagonally on screen.

**What it is now.** One mesh over the green at half-metre resolution, at the
same 6.5 cm lift the lines had, and a shader that draws the grid in whatever
frame it is given: in play, the direction faced at the start of the shot (it
first followed the camera every frame -- see the correction below), or the
hole's axes for every other camera (the owner: they need not stay square).
Lines through the cup, every 1.5 m, about 1.4 px wide at any distance, coloured
by slopeColor's five bands from the putting surface's own gradient per vertex.

**The flow, chosen by the owner from three:** light running along the grid
lines downhill, over marching chevrons in each square or keeping the balls. On
each line, a dash travels the way the slope falls along that line; brighter the
more of the slope runs along it, one speed per slope band (0, 0.45, 0.7, 1.0,
1.4 m/s), and still only where the ground is dead level (see the correction
below; the first version skipped the whole blue band). **Rejected inside it:** a speed that
varied smoothly point to point -- neighbouring points drift apart in phase as
time runs, and within a minute the dashes are noise. Banded speeds only
disagree at the band edges, where the colour changes anyway.

**A fade with distance.** From the tee a 1.5 m square is a few pixels: the first
build filled whole areas of the green solid with line colour, and the flow
turned to speckle. Lines and flow now fade from full strength at 10 px a square
to nothing at 4.

**Measured.** Switching the grid and flow on: worst frame 50 and 33 ms (first
and second time) against 67 and 83 ms for the old lines and balls on main --
the balls' paths took more work to trace than the surface takes to build.
Pictures: from a putt 54 degrees off the hole's line the cross lines run
horizontally across the screen; the green view keeps the hole's axes.

## Text size for a projector bay (1 October)

Branch `text-size`. `src/ui-scale.js`, the last rule of `src/style.css`, the
container queries throughout it, `resize` / `pixelCeiling` in `src/renderer.js`,
and the screen-pixel conversions in `src/layout.js`, `src/popups.js` and
`hudInsets` in `src/main.js`. Asked by the owner: what does the story look like
for appropriately sized text in projector mode? It was: none. Every size in the
stylesheet is fixed pixels made for a laptop, mostly 8-12 px (headline numbers
17-28 px), and nothing scaled any of it.

**How big text looks in a bay, worked out.** The angle one CSS pixel subtends
is the screen's width over the browser's width in CSS pixels, over the distance
to the screen. A laptop -- 14-inch, 1920 px at 150% scaling, 20 inches away --
gives 1.6 minutes of arc a pixel. The default bay (138" 16:9, 8 ft back) with a
1080p projector gives 2.24, so text there already looks about 1.4 times the
laptop's size; a 4K projector at 100% scaling halves it to 1.12, and standing 12
ft back with 1080p gives 1.5. **The laptop reference is placed, not published**:
one ordinary desk, standing in for "as legible as at a desk". Automatic text
size in a bay is the reference over the bay's angle, never below 100% (a
projected picture is softer and dimmer than a panel).

**How it scales, and the alternatives rejected.** Converting ~330 fixed font
sizes would have left the panels around them unscaled and overflowing. The
browser's own page zoom does the whole thing correctly but no page can set it.
So the app is CSS-zoomed and made that much smaller in CSS pixels, which lays it
out as the browser's zoom would: a 1920x1080 screen at 150% lays out exactly as
a 1280x720 window does (checked: the same controls in the same places, the
same reachability results at the equivalent sizes with no zoom at all). The
first try zoomed the app alone and the play area came out 1.5 screens tall and
scrolled: the stylesheet's screen units and its 28 screen-size media queries
still measured the screen. The units now divide by the zoom and the queries are
container queries on the app.

**The course stays sharp.** The 3D canvas is inside the zoom; sized from its
container's on-screen box it was drawn 1.5 screens tall, and from its CSS size
alone it would be drawn at two thirds of the screen's resolution. It is sized
from the container's CSS size with the zoom carried in the pixel ratio: at 150%
on 1080p, Low draws 1440 of 1920 pixels, its own three-quarters, as at 100%.

**Bugs found on the way, both in code that mixes screen pixels and CSS pixels**
(`getBoundingClientRect` and pointer events are screen pixels under the zoom;
`clientWidth` and inline positions are CSS pixels): panel dragging moved a panel
1.5 times as far as the pointer, and the markers' clear-of-the-panels margins
(`hudInsets`) were 1.5 times too wide. A third was older: a tool window that was
wholly on screen, held only to the drag rule (a grip left showing) when the area
shrank, hung off the right edge with its close button out of reach -- a smaller
browser window did it too. Such a window now stays wholly on screen; one parked
half off the edge keeps the old rule. And two text sizes can leave the play area
the same size in its own pixels (2560 at 200%, 1920 at 150%), so the renderer's
resize watcher missed the change and kept the old pixel ratio; applying a text
size now resizes the view itself.

**The cap.** At 200% a 1080p screen lays out as 960x540, smaller than any desktop
size the layout is checked at, and shot controls fall off the laptop layout
there (the same as an unzoomed 960x540 window). So a size is held to what keeps
the zoomed screen at least 1280x720, the smallest desktop size `hud-reachable`
checks: 150% on 1080p, 200% on 2560x1440 or 4K. **Checked**: the `text-size`
smoke journey at 150% on 1920x1080, 200% on 2560x1440, and 200% held to 150% on
1080p -- every control reachable, nothing scrolling, 61-63% of the course
visible, the course drawn at full resolution. At 100% fifteen screenshots
against main differ only by the animated sea.

**Corrected the same day (branch `green-grid-fixes`, the owner).** Two things.
(1) *The flow covered only the middle of a green.* The first version gave the
blue band (under 1%) no flow at all. On the owner's green most of the surface
tilts about 0.9% -- measured: the slope read from the ground matches the
green's designed contour point for point, so the data was right -- and enough
to break a putt, yet the flow showed only on the 2-3% roll through the middle.
The blue band now flows too, at 0.3 m/s, and only ground under 0.1% (round the
cup) is still. (2) *The grid squared itself to the camera every frame*, so
every nudge of the aim turned the whole grid: hugely disorienting, the owner. It
now takes the shot's starting aim when `setUpTurn` sets the shot up and keeps
it while the player aims. Measured in the built game on a putt 54 degrees off
the hole's line: grid and camera both at -54.3 degrees at set-up; after holding
the aim key, camera -70.8, grid still -54.3; the next shot from elsewhere on the
green, both 135.1.

## run_fairway_server: the bridge with nothing to install (1 October)

Branch `productization`. `tools/build-server.mjs`, `COMPILED` and `readManifest`
in `bridge/server.mjs`, `tools/package_release.py`, `docs/PORTABLE_README.md`,
the `server-program` smoke journey. Asked for by the owner: everybody who
downloads Fairway is setting up a launch monitor, and the download should need
no npm install -- one program, `run_fairway_server`.

**Bun, not Node's single-executable feature** (the owner chose, from the two).
Bun cross-compiles every platform from one machine; Node's macOS builds must be
signed on a Mac. Measured from this Windows machine with Bun 1.4.2: Windows x64
82.2 MB, macOS arm64 59.5 MB, macOS x64 66.3 MB, Linux x64 77.7 MB; both macOS
binaries carry an LC_CODE_SIGNATURE load command (read from their Mach-O
headers), i.e. ad-hoc signed, which Apple Silicon requires. Zipped with the game
and documents: 45 / 32 / 34 / 42 MB.

**Licences.** Bun is MIT and statically links JavaScriptCore and WebKit under the
LGPL-2, whose term is that an application statically linking it be provided
"in an object (not necessarily source) format" so a user can relink with a
modified library ([Bun's licensing page](https://bun.com/docs/project/licensing),
[LICENSE.md at bun-v1.4.2](https://github.com/oven-sh/bun/blob/bun-v1.4.2/LICENSE.md)).
Neither page says what that means for a `bun build --compile` program. What this
project does, as a reading rather than legal advice: the application part ships
beside the program as the plain bundle (`server-source/fairway-bridge.mjs`), so
anybody can build Bun with a modified JavaScriptCore (patched source at
github.com/oven-sh/webkit) and recompile; Bun's notice, its table of linked
libraries and the full LGPL 2.1 text
([gnu.org](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt)) are in
THIRD_PARTY_NOTICES.txt. Flagged for the owner in DISTRIBUTION_REVIEW.

**What compiling changed, found by testing the program rather than the bundle.**
Inside the program, `import.meta.url` is `file:///B:/%7EBUN/root/...` on Windows
(probed: `process.argv` is `['bun', 'B:/~BUN/root/...']`, `import.meta.main` true,
`process.execPath` the real .exe) -- the first detection matched `~BUN` against
the encoded URL, missed, and the program printed nothing and served nothing. It
decodes first now. The game is read from beside the executable.

**Checked.** The Windows program, unzipped from its download into an empty
folder and started on loopback: serves the game (16 MB), the manifest (43 KB)
and `/health`, accepts a launch-monitor TCP connection. The `server-program`
smoke journey: the game loads from it, the browser connects, a pretend connector
sends an Open Connect shot that flies and is acknowledged with code 200. Binding
every address (its default) was not run here: it raises the firewall prompt on
the owner's machine; the lines it prints for that case are unit-tested. The
macOS and Linux programs have not been run on those systems.

**rēlā, as the documented connector path.** From its documentation
([docs.rela.golf](https://docs.rela.golf/), the
[user guide](https://docs.rela.golf/rela/user-guide/) and the
[installation guide](https://docs.rela.golf/rela/installation/)): it runs on a
Windows PC, the launch monitor is chosen under **Device** and found with
**Search**, the output under **Simulator** (GSPro among the options), and the
simulator's address and port under **Settings**; vendor software is installed
before rēlā. The guides do not state rēlā's default GSPro port; GSPro's own Open
Connect port is 921 and Fairway's 1921, so the instructions say to set 1921.
rēlā's supported device list is not on those pages; nothing here claims one.

## Pictures and clips of the game: how they are made (1 October)

The website's gallery, feature pictures and background clips are taken with `tools/capture/`. What the website claims, and the decisions about its own build, media storage and background reel, moved with it to its own repository on 7 October 2026; what is here is how the pictures are made, because the tools that make them are here.

**How the media is made since the 1.0 retake (18 October 2026)**: docs/CAPTURE.md has the whole of it. In numbers: stills are drawn at 7680x4320 (a 3840x2160 page at density 2 on Ultra) and halved to a 3840x2160 PNG master, four samples a pixel, with 2560 and 960 wide JPEGs (quality 0.90 and 0.84); interface screenshots are a 1920x1080 page at density 2, so exactly 3840x2160. Clips are recorded frame by frame -- the page's clock stepped 1/60 s at a time, so every frame is drawn in full however long it takes -- and encoded in the page with WebCodecs (no ffmpeg here; the capture browser offers H.264, VP9 and AV1 at 3840x2160, 60 fps, in software, no HEVC) into a 3840x2160 H.264 MP4 at 80 Mbit/s and a 1920x1080 VP9 WebM at 8 Mbit/s, wrapped by the project's own MP4 and WebM writers. Measured on the RTX 4090: a 9 s clip about 35 s, the 15 s interface clip about 4 minutes, a landscape at four times about 70 s. Times of day: morning is the sun 18 degrees up, golden 5, noon the middle of the day, night 10 PM with the floodlights (`hourFor`).

**Every flyover shook until 19 October 2026, and why.** The path was built from what `lab.camera` returns, which is rounded to 0.1 m and 0.1 degree for reading; interpolating rounded poses made the camera turn in a stop-start rhythm -- on links-golden, four frames still then three at about triple speed, repeating every seven frames (eight times a second), where the exact path turns a steady 0.31 to 0.33 px a frame at 1920 wide. It was in every clip since the first set, the 0.x live recordings included. Measured on the frames (`tools/capture/motion.mjs`: each frame's shift against the average of the nine around it, px at 480 wide), all ten flyovers before and after the fix (exact poses read back from the camera, smoothed, Catmull-Rom between samples): before 0.03-0.24, after 0.005-0.011 (Midwest 0.018, where a tree passes close to the lens). Giant Redwood (0.238 before) was also re-routed: `--worst` put nearly all of it in one moment half a second in, the camera flying through a fir's crown -- on the old route as well; the new one circles the clean view chosen for its stills and measures 0.007. The distant horizon alone showed the same twitch at the same frames, so it was the camera turning, not the wind in the grass.

**How the 0.x media was made (1 October)**, superseded above and kept for the reasoning. No video encoder exists in this toolchain (no ffmpeg), so the clips were recorded live inside the browser: the game's own canvas into `captureStream(30)` and `MediaRecorder` as WebM VP9 at 6 Mbit/s, 1920x1080, 7 to 12 seconds -- and a slow frame was a stutter, which is what the frame-by-frame recorder fixed. Camera flights are keyed poses through `lab.camera`, sampled 240 times, with the height smoothed over a 40-sample window (never more than 3 m below the ground-following height) so the camera does not bob over every dune, and eased in and out. The tee shot is a launch-monitor shot through the real shot path (67 m/s, 11.5 deg, 2,700 rpm). Stills are rendered at 3840x2160 and saved at 2560x1440 (JPEG quality 88-90), with 960x540 thumbnails, scaled in the browser by repeated halving (there is no image library here either; one big reduction samples too few pixels and brings the jagged edges back). Everything is captured on Ultra with automatic resolution off, and `tools/capture/capture.mjs` refuses to save a picture that is not.

**The first set was drawn at 1x, and looked it** (retaken 2 October, after the owner said the pictures looked low resolution and maybe not Ultra). Ultra WAS on -- 6144 shadow maps, confirmed in the page -- but the game never draws more pixels than the screen's pixel density allows (`pixelCeiling`: the lesser of `devicePixelRatio` and the tier's ratio, 2 on Ultra), and the capture page had density 1. So a 1600x900 capture was a 1600x900 render with no smoothing beyond the antialiasing, saved at JPEG quality 80, and its thumbnails were then shown at twice their size on a high-density screen. The fix is a density-2 capture page: a 1920x1080 page renders 3840x2160 on the real GPU (an RTX 4090, still 60 frames a second) and is scaled down. The clips are recorded at density 1 on purpose, because they are recorded from the canvas itself and the canvas has to be the video's size. File names changed with the retake, to the landscape's name (`links-golden.jpg`) rather than the course name its seed grows (`north-sea-links-golden.jpg`); the site shows only landscape names, at the owner's request.

**What went wrong the first time, worth knowing before a retake**: a flight keyed in the hole's own frame ran past the pin on a short hole and spun round to look back at it (key flights by distance from the pin, `fromPin`, instead); the player camera behind a tee can sit behind a tree; a capture that does not wait for the shot to finish photographs a shot card that is still empty (wait for `lab.state().inFlight` to clear); and the course studio was captured at midnight, which turned out to be a real bug for new players, fixed on the same branch.

**Times of day are sun heights** (2 October, after the owner noticed the links "golden hour" picture was not). The first two sets named their light by clock: golden at 17.8, morning at 7.3 to 10.5, afternoon at 15.1 to 16.5. But `solarState` derives the warm light from the sun's ELEVATION -- `warmth` is one minus a smoothstep from 1 to 26 degrees -- and each biome's sun peaks at its own height (`peakElevation`, 35 + 0.6 x the biome's sun figure: 46 to 63 degrees). At 17.8 on the links the sun stood at 18.8 degrees, warmth about 0.3: afternoon. `hourFor` in `tools/capture/capture.mjs` now picks the hour from a target height on the right side of noon: golden 5 degrees (about 7:05 PM, warmth about 0.85), morning 18, afternoon 32, noon the middle of the day. Dawn is the one keyed by clock, 0.7 h after sunrise, because the morning mist is (`mistAmount`: thickest at first light, burnt off over about three hours) -- that is the Pacific Northwest clip's fog.

## Bunkers on another hole's ground (generator 34, 2 October)

**What it looked like**: behind a green on the website's desert clip, a white crescent of sand with a staircase edge, the rest of the bunker's bowl grassed over -- and from behind the green, no bunker at all. **Why**: the ground shader paints only the hazards of the hole that owns a fragment's ground (the owner atlas, `nearest` or a large lake's hole), while every hole's bunker excavation is applied to the height field everywhere. A bunker placed where a neighbouring hole is nearer was dug out but painted -- and played, since `surface` follows the same owner -- as the neighbour's rough. The staircase is the owner atlas's 1.75 m texels: the shader resolves the true owner only where the texel's hole changes. Ponds have been filtered by ownership since they were introduced; bunkers never were.

**Measured** with a new bench metric, `bunkers` (invariant `bunkerOnAnotherHolesGround`, the outline at 1.15 -- the excavation's reach -- sampled 48 times against the atlas's own rule): **35 of 682 bunkers on the 35 full-tier courses, on 27 of them; 0 after**, with 647 bunkers left. Every other bench figure is identical with and without the change (checked by running `--since` both ways: the baseline had drifted with earlier generator work, and drifted identically), and the baseline was re-saved at generator 34.

**Dropped, not moved.** Nudging a bunker inward would re-fit green-side pockets the placement's binary search had already put a set distance off the fringe; handing the ground to the bunker's own hole instead would cut into the neighbour's corridor and change which hole's rough the ball lies in. No random draw is taken, so nothing generated after it shifts. Including large-lake ownership in the rule changed nothing (zero either way), but the metric and the test use the atlas's full rule so they cannot disagree with what is drawn.

## After the ball lands (2 October)

Five things the owner noticed in play, each measured before anything changed. The owner's report is docs/reports/BALL_LANDING_REPORT.md, with clips and charts in docs/reports/ball-landing/; the scratch searches behind the numbers below are summarised there.

### Keyboard spin fell with the square root of power, and chips paid for it

`manualLaunch` scaled spin by `sqrt(power)` while speed scaled by power, so spin per mph of ball speed ROSE as power fell: a full keyboard wedge leaves at 107 rpm per mph, a 30% one at 195, a 10% one at 337. The 10% chip carried 1.4 yd and finished 1.1 yd behind its mark; sand-wedge chips at 10-20% did the same. **Trackman's "The Chip Shot Code"** puts chips carrying 1.25-24 yd at an average 1,500-3,000 rpm and never above 3,750; the square root gave 2,800-5,700 over that range. At the other end, **a 54 deg wedge hit 50 yards spins 6,501 rpm** (clean face, lie board; 7,178 off turf -- Andrew Rice's Trackman study), and the square root gave 6,970 for a 44 yard pitch, so it was right there. Spin in proportion to power keeps the full shot's spin per mph and lands chips in Trackman's band; the rule is proportional below 30% power, the square root above 70%, and a smoothstep blend between. After: chips 900-3,900 rpm (the 21 yd end is 4% over the 3,750 ceiling), a 44 yard pitch 6,730, full shots unchanged, and no keyboard chip finishes behind its mark. **Rejected**: a single power law (`p^1.3`) and a fixed blend `p(0.45 + 0.55p)` -- both fixed the chips and cut a 50 yard pitch to about 4,200 rpm, a third under the measured 6,500.

### The sideways hop off a green is slope, not noise

An iron landing on a green turns on its first hop by **about 3.3 degrees per 1% of cross-slope** (45 deg arrival, 25 m/s, 6,000 rpm, an even plane): 0 on the flat, 6.6 at 2%, 15.7 at 5%. Sidespin (6 deg axis) adds about 2 degrees, most of it curve already in the flight. Across 746 approach landings on 27 generated greens at green difficulty 70 (three courses), and 227 on nine at the default 35, the slope under the landing explains nearly all of the turn: unexplained residual 0.9 deg mean at difficulty 35, 3.4-4.3 at 70. Mean turn 2.5 deg at difficulty 35 (max 12.5), 7.7-9.1 at 70.

**The triangle mesh was the suspect and is not the cause.** The physics reads height from the drawn mesh (`groundHeight`, piecewise planar, about 0.5 m cells on greens), so a bounce takes one facet's normal. Re-running every landing on the same ground smoothed over the ball's footprint (radius 0.35 m) moved the turn by less than 2 deg in every case at difficulty 35. The single 157 deg "turn" at difficulty 70 was a ball landing on an 11% face, popping nearly straight up and rolling back down -- real, and the same on the smoothed surface within the angle a near-vertical hop can define.

**Is 3.3 deg/% right?** The compliant bounce works in the plane of travel and the surface normal and keeps the outgoing tangential velocity along the incoming tangential direction. Full Coulomb friction acts along the SLIP, which backspin makes far more forward than the tangential velocity; it would strip forward speed while barely touching the downhill component, so a real ball should kick somewhat MORE -- an estimate of about 4.5 deg/% for the same landing. Not changed: the direction is honest and the size, if anything, conservative. The owner's "no reason" is the green reading flatter on screen than it is (TODO, *Reading a green without the overlays*).

### Sand kept its spin, and real bunkers showed it

On flat sand nothing came back: a full wedge's first contact strips its forward speed and it hops nearly straight up and stops. On the game's real bunkers -- excavated bowls -- it did: **28 of 264 approach landings in 22 bunkers came back more than 0.3 m, up to 2.17 m**, and without spin the same landings came back far less. A wedge left its first sand contact with about a third of its backspin, which the next touchdown spent dragging it back. Sand's contact row cannot fix that: its spin column (2.5) is already the rigid ceiling. **Sand now takes the spin**: after a sand contact the ball keeps none. After: 4 of 264 over 0.3 m, max 0.54 m, and those come back as far with no spin at all -- gravity on a steep part of the bowl.

The first flat-sand table recorded here was wrong by the ORIGIN of a drop shot: "finish minus carry" subtracted a carry measured from a start 0.23 m behind the landing point and reported every ball 0.25 yd behind its mark. Measure from the pitch mark itself.

### The cup wall gripped as hard as it needed to

Inside the cup a ball rolls round the wall, and the rolling equations (u' = -5g/7r - (2/7) theta' w; w' = theta' u) hold it up by friction: the vertical grip needed is (2/7)(g - r theta' w) per unit mass. Nothing checked the wall could supply it. At the bottom of a dive a ball entering at walking pace needs more than its own weight in grip while the wall presses on it with about 1.1 g (rho theta'^2 at 18 rad/s): a friction coefficient of 1.3, where cut turf and a plastic liner give a third of that. So a putt at 1.2 m/s, 45 mm off centre, dived to 10 mm off the floor, climbed back to 30 mm below the lip, and went round 2.4 times in 0.9 s; on hole 7 of the test course a 1.2 m putt went round 1,252 degrees. The wall now grips at most `WALL_FRICTION` (the green's sliding friction, 0.305) times the press, and slides when the rolling solution wants more, tracking the spin about the direction of travel separately. After: 0.75 laps in 0.21 s and 352 degrees respectively. **Which putts drop and which lip out is unchanged** in every case tested, because a fast ball presses at many g and keeps the grip to climb.

The rim test asserting that a Stimp 13 green holds a lip-out ride 20% longer than Stimp 8 had passed on one ride: 666 degrees, of which 362 were down inside the cup on the wall and back out -- on exactly this grip. The longest rides are now edge-only, 325 against 359 degrees, and the test asks for 5%. **The edge regime (the lip above the wall) had the same unchecked assumption** and allowed rides of about a full lap; it got the same cap the next day -- *The lip grips only as hard as it is pressed*, below.

### Rollout against every anchor, and the chip defect that was the anchor

`node tools/landing-scorecard.mjs` after this pass: driver 20.8 yd run on a fairway (wanted 21), 3 wood 18.1 (19), 5 iron 13.0 (15); a full keyboard wedge checks on a green and comes back 1.1 yd; a 7 iron releases 6.2; firmness runs the right way (a wedge comes back 2.8 yd on Soft, runs 1.7 on Burnt). Chips, on RESEARCH's own launch-monitor inputs: pitching wedge 1:1.9, 52 deg 1:1.4, 56 deg 1:0.9, 60 deg 1:0.5.

**The chip ratios this project carried as a defect come from one chart.** GolfWRX and Golf Sidekick give pitching wedge 1:3, 52 deg 1:2, 56 and 60 deg 1:1. **Personal Golf Instruction** gives 8 iron 1:4, 9 iron 1:3, pitching wedge 1:2, sand wedge 1:1, lob wedge 1:0.5. **Golf Distillery** gives a 60 deg flying 70-80% of the distance (about 1:0.3), a pitching wedge 50% (1:1), a 7 iron 20% (1:4). None states a green speed. The model sits inside the published spread for every club, so "chips roll too short" is withdrawn as a defect: it was measured against the most roll-heavy chart.

**Every lever was tried against chips anyway**, on the green contact only so the fairway rows stayed honest. More spin scrubbed (spin gain x1.5): chips +0.2 to +0.4 of roll, a 7 iron's release 6.2 to 15.4 yd. Friction x0.8, ploughing x0.6, restitution x0.8: chips barely move. Rolling resistance that does not rise with speed (`ROLL_SPEED_GAIN` 0): chips +0.1 to +0.5, the driver's fairway run 20.8 to 38.5. **The bounce paper's fixed crater tilt** (TODO, it beat the speed-dependent one 19.2% to 21.3%): partial shots change by yards -- a half driver's run 26.9 to 53.3, a full one 20.8 to 31.2 -- so it is not a drop-in; it needs a refit against every anchor. No lever moves chips without breaking a full-shot anchor, which is what fitting to a doubtful chart would have bought.

### The lip grips only as hard as it is pressed (3 October)

Rolling round the lip's edge -- the torus of radius R about the rim circle -- the ball centre accelerates along the tube at 5/7 of what gravity and going round push it with, (rho theta'^2 sin a + g cos a), and the edge must supply the other 2/7 as friction. The load it can grip with is g sin a + rho theta'^2 cos a - R a'^2 per unit mass, and as the ball climbs over the lip that goes to nothing. The old edge model rolled regardless. Now the needed friction is checked against `WALL_FRICTION` times the load, and when it is short the ball slides over the edge, its contact surface speed round the tube (`edge.slip`) running free of the centre's.

**Measured** with `tools/landing-report/rim-study.mjs` over 1,518 putts (Stimp 8, 10, 13; offsets 0 to 53.5 mm in 2.5 mm; arrival 0.2 to 2.4 m/s): longest lip-out ride 230 to 255 degrees at Stimp 8, 296 to 212 at Stimp 10, 382 to 231 at Stimp 13; median 49 to 46 at Stimp 10; rides over 270 degrees 2 to 0. Five outcomes changed: three slow putts on the edge (42.5-45 mm, 0.6-0.7 m/s) now lip out, two fast putts near the middle (7.5 and 12.5 mm, 1.6-1.7 m/s) now drop, so the fastest drop on those two lines rose by 0.1 m/s and every other line is unchanged.

**The friction is not what decides it.** Giving the lip 0.45, 0.6 and 0.7 instead of 0.305 leaves the longest Stimp 10 ride at 212 degrees each time, and moves Stimp 13's from 231 only to 255. The limit is the instants the load is near zero, when no coefficient grips. The 360-degree lip-out is therefore gone at any plausible friction; the rim test that required one (330-480 degrees) asks now for over 180, and says why. Bringing the full lap back would need physics the model lacks -- the turf edge deforming under the ball -- not a different number.


## Shot-making clips (3 October)

Six showcase shots for the website -- stinger, high draw, power fade, knockdown, flop, zip-back -- filmed on the test course (pnw REPORT1, no wind) from `tools/landing-report/shotmaking-plan.mjs` and `shotmaking-clips.mjs`, in `docs/reports/shotmaking/`. The brief was that none of them look outlandish, so each is played with numbers a strong real player produces and the plan prints what the physics then did. Nothing in the physics was changed for them.

| Shot | Club | Ball speed | Launch | Spin | Axis | Carry | Peak | Landing | Then |
|---|---|---|---|---|---|---|---|---|---|
| Stinger | 2 iron | 152 mph | 7.5 | 2,800 | 0 | 238 yd | 54 ft | 36 | runs 24 yd |
| High draw | driver | 167 mph | 13 | 2,400 | -6 | 262 yd | 111 ft | 42 | 12 yd of draw |
| Power fade | driver | 167 mph | 10.5 | 3,000 | +5 | 263 yd | 100 ft | 42 | 14 yd of fade |
| Knockdown | 7 iron | 100 mph (solved) | 12 | 5,500 | 0 | 139 yd | 36 ft | 35 | runs 26 yd to the flag |
| Flop | 60 deg | 31 mph (solved) | 45 | 2,800 | 0 | 19 yd | 16 ft | 49 | stops by the flag |
| Zip-back | 56 deg, Soft green | 83 mph (solved) | 30 | 9,600 | 0 | 95 yd | 77 ft | 51 | spins back 5.5 yd |

Carries on the three tee shots are off raised tees, so they read longer than the flat-ground figures the flight was fitted to.

**Where the numbers come from, and which are placed.**

- **Driver**: 167 mph is the Trackman tour average already used for the flight fit (*Sourcing*, above), as is its roughly 11 degrees and 2,700 rpm. The draw and fade sit either side of it -- higher and less spin for the draw, lower and more spin for the fade -- and the spin axis was **chosen** for 10-15 yards of curve. Placed, not published.
- **Knockdown**: taken off a full tour 7 iron (about 120 mph, 16 degrees, 7,000 rpm, same tour averages). How much comes off each is **judgement**; the ball speed is then solved so it finishes at the flag, which it does by landing short and running 26 yards. That run is the most "shown" number in the set and the first to check if a measured knockdown ever turns up.
- **Flop**: GolfWRX, "The difference between a pitch shot and a flop shot on Trackman" -- flops launching 40-45 degrees averaged about 2,165 rpm, one example 3,702, club speed about 51 mph, landing angle about 51 degrees. **Read only through a search summary**: the page returns 403 to any automated fetch, so these figures are second-hand until someone saves it into `docs/sources/`. The first draft launched at 48 degrees on 3,300 rpm; it was brought down to 45 and 2,800 to sit inside the quoted band, and the model then landed it at 49 against the quoted 51.
- **Zip-back**: the tour average for a full pitching wedge is about 9,300 rpm; 9,600 for a 56 degree at 83 mph is that plus a little for loft, **placed**. A first draft at 10,200 rpm came back 8.4 yards, which reads as theatrical; at 9,600 it comes back 5.5. Soft greens are where this shot happens, and the model's Soft is already anchored (*Firmness*).
- **Stinger**: **no published launch-monitor figures for a stinger were found**, again. A search on 3 October for Trackman stinger launch, apex and spin returned only general launch-monitor explainers ([Trackman's guide](https://www.trackman.com/blog/the-ultimate-guide-to-understanding-trackman), [golf.com's driver numbers by swing speed](https://golf.com/gear/swing-speed-optimal-trackman-numbers-to-hit-your-drives-farther/)), as the earlier search did. Launch is set a few degrees under a normal long iron. The clip peaks at **54 ft**, which is the known gap in TODO, *A stinger needs a 2-5 degree launch in this model*: the usual description is 30-45 ft and this model cannot get there at a launch a golfer produces. It still reads as low beside the drivers (100-111 ft) because the tracer stays under the tree line. Say so before using it to claim anything specific about stingers.

**Filming, and two things that went wrong first.** Each clip is a fixed camera 10 m behind and 4.5 m above the ball for the tee shots (7 m and 3 m for approaches), looking at where the ball will land, then a cut 0.8 s before it lands to a camera beside the landing that turns with the ball. The game's own chase camera was tried first and lost the ball. A camera 25 m from the landing on the game's normal lens showed nothing: a ball is two pixels wide from there, so the landing camera sits 9-13 m off with a 24-26 degree lens, which is how television does it. And hole 1's back tee looks over a ridge at its own landing area -- the drives vanished -- so the tee shots moved to the doglegs (holes 3, 5 and 9), which a line-of-sight check from each tee showed were open. The draw is on a dogleg left and the fade on a dogleg right, which is also how they would be played.

The game's white ball-marker ring is put back every time it moves the ball, after anything a page callback can do, so it is hidden through its material instead.

## Left and right were mirrored (5 October)

**The symptom**, on the owner's first session with a Garmin R50 through rēlā: carry, height and spin all looked right, but a shot the monitor said started or curved left went right on screen, and the other way round. The shot readout agreed with the monitor, which is why nothing at a desk had shown it.

**The cause.** A hole plays along its local +z, and three.js puts a camera's screen-right at -x when it looks that way, so local +x is the golfer's LEFT -- written down in renderer.js (*Which side is right*) and course-map.js long before this. The flight took `hla` and `spinAxis` as they came and turned positive values toward +x: a monitor's "5 degrees right" started the ball 5 degrees left. The keyboard's Shot shape slider, labelled "positive fades right", did the same. And `offlineOf`, the shot card's `offline` and the plot's `shotProfile` all called +x "right", so they reported the monitor's own direction back while the picture showed the opposite. Three tests pinned that mirror image as correct (`core`, `firmness`, `range`), one of them under a comment noting that a direction sign error had already shipped four times.

**The fix**, in `simulateShot`: `yaw = aim - hla` and the spin axis negated, so positive means the golfer's right for both, as Open Connect defines them. The three readouts now call local -x right. Checked end to end through `parseLaunchMessage`: a message with HLA +5 and spin axis +10 finishes 36.5 yd right of the aim line, on the right of the screen, and the readout says R; the mirror message finishes 36.5 yd left, says L.

**Rejected: negating in `parseLaunchMessage`.** It would have fixed monitor shots and left the Shot shape slider, the five-number box and the flight profile's axis all still mirrored, and the stored shot would then disagree with what the monitor displayed. The convention belongs where direction becomes motion, once.

**Not affected:** `aim`. It is a bearing in the hole's frame, set by the aim line the player sees, so the picture is its definition.

**What remains wrong until a new release:** the v0.1 downloads (3 October) carry the mirrored flight. The website's Download buttons serve v0.1 until the owner publishes a newer one.

## The R50 session against the model (6 October)

The owner's Garmin R50 session of 3 October, 133 shots across twelve clubs, replayed through `simulateShot` with the R50's own ball speed, launch angle, launch direction, spin rate and spin axis, in the air the R50 states (1.172 g/L at 72.5 °F: the model's altitude was solved to match that density). The shot data and the full local report stay on the owner's machine (`docs/reports/r50-check/`, not committed); what follows is what was found. The R50 measures launch and then **calculates** carry, apex and roll with its own model, so this is model against model on shared measured inputs, as the SkyTrak check was.

| clubs | shots | carry, model minus R50 | apex, model minus R50 |
|---|---|---|---|
| 60°, 56°, 52°, gap, pitching wedge | 50 | +0.0 to +1.8% | −1.3 to 0% |
| 9 iron, 8 iron | 20 | +2.8%, +2.2% | −2.5%, −5.0% |
| 7, 6, 5 iron | 35 | +1.5%, +0.1%, −0.8% | −7.7%, −10.7%, −11.6% |
| 5 wood | 10 | −2.7% | −11.1% |

Wedges to 5 iron together: carry +1.6 yd (+1.1%), typical miss 3.1 yd (2.5%). **Every shot more than 2 yd offline finished on the same side in both (98 of 98)**, typical sideways gap 0.6 yd -- a clean check of the left/right fix of 5 October.

**Apex falls away with spin.** Wedges agree; from the 8 iron down the model peaks progressively lower while carry stays close, so the long-iron flight is flatter rather than shorter. It is the same direction and size as the open driver gap against Trackman's 35 yd apex, and the opposite of the SkyTrak check (+0.9 yd). Acted on the same night: lift and drag were refitted together against this session, the GC3 and Trackman's tour averages, and the R50's long-iron gap closed from 11-12% to about 4% (*The flight refitted against three launch monitors*, below).

**The owner flagged the 5 wood and the driver as unusual swings.** The 5 wood's shortfall follows the long-iron pattern exactly. The driver session was not representative: four swings of 33-42 mph, and the rest low hard hooks (2-11° launch, spin axes −50 to −80°). Two findings came out of it anyway. Past a 40° spin axis the model curves the ball 1.6 times as far as the R50 (within 3-9% below 40°); nothing published covers axes that extreme, so it is left open. And the knuckleball below.

**Fixed: a ball with no spin got lift.** Shot 130, 143.7 mph, 4.7°, 346 rpm (S = 0.012): the R50 said 49 yd, the model 111. A ball with no lift at all carries 61-64 yd at that launch for any drag coefficient from 0.22 to 0.30, and the model still carried it 99 yd with the spin set to zero -- `liftOffset + sqrt(liftFloor + liftGain*S)` is 0.07 at S = 0, a floor the square root never leaves. A ball that is not spinning has nothing to make it lift one way rather than another, so lift must reach zero with S; Bearman and Harvey's and Smits and Smith's curves both rise from it. `AERO.liftTaper` = 0.04 fades lift to zero below that S with a smoothstep. **The 0.04 is placed, not published**: their measurements start above it, and it sits just below the lowest-spin real shots in any session fitted or checked here (S 0.044-0.045: a 1,500 rpm drive, the R50's lowest hooks; a tour drive is 0.08). After: zero spin carries 64 yd, the knuckleball 72 (the R50's 49 is shorter than even no lift, so the R50 is doing something of its own there); 131 of the 133 shots are unchanged to the decimal, the landing scorecard is unchanged, and `tests/low-spin.test.mjs` pins all three.

**Still to check:** the R50's export signs sidespin opposite to its own spin axis on all 111 curving shots. Fairway uses the spin axis when a connector sends one; if rēlā sends backspin and sidespin instead, a fade would arrive as a draw. rēlā's documentation does not say which it sends (https://docs.rela.golf/rela/user-guide/, checked 6 October). Confirm with one deliberate fade, or the bridge run with `FAIRWAY_LOG=debug`.

## The flight refitted against three launch monitors (6 October)

At the owner's request, the aerodynamic curve (`AERO`, physics.js) was refitted to "the GC3, Trackman data and the R50 -- all much more trusted models", with the instruction that rollout and backspin across the surfaces must not change drastically, and that zip-back should stay possible "when the conditions are right" rather than routine. `node tools/flight-fit.mjs` is the whole method and reruns it.

**The data**, all private and not committed (docs/sources/private/):

- **Trackman's PGA and LPGA tour averages** -- 23 rows, driver to pitching wedge: ball speed, launch, spin, max height, land angle, carry. Trackman's own blog post shows the tables only as images (https://www.trackman.com/blog/introducing-updated-tour-averages); the numbers were read from the text layer of the same sheets re-hosted at https://teeituprva.com/wp-content/uploads/2019/03/PGA-AVERAGES-INTERACTIVE.pdf and .../LPGA-AVERAGES-INTERACTIVE.pdf, and checked against the images. The neogolfclub mirror cited earlier carries speeds and distances only. Driver row, PGA: 113 mph club, 167 ball, 10.9°, 2,686 rpm, 32 yd max height, 38° land, 275 yd carry; LPGA: 140 ball, 13.2°, 2,611 rpm, 25 yd, 37°, 218 yd.
- **A GC3 session**, 111 shots, 58° wedge to 4 iron, each with carry, peak height, descent and hang time.
- **The owner's R50 session** of 3 October, 115 shots, wedges to 5 wood. Its 18 driver swings were set aside (the owner judged them unrepresentative: four 33-42 mph swings and low hard hooks), so Trackman's two driver rows stand for the driver.

Air: the R50 states its density and is flown in it; Trackman and the GC3 state none and fly in the model's default (sea level, 18 °C), as earlier fits did.

**The cost.** Every source counts equally however many shots it brought, so the GC3's 111 cannot outvote Trackman's 23 averages. Within a source: peak height and carry in percent, squared, carry at double weight; landing angle in degrees at a quarter weight. Trackman's two driver rows count four times each, because nothing else covers the club a player hits on every hole. Nelder-Mead over the constants, scaled so each moves as a fraction of itself.

**What was wrong: a tilt.** All three agreed the old curve flew wedges slightly high and long irons and woods low -- the GC3's 4 iron 10% low, the R50's long irons 11-12%, Trackman's woods and long irons 5-21% -- while every average looked fine, because the September fit had centred the average of a curve the wrong shape.

| peak height, model minus source (typical miss) | before | after |
|---|---|---|
| Trackman (23 rows) | -4.3% (8.3%) | +0.2% (5.5%) |
| GC3 (111 shots) | -0.7% (4.7%) | +0.5% (1.7%) |
| R50 (115 shots) | -5.0% (7.0%) | -2.0% (2.8%) |

| carry, model minus source (typical miss) | before | after |
|---|---|---|
| Trackman | -0.3% (2.1%) | -0.8% (2.5%) |
| GC3 | +1.1% (1.6%) | -0.6% (1.5%) |
| R50 | +0.8% (2.7%) | +1.1% (1.9%) |

Landing angle: GC3 +1.0° → -0.2° (typical miss 1.1°); Trackman -3.3° → -3.4°.

**The form, and what was rejected on the way:**

- **The square root could not bend far enough.** Fitted freely, `liftOffset + sqrt(liftFloor + liftGain*S)` drove its floor negative and stopped returning a number for some shots. Replaced with the power law Smits and Smith fitted to their wind-tunnel data, CL = 0.54 S^0.4 -- which, taken as published with our drag, flew everything 11-20% high, but fitted with the drag landed at 0.49 S^0.41, almost their curve. A small offset (CL = 0.678 S^0.271 - 0.186) then let the driver's low-spin end lift less without dropping the long irons: the shipped curve.
- **Lift and drag depending on airspeed: rejected.** Letting both change above 150,000 Reynolds number fitted Trackman's PGA driver exactly (cost 18.3 against 23.8), by making drag FALL with speed and cutting the driver's lift by half. Kensrud and Smith measured golf-ball drag RISING with speed past the drag crisis (Proc. IMechE Part P, 2018, https://doi.org/10.1177/1754337117740749), and Smits and Smith found lift, drag and spin-down independent of Reynolds number at fixed S across 100,000-250,000. Two rows of one source were bending the physics.
- **Spin decay now scales with airspeed** -- the torque that slows the spin grows with speed. Alan Nathan's note "The Effect of Spin-Down on the Flight of a Baseball" (2008, https://baseball.physics.illinois.edu/spindown.pdf) gives both golf-ball measurements in that form: Smits and Smith 23.8 s at 100 mph, Tavares et al. (radar) 18.9 s at 100 mph. `spinTau` = 21.5 s at 100 mph, between them; it was a fixed 24 s at every speed. **Fitted freely the decay went slower** (38 s at 50 m/s): the fit was a touch better (23.5 against 23.7) but a tour wedge's spin-back on a Soft green tripled, 2.4 to 7.5 yd. Held at the published rate it is 4.6 yd. The fit does not see spin-back, so the published rate is what keeps it honest.
- **Hang time can not be fitted from here.** The GC3's hang times run 0.70 s shorter than ours before and after. Weighting hang heavily in the cost moved it to 0.66 s and made everything else worse. Height, carry and landing angle all agree with the GC3 to a percent or a degree while its hang does not, so the most likely explanation is that it measures or defines hang differently. Left open.
- **Trackman and the GC3 disagree on long-iron landing.** On near-identical 4 irons (137 mph, 11°, ~4,700 rpm; both 28 yd high, 203-205 yd carry) Trackman says 48° and the GC3 41°. A ball peaking at 28 yd over 203 yd lands near 40-41° unless its flight is extremely lopsided; the model agrees with the GC3 to 0.2°, and the GC3 is followed. Trackman's long-iron landing angles stay 4-6° steeper than ours.
- **Two Trackman rows disagree with the rest of Trackman.** The PGA pitching wedge peaks 10% above the model while the GC3's pitching wedges, faster and spinnier, fit within 1%; the LPGA 3 wood peaks lower than its own 5 wood. Both left as residuals.

**Still open:** the PGA driver carries 262 against 275 and peaks at 33.4 yd against 32 (+4%); total 284 against 296. The LPGA driver is within 1.2% on carry, +5% on height.

**Rollout and backspin, checked rather than assumed** (`tools/landing-scorecard.mjs`, which now takes `--set` to score a candidate before it is applied, and plays four fixed Trackman shots the keyboard clubs cannot re-tune away):

| | before | after | anchor |
|---|---|---|---|
| Driver run on a fairway (keyboard) | 20.8 yd | 21.9 yd | 21 |
| 3 wood run | 18.1 yd | 19.0 yd | 19 |
| 5 iron run | 13.0 yd | 13.8 yd | 15 |
| 7 iron on a Normal green | 6.2 yd | 6.5 yd | a few yards |
| Full wedge, Normal green (keyboard) | checks, back 1.1 yd | checks, back 1.8 yd | under 7 back |
| Tour PW (Trackman inputs), Normal | back 0.7 yd | back 1.4 yd | |
| Tour PW, Soft green | back 2.4 yd | back 4.6 yd | tour tops out at 5-7 |
| Chips, carry to roll | 1:1.9 / 1.4 / 0.9 / 0.5 | 1:1.9 / 1.4 / 1.0 / 0.5 | |

Every fairway run moved toward its anchor, chips did not move, and spin-back grew but stays inside what tour players manage: a full wedge on a Soft green comes back about 4½ yd, on a Normal one about a yard and a half. The bounce tests' pinned 7-iron arrival was re-pinned (23.23 m/s, 48.47°, 5,524 rpm; it was 22.57, 49.06, 5,068) and the firmness and surface ladders re-measured: hops 0.02-0.21 ft higher, run-outs up to 0.9 yd longer, every ordering intact. `biome-fingerprint --check`: every biome unchanged, so no generator version is owed -- the generator never flies a ball.

## A rolling ball skips, very slightly (6 October, cosmetic)

The owner asked for the ball to look as if it were "ever so slightly bouncing across the surface while it is rolling ... more on fairways and rough, very very little on greens ... not a patterned type of bounce effect, it needs to be random", easy to switch off. `src/roll-hop.js`, drawn only: the path, the tracer, where the ball stops and every readout come from the simulation, untouched.

Hops arrive at random -- the gap before each is drawn from an exponential distribution, so there is no rhythm -- at up to 4 a second at full rolling speed (2.5 m/s), none below 1 m/s. Each is a random height inside its surface's limit, leaning small (the square of a uniform number), flown as a real parabola: rise and fall take the time gravity says that height takes. Limits at full speed, **set by the owner by eye in play on 6 October**: fairway 80 mm, rough and semi 50, tee and fringe 30, green 10, sand none (a ball is 42.7 mm across). They replaced a first placement (rough 24, fairway 10, green 0.6, full at 6 m/s, nothing below 0.35, 5 a second) that was too subtle to see -- the measurement below was taken on it. Seeded per shot, so a replay skips exactly as the shot did. In the built game a driver run-out into rough hopped up to 15.6 mm; switched off, never. 3.2 hops a second was tried first and showed about one in a whole fairway run-out, since each lasts a tenth of a second.

**Switched off by default the same day**, at the owner's request, to revisit later: the code and the owner's heights are kept. `ROLL_HOP.enabled = true` turns it back on; `lab.rollHop(true)` does the same in a running game.

## The sim handicap (6 October)

The owner asked for a "sim handicap" on the new profile page. It is the World
Handicap System's own arithmetic, applied to courses that have no rating. Code:
`src/handicap.js`; tests: `tests/handicap.test.mjs`.

**Followed as published (USGA / England Golf WHS pages, REFERENCES.md):**

- **Score differential** = (113 / Slope Rating) x (adjusted gross score - Course
  Rating). The playing conditions adjustment is taken as zero; there is no field
  to compare against. Rounded to a tenth.
- **Hole caps.** With no index yet, every hole is capped at par + 5. With one,
  at net double bogey: par + 2 + the handicap strokes received on that hole.
- **The index** is the average of the lowest differentials among the most recent
  20, by count: 3 scores, lowest 1 minus 2.0; 4, lowest 1 minus 1.0; 5, lowest
  1; 6, lowest 2 averaged minus 1.0; 7-8, lowest 2; 9-11, lowest 3; 12-14,
  lowest 4; 15-16, lowest 5; 17-18, lowest 6; 19, lowest 7; 20, lowest 8. Capped
  at 54.0. Table read from England Golf's WHS page.
- **Course Handicap** = index x Slope / 113 + (Course Rating - par), rounded; a
  nine uses half the index.
- **A nine-hole score (2024 revision)** becomes an 18-hole differential by adding
  the expected differential for the nine not played, 0.52 x index + 1.2. Read
  from a search summary of the USGA's 2024 nine-hole FAQ and MGA/TXGA summaries;
  the USGA page itself was not fetched.

**The rating, which is where this departs.** A real Course Rating is a team's
judgement of effective playing length plus ten obstacle factors. A generated
course has neither, so it is rated from its card yardage alone with the USGA
yardage-rating formulas and no obstacle values:

- scratch yardage rating (men) = length / 220 + 40.9 -- confirmed by a search
  citing the USGA Course Rating System;
- bogey yardage rating (men) = length / 160 + 50.7 -- **placed, not read.** It is
  the companion formula in the same manual, from memory; no fetched page showed
  it (the USGA's Section 13 page returns 403). If someone can open the Course
  Rating System manual, this is the first number to check;
- Slope = 5.381 x (bogey - scratch), the men's multiplier (women's 4.24), from
  the Wikipedia "Slope rating" article and wiscogolfaddict's summary of the USGA
  manual; clamped to the published 55-155 and rounded.

A nine is rated as eighteen played twice: both constants halved, the bogey gap
doubled for the slope. A 6,500-yard course rates 70.5 / 112; 7,200 yards rates
73.6 / 119. **The consequence: two courses of equal length rate the same however
much water, sand or slope one of them has.** That is the main reason the number
is called a sim handicap.

**Other departures, all deliberate:**

- **Stroke index.** Generated cards have none, so holes are ranked by yards per
  par stroke (a 470-yard par 4 before a 560-yard par 5) and strokes go to the
  top of that list first. Placed.
- **A first nine with no index yet** is doubled rather than held until a second
  nine arrives, which is what the WHS would do. Otherwise a player of nines would
  wait twice as long for a number.
- **No soft or hard cap, no exceptional-score reduction.** Both depend on a
  twelve-month low-index history that a sim profile rarely has; worth adding if
  players keep long histories.
- **What qualifies:** a 9 or 18 hole stroke play, skins or match play round, not endless,
  with every hole scored. Scramble is a team score. Three-hole rounds are too
  short for the WHS. A match conceded before its last hole is left out rather
  than given "most likely scores".
- **Decimal putting** gives fractional hole scores; they are used as they are.

**What counts as a tree or a house hit.** physics.js counts a strike when the
ball's velocity INTO a trunk or wall is reflected -- once per collision, not once
per frame of contact -- and returns `treeHits` and `homeHits` with the shot. The
counters change nothing about the flight.

## Penalty relief: water and out of bounds (7 October)

The owner found that a ball in water made the golfer rehit from where they had
played, and asked for the Rules of Golf to be researched and followed in every
format. Code: `src/relief.js` (the rules, pure), `Round.takeShot`/`takeRelief`
in `src/game.js` (the strokes), the relief bar in `main.js`. Tests:
`tests/relief.test.mjs`, and the `relief` smoke journey.

**What the Rules say (Rules of Golf 2023, randa.org Rule 17 and Rule 18):**

- **Rule 17.1d, ball in a penalty area: one penalty stroke, three options.**
  (1) Stroke and distance, from where the previous stroke was made.
  (2) Back-on-the-line: drop outside the penalty area "keeping the estimated
  point where the original ball last crossed the edge of the penalty area
  between the hole and the spot where the ball is dropped", no limit how far
  back; the relief area is one club-length round where the dropped ball first
  lands, not nearer the hole, anywhere except the same penalty area.
  (3) Lateral relief, red penalty areas only: two club-lengths from the point
  where it last crossed the edge, not nearer the hole, anywhere except the same
  penalty area.
- **Colour.** "If the colour of a penalty area has not been marked or indicated
  by the Committee, it is treated as a red penalty area" (the definition of
  Penalty Area, quoted through a search result; the definitions pages on
  randa.org redirect to a 404 for automated requests). Nobody marks a generated
  course, so every pond, lake, river and creek here is red and gets all three.
- **Rule 18.2b, out of bounds: stroke and distance, one penalty stroke.** A ball
  is out of bounds "only when all of it is outside the boundary edge".
- **Model Local Rule E-5, alternative to stroke and distance** (USGA article,
  Hof Hausen's published copy of the text, TXGA/OGA summaries): two penalty
  strokes. Ball reference point: where the ball last crossed the boundary.
  Fairway reference point: the point of fairway OF THE HOLE BEING PLAYED nearest
  the ball reference point, not nearer the hole than it; "fairway" means any
  grass in the general area cut to fairway height or less. Relief area: between
  the line from the hole through the ball reference point (plus two club-lengths
  outside it) and the line from the hole through the fairway reference point
  (plus two club-lengths to the fairway side); in the general area; not nearer
  the hole than the ball reference point. Not for a ball in a penalty area.
  Intended for general play, not elite competition.
- **Club-length**: the longest club in the bag other than a putter.

**What the game does, and where it departs:**

- **The drop is placed, not dropped.** A real drop falls from knee height and
  may roll up to the edge of the relief area (Rule 14.3); here the ball is set
  on a spot inside the area, 30 cm clear of the water or the line.
- **One spot per option.** The Rules let the golfer drop anywhere in the
  relief area; the game picks the best lie it can find inside it (green and
  fairway, then fringe and tee, semi, rough, sand), then the spot nearest the
  hole, and shows it. Back-on-the-line, which has no limit, can be walked back
  ten yards at a time. Choosing an arbitrary spot by hand is not built.
- **E-5 drops at the fairway reference point itself** (in the relief area by
  construction), or the best general-area spot within two club-lengths of it.
- **Club-length is placed at 45.5 inches (1.16 m)**, a typical driver. The
  Equipment Rules allow 48 inches and Model Local Rule G-10 46 (USGA/R&A, 2021).
  It sets lateral relief at 2.31 m round the crossing point.
- **Where the ball crossed the edge** is found on the ball's own path: walked
  back from where it stopped to the last point outside the water (or inside
  the boundary), then halved between that sample and the next to the
  centimetre. A flight sampled every few metres would otherwise put the edge
  metres away. A ball that flies over a pond, lands beyond it and rolls back in
  last crossed the FAR bank, and that is the point used, as the Rules say.
- **A house that plays as out of bounds** is its own boundary: the ball stops
  against it, and where it stopped is the ball reference point.
- **One option is not a choice.** Out of bounds under the Rules of Golf, or
  water with no playable ground in reach, has only stroke and distance; it is
  applied at once and said in a toast, not offered as a menu of one.
- **Not built:** an unplayable ball (Rule 19), a provisional ball (18.3),
  playing a ball as it lies inside a penalty area (impossible to strike from
  water in this model), yellow penalty areas (nothing marks one), and lost balls
  (a sim never loses one).

**Rejected, and why:**

- **Searching outward from the ball for E-5's fairway, capped at 250 m.** The
  first version did; on a hole beside the world's edge the boundary can be
  further than that from any fairway, and the search silently returned nothing,
  so the round fell back to stroke and distance with no explanation. The hole's
  own area is searched instead, on a 2 m grid refined to 25 cm, with a 50 cm
  pass round the ball when a thin strip of fringe is all that qualifies.
- **Counting any fairway.** In a shared landscape the next hole's fairway can be
  nearer; the second version dropped a ball behind the tee on someone else's.
  The hole's own `localSurface` now decides what is ITS fairway.
- **Adding the penalty at the shot.** The old code added one penalty stroke as
  the ball went in. With E-5 the cost depends on the choice, so the shot is
  counted then and the penalty when the golfer chooses -- and a mulligan, which
  goes back to before the shot, takes back both.

**When E-5 is not available.** Its fairway reference point must be no nearer
the hole than where the ball went out. Hit out of bounds from a tee, where the
ball crosses the line level with the tee, every point of the hole's fairway is
nearer the hole, so E-5 cannot be used and stroke and distance applies. This is
the rule, not a limitation; the tests carry a case of it.

## The build overlay's progress, measured (7 October)

Measured on the built file from disk, Low tier, `lab.course`:

| | before | after |
|---|---|---|
| 18 holes (trees 80, water 60, homes): overlay up | 11.4 s | 10.2 s |
| ...of which generation | 3.1 s | (the same work) |
| ...of which "Preparing the graphics" | 8.3 s, bar full and still | creeping |
| bar updates | 12 | 70 |
| bar at 20/40/60/80/99% of the wait | 100% from 27% on | 49 / 64 / 81 / 89 / 93% |
| longest still stretch | 8.3 s | 1.3 s |
| 9 holes: overlay up | 5.2 s | 5.1 s |

`view.ready()` broken down on the 18-hole build: shaders 6,800 ms, first frame
39 ms. The compile is `renderer.compileAsync`, off the main thread: frames kept
coming through it (longest frame gap 1.38 s, during generation, not the
compile). So the wait was never frozen; it only looked it. The remaining 1.3 s
still stretch is a real main-thread block inside generation -- the open
*Generation worker and progress* item.

**Rejected:** counting compiled programs for real progress. Three.js compiles
them in parallel behind one promise; reaching into its program cache to count
them would tie the bar to Three's internals for a cosmetic gain.

## Haunted Hollow, the ninth biome (9 October)

Picked by the owner from sixteen ideas (TODO.md, *New biome ideas*) as a
Halloween update. Like Giant Redwood, the mood is almost entirely numbers the
engine already reads; what is new is what grows, and nothing that grows is alive.

### The look, and what had to change after looking

| Field | Value | Why |
| --- | --- | --- |
| `sun` | 10 | The lowest of any biome (redwood 18, autumn 19). `daylight.js` treats it as the noon peak, lifted to 35 + 0.6 x 10 = **41 degrees**, so midday is still daylight and the default hour lands late in the afternoon. |
| `sunColor` | `#ffc29a` | First tried `#ff9d5c`: at midday it turned the whole course desert-orange. |
| `sky` | `#a4949a` | Mauve-grey. The fog takes its colour from it, as in the grove. |
| mist profile | haze 1, sheet 1, water 1 | The heaviest, equal to Pacific Northwest. |
| `rough` | `#57553e` | First tried `#6b6243`; under the warm key it read orange-tan, like the desert. |
| `temperature`, `altitude` | 9 °C, 200 m | **Placed, not published** -- a late-October northern evening. Air density 1.221 kg/m³ against Midwest's 1.165 (22 °C, 230 m), **4.9% denser**, so the ball carries a little shorter. |
| `canopy`, `farCanopy` | 9-22 m, 8-20 m | **Placed.** Dead hardwoods on the short side of the parkland default (13-29 m); a bare tree hides far less than a leafy one, so they are planted a little denser (`treeDensity` 3.2). |

The first planting put **heather** under the trees. Its purple, plus the blossom
`vegetation.js` scatters over every heather and gorse, read as bright pink blocks
against dead grass -- cheerful, not haunted. It became `bramble`: a new ground
plant in the bush family, painted `#4f4636`. The pale snags' bark started at
`#a29b8f` and came out salmon-pink in the warm light; `#8a8984` is cooler.

### What grows, and what was rejected

Every model already sat in `vendor/` under packs ATTRIBUTION.md credits, and
each was chosen in `npm run assets`, not by file name:

| Species | Family | Models | Vertices each |
| --- | --- | --- | --- |
| `gnarled` | `gnarled` | MegaKit `DeadTree_1`, `_2`, `_4` | 7,249-8,157 |
| `snag` | `snag` | Ultimate Stylized `DeadTree_3`, `_6`, `_8` | 1,607-2,662 |
| `deadwillow` | `deadwillow` | Ultimate Nature `Willow_Dead_1`, `_2`, `_4` | 1,568-3,720 |
| `deadoak` | `arid` (shared) | the desert's three `CommonTree_Dead` | already shipped |
| `bramble` | `bush` (shared) | Kenney bushes | already shipped |

On the floor (`deadfall` 420, against the grove's 520): pumpkins 30%, toadstools
22%, stumps 24%, logs 24%. A pumpkin is drawn **30-70 cm** tall and a toadstool
clump **25-55 cm** -- both **placed**. A real fly agaric is smaller, a cap up to
about 20 cm; the clumps are oversized so they can be seen from a fairway.

**Rejected: `TwistedTree_1`-`_5`** (MegaKit). Their silhouettes are good, but the
foliage is a textured card sheet, and the ingest drops textures for everything
except houses. Without the sheet they are bare quads.

**The pumpkin needed a role override.** Kenney names its body `leafsFall` and
its stem `grass`, so `ROLE_OF` made all of it leaf and painted it one colour. The
toadstools are `colorRed`/`colorTan` caps on a `_defaultMat` stalk, all accent.
`ROLE_OVERRIDE` in `tools/build-meshes.mjs` re-roles those two families only.

### What it cost, and what it did not move

- `src/asset-meshes.js` went from 14,280,006 to 15,042,626 bytes (**+762 KB**,
  about 5% of the built page), almost all of it the three gnarled oaks. Thirteen
  models were added, 131 to 144. Compared part by part, **all 238 existing parts
  are byte-identical**.
- `node tools/biome-fingerprint.mjs --check`: **all eight existing biomes
  unchanged**, `haunted` new. No `GENERATOR_VERSION` or `SCHEMA_VERSION` bump: no
  existing seed builds anything different, and a new option in an existing
  choice is not a change of shape (Giant Redwood set the precedent).
- **Frame cost is not measured.** The gnarled oaks are among the heaviest models
  shipped, and they draw only on this biome. `npm run profile --only biomes`
  (about a minute) is the check; it waits for the owner's go-ahead.

### Course names

Thirty first words and twenty second words of Halloween vocabulary. Per the
rule in `src/course-names.js`, candidates were searched with "golf" (9 October).
Two were dropped and joined the denylist test:

- **Scarecrow** -- a David McLay Kidd course at Gamble Sands, Brewster,
  Washington, opened to public play on 1 August 2025.
  https://www.golfcourseindustry.com/gamble-sands-scarecrow-new-course-open
- **Phantom** -- Phantom Lake Golf Club, a nine-hole course.
  https://www.chronogolf.com/club/1685

No course turned up for Gloaming, Lychgate, Wraith, Moonrise or Nightshade. The
biome's title, **Gloaming Moor**, was among those searched.

### A test that could not fail

`tests/mist.test.mjs` asserted that "every biome has a mist profile" by calling
`profileFor`, which falls back to Midwest's fog for any biome without one. It
could never fail -- and **Giant Redwood has had no fog profile of its own since it
was added**, so the grove's "wet air" is Midwest's prairie haze. The test now
asks `hasOwnProfile` and names redwood as the one biome that borrows. Whether
the grove should get its own fog is a look decision, left open in TODO.md.

### Second pass: full fantasy (9 October)

The owner asked for four things: more and much bigger pumpkins and toadstools,
solid; "haunted" turf colours, "full fantasy"; ghosts patrolling the course; and
the glowing pumpkins. Everything below is **placed, not published**.

**Giant props, solid.** Pumpkins and toadstools left the decorative forest
floor and became generation output (`world.props`, course.js), because physics
can only collide with what the world knows about -- the boulder lesson again.

| | Before | Now |
| --- | --- | --- |
| Pumpkins on nine holes | about 126 | 235 (26 a hole asked) |
| Toadstool clumps | about 92 | 162 (18 a hole asked) |
| Pumpkin height | 0.3-0.7 m | 0.9-3.5 m (old size x 3 to 5) |
| Toadstool height | 0.25-0.55 m | 0.75-2.75 m |
| Collides | no | yes, a vertical cylinder |

The size multiplier is 3 + 2u², so most props sit near three times and a few
reach five, as asked. The cylinder is as wide as the model, measured off the
ingested geometry: pumpkin 0.693 of its height, red and tan toadstool clumps
0.645, the single tall toadstool 0.285 (`PROP_MODELS`, species.js). Measured
seed GLOAMING: 150 of 235 pumpkins are lanterns (60% asked).

**The collision test could not fail at first.** Rolled from 20 m short of
each pumpkin, the ball died in the rough before arriving: 0 of 27 rolls went
through with the pumpkins solid, and 0 of 27 with them hidden from physics.
From 2 m short at 25 m/s it is 0 of 27 solid against 27 of 27 hidden, and the
test now runs that control itself.

**Purple turf, and why the first purple came out brown.** Rough `#3c2856`,
semi `#553c7c`, fairway `#7f55b8`, fringe `#9270c6`, green `#86c24f`, sand
`#b9b2a6`, water `#1f3d2e` tinted `#2f6b46`. The Cartoon ground lifts every
rough 23% toward a fixed olive (`#b6bc65`, renderer.js), which suits grass and
turned a greyish violet into mud-brown; it is the biome field `roughTint` now,
`#6b5590` here. A first saturated set (rough `#4a3268`, fairway `#6a4d96`) had
too little contrast once lifted -- the fairway vanished into the rough -- so the
rough went darker and the fairway brighter. The 2D maps drew every biome's
fairway and green in fixed greens, so a purple course had a green map: the
biome field `mapTurf` now carries them.

**Lanterns.** A face of eyes, nose and a two-toothed grin, laid on an ellipse
just proud of the pumpkin's body (0.67 x 0.70 of its height; the body is 0.69
wide between 0.15 and 0.65 up). Unlit, outside tone mapping: near-black by day,
candle-orange as `solar.lamplight` rises -- from the sun at 10 degrees to 2
degrees below the horizon, the same number the glow ball follows -- with a
flicker between 76% and 100%. **Rejected: a halo of additive point sprites**
round each face. It drew a dark square behind every lit face, and still did
with the mist patch kept off it; compared side by side, the face alone reads
well, so it was dropped rather than chased.

**Ghosts.** A lathe-turned sheet ghost (dome head, flared skirt, six-wave hem,
two stubby arms, black eyes and an O mouth) whose skirt ripples in the vertex
shader. Two a hole -- 18 on nine holes -- each 2.3 to 4.0 m tall, hovering 2.2
to 5.7 m up with a 0.45 m bob, at 1.8 to 4.2 m/s round an ellipse beside its
hole; one in three swings wide across the fairway. They fade out between nine
and three of their own heights from the camera rather than fill the screen, and
glow faintly by day and fully after dark. Scenery only: the ball passes through.
Arms first pointed straight ahead and read as two loose discs; they point out
to the sides now.

**No GENERATOR_VERSION bump, by decision.** The fingerprint check says Haunted
Hollow's ground moved and asks for one. All eight released biomes are
unchanged, and Haunted Hollow has never been in a release or a pushed branch,
so no saved round can hold it. A bump would put the "this course has changed"
notice on every saved round of every biome, none of which changed -- an arbiter
crying wolf. If the branch was ever played and a Haunted Hollow round saved
locally, that one round would rebuild with the props.

### Frame cost, measured (9 October) -- and the hitch that was not ours

**The first reading was wrong.** `node tools/profile.mjs --only biomes --since`
on the second-pass build (High tier, player view, seed PROFILE, nine holes,
real-GPU arm: RTX 4090, ANGLE D3D11, vsync off) gave Haunted Hollow 6.1 ms CPU,
7.4 ms GPU and a CPU p99 of 58 ms, level with Giant Redwood and twice Autumn.
That was reported to the owner as "twice a parkland frame, with hitches". It
was mostly interference from outside the game.

**How it was found.** The owner asked what caused the hitches and whether the
gnarled oaks needed fewer polygons. The same measurement was repeated on the
capture build (`window.__view`), with the profiler's own probe and GPU flags,
switching one part of the scene off per case and recording when each frame
over 25 ms happened:

1. **In one browser, every case got worse the later it ran** -- Autumn included.
   The first profile ran nine biomes in one browser with Haunted Hollow last;
   the late cases (Island, Redwood, Haunted Hollow) had the large worst frames.
2. **With a fresh browser per case, the hitches came in bursts at exactly
   200 ms intervals** (5 Hz) through the whole sample -- 440, 635, 841,
   1033 ms ... in one Autumn run, 126, 322, 535, 749 ms ... in one Haunted
   Hollow run -- and struck about one run in four of either biome at random.
   A run with the burst also reads 1-2 ms slower at the median. Nothing in the
   game runs on a 200 ms timer (the only short one drives the loading bar and
   stops), so it is something else on the machine. Not identified.
3. **Clean runs, fresh browser each** (four rounds; the runs with the 200 ms
   burst left out):

| Case | CPU ms | GPU ms | Draws | Triangles | Frames > 25 ms |
| --- | --- | --- | --- | --- | --- |
| Autumn | 2.7-2.8 | 3.37-3.46 | 458 | 7.0 M | 0 |
| Haunted Hollow | 2.8-2.9 | 4.09-4.21 | 341 | 17.8 M | 0 |
| Haunted Hollow, gnarled oaks hidden | 2.6-2.7 | 3.58-3.71 | 329 | 10.5 M | 0 |
| Giant Redwood | 5.3-5.6 | 7.02-7.23 | -- | -- | 4-5, every run |

So Haunted Hollow costs about **0.7 ms more GPU** a frame than Autumn on this
machine and the same CPU, and has **no hitch of its own**. The gnarled oaks
are 7.3 M of its 17.8 M triangles and about 0.5 ms of that 0.7. The props,
lanterns and ghosts share the rest; the per-part runs for them in a single
browser were too contaminated to separate, and at 0.2 ms together there was
no reason to chase them.

**Decision: the oaks keep their polygons.** The owner asked for a reduction only
if the oaks caused the hitches, and they do not. If Haunted Hollow ever needs
to be cheaper -- on a weak machine 7 M triangles matters more than half a
millisecond here suggests -- the oaks are where the triangles are.

**Giant Redwood's hitch was real in the profiler and absent at normal frame
pacing**: four or five frames of 157-178 ms between about frames 180 and 250 of
every fresh run, explained in *The redwood hitch: an uncapped-profiler stall*
below.

The `--since` comparison found the other seven biomes 1.6 to 6.8 ms faster than
`bench/profile-baseline.json`; the baseline was taken under different
conditions and says nothing here. It was not re-saved.

### The redwood hitch: an uncapped-profiler stall (9 October)

Investigated at the owner's request, reported first; **only written up, nothing
in the game changed**, by the owner's decision.

**What it is.** A course opens with the camera holding high for about 2.7 s,
then flying down to the tee. The instance cull (`src/instance-cull.js`)
rebuilds the list of drawn instances every 4 m of camera travel, and on the
redwood course (seed PROFILE, nine holes, High) one rebuild uploads about
**83,000 instances, 6.7 MB**, across 238 buffers -- already only the visible
range of each. During the descent that is every two to four frames. With the
frame rate uncapped, the first rebuilds as the camera starts down collide with
frames already queued for the graphics card, and Chrome's GPU process stalls
for **170-195 ms** inside the driver. The page does not wait on its own call:
it waits a frame or two later, on whatever call finds the command queue full
(once a single 4x4 matrix upload took 181 ms).

**Evidence** (capture build, High, 1600x900 at 2x, real GPU, a fresh browser
per run, each slow frame's GL calls and per-call time recorded):

| Test | 170-195 ms frame at camera height 115-117 m? |
| --- | --- |
| As normal, uncapped | yes, every run (and again when the descent was replayed in the same run) |
| Redwood-forest models hidden | no |
| Cull rebuilds frozen | no |
| **Normal 60 fps pacing (vsync on)** | **no slow frame at all, 2 of 2 runs** |
| 1600x900 pixels / 400x225 pixels | 124-129 ms / none |
| Shadows off | yes |
| God rays off | yes |
| God rays drawn once toward the sun first | yes |
| Floodlight warm-up off | yes |
| The descent drawn once beforehand | yes |

The graphics card's own time for the hitch frame's drawing was normal (about
7 ms, timer query), the frame drew the usual 560 draws and 83,000 instances,
and it compiled and created nothing. A Chrome trace put the time in the GPU
process's command-buffer flush, with no named step inside it: driver work. The
frames just before each hitch carried a 6.7 MB rebuild upload.

**Hypotheses tested and rejected on the way**, so nobody repeats them: one-off
driver preparation on first draw (pre-drawing the descent did not help, and the
hitch recurs on a replay); the camera flying through the treetops (it is 83 m
from the nearest crown); the god-rays occlusion pass; shadow maps; the
floodlight warm-up.

**Smaller findings.** The floodlight warm-up causes two frames of 40-90 ms a
little later in the descent -- each creates one texture and checks three
programs -- which also vanish at 60 fps pacing. It also adds about 2-3 s to a
redwood course's loading (7-8 s with it, 3.6-5.7 s without); that is behind the
loading screen, where the owner asked for that work to go.

**What it means.** A player on this machine (RTX 4090) does not see it. **Not
tested: a graphics card that cannot hold 60 fps on the redwood course**, which
would queue frames the way the uncapped profiler does and could feel the same
stall. If that is ever reported, the fix to try is spreading a rebuild's upload
over several frames rather than sending all 238 buffers at once; it touches
tree drawing, so it wants its own before-and-after measurement.

### Night: a harvest moon, bats and will-o'-the-wisps (9 October)

Asked for by the owner from a list of ideas; scenery only, so no generation
changed (the fingerprint confirms every biome, Haunted Hollow included). Every
number here is **placed, not published**.

**Harvest moon.** A disc drawn into the sky shader, 2.3 degrees in radius --
about nine times the real moon's 0.26 -- orange (`#ff8a2a`) on the horizon,
paling to `#ffe2b0` by 30 degrees up, mottled with darker seas, a soft halo,
hidden below the horizon and drawn before the clouds so cloud crosses it. It
shows at a quarter strength by day and comes in fully with `solar.lamplight`,
the same number the lanterns follow. On the moonlight's own arc it was still
just below the horizon at Dusk (-1.1 degrees), which is wrong for a harvest
moon, so the disc runs `MOON_LEAD` = 0.3 radians of phase (about 1.25 h) ahead:
5.2 degrees up at Golden hour, 9.3 at Dusk, 22 by 9 pm. The first strength
rule (by `dayness`) left it pale and faint against a bright dusk sky; following
lamplight fixed that. Other biomes keep only the small pale disc their sun's
disc becomes after dark, exactly as before.

**Bats.** One flock a hole, 6-11 bats each -- 75 on nine holes -- circling one
of the hole's tallest trees at 75-115% of its height, 7-21 m out, on circles
whose radius and height breathe. Each is a body and two hinged, fingered wings
beating at 9-14 a second, 2.6-4.4 m across: far bigger than any real bat
(about 0.2 m for a pipistrelle, 1.5 m for the largest fruit bats), because from
a tee 50-150 m away anything smaller is a speck. Out once lamplight passes
0.05, growing in rather than popping on.

**Will-o'-the-wisps.** Three a hole -- 27 on nine -- 70% of them over a pond
near its bank where the hole has one, the rest in the lowest of eight spots in
the rough beside the hole. A core 0.16-0.26 m across hovering 0.9-1.8 m up,
drifting round a 1.2-4 m loop, each going out for about two seconds in a
cycle of 9-23 s. Out once lamplight passes 0.2. **The glow was redone once:** a
flat translucent sphere round the core read as a green target ring, so it is
a shell whose opacity falls off toward its rim as seen from the camera. Not
additive, because an additive sprite is what drew dark squares round the
lanterns.

**Cost.** No frame cost measured; it needs the owner's go-ahead for a profile.
Switching the clock from afternoon to dusk costs one slow first frame of 58-68
ms whether the bats and wisps are there or not (three runs each, normal 60 fps
pacing): that frame is the existing work a clock jump does, not theirs. That
work was the reflection refresh rebuilding its shaders, fixed the same day
(*The time slider hitched*).

## The time slider hitched: the reflections rebuilt their shaders (9 October)

**The owner's report:** dragging the time-of-day slider was no longer smooth;
the game hitched and locked up as the time changed.

**What it was.** Every time the sun's height moves 6 degrees (3 off Cartoon),
`updateDaylight` calls `refreshEnvironment`: the sky is captured into the
reflection map props use, and every pond's probe is taken again
(`refreshWaterEnvironment`). Both made a three.js `PMREMGenerator`, used it once
and disposed it. Disposing a generator disposes its blur and GGX materials, and
three deletes a shader program once no material uses it -- so the next refresh
compiled both programs again. The GGX one loops over 256 samples (three
0.186), and compiling it through ANGLE on Direct3D 11 is the cost. Nothing
else in a moving sun costs anything: away from a threshold a slider step was
under 1 ms.

**Measured** on the development machine (RTX 4090, ANGLE/D3D11), Low graphics,
960x600, every figure with `gl.finish()` either side:

| | Before | After |
| --- | --- | --- |
| One threshold, menu hole with one pond | 127-161 ms (460 ms the first after loading) | 4-7 ms |
| Sky capture alone, a generator made per call | 81-102 ms | -- |
| Sky capture alone, one generator kept | -- | 0.2-0.5 ms |
| One pond's probe | 51-68 ms | 3.3-6.9 ms |
| Sky capture of an EMPTY scene, fresh generator | 60 ms first, then 0.3 ms with a kept one | |

(Low, one pond. **On a pond-heavy course a threshold still stalled** after this
fix: 67-117 ms a threshold on Ultra and a 1.4 s first freeze on Medium, idle
card -- the photographs themselves, and on Medium their render-target programs,
not the generators. Fixed the next day: *Wasted drawing*, below.)

Dragging from 6:00 to 20:00 crosses 14 thresholds, so it was 14 freezes of
about 0.15 s each on this card at Low; a slower card or a higher tier only adds
to it. A nine-hole Midwest course with seven ponds measured 81-102 ms for the
sky part and 77-91 ms for the ponds' part (one generator's rebuild plus seven
cube renders) -- most of the second number was also the rebuild.

**The fix:** `pmremFor(job)` keeps one generator for the sky and one for the
water for the life of the renderer (it is never torn down). **Two, not one**:
a generator sizes its working target and its blur and GGX programs to the cube
it was last given (`_allocateTargets`: 3 x max(size, 112) by 4 x size), so
the sky's 256 cube and the water's tier-sized cube (64-256, a quarter of the
tier's `reflection`) alternating through one generator would rebuild both
programs on every switch.

**Rejected:**
- *A bigger threshold.* Fewer freezes, each just as long.
- *Refresh only when the slider is let go.* A stale reflection while dragging,
  and more state, to avoid a cost that is now 4-7 ms.
- *Spreading the pond probes over several frames.* Not needed at the measured
  cost; it is the next step if a many-pond course still hitches on a weaker card.
  **Overturned the same day:** a pond-heavy Ultra course did still hitch, on
  this card; the ponds are now retaken one a frame (*Wasted drawing*).

**Not established:** when this got worse. The code was the same in the initial
commit; what a probe draws (planting, a probe per body) has grown since, but
the shader rebuild was most of the cost all along. Not measured: Medium, High,
Ultra, the seven-pond course after the fix, or a weaker card.

**Noise met on the way.** Partway through, frames 17-34 ms long came and went
whether or not the clock was moving -- interleaved still and moving frames
gave 0.5 ms each minutes later. That is the machine, the same interference as
TODO's *profiler can be fooled by something on the machine*, and was not acted
on. The *Cost* note under *Night: a harvest moon* (a 58-68 ms first frame on a
jump from afternoon to dusk) was this refresh; not re-measured as a jump.

## The studio froze when the camera turned to the sun (9 October)

**The owner's report:** on Ultra, through the bridge, growing an 18-hole
course in Course studio locked the game up for a few seconds a moment after the
loading screen went, every time.

**Not reproduced by the harness first.** Nine scripted runs found nothing over
0.27 s after the cover went: Midwest and Haunted Hollow nines on Medium, PNW
eighteen on High, the studio on Ultra at 1280x720 and 2560x1440, at night,
served through the bridge, and in a visible Chrome window. Every one had the
same single 0.17-0.27 s frame just after the cover (the first grass tiles,
about 0.12 s; the course map's first draw, about 0.07 s; first-draw program
setup) and no late programs. **What every scripted run had in common was a
camera that never moved.**

**The owner's own Chrome performance recording** (trace, kept locally, not
committed) showed it at once: a single animation frame of **8,023 ms**, 7,996
ms of it inside `getProgramInfoLog` -- three waiting for the browser to finish
building programs -- under `godRays.render`. The input events put it 0.08 s
after a key press, with the owner dragging the view from 1.4 s before: they
had turned the camera toward the sun. Chrome's GPU process then ran tasks of
1.1-4.0 s for twelve more seconds. The same recording also showed two waits
behind the cover: 0.7 s in the sky's first reflection capture during the build
(`addSky`), and 3.2 s in `ready`'s first frame.

**Why the god rays.** The pass draws only when the sun is in shot
(`godrays.js`), and draws the scene through its own black override material
into its own target. `compileAsync` compiles each object's OWN material, never
an override, and the frame drawn behind the cover had the sun out of shot -- so
the mask's programs, one per kind of object (instanced or not, with instance
colours or not, with normals or not), and the composite shader were all first
built and drawn the first time a player faced the sun. A scripted camera
turning a full circle reproduced it: four `MeshBasicMaterial` programs and one
`ShaderMaterial` built 4 s after the cover, as the sun came into view.

**Why 8 s for five small programs.** Alone they are a few milliseconds each
here. The likely reason, inferred and not measured: the browser builds
programs one at a time in its GPU process, and the first one the page has to
WAIT for (three's first use of a new program asks for its log) waits behind
everything already queued -- including whatever the driver was still
finishing from the warm-up behind the cover. The owner's GPU process was busy
for seconds after the freeze, which fits. **So "unlit programs build in a few
milliseconds" (B7's allowance, above) is true of a program alone, not of the
wait it can cause.**

**The fix, in `godrays.js`:**
- **The frame drawn behind the cover runs the pass whatever the sun is doing**
  (`render(..., warm)`, set from `view.readying`), with intensity 0 so the
  composite discards every pixel and the picture is unchanged. On Windows a
  program is only finished on its first real draw, so drawing it is the point.
- **That warm frame draws every solid object, not only what the camera sees**
  (frustum culling off for the mask only): a kind of object behind the camera
  would otherwise still be built late.
- **Lines, points and sprites are left out of the mask.** They block no sun,
  and each is a kind the black material needs a program for. The one late
  program left after the first two changes, on a Play round, was the black
  material for a mesh with no normals: the aim line (`Line2`), which appears
  only once a round is in play. A shot's tracer would have been the next.

**Measured after** (scripted, headless, RTX 4090): turning a full circle after
the cover builds nothing on a Midwest nine, a PNW eighteen or an 18-hole
studio course, on Ultra. The warm frame behind the cover grows from 34 ms to
45-51 ms (PNW eighteen, two runs each). Leaving lines out costs a walk of the
visible scene each frame the sun is in shot: 529 objects, 0.012-0.014 ms. A
sun-facing frame looks the same before and after. **Not re-measured in the
owner's Chrome**, which is the only place the freeze was seen.

**The guard.** `no-late-shaders` now turns the camera a full circle after the
arrival and fails if a program of ANY kind is built after the cover. It failed
on the build before this fix (the four black programs and the composite, at
6.3 s) and passed after.

**Seen and not acted on:** the 3.2 s first frame behind the cover and the
0.7 s sky capture in the owner's recording are inside the loading wait, where
the work is meant to land. The god-ray mask was also found to draw every
shadow map a second time each frame the sun is in shot -- fixed the same day,
*The god rays drew every shadow map twice*.

## The god rays drew every shadow map twice (9 October)

**What it was.** The god-ray mask is drawn with `renderer.render`, and with
`shadowMap.autoUpdate` on (it is, for the sun's cascades) every `render` call
redraws all shadow maps. So each frame with the sun in shot drew the three
cascades twice: once for the picture, once more inside the mask pass, which
is flat black and reads none of them. Counted in the page (Ultra, Giant
Redwood, facing the sun): 2 shadow-map passes a frame before, 1 after; the
mask pass itself still runs once a frame.

**The fix:** `godrays.js` switches `autoUpdate` (and `needsUpdate`) off for
the mask render and puts both back after. Per-lamp floodlight shadows are not
affected: the frame's own render, which runs first, is the one that redraws
them.

**A new profiler group, `sun`** (`node tools/profile.mjs --only sun`): High
and Ultra, Giant Redwood and Midwest, the camera 3 m above the first fairway
60 m from the tee, turned to the sun's bearing and tilted to 12 degrees under
it (`lab.camera` now takes `look: 'sun'` and `pitch: 'sun'`). Every other
case looks down the hole and usually has the sun out of shot, so it measured
the god rays as free. Midday, as every profiled round starts.

**Measured** (RTX 4090, GPU arm, two runs each side, the build without the
fix run between the two runs with it):

| case | draws before / after | triangles before / after | CPU ms median, before (2 runs) / after (2 runs) | GPU ms median, before / after |
| --- | --- | --- | --- | --- |
| High, Redwood | 968 / 619 | 54.9 M / 37.6 M | 6.10, 4.90 / 4.50, 6.50 | 6.05, 4.72 / 4.40, 6.66 |
| High, Midwest | 522 / 337 | 13.1 M / 8.5 M | 5.00, 3.80 / 3.80, 3.40 | 3.65, 3.00 / 2.76, 2.25 |
| Ultra, Redwood | 980 / 631 | 54.9 M / 37.6 M | 6.80, 8.10 / 4.50, 8.00 | 6.75, 8.21 / 4.37, 8.14 |
| Ultra, Midwest | 526 / 341 | 13.1 M / 8.5 M | 4.90, 4.00 / 3.90, 3.50 | 4.34, 3.55 / 3.58, 3.42 |

**The work is certain, the time is not.** Draws fall 35-36% and triangles
31-35%, identically on every run. The milliseconds moved by up to 3 ms between
runs of the same build -- more than the change -- so on this card the time
saved is not separable from the machine's noise; Midwest is lower after in all
four pairs, Redwood is not. On a card with less headroom than an RTX 4090, a
third less geometry in a sun-facing frame should matter more; not measured.
The baseline (`bench/profile-baseline.json`) was not re-saved: it has no `sun`
cases, and these numbers are too noisy to defend.

A sun-facing Ultra frame after the fix still shows the trees' shadows across
the ground.

## Wasted drawing: pond photographs, shadow twins, shore foam (9 October)

**The owner's question:** after the god rays, is anything else drawing
needlessly and costing frames? An audit of everything that draws the scene
from somewhere other than the main camera, of what casts shadows, of which
materials change every frame, and of one Ultra frame counted pass by pass
(scratch tools, not committed). **Measured while the graphics card was also
running something else at 95% load**, so the milliseconds below are inflated;
counts are exact. The fixes are in; their before-and-after waits for the
owner's go-ahead on an idle machine.

**1. The pond photographs (every tier with reflections on, the default).**
Every 6 degrees of sun, `refreshWaterEnvironment` re-photographed up to eight
bodies of water: six renders of the WHOLE course per body (`cull.showAll`, so
every tree, not the camera's share), and every one of those 48 renders also
redrew every shadow map -- the god rays' mistake again (`autoUpdate`). On a
nine-hole Midwest course with water at 100, three lakes, two rivers and three
creeks (16 bodies, 8 probed), one refresh measured 690-1,190 ms with the
redraws and 410-610 ms without, on Ultra; 48 shadow passes against none.
Dragging the clock from 6:00 to 18:00 over six seconds on that course gave 12
refreshes and a stall at each: 971 ms the first, about 100 ms the rest. So the
earlier time-slider fix (*The time slider hitched*) removed the shader rebuild
but not this; it had been measured on Low with one pond.

Fixed in three parts (`renderer.js`):
- **No shadow redraws inside a photograph** (`probeCapture`): `autoUpdate`
  off around the captures. The sun's shadow cameras do not move between faces,
  so the 48 redraws were identical. At build, when no frame has drawn the maps
  yet, the first face draws them once (`fresh`).
- **One pond a frame when the sun moves** (`queueWaterProbes`,
  `stepWaterProbes`): the threshold queues the probed bodies, biggest first,
  and each frame retakes one -- one `showAll` and six renders, not 48. A
  threshold crossed mid-round (dragging) runs one more round after it rather
  than restarting, so the last ponds are never starved. Build, a new tier and
  switching reflections back on still take everything at once.
- **Each pond is retaken into its own texture** (`fromCubemap(cube, into)`):
  no new render target per retake, no `material.needsUpdate` on the water, and
  bodies past the cap that borrow a probe follow by themselves.

*Considered and not done:* re-photographing less often, or tinting the old
photograph instead (the water model is signed off, TODO *Lighting and water
fidelity*, and either would change how dusk looks on the water); leaving
small ground cover out of the photographs (a reflection 128 pixels across
cannot show it, but it would need measuring first); a face per frame instead
of a pond (each step's `showAll` uploads every tree's instances and the next
cull update uploads them back -- the redwood hitch's mechanism -- so 48 steps
would be 96 uploads).

**2. The shadow twins (High and Ultra).** The thinned copies of crowns that
only shadow maps should draw were also in the picture, the god-ray mask and
the probes, zeroing their own count. That costs little -- except that a twin
had no instance colours and its tree did, and the two share a material, so
three flipped the material's program twice per twin per pass: 57 program
changes in one Redwood Ultra frame, each a full parameter rebuild. A
sampling profile put three's program selection at 0.09 ms a frame from the
tee and 0.40 ms facing the sun on Redwood Ultra, and 0.03-0.04 ms with each
twin given its tree's colour buffer (`instance-cull.js`; shared, like the
matrices -- a shadow ignores colour). An earlier run of the same measurement
gave 0.55 ms from the tee; this machine's noise again. Small on this
processor, several times larger on a slow one.

*Considered and not done:* putting twins on a layer the main camera does not
draw. Three's shadow pass tests objects against the MAIN camera's layers
(`WebGLShadowMap`, `object.layers.test( camera.layers )`), so the twin would
leave the shadow maps too.

**3. The shore foam, and two flat rings.** Three draws a transparent
double-sided material twice per frame, back faces then front, flipping its side
and marking it changed each time; the pond shore foam was the only material in
a still Redwood frame that changed every frame (+20 versions in 10 frames, per
strip). It now draws once (`forceSinglePass`), as do the scramble ball-pick
rings and the shot landing ring, the only other materials with the pattern --
all flat, with nothing behind themselves to sort. No measurable difference;
done because it was free.

**Checked and fine:** soft ground shade is baked once per course
(`occlusion.js`), not drawn; bloom draws only full-screen quads; only the god
rays and the pond photographs draw the scene a second time; rough grass and
flowers cast no shadows (trees, rocks and imported models do); in a still
frame no material but the foam changed version.

**Measured after (10 October, card idle at 16-31%, RTX 4090).** Before is
`main`, after this branch, same scratch tools, alternating runs:

| | before | after |
| --- | --- | --- |
| Dragging the clock 6:00-18:00 in 6 s, 16-body Midwest, Ultra (2 runs each) | 294-313 frames; a stall of 67-117 ms at each of 15 thresholds | 360-361 frames; no frame over 50 ms |
| The same on Medium | 259-260 frames; one 1.4 s freeze, then 1-2 of 100-133 ms | 362 frames; no frame over 50 ms (after the probe warm-up below) |
| One whole refresh (the all-at-once path), Ultra | 83-88 ms, 48 shadow passes | 33-61 ms, 1 shadow pass |
| three's program selection a frame, Redwood Ultra, from the tee (2 runs) | 0.50-0.57 ms picture + 0.14-0.22 shadow | under 0.01 ms picture + 0.13-0.18 shadow |
| The same facing the sun | 1.15-1.18 ms picture + 0.18 shadow | 0.04 ms picture + 0.09 shadow |

**Yesterday's figures were inflated about tenfold**: the same refresh measured
690-1,190 ms with the card busy, 83-88 ms idle. The stalls were real either way.

Profiler, `--only sun` (one run each, medians, CPU / GPU ms): High Redwood 6.60 /
4.81 before, 4.30 / 3.31 after; High Midwest 4.90 / 3.38, 3.20 / 1.89; Ultra
Redwood 6.20 / 5.17, 4.90 / 4.39; Ultra Midwest 4.80 / 4.16, 3.40 / 2.74 --
lower in every case, the CPU share matching the program-selection saving.
`--only water` (three runs each, "all on" medians): 3.5, 3.7, 4.2 ms before;
3.1, 3.6, 2.9 after; 410 draws a frame before and 401 after (the foam's
second pass). Its p95 and p99 swung from 4.4 to 10.0 and 4.9 to 49.7 ms
between two runs of `main` alone, so they say nothing either way.

**A fourth fix, found by the Medium drag: the probes' render-target programs.**
Medium froze 1.3-1.4 s at the first threshold, before and after alike. A
log of program links during the drag showed twenty-odd `MeshToonMaterial`
programs built one after another, about 60 ms apart, inside the first probe
retake. A probe draws into a render target, and three builds a different
program for a render target (no tone mapping, linear colour) than for the
screen; Ultra draws the picture into bloom's target, so the two were the
same there, and on every other tier they were not. They were never built
behind the loading screen because the probes taken there hid everything
built after the water -- the planting, homes and ball -- to match what the
probes saw when they were taken mid-build (B1). Fixed in `ready`: the scene is
compiled against the probe target (`asProbe`) before the probes are taken,
and the probes no longer hide the planting. One program is still built at
the first threshold, the sky's in its own capture, under 50 ms.

**What that looks like.** In principle a course now opens with its ponds
reflecting its trees rather than gaining them at the sun's first move. In
practice, on the pond tested (PNW, Medium, from its bank), noon and dusk are
identical before and after: 0.03 of 255 on average across the water, with
the ripples held at the same moment. Without holding them, dusk differed on
9% of the water's pixels, which looked like a darker reflection and was only
the ripples at a different moment (the old build's freeze let less water
time pass); redrawing the shadows for every face changed nothing, which ruled
the shadows out first.

Tests pass (668); 23 of 23 smoke journeys (all but `floodlit-night`, which is
held back on this machine at the owner's request).

## Plays like, by geometry (10 October 2026)

**What it is.** Under the yards to the hole the flag marker says what the shot
plays like: the distance it would be on level ground, in still air, at sea
level, at the model's default 18 °C -- the conditions the bag's stock carries
are calibrated in. Asked for by the owner, after Garmin's *PlaysLike*, which
its watch manuals describe as an adjustment for elevation change, wind speed,
wind direction and air density, shown as the adjusted distance to the green
([Garmin Approach G80 manual, *Viewing PlaysLike Distance*](https://www8.garmin.com/manuals/webhelp/approachg80/EN-US/GUID-5076AB95-3393-49CE-9FBE-29A25DDA0B32.html)).
Nothing numeric was taken from Garmin: it is the idea, not the arithmetic.

**How, and the rejected way first.** `src/plays-like.js`. The first version
SEARCHED FOR POWER: scale the club's ball speed until, in today's conditions,
the shot landed at the hole, then report that shot's carry on the level. The
owner asked for geometry instead, and the power search had a flaw of its own:
it flies a softer or harder version of the swing with the same launch and spin,
which no real swing produces. It also took 5 to 17 flights a time.

The geometric version flies the club in hand **once at full swing in today's
conditions**, over made-up open ground (two metres of tee, then a drop 120 m
deep, so the ball is never stopped and passes through any hole height), and
finds where the falling ball passes through **the hole's height**, measured
along the line to the hole. It flies the same strike **once in still air at
sea level** and finds where it falls back through the height it started at.
The hole's distance is scaled by the ratio of the two. Two flights, 5-10 ms in
Node. The made-up ground and its 2 m / 120 m are placed numbers; anywhere the
ball cannot be stopped would do. A hole higher than the ball can climb has no
crossing and gets no number; a putt gets none either.

**What it gives**, at each club's own stock distance (yards), on the model as
it stands:

| club, distance | level calm | 30 ft up | 30 ft down | 10 mph into | 10 mph helping | 1,600 m | 5 °C |
|---|---|---|---|---|---|---|---|
| 7 iron, 155 | 155.0 | 167.2 | 145.9 | 171.3 | 145.7 | 144.1 | 158.3 |
| driver, 250 | 250.0 | 264.6 | 238.8 | 268.9 | 237.0 | 235.6 | 254.5 |
| PW, 100 | 100.0 | 113.2 | 91.3 | 112.5 | 92.9 | 94.4 | 101.6 |

The rejected power search, 7 iron at 160 yd, for comparison: 168.6 up, 151.4
down, 183.2 into, 149.5 helping, 148.1 at 1,600 m, 164.2 at 5 °C. Into the wind
it read 12 yd longer than the geometry does, because a harder swing in that
search also flew higher into the headwind.

**Not checked against anything outside the game.** The familiar rules of
thumb (so many feet of rise to the yard, a percent per mph) are not sourced
here and were not used; the point of the feature is that it agrees with the
ball the game flies. Every number in the table is the model's.

**The keys that came with it**, from GSPro's shortcut list as two community
guides give it ([The Course Control, *GSPro Keyboard Shortcuts*](https://thecoursecontrol.com/guides/gspro-keyboard-shortcuts/);
[Launch House, *Aiming in GSPro*](https://www.launchhouse.golf/learn/gspro-aiming-guide/)):
A resets the aim, I and K change club, H hides the HUD, Tab shows the
shortcuts, F3 steps the camera to the aim point and the green. The guides
disagree on some keys (J, Q/W) and are one to six years old; only those five
were taken. F3 became G here because F3 is the browser's Find. GSPro's
rangefinder (R) was offered and the owner turned it down.

## The bag belongs to the player (12 October 2026)

The owner's request: each golfer builds their own bag -- their own clubs, named
by them, with their own distances -- saved with their profile and editable in a
round as well as from the profile, instead of the eight fixed clubs in
`clubs.js`. Built in `clubs.js` (`CLUB_KINDS`, `validateBag`, `bagClubs`),
`profile.js` (`bag` on a profile, `setProfileBag`, `adoptDistances`) and
`main.js` (*THE BAG IS THE GOLFER'S*, `renderBag`).

**A club is a name, a kind and a carry.** The kind decides launch angle, spin
and the code a launch monitor is told; the carry is what the player types, and
`bagClubs` solves the ball speed that carries it on level ground in still air
(the same 19-step bisection the old `customizeClubs` ran). So **a kind can move
apex, descent and roll but never the yardage**, and choosing the "wrong" kind
for a club costs shape, not distance. The eight stock kinds keep their exact
launch and spin, and the stock bag solves to the same ball speeds as before
(`tests/bag.test.mjs` compares them to the old function).

**The eleven added kinds are placed, not published.** No source was fitted.
Irons and wedges between two stock clubs take the halfway launch and spin (6
iron 18.5° / 5,650 rpm between the 5 and 7; 8 iron 22.5° / 7,250; gap wedge
32.5° / 8,750). Woods, hybrids and long irons sit between the 3 wood (14°,
3,500 rpm) and the 5 iron (17°, 4,800), irons spinning a little more than woods
at the same launch: 5 wood 15° / 4,000, 7 wood 16° / 4,400, 3-5 hybrids 15-17°
/ 4,300-4,900, 3 iron 14.5° / 4,300, 4 iron 15.5° / 4,550. The lob wedge carries
the sand wedge's trend one step on: 38° / 8,200. Anyone fitting these against
measured data (Trackman's amateur tables, the owner's R50 sessions) should
replace them; the stock eight are the ones the flight model was refitted
around (*Ball flight, after the GC3 session*).

Every kind at its default carry, flown by the model over flat fairway in still
air at 18 °C (scratch run, 12 October): apex rises gently through the woods
(97-102 ft) and irons (91-98 ft) and falls through the wedges (80 ft PW to 39 ft
LW); descent steepens from 40° (driver) to 51° (9 iron, PW); roll falls from
21.9 yd (driver) through 13.8 (5 iron), 8.5 (7 iron) and 3.4 (9 iron) to about
1.2-1.5 yd for every wedge. No kind breaks the ordering of its neighbours, and
every one carried its typed distance to 0.1 yd.

**Fourteen clubs at most**, from the Rules of Golf (Rule 4.1b), which also
keeps the editor and the club picker a sensible size. A bag needs exactly one
putter (whose id is always `putter`, because the game asks "is this the
putter?" by id in a dozen places) and at least one other club. Names must
differ, ignoring case, because a name is what the picker, the shot list and the
dispersion legend show -- two clubs of one KIND are fine (a 50° and a 54° both
as wedges). Carry 10-400 yd; putter roll 1-100 yd, the old limits.

**Launch-monitor club codes: a dead end, recorded so nobody repeats it.** The
game sends the club to the bridge as GSPro's `Player.Club`. [GSPro's Open
Connect v1 page](https://gsprogolf.com/GSProConnectV1.html) shows only one
value, `"Club": "DR"`, in a sample response, and says the player block is
"typically used for Launch monitors that need to switch between full strike
clubs and putting". A web search on 12 October found no published list. The
stock clubs already sent `DR`, `3W`, `5I`, `7I`, `9I`, `PW`, `SW`, `PT`; the
added kinds follow that pattern (`5W`, `7W`, `3H`-`5H`, `3I`, `4I`, `6I`, `8I`,
`GW`, `LW`) rather than guessing another format. `PT` is the one that changes
what a device does.

**The bridge was never told about the added codes (found 13 October 2026).** It
checked `Player.Club` against a typed list of the eight stock codes and closed
the browser's connection on anything else, so the eleven codes above cut the
game off from the bridge the moment one was picked -- monitor or no monitor.
Nothing outside the game was ever asked about them. The bridge now reads its
list from `CLUB_KINDS` (all nineteen codes), and an unknown code is ignored
rather than fatal (PROJECT_HANDOFF, *passes on every club a bag can hold*).
Whether a given connector makes anything of `4I` or `GW` is still unknown --
no hardware has been tested here -- but at worst it ignores them, as it would
any club field it does not use.

**Rejected: keeping a round's own copy of the bag.** The old rule was that a
round resumes under the bag it was saved with, because the bag was one setting
for the whole device and could change between sessions. Now the bag is the
golfer's, so a round uses each golfer's bag as it is now, and a bag travels in
the profile and its backup file. A round from another device whose golfers are
not here plays the distances it carried (`clubYardages`, still in `PLAY_KEYS`
for that reason), or the stock bag.

**The old distances convert once.** They lived in the round slot's settings;
at startup, if they are there, every golfer without a bag gets them as a bag
(`adoptDistances`), and they are deleted from the settings. A golfer who
already built a bag keeps it.

## Nothing stands in what a tee sees (12 October 2026)

The owner: bushes and houses sit in front of tees and block the view.
Measured with `node tools/bench.mjs teeclear --set trees=65 --set homes=true`
(12 standard-tier courses, three biomes by four seeds), counting with the new
`blocksView` against the finished world: **232 bushes** (of 5,223) and **4
houses** (of 120) had their tops above the line from a golfer's eye (1.6 m,
`TEE_EYE`) to the ground at the tee's target, inside the tee's forward wedge
(10 m either side at the tee, widening 9° each side -- the tee fan's own
numbers). All of them were in Pacific Northwest, Mountain and Links, the three
biomes the standard tier plants.

**Why it happened.** Planting refused trees by the shot test (`blocksLaunch`,
whether the BALL meets them) and the tee fan (anywhere in front, whatever the
height) -- but skipped both for bushes. The shot test alone would not have
helped: twenty metres out the nominal drive is already about ten metres up, so
a bush or a house passes it. Houses were checked only against a 28 m circle
round each tee.

**After** (`blocksView` in planting and house siting, GENERATOR_VERSION 35):
both counts zero, held as `teeclear` invariants. Bushes 5,223 -> 5,127 (-1.8%);
houses 120 -> 112, more than the 4 that blocked, because a candidate house is
judged at the tallest a house is built (11 m) before its own height is drawn.
Every other bench figure at the full tier (171 of them, 40 courses) was
identical before and after, compared commit against commit; the saved baseline
predates the ninth biome and could not isolate the change.

**Placed, not published:** the 1.6 m eye height is the existing `TEE_EYE`;
sighting to the ground at the target rather than to a point above it is a
choice -- the line any player looks along to see where the ball lands.

## Spin-back reined in: research and a plan (13 October 2026)

The owner: the zip-back is insane and must come down massively. An 8,500 rpm
wedge should check on a normal green and not come back; zip-back should start
around 10,000 rpm unless the descent is very steep; Burnt almost impossible,
Firm a small amount, Normal a balance, Soft the most. This entry is the
research and the measured plan; **nothing in the physics has changed yet** --
the owner reads the plan first (TODO, *Spin-back rework*). The report with clips
is local, `docs/reports/backspin/` (`tools/landing-report/spin-*.mjs`).

### What the ball does today

Flat green, Stimp 10, a full wedge solved to a 100 yd carry at 31 degrees
launch (83-87 mph; lands at about 52 degrees). Yards the ball rolls back from
the furthest point it reached:

| launch spin | landing spin | Soft | Normal | Firm | Burnt |
|---|---|---|---|---|---|
| 7,000 | 6,273 | 0.3 | 0 | 0 | 0 |
| 8,500 | 7,608 | 3.7 | 1.2 | 0.4 | 0 |
| 10,000 | 8,940 | 10.6 | 5.4 | 2.5 | 1.0 |
| 11,000 | 9,828 | 14.7 | 10.0 | 5.8 | 2.5 |
| 12,000 | 10,718 | 18.2 | 14.2 | 10.3 | 6.0 |

A steeper wedge (70 yd, 42 degrees launch, 56 degree descent) at 10,000 rpm
comes back 13.3 / 9.4 / 6.5 / 4.0. The stock keyboard wedges (8,200-9,000 rpm)
come back 6.9-9.6 yd on Soft and 2.5-5.3 on Normal. Against the one published
distance -- a tour player's maximum of 15-20 ft, 5-6.7 yd (*Re-anchored to
reality*) -- that is two to three times too far. The 2 October fit said a
10,000 rpm wedge came back 2.2 yd on Normal; the flight refit of 6 October
delivers more spin to the green (*spinTau*). It checked one shot -- a tour
pitching wedge on Soft, 2.4 -> 4.6 yd back, accepted -- and not the
higher-spin wedges, which is where the come-back grew most.

### Where the come-back is made

Traced, a 10,000 rpm wedge on Normal: it leaves the first bounce at **1.03 m/s
forward still carrying 3,119 rpm** (35% of its landing spin), hops 0.92 m high
for 0.85 s, the second bounce reverses it to -1.25 m/s, it skids up to -2.09
m/s and then rolls back on the Stimp 10 green for four seconds. Final: 4.1 yd
behind its pitch mark.

What sets the backward speed is a conserved quantity: while friction acts at
the contact, `gain x forward - R x backspin` does not change, so a ball that
reaches rolling ends at `(gain x v - R w) / (gain + 1)`. Two things hand it too
much: the landing's spin gain on a green (1.61, scaled by firmness to 1.37 Soft
... 2.02 Burnt) leaves too much spin, and **the small slow bounces after it use
the same reduced gain** -- which `SPIN_GAIN` justifies by the cover squashing
and the patch spreading at full impact speed, and which is not true at 4 m/s.
At gain 2.5 the same ball would leave its second contact at -1.63 m/s; at 1.61
it leaves at -2.05, and the roll-back distance goes as the square.

### What the sources say

- **No measured table of spin-back distance against spin and firmness exists**
  that could be found (journals, Trackman, coaching sites, simulator forums).
  The tour maximum of 15-20 ft stays the only distance anchor.
- **Haake** (Science and Golf II, 1994; 721 filmed impacts on 18 courses): two
  kinds of green. On one the ball left with topspin; on the other it kept
  backspin if its landing backspin was large enough -- quoted second-hand as
  about **350 rad/s (3,340 rpm)**. Backspin was retained on greens that were
  **freely drained with little Poa annua**. One of his impacts, quoted in a
  modelling paper: **18.6 m/s at 44.4 degrees with 484 rad/s (4,622 rpm)
  left at 5.1 m/s, 33.0 degrees, with 145 rad/s of topspin** -- no come-back.
  The two figures are second-hand and flagged so.
- **Biber, Champneys and Szalai** (arXiv:2208.11685, already the basis of
  contact.js), on bounce data: balls landing with large backspin slip all
  through the contact and leave with reduced backspin; the rest leave with a
  little topspin; almost none leave rolling.
- **Roh and Lee** (via the summary above): a backward bounce needs a
  near-vertical impact or a large spin compared with the landing speed. The
  owner's "unless the descent angle is very steep" is this.
- **Proc. IMechE Part P 239(3), 479 (2025)** (DOI 10.1177/17543371221150289),
  abstract only: stopping distance falls with more backspin and steeper
  incidence, until excess spin or steepness makes the ball come back; green
  firmness needs more data.
- **Titleist slow motion** (already recorded): first bounce forward, about 13
  backward revolutions in the air, reversal from the second bounce. Thirteen
  turns at any spin that can still bring a ball back is a fraction of a second:
  **a first hop of inches**. The model's is 0.92 m (3 ft) and 0.85 s -- about 44
  turns at its retained spin. A separate defect, recorded, not fixed here.
- **Firmness disagrees between sources.** Coaching sources (Caddie HQ, already
  recorded) say a soft receptive green grips and spins back; Haake's retaining
  greens were the drained, firmer ones, and golfers on forums (golfmonthly,
  thesandtrap) say soft wet greens swallow the ball while dry hard ones spin it
  back. **The owner's ladder (Soft most) is followed as a game choice**, and is
  written down as one.
- Spin rates: Trackman tour 9 iron 8,793 rpm, 7 iron 7,124 (Trackman spin-rate
  blog); full 50-60 degree wedges 9,000-12,000 (SkyTrak). Simulator forums
  (The Golf Club, Garmin R50) complain of too little spin-back, never give a
  number; read and set aside.

### The targets (placed, from the owner's description)

Same wedge, flat, Stimp 10, yards back: 7,000 -- 0 everywhere. 8,500 -- Soft
0-0.3, others 0. 10,000 -- Soft 1-1.5, Normal up to 0.5, Firm 0-0.2, Burnt 0.
11,000 -- 2.5-3 / 1.5-2 / up to 1 / up to 0.3. 12,000 -- 5-6 (the tour maximum)
/ 3-4 / up to 2 / up to 0.5. Steep 10,000 -- about 2 / 1 / 0.5 / up to 0.5. And:
the first bounce goes forward; a 7,000 rpm 7 iron stops about where it does
(6.9 yd past its mark on Normal). **Every number here is placed, not
published**, except the 5-6 yd ceiling.

### Two candidates, measured

Both: the green's spin gain moves smoothly from its landing value to the rigid
2.5 as the impact's normal speed falls from 15 m/s to 0, and the landing value
becomes a table by firmness on the same inch scale as `BOUNCE_BY_FIRMNESS`.

- **keep-hop**: landing gain Soft 1.75, Normal 1.95, Firm 2.15, Burnt 2.45;
  green friction x1.1; ploughing unchanged.
- **hold-iron**: landing gain 1.8 / 2.1 / 2.35 / 2.5; friction unchanged;
  `PLOUGH_BY_FIRMNESS` 0.394 x 2.4 / 2.2 / 2.0 / 1.6.

| | today | keep-hop | hold-iron |
|---|---|---|---|
| wedge 8,500 Normal, back | 1.2 | 0 | 0.1 |
| wedge 10,000 S/N/F/B, back | 10.6/5.4/2.5/1.0 | 1.2/0.5/0.1/0 | 1.4/0.6/0.1/0.1 |
| wedge 12,000 S/N/F/B, back | 18.2/14.2/10.3/6.0 | 5.0/3.7/2.2/0.7 | 6.1/3.5/2.0/1.3 |
| steep 10,000 S/N/F/B, back | 13.3/9.4/6.5/4.0 | 1.7/1.3/0.9/0.4 | 1.9/1.0/0.5/0.7 |
| wedge 8,500 Normal, first hop forward | 1.0 yd | 0.5 | 0 |
| 7 iron 7,000 S/N/F/B, finish past mark | 3.8/6.9/9.7/12.9 | 7.3/10.2/13.1/16.5 | 3.3/6.5/10.0/14.0 |
| 56 deg chip (22 mph, 36 deg, 1,150 rpm) Normal, roll | 9.9 | 12.7 | 10.8 |

**The trade is structural.** In this model less come-back, a 7 iron that stops
and a forward first hop cannot all be had: more spin taken at the landing
leaves more forward speed (the 7 iron runs), and whatever takes that speed back
-- ploughing or friction -- also takes the first hop's. About 150 combinations
of landing gain (1.5-2.5), ploughing (x0.8-2.2) and friction (x1.0-2.0) were
run on Normal; none met all three. Recommended: keep-hop, with the 7 iron
revisited in the first-hop job.

### Rejected, with the numbers

- **Landing gain alone** (no friction or ploughing change): Normal 10,000 back
  0.4 at gain 2.0 but the 7 iron runs 12.0 yd (gain 2.2: 14.1).
- **The slow-bounce rule alone**: Normal 10,000 back 5.1 -> 2.5, 12,000 14.2 ->
  10.1; the 7 iron +0.6 yd. Half the job.
- **Speed-dependent roll resistance on the green** (`ROLL_SPEED_GAIN`, which
  only acts above the Stimpmeter's 1.83 m/s, where a 7 iron rolls and a wedge
  coming back does not): k = 1, 2, 4, 6 moved the 7 iron 12.0 -> 11.8 -> 11.5
  -> 11.2 yd at gain 2.0. Its release is the bounces, not the roll.
- **A lower first hop** (`corScale`, `tiltScale` 0.3-0.5, toward the footage):
  the 7 iron runs further, 12-20 yd, because speed that no longer goes up goes
  forward; the come-back became erratic (Normal 12,000: 0.0 to 12.6 yd as gain
  moved 1.61-2.5).
- **Much more friction** (x1.3 and up): the come-back vanishes (12,000 Normal
  0.1-0.8) and so does the first hop (0.1-0.2 yd).

### Built (13 October 2026): the owner's choices, a lower first hop, refitted

The owner chose **keep-hop**, asked for **about 4 yd of come-back at 12,000 rpm
at most** (Soft), kept **Soft spinning back most** ("how many sims treat it"),
and asked for the **first hop to come down** ("way too high"), refitted back to
the targets after it. Built in physics.js as `SPIN_BY_FIRMNESS` (spin taken at
the landing, a multiplier on the surface's `spin`; replaces `spinScale` and
`SPIN_SCRUB` in firmness.js) and `LANDING_SPIN` (below `slowBounce` m/s into the
turf the transfer rises linearly to the rigid 2.5 at rest; greens and collars
only), fitted with `tools/green-fit.mjs`.

**The first hop, measured.** Haake's impact on a green (above) run through the
model: it left at 3.88 m/s up and 3.73 forward on a Normal green (a 2.5 ft hop)
against Haake's 2.78 up and 4.28 forward (about 1.3 ft) -- **the model's hop was
twice the measured one**. The fairway, fitted to measured tee turf
(arXiv:2302.02758 / Biber et al., Sports Engineering 2023, 693 bounces on a
well-maintained teeing area and 330 on artificial turf; no green in either
campaign), gives 3.43 up for the same impact. Fitting a tee-turf model to that
dataset gives roughly a 2.4 ft hop for a 52 degree wedge landing; a measured green
is lower. So the green now bounces BELOW a fairway, which the ground half of
ploughing already said (a watered sand rootzone against native soil). Haake's
point is held as a band, 3.6-4.6 forward and 2.5-3.1 up: one bounce, on one of
his two kinds of green.

**The fit**, pattern search over the green's `cor`, `tilt`, `mu`, `spin`,
`PLOUGH_BY_FIRMNESS` (one value), the Soft/Firm/Burnt multipliers and
`slowBounce`, against: the owner's come-back table with 12,000 rpm on Soft at
3.6-4.2 yd and the rest scaled down; a steep wedge; the 7 iron allowed about 3 yd
more than before (the keep-hop cost the owner accepted); an 8,500 rpm wedge's
first hop at least 0.4 yd forward (weighted hard: the owner's priority over the
7 iron); Haake's band; two chips and four pitches near their old run-outs.

| | was | now |
|---|---|---|
| green cor / tilt / mu / spin | 0.1491 / 0.1333 / 0.377 / 1.61 | 0.1294 / 0.0883 / 0.4273 / 1.8914 |
| fringe (same ratios) | 0.1403 / 0.122 / 0.399 / 1.7 | 0.1218 / 0.0808 / 0.4522 / 1.9971 |
| PLOUGH_BY_FIRMNESS | 0.394 | 0.6824 |
| spin by firmness S / N / F / B | spinScale: 0.85 / 1 / 1.12 / 1.25 | 0.9423 / 1 / 1.1217 / 1.2475 |
| slow-bounce speed | -- | 8.15 m/s |

Flat green, Stimp 10. Yards back from the furthest point (wedge solved to 100 yd
at 31 degrees, landing at 52):

| launch spin | Soft | Normal | Firm | Burnt |
|---|---|---|---|---|
| 8,500 | 0 | 0 | 0 | 0 |
| 10,000 | 0.6 | 0.3 | 0 | 0 |
| 11,000 | 1.8 | 1.3 | 0.4 | 0 |
| 12,000 | 4.4 | 3.2 | 1.4 | 0.5 |
| steep (56 deg) 10,000 | 1.2 | 1.4 | 0.7 | 0.3 |

- **First hop** (8,500 rpm wedge): 1.4 / 1.9 / 2.2 / 2.4 ft from Soft to Burnt,
  was 2.2 / 3.0 / 3.4 / 3.7; it goes forward 0.3 / 0.8 / 1.2 / 2.0 yd.
- **Costs**: a tour 7 iron (115.9 mph, 16.3 deg, 7,000 rpm) finishes 9.0 / 10.8 /
  13.7 / 16.2 yd past its mark, was 3.8 / 6.9 / 9.7 / 12.9; a 50 yd pitch (6,500
  rpm) 7.9 / 9.6 / 12.2 / 14.5, was 4.7 / 6.2 / 8.5 / 11.4; chips +0.3-1.2 yd.
  The stock keyboard 7 iron now runs further on a Normal green (10.3 yd) than on
  a fairway (8.5).
- **Steep Normal (1.4) sits slightly above steep Soft (1.2)**: the ladder holds
  at every full-wedge spin, not quite at 56 degrees. Left: inside 0.2 yd.
- A shot with an implausible 182 rpm per mph (55 mph, 10,000 rpm) still comes
  back 4.9 yd on Soft; real inputs do not reach it.

**Rejected on the way.** The first fit, without pitches, put `slowBounce` at
16.4 m/s and ran a 50 yd pitch 12.5 yd (6.2 before): every pitch lands at 8-15
m/s into the turf, so it was charged the near-rigid transfer meant for the small
hops. With pitches in the targets it settled at 8.15, below a 50 yd pitch's 10.6
and a full wedge's 17. Two earlier fits that weighted Haake's forward speed as a
point and the 7 iron at its old 6-7.5 yd flattened the wedge's first hop to
nothing (0.07 yd forward) -- the same three-way trade as before, decided the
owner's way.

**Every other surface is unchanged to the hundredth** (driver, 3 wood, 5, 7 and 9
irons, pitching wedge, a chip and a 50 yd pitch onto fairway, tee, semi, rough and
sand, compared with main): a driver into a fairway still releases 23.4 yd from a
3.70 ft hop. That hop is the fairway's fit to the measured tee turf and was left.
Into the collar the driver runs 23.3 (was 25.9) and hops 2.46 ft (4.21).

## Sound: the synthesised soundscape (13 October 2026)

The owner asked for sounds: ambience that does not sound like a file on
repeat (birds, aircraft, wind, water), a sound for the driver, a wood, an
iron, the putter and a chip, a landing for each turf, and hits on trees and
rocks. Any asset had to be CC0 with proper credit, and synthesis was allowed.
Nothing goes into the game until the owner has listened and the sounds have
been iterated: the listening report is `docs/reports/sounds/index.html`
(local), built by `node tools/sound-lab/build.mjs` from the synthesiser,
first `tools/sound-lab/synth.js` and, once the sounds went into the game,
`src/sound.js`.

### Why synthesis rather than recordings

**Everything is synthesised; no recording is used.** Three reasons, in order:

- **It cannot loop.** A recording is a fixed length, and a long one still comes
  round again. Here the ambience is a set of random processes: a gust model over
  noise, individual birds that arrive, sing in bouts and leave, a stream made of
  separate bubbles, planes flown along a computed path. Strikes and landings
  re-detune their tones on every play, so even a repeated shot is not the same
  sample twice.
- **Each sound follows the game.** Head speed, landing speed, distance from the
  camera, the biome's temperature and the course's wind all change the sound,
  which a sample can only approximate with pitch-shifting.
- **Nothing to license, and nothing large to ship.** The owner's rule (CC0 and
  credited) is met trivially, and the single-file build grows by code, not
  audio files.

**CC0 recordings were not used for round 1**, and are now offered beside the
synthesis for comparison (round 2, below, at the owner's request): the report
streams Freesound's previews of 41 checked CC0 recordings; nothing is
downloaded. Any one chosen would be credited in ATTRIBUTION.md.

### What each sound is built from, and the numbers behind it

| Sound | Built from | Anchored to |
|---|---|---|
| Driver | Damped tones at 3.35-8.3 kHz (take A, strongest 4.15 kHz, decay time-constants 12-50 ms), a 4 ms crack, the ball's tick at 1.5 kHz, a 220 Hz thump | Titanium driver strike centred near 4.5 kHz, about 120 dB peak, under 0.2 s long (Park et al. 2018). Patents on club-head sound put the head's loudest peak in 3-5 kHz and the ball's sound near 1.5 kHz. The individual modes are PLACED |
| Fairway wood | Tones 3.9-7.4 kHz, shorter, plus a sole brush | PLACED: smaller head, higher and shorter than the driver |
| Swing whoosh | Noise darkened below 2.5 kHz through a narrow band (Q 6) whose centre climbs from 0.45x to 1x into the strike and falls to 0.55x after it, over a wide band at 0.6x; centre 150 Hz + 14 Hz per m/s of head speed (about 780 Hz at 100 mph) | PLACED. Round 1 was one wide band (Q 1.6) of white noise at 250 + 22 Hz per m/s; the owner heard it as hiss |
| Iron | No metal ring (round 2, from the owner: an iron is a crack and the ball, not metal): a 2.5 ms crack above 2 kHz, a 7 ms band at 3.6 kHz, the ball's tones at 1.7, 2.9 and 4.3 kHz damped within 2 ms; then the divot: a 95 Hz thump, grass tearing (band noise 1.8 to 0.9 kHz over 110 ms), clods landing 0.2-0.6 s later | PLACED. Round 1's ringing head (tones 2.6-6.8 kHz, 3-8 ms) is kept only as take C, the owner's round-1 setting |
| Chip | A brush of grass 30 ms before contact, a soft click (1.8-5 kHz), a brush after | PLACED |
| Putter | Putter tones below 2 kHz (1.35, 1.15 or 0.9 kHz by take), ball tones at 2.5-3.7 kHz | Barrass, Roberts and Jones (2006): in a putt, the 0-2 kHz band follows the putter and where it was struck; the 2-4 kHz peaks follow the ball's compression; the "sharpest" balls had the higher peak. A putter patent measured about 1.4 kHz |
| Turf landings | A thump whose pitch falls (105-220 Hz, firmer is higher and shorter), the ball's 1.5 kHz tick (louder on firm ground), noise for grass | PLACED by surface: green, fringe, tee, fairway, semi, rough, sand, water -- the eight surfaces `localSurface` returns |
| Water | A slap, a sheet of spray, a rising "plunk" (300 to 660 Hz) as the cavity closes, then 24-36 bubbles of 1-9 mm radius and drops falling back | Minnaert: a bubble of radius r rings at about 3.26/r Hz (1 mm, 3.26 kHz). Bubbles as the building block of liquid sound, with a rising pitch near the surface: van den Doel (2005). How far the pitch rises (1.05-1.6x) is PLACED: the paper's own figure could not be confirmed (the PDF did not extract) |
| Trees, rocks | Trunk (round 2, from the owner: "like hitting a solid pine board"): a 2 ms crack, a 6 ms band at 3.2 kHz, wooden tones 620-4,200 Hz dying in 2.5-12 ms. A canopy is leaf ticks, twigs and a swish, then the ball dropping 8 m to the turf; rock is tones at 1.3-7.6 kHz with a hard crack | PLACED. Round 1's hollow trunks (260-2,900 Hz, up to 40 ms) survive only as the palm take |
| Cup | The ball drops about 0.1 m (1.4 m/s) onto the plastic floor: a 4 ms "tok" near 1.7 kHz, a short hollow tone near 640 Hz and its 3x partial, then up to five bounces shrinking by a restitution of 0.45 (0.13 s, 0.06, 0.03...), now and then a click off the wall. A flagstick is a dull fibreglass knock with a ferrule chatter | Hole 4.25 in (108 mm) across, at least 4 in (101.6 mm) deep; liners are moulded plastic with drain holes, some aluminium (USGA rule as summarised; liner patents US7959516, WO2008147581). The 640 Hz is a quarter wave of the 0.1 m tube with the open-end correction (0.6 x radius). The restitution is PLACED. Round 1 rang 640 Hz for 30 ms and the owner heard nothing like a cup |
| Wind | Low rumble, two narrow whistles and a leaf rustle shaped by what grows in the biome, all driven by a gust process (relaxation 0.15/s, spread about 35% of the mean, plus a faster flutter at 1.5/s) | PLACED. Level follows the game's wind in mph |
| Birds | Songbirds (round 3, measured): notes of 30-100 ms, 50-160 ms apart, 2-8 to a song, from a base of 3.4-5.2 kHz, a song kept per individual for life, bouts of 1-3 songs 3-8 s apart. **One bird at a time** (owner, round 2): a song starts only when the last has ended plus 0.6 s, a bird that comes due meanwhile is dropped, bouts of 1-3 songs 4-10 s apart; about one bird every 25 s by day (round 1: one every 8 s, bouts overlapping). Calls (crow, raven, gull, goose, desert wren): a sawtooth through voice-like filters, roughened; geese honk one at a time too. The skylark was removed (owner: annoying, too long and not what one sounds like) | Songbirds mostly 1-8 kHz (All About Birds). Black-capped chickadee "fee-bee" placed at about 3.9 then 3.4 kHz |
| Mourning dove (round 3) | "cooOOoo-wooo-woo-woooo": an opening of 0.9-1.2 s climbing from the base to 1.18-1.26x and back, then coos of 0.75-0.9, 0.45-0.55 and 0.65-0.8 s, 0.25-0.35 s apart, about 4.1 s in all; base 455-520 Hz; bouts of 3-5 songs 5-9 s apart; a near-pure tone (3% octave), 60-80 ms onsets, a breath of band noise at 5% | Measured on three CC0 recordings (round 3, below): base 474 and 517 Hz, the opening rising to about 1.2-1.25x, songs 4.1-4.4 s, 4.4-8.8 s apart. The phrase as Wikipedia gives it. The closed-bill coo radiates through an inflated oesophagus that filters out the harmonics (Fletcher et al., ring dove). Round 2 used one published sonogram (390 Hz, 650 Hz high note) and sang 370-410 Hz with a 1.6x leap in 3.4 s |
| Crickets (round 2) | A chorus of 4-6 tree crickets chirping together: 8 pulses grouped 2+3+3 (pulses 12 ms, the last of each group 15-16 ms) at a 19 ms pulse period, each pulse sagging 2.5% in pitch with a faint octave; members within about 12 ms of a leader that changes every 20 chirps. At 18 C and up, 1-2 field crickets over them: 3 pulses (sometimes 2 or 4) of 18 ms at a 30 ms period, 4.5-5 kHz, 1.2-2.5 chirps a second on their own clocks | Chirp rate: Dolbear (1897), chirps per minute = 4 x (temperature F) - 160, holding from about 55 F (13 C), so Mountain (11 C) and Haunted Hollow (9 C) are silent. 8 pulses, the last of each group longer: snowy tree cricket (NPR, Symes; Orthoptera Species File). The 2,3,3 grouping and about 52 pulses a second: Riley's tree cricket (2.7 kHz at 25 C). Carrier 3,000 Hz at 15 C rising to 4,600 at 32 C: O. nigricornis, borrowed for the chorus as 3,000 + 94 Hz per degree. Synchrony: Walker (1969), Science 166:891. Field crickets: 2-3 pulses at a 30.2 ms period, 5.0 kHz (the Steppengrille); G. bimaculatus 5 kHz. Round 1 was 3-4 pulses at 2.8-4.6 kHz with every cricket on its own clock |
| Cicadas | Band noise near 5-6 kHz pulsed at 160-260 Hz, swelling over 8-18 s; only at 24 C and above | PLACED |
| Planes | A jet: broadband rumble (low-pass 900 Hz), 1.5-4 km up at 110-190 m/s. A small propeller plane: an 75-95 Hz buzz with harmonics, 250-700 m up at 45-65 m/s | Geometry, not ear: sound arrives r/c late, so the loudest moment comes after the plane is overhead; a propeller's pitch falls by Doppler; and the ground reflection, with an ear 1.6 m up, is a copy delayed by 2 x 1.6 x sin(elevation) / 343 s, up to about 9 ms overhead, which sweeps a comb through the noise -- the falling "whoosh" of a passing jet (windytan 2025; SFU comb-filter handbook). A little jitter on that delay stands in for turbulence, which DAGA 2021 found removes the "unnatural flanging" of a clean model |
| Water by distance (round 2) | Every water sound goes through one gain: full within 25 m of water, falling as 25/distance, times (1 - (d/300)^2), silent from 300 m; water events are not scheduled at all when silent | PLACED. The owner: water only when the ball is close to it |
| Distance | Level falls as 1/distance (1 at 10 m); treble falls with distance | PLACED: a low-pass reaching about 8 kHz at 100 m, 2 kHz at 1 km and 850 Hz at 3 km, the shape of ISO 9613-1 air absorption at 20 C and 70% humidity rather than its figures |
| Strike loudness | Level as (head speed / 100 mph)^0.8; brightness as (speed / the club's default)^0.35 | PLACED so a 4 mph putt is about 20 dB under a 100 mph drive and still audible |

### Measured levels (tools/sound-lab/check.mjs, limiter off)

Round 1 peaks at the default settings, 13 October 2026: driver -1.7 to -2.8 dB,
fairway wood -4 to -5, iron -6, chip -13 to -22, putter -23 to -27; turf
landings at 12 m about -16 to -24 dB; water -13 to -16; trunk and rock -12 to
-18. A 30-60 s ambience averages -33 to -44 dB with peaks near -15 to -27; a jet
alone peaks at about -22 dB and a propeller plane -21. **The first pass was 7 dB
over full scale on the driver** (the golfer was placed 4 m from the listener,
which doubles the level twice over) and the limiter had hidden it; check.mjs
turns the limiter off for that reason. **Lake lapping first measured -66 dB**,
which nobody would hear, and was raised about 17 dB; the links surf about 6 dB.

**A bug worth remembering:** the wind slider's mph was also being read as a
mix multiplier, so 8 mph played as 64. The gust readout said 121 mph. The wind
is now one number with one meaning (`windMph`), outside the mix.

### Round 2: the owner's first notes (13 October 2026)

The owner listened to round 1 and sent notes and slider settings (kept in
the conversation, not committed). In short: the swing whoosh sounded like
white noise; the driver wanted "a higher pitch around 3500 Hz"; the wood was
"pretty decent"; irons needed to be "much more cracky" with no metal in them;
the chip and putter were good; the trunk should crack like a solid pine
board; the cup sounded nothing like a cup; birds came too often and should
never overlap; the skylark was annoying and wrong; the dove and crickets were
close but not right; water should be heard only near water; and CC0
recordings should be looked at too.

**How round 2 is laid out.** The owner's sliders are baked into the takes (a
take carries `base` knobs; the report's sliders multiply on top, so 100%
means "as the take is"). Take A is the owner's round-1 setting wherever they
tuned a sound. On the turf sounds B moves every slider they touched half as
far again (each multiplier raised to the power 1.5) and C goes half way back
(power 0.5): their moves were the same on every turf -- shorter, more of the
ball's tick, less thump, more grass, darker -- so B is the likeliest next
step. The report's saved state moved to a new key (v2), because applying the
old sliders on top of takes that already contain them would double them.
Sliders the owner pinned at an end now reach further (length down to 20%,
crack and texture up to 400%).

**The driver contradiction is asked, not resolved.** The note said "around
3500 Hz"; the Pitch slider went to its top, which moved the main ring from
4.15 kHz to 6.6 kHz. Take A is the slider and take B the note (main ring at
3.5 kHz, same crack and short ring). The published centre for a titanium
driver is near 4.5 kHz, between the two.

**Semi-rough and rough had no ball tick**, so the Crack slider the owner
raised on both did nothing. A light tick was added to each, so take A now
does what the slider asked for.

**Research for the dove, the crickets and the cup** is in the table above.
Two things looked up and not used: Bessey's 1897 refit of Dolbear's law
(the difference is inaudible), and "300-600 Hz from a Berkeley study" for the
mourning dove, repeated on several pages with no traceable source.

**CC0 recordings: what exists.** Freesound was searched with its CC0 filter
(`license:"Creative Commons 0"`, sorted by downloads) for golf strikes,
swings, putts, the cup, splashes, wood and rock hits, golf-course ambience,
birds, the mourning dove, crickets, wind, streams, surf and planes. 41 were
kept, each licence read on its own page on 13 October 2026, and listed in
`tools/sound-lab/cc0-candidates.json` with author, length and preview link.
The report plays the previews beside the synthesis. What was found:

- **Golf**: real CC0 driver strikes exist (Scottrex05, Jarryd28, a series of
  16 short drives by zolopher, inbeeld at 2 m), a few putts, and two
  recordings of a ball into a hole (inbeeld, Scottrex05). **No CC0 iron or
  chip recording that could be trusted**: the only "iron" hit, yukon456's
  chip_9, says it was cut from a PGA TOUR YouTube video, so it was very
  likely not the uploader's to release, and it was set aside.
- **Nothing for a ball hitting a tree or a rock**: the nearest are a knock
  on a wooden door and a hatchet on a rock.
- **Ambience recordings are plentiful but work against the brief.** They are
  fixed lengths (a 2-minute track repeats every 2 minutes), each adds about
  2 MB to the single-file game, and they carry whatever else was there --
  traffic, people, birds from the wrong continent. Recorded one-shots
  (strikes, putts, the cup) are the case where recordings could win: tens of
  kilobytes each, and three or four rotating takes with a little random
  pitch hide the repeat.
- Searches with several words often returned nothing on Freesound's CC0
  filter; single words ("golf", "dove", "creek", "airplane") did better.

**Water near the ball.** Every water sound now runs through one gain set from
the distance to the nearest water (table above). The report has a "Distance
to water" slider. In the game that distance comes from the ball (or the
camera) and the course's water bodies; see TODO, *Sounds*.

### Round 3: signed off, the birds measured, three new sounds (13 October 2026)

The owner: "I think I'm happy with the sounds with the settings in my copy."
Every club, every landing, the trees, the rock and the cup are now `FINAL` in
synth.js (now src/sound.js) -- the chosen take with the owner's sliders folded in, the only take
left, so 100% on every slider is exactly what they heard. Their final picks:
driver C (pitch 0.81 on top of C's 1.6, so the main ring sits near 5.4 kHz --
between the round-2 question's 3.5 and 6.6 kHz, and nearer the published
4-4.5 kHz centre than either), crack 4x on C's 3.5x, body 1.9x; wood B; iron B
(the crack with a full divot) with pitch 1.47 and crack 2.95; chip B (out of
the rough); putter B (milled blade); green B, rough B, semi A, sand A, trunk
A (the pine board, crack 4x, length 0.2), rock C, cup A (pitch 0.67, length
1.55). **The driver as signed off peaks +13.5 dB before the limiter**: the
limiter shapes it into what the owner heard, so the game keeps the limiter
(TODO, *Sounds*). The trunk's Texture slider (2.65) moves nothing: the board
has no texture part. Both are kept as set, because that is what was heard.

**Water became a splash.** "I don't like that it's bubbly. It needs to be more
of a splash sound." The new recipe is a slap, a broad band of noise falling
from 1.4 to 0.7 kHz over about 0.18 s, a sheet of hiss above 2.5 kHz, the
spray falling back as a patter for half a second and bigger drops after, a
short low plunk at 140 Hz, and three faint bubbles where round 2 had 36
plus a dozen drops. PLACED.

**Decided**: in launch-monitor mode no club sounds, every other sound plays;
no crowd reactions; no ball-rolling sound; no CC0 recordings ("CC0 is gonna be
a bust"). The candidate list (`tools/sound-lab/cc0-candidates.json`) is kept as
the record of the search; the report no longer shows it.

**The birds, measured against the CC0 recordings** (the owner: "maybe listen
to these and adjust our bird sounds accordingly"). Each preview was decoded in
the browser and nothing was saved. An FFT of 2,048 samples at 44.1 kHz with a
512-sample hop; a frame counts as sound when its energy in the bird's band
stands 12-14 dB above the recording's 30th-percentile frame; frames closer
than 12-40 ms join into one note, and notes closer than 0.5-1.2 s into one
song. The previews are low-quality MP3 and the songbird recordings are
choruses of several birds, so the songbird figures are distributions across
a chorus rather than one bird's song -- good for the scale of things, not for
any one species.

| Recording | Notes | Songs | What it says |
|---|---|---|---|
| Mourning dove, nathankwright (74 s) | 23 | 6 | Base 474 Hz; the opening element 1.15-1.2 s rising to 560-580 Hz (about 1.2x); then coos of about 0.85, 0.5 and 0.67 s, 0.13-0.37 s apart (median 0.30); a song 4.1-4.2 s; 6.7-8.8 s of silence between songs; 4.9 songs a minute |
| Mourning dove, TRP (165 s, urban) | 95 | 15 | Base 517 Hz, high note 646 Hz (1.25x); the opening about 0.6-0.75 s (a short note, a quick rise, a falling high note); three coos of 0.37-0.57 s about 0.4-0.5 s apart; a song 4.4 s; 4.4-6.9 s between songs |
| Mourning dove, fauxpress (81 s) | 8 | 8 | Only the openings stood clear of the noise: 1.4 s at 474 Hz, falling to 452 |
| Spring birds, New Jersey (151 s) | 101 | 34 | Notes 46-93 ms (median 58); 54-212 ms apart (median 77); 3.4-5.9 kHz (10th-90th percentile, median 4.8); sweeps median 0.67 kHz, 90th 3.4 kHz; 1-4 notes a song (median 2), songs 0.2-0.7 s |
| Forest, spring afternoon (137 s) | 137 | 28 | Notes 46-70 ms; 64-135 ms apart; 3.4-4.5 kHz; sweeps 0.9-1.6 kHz; 2-7 notes a song (median 4), songs 0.2-1.2 s |
| Rocky Mountains, wind and birds (90 s) | 75 | 32 | Notes 35-70 ms; 62-224 ms apart; 3.9-6.2 kHz; mostly single calls |

What changed: **the dove** now sings at 455-520 Hz (was 370-410), rises only
1.18-1.26x on its opening (was 1.55-1.7x -- the round-2 figure came from one
published sonogram, 390/650 Hz, and three recordings outvote it), opens for
0.9-1.2 s, then three coos of 0.75-0.9, 0.45-0.55 and 0.65-0.8 s, 0.25-0.35 s
apart: about 4.1 s in all (was 3.4). A dove sings bouts of 3-5 songs 5-9 s
apart, as the recordings do. **The songbirds** now sing notes of 30-100 ms
(was 40-140), 50-160 ms apart (was 20-80), 2-8 to a song (was 5-12), from a
base of 3.4-5.2 kHz (was 2.6-5.0), with sweeps up to about 1.3x either way; a
songbird's bout is 1-3 songs 3-8 s apart. How often any bird sings is the
owner's round-2 rule and did not change: one at a time, about one every 25 s.

**Score stings** (new): one per score -- hole in one, albatross or better,
eagle, birdie, par, bogey, double bogey, triple or worse, matching scoring.js's
names (`scoreSting`) -- in three instruments: a marimba (partials at 1x, 4x
and 9.9x), bells (1x, 2.76x, 5.4x, with a slow beat) and a soft electric piano
(1x and a detuned 1.004x, 2x, 3x, a 7.1x tine). Good scores climb an arpeggio
in C major and finish on a chord; par is a settling fourth; bogeys fall a
third, double bogey a minor triad, worse a soft chromatic droop. **Level 0.14**:
at 0.32 the hole-in-one peaked 5 dB over full scale and every sting averaged
louder than a drive. PLACED throughout.

**The flagstick** (new): a dull fibreglass knock (420, 1,150 and 2,400 Hz,
damped within 20 ms), the metal ferrule chattering in the cup's socket four
times over 0.2 s, the flag snapping; a low hit near the cup rattles more, a
glancing one is a tick and the flag. **The house** (new): siding (a hollow
clack, tones 190-1,350 Hz), brick or stone (a hard thwack), a roof (a thunk,
then nine ticks of the ball rattling down the shingles) and a window (a glassy
tink; it does not break). PLACED.

### Round 4: everything signed off, and the sounds in the game (13 October 2026)

The owner's last picks: the marimba for every score sting, the ace, albatross
and eagle at pitch 0.8 and the ace's mallet at 2.15x; water take A (the
splash) at texture 3.4, body 1.95, pitch 0.83, length 1.65 over its round-2
sliders; the cup's length 0.95 on top of round 3's; the flagstick A at length
0.4, crack 3.95, pitch 0.76; and **one material for every house, brick**, at
pitch 0.66, length 0.3, crack 0.25, texture 1.95 (its Thump slider, 2.05,
moves nothing: the brick take has no thump). All folded into `FINAL`; every
sound the game can play now has exactly one take (`tests/sound.test.mjs`).

**How the game plays them** (`src/audio.js`; `src/sound.js` is the
synthesiser, moved from the lab unchanged, and the report now inlines it):

- **The strike** at the moment of the shot, keyboard shots only -- none from a
  launch monitor, the owner's rule. Which strike: driver, woods and hybrids,
  irons and wedges, putter; an iron or wedge whose head speed is under 55 mph
  is a chip (PLACED). Head speed is ball speed over a smash factor of about
  1.48 for a driver, 1.45 a wood, 1.4 a hybrid, 1.33 an iron, 1.2 a wedge,
  1.6 a putter (typical figures, PLACED; only loudness and brightness follow
  it). **The whoosh has a tenth of a second** (round 5, below): the lab plays
  the impact 0.45 s after the whoosh begins, but the game fires the ball the
  instant the key goes down, so in the game the whoosh rises over the last
  0.1 s into the crack and the follow-through carries on after it; the crack
  lands 0.1 s after the ball leaves. Delaying the ball to make room for a
  longer swing was rejected: it changes how a shot feels to play.
- **Every contact** -- each turf bounce, a trunk, a rock, a flagstick, a house,
  the water -- is recorded by simulateShot with its time, what was hit and the
  speed into it (`contacts`; the flight itself does not read it), and plays as
  the drawn ball reaches that moment. Its distance and side are measured from
  the camera, so a landing seen from the tee is quieter and duller than one
  the landing camera watches. A contact under 0.8 m/s is skipped (PLACED). A
  frame that jumps more than half a second (a skip) plays nothing. Rocks and
  a lit floodlight mast use the rock, Haunted Hollow's props the trunk.
- **The canopy is not a collider** -- the physics stops at trunks -- but a ball
  flying through leaves still rustles: once per tree whose crown the flight
  passes through, between 45% and 100% of the tree's height, within its crown
  radius (`canopyContacts`, PLACED band).
- **The cup** as the ball drops; **the score sting** as the hole-out banner
  lands, by the same names scoring.js uses (a decimal-putting score plays the
  nearest whole score's sting).
- **The ambience** follows the course: its biome, its wind in mph, the
  course's own temperature (crickets and cicadas), night when the sun is more
  than 4 degrees below the horizon (PLACED), and **water by distance from the
  ball** -- or the camera when no ball is in play -- found from the world's own
  surface query on rings of 8 to 300 m (0.2-0.4 ms a query, once a second).
  What kind of water it sounds like still comes from the biome's mix, not the
  nearest body (TODO).
- **A Sound window** (main menu and the in-round menu): on/off, volume, shots
  and landings, and the course around you, kept on the device in its own
  store (`fairway-sound-v1`), not in a course or a round. Nothing is made until
  the player's first click, tap or key (the browser's rule); the audio is
  suspended while the page is hidden.

**Cost, measured.** The ambience's scheduling takes 0.2-1.3 ms of the main
thread per second of sound (offline renders of five scenes, day and night) --
about a twentieth of a millisecond per frame; the audio itself runs on the
browser's audio thread. The two sound modules add about 52 KB to the built
page once minified (17.0 MB in all).

**The smoke run that day.** 24 of 26 journeys passed, including a new `sound`
journey. `floodlit-night` (a 0.93 s freeze turning the floodlights on) and
`text-size` (the course drawn at 1224 px of 1920) failed while another
program held the graphics card at 74% (`nvidia-smi`); both are frame-timing
checks, both passed in the run before the sound was wired in, and the sound's
main-thread cost above is two orders too small to cause either. Re-run on an
idle card before merging (TODO).

### Round 5: the swing ran backwards, and water as lapping waves (13 October 2026)

**The swing played in reverse** (the owner: "the ball is hit and then I hear
the whoosh"). Round 4 started each game strike 0.43 s in the past so its
0.45 s whoosh could run ahead of the ball, on the belief that the missed part
would simply go unheard. It does not work that way: a sound started late is
moved to now WHOLE (a buffer source starting in the past starts now from its
beginning, and an automation curve that began in the past runs from now), so
the full whoosh played after a crack that landed on time. The game strike now
has a 0.1 s lead: rendered offline, the first sound is at 60 ms, rising, and
the crack peaks at 100 ms, for driver, wood and iron alike. A side effect:
the first shot of a fresh page is on time too, because nothing is scheduled
before the audio clock's zero any more.

**Inland water as small lapping waves** (the owner: the pond, lake, river and
creek sounds "more like a small lapping wave"). Four options on a page of
their own, `docs/reports/sounds/water.html` (local), each played
continuously by `lapPlayer` (turned down in round 6, below, and removed): A, a gentle lap -- the wave washing in (noise
opening from 350 to 1,100 Hz), a slap against the bank (700 Hz), the draw
back (1,400 falling to 450 Hz) and a few gurgles, every 2.2-4 s; B, quicker
ripples with plips and plops (bubbles of 3-9 mm), every 1-2.2 s; C, a hollow
clop against a wooden bank or boat (170-230 Hz), every 1.6-3.2 s; D, tiny
waves on sand, a wash and a fizz, every 2.5-5 s. Every lap varies in size,
grows with the wind (size 0.6 + wind/20, period x 1.15 - wind/60) and rises
and falls in sets over 18-35 s. All PLACED. Measured offline over 30 s at 20 m
in 8 mph of wind, each averages -55 to -57 dB, the pond today -56.5, so the
choice is about character, not loudness. The owner turned all four down.

### Round 6: ponds apart from rivers, from research (13 October 2026)

The owner turned down all four round-5 lapping styles ("I'm not liking any of
these"), asked what a pond really sounds like at the shore, and split the
water in two: ponds and lakes, rivers and creeks, "radically different" from
what was there.

**What a pond sounds like at the shore.** No study of a small pond's lapping
heard in air was found. What was found:
- **The water itself is nearly silent.** Ponds are loud UNDERWATER -- water
  boatmen, beetles, fish, frogs and popping plants; insects dominate at night,
  peaking 02:00-04:00 and 20:00-00:00, plants by day (Bristol, Freshwater
  Biology, 2023) -- but that is hydrophone sound and does not reach a listener
  on the bank. In air a calm pond is heard through what is around it: wind in
  the reeds, a fish or frog surfacing, frogs calling.
- **Wave sound needs breaking water.** Surf studies tie airborne wave sound to
  falling water and collapsing air (50-315 Hz rising 5-20 dB as a wave breaks,
  for waves over 1 m; Nova Scotia field study) and to pulsating air pockets
  under plunging waves (laboratory). Gentle lapping entrains little air, so a
  lake's sound at the edge is small slaps where wavelets meet stones and the
  backwash rattling gravel -- an inference from those studies, recorded as one.
- **Frogs.** Green frog advertisement calls: energy at 200-500 Hz and
  1,300-1,500 Hz in large males, 500-1,000 Hz in small ones (Jenssen and
  Preston, Copeia 1983). Spring peeper calls: most energy at 2,900-3,200 Hz
  (USGS acoustic monitoring summary). No measured bullfrog figure was found, so
  there is no bullfrog.

**What a brook sounds like.** It is bubbles: a hydrophone recording of a
babbling brook is a series of exponentially decaying sinusoids, about nine
bubbles in the clip shown, big bubbles low, small high (University of
Southampton, ISVR). Their simulations are the useful number: **50 bubbles a
second with no noise are separate pings and "do not sound like realistic rain
or a babbling brook"; 2,500 a second with noise added "sounds a lot more like
rain or a babbling brook"**. Round 4's creek was 55 bubbles a second, which is
why it never sounded like one.

**How they are built now.** Sample by sample: each option writes thousands of
tiny events a second (bubbles as decaying sines that rise as they surface,
pebble and reed clicks, noise bursts for slaps and splashes, filtered noise
beds) into pieces of audio a fifth of a second long, queued back to back on the
audio clock, so nothing ever repeats and no Web Audio node is made per event
(`WATERS`, `waterPlayer` in sound.js). The options:

| | Option | What is in it (all PLACED) |
|---|---|---|
| Pond | A. A still pond | Reed blades ticking (2.5-7 kHz, under 1.2 ms) at about 220 a second scaled by gusting wind, a faint reed hiss, a plish every five seconds or so, a fish or frog surfacing about every 40 s (a 5-8 mm bubble, a splash, drops after) |
| Pond | B. A lake shore | Wind wavelets every 0.7-1.6 s (quicker and bigger with wind): a slap against a stone, a few bubbles, then the backwash -- 8-25 pebble clicks at 2-5 kHz over a third of a second and a gravel hiss |
| Pond | C. Under a wooden dock | Hollow glugs, 120-350 Hz with falling pitch, in ones to threes, as wavelets squeeze air under the boards; the dock knocked now and then |
| Pond, any | Frogs | By day a green frog's plucked "gunk" every 12-40 s (220-320 Hz with partials at 1.3-1.5 kHz and about 2.2x); at night 4-7 spring peepers at 2.9-3.2 kHz, about one rising peep a second each |
| River | A. A babbling creek | About 1,800 bubbles a second (radius median 1.6 mm, about 2 kHz, log-normal), riffle gulps of 15-40 bigger bubbles three times a second, a soft rush (400-3,500 Hz), the whole surging on a random walk |
| River | B. A mountain stream | About 2,600 smaller bubbles a second (median 1.1 mm, about 3 kHz), white-water splashes, a louder broadband rush (200-7,000 Hz) and a low rumble under 150 Hz |
| River | C. A slow, deep river | A low noise bed whose corner sways 270-630 Hz like eddies, a big gloop (4-16 mm bubbles, 200-800 Hz) about twice a second, a soft wash on the bank every six seconds |
| River | D. A trickle into a pool | Drops at about four a second (a click and a rising bubble each, sometimes in pairs) over a thin thread of 250 tiny bubbles a second |

Measured offline over 30 s at 20 m in 8 mph of wind: the ponds average -52 to
-58 dB (today's pond -56), the creeks -42 to -40 (today's creek -45), the slow
river and the trickle -53 and -56. The peeper chorus at night lifts a pond to
about -45 to -48: real peepers are loud, and Frogs turns them off. **Cost**: the
ponds, the slow river and the trickle take about 1 ms of main thread per
second of sound; the two dense creeks about 11-12 ms (around 1%), rendered in
2-3 ms slices every fifth of a second. If a creek is chosen, moving its
rendering to an AudioWorklet would take it off the main thread entirely.

Rejected this round: round 5's four lapping styles (a gentle lap, ripples, a
clop against a bank, a sandy wash), all built from a handful of filtered-noise
puffs and bubbles per wave -- the same family as round 4's pond, which is what
the owner heard in them.

### Round 7: rivers and creeks signed off, ponds as lapping bubbles (13 October 2026)

**Signed off**: the mountain stream for rivers (pitch 0.61, brightness 1.65,
texture 0.15) and the babbling creek for creeks (pitch 1.23, brightness 0.4,
body 0.55, texture 0.15, level 0.65) -- the owner's sliders, now each recipe's
`base`; `WATER_FOR` maps a kind of water to its sound. Discarded: the slow
river and the trickle. **No frogs** at ponds (the owner); the frog layer is
removed.

**Ponds as lapping bubbles.** The owner's diagnosis of round 6's ponds: they
needed "lapping sounds using the bubbles from the rivers and creeks instead of
the more white noise ... I think that is what we are missing." So the four new
options are made only of bubbles (and, on the pebble shore, pebble clicks), no
noise at all. All PLACED:

| Option | One wave |
|---|---|
| A. A bubbly lap | Every 1.8-3.6 s, 120-260 bubbles (radius median 3 mm, about 1.1 kHz) spread over 0.45-0.8 s, quick to build and slower to die, then 20-50 small high bubbles over 0.4 s as the water drains back |
| B. A slap and a gurgle | Every 0.9-1.8 s, 30-70 bubbles in 80 ms (median 2.2 mm), then two to four big gloops (5-9 mm, 360-650 Hz), then a trickle of small ones |
| C. A breathing shore | A continuous bubbling, 40 a second at rest, swelling to about 560 a second at each wave's crest (a smooth bump every 2-3.2 s, each its own height): a creek slowed down and breathing |
| D. A pebble shore, in bubbles | Every 0.8-1.7 s, 40-90 bubbles as the wavelet lands, then 8-25 pebble clicks (2-5 kHz) as it runs back, and a fizz |

Wind makes every wave bigger (0.5 + wind/16) and quicker (period x 1.2 -
wind/40), and sizes ride a slow set of about 25 s. Measured offline over 30 s
at 20 m in 8 mph of wind, all four average -54 to -56 dB, today's pond -56,
the creeks -42 to -47. Each costs about 1-2 ms of main thread per second of
sound; the creeks 9-13 ms.

### Round 8: the pond signed off, and every water in the game (13 October 2026)

**Signed off**: the bubbly lap (round 7's A) for ponds and lakes, with the
owner's sliders as its `base` (texture 2.55, body 1.3, brightness 0.95, pitch
0.71). With the mountain stream for rivers and the babbling creek for creeks,
`WATER_FOR` is complete. The other pond options, round 6's three and the
round-4 pond and creek they were compared against are removed.

**How the game plays them.** About once a second the game finds the nearest
water to the ball (or the camera with no ball in play) and asks what kind it
is (`waterKindAt`): a river or a creek if a stream is there (the stream says
which), the sea if the ground there is below sea level on a coast and not a
lake, otherwise a pond or a lake. The ambience plays that kind's sound,
cross-fading over 1.5 s when the kind changes; the sea keeps its surf and an
inland sound is never played for it. The nearest water also sets how loud
(full within 25 m, gone by 300 m, as before) and which side: its bearing from
the camera pans the sound, gliding rather than jumping. Checked on generated
courses: a point on each river and creek was classified as its own kind; an
island's holes all heard the sea; a links course heard ponds and, at three
spots, the sea.

**Kept on the main thread, not moved to an AudioWorklet** (the plan in round
6). A worklet needs the grain code as its own unminified source; the game is
minified at build, so the worklet would need a second copy of the recipes kept
in step with this one, and the Node tests and the report would need it too.
What it would save: the creek's 9-13 ms of main thread per second of sound,
now made a fifth of a second at a time (2-3 ms each) and never more than 0.6 s
ahead, so it never arrives as one burst. The full smoke suite ran green with it
(below). Revisit if a frame budget ever says otherwise.

**The smoke failures of round 4 were the busy card.** With the graphics card
idle (0% by `nvidia-smi`), all 26 journeys passed, `floodlit-night` and
`text-size` included.

### Open, for the owner

Nothing. Every sound is decided and in the game. Decided along the way: the
driver (take C, main ring near 5.4 kHz), no club sounds under a launch
monitor, no crowd, no ball rolling, no frogs, no CC0 recordings, one material
for every house, and water by kind.

## Flagsticks and houses: solid where they are drawn, and flags you can find (13 October 2026)

The owner asked for colliders on the flagstick and houses, and for flagsticks
that can be seen from a distance.

**Houses were already solid, but in the wrong place.** simulateShot works in
the hole's frame and moved each house's centre into it with `toLocal`, but
kept `rotation`, which is a world angle; the box test then turned every house
by its hole's own angle. Measured on the `HOMES-QA` course (nine holes, 57
houses): on a grid of 1 m points around each house, **32.8% of the points
inside either the drawn house or its collider were inside only one of them**,
**60% on the worst house**, and only holes running due north were right. The
box also stood **2.6 m above every roof** -- a relic of the hand-built houses,
whose roof sat on top of `height`; the imported models are fitted to `height`
roof and all. Against the old code, **96 of 100** level shots passing 0.6 m
outside a long wall struck it, and **50 of 50** balls clearing a roof by 0.8 m
hit the air above it. Fixed: in the hole's frame a house is turned by its own
rotation less the hole's, and the box ends at the drawn top
(`tests/solid-colliders.test.mjs`). `tests/homes.test.mjs` had made the same
frame mistake in its own "inside" check, so it agreed with the old physics; it
was corrected too.

**The flagstick is solid while it stands in the hole.** A vertical cylinder
at its base radius (9 mm until 15 October 2026, 12.7 mm since -- the owner's 1 in, over the 9.5 mm the Rules allow from 76 mm above the surface to 76 mm below), from the cup floor (CUP_DEPTH, 101.6 mm, down) to its full height (7 ft, 8 ft since)
above the green, in the same swept-cylinder test as a trunk, so a ball comes
off it the way it comes off a tree (the normal component reversed at 0.3 of
its speed). The game pulls the stick for a putt and when the ball is on the
green, and the collider follows: `flagsticks.current` is false exactly then.
Every other hole's stick always stands. A strike counts as `flagHits`, not a
tree. Not modelled: the stick's flex (a fibreglass pole gives a little more
than a trunk) and a ball wedged between stick and cup wall, which the Rules
call holed if any part is below the surface.

**Flagsticks stay findable.** Drawn to size, the stick is 18 mm across: from
250 yd (229 m) with the default 50-degree view on a 1,080-line screen that is
about 0.09 px wide and 11 px tall, the flag about 2.4 x 1.7 px. Beyond the
distance where the stick would be shorter than 36 px on screen, stick and flag
grow together to hold that angular size, up to 10x; the cloth may grow up to
1.8x more so it stays at least 14 px wide; and the pole is thickened so it is
never under 2 px. Close up -- inside about 70 m at that screen size -- they are
exactly to size. Drawing only: the ball hits the real stick. All four numbers
are PLACED by eye and live beside each other in renderer.js (`FLAG_MIN_PX`).
Rejected: an outline or glow (a second pass for one object, and a cartoon
outline nowhere else in the scene), and leaving it to the flag label (the
label marks the spot but is not the flag, and it hides when you aim).

**A switch, off by default (14 October 2026).** The day after it shipped
always on, the owner asked for a toggle and for it to default to off: "Larger
flags far away" in Graphics (`graphics.distantFlags`). Off, every flagstick is
drawn exactly to size from anywhere, as before 13 October. The growth numbers
above are unchanged and apply only with the switch on; the range's distance
boards are not under it. No record saved before the switch has the key, so
every player starts with it off.

## The Swing Meter (14 October 2026)

**Signed off by the owner, 15 October 2026.** Every number and rule in this
section and its subsections marked PLACED -- the par save, the sand save, Beat
the Index at half the index for nine holes, a long drive counting only on the
fairway, the up-and-down drop distances, the Monday-midnight week, the flat
flourishes, the hold lengths at the hole-out -- was put to the owner and
accepted as it stands. They remain PLACED (no outside source behind them); the
owner can still overrule any.

The owner asked for keyboard play to become a game's three-tap meter (Hot
Shots Golf, PGA 2K): tap to start, tap to set the distance, tap at the strike
line for accuracy. It replaced the power slider, the Shot shape sliders and the
ball-flight profile (`src/swing-meter.js`; PROJECT_HANDOFF *The Swing Meter
replaced the shot-shape sliders*). The spec was agreed over four rounds with the
owner and lives as a local report.

**Nothing on the meter is published; every number below is PLACED** -- chosen to
feel right and to be tuned by playing. The console games publish no timings and
none were taken from them; the three-tap structure is all that was borrowed.

| What | Value | Note |
| --- | --- | --- |
| Marker, start to full (`rise`) | Easy 1.5 s, Normal 1.15 s, Hard 0.9 s | x0.9 driver, x0.92 3 wood, x1.1 wedges, x1.15 putter |
| Strike zone half-width | Easy 0.10, Normal 0.065, Hard 0.04 bar lengths | the bar from start to full is 1 |
| Perfect band half-width | Easy 0.03, Normal 0.015, Hard 0.008 | |
| Overswing | 0.12 bar lengths, worth +5% carry; the marker crawls through it at a quarter speed and holds at its end for the tap | the owner's 5% (Q1); the slow, flashing, holding overswing is the owner's call of 14 October 2026 -- it used to go off by itself at the end |
| Zone narrowing | rough x0.8, sand x0.7, each spin step x0.85, Flop x0.8, overswing down to x0.5 | under 40% of the bar x1.5 |
| A miss at the zone's edge | 1.25 deg start line, 5 deg spin axis | growing linearly to 4x outside the zone; a swing that runs out is -7 deg, -25 deg axis at 75% speed |
| Draw / Fade | -8 / +8 deg spin axis | start line turned the other way by the bend, found by flying it once |
| Low / High | -4 / +4 deg launch | |
| Bump & run / Flop (wedges within 60 yd) | 55% of launch on 50% spin / +10 deg launch | the 55% puts a 7-iron-like chip at Trackman's 6-14 deg chip launches (TODO *a lower launch for keyboard chips*) |
| Spin dial | -1: x0.75; +1, +2, +3: x1.1, x1.2, x1.3 | |
| Run-up | the marker starts at the left edge and takes 0.3 rises to reach the strike line (0.35 s at Normal) | the owner's call, 14 October 2026: short shots were a sliver from where the marker started |
| Short full shots | the bar zooms to a half or quarter of the full carry; a half bar runs 12% slower, a quarter 25% | the owner's call, 14 October 2026. Tested: an 18 yd chip with a 100 yd wedge is about seven tenths of a quarter-swing bar and carries within 1.5 yd |
| Putting bar | a quarter of the putter's roll up to six times it | the zoom was added in building; the reach past the putter's roll is the owner's call (14 October 2026): the widest green a course grows is about 80 yd across (green size 14-21 m radius, aspect up to 1.33, outline harmonics), and at Stimp 6 the putter's own 30 yd (Stimp 10) roll is about 18 yd, so six times holds 80 yd with the bar's quarter to spare. Tested: an 80 yd putt at Stimp 6 rolls within 2 m of 80 yd |

**Early goes right, late goes left, for every golfer** (the owner's rule, third
round): the meter has no handedness.

**The bar is in yards, and it is honest to within a yard and a half.** Half the
bar is half the club's full carry, solved by bisection against the ball model
on level ground in still air (`speedForCarry`, 18 halvings, cached per quarter
yard). Checked by test for the driver, 7 iron and pitching wedge: a full clean
swing carries the bag yardage, half the bar half of it, both within 1.5 yd. The
solve flies at 1/120 s steps for speed; the shot itself at the default 1/240,
which is where the yard and a half comes from. In play: a perfect full driver
from rough (90% ball speed) carried 224 yd against a 250 yd bag on a 57 F
night; a perfect high fade with a 125 yd 9 iron carried 118 into a hole that
played eight yards uphill.

### With no spin added, nothing spins back

The owner's rule (second and third rounds): a ball must not zip back unless the
golfer added spin, and there is no named "spin back" shot. Swept 14 October
2026 with every club kind in `CLUB_KINDS` at its stock carry, every height (and
Bump & run and Flop for the wedges), the spin dial at -1 to +3, 30%, 50%, 75%,
100% and full overswing of the bar, all four firmness presets, landing on level
ground and into 2% rises and falls.

- **At the club's own spin (dial 0), before any adjustment:** 7 come-backs, all
  on Soft into a 2% rise, none over half a yard -- the lob wedge at Normal
  height (0.42-0.50 yd at full swing and overswing), the lob wedge High (0.10),
  and the pitching wedge at overswing (0.11). Fixed by carrying 85% of the lob
  wedge's stock spin and 95% of the pitching wedge's on the meter (`KIND_SPIN`),
  and 85% at High and 80% at Flop (`HEIGHT_SPIN`). **After: zero.**
- **With spin added:** 453 of the combinations come back, up to about 12 yd (a
  sand wedge at +3, 11,250 rpm, overswung onto a soft green into a 2% rise).
  That is the golfer's choice and is left to the physics.
- **Short chips (10-30% of the bar)** with the sand wedge, pitching wedge and 9
  iron, level and 2%, Soft and Normal: none come back.
- **Steeper slopes are not the rule's business.** Into an 8% rise the same
  sweep found pitching and gap wedges finishing up to 84 yd behind the landing
  -- rolling down the hill by gravity, with or without spin. A chip in play
  that carried 14 yd and finished 12 was the green's slope, not spin.

### The target marker

**How far free flight goes before the cleared trees come back** (UI/UX pass
V3): two metres, PLACED -- about a second of slow flight, enough that the
first frame is the play view and the first movement shows the course whole.

**How far a phone's picture is lifted** (UI/UX pass V3). No outside source;
PLACED from one course's measured layout: held sideways (844x390) the ball sat
at 79% of the height and the meter began at 69%, so **20%** lifts it clear
(ball at 59%); upright (390x844) the ball at 79%, and with the lie and shape
rows under the ball the first control begins at 58%, so **24%** (ball at 55%).
A shot whose camera frames the ball differently (a putt, a long pitch) is not
measured.

**What the camera clears besides trees** (UI/UX pass V2, category 5). No
outside source; PLACED: each object is tested as a crown would be -- a boulder
its widest axis and its height, a log three times as long as it is thick, a
house its footprint's longer side and 1.6 times its wall height (the roof), a
pumpkin or headstone 1.2 times as wide as it is tall. Probed: on a mountain
course 462 boulders, none hidden from its tees; with the camera 8 m behind
each of five boulders (1.2 to 5 m tall), each was hidden, and none once the
camera moved 40 m aside.

**Where a turn starts aiming, when the club cannot get there** (UI/UX pass V2,
21 October 2026). No outside source. When a full swing falls short of the
default aim, the aim is pulled back along the fairway to the longest distance
that fits (ten halvings, about 0.1% of the distance) and then to **98%** of
it -- PLACED, so the marker starts just inside the full line rather than on
it. When the ball model answers nothing for any distance, or less than **40%**
of the club's carry (PLACED; audit 4 found an aim 5 m from the tee), the aim
stays on the fairway at the stock carry and the meter says out of reach. Probed on one course: from the rough the driver's aim came back from 250
to 220-224 yd.

The blue mark on the bar (Phase 2, 14 October 2026) is the stop that lands the
ball in the aim circle. It is `playsLike` -- the circle's distance scaled by how
much shorter or longer a full swing of this club and shape reaches the circle's
height in today's air than level ground in still air -- then the bar share for
that level carry, with the lie's lost ball speed made up by solving the speed
before the lie. Checked by test: on level ground in still air the marker is the
circle's share of the carry within 2%, and stopping the meter on it carries
within 2 yd of 60, 100 and 140 yd with a 7 iron; uphill and rough ask for more,
downhill for less. In play: a circle at 150 yd with a 5 iron on Hard (so no wind
allowance, 11 mph blowing) carried 151.

**Wind only on Easy** is the owner's call (spec Q7). **Altitude and temperature
are always in** -- an assumption made in building, recorded here so it can be
reversed: they are the air, not something a golfer reads, and the spec named
only the wind as the skill to leave to the golfer. It approximates a partial
swing by the full swing's ratio, as `playsLike` does (RESEARCH *Plays like, by
geometry*); the test above bounds what that costs on level ground.

### XP and levels

Phase 4 (14 October 2026). Every amount is from the agreed spec and is PLACED:
nothing about XP is measured. Finishing a hole 10; par 10, birdie 30, eagle 80,
albatross 250, hole in one 300 (replacing the rest; the owner swapped the
spec's albatross and ace); fairway and green in regulation 5 each; on the
number 5 (within 5% of the aim distance, once a hole, not putts); chip-in 25;
putt over 30 ft holed 25; new personal best 40; 9 or 18 holes finished 50 or
100; a match or scramble won 50; the first round finished each day 100 (the
owner raised it from 50). Multipliers Easy 0.75, Normal 1, Hard 1.5, a monitor
golfer 1, not on the daily bonus. The range: on the number only, 2 a time,
50 a day. Levels: 400 to level 2, 50 more each level, so 78,400 to reach level
50, and 2,850 a level after that for ever (the owner: no cap, no unlocks past
50). Estimated from these: a typical 18-hole round (18 holes finished, about
nine pars, two birdies, a dozen fairways and greens, a few shots on the number,
the round itself) pays about 500 to 650 XP, so about a level a round at first,
one every three or four rounds by level 30, and roughly 140 eighteen-hole rounds
to level 50. Not yet checked against real play.

### The XP popup's sounds, and chiptune stings

Synthesised, PLACED by ear. The XP popup's three sounds were chosen by the owner
on 14 October 2026 from six takes each (`XP_FINAL`): the gain a quick
three-note triangle pluck (C5-E5-G5, pitched down an octave by their 0.5 pitch
slider), the fill a low sine glide (300 to 600 Hz before the same halving), a
new level a rising two-note triangle swell. Renders at -12 to -17 dB peak.
They play one at a time and never with the hole-out sting (PROJECT_HANDOFF
*The XP popup reports what award paid*).

The hole-out stings, reworked as chiptune on the owner's ask the same day,
were four takes (`CHIP_TAKES`, `chipSting`): the known tunes on a square
wave, on a 25% pulse over a triangle bass, on a triangle with a 12.5% pulse
echo and a noise drum, and new game jingles. **The owner chose take D, the game
jingles, for every score** (`CHIP_FINAL`), at length 0.7, pitch 0.63 and
brightness 1.2: a square lead, a triangle bass and a noise drum, the whole
pitched down by about eight semitones and shortened to 70%, its low-pass at
about 3,500 Hz. They replaced the marimba stings in play; the marimba stayed in
the code for comparison until 17 October 2026, when it was deleted and family C
took over five of the scores (*The 1.0 interface's sounds, wired in*, below).
Pulse waves are built from their Fourier series (40
harmonics). As played they peak at -15 dB for a hole in one or albatross and
about -18 dB for the rest (`tools/sound-lab/check.mjs`, its "final" rows). The
marimba they replace peaked at about -7 dB for a hole in one, -17 for a birdie
and -21 for a bogey, so the best scores are now quieter and the worst slightly
louder; the owner chose them by ear at these levels.

### The pause before the XP popup (measured 14 October 2026)

The owner saw the game "freeze a bit" before the XP came up after holing out.
A frame probe in the built game (every frame over 34 ms, and when the banner,
the popup and the scorecard came and went), on this machine's GPU at Low and
again at Ultra, found **no stalled frame before the popup**: the only one was a
single 50 ms frame just after the scorecard opened. What it did find was the
time: the camera held on the empty cup for 3 s (`SHOT_HOLD_SECONDS`, meant for
looking at a lie), the banner 2.7 s, then the popup -- nearly six seconds of a
still picture -- and the scorecard 0.17 s after the popup, over it. Now: 1.2 s
on the cup (`HOLED_HOLD_SECONDS`), the popup 1.6 s into the banner, the card
about 0.5 s after the popup has gone. Measured after: banner to popup 1.60 s,
popup gone to scorecard 0.57 s; the 50 ms frame stays on the card's opening,
away from the popup. All three hold lengths are PLACED.

### Why our pins look small: the greens are twice real size (15 October 2026)

The owner asked why our pins do not look like other sims'. **The flagstick and
flag are real size**: 7 ft (2.13 m), 14-18 mm across (`FLAGSTICK_TOP_R` 7 mm,
`FLAGSTICK_BASE_R` 9 mm), flag 0.48 x 0.33 m. The Rules' Equipment section caps
the pole at 0.75 in (19 mm) from 3 in above to 3 in below the green, allow up to
2 in (50.8 mm) above that, and most US sticks are about 0.5 in; courses use 7 or
8 ft sticks (sources in REFERENCES). **What is not real size is the green.**
Measured from the generator (135 holes: 5 seeds x 3 landscapes x 9 holes,
DEFAULT_COURSE, the putting surface sampled on a 0.5 m grid round each pin): a
median **1,121 m2, about 12,060 sq ft** (10th-90th percentile 8,550-16,400 sq
ft), median depth along the hole 35.5 m (39 yd). A USGA article cites a recent
USGA study putting the average US green at **5,600-5,700 sq ft**; Pinehurst
No. 2 for the 2024 US Open about 6,500, Chambers Bay (the largest of any modern
US Open venue) about 9,000, Brookline about 4,400. So our median green is about
twice the US average and larger than Chambers Bay's; a real-size stick on a
twice-size green reads as a toothpick, and the green itself as flat and empty.
I found no GSPro setting for stick size in its docs (one partial page read);
how other sims draw pins was not established from a source -- the impression
that they draw them larger is the owner's, not checked.

**Built (the owner's choice, same day): greens at real size and a bolder
stick; "Larger flags far away" left off by default.** *Greens* (generator 36):
the radius drawn 10-15 m instead of 14-21 m, one draw so nothing else moved;
measured again over the same 135 holes, a median **6,146 sq ft** (4,373-8,364,
10th-90th), median depth 25.0 m (27 yd). The green's bumps first stayed in
metres, which on the smaller greens stacked the slopes (31 of 36 sampled
points steep, a Thursday cup on 2.03%); they now scale with the green (radius
and height by greenSize/17.5, `GREEN_REF`), and putting slopes are unchanged:
median 1.03% before and after, 90th percentile 1.68 -> 1.67%, about 1% at the
cup both ways. Full bench before and after: blind tee shots over 1 m 29 -> 35
of about 1,050, tees needing work 32 -> 14, ponds biting into a fairway 32 of
348 -> 26 of 331 (9.2 -> 7.9%: a par three's fairway starts later; that test's
PLACED floor moved from 8% to 7%), no invariant broken. *The stick*: 8 ft, 2
in (50.8 mm) at the top tapering to 1 in (25.4 mm) at the green -- the owner's
taper; **the 1 in base is over the 0.75 in the Rules allow near the surface**.
Drawn and hit alike. Rolling 594 balls at the cup with the pin in (six holes,
11 lines from -5 to +5 cm, speeds 1.6-3.2 m/s from 4 m): 29 dropped with the
old stick, 25 with the new (a ball beside it in the cup now has 41.3 mm
between pin and liner against a 42.7 mm ball), 34 with the pin out.

**Then a Green size setting (the owner, same night)**: `greenScale`, 60-160%,
default 100, multiplying the drawn radius. Measured over 9-hole courses on three
seeds and three biomes (PNW, links, desert), area by counting half-metre cells
of putting surface: **60%** median 2,026 sq ft (1,526-2,933, 10th-90th);
**100%** 5,681 (4,236-7,981); **160%** 14,518 (10,465-20,780). Median slope
1.06% at all three, 90th percentile 1.68-1.69% -- the bumps follow the green.
Full bench, no invariant broken at either end: tees needing work 14 at 100%,
25 at 60%, 27 at 160%; blind tee shots over 1 m 35, 22 and 25 of 1,080. The
range is PLACED: 60% reaches the smallest famous greens (Pebble Beach's 7th is
often quoted near 2,000 sq ft, not checked against a source), 160% the size
the greens were before generator 36 and a little beyond. The tip's "about
14,000" and "about 2,000" are these medians rounded.

### First-visit lock-ups and the hole-out stutter: the ball's light (15 October 2026)

The owner saw "lots of lock ups" clicking round the menus on a new build's
first load, smooth after a reload, and a stutter as the camera pulls back after
holing out. Asked whether a "compiling shaders" screen on first load would help.
**Measured first** (scratch probe, not committed: the built game in a fresh
Chrome profile on this machine's RTX 4090, every WebGL program logged on its
first draw after the main menu appeared, and every frame over 50 ms; the menu
idle 20 s, every menu tile, My profile and every look tab, a flourish preview,
then Endless started from the menu and back to the menu, twice; then a reload
and the same walk again).

- **The menus themselves build nothing late.** Their only long frames are
  100-150 ms on opening Play, My profile and the Frame tab -- page work, not
  graphics programs, and the same after a reload.
- **Starting Endless from the menu was the lock-up**: 35-40 programs built in
  view, one frame of **1.85 s** on the first visit (117-133 ms after a reload,
  when Chrome's disk cache has them). Endless adopts the hole on screen with no
  loading screen, so nothing could hide it -- but nothing was new: only 12-26
  GPU buffers were made, so no geometry was rebuilt. Diffing each late program
  against the menu's program for the same material: every lit one differed only
  by `pointLights[1]`. The ball's glow light was the ball's child; the menu
  hides the ball, so every program behind the menu was built with no point
  light, and the ball appearing rebuilt all of them. Midday or night made no
  difference (it is not the clock).
- **The same fault at the hole-out**: the end-of-hole flyover hides the ball.
  On a course built through Play (whose programs had only ever been drawn WITH
  the ball), 14-17 lit programs were built in view as the flyover began.
  Starting Endless from the menu hid it, because the menu had already built the
  no-light set -- which is why the hole-out probe of 14 October (*The pause
  before the XP popup*), run on an Endless round, saw no stall.
- **The fix**: the light sits beside the ball, follows it each frame, and is
  dark while the ball is hidden; the light count never changes. After: starting
  Endless builds one small unlit program (a double-sided MeshBasicMaterial,
  probably the aim ring), worst frame 100 ms; the hole-out builds no lit program.
- **So a first-load "compiling" screen was not the answer**: the programs that
  froze were not missing from the loading screen's warm-up, they were
  invalidated after it. A screen warming more up front would have cost every
  player a longer start and still missed these.

Not established: whether the hole-out stutter the owner sees is wholly this
(the other suspects in TODO are untested); the 100-150 ms menu frames.

### Plain colours and animated frames (15 October 2026)

No outside source; the owner's ask. PLACED: the solid ball colours (red
#d93a3a, orange #f08a2b, yellow #f5d33a, green #3fae55, blue #3a7fd9, purple
#8457d9, pink #ec6fb2, black #26282b), the plain tracers and frames, the colours
the old seat-coloured tracers now carry (Classic amber #ffe9a2, Comet gold,
Dashed white, Ribbon pale blue, Starfall lilac), and the thirteen animated
frames' levels (7 to 47) and movements: flames turn in 2.2 s and flicker every
0.32 s, sparkle 7 s with a 1.4 s twinkle, water 9 s, leaves 14 s, aurora 5 s.

**Five empty levels filled (the owner, same night).** Levels 14, 22, 27, 36
and 43 brought nothing once the flourish ladder moved off them. One reward
each, placed where its kind waits longest between unlocks -- all PLACED, by
eye, no outside source: **Smoke** tracer at 14 (tracers 11 -> 16): grey
#a9aeb3 at the tee to white at the ball, 9 px wide at 0.5 opacity, 30 puffs
#eef0f2 rising at 0.35 (a negative fall). **Grinder** title at 22 (titles 20 ->
25). **Sunset** meter skin at 27 (skins 24 -> 32, the longest wait of any kind):
track #2b1638 -> #4a1f3d -> #5e2a26 on base #41203a, the usual yellow zone,
green band and blue target; it passes the same lightness test for normal and
red-green colour-blind vision as every skin. **Lightning** frame at 36 (frames
32 -> 38): a dark blue ring with bright bolts turning in eight jumps every 1.6
s and flaring twice per 2.3 s, and outside it thin jagged bolts (an SVG, white with
a glow in the frame's blue; two layers of four and five bolts) flickering and
jumping round out of step (2.3 s and 1.7 s). **Lava** ball at 43 (a flashy late
ball before Gold at 46): rock #1c1614 to #3a2a24 split into irregular plates
(cellular noise, wobbled by fbm) whose seams glow #ff5a14 to #ffd36b,
roughness 0.6, a little glow of its own (0.2); its texture takes 57 ms to
build, once, when it is put on. **Two first drafts were rejected on sight**
(screenshots, same night): the Lightning corona as a filled saw-toothed ring
read as a gear or a sunburst, and crowded the name beside the picture; Lava's
cracks from the ridges of an fbm field came out as broad gold blotches --
leopard print, not lava.

### The cup rattle (15 October 2026)

The owner: "needs more rattle and I think it's playing in reverse". The old
pattern -- restitution 0.45, six knocks, level as bounce speed^1.2 -- left only
three audible knocks; a first measurement (10 ms RMS windows) showed the second
as loud as the first, but those windows were misaligned by the master chain's
look-ahead, so whether the old sound truly swelled was not established. The new
one: restitution 0.5, five knocks with level as bounce speed^1.6, a low 210 and
430 Hz thup of the cup in the ground on the first, a wall click only after the
first, then nine skitter ticks 7-13 ms apart each 0.78 of the last. Measured as
played (limiter off, onset-aligned, five renders): knock peaks -17, -30, -39,
-52 to -49, -53 to -56 dB -- every one below the one before. PLACED.

### Profile after Phases 5-7 (14 October 2026, late)

Run by the owner's leave, on this machine's RTX 4090 with the card idle (2-13%
busy before each run), real-GPU arm only: **the software-rasteriser arm
(`--only weak`) was skipped**, because a processor-only run took this machine
down on 13 October. Each GPU group against `bench/profile-baseline.json` (saved
7 October; not re-saved): **nothing slower anywhere.** Median frame ms since
the baseline: tiers -3.2 to -7.8 (Ultra 6.30 ms CPU, 6.98 ms GPU on redwood);
overview views -3.5 to -16.4; biomes -1.2 to -6.6; ablation -6.2 to -6.6;
water -0.8 to -1.1; pixels -4.4 to -6.6 (sun has no baseline). The gains are a
week of other work and the machine, not this journey -- these cases stand
still and never fly a ball, so **the profile cannot see the tracer styles at
all**.

**So a ball in flight was measured separately** (a scratch script with the
profiler's own probe, `tools/profile-probe.js`, injected from outside): the
same course-of-the-week tee shot on Ultra, styles alternated over three rounds,
2.5 s of flight each, about 1,600 frames a run. Median of runs, CPU / GPU ms per
frame and draws: Classic 1.00 / 1.01 / 163; Comet tail plus sparkle (head,
glints) 1.20 / 1.04 / 166; Lightning (zigzag, core, flicker) 1.10 / 1.03 / 166;
Rainbow (moving colours) 1.10 / 1.01 / 162. **The heaviest style costs about
0.2 ms of CPU and three draws a frame**, against a 16.7 ms frame; within the
run-to-run spread for the others. The flourishes are 2D on a canvas and do not
reach the GPU's scene at all; no shader is built by any look (smoke
`no-late-shaders`, first shot included).

### Final profile before the merge (15 October 2026, night)

Asked for by the owner at the end of the journey. RTX 4090, card idle (14%
busy before the first group), real-GPU arm only, every group but `weak` (the
software arm stays skipped: a processor-only run took this machine down on 13
October). Against `bench/profile-baseline.json` (saved 28 September, not
re-saved): **nothing slower anywhere.** Median frame ms since the baseline:
tiers -2.9 to -6.7 (redwood Ultra 7.40 ms CPU, 8.21 ms GPU); overview views
-2.1 to -17.2; biomes -0.5 to -5.8; ablation -5.4 to -5.9; water -1.5 to -1.7;
pixels -3.9 to -5.8; sun has no baseline (redwood Ultra facing the sun 4.10 /
3.84 ms).

**Against the profile of 14 October it reads about 1 ms slower on redwood
High and Ultra, and that is a different course, not slower code.** Checked by
building three commits side by side and profiling the tiers twice each,
alternated: before generator 36 (2f77dd5), generator 36 without the ball-light
fix (5667701), and the branch head. The run-to-run spread on High and Ultra is
large -- one build gave Ultra 6.4 ms in one round and 10.7 ms in the next -- so
only what holds in both rounds counts: **generator 36 regenerated the
profile's fixed course** (seed PROFILE, redwood) and the camera now sees about
10% more geometry (Ultra 77.8 -> 85.3 million triangles; Low 40.9 -> 46.5);
**the ball-light fix measured nothing** (Low, Medium, High the same within
0.3 ms with and without it; Ultra inside the spread). Redwood High and Ultra
keep their occasional long frames (p99 37-71 ms, worst 80-175 ms) on every
build, before and after; they are not this journey's.

### Badges, meter skins and flourishes (14 October 2026)

The badge metals, skin colours and flourish particles are PLACED by eye; the
names and levels are the agreed spec's (7.1). **The skin legibility test** uses
the colour-vision-deficiency matrices of Machado, Oliveira and Fernandes (2009),
severity 1.0, for deuteranopia and protanopia, applied in linear light, and the
WCAG relative-luminance contrast ratio. The thresholds are PLACED: 1.5 for the
zone against the track and the perfect band against the zone (they sit side by
side and only need to read as different), 3 for the target marker against the
track (WCAG's figure for large graphical objects). The matrices were first typed
from memory, then **checked against the paper's page the same day: every digit
matches** its severity-1.0 protanomaly and deuteranomaly rows (the page calls
them dichromacy). The page does not say whether they apply to linear or
gamma-encoded RGB; the test uses linear, and every skin also passes with them
applied to gamma-encoded values (tightest margin 1.78 there, against 1.87). Every skin passes in all three visions. Tightest margins (measured):
the zone against the track 2.22 (Classic, protanopia), the perfect band
against the zone 1.87 (Wood, deuteranopia), the target against the track
5.10 (Wood, deuteranopia). A par save is PLACED as par after missing the green in
regulation. Flourishes: confetti 120-140 pieces, fireworks 70 sparks a burst,
3.2-4.8 s each.

### Challenges and medals (14 October 2026; 27 with medals since 16 October)

No outside source. Every number here is PLACED -- set by Claude for the owner's
plan of 16 October 2026 (a local report, `docs/reports/CHALLENGES_PLAN.md`),
not taken from any published figure -- and the owner may overrule any of it.

**The rules every challenge plays** (UI/UX pass V2, 21 October 2026;
challenges.js `CHALLENGE_RULES`). The owner asked that "all users have the
same experience"; which rules was left to the build, so it is PLACED: stroke
play, the blue tees for every golfer, every putt holed, out of bounds by the
Rules of Golf (stroke and distance) and the lie penalty on -- Round's own
defaults, taken because they are what a new copy of Fairway plays. Before
this a challenge took the player's saved house rules (out of bounds, lie
penalty) and the tee of the round before it, so two players' medals could
be different tests.

**The pay** (progression.js `CHALLENGE_PAY`). Set against a round: an
18-hole round earns roughly 450-700 XP in about an hour, a short challenge
takes 3-5 minutes. First bronze, silver, gold 25 / 50 / 100, once each ever
(`long` challenges double, none yet); a finished play 5 / 10 / 15 / 25 by the
medal it reached (none, bronze, silver, gold), until 250 XP of such pay in a
day across all challenges; a new best 20, once a challenge a day; the Swing
Meter multiplier on all of it. All first medals together come to 4,725 XP for
the 27 (about level 1 to 9). **Replaced** (14 October 2026, the spec's 8.1):
10 XP a closest-to-the-pin ball inside 20 feet, 20 an up-and-down, 50 a new
best on closest and long, paid every play with no limit -- the three oldest
challenges were the only farmable ones, which is why they moved onto medals.
**Rejected**: one amount per ball (pays a repeat like a first, and floods the
400-entry XP ledger); no repeat pay at all (the owner chose "medals pay,
repeats capped").

**Where they play** (the owner, 16 October 2026: one fixed course rather than
any course). The Challenge Course is `DEFAULT_COURSE` with seed
`CHALLENGE-1`, biome pnw, 18 holes, at generator 36. Checked on the day:
`CHALLENGE-1` hosts all 21 course challenges; `CHALLENGE-2` (pnw) and
`CHALLENGE-3` (links) have no hole with water to carry. On `CHALLENGE-1` the
long hole is the 1st (par 5), the par 3 the 3rd, the long par 4 the 6th, the
water carry the 4th, the bunker challenges the 1st and up and down the 2nd.
Records and medals are kept across generator changes; wiping them at each bump
was rejected because the generator moves often.

**Medals.** Distance medals against the golfer's own bag driver D (stock 250
yd): Long drive D+5 / D+20 / D+35 yards; Long and straight 75% / 85% / 95% of
D. Closest to the pin within 8% / 4% / 2% of the hole's length (160 yd: 38 /
19 / 10 ft). A record kept before medals, whose hole length was never saved,
is measured against 160 yards. Every other challenge's three scores are in its
row in challenges.js.

**Measured, 16 October 2026: High and low.** Through the ball model a stock
7-iron off the Swing Meter (full power, centred strike) peaks at 0.206 of its
carry, 0.237 with High and 0.164 with Low; the lines are set halfway, high at
0.222 of the carry or more, low at 0.185 or less, so a normal flight makes
neither call and the meter's High and Low each make theirs
(tests/challenge-play.test.mjs keeps it so). The same flights curve 10.7 yards
with draw or fade (the driver 15), so the 4-yard (Curve it) and 5-yard (Draw
and fade) lines are within reach of the meter's shapes. Curve is measured
where the ball lands against the line of its first five metres, right
positive, a right-hander's draw curving left.

**Spots and rules** (challenge-spots.js, challenge-play.js). Up and down: 3 to
18 yards off the green's edge on fringe, cut, fairway or sand, spread round
the green; chips 5-25 and 5-20 yards on grass only; greenside bunker drops 0.5
to 20 yards off the edge in sand, not spread (a green may have sand on one side
only) but 3 m apart; short side: grass 2 to 22 yards off with sand on the line
to the pin; ladders on the centre line at the stated distance from the pin, on
fairway or first cut, nudged up to 12 m sideways and 4 yards along; Over the
water: fairway 100-170 yards out with water on the line to the pin, one spot
repeated when only one fits; putts a foot inside the green's edge, lag putts
brought in a tenth at a time when a green has no room, the putting ladder on
one line with room for as many as fit (three at least). The zone is 85% of the
golfer's driver carry from the tee (never past three quarters of the hole),
15 yards round. Called carries 60 yards to 80% of the shortest driver in the
group (at most 200), in fives, never the same twice running. A ball in water
where feet are added up counts 99 feet. A spot is picked up after eight
strokes; water or out of bounds there is two strokes from the drop. A long
drive is "in play" only on the fairway itself, as in a long-drive grid; Long
and straight also takes the first cut. Up and down's record is the most made,
fewest strokes breaking a tie.

**The challenge of the week** (16 October 2026, step 2). PLACED: it pays 100
XP for the first finish of the week (never multiplied, like the daily
bonus), 25 for beating the week's best (once a day) and 100 for a gold (once
a week), on top of the challenge's own pay. The pool is every challenge but
the three whose hole rule needs a feature (Over the water, Sand save, Short
side) -- 24 at its start, so a cycle is 24 weeks. Checked on the day: the
next nine weeks' courses (one per landscape) each host their pick. The four
achievements (First Medal 25, Gold Standard 150, All-Rounder 250, Weekly
Regular 150) are PLACED; Head of the Table waits for the head-to-head
challenges. **Rejected**: a fixed rotation (week 1 the first row, and so on)
-- predictable for ever, and adding a challenge would shift every later week;
a week key without the generator (a best set on a different hole would sit
beside the new one); recording the week's play as the challenge's own record
(it is a different course from the Challenge Course).

**Step 3: the last nine** (16 October 2026). PLACED: Every par 3 scores a
ball in water as a fifth of the hole's length (`HAZARD_SHARE`); Greens in
regulation plays a par 4 from the hole's length less the shortest driver in
the group, kept 90 to 200 yards out (a stock 250 for the week's challenge),
and a par 5 from 100 yards; Scrambler's drops are up and down's (3 to 18 yards
off); Putting tour's putts are 10 to 40 feet in fives, brought in a tenth at a
time where a green has no room; Bingo Bango Bongo picks a ball up after ten
strokes on a hole (`HOLES_GIVE_UP`), counts water or out of bounds two
strokes from where it was played, gives bango the moment every ball still in
play is on the green, and shares the win on a tie; a knockout puts out every
ball that scored nothing (off the green or fairway) unless all did, else the
one worst alone (a tie for last keeps them all), and after ten rounds the best
of the last round wins. A head-to-head win pays 30 XP inside the day's
allowance; Head of the Table is ten wins, 100 XP. All-Rounder's goal is the 33
challenges with medals. Sudden death's medals are 3 / 6 / 10 holes at par or
better, Bogey-free nine's 2 / 1 / 0 bogeys; both pay the long challenges'
first medals (50 / 100 / 200). **Rejected**: a sudden-death run that
`finished` the round when everyone was out (it would count a two-hole run as
a finished round for the handicap, Centurion and round XP; an endless run is
never finished); Bogey-free nine on any course (the owner's one fixed course).

**Measured with the play-through golfer** (tests/virtual-golfer.mjs, 16 October
2026; the Swing Meter on Normal, the ball model, the Challenge Course at
generator 36): a sand wedge carries exactly to the target marker from 10 to
60 yards on the range's flat turf and runs 3 to 4 yards after (so the golfer
lands a chip 3.5 yards short); a stock 7-iron to a 120-yard par 3 rolls 7.5
yards after landing with no spin added, 4.3 with the Swing Meter's spin at 3,
and a 9-iron with spin 3 about 1 yard -- so Hold the green's 5 yards asks for
spin or a shorter club, as meant. A steady golfer (taps within about 1% of
the bar) medalled in 26 of the 31 challenges with medals tried and scored in
29; the misses were putting (the golfer does not read greens). **Found**: One
club asked for an 8-iron, which the stock bag does not have; the game handed
over the nearest club and then scored it as the wrong one, so the challenge
could not be won with the stock bag. Fixed: the club is settled per golfer
from their bag at the start (challenge-spots.js `challengeClub`). A first
version of the golfer struck every swing a full bar-length after the distance
tap; a part swing is struck sooner (the marker runs back from where the
distance was set), and chips came up 40% short until that was fixed -- the
golfer's mistake, not the game's.

### Skins as a format (16 October 2026)

Skins was the fourth challenge, a stroke round with skins counted over it (the
spec: "a challenge, not a new round format"). The owner made it a round format
of its own, beside stroke, match, scramble and endless; the rule is in
src/skins.js. The plan, with the owner's seven decisions, is a local report
(docs/reports/SKINS_GAME_MODE_PLAN.md); the owner asked for it to be built
after reading the plan, and its seven recommendations were followed -- each is
marked PLACED below so it can be overruled.

**Sources.**

- Wikipedia, *Skins Game (PGA Tour)*,
  https://en.wikipedia.org/wiki/Skins_Game_(PGA_Tour) -- the TV event, 1983 to
  2008. Taken: a halved (tied) hole carries its skin to the next. Read and not
  followed: a halved 18th went to sudden death until one golfer won a hole
  outright, anyone not halving a playoff hole dropping out; hole values rose
  through the round (2008: $25,000 a hole for holes 1-6, $50,000 for 7-12,
  $70,000 for 13-17 and $200,000 for the 18th, $1 million in all); in 2001
  only, a "validation" rule -- a golfer who won a hole had to win or tie the
  next to keep it -- dropped the following year.
- Stymie, *What is a skins game*, https://stymie.golf/glossary/skins; GolfLink,
  https://www.golflink.com/golf-rules/golf-skins-game-everything-you-need-to-know;
  18Birdies help, https://help.18birdies.com/article/57-skins -- casual play.
  Taken: the lowest score alone wins; a tie carries. They agree a group must
  settle beforehand what happens to skins still carried after the last hole
  (split among the tied, a playoff, or the group's own rule) and whether
  handicap strokes are given; some groups play "no carryover", a tied skin
  simply dead. None of these is a governing body; there is no Rules of Golf
  or WHS text for skins.

**What the game does, and what is PLACED.**

- One skin a hole, every hole (PLACED; the TV game's rising values not
  followed: a skin is XP here, and later holes worth more would make the front
  nine matter less).
- The lowest score alone wins; **any tie for the lowest carries**, however many
  share it and whatever the others scored ("one tie, all tie", as on TV).
- **Skins carried past the last hole go unclaimed** (PLACED; the challenge did
  the same). Rejected for now: a playoff -- holes past the round's last, a card
  longer than the course, which touches saves and the handicap -- and sharing
  among the tied, which pays for a tie.
- **Gross only**, no handicap strokes (PLACED). handicap.js could rank holes for
  strokes (`strokesReceived`), but the index would have to be fixed at the
  start and saved with the round, and a golfer with no index would get none.
- **Every golfer plays every hole out** (PLACED): real groups pick up once they
  cannot win or tie a skin; here the stroke card stays whole for the handicap
  and achievements.
- **A golfer who joins mid-round** plays for skins from that hole; the holes
  before are decided among the golfers who played them (PLACED). The challenge
  version stopped counting at the first hole anyone had no score on, so a
  golfer joining froze every skin after it.
- Scores compare to two decimals, the precision of decimal putting.
- XP: **30 a skin** (the spec's amount, kept), paid when the hole is decided;
  **50 for the most skins alone** (`XP.win`, as for winning a match or a
  scramble; PLACED -- a tie on skins wins nobody). Skins XP is not scaled by
  the Swing Meter difficulty, like the round's own XP.
- Allowed in an endless run (no last hole is needed; the carry runs on); not on
  the course of the week, whose bests are strokes.

### Course of the week and achievements (14 October 2026)

No outside source. The XP amounts, thresholds and names are the agreed spec's
placeholders (8.2, 8.3), kept as written: course of the week 150 XP for the
first finished round a week and 50 for beating that week's best; achievements
50-300 XP. Two definitions were PLACED here: an up-and-down from sand is the
hole finished within one stroke of the last shot from sand (so a holed bunker
shot counts, and a fairway bunker 150 yards out counts if the next shot holes);
*Beat the Index* compares strokes over par with the sim handicap index scaled by
holes played over 18. Weeks are ISO weeks in the player's local time, so the
course turns over at their midnight Sunday to Monday, not at one moment
everywhere.

### Rewards: tracer styles and ball finishes (14 October 2026)

No outside source: the reward table is the agreed spec's (7.1), names as its
placeholders, and every look is PLACED by eye. Tracers: live width 3.5-11 px
(Classic 4.5, as before; the end-of-hole lines stay 3 px at 0.72 opacity),
comet heads 9-10 px over the last 10-14% of the line, Ribbon 11 px at 0.42
opacity with a 2.5 px white core, Dashed 2.4 m on and 1.6 m off, Lightning's
zigzag 0.9 m (widened in proportion past 120 m of shot) re-drawn 14 times a
second, flicker up to 45%, glints 36-48 alive for 1.1 s each at 10 px, Starfall
falling 1.6 m/s, colour runs on Aurora and Rainbow moving 0.12 and 0.25 of the
line a second. Ball finishes: a 256x128 texture, a 22-row dimple lattice at 7%
shading (30% of that on Chrome, 50% on Gold), Glow's own light 0.35 by day. The
close-up turns once every 4 s at 72 px. The level-up banner stays 4.2 s when it
lists unlocks, 2.8 s when not.

### The Swing Meter's sounds

Synthesised like every other sound (no recordings), PLACED by ear, and chosen
by the owner in one round on 14 October 2026 from three takes each
(`METER_FINAL` in sound.js): the voice an air whoosh whose band-pass centre
follows the marker (220 Hz x 2^(1.4 x position), times the owner's 0.63 pitch,
doubled for the noise band), a soft click for the distance, a sawtooth buzz
for overswing, a four-note marimba run for a perfect strike, a wood block for
the yellow zone, a low thunk for a miss and a falling whistle for a swing that
ran out. Offline renders (`tools/sound-lab/check.mjs`) put the one-shots at -15
to -19 dB peak and the voice at -32 dB peak, under the strikes and landings.
The first takes of the perfect strike came out 5 dB over full scale before
the limiter and were brought down about 20 dB before the owner heard them.

`tests/swing-meter.test.mjs` re-sweeps the corner where a come-back was ever
found (8 iron to lob wedge, every height, full swing and overswing, Soft, level
and a 2% rise) in under a second; the full sweep took a minute and is not a
test.

### The lie costs ball speed, for every golfer

The keyboard has always taken ball speed off for the lie: semi-rough 96%,
rough 90%, sand 72%. These were placed when the keyboard controls were written
and are not from a source. On 14 October 2026 the owner extended the rule to
launch-monitor shots, softened sand to **80%** for everyone, and asked for a
switch to turn the monitor half off.

**How it is applied to a monitor shot:** the measured ball speed is multiplied
by the lie's share; launch, direction, spin and axis are untouched. Chosen
because it is literally the Swing Meter's calculation (so a mixed group plays
one rule), because carry follows ball speed closely (about a yard per mph for
an iron, so 10% off speed is close to 10% off carry), and because it changes
one measured number rather than several. The measured number is shown and
recorded as sent, with the penalty beside it in red.

Compared and not followed:

- **GSPro**, as its users describe it in a Golf Simulator Forum thread (no
  official documentation found): a penalty that depends on vertical launch
  angle, low shots losing far more -- figures quoted there of about 60% for a 3
  wood and 10% for a pitching wedge from rough, semi-rough about 5%, rough
  about 8% speed and 15% spin; a 6 iron from 170 yd in rough 10-15%; a
  greenside wedge mainly a spin penalty. Unattributed in the thread and not
  checkable. Rejected: it would make monitor shots follow a different rule from
  the Swing Meter, and it has no source to check against. GSPro also has an
  off switch, which is where the owner's switch came from.
- **The Golf Club 2019**, from a forum-compiled table: about 7% distance lost
  from light rough, rough and fairway sand, 13% from heavy rough. Recorded as a
  comparison: our rough (10%) sits between; our sand (20%) is harsher. The
  owner chose 80% sand knowing TGC's figure.
- **Cutting spin as well (a "flyer").** A single-golfer GolfWRX Trackman test
  saw a 7 iron leave a thick lie at about 1,300 rpm, carrying 87 yd off 87 mph
  of club speed, while a down-grain lie gave 115 mph of ball speed against 121
  from the fairway. Rejected for now: a flyer can carry *further* than the
  fairway shot, which works against a penalty, and it would be a second hidden
  change to a measured number.
- **Taking the loss off the carry instead of the ball speed.** Rejected: the
  game would have to solve a speed for that carry anyway, and speed is the
  number the rule is stated in and the number shown in red.

Sources in REFERENCES.md *The Swing Meter*.

## The smoke test on GitHub: three harness faults (16 October 2026)

The tests workflow's smoke step (`--software --only boot,range,endless-round`)
failed on 6 of the 8 pushes to `main` from 9 to 16 October, always in
`endless-round`. Read from the logs and the `smoke-screenshots` artifacts of
runs 37884702842, 37885197331, 38036233362, 38036513481, 38128966772,
38523037456, 38856836307 and 38857024163, against the passing 37736602143,
37964439423, 38128860890 and 38522786171. The game was right each time.

- **Putts that never dropped (both 0.8 merges).** The putt's stop was tapped
  from a `requestAnimationFrame` callback once the drawn marker had passed the
  target. The game judges the tap on the event's own time, so the stop was late
  by however far the marker had gone since the frame was drawn plus the frame's
  own work. A putt's marker runs at 1.15 s per bar length at Normal, times 1.15
  for a putt and 1.25 for a short putt's quarter bar -- about 1.65 s; the
  software renderer's frame was measured at 0.8 to 1.6 s (the header of
  `tools/smoke.mjs`), so the stop could come most of a bar late. The screenshots:
  after six putts the ball 8.1 ft away on one, 23.4 ft away in the semi-rough on
  the other. The passing runs' putt out took about 21 s; these took 167 s and
  224 s.
- **Space refused (0.6, 0.6.1).** The putt had dropped -- the screenshots show
  one under par and the next hole growing, or hole 2 already in play -- but the
  harness waited a fixed 6 s for the scorecard, not scaled for the software
  renderer, then took the missing card for a miss and putted on a finished hole,
  which the game rightly refuses.
- **A click timing out (0.7).** `menu ready` alone took 98 s on that runner
  (16 s on the fastest). The click on Start an endless run timed out at 120 s,
  and the screenshot shows the round in play on hole 1 with nothing hit: the
  press had landed, and Playwright's click was still waiting on a page busy
  starting the round.

**The fix, in `tools/smoke.mjs`.** The tap is sent through the DevTools
protocol with a `timestamp`: `lab.state().swing` reports the swing's start and
its pace, the harness works out when `markerAt` reaches the target share, and
the press carries that moment. Chromium turns the stamp into the event's time
by anchoring the wall clock to its tick clock at dispatch (the source below),
and `PointerEvent`s keep that time, so the page's `event.timeStamp` is the
moment asked for, however late the busy page handles it -- what a player's tap
during a slow frame is. The page clock maps onto the epoch through
`performance.timeOrigin`; the two processes' clocks agree to well under the
roughly 20 ms that would move a two-yard putt by a third of a foot. Holed or not
is read from `lab.state().holeComplete` the moment the putt stops, and the
scorecard's wait then scales with the renderer. A Start press that times out is
forgiven once the game has left the menu.

**Rejected.** Raising the fixed waits: the putt was missing for real, so no
wait would have holed it. Scheduling an in-page synthetic tap with
`setTimeout`: a synthetic event's time is when it is created, and the page's
main thread is not free at the moment it is wanted. Reading the pace from two
drawn frames instead of the lab: workable, but it rests on the frame's
timestamp matching the draw, and the lab already knows. **Not yet seen
running on GitHub**: no browser was run locally (AGENTS.md, the graphics card
rule); the first push of the branch is the test.

**The first push of the fix ran out of time instead (run 38961631676).** No
step failed; the job's 45-minute limit cancelled it in `endless-round`, just
before putting out. The change was ruled out: boot, which runs none of it, was
already slow -- "the world is in menu mode" and "the build names itself" are a
single page read each and took 13.1 s and 11.4 s, against 0.0 s on every
earlier run -- and the code it added is not reached before putting, apart from
the start-click fallback, which is what let that step pass at all. The runner
was slow. The steps that need no browser show the spread, in seconds:

| run | `npm test` | ground check | smoke step |
|---|---|---|---|
| 38522786171 (0.7, green) | 297 | 33 | 384 |
| 38856836307 (0.8) | 314 | 45 | 535 |
| 38036233362 (0.6) | 539 | 60 | 958 |
| 38857024163 (0.8) | 483 | 61 | 1,070 |
| 38961631676 (the fix) | 546 | 72 | over 2,061 |

So the runners differ about twofold on CPU-only work and the smoke step about
sevenfold with them, and the slowest runner yet came last: each `endless-round`
step took about three times as long as on the 0.8 run at 1,070 s (menu ready
104 s against 38, the cameras 348 against 129, the drop 259 against 95).
Scaled the same way, the steps it had left needed about fifteen minutes more,
about an hour for the whole job. The job limit went to 90 minutes, with 70 on
the smoke step so that running out fails the step (the upload still runs)
rather than cancelling the job (nothing kept).

**Rejected for now.** Drawing fewer pixels: automatic resolution already takes
a software run to its floor of half the pixels, and pixels were the lever only
on the 32-core machine. Running the page at a device pixel ratio of a half,
which would also halve the page's own compositing (its blurred panels over the
canvas): it might help, and might not, and nothing can say which without a
browser run, which waits for the owner. A slimmer CI journey: the endless
journey's controls -- clubs, aim, the Swing Meter's keys, the cameras -- took
two thirds of its time on the slow runner, but they are what the journey is
for, and cutting them is the owner's call. Also seen, and fixed in its own change: every
Endless round was at midnight (next entry).

**A fourth finding, in the game: every Endless round was at midnight.** Every
`endless-round` screenshot -- GitHub's, and the GPU runs here -- shows the
round at 12:00 AM under the stars, though the menu's hole is only ever shown in
daylight (`MENU_HOURS`, 6.4 to 17.8). Not the software renderer: a real bug for
any player whose clock had never been set. The cause, read from the code and
held by a Node test (`tests/floodlights.test.mjs`, *Endless off the menu*):
the menu puts the player's clock aside before showing its own hour, and on a
fresh device that clock's hour is null (`loadDaylight`). Endless adopts the
menu's world without rebuilding it -- the point of the adoption -- and called
`restoreClock`, which put the null back. Only building a world replaces a null
hour with the biome's default (`renderer.js`, `build`); `solarState` and
`advance` read it as 0:00. Opening the studio had the same hole on 1 October,
fixed then by starting it at midday; this path was missed because it never
rebuilds.

**The rule, settled.** Three documents (PLAYING.md, this file's 30 September
entry, the comment over `middayForRound`) said Endless keeps the showcase
hole's hour; the code restored the player's clock, and an older line in
PROJECT_HANDOFF said that was deliberate. The newer claim was followed: the hole
you chose is played in the light you chose it in, and adopting has no loading
screen to hide a jump to another hour. `roundHour` in `src/daylight.js` now
decides every round's starting hour: local time if "Start at my local time" is
ticked, else the showcase hour when Endless adopts the menu's hole, else midday.
**PLACED:** an endless run that grows its first hole (a replay from the
profile, or Endless chosen during a round) now starts at midday like a course
from Play; nothing had decided it, and it followed the player's old clock --
which on a fresh device was the biome's default, late afternoon. **Rejected:**
restoring the player's clock and falling back to the biome default when it is
null -- it fixes midnight, but a player who last played at night would still
see the daylight hole they picked turn dark the moment they chose it. Midday
for Endless too -- simple, but the hole would visibly re-light at the moment of
choosing. Rendering only: no generator or schema version moves. **Not seen in
the game**: no browser was run (the GPU rule); the next `endless-round`
screenshot should show daylight.

Sources in REFERENCES.md *The smoke test on GitHub*.

## Low and Medium trees: striped crowns and shards (16 October 2026)

The owner: on Low and Medium the trees "look like a mangled mess". Captured
the same views on every tier (1600x900 at density 1, a plain laptop screen;
Pacific Northwest CEDAR hole 3 and 1, Autumn MAPLE hole 2, Midwest MEADOW,
Redwood PROFILE) and found two separate faults, both absent on High and Ultra.

**1. Distant crowns torn into shards (`farTrees`, F2).** A crown short on
screen was drawn as its thinned twin (`thinSprays`: a third of the leaf
geometry's connected pieces, each grown by the square root of three about its
own centre). That suits what it was built and judged on -- a grown redwood,
13-53 thousand leaf triangles in thousands of sprays. A Kenney cartoon crown is
a few flat faces: `tree_oak` is 64 leaf triangles and its twin 16, the
default tree 40 -> 17, the tall pines 68 -> 22-33, the palms ~167 -> ~60. Kept
a third and enlarged, those faces float apart as flat orange and green shards
past the green -- the "mess". And because a cartoon tree is short, far more
crowns crossed the 15%-of-screen line than F2 measured on Redwood (43% from the
edge tee, 4% mid-course): **84-93% of every crown drawn**, everything past the
60 m always-whole radius (`thinCrowns` 0.876 Pacific Northwest, 0.898 Autumn,
0.926 Midwest, from tee 1). All of it to save about 48 triangles a tree.

Fixed in `src/instance-cull.js`: a crown gets a twin -- far mesh or shadow
twin -- only with at least `TWIN_MIN_TRIANGLES` (2000) leaf triangles, which
every grown tree has and no cartoon crown comes near. `farTrees` stays .15 on
Low and Medium, so Redwood keeps exactly what F2 bought (`thinCrowns` 0.358
before, 0.34 after: the cartoon understorey no longer counts). High and Ultra
never drew far crowns, but their middle and far cascades took cartoon crowns'
SHADOWS from the same shards; those are now cast by the whole crown.

Rejected: `farTrees: 0` on Low and Medium. It also cleared the shards, but
throws away the Redwood edge-tee saving F2 measured (3.15 -> 2.62 ms on Low),
the one case where the twin earns its place and looks right.

**2. Every near crown striped (shadow acne).** Diagonal bands across each
sunlit crown, coarse on Low and fine on Medium, which the three-band toon ramp
turns into hard stripes. A shadow map's normal offset (`shadowBias.normal`,
metres) must be about a texel of that map or a surface shades itself. Texel
sizes: Low's 512 map over a 280 x 310 m span is ~0.55-0.6 m; Medium's 2048
over 370 x 410 m ~0.18-0.2 m; High and Ultra's nearest cascade a few
centimetres. Low and Medium both had .15 -- a quarter of a texel on Low --
while High's .055 is over a texel of its far finer map.

Swept live on the same frame (`variants.mjs`, scratch): Low .15 / .4 / .7 --
.4 still showed faint bands, .7 none; Medium .15 / .25 / .35 -- .25 still
banded, .35 clean. **Chosen: Low .7, Medium .35.** It moves only where a
fragment looks itself up, so it costs nothing per frame. The price is
geometric: a shadow ends that offset over the tangent of the sun's height
sooner, ~1.9 m on a 40 m tree shadow at 20 degrees on Low; on screen the
ground shadows were indistinguishable before and after. **The floodlights
keep .15** (`shadowBias.flood`): their 512 maps cover a pool a few dozen
metres across, and the sun's offset would lift lamp shadows off the trunks.

**What it cost.** Real GPU (RTX 4090, headless, vsync off, the profiler's
probe; builds alternated before/after, two samples each; the slower of the two,
except the mean for Redwood Medium after and Redwood High), tee 1, seed
PROFILE, density 2. Graphics ms, draw calls, triangles:

| Course, tier | Before | After |
| --- | --- | --- |
| Pacific NW, Low | 0.64 ms, 306 calls, 3.09 M | 0.64, 235, 3.21 M |
| Pacific NW, Medium | 1.32, 307, 3.15 M | 1.31, 236, 3.29 M |
| Pacific NW, High | 2.45, 400, 6.45 M | 2.46, 400, 6.70 M |
| Autumn, Low | 0.64, 345, 3.39 M | 0.66, 269, 3.51 M |
| Autumn, Medium | 1.36, 348, 3.47 M | 1.38, 270, 3.60 M |
| Autumn, High | 2.60, 466, 7.09 M | 2.61, 466, 7.31 M |
| Midwest, Low | 0.65, 292, 3.37 M | 0.65, 234, 3.45 M |
| Midwest, Medium | 1.39, 299, 3.51 M | 1.39, 235, 3.60 M |
| Midwest, High | 2.67, 394, 7.14 M | 2.69, 394, 7.29 M |
| Redwood, Low | 2.49, 371, 46.5 M | 2.50, 351, 46.7 M |
| Redwood, Medium | 3.59, 375, 48.8 M | 3.69, 354, 49.0 M |
| Redwood, High | 8.10, 564, 85.4 M | 7.98, 564, 86.2 M |

No graphics time moved beyond sample noise (Redwood Medium's two after samples
were 3.57 and 3.81; Redwood High's before samples 7.68 and 8.51). **Low and
Medium make 20-78 fewer draw calls a frame** -- the far meshes for cartoon
models are gone -- for 2-4% more triangles, which cartoon crowns make cheap.
On a weak machine fewer draws is the better side of that trade (it is
processor time, which a weak laptop has least of); triangles were shown nearly
free on this path in *A grove grown from nothing*. High gains 1-3% triangles
and no draws. NOT MEASURED: the software-rasteriser arm (`--only weak`), left
alone because a CPU-only smoke run took the owner's machine down on 13
October; nor any real weak laptop (TODO, *A real phone, an iPad and a weak
laptop*).

## The 1.0 interface: palettes, contrast and the canvas (17 October 2026)

Phase 0 of the 1.0 interface (branch `ui-1-0`; PROJECT_HANDOFF *The 1.0
interface: layout rules*). The layout numbers -- 12 degrees, 60 px margins, 14
px gutters, the bands, the type sizes -- are the owner's, settled in the
mockup rounds, not measured. What has a number of its own:

**The nine palettes' contrast**, by the WCAG 2 contrast ratio (REFERENCES,
*The 1.0 interface*), with the see-through panel laid over white (the worst
case for light text) and over black. The thresholds are WCAG 2.1's AA minimum,
**4.5** for ordinary text and **3** for large text (24 px, or about 18.7 px
bold); 3 is used only for the under-par scores, which are always 24 px or
more. Over white, every palette passes with room:

| Biome | white | label | accent | hot | under par | on hot | on accent (light end) | on accent (dark end) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pacific Northwest | 12.2 | 7.8 | 8.2 | 9.8 | 4.5 | 13.3 | 11.2 | 3.0 |
| Desert | 11.7 | 7.6 | 8.1 | 11.7 | 4.3 | 17.5 | 12.1 | 4.9 |
| Mountain | 12.7 | 7.3 | 7.0 | 8.8 | 4.6 | 12.5 | 10.0 | 3.5 |
| Links | 11.4 | 7.5 | 9.8 | 9.8 | 4.2 | 14.5 | 14.5 | 5.5 |
| Midwest | 11.8 | 7.3 | 6.8 | 7.7 | 4.3 | 10.8 | 9.5 | 3.3 |
| Island | 12.0 | 7.8 | 6.6 | 5.6 | 4.4 | 7.8 | 9.3 | 4.6 |
| Giant Redwood | 13.5 | 7.3 | 4.9 | 10.8 | 4.9 | 14.7 | 6.6 | **2.3** |
| Autumn | 12.0 | 7.7 | 7.2 | 12.0 | 4.4 | 17.3 | 10.4 | 3.3 |
| Haunted Hollow | 14.4 | 7.8 | 5.5 | 6.4 | 5.3 | 8.2 | 7.1 | 3.3 |

The last column is not tested: a highlighted box is a gradient from the
accent `a1` to the darker `a2`, and text sits at the light end in the approved
mockups. Giant Redwood's 2.3 there fails even the large-text figure, so a
screen must not put text at the dark end (TODO, *The 1.0 interface*).
Separately, Giant Redwood's and Haunted Hollow's accent was almost the shared
under-par red (contrast 1.0 between them), so an under-par score is written
only on a panel. **Since 21 October 2026 under par is green** (`#6ee38c`, the
owner's call, to match the scorecard): against each biome's accent it measures
1.04 (Autumn) to 1.72 (Giant Redwood) -- every accent is about as bright -- so
the same rule holds, and it passes the panel check (3, large text) in every
biome (tests/ui-palette.test.mjs).

**The canvas floor for the Text size: 1024 design pixels, PLACED** (125% on a
16:9 canvas). At 1024 x 576 the 16:9 grid's columns are 55.8 px; at 1024 x 768
(4:3) 52 px. Chosen as the narrowest a 12-column screen drawn for 1280 plausibly
survives; no screen has been laid out at it yet.

**The typeface's weight in the page: +58 KB** (17,213,640 to 17,271,965
bytes): the two woff2 files (17,808 and 17,984 bytes) base64-encoded, the
kit's stylesheet, and about 5 KB of licence text in Help's notices. The plan's
estimate was 130 KB, made for four weights including italics the family does
not have.

**The round screen's size (phase 1, 17 October 2026).** Every piece of the
round screen is laid out in design pixels for the 1280 canvas and zoomed by
`hudScale` (round-hud.js). Two numbers there are PLACED, not measured: the
pieces are never drawn smaller than **0.75** (a small window crowds rather than
shrinks to nothing), and never wider than the screen over **1160 design
pixels** (`ROUND_MIN_WIDTH`): along the foot the club panel reaches about 368
(30 margin, 86 code block, 22 + 200 name, 30) and the centred meter is 400, so
the two need 368 + 8 + 400 / 2 on each side of the middle. On a 16:9 screen
that leaves the Text size about **+10%** on the round screen (1920 x 1080 at
125%: pieces drawn 1.66 screen pixels per design pixel, against 1.5 at 100%).
The tests check, at seven screen sizes and four Text sizes, that the club and
the meter never meet and the slab and the cards never meet.

**Round 13 drew it all at 0.7** (`COMPACT`, 17 October 2026): the owner
asked for everything 40-50% smaller, and the round-13 mockups set margins
40, rows 32 and text 10 / 13 / 16 / 24 / 36 against round 9's 60, 48 and 13 /
18 / 24 / 36 / 56. Those ratios run 0.64 to 0.77; 0.7 sits in the middle
(area 0.49, so "about half"), and the smallest labels were written up from
13 to 14 px so they draw at about 10. PLACED: one factor, not per-piece sizes.

**Shot moments' timings (phase 2, 17 October 2026).** The pop-up shot card holds
**6 s** and fades over **0.6 s** (`CARD_HOLD_MS`, `CARD_FADE_MS`): PLACED, long
enough to read three numbers from the mat, gone before the next golfer has
usually picked a club. Since 18 October 2026 that timing is only a skipped
shot's: a card shown as the ball rests stays exactly as long as the rest hold
(3 s, or 4.5 s with the shot-line review, `SHOT_HOLD_SECONDS`,
`REVIEW_HOLD_SECONDS`) and goes as the camera moves on -- the owner saw it
sitting on the next address. The hole-out band's **0.2 s in, 1.5 s hold, 0.3 s out**
is the approved mockup's (*Big but brief*); the quiet strip's **0.15 / 1.3 /
0.25 s** is PLACED to sit under it. The old banner held 2.7 s.


## The 1.0 interface's sounds, wired in (17 October 2026)

**What plays.** The owner picked, in the 1.0 mockups, the prog-metal chiptune
in a clean tone, family C ("a half-time groove with an echoing lead"), with a
melody of its own per moment, and the clean interface set; then said "you can
also wire all the new sounds i agreed on" (17 October 2026, the overnight
build). `src/chiptune.js` plays them, ported note for note from the approved
mockup page (`docs/reports/ui-1-0/mockups/index.html`, local). In the game:
hole in one, eagle, birdie, par and bogey play family C; **albatross, double
bogey and worse keep the 14 October jingle**, because family C has no tune for
them (PLACED: an albatross could take the eagle's tune or the ace's, a double
the bogey's). A new level and the XP bar filling play family C's level-up and
XP tunes in place of the XP popup's signed-off `levelUp` and `fill` takes (its
`gain` take stays: family C has nothing for it). Round complete plays the
first time a round's results open. The interface sounds play on menu moves
(arrows, d-pad), presses on the main menu and the Esc list, Escape out of the
Esc list or a panel, the map's green-reading buttons, a locked look in the
locker, and the monitor's ball light turning Ready while armed. Interface
sounds closer than 45 ms are skipped rather than stacked (PLACED).

**The marimba is deleted** (`INSTRUMENTS`, `score()` and `FINAL.scores`), as
the owner chose on 16 October ("Delete", no option). Each score's name and its
round-3 tune as notes stay in `SCORES`: the stings report's chip takes A-C play
them.

**Levels** (`tools/sound-lab/check.mjs`, limiter off, `CHIP_LEVELS` 0.32 for
the moments and 0.22 for the interface; PLACED from the mockup, where the owner
heard them at one master level). Peak / RMS dB:

| Sound | Peak | RMS | Length s |
|---|---|---|---|
| Hole in one | -6.8 | -25.4 | 4.8 |
| Eagle | -9.5 | -27.9 | 3.8 |
| Birdie | -11.2 | -39.3 | 2.4 |
| Par | -14.9 | -38.2 | 2.0 |
| Bogey | -19.2 | -42.7 | 3.1 |
| Level up | -7.5 | -26.9 | 4.4 |
| Round complete | -6.0 | -25.8 | 4.7 |
| XP counting | -19.7 | -48.6 | 1.4 |
| Interface (six) | -14.6 to -31.5 | -37 to -58 | 0.1-0.5 |

Against the 14 October jingles they replace (RMS about -31 for a hole in one,
-36 for a birdie, -36 for a bogey) the big moments are 4-6 dB louder and
birdie and bogey 3-6 dB quieter; the XP count, sparse pings with an echo, sits
about 18 dB under the old `fill`. This is the balance the owner approved in the
mockup; whether it holds in the game, over ambience and on a projector's
speakers, has not been heard (TODO).


## The tiny course models (round 14, 17 October 2026)

**What is real and what is placed.** The holes on a card's model are the
course's own: `layoutFor` (generateCourse + routeHoles, the generator's
routing) gives every tee, centre line, green, bunker and pond, scaled so the
course fits a 200 x 120 plan. **PLACED:** the ground is a seeded relief
(three sine terms per landscape, amplitude 4 for Island to 13 for Mountain:
the mockup's `RELIEF14`), flattened along the holes and dug into a bed under
each pond, not the generated terrain; the trees are a per-landscape rule
(cones for PNW, Mountain and Redwood; round for Midwest, Links and Autumn;
palms for Island; cacti for Desert; pale dead trees and pumpkins for Haunted
Hollow), up to 0.3-1.5 times 880 trees for a nine (1,360 for an eighteen), kept
off the holes and the water and thicker beyond the course -- not the real
planting. Fairways are drawn at least 5.6 model units wide (36 m x 1.3 at the
plan's scale) and greens at least 3.4 in radius, wider than true so they read
at card size (PLACED). Reason: building the real landscape takes seconds and a
card must show at once; a model takes 50-100 ms (Node, the framing test).

**Framing** (the mockup's, checked by tests/model-framing.test.mjs on the
game's courses): tilt sin(e) = (course width / depth) / box aspect, held to
0.6-0.82 (37-55 degrees); the camera as close as every tee, green and
mid-line allows with 6 units of room at both ends of a +-0.08 rad sway; then
in by 5% steps until rays through the box's edge all land on the land (which
runs 140 units past the plan across and 115 front and back). 20 of 20 boxes
pass for five landscapes x four shapes (186 x 92, 197 x 66, 96 x 52, 16:9).

## Challenge a friend: codes, shots flown again, and no servers (20 October 2026)

`src/rival.js`; the owner's decisions and the code's layout are in
PROJECT_HANDOFF *A friend's challenge*. What was measured and what was placed:

**No server can be Netlify (searched, not fetched).** Before this was chosen
the owner asked whether Netlify, which hosts the website, could relay online
play. It cannot: Netlify's functions answer one request and stop, and the
forum answers say WebSockets are neither served nor proxied; Netlify's own
blog calls serverless WebSockets a contradiction. It could only be a polling
mailbox, which is a server on the website's account, and a free site over its
monthly allowance (300 credits since the credit plans of September 2025) is
suspended for the rest of the month -- the website and its Download buttons
with it. Sources in REFERENCES, *Challenge a friend*; read through search
summaries only, so worth a fetch before anyone relies on them. **Recalled,
not measured or sourced:** that about one home connection in ten cannot be
reached directly and needs a relay (said to the owner as a rough figure).

**What a code costs.** Measured with a crude bot (aim at the pin, no misses
modelled) on seed `MEASURE`, the default course at 18 holes: 139 shots.

| a shot carried as | characters a shot | 18 holes (139 shots) | scaled to 85 shots |
| --- | --- | --- | --- |
| its path, thinned to within 5 cm | 126 | about 18,000 | about 11,000 |
| its path, within 10 cm | 84 | 12,203 | about 7,500 |
| its path, within 20 cm | 72 | 10,564 | about 6,600 |
| its launch numbers (chosen) | 21 | 3,400 | about 2,300 |

The card and course alone are 524 characters. Thinning kept 20, 12 and 10
points a shot of 304 recorded. **Paths were built first and REJECTED** the same
day: they work across versions, but a round past 7,000 characters is too long
for some chat apps (Discord takes 2,000 a message). The owner then made the
same-version rule, which is what lets launch numbers stand in for the flight
(below). 85 shots is a round in the high eighties, scaled from the per-shot
figure, not measured.

**Exact or nothing.** One part in a thousand of launch speed moves a drive's
finish about 304 mm, and the model's error grows roughly linearly with an
amplification of about one (the September multiplayer study, measured by
perturbing launch speed). So a launch number rounded when the code is made is
a different shot. Instead every shot is rounded BEFORE it is flown
(`gridShot`): **PLACED** steps of 0.01 m/s, 0.01 degree (launch, direction,
spin axis), 0.001 degree of aim, 1 rpm and 1 mm. For scale, a monitor's 0.1
mph is 0.045 m/s and its angles come in tenths, so a monitor's numbers land on
the grid unchanged, and a Swing Meter shot moves by less than any readout
shows. Checked: a shot read back from its numbers flies to the same bit on a
flat test ground (`rival.test.mjs`), and eight shots over two holes of a
70-tree course in 12 mph of wind, grown again from the code's settings, all
stop on the same millimetre.

**Still not guaranteed across machines.** Two engines that agree to fourteen
places can fall either side of a lip or a branch (the same study). Each shot
carries its finish to the millimetre; a re-flown shot that ends more than 5 cm
from it (**PLACED**) has its line drawn on to the true finish. The card is
carried whole, so the result never depends on it. How often it happens is
unmeasured: it needs two different machines.

**Placed rules** the owner did not set, each overrulable: only stroke play, 9
or 18 holes (the card is strokes; a 3-hole round is a legacy save); a golfer
"played on a launch monitor" if any of their shots that round came off it,
else the Swing Meter; at most 40 shots a hole and 50,000 characters a code
(guards against a damaged code, not limits a round meets); the 20 newest
pasted challenges kept; the friend's shots drawn white, dashed 1.2 m on and
off, whatever the shot-lines setting. **Set by the owner (20 October):** card
and flights both; total strokes decide it, each hole's winner shown; the
rules shown, not forced; the same version or no challenge.

**The version is package.json's plus the build's commit.** package.json said
1.0.0 from this repository's first commit until it became 0.9.0 (b7131e2), so
the releases before 0.9 all called themselves the same thing; the commit
tells releases apart, and every copy of one download shares it.

## Trees cleared from the play camera's view (21 October 2026, UI/UX pass)

PLACED, not measured against any source: a tree is hidden from the play
camera when it is within 30 m along the line to the ball (or to the point
looked at) and either within its crown radius x 1.2 + 1 m of that line, or --
when its crown would span a fifth of the picture (crown radius x 1.5 over the
distance > 0.2) -- within the picture's width, tan 42 degrees = 0.9 of the
distance (a 16:9 frame at 53 degrees vertical is about 85 degrees across). The
tree must reach the line: its top (height x 1.1) above it and its foot less
than 2 m under. Found on the audit's Midwest seed AUDIT hole 1 (an oak of
radius 4.8 m 22 m out, 26 degrees left of the look) and the Challenge Course's
third. Drawing only; the ball still meets the trunk.

## Frame time on Ultra: the frame-rate goal (22 October 2026)

The owner set a goal on 22 October: frame time down by up to 20% on Ultra,
with the gains carried down to the lower tiers; the look kept close to what it
was, generated courses unchanged, no new models (a need for lower-polygon
models is noted, not acted on). GPU runs were allowed for the goal, within
AGENTS.md's limits (40 runs for this goal, each gated and logged in
`bench/ab/gpu-runs.jsonl`, local).

### The tools built for it

- **`tools/frame-ab.mjs`** -- two builds alternately (A B B A), each load in a
  fresh browser, several tees measured from one course load, median of the
  per-load medians, plus draws, triangles and (`--shots`) the share of pixels
  changed between builds beside the share between two loads of one build.
- **`tools/frame-variants.mjs`** -- ideas tried live in one page of the hooked
  build (`tools/capture/build-hooked.mjs`, `window.__view`), each measured
  between two measurements of the unchanged frame; `--cpuprofile` adds the
  DevTools sampling profile of the processor (build with `MINIFY=0`).
- **`tools/gpu-gate.mjs`** -- the gate every run passes: 30 s of `nvidia-smi`
  under 10% and below 60 °C, 5 minutes since the last run, the goal's cap
  (all four are arguments, so a goal with its own limits -- the cartoon
  overhaul's 30%, 80 °C, a minute apart, no cap -- passes its own). Since 25
  October 2026 it also waits while the card holds a Playwright browser or a
  Blender that this run did not start (`foreignJobs`): two goals in two folders
  keep two logs and cannot see each other's runs otherwise. The owner's own
  desktop Chrome is not counted.
- **`tools/devices.mjs`** -- device profiles (below); **`tools/png-diff.mjs`**
  -- a PNG decoder and changed-pixel count, no dependency.

**The noise floor (run 1).** The baseline build against a copy of itself,
Ultra, Redwood seed PROFILE, 1600x900 at 2x, tees 1, 5 and 9, two loads each:
per-tee medians agreed within 1-4%, the mean over the tees within 1.3%; tee 1
5.2 ms GPU / 6.0 CPU, 68.0 M triangles, 563 draws; tee 5 5.1 / 5.0, 31.0 M,
517; tee 9 4.7 / 5.4, 61.8 M, 533. Pixels changed between two loads of the same
build: 2.2-2.9% at tee 1 (wind in the near grass and crowns), 0.6% at tee 5,
0.2-0.3% at tee 9. So a change has to beat about 2% of frame time to be seen,
and a picture change has to stand above those shares to be real.

### Devices for the frame tools

This machine cannot be a phone, so a device is its screen (viewport, pixel
ratio), its processor (Chrome's CPU throttling at the ratio of single-core
scores) and its graphics, which are NOT emulated: the card's measured time is
multiplied by the geometric mean of the compute ratio and the memory-bandwidth
ratio against the RTX 4090. That factor is PLACED -- a frame here is partly
shading and partly shadow-map and overdraw traffic, and peak figures flatter
phones against desktops -- so it ranks changes and suggests which tier a
device can hold; it is never a number to promise. The real check stays a real
device (TODO, *A real phone, an iPad and a weak laptop*).

| Device | GPU FP32 | Bandwidth | Geekbench 6 single-core |
| --- | --- | --- | --- |
| RTX 4090 + Ryzen 9 7950X (this machine) | 82.6 TFLOPS | 1008 GB/s | 2994 |
| Intel UHD 620 + i5-8250U (weak laptop) | 0.38 | 38 (PLACED: dual-channel DDR4-2400) | 1127 |
| Apple M1, 8-core GPU | 2.6 | 68 (PLACED: LPDDR4X-4266, 128-bit) | 2340 (PLACED, from memory of Geekbench's chart; not fetched) |
| Radeon 780M (Ryzen 7 7840U) | 4.1-4.3 (4.2 used) | 120 (PLACED: LPDDR5X-7500, 128-bit) | 2500 (PLACED) |
| Apple A15, 5-core GPU (iPhone 13) | 1.71 | 34 (PLACED: LPDDR4X-4266, 64-bit) | 2168-2307 (2277 used) |
| Adreno 740 (Snapdragon 8 Gen 2) | 1.74 | 68 (PLACED: LPDDR5X-8533, 64-bit) | 2004-2012 (2004 used) |
| Mali-G52 MP2 (Helio G85, budget Android) | 0.072 (low end of a 72-144 GFLOPS range for the G52) | 15 (PLACED: LPDDR4X, 32-bit) | 408-432 (420 used) |

Sources: RTX 4090 82.58 TFLOPS and 1,008 GB/s, hydrahost.com/nvidia/geforce-rtx-4090
and notebookcheck.net (*NVIDIA GeForce RTX 4090 GPU Benchmarks and Specs*);
Ryzen 9 7950X single-core 2994, one Geekbench browser upload
(browser.geekbench.com/v6/cpu/164421), a single run, not an average; A17 Pro
2.15, Adreno 740 1.74, Mali-G57 MP4 0.40, UHD 620 0.38, from cpu-monkey.com's
iGPU pages (AIDA64-derived peaks); A15 (5-GPU) 1,713 GFLOPS, cpu-monkey.com's
A15 comparison pages (640 shaders x 2 x 1.34 GHz agrees); M1 2.6 TFLOPS,
Apple's own figure as quoted by nanoreview.net; Radeon 780M 4.1-4.3 TFLOPS,
nanoreview.net; iPhone 13 single-core 2168-2307, Geekbench browser uploads;
Snapdragon 8 Gen 2 single-core 2004, nanoreview.net, and 2,012 for an iQOO Neo
9 Pro (gizmochina); i5-8250U single-core 1127, cpu-monkey.com; Helio G85
single-core 408-432 (median 423), notebookcheck.net and nanoreview.net, and the
Mali-G52's 72-144 GFLOPS range from a general overview page
(android-headunits.com/mali-g52-gpu) that does not break out the MP2 -- no
source gave the MP2 alone. Rejected: one forum's 5.7 TFLOPS for the Adreno 750,
which nothing else supports. Peak TFLOPS are not comparable across
architectures; that is part of why the factor is only an estimate.

### Where an Ultra frame goes on this machine (runs 2 and 3)

**The processor sets the frame here, not the card.** In every case the CPU
time per frame (5.0-6.1 ms) was at or above the graphics time (4.7-5.4 ms),
and the graphics timer cannot be read as card work when that is so: a
TIME_ELAPSED query spans the wall-clock gap between its start and end on the
card, so while the page is still issuing commands the card's "time" includes
waiting for them. Switching passes off one at a time (`tools/frame-variants.mjs
--variants tools/variants/ultra.mjs`, Redwood PROFILE, free camera at tees 1
and 5) gave: every shadow map frozen -32% (tee 1) and -64% (tee 5) graphics,
-0.6 to -1.0 ms processor; planting hidden -70%; pixel ratio 1.5 -14% at tee 1
only; bloom off and 4096 maps within noise at tee 1; one cascade frozen alone
inconsistent (+4% to -25%) -- read as noise on a processor-bound frame.

**What the processor did** (DevTools sampling profile of the unminified build,
240 frames): `holdFlagsticks` 1.6-1.8 ms a frame, 25-29% of all of it, for a
loop of nine flagsticks -- the time was its first line, `canvas.clientHeight`,
which makes the browser work out its styles there and then whenever the page
has been written to since the last frame; the hole map's outline (`drawMap`,
and under it `fairwayWidth`, `ovalRadius`, `greenRadius`, `toWorld`) about
0.9 ms a frame on average; three.js's own submission about 1 ms.

**What wrote to the page every frame** (MutationObserver over 120 frames, and
DevTools' Performance metrics): 2-3 style recalculations a frame costing 1.7
ms together, no layouts. Every frame: the map canvas's `data-course-seed`,
`data-hole-number` and `aria-label` (set on each draw, unchanged), the free
camera's altitude text, the flag label's `class`, the aim label's `hidden` --
mostly to the values they already had -- plus the round screen's `--wind`
custom property, which sits on `#roundHud` and so restyles every piece of
the round screen it contains. Reading the canvas size from a stored value
instead (a live patch) took the processor's frame from 5.3 to 3.9 ms (tee 1)
and 4.8 to 3.3 ms (tee 5).

### Checkpoint 2: what the processor fixes and the staggered cascades gave (run 4)

Built (commit ace0cfa): page writes only on change (main.js `setText`,
`setHidden`, `setClass`, `setStyle`; the wind arrow's `--wind` on the arrows),
the canvas size kept until a ResizeObserver reports a change (renderer.js
`cssSize`), the map's still layers kept (renderer.js `mapLayers`, course-map.js
`holeBounds`), and the far two cascades redrawn on alternate frames with their
own matrices kept (`scheduleCascades`). `tools/frame-ab.mjs`, Ultra, Redwood
PROFILE, the PLAY camera behind the ball on tees 1, 5 and 9, A B B A:

| Tee | CPU ms A -> B | GPU ms A -> B | Draws | Triangles |
| --- | --- | --- | --- | --- |
| 1 | 4.6 -> 2.6 (-44%) | 6.61 -> 5.91 (-11%) | 597 -> 472 | 82.2 -> 67.0 M |
| 5 | 1.9 -> 1.5 (-21%) | 3.21 -> 2.98 (-7%) | 528 -> 406 | 32.5 -> 27.1 M |
| 9 | 4.6 -> 2.3 (-50%) | 5.40 -> 4.92 (-9%) | 557 -> 435 | 67.4 -> 55.1 M |

The frame -- the slower of processor and card, which is what it waits on --
5.07 -> 4.60 ms averaged over the three tees, -9.2%. Now the card sets it. The
play camera's processor cost is lower than the free camera's (1.9-4.6 against
5-6 ms before), because play redraws the map every 60-80 ms, not every frame.

Pixels changed between builds: 1.5-3.5%, against 0.3-1.5% between two loads of
one build. The difference picture (`tools/png-diff.mjs writeDiffPng`) puts
every changed pixel on leaf and grass edges, the cloud's outline and the map's
moving dash -- wind and drift, which differ between any two moments -- and none
on the ground's shadows or the interface.

### What is left once the card sets the frame (runs 5-7)

Live variants on the checkpoint-2 build, Ultra, Redwood PROFILE, play camera,
tees 1 and 9; graphics ms change against the frames either side:

| Variant | Tee 1 | Tee 9 |
| --- | --- | --- |
| planting hidden (view and shadows) | -72% | (card idle) |
| planting casts no shadow | -18% | -15% |
| trees flat-shaded, plain unlit material (diagnostic) | -28% | -27% |
| ground flat-shaded (diagnostic) | -7% | -8% |
| ground cover (rough, deadfall) hidden | -6% | -8% |
| pixel ratio 1.5 (diagnostic) | -12% | -18% |
| nearest cascade frozen | -9% | -10% |
| middle cascade frozen | -3% | -3% |
| far cascade frozen | -1% | -2% |
| far cascade every 4th frame instead of every 2nd | -7% | -2% |
| nearest map 4096 | -5% | -5% |
| nearest map 4096, blur radius 2.67 (same width on the ground) | -4% | -7% |
| all maps 4096 | -4% | -4% |
| ground drawn after everything else solid | -1% | -4% |
| bloom off | -4% | -2% |
| trees receive no shadow | -2% | -2% |
| terrain casts no shadow | +2% | +2% |

Built from these: the far cascade every fourth frame, Ultra's nearest map at
4096 with radius 2.67 (graphics.js `nearShadow`, re-snapped to its own texels,
renderer.js `snapNearCascade`), and the ground drawn last (`renderOrder` 1 on
the ground and the landscape; three sorts solid things by material id before
distance, and the ground's material is made first). NOT built, because they
change the look: ground cover, pixel ratio, bloom, fewer trees. A constant gust
in the trees' wind (the gust noise is two octaves of hashing per vertex,
though it depends only on the tree's root) was tried and its run is void: the
patched materials failed to compile mid-run, some meshes stopped drawing (draws
fell 475 -> 399), and the undo threw.

**Where the frame is, then: the trees.** They are about 70% of an Ultra frame
on Redwood, a third of it their shading and most of the rest their triangles --
43.6 M triangles built in 81 tree meshes (86,404 instances), 12.1 M more in the
shadow twins. Fewer triangles per tree is the lever that is left, and that is
new models: NOTED for the owner (lower-polygon grown trees, especially the
redwoods' 13-53 thousand triangles each, for Blender), not done.

### Checkpoint 3, and trees nearest-first, tried and rejected (runs 8-9)

**Checkpoint 3** (commit f91cafe: the far cascade every fourth frame, Ultra's
nearest map 4096 with its blur kept, the ground drawn last), `frame-ab` against
the original build, play camera: graphics 6.62 -> 5.83 ms (tee 1, -12%), 3.22 ->
2.80 (tee 5, -13%), 5.41 -> 4.59 (tee 9, -15%); draws -26 to -29%; triangles
-21 to -23%; the frame 5.08 -> 4.41 ms on average, **-13.3%**. Changed pixels:
2.1-3.9% against 0.1-0.7% between two loads of one build, every one of them on
leaf and grass edges, the cloud's outline and the map's dash (the difference
picture) -- the screenshots were taken at different moments of the wind -- and
none on the ground's shadows, so the 4096 nearest map is not visible at this
threshold.

**Trees written nearest the camera first** (instance-cull.js: squares sorted
by distance within each map group, so crowns in front would fill the depth
buffer before the ones they hide) measured nothing: graphics 6.09 / 2.82 /
4.60 ms against checkpoint 3's 5.83 / 2.80 / 4.59, inside the noise. So the
card is not losing its time to shading hidden crowns; it is the triangles and
their vertex work. Reverted; recorded so it is not tried again.

### The trees' wind is cheap; the air on every pixel is not (runs 10-11)

**Wind** (run 10): the trees' gust field is two octaves of hashed value noise
per vertex, though it depends only on each tree's root. Patched to a constant
gust, and separately to one octave, on every tree material (through each
material's own `onBeforeCompile`, called with the material as `this`; run 7's
attempt called it bare, the cascade wrapper threw, and that run is void):
-1% to +1% at tees 1 and 9, twice each. Not the bottleneck; left alone.

**The air** (run 11; diagnostics that removed the call from every patched
material): the clouds' shadows, MAX_CLOUDS (16) disc tests on every lit pixel,
-14 to -16% of the frame; the mist (three octaves of noise, two closed-form
fog integrals, the water field, the aerial tint) -9 to -11%. Both repeated
twice at both tees, steady. Two exact reductions followed:

- **The mist's bank noise only while there is a bank** (mist.js): the sheet and
  the water fog both have density zero from about three hours after sunrise
  until sunset (`mistAmount` is 0 there), and the three octaves were computed
  and multiplied by nothing. Now inside `if(sheetDensity>0.||waterDensity>0.)`,
  a branch on uniforms that every pixel takes alike. The picture is unchanged;
  the saving is there only when the sheet is gone -- a dawn or evening round
  pays as before.
- **Only the clouds whose shadow can fall in view** (cloud-shadows.js
  `packCloudShadows`, renderer.js `packClouds`): a pixel's shade is the
  darkest of the clouds' shadows on it, so each frame the clouds whose shadow
  can reach the view frustum -- the cloud's disc swept down the sun's ray over
  every height a receiver can have (the lowest ground to the highest plus 250
  m) -- are packed to the front of the shader's arrays and `cloudCount` ends
  the loop. The water probes, which look from the pond, put every cloud back
  first (`allCloudShadows`). `tests/cloud-pack.test.mjs` checks the shade at
  random points in view is exactly what all sixteen gave, for low and high suns
  (and fails when the packing is given the sun reversed); on its random skies
  it leaves out more than three clouds in sixteen on average.

### Checkpoints 4 and 5: -18% and -21% (runs 12-15)

`frame-ab` against the original build, Ultra, Redwood PROFILE, play camera,
tees 1, 5 and 9, A B B A:

| Build | Tee 1 GPU ms | Tee 5 | Tee 9 | Frame, mean of tees |
| --- | --- | --- | --- | --- |
| original | 6.61 | 3.21 | 5.41 | 5.08 ms |
| + mist branch, clouds packed (run 12) | 5.73 | 2.58 | 4.31 | 4.20 (-16.2%) |
| + no cloud test in shadow (run 13, checkpoint 4) | 5.66 | 2.55 | 4.28 | 4.17 (-18.1%) |
| + middle cascade every 4th frame (run 15, checkpoint 5) | 5.28 | 2.50 | 4.29 | 4.02 (**-20.7%**) |

The middle cascade every fourth frame was measured live first (run 14): -4
to -6% at tee 1, -1 to -2% at tee 5, within noise at tee 9. The aerial tint
measured as noise and was left. At checkpoint 5 the processor's frame is down
45-63% and draws 31-35%; changed pixels 2.8-4.5% against 0.3-0.9% between two
loads of one build, again only on wind, cloud drift and the map's dash.
`npm test` (1043 tests) passes after updating `tests/three-namespace.test.mjs`'s
stand-in for the renderer, which needed `cssSize`; the biome fingerprint is
unchanged for every biome.

### Checkpoint 5 on other landscapes, tiers, devices and views (runs 16-23)

`frame-ab`, checkpoint 5 against the original build, A B B A, play camera at
tees 1, 5, 9 unless stated; "frame" is the slower of processor and card,
averaged over the spots:

| Case | Frame A -> B | Change | Notes |
| --- | --- | --- | --- |
| Ultra, Pacific Northwest | 1.89 -> 1.50 ms | **-20.8%** | GPU -16 to -20%, draws -30 to -33%, triangles -36% |
| High, Redwood | 4.75 -> 3.84 | **-19.1%** | High shares Ultra's cascades and clouds |
| Medium, Redwood | 2.44 -> 2.27 | -7.0% | processor -26% at tee 1; graphics -7% |
| Low, Redwood | 1.75 -> 1.71 | -2.1% | processor -27% at tee 1; graphics -2% |
| iPhone 13 profile (Medium, 844x390 at 3x, CPU x1.3) | 2.04 -> 1.96 | -3.5% | estimated device graphics 97 -> 96 ms at tee 1 |
| weak laptop profile (Low, 1920x1080, CPU x2.7) | 5.10 -> 4.30 | -15.7% | tees 1 and 5; the processor sets this one |
| budget Android profile (Low, 800x360 at 2x, CPU x7.1) | 27.4 -> 20.3 | -26.1% | tees 1 and 5; processor-bound |
| Ultra, overview | 13.63 -> 12.46 GPU | -8.6% (frame -13%) | draws -30% |
| Ultra, facing the sun | 3.84 -> 2.73 GPU | -29% (frame -55% CPU) | god rays in shot |

**What carries down and what does not.** The processor work (page writes,
canvas size, the map) helps every tier, and on the device profiles whose
processor is slow -- the weak laptop and the budget phone -- it is most of
the frame, which is where -16% and -26% come from. The graphics savings were
all in passes Low and Medium do not have (cascades, cloud shadows, mist), so
their card time moved only 2-7% (the ground drawn last, which every tier gets).

**The device estimates are weakest where they matter most.** Scaled card
time (`tools/devices.mjs`) is the card's TIME_ELAPSED, which includes waits
for the processor when the page is processor-bound: under 7x throttling the
original build's tee 1 read 29.9 ms of "card" time against 8.3 for the new
one, because the old frame kept the card waiting on the page. Read the device
rows for direction, never as milliseconds a phone would show.

**Pictures.** Facing the sun, changed pixels (8.8% against 1.5-3.5% between
loads) are all on swaying crowns against the sky and the cloud's outline. The
overview's 18.5% is the camera, not the drawing: the overview camera is still
easing into place when the screenshot is taken, so the course sits a few
pixels apart between any two loads (6.9% between two loads of the same new
build); trees, shadows and cloud shadows match. A screenshot of the overview
needs the camera settled first -- left as a limit of `frame-ab --shots`.

### Low and Medium: their one sun map (runs 24-25)

Live variants on checkpoint 5, Redwood PROFILE, play camera, tees 1/5/9.
Frozen, the single sun shadow map gave back 17-22% of Medium's graphics time
and 17-26% of Low's; redrawn every other frame, Low -7 to -17% (Medium's
reading was lost: several samples returned no graphics time -- the timer query
came back empty -- and the others read flat). Hiding the planting took 58-68%
of Low's frame: the same story as Ultra, the trees are the frame.

**The sun map every other frame was built, measured and REVERTED** (runs
26-27): redrawn every other frame while the sun's light had not moved, every
frame otherwise. Against the original build it read Medium -6.9% and Low
-2.8% -- the same as without it (-7.0%, -2.1%) -- though draws fell 20%. The
reason is the frame it leaves: half the frames still draw the whole map, so the
heavy frame, which is the one a display waits for, is exactly as heavy, and a
median sits on whichever half is larger. It would lower the average only, at
the price of shadows of swaying trees near the player updating at half rate.
Not worth it. (Ultra's staggered cascades differ: there every frame draws two
maps instead of three, so the heavy frame itself got lighter -- its 95th
percentile graphics time fell 12-21% against the median's 20-22%.) This is
why `frame-ab` now also reports each spot's mean and 95th percentile.

### The final measurement (runs 28-29)

**What the processor does now** (run 28, DevTools profile of the final build,
play camera, 600 frames): the page is restyled once a frame for 0.03-0.06 ms
(it was 2-3 times for 1.7 ms), and most of the processor's frame is inside
WebGL's uniform uploads (uniformMatrix4fv about 1 ms) -- the page waiting for
a card that is busy, which an uncapped, card-bound frame always shows and a
display-paced one hides.

**Final, against the original build** (run 29, frame-ab, Ultra, Redwood
PROFILE, play camera, tees 1/5/9, A B B A): graphics -20% / -21% / -22%,
processor -44% / -55% / -64%, draws -31 to -35%, triangles -25 to -28%. The
frame (slower of processor and card) averaged over the tees: median 5.08 ->
4.01 ms (**-21.1%**), mean 5.34 -> 3.99 ms (-25.3%), 95th percentile 9.80 ->
5.10 ms (-48%) -- the old build's slow frames were the processor's (the map
redrawn every fifth frame, the page restyled), and those are gone.

### The looks, with the clock stopped (runs 30-33)

`tools/frame-look.mjs`: the original build and the final one, each a hooked
build (the original made by swapping the six changed files back in, SWAP in
`tools/capture/build-hooked.mjs`), with the renderer handed dt = 0 from before
the course is built -- clouds where the seed put them, no sway, still water,
the map's dash at rest. Redwood PROFILE, 1600x900 at 2x, the play camera on
tee 1 and free poses at tees 5 and 9, facing the sun, and 160 m up over hole 3.
Two shots of one build ten frames apart: 0.000% of pixels different, every
tier, so anything left between the builds is the code.

| Tier | Pixels changed, worst pose | Mean difference, worst pose |
| --- | --- | --- |
| Ultra | 0.204% (facing the sun) | 0.129 of 255 |
| High | 0.002% | 0.001 |
| Medium | 0.004% (tee 1) | 0.010 |
| Low | 0.006% (tee 1) | 0.017 |

Ultra's few changed pixels are specks on the nearest trees' own shading (the
difference picture) -- the nearest shadow map at 4096 instead of 6144; on the
other tiers the frame is, to within a pixel here and there, the same picture.

The interface, the same in both builds on every tier: the pin label shown at
(580.97, 345.69) px reading "483 YARDS TO HOLE, PLAYS 464, 23 FT down"; the hole
map labelled "Hole 1 map", hole 1, drawn in 25 sampled colours; no page error
or console error. The wind arrows carry their bearing on the arrows in the new
build (-79.7 degrees) where the old one set it on the round screen. What this
cannot see: anything that needs the clock running -- a ball in flight, the
camera moving, shadows refreshed while it moves -- which stays for a person and
the smoke journeys (TODO).

### The looks in motion, frame for frame (runs 34-35)

`tools/frame-motion.mjs`: the original and final builds (hooked) on a VIRTUAL
clock -- every animation frame exactly 1/60 s on performance.now and the
frame's timestamp, and the clock moving only when the tool steps it -- so both
play the identical round: a driver off tee 1 of Redwood PROFILE (70 m/s, 12
degrees, 2,700 rpm), the television cameras following it, then the fly-up into
the overview. Each picture is read from the canvas inside the frame it shows,
straight after the renderer's own draw call, so shadow maps that wait a few
frames are seen waiting (a screenshot would let them catch up first).

| Frame | Ultra: pixels changed (mean diff of 255) | Low |
| --- | --- | --- |
| shot + 10 | 0.327% (0.161) | 0.035% (0.008) |
| shot + 40 | 0.196% (0.092) | 0.048% (0.016) |
| shot + 90 | 0.166% (0.074) | 0.017% (0.011) |
| shot + 160 | 0.169% (0.097) | 0.022% (0.012) |
| shot + 260 | 0.115% (0.062) | 0.023% (0.012) |
| shot + 420 | 0.067% (0.047) | 0.031% (0.081) |
| overview + 8 | 0.076% (0.051) | 0.033% (0.070) |
| overview + 20 | 0.087% (0.062) | 0.014% (0.042) |
| overview + 45 | 0.076% (0.052) | 0.001% (0.003) |

The whole screen after the shot, interface included: 0.116% (Ultra) and 0.111%
(Low) changed. No page or console error in either build. On Ultra the changed
pixels are specks on the nearest trees' own shading (the 4096 nearest map), as
with the clock stopped; the far cascades waiting up to three frames while the
camera follows the drive changed nothing visible at this threshold. What this
still cannot stand in for is a person playing and the smoke journeys, which
walk the menus and every panel (TODO).

## Lakeshore Dunes, the tenth biome (23 October 2026)

Asked for by the owner under a `/goal`, from an aerial photograph of a hole at
Harbor Shores (Benton Harbor, Michigan): bright fairways in wide ribbons between
tall grassed dunes with raw sand cut into them, dense leafy woods on the high
ground, a calm freshwater lake along one edge, lakefront houses on the ridge,
warm low summer light. **Fictional, not a replica**: no routing, hole, name or
surveyed figure of the real course is used (LANDSCAPE_RESEARCH.md says the same
for every biome). The biome is called **Lakeshore Dunes** and its course
**Beacon Dunes** -- both **PLACED** by Claude because the goal left the name
blank; the owner can rename them (`PALETTES.lakeshore` in biomes.js).

### What the real place is

- **The course** (Wikipedia, *The Golf Club at Harbor Shores*; golfpass and
  nicklaus.com listings): a Jack Nicklaus Signature design, opened 1 July 2010,
  par 71, 6,734 yd from the longest tees (Nicklaus's own page says 6,852). The
  scorecard splits it into four landscapes: holes 1-6 inland and wetland, **7-9
  "play through dunes"** nearest Lake Michigan, 10-13 woodland, 14-18 on the
  Paw Paw River. Three of the dune holes use part of the public Jean Klock
  Park, which the Michigan Supreme Court allowed. The 7th (about 430-436 yd)
  climbs to a green **about 25 ft (7.6 m) up** the dune; the 8th runs along a
  sandy ridge to a green tucked into the dunes. Hosted the Senior PGA
  Championship every other year from 2012.
- **How high the dunes are nearby**: Tower Hill in Warren Dunes State Park,
  about 25 km south in the same county, stands **240 ft (73 m)** above the lake
  in most sources (260 ft in others; the lower, more often repeated figure is
  followed). Those are the biggest dunes on this shore; the ridges round a golf
  hole are a fraction of that.

### Freshwater dune ecology (the order a walk inland meets it)

Lake Michigan's dunes are the place where plant succession was first described
(Henry Cowles, *Botanical Gazette*, 1899). The National Park Service's Indiana
Dunes pages and Michigan Natural Features Inventory (MNFI) give the same order:

1. **Beach**, bare sand.
2. **Foredune**, a long narrow ridge parallel to the shore, built by grass
   catching blown sand. **American beachgrass (marram, *Ammophila
   breviligulata*)** is the main builder: leaves **0.3-0.9 m** (1-3 ft) tall,
   long and narrow; a spike-like seed head up to **25 cm** in late July and
   August; it spreads by rhizomes **1.8-3.0 m a year** and puts up to **100
   stems a clump**; it thrives on burial and weakens once the sand stops moving.
   Where erosion is active **sand reed (*Calamovilfa longifolia*)** joins it.
3. **Cottonwood** (*Populus deltoides*) on the foredune: it sprouts in a
   sheltered low spot and, once a few feet tall, survives burial -- buried stems
   turn into roots and new stems come up. Mature trees **21-30 m** tall (70-100
   ft, Michigan DNR via search; Native Plant Trust 15-30 m) with a crown
   **9-18 m** across, narrow and conical when young, broad and open with age.
4. **Stabilised dune grassland and shrubs**: **little bluestem
   (*Schizachyrium scoparium*)** dominates where the sand has settled; **sand
   cherry** and **common juniper** are less frequent dominants; **creeping
   juniper** and other low evergreens sit on the most stable crests (MNFI).
5. **Jack pine** on younger unstable dunes near the shore, after cottonwood and
   before the oaks (NPS, *Jack Pines on Lake Michigan's Southern Shore*).
6. **Oak forest**: **black oak** is the most conspicuous tree of the older
   dunes, with many other mostly deciduous trees; farther back, northern
   hardwoods (maple, beech) take over (MNFI, wooded dune and swale). This is
   the "dense leafy woodland on the high ground" in the owner's photograph.

**Blowouts** are where wind breaks through the grass and scoops sand out of a
dune face; they show as raw sand bowls in otherwise grassed ridges. No figure
for their size was found; anything the generator does with them is **PLACED**.

### The lake and the light

- **Water**: open southern Lake Michigan cleared from a Secchi depth of **6 m**
  (1985-89) to **18 m** (2007-10) after the quagga mussel invasion (NOAA GLERL
  report via search); the south-east nearshore stays murkier, its spring Secchi
  depth about **a fifth** of offshore. So: clear, but not the island's
  turquoise. No published colour was found; the tint is **PLACED** from the
  photograph's light blue to grey-blue.
- **Sun**: Benton Harbor is at about **42.1 °N**. The midsummer noon sun stands
  90 - 42.1 + 23.44 = **71.3 degrees** up, and on a June evening it sets well
  north of west after 21:00 local time. The game does not model latitude: a
  biome's `sun` field is a mood number (`peakElevation = 35 + 0.6 x sun`,
  daylight.js), and every biome's figure is placed. This one is set for a long
  warm evening rather than for the true noon peak (below).

### What was built, and the numbers it was tuned to

Everything in this subsection is **PLACED** unless it cites the research
above: a look matched to the owner's photograph and to the shore's plants.

**The record** (biomes.js `lakeshore`). Palette: fairway `#5aa443` (brighter
and more saturated than any parkland fairway, as in the photograph), rough
`#6f8a44` with the Cartoon rough lift toward `#a2b46a` instead of the default
olive; sand `#eadcb6`; water `#5d97b3`, murk 0.65. Altitude 180 m (the lake's
surface is about 177 m), 23 °C (a July evening), `sun` 20 -- a peak of 47
degrees in the game's own day, not the true 71.3 (daylight.js does not model
latitude). Fog: haze 0.6, sheet 0.3, water 0.75.

**The rough went from golden to green in two passes.** First looks (rough
`#8c9852`, blade tint `#8ea254`, the default olive lift) read as dry prairie --
the Links look the owner's photograph is not. Rough `#7f9549` then `#6f8a44`,
blades `#7f9c4a` and the greener lift fixed it.

**The dunes: height against blind tee shots.** First shape base 22, severity
40, reach 40 was barely taller than Links; base 34, severity 45, reach 30 gave
the photograph's ridges right beside the fairway but made one tee shot in ten
blind. Swept on 45 courses (`bench --tier full --set biome=lakeshore blind
tees`; the nine-biome average is 3.2% of tee shots blocked by over a metre):

| base / severity / reach | blind over 1 m | over 3 m | tees needing earthwork |
| --- | --- | --- | --- |
| 34 / 45 / 30 | 10.4% | 5.2% | 5.9% |
| 30 / 40 / 34 (chosen) | 5.9% | 3.7% | 3.0% |
| 26 / 40 / 38 | 4.4% | 3.0% | 1.5% |
| 34 / 45 / 40 | 6.7% | 3.7% | 2.2% |

30 / 40 / 34 keeps dunes that read as dunes at about twice the parkland rate
of blind drives. Lower would be fairer and flatter; the owner can move it.

**Blowouts** (src/blowouts.js). Coverage is set by where the noise's 0.5
contour falls (`amount`): over open ground 0.25 is 6% sand, 0.3 is 12%, 0.35
is 19%, 0.45 is 39%. With the gate (none within 6 m of a corridor envelope,
fading in over 16 m) and the water clearance (12 m), 0.29 gives **8.3-9.4% of
the dune rough** on three seeds. The first gate (14 m, fading over 22) put
almost every blowout out of sight of play; 0.33 at the new gate (12-14%) read
as a sandy landscape from above, so it came down. A patch is about 38 m across
before warping. Building the field costs about 43 ms on a 9-hole course.

**Woods behind the dunes** (`woods: {from: 12, to: 60, floor: .3}`). The first
cut, from 30 to 95 m with a floor of 0.18, left almost no trees at all, because
trees only stand within about 135 m of a corridor anyway; the band was moved in
and the plant count raised (`treeDensity` 3.6, then 4.6, then 5.4) so the woods
behind hold. A 9-hole course with the tree setting at 60 plants about 2,900
plants, three fifths of them dune grass and junipers (S1, BEACON).

**The plant mix**: cottonwood 17%, dune grass 34%, black oak 17%, sugar maple
9%, pine 5%, creeping juniper 12%, common juniper 6%. The shared Kenney `oak`
and `maple` were dropped for this biome after the first look: the broadleaf
family includes the cube-crowned `tree_blocks` and `tree_plateau`, which jar
against everything else here, and changing that family would change six other
biomes. So the black oak and sugar maple are their own species, built in
Blender.

**The models** (docs/BLENDER_ASSETS.md). First attempts that were rejected on
the contact sheet: the **cottonwood** was an umbrella pine (a trunk 2.6% of
its height, long straight limbs, leaves only at their ends) -- now a trunk
3.4% of its height forking at a quarter to a third, ascending limbs, foliage
along their upper halves; the **dune grass** was scattered weeds (90 blades
leaning out up to 0.55 of their height) -- now 160-220 stiffer blades in
tussocks, straw on the top 40-58%; the **juniper mats** looked like lily pads
(12-15 flat plates) -- now 26-34 small rounded lumps. Sizes in the game: dune
grass patches 0.4-0.9 m tall and 2-4.6 m across (from the ground-plant
spread), cottonwood and oak 14-28 m (`canopy`), driftwood 0.25-0.5 m thick.

**A sea along one edge had a far shore.** The distant landscape rings lift
hills out of every side (`ringLift`), and on the lake side that put a range a
kilometre offshore, so the lake read as a wide river. landscape-edge.js now
fades the lift to nothing toward an edge coast; Links has a ring lift of zero,
so it is unchanged.

**What it costs.** Frame (`profile --only biomes`, high tier, RTX 4090, card
idle): **2.94 ms GPU and 2.7 ms CPU median**, 221 draws, 11.8 M triangles --
between Links (3.22 GPU) and Midwest (2.02), far below Redwood (6.07). The
built page: +689,620 bytes (3.9%), nearly all models. Generation: a 9-hole
course in about 1.3 s in Node.

**Decisions the goal left open, made by Claude and PLACED:**

- **Names**: Lakeshore Dunes, course title Beacon Dunes, tag "Freshwater dunes,
  summer woods and an inland sea." Searched with "golf" first (REFERENCES).
- **The course of the week**: appending the biome to the rotation would have
  changed every week's landscape -- this week's mid-week, under bests saved for
  it. Instead every week before 149 keeps its old landscape and Lakeshore Dunes
  debuts on Monday 9 November 2026 (weekly.js `WEEKLY_ROTATION`). If the
  release lands later, the debut should move with it.
- **Globetrotter** said "finish a round in all nine landscapes" with a goal of
  9. It now says "nine different landscapes" and keeps its goal, so nobody's
  progress or award moves; making it ten would have taken it back from no one
  but raised the bar for everyone still working on it.
- **Blowouts play as sand** (the bunker lie), the way a waste area is sand.
- **Out of scope by the goal**: cart paths (IDEAS.md).

## The cartoon overhaul's trees (25 October 2026)

The `cartoon-overhaul` branch remakes every tree in Blender (docs/CARTOON_OVERHAUL.md,
BLENDER_ASSETS.md *The cartoon packs*). Each species was read up first; the
model then pushes the real proportions toward a cartoon. Sources in
REFERENCES, *The cartoon overhaul*. Most were read through a search tool's
summary.

**Bur oak** (Midwest and Autumn's `oak`). Missouri Department of
Conservation: typically 85 ft tall with an 85 ft spread; Kentucky: 70-80 ft
tall and wide; North Dakota: crown 40-70 ft tall, 35-60 ft wide; the
Minnesota DNR: a broad top of heavy spreading branches over a relatively
short trunk; Yale's tree survey: the larger branches near the crown's base
grow out level and droop, smaller ones higher up grow upright, and old trees
may become wider than tall. Taken: crown width about equal to height (the
models are 16-20 m tall, 18-19 m across); the trunk forks at a quarter to a
third of the height into four or five limbs that leave nearly level and then
rise. PLACED: the trunk radius, 6% of the height -- about twice a real bur
oak's (a 1 m diameter on a 25 m tree is 2%), for a cartoon's weight.

**Sugar maple** (`maple`). UF/IFAS: 50-80 ft tall, 35-50 ft spread, a dense
symmetrical oval to round crown; Maine's forest-trees handbook: open-grown
branches start 8-10 ft up, an egg-shaped head when young and a broad rounded
top when older; a Canadian database: 12-24 m by 9-18 m. Taken: width about
0.65 of the height (13.5 m on 21 m), the crown starting at 45% of the height.

**Quaking aspen** (`aspen`). Morton Arboretum: 40-50 ft tall, 20-30 ft
spread, long-trunked and narrow with a rounded crown when mature; Minnesota
DNR: up to 65 ft, an open rounded crown, bark white to grey-green, smooth.
Sources disagree on height (30-65 ft); the models are 13-17 m. Taken: a
crown about a third of the height across, from half way up; the dark lens
scars of fallen branches are the trunk's accent. PLACED: nine scars a trunk.

**Red alder** (`alder`, Pacific Northwest). Oregon State: typically 70-120
ft; NRCan: up to 25 m. In stands a clear, slightly tapered bole and a narrow
dome; in the open a broadly conical crown. Taken: a dome widest a third of
the way up, 0.45 of the height across, on a clear bole to 86% of the height.

**Engelmann spruce** (`spruce`). NEON: narrow conic when young, cylindric
when older; Utah State: pyramidal. Taken: about 0.3 of the height across,
skirts to the ground.

**Ponderosa and lodgepole pine** (`pine`). NRCan: ponderosa's crown wide,
irregularly cylindrical and flat-topped on old trees; the NPS: lodgepole
narrow in dense stands, broader in the open and then sometimes like a
ponderosa. One `pine` serves both (Pacific Northwest, Mountain, Lakeshore), so
the model is the open-grown form: a clear trunk to about half its height and
flat needle pads gathering into an irregular flat-topped crown 0.4-0.45 of the
height across.

**Western redcedar** (`cedar`). The Mountaineers' Cascade conifer chart:
drooping branches. Taken: broad drooping skirts (0.42 of the height across),
a strongly flared foot, a leader pushed off the axis. The drooping-leader
detail is common knowledge in Pacific Northwest field guides and was not
found in a fetched source: PLACED.

**What the rounds changed** (pictures under `bench/shots/overhaul/rounds/`,
local). Broadleaf round 1 built each crown as separate masses -- oaks came out
as flat pancakes on thin stems (acacias), aspens and alders as stacked balls.
Round 2 made one dome per oak over a trunk twice as thick, one crown per
aspen and alder, and doubled the paint's range (0.45 to 1.2, from 0.62 to
1.12, which had read as flat). Round 3 broke the oak's smooth "lid" with
lobes standing proud and rounded the aspen's upright lozenges. In the game
two more fixes: trunks painted nearly black at the foot (raised to 0.78), and
crowns speckled by the shadow map, which painted crowns no longer receive.
Conifer round 1: spruces were clip-art Christmas trees (thin skirts, an
arrowhead tip), pines bonsai (few small pads on a long thin stem). Round 2:
thicker skirts, more and bigger pine pads merged into one crown. Round 3:
each bough ends in a rounded scallop instead of a star point, and the upper
tiers overlap so no trunk shows.

**Cost.** The Kenney oak was 64 leaf triangles; a cartoon oak is about
6,000-9,000, a maple about 5,000, a spruce about 1,000. The module grew from
15,353 KB to 17,370 KB (both packs, with the two Kenney families removed).
Frame rate is measured in the overhaul's frame-rate phase against main's
baseline; a lighter model for far trees and the Low tier is planned there.

## The overhaul's ground types (25 October 2026, generator 37)

The cartoon overhaul made the ground between the holes into surfaces of its
own (docs/CARTOON_OVERHAUL.md, PROCEDURAL_GENERATION *The country between the
holes*). Every value below is **PLACED** -- no source gives a golf ball's
restitution on scree or the share of ball speed heather costs -- and each is
set against the fitted surfaces either side of it. The whole table lives in
`src/grounds.js`; `tests/grounds.test.mjs` holds the orderings.

| Ground | cor | tilt | mu | ground + canopy | roll (m/s²) | skid mu | lie | relief rank | hop (m) | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rough (fitted, for reference) | .0843 | .085 | .5225 | .105 + .17 | 3.8 | .70 | .90 | 3 | .05 | -- |
| fairway (fitted) | .1305 | .1192 | .418 | .065 + .015 | 1.45 | .42 | 1 | 0 | .08 | -- |
| rock | .22 | .10 | .30 | .02 + 0 | 1.0 | .35 | .82 | 4 | .14 | Hardest thing a ball lands on: highest kick, runs on, a poor lie. Kept under .24, past which a slow contact (x3.5) would return more than the drop |
| coral | .20 | .12 | .38 | .02 + 0 | 2.0 | .45 | .80 | 4 | .12 | As rock, pitted: rolls less, a worse lie |
| scree | .12 | .16 | .55 | .06 + .03 | 4.5 | .80 | .82 | 4 | .10 | Hard but loose: kicks, then grabs |
| hardpan | .155 | .12 | .40 | .045 + .005 | 1.15 | .38 | .93 | 2 | .06 | Pinehurst's "hardpan rather than waste bunkers, so a ball bounces and runs" (REFERENCES): firmer than a fairway, a tight bare lie better than rough |
| waste | .06 | .02 | .62 | .11 + .35 | 5.0 | .90 | .86 | 4 | 0 | Open sand that is not raked: firmer than a bunker, and it takes the spin as one does (`killsSpin`) |
| pinestraw, litter | .075 | .07 | .56 | .10 + .20 | 4.2 | .70 | .88 | 3 | .03 | Soft; a ball sits down |
| heather | .055 | .06 | .62 | .105 + .38 | 6.5 | .90 | .78 | 4 | 0 | Woody and wiry: the worst lie on a heath, a ball stops dead |
| native | .06 | .07 | .60 | .105 + .32 | 6.0 | .85 | .82 | 4 | 0 | Marram, prairie, unmown fescue: deeper than rough |

None is a penalty area or out of bounds (PLACED): a desert course's "desert
rule" is a local rule (Troon North's scorecard: drop beside the nearest grass,
one stroke), and this game's rules are the same everywhere. Sounds borrow the
signed-off ones (rock and scree the hard rock sound, hardpan the tee's, the
grasses and straw the rough's, waste sand the bunker's). The turf roll sliders
do not scale them: those are for mown turf.

Measured on one pitch (25 m/s, 32 degrees, 5,500 rpm) onto flat ground of
each: it runs further after landing on rock than on rough, and less in heather
(`tests/grounds.test.mjs`). Not tuned in play; to be checked by the owner.

## The overhaul's landforms (25 October 2026, generator 37)

What each landscape's recipe (`src/landforms.js`, `landform` in biomes.js)
builds, and what it measured. **Every shape and number in the recipes is
PLACED**: LANDSCAPE_RESEARCH says what lies between real holes, not how tall a
cartoon mesa is.

| Landscape | Recipe | Key numbers (PLACED) |
| --- | --- | --- |
| Mountain | crags | ridged field at 300 m, clusters from .42, 70 m tall in 4 cliff bands, fading in over 120 m from the corridors; rock gated 14 m (+18 ramp) outside the corridor envelope, scree 10 m (+14) |
| Pacific Northwest | crags | 170 m, 22 m tall, 2 bands, clusters from .6; rock 14 m (+16) |
| Giant Redwood | crags | 180 m, 16 m, 2 bands, clusters from .62 |
| Autumn | crags | 150 m, 9 m (low ledges), 2 bands, clusters from .58, summit rock .6 |
| Desert | mesas | a 280 m grid, 42% of cells hold a mesa 34-80 m across and 22-48 m tall, cliffs over the outer 14% of its radius, a talus apron to 1.7 radii; washes on a warped 260 m field 1.8% wide and 1.4 m deep; rock 8 m (+10), wash 12 m (+10), hardpan from 5 m (+6) |
| Links | dunes | crests on a ridged 150 x 105 m field, 5 m tall, hummocks a third of that at 38 m; marram 9 m (+14), heather where a 70 m field passes .6, 8 m (+12) |
| Lakeshore Dunes | dunes | 130 m, 4 m; marram 8 m (+14); its blowouts are unchanged |
| Midwest | prairie | a 110 m field past .56, 24 m (+22) outside the corridor; swales of 4 m |
| Island | coral | between 1.0 and 3.4 m above the sea, broken by a 17 m field |
| Haunted Hollow | moor | an 80 m field past .5, 9 m (+14); tussocks of 3 m |

**Shares** (seed `overhaul`, nine holes, `node tools/ground-shares.mjs`):
Mountain rock 14%, scree 7%, pine straw 8%; Desert hardpan 74%, waste 7%, rock
1%; Links native 28%, heather 4%; Midwest native 18%; Island coral 1%;
Haunted heather 30%; Autumn rock 1.5%, leaves 8%; Pacific Northwest rock 2%,
pine straw 9%; Redwood rock 1%, pine straw 6%; Lakeshore native 32%.

**What the rounds changed** (pictures under `bench/shots/overhaul/land-r1..3/`,
local). Round 1: a ridged field alone sits near its crest most of the time (70%
of points above 0.87), so crags covered a fifth of every forest course -- a
broad cluster mask fixed it; rock painted from the recipe's bands alone left
flat rock decals wherever the corridor fade had flattened a crag, so rock is
decided from the finished ground's slope (rise over run past .42-.7); the
terraces followed the noise's contours and banded the slopes like agate, so
the band index is read through noise; rock was textured in 3.4 m squares with
a stratum every 2.2 m (brickwork), now warped 9 m planes and broad bands
every 6.5 m; scree was white ribbons, now darker and browner; pine straw was
orange rings, now half the rough's colour; hardpan's crack net read as a
wireframe, now faint and warped; heather was saturated blocks, now muted and
soft-edged. The colour's soft edge widened from .42-.58 to .34-.66 of the
field around the 0.5 the lie switches at.

**Two bugs the new ground exposed.** A creek's faded head kept the water
level the full channel needed -- up to MAX_CUT under the ground -- while its
carve faded to nothing: water lying under a links dune 8.7 m deep
(tests/course-living.test.mjs). Across a fade the level now rises toward the
surveyed ground (streams.js), and a fading channel never narrows below 1.2 m,
since a 0.2 m trickle fell between the ground mesh's half-metre vertices.
And the relief first rode on `open()`, which returns a quarter of the
surrounding relief round the tees: crests stood in tee shots, blind shots
blocked inside 80 m went from none to six on the full bench; the relief now
fades from the corridor alone.

**Bench** (`node tools/bench.mjs --tier full`, 45 courses): every invariant
zero. Tee shots blocked by more than a metre 43 on main, 48 now, all by ground
80 m or more out (the landing areas have more relief beside them); tees
needing work 27. **Generation** (`node tools/gen-time.mjs`, 18 holes): 0.1-1.3 s
longer per course -- Desert 2.29 to 3.57 s (the mesas are looked up on every
height query), Autumn 3.10 to 3.51, Mountain 2.22 to 2.69, Island 5.86 to 6.11.

## The overhaul's turf detail (25 October 2026)

The ground had no texture images: its colour is palette and procedure
(ground.js), and the finest detail was a per-pixel hash ("grain", 30 cells a
metre, 7.5% strength) that read as noise. `tools/turf-detail.mjs` now paints
four tileable 512 px patterns into the channels of one PNG, inlined as
`src/turf-detail.js` (906 KB of PNG -- noise compresses badly): R clumps of
tapering grass strokes leaning together, G a fine mown nap, B a stipple of
grains and a few pebbles, A plates split by cracks. Each is centred on 128 and
multiplied into the turf colour around 1, so the palette is untouched.

| Surface | Channel | Tile (m) | Strength (PLACED) |
| --- | --- | --- | --- |
| rough, pine straw, leaves, heather, native grass | R, read twice (the second 2.7x larger and turned 37 degrees, 40% of it) | 2.8 | .30 |
| semi-rough | R | 2.2 | .20 |
| fairway, fringe, tee | G | 1.8 | .16 |
| green | G | 1.3 | .10 |
| sand, hardpan, waste | B | 1.6 | .24 |
| rock, coral, scree | A | 6.5 | .34 |

Held at 35% where a tile shrinks to under a fifth of its size on screen
(`fwidth`), so the far ground is not busy; mipmapped and anisotropic.

**Rounds.** 1: the rough's dark root strokes were as strong as its blades and
read as dirt specks; the nap read as static; the stone had pits like rivets.
2: blades the light stroke, long, with a small dark foot, 1,500 clumps; nap at
60% of its spread; no pits. In the game the mown detail was invisible at
.07-.11. 3: fairway .16, green .10, grit .24, and hardpan's own crack plates
(ground.js `groundPaint`) halved in size and faint.

**The texture unit it costs.** The ground's shader was at 15 of 16 units with
the one spare the tests demand (tests/flood-shadows.test.mjs). The route curves
and the semi-rough edges were two float textures on the same 512-texel grid,
the second using two channels; they are now one texture twice as wide, read
through `curveAt` and `outerAt`, which clamp the index to their own half so the
linear filter never blends one into the other. The sampler count is 7 again.

## The overhaul's boulders (25 October 2026)

Each landscape's boulders are its own geology (BLENDER_ASSETS.md
*cartoon_rocks*). Wikipedia, *Spheroidal weathering*: a jointed block's corners
and edges weather faster than its faces, leaving a rounded corestone
("woolsack") that stands free once the decayed rock round it erodes -- the
**round** style (Midwest, Autumn, Links, Lakeshore, Island). Talus (JNCC
*Mass movements*; fiveable, *frost wedging*): rock split by frost along its
joints and bedding into angular fragments that collect below a cliff -- the
**angular** style (Mountain, Pacific Northwest, Redwood, Haunted Hollow).
Sandstone in horizontal beds, a softer bed wearing back under a harder one,
is the **layered** style (Desert); the bedding detail is common geology and was
not found in a fetched source (PLACED). Moss and lichen colours per biome are
PLACED.

**Rounds.** 1: the round stones were a convex hull with a wide bevel, which
overran the hull's short edges and threw long spikes. 2: round stones built as
a noise-displaced sphere flattened underneath -- right, but coarse, and mossed
over the whole top like a cap. 3: smoother, moss only on the crown (facing up
and high on the stone), sandstone beds of different sizes, a broken block on
some, seated rather than floating.

## The overhaul's shrubs (25 October 2026)

Read for the shrub pack (BLENDER_ASSETS.md *cartoon_shrubs*), via search
summary. **Gorse** (Ulex europaeus; BSBI Fermanagh, RHS): an evergreen,
much-branched spiny shrub, usually about 2 m (RHS 1.5-2.5 m, up to 4 m and 7 m
where introduced), dense thickets, leaves reduced to spines. Models 1.5-2.2 m.
**Heather** (Calluna vulgaris; NC State Extension, plantura): usually under
50 cm, up to 1.25 m, mat-forming in good conditions, shoots to about 60 cm.
Models 0.35-0.5 m tall, 1.4-2.2 m across. **Beach naupaka** (Scaevola
taccada; UH CTAHR OF-14, Wikipedia, FNAI): a dense, spreading, mounding shrub
branching from the base, usually about 3 ft tall and 6-15 ft wide (Wikipedia
gives 3-10 m -- the sources disagree, the garden figure was followed),
fleshy leaves 8-25 cm crowded at the stem tips. Models 0.8-1.2 m by 2.2-3.4 m.
The fern and bramble are drawn from the general form of each (PLACED).

**Rounds.** 1: heather a few big blobs; naupaka mushroom trees on long stems;
fern sparse pale triangles; bramble little trees. 2: heather a fine mat of
seventy shoots; naupaka a filled dome; fern denser, broader overlapping
leaflets; bramble a dark core under arching canes -- still canes like poles
and naupaka a pancake. 3: naupaka a full dome its rosettes sit on; bramble's
arches low and leafed along their length. In the game the Links shrubs read
small and sparse -- the owner's addendum (thicker cover between links holes)
takes that on.

## Shared links fairways (25 October 2026, generator 38)

The owner's addendum: "For links courses, maybe fairways can be LARGE and
shared ... Courses like chambers bay have it." Sources (REFERENCES, *Shared
links fairways*; all via search summary): the Old Course's 1st and 18th share
one fairway about **129 yd (118 m)** wide -- the figure is repeated widely,
one review says "over 100 yards", and no official measurement was found.
Chambers Bay's fairways run **28-105 yd (26-96 m)**, the 13th the widest,
against about 24-32 yd (22-29 m) at Oakmont or Winged Foot, with no
intermediate cut between fairway and fescue.

What was built (Links only; `fairwayScale`, `routeParallel`,
`sharedFairways` in its biome record):

- **Wider fairways: 1.3 times the setting** (PLACED). At the default 38 m a
  links fairway is typically about 49 m, inside Chambers Bay's range.
- **Side-by-side routing** (routing.js): each hole of 250 m or more is offered
  a tee on the line running beside any earlier hole of 250 m or more, either
  way and either side, at the least clearance the corridor test allows
  (about 70-85 m centre to centre), within 130 m of the last green, with at
  least 80% of the shorter hole alongside. A back-nine hole running home
  beside its front-nine partner may walk 1.6 times as far and scores twice
  the pull; the routing trial with most such holes is favoured. All PLACED.
- **Meeting fairways** (course.js shareFairways): where two fairways run
  within 0.9 (about 26 degrees) of parallel at that point and the rough
  between is under 85 m, each widens to the middle, over runs of 80 m or
  more, fading over 60 m. Never across any hole's pond. PLACED: all four.
  Two 33 m half-fairways 85 m apart make one about 150 m across -- wider
  than the Old Course's 118 m, as the owner asked for LARGE.

**Measured** (18 holes, seeds overhaul, S1, S2, S3, with a CPU surface map):
4, 5, 4 and 6 holes share; nine-hole courses 0-2. Fairway is 6-9% of the
property (sampled on a 6 m grid; generator 37 was not measured the same way). Bench: every rule clear; blind tee shots over
1 m, 42 of 1215 (all beyond 80 m).

**What did not work, in order.** (1) Widening alone, gap 55 m: 0-3 holes per
course -- random routing seldom sets holes close and parallel. (2) A bonus
for random placements beside an earlier hole: fewer still; the clearance test
rejects most near misses. (3) Turning the previous hole round beside itself:
feasible for 2-7 holes a trial, but at the maximum clearance (about 100-160 m
apart), too far to share; stepping the clearance in made it 65-85 m. (4) The
parallel test compared tee-to-green lines, so every dogleg failed it even
where the fairways lay side by side -- now the centre lines' directions at
the point. (5) A pond drawn by one hole but sitting in its neighbour's
fairway blocked the shared strip, though it is dropped later (a pond keeps to
its own hole's ground) -- such ponds are now ignored, and every other hole's
pond in the strip counts. (6) 30 m fades left square-cut "rungs" between
holes; 60 m tapers them. (7) A 95 m gap made blobs between holes that only
glanced past each other; the parallel limit went from 0.75 to 0.9.

## The overhaul's stands (25 October 2026, generator 39)

The owner's addendum: "parts of the course THICK brush or forest (like on the
perimeter of courses where forest wasnt fully cleared) ... We should have some
version of that for all courses. It might not be trees ... Desert might be
tough but be creative," with three photographs: an autumn hillside closed in
hardwoods across a lake, Appalachian ridges of unbroken forest round a green,
and tall pines walling a fairway. Before this, every landscape planted one even
scatter thinning to nothing about 135 m from the holes -- an orchard on bare
hills (`bench/shots/overhaul/shrubs-r3/pnw/overview.jpg`).

**What was built** (src/stands.js; every number PLACED, per biome in its
`stands` record): a ragged RIM -- everything more than `edge` m (45-110,
give or take `wobble` 25-40 by a 170 m noise) outside the corridors, rising
over `ramp` 20-30 m -- and PATCHES between the holes where a broad noise
(`scale` 200-260 m) passes a threshold set for roughly `patch` (12-20%) of the
country, never within `near` (40-55 m). Inside, one site per `spacing` m
(8-11 for trees, 8 for links gorse) on a hashed jittered grid, planted after
the open scatter by its rules -- ground that allows a tree, clear of houses,
the launch corridors, the view from the tee, the green approaches -- with
crowns allowed to close (`share` 0.5-0.6 of the summed radii). Mixes:
Pacific Northwest pine, cedar and alder; Mountain spruce and pine (the
photograph's wall); Desert a mesquite bosque with palo verde, cholla and
ocotillo (the Sonoran Desert's densest country is its washes' bosques);
Links gorse thickets (Bandon, the Old Course's whins); Midwest oak and maple
woodlots; Island palm and hala jungle; Autumn closed hardwoods; Haunted
Hollow a dead-wood thicket; Lakeshore the woods behind the dunes closed. The
Giant Redwood has none: its grown trees are up to 53,000 triangles each and it
is already a grove.

**Measured** (18 holes, seed `overhaul`, Node): stand trees per course --
PNW 12,173, Mountain 10,575, Autumn 12,964, Haunted 14,497, Lakeshore 9,171,
Desert 8,929, Midwest 8,225, Links about 16,000 gorse and shrubs (40,443 at a
5 m spacing, thinned to 8 m), Island 98 (its rim is sea). The wait to build
an 18-hole course barely moved (PNW 3.28 s; Island 6.38 s). Bench: every
rule clear once the tee-surround metric measured the open scatter alone (a
stand made every tee look clear-cut beside it: 35 courses failed with the
surrounds unchanged), and on ground that can hold a tree rather than rough
alone (stand needles turn rough into pine straw, shrinking the
denominator).

**The far twins** (BLENDER_ASSETS, *The cartoon packs*): 16,000 painted crowns
at 6,000-10,000 triangles each could not be drawn. Each painted tree ships a
twin built from the same seed with every lobe an icosahedron, about a twelfth
of the triangles, drawn where a crown is under `farPainted` of the screen's
height: Low and Medium 15%, High 5%, Ultra 3% (about 30 pixels on 1080
lines) -- PLACED.

**Frame cost** (`node tools/profile.mjs --only biomes --since`, High, RTX
4090, the profile's 9-hole course, seed PROFILE, player view):
graphics time per frame PNW 4.12 ms, Desert 3.22, Mountain 4.53, Links 4.71,
Midwest 4.30, Island 5.38, Redwood 5.72, Autumn 4.94, Haunted 6.53, Lakeshore
4.65 -- each below the stored baseline (28 September, before the frame-rate
goal: 5.0-8.7 ms), with 28-46 M triangles a frame against its 5.7-8.5 M. The
processor's 95th-percentile frame got worse on several (Mountain 22.3 ms
against 11.9, Autumn 25.6 against 14.6, Midwest 21.7 against 14.8): spikes,
probably the cull copying many more instances when it rebuilds. Not yet
measured on main's current build or on a weak card; the frame-rate phase owes
both.

**Round 1 in the game** (`bench/shots/overhaul/stands-r1/`): PNW and
Mountain read as forest cut through for the holes; but the stands are single
trees with bare ground between, their edge stands well back from play, the
hills beyond the property are bare, and the Desert's bosque is the old
leafless procedural mesquite -- a dead orchard -- until the desert pack is
remade.

**Rounds 2-5** (generator 40; `stands-r2` to `stands-r5`). 2: edges 15-20 m
nearer play (PNW rim from 70 to 50 m out, Mountain 45, Autumn 50), stand trees
1.2 times as tall and wide as the open scatter's (`grow`, PLACED: trees in a
closed wood reach for light), and a stand's floor shaded deeper and wider
(occlusion.js: 0.38 out to 1.7 crowns against a lone tree's 0.22 to 1.1) --
Autumn's overview now reads as the owner's hillside. Stand counts fell a
little (PNW 11,249) as the larger crowns took more room. The flyover's ring,
which assumed no tree passed 29 m, now asks the trees near it
(camera-tours.js; the full-forest test came within 3.9 m of a crown). 3-5:
the far hills (below).

## The overhaul's far forest (25 October 2026)

Past the course's own ground the landscape rings (landscape-edge.js) were bare
hills; the stands stop at the property line. The far forest is PAINTED by the
ground shader (ground.js, biomes.js `farForest`), not planted -- no geometry,
no texture, no sampler (the ground has one to spare against WebGL's sixteen):
crown-sized lumps on a jittered grid every `size` m (6-12), each lit from the
sun's side with its gaps dark; colours drawn per crown and drifting in groves
about 70 m across (three or four per landscape: Autumn red, orange, gold and an
evergreen); patchy by a 380 m noise to `cover` of the country (Links 0.3,
Desert 0.35 of olive scrub, Redwood 0.95); fading in over the first 70 m past
the edge, where the last real stand trees hide the seam (since the polish
goal: from the property line over 40 m, with real 3D crowns standing on it --
*The far woods*); held off ground
steeper than about 42-60 degrees (normal y 0.5-0.74: laid from above, the
pattern stretched into vertical scales on Mountain's faces, and real woods
stop at the rock anyway); and on Mountain held below 520 m. Where a crown is
under a pixel the lumps settle to their grove's colour at 0.72 brightness, so
the far hills stay mottled instead of shimmering or going flat. Every number
PLACED. Rounds: 3, the canopy appears (PNW's far mountain reads as the
owner's ridge photograph; Mountain's faces stretched; Autumn a flat salmon at
distance); 4, cliffs bare, a fourth colour, darker average (Autumn still
uniform at distance); 5, groves, which survive distance -- the Autumn hills
now drift in colour, a little blotchy where the evergreen groves fall.

## The overhaul's desert pack (25 October 2026, generator 41)

Read for tools/blender/cartoon_desert.py (REFERENCES, *Desert plants*), via
search summary. **Foothill palo verde** (Parkinsonia microphylla): 12-20 ft
tall and 12-25 ft wide (Arid Zone Trees), up to 25 ft (Oregon State, U of A
Arboretum), 10-13 ft (Yavapai extension) -- the sources disagree; smooth
yellow-green photosynthetic bark, often multi-stemmed and low-branched, an
open spreading crown, leafless much of the year. Models 5.5-7 m by 6.5-8 m.
**Velvet mesquite** (Prosopis velutina): about 25-30 ft and 15-30 ft wide,
crooked arching stems into a broad rounded crown; grows wild along washes,
dense stands there are bosques (U of A, AMWUA, Yavapai extension). Models
7-9 m by 8.5-9.5 m. **Saguaro**: 3-16 m, first arm at 75-100 years, some never
branch (Wikipedia); models 8-12 m with 0, 2 and 4 arms. **Teddy-bear cholla**:
1-5 ft (0.3-1.5 m) with a distinct trunk (gardenia.net, americansouthwest.net);
a new plant kind `cholla` at 0.7-1.6 m (PLACED: the top of the range), which
also draws a prickly pear and a barrel cactus -- before, the low cacti would
have been scaled to saguaro height. **Ocotillo**: 6-100 wand-like branches
from the root crown, 2-9 m (USDA FEIS), typically 8-20 ft (dimensions.com);
models 3.5-5.5 m with 12-24 canes.

**Rounds.** 1: palo verde flat discs on bare stalks (lollipops), mesquite
stacked pancakes, cholla a few big yellow flames, prickly pear pads merged
into one blob, agave leaves thin as grass; saguaro, barrel and ocotillo right.
2: palo twigs each carrying a cloud of small lobes; mesquite taller and rounder
lobes; cholla more, smaller joints; thinner pads set apart; agave leaves twice
as broad -- palo verde now 11,000 faces, cholla still flames. 3: palo lobes 80
triangles not 320 (3,500 faces); cholla joints chained on short arms turning
up. In the game (`desert-r3/`): the bosque is a green thicket of mesquite and
palo verde with saguaros in the open -- a little like an African savanna; and
some layered sandstone boulders look as if they float on slopes (the rocks'
next round).

## The overhaul's long grass (25 October 2026)

The owner's addendum asked for a large library of long grass for every
landscape, and on a links "the long grass ... for the areas between holes".
Sources (REFERENCES, *Long grass*), via search summary: **big bluestem** 3-8
ft, the flowering stalks to about 6 ft, the seed head three finger-like
branches, a turkey's foot (Purdue, Virginia Tech, Minnesota Wildflowers);
**marram** foliage about 30 cm to 1 m, flowering culms 50-145 cm, leaves 1-3
mm and rolled (naturescape, NZ flora); **red fescue** 8-120 cm across its
forms, the fine links types about 30-45 cm with hair-like leaves (RHS, VicFlora).
Clump heights in the game (PLACED, from these): fescue 0.55-0.8 m, marram
0.95-1.1, bluestem 1.2-1.5, alpine tussock 0.3-0.35, desert bunchgrass
0.6-0.75, sedge 0.35-0.45, moor tussock 0.4-0.5, plume grass 1.1-1.3.

**What was built.** The clumps (BLENDER_ASSETS, *cartoon_grass*), and two
plantings. Course-wide (vegetation.js `addLongGrass`, biomes.js `longGrass`):
colonies of 8-14 clumps within 4 m, in broad drifts, on ground that allows
grass at least 14-25 m outside the corridors; 1,800 (Island) to 7,000 (Links)
colonies a course, scaled by the tier's grass share; no shadows. Near the
camera, the tall tuft (native ground, or a tall-grass biome) is now four in
ten of its candidates as clumps of the biome's first long-grass family. All
decoration: nothing collides, no generated ground moves.

**Rounds.** 1: right shapes but hair-thin blades (1.5-3 cm) and see-through
clumps, gone at any distance. 2: blades 2.5 times as broad, 40% more of them,
a mound at the core -- which read as a faceted rock under the tall ones. 3: a
smaller, flatter, smoother mound. In the game (`grass-r3/`, `grass-r4/`): at
first too sparse to see (about one clump per 85 m2); colonies doubled in
size, and the near tall grass changed from brown spikes to fescue clumps with
straw tips. The links tee now looks over a fescue rough; the clumps' bases are
a little pineapple-like, a next round.

## The overhaul's brush (25 October 2026, generator 42)

The owner's addendum asked for brush and bushes for every landscape and THICK
brush where the ground was never cleared. Sources (REFERENCES, *Brush*), via
search summary: **creosote bush** an evergreen with many branches rising and
spreading from the ground, typically about 5-6 ft, 4-10 ft (1.2-3 m) high and
6-12 ft wide, yellow five-petalled flowers (NC State, Las Pilitas, Bird and
Hike); **brittlebush** rounded bushes 30-150 cm, grey-silver hairy leaves,
yellow daisies on long stalks (worldplants, DesertUSA, Oregon State); **big
sagebrush** field means 0.23-0.67 m across 15 western sites (USGS), nurseries
give about 6 ft -- the two describe different conditions, the field figure
was weighted; **bracken** fronds 1-2 m (RHS, Woodland Trust), russet in
autumn; **evergreen huckleberry** 1.2-4 m in the wild, squat in sun and taller
in shade (UW, Puget Sound field botany), the RHS's 1-1.5 m is a garden figure.
Sizes in the game (course.js `BRUSH_SIZE`, PLACED within those): creosote
1.2-2.6 m, brittlebush 0.5-1.2, sagebrush 0.5-1.4, bracken 0.8-1.7,
huckleberry 1.2-2.8.

**What was built.** The pack (BLENDER_ASSETS, *cartoon_brush*); an
**understory** under every stand (`stands.under`): its own hashed grid every
8-8.5 m, about half the sites kept, inside the stand only, by the
ground-plant rules (no trunk; clear of houses by 5 m like every plant; never
in the view from the tee) -- PNW fern and huckleberry, Desert creosote,
brittlebush and agave, Mountain huckleberry and fern, Midwest shrub and
bracken, Island naupaka, Autumn bracken and shrub, Haunted bramble and
bracken, Lakeshore bracken and shrub; and creosote and brittlebush in the
open Desert mix, sagebrush in Mountain's. About 14,000 understory plants an
18-hole course (28,000 at a 6 m grid with six in ten kept -- thinned for the
frame). A graphics tier draws a share (graphics.js `understory`: Low a
quarter, Medium a half, High and Ultra all), picked by a hash of position.

**Rounds.** 1: creosote big plates on bare sticks (a houseplant), bracken
thin and sparse; the rest right. 2: creosote strung with many small clumps
(an airy vase), bracken's leaflets broader and filled to the rachis. 3:
brittlebush and sagebrush mounds of more, smaller lobes (a dozen big ones read
as hexagons). In the game (`brush-r3/`) the understory is mostly under the
canopy, as a forest floor is, and shows at the stands' edges.

## The overhaul's island pack (25 October 2026)

Read for tools/blender/cartoon_island.py (REFERENCES, *Island trees*), via
search summary. **Coconut palm** (Cocos nucifera): 10-45 m in one guide,
tall selections 24-30 m (Agroforestree), maximum 30 m with a crown about 6 m
across (NParks); fronds about 4.5-5.5 m (botanical sources; one care guide 4-6
m, a Tamil Nadu sheet 3-4 m), 80-100 pairs of leaflets. Models 10-16 m with
fronds 0.38-0.46 of the height (PLACED: a cartoon palm's crown is bigger for
its height than a real one's, so it reads from afar). **Hala** (Pandanus
tectorius): 4-14 m (one source), 20-30 ft (UH CTAHR OF-17), forking at 4-8 m,
conspicuous prop roots, leaves 90-170 cm in four spiralling rows at the
branch tips (Australian Tropical Rainforest Plants, NParks). Models 7-9 m.

**Rounds.** 1: the palm's crown a small pom-pom of sparse triangles; the hala
long bare branches under small tufts. 2: fronds longer and broader with
twice the leaflets; hala branches shorter and forking, each tip a big
rosette -- the leaflets read as saw-teeth. 3: leaflets angled forward past
the next, so each frond is one full leaf; smaller hala fruit. In the game
(`island-r3/`): crowns thin from below and the hala's tufts all but gone --
single-faced leaves culled from behind -- and a brown knob atop every palm;
the thin-leaved families are now drawn two-sided and the knob is a small
green crown shaft (`island-r4/`).

## The overhaul's haunted pack (25 October 2026)

Read for tools/blender/cartoon_haunted.py (REFERENCES, *Dead trees*), via
search summary: a **snag** is a standing dead tree, often missing its top or
most of its small branches; USDA decay classes -- class II few limbs, no fine
branching, a generally broken top; class III soft, few large branches, bark
coming off in patches (Wikipedia, USDA). A **dead willow**: a broad trunk that
may be split, long drooping branches hanging in twisted cascades
(dimensions.com). A **dead oak**: wide-spreading twisting limbs, a skeletal
outline (stock descriptions only -- no botanical source was found, and the
shape is placed). The gnarled tree is placed outright: a storybook witch's
tree, the biome's signature.

**Rounds.** 1: willow and oak right; the gnarled tree's limbs thin and its
hooks lost; the snag a pole. 2: gnarled chunkier and harder-twisted (it
claws); the snag half as thick again. 3: the dead oak's limbs thicker and
more twisted (round 2's was a tidy textbook tree). In the game
(`haunted-r3/`): one hand at last; the snags' bare wood showed green (no
accent colour, so the leaf's) and is now pale.

## The overhaul's houses (25 October 2026)

PLACED, not researched: the low suburban house a course is lined with, pushed
toward a storybook -- deep eaves, a fat chimney, shutters, big windows -- so
it reads at 200 m. Palettes PLACED: pale walls with weathered red, slate,
brown and green roofs; stucco and terracotta in warm biomes.

**Rounds** (`rounds/houses-r1..3.png`; in the game `houses-r3/`, `houses-r4/`,
taken with the capture tool's new `--homes` views, since the fixed views'
course has none). 1: clean but flat walls, a slab roof that would vanish from
below, a pale chimney. 2: shutters, sills, corner boards, a plinth, roof
undersides, a brick chimney. 3: shingle courses (subtle front-on). In the
game: walls about 6% short of the collider (the eaves counted in the fit, and
the ingest's unit-height scaling) -- now fitted to the walls themselves and
recentred; the foundation and the sphere garden bushes are still plain (a
next round).

## The overhaul's props (25 October 2026, generator 43)

Pumpkins and toadstools for Haunted Hollow (tools/blender/cartoon_props.py).
The shapes are general knowledge rather than sourced (PLACED): a field pumpkin
squat and deeply ribbed with a short twisted stem; the fly agaric a red cap
flecked with white warts on a white ringed stalk, in troops. The proportions
are the old models', kept so the collision cylinders and the lantern faces fit
(BLENDER_ASSETS, *cartoon_props*); the radii were measured again off the new
models and changed generation slightly (generator 43, Haunted Hollow only).

**Rounds.** 1: pumpkins right; toadstools golf tees (long thin stalks, small
caps). 2: stalks short and stout, caps broad. 3: more and bigger warts. A
squashed pumpkin was made round, or its carved face would float off it.

## The overhaul's deadfall (25 October 2026)

Logs, stumps and mossy stones for the forest floor (tools/blender/
cartoon_deadfall.py). General knowledge, not sourced (PLACED): a nurse log
sags as it softens and carries moss along its upper flank; an old stump keeps
its root flares and a cut or broken top; boulders on a forest floor are
moss-capped. Decoration only (addDeadfall's own stream), so no ground moved.

**Rounds.** 1: logs straight pipes with small flat moss patches; broken
stumps a crown of big teeth with a flat hexagon of moss; mossy rocks
low-poly, the moss half the stone. 2: logs sag, swell and keep limb stubs
under a blanket of moss; splinters small and uneven; rocks smoother with only
a cap of moss -- the stumps' moss sank inside the trunk. 3: the moss set on
the skin. In the game (`deadfall-r3/`) a log reads on the redwood floor.

## The overhaul's redwood grove (25 October 2026)

The grove's species and proportions are the grown grove's (RESEARCH,
*Redwood* sections, for the sources): crowns as wide as species.js
`CROWN_FRACTION` says, which the generator spaces them by. What changed is
the hand -- the grown trees were realistic and 13,000-53,000 triangles each
(the baseline profile drew 159 M triangles a frame on Redwood at High); the
cartoon ones are 1,000-1,900 with far twins.

**Rounds** (`rounds/redwood-r1..3.png`). 1: the redwood right; fir, hemlock and
cedar too alike; tanoak 7,000 faces; the seedling three discs on a pole;
salal lily pads on the ground. 2: cedar long drooping ragged sprays, hemlock
feathery; tanoak's lobes a quarter the triangles; seedling full; salal a
mound under its leaves. 3: the redwood crown fuller and deeper. In the game
(`redwood-r3/`): a cathedral grove of red columns -- perhaps too orange; a
next round. The far-swap test's near limit was 300 m for the grown crown;
the cartoon redwood's leaf part is its narrow top third, small on screen
sooner, so it swaps from about 150 m (tests/instance-cull.test.mjs).

## The overhaul's Lakeshore remake (25 October 2026)

The same plants as Lakeshore Dunes' research (RESEARCH, *Lakeshore Dunes*), in
the overhaul's hand (tools/blender/cartoon_lakeshore.py). **Rounds.** 1: oak,
maple, juniper and driftwood right; the cottonwood broccoli (a small crown on
a big trunk); dune grass thin. 2: the cottonwood's limbs each carry a broad
cloud; dune grass patches of 12-18 tussocks with broader blades -- read as
celery stalks. 3: the tussocks splay. In the game (`lakeshore-r3/`): the
near-field tall grass, now marram clumps (the long grass's first Lakeshore
family), stood a metre high in front of the tee and hid the ball -- so no
tall grass grows within 10 m of any tee (vegetation.js, short tufts there),
and the long grass's marram got a fourth round (splayed, `rounds/grass-r4.png`).

## The overhaul's lighting (25 October 2026)

The cartoon light, five rounds (docs/CARTOON_OVERHAUL.md *Lighting*). Rendering
only; no generated ground moved. Every number here is PLACED by eye against the
captures unless it says otherwise.

- **The ramp** (textures.js `rampSteps`): eight steps, 70 84 100 122 150 184
  218 250 of 255 (was four: 90 145 205 245), sampled at `dot(n, sun)*0.5+0.5`,
  steps centred at 1/16, 3/16 ... 15/16. A slope turned 30 degrees from a sun
  60 degrees up now draws about 15% darker than the flat beside it in the
  direct light (8% with four steps). Coloured: each step leans toward the
  landscape's `light.shade` by .9 .85 .7 .5 .3 .15 .05 0 (darkest first), the
  colour divided by its own luminance so the brightness of each step stays
  within 4/255 of the grey ramp (tests/toon-ramp.test.mjs). Shades: PNW
  #7f93b0, Desert #a78aa6 (dusty violet), Mountain #7c90c4, Links #8a98b0,
  Midwest #8494bc, Island #6fa0bf, Redwood #6f8f98, Autumn #9a7fa6, Haunted
  #8a70b0, Lakeshore #8199bf. three reads only the ramp's red channel; the
  chunk is patched to read all three.
- **The rim** (textures.js `rimLit`, painted crowns only): (1 - n.v)^4 times
  .35, times the hemisphere's sky colour plus the sun's colour times
  (sun behind)^2 times .9, times the surface colour. Round 1 had (1 - n.v)^3
  and .6 of the sun: pale crowns (birch, aspen, autumn yellows) went pastel.
  Not on grass: its normals point up, so the term would light every clump.
- **The bounce**: the hemisphere's ground colour is half the old olive #777855
  and half the landscape's rough (or `light.bounce`). The clock still pulls it
  to the dusk and night ground colours; the bounce still only falls as the sun
  sets (tests/daylight.test.mjs).
- **The split of the light**: hemisphere 1.15 to .95, sun 2.8 to 3.05
  (renderer.js `HEMI`, `SUN`). With three's Lambert terms that is about a
  quarter of a flat surface's light from the sky where it was over a quarter
  -- the rough reckoning that made it worth trying, not a measurement.
- **The grade** (textures.js `GRADE`): three's ACES curve, then saturation
  times 1.12 about luminance, in the custom tone-mapping slot every material
  and the bloom's composite include -- no extra pass.
- **Twilight** (daylight.js): the air's tint runs DUSK #e8925c, TWILIGHT
  #8a77a8, NIGHT #16233f as the sun goes from 1.5 degrees up to 3.5 under;
  luminance .385, .213, .015, so it still only darkens. Without the middle
  colour the half-way air was a brown-grey.
- **The afterglow** (renderer.js sky shader): strength smoothstep(-6, -.5,
  sun elevation) times (1 - smoothstep(1, 12, elevation)) -- from twelve
  degrees up to six under, strongest at the horizon. Near the horizon (exp(-7
  h)), toward the sun an orange-to-rose burn up to .8, opposite a pink band up
  to .32: the Belt of Venus, the pink band of backscattered sunset light
  above the anti-twilight horizon (REFERENCES).
- **Mist at night**: lifted toward white by .05 + .17 x daylight (was .22
  always). At night the far hills' mist outshone the sky.
- **Exposure**: a landscape may set `light.exposure` (Desert .9), applied in
  proportion to daylight so every night reads alike.

Rejected: tinting the cast shadows through the shadow term (CSM replaces
three's light loop, so a patch there would have to follow it); a fixed
saturation per landscape (the chunk cannot take per-landscape uniforms
without recompiling every program). Sources: Barla, Thollot and Markosian,
*X-Toon* (rims and tone by view); the stylised-foliage tutorials already in
REFERENCES (Inasa Fujio); *Belt of Venus*.

## The overhaul's frame rate, first pass (25 October 2026)

The numbers, the changes and what was rejected are in docs/CARTOON_OVERHAUL.md
*Frame rate*; the figures that set the levers:

- **Where a frame went** (`tools/frame-tris.mjs`, High, first tee): Autumn
  46.6 M triangles in the picture's buffers, maples, oaks and aspens 8,900-
  10,400 a crown (66% of crowns whole, out to about 320 m at High's 5% line)
  and shrubs 5,465; Links 34 M, of which long grass 15.7 M (77,000 clumps)
  and gorse 11.5 M (3,400 a bush, no twin); PNW's pines 5,700-7,600.
- **Ground against plants** (`tools/frame-variants.mjs`, Desert, High, tee 1):
  main 1.08 ms = ground 0.67 + the rest 0.41; branch 2.67 = ground 0.97 +
  the rest 1.70. The far forest painted on the hills costs nothing measurable;
  the ground's own shadow 5%; brush 19%; trees' shadows 15%.
- **Lobes**: icosphere subdivisions in Blender are 20, 80, 320 faces at 1, 2,
  3; a UV sphere of 12 segments and 7 rings is 144 with a twelve-sided
  outline. Chosen by eye on the contact sheets.
- **Long grass reach**: 90 / 130 / 190 / 260 m by tier, sinking from 60% of
  it -- PLACED; a clump of a metre is about 5 pixels at 190 m on 1080 lines.
- **Twins sooner on Low and Medium**: .30 and .25 of the screen's height
  (PLACED, from the measured 10-17%).

## The overhaul's course furniture (25 October 2026)

What the tee box carries on a real course: two markers per set of tees, the
hole sign (number, par, length) beside the back tee, a bench and a ball
washer. The sizes are PLACED from general knowledge of the equipment, not
looked up: moulded tee markers about 15-20 cm across and 10-15 cm tall
(placed 17 and 11), ball washers at about hip height (1.05 m to the crank),
benches about 1.6 m long with a 45 cm seat. Where they stand is the game's
own rule: the bench 2.2 m behind and 1.6 m beyond the sign facing the tee,
the washer 1.6 m ahead of the sign (renderer.js `addHoleDetails`; PLACED).
Round 1 (`rounds/course-r1.png`, in the game `course-r1/`): it reads -- a
blue dome on the tee, the sign with its card, the washer and the bench --
and the gable cap is a flat slab seen from the front. Round 3 (models round
2, `rounds/course-r2.png`, in the game `course-r3/`): the cap's ridge turned
to run front to back so its triangle faces the tee, 2.52 m to the ridge
(PLACED, from 2.35), and the washer's round lump made a squared housing
with a domed lid, as paddle washers are; both read at 25 m. Close to (3.6 m)
that read as a mailbox: round 4 made it an upright plunger washer -- 16 cm
square housing from 0.78 to 1.10 m, a 19 cm cap, the T-handle to 1.27 m
(PLACED, from the common upright plunger washers). The sign's gable ends and
soffit are timber; the black under its roof was the gable end's colour, not
the underside's lighting, though both were changed.

### The clouds, rounds 6 and 7 of the light (26 October 2026)

clouds.js: puffs are detail-2 icospheres (320 faces, were 80) flattened below
a quarter of their radius; seven to twelve a cloud (were four to seven), sized
by how far from the middle they sit so a cloud domes up. Shading, installed
with the fade after the cascade setup: normals 62% toward the cloud's centre
(the crowns' 80%, a little less so the puffs still read), the underside
tinted .66 .72 .86 below 70% of a band 0.45 radii deep from the cloud's base,
a rim of (1 - n.v)^6 times 0.4 of the sky colour plus the sun's colour times
(sun behind)^3 times .8 -- round 6 had ^3 and 0.5 and the outlines glowed.
All PLACED by eye. About 48,000 triangles for the whole sky, against 7,000.

### Heather's paint, rounds 4-6 (26 October 2026)

ground.js, code 8: cushions from two octaves of patch noise (2.6 m and 0.8 m),
lit .66-1.22; the mat is the heather tint (15% toward the rough) mixed with
a dark olive (linear .10 .11 .05) at 50%, 78% where the tint's blue exceeds
its green by a sixth (a heath in bloom); bloom flecks on 30% of 0.3 m cells
over the cushions, 1.35 times the tint. All PLACED by eye; a dead moor (a tint
whose blue is not over its green) takes no bloom.

Round 7 (heather near the camera): on heather ground the near-field tiles draw the heather model (Blender_Heather_1) for three in ten of their candidates, 0.30-0.55 m tall, leaf #5a5a3c and bloom #a86aa8 (Haunted #4a403c and #6c5862) -- PLACED; fading with the tiles between 28 and 48 m.

## The overhaul's wildflowers (26 October 2026)

The rough's flowers (vegetation.js addGroundCover; Midwest, Mountain, Links
and Desert, 16% of the scatter's grass as before) as three meadow forms:
ox-eye daisy, a small aster and a cup flower. Shapes and sizes from general
knowledge, not looked up: 20-30 cm tall, heads 4-7 cm. Their colours are the
landscapes' own (`scatter.flowers`). Drawn to 0.4 of the tier's long-grass
reach (High 76 m), sinking over its last 40% -- PLACED, from the 8 M
triangles they cost unbounded.

### The far forest, round 6 (26 October 2026)

ground.js: past the single crowns (farSize, 6-12 m), clusters from a jittered grid 26 m apart, nearest-point, each picking one of the four farForest colours, mixed in at three-quarters where a cluster spans more than a few pixels (fwidth against 26 m: full below .15, none above .6); the groves (70 m) blended half toward the average of the four colours; brightness .84-1.08 from patch noise at 19 m. PLACED by eye on Autumn's overview.

## Reading the ground, the overhaul's phase (26 October 2026)

Numbers behind docs/CARTOON_OVERHAUL.md *Reading the ground*:
- Clear: green definition 85 (lift 3.9, bend 4.0), bands 65; Natural 50 and 40
  (unchanged). PLACED from the captures.
- The putting surface's sheen cap: 0.10 either way below lift 2.3 (definition
  50), rising smoothly to 0.18 at lift 3.9 (85). The cap was 0.10 because at
  4.5 times the gain whole regions of a green changed tone as the camera moved
  (the owner, September); 0.18 is a little under twice it, and still a quarter
  of that gain.
- Contours on greens and fringes every 0.05 m (a 3% green: a line every 1.7
  m), darkening 0.30 (0.22 elsewhere, a line every metre). 0.10 m was tried
  first: lines 3.3 m apart, one or two across a green.

## The overhaul's gardens (26 October 2026)

The gardens of the houses that line a course, from general knowledge, not
looked up: picket fences about a metre high in sections of about 1.6 m;
clipped boxwood, mophead hydrangeas and topiary cones along a house front.
Sizes PLACED: fence 1.04 m to the post caps; shrubs 1.15-1.6 m in the game;
the footing 0.09 m proud of the walls, in the biome's rock 45% toward
#6b6357. Bloom colours (white, lilac, pink, blue) PLACED.

### The shallows, rounds 8 and 9 of the light (26 October 2026)

renderer.js `WATER_EDGES.still`: depth = the body's level minus the ground
grid's height there (the sea's `seaHeights` map, now handed to still water
too; past the grid a pond reads as deep). Over the last 1.8 m (0.9 m in round
8, a hairline against a cut bank) the colour is lifted by (1.12, 1.20, 1.05)
plus (0.06, 0.09, 0.05) at up to 85%, and the water's opacity falls to 72% --
the bed showing through. PLACED by eye on Midwest and Lakeshore.

### Cliffs and cut banks, rounds 4-7 (26 October 2026)

ground.js: steepness is 1 - smoothstep(.55, .9, normal.y). Hardpan on steep
ground: bands every 2.4 m of height (warped by patch noise at 11 m), mixed
55% toward the rock colour, lip +12% over the top 7% of a band, shadow -14%
over its first 6-14%. Rock: planes 70% patch noise, 30% their old hard cells;
ledges +10% / -12% on the 6.5 m strata. The detail atlas's stone channel at
30% of its strength on steep rock, 55% on gentle. All PLACED by eye.

### The flag flies downwind (26 October 2026)

renderer.js: every frame the cloth is turned to the wind's bearing
(`windDirection`, the bearing it blows toward; the same convention as the
trees' sway and the ball's drift) and set off the stick along it. Its ripple
runs at 1.6 + 0.13 x wind (mph) radians a second and its depth grows from the
stick to the free edge: 6 cm there in a calm, 13 cm at 10 mph, 25 cm at
25 mph, for a 0.48 m cloth. All PLACED by eye; no source was used -- a real
flag in a calm hangs limp, which this one does not (a cartoon flag that hung
would hide its number).

### Water, sand, edges, clouds and a drive: the late rounds (26 October 2026)

All PLACED by eye; no outside source.

- **Ponds (cartoon style only)**: metalness .62 to .38, reflection strength
  2.1 to 1.3, and the ripple's tilt of the surface normal .5 to .17 of its
  amplitude -- the last is what cleared the brown smears (the reflected woods
  scattered by the ripples). Deep water's opacity held to at least .82
  (made no visible difference). The sea, rivers and creeks are unchanged.
- **Bunker rake**: patches from a jittered 4 m cell pattern; each patch's
  furrows are arcs about a centre 6-14 m from the patch; 5.4 furrows a metre
  (18.5 cm apart); a groove 24% of the spacing wide at -7%, a lit ridge at
  +6% beside it, then a third deeper (x 1.36). Faded by on-screen spacing as
  before.
- **Ink outlines (tee furniture only)**: the inverted hull, 0.8 cm in world
  space (1.2 cm was too heavy), colour #2b2622.
- **Clouds**: every puff's flat base (cut at -0.25 of its height) set on the
  cloud's own base height; before, each sat at a random -0.05 to +0.11 of the
  cloud's radius.
- **A drive's paving**: 32 x 96 texels over 3.4 x 9 m; joints every 3 m and
  down the middle at 72% brightness, a 2-texel border at 107%, a 6% mottle;
  base #d6d1c3 (was #b3ae9e as a flat slab).

### A house's shade on the ground (26 October 2026)

occlusion.js: a pool round each house's turned footprint, full strength at the
walls fading to nothing 4 m out, strength .7 (round 2's .45 out to 2.5 m was
not seen: the bake's texels are 1.75 m). The ground shader takes 60% of the
bake (the fixed shade look), so the ground at a wall is about 40% darker. The
rough's grass blades are not darkened by the bake, so in long rough the pool
reads faintly. PLACED by eye.

### Crisp shadows, and drives on the ground (26 October 2026)

**Shadows (renderer.js `shadowRadius`).** In the cartoon style the PCF spread
is 0.4 of the tier's (High 3.5 to 1.4 texels, Ultra 4 to 1.6, Ultra's nearest
map 2.67 to 1.07), never under 1 (Low and Medium keep 1). PLACED by eye.

**Drives (homes.js).** On the ground, tilted along the 9 m to the ground at
both ends, 4 cm up; grass kept off a 4 x 9.6 m footprint (0.3 m margin).
Paving 64 x 192 texels (about 19 a metre): concrete #c4bfb1 in 3 m panels; in
warm landscapes sandstone #e4c8a0 in 0.6 m flags, running bond, joints 80%,
each flag 93-107%. The texture had written linear colour values into an sRGB
texture, darkening every drive -- fixed with `getRGB(..., SRGBColorSpace)`.
PLACED.

### Seated trees (the polish goal, 26 October 2026)

tree-seat.js. A plant's footprint: for trees, the widest BARK vertex in the
bottom 2% of a family's models, as a share of model height, x 1.3 (lift and
girth both reach 1.14), capped at 2.5 m -- pine 0.079 x h, oak 0.161, aspen
0.043 (the skirt-included widths, before round 2: spruce 0.202, cedar 0.307);
for ground cover a third of its spread. The seat: the most the foot's plane
stands above the ground on four rings (R, 0.75R, 0.5R, 0.25R) of 24 points,
plus R x 0.05 (the lean), plus 8 cm; a cover's plane follows the ground's
gradient up to 40 degrees and its seat is capped at 75% of its height.
Generation (44): no cover where the slope over 0.6r (or half that) passes
tan 40; no trunk where the ground falls more than 0.15 h within
min(2.5, max(1, 0.1 h)). All PLACED by measurement against the metric, not
from a source. Results: floating plants 3,661 / 65,178 -> 123 -> 61 -> 3 -> 0
(quick tier, then the full tier's 588,521). Seat depths: median 0.12 m, p95
0.90 m, max 7.7 m. Cost 0.11-0.15 s per 18-hole course on this PC.

### Tee boxes' mowing (the polish goal, 26 October 2026)

ground.js. A tee is cut with a walk-behind mower (about 0.55 m a pass) in
passes along the line of play, then once round its edge. Drawn: bands 0.6 m
wide (period 1.2 m) across the pad and its mown collar, contrast +/-7.5%,
in the pad's own frame; a clean-up lap 0.55 m inside the mown tee's outer
edge, reversed and darker by 4%; divots in the strip across the markers'
span (|across| < 2.3-2.85 m) from 0.5-0.9 m to 2.8-3.4 m behind the tee's
point, quarter-metre cells, 18% of them, each an oval about 7 x 11 cm,
tinted (1.16, 1.02, 0.70) at 60%. All PLACED by eye; the mower width is
general knowledge of walk-behind greens/tee mowers (21-26 in), not a cited
source.

### The fade from a tee into tall grass (the polish goal, 26 October 2026)

vegetation.js `teeFade`: the distance from a point to the nearest mown tee's
edge -- a rounded box of TEE_APRON.x by the pad's half-length x
TEE_APRON_SCALE, corner TEE_ROUND x TEE_APRON_SCALE, in the pad's own frame,
the shape ground.js paints. Fade f = smoothstep over 1.2 m (nothing tall)
to 7 m. Long-grass colonies: kept with probability f^0.7, height x
(0.35 + 0.65 f). Tiled tall clumps: likewise. Course-wide blades: height x
(0.3 + 0.7 f), and the native ground's 1.9 x lift becomes 1 + 0.9 f. Ground
cover (marram, dune grass): scaled x (0.35 + 0.65 f). All PLACED by eye.

### Water depth colour (the polish goal, 26 October 2026)

renderer.js WATER_EDGES. Still water: deep = smoothstep(0.15, 3.2 m, depth);
shallow body = mix(water, (0.5, 0.66, 0.52), 0.35) x 0.62; deep body = water x
(0.2, 0.32, 0.4); lit by the light the surface receives (the foam's
`foamLight`); its share 0.78 x (1 - clamp(1.4 x Schlick, 0, 0.85)); opacity
at least 0.86 (shallow) to 0.97 (deep). The sea: smoothstep(0.4, 8 m); shelf
mix(water, (0.55, 0.72, 0.6), 0.4) x 0.7; open water x (0.22, 0.34, 0.46);
share 0.7 x the same Schlick term. Past the ground map, depth = 50 m. Calm
water's mirror: metalness 0.5, reflection 1.8. All PLACED by eye. The
reflection probe is a sky probe, so a pond seen across shows sky, not the
trees on its far bank -- a real reflection would need a reflector per body.

### Mountain's crags and far peaks (the polish goal, 26 October 2026)

landforms.js crags with `jag` (Mountain: 0.55): spur = ridged(x/(0.25 scale))^2
(scale 300 m); the terrace input bent by jag x (spur - 0.35), faded in over
massif 0.05-0.5; faces roughened by jag x (0.2 (ridged(x/23) - 0.4) + 0.08
(ridged(x/9) - 0.4)) x 70 m. Rock: threshold t = 0.34 + 0.18 (n19 - 0.5) x 2 +
0.1 (n61 - 0.5) x 2 on the gradient, rock over t..t+0.2; outcrops where
0.6 n19 + 0.4 n61 passes 0.62-0.74 on slopes over 0.12-0.3; scree on slopes
0.16-0.26 below t. Rock paint (ground.js): vertical joints every 5.5 m along
the contour, -20% in a crack, +8% on its lit edge, weighted by steepness
squared; strata weight 0.45. Far peaks (landscape-edge.js, `ringPeaks`): a =
ridged(x/1500)^1.6 x 0.85 + ridged(x/560)^2 x 0.3 (0.4 + a) + ridged(x/240) x
0.09 a, capped at 1.25, x ringLift 950 m; ring vertices doubled. All PLACED by
eye. Real alpine crags (Banff's Mount Rundle, the Canadian Rockies' thrust
sheets) show cliff bands broken by gullies and buttresses rather than even
terraces; granite crags break along vertical joint sets -- general
geomorphology, not a cited figure.

### Shared links fairways, the polish goal's rounds (26 October 2026)

course.js `shareFairways`, Links: gap 85 m, parallel within cos 0.9, a join
only over runs of at least 140 m, gaps up to 70 m closed, the shared reach
averaged over 60 m, tapered to the fairway's own width over 170 m and over
0.6 of that at the stretch's ends; the stretch from 10 m past the mown start
to 25 m short of the green (the neighbour's 5 and 20). `keepStrips`: where
fairways come within 14 m without touching, each edge pulls back by half the
shortfall, eased over 57 m, never into a joined stretch, never more than a
third of the fairway's width. Holes joined on five 18-hole seeds: 3, 0, 3, 2,
4. All PLACED by eye from the surface maps; no new source.

### The far woods (the polish goal, 26 October 2026)

far-woods.js: bands from the property line to 12,800 m; spacing max(13 m,
0.06 x (d + 150 m)); each band max(4 spacings, d/4) deep; jitter 0.8 spacing;
kept by the painting's patch noise (380 m cells) against cover +/- 0.12,
below the treeline +/- 20 m, above 0.5 m (water), slope under 0.9 (near) or
0.65 (groves) measured over 0.3 spacing. Near (under 420 m): clusters of
three 20-face lumps, radius 0.55 x farForest.size x (0.75-1.25), or two-tier
7-sided spruces; groves: a 20-face dome (r = 0.55 spacing x size, 0.42 tall)
or a 6-sided cone (0.55 r wide, 2 r tall) on conifer landscapes, sunk by
r x min(0.6, slope). Twelve angular sectors per mesh; renderOrder -1. Counts:
Autumn 16,973, PNW 15,859, Midwest 10,423, Mountain 7,326, Desert 4,014,
Island none. Building them: 36-95 ms a course here. The painted forest under
them starts at the property line, fading in over 40 m (was the ground's edge
and 70 m). All PLACED by eye.

### The far landscape, seated on the drawn ground (the far-landscape goal, 26 October 2026)

Measured first (scratch `bench/shots/overhaul/_drawn.mjs`, seed `overhaul`,
nine holes): a far crown's centre stood above the ground as DRAWN (the ring's
triangles) by more than 1 m on 2,019 of 10,426 sites on Lakeshore (worst
108 m), 987 of 3,944 on Desert (153 m), 445 of 2,394 on Links (31 m), 294 of
6,621 on Mountain (135 m): the sites stood on `ringRelief` sampled at the
crown, while the ring is drawn from vertices up to hundreds of metres apart.
`drawnGround` reproduces the ring's vertices within 0.5 m (nudged 0.01%
inward of each; exactly, 0.00 m, against a brute-force search of every
triangle at 4,000 points per course, once a fallback searches the
neighbouring bands whole -- 10 of 4,000 points had fallen in the band beside
the one their distance named).

The seat (far-woods.js `seatOn`): samples on rings at 0, 35%, 70% and 100% of
the base (1, 8, 14-48 and 22-96 points; the rim's spacing max(0.5 m,
2 x max(0.3 m, 0.02 r) / (1.5 x slope + 0.1)), so a valley line crossing the
rim between samples dips less than the tolerance) plus every drawn vertex
under the base; a grove's plane by least squares, its slope capped at 0.58
(30 degrees); the base let down to the lowest point under it, plus 2% of the
radius. A grove let down by more than 35% of its height retries at 67% of
its size, twice. Base widths and heights measured from the built shapes:
cluster 1.01 x 1.01 r (three lumps cut on one floor at -0.295 of a unit),
spruce 0.8 x 3.38 r, dome 0.86 x 0.5 r (its overhang reaches 1.08 r), cone
0.55 x 2 r. Water: the sea below level + 0.4 m, a lake or a creek
(`lakeOwner`, `streams.at`) inside the course's ground; the surface
classifier at each crown's centre only.

Bench `farSeated` (tolerance max(0.3 m, 0.02 r), PLACED as under a pixel):
full tier 0 floating and 0 in water of 920,167 crowns (both tier forms);
the gap's 95th percentile -0.13 m. Placing them on an 18-hole course, seed
`overhaul`: Autumn 0.38 s (start 0.13), Giant Redwood 0.32 (0.12), PNW 0.30
(0.12), Lakeshore 0.28 (0.09), Mountain 0.21 (0.10), Desert 0.17 (0.05).
The surface classifier at every sample took Autumn to 4.2 s; asking lakes
and creeks directly, 0.93 s; seating each crown only as its tier draws it,
0.65 s; the rim's spacing by slope, 0.41 s.

### The far ring's ground and Desert's mesas (the far-landscape goal, 26 October 2026)

The ring's ground (ground.js): past the course's ground grid, the
landscape's floor ground type painted everywhere (only Desert has one:
hardpan), and `ringFace` on faces whose normal's y is under 0.8, fully under
0.62 (rock on every landscape but Desert's hardpan banks; none on Links,
Lakeshore and Island). Patterns fade to the type's average colour as a
texel's footprint grows from 0.3 to 2.5 m (floor to 70%, faces to 50%). The
painted far forest stops under the sea: masked out below 0.3 m above sea
level, in fully from 1.2 m.

Desert's mesas (landscape-edge.js `mesas`), heights as shares of `ringLift`
(240 m): a field fbm(x/4000, z/4000, 3 octaves), its position warped by
+/-350 m (a 1.4 km fbm); tier 1 where the field crosses 0.55 (+/-0.018),
0.62 of the lift (149 m); tier 2 at 0.62 (+/-0.014), 0.36 (86 m); a talus
apron below each, 0.12 and 0.06 (29 and 14 m) over the field's last 0.08 to
0.02 before the tier; a floor of fbm(x/900) x 0.06 (14 m). Faded in over the
ring's first 900 m as every ring relief is. Rings: 16% wider each, at most
220 m (were 28% and unbounded), and 2.5 times the vertices round each (peaks
take 2): 50,664 vertices and 96,801 triangles on seed `overhaul`. Round 1's
field (2.4 km, four octaves, 6 m cliffs, three tiers) broke into jagged
fragments a few rows wide (`bench/shots/overhaul/ring/desert-mesa1.png`,
CPU hillshade). All PLACED by eye against Monument Valley's buttes (about
300 m) and the Colorado Plateau's stepped mesas.

Round 3: Island's islets (`ringIslands: 5`): centres 2.5-6 km past the
ground's edge at a seeded bearing, radius 260-780 m, a beach skirt 3.5 m
high out to 1.25 radii and a hill 24-70 m high inside 0.95 radii, the
outline varied by a 260 m noise (+/-12.5%). Haunted Hollow's near crowns:
three bare spikes (0.07 of the radius wide, 1, 0.78 and 0.66 of the height,
leaning 0.04-0.08 rad), each with two broken limbs, base 0.54 wide, 1.6
tall. Autumn: `farForest.evergreen` 0.2 (spruces and cones in its fourth
colour), `ringLift` 170 m (was 70). Round 4: the near-to-grove switch at
300-540 m by each site's hash (was a line at 420 m); a near crown's radius
max(r0, 0.4 x its band's spacing) x its size. The treeline, water and slope
tests read the drawn ground (the fine relief past the ground's edge was a
third of the far woods' time). The seat's outer rings (70%, 90%, rim)
refined where two neighbours differ by more than the tolerance, up to six
halvings (a Desert crown hung 1.6 m over a bank its slope estimate never
saw; a Mountain crag's gully fell 15 m in 3 m). Full tier: 0 floating, 0 in
water.

### Trees in still water and waves at the edge (the far-landscape goal, 26 October 2026)

water-mirror.js, round 1: a tree is mirrored when it stands within 30 m
(60 m from round 3) plus its own height of a still pond's rim (the pond's bounding radius from
its centre) and its foot is at least 0.2 m above the pond's level. Its twin:
a conifer (by kind: pine, spruce, cedar, fir, hemlock, redwood, cypress,
larch) as the far woods' spruce shape, 83% of the tree's height from a
sixth of the way up; anything else as the cluster, its top at the tree's
top, 1.02 x the crown radius tall (at most 70% of the tree). Trunks were
2.5% of the height wide, then 1.4% (round 2), 40% of it tall (round 3); they
read as posts and went in round 5. Round 6: under each crown a dark column
from the tree's foot to the crown (plus 0.3 of its radius into it), 7-sided,
0.7 of the crown radius (a spire's: 0.18 x the height x 0.7), at 0.32 of the
crown's colour -- the shade under the woods, so a reflected crown joins its
bank. Coloured from the far forest's colours, unlit; turned over about the pond's
level (y -> 2 x level - y). The picture: half the drawing buffer each way,
cleared to transparent, drawn only while a still pond's rim is within 700 m
of the camera. The pond reads it at its fragment, offset by 0.012 x the
rippled normal, lit by the water's own received light x 0.8 (0.55 from
round 2), mixed in by min(0.9, 1.6 x Schlick + 0.15) (round 2: min(0.92,
2.2 x Schlick + 0.35); round 4: min(0.92, 2.8 x Schlick)). Read as four taps
1.5 of its pixels apart, averaged (round 3), 6 apart (round 5). Round 7:
the shade columns half toward #1e2418, 0.7 as wide at the foot. Round 8:
the bank, from the waterline 1.5 m out and 0.5 m up, the rough's colour x
0.45 a third toward the shade tone. Round 9: crowns 1.35 x the crown radius,
to 75% of the tree (was 70%). Round 10: by the wind, w = min(1, wind / 15
mph): the ripple offset 0.006 + 0.018 w of the screen, the blur's taps
3 + 6 w pixels apart. All PLACED.
High and Ultra only.

Shore foam, round 1 (renderer.js FOAM_FRAG): two wavelet trains along the
outline, about 7.3 m and 11.9 m long (rounded so a whole number fit the
shore), travelling at 0.11 and 0.07 wavelengths a second of the foam's
clock (opposite ways); each wavelet's reach 0.25-0.75 (first) or 0.2-0.65
(second) of the 1.4 m strip by a hash of its index, plus up to 0.08 of slow
noise; a lip 0.07 deep and 0.1 behind the front, a wash at 45% from the
bank to half the front. Round 4: a wet line always at the bank, from 0.015
to 0.03-0.12 of the strip (a slow noise along the shore, 0.43 a metre, 0.17
of the clock), at 0.32-0.5 strength by the lace. Round 8: the wind's shore --
per point, 0.5 + 0.5 x (the bank's outward normal . the wind's heading) x
min(1, wind / 12 mph); the wavelets' reach x 0.45-1.25 and the lip's
strength x 0.5-1 by it. PLACED.

Still water's crests (renderer.js WATER_EDGES `still`), round 2: crests
running in along the depth lines in the last 0.7 m of depth; round 3: only
between 0.08 and 0.4 m deep, gated by a broad drifting noise, a lift of
about 0.1-0.12 of white. PLACED.

Standing ripples (WATER_EDGES `river`, `creek`, round 5): water over a bar
or stone throws a V of waves that stays put while the flow passes through.
River: crests where sin((0.9 x downstream + 0.6 x |across|) x 2 pi) is above
0.55-0.95, gated by noise at 0.05 x 0.2 of the channel's metres (patches of
about 20 m by 5), 0.1-0.3 strength rising toward the banks, laced. Creek:
1.7 and 1.3, noise at 0.08 x 0.3, 0.38 strength. Fixed to the bed (no
drift). Round 6: river 0.5 and 0.35 (crests 2 m apart), gate 0.42-0.68;
creek 0.8 and 0.6 (1.25 m apart), gate 0.35-0.6, 0.55 strength -- at 0.6 m
the crests were thinner than a pixel from the bank. Round 9: a wet line in
the outer 7% of a channel's half-width (0.93-1 of `shore`), 0.35 strong.
Round 10: a channel's water faded in over its first 3 m and out over its
last. Round 11: the sea's swash cycle 9 s of its clock (30 s real) and the
whole run-up; a lake drawn as sea (Lakeshore, `lakeWaves`) 5 s and 0.6 of
it -- wind waves on a lake are shorter and smaller than ocean swell. Round
12: breakers gated by smoothstep(0.35, 0.65) of noise at 0.012 a metre,
drifting 0.04 and 0.03 of the clock. Round 13: a creek's crests 0.3-0.85 of
the wave, 0.8 and 0.35 a metre, gate 0.3-0.55, 0.7 strong. Round 14: wet
sand -- below 0.05 m over the sea fully, fading out by 0.45 m, the colour x
(0.74, 0.76, 0.8) at 0.85, where red - green > -0.06. Round 16: a pond's
wavelet lengths x clamp(shore / 300 m, 0.6, 1.2). PLACED.

Mowing that shades with the view (ground.js; the diamonds' round 7, the
tee's round 5): cut grass reads light where it is laid away from the eye
and dark toward it, so a stripe's tone is its pass's light or dark times
the cosine between the pass's line of travel and the view. Greens: two
passes at right angles, each x 0.33, so the pair reaches the old range;
tees: one set of passes along the line of play, x 1.3 clamped to 1. PLACED.

Far scrub in clumps (far-woods.js, round 7): past the cover patchwork (380 m
cells), a scrub site is kept with chance smoothstep(0.5, 0.7) of a second
value noise at 150 m cells -- about two in five, gathered. PLACED.

### Links shared fairways, the far-landscape goal (26 October 2026)

Survey (scratch `_sidebyside.mjs`): pairs of holes within 26 degrees of
parallel for 60 m or more, on `overhaul`, LINKS-A..D and S5 (18 holes): 35
pairs, 4 joined, rough between them 25-113 m. Coverage of each pair's join
over each hole's shareable stretch (mown start + 10 m to 25 m short of the
green): crossbars 60-63% on both holes (`overhaul` 9-15, LINKS-B 8-9 and
4-5), double fairways 66-100% (LINKS-C 9-10 72/66, S5 9-15 81/100, 10-11
76/97, LINKS-D 1-2 62/85, 3-4 69/103). Taken: mean of the two at least 0.66
(PLACED), joins of 100 m or more (was 140), the taper at the fairway's ends
36 m (was ease x 0.6 = 102 m, which left 27 m of a 230 m stretch at full
width and pairs 5-16 m apart).

Seam bunkers (course.js `seamBunkers`, generator 51): on the Old Course
the shared fairways carry pot bunkers between the two holes' lines (the
Coffins on the 13th, the Principal's Nose on the 16th). Here: a join of 60
m or more gets one bunker, two from 90 m (`seam: 2`), radii 1.8-2.6 m
(3.6-5.2 m across; real pot bunkers are about 2-5 m), 38% of the way from
the lower-numbered hole's centre line to its partner's, in the middle half
of the join, at least 45 m apart, 6 m clear of a pond, 4 m of another
bunker, 20 m of a tee. PLACED: every number; the widths and the Old Course
names from the course's own guides, not measured.

Routing (routing.js `shifts`): a hole routed back beside another also
offered its tee a further distance past the level of the last green. Joined
holes over ten links courses (`overhaul`, LINKS-A..D, S1..S5): none 20; 30
and 60 m 31; 25 and 50 m 31; 40 m 32; 60 m **38** (every course 2-6). Taken:
60 m (PLACED).

### The tee's turf (the far-landscape goal, 26 October 2026)

ground.js `teeTurf`: the mean of the biome's fairway and fringe colours,
15% of the way to its own grey (luminance 0.299/0.587/0.114), on the pad
and its collar (was the semi-rough's colour). PLACED.
