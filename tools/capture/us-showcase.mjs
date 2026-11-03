// THE SHOWCASE OF EVERY LANDSCAPE (the US landscapes goal, step 10; PLAN.md
// section 6: "tools/capture makes several generated pictures of every
// landscape (seasons included) into a showcase document under docs/reports/").
//
//   node tools/capture/us-showcase.mjs take [key ...]   pictures (the graphics card)
//   node tools/capture/us-showcase.mjs doc              the document
//
// `take` builds each landscape's generated nine-hole course (seed SHOW-<key>)
// from the capture build (run `node tools/capture/build-hooked.mjs` first) and
// photographs it: in summer from behind the first green, over the course, and
// beside the second; in spring, autumn and winter from behind the first
// green (a tropical landscape has summer only: seasons.js). JPEGs at
// 1600 by 900 under bench/shots/showcase-us/<key>/ (git-ignored). A
// landscape whose pictures are all there is skipped, so a batch can be
// stopped and taken up again. Run it through tools/gpu-run.mjs, a few
// landscapes a batch (AGENTS.md: minutes, not hours).
//
// `doc` writes docs/reports/us-landscapes-showcase.html (local, never
// committed: AGENTS.md *What stays local*): every landscape by region, its
// name, region and place, and its pictures, linked from where they lie.
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, hourFor, HIDE_HUD, hideBallAndAim} from './capture.mjs';
import {BIOMES} from '../../src/biomes.js';
import {BIOME_KEYS} from '../../src/settings-schema.js';
import {LANDSCAPES, REGIONS, regionOf} from '../../src/regions.js';

const OUT = path.join('bench', 'shots', 'showcase-us');
const DOC = path.join('docs', 'reports', 'us-landscapes-showcase.html');
// The views (biome-shots.mjs's own, the same frames as the cards).
const VIEWS = {
 'h1-behind': {hole: 0, when: 'afternoon', cam: {hole: 0, fromPin: 80, around: 170, height: 30, pitch: -17}},
 overview: {hole: 0, when: 'afternoon', cam: `w => ({x: -w.halfX * .2, z: -w.halfZ * 1.05, yaw: 15, height: 240, pitch: -26})`},
 'h2-side': {hole: 1, when: 'afternoon', cam: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
};
const SHOTS = {summer: ['h1-behind', 'overview', 'h2-side'], spring: ['h1-behind'], autumn: ['h1-behind'], winter: ['h1-behind']};
const shotsFor = key => Object.entries(SHOTS).filter(([s]) => s === 'summer' || !LANDSCAPES[key]?.tropical)
 .flatMap(([season, views]) => views.map(view => ({season, view, file: path.join(OUT, key, `${season}-${view}.jpg`)})));

async function take(keys) {
 const b = await launch();
 try {
  for (const key of keys) {
   const want = shotsFor(key).filter(s => !fs.existsSync(s.file));
   if (!want.length) { console.log(`${key}: done already`); continue; }
   fs.mkdirSync(path.join(OUT, key), {recursive: true});
   // A fresh page a season: a second round in the same page waits on the
   // game's "abandon the round in play?" question (the first trial hung there).
   for (const season of [...new Set(want.map(s => s.season))]) {
    const p = await openGame(b, {width: 1600, height: 900, density: 1, quality: 'ultra'});
    await p.evaluate(c => window.lab.course(c), {biome: key, holes: 9, seed: `SHOW-${key}`, season});
    await p.addStyleTag({content: HIDE_HUD});
    let hole = 0;
    for (const s of want.filter(s => s.season === season)) {
     const v = VIEWS[s.view];
     if (v.hole !== hole) { await p.evaluate(h => window.lab.hole(h), v.hole); hole = v.hole; await p.waitForTimeout(4000); await p.addStyleTag({content: HIDE_HUD}); }
     await p.evaluate(([cam, at]) => { const view = window.__view; view.daylight.hour = at; view.daylight.rate = 0;
      window.lab.camera(typeof cam === 'string' ? (0, eval)(cam)(view.world) : cam); }, [v.cam, hourFor(key, v.when)]);
     await hideBallAndAim(p);
     await p.waitForTimeout(2200);
     await p.screenshot({path: s.file, type: 'jpeg', quality: 82});
    }
    if (p.errors.length) console.log(`${key} ${season}: page errors: ${p.errors.slice(0, 3).join(' | ')}`);
    await p.context().close();
   }
   console.log(`${key}: ${want.length} pictures`);
  }
 } finally { await b.close(); }
}

function doc() {
 const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
 const rel = f => path.relative(path.dirname(DOC), f).split(path.sep).join('/');
 const byRegion = new Map();
 for (const key of BIOME_KEYS) { const r = regionOf(key) || 'other'; if (!byRegion.has(r)) byRegion.set(r, []); byRegion.get(r).push(key); }
 let missing = 0;
 const sections = [...byRegion].map(([region, keys]) => `<h2>${esc(REGIONS[region] || region)}</h2>` + keys.map(key => {
  const l = LANDSCAPES[key] || {}, shots = shotsFor(key);
  const figs = shots.map(s => { if (!fs.existsSync(s.file)) { missing++; return ''; } return `<figure><img loading="lazy" src="${rel(s.file)}" alt="${esc(`${BIOMES[key].name}, ${s.season}`)}"><figcaption>${s.season}, ${s.view.replace('-', ' ')}</figcaption></figure>`; }).join('');
  return `<section><h3>${esc(BIOMES[key].name)}</h3><p>${esc(BIOMES[key].tag || '')}${l.where ? ` &middot; ${l.where[0].toFixed(1)}, ${l.where[1].toFixed(1)}` : ''}</p><div class="grid">${figs}</div></section>`;
 }).join('')).join('');
 fs.mkdirSync(path.dirname(DOC), {recursive: true});
 fs.writeFileSync(DOC, `<!doctype html><meta charset="utf-8"><title>Fairway landscapes</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px auto;max-width:1400px;padding:0 16px;color:#1f2a24;background:#f6f5f0}h1{margin:0 0 4px}h2{margin:40px 0 8px;border-bottom:2px solid #c9c3b2}h3{margin:20px 0 2px}p{margin:0 0 8px;color:#5a6058}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}figure{margin:0}img{width:100%;border-radius:6px;display:block}figcaption{font-size:12px;color:#6a7066}</style>
<h1>Every landscape</h1><p>${BIOME_KEYS.length} landscapes, each a generated nine (seed SHOW-&lt;key&gt;), in summer from three views and in spring, autumn and winter from one (the tropics stay in summer). Made by tools/capture/us-showcase.mjs.</p>
${sections}`);
 console.log(`${DOC}: ${BIOME_KEYS.length} landscapes${missing ? `, ${missing} pictures not taken yet` : ''}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'take') await take(rest.length ? rest : BIOME_KEYS);
else if (cmd === 'doc') doc();
else { console.log('usage: us-showcase.mjs take [key ...] | doc'); process.exitCode = 1; }
