# Working on Fairway

**Every document lives under `docs/`, and `docs/README.md` is its index.** The
repository root carries only README.md (the front door), CONTRIBUTING.md (the
short version of this file), LICENSE and this file.

Read `docs/PROJECT_HANDOFF.md` first. It explains the product, architecture,
units, generation pipeline, persistence, testing, packaging and known
limitations without requiring conversation history. Read `docs/TODO.md` for
prioritized follow-up work and `docs/PLAYING.md` for player controls.

Preserve the portable offline single-file build, Cartoon-only graphics, complete 9/18-hole landscapes, seeded procedural individual holes, real ball/cup dimensions, and current scoring formats. Keep terrain rendering, collision heights, surface queries and map geometry consistent. Generation changes require attention to older saved rounds and GPU data textures.

## Every change goes on a branch, and the branch is not yours to merge

Start with a branch off `main`. Never commit to `main` directly, however small
the change.

**The branch is how the owner reviews.** The desktop app's Changes pane defaults
to showing all changes on the current branch, so an unmerged branch presents the
whole piece of work in one readable place. A merged branch has nothing left to
compare against, and on `main` with everything merged the pane is simply blank.

Commit freely ON the branch -- slice by slice, with real messages. Commits do not
empty the pane. **The merge does.**

So when the work is done: verify it, say what is on the branch, and **stop
there**. Do not merge. The owner merges, or asks you to. This is the one rule in
this file that exists because of a specific failure: four separate pieces of
work in this project were branched, finished, and merged the moment the tests
went green, and the owner could not see any of them in the pane that exists for
exactly that purpose. Being finished is not permission to land it.

If the owner does ask for the merge, use `--no-ff` so the branch stays legible
as a unit in the history, and leave the merged branch in place -- deleting
branches is the owner's call, not a tidy-up to do on the way past.

Name the branch for the change in a few kebab-case words (`hud-polish`,
`par-yardage`). One branch per coherent piece of work: if you find yourself
explaining the branch with the word "and", it is probably two.

Rebuild `dist/` on the branch before handing it over, so what the owner opens is
what the branch actually does.

## Two version numbers, and when to bump them

Both live in `src/settings-schema.js`. Getting these wrong is the one class of mistake no test can catch for you, because the code stays correct — only old saves suffer.

**`GENERATOR_VERSION` — bump whenever generated output changes for an unchanged seed.** Terrain shaping, routing, hazard fitting, vegetation placement, stream or pond geometry, anything that moves ground. It does not matter how small the change is. Forgetting it means a player's saved round silently rebuilds different terrain underneath a ball that has not moved, with no warning shown. This version can never be migrated: old settings stay valid, they simply grow different land. A mismatch is surfaced to the player through `showVersionNotice`, which is the whole point.

**`SCHEMA_VERSION` — bump whenever the shape of a settings object changes.** Adding, renaming, removing or re-ranging a control. Add a matching entry to `MIGRATIONS` that upgrades a settings object from the previous version, and a test that a save from the old version still loads. This version is migrated silently and must never reach the player.

Adding a generation setting means **one schema entry** — default, bounds, step, unit, category and help text. Defaults, validation, migration, the world rebuild key and the studio panel all derive from it; do not add a parallel default, slider or bounds list anywhere else. A new setting almost always means bumping both numbers: the schema changed shape, and the generator now reads a value it did not before.

**How to know you owe a bump, rather than remembering to ask.** `node tools/biome-fingerprint.mjs --check` is the trigger, not a formality: if it reports any biome moved, generated output changed for an unchanged seed and `GENERATOR_VERSION` has to go up. The stored fingerprints carry the generator version they were taken at, so `--check` now fails with that message instead of leaving it to you to notice. Run it on any change that touches `src/course.js`, `src/course-plan.js`, `src/streams.js`, `src/lakes.js`, `src/homes.js` or `src/vegetation.js` -- and run it on changes that look unrelated too, because the ones that catch you are the changes nobody expected to move ground.

**The bump is two edits, not one.** The number, and a line in the list above it saying what moved and why. The list currently runs 2 to 12 and then 23 to 32, which means ten bumps between them went unrecorded and cannot be recovered -- this repository's history begins at one squashed commit. Two of the recent entries were also mislabelled, 31 and 32 both written as one less than the version they produced, which was caught only by checking each number against the commit that moved the constant. **The number in the entry is the version it produced**, and if you are unsure, `git log -S"GENERATOR_VERSION=<n>"` settles it. A version number with no entry tells a future reader that something changed and nothing about what, which is barely better than not bumping at all.

**What does NOT need a bump.** Rendering, HUD, cameras, materials, audio, the map, the scorecard, tests and tooling. If the ground, the routing, the hazards and the planting are all byte-identical for a given seed, nothing about the player's save is at risk. The fingerprint is the arbiter; if it is silent, leave both numbers alone. It reports two hashes and they mean different things: a **record** change is the biome's own fields -- its name, its palette, its light -- and owes NOTHING, because a look cannot move a ball or invalidate a saved round. A **ground** change is what the generator built, and that is the one that owes a bump. They used to be one hash, and it told a session to bump the version after three biome TITLES were renamed; an arbiter that cries wolf gets ignored the one time it matters.

Use focused regression tests for the behavior being changed, inspect visual changes in the browser, and build before updating distributable archives. Physical launch-monitor testing is deferred until requested. Do not treat TODO entries as authorization to expand an unrelated task.

## Documentation is part of the change, not a follow-up

**Every change ships with its docs in the same pass.** Not "when architecture changes" — always, and **including intermediate steps**. A change is not finished while the documentation still describes what the code used to do, because the next person reads the docs and believes them.

**Do not batch documentation to the end of a session.** A physics session is a chain of fits where later ones overturn earlier ones, and writing it up at the end captures the destination while losing the reasoning that rejected the alternatives — which is the valuable part. Worse, a doc written mid-session goes actively wrong the moment a later fit inverts it, and nothing flags that. This has already happened once: BALL_BEHAVIOUR_KNOBS.md sat asserting the opposite of the code on how firmness affects a green, because the file was written before the fits that reversed it.

**After any change that reverses a direction, grep the docs for the old claim.** Edit the assertion rather than appending a newer one beside it — a document that says both things is worse than one that is merely out of date.

**EVERY document under `docs/`, plus the root README.md and CONTRIBUTING.md, is in scope.** Not a shortlist — the whole set, checked every pass. A file that is not on somebody's list is the one that rots, and the ones below are ordered by how often that has actually happened.

- **RESEARCH.md** — anything with a number behind it. What the model does, what it is anchored to, what it was measured at, and where it knowingly departs from the source. Record the measurement, not the intention.
- **TODO.md** — a changelog as much as a list, split in two: open work at the top under its section headings, and everything finished in `# Done` at the foot, under a copy of the heading it came from. Tick an entry and move it into the matching `# Done` section with what was actually built, **and close any open entry the change has made untrue**. Never leave an open item nested as a note under a finished one — ten of them had accumulated that way, invisible, which is why the file was split. An open checkbox is a claim about the code as it stands; one entry here once asserted the exact opposite of what the physics did, which is how a correct behaviour nearly got "fixed" back into a bug.
- **PROJECT_HANDOFF.md** — architecture, invariants and the traps. If something must stay true for the code to work, say so here and say what breaks when it does not.
- **BALL_BEHAVIOUR_KNOBS.md** — the plain-language map from a tuning parameter to the ball behaviour it changes, and what each surface is anchored against. It is the file a request gets written against, so it goes stale faster than any other and matters more when it does. It has already sat asserting the reverse of the code once.
- **PROCEDURAL_GENERATION.md** — what the generator produces and in what order.
- **REFERENCES.md** — the source list behind RESEARCH.md and LANDSCAPE_RESEARCH.md. A source consulted and not listed here is a source the next person has to find again.
- **docs/PLAYING.md** — anything a player can see, set or press. Every control, every studio setting, the launch-monitor walkthrough. This is the file that used to be most of README.md and it rots the same way.
- **README.md** (root) — what the project IS, how to build it, what the repository contains, and what is claimed about it. A new top-level directory, a changed build command or a changed release claim belongs here.
- **docs/README.md** — the documentation index. A document added, removed or renamed is not finished until this says so.
- **INSTALLATION.md** — anything that changes how the thing is built, served or opened.
- **LANDSCAPE_RESEARCH.md** — sources and figures behind terrain, vegetation and architecture, same standard as RESEARCH.md.
- **ATTRIBUTION.md** and **THIRD_PARTY_NOTICES.txt** — any dependency added, removed or upgraded, and any asset or data source taken in.
- **DISTRIBUTION_REVIEW.md** — anything affecting the offline build, file-URL behaviour, bundle size or release claims.

**Check every one of them, every time, including the ones the change does not obviously touch.** The player-facing manual and PROJECT_HANDOFF.md went fourteen commits without an update while RESEARCH.md, PROCEDURAL_GENERATION.md and TODO.md were updated in every single one. Nothing about the rule changed. "Update the docs" was read as "write up what was measured", RESEARCH.md is the natural home for that, so it always got written and always felt like compliance. The two that rotted describe what a PLAYER sees and what the ARCHITECTURE guarantees -- the two a newcomer reads first, and the two least connected to whatever was just measured.

A quick way to catch it, before committing:

```bash
for f in README.md CONTRIBUTING.md docs/*.md docs/reports/*.md; do
  printf "%-36s %s
" "$f" "$(git log -1 --format='%ad %h' --date=short -- "$f")"
done
```

A file many commits behind the others is the gap.

**If a change touches nothing in a file, that is a finding, not a skip.** The question is asked every pass; the answer is often no.

**AND SAY SO. Name the files that were read and judged not to need changing, in the reply, not silently.** An unmentioned file is indistinguishable from a forgotten one -- by the reader and, in practice, by the writer too. "PROJECT_HANDOFF and PLAYING read, nothing a player can see or an invariant changed" is one line, and it is the line that makes the audit real rather than intended. If that sentence is hard to write honestly, the file probably did need editing.

Write down the decisions and the **rejected alternatives**, especially ones that look obviously right. "The ladder of relaxations reads tidier and falls off a cliff", "reaching for the rim circle below lip height parks the ball inside the wall" — those sentences are worth more than a description of the code, which anyone can read. The same is true of a bug that was subtle: record what it looked like, because it is the recognisable symptom that saves the next hour, not the fix.

If a change corrects something the docs previously asserted, **edit the assertion**; do not append a newer one beside it. Two numbers for the same quantity in one file is worse than either alone.

## External research goes into RESEARCH.md, with its links

**Every source consulted outside this repository gets recorded in RESEARCH.md — the link, and what was taken from it.** Not only the ones that changed the answer: a source that was read and rejected is worth as much as one that was used, because the next person otherwise repeats the search and reaches the same dead end.

Record the figure and its units, not a paraphrase. "Spacing no more than three times the pole height" is usable; "poles should be reasonably spaced" is not. Where sources disagree, say so and say which was followed. Where a number was adapted rather than taken — scaled, rounded, or traded off against playability — say that too, because the next reader will otherwise check it against the source and find it does not match.

A claim in this project that rests on outside work and carries no link is indistinguishable from one that was guessed.

**A source that cannot be fetched gets committed, not just cited.** Several of the pages this model is anchored to return 403 to any automated request — the USGA's are the worst offenders. When the user opens one in a browser and saves it, put the saved copy under `docs/sources/` along with a short extract of the passage actually used, and link both from the RESEARCH.md entry. A link that nobody following it can read is not a citation; it is a promise.

**Say plainly when a number is placed rather than published, and go back for it.** Writing "these depths were chosen by judgement inside the instrument's range, and if someone can read that page they are the first thing to check" is what made the firmness presets get fixed — the note was still sitting there when the article finally arrived, naming exactly what to do. Flag the soft spot at the point it is created, in the file that carries it, and expect anchoring to *cost* range: the judged Burnt was more dramatic than the published one and had nothing behind it.

## Do not leave processes running when your turn ends

**The owner manages long-running processes.** Dev servers, preview servers, watchers, tunnels — anything that keeps a port open or a process alive past the end of your turn is theirs to start and stop, not yours.

Inside a turn, run whatever the work needs. Start a preview, drive the game in it, read the console, take measurements, verify the thing you just changed actually behaves — that is the job, and skipping it to avoid starting a process is the wrong trade. **Verification is not optional; leaving the machinery behind is.**

So: shut down anything you started before you finish. If a process was spawned through a wrapper, check the port is actually free rather than trusting that stopping the wrapper stopped the child — `npx vite preview` leaves its server running when the `npx` that launched it is killed, and the next attempt silently attaches to the stale one and loads nothing.

Never end a turn by telling the owner a URL is up and offering to kill it later. Either it was needed for verification and is now closed, or it was not needed.

## Offer a graphics profile when you touch the frame. Never just run one

`npm run profile` measures what a frame costs. **Ask before running it, say what
it will cost in time, and let the owner decide.** It is minutes of a machine at
full tilt, and it is worthless while anything else is competing for the GPU --
so it is the owner's call whether now is the moment, not yours.

**Quote the real cost when you ask.** A full sweep is about **10 minutes**: 27
cases on the real GPU at roughly 15 seconds each, plus two on the software
rasteriser at about two minutes each, because a software frame takes seconds
rather than milliseconds. One group with `--only tiers` (or `views`, `biomes`,
`ablation`, `pixels`, `water`, `weak`) is about **a minute**. The tool prints
its own elapsed time, so these numbers stay honest as the sweep grows.

**Ask whenever a change could plausibly move a frame**, which is a wider net
than it sounds:

- anything in `renderer.js`, `graphics.js`, `vegetation.js`, `textures.js`, the
  shaders, or a material
- a new render pass, post effect, shadow setting or reflection
- a change to how much geometry exists or how it is batched -- mesh ingest,
  instancing, LOD, culling, draw order
- tier definitions, obviously, and anything that reads one

**Do not ask for a profile** over settings-panel layout, menu text, docs, tests,
tooling, scoring, or course generation. Generation has its own harness in
`bench.mjs` and the profiler says nothing about it.

**When a run happens, read it properly.** Compare with `--since` against
`bench/profile-baseline.json` rather than against a number in someone's memory.
Re-save the baseline only when the new figures are the ones that should be
defended from now on -- a baseline quietly moved to match a regression is worse
than no baseline. And say which arm a number came from: the real GPU answers
"how much headroom is there", the software rasteriser answers "what happens on a
machine with no graphics card", and they differ by two orders of magnitude.

**One rule the harness enforces and you should not argue with.** It refuses to
report if an idle page costs a whole frame, because that means it is measuring
the display rather than the renderer. If it refuses, the harness is broken, not
the check. This project has lost a fortnight to a frame number that was really a
vsync interval; the check exists to make that impossible to repeat.

## Drive the built game after touching anything a player can click

`npm test` covers physics, generation and scoring, and cannot see the
interface at all. `npm run smoke` can: it opens the built file by `file://` in
a real browser and plays it, and fails on any uncaught error, any
`console.error`, and any network request.

**Run it after any change to `main.js`, `index.html`, `style.css`,
`renderer.js`, `popups.js`, `layout.js`, or anything the frame loop calls.**
About a minute with a GPU. It does not replace looking at a visual change --
it proves the thing still WORKS, not that it looks right.

This is a rule because of what the harness found on its first full run: a
`ReferenceError` in `renderer.js` that had thrown sixty times a second on every
green for six days, while all 546 tests passed. The putting distance marker it
belonged to had never positioned itself once.

**When it fails, find out whose fault it is before changing anything.** Its
first draft reported six failures that were the harness misreading the game --
a panel checked for a class it never uses, keys pressed faster than a frame,
a toggle pressed twice -- and three that were real. The screenshot it saves to
`bench/shots/smoke/` is usually enough to tell which.

**`hud-reachable` is expected to fail until the HUD layout is fixed** for
laptop-sized screens. Everything else should be green; a red flow journey is a
real problem.

## Measure with `tools/bench.mjs`, not with a throwaway script

Generating a 9-hole course takes three to five seconds, so any question asked
of the generator is answered by building dozens of them. Answering each
question with its own script means rebuilding the same terrain for every
question, single-threaded — one session spent most of an hour doing exactly
that, regenerating the same two dozen courses about twenty-five times over.

```bash
node tools/bench.mjs                          # every metric, standard tier
node tools/bench.mjs tees blind --tier quick  # iterate: ~7 s
node tools/bench.mjs --tier full              # confirm: ~30 s for 30 courses
node tools/bench.mjs --set blindTees=50       # sweep one control
node tools/bench.mjs --tier full --save       # store as the baseline
node tools/bench.mjs --tier full --since      # what moved since the baseline
```

Every metric shares one generation pass and the courses are built across all
cores, which is a measured **25x** against the serial cost.

**Iterate on `quick`, confirm on `full`.** The point of the tiers is that the
cheap one is cheap enough to run after every edit.

**Run `--since` before and after any change to terrain generation.** A tee-ramp
change once silently broke channel routing and only turned up in the test suite
with no numbers attached.

**A new metric imports its geometry from `src`. It never reimplements it.**
Four measurements in this project's history have lied, and every one of them
lied because it recomputed what it was checking: a pond distance scaled by the
wrong axis, a sightline ray drawn straight through world space while the
generator drew it along the centreline, three disagreeing beach metrics, and a
lake check that consulted only half the bodies. `sightline` is exported from
`course.js` for exactly this reason. A number that is wrong is worse than no
number, because it gets acted on.

**An `invariant` is a rule, not a reading.** It must be zero, the harness
prints the offending courses by name, and a non-zero one exits non-zero.

## Write to the owner in plain language

The owner reads every summary and does not want to decode it. Say what changed,
what it means for the game, and what it cost — in ordinary words.

- No formulas, no notation, no jargon unless it is genuinely the subject. If a
  piece of maths is the actual finding, explain what it means before showing it,
  and only show it if seeing it helps.
- Numbers are welcome; they are how work is judged here. What is not welcome is
  the derivation behind them.
- Prefer "the wait when a player starts an 18-hole course" over "generation
  wall time". Name the thing the owner would notice.
- Say plainly when something did not work. A change that made no difference is a
  result and should be reported as one, not buried.

Detail belongs in RESEARCH.md, which is written for whoever picks the code up
next. The summary in chat is for deciding what to do.
