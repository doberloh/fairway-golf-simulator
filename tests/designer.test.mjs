import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_COURSE, SCHEMA_VERSION, GENERATOR_VERSION, ARCHITECT_VERSION, STYLE_KEYS, BIOME_KEYS, ARCHITECT_KEEPS, SETTINGS,
 generatorFor, stampLabel, shownFor, migrateSettings, validateSettings} from '../src/settings-schema.js';
import {designSettings, designerScope, DECIDED_KEYS} from '../src/designer.js';
import {STYLES, BIOME_STYLES, styleOf} from '../src/architect-styles.js';
import {exportCourse, importCourse, settingsDiff} from '../src/course-library.js';
import {planScorecard} from '../src/course-plan.js';
import {generateCourse} from '../src/course.js';

// TWO DESIGNERS, ONE WORLD (architect-courses, 30 October 2026). Classic is
// the generator Fairway always had; Architect designs a course from four dials.
// These pin the switch between them: what a save from before the switch
// becomes, what a code carries, the version stamp each kind of course keeps,
// and -- the guarantee the whole mode rests on -- that a Classic course goes
// through `designSettings` untouched.

test('a save from before the switch is Classic, and builds exactly as it did', () => {
 const old = {seed: 'OLDSAVE', holes: 18, biome: 'links', courseYards: 6900, bunkerCount: 3};
 const s = validateSettings(migrateSettings(old, 11));
 assert.equal(s.designer, 'classic');
 assert.equal(generatorFor(s), GENERATOR_VERSION, 'its stamp is the plain generator version, as before');
 assert.equal(designSettings(s), s, 'Classic settings come back as the same object, untouched');
 assert.ok(SCHEMA_VERSION >= 12);
});

test('each kind of course keeps its own stamp', () => {
 assert.equal(generatorFor({}), GENERATOR_VERSION);
 assert.equal(generatorFor({designer: 'classic'}), GENERATOR_VERSION);
 assert.equal(generatorFor({designer: 'architect'}), GENERATOR_VERSION * 1000 + ARCHITECT_VERSION);
 assert.ok(Number.isInteger(generatorFor({designer: 'architect'})), 'one integer, which every reader already accepts');
 assert.equal(stampLabel(GENERATOR_VERSION), String(GENERATOR_VERSION));
 assert.equal(stampLabel(52003), '52 · Architect 3');
});

test('an Architect course is decided by its dials, and resolving twice changes nothing', () => {
 const s = {...DEFAULT_COURSE, designer: 'architect', seed: 'DIALS', holes: 18, biome: 'midwest', bunkerCount: 0, width: 92, courseYards: 2000};
 const d = designSettings(s);
 for (const k of DECIDED_KEYS) assert.notEqual(d[k], undefined, `${k} is decided`);
 assert.notEqual(d.courseYards, 2000, 'a length the player set is not the architect\'s');
 assert.equal(designSettings(d), d, 'idempotent');
 assert.deepEqual(designSettings({...s, width: 20}), d, 'a hidden slider cannot move an Architect course');
 assert.doesNotThrow(() => validateSettings(d), 'the architect\'s settings are valid settings');
 assert.ok(!Object.keys(d).includes('__design'), 'the resolution marker is never saved');
});

test('a code carries only what an Architect course is chosen by', () => {
 const s = validateSettings({...DEFAULT_COURSE, designer: 'architect', seed: 'CODE', holes: 18, archStyle: 'links', archClub: 'championship', archAge: 'old', archStory: 'lots', width: 70});
 const diff = settingsDiff(s);
 for (const k of Object.keys(diff)) assert.ok(ARCHITECT_KEEPS.includes(k), `${k} is not something a player chooses`);
 const back = importCourse(exportCourse({name: 'Architect test', settings: s}));
 for (const k of ['designer', 'archStyle', 'archClub', 'archAge', 'archStory', 'seed', 'holes']) assert.equal(back.settings[k], s[k], k);
 assert.equal(back.generator, generatorFor(s), 'the code carries the Architect stamp');
 const classic = importCourse(exportCourse({name: 'Classic test', settings: validateSettings({seed: 'CODE', width: 70})}));
 assert.equal(classic.settings.width, 70, 'a Classic code keeps its sliders');
 assert.equal(classic.generator, GENERATOR_VERSION);
});

test('the studio shows each designer its own controls', () => {
 const arch = {designer: 'architect'}, classic = {designer: 'classic'};
 const shown = s => SETTINGS.filter(f => shownFor(f, s)).map(f => f.key);
 assert.deepEqual(shown(arch).sort(), [...ARCHITECT_KEEPS].sort());
 for (const k of ['archStyle', 'archClub', 'archAge', 'archStory']) assert.ok(!shown(classic).includes(k), `${k} is Architect's`);
 assert.ok(shown(classic).includes('designer'), 'the switch is on both');
 assert.equal(designerScope(classic), classic);
});

test('every style is a record, and every landscape leans toward real styles', () => {
 assert.deepEqual(STYLE_KEYS.filter(k => k !== 'auto').sort(), Object.keys(STYLES).sort(), 'settings-schema STYLE_KEYS matches the records');
 for (const b of BIOME_KEYS) {
  assert.ok(BIOME_STYLES[b]?.length, `${b} has no styles to lean toward (architect-styles.js BIOME_STYLES)`);
  for (const k of BIOME_STYLES[b]) assert.ok(STYLES[k], `${b} leans toward unknown style ${k}`);
 }
 const picks = new Set(Array.from({length: 40}, (_, i) => styleOf({biome: 'midwest', seed: `S${i}`})));
 assert.ok(picks.size >= 3, 'By landscape picks among the landscape\'s styles');
 assert.equal(styleOf({biome: 'midwest', archStyle: 'links', seed: 'X'}), 'links', 'a chosen style is kept');
});

test('Architect and Classic share the card before the course', () => {
 const s = {seed: 'CARD', holes: 18, designer: 'architect', biome: 'autumn'};
 const card = planScorecard(s);
 const built = Array.from({length: 18}, (_, i) => generateCourse(s, i));
 built.forEach((h, i) => assert.equal(h.par, card.holes[i].par, `hole ${i + 1}: the built par is the card's`));
});
