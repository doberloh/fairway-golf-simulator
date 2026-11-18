// THE TOUR'S SCREENS (src/ui-tour.js): each draws from a tour in every state
// it can be in, with the buttons main.js wires (data-tour), and nothing a
// golfer's name could break.
import test from 'node:test';
import assert from 'node:assert/strict';
import {hubHtml, startHtml, editorHtml, leaderboardHtml, tickerText, scoreText, money} from '../src/ui-tour.js';
import {quickSeason, startEvent, endEvent, seasonOver} from '../src/tour.js';
import {holeModel, drawField, recordCard, myGroup, finish, YOU} from '../src/tournament.js';

const HOLES = Array.from({length: 18}, (_, i) => ({par: [4, 4, 3, 5][i % 4], yards: [400, 380, 175, 530][i % 4]}));
const buttons = html => [...html.matchAll(/data-tour="([a-z]+)"/g)].map(m => m[1]);

test('every state of the hub draws, with its buttons', () => {
 const t = quickSeason({seed: 'UI', person: {name: 'Alex <b>'}});
 assert.ok(buttons(hubHtml(t)).includes('start'), 'before an event: Start');
 const ev = startEvent(t, {personIndex: 10});
 ev.pars = HOLES.map(h => h.par); ev.model = holeModel(HOLES, null);
 assert.ok(buttons(hubHtml(t)).includes('play'), 'in an event: Play round 1');
 drawField(ev, 0);
 const b = leaderboardHtml(ev, {thru: 9});
 assert.match(b, /<table class="tour-board">/);
 assert.match(tickerText(ev, {thru: 9}), /YOU/);
 for (let r = 0; r < ev.rounds; r++) { for (const id of myGroup(ev, r)) recordCard(ev, id, HOLES.map(h => h.par), r); drawField(ev, r); ev.round = r + 1; }
 finish(ev);
 assert.ok(buttons(hubHtml(t)).includes('next'), 'after an event: on to the next');
 while (!seasonOver(t)) { endEvent(t, t.current || (() => { const e = startEvent(t, {personIndex: 10}); e.pars = HOLES.map(h => h.par); e.model = holeModel(HOLES, null); for (let r = 0; r < e.rounds; r++) { drawField(e, r, []); e.round = r + 1; } finish(e); return e; })()); }
 const end = hubHtml(t, {personName: 'Alex'});
 assert.ok(buttons(end).includes('season'), 'the season over: start the next');
 assert.ok(!end.includes('<b>Alex <b>'), 'names are escaped');
});

test('the start screen and the editor', () => {
 const t = quickSeason({seed: 'UI2'});
 const s = startHtml({tours: [t], active: t.id});
 for (const b of ['shipped', 'quick', 'single', 'blank', 'import', 'open', 'delete']) assert.ok(buttons(s).includes(b), b);
 const e = editorHtml(t, {courses: [{value: 'land:pacnw', label: 'A new course in Cedar Hollow'}]});
 for (const b of ['add', 'save', 'cancel', 'up', 'down', 'remove']) assert.ok(buttons(e).includes(b), b);
 assert.equal((e.match(/class="ev-name"/g) || []).length, 8);
 // A generated event shows its landscape among the choices, selected.
 const first = t.events[0].course.settings.biome;
 const e2 = editorHtml(t, {courses: [{value: `land:${first}`, label: 'Its landscape'}]});
 assert.match(e2, new RegExp(`value="land:${first}" selected`));
});

test('scores and money as a leaderboard prints them', () => {
 assert.equal(scoreText({format: 'stroke'}, 0), 'E');
 assert.equal(scoreText({format: 'stroke'}, -3), '-3');
 assert.equal(scoreText({format: 'stroke'}, 2), '+2');
 assert.equal(scoreText({format: 'stableford'}, 36), '36 pts');
 assert.equal(money(360000), '$360,000');
 assert.equal(YOU, 'you');
});
