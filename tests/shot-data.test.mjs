import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOT_FIELDS, FIELD_GROUPS, fieldById, shotGrid, saveShotData, loadShotData,
 DEFAULT_FIELDS, DEFAULT_COLUMNS, COLUMN_CHOICES, MAX_FIELDS} from '../src/shot-data.js';
import {parseLaunchMessage, MPH, YARD} from '../src/physics.js';

// A shot as the game records it: what was hit, and what the model made of it.
const record = (extra = {}, result = {}) => ({
 player: 'Alex', club: '7 Iron', aim: 0,
 shot: {origin: {x: 0, y: 0, z: 0}, speed: 68 * MPH, vla: 18.4, hla: -1.2, spin: 6210, spinAxis: -3.5, extra},
 result: {carry: 150 * YARD, total: 158 * YARD, apex: 28, time: 6.2, descentAngle: 47.1,
  landingSpeed: 30 * MPH, end: {x: 0, y: 0, z: 158 * YARD}, ...result},
});

test('every field survives a record it knows nothing about', () => {
 // The grid reads from saved rounds that predate a field, from whatever JSON a
 // device chose to send, and from a flight that may have ended early. Not one
 // of those is allowed to take the card down.
 for (const junk of [null, {}, {shot: {}}, {shot: {extra: {}}, result: {}},
  {shot: {speed: 'fast', spin: null}, result: {carry: NaN, end: null}}]) {
  const grid = shotGrid(junk, {fields: SHOT_FIELDS.map(f => f.id).slice(0, MAX_FIELDS)});
  for (const cell of grid.cells) assert.equal(typeof cell.value, 'string', cell.id);
 }
});

test('a field with no reading is a dash, never a zero', () => {
 // A zero is a measurement -- "your path was dead straight". Printing one for a
 // number nobody took is the kind of lie that gets acted on.
 const grid = shotGrid(record(), {fields: ['clubSpeed', 'attack', 'path', 'smash']});
 for (const cell of grid.cells) {
  assert.equal(cell.value, '—', cell.id);
  assert.equal(cell.blank, true, cell.id);
 }
});

test('the standard set is exactly what a keyboard shot can fill', () => {
 // This is the reason the default set is what it is: a player with no launch
 // monitor must not open the game to a grid of dashes.
 const grid = shotGrid(record(), {fields: DEFAULT_FIELDS, columns: DEFAULT_COLUMNS});
 for (const cell of grid.cells) assert.equal(cell.blank, false, `${cell.id} is blank without a monitor`);
 assert.equal(grid.cells.length, DEFAULT_FIELDS.length);
});

test('the five read back the way they went in', () => {
 const grid = shotGrid(record(), {fields: ['ballSpeed', 'launch', 'direction', 'spin', 'spinAxis']});
 const cells = Object.fromEntries(grid.cells.map(c => [c.id, c.value]));
 const units = Object.fromEntries(grid.cells.map(c => [c.id, c.unit]));
 // THE SIDE GOES AFTER THE UNIT, or the degree sign ends up stranded past it.
 assert.equal(units.direction, '° L');
 assert.equal(units.spinAxis, '° L');
 assert.equal(units.ballSpeed, 'mph');
 assert.equal(cells.ballSpeed, '68.0');
 assert.equal(cells.launch, '18.4');
 // Sided readings print the side, because that is how they are spoken.
 assert.equal(cells.direction, '1.2');
 assert.equal(cells.spin, '6210');
 assert.equal(cells.spinAxis, '3.5');
});

test('face to path is derived, because no monitor sends it', () => {
 const cells = shotGrid(record({faceToTarget: 1.5, path: -2.5}), {fields: ['faceToPath']}).cells;
 assert.equal(cells[0].value, '+4.0');
 // And it stays blank when only one half arrived, rather than reading the half
 // as if it were the whole.
 assert.equal(shotGrid(record({path: -2.5}), {fields: ['faceToPath']}).cells[0].value, '—');
});

test('smash needs both speeds and says nothing without them', () => {
 assert.equal(shotGrid(record({clubSpeed: 50 * MPH}), {fields: ['smash']}).cells[0].value, '1.36');
 assert.equal(shotGrid(record({clubSpeed: 0}), {fields: ['smash']}).cells[0].value, '—');
});

test('offline is measured across the line the ball was aimed down', () => {
 // Not the distance from the green: aiming at a target and finishing beside it
 // is a straight shot.
 const cell = r => shotGrid(r, {fields: ['offline']}).cells[0];
 assert.deepEqual([cell(record({}, {end: {x: 10, y: 0, z: 100}})).value,
  cell(record({}, {end: {x: 10, y: 0, z: 100}})).unit], ['10.9', 'yd R']);
 assert.equal(cell(record({}, {end: {x: -10, y: 0, z: 100}})).unit, 'yd L');
 // Aimed 90° right, the same end point is now long rather than offline.
 assert.equal(cell({...record({}, {end: {x: 100, y: 0, z: 0}}), aim: 90}).value, '0.0');
});

test('the spin split is believed when sent and resolved when not', () => {
 const sent = shotGrid(record({backSpin: 5900, sideSpin: -400}), {fields: ['backSpin', 'sideSpin']});
 assert.equal(sent.cells[0].value, '5900');
 assert.equal(sent.cells[1].value, '400');
 assert.equal(sent.cells[1].unit, 'rpm L');
 // Without it, total and axis give the same answer the device would have.
 const derived = shotGrid(record(), {fields: ['backSpin', 'sideSpin']});
 assert.equal(derived.cells[0].value, '6198');
 assert.equal(derived.cells[1].value, '379');
});

test('a saved layout is repaired rather than rejected', () => {
 // Retiring a field later must not reset somebody's whole card.
 const kept = saveShotData({fields: ['ballSpeed', 'notAField', 'ballSpeed', 'spin'], columns: 9});
 assert.deepEqual(kept.fields, ['ballSpeed', 'spin']);
 assert.equal(kept.columns, DEFAULT_COLUMNS, 'an impossible column count falls back');
 // Nothing left after the repair means the record said nothing usable, so the
 // standard set is better than an empty card.
 assert.deepEqual(saveShotData({fields: ['nope']}).fields, DEFAULT_FIELDS);
 assert.deepEqual(saveShotData(null).fields, DEFAULT_FIELDS);
 assert.ok(COLUMN_CHOICES.includes(loadShotData().columns));
});

test('more tiles than the card holds are dropped, not stacked', () => {
 const all = saveShotData({fields: SHOT_FIELDS.map(f => f.id)});
 assert.equal(all.fields.length, MAX_FIELDS);
});

test('every field belongs to a group the panel draws', () => {
 const groups = new Set(FIELD_GROUPS.map(g => g.id));
 for (const f of SHOT_FIELDS) {
  assert.ok(groups.has(f.group), `${f.id} is in group "${f.group}", which the panel never renders`);
  assert.equal(fieldById(f.id), f);
  assert.ok(f.label && f.label.length < 20, `${f.id} needs a label that fits a tile`);
 }
 assert.equal(new Set(SHOT_FIELDS.map(f => f.id)).size, SHOT_FIELDS.length, 'duplicate field id');
});

test('a value never carries its own unit, because the tile sizes them apart', () => {
 // The number is set at tile size and the unit small beside it. A `get` that
 // returned "5400 rpm" as one string would be sized as a number and overflow
 // the column, which is how the card once printed "5400 ..." for a spin.
 const all = SHOT_FIELDS.map(f => f.id).slice(0, MAX_FIELDS);
 for (const cell of shotGrid(record({clubSpeed: 44, attack: -3, path: 1, faceToTarget: 2,
  loft: 25, lie: 60, closureRate: 40, impactVertical: 3, impactHorizontal: -2,
  deviceCarry: 140, deviceTotal: 150, backSpin: 5900, sideSpin: -400}), {fields: all}).cells) {
  assert.ok(!/[a-z]{2}/.test(cell.value.replace('—', '')),
   `${cell.id} put a unit in its value: "${cell.value}"`);
  assert.ok(cell.value.length <= 7, `${cell.id} is too long for a tile: "${cell.value}"`);
 }
});

// ---------------------------------------------------------------- the parser
const shot = (extra = {}) => JSON.stringify({
 DeviceID: 'Test', Units: 'Yards', ShotNumber: 1, APIversion: '1',
 BallData: {Speed: 152.1, SpinAxis: -3.5, TotalSpin: 6210, HLA: -1.2, VLA: 18.4, ...extra.ball},
 ShotDataOptions: {ContainsBallData: true, ContainsClubData: !!extra.club},
 ...(extra.club ? {ClubData: extra.club} : {}),
});

test('club data is carried through without touching the five', () => {
 const p = parseLaunchMessage(shot({club: {Speed: 108.4, AngleOfAttack: -4.2, Path: 1.1,
  FaceToTarget: 2.3, Loft: 26.5, Lie: 61, ClosureRate: 42, VerticalFaceImpact: 3.1,
  HorizontalFaceImpact: -2.4, SpeedAtImpact: 107.9}}));
 assert.ok(Math.abs(p.speed - 152.1 * MPH) < 1e-9, 'the five are unchanged');
 assert.ok(Math.abs(p.extra.clubSpeed - 108.4 * MPH) < 1e-9, 'club speed reaches SI');
 assert.equal(p.extra.attack, -4.2);
 assert.equal(p.extra.faceToTarget, 2.3);
 assert.equal(p.extra.impactHorizontal, -2.4);
});

test('NOTHING IN THE EXTRAS MAY REJECT A SHOT', () => {
 // The five are validated hard because a bad one means the model cannot run.
 // These are the opposite case: they reach a readout and nothing else, so a
 // device sending nonsense in ClubData must not stop a real ball being played.
 for (const club of [{Speed: 'fast'}, {Speed: NaN}, {AngleOfAttack: null}, {Path: Infinity},
  {Loft: {}}, {VerticalFaceImpact: []}, {Speed: -9999, Lie: 1e9}]) {
  const p = parseLaunchMessage(shot({club}));
  assert.ok(p && p.speed > 0, `a shot was rejected over ${JSON.stringify(club)}`);
 }
 // A ClubData that is not even an object, which is the shape a broken connector
 // actually sends.
 for (const club of ['nope', 42, true]) {
  const raw = JSON.parse(shot());
  raw.ClubData = club;
  assert.ok(parseLaunchMessage(raw).speed > 0);
 }
});

test('an absent reading is absent, not undefined forever', () => {
 // A saved round carries these per shot; a dozen undefineds each is noise.
 const p = parseLaunchMessage(shot());
 assert.deepEqual(Object.keys(p.extra), [], 'a device sending only the five stores only the five');
 const some = parseLaunchMessage(shot({club: {Speed: 100, Path: 2}}));
 assert.deepEqual(Object.keys(some.extra).sort(), ['clubSpeed', 'path']);
});

test('metric devices are converted at the boundary like the five are', () => {
 const raw = JSON.parse(shot({club: {Speed: 160}}));           // km/h
 raw.Units = 'Meters';
 raw.BallData.Speed = 220;                                      // km/h
 raw.BallData.CarryDistance = 140;                              // metres
 const p = parseLaunchMessage(raw);
 assert.ok(Math.abs(p.extra.clubSpeed - 160 / 3.6) < 1e-9);
 assert.ok(Math.abs(p.extra.deviceCarry - 140) < 1e-9);
 // And yards elsewhere: the device's own carry is metres in the record either way.
 const yards = parseLaunchMessage(shot({ball: {CarryDistance: 153}}));
 assert.ok(Math.abs(yards.extra.deviceCarry - 153 * YARD) < 1e-9);
});

test("the monitor's own distances are labelled as the monitor's", () => {
 // Ours and theirs will not agree, and a player comparing them has to be able
 // to see which is which.
 const r = record({deviceCarry: 150 * YARD});
 const cells = shotGrid(r, {fields: ['carry', 'deviceCarry']}).cells;
 assert.ok(/monitor/i.test(cells[1].label), 'the device figure must say so');
 assert.ok(!/monitor/i.test(cells[0].label), 'ours must not');
});
