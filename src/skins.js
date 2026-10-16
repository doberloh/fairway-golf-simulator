// SKINS, a round format (the owner, 16 October 2026; it was the fourth
// practice challenge, a stroke round with skins counted over it, until then).
//
// Every hole is worth one skin. Once every golfer has finished it, the one
// lowest score ALONE wins it, with every skin carried to it. Any tie for the
// lowest carries, however many share it -- "one tie, all tie", as the TV Skins
// Game played it (RESEARCH.md, *Skins as a format*). Skins still carried after
// the last hole go unclaimed (PLACED: the TV game played off; the owner chose
// unclaimed, 16 October 2026).
//
// Skins are worked out from the stroke card every time they are asked for,
// never stored, so a mulligan, a decimal-putting change, a golfer joining or
// leaving, or a reloaded save can never leave a count that disagrees with the
// card. Pure: no DOM, no three.js; main.js asks and draws.

// Two decimals, the precision of every score in the game: decimal putting
// makes 4.5 a real score, and float noise must not split a tie.
const cent = v => Math.round(v * 100);

// `cards` is each golfer's score by hole; `decided` how many holes from the
// first are over (everyone finished). A hole is contested among the golfers
// with a score on it: one who joined mid-round has none on the holes before,
// and those stay decided among the golfers who played them (PLACED). A hole
// nobody scored carries, like a tie.
//
// Returns, per decided hole, who won it (`winner`, a seat, or null for a
// carry), what it was worth (`value`) and who tied for lowest (`tied`); the
// skins each seat has won; the skins carried out of the last decided hole; and
// `worth`, what the next hole is played for.
export function skins(cards, decided) {
 const won = cards.map(() => 0), perHole = [];
 let carry = 0;
 for (let h = 0; h < decided; h++) {
  const at = cards.flatMap((c, i) => Number.isFinite(c?.[h]) ? [{i, s: cent(c[h])}] : []);
  const low = Math.min(...at.map(a => a.s)), best = at.filter(a => a.s === low).map(a => a.i);
  const value = carry + 1;
  if (best.length === 1) { won[best[0]] += value; perHole.push({winner: best[0], value, tied: []}); carry = 0; }
  else { perHole.push({winner: null, value, tied: best}); carry = value; }
 }
 return {won, perHole, carry, worth: carry + 1};
}

// How many holes are over: those before the one being played, and that one
// too once everyone has finished it.
export const decidedHoles = ({hole, holeComplete}) => hole + (holeComplete ? 1 : 0);

// Who won the skins: the seat with the most, alone, or -1 -- a tie on skins, or
// nobody won any. Winning pays like winning a match or a scramble.
export function skinsWinner(won) {
 const most = Math.max(0, ...won);
 if (!most) return -1;
 const at = won.flatMap((w, i) => w === most ? [i] : []);
 return at.length === 1 ? at[0] : -1;
}

const plural = n => n === 1 ? 'skin' : 'skins';
export const skinsText = n => `${n} ${plural(n)}`;
export function ordinal(n) {
 const t = n % 100, u = n % 10;
 return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
}

// What the hole-out banner says once a hole is decided. `hole` is its index,
// `last` true on a round's final hole (an endless run has none).
export function holeSkinLine(entry, names, hole, last) {
 if (!entry) return '';
 if (entry.winner !== null) return `${names[entry.winner]} wins ${skinsText(entry.value)}`;
 return last ? `Tied · ${skinsText(entry.value)} ${entry.value === 1 ? 'goes' : 'go'} unclaimed`
  : `Tied · ${skinsText(entry.value)} ${entry.value === 1 ? 'carries' : 'carry'} to the ${ordinal(hole + 2)}`;
}

// The scorecard's top line: the count while the round is on, the result once
// it is over. `holes` is the round's length, for "5 of 9".
export function skinsStatus(names, k, {finished = false, holes = 0} = {}) {
 if (!finished) return `Skins: ${names.map((n, i) => `${n} ${k.won[i]}`).join(' · ')}${k.carry ? ` · ${k.carry} carried` : ''}`;
 const most = Math.max(0, ...k.won), lead = k.won.flatMap((w, i) => w === most ? [i] : []);
 const left = k.carry ? ` · ${k.carry} unclaimed` : '';
 if (!most) return `No skins won${left}`;
 if (lead.length === 1) return `${names[lead[0]]} wins the skins · ${most} of ${holes}${left}`;
 return `${lead.map(i => names[i]).join(' & ')} tie · ${skinsText(most)} each${left}`;
}
