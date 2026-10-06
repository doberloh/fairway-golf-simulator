# Distribution and provenance review

Reviewed September 11, 2026. **Dependency delta re-checked and archives rebuilt 25 September 2026 — see the addendum at the foot.** Applies to the source and rebuilt archives accompanying this file. This is an engineering provenance/license review, not a legal opinion, exhaustive plagiarism search, trademark clearance, or security certification.

## Outcome

The review found attribution omissions and corrected them. It found no evidence of an unlicensed copied application or proprietary asset pack in the inspected project. Known incorporated code has licenses permitting redistribution, including distribution supported by optional donations, subject to retaining its notices. The owner selected **MIT** for Fairway's own code and documentation. `LICENSE` records that choice using the collective credit “Fairway contributors”; third-party material retains its original terms.

Both ZIPs include the project license, third-party notices, installation instructions and this review. The single-file HTML embeds the full project license and third-party notices in **Help → Open source & credits**, so copying just the HTML retains them. The source download is the preferred editable form. Donations are optional support for development; no payment service, donation account, checkout or public release has been configured.

This is suitable packaging for an experimental public preview, with the outstanding validation items below disclosed. It is not a claim of a production-certified simulator.

## What was checked

- Project source/imports, optional bridge, asset inventory, research documents, package manifest and all 50 package entries in the lockfile, including platform-specific optional packages.
- Third-party 3D geometry: Fairway now ships mesh data derived from six **CC0 1.0** model packs (Kenney Nature Kit, Kenney City Kit Suburban, Kenney Building Kit, Quaternius Ultimate Nature Pack, Quaternius Ultimate Stylized Nature, Quaternius Stylized Nature MegaKit). Each licence was verified from the licence file inside the distributed pack, not from a web page. CC0 requires no attribution; **ATTRIBUTION.md** credits them anyway and records exactly what is and is not shipped. Only geometry ships — all source materials and colours are discarded at ingestion and replaced by biome-palette roles — and only 96 of 729 available models are used. The full packs sit in `vendor/` as provenance and are excluded from both the build and the release archives.
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
| Vite 8.3.0 / Rolldown 1.2.8 helpers | Small generated helpers in browser output | MIT; core helper notices added |
| ez-tree 1.1.0 | Build tool only; **its output geometry ships** | MIT. Runs at bake time in `tools/bake-trees.mjs`, never in the game. The trees it generates from our parameters go into `vendor/` and through the same ingest as the CC0 packs; credited in ATTRIBUTION.md with its notice vendored beside the output |
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

The imported-material footprint of the shipped HTML is **four PNGs, 12 KB each,
64 KB in total**: Kenney house colour atlases (`colormap` plus three
variations), CC0. Kenney's licence text states the content is free to use in
personal, educational **and commercial** projects, with credit appreciated and
not required. Quaternius ships the CC0 1.0 dedication.

Everything else imported is **geometry with its materials stripped at ingest**
and repainted from the biome palette. Verified this pass rather than assumed:

- **No texturecan textures ship**, and none are present in the tree. ATTRIBUTION
  flags them as the one asset whose terms were never checked; they are ez-tree's
  bark maps, and no bark image is taken because trunks are painted.
- **No ez-tree leaf sprite ships.** `broadleaf` appears 14 times in the build as
  a species *family* name, not as the sprite file.
- **No fonts ship.** `--font-display` and `--font-ui` are system stacks
  (Georgia / Times New Roman, Inter / system sans). No `@font-face` anywhere, so
  no font binary is distributed and naming a face in a CSS stack distributes
  nothing.
- **No audio of any kind** exists in the project.
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
Garmin, Rapsodo, SkyTrak, PiTrac, Foresight, Trackman -- belong to their
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
  SkyTrak named as the held-out check -- see RESEARCH.md *The website: what it
  claims*. Not "calibrated", not "certified", and no device beyond those two
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

Not set, on purpose: a required status check (the tests workflow has never
run on GitHub), deleting merged branches, and immutable releases.

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

