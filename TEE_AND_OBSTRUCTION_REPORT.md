# Blocked tees, the giant bush, and what the tee boxes were actually doing

Overnight, 25 September 2026. Four reports from play, measured before anything
was changed. **One of the four had a different cause than any of us assumed,
and that is the most useful thing in this document.**

Pictures are in `bench/shots/`, `before/` against `after/`, same seed, same
hole, same camera, same clock (10:30, fog on). `before/` is `main` as you were
playing it; `after/` is the two branches below.

---

## 1. Rocks were standing in tee shots. Fixed, and it was a real hole in a rule.

**Look at `before/tee-desert.jpg` and `after/tee-desert.jpg`.** In the before
shot there is a boulder sitting in the fairway directly on the line of play,
with a second one hard right. In the after shot the line is clear.

Trees have always been refused where they would stand in a tee shot. Rocks were
tested by the same function — and given none of the things that make the test
mean anything:

- a rock was tested as a **point with no width**, while a trunk has always
  passed its girth. A stone is up to 1.65 times its own scale across.
- its ceiling was `y + scale`, which **is not its height**. A stone is drawn up
  to 0.9 scale above its centre and sunk a quarter of it, so the crown is at
  `y + 1.15 scale`.
- it never consulted the **tee fan** at all — the combined cone from all three
  tees that stops something standing in the view from the back box.

Measured across four courses:

| | rocks in a tee shot | rocks in the view from the tees |
|---|---|---|
| before | 4 | 41 |
| after | **0** | **0** |

Mountain and desert carry 500 and 550 stones against 160 everywhere else, at
twice the scale. That is exactly where you saw it.

Trees turned out to have a smaller version of the same gap: they padded the
corridor test by their girth and the fan test by nothing, so a trunk up to
3.6 m across could stand half inside the view from the back tees. **154 of them
across 35 planted courses.** Closing it costs 31 trees out of 45,909, and the
planting around tees holds at 0.45–0.89 of course average density — no sign of
the clear-cut we spent a session fixing.

There is a new measurement behind this, `node tools/bench.mjs teeclear`, which
calls the generator's *own* placement rules against the *finished* world. That
is the only kind of check that catches a rule applied unevenly: during placement
the generator's own answer was "nothing is in the way".

---

## 2. The giant bush was gorse, grown to the height of a house

It only ever happened on **links**, and here is why. The fairway-feature picker
asks for the biome's first species that is not ground cover, and falls back to
the first species of all if there isn't one. Links grows gorse, heather and
shrub — **all three are ground cover** — so the fallback fired, chose gorse, and
then sized it by the biome canopy: **13 to 29 metres**.

Every other biome leads its list with a real tree, which is why it survived
unnoticed since the feature shipped.

A biome with no tree species now gets a cluster of stones instead. Only a tree,
a desert cactus or rocks may stand in a fairway. Measured on a links course with
the setting at 100%: 19 feature rocks, 0 feature trees. On midwest: 5 oaks, 0
rocks, unchanged.

This is scoped exactly to the *Feature tree or rocks in a fairway* setting, as
you asked. **Nothing in the rough or the surrounds was touched.**

---

## 3. The tee boxes. The change you asked for is in — and it is not what was
## making shots blind.

You asked me to measure first, so here is what the measurement said, because it
contradicts the assumption we were both working from.

**Every single blind tee shot is caused by ground 96 to 190 metres out.** Not
one is caused by the ground in front of the tee.

| where the blocking ground is | shots |
|---|---|
| within 30 m of the tee | 0 |
| 30–80 m | 0 |
| beyond 80 m | 25 |

Across 945 tee shots, 25 have more than a metre of ground in the way; the median
distance to the thing blocking them is 167 m. That is a **blind landing area** —
a rise out where the ball comes down — not a tee-box artefact.

Worse, the generator could not have told us: its own sightline check **starts 12
metres out**, so nothing in the code has ever looked at the ground immediately in
front of a tee. I had to measure that separately, from 2 m, to be able to say
anything about it at all. When I did: ground within 40 m of a tee stood above the
sight line on **8 of 945 shots**, and above half a metre on 3.

So the honest summary is: **the ground in front of tee boxes was very rarely the
problem, and it is now rarer still.** The blind shots you are seeing are the
landscape at the landing area.

### What changed anyway, because you asked for it and it is better

| change | before | after |
|---|---|---|
| tee pad length | 9.0 m | **7.2 m** |
| shoulder reach directly ahead | same as everywhere | **35% shorter, so steeper** |
| tee pairs sitting in line | 110 of 945 | **10 of 945** |
| closest two pads sideways | 0.0 m | **3.2 m** |
| ground within 40 m above the sight line | 8 shots | **2 shots** |
| blind shots over 1 m | 25 | 23 |

**The stagger is the one that earned its place.** A tee directly in front of
another is a tee you look over, and it was happening on 12% of pairs. The siting
now compares against *every* tee already placed rather than only the one in
front — blue could sit in line with red while white was in line with neither.
It costs almost nothing: the distance a tee moves from where the hole put it went
from a median of 22.1 m to 20.8 m, and no tee needed raising that did not need
raising before.

**I swept the front drop-off rather than picking a number.** At 50% the ground
around a pad got noticeably steeper (median slope 6.3° → 10.1°, p95 → 21.5°) for
no further gain. At 35% it gets the same result — the same 2 shots — at median
7.8°. That is the smallest change that clears it, which is what you asked for.

**Blind shots barely moved, as the measurement predicted: 25 → 23.** Fixing
those means either lifting tees or flattening the landscape at the landing area,
and you specifically said not to build up land. If you want them gone, say so
and I will trade it against something — but it would be a real trade, not a
free fix.

---

## 4. The sign and the markers

**The markers were a metre off the tee.** They stood 4 m either side of a pad
whose half-width is 3 m, so *both* markers of *every* tee on the course were
sitting in the collar rather than on the mown box. They are now 6 inches in
from each edge. Visible in `after/tee-desert.jpg` as the two blue dots neatly
inside the pad; compare `before/tee-desert.jpg`, where they sit out at the
corners.

**The sign now stands beside the blue tee, on your right.** It used to sit at a
fixed spot nine metres off the hole's own origin — which meant nothing once tees
started being sited on ground that suits them, a median 14 m off the centre line
and anywhere from 18 m behind that origin to 60 m past it. It could end up in a
wood with no tee in sight, which is why it is not in any of the before shots and
is in all four after shots.

Which side is "right" took a moment to establish and is worth writing down: in
the hole's own coordinates, **local +x is the player's LEFT**. Note the code
*also* calls +1 "right" in `fairwayWidth` — that is a naming convention for
which edge is which and it does not agree with the player's view. I checked the
geometry across nine holes at nine different rotations before placing the sign.

---

## How the pictures were made

`node tools/shot-sink.mjs --out bench/shots/after` starts a small receiver; the
game then photographs its own canvas and posts the frame to it. No headless
browser, no 300 MB dependency, and the picture is the renderer you actually
play on rather than a software rasteriser.

The tool bit me once within an hour of writing it and now carries the fix: a
branch checkout removed its output directory under a running sink, the write
threw, the handler sent no response at all, and the page hung forever waiting
inside a `requestAnimationFrame` callback with no error anywhere. It always
answers now, even to say no.

---

## What I did not do

- **Blind tee shots are still 23 of 945.** The cause is the landscape at the
  landing area and every lever I have for it either lifts tees or flattens
  ground. Your call.
- **The tee-complex overview shot** I wanted, showing three staggered pads from
  above, is not here: the overview camera frames the whole course from very high
  with clouds in the way. The stagger is in the numbers instead.
- Generator version is now **32**, and the biome fingerprints were re-saved at
  it. Any round saved before tonight will rebuild slightly different ground —
  expected, and the version notice tells the player.
