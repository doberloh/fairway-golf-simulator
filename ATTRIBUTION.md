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

Licence text: https://creativecommons.org/publicdomain/zero/1.0/

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
- 95 of the 598 available models are used. The rest are not shipped.
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

The complete packs live in `vendor/` as the provenance record and the input to
the ingestion step. **`vendor/` is not part of the build and not part of the
release archives** — `tools/package_release.py` packages `src`, `tests`,
`bridge` and `tools` only, and nothing in `src/` imports from it.

## Regenerating

```
node tools/build-meshes.mjs
```

Reads `vendor/<pack>/*.glb` and `*.obj`, writes `src/asset-meshes.js`. Re-run
after changing the model selection in `PICK`.
