import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA_VERSION,GENERATOR_VERSION,SETTINGS,FIELD,CATEGORIES,BIOME_KEYS,FOOTPRINT_KEYS,DEFAULT_COURSE,bound,validateSettings,migrateSettings,generationKeys,PLAY_KEYS,playScope} from '../src/settings-schema.js';
import {randomSettings} from '../src/settings-schema.js';
import {BIOMES,generateCourse,random} from '../src/course.js';
import {FOOTPRINTS} from '../src/footprints.js';

test('the schema is the single source of defaults, and every entry is complete',()=>{
 assert(Number.isInteger(SCHEMA_VERSION)&&SCHEMA_VERSION>=1);
 assert(Number.isInteger(GENERATOR_VERSION)&&GENERATOR_VERSION>=1);
 const categories=new Set(CATEGORIES.map(([k])=>k));
 for(const f of SETTINGS){
  assert(f.key&&f.label&&f.tip,`${f.key} needs a label and help text`);
  assert(categories.has(f.category),`${f.key} sits in an unknown category`);
  assert(['range','int','choice','toggle','text'].includes(f.kind),`${f.key} has an unknown kind`);
  assert(f.def!==undefined,`${f.key} needs a default`);
 }
 assert.equal(new Set(SETTINGS.map(f=>f.key)).size,SETTINGS.length,'duplicate setting key');
 assert.deepEqual(Object.keys(DEFAULT_COURSE).sort(),generationKeys().sort());
 // Defaults must themselves be valid, or a fresh course starts out rejected.
 assert.doesNotThrow(()=>validateSettings(DEFAULT_COURSE));
});

test('every setting belongs to exactly one rendered category, in a sensible order',()=>{
 // The studio panel renders CATEGORIES in order and filters SETTINGS by
 // category, so a setting in no category would silently never be shown.
 const used=new Set();
 let covered=0;
 for(const [key,label,note] of CATEGORIES){
  assert(label&&typeof label==='string',`${key} needs a heading`);
  assert(!used.has(key),`duplicate category ${key}`);
  used.add(key);
  if(note!==undefined)assert(typeof note==='string'&&note.length>20,`${key}'s note should say something useful`);
  const members=SETTINGS.filter(f=>f.category===key);
  assert(members.length,`category ${key} renders a heading with nothing under it`);
  covered+=members.length;
 }
 assert.equal(covered,SETTINGS.length,'every setting must fall into a rendered category');
 // Help text is what the panel shows behind each control's hint button.
 for(const f of SETTINGS)assert(f.tip.length>25&&f.tip.trim()===f.tip,`${f.key} needs real help text`);
});

test('the schema key lists stay in step with the modules that own them',()=>{
 assert.deepEqual(BIOME_KEYS.slice().sort(),Object.keys(BIOMES).sort());
 assert.deepEqual(FOOTPRINT_KEYS.slice().sort(),Object.keys(FOOTPRINTS).sort());
});

test('validation rejects out-of-range, wrong-typed and contradictory settings',()=>{
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,trees:140}),/Tree density/);
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,lakes:1.5}),/whole number/);
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,homes:'yes'}),/on or off/);
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,biome:'tundra'}),/not a recognised option/);
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,footprint:'zigzag'}),/not a recognised option/);
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,seed:''}),/Course seed/);
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,seed:'x'.repeat(51)}),/Course seed/);
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,waterMin:4,waterMax:2}),/cannot exceed/);
 // Bounds that depend on another field follow it: 6480 yd is a normal eighteen
 // and far past the longest nine.
 assert.throws(()=>validateSettings({...DEFAULT_COURSE,holes:9,courseYards:6480}),/Course length/);
 assert.doesNotThrow(()=>validateSettings({...DEFAULT_COURSE,holes:18,courseYards:6480}));
 assert.equal(bound(FIELD.courseYards.max,{holes:9}),4230);
 assert.equal(bound(FIELD.courseYards.max,{holes:18}),8460);
});

test('play-scope settings survive validation instead of being stripped',()=>{
 const out=validateSettings({...DEFAULT_COURSE,turf:{stimp:11},clubYardages:{driver:260},style:'cartoon'});
 assert.equal(out.turf.stimp,11);
 assert.equal(out.clubYardages.driver,260);
 assert.equal(out.style,'cartoon');
});

test('every schema version between 1 and the current one has a migration',()=>{
 // A gap here is silent: the loop in migrateSettings simply skips the missing
 // step, and a save arrives short of whatever that version added. Adding a
 // setting means bumping SCHEMA_VERSION and writing the step that supplies it --
 // this is the assertion that notices when only the first half was done.
 for(let v=1;v<SCHEMA_VERSION;v++){
  const migrated=migrateSettings({seed:'STEP',biome:'pnw'},v);
  assert.doesNotThrow(()=>validateSettings(migrated),`a version ${v} save does not survive migration`);
  for(const f of SETTINGS)
   assert.notEqual(migrated[f.key],undefined,`a version ${v} save comes through without ${f.key}`);
 }
});
test('a version 1 save migrates silently: dead tee toggles go, pond size arrives',()=>{
 const legacy={seed:'OLD',biome:'links',water:60,teeBlue:true,teeWhite:false,teeRed:true,turf:{stimp:9}};
 const s=migrateSettings(legacy,1);
 assert.equal(s.teeBlue,undefined);
 assert.equal(s.teeWhite,undefined);
 assert.equal(s.teeRed,undefined);
 // 120 is the size the generator always used, so a migrated course keeps its ponds.
 assert.equal(s.pondSize,120);
 assert.equal(s.seed,'OLD');
 assert.equal(s.biome,'links');
 assert.equal(s.water,60);
 assert.equal(s.turf.stimp,9,'play settings ride along untouched');
 // 3 -> 4: hole locations started moving through the week. A save from before
 // that was played with the cup in the middle of its greens, so it comes back as
 // Thursday -- the gentlest setup -- rather than whatever a later day would cut.
 assert.equal(s.pinDay,'Thursday');
 assert.doesNotThrow(()=>validateSettings(s));
});

test('a save from before raised greens, punchbowls and false fronts keeps none of them',()=>{
 // 8 -> 9. Their greens change shape anyway (GENERATOR_VERSION 33, which the
 // player is told about); what the migration must not do is quietly hand an old
 // course a quarter of its greens on pedestals as well.
 const old={...DEFAULT_COURSE,seed:'OLDGREENS'};
 delete old.raisedGreens;delete old.sunkenGreens;delete old.falseFronts;
 const s=migrateSettings(old,8);
 assert.equal(s.raisedGreens,0);assert.equal(s.sunkenGreens,0);assert.equal(s.falseFronts,0);
 assert.doesNotThrow(()=>validateSettings(s));
 // And a new course gets the defaults.
 assert.ok(DEFAULT_COURSE.raisedGreens>0&&DEFAULT_COURSE.falseFronts>0);
});

test('the green slope slider warns past 75%, and says 100% is extreme',()=>{
 // The studio turns the slider red and shows this note past `above`; the owner
 // asked for the top of the range to be called out. A warning is not a setting,
 // so it must not reach a saved settings object.
 const w=FIELD.greenDifficulty.warn;
 assert.equal(w.above,75);
 assert.ok(/100%/.test(w.text)&&/extreme/.test(w.text),w.text);
 assert.ok(w.toast.length<60,'the toast is one short line');
 assert.ok(!('warn' in DEFAULT_COURSE));
});

test('migrating an already current save is a no-op, and gaps fall back to defaults',()=>{
 const current=validateSettings({...DEFAULT_COURSE,water:80});
 assert.deepEqual(migrateSettings(current,SCHEMA_VERSION),current);
 const sparse=migrateSettings({seed:'SPARSE'},SCHEMA_VERSION);
 assert.equal(sparse.seed,'SPARSE');
 assert.equal(sparse.trees,DEFAULT_COURSE.trees);
 assert.doesNotThrow(()=>validateSettings(sparse));
});

test('a surprise course is always valid, always a nine, and never the same twice',()=>{
 const seeds=new Set(),biomes=new Set();
 for(let i=0;i<60;i++){
  const s=randomSettings(random('surprise-'+i));
  // Whatever it rolls must pass the same validator a hand-made course faces.
  assert.doesNotThrow(()=>validateSettings(s),`roll ${i} produced settings the validator rejects`);
  assert.equal(s.holes,9,'a surprise round should not be a ten-second eighteen-hole wait');
  assert(s.waterMin<=s.waterMax);
  assert(s.courseYards>=9*110&&s.courseYards<=9*470);
  seeds.add(s.seed);biomes.add(s.biome);
 }
 assert(seeds.size>55,`only ${seeds.size} distinct seeds in 60 rolls`);
 assert(biomes.size>=5,`only ${biomes.size} biomes in 60 rolls`);
 // Overrides win, so callers can pin anything they need.
 assert.equal(randomSettings(random('x'),{biome:'links',holes:18,courseYards:6480}).biome,'links');
 assert.equal(randomSettings(random('x'),{holes:18,courseYards:6480}).holes,18);
});

test('the pond size default reproduces the dimensions earlier courses were built with',()=>{
 for(const seed of ['PONDS-A','PONDS-B']){
  const base=generateCourse({seed,water:100});
  const explicit=generateCourse({seed,water:100,pondSize:120});
  assert.deepEqual(explicit.ponds.map(p=>[p.rx,p.rz]),base.ponds.map(p=>[p.rx,p.rz]));
  const bigger=generateCourse({seed,water:100,pondSize:240});
  assert(bigger.ponds.length>0,'this fixture needs ponds to be meaningful');
  for(let i=0;i<bigger.ponds.length;i++)assert(bigger.ponds[i].rx>base.ponds[i].rx,'a larger pond size must widen the pond');
 }
});

test('every setting can be rendered and read back by the studio', () => {
 // Course studio renders each control from the live settings object and reads it
 // back by the field's own key. Two things have to hold for that to work, and
 // both of them have failed.
 //
 // First, a field has to carry what its control needs: a range or an int wants
 // bounds, a choice wants options. A choice without them fell through to the
 // slider renderer and came out as a range control with no min, no max, and the
 // word 'Thursday' where a number belonged.
 //
 // Second, every field needs a default, because the studio can be opened before
 // any course has been loaded. The live settings object used to be a hand-written
 // partial copy of these defaults holding eleven of the thirty-eight; the other
 // twenty-seven rendered as `undefined` captions over sliders the browser had
 // quietly parked at the midpoint of their range.
 const kinds = new Set(['range', 'int', 'choice', 'toggle', 'text']);
 for (const f of SETTINGS) {
  assert.ok(kinds.has(f.kind), `${f.key} has an unrenderable kind: ${f.kind}`);
  assert.notEqual(f.def, undefined, `${f.key} has no default`);
  assert.notEqual(DEFAULT_COURSE[f.key], undefined, `${f.key} is missing from DEFAULT_COURSE`);
  if (f.kind === 'range' || f.kind === 'int') {
   assert.notEqual(f.min, undefined, `${f.key} is a ${f.kind} with no minimum`);
   assert.notEqual(f.max, undefined, `${f.key} is a ${f.kind} with no maximum`);
  }
  if (f.kind === 'choice') {
   assert.ok(Array.isArray(f.options) && f.options.length > 1, `${f.key} is a choice with no options`);
   assert.ok(f.options.includes(f.def), `${f.key} defaults to something it does not offer`);
  }
 }
 // And the defaults are a complete, valid course on their own.
 assert.doesNotThrow(() => validateSettings({...DEFAULT_COURSE}));
 assert.equal(Object.keys(DEFAULT_COURSE).length, SETTINGS.length);
});


// The golfer's own settings, and the reason they need naming at all.
test('play-scope keys are not schema fields, which is exactly why they get lost',()=>{
 // If one of these ever becomes a schema field it will be in DEFAULT_COURSE and
 // this whole mechanism is unnecessary -- but until then, rebuilding settings
 // from DEFAULT_COURSE drops them silently, which is how an endless run reset a
 // player's bag.
 for(const k of PLAY_KEYS){
  assert.ok(!(k in DEFAULT_COURSE),`${k} is in DEFAULT_COURSE; PLAY_KEYS may be obsolete`);
  assert.ok(!generationKeys().includes(k),`${k} is a generation key and must not ride along`);
 }
 assert.ok(!PLAY_KEYS.includes('style'),'art direction belongs to the mode, not the golfer');
});

test('play scope carries the golfer across a settings object rebuilt from scratch',()=>{
 const mine={...DEFAULT_COURSE,seed:'MINE',clubYardages:{driver:225},
  flightProfile:{speed:104,spin:96,launch:1,axis:0},turf:{stimp:12}};
 // What an endless hole does: grow fresh ground, keep the golfer.
 const grown={...DEFAULT_COURSE,seed:'GROWN',...playScope(mine)};
 assert.equal(grown.seed,'GROWN','the ground is the new hole’s');
 assert.equal(grown.clubYardages.driver,225,'the bag is the player’s');
 assert.equal(grown.flightProfile.speed,104);
 assert.equal(grown.turf.stimp,12);
});

test('play scope reports only what is there, and nothing of the course',()=>{
 assert.deepEqual(playScope({}),{});
 assert.deepEqual(playScope(),{});
 assert.deepEqual(playScope({seed:'X',biome:'pnw',trees:40}),{},'no generation key may leak through');
 // A key present but undefined is absent, not a key whose value is undefined --
 // spreading `{clubYardages: undefined}` would blank a bag rather than keep it.
 assert.deepEqual(playScope({clubYardages:undefined}),{});
});

test('migration keeps the golfer too',()=>{
 // migrateSettings rebuilds around DEFAULT_COURSE, and its own comment promises
 // these ride along. Asserted rather than trusted.
 const out=migrateSettings({seed:'OLD',clubYardages:{driver:225},turf:{stimp:9}},1);
 assert.equal(out.clubYardages.driver,225);
 assert.equal(out.turf.stimp,9);
});
