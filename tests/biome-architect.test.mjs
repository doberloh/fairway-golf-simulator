import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCHITECT, ARCHITECT_GENERIC} from '../src/biomes.js';
import {BIOME_KEYS} from '../src/settings-schema.js';
import {STYLES} from '../src/architect-styles.js';
import {TEMPLATES} from '../src/architect.js';
import {CLUBHOUSE_ASPECT} from '../src/clubhouse.js';
import {PATH_KINDS} from '../src/paths.js';
import {STORY_PIECES} from '../src/story.js';

// EVERY LANDSCAPE HAS ITS ARCHITECT (architect-courses; PROJECT_HANDOFF
// *Adding a biome: the Architect side*). A landscape added without an
// architect block still builds -- on ARCHITECT_GENERIC, which reads as
// nowhere in particular -- so this is what says it is not finished, and that
// every name in its block is real.

const ANIMALS = new Set(['sheep', 'deer', 'elk', 'roadrunner', 'goose', 'heron', 'gull', 'raven']);
const check = (key, a) => {
 assert.ok(a.styles?.length, `${key}: no styles to lean toward`);
 for (const k of a.styles) assert.ok(STYLES[k], `${key}: unknown style ${k}`);
 for (const t of a.signature || []) assert.ok(TEMPLATES[t], `${key}: unknown signature template ${t}`);
 assert.ok(CLUBHOUSE_ASPECT[a.clubhouse], `${key}: unknown clubhouse ${a.clubhouse}`);
 assert.ok(Object.values(PATH_KINDS).includes(a.path) || a.path === 'asphalt', `${key}: unknown path ${a.path}`);
 assert.ok(['wood', 'stone'].includes(a.bridge), `${key}: a bridge of ${a.bridge}`);
 const st = a.story || {};
 if (st.walls) assert.ok(['stone', 'leaning', 'hedge'].includes(st.walls), `${key}: walls of ${st.walls}`);
 for (const r of st.ruins || []) assert.ok(STORY_PIECES[r], `${key}: unknown ruin ${r}`);
 if (st.landmark) assert.ok(STORY_PIECES[st.landmark], `${key}: unknown landmark ${st.landmark}`);
 const life = a.life || {};
 for (const [kind] of [life.grazers, life.fliers].filter(Boolean)) assert.ok(ANIMALS.has(kind), `${key}: unknown animal ${kind}`);
 for (const c of ['riprap', 'wall', 'ruin', 'bridgeStone']) assert.match(a.colours?.[c] ?? '', /^#[0-9a-f]{6}$/, `${key}: no ${c} colour`);
 for (const r of ['stone', 'bark', 'accent', 'dirt']) assert.match(a.colours?.clubhouse?.[r] ?? '', /^#[0-9a-f]{6}$/, `${key}: no clubhouse ${r}`);
};

test('every landscape has an architect block, and every name in it is real', () => {
 for (const key of BIOME_KEYS) {
  assert.ok(ARCHITECT[key], `${key} has no architect block (src/biomes.js ARCHITECT): see PROJECT_HANDOFF *Adding a biome: the Architect side*`);
  check(key, {...ARCHITECT_GENERIC, ...ARCHITECT[key]});
 }
 check('generic', ARCHITECT_GENERIC);
 for (const key of Object.keys(ARCHITECT)) assert.ok(BIOME_KEYS.includes(key), `an architect block for ${key}, which is not a landscape`);
});
