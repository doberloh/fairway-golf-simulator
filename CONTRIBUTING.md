# Contributing to Fairway

Short version of [AGENTS.md](AGENTS.md), which is the long version and also
the entry point for coding agents. Read
[docs/PROJECT_HANDOFF.md](docs/PROJECT_HANDOFF.md) before changing anything —
it explains the architecture, the units and the invariants without assuming
you were there.

## Getting set up

Node.js 22.12 or newer. Python 3 only if you are cutting release archives.

```sh
npm ci
npm run dev      # http://127.0.0.1:5173
npm test         # the whole suite; it must be green before you commit
npm run build    # single-file dist/index.html
npm run smoke    # build, then play the built file in a real browser
npm run release  # build, then cut and verify the release archives
```

There is no test framework beyond the Node test runner, no linter config and
no formatter. Match the style of the file you are editing.

## What is verified, and how

- **`npm test`** — regression suites in `tests/`. Add a focused one for the
  behaviour you are changing.
- **`npm run bench`** — builds many courses in parallel and measures what the
  generator produced. Run `--since` before and after any change that touches
  terrain, routing, water, planting or housing. Iterate on `--tier quick`
  (seconds), confirm on `--tier full`.
- **`node tools/biome-fingerprint.mjs --check`** — tells you whether generated
  ground moved for an unchanged seed. This is not a formality; see below.
- **`npm run smoke`** — opens the built file in a real browser and plays it,
  failing on any error, any `console.error` and any network request. `npm
  test` cannot see the interface at all, and two broken interfaces have
  shipped with every test green; this is what catches that. Run it after any
  change a player could click on, or to the stylesheet -- it checks the layout
  from a desktop down to a phone. About a minute and a half with a GPU.
  The first time, `npx playwright install chromium` -- `npm ci` does not fetch
  the browser.
- **`npm run profile`** — measures what a frame costs. Minutes of a machine at
  full tilt, so it is run deliberately rather than routinely.

A measurement imports its geometry from `src/` and never reimplements it.
Four measurements in this project's history have lied, and every one of them
lied because it recomputed the thing it was checking.

## The rules that are not negotiable

**Work on a branch.** Never commit to `main`, however small the change. The
branch is how the work gets reviewed, and merging it is the owner's call.

**Two version numbers live in `src/settings-schema.js`.**
`GENERATOR_VERSION` goes up whenever generated output changes for an unchanged
seed — otherwise a saved round silently rebuilds different ground underneath a
ball that has not moved. `SCHEMA_VERSION` goes up whenever the shape of a
settings object changes, and needs a matching migration and a test that an old
save still loads. The fingerprint tool is the arbiter for the first one: it
reports the biome record and the generated ground separately, and only a
ground change owes a bump.

**Documentation ships in the same change.** Not afterwards, and not batched at
the end of a session — a document written before a later fix reverses it goes
actively wrong with nothing to flag it. Every file in [docs/](docs/) is in
scope on every pass, including the ones your change does not obviously touch,
and finding that a file needs nothing is an answer worth saying out loud.
When a change makes an old claim false, **edit the claim**; do not append a
newer one beside it.

**Record the rejected alternatives.** The approach that looked obviously right
and fell over is worth more to the next person than a description of the code,
which they can read. The same goes for a subtle bug: write down what the
symptom looked like, because that is what saves the next hour.

**External sources go in [docs/RESEARCH.md](docs/RESEARCH.md) with their
links**, including the ones that were read and rejected. Record the figure and
its units, not a paraphrase. If a page cannot be fetched, commit a copy under
[docs/sources/](docs/sources/) rather than citing something nobody can open.

**Say plainly when something did not work.** A change that made no measurable
difference is a result, and it gets reported as one.

## Preserve

The portable offline single-file build. The cartoon art style. Complete 9- and
18-hole landscapes generated whole rather than hole by hole. Real ball and cup
dimensions. The existing scoring formats. Consistency between terrain
rendering, collision heights, surface queries and map geometry.
