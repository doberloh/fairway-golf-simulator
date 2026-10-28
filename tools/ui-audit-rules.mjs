// THE INTERFACE AUDIT'S RULES (the 1.0 polish, 27 October 2026; docs/UI_POLISH.md).
//
// tools/ui-audit.mjs walks every screen of the built game at every screen size
// and, on each, reads what the page drew: every visible element's box, its own
// text's box, its colours and how it is outlined. This file turns those records
// into findings. It is pure -- records in, findings out, no browser -- so each
// rule is tested in Node (tests/ui-audit-rules.test.mjs) with boxes made up to
// break it.
//
// A record (what ui-audit.mjs's collector returns per element):
//   {i, parent, path, tag, rect:{x,y,w,h}, skew, interactive, disabled, text,
//    textRect, lines, fontPx, bold, color, bg, hot, ring, fill, focused,
//    clip:{x,y,w,h}|null, ellipsis, scroll:{x,y,w,h}|null, centreX, centreY,
//    content:{x,y,w,h}, inner:{x,y,w,h}|null, covered}
// `parent` is the nearest recorded ancestor's index (-1 for none), so "is A
// inside B" is a walk up that chain, never a DOM call.
//
// Each finding: {rule, path, detail}. The lines each rule draws come from the
// research (RESEARCH.md, *Game interface practice, for the 1.0 polish*), and
// every one is named in UI_POLISH.md's checklist.
import {contrast} from '../src/ui-palette.js';

// The lines (PLACED where the research gave a range; see RESEARCH.md).
export const LINES = {
 touch: 44,          // a target pressed in play, on a touch screen (CSS px)
 touchFloor: 24,     // WCAG 2.5.8's floor, for anything else
 text: 13,           // drawn font size a player must read, at 1080p and below
                     // (the kit's own TYPE.label, ui-layout.js; scaled up with
                     // the screen above 1080p, as the Xbox guideline's is)
 phoneText: 11,      // the same on a touch screen (ui-layout.js PHONE.smallestLabel)
 contrast: 4.5,      // ordinary text
 contrastLarge: 3,   // text 24 px or larger, or bold and 18.7 px or larger
 centre: 2.5,        // how far (px) a centred thing may sit from the centre
 clip: 1.5,          // how far (px) text may run past what clips it
 overlapPx: 20,      // the least overlapping area worth a finding (px^2)
 overlapShare: .15,  // ... and as a share of the smaller box
};

const inside = (a, b, slack = 0) => a.x >= b.x - slack && a.y >= b.y - slack && a.x + a.w <= b.x + b.w + slack && a.y + a.h <= b.y + b.h + slack;
const area = r => Math.max(0, r.w) * Math.max(0, r.h);
export function intersection(a, b) {
 const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
 const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
 return w > 0 && h > 0 ? {x, y, w, h} : null;
}
// A leaning box's bounding rectangle is wider than the box by its lean, half
// on each side; two leaning neighbours' rectangles overlap where the boxes do
// not. Their mid-height rectangle is the fair one to compare.
export function body(rec) {
 const r = rec.rect, lean = Math.abs(rec.skew || 0) * r.h / 2;
 return lean > 0 ? {x: r.x + lean, y: r.y, w: Math.max(0, r.w - 2 * lean), h: r.h} : r;
}

function ancestry(recs) {
 const by = new Map(recs.map(r => [r.i, r]));
 const isAncestor = (a, d) => { for (let p = by.get(d)?.parent; p !== undefined && p >= 0; p = by.get(p)?.parent) if (p === a) return true; return false; };
 const interactiveAbove = r => { for (let p = r.parent; p >= 0; p = by.get(p)?.parent ?? -1) if (by.get(p)?.interactive) return by.get(p); return null; };
 return {by, isAncestor, interactiveAbove};
}

// TEXT OR CONTROLS ON TOP OF EACH OTHER. A control counts as one unit (what is
// inside it is its own business); text outside any control counts on its own.
// Two units overlap when their boxes share more than a sliver and neither
// holds the other. A line of text's box runs from the font's top to its
// bottom, well above the capitals and below the descenders, so two lines set
// tight touch boxes without their letters touching: text is compared by its
// letters' band (`glyphs`).
export function glyphs(t) { return {x: t.x, y: t.y + t.h * .2, w: t.w, h: t.h * .65}; }
export function overlaps(recs) {
 const {isAncestor, interactiveAbove} = ancestry(recs);
 const units = recs.filter(r => !r.covered && (r.interactive ? !interactiveAbove(r) : (r.text && !interactiveAbove(r))));
 const out = [];
 for (let a = 0; a < units.length; a++) for (let b = a + 1; b < units.length; b++) {
  const A = units[a], B = units[b];
  if (isAncestor(A.i, B.i) || isAncestor(B.i, A.i)) continue;
  const ra = A.interactive ? body(A) : (A.textRect ? glyphs(A.textRect) : A.rect), rb = B.interactive ? body(B) : (B.textRect ? glyphs(B.textRect) : B.rect);
  const x = intersection(ra, rb);
  if (!x) continue;
  // Content scrolling under a fixed piece (a phone sheet's foot band) that can
  // still scroll clear of it: how a scrolling sheet works.
  const [fx, sc] = A.fixed && !B.fixed ? [A, B] : B.fixed && !A.fixed ? [B, A] : [null, null];
  if (fx && (sc.scrollRoom || 0) >= x.h) continue;
  const share = area(x) / Math.max(1, Math.min(area(ra), area(rb)));
  if (area(x) >= LINES.overlapPx && share >= LINES.overlapShare)
   out.push({rule: 'overlap', path: A.path, detail: `over ${B.path} (${Math.round(x.w)}x${Math.round(x.h)} px, ${Math.round(share * 100)}% of the smaller)`});
 }
 return out;
}

// TEXT CUT OFF: its own text runs past the box that clips it. Text cut with an
// ellipsis is reported apart -- usually meant, sometimes not.
export function clipped(recs) {
 const out = [];
 for (const r of recs) {
  if (!r.text || !r.textRect || !r.clip) continue;
  // Past a box that scrolls that way, the text is reached by scrolling (the
  // collector's `reach`), so only the other way counts.
  const t = r.textRect, c = r.clip, x = c.reach?.x ? -Infinity : Math.max(c.x - t.x, t.x + t.w - (c.x + c.w)), y = c.reach?.y ? -Infinity : Math.max(c.y - t.y, t.y + t.h - (c.y + c.h));
  const past = Math.max(x, y);
  if (past > LINES.clip) out.push({rule: r.ellipsis ? 'ellipsis' : 'clipped', path: r.path, detail: `"${r.text.slice(0, 40)}" runs ${Math.round(past)} px past its box`});
 }
 return out;
}

// OFF THE SCREEN, with no way to scroll it into view: a control or text whose
// box leaves the viewport and that sits in no scroll box which is itself on
// screen.
export function offscreen(recs, view) {
 const screen = {x: 0, y: 0, w: view.width, h: view.height}, out = [];
 for (const r of recs) {
  if (!(r.interactive || r.text) || r.covered) continue;
  const box = r.interactive ? body(r) : (r.textRect || r.rect);
  if (inside(box, screen, 1)) continue;
  if (r.scroll && intersection(r.scroll, screen)) continue;
  out.push({rule: 'offscreen', path: r.path, detail: `at ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}x${Math.round(box.h)} on a ${view.width}x${view.height} screen`});
 }
 return out;
}

// NOT CENTRED: a control that centres its content (a button, a centring flex
// box) whose content sits off its middle. `inner` is the union of what is
// drawn inside it (its text and its children), `content` its box less padding
// and border; `centreX`/`centreY` say which way it centres.
export function offCentre(recs) {
 const out = [];
 for (const r of recs) {
  if (!r.interactive || !r.inner || !r.content || r.covered) continue;
  const dx = (r.inner.x + r.inner.w / 2) - (r.content.x + r.content.w / 2), dy = (r.inner.y + r.inner.h / 2) - (r.content.y + r.content.h / 2);
  // Content wider than the box is clipping, not centring.
  if (r.centreX && r.inner.w <= r.content.w + 1 && Math.abs(dx) > LINES.centre) out.push({rule: 'off-centre', path: r.path, detail: `content ${dx > 0 ? 'right' : 'left'} of centre by ${Math.abs(dx).toFixed(1)} px`});
  if (r.centreY && r.inner.h <= r.content.h + 1 && Math.abs(dy) > LINES.centre) out.push({rule: 'off-centre', path: r.path, detail: `content ${dy > 0 ? 'below' : 'above'} centre by ${Math.abs(dy).toFixed(1)} px`});
 }
 return out;
}

// MORE THAN ONE HIGHLIGHT ALIKE. `ring` is how a control is outlined: 'hot'
// (the screen's yellow) or 'white'; `fill` whether it is filled with the hot
// colour. Since the 1.0 polish yellow means chosen and white means where the
// keys are (UI_POLISH.md, *One look for chosen, one for the cursor*), so:
//   - two controls outlined alike in one list (siblings) are the double
//     yellow boxes the owner saw -- two of a list looking chosen, or chosen
//     and cursor drawn the same;
//   - two white rings anywhere on a screen are two cursors;
//   - two siblings filled as chosen are two choices in a list that takes one;
//   - a white ring off the focused control is a cursor that does not follow
//     the keys.
export function highlights(recs) {
 const out = [], live = recs.filter(r => r.interactive && !r.covered), {isAncestor} = ancestry(recs);
 const groups = (list, key) => { const m = new Map(); for (const r of list) m.set(key(r), [...(m.get(key(r)) || []), r]); return [...m.values()].filter(g => g.length > 1); };
 for (const g of groups(live.filter(r => r.ring && !r.multi), r => `${r.parent}|${r.ring}`)) out.push({rule: 'two-highlights', path: g.map(r => r.path).join(' + '), detail: `${g.length} in one list outlined alike (${g[0].ring})`});
 const cursors = live.filter(r => r.ring === 'white');
 if (cursors.length > 1 && new Set(cursors.map(r => r.parent)).size > 1) out.push({rule: 'two-highlights', path: cursors.map(r => r.path).join(' + '), detail: `${cursors.length} cursors on one screen`});
 for (const g of groups(live.filter(r => r.fill && !r.multi), r => r.parent)) out.push({rule: 'two-chosen', path: g.map(r => r.path).join(' + '), detail: `${g.length} siblings filled as chosen`});
 const focus = live.find(r => r.focused);
 if (focus) for (const r of cursors) if (r !== focus && !isAncestor(r.i, focus.i) && !isAncestor(focus.i, r.i))
  out.push({rule: 'highlight-not-focus', path: r.path, detail: `drawn as the cursor while the focus is on ${focus.path}`});
 return out;
}

// TOO SMALL TO TAP, on a touch screen: a control smaller than the line on its
// short side, unless it sits inside a larger control that takes the tap.
export function targets(recs, {touch}) {
 if (!touch) return [];
 const {interactiveAbove} = ancestry(recs), out = [];
 for (const r of recs) {
  if (!r.interactive || r.disabled || r.covered || interactiveAbove(r)) continue;
  const b = body(r), side = Math.min(b.w, b.h);
  if (side < LINES.touchFloor) out.push({rule: 'tiny-target', path: r.path, detail: `${Math.round(b.w)}x${Math.round(b.h)} px`});
  else if (side < LINES.touch) out.push({rule: 'small-target', path: r.path, detail: `${Math.round(b.w)}x${Math.round(b.h)} px`});
 }
 return out;
}

// HARD TO READ: text whose colour against what it sits on falls under the
// line, or whose drawn size is under the smallest readable size. `bg` is the
// colour behind the text with every see-through layer laid on; `backdrops`
// what lies under a see-through stack (the course picture), tried at both
// extremes as the palette test does.
export function textLine(view, {touch} = {}) { return touch ? LINES.phoneText : LINES.text * Math.max(1, view.height / 1080); }
export function readable(recs, view, {touch} = {}) {
 const out = [], small = textLine(view, {touch});
 for (const r of recs) {
  if (!r.text || r.covered || r.textCovered || !r.color) continue;
  const large = r.fontPx >= 24 || (r.bold && r.fontPx >= 18.7);
  const need = r.disabled ? LINES.contrastLarge : large ? LINES.contrastLarge : LINES.contrast;
  // `bg` is read from the picture (ui-audit.mjs `behind`), so it is opaque;
  // a see-through text colour is laid over it.
  // Text drawn with a dark outline all round (two or more tight shadows, or a
  // stroke) reads on any ground -- the Xbox guideline's own remedy.
  // Words whose middle lies outside the box that clips them are not drawn
  // there (scrolled out of a column, Endless's last landscape): what they
  // would sit on is nothing; the clipped rule judges a real cut.
  // The box that clips them, or the box that scrolls them (a card's own box
  // clips its words; the column round the card scrolls the card away).
  const t = r.textRect, outside = b => b && (t.x + t.w / 2 < b.x || t.x + t.w / 2 > b.x + b.w || t.y + t.h / 2 < b.y || t.y + t.h / 2 > b.y + b.h);
  const hidden = !!t && (outside(r.clip) || outside(r.scroll));
  if (r.bg && !r.outlined && !hidden) {
   const ratio = contrast(r.color, r.bg, r.bg);
   if (ratio < need) out.push({rule: 'contrast', path: r.path, detail: `${ratio.toFixed(2)}:1 (needs ${need}) on ${r.bg} "${r.text.slice(0, 30)}"`});
  }
  if (r.fontPx && r.fontPx < small - .25) out.push({rule: 'small-text', path: r.path, detail: `${r.fontPx.toFixed(1)} px (line ${small.toFixed(1)}) "${r.text.slice(0, 30)}"`});
 }
 return out;
}

export const RULES = ['overlap', 'clipped', 'ellipsis', 'offscreen', 'off-centre', 'two-highlights', 'two-chosen', 'highlight-not-focus', 'tiny-target', 'small-target', 'contrast', 'small-text'];
// Reported, not failed on: an ellipsis is usually meant, and the round screen
// keeps small type by design where it floats over the course (judged per case
// in UI_POLISH.md; a known entry turns a finding off for good).
export const SOFT = new Set(['ellipsis']);

export function audit(recs, view, opts = {}) {
 return [...overlaps(recs), ...clipped(recs), ...offscreen(recs, view), ...offCentre(recs), ...highlights(recs), ...targets(recs, opts), ...readable(recs, view, opts)];}

// A KNOWN FINDING, EXPLAINED: {rule (or rules, a list), path (a substring of
// the element's path; "" for any), screen (optional, a substring; or screens,
// a list of prefixes), size (optional, like "390x844"; or sizes, a list), why}.
// The audit lists them apart and does not fail on them.
export function explained(finding, known) {
 return known.find(k => (k.rules ? k.rules.includes(finding.rule) : k.rule === finding.rule) && finding.path.includes(k.path ?? '')
  && (!k.screen || finding.screen?.includes(k.screen)) && (!k.screens || k.screens.some(s => finding.screen?.startsWith(s)))
  && (!k.size || finding.size === k.size) && (!k.sizes || k.sizes.includes(finding.size))) || null;
}
