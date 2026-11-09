// Makes a pack's plants on Meshy (https://docs.meshy.ai) in two stages with the
// owner between them: pictures first, then models from the pictures approved.
// Everything it fetches stays under bench/meshy (local, git-ignored).
//
//   node tools/meshy-run.mjs tools/meshy/redwood.json --balance
//   node tools/meshy-run.mjs tools/meshy/redwood.json --pictures --only Redwood_1 --image-model gpt-image-2
//   node tools/meshy-run.mjs tools/meshy/redwood.json --approve Redwood_1=Redwood_1-gpt-image-2-1.png
//   node tools/meshy-run.mjs tools/meshy/redwood.json --models --only Redwood_1
//
//   --pictures        make a picture of each model, for the owner to look at
//   --approve a=file  pick a picture from pictures/ as that model's source
//   --models          make models, from approved pictures only
//   --far             build far versions from those models, in Blender on the
//                     processor (tools/blender/meshy_far.py): no credits
//   --convert         turn the models into the game's form in bench/meshy/<pack>/
//                     game-r<round>, in Blender on the processor, with their far
//                     versions (tools/blender/meshy_game.py): no credits
//   --only a,b        only these: Redwood_1, or Redwood for all three (never
//                     YoungRedwood)
//   --image-model m   gpt-image-2 (default, the owner's pick), nano-banana-pro ...
//   --takes N         pictures of each model (default 1); more add to any kept
//   --round N         a fresh models folder, for a new try (default 1)
//   --ai-model name   meshy-6 (default) or meshy-7.1. Only meshy-6 strips
//                     baked light from a texture.
//   --max-credits N   refuse a run that could spend more (default 100)
//   --jobs N          tasks at once (default 3; the Pro plan's limit is 10)
//   --dry-run         print what would be sent and what it costs; send nothing
//   --balance         print the credit balance (free) and stop
//
// THE KEY comes from the environment, or from MESHY_API_KEY=... in .env at the
// repository's root (git-ignored). It is never printed or written down, and
// goes only to the API: downloads are plain, signed links.
//
// EVERY PAID STEP IS WRITTEN DOWN THE MOMENT IT IS ACCEPTED (state.json), so a
// run cut off part way picks its tasks up again rather than paying for them
// twice. A picture changed after its model was paid for is refused: that is a
// new --round.
//
// A model's look comes from its approved picture, so no texture prompt is sent:
// one would paint over what the owner approved. image_enhancement is off for the
// same reason. Both PLACED until models are seen.
//
// What comes out is NOT a game model. The game keeps triangles, normals,
// material names and vertex paint, and drops textures (docs/BLENDER_ASSETS.md,
// *What the game keeps from a model*). Nothing here touches vendor/.
import {readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, appendFileSync, copyFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve, basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Credits (docs: API pricing, 5 November 2026).
export const PICTURE_COST = {'nano-banana': 3, 'nano-banana-2': 6, 'nano-banana-2-lite': 3, 'nano-banana-2-1': 4, 'nano-banana-pro': 9,
 'gpt-image-2': 9, 'gpt-image-2-5-flare': 9, 'gpt-image-2-5-sunburst': 9};
export const COST = {model: 30};
const STOP = new Set([401, 402, 403]); // no later task will do better
const short = name => name.replace('Blender_', '');

export function readKey(env = process.env, envFile = join(ROOT, '.env')) {
 if (env.MESHY_API_KEY) return env.MESHY_API_KEY.trim();
 if (!existsSync(envFile)) return '';
 const line = readFileSync(envFile, 'utf8').split(/\r?\n/).find(l => l.startsWith('MESHY_API_KEY='));
 return line ? line.slice('MESHY_API_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
}

export const picturePrompt = (pack, model) => `${model.prompt} ${model.colour} ${pack.style} ${pack.view}`;

// Every problem with a pack, before anything is sent.
export function checkPack(pack) {
 const bad = [], seen = new Set();
 for (const m of pack.models) {
  if (seen.has(m.name)) bad.push(`${m.name}: named twice`);
  seen.add(m.name);
  if (!m.prompt) bad.push(`${m.name}: no prompt`);
  if (!['1:1', '3:4', '4:3', '9:16', '16:9'].includes(m.aspect)) bad.push(`${m.name}: aspect ${m.aspect}`);
  if (!(m.target >= 100 && m.target <= 300000)) bad.push(`${m.name}: target ${m.target} is outside 100-300,000`);
  if (m.far !== undefined && !(m.far >= 100 && m.far <= 300000)) bad.push(`${m.name}: far ${m.far} is outside 100-300,000`);
 }
 return bad;
}

export const modelCredits = (entry = {}) => entry.done || entry.model ? 0 : COST.model;

export function triangles(buffer) {
 if (buffer.toString('latin1', 0, 4) !== 'glTF') throw Error('not a GLB');
 const json = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)));
 let n = 0;
 for (const mesh of json.meshes || []) for (const p of mesh.primitives) {
  n += json.accessors[p.indices ?? p.attributes.POSITION].count / 3;
 }
 return n;
}

class ApiError extends Error {
 constructor(status, message) { super(`Meshy ${status}: ${message}`); this.status = status; }
}

export function client({key, base = process.env.MESHY_BASE || 'https://api.meshy.ai', wait = ms => new Promise(r => setTimeout(r, ms))}) {
 async function call(path, body) {
  for (let attempt = 0; ; attempt++) {
   let res;
   try {
    res = await fetch(base + path, {
     method: body ? 'POST' : 'GET',
     headers: {Authorization: `Bearer ${key}`, ...(body ? {'Content-Type': 'application/json'} : {})},
     body: body ? JSON.stringify(body) : undefined,
    });
   } catch (e) {
    // A POST that may have reached Meshy is not sent twice: that could pay twice.
    if (body || attempt >= 5) throw e;
    await wait(1000 * 2 ** attempt);
    continue;
   }
   if (res.ok) return res.json();
   const text = await res.text();
   if (res.status === 429 && attempt < 20) { // too fast, or too many tasks at once
    await wait(1000 * (+res.headers.get('retry-after') || 30));
    continue;
   }
   if (!body && res.status >= 500 && attempt < 5) {
    await wait(1000 * 2 ** attempt);
    continue;
   }
   throw new ApiError(res.status, text.slice(0, 300));
  }
 }
 return {call, wait};
}

async function until(api, path, {every = 10000, limit = 1200000} = {}) {
 const started = Date.now();
 for (;;) {
  const task = await api.call(path);
  if (task.status === 'SUCCEEDED') return task;
  if (task.status === 'FAILED' || task.status === 'CANCELED') {
   throw Error(`${task.status}: ${task.task_error?.message || 'no reason given'}`);
  }
  if (Date.now() - started > limit) throw Error(`no result after ${Math.round(limit / 60000)} minutes; run it again to pick the task up`);
  await api.wait(every);
 }
}

async function fetchTo(url, file) {
 const res = await fetch(url); // no key on these: they are signed links
 if (!res.ok) throw Error(`download failed: ${res.status}`);
 const data = Buffer.from(await res.arrayBuffer());
 writeFileSync(`${file}.part`, data);
 renameSync(`${file}.part`, file);
 return data;
}

function ledger(dir) {
 mkdirSync(dir, {recursive: true});
 const file = join(dir, 'state.json');
 const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
 return {state, save: () => writeFileSync(file, JSON.stringify(state, null, 1))};
}

async function pool(items, jobs, work) {
 const queue = [...items];
 const worker = async () => {
  while (queue.length) if (await work(queue.shift()) === 'stop') queue.length = 0;
 };
 await Promise.all(Array.from({length: Math.max(1, jobs)}, worker));
}

export const pictureFile = (model, imageModel, take) => `${short(model.name)}-${imageModel}-${take}.png`;

export function pictureJobs(models, imageModel, takes) {
 return models.flatMap(model => Array.from({length: takes}, (_, i) => ({model, imageModel, file: pictureFile(model, imageModel, i + 1)})));
}

export async function makePictures(api, pack, jobs, {dir, parallel = 3, say = console.log, every}) {
 const {state, save} = ledger(dir), made = [], failed = [];
 await pool(jobs, parallel, async ({model, imageModel, file}) => {
  try {
   if (existsSync(join(dir, file))) return;
   if (!state[file]) {
    const {result} = await api.call('/openapi/v1/text-to-image', {ai_model: imageModel, prompt: picturePrompt(pack, model), aspect_ratio: model.aspect});
    state[file] = result;
    save();
   }
   const task = await until(api, `/openapi/v1/text-to-image/${state[file]}`, {every});
   await fetchTo(task.image_urls[0], join(dir, file));
   appendFileSync(join(dir, 'runs.jsonl'), JSON.stringify({time: new Date().toISOString(), file, imageModel, credits: task.consumed_credits, task: state[file]}) + '\n');
   made.push(file);
   say(`${file}: done, ${task.consumed_credits} credits`);
  } catch (e) {
   failed.push({name: file, why: e.message});
   say(`${file}: FAILED, ${e.message}`);
   if (STOP.has(e.status)) return 'stop';
  }
 });
 return {made, failed};
}

export function approve(pictures, approved, picks) {
 mkdirSync(approved, {recursive: true});
 for (const [model, file] of picks) {
  const from = join(pictures, basename(file));
  if (!existsSync(from)) throw Error(`no such picture: ${file}`);
  copyFileSync(from, join(approved, `${model}.png`));
 }
}

const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');

async function makeModel(api, model, {dir, approved, aiModel, state, save, every}) {
 const entry = state[model.name] ||= {};
 const picture = join(approved, `${model.name}.png`), hash = sha(picture);
 if (entry.picture && entry.picture !== hash) throw Error('its picture changed after it was paid for; use a new --round');
 entry.picture = hash;
 if (!entry.model) {
  const {result} = await api.call('/openapi/v1/image-to-3d', {
   image_url: `data:image/png;base64,${readFileSync(picture).toString('base64')}`, ai_model: aiModel, image_enhancement: false,
   should_texture: true, enable_pbr: false, texture_resolution: '2k', ...(aiModel === 'meshy-6' ? {remove_lighting: true} : {}),
   should_remesh: true, topology: 'triangle', target_polycount: model.target, target_formats: ['glb'], multi_view_thumbnails: true});
  entry.model = result;
  save();
 }
 const built = await until(api, `/openapi/v1/image-to-3d/${entry.model}`, {every});
 const glb = await fetchTo(built.model_urls.glb, join(dir, `${model.name}.glb`));
 for (const [side, url] of Object.entries(built.thumbnail_urls || {})) await fetchTo(url, join(dir, `${model.name}_${side}.png`));
 const colour = built.texture_urls?.[0]?.base_color;
 if (colour) await fetchTo(colour, join(dir, `${model.name}_colour.png`));
 const report = {tris: triangles(glb), credits: built.consumed_credits || 0};
 entry.done = true;
 save();
 appendFileSync(join(dir, 'runs.jsonl'), JSON.stringify({time: new Date().toISOString(), model: model.name, aiModel, target: model.target, ...report, task: entry.model}) + '\n');
 return report;
}

export async function makeModels(api, models, {dir, approved, aiModel, parallel = 3, say = console.log, every}) {
 const {state, save} = ledger(dir), made = [], failed = [];
 await pool(models, parallel, async model => {
  if (state[model.name]?.done && state[model.name].picture === sha(join(approved, `${model.name}.png`))) return;
  try {
   const r = await makeModel(api, model, {dir, approved, aiModel, state, save, every});
   made.push(model.name);
   say(`${model.name}: done, ${r.tris} triangles (target ${model.target}), ${r.credits} credits`);
  } catch (e) {
   failed.push({name: model.name, why: e.message});
   say(`${model.name}: FAILED, ${e.message}`);
   if (STOP.has(e.status)) return 'stop';
  }
 });
 return {made, failed};
}

export function findBlender(env = process.env) {
 if (env.BLENDER && existsSync(env.BLENDER)) return env.BLENDER;
 const base = 'C:/Program Files/Blender Foundation';
 const found = existsSync(base) ? readdirSync(base).sort().reverse().map(d => join(base, d, 'blender.exe')) : [];
 return [...found, '/Applications/Blender.app/Contents/MacOS/Blender', '/usr/bin/blender'].find(existsSync) || 'blender';
}

// One Blender at a time (AGENTS.md); it never touches the graphics card.
// A model's `wood` ("brown") reaches read_tree as MESHY_WOOD: the bark is brown, so the green-wood
// split (palo verde, saguaro) is skipped -- a dark spruce trunk foot set it off and swapped trunk and
// needles (Engelmann spruce 2, 8 November 2026).
// A model's `accent`, `plain`, `leafColours` and `leafOnly` reach meshy_game.py the same way (its flower part), and `gameTris`
// the thinning read_tree does first (tools/blender/meshy_game.py, *FLOWERS*; meshy_parts.py).
const woodEnv = model => ({...process.env, MESHY_WOOD: model?.wood || '', MESHY_ACCENT: (model?.accent || []).join(','),
 MESHY_PLAIN: (model?.plain || []).join(','), MESHY_LEAFCOL: (model?.leafColours || []).join(','), MESHY_LEAFONLY: model?.leafOnly ? '1' : '', MESHY_TRIS: String(model?.gameTris || '')});
export function makeFar(models, {dir, say = console.log, run = (stem, source, budget, style, level, model) => spawnSync(findBlender(), ['--factory-startup', '-b', '-P',
 join(ROOT, 'tools', 'blender', 'meshy_far.py'), '--', source, stem, String(budget), style, String(level)], {encoding: 'utf8', timeout: 600000, env: woodEnv(model)})}) {
 const made = [], failed = [];
 for (const model of models.filter(m => m.far)) {
  const source = join(dir, `${model.name}.glb`), stem = join(dir, `${model.name}_Far`);
  if (!existsSync(source)) { failed.push({name: model.name, why: 'no model yet'}); say(`${model.name}: no model yet`); continue; }
  run(stem, source, model.far, model.farStyle || 'boughs', model.paintLevel || .82, model);
  if (!existsSync(`${stem}.json`)) { failed.push({name: model.name, why: 'Blender wrote nothing'}); say(`${model.name}: FAILED, Blender wrote nothing`); continue; }
  const r = JSON.parse(readFileSync(`${stem}.json`, 'utf8'));
  made.push(model.name);
  say(`${model.name}: far ${r.triangles} triangles (budget ${model.far}), outline ${r.outline} (worst ${r.worst}), ${r.boughs} boughs`);
 }
 return {made, failed};
}

export function convert(models, {dir, game, say = console.log, run = (source, out, level, model) => spawnSync(findBlender(), ['--factory-startup', '-b', '-P',
 join(ROOT, 'tools', 'blender', 'meshy_game.py'), '--', source, out, String(level)], {encoding: 'utf8', timeout: 600000, env: woodEnv(model)})}) {
 mkdirSync(game, {recursive: true});
 const made = [], failed = [];
 for (const model of models) {
  const source = join(dir, `${model.name}.glb`), out = join(game, `${model.name}.glb`);
  if (!existsSync(source)) { failed.push({name: model.name, why: 'no model yet'}); say(`${model.name}: no model yet`); continue; }
  run(source, out, model.paintLevel || .82, model);
  if (!existsSync(`${out}.json`)) { failed.push({name: model.name, why: 'Blender wrote nothing'}); say(`${model.name}: FAILED, Blender wrote nothing`); continue; }
  const r = JSON.parse(readFileSync(`${out}.json`, 'utf8'));
  if (model.far) {
   const far = join(dir, `${model.name}_Far.glb`);
   if (!existsSync(far)) { failed.push({name: model.name, why: 'no far version yet'}); say(`${model.name}: no far version yet`); continue; }
   copyFileSync(far, join(game, `${model.name}_Far.glb`));
  }
  made.push(model.name);
  const part = k => r[k] || {triangles: 0, vertices: 0};
  say(`${model.name}: leaves ${part('leaves').triangles} triangles, bark ${part('bark').triangles}` + (r.accent?.triangles ? `, flowers ${r.accent.triangles}` : '')
   + `, ${part('leaves').vertices + part('bark').vertices + part('accent').vertices} vertices`);
 }
 return {made, failed};
}

function args(argv) {
 const o = {file: null, only: [], round: 1, aiModel: 'meshy-6', imageModel: 'gpt-image-2', takes: 1, maxCredits: 100, jobs: 3, picks: []};
 for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--only') o.only = argv[++i].split(',').filter(Boolean);
  else if (a === '--round') o.round = +argv[++i];
  else if (a === '--ai-model') o.aiModel = argv[++i];
  else if (a === '--image-model') o.imageModel = argv[++i];
  else if (a === '--takes') o.takes = +argv[++i];
  else if (a === '--max-credits') o.maxCredits = +argv[++i];
  else if (a === '--jobs') o.jobs = +argv[++i];
  else if (a === '--approve') o.picks = argv[++i].split(',').map(p => p.split('='));
  else if (a === '--pictures') o.pictures = true;
  else if (a === '--models') o.models = true;
  else if (a === '--far') o.far = true;
  else if (a === '--convert') o.convert = true;
  else if (a === '--dry-run') o.dryRun = true;
  else if (a === '--balance') o.balance = true;
  else if (a.startsWith('--')) throw Error(`no such option: ${a}`);
  else o.file = a;
 }
 return o;
}

async function main() {
 const o = args(process.argv.slice(2));
 if (!o.file) throw Error('name a pack, for example tools/meshy/redwood.json');
 const pack = JSON.parse(readFileSync(resolve(o.file), 'utf8'));
 const bad = checkPack(pack);
 if (bad.length) throw Error(`the pack has problems:\n ${bad.join('\n ')}`);
 const home = join(ROOT, 'bench', 'meshy', pack.name), pictures = join(home, 'pictures'), approved = join(home, 'approved');
 const named = n => pack.models.find(m => short(m.name) === n || m.name === n);

 if (o.picks.length) {
  const picks = o.picks.map(([n, file]) => {
   if (!named(n)) throw Error(`no model called ${n}`);
   return [named(n).name, file];
  });
  approve(pictures, approved, picks);
  console.log(`approved ${picks.map(p => short(p[0])).join(', ')}`);
  return;
 }
 const models = pack.models.filter(m => !o.only.length || o.only.some(w => short(m.name).startsWith(w)));
 if (!models.length) throw Error(`no model matches ${o.only}`);
 if (!o.balance && !o.pictures && !o.models && !o.far && !o.convert) throw Error('say --pictures, --approve, --models, --far, --convert or --balance');
 if (o.convert) {
  const {failed} = convert(models, {dir: join(home, `r${o.round}-${o.aiModel}`), game: join(home, `game-r${o.round}`)});
  if (failed.length) process.exitCode = 1;
  return;
 }
 if (o.far) {
  const {failed} = makeFar(models, {dir: join(home, `r${o.round}-${o.aiModel}`)});
  if (failed.length) process.exitCode = 1;
  return;
 }

 let cost = 0, jobs, dir;
 if (o.pictures) {
  if (!(o.imageModel in PICTURE_COST)) throw Error(`no price known for ${o.imageModel}`);
  const {state} = ledger(pictures);
  jobs = pictureJobs(models, o.imageModel, o.takes).filter(j => !existsSync(join(pictures, j.file)));
  cost = jobs.filter(j => !state[j.file]).length * PICTURE_COST[o.imageModel];
  if (o.dryRun) for (const j of jobs) console.log(`${j.file} (${j.model.aspect})\n  ${picturePrompt(pack, j.model)}`);
 }
 if (o.models) {
  const missing = models.filter(m => !existsSync(join(approved, `${m.name}.png`))).map(m => short(m.name));
  if (missing.length) throw Error(`no approved picture yet for ${missing.join(', ')}. Nothing was sent.`);
  dir = join(home, `r${o.round}-${o.aiModel}`);
  const {state} = ledger(dir);
  cost = models.reduce((sum, m) => sum + modelCredits(state[m.name]), 0);
 }
 if (o.dryRun) {
  console.log(`\n${models.length} models, up to ${cost} credits. Nothing was sent.`);
  return;
 }
 const key = readKey();
 if (!key) throw Error('no key: put MESHY_API_KEY=... in .env at the repository root');
 const api = client({key});
 const {balance, monthly_resets_at: resets} = await api.call('/openapi/v1/balance');
 if (o.balance) {
  console.log(`${balance} credits${resets ? `, renewing ${new Date(resets).toISOString().slice(0, 10)}` : ''}`);
  return;
 }
 if (cost > o.maxCredits) throw Error(`this run could spend ${cost} credits, over --max-credits ${o.maxCredits}. Nothing was sent.`);
 if (cost > balance) throw Error(`this run could spend ${cost} credits and the balance is ${balance}. Nothing was sent.`);
 console.log(`up to ${cost} credits of ${balance}`);
 const {made, failed} = o.pictures ? await makePictures(api, pack, jobs, {dir: pictures, parallel: o.jobs})
  : await makeModels(api, models, {dir, approved, aiModel: o.aiModel, parallel: o.jobs});
 console.log(`\n${made.length} made, ${failed.length} failed. Files: ${o.pictures ? pictures : dir}`);
 if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
 main().catch(e => { console.error(e.message); process.exitCode = 1; });
}
