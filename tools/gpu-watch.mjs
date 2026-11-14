#!/usr/bin/env node
// WHAT THE CARD WAS DOING WHEN IT WAS LOST (13 November 2026; the owner, after
// the second loss in a day: "I really need to understand what is causing this
// issue"). Windows records nothing when this machine's card drops out -- no
// blue screen, no bugcheck code, no hardware-error record, and in thirty days
// one line from the driver -- so the only account of a loss is what was read
// from the card in the seconds before it. This reads it once a second and
// writes each reading to disk at once, so the last line before a loss is the
// card's state at the loss:
//
//   time, power state (P0 full .. P8 idle), core clock, power drawn, the
//   slot's link speed (PCIe generation) and width, how busy, temperature, fan,
//   memory in use
//
//   node tools/gpu-watch.mjs [--every 1] [--out bench/ab/gpu-watch.csv]
//   node tools/gpu-watch.mjs --last 40     the last readings, and every change
//                                          of power state or link speed in them
//
// It draws nothing and costs the card nothing (one nvidia-smi a second). It
// runs until it is stopped; when the card cannot be read it writes what
// nvidia-smi said and keeps trying. The file is not committed (bench/ab).
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : fallback; };
const OUT = path.resolve(ROOT, flag('out', 'bench/ab/gpu-watch.csv'));
const FIELDS = ['pstate', 'clocks.gr', 'power.draw', 'pcie.link.gen.current', 'pcie.link.width.current', 'utilization.gpu', 'temperature.gpu', 'fan.speed', 'memory.used'];
const HEAD = 'time,pstate,clock MHz,power W,link gen,link width,busy %,temp C,fan %,memory MiB';
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

export function read() {
 const line = execFileSync('nvidia-smi', ['--query-gpu=' + FIELDS.join(','), '--format=csv,noheader,nounits'], {encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'pipe']}).trim().split(/\r?\n/)[0];
 return line.split(',').map(s => s.trim()).join(',');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'tools', 'gpu-watch.mjs')) {
 if (flag('last', null)) {
  const n = Number(flag('last', 40)), lines = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  const rows = lines.filter(l => !l.startsWith('time,'));
  console.log(HEAD);
  for (const l of rows.slice(-n)) console.log(l);
  // Every change of power state or link speed, and every reading that failed.
  let was = null, changes = 0;
  console.log('\nchanges of power state or link speed, and failed readings:');
  for (const l of rows) {
   const c = l.split(','), key = c.length >= 5 ? c[1] + ' gen' + c[4] : 'UNREADABLE';
   if (key !== was) { if (was !== null) { changes++; if (changes > rows.length) break; } console.log(`  ${c[0]}  ${was ?? '(start)'} -> ${key}${c.length < 5 ? '  ' + c.slice(1).join(',').slice(0, 120) : `  ${c[3]} W, ${c[6]}% busy`}`); was = key; }
  }
  process.exit(0);
 }
 fs.mkdirSync(path.dirname(OUT), {recursive: true});
 if (!fs.existsSync(OUT)) fs.writeFileSync(OUT, HEAD + '\n');
 const every = Math.max(.5, Number(flag('every', 1))) * 1000;
 fs.appendFileSync(OUT, `${stamp()},WATCH STARTED\n`);
 const tick = () => {
  let line;
  try { line = read(); } catch (e) { line = 'UNREADABLE,' + String(e.stderr || e.stdout || e.message).replace(/\s+/g, ' ').slice(0, 160); }
  // (Appended and closed each time: what is on disk is never a reading behind.)
  try { fs.appendFileSync(OUT, `${stamp()},${line}\n`); } catch {}
 };
 tick();
 setInterval(tick, every);
}
