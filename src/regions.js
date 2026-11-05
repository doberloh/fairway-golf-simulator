// EVERY LANDSCAPE, BUILT OR NOT, AND ITS REGION (the US landscapes goal, 2
// November 2026; the owner's plan, docs/studies/us-landscapes/PLAN.md, local).
//
// The game's landscapes are the regions of the USA -- eighteen regions, each
// holding one or more landscapes -- plus Scottish Links, outside the map. A
// landscape's record in biomes.js lays its own entries over its region's
// (`REGION` there), so it states only what differs.
//
// This table is the whole list, including the landscapes not yet built: the
// clickable map draws every region and marks the unbuilt ones as coming.
// `BIOME_KEYS` (settings-schema.js) is the list a player may pick -- the built
// ones; tests/landscapes-complete.test.mjs holds every built one complete.
//
//   key      stored in every saved course, round, challenge and file: short,
//            lower-case, NEVER renamed once shipped (the old keys -- pnw,
//            desert, mountain, midwest, island, autumn, lakeshore -- go
//            through settings-schema.js MIGRATIONS 17)
//   name     the player's name (the study's data/names.json, approved by the
//            owner on 2 November 2026)
//   region   one of REGIONS
//   where    [latitude, longitude] of the landscape: the median of the study's
//            reference courses for it (Alaska, Hawaii and Scotland a city) --
//            the dot on its thumbnail's globe
//   tropical one green look the year round (seasons.js)
//   us       on the map of the USA (Scottish Links is not)

export const REGIONS = {
 pnw: 'Pacific Northwest',
 redwood: 'Giant Redwood',
 mountain: 'Mountain West',
 highdesert: 'High Desert',
 desert: 'Desert Southwest',
 california: 'California Coast',
 midwest: 'Midwest',
 plains: 'Great Plains',
 texas: 'Texas',
 south: 'The South',
 florida: 'Florida',
 appalachia: 'Appalachians and Ozarks',
 northeast: 'Northeast',
 northwoods: 'North Woods',
 lakeshore: 'Great Lakes Shore',
 links: 'Links',
 hawaii: 'Hawaii',
 alaska: 'Alaska',
};

export const LANDSCAPES = {
 puget: {name: 'Puget Sound', region: 'pnw', where: [47.3, -122.6]},
 redwood: {name: 'Redwood Coast', region: 'redwood', where: [38.8, -123.5]},
 cascades: {name: 'Cascades', region: 'mountain', where: [45.7, -121.9]},
 sierra: {name: 'High Sierra', region: 'mountain', where: [39.3, -120.2]},
 rockies: {name: 'Rockies', region: 'mountain', where: [43.6, -110.8]},
 ponderosa: {name: 'Ponderosa', region: 'mountain', where: [35.1, -111.7]},
 sagebrush: {name: 'Sagebrush', region: 'highdesert', where: [47.7, -118.5]},
 redrock: {name: 'Red Rock', region: 'highdesert', where: [37.1, -109.5]},
 sonoran: {name: 'Sonoran', region: 'desert', where: [33.6, -111.7]},
 mojave: {name: 'Mojave', region: 'desert', where: [36.4, -114.9]},
 palms: {name: 'Desert Palms', region: 'desert', where: [33.7, -116.3]},
 desertresort: {name: 'Desert Resort', region: 'desert', where: [36.15, -115.2]},
 chihuahuan: {name: 'Chihuahuan', region: 'desert', where: [31.8, -106.3]},
 monterey: {name: 'Monterey', region: 'california', where: [37.0, -122.0]},
 socal: {name: 'SoCal Canyons', region: 'california', where: [34.0, -117.8]},
 winecountry: {name: 'Wine Country', region: 'california', where: [38.4, -121.4]},
 heartland: {name: 'Heartland', region: 'midwest', where: [42.5, -86.2]},
 sandhills: {name: 'Sand Hills', region: 'plains', where: [41.9, -100.8]},
 highplains: {name: 'High Plains', region: 'plains', where: [38.1, -97.8]},
 crosstimbers: {name: 'Cross Timbers', region: 'plains', where: [36.1, -97.2]},
 badlands: {name: 'Badlands', region: 'plains', where: [43.8, -102.3]},
 hillcountry: {name: 'Hill Country', region: 'texas', where: [30.5, -98.1]},
 bluebonnet: {name: 'Bluebonnet Prairie', region: 'texas', where: [32.7, -96.7]},
 gulfcoast: {name: 'Gulf Coast', region: 'texas', where: [29.8, -95.5]},
 longleaf: {name: 'Longleaf Pines', region: 'south', where: [35.2, -79.4]},
 piedmont: {name: 'Piedmont', region: 'south', where: [33.9, -82.0]},
 lowcountry: {name: 'Lowcountry', region: 'south', where: [32.1, -80.8]},
 bayou: {name: 'Bayou', region: 'south', where: [29.9, -90.2]},
 flatwoods: {name: 'Florida Flatwoods', region: 'florida', where: [28.4, -81.5]},
 keys: {name: 'Keys', region: 'florida', where: [25.8, -81.7], tropical: true},
 blueridge: {name: 'Blue Ridge', region: 'appalachia', where: [36.1, -81.8]},
 ozarks: {name: 'Ozarks', region: 'appalachia', where: [36.6, -93.2]},
 bluegrass: {name: 'Bluegrass', region: 'appalachia', where: [38.2, -84.5]},
 newengland: {name: 'New England', region: 'northeast', where: [44.3, -71.4]},
 oldnortheast: {name: 'Old Northeast', region: 'northeast', where: [41.0, -74.3]},
 pinebarrens: {name: 'Pine Barrens', region: 'northeast', where: [40.9, -72.4]},
 northwoods: {name: 'North Woods', region: 'northwoods', where: [44.8, -92.3]},
 lakedunes: {name: 'Lake Dunes', region: 'lakeshore', where: [43.8, -86.5]},
 oregondunes: {name: 'Oregon Dunes', region: 'links', where: [44.0, -124.1]},
 hawaii: {name: 'Hawaii', region: 'hawaii', where: [20.8, -156.3], tropical: true},
 alaska: {name: 'Alaska', region: 'alaska', where: [61.2, -149.9]},
 // Outside the map: St Andrews.
 links: {name: 'Scottish Links', region: 'links', where: [56.3, -2.8], us: false},
};
for (const l of Object.values(LANDSCAPES)) { l.us ??= true; l.tropical ??= false; }

// The keys used before 2 November 2026, and the landscape each became (the
// study's data/names.json `today`). Haunted Hollow went to Autumn first
// (MIGRATIONS 14) and so on to New England. Used by the settings migration,
// built course files, the profile's landscapes and the weekly rotation.
export const OLD_KEYS = {pnw: 'puget', desert: 'sonoran', mountain: 'rockies', midwest: 'heartland',
 island: 'keys', autumn: 'newengland', lakeshore: 'lakedunes', haunted: 'newengland'};
export const currentKey = key => OLD_KEYS[key] || key;

export const regionOf = key => LANDSCAPES[currentKey(key)]?.region ?? null;
