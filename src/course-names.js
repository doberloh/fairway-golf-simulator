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
 puget: [
  ['Cedar', 'Sitka', 'Harbour', 'Cascade', 'Douglas', 'Salmon', 'Fern', 'Tofino',
   'Quinault', 'Skagit', 'Chinook', 'Hemlock', 'Driftwood', 'Cannon', 'Orca',
   'Madrona', 'Nootka', 'Tillamook', 'Alder', 'Rainier', 'Nehalem', 'Yaquina',
   'Foghorn', 'Basalt', 'Spruce', 'Saltspring', 'Breaker', 'Salmonberry',
   'Thimble', 'Rainfall'],
  ['Ridge', 'Bluff', 'Sound', 'Pines', 'Head', 'Point', 'Reach', 'Hollow', 'Bay',
   'Landing', 'Cove', 'Inlet', 'Narrows', 'Bend', 'Spit', 'Shore', 'Timber',
   'Crossing', 'Hook', 'Bar', 'Passage', 'Rise'],
 ],
 sonoran: [
  ['Mesa', 'Coyote', 'Adobe', 'Sonora', 'Agave', 'Rincon', 'Vermilion', 'Cholla',
   'Mesquite', 'Javelina', 'Yucca', 'Caliche', 'Gila', 'Ironwood', 'Tinaja',
   'Roadrunner', 'Sandstone', 'Kiva', 'Estrella', 'Creosote', 'Bajada', 'Mirage',
   'Tortoise', 'Sidewinder', 'Scorpion', 'Chuparosa', 'Hohokam', 'Saddlehorn',
   'Dust', 'Sunstone'],
  ['Dunes', 'Wash', 'Flats', 'Canyon', 'Arroyo', 'Basin', 'Rise', 'Springs',
   'Draw', 'Buttes', 'Rim', 'Sands', 'Gulch', 'Playa', 'Bench', 'Crossing',
   'Hollow', 'Ridge', 'Bluffs', 'Pass'],
 ],
 rockies: [
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
 heartland: [
  ['Prairie', 'Sycamore', 'Elmhurst', 'Wheatfield', 'Tallgrass', 'Walnut',
   'Hawthorn', 'Bluestem', 'Hickory', 'Cottonwood', 'Ironweed', 'Milkweed',
   'Goldenrod', 'Switchgrass', 'Coneflower', 'Osage', 'Shagbark', 'Silo',
   'Thresher', 'Meadowlark', 'Bobolink', 'Cornsilk', 'Windmill', 'Furrow',
   'Homestead', 'Pheasant', 'Burroak', 'Foxfield', 'Redwing', 'Threshold'],
  ['Run', 'Park', 'Meadows', 'Farms', 'Hollow', 'Grove', 'Fields', 'Crossing',
   'Creek', 'Bottoms', 'Rise', 'Flats', 'Commons', 'Acres', 'Draw', 'Bend',
   'Ridge', 'Lane', 'Prairies', 'Stand'],
 ],
 keys: [
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
 newengland: [
  ['Copper', 'Maple', 'Amber', 'Harvest', 'Sumac', 'Russet', 'Chestnut',
   'Bracken', 'Ember', 'Cider', 'Scarlet', 'Crimson', 'Tamarack', 'Sassafras',
   'Persimmon', 'Quince', 'Bittersweet', 'Witchhazel', 'Beechnut', 'Acorn',
   'Rowan', 'Hazel', 'Woodsmoke', 'Lantern', 'Thatch', 'Stubble', 'Vesper',
   'Michaelmas', 'Ochre', 'Kindling'],
  ['Hollow', 'Hill', 'Woods', 'Vale', 'Ridge', 'Orchard', 'Bend', 'Common',
   'Glen', 'Stand', 'Lane', 'Bank', 'Coppice', 'Rise', 'Close', 'Crossing',
   'Meadows', 'Park', 'Reach', 'Fields'],
 ],
 // Halloween words. Each was searched with "golf" (9 October 2026); Scarecrow
 // and Phantom were dropped -- Scarecrow is a real course at Gamble Sands, and
 // there is a Phantom Lake Golf Club.
 // Lake Michigan's shore: its dune plants, its water and its harbours. Each
 // was searched with "golf" (23 October 2026, REFERENCES); Black Oak,
 // Starboard, Lakebreeze, Shoal, Agate and Lakeshore were dropped -- each is
 // a real course or the start of a famous one.
 lakedunes: [
  ['Beacon', 'Beachgrass', 'Sandreed', 'Sandcherry', 'Foredune', 'Blowout',
   'Lakewind', 'Seiche', 'Breakwater', 'Pierhead', 'Jackpine', 'Plover',
   'Sandbar', 'Freshwater', 'Duneline', 'Wavecrest', 'Bearberry', 'Puccoon',
   'Silverweed', 'Shorebird', 'Gullwing', 'Sundown', 'Ripple', 'Sailcloth',
   'Driftline', 'Undertow', 'Freighter', 'Lightkeeper', 'Sandwort', 'Lakelight'],
  ['Dunes', 'Bluff', 'Point', 'Beach', 'Ridge', 'Swale', 'Strand', 'Landing',
   'Pier', 'Light', 'Hollow', 'Reach', 'Bay', 'Bowl', 'Crest', 'Overlook',
   'Sands', 'Woods', 'Narrows', 'Cove'],
 ],
 // Phase 3 of the US landscapes goal (2 November 2026).
 highplains: [
  ['Buffalo', 'Grama', 'Shortgrass', 'Elevator', 'Pumpjack', 'Shelterbelt',
   'Meadowhawk', 'Pronghorn', 'Dryland', 'Wheatland', 'Windbreak', 'Section',
   'Tumbleweed', 'Sodbuster', 'Haymeadow', 'Prairiehen', 'Longhorn', 'Cimarron',
   'Thunderhead', 'Stockyard', 'Flatiron', 'Plainsong', 'Railhead', 'Grassland',
   'Harrier', 'Fencepost', 'Wagonwheel', 'Sunflower', 'Harvestmoon', 'Prairiefire'],
  ['Flats', 'Draw', 'Table', 'Rise', 'Crossing', 'Section', 'Ridge', 'Creek',
   'Bend', 'Plains', 'Breaks', 'Run', 'Divide', 'Junction', 'Range', 'Station',
   'Line', 'Fork', 'Gap', 'Mesa'],
 ],
 sandhills: [
  ['Soapweed', 'Blowsand', 'Sandbur', 'Stocktank', 'Aermotor', 'Ranchhand',
   'Hackberry', 'Choppy', 'Redcedar', 'Lark', 'Sharptail', 'Lonetree',
   'Bunchgrass', 'Sandsage', 'Crane', 'Calving', 'Haystack', 'Spurline',
   'Wildrose', 'Coyotegrass', 'Prickly', 'Needlegrass', 'Branding', 'Saddle',
   'Lowland', 'Rawhide', 'Openrange', 'Grassdune', 'Stirrup', 'Cattleguard'],
  ['Hills', 'Valley', 'Lake', 'Blowout', 'Ranch', 'Table', 'Swale', 'Range',
   'Knob', 'Basin', 'Pasture', 'Meadow', 'Spring', 'Draw', 'Flat', 'Ridge',
   'Pocket', 'Rise', 'Bottom', 'Sandhill'],
 ],
 oldnortheast: [
  ['Elmcrest', 'Ivywood', 'Brookline', 'Copperbeech', 'Fieldstone', 'Gatehouse',
   'Linden', 'Chestnuthill', 'Tudor', 'Greystone', 'Hawthorne', 'Millbrook',
   'Orchardwood', 'Quarry', 'Rectory', 'Steeplechase', 'Thornbury', 'Whitestone',
   'Carriage', 'Larchmont', 'Oakhurst', 'Mapleridge', 'Ridgewood', 'Saddlebrook',
   'Stonebridge', 'Wainscot', 'Highgate', 'Ashgrove', 'Kingsbury', 'Boxwood'],
  ['Hill', 'Park', 'Hall', 'Manor', 'Brook', 'Glen', 'Green', 'Downs', 'Heights',
   'Commons', 'Chase', 'Wood', 'Lane', 'Meadow', 'Court', 'Vale', 'Hollow',
   'Grange', 'Farm', 'Close'],
 ],
 pinebarrens: [
  ['Pitchpine', 'Scruboak', 'Bayberry', 'Beachplum', 'Heathland', 'Sandplain',
   'Saltmeadow', 'Cranberry', 'Bogiron', 'Tidewater', 'Osprey', 'Shakeroof',
   'Saltbox', 'Sound', 'Ironstone', 'Eelgrass', 'Broomsedge', 'Swamppink',
   'Inkberry', 'Pinesap', 'Teaberry', 'Sweetfern', 'Shadbush', 'Marshhawk',
   'Pinesnake', 'Barrens', 'Cedarbog', 'Firebreak', 'Seabreeze', 'Fogline'],
  ['Hills', 'Neck', 'Plain', 'Heath', 'Barrens', 'Pond', 'Point', 'Harbor',
   'Hollow', 'Ridge', 'Landing', 'Bog', 'Moor', 'Shore', 'Run', 'Bluff',
   'Woods', 'Inlet', 'Dunes', 'Meadow'],
 ],
 alaska: [
  ['Fireweed', 'Blackspruce', 'Iceworm', 'Moose', 'Tundra', 'Aurora', 'Musher',
   'Sourdough', 'Caribou', 'Denali', 'Chugach', 'Talkeetna', 'Matanuska',
   'Willow', 'Snowshoe', 'Snowgoose', 'Icefield', 'Muskeg', 'Kodiak', 'Raven',
   'Salmonrun', 'Northstar', 'Midnight', 'Larchbog', 'Trapline', 'Goldpan',
   'Cottongrass', 'Bushpilot', 'Dogsled', 'Coldfoot'],
  ['Flats', 'Pass', 'Lake', 'Ridge', 'Creek', 'Valley', 'Bench', 'Point',
   'Landing', 'Station', 'Bluff', 'Basin', 'Hollow', 'Crossing', 'Run',
   'Reach', 'Moraine', 'Cirque', 'Sound', 'Fork'],
 ],
 // Phase 5 of the US landscapes goal: the South.
 longleaf: [
  ['Wiregrass','Longleaf','Pinestraw','Turkeyoak','Sandhill','Candlestick','Bobwhite','Woodpecker','Pinecone','Sand Pine','Gopher','Fox Squirrel','Sandspur','Resin','Turpentine','Naval Stores','Tarheel','Carolina','Pinewood','Sandy Run'],
  ['Pines','Ridge','Hollow','Run','Branch','Hills','Crossing','Glade','Flats','Station','Bend','Lake','Creek','Field','Woods','Grove','Barrens','Savanna','Pond','Gap'],
 ],
 piedmont: [
  ['Red Clay','Dogwood','Magnolia','Tulip','Sweetgum','Azalea','Mockingbird','Peachtree','Mill Creek','Kudzu','Shoals','Fall Line','Catawba','Chattahoochee','Hickory Nut','Honeysuckle','Muscadine','Cotton Mill','Brick Kiln','Sourwood'],
  ['Hills','Run','Creek','Ridge','Hollow','Bend','Shoals','Mill','Branch','Crossing','Farms','Grove','Lake','Knob','Fork','Springs','Gap','Woods','Meadow','Station'],
 ],
 lowcountry: [
  ['Spartina','Oyster','Palmetto','Marsh Hen','Egret','Fiddler Crab','Live Oak','Spanish Moss','Sea Island','Rice Field','Indigo','Plough Mud','Pluff','Shrimp Boat','Heron','Sweetgrass','Tabby','Wando','Edisto','Marsh Tacky'],
  ['Marsh','Creek','Landing','Island','Plantation','Point','Neck','Bluff','Sound','Hammock','Inlet','Cove','Reach','Dock','Banks','Oaks','Ferry','Harbor','Shoals','Woods'],
 ],
 bayou: [
  ['Cypress','Tupelo','Pirogue','Crawfish','Levee','Batture','Cottonmouth','Nutria','Bousillage','Chenier','Acadiana','Boudreaux','Spillway','Teche','Atchafalaya','Cane Brake','Pecan Bottom','Sugar Mill','Mudbug','Zydeco'],
  ['Bayou','Landing','Levee','Swamp','Bend','Island','Bottoms','Point','Ridge','Crossing','Lake','Pass','Cove','Brake','Chute','Oaks','Ferry','Parish','Mill','Woods'],
 ],
 flatwoods: [
  ['Slash Pine','Spanish Bayonet','Saw Palmetto','Gator','Sandhill Crane','Orange Grove','Cracker','Scrub Jay','Armadillo','Lake Wales','Cypress Dome','Kissimmee','Hammock','Flatwood','Turpentine Camp','Cattle Pen','Sinkhole','Wiregrass Prairie','Cabbage Palm','Sandspur Flats'],
  ['Flats','Lake','Prairie','Hammock','Pines','Ranch','Grove','Dome','Run','Slough','Crossing','Creek','Island','Pond','Woods','Springs','Ridge','Landing','Bluff','Groves'],
 ],
 // Phase 6: Texas and the deserts.
 hillcountry: [
  ['Cedar Break','Limestone','Ashe','Live Oak Draw','Pedernales','Guadalupe','Blanco','Llano','Frio','Caprock','Spanish Oak','Mountain Laurel','Armadillo Flats','Bandera','Comal','Dripping Springs','Bee Cave','Wimberley','Painted Bunting','Goldencheek'],
  ['Hills','Draw','Springs','Bluff','Ranch','Crossing','Bend','Creek','Hollow','Divide','Mesa','Gap','Ridge','Falls','Canyon','Pass','Station','Valley','Knob','Fork'],
 ],
 bluebonnet: [
  ['Bluebonnet','Blackland','Indian Paintbrush','Bois d Arc','Pecan Creek','Cedar Elm','Trinity','Brazos','Waxahachie','Ennis','Scissortail','Dickcissel','Cottonseed','Gin House','Prairie Dog','Horned Lark','Primrose','Sorghum','Hedge Apple','Long Horn'],
  ['Prairie','Fields','Meadow','Farms','Crossing','Station','Creek','Bottoms','Ranch','Run','Lake','Grove','Bend','Flats','Hill','Pond','Road','Mill','Fork','Downs'],
 ],
 gulfcoast: [
  ['Galveston Bay','Buffalo Bayou','Cypress Creek','Brazoria','Matagorda','San Jacinto','Clear Lake','Kemah','Roseate','Whooping Crane','Shrimp Dock','Sugar Land','Rice Belt','Live Oak Point','Cordgrass','Gulf Breeze','Seabrook','Bolivar','Redfish','Nutria Point'],
  ['Bayou','Landing','Shores','Point','Harbor','Marsh','Island','Prairie','Oaks','Pines','Inlet','Cove','Reach','Dock','Banks','Bend','Creek','Pass','Bay','Lake'],
 ],
 mojave: [
  ['Joshua','Creosote Flat','Mojave','Amargosa','Calico','Kelso','Cima','Ivanpah','Desert Tortoise','Chuckwalla','Silver Lake','Dry Lake','Bristle','Beavertail','Smoke Tree','Coyote Wash','Burro','Pinto','Lucerne','Old Woman'],
  ['Wash','Flats','Basin','Mesa','Springs','Valley','Pass','Butte','Dunes','Ridge','Wells','Station','Canyon','Playa','Range','Crossing','Rock','Point','Bajada','Gap'],
 ],
 palms: [
  ['Date Grove','Fan Palm','Oasis','San Jacinto Peak','Coachella','Thousand Palms','Tamarisk Row','Oleander','Bougainvillea','Medjool','Agua Caliente','Chino Canyon','Windmill Pass','Salton','Mecca','Thermal','Cathedral City','Smoke Tree Ranch','Santa Rosa','Sunrise Palm'],
  ['Palms','Oasis','Springs','Canyon','Grove','Ranch','Mesa','Cove','Wash','Villas','Gardens','Court','Pointe','Vista','Lakes','Hills','Park','Club','Terrace','Row'],
 ],
 chihuahuan: [
  ['Lechuguilla','Sotol','Soaptree','Candlewood','Chisos','Davis','Guadalupe Peak','Franklin','Hueco','Organ','Tularosa','Jornada','Terlingua','Marfa','Fort Davis','Collared Peccary','Scaled Quail','Candelilla','Emory','Alligator Bark'],
  ['Mesa','Draw','Basin','Tanks','Springs','Canyon','Flats','Peak','Wells','Ridge','Arroyo','Gap','Bajada','Bluff','Butte','Pass','Rim','Crossing','Ranch','Window'],
 ],
 // Phase 7: California and the western mountains.
 monterey: [
  ['Sand Dollar','Lone Cypress','Carmel','Asilomar','Point Lobos','Otter Cove','Sea Lion','Kelp','Abalone','Fog Bank','Big Sur','Moss Beach','Seal Rock','Bird Rock','Fanshell','Huckleberry Hill','Kelp Forest','Pescadero','Stillwater','Sea Otter'],
  ['Point','Cove','Links','Headland','Bluffs','Reach','Shore','Rocks','Beach','Landing','Cliffs','Overlook','Bay','Sound','Cypress','Pines','Hill','Dunes','Strand','Harbor'],
 ],
 socal: [
  ['Barranca','Chaparral','Santa Ana','Arroyo Seco','Sycamore Canyon','Topanga','Malibu Creek','Ocean Bluff','Jacaranda','Mission Road','San Gabriel','Laguna','Encinitas','Rancho','Sage Scrub','Coyote Hills','Eucalyptus Row','Pepper Tree','Red Tile','Agoura'],
  ['Canyon','Ranch','Mesa','Hills','Arroyo','Ridge','Vista','Heights','Springs','Oaks','Grove','Bluff','Point','Trail','Estates','Park','Valley','Crest','Highlands','Gardens'],
 ],
 winecountry: [
  ['Cabernet','Zinfandel','Chardonnay','Vintner','Cooperage','Crush Pad','Valley Oak','Blue Oak','Mayacamas','Carneros','Russian River','Alexander','Rutherford','Oakville','Stags Leap','Napa River','Poppy','Olive Press','Barrel Room','Old Vine'],
  ['Vineyard','Estate','Ranch','Cellars','Hills','Valley','Bench','Slope','Oaks','Creek','Knoll','Crossing','Terrace','Row','Grange','Meadow','Ridge','Springs','Glen','Mill'],
 ],
 cascades: [
  ['Noble Fir','Subalpine Larch','Beargrass','Thimbleberry','Columnar','Snow Cone','Hood View','Pinnacle','St Helens','Adams','Glacier Creek','Timberline','Cloudcap','Lava Bed','Silver Fir','Paradise Meadow','Sahale','Ohanapecosh','Wy East','Tamanawas'],
  ['Ridge','Meadow','Falls','Lodge','Pass','Basin','Lake','Creek','Divide','Lookout','Fork','Crossing','Peak','Hollow','Glade','Springs','Trail','Butte','Run','Camp'],
 ],
 sierra: [
  ['Sugar Pine','Incense Cedar','Red Fir','Manzanita','Mule Ear','Granite Dome','Tahoe','Donner','Tuolumne','Mono','Kings Canyon','Mineral King','Lodgepole Flat','Echo Summit','Ebbetts','Sonora Pass','Mariposa','Glacier Point','Half Dome','Desolation'],
  ['Meadow','Dome','Lake','Summit','Pass','Basin','Falls','Ridge','Creek','Valley','Springs','Lodge','Crest','Peak','Bowl','Fork','Camp','Flat','Spire','Station'],
 ],
 ponderosa: [
  ['Ponderosa','Gambel Oak','Mogollon','Coconino','Kaibab','Humphreys','Cinder','Sunset Crater','Abert','Elk Park','Bitterbrush','Mahogany','Lava Flow','Mormon Lake','Woody Mountain','Fort Valley','Snowbowl','Mount Elden','Walnut Canyon','Oak Creek'],
  ['Park','Rim','Mesa','Meadow','Ridge','Canyon','Flat','Springs','Draw','Lake','Pines','Crossing','Tank','Peak','Butte','Valley','Lodge','Ranch','Trail','Hollow'],
 ],
 // Phase 8a: the high desert and the Cross Timbers.
 sagebrush: [
  ['Sagebrush','Wheatgrass','Rimrock','Coulee','Ritzville','Balsamroot','Bitterroot','Scabland','Channeled','Steptoe','Sage Grouse','Rattlesnake Ridge','Juniper Draw','Lava Rim','Columbia','Horse Heaven','Frenchman','Dry Falls','Owyhee','Snake River'],
  ['Coulee','Rim','Flats','Draw','Bench','Butte','Springs','Ridge','Breaks','Basin','Canyon','Crossing','Hills','Mesa','Station','Ranch','Lake','Point','Gap','Plateau'],
 ],
 redrock: [
  ['Slickrock','Hoodoo','Pinyon','Cliffrose','Blackbrush','Canyonlands','Arches','Fisher Towers','Castle Valley','Navajo','Kayenta','Wingate','Entrada','Cedar Mesa','Comb Ridge','Moab','Bluff','Indian Creek','Valley of Gods','Moki'],
  ['Mesa','Canyon','Rim','Arch','Fin','Wash','Butte','Tower','Bench','Spire','Reef','Point','Narrows','Alcove','Gulch','Tank','Window','Park','Overlook','Bluffs'],
 ],
 crosstimbers: [
  ['Post Oak','Blackjack','Cross Timbers','Red Dirt','Kiamichi','Canadian','Washita','Osage Hills','Arbuckle','Wichita','Pump Jack','Oil Patch','Section Line','Red Cedar','Mistletoe','Greater Prairie','Chisholm','Boomer','Sooner','Indian Blanket'],
  ['Timbers','Hills','Creek','Crossing','Ranch','Bend','Ridge','Lake','Bottoms','Station','Prairie','Woods','Trail','Fork','Springs','Hollow','Grove','Knob','Flats','Draw'],
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
