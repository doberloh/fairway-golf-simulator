import net from 'node:net';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';
import {parseLaunchMessage,readDeviceStatus,MPH} from '../src/physics.js';

// TCP does not preserve JSON boundaries: accept fragments and concatenated objects.
export class JsonFramer{
 constructor(){this.buffer='';}
 push(chunk){
  this.buffer+=chunk;if(Buffer.byteLength(this.buffer)>65536)throw Error('Message exceeds 64 KB.');
  let depth=0,start=-1,string=false,escaped=false,out=[],consumed=0;
  for(let i=0;i<this.buffer.length;i++){
   const c=this.buffer[i];
   if(start<0){if(/\s/.test(c)){consumed=i+1;continue;}if(c!=='{')throw Error('Expected JSON object.');start=i;depth=1;continue;}
   if(string){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')string=false;continue;}
   if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){out.push(JSON.parse(this.buffer.slice(start,i+1)));consumed=i+1;start=-1;}
  }
  this.buffer=this.buffer.slice(consumed);return out;
 }
}
// Which browser origins may drive the bridge.
//
// PARSED, NOT PATTERN-MATCHED. The obvious version is a regex over the whole
// origin string, and the obvious version is wrong: `http://192.168.1.50.evil.com`
// contains "192.168.1.50" and would pass. Handing the string to `URL` and testing
// the hostname EXACTLY removes that entire class of mistake -- there is no suffix
// to smuggle anything onto.
//
// Loopback plus the three RFC 1918 private blocks. Nothing routable from the
// internet is in here, so a page has to already be on your network to try.
// It is still a real widening: the bridge has no authentication, so anything on
// the LAN that can reach the port can drive the simulator. That is the trade for
// playing on a phone while the bridge runs on the desktop.
export function isLocalOrigin(origin){
 // A file:// page sends "null". The portable HTML is meant to be opened that way.
 if(origin==='null')return true;
 if(typeof origin!=='string'||!origin)return false;
 let u;
 try{u=new URL(origin);}catch{return false;}
 if(u.protocol!=='http:'&&u.protocol!=='https:')return false;
 const host=u.hostname.replace(/^\[|\]$/g,'');
 if(host==='localhost'||host==='::1')return true;
 // `hostname` is already CANONICAL: the parser resolves octal, hex, integer and
 // shorthand forms to four plain octets, and throws on the malformed ones. That
 // is the other half of why this parses rather than pattern-matches -- every
 // alternate spelling of an address arrives here in one form, so a range check
 // is the whole test. Measured: 010.0.0.1 -> 8.0.0.1 (public, refused),
 // 0x0a.0.0.1 and 167772161 -> 10.0.0.1 (private, allowed), 10.0.0 -> 10.0.0.0.
 const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
 if(!m)return false;
 const n=m.slice(1).map(Number);
 if(n.some(o=>o>255))return false;
 const [a,b]=n;
 if(a===127)return true;                  // 127.0.0.0/8  loopback
 if(a===10)return true;                   // 10.0.0.0/8
 if(a===192&&b===168)return true;         // 192.168.0.0/16
 if(a===172&&b>=16&&b<=31)return true;    // 172.16.0.0/12
 return false;
}

// THE GAME THE BRIDGE SERVES, found beside the bridge rather than assumed.
// From the source tree the bridge is `bridge/server.mjs` and the game is
// `dist/index.html`. Shipped to a player, the bridge is one bundled file,
// `fairway-bridge.mjs`, in the portable archive's "Launch monitor" folder, and
// the game is `Fairway.html` one folder up -- or beside it, if a player moved
// it. So every place it could be is tried, in that order, and FAIRWAY_HTML
// names any other.
export const PAGE_CANDIDATES = ['Fairway.html', 'index.html', '../Fairway.html', '../dist/index.html'];
// RUN AS `run_fairway_server`, the program in the download (tools/build-server.mjs:
// this bundle compiled with Bun into one executable, nothing to install). Inside
// one, this file's own URL is a path in Bun's virtual filesystem, not a folder on
// disk, so the game is looked for beside the EXECUTABLE instead.
// Bun's virtual root is `B:/~BUN/root/` on Windows (the `~` arrives percent-
// encoded) and `/$bunfs/root/` elsewhere, so the URL is decoded before it is read.
export const COMPILED = typeof process.versions.bun === 'string' && /\/~BUN\/|\/\$bunfs\//i.test(decodeURIComponent(import.meta.url));
const HERE = COMPILED ? pathToFileURL(path.dirname(process.execPath) + path.sep).href : import.meta.url;
async function readGame(){
 const tries = process.env.FAIRWAY_HTML ? [process.env.FAIRWAY_HTML] : PAGE_CANDIDATES.map(c => new URL(c, HERE));
 for (const t of tries) { try { return await readFile(t); } catch {} }
 return null;
}
// THE WEB MANIFEST, so a phone that opens the game from this server can add it
// to its home screen as an app, with its icon and without the browser's bars.
// The game links `manifest.webmanifest` beside itself whenever it is served
// (main.js); the manifest carries its icons inside it as data URLs, so this one
// file is all it needs. The build puts it in the bundle (globalThis
// __FAIRWAY_MANIFEST__, tools/build-bridge.mjs); from the source tree it is read
// from dist/. Until this, the bridge answered it with a 404, and a phone could
// only bookmark the page.
async function readManifest(){
 if (typeof globalThis.__FAIRWAY_MANIFEST__ === 'string') return globalThis.__FAIRWAY_MANIFEST__;
 for (const c of ['manifest.webmanifest', '../dist/manifest.webmanifest']) { try { return await readFile(new URL(c, HERE)); } catch {} }
 return null;
}
// THIS computer's address on the home network, found rather than typed, for
// the link the bridge prints for a phone: a player should not have to look up
// their computer's address to play from one. Private IPv4 addresses only, and the HOME network's first: VPNs and
// virtual machines add adapters with private addresses of their own, and on
// the machine this was written on a VPN's 10.x address came before the real
// 192.168.x one -- picked blind, the phone would have been told an address it
// cannot reach. So adapters named like a VPN or a virtual machine are skipped,
// and 192.168/16 (what home routers hand out) is preferred to 172.16/12
// (Docker and WSL) and 10/8 (VPNs). Every candidate is returned, best first,
// so the bridge can print the others in case the guess is wrong.
const VIRTUAL=/vpn|nord|lynx|tailscale|zerotier|wireguard|wg\d|tun|tap|utun|vethernet|hyper-v|virtualbox|vbox|vmware|vmnet|docker|wsl|bridge\d|br-|veth|loopback/i;
export function lanAddresses(interfaces = os.networkInterfaces()){
 const found=[];
 for (const [name, list] of Object.entries(interfaces)) for (const a of list || []) {
  if (a.internal || (a.family !== 'IPv4' && a.family !== 4) || a.address.startsWith('127.')) continue;
  if (!isLocalOrigin(`http://${a.address}`)) continue;
  const rank=(VIRTUAL.test(name)?10:0)+(a.address.startsWith('192.168.')?0:a.address.startsWith('172.')?1:2);
  found.push({name, address: a.address, rank});
 }
 return found.sort((x, y) => x.rank - y.rank);
}
export const lanAddress = interfaces => lanAddresses(interfaces)[0]?.address ?? null;
// WHAT THE BRIDGE TELLS THE PLAYER, for the address it is listening on. The
// shipped start script listens on EVERY address (`FAIRWAY_HTTP_HOST=all`, which
// is 0.0.0.0), so one script serves the computer and a phone at once; it used to
// be two scripts, one per case, and the "for a phone" one listened on the home
// network ONLY, so the computer's own browser could not use 127.0.0.1 while it
// ran. The operating system's firewall decides whether a phone gets in: allowed
// on a private network, the phone plays; refused, the computer still does.
export function addressLines(httpHost, port, lan = lanAddresses()){
 if (httpHost === '0.0.0.0') {
  const lines = [`On this computer, open http://127.0.0.1:${port}`];
  if (lan.length) {
   lines.push(`On a phone or tablet on the same Wi-Fi, open http://${lan[0].address}:${port}`);
   if (lan.length > 1) lines.push(`If the phone cannot reach that, try: ${lan.slice(1).map(a => `http://${a.address}:${port} (${a.name})`).join(', ')}`);
  } else lines.push('No home-network address found, so only this computer can play. Join the same Wi-Fi as the phone and start the bridge again.');
  lines.push('There is no password: anything on your home network that can reach this computer can drive the simulator.');
  return lines;
 }
 if (httpHost !== '127.0.0.1') return [`Browser access is open to ${httpHost} — anything on your network that can reach it can drive the simulator.`, `On a phone on the same Wi-Fi, open http://${httpHost}:${port}`];
 return [];
}
export async function createBridge({tcpPort=1921,httpPort=1922,host='127.0.0.1',tcpHost=host,httpHost=host,onLog=console.log,verbose=false}={}){
 const sockets=new Set(),pending=new Map();let browser=null,player={Handed:'RH',Club:'DR'},ready=false,seq=0;
 // The DEVICE's own view of itself, relayed on to the browser. Null until a
 // status frame says otherwise, which is different from “connected but idle”.
 let device=null;
 // VERBOSE IS OFF BY DEFAULT and everything below is a no-op without it. A
 // connector that is working sends a shot every thirty seconds and a heartbeat
 // in between; logging all of it drowns the one line that matters. A connector
 // that is NOT working is almost impossible to diagnose without it, because the
 // failure is usually in bytes nobody ever sees.
 const stamp=()=>new Date().toISOString().slice(11,23);
 const log=(...parts)=>{if(verbose)onLog(`${stamp()} ${parts.join(' ')}`);};
 // Payloads are capped: a malformed connector can send 64 KB of anything, and a
 // debug log that floods the terminal is its own kind of unreadable.
 const brief=v=>{const t=typeof v==='string'?v:JSON.stringify(v);return t.length>400?t.slice(0,400)+`… (${t.length} chars)`:t;};
 // EVERY RESPONSE CARRIES THE PLAYER BLOCK, which is what GSPro does. Omitting
 // it was visible in a real connector's log: it parses a Player out of each
 // reply and was printing its own empty defaults --
 //   {"Code":200,...,"Player":{"Handed":"","Club":"","DistanceToTarget":0}}
 // -- on every heartbeat. Connectors that track club changes from the response
 // stream rather than only from the 201 would never see one.
 const respond=(socket,code,message)=>{
  log('-> device',code,message);
  if(!socket.destroyed)socket.write(JSON.stringify({Code:code,Message:message,Player:player}));
 };
 const notify=()=>{if(browser?.readyState===WebSocket.OPEN)browser.send(JSON.stringify({type:'status',deviceConnected:sockets.size>0,ready,device}));};
 const sendPlayer=socket=>{if(!socket.destroyed)socket.write(JSON.stringify({Code:201,Message:'Player information',Player:player}));};
 const tcp=net.createServer(socket=>{
  sockets.add(socket);socket.setEncoding('utf8');socket.setTimeout(120000);const framer=new JsonFramer();
  log(`device connected from ${socket.remoteAddress}:${socket.remotePort} (${sockets.size} open)`);
  notify();sendPlayer(socket);if(ready)respond(socket,202,'Ready');
  socket.on('data',chunk=>{
   log('<- device raw',brief(chunk));
   // FRAMING errors close the connection; VALIDATION errors do not. A desynced
   // stream cannot be recovered, so dropping it is right. One unusable shot is
   // a different thing entirely -- the stream after it is fine, and closing the
   // socket put connectors into a reconnect loop where every retry sent the
   // same rejected frame again.
   let messages;
   try{messages=framer.push(chunk);}
   catch(e){log('!! framing error, closing:',e.message);respond(socket,501,e.message);socket.end();return;}
   for(const data of messages){
    let shot;
    try{shot=parseLaunchMessage(data);}
    catch(e){log('!! rejected, connection kept:',e.message,brief(data));respond(socket,501,e.message);continue;}
    if(!shot){
     const was=JSON.stringify(device),now=readDeviceStatus(data);
     if(now)device=now;
     log('   status/heartbeat, no ball data',now?`(ready ${now.ready}, ball ${now.ballDetected})`:'');
     // Only wake the browser when something actually changed: a connector
     // heartbeats every second or two and the browser does not need that.
     if(JSON.stringify(device)!==was)notify();
     respond(socket,200,'Status received');continue;}
    log(`   shot #${shot.id??'?'} from ${shot.device}:`,
     `${(shot.speed/MPH).toFixed(1)} mph`,`${shot.vla.toFixed(1)}° launch`,
     `${shot.hla.toFixed(1)}° dir`,`${Math.round(shot.spin)} rpm`,`axis ${shot.spinAxis.toFixed(1)}°`);
    if(!browser||browser.readyState!==WebSocket.OPEN||!ready){log(`   not ready (browser ${browser?'open':'absent'}, armed ${ready})`);respond(socket,503,'Simulator not ready; arm monitor and finish current shot.');continue;}
    if(pending.size){respond(socket,503,'A shot is awaiting acknowledgment.');continue;}
    const requestId=String(++seq),timer=setTimeout(()=>{pending.delete(requestId);respond(socket,504,'Browser acknowledgment timed out; shot status unknown.');},4000);
    pending.set(requestId,{socket,timer});browser.send(JSON.stringify({type:'shot',payload:data,requestId}));
   }
  });
  socket.on('timeout',()=>{log('device idle 120s, closing');socket.end();});
  socket.on('error',e=>log('device socket error:',e.message));
  socket.on('close',()=>{sockets.delete(socket);if(!sockets.size)device=null;log(`device disconnected (${sockets.size} open)`);notify();});
 });
 const server=http.createServer(async(req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,deviceConnected:sockets.size>0,browserConnected:!!browser,ready}));return;}
  if(req.url==='/manifest.webmanifest'){const m=await readManifest();if(m){res.writeHead(200,{'content-type':'application/manifest+json','cache-control':'no-store'});res.end(m);}else{res.writeHead(404);res.end();}return;}
  if(req.url!=='/'&&req.url!=='/index.html'){res.writeHead(404);res.end();return;}
  const html=await readGame();
  if(html){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);}
  else{res.writeHead(503,{'content-type':'text/plain'});res.end('The game was not found. Keep Fairway.html in the same folder as run_fairway_server (or one folder up from fairway-bridge.mjs). From the source folder, run npm run build.');}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:65536});
 server.on('upgrade',(req,socket,head)=>{
  const origin=req.headers.origin;
  const localOrigin=isLocalOrigin(origin);
  if(!localOrigin||browser){log('refused browser upgrade:',browser?'one browser already has the bridge':`non-local origin ${origin}`);socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 wss.on('connection',client=>{
  browser=client;ready=false;log('browser connected');notify();
  client.on('message',buffer=>{try{const d=JSON.parse(buffer.toString());if(d.type==='player'){
   if(!['RH','LH'].includes(d.Player?.Handed)||!['DR','3W','5I','7I','9I','PW','SW','PT'].includes(d.Player?.Club))throw Error('Invalid player data.');
   player=d.Player;ready=d.ready===true;
   log(`browser: ${player.Handed} ${player.Club}, armed ${ready}`);
   for(const socket of sockets){sendPlayer(socket);if(ready)respond(socket,202,'Ready');}notify();
  }else if(d.type==='ack'){
   const p=pending.get(d.requestId);
   log(`browser ack #${d.requestId}: ${d.accepted===true?'accepted':'refused'}${d.reason?' · '+d.reason:''}${p?'':' (no longer pending)'}`);
   if(p){clearTimeout(p.timer);pending.delete(d.requestId);respond(p.socket,d.accepted===true?200:503,String(d.reason||'Shot handled').slice(0,180));}
  }}catch{client.close(1008,'Invalid bridge message');}});
  client.on('close',()=>{log('browser disconnected');if(browser===client){browser=null;ready=false;}for(const[id,p]of pending){clearTimeout(p.timer);respond(p.socket,503,'Browser disconnected; shot status unknown.');pending.delete(id);}});client.on('error',()=>{});
 });
 const listen=(server,port,bindHost=host)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,bindHost,resolve);});
 try{await listen(tcp,tcpPort,tcpHost);await listen(server,httpPort,httpHost);}catch(e){tcp.close();server.close();wss.close();throw e;}
 if(verbose)onLog('Verbose logging on: every message in and out is printed.');
 else onLog('Set FAIRWAY_LOG=debug for per-message logging if a connector will not talk.');
 onLog(`Fairway bridge: http://${httpHost==='0.0.0.0'?'127.0.0.1':httpHost}:${server.address().port} · launch monitor TCP ${tcpHost}:${tcp.address().port}`);
 for(const line of addressLines(httpHost,server.address().port))onLog(line);
 return {tcpPort:tcp.address().port,httpPort:server.address().port,async close(){for(const p of pending.values())clearTimeout(p.timer);pending.clear();for(const s of sockets)s.destroy();for(const c of wss.clients)c.terminate();await Promise.all([new Promise(r=>tcp.close(r)),new Promise(r=>server.close(r))]);wss.close();}};
}
if(COMPILED||process.argv[1]===fileURLToPath(import.meta.url)){
 // The program in the download listens on the home network by default: anyone
 // running it is setting up a simulator, usually with a phone or a tablet too.
 // From the source tree it stays on this computer unless asked.
 let httpHost=process.env.FAIRWAY_HTTP_HOST||(COMPILED?'all':'127.0.0.1');
 if(COMPILED){
  console.log('');
  console.log('  Fairway is running. Keep this window open while you play; close it to stop.');
  console.log('  Launch monitor: in your connector (rēlā, in GSPro mode), set the address to');
  console.log(`  127.0.0.1 and the port to ${process.env.FAIRWAY_TCP_PORT||1921}.`);
  console.log('');
 }
 // `all` is what the shipped start script sets: every address, so the computer
 // and a phone on the home network can both reach it.
 if(httpHost.toLowerCase()==='all')httpHost='0.0.0.0';
 createBridge({tcpHost:process.env.FAIRWAY_TCP_HOST||'127.0.0.1',tcpPort:Number(process.env.FAIRWAY_TCP_PORT||1921),httpPort:Number(process.env.FAIRWAY_HTTP_PORT||1922),httpHost,verbose:/^(1|on|debug|verbose|true)$/i.test(process.env.FAIRWAY_LOG||'')
  ||process.argv.slice(2).some(a=>['--debug','--verbose','-v'].includes(a))}).then(b=>{process.on('SIGINT',async()=>{await b.close();process.exit(0);});}).catch(e=>{
   console.error('Could not start Fairway:',e.message);
   if(/EADDRINUSE/.test(e.code||e.message))console.error('Another copy is probably already running -- look for its window, or close it and try again.');
   process.exitCode=1;
   // Started by double-clicking, the window would close before anyone could
   // read why. Wait for Enter when there is a person at a terminal.
   if(COMPILED&&process.stdin.isTTY){console.error('Press Enter to close.');process.stdin.resume();process.stdin.once('data',()=>process.exit(1));}
  });
}
