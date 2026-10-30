// THE ARCHITECT'S DIALS: styles, clubs, ages and the land's story as records
// (architect-courses, 30 October 2026; docs/ARCHITECT_COURSES.md).
//
// A style is whose hand designed the course; a club is who runs it; an age is
// how long it has been there; the story is what the land held before. Each is
// a record, like a biome, so adding one is adding a row -- PROJECT_HANDOFF
// *Adding a style* says what a new one needs.
//
// `architectChoices` turns the four dials, the landscape and the seed into
// every generation setting a Classic player would set by hand -- the
// architect's first decision. Pure. tests/architect.test.mjs.
//
// THE NUMBERS ARE PLACED. Each style's figures are the study's description of
// its hand (docs/ARCHITECT_COURSES.md, *Styles*) turned into the generator's
// own settings, chosen by eye and by the bench, not taken from a source. The
// clubs' lengths are the one exception with a reference: an 18-hole course of
// about 6,200-7,300 yd from the back tees is the usual spread from a public
// course to a championship one (RESEARCH.md *Architect courses*).
import {STYLE_KEYS,DEFAULT_COURSE} from './settings-schema.js';

// Every style. `set` is the generator settings the style decides; `arch` is
// what only the architect reads (architect.js): bunker sizes, how many sit
// where shots land, which concepts it reaches for and how often.
//   lz       share of a hole's bunkers placed against the drive, the rest
//            guarding the green
//   size     bunker size against Classic's (1 = 4.5-10 m by 5-14 m)
//   centre   chance a par 4 or 5 gets a centreline bunker
//   cross    chance a par 5 gets cross bunkers at the lay-up
//   template chance a hole is one of the named templates rather than a plain
//            concept
//   concepts weights for strategic, heroic, penal and risk (risk-reward)
export const STYLES={
 golden:{name:'Golden Age',hand:'Wide fairways, bold greens, flashed sand faces, cloud-edged bunkers, few trees in play',
  set:{width:48,bunkerCount:4,bunkerShape:55,greenScale:115,greenShape:45,greenDifficulty:45,raisedGreens:25,sunkenGreens:10,falseFronts:25,water:25,trees:55,greenTrees:30,doglegs:60,fairwayFeature:15,landform:65,elevation:35},
  arch:{lz:.5,size:1.2,centre:.15,cross:.5,template:.25,concepts:{strategic:6,heroic:2,penal:.5,risk:1.5}}},
 raynor:{name:'Raynor & Macdonald',hand:'Templates, geometric greens with steep straight banks, flat-bottomed bunkers',
  set:{width:44,bunkerCount:4,bunkerShape:5,greenScale:120,greenShape:5,greenDifficulty:50,raisedGreens:50,sunkenGreens:8,falseFronts:35,water:20,trees:45,greenTrees:30,doglegs:55,fairwayFeature:10,landform:55,elevation:30},
  arch:{lz:.45,size:1.1,centre:.1,cross:.6,template:.6,concepts:{strategic:5,heroic:2,penal:1,risk:1}}},
 links:{name:'Links',hand:'Revetted pot bunkers, shared fairways and double greens, no ponds, walls, burns, feeder slopes',
  set:{width:60,bunkerCount:6,bunkerShape:15,greenScale:135,greenShape:40,greenDifficulty:45,raisedGreens:10,sunkenGreens:20,falseFronts:30,water:0,trees:5,greenTrees:10,doglegs:45,fairwayFeature:5,landform:80,elevation:25},
  arch:{lz:.6,size:.5,centre:.3,cross:.5,template:.3,concepts:{strategic:6,heroic:1,penal:1,risk:1}}},
 heathland:{name:'Heathland & Sandbelt',hand:'Large ragged bunker complexes flashed to the green edge, heather, pines',
  set:{width:46,bunkerCount:5,bunkerShape:80,greenScale:110,greenShape:50,greenDifficulty:40,raisedGreens:15,sunkenGreens:10,falseFronts:20,water:15,trees:65,greenTrees:45,doglegs:60,fairwayFeature:15,landform:65,elevation:30},
  arch:{lz:.45,size:1.35,centre:.15,cross:.4,template:.2,concepts:{strategic:6,heroic:2,penal:.5,risk:1}}},
 sandhills:{name:'Sandhills',hand:'Blowout bunkers found rather than built, huge greens, almost no trees, fescue',
  set:{width:70,bunkerCount:3,bunkerShape:90,greenScale:150,greenShape:55,greenDifficulty:50,raisedGreens:10,sunkenGreens:20,falseFronts:15,water:5,trees:10,greenTrees:10,doglegs:55,fairwayFeature:20,landform:80,elevation:45},
  arch:{lz:.55,size:1.45,centre:.25,cross:.3,template:.2,concepts:{strategic:7,heroic:1.5,penal:.3,risk:1.5}}},
 parkland:{name:'Parkland',hand:'Tree-lined corridors, small crowned greens, round bunkers, avenues',
  set:{width:36,bunkerCount:3,bunkerShape:15,greenScale:85,greenShape:20,greenDifficulty:40,raisedGreens:35,sunkenGreens:5,falseFronts:25,water:35,trees:85,greenTrees:60,doglegs:65,fairwayFeature:25,landform:55,elevation:35},
  arch:{lz:.4,size:.9,centre:.05,cross:.3,template:.15,concepts:{strategic:5,heroic:1.5,penal:1,risk:1}}},
 modern:{name:'Modern championship',hand:'Water in play, framing mounds, big bunkers with capes and bays',
  set:{width:40,bunkerCount:4,bunkerShape:60,greenScale:110,greenShape:40,greenDifficulty:40,raisedGreens:30,sunkenGreens:10,falseFronts:20,water:60,pondSize:140,trees:60,greenTrees:40,doglegs:65,fairwayFeature:15,landform:65,elevation:35},
  arch:{lz:.5,size:1.3,centre:.1,cross:.4,template:.15,concepts:{strategic:4,heroic:3,penal:1,risk:2}}},
 stadium:{name:'Stadium',hand:'Railway-tie bulkheads, an island green, waste areas, pot bunkers, spectator mounds',
  set:{width:40,bunkerCount:5,bunkerShape:30,greenScale:90,greenShape:35,greenDifficulty:55,raisedGreens:40,sunkenGreens:5,falseFronts:25,water:70,pondSize:150,trees:45,greenTrees:35,doglegs:65,fairwayFeature:10,landform:60,elevation:30},
  arch:{lz:.5,size:.85,centre:.1,cross:.3,template:.25,concepts:{strategic:3,heroic:3,penal:2,risk:2}}},
 minimalist:{name:'Minimalist',hand:'Very wide fairways, rugged native-edged bunkers, little dirt moved',
  set:{width:75,bunkerCount:3,bunkerShape:85,greenScale:125,greenShape:50,greenDifficulty:40,raisedGreens:10,sunkenGreens:20,falseFronts:15,water:10,trees:25,greenTrees:20,doglegs:55,fairwayFeature:25,landform:75,elevation:40},
  arch:{lz:.55,size:1.2,centre:.25,cross:.35,template:.2,concepts:{strategic:7,heroic:1.5,penal:.3,risk:1.5}}},
 desert:{name:'Desert target',hand:'Turf ribbons in native desert, arroyos, boulder walls',
  set:{width:34,bunkerCount:3,bunkerShape:50,greenScale:100,greenShape:40,greenDifficulty:40,raisedGreens:30,sunkenGreens:10,falseFronts:20,water:30,trees:40,greenTrees:30,doglegs:65,fairwayFeature:20,landform:70,elevation:35},
  arch:{lz:.45,size:1.05,centre:.1,cross:.3,template:.15,concepts:{strategic:4,heroic:3,penal:1.5,risk:1.5}}},
 mountain:{name:'Mountain',hand:'Terraced tees, stairs, rock outcrops in play, uphill and downhill par 3s, greens on shelves',
  set:{width:40,bunkerCount:3,bunkerShape:40,greenScale:90,greenShape:35,greenDifficulty:40,raisedGreens:40,sunkenGreens:5,falseFronts:20,water:25,creeks:1,trees:70,greenTrees:45,doglegs:65,fairwayFeature:20,landform:75,elevation:70},
  arch:{lz:.4,size:.95,centre:.05,cross:.25,template:.15,concepts:{strategic:4,heroic:3,penal:1,risk:1.5}}},
 tropical:{name:'Tropical resort',hand:'Palm avenues, waterfalls between ponds, beach bunkers, peninsula greens, flowers',
  set:{width:44,bunkerCount:4,bunkerShape:50,greenScale:105,greenShape:40,greenDifficulty:35,raisedGreens:25,sunkenGreens:10,falseFronts:20,water:50,pondSize:130,trees:70,greenTrees:45,doglegs:60,fairwayFeature:20,landform:60,elevation:30},
  arch:{lz:.45,size:1.15,centre:.05,cross:.3,template:.15,concepts:{strategic:4,heroic:2.5,penal:1,risk:2}}},
};
// Who runs the course. `yards` is the back-tee length for eighteen holes;
// `mul` scales the style's own figures; `set` overrides outright.
export const CLUBS={
 municipal:{name:'Municipal',yards:6250,mul:{bunkerCount:.75,width:1.1,trees:.9},set:{semiRough:4,fringe:1.5,greenDifficulty:-8,homes:true,homeDensity:35}},
 members:{name:"Members' club",yards:6650,mul:{},set:{semiRough:6,fringe:2}},
 resort:{name:'Resort',yards:6850,mul:{water:1.25,width:1.05},set:{semiRough:5,fringe:2.5,greenDifficulty:-5,homes:true,homeDensity:55,homeSetback:40}},
 championship:{name:'Championship venue',yards:7250,mul:{bunkerCount:1.2,width:.9},set:{semiRough:8,fringe:2,greenDifficulty:8}},
};
// How long it has been there. Trees grow; old courses gain specimen trees.
export const AGES={
 new:{name:'New',mul:{trees:.65},set:{greenTrees:-15,fairwayFeature:-100}},
 mature:{name:'Mature',mul:{},set:{}},
 old:{name:'Old',mul:{trees:1.2},set:{greenTrees:15,fairwayFeature:15}},
 restored:{name:'Restored',mul:{trees:.75},set:{greenTrees:-15,fairwayFeature:10}},
};
// What the land held before. Phase 6 builds its walls and remains; here it is
// only the water a story brings (a burn, a creek).
export const STORIES={
 none:{name:'None',set:{creeks:0}},
 some:{name:'A little',set:{}},
 lots:{name:'A lot',add:{creeks:1}},
};
// The styles each landscape leans toward, most likely first. The study's
// landscape table (docs/ARCHITECT_COURSES.md, *Each landscape*).
export const BIOME_STYLES={
 links:['links','minimalist','heathland'],
 lakeshore:['links','sandhills','minimalist'],
 island:['tropical','stadium'],
 desert:['desert','stadium','minimalist'],
 mountain:['mountain'],
 pnw:['heathland','golden','parkland'],
 redwood:['parkland','golden'],
 autumn:['raynor','golden','parkland'],
 midwest:['golden','raynor','parkland','sandhills'],
 haunted:['heathland','links'],
};
// A landscape added without a row here falls back to these (PROJECT_HANDOFF
// *Adding a biome*, the Architect side).
export const GENERIC_STYLES=['modern','parkland'];

// FNV-1a and Mulberry32, as course-plan.js's `rng` -- repeated rather than
// imported so this module stays free of the generator's imports. Every
// Architect stream is named `seed|arch|<what>[|<hole>]`.
export function archStream(...parts){let a=2166136261;for(const c of parts.join('|')){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

// The style a course is built in: the chosen one, or By landscape's pick from
// the seed. Its own stream, so it can never move a Classic draw.
export function styleOf(s){
 if(s?.archStyle&&s.archStyle!=='auto'&&STYLES[s.archStyle])return s.archStyle;
 const list=BIOME_STYLES[s?.biome]||GENERIC_STYLES,r=archStream(s?.seed||'EVERGREEN','arch','style')();
 // The first style twice as likely as each after it.
 const w=list.map((_,i)=>i===0?2:1),total=w.reduce((a,b)=>a+b,0);
 let t=r*total;for(let i=0;i<list.length;i++){t-=w[i];if(t<0)return list[i];}
 return list[list.length-1];
}

// The generator's own bounds, so a dial can never push a setting off the end.
const BOUNDS={width:[20,92],bunkerCount:[0,8],water:[0,100],trees:[0,100],greenTrees:[0,100],fairwayFeature:[0,100],greenDifficulty:[0,100],creeks:[0,3],homeDensity:[0,100]};
const fit=(k,v)=>{const b=BOUNDS[k];if(!b)return v;const r=Math.min(b[1],Math.max(b[0],v));return k==='bunkerCount'||k==='creeks'?Math.round(r):Math.round(r*100)/100;};

// The architect's settings: the style's, scaled and set by the club and the
// age, the story's water, and the club's length for the number of holes.
export function architectChoices(s){
 const holes=s.holes===18?18:s.holes===1?1:9;
 const style=STYLES[styleOf(s)],club=CLUBS[s.archClub]||CLUBS.members,age=AGES[s.archAge]||AGES.mature,story=STORIES[s.archStory]||STORIES.some;
 const out={...DEFAULT_COURSE,...style.set};
 for(const layer of [club,age]){
  for(const [k,m] of Object.entries(layer.mul||{}))out[k]=fit(k,out[k]*m);
  for(const [k,v] of Object.entries(layer.set||{}))out[k]=typeof v==='number'&&typeof DEFAULT_COURSE[k]==='number'&&['greenTrees','fairwayFeature','greenDifficulty'].includes(k)?fit(k,out[k]+v):v;
 }
 Object.assign(out,story.set||{});
 for(const [k,v] of Object.entries(story.add||{}))out[k]=fit(k,(out[k]??0)+v);
 // Links land has no ponds (the style says so); an island has no inland water
 // at all, which the generator already refuses -- nothing to do here.
 out.courseYards=Math.round(club.yards*holes/18/10)*10;
 out.footprint='organic';
 out.holes=holes;
 return out;
}

export const STYLE_LIST=STYLE_KEYS.filter(k=>k!=='auto');
