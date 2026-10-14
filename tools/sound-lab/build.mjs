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
const built=new Date().toISOString().slice(0,16).replace('T',' ');
const page=readFileSync(join(here,'page.html'),'utf8')
 .replace('/*SYNTH*/',()=>synth)
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
