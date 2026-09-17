import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_COURSE,SCHEMA_VERSION,GENERATOR_VERSION,validateSettings} from '../src/settings-schema.js';

// Node has no Web Storage, and the library reads localStorage lazily, so a stub
// installed before the first call is enough.
function useStorage(){
 const map=new Map();
 globalThis.localStorage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),clear:()=>map.clear()};
 return map;
}
useStorage();
const lib=await import('../src/course-library.js');
const {listCourses,saveCourse,deleteCourse,renameCourse,findCourse,exportCourse,importCourse,settingsDiff,courseSettings,MAX_NAME}=lib;

const sample={...DEFAULT_COURSE,seed:'SHARED-1',biome:'links',holes:18,courseYards:6480,rivers:1,pondSize:200,homes:true};

// Builds a well-formed code around an arbitrary payload, so tests can present a
// code whose checksum is correct but whose contents are not a course.
function makeCode(payload){
 const body=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
 let a=2166136261;for(let i=0;i<body.length;i++){a^=body.charCodeAt(i);a=Math.imul(a,16777619);}
 return `FW1.${body}.${(a>>>0).toString(36).padStart(7,'0').slice(-6)}`;
}

test('courses save, list, rename and delete',()=>{
 useStorage();
 assert.deepEqual(listCourses(),[]);
 const a=saveCourse({name:'Dune Run',settings:sample});
 assert(a.id);
 assert.equal(listCourses().length,1);
 assert.equal(findCourse(a.id).name,'Dune Run');
 assert.equal(findCourse(a.id).settings.seed,'SHARED-1');
 saveCourse({name:'Second',settings:DEFAULT_COURSE});
 assert.equal(listCourses().length,2);
 renameCourse(a.id,'Dune Run West');
 assert.equal(findCourse(a.id).name,'Dune Run West');
 deleteCourse(a.id);
 assert.equal(listCourses().length,1);
 assert.equal(findCourse(a.id),null);
 assert.throws(()=>renameCourse(a.id,'Gone'),/no longer in the library/);
});

test('a saved course keeps landscape settings and drops the player’s own gear',()=>{
 useStorage();
 const mixed={...sample,turf:{stimp:13,fairway:100,semi:100,rough:100},clubYardages:{driver:265},flightProfile:{speed:105,spin:100,launch:0,axis:0},style:'cartoon'};
 const rec=saveCourse({name:'No Gear',settings:mixed});
 assert.equal(rec.settings.turf,undefined,'club and turf preferences are not part of a course');
 assert.equal(rec.settings.clubYardages,undefined);
 assert.equal(rec.settings.flightProfile,undefined);
 assert.equal(rec.settings.style,undefined);
 assert.equal(rec.settings.pondSize,200);
 assert.equal(findCourse(rec.id).settings.clubYardages,undefined);
});

test('names are required and bounded',()=>{
 useStorage();
 assert.throws(()=>saveCourse({name:'   ',settings:sample}),/1–40 characters/);
 assert.throws(()=>saveCourse({name:'x'.repeat(MAX_NAME+1),settings:sample}),/1–40 characters/);
 assert.equal(saveCourse({name:'  Trimmed  ',settings:sample}).name,'Trimmed');
});

test('a course survives a round trip through an export code',()=>{
 useStorage();
 const rec=saveCourse({name:'Travelling Course',settings:sample});
 const code=exportCourse(rec);
 assert(code.startsWith('FW1.'));
 const back=importCourse(code);
 assert.equal(back.name,'Travelling Course');
 assert.deepEqual(back.settings,courseSettings(validateSettings(sample)));
 // Whitespace from a pasted email or chat message must not break it.
 assert.deepEqual(importCourse('  '+code.slice(0,20)+'\n'+code.slice(20)+' \n').settings,back.settings);
});

test('codes carry only what differs from the defaults, so they stay short',()=>{
 const plain=exportCourse({name:'Stock',generator:GENERATOR_VERSION,settings:DEFAULT_COURSE});
 assert.deepEqual(settingsDiff(DEFAULT_COURSE),{});
 assert(plain.length<120,`a default course code should be short, got ${plain.length}`);
 const full=exportCourse({name:'Travelling Course',generator:GENERATOR_VERSION,settings:sample});
 assert(full.length<400,`a customised course code should stay pasteable, got ${full.length}`);
 assert(full.length>plain.length);
});

test('damaged, foreign and future codes are refused with a reason',()=>{
 const code=exportCourse({name:'Real',generator:GENERATOR_VERSION,settings:sample});
 assert.throws(()=>importCourse('hello world'),/does not look like a Fairway course code/);
 assert.throws(()=>importCourse('FW1.abc'),/does not look like a Fairway course code/);
 assert.throws(()=>importCourse(code.slice(0,code.length-12)+'.'+code.slice(-6)),/incomplete or altered/);
 const [p,body,sum]=code.split('.');
 assert.throws(()=>importCourse(`${p}.${body}x.${sum}`),/incomplete or altered/);
 // Payloads whose checksum is correct but whose contents are not a course.
 assert.throws(()=>importCourse(makeCode([1,2,3])),/could not be read/);
 assert.throws(()=>importCourse(makeCode('just a string')),/could not be read/);
 assert.throws(()=>importCourse(makeCode({v:2,g:1,n:'Bad Biome',d:{biome:'nowhere'}})),/not a recognised option/);
 assert.throws(()=>importCourse(makeCode({v:2,g:1,n:'x'.repeat(MAX_NAME+1),d:{}})),/1–40 characters/);
 // A missing name is not an error; it gets a usable placeholder.
 assert.equal(importCourse(makeCode({v:2,g:1,d:{}})).name,'Imported course');
 assert.throws(()=>importCourse(makeCode({v:2,g:1,n:'Out Of Range',d:{trees:900}})),/Tree density/);
});

test('a code from an older schema migrates on import; a newer one is refused',()=>{
 useStorage();
 // Hand-built version 1 payload: dead tee toggles, no pond size.
 const rec=importCourse(makeCode({v:1,g:1,n:'Old Timer',d:{seed:'ANCIENT',biome:'autumn',teeBlue:true,teeRed:false,water:70}}));
 assert.equal(rec.name,'Old Timer');
 assert.equal(rec.settings.seed,'ANCIENT');
 assert.equal(rec.settings.water,70);
 assert.equal(rec.settings.pondSize,120,'migrated courses keep the ponds they were designed with');
 assert.equal(rec.settings.teeBlue,undefined);
 assert.equal(rec.generator,1);
 assert.doesNotThrow(()=>saveCourse({...rec}));

 assert.throws(()=>importCourse(makeCode({v:SCHEMA_VERSION+1,g:99,n:'From The Future',d:{}})),/newer version of Fairway/);
});

test('an imported course remembers the generator it was designed against',()=>{
 useStorage();
 const rec=saveCourse({name:'Foreign',settings:sample,generator:0});
 assert.equal(findCourse(rec.id).generator,0,'so the library can flag that its landscape may differ');
 assert.equal(saveCourse({name:'Native',settings:sample}).generator,GENERATOR_VERSION);
});

test('a corrupt entry is skipped rather than taking the library with it',()=>{
 const map=useStorage();
 const good=saveCourse({name:'Intact',settings:sample});
 const stored=JSON.parse(map.get('fairway-courses-v1'));
 stored.courses.push({id:'broken',name:'Broken',schema:2,settings:{biome:'nowhere'}});
 stored.courses.push(null);
 stored.courses.push({nonsense:true});
 map.set('fairway-courses-v1',JSON.stringify(stored));
 const list=listCourses();
 assert.equal(list.length,1);
 assert.equal(list[0].id,good.id);
 // Unreadable storage yields an empty library instead of throwing.
 map.set('fairway-courses-v1','{not json');
 assert.deepEqual(listCourses(),[]);
});

test('a full library refuses politely instead of silently dropping a course',()=>{
 useStorage();
 for(let i=0;i<lib.MAX_COURSES;i++)saveCourse({name:'Course '+i,settings:DEFAULT_COURSE});
 assert.throws(()=>saveCourse({name:'One Too Many',settings:DEFAULT_COURSE}),/at most 200 courses/);
 assert.equal(listCourses().length,lib.MAX_COURSES);
});

// The identity the import dedupe is built on. Re-importing a backup used to
// double the library, and with no rename there was no way to sort it out after.
// The panel decides "same course" by name plus normalised generation settings,
// which only works if that pair is stable across everything a course goes
// through on its way back in.
const identity=(name,settings)=>JSON.stringify([String(name).trim(),courseSettings(validateSettings(settings))]);

test('a course keeps one identity through save, export and import',()=>{
 // An earlier test fills the library to its cap; this one needs a shelf.
 localStorage.clear();
 const saved=saveCourse({name:'Dune Run',settings:sample});
 const back=importCourse(exportCourse(saved));
 assert.equal(identity(back.name,back.settings),identity(saved.name,saved.settings),
  'a round trip must not change what the course IS, or a re-import duplicates it');
 // And through a file, which carries the stored record rather than a code.
 const viaFile=JSON.parse(JSON.stringify(listCourses().find(c=>c.id===saved.id)));
 assert.equal(identity(viaFile.name,viaFile.settings),identity(saved.name,saved.settings));
 deleteCourse(saved.id);
});

test('identity ignores play-scope settings, which never travel with a course',()=>{
 // A course record drops club yardages and flight profile on the way in, so two
 // people sharing one landscape must still recognise it as the same course.
 const mine={...sample,clubYardages:{driver:225},flightProfile:{speed:104,spin:96,launch:0,axis:0}};
 assert.equal(identity('Dune Run',mine),identity('Dune Run',sample));
});

test('identity separates courses that genuinely differ',()=>{
 assert.notEqual(identity('Dune Run',sample),identity('Dune Run West',sample),'a different name is a different course');
 assert.notEqual(identity('Dune Run',sample),identity('Dune Run',{...sample,seed:'OTHER'}),'a different landscape is a different course');
 // Whitespace around a name is not a second course: the panel trims, and
 // `validName` trims, so the identity has to trim too.
 assert.equal(identity('  Dune Run  ',sample),identity('Dune Run',sample));
});

test('identity is stable key order, not accidental object order',()=>{
 // `courseSettings` builds from `generationKeys()` in a fixed order, which is
 // the only reason JSON.stringify can be used as the key at all.
 const shuffled={};
 for(const k of Object.keys(sample).reverse())shuffled[k]=sample[k];
 assert.equal(identity('Dune Run',shuffled),identity('Dune Run',sample));
});
