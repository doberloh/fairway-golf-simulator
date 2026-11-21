// THE HOST'S RULING ON A GUEST'S MESSAGE (online play, 19 November 2026).
//
// A guest may play only their own seat, only on its turn, only from where the
// host's round says their ball lies, and choose relief or a scramble ball only
// when the choice is theirs. Each ruling is a sentence for the guest, or ''
// when it stands. Pure, on a game.js Round (or its JSON); main.js and
// tests/online-session.test.mjs both rule through it.
import {isTee} from '../tees.js';

// Who plays a seat: a guest's member id, or null for the host's own machine
// (a person at it, or a computer golfer it runs).
export const seatOwner = (round, seat) => round.players[seat]?.online ?? null;

// Whether this machine plays `seat`: `me` is this machine's member id, or null
// on the host.
export const playsHere = (round, seat, me) => (seatOwner(round, seat) ?? null) === (me ?? null);

// The seats a member plays.
export const seatsOf = (round, member) => round.players.map((p, i) => p.online === member ? i : -1).filter(i => i >= 0);

// The stroke the golfer up is playing, as Round counts it (`stroke`).
const strokeOf = round => round.mode === 'scramble'
 ? (round.scrambleShots?.[round.players[round.active]?.team] ?? 0) + 1
 : (round.strokes?.[round.active] ?? 0) + 1;

// Within a centimetre: both sides start from the same JSON, so this is
// rounding, never a different lie.
const CLOSE = 0.01;

export function shotProblem(round, m, {busy = false} = {}) {
 if (busy) return 'A ball is still in the air.';
 if (round.finished || round.holeComplete) return 'The hole is over.';
 if (round.relief) return 'Relief has to be taken first.';
 if (round.scrambleSelection) return 'The team has to choose its ball first.';
 if (m.hole !== round.hole) return 'That shot was for another hole.';
 if (m.seat !== round.active) return 'It is not your turn.';
 if (seatOwner(round, m.seat) !== m.member) return 'That is not your golfer.';
 if (m.stroke !== strokeOf(round)) return 'That shot is out of step with the round.';
 const at = round.positions[round.active];
 if (Math.hypot(m.shot.origin.x - at.x, m.shot.origin.z - at.z) > CLOSE) return 'That shot was not played from where your ball lies.';
 return '';
}

export function reliefProblem(round, m) {
 if (!round.relief) return 'There is no relief to take.';
 if (m.hole !== round.hole || m.seat !== round.relief.player) return 'That relief is not yours to take.';
 if (seatOwner(round, m.seat) !== m.member) return 'That is not your golfer.';
 return '';
}

// A scramble's ball is chosen by the team's first golfer: whoever plays that
// seat (a guest, the host, or the host's computer golfer).
export function pickerSeat(round) {
 if (!round.scrambleSelection || !round.candidates?.length) return -1;
 const team = round.players[round.candidates[0].player]?.team;
 return round.players.findIndex(p => p.team === team);
}

// DROPPING IN, DROPPING OUT, AND WATCHING (the owner, 20 November 2026: "Yes,
// build both" -- a player who did not start the round dropping in, and a
// watcher the host moves to a seat). Everyone let in mid-round watches; the
// host seats a watcher, and every seat change happens AT THE NEXT TEE, never
// in the middle of a hole (PLACED: a hole is played by the group that started
// it, and nobody's ball is taken over mid-shot). A golfer who left this round
// and comes back gets their own golfer back, card and all (`former`: member ->
// the name of the golfer they left); anyone else takes a new seat, with
// nothing on the holes before it -- as a golfer added offline does
// (game.js setPlayers), so their card counts the holes they played.
//
// `players`: the round's golfers. `queue`: the members seated, in the order
// the host seated them. `members`: the room's (member -> {state, name,
// golfer}). Returns the group for Round.setPlayers (each kept golfer carrying
// its `seat`) and the members there was no seat for.
export function seatsAtNextTee(players, queue, {members, former = new Map(), max = 4}) {
 const list = players.map((p, i) => ({...p, seat: i}));
 const left = [];
 for (const m of queue) {
  const g = members.get(m);
  if (!g || g.state !== 'in' || list.some(p => p.online === m)) continue;
  const back = formerSeat(list, former.get(m));
  if (back) { back.online = m; continue; }
  if (list.length >= max) { left.push(m); continue; }
  // The smaller side, so match play and a scramble stay two teams.
  const a = list.filter(p => p.team === 'A').length, b = list.length - a;
  const golfer = g.golfer || {};
  list.push({name: String(g.name || golfer.name || 'Golfer').slice(0, 24), team: b < a ? 'B' : 'A', hand: golfer.hand === 'LH' ? 'LH' : 'RH',
   input: golfer.input === 'monitor' ? 'monitor' : 'meter', ...(isTee(golfer.tee) ? {tee: golfer.tee} : {}), online: m});
 }
 return {players: list, left};
}
// The golfer a member left this round, if it is still there for them.
const formerSeat = (list, name) => name ? list.find(p => !p.online && p.input !== 'cpu' && p.name === name) : null;

// Whether the host can seat `member` from the next tee: their old golfer is
// waiting for them, or there is room for one more beside those already seated.
export function canSeat(players, queue, member, {former = new Map(), max = 4} = {}) {
 if (players.some(p => p.online === member) || queue.includes(member)) return false;
 if (formerSeat(players, former.get(member))) return true;
 const newcomers = queue.filter(m => !formerSeat(players, former.get(m))).length;
 return players.length + newcomers < max;
}

export function pickProblem(round, m) {
 if (!round.scrambleSelection) return 'There is no ball to choose.';
 if (m.hole !== round.hole) return 'That choice was for another hole.';
 const seat = pickerSeat(round);
 if (seat < 0 || m.seat !== seat || seatOwner(round, seat) !== m.member) return 'The team’s first golfer chooses its ball.';
 if (!round.candidates[m.index]) return 'There is no such ball.';
 return '';
}
