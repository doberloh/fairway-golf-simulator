import {YARD} from './physics.js';
export const DEFAULT_PUTTING={mode:'holeout',one:3,two:10,three:20};
export function puttingConfig(input={}){
 const p={...DEFAULT_PUTTING,...input};
 if(!['holeout','dartboard','decimal'].includes(p.mode)||![p.one,p.two,p.three].every(n=>Number.isFinite(n)&&n>=.1&&n<=100)||p.one>=p.two||p.two>=p.three)throw Error('Putting distances must increase: 1-putt < 2-putt < 3-putt (0.1–100 yd).');
 return p;
}
export function awardedPutts(distance,onGreen,config){
 const p=puttingConfig(config);if(!onGreen||p.mode==='holeout')return 0;
 const d=distance/YARD;if(d<=p.one)return 1;
 if(p.mode==='dartboard')return d<=p.two?2:3;
 return Math.round(Math.min(3,d<=p.two?1+(d-p.one)/(p.two-p.one):2+(d-p.two)/(p.three-p.two))*100)/100;
}
export const scoreText=n=>Number.isFinite(n)?String(Math.round(n*100)/100):'—';

export const sumScores=scores=>Math.round(scores.reduce((a,b)=>a+(b||0),0)*100)/100;
