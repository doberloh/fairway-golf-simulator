// THE ARCHITECT'S DIALS: styles, clubs, ages and the land's story as records
// (architect-courses, 30 October 2026; docs/ARCHITECT_COURSES.md).
//
// A style is whose hand designed the course; a club is who runs it; an age is
// how long it has been there; the story is what the land held before. Each is
// a record, like a biome, so adding one is adding a row -- PROJECT_HANDOFF
// *Adding a style* says what a new one needs.
//
// `architectChoices` turns the four dials, the landscape and the seed into
// every generation setting a Classic player would set by hand. It is the
// architect's first decision and is pure. tests/architect.test.mjs.
import {STYLE_KEYS,DEFAULT_COURSE} from './settings-schema.js';

// Every style. `leans` is the landscapes it suits, which is what *By landscape*
// draws from (weighted by the landscape's own list, `BIOME_STYLES`).
export const STYLES={
 golden:{name:'Golden Age',hand:'Wide fairways, bold greens, flashed sand faces, cloud-edged bunkers, few trees in play'},
 raynor:{name:'Raynor & Macdonald',hand:'Templates, geometric greens with steep straight banks, flat-bottomed bunkers'},
 links:{name:'Links',hand:'Revetted pot bunkers, shared fairways and double greens, no ponds, walls, burns, feeder slopes'},
 heathland:{name:'Heathland & Sandbelt',hand:'Large ragged bunker complexes flashed to the green edge, heather, pines'},
 sandhills:{name:'Sandhills',hand:'Blowout bunkers found rather than built, huge greens, almost no trees, fescue'},
 parkland:{name:'Parkland',hand:'Tree-lined corridors, small crowned greens, round bunkers, avenues'},
 modern:{name:'Modern championship',hand:'Water in play, framing mounds, big bunkers with capes and bays'},
 stadium:{name:'Stadium',hand:'Railway-tie bulkheads, an island green, waste areas, pot bunkers, spectator mounds'},
 minimalist:{name:'Minimalist',hand:'Very wide fairways, rugged native-edged bunkers, little dirt moved'},
 desert:{name:'Desert target',hand:'Turf ribbons in native desert, arroyos, boulder walls'},
 mountain:{name:'Mountain',hand:'Terraced tees, stairs, rock outcrops in play, uphill and downhill par 3s, greens on shelves'},
 tropical:{name:'Tropical resort',hand:'Palm avenues, waterfalls between ponds, beach bunkers, peninsula greens, flowers'},
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
// imported so this module stays free of the generator's imports.
function stream(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

// The style a course is built in: the chosen one, or By landscape's pick from
// the seed. Its own stream, so it can never move a Classic draw.
export function styleOf(s){
 if(s?.archStyle&&s.archStyle!=='auto'&&STYLES[s.archStyle])return s.archStyle;
 const list=BIOME_STYLES[s?.biome]||GENERIC_STYLES,r=stream(`${s?.seed||'EVERGREEN'}|arch|style`)();
 // The first style twice as likely as each after it.
 const w=list.map((_,i)=>i===0?2:1),total=w.reduce((a,b)=>a+b,0);
 let t=r*total;for(let i=0;i<list.length;i++){t-=w[i];if(t<0)return list[i];}
 return list[list.length-1];
}

// The architect's settings. PHASE 0: exactly Classic's defaults, so an
// Architect course is today's default course -- which proves the plumbing
// (both fingerprints agree) before any decision changes.
export function architectChoices(s){
 const holes=s.holes===18?18:s.holes===1?1:9;
 return {...DEFAULT_COURSE,courseYards:holes*360};
}

export const STYLE_LIST=STYLE_KEYS.filter(k=>k!=='auto');
