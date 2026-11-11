# Distribution and provenance review

Reviewed September 11, 2026. **Dependency delta re-checked and archives rebuilt 25 September 2026 — see the addendum at the foot.** Applies to the source and rebuilt archives accompanying this file. This is an engineering provenance/license review, not a legal opinion, exhaustive plagiarism search, trademark clearance, or security certification.

## Outcome

The review found attribution omissions and corrected them. It found no evidence of an unlicensed copied application or proprietary asset pack in the inspected project. Known incorporated code has licenses permitting redistribution, including distribution supported by optional donations, subject to retaining its notices. The owner selected **MIT** for Fairway's own code and documentation. `LICENSE` records that choice using the collective credit “Fairway contributors”; third-party material retains its original terms.

Both ZIPs include the project license, third-party notices, installation instructions and this review. The single-file HTML embeds the full project license and third-party notices in **Help → Open source & credits**, so copying just the HTML retains them. The source download is the preferred editable form. Donations are optional support for development; no payment service, donation account, checkout or public release has been configured.

This is suitable packaging for an experimental public preview, with the outstanding validation items below disclosed. It is not a claim of a production-certified simulator.

## What was checked

- Project source/imports, optional bridge, asset inventory, research documents, package manifest and all 50 package entries in the lockfile, including platform-specific optional packages.
- Third-party 3D geometry: **none since 27 October 2026** -- every model is built by this project's own Blender scripts and the packs were removed (*Addendum, 27 October 2026*, at the foot). Until then: Fairway shipped mesh data derived from six **CC0 1.0** model packs (Kenney Nature Kit, Kenney City Kit Suburban, Kenney Building Kit, Quaternius Ultimate Nature Pack, Quaternius Ultimate Stylized Nature, Quaternius Stylized Nature MegaKit). Each licence was verified from the licence file inside the distributed pack, not from a web page. CC0 requires no attribution; **ATTRIBUTION.md** credits them anyway and records exactly what is and is not shipped. Only geometry ships — all source materials and colours are discarded at ingestion and replaced by biome-palette roles — and only 96 of 729 available models are used. The full packs sit in `vendor/` as provenance and are excluded from both the build and the release archives.
- Copyright/license/source-reference patterns and recognizable reused algorithms; installed dependency license files and selected upstream primary sources.
- `src/water.js` has been removed. It was a lightly modified copy of Three.js's `Water`, used for the single planar reflector; with the reflector gone there is no vendored Three.js source in the tree, and water is drawn by an ordinary `MeshStandardMaterial` the renderer patches.
- The course random-number routine against the published Mulberry32 implementation. Its integer mixing sequence matches the JavaScript variant published by bryc. The missing credit is now in source and the notices; the generation algorithm was left unchanged to preserve seeds.
- The physics implementation and its cited research. A targeted comparison with OpenFairway's published aerodynamics module found shared physical constants/barometric mathematics, not a copy of its C# module or calibrated flight model. This is not a complete similarity comparison against every upstream revision.
- Procedural texture/vegetation/terrain creation and bundled files: no imported course photographs, satellite tiles, real-course elevation datasets, purchased models, audio tracks or external font assets were found. Referenced research imagery is linked in documentation, not packaged as game assets.
- The browser build for embedded license text. Rebuilt archives are checked for expected contents and CRC integrity, with SHA-256 checksums supplied separately.

There is no complete authorship history or universal source-code comparison database for this project. AI-assisted code can resemble public code; this review cannot prove that every line is unique or determine copyright ownership of every generated portion. Future imports need their own provenance review.

## Incorporated code and obligations

| Component | Location / delivery | Terms and action |
| --- | --- | --- |
| Fairway code and documentation | Source and portable application | MIT, as selected by the owner; retain `LICENSE` |
| Three.js 0.186.0 and imported addons | Browser bundle only | MIT; full notice retained. No Three.js source is vendored or modified any more |
| Lucide 1.44.0 | Browser icons | ISC, plus MIT for Feather-derived icons; both original notices and Feather icon list retained |
| ws 8.21.3 | Optional Node bridge dependency | MIT; installed by `npm ci`, notice also shipped with source |
| Mulberry32 | `src/course.js` | Tommy Ettinger's CC0 algorithm; bryc's JavaScript variant offers a public-domain dedication and MIT fallback. MIT fallback and credits retained |
| Mapbox Earcut 3.0.2 | Embedded by Three.js polygon triangulation | ISC; Mapbox notice added, independent of Three's MIT notice |
| Vite 8.3.3 / Rolldown 1.2.15 helpers | Small generated helpers in browser output | MIT; core helper notices added |
| ez-tree 1.1.0 | **Removed 27 October 2026**; until then a build tool whose output geometry shipped | MIT. Ran at bake time in `tools/bake-trees.mjs` (removed with it), never in the game; nothing it made ships since the cartoon overhaul. The trees it generates from our parameters go into `vendor/` and through the same ingest as the CC0 packs; credited in ATTRIBUTION.md with its notice vendored beside the output |
| Playwright 1.63.0 (and playwright-core) | Build/measurement tool only | Apache-2.0. Drives a headless browser for `tools/profile.mjs` and `tools/gpu-probe.mjs`. Touches nothing that ships and is in neither archive |
| Minimal AgX contrast approximation | Three.js shader chunk | Benjamin Wrensch / Missing Deadlines, MIT; notice added |
| Filament AgX implementation attribution | Three.js shader chunk credits Filament | Apache-2.0 text and Android Open Source Project credit retained conservatively; this upstream Three adaptation is unchanged by Fairway |

`THIRD_PARTY_NOTICES.txt` contains the applicable license texts, not just their names. `DEPENDENCY_INVENTORY.json` records package versions, declared licenses, integrity hashes, URLs and build/runtime scope. Lockfile metadata alone does not enumerate embedded components such as Earcut and Feather; the table above covers the identified additions.

Build dependencies are installed separately, not shipped as `node_modules` in either ZIP. The lockfile includes MIT, ISC, BSD-3-Clause, Apache-2.0 and **MPL-2.0** packages; Lightning CSS is MPL-2.0 and is a build tool, not the game's runtime. Generating/minifying CSS does not itself copy Lightning CSS's source implementation into the game. Its tooling license must be reviewed again if future downloads bundle build-tool binaries or modified tool source. The same applies to transitive licenses inside Vite/Rolldown's own distributions. Do not describe every installed dependency as MIT.

## Research, interoperability and originality

`RESEARCH.md` and `LANDSCAPE_RESEARCH.md` distinguish mathematical/design references from software dependencies. Research-informed physics is an approximation. One measured agreement is claimed -- the fit to a 100-shot GC3 session, with a SkyTrak session held out -- and RESEARCH.md states its figures and its limits; nothing beyond it is (corrected 1 October 2026, when the website began quoting it). The U.S. Copyright Office distinguishes copyrightable program expression from functional algorithms and logic; citing a paper does not by itself grant permission to copy its code, figures or text. See [Copyright Office Circular 61](https://www.copyright.gov/circs/circ61.pdf).

- [OpenFairway](https://github.com/digitalhand/openfairway) is credited as an MIT research reference. Its project and current calibration data are not included as dependencies or assets.
- [libgolf](https://github.com/gdifiore/libgolf) is GPL-3.0 and is referenced as an alternative, not linked, compiled or packaged here. No libgolf implementation was identified in the inspected files. GPL permits commercial activity, but incorporating its code could change redistribution obligations; a citation does not relicense it as MIT.
- The bridge implements the documented [Open Connect v1 interface](https://gsprogolf.com/GSProConnectV1.html). It does not contain GSPro software, vendor drivers, firmware or the linked community connectors. Protocol support is not hardware certification or vendor endorsement.
- Courses are fictional procedural landscapes. References to real courses informed design goals rather than supplying traced maps or downloaded scenery. Keep that distinction for future content.

Primary license references: [MIT](https://opensource.org/license/mit), [ISC](https://opensource.org/license/isc), [Three r186](https://github.com/mrdoob/three.js/blob/r186/LICENSE), [bryc's license](https://github.com/bryc/code/blob/master/LICENSE.md), [Mulberry32 original](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c), [Earcut 3.0.2](https://github.com/mapbox/earcut/blob/v3.0.2/LICENSE), [Minimal AgX](https://iolite-engine.com/blog_posts/minimal_agx_implementation), [Filament](https://github.com/google/filament/blob/main/LICENSE). Permission to accept optional support follows from these licenses' redistribution/commercial permissions; this review does not evaluate payment-provider rules or tax treatment.

## Verification for this update

The production build and JavaScript syntax checks passed. The built HTML contains no external script or stylesheet file references. Browser inspection confirmed both expandable license sections and the Mulberry32, Earcut, Apache and AgX credits in Help. The packager verified all archived bytes and CRCs; a separate check verified ZIP license entries, portable HTML equality and SHA-256 checksums. Gameplay/physics algorithms were unchanged, so the prior gameplay test results were not rerun or represented as a new test pass.

## Remaining release checks

1. **Dependency advisory check is unverified.** `npm audit` could not validate the registry TLS certificate in this environment, including a retry using system trust. A system HTTPS client failed the same check. Certificate verification was not disabled. Run `npm audit --registry=https://registry.npmjs.org` on a machine with working trusted registry access and review findings before a broad release. No zero-vulnerability claim is made.
2. **Actual device tests remain.** Installation documentation identifies intended platforms and untested combinations. Test the actual portable HTML on target desktop browsers, including save/export/import. Phones/tablets, controllers and physical launch monitors are not certified. The production app has been exercised through a local server; direct file-URL behavior still needs manual checks.
3. **Brand and publisher identity.** “Fairway” is a working product name; this review did not search trademark registries or establish name availability. Use your chosen publisher identity/support channel when posting a release. The collective copyright credit is not an assertion that a registered company exists.
4. **Donation setup.** When ready, configure a publisher-owned support page and link to it. Do not imply donations are required to play, unlock existing features, buy promised hardware compatibility, or support the third-party authors unless that is actually arranged. No financial account setup was performed here.

## Repeatable packaging

Run the normal tests appropriate to changes, then `npm run release`, which builds and packages in one step and refuses to package a stale build. Python 3 is needed only for ZIP packaging, not playing or building the browser app. The packager uses an explicit file allowlist, refuses stale source builds or missing embedded notices, verifies every archived file against its source, and writes `RELEASE_SHA256.txt`. It excludes local saves, screenshots, credentials, `.git`, caches and `node_modules`. See the script when adding a new source/document directory.

For each release, update this dated review and the dependency inventory when dependencies change, preserve all license texts and origin comments, and repeat the advisory/device checks. Keep independent records of newly acquired code/assets and their exact licenses. Do not treat this review as clearance for later changes.

---

## Addendum, 28 September 2026: background workers inside the single file

Generation now computes the ground grid's heights in Web Workers (B2 in
TODO). The worker is a classic script embedded in the page as a blob
(`?worker&inline`), because a page opened by `file://` may start a classic
blob worker in Chromium and may not start a module one -- checked with a
scratch page, and by `npm run smoke`, which opens the built file by `file://`
and passed with the workers running. It adds ~89 KB to the single file
(15.89 -> 15.98 MB). Nothing is fetched: the worker's code is in the page.
Firefox and Safari were not tested; a browser that refuses the worker gets
the grid built on the main thread, the same course, only slower.

## Addendum, 25 September 2026: archives rebuilt

**This is a dependency delta and a repackaging, not a fresh full review.** The
September 11 review above stands for everything it covered; what follows is
only what changed.

**The archives were 124 commits out of date and had to be rebuilt.** The
`Fairway.html` inside the shipped portable ZIP was **1.2 MB**; the current build
is **15.1 MB**. The difference is the mesh-asset ingest, which landed after the
review — so anyone given the old archive was playing a materially different
game from the one in the repository. The portable ZIP is now 6.9 MB and the
source ZIP 7.1 MB, both verified file-by-file against their inputs by
`tools/package_release.py`, with fresh SHA-256 sums in `RELEASE_SHA256.txt`.

**Three dependencies were added since the review, all build-scope**, and
`DEPENDENCY_INVENTORY.json` now records them (53 packages, was 50):

| package | version | licence | why it is here |
|---|---|---|---|
| `@dgreenheck/ez-tree` | 1.1.0 | MIT | bakes the redwood and fir geometry; **its output ships**, the library does not |
| `playwright` | 1.63.0 | Apache-2.0 | headless browser for the frame profiler and GPU probe |
| `playwright-core` | 1.63.0 | Apache-2.0 | dependency of the above |

The packager's own gate caught the drift — it refuses to build an archive while
the inventory disagrees with the lockfile — which is exactly what it is for.

**ATTRIBUTION.md was missing from both archives and now ships.** This review
document ships in both ZIPs and cites ATTRIBUTION.md by name for the CC0
model-pack credits and the baked-tree provenance, so an archive without it cited
a document it did not contain. `BALL_BEHAVIOUR_KNOBS.md` and `REFERENCES.md`
were added at the same time. Working documents are deliberately still excluded:
an engineering log and a speculative product study are not part of what somebody
was handed to play.

**One packaging bug fixed.** `tools/package_release.py` read the built HTML with
the platform default encoding, which is cp1252 on Windows. That worked while the
build was small and ASCII; it died on byte 0x9d of the 15 MB file. Every read
and write in the tool now names UTF-8.

### Commercial-use pass, 25 September 2026

Asked for specifically: is everything still clear for selling this eventually.
**This is an engineering provenance pass, not a legal opinion and not trademark
clearance.** Findings, not advice.

#### Licences: nothing here blocks commercial use

All 53 packages, by declared licence: **35 MIT, 12 MPL-2.0, 3 Apache-2.0,
2 ISC, 1 BSD-3-Clause.** Every one permits commercial use. Obligations are
notice-retention only, and the notices ship.

Only three packages are runtime scope — the only ones that can reach a shipped
artifact: **three 0.186.0 (MIT), lucide 1.44.0 (ISC), ws 8.21.3 (MIT)**.

**All twelve MPL-2.0 packages are Lightning CSS**, build scope, one per
platform. MPL-2.0 is file-level copyleft: it reaches modifications of its own
files, not the output of running it, and we neither modify nor redistribute its
source. This stays true only while no build ships its binaries or a modified
copy — the September review says the same and it is worth re-checking whenever
the toolchain moves.

**`npm audit` now runs**, which it could not in September — remaining release
check 1 above. Result on this date: **0 vulnerabilities** across 53 packages
(prod 4, dev 50, optional 27).

#### What actually ships, byte by byte

(Superseded: since the cartoon overhaul no house atlas ships and since 27
October 2026 no pack is in the repository -- *Addendum, 27 October 2026*.)
The imported-material footprint of the shipped HTML was **four PNGs, 12 KB each,
64 KB in total**: Kenney house colour atlases (`colormap` plus three
variations), CC0. Kenney's licence text states the content is free to use in
personal, educational **and commercial** projects, with credit appreciated and
not required. Quaternius ships the CC0 1.0 dedication. (Since the
cartoon overhaul the page also carries one image that is not
imported: the turf detail atlas, a 906 KB PNG painted by this repository's
own `tools/turf-detail.mjs` -- nothing to license.) (From 17 October 2026
the page also carries two font files, about 35 KB, under the SIL Open Font
License: see *No fonts ship* below, now *One font ships*.)

Everything else imported is **geometry with its materials stripped at ingest**
and repainted from the biome palette. Verified this pass rather than assumed:

- **No texturecan textures ship**, and none are present in the tree. ATTRIBUTION
  flags them as the one asset whose terms were never checked; they are ez-tree's
  bark maps, and no bark image is taken because trunks are painted.
- **No ez-tree leaf sprite ships.** `broadleaf` appeared 14 times in the build
  as a species *family* name, not as the sprite file. (Since the
  cartoon overhaul that family is gone: its trees are built in
  Blender from this repository's scripts.)
- **One font ships, from the `ui-1-0` branch (17 October 2026) on.** Until
  then none did: `--font-display` and `--font-ui` are system stacks and there
  was no `@font-face`. The 1.0 interface embeds **Saira Condensed** (SIL Open
  Font License 1.1), two woff2 files -- Bold and ExtraBold, Latin only, about
  35 KB -- inlined into the page as `data:` URLs, so nothing is fetched. The
  licence travels in `src/fonts/OFL.txt` and THIRD_PARTY_NOTICES.txt
  (addendum of 17 October 2026, below). The old interface still uses the
  system stacks.
- **No audio files ship.** The game has sound from 13 October 2026, but every
  sound is synthesised in the browser by its own code (`src/sound.js`,
  `src/audio.js`): no recording, no asset, nothing to license. About 52 KB of
  the built page once minified. It makes no network request.
- **Zero runtime network requests**: no remote `<link>`, `<script>`, `fetch`,
  `Image()` or CSS `@import` in the built file. The http URLs inside it are text
  in the credits panel.

#### The finding worth acting on: course names that are real golf destinations

Nothing above is a problem. **This might be.**

Place names are generally weak as marks, but *a name that identifies a real golf
resort, used to name a course in a golf product you sell,* is the combination
that attracts attention. Present in two places:

| where | name | what it also is |
|---|---|---|
| `biomes.js` default title | **Bandon** Ridge | Bandon Dunes Resort, Oregon |
| `biomes.js` default title | **Turtle Bay** | Turtle Bay Resort, Hawaii |
| `course-names.js`, pnw | **Bandon** | as above |
| `course-names.js`, links | **Dornoch** | Royal Dornoch Golf Club |
| `course-names.js`, links | **Kintyre** | the Kintyre course, Turnberry |
| `course-names.js`, desert | **Saguaro** | The Saguaro at We-Ko-Pa |

The rest are ordinary geography (Tofino, Rainier, Chamonix, Sonora) or invented.
Note the generator **cannot** produce "Bandon Dunes": `Dunes` is a desert word
and `Bandon` a Pacific-Northwest one, and the lists do not cross. That is luck
rather than design.

**Removed on the same day.** All six are gone, the three biome titles are now Sitka Bluff, Vermilion Basin and Leeward Cay, and `tests/course-names.test.mjs` carries a denylist so they cannot return by accident. No generator bump was owed: the ground was verified unchanged. Original note follows. **Cost to remove: minutes.** Six words in two files, no behaviour change, no
generator bump — names are not generation settings. Left in, they are the
cheapest avoidable risk in the project; a lawyer should decide, and they can
decide faster if the obvious ones are already gone.

#### Third-party marks used nominatively

**GSPro** (3), **Garmin** (3), **Rapsodo** (2) and **PiTrac** (2) are named in
player-facing text, to say what the software talks to. Naming a product to
describe compatibility is ordinary; implying endorsement, partnership or
certification is not, and nothing currently does. **There is no trademark
disclaimer anywhere in the product or the docs** — a single line stating that
all marks belong to their owners and that no affiliation or endorsement is
claimed costs nothing and is missing.

#### Two judgement calls for the owner, not defects

- **~~`AGENTS.md` ships in both archives.~~ Fixed the same day.** The portable archive now carries seven files -- the game, LICENSE, THIRD_PARTY_NOTICES, ATTRIBUTION, README, INSTALLATION and PLAYING (the manual) -- and nothing else. It previously shipped the architecture handoff, the open TODO list with every known defect on it, the research measurements, this review, the dependency inventory and AGENTS.md. The source archive still carries all of them, which is the right place for them.
- **~~`LICENSE` reads "Copyright (c) 2026 Fairway contributors".~~ Settled 25 September: it now names Dustin Oberloh, who holds the copyright outright.** A single holder is what keeps relicensing possible at all -- a project with outside contributors cannot change its licence without asking every one of them, and "contributors" implied exactly that situation. The AI-assisted-authorship question the original review raised is separate and still unresolved. Original note follows. Fine for a
  collective credit; if a company is going to sell this, the holder line and the
  publisher identity are worth settling before money changes hands. The September
  review already flags brand identity as an open item and that stands.

#### Still not established by this pass

- No similarity or provenance search was run over anything written since
  11 September, which is the mesh ingest, the vegetation work, the green work
  and everything after. Only the dependency and asset *footprint* was checked.
- No trademark registry was searched, for "Fairway" or for anything above.
- Nothing here establishes who owns the copyright in AI-assisted portions, which
  the original review also could not determine.

### What this addendum does NOT claim

- No new similarity or provenance search was run over the source. The mesh
  ingest, the vegetation work and everything else since 11 September have not
  been re-reviewed for third-party material; the original review's limits apply
  unchanged and future imports still need their own check.
- ~~The `file://` open path was not re-verified on this pass.~~ **Verified
  working on 25 September**: unzip the portable archive, double-click
  `Fairway.html`, it plays. See the addendum at the foot.
- Nothing here is a fitness, safety or accuracy claim about the simulator. It
  remains suitable packaging for an experimental preview, with the open items in
  TODO.md disclosed.

---

## Addendum, 25 September 2026: the repository was reorganised for publication

**Nothing about the build, the bundle or a licence obligation changed.** What
changed is where files sit and what the archives carry, both of which this
document makes claims about.

**Documentation moved under `docs/`.** The repository root now holds README.md,
CONTRIBUTING.md, AGENTS.md and LICENSE, and nothing else that is prose.
`docs/README.md` indexes the rest. File names were deliberately not changed:
953 references name these files in prose across the documents and the source
comments, and a rename would have turned a reorganisation into a search-and-
replace with no way to distinguish a miss from a mention.

**LICENSE stays at the repository root**, where a licence-detecting host looks
for it, and it is still the first file in the portable archive.

**The portable archive carries seven files rather than six.** `PLAYING.md`,
the player's manual, was added: it is the document a customer most obviously
needs and it had been living inside README.md. The archive also gets its OWN
README now -- `docs/PORTABLE_README.md` -- rather than the repository's. The
root README links into `docs/` and explains `npm ci`, which resolves to a page
of dead links for somebody who has unzipped a game and wants to start it. The
same reasoning applies in reverse to the source archive, which keeps the
repository's layout so a path written in a document still resolves once the
ZIP is unpacked.

**A trademark disclaimer now exists**, which closes the one finding the
commercial-use pass above raised and did not fix ("There is no trademark
disclaimer anywhere in the product or the docs"). It is in the root README, in the portable
archive's README and at the foot of ATTRIBUTION.md: the marks named -- GSPro,
Garmin, Rapsodo, SkyTrak, PiTrac, Foresight, Trackman, and since the V3 pass
rēlā, FlightScope, Full Swing, Square, Nova and GolfJoy (the download's README lists the monitors rēlā
connects; the game's screen listed them until the 1.0 polish) -- belong to their
owners, and no affiliation, endorsement, certification or hardware-
compatibility guarantee is claimed. Naming them to describe compatibility is
nominative use and continues; the gap was that nothing said so out loud.

**A diagnostic was added, and the zero-network-requests claim was re-checked
rather than assumed.** Help carries a button that assembles the build stamp,
the device, the GPU, the frame rate and the last few errors and puts them on
the clipboard. It is the obvious place for telemetry to appear later and it
must not: `src/diagnostic.js` has no `fetch`, no image and no beacon, the
prohibition is recorded as an invariant in PROJECT_HANDOFF, and the built file
was driven in a browser with the diagnostic in use while watching the network
log. The only request the page makes is the page itself.

**Builds are now identifiable.** `vite.config.js` injects the short git commit
and the build time. Before this the only versions in the product were the
settings schema and the generator, neither of which says which build somebody
is running -- so a report from a tester could not be tied to a tree.

### What this addendum does NOT claim

- ~~**The `file://` open is still unverified on a current build.**~~ **It was
  exercised by hand on 25 September and it works.** The central portability
  claim now rests on a check of the current 15.8 MB build rather than on one
  made when the file was an eighth of the size. It is now also checked on
  every run of `npm run smoke`, which opens the built file by `file://` in
  Chromium -- see the addendum at the foot.
- No new similarity or provenance search was run. The limits recorded in the
  September 11 review and in the commercial-use pass apply unchanged.
- Two publication decisions were recorded in TODO.md and not settled here.
  Both have been since: `LICENSE` names the owner as sole copyright holder,
  and `vendor/baked_assets/` (106 MB, read by nothing at build time) is no
  longer committed as of 30 September, its ez-tree notice moved into
  `THIRD_PARTY_NOTICES.txt`.

---

## Addendum, 25 September 2026: the portability claim, checked at last

**`file://` works.** The portable archive was unzipped and `Fairway.html`
opened by double-click on the current build. It plays.

This is the claim the whole single-file design exists to support, and it had
been carried as unverified through three addenda of this document. The last
confirmation anybody could point to was made when the built file was about
1.2 MB; it is 15.8 MB now, with the entire mesh ingest inlined, and it still
opens off the filesystem with no server, no installer and no network.

~~It cannot be automated here.~~ That was true of the in-app browser pane
used during development, which refuses file-URL navigation, and never true of
a real browser -- see the addendum below. A fetch, a worker, a module boundary
or a cross-origin asset is what breaks a file URL, and none of those is a
function of size.

**Packaging is one command now.** `npm run release` builds and then packages,
so a stale build cannot be shipped by forgetting a step -- and if the packager
refuses, the refusal is what you see and the exit code is non-zero. That last
part is why `tools/release.mjs` exists rather than a shell `||` chain across
`python3`, `python` and `py`: a chain cannot distinguish an interpreter that
is absent from a packaging run that FAILED, so a genuine refusal -- a stale
build, a missing notice, an inventory that disagrees with the lockfile --
would silently re-run under the next name and report whatever that said. The
packager's job is to refuse loudly; nothing wrapping it may soften that.

**Name settled, licence settled.** The project keeps the name Fairway and goes
out open source under MIT, free, with optional donations. The donation-wording
rule in "Remaining release checks" above is unchanged and is the part that
still carries risk.

---

## Addendum, 25 September 2026: two release claims are checked on every smoke run

**`file://` is automated.** `npm run smoke` opens the built `dist/index.html`
by `file://` URL in Chromium -- no server -- and plays it. The claim that this
"cannot be scripted" was a limitation of the preview pane used during
development, never of browsers; it has been corrected where it was made.
**Safari and Firefox are still manual**: the smoke test runs Chromium only.

**Zero runtime network requests is enforced, not asserted.** The smoke test
fails any journey during which the page requests anything other than `file:`,
`data:` or `blob:`. Seven journeys -- the menu, a full Endless hole to the next
one, a Surprise-me nine, the range, the studio saving a course -- make none.
That covers the tester diagnostic too, which is the obvious place for a
request to appear one day.

What this does not claim: coverage of multi-player rounds, match play, the
launch-monitor bridge, or any browser but Chromium.

**The source archive contains exactly what git tracks.** The packager used to
glob each source directory by extension, so anything lying in the working tree
went into the archive; three untracked scratch scripts did, and the count --
166 against 163 -- was the only sign. It now takes `git ls-files`, and was
proven by planting a stray file in `tools/` and confirming the archive left it
out. Tracked files ship with their working-tree content, matching the
`dist/index.html` built beside them. A build from the source archive, which has
no repository, falls back to the glob and says so.

**Phones and small screens.** The play HUD and the main menu now lay themselves
out by measurement, with a phone layout below 560 px wide or 500 px tall. On
every smoke run, at nine sizes from desktop to phone, every control is checked
reachable and the page is checked not to scroll, and a hole is played by touch
on an emulated phone both ways up. Before this, a phone held sideways could not
reach the shot button at all. **This is emulation, not device testing**: the
release claim for phones and tablets stays "intended and untested on real
hardware" until someone plays on one.

---

## Addendum, 26 September 2026: a hosted copy can be installed to a home screen

**The portable file is unchanged in what it does.** Opened from disk it links
no manifest and makes no network request -- the manifest link is added by the
page only when it is served over http or https, and the smoke test's
disk-opened journeys fail on any request, so this is checked, not asserted.

**A hosted copy fetches only its own files -- in fact one of them.** Served
from a web address, the page additionally loads `manifest.webmanifest` from the
same address, and nothing else: the home-screen icon is inside the page and the
manifest's icons are inside the manifest, so that a password-protected host
never refuses anything the home screen needs. The smoke test's `home-screen`
journeys fail on any request to another origin and on any 401. Chrome's own install check
reports the hosted copy as installable.

**The icons are the project's own artwork**: the flag path of the existing
brandmark, drawn by `tools/make-icons.mjs`, with no third-party image involved.

**What this does not claim**: that it works offline (it does not yet), or how
the home-screen icon behaves on any particular iPhone -- that is checked on the
device. A launch monitor cannot connect from a phone this way, because a
secure page may not open the bridge's unencrypted connection.

---

## Addendum, 27 September 2026: the portable archive ships the bridge

**The portable archive now carries a program as well as the game.** It is
ten files: the seven it had, plus a **Launch monitor** folder holding
`fairway-bridge.mjs` -- the launch-monitor bridge, the game's physics and **ws
8.21.3 (MIT)** bundled into one JavaScript file for Node.js -- and a start
script each for Windows (`.cmd`) and macOS (`.command`). The README it shipped with had
claimed an "included bridge" that was not included; it is now true.

**What did not change.** `Fairway.html` makes no network requests opened from
disk, checked by every disk-opened smoke journey. The bridge is only ever run
by the player. Started from the start script it listens on every address, so
a phone on the home network can use it too, WITHOUT authentication -- as the
source bridge already could when told to -- and the operating system's
firewall decides whether anything off the computer gets in; the README and
INSTALLATION say both. Started from source (`npm run bridge`) it still listens
on loopback only unless told otherwise. The ws licence ships beside it in THIRD_PARTY_NOTICES.txt and
the bundle names it in a banner. No dependency was added.

**What this does not claim.** That the scripts run on every machine: the
Windows one was run by hand, the macOS ones have not been run on a Mac. They
are unsigned; macOS asks the player to confirm the first time (Control-click,
Open), which the README says. It needs Node.js, which the player installs.

---

## Addendum, 1 October 2026: run_fairway_server and the per-platform downloads

**What ships changed.** `Fairway-portable.zip` (game, docs, a Node.js bundle and
start scripts) is replaced by one download per platform -- `Fairway-Windows.zip`,
`Fairway-macOS-AppleSilicon.zip`, `Fairway-macOS-Intel.zip`, `Fairway-Linux.zip`,
into `release/` -- each carrying **run_fairway_server**, the launch-monitor bridge
compiled with Bun into one program with nothing to install, beside
`Fairway.html`, the player README, PLAYING.md and the notices. INSTALLATION.md
(the build-from-source guide) moved to the source archive only. Sizes: 45 / 32 /
34 / 42 MB, most of it the program.

**For the owner to decide, flagged rather than settled:**

- **Bun statically links JavaScriptCore (LGPL-2).** Bun's own documentation does
  not address `bun build --compile` programs. The approach taken: the
  application ships beside the program as the plain bundle it was built from
  (`server-source/fairway-bridge.mjs`), so a user can rebuild it with a Bun of
  their own carrying a modified JavaScriptCore; Bun's notice, its list of linked
  libraries and the full LGPL 2.1 text are in THIRD_PARTY_NOTICES.txt. That is a
  reading of the LGPL's object-file route, not legal advice. Bun also lists
  tinycc (LGPL 2.1) and zstd (BSD or GPLv2, dual) among its linked libraries.
- **The programs are unsigned** (the macOS ones are ad-hoc signed, which lets
  Apple Silicon run them after the player allows it). Windows SmartScreen and
  macOS Gatekeeper warn on first run; the README walks through both. A paid
  certificate would remove the warnings.
- **rēlā and GSPro are named** in the README, PLAYING.md and the website to say
  what Fairway works with; no affiliation is claimed, and the README says so.

---

## Addendum, 1 October 2026: the website

`site/`, built by `npm run site` into `site-dist/` for Netlify, with the
shipped game copied into `play/` as a browser demo. Reviewed for what it
claims and what it pulls in:

- **No third-party code, fonts or analytics.** Two pages, one stylesheet, one
  script, all written for the project; the icons are inline SVG drawn for it.
  Outbound links only (rēlā's documentation, Kenney, Quaternius, ez-tree,
  Quaternius's Patreon). The demo is the same file as the downloads, so its
  notices are the same and are inside it under Help.
- **Media is the game's own output**: screenshots and clips captured from the
  game, so the only third-party content in them is the CC0 model packs and the
  ez-tree geometry already credited. The footer says "Created with CC0 assets
  and the help of Claude Code" and names Kenney, Quaternius and ez-tree.
- **Physics claim**: "fitted to real launch monitors", with the GC3 figures and
  SkyTrak named as the held-out check -- see *What the site claims* in the
  website repository's docs/RESEARCH.md (it moved there on 7 October 2026). Not "calibrated", not "certified", and no device beyond those two
  (and the planned R50) is named in connection with accuracy.
- **Marks named** to describe compatibility: GSPro, rēlā, GC3, SkyTrak,
  Garmin. The footer carries the line this review asked for in September --
  all marks belong to their owners, no affiliation, endorsement or
  certification claimed -- and so does the download README.
- **Donation wording** (revised 2 October, the owner's words): Fairway is free
  and stays free, donations are appreciated, and "donations go towards any
  future development, and hosting costs for this site", through a Ko-fi link.
  The explicit disclaimers that stood there -- "donating doesn't unlock
  anything" and "donations here don't reach" the model artists -- were removed
  at the owner's request. That still sits inside item 4: nothing on the page
  says or implies that a donation is needed to play, unlocks anything, buys
  hardware compatibility, or reaches the third-party authors -- it names where
  the money does go. Keep it that way: a sentence suggesting donations support
  the artists, or unlock a feature, would cross the line.
- **Not public yet**, at the owner's request: no-index meta tags, an
  `X-Robots-Tag` header and a robots.txt that disallows everything. These keep
  search engines out, not people; Netlify's password protection does that.
- **Release claims on the page**: "free", "no account", "nothing ever sent
  anywhere" (true of the game: the smoke test fails on any network request),
  and "open source soon, under MIT, after a short beta" -- a statement of
  intent the owner made, recorded in TODO.md *Getting the word out*.

---

## Addendum, 2 October 2026: what went to GitHub

Audited after the first push to the private repository, across EVERY file
version on all 69 branches (the history went up too, not only the current
files), the commit messages and the commit identities:

- **No secrets.** No passwords, tokens, API keys, private keys or credential
  files, in any version. The only "password" is documentation saying the
  bridge has none. The Netlify link (`.netlify/`), builds, release archives,
  `docs/sources/private/` and scratch captures are ignored and were never
  committed; `.gitignore` now also ignores `.env`, key and certificate files,
  `.npmrc` and `.claude/settings.local.json` by default. The one editor file
  that is tracked, `.claude/launch.json`, names the local dev-server commands
  and nothing else.
- **No machine paths or user names.** No `C:\Users\...` path, no Windows
  account name, no Netlify site name or ID.
- **The owner's home-network address (a 192.168 address), a VPN address and
  the VPN adapter's name** sat in a bridge comment, a test, PROJECT_HANDOFF and
  TODO, from when the bridge's address picking was written on this machine.
  Replaced with documentation examples (192.168.1.20, 10.8.0.2, "WireGuard
  Tunnel") -- the test checks the same thing -- and then, at the owner's
  request, removed from the HISTORY as well (below).
- **Personal by design**: the owner's name in LICENSE and the copyright notes,
  as the copyright holder; other people's addresses in third-party licence
  notices (the `ws` author) and a saved USGA page.
- **Every commit carried the owner's personal email address** as author and
  committer. Replaced throughout the history (below); new commits in this
  repository use GitHub's no-reply address (`git config user.email`, local to
  the repository).

**The history was rewritten, once, at the owner's request (2 October).** With
`git filter-repo` 2.47.0, over all 69 branches and 265 commits: the home
network address, the VPN address and the VPN adapter's name were replaced in
every file version by the documentation examples (the adapter as `WgTunnel`,
a valid key in the old test files), and every author and committer email by
the owner's GitHub no-reply address. Afterwards, a scan of all 3,022 file
versions and every commit message found none of them. Every commit ID
changed: a hash quoted in an older note or deploy log names the old history.
The branches were force-pushed to GitHub over the first push, so the old
commits can still be fetched there by exact ID until GitHub clears them out
(GitHub Support can purge them on request). A copy of the repository as it
was before the rewrite is kept outside it, beside the project folder, for the
owner to delete once satisfied.

## Addendum, 3 October 2026: reports kept local

At the owner's request, `docs/reports/` (62 files, about 96 MB including the
report clips in Git LFS), `docs/studies/` (2 files) and `docs/sources/`
(4 files: two saved copies of a USGA article that 403s to automated fetch, a
README and the owner's SkyTrak shot extract) are no longer part of the
repository. They are git-ignored, and `git filter-repo` removed them from every
commit on every branch, so every commit ID changed again. The files are still
on the owner's machine; the tools that generate the reports are tracked.

Two things a rewrite does not reach. GitHub keeps Git LFS objects (the report
clips) in the repository's storage after the commits that referenced them are
gone; they are unreachable but only deleting the repository or asking GitHub
support purges them. And anyone who cloned before the rewrite still has the
old history.

Nothing in the build, the tests or the website read these folders, so the
release claims above are unchanged.

## Addendum, 3 October 2026: downloads served from GitHub releases

The website's four Download buttons now link to
`https://github.com/doberloh/fairway/releases/latest/download/<zip>` -- the
same four per-platform zips `npm run release` builds, attached to a GitHub
release. Nothing about the zips themselves changed, so the release claims
above stand. What a player downloads is now decided by which release is newest,
so publishing one is the owner's call alone (AGENTS.md, *Pushing to GitHub*).
Until the repository is public, only the owner can download from it; a
pre-release is never "latest", so betas are published as ordinary releases.
`RELEASE_SHA256.txt` goes up beside the zips so a download can be checked.

## Addendum, 3 October 2026: repository settings for going public

`tools/github-protect.mjs` puts the repository's protections in place and is
safe to rerun. Applied now, while private: pull requests merge with a merge
commit only (squash, rebase and auto-merge off); workflows may use GitHub's
own actions only, with a read-only token that cannot approve pull requests;
Dependabot alerts on. The only collaborator is the owner, with no deploy keys
or webhooks.

Waiting for the repository to be public, because GitHub Free offers them
nowhere else: rulesets keeping `main` from deletion and force-pushes (no
bypass, the owner included), requiring a reviewed pull request for `main`
(owner bypasses), and making `v*` release tags permanent; secret scanning
with push protection; private vulnerability reporting; holding outside
contributors' workflows for approval. TODO, *Making the repository public*,
says to run the script the minute the repository goes public.

Not set, on purpose: a required status check (the tests workflow runs on
GitHub, but its smoke step usually failed there, through the harness; fixed
16 October and not yet seen green -- TODO, *Found on GitHub*),
deleting merged branches, and immutable releases.

## Addendum, 5 October 2026: v0.1 flies left and right mirrored

Found on the first session with a real launch monitor: the v0.1 downloads send
every monitor shot, and every shot shaped with the keyboard, the opposite way
sideways from what the monitor reported. Fixed in the source the same day
(RESEARCH.md, *Left and right were mirrored*); the downloads stay wrong until
the owner publishes a newer release.

## Addendum, 6 October 2026: v0.2

Published at the owner's request from `main` at 94987ba, the same five zips
and checksums `npm run release` builds. It carries the left/right fix (the
5 October addendum above), so v0.1's mirrored flight is no longer what the
Download buttons serve.

## Addendum, 6 October 2026: the flight refit and the website's claim

The flight was refitted against Trackman's tour averages, a GC3 session and
the owner's R50 session (RESEARCH.md). The website says the model is "around
3%" on carry, offline and apex against real launch-monitor data; after the
refit the typical misses per source are carry 1.5-2.5% and peak height
1.7-5.5%, so the claim stands. The data the fit used is private and not in the
repository; the fitting tool is. v0.2 predates it; it shipped in v0.3 (below).

## Addendum, 7 October 2026: v0.3, and the website deployed live

Published at the owner's request from `main` at 568e125 as "Fairway 0.3
(beta)", tag `v0.3`, not a pre-release, with the five zips and checksums
`npm run release` builds; it is the Latest release, and a downloaded zip matched
its checksum. It carries the flight refit, player profiles (every golfer a
profile, a main profile, stats, round history, the sim handicap), replay in
endless runs, the tracer lag and the top-menu fix.

The website was deployed LIVE the same day at the owner's request
(`npm run deploy`, main@568e125). It is still private: Netlify's password
answers 401 to an anonymous request, the `X-Robots-Tag: noindex` header covers
every path, and `site/robots.txt` still disallows everything. Only the game page
changed in that deploy.

**Download buttons and a private repository.** The buttons point at
`releases/latest/download/<zip>`, which GitHub answers with 404 to anyone not
signed in while the repository is private. That was already true of v0.1 and
v0.2; it ends when the repository goes public (and `tools/github-protect.mjs`
has to run then).

**A Dependabot alert, left open.** GitHub flags `braces` 3.0.3 (high, stack
exhaustion on deeply nested patterns). It arrives through
`vite-plugin-singlefile` -> `micromatch`, is used only while building, and is in
nothing a player downloads. GitHub lists no patched version yet.

## Addendum, 7 October 2026: the licence check of everything since 11 September

The owner asked for the provenance search the 25 September addendum said had
not been done. Same method as the 11 September review, applied to the whole
tree as it stands -- the history only begins on 2 October, so "since 11
September" could not be isolated and everything was checked. An engineering
pass, not a legal opinion; its limits are at the end.

**Dependencies.** The lockfile's 66 packages match `DEPENDENCY_INVENTORY.json`
entry for entry: nothing added, removed or re-versioned since 25 September.
Licences: MIT 48, MPL-2.0 12 (Lightning CSS, build only), Apache-2.0 3, ISC 2,
BSD-3-Clause 1 -- all reviewed then. The open Dependabot alert (`braces`,
build-time only, no fix published) is unchanged.

**Assets.** The six model packs in `vendor/` were re-read from the licence file
inside each pack: Kenney (3) say CC0, Quaternius (3) say CC0 / public domain.
`vendor/grown-redwood-forest/` is git-ignored and regenerated by
`tools/grow.mjs`; every file in it carries that tool's own "generated from
scratch" header. ez-tree's output is MIT and credited. The website loads no
outside font, script or stylesheet; its 60 pictures and 10 clips are captures
of the game made by `tools/capture/` (then `tools/site-media/`). No photograph, texture, sound or font
from elsewhere ships.

**Source.** Searched `src/`, `tools/` and `site/` for licence and copyright
headers, "adapted from"/"port of"/"based on", and links to other people's code:
nothing beyond the credits already on file. Then searched for the signatures
of well-known published code -- shader hashes and noise, smooth-min,
simplex/Perlin, Poisson disc, priority flood, Chaikin, FNV, tone mapping -- and
read every hit:

- **Found and fixed: David Hoskins's "Hash without Sine" (MIT), twice, with no
  notice.** The water's hash and the sky's 3-D hash are his hash12 and hash13
  (the constants .1031, .1030, .0973 and 33.33 are the signature). MIT allows
  it with the notice kept; the notice is now in THIRD_PARTY_NOTICES.txt, the
  in-game credits and the source.
- **Found and fixed: Inigo Quilez's polynomial smooth minimum**, the two-line
  `smin` in the ground shader, character for character as published in
  glsl-smooth-min (MIT, stackgl contributors). Credited and its notice added.
  Quilez's own article page could not be fetched to read its terms; the MIT
  publication is the one relied on.
- **Replaced: `fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453)`**, five
  times. The most-copied line in shader programming, with no single
  identifiable author; versions of it sit on sites whose default licence is
  non-commercial. A one-line formula is very unlikely to be protected, but it
  was cheaper to remove the question than to argue it: all five now use
  Hoskins's hash, which is credited. Visual only -- it seeds the speckle in the
  ground shader, mist, sky, foliage and grass gusts. Nothing it touches is
  generation, so the course, the fingerprints and saved rounds are unaffected.
- **Read and left alone, as ideas rather than code:** value noise and fbm
  (textbook), the priority-flood drainage (Barnes et al.'s algorithm, written
  here), Chaikin corner cutting, FNV hashing, the water's two-phase flow
  (Vlachos's technique, written from its description) and the foliage's
  cantilever bend (GPU Gems 3's idea, our own formula).

The packager now refuses to build a release whose embedded notices lack the two
new copyright lines, as it already does for the others.

**Still not established.** As before: no universal similarity database exists,
so this cannot prove every line is unique; nothing here establishes who owns
AI-assisted portions; no trademark registry was searched.

## Addendum, 7 October 2026: v0.4, and the website goes public

**v0.4** is published at the owner's request as "Fairway 0.4 (beta)", tag
`v0.4`, not a pre-release, from the merge of the `release-0.4` branch into
`main`: the same five zips and checksums `npm run release` builds from that
commit. Its notes are `docs/releases/v0.4.md` in the same commit, published
with `--notes-file`, so the repository and GitHub carry the same text. It
carries everything since v0.3: penalty relief by the Rules of Golf, player
backup, removing a round, one typeface and the cleaned-up top bar, the build
progress bar, and the shader-code notices added by the licence check above.

**The website is public.** The owner switched Netlify's password protection
off and moved to Netlify's Personal plan the same day; the site is
https://fairwaygolfsim.netlify.app (renamed from `storied-otter-2881e8`). The
no-index signals stay in place until the owner says to remove them, so search
engines are still asked to stay away. Netlify never builds from the repository
-- every deploy is `npm run deploy` from the owner's machine -- so Git LFS is
not configured on Netlify and does not need to be.

The repository itself is still private as this is written; the owner is making
it public separately, and `tools/github-protect.mjs` runs as soon as it is.

## Addendum, 7 October 2026: the website leaves this repository

At the owner's request, so the game can go public under MIT while the website
stays private and all rights reserved.

**What moved.** `site/` (the pages and 70 pictures and clips in Git LFS),
`netlify.toml`, `tools/build-site.mjs` and `tools/deploy-site.mjs` went to a new
repository, `fairway-website`, beside this folder on the owner's machine, with
their own history cut from this one's by `git filter-repo` (21 commits). The
website's rules from AGENTS.md and its parts of INSTALLATION, the command
sheet, TODO and RESEARCH went with them. Its demo is now the `Fairway.html`
from this repository's newest release, checked against `RELEASE_SHA256.txt`,
rather than a local build -- so the site provably serves the file people
download. The capture tools stayed here as `tools/capture/`. The built page
gained a 60-byte `fairway-versions` meta tag; it makes no request and changes
nothing a player sees.

**What the old history held.** Every pushed version since 1 October carries
the website's pages and media, and the published release source zips v0.1 to
v0.4 (`Fairway-source.zip`) carry `tools/build-site.mjs`,
`tools/deploy-site.mjs` and the capture tools -- not the pages or media. None
of it is secret: no credentials, and the Netlify link (`.netlify/`) was never
committed. It is simply not meant to be open source.

**The rewritten history.** A copy of this repository with `site/`,
`netlify.toml` and the two site tools removed from every commit, branch and tag
waits beside this folder for the owner's review. Nothing has been pushed.

**What a force-push does not remove**, from GitHub's own documentation
([Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)):
after a rewrite and force-push, old commits stay reachable "directly via their
SHA-1 hashes in cached views on GitHub" and through any pull request that
references them, and only GitHub Support can clear those -- and "GitHub Support
won't remove non-sensitive data", which this is. Git LFS objects are worse:
"To remove Git LFS objects from a repository, delete and recreate the
repository" ([Removing files from Git LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/removing-files-from-git-large-file-storage)),
so the website's pictures and clips would stay in this repository's LFS
storage, counted against its quota, after any force-push.

**So the clean route is a fresh repository, and it is the owner's call.**
Rename the current `doberloh/fairway` on GitHub (it stays private, keeping the
old history, releases and media as an archive), create a new, empty
`doberloh/fairway`, push the rewritten history to it, make it public, run
`node tools/github-protect.mjs` the same minute, and publish v0.5 as its first
release. The Download buttons link by name to `doberloh/fairway`'s latest
release, so they pick the new repository up with no change to the site, and
serve GitHub's not-found page between the rename and v0.5. The alternative --
force-push into the existing repository and delete releases v0.1 to v0.4 --
leaves the old commits reachable by hash and the media in LFS storage once the
repository is public.

**What the owner did, the same day.** The fresh route, with one change to the
plan: the old repository became `doberloh/fairway-backup`, and the new public
one is `doberloh/fairway-golf-simulator`, not `doberloh/fairway`. Because no
new repository took the old name, GitHub forwards `doberloh/fairway` to the
backup -- so every link to the old address had to change (the website's
Download buttons and build, `tools/github-protect.mjs`, the docs), or it would
have served the private backup's releases. The website's private repository is
`doberloh/fairway-website`.

## Addendum, 7 October 2026: v0.5, the first release of `fairway-golf-simulator`

The rewritten history went up to `doberloh/fairway-golf-simulator` at the
owner's request: `main`, after `site-kofi` was merged into it, and
`site-kofi`; no other branches and no tags. The repository is still private.

**v0.5** is published at the owner's request as "Fairway 0.5 (beta)", tag
`v0.5`, not a pre-release, from the merge of `release-0.5` into `main`, with
its notes in `docs/releases/v0.5.md` in the same commit. It is the same game as
v0.4; the built file differs only by the `fairway-versions` meta tag, and the
generator is unchanged (34), so saved rounds and course codes carry over. Its
source zip is the first that carries no website tooling. Releases v0.1 to v0.4
stay in the private `fairway-backup` and are not reachable from the website.

## Addendum, 7 October 2026: the repository is public

At the owner's request, `doberloh/fairway-golf-simulator` was made public, and
`node tools/github-protect.mjs` ran in the same command, reporting every
setting done: the three rulesets (`main` keeps its history; `main` changes by
reviewed pull request, which the owner bypasses; release tags `v*` are
permanent), merge commits only, GitHub's own actions only, a read-only workflow
token, outside contributors' workflows held for approval, Dependabot alerts,
secret scanning with push protection, and private vulnerability reporting.

Checked from outside, with no sign-in: the repository page answers; each of
the four `releases/latest/download/<zip>` addresses the website's buttons use
redirects to v0.5's file and serves it; and the old `doberloh/fairway` address
answers 404, because GitHub forwards it to the private `fairway-backup`.

The website was then deployed live from its own repository, its demo the
`Fairway.html` from v0.5, checked against `RELEASE_SHA256.txt`. Its no-index
signals stay on until the owner says otherwise.

## Addendum, 8 October 2026: `source-map-js` 1.2.2

Dependabot alert 2 (`source-map-js` 1.2.1, high: a crafted source map can hang
it) is fixed by moving the lockfile to 1.2.2, inside the range `postcss`
already asks for; no other package moved. Build-time only, before and after:
nothing a player downloads contained it, so v0.5's archives are unaffected.
`DEPENDENCY_INVENTORY.json` matches the lockfile entry for entry again;
licence unchanged (BSD-3-Clause). `npm audit` still lists `braces` 3.0.3 (see
*A Dependabot alert, left open* above): still build-time only, still no
patched version, and the audit's suggested fix -- downgrading
`vite-plugin-singlefile` to 0.9.0 -- is rejected.

## Addendum, 9 October 2026: v0.5.1, a hotfix

**v0.5.1** is published at the owner's request as "Fairway 0.5.1 (beta)", tag
`v0.5.1`, not a pre-release, the same four zip names, from the merge of
`hole-out-score-banner` into `main`, with its notes in
`docs/releases/v0.5.1.md` in that commit. Two interface changes only: the
hole-out banner and the putting marker's upright flag. Generator (34) and
schema (9) are unchanged, so saved rounds, profiles and course codes from 0.5
carry over and the website's sample course code stays valid. The built page
still makes no network requests (the smoke run's network check passed), and
nothing was added to what ships: no dependency, font or asset. The website was
redeployed afterwards so its demo is this release's `Fairway.html`.

## Addendum, 9 October 2026: Haunted Hollow

A ninth biome on the `haunted-hollow-biome` branch, not released. It adds
thirteen models from packs already credited in ATTRIBUTION.md (Quaternius
MegaKit, Ultimate Stylized Nature and Ultimate Nature; Kenney Nature Kit) -- no
new pack, no new licence, nothing fetched. The built page goes from 16.1 MB to
**16.9 MB** (16,890,557 bytes; 7.0 MB gzipped), +762 KB of packed geometry,
almost all of it three gnarled dead oaks. README.md and INSTALLATION.md carried
15.8 MB, which was already stale before this change. Every existing model's
geometry is byte-identical after the re-ingest. `npm run smoke` 24 of 24 on the
built file.

The same day's second pass (solid giant pumpkins and toadstools, lanterns,
ghosts, purple turf) adds code only -- no models, no assets: 16,904,595 bytes
(+14 KB), still 7.0 MB gzipped. Smoke 24 of 24.

The night additions (harvest moon, bats, will-o-the-wisps) are code only:
16,910,622 bytes (+6 KB), still 7.0 MB gzipped. Smoke 24 of 24.

## Addendum, 10 October 2026: v0.6

**v0.6** is published at the owner's request as "Fairway 0.6 (beta)", tag
`v0.6`, not a pre-release, the same four zip names, from the merge of
`release-0.6` into `main`, with its notes in `docs/releases/v0.6.md` in that
commit. It carries Haunted Hollow (the ninth biome, addendum above) and the
night's performance work: the time slider (`smooth-time-slider`) and the pond
probes, shadow twins and one-pass foam (`less-wasted-drawing`) -- RESEARCH,
*The time slider hitched*, *The studio froze when the camera turned to the
sun*, *The god rays drew every shadow map twice* and *Wasted drawing*.
Generator (34) and schema (9) are unchanged since 0.5.1, so saved rounds,
profiles and course codes carry over and the website's sample course code
stays valid; the only settings change is a ninth value in the biome list.

The built page is 16,912,638 bytes (7.0 MB gzipped), +2 KB on the night
additions above: the performance work is code only, with nothing added to
what ships -- no dependency, font or asset. The built page still makes no
network requests (the smoke run's network check). Smoke: 23 of 24 journeys
passed on the same code; **`floodlit-night` was not run** for this release,
at the owner's decision (it is the Ultra floodlight journey held back on the
development machine since 5 October). Nothing in the release changes how the
floodlights are switched or warmed; the god-ray and probe changes do touch
frames drawn while they are on. The website was redeployed after it (preview,
then live, at the owner's word): its demo is this release's `Fairway.html`,
byte for byte, and its four Download buttons serve the 0.6 zips.

## Addendum, 11 October 2026: v0.6.1

**v0.6.1** is published at the owner's request as "Fairway 0.6.1 (beta)", tag
`v0.6.1`, not a pre-release, the same four zip names, from the merge of
`release-0.6.1` into `main`, with its notes in `docs/releases/v0.6.1.md` in
that commit. It carries the UI pass of 10-11 October (`shot-panel-and-monitor-mode`):
the shot tiles and their bar, the launch monitor window, unlocked aim with a
monitor, plays like, the new keys and the television cameras -- TODO, *The UI
pass*; RESEARCH, *Plays like, by geometry*. Generator (34) and schema (9) are
unchanged since 0.6, so saved rounds, profiles and course codes carry over and
the website's sample course code stays valid. Device preferences gained keys of
their own (`fairway-shot-data-v2`, `fairway-shot-data-monitor-v1`,
`fairway-shot-tiles-v1`, `fairway-shot-open-v2`); a v1 Shot data choice keeps
its fields.

The built page is 16,927,602 bytes (7.0 MB gzipped), +15 KB on 0.6: code and
markup only, no dependency, font or asset added. The built page still makes no
network requests (the smoke run's network check). Smoke: 24 of 24 journeys on
the release code, **`floodlit-night` included** -- `npm run smoke` ran it on
every pass of the UI work without trouble, which is worth knowing given it was
held back for 0.6. The slower hole descent through the trees has not been
profiled (TODO).

The website was redeployed after the release (preview, then live, at the
owner's word): `/play/` serves this release's `Fairway.html` byte for byte
(sha256 `ad6cc7ff…`, checked on the live URL), the page still states
generator 34 and schema 9, and its four Download buttons resolve to the
v0.6.1 zips.

## Addendum, 14 October 2026: v0.7

**v0.7** is published at the owner's request as "Fairway 0.7 (beta)", tag
`v0.7`, not a pre-release, the same four zip names, from the merge of
`release-0.7` into `main`, with its notes in `docs/releases/v0.7.md` in
that commit. It carries five journeys since 0.6.1: shot views and the studio
bar; each golfer's own bag and nothing standing in a tee's view; the spin-back
rework; every sound, synthesised; and the shot line in the play window with
the tiles along the bottom (TODO, `# Done`, each under its own heading).
**`GENERATOR_VERSION` is 35** (bushes and houses out of the tees' view), so a
round saved in 0.6.x opens with the version notice; course codes still load,
on the new ground, and the website's sample course code is written from the
page's own `fairway-versions` tag (`generator=35 schema=9`). Schema (9) is
unchanged. Device preferences gained `fairway-sound-v1` and
`fairway-shot-data-phone-v1`; a golfer's bag lives in the profile store.

**The bridge changed with it**: it now accepts every club code a bag can send
(all nineteen kinds, read from `CLUB_KINDS`) and no longer closes the browser's
connection over one it does not know. Under 0.6.1's server a bag with a 4 iron,
a hybrid or a gap wedge would have dropped the connection when that club was
picked; anyone playing with a monitor should take this release's server with
its game.

The built page is 16,998,607 bytes (7.0 MB gzipped), +71 KB on 0.6.1: code and
markup only -- the sounds are synthesised at run time, so no audio file,
dependency, font or asset was added. **Smoke on the release code: not run.**
The last full run, 26 of 26 journeys on an idle card, was on `main` at
`cdd10bd` (the sounds merge), which includes the network check that the page
makes no requests. The final journey (`shot-data-layout`) changed the
interface only and adds no network code, but a software-renderer smoke run on
it crashed the owner's computer part-way through on 13 October, and the
owner, about to play games on the same machine, asked for light testing for
the release. So the release was checked by `npm test` (718 of 718), a build,
a hand check in the browser at laptop and phone sizes, and a hand check of the
bridge against a pretend device. TODO keeps the smoke run open.

The website was redeployed after the release (preview, then live, at the
owner's word): `/play/` serves this release's `Fairway.html` byte for byte
(sha256 `56ecf161…`, checked on the live URL), the page states generator 35
and schema 9 (the tag the site's build writes its sample course code from),
and its four Download buttons resolve to the v0.7 zips.
The packaged Windows server was also run from its unzipped download before
publishing: it served the page and passed 4I, GW, 3H, LW and DR to a pretend
device without dropping the browser.

## Addendum, 15 October 2026: v0.8

**v0.8** is published at the owner's request as "Fairway 0.8 (beta)", tag
`v0.8`, not a pre-release, the same four zip names, from the merge of
`release-0.8` into `main`, with its notes in `docs/releases/v0.8.md` in that
commit. It carries four journeys since 0.7: the Swing Meter with XP, levels,
rewards, achievements, challenges and the course of the week (`swing-meter`,
which also brought greens at real size, the bolder and attended pin, the Green
size setting, the ball-light shader fix and Course studio's full-screen
settings); every unlock under test (`unlock-tests`); and the five empty levels
filled (`fill-empty-levels`). **`GENERATOR_VERSION` is 36** (greens at real
size), so a round saved in 0.7 opens with the version notice; course codes
still load, on the new ground. **`SCHEMA_VERSION` is 11** (the ball-flight
profile removed at 10, `greenScale` added at 11), migrated silently. The
page's `fairway-versions` tag reads `generator=36 schema=11`, which the
website's sample course code is written from. Profiles gain XP, levels, what
is worn, achievements, challenge records and weekly bests inside the existing
profile store (no new storage key); devices keep `fairway-*` preferences as
before.

**The bridge is unchanged** (no change under `bridge/`, `public/` or
`vendor/` since 0.7), so 0.7's server works with this game; the zips carry it
rebuilt from the same source. No dependency was added, removed or upgraded
(`package.json` and the lock file unchanged), so ATTRIBUTION and
THIRD_PARTY_NOTICES stand. Every new look -- ball finishes, tracers, frames,
meter skins, flourishes -- is drawn in code at run time; no image, font or
audio file was added.

The built page is 17,131,522 bytes (7.06 MB gzipped), +133 KB on 0.7. **Smoke
on the release code: partly.** The last full run, 32 of 32 journeys on an idle
card, was on `swing-meter` at the ball-light fix (813a074). After it, each
later change ran the journeys it touched, on an idle card with the owner's
leave: `studio`, `phone-portrait` and `phone-landscape` for the full-screen
settings; `look` and `level-up` on the final reward code (474bf7e). A final
graphics profile on the real-GPU arm found nothing slower than the baseline
(RESEARCH *Final profile before the merge*); the software-renderer arm was
skipped, as it crashed the owner's computer on 13 October. `npm test`: 796 of
796.

The website was redeployed after the release (preview, then live, at the
owner's word): `/play/` serves this release's `Fairway.html` byte for byte
(sha256 `b693fcaa…`, checked on the live URL), the page states generator 36
and schema 11, and its four Download buttons resolve to the v0.8 zips. The
packaged Windows server was run from its unzipped download before publishing
and served the page byte for byte -- on spare ports (19922/19921), because the
owner's own bridge (`npm run bridge`) was holding 1922 at the time; it was left
running.

## Addendum, 16 October 2026: v0.8.1

**v0.8.1** is published at the owner's request as "Fairway 0.8.1 (beta)", tag
`v0.8.1`, not a pre-release, the same four zip names, from the merge of
`release-0.8.1` into `main`, with its notes in `docs/releases/v0.8.1.md` in
that commit. It carries, since 0.8: Skins as a round format, out of the
challenges (`skins-game-mode`); an Endless run from the menu starting in the
menu hole's daylight instead of at midnight (`endless-menu-clock`); and a fix
for rounds a golfer joined mid-round, which could not be loaded or take a
mulligan once that golfer finished a hole (`round-matrix-tests`). The rest is
tests, the smoke harness, CI and documentation. **`GENERATOR_VERSION` is still
36 and `SCHEMA_VERSION` still 11**, so a round saved in 0.8 opens without the
version notice, and the page's `fairway-versions` tag still reads
`generator=36 schema=11`. A skins round saved in 0.8.1 does not open in 0.8,
whose `Round` refuses the mode; a round saved in the old Skins challenge opens
in 0.8.1 as a skins round.

**The bridge is unchanged** (no change under `bridge/`, `public/` or
`vendor/` since 0.8), and no dependency was added, removed or upgraded
(`package.json` and the lock file unchanged), so ATTRIBUTION and
THIRD_PARTY_NOTICES stand. `npm audit` (16 October): nothing in what the game
ships; three high-severity advisories in the build tools (TODO).

The built page is 17,134,701 bytes (7.08 MB gzipped), +3 KB on 0.8. **Smoke on
the release code: nearly.** The full run, 34 of 34 journeys on an idle card,
was on `main` at 1da4f74, with Skins, the Endless fix and the smoke fixes in;
after it, `round-matrix-tests` changed `Round.restore` (the save fix) and one
line of `main.js` (the save import reads `FORMATS`), and the owner chose to
release without another smoke run. `npm test`: 816 of 816. **Not seen in the
game by anyone:** Skins, the Endless daylight and the save fix (TODO, *Skins as
a round format* and *What the smoke test does not walk*).

The website was redeployed after the release (preview, then live, at the
owner's word): `/play/` serves this release's `Fairway.html` byte for byte
(sha256 `83dbca39…`, checked on the live URL), and its four Download buttons
resolve to the v0.8.1 zips. The packaged Windows server was run from its
unzipped download before publishing and served the page byte for byte, on
spare ports (19922/19921) to leave the owner's own bridge on 1922 alone.

## Addendum, 16 October 2026: v0.8.2

**v0.8.2** is published at the owner's request as "Fairway 0.8.2 (beta)", tag
`v0.8.2`, not a pre-release, the same four zip names, from the merge of
`release-0.8.2` into `main`, with its notes in `docs/releases/v0.8.2.md` in
that commit. It carries one journey since 0.8.1, `more-challenges`: 36
challenges with medals on a fixed Challenge Course and the range, the
challenge of the week, the new challenge pay with its daily allowance, and
five achievements (18 in all). **`GENERATOR_VERSION` is still 36,
`SCHEMA_VERSION` still 11 and `PROFILE_VERSION` still 3**: profiles gain their
medals and weekly records inside the existing profile store, and an old
challenge record is read as the medal it earns. The page's `fairway-versions`
tag still reads `generator=36 schema=11`.

**The bridge is unchanged** (no change under `bridge/`, `public/` or
`vendor/` since 0.8.1), and no dependency was added, removed or upgraded, so
ATTRIBUTION and THIRD_PARTY_NOTICES stand. The built page is 17,178,830 bytes
(7.10 MB gzipped), +44 KB on 0.8.1. **Smoke:** the full run passed 34 of 35 on
the challenges branch, the one failure being `look`'s achievement count (13,
now 18), which passes with the count updated; `challenge`, `challenge-week`
and `challenge-more` pass. `npm test`: 884 of 884. **Not seen in the game by a
person:** the challenges screens and most challenges (TODO, *More
challenges*), and still Skins, the Endless daylight and the save fix from
0.8.1.

The website was redeployed after the release (preview, then live, at the
owner's word): `/play/` serves this release's `Fairway.html` byte for byte
(sha256 `bb8d0ebe…`, checked on the live URL), and its four Download buttons
resolve to the v0.8.2 zips. The packaged Windows server was run from its
unzipped download before publishing and served the page byte for byte, on
spare ports (19922/19921).

## Addendum, 16 October 2026: v0.8.3

**v0.8.3** is published at the owner's request as "Fairway 0.8.3 (beta)", tag
`v0.8.3`, not a pre-release, the same four zip names, from the merge of
`release-0.8.3` into `main`, with its notes in `docs/releases/v0.8.3.md` in
that commit. It carries two journeys since 0.8.2: `low-tier-trees` (Low and
Medium trees without shards or striped crowns) and `range-greens` (range
targets as real greens on the aim arc, a short-game green with chip and putt
stations, shaped greens, CSV and PDF exports, a view-bar button for Range
controls), plus two TODO-only merges. **`GENERATOR_VERSION` is still 36,
`SCHEMA_VERSION` still 11 and `PROFILE_VERSION` still 3**: the range is never
saved, its green set-ups are device-local (`fairway-range-greens-v1`), and the
biome fingerprint was unchanged. The page's `fairway-versions` tag still reads
`generator=36 schema=11`.

**The range's exports make no request.** The CSV and the PDF report are made
in the page and handed to the browser as a `blob:` download -- the way the
scorecard's CSV always has been -- so the portable file still makes none; the
`range-greens` smoke journey downloads both under the no-request rule. **No
dependency was added**: the PDF is written by `src/pdf.js`, which names the
reader's own Helvetica and embeds no font (ATTRIBUTION, *The range's PDF report
names a font*). The bridge is unchanged (nothing under `bridge/`, `public/`
or `vendor/` since 0.8.2), so THIRD_PARTY_NOTICES stands. The built page is
17,213,640 bytes (7.11 MB gzipped), +35 KB on 0.8.2. **Smoke:** 37 of 37 on the
real GPU with the range code, including the new `range-greens` journey.
`npm test`: 901 of 901. **Seen by a person:** the range greens, played by the
owner with the keyboard controls. **Not seen by a person:** the Low and Medium
trees on a real weak laptop or a phone.

The website was redeployed live after the release, at the owner's word (no
preview: the owner asked for the live site): `/play/` serves this release's
`Fairway.html` byte for byte (sha256 `00f22f32…`, checked on the live URL),
and its four Download buttons resolve through `releases/latest` to the v0.8.3
zips. The packaged Windows server was run from its unzipped download before
publishing and served the page byte for byte, on spare ports (19922/19921).

## Addendum, 17 October 2026: the 1.0 interface's typeface (branch `ui-1-0`, phase 0)

**A font ships for the first time.** Phase 0 of the 1.0 interface embeds
**Saira Condensed**, the typeface the owner approved in the mockups, under the
**SIL Open Font License 1.1**: Bold (700) and ExtraBold (800), Latin subset,
woff2, 17,808 and 17,984 bytes, unmodified as Google Fonts distributes them
(taken from `@fontsource/saira-condensed` 5.3.0, which repackages Google Fonts
version 12; the package itself is not a dependency -- the two files are copied
into `src/fonts/` with the licence beside them). The OFL allows bundling with
software, commercial use included, on two conditions that matter here: the
licence must travel with the font (it is in `src/fonts/OFL.txt`, which the
source archive carries, and in THIRD_PARTY_NOTICES.txt, which every zip
carries), and a modified version may not use the Reserved Font Name "Saira"
(the files are not modified).

The family has **no italic**: the slanted numbers in the design are the
browser's own slant of the upright faces, as they were in the mockups. Only
two weights ship; a 600 asked for falls to 700.

**Still no request.** `src/ui-kit.css` names the files by relative path and the
build inlines them as `data:font/woff2` URLs (Vite's `assetsInlineLimit`), so
the portable file makes no network request; checked in the built page (two
`@font-face` rules, both `data:`). Characters outside the Latin subset (the
macrons in "rēlā", the arrow glyphs) fall back to the system face, glyph by
glyph. The built page is **17,271,965 bytes, +58 KB** on 0.8.3 (the fonts
base64-encoded, the kit's stylesheet, and the licence text, which Help's
notices carry; the kit's modules are not imported yet, so not in the page);
the plan had guessed 130 KB. Nothing is drawn in the new face yet -- phase 0 adds the face and the
kit; phase 1 is the first screen to use them.

**The rest of the overnight build (phases 1-5, same branch, same night).** No
dependency, font or asset was added after the typeface: the round screen,
shot moments, menus and focus are the game's own CSS and JavaScript, and the
chiptune (`src/chiptune.js`) is synthesised and not even in the page yet (it is
not imported; the sound lab inlines it into its local listening page). The
built page is **17,329,584 bytes, +116 KB on 0.8.3** with everything on the
branch. Its one `fetch(` is still Vite's module-preload helper, which never
runs in the single file (THIRD_PARTY_NOTICES, *Vite 8.3.0 module-preload
helper*). **Smoke on the branch: 37 of 37 journeys** on the real GPU, later
the same night (the owner allowed the graphics card while asleep), so the
zero-request rule held through every journey, the served and bridge ones
included.


## Round 14: the start splash's data in the page (17 October 2026)

The built page carries one more small inline script in its head,
`window.__FAIRWAY_SPLASH__` (vite.config.js `fairway-splash`): the nine
landscapes' palettes and names, the package version, and two date functions
from weekly.js, about 3 KB. It needs no network and no storage, so the file
still opens offline from a file URL. Nothing else about the single file
changed.

## Addendum, 18 October 2026: v0.9

**v0.9** is published at the owner's request ("build and release v0.9 to both
github and live website"), as "Fairway 0.9 (beta)", tag `v0.9`, not a
pre-release, the same four zip names, from the merge of `release-0.9` into
`main`, with its notes in `docs/releases/v0.9.md` in that commit. It carries
the whole `ui-1-0` journey (the 1.0 interface on every screen, the start
splash, the tiny course models, the new sounds, the old interface removed)
plus the release branch: the capture tools for the website, the 1.0 icons and
version 0.9.0. **`GENERATOR_VERSION` is still 36, `SCHEMA_VERSION` still 11
and `PROFILE_VERSION` still 3**; the biome fingerprint is unchanged, and the
page's `fairway-versions` tag still reads `generator=36 schema=11`, so saved
rounds and course codes from 0.8.3 carry over untouched.

**The package version is 0.9.0** (package.json and its lockfile): the start
splash prints it, and it had said 1.0.0 since the first commit. The bridge's
banner carries the same number.

**One font, no other new dependency.** Saira Condensed (OFL 1.1, two woff2
files, inlined as `data:` URLs) is the only addition since 0.8.3, recorded in
the typeface addendum above and in THIRD_PARTY_NOTICES. The icons in
`public/` and `index.html` are redrawn by `tools/make-icons.mjs` in the
splash's colours: still the project's own drawing, no third-party image.

**The page makes no request, and carries one `fetch(` again.** Counting
`fetch(` in the release build against 0.8.3's found four against one: the
course-model cards passed three.js's namespace to a helper as a value, so the
bundler kept all of three.js, its file loaders included. Dead code -- every
smoke journey enforces zero requests and passed -- but 147 KB of page and
network code the single file had never carried. Fixed before release
(model-cards.js `PARTS`; tests/three-namespace.test.mjs now refuses it): the
one `fetch(` left is Vite's module-preload helper, as before. The built page
is **17,561,146 bytes (7.21 MB gzipped), +348 KB on 0.8.3**: the interface's
stylesheets and modules, the fonts and the splash data.

**Checked:** `npm test` 1004 of 1004. **Smoke: 37 of 37 journeys** on the real
GPU, in seven small batches; `ball-light-hole-out` failed once (a lit shader
built during the hole-out flyover, the intermittent open item in TODO) and
passed on its rerun. After the `PARTS` fix the seven journeys that draw course
cards passed again, and the cards were seen drawing with no warning. **Not seen
by a person:** most of the 1.0 interface in play (TODO lists each screen and
what it was seen at), the new sounds, a phone, a real launch monitor.

**The website was redeployed live after the release**, at the owner's word,
from its own repository's branch `website-1-0` (its 1.0 rework, not yet merged
there): `/play/` serves this release's `Fairway.html` byte for byte (sha256
`df9a8d47…`, fetched from the live URL with a cache-busting query), and the
Download buttons resolve through `releases/latest` to the v0.9 zips. The
packaged Windows server was run from its unzipped download before publishing
and served the page byte for byte, on spare ports (19922/19921).

## Addendum, 20 October 2026: v0.9.1

**v0.9.1** is published at the owner's request ("merge this all in, generate a
new release 0.9.1, generate release notes and push to github, then push to the
live website with the new game version"), as "Fairway 0.9.1 (beta)", tag
`v0.9.1`, not a pre-release, the same four zip names, from the merge of
`release-0.9.1` into `main`, with its notes in `docs/releases/v0.9.1.md` in
that commit. It carries the `challenge-a-friend` journey (a finished card,
its course and every shot as a code, `src/rival.js`; the owner's ten fixes
from testing 0.9) and the flyover-camera tools merged after 0.9.
**`GENERATOR_VERSION` is still 36, `SCHEMA_VERSION` still 11 and
`PROFILE_VERSION` still 3**; `node tools/biome-fingerprint.mjs --check` says
every biome is unchanged, and the page's `fairway-versions` tag still reads
`generator=36 schema=11`. A saved round gains two optional fields, `rival` (the
challenge it is played against) and `shots` (its shot log); a round saved by
0.9 has neither and loads as before.

**The package version is 0.9.1** (package.json and its lockfile). **A
friend's challenge code names the version and commit it was made on** and is
refused by any other build, by design (PROJECT_HANDOFF *A friend's challenge is
the version*), so codes made on 0.9.1 play only on 0.9.1.

**No new dependency, no request.** The page still carries one `fetch(` (Vite's
module-preload helper) and makes no network request. The built page is
**17,586,096 bytes (7.23 MB gzipped), +25 KB on 0.9**: rival.js and the
interface changes. The zips: Windows 48.2 MB, macOS Apple silicon 34.1 MB,
macOS Intel 36.4 MB, Linux 44.8 MB, each 8 verified files.

**Checked:** `npm test` 1022 of 1022 and the build; the biome fingerprint.
The `friend-challenge` smoke journey passed on the real GPU on 20 October,
before the ten fixes. **No smoke run and no browser look after the ten
fixes**: the graphics card was in use (the owner's machine) and no GPU run was
asked for, so the save box, the Next hole button, the new Round complete, the
camera name and turn, the aim label and the card shapes reach players
unplayed (TODO, *Challenge a friend*, lists what to check). The studio
journey was rewritten for the save box and has not run.

## Addendum, 22 October 2026: v0.9.2

**v0.9.2** is published at the owner's request ("build 0.9.2 and release
notes, push to github but not the website"), as "Fairway 0.9.2 (beta)", tag
`v0.9.2`, not a pre-release, the same four zip names (and the source zip and
checksums, as 0.9.1 had), from the merge of `release-0.9.2` into `main`, with
its notes in `docs/releases/v0.9.2.md` in that commit. It carries the
`ui-ux-pass` journey: seven interface audits and their fixes (one Play for
every game type, Challenges' own row, Esc steps back, Continue after Save and
leave, the round screen, the phone layouts with the picture lifted, the
results in the 1.0 style, and the bugs the audits found). **`GENERATOR_VERSION`
is still 36, `SCHEMA_VERSION` still 11 and `PROFILE_VERSION` still 3**;
`node tools/biome-fingerprint.mjs --check` says every biome is unchanged, so
courses grow as before and 0.9.1's saves load. **The package version is
0.9.2.** A friend's challenge code names the version and commit it was made on
(PROJECT_HANDOFF *A friend's challenge is the version*), so 0.9.1's codes do
not play on 0.9.2 -- said in the notes.

**The website is not redeployed** (the owner: "not the website"). Its Download
buttons follow `releases/latest` and so serve the v0.9.2 zips at once; its
browser demo and sample course code stay on 0.9.1 until it is deployed again
from its own folder.

**No new dependency, no request.** The page still carries one `fetch(` (Vite's
module-preload helper) and makes no network request. The built page is
**17,712,607 bytes (7.25 MB gzipped), +126 KB on 0.9.1**: the interface work.
The zips: Windows 48.3 MB, macOS Apple silicon 34.1 MB, macOS Intel 36.5 MB,
Linux 44.9 MB, each 8 verified files. The packaged Windows server was run from
its unzipped download on spare ports (19922/19921) and served `Fairway.html`
byte for byte (sha256 `38dbc82f…`), then stopped.

**Checked:** `npm test` 1041 of 1041 and the build; the biome fingerprint;
**the smoke run, 38 of 38 journeys on the real GPU** (22 October, on the
interface as released; only the version and these notes changed after it); the
**graphics profile**, the branch build against 0.9.1's main alternated group by
group on the real GPU, every group but the software one: frame cost unchanged
within noise. Audit 7 (364 screenshots at four screen sizes, no console
errors) is the last look. **Not played by hand**: the owner is testing on a
phone and a PC (TODO, *Release 0.9.2*).

## Addendum, 22 October 2026: Vite 8.3.3 (three Dependabot alerts)

Pushing v0.9.2's `main` showed **three open Dependabot alerts, all on `vite`
8.3.0** (development scope): GHSA-587h-7wmj-h5pm / CVE-2026-112942 (high,
launch-editor's `fs.existsSync()` check bypassable on Windows),
GHSA-r825-w8mm-5pxw / CVE-2026-112944 (medium, an editor's command-line flag
misread, running a command) and GHSA-698v-4r3x-3vcv / CVE-2026-112943 (medium,
`escapeCmdArgs()` not escaping `%` on Windows). All three are in the dev
server's *open in editor* endpoint (launch-editor, vendored inside Vite),
affect 8.3.0-8.3.2, and are fixed in 8.3.3. **None reaches a player**: the
shipped page and the packaged server contain no launch-editor or
`__open-in-editor` code (searched); the exposure was the owner's machine while
`npm run dev` runs, through a hostile page making requests to it.

**Vite is now 8.3.3**, pinned exactly, on branch `vite-security-fix`. It
brings Rolldown 1.2.8 -> 1.2.15 and `@oxc-project/types` 0.149.0 -> 0.155.0
(and Rolldown's platform bindings); no package added or removed, no licence
changed, `docs/DEPENDENCY_INVENTORY.json` follows the lockfile, and
THIRD_PARTY_NOTICES' two helper headings name the new versions (the helpers
are the same MIT code). **The built page changed only in minification**:
17,712,352 bytes against 17,712,607 (the notices name the new versions), the
re-minified code equivalent rewrites by the
newer bundler (`(1<<e|0)>>>0` to `1<<e>>>0`, `a?e:(b,e)` to `a||(b),e`); still
one `fetch(` (the module-preload helper), no request. Checked: `npm test` 1041
of 1041, the biome fingerprint unchanged, `vite` 8.3.3's dev server starting and
serving the page. **Not run: the smoke journeys** (they need the graphics card,
not asked for); a bundler change reaches every line of the page, so they should
run before this is released.

**Still reported by `npm audit`:** `braces` (via `vite-plugin-singlefile` 2.3.3
-> `micromatch`), build-time only. Until October its only "fix" was a downgrade
of the single-file plugin, rejected. **`vite-plugin-singlefile` 2.3.4 (17 October
2026) replaces micromatch with picomatch** and so drops braces; not taken here
(TODO, *Tools and code*).

## Addendum, 22 October 2026: v0.9.3

**v0.9.3** is published at the owner's request ("merge. make a 0.9.3 and push
to github"), as "Fairway 0.9.3 (beta)", tag `v0.9.3`, not a pre-release, the
same six files as 0.9.2, from the merge of `release-0.9.3` into `main`, with its
notes in `docs/releases/v0.9.3.md` in that commit. It carries the merge of
`vite-security-fix` (Vite 8.3.3 for the three Dependabot alerts on its dev
server; *Vite 8.3.3* above) and nothing else: the game's source is 0.9.2's.
**`GENERATOR_VERSION` 36, `SCHEMA_VERSION` 11 and `PROFILE_VERSION` 3 are
unchanged**; `node tools/biome-fingerprint.mjs --check` says every biome is
unchanged. **The package version is 0.9.3**, so 0.9.2's friend-challenge codes
do not play on it (said in the notes). The website is not redeployed: its
Download buttons serve 0.9.3 through `releases/latest`, its demo stays on 0.9.1.

The built page is **17,712,352 bytes (7.25 MB gzipped)**, 255 bytes under 0.9.2
(the newer bundler's minification), still one `fetch(` and no request. The
zips: Windows 48.3 MB, macOS Apple silicon 34.1 MB, macOS Intel 36.5 MB, Linux
44.9 MB, each 8 verified files.

**Checked:** `npm test` 1041 of 1041, the build, the fingerprint, and the
packaged Windows server run from its unzipped download on spare ports
(19922/19921), which served `Fairway.html` (0.9.3) byte for byte, then
stopped. **Not run: the smoke journeys** -- the owner chose to
leave them for later and asked for the release; the page's code is 0.9.2's,
re-minified by Rolldown 1.2.15 (equivalent rewrites, compared), but no browser
has played this build.

## Addendum, 23 October 2026: v0.9.4

**v0.9.4** is published at the owner's request ("Lets merge all of this code in
and build a new minor version 0.9.4 ... push to github ... push the new game
version to the live site"), as "Fairway 0.9.4 (beta)", tag `v0.9.4`, not a
pre-release, the same six files as 0.9.3, from the merge of `release-0.9.4`
into `main`, with its notes in `docs/releases/v0.9.4.md` in that commit. It
carries the merge of `frame-rate` (the frame-rate goal: Ultra frames about 21%
faster; RESEARCH.md *Frame time on Ultra*). **`GENERATOR_VERSION` 36,
`SCHEMA_VERSION` 11 and `PROFILE_VERSION` 3 are unchanged**; the biome
fingerprint is unchanged. **The package version is 0.9.4**, so 0.9.3's
friend-challenge codes do not play on it (said in the notes). The website is
redeployed after the release, so its demo moves to 0.9.4.

The built page is **17,717,533 bytes (7.27 MB gzipped)**, about 5 KB over
0.9.3 (the frame-rate code and its comments), still one `fetch(` and no
request. The zips: Windows 48.3 MB, macOS Apple silicon 34.1 MB, macOS Intel
36.5 MB, Linux 44.9 MB, each 8 verified files; the source zip 9.3 MB, 353
files.

**Checked:** `npm test` (1043) and the biome fingerprint on the merged code;
six smoke journeys passed on the branch's build (`hud-reachable`, `range`,
`endless-round`, `floodlit-night`, `phone-portrait`, `phone-landscape`), which
also covers 0.9.3's Vite 8.3.3 bundle for those journeys; the old and new
builds compared frame for frame with the clock stopped and in motion. **Not
run:** the other smoke journeys. **Not played by a person.**

## Addendum, 23 October 2026: Lakeshore Dunes (branch, not released)

The tenth biome, on the `lakeshore-dunes-biome` branch. Not merged, not
released. What it changes for distribution:

- **The built page is 18,407,153 bytes (7.64 MB gzipped), 689,620 bytes
  (3.9%) over 0.9.4.** Nearly all of it is the model module
  (`src/asset-meshes.js`, 14,690.1 to 15,353.5 KB): 17 models built in
  Blender (dune grass, cottonwood, black oak, sugar maple, juniper,
  driftwood; docs/BLENDER_ASSETS.md). Every one of the existing 255 model
  parts came through the ingest byte-identical.
- **No new dependency and nothing fetched.** Blender is a tool used to write
  committed `.glb` files, like `tools/grow.mjs`; it is not in the build. The
  models are this project's own work under MIT (ATTRIBUTION.md, *Built in
  Blender*). The page still has one `fetch(` (the manifest, served copies
  only) and the four smoke journeys run on it (`boot`, `weekly`, `studio`,
  `surprise-round`) saw no request.
- **`GENERATOR_VERSION` 36 and `SCHEMA_VERSION` 11 are unchanged**: the
  biome fingerprint shows all nine existing biomes unchanged and the new one
  new, and a new option in the existing biome choice is not a change of shape
  (the Giant Redwood and Haunted Hollow precedent).
- **The course of the week does not change for any week before Monday 9
  November 2026**, when Lakeshore Dunes takes its first turn (weekly.js
  `WEEKLY_ROTATION`). Copies older than this branch keep the nine-landscape
  rotation after that date, so from week 149 an old copy and a new one show
  different landscapes for the same week; a release before then keeps that
  to players who have not updated.

## Addendum, 25 October 2026: the cartoon overhaul (merged 27 October, not released)

The `cartoon-overhaul` branch (docs/CARTOON_OVERHAUL.md), merged into main on
27 October 2026; not released. What it changes for distribution so far:

- **The built page is 11,244,483 bytes (5.46 MB gzipped) on 26 October**, at
  generator 43 after the frame-rate pass made the crowns lighter (the model
  module 6,933 KB). It was 23,506,100 bytes (10.81 MB gzipped) at generator 39,
  against 18,407,153 for Lakeshore Dunes. The growth is the remade models
  (`src/asset-meshes.js` 19,084.8 KB: painted Blender trees, shrubs and
  boulders, each painted tree with a shipped far twin of about a twelfth of
  its triangles -- 330 KB for all twenty) and the turf detail atlas
  (`src/turf-detail.js`, about 906 KB, a generated PNG). The owner allowed
  the single file to grow for the new graphics.
- **Nothing fetched, no new dependency.** Every model is made by a committed
  Blender script (tools/blender/cartoon_*.py) and committed as `.glb`; the
  turf atlas by `tools/turf-detail.mjs`.
- **`GENERATOR_VERSION` was 39 then** (landforms and ground types 37, shared
  links fairways 38, uncleared stands 39), 43 now; a save from main is told its
  course was rebuilt (`showVersionNotice`). `SCHEMA_VERSION` is unchanged.
- **Later on the branch the page shrank**: the Giant Redwood's grown trees
  (13,000-53,000 triangles each) were remade in Blender at 1,000-1,900, and
  the Kenney houses, cacti, dead trees, rocks, grass and flowers and the
  MegaKit and Ultimate Stylized dead trees stopped shipping. The model module
  went from 19.8 MB to 7.8 MB at generator 43. Re-measured at the second
  hand-over (26 October, after the wildflowers, heather, gardens, tee
  furniture and numbered flags): **11,363,350 bytes, 5.50 MB gzipped**, the
  model module 7,041 KB -- 119 KB more than the first measure above. After the
  late rounds (third pass): 11,363,991 bytes. After the polish goal (seated
  trees, far woods, Mountain's crags, the stacks, Haunted Hollow's season):
  11,403,624 bytes -- the far woods are generated, not shipped, so the growth
  is the rock models and code. Generator 46.
- **At the merge into main (27 October 2026, after the far-landscape and
  mowing goal): 11,441,981 bytes, 5.52 MB gzipped**, generator 52 -- smaller
  than main's last measured page before the overhaul (16.9 MB, *Addendum*
  above). Still one offline file; nothing fetched. Not released: a release
  waits for the owner, from main.

## Addendum, 27 October 2026: the old asset packs removed

After the cartoon overhaul was merged, the owner asked for every asset it had
replaced to be removed, with the credits for packs no longer used. Removed
from the repository on the `asset-cleanup` branch:

- **The six CC0 model packs** (Kenney Nature Kit, City Kit Suburban, Building
  Kit; Quaternius Ultimate Nature, Ultimate Stylized Nature, Stylized Nature
  MegaKit) and `vendor/blender-lakeshore/` (the first Blender pack, replaced by
  `blender-cartoon_lakeshore`). `vendor/` went from 240 MB to 11 MB.
- **The tools that only read or made them**: `tools/bake-assets.mjs`,
  `tools/bake-trees.mjs`, `tools/grow.mjs`, `tools/grow-lib.mjs`,
  `tools/blender/lakeshore.py`, and `npm run grove`.
- **ez-tree**, the devDependency the bake used: out of `package.json`, the
  lockfile and `DEPENDENCY_INVENTORY.json` (65 packages, was 66), and its
  notice out of THIRD_PARTY_NOTICES.txt, since nothing it made ships.
- **The credits**: ATTRIBUTION.md no longer lists the packs; it says every
  model is this project's own Blender work, and that releases up to 0.9.4
  carry their own ATTRIBUTION.md for what they shipped.

**What ships did not change**: rebuilt without the packs, `src/asset-meshes.js`
is byte-identical apart from its header comment (232 models, every one
`Blender_*`), and the built page differs from main's only by the ez-tree
notice (1,315 bytes shorter: 11,439,829 bytes) and its build stamp. No
imported image, model, sprite, font beyond Saira Condensed, or sound ships.

**The website may still credit them**: on 1 October its footer named Kenney,
Quaternius and ez-tree (*Addendum, 1 October 2026: the website*), and its
pictures from before the overhaul show the pack models. The website is
another repository, not checked here; that is for the owner to change there.

## Addendum, 27 October 2026: v0.9.5

**v0.9.5** is published at the owner's request ("Merge all to main, Build the
binaries, release notes, and push a new release to github as well as the live
website v0.9.5"), as "Fairway 0.9.5 (beta)", tag `v0.9.5`, not a pre-release,
the same six files as 0.9.4, from the merge of `release-0.9.5` into `main`,
with its notes in `docs/releases/v0.9.5.md` in that commit. It carries
Lakeshore Dunes (merged 24 October, not released until now), the cartoon
overhaul and the asset cleanup (the addenda above). **`GENERATOR_VERSION` is
52** (36 in 0.9.4), so a saved 0.9.4 round is told its course was rebuilt;
**`SCHEMA_VERSION` 11 and `PROFILE_VERSION` 3 are unchanged**. **The package
version is 0.9.5**, so 0.9.4's friend-challenge codes do not play on it (said
in the notes). The website is redeployed after the release, so its demo moves
to 0.9.5.

The built page is **11,440,666 bytes (5.53 MB gzipped)**, 6.3 MB under 0.9.4:
every model is the cartoon overhaul's, far lighter than the grown redwoods and
pack models it replaced, and no image but the turf atlas and the two font
files is inlined. The zips: Windows 46.5 MB, macOS Apple silicon 32.4 MB,
macOS Intel 34.8 MB, Linux 43.1 MB, each 8 verified files; the source zip
7.7 MB, 404 files.

**Checked:** `npm test` (1101) on the merged code; the dependency inventory
against the lockfile (65 packages); the packager's own verification of every
zip. **Not run, at the owner's word:** the smoke journeys on this build ("No
smoke tests or anything needed for this"); they last ran on the overhaul
branch, 35 of 37, with both failures followed up (TODO). **Not played by a
person.**

## Addendum, 27 October 2026: the 1.0 interface polish (branch, not released)

Branch `ui-polish-1-0` (docs/UI_POLISH.md). What changes for distribution:

- **The page is 13,784,067 bytes (6.95 MB gzipped; 28 October, the build
  with square boxes -- 3.5 KB under the final audit's, the slant's rules
  gone)**, against 11,440,666 (5.26 MB) on main: the landscape pictures on the course cards, 45 WebP
  files (1,709 KB; src/shots/, inlined like everything else), replacing the
  tiny 3D course models, whose code is removed. The goal's budget for them
  was 3 MB.
- **A second browser store: IndexedDB** (database `fairway-course-pictures`),
  for the picture a course is saved with (course-pictures.js); where a
  browser refuses IndexedDB it falls back to its own localStorage entry, and
  past that the course is kept without its picture. Still no network: the
  pictures are taken from the game's own canvas and the course file
  (`.fairway`) is written and read as a local download and a local file pick.
  **Not yet checked from a file opened straight from disk** in Chrome,
  Firefox and Safari (TODO).
- No dependency added or removed; THIRD_PARTY_NOTICES and ATTRIBUTION are
  unchanged (the pictures are the game's own renders).

## Addendum, 30 October 2026: Architect courses (branch, not released)

Branch `architect-courses` (docs/ARCHITECT_COURSES.md). What changes for
distribution:

- **The page is 14,550,037 bytes (7.50 MB gzipped)**, against main's build
  at the start of the branch: the asset meshes module grew from 7.22 MB to
  7.82 MB with six Blender packs (architect_people, architect_clubhouses,
  architect_water, architect_story, architect_life, architect_occasion; 57
  models, low-poly, inlined like everything else), and the Architect code
  (designer, styles, the architect, paths, markings, the clubhouse, built
  water, the land's story, life, tournament week, the yardage book).
- **A new download**: the yardage book, a PDF written by the game's own PDF
  writer (pdf.js) and handed to the browser as a local download, like the
  range report. No network, no new store.
- No dependency added or removed; THIRD_PARTY_NOTICES and ATTRIBUTION are
  unchanged (every new model is the project's own, from committed Blender
  scripts).
- **Not yet checked from a file opened straight from disk** (the yardage
  book's download from file://): to check with the TODO entries.
- **After the owner's review** (30 October 2026): the page is 14,797,078 bytes
  (7.60 MB gzipped). The fountain model left the bundle (52 KB; the renderer
  draws the water); four walker and five spectator bodies replaced one of
  each, and the mower was rebuilt. The yardage book can now also be
  downloaded from the course studio -- the same local PDF download. Course codes
  carried the hand tools' list (`archHand`) for a day; the tools were
  withdrawn on 31 October 2026 (SCHEMA_VERSION 14) and no code carries it
  now -- an old code that does loads without it.

## Addendum, 31 October 2026: v0.9.6

**v0.9.6** is published at the owner's request ("Lets merge this back into
main. I think i want to keep this still 0.9 so lets make another path
version and push the latest to both github as well as the live website"),
as "Fairway 0.9.6 (beta)", tag `v0.9.6`, not a pre-release, the same six
files as 0.9.5, from the merge of `release-0.9.6` into `main`, with its notes
in `docs/releases/v0.9.6.md` in that commit. It carries the two branches the
addenda above describe as not released: the 1.0 interface polish and
Architect courses (beta). **`GENERATOR_VERSION` is 53** (52 in 0.9.5), so a
saved 0.9.5 round is told its course changed; **`SCHEMA_VERSION` 14** (11,
migrated: settings carry over); **`PROFILE_VERSION` 3** unchanged; an
Architect course's stamp is 53020. **The package version is 0.9.6**, so
0.9.5's friend-challenge codes do not play on it (said in the notes). The
website is redeployed after the release, so its demo moves to 0.9.6.

The built page is **14,820,197 bytes (7.60 MB gzipped)**, 3.4 MB over 0.9.5:
the interface polish's landscape pictures and the Architect's models,
clubhouses, people and kit. Still no network request: the yardage book and
the range report are made in the page and downloaded locally. The zips:
Windows 48.6 MB, macOS Apple silicon 34.5 MB, macOS Intel 36.8 MB, Linux
45.2 MB, each 8 verified files; the source zip 8.3 MB, 476 files.

**Checked:** `npm test` (1,236) on the release branch, whose tree the merge
keeps; both biome fingerprints; the packager's own verification of every zip.
**Not run:** the smoke journeys on this build -- the graphics card was not
asked for; `architect-studio` and `architect-round` last passed on the
branch on 31 October, before the far heath and the eleven models, and the
whole set has not run since the overhaul branch. **Not played by a person**
beyond the owner's rounds on the branches.

## Addendum, 31 October 2026: Fairway Course Builder (branch, not released)

**4 November 2026: the builder's page carries the game's models** (the
preview, src/builder/preview.js), so `Fairway Builder.html` grows by about 25
MB and every zip with it (the same data twice, compressed twice). PLACED: the
owner asked to see the model; fetching it from the game's page is not possible
by file://. Game view (the same day) adds the game's drawing code: the page goes
from 26.6 to 28.2 MB as vite counts it, 14.1 MB gzipped.

The `course-builder` branch adds a **second page to every download**,
`Fairway Builder.html` (docs/COURSE_BUILDER.md): built single-file by
`vite.builder.config.js` after the game in `npm run build`, into
`dist/builder.html`; the packager puts it in all four zips beside
`Fairway.html` and adds its line to `RELEASE_SHA256.txt`. The zip names do not
change, so the website's Download buttons are unaffected. **Owed before a
release**: the website's demo checks `Fairway.html` against
`RELEASE_SHA256.txt`, and must be confirmed to read it by name.

The builder is offline on the same terms as the game: it opens by file://,
reads only the files a player gives it, writes `.fairway` files (and door 2 drafts) as downloads -- or, since 1
November 2026, to the one file the player chose in the browser's save dialog,
written again by Save (saving.js) --
and makes no request -- checked by its own smoke harness
(`tools/builder-smoke.mjs`, which fails on any request). At stage 0 it was
107,941 bytes; at stage 3 906,624 (three.js and the course generator now
ride in it, for door 1 and the editor), still no dependency of its own. **Stage 6 adds laz-perf 0.0.7** (Apache-2.0; npm, `laz-perf`), the LASzip decoder compiled to WebAssembly, to the builder's page only, its 214 KB of WebAssembly inlined (laz.js hands it in, so the loader never fetches its .wasm). In DEPENDENCY_INVENTORY.json (runtime), THIRD_PARTY_NOTICES.txt and ATTRIBUTION.md. The game's page does not import it. The game's page is unchanged by stage 0.
The study named geotiff.js and proj4js too; **neither was added** (stage 6):
GeoTIFF is read by Fairway's own reader, and UTM, degrees and (since 1
November 2026) Lambert conformal conic and transverse Mercator grids from a
file's WKT by its own conversions, any other map grid lined up by matching
points.

**Stages 7-9 (31 October 2026).** Door 2 and the auto trace add no
dependency. The builder's page is **1,374,433 bytes** (gzip about 461 KB):
laz-perf's WebAssembly and the LIDAR readers since stage 3's 906,624. The
game's page is 14,846,858 bytes against main's 14,820,197 built the same day
(+26,661, 0.18%: the code that plays a built file -- built-world, the ZIP and
document readers, the built store and the built-field shader branch); still
one file. Door 2 reads only the files a player chooses (LIDAR, its .prj/.hdr,
a picture and its world file), holds them in the page's memory, and keeps
none of them in the course: a built file carries the land, outlines, holes and
trees, never the survey or the picture (an aerial picture's licence may
forbid passing it on). All five builder journeys pass with no network request,
`builder-door-2` among them, which brings a LIDAR file in through the file
picker, makes a course and plays it in the game by file://. **The one network use (the owner's amended goal, 31 October 2026)**:
door 2's *Fetch imagery for this land* and *Find* ask an imagery provider --
USGS, IGN France, PDOK, PNOA, swisstopo with no key, Google or Bing with the
player's own -- for map tiles over the land, and OpenStreetMap's Nominatim
(the free providers' place search) for a place by name; and *Fetch
OpenStreetMap* asks the Overpass API (overpass-api.de) for the golf features, the course boundary and the buildings
over the land. **OpenStreetMap's licence travels with a course built from
it**: the ODbL asks for the credit, which the builder adds to the course's
credits, and a database made from it and shared stays ODbL -- a shared
`.fairway` built from it carries that licence (the owner's call to allow,
named here so a release can say so). **Since 1 November 2026, LIDAR too**
(amendments 13-14): *Search for LIDAR* (since 10 November 2026 *Build it myself*, and Build it for me, over a box drawn on the map) asks the National Map's product API
(tnmaccess.nationalmap.gov), IGN's WFS (data.geopf.fr) and swisstopo's STAC catalogue (data.geo.admin.ch); *Download the
square here* reads USGS's Entwine copy on Amazon's open data
(s3-us-west-2.amazonaws.com/usgs-lidar-public) or IGN's COPC tiles or swisstopo's zipped LAS;
*Download all tiles* asks Fairway's bridge on 127.0.0.1:1922 (its
`/lidar` route, which fetches rockyweb.usgs.gov and prd-tnm only, for local
pages only) or makes ordinary browser downloads from rockyweb and reads them
from the player's LIDAR folder; state and national portals are plain
links (Washington's opens on the place, by its own `#lat:lon:zoom`).
**The LIDAR folder** (amendment 15): every download is written to a folder
the player picks with the browser's own folder dialog (File System Access,
`showDirectoryPicker`; Chrome and Edge, which treat a `file://` page as a
secure context), and read back from there instead of downloaded again; the
browser keeps the folder's handle in IndexedDB and asks the player's leave
again on a later visit. The page writes only there, only files it
downloaded, and reads only LIDAR files from it. Where the browser has no
folder dialog (Firefox, Safari), each download is an ordinary browser
download. A ZIP brought in (a portal's download) is unpacked in memory. 3DEP is public domain and LiDAR HD Licence Ouverte; a course built
from a survey carries the land, not the survey. Only when the player
presses them; a key is kept in that browser's storage and sent only to its
own provider, never in a file; the picture is kept in the player's own saved
files since 5 November 2026 (*Addendum, 5 November 2026*) and its credit is added
to the course's credits. Everything else in both pages stays offline, and the
smoke journeys still fail on any request but the stand-ins a journey names.
**Owed before a
release carrying the builder** (TODO): the website's `RELEASE_SHA256.txt`
check confirmed to read `Fairway.html`'s line by name, now that the builder's
line sits beside it; laz-perf's copyright line confirmed against its
LICENSE; the owner's play of both programs.

A built course file (`.fairway` version 2) is a ZIP written by hand
(`src/zip.js`) and read only by Fairway's own code; it holds data, never
code, and every part is checked against limits before use
(`src/course-doc.js` `LIMITS`), so a file handed between players cannot ask
the game for more memory than a 3 x 3 km course needs.

## Addendum, 5 November 2026: pictures and map data in a saved course (branch, not released)

The owner's decision, against the earlier line that no picture is ever saved: a
course saved from the builder's editor keeps its pictures and OpenStreetMap's
download in a builder's section (COURSE_BUILDER, *Course files*), so it reopens
whole. What that changes here:

- **Google and Bing pictures now sit on the player's disk.** The builder only
  ever held them in memory; their terms limit keeping them as well as tracing
  them (Google's section 3.2.3 is the one the builder quotes; the wording on
  keeping should be read before a release). The player brings their own key and
  is told at the key box; the owner accepted this as the player's decision and
  account. Fairway ships no imagery and fetches none unasked.
- **A saved .fairway can carry those pictures to someone else** if a player sends
  it instead of **Save a copy to share**. The copy leaves them out, the game
  keeps and exports only the course, and the builder's words say so on every
  Save; nothing can stop a player sending the wrong file.
- **OpenStreetMap's download in a file** stays under ODbL with the credit the
  course already carries.
- **The offline claim stands:** fetching remains only on the player's press, and
  reopening a file makes no request. The file's API keys: none, by design.

## Addendum, 2 November 2026: Architect, Haunted Hollow, tournament week and the people removed (branch, not released)

On `course-builder`, the first step of the US landscapes goal. **The game's
page is 13,562,273 bytes (7.01 MB gzipped)**, 1.28 MB under the 14,846,858
of the builder's stages 7-9: Haunted Hollow's models, the people and
tournament week's pack (`architect_occasion`, `figures.py`), and the
Architect code (designer, styles, the architect, hand tools) left the
bundle. Architect's world pieces stayed and are now on every generated
course; the yardage book is offered for every generated course, the same
local PDF download as before. No dependency added or removed; still one
file, still no network request in the game. Not yet released, so no player
sees it; the US landscapes goal grows the page again (the owner: game size
may grow).

**Step 2, the same day**: the page is **13,797,198 bytes (7.11 MB
gzipped)**, +235 KB: the map of the landscapes and the globe's land
(src/us-map-data.js, 215 KB; EPA ecoregions and Natural Earth, both public
domain -- ATTRIBUTION), the region table and the map's code. Still one file,
no network request.

**Step 3, the Pacific pack**: the page is **14,496,972 bytes (7.47 MB
gzipped)**, +700 KB: ten Blender models for Puget Sound and Redwood Coast
and four far twins (the model module 7.05 to 7.75 MB). Still one file.

**Step 3, the mountain pack**: the page is **14,746,002 bytes (7.59 MB
gzipped)**, +249 KB: six Blender models for the Rockies (two lodgepoles,
a blue spruce, willow thicket, columbine, lupine, the split-rail fence)
and three far twins (the model module 7.75 to 7.99 MB). Still one file.

**Step 3, the dry-and-lake pack**: the page is **14,883,461 bytes (7.66
MB gzipped)**, +137 KB: jojoba, sand cherry and the pier light (the
ironwood held back). Still one file.

**Step 3, Heartland and New England**: the page is **15,914,333 bytes
(8.18 MB gzipped)**, +1.03 MB: twelve models and their far twins, the
ironwood, and the Pacific trees reworked silhouette first. Still one file.

**Step 3, the Keys and every variant**: the page is **17,308,566 bytes
(8.90 MB gzipped)**, +1.39 MB: the Keys pack, every held-back variant and
far twin, and the older trees reworked silhouette first. Still one file.

**Step 3 done, and phase 3**: the page is **18,317,461 bytes (9.65 MB
gzipped)**, +1.01 MB: five landscapes' card pictures (0.95 MB) and their
records. Still one file, no network request.

**Phase 4, the roads**: the page is **18,327,986 bytes (9.65 MB gzipped)**,
+10 KB of code (roads.js, the lot and road drawing). Still one file.

**Phase 5, the South** (with phase 4b's streets kit): the page is
**23,295,540 bytes (12.32 MB gzipped)**, +5.0 MB: the streets kit's eight
models, then the South's 26 species in every variant with 21 far twins,
the plantation clubhouse and the alligator (the model module 14.35 MB),
and the five landscapes' card pictures (836 KB of WebP). Still one file,
no network request.

**Phase 6, Texas and the deserts**: the page is **26,562,670 bytes (14.22
MB gzipped)**, +3.3 MB: the two packs' 24 species in every variant with
six far twins and the limestone boulders (the model module 16.19 MB, +2.2
MB), and six landscapes' card pictures (750 KB). Still one file, no
network request.

**Phase 7, California and the western mountains**: the page is
**30,705,270 bytes (16.68 MB gzipped)**, +4.1 MB: the three packs' 29
species in every variant with 16 far twins, basalt and granite boulders,
two sea stacks and the volcano (the model module 19.0 MB, +2.8 MB), and six
landscapes' card pictures (913 KB). Still one file, no network request.

**Phase 8a, the high desert and the plains**: the page is **32,757,120
bytes (17.80 MB gzipped)**, +2.1 MB: the two packs' 14 species, stone and
ranch pieces (the model module 20.5 MB, +1.5 MB), and five landscapes'
card pictures (611 KB, two of them retaken). Still one file, no network
request.

**Phase 8b, Appalachia and the Northeast's own**: the page is
**34,788,010 bytes (18.96 MB gzipped)**, +2.0 MB: the two packs' 12 species
and five buildings and fences (the model module 21.95 MB, +1.5 MB), and five
landscapes' card pictures (661 KB, two retaken). Still one file, no network
request.

**Phase 8c, the north, the Pacific links and Hawaii** -- every landscape
in: the page is **37,025,760 bytes (20.31 MB gzipped)**, +2.2 MB: the two
packs' 16 species, the lava, cabin and dock (the model module 23.4 MB, +1.5
MB), and four landscapes' card pictures (758 KB, Alaska's retaken). Since
the goal's first step (13.8 MB) the page has grown 23.2 MB, of which the
models are about 16 MB and the forty landscapes' pictures about 4 MB.
Still one file, no network request.

**The Badlands and the prairie grasses (3 November 2026)** -- the page is
**37,891,844 bytes (19.82 MB gzipped as measured by gzip -c)**, +0.87 MB
on phase 8c: the Badlands pack's six species and the grass pack's twelve
clumps (the model module 24.1 MB once the grasses had their rounds; the page then 38,071,286 bytes), the Badlands' four card pictures
(89 KB). The Badlands' formations are the ground's (a landform and a
shader rule), so they add no model weight. Still one file, no network
request.

**4 November 2026, the page doubled its models and was put back.** From generator 81 to 85 the built page was 62.8 MB (33.2 MB gzipped): the generator's worker, inlined into the page, had come to import the models. Fixed: 38,130,402 bytes (20.87 MB gzipped), and tests/worker-imports.test.mjs now fails if the worker reaches them again. No release carried it.

## Addendum, 5 November 2026: v0.9.7

**v0.9.7** is published at the owner's request ("Lets merge back to main with this
version of the game, build a new patch version and push to git hub but not the
website"), as "Fairway 0.9.7 (beta)", tag `v0.9.7`, not a pre-release, the same six
files as 0.9.6, from the merge of `course-builder` into `main`, with its notes in
`docs/releases/v0.9.7.md`. It carries the addenda above marked as not released: Fairway
Course Builder, the US landscapes, and the removal of Architect, Haunted Hollow,
tournament week and the people. It also carries the Redwood Coast's Meshy trees.
**`GENERATOR_VERSION` is 89** (53 in 0.9.6), so a saved 0.9.6 round is told its course
changed; **`SCHEMA_VERSION` 27** (14, migrated: settings carry over); **`BUILT_VERSION`
3**, new since 0.9.6; **`PROFILE_VERSION` 3** unchanged. **The package version is 0.9.7**,
so 0.9.6's friend-challenge codes do not play on it (said in the notes). **The website
is not redeployed**, by the owner's word: its Download buttons follow the new release
by themselves, and its demo stays on 0.9.6.

The built game is **41,158,636 bytes (22.5 MB gzipped)**, 26.3 MB over 0.9.6, and
`Fairway Builder.html` 31,080,038 bytes. This is well past where the page stood, and
was accepted as the landscapes' cost and not reviewed further here. The zips: Windows
79.2 MB, macOS Apple silicon 65.0 MB, macOS Intel 67.4 MB, Linux 75.8 MB, each 9 verified
files; the source zip 19.3 MB, 630 files. The 28 Meshy models are the paid plan's
output (ATTRIBUTION.md, *Generated with Meshy*).

**Checked:** `npm test` (1,483) on the branch, whose tree the merge keeps; the
fingerprint before the last trees; the packager's verification of every zip; the
`boot` journey on the trees' final build. **Not run:** the full smoke set on this build
or a profile, waived by the owner on 5 November; 36 of 41 journeys passed on a build
just before the last wood change, and the other five on the next. **Not played by a
person** in this form, including the Meshy trees and far-version swaps in motion.

**Branch `us-golf-courses`, 8 November 2026 (not a release).** With the US golf looks' Meshy trees
(batches one and two and the last batch) the built game is **59,139,292 bytes (32.8 MB gzipped)**,
18.0 MB over 0.9.7, and `dist/builder.html` 52,929,252 bytes (28.8 MB gzipped); `src/asset-meshes.js`
alone is 49.3 MB of it (44.5 MB before the last batch). Released as 0.9.8 with the
trees (the addendum for v0.9.8 below).

## Addendum, 8 November 2026: v0.9.8

**v0.9.8** is published at the owner's request ("Merge and release to github. Then update the demo on
the live website"; a patch version, "We will stay below 1.0"), as "Fairway 0.9.8 (beta)", tag
`v0.9.8`, not a pre-release, the same six files as 0.9.7, from the merge of `us-golf-courses` into
`main`, with its notes in `docs/releases/v0.9.8.md`. It carries the US golf looks: forty-two
landscapes pared to fifteen (every retired key kept in `OLD_KEYS` and migrated), Meshy trees in
every landscape, Desert Mountain and the Badlands routed round their ranges and formations, no
cart paths, clubhouse, road or lot on a generated course (course.js `facilities`, off), relief on
the maps, and the floodlight lamp budget. **`GENERATOR_VERSION` is 102** (89 in 0.9.7), so a
saved 0.9.7 round is told its course changed; **`SCHEMA_VERSION` 47** (27, migrated: settings
carry over, a retired landscape opens on its heir); **`BUILT_VERSION` 3** and
**`PROFILE_VERSION` 3** unchanged. **The package version is 0.9.8**, so 0.9.7's friend-challenge
codes do not play on it (said in the notes). **The website's demo is redeployed** at the owner's
word.

The built game is **57,317,898 bytes (31.4 MB gzipped)**, 16.2 MB over 0.9.7, almost all of it the
trees (`src/asset-meshes.js`), and `Fairway Builder.html` 52,924,216 bytes (28.8 MB gzipped).
Accepted as the trees' cost, as 0.9.7's growth was, and not reviewed further here. The zips:
Windows 101.4 MB, macOS Apple silicon 87.2 MB, macOS Intel 89.6 MB, Linux 98.0 MB, each 9 verified
files; the source zip 32.6 MB, 634 files. The Meshy models are the paid plan's output (ATTRIBUTION.md,
*Generated with Meshy*).

**Checked:** `node tools/test.mjs` (1,489, none failing; one to-do, the road check kept for when
facilities return) on the branch, whose tree the merge keeps; the biome fingerprints; the full smoke
set, 41 of 41 journeys (39 on the full run, the two whose harness was stale after the fix, on their
rerun) on the build before the bougainvillea's colour change, which is a colour only; the packager's
verification of every zip. **Not run:** a graphics profile. **Not played by a person** in this form:
the fifteen landscapes, the routed courses and the night fix were seen only in captures.

## Addendum, 8 November 2026: v0.9.9

**v0.9.9** is a hotfix published at the owner's request ("push a hotfix release version of the
game to github, and the live website once that is fixed"), as "Fairway 0.9.9 (beta)", tag
`v0.9.9`, not a pre-release, the same six files, from the merge of `green-mowing-hotfix` into
`main`, notes in `docs/releases/v0.9.9.md`. One change, drawing only: on a built course a green's
mowing reaches its traced edge and a tee is mown (ground.js; PROJECT_HANDOFF, *A BUILT COURSE'S
MOWING READS THE BUILT EDGES*). **Every version number is 0.9.8's** (generator 102, schema 47,
built 3, profile 3: nothing a course or a save holds changed); **the package version is 0.9.9**, so
0.9.8's friend-challenge codes do not play on it (said in the notes). Sizes as 0.9.8 to within a few
hundred bytes. **Checked:** the full tests (1,489, none failing), the fingerprints (unchanged), the
full smoke set on this build, the fix seen in the game on four bench courses. **Not played by a
person.**

## Addendum, 9 November 2026: v0.9.10

**v0.9.10** is published at the owner's request ("Merge this all back into main and create a new
patch version release, Push to github, and update and push the demo to the live website"), as
"Fairway 0.9.10 (beta)", tag `v0.9.10`, not a pre-release, the same six files, from the merge of
`meshy-african-sumac` into `main` (which carries `desert-mountain-skin`, merged before it), notes in
`docs/releases/v0.9.10.md`. Content: 22 Meshy remakes and the African sumac
(vendor/blender-meshy_remakes, blender-meshy_desertres, blender-meshy_redwood2; ATTRIBUTION), the
coast greens lightened, the southern barn and silo and the desert ruin removed, the built Desert
Mountain skin and two-course boundaries. **Generator 103** (was 102: four landscapes' ground moved
with the buildings), schema 47, built 3, profile 3, so a saved round on those four landscapes shows
the version notice and 0.9.9's friend-challenge codes do not play (said in the notes). **Sizes:** the
page 58.4 MB, each zip about 2.0 MB larger than 0.9.9's (Windows 103.4 MB, Linux 100.0 MB, Apple
Silicon 89.2 MB, Intel 91.6 MB, source 33.6 MB). **Checked:** the full tests (1,490, none failing),
the fingerprints (no unrecorded change), the packager's verification of every zip, a Low frame check
of the remakes against main (RESEARCH, *The remakes' frame cost on Low*). **Not run:** the smoke
set (no interface file changed since 0.9.9). **Not played by a person**: the plants were seen only
in captures.

## Addendum, 9 November 2026: v0.9.11

**v0.9.11** is published at the owner's request ("Lets get this merged into main and do a new patch
version. Push to github as well as the live website"), as "Fairway 0.9.11 (beta)", tag `v0.9.11`,
not a pre-release, the same six files, from the merge of `frame-rate-all-tiers` into `main`, notes
in `docs/releases/v0.9.11.md`. Content: the frame-rate work (RESEARCH, *Frame rate on every tier:
the large built courses*) -- far versions made when the models are packed, each keeping its model's
outline (112; 18 models drawn in full), the swap to them dissolved, Low's distant trees thinned
(never the hole's), the far ground of the very largest courses drawn coarser, a built course's
field baked on other cores, houses' footings and drives batched, the builder's cost readout and
weight note. **Version numbers unchanged** (generator 103, schema 47, built 3), so saves, rounds
and 0.9.10's friend-challenge codes carry over. **Sizes:** the page 58.4 to 60.4 MB (the far
versions, about 1.9 MB, and the new modules), the builder's 54.0 to 56.0 MB; each zip about 2.2 MB
larger than 0.9.10's (Windows 105.6 MB, Linux 102.2 MB, Apple Silicon 91.4 MB, Intel 93.8 MB,
source 34.8 MB). **A second inline worker** (src/bake-worker.js, a built course's field baked on
other cores): bundled into the page as the ground workers are (`?worker&inline`), so it runs from
file:// and from the bridge alike; a browser that refuses workers bakes on the main thread as
before. Nothing else about the offline build changed. **Checked:** the full tests (1,515, none
failing; the owner, at the release: no need to run them again), the packager's verification of
every zip, the smoke set on the branch (41 of 41, before the evening's far-version changes), every
change measured against the build before it on the graphics card and seen still and in motion.
**Not measured again after the far versions' outline rule:** High and Ultra (it was measured on
Low and Medium). **Not played by a person.**

## The builder's guide in every download (10 November 2026, the builder-ux goal)

Every zip carries **Fairway Builder Guide.html** beside Fairway Builder.html
(tools/package_release.py): docs/BUILDER_GUIDE.md built by
tools/builder-guide.mjs into one page with its pictures inside it as
WebP -- 1,330 kB with nine; 1,702 kB since the tenth, the map round a
course with a box drawn on it (10 November 2026, after the trial below); 1,975 kB since Build it for me's picture became its warning over that map, a whole map in place of a nearly empty panel; 1,989 kB with the tee-sets section (10 November 2026) -- offline, no fetched font or script (it uses the system's
fonts). A Markdown file in a zip shows no pictures, hence a page. The source
zip gains docs/BUILDER_GUIDE.md, docs/COURSE_BUILDER.md, docs/builder-guide/
and tests/fixtures/ (the old-files test's course file, 560 kB), which a build
or a test from the source needs. **Tried on the branch (10 November 2026,
07:05):** `npm run release` verified all five zips; each player zip holds
the guide (1,403,167 bytes, identical to dist/builder-guide.html, its nine
pictures inside) and its README names it; the zips: Windows 106.7 MB, macOS
Apple Silicon 92.5, macOS Intel 94.9, Linux 103.3, source 36.5 (679 files).
Opened from the zip, the page shows all nine pictures and fetches nothing.
Those trial zips are kept aside locally (bench/ab/release-builder-ux) and
release/ holds 0.9.11's again: a release is built from main after the merge.

## Addendum, 10 November 2026: v0.9.12

**v0.9.12** is published at the owner's request ("Merge back into main. Generate a new hotfix
release version push to github and update the live website with the new demo version"), as
"Fairway 0.9.12 (beta)", tag `v0.9.12`, not a pre-release, the same six files, from the merge of
`builder-ux` into `main`, notes in `docs/releases/v0.9.12.md`. Content: the Course Builder made
easy (docs/COURSE_BUILDER.md, *The builder-ux goal* and the sections after it) -- one search bar,
a box on the map, Build it for me or Build it myself, the map checks, door 2 as a paint program,
the 3D editor's palette, the six tee sets from OpenStreetMap, tee markers inside narrow built
tees -- and **Fairway Builder Guide.html in every player zip** (the section above). **Version
numbers unchanged** (generator 103, schema 47, built 3): saves, rounds, built course files and
0.9.11's friend-challenge codes carry over; a built file naming no tee set plays its old blue,
white and red. **Sizes:** the game page 60.4 MB (unchanged in practice), the builder's 56.1 MB,
the guide 2.0 MB; the zips, built on the branch before the merge: Windows 107.1 MB, Linux 103.7,
Apple Silicon 93.0, Intel 95.4, source 37.0 (682 files) -- about 1.5 MB each over 0.9.11, the
guide. Nothing else about the offline build changed. **Checked:** the full tests (1,564; none
failing) on the release commit's content, the packager's verification of every zip, all nine
builder journeys and the 41 smoke journeys on the branch's last code change. **Not played by a
person:** a built course with four or more tee sets in a round, tee markers on a narrow built tee,
Build it myself from a drawn box on the real services (TODO, *Release 0.9.12*).
