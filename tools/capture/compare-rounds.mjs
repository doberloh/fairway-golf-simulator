// ROUNDS SIDE BY SIDE (the cartoon overhaul, 25 October 2026): one landscape's
// fixed views from two or more capture sets, a row per view and a column per
// set, as one image to judge a round against the last.
//
//   node tools/capture/compare-rounds.mjs <biome> <label> <label> [...] [--views a,b] [--out file.jpg]
//
// Reads bench/shots/overhaul/<label>/<biome>/<view>.jpg (tools/capture/
// overhaul.mjs) and writes bench/shots/overhaul/compare/<biome>-<labels>.jpg.
// Light work: a page of pictures, no game and no capture build.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

//
//   node tools/capture/compare-rounds.mjs --across <label> <biome> [...] --views a,b
//
// The other way about: one set, a row per landscape and a column per view --
// a round's light judged across every landscape at once.
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const across = argv.includes('--across');
if (across) argv.splice(argv.indexOf('--across'), 1);
const only = opt('--views', null)?.split(','), outArg = opt('--out', null);
const ROOT = path.join('bench', 'shots', 'overhaul');
const [first, ...rest] = argv;
// Rows and columns, each cell a picture file.
let rows, cols, file, name;
if (across) {
 if (!first || !rest.length || !only) throw Error('usage: node tools/capture/compare-rounds.mjs --across <label> <biome> [...] --views a,b');
 rows = rest; cols = only; file = (b, v) => path.join(ROOT, first, b, `${v}.jpg`); name = `${first}-across-${only.join('-')}`;
} else {
 if (!first || rest.length < 2) throw Error('usage: node tools/capture/compare-rounds.mjs <biome> <label> <label> [...] [--views a,b]');
 const dirOf = label => path.join(ROOT, label, first);
 for (const l of rest) if (!fs.existsSync(dirOf(l))) throw Error(`no pictures at ${dirOf(l)}`);
 rows = only ?? [...new Set(rest.flatMap(l => fs.readdirSync(dirOf(l)).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4))))].sort();
 cols = rest; file = (v, l) => path.join(dirOf(l), `${v}.jpg`); name = `${first}-${rest.join('-')}${only ? '-' + only.join('-') : ''}`;
}
const cell = (r, c) => { const f = file(r, c); return fs.existsSync(f) ? `<img src="${pathToFileURL(path.resolve(f)).href}">` : '<div class="none">none</div>'; };
const html = `<!doctype html><style>body{margin:0;background:#111;font:14px sans-serif;color:#ddd}
table{border-spacing:4px}td{vertical-align:top;width:${Math.floor(1600 / cols.length)}px}img{width:100%;display:block}th{text-align:left;padding:2px 4px}
.none{aspect-ratio:16/9;background:#222}</style><table><tr><th></th>${cols.map(l => `<th>${l}</th>`).join('')}</tr>
${rows.map(r => `<tr><th style="writing-mode:vertical-rl">${r}</th>${cols.map(c => `<td>${cell(r, c)}</td>`).join('')}</tr>`).join('\n')}</table>`;
const outDir = path.join(ROOT, 'compare');
fs.mkdirSync(outDir, {recursive: true});
const out = path.resolve(outArg ?? path.join(outDir, `${name}.jpg`));
const tmp = path.join(outDir, `_${process.pid}.html`);
fs.writeFileSync(tmp, html);
const b = await chromium.launch();
try {
 const p = await b.newPage({viewport: {width: 1640, height: 800}});
 await p.goto(pathToFileURL(path.resolve(tmp)).href);
 await p.waitForLoadState('load');
 await p.screenshot({path: out, fullPage: true, type: 'jpeg', quality: 82});
} finally { await b.close(); fs.unlinkSync(tmp); }
console.log(`${out}: ${rows.length} rows x ${cols.length} columns`);
