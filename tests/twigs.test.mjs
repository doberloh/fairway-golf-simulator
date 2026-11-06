import test from 'node:test';
import assert from 'node:assert/strict';
import {growTwigs, twigMesh} from '../src/twigs.js';
import {familyModels, FAMILY_OF, modelParts, bareParts, farParts, hasShippedTwin} from '../src/mesh-assets.js';

const positions = (model, role) => modelParts(model).find(p => p.role === role)?.geometry.attributes.position.array ?? [];
const grown = model => growTwigs({leaf: positions(model, 'leaf'), bark: positions(model, 'bark'), seed: model});
// The widest and highest a position array or a node list reaches.
const reach = points => {
 let wide = 0, top = 0;
 for (const [x, y, z] of points) { wide = Math.max(wide, Math.hypot(x, z)); top = Math.max(top, y); }
 return {wide, top};
};
const triples = a => Array.from({length: a.length / 3}, (_, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]);

test('the twigs are the same every time, and every one joins the tree', () => {
 const model = familyModels(FAMILY_OF.maple)[0];
 assert.deepEqual(twigMesh(grown(model)).position, twigMesh(grown(model)).position);
 const nodes = grown(model);
 nodes.forEach((n, k) => { if (n.parent >= 0) assert.ok(n.parent < k, 'a parent comes before its child'); });
 assert.ok(nodes.some(n => n.parent < 0), 'it starts from the bark');
});

test('each species keeps its outline: the twigs fill the crown the leaves filled', () => {
 // A narrow birch, a vase, a wide flat bur oak. A birch's crown once lay
 // inside one reach of its trunk and grew nothing.
 for (const kind of ['paperbirch', 'aspen', 'americanelm', 'buroak', 'maple']) for (const model of familyModels(FAMILY_OF[kind])) {
  const nodes = grown(model), wood = reach(nodes.map(n => [n.x, n.y, n.z])), crown = reach(triples(positions(model, 'leaf')));
  assert.ok(nodes.filter(n => n.parent >= 0).length > 40, `${model} grew only ${nodes.length} nodes`);
  assert.ok(wood.wide > crown.wide * .75 && wood.wide < crown.wide * 1.15, `${model}: ${wood.wide.toFixed(2)} wide in a crown of ${crown.wide.toFixed(2)}`);
  assert.ok(wood.top > crown.top * .85 && wood.top < crown.top * 1.1, `${model}: ${wood.top.toFixed(2)} high in a crown of ${crown.top.toFixed(2)}`);
 }
});

test('a branch is no thicker than the limbs, and thins toward its ends', () => {
 const nodes = grown(familyModels(FAMILY_OF.oak)[0]);
 for (const n of nodes) for (const c of n.kids) assert.ok(nodes[c].width <= n.width + 1e-9, 'a child is never thicker than its parent');
 assert.ok(Math.max(...nodes.map(n => n.width)) > Math.min(...nodes.map(n => n.width)) * 2);
});

test('the twin is the stronger branches, stouter, and far fewer triangles', () => {
 for (const kind of ['maple', 'oak', 'americanelm', 'redbud']) {
  const nodes = grown(familyModels(FAMILY_OF[kind])[0]), near = twigMesh(nodes), far = twigMesh(nodes, {far: true});
  assert.ok(far.index.length > 0, `${kind}: a far tree still has a crown`);
  assert.ok(far.index.length < near.index.length * .4, `${kind}: ${far.index.length / 3} against ${near.index.length / 3}`);
 }
});

test('a bare tree is cheaper than the tree in leaf, its wood in one part, with a twin', () => {
 for (const kind of ['maple', 'oak', 'americanelm', 'buroak', 'paperbirch', 'aspen', 'redbud', 'sassafras']) for (const model of familyModels(FAMILY_OF[kind])) {
  const parts = modelParts(model), triangles = list => list.reduce((n, p) => n + p.geometry.index.count / 3, 0);
  const bare = bareParts(model, {shade: .8, tip: .6});
  assert.deepEqual(bare.map(p => p.role), ['bark'], `${model}: no leaf or flower part is left`);
  assert.ok(triangles(bare) < triangles(parts) * .85,`${model}: ${triangles(bare)} triangles bare, ${triangles(parts)} in leaf`);
  const g = bare[0].geometry, was = parts.find(p => p.role === 'bark').geometry;
  assert.deepEqual(Object.keys(g.attributes).sort(), Object.keys(was.attributes).sort(), `${model}: the bark's own attributes, so its material fits`);
  assert.equal(g.attributes.position.count, g.attributes.color.count);
  assert.ok(bare[0].far.index.count < g.index.count * .6, `${model}: too near its twin to be thinned`);
 }
});

test('an aspen keeps its eyes bare, and the eyes still find their twin', () => {
 const model = familyModels(FAMILY_OF.aspen)[0], bare = bareParts(model, {keep: ['accent']});
 assert.deepEqual(bare.map(p => p.role), ['bark', 'accent']);
 const accent = bare.find(p => p.role === 'accent');
 assert.equal(modelParts(model)[accent.index].role, 'accent');
 if (hasShippedTwin(model)) assert.equal(farParts(model)[accent.index].role, 'accent');
});

test('a plant with no bark is grown from its foot', () => {
 const leaf = new Float32Array([.3, .6, 0, -.3, .7, .1, 0, .9, .3, .1, .8, -.3, .2, .5, .2, -.2, .5, -.2]);
 const nodes = growTwigs({leaf, seed: 'no bark'});
 assert.ok(nodes.length > 3 && nodes[0].y < .1);
});
