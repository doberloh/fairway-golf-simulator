import {YARD} from './physics.js';
// THE PUTTING MODES, the one list every caller and the round matrix read.
// - holeout: every putt is played into the cup.
// - dartboard: a ball resting on the green is given 1, 2 or 3 putts by which
//   of three rings it stops in.
// - decimal: the same rings, read as a fraction of a putt.
// - gimme: ONE ring round the cup (the owner, 10 November 2026: "single gimmie
//   circle" mode, its size set by the player). A ball resting on the green
//   inside it is picked up for one more stroke -- a gimme counts the putt not
//   played, as the dartboard's inside ring does; outside it the golfer putts
//   out as in hole out. One circle for every golfer and every hole.
export const PUTTING_MODES=Object.freeze(['holeout','dartboard','decimal','gimme']);
export const FOOT=YARD/3;
// The gimme circle's radius, in feet from the middle of the cup. PLACED: 3 ft
// is the "inside the leather" length of a putter's grip, the usual friendly
// gimme; the range runs from a tap-in to the length of a short lag.
export const GIMME={min:.5,max:30,step:.5,def:3};
export const DEFAULT_PUTTING={mode:'holeout',one:3,two:10,three:20,gimme:GIMME.def};
export function puttingConfig(input={}){
 const p={...DEFAULT_PUTTING,...input};
 // A save from before the gimme circle has no `gimme`; one carried as null or
 // left out by an older challenge code takes the default rather than failing.
 if(input&&input.gimme==null)p.gimme=GIMME.def;
 if(!PUTTING_MODES.includes(p.mode)||![p.one,p.two,p.three].every(n=>Number.isFinite(n)&&n>=.1&&n<=100)||p.one>=p.two||p.two>=p.three)throw Error('Putting distances must increase: 1-putt < 2-putt < 3-putt (0.1–100 yd).');
 if(!Number.isFinite(p.gimme)||p.gimme<GIMME.min||p.gimme>GIMME.max)throw Error(`The gimme circle must be ${GIMME.min}–${GIMME.max} ft.`);
 return p;
}
export function awardedPutts(distance,onGreen,config){
 const p=puttingConfig(config);if(!onGreen||p.mode==='holeout')return 0;
 if(p.mode==='gimme')return distance<=p.gimme*FOOT?1:0;
 const d=distance/YARD;if(d<=p.one)return 1;
 if(p.mode==='dartboard')return d<=p.two?2:3;
 return Math.round(Math.min(3,d<=p.two?1+(d-p.one)/(p.two-p.one):2+(d-p.two)/(p.three-p.two))*100)/100;
}
// THE RINGS DRAWN ON THE GREEN for a putting mode: radius in metres, colour.
// renderer.js `setPutting` draws each where it lies on the green.
//
// BOLD, AND LIT WHEN THE BALL IS IN (the owner, 19 November 2026: "make the
// gimmie circles more visible. Thicker bold lines, and make the line change
// color when the ball passes inside its edges"). The first ring -- the gimme
// circle, or the one-putt ring -- is white: the pale yellow it was read as
// nothing on the paler greens. RING_INSIDE is the colour the innermost ring
// round the rolling ball turns, a hot pink chosen for being opposite the
// greens' yellow-green on the colour wheel and unlike the white, orange and
// salmon rings and the blaze-orange aim line (PLACED). RING_WIDTH is in
// screen pixels, as the aim line's is (renderer.js; it was 1, WebGL's only
// width for a plain line).
const RING_COLOURS=['#ffffff','#edb351','#e68670'];
export const RING_INSIDE='#ff3d9a';
export const RING_WIDTH=5;
export function puttingRings(config){
 const p=puttingConfig(config);
 if(p.mode==='holeout')return [];
 if(p.mode==='gimme')return [{radius:p.gimme*FOOT,colour:RING_COLOURS[0]}];
 return [p.one,p.two,p.three].map((yards,i)=>({radius:yards*YARD,colour:RING_COLOURS[i]}));
}
// WHICH RING IS LIT for a ball `distance` metres from the hole: the innermost
// one it is inside (the edge counts as inside, as the gimme does), or -1. A
// ball inside the one-putt ring lights that ring alone, not the two around it.
export function litRing(rings,distance){
 let best=-1;
 rings.forEach((r,i)=>{if(distance<=r.radius+1e-9&&(best<0||r.radius<rings[best].radius))best=i;});
 return best;
}
// Which of the putting fields a mode uses: the three ring distances (yards)
// or the gimme circle (feet). Hole out uses neither.
export const puttingFieldsFor=mode=>({rings:mode==='dartboard'||mode==='decimal',gimme:mode==='gimme'});
// A putting choice in a few words: the HUD's title, a friend's challenge.
export function puttingName(config){
 const p=puttingConfig(config);
 return p.mode==='holeout'?'hole out':p.mode==='gimme'?`gimme circle (${p.gimme} ft)`:`${p.mode} putting (${p.one}/${p.two}/${p.three} yd)`;
}
// What the shot result says when a ball is given its putts: a title and a line.
export function awardWords(putts,config){
 const p=puttingConfig(config);
 if(p.mode==='gimme')return {title:'Gimme',line:`Inside the ${p.gimme} ft gimme circle · one putt added.`};
 return {title:`${scoreText(putts)} putts awarded`,line:`${scoreText(putts)} automatic putts added · ${p.mode==='decimal'?'decimal':'dartboard'} putting.`};
}
export const scoreText=n=>Number.isFinite(n)?String(Math.round(n*100)/100):'—';

export const sumScores=scores=>Math.round(scores.reduce((a,b)=>a+(b||0),0)*100)/100;
