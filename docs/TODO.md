# Fairway improvements and TODO

**This file is a changelog as much as a list.** Completed entries keep their
reasoning, including the dead ends, because knowing what was ruled out and why is
worth more than a tidy list. An entry marked RESOLVED, FIXED or SUPERSEDED stays
so the next reader does not repeat the work.

**An open checkbox is a claim about the code as it stands right now.** If a change
makes an entry untrue, close it in the same pass and say what replaced it. One
entry here once asserted the exact opposite of what the physics did, which is how
a correct behaviour nearly got "fixed" back into a bug.

**Open work is above; everything finished is in `# Done` at the foot of the
file.** Nothing was deleted and no entry lost a word -- a section that held both
kinds keeps its heading in both halves, so a finished entry still says which
piece of work it belonged to. Where an open item had been left as a note under a
finished one, it was promoted to an item of its own and carries a breadcrumb
back; live work nested inside the archive is the thing this split exists to
prevent.


## Found by driving the built game

What `tools/smoke.mjs` turned up on its first full runs, and what building it
turned up alongside. The one outright crash is fixed and recorded under the
same heading in `# Done`.

- [ ] **The studio and the tool windows have not been swept for layout.**
  `hud-reachable` covers the main menu and the play screen at nine sizes, and
  every menu panel and tab is opened on a phone both ways up. The studio bar,
  and the floating tool windows during play, are not checked for overlap the
  same way. The studio bar visibly sits over the lower edge of the Saved
  courses panel at 1920x1080; its name box cleared it in the one case looked
  at.

- [ ] **The flag marker and the aim marker overlap on screen.** "340 YARDS TO
  HOLE" sat on top of "257 TO AIM POINT" in the 1280x720 and 1366x768 captures
  taken during the layout work. The aim marker steps aside when the two POINTS
  are within 8 m of each other on the ground; it never checks whether the two
  LABELS overlap on screen, which from the tee they often do. Not changed:
  separate from the layout, and it wants a look at which should give way.

- [ ] **Nobody has measured a real phone.** The layout is checked under
  emulation at a phone's size; the GPU is not. The low tier's known weakness on
  weak hardware is the whole first impression on a phone, and the owner's own
  phone and iPad test is the next data point. The tester diagnostic reports
  the tier and the frame rate, so that test produces numbers.

- [ ] **The CI smoke step has never run on GitHub.** There is no remote yet,
  so it has been proven locally with `--software` and not on a runner. A
  runner has two to four cores against the 32 it was measured on; the job
  has a 45-minute ceiling and every smoke wait scales twelvefold without a
  GPU. If the first push fails there, look first at Chromium's system
  libraries (which `--with-deps` installs) and at a timeout.

- [ ] **What the smoke test does not walk is still checked by hand:**
  multi-player rounds, match play and scramble selection, the lab, the
  launch-monitor panel against a live bridge, a round saved and continued,
  free flight on a phone, Safari and Firefox, and any REAL phone or tablet --
  the phone journeys run in a browser that emulates one.

- [ ] **ACCEPTED AS IS, 23 September 2026. The hole flyover flies through the
  trees, and has since redwoods landed.** Owner's call: not worth changing for
  now. Left open because it is still true, NOT because it is waiting on
  somebody -- do not pick this up as pending work, and do not re-report it as a
  new discovery. Reopen it only if the flyover starts looking wrong on screen.
  Same stale assumption as the arrival pose had; fixing it is a framing decision
  rather than a one-line clamp. `makeHoleTour` clears TERRAIN by 34 m and never
  looks at the canopy. Measured against real canopy, worst gap per biome over
  nine holes each: **redwood -91.1 m** (tallest canopy 186 m), **mountain -0.0 m**
  (128 m), pnw +5.5 m (82 m). So on a redwood course the flyover orbits inside
  the forest. The file's own comment says a flyover that skims treetops reads as
  a bug -- this one is ninety metres past skimming. The fix is not simply lifting
  the ring: a 200 m orbit is a different shot. Growing the radius instead, or
  both, needs a look on screen.

- [ ] **Generation is still ~24% slower in wall time than it was.** The blocking
  work is unchanged at ~7.0 s for an 18-hole feature-heavy course; the extra is
  the frame handed back at each pause, and it is the price of the overlay moving
  at all. Worth revisiting only if the grid itself gets cheaper -- at 81% of the
  work it is where any real win is, not in the pacing.

- [ ] **Progress is weighted by measured cost, not by real-time feedback.** The
  PHASE table in course.js and LOOP_WEIGHT in terrain-grid.js were fitted to one
  profile on one machine. A very different course shape could make the bar
  advance unevenly. It cannot stall or go backward -- there is a test for both --
  but it is an estimate wearing a percentage.

## Reading a green without the overlays

- [ ] **Bands that follow the contour may alias at distance, and this has not
  been tested on screen.** The anti-alias fade is measured on the PLAN coordinate
  deliberately -- measuring it on the bent one once made bands vanish on exactly
  the slopes they describe -- so raising the bend raises the frequency without
  the fade knowing. It briefly defaulted to definition 100, bending at 4.57x --
  well past the 3.5x this was written about. The owner then set 35, which bends
  at 2.25x, below it again, so the risk is back to modest; it matters again if
  anyone raises the slider.

## Tee boxes: what was wrong, and what was not

Reported from play on 2026-09-25, with an instruction to measure before
changing anything. Worth it: one of the three assumptions was wrong.

- [ ] **23 blind tee shots remain and every lever is a trade.** Lifting tees or
  flattening the landing area, both of which the owner ruled out in principle
  ("without building up too much land"). Needs a decision rather than a fix.

- [ ] **No picture of a tee complex from above.** The overview camera frames the
  whole course from very high with clouds in the way, so the stagger is
  evidenced by numbers rather than by an image. A camera that frames one tee
  complex would be worth having for exactly this.

## Playing on a phone

- [ ] **Owner: the launch-monitor panel with a real device.** It is checked
  against a pretend bridge that sends what `bridge/server.mjs` sends. A real
  connector may report the ball differently -- or never -- and the big numbers
  wait for the monitor to see the next ball.

## On a phone's home screen

- [ ] **Owner: run_fairway_server on a real Mac and a Linux machine.** Built
  and packaged from Windows (ad-hoc signed for macOS, checked in the binary)
  and tested on Windows only. On a Mac: unzip, Control-click Open, allow it in
  Privacy & Security if asked, and check it serves the game and prints a phone
  link. On Linux: `./run_fairway_server` from a terminal.

- [ ] **Owner: a launch monitor from the iPhone, loaded from the bridge.**
  Start the bridge with `FAIRWAY_HTTP_HOST` set to the computer's address,
  open `http://<address>:1922` on the phone, **Launch monitor** in the main
  menu, Connect bridge, arm, hit. Checked in emulation against a pretend
  bridge; the first real test is the owner's. If the phone cannot reach the
  computer at all: same Wi-Fi (not a guest network), and Settings > Privacy &
  Security > Local Network.

- [ ] **It needs a connection every time it opens.** Offline play is a service
  worker that keeps a copy of the game on the phone: about thirty lines, plus a
  cache named by the build stamp so an update replaces the old copy cleanly,
  plus a smoke journey that goes offline and reloads. It must never register
  when the file is opened from disk.

## Getting the word out

Planned on 2026-09-25. The decisions below are the owner's and are recorded so
the next person does not reopen them.

**Decided already.** The project **goes open source at launch, under MIT**,
free, with a donation button. No Discord and no social accounts yet. The owner
holds the copyright outright, which is what made the choice free to make in
either direction and what keeps a later change possible.

This reversed an earlier plan to keep the source closed, made two days into
the same week -- read the MIT entry below for what was weighed. The open item
that used to sit here saying MIT was the wrong licence is closed, because the
premise it rested on (closed source) is gone: MIT and a public repository are
a coherent pair, which closed source and MIT were not.

**The one structural fact the plan turns on: there are two audiences and they
need opposite timing.**

*Simulator owners* -- the people who might eventually donate -- care first and
only about whether it works with their launch monitor. That is currently the
weakest claim in the project: nothing has been verified against physical
hardware, and that community establishes it within minutes. Going there now
spends the one first impression on the worst feature.

*Developers and procedural-generation people* cost nothing to reach, amplify
hard, and do not care about launch monitors at all -- they will hit a ball
with the keyboard. "A golf simulator that generates infinite courses and runs
from a single 15.8 MB HTML file, offline, no install" is a real story for that
audience, and their attention is what buys credibility with the first one.

**So the order is: developers now, simulator owners after hardware
validation.** That sequencing is the plan; the channels are details.

- [ ] **Owner: fill in the website's placeholders.** The four download
  buttons point at `#download` and answer "opens with the beta" when clicked;
  give each `href` in `site/index.html` the hosted zip's address. The donation
  button is a disabled placeholder until the payment links exist. Both are
  marked `OWNER:` in the page. Keep the donation wording inside the limits in
  the entry below.

- [ ] **Owner: the website on a real iPhone and in Safari.** It was checked in
  Chromium only, at desktop and phone sizes. The background clips are WebM,
  because no video encoder exists in this toolchain; a browser that cannot play
  WebM shows each clip's still, which is the designed fallback but has not been
  seen on an iPhone. If the stills look wrong there, the fix is MP4 copies of
  the five clips (any encoder), listed as a second `<source>`.

- [ ] **Rework the website's ball physics wording.** Asked for by the owner on
  2 October, with what it should say still to be decided. As it stands the
  panel reads "Ball flight fitted to real launch monitors" and quotes the GC3
  fit (carry 1.3%, peak height 0.2 ft, offline 0.2 yd) with SkyTrak as the
  held-out check; the owner accepted "fitted" over "calibrated". Whatever
  replaces it has to stay inside what RESEARCH.md can back -- see *The
  website: what it claims*.

- [ ] **Export the range's shot data.** The owner's copy for the website's
  practice panel said "view and export your shot data"; the game has no such
  export (it downloads the scorecard, saved rounds and courses, and nothing
  else), so the page says "view your shot data" until it does. The shot list
  already holds every shot of the session. When it exists, put "and export"
  back in `site/index.html`.

- [ ] **Owner: set `GIT_LFS_ENABLED` = `true` in the Netlify UI** before the
  first deploy from the repository. The website's pictures and clips are in
  Git LFS, and Netlify only fetches them with that variable set, which it reads
  before cloning and so cannot take from `netlify.toml`. Without it the build
  stops with a message saying exactly this. Not needed for a drag-and-drop
  deploy of a locally built `site-dist/`.

- [ ] **At launch: take the website's no-index off.** Three places, removed
  together: the `robots` meta tag in `site/index.html` and `site/media.html`,
  the `X-Robots-Tag` header in `netlify.toml`, and `site/robots.txt`.

- [ ] **Ten testers, recruited one message at a time.** Not a launch -- a
  request for help, which is a different thing and gets a far better response
  rate. With the repository public, Issues is where their reports should go;
  that does not remove the need for the diagnostic block, because the thing a
  tester cannot paste is the thing that is missing, not the place to paste
  it. Go where these people already are instead of asking them to come to
  you: the golf-simulator subreddits, GolfSimulatorForum, the GSPro community,
  the home-simulator Facebook groups, and the owner communities for each
  specific monitor. **Check which of those are actually alive first**; this
  list was written from general knowledge, not from looking.

- [ ] **Validate against real hardware before approaching simulator owners.**
  It is the first thing that audience checks and the weakest claim the project
  makes: nothing has been tested against a physical launch monitor, and the
  extra fields the shot-data grid can display -- club speed, attack angle,
  path, face to target, closure rate, impact position -- are parsed but have
  never been checked against a real session. Recorded here as the gate, not as
  a plan: how it gets done is the owner's call.

- [ ] **Then one public moment, not a drip.** Hacker News, the procedural
  generation and WebGL communities, the three.js showcase, and the simulator
  forums -- same week, one post each. **Lead every one of them with the play
  link, not the repository.** Open source is what makes the developer half of
  that audience take it seriously, but nobody has ever been convinced by a
  LICENSE file: they are convinced by being on a tee ten seconds after a
  click, and they look at the source afterwards. "Show HN" with a repository
  link under a play link is the right shape; a repository link alone is not.

- [ ] **Donation wording is the part that carries risk, not the licence.**
  Recorded in DISTRIBUTION_REVIEW and worth repeating here because it is
  written at the moment the page goes up: do not imply a donation is required
  to play, unlocks anything that already works, buys promised hardware
  compatibility, or reaches the third-party authors. Quaternius asks that
  support go through their Patreon and Kenney appreciates credit; neither is
  an obligation, but a donation page for a game built on their free work must
  not read as though the money reaches them.

## Making the repository public

Asked for on 2026-09-25: organise the tree and the documentation for a public
GitHub repository, and stop shipping what nobody needs.

- [ ] **There is still no PUBLIC remote, and that is now the last thing
  standing between this tree and a published project.** A private one exists
  since 2 October -- https://github.com/doberloh/fairway, `origin`, every
  branch pushed, the website's media in its Git LFS storage -- so making it
  public is a settings change on GitHub once the document plan below and the
  name are settled, not a migration. The licence is
  settled: MIT, open at launch -- see "Getting the word out". `LICENSE` names
  Dustin Oberloh, who holds the copyright outright, which is what made that
  choice free to make; a project with outside contributors cannot change its
  licence without asking every one of them, and "Fairway contributors"
  implied exactly that situation.

  One thing to settle in the same sitting, because publishing makes it
  expensive to change: the NAME, which has its own entry and blocks the
  repository as much as it blocks a domain. (`vendor/baked_assets/`, the
  other one, was settled on 30 September: not committed.)

- [ ] **Fewer, smaller documents before the private repository goes up.
  PLAN ONLY -- asked for 1 October, nothing has been moved yet.** Today the
  repository carries 19 Markdown files and about 1.5 MB of them, and three
  hold almost all of it: RESEARCH.md (5,800 lines, 500 KB), TODO.md (3,500
  lines, 330 KB, four fifths of it the `# Done` archive) and PROJECT_HANDOFF.md
  (1,800 lines, 310 KB). The trouble for someone arriving with an AI agent is
  not the NUMBER of files but that the entry point -- AGENTS.md, then
  PROJECT_HANDOFF -- asks for 330 KB of reading before any work starts, most of
  it dated narrative. The aim: an agent is oriented after reading two short
  files, finds anything deeper by search, and no reasoning is lost.

  Proposed shape: 19 files down to 16 -- the count matters less than the size,
  which falls from about 330 KB of entry reading to under 80 KB:

  | Keep / become | From | Change |
  | --- | --- | --- |
  | README.md, LICENSE | same | unchanged |
  | AGENTS.md | AGENTS.md + CONTRIBUTING.md | one rules file; CONTRIBUTING's setup commands move into it, and README links to it |
  | docs/ARCHITECTURE.md | PROJECT_HANDOFF.md | cut to the invariants, the traps and the file map, each a few lines with a pointer into RESEARCH or HISTORY; target under 60 KB. The dated "on 30 September the owner asked..." narrative moves to HISTORY.md |
  | docs/RESEARCH.md | RESEARCH.md + LANDSCAPE_RESEARCH.md | one evidence file with a contents list at the top; the landscape sources become its last part |
  | docs/BALL_BEHAVIOUR_KNOBS.md | same | kept apart on purpose: it is what a tuning request is written against, and inside a 500 KB file it would be buried |
  | docs/GENERATION.md | PROCEDURAL_GENERATION.md | renamed only |
  | docs/TODO.md | the open half of TODO.md | open work only, about 60 KB |
  | docs/HISTORY.md | TODO's `# Done`, PROJECT_HANDOFF's narrative, DISTRIBUTION_REVIEW's dated addenda, both docs/reports/ | the changelog and the record of why. Nothing is deleted, only moved; it is the file that answers "was this tried?" |
  | docs/PLAYING.md, docs/PORTABLE_README.md | same | both ship to players |
  | docs/INSTALLATION.md | same | trimmed where it repeats PORTABLE_README |
  | docs/REFERENCES.md, docs/ATTRIBUTION.md | same | the citations, and the asset credits every download carries |
  | docs/DISTRIBUTION_REVIEW.md | its current-status part | the standing release checklist; the audit history goes to HISTORY |
  | docs/README.md | same | rewritten as a "which question, which file" table |

  `docs/sources/README.md` stays where it is: it states the rule for the
  ignored private folder.

  Before anything moves:
  - **Scrub for what a private repository still should not hold**: machine
    paths and user names (`C:\Users\...`), email addresses, and anything
    naming what is in `docs/sources/private/` -- which stays ignored and is
    never inventoried, per the rule in `.gitignore`.
  - **The website's media is settled**: Git LFS, chosen by the owner on 2
    October. Make sure the private repository has LFS on, and check the
    first set's 18 MB, committed as ordinary files before the switch, is
    acceptable to carry (it is in the history either way).
  - **One branch per step**, in this order: AGENTS + CONTRIBUTING; HISTORY.md
    (pure moves); the ARCHITECTURE cut; RESEARCH + LANDSCAPE; the index. A
    pure move is reviewed with `git diff --color-moved`; mixing a move with an
    edit makes both unreviewable.
  - **AGENTS.md's documentation rule names every file**, and has to change in
    the same branch as each rename, or it sends the next session looking for
    files that are gone. The same goes for every cross-reference: grep for
    each old name after each step, and add a small check under `tools/` that
    every relative Markdown link resolves, run by `npm test`.
  - **What is deliberately NOT proposed**: splitting RESEARCH.md into many
    small files (more files, the opposite of the ask, and search already finds
    things in one), and dropping the Done archive (this repository's history
    starts at one squashed commit, so that archive is the only record of why
    most decisions went the way they did).

## Selling it: the attribution pass

- [ ] **Nothing since 11 September has had a provenance search.** The mesh
  ingest, vegetation, greens and everything after. This pass checked the
  dependency and asset FOOTPRINT, not the source for similarity.

## Getting it into other people's hands

- [ ] **Weak hardware: the owner is testing it personally**, on a phone, an
  iPad and a laptop, and the answer is whatever those give. Decided 25
  September: there is no route to a broad device matrix for a solo project and
  waiting for one would stop everything. The open item saying the low tier
  cannot reach 30 fps on weak machines still stands and tuning still cannot
  fix it -- what changes is that the number gets MEASURED on three real
  devices and stated honestly on the page, rather than discovered by a
  stranger.

## Networked multiplayer

Asked for on 2026-09-25 as a feasibility study, not a plan.

- [ ] **The product question is unanswered and blocks any code.** Two people in
  different houses, or several people standing in one bay? They want different
  things and the second is nearly free.

- [ ] **Version skew would become a shipping constraint.** GENERATOR_VERSION was
  at 32 and moved twice on the night the study was written. Once people play
  together, a bump costs a MATCH rather than a saved round, and the handshake
  has to refuse a mismatch at the door.

## A course has a name, not a serial number

Asked for on 2026-09-25, in the run-up to letting other people play it. One
idea under several bullet points: a course is presented by what it is CALLED,
and the development chrome around that goes.

- [ ] **The library card still shows the seed** -- deliberately, since that is
  metadata about a stored course rather than chrome on the playing screen. Worth
  a second look if seeds are being retired from the player's view generally.

- [ ] **A name is suggested, never enforced as unique.** Two saved courses can
  have the same name; the dedupe on import compares name AND settings, so this
  does not cause a collision there. It would read oddly in a long library.

## Shot numbers that stay on the card

Asked for on 2026-09-24, in the run-up to letting other people play it.

- [ ] **The card forgets its numbers on a reload.** `lastShot` is memory only,
  so resuming a saved round opens with dashes and "Nothing hit yet" even though
  the round is mid-hole. Saving the last shot with the round would fix it; the
  question first is whether a shot from a previous SESSION should be presented as
  though it just happened.

- [ ] **The range's own session summary is still its own thing.** Average carry
  and offline spread across the session sit in the paragraph above the grid
  rather than being fields you can tick. They are session statistics rather than
  shot readings, which is a real distinction -- but somebody will want them as
  tiles.

- [ ] **Nothing has been tested against a real monitor.** Every extra field is
  exercised through the lab and through `parseLaunchMessage`, which is the same
  code path a device drives, but no physical device has sent a ClubData block
  into this. First thing to check at the R50 session.

## Greens read better if the art style bends for greens only

Asked for on 2026-09-24, after the second retune. **Updated 30 September:**
the five green sliders are now two (definition, bands) plus a course-wide grass
sheen, which answers the midday problem from the viewer's side rather than the
sun's -- see RESEARCH.md *Reading the ground, again*. These entries remain the
further options, each breaking one of the two limits a green still has: the
lighting is quantised into four steps, and at the default difficulty a green
has only about half a percent of shape to show.

**None of this touches the ground.** No routing, no hazards, no planting, no
collision, no `surface()` -- so **no `GENERATOR_VERSION` bump** for any of it,
and the biome fingerprints must come back unchanged. They are all graphics
settings, in `GREEN_READ` beside the other two, which DOES mean a
`SCHEMA_VERSION` bump and a `GREEN_READ_GEN` bump per shipped batch, or a saved
record beats the new default and the change reaches nobody. Every one of them
also needs `customProgramCacheKey` in `ground.js` bumped, or the browser serves
the old program from cache.

**Ordered by payoff for how much style is broken.** The first is the one to do.

- [ ] **Give greens their own lighting ramp -- this is the blocker, and it is
  small.** `toonRamp()` in `textures.js` is four texels (90, 145, 205, 245) on
  `LinearFilter`, sampled by three at `dot(normal,light)*0.5+0.5`; texel centres
  stop at .875, so a near-flat green under a sun above about 48 degrees is
  clamped and every lighting cue dies. Measured: brightness span across a green
  was 0 out of 255 with AND without the old sun cue at 50, 65 and 80 degrees.
  Smooth the ramp for the putting surface and all of it starts working again at
  full strength, for free.

  **It cannot be done with a second material.** The whole course is ONE mesh with
  one `MeshToonMaterial`; greens are `kind==4.` inside the fragment shader. So
  the ramp has to be bypassed IN the shader: declare `float gGreen=0.;` in the
  `common` injection (a constant initialiser, which is legal at global scope --
  a non-constant one is what once stopped the ground drawing entirely), set it
  from the kind test inside the `color_fragment` injection, and replace three's
  `getGradientIrradiance` so it mixes between the ramp lookup and the raw smooth
  `dotNL` by `gGreen`. Order is on our side: `color_fragment` runs BEFORE
  `lights_fragment_begin` in the toon fragment shader, so the kind is known by
  the time lighting asks. That is a fourth link in the replace chain, so add the
  anchor to `FRAGMENT_ANCHORS` in `tests/ground-shader-structure.test.mjs` --
  and confirm the chunk name against the three version in use, which that test
  already does for the others.

  **The seam is at the collar**, where stepped fairway meets smooth green. Fade
  `gGreen` across the fringe rather than switching it, using the same signed
  distance the surrounding classification already has.

  Rejected: remapping `dotNL` for greens so the flat region lands mid-ramp
  instead of at the top. It is a one-line change and it works, but it moves a
  green's average brightness down a whole step -- greens would read as a
  different, darker grass than the fairway they sit in, which is a worse break
  than the one being avoided.

  **The measurement that decides it**: brightness span across a single green at
  50, 65 and 80 degrees of sun, against the numbers above. Anything below about
  15 out of 255 at 65 degrees means it did not land.

- [ ] **Cross-cut the bands instead of striping them.** A stripe bends one way,
  so it describes slope along one axis and says nothing across it; a grid bends
  both ways and reads like a wireframe laid on the surface, which is shape
  information rather than brightness information and therefore survives midday.
  Real courses cross-cut greens, so this is arguably not breaking the style at
  all.

  In `ground.js`, the band block already computes `plan`, `coord`, `stripe` and
  `spread` for `kind==4.` at a 3.2 m period. A second set at 90 degrees to `mow`,
  combined multiplicatively, is most of the work. **The trap is the anti-alias
  fade**, and it is written up at the top of that block: the fade is measured on
  the PLAN coordinate, never the bent one, because the height term changes
  fastest exactly where the ground is steep or seen at a grazing angle -- doing
  it on the bent coordinate once made bands vanish on the slopes they describe.
  The second axis needs its own `fwidth` on its own plan coordinate, not a reuse
  of the first. Two sets also double the pattern energy, so `greenBandSoft` will
  want re-tuning downward; the owner already has bands at 10%, which suggests
  starting the grid lower still.

- [ ] **Contour lines on greens only, at a fine interval.** The most legible cue
  we own by a distance -- our own note on the course-wide toggle says so, because
  it turns a slope into a spacing you can count -- and the reason it is off is
  that a metre-interval topographic map across the whole course looks absurd.
  Confined to the putting surface at 20-25 cm it stops being a map and becomes
  the one place a golfer actually reads contour.

  The code is already there: the `cueContours` block in `ground.js` is
  `groundPoint.y/1.0` with an `fwidth` line and a moire fade at `smoothstep(.25,
  .7,w)`. A green-only branch is the interval, the kind test, and its own
  strength uniform. **At 25 cm the moire fade will trigger far earlier**, so the
  lines will vanish at mid-distance unless the fade is re-fitted -- check it on a
  green from the tee, not from over the ball.

  **Say plainly that this is the closest of the five to being a green-reading
  helper**, which is the thing the owner asked to do without. Ship it off by
  default and let them decide.

- [ ] **Bake shading into each green when the course is built.** Everything
  sun-driven collapses at midday because that is what midday does; shading baked
  from the geometry does not care where the sun is. `localReliefField()` in
  `ground.js` already does exactly this at course scale, into the `localRelief`
  vertex attribute and the `vRelief` varying. A green is roughly 500 square
  metres against a course's several hundred thousand, so the same field over
  just the putting surfaces is affordable at many times the resolution -- a
  second, finer attribute sampled only where `kind==4.`, or a small per-green
  data texture.

  **Check the generation cost before committing**: this runs in the build, which
  is already 3-5 seconds for 9 holes and 24% slower than it was. `bench.mjs
  --tier full --since` before and after, and it is not worth more than a few
  hundred milliseconds.

- [ ] **Slope in colour, not brightness.** The ramp quantises LIGHT; it does not
  touch the colour of the grass, so hue is an entirely unused channel on a
  surface where the brightness channel is saturated. A few per cent cooler
  running uphill, warmer running down, keyed off the same tilted normal
  `greenLift` already builds. The eye reads hue and brightness separately, so
  this ADDS a channel rather than competing for the one every existing cue is
  fighting over. Closest relative is the existing `cueSlope` tint, which works on
  the whole course and is the only one of the original three that works in colour
  -- worth reading first, because it already solved the "does this look like
  grass" problem once.

- [ ] **The honest caveat, to be repeated to anyone who picks this up.** Part of
  why a green reads flat is not shading at all: you are looking at it from near
  ground level at a shallow angle, which compresses the slope out of the picture
  geometrically. No shading cue fixes viewing geometry -- it is why real golfers
  walk round a putt and crouch behind it. Expect a real improvement from the
  above, not a solved problem, and do not chase the last of it with ever-stronger
  cues; that is what produced a green that read as a lit object rather than a
  shaped one and had to be walked back.

## Green and bunker shapes

Both outlines were a smooth oval. Measured over 108 greens and 284 bunkers:
widest radius over narrowest ran 1.15-1.40 for greens and 1.11-2.40 for bunkers,
and a bend figure that is non-zero only where an outline turns back on itself was
**0.00 for all 392 shapes**. Nothing had a lobe or a waist anywhere.

- [ ] **Shaping a green steepens the ground around it, and the shoulder blend is
  why.** The shoulder falls away from the green's NOMINAL size and does not
  follow the outline, so wherever a shaped green bulges outward its shoulder has
  less room. On default terrain the steepest surround goes 0.570 at slider 0 to
  0.709 at the default and 0.806 at full; on the harshest, 0.685 to 1.032. The
  surround test was re-pinned from 1.35 to 1.45 to record it. **The intent of a
  broad shoulder rather than a ridge was already not met before this change and
  is now further off.** The fix is to blend the shoulder off the outline rather
  than the nominal size, which is real work and has not been attempted.
  **Since GENERATOR_VERSION 33 a quarter of greens are raised by default**, whose
  banks are steep on purpose (3-5 ft over 5-8 m), so measure this with
  `raisedGreens: 0, sunkenGreens: 0` to separate the unintended steepening
  from the intended.

- [ ] **True scalloped edges need a data channel that does not exist.** Capes and
  bays -- the fingers of grass that intrude into sandbelt bunkers -- want
  harmonics above the two a bunker carries, and `meta` in the hazard texture is a
  full vec4 (phase, kind, wave2, wave3). Adding a third means changing the
  texture layout, which is where the paint-versus-lie risk lives. Worth doing
  only if the amplitude alone turns out not to be enough on screen.

## Tee surrounds, and the moat that made them

- [ ] **UNEXPLAINED, AND THAT IS FINE FOR NOW, 23 September 2026. The far ring
  around greens is probably structural rather than a pile-up.** Owner's call:
  keep it on the list, do not chase it. It was recorded earlier as bunching at a
  hard edge, but it sits at 179-205% at 55-120 m even with the edge softened and
  at every slider setting. More likely: rough far from any corridor is fully
  planted while rough near one is thinned, and a green sits at a corridor's end
  so its far field is disproportionately far-from-corridor. **The earlier claim
  that softening the edge would fix it was wrong and is withdrawn** -- that is
  the part worth remembering, because it is written into the commit message for
  the soft-edge change where nobody will think to look for a correction.
  `tools/bench.mjs surrounds --set trees=65` is what measures it.

## Obstructions in the shot path

Measured across 216 holes, 648 tee shots (8 biomes x 3 seeds x 3 tees): **29 tee
shots (4.5%) have a trunk sitting on the straight line to the fairway**, the
close ones 8-20 m from the tee. None were unplayable -- every one had a clear aim
somewhere within 18 degrees -- but being forced off the fairway line on a tee
shot is the complaint, not being stuck.

Cause: **world trees have no tee guard at all.** The only rule is "at least 10 m
outside a corridor", which near the tee is right beside the tee box. There IS a
22 m no-tree bubble, but it lives in the per-hole tree list and is centred on
hole-local origin while the tees sit 11 to 85 m away from it -- and that list is
dead anyway (see below), so the bubble never protected anything.

- [ ] **The flagstick still does not collide.** Left out of this slice
  deliberately: it is a different question from obstructions, and real golf
  hits the pin. Wants its own decision, including whether the pin is in or out.

- [ ] **The per-hole tree list is dead code.** `h.trees` is built in
  `generateCourse` for every hole and nothing reads it once a world exists:
  physics takes `course.world?.trees` first, and the renderer, vegetation and
  camera all read `world.trees` only. `course.trees` survives as a fallback for
  a bare hole with no world, which is test fixtures. Costs a placement loop per
  hole and carries a stale keep-out rule that reads like it is protecting tee
  shots. Delete it or make it the fallback it actually is.

## Ball flight, after the GC3 session

- [ ] **Hang time is 0.7 s long and it is not the lift cap's doing.** It sits
  between 0.5 and 0.7 s for every value of `spinDrag` tried, so it cannot be
  tuned from here. Matching apex while overshooting hang means the ball takes
  too long to fall from the same height -- the SHAPE of the descent rather than
  its scale -- and descent angle running 1.5 degrees steep says the same. Needs
  a look at how drag varies through the descent, with its own evidence.

- [ ] **One last fit when the Garmin R50 data lands.** A third device makes the
  spread readable instead of a two-way argument: with two sources that disagree
  there is no way to tell which is off, and with three the odd one out shows.
  Fit against all three together, report the residual against each, and accept
  it. **Perfection is explicitly not the bar** -- a fit that matches one device
  exactly would be overfitting to that device's algorithm. Worth asking whether
  the session can include driver, since the item below is still open.

- [ ] **No driver data in either session, and the R50 session will have it.**
  Confirmed 23 September 2026. Both existing sets are irons and wedges, 78 to
  142 mph, so the high-speed low-spin corner is entirely unmeasured -- and it is
  the corner the original six-row tour fit was most confident about, which is
  the combination that hides an error rather than showing one.

- [ ] **What the R50 session has to carry for the fit to be worth doing.**
  Written down before the data arrives, because every one of these has already
  cost something once:
  - **Total spin AND spin axis, reported not derived.** The GC3 gave both
    directly. Deriving spin axis is where a sign error lives, and a shot
    direction sign error has shipped four times in this project.
  - **Peak height.** The whole lift-cap defect was invisible in carry and
    obvious in apex. Carry alone cannot catch a shape error.
  - **Hang time to hundredths.** SkyTrak reported whole seconds, which cannot
    grade anything -- and hang time is the open defect, running 0.7 s long.
  - **Descent angle**, kept OUT of the cost as it always has been, so it stays
    an independent check rather than a fitted output.
  - **The landing surface, stated.** Nothing else validates roll, and that is
    why roll still has no reference data at all. A range mat or a stated turf
    type would be the first roll evidence this project has ever had.
  - **Ball speed, launch angle, azimuth, carry, offline** as usual.


Updated September 15, 2026. These are future tasks, not claims of implemented behavior. Finished work moves to the completed sections at the bottom. See PROJECT_HANDOFF.md for context and README.md for current controls.

## Priority 1: correctness and continuity

- [ ] **The suite's wall time is one file at a time.** Worlds are memoized per test file and `water-terrain` is split, and the wall did not move: it is set by the slowest single FILE, and six are still over 100 s. Splitting more is mechanical. The better fix is underneath: a profile puts `nearest` at 15.3% of a generation and the hole-centreline math (`sideWidth`, `unitCenter`, `toLocal`) at about 40% together. `nearest` walks all nine holes with no spatial rejection; a world-space bounding box per hole would speed up the tests, the harness and the game's loading at once.

- [ ] **A TypeError on every course load, pre-existing.** 'Cannot set properties of undefined (setting value)' is thrown during load and swallowed; it is present at HEAD and the scene renders anyway, so nothing visibly depends on it. Found while chasing an unrelated blank screen and wrongly assumed to be the cause. Worth finding: an exception on the load path is a trap for the next person debugging something else.

- [ ] **Turn `crownShare` on for the other biomes.** They would all benefit and none of them needs it. One number each, and the fingerprint will say exactly what moved.

- [ ] **Six metrics in this project have now measured the wrong thing.** Each had a filter or a clamp that excluded exactly the case under test. Worth a short checklist in the tooling: before trusting a number, confirm it can move.

- [ ] **Leaf tinting for the baked trees.** The sprite sheet is green; multiplying it by a green role colour comes out near-black. Either tint white and accept the sheet's own colour, or use the sheet as alpha only and take RGB from the role.

- [ ] **Only two crown shapes.** Acceptable while the crown is seventy metres up, but a third would want either a pack with a single-mass conifer or a procedural plume built from overlapping foliage.

- [ ] **The bush family is still sized by height.** Same bug the ferns had -- ground cover should be sized by its spread. `fern`, `gorse`, `heather`, `naupaka` and `shrub` all draw from it across six biomes, so it wants doing on its own with a look at each.

- [ ] **Deadfall does not collide.** A ball rolls straight through a fallen log. Fine at the current size, wrong if they ever get bigger: a log is an oriented box and physics already collides against those for houses.

- [ ] **Trees near tees.** The remaining piece of the owner's request. Replace the blanket 22 m circle round the back tee with two rules: a small clearance to swing in, and nothing inside the shot line from any tee. Trees are placed before tees are sited, so the pass has to run afterwards and remove any tree that ended up in a line. `sightline` in course.js already answers the shot-line question.

- [ ] **Blind shots that remain.** The forward tee improves least -- red is blocked over 1 m on 12% of holes against blue's 5% -- because the lift is computed for the complex and red sits lowest within it. Per-pad lift would close that at the cost of the complex reading as one piece of ground. An aiming post on the crest is the other half of the blind-shot question, and is gameplay rather than generation.

- [ ] **Watercourse endings that remain.** An outlet INTO an existing pond or lake, which today is prevented rather than handled -- a pond is raised in the drainage model, so a channel can never flow to one. Junction geometry where two channels meet, or a channel meets a pond, is still a segment strip rather than a real triangulation. And 9 endings in 24 courses still fade out partway down a hillside because the profile ran out of cut budget, which is the least convincing ending left.- [ ] **Wider generation stress tests.** Sample many seeds across all biomes, footprints and slider extremes. Measure green-surround slopes, hazard clearances, corridor overlaps, channel segment intersections and shoreline/contact disagreement. Save failing seed/settings fixtures and screenshots. The present regression set is not exhaustive proof for arbitrary seeds.

- [ ] **Measured physics calibration.** Collect repeatable launch/landing/roll measurements on known Stimp and turf. Fit drag/lift/contact parameters against held-out data. Track errors by club, launch speed, spin and surface, while preserving convergence and finite stopping behavior. Do not claim commercial-level accuracy from plausibility tests alone.

- [ ] **Browser timing and state-transition regression -- partly covered now.** `npm run smoke` drives the three-second cup reveal through to the scorecard and the next hole, a replay, a mulligan, and Enter skipping a flight. **Still manual:** replay across holes, multi-player completion, scramble selection, and cancellation during pending timers.

## Priority 2: landscape and performance

- [ ] **Hydrology mesh quality — remaining work.** The tight-bend failure is now prevented rather than meshed around: generation caps channel curvature, stations sit about 2.6 m apart, each carries a mitered three-vertex cross section, and the ground shader resolves station joins against neighbouring segments. A channel is still a segment strip, not a constrained bank/water triangulation, so the guarantee rests on the curvature cap. Re-check it before widening rivers past 30 m, raising meander amplitude, or adding confluences, and add the real triangulation if any of those land. Junction geometry where two channels or a channel and a pond meet is still unsolved and belongs with the drainage item above.

- [ ] **Bridges and crossings.** Channels currently cross walking routes with no deck. A first attempt shipped `src/bridges.js`, which overrode contact height over each deck footprint while the ground mesh kept its carved channel; it was removed because a height override is not a solid — a ball flying *under* a deck registered as landing on it, and the override fought every other height consumer. A real crossing needs an actual collision volume with an underside, sitting above ground that is left alone, rather than a second height function layered over the terrain.

- [ ] **Home interiors and regional architecture.** Interiors, varied window patterns and per-region architecture beyond the warm/arid palette split are still unbuilt.

- [ ] **Generation worker and progress.** Generation still runs on the main thread and still blocks it; an 18-hole feature-heavy course pauses the tab for several seconds. A **"Growing your landscape…" overlay** now covers that: `whileGenerating` paints the message, waits for a frame (or a timeout, since a background tab fires no frames), then does the work. That is a status message, not progress — it cannot advance, because the thread is locked for the duration.
  Real progress needs generation split into steps that yield between them. The cheapest route is to make `generateWorld` a `function*` yielding phase labels: a sync wrapper drains it for the tests, an async wrapper yields to the browser between phases. Measure first — if one phase such as `makeGroundGrid` dominates, yielding between phases buys little and that phase needs chunking too. **A Web Worker is the wrong tool here:** `generateWorld` returns closures (`toWorld`, `height`, `surface`) that cannot cross a worker boundary, so it would mean refactoring the world into pure data with closures rebuilt on the main thread. Acceptance: controls remain responsive while generating; stale results cannot replace a newer round.

- [ ] **Terrain/vegetation/house LOD.** Reduce distant draw calls and mesh density, batch houses, stream visible cells, and profile shadow/reflection costs. Preserve close-up green/cup/contact precision. Benchmark several screen sizes/GPUs rather than choosing limits from one computer. **Start by establishing what actually binds the frame** -- the redwood LOD was built against an assumption that instanced vertices were expensive, and they are not; the grove went from 1 M to 33.6 M vertices a frame with no measurable change. Draw calls, shadow passes and fill are the candidates that have not been ruled out.

- [ ] **Routing quality metrics.** Evaluate forced carries, recovery space, green-to-tee walks, finishing-hole return and strategic choices. Improve footprint resemblance without forcing fixed hole templates or sacrificing separation. Previews are guidance rather than guaranteed exact silhouettes today.

- [ ] **Green-surface shaping quality.** Retain broad surrounding transitions while adding a maximum-grade constraint around green complexes and fairway approaches. Avoid over-flattening adjacent holes. Current smoothing greatly softens shoulders but does not impose a global terrain-grade guarantee.

- [ ] **More natural pond siting.** Terrain is now settled to a level shelf under each pond, so rims vary by a few centimetres and a pond no longer needs a naturally flat site; rim sampling, shrinking and removal remain only as a safety net. What is left: ponds are still dropped for *geometric* reasons — at high Water settings large ponds crowd each other and the playing corridors, so roughly one pond per hole is placed however many are requested. Prefer existing low contours when choosing where to level, relax the mutual-overlap rule so several ponds can share one basin, and add wetlands and reeds.

- [ ] **Lighting and water fidelity.** *Water itself is done and signed off (2026-09-17): the surface, the flow and the reflection model are settled and should not be reopened without a reason from play.* What remains under this heading is sky/environment continuity, shoreline alpha and the postprocessing decision below. The shared planar reflector is gone -- every body now carries its own cubemap probe, so nothing pops -- and what that gives up is parallax: a probe is taken from one point, so its reflection does not shift as you walk past. If that reads as wrong on a large still lake up close, the answer is per-body planar mirrors, capped and assigned so that no body ever gains or loses one while it is on screen; never one mirror shared again. Probe resolution follows the tier (`quality.reflection`/4, 64-256). Shoreline translucency is handled for channels by a per-vertex bank weight, and for the ocean since `water-edges` by a depth map of the terrain (the sea fades out over its last 35 cm); ponds and lakes still end on a uniform alpha at their edge, softened by their foam strip — a depth map per basin is the way to give them the same. The no-postprocessing rule has been narrowed by the owner: postprocessing is now allowed on the **high** graphics tier, starting with additive god rays and open to bloom and ambient occlusion if they earn their place. The underlying requirement is unchanged — nothing may soften the sharp turf boundaries — so a pass that blurs the scene image itself still needs a decision, while an additive layer composited over it does not. The blended turf edges around creeks and rivers remain a deliberate, local exception granted for channel crossings only.

## Priority 3: play and maintainability

- [ ] **Separate main.js concerns.** Extract studio, round settings, scorecard, input/monitor and presentation controllers. Preserve accessible names/IDs and public behavior; avoid a framework migration solely for file size.

- [ ] **Spin-dependent rim behaviour.** The rim is now a rigid-body rolling contact carried through time (see the completed item below), but the ball arrives at it carrying only the spin implied by rolling. A putt struck with sidespin or cut across the face should engage the lip differently, and nothing here models that. Hogan & Antali's separation of rim lip outs from hole lip outs via degenerate saddle equilibria is also not reproduced as such, although the instability of the edge equilibrium falls out of this formulation: f'(alpha) = rho theta'^2 cos alpha - g sin alpha is negative throughout (90, 180) degrees, so a ball on the edge cannot balance there and must either fall in or be thrown off.

- [ ] **Tournament penalty options.** Add lateral water drops, relief zones and optional full rules. Current water/out-of-bounds behavior is simplified stroke-and-distance; sim drops are separately penalty-free by design.

- [ ] **Per-player tee choice.** The current active tee is a round setting. Support separate tee sets/yardages per golfer if requested, including mixed-tee scoring and CSVs.

- [ ] **Replay persistence and controls.** Optionally save recorded shots, pause/scrub/restart and choose replay cameras. Keep recorded trajectories separate from score/undo mutations and bound file sizes.

- [ ] **Accessibility and smaller screens.** Keyboard-only end-to-end testing, narrow viewport/custom layout combinations, reduced-motion support and configurable readability. Ensure the result panel remains usable alongside other panels. **The smaller-screen half is now measured**, by the smoke test's `hud-reachable` journey -- and it fails; see "Found by driving the built game".

- [ ] **Hardware validation, when requested.** Test actual controllers and launch monitors/connector versions. Record operating system, firmware, protocol fields, putting support, shot duplication/reconnect cases and licensing prerequisites. Synthetic bridge tests are not device certification.

- [ ] **Offline release matrix -- the Chromium half is automated.** Archives are one command (`npm run release`), and `npm run smoke` opens the built file by file:// in Chromium on every run. **Still manual:** Safari, Firefox and Edge, and export/import round-trips. The last sentence this entry used to carry -- that browser automation disallows file URLs -- was the in-app preview pane, not browsers.

## Still open from the putting and cup update

- [ ] **Green surrounds are steeper than intended on extreme settings.** The test that claimed otherwise was pinned to one lucky seed at 0.582 while most seeds were already over its 0.6 line. Now a multi-seed characterisation test; the underlying shoulder blending on elevation 100 / landform 100 mountain still wants doing. **Not a release blocker, measured**: at the default elevation 35 / landform 70 the worst surround across 8 biomes x 3 seeds is 0.59 with a median of 0.54, and nothing exceeds the intended 0.6. It only bites at slider extremes, where the result is a perched green rather than a broken one.

- [ ] **A sink pond can be given a water plane its basin cannot reach.** Guarded at the call site so the pond is dropped rather than floating, but the cause is in `fitPondBasin`: it takes the level from the lowest ground around the outer transition without knowing how deep the pond digs. The same arithmetic applies to lakes, which is why the guard is not in the shared fit. **Not a release blocker, measured**: across 64 worlds and 2,511 sampled points of water surface, 15 stand above their own surface and the worst by 0.02 m -- float noise at the waterline. No sink pond and no lake. The four-metre case that started this is gone.

- [ ] **Short shots off the green pick the shortest club at 100% power.** Exposed by dropping the `d < 18` putter clause, though the behaviour already applied from 18 to 65 yards. Power should scale to the distance; needs a real decision about how, since power is linear in club speed and carry is not.

- [ ] **The debris tails point along the mean wind** while each mote wobbles off it. Needs a per-particle direction attribute; invisible at this sprite size so far.

- [ ] **Roll has no reference data.** The flight is checked; the bounce and roll are not, because no launch monitor export states the landing surface. Needs a session with the surface pinned, or on-course measurement.

- [ ] **The green marker still shows a flag glyph** after the flagstick has been pulled. A cup or target mark would be honest.

## Distribution follow-up (September 11 review)

- [ ] Run a live dependency advisory audit on a machine with working registry certificate trust. Current attempts failed TLS verification; no clean-security claim.

- [ ] Finish target-browser/direct-file, controller and physical launch-monitor testing before making corresponding support claims.

- [ ] Choose public publisher/support details and check the working product name before a broad release.

- [ ] Configure an optional donation page when requested; no payment account or public posting has been created.

- [ ] **The driver carries 261 against a sourced 275, and its apex is 9% low with it.** Tour driver apex is quoted at 35 yards ([Trackman](https://www.trackman.com/blog/golf/apex-height)); ours is 32. That is not a second defect — a shorter drive has a lower apex, so it is one gap counted twice. Every other club is close and the apex SHAPE across the bag is right (driver-to-PW spread 3.7 yd against a published 3).
  **Do not chase it by adding lift.** Lift is currently fitted to carry (3.2% RMS), apex (3.7%) and descent angle (1.8%), and descent angle is what the entire bounce model is fed by. Trading three validated quantities against one club's carry is a bad deal. If it is picked up, it wants a proper refit against the whole bag, not a nudge.

- [ ] **We use the bounce paper's restitution and tilt but not its friction.** [arXiv:2302.02758](https://arxiv.org/abs/2302.02758) Table 3, Campaign B fixed-beta, is r = 0.147, beta = 18.4 deg AND **mu = 0.998**. We take the first two and use mu = 0.40 (green) / 0.44 (fairway), which are from nowhere in that paper. The old justification (the Coulomb limit never binds) does not survive the move to the compliant model, where friction saturates above ~0.4 for a different reason: the tangential spring grips and takes over.
  - [ ] **And we apply a speed-dependent tilt the paper explicitly rejected.** `clamp(-incomingNormal/12,0,1)` in physics.js:406 is Penner's speed-dependent angle; the paper fitted that variant (21.3% error) against a fixed angle (19.2%) and the fixed one won. Measured, the clamp is inert for every full and 3/4 shot and only distorts partial shots -- up to 10 yd on a half driver, 2.3 on a half 7-iron.
  - [x] **The measured data DOES cover amateur speeds.** Campaign B spans 1.93-38.7 m/s, so the anchor is valid down to a chip. What is narrow is our tour validation set: it spans 3.49x in arrival spin but only 1.26x in landing speed, while the stock bag lands as slow as 14.7 m/s.
  - [x] **Partial shots show the release-spread defect from the other side:** a half 7-iron releases 17.5 yd against a full one's 3.5.
  **SUPERSEDED** by the fairway and green refits.

- [ ] **A stinger needs a 2-5 degree launch in this model, which no golfer produces.** Asked for a stinger, the fitted aero will only put the apex in the real 10-15 yd (30-45 ft) band if the launch angle is dropped to 2-5 deg. At a plausible de-lofted launch of 8-9 deg the lowest it reaches is 50-56 ft (17-19 yd), roughly half again too high. Measured across 5,324 combinations on the range at 138-170 mph.
  - **And spin raises the apex hard.** At 150 mph / 7 deg: 2,400 rpm gives 44 ft, 6,400 rpm gives 83 ft. Correct in direction for a fixed launch -- more backspin is more lift -- but it means the model cannot produce the "low and climbing on spin" shape a stinger is usually described by. The rise SHAPE is there (height at a quarter of carry falls from 49% to 35% of apex across that spin range); the height it rises to is not.
  - **Why this is a lift-curve SHAPE problem, not a magnitude one:** the open entry above says the driver's apex is 9% LOW against a sourced 35 yd. Low on a driver and high on a low-launch high-spin shot cannot both come from a uniform lift error. It points at how `liftGain`/`liftCap` respond to the spin parameter S at low launch, not at the overall level.
  - No sourced stinger apex was found -- searches returned general launch-monitor explainers rather than stinger data, so the 10-15 yd target is the user's figure and is not independently confirmed. Getting a real one is the first step before refitting anything.

- [ ] **Send `DistanceToTarget` to the device.** The connector evaluates a device mode from club and distance and currently logs `distM=n/a`, so a device cannot switch itself into putting mode on the green. The browser's player message carries only `Handed` and `Club`. Blocked on units: the device log says `distM`, the protocol is nominally yards, and guessing wrong would switch modes at the wrong distance -- worse than not switching. Needs the connector's own documentation or a measured test.

- [ ] **Save/import/export, what is left.** Neither loses work.
  - Saved-round delete is one click and gone; course delete in the round panel is a two-tap arm. Pick one.
  - `save()` swallows quota errors, so a full store means *Continue* silently stops updating with nothing said.

- [ ] **Remaining drift behind the green.** Up to 0.36% of a course still classifies `semi` where the shader paints `rough`: the shader mows to `length + 8`, `fairwayWidth` stops at `length`. Forgiving direction, separate defect.
  *(was a note under "The driving range. 500 yd × 100 yd, dead flat, mown..." -- see `# Done`.)*

- [ ] **Targets are scenery, not greens.** A ball landing on one bounces as range turf, because the shader and `localSurface` both carry exactly one green per hole. Real target greens need a GLSL loop over an extended cup atlas and a matching CPU loop.
  *(was a note under "The driving range. 500 yd × 100 yd, dead flat, mown..." -- see `# Done`.)*

- [ ] **Deep rough no longer tracks firmness in bounce height** (1.48–1.61 ft across the range, against a green's 2.81–4.52). Defensible — the canopy does the stopping — but it is a behaviour change worth a second look.

  *(was a note under "The bounce takes time now (Option C). A spun ball st..." -- see `# Done`.)*

- [ ] **Range dispersion is always zero** — see above; needs a strike-quality model.
  *(was a note under "Flight camera pass. Tightens across the whole shot r..." -- see `# Done`.)*

- [ ] Targets are scenery, not greens — needs a GLSL loop over an extended cup atlas.

  *(was a note under "Flight camera pass. Tightens across the whole shot r..." -- see `# Done`.)*

- [ ] `CONTACT_GAIN` in contact.js has been declared and unused since it was written.

  *(was a note under "The bounce turns backspin into topspin, which is why..." -- see `# Done`.)*

- [ ] **The gain magnitude is unanchored.** Nobody has measured how turf resistance grows with speed; the shape is pinned at the Stimpmeter end but `k = 1` is a choice.

  *(was a note under "Speed-dependent rolling resistance is ON (ROLL_SPEED..." -- see `# Done`.)*

- [ ] **Same root cause as the inverted firmness order:** `PLOUGH_BY_FIRMNESS` is too high at the soft end (Soft 1.797, Normal 1.0 against Firm 0.634), so soft ground both skips the forward hop and produces MORE rollback than firm — backwards from real golf, where firm fast greens give the dramatic zip-back and soft ones plug and sit. Pulling the soft end down should fix both.

  *(was a note under "The first bounce goes BACKWARD on Normal and Soft gr..." -- see `# Done`.)*

- [ ] **First-hop DISTANCE now descends slightly with firmness on a green** (0.34 m Soft to 0.15 Burnt) where height still ascends correctly. Minor and cosmetic, but it is the wrong way round.
  *(was a note under "Greens and fairways re-anchored to research, each ag..." -- see `# Done`.)*

- [ ] **7 iron on a Burnt green runs 11.8 yd.** Defensible for a surface meant to reject shots, but worth an eye.


  *(was a note under "Greens and fairways re-anchored to research, each ag..." -- see `# Done`.)*


# Done

Kept, not thrown away: the reasoning in a finished entry is often the only
record of what was ruled out and why, which is worth more than a short file.


## The simulator bay

- [x] **A left/right offset for the simulator bay (1 October).** Branch
  `bay-stand-side`, asked for by the owner. "Your mat, left or right of the
  screen centre", in feet, in the Camera & bay panel: an off-axis view (a lens
  shift), so the target line lands where it is in the room; the eye stays
  behind the ball. RESEARCH.md *Field of view is a measurement in a bay*.

## Text size

- [x] **Text size for a projector bay (1 October).** Branch `text-size`, asked
  for by the owner. A Text size setting in Graphics, 75-200%, automatic by
  default: 100% at a desk, worked out from the bay's screen, stance and
  browser width in simulator mode. The whole interface is CSS-zoomed, with the
  stylesheet's screen rules turned into container queries; the course is drawn
  at full resolution at any size; capped at what keeps the screen at least
  1280x720. RESEARCH.md *Text size for a projector bay*.

## OPUS5.5 GFX and OPTIMIZATIONS

Every item on this list was finished or closed by 1 October 2026; the
section's opening, its ground rules and the 27 September build-time baseline
are kept here for the record.

From the performance review of 27 September 2026 (published privately as
"Where the frames and the wait go"; the numbers are repeated here so nothing
depends on that page). Everything was measured on the development machine, a
desktop RTX 4090 -- far faster than most players' hardware, so absolute times
flatter the game and the PROPORTIONS are what carry over. Frame figures come
from `bench/profile-baseline.json` (22 September) -- which was taken with a
probe that counted every frame twice, so its triangle and draw figures are
HALF the truth and its times are near the fastest frame (RESEARCH.md *The
profiler counted every frame twice*, fixed 28 September); build times were measured
on 27 September with the browser's CPU profiler over `window.lab.course({biome,
holes, seed: 'REPORT1'})` at 1366x768.

Ground rules that apply to every item below:

- **A graphics tier may not change a played surface** (`src/graphics.js` says so
  outright). Trunks are collidable and two players on different tiers must hit
  the same trees, so culling, LOD and draw distance may change what is DRAWN,
  never what exists in `world.trees` or what physics reads.
- **Anything that changes generated output for an unchanged seed needs a
  `GENERATOR_VERSION` bump** (AGENTS.md). `node tools/biome-fingerprint.mjs
  --check` is the arbiter. The owner has generation FROZEN during testing, so
  only the items marked "no course changes" are to be done now.
- **Profile before and after anything that touches the frame**
  (`npm run profile`, about 10 minutes for the full sweep, about a minute for
  one group such as `--only tiers`; ask the owner first, per AGENTS.md), and
  compare with `--since` against `bench/profile-baseline.json`. `renderer.info`
  triangle and draw-call counts (the lab reports them) are a quick check in
  between, not a substitute.
- One branch per item, each with its own before/after numbers.

Measured 27 September, 9 holes PNW: 9.2 s total -- ground shaping 2.5 s
(`makeGroundGridSteps` in `src/terrain-grid.js` calling `analyticHeight` per
3 m grid point), routing/holes/water 0.5 s, building the 3D scene 2.0 s
(`view.build`: ground shading data ~0.8 s, trees ~0.5 s, ground cover
~0.5 s), screen updates while waiting 1.4 s, first-time shader compile 2.8 s.
18 holes: 16.6 s (5.6 / 0.9 / 2.7 / 2.0 / 5.4). Opening the game: ~4.1 s to
the menu on a fresh visit, ~1.7-2.2 s after. `nearest` (course.js, "which hole
does this point belong to") is 1.7 s of the 3.0 s generation.

### Frame rate

- [x] **F4. Automatic resolution to hold the frame rate.** Branch
  `frame-and-lights`. `src/auto-resolution.js` decides, `main.js` feeds it one
  frame interval per frame, the renderer applies it under the tier's ceiling
  (`setResolutionScale`). Steps of 100/85/72/60/50% of the tier's pixels,
  never below a pixel ratio of 0.5. Aims for 60 fps, or the cap when lower --
  never a faster display's full rate, so a 120 Hz Ultra machine running 90 fps
  is left alone. Steps down when a second of frames averages 15% over the
  target; steps up after 4 s at the target, and a step up that does not hold
  doubles that wait (up to a minute), which is what stops it flickering on the
  edge. Held (not reset) while the page is hidden or the loading screen is up.
  **A switch at every tier**, "Automatic resolution" under the frame rate cap,
  on by default; the tester report says whether it was on and the resolution
  drawn at. Checked in the built game with the processor slowed eightfold: 72%
  after 2 s, 50% by 4 s; lifted, back to full in 20 s; switched off, never
  moved. RESEARCH.md *F4: automatic resolution*.

- [x] **F6. Shadow cascades split where the player stands.** Branch
  `cascade-splits`. High and Ultra end the first two cascades at 100 m and
  500 m (`cascadeSplits` per tier) instead of three's ~420/900 m (High) and
  ~590/1260 m (Ultra); the overview keeps three's split. Graphics ms, tees 4
  and 5 at 10:15: High 12.30 -> 11.14 and 11.36 -> 9.92, Ultra 12.64 -> 11.93
  and 11.21 -> 10.61; at 18:24 High still gains 0.4-0.9, Ultra is level. The
  owner judged the pictures from a flip page: Ultra indistinguishable, the
  faint seam at ~100 m acceptable, no blending wanted (CSM `fade` also breaks
  the ground shader). RESEARCH.md *Shadow cascades split where the player
  stands*.

- [x] **F5. Quick fixes already known.** Branch `f5-quick-fixes`. (a) The far
  plane now ends 5% past the fog, and the sky dome follows the camera scaled
  inside it; measured, it saves nothing on the courses as generated -- on a
  nine-hole course from the player's view almost nothing lies beyond Low's 3.5
  km of fog (identical draws and triangles, 2.41 ms either way), so fog is still
  mostly atmosphere, now with nothing wasted behind it. (b) Water reflections
  cost nothing per frame (3.80 ms on, 3.78 off) since the planar mirror went;
  what "off" did NOT save was each body's probe, re-taken at build and every six
  degrees of sun, 40-65 ms a time. Off now skips it; turning it back on takes
  it. (c) Island went from 8.1 ms of graphics time to 3.1 ms through the
  earlier F work and sits 0.3 ms from Pacific Northwest; what is left is its
  dense tall scatter grass (1.2 ms), a look choice -- the ocean costs nothing
  measurable, and fading far grass bought nothing. RESEARCH.md *F5: the three
  quick fixes*.

- [x] **F2. Draw distant crowns as their thinned twins -- built, and found to
  be worth little.** Branch `far-trees`. A crown under a share of the screen's
  height (`farTrees` per tier) is drawn by a second mesh using the thinned twin
  (`farParts`), with its own buffer and its own thinned shadow; hysteresis so
  it does not flicker; nothing within 60 m. Measured: on these courses almost
  every visible tree is big on screen (a 90 m redwood is 15% of the screen at
  ~600 m), so only the edge tee gains -- Low 3.15 -> 2.62 ms, Medium 5.72 ->
  5.23, High 11.96 -> 11.71 -- and every tier pays draw calls (Low and Medium +25-57,
  High +50-167). Ships ON at 15% on Low and Medium pending the owner's call on
  that trade, OFF on High (calls for nothing) and Ultra (owner: Ultra stays
  amazing). RESEARCH.md *Distant crowns drawn thinned*.

- [x] **F3. Only the trees a shadow map can reach, and thinner beyond the
  nearest cascade.** Branch `tree-shadows`. Each shadow map now draws only
  the trees whose square lies inside it (instances written in order of the
  first map that needs them; `onBeforeShadow` cuts each map to its prefix),
  and on High and Ultra the middle and far cascades take each crown's shadow
  from its thinned twin (`farParts`, derived at load, nothing added to the
  download). Graphics ms, first tee / tee 5: Low 4.12 -> 3.23 / 1.89 -> 1.78;
  Medium 6.37 -> 5.74 / 4.03 -> 4.01; High 13.28 -> 11.42 / 7.91 -> 7.34;
  Ultra 13.63 -> 11.87 / 7.75 -> 7.22. Screenshots at 18:24 and 10:15 match
  within frame-to-frame noise on every tier. REJECTED: the twin in Low and
  Medium's single map -- it shades the nearest crowns, which went visibly
  darker. Found on the way: the nearest cascade is ~1 km across (F6, since done),
  and layers cannot split shadow maps in three. Tests in
  `tests/instance-cull.test.mjs`. Detail in RESEARCH.md *Only the trees a
  shadow map can reach*.

- [x] **F0. Re-save the frame-profile baseline.** Done 28 September after the
  probe fix (RESEARCH.md *The profiler counted every frame twice*): full sweep,
  29 cases in 15.8 minutes (not the ~10 AGENTS.md quotes -- the software arm
  and the corrected frame counting both run longer). Headlines, graphics ms:
  Redwood Low 5.6, Medium 8.8, High 14.1, Ultra 15.4 from the first tee;
  Redwood High OVERVIEW 27.7, the heaviest case in the sweep; every other
  biome 5.0-8.7 at High; High at 1x/1.5x/2x pixels 10.7/12.4/14.4. `--since`
  now compares like with like.

- [x] **F1. Draw only what is in view.** Built as `src/instance-cull.js`, on
  branch `view-culling`. Every course-wide `InstancedMesh` in `view.group` --
  trees (model and procedural), deadfall, rocks, ground cover, homes,
  floodlight masts and heads -- is registered at the end of `build`. Its
  instances are sorted into 64 m squares; when the camera moves 4 m or turns
  4 degrees, the squares in a view 7 degrees wider than the camera's (plus
  everything within 60 m, plus squares whose shadow falls into view, from the
  sun's direction, capped at 1 km) have their instances packed to the front
  of the buffer and `count` set to match. **One draw call per mesh, as before**
  -- the planned split into one mesh per area was rejected because it
  multiplies draw calls about 25 times. Measured over all nine tees of seed
  REPORT1: Redwood High 241 M -> 143 M triangles a frame (-41%), Redwood Low
  91 M -> 55 M (-39%), Pacific Northwest High 6.2 M -> 5.5 M; draw calls
  unchanged; a rebuild costs 0.5-1 ms and runs about 8 times a second while
  the camera follows a shot, never while it is still. Screenshots with the
  cull on and off at 06:24, 18:24 and 19:18 differ by no more than the wind
  moves things between two frames. `clearCameraTrees` now hides a tree through
  its flag (`mesh.userData.cullHidden`) instead of a zero matrix at its
  original index; the water probes call `showAll()` first; the near-field
  grass tiles opt out (`userData.noCull`). Lab: `lab.scene()` (what is built
  and held), `lab.cullTune()` (the margins, live), `lab.hole(n)` (jump to a
  tee). Tests: `tests/instance-cull.test.mjs`. Frame time, corrected probe,
  graphics ms, cull holding everything -> cull on: High tee 1 14.4 -> 13.9
  (the first tee is the cull's worst case, and the only view the profiler
  measures), tee 5 11.6 -> 7.8, tee 9 12.0 -> 8.2; Low tee 5 4.1 -> 2.4;
  Ultra follows High. The profile also caught a real regression in the first version:
  marking the buffers `DynamicDrawUsage` tripled High and Ultra (33 ms) on any
  page opened after another in the same browser; the buffers now keep their
  built usage. Detail, and the shadow bug the screenshots caught, in
  RESEARCH.md *Drawing only what is in view*; the traps in PROJECT_HANDOFF.

### Build time

- [x] **B2c. The ground cover's `surface` calls on the workers -- DROPPED
  (owner, 30 September).** About 1.2 s of the wait on a nine; not worth the
  cost, since the finished height grid would have to be copied to every worker
  without shared memory (not available from `file://`).

- [x] **B5. Coarser ground far outside the course -- DROPPED (owner, 30
  September).** Not worth it: it would change every course's land for an
  unchanged seed (a GENERATOR_VERSION bump) to save time and triangles where
  nobody plays.

- [x] **B7. A hitch two to three seconds after a course appears.** Branch
  `frame-and-lights`. It was two shaders being built on the spot, not work
  scheduled after the arrival: the **forest floor** (Ultra's ferns and fallen
  sticks) grows only under canopy in the tiles around the camera, and the
  establishing pose over open ground usually has none, so the shader warm-up
  behind the loading screen never saw those materials. When the camera came
  down among trees, the first fern was drawn and its two programs were built
  there and then: one frame of 170 ms, 2.9 s in, every time, on PNW eighteen.
  Fixed with **stand-ins** -- one hidden, zero-sized instance of each late
  material, shown only while the warm-up compiles AND through the one frame
  drawn under the loading screen (on Windows the browser finishes a shader on
  its first real draw, so compiling alone left the whole cost in place). A
  second case on Island: a grass tile with no rough in it has no instance
  colours and so a different shader, built on its first (empty) draw -- 96 ms;
  empty tiles are now hidden. Measured after: no long frame on PNW, Island,
  Desert, Links or Mountain at High or Ultra; loading time unchanged. Redwood
  on Ultra still has two or three frames of 40-50 ms in its first third of a
  second (graphics-card work while the grass ring fills, not a shader). A new
  smoke journey, `no-late-shaders`, fails if any lit shader is built after a
  course appears; it fails on the old build. RESEARCH.md *B7: the hitch after
  a course appears*.

- [x] **B1. The first frame paid for behind the loading screen.** Branch
  `shader-warmup`. `GolfView.ready()`, awaited by `whileGenerating` before the
  overlay goes (*Preparing the graphics*): `compileAsync` for the driver's
  links with the page live, then one frame drawn under the overlay for the
  programs only a draw makes. Cold browser, PNW, High: the frozen first frame
  after the overlay went from 1.9 s (nine holes) and 3.5 s (eighteen) to
  0.01 s; the total wait is about the same on nine holes and ~1 s shorter on
  eighteen, because the time is the driver's and it still has to be spent.
  Found why it is that long -- the floodlight lamps are in every lit shader --
  and filed it as B6. RESEARCH.md *The first frame, paid for behind the
  loading screen*.

- [x] **B6. Floodlit shaders built after the course is on screen.** Branch
  `daylight-lamps`. The lamps are hidden while the floodlights are off, so a
  daylight start builds programs with no spot lights -- the same on every
  course -- and `warmFloodlights` builds the other state's in the background
  once the course is on screen. Cold browser, PNW, High, alternated with
  `main`: graphics prep 3.0-3.2 s -> 0.1-0.8 s, press play to smooth 2.3-3.2 s
  shorter on nine holes. Switching the floodlights afterwards: worst frame
  19-30 ms, from a daylight or a floodlit start. Night unchanged, overview
  included. REJECTED first: a cap on live lamps (same win, but only the
  nearest poles lit at night -- the owner declined it for the overhead view).
  FOLLOW-UP, found by the owner in the course creator: switching on in the
  first seconds after arrival, while the lit programs were still being built,
  froze the game (5.3 s on eighteen holes); such a switch now waits for the
  build with the game running, and the lights come on when it is done (5.9 s
  on eighteen holes, 2.1 s on nine; worst frame 48 ms).
  RESEARCH.md *Floodlit shaders built after the course is on screen*.
  SUPERSEDED 30 September: the build now runs behind the loading screen, and
  on Ultra this warm-up had never worked at all (see *The floodlights froze
  the game on Ultra* under "Graphics work the profiling turned up").

- [x] **B4. The scene build and the loading screen -- partly.** Branch
  `scene-build` (on `daylight-lamps`). Profiled: the scene build is one frozen
  block of ~3.7 s -- ground cover 1.4 s, the ground-shading atlas 1.0 s, the
  water probes 0.8 s. Done: the probes are taken after the shaders are built
  (same capture, trees hidden as before), the outgoing menu scene no longer
  re-photographs its ponds when the round's clock is applied (1.6 s), and the
  game loop does not draw while the graphics prepare. Longest page freeze
  while loading 3.7-4.8 s -> 3.1-3.2 s. The ground cover and atlas work cannot
  be trimmed without changing answers; moved to B2. RESEARCH.md *The scene
  build and the loading screen*.

- [x] **B3. The ground grid stops asking every hole about every point.**
  Branch `faster-ground`. Rescoped by measurement: the nearest-hole lookup
  already measured 1.2-1.4 holes a call, so there was little there; the time
  was three per-point questions asked of every hole or basin -- which cells to
  refine, which basin a point is in, and the green contour computed before its
  (often exactly zero) weight. Each now has an exact world-box or zero-weight
  rejection in front; fingerprints unchanged, so no version bump. Generation,
  best of three: PNW nine 2.46 -> 1.4 s, eighteen 8.79 -> 4.2 s, Links
  eighteen 10.26 -> 4.9 s. RESEARCH.md *The ground grid stops asking every
  hole about every point*.

- [x] **B2. The ground grid's heights on every core.** Branch
  `parallel-ground` (on `faster-ground`). Up to eight workers, each generating
  its own copy of the world and stopping at the grid; the main thread feeds the
  unchanged grid builder their answers in the order it asks, so the grid is
  the serial one by construction -- byte-for-byte in the Node test and the same
  `lab.ground()` hash in the browser. Classic blob worker embedded in the
  single file (+89 KB), falling back to the main thread on any failure.
  Generation in the browser: PNW nine 2.6 -> 1.9 s, eighteen 9.0 -> 3.4 s,
  Links eighteen 12.1 -> 3.6 s. The workers then compute the ground's
  ownership atlas too (hole, lake and stream per texel; `owner-atlas.js`),
  started as soon as the grid is done and collected when generation ends, so
  the ground material only adds straw: the longest page freeze while loading
  6.6-7.0 -> 5.8 s on a busy machine. Follow-ups B2b (Firefox/Safari) and B2c
  (the ground cover). RESEARCH.md *The ground grid's heights on every core*.

- [x] **B2b. The ground workers checked on the owner's devices.** 28 September:
  the owner tested the combined build (`build-time-all`) -- the checklist of
  loading, floodlights mid-round, ponds and the night overview, and
  `lab.ground()` on an iPhone and a Mac -- and reported all of it good. The one
  problem found, a long pause switching the floodlights in the course creator,
  is fixed under B6.

### Looking better on Ultra (cartoon style throughout)

- [x] **U1. Soft shade under trees and rocks.** Branch `ultra-looks`. Not a
  screen-space pass: a bake per course of how much sky each patch of ground
  loses to the trunks, crowns and boulders around it (`src/occlusion.js`), read
  by the ground shader as a soft darkening -- tight at the foot of each trunk
  and rock, broad and faint under crowns, deeper where they overlap. Every
  tier, no extra pass, MSAA untouched, 3-12 ms of build time. It rides in the
  red channel of the existing `cover` texture rather than a new one, because
  the lit shaders have one sampler of headroom. Graphics slider *Shade under
  trees and rocks*, default 60%. RESEARCH.md *Soft shade under trees and
  rocks*.

- [x] **U2. Trees and grass in the wind.** Branch `ultra-looks`. Every tree,
  imported or procedural, bends as one body -- trunk, limbs and leaves by one
  displacement that grows with height, curving rather than shearing -- and
  sways at its own natural frequency (slower for taller trees), with only a
  small leaf rustle on top. Gusts arrive as fronts carried downwind at the
  course's wind speed, so a crosswind gust bends the trees on one side of the
  fairway before the other. Cacti and agave do not move. Graphics preference
  `wind` scales all of it. Third version: the first moved the leaves apart from
  the trunk, the second bent trunks but still shivered leaves separately and
  had no gust front; the owner rejected both and approved the third.
  RESEARCH.md *How a tree moves in the wind*.

- [x] **U3. Every surface in patches.** Branch `ultra-looks`. Widened by the
  owner from "the rough" to every surface: rough, semi, fairway and tee ground,
  fringe, green (tone only, faint, so reading is not disturbed) and sand (damp
  patches), from world-position noise at each surface's own scale. A Graphics
  slider, *Turf colour variation*, default 60%. RESEARCH.md *Every surface in
  patches*.

- [x] **U4. Distance fading into the sky.** Branch `ultra-looks`. Every lit
  surface drifts toward the horizon's colour with distance, warmer toward the
  sun, and much less on steep sight lines so the bird's-eye view stays clear
  below. Every tier; graphics preference `haze`, default 50%. RESEARCH.md
  *Distance fading into the sky*.

- [x] **U5. Water with an edge and a glint.** Branch `ultra-looks`. A strip of
  lacy foam 1.4 m wide inside every pond's outline, lapping in and out, and a
  scatter of sun sparks where the ripples catch the sun's reflection. Every tier
  but Blueprint; gone once the sun is down. The foam is its own strip rather
  than read from `bankAtlas`: nothing on a pond's surface knows how far it is
  from the edge. The lapping runs at 30% of the water's own clock: at full
  speed it looked frantic (the owner). Approved by the owner after the slow-down.
  RESEARCH.md *Foam and sun sparks on the ponds*.

- [x] **The sea's edge, and foam for every kind of water (30 September).**
  Branch `water-edges`. The flicker where the ocean met the beach on Island and
  Links was the flat 14 km sea cutting the terrain's 3 m triangles at a
  shallow angle: a sawtooth waterline the depth buffer could not settle, so it
  changed with every camera move. The sea's shader now reads the terrain's own
  heights as a texture, knows its depth everywhere, and fades out over its last
  35 cm -- no hard line left to flicker, and smooth where the triangles were
  jagged. The same depth places the surf: a swash line that runs up quickly and
  drains back slowly, foam left behind it, and a faint line of breakers
  offshore. Lakes (which are large ponds and already had the pond foam) get a
  wider, coarser and livelier strip; rivers get lacy foam along the banks
  drifting downstream; creeks get white flecks carried by the current. Ponds
  unchanged. No measurable frame cost. After the owner's first look: the sea's
  foam slowed to 30% (as the ponds), rivers and creeks slowed by half with the
  foam at the water's own speed, and their water and foam now follow each bend
  of the channel instead of one direction for the whole river. RESEARCH.md
  *The water's edge, by kind*.

- [x] **U7. The ground past the course edge.** Branch `ultra-looks`. The
  streaks were sliver triangles (70 to 1): rings now widen by a ratio and carry
  only as many vertices as keep them near square (worst 6.6 to 1, a third of the
  vertices). The light rectangle round the course was the seam's normals and
  the landscape having no baked relief; both are carried across the seam now.
  A faint rectangle still shows from overhead where the course's ground meets
  the distant land; the owner judged it unnoticeable in play and closed this.
  RESEARCH.md *The ground past the course edge*.

- [x] **Rough grass that looks like grass.** Branch `ultra-looks` (the owner,
  after U8: not a fan of "5 2D tufts in a circle"). Clumps of seven curved,
  tapering blades at uneven angles and heights, lit like the ground under them
  (every normal up) and darker at the root than the tip; the course-wide blades
  got the same lighting and root shading. Grass now bends by its real height
  above the root -- the old lever was in model units, so a 7 cm tuft was pushed
  further sideways than it was tall and lay flat as dark scratches. 21
  triangles a clump against 5. Approved by the owner, who singled out the
  prairie. RESEARCH.md *Rough grass clumps*.

- [x] **U6. A forest floor on Ultra.** Branch `ultra-looks`. Low fern clumps
  and fallen sticks in the grass tiles round the camera, denser where the
  canopy is (the U1 bake), fading out between 28 and 48 m like the grass.
  Decoration only: not in the world, nothing a ball can hit, and ankle height
  at most so a ball rolling through it never looks wrong. Ultra only
  (`quality.forestFloor`); every other tier keeps today's planting. The first
  half of the brief -- full-detail trees further out on Ultra -- was already
  true (`farTrees: 0` on Ultra since F2). RESEARCH.md *A forest floor on Ultra*.

- [x] **U8. Ultra distinct from High, and the looks as settings.** Branch
  `ultra-looks`. Ultra now differs from High in what you see standing in a
  forest (U6) as well as in its shadows and bloom, and says so in the Quality
  note. The four looks from this branch are sliders in Graphics under *The look
  of the course* -- turf colour variation, shade under trees and rocks,
  distance haze, wind in the trees and grass -- on every tier, since none costs
  a measurable frame, and all live without a rebuild.

## Reading a green without the overlays

- [x] **The grid's flow covers the whole green, and the grid holds still while
  you aim (1 October).** Branch `green-grid-fixes`, from the owner's screenshot:
  the moving light showed only in the middle of a green (it skipped slopes
  under 1%, which on that green was most of it), and the grid turning with
  every nudge of the aim was disorienting. The gentlest band flows now; the grid
  takes the shot's starting direction and keeps it. RESEARCH.md *The slope grid
  squared to the camera*, the correction at its end.

- [x] **The slope grid squares to the play camera, and light flows on it
  instead of rolling balls (1 October).** Branch `green-grid-flow`, asked for by
  the owner. One shader surface draws both; in play the lines follow the
  direction faced at the START of each shot and hold it while aiming (corrected
  1 October: it first followed the camera every frame, which was disorienting),
  other cameras keep the hole's axes. The flow is
  dashes of light running downhill along the grid lines (the owner's pick of
  three). Faded where squares are a few pixels. Switching on is quicker than
  before (33-50 ms against 67-83). RESEARCH.md *The slope grid squared to the
  camera*.

- [x] **Reading the ground, rebuilt (30 September).** Branch `ground-reading`.
  Measured each setting first: at noon *Sunlight on contours* moved a green by
  0.2 of 255, *Band grain* 0.9, *Green definition* under 1, and *Slope
  darkening* was an even 8% darkening that read as dirt -- removed those three.
  Added **grass sheen** (lighter where mown turf tips away from you, darker
  toward you -- strong on fairways, which the owner liked, and only a gentle
  hint on greens, where full strength looked like a graphical bug) and the
  mower's **clean-up lap** round every green, out to the fringe. **Ground shading** now comes from the
  sun's side instead of a fixed bearing. **Slope tinting** dries turf only as
  far as it is green, which ends the gold and orange banding on desert and
  links. Every remaining green setting now moves a green by 4-6 of 255. Also
  closes *Reading undulation needs more than a cast shadow* (Priority 3): the
  sheen is the midday cue it asked for. RESEARCH.md *Reading the ground,
  again*.

The overnight brief was "greens look flat from every angle"; what it
turned into was five graphics settings and three faults found by the
owner's eye rather than by any measurement here.

- [x] **Measured why greens look flat.** Every shading cue is proportional to
  slope, and a green is the flattest thing on the course by design. At the
  default contour setting a green's shading spans .129 of brightness against the
  .240 ordinary terrain gets. Raising the contour setting would fix the look and
  change how the hole plays, so it is not the answer.

- [x] **The terrain cues ARE applied to greens -- the owner's first guess was
  worth checking and the answer is not the obvious one.** Greens get a weaker
  landform relief (.07 against .15) and a weaker slope-drying colour (.25 against
  1.0), but a STRONGER directional relief than anything else (gain 4 against
  2.6). The problem is the input, not the treatment.

- [x] **Four candidates built behind `lab.greenRead(...)`,** so they can be
  compared live rather than argued about: exaggerate the shading normal, add
  slope-magnitude shading, make the mow bands follow the contour, make the bands
  view-dependent. Presets: off, lift, bands, grain, recommended, strong.

- [x] **Exaggerating the NORMAL beats raising the gain, and that distinction is
  the whole trick.** Gain multiplies the response and clips against the clamp, so
  steep ground saturates while gentle ground stays invisible; tilting the normal
  rescales the whole range so a two-centimetre roll and a tier both move within
  it. Shape contrast .084 to .262, a 3.1x gain, with the geometry untouched --
  the ball still rolls on the real surface.

- [x] **Slope-magnitude shading was rejected by its own measurement.** The
  directional cue should in theory be blind to ground tilted across its bearing;
  measured on real greens that case is 0%. It solves a problem that does not
  occur.

- [x] **Softening the mow bands RAISES how well the shape reads** -- .262 to .309
  -- because a strong regular pattern is the first thing the eye locks onto.
  Bands that follow the contour score nothing on that metric by construction, the
  blur stripping exactly the signal they live in, but they are plainly visible in
  a render and they have a real mechanism behind them.

- [x] **"Sunlight on contours" did nothing in daylight, and the owner spotted
  it.** They said they could not see what it was doing, and they were right. The
  cartoon ground is a four-step toon ramp sampled at `dot(normal,light)*0.5+0.5`,
  clamped flat past .875 -- which a near-flat green reaches above about 48 degrees
  of sun. Tilting the lighting normal measured a brightness span of 0 out of 255
  WITH and WITHOUT the cue at 50, 65 and 80 degrees. It only ever worked at dawn
  and dusk. Not a defect in the ramp: the art direction is flat at midday on
  purpose, which the shader's own comment upstream says in words.

- [x] **Reworked to follow the sun in the turf colour instead.** It asks how much
  more light the patch would catch if the green were as steep as it looks, so
  nothing clamps it: 23.4% variation at 20 degrees of sun, 20.1% at 35, 15.2% at
  50, 10.5% at 65 where the old way gave exactly zero. At 80 it is 4.6%, which is
  physics -- with the sun overhead, tilting a surface barely changes what it
  catches. The `normal_fragment_maps` link in the shader chain is gone with it.

- [x] **Owner's first defaults, set on screen: 100 / 20 / 100 / 50 / 65.** Both
  cues that measured no benefit went on. The measurement said 0% of greens, on
  this generator at that day's settings; a person looking at a green saw
  otherwise, and that wins. Slope darkening was rescaled so 50 is what 100 used
  to be, leaving headroom above it.

- [x] **And then the owner's second set inverted it: 35 / 10 / 20 / 70 / 0.**
  Definition, sunlight and grain came right down; slope darkening went up past
  what used to be full strength; grain went off. The shape of that answer is the
  finding, not the numbers. Definition, sunlight and grain all key off a fixed
  compass bearing or off where the viewer stands, so running them high makes a
  green read as a LIT object rather than a SHAPED one. Slope darkening has no
  bearing at all -- it answers "how steep is this, from anywhere" -- which is the
  question a player is actually asking over a putt. Bands nearly off because a
  regular pattern competes with shape. Whatever gets tried next should start from
  that: direction-free beats directional on a surface this flat.

- [x] **A saved record beat the new default, so the change reached nobody.**
  Graphics settings persist, so anyone who had opened the panel kept the old
  numbers. `GREEN_READ_GEN` makes every saved record adopt new defaults once;
  anything set afterwards sticks. Verified in the browser against a stale record:
  it adopted 100/20/100/50/65, all six uniforms read back correctly on the GPU,
  and a deliberate change to 35 stuck and saved at gen 2.

- [x] **The ground stopped drawing entirely, and it was a deleted replace link.**
  ground.js builds the fragment shader by replacing three of three's `#include`
  anchors. A scripted edit of mine evaluated to `s.replace(anchor,'')` -- an
  accidental empty replacement -- which deleted the `color_fragment` link while
  printing a success message. The block did not vanish; it was appended to the
  `common` chunk at GLOBAL scope, where `vec2 wp=groundPoint.xz;` is a
  non-constant global initialiser. GLSL refuses it, the program fails to link,
  and every draw call raises INVALID_OPERATION.

- [x] **Nothing in the toolchain could see it.** `node --check` passes, the
  bundler passes, all 499 tests passed, and the app boots with NO fatal card,
  because a shader compile failure is not a JS exception. The only signal was the
  ground being absent on screen and `THREE.WebGLProgram: Shader Error` in the
  console. `tests/ground-shader-structure.test.mjs` now checks that every link in
  the chain is present, that each anchor still exists in the three version in
  use, and that statement blocks go to anchors INSIDE main(). Run against the
  broken file it fails with exactly the right sentence.

- [x] **A slider reported the right number while nothing read it.** The owner
  said the shipped settings did less than the ones from the analysis, and they
  were right. `greenBandSoft` was declared, plumbed, exposed on a slider and
  reported back correctly for two commits, while the ONE LINE in the shader that
  used it had been deleted -- removing the neighbouring grain block took the span
  between two anchors with it. Band softening is a third of the recommendation
  (.262 to .309 shape contrast) and it was silently absent.

- [x] **`tests/green-cue-wiring.test.mjs` reads the shader source** and fails if
  a cue uniform is declared and never referenced in the body, or if `greenCues`
  and the shader disagree about names. Run against the broken code it fails with
  exactly the right sentence.

- [x] **The cue never reached the light, which is the bigger miss.** Everything
  tinted the grass; the lighting was untouched, so the whole effect was an albedo
  shift under full sun and tone mapping. Measured, sunlight varies across a green
  by .009 to .024 -- almost nothing. The diagnosis was right; the first fix was
  not. Tilting the normal the LIGHTING uses measured 4.2x the variation in an
  unlit test and exactly nothing in the game, because of the toon ramp -- see the
  entries above, which replaced it with a sun-aware tint.

- [x] **The two rejected cues are back on sliders, and the owner then turned
  both ON.** Their call, and the right one twice over: "0% of greens" was
  measured on this generator at that day's settings, not on every green anyone
  will ever build, and deleting them meant the measurement could never be
  revisited by eye. It was revisited by eye, and the eye disagreed.

- [x] **None of it was ever confirmed on screen by me, and the owner's eye
  closed it.** The drawing buffer reads empty outside a requestAnimationFrame
  callback and the browser pane keeps going hidden, which stops frames, so every
  pixel measurement came back zeros. I could confirm only that the shader
  compiles, that all six uniforms are live on the GPU at the right values, and
  the offline maths. Two of the three faults in this section -- the dead
  `greenBandSoft`, and a sun cue the ramp was eating -- were found by the owner
  looking at a green, not by anything here. On a change that is ONLY a look,
  assume the measurements are blind until someone sees it.

- [x] **The sliders threw on every input event, and it was my markup.**
  `wireSliders` wires every range in a panel to an output named `<id>Value` from
  the input's `data-unit`; there is a `slider()` helper that emits both. I wrote
  the markup by hand and named the readout `...Out`, so wireSliders looked up
  nothing and threw once per input event -- while my own handler worked, so the
  slider moved and the number updated and only the console showed it. Now built
  with `slider()`.

- [x] **The same trap was already set for three older sliders.** `labFirmness`,
  `labStimp` and `timeHour` have no readout element at all. The lookup in
  `wireSliders` is guarded now, which fixes those as well as mine.

- [x] **I SAW THESE ERRORS DURING VERIFICATION AND EXPLAINED THEM AWAY** as a
  stale console buffer left by my own probe script. They survived a reload,
  which should have been the tell. The owner found them. Worth remembering: the
  stale-buffer trap is real, and it is also a very comfortable excuse.

- [x] **DONE: shipped as two graphics settings.** (Later five, at the owner's
  defaults -- see above.) The owner picked "strong" from the comparison.
  **Green definition**, then defaulting to 70, moves the shading tilt and
  the band bending together, because they are one perceptual thing; it maps to
  exactly the numbers that were judged, lift 3.2 and bend 3.5 -- which the
  mapping still produces at 70, so the judged look is reachable. **Mowing band
  strength** is separate because it is taste rather than legibility. Graphics settings rather than course settings -- this is a look,
  not a property of the ground -- so no generator bump, and the fingerprints
  confirm it.

- [x] **The two rejected candidates were removed from the shader, not zeroed --
  and then the owner asked for them back.** Removing them was right by the rule
  against dead uniforms, and wrong by the outcome: both are now shipping cues at
  50 and 65. The lesson is not "keep dead code"; it is that a measurement of a
  LOOK is weaker evidence than a person looking, so a look-only cue deserves a
  slider before it deserves a deletion.

- [x] **A broken import reached the browser and the tests could not see it.**
  `greenCues` was used in renderer.js without being imported: node --check
  passes, the bundler passes, the whole suite passes, and the app dies on boot
  with a fatal card -- because no test loads the renderer. Caught only by
  opening it. The stale console buffer then reported the same error AFTER the
  fix, which is its own trap.

## Menus and settings layout

Asked for on 2026-09-20 from browsing the menus. Each one is a containment
problem: a control that belongs inside a box is sitting beside it.

- [x] **Tooltips belong inside the box they explain.** Done in the walker by id
  pairing rather than in the templates, so the feared fan-out across the custom
  renderers never happened: a tip is `tip-<key>` and its button carries
  `data-tip="<key>"`, so `groupPanelContent` finds each one's owner and moves
  the tip into the nearest `.control-card`, `.control-group` or `.course-plan`.

  NOT by adding `.tip` to `ATTACHED`, which is the obvious one-word fix and a
  trap: every control is emitted followed by its own tip, so an absorbed tip
  would stop ending the absorption run -- and that run ending is the only
  reason the course-length box stays a direct child of the section, which is
  what its `column-span: all` depends on. The one-word version would have
  swallowed the scorecard into the card above it.

  The biome picker needed a box first: a `p.control-label` and a grid of
  buttons, the one setting on the panel with no container at all. Both its
  selectors appear exactly once in the file, so `p.control-label` joined
  `CONTROL` and `.option-grid` joined `ATTACHED` with nothing else affected.

- [x] **The import button belongs to the code box.** The `courseCode` textarea
  and the `importCourseCode` button were siblings. Wrapped in a `.code-import`
  container that owns the border and the corners, with the textarea giving up
  its own and the button sitting under it as a footer bar behind a divider --
  so the seam between them is one line rather than two outlines a few pixels
  apart. Wrapped rather than putting the button inside the `<label>`, which
  would make clicking the label fire the import.

- [x] **The four house controls are one group.** `homes`, `homeDensity`,
  `homeSetback` and `residentialOB` render as one `.control-group` card headed
  "Houses" instead of four separate ones.

- [x] **Wind speed and direction are one group.** One card, deliberately
  unlabelled: a box headed WIND under a heading already saying Weather, holding
  "Wind speed" and "Wind direction", says the word four times.

  Done together, as one mechanism: `FIELD_GROUPS` in the panel builder rather
  than a `group` key on the schema, because grouping is a fact about the panel
  and the schema is also read by validation, migration, the world rebuild key
  and the save format. `.control-group` joins `CONTROL`, so the existing walker
  boxes it exactly like a single control -- and because that walker only looks
  at its root's own children, the fields inside are left alone instead of each
  being boxed again. A group draws at the position of its first member, so
  schema order still decides what appears where.

  Two things fell out of it. The grouped fields' tooltips now sit INSIDE the
  box, because they are emitted within the wrapper -- a free partial win on the
  tooltip item above, which is still open for every ungrouped field. And
  toggles finally have a size: `label.toggle` carried no styling at all beyond
  a margin on its `i` button, which is why they read as the loose controls in
  the panel.

- [x] **The seed sits with the hole count.** It was last in the Course tab,
  below the full-width scorecard box -- which spans every column and breaks the
  flow, so anything after it drops underneath. `holes seed courseYards` now,
  the two one-line choices together above the card they produce.

- [x] **The Water tab's note explains the tab, not its history.** The merged
  note opened by saying still and moving water used to be two panels. That is a
  changelog entry, and it had been written into the help text a player reads.
  Removed; what remains is the two original notes, which state what the
  controls do. Every other tab note was checked for the same mistake and none
  had it.

- [x] **A control's own parts sit inside its box.** The layout picker's grid of
  shapes and the "Surprise me" button beside the seed field were siblings of
  their control rather than part of it, so both sat outside the card. Neither
  was new, but it showed once descriptions moved inside that card: the card
  looked finished with a piece of its own control stranded underneath.
  `.footprint-icons` and a `.field-action` class join `ATTACHED`. Bare `button`
  could not, because it would swallow every panel action on the way past.

- [x] **A box that names the feature lets its fields stop repeating it.** The
  Ponds box said "Pond frequency" and "Typical pond size"; the Houses box said
  house four more times. A `short` label on the schema entry now carries the
  trimmed text -- "Frequency", "Typical size", "Occurrence".

  Display only, and that distinction is the whole care in it: `label` is the
  ACCESSIBLE NAME on both the range input and the `i` button, so shortening it
  outright would have announced a slider as "Minimum" and its help button as
  "What Frequency changes". `label` is untouched and still what assistive
  technology receives.

  The flag is passed into `control()` rather than read off the field, so a
  short label can only appear beneath a heading that supplies the missing
  noun. Move a field out of its box and it goes back to saying what it is.
  Sixteen fields carry one; the unlabelled wind box deliberately has none.

- [x] **Still water and moving water are one section.** "Ponds & lakes" and
  "Rivers & creeks" were two tabs, so setting up a pond and a creek on the same
  course meant two of them. One `water` category now, with a box per feature:
  Ponds, Lakes, Rivers, Creeks.

  Six boxes rather than four, and the two extra ones are the point. The depth
  range is read identically by ponds and by lakes -- `lakes.js` uses the same
  `waterMin + rng()*(waterMax - waterMin)` that ponds do -- and channel depth
  and meander are read by rivers and creeks alike. Folding either pair into a
  feature's own box would claim it belonged to that feature. They sit in their
  own boxes saying who they serve.

  That also caught two wrong tips: `waterMin` and `waterMax` both said "a
  pond's deepest point" while lakes have always used them too. Corrected --
  leaving them inside a box labelled "Depth of ponds and lakes" would have been
  incoherent.

  The depth pair moved down the array so the box lands after both the things it
  governs. Array order is the panel's order and nothing else's: 446 tests pass
  and every biome fingerprint is unchanged, so no generated output moved and no
  version bump is owed. SCHEMA_VERSION stays too -- no control was added,
  renamed, removed or re-ranged; only which tab it appears on.

- [x] **The studio's two entry points are backwards.** The panel ended with a
  Regenerate button emitted after every category, so it fell into whichever
  section came last and turned up at the foot of the Weather tab looking like a
  weather control. It called `regenerateStudio()` -- exactly what the studio
  bar's own Regenerate calls -- and the bar is on screen whenever this panel can
  be opened, since both ways in are studio-only (`enterStudio`, and the bar's
  Settings button). A duplicate, in the wrong place. Gone.

  What is left is one verb each way round: "Grow this landscape" starts a
  studio and shows only during setup, pinned to the panel's lead by
  `data-panel-action` so it cannot fall into a tab; once a landscape exists,
  regenerating it belongs to the bar. The panel's own prose now names the bar
  rather than saying "regenerate" with no button in sight.

## Ball flight, after the GC3 session

- [x] **The lift cap was holding the ball down.** `liftCap` 0.2913 binds at a
  spin parameter of 0.342 and half a GC3 session launched already clamped, so
  apex came out low on 100 shots out of 100. Carry hid it, because a flatter
  ball also carries less induced drag and the two errors cancel. Cap is a guard
  rail at 0.60 now (unreached below S 1.55), `spinDrag` moved 0.2025 to 0.23
  toward the published slope. Apex -8.05 ft to -0.22 ft, carry and offline both
  improved as well.

- [x] **The two monitors disagreeing about apex is expected, not a fault to fix.**
  Owner's call, 23 September 2026, and it closes the question rather than
  deferring it. GC3 says the model flies low, SkyTrak said it flew high, on an
  overlapping spin range. Each device runs its own algorithm -- they do not
  measure apex so much as derive it, from different inputs -- so there was never
  one true number to land on, and "something has to give" was the wrong framing.
  **The target is reasonable agreement across devices, not exact agreement with
  any one of them.** The curve trusts the GC3 because it is the better
  instrument; that stays a judgement about the references, openly.

## Graphics work the profiling turned up

Found while building `tools/profile.mjs` and reading the tier table against it.
None of these are tuning -- they are missing capability or wrong plumbing, so
they were written down rather than done. Asked for on 2026-09-22 as the place
to put "potential gfx improvements" instead of inventing features overnight.

- [x] **WON'T DO (owner, 1 October): `applyQuality` clamps pixel ratio to the display's own.**
  A fact to know rather than a fault to fix, closed as it stands.
  `setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio))` is correct, but
  it means the tier ladder collapses on a 1x display: low, medium and ultra all
  render the same pixels and differ only in shadows and reflections. That is
  worth knowing before anyone concludes from a 1x machine that the tiers do
  nothing. It also caught this harness out -- see the note in profile.mjs.

- [x] **The menu hole stuttered as the game opened; and it is daylight only
  (1 October).** Branch `frame-and-lights`, reported by the
  owner. The menu hole's first real frames (117-217 ms on Ultra: the first
  render with the orbiting camera, the cull's first sort, the grass ring) fell
  inside the splash's fade. The menu now opens under the splash, which fades
  only once three frames in a row run under 40 ms (two seconds at most); every
  loading overlay holds the same way (one second at most), and the menu
  reached from a round opens inside that wait. Measured, four cold opens: no
  frame over 25 ms once the splash starts to fade. Returning to the menu from
  a round: at most one 33 ms frame, where main froze for 0.6 s and 3.7 s on
  the same path. The menu hole is never at night any more (dawn to golden
  hour, nine hours to rotate through); a player who wants night sets the
  clock in a round. RESEARCH.md *The menu hole: daylight, and no stutter as it
  appears*.

- [x] **The floodlights froze the game on Ultra, and the work moved into
  loading (30 September).** Branch `frame-and-lights`, reported by the owner:
  a MASSIVE freeze when the floodlights came on, and a freeze after loading.
  Measured on Ultra, PNW: the first switch-on froze for 11.3 s on main, 16.1 s
  on this branch before the fix, 26 s on eighteen holes; nothing at all on
  High. Cause: Ultra draws the scene into bloom's off-screen target, and three
  picks a program's version partly from the bound target, so every warm-up --
  the loading screen's and the background floodlight one -- built versions no
  frame used. Fixed by compiling against the target the frame draws into
  (`asDrawn`). Then, as the owner asked, the floodlit programs are built
  behind the loading screen, every round starts with the floodlights OFF, and
  a round built through Play starts at MIDDAY ("Start at my local time" still
  wins). Measured after, Ultra and High, nine and eighteen holes: no frame over
  50 ms after loading, switching on, off or on again. Loading, Ultra: nine
  holes 7.1 s on main -> 6.8 s, eighteen ~10 -> 11.9 s; opening the game to
  the menu 4.6-7.7 s -> 3.1-5.5 s. A hole change also froze for 83-100 ms (on
  main too): the warm-up spent 70 ms filling the grass ring with no overlay
  up; now it fills a tile a frame. RESEARCH.md *The floodlight freeze on
  Ultra*.

- [x] **WON'T DO (owner, 30 September): a tier drawing less vegetation.** The
  frame on a heavy biome is dominated by tree geometry, and no tier knob
  reaches it: `grass` scales scatter grass (under 1% of the triangles on
  Redwood) and `foliage` only the DRAWN trees' segments, nothing on biomes
  planted with instanced models. A tier may not plant fewer trees (trunks are
  collidable; two players on different tiers must hit the same ones), so the
  only legal lever was drawing fewer while colliding with all -- a tier-driven
  draw distance or level of detail. The owner does not like the look of
  drawing fewer trees and plants, so it is closed rather than left open. What
  weak hardware has instead: Low's own trims, distant crowns drawn as their
  thinned twins (F2), and automatic resolution (F4).

- [x] **Floodlight shadows, on every tier, with a switch (30 September).**
  Branch `frame-and-lights`. The texture unit they were blocked on was freed by
  packing four of the ground shader's per-hole tables (route, tees, cups,
  hazards) into one (`HOLE_ATLAS`, ground.js): the ground now uses 10 of the 16
  units WebGL guarantees on Low and Medium, 12 on High and Ultra, where it used
  13 and 15. Measured, a floodlit night now links six casting lamps on Low and
  Medium (fails at seven) and four on High and Ultra (fails at five); the tiers
  use five and three, keeping ONE unit spare so the next texture added to the
  ground cannot make it vanish at night again. Pixel-compared against the
  build before over fifteen views on five biomes: identical within the noise
  between two runs of the same build. The lamps nearest the shot cast; their
  maps are redrawn only when a lamp moves or the view does (at most every 200
  ms), so they cost nothing frame to frame (High 4.2 ms on and off; Low 2.9
  against 2.6). **"Floodlight shadows"** in Graphics, under Costs a frame, on
  by default; the first switch on a course builds every floodlit shader again
  in the background (4.4 s on an Ultra nine once shaders were compiled for the
  right target -- 14 s before that fix; the game running smoothly) and says
  so, then instant. `tests/flood-shadows.test.mjs`
  fails if any tier's count would leave no spare unit; the `floodlit-night`
  smoke journey plays Ultra at night with the lights on. RESEARCH.md
  *Floodlight shadows*.

- [x] **Floodlight and glow ball strength sliders (30 September).** Branch
  `frame-and-lights`. Two sliders in the Weather & time popover, 0-200% of the
  tuned brightness, saved with the other time settings; uniform writes, nothing
  rebuilds. The popover now scrolls within the screen: with the sliders it no
  longer fit a 720 px window, and the bottom of it could not be reached.

- [x] **Fog distance was not a performance setting.** Closed by F5a: the far
  plane now follows the fog, so nothing past it is drawn -- which, measured,
  was almost nothing anyway.

- [x] **Turning water reflections off did not stop the reflection work.**
  Closed by F5b: the per-frame reflection pass had already gone with the
  planar mirror; the probe re-taken as the sun moves was still taken with
  reflections off, and no longer is.

- [x] **`high` and `ultra` were very nearly the same tier.** When this was
  written the difference was bloom, a bigger reflection buffer and overview
  shadows. Ultra has since taken sharper shadows (6144, radius 4) reaching
  3.5 km against High's 2.5, and on branch `ultra-looks` a forest floor of
  ferns and fallen sticks round the camera (U6), which is what a player
  standing among the trees actually sees change. The Quality note in Graphics
  says so. Four rungs.

## Benchmarking and profiling worth deciding from

Asked for on 2026-09-20, off the back of the "should this be ported" question in
RESEARCH.md. The conclusion there was that nobody knows what binds the frame --
it is measurably NOT vertex throughput -- and that no performance decision
should be taken until somebody does. This section is how that gets known.

**What exists.** `tools/bench.mjs` measures GENERATION: twelve courses across
twelve workers, eight invariant rules that must stay clear, counts, and
distributions with min/p05/median/p95/max. It has a saved baseline
(`bench/baseline.json`) and a `--since` diff. `tools/biome-fingerprint.mjs`
proves the generator did not move. Both are good and neither one renders
anything.

**What does not exist.** Any measurement of a frame. The only frame numbers this
project has ever had were taken by hand, with a probe temporarily pasted into
`renderer.js` and deleted afterwards, on one machine, on one course.

- [x] ~~A frame benchmark~~ (built: `tools/profile.mjs`; closed 1 October, original note below)
  THE TRAP, WRITTEN DOWN BECAUSE IT ALREADY CAUGHT US ONCE: a timer wrapped
  around `renderer.render()` reads 8.3 ms on a 120 Hz display no matter what it
  is asked to draw, because the call is waiting for the display, not for the
  GPU. That number was taken as real, a level of detail was built on it, and
  the forest looked dead for a fortnight. `requestAnimationFrame` intervals are
  the same lie in a different hat, and `gl.finish()` does not save you --
  Chrome's command buffer makes it close to a no-op.

  So the first requirement is not a feature, it is a property: **the harness
  must be capable of reporting a number lower than the refresh interval.**
  Prove it on day one by drawing an empty scene and checking the figure
  collapses. If it does not, the harness is measuring the monitor.

  Ways that actually work, roughly in order of how much they are worth:
  - `EXT_disjoint_timer_query_webgl2` for real GPU time per pass. The only
    thing that tells you where the time goes rather than how much there is.
  - vsync off, via headless Chrome with `--disable-gpu-vsync` and
    `--disable-frame-rate-limit`, then render as fast as the machine allows.
  - render to a framebuffer in a loop, with no presentation at all.

- [x] ~~Decide what headless is for~~ (built: `tools/profile.mjs`; closed 1 October, original note below) A software rasteriser (`--use-angle=swiftshader`) gives
  figures that are comparable between machines and over time, and are not the
  truth about any real GPU. A real GPU in headless Chrome gives the truth about
  THAT machine and nothing comparable to a run on another one. Both are useful
  and they answer different questions -- regression tracking wants the first,
  "will this run on the owner's laptop" wants the second. Say which the harness
  is for, in the harness, or the numbers get read as the wrong kind.

  Cost to be honest about: either route is a Playwright or Puppeteer
  devDependency, and this project has treated a 24 MB devDependency as a real
  cost before (it is why `vendor/baked_assets` was committed, until 30
  September). Weigh that
  deliberately rather than installing it on the way past.

- [x] ~~Sweep the presets~~ (built: `tools/profile.mjs`; closed 1 October, original note below) Eight biomes,
  fourteen footprints, two hole counts, the graphics tiers in `src/graphics.js`,
  plus elevation, landform, water, trees and homes is a combinatorial explosion
  that nobody will ever run twice. Pick a matrix that is a FEW DOZEN cases and
  says why each is in it: every biome at defaults (the common path), every
  graphics tier on one heavy biome (the tier is the lever players actually
  pull), the extremes that are known to be hard -- redwood for geometry,
  elevation 100 / landform 100 for terrain, maximum water and homes for draw
  calls -- and the driving range, which is the flattest and should be the
  floor. A sweep that takes four minutes gets run; one that takes an hour gets
  run once and quoted for a year.

- [x] ~~Report what a decision needs~~ (built: `tools/profile.mjs`; closed 1 October, original note below) Frame time
  as a distribution and never as a mean -- median, p95, p99 and the worst
  frame, because stutter is what is felt and a mean hides it. Beside it, per
  frame: draw calls, triangles submitted, programs, texture binds, and the GPU
  timer split by pass if the extension is there. Then generation time and peak
  memory per case. The existing bench's table format is the right shape
  already: columns of min/p05/median/p95/max with the case names down the side,
  a `rules: all clear` line for anything that must not regress, and a `--since`
  diff against a saved baseline so a change shows as movement rather than as
  numbers somebody has to remember.

- [x] ~~Have it name the bottleneck~~ (built: `tools/profile.mjs`; closed 1 October, original note below) The question is not
  "how many milliseconds" but "of what". A run should end with a sentence a
  human can act on: whether the frame is bound by draw calls, by fill, by
  shadow passes, or by the CPU walking the scene graph -- and the simplest
  version of that is an ablation rather than a profiler. Render the same frame
  with shadows off, with the grass off, at quarter resolution, with the
  vegetation removed, and print what each one gives back. Whatever returns the
  most time is the answer, and it needs no tooling beyond the harness that is
  already being built.

- [x] **WON'T DO (owner, 1 October): the low tier cannot reach 30 fps on weak hardware, and
  tuning cannot fix it.** Measured on a software rasteriser: 3,034 ms a frame against a
  33.3 ms budget. Retuning moved it 6%. SwiftShader is the floor rather than a
  typical weak device -- real integrated graphics is perhaps one to two orders
  faster, which is the difference between playable and not, and that range is
  an extrapolation this machine cannot narrow. What is certain is that a
  hundredfold gap does not close by tuning. The vegetation draw distance that
  was the remaining lever is closed as won't do (the owner, on the look);
  automatic resolution (F4) is what Low has now. The real number needs a real
  weak machine.

- [x] **WON'T DO (owner, 1 October): then, and only then, act on it.** RESEARCH.md has the order: find the
  bottleneck, consider WebGPU before rewriting anything, WebAssembly for
  generation if seven seconds a course becomes intolerable, a desktop shell if
  this becomes a sim bay, and an engine port only if all of that has been done
  and something still does not fit. The value of this section is that it makes
  step one possible; skipping to step five has already been tried in miniature
  and it produced the dead forest.

- [x] **A frame benchmark, and it must not be able to return the refresh rate.**
  `tools/profile.mjs`, `npm run profile`. THE CHECK CAUGHT IT: a blank page read
  17.3 ms because headless Chromium paces animation frames to a virtual 60 Hz
  display whatever `--disable-gpu-vsync` is told. So it measures WORK instead --
  time inside the frame callback, plus a `TIME_ELAPSED` query spanning it -- and
  asserts both collapse to 0.000 ms on an idle page before reporting anything.

- [x] **Decide what "headless" is for.** Both arms, labelled. The real GPU
  answers "how much headroom is there"; a software rasteriser answers "what
  happens with no graphics card". `npm run gpu` prints the renderer per launch
  config, because default flags give SwiftShader silently -- and it also showed
  the real card reporting 16 texture units against SwiftShader's 32, which
  independently confirms the ceiling the floodlight comment describes.

- [x] **Sweep the presets, but do not sweep the product of them.** 29 cases in
  six groups: the tier ladder, the same ladder in overview, every biome at one
  tier, an ablation, a pixel-ratio group and the software arm. Each is in the
  file with a stated reason. About eight minutes for the lot.

- [x] **Report what a decision needs.** Distributions not means, CPU beside
  GPU, draws and triangles per frame, `--save` and `--since` against
  `bench/profile-baseline.json` in the shape `bench.mjs` already uses.

- [x] **Have it name the bottleneck.** It is geometry, and it is one biome.
  (Figures below from the old probe, which halved triangles and read times
  near the fastest frame; see RESEARCH.md *The profiler counted every frame
  twice*.) Redwood draws 92.9 M triangles where every other biome draws 3.1-4.6 M --
  twenty times, for 12.66 ms against about 4. Cascades double it (46.5 M to
  92.9 M). Pixel ratio is worth 26%. Every ground-cue toggle is free, inside
  the noise. The reflections toggle does nothing at all: 208 draws either way.

## Priority 1: correctness and continuity

- [x] **Drainage-aware rivers and creeks.** Generator 13. The course is solved once as a drainage model -- priority-flood depression filling, D8 flow directions, flow accumulation -- and each channel is a walk down the flow directions, so it cannot spiral or cross itself by construction (0 self-overlaps against 2716). A channel that reaches a surviving depression crosses it to the bottom and ends in a real pond, built through the same `fitPondBasin` every other body uses; the mouth meets the shore within 3 m and the two water levels agree exactly. `SINK_FILL_AREA` swept to 15 000 m2: same channel count as 40 000, but 8 terminal ponds against 1 and 9 faded-out endings against 17.

- [x] **Water keeps out of play.** No channel over a green (was 3 in 216, one 16.2 m inside), none across a playing corridor, none within 26 m of a pond or lake it did not create, and no pond crossing a fairway -- while a pond still bites into one about one time in six, median 5.7 m. The keep-out displacement is smoothed along the path before it is applied; moving each station by just what it needs creased the curve to a 0.00x-half-width bend and flipped the water quads face down.

- [x] **The back tee was the low one, and a quarter of tee shots were blind.** Generator 14. A tee complex is levelled as one piece: the three natural heights are compressed toward their mean, then ordered so the back tee is never below the one in front (34% of holes were backwards, worst step 2.9 m; now 0%), and the whole complex is lifted until the shot clears the ground in front of it, capped at 3.5 m (blue tee shots blocked over 1 m: 23% to 3%). Pad flatness improved as a side effect, worst spread 0.35 m against 0.46. Rejected: forcing holes uphill, which costs the good downhill holes and does not address intermediate crests; one flat terrace, which reads as a driving range on a long hole; shaving the crest, which reshapes the interesting terrain.

- [x] **Tee plateaus are ovals, and blind tee shots are a dial.** The flattened ground was a box while the tee and its collar are ellipses, so flat corners jutted ~3 m past the paint; the plateau now matches the paint and reaches the apron. Normal jump around a pad 2.6 to 0.8 deg median, collar relief 0.33 m to 0.01. `blindTees` (default 0) is the share of holes allowed to keep a blind shot.

- [x] **The corridor ridge was a plateau.** It clamped the corridor distance at zero, so every point inside a corridor got the same raise -- and a constant offset preserves the gradient underneath it exactly, so water ran through corridors as it always had and the keep-out repair pass was left doing a router's job, oscillating instead of converging. The ridge rises inward now: zero violations, 70 of 72 channels still placed, median length unchanged.

- [x] **A measurement harness.** `tools/bench.mjs` shares one generation pass between every metric and builds the courses across all cores: 768 s of generation in 29.7 s wall, 25.8x. Three fixture tiers, named invariants that must stay at zero, and a saved baseline with `--since`. Found a real bug on its first full run -- channel headwaters climbing onto the corridor hills the ridge fix created, on a seed the test fixture did not include.

- [x] **Finding the nearest hole was 15% of building a course.** Each hole carries a rough box now, so `nearest` rules one out without measuring it; the previous winner is tried first, and the per-group minimum behind `other` is only kept on islands, the one biome that reads it. An 18-hole course builds in 8.4 s against 15.8, the test suite runs in 140 s against 217, and the measurement sweep in 20 s against 30. Proven to change nothing: the baseline reported no movement and a terrain fingerprint over eight courses is identical before and after.

- [x] **One tee on a short hole, and earthworks off greens.** The pad is separate from the marker now, so a par three gets one long tee with the markers down it: 0 overlapping pads against every one of 66 par threes overlapping before. Tee earthworks reach half as far and fade before a green -- steepest patch on a green 9.9 degrees to 2.2, worst pad relief 0.58 m to 0.07. Channels also gained: a route that fails its profile or cannot be cleared of play now falls through to the next candidate instead of losing the channel, 87 of 90 placed to 90 of 90.

- [x] **Tee siting from the terrain.** Each pad tries forty-odd nearby sites and takes the one the ground already suits: 653 of 678 moved, median 19.9 m, tees now sit a median 10.1 m off the centre line with real height differences between them, and the chosen ground is only 0.85 m uneven at the median. Blind shots 80 of 810 to 53. Earthworks fall away over a short rounded shoulder instead of a long ramp -- and the ground round a tee is now smoother and gentler than the countryside it sits in (95th percentile smoothness 4.4 degrees against 13.7, slope 20.7 against 43).

- [x] **Raised tees, merged collars, and the landform theory.** A clear shot is now worth 10 against flat ground when siting rather than 1.6, which cut pads raised for sightline from 198 to 122 and blind shots from 53 to 33 at the same time. Collar overlap is scored, not banned: 12% of pairs to 1%. Pads whose shoulders would meet share a level so a complex is one platform, not three humps. The green guard reaches the mown surround, not just the fringe, which is what was painting a brown scar beside greens.

- [x] **The corridor trough behind the tee.** A quarter of the surrounding relief comes back there, and it is better than none on every axis at once: tees cut into real ground 115 to 201, tees propped up for sightline 124 to 113, blind shots 33 to 27. The four earlier attempts failed because every sweep counted 'sites needing real earthwork' as a cost when it is the thing being asked for. Elevation 0 is now a baseline rather than dead level, the driving range excepted. The trough along the fairway itself is untouched and should stay that way -- it is what makes a hole read as a corridor.

- [x] **The blindness check could not see tee boxes.** It read the shaped land with no tee pads in it, and sampled the centre line while tees now sit a median 19 m off it -- so it was measuring a shot nobody plays over ground that omitted the thing in the way. From the real tee along the real line: shots blocked over 1 m 103 to 74, downhill 89 to 68. The bench figure appears to treble because the metric was fixed in the same pass; only the same-method pair is a fair comparison.

- [x] **Tee shapes.** Rounded rectangles instead of ovals, squared to the same aim the markers use, 6 by 9 m with the collar at 1.45x, and the site score prefers a lateral stagger. Shots blocked over 1 m from the real tee 74 to 19, of those blocked by another tee 23 to 2, downhill 68 to 13, and the lowest quarter of sideways gaps 1.5 m to 11.7. The par three special case is deleted rather than improved: at this size three ordinary pads fit down a short hole, so they get three tees and the existing levelling rule gives the stepped form. `fairwayMiddle` and `teeAim` moved into course.js so there is one answer to where a tee points.

- [x] **Clouds fade out and in instead of popping.** A wrap is a four-kilometre jump. Opacity is now a function of distance to the edge of the box rather than of the wrap, so a cloud thins out as it leaves, wraps while invisible, and thickens as it returns -- one rule for both ends, and no step at the jump (largest single-frame change 0.0067). The shadow shares the same opacity. Uncovered a real trap: 'userData.clouds' meant BOTH "already patched" (set by applyCloudShadows on every material it touched) and "is a cloud" (set by clouds.js on one). The fade keyed on it, patched 34 materials instead of 1, and every geometry without the fade attribute read zero alpha -- the whole course invisible at Ultra, with nothing in the console. Split into 'cloudShadowed' and 'cloudMesh'.

- [x] **A biome is one record.** Seven tables and 48 conditionals across eight files consolidated into `src/biomes.js` -- defaults for 45 fields, traits listing only the differences. The ground shader took a biome as an index into a four-element array, so a new name became -1 and took whichever branch that was; it reads four named flags now. Proven invisible: `tools/biome-fingerprint.mjs` hashes what each biome generates and all seven are byte-identical.

- [x] **Giant Redwood biome.** One record, one dropdown entry, two species and a tree builder. Sun at 18 degrees for raking light, a desaturated sky which the fog colour follows, dark lush palette, PNW landform. Redwoods are a drawn tapered trunk carrying a borrowed conifer crown narrowed to 40% and lifted to the top, because every pack conifer is conical to the ground. Tree height became a biome field on the way -- hardcoded 13-29 m made the first grove a tinted pine wood -- and redwoods run 46-80 m, which needed the physics trunk collision cap raised from 0.8 m to 2.4 (it only binds above 29.6 m, so nothing else moved).

- [x] **Redwood assets.** Searched, and most of it was already in `vendor/` and simply not ingested. 24 models added to `PICK` (fallen logs, stumps, mossy boulders, leafy ground plants): 71 shipped of 598 available becomes 95, packed geometry 1056 KB to 1238 KB, build 2.59 MB to 2.78 MB. The floor scatter is a `deadfall` count on the biome, 72% of it anchored to existing trunks, 877 instances in 31 draw calls on a redwood course. Ferns are a real `swordfern` species so PNW's generic bushes are untouched. Along the way, the two hand-written "not really a tree" lists in course.js and physics.js -- which were NOT the same list -- became `GROUND_PLANTS` and `NO_TRUNK` in `src/species.js`.

- [x] **A fern that is actually a fern.** Stylized Nature MegaKit vendored; `swordfern` draws `Fern_1` and two of its ground plants.

- [x] **Redwood crowns were needles.** The crown width was inherited from whichever model was borrowed rather than stated, so it varied 2.5x within one grove and the narrow end was 3 m of foliage on a 36 m crown. Width is now a stated fraction of tree height with the model's own divided out: 8-12 m over 21-29 m, measured in the scene. Crowns ship as leaf geometry only, trunk taper relaxed from .34 to .62.

- [x] **Giant redwoods, and a tree as tall as it says.** Max height to 380 feet with the floor unchanged. The drawn trunk now calls `trunkRadius` so the trunk you see is the trunk you hit -- it was drawn thinner than it collided, by over a metre at this height -- and that function's clamp went 2.4 m to 3.6 m so it stops binding on anything the generator makes. 6.2 m trunks under 80 m bare columns. The crown takes whatever height the trunk leaves rather than being a second jittered fraction, which had been stacking to 112% of the stated height and leaving the top 35 feet as scenery a ball flew through.

- [x] **Crowns that were wedding cakes.** The MegaKit pines are tiered -- radius alternating wide-narrow every band -- which at this scale is five green plates with daylight between them. Swapped for the only two crowns across six packs whose profile rises to one peak and falls, `PineTree_2` and `PineTree_4`. Measure the profile before adding a third.

- [x] **Trees had no spacing rule.** None at all -- placement checked surface and corridor distance and never checked other trees. At 380 feet the closest pair stood 0.2 m apart and the worst trunks intersected by 5.4 m. `crownShare` on the biome: two crowns may not share more than 55% of their combined radii, trunks never intersect. On for redwood, zero for the other seven, because switching it on relayouts them all -- the ungated first version moved seven biomes and the fingerprint caught it.

- [x] **A mid-storey.** A plant entry's third number scales that species' height, so the redwood grove's cedars are 30% of canopy rather than 380-foot christmas trees standing inside the redwoods.

- [x] **The canopy floated off the trunk.** Trunk leans about its middle, crown leaned about its base on the vertical through the tree centre -- same angle, different pivot, up to 4 m apart at this height. The crown is seated from the trunk's own matrix, the lean is a third of what it was, and the sleeve is 20% of the trunk rather than 8%.

- [x] **An asset contact sheet.** `npm run assets`.

- [x] **Redwoods generated rather than found.** ez-tree (MIT) at bake time: four variants in `vendor/eztree-redwood/`, crowns starting 45-60% up the trunk with zero silhouette reversals, 18.5k-27k verts each. The library is a devDependency and never ships.

- [x] **Match the bake to real redwoods.** Against published descriptions rather than memory: straighter trunk and gentler taper, 26 thick branches rather than 42 thin ones, branches horizontal to slightly drooping, foliage out at the branch ends, and a buttress flare at the foot (42% wider at ground level) because every quoted redwood diameter is measured above the swollen base and the library tapers uniformly. Bark is textured now -- Poly Haven's CC0 willow bark, tiling baked into the UVs.

- [x] **The bark ran sideways.** Three attempts. ez-tree's `v` is 0,1,0,1 per vertex ring, so multiplying it crams tiles into every section AND every ring is a mirror axis; `u` at a fixed count squares the tile on one girth of trunk and squeezes it on all the others. Both coordinates are rebuilt from the geometry now -- `v` as arc length along the branch over a stated ~2 m tile, `u` from each ring's own circumference. Four attempts in the end: the branch split used a median over the whole mesh, so on a tree with many short branches the trunk's own sections each looked like a new branch and the whole trunk carried one `v`. It is a local comparison now, with a floor so coincident rings still advance. Every trunk measures 1.42-1.70 units per tile against a 1.7 target. Two of the checks had been lying -- one skipped the collapsed triangles as a divide-by-zero guard, the other sampled only brown pixels on grey bark. Both are fixed and the bake now fails on a collapsed UV basis. AND THEN IT TURNED OUT NOT TO BE THE BAKE: the ingest and the previewer packed UVs into 16 bits across 0..1, which is right for a house atlas and clamps tiling bark to a single stretched row. `uvSpan` per part now records the real range. The check that would have caught it measures how much DETAIL is on the trunk, not which way it runs -- a smeared row is vertical too.

- [x] **A forest, not a tree.** Twelve models: four mature redwoods (two of them branching much lower), two young skinny ones, two douglas firs, two red cedars for the mid-storey, a bigleaf maple and a dead standing snag.

- [x] **Trunks painted, not textured.** No bark image is carried at all; each species states a bark colour, converted from sRGB because MTL `Kd` is linear.

- [x] **The pack canopies are textured at last.** `PineTree_2`/`_4` and the MegaKit ferns are fully mapped and their packs ship the sheets -- the OBJ exports just never reference them, or reference an absolute `C:/` path. 92 of 741 models textured in the previewer, against 12.

- [x] **Renamed to `vendor/baked_assets`.** It stopped being only redwoods several species ago.

- [x] **Stylized hybrids.** Six models pairing ez-tree's trunk and limbs with Quaternius's `PineTree_2` and `_4` foliage at redwood proportions, in two dressings: one crown capping the bare trunk (5.5-7k verts) or a spray at the end of every main limb (23-51k). The caps are an order of magnitude cheaper, which matters more than file size.

- [x] **Twenty-two trees composed from the packs, no generator.** `tools/bake-assets.mjs` into `vendor/baked_assets`: stretch the bole of a `DeadTree` to redwood proportions, flare the foot, dress it with a borrowed crown as one cap or as sprays. `Redwood_Old_A` is 1,321 verts against 17,000 for the cheapest generated one.

- [x] **`vendor/eztree-grove` renamed `vendor/baked_assets`** and is now the dumping ground for anything composed or generated.

- [x] **A grove grown from nothing.** 153 models in `vendor/grown-redwood-forest` -- redwoods, firs, hemlock, cedar, broadleaves, snags, stumps, nurse logs, sword ferns, salal, sorrel, seedlings, moss, boulders, litter -- with no imported vertex and no texture, shaped against 315 measured reference photographs. 922k vertices, mean 6k.

- [x] **A contact sheet.** `preview/sheet.html`: every model in one canvas at its real height beside a 1.8 m figure. How the flat ferns and the twelve identical firs were caught.

- [x] **The redwood biome is entirely grown.** Nine species, none imported: redwood, douglas fir, hemlock, red cedar, tanoak, seedlings, sword fern, salal, sorrel, plus grown nurse logs, stumps and boulders as deadfall. `addTallConifers` and its 121 lines of drawn cylinder are gone.

- [x] **The two-level LOD was built, then removed as unnecessary.** It was justified by arithmetic and confirmed by a benchmark that turned out to be reading the 120 Hz vsync interval in both arms. Measured honestly, the grove draws 33.6 M vertices a frame at 117.6 fps. The swap's only visible effect was that nearly every tree on screen was the thinned twin -- the "dead forest" and the pop-in. Gone.

- [x] **The foliage palette was the colour of a shadow.** Clustering 315 photographs and taking the dominant green returns the shade, because most of a photographed grove is shaded. Canopy `#3b4b2a` to `#62784a`, understory to `#6b9046`, saplings to `#83ad55`, and density up by half again now that the budget is known not to bind.

- [x] **Wire the baked trees into the game.** ~~Superseded.~~ The ez-tree bake was abandoned for `tools/grow.mjs`, which grows whole trees with their own trunks and needs no sprite sheet. The size estimate here was right and irrelevant -- the bundle is 15.79 MB and nobody minds. The frame estimate was wrong: 33.6 M vertices a frame draws at the refresh cap.

- [x] **Two detail levels per baked tree.** ~~Not the blocker. Not a blocker at all.~~ Built, measured against a benchmark that was reading vsync, and removed. See RESEARCH.md; the honest number is that eleven times the geometry costs nothing measurable on this path.

## Priority 2: landscape and performance

- [x] **A CC0 grass model for the near-field tuft -- not needed.** Closed on
  branch `ultra-looks`. The question was whether to buy the near grass a real
  model; instead the near tuft became a hand-built clump of seven curved,
  tapering blades (21 triangles, inside the 20-40 this entry had priced as
  affordable for `addNearbyGrass`), lit like the ground and darker at the root,
  and the owner approved it. No outside asset, so nothing to license.
  RESEARCH.md *Rough grass clumps*.

- [x] **Water sits on land, and a pond may split a hole.** Channels were being drawn on the seabed (2302 of 2452 stations at sea on a measured island seed) and were chosen for length, which after trimming selected runs entirely off the map. Island courses now carry no inland water at all -- the ocean is the hazard -- and Links keeps its coast handling. A mown semi-rough band now comes round every pond, lake and channel that meets a fairway, in the ground shader AND in the lie -- the first attempt changed only the lie and was invisible, see RESEARCH.md. Ponds may bite into a corridor or cross it, with the carry measured rather than assumed: 6% of holes split at default settings, median carry 33 yd, longest 101 yd at maximum water.

- [x] **A lake could be dropped on top of a pond.** `addLargeLakes` checked separation only against lakes it had already placed, never against the ponds generated with the holes -- 10 overlapping lake-pond pairs across 12 courses, worst pair with water surfaces 14.19 m apart. Fixed at no cost: 0 overlaps, all 36 requested lakes still placed.

- [x] **Tees beside a creek, and a river that read as a trench.** The channel soften block repainted tees (corridor geometry only, no idea a tee is there) -- suppressed over tee ground; island tees looked fine throughout because islands have no channels. Tee tilt was three things: `carve` protection threshold coming out negative for tees, tee pads missing from the mesh refinement list, and one attempted fix (returning the pad's level inside the pad) that put a step at the boundary and was reverted. Median tee spread now 0.000 m. River banks halved: 1.00 m of rise to 0.58 on the reported seed.

- [x] **Four regressions from the water work, one cause behind two.** `foreshore` keyed on elevation instead of coastal proximity, reshaping whole courses (a links tee 510 m inland dropped 2.3 m) and amplifying every slope it touched by up to 1.67 -- both the steep edges and the unflat tee pads, now back to 0.46 m worst pad spread against 0.46 originally. `cutFor` stops a 3 m creek getting a lake's cut bank (steep probes near channels 1.6% back to 0.8%). Channels were not actually shorter where it counts -- on-course length went 447 m to 1862 m -- but stubs are now rejected. And the beach block ran before the tee block, silently removing the mown collar from every low-lying coastal tee in the paint only.

- [x] **Cut banks for inland water, and a beach for the sea.** Ponds, lakes, rivers and creeks are excavated like bunkers -- 1.1 m of freeboard, a 2.4 m lip, measured at a 1.10-1.11 m bank across the interquartile range -- and the painted shore went from 7.14 m of soil to 1.36 m. The ocean instead got a shaped foreshore and a real beach that plays as sand: the coast measured 45 degrees before, and is now 10 m of sand at the default BEACH_TOP of 16 m. The beach claims rough only: allowing it onto mown turf made 19.4% of the island corridor sand.

- [x] **A tear at the end of every hole.** `nearest` switched its greenside allowance on an exact float equality, stepping the distance 17 m instantly and tearing the landform past every green in every biome (worst 10.87 m on mountain, 7.18 m on island). Ramped over `GREEN_RAMP`, one-sided so green surrounds are untouched: worst step now 0.49 m on island. The shoreline is also refined now -- it was the one feature the 3 m mesh never subdivided, giving a waterline staircase whose p90 was exactly the grid spacing.

- [x] **Hole-boundary staircase and a water lie on dry ground.** The owner atlas was a flat 512 square over a non-square course (2.88 x 4.26 m texels, 0.35% of samples on the wrong hole); it is sized from the course now at 1.75 m square, 0.13% error, 4 to 16 MB and 0.5 to 2.1 s of build. Separately, `surface()` decided ocean from `land` while the mesh is `height`, scoring 1512 island cells as water where the ground stood up to 6.13 m above the sea -- now 0.

- [x] **Resolve hole ownership at boundaries.** Done in the shader: `fwidth` gates the work to quads a boundary crosses, the four neighbouring texels give the candidates, and `holeDistance` picks the true owner. Needed `h.width` uploaded in the spare `curves` channel (`nearest` does not measure against `fairwayWidth`) and a lake-ownership flag in the atlas alpha so the resolve declines where a lake owns the ground. 0.032% wrong against the atlas's 0.13%.

- [x] **The crisp turf boundary stays crisp at water.** Asked whether the mowing boundary near a pond should be SOFTENED the way a channel crossing is -- which would have widened the one documented exception to the crisp-turf rule from "channel crossings" to "turf meeting water". Declined 2026-09-17 in favour of a sharp line in a rounded shape, which is what a mower actually leaves. The channel exception stays channel-only.

- [x] **The mown outline is rounded where two edges meet** (`BAND_ROUND`, 2 m, in the paint and the lie). The band's width needed no change -- the visible band was already exactly the hole's semi-rough, and the original plan to "fix" it would have made it vary. Rebuilding semi-rough as a single uniform offset was priced on a real hole (worst swath 25.2 m against 32.2 m, 1.04% of ground) and declined: it is a distance transform and `surface()` is a point query, so the lie would need a fourth baked representation. See scratchpad/band-options.html.

- [x] **Wind the whole scene agrees on, and a ball that sits on the ground.** Plants displaced along a hard-coded diagonal while the ball's drift, the clouds and the HUD arrow all used the course's real `windDirection`; they share one `windVec` now, and gusts are phased along it so they travel downwind rather than shimmering in place. Separately, `ball.castShadow` had been true since the beginning and could never have drawn anything -- the ball is 0.16 to 0.47 of one shadow-map texel -- so it is off, replaced by contact darkening that spreads and fades as the ball rises, and leans and stretches away from the sun so it doubles as the cast shadow -- at a resting ball's scale the two marks are 2.5 cm apart. The semi-rough also stopped carrying 3.5 cm blades, which were 13.5% of near-field grass instances.

## Completed in the putting and cup update

- [x] **Turf firmness, in the instrument's own unit.** Firmness is TruFirm/GS3 penetration in inches — lower is firmer — riding in the turf config beside stimp so it reaches every physics call site. It drives restitution, Penner's contact tilt and the Coulomb grip limit. Normal reproduces the previous model exactly, so no existing course changed. A 7-iron into a green: Soft bounces 7.6 ft and runs 4.5 yd, Burnt bounces 11.4 ft and runs 25.6 yd, with carry untouched. Sand, the cup rim and rolling deceleration are deliberately excluded — the rim and the skid already contain the green's firmness through its measured Stimp, and counting it twice would be wrong. Eight tests across every turf surface, spin rate and spin axis; sources and the anchored-versus-chosen split in RESEARCH.md.
  - [x] **Re-anchored to the USGA's published bands.** The preset depths were originally placed inside the instrument's range by judgement, because the USGA page carrying the reference ranges 403s to automated fetch. The user saved the page from a browser, so the four presets are now the published bands directly — Burnt 0.30 (*Extremely Firm*), Firm 0.37 (*Firm*), Normal 0.45 (*suitable for most facilities*), Soft 0.60 (*Receptive*). Burnt had been at 0.20, entirely below the typical range, and the anchoring cost real range: the extreme 7-iron rollout fell from 36.7 yd to 25.6. The article is committed under `reference/` and a test asserts each preset still sits on its band.

- [x] **The lab can watch it.** A firmness slider and four preset buttons, lab-only, driving the raw number rather than the four names. Twelve approach presets into green and fairway — clubs, spin rates, a draw and a fade — with power solved for the carry each asks for, landing ten yards short of the pin so the whole putting surface is in front of the roll-out. The readout reports carry and run — and says "spun back" when the run is negative, which a high-spin wedge genuinely produces. Launch angle, spin and spin axis are live override sliders alongside firmness: a preset fills them in, nudging one re-fires on release, and "use preset" hands them back.

- [x] **The main menu shows a different hole, at a different hour.** The backdrop inherited the player's clock, so once floodlights existed a player who had been putting at 1 a.m. saw nothing but dark floodlit holes. Generation was never the problem — all seven biomes, all fourteen footprints and 136–610 yd still come up. The backdrop now draws its own hour from the same seed as the hole, weighted to daylight with three of ten slots dark, and lights the poles by that hour rather than by the player's setting. The loan is given back on leaving, the periodic clock save is suppressed while it is held, and touching any clock control ends the loan so a time the player just set is never undone.

- [x] **A fog toggle, and the start of weather settings.** `fog` joins the daylight record beside the floodlights and the glow ball, switching off both the low morning sheet and the broad haze. The scene fog stays whatever the setting: it is the distance cue the landscape is drawn against, and removing it shows the edge of the world rather than a clear day. Measured at dawn, turning it off takes mean frame luminance from 128 to 87 of 255. It is the first control here that is about weather rather than time, and more will want to sit beside it.

- [x] **Night golf under floodlights.** Poles down alternating sides of every hole plus a pair flanking the back of each green at 45 degrees off the line of play, placed from published sports-lighting practice rather than by eye: 23 m masts (the bottom of the ball-field band), spacing derived as three times the mounting height, 62 m of reach scaled with the mast, and clearance of 18 yd past the semi rough down the fairway and 10 yd around the greens, because a pole is an obstacle. Every pole is instanced geometry — two draw calls for a course — and every one of them is a live `SpotLight`: the assumption that sixty lights would not render was measured and proved wrong, because none of them casts a shadow and shadow maps are the expensive part. A cap of 192 keeps a nearest-first fallback for any future course that outgrows it. Off by default and saved with the other time settings. Measured at 1 a.m., switching them on lifts mean frame luminance from 43 to 92 of 255 at no cost to frame time (8.4 ms median either way). Seven tests in `tests/floodlights.test.mjs`; figures and sources in RESEARCH.md.

- [x] **A par 5 is not 723 yards.** Base length by par, jittered a quarter either way with no clamp, then every hole scaled by one factor to hit the total -- so a long hole raised the total, lowered the factor and shortened everything else. At a 7,400-yard target one hole in eight was outside the USGA guideline and par 5s reached 803. Researched bands (120/175/250, 300/410/490, 470/540/640) filled by proportional water-filling: 0.0% outside the guideline at every length.

- [x] **The par mix was drawn flat off the list.** Every combination adds up; eighteen par 4s is not golf. Weighted toward a fifth of holes at each par, so 4/10/4 comes up 49% of the time.

- [x] **Par order spreads across the nines.** Counts split evenly with the odd hole going to a seeded side, then each nine hill-climbed against a badness score for back-to-back 3s and 5s. 0.09 adjacent pairs a course.

- [x] **One hole skeleton, shared.** `holeLine` in course-plan.js computes the line, the length and the tees for both the builder and the pre-build scorecard, over one contiguous prefix of the hole's stream. The two seeded generators -- identical streams, separate code -- are now one.

- [x] **The full card before the course is built.** Par, out/in/total and all three tee yardages, exact to the rounding. The length slider, the exact-yardage box and the card are one group instead of three controls for one decision.

- [x] **The hole map sat on paper, and the green tile was 96 texels.** `mapWater` is the colour beyond the generated land and was the base coat for the whole canvas; the full-course map hides it under a terrain tile and hole view does not, so it WAS the surround. Biome rough there now. The contour tile is 256 when the map frames the green rather than 96, and the canvas backing store follows the display ratio instead of a hardcoded 2x.

- [x] **The green is one state the HUD reads.** Pin pulled while putting (cup and liner stay), marker renamed to the hole and clamped to a measured free rectangle that clears the shot controls and the map, putter auto-selected only on the putting surface. `projectMarker` handles behind-the-camera properly, where `project` flips both axes and puts a marker on the wrong side.

- [x] **The wind arrow was mirrored.** Camera minus wind, not wind minus camera: both bearings are `atan2(x, z)` and agree with each other, but that runs counter-clockwise on screen while CSS `rotate` is clockwise. The easy test case -- wind downrange, camera downrange -- is zero either way round and cannot catch it.

- [x] **Wind debris is carried rather than fired.** Per-mote sway and bob rates plus a spread in drag, with the sway as a velocity through zero so the weave stays bounded. Tails from a single screen-space wind uniform, as shape rather than an alpha gradient.

- [x] **The putt aim line rides on the green.** It inherited the full shot's 100 mm lift and appeared to leave the top of the ball; 15 mm passes below the ball's equator so the ball sits on its own line.

- [x] **The flight model checked against a launch monitor.** 36 SkyTrak shots, irons and wedges: carry unbiased at under 2%, descent angle exactly zero mean error, offline within 1.4 yd. Caveats and the unvalidated roll model in RESEARCH.md.

- [x] **The aim line stopped making garbage.** It was rebuilt from scratch every frame an arrow key was held — a Vector3 per point, a flattened array and a fresh LineGeometry, about 44 KB and several hundred throwaway objects a frame at 2.6 MB/s. Not CPU time (0.06 ms) but GC pressure, showing up as an occasional 90 ms frame with nothing else to blame. The buffer is now allocated once and written in place with `instanceCount` deciding what draws: `bufferData` calls per frame during a sweep went from 4 to 0. Over 4,500 sampled frames of continuous aiming: median 8.4 ms, p99 11 ms, one frame over 16 ms.

- [x] **Shaders compile before play instead of during it.** Nothing precompiled, so each material variant was built the first time something using it came into view — mid-flight, mid-turn. A first pass over fresh ground burst six frames between 21 and 71 ms; a second pass over the same ground compiled nothing at all. `warmUp()` now compiles the scene at course build and on each hole change, after draining the grass queue against a 70 ms budget so the lazily-built grass material is in the scene to be compiled. 116 shaders now land at load, 10 during play, and a played course holds p99 at 11 ms.

- [x] **The camera stopped hitching on grass.** Near-field grass tiles were all built in the frame the camera crossed a tile boundary: five tiles, 8,000 candidate blades, three world queries each — 37 ms measured, and 127 ms for the first ring of 25. Tiles are now built one per frame from a nearest-first queue, out-of-range tiles are parked in a 32-entry LRU instead of discarded, and blades are written straight into the instanced mesh instead of cloned into arrays first. Worst-case single-frame work: 25 tiles to 1. What is left in a tile is 85% `world.surface()`, which is its own optimisation and is not done.

- [x] **Endless mode, and the menu hole you are looking at.** One hole after another, forever, from a single run seed: hole seven's landscape comes from that seed and the number seven, so a run resumes from `{seed, hole}` with nothing else stored. The main menu's showcase hole is now hole one of a real run built under the cache key `loadCourse` will ask for, so choosing Endless adopts that seed and that world and tees off immediately — no regeneration, and no progress overlay over work that is not happening. That makes `endlessSettings` load-bearing: `loadCourse` normalises through it on the way in, so it has to be a fixed point or the key moves, the cache misses and a different hole appears than the one that was picked. It lives in `endless.js` so both sides call the same function, proved a fixed point over 200 seeds.

- [x] **Schema and generator versions for the pin work.** `GENERATOR_VERSION` 9 → 10, because greens and cups changed for unchanged seeds; `SCHEMA_VERSION` 3 → 4 with a migration that gives pre-`pinDay` saves Thursday — the gentlest setup and the nearest thing to the middle-of-the-green cup they were played with. A new test walks every version from 1 to current and fails if any step leaves a setting undefined, which is the failure mode when only half of "bump and migrate" gets done.

- [x] **The hole flyover is the main menu's camera.** It ran up the fairway and then orbited the green, which showed a hole a piece at a time and never its shape in the landscape. It now circles the whole hole with the menu backdrop's framing at one and a half times its speed, a 55.9 s lap. Terrain clearance is solved once per hole rather than clamped per frame: the ring is measured along the arc and to each side of it, then smoothed, so the camera rises to meet a ridge before it arrives instead of putting a corner in the path. Measured on full mountain and full forest it holds 34 m of ground clearance and passes 10 m over the tallest canopies.

- [x] **The Tools button did nothing.** `openToolsBox` existed and nothing ever called it, in any mode. Bound, and opened up to the studio as well — Arrange windows and Reset windows are what you want while laying a course out — with the play-only controls disabled outside a round so nothing in the tray can fire without one.

- [x] **Greens that are actually shaped, and hole locations that move.** The green contour was a tilt and two sine ridges, which at the top of the slider gave 3.8 ft of relief and nowhere flat. It is now a tilt, rounded-square-wave ridges, a dish that is a punchbowl or a turtleback by seed, and a tier — and the slider curve is superlinear, so the default green is unchanged at 1.2% mean slope while 100% reaches 5.6 ft of relief, 18.5% tier faces, and still keeps 14% of the surface under 2.5% so there is somewhere to cut a hole.

- [x] **The cup stopped being the centre of the green.** It had been both, so hole locations could not move at all. Green centre and pin are now separate everywhere: routing, bunkering, tree exclusion, the corridor collision disc, the flyover orbit, stream protection, the map outline and the green-reading shader key off the green; physics, the flagstick and the cup mesh key off the pin. The corridor disc was the one that mattered — centred on the cup, recutting a pin moved the collision volume, moved the next hole and rerouted the whole course under it. Held by a test that asserts all four pin days produce an identical layout.

- [x] **Thursday to Sunday hole locations.** A `pinDay` setting cuts the cup for the day of a tournament. Difficulty is slope — Thursday 1.59%, Friday 2.03%, Saturday 2.54%, Sunday 3.11%, nothing past 4% on any green — while room to the edge is a safety floor of three metres rather than a second dial. Scoring that room as a target instead put every cup on the course the same five paces inside the edge; one-sided, they now spread from three metres to eighteen. Front, middle and back rotate hole by hole from the front. Shown on the hole card beside par.

- [x] **Tracers stop stacking up.** The previous shot's tracer used to hang over the next one. It now clears when the shot is over, and every tracer of the hole comes back at once on a slow high orbit while the scorecard is up.

- [x] **The cup spits balls back out.** Two bugs, one line apart. First, the rim was tested as two separate events — "has the centre reached Rcup" for the far lip, "is it below the green and past Rcup - r" for the wall — leaving a wedge between them that the ball flew straight through; a putt 50 mm out with its centre 2 mm above the lip sits 4.6 mm from the rim circle, buried in it, and nothing engaged until 54 mm. It is now one contact test against the actual surface: a torus above lip height, the cylinder below, agreeing exactly where they meet. Second, the wall was handed the ball's drilling spin with the wrong sign. A ball rolling forward carries -v/R about the outward radial axis, and in `u' = -5g/7r - (2/7) theta' w` that sign decides everything: right, and the spin term pushes the ball UP the wall the way topspin climbs a wall; wrong, and it merely adds to gravity, which is why every ball that reached the wall drilled to the bottom and none ever came out. Rides reach a full lap and come back out, true horseshoes send the ball straight back at the player at 179 degrees, and a ride can stay shallow enough to watch because the wall motion is harmonic rather than a descent. Third, a sign that decided which WAY round the cup the ball went: the edge and wall handoffs disagreed about it, so a ball rode the lip one way and reversed the instant it took the wall. Flipping rate and spin together leaves their product alone, so capture, the effective hole, ride length and energy were all unchanged — it was wrong in a way no measurement could see and only a person watching could. Fourth, the rim was made of nothing: it had two invented drag constants and was otherwise lossless in the direction the ball was travelling. The liner sits 25.4 mm down and a lipping ball has fallen less than a ball radius, so the surface it runs on is always cut turf — and turf's rolling resistance is measured, not chosen. A Stimpmeter gives `mu = a/g` = 0.056 at Stimp 10, and resistance is mu times the load, which inside the cup is the press of going round rather than the ball's weight, so drag grows as the square of how fast it circles. That took the longest surviving ride from 926 degrees to 396, made a faster green hold a longer ride on its own (Stimp 8: 370, Stimp 13: 701), removed the patchy effective-hole boundary, and left every visible ride running on top of the lip instead of sinking out of sight. Eleven regression tests in `tests/rim.test.mjs`.

- [x] **The cup has a bottom, and nothing teleports.** A ball straight down the middle touched no wall, so no regime owned it: it fell 143 mm, 62 mm below the floor, still accelerating, and the capture animation then hauled it 50 mm back up. Separately, a ball thrown clear of the rim kept the "over the cup" flag that suppresses the landing test and sank through the green 86 mm out before the wall grabbed it back to 32.6 mm, a 53 mm jump with the camera at its closest. Audited across 969 entry conditions and every lab preset for position jumps, upward jumps, balls inside the turf, holed-but-finishing-away and touched-but-not-flagged: clean.

- [x] **A lab to watch green behaviour deliberately.** One hole whose green is measurably flat (elevation and green difficulty at zero give 0.000% gradient across 1089 samples on any seed) plus a console API that places the ball and strikes it to order: `lab.putt({feet, past, offset})` asks for a shot the way a golfer describes one — how far from the hole, how far past it the ball would finish, how far off the centre the line runs — and solves the launch with the same roll preview the aim line is drawn from. Named presets sit either side of the model's own thresholds, so the table doubles as a readable statement of the capture envelope: dead centre holes anything finishing up to 9.3 ft past, an inch off line 5.5 ft, an inch and a half 2.7 ft, two inches only 0.4 ft — monotone in offset, which it was not before the rim was resolved as a single surface. `src/lab.js`.

- [x] **More complete cup dynamics.** Rewritten around one rule: the ball is caught if it falls its own radius while its centre crosses the opening. That is `chord x sqrt(g / 2r)` = 1.6365 m/s dead centre against Penner's published 1.63, from geometry with nothing fitted, and it fixed the shape of the envelope off centre — the old `1.63(1 - (d/R)^2)` turned away balls that had already fallen two and a half ball radii below the rim. Balls that fall less than a radius now climb back out over a rim that turns them, so holing out, lipping out and racing across the top are three readings of one number with no seam between them. Before this the hole did nothing at all to a ball it did not swallow: crossings at 0.6, 0.8, 0.95 and 1.05 of the cup radius all finished 1.310 m past it, identically. `src/cup.js`, with the measured before/after in RESEARCH.md.

- [x] **Struck putts skid before they roll.** A Stimpmeter ramp releases a ball that is already rolling, and a putt does not; both reached the simulator as `{vla:0, spin:0}` and every putt was treated as a ramp release, matching the pure-rolling closed form at a ratio of 1.000 at every speed. Shots now carry `roll`. Sliding friction is set so the skid is 15% of a putt on a Stimp 10 green, the share launch monitors report, and both phases go as v^2 so the power control did not change shape. Balls settling from a bounce take their contact velocity from the spin the bounce computed, so backspin checks and topspin runs — that spin was previously discarded at the moment it mattered most.

- [x] **The aim preview runs the shot instead of describing it.** A putt's line and ring come from the same ground integration the ball will use, so the two cannot drift. The closed form it replaced assumed a flat green of unlimited extent: on a 4% cross-slope the preview now lands within 0.05 m of the ball, shows break as a curve rather than a straight bearing, and reports the surface it stops on. Clicking a spot while putting solves for the power that stops there through the same preview. 0.17 ms per preview.

- [x] **Slope-aware cup capture — resolved as not needed.** The lowered far rim on a downhill putt is exactly cancelled by the ball already descending at `v x theta` as it leaves the near rim, so the criterion has no slope term in it. Measured from 6% uphill to 6% downhill, the launch speed that holes swings 24% while the arrival speed at the cup stays between 1.721 and 1.770 m/s. The rim follows the green rather than sitting level at the pin, because a level rim throws the lowered far side away and makes downhill and flat identical. Adding the visible half without the invisible one would have introduced a ~20% slope error. Held by a regression test so the cancellation cannot be broken by restoring one half.

## Completed earlier, moved from the priority lists

- [x] **Version generated courses and saves.** *All four phases complete.* `src/settings-schema.js` is now the single source of defaults, bounds, categories, help text, validation and migration, and carries two separate versions: `SCHEMA_VERSION` for the shape of a settings object, migrated silently through a chain; and `GENERATOR_VERSION` for the behaviour of the generator, which cannot be migrated because the same seed simply grows different ground afterwards. Rounds are stamped with both on save and export, the generator version is part of the world rebuild key, and a mismatch on load blocks play behind a choice — continue on the rebuilt landscape, or start a fresh round on the same course. Exact old geometry is deliberately **not** reproduced: that would mean keeping every retired generator alive, which was weighed and rejected.
  *Phase 2 is done too.* `src/course-library.js` keeps named courses in `fairway-courses-v1` and moves one between devices as an `FW1.…` code. A record is generation settings and a name — never a round, a lie, a score, or the author's turf and club preferences. Codes carry only what differs from the defaults, are checksummed against a truncated paste, migrate an older schema on import and refuse a newer one. The library is reachable from **Course studio → Saved courses** as a placeholder; phase 3 moves it to where it belongs.
  *Phase 3 is done too.* The app now has three modes. **Menu** is the entry point and offers Continue, Play, Course studio and Help. **Play** selects a saved course, the group, format and tee — the hole count comes from the course, so the two can no longer disagree, and no generation control appears. **Course studio** is its own mode: free flight, the settings panel, an explicit **Regenerate**, and a "settings changed" indicator, since nothing auto-regenerates when a rebuild is seconds of frozen tab. **Surprise me & play** builds a randomised nine from the schema's per-field `vary` bands and tees straight off. Opening Fairway grows only a one-hole showcase for the camera to circle behind the menu — about a quarter of a second against roughly two for a nine — and a saved round waits in `pendingRound` until Continue is pressed. Courses are deleted from Play, next to the course picker, behind a named two-tap confirm.
  *Phase 4 closes it.* The studio panel is rendered entirely from the schema — groups, order, labels, bounds, units and help text — with only the six controls that are not plain sliders written by hand. Every setting carries an on-demand description behind a hint button, plus **Show all descriptions**, and the nine categories replace the old muddle that mixed wind, fairway width and green difficulty under one heading. A test asserts every setting falls in exactly one rendered category, so a new entry cannot be added and silently never shown.
  **What this does not do, by design:** retired geometry is not reproducible. A generator bump means old seeds grow different ground, and the player is told rather than kept in the dark. Reviving exact old terrain would need every retired generator kept alive; that was weighed and rejected.

- [x] **House collisions and residential rules.** Houses are solid. `simulateShot` indexes them like tree trunks and resolves the deepest overlap of an oriented box (walls plus the roof folded in as height), pushing the ball out along the face it entered and reflecting only incoming motion, so a ball resting against a wall can still be played away from it. **Bouncing is the default and costs nothing.** The optional **Houses play as out of bounds** setting makes reaching one a penalty stroke and replay from the previous lie; it is off by default, carries its own explanation in the studio, and the 2 to 3 schema migration sets it off for every existing course, so nobody's saved course silently starts costing strokes.

- [x] **Richer residential scenery.** Four roof forms (gable, hip, saltbox, L-wing), optional porches, garages with a drive, picket fences and planted borders, all drawn from the same seeded stream so a street reads as built over time. Wall and roof palettes follow the biome. Foundations are sized to reach each house's lowest corner, so nothing floats on a slope. Setback, density, tee/green protection and tree exclusion are unchanged. House outlines are drawn on the full-course map.
  Still open: interiors, varied window patterns, and per-region architecture beyond the warm/arid palette split.

- [x] **Pond banks on sloping ground.** Overlapping pond shelves settle to one shared level, which took the median pond bank from 35% to 13% against a background terrain median of 3%. The remaining quarter of ponds with locally steep banks turned out to share a cause with the biomes that lost ponds entirely: the shelf margin was pinned at a fixed 34 m, so shrinking a pond to fit steep ground barely reduced the footprint the fit was judged over. Scaling that margin with the pond fixed both. Measured on the reported max-elevation course: bank slope median 0.38, worst 0.62, none above 1.0, and mountain went from 3 of 8 seeds with no ponds at all to 1-6 ponds on every seed. Two approaches were tried and rejected with measurements: applying every overlapping shelf in turn (a pond in a valley drags a hilltop pond's shelf down to its level), and taking only the nearest shelf (a 1197% cliff wherever the winner changes — the boundary-switching trap the handoff warns about).

- [x] **Central settings schema.** Derive defaults, validation, migration and sliders from one schema; prevent save/import controls from drifting. Include units and generated-vs-live setting semantics. *Delivered by the schema work above:* `src/settings-schema.js` is the single source of defaults, bounds, categories, units, help text, validation and migration, `generationKeys()` carries the generated-vs-live split, and the studio panel is rendered from it.

## Completed in the September 11 update

- [x] Optional fairway homes with density/setback and dry gentle site selection.

- [x] Broader green-surround transitions and expanded modifier bounds.

- [x] Flat pond levels fitted below rim/outer-bank samples, smaller/rejected unsuitable ponds, refined shoreline geometry.

- [x] Optional rivers/creeks with count, width, depth and meandering controls; beds, lies, water animation and maps.

- [x] Ten additional footprint choices including Original square (14 total), selectable SVG previews.

- [x] Persistent shot results, live horizontal distance and height.

- [x] Three-second replay final hold and three-second delay before the completion scorecard.

- [x] Animated flag lifting for putts.

- [x] Context-free project handoff, agent entry point and separate future-work list.

- [x] Camera-enclosing trees hide their complete trunk/branch/canopy instances and restore on exit.

- [x] Biome-aware river/creek banks, downhill graded channels and shared reflective water.

- [x] Large-lake count/diameter controls with open-ground siting and map/contact ownership.

- [x] Fairway-following hole flyover and heatmap-only green orbit with preference restoration.

- [x] Initial aim follows the fairway centerline instead of pointing across doglegs at the pin.

## Completed in the waterway update

- [x] Smooth channel passage through fairways. Obstacle avoidance is a low-passed displacement with the side chosen once per obstacle, replacing the hard clamp whose influence boundary produced trapezoid corners. Two Chaikin passes and a curvature relaxation follow.

- [x] Bunkers are avoided by rivers and creeks. Three routing tiers try a generous berth, then a tight squeeze, then sand-blind routing; any bunker a sand-blind channel crosses is washed out in `generateWorld` so water never stands in a playable bunker.

- [x] Independent channel bearings, wavelengths, amplitudes and phases. Every channel previously shared one course-wide bearing and wavelength pair, so rivers and creeks were offset copies of one curve.

- [x] Staged shoreline. Three bands — saturated margin, damp earth, then a fade to the surrounding cut — sized from channel width and capped inside the valley shoulder, replacing a 2.8 m collar. The bank tint is warmed and darkened so it reads as earth beside a green fairway rather than duller grass. An intermediate damp-turf stage was tried and removed: it held a near-constant tint of the surrounding turf and traced each channel as a coloured ribbon. Instanced grass is kept off the painted earth band for the same reason. Mown turf gets about a third of the margin unmaintained ground gets, so a channel crossing a fairway no longer carries a wide earth band through it.

- [x] Channel water feathers out at the waterline via a per-vertex bank weight, and all water bodies are translucent in Cartoon style instead of only the single reflective one.

- [x] The bank tapers to its crossing width gradually. One scale factor now shrinks the whole profile so it keeps its shape, the taper runs over a distance proportional to the body (about 70 m ahead of a fairway for a river, against 13 m before), and the corridor distance is smooth-min/maxed so a corridor corner no longer creases the bank into a wedge. Previously the band's outer contour swung inward faster than 45 degrees and drew a hard line along the fairway edge.

- [x] Creeks and rivers relax the crisp turf boundary rule where they cross a playing surface: the classification blends and mowing stripes fade, both falling off with distance from the water. Colour only — surface queries and contact still switch at the true boundary. Ponds, bunkers and ordinary turf edges are untouched.

- [x] Ponds share the channel shoreline. `shoreTint` in the ground shader now serves ponds, lakes and channels alike, replacing the pond sand bed and 5 m sand collar.

- [x] Terrain is levelled under each pond during generation instead of searching for a flat site. Rim spread on finished terrain measures a few centimetres.

- [x] Ponds sit against the fairway. Their gap to the corridor may be negative, so water can reach the playing edge without ever entering it.

- [x] Larger water. Ponds now span roughly 90 m rather than a fraction of that, and **Typical lake diameter** reaches 460 m. Pond banks are anchored a fixed gap outside the fairway edge, so a larger pond grows away from play rather than into it. At the top of the lake range open ground runs out and fewer lakes are placed than requested.

- [x] Patterned ripple strokes on the water surface were tried and removed at the owner's request; the water keeps its translucency, normal-map distortion and reflections. Do not reintroduce a surface pattern without asking.

- [x] Station joins no longer step: the ground shader tests the two neighbouring segments of the same channel and keeps the nearest.

## Distribution follow-up (September 11 review)

- [x] **Floodlight shadows: blocked on a texture unit, not on frame time.**
  Unblocked 30 September by packing the ground's per-hole tables; see
  *Floodlight shadows, on every tier* under "Graphics work the profiling turned
  up". The lesson from the first attempt stands and is now enforced twice: a
  test counts the units, and a smoke journey plays the floodlit night.

- [x] Owner-selected MIT license, package metadata, offline Help licenses and source/portable notices.

- [x] Credit Mulberry32 and embedded Earcut, AgX and bundler helper code; update modified Water attribution.

- [x] Dated provenance review, 50-entry dependency inventory, verified archive packager and release checksums.

- [x] **The driving range.** 500 yd × 100 yd, dead flat, mown from behind the mats to the back of the field, identical every visit because nothing in it is drawn from a seed. Built as a standard hole object (`range.js`) with a one-line branch in `generateWorld`, so the ground shader, physics, map and floodlights need no special case. `noNeck` on the hole stops `fairwayWidth` pinching the back of the field into an approach. The real green is movable without shortening the field, because the shader reads green position from the cup atlas rather than from hole length. Eight tests covering depth, width, flatness, determinism, green travel, that a generated course still necks, and that the painted ground and the ball's lie classify identically.
  - [x] **Fixed: the painted ground disagreed with the lie.** `localSurface` tested the green's semi collar before the fairway while the shader paints the corridor over it, so the apron short of every green was drawn as fairway and played as semi-rough. Pre-existing on every hole (0.87% of hole 1), invisible until a green sat inside a full-width corridor. Range agreement is now exactly 0.00%; course holes fell to 0.02–0.36%. Existing courses play differently on the apron — the lie now matches what was already being drawn.
  - [x] **Entry fixes after first look.** `bio: null` threw inside `loadCourse` before `setMode('play')`, so the range built and drew with the main menu still over it — a hole needs a real biome because the HUD and the flight model both read it. The menu entry is a full tile in the mode row rather than a small link. The ball sets up on the centre mat (`round.tee = 'white'`; the default blue tee is the left-hand station). Tee `yards` now carries the green distance so the card stops reading "0 yd". The green-reading overlay is forced off on entry — on a dead-flat green the slope grid and heat map both paint the whole surface blue, which looks like a bug and was reported as one.
  - [x] **The player card too.** Both practice modes invented a golfer called "Lab" or "Range" and threw away the real group; they now carry `round.players` through, so configured players arrive with their own names. The score chip shows the SHOT YOU ARE ON instead of strokes to par, since a practice ground has no par -- a session opens on SHOT 1 and ticks over as each ball settles.
  - [x] **FIXED — and the LAB was worse than the range.** The range already blanked its hole number, par and pin; the lab never did, so it announced "HOLE 01 / 09 · PAR 4 · PIN THU front" over a flat bench green. Both now read as what they are: the card titles itself "Lab" or "Driving range", par and pin show an em dash, and DISTANCE — the one field that stays real on a practice ground — follows the green wherever it has been put.
  - [x] **(original)** **Range HUD still shows round furniture.** The hole card carries "PAR 4" and a "THU" pin-day chip, neither of which means anything on a practice ground. Belongs with the range shot loop, where the card should carry shot data instead.
  - [x] **Coloured targets and distance signs.** Six targets at 50–300 yd, alternating sides, each a coloured disc with a white rim, an oversized flag and a board behind it carrying the number. Offset from the centre line is derived from the green's own reach so the distance slider can never drive the green through one — tested by walking every target's rim at every green position. The colour ramp avoids the cyan band that water and the slope overlay occupy, tested by hue rather than by channel dominance. Signs scale with distance to hold roughly even angular size from the mats. Three new tests, eleven on the range in total.
  - [x] **Green-distance slider.** In the tools tray, range-only, 30–300 yd. Moves the painted surface through the cup atlas, carries the flagstick and cup meshes across by hand, and refreshes the cached `worldPin`/`worldGreen` that most of the scene actually reads — without that the flag stands in an empty fairway where the green used to be. The distance is remembered for the next visit in the session. A test drives it through `generateWorld` so the routed transform is non-identity, because a bare builder hole has an identity transform and would pass either way. Twelve range tests.
  - [x] **Range shot loop and shot data.** `finishShot` branches before `round.takeShot`, so no stroke is recorded and nothing advances; the ball returns to the mat keeping the chosen club, and tracers accumulate on the field. Eight per-shot stats in the Shot information panel plus a running average carry and offline spread. The hole card reads Range / N/A / Range with the live green distance. `offlineOf` was extracted from the readout purely so its rotation could be pinned by test — a shot-direction sign error has shipped four times in this project. Thirteen range tests.
  - [x] **Range dispersion being zero is CORRECT, not a gap.** Logged earlier as needing a strike-quality model; that was the wrong conclusion. Ball data is an input from the launch monitor, and the simulator must never invent variation the monitor already measures — see PROJECT_HANDOFF. Dispersion appears when real shots differ, which is exactly when it should.
  - [x] **The lab works on the range.** `LAB_SETTINGS` is now `RANGE_SETTINGS`; `labApproach` moves the green to `carry + short` and fires from the mat instead of walking the ball back from a fixed pin. Every one of the twelve presets now lands on the turf its name claims — previously the wedge fired from rough, the 5 iron from semi, and the driver from rough 46 m behind the tee, none of which the readout showed. Raised `short` on the driver (60→90) and wood (60→80): at 60 both ran onto the green mid-roll and reported the mixture as fairway run, overstating it by 46% and 25% at Burnt. The firmness ladder reproduces exactly at Soft, Firm and Burnt; Normal reads 10.0 against the published 12.8 because the ball holes out.

- [x] **Check rollout against reality — the blocker for spin-back.** Ploughing takes speed away without unwinding spin, so it is what lets a ball come home; friction takes both. Reversal needs plough ~0.40 and our fitted value is 0.142. Plough is pinned by our rollout figures, which were inherited from the instantaneous model and scaled from a measurement taken on a TEEING AREA — never checked against a real green. A 7-iron releasing 11.3 yd on a receptive green looks generous. If the true number is 5–8 yd, plough rises and spin-back may fall out on its own. Measurement question, not a modelling one.
  **RESOLVED.** Rollout is now checked against reality on both surfaces: fairway against the published tour totals for clubs that actually land there, greens against tour backspin of 15-20 feet. Spin-back works.
  - [x] **Crater wall built and found to be a dead end.** `wall`/`craterRelief` exist in contact.js and default to neutral. Every shot digs the same 1.08 mm, so the depth-scaled wall is a constant multiplier that refitting absorbs exactly — the refit held at wall 40 and 80 and spin-back never moved. Kept and documented so it is not rebuilt.

- [x] **The bounce takes time now (Option C).** A spun ball stood straight up on its first bounce, and arXiv:2208.11685 proves an instantaneous bounce *cannot* do otherwise — slip reversal during contact needs tangential stiffness and damping. `contact.js` is a Kelvin-Voigt contact integrated over the 0.497 ms the ball is squashed. Ploughing was split out from Penner's tilt, because the tilt lifts as it retards and soft turf must retard without lifting — that split is what let all four firmness settings hit bounce height and rollout simultaneously. Tilt now falls with canopy instead of rising. The anchor became behavioural rather than a shared constant: the paper's fitted pair described a two-term model, so its 0.147 is no longer the same quantity, but everything that pair produced is reproduced to better than 0.5%. Wedge at 18k rpm now hops forward, forward, then back, finishing 12.1 yd behind its mark. 1.2x cost. 299 tests.

- [x] **Restitution is velocity-dependent.** Balls looked magnetised to the ground — a 7-iron bounced twice, the second at 6% of the first. The anchored 0.147 is the FAST-impact value; arXiv:2302.02758's own conclusions say a constant fit is deficient and turf shows "elastic behaviour for low normal velocity and elasto-plastic behaviour for higher speed bounces". Restitution now rises as impact slows, gain 3.5 at rest decaying to 1x by full-shot arrival speed. The gain is set by the shoulder-height drop test (ball returns to about knee height, COR ~0.58; green's 0.168 x 3.5 = 0.588) and PLASTIC_SPEED holds the measured anchor to within 2%. Driver 3 -> 6 visible bounces, 5-iron 2 -> 4, 7-iron 2 -> 3. Firmness now changes the bounce count too.

- [x] **Flight plays at real time.** The render loop advanced the trajectory clock at 1.7× with no comment and no recorded reason, which took a 7-iron's hang time from 6.65 s to 3.91 s on screen and a driver's from 7.45 to 4.38 — the reason shots did not look like shots. The physics was never wrong. Both hold timers count real seconds and were unaffected. Shots now take ~70% longer to watch; the settle pause is the dial if a round drags.
  - [x] **Simulated hang times run 5–10% long** against real figures (driver 7.45 s where tour data is nearer 6.5–7). Separate from the playback clock that was masking it.
  **STALE — fixed by the aerodynamic refit, which was not aiming at it.** Measured now: driver **6.59 s**. PGA Tour average hang time is **6.1-6.3 s** and barely moves year to year; Henrik Stenson LED the tour at 6.9 and the longest individual shot on record is 8.2 ([Golf Digest](https://www.golfdigest.com/story/the-five-players-with-the-shortest-tee-shot-hang-time-and-the-drivers-they-use)). So the driver sits between the tour average and the tour leader — inside the observed range, not outside it. The 7.45 s in this entry was measured before the lift curve was flattened; hang time came down with carry and apex as a side effect.
  **Deliberately not actioned further.** Shaving the remaining 0.3 s means touching lift, and lift is currently fitted to carry (3.2%), apex (3.7%) and descent angle (1.8%). Trading three validated quantities for one already in range is a bad deal. A ratio check backs this up: real hang against vacuum-ballistic hang for the same apex runs 1.35 for the driver down to 1.12 for the wedge, which is lift holding the fastest ball up longest — the right ordering and the right magnitude.

- [x] **Bounce anchored to measured turf.** A 7-iron bounced 9.2 ft off a green; it now bounces 3.5. The `tee` row is the fitted pair from arXiv:2302.02758 Campaign B verbatim — 693 bounces off a well-maintained natural teeing area, fitted to Penner's tilted plane plus restitution, exactly this project's model — r = 0.147, β = 0.321 rad. The rest of the ladder is scaled onto it. Their artificial-turf campaign fits at r = 0.42–0.54 and was not used. Friction was left alone: the paper pegs it at ~1.0 everywhere, and raising ours from 0.44 to 0.95 changed a full-shot bounce by nothing, because the Coulomb limit never binds there. Rollout barely moved, so the firmness ladder survives.

- [x] **Green and fairway stopped sharing a bounce.** A 756-shot sweep found green, fringe, fairway and tee identical to four decimal places — one restitution for every surface that was not sand, rough or semi. Now an explicit per-surface table ordered by mowing height: green .32, fringe .30, fairway/tee .28, semi .23, rough .18, sand .10, strictly increasing as the canopy shortens. The fairway moved down rather than the green up, so every published figure measured on a green stays valid. A test asserts the ordering and that the pair cannot collapse back into one bucket.
  - [x] **Tilt and friction moved too.** They were lumped worse than restitution: semi-rough carried a putting green's numbers, so a ball dug in and gripped identically on both. All three constants now run with the canopy — restitution falling as mowing height falls, tilt and friction rising. Semi, fairway and fringe moved; rough and sand were already right. Semi's bounce rose slightly (Penner's tilt redirects momentum upward) while its roll fell 8.6 to 6.2 yd.

- [x] **Per-shot spin adjustment.** Launch angle and spin axis each had a per-shot delta and spin had none, so a shot could be flighted down or shaped but never deliberately spun. Added as a delta in **rpm** beside them; the profile's spin control stays a **percentage**, because it scales a bag spinning 2,700–9,000 rpm and one absolute number cannot serve both. Added after the profile scaling, clamped at zero so a driver cannot be spun backwards. Two tests.

- [x] **Tool windows regrouped by subject.** `Range controls` is a box that opens with the range and closes with it, holding the green distance slider, which left the tools tray. `Shape your shot` is now `Shot shape` and owns the ball-flight profile as well as the per-shot adjustment — both are about how the ball leaves the club. `Ball flight & turf` is now `Turf settings` and keeps only the ground: Stimp, the roll settings and firmness.

- [x] **Flight camera pass.** Tightens across the whole shot rather than only the last 15 m (a second, height-ungated `trackCloseness` from 150 m in, 24 m → 13 m, handing over to the existing turf-level close-in). Every shot is now followed from off the shoulder — 25° for a full shot against a putt's 45°, kept smaller because the hole sits down the flight line and has to stay in frame. The follow bearing trails the line to the **hole**, not the struck line, falling back to aim within 1.5 m of the cup where the bearing is undefined. The view leads toward the hole so both it and the ball are framed; a test requires both inside 30° of the view axis at three ball heights across the whole approach. Camera hold 0.75 → 1.5 s, putts still immediate. Three existing assertions in `approach-camera.test.mjs` described the old behaviour and were rewritten rather than appended to.

- [x] **The aerodynamic curve is fitted rather than asserted.** It had never been fitted to anything, and was wrong in a spin-ordered way — irons ~10% long and ~15% high, driver 7% short and 23% low, with the lift cap binding for the 9-iron and wedge. Five constants (`AERO`) fitted against six measured tour rows: carry 7.9% -> 3.2%, apex 14.6% -> 3.7%. Descent angle was NOT in the fit and improved 7.0% -> 1.8%, within a degree on every club. `simulateShot` now reports `descentAngle`, taken at the touchdown velocity.
  - [x] **The descent-angle and apex targets are unsourced.** Ball speed, carry and total are from the published Trackman tour averages; the descent and apex columns are from memory, so the 1.8% out-of-sample result is only as good as they are. Confirm both against a primary table. (An earlier landing-speed column was discarded for exactly this reason.)
  **VERIFIED — sourced, and both check out.** Descent angle: the PGA Tour average for a 7 iron is **50 degrees** and pros target 48-50 ([Golf Digest](https://www.golfdigest.com/story/the-most-important-data-point-when-it-comes-to-your-next-irons-a), [golf.com](https://golf.com/instruction/approach-shots/what-is-descent-angle-equipment-metric-play-smart/)); **ours is 49**. The rest of the irons sit inside the quoted mid-40s-to-50 band — 5 iron 46, 9 iron 51, PW 51. No exact tour figure was found for a driver; ours is 39 against 'shallower than irons'.
  Apex: Trackman's distinctive claim is the FLATNESS, not a height — *"the difference in Apex Height between Driver and Pitch Wedge is only 3 meters/yards"* ([Trackman](https://www.trackman.com/blog/golf/apex-height)). **Ours is 3.7 yd** (driver 32.0, PW 28.3). That is the better test, because it is a specific falsifiable shape a model could easily get wrong.
  This mattered because the aerodynamic fit's strongest claim — that descent angle came out within a degree WITHOUT being fitted — rested on targets typed from memory. It holds.

- [x] **Release is too short for every club below a 3 wood, and the bounce is now the suspect.** With the flight corrected, measured inputs give: driver 28.8 yd against 21, 3 wood 19.4 against 19, 5 iron 9.2 against 15, 7 iron 3.0 against 13, 9 iron 0.3 against 11, PW -0.3 against 10. The error runs with spin, so the bounce over-responds to it. This **corrects** the guess in RESEARCH.md that our rollouts were too generous — they are too short, which means ploughing cannot be raised to buy spin-back without making release worse.
  **SUPERSEDED.** This was measured against published totals for clubs that land on GREENS, not fairways -- a 9,304 rpm wedge releasing ten yards on a fairway is not a shot. Fairway now fits driver 22.7 / 3 wood 19.0 / 5 iron 13.1 against 21 / 19 / 15.

- [x] **The bounce anchor stopped measuring the flight.** It fired a 7-iron and measured where it landed, so an aerodynamic refit read as a bounce regression. The ball is now delivered at a pinned arrival (speed, descent angle, spin) instead of flown to it, with a companion test asserting delivered and flown still agree. Pinning it caught a trap: arrival spin read from the touchdown sample is 2277 rpm against a true 5114, because the impulse and the recorded point happen in the same step.

- [x] **The lab hides the manual shot controls and carries its own settings.** Club, aim and power decide nothing on the bench — lab shots have their speed solved to a stated distance and take launch, spin and axis from the preset or the sliders — so four controls were on screen advertising inputs the lab ignores. Hidden in lab mode, and `takeShot` now refuses the manual path there too, because SPACE and the gamepad still reached it and would have fired from controls the user could no longer see. The launch-monitor path (`takeShot(data)`) stays open: that is a real ball. **Green speed moved into the lab bar** with named presets (Slow 8, Medium 10, Quick 12, Tournament 13.5) and is on `lab.stimp()`; it was previously reachable only by leaving the lab for the turf panel, which is the wrong home for the biggest single influence on a putt.

- [x] **The bounce turns backspin into topspin, which is why nothing zips back.** A wedge arriving with 7,000 rpm leaves the first bounce at -1,416 rpm: the contact drives it all the way to rolling, and rolling is topspin. Nothing downstream can bring a topspun ball back. Two candidate fixes were ruled out cleanly -- `craterRelief` is inert (it only acts while the ball moves backward *during* contact, which never happens) and contact duration is **structurally incapable** of mattering, because the model is scale-invariant in the spring rate. `spinGain` is now an option (default 2.5, unchanged) and does control it, but buys spin-back only by shortening release one-for-one.
  **FIXED.** Spin transfer (`SPIN_GAIN` 5/2 to 3/2, per-surface) stopped the bounce driving every shot to rolling. Balls keep backspin and come home.
  - [x] **The real defect is the SPREAD, not the level.** Measured release runs 21 yd (driver) to 10 (wedge), about 2:1; ours runs 28.8 to -0.3, a collapse. Every tangential lever slides the whole ladder together without changing its shape, so the tangential loss is too spin-sensitive in its FORM, not in its coefficients. Next step is the functional form, not another fit.
  **FIXED.** The spread was a spin-gradient problem; spin transfer closed it on both surfaces.

- [x] **A ball can come back.** `SPIN_GAIN` 5/2 to 3/2 in contact.js, per-surface in the `CONTACT` table (green 1.5 rising with the canopy to 2.5 in rough, because you cannot spin a ball out of the rough). The bounce was driving every full shot to ROLLING inside the contact, and rolling is topspin — a wedge arriving at 7,000 rpm left at −1,416, so nothing could ever return. The roll phase already handled backspin correctly and needed no change; the bounce was destroying its fuel. A 7-iron on a firm green now crosses zero at ~9,600 rpm and reaches −12.5 yd by 13,000, while a stock 7,000 rpm shot still releases 2.7.
  - [x] **The published total-minus-carry ladder was abandoned as a fit target.** It demands a 9,304 rpm wedge landing at 51 degrees release ten yards, which is not a real shot; four fits against it stalled at 37–40% with parameters railing, and the ones that moved release did it by cutting friction, flattening the spin response entirely. Fitted to tour behaviour instead: RMS miss 11.7 to ~3.5 yd.
  - [x] **3 wood (14.1 against 19) and 5 iron (12.4 against 6) are the remaining misses.** Both are long-club-on-a-fairway cases, and the fit's third parameter wanted fairway roll resistance outside its legal range — so the fairway roll constant is the next thing to look at.
  **SUPERSEDED.** Those figures came from the pre-wedge fit. Current: 3 wood 19.0 against 19, 5 iron 13.1 against 15.
  - [x] **The low-speed regime still has no validation data.** A slow chip now runs 1.46 m where the old model gave over 3. The arithmetic supports the new figure but nothing measures it.
  **RESOLVED — it has some now.** Chipping is taught as a carry-to-roll ratio (PW 1:3, 52 deg 1:2, 56 and 60 deg 1:1), which is the first external anchor the sub-20 m/s regime has ever had. Measured against it the 56 degree is right at 1:0.9 and the lower lofts run short, and `elasticGain` was ruled out as the cause by sweep — it moves chips the wrong way and moves the fairway two yards. Chip behaviour is accepted as it stands and is not tracked as a task; the numbers and the ruled-out suspect are in RESEARCH.md if it is ever picked up.

- [x] **Speed-dependent rolling resistance is ON** (`ROLL_SPEED_GAIN = 1`). Flat below the Stimpmeter's 1.83 m/s and rising only above it, so putts up to 3 m/s are bit-identical and a green set to Stimp 11 still runs 11 feet, with no renormalisation. Fliers come down (a 2,000 rpm 7-iron on a Normal green 40.9 -> 26.3 yd) while realistic spins are untouched exactly. Needed a midpoint evaluation in the rolling step: a first-order step left an O(dt) bias that made the Stimp run drift with the integration timestep. Distance is no longer exactly quadratic in launch speed above 1.83 m/s -- below it, where ordinary putts live, it still is.

- [x] **(superseded) Speed-dependent rolling resistance was switched OFF** (`ROLL_SPEED_GAIN = 0` in turf.js, provably inert). Written because a 2,000 rpm 7-iron entered its roll at 4.3x the Stimpmeter's calibration speed. Not enabled: turning it on breaks 19 tests including the quadratic launch-speed-to-distance law the putting power control depends on, and the shots it corrects are not shots anyone hits. The Stimpmeter run is preserved exactly at any gain, on every surface, by construction.

- [x] **The lab takes a shot as one pasted message, the way the monitor sends it.** A `SHOT DATA` box accepts GSPro Open Connect v1 JSON (what the hardware actually puts on the wire, already understood by `parseLaunchMessage`) or five bare numbers — ball speed, launch, direction, spin, axis — for typing a test case. Enter fires. This replaced five sliders that were wrong twice over: they fired on release so every adjustment launched a ball, and a launch monitor does not hand you five knobs. Ball speed and direction had been missing from the panel entirely. Presets are pure again too: `labApproach` had been reading the sliders back in, so after one nudge every preset fired something other than its own name.

- [x] **The first bounce goes BACKWARD on Normal and Soft greens, which is wrong.** Measured on `green · high spin` (10,767 rpm): the ball lands at 22.79 m/s, leaves the contact at 4.63, and moves backward through a 3.36 ft hop without ever going forward. Real behaviour is a forward hop first, then the near-vertical one, then back — and that is what Firm already does, which is why Firm looks right on screen. The budget says friction (8.35) plus ploughing (2.96) cannot reverse 13.94 m/s of forward speed on their own; the Penner tilt's 2.76 is what tips it over.
  **FIXED.** The bounce can no longer reverse a ball on first contact, and the green ladder was refitted against a 56 degree wedge. Every first hop is forward.

- [x] **Green distance moved into the lab bar.** It lived only in the range's own controls, so setting up a manual shot meant leaving the lab. Slider plus 100/150/200/250 yd buttons, and `lab.greenAt()` on the console. Follows the drag on a flat lab green and waits for release on a shaped one, which rebuilds the world. Fixed a latent bug while wiring it: `labGreenAt` recorded `settings.rangeGreen` only on the expensive path, so the cheap one moved the green without saying so — invisible until something read the distance back, which a slider does.

- [x] **Firmness applies to greens and their collars only.** The unit is inches of penetration read by a greens instrument and the USGA bands behind it are greens bands, so `firmnessApplies` now covers green and fringe — the same argument that already excluded sand. It also removed a setting that played badly: a soft course reversed a well-struck ball off fairway, semi AND rough (a 10,400 rpm 7 iron hopped backwards out of all three, and at stock 6,500 rpm it still came back off a soft fairway). Cost, measured: firmness was worth 13 yd of driver release on a fairway, and the roll % sliders give back about 9 of that for a driver but essentially nothing for an iron (0.2 yd across the whole range), because an iron's release is nearly all bounce. A new test asserts fairway/tee/semi/rough are provably invariant across the firmness range.
  - [x] **Still unfixed and separate:** a 1.6x spun 7 iron comes back ~1.35 yd off a fairway at every setting, because Normal itself does. That is the plough-and-tilt budget, not firmness.
  **FIXED.** A hard-spun iron now hops forward off a fairway and releases; nothing reverses there.

- [x] **Course studio generated a driving range (round two: it was PERSISTED).** The first fix only covered the in-session route out. `save()` fires on course load and after every shot, so it fires while the lab and the range are open, and it wrote `range: true` to localStorage — after a reload every world built from it was a range, studio included, and no amount of in-session restoring touched that. Now: `saveRecord` stores the remembered course rather than the range, the loader replaces a stored range outright instead of merging it, `openStudioSetup` leaves the range BEFORE the panel renders (doing it after would have discarded the settings just entered), and `enterStudio` keeps a last-resort strip that cannot discard anything. `courseFallback` keeps the player's style, bag, flight profile and turf while resetting the world shape, because spreading a range's own settings over the defaults carried its elevation 0 and flat greens into the course.

- [x] **(first attempt, incomplete) Course studio generated a driving range.** `enterLab` and `enterRange` REPLACE `settings` wholesale rather than editing it — both are a different world, one hand-built hole with a fixed seed and no elevation — and nothing put the old settings back on the way out. So `range: true` survived the trip and the next thing to read `settings` built a range: the studio, and the menu's showcase hole with it. The player's seed, biome, style and bag were also being reset to defaults by any visit to either. Both now save the course on the way in (`rememberCourse`) and put it back in `returnToMenu`, which the code already calls "the one way out of play or the studio".

- [x] **The bounce can no longer push a ball backwards; only retained spin can.** Backward first hops on fairway, semi and rough were not spin — rough eats the spin properly (keeps -1% against a green's 30%) — they were Penner's TILT, which rotates the contact normal against travel so part of the rebound comes out as backward horizontal. That kick is near-constant (0.41-0.64 m/s, it scales with the rebound) while surviving forward speed collapses from 2.62 on a green to 0.10 in rough, so the kick simply took over. The tangential component is now floored at zero when the ball leaves with no backspin. Flooring it unconditionally was tried first and killed the green's check (-2.6 -> -0.3 yd); gating on the sign of the outgoing spin separates the two cases with no threshold to pick. Also repaired the non-monotonic firmness ladder in the anchor, which had been written up as two mechanisms competing and was actually this.
  - [x] **Fairway still hops backward** at its current ploughing, because it keeps 366 rpm and is allowed to. That is the separate ordering problem below.
  **FIXED** by the ground/canopy plough split and the fairway refit.
  - [x] **`plough` is ordered by mowing height, so a fairway digs 34% harder than a green** and is modelled as the softer ground — backwards for native soil against a watered green. Proposed: fairway/tee firmest at .1100 rising to the green at .1416. Measured, it also moves the driver from 14.6 toward its sourced 21 yd. Open question is whether plough should SPLIT into ground softness (ordered as above) and canopy grab (ordered by mowing height), because a flat reorder makes a ball landing in rough run 4.4 yd against a green's 0.3.
  **FIXED.** `plough` is now the sum of GROUND softness (firmest first) and CANOPY grab (by mowing height), which are genuinely different orders.

- [x] **Checkpoint before the tilt work:** `.checkpoints/20260915-023232-before-tilt-gate/` with a RESTORE.md holding the measurements. `.checkpoints/` is gitignored.

- [x] **`plough` split into GROUND softness and CANOPY grab.** One number was carrying two unrelated facts and every ordering of it contradicted something: by canopy, a fairway dug harder than a green (fairway as the softer ground -- backwards); by ground firmness, a ball landing in rough ran further than one landing on a fairway. Ground now runs firmest first (fairway, semi, rough, fringe, green) and canopy by mowing height (green shaved, rough 50 mm), with the ball feeling the sum. Friction came down 5% alongside it, because it is the largest single term taking forward speed off a bounce and a hard-spun iron was keeping almost none. Measured: no first hop is negative on any surface, rough stops a ball sooner than fairway (1.5 vs 3.4 yd), the green still checks -3.1 yd, and the driver reaches 18.0 on a fairway against a sourced 21 (was 14.6).
  - [x] **A green tilt cut was tried and rejected** -- it buys forward carry by flattening the hop (3.3 ft to 1.1) and cost the Firm check, which already looked right on screen.
  - [x] **Soft greens still suck back more than firm ones** (-4.8 against -1.4 for a hard-spun iron). Real golf is the other way: you cannot spin a ball back off a soft green, it plugs. Driven by `PLOUGH_BY_FIRMNESS`, not by the surface table.
  **WRONG, AND NOW REVERSED.** This asserted that real golf has firm greens sucking a ball back hardest. It does not, and the model no longer does either. Every source says a soft receptive green grips a spinning ball while a firm one is harder to hold -- which is why setups FIRM greens to protect par. Left here as a correction rather than deleted, because an entry that says the opposite of the code is exactly how this nearly got 'fixed' back to being wrong.

- [x] **A ball climbing into rising ground no longer passes through it.** `v[1] <= 0` alone missed a ball still gaining height while the terrain came up faster, measured at 59 mm of penetration on a 39-degree slope. Being below the surface is a collision whichever way the ball is travelling.

- [x] **Greens and fairways re-anchored to research, each against the clubs that actually land on them.** The reference shot was a 7 iron at 10,400 rpm -- not a shot anyone hits -- and is now a full 56 degree wedge (88 mph, 31 deg, 10,000 rpm, 103 yd carry). The firmness direction was backwards: sources are unanimous that a soft receptive green grips and checks while a firm one is harder to hold, and course setups firm greens to protect par. Tour backspin is 15-20 FEET, not the 18+ yards our ladder was carrying. Titleist slow-motion confirms the first bounce goes FORWARD with reversal starting at the second, so the no-reverse floor is observationally grounded.
  - [x] **The published total-minus-carry figures were fine all along** -- they were being pointed at the wrong surface. Driver/3 wood/5 iron land on fairways and their totals are real; wedge totals are not fairway roll-outs because those shots land on greens. Four earlier fits were spent trying to make a 9,304 rpm wedge release ten yards on a fairway.
  - [x] Fairway fitted to driver 22.7 / 3 wood 19.0 / 5 iron 13.1 against 21 / 19 / 15, RMS 1.47 yd. Spin transfer at the rigid ceiling 2.5 is what closed the gradient; ploughing moved all three together.
  - [x] Greens fitted across 56 wedge, PW, 9 iron and 7 iron. Firmness now scrubs spin rather than digging -- the fit flattened ploughing across firmness on its own, which is what a tight shallow-marking putting surface should do.

- [x] **Lab box moves and resizes.** Dragged by its title line, resized from the corner. The listener is wired once and guarded, because `showLabBar` replaces innerHTML on every redraw and re-wiring would stack listeners; inline position and size survive a redraw because the bar element itself is not replaced.

- [x] **Green distance is a typed box at one-foot steps**, quick buttons kept. A slider cannot say "put it on 147", and `moveRangeGreen` already accepted fractional yards so nothing rounds it back.

- [x] **"Firmness" is "Green firmness" everywhere a player reads it** -- the lab control, the turf panel field, and the explanatory note. It moves greens and their collars and nothing else, so the name now says so. Code identifiers are unchanged.

- [x] **The course card's menu button is gone from every mode.** The card reports the hole; a second route into the menu sitting on top of it was clutter beside the nav that already does it.

- [x] **Range slice 2: per-player shots and a shot list.** Who is hitting is chosen by clicking the player card and never rotates on its own. Every range shot records which golfer hit it, and the list filters to one. The topbar `Scorecard` chip reads `Shot data` on a practice ground and opens the active golfer's shots over most of the screen; the shot number on the card opens the same thing.
  - [x] **FIXED — the lab records shots.** The first option was taken: it records, and `labSource()` is the different club-column source the entry called for. Details in the entry at the end of this file.

- [x] **The range has a setup dialogue and the group can be edited from inside it.** Choosing the range from the menu now asks for the group and the green distance first, the way play, endless and studio do. The same panel, opened from the avatar while practising, reads "Apply to this session" and changes the group in place. This closed a gap created by carrying `round.players` into the range: the group could be brought in but never edited there, because the only control that committed player edits was "Start fresh round", which leaves the range.

- [x] **The group can be changed without restarting, in every mode.** `Round.setPlayers` resizes every per-player array in step: a golfer who stays keeps their card, their strokes and their ball; one who joins starts from the tee with earlier holes blank (`cards` is sparse by hole and the scorecard already guards each cell); one who leaves takes their card, so the button confirms first. "Apply to this session" now appears in play and endless as well as on the range and in the lab.

- [x] **Players are added with a + and removed with a trash icon**, replacing the 1-4 count dropdown. One shared `groupEditor` serves the round panel and the practice panel, and it holds a draft rather than scraping the DOM at commit time -- a count dropdown and a row list can disagree with each other, and a single draft cannot.

- [x] **A golfer can be removed on their own turn.** If everyone still in the round has holed out once they are gone, the hole completes through `showHoleCompletion` -- the same routine a holed putt runs -- so the summary, scorecard and countdown to the next tee behave exactly as they always do. Removal is confirmed by name first, and a rejected change now raises a toast as well as the inline error, which on its own read as the button doing nothing.

- [x] **Putting settings live in Format & tees, inline.** The mode select and the 1/2/3-putt distances render in the round panel's format section instead of a `Putting: … · change` button in *Your group* that opened a second window for one setting. Both surfaces -- the round panel and the tools-tray *Putting options* -- build from the same `PUTTING_MODES` / `PUTTING_NOTES` / `puttingFields` / `readPutting` / `applyPutting` pieces, so the option list and the notes have one definition. The round-panel fields apply on change; the tray popup keeps its Apply button because it is a popup.

- [x] **The range and the lab no longer eat the putting mode.** Their throwaway round forces hole-out, and that was the only copy of the setting: a trip to the range reset a Dartboard or Decimal choice, and *Start fresh round* from inside the range carried hole-out into the round. `savedPutting` holds the player's own choice across practice; `restorePutting()` hands it back from `restoreCourse()` and from `buildRoundOn()`.

- [x] **Endless has a setup panel.** The main menu asks for format, tees, putting and the group before the first hole grows, the way play, the studio and the range already did. No course picker -- endless grows its own -- and no match play, which `Round` rejects for an endless run because a match needs a last hole. `startEndless(group)`/`buildEndless(group)` take the group instead of forcing stroke play on whoever happened to be loaded.

- [x] **`formatFields` / `wireFormatFields` are shared.** Format, tees and putting are built and wired once and rendered by both the round panel and the endless panel, with `FORMAT_NOTES` holding the three format explanations, so the two cannot drift.

- [x] **The endless panel is tabbed and the panel titles are honest.** Two `<h3>` sections fell under `TAB_THRESHOLD` and rendered as one long scroll; `groupPanelContent(root,tabAlways)` lowers the threshold to 2 for that render only. `panelTitle(name)` now says *Lab*, *Driving range* or *Endless run* where the one `round` panel key used to say "Your next round" in all four variants.

- [x] **Range slice 3: shot lines are a setting.** A 0-50 slider in the range controls decides how many tracers stay on the field, applied as it is dragged. The trail store is capped at the ceiling rather than at the current setting, so raising the slider shows lines already hit; zero clears the field. Device-local in its own `fairway-range-lines-v1` key, not in `settings`, which `courseFallback` rebuilds on the way out of the range. The practice card's SHOT number moved to its own `practiceShots` counter -- it read `holeTrails.length+1`, which the cap would have frozen at 51.

- [x] **The lab records shots.** `recordRangeShot` was `rangeMode`-only, so the lab's Shot data chip always opened an empty list. Recording happens before the range branch's early return (the lab does not take it -- it plays a real one-hole round on the practice green) and before `round.takeShot`, so the row carries the golfer who hit rather than whoever the turn advanced to. `labSource()` names the club column: the preset name, `Launch monitor`, or `Putt · N ft`. `enterLab` clears `rangeShots` too -- only `enterRange` did, so the range's rows used to follow you into the lab.

- [x] **Range slice 4: replay any shot in the list.** A Replay button on every row; `replayShot` takes a record instead of always using `lastShot`, and the badge stamp and the panel sentence are passed separately so the default still reads "Replaying your last shot". The row stores the shot that happened rather than a request to re-simulate it -- the model is deterministic and wind is a pure function of settings (both measured), but re-simulation reads the world as it is now, and on a range the green moves and the firmness changes. Bounded at the tracer window; older rows keep their numbers and lose the button. Fixed a latent bug on the way: the live distance readout measured from `lastShot`'s origin during any replay, which is only correct when the replay is the last shot.

- [x] **Lab mode removed; Lab tools is a range popup.** The mode had its own world, a floating bar, a menu entry, sixteen preset shots and thirty-six `labMode` branches through `main.js` -- all onto a bench that `LAB_SETTINGS` had already redefined as `{...RANGE_SETTINGS, seed:'LAB'}`, so it was a second front door onto the same flat ground. What replaced it: a `lab` tool panel in the range carrying green firmness, green speed and a box to fire a shot from typed numbers, updated in place by `syncLabTool()` so a redraw cannot eat a half-typed line.

- [x] **The measurement instrument was kept, deliberately.** `src/lab.js` keeps its arithmetic and `window.lab` keeps every method that runs against the loaded course (`batch`, `drops`, `scatter`, `lipSweep`, `envelope`, `slope`, `drop`, `strike`, `firmness`, `stimp`, `greenAt`, `slowmo`, `eyeHeight`, `reading`, `state`, `last`); `lab.open()` is now "go to the range". Every physics fit in this project was done with these, and deleting them would leave a future physics change with nothing to measure against. `LAB_SETTINGS`, `PRESETS` and `APPROACH_PRESETS` are gone.

- [x] **`tests/lab.test.mjs` repointed at `RANGE_SETTINGS`.** All fifteen pass with no change but the world they build, which is the proof the range is a real bench: flat to below 1e-6 gradient at the pin, big enough for the roll-outs, and `greenDifficulty` still gives a green that reads. The two preset tests went with the presets rather than being left to assert things about a world the app no longer builds.

- [x] **A typed shot is not a club shot.** `takeShot` records `latest.typed=!!data` and the shot list names the row `Launch monitor`, covering both the Lab tools box and a real connected monitor. This replaced a `labSource()` that guessed from `labState`. Manual swings are now allowed on the range, which the lab used to refuse.

- [x] **FIXED -- the bench lost two capabilities in the lab-mode removal, both silent.** (1) `setRangeGreen` only had the cheap slide path; `labGreenAt`'s contoured-green rebuild went with the lab. Moving a sloped green would have put the cup on flat ground with the contours left behind, and nothing would have complained. (2) `enterRange` ignored `difficulty`, `seed` and `stimp`, so `lab.green({difficulty:35})` built a flat green and reported 0% slope. Both restored; `lab.greenAt` now throws instead of no-opping when the range is not open, because a measurement that quietly did not move the green gets blamed on the physics. `tests/range.test.mjs` asserts the contoured rule directly.

- [x] **Range slice 5: 2D side and top-down shot views.** A `Shot views` tool popup -- opened from the tool box, drawing nothing until it is -- with height against distance and the ground track across the aim line. New `src/shot-views.js` holds the arithmetic and the drawing; `viewShot` follows the last shot until a `View` button on a shot-list row pins one, and the next shot clears the pin. Height is clearance above the turf rather than above sea level, and offline is measured against the line you AIMED down, checked against `offlineOf` by a test that compares the two functions to each other rather than to a worked example that could share a sign error.
  - Two real bugs the tests caught before the browser did: a four-yard putt got no gridlines at all (fixed step larger than the whole shot), and a dead straight shot would have been drawn as a slice (cross-axis span near zero with no floor).

- [x] **The map pans and zooms, in every mode including studio.** Wheel to zoom about the pointer, drag to pan, double-click to reset; the title shows the factor whenever the map is not showing the whole thing. `mapLayout` gained a `nav` that scales and shifts the fitted frame rather than replacing it, so zoom 1 is exactly the old map. The state lives on the canvas as `canvas.mapNav` beside `canvas.mapTransform` instead of being threaded through `drawMap` -- five call sites draw this map and an argument is how one of them ends up without it. That is also why studio, free flight and the menu backdrop needed no per-mode code.
  - A drag no longer fires a click-to-aim; verified in the browser that dragging leaves the aim readout alone and clicking moves it.
  - `panBy` had its sign inverted -- the map ran away from the pointer at twice the speed it should have followed it -- and the tests caught it, not the browser. `mapPoint` is `w/2 - (p - c) * scale`, so the offsets ADD.
  - `setPointerCapture` is wrapped in try/catch: a throw there aborts pointerdown and the map silently stops responding to the mouse.
  - Next: per-club dispersion circles drawn on this map.

- [x] **Every mode dialogue tabs, and the way in sits with the tabs.** The range setup panel was a single scroll where play, endless and the studio tabbed -- it had a field before any heading and one `<h3>` after it, so it fell under the threshold. It now opens with `The green` and tabs alongside `Who is hitting`, and `groupPanelContent(content,name==='round')` covers all three variants of that panel rather than only endless.
  - `Start fresh round`, `Start an endless run`, `Open the driving range` and `Grow this landscape` moved into the right-hand end of the tab row. Previously each sat at the foot of one section, so which tab you were on decided whether the way in was visible. Marked with `data-panel-action` rather than found by `.primary`, because half a dozen panels have a primary Save button that must not move.
  - The first version looked wrong while every DOM assertion passed: `.drawer .primary` sets `width:100%` and `margin-top:18px`, which made the action fill its own row and push the tabs off it. A screenshot caught it, not the checks.

- [x] **FIXED -- the map stopped dragging after one step.** Two separate causes, both live. (1) `mapDrag = p` re-anchored from `mapPixels`, which returns `{x,y}` and nothing else, so the pointer id was dropped and the next move failed its own `e.pointerId !== mapDrag.id` guard. The map moved once and stopped. (2) The pan clamp held the centre inside the content's own half-extent, which at the fitted zoom bound after about fifty pixels. The limit is now measured against the viewport too -- the content must still overlap it by half a screen -- so it grows as you zoom out.

- [x] **Range slice 6: per-club dispersion on the map.** New `src/dispersion.js` groups the session's shots by club and reports a centre, a standard distance and the worst ball; the map draws a circle, a dot per finish and a centre cross, with a legend in Range controls carrying the shot count and a toggle. Three shots minimum -- two balls define a radius that means nothing.
  - **It invents nothing.** The leading test fires ten identical shots and asserts the radius is exactly 0: the simulator has no strike-quality model by design, and the honest circle for ten identical balls is a dot. Real dispersion comes from real variation in what you feed it.
  - The radius is a standard distance rather than the worst ball, so one thinned wedge cannot define the club.
  - **Found by using it:** every typed shot is labelled `Launch monitor`, so grouping on that put a driver and a 7 iron in one circle with a 63.7 yd radius. Rows now carry `clubKey` (what it was hit with) separately from `club` (where the numbers came from).

- [x] **Dispersion is an ellipse covering every ball, not a standard-distance circle.** The circle was wrong twice: dispersion is not round -- long-and-short is a different miss from left-and-right, and most clubs group about half as wide as they are deep -- and a standard distance covers only about two thirds of a group, so a third of the balls sat outside the mark drawn for them. `groupEllipse` takes its shape from the group's covariance (so it lies along the way the club actually misses) and its size from containing every ball. The legend now reports both axes, long first.
  - Touching the extremes on each axis is NOT containment: a ball on the diagonal can be inside both bounds and outside the ellipse. A containment scale catches it, and a test builds that exact case.
  - A collinear group would divide by zero and draw nothing; a 4% floor makes it a sliver, which is the truthful picture of a group with no width.
  - Identical shots still return a zero-size mark. Inflating a point into a shape would be drawing a miss nobody hit.
  - A second test pins the opposite risk: the tightest ball must reach 0.95 of the ellipse, since containment alone is satisfied by an ellipse twice the size of the group.

- [x] **Every HUD panel moves and resizes at all times.** Arranging was a mode; the tool windows beside it dragged whenever you liked, which was two answers to the same question. `createLayout` now gives each of the seven panels a live grip and resize corner, persisted as fractions of the playing area. Arrange UI survives as a way to make the handles obvious and reach Reset, but nothing is gated behind it -- which is why play, free flight, the studio, the range and the menu backdrop all got it with no per-mode code.
  - A grip rather than the whole panel: the map is click-to-aim and drag-to-pan and the shot controls are sliders, and a draggable panel would take those gestures from the controls that own them. Verified the map still pans and still aims.
  - **The handles live inside each panel and a MutationObserver puts them back.** `showLiveResult` rebuilds `#shotResult` with `innerHTML` on every shot, which swept them away -- so the first build left the two most-rebuilt panels unmovable while the rest worked, reading as intermittent rather than total.
  - Drag uses window-level pointer listeners rather than depending on pointer capture, the same pattern as the popups. The old code depended on capture.
  - `.view-tools` takes its grip just outside its own left edge: it is a 30px button column and an inside grip sat on the first button.

- [x] **Shot information moved into the course card, seed moved to its top-right corner.** The readout was a second glass panel floating below the card saying the same kind of thing; it is a section of the card now, under the scores, separated by a rule rather than its own border and background. It keeps its own scroll so a long result cannot push the card off screen, and it left `createLayout`'s list -- it moves and sizes with the card, and its own grip would have been a handle inside another panel's handle.

- [x] **One panel chrome and one typography rule.** Panels had radius 9, 10 and 12 and two different drop shadows, so a tool window beside the map read as a different kind of object; `--panel-radius` and `--panel-shadow` now define it once. Fonts are `--font-display` (Georgia: course title, panel headings, large numeric readouts) and `--font-ui` (Inter: everything else) -- the intent all along, but `.result-stats strong` and `.hole-info strong` were sans while `.live-score-par strong` inches away was serif, and `.shot-list-head h2` was the one sans panel heading.
  - The substitution that introduced the tokens ran over the token's own definition and produced `--font-display:var(--font-display)`. A self-referencing custom property is invalid at computed-value time, so everything silently fell back to sans. It builds and validates; only a computed-style read catches it.

- [x] **The bridge can log every message, and the flag works in PowerShell.** `npm run bridge:debug` (or `--debug`, `-v`, or `FAIRWAY_LOG=debug`) prints device connects, every raw payload in, every reply code out, browser arm state and acknowledgements, and each shot decoded into mph/degrees/rpm -- which is where wrong units and swapped spin fields show up, since both look correct in the raw JSON. Off by default: a working connector sends a shot every thirty seconds plus heartbeats, and logging all of it drowns the one line that matters. Payloads capped at 400 chars so a misbehaving connector cannot flood the terminal with 64 KB.
  - The env-var prefix form is bash syntax and PowerShell rejects it outright, which is most of the people who will want this since connector software is usually Windows. Hence the argv flag and the npm script.

- [x] **First real connector exposed two interop bugs.** (1) It sends its idle frame with the `ShotDataOptions` fields at the TOP LEVEL and no `BallData`; read strictly that is a malformed shot, and `parseLaunchMessage` threw `BallData is missing`. GSPro accepts the flat shape, so `const opts=d.ShotDataOptions??d` now reads either, and a frame with any known status key but no `BallData` is a status rather than an error. A payload with none of them still throws -- tested, so widening this did not swallow genuinely broken messages. (2) A rejected shot closed the socket, which put the connector into a reconnect loop resending the same frame forever; framing errors still close, validation errors now reply 501 and keep the connection.
  - Four new bridge tests: flat vs nested status frames, a real shot alongside flat options, a payload with no known keys still erroring, and the close-vs-keep rule driven over a real socket.
  - This is the first time physical hardware has been pointed at the bridge. RESEARCH.md's "device testing remains deferred" is now partly out of date -- protocol interop has been exercised against one real connector, but no shot has yet reached the simulator.

- [x] **Every bridge response carries the Player block.** A real connector parses a Player out of each reply and was printing empty defaults on every heartbeat, because only the 201 included one. GSPro sends it on all responses; connectors that track club changes from the response stream would otherwise never see one.

- [x] **Launch-monitor UI: a state light and a stripped control bar.** `readDeviceStatus` pulls `LaunchMonitorIsReady`/`LaunchMonitorBallDetected` out of either option shape and the bridge relays them on the `status` message, only when they change. The club card shows red (no device), amber (device, hunting -- breathing animation) or green (ball detected -- one pulse, then still), each with a word beside it since colour alone is not a message. Nothing shows when no bridge is connected.
  - The reader never throws: it shares a loop with the framing check, where a throw closes the connection.
  - The stripped bar keys on `armed` rather than connection -- that is the only state where the manual controls genuinely do nothing, and keying it on connection would strand someone who connected but never armed. Applied on `#shotControls`, so it follows every mode showing that bar; checked in play and on the range.

- [x] **The whole shot card carries the monitor colour, and the duplicate pin readout is gone.** The tint moved from `.club-control` to `.shot-controls`, done as an inset box-shadow with a 9999px spread rather than a `::before` overlay -- an absolutely positioned overlay paints above the card's non-positioned flex children and would have covered the club name. The card's own drop shadow is restated in every state and keyframe, since box-shadow does not merge across declarations.
  - `#bottomPin` removed from the strip above the bar; the pin distance was already on screen beside the flag. The loop that wrote it had to change in the same edit or `$('bottomPin')` would be null and take the rest of `updateHUD` with it.

- [x] **The aim point is marked in the world, and the strip above the shot bar is gone.** `#aimLabel` mirrors the flag label: projected onto `aimPoint` each frame, 3 m up rather than the pin's 6 m because it marks ground rather than a flag. Hidden during flight, in free flight, while dropping, and within 8 m of the pin where the two markers would overlap -- so a par three aimed at the flag shows only the flag, which is correct but can read as the feature missing.
  - The caption moved with the number: `TO AIM POINT`, or `TO WHERE IT STOPS · OFF THE GREEN` for a putt preview. Deleting the strip without moving that sentence would have thrown away the only feedback saying a putt finishes off the green.
  - The tee selector moved into the shot bar beside the club, and stays visible in monitor mode -- it is not a shot input.
  - Trap hit on the way: the mode-hiding rules are selector lists where the `#world[data-mode=…]` prefix belongs to each item, so inserting `.aim-label` after a comma made it `display:none!important` everywhere. It measured 0×0 and looked like a projection bug.

- [x] **The aim marker says only TO AIM POINT, and hides on the green.** The caption briefly reported the putt preview's resting surface, which produced "12 · TO WHERE IT STOPS · OFF THE GREEN" with a putter on a tee 561 yards out -- accurate and useless. The surface report, the module variable behind it and the per-frame write are all gone; the caption is static markup. On the green the marker is suppressed entirely (`ballOnGreen`, cached from `updateHUD` rather than re-derived per frame): the flag marker carries the distance and the roll preview line already shows where the putt finishes.

- [x] **The putting camera is gone; one camera everywhere.** A `putt` mode replaced `player` the instant the ball reached a green -- eye 1.1 m up, 1.8 m behind the ball, FOV clamped to 53 -- which silently overrode whatever the player had set and made the Game camera panel look dead while putting. Reported as a broken tool, and it was not wired wrong: it was being overridden.
  - Removed in five places: `playCameraMode`, the swap in `setUpTurn`, the one in `replayShot`, the renderer's placement branch and FOV clamp, and the `putting` flag into `flightCameraPose`. The option is gone from the camera select.
  - `playCameraMode` stays as the identity function rather than being deleted at its call sites -- one place made this decision and it should stay one place.
  - A save from before this carries `mode:'putt'`; the restore coerces it to `player`, or the player lands in a mode the select cannot show and the renderer no longer places.
  - `tests/course-variety.test.mjs` asserted the old swap. Rewritten to assert the new rule across every mode rather than deleted.

- [x] **FIXED -- the cup was cut through the middle of every green, not at the pin.** The ground shader's `discard` used `cupInfo.xy` from the green atlas, which carries the GREEN's centre; the same vec4 drives the green's boundary, so one value was doing two jobs. This was collateral from the earlier fix that correctly moved the atlas from `h.pin` to `h.green` for the boundary. The atlas is now two texels per hole -- green in column 0, pin in column 1, sampled at u = .25/.75 with `NearestFilter` set explicitly -- and the discard reads the pin. The pin-move path updates both texels.
  - `tests/pins.test.mjs` now asserts the cup and the green centre sit more than four cup radii apart on every hole and every pin day, so a change that collapses them back together cannot hide this class of bug again.
  - A backtick inside the GLSL comment I added ended the template literal; `node --check` flagged it as a missing `)` hundreds of characters later. Worth remembering: the shader is a template string.

- [x] **Saved courses is a first-class menu tile; saved rounds moved into the round panel.** The course library was reachable only from inside the round panel and the studio. It is now a tile beside Course studio and tabbed like the other menu dialogues -- `Your courses`, `Save a course`, `Import & export` -- with whole-library file export/import alongside the existing per-course codes. Saved rounds left the main menu and the in-game nav for the round panel's fourth tab; the LIST moved with the import/export, or every saved round would have been stranded. The now-unreachable `rounds` panel was deleted rather than left as dead code.
  - File import ADDS and never replaces. Wiping a library with one click on the wrong file is not recoverable.
  - `PANEL_TITLES` already had a `library:` key later in the object, so the one I added silently lost to it and the panel kept its old title while everything else worked.

- [x] **FIXED -- an exported endless round imported as the wrong course.** `saveRecord` writes a placeholder settings object for an endless run, because an endless hole is a seed plus a hole number rather than a landscape. `resumeRound` regrew it with `endlessSettings(endlessHole(seed,hole))`; the file-import path did not, and rebuilt a default nine-hole course with the run's hole number pointing into it. Saving and resuming from the library was always correct -- only the file round-trip was broken.

- [x] **Browsers on the private network can drive the bridge.** `isLocalOrigin` accepts loopback plus RFC 1918 (10/8, 172.16/12, 192.168/16) and `file://`'s `null`; `FAIRWAY_HTTP_HOST` binds the HTTP/WS listener somewhere a phone can reach it, since widening the origin check alone changes nothing while the server is loopback-bound. The bridge warns on startup when it is not loopback.
  - It parses with `URL` and tests `hostname` exactly rather than pattern-matching the origin string: a regex passes `http://192.168.1.50.evil.com`, which contains a private address.
  - The parser canonicalises too, which the tests document with measured values: `010.0.0.1` -> `8.0.0.1` (refused as public), `0x0a.0.0.1` and `167772161` -> `10.0.0.1` (allowed), `10.0.0` -> `10.0.0.0`. A leading-zero guard was written then deleted as dead code -- `hostname` never contains one.
  - Two new tests, refusals first, plus a live check on this machine's real home-network address: reachable over it, LAN origin accepted, public origin refused.
  - **Not authenticated.** Anything on the network that can reach the port can drive the simulator. Same caveat the connector's TCP port has always carried.

- [x] **UI pass, first slice.** (1) The Putting options panel promised "A low putting camera activates on the green" -- removed two changes earlier, so the app was describing a feature it no longer had. (2) Arrange UI deleted entirely, along with the layout toolbar, `toggle`, the `editing` state and 18 dead gates; `Reset panel layout` now sits in the tools tray beside `Reset tool windows`. (3) `.view-tools` renamed from "Camera tools" to "Tools tray", and its resize handle fixed -- it was positioned with `margin-right` against `left:auto`, which places nothing, so it sat back in the default corner on top of a button. (4) Sim drop and Putting options disabled on the driving range -- and, added while the green-reading toggles got the same treatment, each says why in its title, because a dimmed control with no explanation reads as broken rather than as not-applicable.
  - Verified every visible panel carries both handles on screen, and dragged the renamed tray by exactly (-40, +30).
  - **Broke the app on the way:** deleting `layout.sync` left one `layout?.sync()` caller. Optional chaining guards the OBJECT being null, not the METHOD being absent, so every HUD update threw and the fatal handler replaced the world with the "needs WebGL 2" card -- which looks like a hardware problem, not a missing function. The comment on `sync` said it had callers and I deleted it anyway.

- [x] **Green reading moved onto the thing it describes.** The three tools were checkboxes inside a *Green reading* panel in the tools tray: to change what you were looking at you covered it with a drawer. They are now three icon buttons along the top of the course map -- slope grid, downhill markers, contour heat map -- switchable at any time without opening anything. The panel, its `TOOL_PANELS` / `POPUP_SIZE` / `PANEL_TITLES` entries and the old `#greenGridToggle` are gone. `src/green-map.js` is new.
  - **The map frames the green once the ball is on it**, and paints the same contour field from directly above. This is the view the 3D overlay cannot give: read from the ball, the far half of the green is a few pixels tall -- exactly the half you are trying to judge. `mapLayout` takes a `focus` argument; `focus:'green'` fits `greenBounds`, which is sampled from `greenRadius` rather than assumed circular, because greens are stretched by `greenAspect` and wobble with the seed.
  - **`lo`/`hi` come from the putting surface ALONE**, never the sampled square. Scaled against the whole square, a green sitting in a hollow measures itself against the bank behind it, the surface occupies a sliver of the ramp, and the thing reads as uniformly flat -- the opposite of what it is for. A test asserts the range is the on-green range and that the surround exceeds it.
  - **Same ramp as the 3D overlay**, hue `(1-t)*0.64`, sat 0.88, light 0.48, contours every 10 cm drawn as band edges. Two views of one green that disagreed would be worse than one view. The tile is cached per green because the map redraws about twelve times a second and the field is thousands of `course.height` calls.
  - **Off and disabled on the range**, with the three buttons saying why on hover, and the map never focuses on the bench green: it is dead flat, so every overlay paints one colour, which has already been reported as a rendering fault once.
  - **The green question is asked, not cached.** `updateExplorer` runs BEFORE `updateHUD` when a shot finishes, so reading the cached `ballOnGreen` titled the map one pass behind the picture. `onGreen()` does the surface lookup at both sites.
  - Verified in the browser: toggles switch and light up, a ball dropped on the green takes the map to 7.0 scale under a `GREEN · CONTOURS` heading with a full blue-to-red sweep painted, and moving 60 yd back restores the hole map at 1.0.
  - **The tile was drawn 180 degrees out, and shipped that way.** `mapPoint` negates both axes, so the map is the world turned half a turn; fitting the tile into a normalised destination rectangle got the size and position right and the orientation wrong, painting the high side of the green over the low side. A green-reading tool that reads exactly backwards, which looks entirely plausible -- spotted from a screenshot, not by any check I ran. `tilePlacement` now derives the transform from `mapPoint` itself. The painted tile covers 99.3% of the green disc; the old way, 45.8%. Three tests, one of them asserting the scales are negative so the fix cannot quietly become a no-op. The field is also sampled at pixel centres now, which was half a texel out.

- [x] **Save/import/export pass: three ways to lose work, all of them now closed.** A walk through every persistence path, exercised in the running build rather than read.
  - **Discard did not discard.** *"This round and its scores are gone"* cleared `pendingRound` in memory and left `fairway-round-v1` alone, so a reload offered *Continue* on it again. `clearSave()` is now the only `removeItem` in the app, called from the round guard only -- the studio guard must not touch a round it has nothing to do with.
  - **The menu backdrop was autosaving itself**, which is why the first attempt at the above did nothing: the slot was cleared, the showcase hole grew a throwaway `Round`, and something on the way into the menu wrote it straight back. It also meant a launch after any visit to the menu offered *Continue* on a nine-hole round nobody had played. `save()` refuses while `menuBackdrop`.
  - **Endless reset the player's bag.** `clubYardages`, `flightProfile` and `turf` are not schema fields, so rebuilding settings from `DEFAULT_COURSE` drops them silently. Measured: driver set to 225 yd, one endless run, one reload, back to 250. `PLAY_KEYS` / `playScope` now live in `settings-schema.js` beside the comment that explains why they are not schema fields, and four sites carry them: entering endless, each new endless hole, `saveRecord`, and resume/import. `style` is excluded on purpose. `applyPlaySettings()` makes them live, which `resumeRound` never did -- so resuming a round saved under a different bag played it with the current one while the panel showed the saved numbers.
  - **Importing a round destroyed the one in progress** with no prompt, and never entered play: from the main menu it built the course, said "Saved round restored" and left you on the menu. It now reads and validates the file first, then goes through `guardRound` like every other exit, then `setMode('play')`. The file input is cleared afterwards -- without that the same file could not be chosen twice running.
  - Verified end to end: discard then reload leaves no stored round and no Continue; a 225 yd driver survives an endless run and a reload; importing mid-round asks to save, saves, imports and lands in play. Four new tests in `settings-schema.test.mjs`, one of which fails if a play-scope key ever becomes a schema field and quietly makes the mechanism unnecessary.

- [x] **Toggling the floodlights froze the picture for two and a half seconds.** Three builds its lighting uniforms from the VISIBLE lights in a scene, so lamps created hidden and shown on the toggle changed the light count and recompiled every lit material -- 2541 ms on a nine-hole course with 57 lamps, and worse in the studio, where it was reported. The lamps were then created visible at zero intensity and only their intensity was switched, so the count never changed: **18.7 ms in the studio, zero programs compiled**. (Reversed 28 September, B6: that put every lamp into every lit shader at load; they are hidden while off again and both states' programs are built ahead.) Pre-compiling the floodlit variant was tried first and only got it to 554, then 270 ms -- kept as `warmFloodlights` for the masts, and it now runs per hole rather than once, because a one-shot guard left the per-hole flag, cup and ring materials compiling on the toggle. The trade is a permanently wider light loop in every fragment: measured at 8.3 ms against 8.5 ms, inside the noise here, but real on a fragment-bound machine.

- [x] **Terrain casts its own shadow.** It only ever received one, so trees shaded the turf and the turf shaded nothing -- a ridge did not darken the hollow behind it, which is a large part of why undulation is hard to read. One draw call per cascade over existing geometry: 8.6 ms against 8.5 ms.

- [x] **Water: the gap between reflecting and not is much smaller, and the pass costs half as much.** Three changes. (1) Still bodies get the reflector's own animated normal map, more roughness and a stronger environment map, so a pond that is not reflecting is water rather than varnish -- this attacks the DIFFERENCE between the states, which is the only cheap fix for a one-reflector scene. (2) A stream is scored at 1% of its fill, so a creek only takes the reflector when there is no still water at all; it was threading the whole course and pulling the reflection off the pond beside you as you walked. (3) The reflection renders on every other frame. Measured on ultra: the pass is 1.9 ms of a 10.4 ms frame and the throttle gives back 1.0 of it. Screen-space reflection was rejected -- it can only reflect what is on screen, and looking across a pond at the trees behind it is exactly the shot where those trees are off screen. Two old assertions reversed by the stream rule were rewritten, not weakened.

- [x] **Undulation without the sun: local relief, and stripes that follow the ground.** Cast shadows only read at a low sun; at midday a two metre roll throws nothing. Three cues now, none costing a frame -- measured at 8.5 ms, unchanged.
  - **Local relief, baked per vertex.** Height minus the average height within 15 m, stored as an attribute at generation time. Measured on a real par 5 against the alternatives: directional relief marks 86.7% of the ground, the textbook Laplacian curvature **0.3%**, local relief 69.5% at 15 m and 81.3% at 30. The Laplacian fails because a bunker lip is hundreds of times more curved than a fairway roll, so any scale that fits the lip erases the roll. Normalised by its own 90th percentile so one cliff cannot flatten a course; three tests, including a plane that must stay unshaded.
  - **The screen-space crease term is gone.** Same quantity as the Laplacian, same failure, and it varied with camera distance on top.
  - **And then faded out on slopes, by two mechanisms I had added myself.** The anti-alias fade was measured on the bent coordinate, so the height term fed its own suppression wherever the ground was steep or grazing; and the contrast term was additive, so it crossed zero about eleven degrees against the mow line and killed the bands outright. Fade now measured on the plan coordinate, contrast scaled rather than added and clamped away from zero. Found from a screenshot -- no frame time or test would have shown it.
  - **Mowing stripes follow the ground.** They existed but were computed in the plan from x and z, so they ran straight over a roll. Now a height term bends the bands and the contrast varies with the surface normal along the mow direction -- which is what real stripes do, because the mower follows the ground and the grass angle changes with it.
  - The preview that drove the decision is still in `docs/studies/`: five shadings of one real hole with live sliders.
  - **Slope tint needed two corrections, both magnitudes I had guessed.** After the range was fixed it was still invisible: the colour change on a fairway pixel was 1.8 of 255 in blue, under one percent. Now 15-20, roughly ten times, with the fairway gain raised from .55 to 1 and the tint from .80 to .50 blue. Green held at exactly 1.0, which is what keeps turf from going brown.
  - **Slope tint first shipped doing nothing.** The curve ran from tan 0.12 to 0.55, a guess at what a slope is. Measured, a fairway is 3.3 degrees at the median and 9.5 at the 99th -- so it touched 0.0% of fairway and 0.1% of semi-rough, and the whole effect was in the rough. Mown ground and rough now have their own ranges; fairway mean dryness went 0.00 to 0.30. Both mistakes in this feature were a scale guessed instead of sampled.
  - **Slope-tinted turf, added after a look.** The only cue here that is a colour rather than a brightness -- everything else competes for value. A slope sheds water and burns off, a hollow holds it and stays lush, which also reinforces the baked relief instead of fighting it. Slope as the tangent, not one-minus-normal-y, which says almost nothing over the range a fairway occupies. Gained by surface as irrigation: green .15, fringe .35, fairway .55, rough 1.
  - **All three are switches now, in Graphics**, with contour lines added as the third. Uniforms and never defines: a define is part of the program key and would recompile every lit material in the scene, which is the floodlight trap. Measured at one frame and zero programs per toggle, re-applied per course build, and verified to survive a reload with the switches in a non-default state. `lab.state().cues` reports them as the shader has them.
  - **Ambient occlusion was made switchable, measured, and then removed.** `lab.ao()` rendered the occlusion term into a target and read it back: from a tee it reached 5.4% of the frame at a mean multiplier of 0.997. It worked; a golf course has nothing for it to occlude, because ambient occlusion shades where surfaces meet and an open fairway has a tree line and a bunker lip. A full extra scene render for that is the worst ratio of anything here, and local relief already covers the ground for free. Module, tier key, `needsRebuild` clause, panel switch and probe all deleted.
  - **Its cost is still unmeasured.** Attempted, but the machine was loaded enough that turning features ON measured FASTER than leaving them off -- 18.9 ms with all three off against 13.9 with two on -- which is noise, not data. The earlier idle-machine numbers stand for reflections (1.9 ms of a 10.4 ms frame) and terrain shadows (8.6 against 8.5); AO wants a quiet machine before any number is written down.
  - Still on the table: (unmeasured -- it is a post pass, so unlike these it is not free), and coarse contour banding as a tools-tray toggle.

- [x] **The mulligan reaches back one shot, on the hole you are playing.** `history` runs across hole boundaries, so on a fresh tee the top of it was the last shot of the PREVIOUS hole -- pressing Mulligan rewound a whole hole and unrecorded its score while undoing nothing you had done on this one. `canMulligan()` requires the top entry to belong to the current hole; holing out does not end it, because the card is up for a few seconds and taking back the putt that just dropped is reasonable. The button now says why it is off. An old test asserted the cross-hole rewind outright and was rewritten to the new rule rather than weakened.
  - **And it takes one tracer with it, not all of them.** `holeTrails.pop()` before `loadCourse()` did nothing: `loadCourse` calls `resetTrails()`, because it is the routine that grows a new hole. Every tracer on the hole vanished and the summary showed only the shots after the mulligan. The trails are kept across the reload and restored; `lab.state().trails` reports the count, since they are only drawn at the end of a hole.

- [x] **The camera panel is one section, and the view picker is gone.** Player, overview, green and free flight are four buttons on the tools tray now -- the green view had none and was reachable only from a select inside a settings panel. A mode selector there made the view you are looking THROUGH into a saved preference, which is how opening the panel from the main menu once saved "free flight". "Go somewhere" is gone with it: Explore duplicated the tray's free-flight button, and `flyToWater` went too, since the waterside viewpoint was its only caller. Follow-the-ball moved in, the bay and hand-tuning sets swap rather than sitting side by side contradicting each other, and a round no longer carries a camera at all -- `saveRecord` writes only the green-reading flags, so a bay setup survives discarding a round and never travels inside one you share.

- [x] **Water that looks like water without a reflector, and reflections on every body.** A pond with no reflector was an opaque grey sheet. Two causes underneath: `waterNormals()` is built for three's Water shader and has an amplitude of nine parts in 255, and it has no mipmaps while pond UVs arrive in world metres -- so a metre-wide tile aliased to a flat wash at distance. The real fix was not a better texture though: it is FRESNEL. Alpha now runs from 22% of the body's depth opacity looking down into it to full looking across, so you see the bed through the shallows and sky at a grazing angle, which is what reads as water. Costs nothing and works on every body.
  - **Reflections everywhere, via a probe rather than a reflector.** `scene.environment` held only a clone of the sky, which is why non-reflecting water could only ever show sky colour. A `CubeCamera` now renders the course into a 256 square cubemap once per environment refresh and every water material samples it: 13 of 13 bodies reflecting terrain and trees at 8.5 ms, unchanged. It gives up parallax, which matters on glass and not on ripples. `scene.environment` stays sky-only because it feeds every prop.
  - **Found on the way:** `dressStillWater` was assigning `onBeforeCompile` over `shoreFade`'s, and three allows only one -- every pond had silently lost its shoreline fade.
  - **And I deleted twelve methods** with an over-wide edit range, including `addSky` and `addFloodlights`, which surfaced as the "needs WebGL 2" card. Restored from the checkpoint and the two later edits re-applied.

- [x] **Three bugs in the new graphics switches, all from one screenshot.** (1) Ambient occlusion renders the scene with an override material to capture normals, and `onBeforeRender` still fires -- so the water drew its REFLECTION in normal colours and kept sampling them. Magenta and cyan water. The reflection now refuses to draw during any override pass. (2) The reflections switch really did nothing visible: cadence zero stopped the render but the shader went on sampling a frozen target. Off now hides the reflector and brings the body's plain mesh back. (3) Ambient occlusion drew nothing below Ultra, because the pass returns on a zero strength and the tier supplies zero -- the tier is a default now, not a gate. None of the three would have shown in a frame time, a link error or a test.

- [x] **Camera settings are device preferences, and a bay can be measured rather than guessed.** They lived in the round's autosave, so discarding a round took your setup with it and a shared round arrived carrying somebody else's screen size. `fairway-camera-v1` now holds them beside graphics and the panel layout, and **Camera & bay** is on the main menu as well as the tools tray.
  - **`projector.js`** turns a screen size, a screen shape and a standing distance into the one vertical angle the room subtends: `2*atan((h/2)/d)`, with the height off the diagonal by Pythagoras. The panel prints the angle a bay gives and, for a hand-set angle, how far back you would have to stand -- exact inverses, and a test asserts the round trip. Clamped 10-140 degrees, because a bay entered in the wrong units would otherwise ask for a degenerate projection and a camera that renders nothing is worse than one that is not to scale.
  - **`cameraRig()` places the player camera.** With the bay on, the eye is at eye height, the ball is its own distance in front, and the lateral offset is forced to ZERO -- a golfer stands behind the ball, not beside it. The ball can fall below the frame, which is where it is in the room. Overview and the green view keep the chosen angle: neither is a view from where anyone stands.
  - **The menu backdrop owns the live camera**, forcing free flight to orbit the showcase hole, so the panel shows the SAVED view and writes the select's value back. Caught in testing: opening the panel from the main menu had saved "free flight" and the next launch started in it.
  - **The putt follow points at the hole.** `followPose` keeps `flightCameraPose`'s eye exactly and pins only the target on the cup, so the hole sits still while the putt runs at it. One camera for every shot still holds -- the rig does not change, only the look.
  - **On the green the camera backs off until the ball is in frame.** A correct bay view puts the ball 62.8 degrees below the axis and the frame is 18.8 to its edge -- right for a full shot, useless for a putt you aim from the ball. `framedForBall` raises the setback to `height/tan(halfFov*0.85)` and changes nothing else; for a 100" screen at 6 ft that is 6.11 m, with the ball 16.0 degrees below the horizon and a six metre putt's cup 6.6 below the axis. Deliberately a no-op for the broadcast rig, which already has the ball at 81% of its half-angle. Five more tests, including one asserting an already-good rig is returned as the SAME object.
  - Ten tests on the geometry and the preference store, four on the putt follow. Verified in the build: a 100" screen at 6 ft gives 37.6 degrees, the rig reads eye 1.75 m / ball 0.9 m / offset 0, and it survives a reload.

- [x] **"Start fresh round" is gone from the round panel while a round is being played.** The panel is how you change your group, reach your saved rounds and export the one in progress; the primary button in its tab row offered to throw that round away every time you opened it. Starting over is a main-menu decision. `roundSurprise` and the library's Play still start one from here and still go through `guardRound` to do it.

- [x] **Removing a golfer mid-round: three bugs, one button.** (1) The first row had no delete button at all -- gated on `i` rather than on there being more than one golfer -- so the only way to drop the first name was to remove everyone else and retype it. (2) `applyGroup` used `confirm()`, which some embedded browsers suppress outright; a suppressed confirm returns false, so Apply did nothing, silently. It arms and names who is leaving instead, the way the course list does, and disarms when the draft changes underneath it. (3) `setPlayers` resized per-player arrays by LENGTH while the editor removes by identity, so removing the first of two golfers deleted the second one's card and handed the first one's strokes and ball to whoever was left, under the remaining name. Draft rows carry `seat` now; `seat` is stripped from the stored player so it cannot be read back against a group that has since changed. Six tests.

- [x] **A scramble chooses its ball on the course.** Every ball the team hit stays where it lies, in the colour of the golfer who hit it, under a beam that is not occluded by the ground between you and it. The bar steps between them and puts the camera behind each ball on its line to the pin -- the view the next shot would be played from -- and the check mark takes the one you are looking at. It opens on the ball nearest the pin. The old row of buttons in the result panel and the scorecard is gone: a list can say "Alex, 148 yd" but not that Alex is behind a bunker, and with a persistent bar the lists were a second, worse way to answer the same question. `setUpTurn` now returns early during a selection, which is also what makes a reload mid-choice come back to the picker instead of offering a shot from a lie the team may abandon.

- [x] **Honours on the tee, and the turn follows the playing order.** Stroke play already kept a golfer on the ball until they holed out, but it picked the next one with `done.findIndex(d => !d)` -- array position, the order the names were typed in. `round.order` is now the hole's playing order and `nextInOrder()` is the only thing that moves the turn. `honoursOrder()` sorts the previous hole's cards lowest first; ties keep the order the group had (stable sort), a golfer with no card for that hole goes to the back rather than to the front where an undefined score would sort them, and fractional putting scores rank like any other number. `setPlayers` repairs it like every other per-player array, and `restore` rebuilds it unless the save holds a clean permutation -- every round saved before this has no `order`, and a broken one would drop a golfer from the hole. Match play is unchanged in substance, but its farthest-ball sort now runs over `order`, so honours breaks the tie on the tee where every ball is the same distance from the pin. Thirteen tests, including one that pins "the same golfer plays until the ball is in the hole" so the alternating cannot come back unnoticed.

- [x] **A colour per golfer, on their card and on their tracers.** Every tracer was one amber, so the end-of-hole flyover -- which exists to show who went where -- withheld exactly that. `src/player-colours.js` assigns gold / cyan / indigo / magenta by position in the group: the chip beside the name on the course card and in the header, the dot on the scorecard row, the dot in the group editor, and the tracer on the summary orbit are all one colour per golfer.
  - **Red and green are reserved** for over and under par on those same cards, and the test asserts that against `parTint` itself rather than against a comment -- every player hue is 35 degrees or more from both, and 50 or more from every other player. Changing the tint now fails a test instead of quietly creating a collision.
  - **The line pool is why the colour is set on every pass.** `shotLines` is reused across holes and players, so setting the material colour only at construction left trail 2 wearing whoever hit trail 2 on the previous hole. `pushTrail` records `round.active`, taken before `round.takeShot` advances the turn.
  - `lab.state().shotLines` now reports each visible tracer's material colour -- the colour is not in the DOM, so that is the only way to check the line, the chip and the dot agree.
  - Fixed in passing: `.player-row` is a grid whose remove button had no column and was wrapping onto a second row. Leftover `flex` rules on it and on `.drop-spacer` are inert in a grid, and the spacer only makes sense if the button is on the row at all.
  - Verified on a two-player scramble: five tracers alternating `#efc761` and `#61d8ef`, the card chip switching gold to cyan as the turn passed, and the scorecard showing both dots against green under-par cells.

- [x] **The wordmark stays when a sheet opens over the main menu.** Opening Play or Saved courses hid the menu outright, and the topbar that carries the brand everywhere else is `display:none` in menu mode -- so a panel opened from the menu had no branding on screen at all. `.menu-behind` keeps the masthead, hides the deck (the tiles are what the sheet replaced) and drops the menu from z-index 80 to 19, below the drawer's backdrop, because `.main-menu` is fixed full-screen and would otherwise cover the panel it opened. Inert and `aria-hidden` there, with `aria-modal` removed, since the sheet is the dialog now.

- [x] **Buttons that act on "the thing you are in" now know whether you are in one.** `settings` and `round` are module-level and outlive what they described, so at the main menu both named the backdrop. *Save the course you are playing* saved `DEFAULT_COURSE` under a biome's name on a fresh launch -- a course the player had never seen -- and after an endless run failed with `Holes is not a recognised option.`, because an endless world is `holes: 1`. `savableCourse()` answers with a label naming the course (*Save "Midwest"*) or the reason there is nothing to save, and the panel shows the reason plus a route into Course studio. *Export the round you are playing* is disabled with a reason when there is no round in progress.
  - **Export moved onto the row.** The Saved rounds tab listed rounds and then offered an export of the LIVE one underneath -- a different round from any on screen. Each card exports itself, filename from its name, in the same record shape the import reads.
  - Verified: at the menu, no save button and no export; in play, *Save "Midwest"* and an enabled export; a row exported to `fairway-sunday-at-prairie.json` with the real strokes in it.

- [x] **Rename, and the dedupe that makes it bearable.** `renameCourse` and `renameRound` had been implemented and tested with nothing calling them. Both lists now rename in place -- a card swaps to an input row, Enter commits, Escape cancels. Course-file import stays additive, because an import that wiped a library would be an unrecoverable one-click mistake, but a course whose name and normalised generation settings both match one you have is counted and skipped: re-importing a backup no longer doubles the library. Checked before saving, so a duplicate never spends a slot against the 200-course cap. Measured: the same file twice adds nothing ("Nothing new -- you already have that course"); a file with one new name adds exactly one.
  - **`panelTab` remembers the tab.** Every list action re-renders the panel and `show(0)` threw you back to the first tab, which made renaming two courses in a row a chore. Remembered by title rather than index, because the round panel's sections differ between play, endless and the range.
  - **Focus has to wait for layout.** `groupPanelContent` runs after `renderPanel` returns and rebuilds the panel by emptying its root, which blurs whatever was focused -- so the rename input came up unfocused until it was focused in a `requestAnimationFrame`. Anything else wanting focus on open has the same problem.
  - Four tests on the identity the dedupe rests on: stable across a code round trip and a file, blind to play-scope keys that never travel with a course, and independent of object key order.

- [x] **The tools tray is a panel now.** `.view-tools` had no container -- six individually-glassed buttons floating in a column, which is why it looked unfinished next to every other HUD element and why its handles had to hang outside it. It takes the shared panel chrome, the buttons drop their own glass, and the handles sit inside: grip as a grab strip along the top, resize in the corner, matching the tool windows. The two pinned widths in the 560px breakpoint were exact content fits and grew by the padding.

## Selling it: the attribution pass

- [x] **The name lists grew 24x while being swept.** 30 first words by 20-22
  second words per biome: 19,440 distinct names against roughly 800 before. The
  no-collision rule is kept by a simpler mechanism -- every first word is unique
  to its biome -- and the length check is exhaustive rather than sampled.

- [x] **The fingerprint told us to bump the generator and was wrong.** Renaming
  three biome titles moved three fingerprints, because the hash covers the biome
  RECORD as well as the ground. Verified by hashing ground alone across the
  change: byte-identical. The tool now reports the two separately, says plainly
  when no bump is owed, and both paths were tested by making each kind of change.
  An arbiter that cries wolf gets ignored the one time it matters.


Asked for on 2026-09-25: is everything clear for making money off this. An
engineering provenance pass, not legal advice.

- [x] **Licences are clear.** 53 packages: 35 MIT, 12 MPL-2.0, 3 Apache-2.0,
  2 ISC, 1 BSD-3-Clause, every one permitting commercial use with notice
  retention only. All twelve MPL packages are Lightning CSS, build scope; MPL is
  file-level copyleft and does not reach the output of running the tool. Only
  three packages are runtime scope at all: three, lucide, ws.

- [x] **`npm audit` runs now** -- it could not in September, and was remaining
  release check 1. Zero vulnerabilities across 53 packages on this date.

- [x] **The shipped imported-asset footprint is four PNGs, 64 KB, all CC0.**
  Kenney house colour atlases. Verified rather than assumed: no texturecan
  texture anywhere in the tree, no ez-tree leaf sprite in the build, no fonts,
  no audio, and zero runtime network requests.

- [x] **SIX COURSE NAMES WERE REAL GOLF DESTINATIONS, and are gone.** Titles are now Sitka Bluff, Vermilion Basin and Leeward Cay, the four generator words are removed, and a denylist test stops them returning. No generator bump was owed -- the ground was verified unchanged by hashing it alone across the change. Original note: Bandon and Turtle Bay are
  default biome titles; Bandon, Dornoch, Kintyre and Saguaro are in the name
  generator. Place names are weak marks, but a real resort's name on a course in
  a golf product being sold is the combination that draws attention. Minutes to
  remove, no generator bump needed since names are not generation settings. The
  generator cannot currently produce "Bandon Dunes" only because those two words
  live in different biome lists -- luck, not design.

- [x] **The portable archive is seven files**: the game, LICENSE, THIRD_PARTY_NOTICES, ATTRIBUTION, its own README, INSTALLATION and PLAYING (the manual). Its README is `docs/PORTABLE_README.md`, not the repository's -- the root README links into `docs/` and talks about `npm ci`, which is a page of dead links to somebody who unzipped a game. It was shipping the architecture handoff, the open defect list, the research measurements, the provenance review, the dependency inventory and AGENTS.md. Source archive keeps all of it. Original note: The internal engineering process
  document, including write-ups of past failures. Harmless, odd to hand a paying
  customer. Owner's call.

## Getting it into other people's hands

- [x] **The archives were 124 commits stale and are rebuilt.** The
  `Fairway.html` inside the shipped portable ZIP was 1.2 MB against a current
  build of 15.1 MB -- it predated the whole mesh ingest, so anyone handed it was
  playing a materially different game. Portable is 6.9 MB now, source 7.1 MB,
  both verified file-by-file with fresh SHA-256 sums.

- [x] **`package_release.py` could not read its own build.** It read the HTML
  with the platform default encoding, cp1252 on Windows, which was fine while
  the file was small and ASCII and died on byte 0x9d of 15 MB. Every read and
  write names UTF-8 now.

- [x] **Its dependency gate earned its keep.** It refuses to package while
  `DEPENDENCY_INVENTORY.json` disagrees with the lockfile, and three build-scope
  packages had arrived since the review: ez-tree (MIT, bakes geometry that
  SHIPS), playwright and playwright-core (Apache-2.0, touch nothing shipped).

- [x] **ATTRIBUTION.md was missing from both archives.** The review document
  ships in both ZIPs and cites it by name for the CC0 pack credits, so the
  archive pointed at a document it did not contain. It ships now, with
  BALL_BEHAVIOUR_KNOBS.md and REFERENCES.md.

- [x] **GENERATOR_VERSION is frozen by decision, not by mechanism.** The
  owner is making no generation changes during testing and will tell testers
  directly if that changes. Decided 25 September, and it is the right call for
  a handful of testers: a mechanism to enforce it would cost more than the
  problem. **The reason it matters has not gone away** -- every bump silently
  rebuilds the ground under a saved round, and a tester reads that as the game
  losing their game. It stands at 32. If a generation change becomes
  unavoidable mid-test, warn people BEFORE shipping the build, not after.

- [x] **A tester can now tell you what went wrong.** Help & controls → Report
  a problem → Copy diagnostic. `src/diagnostic.js` assembles it and
  `collectDiagnostic()` in main.js gathers the facts; the split exists so the
  formatting can be tested without a browser, which is where all 16 of its
  tests live.

  The course code was already carrying the recipe for the ground -- schema,
  generator, name, settings diff -- so the report ADDS it rather than
  duplicating it, and adds what it could not carry:

  - **A build stamp, which did not exist at all.** `vite.config.js` now
    injects `__FAIRWAY_BUILD__` with the short git commit and the build time.
    Undefined under the test runner, so every read guards it -- a bare
    reference to an absent `define` is a ReferenceError, not undefined, and
    would take the module down on import. A source-archive build has no git
    and gets a timestamp alone, which still distinguishes two builds.
  - **The GPU**, which the running game had never asked for.
    `WEBGL_debug_renderer_info` through the context three already holds. A
    browser that withholds it is a normal answer; Firefox does under
    resistFingerprinting.
  - **Frame rate as a median and a worst frame, never a mean.** A mean hides
    the complaint: a run that holds 60 and stalls twice a second averages out
    respectable and is unplayable. Sampled past the frame cap, so a capped run
    reports the rate it is capped to.
  - **The last few errors.** console.error is wrapped at module scope, before
    boot, because the interesting failures are the ones during start-up. The
    original is always called -- a logger that swallowed what it logged would
    make this harder to debug. Repeats are counted rather than repeated: a
    broken frame throws sixty times a second.
  - Browser, platform, screen, viewport, pixel ratio, cores, memory, touch,
    tier, frame cap, mode, hole, biome, and the time it was taken.

  Two kinds of missing are kept apart, which matters more than it sounds:
  in MACHINE a blank prints "unknown", because a browser refusing to say is
  itself worth knowing; in WHERE the row is dropped, because there is no hole
  number in the menu and "unknown" there reads as a fault that was never
  there.

  **It is copied, never sent, and that is now an invariant in
  PROJECT_HANDOFF.** No fetch, no image, no beacon. Re-verified in the browser
  with the diagnostic in use: the only request the page makes is the page.

- [x] **The `file://` open WORKS on the current build.** Confirmed by the
  owner on 25 September: unzip the portable archive, double-click
  `Fairway.html`, and it plays. This is the central portability claim -- the
  entire argument for a single-file build -- and it had been carried as
  unverified across three review addenda, the last confirmation having been
  made when the file was an eighth of its present size. It is now a 15.8 MB
  document with the whole mesh ingest inlined, and it still opens off the
  filesystem.

  It is now checked on every `npm run smoke`, in Chromium, by file:// -- the
  "cannot be scripted" in the original of this entry was the in-app preview
  pane's limitation, not a browser's. Safari and Firefox remain by hand.
  It stays worth re-checking whenever the build gains something structurally
  new rather than merely bigger, because what breaks a file URL is a fetch, a
  worker or a module boundary, not a megabyte.

## Obstructions in the shot path

- [x] **DONE. Slice 1: a forward launch corridor, anchored to each tee.**
  **0 of 648 blocked, from 4.5%.** Tree counts unchanged. Two wrong turns on the
  way, both recorded below. Was: A wedge from
  each tee along its own aim, not a bubble: keep-out ahead only, so trees BESIDE
  and BEHIND a tee are untouched. Those are wanted -- they make a tee box
  interesting and they hide the basin-around-the-tee artefacts. Applies to world
  trees, rocks and the uniform half of deadfall. Acceptance: re-run the harness
  over the same 648 tee shots and get 0% blocked, with tree count per course
  essentially unchanged.

- [x] **The wedge pointed at the wrong target first.** It aimed along `teeAim`,
  which is the bearing the tee PAD is squared to and looks only ~60 m ahead. On
  one hole that was **35 degrees** away from where the ball goes, and the wedge
  sailed past an oak 20 m off the tee sitting 0.7 m off the played line. It
  follows `fairwayAim` now -- the same line the acceptance harness plays -- and
  `fairwayAim` moved into course.js so both sides share one definition.

- [x] **A fixed-length wedge was the wrong shape.** At 90 m it let a fir through
  at 118 m on a redwood hole, where the ball is still only thirty metres up and
  the tree is eighty. Lengthening it would have thrown away short trees far down
  the hole that nothing could ever hit. `blocksLaunch` asks about HEIGHT instead:
  would the nominal shot pass between this object's base and its top. That covers
  a redwood at 118 m and lets a boulder stand at 150 m, and it is the same
  question the test asks.

- [x] **The harness lied first, and it was the seventh metric in this project to
  do it.** It fired a 210 m drive from every tee, so on par threes it measured
  trees BEHIND THE GREEN and called them blockers: 14 of 16 apparent failures
  after the first fix were that. A par three is played to the green. The shot
  model is shared with the guard now rather than written twice.

- [x] **DONE. Slice 2: make the other solid things solid.** Rocks are world
  data and collide; lit poles collide; deadfall stays decorative on the owner's
  call. Was: Audited -- only tree
  trunks and homes collide today. Also needs it:
  - **Rocks/boulders.** Not in world data AT ALL: placed in vegetation.js at
    render time from a seeded rng, so physics cannot see them. Has to move into
    `generateWorld` output, which is the architectural half of this slice.
  - **Floodlight poles.** 23 m of steel standing just outside the corridor,
    built for every hole at world-build time. Derived from hole geometry by
    `polesFor`, so no world-data change is needed -- cheap to add. Decide what
    happens when floodlights are off but the poles are still drawn.
  - **Deadfall** (logs, stumps, mossrocks). Non-colliding by explicit design --
    "a ball rolls through a fallen log". Owner's call whether that changes; a log
    is a real obstacle in real golf but it is also 1 m tall in deep rough.
  - **The flagstick** is deliberately ignored and is a separate question from
    this one. Real golf hits the pin.

- [x] **Boulders are generation output now, not decoration.** They were placed
  in vegetation.js at draw time from an rng the generator never saw, so the world
  did not know where they were and a ball flew through a six-metre stone. Moved
  into `generateWorld` as `world.rocks`, carrying `reach` and `top`; the renderer
  reads that list instead of inventing its own. Everything solid -- trunks,
  boulders, masts -- now goes through the SAME swept-circle test, so there is no
  second collision routine to keep honest.

- [x] **The fingerprint tool was blind to rocks, and would have stayed blind.**
  It hashes an explicit list of what a player can see, and rocks were not on it
  because they were not generation output when it was written. Adding them is
  what stops a future change to where boulders sit going unnoticed now that a
  ball can stop against one.

- [x] **Floodlight masts collide only when they are lit.** The whole floodlight
  group is hidden when the lights are down, and a ball stopping dead against a
  mast nobody can see is worse than one passing through a visible one. So they
  are handed IN through options by main.js rather than read off the course,
  which keeps "what you see is what you hit" true in both directions.

- [x] **Deadfall stays decorative.** Owner's call. 520 pieces, redwood only --
  every other biome has none -- knee height in deep rough where the ball is
  already being punished. Making them solid would add a lot of small
  unpredictable stops in the one biome that has them.

- [x] **DONE. Slice 3: specimen obstacles, on purpose.** `fairwayFeature`,
  0-100%, default 20. Was: A feature tree or rock cluster
  sited in the short grass near the landing zone -- the Pebble Beach cypress, the
  lone oak in a fairway. Fair rather than cheap: visible from the tee, never on
  the tee-shot line, and always a playable route past it. **With a slider for how
  often it happens**, so a course can be clean or quirky. New settings field, so
  it carries a schema and GENERATOR_VERSION bump with it.

- [x] **A specimen is allowed on the line of play, and that was the hard part.**
  The launch corridor forbids any trunk in the flight path, which is right for
  scatter planting and wrong for a feature -- an oak in the middle of a fairway
  IS on the line, and playing to the side of it is the hole. `blocksLaunch`
  takes a `within` now: scatter gets the whole carry, a specimen gets only the
  near stretch (130 m), where a tree low in the flight is the original
  complaint. What makes the rest fair is the gap beside it, not an empty centre.

- [x] **The siting rules are the feature.** At least 13 m of open short grass on
  one side so there is always a route; 75 m back off the green; only where the
  corridor is at least 15 m half-wide; never inside the near stretch of a tee
  shot. All four asserted, in `fairway-features.test.mjs`.

- [x] **It validated the centre and then built something else.** The first
  version checked the cluster's centre point and then scattered stones up to a
  full radius away, sideways, into the gap it had just guaranteed -- the test
  caught it 0.1 m short of the rule. Everything is laid out first now and every
  piece has to pass, because the piece that sticks out is the one a ball hits.

- [x] **The fairness test was stricter than the rule, and the rule was right.**
  It failed a feature 121 m out and 17 m off the line -- where the ball is 29 m
  up and flies clean over a 25 m tree. Being to the side is irrelevant when you
  are above it. The test asks about height now, as the generator does.

- [x] **An old invariant said every tree stands on rough,** which a specimen
  deliberately breaks. Narrowed to scatter planting rather than deleted, with a
  second assertion that scatter trees exist at all so it cannot pass vacuously.

## Tee surrounds, and the moat that made them

- [x] **The tee ramp is a share of the hole's width, not a number of metres.**
  A fixed -20 m floor is compared against `n.d`, which grows with the corridor,
  so it held at the 38 m default and collapsed at the top of the width slider:
  0.25 of course average at 92 m, and 0.03 at worst, which is worse than the
  clear-cut this work started from. Scaled to three times the corridor
  half-width it runs **0.34 to 0.90 across all eight biomes and the whole
  slider**. Tee shots stay at 0 of 648 blocked.

- [x] **`surrounds` is a bench metric now, not a throwaway script.** This
  question gets asked every time planting or corridor width moves, across eight
  biomes and a slider, and each answer costs a course. It imports
  `greenApproaches` from src rather than recomputing which way a green faces.
  Run it with `--set trees=65`: the standard fixtures build with `trees: 0`
  because every other metric measures terrain, where planting is irrelevant and
  costs time.

- [x] **The metric lied twice before it was right.** First it measured each tee's
  own 20 m circle -- a circle that small holds a handful of trees, so every
  reading was zero or a spike and the median came out at zero on a course
  planted perfectly well. Then it reported a shelf of zeros on the standard
  fixtures and tripped its own invariant, because those courses have no trees at
  all. It pools every tee into one reading per course and refuses to report when
  there is nothing planted.

- [x] **Links has no trees and never did.** It plants gorse, heather and shrub,
  all of them ground cover with no trunk, so none of the tee or green planting
  rules touch it. Worth knowing before anyone reads a blank row as a failure.

- [x] **Generator versions 24 to 29 had no entries.** The list in
  settings-schema.js stopped at 23 while the constant climbed through five
  bumps in one session -- the exact failure the file warns about, committed
  repeatedly. All six written up.

- [x] **Tee boxes read as clear-cut, and one signed number was the cause.**
  Measured per hectare of ROUGH (mown turf can never hold a tree, so counting it
  understates the rest): the first 20 m around a tee ran at 19-50% of course
  density, recovering only past 60 m. `nearest().d` IS SIGNED -- it is the
  distance outside a hole's corridor ENVELOPE, and near a tee that envelope is
  far wider than the mown turf. 99% of the rough around a tee sits at a negative
  d, as deep as -34 m, so "at least 10 m outside a corridor" banned the entire
  surround while the surface classifier called that same ground rough.
  Now 65-105% across seeds, with the shot still clear.

- [x] **It was safe to drop only because of the launch corridor.** The blanket
  10 m used to be the thing keeping a tee shot clear. `blocksLaunch` does that
  exactly now, pointing where the shot actually goes, so the blanket was free to
  stop being a moat. 0 of 648 tee shots blocked, unchanged.

- [x] **The hard edge is a ramp everywhere else too.** A cliff produces two
  artefacts at once: a bare moat, and a PILE-UP just outside it, because every
  refused candidate is pushed outward and bunches at the boundary -- greens
  measured 0% inside 20 m and 160-179% at 55-120 m. Acceptance now climbs from
  nothing at the floor to certainty by `EDGE.soft`, so edge candidates are
  sometimes kept rather than all shoved out.

- [x] **Overcorrected first, and the measurement caught it.** Dropping the gate
  near tees with no ramp at all left the surround DENSER than the course
  average, 129-160% -- a thicket rather than a frame. A ramp over negative
  distances brought it back to roughly average.

- [x] **A blocked tee shot appeared and was slice 3 working.** The harness was
  not setting `fairwayFeature: 0` the way the real test does, so it counted a
  specimen redwood at 207 m as a defect. Before spotting that I added a carry
  `overrun` to "fix" it; that fixed nothing and was reverted rather than left in
  as unmeasured margin.

- [x] **One seed says very little here.** The same biome ranges 38% to 88%
  across seeds, so the test averages several rather than pinning to whichever
  one it was written against -- a single-seed threshold was written first and
  failed on an outlier at 38%.

- [x] **Slice C done: greens open on the approach, closed behind and beside.**
  `greenTrees`, 0-100%, default 40. The arc facing back down the fairway keeps
  its full 46 m at EVERY setting -- measured, the nearest tree on the approach
  stays at 35.8 m whether the slider is at 0 or 100 -- and the slider moves the
  back and the flanks only: 6, 7, 10, 15, 30 trees within 40 m of a green across
  0/25/50/75/100. The approach direction is taken from the middle of the hole
  70 m short of the green, so a dogleg's approach is where the shot really comes
  from rather than the line from the tee.

- [x] **The slider's top end was a wall before it was tuned.** At `near` 11 m the
  20-35 m band ran at 266% of course density, because the thinning ramp had
  stopped biting before the rough even started -- mown ground reaches about 24 m
  out, so any keep-out below that does nothing except remove the taper. Swept:
  `near` 24 with a 20 m ramp gives 51/64/153% across the slider, which is a
  frame rather than a wall.

- [x] **A combined TEE FAN, not three separate wedges.** A tree can miss the
  back tee's own wedge and still stand in what you SEE from it: the three tees
  are staggered and can be ninety metres apart across a hole, so judging each
  alone leaves the ground between them plantable and that ground is straight
  down the view. Planting is now refused inside the convex hull of all three
  wedges -- trees go behind the complex or outside the widest tee on each side.
  It ignores height, because a tree the ball flies over still hides where the
  ball is going. Costs some surround density (pnw worst case 75% to 58%) and
  tee shots stay at 0 of 648 blocked.

## Green and bunker shapes

- [x] **The slope slider's warning jumped the slider out from under the cursor
  (1 October).** Branch `slope-warning-on-release`, reported by the owner. The
  note appeared the moment the slider crossed 75%, grew the field, and the
  panel's columns reflowed mid-drag: the slider moved 229 px while held. Now
  only the red follows the drag; the note and the toast wait for the release.
  Checked with a real mouse drag: the slider stays put the whole way, turns red
  at 76, and the note and toast appear on letting go. Shown in the field on
  release, it still made the field hop to another column, so (the owner's
  choice) it is a bubble that pops out over the panel instead and moves
  nothing: the slider's position measured identical before, during and after.
  It flips above the slider when the panel would cut it off below, and goes at
  the next click, after 8 s, or back under 75%; the red stays.

- [x] **Greens with a character each, raised greens, punchbowls and false
  fronts (30 September).** Branch `green-shapes`, GENERATOR_VERSION 33,
  SCHEMA_VERSION 9. The owner's screenshot of a bright band across a green at
  an evening sun was two things: nearly every green carried a square-wave step,
  and the green's own raking light lit each face at a low sun. The raking light
  now eases off as the sun drops; each green draws rolling, tiered, ridged,
  crowned or bowl from its seed, and only tiered greens have a step. The top of
  the slope slider reaches much further (7.2% mean and 7.2 ft of relief at 100,
  against 5.4% and 5.6 ft), with broader rolls and wider tier faces so it stays
  puttable and smooth. Three new share-of-greens settings: raised (default
  25%), punchbowl (10%) and false fronts (20%). Past 75% the slope slider turns
  red with a warning note and a toast, at the owner's request. RESEARCH.md
  *Greens with a character each*.

- [x] **`greenShape` and `bunkerShape`, 0-100%, default 30.** They raise the
  amplitude of the harmonics AND pull them toward equal as they rise, so no
  single wave takes over. Medians go 1.24 to 1.42 to 1.74 for greens and 1.48 to
  1.63 to 1.83 for bunkers. At 0 the outline is exactly what the generator always
  produced, which is what makes it safe to ship.

- [x] **Scaling the drawn mix was tried first and looked wrong -- owner rejected
  it on sight.** It preserved WHICH HARMONIC DOMINATED, and the three-lobed wave
  is drawn always-positive and largest, so it leads on 69 of 81 greens. Amplified,
  that is a clean three-lobed flower, and stretched by a green's aspect it is two
  round lobes and a tapering shaft. Evening the mix costs range -- 1.74 at full
  against the rejected 2.45 -- and that range was the flower.

- [x] **The first descriptor used to diagnose it was blind by construction.** It
  measured how far an outline differs from its own 180-degree rotation, which
  cannot see harmonic 2 at all, that harmonic being symmetric under exactly that
  rotation. Four very different mixes returned identical numbers. Eighth
  measurement in this project to measure the wrong thing.

- [x] **No shader change was needed, and that was the point.** Scaling happens at
  GENERATION, so the route texture and the hazard texture pack the already-scaled
  values and the painted surface and the played lie come from one set of numbers.
  Scaling at read time would have put the same arithmetic in GLSL and JS, which
  is how the apron was once painted as fairway and played as semi-rough.

- [x] **A cap keeps the radius positive.** .34 for greens and .30 for bunkers, on
  the SUM of the harmonics: at the cap the narrowest point of a green is still
  comfortably over half nominal, so an outline can pinch but never fold through
  itself. Tested at 360 angles on every green at every setting.

- [x] **The terrain patch was checked and needed nothing.** The high-resolution
  grid is cut 38 m from a green's centre; the furthest a shaped green reaches is
  31.5 m even at 100%. An earlier worst-case estimate said 42 m and was wrong --
  it assumed maximum size, aspect and wave all landing on the same hole.

- [x] **A characterisation test was sampling the wrong place.** It measured
  ground slope on a fixed ring at `greenSize*greenAspect+7`, which is only "7 m
  outside the green" while the green is an oval; once the edge could move, the
  ring landed on the green's own shoulder and reported a regression that was a
  change of sampling point. It marches out using `greenDistance` now -- proved
  harmless by measurement, 0.661 against 0.663 on the old geometry.

## Shot numbers that stay on the card

- [x] **The numbers persist between shots, and the card is one function now.**
  Three separate fixed stat blocks each decided for themselves what a shot was
  worth showing, which is why the launch numbers were on screen for the two
  seconds of a flight and then gone. One `gridHTML` from one record now serves
  every state: just played, played ten minutes ago, a replay, a range session.

- [x] **The live numbers moved to the small line under the player's name.** The
  ticking speed, spin, distance and height used to REPLACE the grid, so the shot
  you had just hit erased the shot you hit before it. Nothing about a ball in the
  air belongs in a panel of finished numbers. `updateHUD` now leaves that line
  alone while a flight is running -- it runs many times a second and would erase
  the ticker between every frame that set it.

- [x] **The invented commentary is gone.** "On to the next.", "Beautiful
  flight." and "A little touch" were the card telling you in words how your shot
  went, over the top of numbers that already said it. What is left are the four
  things that are events rather than opinions: holed, lipped out, a penalty, and
  the hole or round finishing.

- [x] **A CONFIGURABLE GRID: up to twelve tiles, two to four across.** Every
  field is declared once in `SHOT_FIELDS` in `src/shot-data.js` -- id, label,
  unit, group, formatter -- and the grid, the panel checklist, the repair of a
  saved layout and the tests all derive from it. The panel is Shot data in the
  tools tray. Tiles are drawn in REGISTRY order, never tick order: a grid that
  rearranged itself while you tried fields on would make comparing two shots
  harder, which is the one thing the grid is for.

- [x] **Everything else a monitor sends is captured now.** `readExtras` in
  physics.js keeps club speed, speed at impact, attack angle, path, face to
  target, dynamic loft, lie, closure rate, both face impact axes, the backspin
  and sidespin split, and the device's own carry and total. Smash factor and
  face to path are DERIVED -- no monitor sends either -- and face to path stays
  blank when only one of its two halves arrived, rather than reading the half as
  if it were the whole.

- [x] **Not one field of it may reject a shot, and that asymmetry is the whole
  design.** The five are validated hard because a bad one means the model cannot
  run. The extras reach a readout and nothing else, so there is no `throw` and no
  range check in `readExtras`: a device sending a string where a number belongs,
  or a ClubData that is not an object, must not stop a real ball being played.
  Tested against seven shapes of nonsense.

- [x] **The grid gave away the result while the ball was still climbing.** Found
  on screen, not by a test, and every number in it was correct -- `takeShot`
  writes `lastShot` before the ball leaves and the entire flight is simulated in
  that instant. A live flight now holds `priorShot`; a replay keeps lastShot,
  because you already know how that one ended.

- [x] **Two things the first screenshot showed.** The spin tile printed
  "5400 ..." -- the value was sized at 20px in a 94px column and the card ellipsed
  the one thing on it that matters. And sided readings came out "1.1L °", with
  face impact as "2.1 heel mm". Values are sized to fit the narrowest column the
  settings allow, labels wrap instead of truncating, and a field may now return
  its own unit so the side goes after it.

- [x] **The lab passes club numbers through.** `labStrike` rebuilt its payload
  from exactly five fields and dropped everything else, so there was no way to
  test a monitor's club data without a monitor. They ride along per-strike and
  unvalidated, which is what they are on a real shot, and deliberately stay out
  of the remembered launch.

## A course has a name, not a serial number

- [x] **The seed is off the card.** It was printed under the course title,
  where a player reads it once, never types it, and can do nothing with it. The
  title carries the course's name now and the biome moved down to the subtitle,
  so the card still says where in the world you are.

- [x] **The copy button hands over the whole course.** It copied the SEED, which
  is not enough to rebuild anything -- every setting that shapes the ground was
  missing, so pasting it somewhere grew different land. It now produces the same
  share code the library's Get code does, carrying the name and the settings,
  without a trip through the library or a file download. It refuses in an
  endless run using the same sentence a save refuses with, because `holes: 1` is
  not a value a course can hold and the importer would reject it anyway.

- [x] **`copyText` falls back to `execCommand`.** `navigator.clipboard` needs a
  focused document and REJECTS rather than prompting without one, which is every
  embedded preview. Found while verifying: the button worked and reported that
  it could not reach the clipboard. The library's Get code had the same hole and
  now shares the fallback.

- [x] **"Your next great escape" and "An open world. Your game." are gone,** and
  Play and Course studio leave the top-bar menu once you are in one of them.

- [x] **EVERY COURSE HAS A NAME, and it is generated from the landscape.**
  `src/course-names.js` builds them from words that belong to the biome --
  Trade Wind Cove, Dornoch Sands, Copper Hollow -- seeded from the course's own
  seed, so the same course always suggests the same name. The old suggestion was
  the biome's title, which made every midwest course "Prairie Run"; before that
  it was the seed, which is a serial number.

- [x] **Surprise me names what it built** and says so in the toast. It is the
  one entry point with nobody to ask, so it takes the suggestion rather than
  offering it.

- [x] **The name reaches the export**, which it already supported and nothing
  was filling in. A course started from the library brings its name in on
  `settings.courseName`; anything generated falls back to its own suggestion, so
  there is no unnamed course in play for the card, the save button or the code
  to have to invent something for.

## Networked multiplayer

- [x] **`MULTIPLAYER_FEASIBILITY.md`.** Four shapes costed against each other:
  async card-swapping (days, no server), live play on a LAN (moderate, reuses
  the launch-monitor bridge), internet play (significant plus a permanent
  operating burden), and a shared walkable world (high cost, low value, do not
  build). Recommends async first, then host-authoritative LAN play.

- [x] **The float risk was measured rather than assumed.** This model is not
  chaotic: a relative perturbation of 1e-6 in launch speed moves the finish
  0.12 mm and 1e-3 moves it 304 mm, so error grows roughly linearly. A last-bit
  disagreement between two engines would move a ball by a hundredth of a micron.
  The residual risk is BRANCHING -- a lip caught or not -- which is why the
  host's finish stays authoritative.

## Obstructions standing where they should not

- [x] **Rocks were never judged as bodies.** A boulder was tested against the
  launch corridor as a dimensionless POINT, with a ceiling of `y+scale` that is
  not its height, and it never consulted the tee fan at all. Trees have passed
  their trunk girth since the corridor was built. Measured on four courses:
  4 rocks standing in a tee shot, 41 in the view from the tees. Now zero.
  Mountain and desert carry 500 and 550 stones against 160 elsewhere, at twice
  the scale -- exactly where it was reported.

- [x] **Trees had the same gap on the fan, smaller.** They padded the corridor
  test by their girth and the fan test by nothing, so a trunk up to 3.6 m across
  could stand half inside the view from the back tees. 154 of them across 35
  planted courses. The cost of closing it is 31 trees out of 45,909, and the tee
  surround holds at 0.45-0.89 of course average.

- [x] **`tools/bench.mjs teeclear`** calls the generator's own `blocksLaunch` and
  `inTeeFan` against the FINISHED world. That is the only kind of check that
  catches a rule applied unevenly, because during placement the generator's own
  answer was "nothing is in the way". Its first version counted deliberate
  fairway features as breaches and reported four faults that were the setting
  working; features are excluded now.

- [x] **The giant bush was a silent fallback.** The specimen picker took the
  first species that is not ground cover and fell back to `bio.plants[0]`. On
  links every species IS ground cover, so it chose gorse and then sized it by
  the biome canopy: a 13 to 29 m gorse bush. A biome with no tree species gets a
  rock now. Only a tree, a desert cactus or stones may stand in a fairway.

## Tee boxes: what was wrong, and what was not

- [x] **A blind tee shot is never the tee.** All 25 of them across 945 shots are
  caused by ground 96 to 190 m out -- the landing area, not the box. Nothing
  within 80 m. Shortening the pad and steepening the front moved the count from
  25 to 23, which is noise.

- [x] **The generator's own sightline starts 12 m out**, so nothing in the code
  had ever looked at the ground immediately in front of a tee. The `blind`
  metric now walks its own ray from 2 m for that reading. Measured: near ground
  stood above the sight line on 8 of 945 shots, now 2.

- [x] **The stagger is the change that earned its place.** It compared each
  candidate against the PREVIOUS tee only, so blue could sit in line with red
  while white was in line with neither. Against every placed tee, with the worst
  offender deciding: in-line pairs 110 -> 10 of 945, closest pair sideways
  0.00 m -> 3.24 m, at a cost of 1.3 m of median slide.

- [x] **Pad 9 m -> 7.2 m, shoulder 35% shorter directly ahead.** The front fall
  was swept: 0.5 steepens the ground round a pad from a median 6.3 to 10.1
  degrees for no further gain, 0.35 reaches the same result at 7.8.

- [x] **Markers were a metre off the tee.** They stood 4 m either side of a pad
  3 m wide, so both markers of every tee on the course sat in the collar. Six
  inches in from each edge now.

- [x] **The sign was nowhere near the tee.** Fixed at nine metres off the hole's
  own origin, which stopped meaning anything when tees began being sited on
  ground that suits them. It now stands beside the blue tee on the player's
  right -- and which side that is needed working out, because local +x is the
  player's LEFT while the code also calls it "right".

- [x] **`tools/shot-sink.mjs`** lets the game photograph itself into files, so a
  change about how something looks can be shown rather than described. No
  headless browser: the picture is the renderer that ships. It hung its own
  client within the hour when a branch checkout removed its output directory --
  the write threw, no response was sent, and the page waited forever inside a
  requestAnimationFrame callback. It always answers now.

## Boot, generation and camera flights

- [x] **A splash screen, because boot showed the play HUD over an empty canvas.**
  Building the renderer, restoring a saved round and growing the menu's showcase
  hole all happen before `openMenu()` stamps a mode on the shell, and until that
  stamp lands the shot controls, minimap and weather panel sit over nothing. The
  splash is in `index.html` itself rather than built by script -- anything script
  builds arrives after the span it is meant to cover. Blacked out with the
  brandmark and wordmark over it, dismissed once the menu is up and then removed
  from the DOM, so an invisible full-screen element cannot eat a click. The fatal
  path dismisses it too: a black screen hiding the message that explains the
  black screen is the worst version of this.

- [x] **Camera transitions fly instead of cutting.** `setCamera` has always eased
  toward its target, but it snapped whenever the move was over sixty metres --
  and every move worth watching is over sixty metres. `makeCameraFlight` builds
  the path instead: sample the ground AND the canopy under the route, lift over
  what is there, smooth the profile so the rise has no corner, and ease in and
  out with a smoothstep so the move starts and stops at rest. One call in
  `setMode('play')` covers endless, a new round, Continue, the range, an imported
  round and the way back from the studio; `cameraMode` and the flyover's return
  use it too. Measured in the browser, a transition ramps 3.6 to 9.1 and back to
  4.7 in frame-to-frame change, with no single-frame spike -- the ease curve,
  not a cut.

- [x] **Clearing the ground was not enough, and the first version proved it.**
  A blanket `terrain + 34` cleared the dirt but imposed a cruise altitude: a
  forty-metre hop across a green climbed 8.8 m, which reads as a launch. The
  test caught it. The floor is the real obstacle now -- terrain or the canopy
  standing on it, whichever is higher, from `world.trees` filtered to a box
  around the route -- plus a distance-scaled arc that is what actually reads as
  flying. Nine tests, including the ridge, the kink, the canopy and the trees on
  the far side of the property that must not lift anything.

- [x] **A new hole arrives instead of appearing.** Cut to a pose above and behind
  the tee, hold 2.6 s, then fly down onto the ball. Wired into entering a round,
  the next hole in normal play and the next hole in an endless run. The cut TO
  the establishing pose is deliberate and is the one place a cut is right: the
  hole did not exist a moment ago, so there is no continuous space to fly
  through. `freshHole()` gates it -- resuming mid-hole gets the plain flight,
  because an establishing shot of a hole you are halfway down is a recap nobody
  asked for. The range is excluded: one flat rectangle with no shape to
  establish, and a hold every visit would be in the way by the second one.

- [x] **"Trees reach 29 m" was wrong and the arrival pose was built on it.**
  A comment in camera-tours.js carried that number from before the redwood work.
  The test that walks real holes put the camera at 71 m inside a redwood whose
  canopy tops out at 111 m. There is one `canopyTop` now and both the flight and
  the arrival ask it rather than assuming. Four biomes x nine holes in the test.

- [x] **DONE. Generation yields by row band, and the overlay shows real progress.**
  Was: Measured with `--cpu-prof` on an 18-hole feature-heavy course:
  **8.4 s total, and `makeGroundGrid` is 81% of it** (9-hole default 2.4 s,
  one endless hole 250 ms, the range 94 ms). That settles the open question in
  the priority list: yielding between phases buys almost nothing when one phase
  is four fifths of the work. `makeGroundGrid` has three row-major loops and
  chunks cleanly by row band -- make it a `function*`, drain it synchronously for
  the tests and the fingerprint tool, and yield to the browser on a time budget
  for the app. A Web Worker is still the wrong tool: `generateWorld` hands back
  closures that cannot cross the boundary. Acceptance: the eight biome
  fingerprints stay identical, controls stay live while generating, and a stale
  result cannot replace a newer round.

- [x] **DONE. The generating overlay's spinner has never spun.** `.generating-spin` is
  a ring with a lit top edge and no `animation` property at all -- which nobody
  noticed because the thread is locked solid the whole time it is on screen.
  Once generation yields it needs a real animation and a real progress reading,
  which is the point of the chunking above. The splash's dots animate today
  because nothing is blocking when they are up.

- [x] **Explained, not a bug.** Reached through the Endless panel a run is NOT
  adopting the showcase hole, because the panel's own settings make a different
  world key; only the straight-off-the-menu path adopts. It now generates with
  progress showing rather than locking up. Original note:
  Straight off the main menu an endless run adopts the showcase hole and needs no
  generation, which is why there is no overlay -- but reached through the Endless
  panel it generated for over three seconds with the thread locked. Worth
  checking whether the adopt path is being missed there, separately from the
  chunking work.

## Making the repository public

- [x] **The email address on commits, and this machine's network details in
  the history (2 October).** At the owner's request the whole history was
  rewritten with `git filter-repo`: the home network address, the VPN address
  and adapter name replaced in every file version, and every commit's email
  replaced by the owner's GitHub no-reply address, which new commits in this
  repository now use. Every commit ID changed; GitHub got the clean history by
  force-push. DISTRIBUTION_REVIEW *What went to GitHub*.

- [x] **The second, stale git repository one directory up (30 September).**
  Handled by the owner outside this repository.

- [x] **`vendor/baked_assets/` is not committed (30 September).** The owner's
  call: kept on their machine, not in the repository. Untracked (the 91 files
  stay on disk) and ignored, with the reason in `.gitignore`; nothing was
  rewritten, so the copies already in history stay there. Nothing reads it at
  build time -- `src/asset-meshes.js`, the ingested result, is committed. Its
  ez-tree MIT notice, which has to travel with the redwood and fir geometry
  that ships, was ONLY in that folder; it is now in
  `docs/THIRD_PARTY_NOTICES.txt`.

- [x] **The SkyTrak PDF is deleted (30 September).** The owner's own session
  data; deleted at their request. `docs/sources/skytrak-36-shots.txt` -- the 36
  shots as ball data, everything that was used from it -- stays, and the
  RESEARCH.md citation points there.

- [x] **A trademark disclaimer exists now**, in the root README, in the
  portable archive's README and in ATTRIBUTION.md: marks belong to their
  owners, and no affiliation, endorsement or certification is claimed. GSPro,
  Garmin, Rapsodo and PiTrac are still named, which is ordinary -- naming a
  product to describe compatibility is nominative use. The gap was that
  nothing said so out loud.

- [x] **Every document moved under `docs/`**, indexed by `docs/README.md`.
  The root had fourteen markdown files, a dependency inventory and a folder
  called `scratchpad/`. File NAMES were deliberately left alone: 953
  references across the docs and the source comments name these files in
  prose, and renaming them would have turned a reorganisation into a
  953-line search-and-replace with no way to tell a miss from a mention.

- [x] **README.md is a front door now**, 101 lines against 296. The player
  manual it used to contain is `docs/PLAYING.md`; `CONTRIBUTING.md` is new.
  Its "Validation performed" section is gone: it asserted "all 79 gameplay,
  physics, terrain and generation checks pass" against a suite that now runs
  530, and described a revision nobody can identify.

- [x] **The file map in PROJECT_HANDOFF was wrong in both directions.** It
  still listed `src/water.js`, deleted when the planar reflector went, and it
  was missing sixteen `src/` modules and fifteen tools. It is now grouped by
  what a file is for rather than listed flat, and every module, tool and
  committed baseline is in it.

- [x] **Two generator-bump entries were mislabelled.** The rocks-as-bodies
  entry was written as 30, which the shape sliders already had, and the
  tee-box entry as 31; each is one less than the version it actually
  produced. Checked against the commits that moved the constant. AGENTS.md
  carried the stale summary of the same list -- "stops at 12 while the
  constant reads 23" -- and now says what is actually there.

- [x] **TODO.md finished its own split.** 74 ticked entries were still above
  `# Done`, interleaved with 105 open ones across ten sections, which is the
  exact state the split exists to prevent: an open checkbox cannot read as a
  claim about the code when it is the fourth item in a list of nine ticks.
  Verified entry-for-entry that nothing was lost, and that no open sub-item
  was nested under a ticked parent first.

- [x] **`bake-trees.mjs` said it wrote `vendor/eztree-redwood/`** in its
  header while the line twenty below it wrote `vendor/baked_assets/`. The
  same dead path was in PROJECT_HANDOFF and RESEARCH as a present-tense
  instruction.

- [x] **A CI workflow runs the suite, the fingerprint check, the build, and
  three journeys of the browser smoke test** on every push. It deliberately
  does not run the frame profiler: a headless runner measures a software
  rasteriser two orders of magnitude off the real number, and a green tick
  from a machine measuring the wrong thing is worse than no tick. The smoke
  test is different -- it asks whether things throw, which a software
  rasteriser answers correctly, only slowly -- so `boot`, `range` and
  `endless-round` run there. The whole suite took 24 minutes on 32 cores with
  no GPU, against about one minute on one; the rest stays a local gate.

## Getting the word out

- [x] **The website (1 October 2026).** Branch `productization`, asked for by
  the owner. Was: "a one-page site whose main feature is a Play button,
  deferred 25 September". Built in `site/`: a front page and a media page,
  laid out as the game's glass panels over clips recorded from the game,
  which change to match the section in view (a still for visitors who ask for
  less motion or less data). The front page covers the eight landscapes,
  ball physics (the GC3 figures, with SkyTrak named as the held-out check),
  greens and the three putting modes, stroke, match, scramble and endless,
  night golf, the course studio and course codes (a real code, written by the
  build), the range, and four smaller points; then connecting through rēlā
  in five steps, the four downloads with how to run them, "always free" and
  "open source soon". The media page has the 18 landscape pictures, filterable
  by time of day, the clips, and the feature screenshots. **The Demo button**
  (top right) asks first, saying that keyboard and touch are not how Fairway is
  meant to be played and to download it for a launch monitor, then opens the
  shipped game from `play/`. `npm run site` builds it all into `site-dist/`
  for Netlify (`netlify.toml`), no-index until launch. Checked in Chromium at
  1440 and 390 px wide: no errors, no sideways scroll, clips switch, the demo
  reaches the main menu in 3.3 s from a local server and its manifest is
  served. The media is retaken with `tools/site-media/`. INSTALLATION.md
  *The website*. **Second pass, 2 October, from the owner's review**: every
  picture and clip retaken at full resolution (the first set rendered at 1x;
  RESEARCH.md *The website*), landscape names only rather than course names,
  no em dashes, the stats box gone, and the hero, landscape, greens, game
  modes and practice copy rewritten in the owner's words. **Third pass, 2
  October**: the light in every picture is now the time of day it is labelled
  (the times had been clock readings, and "golden hour" was plain afternoon),
  and the background plays all eight landscapes in turn instead of one clip
  per section, which had left the desert on repeat.


- [x] **Discord: deliberately not yet**, and going open source makes that
  easier rather than harder. An empty server is worse than none -- a room
  where the owner talks to himself, signalling that nobody is there, at the
  cost of daily attention. It earns its keep at roughly 50 to 100 engaged
  people, when conversation happens without the owner in it. A public
  repository already provides the venue in the meantime: Issues for bugs,
  Discussions for everything else, both of them searchable by the next person
  with the same problem, which Discord is not. The signal to build one is
  somebody asking for it.

- [x] **MIT, open source at launch. Settled 25 September; do not reopen it.**
  The alternative considered and rejected was a proprietary licence on the
  built file -- free to play, not to redistribute -- which is what a
  closed-source product actually needs, because MIT is a grant to RECIPIENTS
  and says nothing about whether source was published. That reasoning only
  bites while the source is closed. Open the repository and the pair is
  coherent: MIT is what the audience that amplifies this expects to see, and
  it costs nothing that was ever going to be collected.

  **What is knowingly accepted**, recorded once here so it is a decision and
  not a surprise: MIT lets anyone fork the project, rebrand it, and sell it or
  take donations for it, with no obligation beyond keeping the notices. The
  judgement is that for a niche simulator the product and the person behind it
  are the moat, not the source, and that a fork of a one-person golf
  simulator is a theoretical risk against a concrete gain in reach.

  Unaffected either way: three.js, lucide and ws keep their own MIT/ISC terms
  and their notices must still ship, which they do.

- [x] **The name stays "Fairway". Settled 25 September by the owner; do not
  reopen it.** The case against was searchability: put it in a search box with
  the word "golf" and it competes with every course in the language, and word
  of mouth wants a name somebody can hear once and find. The owner has heard
  that, likes the name, and accepts the trade -- which is the whole of the
  decision, because a name nobody is fond of is a worse asset than one that is
  hard to search for.

  What this unblocks: it was filed as the item everything waited on, because a
  domain, a repository and a download link each make a rename more expensive.
  None of them is blocked now.

  Worth doing cheaply when the site exists, and NOT a reason to revisit the
  name: pair it with a word in the title and the description -- "Fairway, a
  browser golf simulator" -- so a search engine has something to hang it on.

## Found by driving the built game

- [x] **Bunkers buried under a neighbour's rough (2 October, generator 34).**
  Spotted by the owner behind a green on the website's desert clip: a white
  sliver with a staircase edge, the rest of the bunker grassed over. A bunker
  reaching onto ground another hole owns was dug out but painted and played as
  that hole's rough; about one bunker in twenty (35 of 682 on the full bench).
  Such bunkers are now dropped, as ponds already were. New bench invariant
  `bunkers`, new test `tests/bunker-ground.test.mjs`. RESEARCH.md *Bunkers on
  another hole's ground*.

- [x] **Course studio opened at midnight for a new player (1 October).**
  Found while capturing the website's screenshots: a profile whose clock had
  never been set opened the studio at 12:00 AM, because an unset hour reads as
  0:00 -- anyone trying the demo who went to the studio before their first
  round. Rounds already started at midday; opening the studio now does the
  same, with the floodlights off. Checked on a fresh profile: 12:00 PM.


- [x] **An 18 px dark strip along the bottom of the play screen (1 October).**
  Branch `play-area-fill`, found while measuring for Text size. The play area
  set its own height as the screen minus a guessed bar height (78, 65, 56 or
  42 px by size); a later rule made the bar 60 px and the guesses went stale --
  18 px short at six of the nine sizes the smoke test checks, 5 px on an
  upright iPad. The app is now a column and the play area takes whatever the
  bar leaves: no gap at any of the nine sizes, phones unchanged.

- [x] **Putting has shown no distance on screen since 19 September, and threw
  sixty exceptions a second while doing it.** `GolfView.projectMarker` named
  the edges of its rectangle `L`, `R`, `T` and `B` -- and `T` is three.js in
  `renderer.js`. The local `const T` shadowed the library for the whole
  function, so the `new T.Vector3` at its top reached an uninitialised variable
  on every call. It is called every frame the ball is on a green.

  Measured before and after on the built file, ball dropped two yards from the
  cup: **393 exceptions in six seconds** before, zero after. Before, the marker
  sat frozen at one screen position whether facing the cup or turned away, and
  never set its pointing angle; after, it sits over the cup reading "6.0 FEET
  TO HOLE", follows the camera, and points. Silent throughout because the frame
  loop schedules the next frame before doing anything else, so the game kept
  running and skipped the rest of each frame -- which also meant the aim label,
  meant to hide on the green, never did. PLAYING.md described the feature
  correctly the whole time; it simply was not true.

  The fix is four names: `left`, `right`, `top`, `bottom`.
  `tests/three-namespace.test.mjs` (seven tests) scans all seventeen modules
  that import three as `T` for any other binding of that name, proves the scan
  goes red on the original line and stays quiet on look-alikes, and calls
  `projectMarker` directly -- in view, behind the camera, and with uneven
  insets. Red on the old code, green on the new.

  Found by `tools/smoke.mjs`, the browser smoke test, the first time it dropped
  a ball on a green. Nothing else could have found it: `node --check` parses
  it, the bundler emits it, and no unit test had ever called the function.

- [x] **A browser smoke test, `npm run smoke` / `tools/smoke.mjs`.** Opens the
  built file by `file://` in Chromium -- the way a player opens it -- and plays
  seven journeys: boot; every main-menu panel and every tab in each, plus the
  tester diagnostic; an Endless hole from tee to holed putt to the next hole,
  including clubs, aim, power and cameras from the keyboard and a sim drop;
  Play → Surprise me & play through a nine-hole course with replay, mulligan,
  the scorecard and the in-round menu; the range; the studio growing and
  saving a course; and `hud-reachable`. A journey fails on any uncaught error,
  any `console.error`, and any network request -- which makes the published
  zero-requests claim a check rather than an assertion. Six of seven pass;
  `hud-reachable` fails on a real layout bug, recorded above.

  **It presses buttons by the name a player reads**, so a relabelled button
  fails it -- deliberately, since the label is the contract with the player.
  **It uses `window.lab` only to look** -- whether a ball is in flight -- and
  never to drive, because driving through the lab tests the lab.

  Stable across four consecutive runs on four different random courses. Every
  failure prints the course and seed, because Endless and Surprise me grow a
  different course each time and a failure nobody can find again is worth
  little.

  **Measured before it was designed**: with no GPU a nine-hole course took 99 s
  to build on one run and 213 s on the next, against 4.5 s on a GPU, and
  halving the window halved the frame cost without shortening the build -- so
  the cost is not pixels. That is why the round loop runs on Endless, whose
  first hole is the menu backdrop the game has already grown.

  **Nine of its first failures were the harness, and three were the game.**
  The harness ones are worth knowing because each looks exactly like a game
  bug: the drawer checked for an `open` class it has never used; arrow keys
  pressed down and up before a frame could see them; the Tools button
  pressed twice when it is a toggle; saved courses read from storage in the
  wrong shape; Help's window expected under the menu label rather than its
  own title; floating tool windows expected in the drawer; the tray put away
  in the middle of a drop; two inputs sharing a label; a 1600x900 capture
  window that the layout bug itself blocked. The game ones: the green-marker
  crash (fixed), the HUD overlap, and Escape's order (both above).

  `npm ci` does not fetch Playwright's browser -- 1.63 has no install script
  -- so the harness says `npx playwright install chromium` rather than
  printing a stack trace. That also made a comment in the CI workflow wrong;
  see the CI entry.

- [x] **Escape now closes the panel in front of you before any tool window.**
  With Tools open, opening the scorecard puts its blur over the Tools window,
  and Escape used to shut the hidden Tools window first, leaving the visible
  scorecard for a second press. Two fixes were weighed: close the tool windows
  whenever a panel opens, or have Escape close whatever is in front. The
  second won -- it keeps the player's Tools window where they put it for when
  the card is gone, and it is one condition. An open panel is always in front,
  because opening a tool closes the panel and never the reverse. The smoke
  test presses Escape once with Tools open behind the scorecard; red on the
  old build, green now.

- [x] **A quick arrow tap now always registers.** Aim and power move while a
  key is held, read once per frame, so a tap whose key-down and key-up fell
  between two frames used to do nothing -- never at 60 fps, where a human tap
  spans several frames, but a real risk at 20. Every key-down now also lands in
  a `tapped` set that the frame loop treats as held for one frame, cleared once
  per rendered frame. Deliberately NOT changed: how far a held key turns, or
  replacing held movement with fixed-size steps. That is feel, and it waits for
  the keyboard feedback. The smoke test taps left and down with no frame
  between; the left tap read "0.2°" and never changed on the old build.

- [x] **The release packager ships only what git tracks.** It globbed each
  source directory, so three untracked scratch scripts went into a source
  archive: 166 files where there should have been 163. It now takes `git
  ls-files`, proven by planting a stray file in `tools/` and checking the
  archive left it out. Refusing a dirty tree was considered and rejected --
  cutting archives before committing is how this project works, and the
  tracked files' working content is what matches the build beside them. A
  checkout with no repository falls back to the glob and says so.

- [x] **The HUD fits every screen from a desktop to a phone.** Measured first,
  across eight sizes, before designing anything:

  | screen | before | after |
  |---|---|---|
  | 1920x1080 | 2 controls unreachable | 0 |
  | 1536x864 / 1440x900 | 6 | 0 |
  | 1366x768 | 8 -- every camera button under the map | 0 |
  | 1280x720 | 9 | 0 |
  | iPad sideways 1180x820 | 8 | 0 |
  | iPad upright 820x1180 | 0 | 0 |
  | phone sideways 844x390 | 23, the page scrolled, shot button cut off | 0, no scroll |
  | phone upright 390x844 | course 7% visible, page 177 px too wide | course 51% visible |

  **The cause was one idea**: every layout rule answered to WIDTH and positions
  were pixel constants tuned on 1920x1080, while every failure was about
  HEIGHT. `layout.js` now measures where the bottom bar, the weather, the card
  and the camera bar actually are and writes them as CSS variables; one new
  section at the end of `style.css` positions the panels from those. The owner
  chose between two prototypes photographed at every laptop size: **the camera
  bar beside the map** (chosen) against a row under the weather (it stuck out
  past the weather panel and read as bolted on). Also rejected: cameras in the
  top bar (full already at 1280, and app chrome not game controls), and
  height breakpoints alone (still guessed constants; break when the controls
  wrap).

  **Phones** get their own layout below 560 px wide or 500 px tall: the card as
  a strip whose player row and shot numbers hide behind a "Shot details"
  toggle by default (the owner's call), cameras in a row with the wind, the
  map a thumbnail, controls for a thumb. `#world` lost its 620-640 px minimum
  height, which was making every phone scroll, and the top bar drops its words
  on a phone -- in a round it had been 177 px wider than the screen.

  **Three bugs found on the way, all fixed**: the main menu could not scroll
  and stranded Camera & bay, Graphics and Help below a phone's screen -- the
  page scrolling had been the only way to reach them, so fixing that alone
  would have made it worse; starting a sim drop left the Tools window over
  "Place ball" on a phone held sideways; and a toast swallowed the clicks meant
  for "Copy course code" underneath it for four seconds.

  Checked by `hud-reachable` at nine sizes, menu and play screen, phone details
  folded and open, and by `phone-portrait` and `phone-landscape`, which play a
  hole by touch alone. A first draft guessed the camera row's height at 44 px
  on a phone held sideways; it is about 60 and the map sat 11 px over it, which
  is why that is measured too.


- [x] **The smoke test raced the scorecard's own timer.** The scorecard advances
  to the next hole by itself after eight seconds; the harness assumed it would
  wait to be clicked. On a GPU the click lands in under a second, so it never
  showed. With no GPU a frame takes about a second, Playwright's check that a
  button is stable across two frames outlasted the eight, and the harness spent
  six minutes waiting to click a button the game had correctly removed -- the
  failure screenshot showed hole 2, three under. Both ways to the next hole are
  now accepted, the log says which one happened, and it fails only if the hole
  never changes. Looked like "Next hole is broken on slow machines"; was not.

## On a phone's home screen

- [x] **A bridge with nothing to install (1 October).** Branch
  `productization`, asked for by the owner. `run_fairway_server`, compiled
  with Bun for Windows, macOS (Apple Silicon and Intel) and Linux, is the
  program in each platform's download; the Node start scripts are gone. It
  serves the game and its web manifest (phones can add it to the home screen),
  listens on the home network by default and prints where to point a browser,
  a phone and the connector. The `server-program` smoke journey plays a real
  connector shot through it on Windows. RESEARCH.md *run_fairway_server*.

- [x] **Owner: the portable archive's Launch monitor folder on a Mac.**
  Superseded on 1 October: there is no Launch monitor folder or start script
  any more; see *run_fairway_server on a real Mac* above.

- [x] **A hosted copy installs to a phone's home screen and opens like an
  app.** Asked for on 26 September after the owner hosted the build on Netlify
  and found getting it onto an iPhone was the hard part. Options weighed: a
  native iPhone app through Capacitor needs a Mac with Xcode and either a $99
  developer account or reinstalling every seven days, and this project is
  built on Windows; the full offline web app was more than was needed to get
  playing. This is the middle: the iPhone tags, a 180 px icon, and a manifest,
  so Add to Home Screen opens it full screen without Safari's bars. The icons
  are the existing brandmark flag with the wordmark's green dot where a ball
  would sit, optically centred; the manifest is `display: standalone`, so the
  phone's clock stays and nothing slides under the notch before the HUD keeps
  clear of it.

  **The portable file never knew.** A manifest link is fetched as the page
  loads, and from disk that fetch fails with an error -- so it is linked from
  script only over http or https. The disk-opened journeys, which fail on any
  request, prove it; `home-screen`, the one journey that serves the game, asks
  Chrome's own parser and install check. Verdict: parses clean, installable --
  so Android and desktop Chrome can install it too.

  Also: the tab icon is inline, so a host without a `favicon.ico` never logs a
  404; and the fullscreen button hides where fullscreen cannot happen, which is
  every iPhone, where it had silently done nothing.

- [x] **The home-screen icon survives a password-protected host.** The owner
  keeps the Netlify site private so it cannot be scraped, and adding it to the
  home screen gave a screenshot icon, with 401s in Netlify's log. Netlify
  answers every request without the visitor's login with a 401, and a phone
  fetches a linked icon ON ITS OWN, without Safari's login; the manifest is
  fetched without credentials too, unless its link asks. Reproduced before
  fixing, with a local server that behaves the same way: logged in, the page
  loaded, and both the manifest and the icon came back 401. Now the
  home-screen icon is a data URL inside the page, the manifest's icons are
  data URLs inside the manifest, and the manifest link carries
  `crossorigin="use-credentials"` -- the fix that worked in Netlify's own
  support thread on this. Same probe after: nothing refused. Chrome still
  rates it installable. `make-icons.mjs` now writes the manifest and the
  page's icon itself, so neither can drift from the PNGs.

  Alternatives weighed: turning the password off (the owner's call, and
  declined -- it is there to stop scraping); a data-URL manifest (Chrome
  rejects its start_url as cross-origin); and hosting the icon publicly
  elsewhere, kept as the fallback if iOS turned out not to read a data-URL
  icon, which no documentation settled. **It does read one** -- confirmed on
  the owner's iPhone the same day, so the fallback was never used.

  Two iPhone facts now in INSTALLATION: the home-screen app asks for the
  password once, because it keeps its own login separate from Safari's; and
  it keeps its own saved rounds.

- [x] **The home-screen icon works on a real iPhone, on the private site.**
  Confirmed by the owner on 26 September: the flag icon shows on the home
  screen. That settles the one piece nothing on the development machine could
  test and no documentation found settled -- **iOS honours a home-screen icon
  written INTO the page as a data URL**. The fallback of hosting the icon
  publicly elsewhere is not needed.

## Playing on a phone

- [x] **Owner: aiming and the redrawn play screen on a real iPhone (30
  September).** Checked by the owner on their own iPhone: the pad, the big map,
  two-finger zoom and the play screen both ways up. "Done and looks good." The
  launch-monitor checks with a real device stay open: they need the monitor.

- [x] **Aiming by touch, a map that opens big and pinches, and a thumb's worth
  of every control.** Asked for on 26 September: aiming and the map were
  "REALLY hard" on a phone because everything was small. Options offered for
  aiming were arrows, swipes, a zoom-to-aim view, or a mix; the owner chose
  arrows plus the zoom view.

  **The aim pad**: turn half a degree a tap, move the target a yard further or
  shorter (a putt's length, on the green), the pin in the middle; hold to
  sweep. On phones and touch screens under 820 px; a round pad upright, a row
  sideways. The laptop's own aim arrows now step half a degree (they were one)
  and sweep when held. **Swipe-to-turn was rejected**: a drag on the course
  already moves the camera in free flight, the same gesture meaning two things
  by mode is a trap, and a swipe that turns the aim is one stray thumb away
  from spoiling a shot already lined up.

  **The big map**: the one map canvas laid over the course. A tap on the
  thumbnail opens it on a touch screen; a button on the map's corner opens it
  anywhere. It aims, drops or flies wherever the small map would; two fingers
  zoom it; Done or Escape closes it, and it gives way to a shot, a panel, the
  flyover or the menu by itself. Held sideways the title and Done share a row
  so the hole gets the height.

  **Pinch zoom** on the map at any size, which had not worked at all: the
  second finger was ignored.

  **No stray browser gestures**: a double tap no longer zooms the page, a pull
  down no longer reloads it and throws the round away, and holding an arrow no
  longer selects text. **Every control a round needs is 44 px to a finger** --
  Apple's recommended size -- through invisible margins where there is no room
  to grow; the pad, the club picker and the power slider are that size
  outright.

  **The Add to Home Screen hint**, closing the open item from *On a phone's
  home screen*: once, on the menu, on an iPhone or iPad in a browser; never
  from disk and never inside the installed app.

  Checked by new steps in both phone journeys and a new `home-screen-hint`
  journey; 14 of 14 journeys green, 553 of 553 tests, no ground moved. Not
  checked: a real iPhone, which is the open owner item above.

- [x] **The play screen redrawn: the hole in the top bar, the shot panel on
  the left, and a launch-monitor mode of its own.** Approved from mockups on
  26 September, for every screen size. The course card is gone from play: hole,
  par, yardage and pin sit in the top bar, with a score chip per golfer --
  colour, score against par tinted as the old live score was, the shot they
  are on or *In* -- that opens the scorecard. The shot controls left the bottom
  edge for a panel down the left, only as tall as its contents, with the shot
  button inside it and the last shot at its foot (folded to carry and total;
  always open on a big screen). Right: wind, the camera strip down the edge,
  the map at the foot. On a phone: the chip of whoever is up with a count of
  the others, Tools in the top bar, the cameras behind one button, the pad
  under the map, the last shot folded above the club. **The controls keep
  clear of the notch and home bar** (`viewport-fit=cover` and the safe-area
  insets), which closes that item from *On a phone's home screen*.

  **Monitor mode**, the owner's main mode: the panel leads with Ready / Finding
  ball / No monitor and an Armed switch; power, shape, the shot button and the
  tee go; **the aim stays** (it used to go -- the owner's call); the numbers are
  always open, grouped Ball / Club / Result, the Club group left out when a
  device sends none; the big numbers come up after each shot and stay until
  the next ball is seen; red offers Reconnect and Hit by hand.

  Measured: the course visible, folded, on 63-75% of laptops, tablets and
  desktops (39-65% before), 60% of a phone held sideways (36%), 65% upright
  (45%). Every journey green, a new `monitor` journey among them.

  Found and fixed on the way: the shot caption printed the bridge's status
  object ("Alex · Driver · [object Object]") under every monitor shot; new
  tool windows opened 128 px down on any screen and ran off a phone held
  sideways; and the playing area could be scrolled by the browser, which
  slid the whole HUD under the top bar. Saved panel layouts reset once
  (`fairway-layout-v2`), since a position saved for the old bottom bar would
  park the panel across the course.

  **Rejected:** keeping the course card and moving only the shot controls (the
  card was the other half of what covered a phone); a fixed-time after-shot
  card (runs out while you are still looking); a Club group of dashes for
  devices without club data.

## A ball in the air

- [x] **The screen clears while a ball is in the air, at every size.** The
  owner's ask, 26 September, first as phones only and then for every screen:
  nothing on screen can be used while a ball flies, so the shot controls, the
  cameras and the aim pad step aside and come back when it settles; replays
  too. The top bar, the wind and the map stay, and the map now follows the
  ball, drawing its line. The live readout (ticking speed, spin, distance,
  height) is gone everywhere; a slim flight bar along the bottom carries the
  numbers fixed at the strike -- club, ball speed, launch, spin -- and Skip,
  which moved from near the top to the bottom centre, under the thumb. Bigger
  than a phone, the shot panel folds to its numbers rather than going, so the
  last shot stays readable. Checked in the Endless journey on a laptop and in
  both phone journeys, mid-flight: the controls gone, the map and wind still
  there, the bar reading mph, no live readout, and Skip reachable.

## A launch monitor on an iPhone

- [x] **A phone reaches the launch monitor, and knows where the bridge is.**
  Researched 27 September (RESEARCH.md): a hosted `https` copy cannot reach
  the bridge from an iPhone, so a phone plays with a monitor from the page the
  bridge serves over the home network. The owner set aside the ways to make a
  hosted copy connect (Tailscale, an installed certificate, a tunnel) as too
  much setup. Then found the phone had no way into the monitor settings at
  all: the redraw hid "Connect monitor" from the phone's top bar for room.
  Now **Launch monitor** is in the main menu and in Tools at every size; the
  address box defaults to the address the page came from when it is plain
  `http` (and to `ws://127.0.0.1:1922` otherwise, which was the default
  everywhere -- on a phone, the phone); the last address that connected is
  remembered; and a page loaded over `https` says why it cannot connect and
  what to open instead. Also fixed: the phone's camera button floated over the
  main menu. New `monitor-phone` journey; 16 of 16 green.

- [x] **The bridge ships in the portable archive, ready to run.** Asked 27
  September: how would other players launch the bridge? They could not -- it
  shipped only in the source archive, and running it took `npm ci` and a
  build; the portable README claimed an "included bridge" anyway. Now `npm run
  build` bundles it into one file (`dist/fairway-bridge.mjs`, ~130 kB, needs
  only Node.js), the portable archive carries it in a **Launch monitor**
  folder with a **Start bridge** for Windows and for macOS, and the bridge
  serves the `Fairway.html` beside it. The script listens on every address and
  prints two links, this computer's and a phone's, finding the computer's
  home-network address itself -- skipping a VPN adapter that, on the machine
  this was written on, came first. There were two scripts per platform, one
  for a phone, until the owner asked why: the phone one did not even serve the
  computer's own browser, and the firewall prompt is gate enough. Checked by a new
  `bridge-bundle` journey running the built bundle as its own process with a
  pretend connector sending a real shot, and a unit test for the address
  choice; the Windows script run by hand. Not yet run: the macOS scripts.
