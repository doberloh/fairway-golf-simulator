// WHO DESIGNS THE COURSE: Classic or Architect (architect-courses, 30 October
// 2026; docs/ARCHITECT_COURSES.md).
//
// Classic is the generator Fairway has always had: every course grown from the
// studio's sliders. Architect is a second designer beside it. An Architect
// course is chosen by four dials -- style, club, age, story -- plus the seed,
// the landscape and the number of holes; the architect decides everything the
// sliders would have.
//
// `designSettings` is where that happens. For a Classic course it returns the
// SAME OBJECT it was given, untouched -- the guarantee that Classic courses
// never move is that this function cannot reach them. For an Architect course
// it overwrites every generation setting the player does not choose with the
// architect's own, and it is idempotent, so every entry into generation can
// call it (planCourse, planScorecard, generateCourse, routeHoles,
// generateWorldSteps) without caring whether a caller already did.
//
// Pure: no DOM, no three.js. tests/designer.test.mjs.
import {DEFAULT_COURSE,ARCHITECT_KEEPS,SETTINGS,isArchitect} from './settings-schema.js';
import {architectChoices} from './architect-styles.js';

// The schema keys the architect decides -- every generation setting outside
// ARCHITECT_KEEPS.
export const DECIDED_KEYS=SETTINGS.map(f=>f.key).filter(k=>!ARCHITECT_KEEPS.includes(k));

export function designSettings(s){
 if(!isArchitect(s))return s;
 // Already resolved: the same choices give the same answer, so a second pass
 // would only allocate. `__design` records what it was resolved from.
 const from=designKey(s);
 if(s.__design===from)return s;
 const holes=s.holes===18?18:s.holes===1?1:9;
 const decided=architectChoices({...DEFAULT_COURSE,...s,holes});
 const out={...s};
 for(const k of DECIDED_KEYS)out[k]=decided[k]??DEFAULT_COURSE[k];
 // Never enumerable: a resolved settings object is still saved, coded and
 // compared as settings, and the marker is not one.
 Object.defineProperty(out,'__design',{value:from,enumerable:false});
 return out;
}
// What a design depends on: the kept keys only.
export const designKey=s=>JSON.stringify(ARCHITECT_KEEPS.map(k=>s?.[k]));

// What a course code or a saved course needs to carry. For Architect, the
// decided keys are thrown away -- they are recomputed from the kept ones on
// load, and carrying them would both bloat the code and pin a course to one
// architect version's answers.
export function designerScope(s){
 if(!isArchitect(s))return s;
 const out={};
 for(const [k,v] of Object.entries(s))if(!DECIDED_KEYS.includes(k))out[k]=v;
 return out;
}
