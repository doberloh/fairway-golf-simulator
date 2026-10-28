// PLAY AGAIN (the 1.0 polish, Play round 2; docs/UI_POLISH.md, *The way into
// every mode*, G2): the last round started from Play, kept so the main menu can
// start the same again in one press -- the Game Accessibility Guidelines'
// "allow the game to be started without the need to navigate through multiple
// levels of menus". What is kept is what Play asked: the kind of game, the
// course when it was a saved one, who played and the format. Not the round:
// that is Continue's.
//
// Pure: storage is handed in (tests/last-play.test.mjs).
const KEY = 'fairway-last-play-v1';
// The kinds Play again can start without asking anything. A friend's challenge
// is one card, played once; it is not offered.
export const AGAIN_KINDS = ['weekly', 'endless', 'saved', 'surprise'];

const cleanGroup = g => {
 const players = (Array.isArray(g?.players) ? g.players : []).slice(0, 4).map(p => ({...p, name: String(p?.name ?? '').slice(0, 40)})).filter(p => p.name);
 return players.length ? {...g, players} : null;
};

export function rememberPlay(storage, {kind, courseId = null, group} = {}) {
 if (!AGAIN_KINDS.includes(kind)) return false;
 const g = cleanGroup(group);
 if (!g || (kind === 'saved' && !courseId)) return false;
 try { storage.setItem(KEY, JSON.stringify({version: 1, kind, courseId, group: g})); return true; } catch { return false; }
}

// The last setup, or null when there is none worth offering: a saved course
// that has since been deleted is not offered (`hasCourse(id)`).
export function lastPlay(storage, {hasCourse = () => true} = {}) {
 let d;
 try { d = JSON.parse(storage.getItem(KEY) || 'null'); } catch { return null; }
 if (!d || d.version !== 1 || !AGAIN_KINDS.includes(d.kind)) return null;
 const group = cleanGroup(d.group);
 if (!group) return null;
 if (d.kind === 'saved' && !(d.courseId && hasCourse(d.courseId))) return null;
 return {kind: d.kind, courseId: d.courseId ?? null, group};
}

const FORMATS = {stroke: 'stroke play', match: 'match play', scramble: 'scramble', skins: 'skins'};
// The line under Play again: what it will start, in plain words.
// `name` is the saved course's name, or the week's course name.
export function againLine(last, {name = ''} = {}) {
 if (!last) return '';
 const what = {weekly: name ? `${name}, the course of the week` : 'The course of the week', endless: 'An endless run', saved: name || 'Your saved course', surprise: 'A new surprise nine'}[last.kind];
 const n = last.group.players.length, fmt = FORMATS[last.group.mode];
 return [what, n === 1 ? last.group.players[0].name : `${n} golfers`, last.kind !== 'endless' && fmt ? fmt : null].filter(Boolean).join(' · ');
}
