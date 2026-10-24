# Why the rules in AGENTS.md exist

AGENTS.md is loaded with every message of every session, so it keeps each rule
and one line of why, and nothing more. This file keeps the rest: the incidents
behind the rules, with their dates and costs, in the order AGENTS.md has them.
It is reference, not a checklist -- the rules themselves are only in
AGENTS.md. Moved here from AGENTS.md on 7 October 2026, at the owner's request,
when AGENTS.md was about 33 KB (roughly 8 thousand tokens on every message).

When a rule changes because of a new incident, the rule goes in AGENTS.md and
the story goes here.

## Reading the documents

The rule to read ARCHITECTURE.md first and never read PROJECT_HANDOFF.md,
TODO.md or RESEARCH.md whole dates from 7 October 2026. The old rule said "read
PROJECT_HANDOFF first" and "check every document every pass"; measured that
day, PROJECT_HANDOFF was about 83 thousand tokens, TODO about 93 thousand and
RESEARCH about 141 thousand, so a session following the rules literally spent
most of its budget before any work began.

## One branch per journey

A journey can run across many requests and topics: the `productization` pass
went from a website to a generator bug to rewriting the repository's history,
all on one branch.

The rule replaced "one branch per coherent piece of work" on 2 October 2026, at
the owner's request. That rule produced 69 branches in a few weeks, many of
them a single commit and some branched off other branches, which was more to
keep track of than the work itself.

**Why the agent never merges.** The desktop app's Changes pane shows all changes
on the current branch, so an unmerged branch presents the whole journey in one
readable place; a merged branch has nothing left to compare against. Four
separate pieces of work in this project were branched, finished, and merged the
moment the tests went green, and the owner could not see any of them in the
pane that exists for exactly that purpose.

## Pushing and releasing

**Force-pushes.** The first replaced the history after the owner asked for it to
be rewritten (2 October 2026; DISTRIBUTION_REVIEW, *What went to GitHub*). The
second rewrite, taking the website out of the history on 7 October, needed no
force-push: the rewritten history went into a fresh repository,
`doberloh/fairway-golf-simulator`, and the original became the private
`doberloh/fairway-backup` (DISTRIBUTION_REVIEW, *The website leaves this
repository*). Because no new repository took the old name, GitHub forwards
`doberloh/fairway` to that backup -- which is why nothing may name it.

**Protections.** `tools/github-protect.mjs` ran the minute the repository went
public, 7 October 2026, and reported every setting done. Before that, while the
repository was private (3 October), merge commits only, GitHub's own actions
only, a read-only workflow token and Dependabot alerts were already on.

**Release notes in the same commit as the release.** v0.3's notes were recorded
afterwards, on a branch of their own, which left `main` and the release out of
step until someone remembered. The owner asked on 7 October 2026 for the notes
to go up WITH the release, from the commit the tag points at. On the same day,
for v0.4, a combined push-and-release command printed "failed to push some
refs" and went on to publish anyway; the push had in fact landed, but a release
published against a commit not on GitHub would hand every Download button the
wrong thing -- hence pushing `main` alone and checking it landed first.

## What stays local

The repository was audited for passwords, tokens, keys, machine paths, account
names and network details on 2 October 2026, and its history rewritten to
remove the network details that had crept in; DISTRIBUTION_REVIEW has the
audit.

**Staging by name.** The owner unzips release archives into the working folder
to test them, and a blanket `git add -A` once swept a 16 MB unzipped copy of the
game into a commit (27 September 2026).

**Reports.** On 3 October 2026 the owner had `docs/reports/`, `docs/studies/`
and `docs/sources/` removed from the repository and from its history: they
carry large media, copies of other people's pages, and working not meant to go
public with the code.

## The two version numbers

**Unrecorded bumps.** The list of `GENERATOR_VERSION` entries runs 2 to 12 and
then 23 onward: ten bumps between them went unrecorded and cannot be recovered,
because the old repository's history began at one squashed commit. Two later
entries were mislabelled -- 31 and 32 both written as one less than the version
they produced -- caught only by checking each number against the commit that
moved the constant. Hence: the number in an entry is the version it produced,
and `git log -S"GENERATOR_VERSION=<n>"` settles doubt.

**Two hashes, not one.** The fingerprint tool once reported a single hash per
biome, and it told a session to bump the generator version after three biome
TITLES were renamed. It now reports the biome's record (name, palette, light;
owes nothing) and the ground (owes a bump) separately: an arbiter that cries
wolf gets ignored the one time it matters.

## Documentation

**Written too early.** BALL_BEHAVIOUR_KNOBS.md sat asserting the opposite of the
code on how firmness affects a green, because the file was written before the
fits that reversed it. A physics session is a chain of fits where later ones
overturn earlier ones, which is why documentation is written at each step, not
batched at the end.

**TODO.md was split** into open work and `# Done` because ten open items had
accumulated nested as notes under finished ones, invisible. One open entry
once asserted the exact opposite of what the physics did, which is how a
correct behaviour nearly got "fixed" back into a bug.

**IDEAS.md was split off TODO.md** on 16 October 2026, at the owner's request.
A month after the first split the open list had grown to about 120 entries,
and pruning it found that roughly a fifth were finished, untrue or duplicated,
and a further thirty (sixteen biomes, thirteen features and looks) were ideas
nobody had decided to build, sitting beside real defects and read as work on
every pass. The owner asked for ideas to live apart and to be read only when
looking for something new, to save tokens.

**Why every document, every pass.** The player-facing manual and
PROJECT_HANDOFF.md went fourteen commits without an update while RESEARCH.md,
PROCEDURAL_GENERATION.md and TODO.md were updated in every single one. "Update
the docs" was read as "write up what was measured", RESEARCH.md is the natural
home for that, so it always got written and always felt like compliance. The
two that rotted describe what a PLAYER sees and what the ARCHITECTURE
guarantees -- the two a newcomer reads first, and the two least connected to
whatever was just measured. Naming the documents judged unchanged, in the
reply, is what makes the audit real: an unmentioned file is indistinguishable
from a forgotten one, by the reader and in practice by the writer.

**Rejected alternatives are the valuable part.** Sentences like "the ladder of
relaxations reads tidier and falls off a cliff" and "reaching for the rim
circle below lip height parks the ball inside the wall" are worth more than a
description of the code. For a subtle bug, the recognisable symptom saves the
next hour, not the fix.

**Staleness check.** Before committing, this lists when each document last
changed; a file many commits behind the others is the gap:

```bash
for f in README.md CONTRIBUTING.md docs/*.md; do
  printf "%-36s %s\n" "$f" "$(git log -1 --format='%ad %h' --date=short -- "$f")"
done
```

## External research

Several of the pages the physics is anchored to return 403 to any automated
request -- the USGA's are the worst offenders -- which is why an unfetchable
source is saved under `docs/sources/` and its passage quoted into RESEARCH.md.

**Placed definitions, not only numbers** (14 October 2026). The Swing Meter
journey's later phases had to decide what the spec never defined -- a "par
save", an up-and-down from sand, a long drive "in play", how up-and-down drops
are placed, how a nine-hole round is held to a handicap index. Each became a
rule players would meet. They were recorded as PLACED in RESEARCH and listed in
the spec's departures so the owner could overrule them; the rule makes that the
habit rather than the exception.

**Flagging placed numbers works.** A note reading "these depths were chosen by
judgement inside the instrument's range, and if someone can read that page they
are the first thing to check" is what made the firmness presets get fixed: it
was still sitting there when the article finally arrived, naming exactly what
to do. Anchoring can cost range -- the judged Burnt preset was more dramatic
than the published one and had nothing behind it.

## Processes

`npx vite preview` leaves its server running when the `npx` that launched it is
killed, and the next attempt silently attaches to the stale one and loads
nothing -- which is why a stopped server's port is checked, not assumed free.

## The graphics card

**Twice the owner's PC crashed while they were gaming and a test drew the game
on the same card.** On 5 October a floodlit Ultra smoke run preceded a hard
crash. On 14 October, during the Swing Meter journey, a run of smoke journeys,
Playwright picture captures and a session of the game left open in the browser
pane took the machine down again -- with `nvidia-smi` showing the card 20 to 60
per cent busy the whole time, which was the owner playing. The rules then said
to run the smoke test after any interface change and that skipping verification
to avoid starting a process was the wrong trade; both pushed toward starting the
runs. The owner: "whatever you keep doing is crashing my computer while im
gaming. Please dont do that anymore." The rest of that journey (three phases)
was built, unit-tested and documented with the card untouched, and its in-game
checks were listed for the owner to run at the end.

Two more crashes followed, and neither was a game. On 13 October a smoke run on
the software rasteriser (`--software`, chosen because the card showed 95% busy)
took the machine down in its second journey: the CPU path is not a safe
alternative, since it pegs the machine for minutes. On 18 October the owner gave
full GPU permission overnight and went to bed; the PC crashed idle after a
session of long Playwright sweeps (11 menu screens at every step and two sizes,
several minutes each) with a game tab also left in the browser pane. The owner:
"you need to be careful with how much you are doing at once." Permission is not
safety; every GPU run since has been kept short, single and spaced. (On 16
October a freeze came ten minutes after a session left the game open in a hidden
browser-pane tab, which stays loaded for 30 minutes; the app's own graphics
process had already died nine times since August, so the driver may be unstable
on its own -- but the tab should not have been there.)

**The "GPU allowed" `/goal` exception, 22 October 2026.** Asked how `/goal` could
drive a frame-rate push, the owner asked whether the GPU could be used under a
goal without asking each time. Asking per turn cannot work there: a goal carries
on through turns the owner did not start, so a goal that measures frame time
would stall at every measurement. The exception is opt-in per goal (the words
"GPU allowed" in its text) and built from the incidents above: profile groups
only (about a minute, the pattern that has never crashed) and never the
software `weak` group (13 October); an `nvidia-smi` check before every run with
limits of 10% use and 60 °C, against about 5% and 44 °C idle that day, because a
busy card was the sign of the owner playing on 14 October; runs 5 minutes apart
and six per goal, because the 18 October crash came from volume, not from any
single run; stop on any trouble; close every browser and pane tab after each run
(16 October). Smoke runs, captures and the pane game stay asked-for: they are
longer and play the whole game. The limits are placed, not measured -- nobody
knows the crashes' cause -- so they reduce the risk without removing it, and the
owner can tighten or loosen them.

**The Blender exception, 23 October 2026.** The owner installed Blender so
Claude could build models (first for a Lake Michigan dunes biome, and the
lower-polygon redwoods in IDEAS.md). The first check ran it headless with
Cycles on the CPU, kept off the card under the rule above; the owner: "when we
are using blender you dont need to leave it off the GPU that would make it
worthless." Blender is therefore exempt from asking, in turns and goals alike.
It is not the game, so none of the crashes involved it, but the limits carry
their lessons: the `nvidia-smi` check (14 October, gaming), one short job at a
time rather than a long batch (18 October, volume), and nothing left running
(16 October). The busy threshold is about 30%, not the goal's 10%, because
the desktop alone (Chrome, Spotify, the vendor overlays) read 7-25% that
evening; it is placed, and the owner can move it.

## The graphics profile

A full `npm run profile` sweep is about 10 minutes: 27 cases on the real GPU at
roughly 15 seconds each, plus two on the software rasteriser at about two
minutes each, because a software frame takes seconds. The harness refuses to
report when an idle page costs a whole frame because this project once lost a
fortnight to a frame number that was really a vsync interval.

## The smoke test

On its first full run the harness found a `ReferenceError` in `renderer.js` that
had thrown sixty times a second on every green for six days, while all 546
tests passed: the putting distance marker it belonged to had never positioned
itself once. Its own first draft reported six failures that were the harness
misreading the game -- a panel checked for a class it never uses, keys pressed
faster than a frame, a toggle pressed twice -- and three that were real.

## Built is not working

Three phases of the Swing Meter journey (rewards, challenges, the course of the
week) were committed on 14 October 2026 without being played: the graphics card
was off limits. Each commit message, a TODO entry and the reply said so, with a
list of exactly what to look at, so the owner could plan the testing. Without
that, "Phase 7 committed" would have read as "Phase 7 works".

## Pure modules

The same three phases stayed testable without the game only because their rules
-- the reward table, the ball finishes, achievements, the course of the week,
the challenges -- were written as modules with no DOM and Node tests (about 60
tests), with `main.js` only wiring them in. Everything in `main.js` itself
waited for the owner.

## Edit scripts

A regular expression written into `src/profile.js` by an edit script (a
heredoc or `node -e`; which one was not recorded) lost its backslashes on the way -- `/^\d{4}-\d{2}-\d{2}$/` became
`/^d{4}-d{2}-d{2}$/`, still valid JavaScript -- so the date of the daily XP
bonus was dropped on every load and the bonus could be paid twice a day. No
test caught it; it was found a phase later by reading the code (14 October
2026). The same day, a backslash written before a backtick in Python strings and in a
`String.raw` template went into source comments as a stray backslash-backtick. Searching the touched files
after a scripted edit catches both.

## The bench

One session spent most of an hour answering generator questions with throwaway
scripts, regenerating the same two dozen courses about twenty-five times over;
the bench builds every course once, across all cores, a measured 25x against
the serial cost. A tee-ramp change once silently broke channel routing and
turned up only in the test suite, with no numbers attached -- hence `--since`
before and after.

**Four measurements have lied**, every one because it recomputed what it was
checking: a pond distance scaled by the wrong axis, a sightline ray drawn
straight through world space while the generator drew it along the centreline,
three disagreeing beach metrics, and a lake check that consulted only half the
bodies. `sightline` is exported from `course.js` for exactly this reason.
