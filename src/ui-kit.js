// THE 1.0 INTERFACE KIT: the pieces every rebuilt screen is made of (phase 0;
// nothing uses it yet -- phase 1 rebuilds the round screen out of it).
//
// main.js builds about seventy panels from hand-written HTML strings, each
// placed and sized by eye; that is how the same thing came to look different
// on every screen. The kit is the other way round: a screen is boxes placed on
// the grid (`place`, from ui-layout.js), holding panels, rows, stacks and
// tiles, holding the controls -- and the sizes, padding, slant and selection
// outline come only from here and src/ui-kit.css.
//
// Builders return HTML strings, like the rest of the interface, so they can be
// tested in Node and dropped into innerHTML. Arguments named `text` are
// escaped; arguments named `html` are markup, normally another builder's. A
// player's name is text: never pass it as html.
//
// Every class starts `uk-` and every style is scoped to `.uk` (ui-kit.css says
// why); `kitRoot` makes the `.uk` element and gives it the palette.

import {paletteVars} from './ui-palette.js';
import {HEIGHTS} from './ui-layout.js';

const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

const cls = (...names) => names.filter(Boolean).join(' ');
const styleOf = obj => Object.entries(obj || {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}:${v}`).join(';');
const attr = (name, v) => (v === undefined || v === null || v === false ? '' : ` ${name}="${esc(v)}"`);
const px = v => `${Math.round(v * 100) / 100}px`;

// The root every kit screen sits in: the `.uk` scope, the palette as custom
// properties, and -- given a frame from ui-layout's `canvasFrame` -- the design
// canvas, sized and scaled to fill the screen.
export function kitRoot(palette, html, {frame, id} = {}) {
 const vars = palette ? paletteVars(palette) : {};
 const box = frame ? {width: px(frame.canvas.width), height: px(frame.canvas.height), transform: `scale(${Math.round(frame.scale * 1e4) / 1e4})`} : {};
 return `<div class="${cls('uk', frame && 'uk-canvas')}"${attr('id', id)} style="${esc(styleOf({...vars, ...box}))}">${html}</div>`;
}

// The content band as one leaning sheet, from a grid (ui-layout `gridFor`).
export function sheet(grid, html) {
 return `<div class="uk-sheet" style="top:${px(grid.sheet.top)};height:${px(grid.sheet.height)};width:100%">${html}</div>`;
}

// A box on the sheet: from column `col` across `span` columns, its top at
// canvas height `y`. Positions come only from the grid -- nothing by eye.
export function place(grid, col, span, y, html, {height} = {}) {
 const s = grid.span(col, span);
 const style = styleOf({left: px(s.left), top: px(y - grid.sheet.top), width: px(s.width), height: height === undefined ? undefined : px(height)});
 return `<div class="uk-abs" style="${style}">${html}</div>`;
}

// Text in one of the five sizes: label 13, body 18, value 24, title 36, hero 56.
const SIZES = ['label', 'body', 'value', 'title', 'hero'];
export function type(size, text, {unit, under} = {}) {
 if (!SIZES.includes(size)) throw new Error(`no type size "${size}"`);
 return `<span class="${cls(`uk-${size}`, under && 'uk-under')}">${esc(text)}${unit ? `<small class="uk-unit">${esc(unit)}</small>` : ''}</span>`;
}
// A label over its value -- the order every screen keeps.
export const labelled = (label, value, opts = {}) =>
 `<div class="uk-stk" style="gap:4px">${type('label', label)}${type(opts.size || 'value', value, opts)}</div>`;

// A panel: the slanted box with its contents standing straight.
//   hl     filled with the palette's gradient (the current tab, the main button)
//   on     selected: the outline that follows the slant
//   ghost  an empty slot ("+ new")
//   lean   lean on its own -- for a piece outside the sheet; inside the sheet
//          the sheet leans and panels do not
export function panel(html, {hl, on, ghost, kind, style, role, label, selected} = {}) {
 const c = cls('uk-p', kind && `uk-${kind}`, hl && 'uk-hl', on && 'uk-on', ghost && 'uk-ghost');
 return `<div class="${c}"${attr('style', style)}${attr('role', role)}${attr('aria-label', label)}${attr('aria-selected', selected === undefined ? undefined : String(!!selected))}><div class="uk-pi">${html}</div></div>`;
}
// A row (48 tall): something on the left, something on the right.
export const row = (left, right = '', opts = {}) => panel(`<span>${left}</span><span>${right}</span>`, {...opts, kind: 'row'});
// A list item (56 tall), the same shape as a row.
export const item = (left, right = '', opts = {}) => panel(`<span>${left}</span><span>${right}</span>`, {...opts, kind: 'item'});
// A tile (96 tall): a block of label-and-value.
export const tile = (html, opts = {}) => panel(html, {...opts, kind: 'tile'});
// Repeated items, one under the other, 8 apart, all on one left edge.
export const stack = (items, {gap} = {}) => `<div class="uk-stk"${gap === undefined ? '' : ` style="gap:${px(gap)}"`}>${items.join('')}</div>`;
// Loose text on the sheet (a heading above a stack), straightened.
export const upright = html => `<div class="uk-u">${html}</div>`;

// A switch: ON or OFF.
export function toggle(on, {label} = {}) {
 return `<span class="${cls('uk-sw', on && 'uk-sw-on')}" role="switch" aria-checked="${on ? 'true' : 'false'}"${attr('aria-label', label)}><i>${on ? 'ON' : 'OFF'}</i></span>`;
}
// A picker: one of a list, changed with the arrows.
export function picker(text, {label} = {}) {
 return `<span class="uk-pick"${attr('aria-label', label)}><span class="uk-arrow" aria-hidden="true">&#9664;</span> ${esc(text)} <span class="uk-arrow" aria-hidden="true">&#9654;</span></span>`;
}
// A segment slider: `count` slanted bars, as many lit as the value reaches.
export function segments(value, min, max, {count = 8, label} = {}) {
 const span = max - min, f = span > 0 ? (Number(value) - min) / span : 0;
 const lit = Math.max(0, Math.min(count, Math.round((Number.isFinite(f) ? f : 0) * count)));
 let bars = '';
 for (let i = 0; i < count; i++) bars += `<b${i < lit ? ' class="uk-seg-on"' : ''}></b>`;
 return `<span class="uk-seg" role="meter" aria-valuemin="${esc(min)}" aria-valuemax="${esc(max)}" aria-valuenow="${esc(value)}"${attr('aria-label', label)}>${bars}</span>`;
}
// Tabs: the current one filled.
export function tabs(list, current, {label} = {}) {
 return `<div class="uk-tabs" role="tablist"${attr('aria-label', label)}>${list.map(t =>
  panel(type('label', t), {hl: t === current, role: 'tab', selected: t === current})).join('')}</div>`;
}
// A chip: a small slanted word (curve, height, spin; "2 settings changed").
export const chip = (text, {hot} = {}) => `<span class="${cls('uk-chip', hot && 'uk-hl')}"><span>${esc(text)}</span></span>`;
// The level tag.
export const level = n => `<span class="uk-lv">LV ${esc(n)}</span>`;
// A key hint for the footer: the key, then what it does.
export const keyHint = (key, text) => `<span><span class="uk-key">${esc(key)}</span>${esc(text)}</span>`;

// The heights a screen lays rows out by (rows 48, items 56, tiles 96).
export {HEIGHTS};

// Turn a builder's string into an element, where there is a document.
export function el(html, doc = globalThis.document) {
 if (!doc) throw new Error('ui-kit el() needs a document');
 const t = doc.createElement('template');
 t.innerHTML = html.trim();
 return t.content.firstElementChild;
}
