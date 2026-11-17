// A TEST COPY OF THE GAME THAT REPORTS BACK. Serves the built page to a phone
// or tablet on the home network with a measuring script added, and writes
// what the device sends back to files. The owner, 17 November 2026: "Im
// totally fine with test builds passing network traffic back to the server in
// the form of debug info! That makes my job easier and then i dont need to
// copy paste things back to you." (AGENTS.md, *A test copy may report back*.)
//
//   node tools/phone-probe.mjs                     # dist/index.html on port 1923
//   node tools/phone-probe.mjs --script probe.js   # plus a measuring script of your own
//   node tools/phone-probe.mjs --page other.html --port 1924 --minutes 60
//
// WHY IT EXISTS. On 17 November the iPhone's main menu scrolled sideways after
// a fix that passed every smoke journey: Chrome's phone emulation lays out at
// two fixed sizes and never zooms in on a tapped typing box. A copy like this
// one, opened on the phone, found both causes in two readings -- a grid
// column spreading on a screen under 500 tall (the keyboard up), and the
// phone's own 1.78x zoom (PROJECT_HANDOFF, *The main menu's one column is the
// screen's width*).
//
// WHAT THE PAGE SENDS, as JSON to POST /report, each written to
// bench/probe/<time>-<n>-<tag>.json (git-ignored, never committed: a reading
// can hold the player's name from the screen):
//   - `layout` readings 8 s and 20 s after load, after a turn or resize, and
//     whenever the yellow strip at the foot is tapped: the window, the visual
//     viewport and its zoom, the page's width, and every element reaching
//     past the screen's sides;
//   - every uncaught error, refused promise and console.error / console.warn;
//   - whatever a `--script` file sends with `fairwayProbe.send(tag, data)`.
//
// THE SHIPPED GAME NEVER HAS THIS. The script is added to the page in memory
// as it is served; dist/, the release and src/ are untouched, and smoke still
// fails on any network request the real game makes.
//
// It runs on the DEVICE, so the PC's graphics card is not involved; the
// PC-side rules still hold (nothing while the owner is gaming). It stops by
// itself after --minutes (30 by default) so it cannot be left running; stop
// it sooner when the turn ends.
import http from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {lanAddresses} from '../bridge/server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1];};
const page = path.resolve(ROOT, flag('page', 'dist/index.html'));
const port = Number(flag('port', 1923));
const minutes = Number(flag('minutes', 30));
const extra = flag('script', null);
const outDir = path.join(ROOT, 'bench', 'probe');
const MAX_BODY = 1 << 20;

// Plain ES5 inside the page: an old phone's browser must not fail on the probe
// before it can report anything.
const PROBE = `
(function(){
 var n=0;
 function send(tag,data){try{var x=new XMLHttpRequest();x.open('POST','/report?tag='+encodeURIComponent(tag)+'&n='+(++n));
  x.setRequestHeader('content-type','application/json');x.send(JSON.stringify({tag:tag,at:new Date().toISOString(),data:data}));}catch(e){}}
 function name(el){var c=typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/ +/).join('.'):'';return el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+c;}
 function layout(){
  var de=document.documentElement,W=de.clientWidth,over=[],all=document.querySelectorAll('body *');
  for(var i=0;i<all.length;i++){var el=all[i];if(el.id==='probeStrip')continue;var b=el.getBoundingClientRect();if(!b.width&&!b.height)continue;
   var s=getComputedStyle(el);if(s.display==='none')continue;
   if(b.right>W+0.5||b.left<-0.5)over.push({el:name(el),left:Math.round(b.left),right:Math.round(b.right),width:Math.round(b.width),position:s.position,visibility:s.visibility,whiteSpace:s.whiteSpace,text:(el.textContent||'').trim().slice(0,50)});}
  var app=document.getElementById('app'),vv=window.visualViewport;
  return {userAgent:navigator.userAgent,window:[innerWidth,innerHeight],screen:[screen.width,screen.height],pixelRatio:devicePixelRatio,
   visualViewport:vv?{width:vv.width,height:vv.height,scale:vv.scale,left:vv.offsetLeft,top:vv.offsetTop}:null,
   pageWidth:de.scrollWidth,clientWidth:W,mode:app&&app.dataset.mode,uiZoom:getComputedStyle(de).getPropertyValue('--ui-zoom').trim(),
   focused:document.activeElement?name(document.activeElement):null,overCount:over.length,over:over.slice(0,60)};
 }
 function strip(text){var d=document.getElementById('probeStrip');if(!d){d=document.createElement('div');d.id='probeStrip';
  d.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,.8);color:#ff0;font:12px/1.3 monospace;padding:6px;word-break:break-all';
  d.addEventListener('click',function(){reading('tap')});document.body.appendChild(d);}d.textContent='PROBE '+text+' (tap to send a reading)';}
 function reading(tag){var r=layout();send('layout-'+tag,r);
  strip(tag+': screen '+r.clientWidth+', page '+r.pageWidth+', zoom '+(r.visualViewport?r.visualViewport.scale.toFixed(2):'?')+', past the edge '+r.overCount);}
 window.addEventListener('error',function(e){send('error',{message:e.message,source:e.filename,line:e.lineno,column:e.colno,stack:e.error&&e.error.stack});});
 window.addEventListener('unhandledrejection',function(e){var r=e.reason;send('rejection',{message:String(r&&r.message||r),stack:r&&r.stack});});
 ['error','warn'].forEach(function(k){var old=console[k];console[k]=function(){try{send('console-'+k,{args:[].slice.call(arguments).map(function(a){try{return typeof a==='string'?a:JSON.stringify(a)}catch(e){return String(a)}})});}catch(e){}return old.apply(console,arguments);};});
 var t=null;function later(tag){clearTimeout(t);t=setTimeout(function(){reading(tag)},1200);}
 window.addEventListener('resize',function(){later('resize')});
 window.addEventListener('orientationchange',function(){later('turned')});
 window.addEventListener('load',function(){setTimeout(function(){reading('8s')},8000);setTimeout(function(){reading('20s')},20000);});
 window.fairwayProbe={send:send,layout:layout,reading:reading};
})();`;

let html = await readFile(page, 'utf8');
const script = `<script>${PROBE}</script>` + (extra ? `<script>${await readFile(path.resolve(extra), 'utf8')}</script>` : '');
const end = html.lastIndexOf('</body>');
html = end < 0 ? html + script : html.slice(0, end) + script + html.slice(end);
await mkdir(outDir, {recursive: true});

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const safe = s => String(s || 'report').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'report';
const server = http.createServer((req, res) => {
 const url = new URL(req.url, 'http://x');
 if (req.method === 'POST' && url.pathname === '/report') {
  let body = '', size = 0, refused = false;
  req.on('data', c => {size += c.length; if (size > MAX_BODY) {refused = true; req.destroy();} else body += c;});
  req.on('end', async () => {
   if (refused) return;
   const file = path.join(outDir, `${stamp()}-${safe(url.searchParams.get('n'))}-${safe(url.searchParams.get('tag'))}.json`);
   await writeFile(file, body);
   let line = body.slice(0, 160);
   try {const r = JSON.parse(body), d = r.data || {};
    line = d.clientWidth != null ? `screen ${d.clientWidth}, page ${d.pageWidth}, zoom ${d.visualViewport?.scale?.toFixed?.(2)}, window ${d.window}, past the edge ${d.overCount}` : JSON.stringify(d).slice(0, 160);
   } catch {}
   console.log(`${r_tag(url)}: ${line}  -> ${path.relative(ROOT, file)}`);
   res.writeHead(204); res.end();
  });
  return;
 }
 if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
  res.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'}); res.end(html); return;
 }
 res.writeHead(404); res.end();
});
const r_tag = url => safe(url.searchParams.get('tag'));
server.listen(port, '0.0.0.0', () => {
 console.log(`Test copy of ${path.relative(ROOT, page)} with the probe, writing to ${path.relative(ROOT, outDir)}`);
 for (const a of lanAddresses()) console.log(`  on a phone: http://${a.address}:${port}`);
 console.log(`Stops by itself in ${minutes} minutes.`);
});
setTimeout(() => {console.log('Time is up; stopping.'); server.close(); process.exit(0);}, minutes * 60_000).unref?.();
