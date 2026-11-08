// THE CLICKABLE MAP AND THE THUMBNAILS' GLOBES, in the menus (the US
// landscapes goal, 2 November 2026; the owner: "a clickable map" to refer to
// when choosing a landscape, and "a little map in the corner of the
// thumbnail that shows that location on the globe"). DOM only; the shapes,
// projection and lookup are landscape-map.js, the globe globe.js.
//
// `landscapeMap(doc, {built, chosen, onPick})`: the USA, every landscape a
// shape, the built ones (the keys a player can pick) solid and clickable,
// the rest dimmed and named "coming"; hovering or focusing one names it
// under the map, a click (or Enter) picks it. A landscape outside the
// map would be a button beside it (Scottish Links was, until 8 November 2026). Keyboard and phone players have the landscape
// list it sits over (the studio's pictures, Endless's cards): the map is a
// second way in, never the only one.
import {US_SHAPES} from './us-map-data.js';
import {shapePath, project, MAP_W, MAP_H} from './landscape-map.js';
import {LANDSCAPES} from './regions.js';
import {globeSvg} from './globe.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// `mark` [lat, lon] puts a dot on the map: the builder's door 2 marks where
// its survey lies.
export function landscapeMap(doc, {built = [], chosen = null, onPick, mark = null} = {}) {
 const wrap = doc.createElement('div');
 wrap.className = 'lmap';
 const svg = doc.createElementNS(NS, 'svg');
 svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
 svg.setAttribute('class', 'lmap-svg');
 svg.setAttribute('role', 'group');
 svg.setAttribute('aria-label', 'Map of the landscapes');
 const label = doc.createElement('div');
 label.className = 'lmap-name';
 const shapes = new Map();
 const say = key => {
  const l = LANDSCAPES[key];
  label.innerHTML = l ? `<strong>${esc(l.name.toUpperCase())}</strong><small>${built.includes(key) ? 'Click to choose' : 'Coming'}</small>` : '<small>Point at a region</small>';
 };
 const paint = key => { for (const [k, list] of shapes) for (const p of list) p.classList.toggle('on', k === key); for (const b of wrap.querySelectorAll('[data-land]')) b.classList.toggle('on', b.dataset.land === key); };
 for (const s of US_SHAPES) {
  const p = doc.createElementNS(NS, 'path');
  p.setAttribute('d', shapePath(s.rings));
  const live = built.includes(s.key);
  p.setAttribute('class', `lmap-land ${live ? 'live' : 'coming'}${s.overlay ? ' over' : ''}`);
  p.dataset.land = s.key;
  const t = doc.createElementNS(NS, 'title');
  t.textContent = LANDSCAPES[s.key].name + (live ? '' : ' (coming)');
  p.append(t);
  if (live) {
   p.setAttribute('tabindex', '0');
   p.setAttribute('role', 'button');
   p.setAttribute('aria-label', LANDSCAPES[s.key].name);
   p.addEventListener('click', () => { paint(s.key); say(s.key); onPick?.(s.key); });
   p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.dispatchEvent(new Event('click')); } });
  }
  p.addEventListener('pointerenter', () => say(s.key));
  p.addEventListener('focus', () => say(s.key));
  if (!shapes.has(s.key)) shapes.set(s.key, []);
  shapes.get(s.key).push(p);
  svg.append(p);
 }
 svg.addEventListener('pointerleave', () => say(chosen));
 if (mark) {
  const [x, y] = project(...mark), dot = doc.createElementNS(NS, 'circle');
  dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); dot.setAttribute('r', '6');
  dot.setAttribute('class', 'lmap-mark');
  svg.append(dot);
 }
 wrap.append(svg);
 // The landscapes outside the map.
 const abroad = Object.entries(LANDSCAPES).filter(([k, l]) => !l.us && built.includes(k));
 if (abroad.length) {
  const row = doc.createElement('div');
  row.className = 'lmap-abroad';
  for (const [k, l] of abroad) {
   const b = doc.createElement('button');
   b.type = 'button'; b.className = 'lmap-chip'; b.dataset.land = k;
   b.innerHTML = `${globeSvg(l.where, {size: 22, title: l.name})}<span>${esc(l.name.toUpperCase())}</span>`;
   b.onclick = () => { paint(k); say(k); onPick?.(k); };
   row.append(b);
  }
  wrap.append(row);
 }
 wrap.append(label);
 paint(chosen); say(chosen);
 return {el: wrap, choose: key => { chosen = key; paint(key); say(key); }};
}

// A landscape thumbnail's globe, in its corner: `el` the picture's element
// (positioned), `key` the landscape.
export function addGlobe(doc, el, key, size = 30) {
 const l = LANDSCAPES[key];
 if (!el || !l || el.querySelector(':scope>.globe-corner')) return;
 const g = doc.createElement('span');
 g.className = 'globe-corner';
 g.innerHTML = globeSvg(l.where, {size, title: `${l.name}: where it is`});
 el.append(g);
}
