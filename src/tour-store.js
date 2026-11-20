// WHERE TOURS ARE KEPT (the fairway-tour goal, 17 November 2026): a fifth
// store beside the round slot, saved rounds, saved courses and profiles
// (PROJECT_HANDOFF *Saving: one slot, two libraries*). The tours on this
// device, the one being played, and the ratings the computer golfers gave
// courses (so a course is rated once). localStorage, like the others; every
// read is checked (tour.js `readTour`), and one unreadable tour does not
// take the rest with it.
import {readTour} from './tour.js';

export const TOURS_KEY = 'fairway-tours-v1', RATINGS_KEY = 'fairway-ratings-v1';
export const MAX_TOURS = 20, MAX_RATINGS = 200;
const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function loadTours() {
 try {
  const d = JSON.parse(ls()?.getItem(TOURS_KEY) || 'null');
  const tours = [];
  for (const t of Array.isArray(d?.tours) ? d.tours : []) { try { tours.push(readTour(t)); } catch {} }
  return {active: tours.some(t => t.id === d?.active) ? d.active : null, tours};
 } catch { return {active: null, tours: []}; }
}
// Throws a plain message when the browser will not keep any more.
export function saveTours(store) {
 try { ls()?.setItem(TOURS_KEY, JSON.stringify({active: store.active, tours: store.tours.slice(0, MAX_TOURS)})); }
 catch { throw Error('This browser will not keep any more. Delete a tour you have finished, then try again.'); }
}
export const activeTour = store => store.tours.find(t => t.id === store.active) || null;
export function putTour(store, tour, {activate = true} = {}) {
 const i = store.tours.findIndex(t => t.id === tour.id);
 if (i >= 0) store.tours[i] = tour; else store.tours.unshift(tour);
 if (store.tours.length > MAX_TOURS) throw Error(`Fairway keeps ${MAX_TOURS} tours. Delete one first.`);
 if (activate) store.active = tour.id;
 saveTours(store);
 return tour;
}
export function removeTour(store, id) {
 store.tours = store.tours.filter(t => t.id !== id);
 if (store.active === id) store.active = null;
 saveTours(store);
}

// A course's rating by the computer golfers, kept by what grows the course
// (its settings) and the tee rated.
export const ratingKey = (settings, tee) => JSON.stringify([settings?.built || '', settings?.seed || '', settings?.biome || '', settings?.holes || 18, settings?.courseYards || 0, tee]);
export function storedRating(key) {
 try { const d = JSON.parse(ls()?.getItem(RATINGS_KEY) || '{}'); return d[key] || null; } catch { return null; }
}
export function storeRating(key, rating) {
 try {
  const d = JSON.parse(ls()?.getItem(RATINGS_KEY) || '{}'), keys = Object.keys(d);
  if (keys.length >= MAX_RATINGS) delete d[keys[0]];
  d[key] = rating; ls()?.setItem(RATINGS_KEY, JSON.stringify(d));
 } catch {}
}
