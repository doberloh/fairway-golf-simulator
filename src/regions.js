// EVERY LANDSCAPE, BUILT OR NOT, AND ITS REGION (the US landscapes goal, 2
// November 2026; the owner's plan, docs/studies/us-landscapes/PLAN.md, local).
//
// The game's landscapes are the regions of the USA -- eighteen regions, each
// holding one or more landscapes (Scottish Links, outside the map, left on 8 November 2026). A
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
//   us       on the map of the USA (every landscape since Scottish Links left)

export const REGIONS = {
 pnw: 'Pacific Northwest',
 redwood: 'Redwood Coast',
 mountain: 'Mountain West',
 // highdesert (High Desert) left with its last landscape, 8 November 2026; its traits in biomes.js stay unused.
 desert: 'Desert Southwest',
 california: 'California Coast',
 plains: 'Great Plains',
 // texas (Texas) left with its last landscape, 8 November 2026; its traits in biomes.js stay unused.
 south: 'The South',
 florida: 'Florida',
 // appalachia (Appalachians and Ozarks) left with its last landscape, 8 November 2026; its traits in biomes.js stay unused.
 northeast: 'Northeast',
 northwoods: 'North Woods',
 // lakeshore (Great Lakes Shore) left with Lake Dunes, 8 November 2026; its traits in biomes.js stay unused.
 links: 'Links',
 hawaii: 'Hawaii',
 // alaska (Alaska) left with its last landscape, 8 November 2026; its traits in biomes.js stay unused.
};

export const LANDSCAPES = {
 redwood: {name: 'Redwood Coast', region: 'redwood', where: [38.8, -123.5]},
 badlands: {name: 'Badlands', region: 'plains', where: [43.8, -102.3]},
 // The second of the US golf courses' 15: Augusta, Pinehurst and Pine Valley. Its place
 // is Pinehurst's.
 southpines: {name: 'Southern Pines', region: 'south', where: [35.19, -79.47]},
 // The third of the US golf courses' 15: Harbour Town, Sea Island and Kiawah. Its place
 // is Harbour Town's.
 lowgulf: {name: 'Lowcountry and Gulf', region: 'south', where: [32.13, -80.81]},
 // The fourth of the US golf courses' 15: Seminole and TPC Sawgrass. Its place is
 // Seminole's. Green all year like the Keys (`tropical`), PLACED.
 hiresort: {name: 'Hawaiian Resort', region: 'hawaii', where: [20.99,-156.65], tropical: true},
 dmountain: {name: 'Desert Mountain', region: 'desert', where: [33.79,-111.88]},
 dresort: {name: 'Desert Resort', region: 'desert', where: [36.12,-115.06]},
 pacnw: {name: 'Pacific Northwest', region: 'pnw', where: [47.62,-122.03]},
 calcoast: {name: 'California Coast', region: 'california', where: [36.57,-121.95]},
 seaside: {name: 'Seaside Links', region: 'links', where: [43.18,-124.39]},
 mountains: {name: 'Mountain', region: 'mountain', where: [38.97, -119.94]}, // Edgewood Tahoe (Castle Pines, 39.45, -104.87, is inside the High Plains' shape)
 prairie: {name: 'Prairie & Sand Hills', region: 'plains', where: [41.75,-100.9]},
 flpalms: {name: 'Florida Palms', region: 'florida', where: [26.84, -80.13], tropical: true}, // PGA National (was 26.88, -80.06, inside Lowcountry and Gulf's shape)
 // The first of the US golf courses' 15 (the owner, 5 November 2026): the Golden Age
 // parkland of Winged Foot, Oakmont and Muirfield Village. Its place is Winged Foot's.
 parkland: {name: 'Classic Parkland', region: 'northeast', where: [40.96, -73.76]},
 northwoods: {name: 'Northern Woods', region: 'northwoods', where: [44.65, -84.52]}, // Forest Dunes (was 44.8, -92.3, inside Classic Parkland's shape)
 // Outside the map: St Andrews.
};
for (const l of Object.values(LANDSCAPES)) { l.us ??= true; l.tropical ??= false; }

// The keys used before 2 November 2026, and the landscape each became (the
// study's data/names.json `today`). Haunted Hollow went to Autumn first
// (MIGRATIONS 14) and so on to New England. Used by the settings migration,
// built course files, the profile's landscapes and the weekly rotation.
// The landscapes Classic Parkland replaced (the owner, 6 November 2026) read as it from
// then on, through MIGRATIONS 28. Southern Pines' three, the same, through MIGRATIONS 30,
// and Lowcountry and Gulf's three through MIGRATIONS 32. Florida Palms, Hawaiian Resort and
// Desert Resort replaced five more through MIGRATIONS 37 (the owner, 7 November 2026).
export const OLD_KEYS = {pnw: 'pacnw', desert: 'dmountain', mountain: 'mountains', midwest: 'parkland',
 island: 'flpalms', autumn: 'parkland', lakeshore: 'seaside', haunted: 'parkland',
 newengland: 'parkland', oldnortheast: 'parkland', heartland: 'parkland', bluegrass: 'parkland',
 ozarks: 'parkland', crosstimbers: 'parkland',
 piedmont: 'southpines', longleaf: 'southpines', pinebarrens: 'southpines',
 lowcountry: 'lowgulf', bayou: 'lowgulf', gulfcoast: 'lowgulf',
 keys: 'flpalms', flatwoods: 'flpalms', hawaii: 'hiresort', desertresort: 'dresort', palms: 'dresort',
 puget: 'pacnw', monterey: 'calcoast', socal: 'calcoast', winecountry: 'calcoast', links: 'seaside', oregondunes: 'seaside', lakedunes: 'seaside',
 sonoran: 'dmountain', mojave: 'dmountain', chihuahuan: 'dmountain', redrock: 'dmountain',
 rockies: 'mountains', cascades: 'mountains', sierra: 'mountains', ponderosa: 'mountains', sagebrush: 'mountains', blueridge: 'mountains', alaska: 'mountains',
 sandhills: 'prairie', highplains: 'prairie', bluebonnet: 'prairie', hillcountry: 'prairie'};
export const currentKey = key => OLD_KEYS[key] || key;

export const regionOf = key => LANDSCAPES[currentKey(key)]?.region ?? null;
