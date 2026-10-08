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
