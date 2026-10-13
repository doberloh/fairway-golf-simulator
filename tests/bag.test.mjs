// THE PLAYER'S OWN BAG (12 October 2026). A bag is a list of clubs the golfer
// named, each of a kind and with a carry; it lives in their profile. What can be
// silently wrong: the stock bag flying differently from before, a bag the game
// cannot play getting saved, the putter losing the id the game looks for, and a
// profile or a backup dropping the bag on the way through.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CLUBS, CLUB_KINDS, MAX_BAG, stockBag, validateBag, bagClubs, customizeClubs} from '../src/clubs.js';
import {simulateShot, YARD} from '../src/physics.js';
import {normaliseProfile, blankProfile, setProfileBag, exportProfiles, importProfiles} from '../src/profile.js';

const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: [], pin: {x: 9e9, z: 9e9}};
const club = (kind, name = CLUB_KINDS[kind].label, carry = CLUB_KINDS[kind].carry, id = kind) => ({id, name, kind, carry});
const putter = () => club('putter');

test('the stock bag plays exactly as the old fixed clubs did', () => {
 const old = customizeClubs(), now = bagClubs(stockBag());
 assert.deepEqual(Object.keys(now), Object.keys(CLUBS), 'same clubs, same order, same ids');
 for (const [id, c] of Object.entries(old)) {
  assert.equal(now[id].label, c.label);
  assert.equal(now[id].code, c.code);
  assert.equal(now[id].vla, c.vla);
  assert.equal(now[id].spin, c.spin);
  assert.equal(now[id].speed, c.speed, `${id} flies at a different ball speed`);
 }
 // And the old device-wide distances carry straight across.
 assert.equal(bagClubs(stockBag({driver: 225})).driver.carry, 225);
});

test('every kind carries the distance the player typed', () => {
 // The kind sets launch and spin; the ball speed is solved to the carry. So a
 // kind can change the shape of a shot but never how far it goes.
 for (const [kind, k] of Object.entries(CLUB_KINDS)) {
  if (kind === 'putter') continue;
  const [c] = Object.values(bagClubs([club(kind, 'Test', 160), putter()]));
  const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: c.speed, vla: k.vla, spin: k.spin}, flat);
  assert.ok(Math.abs(r.carry / YARD - 160) < 0.6, `${kind} carried ${(r.carry / YARD).toFixed(1)} yd, wanted 160`);
 }
});

test('a bag is longest first with the putter last, whatever order it was typed in', () => {
 const ids = Object.keys(bagClubs([putter(), club('wedge'), club('driver'), club('iron7', '7 Iron', 150)]));
 assert.deepEqual(ids, ['driver', 'iron7', 'wedge', 'putter']);
});

test('the putter is always called putter, and other clubs keep their ids', () => {
 const bag = validateBag([club('driver', 'Big Dog', 260, 'abc123'), club('putter', 'Flatstick', 30, 'xyz')]);
 assert.equal(bag.find(c => c.kind === 'putter').id, 'putter');
 assert.equal(bag.find(c => c.kind === 'driver').id, 'abc123');
 // A club given the putter's id, or an id already used, gets a fresh one.
 const fixed = validateBag([club('driver', 'A', 250, 'putter'), club('wood', 'B', 220, 'dup'), club('iron5', 'C', 185, 'dup'), putter()]);
 const ids = fixed.map(c => c.id);
 assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
 assert.equal(ids.filter(id => id === 'putter').length, 1);
});

test('a bag the game cannot play is refused, with a reason', () => {
 const refuse = (bag, words) => assert.throws(() => validateBag(bag), e => words.test(e.message), `expected ${words}`);
 refuse([club('driver'), club('wood')], /needs a putter/);
 refuse([putter()], /at least one club/);
 refuse([club('driver'), putter(), {...putter(), name: 'Spare'}], /one putter/);
 refuse([club('driver', 'Same'), club('wood', 'same'), putter()], /Two clubs are called/);
 refuse([club('driver', '  '), putter()], /name/);
 refuse([club('driver', 'D', 500), putter()], /10–400/);
 refuse([club('driver'), club('putter', 'Putter', 150)], /1–100/);
 refuse([{id: 'x', name: 'X', kind: 'spork', carry: 100}, putter()], /kind/);
 const fifteen = Object.keys(CLUB_KINDS).filter(k => k !== 'putter').slice(0, MAX_BAG).map(k => club(k));
 refuse([...fifteen, putter()], /at most 14/);
 assert.equal(validateBag([...fifteen.slice(0, MAX_BAG - 1), putter()]).length, MAX_BAG, 'fourteen is allowed');
});

test('names are tidied, and two clubs of one kind can share a bag', () => {
 const bag = validateBag([club('wedge', '  50   degree ', 90, 'a'), club('wedge', '54 degree', 75, 'b'), putter()]);
 assert.equal(bag[0].name, '50 degree');
 assert.equal(Object.keys(bagClubs(bag)).length, 3);
});

test('a profile keeps its bag, drops a broken one, and reads none as stock', () => {
 const p = blankProfile('Sam');
 assert.equal(normaliseProfile(p).bag, undefined, 'a new golfer has no bag of their own yet');
 const bag = [club('driver', 'Big Dog', 260), putter()];
 assert.deepEqual(normaliseProfile({...p, bag}).bag.map(c => c.name), ['Big Dog', 'Putter']);
 const broken = normaliseProfile({...p, bag: [club('driver')]});
 assert.ok(broken, 'a broken bag must not take the profile with it');
 assert.equal(broken.bag, undefined);
});

test('setProfileBag checks the bag first and a backup carries it', () => {
 let store = null;
 const p = blankProfile('Sam');
 store = {version: 2, main: p.id, profiles: [p]};
 globalThis.localStorage ??= {setItem() {}, removeItem() {}, getItem() { return null; }};
 assert.throws(() => setProfileBag(store, p.id, [club('driver')]), /putter/);
 assert.equal(p.bag, undefined, 'a refused bag changes nothing');
 setProfileBag(store, p.id, [club('iron7', 'Seven', 150), putter()]);
 assert.equal(p.bag[0].name, 'Seven');
 const restored = importProfiles(null, exportProfiles(store)).store;
 assert.deepEqual(restored.profiles[0].bag, p.bag);
 setProfileBag(store, p.id, null);
 assert.equal(p.bag, undefined, 'null puts the golfer back on the stock bag');
});

test('the old device-wide distances become the bag of every golfer without one, once', async () => {
 const {adoptDistances} = await import('../src/profile.js');
 const a = blankProfile('Ann'), b = blankProfile('Bo');
 b.bag = validateBag([club('iron7', 'Mine', 150), putter()]);
 const store = {version: 2, main: a.id, profiles: [a, b]};
 assert.equal(adoptDistances(store, {driver: 230, putter: 25}), 1, 'only the golfer without a bag changes');
 assert.equal(a.bag.find(c => c.kind === 'driver').carry, 230);
 assert.equal(a.bag.find(c => c.kind === 'putter').carry, 25);
 assert.equal(b.bag[0].name, 'Mine', 'a bag the golfer already built is never replaced');
 assert.equal(adoptDistances({profiles: [blankProfile('Cy')]}, {driver: 999}), 0, 'distances that no longer validate are ignored');
});
