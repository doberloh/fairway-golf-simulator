// Builds the sound listening report: docs/reports/sounds/index.html.
//
//   node tools/sound-lab/build.mjs
//
// The report is one self-contained page (it opens from the file, no server)
// with tools/sound-lab/synth.js inlined, so what the owner hears is exactly
// the code that would move into the game. It also lists the CC0 recordings in
// cc0-candidates.json; their previews stream from Freesound only when played.
// Like every report it is local and git-ignored; this script and the files
// beside it are what is tracked.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'..','..');
const synth=readFileSync(join(here,'synth.js'),'utf8').replace(/^export /gm,'');
const cc0=JSON.parse(readFileSync(join(here,'cc0-candidates.json'),'utf8'));
const built=new Date().toISOString().slice(0,16).replace('T',' ');
const page=readFileSync(join(here,'page.html'),'utf8')
 .replace('/*SYNTH*/',()=>synth)
 .replace('/*CC0*/null',()=>JSON.stringify(cc0))
 .replace('<meta charset="utf-8">',()=>`<meta charset="utf-8">\n<meta name="built" content="${built}">`);
const outDir=join(root,'docs','reports','sounds');
mkdirSync(outDir,{recursive:true});
writeFileSync(join(outDir,'index.html'),page);
console.log(`wrote ${join('docs','reports','sounds','index.html')} (${(page.length/1024).toFixed(0)} KB)`);
