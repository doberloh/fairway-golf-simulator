// A build of the game for capturing the website's media: the real game, plus
// three handles on `window` the capture scripts drive it through --
//   __view      the renderer (camera, clock, floodlights, aim line)
//   __takeShot  a launch-monitor shot, as if one had arrived from the bridge
//   __play      put the current player's ball somewhere and set up that shot
// They are added while bundling, so src/ is never edited. (Editing src/main.js
// and reverting it by hand is how real work was once lost here.)
//
//   node tools/site-media/build-hooked.mjs     -> bench/shots/dist-exp/index.html
//   OUT=bench/shots/dist-before node tools/site-media/build-hooked.mjs   (another folder)
import {build} from 'vite';

const LINE = " view=new GolfView($('scene'),graphics.quality);";
const HOOK = 'window.__view=view;window.__takeShot=takeShot;'
 + 'window.__play=(b,a)=>{round.positions[round.active]={...b};round.teePlaced=true;view.setBall(b);setUpTurn();if(a!==undefined){aim=a;updateAim();}};';
const OUT = process.env.OUT || 'bench/shots/dist-exp';
const hook = {
 name: 'fairway-capture-hooks',
 transform(code, id) {
  if (!id.replace(/\\/g, '/').endsWith('/src/main.js')) return null;
  if (code.split(LINE).length !== 2) throw Error(`build-hooked: the line the hooks attach to has changed in src/main.js:\n${LINE}`);
  return code.replace(LINE, LINE + HOOK);
 },
};
await build({configFile: 'vite.config.js', plugins: [hook], logLevel: 'warn',
 build: {outDir: OUT, emptyOutDir: true}});
console.log(`${OUT}/index.html: the game with capture hooks.`);
