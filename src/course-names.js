// A NAME FOR A COURSE, SO NOBODY HAS TO INVENT ONE AT THE MOMENT THEY WANT TO
// PLAY.
//
// Every place that makes a course now asks for a name, which only works if the
// box is already filled with something a person would accept. The old
// suggestion was the biome's own title -- "Prairie Run" for every midwest course
// anyone ever built -- so a library of six courses read as six copies of four
// names. The one before that was the SEED, which is a serial number.
//
// SEEDED FROM THE COURSE, not from Math.random: the same course suggests the
// same name every time it is offered, so a name declined once and accepted a
// minute later is the same name, and two people with the same code see the
// same suggestion. It is only ever a suggestion -- the box is editable and
// whatever the player types is what gets saved.
import {rng as random} from './course-plan.js';

// Words that belong to the ground, by biome. A links course is not called
// "Saguaro" anything and a desert has no sound or inlet. The pairs are picked
// so that almost any first word reads against almost any second -- the few that
// come out flat are the price of not hand-writing several hundred full names.
// EXPORTED FOR ITS TEST, which checks a rule the lists cannot enforce
// themselves: two biomes may share a first word OR a second word, but never
// both, or the same name can come out of two different landscapes. "Cedar
// Hollow" was reachable from both the Pacific Northwest and the Midwest,
// because cedar and hollow each belong in both -- caught by the test, not by
// reading the lists.
export const NAME_WORDS = {
 pnw: [['Bandon', 'Cedar', 'Sitka', 'Harbour', 'Cascade', 'Douglas', 'Salmon', 'Fern', 'Rainier', 'Tofino'],
  ['Ridge', 'Bluff', 'Sound', 'Pines', 'Head', 'Point', 'Reach', 'Hollow', 'Bay', 'Landing']],
 desert: [['Saguaro', 'Copper', 'Mesa', 'Coyote', 'Adobe', 'Ocotillo', 'Sonora', 'Agave', 'Rincon', 'Vermilion'],
  ['Dunes', 'Wash', 'Flats', 'Canyon', 'Arroyo', 'Basin', 'Mesa', 'Rise', 'Springs', 'Draw']],
 mountain: [['Alpine', 'Granite', 'Glacier', 'Summit', 'Larch', 'Timber', 'Aspen', 'Chamonix', 'Cirque', 'Tarn'],
  ['Reserve', 'Pass', 'Bowl', 'Shelf', 'Saddle', 'Col', 'Meadows', 'Tarns', 'Crest', 'Basin']],
 links: [['North Sea', 'Fescue', 'Machair', 'Gorse', 'Kintyre', 'Brae', 'Seacliff', 'Dornoch', 'Marram', 'Haar'],
  ['Links', 'Dunes', 'Burn', 'Shore', 'Warren', 'Strand', 'Sands', 'Firth', 'Braes', 'Point']],
 midwest: [['Prairie', 'Bur Oak', 'Sycamore', 'Elmhurst', 'Wheatfield', 'Tallgrass', 'Walnut', 'Hawthorn', 'Bluestem', 'Fox River'],
  ['Run', 'Park', 'Meadows', 'Farms', 'Hollow', 'Grove', 'Fields', 'Crossing', 'Prairie', 'Creek']],
 island: [['Turtle', 'Coral', 'Lagoon', 'Trade Wind', 'Frangipani', 'Barracuda', 'Palm', 'Reef', 'Conch', 'Windward'],
  ['Bay', 'Cay', 'Reef', 'Shoals', 'Cove', 'Point', 'Passage', 'Sands', 'Lagoon', 'Strand']],
 redwood: [['Cathedral', 'Sequoia', 'Fog Belt', 'Sorrel', 'Eel River', 'Mist', 'Ancient', 'Redwood', 'Lupine', 'Hollow'],
  ['Grove', 'Stand', 'Glen', 'Hollow', 'Understory', 'Reach', 'Cathedral', 'Flat', 'Creek', 'Shade']],
 autumn: [['Copper', 'Maple', 'Amber', 'Harvest', 'Sumac', 'Russet', 'Chestnut', 'Bracken', 'Ember', 'Cider'],
  ['Hollow', 'Hill', 'Woods', 'Vale', 'Ridge', 'Orchard', 'Bend', 'Common', 'Glen', 'Stand']],
};
// A biome the list has not caught up with still gets a name. Deliberately
// generic rather than clever: a wrong-sounding name is worse than a plain one.
const FALLBACK = [['Fairway', 'Old', 'New', 'Stone', 'Willow', 'Heather', 'Blackthorn', 'Kestrel'],
 ['Park', 'Links', 'Course', 'Grove', 'Hollow', 'Ridge', 'Meadows', 'Green']];

// Occasionally a course is a Club or a Country Club rather than a place. Rare
// on purpose -- every third course being "... Golf Club" reads as a template.
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
 // "Mesa Mesa" and "Cathedral Cathedral" both come out of lists that share a
 // word on purpose -- the word is good in either position. Rolling again is
 // cheaper than pruning the lists and keeps both uses.
 if (b === a) b = second[(second.indexOf(b) + 1) % second.length];
 return `${a} ${b}${SUFFIXES[Math.floor(rng() * SUFFIXES.length)]}`;
}

// The name a course in play should be called when nobody has named it -- an
// endless run, a surprise course, a landscape still being shaped. Same function;
// it exists as its own name so the call sites read as what they mean.
export const autoCourseName = suggestCourseName;
