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
| `npm run build` | Builds the game into `dist/index.html` (the single file), Fairway Course Builder into `dist/builder.html`, plus `dist/fairway-bridge.mjs` |
| `node tools/built-compare.mjs --file <course.fairway> --dem <dem.tif> --osm <osm.json> --scorecard <card.json>` | Measures a real course's saved file (door 2) against a bare-earth DEM, OpenStreetMap's outlines and the club's card, and plays a test round |
| `node tools/builder-smoke.mjs` | Drives the built course builder (`dist/builder.html`) by file:// in a real browser; fails on any error or network request. `--only <journey>`, `--list`. Uses the graphics card (docs/COURSE_BUILDER.md) |
| `npm run preview` | Serves the built `dist/` locally to check the real build |

## Checking it works

| Command | What it does | Time |
| --- | --- | --- |
| `npm test` | All regression tests (physics, generation, scoring), longest files first | ~3.5 min |
| `npm run test:changed` | Only the test files a change since the last commit can reach (`node tools/test.mjs --changed main`: since main) | seconds to minutes |
| `npm run test:fast` | The 81 test files that build no course (rules, ball, scoring, saves) | ~2 s |
| `npm run test:times` | The whole suite, then stores each file's time for the ordering | ~3.5 min |
| `npm run smoke` | Builds, then plays the built game in a real browser at nine screen sizes; fails on any error | ~3.5 min |
| `node tools/smoke.mjs --only endless-round` | One smoke journey, against the current build | |
| `node tools/smoke.mjs --list` / `--headed` | Lists the journeys / runs them in a visible window | |
| `node tools/ui-audit.mjs` | Every screen at sixteen sizes, checked for layout bugs (overlaps, cut-off text, off-centre, two highlights, small targets, contrast, small text); pictures and a report in `bench/shots/ui-audit/<out>/`. Needs the capture build (`node tools/capture/build-hooked.mjs`); `--quick` five sizes (a round of fixes), `--sizes`, `--screens`, `--jobs` (sizes side by side, default 4), `--game`, `--out`, `--list`; a contact sheet per screen in `sheets/`. Uses the graphics card | ~14 min all, ~5 quick |
| `node tools/ui-motion-check.mjs` / `ui-motion-frames.mjs` | The menus' animations: lengths, cheap properties, interrupted ends whole, nothing under reduced motion / each stopped at six moments and pictured | ~1 min |
| `node tools/capture/ui-polish-showcase.mjs` | The 1.0 polish's before-and-after page for the owner, from the audit's pictures (local) | seconds |
| `node tools/ui-pad-check.mjs [--only 390x844] [--game f]` | A pretend controller at six sizes: the d-pad through the menus and the pause list, A into a round, B and Start | ~3 min |
| `node tools/ui-movable-check.mjs [--only 390x844]` | The map and the shot numbers dragged in a round at six sizes: they move, stay on screen, and a double click puts them back | ~2 min |
| `node tools/ui-flows.mjs [--game f] [--paths before|after]` | Presses from the main menu into each mode, by mouse and by keys (the game's own focus rule); fails a path the keys cannot finish | ~2 min |
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
| `node tools/ball-bench.mjs` | **The ball against real measurements**: 148 checks in a second, each naming its source (flight, firm-green landings, club run-outs, spin, chips, fairway, Stimp, putts, break, the hole, slopes). `--only greens,cup`, `--list`, `--json out.json`, `--set green.mu=.55,.45,.4` (try a constant without writing it), `--shot 120,16.3,7097` or `--land 22,51,9100[,surface[,slope%]]` (one shot hop by hop on each firmness), `--stimp 12`. Exits 1 on any failure. docs/BALL_PHYSICS.md |
| `node tools/meter-landings.mjs [--sweep] [--stimp 12]` | **What the Swing Meter's shots do when they land**: every club hit at a green, at stock spin and with spin added, on soft, medium and firm, and out of the rough; `--sweep` finds the furthest any stock-spin shot comes back. A few seconds; the table in docs/BALL_PHYSICS.md, *The strike*, is its output |
| `node tools/ball-paths.mjs [--against path/to/other/src/physics.js] > paths.html` | Pictures (SVG, processor only) of a ball from its pitch mark to rest: a drive, a 7 iron, a spun wedge and a chip, this checkout's ball against another's when asked |
| `node tools/flight-fit.mjs [--fit]` | The air model against the published flights (`tools/flight-targets.mjs`: TrackMan's normalised 6 iron, its driver chart, the 2023 tour averages) and, when present, the owner's GC3 and R50 sessions (`docs/sources/private/`), with their sideways finish beside the model's; `--fit` searches for better `AERO` constants and prints them; `--keys`, `--driver N`, `--hang W`, `--land W`, `--set k=v` |
| `node tools/landing-report/charts.mjs` / `clips.mjs` | Redraws the ball-landing report's charts and before/after clips (clips need two capture builds; see the file) |
| `node tools/landing-report/approach-plan.mjs` then `approach-clips.mjs`, `approach-page.mjs` | Plans, films and pages the fifteen chipping and approach clips (needs the capture build: `node tools/capture/build-hooked.mjs`) |
| `node tools/landing-report/shotmaking-plan.mjs` then `shotmaking-clips.mjs`, `shotmaking-page.mjs` | The same for the six shot-making clips; the plan prints what each shot did before anything is filmed |
| `node tools/landing-report/spin-plan.mjs` then `spin-clips.mjs`, `spin-page.mjs` | The spin-back report: a wedge across launch spin and green firmness on a flat green, measured and filmed for each version of the physics named in `SPIN_BUILDS`, rows picked with `SPIN_ROWS` (wedge, steep, 7 iron, pitch, driver into a fairway), output folder `SPIN_OUT` (see the file); about 20 s of High-tier rendering per clip |

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
| `gh release create v0.5 release/Fairway-*.zip release/RELEASE_SHA256.txt --target main --title "Fairway 0.5 (beta)" --notes-file docs/releases/v0.5.md` | Publishes a release with the zips, which the website's Download buttons then serve. **Only when the owner asks**, from `main`, with the version they name; never `--prerelease` (AGENTS.md, *Pushing to GitHub*) |
| `gh release list` | The releases published so far |
| `node tools/github-protect.mjs` | Puts the repository's safety settings in place (protected `main`, reviewed pull requests, permanent release tags, secret scanning) and lists any still waiting. **Run again the minute the repository goes public**; safe to run any time |

## Pictures and clips of the game

Saved under `bench/shots/media/` (not committed), or wherever `MEDIA_OUT` points. Heavy on the graphics card: ask the owner first, and run small batches. **docs/CAPTURE.md** has the whole story (quality, batches, traps).

| Command | What it does |
| --- | --- |
| `node tools/capture/build-hooked.mjs` | Builds a copy of the game with the hooks the capture scripts need (required before the scripts below). `SWAP="src/physics.js=<file>"` builds it with another version of a source file, for a before/after without editing src/ |
| `node tools/capture/times.mjs [landscape…]` | Every landscape at morning, noon, golden hour and floodlit night, no interface: 4K PNG masters (drawn at 7680x4320) and website JPEGs |
| `node tools/capture/screens.mjs [screen…]` | The 1.0 interface, screen by screen, at 4K |
| `node tools/capture/clips.mjs [clip…]` | The clips, recorded frame by frame at 3840x2160 and 60 fps: an 80 Mbit/s MP4 master and the website's 1080p WebM, each checked to play |
| `node tools/capture/angles.mjs <biome> <seed> [holes]` | Small test pictures from many views, for choosing a camera |
| `node tools/capture/showcase.mjs <biome> <seed> [holes]` | A one-page showcase of a landscape for the owner (`docs/reports/<biome>-showcase.html`, local): holes at noon and golden hour, the coast, a close look at its ground, an overview, its 4K stills and Blender sheet if made, and any page error seen while capturing |
| `node tools/capture/biome-shots.mjs take` / `encode` | The landscape pictures on the cards: candidates at Ultra, then the picks as WebP into `src/shots/` (docs/CAPTURE.md) |
| `node tools/capture/contact-sheet.mjs <folder>` / `frame-grab.mjs <video> <s>` | One image of a whole set; one frame of a clip |
| `node tools/capture/motion.mjs <video.webm> [74-130]` | How much a clip's camera shakes, measured from its frames (CPU only); under about 0.012 is smooth |
| `node tools/capture/gallery.mjs` / `features.mjs [name…]` | The 0.x website's pictures (superseded by times and screens) |

## Sounds

| Command | What it does |
| --- | --- |
| `node tools/sound-lab/build.mjs` | Writes the listening report, `docs/reports/sounds/index.html`, and the water options, `water.html` beside it (local): every sound with takes, sliders and a notes box; opens straight from the file. Also `chiptune.html`: the 1.0 interface's chiptune, family C, for signing off |
| `node tools/sound-lab/check.mjs [--seconds 60]` | Renders every sound offline in a headless browser and prints peak and average level, length, event and bird-song counts for every strike, landing, score sting and ambience; fails on a silent, broken or NaN sound, or if two birds ever sing at once. A long `--seconds` takes minutes |

## Art assets (rarely needed)

| Command | What it does |
| --- | --- |
| `npm run assets` | Rebuilds the asset contact sheet from `vendor/` |
| `npm run blender -- <pack> [--render]` | Rebuilds a Blender-built model pack (`tools/blender/<pack>.py`, e.g. `cartoon_lakeshore`) into `vendor/blender-<pack>/`; `--render` adds a contact sheet in `bench/shots/blender/`. Needs Blender installed. Then `node tools/build-meshes.mjs`. docs/BLENDER_ASSETS.md |
| `node tools/build-meshes.mjs` | Ingests every picked model in `vendor/` into `src/asset-meshes.js` |
| `node tools/mid-cells.mjs` | Writes `src/mid-cells.js`: the grid each tree's middle version (High and Ultra) is made on, the coarsest that keeps its outline. Run after a model changes or a tier's `midTrees` does; `--check` says if it is out of date (a test runs that), `--list` what each model got |
| `node tools/gpu-gate.mjs [seconds]` | Says what the graphics card is really doing (each program's share by Windows' counters, beside nvidia-smi's misleading idle figure) and whether a run may start |
| `node tools/frame-sweep.mjs --goal <goal> --a <old build> --b dist/index.html` | Compares two builds on every landscape, High and Ultra, one run after another through the gate, and prints a table (`--table` prints it again from the saved runs). About two and a half minutes a landscape and tier |
| `npm run sheet` | Builds the model-gallery page only |
