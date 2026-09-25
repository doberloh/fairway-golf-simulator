# Networked multiplayer: what it would take

A feasibility study, 25 September 2026. Written to decide *whether* and *which*,
not to specify an implementation.

---

## The short answer

**Golf is close to the easiest thing there is to put on a network, and this
codebase has already built most of the hard parts for other reasons.**

One player acts at a time. Actions are rare — a few a minute — and discrete. There
is nothing to interpolate, no contention over a shared object, no lag to
compensate for, no tick rate, and nothing a player does that another player can
invalidate. None of the machinery that makes a shooter hard applies.

What we have that does the work:

- **A course is already a 622-character code**, and two machines with the same
  code grow byte-identical ground. That is not an aspiration; `tools/biome-fingerprint.mjs`
  hashes generated output and fails the build if a single byte moves, and it ran
  twice tonight.
- **A whole round's state is 603 bytes of JSON**, and it already serialises and
  restores — that is how saved rounds and round files work today.
- **A shot is 197 bytes**: five launch numbers, a start point, an aim and a
  finish. (The full trajectory is 78.8 KB, and is the one thing you never need
  to send, because every machine can rebuild it.)
- **A WebSocket client already exists** in `main.js`, with framing, request ids,
  acknowledgements, duplicate suppression and reconnect handling — written for
  the launch-monitor bridge.
- **A WebSocket server already exists** in `bridge/server.mjs`, with an origin
  allow-list covering loopback and the three private address ranges.
- **The game already models several players**, teams, turn order, scramble
  selection and per-player scorecards.

So the question is not "can this be networked". It is **how far from the
offline single file we are willing to move**, and that is a product decision
rather than a technical one.

---

## Four shapes, in cost order

### A. Pass-and-play — shipped

Several golfers, one machine, taking turns. Already works, already has teams and
formats. Worth saying out loud because for a simulator bay it is often the
right answer and it costs nothing.

### B. Async play — "send me the course, I'll send you my card"

Two people play the same course on their own machines at their own times, and
the cards merge. No server, no connection, no simultaneity.

Almost all of this exists: course codes, round files, import and export. What is
missing is a way to merge two cards into one match result, and a way to show the
other player's shots on your course when you look at the hole afterwards.

**Cost: small.** Days, not weeks. No new dependency, no hosting, no change to
the offline build. **This is the cheapest thing that feels like multiplayer.**

### C. Live play on a network — one host, others join

One machine hosts a match. Others connect to it and take turns in real time,
watching each other's shots fly.

This is the shape that fits the product: a bay with a monitor is a hosting
machine; a family in one house is a LAN; a society day is a room code.

**Cost: moderate.** A protocol, a lobby, turn arbitration and reconnection. Most
of the transport already exists.

### D. Play over the internet with strangers

Everything in C, plus a hosted relay (two home machines cannot reach each other
directly), a room directory, and the ongoing obligations that come with running
a service: uptime, abuse, moderation, privacy, cost.

**Cost: significant, and it never stops.** The engineering is a fortnight on top
of C; the operating burden is permanent.

### E. A shared world you walk around in

Seeing another golfer's avatar walk the fairway in real time.

**Cost: high. Value: low.** It is the only shape that needs continuous state
sync, and golf gives it almost nothing — you are standing still most of the time
and the interesting object is the ball, which C already shows.

**I would not build E.**

---

## What C actually requires

### Who is in charge

**Host-authoritative.** One machine owns the match: whose turn it is, where every
ball lies, what the score is. Everyone else displays it.

The alternative — every client simulating and trusting each other — sounds
cheaper and is a trap, because two machines that disagree about where a ball
stopped have no way to settle it.

The codebase already made this decision for a different reason and wrote down
why. From `replayShot`:

> Re-simulating from the five launch numbers would be exact — the model has no
> randomness and wind is a pure function of settings, both measured — but it
> reads the world as it is NOW.

That is the same argument. The trajectory that happened is the thing to keep.

### What goes over the wire

| | size | how often |
|---|---|---|
| course code, players, format, tees | ~1 KB | once per match |
| turn change | tens of bytes | per shot |
| a shot | 197 bytes | per shot |
| hole result | ~100 bytes | per hole |
| full state resync | 603 bytes | on reconnect |

**A four-ball over eighteen holes is on the order of 100 KB.** Bandwidth is a
non-issue at any scale this will ever see.

Each client replays the shot from its five launch numbers — it already has the
code to do that, and the ball flies on their machine at their frame rate — then
**snaps to the authoritative finish** the host sends. See the risk section for
why the snap matters and why it is almost always invisible.

### The settings that have to be the room's, not yours

Turf firmness, green speed, wind, pin day, and hole count all change how the
ball behaves. In a match they belong to the host and have to be pushed to
everyone. Graphics, camera, units, bay geometry and shot-data layout are local
and must stay local — they are the player's own screen.

This split is already half-built: the settings schema separates generation
settings from play-scope settings, and `playScope()` exists.

### The awkward corners

None of these are hard; all of them are work, and they are where the time goes.

- **Mulligans** rewind the round through a 30-deep history. Rewinding a shared
  match needs a rule about who may do it and what everyone else sees.
- **Scramble** has a selection step where the team picks a ball. That is a vote
  or a captain, and it is a small UI of its own.
- **Someone's wifi drops mid-swing.** Needs a hold, a rejoin and a resync — and
  a decision about whether the match waits or plays on.
- **A launch monitor sends a shot while it is not your turn.** The bridge already
  refuses out-of-turn shots with a reason; that logic extends naturally.
- **Version skew.** See below; this is the one that can silently corrupt a match.

---

## The two risks that actually matter

### 1. Version skew is the real hazard, and it is already half-handled

`GENERATOR_VERSION` is at **32** and it moved **twice tonight**. Two machines on
different builds grow *different ground from the same seed* — different terrain
under balls that are supposed to be on the same hole.

This must be refused at the door: a client whose generator version differs from
the host's cannot join. The machinery exists (`showVersionNotice`, the stale
generator flag) and just needs to be wired to the handshake rather than to a
saved round.

**Note this makes shipping harder in a way that is easy to underestimate.** Once
people play together, every generator bump becomes a coordinated update. Today a
bump costs a saved round; then it costs a match.

### 2. Cross-machine float drift — smaller than I expected, and I measured it

Different browsers may compute `Math.sin` differently in the last bit, which in a
chaotic simulation would diverge into completely different shots.

**This model is not chaotic.** Measured, perturbing the launch speed and reading
how far the ball finishes from where it otherwise would:

| relative error in | endpoint moves |
|---|---|
| 1e-15 | below measurement |
| 1e-12 | below measurement |
| 1e-9 | below measurement |
| 1e-6 | 0.12 mm |
| 1e-3 | 304 mm |

Error grows roughly *linearly*, with an amplification of about one. A last-bit
disagreement between two engines is around 1e-16 relative, so it would move a
ball by something like a hundredth of a micron, against a cup 108 mm across.

So re-simulating on each client is safe **for the flight**. The residual risk is
not arithmetic but **branching**: whether a ball catches a bunker lip, clips a
rock, or drops rather than lips out are decisions with a threshold, and two
machines that agree to fourteen decimal places can still fall on opposite sides
of one. Rare, and the consequence is a match that disagrees with itself.

**Which is exactly why the host's finish is authoritative and clients snap to
it.** The snap is sub-millimetre in the overwhelming majority of shots and
invisible; on the rare branching shot it is the difference between a shared
game and a broken one.

---

## Security, briefly

The bridge today has **no authentication** — anything on your LAN that can reach
the port can drive the simulator. That is a deliberate, documented trade for a
tool you run on your own network for your own launch monitor.

It is not an acceptable trade for a match with other people in it. C needs, at
minimum, a room code that is not guessable, and a host that validates every
message rather than trusting it. D needs real thought about identity, reporting
and what we store.

**Nothing in C or D should ever be reachable from a `file://` page without the
user opting in**, or we have quietly turned an offline toy into a networked
service on somebody's machine.

---

## What this costs the thing we already have

The portable offline single file is, per the project's own rules, a thing to
preserve. Multiplayer must be **an addition that is absent unless asked for**:

- the offline build keeps working with no server, no connection and no account
- multiplayer code that does not run adds bytes to a 15.8 MB single file — it
  should be small, and it should be measured
- if D ever happens, a hosted service is a second product with its own
  lifecycle, and that should be a conscious decision rather than a drift

---

## What I would do

1. **B first.** Async play is days of work, needs no server, and answers "can I
   play this with my friend" for most people who ask. It also forces the card-
   merging model that C needs anyway.
2. **Then C, on a LAN.** Reuse the bridge. Host-authoritative. Version-locked
   handshake. Start with stroke play and two to four players; add scramble once
   the plain case is solid.
3. **Decide D separately, later, with the operating cost in front of you.**
   It is not a bigger version of C; it is a service.
4. **Not E.**

The thing I would want settled before writing any code is the product question,
not a technical one: **is this for two people in different houses, or for a bay
with several people standing in it?** They want different things, and the second
one is nearly free.

---

## What I measured for this, and how

All on the current build, `node` against `src` directly:

- trajectory: 570 points, 78.8 KB as JSON; the same shot as launch numbers plus
  a finish point is 197 bytes
- a two-player nine-hole round, fresh: 603 bytes of JSON
- a course share code: 622 characters
- float sensitivity: as the table above, by perturbing launch speed and reading
  the finish

Figures for a four-ball over eighteen holes are scaled from the per-shot and
per-hole sizes, not measured directly, and assume roughly 300 shots.
