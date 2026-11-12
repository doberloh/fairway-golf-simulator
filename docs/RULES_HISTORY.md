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
most of its budget before any work began. (By 12 November 2026 they were about
150, 170 and 280 thousand; that day TODO's finished work became DONE.md, below,
and the rule names DONE.md in TODO's place.)

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

**A release's TODO entry replaces the last one's.** Every release from 0.9 to
0.9.12 added a "play it by hand" entry and none was ever closed, so by 11
November 2026 the open list carried twelve of them, eleven for versions nobody
could download any more -- part of how it reached 233 entries. The owner had
the list pared that day and agreed the rule on 12 November.

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

**`# Done` became DONE.md** on 12 November 2026, at the owner's request ("the
TODO list is still really lengthy with completed actions"). The day before,
the open list had been pared from 233 entries to 31, and the file was still
8,270 lines: 308 of open work and 660 KB of finished work under them, 97% of
it. Reading the list meant knowing where to stop, and 45 ticked entries had
sat in the open half for weeks because ticking one felt like finishing it.
Hence a finished entry moves to DONE.md in the same pass, never ticked and
left.

**`docs/history/` came the same day.** The owner asked whether the older
documents could be folded into the main ones and deleted. They could not:
every one had been edited within three weeks, and the code names them in
comments (22 files name CARTOON_OVERHAUL.md, 21 UI_POLISH.md, and
`tools/capture/overhaul-showcase.mjs` reads the first as data). But both of
those were a short part that still governs work under a long round-by-round
journal of a merged branch, so each kept its name and its live sections (16
of 136 KB, 31 of 64 KB) and the journal moved to `docs/history/`, word for
word. The folder is outside `docs/*.md` on purpose: a subject search during
the documentation sweep no longer matches 160 KB of rounds about landscapes
and screens that have since been replaced.

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

**The realistic-graphics goal, 24 October 2026.** The owner drafted a `/goal`
to replace the Cartoon look with realistic graphics, to run with nobody at the
computer, and lifted the asking for everything on the card for that goal:
smoke, captures, the pane game, full profiles and Blender. The section above
says a goal cannot widen its limits, which an agent reading AGENTS.md every
message could take as overruling the goal's own words, so the owner added the
line that this one goal carries its own limits in its text. That text (drafted
in the local, git-ignored docs/reports/) is the authority for that goal only;
every other goal and turn keeps the limits above.

**The cartoon-overhaul goal, 25 October 2026.** A second graphics journey, on
its own branch and worktree beside realistic-graphics: keep Cartoon but remake
every asset, texture and biome landscape. The owner kept the graphics card
allowed with the same crash precautions as the realistic goal and asked for the
same AGENTS.md line, for the same reason. One addition in its text: the GPU log
is kept per folder, so the two goals cannot see each other's runs, and this one
waits whenever the card holds a browser or Blender it did not start.

**Landscapes may change on cartoon-overhaul, 25 October 2026.** Reviewing the
goal draft, the owner asked whether "same seed gives the same course" would be
read as "the landscape must look as it does today". It could have been: the
rest of AGENTS.md treats moved ground as something to avoid (the fingerprint,
the version bump), so an agent could hold back the very redesign the goal asks
for. The owner asked for a rule saying landscapes can change. What survives is
determinism on the branch, not sameness with main.

**The overhaul's terms outlive its goal, 26 October 2026.** The goal ran to
its end without satisfying its own stop check: two items -- playing a round
by hand, and taking or trading the frame-rate gap -- could only be the
owner's, so the check repeated every turn while the agent could do nothing
more. The owner cleared it on returning, called the work amazing, accepted
the High and Ultra gap ("220 frames per second is still way higher than a golf
sim actually needs"), and said single-turn requests would follow on the
branch with the goal's computer and rule-suspension terms still in force. The
brief that held those terms is local and git-ignored, so AGENTS.md now spells
them out for the branch. Software rendering stays outside them: the 13 October
crash was a software smoke run, and the goal's own limits never named it.
Lesson for the next goal: a done-when clause should name only what an agent
can finish alone, and say which items wait for the owner.

**The overhaul merged, 27 October 2026.** After two more goals on the branch
(polish; far landscape and mowing) the owner said "This is the GFX overhaul i
want" and asked for everything back in main. The branch's two AGENTS.md
sections had said they must be rewritten before that merge, so they became one
section saying what main's rules then were: a seed keeps its course again, the
graphics card is asked for again, and the High and Ultra frame gap stays
accepted. A branch's rules are written to end, and naming that ending in the
rule itself is what made the merge a short edit rather than a judgement call.

**The 1.0 interface polish unlocks the computer, 27 October 2026.** The last
goal before 1.0 polishes every screen at a dozen sizes, so it lives on smoke
runs, captures and frame measurements; asking for each would stall it. The
owner: "GPU and CPU usage are fully unlocked for this goal", and asked for
the rule to say it must be removed, and the branch squashed, when the branch
merges back -- the lesson of the overhaul's merge, written in from the start.
Three precautions stay because they cost the work nothing and each answers a
crash: no start while a game is running (5 and 14 October), one GPU job at a
time (18 October, volume) and nothing left open after (16 October). Software
rendering is unlocked too, against the 13 October crash; the owner was told
and left it in. The same goal allows no performance cost on any tier ("There
should be no performance hits for these changes allowed"), so every change
that could move a frame is measured against main's build. **Ended at the
merge, 29 October 2026**: the section and its pointers were deleted in the
branch's last commit, as the rule asked, and the branch was squashed to five
commits before it merged.

**The course builder unlocks the computer, 31 October 2026.** The course
builder goal (a second program in the release, courses as files, LIDAR) was
first drafted to stop at five points for the owner to play a stage, after the
overhaul's lesson that a done-when clause should name only what an agent can
finish alone. The owner chose the other way: "don't stop. Do as much as you
can to compare with the data. I'll play around with the final result", and
"GPU and CPU are free for this goal until merged. add to agents.md rule. then
remove the rule when merging." So each stage is proven by data (tests, smoke
journeys, captures, real LIDAR and published DEMs, scorecards, OpenStreetMap
outlines as a local reference) and the AGENTS.md section *On the
course-builder branch, the graphics card and processor are free* says to
delete itself in the merge. The precautions kept are the 1.0 polish goal's:
the gate's busy check (a game running), one graphics job at a time, nothing
left open, and the overhaul's retry-once on a hung run. Software rendering is
unlocked as in the 1.0 polish, run alone.

**The US landscapes goal lifts the landscape limits, 2 November 2026.** After
reviewing the study of every region of the USA, the owner kept it on the
course-builder branch ("This is all in line with that") and set its terms:
"All agents restrictions are off for these (except for performance
targeting and testing where we need to stay the same for FPS and quality)",
the base landscapes renamed and reorganised "heavy handed" because there are
no users yet, Architect removed ("We are going to use the new builder and
have real humans do the work here instead"), Haunted Hollow removed, and
every model iterated at least fifteen times against real pictures. AGENTS.md
*The US landscapes goal* reads "restrictions off" as freedom to move ground,
not to stop recording it: a moved seed still owes its `GENERATOR_VERSION`
line, because old saves still exist on the owner's own machine and the
notice is how they learn. It deletes itself in the merge with the
course-builder section. The same day the owner added that tournament week
and the people go with Architect, while paths, bridges, markings, walls,
landmarks and wildlife stay, and that the goal needs no asking for the
graphics card or processor: "computer is open to you fully".

**The frame-rate gap is no longer accepted, 9 November 2026.** The 26
October acceptance of High and Ultra's cost ("220 frames per second is still
way higher than a golf sim actually needs") had become a rule in AGENTS.md
that kept every later check on Low and stopped there. Two days after 0.9.10,
asked whether a speed pass should aim only at weak machines on Low, the owner
withdrew it: "Large courses in the builder can tank framerates even on this
PC", and asked for a goal across every tier and every device. The number had
been measured on generated nine-hole courses; nobody had profiled the large
built courses where it fails. Lesson: an acceptance measured on one kind of
course does not cover the kinds it never saw.

**The frame-rate branch unlocks the computer, 9 November 2026.** The goal's
first draft carried a "GPU allowed" budget (40 runs, 3 minutes apart, the
software arm left out). Before starting it the owner asked instead for "an
agent rule that goes away when this branch is merged back in that overrides
the need to ask to use the GPU or CPU and allows the agent to use the full PC
utilization". So AGENTS.md *On the frame-rate-all-tiers branch, the whole
computer is free* follows the course builder's: no asking, no cap, the
software arm in, the processor at full use, and the crash precautions kept --
the gate, one graphics job at a time, software rendering alone, retry once,
stop after a crash. One addition, about measuring rather than safety: nothing
heavy on the processor beside a frame measurement, because a busy machine has
inflated timings tenfold here before. It deleted itself in the merge (9 November 2026, released as
v0.9.11), and main asks before graphics work again.

**The builder-ux branch frees the graphics card for the builder, 9 November
2026.** The builder-ux goal (making the Course Builder easy to use) has to
drive the builder in a browser over and over to see each screen, and the
owner starts it at bedtime. *A `/goal` that says "GPU allowed"* covers only
short profile runs and says a goal cannot widen that, so the goal would have
stopped at its first look. Offered the frame-rate branch's answer, the owner
said "Yes, add and commit". AGENTS.md *On the builder-ux branch, the graphics
card is free for the builder* is narrower than the frame-rate one: the
builder's journeys, captures, `tools/builder-frames.mjs` and the builder in
the browser pane, with no run cap; no software rendering, which this work
does not need; the same crash precautions. It deletes itself in the merge.
The same evening the owner raised its gate from 45% and 80 °C to 60% and
85 °C ("increase the GPU threshold to 60% and 85C"), and the tools that gate
themselves are passed the same limits, since their own defaults (10%, 60 °C,
6 runs) would have stopped the goal overnight. It deleted itself in the merge (10
November 2026, released as v0.9.12), and main asks before graphics work again.

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

On 27 October 2026 a cleanup made it worse: to remove one stray
backslash-backtick from docs/CARTOON_OVERHAUL.md, a sed substitution of
"backslash-backtick" by "backtick" was run -- and in GNU sed a backslash-backtick is the start-of-line anchor, so a backtick
went in front of every one of the page's 1,245 lines, and was committed
before anyone saw it. Repaired a commit later by taking one leading backtick
off each line and checking against the last good commit. A tool that reads
the text as patterns is the wrong tool for these characters; a script that
replaces a literal string is the right one. The same goal also shipped a
shader that used a varying it declared only on one side (every river and
creek failed to compile for one build) -- caught because the capture tool
logs shader errors; a module that loads in Node says nothing about its GLSL.

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
