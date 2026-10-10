# Working on Fairway

This file is loaded with every message, so it holds the rules and one line of
why each. The incidents behind them are in `docs/RULES_HISTORY.md`.

**Every document lives under `docs/`; `docs/README.md` is the index.** The root
carries only README.md, CONTRIBUTING.md, LICENSE and this file.

**Read `docs/ARCHITECTURE.md` first** (about 4 thousand tokens): the product,
every file, the units, the pipeline and the traps. **Never read
PROJECT_HANDOFF.md, TODO.md or RESEARCH.md whole** -- about 80, 90 and 140
thousand tokens. List headings (`grep -n "^## \|^### " docs/PROJECT_HANDOFF.md`),
search (`grep -n -i "<subject>" docs/*.md`), and read only matching sections.
TODO.md's open work is above `# Done`; search PLAYING.md the same way.

Preserve the portable offline single-file build, Cartoon-only graphics,
complete 9/18-hole landscapes, seeded procedural holes, real ball and cup
dimensions, and the current scoring formats. Keep terrain rendering, collision
heights, surface queries and map geometry consistent. Generation changes need
attention to old saved rounds and the GPU data textures. Use focused regression
tests, look at visual changes in the browser, and build before updating
archives. Physical launch-monitor testing waits until requested. A TODO entry
is not permission to widen an unrelated task.

## One branch per journey, and the branch is not yours to merge

A journey is a stretch of work the owner starts; it lives on one branch until
the owner says "merge it back", across every request, fix and topic in it.

- **Starting:** when no journey is open (the last was merged) or the owner says
  start fresh, branch off `main`, named in a few kebab-case words.
- **During:** everything goes on that branch. No sub-branches, no new branch
  because the topic changed; if unsure, keep it on the branch and say so.
- **Never commit to `main` directly**, however small the change.
- **When done: verify, say what is on the branch, and stop. Do not merge.** The
  branch is how the owner reviews (the app's Changes pane shows it whole; a
  merge empties it). Being finished is not permission to land it.
- When asked to merge: `--no-ff`, and leave the branch in place -- deleting
  branches is the owner's call.
- Rebuild `dist/` on the branch before handing it over.

## Pushing to GitHub

`origin` is https://github.com/doberloh/fairway-golf-simulator, **public since
7 October 2026** -- anything pushed is seen by anyone. The old history (with the
website, and releases v0.1-v0.4) is the private `doberloh/fairway-backup`, never
pushed to. **GitHub forwards the old address `doberloh/fairway` to that backup,
so nothing may name it** -- no link, script or doc.

- **Push only when the owner asks.** Finishing, committing or merging is not a
  request to push.
- **Never force-push unless the owner asks for exactly that.**
- **`main` goes up only after a merge the owner asked for.**

**GitHub's settings protect `main`; never work around them.**
`node tools/github-protect.mjs` sets them (safe to re-run). `main` cannot be
deleted or force-pushed by anyone -- a rewrite the owner asks for means the
owner switches the *main keeps its history* ruleset off and back on; never
switch it off yourself. Changes to `main` need a reviewed pull request, which
the owner bypasses. Release tags `v*` are permanent. Merge commits only.
Outside contributors' workflows wait for the owner's approval; workflows get a
read-only token.

**Releases -- what players download -- go up only when the owner says so.**

- **Publish one only when the owner asks for a release**, in those terms.
  Building zips, finishing, merging or pushing is not a request.
- **The owner names the version.** Ask if they have not.
- **Never a pre-release, and keep the four zip names** (`Fairway-Windows.zip`,
  `Fairway-macOS-AppleSilicon.zip`, `Fairway-macOS-Intel.zip`,
  `Fairway-Linux.zip`): the website's buttons link to `releases/latest/download/<zip>`,
  and "latest" skips pre-releases. "Beta" goes in the title and notes.
- **Release from `main` after a merge the owner asked for**, with `dist/` and
  `release/` rebuilt from it.
- **The notes go up WITH the release.** Write `docs/releases/v<version>.md`
  (plain, player-facing, like the earlier ones), plus a DISTRIBUTION_REVIEW
  addendum and a TODO entry, on the release branch; merge; build and tag from
  THAT commit; publish with `--notes-file docs/releases/v<version>.md`.
- **Editing or deleting a published release is the owner's call.**
- **After publishing, the website needs a redeploy for its demo.** The
  Download buttons follow the new release by themselves; the browser demo and
  the sample course code stay on the old version until the website is deployed
  again from its own folder (no file changes, about a minute). Tell the owner,
  and do it only when asked.
- The command is in docs/COMMAND_CHEAT_SHEET.md, *Releases*.

## The website is not in this repository

**The website (https://fairwaygolfsim.netlify.app) has its own private
repository**, so this one can be MIT while the site stays all rights reserved.
**Add none of it back here**, and never deploy to Netlify from this folder.
What the website takes from here, so what must not change without telling the
owner:

- **The releases:** its demo is `Fairway.html` from the newest release, checked
  against `RELEASE_SHA256.txt`; its Download buttons name the zips.
- **The `fairway-versions` tag** `vite.config.js` puts at the top of the built
  page; the website writes its sample course code from it.
- **`public/manifest.webmanifest` and the icons**, which it keeps copies of.
- **Pictures and clips** from `tools/capture/`, saved under `bench/shots/media/`
  (not committed); the owner picks what goes on the site.

## What stays local

- **No passwords, tokens, keys, credential files, machine paths, account names
  or network details in any commit.** Example addresses use documentation
  values (192.168.1.20, 10.8.0.2).
- **Commits use the owner's GitHub no-reply address** (set in this repository's
  git config), never a personal email.
- **Stage files by name, never `git add -A` or `git add .`** -- the owner unzips
  release archives into this folder. Builds, release archives, `site-dist/`,
  `.netlify/` and scratch captures are git-ignored; keep new ones ignored.
- **Reports, studies, clips, charts and saved source pages made for the owner
  are never committed** -- `docs/reports/`, `docs/studies/`, `docs/sources/`.
  Commit the tool that makes a report, not its output. A tracked doc may name
  a local report, but a finding the next person needs goes into RESEARCH.md in
  words and numbers. Media for the website goes to its repository, only when
  the owner picks it.

## Two version numbers, and when to bump them

Both live in `src/settings-schema.js`, and no test catches getting them wrong --
only old saves suffer.

- **`GENERATOR_VERSION`: bump whenever generated output changes for an
  unchanged seed**, however small -- terrain, routing, hazards, planting, water.
  Otherwise a saved round silently rebuilds different ground under a ball that
  has not moved. It is never migrated; the mismatch is shown to the player
  (`showVersionNotice`).
- **`SCHEMA_VERSION`: bump whenever a settings object changes shape** (a
  control added, renamed, removed or re-ranged), with a `MIGRATIONS` entry and
  a test that a save from the old version loads. Silent; never shown.
- **A new generation setting is one schema entry** (default, bounds, step, unit,
  category, help text) -- everything else derives from it; add no parallel
  default, slider or bounds list. It almost always bumps both numbers.
- **`node tools/biome-fingerprint.mjs --check` decides.** If any biome's
  GROUND moved, `GENERATOR_VERSION` goes up; a RECORD change (name, palette,
  light) owes nothing. Run it on any change to `course.js`, `course-plan.js`,
  `streams.js`, `lakes.js`, `homes.js` or `vegetation.js`, and on changes that
  look unrelated.
- **A bump is two edits:** the number, and a line in the list above it saying
  what moved and why. **The entry's number is the version it produced**
  (`git log -S"GENERATOR_VERSION=<n>"` settles doubt).
- **No bump** for rendering, HUD, cameras, materials, audio, maps, the
  scorecard, tests or tooling. If the fingerprint is silent, leave both alone.

## Documentation is part of the change

- **Every change ships with its docs in the same pass**, including intermediate
  steps -- the next person believes the docs. **Do not batch documentation to
  the end of a session**: later fits overturn earlier ones, and the rejected
  reasoning is the valuable part.
- **After any change that reverses a direction, grep the docs for the old claim
  and edit it.** Never append a newer claim beside an old one.
- **Write down decisions and rejected alternatives**, especially ones that look
  obviously right, and what a subtle bug looked like.

**Every document is in scope every pass -- checked by searching, not reading.**
Grep README.md, CONTRIBUTING.md and `docs/*.md` for the names, settings, numbers
and behaviours the change touched; read and edit the matching sections. **Name
in the reply the documents searched and judged unchanged** -- an unmentioned
file is indistinguishable from a forgotten one. What each holds:

- **RESEARCH.md** -- anything with a number: what the model does, what it is
  anchored to, what it measured, where it departs from its source.
- **TODO.md** -- open work at the top; finished work in `# Done` under a copy of
  its heading. Move a ticked entry there with what was built, **close any open
  entry the change made untrue**, and never nest an open item under a finished
  one.
- **PROJECT_HANDOFF.md** -- architecture, invariants and traps: what must stay
  true, and what breaks when it does not.
- **ARCHITECTURE.md** -- the short map. A new, removed or renamed file gets its
  line; a new invariant or trap gets ONE line naming the PROJECT_HANDOFF phrase
  to search. Keep it under about 40 KB and never the only home of anything.
- **BALL_BEHAVIOUR_KNOBS.md** -- which tuning value changes which ball
  behaviour. Requests are written against it; it goes stale fastest.
- **PROCEDURAL_GENERATION.md** -- what the generator produces, in order.
- **REFERENCES.md** -- every outside source behind RESEARCH and
  LANDSCAPE_RESEARCH.
- **PLAYING.md** -- everything a player can see, set or press.
- **README.md** (root) -- what the project is, how to build it, what the
  repository holds, what is claimed.
- **docs/README.md** -- the index; a document added, removed or renamed is not
  done until it says so.
- **INSTALLATION.md** -- how it is built, served or opened.
- **LANDSCAPE_RESEARCH.md** -- sources behind terrain, vegetation, architecture.
- **ATTRIBUTION.md**, **THIRD_PARTY_NOTICES.txt** -- any dependency or asset
  added, removed or upgraded.
- **DISTRIBUTION_REVIEW.md** -- the offline build, file-URL behaviour, bundle
  size, release claims.
- **RULES_HISTORY.md** -- a new rule's story, when an incident makes one.

## External research goes into RESEARCH.md, with its links

- **Record every outside source: the link and what was taken from it** --
  including ones read and rejected, so nobody repeats the dead end.
- **Record figures with units, not paraphrase.** Say where sources disagree and
  which was followed, and when a number was adapted rather than taken.
- **A source that cannot be fetched gets saved** under `docs/sources/` (local),
  with the passage used, and its figures, quoted in the RESEARCH.md entry.
- **Say plainly when a number is placed rather than published**, at the point it
  is created, so someone goes back for it.

## Leave no processes running

Run whatever verification needs inside a turn -- skipping verification to avoid
starting a process is the wrong trade. **Shut down everything you started before
the turn ends**, and check the port is actually free (a wrapper like `npx` can
leave its child running). Never end a turn with a server up and an offer to stop
it later.

## Ask before a graphics profile; never just run one

`npm run profile` is minutes of a machine at full load, and meaningless while
anything else uses the GPU. **Ask first, quoting the cost**: about 10 minutes
for a full sweep, about a minute for one group (`--only tiers`, `views`,
`biomes`, `ablation`, `pixels`, `water`, `sun` or `weak`).

- **Ask whenever a change could move a frame:** `renderer.js`, `graphics.js`,
  `vegetation.js`, `textures.js`, shaders, materials; a render pass, post
  effect, shadow or reflection; how much geometry exists or how it is batched;
  tier definitions.
- **Do not ask** for settings layout, menu text, docs, tests, tooling, scoring
  or generation (generation has `bench.mjs`).
- **Compare with `--since`** against `bench/profile-baseline.json`; re-save the
  baseline only for figures that should be defended from now on. Say which arm
  a number came from -- real GPU (headroom) or software rasteriser (no
  graphics card); they differ a hundredfold.
- **If the harness refuses because an idle page costs a whole frame, the harness
  is broken, not the check.**

## Drive the built game after touching anything a player can click

`npm test` cannot see the interface; **`npm run smoke` plays the built file in a
real browser** and fails on any uncaught error, `console.error` or network
request. **Run it after any change to `main.js`, `index.html`, `style.css`,
`renderer.js`, `popups.js`, `layout.js`, or anything the frame loop calls**
(about a minute). It proves it works, not that it looks right -- look too. **When it
fails, find out whether the game or the harness is wrong before changing
anything**; the screenshot in `bench/shots/smoke/` usually tells. Every journey
should be green, including `hud-reachable`, `phone-portrait` and
`phone-landscape`.

## Measure with `tools/bench.mjs`, not a throwaway script

It builds every course once, in parallel. Iterate on `--tier quick` (about 7
s), confirm on `--tier full`; `--set key=value` sweeps a control; `--save`
stores the baseline. **Run `--since` before and after any terrain-generation
change.** **A new metric imports its geometry from `src` and never
reimplements it** -- a recomputed check is how measurements here have lied.
**An `invariant` must be zero**; the harness names any offending course and
exits non-zero.

## Write to the owner in plain language

Say what changed, what it means for the game, and what it cost, in ordinary
words. No formulas or jargon unless they are the subject; numbers are welcome,
derivations are not. Name what the owner would notice ("the wait when a player
starts an 18-hole course", not "generation wall time"). Say plainly when
something did not work or made no difference. Detail belongs in RESEARCH.md;
the chat summary is for deciding what to do.
