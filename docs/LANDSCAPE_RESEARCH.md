# Fairway landscape and routing research

Research checked September 10, 2026. These are fictional generated courses. Aerial photography and published course maps informed the design; the app does not copy course imagery, surveyed elevations, or proprietary course geometry. The design choices below are interpretations of those references, not replicas or botanical identification models.

## Vegetation and landforms

| Biome | Reference and observation | Implemented direction |
| --- | --- | --- |
| Pacific Northwest | Olympic's coastal forest mixes conifers, red alder, shrubs, and ferns. [NPS coastal forest](https://www.nps.gov/olym/learn/nature/coastal-forest.htm), [North Cascades ferns](https://www.nps.gov/noca/learn/nature/ferns.htm) | Several conifer silhouettes, drooping cedar sprays, alder canopies, fern understory, forested ridges and cool light. |
| Desert | Sonoran vegetation includes trees and shrubs as well as cacti. Palo verde has green bark; ocotillo has many stems. [NPS Sonoran plants](https://www.nps.gov/cagr/learn/kidsyouth/what-grows-in-the-sonoran-desert.htm), [Organ Pipe trees and shrubs](https://www.nps.gov/orpi/learn/nature/treesandshrubs.htm?fullweb=1) | Ribbed saguaros, palo verde with small yellow flowers, spreading mesquite, red-tipped ocotillo, blue-green rosettes, rocky inter-hole terrain. |
| Mountain | Montane landscapes combine meadows, pine/fir forests, and aspen groves. [Rocky Mountain NPS](https://www.nps.gov/romo/learn/nature/montane_ecosystem.htm) | Pine, spruce and pale-barked aspen, low scrub and flowers. Rocky ridges rise between lower playing corridors. |
| Links | Dunes include moving sand ridges, marram, fixed grassland, heath, and wet slacks. [NatureScot dunes](https://www.nature.scot/landscapes-and-habitats/habitat-types/coast-and-seas/coastal-habitats/sand-dunes), [Tentsmuir](https://www.nature.scot/doc/tentsmuir-nnr-visiting-reserve-leaflet) | Large rolling dunes, golden grass, purple heath-like shrubs, yellow gorse-like blooms, and occasional small coastal pines. |
| Midwest | Oak savanna combines broad trees, tall grasses, and diverse wildflowers. [NPS prairie and savanna plants](https://www.nps.gov/miss/learn/nature/plants-prairie.htm) | Oak, maple, aspen, shrubs, flowering meadow patches, and gentler parkland terrain. |
| Island | Hawaiian coastal references include hala, naupaka, and culturally introduced coconut palms. [NPS hala](https://www.nps.gov/places/hala-grove.htm), [NPS coconut](https://www.nps.gov/articles/000/polynesian-heritage-plants-niu.htm), [NPS native plants](https://www.nps.gov/puho/learn/nature/native-plants.htm) | Tall palms, shorter hala-like crowns with prop roots, low naupaka-like shrubs, pale shorelines, shallow shelves and water channels between groups of holes. |
| Autumn | Northeastern forests mix deciduous trees with evergreen spruce and fir. [Acadia forests](https://www.nps.gov/acad/learn/nature/forests.htm), [Acadia plant list](https://home.nps.gov/acad/learn/nature/common-native-plants.htm) | Red maple-like, copper oak-like, and golden aspen-like canopies, pale trunks, dark evergreen accents, and rolling woodland. |
| Haunted Hollow | **No reference landscape.** A Halloween invention (9 October 2026), not a region: nothing was read or measured for it, and every number in its record is placed (RESEARCH, *Haunted Hollow, the ninth biome*). | Full fantasy since the owner's second pass: purple fairways, violet rough, slime-green greens, dark green water; gnarled dead oaks, tall pale snags and dead willows over dark bramble; giant solid pumpkins (most carved and lit after dark) and toadstools; ghosts over every hole; from dusk a harvest moon, bats round the tall trees and will-o'-the-wisps over the water; heavy fog, a low orange sun. |

The procedural plants approximate regional growth forms using sculpted Cartoon geometry. There are no downloaded plant assets. Conifers, broadleaves, palms, succulents and shrubs retain distinct shapes and colors.

## Aerial and course-map references

- **Northwest:** [Bandon Trails and its aerial map](https://bandondunesgolf.com/golf/golf-courses/bandon-trails-golf-course/) — transitions between dunes, meadow and forest; changing directions within a connected routing.
- **Desert:** [Renegade course map](https://www.desertmountain.com/wp-content/uploads/2021/06/course-map-renegade.pdf) and [We-Ko-Pa Saguaro aerial photography](https://www.pjkoenig.com/wekopa-saguaro) — curved turf ribbons separated by natural desert, with strategically placed bunkers.
- **Mountain:** [Banff Springs Golf Club aerial](https://www.banffspringsgolfclub.com/) — fairways share a valley while forest and rocky slopes separate the playing corridors. The club's aerial image was inspected in the browser.
- **Links:** [Whistling Straits course map](https://www.kohlerwisconsin.com/content/dam/kohler-destinations/pdf_resource/dk/golf/whistling-straits/GolfCourseMaps_Straits.pdf) — shore-oriented routing, nearby parallel stretches interspersed with turns, and green complexes among dunes.
- **Midwest:** [Cog Hill Dubsdread layout and course tour](https://coghillgolf.com/course-no-4/) — compact parkland routing and heavily defended greens.
- **Island:** [Turtle Bay property map](https://www.turtlebayexperiences.com/sites/default/files/2024-04/TBR_SimpleFoldedPocketMap_101123%20%281%29.pdf) and [Palmer Course aerial gallery](https://www.golfpass.com/travel-advisor/galleries/turtle-bay-resorts-palmer-course-a-great-way-to-tour-oahus-scenic-north-shore) — coastal outlines, ponds and vegetation define playable space. Fairway's archipelago is an intentional creative extension, not the actual Turtle Bay routing.
- **Autumn:** [Sugarloaf aerial photography](https://www.sugarloaf.com/events/swig-and-swing) — contrasting hardwood colors, bends, water, and greenside bunkers in a forest setting.

## How this changes the generator

The old grid has been replaced with seeded corridor packing. Candidate holes use different bearings and tee positions near the preceding green. Sampled corridor clearances reject overlapping routes, and a compactness/return-distance score chooses among several complete routings. An exceptional fallback places a corridor beyond the existing footprint rather than permitting an overlap. This is a playable procedural routing heuristic, not a certified golf-course architecture or safety model.

Each par 4/5 can receive a rounded dogleg; frequency, maximum turn, and turning position are adjustable. Par 5s can have an additional bend. Landforms rise outside the protected playing corridors. Island groups are separated by channels, and the minimap reflects the generated shoreline. Changing the biome or landscape controls and pressing Generate & play rebuilds the terrain, routing, vegetation, and hazards together.

Lakes use local water elevations. Each basin's deepest point is selected between the minimum and maximum depth; the shoreline naturally approaches zero depth. Coastal floors also stay within the maximum setting. The nearest water body receives live planar scenery reflections; other water bodies use environment reflections, limiting the cost of showing the whole course.

Bunker count is an upper target: unsafe overlaps can reduce it. The greenside gap measures clearance outside the fringe. Bunkers can touch that boundary at a zero setting without covering the green. A shared hazard mask keeps turf edges crisp when bunkers enter semi rough or fairway.


## Variable fairway width and a more textured landscape

[ASGCA's Winter 2025 By Design discussion of the double-triangle concept](https://www.tudor-rose.co.uk/asgca/bydesign/2025/winter/index.html) describes generous landing areas and more demanding lines for longer hitters. The [ASGCA Merion renovation drawings](https://asgca.org/wp-content/uploads/2016/06/By_Design_-_Issue_15__Summer_2013.pdf) show local shifts and changes in fairway width near hazards and approaches. Fairway's interpretation is a seeded sequence of broader landing shelves, dogleg pockets, and narrower approach necks. The width slider defines the overall scale; it does not hold a constant width along the hole. Routing clearances and the minimap use the actual generated widths.

Elevation severity now affects the playing corridors by tens of metres, while tees and greens retain gentle local surfaces. Regional ground details combine procedural grain with grass geometry and pine-straw patches. Grass and canopy wind deformation operates in world units after instancing. Flags wave and clouds drift; foliage is still visual rather than a ball-collision surface.


## Continuous terrain and Cartoon refinement

Cartoon is now the only selectable presentation; old saves migrate to it. Grass is actual wind-animated instanced geometry: complete-course patches plus fine near-camera rough and semi-rough blades. Links receives taller, denser golden meadow grass between playing corridors. Seeded litter patches occur beneath selected pine, spruce and cedar trees; playable turf takes precedence over litter coloring. Fairway sides have independent shape profiles, with conservative routing bounds enclosing both. The in-fairway bunker slider controls the probability for each non-greenside bunker.

Terrain modifiers now have continuous world-space support rather than switching at the nearest-hole boundary. All playable surfaces use one connected ground mesh and per-fragment surface colors, removing intersecting fairway/rough/sand overlays. The background terrain stays below the playable interior. Bunker bowls blend to a flatter floor below their low rim; ponds have level surfaces and flat deepest areas matching the chosen depth. The mesh and contact model share the same triangles. A sampled route lookup approximates rendered fairway contours at 1.25 m longitudinal spacing; physical classification remains analytic, so tiny boundary differences can remain at high curvature.
