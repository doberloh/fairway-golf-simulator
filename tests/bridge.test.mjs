import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {JsonFramer,createBridge,isLocalOrigin} from '../bridge/server.mjs';
import {parseLaunchMessage,readDeviceStatus} from '../src/physics.js';
test('JSON framing handles split, combined and quoted braces',()=>{const f=new JsonFramer();assert.deepEqual(f.push('{"a":"}'),[]);assert.deepEqual(f.push('{","b":{"c":3}} \n{"d":4}'),[{a:'}{',b:{c:3}},{d:4}]);assert.throws(()=>f.push('oops'));});
test('bridge validates, relays, acknowledges and reports device state',async()=>{const b=await createBridge({tcpPort:0,httpPort:0,onLog:()=>{}});let ws,tcp;try{
 ws=new WebSocket(`ws://127.0.0.1:${b.httpPort}`,{origin:'http://localhost:5173'});await once(ws,'open');
 const messages=[];ws.on('message',data=>messages.push(JSON.parse(data)));
 ws.send(JSON.stringify({type:'player',Player:{Handed:'LH',Club:'PT'},ready:true}));
 tcp=net.connect(b.tcpPort,'127.0.0.1');await once(tcp,'connect');let received='';tcp.on('data',d=>received+=d);
 const data=JSON.stringify({DeviceID:'Test',ShotNumber:1,APIversion:'1',BallData:{Speed:5,VLA:0,HLA:0,TotalSpin:0,SpinAxis:0},ShotDataOptions:{ContainsBallData:true}});
 await new Promise(r=>setTimeout(r,30));tcp.write(data.slice(0,30));tcp.write(data.slice(30));
 const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}assert.fail('Timed out waiting for bridge');};
 await wait(()=>messages.some(m=>m.type==='shot'));const shot=messages.find(m=>m.type==='shot');assert.equal(shot.payload.BallData.Speed,5);ws.send(JSON.stringify({type:'ack',requestId:shot.requestId,accepted:true,reason:'Played'}));await wait(()=>received.includes('Played'));assert(received.includes('"Code":200'));assert(received.includes('"Handed":"LH"'));assert(messages.some(m=>m.type==='status'&&m.deviceConnected));
 }finally{tcp?.destroy();ws?.terminate();await b.close();}});
test('bridge rejects nonlocal browser origins',async()=>{const b=await createBridge({tcpPort:0,httpPort:0,onLog:()=>{}});try{const ws=new WebSocket(`ws://127.0.0.1:${b.httpPort}`,{origin:'https://untrusted.example'});const[e]=await once(ws,'error');assert.match(e.message,/403/);}finally{await b.close();}});

// A connector in the field sent its idle frame with the ShotDataOptions fields
// at the TOP LEVEL rather than nested, and with no BallData at all. Read
// strictly that is a malformed shot; GSPro accepts it, so this must too. It was
// rejected with a 501, which closed the socket, so the connector reconnected and
// sent the same frame again forever.
test('a status frame is accepted whether its options are nested or flat', () => {
 const flat = {ContainsBallData: false, ContainsClubData: false,
  LaunchMonitorIsReady: false, LaunchMonitorBallDetected: false, IsHeartBeat: false};
 assert.equal(parseLaunchMessage(flat), null, 'a flat idle frame must be ignored, not rejected');
 assert.equal(parseLaunchMessage({...flat, LaunchMonitorIsReady: true, LaunchMonitorBallDetected: true}), null);
 assert.equal(parseLaunchMessage({ShotDataOptions: {ContainsBallData: false}}), null, 'and the nested form still works');
 assert.equal(parseLaunchMessage({ShotDataOptions: {IsHeartBeat: true}}), null);
});

test('flat options do not stop a real shot being read', () => {
 const shot = parseLaunchMessage({Units: 'Yards', ContainsBallData: true,
  BallData: {Speed: 152, VLA: 8, HLA: -1.2, TotalSpin: 3500, SpinAxis: -4}});
 assert.ok(shot, 'a shot alongside flat options must still parse');
 assert.ok(Math.abs(shot.speed / 0.44704 - 152) < 1e-9);
 assert.equal(shot.hla, -1.2);
});

test('a message carrying none of the known keys is still an error', () => {
 // Widening the status check must not turn every malformed payload into a
 // silently ignored one.
 assert.throws(() => parseLaunchMessage({DeviceID: 'x', Units: 'Yards'}), /BallData is missing/);
 assert.throws(() => parseLaunchMessage({}), /BallData is missing/);
});

test('a rejected shot does not close the connection, a broken stream does', async () => {
 const bridge = await createBridge({tcpPort: 0, httpPort: 0, onLog: () => {}});
 try {
  const sock = net.createConnection({host: '127.0.0.1', port: bridge.tcpPort});
  sock.setEncoding('utf8');
  let closed = false;
  sock.on('data', () => {});
  sock.on('close', () => { closed = true; });
  await new Promise(r => sock.once('connect', r));

  // Unusable shot: the stream after it is fine, so the socket must survive.
  sock.write(JSON.stringify({Units: 'Yards', BallData: {Speed: 152, VLA: 8, TotalSpin: 3500, SpinAxis: -4}}));
  await new Promise(r => setTimeout(r, 200));
  assert.equal(closed, false, 'one unusable shot must not drop the connection');

  // Desynced stream: unrecoverable, so it must.
  sock.write('this is not json at all');
  await new Promise(r => setTimeout(r, 250));
  assert.equal(closed, true, 'a stream that cannot be framed must be dropped');
  sock.destroy();
 } finally { await bridge.close(); }
});

// A real connector parses a Player block out of EVERY reply, not just the 201,
// and was printing its own empty defaults on each heartbeat because the bridge
// only sent Code and Message. GSPro includes it; connectors that track club
// changes from the response stream would otherwise never see one.
test('every response carries the current player, not just the 201', async () => {
 const bridge = await createBridge({tcpPort: 0, httpPort: 0, onLog: () => {}});
 let ws, sock;
 try {
  ws = new WebSocket(`ws://127.0.0.1:${bridge.httpPort}`, {origin: 'http://127.0.0.1:5173'});
  await once(ws, 'open');
  ws.send(JSON.stringify({type: 'player', Player: {Handed: 'LH', Club: '9I'}, ready: false}));
  await new Promise(r => setTimeout(r, 120));

  sock = net.createConnection({host: '127.0.0.1', port: bridge.tcpPort});
  sock.setEncoding('utf8');
  const seen = [];
  sock.on('data', d => { for (const line of d.split(/(?<=})(?={)/)) seen.push(JSON.parse(line)); });
  await once(sock, 'connect');
  await new Promise(r => setTimeout(r, 120));
  sock.write(JSON.stringify({ContainsBallData: false, IsHeartBeat: true}));
  await new Promise(r => setTimeout(r, 200));

  const status = seen.find(m => m.Code === 200);
  assert.ok(status, 'the heartbeat should be acknowledged');
  assert.deepEqual(status.Player, {Handed: 'LH', Club: '9I'},
   'a 200 must report the live player, not nothing');
  for (const m of seen) {
   assert.ok(m.Player, `code ${m.Code} came back without a Player block`);
  }
 } finally {
  sock?.destroy(); ws?.close(); await bridge.close();
 }
});

// The device's own readiness never reached the browser: `parseLaunchMessage`
// returns null for status frames and the bridge only replied 200. The game
// could not tell "no monitor" from "monitor hunting for a ball" from "ball on
// the mat", which is precisely what a player standing over a shot needs.
test('device readiness is read from either option shape', () => {
 assert.deepEqual(readDeviceStatus({LaunchMonitorIsReady: true, LaunchMonitorBallDetected: true}),
  {ready: true, ballDetected: true});
 assert.deepEqual(readDeviceStatus({ShotDataOptions: {LaunchMonitorIsReady: true, LaunchMonitorBallDetected: false}}),
  {ready: true, ballDetected: false});
 assert.deepEqual(readDeviceStatus({ContainsBallData: false, ContainsClubData: false,
  LaunchMonitorIsReady: false, LaunchMonitorBallDetected: false, IsHeartBeat: true}),
  {ready: false, ballDetected: false}, "a connector's plain idle frame still reports state");
 // A shot is not a status frame, and neither is a message that says nothing.
 assert.equal(readDeviceStatus({Units: 'Yards', BallData: {Speed: 150}}), null);
 assert.equal(readDeviceStatus({IsHeartBeat: true}), null);
 assert.equal(readDeviceStatus('not an object'), null);
});

test('the browser is told when the ball is detected, and only when it changes', async () => {
 const bridge = await createBridge({tcpPort: 0, httpPort: 0, onLog: () => {}});
 let ws, sock;
 try {
  ws = new WebSocket(`ws://127.0.0.1:${bridge.httpPort}`, {origin: 'http://127.0.0.1:5173'});
  const seen = [];
  ws.on('message', m => { const d = JSON.parse(m); if (d.type === 'status') seen.push(d); });
  await once(ws, 'open');
  await new Promise(r => setTimeout(r, 120));

  sock = net.createConnection({host: '127.0.0.1', port: bridge.tcpPort});
  sock.setEncoding('utf8'); sock.on('data', () => {});
  await once(sock, 'connect');
  await new Promise(r => setTimeout(r, 150));
  assert.equal(seen.at(-1).deviceConnected, true, 'a connected device is reported');

  const beat = o => sock.write(JSON.stringify({ContainsBallData: false, IsHeartBeat: true, ...o}));
  beat({LaunchMonitorIsReady: true, LaunchMonitorBallDetected: false});
  await new Promise(r => setTimeout(r, 180));
  assert.deepEqual(seen.at(-1).device, {ready: true, ballDetected: false});

  // A connector heartbeats every second or two. An unchanged state must not
  // wake the browser, or the HUD redraws forever for nothing.
  const quiet = seen.length;
  beat({LaunchMonitorIsReady: true, LaunchMonitorBallDetected: false});
  await new Promise(r => setTimeout(r, 180));
  assert.equal(seen.length, quiet, 'an unchanged heartbeat must not be relayed');

  beat({LaunchMonitorIsReady: true, LaunchMonitorBallDetected: true});
  await new Promise(r => setTimeout(r, 180));
  assert.deepEqual(seen.at(-1).device, {ready: true, ballDetected: true});

  sock.destroy();
  await new Promise(r => setTimeout(r, 250));
  assert.equal(seen.at(-1).device, null, 'a departed device leaves no stale state behind');
  assert.equal(seen.at(-1).deviceConnected, false);
 } finally { sock?.destroy(); ws?.close(); await bridge.close(); }
});

// Which browser origins may drive the bridge. A near-miss here does not fail
// loudly -- it quietly lets the internet in -- so the refusals matter more than
// the acceptances and are tested first.
test('a private-network origin is accepted and everything else is not', () => {
 const allow = [
  'http://127.0.0.1:1922', 'http://localhost:5173', 'http://[::1]:1922',
  'http://192.168.1.50:1922', 'http://192.168.0.1', 'https://192.168.4.7:8443',
  'http://10.0.0.5:1922', 'http://10.255.255.254',
  'http://172.16.0.1', 'http://172.31.255.255', 'http://172.20.10.3:1922',
  // The parser canonicalises before the range check sees anything, so every
  // alternate spelling of a private address arrives as four octets. Measured,
  // not assumed: 0x0a.0.0.1 and 167772161 are both 10.0.0.1; 10.0.0 is 10.0.0.0.
  'http://0x0a.0.0.1', 'http://167772161', 'http://10.0.0',
 ];
 for (const o of allow) assert.equal(isLocalOrigin(o), true, `${o} should be allowed`);

 // 'null' is what a file:// page sends, and the portable HTML is opened that way.
 assert.equal(isLocalOrigin('null'), true);

 const refuse = [
  // The whole reason this parses rather than pattern-matches: each of these
  // CONTAINS a private address and a regex over the raw string would pass them.
  'http://192.168.1.50.evil.com', 'http://10.0.0.5.attacker.net',
  'http://evil.com/?host=192.168.1.1', 'http://192.168.1.1.nip.io',
  'http://notlocalhost.com', 'http://localhost.evil.com',
  // Neighbouring addresses just outside the private blocks.
  'http://172.15.0.1', 'http://172.32.0.1', 'http://11.0.0.1', 'http://193.168.1.1',
  // Public addresses.
  'http://8.8.8.8', 'https://example.com', 'http://1.1.1.1:1922',
  // Octal: the parser turns 010.0.0.1 into 8.0.0.1, which is public. Refused
  // for the right reason rather than by a special case.
  'http://010.0.0.1',
  // Malformed, out of range, or not an origin at all. These make URL throw.
  'http://192.0168.1.1', 'http://999.1.1.1', 'http://10.0.0.0.1',
  'ws://192.168.1.50:1922', 'file:///C:/x.html', '', 'undefined', null, undefined, 42, {},
 ];
 for (const o of refuse) assert.equal(isLocalOrigin(o), false, `${JSON.stringify(o)} should be refused`);
});

test('the bridge refuses an upgrade from a public origin and accepts a LAN one', async () => {
 const bridge = await createBridge({tcpPort: 0, httpPort: 0, onLog: () => {}});
 try {
  // A public origin is turned away even though the socket is reachable.
  const bad = new WebSocket(`ws://127.0.0.1:${bridge.httpPort}`, {origin: 'http://evil.example.com'});
  const [err] = await once(bad, 'error');
  assert.ok(err, 'a public origin must not get a socket');

  // A private one is let in, which is the change.
  const good = new WebSocket(`ws://127.0.0.1:${bridge.httpPort}`, {origin: 'http://192.168.1.50:1922'});
  await once(good, 'open');
  good.close();
 } finally { await bridge.close(); }
});

// "FOR A PHONE" FINDS THE HOME NETWORK, NOT THE VPN. On the machine this was
// written on, a VPN adapter's 10.8.0.2 came before the real 192.168.1.20, and
// the first version of `lanAddress` would have told the phone the VPN's.
test('lanAddress prefers the home network over VPN and virtual adapters', async () => {
 const {lanAddress, lanAddresses} = await import('../bridge/server.mjs');
 const v4 = address => [{address, family: 'IPv4', internal: false}];
 const machine = {
  WgTunnel: v4('10.8.0.2'),
  'vEthernet (WSL)': v4('172.20.16.1'),
  Ethernet: v4('192.168.1.20'),
  'Loopback Pseudo-Interface 1': [{address: '127.0.0.1', family: 'IPv4', internal: true}],
 };
 assert.equal(lanAddress(machine), '192.168.1.20');
 assert.deepEqual(lanAddresses(machine).map(a => a.address), ['192.168.1.20', '172.20.16.1', '10.8.0.2']);
 // A real home network on 10.x still wins over a VPN on 10.x.
 assert.equal(lanAddress({'Wi-Fi': v4('10.0.0.23'), WgTunnel: v4('10.8.0.2')}), '10.0.0.23');
 // Public addresses are never offered, and no private address means none.
 assert.equal(lanAddress({eth0: v4('203.0.113.9')}), null);
 assert.equal(lanAddress({}), null);
});
