// THE GREEN COLOUR LAB (the owner, 26 November 2026: "I feel like the greens
// in parkland are way too pale. Can you give me an in game interactive picker
// with sliders that lets me tune the colors of the greens in each biome with
// the ability to copy settings back out to you to implement?").
//
// A small window over the course, opened from Settings > Graphics > The look
// of the course: a landscape's base green -- or the fringe round it, which
// reads pale beside a darker green -- as hue, saturation and lightness (or
// typed), shown on the course the next frame (renderer.js setTurfTint,
// graded as the game grades every turf colour), a look at the green from
// close and from above, another landscape to try, and Copy for Claude. Picks
// are kept on this device for each landscape and shown only while the window
// is open: closing it puts the game's own colours back. The arithmetic is
// colour-lab.js (Node-tested); this is only the window.
import {LAB_STORE, LAB_SURFACES, hexToHsl, hslToHex, readPicks, labText, isHex} from './colour-lab.js';
import {turfGrade} from './textures.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const NAMES = {green: 'Green', fringe: 'Fringe'};

// `biomes`: {key: {name, green, fringe}}, the keys a player can pick.
// `keyNow()` the course's landscape (null with none); `paintNow()` something
// that changes whenever the course is drawn again (its ground material), so
// the picks are laid on the new one; `apply(surface, hex|null)`;
// `lookAt('close'|'above')`; `tryLandscape(key)` starts a course there.
export function createColourLab({doc = globalThis.document, biomes, keyNow, paintNow, apply, lookAt, tryLandscape, version = '', storage = globalThis.localStorage}) {
 let picks = {};
 try { picks = readPicks(storage?.getItem(LAB_STORE)); } catch { /* private window: none kept */ }
 const keep = () => { try { storage?.setItem(LAB_STORE, JSON.stringify(picks)); } catch { /* not kept */ } };
 const keys = Object.keys(biomes).sort((a, b) => biomes[a].name.localeCompare(biomes[b].name));
 const w = doc.createElement('section');
 w.id = 'colourLab'; w.className = 'colour-lab'; w.hidden = true;
 w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Green colour lab');
 const slider = (id, label, max) => `<label class="colour-lab-row"><span>${label} <output id="${id}Out"></output></span><input type="range" id="${id}" min="0" max="${max}" step="0.5"></label>`;
 w.innerHTML = `<div class="colour-lab-head"><b>Green colour lab</b><button type="button" class="colour-lab-x" aria-label="Close the green colour lab">×</button></div>
 <p class="colour-lab-land" id="labLand"></p>
 <div class="colour-lab-pick" role="radiogroup" aria-label="Which colour">${LAB_SURFACES.map(s => `<button type="button" class="colour-lab-btn" data-surface="${s}" aria-pressed="false">${NAMES[s]}</button>`).join('')}</div>
 <div class="colour-lab-swatches"><span><i id="labWas"></i>Now in the game</span><span><i id="labBase"></i>Your colour</span><span><i id="labDrawn"></i>As drawn</span></div>
 ${slider('labHue', 'Hue', 360)}${slider('labSat', 'Saturation', 100)}${slider('labLight', 'Lightness', 100)}
 <label class="colour-lab-row"><span>Colour</span><input type="text" id="labHex" maxlength="7" spellcheck="false" autocomplete="off"></label>
 <div class="colour-lab-btns"><button type="button" class="colour-lab-btn" data-look="close">Look at the green</button><button type="button" class="colour-lab-btn" data-look="above">From above</button><button type="button" class="colour-lab-btn" id="labReset">Put back</button></div>
 <label class="colour-lab-row"><span>Try another landscape</span><span class="colour-lab-pair"><select id="labOther">${keys.map(k => `<option value="${k}">${esc(biomes[k].name)}</option>`).join('')}</select><button type="button" class="colour-lab-btn" id="labGo">Play it</button></span></label>
 <button type="button" class="colour-lab-btn hot" id="labCopy">Copy for Claude</button>
 <p class="colour-lab-note" id="labNote">Base colours, before the game tones turf down; "As drawn" is what lands on the ground before light and shade. Picks are kept on this device for each landscape; closing this puts the game's own colours back.</p>
 <textarea id="labText" rows="5" readonly hidden></textarea>`;
 doc.body.append(w);
 const $ = id => w.querySelector('#' + id);
 const css = hex => `#${turfGrade(hex).getHexString()}`;
 let key = null, painted = null, timer = 0, surface = 'green';
 const own = (s = surface) => biomes[key]?.[s];
 const now = (s = surface) => picks[key]?.[s] ?? own(s);
 function show() {
  const hex = now(), hsl = hexToHsl(hex ?? '#000000'), mine = key && picks[key];
  $('labLand').textContent = key ? `${biomes[key].name}${mine ? ` -- yours: ${LAB_SURFACES.filter(s => mine[s]).map(s => NAMES[s].toLowerCase()).join(', ')}` : ', its own colours'}` : 'Start a round to see a course.';
  w.querySelectorAll('[data-surface]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.surface === surface)));
  if (!hex) return;
  $('labWas').style.background = css(own() ?? hex); $('labBase').style.background = hex; $('labDrawn').style.background = css(hex);
  for (const [id, v, unit] of [['labHue', hsl.h, '°'], ['labSat', hsl.s, '%'], ['labLight', hsl.l, '%']]) { $(id).value = v; $(id + 'Out').textContent = `${Math.round(v)}${unit}`; }
  if (doc.activeElement !== $('labHex')) $('labHex').value = hex;
 }
 function set(hex) {
  if (!key || !isHex(hex)) return;
  hex = hex.toLowerCase();
  const one = {...(picks[key] ?? {})};
  if (hex === String(own()).toLowerCase()) delete one[surface]; else one[surface] = hex;
  if (Object.keys(one).length) picks[key] = one; else delete picks[key];
  keep(); apply(surface, picks[key]?.[surface] ?? null); show();
 }
 const layAll = () => { for (const s of LAB_SURFACES) apply(s, picks[key]?.[s] ?? null); };
 const fromSliders = () => set(hslToHex({h: +$('labHue').value, s: +$('labSat').value, l: +$('labLight').value}));
 for (const id of ['labHue', 'labSat', 'labLight']) $(id).addEventListener('input', fromSliders);
 $('labHex').addEventListener('input', e => { const v = e.target.value.trim(); if (isHex(v)) set(v); });
 w.querySelectorAll('[data-surface]').forEach(b => { b.onclick = () => { surface = b.dataset.surface; show(); }; });
 $('labReset').onclick = () => { if (!key || !picks[key]?.[surface]) return; set(own()); };
 w.querySelectorAll('[data-look]').forEach(b => { b.onclick = () => lookAt(b.dataset.look); });
 $('labGo').onclick = () => tryLandscape($('labOther').value);
 $('labCopy').onclick = () => {
  const text = labText(picks, biomes, version), note = $('labNote'), box = $('labText');
  if (!text) { note.textContent = 'Nothing to copy: every landscape still has its own colours.'; return; }
  box.value = text; box.hidden = false;
  const done = () => { note.textContent = 'Copied. Paste it to Claude.'; };
  const fallback = () => { box.focus(); box.select(); note.textContent = 'Copy the text below (it is selected) and paste it to Claude.'; };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch { fallback(); }
 };
 // The window moves by its title bar.
 const head = w.querySelector('.colour-lab-head');
 head.addEventListener('pointerdown', e => {
  if (e.target.closest('button')) return;
  const r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
  const move = ev => { w.style.left = `${Math.max(0, Math.min(innerWidth - r.width, ev.clientX - dx))}px`; w.style.top = `${Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy))}px`; w.style.right = 'auto'; };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
 });
 // A new course, or the same one drawn again: the picks laid on it.
 function follow() {
  const k = keyNow(), p = paintNow();
  if (k === key && p === painted) return;
  key = biomes[k] ? k : null; painted = p;
  if (key) { $('labOther').value = key; layAll(); }
  show();
 }
 const api = {
  get open() { return !w.hidden; },
  show() { w.hidden = false; key = null; painted = null; follow(); clearInterval(timer); timer = setInterval(follow, 400); },
  close() { clearInterval(timer); timer = 0; if (key) for (const s of LAB_SURFACES) apply(s, null); w.hidden = true; },
  picks: () => structuredClone(picks),
 };
 w.querySelector('.colour-lab-x').onclick = () => api.close();
 return api;
}
