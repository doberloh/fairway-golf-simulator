#!/usr/bin/env node
// THE 1.0 POLISH'S SHOWCASE FOR THE OWNER (docs/UI_POLISH.md): every screen the
// interface audit walks, before (main, 0.9.5) and after (this branch), at a
// phone, a laptop and 4K, side by side; the press counts per mode; the motion
// checks. Local, like every report (AGENTS.md, *What stays local*): it points
// at the audit's pictures where they are, under bench/shots/ (git-ignored).
//
//   node tools/capture/ui-polish-showcase.mjs [--before before] [--after final]
//   -> docs/reports/ui-polish-showcase.html
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const AUDIT = path.resolve('bench/shots/ui-audit');
const before = path.join(AUDIT, opt('before', 'before')), after = path.join(AUDIT, opt('after', 'final'));
const SIZES = (opt('sizes', '390x844,1280x720,3840x2160')).split(',');
const OUT = path.resolve('docs/reports/ui-polish-showcase.html');
const rel = f => path.relative(path.dirname(OUT), f).split(path.sep).join('/');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

const screens = new Set();
for (const dir of [before, after]) for (const s of SIZES) { const d = path.join(dir, s); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.endsWith('.png')) screens.add(f.replace(/\.png$/, '')); }
const counts = f => { const r = readJson(path.join(f, 'findings.json')); return r ? `${r.open.length} findings (${new Set(r.open.map(x => x.rule + x.screen + x.path)).size} distinct), ${r.known.length} explained` : 'not run'; };
const flowsBefore = readJson('bench/shots/ui-flows/before-main-ui.json') || [], flowsAfter = readJson('bench/shots/ui-flows/after-dist-exp.json') || [];
const motion = readJson('bench/shots/ui-motion/latest/report.json') || [];

const rows = [...screens].sort().map(sc => `<section><h3>${esc(sc)}</h3>${SIZES.map(s => {
 const b = path.join(before, s, sc + '.png'), a = path.join(after, s, sc + '.png');
 const img = (f, label) => fs.existsSync(f) ? `<figure><img loading="lazy" src="${rel(f)}" alt="${esc(label)}"><figcaption>${esc(label)}</figcaption></figure>` : `<figure class="none"><figcaption>${esc(label)}: not on this screen</figcaption></figure>`;
 return `<div class="pair">${img(b, `before · ${s}`)}${img(a, `after · ${s}`)}</div>`;
}).join('')}</section>`).join('\n');

const flowTable = `<table><tr><th>Mode</th><th>main mouse</th><th>main keys</th><th>branch mouse</th><th>branch keys</th></tr>${
 [...new Set([...flowsBefore, ...flowsAfter].map(r => r.mode))].map(m => { const b = flowsBefore.find(r => r.mode === m), a = flowsAfter.find(r => r.mode === m);
  const c = (r, k) => r ? (r.ok ? r[k] : 'stuck') : '--';
  return `<tr><td>${esc(m)}</td><td>${c(b, 'clicks')}</td><td>${c(b, 'keys')}</td><td>${c(a, 'clicks')}</td><td>${c(a, 'keys')}</td></tr>`; }).join('')}</table>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>1.0 polish showcase</title><style>
body{margin:0;padding:24px;background:#0b100e;color:#e8eee6;font:15px/1.5 system-ui,sans-serif}h1,h2,h3{font-weight:700}h3{margin:28px 0 8px;font-size:15px;color:#facc15}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 10px}figure{margin:0;background:#151c18;padding:6px}figure img{width:100%;display:block}
figcaption{font-size:12px;color:#9ab}figure.none{display:grid;place-items:center;min-height:80px}table{border-collapse:collapse;margin:8px 0 20px}td,th{border:1px solid #2a332e;padding:4px 10px;text-align:left}
.ok{color:#6ee38c}.fail{color:#f87171}@media(max-width:700px){.pair{grid-template-columns:1fr}}
</style></head><body>
<h1>The 1.0 interface polish</h1>
<p>Every screen the interface audit walks, before (main, 0.9.5) and after (branch <code>ui-polish-1-0</code>). The record, the checklist and every decision are in <code>docs/UI_POLISH.md</code>.</p>
<p>Audit, before: ${esc(counts(before))}. After: ${esc(counts(after))}.</p>
<h2>Presses from the main menu into each mode</h2>${flowTable}
<h2>Motion checks</h2><ul>${motion.map(r => `<li class="${r.ok ? 'ok' : 'fail'}">${r.ok ? 'pass' : 'FAIL'} -- ${esc(r.name)}${r.detail ? ` (${esc(r.detail)})` : ''}</li>`).join('') || '<li>not run</li>'}</ul>
<h2>Every screen</h2>${rows}
</body></html>`;
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, html);
console.log(`${OUT}: ${screens.size} screens at ${SIZES.join(', ')}`);
