import {SCHEMA_VERSION, GENERATOR_VERSION, validateSettings, migrateSettings} from './settings-schema.js';
import {Round} from './game.js';

// Rounds in progress, kept on this device.
//
// The sibling of course-library.js, and deliberately the opposite kind of
// record. A course is settings and a name -- never a score -- so it can be
// played by anyone in any format. A round is the whole situation: which course,
// who is playing, where every ball lies and what they have shot so far.
//
// This exists so the modes can be genuinely separate. Once the studio and play
// no longer share a world, walking from a half-finished round into the studio
// has to put that round somewhere rather than quietly discard it.
//
// The record needed no new serialisation: main.js already builds exactly this
// shape for its single-slot autosave, and Round.restore already validates and
// rebuilds it. This is that same record, in a list, with a name.

const KEY = 'fairway-rounds-v1';
export const MAX_ROUNDS = 40;
export const MAX_NAME = 40;

const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function validName(name) {
 const n = String(name ?? '').trim();
 if (!n.length || n.length > MAX_NAME) throw Error(`Give the round a name of 1–${MAX_NAME} characters.`);
 return n;
}

function readStore() {
 try {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const d = JSON.parse(raw);
  return Array.isArray(d?.rounds) ? d.rounds : [];
 } catch { return []; }
}

function writeStore(rounds) {
 try { localStorage.setItem(KEY, JSON.stringify({version: 1, rounds})); }
 catch { throw Error('This browser will not store any more rounds. Delete one to make room.'); }
}

// The stored generator version is preserved rather than refreshed. It is what
// tells a later build that this round was played on different ground, so the
// same stale-generator notice can be raised when it is resumed.
function normalise(raw) {
 if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') throw Error('Invalid round record.');
 const schema = Number.isInteger(raw.schema) ? raw.schema : 1;
 const settings = validateSettings(migrateSettings(raw.settings || {}, schema));
 // Round.restore throws on anything it cannot trust, which is what keeps a
 // corrupt entry from reaching the game.
 const round = Round.restore(raw.round);
 return {
  id: raw.id,
  name: validName(raw.name),
  saved: Number(raw.saved) || 0,
  generator: Number.isInteger(raw.generator) ? raw.generator : 0,
  schema: SCHEMA_VERSION,
  settings,
  round: raw.round,
  camera: raw.camera && typeof raw.camera === 'object' ? raw.camera : null,
  // Summarised on the way out so a list can be drawn without rebuilding every
  // round it holds.
  summary: summarise(round, settings),
 };
}

// What a card needs to show: where they are and how it is going.
function summarise(round, settings) {
 // An endless run has no hole count to report; how far it has got is the only
 // number that means anything.
 const holes = round.endless ? null : (round.holes || settings.holes || 9);
 const played = round.cards?.[0]?.filter(v => Number.isFinite(v)).length || 0;
 const strokes = (round.cards || []).flat().filter(Number.isFinite).reduce((a, b) => a + b, 0);
 return {
  hole: (round.hole ?? 0) + 1,
  holes,
  players: round.players?.length || 1,
  format: round.mode || 'stroke',
  endless: !!round.endless,
  finished: !!round.finished,
  holesPlayed: played,
  strokes,
 };
}

// One unreadable entry must not take the whole library down with it.
export function listRounds() {
 const out = [];
 for (const raw of readStore()) { try { out.push(normalise(raw)); } catch {} }
 return out;
}

export function findRound(id) { return listRounds().find(r => r.id === id) || null; }

// `record` is main.js's own save record: {settings, round, camera, generator}.
export function saveRound({id, name, settings, round, camera, generator = GENERATOR_VERSION} = {}) {
 if (!round) throw Error('There is no round to save.');
 const entry = {
  id: id || newId(),
  name: validName(name),
  saved: Date.now(),
  generator,
  schema: SCHEMA_VERSION,
  // Full settings, not just the generation keys: a round has to come back with
  // the same club yardages and flight profile it was played under, which is
  // exactly the part course records deliberately drop.
  settings: validateSettings(settings),
  round,
  camera: camera || null,
 };
 // Validate before storing rather than after, so a round that cannot be
 // restored is never written in the first place.
 Round.restore(entry.round);
 const rounds = readStore().filter(r => r && r.id !== entry.id);
 if (rounds.length >= MAX_ROUNDS) throw Error(`You can keep at most ${MAX_ROUNDS} rounds. Delete one first.`);
 rounds.unshift(entry);
 writeStore(rounds);
 return normalise(entry);
}

export function deleteRound(id) { writeStore(readStore().filter(r => r && r.id !== id)); }

export function renameRound(id, name) {
 const rounds = readStore(), found = rounds.find(r => r && r.id === id);
 if (!found) throw Error('That round is no longer saved.');
 found.name = validName(name);
 writeStore(rounds);
 return normalise(found);
}

// A default name that says where the round got to, so a list of them reads as
// something other than "Round, Round, Round".
export function suggestName(round, settings, courseTitle) {
 const where = round?.finished ? 'finished' : `hole ${(round?.hole ?? 0) + 1}`;
 return `${courseTitle || 'Round'} · ${where}`.slice(0, MAX_NAME);
}
