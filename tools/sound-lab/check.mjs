// Renders every sound in the lab offline and prints its levels.
//
//   node tools/sound-lab/build.mjs && node tools/sound-lab/check.mjs [--seconds 60]
//
// Nobody can listen from a script, but a script can catch what listening
// would: a take that is silent, one that throws, one far louder than its
// neighbours, NaN in the output, or an ambience that is all wind. The limiter
// is switched off for the render so the raw peaks show. Exits non-zero on a
// silent, broken or NaN sound, and if any two bird songs overlap (the
// owner's rule since round 2: one bird at a time).
import {chromium} from 'playwright';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import {existsSync} from 'node:fs';

const here=dirname(fileURLToPath(import.meta.url)),page=join(here,'..','..','docs','reports','sounds','index.html');
if(!existsSync(page)){console.error('Build the report first: node tools/sound-lab/build.mjs');process.exit(1);}
const secs=Number(process.argv[process.argv.indexOf('--seconds')+1])||60;
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const tab=await browser.newPage();
const errors=[];tab.on('pageerror',e=>errors.push(e.message));tab.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await tab.goto(pathToFileURL(page).href);
const rows=await tab.evaluate(async secs=>{
 const L=window.soundLab,SR=48000,out=[];
 const stats=(buf,name,extra={})=>{let peak=0,sum=0,n=0,nan=0,last=0,zc=0;const th=Math.pow(10,-60/20);
  for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);let prev=0;for(let i=0;i<d.length;i++){const v=d[i];if(!Number.isFinite(v)){nan++;continue;}const a=Math.abs(v);if(a>peak)peak=a;sum+=v*v;n++;if(a>th)last=Math.max(last,i);if((v>=0)!==(prev>=0))zc++;prev=v;}}
  const db=v=>v>0?20*Math.log10(v):-Infinity;
  return {name,peak:db(peak),rms:db(Math.sqrt(sum/n)),len:last/SR,bright:zc/2/(n/buf.numberOfChannels/SR)/buf.numberOfChannels,nan,...extra};};
 const render=async(seconds,fn)=>{const ctx=new OfflineAudioContext(2,SR*seconds,SR),lab=L.createSoundLab(ctx);lab.out.ratio.value=1;lab.out.threshold.value=0;const r=fn(lab,ctx);return [await ctx.startRendering(),r];};
 for(const [id,C]of Object.entries(L.STRIKES))for(const take of Object.keys(C.takes)){
  const [b]=await render(2,lab=>L.strike(lab,id,{take,at:0}));out.push(stats(b,`strike ${id} ${take}`));}
 for(const [id,C]of Object.entries(L.IMPACTS))for(const take of Object.keys(C.takes)){
  const [b]=await render(3,lab=>L.impact(lab,id,{take,speed:15.6,at:0}));out.push(stats(b,`impact ${id} ${take}`));}
 for(const name of Object.keys(L.SCENES))for(const night of [false,true]){
  const ev=[],songs=[];const [b]=await render(secs,(lab)=>{const a=L.createAmbience(lab,{onEvent:e=>ev.push(e.text),onSong:s=>songs.push(s)});a.start(name,{live:false});a.set({night});a.schedule(secs);return a;});
  songs.sort((x,y)=>x.t-y.t);let overlap=0;for(let i=1;i<songs.length;i++)if(songs[i].t<songs[i-1].end)overlap++;
  out.push(stats(b,`ambience ${name}${night?' night':''}`,{events:ev.length,songs:songs.length,overlap}));}
 const [b]=await render(150,lab=>{const a=L.createAmbience(lab);a.start('midwest',{live:false});a.set({birds:0,water:0,insects:0,wind:0});a.trigger('jet');a.schedule(150);});
 out.push(stats(b,'jet flyover alone'));
 const [p]=await render(90,lab=>{const a=L.createAmbience(lab);a.start('midwest',{live:false});a.set({birds:0,water:0,insects:0,wind:0});a.trigger('prop');a.schedule(90);});
 out.push(stats(p,'prop flyover alone'));
 return out;
},secs);
await browser.close();
const f=(v,w=7)=>(Number.isFinite(v)?v.toFixed(1):String(v)).padStart(w);
console.log('sound'.padEnd(34)+'   peak dB    rms dB   length s  zero-x Hz  events  songs');
let bad=0;
for(const r of rows){const flag=r.overlap?`  <-- ${r.overlap} BIRDS OVERLAPPED`:r.nan||r.peak<-60?'  <-- BROKEN':r.peak>0?'  <-- over full scale before the limiter':'';if(r.nan||r.peak<-60||r.overlap)bad++;
 console.log(r.name.padEnd(34)+f(r.peak,10)+f(r.rms,10)+f(r.len,11)+f(r.bright,11)+(r.events!=null?String(r.events).padStart(8)+String(r.songs).padStart(7):'')+flag);}
if(errors.length){console.log('\nPage errors:\n'+errors.join('\n'));bad++;}
process.exit(bad?1:0);
