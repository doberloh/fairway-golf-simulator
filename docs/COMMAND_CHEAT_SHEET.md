# Command cheat sheet

Every build and run command in the repository, grouped by what you would be
doing. All of them run from the repository root. The reasoning behind each
one lives in [CONTRIBUTING.md](../CONTRIBUTING.md), [AGENTS.md](../AGENTS.md)
and [INSTALLATION.md](INSTALLATION.md); this page is only the list.

The ones you will use most: `npm run dev` while working, `npm test` and
`npm run smoke` before committing, and `npm run release` for the downloads.
The website has its own repository and its own commands.

## Day to day

| Command | What it does |
| --- | --- |
| `npm ci` | Installs dependencies (first time, or after `package.json` changes) |
| `npm run dev` | Live dev server at http://127.0.0.1:5173, reloads as you edit |
| `npm run build` | Builds the game into `dist/index.html` (the single file) plus `dist/fairway-bridge.mjs` |
| `npm run preview` | Serves the built `dist/` locally to check the real build |

## Checking it works

| Command | What it does | Time |
| --- | --- | --- |
| `npm test` | All regression tests (physics, generation, scoring) | ~2 min |
| `npm run smoke` | Builds, then plays the built game in a real browser at nine screen sizes; fails on any error | ~3.5 min |
| `node tools/smoke.mjs --only endless-round` | One smoke journey, against the current build | |
| `node tools/smoke.mjs --list` / `--headed` | Lists the journeys / runs them in a visible window | |
| `node tools/biome-fingerprint.mjs --check` | Did course generation change for the same seed? If yes, `GENERATOR_VERSION` needs a bump | ~30 s |

The first time, `npx playwright install chromium` fetches the browser the
smoke test and the profiler drive; `npm ci` does not.

## Measuring

| Command | What it does |
| --- | --- |
| `node tools/bench.mjs --tier quick` | Course-generation measurements, fast (~7 s) |
| `node tools/bench.mjs --tier full --since` | Full run (~30 s), compared with the saved baseline |
| `node tools/bench.mjs --set blindTees=50` | Same, with one setting changed |
| `node tools/bench.mjs --tier full --save` | Stores a run as the new baseline |
| `npm run profile` | Graphics frame cost, full sweep (~10 min; ask first, per AGENTS.md) |
| `node tools/profile.mjs --only tiers --since` | One group (~1 min), compared with the baseline |
| `npm run gpu` | Reports what graphics card the browser sees |
| `node tools/flight-fit.mjs [--fit]` | The flight against Trackman's tour averages, a GC3 and the owner's R50, per source and club; `--fit` searches for better `AERO` constants; `--physics FILE` scores another physics file (an older copy placed in `src/`) for a before-and-after. Reads private data from `docs/sources/private/` |
| `node tools/landing-scorecard.mjs [--levers]` | Every bounce-and-roll anchor in one table (fairway run-out, green check, chip ratios, firmness), fixed Trackman tour shots, and what each tuning lever would do; `--set k=v,...` scores a candidate flight before it is applied |
| `node tools/landing-report/charts.mjs` / `clips.mjs` | Redraws the ball-landing report's charts and before/after clips (clips need two capture builds; see the file) |
| `node tools/landing-report/approach-plan.mjs` then `approach-clips.mjs`, `approach-page.mjs` | Plans, films and pages the fifteen chipping and approach clips (needs the capture build: `node tools/capture/build-hooked.mjs`) |
| `node tools/landing-report/shotmaking-plan.mjs` then `shotmaking-clips.mjs`, `shotmaking-page.mjs` | The same for the six shot-making clips; the plan prints what each shot did before anything is filmed |

## Launch-monitor bridge (from source)

| Command | What it does |
| --- | --- |
| `npm run bridge` | Runs the bridge from source (TCP 1921 for the monitor, HTTP 1922 for the game) |
| `npm run bridge:debug` | Same, printing every message in and out |

Environment settings it reads: `FAIRWAY_TCP_PORT`, `FAIRWAY_HTTP_PORT`,
`FAIRWAY_HTTP_HOST=all` (open it to phones on your Wi-Fi), `FAIRWAY_LOG=debug`,
`FAIRWAY_HTML` (which game file to serve).

## Releases

| Command | What it does |
| --- | --- |
| `npm run server` | Compiles `run_fairway_server` for Windows, both kinds of Mac, and Linux into `release/server/` |
| `npm run release` | Builds the game and the four servers, then packages all five zips plus checksums into `release/` (needs Python 3) |
| `gh auth status` | Says whether the GitHub CLI is signed in; `gh auth login` signs it in (once per machine, by the owner) |
| `gh release create v0.4 release/Fairway-*.zip release/RELEASE_SHA256.txt --target main --title "Fairway 0.4 (beta)" --notes-file docs/releases/v0.4.md` | Publishes a release with the zips, which the website's Download buttons then serve. **Only when the owner asks**, from `main`, with the version they name; never `--prerelease` (AGENTS.md, *Pushing to GitHub*) |
| `gh release list` | The releases published so far |
| `node tools/github-protect.mjs` | Puts the repository's safety settings in place (protected `main`, reviewed pull requests, permanent release tags, secret scanning) and lists any still waiting. **Run again the minute the repository goes public**; safe to run any time |

## Pictures and clips of the game

Saved under `bench/shots/media/` (not committed), or wherever `MEDIA_OUT` points. Heavy on the graphics card: ask the owner first.

| Command | What it does |
| --- | --- |
| `node tools/capture/build-hooked.mjs` | Builds a copy of the game with the hooks the capture scripts need (required before the three below) |
| `node tools/capture/gallery.mjs [name…]` | Retakes the landscape pictures (all of them, or just the ones named) |
| `node tools/capture/features.mjs [name…]` | Retakes the feature screenshots |
| `node tools/capture/clips.mjs [name…]` | Re-records the background clips |

## Art assets (rarely needed)

| Command | What it does |
| --- | --- |
| `npm run assets` | Rebuilds the asset contact sheet from `vendor/` |
| `npm run grove` | Regrows the redwood forest models and rebuilds the preview pages |
| `npm run sheet` | Builds the model-gallery page only |
