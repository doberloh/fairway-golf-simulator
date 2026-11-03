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
  const figs = shots.map(s => { if (!fs.existsSync(s.file)) { missing++; return ''; } return `<figure><a href="${rel(s.file)}" target="_blank"><img loading="lazy" src="${rel(s.file)}" alt="${esc(`${BIOMES[key].name}, ${s.season}, ${s.view.replace('-', ' ')}`)}"></a><figcaption>${s.season}, ${s.view.replace('-', ' ')}</figcaption></figure>`; }).join('');
  return `<section><h3>${esc(BIOMES[key].name)}</h3><p>${esc(BIOMES[key].tag || '')}${l.where ? ` &middot; ${l.where[0].toFixed(1)}, ${l.where[1].toFixed(1)}` : ''}</p><div class="grid">${figs}</div></section>`;
 }).join('')).join('');
 fs.mkdirSync(path.dirname(DOC), {recursive: true});
 fs.writeFileSync(DOC, `<!doctype html><meta charset="utf-8"><title>Fairway landscapes</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px auto;max-width:1400px;padding:0 16px;color:#1f2a24;background:#f6f5f0}h1{margin:0 0 4px}h2{margin:40px 0 8px;border-bottom:2px solid #c9c3b2}h3{margin:20px 0 2px}p{margin:0 0 8px;color:#5a6058}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}figure{margin:0}img{width:100%;border-radius:6px;display:block}figcaption{font-size:12px;color:#6a7066}img{cursor:zoom-in}
#box{position:fixed;inset:0;background:rgba(10,12,10,.93);display:none;align-items:center;justify-content:center;z-index:9;flex-direction:column}#box.on{display:flex}#box img{max-width:96vw;max-height:88vh;width:auto;cursor:default;border-radius:4px}#box p{color:#e8e6dc;margin:10px 0 0}#box button{position:absolute;background:rgba(255,255,255,.12);color:#fff;border:0;font-size:32px;width:56px;height:56px;border-radius:28px;cursor:pointer}#box button:hover{background:rgba(255,255,255,.25)}#prev{left:16px;top:calc(50% - 28px)}#next{right:16px;top:calc(50% - 28px)}#shut{right:16px;top:16px}</style>
<h1>Every landscape</h1><p>${BIOME_KEYS.length} landscapes, each a generated nine (seed SHOW-&lt;key&gt;), in summer from three views and in spring, autumn and winter from one (the tropics stay in summer). Click a picture to see it full size; arrow keys or the side buttons step through them, Escape closes. Made by tools/capture/us-showcase.mjs.</p>
${sections}
<div id="box" role="dialog" aria-modal="true" aria-label="Picture, full size"><img alt=""><p></p><button id="prev" aria-label="Previous picture">&#8249;</button><button id="next" aria-label="Next picture">&#8250;</button><button id="shut" aria-label="Close">&#215;</button></div>
<script>
// Full size on a click (the owner, 3 November 2026: the pictures could not be
// enlarged). Each picture is also a plain link, so it opens without script.
const links=[...document.querySelectorAll('figure a')],box=document.getElementById('box'),big=box.querySelector('img'),cap=box.querySelector('p');let at=-1;
const show=i=>{at=(i+links.length)%links.length;const a=links[at],im=a.querySelector('img');big.src=a.href;big.alt=im.alt;cap.textContent=im.alt;box.classList.add('on');};
const shut=()=>{box.classList.remove('on');at=-1;};
links.forEach((a,i)=>a.addEventListener('click',e=>{e.preventDefault();show(i);}));
document.getElementById('prev').onclick=e=>{e.stopPropagation();show(at-1);};
document.getElementById('next').onclick=e=>{e.stopPropagation();show(at+1);};
document.getElementById('shut').onclick=shut;
box.addEventListener('click',e=>{if(e.target===box)shut();});
addEventListener('keydown',e=>{if(at<0)return;if(e.key==='Escape')shut();else if(e.key==='ArrowLeft')show(at-1);else if(e.key==='ArrowRight')show(at+1);});
</script>`);
 console.log(`${DOC}: ${BIOME_KEYS.length} landscapes${missing ? `, ${missing} pictures not taken yet` : ''}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'take') await take(rest.length ? rest : BIOME_KEYS);
else if (cmd === 'doc') doc();
else { console.log('usage: us-showcase.mjs take [key ...] | doc'); process.exitCode = 1; }
