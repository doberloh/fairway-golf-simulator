// A NAME FOR EVERY HOLE (architect-courses, phase 2; the study, workstream P).
// "The Cape", "Long Pond", "Home": real clubs name their holes for what they
// are -- the water, the bend, the length -- or for the land. (An Architect
// course's template holes -- the Redan, the Cape -- were named for their
// template until the designer was removed, 2 November 2026.) A name is read
// from a hole that is already built,
// so nothing generated moves (it is not in the world and not fingerprinted).
//
// SEEDED, so the same course names its holes the same way every time; every
// name on a course is different. Pure: tests/hole-names.test.mjs.
//
// NO NAME HERE MAY BE A FAMOUS HOLE'S OWN. A single hole's nickname -- the Postage Stamp, Amen Corner, the Road
// Hole, Hell -- is someone's, and is not used.
import {rng} from './course-plan.js';

// The landscape's own words for its country, used where a hole has nothing of
// its own to be named for.
const LAND = {
 puget: ['Cedars', 'Fern Gully', 'Mossbank', 'The Sound', 'Hemlock', 'Driftwood', 'Salal', 'Sitka', 'Mist'],
 sonoran: ['Mesa', 'Sagebrush', 'Red Rock', 'Arroyo', 'Sundial', 'Coyote', 'Quail', 'Ocotillo', 'Dry Wash'],
 rockies: ['Summit', 'Scree', 'Snowmelt', 'High Meadow', 'Larch', 'Lookout', 'Tarn', 'Marmot', 'Cirque'],
 links: ['Dunes', 'Gorse', 'Whins', 'Marram', 'Seaside', 'Skylark', 'Sandhills', 'Tide', 'Lang Whang'],
 heartland: ['Prairie', 'Bur Oak', 'Big Sky', 'Bluestem', 'Meadowlark', 'Windbreak', 'Cornerpost', 'Thunder', 'Homestead'],
 keys: ['Reef', 'Lagoon', 'Palms', 'Trade Wind', 'Coral', 'Frigate', 'Sea Grape', 'Lighthouse Point', 'Shallows'],
 redwood: ['Giants', 'Cathedral', 'Fern Hollow', 'Elk Meadow', 'Old Growth', 'Sorrel', 'Nurse Log', 'Burl', 'Twin Trunks'],
 newengland: ['Maples', 'Copper', 'Harvest', 'Stone Wall', 'Cider Mill', 'Russet', 'Orchard', 'Woodsmoke', 'Steeple'],
 lakedunes: ['Beacon', 'Dune Ridge', 'Beach Grass', 'Cottonwood', 'Shoreline', 'Gull', 'Juniper', 'Breakwater', 'Lake View'],
 highplains: ['Elevator', 'Shelterbelt', 'Big Sky', 'Grama', 'Windbreak', 'Section Line', 'Pumpjack', 'Thunderhead', 'Creekside'],
 sandhills: ['Windmill', 'Blowout', 'Stock Tank', 'Soapweed', 'Choppy Sand', 'Lone Cedar', 'Sharptail', 'Hay Meadow', 'Ranch Gate'],
 oldnortheast: ['Copper Beech', 'Elm Walk', 'Fieldstone', 'Gatehouse', 'Old Oak', 'Ivy', 'Quarry', 'Carriage Road', 'Steeple'],
 pinebarrens: ['Pitch Pine', 'Scrub Oak', 'Bayberry', 'Heath', 'Windmill', 'Salt Meadow', 'Cranberry Bog', 'Sound View', 'Sand Road'],
 alaska: ['Fireweed', 'Black Spruce', 'Glacier View', 'Moose Run', 'Birch', 'Muskeg', 'Midnight Sun', 'Willow', 'Raven'],
 longleaf: ['Longleaf', 'Wiregrass', 'Pine Straw', 'Turkey Oak', 'Sandhill', 'Bobwhite', 'Firebreak', 'Gopher Hole', 'Resin'],
 piedmont: ['Red Clay', 'Dogwood', 'Magnolia', 'Tulip Poplar', 'Azalea', 'Mill Creek', 'Kudzu', 'Shoals', 'Sweetgum'],
 lowcountry: ['Live Oak', 'Spartina', 'Oyster Bed', 'Palmetto', 'Egret', 'Tidal Creek', 'Spanish Moss', 'Rice Field', 'Marsh View'],
 bayou: ['Bald Cypress', 'Tupelo', 'Levee', 'Pirogue', 'Crawfish', 'Cypress Knees', 'Spanish Moss', 'Sugar Mill', 'Slow Water'],
 flatwoods: ['Slash Pine', 'Saw Palmetto', 'Cabbage Palm', 'Sawgrass', 'Cypress Dome', 'Gator Lake', 'Orange Grove', 'Sandhill Crane', 'White Sand'],
 hillcountry: ['Cedar Break', 'Limestone', 'Live Oak', 'Mountain Laurel', 'Spring Fed', 'Caliche', 'Redbud', 'Low Water Crossing', 'Bluebonnet'],
 bluebonnet: ['Bluebonnet', 'Paintbrush', 'Pecan Bottom', 'Hedge Row', 'Cedar Elm', 'Black Dirt', 'Meadowlark', 'Stock Tank', 'Big Sky'],
 gulfcoast: ['Live Oak', 'Bayou Bend', 'Cordgrass', 'Heron', 'Loblolly', 'Wax Myrtle', 'Shell Road', 'Gulf Breeze', 'Spoonbill'],
 mojave: ['Joshua Tree', 'Creosote', 'Dry Lake', 'Granite', 'Yucca', 'Smoke Tree', 'Tortoise', 'Beavertail', 'Long Shadow'],
 palms: ['Fan Palm', 'Date Grove', 'Oleander', 'Oasis', 'Windbreak', 'Bougainvillea', 'Mountain View', 'Desert Willow', 'Palm Row'],
 chihuahuan: ['Lechuguilla', 'Sotol', 'Soaptree', 'Ocotillo', 'Alligator Juniper', 'Caliche', 'Javelina', 'Emory Oak', 'Big Sky'],
 monterey: ['Lone Cypress', 'Sea Stack', 'Ice Plant', 'Headland', 'Fog Bank', 'Kelp Bed', 'Sea Otter', 'Monterey Pine', 'Breakers'],
 socal: ['Barranca', 'Sycamore', 'Chaparral', 'Jacaranda', 'Santa Ana', 'Torrey Pine', 'Eucalyptus', 'Coastal Sage', 'Canyon Rim'],
 winecountry: ['Old Vine', 'Valley Oak', 'Blue Oak', 'Poppy', 'Crush', 'Olive Row', 'Barrel', 'Harvest', 'Terroir'],
 cascades: ['Noble Fir', 'Snow Cone', 'Beargrass', 'Basalt', 'Huckleberry', 'Larch', 'Glacier View', 'Timberline', 'Cloud Cap'],
 sierra: ['Sugar Pine', 'Granite', 'Red Fir', 'Manzanita', 'Incense Cedar', 'Mule Ear', 'Snowmelt', 'High Lake', 'Dome'],
 ponderosa: ['Ponderosa', 'Gambel Oak', 'Cinder', 'Basalt', 'Bitterbrush', 'Mahogany', 'Elk Tank', 'Rim View', 'Snowbowl'],
 sagebrush: ['Sagebrush', 'Rimrock', 'Coulee', 'Balsamroot', 'Bunchgrass', 'Juniper', 'Rabbitbrush', 'Scabland', 'Dry Falls'],
 redrock: ['Hoodoo', 'Slickrock', 'Pinyon', 'Cliffrose', 'Red Fin', 'Arch View', 'Blackbrush', 'Desert Varnish', 'Globemallow'],
 crosstimbers: ['Post Oak', 'Blackjack', 'Pump Jack', 'Red Dirt', 'Red Cedar', 'Barbed Wire', 'Indian Blanket', 'Section Line', 'Creek Bottom'],
};
const GENERIC = ['Meadow', 'Ridge', 'Hollow', 'Brook', 'Glen', 'Crest', 'Knoll', 'Spinney', 'Copse'];

// What a hole can be called, best first: its water; its bend;
// its length; then the land.
function candidates(h, i, n, biome) {
 const out = [];
 if (i === n - 1) out.push('Home');
 if (n === 18 && i === 8) out.push('Halfway', 'The Turn');
 if (i === 0) out.push(['First', 'Starter', 'Opening', 'Off We Go'][Math.floor((h.length || 0) * 7) % 4]);
 if (h.ponds?.length) {
  const water = biome === 'links' ? ['Burn', 'Lochan'] : biome === 'keys' ? ['Lagoon', 'Salt Pond'] : biome === 'rockies' ? ['Tarn', 'Snowmelt Pond'] : ['Pond', 'Mere', 'Waterside', 'Long Pond', 'Lily Pond'];
  out.push(...water);
 }
 const bend = Math.abs(h.doglegAngle || 0);
 if (bend > 12) out.push(bend > 30 ? 'Elbow' : 'Corner', h.doglegAngle > 0 ? 'Left Turn' : 'Right Turn', 'Dogleg');
 const yards = h.tees?.blue?.yards ?? (h.length || 0) / .9144;
 if (h.par === 3) out.push(yards < 150 ? 'Wee One' : yards > 205 ? 'Long Iron' : 'Short');
 if (h.par === 5) out.push(yards > 560 ? 'Long Haul' : 'Long');
 if (h.par === 4 && yards < 350) out.push('Temptation', 'Short Four');
 const sand = (h.bunkers || []).length;
 if (sand >= 7) out.push('Sandy', 'Bunkers', 'Sandpit');
 const own = LAND[biome] || GENERIC;
 out.push(...own, ...GENERIC);
 return out;
}

// The names of a course's holes, in order: `holes` are the built holes (any
// designer); `settings` gives the seed and landscape. Every name different;
// each hole takes the first of its own candidates not yet used, after a
// seeded shuffle of the land's words so two courses on one landscape differ.
export function holeNames(holes = [], settings = {}) {
 const r = rng(`${settings.seed || 'EVERGREEN'}|hole-names|${settings.biome || ''}`), used = new Set(), names = [];
 const n = holes.length;
 holes.forEach((h, i) => {
  const list = candidates(h, i, n, settings.biome);
  // The land's words and the generic ones come last; shuffle them, keep the
  // hole's own (its water, bend, length) first.
  const own = LAND[settings.biome] || GENERIC, tailFrom = list.findIndex(x => own.includes(x) || GENERIC.includes(x));
  const head = tailFrom < 0 ? list : list.slice(0, tailFrom), tail = tailFrom < 0 ? [] : list.slice(tailFrom);
  // The land's own words before the generic ones, each shuffled.
  const shuffle = a => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  tail.splice(0, tail.length, ...shuffle(tail.filter(x => own.includes(x))), ...shuffle(tail.filter(x => !own.includes(x))));
  // One in three holes skips its own feature for a word of the land, so a
  // course is not all Ponds and Corners.
  const order = head.length && !['Home', 'Halfway', 'First', 'Starter', 'Opening', 'Off We Go'].includes(head[0]) && r() < .33 ? [...tail, ...head] : [...head, ...tail];
  let name = order.find(x => !used.has(x));
  if (!name) { let k = 2; while (used.has(`${own[0]} ${k}`)) k++; name = `${own[0]} ${k}`; }
  used.add(name);
  names.push(name);
 });
 return names;
}

// For tests/landscapes-complete.test.mjs: every landscape has its words.
export {LAND as LAND_WORDS};
