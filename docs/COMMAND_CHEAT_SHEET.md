# Command cheat sheet

Every build and run command in the repository, grouped by what you would be
doing. All of them run from the repository root. The reasoning behind each
one lives in [CONTRIBUTING.md](../CONTRIBUTING.md), [AGENTS.md](../AGENTS.md)
and [INSTALLATION.md](INSTALLATION.md); this page is only the list.

The ones you will use most: `npm run dev` while working, `npm test` and
`npm run smoke` before committing, `npm run release` for the downloads, and
`npm run site` for the website.

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

## Website

| Command | What it does |
| --- | --- |
| `git lfs install --local && git lfs pull` | Once after cloning: downloads the real website pictures and clips |
| `npm run site` | Builds the game, then assembles `site-dist/` with the demo in `play/`; drag that folder onto Netlify to deploy by hand |
| `node tools/site-media/build-hooked.mjs` | Builds a copy of the game with the hooks the capture scripts need (required before the three below) |
| `node tools/site-media/gallery.mjs [name…]` | Retakes the landscape pictures (all of them, or just the ones named) |
| `node tools/site-media/features.mjs [name…]` | Retakes the feature screenshots |
| `node tools/site-media/clips.mjs [name…]` | Re-records the background clips |

## Art assets (rarely needed)

| Command | What it does |
| --- | --- |
| `npm run assets` | Rebuilds the asset contact sheet from `vendor/` |
| `npm run grove` | Regrows the redwood forest models and rebuilds the preview pages |
| `npm run sheet` | Builds the model-gallery page only |
