// ANY GRAPHICS-CARD COMMAND, THROUGH THE GATE AND INTO THE LOG (the cartoon
// overhaul, 25 October 2026).
//
//   node tools/gpu-run.mjs --goal <goal> [--util 30 --temp 80 --rest 1] -- <command ...>
//
// The captures call tools/gpu-gate.mjs themselves; the smoke test and the
// profiler do not. This waits at the gate with the goal's own limits (the
// cartoon overhaul's are 30%, 80 °C, a minute apart -- docs/reports/
// cartoon-overhaul-goal.md), runs the command, logs it with the card's
// readings before and after, and checks nothing of ours is left on the card.
// It never widens a limit by itself: without a goal it refuses.
import {spawnSync} from 'node:child_process';
import {gpuGate, logRun, readCard, foreignJobs} from './gpu-gate.mjs';

const argv = process.argv.slice(2), cut = argv.indexOf('--');
if (cut < 0) throw Error('usage: node tools/gpu-run.mjs --goal <goal> [--util n --temp n --rest min] -- <command ...>');
const flags = argv.slice(0, cut), command = argv.slice(cut + 1);
const opt = (name, d) => { const i = flags.indexOf(name); return i < 0 ? d : flags[i + 1]; };
const goal = opt('--goal', null);
if (!goal) throw Error('--goal is required: the run belongs to a goal and is logged under it.');
const before = gpuGate({goal, cap: Infinity, utilMax: Number(opt('--util', 10)), tempMax: Number(opt('--temp', 60)), restMin: Number(opt('--rest', 5))});
const started = new Date().toISOString();
const run = spawnSync(command[0], command.slice(1), {stdio: 'inherit', shell: process.platform === 'win32'});
const after = readCard(), left = foreignJobs();
logRun({goal, what: command.join(' '), started, before, after, result: run.status === 0 ? 'ok' : `exit ${run.status}`});
if (left.length) console.log(`gpu-run: still on the card afterwards: ${left.map(j => j.name).join(', ')}`);
process.exit(run.status ?? 1);
