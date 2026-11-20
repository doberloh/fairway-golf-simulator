// THE ONLINE SHEET (online play, 19 November 2026; PLAN.md *How it would work
// for a player*). One sheet, by what is happening: choosing to host or join,
// hosting (the code, who is knocking, who is in), knocking, and waiting in a
// room for the host to start. HTML strings only; main.js `renderOnline` draws
// it and wires the ids. tests/ui-online.test.mjs.
import {showRoomCode} from './online/room-code.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const STATUS_WORDS = {idle: 'Not connected', connecting: 'Connecting…', open: 'Connected', retrying: 'Connection lost · trying again…', closed: 'Closed'};

// No relay address anywhere: it is built in (online/relay-address.js).
// `s`: {stage: 'start'|'host'|'knocking'|'guest', code, golfers:
// [{id, name}], who, input, knocks: [{member, name, canPlay}], members:
// [{member, name, state, seat: 'playing'|'next'|'watching'|null, canSeat}],
// phase ('lobby'|'playing', the host's), hostName, status, error, note, course}
export function onlineSheet(s) {
 const error = `<p class="field-error" id="onlineError" role="alert">${esc(s.error || '')}</p>`;
 const status = `<p class="online-status" data-state="${esc(s.status || 'idle')}"><span class="online-light" aria-hidden="true"></span>${esc(STATUS_WORDS[s.status] || STATUS_WORDS.idle)}</p>`;
 // Mid-round (`seat`, the host's view): playing, seated from the next tee, or
 // watching, with the host's buttons to seat a watcher or think again.
 const SEAT_WORDS = {playing: 'PLAYING', next: 'FROM THE NEXT TEE', watching: 'WATCHING'};
 const seatButton = m => m.state !== 'in' ? ''
  : m.seat === 'watching' && m.canSeat ? `<button class="secondary" data-seat="${esc(m.member)}">Seat from the next tee</button>`
  : m.seat === 'next' ? `<button class="secondary" data-unseat="${esc(m.member)}">Keep watching</button>` : '';
 const people = (rows, host) => `<ul class="online-people">${host ? `<li><span class="online-who">${esc(host)}</span><small>HOST</small></li>` : ''}${rows.map(m => `<li data-state="${esc(m.state)}"${m.seat ? ` data-seat-state="${esc(m.seat)}"` : ''}><span class="online-who">${esc(m.name)}</span><small>${m.state === 'away' ? 'CONNECTION LOST' : SEAT_WORDS[m.seat] || 'IN THE ROOM'}</small>${seatButton(m)}</li>`).join('')}</ul>`;
 if (s.stage === 'host') {
  const playing = s.phase === 'playing';
  const knock = k => playing
   ? `${k.canPlay ? `<button class="primary" data-admit-play="${esc(k.member)}">Let in to play</button>` : ''}<button class="${k.canPlay ? 'secondary' : 'primary'}" data-admit="${esc(k.member)}">Let in to watch</button>`
   : `<button class="primary" data-admit="${esc(k.member)}">Let in</button>`;
  return `<p>Read this code to your friends, or send it by text. They choose <b>Play online</b>, then <b>Join a room</b>, and type it in. You let each one in by name.</p>
  <div class="online-code" aria-label="Room code"><b id="onlineCodeText">${esc(showRoomCode(s.code))}</b><button class="secondary" id="onlineCopy"><i data-lucide="copy"></i> Copy</button></div>
  ${status}
  ${s.knocks?.length ? `<h3>Knocking</h3><ul class="online-knocks">${s.knocks.map(k => `<li><span class="online-who">${esc(k.name)}</span>${knock(k)}<button class="secondary" data-refuse="${esc(k.member)}">Turn away</button></li>`).join('')}</ul>` : ''}
  <h3>In the room</h3>${people(s.members || [], s.hostName)}
  ${playing ? '<p class="note">Anyone let in now watches the round. Seat a watcher and they play from the next tee, four golfers at most; someone who left the round gets their own golfer and card back. To close the room, leave the round from the menu.</p>'
   : `${s.members?.length ? '' : '<p class="note">Nobody yet. The course and format are chosen once your friends are in.</p>'}`}
  ${error}
  ${playing ? '' : `<button class="primary" id="onlineChoose"${s.members?.length ? '' : ' disabled'}>Choose the course and start <i data-lucide="arrow-right"></i></button>
  <button class="secondary" id="onlineClose">Close the room</button>`}
  <p class="note">The room is private: the code is its key, the online service only passes sealed messages it cannot read, and nobody plays without your say. Up to eight screens: four golfers, the rest watching. Everyone needs the same version of Fairway.</p>`;
 }
 if (s.stage === 'knocking') {
  return `<p>Knocking on room <b>${esc(showRoomCode(s.code))}</b>. The host lets you in by name.</p>${status}${error}
  <button class="secondary" id="onlineCancel">Stop knocking</button>`;
 }
 if (s.stage === 'guest') {
  return `<p>You are in <b>${esc(s.hostName || 'the host')}</b>’s room${s.course ? `, on <b>${esc(s.course)}</b>` : ''}. ${s.note ? esc(s.note) : 'The host is choosing the course and format; the round starts on your screen when they tee off.'}</p>${status}
  <h3>In the room</h3>${people(s.members || [], s.hostName)}${error}
  <button class="secondary" id="onlineLeave">Leave the room</button>`;
 }
 const golfers = s.golfers || [];
 return `<p>Play a round live with friends in other houses: everyone on their own screen, taking turns, watching each other’s shots fly. No accounts: your golfer, bag and history stay on this device.</p>
  <h3>You</h3>
  <label class="field">Play as<select id="onlineWho">${golfers.map(g => `<option value="${esc(g.id)}"${g.id === s.who ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
  <label class="field">Plays with<select id="onlineInput"><option value="meter"${s.input === 'monitor' ? '' : ' selected'}>Swing pad</option><option value="monitor"${s.input === 'monitor' ? ' selected' : ''}>Launch monitor (through the bridge)</option></select></label>
  <h3>Host a round</h3>
  <button class="primary" id="onlineHost"><i data-lucide="users"></i> Start a room</button>
  <h3>Join a friend</h3>
  <label class="field">Room code<input id="onlineCode" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" placeholder="K7Q2-M9XD-4RTP-8WNB" value="${esc(s.typed || '')}"></label>
  <button class="primary" id="onlineJoin">Join the room <i data-lucide="arrow-right"></i></button>
  ${error}
  <p class="note">Rooms pass through Fairway’s online service, which only carries sealed messages between the players of a room: it cannot read them and keeps nothing.</p>`;
}
