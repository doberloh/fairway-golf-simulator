// Named courses kept on this device, plus the portable code that moves one to
// another device. A course record is settings and a name — never a round, a lie
// or a score — so the same course can be played as any format with any group.
import {SCHEMA_VERSION,GENERATOR_VERSION,DEFAULT_COURSE,generationKeys,validateSettings,migrateSettings} from './settings-schema.js';

const KEY='fairway-courses-v1';
const PREFIX='FW1';
export const MAX_COURSES=200;
export const MAX_NAME=40;

// Play-scope settings (turf, club yardages, flight profile) share one object
// with generation settings at runtime. A shared course must not carry the
// author's club distances, so records keep generation keys only.
export function courseSettings(settings={}){const out={};for(const k of generationKeys())if(settings[k]!==undefined)out[k]=settings[k];return out;}
// Codes carry only what differs from the defaults, which keeps a typical course
// a couple of hundred characters instead of eight hundred.
export function settingsDiff(settings={}){const out={};for(const k of generationKeys())if(settings[k]!==DEFAULT_COURSE[k])out[k]=settings[k];return out;}

const newId=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function validName(name){const n=String(name??'').trim();if(!n.length||n.length>MAX_NAME)throw Error(`Give the course a name of 1–${MAX_NAME} characters.`);return n;}

function readStore(){try{const raw=localStorage.getItem(KEY);if(!raw)return [];const d=JSON.parse(raw);return Array.isArray(d?.courses)?d.courses:[];}catch{return [];}}
function writeStore(courses){
 try{localStorage.setItem(KEY,JSON.stringify({version:1,courses}));}
 catch{throw Error('This browser will not store any more courses. Delete one, or export this course as a code instead.');}
}

// The stored generator version is preserved rather than refreshed: it is what
// tells a later build that this course was designed against different ground.
function normalise(raw){
 if(!raw||typeof raw.id!=='string'||typeof raw.name!=='string')throw Error('Invalid course record.');
 const schema=Number.isInteger(raw.schema)?raw.schema:1;
 const settings=validateSettings(migrateSettings(raw.settings||{},schema));
 return {id:raw.id,name:validName(raw.name),created:Number(raw.created)||0,generator:Number.isInteger(raw.generator)?raw.generator:0,schema:SCHEMA_VERSION,settings:courseSettings(settings)};
}

// One unreadable entry must not take the whole library down with it.
export function listCourses(){const out=[];for(const raw of readStore()){try{out.push(normalise(raw));}catch{}}return out;}
export function findCourse(id){return listCourses().find(c=>c.id===id)||null;}

export function saveCourse({id,name,settings,generator=GENERATOR_VERSION}={}){
 const record={id:id||newId(),name:validName(name),created:Date.now(),generator,schema:SCHEMA_VERSION,settings:courseSettings(validateSettings(settings))};
 const courses=readStore().filter(c=>c&&c.id!==record.id);
 if(courses.length>=MAX_COURSES)throw Error(`The library holds at most ${MAX_COURSES} courses. Delete one first.`);
 courses.unshift(record);writeStore(courses);return record;
}
export function deleteCourse(id){writeStore(readStore().filter(c=>c&&c.id!==id));}
export function renameCourse(id,name){
 const courses=readStore(),found=courses.find(c=>c&&c.id===id);
 if(!found)throw Error('That course is no longer in the library.');
 found.name=validName(name);writeStore(courses);return normalise(found);
}

// UTF-8 safe: btoa alone mangles anything outside Latin-1, and course names are
// free text.
const toB64=s=>{const bytes=new TextEncoder().encode(s);let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const fromB64=c=>{const bin=atob(c.replace(/-/g,'+').replace(/_/g,'/'));return new TextDecoder().decode(Uint8Array.from(bin,ch=>ch.charCodeAt(0)));};
const checksum=s=>{let a=2166136261;for(let i=0;i<s.length;i++){a^=s.charCodeAt(i);a=Math.imul(a,16777619);}return (a>>>0).toString(36).padStart(7,'0').slice(-6);};

export function exportCourse(record){
 const settings=validateSettings(record?.settings||{});
 const body=toB64(JSON.stringify({v:SCHEMA_VERSION,g:record?.generator??GENERATOR_VERSION,n:validName(record?.name),d:settingsDiff(settings)}));
 return `${PREFIX}.${body}.${checksum(body)}`;
}

// Returns a record that has not been stored yet, so a caller can show it before
// committing. Codes from a newer Fairway are refused rather than guessed at.
export function importCourse(code){
 const parts=String(code??'').replace(/\s+/g,'').split('.');
 if(parts.length!==3||parts[0]!==PREFIX)throw Error('That does not look like a Fairway course code.');
 if(checksum(parts[1])!==parts[2])throw Error('This course code looks incomplete or altered. Copy the whole code and try again.');
 let payload;
 try{payload=JSON.parse(fromB64(parts[1]));}catch{throw Error('This course code could not be read.');}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('This course code could not be read.');
 const schema=Number.isInteger(payload.v)?payload.v:1;
 if(schema>SCHEMA_VERSION)throw Error('This course was made by a newer version of Fairway. Update Fairway, then import it again.');
 const settings=validateSettings(migrateSettings(payload.d||{},schema));
 return {name:validName(payload.n||'Imported course'),generator:Number.isInteger(payload.g)?payload.g:0,settings:courseSettings(settings)};
}
