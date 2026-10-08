# Fairway documentation

Fourteen documents, and the fastest way through them is to know which question
each one answers. Nothing here is an archive: every document is expected to
describe the code as it stands today, and correcting a stale claim is part of
the change that made it stale, not a follow-up.

## Start here

| If you want to | Read |
| --- | --- |
| play, and find the controls | [PLAYING.md](PLAYING.md) |
| get it running on a device | [INSTALLATION.md](INSTALLATION.md) |
| publish a release, or retake pictures and clips of the game | [INSTALLATION.md](INSTALLATION.md), *Publishing a release on GitHub* and *Pictures and clips of the game* |
| find the command for something | [COMMAND_CHEAT_SHEET.md](COMMAND_CHEAT_SHEET.md) |
| change the code | [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md), then [../AGENTS.md](../AGENTS.md) |
| know why a number is what it is | [RESEARCH.md](RESEARCH.md) |
| know what is left to do | [TODO.md](TODO.md) |

## The full set

**For a player**

- **[PLAYING.md](PLAYING.md)** — every control, every course-studio setting,
  the wind dial, the map, the scorecard, your profile and sim handicap, the
  launch-monitor walkthrough, and how to report a problem.
- **[PORTABLE_README.md](PORTABLE_README.md)** — the README inside each
  download: starting `run_fairway_server`, playing on a phone, connecting a
  launch monitor through rēlā, troubleshooting.
- **[INSTALLATION.md](INSTALLATION.md)** — building from source, supported
  platforms and the ones that are merely untested, serving it yourself, the
  bridge's details, publishing a release, and capturing pictures and clips of
  the game. (The website is kept in its own repository.) Not
  shipped in the player downloads.

**For somebody changing the code**

- **[COMMAND_CHEAT_SHEET.md](COMMAND_CHEAT_SHEET.md)** — every build, test,
  measurement, release and capture command on one page.

- **[PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)** — the architecture with no
  conversation history assumed: modes, data flow, units, the generation
  pipeline, the file map, and the invariants that break things quietly when
  violated. The single most useful document in the repository.
- **[PROCEDURAL_GENERATION.md](PROCEDURAL_GENERATION.md)** — what the
  generator produces, in what order, and which stage owns which decision.
- **[BALL_BEHAVIOUR_KNOBS.md](BALL_BEHAVIOUR_KNOBS.md)** — the plain-language
  map from a tuning parameter to the ball behaviour it changes. Written for
  somebody who wants a different result, not a different equation.
- **[TODO.md](TODO.md)** — open work at the top under its section headings,
  everything finished in `# Done` at the foot with what was actually built.
  As much a changelog as a list.

**The numbers and where they came from**

- **[RESEARCH.md](RESEARCH.md)** — the long one. Every measured or fitted
  value, what it is anchored to, what it was measured at, and where the model
  departs from its source on purpose. Rejected approaches are recorded here
  too, because knowing what was tried is worth as much as knowing what won.
- **[LANDSCAPE_RESEARCH.md](LANDSCAPE_RESEARCH.md)** — the same standard,
  applied to terrain, vegetation and course architecture.
- **[REFERENCES.md](REFERENCES.md)** — the source list behind both.
- **sources/** — pages and exports that cannot be fetched automatically,
  saved so a citation stays readable. **Local only, not in the repository**;
  RESEARCH.md quotes the passage it relies on.

**Reports and studies -- local only**

These are made for the owner and stay on the machine that made them: since
3 October 2026 `docs/reports/`, `docs/studies/` and `docs/sources/` are
git-ignored and are not in the repository or its history. The tools that
generate them are tracked, and what was decided from them is in RESEARCH.md.
The list below is what exists locally.

- **[reports/flight-refit/](reports/flight-refit/index.html)** — the ball flight
  refitted against Trackman's tour averages, a GC3 and the owner's R50: before
  and after by source and club, Trackman shots from the side, and the rollout
  and backspin check (`tools/flight-fit.mjs`).
- **[reports/r50-check/](reports/r50-check/index.html)** — the owner's R50
  session against the flight model as it stood on 6 October, which started the
  refit.
- **[reports/shotmaking/](reports/shotmaking/index.html)** — six showcase shots
  for the website (stinger, high draw, power fade, knockdown, flop, zip-back),
  1920x1080 with posters, each with its numbers and where they come from
  (`tools/landing-report/shotmaking-*.mjs`).
- **[reports/chipping/](reports/chipping/index.html)** — fifteen chipping and
  approach clips at 10 to 100 yards, low, stock and high, each with its launch
  numbers, carry and roll (`tools/landing-report/approach-*.mjs`).
- **[reports/LIP_GRIP_REPORT.md](reports/LIP_GRIP_REPORT.md)** — the lip of the
  cup gripping only as hard as the ball presses on it: shorter lip-out rides,
  the full 360-degree lip-out traded away. Visual version in
  [reports/lip-grip/](reports/lip-grip/index.html).
- **[reports/BALL_LANDING_REPORT.md](reports/BALL_LANDING_REPORT.md)** — what the
  ball does after it lands: keyboard chip spin, bunkers, the cup, sideways hops,
  and a plan for what comes next. The clips and charts are in
  [reports/ball-landing/](reports/ball-landing/index.html).

- **[reports/TEE_AND_OBSTRUCTION_REPORT.md](reports/TEE_AND_OBSTRUCTION_REPORT.md)**
  — what was blocking tee shots, what was measured, what was changed, and the
  one change that made no difference. Screenshots in
  [reports/tee-screenshots/](reports/tee-screenshots/).
- **[reports/MULTIPLAYER_FEASIBILITY.md](reports/MULTIPLAYER_FEASIBILITY.md)**
  — what networked play would cost. A study, not a plan; nothing in the code
  depends on it.
- **[studies/](studies/)** — comparison pages built to settle one visual
  question, kept because RESEARCH.md cites them as the evidence.

**Licensing and provenance**

- **[ATTRIBUTION.md](ATTRIBUTION.md)** — every imported asset, who made it,
  under what terms, and what was actually taken from it.
- **[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)** — the notices that
  have to travel with a distribution. Also embedded in the built HTML.
- **[releases/](releases/)** — the notes for every published release, one file each (`v0.1.md` …), word for word what GitHub shows. A release's notes are written here and merged before it is tagged.
- **[DISTRIBUTION_REVIEW.md](DISTRIBUTION_REVIEW.md)** — the dated provenance
  and licence audit, the commercial-use pass, and the release checks that are
  still open.
- **[DEPENDENCY_INVENTORY.json](DEPENDENCY_INVENTORY.json)** — every locked
  package with its version, licence and integrity hash. The release packager
  refuses to build while this disagrees with `package-lock.json`.

## Keeping them true

The rules live in [../AGENTS.md](../AGENTS.md) and they are short:
documentation ships with the change that caused it, every file in this folder
is checked on every pass, and a claim that a change made false gets **edited**
rather than contradicted further down. A document asserting two different
numbers for one quantity is worse than one that is merely out of date.
