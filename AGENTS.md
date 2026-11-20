# Working on Fairway

This file is loaded with every message, so it holds the rules and one line of
why each. The incidents behind them are in `docs/RULES_HISTORY.md`.

**Every document lives under `docs/`; `docs/README.md` is the index.** The root
carries only README.md, CONTRIBUTING.md, LICENSE and this file.

**Read `docs/ARCHITECTURE.md` first** (about 4 thousand tokens): the product,
every file, the units, the pipeline and the traps. **Never read
PROJECT_HANDOFF.md, DONE.md or RESEARCH.md whole** -- about 150, 165 and 280
thousand tokens. List headings (`grep -n "^## \|^### " docs/PROJECT_HANDOFF.md`),
search (`grep -n -i "<subject>" docs/*.md`), and read only matching sections.
TODO.md is open work only (about 5 thousand tokens, fine to read whole);
what was finished is in DONE.md. Search PLAYING.md the same way.

Preserve the portable offline single-file build, Cartoon-only graphics,
complete 9/18-hole landscapes, seeded procedural holes, real ball and cup
dimensions, and the current scoring formats. Keep terrain rendering, collision
heights, surface queries and map geometry consistent. Generation changes need
attention to old saved rounds and the GPU data textures. Use focused regression
tests, look at visual changes in the browser, and build before updating
archives. Physical launch-monitor testing waits until requested. A TODO entry
is not permission to widen an unrelated task.

## This branch: online play with friends (branch `online-play`, from 19 November 2026)

The owner, 19 November 2026: live matches with friends in other houses, no
accounts, everything kept on each player's own machine and shared when they
join, sessions private and safe. **The relay is Cloudflare's** (Workers with
Durable Objects, free plan; the owner's choice the same day), and the
security design in the plan is signed off. The plan, log and status page
are in `docs/studies/online-play/` (local and ignored, inside the worktree:
copy them to the main checkout before the worktree goes). **These terms are
the branch's own and end when it is merged**; what they decided becomes
main's, as the cartoon overhaul's did.

- **Earlier decisions about multiplayer, servers and network traffic may be
  overwritten or removed here** (the owner: "previous decisions about
  multiplayer. Network traffic. Etc. can be overwritten or removed"). That
  covers the 20 October "no servers" choice and IDEAS' turned-down entry,
  "the real game makes no network requests of its own" and smoke failing on
  any request, the September study's LAN-first advice, and the challenge
  codes' design. When one goes, the doc sweep still applies: grep for the old
  claim, edit it, and write down what replaced it and why.
- **It lifts nothing else.** Graphics card, gaming, push, merge, release, the
  editor tools and "no secrets in commits" hold as written below -- and a
  relay's address, keys or account names are secrets until the owner says
  otherwise.
- **Full test suites only when they are really needed** (the owner). Run the
  focused tests for what changed; `npm test` whole, or every smoke journey,
  only before a hand-over or merge, or when a change reaches widely enough
  that nothing narrower would catch it -- and say which was run.
- **The branch keeps a status page**, with screenshots as they come (captures
  follow *One job at a time while the owner games; otherwise no limit*).
- **Every way of running the game must play together** (the owner, 19
  November 2026): the file from disk, the website's demo, a phone that loaded
  the game from `run_fairway_server` over plain http -- with a launch monitor on
  that PC's bridge -- in any mix in one room. Anyone with a launch monitor is
  on a bridge. So nothing may lean on what only a secure page has
  (`crypto.subtle`); the sealing is the game's own code (`@noble/ciphers`,
  RESEARCH *Online play*).
- **Accounts, deploys and anything that costs money are the owner's steps**:
  creating a Cloudflare or Oracle account, deploying a relay, buying a domain.

## The cartoon look is main's (merged 27 October 2026)

The cartoon overhaul (25-27 October 2026; its rules are in
docs/CARTOON_OVERHAUL.md, its journal in docs/history/) redesigned every landscape, model, mowing pattern,
the water and the light, and is merged: it is what main looks like now. While
it was a branch it had two rules of its own -- every landscape free to move,
and the graphics card used without asking. **Both ended with the merge.**

- **A seed keeps its course again**: the ordinary discipline of *Two version
  numbers* holds. A change that moves ground needs its own reason and its
  `GENERATOR_VERSION` line, as before the overhaul.
- **What the overhaul set aside and kept is main's code now** -- the ground
  types' planting rule (`allows`), a faded creek end rising to its ground,
  the painted trees' far twins on High and Ultra, the tee surround measured on
  the open scatter. Each is listed, with how to undo it, in
  docs/CARTOON_OVERHAUL.md, *Rules set aside*. Nothing else is set aside.
- **The graphics card follows the permanent rule** (*One job at a time while
  the owner games; otherwise no limit*). `tools/gpu-run.mjs --goal <name>`
  still reads the card first and logs a run, for jobs worth a record.
- **Frame rate matters on every tier and every device** (the owner, 9
  November 2026, withdrawing the 26 October acceptance of the High and Ultra
  gap: "Large courses in the builder can tank framerates even on this PC").
  A change that adds cost to any tier is measured on it before it is called
  done.
- **Before more work on the look, read docs/CARTOON_OVERHAUL.md, *Working on
  the branch*** -- its capture views, how a round ran, and its lessons.

## Ideas live in IDEAS.md, and are read only when wanted

`docs/IDEAS.md` holds what could be built and nobody has decided to build;
TODO.md holds what is wrong, unfinished or owed a check. Keeping them apart
keeps the open list short enough to trust.

- **Do not read IDEAS.md unless** the owner asks what to build next, asks
  about an idea, or an idea is being added. It is not part of starting work.
- **A new idea goes in IDEAS.md, never TODO** -- a few lines: what, why,
  rough cost, where in the code, who and when. One that comes up during other
  work is added and mentioned in the reply, not built.
- **Picked by the owner:** it leaves IDEAS.md and becomes TODO work or a
  branch. **Turned down:** one line under *Turned down* with the reason, so it
  is not offered again. An idea is never permission to build it.
- **Skip it in the documentation sweep** below unless the change builds, kills
  or alters an idea in it.

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
- **A release's TODO entry replaces the last release's**, never sits beside
  it: only the newest release can be downloaded, so only it is owed a play.
  It heads *Play the current build by hand*; the old one goes to DONE.md.
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

## Three version numbers, and when to bump them

All live in `src/settings-schema.js`, and no test catches getting them wrong --
only old saves suffer. (A fourth, `ARCHITECT_VERSION`, went with the Architect
designer on 2 November 2026; an old Architect save's stamp never matches and
is shown the notice.)

- **`GENERATOR_VERSION`: bump whenever generated output changes for an
  unchanged seed**, however small -- terrain, routing, hazards, planting, water.
  Otherwise a saved round silently rebuilds different ground under a ball that
  has not moved. It is never migrated; the mismatch is shown to the player
  (`showVersionNotice`). A course keeps one stamp, `generatorFor(settings)`
  (a built course's is `BUILT_STAMP + BUILT_VERSION`), so never write
  `GENERATOR_VERSION` where a course's stamp is meant.
- **`SCHEMA_VERSION`: bump whenever a settings object changes shape** (a
  control added, renamed, removed or re-ranged), with a `MIGRATIONS` entry and
  a test that a save from the old version loads. Silent; never shown.
- **A new generation setting is one schema entry** (default, bounds, step, unit,
  category, help text) -- everything else derives from it; add no parallel
  default, slider or bounds list. It almost always bumps both numbers.
- **`node tools/biome-fingerprint.mjs --check` decides.** GROUND moved:
  `GENERATOR_VERSION` goes up. A RECORD change (name, palette, light) owes
  nothing. Run it on any change to `course.js`, `course-plan.js`,
  `streams.js`, `lakes.js`, `homes.js`, `vegetation.js`, `paths.js`,
  `clubhouse.js`, `story.js` or the other world pieces, and on changes that
  look unrelated.
- **A bump is two edits:** the number, and a line in the list above it saying
  what moved and why. **The entry's number is the version it produced**
  (`git log -S"GENERATOR_VERSION=<n>"` settles doubt).
- **No bump** for rendering, HUD, cameras, materials, audio, maps, the
  scorecard, tests or tooling. If the fingerprints are silent, leave them all
  alone.
- **`BUILT_VERSION` (since 31 October 2026): bump whenever a BUILT course** --
  a file from Fairway Course Builder, its land and outlines stored -- **would
  play differently for an unchanged file** (how the game bakes its surfaces,
  blends its greens, stands its trees). A built course never runs the
  generator, so the two numbers above cannot move it. docs/COURSE_BUILDER.md.

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
- **TODO.md** -- open work only (the owner, 12 November 2026). **A finished
  entry moves to DONE.md in the same pass**, under a copy of its heading, with
  what was built -- never ticked and left. **Close any open entry the change
  made untrue**, and never nest an open item under a finished one. An idea is
  not an entry (*Ideas live in IDEAS.md*).
- **DONE.md** -- the record of finished work, with its reasoning and dead
  ends. Searched, never read whole; added to, not rewritten.
- **`docs/history/`** -- the journals of finished branches, word for word
  (the owner, 12 November 2026). **Not part of this sweep and never edited to
  keep up**; search it when asking why something was done. When a journey
  merges, its page keeps what still governs later work and its round-by-round
  record moves here.
- **TESTING.md** -- what is tested and by which layer; a suite or smoke
  journey added, removed or changing what it covers.
- **IDEAS.md** -- what could be built; only when the change builds, kills or
  alters one of them.
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
- **BUILDER_GUIDE.md** -- the player's guide to the Course Builder, with
  screenshots, shipped in the zips as `Fairway Builder Guide.html`. Any
  change to the builder updates its words, and a changed screen retakes its
  pictures (`tools/capture/builder-guide.mjs`). (The owner, 10 November
  2026.)
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
- **A rule the spec left undefined and the build had to decide is marked PLACED
  too** -- where it is made, in RESEARCH, and in the spec's list of departures --
  so the owner can overrule it (a "par save", a long drive "in play").

## Leave no processes running

Run whatever verification needs inside a turn -- skipping verification to avoid
starting a process is the wrong trade (while the owner games, one at a time:
next section). **Shut down everything you started before
the turn ends**, and check the port is actually free (a wrapper like `npx` can
leave its child running). Never end a turn with a server up and an offer to stop
it later.

## One job at a time while the owner games; otherwise no limit

**Permanent** (the owner, 19 November 2026: "for the gpu usage rules. Only
single test or game running while I'm gaming. Else let it rip. Codify that in
the rules. And make it permanent."). It replaces every earlier rule that made
graphics work wait for the owner's word -- asking before smoke, captures, the
game in the browser pane or a profile; the "GPU allowed" `/goal` limits; each
branch's own no-ask terms -- and the 13 November "nothing at all while the
owner plays". RULES_HISTORY.md, *One job while gaming, otherwise let it rip*.
It holds in every turn, goal and branch, and needs no asking.

- **Read the card before starting work and between long jobs**: `node
  tools/gpu-gate.mjs` shows each program's share of the card by Windows' own
  counters; **one program taking 15% or more by itself is a game**. **Not
  `nvidia-smi`'s busy figure**: this card idles at a third of its clock, where
  a launcher and a chat window read 18 to 50% (RULES_HISTORY.md, *The gate
  read an idle card as busy*).
- **While a game runs: one job at a time, graphics or not.** A single test
  file or test run (`npm test -- --test-concurrency=1`), one smoke run with its
  journeys one after another, one capture, one profile group, one build, one
  bench, one Blender job, or the game in the browser pane -- never two at once,
  and no subagents running jobs beside it. A game that starts mid-run: let the
  current job finish, then carry on one at a time.
- **No game: let it rip.** Smoke, captures, the pane game, profiles, benches,
  Blender, parallel test runs and parallel agents run without asking, as many
  at once as the work needs.
- **Still true either way:** leave nothing running when the turn ends
  (browsers, pane tabs, servers, Blender; check the ports), and say which runs
  were made. Run `node tools/gpu-watch.mjs` beside long graphics work so a lost
  card leaves a record; **if the card drops** (17 hard reboots in 30 days up
  to 14 November, each within seconds of a program starting or ending work on
  it), stop graphics work, save what is open, and tell the owner.

## Graphics profiles

`npm run profile` is minutes of a machine at full load, and meaningless while
anything else uses the GPU -- so not beside a game, even as the one job; run
it when the card is free. About 10 minutes for a full sweep, about a minute
for one group (`--only tiers`, `views`, `biomes`, `ablation`, `pixels`,
`water`, `sun`, `weak` or `built` -- a seeded course against its frozen copy
on Low).

- **Profile whenever a change could move a frame:** `renderer.js`, `graphics.js`,
  `vegetation.js`, `textures.js`, shaders, materials; a render pass, post
  effect, shadow or reflection; how much geometry exists or how it is batched;
  tier definitions.
- **Not needed** for settings layout, menu text, docs, tests, tooling, scoring
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
(about a minute for the journeys touched, 5 for all; one job at a time while
the owner games, above). It proves it works, not that it looks right -- look too. **When it
fails, find out whether the game or the harness is wrong before changing
anything**; the screenshot in `bench/shots/smoke/` usually tells. Every journey
should be green, including `hud-reachable`, `phone-portrait` and
`phone-landscape`.

## A test copy may report back from the owner's phone

The owner, 17 November 2026: "Im totally fine with test builds passing
network traffic back to the server in the form of debug info! That makes my
job easier and then i dont need to copy paste things back to you."

- **When something shows on the owner's own device and not under test, measure
  it there before guessing.** Smoke's phone emulation is Chrome at two fixed
  sizes; it never saw a menu spread on a short screen or an iPhone's zoom on
  a typing box (RULES_HISTORY.md, *Measure on the owner's phone*).
- **`node tools/phone-probe.mjs`, on port 1923** (the bridge keeps 1922). It
  serves a copy of `dist/index.html` with a measuring script added. That
  copy sends back its layout readings, errors, console warnings and anything
  a `--script` file sends. Each one is written under `bench/probe/` and
  printed. Give the owner the address it prints.
- **Only the test copy reports.** The script is added as the page is served;
  never put it in `src/`, `dist/` or a release. The real game makes no
  network requests of its own, and smoke fails if it does.
- **The readings stay on this machine** (`bench/probe/` is ignored). They can
  hold the player's name from the screen.
- **It runs on the device, not this computer's graphics card.** The server
  itself counts as the one job while the owner games.
- **Stop it before the turn ends.** It also stops by itself after
  `--minutes` (30 by default). Check that the port is free.

## Built is not working

**A feature not seen working in the game is reported as not seen**: in the
commit message, in TODO's open work (what to check, and where), and in the
reply. Never describe interface work nobody has played as done -- the owner
plans testing from what the branch claims.

## Game rules live in pure modules with Node tests

**A new game rule goes in its own module, with no DOM or three.js, and a Node
test**; `main.js` only wires it in. A rule written straight into `main.js`
cannot be checked until someone plays it, and the game cannot always be played
(above).

**A new round format, or a change to how one is played, goes into
`tests/round-matrix.test.mjs`**, which plays every format with every group of
one to four. Formats are listed once, `FORMATS` in game.js; the matrix fails
until its scorer plays every one of them, so teach the scorer the rules (turn
order, how a hole and the round are won, which groups are refused) rather than
loosening the check. The owner cannot play four-golfer rounds quickly; this is
what stands in for it.

## Files are edited with the editor tools, never with shell one-liners

**Every change to a file goes through the Edit or Write tool.** No `sed -i`,
`node -e`, `python -c`, PowerShell `-replace`, or heredoc that writes a file.
A shell reads the text before the script does: inside double quotes, a
backtick runs whatever it encloses as a command, `\f` becomes an invisible
character, and backslashes vanish or double. The edit then fails, or
silently writes something else.

This was broken over and over by packing several edits into one
`node -e "..."` to save a step. On 15 November 2026 alone, a `node -e`
holding a doc's backticks ran stray commands twice, one of them a stray
course export. The same kind of command wrote an invisible character where
`godot\fly.cmd` should have been, and a `sed` silently did nothing.
RULES_HISTORY.md, *Edit scripts*, has the earlier incidents.

- **Many edits to one file:** one Edit call each, sent together in one
  message. No more round trips than a script, and nothing mangled.
- **A real transformation** (hundreds of lines, generated data): write the
  script to a file with Write, run it with `node <file>`, then read back what
  it wrote.
- **Shell commands stay for running things:** builds, tests, renders, git,
  reading. Never for writing a file, even "just one quick sed".
- **Commit messages** go in a file written with Write (`git commit -F
  <file>`). A `-m` string with backticks or backslashes is the same trap.
- **After any scripted write**, search the touched files for a backslash
  beside a backtick, control characters, and regex classes that lost their
  backslash (`d{`, `s+`, `w+` inside `/.../`). In regexes a script writes,
  prefer `[0-9]` to `\d`.

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
