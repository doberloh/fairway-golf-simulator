// tools/meshy-run.mjs against a small stand-in for Meshy, so no credit is spent,
// and the redwood pack's prompts against the owner's rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {darkenBy, DARKEN_LIMIT} from '../src/species.js';
import {extract} from '../tools/mesh-read.mjs';
import {readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {approve, checkPack, client, convert, makeFar, makeModels, makePictures, modelCredits, pictureJobs, picturePrompt, readKey, triangles} from '../tools/meshy-run.mjs';

const pack = JSON.parse(readFileSync('tools/meshy/redwood.json', 'utf8'));

// A GLB holding one mesh of the given triangle count, as far as triangles() reads it.
function glb(tris) {
 const json = Buffer.from(JSON.stringify({meshes: [{primitives: [{indices: 0, attributes: {POSITION: 0}}]}], accessors: [{count: tris * 3}]}));
 const head = Buffer.alloc(20);
 head.write('glTF', 0, 'latin1');
 head.writeUInt32LE(json.length, 12);
 return Buffer.concat([head, json]);
}

function fakeMeshy({failOn, downGets} = {}) {
 const tasks = new Map(), posts = [], downloads = [];
 let n = 0;
 const server = createServer((req, res) => {
  let text = '';
  req.on('data', d => { text += d; });
  req.on('end', () => {
   const send = (code, body) => { res.writeHead(code, {'Content-Type': 'application/json'}); res.end(JSON.stringify(body)); };
   if (req.url.startsWith('/file/')) {
    downloads.push(req.headers.authorization);
    res.end(req.url.endsWith('.glb') ? glb(1000) : Buffer.from('picture'));
    return;
   }
   if (req.headers.authorization !== 'Bearer test-key') return send(401, {message: 'bad key'});
   if (req.method === 'POST') {
    const body = JSON.parse(text);
    posts.push({path: req.url, body});
    const refuse = failOn?.(req.url, body);
    if (refuse) return send(refuse, {message: 'refused'});
    const id = `task${++n}`;
    tasks.set(id, {polls: 0});
    return send(200, {result: id});
   }
   if (downGets) return send(500, {message: 'down'});
   const task = tasks.get(req.url.split('/').pop());
   const host = `http://127.0.0.1:${server.address().port}`;
   if (task.polls++ === 0) return send(200, {status: 'IN_PROGRESS', progress: 50});
   send(200, {status: 'SUCCEEDED', consumed_credits: 5, image_urls: [`${host}/file/p.png`], model_urls: {glb: `${host}/file/m.glb`},
    thumbnail_urls: {front: `${host}/file/f.png`}, texture_urls: [{base_color: `${host}/file/c.png`}]});
  });
 });
 return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({server, tasks, posts, downloads, base: `http://127.0.0.1:${server.address().port}`})));
}

const tiny = {name: 't', style: 'cartoon', view: 'side view', models: [
 {name: 'Blender_Tree_1', target: 5000, far: 400, aspect: '9:16', prompt: 'a tree', colour: 'green'},
 {name: 'Blender_Fern_1', target: 1500, aspect: '1:1', prompt: 'a fern', colour: 'green'},
]};
const [tree, fern] = tiny.models;
const quiet = fake => [client({key: 'test-key', base: fake.base, wait: async () => {}}), {every: 1, parallel: 1, say: () => {}}];
const temp = () => mkdtempSync(join(tmpdir(), 'meshy-'));
const withPicture = (root, ...models) => {
 const approved = join(root, 'approved');
 mkdirSync(approved, {recursive: true});
 for (const m of models) writeFileSync(join(approved, `${m.name}.png`), m.name);
 return approved;
};

test('a picture asks for the shape, the colours, the style and a clean view', async () => {
 const fake = await fakeMeshy(), root = temp(), dir = join(root, 'pictures');
 const [api, opts] = quiet(fake);
 const out = await makePictures(api, tiny, pictureJobs([tree], 'nano-banana-pro', 2), {dir, ...opts});
 fake.server.close();
 assert.deepEqual(out.made, ['Tree_1-nano-banana-pro-1.png', 'Tree_1-nano-banana-pro-2.png']);
 const {path, body} = fake.posts[0];
 assert.equal(path, '/openapi/v1/text-to-image');
 assert.equal(body.ai_model, 'nano-banana-pro');
 assert.equal(body.aspect_ratio, '9:16');
 assert.equal(body.prompt, 'a tree green cartoon side view');
 assert.ok(existsSync(join(dir, 'Tree_1-nano-banana-pro-1.png')));
 rmSync(root, {recursive: true});
});

test('a picture already made is not paid for again', async () => {
 const fake = await fakeMeshy(), root = temp(), dir = join(root, 'pictures');
 const [api, opts] = quiet(fake), jobs = pictureJobs([fern], 'gpt-image-2', 1);
 await makePictures(api, tiny, jobs, {dir, ...opts});
 await makePictures(api, tiny, jobs, {dir, ...opts});
 fake.server.close();
 assert.equal(fake.posts.length, 1);
 rmSync(root, {recursive: true});
});

test('approving copies the chosen picture, and refuses one that is not there', () => {
 const root = temp(), pictures = join(root, 'pictures'), approved = join(root, 'approved');
 mkdirSync(pictures);
 writeFileSync(join(pictures, 'a.png'), 'x');
 approve(pictures, approved, [['Blender_Tree_1', 'a.png']]);
 assert.equal(readFileSync(join(approved, 'Blender_Tree_1.png'), 'utf8'), 'x');
 assert.throws(() => approve(pictures, approved, [['Blender_Tree_1', 'none.png']]), /no such picture/);
 rmSync(root, {recursive: true});
});

test('a model is built from its approved picture, and Meshy makes no far version', async () => {
 const fake = await fakeMeshy(), root = temp(), dir = join(root, 'r1');
 const approved = withPicture(root, tree, fern), [api, opts] = quiet(fake);
 const out = await makeModels(api, tiny.models, {dir, approved, aiModel: 'meshy-6', ...opts});
 fake.server.close();
 assert.deepEqual(out.made, ['Blender_Tree_1', 'Blender_Fern_1']);
 assert.deepEqual(fake.posts.map(p => p.path), ['/openapi/v1/image-to-3d', '/openapi/v1/image-to-3d']);
 const [{body}] = fake.posts;
 assert.equal(body.image_url, `data:image/png;base64,${Buffer.from('Blender_Tree_1').toString('base64')}`);
 assert.equal(body.target_polycount, 5000);
 assert.equal(body.topology, 'triangle');
 assert.equal(body.should_remesh, true);
 assert.equal(body.remove_lighting, true);
 assert.equal(body.enable_pbr, false);
 assert.equal(body.image_enhancement, false);
 assert.equal(body.texture_prompt, undefined, 'the approved picture carries the look');
 for (const f of ['Blender_Tree_1.glb', 'Blender_Tree_1_front.png', 'Blender_Tree_1_colour.png']) assert.ok(existsSync(join(dir, f)), f);
 rmSync(root, {recursive: true});
});

test('far versions are made for the models that have one, from models that exist', () => {
 const root = temp(), calls = [];
 writeFileSync(join(root, 'Blender_Tree_1.glb'), 'x');
 const run = (stem, source, budget) => { calls.push({source, budget}); writeFileSync(`${stem}.json`, JSON.stringify({triangles: 400, outline: .7, worst: .6, boughs: 70})); };
 const other = {name: 'Blender_Tree_2', far: 300};
 const out = makeFar([tree, other, fern], {dir: root, say: () => {}, run});
 assert.deepEqual(calls, [{source: join(root, 'Blender_Tree_1.glb'), budget: 400}]);
 assert.deepEqual(out.made, ['Blender_Tree_1']);
 assert.deepEqual(out.failed, [{name: 'Blender_Tree_2', why: 'no model yet'}]);
 rmSync(root, {recursive: true});
});

test('converting needs a model, and a far version where the tree has one', () => {
 const root = temp(), dir = join(root, 'r2'), game = join(root, 'game');
 mkdirSync(dir);
 writeFileSync(join(dir, 'Blender_Tree_1.glb'), 'x');
 writeFileSync(join(dir, 'Blender_Fern_1.glb'), 'x');
 const run = (source, out) => writeFileSync(`${out}.json`, JSON.stringify({leaves: {triangles: 1, vertices: 1}, bark: {triangles: 1, vertices: 1}}));
 let out = convert([tree, fern], {dir, game, say: () => {}, run});
 assert.deepEqual(out.made, ['Blender_Fern_1']);
 assert.deepEqual(out.failed, [{name: 'Blender_Tree_1', why: 'no far version yet'}]);
 writeFileSync(join(dir, 'Blender_Tree_1_Far.glb'), 'far');
 out = convert([tree], {dir, game, say: () => {}, run});
 assert.deepEqual(out.made, ['Blender_Tree_1']);
 assert.equal(readFileSync(join(game, 'Blender_Tree_1_Far.glb'), 'utf8'), 'far');
 rmSync(root, {recursive: true});
});

test('the key goes to the API only, never to a download or a file', async () => {
 const fake = await fakeMeshy(), root = temp(), dir = join(root, 'r1');
 const approved = withPicture(root, fern), [api, opts] = quiet(fake);
 await makeModels(api, [fern], {dir, approved, aiModel: 'meshy-6', ...opts});
 fake.server.close();
 assert.ok(fake.downloads.length);
 assert.ok(fake.downloads.every(h => h === undefined));
 for (const f of readdirSync(dir)) assert.ok(!readFileSync(join(dir, f), 'latin1').includes('test-key'), f);
 rmSync(root, {recursive: true});
});

test('a run stopped part way does not pay again', async () => {
 const stop = await fakeMeshy({downGets: true}), root = temp(), dir = join(root, 'r1');
 const approved = withPicture(root, fern);
 let [api, opts] = quiet(stop);
 const first = await makeModels(api, [fern], {dir, approved, aiModel: 'meshy-6', ...opts});
 stop.server.close();
 assert.equal(first.failed.length, 1);
 const state = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));
 assert.equal(modelCredits(state.Blender_Fern_1), 0, 'paid for already');

 const again = await fakeMeshy();
 again.tasks.set(state.Blender_Fern_1.model, {polls: 1});
 [api, opts] = quiet(again);
 const second = await makeModels(api, [fern], {dir, approved, aiModel: 'meshy-6', ...opts});
 again.server.close();
 assert.deepEqual(second.made, ['Blender_Fern_1']);
 assert.equal(again.posts.length, 0);
 rmSync(root, {recursive: true});
});

test('a refused key stops the run rather than failing every model', async () => {
 const fake = await fakeMeshy({failOn: () => 402}), root = temp(), dir = join(root, 'r1');
 const approved = withPicture(root, tree, fern), [api, opts] = quiet(fake);
 await makeModels(api, tiny.models, {dir, approved, aiModel: 'meshy-6', ...opts});
 fake.server.close();
 assert.equal(fake.posts.length, 1);
 rmSync(root, {recursive: true});
});

test('a picture swapped after its model was paid for is refused', async () => {
 const fake = await fakeMeshy(), root = temp(), dir = join(root, 'r1');
 const approved = withPicture(root, fern), [api, opts] = quiet(fake);
 await makeModels(api, [fern], {dir, approved, aiModel: 'meshy-6', ...opts});
 writeFileSync(join(approved, `${fern.name}.png`), 'another picture');
 const out = await makeModels(api, [fern], {dir, approved, aiModel: 'meshy-6', ...opts});
 fake.server.close();
 assert.deepEqual(out.made, []);
 assert.match(out.failed[0].why, /new --round/);
 assert.equal(fake.posts.length, 1);
 rmSync(root, {recursive: true});
});

test('a tree\'s random tint cannot take a dark species to black', () => {
 const redwood = .053; // the Redwood Coast's redwood, its lightness in linear colour
 assert.equal(darkenBy(redwood, -.05), -redwood * DARKEN_LIMIT);
 assert.ok(redwood + darkenBy(redwood, -.05) >= redwood * .6);
 assert.equal(darkenBy(redwood, .05), .05, 'lighter is untouched');
 assert.equal(darkenBy(.3, -.05), -.05, 'a light species varies as it did');
});

test('the key is read from the environment, then from .env', () => {
 const dir = temp(), file = join(dir, '.env');
 assert.equal(readKey({MESHY_API_KEY: 'a'}, file), 'a');
 assert.equal(readKey({}, file), '');
 writeFileSync(file, 'OTHER=1\nMESHY_API_KEY="b"\n');
 assert.equal(readKey({}, file), 'b');
 rmSync(dir, {recursive: true});
});

test('triangles are counted from a GLB, and anything else refused', () => {
 assert.equal(triangles(glb(1234)), 1234);
 assert.throws(() => triangles(Buffer.alloc(32)), /not a GLB/);
});

test('every tree with a far version ships from Meshy, in the game\'s form', () => {
 const dir = 'vendor/blender-meshy_redwood', files = readdirSync(dir).filter(f => f.endsWith('.glb'));
 assert.equal(files.length, 28);
 for (const m of pack.models.filter(m => m.far)) for (const f of [m.name, `${m.name}_Far`]) {
  const roles = [...extract(join(dir, `${f}.glb`)).keys()];
  assert.deepEqual(roles, ['bark', 'leaf'], f); // far versions pair up part for part
 }
});

test('the redwood pack covers every model shipped, and is within limits', () => {
 assert.deepEqual(checkPack(pack), []);
 const shipped = ['vendor/blender-cartoon_redwood', 'vendor/blender-meshy_redwood'].flatMap(d => readdirSync(d)).filter(f => f.endsWith('.glb')).map(f => f.replace('.glb', ''));
 const near = shipped.filter(n => !n.endsWith('_Far')), far = shipped.filter(n => n.endsWith('_Far')).map(n => n.replace('_Far', ''));
 assert.deepEqual(pack.models.map(m => m.name).sort(), near.sort());
 assert.deepEqual(pack.models.filter(m => m.far).map(m => m.name).sort(), far.sort());
});

test('the owner\'s rule: no tree is asked to have a broken top', () => {
 for (const m of pack.models) {
  assert.ok(!/jagged|snapped off|ancient|dead bare|broken,/i.test(m.prompt), m.name);
  if (!/SwordFern|Salal|Sorrel/.test(m.name)) assert.match(m.prompt, /no broken or snapped top/, m.name);
 }
});

test('the owner\'s rule: every trunk narrows all the way up', () => {
 for (const m of pack.models.filter(m => !/Seedling|SwordFern|Salal|Sorrel/.test(m.name))) {
  assert.match(m.prompt, /never parallel/, m.name);
  assert.match(m.prompt, /of the tree's height wide near the ground/, m.name);
  assert.ok(!/half as wide/.test(m.prompt), m.name);
 }
});

test('a hemlock\'s top nods; it does not curl', () => {
 for (const m of pack.models.filter(m => /Hemlock/.test(m.name))) {
  assert.match(m.prompt, /not a hook or a curl/, m.name);
  assert.ok(!/crook/.test(m.prompt), m.name);
 }
});

test('the owner\'s rule: a redwood is slim, with a gentle taper and no wide base', () => {
 const redwoods = pack.models.filter(m => /^Blender_(Young)?Redwood_/.test(m.name));
 assert.equal(redwoods.length, 6);
 for (const m of redwoods) {
  assert.match(m.prompt, /of the tree's height wide near the ground/, m.name);
  assert.match(m.prompt, /no wide base/, m.name);
  assert.ok(!/half as wide|massive/i.test(m.prompt), m.name);
 }
});

test('every picture asks for the cartoon style and the game\'s own colours', () => {
 for (const m of pack.models) {
  const p = picturePrompt(pack, m);
  assert.match(p, /Stylised cartoon/, m.name);
  assert.match(p, /No photographic detail/, m.name);
  assert.match(p, /#[0-9a-f]{6}/, m.name);
  assert.match(p, /white background/, m.name);
 }
});
