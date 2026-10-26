// THE CARTOON OVERHAUL'S SHOWCASE: one local page for the owner to judge the
// work (the goal's *The showcase*; docs/CARTOON_OVERHAUL.md).
//
//   node tools/capture/overhaul-showcase.mjs [--after latest] [--out docs/reports/cartoon-overhaul-showcase.html]
//
// Light work: no game, no graphics card. It reads what the other tools left:
//
//   - bench/shots/overhaul/main/ and main-light/ (main's build) against
//     bench/shots/overhaul/<after>/ (the branch's), every landscape at every
//     fixed view, as drag sliders (tools/capture/overhaul.mjs);
//   - the lighting rounds, bench/shots/overhaul/light-r*/;
//   - every asset and texture's rounds: the contact sheets in
//     bench/shots/overhaul/rounds/ and the in-game sets beside them, under the
//     rounds tables of docs/CARTOON_OVERHAUL.md, which are the notes;
//   - the ground types (src/grounds.js) and where each lies, with the overhead
//     maps tools/surface-map.mjs draws (bench/shots/overhaul/maps/);
//   - generation time (tools/gen-time.mjs --json), the game's size (dist/ and
//     main's kept build) and frame rate per tier (tools/profile.mjs --json),
//     main against the branch;
//   - the *Rules set aside* and *Frame rate* sections of CARTOON_OVERHAUL.md.
//
// The page links its pictures rather than embedding them (hundreds of JPEGs);
// it lives in docs/reports/ (never committed: AGENTS.md *What stays local*)
// and opens from there.
import fs from 'node:fs';
import path from 'node:path';
import {BIOMES} from '../../src/biomes.js';
import {GROUNDS} from '../../src/grounds.js';

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i < 0 ? d : argv[i + 1]; };
const AFTER = opt('--after', 'latest');
const OUT = path.resolve(opt('--out', 'docs/reports/cartoon-overhaul-showcase.html'));
const SHOTS = path.resolve('bench/shots/overhaul');
const rel = f => path.relative(path.dirname(OUT), f).split(path.sep).join('/');
const has = f => fs.existsSync(f);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const readJson = f => has(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
const biomes = Object.keys(BIOMES);
const DOC = fs.readFileSync('docs/CARTOON_OVERHAUL.md', 'utf8');

// ---------------------------------------------------------------- markdown
// Just enough of it for the overhaul's own page: paragraphs, bullets, tables,
// `code`, **bold** and *italic*.
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
function md(text) {
 const out = [], lines = text.split('\n');
 for (let i = 0; i < lines.length;) {
  const l = lines[i];
  if (/^\s*\|/.test(l)) {
   const rows = [];
   while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
   const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
   const body = rows.filter(r => !/^\s*\|[\s|:-]+\|\s*$/.test(r));
   out.push(`<table>${body.map((r, k) => `<tr>${cells(r).map(c => k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join('')}</tr>`).join('')}</table>`);
   continue;
  }
  if (/^\s*[-*] /.test(l)) {
   const items = [];
   while (i < lines.length && (/^\s*[-*] /.test(lines[i]) || /^\s{2,}\S/.test(lines[i]) && items.length)) {
    if (/^\s*[-*] /.test(lines[i])) items.push(lines[i].replace(/^\s*[-*] /, '')); else items[items.length - 1] += ' ' + lines[i].trim();
    i++;
   }
   out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`);
   continue;
  }
  if (!l.trim()) { i++; continue; }
  const para = [];
  while (i < lines.length && lines[i].trim() && !/^\s*[|]/.test(lines[i]) && !/^\s*[-*] /.test(lines[i]) && !/^#/.test(lines[i])) para.push(lines[i++].trim());
  if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); else i++;
 }
 return out.join('\n');
}
// A `## ` section of the overhaul's page, without its heading.
const section = title => { const m = DOC.split(/\n(?=## )/).find(s => s.startsWith(`## ${title}`)); return m ? m.replace(/^## .*\n/, '') : ''; };

// ---------------------------------------------------------------- pieces
const img = (f, caption = '') => has(f) ? `<figure><a href="${rel(f)}"><img loading="lazy" src="${rel(f)}"></a>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>` : '';
const slider = (before, after, caption) => {
 if (!has(after)) return '';
 if (!has(before)) return img(after, `${caption} (branch only)`);
 return `<figure class="slider"><div class="pair"><img loading="lazy" src="${rel(after)}"><img loading="lazy" class="top" src="${rel(before)}"><input type="range" min="0" max="100" value="50" aria-label="Main to branch"></div><figcaption>${esc(caption)} <span class="hint">main &larr; drag &rarr; branch</span></figcaption></figure>`;
};
const views = biome => {
 const dir = path.join(SHOTS, AFTER, biome);
 if (!has(dir)) return [];
 const meta = readJson(path.join(dir, 'meta.json'));
 const names = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4));
 const captions = Object.fromEntries((meta?.views ?? []).map(v => [v.name, v.caption]));
 return names.map(n => ({name: n, caption: captions[n] ?? n}));
};
const beforeOf = (biome, view) => {
 const a = path.join(SHOTS, 'main', biome, `${view}.jpg`), b = path.join(SHOTS, 'main-light', biome, `${view}.jpg`);
 return has(a) ? a : b;
};

// Which round pictures belong to a rounds section, by its title.
const PREFIX = [[/broadleaves/i, 'broadleaf'], [/conifers/i, 'conifer'], [/boulders/i, 'rocks'], [/shrubs/i, 'shrubs'],
 [/desert/i, 'desert'], [/long grass/i, 'grass'], [/^brush/i, 'brush'], [/island/i, 'island'], [/haunted/i, 'haunted'],
 [/houses/i, 'houses'], [/pumpkins/i, 'props'], [/deadfall/i, 'deadfall'], [/redwood/i, 'redwood'], [/lakeshore/i, 'lakeshore'],
 [/furniture/i, 'course'], [/landforms/i, 'land'], [/ground textures/i, 'turf'], [/stands/i, 'stands'], [/shared links/i, 'links-share'],
 [/lighting/i, 'light']];
function roundPictures(title) {
 const prefix = PREFIX.find(([re]) => re.test(title))?.[1];
 if (!prefix) return '';
 const sheets = has(path.join(SHOTS, 'rounds')) ? fs.readdirSync(path.join(SHOTS, 'rounds')).filter(f => f.startsWith(prefix + '-r')).sort((a, b) => a.localeCompare(b, 'en', {numeric: true})) : [];
 const games = fs.readdirSync(SHOTS).filter(d => d.startsWith(prefix + '-') && fs.statSync(path.join(SHOTS, d)).isDirectory()).sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
 const out = sheets.map(f => img(path.join(SHOTS, 'rounds', f), f.replace(/\.png$/, '')));
 for (const d of games) {
  const dir = path.join(SHOTS, d), files = [];
  for (const e of fs.readdirSync(dir)) {
   const p = path.join(dir, e);
   if (fs.statSync(p).isDirectory()) { const j = fs.readdirSync(p).filter(f => f.endsWith('.jpg')).sort(); if (j.length) files.push([`${d} · ${e} · ${j[0].slice(0, -4)}`, path.join(p, j[0])]); }
   else if (/\.(png|jpg)$/.test(e)) files.push([`${d} · ${e}`, p]);
  }
  for (const [c, f] of files.slice(0, 4)) out.push(img(f, c));
 }
 return out.length ? `<div class="grid">${out.join('')}</div>` : '';
}
function rounds() {
 const parts = DOC.split(/\n(?=### )/).filter(s => s.startsWith('### '));
 return parts.filter(s => /round|rounds/i.test(s.split('\n')[0])).map(s => {
  const [head, ...rest] = s.split('\n');
  const title = head.replace(/^### /, '');
  return `<section><h3>${inline(title)}</h3>${md(rest.join('\n').split(/\n(?=## )/)[0])}${roundPictures(title)}</section>`;
 }).join('\n');
}

// The lighting rounds: each view a row, each round a column, per landscape.
function lighting() {
 const labels = fs.readdirSync(SHOTS).filter(d => /^light-r\d+$/.test(d)).sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
 const rows = [];
 for (const b of biomes) {
  const vs = [...new Set(labels.flatMap(l => has(path.join(SHOTS, l, b)) ? fs.readdirSync(path.join(SHOTS, l, b)).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4)) : []))].sort();
  if (!vs.length) continue;
  const cols = ['main', ...labels, AFTER];
  const cellFor = (l, v) => l === 'main' ? beforeOf(b, v) : path.join(SHOTS, l, b, `${v}.jpg`);
  rows.push(`<h4>${esc(BIOMES[b].name)}</h4><div class="scroll"><table class="rounds"><tr><th></th>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${vs.map(v => `<tr><th>${v}</th>${cols.map(l => `<td>${img(cellFor(l, v))}</td>`).join('')}</tr>`).join('')}</table></div>`);
 }
 return rows.join('\n');
}

// The ground types: how each plays and where it lies.
function grounds() {
 const where = Object.fromEntries(Object.keys(GROUNDS).map(k => [k, []]));
 for (const [k, b] of Object.entries(BIOMES)) {
  for (const g of Object.values(b.landform?.kinds ?? {})) where[g]?.push(b.name);
  if (b.fallen?.kind && where[b.fallen.kind]) where[b.fallen.kind].push(b.name);
 }
 const rows = Object.entries(GROUNDS).map(([k, g]) => `<tr><td><span class="sw" style="background:${g.map}"></span>${esc(g.label)}</td><td>${g.contact.cor}</td><td>${g.contact.mu}</td><td>${g.roll}</td><td>${g.lie}</td><td>${g.killsSpin ? 'yes' : ''}</td><td>${esc(g.like)}</td><td>${esc([...new Set(where[k])].join(', ') || '-')}</td></tr>`).join('');
 const maps = biomes.map(b => img(path.join(SHOTS, 'maps', `${b}.png`), BIOMES[b].name)).join('');
 return `<p>Bounce is the coefficient of restitution on landing, grip the friction, roll how much the ground slows a rolling ball (higher stops it sooner), lie the share of a full shot's distance a ball plays from it. All placed (RESEARCH, <i>The overhaul's ground types</i>).</p>
 <table><tr><th>Ground</th><th>Bounce</th><th>Grip</th><th>Roll</th><th>Lie</th><th>Kills spin</th><th>Plays like</th><th>Where</th></tr>${rows}</table>
 ${maps ? `<p>Seed <code>overhaul</code>, nine holes, from above (tools/surface-map.mjs): ground types in their map colours, stands near black.</p><div class="grid">${maps}</div>` : ''}`;
}

// Numbers: generation, size, frame rate.
function numbers() {
 const gm = readJson(path.join(SHOTS, 'gen-time-main.json')), gl = readJson(path.join(SHOTS, `gen-time-${AFTER}.json`));
 // tools/gen-time.mjs --json: {rows: {biome: {median, min, max}}}, milliseconds.
 const med = (g, b) => { const v = g?.rows?.[b]?.median; return typeof v === 'number' ? v / 1000 : null; };
 const gen = gm || gl ? `<table><tr><th>Landscape</th><th>main</th><th>branch</th></tr>${biomes.map(b => `<tr><td>${esc(BIOMES[b].name)}</td><td>${med(gm, b)?.toFixed?.(2) ?? '-'} s</td><td>${med(gl, b)?.toFixed?.(2) ?? '-'} s</td></tr>`).join('')}</table>` : '<p>No generation timings yet.</p>';
 const size = f => has(f) ? (fs.statSync(f).size / 1e6).toFixed(2) + ' MB' : '-';
 const frame = (a, b, title) => {
  const A = readJson(path.join(SHOTS, 'frames', a)), B = readJson(path.join(SHOTS, 'frames', b));
  if (!A || !B) return '';
  const rows = B.results.filter(r => r.stats).map(r => { const o = A.results.find(x => x.group === r.group && x.name === r.name)?.stats;
   return `<tr><td>${esc(r.name)}</td><td>${o?.gpuMedian?.toFixed(2) ?? '-'}</td><td>${r.stats.gpuMedian?.toFixed(2)}</td><td>${o ? (o.trisPerFrame / 1e6).toFixed(1) : '-'} M</td><td>${(r.stats.trisPerFrame / 1e6).toFixed(1)} M</td><td>${o?.p99?.toFixed(1) ?? '-'}</td><td>${r.stats.p99?.toFixed(1)}</td></tr>`; }).join('');
  return `<h4>${esc(title)}</h4><p class="hint-line">Graphics time is steady between runs; the 99th-percentile frame is not -- it moved from 12 to 390 ms between two runs of one build, on main's too (<i>The frame-rate pass</i>, below). Runs: ${esc(a)} and ${esc(b)}.</p><table><tr><th>Case</th><th>main GPU ms</th><th>branch GPU ms</th><th>main triangles</th><th>branch triangles</th><th>main p99 frame</th><th>branch p99 frame</th></tr>${rows}</table>`;
 };
 // The newest of a series: name.json, name-2.json, name-3.json ...
 const latest = prefix => { const dir = path.join(SHOTS, 'frames'); if (!has(dir)) return null; const n = f => Number(f.slice(prefix.length).match(/^-([0-9]+)[.]json$/)?.[1] ?? (f === prefix + '.json' ? 1 : NaN));
  return fs.readdirSync(dir).filter(f => n(f) > 0).sort((x, y) => n(x) - n(y)).pop() ?? null; };
 return `<h3>The wait for an 18-hole course (Node, one process; the game spreads part of it over workers)</h3>${gen}
 <h3>The game's size</h3><table><tr><th></th><th>main (its kept build)</th><th>branch (dist/)</th></tr><tr><td>The single file</td><td>${size(path.join(SHOTS, 'main-build', 'index.html'))}</td><td>${size('dist/index.html')}</td></tr></table>
 <h3>Frame rate (RTX 4090, graphics time per frame, median)</h3>
 ${frame('main-biomes.json', latest('branch-biomes') ?? '', 'Every landscape, High')}
 ${frame('main-tiers-autumn.json', latest('branch-tiers-autumn') ?? '', 'Every tier, Autumn')}
 ${frame('main-tiers.json', latest('branch-tiers') ?? '', 'Every tier, Redwood')}`;
}

// ---------------------------------------------------------------- page
const before = biomes.map(b => {
 const vs = views(b);
 if (!vs.length) return '';
 return `<section><h3>${esc(BIOMES[b].name)}</h3><div class="grid wide">${vs.map(v => slider(beforeOf(b, v.name), path.join(SHOTS, AFTER, b, `${v.name}.jpg`), v.caption)).join('')}</div></section>`;
}).join('\n');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cartoon overhaul showcase</title>
<style>
:root{--bg:#f6f4ee;--fg:#1d2420;--muted:#5d6760;--line:#d9d6cc;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141815;--fg:#e8ebe6;--muted:#9aa49d;--line:#2c332e;--card:#1c211d}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1500px;margin:0 auto;padding:16px}
h1{font-size:28px;margin:8px 0 4px}h2{margin-top:40px;border-bottom:1px solid var(--line);padding-bottom:4px}
nav a{margin-right:14px;color:inherit}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}.grid.wide{grid-template-columns:repeat(auto-fill,minmax(460px,1fr))}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;overflow:hidden}
figure img{width:100%;display:block}figcaption{padding:4px 8px;font-size:13px;color:var(--muted)}
.pair{position:relative;line-height:0}.pair img{width:100%}.pair .top{position:absolute;inset:0;clip-path:inset(0 50% 0 0)}
.pair input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0}
.pair::after{content:'';position:absolute;top:0;bottom:0;left:var(--at,50%);width:2px;background:#fff;box-shadow:0 0 3px #000;pointer-events:none}
.hint{float:right}
table{border-collapse:collapse;margin:8px 0;background:var(--card)}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
.scroll{overflow-x:auto}table.rounds td{min-width:240px}table.rounds img{width:240px}
.sw{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:middle}
code{background:var(--line);padding:0 3px;border-radius:3px}
</style></head><body><main>
<h1>Cartoon overhaul</h1>
<p>Branch <code>cartoon-overhaul</code> against main (e3b6288), built ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from <code>bench/shots/overhaul/</code>. The record and the notes are docs/CARTOON_OVERHAUL.md; this page only shows them.</p>
<nav><a href="#before">Before and after</a><a href="#light">Light</a><a href="#rounds">Rounds</a><a href="#grounds">Ground types</a><a href="#numbers">Numbers</a><a href="#frame">Frame rate</a><a href="#rules">Rules set aside</a></nav>
<h2 id="before">Every landscape, main and the branch</h2>
<p>Seed <code>overhaul</code>, nine holes, the same camera rule in both. Generation has changed, so a pair is the same hole and camera, not the same ground.</p>
${before}
<h2 id="light">The lighting rounds</h2>${lighting()}
<h2 id="rounds">Every asset and texture, round by round</h2>${rounds()}
<h2 id="grounds">The ground types</h2>${grounds()}
<h2 id="numbers">Wait, size and frame rate</h2>${numbers()}
<h2 id="frame">The frame-rate pass</h2>${md(section('Frame rate'))}
<h2 id="rules">Rules set aside</h2>${md(section('Rules set aside'))}
</main>
<script>
for(const p of document.querySelectorAll('.pair')){const top=p.querySelector('.top'),r=p.querySelector('input');
 const set=()=>{top.style.clipPath='inset(0 '+(100-r.value)+'% 0 0)';p.style.setProperty('--at',r.value+'%');};r.addEventListener('input',set);set();}
</script></body></html>`;
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, html);
console.log(`${path.relative(process.cwd(), OUT)}: ${(html.length / 1024).toFixed(0)} KB, linking ${(html.match(/<img /g) || []).length} pictures`);
