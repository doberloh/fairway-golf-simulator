// WHICH SHOT NUMBERS SHOW, WHERE, AND FOR HOW LONG (phase 2 of the 1.0
// interface, 17 October 2026; PROJECT_HANDOFF *The 1.0 round screen*).
//
// On a course the numbers pop up where the ball landed, on a small card, and
// fade after a few seconds -- the hole is what matters between shots, and Tab
// brings every number back. On the range, where the numbers ARE the point,
// eight tiles stay on screen with carry lit. The player can switch either
// way: tiles on a course, the card on the range. Their choice wins.
//
// Pure. main.js draws the card and the tiles; this says which, what is on the
// card, and when it goes.

// How long the card stays before it starts to fade, and the fade. PLACED: long
// enough to read three numbers from the mat and see the ball's lie; short
// enough to be gone before the next golfer has picked a club.
export const CARD_HOLD_MS = 6000, CARD_FADE_MS = 600;

export const CHOICES = ['auto', 'card', 'tiles'];
export const CHOICE_NAMES = {auto: 'Card on a course, tiles on the range', card: 'Always the pop-up card', tiles: 'Always tiles'};
export const cleanChoice = v => (CHOICES.includes(v) ? v : 'auto');

// The card's fields: the total, large, and three under it.
export const CARD_MAIN = 'total';
export const CARD_ROW = ['carry', 'ballSpeed', 'offline'];
// The range's eight tiles when the player has not chosen their own (the
// approved mockup's set), carry lit.
export const RANGE_TILES = ['ballSpeed', 'launch', 'spin', 'spinAxis', 'carry', 'total', 'offline', 'apex'];
export const LIT_FIELD = 'carry';

// What the round screen shows for this shot.
//   range    on the driving range
//   choice   the player's: auto, card or tiles
//   putt     a putt shows no card (the green says it all; the tiles still
//            count up if the player has chosen them)
//   all      Tab is down: every number, as tiles
export function shotDisplay({range = false, choice = 'auto', putt = false, all = false} = {}) {
 const c = cleanChoice(choice);
 const kind = all ? 'tiles' : c === 'auto' ? (range ? 'tiles' : 'card') : c;
 if (kind === 'card' && putt) return {kind: 'none'};
 return kind === 'card'
  ? {kind, main: CARD_MAIN, row: CARD_ROW, holdMs: CARD_HOLD_MS, fadeMs: CARD_FADE_MS}
  : {kind, stays: true, lit: LIT_FIELD};
}

// How far into its life a card is: 'shown', 'fading' (with how far, 0..1) or
// 'gone'. `since` is the moment it was put up, `now` the clock.
export function cardPhase(since, now) {
 const t = now - since;
 if (!(t >= 0)) return {phase: 'shown', fade: 0};
 if (t < CARD_HOLD_MS) return {phase: 'shown', fade: 0};
 if (t < CARD_HOLD_MS + CARD_FADE_MS) return {phase: 'fading', fade: (t - CARD_HOLD_MS) / CARD_FADE_MS};
 return {phase: 'gone', fade: 1};
}

// The card's tab: who hit it, and with what. "BEN · DRIVER".
export function cardTab(player, club) {
 return [player, club].filter(Boolean).map(s => String(s).toUpperCase()).join(' · ');
}

// Kept on this device, like the other display choices.
const KEY = 'fairway-shot-display-v1';
export function loadChoice(store = globalThis.localStorage) {
 try { return cleanChoice(JSON.parse(store?.getItem(KEY) ?? 'null')?.choice); } catch { return 'auto'; }
}
export function saveChoice(choice, store = globalThis.localStorage) {
 const c = cleanChoice(choice);
 try { store?.setItem(KEY, JSON.stringify({choice: c})); } catch {}
 return c;
}
