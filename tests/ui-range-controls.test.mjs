import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionRows} from '../src/ui-range-controls.js';
import {clubTable} from '../src/range-report.js';

// The range controls' session table: one row a club, from the same
// clubTable the PDF report is made of, so the window and the report agree.
test('the session table reads the report\'s club table: balls, average carry, spread', () => {
 const Y = 0.9144;
 const shots = [
  {player: 0, playerName: 'Ann', club: '7 Iron', clubKey: '7 Iron', from: 'mats', carry: 150 * Y, offline: 0},
  {player: 0, playerName: 'Ann', club: '7 Iron', clubKey: '7 Iron', from: 'mats', carry: 160 * Y, offline: 2},
  {player: 0, playerName: 'Ann', club: 'Driver', clubKey: 'Driver', from: 'mats', carry: 250 * Y, offline: -4},
  {player: 0, playerName: 'Ann', club: 'PW', clubKey: 'PW', from: 'chip', carry: 20 * Y, offline: 0},
 ];
 const rows = sessionRows(clubTable(shots));
 assert.deepEqual(rows.map(r => r.club), ['DRIVER', '7 IRON']);
 assert.equal(rows[1].n, 2);
 assert.equal(rows[1].carry, '155 YD');
 assert.equal(rows[1].spread, '±5');
 assert.equal(rows[0].spread, '—');
 assert.deepEqual(sessionRows([]), []);
});
