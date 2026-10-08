# Working on Fairway

**Every document lives under `docs/`, and `docs/README.md` is its index.** The
repository root carries only README.md (the front door), CONTRIBUTING.md (the
short version of this file), LICENSE and this file.

Read `docs/PROJECT_HANDOFF.md` first. It explains the product, architecture,
units, generation pipeline, persistence, testing, packaging and known
limitations without requiring conversation history. Read `docs/TODO.md` for
prioritized follow-up work and `docs/PLAYING.md` for player controls.

Preserve the portable offline single-file build, Cartoon-only graphics, complete 9/18-hole landscapes, seeded procedural individual holes, real ball/cup dimensions, and current scoring formats. Keep terrain rendering, collision heights, surface queries and map geometry consistent. Generation changes require attention to older saved rounds and GPU data textures.

## One branch per journey, and the branch is not yours to merge

**A journey is a stretch of work the owner starts, and it lives on one branch
until the owner says "merge it back".** It can run across many requests,
fixes and topics -- the `productization` pass went from a website to a
generator bug to rewriting the repository's history -- and all of it belongs on
that one branch.

- **Starting a journey:** when the owner starts something new and no journey is
  open (the last one has been merged), or says to start fresh, branch off
  `main`. Name it for the journey in a few kebab-case words (`productization`,
  `hud-polish`).
- **During a journey:** everything goes on its branch -- follow-ups, side
  quests, bugs found on the way. Do not make sub-branches, and do not start a
  new branch because the topic changed. If you are unsure whether something
  belongs, keep it on the current branch and say so.
- **Never commit to `main` directly,** however small the change.

This replaced "one branch per coherent piece of work" on 2 October, at the
owner's request: that rule produced 69 branches in a few weeks, many of them a
single commit and some branched off other branches, which was more to keep
track of than the work itself.

**The branch is how the owner reviews.** The desktop app's Changes pane defaults
to showing all changes on the current branch, so an unmerged branch presents the
whole journey in one readable place. A merged branch has nothing left to
compare against, and on `main` with everything merged the pane is simply blank.

Commit freely ON the branch -- slice by slice, with real messages. Commits do not
empty the pane. **The merge does.**

So when a piece of work is done: verify it, say what is on the branch, and
**stop there**. Do not merge. The owner merges, or says "merge it back". This
rule exists because of a specific failure: four separate pieces of work in this
project were branched, finished, and merged the moment the tests went green,
and the owner could not see any of them in the pane that exists for exactly
that purpose. Being finished is not permission to land it.

When the owner does ask for the merge, use `--no-ff` so the journey stays
legible as a unit in the history, and leave the merged branch in place --
deleting branches is the owner's call, not a tidy-up to do on the way past.

Rebuild `dist/` on the branch before handing it over, so what the owner opens is
what the branch actually does.

## Pushing to GitHub

The repository's remote is `origin`,
https://github.com/doberloh/fairway-golf-simulator, created on 7 October 2026
for the history with the website taken out. It is private until the owner
makes it public. The original repository, with the website still in its
history and releases v0.1 to v0.4, is `doberloh/fairway-backup`: private, kept
as an archive, never pushed to. **GitHub forwards the old address
`doberloh/fairway` to that backup**, so nothing may name the old address --
not a link, a script or a doc.

- **Push only when the owner asks.** Finishing work, committing it, or merging
  it is not a request to push.
- **Never force-push unless the owner asks for exactly that.** The one
  force-push so far replaced the history after the owner asked for it to be
  rewritten (2 October, DISTRIBUTION_REVIEW *What went to GitHub*). The
  owner asked for a second on 7 October, to take the website out of the
  history (DISTRIBUTION_REVIEW, *The website leaves this repository*).
- **`main` goes up only after a merge the owner asked for.**

**The repository's own settings protect `main`; do not work around them.**
`node tools/github-protect.mjs` sets them and says which are still waiting.
GitHub Free only offers branch rules on a public repository, so **run it again
the moment the repository goes public** -- that is when strangers can first see
it, and until it has run, nothing but these rules stops a mistaken push. Once
public:

- `main` cannot be deleted or force-pushed by anyone, the owner included. A
  history rewrite the owner asks for means the owner switches the *main keeps
  its history* ruleset off on GitHub, the push happens, and the owner switches
  it back on. Never switch it off yourself.
- Changes to `main` arrive by a pull request with one approving review. The
  owner bypasses this, which is how the owner's own merges go up; anyone else,
  including a future collaborator, needs the owner's review. Release tags
  (`v*`) cannot be moved or deleted.
- Pull requests merge with a merge commit only, matching `--no-ff`.
- A first-time outside contributor's pull request runs no workflow until the
  owner approves it, and workflows get a read-only token.

Settings already on while private (3 October 2026): merge commits only,
GitHub's own actions only, read-only workflow token, Dependabot alerts.

**Releases -- the downloads players get -- go up only when the owner says so.**

- **Publish a new GitHub release only when the owner asks for one,** in those
  terms. Building the zips (`npm run release`), finishing a journey, merging,
  or pushing is not a request to release. A release is what every player who
  clicks Download receives, the moment it is published.
- **The owner names the version.** Ask if they have not.
- **Never mark one as a pre-release.** The website's buttons point at
  `releases/latest/download/<zip>`, and GitHub's "latest" skips pre-releases,
  so a pre-release would leave every Download button on the previous version.
  "Beta" goes in the title and notes instead. For the same reason, **keep the
  four platform zips' names** (`Fairway-Windows.zip`,
  `Fairway-macOS-AppleSilicon.zip`, `Fairway-macOS-Intel.zip`,
  `Fairway-Linux.zip`): the buttons name them.
- **Release from `main`, after a merge the owner asked for,** with `dist/` and
  `release/` rebuilt from it, so the zips are exactly what `main` says.
- **Editing or deleting a published release is the owner's call too**, the same
  as a force-push.
- **The release notes go up WITH the release, never after it.** Write them as
  `docs/releases/v<version>.md` -- in the plain, player-facing voice of the
  earlier ones -- and the release's record (a DISTRIBUTION_REVIEW addendum and a
  TODO entry) on the release's branch, merge it to `main`, and build the zips
  and tag the release from THAT commit, publishing it with
  `--notes-file docs/releases/v<version>.md`. The notes in the repository and
  the notes on GitHub are then the same text, and the commit the tag points at
  already says what it is. Recording a release afterwards on a branch of its own
  -- which is what happened with v0.3 -- leaves `main` and the release out of
  step until someone remembers. Asked for by the owner on 7 October 2026.
- The command, once the owner has signed the GitHub CLI in (`gh auth login`),
  is in docs/COMMAND_CHEAT_SHEET.md, *Releases*.

## The website is not in this repository

**The website (https://fairwaygolfsim.netlify.app) has its own private
repository since 7 October 2026**, so this one can be public under MIT while
the site stays all rights reserved. Its pages, media, build and deploy tools,
Netlify settings and the rules for deploying it all live there. **Do not add
any of them back here**, and do not deploy anything to Netlify from this
folder.

What the website takes from this repository, and so what must not break
without telling it:

- **The releases.** Its demo is the `Fairway.html` inside the newest release's
  zips, checked against `RELEASE_SHA256.txt`, and its Download buttons link to
  the zips by name (*Releases*, above).
- **The `fairway-versions` tag** that `vite.config.js` puts at the top of the
  built page. The website writes its sample course code from it.
- **`public/manifest.webmanifest` and the icons**, which it keeps copies of.
  Changing them means telling the owner the website's copies are stale.
- **Pictures and clips** come from `tools/capture/` here, saved under
  `bench/shots/media/`, which is not committed. The owner picks what goes on
  the site and it is copied there by hand.

## What stays local

- **No passwords, tokens, keys, credential files, machine paths, account names
  or network details in any commit.** Where an example address is needed, use
  documentation values (192.168.1.20, 10.8.0.2), never this machine's. The
  repository was audited for all of these on 2 October and its history
  rewritten to remove the network details that had crept in; DISTRIBUTION_REVIEW
  has the audit.
- **Commits use the owner's GitHub no-reply address,** set in this repository's
  git config. Never commit as a personal email.
- **Stage files by name, never `git add -A` or `git add .`** The owner unzips
  release archives into this folder to test them, and a blanket add once swept a
  16 MB unzipped copy of the game into a commit. `.netlify/`, `site-dist/`,
  builds, release archives, `docs/reports/`, `docs/studies/`, `docs/sources/`
  and scratch captures are git-ignored; keep anything new of that kind ignored
  too.

## Reports made for the owner stay local

**Reports, studies, clips, charts and saved source pages generated for the
owner stay on this machine and are never committed.** That means everything
under `docs/reports/`, `docs/studies/` and `docs/sources/`, which `.gitignore`
covers. They are for deciding things, not for publishing: they carry large
media, copies of other people's pages, and working that is not meant to go
public with the code.

- **The tools that make them ARE committed** (`tools/landing-report/`,
  `tools/shot-sink.mjs` and the like), so any report can be regenerated from
  the repository. Commit the generator, not its output.
- **The tracked docs may still point at a local report** -- RESEARCH.md naming
  the report a decision came from is useful to the owner -- but a finding the
  next person needs goes into RESEARCH.md itself, in words and numbers, never
  only in a report.
- **Media meant for the website goes to the website's repository**, only when
  the owner picks it. Nothing of it is committed here.

This rule dates from 3 October 2026, when the owner had all three folders
removed from the repository and from its history.

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
for f in README.md CONTRIBUTING.md docs/*.md; do
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

**A source that cannot be fetched gets saved, not just cited.** Several of the pages this model is anchored to return 403 to any automated request — the USGA's are the worst offenders. When the user opens one in a browser and saves it, put the saved copy under `docs/sources/` (local, not committed -- see *Reports made for the owner stay local*), and put a short extract of the passage actually used, with its figures, **into the RESEARCH.md entry itself**, so the tracked record stands on its own. A link that nobody following it can read is not a citation; it is a promise.

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

**Every journey should be green.** `hud-reachable` checks the menu and the play
screen at nine sizes from desktop to phone; `phone-portrait` and
`phone-landscape` play a hole by touch. A change to the stylesheet or to
anything that moves a panel can break a size you are not looking at, which is
the reason those exist -- a red one is a real problem.

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
