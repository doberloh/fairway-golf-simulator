// WHAT A ROOM'S MESSAGES MAY SAY (online play, 19 November 2026).
//
// Everything a player receives is checked here before the game sees it: a
// sealed message only proves it came from someone holding the room code, not
// that it is sane. A message that fails is dropped. Pure; tests/online-
// protocol.test.mjs.
//
// Guest to host:  hello, shot, relief, pick, bye
// Host to all:    welcome, refuse, room, start, flown, state, nope, end
// (`me` and `n` are added and checked by link.js.)

export const PROTOCOL = 1;
export const MAX_NAME = 24;
// The golfers a room can seat (Round takes 1-4) and the screens it holds
// beside them (relay/core.js: 8 sockets).
export const MAX_GOLFERS = 4;
// Every screen in a room, the host's among them: the relay's 8 sockets. Those
// without a seat watch (referee.js `seatsAtNextTee`).
export const MAX_SCREENS = 8;

const str = (v, max) => typeof v === 'string' && v.length <= max;
// TEXT FROM ANOTHER MACHINE carries no markup and no control characters: the
// game escapes what it shows, and this makes sure (a name is shown in a toast,
// a card, the scorecard, a turn banner).
const UNSAFE = new Set([...'<>&"\'`']);
const unsafe = c => UNSAFE.has(c) || c.charCodeAt(0) < 32 || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159) || c.charCodeAt(0) === 8232 || c.charCodeAt(0) === 8233;
export const safeText = (v, max) => [...String(v ?? '')].filter(c => !unsafe(c)).join('').replace(/\s+/g, ' ').trim().slice(0, max);
const id = v => typeof v === 'string' && /^[a-z0-9]{6,24}$/.test(v);
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const pt = p => p && num(p.x, -20000, 20000) && num(p.z, -20000, 20000);

// A golfer as a guest brings them: what they play as, nothing more. Their
// profile, history and bag stay on their own device.
export function cleanGolfer(g) {
 if (!g || typeof g !== 'object') return null;
 const name = safeText(g.name, MAX_NAME);
 if (!name) return null;
 return {
  name,
  hand: g.hand === 'LH' ? 'LH' : 'RH',
  input: g.input === 'meter' ? 'meter' : 'monitor',
  ...(str(g.tee, 8) && /^[a-z]+$/.test(g.tee) ? {tee: g.tee} : {}),
  ...(num(g.index, -10, 54) ? {index: Math.round(g.index * 10) / 10} : {}),
 };
}

// A shot as takeShot builds it (rival.js gridShot): launch numbers on the
// grid, its origin and aim, and the lie it was played from. Ranges are wide
// (a monitor can send anything a ball can do) but finite.
export function cleanShot(s) {
 if (!s || typeof s !== 'object' || !pt(s.origin)) return null;
 if (!num(s.aim, -720, 720) || !num(s.speed, 0, 120) || !num(s.vla, -30, 90) || !num(s.hla, -90, 90) || !num(s.spin, -2000, 20000) || !num(s.spinAxis ?? 0, -90, 90)) return null;
 const out = {origin: {x: s.origin.x, z: s.origin.z}, aim: s.aim, speed: s.speed, vla: s.vla, hla: s.hla, spin: s.spin, spinAxis: s.spinAxis ?? 0};
 for (const k of ['height', 'roll']) if (s[k] !== undefined) { if (!num(s[k], -10, 1000)) return null; out[k] = s[k]; }
 if (s.lie !== undefined) {
  const l = s.lie;
  if (!l || !str(l.surface, 20) || !/^[a-z]+$/.test(l.surface) || !num(l.factor, 0, 1) || (l.before !== undefined && !num(l.before, 0, 120))) return null;
  out.lie = {surface: l.surface, factor: l.factor, ...(l.before !== undefined ? {before: l.before} : {}), ...(num(l.spin, 0, 2) ? {spin: l.spin} : {}), ...(l.measured ? {measured: true} : {})};
 }
 // A monitor's other figures (club speed, smash...), shown on the shot card;
 // never flown (physics.js reads the launch numbers above and nothing else).
 if (s.extra && typeof s.extra === 'object' && !Array.isArray(s.extra)) {
  const extra = {};
  for (const [k, v] of Object.entries(s.extra).slice(0, 24)) if (/^[A-Za-z]{1,24}$/.test(k) && num(v, -1e5, 1e5)) extra[k] = v;
  out.extra = extra;
 }
 return out;
}

const turnOf = m => int(m.seat, 0, MAX_GOLFERS - 1) && int(m.hole, 0, 9999);

// The club a shot was hit with, as every device can read it: a bag is the
// golfer's own (clubs.js), so the id means nothing elsewhere. `code` 'PT'
// lifts the flagstick (main.js flyShot), so it must travel.
export function cleanClub(c) {
 if (!c || typeof c !== 'object' || !str(c.kind, 12) || !/^[a-z]+$/.test(c.kind) || !str(c.code, 4) || !/^[A-Z0-9]*$/.test(c.code)) return null;
 const label = safeText(c.label, MAX_CLUB_LABEL);
 return label ? {kind: c.kind, code: c.code, label} : null;
}
export const MAX_CLUB_LABEL = 24;

// What a shot counted for, as Round.takeShot says it (the host's `event`),
// for the guest's result line: these fields and nothing else.
export function cleanEvent(e) {
 if (!e || typeof e !== 'object') return null;
 const n = (v, lo, hi) => num(v, lo, hi) ? v : 0;
 return {holed: !!e.holed, complete: !!e.complete, relief: !!e.relief, penalty: n(e.penalty, 0, 2), putts: n(e.putts, 0, 9),
  player: int(e.player, 0, MAX_GOLFERS - 1) ? e.player : 0, score: n(e.score, 0, 999), puttingTotal: n(e.puttingTotal, 0, 999)};
}

// The host's round as a guest takes it: names with no markup (they reach the
// card, the toasts and the banners).
export function guestRound(json) {
 if (!json || typeof json !== 'object' || !Array.isArray(json.players)) return json;
 return {...json, players: json.players.map(p => p && typeof p === 'object' ? {...p, name: safeText(p.name, MAX_NAME) || 'Golfer'} : p)};
}

// Each message type's check; null drops the message.
const CHECK = {
 hello: m => int(m.v, 1, 999) && str(m.game, 80) && id(m.member) && cleanGolfer(m.golfer) ? {t: 'hello', v: m.v, game: m.game, member: m.member, golfer: cleanGolfer(m.golfer)} : null,
 shot: m => {
  const shot = cleanShot(m.shot);
  const club = cleanClub(m.club);
  return shot && club && turnOf(m) && int(m.stroke, 1, 999) && id(m.member)
   ? {t: 'shot', member: m.member, seat: m.seat, hole: m.hole, stroke: m.stroke, club, shot, typed: !!m.typed} : null;
 },
 relief: m => turnOf(m) && id(m.member) && str(m.id, 16) && num(m.back ?? 0, 0, 2000) ? {t: 'relief', member: m.member, seat: m.seat, hole: m.hole, id: m.id, back: m.back ?? 0} : null,
 pick: m => turnOf(m) && id(m.member) && int(m.index, 0, 3) ? {t: 'pick', member: m.member, seat: m.seat, hole: m.hole, index: m.index} : null,
 bye: m => id(m.member) ? {t: 'bye', member: m.member} : null,
 // A guest's screen has shown the card for a finished hole (the host's
 // countdown to the next tee waits for every one: session.js `unseen`).
 seen: m => id(m.member) && int(m.hole, 0, 9999) ? {t: 'seen', member: m.member, hole: m.hole} : null,
 welcome: m => id(m.member) && id(m.host) ? {t: 'welcome', member: m.member, host: m.host} : null,
 refuse: m => id(m.member) && str(m.why, 200) ? {t: 'refuse', member: m.member, why: safeText(m.why, 200)} : null,
 room: m => id(m.host) && Array.isArray(m.members) && m.members.length <= 8 && m.members.every(x => x && id(x.member) && str(x.name, 200) && ['in', 'away'].includes(x.state)) && ['lobby', 'playing', 'done'].includes(m.phase)
  ? {t: 'room', host: m.host, hostName: safeText(m.hostName, MAX_NAME) || 'Host', members: m.members.map(x => ({member: x.member, name: safeText(x.name, MAX_NAME) || 'Golfer', state: x.state})), phase: m.phase, course: safeText(m.course, 80)} : null,
 // The round as a save holds it (main.js saveRecord); main.js validates it
 // the way it validates a save before anything is built from it.
 start: m => m.record && typeof m.record === 'object' && m.record.settings && typeof m.record.settings === 'object' && int(m.shotNo, 0, 1e6) && int(m.seq, 0, 1e9)
  ? {t: 'start', record: {...m.record, round: guestRound(m.record.round), settings: {...m.record.settings, courseName: safeText(m.record.settings.courseName, 80)}}, shotNo: m.shotNo, seq: m.seq, ...(id(m.to) ? {to: m.to} : {})} : null,
 flown: m => {
  const shot = cleanShot(m.shot);
  const club = cleanClub(m.club);
  return shot && club && int(m.shotNo, 1, 1e6) && turnOf(m) && int(m.stroke, 1, 999) ? {t: 'flown', shotNo: m.shotNo, seat: m.seat, hole: m.hole, stroke: m.stroke, club, shot, typed: !!m.typed} : null;
 },
 state: m => m.round && typeof m.round === 'object' && int(m.shotNo, 0, 1e6) && int(m.seq, 0, 1e9)
  ? {t: 'state', round: guestRound(m.round), shotNo: m.shotNo, seq: m.seq, ...(cleanEvent(m.event) ? {event: cleanEvent(m.event)} : {})} : null,
 nope: m => id(m.member) && str(m.why, 200) ? {t: 'nope', member: m.member, why: safeText(m.why, 200)} : null,
 end: () => ({t: 'end'}),
};

// The message as the game may read it, or null.
export function readMessage(m) {
 if (!m || typeof m !== 'object' || typeof m.t !== 'string' || !Object.hasOwn(CHECK, m.t)) return null;
 try { return CHECK[m.t](m); } catch { return null; }
}

// The round a guest is sent: everyone's profile id is the host's device's
// business, and the mulligan history is the host's alone.
export function roundForGuests(json) {
 const {history, ...rest} = json;
 return {...rest, players: rest.players.map(({profile, ...p}) => p)};
}
