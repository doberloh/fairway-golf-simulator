# Capturing pictures and clips of the game

Everything the website shows of the game -- the landscape pictures, the
interface screenshots, the background clips -- is made by the scripts in
`tools/capture/`, from the real game, on this machine. This page says what each
script makes, at what quality, how to run them without overloading the graphics
card, and the traps found while building them. It was written for the 1.0
website (18 October 2026), when the whole set was retaken at 4K.

The files land under `bench/shots/media/` (git-ignored), or wherever `MEDIA_OUT`
points. **They are never committed here.** The website is a separate, private
repository (`../fairway-website`, AGENTS.md *The website is not in this
repository*): a picture chosen for it is copied into its `site/media/` under a
**new** file name (the site tells browsers a media file never changes under its
name, so a retake saved over an old name stays stale in visitors' caches for a
week).

## The scripts

All of them except `contact-sheet.mjs`, `compare-rounds.mjs`, `overhaul-showcase.mjs`, `frame-grab.mjs` and `motion.mjs` need the capture
build first: `node tools/capture/build-hooked.mjs` writes
`bench/shots/dist-exp/index.html`, the real game plus three handles the scripts
drive it through (`__view`, `__takeShot`, `__play`), added while bundling so
`src/` is never edited. Rebuild it after any change to the game.

| Script | Makes | Quality |
| --- | --- | --- |
| `times.mjs [landscape…]` | Every landscape (ten since Lakeshore Dunes, `lakeshore-dunes`, 23 October 2026) at **morning, noon, golden hour and floodlit night**, no interface, no ball, no aim line, one camera per landscape so the four line up: `times/<landscape>-<time>` | 7680x4320 drawn, halved to a **3840x2160 PNG master**; 2560 and 960 JPEGs |
| `screens.mjs [screen…]` | **The 1.0 interface**: main menu, Play's steps, course of the week, challenges, Endless, saved courses, profile and locker, launch monitor, graphics, a round, the shot card, a putt being read (slope grid and heat map on; it fails rather than saves if the tee shot misses the green), the big map, pause, scorecard, a floodlit night, Haunted Hollow, the driving range, the course studio: `screens/<name>` | a 1920x1080 page at density 2, so the interface is laid out as on a 1080p screen and drawn at **3840x2160 (PNG master)**; 2560 and 960 JPEGs |
| `clips.mjs [clip…]` | Camera flights over each landscape, a tee shot, a floodlit night, Haunted Hollow at dusk, and a drive **with the round screen on**: `video/<name>.webm` + `.jpg` poster, `video/master/<name>.mp4` | **3840x2160 at 60 fps, recorded frame by frame**: an 80 Mbit/s H.264 MP4 master (for editing) and a 1920x1080, 8 Mbit/s VP9 WebM for the website |
| `gallery.mjs`, `features.mjs` | The 0.x website's pictures (two times of day per landscape; the old interface's feature shots) | 3840x2160 drawn, 2560 JPEG; kept for reference, superseded by `times.mjs` and `screens.mjs` |
| `angles.mjs <biome> <seed> [holes]` | Small test pictures of one landscape from twelve views per hole, and a contact sheet: for **choosing a camera** before a 4K set | 1280x720, about a second a view |
| `showcase.mjs <biome> <seed> [holes]` | **A landscape's showcase for the owner** (built for Lakeshore Dunes, 23 October 2026): three views per hole at noon and golden hour, the beach and the water if it has a sea, a close look at open sand away from play, two overviews, plus its `times.mjs` stills, the Blender contact sheets and a notes fragment (`bench/shots/showcase/<biome>/notes.html`) when they exist; lists every page error and `console.error` seen while it ran. One self-contained page, `docs/reports/<biome>-showcase.html` (local, never committed) | 1600x900 at density 1; about a minute |
| `contact-sheet.mjs <folder> [columns]` | Every picture in a folder as one image (`_contact.jpg`), to look a set over | -- |
| `overhaul-showcase.mjs [--after latest]` | The cartoon overhaul's showcase page in docs/reports/ (local), from what the other tools left under bench/shots/overhaul/ | -- |
| `wind-sequence.mjs <label> <biome> [--wind 22] [--cam <json>]` | The cartoon overhaul's wind check: one camera (`--cam`: window.lab.camera's fields, e.g. on a flag), a windy course, a still every so often | yes |
| `overhaul.mjs` options added by the late rounds | `--tier high` captures another graphics tier than Ultra; with `--homes`, `--houses 1,4` picks which houses (by their order in world.homes) the two house views look at | yes |
| `compare-rounds.mjs <biome> <label> <label> ...` | The cartoon overhaul's rounds side by side (`overhaul.mjs` sets); `--across <label> <biomes> --views a,b` one round over many landscapes | -- |
| `frame-grab.mjs <video> <seconds>` | One frame of a recording as a JPEG, to check a clip without a player | the video's own size |
| `motion.mjs <video.webm> [band] [--frames]` | **How smoothly the camera moves**, from the frames themselves: the jitter in each frame's shift against its neighbours, in pixels at 480 wide. CPU only. A band on the distant horizon (`74-130` on most clips) sees only the camera turning | a number per direction; a smooth flyover measures under about 0.012 |

`capture.mjs` is what they share (the browser, the game on Ultra with automatic
resolution off, the capture golfers, `saveStill`, `hourFor`, `gpuGate`);
`record.mjs` is the frame-by-frame recorder; `mux.mjs` writes the MP4 and WebM
files (tested in `tests/capture-mux.test.mjs`).

## How each is made at its best

**Stills, supersampled.** The game never draws more than its tier's pixel
ratio allows (Ultra: 2) times the page's density. A 3840x2160 page at density 2
draws 7680x4320; `saveStill` halves that twice-over in the browser to a
3840x2160 PNG, four samples a pixel, which is the cleanest 4K edge this renderer
can make. Pictures with the interface use a 1920x1080 page instead: the
interface is laid out for a 1080p screen, and at density 2 it is drawn at exactly
3840x2160.

**Clips, frame by frame** (`record.mjs`). Recording live gave whatever the game
managed in real time -- a slow frame was a stutter -- and 4K Ultra in real time
is more than a browser can draw and encode at once. Instead the page's clock is
stepped:

- `virtualClock` (installed before the game starts, `openGame(..., {virtualClock:
  true})`) takes over `requestAnimationFrame` and `performance.now`. While it is
  on nothing moves until `__vclock.advance(ms)` runs every waiting frame callback
  exactly `ms` later, so the game, the camera flight and a ball in the air all see
  a perfect 60 frames a second however long a frame takes to draw.
- Each frame is encoded in the page with **WebCodecs** (no ffmpeg on this
  machine): copied from the canvas to one `OffscreenCanvas` per output (all
  copies first, because a WebGL canvas is readable only until the page next
  draws to the screen), then encoded. The capture browser offers H.264, VP9 and
  AV1 at 3840x2160, 60 fps, in software (checked 18 October 2026; no hardware
  encoders, no HEVC).
- A clip with the interface (`recordPage`) photographs the whole page each frame
  instead, as a full-quality JPEG; about seven times slower.
- `mux.mjs` wraps the encoded frames: the MP4 with its index first ("fast
  start"), the WebM with cues. Every file is then opened in a `<video>` and must
  decode to its size and length, or the run fails.

**Times of day are sun heights, not clock times** (`hourFor` in capture.mjs):
each landscape's sun climbs to a different noon, and the warm light follows the
sun's height, so a fixed clock time is a different light in every landscape.
Night is 10 PM with the floodlights on.

## GPU batches

The owner plays games on this machine, and long runs of graphics work have
crashed it -- twice while gaming, and once while idle after long Playwright
sweeps (AGENTS.md *Nothing runs on the graphics card unless the owner asks*;
memory *GPU runs in small batches*).

- **Run only when the owner has said so in that conversation**, and never while
  `nvidia-smi` shows the card busy with something else.
- **Small batches**: one or two landscapes, a handful of screens, one or two
  clips per command. Every script takes names for exactly this.
- **`gpuGate()`** runs before each item: it rests six seconds (so batches are
  spaced), reads the card three times a second apart and takes the lowest (the
  instant one of our own items finishes, the card still reads busy with our
  work), and refuses to start above 80%.
- Measured 18 October 2026 on the RTX 4090, card otherwise idle: a landscape at
  four times, about 70 s; a screen, about 15 s; a 9-second canvas clip, about
  35 s; the 15-second interface clip, about 4 minutes.

## Picking and checking

- **Choose a camera with `angles.mjs` first.** The first 4K set had a tree
  filling the Midwest frame, a palm crowding the Island one and a Giant Redwood
  tee looking at a hillside; twelve small views per hole and a contact sheet
  found clean ones in a minute each.
- **Look at the contact sheet** of every set before using it, and at a few frames
  of every clip (`frame-grab.mjs`), and measure every flyover (`motion.mjs`):
  a camera can look fine in one still and shake in motion -- the interface clip once ended before the
  shot card came up and had to be made longer.

## From here to the website

The 1.0 website was redone this way (18 October 2026), and it is the way to
do the next retake:

1. **Here**: rebuild the capture build, take the set in small batches, look at
   the contact sheets and a few frames of each clip.
2. **In `../fairway-website`, on a branch of its own**: copy the chosen files
   into `site/media/` under new names -- the 1.0 set lives in `landscapes/`
   (from `times/`), `screens/` (from `screens/`, the `.jpg` and `-thumb.jpg`)
   and `clips/` (from `video/`, the `.webm` and `.jpg`; the MP4 masters stay
   here). Name them in the pages: the front page's markup, and the lists in
   `media.html`'s script.
3. `npm run site -- --game ../fairway/dist/index.html` there checks every file
   the pages name; look at it at desktop width and 390 px.
4. The website goes live only from a published release (`npm run deploy`
   there, after the owner asks), so the demo matches what the site shows.

Pages, styles and deploys are that repository's business (its AGENTS.md and
docs/DEPLOYING.md); nothing of the website is added back here.

## Traps found while building them

- **Never build a camera path from what `lab.camera` returns** (found 19 October
  2026, after the owner saw every website flyover shake). It returns the pose
  rounded to 0.1 m and 0.1 degree, for reading; the flyovers were built from
  those numbers, so the camera turned in a stop-start rhythm -- about four
  frames still, then three at triple speed, eight times a second -- in every
  clip since the first set (the 0.x live recordings too). `clips.mjs` now places
  each keyed pose with `lab.camera` and reads the exact pose back from the
  camera (`__view.targetPos`, `freeYaw`, `freePitch`), smooths every channel,
  and interpolates frames on a Catmull-Rom curve. Measured on the frames
  themselves (the distant horizon's frame-to-frame shift against its own
  running average): links-golden's sideways jitter fell from 0.055 to 0.007 px
  and its up-and-down from 0.032 to 0.003 px at 480 wide (`motion.mjs`); all
  ten flyovers were re-recorded: 0.005-0.011 px each (Midwest 0.018, where a
  tree passes close to the lens -- real motion) against 0.03-0.24 before.
  Giant Redwood was also re-routed: its old route flew through a fir's crown
  half a second in, which `motion.mjs --worst` showed as one big jump.

- **The capture golfers must be stored in the profile store's current format**
  (version 3). An older one is upgraded on load, and the upgrade announces "New:
  XP and levels" across the top of every picture.
- **`lab.course(settings)` starts a round for a placeholder golfer named
  "Bench"**; pass a group (`lab.course(settings, group)`) for pictures with the
  golfer chips. `screens.mjs` and `clips.mjs` pass Alex, Sam and Jordan, whose
  profiles `openGame` creates.
- **The driving range opens its controls window by itself**; press Escape before
  a picture. `lab.strike()` needs launch numbers set first; `__takeShot` (a
  launch-monitor shot) does not.
- **WebCodecs needs a secure page**: it is missing on `about:blank`, present on a
  `file://` page (which the game is).
- **A video from a file taints a canvas**, so `frame-grab.mjs` photographs the
  video element rather than reading it back.
- **Shell quoting mangles these scripts' backticks** (AGENTS.md *Check what an
  edit script wrote*): write them with an editor, not through `node -e`.
