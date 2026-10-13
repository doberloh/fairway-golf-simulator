// FAIRWAY SOUND LAB: every sound is synthesised live with the Web Audio API.
//
// No recordings ship, so there is nothing to license or attribute, nothing
// adds to the single-file build, and no two plays are the same sample: every
// strike re-rolls its modes a little, and the ambience is a set of random
// processes (gusts, birds, bubbles, planes) rather than a file on repeat.
//
// This module is written to move into src/ unchanged once the owner approves
// the sounds: it touches no DOM, takes an AudioContext (live or offline) and
// returns plain functions. tools/sound-lab/build.mjs inlines it into the
// listening report, docs/reports/sounds/index.html (local, never committed).
//
// Numbers with a published source are noted in RESEARCH.md, "Sound: the
// synthesised soundscape"; everything else here is PLACED by ear and says so.

const R=(a,b)=>a+Math.random()*(b-a);
const J=(v,f)=>v*(1+R(-f,f));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[Math.random()*a.length|0];
// Waiting time to the next event of a Poisson process with `rate` per second.
const wait=rate=>-Math.log(1-Math.random())/rate;
const gauss=()=>{let u=-6;for(let i=0;i<12;i++)u+=Math.random();return u;};
const pickWeighted=w=>{const e=Object.entries(w).filter(([,v])=>v>0),s=e.reduce((a,[,v])=>a+v,0);let r=Math.random()*s;for(const [k,v]of e)if((r-=v)<=0)return k;return e.length?e[e.length-1][0]:null;};
const MPH=.44704,SOUND=343;

// Air absorbs treble with distance. PLACED: a one-pole-ish cutoff that falls
// to about 8 kHz at 100 m, 2 kHz at 1 km and 850 Hz at 3 km -- the shape of
// ISO 9613-1 at 20 C and 70% humidity, not its exact figures.
export const airCutoff=d=>clamp(20000/(1+Math.pow(Math.max(d,1)/60,.8)),300,20000);

function whiteNoise(ctx,seconds){
 const b=ctx.createBuffer(1,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate),d=b.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 return b;
}
// A dark, diffuse outdoor tail: trees and ground scatter a little sound back.
// Stereo noise under an exponential decay, darkened by a one-pole low-pass
// whose cutoff falls along the tail (high frequencies die first outdoors).
function outdoorTail(ctx,seconds){
 const n=Math.floor(ctx.sampleRate*seconds),b=ctx.createBuffer(2,n,ctx.sampleRate);
 for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;
  for(let i=0;i<n;i++){const u=i/n,k=.5-.45*u;lp+=k*((Math.random()*2-1)-lp);d[i]=lp*Math.exp(-5.5*u)*(i<ctx.sampleRate*.012?i/(ctx.sampleRate*.012):1);}}
 return b;
}

export function createSoundLab(ctx,out=ctx.destination){
 const master=ctx.createGain();master.gain.value=.9;
 const lim=ctx.createDynamicsCompressor();
 lim.threshold.value=-6;lim.knee.value=4;lim.ratio.value=16;lim.attack.value=.001;lim.release.value=.15;
 master.connect(lim);lim.connect(out);
 const verb=ctx.createConvolver();verb.buffer=outdoorTail(ctx,1.6);
 const verbIn=ctx.createGain();verbIn.gain.value=.5;verbIn.connect(verb);verb.connect(master);
 const lab={ctx,master,out:lim,verbIn,NOISE:whiteNoise(ctx,12),trash:[],
  // Nodes are disconnected once their sound is over, so an hour of ambience
  // does not leave thousands of finished nodes hanging off the graph.
  track(nodes,until){this.trash.push([nodes,until]);},
  sweep(){const now=ctx.currentTime-.25;if(this.trash.length<64)return;
   this.trash=this.trash.filter(([n,u])=>{if(u>now)return true;for(const x of n)try{x.disconnect();}catch{}return false;});},
 };
 return lab;
}

// Where a sound is. pan -1 (left) .. 1 (right); distance in metres; level is
// 1 at 10 m and falls as 1/distance; air takes the treble; a little of it goes
// to the outdoor tail, more the further away it is. Returns the node to feed.
export function place(lab,{pan=0,dist=10,wet=.12,to=lab.master,until}={}){
 const {ctx}=lab,g=ctx.createGain(),air=ctx.createBiquadFilter(),p=ctx.createStereoPanner();
 g.gain.value=clamp(10/Math.max(dist,1),0,2);
 air.type='lowpass';air.frequency.value=airCutoff(dist);air.Q.value=.5;
 p.pan.value=clamp(pan,-1,1);
 g.connect(air);air.connect(p);p.connect(to);
 const nodes=[g,air,p];
 if(wet>0){const s=ctx.createGain();s.gain.value=wet*clamp(dist/30,.4,2);p.connect(s);s.connect(lab.verbIn);nodes.push(s);}
 if(until)lab.track(nodes,until);
 return g;
}

// ---------------------------------------------------------------- primitives

// Damped sinusoids: the ringing of a struck solid. Each mode is
// [Hz, decay time-constant s, level, end-pitch ratio]. `bright` tilts the
// modes per octave above 1.5 kHz; `spread` detunes every mode a little per hit
// so no two strikes are identical.
function ring(lab,dest,t,list,{amp=1,pitch=1,decay=1,bright=1,spread=.015}={}){
 const {ctx}=lab;let end=t;
 for(const [hz,tau,lvl,glide=1] of list){
  const f=hz*pitch*J(1,spread);if(f>ctx.sampleRate*.45)continue;
  const a=amp*lvl*Math.pow(bright,Math.log2(f/1500));if(a<1e-4)continue;
  const o=ctx.createOscillator(),g=ctx.createGain(),d=tau*decay,stop=t+d*9+.01;
  o.frequency.setValueAtTime(f,t);if(glide!==1)o.frequency.exponentialRampToValueAtTime(f*glide,t+d*4);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.0005);g.gain.setTargetAtTime(0,t+.0005,d);
  o.connect(g);g.connect(dest);o.start(t);o.stop(stop);lab.track([o,g],stop+.05);end=Math.max(end,stop);
 }
 return end;
}
// Filtered noise with an attack and an exponential tail: puffs, slaps, swishes.
// `dur` is the time to about -35 dB.
function hiss(lab,dest,t,{dur=.05,attack=.001,hold=0,type='bandpass',f=1000,f2=0,q=.7,amp=1}){
 const {ctx}=lab,s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();
 const end=t+attack+hold+dur*1.6;
 s.buffer=lab.NOISE;fl.type=type;fl.Q.value=q;
 fl.frequency.setValueAtTime(clamp(f,20,ctx.sampleRate*.45),t);if(f2)fl.frequency.exponentialRampToValueAtTime(clamp(f2,20,ctx.sampleRate*.45),t+attack+hold+dur);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+attack);if(hold)g.gain.setValueAtTime(amp,t+attack+hold);g.gain.setTargetAtTime(0,t+attack+hold,dur/4);
 s.connect(fl);fl.connect(g);g.connect(dest);
 s.start(t,R(0,Math.max(0,lab.NOISE.duration-(end-t)-.1)));s.stop(end);lab.track([s,fl,g],end+.05);
 return end;
}
// Many tiny ticks through one noise source: grit, grass blades, leaves,
// droplets. `rate` ticks per second, each `tick` seconds long, fading over
// `dur` when `fade` is set.
function crackle(lab,dest,t,{dur=.2,rate=300,f=4000,q=.8,type='bandpass',amp=.5,tick=.002,fade=true}){
 const {ctx}=lab,s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();
 s.buffer=lab.NOISE;fl.type=type;fl.frequency.value=clamp(f,20,ctx.sampleRate*.45);fl.Q.value=q;
 g.gain.setValueAtTime(0,t);
 let x=t+wait(rate)*.3;
 while(x<t+dur){const k=fade?Math.exp(-3*(x-t)/dur):1;g.gain.setValueAtTime(amp*k*R(.15,1),x);g.gain.setTargetAtTime(0,x,tick*R(.5,1.5));x+=wait(rate);}
 const end=t+dur+tick*8;
 s.connect(fl);fl.connect(g);g.connect(dest);
 s.start(t,R(0,Math.max(0,lab.NOISE.duration-(end-t)-.1)));s.stop(end);lab.track([s,fl,g],end+.05);
 return end;
}
// A sung or whistled note: a sine (or other wave) following a pitch contour
// spread evenly over its duration; `harm` adds the octave above.
function note(lab,dest,t,{dur,contour,amp=.3,attack=.008,release=.02,harm=0,wave='sine',vib=0,vibHz=0}){
 const {ctx}=lab,c=Float32Array.from(contour.length>1?contour:[contour[0],contour[0]]);
 const g=ctx.createGain(),nodes=[g],end=t+dur;
 attack=Math.min(attack,dur*.4);release=Math.min(release,dur*.5);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+attack);g.gain.setValueAtTime(amp,end-release);g.gain.linearRampToValueAtTime(0,end);
 const voice=(mult,lvl)=>{const o=ctx.createOscillator();o.type=wave;o.frequency.setValueCurveAtTime(c.map(v=>v*mult),t,dur);
  let n=o;if(lvl!==1){const h=ctx.createGain();h.gain.value=lvl;o.connect(h);n=h;nodes.push(h);}
  if(vib){const l=ctx.createOscillator(),d=ctx.createGain();l.frequency.value=vibHz;d.gain.value=c[0]*mult*vib;l.connect(d);d.connect(o.frequency);l.start(t);l.stop(end+.01);nodes.push(l,d);}
  n.connect(g);o.start(t);o.stop(end+.01);nodes.push(o);};
 voice(1,1);if(harm)voice(2,harm);
 g.connect(dest);lab.track(nodes,end+.1);
 return end;
}
// A harsh voice -- crow, raven, gull, goose: a sawtooth through formant
// band-passes, roughened by amplitude modulation, with breath noise.
function rasp(lab,dest,t,{dur,contour,amp=.3,formants=[[1400,3,1]],rough=60,depth=.6,breath=.15,attack=.015,release=.05}){
 const {ctx}=lab,o=ctx.createOscillator(),env=ctx.createGain(),am=ctx.createGain(),lfo=ctx.createOscillator(),ld=ctx.createGain(),end=t+dur;
 const nodes=[o,env,am,lfo,ld];
 o.type='sawtooth';o.frequency.setValueCurveAtTime(Float32Array.from(contour),t,dur);
 am.gain.value=1-depth/2;lfo.frequency.value=rough;ld.gain.value=depth/2;lfo.connect(ld);ld.connect(am.gain);
 env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(amp,t+attack);env.gain.setValueAtTime(amp,end-release);env.gain.linearRampToValueAtTime(0,end);
 o.connect(am);
 for(const [f,q,lvl]of formants){const b=ctx.createBiquadFilter(),g=ctx.createGain();b.type='bandpass';b.frequency.value=f;b.Q.value=q;g.gain.value=lvl;am.connect(b);b.connect(g);g.connect(env);nodes.push(b,g);}
 env.connect(dest);o.start(t);o.stop(end+.01);lfo.start(t);lfo.stop(end+.01);
 if(breath)hiss(lab,dest,t,{type:'bandpass',f:formants[0][0],q:1.5,attack,hold:Math.max(0,dur-attack-release),dur:release*2,amp:amp*breath});
 lab.track(nodes,end+.1);
 return end;
}
// One air bubble: a decaying sine whose pitch rises as it nears the surface.
// Minnaert: f = 3.26 / radius (radius in metres, f in Hz) for air in water
// near the surface. The rise is van den Doel's (2005) principle; how much it
// rises (up to 1.6x here) is PLACED.
function bubble(lab,dest,t,radius,amp,rise=R(1.05,1.6)){
 const f=clamp(3.26/radius,150,lab.ctx.sampleRate*.4),tau=.006*Math.sqrt(1000/f);
 return ring(lab,dest,t,[[f,tau,1,rise]],{amp,spread:0});
}
// Swing noise: band-passed air rising to the strike and falling through the
// follow-through. Centre frequency and level climb with head speed (PLACED:
// 250 Hz + 22 Hz per m/s; level as speed^2.5).
function whoosh(lab,dest,t,v,amp){
 const {ctx}=lab,pre=.34,post=.32,start=t-pre,fc=250+22*v,s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),g=ctx.createGain();
 s.buffer=lab.NOISE;bp.type='bandpass';bp.Q.value=1.6;
 bp.frequency.setValueAtTime(fc*.4,start);bp.frequency.exponentialRampToValueAtTime(fc,t);bp.frequency.exponentialRampToValueAtTime(fc*.45,t+post);
 const n=96,curve=new Float32Array(n),a=amp*Math.pow(v/45,2.5);
 for(let i=0;i<n;i++){const x=start+(pre+post)*i/(n-1)-t;curve[i]=a*(x<0?Math.pow(1+x/pre,3):Math.exp(-x/.075)*(1-x/post));}
 curve[n-1]=0;
 g.gain.setValueCurveAtTime(curve,start,pre+post);
 s.connect(bp);bp.connect(g);g.connect(dest);s.start(start,R(0,8));s.stop(t+post+.02);lab.track([s,bp,g],t+post+.1);
}

// The knobs every sound offers in the report. Each recipe uses some of them;
// the report shows only those a sound lists.
export const KNOBS={
 level:{label:'Loudness',min:0,max:2,step:.05,def:1},
 pitch:{label:'Pitch',min:.6,max:1.6,step:.01,def:1},
 length:{label:'Ring / length',min:.4,max:2.5,step:.05,def:1},
 bright:{label:'Brightness',min:.4,max:2,step:.05,def:1},
 click:{label:'Crack (contact)',min:0,max:2.5,step:.05,def:1},
 body:{label:'Thump (body)',min:0,max:2.5,step:.05,def:1},
 texture:{label:'Texture (grass, sand, water, leaves)',min:0,max:2.5,step:.05,def:1},
 whoosh:{label:'Swing whoosh',min:0,max:2.5,step:.05,def:1},
};
// A recipe gets these helpers, with its knobs already applied.
function kit(lab,dest,t0,a,k){
 const K={...Object.fromEntries(Object.entries(KNOBS).map(([n,d])=>[n,d.def])),...k};
 const role=r=>r?K[r]:1,shift=f=>f*Math.sqrt(K.bright);
 return {K,a,t0,
  ring:(dt,list,o={})=>ring(lab,dest,t0+dt,list,{amp:a*K.level*role(o.role)*(o.amp??1),pitch:K.pitch*(o.pitch??1),decay:K.length*(o.decay??1),bright:K.bright,spread:o.spread}),
  hiss:(dt,o)=>hiss(lab,dest,t0+dt,{...o,f:shift(o.f),f2:o.f2&&shift(o.f2),dur:o.dur*(o.fixed?1:K.length),amp:a*K.level*role(o.role)*(o.amp??1)}),
  crackle:(dt,o)=>crackle(lab,dest,t0+dt,{...o,f:shift(o.f),dur:o.dur*(o.fixed?1:K.length),amp:a*K.level*role(o.role)*(o.amp??1)}),
  thump:(dt,hz,tau,lvl,glide=.65)=>ring(lab,dest,t0+dt,[[hz,tau,lvl,glide]],{amp:a*K.level*K.body,pitch:Math.sqrt(K.pitch),decay:K.length,spread:.06}),
  bubble:(dt,r,lvl,rise)=>bubble(lab,dest,t0+dt,r/K.pitch,a*K.level*K.texture*lvl,rise),
  whoosh:(dt,v,lvl)=>K.whoosh>0&&whoosh(lab,dest,t0+dt,v,lvl*K.level*K.whoosh),
 };
}
// The ball's own ring under a hard strike sits near 1.5 kHz (patent survey in
// RESEARCH.md); a short tick of it rides on every hard contact.
const BALL=1500;

// ---------------------------------------------------------------- the swing
// Each club: head speed range in mph [min, max, default], a loudness at its
// own reference, and takes A/B/C -- alternatives to choose between.
const divot=(x,size=1)=>{
 x.thump(.006,95,.03,.55*size,.6);
 x.hiss(.005,{type:'bandpass',f:1800,f2:900,q:.7,dur:.11,attack:.006,amp:.42*size,role:'texture'});
 x.crackle(.012,{dur:.12,rate:450,f:3200,q:.6,amp:.16*size,role:'texture'});
 x.crackle(.22,{dur:.4,rate:22,f:900,q:.7,amp:.12*size,tick:.007,fade:false,role:'texture'});
};
export const STRIKES={
 driver:{label:'Driver',speed:[60,125,100],gain:.42,whoosh:.5,knobs:['level','pitch','length','bright','click','body','whoosh'],
  note:'Titanium head off a tee. Published: a titanium driver strike centres near 4-4.5 kHz and lasts under 0.2 s.',
  takes:{
   A:{name:'Modern titanium: a bright "ting"',play:x=>{
    x.hiss(0,{type:'highpass',f:2500,dur:.004,attack:.0003,amp:.7,role:'click',fixed:true});
    x.ring(0,[[BALL,.004,.45]]);
    x.ring(0,[[3350,.035,.45],[4150,.05,1],[4480,.045,.75],[5600,.03,.45],[6900,.02,.3],[8300,.012,.18]],{amp:.5});
    x.thump(0,220,.012,.35);}},
   B:{name:'Deeper "crack"',play:x=>{
    x.hiss(0,{type:'highpass',f:1800,dur:.005,attack:.0003,amp:.9,role:'click',fixed:true});
    x.hiss(0,{type:'bandpass',f:1300,q:.8,dur:.012,attack:.0005,amp:.45,role:'click'});
    x.ring(0,[[BALL,.004,.55]]);
    x.ring(0,[[2450,.02,.7],[3100,.03,1],[3750,.025,.7],[5200,.015,.35],[6600,.008,.2]],{amp:.5});
    x.thump(0,170,.014,.5);}},
   C:{name:'Old persimmon wood: a "thock"',play:x=>{
    x.hiss(0,{type:'bandpass',f:2200,q:.6,dur:.006,attack:.0004,amp:.6,role:'click',fixed:true});
    x.ring(0,[[BALL,.003,.4]]);
    x.ring(0,[[880,.012,.75],[1520,.015,1],[2300,.01,.6],[3400,.006,.3]],{amp:.55});
    x.thump(0,140,.016,.55);}},
  }},
 wood:{label:'Fairway wood',speed:[55,115,90],gain:.4,whoosh:.45,knobs:['level','pitch','length','bright','click','body','texture','whoosh'],
  note:'Smaller steel or titanium head, swept off the turf: higher and shorter than the driver, with the brush of the sole.',
  takes:{
   A:{name:'Steel fairway wood off the deck',play:x=>{
    x.hiss(0,{type:'highpass',f:2800,dur:.004,attack:.0003,amp:.75,role:'click',fixed:true});
    x.ring(0,[[BALL,.004,.5]]);
    x.ring(0,[[3900,.02,.7],[4700,.03,1],[5900,.02,.6],[7400,.012,.3]],{amp:.45});
    x.thump(0,190,.012,.35);
    x.thump(.004,110,.02,.25);
    x.hiss(.006,{type:'bandpass',f:2200,q:.6,dur:.09,attack:.004,amp:.3,role:'texture'});}},
   B:{name:'Hybrid: muted, a shorter "click"',play:x=>{
    x.hiss(0,{type:'highpass',f:2500,dur:.004,attack:.0003,amp:.85,role:'click',fixed:true});
    x.ring(0,[[BALL,.004,.55]]);
    x.ring(0,[[3200,.012,.8],[4100,.016,1],[5300,.01,.5]],{amp:.45});
    x.thump(0,170,.012,.4);
    x.hiss(.006,{type:'bandpass',f:2000,q:.6,dur:.08,attack:.004,amp:.32,role:'texture'});}},
   C:{name:'Off a tee (no turf)',play:x=>{
    x.hiss(0,{type:'highpass',f:2800,dur:.004,attack:.0003,amp:.75,role:'click',fixed:true});
    x.ring(0,[[BALL,.004,.5]]);
    x.ring(0,[[3900,.022,.7],[4700,.034,1],[5900,.022,.6],[7400,.014,.3]],{amp:.45});
    x.thump(0,190,.012,.35);}},
  }},
 iron:{label:'Iron',speed:[50,105,80],gain:.45,whoosh:.4,knobs:['level','pitch','length','bright','click','body','texture','whoosh'],
  note:'A solid steel head: a crisp "click" that dies fast, then the divot -- a thump, the tear of grass and clods landing.',
  takes:{
   A:{name:'Forged blade, ball then turf',play:x=>{
    x.hiss(0,{type:'bandpass',f:4200,q:.5,dur:.003,attack:.0002,amp:1.1,role:'click',fixed:true});
    x.ring(0,[[BALL,.005,.6]]);
    x.ring(0,[[2600,.008,.6],[3500,.007,1],[4800,.005,.7],[6800,.003,.4]],{amp:.5});
    divot(x,1);}},
   B:{name:'Cavity back: a touch more ring',play:x=>{
    x.hiss(0,{type:'bandpass',f:4500,q:.5,dur:.003,attack:.0002,amp:.9,role:'click',fixed:true});
    x.ring(0,[[BALL,.005,.55]]);
    x.ring(0,[[3100,.012,.7],[4300,.016,1],[5600,.01,.6],[7200,.006,.3]],{amp:.45});
    divot(x,1);}},
   C:{name:'Picked clean, hardly a divot',play:x=>{
    x.hiss(0,{type:'bandpass',f:4200,q:.5,dur:.003,attack:.0002,amp:1.1,role:'click',fixed:true});
    x.ring(0,[[BALL,.005,.6]]);
    x.ring(0,[[2600,.008,.6],[3500,.007,1],[4800,.005,.7],[6800,.003,.4]],{amp:.5});
    divot(x,.3);}},
  }},
 chip:{label:'Chip (wedge)',speed:[12,45,28],gain:.55,whoosh:.25,knobs:['level','pitch','length','bright','click','texture','whoosh'],
  note:'A short swing: the leading edge brushes the grass just before the ball, a soft click, then a little brush after.',
  takes:{
   A:{name:'Clean chip off the fairway',play:x=>{
    x.hiss(-.03,{type:'bandpass',f:3200,q:.8,dur:.05,attack:.015,amp:.14,role:'texture'});
    x.hiss(0,{type:'bandpass',f:4800,q:.6,dur:.0025,attack:.0002,amp:.75,role:'click',fixed:true});
    x.ring(0,[[1800,.004,.6],[3300,.005,1],[5000,.003,.5]],{amp:.45});
    x.hiss(.004,{type:'bandpass',f:2400,q:.7,dur:.06,attack:.004,amp:.12,role:'texture'});}},
   B:{name:'Out of the rough: grassy, muffled',play:x=>{
    x.hiss(-.09,{type:'bandpass',f:2600,q:.6,dur:.14,attack:.05,amp:.3,role:'texture'});
    x.crackle(-.07,{dur:.2,rate:700,f:4200,q:.6,amp:.16,role:'texture'});
    x.hiss(0,{type:'bandpass',f:3200,q:.6,dur:.003,attack:.0003,amp:.45,role:'click',fixed:true});
    x.ring(0,[[1700,.003,.6],[3100,.004,1]],{amp:.3});
    x.hiss(.004,{type:'bandpass',f:2000,q:.6,dur:.14,attack:.01,amp:.25,role:'texture'});}},
   C:{name:'Bump-and-run with a mid iron',play:x=>{
    x.hiss(0,{type:'bandpass',f:4200,q:.5,dur:.003,attack:.0002,amp:.95,role:'click',fixed:true});
    x.ring(0,[[BALL,.004,.5]]);
    x.ring(0,[[2600,.007,.6],[3500,.006,1],[4800,.004,.6]],{amp:.45});
    x.hiss(.004,{type:'bandpass',f:2600,q:.7,dur:.05,attack:.004,amp:.1,role:'texture'});}},
  }},
 putter:{label:'Putter',speed:[1,10,4],gain:1.1,whoosh:0,knobs:['level','pitch','length','bright','click'],
  note:'Published: in a putt the 2-4 kHz band follows the ball and below 2 kHz follows the putter and where it was struck.',
  takes:{
   A:{name:'Milled steel blade: a clean "tock" with a hint of ring',play:x=>{
    x.hiss(0,{type:'bandpass',f:5000,q:.5,dur:.002,attack:.0002,amp:.3,role:'click',fixed:true});
    x.ring(0,[[1350,.006,.8],[2900,.006,1],[3700,.004,.6],[6100,.012,.12]],{amp:.5});}},
   B:{name:'Soft face insert: duller',play:x=>{
    x.hiss(0,{type:'bandpass',f:3000,q:.5,dur:.002,attack:.0003,amp:.15,role:'click',fixed:true});
    x.ring(0,[[1150,.004,1],[2500,.003,.5],[3400,.002,.2]],{amp:.5});}},
   C:{name:'Heavy mallet: lower "tock"',play:x=>{
    x.hiss(0,{type:'bandpass',f:4000,q:.5,dur:.002,attack:.0002,amp:.2,role:'click',fixed:true});
    x.ring(0,[[900,.006,.9],[2100,.005,.7],[3300,.003,.4]],{amp:.55});}},
  }},
};
// Play one strike. `speed` is head speed in mph; the impact lands `lead`
// seconds after the call so the whoosh can rise to it.
export function strike(lab,club,{take='A',speed,knobs={},pan=0,dist=10,at}={}){
 const C=STRIKES[club],T=C.takes[take]||C.takes.A,mph=speed??C.speed[2];
 const t=(at??lab.ctx.currentTime)+.45;
 // Louder and brighter the harder it is hit. PLACED: level as speed^0.8, so a
 // putt is quiet but still audible; brightness as speed^0.35 at the club's own
 // default speed.
 const a=C.gain*Math.pow(mph/100,.8),k={...knobs,bright:(knobs.bright??1)*Math.pow(mph/C.speed[2],.35)};
 const dest=place(lab,{pan,dist,wet:.08,until:t+3});
 const x=kit(lab,dest,t,a,k);
 if(C.whoosh)x.whoosh(0,mph*MPH,C.whoosh);
 T.play(x);
 lab.sweep();
 return t;
}

// ---------------------------------------------------------------- landings
// What the ball meets. Each surface: takes, its knobs, and for turf the
// bounce it makes (restitution of the vertical speed, PLACED by ear for the
// sequence demo only -- the physics has its own, in contact.js).
const ballTick=(x,l=.25)=>x.ring(0,[[BALL,.0025,l]],{role:'click'});
const grass=(x,dt,dur,amp,f=3000)=>{x.hiss(dt,{type:'bandpass',f,q:.7,dur,attack:.004,amp,role:'texture'});x.crackle(dt,{dur:dur*.9,rate:500,f:f*1.5,q:.6,amp:amp*.4,role:'texture'});};
const twig=(x,dt,amp)=>x.ring(dt,[[R(2200,3600),.003,1],[R(4200,6200),.002,.5]],{amp,role:'click'});
const T_KNOBS=['level','pitch','length','bright','click','body','texture'];
export const IMPACTS={
 green:{label:'Green',group:'turf',bounce:.35,knobs:T_KNOBS,note:'Short, tight turf on firm ground: a soft "thup".',takes:{
  A:{name:'Receptive green',play:x=>{x.thump(0,150,.018,.9,.62);ballTick(x);x.hiss(0,{type:'lowpass',f:1800,q:.5,dur:.03,attack:.0015,amp:.35,role:'texture'});}},
  B:{name:'Firm, baked green',play:x=>{x.thump(0,210,.012,.8,.7);ballTick(x,.45);x.hiss(0,{type:'lowpass',f:2600,q:.5,dur:.025,attack:.001,amp:.3,role:'texture'});}},
  C:{name:'Soft, wet green',play:x=>{x.thump(0,115,.022,.9,.55);ballTick(x,.12);x.hiss(.002,{type:'bandpass',f:650,q:1.2,dur:.07,attack:.006,amp:.32,role:'texture'});x.crackle(.004,{dur:.08,rate:300,f:2500,amp:.08,role:'texture'});}},
 }},
 fringe:{label:'Fringe',group:'turf',bounce:.35,knobs:T_KNOBS,note:'Green-firm ground, a little more grass.',takes:{
  A:{name:'Fringe',play:x=>{x.thump(0,145,.019,.85,.62);ballTick(x,.2);grass(x,0,.05,.25,3500);}},
  B:{name:'Firm fringe',play:x=>{x.thump(0,200,.013,.8,.7);ballTick(x,.35);grass(x,0,.04,.2,3800);}},
  C:{name:'Soft fringe',play:x=>{x.thump(0,120,.022,.85,.55);ballTick(x,.12);grass(x,0,.06,.28,3000);}},
 }},
 fairway:{label:'Fairway',group:'turf',bounce:.4,knobs:T_KNOBS,note:'A thud and a quick brush of mown grass.',takes:{
  A:{name:'Fairway',play:x=>{x.thump(0,130,.022,.9,.6);ballTick(x,.2);grass(x,0,.06,.3);}},
  B:{name:'Firm summer fairway',play:x=>{x.thump(0,185,.015,.85,.68);ballTick(x,.38);grass(x,0,.05,.25,3400);}},
  C:{name:'Soft, dewy fairway',play:x=>{x.thump(0,105,.026,.9,.55);ballTick(x,.1);grass(x,0,.07,.3,2600);x.hiss(.003,{type:'bandpass',f:700,q:1.1,dur:.06,attack:.006,amp:.22,role:'texture'});}},
 }},
 tee:{label:'Tee box',group:'turf',bounce:.42,knobs:T_KNOBS,note:'Fairway grass on a firmer, levelled pad.',takes:{
  A:{name:'Tee box',play:x=>{x.thump(0,165,.017,.85,.65);ballTick(x,.32);grass(x,0,.05,.26,3300);}},
  B:{name:'Worn, hard tee',play:x=>{x.thump(0,220,.011,.8,.72);ballTick(x,.5);grass(x,0,.035,.18,3600);x.crackle(.002,{dur:.05,rate:200,f:2500,amp:.12,role:'texture'});}},
  C:{name:'Lush tee',play:x=>{x.thump(0,135,.02,.85,.6);ballTick(x,.18);grass(x,0,.07,.32,2900);}},
 }},
 semi:{label:'Semi-rough',group:'turf',bounce:.28,knobs:T_KNOBS,note:'Longer grass takes the edge off the thud.',takes:{
  A:{name:'Semi-rough',play:x=>{x.thump(0,120,.02,.6,.6);grass(x,0,.1,.32,2600);x.crackle(0,{dur:.12,rate:600,f:4200,q:.6,amp:.2,role:'texture'});}},
  B:{name:'Dry semi',play:x=>{x.thump(0,135,.017,.6,.62);grass(x,0,.09,.28,3400);x.crackle(0,{dur:.13,rate:700,f:5000,q:.7,amp:.26,role:'texture'});}},
  C:{name:'Lush semi',play:x=>{x.thump(0,110,.022,.55,.58);grass(x,0,.12,.36,2300);}},
 }},
 rough:{label:'Rough',group:'turf',bounce:.18,knobs:T_KNOBS,note:'Mostly grass: a muffled landing in a rustle.',takes:{
  A:{name:'Parkland rough',play:x=>{x.thump(0,105,.02,.35,.6);x.hiss(0,{type:'bandpass',f:2200,q:.5,dur:.2,attack:.01,amp:.35,role:'texture'});x.crackle(0,{dur:.22,rate:900,f:3800,q:.6,amp:.25,role:'texture'});}},
  B:{name:'Deep links fescue: dry and wiry',play:x=>{x.thump(0,110,.018,.22,.6);x.hiss(0,{type:'bandpass',f:3400,q:.6,dur:.26,attack:.015,amp:.3,role:'texture'});x.crackle(0,{dur:.35,rate:700,f:5000,q:.7,amp:.36,tick:.0015,role:'texture'});}},
  C:{name:'Wet rough',play:x=>{x.thump(0,95,.022,.35,.55);x.hiss(0,{type:'lowpass',f:1500,q:.5,dur:.16,attack:.01,amp:.38,role:'texture'});x.crackle(.004,{dur:.15,rate:350,f:2400,amp:.14,role:'texture'});}},
 }},
 sand:{label:'Bunker',group:'turf',bounce:.05,knobs:T_KNOBS,note:'A "pfff" into sand with a crunch of grit and a little spray falling back.',takes:{
  A:{name:'Soft bunker sand',play:x=>{x.thump(0,80,.025,.45,.6);x.hiss(0,{type:'lowpass',f:1300,q:.4,dur:.09,attack:.003,amp:.7,role:'texture'});x.crackle(0,{dur:.12,rate:700,f:5000,q:.7,amp:.35,role:'texture'});x.crackle(.12,{dur:.35,rate:120,f:3500,amp:.08,tick:.003,role:'texture'});}},
  B:{name:'Firm, wet sand',play:x=>{x.thump(0,95,.02,.7,.62);x.hiss(0,{type:'lowpass',f:900,q:.4,dur:.06,attack:.002,amp:.5,role:'texture'});x.crackle(0,{dur:.08,rate:400,f:4200,amp:.2,role:'texture'});}},
  C:{name:'Desert waste area: coarse grit',play:x=>{x.thump(0,100,.015,.5,.62);x.hiss(0,{type:'lowpass',f:1800,q:.4,dur:.06,attack:.002,amp:.4,role:'texture'});x.crackle(0,{dur:.15,rate:300,f:2500,q:1,amp:.45,tick:.003,role:'texture'});for(let i=0;i<3;i++)x.ring(R(0,.06),[[R(2800,4200),.003,.3]],{role:'click'});}},
 }},
 water:{label:'Water',group:'water',bounce:0,knobs:['level','pitch','length','bright','texture','body'],note:'A slap, a sheet of spray, the "plunk" of the cavity closing, and the bubbles that follow.',takes:{
  A:{name:'Pond, shallow entry',play:x=>water(x,1)}, B:{name:'Steep plunge: a deep "ploonk"',play:x=>water(x,2)}, C:{name:'Skips, then sinks',play:x=>water(x,3)},
 }},
 trunk:{label:'Tree trunk',group:'solid',knobs:['level','pitch','length','bright','click','texture'],note:'Hollow wooden "tok" of the trunk, the crack of bark.',takes:{
  A:{name:'Oak or broadleaf trunk',play:x=>{x.ring(0,[[BALL,.003,.5]]);x.hiss(0,{type:'bandpass',f:3000,q:.7,dur:.012,attack:.0003,amp:.35,role:'click'});x.ring(0,[[420,.03,1],[780,.022,.65],[1150,.016,.45],[1900,.009,.3],[2900,.005,.2]],{amp:.55});x.crackle(.05,{dur:.25,rate:120,f:3000,amp:.06,role:'texture'});}},
  B:{name:'Pine or spruce: higher, more resonant',play:x=>{x.ring(0,[[BALL,.003,.5]]);x.hiss(0,{type:'bandpass',f:3600,q:.7,dur:.01,attack:.0003,amp:.45,role:'click'});x.ring(0,[[560,.04,1],[1040,.03,.6],[1650,.02,.45],[2500,.012,.3]],{amp:.5});}},
  C:{name:'Palm: fibrous and dull',play:x=>{x.ring(0,[[BALL,.003,.35]]);x.ring(0,[[260,.014,1],[520,.012,.5],[900,.008,.3]],{amp:.6});x.crackle(0,{dur:.09,rate:500,f:2500,amp:.22,role:'texture'});x.crackle(.15,{dur:.5,rate:60,f:1800,q:.6,amp:.1,tick:.008,role:'texture'});}},
 }},
 canopy:{label:'Leaves and branches',group:'solid',knobs:['level','pitch','length','bright','click','texture'],note:'Through the canopy: leaf slaps, twigs, the branch swaying -- then the ball drops to the ground.',takes:{
  A:{name:'Broadleaf canopy',play:x=>canopy(x,{f:3200,rate:350,tick:.003,twigs:2,swish:1500})},
  B:{name:'Conifer needles: finer',play:x=>canopy(x,{f:5500,rate:700,tick:.0015,twigs:4,swish:2500,dur:.35})},
  C:{name:'Dry autumn leaves: crisp',play:x=>canopy(x,{f:4000,rate:500,tick:.0015,twigs:2,swish:1800,dur:.6,amp:.55,q:.9})},
 }},
 rock:{label:'Rock',group:'solid',knobs:['level','pitch','length','bright','click','texture'],note:'A sharp "clack": ball and stone are both hard.',takes:{
  A:{name:'Granite boulder',play:x=>{x.hiss(0,{type:'highpass',f:3000,dur:.002,attack:.0002,amp:1,role:'click',fixed:true});x.ring(0,[[BALL,.004,.7]]);x.ring(0,[[2100,.006,.6],[3400,.008,1],[5200,.005,.55],[7600,.003,.35]],{amp:.45});}},
  B:{name:'Sandstone: duller, gritty',play:x=>{x.hiss(0,{type:'highpass',f:2200,dur:.003,attack:.0003,amp:.8,role:'click',fixed:true});x.ring(0,[[BALL,.003,.6]]);x.ring(0,[[1300,.004,.7],[2300,.005,1],[3600,.003,.5]],{amp:.45});x.crackle(.002,{dur:.05,rate:400,f:4000,amp:.2,role:'texture'});}},
  C:{name:'Glancing ricochet',play:x=>{x.hiss(0,{type:'highpass',f:3000,dur:.002,attack:.0002,amp:.8,role:'click',fixed:true});x.ring(0,[[BALL,.004,.6],[3400,.006,.6]],{amp:.6});x.crackle(.004,{dur:.12,rate:160,f:3000,amp:.25,role:'texture'});x.ring(.09,[[BALL,.003,.4],[3600,.005,.5]],{amp:.3});}},
 }},
 cup:{label:'Into the cup (extra)',group:'extra',knobs:['level','pitch','length','bright','click'],note:'Not asked for -- the ball dropping into a plastic cup. Say if it is wanted.',takes:{
  A:{name:'Drops in',play:x=>{const c=[[640,.03,1],[1350,.02,.45],[2250,.012,.35],[BALL,.003,.3]];x.ring(0,c,{amp:.55});for(const [dt,a]of [[.07,.4],[.12,.2],[.155,.1]])x.ring(dt,c,{amp:.55*a});}},
  B:{name:'Off the flagstick, then in',play:x=>{x.hiss(0,{type:'highpass',f:3000,dur:.002,attack:.0002,amp:.6,role:'click',fixed:true});x.ring(0,[[1180,.22,.6],[3100,.12,.4],[5400,.06,.25],[8100,.03,.15]],{amp:.4});const c=[[640,.03,1],[1350,.02,.45],[2250,.012,.35]];x.ring(.14,c,{amp:.5});x.ring(.21,c,{amp:.2});}},
 }},
};
function water(x,kind){
 const deep=kind===2;
 const slaps=kind===3?[[0,.55],[.3,.35],[.52,.22]]:[[0,1]];
 for(const [dt,s]of slaps){
  x.hiss(dt,{type:'highpass',f:1500,dur:.012,attack:.0005,amp:.6*s,role:'texture'});
  x.hiss(dt+.004,{type:'bandpass',f:2600,f2:1400,q:.6,dur:.22*s,attack:.01,amp:(deep?.3:.45)*s,role:'texture'});
  x.crackle(dt+.02,{dur:.35*s,rate:250,f:3500,q:.7,amp:.3*s,tick:.004,role:'texture'});
 }
 const t0=slaps[slaps.length-1][0];
 // The cavity the ball opens snaps shut: a rising "plunk".
 x.ring(t0+.045,[[deep?220:300,.05,1,deep?2.3:2.2]],{amp:deep?.7:.5,role:'body',spread:.08});
 const n=deep?36:24;
 for(let i=0;i<n;i++)x.bubble(t0+.06+Math.pow(Math.random(),1.6)*(deep?1:.75),Math.exp(R(Math.log(.001),Math.log(deep?.009:.007))),R(.05,.25));
 // Drops falling back.
 for(let i=0;i<(deep?6:12);i++)x.bubble(t0+R(.25,.95),Math.exp(R(Math.log(.0005),Math.log(.0018))),R(.03,.12));
}
function canopy(x,{f,rate,tick,twigs,swish,dur=.5,amp=.45,q=.5}){
 x.crackle(0,{dur,rate,f,q,amp,tick,role:'texture'});
 x.hiss(.01,{type:'bandpass',f:swish,q:.6,dur:.35,attack:.03,amp:.2,role:'texture'});
 for(let i=0;i<twigs;i++)twig(x,R(0,.25),.35);
 // Then it falls about 8 m to the turf below.
 const fall=R(1.1,1.4);x.thump(fall,135,.02,.35,.6);x.hiss(fall,{type:'bandpass',f:3000,q:.7,dur:.05,attack:.004,amp:.12,role:'texture'});
}
// Play one impact. `speed` is the ball's speed into the surface, m/s.
export function impact(lab,what,{take='A',speed=15,knobs={},pan=0,dist=12,at}={}){
 const I=IMPACTS[what],T=I.takes[take]||I.takes.A,t=(at??lab.ctx.currentTime)+.03;
 // PLACED: level as speed^1.1 with 20 m/s as 1; brightness as speed^0.3.
 const a=.8*Math.pow(Math.max(speed,.3)/20,1.1),k={...knobs,bright:(knobs.bright??1)*Math.pow(Math.max(speed,.3)/15,.3)};
 const dest=place(lab,{pan,dist,wet:.1,until:t+3});
 T.play(kit(lab,dest,t,a,k));
 lab.sweep();
 return t;
}
// Land, then bounce until the hop is too small to hear. A demo of how
// landings stack up in play; the game would call impact() from its own
// contact events instead.
export function bounces(lab,what,{speed=18,angle=40,...o}={}){
 const e=IMPACTS[what].bounce;let t=lab.ctx.currentTime,vy=speed*Math.sin(angle*Math.PI/180),vx=speed*Math.cos(angle*Math.PI/180);const times=[];
 for(let i=0;i<6;i++){const v=Math.hypot(vx,vy);if(v<1.2)break;impact(lab,what,{...o,speed:v,at:t});times.push(t);vy*=e;vx*=.75;if(vy<.5)break;t+=2*vy/9.81;}
 return times;
}

// ---------------------------------------------------------------- ambience
// Nine biomes, each a mix. tempC drives the crickets' chirp rate (Dolbear's
// law); trees decides how the wind sounds in the leaves; birds weights the
// species; water, planes and insects are per-minute-ish weights.
export const SCENES={
 midwest:{label:'Midwest: Prairie Run',tempC:22,wind:8,trees:'broad',birds:{songbird:5,whistler:2,trill:2,dove:2,crow:1,woodpecker:.5},water:{lake:.6},planes:{jet:1,prop:.6},insects:{cicada:.5},howl:1,verb:.12},
 links:{label:'Links: North Sea Links',tempC:14,wind:16,trees:'grass',birds:{skylark:3,gull:2,songbird:1,crow:.5},water:{surf:1},planes:{jet:.6,prop:.3},insects:{},howl:1.6,verb:.05},
 desert:{label:'Desert: Vermilion Basin',tempC:31,wind:9,trees:'sparse',birds:{wren:2,dove:2,songbird:1,raven:.6},water:{lake:.3},planes:{jet:1},insects:{cicada:1.5},howl:1.2,verb:.06},
 mountain:{label:'Mountain: Alpine Reserve',tempC:11,wind:12,trees:'conifer',birds:{songbird:2,whistler:2,raven:1,woodpecker:.5},water:{stream:1},planes:{jet:.5,prop:.6},insects:{},howl:1.3,verb:.15},
 pnw:{label:'Pacific Northwest: Sitka Bluff',tempC:16,wind:7,trees:'conifer',birds:{whistler:2,songbird:3,raven:1,woodpecker:1},water:{stream:.7},planes:{jet:.7,prop:.4},insects:{},howl:1,verb:.2},
 island:{label:'Island: Leeward Cay',tempC:28,wind:11,trees:'palm',birds:{songbird:3,dove:3,gull:1},water:{surf:.8,lake:.4},planes:{jet:.4,prop:.8},insects:{cicada:.3},howl:1,verb:.06},
 redwood:{label:'Giant Redwood: Cathedral Grove',tempC:13,wind:4,trees:'conifer',birds:{songbird:2,whistler:1,raven:1,woodpecker:1},water:{stream:.5},planes:{jet:.3},insects:{},howl:.6,verb:.35},
 autumn:{label:'Autumn: Copper Hollow',tempC:17,wind:10,trees:'dry',birds:{crow:2,songbird:1,geese:.7,woodpecker:.5},water:{lake:.5},planes:{jet:.8},insects:{},howl:1,verb:.12},
 haunted:{label:'Haunted Hollow: Gloaming Moor',tempC:9,wind:14,trees:'bare',birds:{owl:2,crow:2,raven:1},water:{lake:.3},planes:{},insects:{},howl:2.6,verb:.3,dusk:true},
};
// Dolbear (1897): chirps per minute = 4 x (temperature F) - 160, for the
// snowy tree cricket. The law holds from about 55 F (13 C); below that the
// crickets here fall silent, so cool biomes have none at night.
export const dolbear=c=>{const f=c*9/5+32;return f<55?0:4*f-160;};

// ---- birds. Each individual keeps its own song for life, as real birds do;
// the population turns over, so new voices keep arriving.
const BIRD={
 songbird:{dist:[20,110],make(){const base=R(2600,5000),syl=Array.from({length:2+R(0,3)|0},()=>contourSyl(base));return {base,syl,phrase:phrase(syl.length,R(5,12)|0),tempo:R(.85,1.15)};},
  sing(lab,d,t,b){let x=t;const p=J(1,.03),n=Math.random()<.3?Math.ceil(b.phrase.length*R(.5,.9)):b.phrase.length;
   for(let i=0;i<n;i++){const s=b.syl[b.phrase[i]];note(lab,d,x,{dur:s.dur*b.tempo,contour:s.c.map(v=>v*p),amp:.35*R(.75,1),harm:s.harm});x+=(s.dur+s.gap)*b.tempo;}return x-t;}},
 wren:{dist:[20,90],make(){const base=R(1800,2600);return {base,rate:R(5,8),n:R(5,9)|0};},
  // Cactus-wren-like harsh chatter: "char-char-char".
  sing(lab,d,t,b){let x=t;for(let i=0;i<b.n;i++){rasp(lab,d,x,{dur:.09,contour:[b.base*1.1,b.base,b.base*.9],amp:.25,formants:[[b.base*1.6,2.5,1],[b.base*2.6,3,.5]],rough:R(90,130),depth:.8,breath:.4,attack:.006,release:.02});x+=1/b.rate;}return x-t;}},
 whistler:{dist:[25,120],make(){const thrush=Math.random()<.4;return thrush?{thrush,f:R(2200,4200)}:{thrush,hi:R(3800,4100),lo:R(3250,3500)};},
  // Chickadee "fee-bee", or a varied-thrush-like long buzzy whistle.
  sing(lab,d,t,b){if(b.thrush){const f=b.f*J(1,.08);note(lab,d,t,{dur:R(.9,1.4),contour:[f,f*1.01,f*.99],amp:.25,attack:.08,release:.2,vib:.025,vibHz:R(55,80)});return 1.4;}
   note(lab,d,t,{dur:.3,contour:[b.hi,b.hi*.99],amp:.3,attack:.02,release:.05});note(lab,d,t+.38,{dur:.34,contour:[b.lo,b.lo*.985],amp:.28,attack:.02,release:.06});return .75;}},
 trill:{dist:[20,90],make(){return {f:R(4000,6000),rate:R(12,20),n:R(10,24)|0};},
  sing(lab,d,t,b){const n=Math.round(b.n*J(1,.15));let x=t;for(let i=0;i<n;i++){note(lab,d,x,{dur:.03,contour:[b.f,b.f*.6],amp:.28,attack:.003,release:.01});x+=1/b.rate;}return x-t;}},
 dove:{dist:[25,90],make(){return {f:R(380,420)};},
  // Mourning dove: "coo-OOO-oo-oo-oo"; one recorded bird sang 390 Hz with
  // the second note near 650 Hz.
  sing(lab,d,t,b){const f=b.f*J(1,.02);note(lab,d,t,{dur:.32,contour:[f*1.1,f*1.6],amp:.35,attack:.06,release:.06});note(lab,d,t+.4,{dur:.55,contour:[f*1.65,f*1.5,f*1.2],amp:.4,attack:.04,release:.12});
   let x=t+1.15;for(let i=0;i<3;i++){note(lab,d,x,{dur:.38,contour:[f,f*1.02,f*.97],amp:.33,attack:.06,release:.1});x+=.55;}return x-t;}},
 crow:{dist:[40,160],make(){return {f:R(520,680),n:[2,3,3,4,5]};},
  sing(lab,d,t,b){const n=pick(b.n);let x=t;for(let i=0;i<n;i++){const f=b.f*J(1,.04);rasp(lab,d,x,{dur:R(.25,.38),contour:[f*.95,f*1.05,f*.85],amp:.32,formants:[[1400,2.5,1],[2700,3,.5]],rough:R(60,80),depth:.7,breath:.25});x+=R(.42,.6);}return x-t;}},
 raven:{dist:[50,200],make(){return {f:R(260,340)};},
  sing(lab,d,t,b){let x=t;for(let i=0;i<(Math.random()<.5?1:2);i++){rasp(lab,d,x,{dur:R(.3,.45),contour:[b.f,b.f*1.15,b.f*.9],amp:.35,formants:[[900,2.5,1],[1900,3,.4]],rough:R(35,50),depth:.85,breath:.2});x+=R(.6,.9);}return x-t;}},
 gull:{dist:[40,180],make(){return {f:R(1050,1300)};},
  sing(lab,d,t,b){let x=t;const n=Math.random()<.4?R(4,8)|0:R(1,3)|0;for(let i=0;i<n;i++){const f=b.f*J(1,.05),long=i===0||n<4;rasp(lab,d,x,{dur:long?.45:.18,contour:long?[f,f*1.7,f*1.6,f*.95]:[f*1.3,f*1.5,f*1.1],amp:.28,formants:[[2000,1.5,1],[3600,2.5,.4]],rough:R(30,45),depth:.35,breath:.1});x+=long?.6:.24;}return x-t;}},
 owl:{dist:[50,180],make(){return {f:R(270,330)};},
  // Great-horned-like "hoo h'HOO hoo hoo".
  sing(lab,d,t,b){const f=b.f;const seq=[[0,.3,1],[.55,.16,.9],[.75,.45,1.05],[1.45,.35,1],[2.0,.35,.97]];for(const [dt,dur,m]of seq)note(lab,d,t+dt,{dur,contour:[f*m*.97,f*m,f*m*.96],amp:.4,attack:.06,release:.1});return 2.4;}},
 woodpecker:{dist:[40,150],make(){return {rate:R(15,22),n:R(14,24)|0,f:R(900,1300)};},
  sing(lab,d,t,b){let x=t;for(let i=0;i<b.n;i++){ring(lab,d,x,[[b.f,.006,1],[b.f*2.1,.004,.5]],{amp:.4*(1-.4*i/b.n)});x+=1/(b.rate*(1-.2*i/b.n));}return x-t;}},
 skylark:{dist:[60,160],make(){return {lo:R(2800,3400),hi:R(5200,6200)};},
  // A long, high, unbroken warble from somewhere overhead.
  sing(lab,d,t,b){const len=R(8,20);let x=t;while(x<t+len){const dur=R(.03,.07),a=R(b.lo,b.hi),c=R(b.lo,b.hi);note(lab,d,x,{dur,contour:[a,(a+c)/2*J(1,.1),c],amp:.22*R(.6,1),harm:.1});x+=dur+R(.008,.035);}return len;}},
 geese:{dist:[90,220],make(){return {};},
  // A skein passing over: many honks, crossing from one side to the other.
  flock:true},
};
function contourSyl(base){
 const f=base*R(.75,1.3),k=pick(['up','down','chevron','flat','trill']),dur=R(.04,.14);
 const c=k==='up'?[f*.8,f,f*1.25]:k==='down'?[f*1.25,f,f*.75]:k==='chevron'?[f*.85,f*1.2,f*.9]:k==='trill'?Array.from({length:9},(_,i)=>f*(i%2?1.08:.94)):[f,f*1.02,f];
 return {c,dur,gap:R(.02,.08),harm:Math.random()<.4?R(.05,.2):0};
}
function phrase(n,len){const p=[];let i=0;while(p.length<len){const s=Math.random()<.6?i%n:Math.random()*n|0,r=1+(Math.random()*3|0);for(let j=0;j<r;j++)p.push(s);i++;}return p.slice(0,len);}

// ---- the ambience engine. Everything is scheduled ahead of the audio clock
// by schedule(until): live, a timer calls it every 200 ms looking 1.5 s ahead;
// offline, one call schedules a whole render.
export function createAmbience(lab,{onEvent=()=>{}}={}){
 const {ctx}=lab,bus=ctx.createGain();bus.gain.value=0;bus.connect(lab.master);
 // The wind is set in mph (windMph), not through the mix: one number, one meaning.
 const mix={birds:1,water:1,planes:1,insects:1};
 let S=null,night=false,windMph=null,cursor=0,running=false,layers=[],streams=[],queue=[],birds=[],crickets=[],gust=0,flutter=0,started=0;
 const verbSend=ctx.createGain();verbSend.gain.value=0;bus.connect(verbSend);verbSend.connect(lab.verbIn);
 const log=(t,text)=>onEvent({t:t-started,text});
 const at=(t,fn)=>{queue.push([t,fn]);};
 const loop=(type,f,q,gain,pan=0,extra)=>{
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain(),p=ctx.createStereoPanner();
  s.buffer=lab.NOISE;s.loop=true;fl.type=type;fl.frequency.value=f;fl.Q.value=q;g.gain.value=gain;p.pan.value=pan;
  let n=fl;if(extra){const e=ctx.createBiquadFilter();e.type=extra[0];e.frequency.value=extra[1];e.Q.value=.5;fl.connect(e);n=e;}
  s.connect(fl);n.connect(g);g.connect(p);p.connect(bus);s.start(ctx.currentTime,R(0,11));
  const L={s,fl,g,p};layers.push(L);return L;};
 const windNow=()=>windMph??S.wind;
 const leafOn=()=>!['grass','sparse','bare'].includes(S.trees);

 function build(){
  // Wind: a low rumble, two whistles (edges, wires, ears), and the rustle of
  // whatever grows here. Their levels follow a gust process below.
  layers.length=0;
  const W={rumble:loop('lowpass',200,.7,0),whL:loop('bandpass',500,9,0,-.6),whR:loop('bandpass',700,11,0,.55)};
  const leaf={broad:['highpass',1500,['lowpass',6500]],conifer:['highpass',2500,['lowpass',9500]],palm:['highpass',1200,['lowpass',5000]],dry:['highpass',2200,['lowpass',8000]],grass:['highpass',3500,['lowpass',9000]],sparse:['highpass',3000,['lowpass',8000]],bare:['highpass',2600,['lowpass',7000]]}[S.trees];
  W.leafL=loop(leaf[0],leaf[1],.5,0,-.55,leaf[2]);W.leafR=loop(leaf[0],leaf[1]*1.15,.5,0,.5,leaf[2]);
  layers.W=W;
  // Water beds.
  const w=S.water;
  if(w.stream){layers.stream=loop('bandpass',1100,.4,0,.35);layers.streamBus=place(lab,{pan:.35,dist:22,wet:.05,to:bus});}
  if(w.surf){layers.surf=loop('lowpass',350,.6,0,-.3);}
  if(w.lake)layers.lakeBus=place(lab,{pan:-.4,dist:30,wet:.05,to:bus});
  verbSend.gain.value=S.verb;
 }
 function windStep(t,dt){
  // Ornstein-Uhlenbeck gusts: wander about the set wind with gusts lasting
  // several seconds (PLACED: relaxation 0.15/s, spread ~35% of the mean),
  // plus a faster flutter in the leaves.
  const m=windNow();
  gust+=.15*(m-gust)*dt+.35*m*Math.sqrt(2*.15*dt)*gauss();gust=Math.max(0,gust);
  flutter+=1.5*(0-flutter)*dt+.4*Math.sqrt(2*1.5*dt)*gauss();
  const g=gust,W=layers.W,sm=.35,lev=v=>Math.max(0,v);
  W.rumble.g.gain.setTargetAtTime(.05*Math.pow(g/15,2),t,sm);W.rumble.fl.frequency.setTargetAtTime(120+9*g,t,sm);
  const howl=S.howl*lev(g-6);
  W.whL.g.gain.setTargetAtTime(.0035*Math.pow(howl,1.3)*(1+.3*flutter),t,sm);W.whL.fl.frequency.setTargetAtTime(280+16*g+60*flutter,t,.8);
  W.whR.g.gain.setTargetAtTime(.0025*Math.pow(howl,1.3)*(1-.3*flutter),t,sm);W.whR.fl.frequency.setTargetAtTime(420+18*g-50*flutter,t,.8);
  const leafAmt={broad:1,conifer:.9,palm:.8,dry:1,grass:.45,sparse:.25,bare:.3}[S.trees];
  const la=.022*leafAmt*Math.pow(g/12,1.5);
  W.leafL.g.gain.setTargetAtTime(la*(1+.5*flutter),t,.2);W.leafR.g.gain.setTargetAtTime(la*(1-.5*flutter),t,.2);
  if(layers.stream)layers.stream.g.gain.setTargetAtTime(.012*S.water.stream*mix.water,t,.5);
  if(layers.surf)layers.surf.g.gain.setTargetAtTime(.07*S.water.surf*mix.water,t,.5);
 }
 // Each stream is a Poisson process. A rate of zero parks it at the cursor so
 // it starts from "now" when turned up.
 const stream=(name,rate,fire)=>streams.push({name,rate,fire,next:0});
 function makeStreams(){
  streams=[];
  stream('bird',()=>night||S.dusk?(S.birds.owl||1)*.02*mix.birds:.13*mix.birds,t=>{
   const sp=night?pickWeighted({owl:2}):pickWeighted(S.dusk?S.birds:Object.fromEntries(Object.entries(S.birds).filter(([k])=>k!=='owl')));
   if(!sp)return;
   if(BIRD[sp].flock){geese(t);return;}
   let b=birds.find(b=>b.sp===sp&&Math.random()<.7);
   const pop=3+Math.round(2*mix.birds);
   if(!b||Math.random()<.15){b={sp,song:BIRD[sp].make(),pan:R(-.95,.95),dist:R(...BIRD[sp].dist)};birds.push(b);if(birds.length>pop)birds.shift();}
   // A bout: the same bird sings a few times, seconds apart.
   const n=sp==='skylark'?1:1+(Math.random()*4|0);let x=t;
   for(let i=0;i<n;i++){const xx=x;at(xx,()=>{const d=place(lab,{pan:b.pan*J(1,.05),dist:b.dist,wet:.15,to:bus,until:xx+25});BIRD[sp].sing(lab,d,xx,b.song);});x+=R(2.5,8);}
   log(t,`${sp} ${side(b.pan)}, ${b.dist|0} m${n>1?`, ${n} songs`:''}`);
  });
  stream('leaves',()=>leafOn()&&windNow()>0?3:0,t=>{
   const g=gust/12,type=S.trees;if(g<.15)return;
   const f={broad:3000,conifer:5200,palm:2000,dry:4500}[type],rate={broad:220,conifer:350,palm:60,dry:300}[type]*g;
   crackle(lab,place(lab,{pan:R(-.8,.8),dist:R(8,25),wet:.1,to:bus,until:t+2}),t,{dur:R(.2,.6),rate,f,q:.6,amp:.06*Math.min(g,2),tick:type==='palm'?.006:.002,fade:false});
  });
  stream('stream',()=>S.water.stream?55*S.water.stream*mix.water:0,t=>{
   // Babble: bubbles of 0.6-6 mm radius (about 540 Hz to 5.4 kHz).
   bubble(lab,layers.streamBus,t,Math.exp(R(Math.log(.0008),Math.log(.006))),.05*Math.exp(gauss()*.5));
  });
  stream('lap',()=>S.water.lake?.45*S.water.lake*mix.water:0,t=>{
   hiss(lab,layers.lakeBus,t,{type:'lowpass',f:500,f2:1400,q:.5,attack:R(.05,.12),dur:R(.18,.35),amp:R(.12,.3)});
   for(let i=0;i<(Math.random()*3|0);i++)bubble(lab,layers.lakeBus,t+R(.05,.3),R(.001,.003),.1);
  });
  stream('surf',()=>S.water.surf?S.water.surf*mix.water/10:0,t=>wave(t));
  stream('plane',()=>{const p=S.planes,w=(p.jet||0)+(p.prop||0);return night?w*mix.planes/600:w*mix.planes/240;},t=>flyover(t,pickWeighted(S.planes)));
  stream('cicada',()=>!night&&S.insects.cicada&&S.tempC>=24?S.insects.cicada*mix.insects/60:0,t=>cicada(t));
 }
 function side(p){return p<-.33?'left':p>.33?'right':'ahead';}
 function wave(t){
  // A swell builds, breaks and washes out; 8-16 s apart on average.
  const d=R(90,200),dest=place(lab,{pan:R(-.6,.2),dist:d,wet:.1,to:bus,until:t+12}),build=R(1.2,2.6),fall=R(3,5),peak=R(.25,.5);
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=lab.NOISE;fl.type='lowpass';
  fl.frequency.setValueAtTime(250,t);fl.frequency.exponentialRampToValueAtTime(R(1600,2600),t+build);fl.frequency.exponentialRampToValueAtTime(500,t+build+fall);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak*.4,t+build*.8);g.gain.linearRampToValueAtTime(peak,t+build);g.gain.setTargetAtTime(0,t+build,fall/3);
  s.connect(fl);fl.connect(g);g.connect(dest);s.start(t,R(0,4));s.stop(t+build+fall*2);lab.track([s,fl,g],t+build+fall*2+.1);
  ring(lab,dest,t+build,[[R(50,70),.3,.5,.8]],{amp:peak*.8,spread:0});
  crackle(lab,dest,t+build+.1,{dur:fall*.8,rate:700,f:5000,q:.5,amp:peak*.25,tick:.002});
 }
 function geese(t){
  const dur=R(12,20),dir=Math.random()<.5?-1:1,n=R(18,34)|0,base=R(380,460);
  for(let i=0;i<n;i++){const u=Math.random(),x=t+u*dur,f=base*R(.9,1.15),near=1-Math.abs(u-.5)*2;
   at(x,()=>rasp(lab,place(lab,{pan:dir*(u*1.8-.9),dist:220-120*near,wet:.12,to:bus,until:x+2}),x,{dur:R(.14,.24),contour:[f*.9,f*1.1,f],amp:.4,formants:[[1000,3,1],[2400,4,.5]],rough:R(25,40),depth:.4,breath:.15,attack:.01,release:.04}));}
  log(t,`geese passing over, ${dir<0?'right to left':'left to right'}`);
 }
 function cicada(t){
  const len=R(8,18),d=place(lab,{pan:R(-.9,.9),dist:R(15,45),wet:.05,to:bus,until:t+len+1});
  const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),am=ctx.createGain(),env=ctx.createGain(),lfo=ctx.createOscillator(),ld=ctx.createGain();
  s.buffer=lab.NOISE;s.loop=true;bp.type='bandpass';bp.frequency.value=R(4800,6200);bp.Q.value=4;
  am.gain.value=.5;lfo.type='square';lfo.frequency.value=R(160,260);ld.gain.value=.5;lfo.connect(ld);ld.connect(am.gain);
  const peak=R(.05,.1);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(peak,t+len*.35);env.gain.setValueAtTime(peak,t+len*.7);env.gain.linearRampToValueAtTime(0,t+len);
  s.connect(bp);bp.connect(am);am.connect(env);env.connect(d);s.start(t,R(0,8));s.stop(t+len+.05);lfo.start(t);lfo.stop(t+len+.05);lab.track([s,bp,am,env,lfo,ld],t+len+.2);
  log(t,`cicada ${side(0)} (${len|0} s swell)`);
 }
 function flyover(t,kind){
  // A plane passes: geometry first, then sound. Positions are computed at
  // emission time and shifted by the travel time r/c, so the loudest moment
  // lands after the plane is overhead, the pitch of a propeller drops with
  // Doppler, and the ground reflection (ear 1.6 m up) sweeps a comb through
  // the noise -- the "whoosh" of a passing jet.
  const jet=kind==='jet',H=jet?R(1500,4000):R(250,700),v=jet?R(110,190):R(45,65),off=jet?R(-2500,2500):R(-900,900),span=jet?R(80,120):R(45,75),dir=Math.random()<.5?-1:1;
  const step=.1,N=Math.ceil(span/step),te=[],rr=[],el=[],pn=[];
  for(let i=0;i<=N;i++){const s=i*step-span/2,x=dir*v*s,r=Math.hypot(x,off,H);te.push(s+r/SOUND);rr.push(r);el.push(H/r);pn.push(clamp(x/Math.hypot(x,off)*.9*Math.min(1,Math.abs(x)/600),-.9,.9));}
  const len=te[N]-te[0],M=Math.ceil(len/step),gain=new Float32Array(M+1),cut=new Float32Array(M+1),pan=new Float32Array(M+1),dl=new Float32Array(M+1),dop=new Float32Array(M+1);
  let j=0;const ref=jet?1500:300,lvl=jet?.2:.15;
  for(let i=0;i<=M;i++){const tt=te[0]+i*step;while(j<N-1&&te[j+1]<tt)j++;const u=clamp((tt-te[j])/(te[j+1]-te[j]),0,1),L=(a)=>a[j]+(a[j+1]-a[j])*u;
   const r=L(rr),edge=Math.min(1,i/(M*.08),(M-i)/(M*.08));
   gain[i]=lvl*ref/r*edge;cut[i]=airCutoff(r);pan[i]=L(pn);dl[i]=clamp(2*1.6*L(el)/SOUND*J(1,.03),.0002,.0195);
   // Received frequency ratio from the rate the path shortens or grows.
   dop[i]=clamp((te[j+1]-te[j])/step,.6,1.6);dop[i]=1/dop[i];}
  const t0=t,T=M*step,dest=ctx.createGain(),air=ctx.createBiquadFilter(),p=ctx.createStereoPanner(),refl=ctx.createDelay(.05),rg=ctx.createGain(),rlp=ctx.createBiquadFilter();
  air.type='lowpass';air.Q.value=.5;rg.gain.value=.75;rlp.type='lowpass';rlp.frequency.value=3000;
  dest.gain.setValueCurveAtTime(gain,t0,T);air.frequency.setValueCurveAtTime(cut,t0,T);p.pan.setValueCurveAtTime(pan,t0,T);refl.delayTime.setValueCurveAtTime(dl,t0,T);
  const src=ctx.createGain(),nodes=[dest,air,p,refl,rg,rlp,src];
  src.connect(air);src.connect(refl);refl.connect(rlp);rlp.connect(rg);rg.connect(air);air.connect(dest);dest.connect(p);p.connect(bus);
  if(jet){const s=ctx.createBufferSource(),f1=ctx.createBiquadFilter(),f2=ctx.createBiquadFilter();s.buffer=lab.NOISE;s.loop=true;f1.type='lowpass';f1.frequency.value=900;f1.Q.value=.4;f2.type='highshelf';f2.frequency.value=2000;f2.gain.value=-6;s.connect(f1);f1.connect(f2);f2.connect(src);s.start(t0,R(0,11));s.stop(t0+T+.1);nodes.push(s,f1,f2);}
  else{const f0=R(75,95),mk=(type,m,l)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueCurveAtTime(dop.map(d=>d*f0*m),t0,T);g.gain.value=l;o.connect(g);g.connect(src);o.start(t0);o.stop(t0+T+.1);nodes.push(o,g);};
   const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;lp.Q.value=.7;
   mk('sawtooth',1,.5);mk('square',.5,.25);mk('sawtooth',2.02,.12);
   const s=ctx.createBufferSource(),nf=ctx.createBiquadFilter(),ng=ctx.createGain();s.buffer=lab.NOISE;s.loop=true;nf.type='bandpass';nf.frequency.value=600;nf.Q.value=.6;ng.gain.value=.4;s.connect(nf);nf.connect(ng);ng.connect(src);s.start(t0,R(0,11));s.stop(t0+T+.1);nodes.push(s,nf,ng,lp);}
  lab.track(nodes,t0+T+.5);
  log(t,`${jet?'jet':'small prop plane'} ${off<0?'to the left':'to the right'}, ${Math.round(H)} m up, ${Math.round(T)} s`);
 }
 function scheduleCrickets(until){
  const on=night&&mix.insects>0,rate=dolbear(S.tempC)/60;
  if(!on||rate<=0){crickets.length=0;return;}
  const want=Math.round(3+3*mix.insects);
  while(crickets.length<want)crickets.push({f:R(2800,4600),rate:rate*J(1,.06),next:Math.max(cursor,ctx.currentTime)+R(0,2),d:null,pan:R(-.9,.9),dist:R(6,40),pulses:3+(Math.random()*2|0)});
  crickets.length=want;
  for(const c of crickets){c.d=c.d||place(lab,{pan:c.pan,dist:c.dist,wet:.08,to:bus});
   while(c.next<until){const o=ctx.createOscillator(),g=ctx.createGain(),t=c.next;o.frequency.value=c.f;g.gain.setValueAtTime(0,t);
    for(let k=0;k<c.pulses;k++){const x=t+k*.033;g.gain.setValueAtTime(0,x);g.gain.linearRampToValueAtTime(.06,x+.004);g.gain.setValueAtTime(.06,x+.014);g.gain.linearRampToValueAtTime(0,x+.018);}
    o.connect(g);g.connect(c.d);o.start(t);o.stop(t+c.pulses*.033+.02);lab.track([o,g],t+.3);
    // Chirps drift a little; a cricket now and then pauses.
    c.next+=1/c.rate*J(1,.04)+(Math.random()<.02?R(1,5):0);}}
 }
 function schedule(until){
  if(!running)return;
  if(cursor<ctx.currentTime)cursor=ctx.currentTime;
  for(;cursor<until;cursor+=.25)windStep(cursor,.25);
  for(const s of streams){const r=s.rate();if(r<=0){s.next=until;continue;}if(s.next<ctx.currentTime)s.next=ctx.currentTime+wait(r);while(s.next<until){s.fire(s.next);s.next+=wait(r);}}
  queue.sort((a,b)=>a[0]-b[0]);while(queue.length&&queue[0][0]<until){const [t,f]=queue.shift();f(t);}
  scheduleCrickets(until);
  lab.sweep();
 }
 let timer=null;
 const api={bus,mix,
  get scene(){return S;},
  start(sceneName,{live=true}={}){api.stop(true);S=SCENES[sceneName];running=true;gust=windNow();flutter=0;birds=[];crickets=[];queue=[];
   started=cursor=ctx.currentTime;build();makeStreams();
   bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(1,ctx.currentTime+2);
   if(live){timer=setInterval(()=>schedule(ctx.currentTime+1.5),200);schedule(ctx.currentTime+1.5);}},
  stop(quick){running=false;clearInterval(timer);timer=null;const now=ctx.currentTime,old=layers.slice(),oldBus=[layers.streamBus,layers.lakeBus];
   bus.gain.cancelScheduledValues(now);bus.gain.setValueAtTime(bus.gain.value,now);bus.gain.linearRampToValueAtTime(0,now+(quick?.05:1));
   for(const L of old){try{L.s.stop(now+(quick?.06:1.1));}catch{}}
   for(const c of crickets)c.d=null;crickets=[];layers=[];
   lab.track(old.flatMap(L=>[L.s,L.fl,L.g,L.p]).concat(oldBus.filter(Boolean)),now+1.3);},
  // Offline renders schedule everything up front.
  schedule,
  set(o){if('night'in o)night=o.night;if('wind'in o)windMph=o.wind;for(const k of Object.keys(mix))if(k in o)mix[k]=o[k];},
  get night(){return night;},
  get wind(){return windMph??S?.wind;},
  get gust(){return gust;},
  trigger(kind){const t=ctx.currentTime+.1;if(kind==='jet'||kind==='prop')flyover(t,kind);else if(kind==='geese')geese(t);else if(kind==='wave'&&S?.water.surf)wave(t);else if(kind==='cicada')cicada(t);
   else if(BIRD[kind]){const b={sp:kind,song:BIRD[kind].make(),pan:R(-.8,.8),dist:R(...BIRD[kind].dist)};BIRD[kind].sing(lab,place(lab,{pan:b.pan,dist:b.dist,wet:.15,to:bus,until:t+25}),t,b.song);log(t,`${kind} ${side(b.pan)}, ${b.dist|0} m (on request)`);}},
 };
 return api;
}
