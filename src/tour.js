// THE TOUR: A SEASON (the fairway-tour goal, 17 November 2026; SPEC section
// 6). Pure: a season the person sets up in advance and plays through -- its
// calendar of events, the standings, the awards, and the next season.
//
// Single player (Q4): one person against the computer field. Points decide
// the season; prize money is shown and does nothing else (Q5). Events are
// tournament.js events; a tour runs one at a time, in calendar order.
import {seeded} from './challenges.js';
import {newEvent, YOU, golferOf} from './tournament.js';
import {ROSTER, rosterGolfer} from './ai/roster.js';
import {STARTING_COURSE, BIOME_KEYS} from './settings-schema.js';

export const TOUR_KIND = 'fairway-tour', TOUR_VERSION = 1;
export const MAX_EVENTS = 60, MAX_NAME = 48;
// What every event gets unless it says otherwise (SPEC 6; PLACED where the
// owner did not say): four rounds ("full weekends"), stroke play, gross,
// a field of 60 from the tour's members, the person and three partners.
export const DEFAULTS = {rounds: 4, holes: 18, format: 'stroke', net: false, size: 60, strength: 'mixed', partners: 3, watch: 'green'};
export const STRENGTH_NAMES = {tour: 'Tour strength', strong: 'Strong', mixed: 'Mixed', club: 'Club golfers', auto: 'Auto · follows your results'};

// An eighteen on a landscape, at a length a field of good golfers plays
// (PLACED: 6,900 yd from the back), seeded so every copy grows the same
// course.
export const eventCourse = (biome, seed, name = '') => ({name, settings: {...STARTING_COURSE, holes: 18, courseYards: 6900, biome, seed: String(seed).slice(0, 40)}});

// A NEW TOUR: a name, a calendar, its defaults and its members (the roster
// golfers who make up its fields, so the same rivals turn up week after
// week: PLACED, the 100 nearest the tour's strength).
export function newTour({name = 'My Tour', year = new Date().getFullYear() + 1, seed = 'tour', events = [], defaults = {}, members = null, person = {name: 'You'}} = {}) {
 const d = {...DEFAULTS, ...defaults};
 const pool = members || ROSTER.map(g => g.id).slice(0, 100);
 return {kind: TOUR_KIND, v: TOUR_VERSION, id: 't' + idFrom(seed), name: String(name).slice(0, MAX_NAME), year, seed: String(seed).slice(0, 60), defaults: d,
  members: pool.filter(id => rosterGolfer(id)), person: {name: String(person.name || 'You').slice(0, 24), profile: person.profile || null},
  events: events.slice(0, MAX_EVENTS).map((e, i) => cleanEventDef(e, i)), season: 1, at: 0, current: null, results: [], shifts: {}, autoCentre: null};
}
const idFrom = seed => { const r = seeded('tour|' + seed); return Math.floor(r() * 2 ** 32).toString(36) + Math.floor(r() * 2 ** 32).toString(36); };
// One event of the calendar, as the editor and a tour file hold it: what it
// overrides of the tour's defaults, and its course.
export function cleanEventDef(e, i = 0) {
 const course = e.course && typeof e.course === 'object' && e.course.settings ? {name: String(e.course.name || '').slice(0, 48), settings: e.course.settings, ...(e.course.built ? {built: e.course.built} : {})} : null;
 if (!course) throw Error(`Event ${i + 1} has no course.`);
 const out = {id: typeof e.id === 'string' && /^[a-z0-9]{2,24}$/.test(e.id) ? e.id : `ev${i + 1}`, name: String(e.name || `Event ${i + 1}`).slice(0, 48), week: Number.isInteger(e.week) && e.week >= 1 && e.week <= 52 ? e.week : Math.min(52, 3 + i * 3), course, major: !!e.major};
 for (const k of ['rounds', 'holes', 'size', 'partners']) if (Number.isInteger(e[k])) out[k] = e[k];
 if (['stroke', 'stableford'].includes(e.format)) out.format = e.format;
 if (typeof e.net === 'boolean') out.net = e.net;
 if (e.strength) out.strength = e.strength;
 return out;
}
// What an event plays with: its own settings over the tour's.
export const eventSettings = (tour, def) => ({...tour.defaults, ...Object.fromEntries(Object.entries(def).filter(([k]) => k in DEFAULTS))});

// QUICK SEASON (SPEC 6, PLACED): eight events across the landscapes, the
// fourth and the last majors, on generated courses.
export function quickSeason({seed = 'quick', person, name = 'Quick Season'} = {}) {
 const rnd = seeded('quick|' + seed), keys = [...BIOME_KEYS].sort(() => rnd() - .5).slice(0, 8);
 return newTour({name, seed, person, events: keys.map((biome, i) => ({id: `q${i + 1}`, name: `${EVENT_WORDS[i % EVENT_WORDS.length]} ${['Open', 'Classic', 'Invitational', 'Championship'][i % 4]}`, week: 4 + i * 5, course: eventCourse(biome, `${seed}-${i + 1}`), major: i === 3 || i === 7}))});
}
const EVENT_WORDS = ['Coastal', 'Heritage', 'Pinecrest', 'Lakeside', 'Summit', 'Harbor', 'Prairie', 'Canyon', 'Redwood', 'Meadow', 'Ironwood', 'Bayside', 'Highland', 'Riverbend', 'Tidewater'];

// THE FAIRWAY TOUR SEASON, shipped in the game (Q7): fifteen events, one on
// each landscape, four of them majors. A shipped event is never changed once
// released: a different season is a new one with its own id (like the
// course of the week's rotation).
export const SHIPPED = Object.freeze({id: 'fairway-tour-2027', name: 'The Fairway Tour 2027', events: [
 ['Russian River Open', 'redwood', 3], ['Loon Lake Classic', 'northwoods', 6], ['Badlands Invitational', 'badlands', 9], ['The Golden Age Championship', 'parkland', 13, true],
 ['Long Shadows Open', 'southpines', 16], ['Tidewater Classic', 'lowgulf', 19], ['Palm Coast Invitational', 'flpalms', 22], ['The Plantation Point Championship', 'hiresort', 25, true],
 ['Granite Crags Open', 'dmountain', 28], ['Desert Oasis Classic', 'dresort', 31], ['Cedar Hollow Invitational', 'pacnw', 34], ['The Cypress Bluff Championship', 'calcoast', 38, true],
 ['Gorse Bluff Links', 'seaside', 41], ['Timberline Classic', 'mountains', 44], ['The Blowout Ridge Championship', 'prairie', 48, true]]});
export function shippedSeason({person} = {}) {
 return newTour({name: SHIPPED.name, year: 2027, seed: SHIPPED.id, person, events: SHIPPED.events.map(([name, biome, week, major], i) => ({id: `f${i + 1}`, name, week, major: !!major, course: eventCourse(biome, `FT27-${i + 1}`, name)}))});
}

// THE NEXT EVENT to play, as a tournament.js event, its field from the
// tour's members. Auto strength (Q3) centres the field on `autoCentre`,
// which moves between events with the person's results (below).
export function startEvent(tour, {personIndex = null} = {}) {
 const def = tour.events[tour.at];
 if (!def) return null;
 const s = eventSettings(tour, def);
 const strength = s.strength === 'auto' ? (tour.autoCentre ?? (Number.isFinite(personIndex) ? personIndex : 12)) : s.strength;
 const ev = newEvent({name: def.name, seed: `${tour.seed}|s${tour.season}|${def.id}`, course: def.course, holes: s.holes, rounds: s.rounds, format: s.format, net: s.net, major: def.major,
  size: s.size, strength, partners: s.partners, person: {...tour.person, index: personIndex}});
 // The field from the tour's members only (the same rivals all season).
 const members = new Set(tour.members);
 if (members.size >= ev.field.length) ev.field = ev.field.filter(id => members.has(id)).concat([...members].filter(id => !ev.field.includes(id))).slice(0, ev.field.length);
 ev.tourId = tour.id; ev.shifts = {...tour.shifts};
 tour.current = ev;
 return ev;
}

// AN EVENT FINISHED: its results into the season, the calendar on, and Auto
// moved by how the person did (PLACED: a top ten makes the next field a
// stroke tougher, a missed cut or the bottom quarter a stroke easier).
export function endEvent(tour, ev) {
 const def = tour.events[tour.at];
 tour.results.push({id: def.id, name: def.name, major: def.major, rows: ev.results.map(r => ({id: r.id, name: r.name, place: r.place, pos: r.pos, total: r.total, points: r.points, money: r.money})), rounds: ev.rounds, format: ev.format,
  scores: Object.fromEntries(Object.entries(ev.scores).map(([id, rs]) => [id, rs.filter(Boolean).map(c => c.reduce((s, v) => s + (v || 0), 0))]))});
 const me = ev.results.find(r => r.id === YOU), field = ev.results.length;
 const centre = tour.autoCentre ?? 12;
 if (me) tour.autoCentre = me.place && me.place <= 10 ? centre - 1 : !me.place || me.place > field * .75 ? centre + 1 : centre;
 tour.at++; tour.current = null;
 return tour;
}
export const seasonOver = tour => tour.at >= tour.events.length;

// THE STANDINGS: points, money, wins, top tens, cuts made, scoring average
// (strokes a round), majors. Everyone who played an event this season.
export function standings(tour) {
 const by = new Map();
 const row = (id, name) => { if (!by.has(id)) by.set(id, {id, name, points: 0, money: 0, wins: 0, top10: 0, cuts: 0, events: 0, strokes: 0, rounds: 0, majors: 0, you: id === YOU}); return by.get(id); };
 for (const res of tour.results) for (const r of res.rows) {
  const s = row(r.id, r.name);
  s.events++; s.points += r.points || 0; s.money += r.money || 0;
  if (r.place === 1) { s.wins++; if (res.major) s.majors++; }
  if (r.place && r.place <= 10) s.top10++;
  if (r.pos !== 'MC') s.cuts++;
  if (res.format === 'stroke') for (const t of res.scores?.[r.id] || []) { s.strokes += t; s.rounds++; }
 }
 const out = [...by.values()].map(s => ({...s, average: s.rounds ? s.strokes / s.rounds : null}));
 out.sort((a, b) => b.points - a.points || b.wins - a.wins || b.money - a.money);
 out.forEach((s, i) => { const first = out.findIndex(x => x.points === s.points); s.place = first + 1; s.pos = `${out.filter(x => x.points === s.points).length > 1 ? 'T' : ''}${first + 1}`; });
 return out;
}

// THE SEASON'S AWARDS (SPEC 6): the champion (most points), the most wins,
// the lowest scoring average (PLACED: at least half the season's rounds),
// the best in the majors (most major points).
export function awards(tour) {
 const st = standings(tour);
 if (!st.length) return null;
 const rounds = tour.results.reduce((s, r) => s + r.rounds, 0);
 const avg = st.filter(s => s.average != null && s.rounds >= rounds / 2).sort((a, b) => a.average - b.average)[0] || null;
 const majorPts = new Map();
 for (const res of tour.results.filter(r => r.major)) for (const r of res.rows) majorPts.set(r.id, (majorPts.get(r.id) || 0) + (r.points || 0));
 const majorBest = [...majorPts.entries()].sort((a, b) => b[1] - a[1])[0];
 return {champion: st[0], wins: [...st].sort((a, b) => b.wins - a.wins)[0], average: avg, majors: majorBest ? st.find(s => s.id === majorBest[0]) : null};
}

// THE NEXT SEASON of the same tour (SPEC 6, PLACED): the same calendar and
// members, each rival's handicap moved a little by how they played -- half
// a stroke better for a top-ten season, half worse for the bottom quarter,
// never more than three strokes from the roster's figure over all seasons.
export function nextSeason(tour) {
 const st = standings(tour).filter(s => !s.you), n = st.length;
 const shifts = {...tour.shifts};
 st.forEach((s, i) => { const d = i < 10 ? -.5 : i >= n * .75 ? .5 : 0; shifts[s.id] = Math.max(-3, Math.min(3, (shifts[s.id] || 0) + d)); });
 return {...tour, season: tour.season + 1, year: tour.year + 1, at: 0, current: null, results: [], shifts};
}

// A tour read back from the store or a file: refused if this version cannot
// read it; anything it names that is not here (a roster golfer) is dropped.
export function readTour(d) {
 if (!d || d.kind !== TOUR_KIND) throw Error('This is not a Fairway tour.');
 if (d.v !== TOUR_VERSION) throw Error(d.v > TOUR_VERSION ? 'This tour was made by a newer version of Fairway. Update Fairway, then open it again.' : 'This tour is from a version of Fairway this one cannot read.');
 if (!Array.isArray(d.events) || !d.events.length) throw Error('This tour has no events.');
 const t = newTour({name: d.name, year: d.year, seed: d.seed, events: d.events, defaults: d.defaults, members: Array.isArray(d.members) ? d.members : null, person: d.person || {}});
 return {...t, id: typeof d.id === 'string' ? d.id.slice(0, 32) : t.id, season: Number.isInteger(d.season) ? d.season : 1, at: Number.isInteger(d.at) ? Math.max(0, Math.min(d.at, t.events.length)) : 0,
  current: d.current || null, results: Array.isArray(d.results) ? d.results : [], shifts: d.shifts && typeof d.shifts === 'object' ? d.shifts : {}, autoCentre: Number.isFinite(d.autoCentre) ? d.autoCentre : null};
}
// A golfer's handicap in this tour this season: the roster's, moved by the
// seasons gone (nextSeason). tournament.js asks it through `ev.shifts`.
export const tourHandicap = (tour, id) => (rosterGolfer(id)?.handicap ?? 0) + (tour.shifts?.[id] || 0);
export {golferOf};
