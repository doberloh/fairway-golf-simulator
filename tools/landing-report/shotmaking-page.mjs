// Writes docs/reports/shotmaking/index.html from plan.json: the six shot-making
// clips, each with the numbers it was played with, what it did, and where those
// numbers come from.
//
//   node tools/landing-report/shotmaking-page.mjs
import fs from 'node:fs';

const DIR = 'docs/reports/shotmaking';
const plan = JSON.parse(fs.readFileSync(`${DIR}/plan.json`, 'utf8'));
// What each shot is, in a sentence, and where its numbers come from.
const ABOUT = {
 'stinger': ['Hit low on purpose with a long iron: the ball stays under the wind and runs a long way once it lands.',
  'No launch monitor figures for a stinger have been published that we could find. Launch is set a few degrees under a normal long iron. It peaks at 54 ft here; the model is known to fly this shot somewhat higher than the 30-45 ft a stinger is usually described at (TODO, <em>A stinger needs a 2-5 degree launch</em>).'],
 'high-draw': ['A driver started right of the target that curves back left, launched high on low spin.',
  'Ball speed is the tour average for a driver (167 mph). Launch and spin are set either side of the tour average of about 11 degrees and 2,700 rpm; the spin axis is chosen for about 12 yards of curve.'],
 'power-fade': ['A driver started left that curves gently right, flown a little lower on a little more spin.',
  'Same driver speed. Spin is a touch above the tour average, which is what a fade usually costs.'],
 'knockdown': ['A 7 iron with a shortened swing: lower, less spin, landing short of the green and running on to the flag.',
  'A full tour 7 iron is about 120 mph, 16 degrees and 7,000 rpm. This takes some off each; the ball speed is solved so it finishes at the flag.'],
 'flop': ['An open-faced lob wedge from just off the green: straight up, straight down, stopping almost where it lands.',
  'Launch and spin from a published Trackman comparison of pitch and flop shots: flops launching 40-45 degrees averaged about 2,200 rpm, landing about 51 degrees steep. This one lands at 49.'],
 'zip-back': ['A full sand wedge into a soft green: it lands past the flag, hops forward and spins back to it.',
  'Spin sits at the tour average for a full pitching wedge (about 9,300 rpm) plus a little for the extra loft. The green is set to Soft, which is where tour players get this.'],
};
const fmt = n => n.toLocaleString('en-US');
const card = (s, i) => {
 const [what, source] = ABOUT[s.name], file = `${String(i + 1).padStart(2, '0')}-${s.name}`;
 const shape = Math.abs(s.curveYd) >= 5 ? `${Math.abs(s.curveYd)} yd ${s.curveYd < 0 ? 'left' : 'right'}` : 'straight';
 const after = s.landedFrom > .5 ? `spun back ${s.landedFrom} yd` : `ran ${(s.total - s.carry).toFixed(1)} yd`;
 return `
  <article>
   <video muted playsinline controls preload="none" poster="${file}.jpg" src="${file}.webm"></video>
   <div class="text">
    <h2>${s.title} <span>${s.club}</span></h2>
    <p>${what}</p>
    <dl>
     <div><dt>Ball speed</dt><dd>${s.mph} mph</dd></div>
     <div><dt>Launch</dt><dd>${s.vla}&deg;</dd></div>
     <div><dt>Spin</dt><dd>${fmt(s.spin)} rpm</dd></div>
     <div><dt>Carry</dt><dd>${s.carry} yd</dd></div>
     <div><dt>Peak height</dt><dd>${s.apexFt} ft</dd></div>
     <div><dt>Then</dt><dd>${after}</dd></div>
     <div><dt>Curve</dt><dd>${shape}</dd></div>
     <div><dt>Landing angle</dt><dd>${s.descent}&deg;</dd></div>
     <div><dt>Finished</dt><dd>${s.toPin !== null ? `${s.toPin} yd from the flag` : `on the ${s.finishedOn}`}</dd></div>
    </dl>
    <p class="source">${source}</p>
   </div>
  </article>`;
};
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shot-making clips</title>
<style>
:root{--ink:#22322a;--dim:#5f6f63;--line:#d9e0d6;--paper:#f6f8f3;--card:#fff;--accent:#2f7d48;font:16px/1.55 Inter,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}
@media (prefers-color-scheme:dark){:root{--ink:#e3ebe2;--dim:#9fb0a2;--line:#2f3d33;--paper:#121a15;--card:#19231d;--accent:#7cc792;color-scheme:dark}}
body{margin:0;padding:32px 20px 64px;background:var(--paper)}
main{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
h1,h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;margin:0;text-wrap:balance}
h1{font-size:40px;line-height:1.1}
h2{font-size:26px}
h2 span{font:500 14px Inter,sans-serif;color:var(--dim);margin-left:8px;letter-spacing:.03em}
p{margin:0;max-width:72ch}
.lede{color:var(--dim);font-size:18px}
article{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:22px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
video{width:100%;aspect-ratio:16/9;background:#111;border-radius:8px;display:block}
.text{display:flex;flex-direction:column;gap:12px}
dl{margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;font-variant-numeric:tabular-nums}
dl div{display:flex;flex-direction:column}
dt{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
dd{margin:0;font-weight:600;font-size:15px}
.source{font-size:13px;color:var(--dim);border-top:1px solid var(--line);padding-top:10px}
.note{font-size:14px;color:var(--dim)}
code{font-size:.92em}
@media (max-width:860px){article{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
 <header style="display:flex;flex-direction:column;gap:12px">
  <h1>Shot-making clips</h1>
  <p class="lede">Six of the shots players show off with, each played through the game's physics with launch-monitor numbers a strong real player produces. Filmed the way television shows them: from behind the ball while the tracer draws the shape, then beside where it lands.</p>
  <p class="note">The test course (Pacific Northwest, seed REPORT1), no wind, Normal greens at Stimp 10 except where said, branch <code>ball-landing</code>. Recorded at 1920x1080 on Ultra with the interface hidden, so they can go straight onto the website. Every number below is what the physics did, not what was asked for.</p>
 </header>
${plan.shots.map(card).join('')}
 <p class="note">How these were made: <code>node tools/landing-report/shotmaking-plan.mjs</code> plans and checks each shot, <code>shotmaking-clips.mjs</code> films it, this page is <code>shotmaking-page.mjs</code>. Sources are in RESEARCH.md, <em>Shot-making clips</em>.</p>
</main>
</body>
</html>
`;
fs.writeFileSync(`${DIR}/index.html`, html);
console.log(`${DIR}/index.html`);
