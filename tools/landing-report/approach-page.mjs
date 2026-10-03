// Writes docs/reports/chipping/index.html from plan.json: the fifteen clips by
// distance, each with the numbers it was played with and what it did.
//
//   node tools/landing-report/approach-page.mjs
import fs from 'node:fs';

const DIR = 'docs/reports/chipping';
const plan = JSON.parse(fs.readFileSync(`${DIR}/plan.json`, 'utf8'));
const slug = s => `${s.yards}yd-${s.style.toLowerCase().replace(/[^a-z]+/g, '-')}`;
const rows = [10, 20, 50, 80, 100].map(y => plan.shots.map((s, i) => ({...s, i})).filter(s => s.yards === y));
const card = s => `
   <figure>
    <video muted playsinline controls preload="metadata" src="${String(s.i + 1).padStart(2, '0')}-${slug(s)}.webm"></video>
    <figcaption><b>${s.style}</b> <span>${s.club}</span></figcaption>
    <dl>
     <div><dt>Ball speed</dt><dd>${s.mph} mph</dd></div><div><dt>Launch</dt><dd>${s.vla}&deg;</dd></div><div><dt>Spin</dt><dd>${s.spin.toLocaleString('en-US')} rpm</dd></div>
     <div><dt>Carry</dt><dd>${s.carry} yd</dd></div><div><dt>Roll</dt><dd>${s.roll} yd</dd></div><div><dt>Peak height</dt><dd>${s.apexFt} ft</dd></div>
    </dl>
   </figure>`;
const intro = {10: 'From just off the front of the green.', 20: 'From just off the front of the green.', 50: 'From the fairway.', 80: 'From the fairway.', 100: 'From the fairway.'};
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chipping and approach shots</title>
<style>
:root{--ink:#22322a;--dim:#5f6f63;--line:#d9e0d6;--paper:#f6f8f3;--card:#fff;--green:#3f9d5a;font:16px/1.55 Inter,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}
body{margin:0;padding:32px 20px 64px}
main{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
h1,h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;margin:0}
h1{font-size:40px;line-height:1.1}
h2{font-size:26px}
p{margin:0;max-width:76ch}
.lede{color:var(--dim);font-size:18px}
section{display:flex;flex-direction:column;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px}
.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
figure{margin:0;display:flex;flex-direction:column;gap:6px}
video{width:100%;aspect-ratio:16/9;background:#111;border-radius:8px}
figcaption{font-size:15px}
figcaption span{color:var(--dim);margin-left:6px}
dl{margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px 10px;font-size:13px;font-variant-numeric:tabular-nums}
dl div{display:flex;flex-direction:column}
dt{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
dd{margin:0;font-weight:600}
button{align-self:flex-start;font:600 14px Inter,sans-serif;padding:8px 13px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer}
.note{font-size:14px;color:var(--dim)}
@media (max-width:900px){.row{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
 <header style="display:flex;flex-direction:column;gap:12px">
  <h1>Chipping and approach shots</h1>
  <p class="lede">Fifteen shots on hole 4 of the test course, at 10, 20, 50, 80 and 100 yards, each played three ways: low and running, the stock shot, and high and soft. This is the physics on branch <code>ball-landing</code>, seen from the game's default camera -- what a player sees.</p>
  <p class="note">Launch and spin for each style come from published numbers (Trackman's chips launch 6-35 degrees on 1,500-3,000 rpm; a wedge hit 50 yards launches about 28 degrees on 6,500 rpm; a full pitching wedge about 24 on 9,000). The ball speed is solved for the carry the style aims at. No wind, a Normal green at Stimp 10, mid-afternoon light. Every shot finished on the green, 0.6 to 5.5 yards from the pin.</p>
 </header>
${rows.map(r => `
 <section>
  <h2>${r[0].yards} yards</h2>
  <p class="note">${intro[r[0].yards]}</p>
  <div class="row">${r.map(card).join('')}
  </div>
  <button data-play>Play all three</button>
 </section>`).join('')}
</main>
<script>
for (const b of document.querySelectorAll('[data-play]')) b.addEventListener('click', () => {
 for (const v of b.previousElementSibling.querySelectorAll('video')) { v.currentTime = 0; v.play(); }
});
</script>
</body>
</html>
`;
fs.writeFileSync(`${DIR}/index.html`, html);
console.log(`${DIR}/index.html`);
