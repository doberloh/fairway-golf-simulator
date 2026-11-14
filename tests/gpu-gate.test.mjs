import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFrom, mayStart, GAME} from '../tools/gpu-gate.mjs';

// THE CARD'S GATE READS WORK, NOT IDLING (13 November 2026; the owner: "Fix
// the gate"). nvidia-smi's busy figure is the share of time the card was busy
// at its current clock, and this card idles at a third of its clock: a
// launcher and a chat window read 18 to 50% and shut the gate for a day. The
// gate now sums Windows' own account of each program's share of the card,
// and one program taking 15% by itself -- a game -- refuses a run whatever
// the total. What is held here is that arithmetic; reading the counters needs
// the machine.
const idle = [
 '0|pid_38848_luid_0x0_0x1_phys_0_eng_0_engtype_3D|3.5', '0|pid_30404_luid_0x0_0x1_phys_0_eng_0_engtype_3D|1.2',
 '0|pid_2412_luid_0x0_0x1_phys_0_eng_0_engtype_3D|0.6', '0|pid_4_luid_0x0_0x1_phys_0_eng_3_engtype_Copy|0.5',
 '1|pid_38848_luid_0x0_0x1_phys_0_eng_0_engtype_3D|4.1', '1|pid_30404_luid_0x0_0x1_phys_0_eng_0_engtype_3D|0.9',
];
const names = {38848: 'Battle.net', 30404: 'slack', 2412: 'dwm', 4: 'System', 777: 'SomeGame'};

test('the card\'s work is every program\'s share added up, the busiest sample of the look', () => {
 const load = loadFrom(idle, names);
 assert.equal(load.samples, 2);
 assert.equal(load.util, 5.8, 'the first sample: 3.5 + 1.2 + 0.6 + 0.5');
 assert.deepEqual(load.top, {pid: 38848, name: 'Battle.net', util: 4.1}, 'and the busiest single program in any sample');
 // A program on two engines is one program.
 const two = loadFrom(['0|pid_777_x_engtype_3D|9', '0|pid_777_x_engtype_VideoEncode|8'], names);
 assert.equal(two.top.util, 17); assert.equal(two.top.name, 'SomeGame');
 // Nothing read is nothing known, not an idle card.
 assert.equal(loadFrom([]).samples, 0);
 assert.equal(loadFrom(['0|no pid here|50', '0|pid_9_x|0']).util, 0);
});

test('an idle desktop may start a run even where nvidia-smi calls it a third busy', () => {
 const load = loadFrom(idle, names);
 assert.deepEqual(mayStart({load, smi: 33, temp: 40, utilMax: 30, tempMax: 75}), {ok: true});
 assert.deepEqual(mayStart({load, smi: 54, temp: 40, utilMax: 10, tempMax: 60}), {ok: true}, 'under the strictest limit too');
});

test('a game refuses the run whatever limit the run asked for', () => {
 const playing = loadFrom([...idle, '1|pid_777_x_engtype_3D|22'], names);
 const said = mayStart({load: playing, smi: 30, temp: 50, utilMax: 100, tempMax: 75});
 assert.equal(said.ok, false);
 assert.match(said.why, /SomeGame is taking 22% of the card by itself: a game/);
 assert.ok(GAME <= 15, 'and the line for one program is no looser than 15%');
 // Just under it, by many programs together, the total still decides.
 const busy = loadFrom(Array.from({length: 6}, (_, i) => `0|pid_${100 + i}_x_engtype_3D|7`));
 assert.equal(mayStart({load: busy, smi: 40, temp: 50, utilMax: 30, tempMax: 75}).ok, false, '42% of work is over a 30% limit');
 assert.equal(mayStart({load: busy, smi: 40, temp: 50, utilMax: 50, tempMax: 75}).ok, true);
});

test('heat, another job, and a card that cannot be read each hold a run back', () => {
 const load = loadFrom(idle, names);
 assert.match(mayStart({load, smi: 5, temp: 76, utilMax: 30, tempMax: 75}).why, /76 °C/);
 assert.match(mayStart({load, smi: 5, temp: 40, utilMax: 30, tempMax: 75, others: 1}).why, /another graphics job/);
 // No counters (another system, a failed call): nvidia-smi's figure decides, as it did.
 assert.equal(mayStart({load: null, smi: 8, temp: 40, utilMax: 10, tempMax: 60}).ok, true);
 const blind = mayStart({load: null, smi: 33, temp: 40, utilMax: 30, tempMax: 75});
 assert.equal(blind.ok, false); assert.match(blind.why, /real counters could not be read/);
});
