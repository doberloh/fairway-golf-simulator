# Fairway — a world of golf

A golf simulator that runs in a browser, offline, from a single file.

Open `dist/index.html` and you are on a tee. No installer, no account, no
network. Every course is generated from a seed: nine or eighteen holes routed
through one continuous landscape, with its own terrain, water, weather,
vegetation and light. Ball flight is integrated from real launch numbers, and
a launch monitor can drive it through the included bridge.

The built file is about 15.8 MB (6.5 MB gzipped) and contains the renderer,
the controls, the physics and every asset. It needs WebGL 2 and hardware
acceleration, and nothing else.

> **Status: experimental preview.** It plays, and it is enjoyable to play. It
> has not been verified against physical launch-monitor hardware, it has not
> been tested on every target device, and a weak GPU may not hold 30 fps at
> the lowest graphics tier. Known gaps are listed openly in
> [docs/TODO.md](docs/TODO.md).

## Play it

Download a release archive, unzip it, and double-click `Fairway.html`. That is
the whole procedure. [docs/INSTALLATION.md](docs/INSTALLATION.md) covers
device support, LAN and mobile access, and what to do when a browser refuses.

It lays itself out for the screen it is on, from a desktop down to a phone held either way up.

Once you are in, [docs/PLAYING.md](docs/PLAYING.md) is the manual: every
control, every course-studio setting, and the launch-monitor walkthrough.

## Build it

Node.js 22.12 or newer (developed on Node 26):

```sh
npm ci
npm run dev      # http://127.0.0.1:5173
npm test         # the full regression suite, no external framework
npm run build    # writes the single-file dist/index.html
```

Cutting the release archives is one more command, and it rebuilds first so
it cannot package a stale build:

```sh
npm run release
```

That needs Python 3 — the only part of the toolchain that does — and finds it
whether it is called `python3`, `python` or `py`. It verifies both archives
file by file against their inputs and writes `RELEASE_SHA256.txt`. If it
refuses, believe it: it refuses on a stale build, a missing embedded licence
notice, or a dependency inventory that disagrees with the lockfile.

No CDN, font service, telemetry or backend is contacted at any point, during a
build or during play.

## How it simulates

Everything inside is metres, seconds, kilograms and radians. Ball flight is
integrated at 240 Hz with a midpoint method and carries gravity, drag and lift
that vary with Reynolds number and spin, spin axis, spin decay, wind-relative
velocity, temperature and altitude. The bounce and the roll read the surface
underneath the ball, and putting runs on a Stimp-anchored rolling model.

Tree trunks are solid and foliage is not, so a ball can be behind a tree
without being stopped by a leaf; a trunk contact resolves the overlap and
reflects only incoming motion, which means a close lie is always playable.
Trunks on neighbouring holes count too. The ball is 42.67 mm across in the
physics and in the picture, because they are the same number.

**This is a research-informed implementation, not an empirically calibrated
replacement for a commercial simulator.** [docs/RESEARCH.md](docs/RESEARCH.md)
records every number, its source, and the places where the model knowingly
departs from that source.

Anything a player hits can be reported back: **Help & controls → Report a
problem** copies a block carrying the build, the device, the GPU, the frame
rate, the last few errors and the course code. It is assembled when the button
is pressed and copied to the clipboard, and it is never transmitted — the
built file makes no network requests at all, verified.

Verification is `npm test` — a few hundred regression checks on the Node test
runner covering physics plausibility and convergence, curvature, wind,
putting, penalties, scoring, generation invariants and the bridge protocol —
plus `npm run bench`, which builds courses in parallel and measures what the
generator actually produced, plus `npm run smoke`, which opens the built file
by `file://` in a real browser and plays it — menus, a hole from tee to holed
putt, a nine-hole round, the range, the studio — failing on any error and on
any network request. Physical launch-monitor hardware and gamepads remain
untested, and the smoke test runs Chromium only: Safari and Firefox are
checked by hand.

## Repository layout

| Path | What lives there |
| --- | --- |
| `src/` | The game. Generation, physics, rendering, interface — one module per concern, no framework |
| `tests/` | Regression suites for the Node test runner. `npm test` |
| `tools/` | Measurement, asset ingest, profiling and release packaging |
| `bridge/` | The optional local TCP/WebSocket bridge a launch monitor talks to |
| `bench/` | Saved baselines the measurement harnesses compare against |
| `vendor/` | CC0 model packs and the baked tree geometry ingested from them |
| `preview/` | Developer pages: the asset contact sheet and model gallery |
| `docs/` | Everything written down. Start at [docs/README.md](docs/README.md) |
| `dist/` | Build output. Not committed |

## Documentation

[docs/README.md](docs/README.md) is the index and says which document answers
which question. The four that matter most:

- **[docs/PLAYING.md](docs/PLAYING.md)** — the player's manual.
- **[docs/PROJECT_HANDOFF.md](docs/PROJECT_HANDOFF.md)** — the architecture,
  the invariants, and the traps. Read this before changing anything.
- **[docs/RESEARCH.md](docs/RESEARCH.md)** — every number in the simulator,
  what it is anchored to, and where it knowingly departs from its source.
- **[docs/TODO.md](docs/TODO.md)** — open work at the top, a changelog of
  what was actually built at the foot.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) is the short version: how to get set up,
how the project is verified, and the handful of rules that are not negotiable.
[AGENTS.md](AGENTS.md) is the long version, and is also the entry point for
coding agents.

## Licence

Fairway's own code and documentation are [MIT licensed](LICENSE) — share it,
modify it, sell it, fund it by donation, provided the licence and the
[third-party notices](docs/THIRD_PARTY_NOTICES.txt) travel with it.
Third-party components keep their own terms; all of them permit commercial
use. The notices are also embedded in the built HTML under **Help → Open
source & credits**, so a copy of that one file carries its own licences.

[docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) credits the imported artwork —
Kenney and Quaternius model packs, all CC0 — and records what was taken from
each. [docs/DISTRIBUTION_REVIEW.md](docs/DISTRIBUTION_REVIEW.md) is the dated
provenance audit, including the commercial-use pass.

GSPro, Garmin, Rapsodo and PiTrac are named in this project only to describe
what it can talk to. All trade marks belong to their owners, and no
affiliation, endorsement or certification is claimed or implied.
