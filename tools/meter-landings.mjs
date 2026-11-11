// What the Swing Meter's own shots do when they land: the table the documents
// quote. Every club that is hit at a green, at its stock spin and with spin
// added, on each green firmness, from the fairway and out of the rough. It
// flies the real swing (swing-meter.js) through the real ball (physics.js);
// nothing is recomputed here.
//
//   node tools/meter-landings.mjs            the table
//   node tools/meter-landings.mjs --sweep    the furthest any stock shot comes back
//   node tools/meter-landings.mjs --stimp 12
import {CLUB_KINDS, bagClubs, stockBag} from '../src/clubs.js';
import {simulateShot, YARD} from '../src/physics.js';
import {swingLaunch} from '../src/swing-meter.js';
import {turfConfig, FIRMNESS_NAMES} from '../src/turf.js';

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const stimp = +(opt('--stimp') ?? 10);
// The stock bag with the gap and lob wedges added in place of two long clubs,
// so all four wedges are flown.
const extra = ['gap', 'lob'].map(kind => ({id: kind, name: CLUB_KINDS[kind].label, kind, carry: CLUB_KINDS[kind].carry}));
const bag = bagClubs([...stockBag().filter(c => !['iron3', 'iron4', 'hybrid'].includes(c.id)).slice(0, 12), ...extra]);
const IDS = ['iron7', 'iron9', 'wedge', 'gap', 'sand', 'lob'].filter(id => bag[id]);

// A level course that is green everywhere, or tilted up toward the golfer's
// target by `rise` (a fraction: .02 is a 2% upslope into the shot).
const course = (surface, rise = 0) => ({height: (x, z) => rise * z, surface: () => surface, bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: []});
function play(id, {lie = 'fairway', shape = {}, power = 1, firmness = 'medium', rise = 0, short = false} = {}) {
 const turf = turfConfig({stimp, greenFirmness: firmness, courseFirmness: 'medium'});
 const club = bag[id];
 const out = swingLaunch({power, error: 0}, {club, shape, short, lie, difficulty: 'normal', turf});
 const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, ...out.shot}, course('green', rise), {turf});
 return {spin: out.shot.spin, carry: r.carry / YARD, run: (r.total - r.carry) / YARD, landingSpin: r.landingSpin, bounces: r.bounces};
}
const n = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);

if (args.includes('--sweep')) {
 let worst = {run: 1e9};
 for (const id of Object.keys(bag)) {
  if (bag[id].code === 'PT') continue;
  for (const height of ['low', 'normal', 'high']) for (const short of [false, true]) for (const firmness of FIRMNESS_NAMES)
   for (const power of [.3, .5, .7, .85, 1, 1.05]) for (const rise of [0, .02]) {
    const r = play(id, {shape: {height}, short, firmness, power, rise});
    if (r.run < worst.run) worst = {...r, id, height, short, firmness, power, rise};
   }
 }
 console.log(`Stimp ${stimp}: the furthest a stock-spin shot comes back is ${n(worst.run)} yd`);
 console.log(` ${bag[worst.id].label}, ${worst.height}${worst.short ? ' (short game)' : ''}, ${Math.round(worst.power * 100)}% swing, ${worst.firmness} green, ${worst.rise ? 'into a 2% rise' : 'level'}; ${Math.round(worst.spin)} rpm`);
} else {
 console.log(`Full swings landing on a level green, Stimp ${stimp}. Run is yards past where the ball first landed (minus = came back).\n`);
 console.log('club          spin    carry   soft   medium  firm  | spin +3: soft  medium  firm  | from rough: spin   medium');
 for (const id of IDS) {
  const stock = FIRMNESS_NAMES.map(f => play(id, {firmness: f})), more = FIRMNESS_NAMES.map(f => play(id, {firmness: f, shape: {spin: 3}}));
  const rough = play(id, {lie: 'rough'});
  console.log(`${bag[id].label.padEnd(13)} ${String(Math.round(stock[1].spin)).padStart(5)}  ${stock[1].carry.toFixed(0).padStart(5)}   ${stock.map(r => n(r.run).padStart(5)).join('  ')}  |          ${more.map(r => n(r.run).padStart(5)).join('  ')}  |      ${String(Math.round(rough.spin)).padStart(9)}   ${n(rough.run).padStart(5)}`);
 }
}
