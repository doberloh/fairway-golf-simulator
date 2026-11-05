// GAME VIEW (the owner, 4 November 2026: "go from the 3d preview to actual in
// game graphics and back again in a quick way ... NOT have any editing tools in
// the Real game preview"; docs/COURSE_BUILDER.md, *Game view*). The course in the
// game's own drawing code (renderer.js GolfView), over the editor, to fly round
// and look at. Nothing here edits a course, plays a round or saves a setting.
//
// IT STAYS WHEN IT IS HIDDEN. The first look pays for the game's shaders and
// every later one for a new course only when something changed (game-look.js
// `changeMark`): flipping back and forth with no edit is two calls. While hidden
// it draws nothing, and while it shows the editor's view draws nothing, so there
// is only ever one picture being drawn. It is hidden by `visibility`, not
// `display`: the view's size comes from its box, and a box with no size would
// resize the renderer to nothing and back at every flip.
//
// THE ROUND'S THINGS ARE NOT SHOWN: the ball, its ring, the aim line. The game's
// clock is the view's own here (`borrowedClock`, rate 0), so the player's saved
// time of day is neither used up nor overwritten.
import {GolfView} from '../renderer.js';
import {worldFromDoc} from '../built-world.js';
import {loadGraphics, QUALITY, QUALITY_LABELS} from '../graphics.js';
import {clearOfGround, flyAxes, samePose} from './game-look.js';

const make = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const breathe = () => new Promise(r => setTimeout(r, 30));
const SEASONS = [['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']];
const FLYING = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight']);

export function createGameView(parent, {onBack, busy}) {
 const canvas = make('canvas', {className: 'cb-gamecanvas', tabIndex: 0}), stage = make('div', {className: 'cb-gamestage'}, canvas);
 const back = make('button', {className: 'cb-btn cb-hot', type: 'button', textContent: 'Back to editor', onclick: () => onBack()});
 const hole = make('select', {className: 'cb-gamehole', title: 'Fly to a hole'}), season = make('select', {className: 'cb-gameseason', title: 'The season'}, ...SEASONS.map(([value, textContent]) => make('option', {value, textContent})));
 const time = make('input', {type: 'range', min: 0, max: 24, step: .25, className: 'cb-gametime', title: 'The time of day'}), clock = make('span');
 const graphics = loadGraphics(), quality = make('select', {className: 'cb-gamequality', title: 'The game\'s graphics setting'}, ...QUALITY.map(value => make('option', {value, textContent: (QUALITY_LABELS[value] ?? value).split(' · ')[0]})));
 quality.value = graphics.quality; season.value = 'summer';
 const label = (text, ...input) => make('label', {}, text + ' ', ...input);
 const bar = make('div', {className: 'cb-gamebar'}, back, label('Hole', hole), label('Season', season), label('Time', time, clock), label('Graphics', quality),
  make('span', {className: 'cb-gamehint', textContent: 'W A S D fly, Q and E down and up, Shift faster; drag to look, the wheel moves ahead. G goes back.'}));
 const root = make('div', {className: 'cb-game'}, stage, bar);
 root.style.visibility = 'hidden';
 parent.append(root);

 const view = new GolfView(canvas, graphics.quality);
 view.setGroundCues(graphics); view.setTerrainShadows(graphics.terrainShadows); view.setReflections(graphics.reflections); view.setFloodShadows(graphics.floodlightShadows); view.setDistantFlags(graphics.distantFlags);
 view.borrowedClock = true; view.daylight.rate = 0; view.daylight.floodlights = false;

 let world = null, on = false, raf = 0, last = 0, placedFrom = null, working = false;
 const held = new Set();
 const clockText = () => { const h = Math.floor(view.daylight.hour), m = Math.round((view.daylight.hour - h) * 60); clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
 const noRound = () => { for (const k of ['ball', 'ballRing', 'aimLine', 'aimRing']) if (view[k]) view[k].visible = false; };
 const here = () => ({eye: {x: view.targetPos.x, y: view.targetPos.y, z: view.targetPos.z}, yaw: view.freeYaw, pitch: view.freePitch});

 // The course drawn as it stands, from `pose`. Builds, then lets the graphics
 // card prepare, as the game does behind its loading screen.
 async function draw(pose) {
  busy('Drawing the course…'); await breathe();
  view.build(world, 'cartoon', Number(hole.value) || 0);
  noRound();
  view.placeCamera(pose.eye, pose.yaw, pose.pitch);
  busy('Preparing the graphics…'); await breathe();
  await view.ready();
  noRound();
  time.value = view.daylight.hour; clockText();
 }
 const frame = now => {
  if (!on) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (working || view.readying) return;
  const {forward, right, up, fast} = flyAxes(held);
  if (forward || right || up) {
   view.moveFree(dt, forward, right, up, fast);
   view.targetPos.y = clearOfGround(view.targetPos.y, world.height(view.targetPos.x, view.targetPos.z));
   view.updateFreeLook();
  }
  view.render(dt);
 };
 // Season and graphics change the drawing, not the course: the same world,
 // built again, from where the camera is.
 async function redraw(change) {
  if (working) return;
  working = true;
  const pose = here();
  try { change(); await draw(pose); } finally { busy(''); working = false; }
 }
 season.onchange = () => redraw(() => { world.settings.season = season.value; });
 quality.onchange = () => redraw(() => view.applyQuality(quality.value));
 hole.onchange = () => { if (world) view.flyToHole(Number(hole.value)); };
 time.oninput = () => { view.daylight.hour = +time.value; clockText(); };

 // The mouse looks; the wheel moves ahead. No click does anything to the course.
 let looking = null;
 canvas.addEventListener('contextmenu', e => e.preventDefault());
 canvas.addEventListener('pointerdown', e => { looking = {x: e.clientX, y: e.clientY}; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
 canvas.addEventListener('pointermove', e => { if (!looking) return; view.rotateFree(e.clientX - looking.x, e.clientY - looking.y); looking = {x: e.clientX, y: e.clientY}; });
 const stop = () => { looking = null; };
 canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
 canvas.addEventListener('wheel', e => { e.preventDefault(); view.moveFree(.12, -Math.sign(e.deltaY) * 2, 0, 0); }, {passive: false});
 const typing = () => /SELECT|TEXTAREA/.test(document.activeElement?.tagName || '');
 const keyDown = e => { if (on && FLYING.has(e.code) && !e.ctrlKey && !e.metaKey && !typing()) { held.add(e.code); e.preventDefault(); } };
 const keyUp = e => held.delete(e.code);
 const blur = () => held.clear();
 addEventListener('keydown', keyDown); addEventListener('keyup', keyUp); addEventListener('blur', blur);

 return {
  get showing() { return on; },
  // Shown. `doc`: the course when it has changed since the last look (null:
  // what is built stands). `pose`: where the editor's camera is; a pose it has
  // already been given is left alone, so flipping back keeps where you flew to.
  async show({doc = null, pose}) {
   if (working) return;
   working = true;
   try {
    const fresh = !!doc || !world;
    if (fresh) {
     busy('Building the course…'); await breathe();
     hole.replaceChildren(...doc.holes.map((h, i) => make('option', {value: i, textContent: `Hole ${h.number}`})));
     world = worldFromDoc(doc, {season: season.value});
     await draw(pose);
    } else if (!samePose(pose, placedFrom)) view.placeCamera(pose.eye, pose.yaw, pose.pitch);
    placedFrom = pose;
    root.style.visibility = 'visible';
    on = true; last = performance.now(); raf = requestAnimationFrame(frame);
    canvas.focus();
   } finally { busy(''); working = false; }
  },
  hide() { on = false; cancelAnimationFrame(raf); held.clear(); root.style.visibility = 'hidden'; },
  dispose() {
   on = false; cancelAnimationFrame(raf);
   removeEventListener('keydown', keyDown); removeEventListener('keyup', keyUp); removeEventListener('blur', blur);
   view.disposeCourse(); view.renderer.dispose(); view.renderer.forceContextLoss(); root.remove();
  },
 };
}
