import fs from 'node:fs';
const f = JSON.parse(fs.readFileSync('scratchpad/band-field.json', 'utf8'));

const page = `<!doctype html><meta charset="utf-8"><title>Mown band around water — three options</title>
<style>
 :root{color-scheme:light}
 body{margin:0;font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#1d2a22;background:#f4f2ec;padding:22px}
 h1{font:600 21px/1.3 Georgia,serif;margin:0 0 4px}
 p.lead{margin:0 0 16px;color:#5d6b62;max-width:92ch}
 .row{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
 figure{margin:0;background:#fff;border:1px solid #d9d6cd;border-radius:10px;padding:10px}
 figcaption{font-size:12px;margin-top:8px;max-width:30ch;color:#3d4a42}
 figcaption b{display:block;font-size:13px;color:#1d2a22;margin-bottom:2px}
 figcaption i{display:block;font-style:normal;color:#8a6b1f;margin-top:6px}
 figcaption em{display:block;font-style:normal;color:#2f6b45;margin-top:6px;font-variant-numeric:tabular-nums}
 canvas{display:block;border-radius:6px;background:#ccc}
 .controls{margin:16px 0 14px;display:flex;gap:24px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid #d9d6cd;border-radius:10px;padding:12px 16px}
 label{font-size:12px;display:flex;gap:8px;align-items:center}
 input[type=range]{width:150px}
 output{font-variant-numeric:tabular-nums;min-width:52px;color:#5d6b62}
 .note{font-size:12.5px;color:#5d6b62;max-width:92ch;margin-top:18px;line-height:1.6}
 .note b{color:#1d2a22}
 .key{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 0;font-size:12px;align-items:center}
 .key span{display:flex;gap:6px;align-items:center}
 .sw{width:13px;height:13px;border-radius:3px;display:inline-block;border:1px solid rgba(0,0,0,.15)}
</style>
<h1>The mown band where a pond bites into a fairway</h1>
<p class="lead">Seed <b>${f.seed}</b>, hole <b>${f.hole}</b> — a real generated pond with 30 of its 48 rim points inside the playing corridor. Nothing here is drawn by hand: both panels are computed live from the hole's own two distance fields, the corridor and the water. The sliders are live.</p>

<div class="controls">
 <label>Semi-rough width <input id="semi" type="range" min="0" max="15" step="0.5" value="${f.semiRough}"><output id="semiV"></output></label>
 <label>Corner rounding <input id="round" type="range" min="0" max="12" step="0.5" value="0"><output id="roundV"></output></label>
 <label><input id="slice" type="checkbox"> show the widest semi swath</label>
</div>
<div class="row" id="row"></div>
<div class="key">
 <span><i class="sw" style="background:#608449"></i> fairway</span>
 <span><i class="sw" style="background:#a1b481"></i> semi-rough</span>
 <span><i class="sw" style="background:#7d8a63"></i> rough</span>
 <span><i class="sw" style="background:#70a6aa"></i> water</span>
 <span><i class="sw" style="background:#c8b58a"></i> shore soil</span>
</div>

<p class="note">
<b>What each panel does.</b> <b>A</b> is what ships today: two independent rules unioned — the corridor has its own band, and separately any fairway within reach of water is demoted. Where a pond comes near the fairway edge the two bands meet and add up. <b>B</b> is the same two rules with the join rounded, which is the cheap change: a mower cannot turn a sharp corner, so the notch where the two boundaries cross is not a shape a mower could leave. <b>C</b> rebuilds it as one distance field — the mown region is the corridor minus the water's reach, and semi-rough is a single uniform offset of that region, so two bands can never stack.<br><br>
<b>The number under each panel</b> is the widest unbroken run of semi-rough across the hole, measured on every row. That is the quantity in dispute: A and B leave it free to grow where two edges are close; C holds it down by construction. Drag <em>Corner rounding</em> to see B separate from A — at zero they are identical.<br><br>
<b>Note that the visible band width is already constant in all three.</b> Moving out from the water you get shore soil, then exactly one semi-rough width, then fairway, whatever the size of the pond. What differs is only what happens where the pond's band meets the corridor's own.
</p>

<script>
const F = ${JSON.stringify(f.fair)}, W = ${JSON.stringify(f.water)};
const NX = ${f.nx}, NZ = ${f.nz}, STEP = ${f.step};
const COL = {fair:[96,132,73], semi:[161,180,129], rough:[125,138,99], water:[112,166,170], soil:[200,181,138]};
const LIP = 2.4;                       // WATER_LIP: the cut bank, painted as soil

// A is the two rules as they ship. B rounds the join between them. C is the one
// that needs real work: semi-rough as a single uniform offset of the mown
// region, which is a distance transform and not a formula -- that is the whole
// point of it, and the first version of this page got it wrong by writing it as
// a formula, which silently reproduced B exactly.
const smin=(a,b,k)=>{ if(k<=0) return Math.min(a,b); const h=Math.max(0,1-Math.abs(a-b)/k)*0.5; return Math.min(a,b)-h*h*k; };
const smax=(a,b,k)=>-smin(-a,-b,k);

// Chamfer distance transform, in cells, of the FALSE region away from TRUE.
function distanceOutside(mask){
 const INF=1e9, d=new Float32Array(NX*NZ);
 for(let i=0;i<d.length;i++) d[i]=mask[i]?0:INF;
 const a=1, b=Math.SQRT2;
 for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){ const k=j*NX+i; let v=d[k];
  if(i>0) v=Math.min(v,d[k-1]+a);
  if(j>0) v=Math.min(v,d[k-NX]+a);
  if(i>0&&j>0) v=Math.min(v,d[k-NX-1]+b);
  if(i<NX-1&&j>0) v=Math.min(v,d[k-NX+1]+b);
  d[k]=v; }
 for(let j=NZ-1;j>=0;j--)for(let i=NX-1;i>=0;i--){ const k=j*NX+i; let v=d[k];
  if(i<NX-1) v=Math.min(v,d[k+1]+a);
  if(j<NZ-1) v=Math.min(v,d[k+NX]+a);
  if(i<NX-1&&j<NZ-1) v=Math.min(v,d[k+NX+1]+b);
  if(i>0&&j<NZ-1) v=Math.min(v,d[k+NX-1]+b);
  d[k]=v; }
 return d;
}

// Each panel returns a full classification grid, so C can do global work.
const PANELS = [
 ['A · today', 'Two independent rules unioned: the corridor has its own band, and separately any fairway within reach of the water is demoted. Where a pond nears the fairway edge the two meet and add up.', (semi,k)=>{
   const out=new Uint8Array(NX*NZ);
   for(let n=0;n<out.length;n++){ const fd=F[n], wd=W[n];
    out[n] = wd<0 ? 3 : (fd<0 && wd<LIP+semi) ? 1 : fd<0 ? 0 : fd<semi ? 1 : 2; }
   return out;
 }],
 ['B · rounded join', 'The same two rules, with the join between them rounded. A mower leaves a curve, never a notch. At rounding 0 this is identical to A by construction.', (semi,k)=>{
   const out=new Uint8Array(NX*NZ);
   for(let n=0;n<out.length;n++){ const fd=F[n], wd=W[n];
    if(wd<0){ out[n]=3; continue; }
    // Negative means inside. The corridor's own band, unioned with the water's
    // band RESTRICTED to inside the corridor -- unrestricted, the water term is
    // satisfied everywhere far from water and the whole hole turns semi.
    const mown = smax(fd, LIP+semi-wd, k);
    const band = smin(fd-semi, Math.max(fd, wd-(LIP+semi)), k);
    out[n] = mown<0 ? 0 : band<0 ? 1 : 2; }
   return out;
 }],
 ['C · one uniform offset', 'The mown region is the corridor pulled back from the water, and semi-rough is one uniform offset of THAT region. Two bands can never stack, because there is only ever one.', (semi,k)=>{
   const mown=new Uint8Array(NX*NZ);
   for(let n=0;n<mown.length;n++) mown[n] = (W[n]>=LIP+semi && F[n]<0) ? 1 : 0;
   const d=distanceOutside(mown);
   const reach=semi/STEP;
   const out=new Uint8Array(NX*NZ);
   for(let n=0;n<out.length;n++){ const wd=W[n];
    out[n] = wd<0 ? 3 : mown[n] ? 0 : (d[n]<=reach || wd<LIP) ? 1 : 2; }
   return out;
 }]
];

const row = document.getElementById('row');
const views = PANELS.map(p => {
 const fig = document.createElement('figure');
 const cv = document.createElement('canvas');
 cv.width = NX; cv.height = NZ;
 cv.style.width = '250px'; cv.style.height = Math.round(250 * NZ / NX) + 'px';
 const cap = document.createElement('figcaption');
 cap.innerHTML = '<b>' + p[0] + '</b>' + p[1] + '<em></em>';
 fig.appendChild(cv); fig.appendChild(cap); row.appendChild(fig);
 return {cv, cap};
});

function draw(semi, k, showSlice) {
 const NAMES=[COL.fair,COL.semi,COL.rough,COL.water];
 PANELS.forEach((p, n) => {
  const grid = p[2](semi, k);
  const ctx = views[n].cv.getContext('2d');
  const img = ctx.createImageData(NX, NZ);
  let widest = 0, widestRow = -1;
  for (let j = 0; j < NZ; j++) {
   let run = 0;
   for (let i = 0; i < NX; i++) {
    const idx = j * NX + i, kind = grid[idx], wd = W[idx];
    // The cut bank is painted soil over whatever the classification is, exactly
    // as the ground shader does; it does not change the lie underneath.
    let c = (kind !== 3 && wd >= 0 && wd < LIP) ? COL.soil : NAMES[kind];
    if (kind === 1) { run++; if (run > widest) { widest = run; widestRow = j; } } else run = 0;
    const q = idx * 4;
    img.data[q] = c[0]; img.data[q+1] = c[1]; img.data[q+2] = c[2]; img.data[q+3] = 255;
   }
  }
  if (showSlice && widestRow >= 0) {
   for (let i = 0; i < NX; i++) { const q = (widestRow * NX + i) * 4; img.data[q] = 220; img.data[q+1] = 40; img.data[q+2] = 40; }
  }
  ctx.putImageData(img, 0, 0);
  views[n].cap.querySelector('em').textContent = 'widest semi swath: ' + (widest * STEP).toFixed(1) + ' m';
 });
}

const semi = document.getElementById('semi'), round = document.getElementById('round'), slice = document.getElementById('slice');
function sync() {
 document.getElementById('semiV').textContent = (+semi.value).toFixed(1) + ' m';
 document.getElementById('roundV').textContent = (+round.value).toFixed(1) + ' m';
 draw(+semi.value, +round.value, slice.checked);
}
semi.oninput = round.oninput = slice.onchange = sync;
sync();
</script>`;

fs.writeFileSync('scratchpad/band-options.html', page);
console.log('written scratchpad/band-options.html');
