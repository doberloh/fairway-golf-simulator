# Working on Fairway

Read PROJECT_HANDOFF.md first. It explains the product, architecture, units, generation pipeline, persistence, testing, packaging and known limitations without requiring conversation history. Read TODO.md for prioritized follow-up work and README.md for player controls.

Preserve the portable offline single-file build, Cartoon-only graphics, complete 9/18-hole landscapes, seeded procedural individual holes, real ball/cup dimensions, and current scoring formats. Keep terrain rendering, collision heights, surface queries and map geometry consistent. Generation changes require attention to older saved rounds and GPU data textures.

## Two version numbers, and when to bump them

Both live in `src/settings-schema.js`. Getting these wrong is the one class of mistake no test can catch for you, because the code stays correct — only old saves suffer.

**`GENERATOR_VERSION` — bump whenever generated output changes for an unchanged seed.** Terrain shaping, routing, hazard fitting, vegetation placement, stream or pond geometry, anything that moves ground. It does not matter how small the change is. Forgetting it means a player's saved round silently rebuilds different terrain underneath a ball that has not moved, with no warning shown. This version can never be migrated: old settings stay valid, they simply grow different land. A mismatch is surfaced to the player through `showVersionNotice`, which is the whole point.

**`SCHEMA_VERSION` — bump whenever the shape of a settings object changes.** Adding, renaming, removing or re-ranging a control. Add a matching entry to `MIGRATIONS` that upgrades a settings object from the previous version, and a test that a save from the old version still loads. This version is migrated silently and must never reach the player.

Adding a generation setting means **one schema entry** — default, bounds, step, unit, category and help text. Defaults, validation, migration, the world rebuild key and the studio panel all derive from it; do not add a parallel default, slider or bounds list anywhere else. A new setting almost always means bumping both numbers: the schema changed shape, and the generator now reads a value it did not before.

Use focused regression tests for the behavior being changed, inspect visual changes in the browser, and build before updating distributable archives. Physical launch-monitor testing is deferred until requested. Do not treat TODO entries as authorization to expand an unrelated task.

## Documentation is part of the change, not a follow-up

**Every change ships with its docs in the same pass.** Not "when architecture changes" — always, and **including intermediate steps**. A change is not finished while the documentation still describes what the code used to do, because the next person reads the docs and believes them.

**Do not batch documentation to the end of a session.** A physics session is a chain of fits where later ones overturn earlier ones, and writing it up at the end captures the destination while losing the reasoning that rejected the alternatives — which is the valuable part. Worse, a doc written mid-session goes actively wrong the moment a later fit inverts it, and nothing flags that. This has already happened once: BALL_BEHAVIOUR_KNOBS.md sat asserting the opposite of the code on how firmness affects a green, because the file was written before the fits that reversed it.

**After any change that reverses a direction, grep the docs for the old claim.** Edit the assertion rather than appending a newer one beside it — a document that says both things is worse than one that is merely out of date.

**EVERY markdown file in the repository root is in scope.** Not a shortlist — the whole set, checked every pass. A file that is not on somebody's list is the one that rots, and the ones below are ordered by how often that has actually happened.

- **RESEARCH.md** — anything with a number behind it. What the model does, what it is anchored to, what it was measured at, and where it knowingly departs from the source. Record the measurement, not the intention.
- **TODO.md** — a changelog as much as a list. Move finished work down with what was actually built, **and close any open entry the change has made untrue**. An open checkbox is a claim about the code as it stands; one entry here once asserted the exact opposite of what the physics did, which is how a correct behaviour nearly got "fixed" back into a bug.
- **PROJECT_HANDOFF.md** — architecture, invariants and the traps. If something must stay true for the code to work, say so here and say what breaks when it does not.
- **BALL_BEHAVIOUR_KNOBS.md** — the plain-language map from a tuning parameter to the ball behaviour it changes, and what each surface is anchored against. It is the file a request gets written against, so it goes stale faster than any other and matters more when it does. It has already sat asserting the reverse of the code once.
- **PROCEDURAL_GENERATION.md** — what the generator produces and in what order.
- **README.md** — anything a player can see, set or press.
- **INSTALLATION.md** — anything that changes how the thing is built, served or opened.
- **LANDSCAPE_RESEARCH.md** — sources and figures behind terrain, vegetation and architecture, same standard as RESEARCH.md.
- **ATTRIBUTION.md** and **THIRD_PARTY_NOTICES.txt** — any dependency added, removed or upgraded, and any asset or data source taken in.
- **DISTRIBUTION_REVIEW.md** — anything affecting the offline build, file-URL behaviour, bundle size or release claims.

**If a change touches nothing in a file, that is a finding, not a skip.** The question is asked every pass; the answer is often no.

Write down the decisions and the **rejected alternatives**, especially ones that look obviously right. "The ladder of relaxations reads tidier and falls off a cliff", "reaching for the rim circle below lip height parks the ball inside the wall" — those sentences are worth more than a description of the code, which anyone can read. The same is true of a bug that was subtle: record what it looked like, because it is the recognisable symptom that saves the next hour, not the fix.

If a change corrects something the docs previously asserted, **edit the assertion**; do not append a newer one beside it. Two numbers for the same quantity in one file is worse than either alone.

## External research goes into RESEARCH.md, with its links

**Every source consulted outside this repository gets recorded in RESEARCH.md — the link, and what was taken from it.** Not only the ones that changed the answer: a source that was read and rejected is worth as much as one that was used, because the next person otherwise repeats the search and reaches the same dead end.

Record the figure and its units, not a paraphrase. "Spacing no more than three times the pole height" is usable; "poles should be reasonably spaced" is not. Where sources disagree, say so and say which was followed. Where a number was adapted rather than taken — scaled, rounded, or traded off against playability — say that too, because the next reader will otherwise check it against the source and find it does not match.

A claim in this project that rests on outside work and carries no link is indistinguishable from one that was guessed.

**A source that cannot be fetched gets committed, not just cited.** Several of the pages this model is anchored to return 403 to any automated request — the USGA's are the worst offenders. When the user opens one in a browser and saves it, put the saved copy under `reference/` along with a short extract of the passage actually used, and link both from the RESEARCH.md entry. A link that nobody following it can read is not a citation; it is a promise.

**Say plainly when a number is placed rather than published, and go back for it.** Writing "these depths were chosen by judgement inside the instrument's range, and if someone can read that page they are the first thing to check" is what made the firmness presets get fixed — the note was still sitting there when the article finally arrived, naming exactly what to do. Flag the soft spot at the point it is created, in the file that carries it, and expect anchoring to *cost* range: the judged Burnt was more dramatic than the published one and had nothing behind it.

## Do not leave processes running when your turn ends

**The owner manages long-running processes.** Dev servers, preview servers, watchers, tunnels — anything that keeps a port open or a process alive past the end of your turn is theirs to start and stop, not yours.

Inside a turn, run whatever the work needs. Start a preview, drive the game in it, read the console, take measurements, verify the thing you just changed actually behaves — that is the job, and skipping it to avoid starting a process is the wrong trade. **Verification is not optional; leaving the machinery behind is.**

So: shut down anything you started before you finish. If a process was spawned through a wrapper, check the port is actually free rather than trusting that stopping the wrapper stopped the child — `npx vite preview` leaves its server running when the `npx` that launched it is killed, and the next attempt silently attaches to the stale one and loads nothing.

Never end a turn by telling the owner a URL is up and offering to kill it later. Either it was needed for verification and is now closed, or it was not needed.
