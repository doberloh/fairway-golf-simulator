// LAUNCH MONITOR SETUP, LAID OUT AS THE APPROVED MOCKUP (the 1.0 interface,
// 17 October 2026; mockup `r10('lm-setup')`, PROJECT_HANDOFF *The 1.0
// lobby* -- the same approach).
//
// Two columns: on the left three numbered steps, each ticked when it is done
// (the bridge is running, a connector is talking to it, the monitor is armed),
// then the Arm switch; on the right the status -- the ball light (Ready,
// Finding ball, No monitor), the bridge and device rows, the address, the last
// shot, Reconnect and Try a sample shot. Under both, what the old panel said
// about connectors and the secure-page limit.
//
// MOVED, NOT REBUILT, like the lobby: renderPanel('monitor') writes and wires
// the old panel; this moves its controls (#armMonitor's label, #bridgeUrl,
// #connectBridge, #testJson and its JSON box) into place and keeps the ids,
// labels and button words the smoke journeys use. `paint` redraws the ticks
// and the status from the game's state whenever main.js says it changed.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const MPH = 0.44704;

// The three steps and whether each is done. Pure.
// THE LAUNCH MONITORS rēlā CONNECTS (UI/UX pass V3; the owner: "the connectable
// ecosystem should just be every launch monitor that rela supports, and
// combine into one box"). From rēlā's own FAQ, its Device Requirements table,
// read 21 October 2026 (https://docs.rela.golf/rela/faq/; RESEARCH.md
// *Launch-monitor interfaces*), in its words; "Other" (a community plugin) is
// left out because rēlā itself says it is no promise a device works. Support
// is rēlā's: none of these has been on a mat with Fairway.
export const RELA_MONITORS = ['Foresight GC2', 'SkyTrak', 'FlightScope Mevo+ and Mevo Gen2', 'FlightScope Xi and X2', 'Garmin R10', 'Full Swing KIT', 'Square', 'Nova', 'GolfJoy'];
export const RELA_DOCS = 'https://docs.rela.golf/';

export function monitorSteps({connected = false, device = null, armed = false} = {}) {
 return [
  {n: 1, title: 'START THE SERVER', line: 'Open run_fairway_server from the download and keep its window open.', done: connected},
  {n: 2, title: 'POINT YOUR CONNECTOR HERE', line: 'In any Open Connect v1 connector: this computer, port 1921.', done: connected && !!device},
  {n: 3, title: 'ARM FOR LIVE SHOTS', line: 'Shots are only taken while armed.', done: connected && armed},
 ];
}

// The ball light: the same three words as the round screen's light, and what
// to do about each. Pure.
export function monitorLight({connected = false, device = null} = {}) {
 if (!connected) return {state: 'off', title: 'NO MONITOR', line: 'START THE SERVER, THEN CONNECT'};
 if (!device) return {state: 'red', title: 'NO MONITOR', line: 'WAITING FOR A CONNECTOR'};
 return device.ballDetected ? {state: 'green', title: 'READY', line: 'BALL ON THE MAT'} : {state: 'amber', title: 'FINDING BALL', line: 'TEE UP THE NEXT ONE'};
}

// The last shot's numbers as the mockup sets them ("156.2 MPH · 11.8° · 2,610
// RPM"), from a launch in metres per second, degrees and rpm. Pure.
export function lastShotLine(shot) {
 if (!shot || !Number.isFinite(shot.speed)) return '—';
 const parts = [`${(shot.speed / MPH).toFixed(1)} MPH`];
 if (Number.isFinite(shot.vla)) parts.push(`${shot.vla.toFixed(1)}°`);
 if (Number.isFinite(shot.spin)) parts.push(`${Math.round(shot.spin).toLocaleString('en-US')} RPM`);
 return parts.join(' · ');
}

// `view()` returns {connected, device, armed, shot}.
export function buildMonitorSetup(root, view, doc = globalThis.document) {
 const q = id => root.querySelector('#' + id);
 const arm = q('armMonitor'), url = q('bridgeUrl'), connect = q('connectBridge');
 if (!arm || !url || !connect || root.querySelector('.lm')) return null;
 const lm = make(doc, 'div', 'lm');
 const left = make(doc, 'section', 'lm-col lm-steps'), right = make(doc, 'section', 'lm-col lm-status'), foot = make(doc, 'section', 'lm-foot');

 // THE STEPS, then the Arm switch (the old label and checkbox, moved).
 left.append(make(doc, 'h3', 'lm-head', 'THREE STEPS'));
 const steps = monitorSteps().map(s => {
  const el = make(doc, 'div', 'lm-step', `<span class="lm-n">${s.n}</span><span class="lm-what"><strong>${s.title}</strong><span>${s.line}</span></span><span class="lm-tick"></span>`);
  left.append(el);
  return el;
 });
 const armRow = make(doc, 'div', 'lm-arm');
 armRow.append(arm.closest('label') || arm);
 left.append(armRow);

 // THE STATUS.
 right.append(make(doc, 'h3', 'lm-head', 'STATUS'));
 const light = make(doc, 'div', 'lm-light', '<i></i><strong></strong><span></span>');
 const row = (label, cls) => { const r = make(doc, 'div', 'lm-row ' + (cls || ''), `<span class="lm-k">${label}</span><span class="lm-v"></span>`); right.append(r); return r.querySelector('.lm-v'); };
 right.append(light);
 const bridge = row('BRIDGE'), device = row('DEVICE');
 const address = row('ADDRESS', 'lm-address');
 address.append(url);
 const last = row('LAST SHOT');
 const buttons = make(doc, 'div', 'lm-buttons');
 buttons.append(connect);
 const sample = q('testJson');
 if (sample) buttons.append(sample);
 right.append(buttons);
 for (const id of ['jsonError', 'monitorStatus']) { const n = q(id); if (n) right.append(n); }
 // The sample shot's JSON stays editable, folded away (PLACED: the mockup
 // has only the button).
 const json = q('shotJson');
 if (json) {
  const fold = make(doc, 'details', 'lm-json', '<summary>Edit the sample shot</summary>');
  fold.append(json.closest('label') || json);
  right.append(fold);
 }

 // EVERYTHING ELSE the old panel said -- the intro, how to start the bridge,
 // the secure-page note, the connectors -- along the foot (PLACED).
 for (const n of [...root.querySelectorAll(':scope>.panel-lead>*,:scope>.panel-section>*,:scope>.panel-columns>.panel-section>*,:scope>.panel-tabs~*')]) {
  if (n.closest('.lm')) continue;
  if (n.matches('h3,p,ul')) foot.append(n);
 }
 // What it needs, then which monitors rēlā connects, as one box -- under the
 // Arm switch, where the steps column ended short of the status column and left
 // a gap (audits 2 and 3).
 for (const n of [...foot.querySelectorAll(':scope>p')]) left.append(n);
 const works = root.querySelector('.lm-works');
 if (works) left.append(works);

 // A heading whose section was all moved away goes too.
 for (const h of foot.querySelectorAll(':scope>h3')) if (!h.nextElementSibling || h.nextElementSibling.tagName === 'H3') h.remove();

 lm.append(left, right);
 if (foot.children.length) lm.append(foot);
 root.classList.add('lm-root');
 root.append(lm);

 const paint = () => {
  const s = view();
  monitorSteps(s).forEach((step, i) => {
   steps[i].classList.toggle('done', step.done);
   steps[i].querySelector('.lm-tick').textContent = step.done ? '✓ DONE' : 'WAITING';
  });
  armRow.classList.toggle('on', !!s.armed);
  const l = monitorLight(s);
  light.dataset.state = l.state;
  light.querySelector('strong').textContent = l.title;
  light.querySelector('span').textContent = l.line;
  bridge.textContent = s.connected ? '✓ CONNECTED' : 'NOT RUNNING';
  bridge.classList.toggle('ok', !!s.connected);
  device.textContent = s.connected && s.device ? '✓ TALKING' : 'NONE YET';
  device.classList.toggle('ok', !!(s.connected && s.device));
  last.textContent = lastShotLine(s.shot);
 };
 paint();
 return {paint};
}
