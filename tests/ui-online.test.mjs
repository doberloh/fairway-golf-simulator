import test from 'node:test';
import assert from 'node:assert/strict';
import {onlineSheet, STATUS_WORDS} from '../src/ui-online.js';

// THE ONLINE SHEET (online play, 19 November 2026): what each stage offers,
// and that nothing a guest typed reaches the page as markup.
const golfers = [{id: 'p1', name: 'Dustin'}, {id: 'p2', name: 'Sam'}];

test('the start: who you play as, host, join by code, the relay', () => {
 const html = onlineSheet({stage: 'start', golfers, who: 'p2', input: 'monitor', relay: 'wss://relay.example'});
 for (const id of ['onlineWho', 'onlineInput', 'onlineHost', 'onlineCode', 'onlineJoin', 'onlineRelay']) assert.match(html, new RegExp(`id="${id}"`), id);
 assert.match(html, /<option value="p2" selected>Sam/);
 assert.match(html, /value="monitor" selected/);
 assert.match(html, /value="wss:\/\/relay.example"/);
});

test('hosting: the code in fours, each knock with Let in and Turn away, Start only with someone in', () => {
 const code = 'K7Q2M9XD4RTP8WNB';
 const empty = onlineSheet({stage: 'host', code, status: 'open', knocks: [], members: [], hostName: 'Dustin'});
 assert.match(empty, /K7Q2-M9XD-4RTP-8WNB/);
 assert.match(empty, /id="onlineChoose" disabled/);
 assert.match(empty, /Connected/);
 const busy = onlineSheet({stage: 'host', code, status: 'retrying', knocks: [{member: 'abc123', name: 'Sam'}], members: [{member: 'def456', name: 'Ann', state: 'away'}], hostName: 'Dustin'});
 assert.match(busy, /data-admit="abc123"/);
 assert.match(busy, /data-refuse="abc123"/);
 assert.match(busy, /CONNECTION LOST/);
 assert.doesNotMatch(busy, /id="onlineChoose" disabled/);
 assert.match(busy, new RegExp(STATUS_WORDS.retrying.slice(0, 15)));
});

test('a guest\'s screens: knocking, then in the room', () => {
 assert.match(onlineSheet({stage: 'knocking', code: 'K7Q2M9XD4RTP8WNB', status: 'open'}), /id="onlineCancel"/);
 const inRoom = onlineSheet({stage: 'guest', hostName: 'Dustin', course: 'Cascade View', members: [{member: 'a1b2c3', name: 'Sam', state: 'in'}]});
 assert.match(inRoom, /Dustin<\/b>’s room, on <b>Cascade View/);
 assert.match(inRoom, /id="onlineLeave"/);
});

test('names and errors are text, never markup', () => {
 const evil = '<img src=x onerror=alert(1)>';
 const html = onlineSheet({stage: 'host', code: 'K7Q2M9XD4RTP8WNB', knocks: [{member: 'abc123', name: evil}], members: [{member: 'd', name: evil, state: 'in'}], hostName: evil, error: evil});
 assert.doesNotMatch(html, /<img/);
 assert.match(html, /&lt;img src=x/);
 assert.doesNotMatch(onlineSheet({stage: 'start', golfers: [{id: '"><b>', name: evil}], typed: evil}), /<img|"><b>/);
});
