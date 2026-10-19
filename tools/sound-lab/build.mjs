// Builds the sound listening report, docs/reports/sounds/index.html, and the
// small lapping-water page beside it, water.html.
//
//   node tools/sound-lab/build.mjs
//
// The report is one self-contained page (it opens from the file, no server)
// with src/sound.js inlined, so what the owner hears is exactly what the game
// plays. (cc0-candidates.json beside it is the record of the CC0 search, which
// the owner turned down in round 3; the report no longer shows it.) Like every
// report it is local and git-ignored; this script and the files beside it are
// what is tracked.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'..','..');
// The game's own sound module, not a copy: src/sound.js is what plays in the
// game, so the report plays exactly that.
const synth=readFileSync(join(root,'src','sound.js'),'utf8').replace(/^export /gm,'');
// The 1.0 interface's chiptune goes into the main page too (in a scope of its
// own there), so check.mjs measures the tunes the game plays beside the rest.
const chipSrc=readFileSync(join(root,'src','chiptune.js'),'utf8').replace(/^export /gm,'');
const built=new Date().toISOString().slice(0,16).replace('T',' ');
const page=readFileSync(join(here,'page.html'),'utf8')
 .replace('/*SYNTH*/',()=>synth)
 .replace('/*CHIP*/',()=>chipSrc)
 .replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">\n<meta name="built" content="${built}">`);
const outDir=join(root,'docs','reports','sounds');
mkdirSync(outDir,{recursive:true});
writeFileSync(join(outDir,'index.html'),page);
console.log(`wrote ${join('docs','reports','sounds','index.html')} (${(page.length/1024).toFixed(0)} KB)`);
// The small water page (round 5): the lapping-water options alone.
const water=readFileSync(join(here,'water.html'),'utf8')
 .replace('/*SYNTH*/',()=>synth)
 .replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">\n<meta name="built" content="${built}">`);
writeFileSync(join(outDir,'water.html'),water);
console.log(`wrote ${join('docs','reports','sounds','water.html')} (${(water.length/1024).toFixed(0)} KB)`);
// The Swing Meter's sounds (14 October 2026): their own small page, with a
// practice meter that plays the takes the owner has picked.
const meter=readFileSync(join(here,'meter.html'),'utf8')
 .replace('/*SYNTH*/',()=>synth)
 .replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">
<meta name="built" content="${built}">`);
writeFileSync(join(outDir,'meter.html'),meter);
console.log(`wrote ${join('docs','reports','sounds','meter.html')} (${(meter.length/1024).toFixed(0)} KB)`);
// The XP popup's sounds (14 October 2026): their own small page, with a demo
// of the popup that plays the takes the owner has picked.
const xp=readFileSync(join(here,'xp.html'),'utf8')
 .replace('/*SYNTH*/',()=>synth)
 .replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">
<meta name="built" content="${built}">`);
writeFileSync(join(outDir,'xp.html'),xp);
console.log(`wrote ${join('docs','reports','sounds','xp.html')} (${(xp.length/1024).toFixed(0)} KB)`);
// The hole-out stings as chiptune (14 October 2026): their own page, with the
// current marimba beside each to compare.
const stings=readFileSync(join(here,'stings.html'),'utf8')
 .replace('/*SYNTH*/',()=>synth)
 .replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">
<meta name="built" content="${built}">`);
writeFileSync(join(outDir,'stings.html'),stings);
console.log(`wrote ${join('docs','reports','sounds','stings.html')} (${(stings.length/1024).toFixed(0)} KB)`);
// The 1.0 interface's chiptune (17 October 2026, phase 4): every moment and
// interface sound of family C, made by src/chiptune.js, for listening and
// signing off before any of it goes into the game.
const chip=readFileSync(join(root,'src','chiptune.js'),'utf8').replace(/^export /gm,'');
const chipPage=readFileSync(join(here,'chiptune.html'),'utf8')
 .replace('/*SYNTH*/',()=>chip)
 .replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">
<meta name="built" content="${built}">`);
writeFileSync(join(outDir,'chiptune.html'),chipPage);
console.log(`wrote ${join('docs','reports','sounds','chiptune.html')} (${(chipPage.length/1024).toFixed(0)} KB)`);
