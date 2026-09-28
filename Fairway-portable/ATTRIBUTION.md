# Attribution

Fairway ships geometry derived from third-party 3D model packs. Every pack below
is **CC0 1.0 Universal (Public Domain Dedication)**, verified from the licence
file distributed inside the pack itself rather than from a web page. CC0 imposes
no attribution requirement; these creators ask for credit as a courtesy and this
file gives it.

| Pack | Author | Licence | Source |
|---|---|---|---|
| Nature Kit (2.1) — 329 models | [Kenney](https://kenney.nl) | CC0 1.0 | https://kenney.nl/assets/nature-kit |
| City Kit Suburban (2.0) — 40 models | [Kenney](https://kenney.nl) | CC0 1.0 | https://kenney.nl/assets/city-kit-suburban |
| Building Kit (1.0) — 79 models | [Kenney](https://kenney.nl) | CC0 1.0 | https://kenney.nl/assets/building-kit |
| Ultimate Nature Pack (Jun 2019) — 150 models | [Quaternius](https://quaternius.com) | CC0 1.0 | https://quaternius.com/packs/ultimatenature.html |
| Ultimate Stylized Nature (May 2022) — 63 models | [Quaternius](https://quaternius.com) | CC0 1.0 | https://quaternius.com/packs/ultimatestylizednature.html |
| Stylized Nature MegaKit (Standard) — 68 models | [Quaternius](https://quaternius.com) | CC0 1.0 | https://quaternius.com/packs/stylizednaturemegakit.html |

Licence text: https://creativecommons.org/publicdomain/zero/1.0/

## Grown geometry, which is nobody else's at all

The redwood biome now draws **only** from that folder -- no pack model, no
imported texture, nothing borrowed. The other seven biomes are unchanged and
still use the CC0 packs above.


`vendor/grown-redwood-forest/` contains no imported vertex and no texture. Every
triangle is produced by `tools/grow.mjs` and `tools/grow-lib.mjs`, which are
this project's own code, so nothing in that folder carries a third-party
licence of any kind.

Its shapes and colours were measured from 315 photographs on Wikimedia
Commons, all CC0, public domain, or CC BY / CC BY-SA. **None of those images
is in this repository and none was copied into a model** -- they were read
and measured, and the numbers that came out are facts about redwoods rather
than anybody's expression. REFERENCES.md lists every one of them anyway.

## Generated geometry, which is not CC0

`vendor/baked_assets/` is **generated, not vendored**. `node tools/bake-trees.mjs`
produces it from [ez-tree](https://github.com/dgreenheck/ez-tree) by Daniel
Greenheck, which is **MIT**, a devDependency, and never ships -- what ships is
the geometry it produced. Unlike CC0, MIT *requires* its copyright notice be
kept, so the notice is vendored at `vendor/baked_assets/LICENSE-ez-tree.txt`
and reproduced with any distribution.

Two textures come with it, and they are the only imported images in the project
besides the house atlases:

- `needles.png` and `broadleaf.png` are ez-tree's own leaf sprite sheets (its
  pine and ash), copied unchanged and covered by its MIT licence. They are here
  because a leaf billboard is a cut-out: without an alpha mask it is a solid
  rectangle.
`vendor/baked_assets/stylized_needles.png` is a copy of Ultimate Stylized
Nature's `PineTree_Leaves.png`, sitting beside the generated models that use
it. Same pack, same CC0 licence, copied so the folder is self-contained.

**Verified 25 September 2026 against the built file**: the only imported images that ship are four Kenney house atlases at 12 KB each. No leaf sprite ships -- `broadleaf` appears in the build as a species family name, not as a file -- and no texturecan asset is present anywhere in the tree. No fonts and no audio ship.

**No bark images are taken.** Trunks are painted: the generated models state a
bark colour and the game paints every surface from the biome palette anyway, so
ez-tree's bark maps -- two of them Poly Haven CC0, two from texturecan whose
terms were never checked -- are all left where they are.

Everything else imported is still stripped of its materials and repainted from
the biome palette.

Kenney's licence files state: *"You can use this content for personal,
educational, and commercial purposes. Support by crediting 'Kenney' or
'www.kenney.nl' (this is not a requirement)."* Quaternius ships the CC0 1.0
Universal dedication and asks that support go through
[Patreon](https://www.patreon.com/quaternius).

## What actually ships

Not the packs. `tools/build-meshes.mjs` reads the vendored `.glb` files and
emits `src/asset-meshes.js`, which carries **geometry only**:

- Every source material is discarded. The packs colour surfaces with a
  `baseColorFactor` per material; each is classified by name into a role —
  bark, leaf, stone, dirt, accent — and the running game paints those roles from
  the biome palette. That is what lets one imported pine serve all seven biomes
  instead of importing somebody else's art direction along with the mesh.
- Positions are quantised to int16 against a model normalised to unit height and
  centred on x/z; normals to int8.
- 152 of the 733 available models are used. The rest are not shipped. A family may
  keep only part of a model: the redwood and fir crowns ship as leaf geometry with
  their trunks dropped, because the trunk under them is drawn rather than imported.
- The **house models are the one exception to materials being discarded**: unlike
  the nature kits they carry a shared texture atlas rather than a colour per
  material, so their UVs survive and `colormap.png` (11 KB) ships with them.
  Tinting them by role alone would flatten a whole house to a single colour.
  Kenney's three recoloured variations ship alongside the default atlas (four
  files, 12 KB each): each is a palette grid, so every roof drawn from one atlas
  is the same swatch, and spreading houses across all four is what varies roof
  and wall colour down a street.

Kenney supplies the bulk. Quaternius is drawn on **only where Kenney has no
counterpart** — five cacti and three dead trees for the desert biome, and for the
redwood forest floor seven mossy boulders, five leafy ground plants and four logs
and stumps with moss on them. Its models carry several times the vertices, so
taking coverage we already had cost about a megabyte of packed geometry for no
visible gain, and was reverted.

Three of the four Quaternius/Kenney nature packs share model names — `Plant_1`
exists in three of them and means something different in each — so a name the
ingest cannot resolve to one pack is an error rather than first-match-wins.

The complete packs live in `vendor/` as the provenance record and the input to
the ingestion step. **`vendor/` is not part of the build and not part of the
release archives** — `tools/package_release.py` packages `src`, `tests`,
`bridge` and `tools` only, and nothing in `src/` imports from it.

**The portable archive ships the bridge bundled**: `Launch monitor/fairway-bridge.mjs`
carries the bridge, the game's own physics and **ws** (MIT) in one file, with
a banner naming ws and pointing at THIRD_PARTY_NOTICES.txt, which carries its
licence and ships beside it.

## Regenerating

```
node tools/build-meshes.mjs
```

Reads `vendor/<pack>/*.glb` and `*.obj`, writes `src/asset-meshes.js`. Re-run
after changing the model selection in `PICK`.

## Icons

The home-screen and tab icons in `public/` and `index.html` are the project's
own flag mark -- the brandmark path already in the page, plus a dot -- drawn by
`tools/make-icons.mjs`. No third-party image is used.

## Trade marks

**GSPro**, **Garmin**, **Rapsodo**, **SkyTrak**, **PiTrac**, **Foresight** and
**Trackman** are named in this project, and in the software itself, only to
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
