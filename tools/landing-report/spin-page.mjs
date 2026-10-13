// Writes docs/reports/backspin/index.html from plan.json and the clips beside it:
// how far the ball comes back for each spin and green firmness, as a table per
// version and as clips, every version of a shot filmed the same way so they can
// be played together. Anything written for the reader goes in notes.html beside
// it (local, like the report), and is placed after the heading.
//
//   node tools/landing-report/spin-page.mjs
import fs from 'node:fs';

const DIR = process.env.SPIN_OUT || 'docs/reports/backspin';
const plan = JSON.parse(fs.readFileSync(`${DIR}/plan.json`, 'utf8'));
const notes = fs.existsSync(`${DIR}/notes.html`) ? fs.readFileSync(`${DIR}/notes.html`, 'utf8') : '';
const labels = plan.builds.map(b => b.label);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rpm = n => n.toLocaleString('en-US');
const yd = x => `${x > 0 ? '+' : ''}${x.toFixed(1)}`;
// Darker the further it came back, on a fixed scale so versions compare.
const shade = back => back < 0.25 ? '' : ` style="--k:${Math.min(1, back / 8).toFixed(2)}"`;

const table = label => {
 const wedge = plan.shots.filter(s => s.row === 'wedge'), spins = [...new Set(wedge.map(s => s.spin))];
 const extra = plan.shots.filter(s => s.row !== 'wedge');
 const line = (title, cells) => `<tr><th scope="row">${title}</th>${cells.map(s => { const m = s.by[label]; return `<td${shade(m.back)}><b>${m.back.toFixed(1)}</b><small>${yd(m.release)}</small></td>`; }).join('')}</tr>`;
 return `<table class="back">
  <thead><tr><th>${esc(label)}</th>${plan.firmness.map(f => `<th>${f}</th>`).join('')}</tr></thead>
  <tbody>${spins.map(spin => line(`Wedge ${rpm(spin)}`, plan.firmness.map(f => wedge.find(s => s.spin === spin && s.firmness === f)))).join('')}
  ${[...new Set(extra.map(s => s.row))].map(row => { const r = extra.filter(s => s.row === row); return line(`${row === 'steep' ? 'Steep wedge' : '7 iron'} ${rpm(r[0].spin)}`, plan.firmness.map(f => r.find(s => s.firmness === f))); }).join('')}
  </tbody></table>`;
};
const cell = s => labels.map(label => {
 const m = s.by[label];
 return `<figure class="v-${esc(label)}">
     <video muted playsinline controls preload="metadata" src="${s.id}-${esc(label)}.webm"></video>
     <figcaption><b>${esc(label)}</b> <span>back ${m.back.toFixed(1)} yd · finish ${yd(m.release)} yd · first hop ${m.hopFt.toFixed(1)} ft</span></figcaption>
    </figure>`;
}).join('');
const groups = [];
for (const row of plan.rows) for (const spin of [...new Set(plan.shots.filter(s => s.row === row.id).map(s => s.spin))]) {
 const shots = plan.firmness.map(f => plan.shots.find(s => s.row === row.id && s.spin === spin && s.firmness === f));
 const a = shots[0];
 groups.push(`
 <section>
  <h2>${esc(row.title)} · ${rpm(spin)} rpm</h2>
  <p class="note">${a.mph} mph ball speed, ${a.vla}° launch, lands at ${a.by[labels[0]].descent}° with about ${rpm(a.by[labels[0]].landingRpm)} rpm left. <button class="play">Play all twelve together</button></p>
  <div class="grid">${shots.map(s => `
   <div class="col"><h3>${s.firmness}</h3>${cell(s)}</div>`).join('')}
  </div>
 </section>`);
}
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Backspin rework</title>
<style>
:root{--ink:#22322a;--dim:#5f6f63;--line:#d9e0d6;--paper:#f6f8f3;--card:#fff;--hot:180,60,40;color-scheme:light;font:16px/1.55 Inter,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}
@media (prefers-color-scheme:dark){:root{--ink:#e3e9e2;--dim:#9aa79c;--line:#33403a;--paper:#141a17;--card:#1c2420;--hot:240,110,80;color-scheme:dark}}
body{margin:0;padding:32px 16px 64px;background:var(--paper)}
main{max-width:1320px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
h1,h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;margin:0}
h1{font-size:38px;line-height:1.1}h2{font-size:24px}h3{margin:0;font-size:15px}
p,li{max-width:80ch}p{margin:0}.lede{color:var(--dim);font-size:18px}
section{display:flex;flex-direction:column;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.col{display:flex;flex-direction:column;gap:10px}
figure{margin:0;display:flex;flex-direction:column;gap:4px}
video{width:100%;aspect-ratio:16/9;background:#111;border-radius:6px}
figcaption{font-size:12.5px;font-variant-numeric:tabular-nums}figcaption span{color:var(--dim)}
.note{font-size:14px;color:var(--dim)}
button{font:600 13px Inter,sans-serif;padding:5px 11px;border-radius:7px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;margin-left:8px}
.tables{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
table.back{border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:14px;width:100%}
table.back th,table.back td{border:1px solid var(--line);padding:5px 7px;text-align:right}
table.back th[scope=row]{text-align:left;font-weight:500;white-space:nowrap}
table.back td{background:rgba(var(--hot),calc(var(--k,0)*.55))}
table.back td small{display:block;color:var(--dim);font-size:11px}
.toggles label{margin-right:14px;font-size:14px}
${labels.map(l => `body.hide-${l} .v-${l}{display:none}`).join('')}
table.plain{border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
table.plain th,table.plain td{border:1px solid var(--line);padding:4px 8px;text-align:right}
table.plain th:first-child,table.plain td:first-child{text-align:left}
@media (max-width:900px){.grid{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.grid{grid-template-columns:1fr}h1{font-size:30px}}
</style>
</head>
<body>
<main>
 <header style="display:flex;flex-direction:column;gap:10px">
  <h1>Backspin rework</h1>
  <p class="lede">How far a ball comes back on a flat green at Stimp ${plan.stimp}, for each launch spin and green firmness, on ${labels.length === 1 ? 'the game as it is' : `${labels.length} versions of the physics: ${labels.map(esc).join(', ')}`}.</p>
 </header>
 ${notes}
 <section>
  <h2>How far it comes back, in yards</h2>
  <p class="note">Big number: how far the ball rolled back from the furthest point it reached. Small number: where it finished against its pitch mark (negative is behind it). Darker is further back.</p>
  <div class="tables">${labels.map(table).join('')}</div>
 </section>
 <section class="toggles"><h2>The clips</h2>
  <p class="note">Filmed side-on from beside the pitch mark: the ball comes in from the top, the flag stands level with where it lands, forward is to the left and back toward the golfer is to the right. The line is the game's tracer. Every version of a shot is filmed for the same length. The tables are measured on green that never ends; the range green in the clips reaches about 18 yards from the flag, so only the very longest come-backs get near its edge. Show:
  ${labels.map(l => `<label><input type="checkbox" checked data-v="${esc(l)}"> ${esc(l)}</label>`).join('')}</p>
 </section>
 ${groups.join('')}
</main>
<script>
for (const box of document.querySelectorAll('[data-v]')) box.onchange = () => document.body.classList.toggle('hide-' + box.dataset.v, !box.checked);
for (const b of document.querySelectorAll('button.play')) b.onclick = () => {
 const vids = [...b.closest('section').querySelectorAll('video')].filter(v => v.offsetParent);
 for (const v of vids) { v.pause(); v.currentTime = 0; }
 Promise.all(vids.map(v => v.readyState >= 2 ? 0 : new Promise(r => v.addEventListener('canplay', r, {once: true})))).then(() => vids.forEach(v => v.play()));
};
</script>
</body>
</html>
`;
fs.writeFileSync(`${DIR}/index.html`, html);
const missing = plan.shots.flatMap(s => labels.map(l => `${s.id}-${l}.webm`)).filter(f => !fs.existsSync(`${DIR}/${f}`));
console.log(`${DIR}/index.html${missing.length ? ` (${missing.length} clips not recorded yet)` : ''}`);
