// A NAME FOR A COURSE, SO NOBODY HAS TO INVENT ONE AT THE MOMENT THEY WANT TO
// PLAY.
//
// Every place that makes a course asks for a name, which only works if the box
// is already filled with something a person would accept. The suggestion before
// this was the biome's own title -- "Prairie Run" for every midwest course
// anyone ever built -- and the one before that was the SEED, a serial number.
//
// SEEDED FROM THE COURSE, not from Math.random: the same course suggests the
// same name every time it is offered, so a name declined once and accepted a
// minute later is the same name, and two people with the same code see the same
// suggestion. It is only ever a suggestion -- the box is editable and whatever
// the player types is what gets saved.
//
// NO WORD HERE MAY NAME A REAL GOLF DESTINATION.
//
// The first version of these lists carried Bandon, Dornoch, Kintyre and
// Saguaro, and the biome titles carried Bandon Ridge, Turtle Bay and Saguaro
// Dunes. A place name on its own is weak as a trade mark; a real resort's name
// on a course inside a golf product being SOLD is a different proposition, and
// avoiding it costs nothing. That rules out the links roll-call -- Dornoch,
// Turnberry, Troon, Carnoustie, Muirfield, Sandwich, Prestwick, Portrush,
// Lytham, Birkdale, Hoylake, Brora, Nairn, Gullane -- and the American
// equivalents. **Search a candidate word together with "golf" before adding
// it.** Ordinary geography is fine; ordinary geography that happens to be a
// famous course is not.
import {rng as random} from './course-plan.js';

// EXPORTED FOR ITS TEST, which checks two rules the lists cannot keep
// themselves: that no two biomes can produce the same name, and that no name
// can overflow the 40 characters the library accepts.
//
// The first rule is kept by one simple mechanism: **every FIRST word is unique
// to its biome.** Second words are shared freely -- a ridge is a ridge
// anywhere -- and that is safe precisely because the first words never collide.
// The original lists let both halves overlap, and "Cedar Hollow" was reachable
// from both the Pacific Northwest and the Midwest.
export const NAME_WORDS = {
 pnw: [
  ['Cedar', 'Sitka', 'Harbour', 'Cascade', 'Douglas', 'Salmon', 'Fern', 'Tofino',
   'Quinault', 'Skagit', 'Chinook', 'Hemlock', 'Driftwood', 'Cannon', 'Orca',
   'Madrona', 'Nootka', 'Tillamook', 'Alder', 'Rainier', 'Nehalem', 'Yaquina',
   'Foghorn', 'Basalt', 'Spruce', 'Saltspring', 'Breaker', 'Salmonberry',
   'Thimble', 'Rainfall'],
  ['Ridge', 'Bluff', 'Sound', 'Pines', 'Head', 'Point', 'Reach', 'Hollow', 'Bay',
   'Landing', 'Cove', 'Inlet', 'Narrows', 'Bend', 'Spit', 'Shore', 'Timber',
   'Crossing', 'Hook', 'Bar', 'Passage', 'Rise'],
 ],
 desert: [
  ['Mesa', 'Coyote', 'Adobe', 'Sonora', 'Agave', 'Rincon', 'Vermilion', 'Cholla',
   'Mesquite', 'Javelina', 'Yucca', 'Caliche', 'Gila', 'Ironwood', 'Tinaja',
   'Roadrunner', 'Sandstone', 'Kiva', 'Estrella', 'Creosote', 'Bajada', 'Mirage',
   'Tortoise', 'Sidewinder', 'Scorpion', 'Chuparosa', 'Hohokam', 'Saddlehorn',
   'Dust', 'Sunstone'],
  ['Dunes', 'Wash', 'Flats', 'Canyon', 'Arroyo', 'Basin', 'Rise', 'Springs',
   'Draw', 'Buttes', 'Rim', 'Sands', 'Gulch', 'Playa', 'Bench', 'Crossing',
   'Hollow', 'Ridge', 'Bluffs', 'Pass'],
 ],
 mountain: [
  ['Alpine', 'Granite', 'Glacier', 'Summit', 'Larch', 'Aspen', 'Cirque', 'Tarn',
   'Chamonix', 'Moraine', 'Talus', 'Cornice', 'Snowmelt', 'Ptarmigan', 'Marmot',
   'Avalanche', 'Bighorn', 'Icefall', 'Scree', 'Sawback', 'Stonecrop', 'Gentian',
   'Hoarfrost', 'Whitebark', 'Coldwater', 'Kestrel', 'Slate', 'Chalkstone',
   'Windgap', 'Snowline'],
  ['Reserve', 'Pass', 'Bowl', 'Shelf', 'Saddle', 'Meadows', 'Crest', 'Basin',
   'Spur', 'Notch', 'Corrie', 'Shoulder', 'Ledge', 'Steps', 'Ridge', 'Bench',
   'Hollow', 'Rise', 'Head', 'Glen'],
 ],
 links: [
  ['Fescue', 'Machair', 'Gorse', 'Brae', 'Seacliff', 'Marram', 'Haar', 'Tussock',
   'Whin', 'Thistle', 'Gannet', 'Fulmar', 'Eider', 'Skerry', 'Bothy', 'Kelpie',
   'Cairn', 'Corbie', 'Tern', 'Selkie', 'Bentgrass', 'Saltmarsh', 'Shingle',
   'Puffin', 'Lammas', 'Harrow', 'Kittiwake', 'Sheepfold', 'Seapink', 'Wrack'],
  ['Links', 'Dunes', 'Burn', 'Shore', 'Warren', 'Strand', 'Sands', 'Firth',
   'Braes', 'Point', 'Howe', 'Hillock', 'Bank', 'Head', 'Bay', 'Crossing',
   'Hollow', 'Rise', 'Reach', 'Bend'],
 ],
 midwest: [
  ['Prairie', 'Sycamore', 'Elmhurst', 'Wheatfield', 'Tallgrass', 'Walnut',
   'Hawthorn', 'Bluestem', 'Hickory', 'Cottonwood', 'Ironweed', 'Milkweed',
   'Goldenrod', 'Switchgrass', 'Coneflower', 'Osage', 'Shagbark', 'Silo',
   'Thresher', 'Meadowlark', 'Bobolink', 'Cornsilk', 'Windmill', 'Furrow',
   'Homestead', 'Pheasant', 'Burroak', 'Foxfield', 'Redwing', 'Threshold'],
  ['Run', 'Park', 'Meadows', 'Farms', 'Hollow', 'Grove', 'Fields', 'Crossing',
   'Creek', 'Bottoms', 'Rise', 'Flats', 'Commons', 'Acres', 'Draw', 'Bend',
   'Ridge', 'Lane', 'Prairies', 'Stand'],
 ],
 island: [
  ['Coral', 'Lagoon', 'Frangipani', 'Barracuda', 'Palm', 'Reef', 'Conch',
   'Windward', 'Leeward', 'Bonefish', 'Tarpon', 'Hibiscus', 'Plumeria',
   'Mangrove', 'Seagrape', 'Pelican', 'Frigate', 'Manta', 'Coconut', 'Banyan',
   'Sargasso', 'Lantana', 'Papaya', 'Tamarind', 'Calypso', 'Tradewind',
   'Anchorage', 'Parrotfish', 'Saltpond', 'Seafan'],
  ['Bay', 'Cay', 'Shoals', 'Cove', 'Point', 'Passage', 'Sands', 'Strand',
   'Flats', 'Hook', 'Bight', 'Landing', 'Reach', 'Rise', 'Bend', 'Crossing',
   'Shore', 'Head', 'Narrows', 'Bar'],
 ],
 redwood: [
  ['Cathedral', 'Sequoia', 'Fogbelt', 'Sorrel', 'Mist', 'Ancient', 'Redwood',
   'Lupine', 'Trillium', 'Salal', 'Huckleberry', 'Nurselog', 'Burl', 'Duff',
   'Swordfern', 'Chanterelle', 'Tanoak', 'Madrone', 'Wapiti', 'Titan',
   'Grandfather', 'Oldgrowth', 'Deerfern', 'Understory', 'Rainshadow',
   'Colonnade', 'Buttress', 'Fernbank', 'Mosswood', 'Twilight'],
  ['Grove', 'Stand', 'Glen', 'Hollow', 'Reach', 'Flat', 'Creek', 'Shade',
   'Canopy', 'Bottom', 'Ring', 'Bench', 'Rise', 'Crossing', 'Bend', 'Ridge',
   'Cloister', 'Walk', 'Clearing', 'Aisle'],
 ],
 autumn: [
  ['Copper', 'Maple', 'Amber', 'Harvest', 'Sumac', 'Russet', 'Chestnut',
   'Bracken', 'Ember', 'Cider', 'Scarlet', 'Crimson', 'Tamarack', 'Sassafras',
   'Persimmon', 'Quince', 'Bittersweet', 'Witchhazel', 'Beechnut', 'Acorn',
   'Rowan', 'Hazel', 'Woodsmoke', 'Lantern', 'Thatch', 'Stubble', 'Vesper',
   'Michaelmas', 'Ochre', 'Kindling'],
  ['Hollow', 'Hill', 'Woods', 'Vale', 'Ridge', 'Orchard', 'Bend', 'Common',
   'Glen', 'Stand', 'Lane', 'Bank', 'Coppice', 'Rise', 'Close', 'Crossing',
   'Meadows', 'Park', 'Reach', 'Fields'],
 ],
};
// A biome the lists have not caught up with still gets a name. Deliberately
// generic rather than clever: a wrong-sounding name is worse than a plain one.
const FALLBACK = [
 ['Fairway', 'Old', 'New', 'Stone', 'Willow', 'Heather', 'Blackthorn', 'Kestrelwood',
  'Bramble', 'Elder', 'Hollybush', 'Greenway'],
 ['Park', 'Links', 'Course', 'Grove', 'Hollow', 'Ridge', 'Meadows', 'Green',
  'Common', 'Rise', 'Crossing', 'Bend'],
];

// Occasionally a course is a Club rather than a place. Rare on purpose -- every
// third course being "... Golf Club" reads as a template.
const SUFFIXES = ['', '', '', '', '', '', '', ' Golf Club', ' Country Club', ' Golf Links'];

// NAMED FOR THE GROUND THE PLAYER WILL SEE, not for the settings. A course is
// identified by its seed and its biome, which is exactly what stays the same
// when the same code is opened twice.
export function suggestCourseName(settings = {}) {
 const biome = NAME_WORDS[settings.biome] ? settings.biome : null;
 const [first, second] = biome ? NAME_WORDS[biome] : FALLBACK;
 const rng = random(`name:${settings.seed ?? ''}:${settings.biome ?? ''}`);
 const a = first[Math.floor(rng() * first.length)];
 let b = second[Math.floor(rng() * second.length)];
 // A biome may hold the same word in both halves -- "Rise" reads well in either
 // position -- so the collision is resolved rather than the word given up.
 if (b === a) b = second[(second.indexOf(b) + 1) % second.length];
 return `${a} ${b}${SUFFIXES[Math.floor(rng() * SUFFIXES.length)]}`;
}

// How many distinct names a biome can produce. Exported because "are the lists
// big enough" is a question worth being able to answer with a number rather
// than an impression -- which is how they got expanded in the first place.
export function nameCount(biome) {
 const [first, second] = NAME_WORDS[biome] ?? FALLBACK;
 return first.length * second.length * new Set(SUFFIXES).size;
}

// The name a course in play should be called when nobody has named it -- an
// endless run, a surprise course, a landscape still being shaped. Same function;
// it exists as its own name so the call sites read as what they mean.
export const autoCourseName = suggestCourseName;
