// CHALLENGES (Phase 7, 14 October 2026; the agreed spec, 8.1).
//
// Four, each opened by a level (the reward table lists them too):
//   closest  L3   five balls at a par 3; how near the pin each finishes
//   long     L6   six drives down a fairway; the longest that stays on it
//   updown   L12  five drops at seeded spots round a green; strokes to hole out
//   skins    L18  nine holes, two to four golfers, a skin a hole, ties carry
// They play on existing courses -- the course of the week or a saved one; the
// level only opens them. The first three are a practice game like the range:
// no card, no round history, no handicap, no hole XP, only their own XP and
// records. Skins is an ordinary stroke round with skins counted over it, so
// the four round formats stay as they were (spec: "a challenge, not a new
// round format").
//
// Pure: what a ball scored, where the drops go, who won which skin. main.js
// runs the turns. Amounts are the spec's; definitions marked PLACED are not.

export const CHALLENGES = [
 {id: 'closest', name: 'Closest to the pin', level: 3, balls: 5, how: 'Five balls at a par 3. Each one inside 20 feet earns 10 XP; a new best, 50.'},
 {id: 'long', name: 'Long drive', level: 6, balls: 6, how: 'Six drives down a fairway. The longest that stays on the fairway counts; a new best earns 50 XP.'},
 {id: 'updown', name: 'Up and down', level: 12, balls: 5, how: 'Five drops round a green. Hole out from each; every one in two strokes or fewer earns 20 XP.'},
 {id: 'skins', name: 'Skins game', level: 18, how: 'Nine holes for two to four golfers. The lowest score alone wins the hole\'s skin; a tie carries it on. 30 XP a skin.'},
];
export const challenge = id => CHALLENGES.find(c => c.id === id) || null;
export const CHALLENGE_XP = {closeBall: 10, closeFeet: 20, best: 50, upDown: 20, skin: 30};
// How many strokes an up-and-down drop may take before it is picked up. PLACED.
export const UPDOWN_GIVE_UP = 8;
const FOOT = .3048, YARD = .9144;

// Which hole a challenge plays: the first par 3 for closest to the pin; the
// longest par 5 (or par 4 when there is none) for the long drive, where there
// is fairway to land on; the first par 4 for up and down. -1 when the course
// has no such hole. `holes` is [{par, length}].
export function pickHole(holes, id) {
 const idx = holes.map((h, i) => ({...h, i}));
 if (id === 'closest') return idx.find(h => h.par === 3)?.i ?? -1;
 if (id === 'long') { const pool = idx.filter(h => h.par === 5).length ? idx.filter(h => h.par === 5) : idx.filter(h => h.par === 4); return pool.sort((a, b) => (b.length || 0) - (a.length || 0))[0]?.i ?? -1; }
 if (id === 'updown') return idx.find(h => h.par === 4)?.i ?? idx[0]?.i ?? -1;
 return -1;
}
// CLOSEST: feet from the pin where the ball stopped, or null in a hazard.
export const closestFeet = (end, pin, hazard) => hazard || !end ? null : Math.hypot(end.x - pin.x, end.z - pin.z) / FOOT;
// LONG DRIVE: yards from the tee, level, if it stopped on the fairway. PLACED:
// "in play" is the fairway itself -- a long-drive grid -- not the first cut.
export const driveYards = (origin, end, rest, hazard) => hazard || rest !== 'fairway' ? null : Math.hypot(end.x - origin.x, end.z - origin.z) / YARD;

// UP AND DOWN: `n` spots round the green, the same for the same seed. Each is
// off the putting surface by 3 to 18 yards (`edge`, metres from the green's
// edge, negative inside), on ground a chip is played from -- fringe, the cuts,
// fairway or sand -- and never in water, out of bounds, or on a tee. They are
// spread round the green rather than bunched. PLACED.
export function upDownSpots({pin, surface, edge}, seed, n = 5) {
 let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
 const rnd = () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
 const OK = ['fringe', 'semi', 'rough', 'fairway', 'sand'], out = [];
 for (let k = 0; k < n; k++) {
  for (let tries = 0; tries < 200; tries++) {
   const a = (k + rnd()) / n * Math.PI * 2, r = 4 + rnd() * 40;
   const p = {x: pin.x + Math.sin(a) * r, z: pin.z + Math.cos(a) * r}, e = edge(p.x, p.z);
   if (e >= 3 * YARD && e <= 18 * YARD && OK.includes(surface(p.x, p.z))) { out.push(p); break; }
  }
 }
 return out;
}
export const isUpAndDown = strokes => Number.isFinite(strokes) && strokes <= 2;

// SKINS over a stroke card. `cards` is each golfer's scores by hole. A hole
// all have finished goes to the one lowest score, with the skins carried to it;
// a tie carries this hole's skin and those before it on. Skins still carried
// after the last hole are unclaimed.
export function skins(cards, holes) {
 const won = cards.map(() => 0), perHole = [];
 let carry = 0;
 for (let h = 0; h < holes; h++) {
  const s = cards.map(c => c[h]);
  if (!s.every(Number.isFinite)) break;
  const low = Math.min(...s), at = s.flatMap((v, i) => v === low ? [i] : []);
  const value = carry + 1;
  if (at.length === 1) { won[at[0]] += value; perHole.push({winner: at[0], value}); carry = 0; }
  else { perHole.push({winner: null, value}); carry = value; }
 }
 return {won, perHole, carry};
}

// RECORDS (My profile): the nearest ball, the longest drive, the most
// up-and-downs from five (fewest strokes breaking a tie), the skins won.
export const blankRecords = () => ({});
export function normaliseRecords(d) {
 const out = {}, num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
 if (!d || typeof d !== 'object') return out;
 if (num(d.closest?.feet, 0, 5000)) out.closest = {feet: d.closest.feet, at: Number(d.closest.at) || 0};
 if (num(d.long?.yards, 0, 1000)) out.long = {yards: d.long.yards, at: Number(d.long.at) || 0};
 if (num(d.updown?.made, 0, 5) && num(d.updown?.strokes, 0, 999)) out.updown = {made: d.updown.made, strokes: d.updown.strokes, at: Number(d.updown.at) || 0};
 if (num(d.skins?.won, 0, 1e6) && num(d.skins?.games, 0, 1e6)) out.skins = {won: d.skins.won, games: d.skins.games};
 return out;
}
// Record a finished challenge; true when it is a new best.
export function recordChallenge(prof, id, value, now = Date.now()) {
 const r = (prof.challenges ||= {});
 if (id === 'closest') { if (value == null) return false; const better = !r.closest || value < r.closest.feet; if (better) r.closest = {feet: Math.round(value * 10) / 10, at: now}; return better; }
 if (id === 'long') { if (value == null) return false; const better = !r.long || value > r.long.yards; if (better) r.long = {yards: Math.round(value * 10) / 10, at: now}; return better; }
 if (id === 'updown') { const b = r.updown, better = !b || value.made > b.made || (value.made === b.made && value.strokes < b.strokes); if (better) r.updown = {...value, at: now}; return better; }
 if (id === 'skins') { r.skins = {won: (r.skins?.won || 0) + value, games: (r.skins?.games || 0) + 1}; return false; }
 return false;
}
// The feet and inches of a closest-to-the-pin ball, the way it is called.
export const feetText = f => f == null ? 'missed' : f < 1 ? `${Math.round(f * 12)} in` : `${Math.floor(f)} ft ${Math.round((f % 1) * 12) % 12} in`;
