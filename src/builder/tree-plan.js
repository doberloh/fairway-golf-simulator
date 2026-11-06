// THE TREES PLACED FOR YOU (the owner, 5 November 2026): a course's `treePlan`
// (course-doc.js), in both editors, changed live. Which of the landscape's trees
// stand where the survey or the map found one, and whether they take the survey's
// height and width or the landscape's own. A tree the player placed by hand keeps
// what it was given (built-world.js `treeAt`). The rules are pure, with their
// controls below them (tests/builder-tree-plan.test.mjs).
import {treeChoices} from './cover.js';

// The plan with one species ticked or unticked. `species` null means every tree
// the landscape grows; the last one cannot be taken off, since a selection of
// nothing has no meaning.
export function withSpecies(plan, bio, kind, on) {
 const all = treeChoices(bio).map(([k]) => k), now = plan?.species?.filter(k => all.includes(k)) ?? [];
 const had = now.length ? now : all, next = on ? [...new Set([...had, kind])] : had.filter(k => k !== kind);
 if (!next.length) return plan ?? null;
 return tidy({...plan, species: next.length === all.length ? null : all.filter(k => next.includes(k))});
}
export const withSizes = (plan, surveyed) => tidy({...plan, sizes: surveyed ? null : 'landscape'});
// Nothing asked for is no plan, so a course left alone keeps its bytes.
const tidy = p => p.species || p.sizes ? {...(p.sizes ? {sizes: p.sizes} : {}), ...(p.species ? {species: p.species} : {})} : null;

// The panel, both editors'. `change(plan)` is called with each new plan.
export function treePlanControls(el, bio, plan, change) {
 let now = plan ?? null;
 const shown = treeChoices(bio), ticked = k => !now?.species?.some(q => shown.some(([s]) => s === q)) || now.species.includes(k);
 const boxes = shown.map(([k, name]) => {
  const box = el('input', {type: 'checkbox', 'data-tree': k, checked: ticked(k), onchange: e => {
   const next = withSpecies(now, bio, k, e.target.checked);
   if (!e.target.checked && !shown.some(([s]) => s !== k && ticked(s))) { e.target.checked = true; return; }
   now = next; change(now);
  }});
  return el('label', {class: 'cb-treepick'}, box, el('span', {}, name));
 });
 return el('div', {class: 'cb-treeplan'},
  el('b', {}, 'Trees placed for you'),
  el('label', {class: 'cb-treepick', title: 'On: each surveyed tree stands at the height and width the LIDAR measured. Off: it keeps its place, and takes the landscape\'s own size for its species.'},
   el('input', {type: 'checkbox', class: 'cb-treesizes', checked: now?.sizes !== 'landscape', onchange: e => { now = withSizes(now, e.target.checked); change(now); }}),
   el('span', {}, 'Use the LIDAR\'s tree sizes')),
  el('small', {}, 'Which trees grow where the survey found one. Trees you place yourself stay as they are.'),
  el('div', {class: 'cb-treepicks'}, boxes));
}
