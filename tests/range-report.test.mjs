// The range session's exports (range-report.js, pdf.js): a CSV of every shot
// and a PDF report. Neither can be looked at by a test, so these hold the
// numbers to the shot rows, the CSV to what a spreadsheet will read, and the
// PDF to the structure a reader needs -- a table of byte offsets that lands on
// every object, which is the part a hand-written PDF gets wrong.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionCsv, shotRow, clubTable, shortGameTable, sessionReport, CSV_COLUMNS} from '../src/range-report.js';
import {PdfDocument, textWidth, winAnsi} from '../src/pdf.js';

const YARD = .9144, FOOT = .3048, MPH = .44704;
const shot = (over = {}) => ({player: 0, playerName: 'Ana', club: '7 Iron', clubKey: '7 Iron', from: 'mats', green: '150 yard target',
 carry: 150 * YARD, total: 160 * YARD, apex: 30 * FOOT, offline: 4 * YARD, speed: 120 * MPH, vla: 16.3, spin: 7000, axis: -2.5, descent: 47, toPin: 30 * FOOT, holed: false, ...over});

test('a shot row is in a golfer\'s units, and keeps its side as a word', () => {
 const r = shotRow(shot(), 0);
 assert.equal(r.n, 1);
 assert.equal(r.carryYd, 150);
 assert.equal(r.totalYd, 160);
 assert.equal(r.apexFt, 30);
 assert.equal(r.ballMph, 120);
 assert.equal(r.offlineYd, 4);
 // Positive offline is the golfer's right (range.js offlineOf).
 assert.equal(r.side, 'R');
 assert.equal(shotRow(shot({offline: -3 * YARD}), 0).side, 'L');
 assert.equal(r.toPinFt, 30);
});

test('the CSV has one header and a row a shot, and a spreadsheet reads it as data', () => {
 const csv = sessionCsv([shot(), shot({playerName: '=HYPERLINK("x")', club: 'Driver', clubKey: 'Driver', holed: true})]);
 const lines = csv.trimEnd().split('\r\n');
 assert.equal(lines.length, 3);
 assert.equal(lines[0].split(',').length, CSV_COLUMNS.length);
 assert.ok(lines[1].startsWith('1,"Ana","7 Iron"'), lines[1]);
 // Numbers go out bare, not quoted -- and a negative number is never mangled
 // by the formula guard, because sides are words.
 assert.ok(lines[1].includes(',150,160,4,"R",30,'), lines[1]);
 // A name that would be a formula is opened with an apostrophe, and its quotes doubled.
 assert.ok(lines[2].includes('"\'=HYPERLINK(""x"")"'), lines[2]);
 assert.ok(lines[2].endsWith(',Yes'));
});

test('club averages and spreads are worked from the full shots only', () => {
 const shots = [shot({carry: 140 * YARD, offline: -5 * YARD}), shot({carry: 160 * YARD, offline: 5 * YARD}),
  shot({from: 'chip', carry: 20 * YARD}), shot({club: 'Driver', clubKey: 'Driver', carry: 240 * YARD, offline: 0})];
 const rows = clubTable(shots);
 assert.equal(rows.length, 2);
 assert.equal(rows[0].club, 'Driver', 'longest club first');
 const iron = rows.find(r => r.club === '7 Iron');
 assert.equal(iron.n, 2, 'the chip was counted with the full shots');
 assert.ok(Math.abs(iron.carry - 150) < 1e-9);
 assert.ok(Math.abs(iron.carrySd - 10) < 1e-9);
 assert.ok(Math.abs(iron.offline) < 1e-9);
 assert.ok(Math.abs(iron.offlineSd - 5) < 1e-9);
 assert.equal(iron.best, 160);
});

test('the short game counts how close, and how many dropped', () => {
 const rows = shortGameTable([shot({from: 'putt', toPin: 2 * FOOT}), shot({from: 'putt', toPin: 0, holed: true}),
  shot({from: 'putt', toPin: 8 * FOOT}), shot({from: 'chip', toPin: 5 * FOOT})]);
 const putts = rows.find(r => r.from === 'putt');
 assert.equal(putts.n, 3);
 assert.equal(putts.holed, 1);
 assert.equal(putts.inside3, 2);
 assert.equal(putts.inside6, 2);
 assert.ok(Math.abs(putts.average - 10 / 3) < 1e-9);
 assert.equal(rows.find(r => r.from === 'chip').n, 1);
});

// The cross-reference table is a list of byte offsets, one per object. A reader
// that finds one pointing anywhere but "N 0 obj" calls the file damaged.
function checkPdf(bytes) {
 const text = Array.from(bytes, b => String.fromCharCode(b)).join('');
 assert.ok(text.startsWith('%PDF-1.4\n'));
 assert.ok(text.trimEnd().endsWith('%%EOF'));
 const start = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1]);
 assert.equal(text.slice(start, start + 4), 'xref');
 const [, count] = text.slice(start).match(/xref\n0 (\d+)\n/);
 const entries = text.slice(start).split('\n').slice(3, 3 + Number(count) - 1);
 entries.forEach((e, i) => {
  const at = Number(e.slice(0, 10));
  assert.equal(text.slice(at, at + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`, `object ${i + 1}'s offset is wrong`);
 });
 // Every stream's stated length is its real length.
 for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
  const body = m.index + m[0].length;
  assert.equal(text.slice(body + Number(m[1]), body + Number(m[1]) + 10), '\nendstream');
 }
 return text;
}

test('the PDF writer makes a file a reader accepts', () => {
 const doc = new PdfDocument({title: 'Test (one)'});
 const p = doc.addPage();
 p.text(40, 60, 'Hello (world) \\ 45° ± 3 — done');
 p.line(40, 70, 300, 70);p.rect(40, 80, 100, 20, {fill: '#294e3c'});p.circle(200, 200, 10, {stroke: '#000'});p.ellipse(300, 300, 20, 10, .3, {stroke: '#123456'});
 doc.addPage().text(40, 40, 'second');
 const text = checkPdf(doc.bytes());
 assert.ok(text.includes('/Count 2'));
 // Brackets and backslashes escaped; degrees, plus-minus and the dash in WinAnsi.
 assert.ok(text.includes('(Hello \\(world\\) \\\\ 45\xb0 \xb1 3 \x97 done)'));
 assert.equal(winAnsi('a\u{1F600}b'), 'a?b');
 assert.equal(textWidth('00', 10), 11.12);
});

test('a session report is a well-formed PDF with a page per golfer and the shot list', () => {
 const shots = [];
 for (let i = 0; i < 30; i++) shots.push(shot({carry: (140 + i % 7) * YARD, offline: (i % 5 - 2) * YARD}));
 for (let i = 0; i < 25; i++) shots.push(shot({player: 1, playerName: 'Ben', club: 'Driver', clubKey: 'Driver', carry: (230 + i % 9) * YARD}));
 for (let i = 0; i < 12; i++) shots.push(shot({from: 'putt', toPin: i * FOOT, holed: i === 0}));
 const text = checkPdf(sessionReport({shots, when: new Date(2026, 9, 16, 15, 30), place: 'Pacific Northwest', greens: ['Centre green: 150 yd, flat']}));
 // One summary page, two golfers' charts, and 67 shots at 40 a page.
 assert.ok(text.includes('/Count 5'), text.match(/\/Count \d+/)[0]);
 for (const s of ['Driving range session', 'FULL SHOTS BY CLUB', 'SHORT GAME', 'Ana: where the full shots went', 'Ben: where the full shots went', 'Every shot \\(continued\\)','Centre green: 150 yd, flat'])
  assert.ok(text.includes(s), `the report is missing "${s}"`);
});

test('an empty session still makes a report', () => {
 const text = checkPdf(sessionReport({shots: []}));
 assert.ok(text.includes('No shots were hit this session.'));
 assert.ok(text.includes('/Count 1'));
});
