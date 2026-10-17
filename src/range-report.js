// A range session, taken home: a spreadsheet of every shot, and a report.
//
// The owner's ask (16 October 2026): export the range to CSV, and a PDF with
// richer data. Both are built from the session's shot rows (main.js
// `recordRangeShot`), which have carried the launch numbers since the range
// began; nothing here re-derives a shot. Pure -- no DOM, no three.js -- so the
// numbers and the file are checked in Node (tests/range-report.test.mjs);
// main.js only hands the bytes to the browser to save.
//
// UNITS. Rows are kept in the game's units (metres, metres a second, degrees,
// rpm); the files are in a golfer's: yards for carry, total and offline, feet
// for apex and for a short-game finish, mph for ball speed.
import {PdfDocument, PAGE, textWidth} from './pdf.js';

const YARD = 0.9144, FOOT = 0.3048, MPH = 0.44704;
const finite = v => Number.isFinite(v);
const round = (v, d = 1) => finite(v) ? Number(v.toFixed(d)) : null;
export const HIT_FROM = {mats: 'Mats', chip: 'Chip', putt: 'Putt'};

// A row in the player's units, the one shape both files read.
export function shotRow(s, i) {
 const from = s.from || 'mats';
 return {
  n: i + 1, golfer: s.playerName ?? 'Player', club: s.clubKey ?? s.club ?? '',
  source: s.club === 'Launch monitor' ? 'Launch monitor' : 'Swing',
  from, hitFrom: HIT_FROM[from] ?? from, target: s.green ?? '',
  ballMph: round(s.speed / MPH), launch: round(s.vla), spin: round(s.spin, 0), axis: round(s.axis),
  carryYd: round(s.carry / YARD), totalYd: round(s.total / YARD),
  // Offline keeps its side as a word, so a spreadsheet never mistakes a
  // left-hand miss for a formula and nobody has to remember which sign is right.
  offlineYd: round(Math.abs(s.offline) / YARD), side: !finite(s.offline) ? '' : Math.abs(s.offline) < .05 ? '' : s.offline > 0 ? 'R' : 'L',
  apexFt: round(s.apex / FOOT, 0), descent: round(s.descent),
  toPinFt: round(s.toPin / FOOT), holed: !!s.holed,
 };
}

// A CSV cell. Numbers go out as numbers. Text that a spreadsheet would read as
// a formula -- a name starting with =, +, - or @ -- is opened with an
// apostrophe, the same guard the scorecard's export uses.
const cell = v => {
 if (v === null || v === undefined) return '';
 if (typeof v === 'number') return String(v);
 if (typeof v === 'boolean') return v ? 'Yes' : 'No';
 const s = String(v).replace(/^[=+@-]/, "'$&");
 return '"' + s.replaceAll('"', '""') + '"';
};
export const CSV_COLUMNS = [
 ['Shot', 'n'], ['Golfer', 'golfer'], ['Club', 'club'], ['Source', 'source'], ['Hit from', 'hitFrom'], ['Green', 'target'],
 ['Ball speed (mph)', 'ballMph'], ['Launch angle (deg)', 'launch'], ['Spin (rpm)', 'spin'], ['Spin axis (deg)', 'axis'],
 ['Carry (yd)', 'carryYd'], ['Total (yd)', 'totalYd'], ['Offline (yd)', 'offlineYd'], ['Offline side', 'side'],
 ['Apex (ft)', 'apexFt'], ['Descent (deg)', 'descent'], ['Finish to cup (ft)', 'toPinFt'], ['Holed', 'holed'],
];
export function sessionCsv(shots) {
 const rows = shots.map(shotRow);
 return [CSV_COLUMNS.map(c => cell(c[0])).join(','), ...rows.map(r => CSV_COLUMNS.map(c => cell(r[c[1]])).join(','))].join('\r\n') + '\r\n';
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
// The spread as a standard deviation, as the range's own readout has it: one
// shank should not describe a session.
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };

// Each golfer's full shots (off the mats), by club, in bag order of distance.
export function clubTable(shots) {
 const groups = new Map();
 for (const s of shots) {
  if ((s.from || 'mats') !== 'mats') continue;
  const key = `${s.player ?? 0}|${s.clubKey ?? s.club}`;
  if (!groups.has(key)) groups.set(key, {golfer: s.playerName ?? 'Player', player: s.player ?? 0, club: s.clubKey ?? s.club, shots: []});
  groups.get(key).shots.push(s);
 }
 return [...groups.values()].map(g => {
  const v = k => g.shots.map(s => s[k]).filter(finite);
  const carry = v('carry'), off = v('offline');
  return {
   golfer: g.golfer, player: g.player, club: g.club, n: g.shots.length,
   carry: mean(carry) / YARD, carrySd: sd(carry) === null ? null : sd(carry) / YARD,
   best: carry.length ? Math.max(...carry) / YARD : null,
   total: mean(v('total')) / YARD,
   offline: mean(off) === null ? null : mean(off) / YARD, offlineSd: sd(off) === null ? null : sd(off) / YARD,
   ball: mean(v('speed')) / MPH, launch: mean(v('vla')), spin: mean(v('spin')), apex: mean(v('apex')) / FOOT,
   points: g.shots.filter(s => finite(s.carry) && finite(s.offline)).map(s => ({carry: s.carry / YARD, offline: s.offline / YARD})),
  };
 }).sort((a, b) => a.player - b.player || b.carry - a.carry);
}

// Chips and putts, by golfer and kind: how close they finished, and how many dropped.
export function shortGameTable(shots) {
 const groups = new Map();
 for (const s of shots) {
  const from = s.from || 'mats';
  if (from === 'mats' || !finite(s.toPin)) continue;
  const key = `${s.player ?? 0}|${from}`;
  if (!groups.has(key)) groups.set(key, {golfer: s.playerName ?? 'Player', player: s.player ?? 0, from, shots: []});
  groups.get(key).shots.push(s);
 }
 return [...groups.values()].map(g => {
  const ft = g.shots.map(s => s.holed ? 0 : s.toPin / FOOT);
  return {golfer: g.golfer, player: g.player, from: g.from, kind: HIT_FROM[g.from], n: g.shots.length,
   holed: g.shots.filter(s => s.holed).length, average: mean(ft), best: Math.min(...ft),
   inside3: ft.filter(f => f <= 3).length, inside6: ft.filter(f => f <= 6).length,
   finishes: g.shots.map(s => s.holed ? 0 : s.toPin / FOOT)};
 }).sort((a, b) => a.player - b.player || a.from.localeCompare(b.from));
}

// Colours for clubs on the charts: distinct in hue and in lightness, so a
// golfer who does not see red and green apart still tells two clubs apart.
export const CLUB_INK = ['#1f5f9e', '#d9822b', '#2e8b57', '#b8336a', '#6a4c9c', '#8c6d1f', '#20909a', '#c0504d', '#4b5d6b', '#7a9a2e', '#9c5b8f', '#3d7ea6', '#b5651d', '#556b2f'];

const fmt = (v, d = 0) => finite(v) ? v.toFixed(d) : '—';
const INK = '#1d2a22', SOFT = '#5b6b60', RULE = '#c9d2c4', BAND = '#eef3ea', GREEN = '#294e3c';
const M = 42, WIDTH = PAGE.width - 2 * M;

function header(page, title, sub, n, of) {
 page.rect(0, 0, PAGE.width, 64, {fill: GREEN});
 page.text(M, 30, 'fairway.', {size: 18, bold: true, color: '#f4f7ef'});
 page.text(M, 50, title, {size: 10, color: '#cfe0c8'});
 page.text(PAGE.width - M, 30, sub, {size: 9, color: '#cfe0c8', align: 'right'});
 page.text(PAGE.width - M, PAGE.height - 22, `Page ${n} of ${of}`, {size: 8, color: SOFT, align: 'right'});
 page.text(M, PAGE.height - 22, 'Made by Fairway from this session’s shots. Distances are the ball model’s, not a measurement.', {size: 7.5, color: SOFT});
}

// A table: columns of {label, width, align, get}. Returns the y it ended at.
function table(page, x, y, cols, rows, {size = 8.5, line = 15} = {}) {
 let cx = x;
 page.rect(x, y - 11, cols.reduce((a, c) => a + c.width, 0), line, {fill: BAND});
 for (const c of cols) {
  page.text(c.align === 'right' ? cx + c.width - 4 : cx + 4, y, c.label, {size: size - .5, bold: true, color: SOFT, align: c.align === 'right' ? 'right' : 'left'});
  cx += c.width;
 }
 y += line;
 for (const r of rows) {
  cx = x;
  for (const c of cols) {
   let s = String(c.get(r) ?? '');
   const room = c.width - 8;
   while (s.length > 1 && textWidth(s, size) > room) s = s.slice(0, -2) + '…';
   page.text(c.align === 'right' ? cx + c.width - 4 : cx + 4, y, s, {size, color: c.color?.(r) ?? INK, align: c.align === 'right' ? 'right' : 'left'});
   cx += c.width;
  }
  page.line(x, y + 4, x + cols.reduce((a, c) => a + c.width, 0), y + 4, {width: .3, color: RULE});
  y += line;
 }
 return y;
}

// "Nice" axis steps: 1, 2 or 5 times a power of ten.
function niceStep(span, ticks = 6) {
 const raw = span / ticks, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
 return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

// The dispersion chart: every full shot, from above, the mats at the bottom.
// Offline across (right of the aim line to the right, as a golfer sees it),
// carry up. Each club its colour, with a one-SD ellipse round its centre.
function dispersionChart(page, x, y, w, h, rows, inkOf) {
 const pts = rows.flatMap(r => r.points);
 const maxCarry = Math.max(50, ...pts.map(p => p.carry)) * 1.08;
 const reach = Math.max(15, ...pts.map(p => Math.abs(p.offline))) * 1.15;
 const sx = v => x + w / 2 + v / reach * (w / 2), sy = v => y + h - v / maxCarry * h;
 page.rect(x, y, w, h, {fill: '#f6f9f3', stroke: RULE});
 const step = niceStep(maxCarry, 6);
 for (let c = step; c < maxCarry; c += step) {
  page.line(x, sy(c), x + w, sy(c), {width: .3, color: RULE});
  page.text(x - 4, sy(c) + 3, `${Math.round(c)}`, {size: 7, color: SOFT, align: 'right'});
 }
 const across = niceStep(reach, 3);
 for (let o = -Math.floor(reach / across) * across; o <= reach; o += across) {
  page.line(sx(o), y, sx(o), y + h, {width: o === 0 ? .8 : .3, color: o === 0 ? SOFT : RULE, dash: o === 0 ? [3, 2] : null});
  page.text(sx(o), y + h + 10, o === 0 ? 'aim' : `${Math.abs(Math.round(o))} ${o > 0 ? 'R' : 'L'}`, {size: 7, color: SOFT, align: 'center'});
 }
 page.text(x - 4, y - 6, 'carry yd', {size: 7, color: SOFT, align: 'right'});
 for (const r of rows) {
  const ink = inkOf(r);
  if (r.points.length >= 3 && finite(r.carrySd) && finite(r.offlineSd))
   page.ellipse(sx(r.offline), sy(r.carry), Math.max(1, r.offlineSd / reach * (w / 2)), Math.max(1, r.carrySd / maxCarry * h), 0, {stroke: ink, width: .9});
  for (const p of r.points) page.circle(sx(p.offline), sy(p.carry), 2.1, {fill: ink});
 }
}

// Carry by club: the average as a bar, every shot as a tick, best and worst as
// a whisker -- how far, and how reliably.
function carryChart(page, x, y, w, rows, inkOf) {
 const max = Math.max(50, ...rows.flatMap(r => r.points.map(p => p.carry))) * 1.05, bar = 13, gap = 7, label = 92;
 const sx = v => x + label + v / max * (w - label - 8);
 rows.forEach((r, i) => {
  const yy = y + i * (bar + gap), ink = inkOf(r);
  page.text(x, yy + 10, r.club, {size: 8.5, color: INK});
  page.rect(sx(0), yy, sx(r.carry) - sx(0), bar, {fill: ink});
  const c = r.points.map(p => p.carry);
  if (c.length > 1) page.line(sx(Math.min(...c)), yy + bar / 2, sx(Math.max(...c)), yy + bar / 2, {width: .8, color: INK});
  for (const v of c) page.line(sx(v), yy + 2, sx(v), yy + bar - 2, {width: .7, color: '#ffffff'});
  page.text(sx(r.carry) + 4 + (c.length > 1 ? Math.max(0, sx(Math.max(...c)) - sx(r.carry)) : 0), yy + 10, `${fmt(r.carry)} yd`, {size: 8, color: SOFT});
 });
 return y + rows.length * (bar + gap);
}

// The whole report. `session` = {shots, when (Date), place, greens: [lines]}.
export function sessionReport(session) {
 const shots = session.shots || [], when = session.when instanceof Date ? session.when : new Date();
 const doc = new PdfDocument({title: 'Fairway range session'});
 const clubs = clubTable(shots), short = shortGameTable(shots);
 const golfers = [...new Map(shots.map(s => [s.player ?? 0, s.playerName ?? 'Player'])).entries()].sort((a, b) => a[0] - b[0]);
 const dateText = when.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'}) + ' · ' + when.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
 const pages = [];

 // PAGE ONE: the session at a glance, and every club's numbers.
 const first = doc.addPage();pages.push(first);
 let y = 96;
 first.text(M, y, 'Driving range session', {size: 22, bold: true, color: INK});y += 20;
 first.text(M, y, `${dateText}${session.place ? ' · ' + session.place : ''}`, {size: 10, color: SOFT});y += 26;
 const full = shots.filter(s => (s.from || 'mats') === 'mats').length, chips = shots.filter(s => s.from === 'chip').length, putts = shots.filter(s => s.from === 'putt').length;
 const tiles = [['Shots', shots.length], ['Full shots', full], ['Chips', chips], ['Putts', putts], ['Golfers', golfers.length]];
 tiles.forEach(([k, v], i) => {
  const tw = (WIDTH - 4 * 8) / 5, tx = M + i * (tw + 8);
  first.rect(tx, y, tw, 46, {fill: BAND});
  first.text(tx + 10, y + 26, String(v), {size: 19, bold: true, color: GREEN});
  first.text(tx + 10, y + 39, k.toUpperCase(), {size: 7, color: SOFT});
 });
 y += 66;
 if (session.greens?.length) {
  first.text(M, y, 'THE GREENS', {size: 8, bold: true, color: SOFT});y += 13;
  for (const line of session.greens) { first.text(M, y, line, {size: 9, color: INK}); y += 13; }
  y += 8;
 }
 if (clubs.length) {
  first.text(M, y, 'FULL SHOTS BY CLUB', {size: 8, bold: true, color: SOFT});y += 16;
  const multi = golfers.length > 1;
  const cols = [
   ...(multi ? [{label: 'Golfer', width: 54, get: r => r.golfer}] : []),
   {label: 'Club', width: multi ? 54 : 92, get: r => r.club},
   {label: 'Shots', width: 34, align: 'right', get: r => r.n},
   {label: 'Carry', width: 40, align: 'right', get: r => fmt(r.carry)},
   {label: '± carry', width: 42, align: 'right', get: r => fmt(r.carrySd, 1)},
   ...(multi ? [] : [{label: 'Best', width: 36, align: 'right', get: r => fmt(r.best)}]),
   {label: 'Total', width: 38, align: 'right', get: r => fmt(r.total)},
   {label: 'Offline', width: 46, align: 'right', get: r => !finite(r.offline) ? '—' : `${fmt(Math.abs(r.offline), 1)} ${r.offline >= 0 ? 'R' : 'L'}`},
   {label: '± side', width: 38, align: 'right', get: r => fmt(r.offlineSd, 1)},
   {label: 'Ball mph', width: 44, align: 'right', get: r => fmt(r.ball, 1)},
   {label: 'Launch', width: 38, align: 'right', get: r => fmt(r.launch, 1)},
   {label: 'Spin', width: 40, align: 'right', get: r => fmt(r.spin)},
   {label: 'Apex ft', width: 38, align: 'right', get: r => fmt(r.apex)},
  ];
  y = table(first, M, y, cols, clubs);
  first.text(M, y + 2, 'Yards unless marked. ± is one standard deviation: two shots in three land within it.', {size: 7.5, color: SOFT});
  y += 22;
 }
 if (short.length) {
  first.text(M, y, 'SHORT GAME', {size: 8, bold: true, color: SOFT});y += 16;
  y = table(first, M, y, [
   {label: 'Golfer', width: 90, get: r => r.golfer}, {label: 'Played', width: 60, get: r => r.kind === 'Chip' ? 'Chips' : 'Putts'},
   {label: 'Balls', width: 44, align: 'right', get: r => r.n}, {label: 'Holed', width: 44, align: 'right', get: r => r.holed},
   {label: 'Average finish', width: 86, align: 'right', get: r => `${fmt(r.average, 1)} ft`},
   {label: 'Closest', width: 60, align: 'right', get: r => r.best === 0 ? 'holed' : `${fmt(r.best, 1)} ft`},
   {label: 'Inside 3 ft', width: 66, align: 'right', get: r => `${r.inside3} of ${r.n}`},
   {label: 'Inside 6 ft', width: 66, align: 'right', get: r => `${r.inside6} of ${r.n}`},
  ], short);
 }
 if (!shots.length) first.text(M, y, 'No shots were hit this session.', {size: 11, color: SOFT});

 // ONE CHART PAGE A GOLFER who hit full shots: where they went, how far.
 for (const [player, name] of golfers) {
  const mine = clubs.filter(r => r.player === player);
  if (!mine.length) continue;
  const page = doc.addPage();pages.push(page);
  const inkOf = r => CLUB_INK[mine.indexOf(r) % CLUB_INK.length];
  let py = 96;
  page.text(M, py, `${name}: where the full shots went`, {size: 16, bold: true, color: INK});py += 16;
  page.text(M, py, 'From above, the mats at the bottom. Each dot is a shot’s carry; each ring holds about two in three of that club’s.', {size: 8.5, color: SOFT});py += 18;
  dispersionChart(page, M + 26, py, WIDTH - 150, 330, mine, inkOf);
  // The key, beside the chart.
  mine.forEach((r, i) => {
   const ky = py + 8 + i * 15;
   page.circle(PAGE.width - M - 110, ky - 3, 3.5, {fill: inkOf(r)});
   page.text(PAGE.width - M - 100, ky, `${r.club} (${r.n})`, {size: 8.5, color: INK});
  });
  py += 360;
  page.text(M, py, 'Carry by club', {size: 12, bold: true, color: INK});py += 8;
  page.text(M, py + 6, 'Bar: average. Line: shortest to longest. Ticks: every shot.', {size: 8, color: SOFT});py += 18;
  carryChart(page, M, py, WIDTH, mine, inkOf);
 }

 // EVERY SHOT, as the CSV has them.
 const rows = shots.map(shotRow), per = 40;
 for (let i = 0; i < rows.length; i += per) {
  const page = doc.addPage();pages.push(page);
  page.text(M, 96, i ? 'Every shot (continued)' : 'Every shot', {size: 14, bold: true, color: INK});
  table(page, M, 120, [
   {label: '#', width: 24, align: 'right', get: r => r.n}, {label: 'Golfer', width: 52, get: r => r.golfer},
   {label: 'Club', width: 54, get: r => r.club}, {label: 'From', width: 34, get: r => r.hitFrom},
   {label: 'Green', width: 50, get: r => r.target},
   {label: 'mph', width: 32, align: 'right', get: r => fmt(r.ballMph, 1)}, {label: 'Launch', width: 36, align: 'right', get: r => fmt(r.launch, 1)},
   {label: 'Spin', width: 36, align: 'right', get: r => fmt(r.spin)}, {label: 'Axis', width: 30, align: 'right', get: r => fmt(r.axis, 1)},
   {label: 'Carry', width: 34, align: 'right', get: r => fmt(r.carryYd, 1)}, {label: 'Total', width: 34, align: 'right', get: r => fmt(r.totalYd, 1)},
   {label: 'Offline', width: 40, align: 'right', get: r => r.offlineYd === null ? '—' : `${fmt(r.offlineYd, 1)} ${r.side}`},
   {label: 'Apex', width: 30, align: 'right', get: r => fmt(r.apexFt)},
   {label: 'To cup', width: 40, align: 'right', get: r => r.holed ? 'holed' : r.toPinFt === null ? '—' : `${fmt(r.toPinFt, 1)} ft`},
  ], rows.slice(i, i + per), {size: 7.5, line: 14});
 }
 pages.forEach((p, i) => header(p, 'Range session report', dateText, i + 1, pages.length));
 return doc.bytes();
}
