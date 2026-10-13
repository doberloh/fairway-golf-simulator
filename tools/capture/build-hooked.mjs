// A build of the game for capturing pictures and clips of it: the real game, plus
// three handles on `window` the capture scripts drive it through --
//   __view      the renderer (camera, clock, floodlights, aim line)
//   __takeShot  a launch-monitor shot, as if one had arrived from the bridge
//   __play      put the current player's ball somewhere and set up that shot
// They are added while bundling, so src/ is never edited. (Editing src/main.js
// and reverting it by hand is how real work was once lost here.)
//
//   node tools/capture/build-hooked.mjs     -> bench/shots/dist-exp/index.html
//   OUT=bench/shots/dist-before node tools/capture/build-hooked.mjs   (another folder)
//
// SWAP builds the game with another version of a source file in place of the one
// in src/, for a before/after without touching src/ either: a `;`-separated list
// of `src/<file>=<path to the replacement>`. The replacement is loaded as if it
// were the src/ file, so its own relative imports resolve inside src/.
//
//   SWAP="src/physics.js=../scratch/physics.js" OUT=bench/shots/dist-after node tools/capture/build-hooked.mjs
import fs from 'node:fs';
import path from 'node:path';
import {build} from 'vite';

const LINE = " view=new GolfView($('scene'),graphics.quality);";
const HOOK = 'window.__view=view;window.__takeShot=takeShot;'
 + 'window.__play=(b,a)=>{round.positions[round.active]={...b};round.teePlaced=true;view.setBall(b);setUpTurn();if(a!==undefined){aim=a;updateAim();}};';
const OUT = process.env.OUT || 'bench/shots/dist-exp';
const norm = p => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const SWAP = new Map((process.env.SWAP || '').split(';').filter(Boolean).map(pair => {
 const [target, from] = pair.split('=');
 if (!target || !from || !fs.existsSync(target) || !fs.existsSync(from)) throw Error(`build-hooked: SWAP needs src/<file>=<existing path>, got "${pair}"`);
 return [norm(target), path.resolve(from)];
}));
const used = new Set();
const hook = {
 name: 'fairway-capture-hooks',
 load(id) {
  const from = SWAP.get(norm(id.split('?')[0]));
  if (!from) return null;
  used.add(from);
  return fs.readFileSync(from, 'utf8');
 },
 transform(code, id) {
  if (!id.replace(/\\/g, '/').endsWith('/src/main.js')) return null;
  if (code.split(LINE).length !== 2) throw Error(`build-hooked: the line the hooks attach to has changed in src/main.js:\n${LINE}`);
  return code.replace(LINE, LINE + HOOK);
 },
};
await build({configFile: 'vite.config.js', plugins: [hook], logLevel: 'warn',
 build: {outDir: OUT, emptyOutDir: true}});
// A swap that never matched a module would build the unchanged game and call it
// the "after" -- the one mistake a before/after cannot afford.
if (used.size !== SWAP.size) throw Error(`build-hooked: a SWAP target was never loaded: ${[...SWAP.values()].filter(f => !used.has(f)).join(', ')}`);
console.log(`${OUT}/index.html: the game with capture hooks${SWAP.size ? `, ${SWAP.size} file(s) swapped` : ''}.`);
