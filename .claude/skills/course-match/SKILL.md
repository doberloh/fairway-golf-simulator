---
name: course-match
description: Match a real golf course to the Fairway landscape that suits it best. Give it a course (a name and a state or country, an OpenStreetMap link, coordinates, or a .fairway file); it locates the course, researches its ground, trees, grasses, rock, water and relief, scores it against every built landscape, and recommends one -- or, when none fits, follows the US landscapes study's research path and writes a plan to build a new landscape. Use when the owner asks which landscape a course should be built on, or sends a course to evaluate.
---

# Matching a course to a landscape

The owner, 3 November 2026: "turn the US landscapes docs into a skill that I
can send in a course, you would evaluate the course. Do research, and
recommend the best biome to match. If there is no matches, and we need to
build a new one, the skill would follow the research paths we have set up to
gather data about what would need to be built and put together a plan to
build it."

The research path is the US landscapes study's (docs/studies/us-landscapes/,
local, never committed: README.md indexes it, catalogue.json is the source of
truth, tools/ holds the scripts). The game's side is src/biomes.js (each
landscape's record, its `TERRAIN` and `GRASSES`), src/regions.js
(`LANDSCAPES`: names, regions, places) and docs/RESEARCH.md.

Write to the owner in plain words (AGENTS.md, last section). Nothing here
touches the graphics card except the optional pictures in step 7, which go
through the gate (tools/gpu-run.mjs).

## 1. Pin the course down

- From a name: search OpenStreetMap (`leisure=golf_course` by name in its
  state, as docs/studies/us-landscapes/tools/locate-courses.mjs does; Nominatim
  as the fallback, one request a second). Confirm it is the right course: the
  same town, 9 or 18 holes, the website if OpenStreetMap carries one.
- From a .fairway file: its `source` (EPSG and origin) and `landscape`.
- Write down: the name, the OpenStreetMap way or relation, latitude and
  longitude, the architect and year if found.

## 2. Where it sits on the partition

`landscapeAt(lat, lon)` in docs/studies/us-landscapes/tools/lookup.mjs reads
map/partition.geojson (EPA level III ecoregions grouped into the study's
sub-landscapes, plus the hand-drawn overlays that win over them). Note the
sub-landscape and its game key (catalogue.json `subs[].key`), and its
neighbours on the map: a course near an edge may belong to either side.
Outside the USA the partition says nothing; go straight to step 4.

## 3. Research the course itself

Search for (and quote, with links, in the answer): the course's own website
and course tour, reviews and rankings that describe the land (links, dunes,
parkland, heathland, desert, mountain, canyon, lava, badlands), aerial and
ground pictures, the trees on it and around it (by species where possible),
the rough's grasses, bunkers' sand, rock and outcrops, water (sea, lake,
creeks, ponds), and the elevation change (the survey, if LIDAR exists:
tools/lidar-home.mjs and the builder's door 2 fetch 3DEP). Climate: rain and
snow, which decide the seasons (src/seasons.js `WINTER`).

## 4. Score every built landscape

For each landscape in src/biomes.js (start with the partition's answer, its
region's siblings and any whose look the research suggests):

| Criterion | Weight | Read from |
| --- | --- | --- |
| Region and place | 2 | src/regions.js `where`, the partition |
| Terrain | 3 | biomes.js `landform`/`TERRAIN`, `hills`, `ringLift`, RESEARCH *Terrain true to place* |
| Trees and shrubs | 3 | biomes.js `plants`, `stands`; catalogue.json `subs[].models`, `reuses` |
| Grasses and ground | 2 | `longGrass` (`GRASSES`), `landform.kinds`, `groundTints` |
| Water and coast | 1 | `sea`, `edgeCoast`, `coastal`, lakes |
| Rock and colours | 1 | `rock`, `rockStyle`, `strata`, palette |
| Climate and seasons | 1 | `temperature`, `seasons.js WINTER` |

Score each 0-3 and show the top three with their reasons -- what matches and
what does not ("pines right, but its ground is flat where the course runs
through 40 m breaks").

What the first trial (Whistling Straits, 3 November 2026; the record is
docs/studies/us-landscapes/trials/, local) showed:

- **Place and look can split.** A course built to look like somewhere else
  (Pete Dye's Irish links pushed up on a Wisconsin airfield) can score
  highest on its place's landscape and on the look's, a point apart. Say
  both, and let how it will be built decide.
- **A builder course brings its own trees** (the survey's, `whose trees`),
  so for one the trees row counts for less; for a generated course in the
  course's spirit, the landscape's own planting is all there is.
- Famous courses carry repeated numbers nobody sourced (bunker counts,
  animals on the course): mark them unconfirmed rather than repeat them.

## 5. Recommend

- **A good match** (the best scores at least 70% of the maximum and nothing
  important is wrong): name the landscape (its player name and key), why,
  what will differ from the real course, and how to build it: the builder's
  door 2 (OpenStreetMap traced, the LIDAR's land), **Skin from the land** for
  its steep ground (src/builder/skin.js), trees from the survey, and which
  landscape to pick in the editor. tools/build-courses.mjs builds one from
  the command line the same way (add an entry; `skin: true` to skin it).
- **A near match**: the best landscape and the tuning a new landscape *of
  that region* would need (a LAND entry laid over the region's record:
  different trees, a terrain recipe, colours) -- usually cheaper than a new
  region.
- **No match**: step 6.

## 6. No match: plan a new landscape by the study's path

Follow what the Badlands did (docs/RESEARCH.md *The Dakota Badlands*;
docs/studies/us-landscapes/tools/add-badlands.mjs is the model script):

1. **Research** the place: geology and landforms, vegetation (trees, shrubs,
   grasses, flowers -- by species, with where each grows), climate, wildlife,
   the colours of its rock and soil, two to six real courses there. Record
   every source with its figures (AGENTS.md *External research goes into
   RESEARCH.md*); a number not found is PLACED.
2. **Catalogue it** (a script like add-badlands.mjs, run from the study
   folder): a `subs[]` entry (parent region, name, look, ground, ecoregions or
   an `overlays` polygon, courses, reuses, models, systems, streets), its
   short name and key in data/names.json (`tools/apply-names.mjs` checks the
   keys), the new models with notes and Wikipedia titles, their specs
   (specs-plants.json: height, width, form, leaf, bark, bloom, four seasons;
   specs-built.json for rock and buildings).
3. **Locate its courses** (`TRIES=1 node tools/locate-courses.mjs`; a course
   OpenStreetMap does not name gets `at` by hand) and **redraw the map**
   (`node tools/build-map.mjs`, then `node tools/map-png.mjs`).
4. **Pictures**: model searches in data/model-queries.json, then
   `MODEL=<id> node tools/model-photos.mjs gather`, `sheets`, pick by eye
   into data/model-picks.json, and `MODEL=<a>,<b> node tools/model-photos.mjs
   keep` (**always with MODEL=** -- a bare keep refetches every model); the
   landscape: data/landscape-queries.json, `SUB=<id> node
   tools/landscape-photos.mjs gather`, `sheets`, picks, `keep`; the courses:
   `node tools/photos.mjs courses`. Then `node tools/pages.mjs`.
5. **The plan**, written to docs/studies/<key>/PLAN.md (local): the
   landscape's record (region, palette, the terrain recipe -- an existing
   landforms.js recipe with settings, or a new one, and why), its planting,
   long grass, rock and strata, world (clubhouse, path, walls, landmark,
   wildlife), the Blender pack (every new model, its silhouette, its
   variants and far twins, fifteen rounds each against its pictures --
   docs/BLENDER_ASSETS.md), what reuses existing models, the version steps it
   owes (SCHEMA for the new key, GENERATOR if shared code moves), its tests
   (tests/landscapes-complete.test.mjs and the rest), the frame-rate A/B on
   Low, and an estimate of the work.
6. **Stop and show the owner** the plan and the pictures. Building it is
   the owner's call (an idea is not permission: AGENTS.md *Ideas live in
   IDEAS.md* -- add it there if the owner does not pick it now).

## 7. Optional: show it

With the owner's go, a generated nine on the recommended landscape
(`node tools/capture/biome-shots.mjs take <key> --label match`, through
tools/gpu-run.mjs with the branch's limits) beside the course's own
pictures, sent with SendUserFile.

## The answer's shape

1. The course, found (name, place, links).
2. What it is like (the research, in a few plain sentences, with sources).
3. The recommendation (landscape, why, what will differ) -- or "no match"
   and the plan's summary.
4. How to build it in Fairway.
