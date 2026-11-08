# Attribution

Every model Fairway draws is this project's own work, made by its own scripts
in Blender (*Built in Blender*, below). No third-party model pack, texture,
sprite or sound ships. What does come from elsewhere is code and one
typeface -- three.js, Lucide, ws, Saira Condensed and a few short algorithms,
and in the course builder's page laz-perf (the LAZ decoder, Apache-2.0)
-- and their licences are in `docs/THIRD_PARTY_NOTICES.txt`, which travels
with every distribution and is shown in the game under Help.

Until the cartoon overhaul (merged 27 October 2026) the game also carried
geometry from CC0 model packs and from trees generated with ez-tree (MIT).
The overhaul remade every one of those models, and the packs and the tools
that read them were removed from the repository on 27 October 2026. Releases
up to 0.9.4 carry their own ATTRIBUTION.md and notices for what they shipped.

## Generated with Meshy

`vendor/blender-meshy_redwood/` holds 28 tree models, the Redwood Coast's redwoods,
firs, hemlocks, red cedars and tanoaks, `vendor/blender-meshy_parkland/` 22, Classic
Parkland's oaks, maples, poplars, elm and spruces, `vendor/blender-meshy_southern/` 16,
Southern Pines' pines and dogwoods, `vendor/blender-meshy_lowcountry/` 12, Lowcountry and
Gulf's live oaks, bald cypresses and sabal palms, `vendor/blender-meshy_florida/` 8, Florida
Palms' coconut and royal palms, `vendor/blender-meshy_hawaiian/` 12, Hawaiian Resort's Cook pines, ironwoods
and monkeypods, `vendor/blender-meshy_deserttarget/` 16, Desert Mountain's (Desert Target until 7 November) saguaros, palo verde and
mesquite, and `vendor/blender-meshy_desertres/` 24, Desert Resort's pines, willows, olives and palms, `vendor/blender-meshy_northwest/` 20, the Pacific Northwest's Douglas firs, western red cedars, hemlocks, bigleaf maples and red alders, `vendor/blender-meshy_calcoast/` 20, the California Coast's Monterey cypresses and pines, Torrey pines, coast live oaks and eucalyptus, `vendor/blender-meshy_seaside/` 4, Seaside Links' shore pines, and `vendor/blender-meshy_redwood2/` 12, the Redwood Coast's redwoods, young redwoods and tanoaks (7 November 2026). The full models were generated on Meshy's paid
Pro plan (https://www.meshy.ai), under which the output is private with full
commercial use, then converted, and the far versions rebuilt from them, by this
project's own tools (`tools/meshy-run.mjs`, `tools/blender/meshy_*.py`). The pictures they
were made from came through Meshy from gpt-image-2. No credit is required on that plan.

## Built in Blender, which is this project's own work

Every `vendor/blender-cartoon_*/` folder (the painted broadleaves, conifers,
redwoods, boulders, shrubs, grasses, brush, desert and island plants,
Lakeshore's plants, the deadfall, the
houses and their gardens, the wildflowers and the course furniture, and the
far twins) is written by `tools/blender/cartoon_*.py`, `tools/blender/cartoon.py`
and `tools/blender/fairway_blender.py`, this project's own scripts, run in
Blender. Every vertex comes from those scripts; nothing is imported, no
texture is used, and no Blender asset library is touched. Blender itself
(GPL) is a tool here, not a dependency: it is not in the game, the build or
the tests, and what a GPL program outputs is not covered by its licence. So
these models are under this repository's MIT licence like the rest of its
code. Every such model is named `Blender_*` (docs/BLENDER_ASSETS.md).

The turf detail atlas (`src/turf-detail.js`) is painted by
`tools/turf-detail.mjs`, this project's own code: nothing to license.

## What actually ships

Not the `.glb` files. `tools/build-meshes.mjs` reads them and emits
`src/asset-meshes.js`, which carries **geometry and vertex paint only**:

- Every source material is discarded. Each surface is classified by its
  material name into a role -- bark, leaf, stone, dirt, accent -- and the
  running game paints those roles from the biome palette, scaled by the
  model's own vertex paint.
- Positions are quantised to int16 against a model normalised to unit height
  and centred on x/z; normals to int8.
- 232 models are used (`node tools/build-meshes.mjs`, 27 October 2026), every
  one of them from a `vendor/blender-cartoon_*/` folder.

**`vendor/` is not part of the build and not part of the release archives**
-- `tools/package_release.py` packages `src`, `tests`, `bridge` and `tools`
only, and nothing in `src/` imports from it.

**The portable archive ships the bridge bundled**: `Launch monitor/fairway-bridge.mjs`
carries the bridge, the game's own physics and **ws** (MIT) in one file, with
a banner naming ws and pointing at THIRD_PARTY_NOTICES.txt, which carries its
licence and ships beside it.

## Regenerating

```
node tools/build-meshes.mjs
```

Reads `vendor/<pack>/*.glb`, writes `src/asset-meshes.js`. Re-run after
changing the model selection in `PICK` or rebuilding a pack in Blender
(`npm run blender -- <pack>`).

No fonts beyond the one below and no audio files ship. The game's sounds (13
October 2026) are synthesised by its own code (`src/sound.js`), so there is no
sound asset to credit.

## Icons

The home-screen and tab icons in `public/` and `index.html` are the project's
own flag mark -- the brandmark path already in the page, plus a dot, over the
start splash's leaning green band since the 1.0 look (18 October 2026) -- drawn
by `tools/make-icons.mjs`. No third-party image is used.

## Trade marks

**GSPro**, **rēlā**, **Garmin**, **Rapsodo**, **SkyTrak**, **PiTrac**,
**Foresight**, **FlightScope**, **Full Swing**, **Square**, **Nova**, **GolfJoy**
and **Trackman** are named in this project, and in the software itself, only to
describe what Fairway can talk to or what a measurement was taken on. That is
nominative use: a product may be named in order to say what it is compatible
with.

All trade marks, product names and company names are the property of their
respective owners. **No affiliation, sponsorship, endorsement, certification
or hardware-compatibility guarantee is claimed or implied by any of them.**
The connector paths Fairway can accept are protocol-level integrations; device
firmware, vendor licences, connector versions and operating systems all affect
whether any given one works, and none of that has been verified against
physical hardware.

## The range's PDF report names a font; it ships none

The PDF report (`src/pdf.js`, 16 October 2026) asks the reader for Helvetica
and Helvetica-Bold, the standard faces every PDF reader supplies, so no font
file is embedded in the report or shipped with Fairway. The only thing taken is
a table of character widths, from Adobe's published metrics for those faces,
used to line text up (REFERENCES.md, *The range's PDF report*).

## The 1.0 interface's typeface: Saira Condensed

The 1.0 interface (branch `ui-1-0`, from 17 October 2026) is set in **Saira
Condensed** by The Saira Project Authors (Omnibus-Type, per the licence's
copyright line), licensed under the **SIL Open Font License 1.1**. Two files ship, inlined into
the page: Bold (700) and ExtraBold (800), Latin subset, woff2, unmodified as
Google Fonts distributes them (version 12, through `@fontsource/saira-condensed`
5.3.0). They live in `src/fonts/` with the licence (`OFL.txt`) beside them,
and the licence is reproduced in THIRD_PARTY_NOTICES.txt.

| Typeface | Authors | Licence | Source |
|---|---|---|---|
| Saira Condensed (700, 800; Latin) | The Saira Project Authors (Omnibus-Type) | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/sairacondensed |

"Saira" is a Reserved Font Name: a modified copy would have to be renamed.
Fairway ships the files unmodified. Distribution review, *Addendum, 17 October
2026: the 1.0 interface's typeface*, has what was checked.

## The map of the landscapes and the globe: public-domain data

Since 2 November 2026 (the US landscapes goal) the game carries
`src/us-map-data.js`, written by `tools/us-map.mjs`:

- **The landscapes' shapes** are the U.S. Environmental Protection Agency's
  *Level III Ecoregions of the Continental United States* (us_eco_l3, 2013
  edition; a U.S. government work, public domain), grouped into the
  landscapes by the project's own study, simplified and projected.
- **Alaska's and Hawaii's outlines and the globe's land** are Natural Earth's
  1:50m states and provinces and 1:110m land (https://www.naturalearthdata.com,
  public domain; Natural Earth asks no credit and welcomes one: "Made with
  Natural Earth").
- The map's projection uses the parallels and inset placings of d3-geo's
  `geoAlbersUsa` (Mike Bostock, ISC licence) -- numbers only; the
  projection is written here from Snyder's Albers equal-area formulas, and no
  d3 code ships.
