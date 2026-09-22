# Research and implementation notes

Reviewed September 10, 2026. Research informs the model architecture. Coefficients below are explicitly approximations; no numerical claim of a commercial calibration or measured hardware agreement is made.

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

A putting surface here is four things a green architect actually builds, and nothing else: a TILT, which is mostly drainage and is ordinarily two or three per cent; crossing RIDGES, the spines and swales that break a green into sections; a DISH, which is a punchbowl if it gathers and a turtleback if it sheds, the latter being what the Pinehurst greens are known for; and a TIER, whose face is the steepest ground a green has. The ridges are rounded square waves rather than sines, because a green is shelves with faces between them and a ball has to be able to stop somewhere. A pure sine green is uniformly sloped everywhere and has nowhere to cut a hole.

The slider is deliberately not linear. Most greens sit in the gentle half of the range and the severe ones are outliers, so the curve keeps the bottom and middle where they already were and spends the change at the top. Measured across five seeds on a flat site, sampling the whole putting surface: at the default of 35 the mean slope is 1.2% with 1.3 ft of relief, unchanged from before; at 100 it is 5.3% mean, 10.2% at the 95th percentile, 18.5% at the steepest tier face, and 5.6 ft of relief. USGA guidance puts ordinary putting surfaces at 2 to 4 per cent, so the default sits under that and the top of the slider sits well past it, which is the intent: the top is meant to be Augusta and Oakmont rather than a municipal course. The one number that keeps it a golf green and not a hillside is that 14% of a severe surface is still under 2.5% — there is always somewhere to cut a hole.

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
- [USGA — The GS3 ball: understanding the numbers](https://www.usga.org/content/usga/home-page/course-care/green-section-record/62/issue-22/gs3--understanding-the-numbers.html) (Green Section Record vol. 62 no. 22, 5 December 2024): **the source of the four preset depths.** Gives the typical 0.300″–0.500″ range and the named bands inside it, the after-maintenance-before-play measurement protocol, and the note that the ranges apply to all grass types. The page returns **403 to automated fetch** — it was read because the user saved it from a browser, and the saved copy is committed at [`reference/usga-gs3-understanding-the-numbers.html`](reference/usga-gs3-understanding-the-numbers.html) with the firmness passage extracted to [`reference/usga-gs3-firmness-ranges.txt`](reference/usga-gs3-firmness-ranges.txt) so the citation stays checkable.
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

| tier | GPU ms | draws | triangles |
|---|---|---|---|
| low | 4.52 | 168 | 46.5 M |
| medium | 6.46 | 168 | 46.5 M |
| high | 12.66 | 289 | 92.9 M |
| ultra | 11.42 | 235 | 69.7 M |

**It is geometry, and it is almost entirely one biome.** Redwood draws 92.9 M triangles where every other biome draws 3.1 to 4.6 M -- twenty times the load, for 12.66 ms against about 4. The grown grove is the whole story, exactly as the LOD removal predicted it would be on hardware that could not absorb it.

**Shadow cascades double it.** Medium has none and draws 46.5 M; high has three and draws 92.9 M for the same scene. Each cascade re-renders the casters.

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

**It also came out faster than high, which was not the intention.** 11.42 ms against 12.66, on 69.7 M triangles against 92.9 M. Spreading three cascades over a longer distance moves the split planes apart, and fewer casters straddle two cascades and get drawn into both -- draws fell from 289 to 235. Better looking and cheaper, discovered rather than designed, and the only reason it is known is that the run was measured afterwards rather than assumed.

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

**The white surround.** `mapWater` is the colour *beyond* the generated land — sea on the island biome, a pale `#e0e5d5` on the other seven — and it is laid down as the base coat for the whole canvas. On the full-course map the terrain tile paints over all of it, so that pale default only ever showed outside the world rectangle and nobody looked twice. Hole view draws no such tile, so the base coat *was* the surround: a hole on paper, ringed in near-white. In hole view it is the biome's own rough now, with a `mapGround` override for a biome that ever wants something else.

**The green went soft at high resolution**, and that was two things stacking. The contour tile is baked at 96x96, which is generous at hole scale where the green is a smudge and about four screen pixels per texel once the map frames the green; it is 256 there, built once per green and cached. Underneath that, the canvas backing store was hardcoded at `clientWidth x 2` rather than the display's own ratio, so anything sharper than 2x was already being upscaled by the compositor before the tile was magnified on top of it. Device ratio now, capped at 3. `mapPixels` divides by whatever ratio it finds, so pointer input followed without a change.

## The green, as a state the whole HUD reads

Three things key off one question — is the ball on the putting surface — and `localSurface` answers it exactly: it returns `'green'` when `greenDistance <= 0` and not otherwise, so `surface === 'green'` already *is* the strict test. A second `greenDistance` check elsewhere in the file was testing the same thing twice.

**The putter** was chosen by `surface === 'green' || d < 18`. That second clause handed you a putter from eighteen yards out — in the fringe, off a bank, out of a greenside bunker, anywhere at all so long as it was close. Gone. Short shots off the green now auto-pick the shortest club at full power, which is what the game has always done between 18 and 65 yards; the behaviour is not new, it just reaches further down. **Still open**: power should scale to the distance rather than defaulting to 100%.

**The pin comes out**, which is what happens on a real green and takes the one object standing between ball and cup out of the read. The cup, its liner and the floor are separate objects and stay — it is the flagstick that goes, not the hole.

**The marker therefore names the hole**, and stops being a thing that floats over a flag and drifts off the edge. It clamps to the screen and turns to point at the cup.

That needed a marker projection of its own. `project` reports whether a point is within the depth range and says nothing about the sides — and behind the camera it is worse than useless, because the perspective divide is by a negative w, so both axes flip and the marker lands on the *opposite* side from the thing it marks. `projectMarker` reads front-or-behind from camera space, mirrors the flip back, clamps, and reports the screen bearing.

**It clamps to a measured rectangle, not an even inset.** An even margin assumes the four edges are equally free and they are not: the bottom of the screen is the shot controls and the right is the hole map. The panels are draggable and resizable, so the rectangle is measured rather than tabulated, twice a second rather than per frame — `getBoundingClientRect` forces layout, and a panel that was just dragged can wait half a second to be noticed. It never gives up more than a third of the screen to either side, because a marker squeezed into nothing is worse than one overlapping a panel. And it pushes out from the rectangle's *own* centre: through an off-centre rectangle, the screen centre lands short on one side and past the edge on the other.

## Debris that is carried rather than fired

The wind motes travelled in exact parallel lines at one speed, which reads as a texture being scrolled past the camera. Each one now has its own sway rate, bob rate and a little spread in how hard the wind pushes it.

The sway is a sideways **velocity** that swings through zero, not a position offset. Integrating a bounded oscillation gives a bounded weave across the airflow; adding an offset directly would let a mote settle permanently downwind of its own path. The perpendicular is taken from the wind vector itself, so the weave stays square to the airflow however hard it is blowing.

They have tails now as well. `gl_PointCoord` is screen space and axis-aligned, so a sprite cannot work out which way it is travelling — but the wind is one vector for the whole scene, so resolving it onto the camera's right and up axes once a frame gives every particle its screen direction from a single uniform. The shape is a semicircular head with a taper behind it, and it is deliberately **shape rather than an alpha gradient**: these sprites are a few pixels across, a gradient over that is invisible, and it would need a second injection point into three's fragment chain for nothing.

One known inconsistency: the tails point along the mean wind while each mote now wobbles slightly off it. Fixing that needs a per-particle direction attribute, and at this sprite size it has not been worth one.

## An aim line that belongs to the surface it is drawn on

A full shot's aim line is lifted 100 mm so it clears the ground it crosses: it describes a ball about to be in the air, and the ground in between is not the subject. `setAimPath` — the breaking-putt preview — inherited that number, and a putt is the opposite case. The line *is* the green. At 100 mm it floated two ball-heights up and appeared to leave from the top of the ball.

15 mm now, and the exact number is the point: the ball's centre sits one radius up at 21 mm, so 15 mm passes below its equator and the ball sits **on** the line rather than hanging off it. Flat on the surface would have looked painted on and left the ball floating above its own line. There is nothing to z-fight with either — the putting rings are already at 25 mm and the lie scatter at 35 mm.

## The flight model against a launch monitor

Thirty-six shots from a SkyTrak skills assessment (`reference/Export_SA_09182026_180829.pdf`, pages 7 to 11, with the ball data extracted to `reference/skytrak-36-shots.txt`) replayed through `simulateShot`, fed through the same conversion `parseLaunchMessage` uses for a live monitor: ball speed in mph, total spin as `hypot(back, side)`, spin axis as `atan2(side, back)`. The model was told nothing about which club was swung.

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

The library is a devDependency. `node tools/bake-trees.mjs` runs it in Node, writes four variants as OBJ into `vendor/eztree-redwood/`, and from there they go through exactly the same ingest as a Kenney pine. **No library code and no runtime cost** — what ships is geometry.

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

The fix that works is to stop changing the count: the lamps are created **visible at zero intensity** and only their intensity is switched. The light count is then constant, everything compiles once while the course is being generated, and the toggle is **18.7 ms in the studio with zero programs compiled**. This is the same reasoning the ball's point light already carried.

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

[GSPro Open Connect v1 documentation](https://gsprogolf.com/GSProConnectV1.html) still documents version 1 and TCP port 921 at the research date. It describes DeviceID, ShotNumber, APIversion, BallData (Speed, HLA, VLA, TotalSpin/SpinAxis or BackSpin/SideSpin), ShotDataOptions, success code 200, and player/club code 201. The interface is openly documented; this does not mean the commercial simulator itself is open source. Fairway uses the documented message shape with its own server and does not redistribute GSPro.

The bridge defaults to unprivileged TCP port 1921; set FAIRWAY_TCP_PORT=921 only on a host configured to allow the standard privileged port. The bridge accepts fragmented and concatenated JSON objects, caps message sizes, validates ball data, relays one pending shot at a time, and waits for browser acceptance before acknowledging. The browser detects duplicate shot IDs. Reconnect starts a fresh duplicate window; don't resend historical shots after reconnect. Unexpected readiness/heartbeat frames with ContainsBallData=false or IsHeartBeat=true are acknowledged without creating shots. The optional 202 ready code is a community extension, not part of the original two-code specification.

Input convention: Units=Yards means Speed in mph; Units=Meters means Speed in km/h. Angles are degrees and spin RPM. The original public protocol's unit description is sparse. This convention is exposed explicitly because connector implementations can differ: verify metric behavior with a known-speed sample for each device. Unsupported units and missing/non-finite/out-of-range required ball values are rejected; there is no silent unit guessing.

Open-source connector projects inspected for integration paths:

| Path | Source | What is actually supported here |
|---|---|---|
| PiTrac | [PiTracLM/PiTrac](https://github.com/PiTracLM/PiTrac), [simulator integration docs](https://docs.pitrac.org/software/simulator-integration/) | Its Open Connect output can target the Fairway TCP listener; separate device/host configuration is needed. |
| Garmin R10 | [travislang/gspro-garmin-connect-v2](https://github.com/travislang/gspro-garmin-connect-v2) | Accept the community connector's normalized shot messages, not direct R10 Bluetooth. |
| Rapsodo MLM2PRO | [springbok/MLM2PRO-GSPro-Connector](https://github.com/springbok/MLM2PRO-GSPro-Connector) | Accept its Open Connect output; no bundled device driver. |
| OpenSkyPlus | [OpenSkyPlus/OpenSkyPlus](https://github.com/OpenSkyPlus/OpenSkyPlus) | Can receive an existing plugin's Open Connect output. OSP itself explicitly supports a limited set of monitors/apps; it is not universal hardware access. |

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

**The coloured targets are aiming marks, not putting surfaces.** Both the shader and `localSurface` know exactly one green per hole. A ball landing on the 150 target bounces as range turf. Making them all real greens needs a GLSL loop over an extended cup atlas; the movable real green is what covers actual green behaviour.

Six of them, at 50 to 300 yd in 50 yd steps, alternating sides. Three decisions in there are not taste:

- **Their offset from the centre line is derived, not chosen.** The real green runs the whole centre line to 300 yd and its half-width is `greenSize * greenAspect` plus its wave coefficients, so `TARGET_OFFSET = greenReach + radius + 3 m`. Pick the offset by eye and the clearance holds at 150 yd and fails at 300 — a bug nobody finds until they drag the slider to the end. A test walks the rim of every target at every green position from 30 to 300 yd and requires all of it to be off the green.
- **The colour ramp avoids cyan and azure**, because that band is what water and the slope-reading overlay occupy. The test checks this by **hue**, not by "is the blue channel largest": the first version rejected any blue-dominant colour and failed on the 250 yd purple, which is blue *and* red. Blue-violet is fine; teal is not.
- **The ramp is saturated past anything agronomic, on purpose.** It opened on a soft yellow and amber, and at midday on green turf those read as **sand** — the near targets looked like enormous waste bunkers rather than markings. Each disc also carries a hard white rim, which is what makes it read as paint somebody applied rather than a scorch mark, and which survives haze better than the fill does.

**The distance signs grow with distance.** A board legible at 50 yd is unreadable at 300, and every one of them is read from the same place — the mats — so holding the *angular* size roughly even is honest rather than a perspective trick. Real ranges make their far boards bigger for the same reason. Height runs `clamp(2.2 + yards * 0.014, 3, 7)` m. Each sign stands directly **behind** its target rather than beside it: beside would put the outer signs off the mown field, and behind keeps every one of them on the sight line a player actually uses.

## Field of view is a measurement in a bay, not a setting

On a laptop the field of view is a look: pick what frames the hole nicely. In a simulator bay it is geometry. The screen is a window, the golfer stands a measured distance from it, and there is exactly one vertical angle that makes what is drawn on the fabric line up with what would be there if the wall were not:

    vertical FOV = 2 * atan((screen height / 2) / distance to the screen)

Three.js takes the vertical angle and derives the horizontal one from the canvas aspect, so this is the whole of it provided the projector fills the screen and the canvas fills the projector — neither of which the code can check, so the panel states it.

Screens are sold by the diagonal, so the height comes from Pythagoras: `h = d / sqrt(1 + r²)` with `r` the width-over-height ratio. A 100 inch 16:9 screen is 49.03 inches tall; a 100 inch 4:3 screen is 60. Standing exactly as far back as the screen is tall gives `2 · atan(0.5)` = **53.13°**, which is a useful sanity check because it is close to the 53° the app has always shipped as its default — the old default was a laptop-sized guess that happens to describe someone standing about one screen-height away.

The default bay in the panel is a 138 inch 16:9 screen from 8 feet, which works out at **38.8°**. Nothing is sourced here; it is a starting point to correct, and the panel prints both the angle a bay gives and, for a hand-set angle, how far back you would have to stand to justify it — the two are exact inverses and a test asserts the round trip.

### The bay view cannot show the ball, and on the green that matters

A correct bay camera puts the eye at eye height with the ball about a metre in front. The ball is then `atan(1.75 / 0.9)` = **62.8°** below the horizontal, while a 100 inch screen at 6 feet gives a 37.6° frame — 18.8° from the axis to the top or bottom edge. The ball is nowhere near the picture, and that is correct: it is below your eyeline in the room too, and what is on the screen is where the ball is going.

It stops being correct on the green. A putt is aimed from the ball, so the ball has to be visible. There is no angle that fixes this — at eye height, a ball at your feet and a cup six metres away are 48° apart and the whole frame is 37.6° — so the camera has to move. Backing off along the same line, keeping the same eye height and the same angle:

    distance = height / tan(halfFOV · 0.85)

The 0.85 is how much of the half-angle the ball is allowed to use, leaving margin for the view axis's own slight downward tilt. For the bay above that is **6.11 m** behind the ball, which puts the ball 16.0° below the horizon inside an 18.8° half-frame, and a six metre putt's cup 6.6° below the axis — both comfortably in.

It is deliberately a no-op for the broadcast rig. Nine metres up and twenty-three back already has the ball at `atan(9/23)` = 21.4°, which is 81% of that rig's 26.5° half-angle: inside the frame, so the camera is not moved at all. One rule — "make sure the ball is in frame" — that changes nothing where nothing needs changing.

The result is clamped to 10–140°. A bay entered wrong — a zero distance, a screen size in metres against a distance in feet — would otherwise ask for a degenerate projection, and a camera that renders nothing is a worse answer than one that is merely not to scale.

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

The model against both: **14 mm** at the top against the 50.8 mm limit, and **18 mm** where it meets the green against the 19 mm limit — one millimetre of margin, so the base cannot be thickened without rechecking it. The pole tapers 0.29 mm across the 152 mm band the rule calls *constant*; that is left alone deliberately, being three tenths of a millimetre on a prop nobody measures.

**Height is seven feet by convention, and now exactly seven feet.** It was 2.13 m — a tidy metric rounding of 7 ft that lands 3.6 mm short of it at 6.988 ft. Nothing was broken by that, but the cup beside it is specified to six significant figures (`CUP_RADIUS = 0.053975`, exactly 4.25 in), and one loose number in an otherwise exact set is the kind of thing that gets copied. It is now `7 * 0.3048`.

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

### With realistic spin, chips still roll too little

At 40-65 rpm per mph, rising with loft:

| club | inputs | carry | roll | ratio | want |
|---|---|---|---|---|---|
| pitching wedge | 25, 21, 0, 1000, 0 | 27.9 | 51.7 | 1:1.9 | **1:3** |
| 52 degree | 23, 28, 0, 1100, 0 | 28.8 | 40.0 | 1:1.4 | **1:2** |
| **56 degree** | 22, 36, 0, 1150, 0 | 29.7 | 28.1 | **1:0.9** | **1:1** |
| 60 degree | 20, 45, 0, 1300, 0 | 25.5 | 12.2 | 1:0.5 | **1:1** |

The **56 degree is right**. The others are short, and the ordering is correct throughout — a pitching wedge runs, a lob wedge stops.

**Solving for the ratio drives the spin off a cliff.** To reach 1:3 a pitching wedge needs the spin floor — 100 rpm, four rpm per mph — and still only gets to 1:2.1. A 60 degree needs 150 rpm to reach 1:1. Those are not chips. So this is a genuine defect: **the bounce over-checks at chipping speeds**, and no realistic input set fixes it.

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

**Left alone deliberately.** The remaining 0.3 s against tour average would have to come out of lift, and lift is fitted to carry (3.2%), apex (3.7%) and descent angle (1.8%). The driver's real gap is carry — 261 against a sourced 275 — and chasing that risks the descent angle the whole bounce model depends on.

