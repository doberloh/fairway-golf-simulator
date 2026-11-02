// A NAMED STREAM OF NUMBERS for the world's pieces -- the cart paths' story,
// the walls and buildings, the animals, the dressed water -- each its own, so
// one piece added or changed never moves another's draws (and none of them
// moves the holes, which draw from course-plan.js's one RNG).
//
// Moved here from architect-styles.js (`archStream`) when Architect was
// removed (the owner, 2 November 2026) and its world pieces came to every
// generated course. The same mulberry32 on an FNV-1a hash of the parts.
// Pure; no imports.
export function worldStream(...parts){let a=2166136261;for(const c of parts.join('|')){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
