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

`RESEARCH.md` and `LANDSCAPE_RESEARCH.md` distinguish mathematical/design references from software dependencies. Research-informed physics is an approximation, not a measured/calibrated claim. The U.S. Copyright Office distinguishes copyrightable program expression from functional algorithms and logic; citing a paper does not by itself grant permission to copy its code, figures or text. See [Copyright Office Circular 61](https://www.copyright.gov/circs/circ61.pdf).

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

Run the normal tests appropriate to changes, then `npm run build` and `python3 tools/package_release.py` (Windows: `py tools/package_release.py`). Python 3 is needed only for ZIP packaging, not playing or building the browser app. The packager uses an explicit file allowlist, refuses stale source builds or missing embedded notices, verifies every archived file against its source, and writes `RELEASE_SHA256.txt`. It excludes local saves, screenshots, credentials, `.git`, caches and `node_modules`. See the script when adding a new source/document directory.

For each release, update this dated review and the dependency inventory when dependencies change, preserve all license texts and origin comments, and repeat the advisory/device checks. Keep independent records of newly acquired code/assets and their exact licenses. Do not treat this review as clearance for later changes.

---

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
- The `file://` open path was not re-verified on this pass. It is the central
  portability claim and should be exercised by hand before the archive goes to
  anyone.
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

### What this addendum does NOT claim

- **The `file://` open is still unverified on a current build.** It is the
  central portability claim and it has now been carried across three addenda
  without being exercised. Open the rebuilt portable archive by hand.
- No new similarity or provenance search was run. The limits recorded in the
  September 11 review and in the commercial-use pass apply unchanged.
- Two publication decisions are recorded in TODO.md and are not settled here:
  whether `vendor/baked_assets/` (106 MB, the largest thing in the tree, read
  by nothing at build time) belongs in a public repository, and who the
  copyright holder on `LICENSE` should actually be.
