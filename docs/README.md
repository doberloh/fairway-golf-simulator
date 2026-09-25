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
| change the code | [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md), then [../AGENTS.md](../AGENTS.md) |
| know why a number is what it is | [RESEARCH.md](RESEARCH.md) |
| know what is left to do | [TODO.md](TODO.md) |

## The full set

**For a player**

- **[PLAYING.md](PLAYING.md)** — every control, every course-studio setting,
  the wind dial, the map, the scorecard, and the launch-monitor walkthrough.
- **[INSTALLATION.md](INSTALLATION.md)** — supported platforms and the ones
  that are merely untested, portable and source setup, LAN and mobile access,
  bridge setup, troubleshooting.

**For somebody changing the code**

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
- **[sources/](sources/)** — pages and exports that cannot be fetched
  automatically, committed so a citation stays readable. A link nobody
  following it can open is a promise, not a citation.

**Reports and studies**

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
