// THE FAIRWAY TOUR'S GOLFERS (the fairway-tour goal, 17 November 2026; SPEC
// section 1, *Names and faces*). Pure.
//
// 150 invented golfers, each a name, a country, a stock shape, a handicap,
// traits and a look from the rewards the game already has (a ball finish
// and a tracer). Grown from fixed word lists by a fixed seed, so every copy
// of the game has the same golfers; tests/ai-roster.test.mjs pins the whole
// roster, so a change to a list or the order of draws fails until it is
// meant. A golfer's id is never reused or renamed once shipped (like a
// landscape key: tours and saves name golfers by id). A new golfer is
// appended with a new id.
//
// NEVER A REAL PERSON (the owner, 17 November 2026, Q9: invented, believable
// names): every full name is checked against `REAL_PROS`, a list of real
// professional golfers past and present, and a clash is skipped. The list is
// Claude's, from memory, PLACED: it catches the names a player would
// recognise, not every professional who ever lived.
//
// HOW GOOD (PLACED): a field from tour-strength to club golfers -- 30
// between +4 and 0, 40 between 0 and 8, 40 between 8 and 16, 25 between 16
// and 24, 15 between 24 and 32 -- so a tour can be set from a field of the
// best down to one of everyday golfers.
import {seeded} from '../challenges.js';
import {TRAITS, SHAPES} from './skill.js';

// Country codes as golf scoreboards print them; names per country.
export const NATIONS = {
 USA: {name: 'United States', first: ['Cody', 'Tanner', 'Brett', 'Wyatt', 'Garrett', 'Colby', 'Reid', 'Travis', 'Mason', 'Drew', 'Casey', 'Logan'], last: ['Haskell', 'Prewitt', 'Delano', 'Whitcomb', 'Rourke', 'Stahl', 'Kimbrough', 'Lyle', 'Tolliver', 'Brannon', 'Kessler', 'Dunaway', 'Mercer', 'Holcomb']},
 ENG: {name: 'England', first: ['Oliver', 'Harry', 'Alfie', 'Freddie', 'George', 'Toby', 'Callum', 'Rhys'], last: ['Ashcombe', 'Pemberton', 'Thornley', 'Hartwell', 'Ellery', 'Brockwell', 'Fenwick', 'Larkham', 'Sowerby', 'Whitlow']},
 SCO: {name: 'Scotland', first: ['Fraser', 'Angus', 'Euan', 'Calum', 'Ruaridh', 'Hamish', 'Struan', 'Iain'], last: ['MacAulay', 'Drummond', 'Kinnaird', 'Lennox', 'Rennie', 'Gilchrist', 'Strachan', 'Murdie', 'Baird', 'Cairncross']},
 IRL: {name: 'Ireland', first: ['Cian', 'Oisin', 'Darragh', 'Fionn', 'Ronan', 'Eoin', 'Tadhg'], last: ['Gallagher', 'Mulcahy', 'Brennan', 'Feeney', 'Hogan', 'Cullinane', 'Duggan', 'Moriarty']},
 AUS: {name: 'Australia', first: ['Lachlan', 'Hamish', 'Brodie', 'Jarrah', 'Kieran', 'Mitch', 'Darcy'], last: ['Kilpatrick', 'Ellison', 'Treloar', 'Mabury', 'Whitworth', 'Hensley', 'Coburn', 'Pascoe']},
 NZL: {name: 'New Zealand', first: ['Nikau', 'Tama', 'Quinn', 'Corbin', 'Ari'], last: ['Waititi', 'Penrose', 'Holloway', 'Tamihana', 'Fairbairn', 'Blackett']},
 RSA: {name: 'South Africa', first: ['Thabo', 'Dewald', 'Ruan', 'Pieter', 'Sipho', 'Jaco'], last: ['Venter', 'du Preez', 'Mokoena', 'Steyn', 'Nkosi', 'van Wyk', 'Bezuidenhout', 'Ndlovu']},
 CAN: {name: 'Canada', first: ['Liam', 'Gavin', 'Etienne', 'Rory', 'Declan', 'Mathieu'], last: ['Tremblay', 'Gauthier', 'McInnis', 'Bouchard', 'Fortier', 'Kerrigan', 'Lachance']},
 SWE: {name: 'Sweden', first: ['Viktor', 'Linus', 'Oskar', 'Elias', 'Hugo', 'Albin'], last: ['Lindqvist', 'Hedberg', 'Sundström', 'Ekholm', 'Bergvall', 'Nyström', 'Åkerlund']},
 NOR: {name: 'Norway', first: ['Sindre', 'Eirik', 'Håkon', 'Torstein', 'Magnus'], last: ['Solheimsvik', 'Brekke', 'Haugland', 'Vestby', 'Ødegård', 'Lunde']},
 DEN: {name: 'Denmark', first: ['Mads', 'Rasmus', 'Kasper', 'Frederik', 'Anders'], last: ['Kjærgaard', 'Bækgaard', 'Lindholm', 'Rosendahl', 'Vestergaard', 'Thygesen']},
 ESP: {name: 'Spain', first: ['Álvaro', 'Iker', 'Javier', 'Unai', 'Pablo', 'Mateo'], last: ['Echeverría', 'Larrañaga', 'Ortúzar', 'Villalba', 'Cifuentes', 'Arrieta', 'Montoya']},
 FRA: {name: 'France', first: ['Baptiste', 'Théo', 'Clément', 'Hugo', 'Matthieu'], last: ['Delacroix', 'Fournel', 'Marchetti', 'Lambert-Roy', 'Vasseur', 'Chaumont']},
 GER: {name: 'Germany', first: ['Jonas', 'Lukas', 'Felix', 'Moritz', 'Niklas'], last: ['Achterberg', 'Brandauer', 'Keppler', 'Wittmann', 'Hollenbach', 'Seidl']},
 ITA: {name: 'Italy', first: ['Lorenzo', 'Matteo', 'Tommaso', 'Edoardo'], last: ['Benedetti', 'Ferraresi', 'Gualtieri', 'Pellegrino', 'Santangelo']},
 JPN: {name: 'Japan', first: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Kaito', 'Daiki'], last: ['Takemura', 'Shibasaki', 'Kuroda', 'Nishiyama', 'Hayakawa', 'Ozaki-Mori', 'Fujimaki']},
 KOR: {name: 'South Korea', first: ['Min-jun', 'Seo-jun', 'Ji-ho', 'Hyun-woo', 'Do-yun'], last: ['Baek', 'Seong', 'Ryu', 'Ahn', 'Hwang', 'Yoon']},
 ARG: {name: 'Argentina', first: ['Tomás', 'Joaquín', 'Facundo', 'Santiago'], last: ['Albornoz', 'Quiroga', 'Etchegaray', 'Sosa Paz', 'Bustamante']},
 MEX: {name: 'Mexico', first: ['Emiliano', 'Diego', 'Rodrigo', 'Andrés'], last: ['Villaseñor', 'Arredondo', 'Treviño Sáenz', 'Cárdenas', 'Olvera']},
 CHI: {name: 'Chile', first: ['Benjamín', 'Vicente', 'Agustín'], last: ['Urrutia', 'Errázuriz', 'Matte', 'Larraín']},
};
// How many golfers from each country (PLACED: weighted as golf is played).
const WEIGHTS = {USA: 30, ENG: 14, SCO: 9, IRL: 7, AUS: 10, NZL: 4, RSA: 7, CAN: 7, SWE: 7, NOR: 4, DEN: 5, ESP: 7, FRA: 5, GER: 5, ITA: 4, JPN: 8, KOR: 6, ARG: 4, MEX: 4, CHI: 3};

// Real professional golfers, past and present, whose names an invented
// golfer must never take (PLACED: from memory; the well-known names).
export const REAL_PROS = new Set(['tiger woods', 'jack nicklaus', 'arnold palmer', 'gary player', 'rory mcilroy', 'scottie scheffler', 'jon rahm', 'phil mickelson', 'jordan spieth', 'justin thomas', 'brooks koepka', 'dustin johnson', 'collin morikawa', 'xander schauffele', 'viktor hovland', 'ludvig aberg', 'tommy fleetwood', 'shane lowry', 'padraig harrington', 'seve ballesteros', 'jose maria olazabal', 'sergio garcia', 'nick faldo', 'ian woosnam', 'sandy lyle', 'colin montgomerie', 'lee westwood', 'luke donald', 'justin rose', 'paul casey', 'matt fitzpatrick', 'tyrrell hatton', 'adam scott', 'jason day', 'cameron smith', 'greg norman', 'ernie els', 'retief goosen', 'louis oosthuizen', 'charl schwartzel', 'trevor immelman', 'hideki matsuyama', 'si woo kim', 'tom kim', 'sungjae im', 'kj choi', 'byeong hun an', 'henrik stenson', 'alex noren', 'jesper parnevik', 'thomas bjorn', 'soren kjeldsen', 'nicolai hojgaard', 'rasmus hojgaard', 'martin kaymer', 'bernhard langer', 'francesco molinari', 'edoardo molinari', 'victor perez', 'mike weir', 'corey conners', 'adam hadwin', 'nick taylor', 'abraham ancer', 'carlos ortiz', 'angel cabrera', 'emiliano grillo', 'joaquin niemann', 'mito pereira', 'ryan fox', 'danny lee', 'lydia ko', 'annika sorenstam', 'nelly korda', 'inbee park', 'lorena ochoa', 'se ri pak', 'karrie webb', 'minjee lee', 'jin young ko', 'ben hogan', 'sam snead', 'byron nelson', 'walter hagen', 'bobby jones', 'gene sarazen', 'tom watson', 'lee trevino', 'johnny miller', 'tom kite', 'curtis strange', 'payne stewart', 'fred couples', 'davis love', 'jim furyk', 'zach johnson', 'bubba watson', 'webb simpson', 'patrick reed', 'tony finau', 'max homa', 'patrick cantlay', 'wyndham clark', 'brian harman', 'sahith theegala', 'cameron young', 'sam burns', 'will zalatoris', 'rickie fowler', 'keegan bradley', 'bryson dechambeau', 'kevin kisner', 'billy horschel', 'matt kuchar', 'stewart cink', 'jimmy walker', 'jason dufner', 'gary woodland', 'lucas glover', 'brandt snedeker', 'kevin na', 'harris english', 'russell henley', 'chris kirk', 'denny mccarthy', 'akshay bhatia', 'nick dunlap', 'ben griffin', 'tom hoge', 'aaron rai', 'robert macintyre', 'russell knox', 'martin laird', 'paul lawrie', 'sam torrance', 'bernard gallacher', 'darren clarke', 'graeme mcdowell', 'christy o\'connor', 'seamus power', 'tom mckibbin', 'min woo lee', 'marc leishman', 'cameron davis', 'lucas herbert', 'thriston lawrence', 'christiaan bezuidenhout', 'dean burmester', 'branden grace', 'erik van rooyen', 'ernie van rooyen', 'jbe kruger', 'garrick higgo', 'taylor pendrith', 'mackenzie hughes', 'thomas detry', 'nicolas colsaerts', 'adrian meronk', 'matthieu pavon', 'romain langasque', 'antoine rozner', 'stephan jaeger', 'yannik paul', 'guido migliozzi', 'ryo ishikawa', 'keita nakajima', 'kazuki higa', 'satoshi kodaira', 'takumi kanaya', 'ryosuke kinoshita', 'jae yang', 'kh lee', 'sang-moon bae', 'bo ram yoon']);

// The look a golfer wears: everyday finishes and tracers for most, a few
// showier ones for the best (PLACED).
const PLAIN_BALLS = ['classic', 'solid-red', 'solid-orange', 'solid-yellow', 'solid-green', 'solid-blue', 'solid-purple', 'solid-pink', 'solid-black', 'red-stripe', 'two-tone'];
const SHOW_BALLS = ['chrome', 'gold', 'black-pearl', 'marble', 'diamond-plate'];
const PLAIN_TRACERS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'sky'];
const SHOW_TRACERS = ['comet', 'sunset', 'ice', 'fire', 'aurora'];
const TIERS = [[30, 4, 0], [40, 0, 8], [40, 8, 16], [25, 16, 24], [15, 24, 32]]; // count, from (handicap; +4 is -4), to

function grow() {
 const rnd = seeded('fairway-tour-roster-1');
 const pick = list => list[Math.floor(rnd() * list.length)];
 const nations = Object.entries(WEIGHTS).flatMap(([k, n]) => Array(n).fill(k));
 const used = new Set(), out = [];
 const handicaps = TIERS.flatMap(([n, a, b]) => Array.from({length: n}, (_, i) => Math.round(((a === 4 ? -4 : a) + ((a === 4 ? 0 : b) - (a === 4 ? -4 : a)) * (i + rnd()) / n) * 10) / 10));
 for (let i = 0; i < handicaps.length; i++) {
  let nation, first, last, full, tries = 0;
  do {
   nation = pick(nations); const N = NATIONS[nation]; first = pick(N.first); last = pick(N.last); full = `${first} ${last}`;
   tries++;
  } while ((used.has(full) || REAL_PROS.has(full.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))) && tries < 200);
  used.add(full);
  const traits = {};
  for (const k of TRAITS) traits[k] = Math.round(Math.min(1, Math.max(0, .5 + (rnd() + rnd() + rnd() - 1.5) * .45)) * 100) / 100;
  // Each golfer has one clear strength and one clear weakness.
  const strong = pick(TRAITS.filter(k => k !== 'aggression' && k !== 'nerve')), weak = pick(TRAITS.filter(k => k !== strong && k !== 'aggression'));
  traits[strong] = Math.max(traits[strong], .85); traits[weak] = Math.min(traits[weak], .2);
  traits.shape = pick(SHAPES.concat(['draw', 'fade']));
  const h = handicaps[i], elite = h <= 0;
  out.push({id: `g${String(i + 1).padStart(3, '0')}`, first, last, name: full, nation, handicap: h, traits,
   ball: elite && rnd() < .5 ? pick(SHOW_BALLS) : pick(PLAIN_BALLS), tracer: elite && rnd() < .4 ? pick(SHOW_TRACERS) : pick(PLAIN_TRACERS)});
 }
 return out;
}

export const ROSTER = Object.freeze(grow().map(g => Object.freeze(g)));
export const rosterGolfer = id => ROSTER.find(g => g.id === id) || null;
// Short name for a leaderboard: "R. Lennox".
export const shortName = g => `${g.first[0]}. ${g.last}`;

// A FIELD of `size` golfers of a strength: 'tour' the best first, 'club'
// everyday golfers, 'mixed' across the roster, or a number -- an average
// handicap the field is built round (Auto, SPEC 6). Seeded, so a tour's
// field is the same every time it is asked for.
export const STRENGTHS = ['tour', 'strong', 'mixed', 'club'];
export function pickField(size, strength = 'mixed', seed = 'field') {
 const n = Math.max(1, Math.min(ROSTER.length, size | 0)), rnd = seeded(`field|${seed}|${strength}`);
 const centre = typeof strength === 'number' ? strength : {tour: -2, strong: 4, mixed: 12, club: 20}[strength] ?? 12;
 // Nearest to the centre first, with a little shuffle so two fields of one
 // strength are not the same golfers in the same order.
 return ROSTER.map(g => ({g, k: Math.abs(g.handicap - centre) + rnd() * 4})).sort((a, b) => a.k - b.k).slice(0, n).map(x => x.g);
}
