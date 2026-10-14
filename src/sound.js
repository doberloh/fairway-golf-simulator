// FAIRWAY'S SOUNDS: every one is synthesised live with the Web Audio API.
//
// No recordings ship, so there is nothing to license or attribute, nothing
// adds to the single-file build but this code, and no two plays are the same
// sample: every strike re-rolls its modes a little, and the ambience is a set
// of random processes (gusts, birds, bubbles, planes) rather than a file on
// repeat.
//
// What a sound IS lives here; WHEN the game plays one lives in audio.js. This
// file touches no DOM and takes an AudioContext (live or offline), so the
// owner's listening report (tools/sound-lab/build.mjs inlines this very file
// into docs/reports/sounds/index.html, local) plays exactly what the game does.
// Every sound was chosen by the owner over four rounds on 13 October 2026;
// `FINAL` folds their settings in.
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
 // Effects (strikes, landings, scores) and the ambience have their own
 // volumes in the game, so each has its own gain into the master.
 const fx=ctx.createGain();fx.connect(master);
 const lab={ctx,master,fx,out:lim,verbIn,NOISE:whiteNoise(ctx,12),trash:[],
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
export function place(lab,{pan=0,dist=10,wet=.12,to=lab.fx,until}={}){
 const {ctx}=lab,g=ctx.createGain(),air=ctx.createBiquadFilter(),p=ctx.createStereoPanner();
 g.gain.value=clamp(10/Math.max(dist,1),0,2);
 air.type='lowpass';air.frequency.value=airCutoff(dist);air.Q.value=.5;
 p.pan.value=clamp(pan,-1,1);
 g.connect(air);air.connect(p);p.connect(to);g.air=air;g.panner=p;
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
// Swing noise. Round 1's was one wide band of white noise and the owner heard
// hiss ("too white noise sounding; in reality it's a whooshing sound"). A club
// is a "vwoosh": darker air through a narrow resonance whose pitch climbs into
// the strike and falls after it, over a soft wide band underneath. PLACED:
// centre 150 Hz + 14 Hz per m/s (about 780 Hz at 100 mph); level as
// speed^2.5; the narrow band's gain makes up the energy its width removes.
// `pre` is how long it rises into the strike: 0.26 s in the lab, shorter in
// the game, where the ball is already away (audio.js).
function whoosh(lab,dest,t,v,amp,pre=.26){
 const {ctx}=lab,post=.2,start=t-pre,end=t+post,fc=150+14*v;
 const s=ctx.createBufferSource(),dark=ctx.createBiquadFilter(),tone=ctx.createBiquadFilter(),wide=ctx.createBiquadFilter(),gt=ctx.createGain(),gw=ctx.createGain(),g=ctx.createGain();
 s.buffer=lab.NOISE;dark.type='lowpass';dark.frequency.value=2500;dark.Q.value=.5;
 tone.type='bandpass';tone.Q.value=6;wide.type='bandpass';wide.Q.value=.9;gt.gain.value=2.2;gw.gain.value=.5;
 for(const [p,k]of [[tone.frequency,1],[wide.frequency,.6]]){p.setValueAtTime(fc*.45*k,start);p.exponentialRampToValueAtTime(fc*k,t);p.exponentialRampToValueAtTime(fc*.55*k,end);}
 const n=96,curve=new Float32Array(n),a=amp*Math.pow(v/45,2.5);
 for(let i=0;i<n;i++){const x=(pre+post)*i/(n-1)-pre;curve[i]=a*(x<0?Math.pow(1+x/pre,4):Math.exp(-x/.05)*(1-x/post));}
 curve[n-1]=0;
 g.gain.setValueCurveAtTime(curve,start,pre+post);
 s.connect(dark);dark.connect(tone);tone.connect(gt);gt.connect(g);dark.connect(wide);wide.connect(gw);gw.connect(g);g.connect(dest);
 s.start(start,R(0,8));s.stop(end+.02);lab.track([s,dark,tone,wide,gt,gw,g],end+.1);
}

// The knobs every sound offers in the report. Each recipe uses some of them;
// the report shows only those a sound lists.
export const KNOBS={
 level:{label:'Loudness',min:0,max:2.5,step:.05,def:1},
 pitch:{label:'Pitch',min:.5,max:2,step:.01,def:1},
 length:{label:'Ring / length',min:.2,max:3,step:.05,def:1},
 bright:{label:'Brightness',min:.3,max:2.5,step:.05,def:1},
 click:{label:'Crack (contact)',min:0,max:4,step:.05,def:1},
 body:{label:'Thump (body)',min:0,max:2.5,step:.05,def:1},
 texture:{label:'Texture (grass, sand, water, leaves)',min:0,max:4,step:.05,def:1},
 whoosh:{label:'Swing whoosh',min:0,max:2.5,step:.05,def:1},
};
// A take can carry `base` knobs: settings baked into it (round 2 bakes the
// owner's round-1 sliders into take A). The report's sliders multiply on top,
// so 100% on a slider always means "as the take is".
export const mergeKnobs=(base={},user={})=>{const o={...base};for(const [n,v]of Object.entries(user))o[n]=(o[n]??1)*v;return o;};
const knobClamp=(n,v)=>clamp(v,KNOBS[n].min,KNOBS[n].max);
// Round 2's B and C for a sound the owner tuned: B carries every slider the
// owner moved half as far again in the same direction, C goes half way back.
const further=(b,e)=>Object.fromEntries(Object.entries(b).map(([n,v])=>[n,+knobClamp(n,Math.pow(v,e)).toFixed(3)]));
function rounds(play,base,names={}){return {
 A:{name:names.A||'Round 1: your settings',play,base},
 B:{name:names.B||'A step further the way you moved it',play,base:further(base,1.5)},
 C:{name:names.C||'Half way back',play,base:further(base,.5)}};}
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
  whoosh:(dt,v,lvl,pre)=>K.whoosh>0&&whoosh(lab,dest,t0+dt,v,lvl*K.level*K.whoosh,pre),
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
// Round 1 recipes, kept by name: round 2 bakes the owner's sliders into them.
const driverTi=modes=>x=>{
 x.hiss(0,{type:'highpass',f:2500,dur:.004,attack:.0003,amp:.7,role:'click',fixed:true});
 x.ring(0,[[BALL,.004,.45]]);
 x.ring(0,modes,{amp:.5});
 x.thump(0,220,.012,.35);};
const DRIVER_TI=[[3350,.035,.45],[4150,.05,1],[4480,.045,.75],[5600,.03,.45],[6900,.02,.3],[8300,.012,.18]];
const hybrid=x=>{
 x.hiss(0,{type:'highpass',f:2500,dur:.004,attack:.0003,amp:.85,role:'click',fixed:true});
 x.ring(0,[[BALL,.004,.55]]);
 x.ring(0,[[3200,.012,.8],[4100,.016,1],[5300,.01,.5]],{amp:.45});
 x.thump(0,170,.012,.4);
 x.hiss(.006,{type:'bandpass',f:2000,q:.6,dur:.08,attack:.004,amp:.32,role:'texture'});};
const woodTee=x=>{
 x.hiss(0,{type:'highpass',f:2800,dur:.004,attack:.0003,amp:.75,role:'click',fixed:true});
 x.ring(0,[[BALL,.004,.5]]);
 x.ring(0,[[3900,.022,.7],[4700,.034,1],[5900,.022,.6],[7400,.014,.3]],{amp:.45});
 x.thump(0,190,.012,.35);};
const ironClean=x=>{
 x.hiss(0,{type:'bandpass',f:4200,q:.5,dur:.003,attack:.0002,amp:1.1,role:'click',fixed:true});
 x.ring(0,[[BALL,.005,.6]]);
 x.ring(0,[[2600,.008,.6],[3500,.007,1],[4800,.005,.7],[6800,.003,.4]],{amp:.5});
 divot(x,.3);};
// Round 2's iron, from the owner: "much more cracky... there isn't really any
// metal sound at all to an iron... it's a lot of ball noise". So no ringing
// head at all: a hard, very short crack (the ball compressing on a solid
// face) and the ball's own tones, damped within two or three milliseconds.
const ironCrack=x=>{
 x.hiss(0,{type:'highpass',f:2000,dur:.0025,attack:.0002,amp:1.3,role:'click',fixed:true});
 x.hiss(0,{type:'bandpass',f:3600,q:.9,dur:.007,attack:.0003,amp:.8,role:'click'});
 x.ring(0,[[1700,.002,.6],[2900,.0018,.55],[4300,.0014,.4]],{amp:.5});};
const chipClean=x=>{
 x.hiss(-.03,{type:'bandpass',f:3200,q:.8,dur:.05,attack:.015,amp:.14,role:'texture'});
 x.hiss(0,{type:'bandpass',f:4800,q:.6,dur:.0025,attack:.0002,amp:.75,role:'click',fixed:true});
 x.ring(0,[[1800,.004,.6],[3300,.005,1],[5000,.003,.5]],{amp:.45});
 x.hiss(.004,{type:'bandpass',f:2400,q:.7,dur:.06,attack:.004,amp:.12,role:'texture'});};
const putterInsert=x=>{
 x.hiss(0,{type:'bandpass',f:3000,q:.5,dur:.002,attack:.0003,amp:.15,role:'click',fixed:true});
 x.ring(0,[[1150,.004,1],[2500,.003,.5],[3400,.002,.2]],{amp:.5});};
export const STRIKES={
 driver:{label:'Driver',speed:[60,125,100],gain:.42,whoosh:.5,knobs:['level','pitch','length','bright','click','body','whoosh'],
  note:'Titanium head off a tee. Published: a titanium driver strike centres near 4-4.5 kHz and lasts under 0.2 s.',
  takes:{
   A:{name:'Round 1: your settings (ring now centred near 6.6 kHz)',play:driverTi(DRIVER_TI),base:{pitch:1.6,body:.2,click:2.5,whoosh:.4,length:.5}},
   // The owner's note asked for "a higher pitch around 3500 Hz" while the
   // pitch slider went to its top, which puts the main ring at 6.6 kHz. B is
   // the note taken literally; the owner picks.
   B:{name:'Your note taken literally: main ring at 3.5 kHz, same crack',play:driverTi(DRIVER_TI.map(([f,...r])=>[f*3500/4150,...r])),base:{body:.2,click:2.5,whoosh:.4,length:.5}},
   C:{name:'Crack first: even shorter ring, more crack',play:driverTi(DRIVER_TI),base:{pitch:1.6,body:.15,click:3.5,whoosh:.4,length:.35}},
  }},
 wood:{label:'Fairway wood',speed:[55,115,90],gain:.4,whoosh:.45,knobs:['level','pitch','length','bright','click','body','texture','whoosh'],
  note:'Smaller steel or titanium head, swept off the turf: higher and shorter than the driver, with the brush of the sole.',
  takes:{
   A:{name:'Round 1: your settings (hybrid, ring near 5.2 kHz)',play:hybrid,base:{length:.4,pitch:1.27,click:2.5,texture:1.85,whoosh:.35}},
   B:{name:'Same, main ring at 3.5 kHz (your driver note)',play:hybrid,base:{length:.4,pitch:.85,click:2.5,texture:1.85,whoosh:.35}},
   C:{name:'Your settings, off a tee (no turf)',play:woodTee,base:{length:.4,pitch:1.27,click:2.5,whoosh:.35}},
  }},
 iron:{label:'Iron',speed:[50,105,80],gain:.45,whoosh:.4,knobs:['level','pitch','length','bright','click','body','texture','whoosh'],
  note:'Round 2: no metal ring at all -- a hard crack and the ball, then the divot.',
  takes:{
   A:{name:'Crack, no metal, a small divot',play:x=>{ironCrack(x);divot(x,.35);}},
   B:{name:'Crack, no metal, a full divot',play:x=>{ironCrack(x);divot(x,1);}},
   C:{name:'Round 1: your settings (picked clean)',play:ironClean,base:{body:.15,length:.4,pitch:1.35,click:1.55}},
  }},
 chip:{label:'Chip (wedge)',speed:[12,45,28],gain:.55,whoosh:.25,knobs:['level','pitch','length','bright','click','texture','whoosh'],
  note:'A short swing: the leading edge brushes the grass just before the ball, a soft click, then a little brush after.',
  takes:{
   A:{name:'Round 1: your settings (clean chip)',play:chipClean,base:{length:.4,pitch:.94}},
   B:{name:'Out of the rough: grassy, muffled',base:{length:.4},play:x=>{
    x.hiss(-.09,{type:'bandpass',f:2600,q:.6,dur:.14,attack:.05,amp:.3,role:'texture'});
    x.crackle(-.07,{dur:.2,rate:700,f:4200,q:.6,amp:.16,role:'texture'});
    x.hiss(0,{type:'bandpass',f:3200,q:.6,dur:.003,attack:.0003,amp:.45,role:'click',fixed:true});
    x.ring(0,[[1700,.003,.6],[3100,.004,1]],{amp:.3});
    x.hiss(.004,{type:'bandpass',f:2000,q:.6,dur:.14,attack:.01,amp:.25,role:'texture'});}},
   C:{name:'Bump-and-run with a mid iron (round 2 crack)',play:x=>{ironCrack(x);x.hiss(.004,{type:'bandpass',f:2600,q:.7,dur:.05,attack:.004,amp:.1,role:'texture'});}},
  }},
 putter:{label:'Putter',speed:[1,10,6],gain:1.1,whoosh:0,knobs:['level','pitch','length','bright','click'],
  note:'Published: in a putt the 2-4 kHz band follows the ball and below 2 kHz follows the putter and where it was struck.',
  takes:{
   A:{name:'Round 1: your settings (soft insert)',play:putterInsert,base:{length:.65,click:2.05}},
   B:{name:'Milled steel blade: a clean "tock" with a hint of ring',play:x=>{
    x.hiss(0,{type:'bandpass',f:5000,q:.5,dur:.002,attack:.0002,amp:.3,role:'click',fixed:true});
    x.ring(0,[[1350,.006,.8],[2900,.006,1],[3700,.004,.6],[6100,.012,.12]],{amp:.5});}},
   C:{name:'Heavy mallet: lower "tock"',play:x=>{
    x.hiss(0,{type:'bandpass',f:4000,q:.5,dur:.002,attack:.0002,amp:.2,role:'click',fixed:true});
    x.ring(0,[[900,.006,.9],[2100,.005,.7],[3300,.003,.4]],{amp:.55});}},
  }},
};
// Play one strike. `speed` is head speed in mph; the impact lands `lead`
// seconds after the call so the whoosh can rise to it -- never scheduled in
// the past: Web Audio does not play the missed part of a sound started late,
// it moves the whole sound to now, which put the whoosh AFTER the crack.
export function strike(lab,club,{take='A',speed,knobs={},pan=0,dist=10,at,lead=.45}={}){
 const C=STRIKES[club],T=C.takes[take]||C.takes.A,mph=speed??C.speed[2];
 const t=(at??lab.ctx.currentTime)+lead;
 // Louder and brighter the harder it is hit. PLACED: level as speed^0.8, so a
 // putt is quiet but still audible; brightness as speed^0.35 at the club's own
 // default speed.
 const a=C.gain*Math.pow(mph/100,.8),k=mergeKnobs(T.base,knobs);k.bright=(k.bright??1)*Math.pow(mph/C.speed[2],.35);
 const dest=place(lab,{pan,dist,wet:.08,until:t+3});
 const x=kit(lab,dest,t,a,k);
 if(C.whoosh)x.whoosh(0,mph*MPH,C.whoosh,Math.min(.26,lead-.01));
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
// Round 2: each turf's take A is the owner's round-1 pick with their sliders
// baked in; B moves every slider they touched half as far again, C half way
// back. Their direction was the same on every turf -- shorter, more of the
// ball's tick, less thump, more grass, darker -- so B is the likeliest next
// step. Semi and rough had no ball tick for the Crack slider to move (the
// owner raised it anyway), so a light one was added.
const greenRx=x=>{x.thump(0,150,.018,.9,.62);ballTick(x);x.hiss(0,{type:'lowpass',f:1800,q:.5,dur:.03,attack:.0015,amp:.35,role:'texture'});};
const fringeRx=x=>{x.thump(0,145,.019,.85,.62);ballTick(x,.2);grass(x,0,.05,.25,3500);};
const fairwayRx=x=>{x.thump(0,130,.022,.9,.6);ballTick(x,.2);grass(x,0,.06,.3);};
const teeRx=x=>{x.thump(0,165,.017,.85,.65);ballTick(x,.32);grass(x,0,.05,.26,3300);};
const semiRx=x=>{x.thump(0,110,.022,.55,.58);ballTick(x,.12);grass(x,0,.12,.36,2300);};
const roughRx=x=>{x.thump(0,105,.02,.35,.6);ballTick(x,.1);x.hiss(0,{type:'bandpass',f:2200,q:.5,dur:.2,attack:.01,amp:.35,role:'texture'});x.crackle(0,{dur:.22,rate:900,f:3800,q:.6,amp:.25,role:'texture'});};
const sandRx=x=>{x.thump(0,80,.025,.45,.6);x.hiss(0,{type:'lowpass',f:1300,q:.4,dur:.09,attack:.003,amp:.7,role:'texture'});x.crackle(0,{dur:.12,rate:700,f:5000,q:.7,amp:.35,role:'texture'});x.crackle(.12,{dur:.35,rate:120,f:3500,amp:.08,tick:.003,role:'texture'});};
// A solid pine board, for the owner's trunk note ("more cracky, like hitting
// a solid pine board"): a hard crack, then short, bright wooden tones -- a
// board's modes sit higher and die faster than a hollow trunk's. PLACED.
const board=(x,m=1,d=1)=>{
 x.hiss(0,{type:'highpass',f:2000,dur:.002,attack:.0002,amp:1.2,role:'click',fixed:true});
 x.hiss(0,{type:'bandpass',f:3200,q:1,dur:.006,attack:.0003,amp:.6,role:'click'});
 x.ring(0,[[BALL,.0025,.5]]);
 x.ring(0,[[620,.012,1],[1150,.009,.7],[1900,.006,.5],[2800,.004,.35],[4200,.0025,.2]],{amp:.55,pitch:m,decay:d});};
const palm=x=>{x.ring(0,[[BALL,.003,.35]]);x.ring(0,[[260,.014,1],[520,.012,.5],[900,.008,.3]],{amp:.6});x.crackle(0,{dur:.09,rate:500,f:2500,amp:.22,role:'texture'});x.crackle(.15,{dur:.5,rate:60,f:1800,q:.6,amp:.1,tick:.008,role:'texture'});};
// The cup, redone after research (RESEARCH, round 2). A hole is 4.25 in
// across and at least 4 in deep, lined with a moulded plastic cup that has
// drain holes in its floor. Round 1 rang a 640 Hz tone for 30 ms, which is a
// bell, not a cup. Now: the ball falls about 0.1 m (1.4 m/s) onto the plastic
// floor -- a dull "tok" that dies in a few milliseconds -- and bounces with
// shrinking hops (PLACED restitution 0.45: 0.13 s, 0.06, 0.03...), the
// "clunk-clunk-k-k" rattle; the tube colours each hit with a short hollow
// resonance near 640 Hz (a quarter wave of 0.1 m plus the open-end
// correction), and now and then the ball clicks off the wall.
function cupDrop(x,{metal=false,dt0=0}={}){
 const e=.45,v0=1.4;let t=dt0,v=v0;
 for(let i=0;i<6&&v>.12;i++){
  const a=Math.pow(v/v0,1.2);
  x.hiss(t,{type:'bandpass',f:metal?3400:1700,q:.8,dur:.004,attack:.0003,amp:.9*a,role:'click',fixed:true});
  x.ring(t,metal?[[1650,.03,.8],[3900,.018,.6],[6200,.01,.35],[640,.008,.5]]:[[640,.007,.7],[1920,.004,.35],[2700,.002,.4],[BALL,.0015,.3]],{amp:.6*a});
  if(Math.random()<.4)x.hiss(t+R(.01,.04),{type:'bandpass',f:metal?4000:2400,q:1,dur:.002,attack:.0002,amp:.35*a,role:'click',fixed:true});
  v*=e;t+=2*v/9.81;
 }
}
export const IMPACTS={
 green:{label:'Green',group:'turf',bounce:.35,knobs:T_KNOBS,note:'Short, tight turf on firm ground: a soft "thup".',
  takes:rounds(greenRx,{length:.4,texture:1.75,body:.65,bright:.6,click:2.3})},
 fringe:{label:'Fringe',group:'turf',bounce:.35,knobs:T_KNOBS,note:'Green-firm ground, a little more grass.',
  takes:rounds(fringeRx,{length:.4,texture:1.55,bright:.65,click:2.5,body:.45})},
 fairway:{label:'Fairway',group:'turf',bounce:.4,knobs:T_KNOBS,note:'A thud and a quick brush of mown grass.',
  takes:rounds(fairwayRx,{length:.4,level:1.1,bright:.65,click:1.95,body:.4,texture:1.4})},
 tee:{label:'Tee box',group:'turf',bounce:.42,knobs:T_KNOBS,note:'Fairway grass on a firmer, levelled pad.',
  takes:rounds(teeRx,{pitch:.73,length:.4,bright:.7,click:1.95,texture:1.65,body:.75})},
 semi:{label:'Semi-rough',group:'turf',bounce:.28,knobs:T_KNOBS,note:'Longer grass takes the edge off the thud.',
  takes:rounds(semiRx,{length:1.25,click:1.75,texture:1.4,body:.2},{A:'Round 1: your settings (lush semi)'})},
 rough:{label:'Rough',group:'turf',bounce:.18,knobs:T_KNOBS,note:'Mostly grass: a muffled landing in a rustle.',
  takes:rounds(roughRx,{length:1.65,click:1.85,pitch:.88,body:.2})},
 sand:{label:'Bunker',group:'turf',bounce:.05,knobs:['level','pitch','length','bright','body','texture'],note:'A "pfff" into sand with a crunch of grit and a little spray falling back.',
  takes:rounds(sandRx,{length:2.25,body:.4})},
 water:{label:'Water',group:'water',bounce:0,knobs:['level','pitch','length','bright','texture','body'],note:'A slap, a sheet of spray, the "plunk" of the cavity closing, and the bubbles that follow.',takes:{
  A:{name:'Round 1: your settings (skips, then sinks)',play:x=>water(x,3),base:{length:.55,pitch:.7,body:.3}},
  B:{name:'Your settings, straight in',play:x=>water(x,1),base:{length:.55,pitch:.7,body:.3}},
  C:{name:'Your settings, a steep plunge',play:x=>water(x,2),base:{length:.55,pitch:.7,body:.3}},
 }},
 trunk:{label:'Tree trunk',group:'solid',knobs:['level','pitch','length','bright','click','texture'],note:'Round 2: cracky, like a solid pine board.',takes:{
  A:{name:'Solid pine board: a hard crack',play:x=>board(x)},
  B:{name:'Thicker beam: lower, a touch longer',play:x=>board(x,.72,1.3)},
  C:{name:'Round 1: your pick (palm)',play:palm},
 }},
 canopy:{label:'Leaves and branches',group:'solid',knobs:['level','pitch','length','bright','click','texture'],note:'Through the canopy: leaf slaps, twigs, the branch swaying -- then the ball drops to the ground.',takes:{
  A:{name:'Round 1: your pick (dry autumn leaves)',play:x=>canopy(x,{f:4000,rate:500,tick:.0015,twigs:2,swish:1800,dur:.6,amp:.55,q:.9})},
  B:{name:'Broadleaf canopy',play:x=>canopy(x,{f:3200,rate:350,tick:.003,twigs:2,swish:1500})},
  C:{name:'Conifer needles: finer',play:x=>canopy(x,{f:5500,rate:700,tick:.0015,twigs:4,swish:2500,dur:.35})},
 }},
 rock:{label:'Rock',group:'solid',knobs:['level','pitch','length','bright','click','texture'],note:'A sharp "clack": ball and stone are both hard.',takes:{
  A:{name:'Round 1: your pick (glancing ricochet)',play:x=>{x.hiss(0,{type:'highpass',f:3000,dur:.002,attack:.0002,amp:.8,role:'click',fixed:true});x.ring(0,[[BALL,.004,.6],[3400,.006,.6]],{amp:.6});x.crackle(.004,{dur:.12,rate:160,f:3000,amp:.25,role:'texture'});x.ring(.09,[[BALL,.003,.4],[3600,.005,.5]],{amp:.3});}},
  B:{name:'Granite boulder',play:x=>{x.hiss(0,{type:'highpass',f:3000,dur:.002,attack:.0002,amp:1,role:'click',fixed:true});x.ring(0,[[BALL,.004,.7]]);x.ring(0,[[2100,.006,.6],[3400,.008,1],[5200,.005,.55],[7600,.003,.35]],{amp:.45});}},
  C:{name:'Sandstone: duller, gritty',play:x=>{x.hiss(0,{type:'highpass',f:2200,dur:.003,attack:.0003,amp:.8,role:'click',fixed:true});x.ring(0,[[BALL,.003,.6]]);x.ring(0,[[1300,.004,.7],[2300,.005,1],[3600,.003,.5]],{amp:.45});x.crackle(.002,{dur:.05,rate:400,f:4000,amp:.2,role:'texture'});}},
 }},
 cup:{label:'Into the cup',group:'extra',knobs:['level','pitch','length','bright','click'],note:'Round 2, researched: a dull plastic "tok" and a rattle of shrinking bounces, coloured by the hollow tube.',takes:{
  A:{name:'Plastic cup: drops in and rattles',play:x=>cupDrop(x)},
  B:{name:'Off the flagstick, then in',play:x=>{
   // A flagstick is fibreglass, not a bell: a dull knock, and its metal
   // ferrule chatters in the cup's socket.
   x.hiss(0,{type:'bandpass',f:1800,q:.8,dur:.004,attack:.0003,amp:.7,role:'click',fixed:true});
   x.ring(0,[[420,.02,1],[1150,.01,.5],[2400,.004,.3]],{amp:.45});
   x.ring(.012,[[3100,.006,.5],[4700,.004,.3]],{amp:.25});
   cupDrop(x,{dt0:.16});}},
  C:{name:'Older aluminium cup: brighter clank',play:x=>cupDrop(x,{metal:true})},
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
// ---------------------------------------------------------------- round 3
// Water, round 3. The owner on round 2's pick: "I don't like that it's
// bubbly. It needs to be more of a splash sound." The splash carries it now --
// a slap, a broad sheet of water thrown up, the spray pattering back, bigger
// drops after -- with the cavity's plunk kept short and low and only a few
// faint bubbles behind it.
function splash(x,big=1){
 x.hiss(0,{type:'highpass',f:1200,dur:.014,attack:.0004,amp:.7,role:'texture'});
 x.hiss(.003,{type:'bandpass',f:1400,f2:700,q:.5,dur:.18*big,attack:.006,amp:.6,role:'texture'});
 x.hiss(.006,{type:'highpass',f:2500,dur:.3*big,attack:.02,amp:.35,role:'texture'});
 x.crackle(.05,{dur:.55*big,rate:520,f:3000,q:.5,amp:.32,tick:.003,role:'texture'});
 x.crackle(.25,{dur:.6*big,rate:160,f:1800,q:.6,amp:.14,tick:.006,role:'texture'});
 x.thump(.03,140,.03,.6,.7);
 for(let i=0;i<3;i++)x.bubble(.1+R(0,.35),Math.exp(R(Math.log(.002),Math.log(.006))),R(.02,.06),R(1,1.2));
}
const WATER_BASE={length:.55,pitch:.7,body:.3};
IMPACTS.water.note='Round 3: a splash, not bubbles -- slap, a sheet of water, the spray falling back.';
IMPACTS.water.takes={
 A:{name:'Splash, hardly a bubble (your round-2 sliders)',play:x=>splash(x),base:WATER_BASE},
 B:{name:'A bigger splash, more spray',play:x=>splash(x,1.6),base:WATER_BASE},
 C:{name:'Round 2 pick, for comparison (bubbly)',play:x=>water(x,2),base:WATER_BASE},
};
// The flagstick, round 3 (it is solid now: physics.js, FLAGSTICK_*). A
// fibreglass stick knocks rather than rings; the stick sways and its metal
// ferrule chatters in the cup's socket, and the flag snaps. PLACED.
function stick(x,{low=false,glance=false}={}){
 x.hiss(0,{type:'bandpass',f:1800,q:.8,dur:.004,attack:.0003,amp:glance?.4:.7,role:'click',fixed:true});
 x.ring(0,[[BALL,.0025,.4]]);
 if(!glance)x.ring(0,[[420,.02,low?.5:1],[1150,.01,.5],[2400,.004,.3]],{amp:.45});
 else x.ring(0,[[1150,.006,.5]],{amp:.4});
 const n=glance?2:4;
 for(const [dt,a]of [[.03,1],[.075,.6],[.13,.35],[.2,.2]].slice(0,n))x.ring(dt*(low?.7:1),[[3100,.005,.6],[4700,.003,.35]],{amp:.22*a*(low?1.8:1),role:'click'});
 x.hiss(.02,{type:'bandpass',f:900,q:.7,dur:.07,attack:.01,amp:glance?.22:.14,role:'texture'});
}
IMPACTS.flagstick={label:'Flagstick',group:'solid',knobs:['level','pitch','length','bright','click','texture'],note:'New in round 3. The stick in the hole is solid now.',takes:{
 A:{name:'Fibreglass stick: a knock, the ferrule rattling',play:x=>stick(x)},
 B:{name:'Low, near the cup: more rattle',play:x=>stick(x,{low:true})},
 C:{name:'Glancing off: a tick and the flag',play:x=>stick(x,{glance:true})},
}};
// A house, round 3. Four materials; which to use could follow the house's
// model in the game, so the owner may keep more than one. PLACED.
IMPACTS.house={label:'House',group:'solid',knobs:['level','pitch','length','bright','click','body','texture'],note:'New in round 3. Pick one, or keep several for different houses.',takes:{
 A:{name:'Siding: a hollow clack',play:x=>{x.hiss(0,{type:'bandpass',f:2400,q:.7,dur:.005,attack:.0003,amp:.8,role:'click',fixed:true});x.ring(0,[[BALL,.003,.5]]);x.ring(0,[[190,.03,.8,.9],[410,.018,1],[760,.012,.6],[1350,.007,.4]],{amp:.5});x.thump(0,95,.03,.5);}},
 B:{name:'Brick or stone wall: a hard thwack',play:x=>{x.hiss(0,{type:'highpass',f:2500,dur:.0025,attack:.0002,amp:1.1,role:'click',fixed:true});x.ring(0,[[BALL,.004,.7]]);x.ring(0,[[1500,.004,.6],[2600,.004,.8],[4100,.003,.4]],{amp:.45});x.crackle(.002,{dur:.05,rate:300,f:4000,amp:.12,role:'texture'});}},
 C:{name:'Roof: a thunk, then the ball rattling down the shingles',play:x=>{x.hiss(0,{type:'bandpass',f:1500,q:.7,dur:.006,attack:.0004,amp:.7,role:'click',fixed:true});x.ring(0,[[150,.03,.8,.85],[330,.02,.7],[700,.01,.4]],{amp:.5});let t=.12,a=.6;for(let i=0;i<9;i++){x.ring(t,[[R(1800,2600),.003,1],[R(3500,4500),.002,.5]],{amp:.18*a,role:'click'});x.crackle(t,{dur:.04,rate:600,f:3500,amp:.06*a,role:'texture'});t+=R(.05,.11);a*=.9;}x.hiss(t+.05,{type:'bandpass',f:800,q:.6,dur:.05,attack:.004,amp:.12,role:'texture'});}},
 D:{name:'Window: a sharp glassy tink (it does not break)',play:x=>{x.hiss(0,{type:'highpass',f:3500,dur:.002,attack:.0002,amp:.8,role:'click',fixed:true});x.ring(0,[[BALL,.003,.5]]);x.ring(0,[[2200,.03,.6],[3700,.025,.8],[5900,.018,.5],[8300,.012,.3]],{amp:.35});x.ring(0,[[310,.02,.4]],{amp:.4});}},
}};

// THE OWNER SIGNED THESE OFF (13 October 2026: "happy with the sounds with
// the settings in my copy"). Each is the take they chose with their sliders
// folded in, and it is the only take left, so 100% on every slider is exactly
// what they heard. A sound missing from a list was left on take A at 100%.
// Two of their sliders moved nothing (texture on the trunk, which has no
// texture part); kept as they set them, because that is what they heard.
export const FINAL={
 strikes:{driver:['C',{whoosh:1.7,pitch:.81,click:4,body:1.9,bright:1.7,length:.6}],wood:['B',{length:.65,click:2.9,whoosh:1.65}],
  iron:['B',{body:.25,click:2.95,pitch:1.47,level:1.25,whoosh:1.35}],chip:['B',{click:2.25}],putter:['B',{length:.4,click:2.25}]},
 impacts:{green:['B'],fringe:['A'],fairway:['A'],tee:['A'],semi:['A',{texture:.7,length:.6}],rough:['B'],
  sand:['A',{bright:.95,body:1.05,texture:3.2,length:.4,pitch:.7}],trunk:['A',{click:4,length:.2,pitch:.75,texture:2.65}],
  canopy:['A'],rock:['C',{length:.4}],cup:['A',{pitch:.67,length:1.55,click:1.95}],
  // Round 4 (the owner, 13 October 2026): water, the flagstick and the house
  // signed off; one material, brick, for every house. The cup's length was
  // nudged once more on top of round 3's. The house's Thump slider (2.05)
  // moves nothing: the brick take has no thump. Kept, as heard.
  water:['A',{texture:3.4,body:1.95,pitch:.83,length:1.65}],flagstick:['A',{length:.4,click:3.95,pitch:.76}],
  house:['B',{pitch:.66,length:.3,click:.25,body:2.05,texture:1.95}]},
 // The score stings: the marimba (A) for every score, the top three a little
 // lower, and the ace with more mallet.
 scores:{ace:['A',{click:2.15,pitch:.8}],albatross:['A',{pitch:.8}],eagle:['A',{pitch:.8}],birdie:['A'],par:['A'],bogey:['A'],double:['A'],worse:['A']},
};
// The cup was signed off in round 3 and touched again in round 4: fold both.
FINAL.impacts.cup[1]={...FINAL.impacts.cup[1],length:1.55*.95};
for(const [group,table] of [[STRIKES,FINAL.strikes],[IMPACTS,FINAL.impacts]])
 for(const [id,[take,knobs={}]] of Object.entries(table)){
  const t=group[id].takes[take];
  group[id].takes={A:{name:`Signed off (was ${take}: ${t.name})`,play:t.play,base:mergeKnobs(t.base,knobs)}};
  group[id].final=true;
 }

// ---------------------------------------------------------------- scores
// A short musical sting when a hole is finished (round 3), one per score and
// three instruments to choose between -- one instrument for all of them, so
// the set sounds like one game. Good scores rise and brighten, par settles,
// bogeys fall and soften; nothing mocks. No crowd (the owner). Notes are MIDI
// numbers in C major, times in seconds, velocities 0-1. PLACED.
const midi=n=>440*Math.pow(2,(n-69)/12);
export const INSTRUMENTS={
 A:{name:'Marimba: wooden and warm',modes:f=>[[f,.22,1],[4*f,.05,.32],[9.9*f,.012,.1]],mallet:.25},
 B:{name:'Bells: bright and glassy',modes:f=>[[f,.75,1],[2.76*f,.28,.28],[5.4*f,.1,.12],[f*1.002,.75,.4]],mallet:.12},
 C:{name:'Soft electric piano',modes:f=>[[f,.6,1],[f*1.004,.6,.6],[2*f,.3,.35],[3*f,.12,.12],[7.1*f,.025,.15]],mallet:.06},
};
const arp=(notes,step,vel=.8,t0=0)=>notes.map((n,i)=>[t0+i*step,n,vel]);
const chord=(notes,t,vel)=>notes.map(n=>[t,n,vel]);
const sparkle=(n,t0,t1)=>Array.from({length:n},()=>[R(t0,t1),pick([96,98,100,103,105,108]),R(.2,.4)]);
export const SCORES={
 ace:{label:'Hole in one',notes:()=>[...arp([72,76,79,84,88,91],.07),...chord([84,88,91,96],.5,1),...sparkle(5,.8,1.8)]},
 albatross:{label:'Albatross or better',notes:()=>[...arp([72,76,79,84,88],.08),...chord([84,88,91],.46,.9),...sparkle(2,.8,1.3)]},
 eagle:{label:'Eagle',notes:()=>[...arp([67,72,76,79,84],.09),...chord([76,79,84],.5,.75)]},
 birdie:{label:'Birdie',notes:()=>[[0,72,.7],[.11,76,.75],[.22,79,.9],[.38,84,.55]]},
 par:{label:'Par',notes:()=>[[0,67,.6],[.16,72,.75],[.16,76,.3]]},
 bogey:{label:'Bogey',notes:()=>[[0,76,.55],[.2,72,.5]]},
 double:{label:'Double bogey',notes:()=>[[0,75,.5],[.2,72,.45],[.42,68,.4]]},
 worse:{label:'Triple bogey or worse',notes:()=>[[0,72,.45],[.2,71,.4],[.4,70,.38],[.62,69,.36]]},
};
for(const s of Object.values(SCORES)){s.note='';s.knobs=['level','pitch','length','bright','click'];s.takes=Object.fromEntries(Object.entries(INSTRUMENTS).map(([k,v])=>[k,{name:v.name,instrument:k}]));}
for(const [id,[take,knobs={}]] of Object.entries(FINAL.scores)){
 const t=SCORES[id].takes[take];
 SCORES[id].takes={A:{name:`Signed off (${t.name})`,instrument:take,base:knobs}};SCORES[id].final=true;
}
// Which sting a finished hole plays: the same names as scoring.js's
// holeScoreName. A decimal-putting score has no name; it plays the nearest
// whole score's sting rather than falling through to "worse".
export const scoreSting=(strokes,par)=>{
 if(strokes===1)return 'ace';
 const d=Math.round(strokes-par);
 return d<=-3?'albatross':d===-2?'eagle':d===-1?'birdie':d===0?'par':d===1?'bogey':d===2?'double':'worse';
};
export function score(lab,name,{take='A',knobs={},at}={}){
 const T=SCORES[name].takes[take]||SCORES[name].takes.A;
 const I=INSTRUMENTS[T.instrument||take]||INSTRUMENTS.A,t=(at??lab.ctx.currentTime)+.05;
 knobs=mergeKnobs(T.base,knobs);
 const dest=place(lab,{dist:10,wet:.35,until:t+5});
 // Level 0.14: at 0.32 the hole-in-one peaked 5 dB over full scale and every
 // sting averaged louder than a drive (check.mjs, 13 October 2026).
 const x=kit(lab,dest,t,.14,knobs);
 for(const [dt,n,vel] of SCORES[name].notes()){
  const f=midi(n);
  x.ring(dt,I.modes(f),{amp:vel});
  x.hiss(dt,{type:'bandpass',f:Math.min(f*3,9000),q:1,dur:.006,attack:.0005,amp:I.mallet*vel,role:'click',fixed:true});
 }
 lab.sweep();
 return t;
}

// Play one impact. `speed` is the ball's speed into the surface, m/s.
export function impact(lab,what,{take='A',speed=15,knobs={},pan=0,dist=12,at}={}){
 const I=IMPACTS[what],T=I.takes[take]||I.takes.A,t=(at??lab.ctx.currentTime)+.03;
 // PLACED: level as speed^1.1 with 20 m/s as 1; brightness as speed^0.3.
 const a=.8*Math.pow(Math.max(speed,.3)/20,1.1),k=mergeKnobs(T.base,knobs);k.bright=(k.bright??1)*Math.pow(Math.max(speed,.3)/15,.3);
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
 links:{label:'Links: North Sea Links',tempC:14,wind:16,trees:'grass',birds:{gull:2,songbird:1,crow:.5},water:{surf:1},planes:{jet:.6,prop:.3},insects:{},howl:1.6,verb:.05},
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
 // Round 3: shorter, higher and sparser, after measuring three CC0 spring
 // recordings (RESEARCH, round 3): notes about 50 ms (35-90), 55-220 ms apart,
 // 2-4 to a song (up to about 8), mostly 3.4-6.2 kHz, sweeping 0.5-3 kHz.
 // Round 1 sang 40-140 ms notes 20-80 ms apart in phrases of 5-12, from 2 kHz.
 songbird:{dist:[20,110],bout:[1,3],gap:[3,8],make(){const base=R(3400,5200),syl=Array.from({length:2+R(0,3)|0},()=>contourSyl(base));return {base,syl,phrase:phrase(syl.length,R(2,8)|0),tempo:R(.9,1.1)};},
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
 dove:{dist:[25,90],bout:[3,5],gap:[5,9],make(){return {f:R(455,520),hi:R(1.18,1.26),open:R(.9,1.2)};},
  // Mourning dove, round 3, measured against three CC0 recordings (RESEARCH,
  // round 3): base 474 and 517 Hz, the opening rises only to about 1.2-1.25x
  // (560-646 Hz), and the song is 4.1-4.4 s -- an opening of 0.6-1.2 s, then
  // coos of about 0.85, 0.5 and 0.7 s, 0.3 s apart, repeated every 5-9 s.
  // Round 2 sang 370-410 Hz with a 1.6x leap (from one published sonogram,
  // 390/650 Hz) and a 3.4 s song. Still a near-pure tone with soft onsets.
  sing(lab,d,t,b){
   const f=b.f*J(1,.015),hi=f*b.hi;
   const el=(x,dur,c,a,att=.07,rel=.12)=>{note(lab,d,x,{dur,contour:c,amp:a,attack:att,release:rel,harm:.03});
    hiss(lab,d,x,{type:'bandpass',f:c[c.length>>1],q:8,attack:att,hold:Math.max(0,dur-att-rel),dur:rel*2,amp:a*.05});};
   let x=t;
   el(x,b.open,[f*.98,f,f*1.05,hi*.98,hi,hi*.97,f*1.12,f*1.02],.38,.06,.2);x+=b.open+R(.25,.35);
   for(const [dur,a] of [[R(.75,.9),.36],[R(.45,.55),.33],[R(.65,.8),.34]]){el(x,dur,[f*.97,f,f,f*.99,f*.96],a);x+=dur+R(.25,.35);}
   return x-t;}},
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
 geese:{dist:[90,220],make(){return {};},
  // A skein passing over: many honks, crossing from one side to the other.
  flock:true},
};
function contourSyl(base){
 const f=base*R(.8,1.25),k=pick(['up','down','chevron','flat','trill']),dur=R(.03,.1);
 const c=k==='up'?[f*.75,f,f*1.3]:k==='down'?[f*1.3,f,f*.7]:k==='chevron'?[f*.85,f*1.2,f*.9]:k==='trill'?Array.from({length:9},(_,i)=>f*(i%2?1.08:.94)):[f,f*1.02,f];
 return {c,dur,gap:R(.05,.16),harm:Math.random()<.4?R(.05,.2):0};
}
function phrase(n,len){const p=[];let i=0;while(p.length<len){const s=Math.random()<.6?i%n:Math.random()*n|0,r=1+(Math.random()*3|0);for(let j=0;j<r;j++)p.push(s);i++;}return p.slice(0,len);}

// ---- water, round 6: ponds and lakes apart from rivers and creeks (13
// October 2026). The owner turned down every lapping style ("make these sounds
// radically different") and asked for research into what a pond sounds like
// at the shore. What it found (RESEARCH, *Round 6*):
//  - Still pond water makes almost no sound in air. The underwater pond is busy
//    (insects, popping plants -- Bristol, 2023) but that stays underwater; at
//    the edge you hear the reeds, a fish or frog surfacing, a frog calling, and
//    on a bigger lake wind wavelets slapping the stones, the backwash rolling
//    the pebbles.
//  - A brook is thousands of bubbles a second over a hiss. Southampton's
//    simulations: 50 bubbles a second are separate pings and "do not sound
//    like ... a babbling brook"; 2,500 a second with noise "sounds a lot more
//    like rain or a babbling brook". Round 4's creek was 55 a second.
// So these are built SAMPLE BY SAMPLE rather than from a few dozen Web Audio
// nodes: thousands of tiny events a second (bubbles, pebble clicks, reed
// ticks, splashes) written into short pieces of audio, a fifth of a second
// each, queued back to back on the audio clock -- new every time, never a loop.

// Grains. Every one is written straight into the piece's samples; a grain that
// runs past the end of a piece carries on into the next.
const eqPan=p=>{const a=(clamp(p,-1,1)+1)*Math.PI/4;return [Math.cos(a),Math.sin(a)];};
// A bubble, or anything that rings and dies: a sine whose pitch moves from f
// to f*rise over its life, decaying with time-constant tau. Rotated as a
// phasor (four multiplies a sample), its step refreshed every 32 samples.
function grainRing(st,s,f,tau,amp,rise,pan){
 const sr=st.sr,N=Math.min(Math.round(tau*6*sr),sr);if(f>sr*.45||amp<1e-5)return;
 const [gl,gr]=eqPan(pan);st.grains.push({k:0,s,n:0,N,x:1,y:0,d:Math.exp(-1/(tau*sr)),e:amp,f,df:f*(rise-1)/N,gl,gr});
}
// A burst of filtered noise: an attack, then an exponential tail. lp and hp
// are one-pole corners in Hz.
function grainNoise(st,s,{dur,attack=.003,lp=3000,hp=200,amp,pan=0}){
 const sr=st.sr,[gl,gr]=eqPan(pan),A=Math.max(1,Math.round(attack*sr));
 st.grains.push({k:1,s,n:0,N:Math.round((attack+dur*1.6)*sr),A,e:0,peak:amp,d:Math.exp(-4/(dur*sr)),
  a1:1-Math.exp(-2*Math.PI*Math.min(lp,sr*.45)/sr),a2:1-Math.exp(-2*Math.PI*hp/sr),l:0,h:0,gl,gr});
}
function renderGrains(st,L,Rr,idx,P){
 const keep=[];
 for(const g of st.grains){
  const from=Math.max(0,g.s-idx),to=Math.min(P,g.s+g.N-idx);
  if(g.k===0){let {x,y,e,f}=g;const two=2*Math.PI/st.sr;let c=Math.cos(f*two),sn=Math.sin(f*two);
   for(let i=from;i<to;i++){const v=y*e;L[i]+=v*g.gl;Rr[i]+=v*g.gr;const nx=x*c-y*sn;y=x*sn+y*c;x=nx;e*=g.d;
    if(((g.n+=1)&31)===0){f+=g.df*32;c=Math.cos(f*two);sn=Math.sin(f*two);}}
   Object.assign(g,{x,y,e,f});
  }else{let {e,l,h,n}=g;
   for(let i=from;i<to;i++){const w=Math.random()*2-1;l+=g.a1*(w-l);h+=g.a2*(l-h);
    e=n<g.A?g.peak*(n+1)/g.A:e*g.d;n++;const v=(l-h)*e;L[i]+=v*g.gl;Rr[i]+=v*g.gr;}
   Object.assign(g,{e,l,h,n});
  }
  if(g.s+g.N>idx+P)keep.push(g);
 }
 st.grains=keep;
}
// A Poisson process inside one piece: the sample offsets of its events.
function events(rate,P,sr){const out=[];if(rate<=0)return out;let t=wait(rate)*sr;while(t<P){out.push(Math.floor(t));t+=wait(rate)*sr;}return out;}
// A slow random walk, for surges and gusts: Ornstein-Uhlenbeck, mean 0.
const walk=(v,dt,relax,spread)=>v+relax*(0-v)*dt+spread*Math.sqrt(2*relax*dt)*gauss();
// A continuous noise bed, filtered by two one-poles, its level eased across
// the piece from where it was to `level`.
function bed(st,L,Rr,P,{lp,hp,level,key='bed'}){
 const b=st[key]??={l:0,h:0,l2:0,h2:0,lev:0},sr=st.sr,a1=1-Math.exp(-2*Math.PI*Math.min(lp,sr*.45)/sr),a2=1-Math.exp(-2*Math.PI*hp/sr);
 for(let i=0;i<P;i++){const lev=b.lev+(level-b.lev)*i/P;
  b.l+=a1*(Math.random()*2-1-b.l);b.h+=a2*(b.l-b.h);b.l2+=a1*(Math.random()*2-1-b.l2);b.h2+=a2*(b.l2-b.h2);
  L[i]+=(b.l-b.h)*lev;Rr[i]+=(b.l2-b.h2)*lev;}
 b.lev=level;
}
const logn=(median,spread)=>median*Math.exp(gauss()*spread);
const MINN=r=>3.26/r;   // Minnaert, Hz from a radius in metres
// Bubble decay: smaller rings shorter (PLACED, as before).
const btau=f=>.006*Math.sqrt(1000/f);

// The knobs these recipes read: level, pitch (every ring), bright (the
// noise corners and the clicks), texture (beds and hiss), body (the low
// things -- glugs, plops, rumble).
const WK=k=>({level:1,pitch:1,bright:1,texture:1,body:1,...k});

// Round 7 pond helpers. Wind makes the waves bigger and quicker (PLACED:
// size 0.5 + wind/16, period x 1.2 - wind/40), and every wave's size rides a
// slow set of about 25 s so the shore never settles into a beat.
const windSize=o=>clamp(.5+o.wind/16,.4,1.8);
const windPeriod=o=>clamp(1.2-o.wind/40,.6,1.3);
// Where in a swell a bubble falls: quick to build, slower to die (a skewed
// bump peaking about a quarter of the way in).
const swellAt=u=>u<.3?.25*Math.sqrt(u/.3):.25+.75*Math.pow((u-.3)/.7,1.6);
// The water draining back: small, high bubbles thinning out.
function drainFizz(st,s,n,secs,amp){
 for(let i=0;i<n;i++){const f=MINN(R(.0007,.0015))*st.k.pitch;grainRing(st,s+Math.round(Math.pow(Math.random(),1.5)*secs*st.sr),f,btau(f),amp*R(.4,1)*st.k.texture,R(1,1.3),R(-.6,.6));}
}
// Runs `lap(sampleStart, size, pan)` once per wave, on its own uneven clock.
function lapEach(st,idx,P,{period},lap){
 const sr=st.sr,dt=P/sr;st.set=(st.set||0)+dt;st.next??=0;st.next-=dt;
 while(st.next<=0){
  const s=idx+Math.min(P-1,Math.max(0,Math.round((dt+st.next)*sr)));
  lap(s,windSize(st.o)*R(.6,1.2)*(.8+.2*Math.sin(st.set/25*Math.PI*2)),R(-.6,.6));
  st.next+=R(...period)*windPeriod(st.o);
 }
}
export const WATERS={
 // ---------------------------------------------------------- round 7 ponds
 // The owner, on round 6: the rivers and creeks are right; for ponds, "we
 // need to do some lapping sounds using the bubbles from the rivers and
 // creeks instead of the more white noise we have now. I think that is what we
 // are missing." So every sound in these four is a bubble (or, on the pebble
 // shore, a pebble): a lap is a swell of bubbles that rises and dies away, and
 // the water draining back is a fizz of smaller ones. No noise beds. PLACED.
 // SIGNED OFF (the owner, round 8): this one for ponds and lakes.
 lapSwell:{group:'pond',final:'pond',base:{texture:2.55,body:1.3,bright:.95,pitch:.71},name:'Ponds and lakes: the bubbly lap (signed off)',
  spawn(st,idx,P){lapEach(st,idx,P,{period:[1.8,3.6]},(s,size,p)=>{
   const k=st.k,sr=st.sr,D=R(.45,.8)*size;
   for(let i=0,n=Math.round(R(120,260)*size);i<n;i++){const r=clamp(logn(.003,.45),.0012,.009),f=MINN(r)*k.pitch;
    grainRing(st,s+Math.round(swellAt(Math.random())*D*sr),f,btau(f),.015*Math.pow(r/.003,.7)*logn(1,.4)*size*k.body,R(1,1.4),p+R(-.3,.3));}
   drainFizz(st,s+Math.round(D*sr),R(20,50)*size,.4,.006*size);});}},
 // ---------------------------------------------------------- rivers and creeks
 // SIGNED OFF (the owner, round 7): this one for creeks, this one for rivers,
 // each with the owner's sliders as its `base`.
 creekBabble:{group:'river',final:'creek',base:{pitch:1.23,bright:.4,body:.55,texture:.15,level:.65},name:'Creeks: the babbling creek (signed off)',
  spawn(st,idx,P){const k=st.k,o=st.o,sr=st.sr,dt=P/sr;st.surge=walk(st.surge||0,dt,.3,.35);const m=Math.exp(st.surge*.5)*o.flow;
   for(const s of events(1800*m,P,sr)){const r=clamp(logn(.0016,.55),.0004,.008),f=MINN(r)*k.pitch;grainRing(st,idx+s,f,btau(f),.0085*Math.pow(r/.0016,.7)*logn(1,.4),R(1,1.5),R(-.8,.8));}
   // A riffle gulps: a quick cluster of bigger bubbles.
   for(const s of events(3*m,P,sr)){const p=R(-.6,.6);for(let i=0,n=15+(Math.random()*25|0);i<n;i++){const r=clamp(logn(.004,.4),.001,.012),f=MINN(r)*k.pitch;grainRing(st,idx+s+Math.round(R(0,.1)*sr),f,btau(f),.018*k.body,R(1,1.4),p+R(-.15,.15));}}
   bed(st,st.L,st.Rr,P,{lp:3500*k.bright,hp:400,level:.014*m*k.texture});
  }},
 creekMountain:{group:'river',final:'river',base:{texture:.15,bright:1.65,pitch:.61},name:'Rivers: the mountain stream over rocks (signed off)',
  spawn(st,idx,P){const k=st.k,o=st.o,sr=st.sr,dt=P/sr;st.surge=walk(st.surge||0,dt,.4,.3);const m=Math.exp(st.surge*.5)*o.flow;
   for(const s of events(2600*m,P,sr)){const r=clamp(logn(.0011,.5),.0003,.006),f=MINN(r)*k.pitch;grainRing(st,idx+s,f,btau(f),.008*Math.pow(r/.0011,.7)*logn(1,.4),R(1,1.6),R(-.9,.9));}
   for(const s of events(4*m,P,sr))grainNoise(st,idx+s,{dur:R(.05,.15),attack:.004,lp:4000*k.bright,hp:800,amp:.05*k.texture,pan:R(-.8,.8)});
   bed(st,st.L,st.Rr,P,{lp:7000*k.bright,hp:200,level:.048*m*k.texture});
   bed(st,st.L,st.Rr,P,{lp:150,hp:30,level:.12*m*k.body,key:'rumble'});
  }},
};
// Which water plays for which kind of water, as signed off.
export const WATER_FOR=Object.fromEntries(Object.entries(WATERS).filter(([,w])=>w.final).map(([id,w])=>[w.final,id]));
// Plays one water continuously. `opts`: wind (mph), flow (1 = normal); knobs
// as WK, on top of the recipe's own `base`. Live, call schedule() ahead of
// the clock on a timer; offline, once.
export function waterPlayer(lab,{style,to=lab.master,pan=-.3,dist=20,knobs={},opts={}}={}){
 const {ctx}=lab,sr=ctx.sampleRate,P=Math.round(.2*sr);
 let dest=place(lab,{pan,dist,wet:.1,to}),t0=ctx.currentTime+.1,k0=0,idx=Math.round(t0*sr),st=null;
 let recipe=WATERS[style];
 const knobsFor=k=>WK(mergeKnobs(recipe?.base,k));
 const fresh=()=>{st={sr,grains:[],k:knobsFor(knobs),o:{wind:8,flow:1,...opts}};};fresh();
 return {
  schedule(until){
   if(t0+k0*P/sr<ctx.currentTime){t0=ctx.currentTime+.05;k0=0;}
   for(let at=t0+k0*P/sr;at<until;at=t0+(++k0)*P/sr){
    const L=new Float32Array(P),Rr=new Float32Array(P);st.L=L;st.Rr=Rr;
    recipe?.spawn(st,idx,P);renderGrains(st,L,Rr,idx,P);
    const lev=st.k.level;if(lev!==1)for(let i=0;i<P;i++){L[i]*=lev;Rr[i]*=lev;}
    const b=ctx.createBuffer(2,P,sr);b.copyToChannel(L,0);b.copyToChannel(Rr,1);
    const s=ctx.createBufferSource();s.buffer=b;s.connect(dest);s.start(at);lab.track([s],at+.5);
    idx+=P;
   }
   lab.sweep();
  },
  set(o){if('style'in o){recipe=WATERS[o.style];st.grains=[];st.next=null;}if('knobs'in o)st.k=knobsFor(o.knobs);if('opts'in o)Object.assign(st.o,o.opts);
   // Turned and set back without a rebuild: the panner and the air filter
   // glide, so a sound that follows the camera does not click.
   if('pan'in o){pan=o.pan;dest.panner.pan.setTargetAtTime(clamp(pan,-1,1),ctx.currentTime,.4);}
   if('dist'in o){dist=o.dist;dest.gain.setTargetAtTime(clamp(10/Math.max(dist,1),0,2),ctx.currentTime,.4);dest.air.frequency.setTargetAtTime(airCutoff(dist),ctx.currentTime,.4);}},
  stop(){try{dest.disconnect();}catch{}},
 };
}

// ---- night insects, round 2 (RESEARCH, round 2: the owner heard round 1 as
// "really close but not quite right").
//
// Tree crickets, after the snowy tree cricket: a chirp is 8 pulses grouped
// 2+3+3, the last of each group longer, at about 52 pulses a second (the 2,3,3
// grouping and the rate are measured on Riley's tree cricket; the 8 pulses on
// the snowy). The carrier rises with temperature: 3.0 kHz at 15 C to 4.6 kHz
// at 32 C in Oecanthus nigricornis, borrowed for the whole chorus. They chirp
// TOGETHER -- Walker (1969): neighbouring snowy tree crickets synchronise,
// leader and follower changing places -- at Dolbear's rate.
//
// Field crickets on warm nights (18 C and up), over the top: 3 pulses (2-4)
// at a 30 ms period near 4.5-5 kHz, each on its own irregular clock.
const TREE_PULSES=[[0,12],[19,15],[57,12],[76,12],[95,16],[133,12],[152,12],[171,16]];
export const treeCricketHz=c=>clamp(3000+94*(c-15),2500,4800);
function chirp(lab,dest,t,f,pulses,amp){
 const {ctx}=lab,o=ctx.createOscillator(),h=ctx.createOscillator(),hg=ctx.createGain(),g=ctx.createGain();
 hg.gain.value=.06;g.gain.setValueAtTime(0,t);
 // Each pulse is one closing stroke of the wings: a tone that sags a little
 // as the stroke slows, with a faint second harmonic.
 for(const [s,l]of pulses){const x=t+s/1000,e=x+l/1000;
  g.gain.setValueAtTime(0,x);g.gain.linearRampToValueAtTime(amp,x+.003);g.gain.setValueAtTime(amp,e-.004);g.gain.linearRampToValueAtTime(0,e);
  o.frequency.setValueAtTime(f*1.01,x);o.frequency.linearRampToValueAtTime(f*.985,e);h.frequency.setValueAtTime(2*f*1.01,x);h.frequency.linearRampToValueAtTime(2*f*.985,e);}
 const last=pulses[pulses.length-1],end=t+(last[0]+last[1])/1000+.01;
 o.connect(g);h.connect(hg);hg.connect(g);g.connect(dest);o.start(t);h.start(t);o.stop(end);h.stop(end);lab.track([o,h,hg,g],end+.1);
}

// ---- the ambience engine. Everything is scheduled ahead of the audio clock
// by schedule(until): live, a timer calls it every 200 ms looking 1.5 s ahead;
// offline, one call schedules a whole render.
// onSong, if given, hears every bird song as {sp, t, end}: check.mjs uses it
// to prove no two ever overlap.
export function createAmbience(lab,{onEvent=()=>{},onSong=()=>{},to=lab.master}={}){
 const {ctx}=lab,bus=ctx.createGain();bus.gain.value=0;bus.connect(to);
 // The course's own temperature, when the game knows it, rather than the
 // biome's (set({tempC})): crickets and cicadas follow it.
 let tempOverride=null;const temp=()=>tempOverride??S.tempC;
 // Water is heard only near water (owner, round 2). Every water sound runs
 // through this one gain, set from the distance to the nearest water: full
 // within 25 m, falling as 1/distance, gone by 300 m (PLACED). In the game the
 // distance comes from the ball (or camera) and the course's water bodies.
 const waterBus=ctx.createGain();waterBus.gain.value=0;waterBus.connect(bus);
 let waterDist=40,waterKind=null,waterPan=-.3,inland=null;
 // INLAND WATER IS WHATEVER IS NEAREST (round 8): the signed-off sound for a
 // pond or lake, a river or a creek (WATER_FOR), chosen by the kind of water
 // nearest the listener and cross-faded over 1.5 s when that changes. The sea
 // keeps its surf. Without a kind (the lab), the biome's own mix decides.
 function inlandFor(kind){
  const style=WATER_FOR[kind];if(inland?.kind===kind)return;
  if(inland){const old=inland;old.gain.gain.setTargetAtTime(0,ctx.currentTime,.5);setTimeout(()=>{old.player.stop();try{old.gain.disconnect();}catch{}},2500);inland=null;}
  if(!style)return;
  const gain=ctx.createGain();gain.gain.value=0;gain.connect(waterBus);gain.gain.setTargetAtTime(mix.water,ctx.currentTime,.5);
  inland={kind,gain,player:waterPlayer(lab,{style,to:gain,pan:waterPan,dist:20,opts:{wind:windNow(),flow:1}})};
 }
 const seaHere=()=>S.water.surf&&(waterKind?waterKind==='sea':true);
 const inlandKind=()=>waterKind?(waterKind==='sea'?null:waterKind):S.water.stream?'creek':S.water.lake?'pond':null;
 const proximity=d=>d>=300?0:Math.min(1,25/Math.max(d,25))*(1-Math.pow(d/300,2));
 // The wind is set in mph (windMph), not through the mix: one number, one meaning.
 const mix={birds:1,water:1,planes:1,insects:1};
 let S=null,night=false,windMph=null,cursor=0,running=false,layers=[],streams=[],queue=[],birds=[],gust=0,flutter=0,started=0;
 // One bird at a time (owner, round 2): a song starts only after the last one
 // has ended, so no two birds -- and no bird with itself -- ever overlap.
 let birdUntil=0;
 let chorus=null,fields=[];
 const verbSend=ctx.createGain();verbSend.gain.value=0;bus.connect(verbSend);verbSend.connect(lab.verbIn);
 const log=(t,text)=>onEvent({t:t-started,text});
 const at=(t,fn)=>{queue.push([t,fn]);};
 const loop=(type,f,q,gain,pan=0,extra,to=bus)=>{
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain(),p=ctx.createStereoPanner();
  s.buffer=lab.NOISE;s.loop=true;fl.type=type;fl.frequency.value=f;fl.Q.value=q;g.gain.value=gain;p.pan.value=pan;
  let n=fl;if(extra){const e=ctx.createBiquadFilter();e.type=extra[0];e.frequency.value=extra[1];e.Q.value=.5;fl.connect(e);n=e;}
  s.connect(fl);n.connect(g);g.connect(p);p.connect(to);s.start(ctx.currentTime,R(0,11));
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
  // Water beds, all through the water bus.
  if(S.water.surf){layers.surf=loop('lowpass',350,.6,0,-.3,null,waterBus);}
  verbSend.gain.value=S.verb;
  waterBus.gain.setTargetAtTime(proximity(waterDist),ctx.currentTime,.3);
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
  if(layers.surf)layers.surf.g.gain.setTargetAtTime(seaHere()?.07*S.water.surf*mix.water:0,t,.5);
 }
 // A bird's songs go through here. If another song is still going, this one
 // waits for it; a bout continues only after its own song has ended.
 function birdSong(t,b,left,first){
  if(t<birdUntil+.6){at(birdUntil+R(1,3),tt=>birdSong(tt,b,left,first));return;}
  const d=place(lab,{pan:b.pan*J(1,.05),dist:b.dist,wet:.15,to:bus,until:t+30});
  birdUntil=t+BIRD[b.sp].sing(lab,d,t,b.song);onSong({sp:b.sp,t,end:birdUntil});
  if(first)log(t,`${first}${left>0?`, ${left+1} songs`:''}`);
  if(left>0)at(birdUntil+R(...(BIRD[b.sp].gap||[4,10])),tt=>birdSong(tt,b,left-1));
 }
 // Each stream is a Poisson process. A rate of zero parks it at the cursor so
 // it starts from "now" when turned up.
 const stream=(name,rate,fire)=>streams.push({name,rate,fire,next:0});
 function makeStreams(){
  streams=[];
  // About one bird every 25 s by day at the default mix (round 1 was one
  // every 8 s and the owner found it too busy). A bird that comes due while
  // another is singing is dropped, not queued, so birds never pile up.
  stream('bird',()=>night||S.dusk?(S.birds.owl||1)*.02*mix.birds:.04*mix.birds,t=>{
   if(t<birdUntil+1)return;
   const sp=night?pickWeighted({owl:2}):pickWeighted(S.dusk?S.birds:Object.fromEntries(Object.entries(S.birds).filter(([k])=>k!=='owl')));
   if(!sp)return;
   if(BIRD[sp].flock){geese(t);return;}
   let b=birds.find(b=>b.sp===sp&&Math.random()<.7);
   const pop=3+Math.round(2*mix.birds);
   if(!b||Math.random()<.15){b={sp,song:BIRD[sp].make(),pan:R(-.95,.95),dist:R(...BIRD[sp].dist)};birds.push(b);if(birds.length>pop)birds.shift();}
   // A bout: the same bird sings a few times, seconds apart (most once to
   // three times; a dove three to five, as the recordings do).
   const [lo,hi]=BIRD[sp].bout||[1,3];
   birdSong(t,b,lo-1+(Math.random()*(hi-lo+1)|0),`${sp} ${side(b.pan)}, ${b.dist|0} m`);
  });
  stream('leaves',()=>leafOn()&&windNow()>0?3:0,t=>{
   const g=gust/12,type=S.trees;if(g<.15)return;
   const f={broad:3000,conifer:5200,palm:2000,dry:4500}[type],rate={broad:220,conifer:350,palm:60,dry:300}[type]*g;
   crackle(lab,place(lab,{pan:R(-.8,.8),dist:R(8,25),wet:.1,to:bus,until:t+2}),t,{dur:R(.2,.6),rate,f,q:.6,amp:.06*Math.min(g,2),tick:type==='palm'?.006:.002,fade:false});
  });
  // Water events are only scheduled while water can be heard.
  const near=()=>proximity(waterDist)>0;
  stream('surf',()=>seaHere()&&near()?S.water.surf*mix.water/10:0,t=>wave(t));
  stream('plane',()=>{const p=S.planes,w=(p.jet||0)+(p.prop||0);return night?w*mix.planes/600:w*mix.planes/240;},t=>flyover(t,pickWeighted(S.planes)));
  stream('cicada',()=>!night&&S.insects.cicada&&temp()>=24?S.insects.cicada*mix.insects/60:0,t=>cicada(t));
 }
 function side(p){return p<-.33?'left':p>.33?'right':'ahead';}
 function wave(t){
  // A swell builds, breaks and washes out; 8-16 s apart on average.
  const d=R(90,200),dest=place(lab,{pan:R(-.6,.2),dist:d,wet:.1,to:waterBus,until:t+12}),build=R(1.2,2.6),fall=R(3,5),peak=R(.25,.5);
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=lab.NOISE;fl.type='lowpass';
  fl.frequency.setValueAtTime(250,t);fl.frequency.exponentialRampToValueAtTime(R(1600,2600),t+build);fl.frequency.exponentialRampToValueAtTime(500,t+build+fall);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak*.4,t+build*.8);g.gain.linearRampToValueAtTime(peak,t+build);g.gain.setTargetAtTime(0,t+build,fall/3);
  s.connect(fl);fl.connect(g);g.connect(dest);s.start(t,R(0,4));s.stop(t+build+fall*2);lab.track([s,fl,g],t+build+fall*2+.1);
  ring(lab,dest,t+build,[[R(50,70),.3,.5,.8]],{amp:peak*.8,spread:0});
  crackle(lab,dest,t+build+.1,{dur:fall*.8,rate:700,f:5000,q:.5,amp:peak*.25,tick:.002});
 }
 function geese(t){
  // A skein passing over. Round 2: one bird at a time applies here too, so
  // the honks come one after another, never on top of each other.
  if(t<birdUntil+.6){at(birdUntil+R(1,3),geese);return;}
  const dur=R(12,20),dir=Math.random()<.5?-1:1,base=R(380,460);let x=t;
  while(x<t+dur){const u=(x-t)/dur,f=base*R(.9,1.15),near=1-Math.abs(u-.5)*2,h=R(.14,.24),xx=x;
   at(xx,()=>rasp(lab,place(lab,{pan:dir*(u*1.8-.9),dist:220-120*near,wet:.12,to:bus,until:xx+2}),xx,{dur:h,contour:[f*.9,f*1.1,f],amp:.4,formants:[[1000,3,1],[2400,4,.5]],rough:R(25,40),depth:.4,breath:.15,attack:.01,release:.04}));
   x+=h+R(.12,.7);}
  birdUntil=x;onSong({sp:'geese',t,end:x});
  log(t,`geese passing over, ${dir<0?'right to left':'left to right'}`);
 }
 function cicada(t){
  const len=R(8,18),d=place(lab,{pan:R(-.9,.9),dist:R(15,45),wet:.05,to:bus,until:t+len+1});
  const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),am=ctx.createGain(),env=ctx.createGain(),lfo=ctx.createOscillator(),ld=ctx.createGain();
  s.buffer=lab.NOISE;s.loop=true;bp.type='bandpass';bp.frequency.value=R(4800,6200);bp.Q.value=4;
  am.gain.value=.5;lfo.type='square';lfo.frequency.value=R(160,260);ld.gain.value=.5;lfo.connect(ld);ld.connect(am.gain);
  const peak=R(.05,.1);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(peak,t+len*.35);env.gain.setValueAtTime(peak,t+len*.7);env.gain.linearRampToValueAtTime(0,t+len);
  s.connect(bp);bp.connect(am);am.connect(env);env.connect(d);s.start(t,R(0,8));s.stop(t+len+.05);lfo.start(t);lfo.stop(t+len+.05);lab.track([s,bp,am,env,lfo,ld],t+len+.2);
  log(t,`cicada (${len|0} s swell)`);
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
   mk('sawtooth',1,.5);mk('square',.5,.25);mk('sawtooth',2.02,.12);
   const s=ctx.createBufferSource(),nf=ctx.createBiquadFilter(),ng=ctx.createGain();s.buffer=lab.NOISE;s.loop=true;nf.type='bandpass';nf.frequency.value=600;nf.Q.value=.6;ng.gain.value=.4;s.connect(nf);nf.connect(ng);ng.connect(src);s.start(t0,R(0,11));s.stop(t0+T+.1);nodes.push(s,nf,ng);}
  lab.track(nodes,t0+T+.5);
  log(t,`${jet?'jet':'small prop plane'} ${off<0?'to the left':'to the right'}, ${Math.round(H)} m up, ${Math.round(T)} s`);
 }
 function scheduleCrickets(until){
  const rate=dolbear(temp())/60,on=night&&mix.insects>0&&rate>0;
  if(!on){chorus=null;fields=[];return;}
  const from=Math.max(cursor,ctx.currentTime);
  if(!chorus){
   const n=Math.round(3+3*mix.insects),f=treeCricketHz(temp());
   chorus={next:from+R(.2,1),n:0,members:Array.from({length:n},()=>({f:f*J(1,.025),lag:0,d:place(lab,{pan:R(-.9,.9),dist:R(8,45),wet:.08,to:bus})}))};
   fields=temp()>=18?Array.from({length:mix.insects>1.2?2:1},()=>({f:R(4500,5000),rate:R(1.2,2.5),next:from+R(0,3),d:place(lab,{pan:R(-.8,.8),dist:R(5,25),wet:.06,to:bus})})):[];
  }
  while(chorus.next<until){
   // Every ~20 chirps the order shuffles: a new leader, the rest within a few
   // tens of milliseconds of it.
   if(chorus.n++%20===0)for(const m of chorus.members)m.lag=clamp(gauss()*.012,-.025,.025);
   for(const m of chorus.members)if(Math.random()<.95)chirp(lab,m.d,chorus.next+.03+m.lag+gauss()*.003,m.f,TREE_PULSES,.045);
   chorus.next+=1/rate*J(1,.03);
  }
  for(const c of fields)while(c.next<until){
   const n=Math.random()<.7?3:Math.random()<.5?2:4;
   chirp(lab,c.d,c.next,c.f*J(1,.01),Array.from({length:n},(_,k)=>[k*30,18]),.06);
   c.next+=1/c.rate*J(1,.15)+(Math.random()<.03?R(2,8):0);
  }
 }
 function schedule(until){
  if(!running)return;
  if(cursor<ctx.currentTime)cursor=ctx.currentTime;
  for(;cursor<until;cursor+=.25)windStep(cursor,.25);
  for(const s of streams){const r=s.rate();if(r<=0){s.next=until;continue;}if(s.next<ctx.currentTime)s.next=ctx.currentTime+wait(r);while(s.next<until){s.fire(s.next);s.next+=wait(r);}}
  // Items can queue more items (the next song of a bout), so re-sort each time.
  for(;;){queue.sort((a,b)=>a[0]-b[0]);if(!queue.length||queue[0][0]>=until)break;const [t,f]=queue.shift();f(t);}
  scheduleCrickets(until);
  const kind=proximity(waterDist)>0?inlandKind():null;
  if(kind)inlandFor(kind);else if(inland)inlandFor(null);
  if(inland){inland.player.set({opts:{wind:windNow(),flow:1}});inland.player.schedule(Math.min(until,ctx.currentTime+.6));}
  lab.sweep();
 }
 let timer=null;
 const api={bus,mix,
  get scene(){return S;},
  start(sceneName,{live=true}={}){api.stop(true);S=SCENES[sceneName];running=true;gust=windNow();flutter=0;birds=[];queue=[];birdUntil=0;chorus=null;fields=[];
   started=cursor=ctx.currentTime;build();makeStreams();
   bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(1,ctx.currentTime+2);
   if(live){timer=setInterval(()=>schedule(ctx.currentTime+1.5),200);schedule(ctx.currentTime+1.5);}},
  stop(quick){running=false;clearInterval(timer);timer=null;if(inland){inland.player.stop();try{inland.gain.disconnect();}catch{}inland=null;}const now=ctx.currentTime,old=layers.slice(),oldBus=[...(chorus?.members||[]).map(m=>m.d),...fields.map(c=>c.d)];
   bus.gain.cancelScheduledValues(now);bus.gain.setValueAtTime(bus.gain.value,now);bus.gain.linearRampToValueAtTime(0,now+(quick?.05:1));
   for(const L of old){try{L.s.stop(now+(quick?.06:1.1));}catch{}}
   chorus=null;fields=[];layers=[];
   lab.track(old.flatMap(L=>[L.s,L.fl,L.g,L.p]).concat(oldBus.filter(Boolean)),now+1.3);},
  // Offline renders schedule everything up front.
  schedule,
  set(o){if('night'in o)night=o.night;if('wind'in o)windMph=o.wind;if('tempC'in o)tempOverride=o.tempC;
   if('waterDist'in o){waterDist=o.waterDist;waterBus.gain.setTargetAtTime(proximity(waterDist),ctx.currentTime,.5);}
   if('waterKind'in o)waterKind=o.waterKind;
   if('waterPan'in o){waterPan=o.waterPan;inland?.player.set({pan:waterPan});}
   if('water'in o&&inland)inland.gain.gain.setTargetAtTime(o.water,ctx.currentTime,.3);
   for(const k of Object.keys(mix))if(k in o)mix[k]=o[k];
   if(('insects'in o||'night'in o)&&chorus){lab.track(chorus.members.map(m=>m.d).concat(fields.map(c=>c.d)),ctx.currentTime+2);chorus=null;fields=[];}},
  get night(){return night;},
  get wind(){return windMph??S?.wind;},
  get gust(){return gust;},
  get waterLevel(){return proximity(waterDist);},
  trigger(kind){const t=ctx.currentTime+.3;if(kind==='jet'||kind==='prop')flyover(t,kind);else if(kind==='geese')at(t,geese);else if(kind==='wave'&&S?.water.surf)wave(t);else if(kind==='cicada')cicada(t);
   else if(BIRD[kind]){const b={sp:kind,song:BIRD[kind].make(),pan:R(-.8,.8),dist:R(...BIRD[kind].dist)};at(t,tt=>birdSong(tt,b,0,`${kind} ${side(b.pan)}, ${b.dist|0} m (on request)`));}},
 };
 return api;
}
