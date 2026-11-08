import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {world} from './worlds.mjs';
import {addVegetation} from '../src/vegetation.js';

// THE HEATH PAST THE NEAR TILES (vegetation.js addFarHeath; the owner, 31
// October 2026: "the purple bushes fade out completely leaving just weird
// looking purple ground"). Past the near cushions' 48 m a heath is low domes
// in the cushions' colours, to the tier's long-grass reach.

const build = (settings, quality = {foliage: 1, grass: 1, longGrassReach: 190}) => {
 const w = world(settings);
 const view = {world: w, style: 'cartoon', group: new T.Group(), treeInstances: [], quality, resources: []};
 addVegetation(view);
 let heath = null;
 view.group.traverse(o => {if (o.name === 'Far heath') heath = o;});
 return {w, heath};
};
const LINKS = {seed: 'DUNE-7', holes: 18, biome: 'seaside'};

test('the far heath stands on heather, at the ground, in the cushions\' colours', () => {
 const {w, heath} = build(LINKS);
 assert.ok(heath && heath.count > 1000, `only ${heath?.count ?? 0} domes on a links eighteen`);
 assert.equal(heath.userData.cullReach, 190, 'not drawn to the tier\'s long-grass reach');
 assert.equal(heath.castShadow, false);
 // The grow-in and sink really reach the shader: patching a line a plain
 // toon material does not have would change nothing, and nothing would say.
 const shader = {vertexShader: T.ShaderLib.toon.vertexShader, fragmentShader: T.ShaderLib.toon.fragmentShader, uniforms: {}};
 heath.material.onBeforeCompile(shader, null);
 assert.ok(!shader.vertexShader.includes('#include <project_vertex>') && /heathStand=smoothstep\(28\.0,48\.0,heathD\)\*\(1\.-smoothstep\(114\.0,190\.0,heathD\)\)/.test(shader.vertexShader),
  'the domes do not grow in at 28-48 m and sink by the reach');
 const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(), c = new T.Color();
 const leaf = new T.Color('#5a5a3c'), bloom = new T.Color('#a86aa8');
 for (let i = 0; i < heath.count; i += 37) {
  heath.getMatrixAt(i, m); m.decompose(p, q, s);
  assert.equal(w.surface(p.x, p.z), 'heather', `a dome at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} is off the heath`);
  assert.ok(Math.abs(p.y - w.height(p.x, p.z)) < .1, 'a dome floats or is buried');
  assert.ok(s.y >= .3 && s.y <= .55 && s.x > s.y, 'a dome is not a low cushion');
  heath.getColorAt(i, c);
  // Purpler than the leaf, greener than the bloom.
  assert.ok(c.b > leaf.b - .05 && c.b < bloom.b + .05, 'a dome is not in the cushions\' colours');
 }
});

test('every patch of heath grows domes, one a 2.6 m square', () => {
 const {w, heath} = build(LINKS);
 let found = 0;
 for (let x = -w.halfX; x < w.halfX; x += 2.6) for (let z = -w.halfZ; z < w.halfZ; z += 2.6) if (w.surface(x, z) === 'heather') found++;
 // Within 10% of a full scan: the field's quick read loses none of it.
 assert.ok(heath.count > found * .9 && heath.count < found * 1.1, `${heath.count} domes for ${found} squares of heath`);
});

test('a tier with less grass draws a thinner heath, and nowhere without heather grows one', () => {
 const full = build(LINKS).heath.count;
 const low = build(LINKS, {foliage: 1, grass: .35, longGrassReach: 90}).heath;
 assert.ok(low.count < full * .5, `Low drew ${low.count} of ${full}`);
 assert.equal(low.userData.cullReach, 90);
 assert.equal(build({seed: 'DUNE-7', holes: 9, biome: 'pacnw'}).heath, null, 'PNW has no heather');
 assert.equal(build({...LINKS, holes: 9}, {foliage: 1, grass: 1, longGrassReach: 0}).heath, null, 'drawn with no reach to sink it by');
});
