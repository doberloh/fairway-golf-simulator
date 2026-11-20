// THE TOUR (src/tour.js; the fairway-tour goal, 17 November 2026): a season
// set up, played event by event (the person's cards stand in for a round
// played), the standings and awards, Auto strength, the next season.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newTour, quickSeason, shippedSeason, SHIPPED, startEvent, endEvent, seasonOver, standings, awards, nextSeason, readTour, eventSettings, cleanEventDef, eventCourse, tourRecord} from '../src/tour.js';
import {holeModel, drawField, recordCard, myGroup, makeCut, finish, playoffFor, drawPlayoff, YOU} from '../src/tournament.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

const HOLES = Array.from({length: 18}, (_, i) => ({par: [4, 4, 3, 5][i % 4], yards: [400, 380, 175, 530][i % 4]}));
// Plays an event as main.js would, the person shooting `under` under par a round.
function playEvent(tour, under = 0) {
 const ev = startEvent(tour, {personIndex: 8});
 ev.pars = HOLES.map(h => h.par); ev.model = holeModel(HOLES, {scratch: 74, bogey: 95});
 for (let r = 0; r < ev.rounds; r++) {
  if (r === 2 && ev.rounds === 4) makeCut(ev);
  if (ev.cut && !ev.cut.made.includes(YOU)) { drawField(ev, r, []); ev.round = r + 1; continue; }
  const mine = myGroup(ev, r);
  for (const id of mine) recordCard(ev, id, HOLES.map((h, i) => h.par + (id === YOU ? (i < under ? -1 : 0) : 1)), r);
  drawField(ev, r, mine);
  ev.round = r + 1;
 }
 const tied = playoffFor(ev); if (tied) drawPlayoff(ev, tied);
 finish(ev);
 endEvent(tour, ev);
 return ev;
}

test('quick season: eight events across the landscapes, two majors; the shipped season: fifteen, four', () => {
 const q = quickSeason({seed: 'Q', person: {name: 'Alex'}});
 assert.equal(q.events.length, 8);
 assert.equal(q.events.filter(e => e.major).length, 2);
 assert.equal(new Set(q.events.map(e => e.course.settings.biome)).size, 8);
 assert.deepEqual(quickSeason({seed: 'Q'}).events.map(e => e.course.settings.seed), q.events.map(e => e.course.settings.seed), 'seeded');
 const s = shippedSeason();
 assert.equal(s.events.length, 15);
 assert.equal(s.events.filter(e => e.major).length, 4);
 assert.deepEqual([...new Set(s.events.map(e => e.course.settings.biome))].sort(), [...BIOME_KEYS].sort(), 'one event on every landscape');
 assert.equal(SHIPPED.events.length, 15);
});

test('an event\'s settings: its own over the tour\'s; a calendar entry needs a course', () => {
 const t = newTour({defaults: {rounds: 1}, events: [{name: 'A', course: eventCourse('pacnw', 'A')}, {name: 'B', rounds: 4, format: 'stableford', course: eventCourse('prairie', 'B')}]});
 assert.equal(eventSettings(t, t.events[0]).rounds, 1, 'one round a weekend');
 assert.equal(eventSettings(t, t.events[1]).rounds, 4, 'a full weekend for this one');
 assert.equal(eventSettings(t, t.events[1]).format, 'stableford');
 assert.throws(() => cleanEventDef({name: 'No course'}), /no course/);
});

test('a short season played through: standings, awards, Auto, the next season', () => {
 const t = newTour({name: 'Short', seed: 'S', defaults: {rounds: 2, size: 40, strength: 'auto'}, person: {name: 'Alex'},
  events: ['pacnw', 'seaside', 'prairie'].map((b, i) => ({name: `E${i + 1}`, course: eventCourse(b, `S${i}`), major: i === 2}))});
 const first = playEvent(t, 18); // the person a stroke under par every hole: wins
 assert.equal(first.results[0].id, YOU);
 assert.equal(t.autoCentre, 11, 'a top ten: the next field a stroke tougher');
 playEvent(t, 0);
 playEvent(t, 18);
 assert.ok(seasonOver(t));
 const st = standings(t);
 assert.equal(st[0].id, YOU);
 assert.equal(st[0].wins >= 2, true);
 assert.ok(st[0].points >= 500 + 1000, `two wins, one a major: ${st[0].points}`);
 assert.ok(st.every((s, i) => i === 0 || s.points <= st[i - 1].points));
 const a = awards(t);
 assert.equal(a.champion.id, YOU);
 assert.equal(a.majors.id, YOU);
 const before = tourRecord([t]);
 assert.equal(before.titles, 1, 'the season over: its title counts');
 assert.ok(before.wins >= 2 && before.majors === 1 && before.events === 3 && before.best === '1');
 const n = nextSeason(t);
 assert.equal(n.season, 2); assert.equal(n.at, 0); assert.equal(n.results.length, 0);
 const after = tourRecord([n]);
 assert.equal(after.titles, 1, 'kept in the history after the next season starts');
 assert.equal(after.wins, before.wins);
 assert.equal(after.trophies.length, before.wins);
 assert.ok(Object.values(n.shifts).some(v => v !== 0) && Object.values(n.shifts).every(v => Math.abs(v) <= 3));
 const back = readTour(JSON.parse(JSON.stringify(t)));
 assert.deepEqual(standings(back), st);
 assert.throws(() => readTour({kind: 'fairway-tour', v: 9, events: [{}]}), /newer version/);
});

test('the field comes from the tour\'s members', () => {
 const t = quickSeason({seed: 'M'});
 const ev = startEvent(t, {personIndex: 10});
 const members = new Set(t.members);
 assert.ok(ev.field.every(id => members.has(id)));
});
