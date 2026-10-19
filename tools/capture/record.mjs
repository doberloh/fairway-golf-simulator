// FRAME-BY-FRAME RECORDING AT 4K (18 October 2026). The old clips were
// recorded live (captureStream + MediaRecorder, 1920x1080, 5 Mbit/s): whatever
// the game managed in real time is what the clip got, a dropped frame was a
// stutter, and 4K Ultra in real time is more than a browser can draw and encode
// at once. Here time does not run by itself:
//
// - THE PAGE'S CLOCK IS STEPPED. `virtualClock` (an init script, so it is in
//   place before the game starts) takes over requestAnimationFrame and
//   performance.now. While `__vclock.start()` is on, nothing moves until
//   `__vclock.advance(ms)` runs every waiting frame callback at exactly that
//   much later. The game's own loop, the camera flight and a ball in the air
//   all see a perfect 60 frames a second, however long each frame takes to draw.
// - EACH FRAME IS ENCODED IN THE PAGE with WebCodecs, straight from the
//   canvas (canvas clips) or from a full-page screenshot (`recordPage`, when the
//   interface is in the shot), into any number of outputs at once: the master
//   (3840x2160 H.264, 80 Mbit/s, an MP4 any editor opens) and the website's
//   copy (1920x1080 VP9 in a WebM). Frames go to Node as they are made and are
//   written by mux.mjs.
// - THE RESULT IS CHECKED: each file is opened in a <video> and must decode to
//   its size and length, or the recording fails.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeMp4, writeWebm} from './mux.mjs';

// Installed with page.addInitScript before the game loads (openGame does it
// when asked: openGame(browser, {virtualClock: true})).
export function virtualClock() {
  const realRAF = window.requestAnimationFrame.bind(window), realCancel = window.cancelAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let on = false, vt = 0, nextId = 1e6, queue = new Map();
  window.__vclock = {
    get on() { return on; },
    get now() { return vt; },
    start() { if (on) return; vt = realNow(); on = true; },
    // Back to real time: whatever was waiting runs on the next real frame.
    stop() { if (!on) return; on = false; const q = [...queue.values()]; queue.clear(); for (const cb of q) realRAF(cb); },
    advance(ms) {
      vt += ms;
      const q = [...queue.values()]; queue.clear();
      for (const cb of q) { try { cb(vt); } catch (e) { console.error('frame callback: ' + (e && e.message)); } }
    },
  };
  window.requestAnimationFrame = cb => { if (!on) return realRAF(cb); const id = nextId++; queue.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { if (queue.delete(id)) return; realCancel(id); };
  performance.now = () => on ? vt : realNow();
}

// The masters and the website's copy. `scale` is applied to the source frame.
export const MASTER = {kind: 'mp4', codec: 'avc1.640034', width: 3840, height: 2160, bitrate: 80e6};
export const WEB = {kind: 'webm', codec: 'vp09.00.40.08', width: 1920, height: 1080, bitrate: 8e6};

// Sets up the page's encoders and the bridge that hands frames to Node.
async function openEncoders(page, outputs, fps) {
  const store = outputs.map(() => ({frames: [], description: null}));
  const bridge = '__frameOut' + Math.random().toString(36).slice(2, 8);
  await page.exposeFunction(bridge, (i, b64, key, desc) => {
    store[i].frames.push({data: Buffer.from(b64, 'base64'), key});
    if (desc && !store[i].description) store[i].description = Buffer.from(desc, 'base64');
  });
  const ok = await page.evaluate(async ([outputs, fps, bridge]) => {
    const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
    const out = [];
    for (const [i, o] of outputs.entries()) {
      const config = {codec: o.codec, width: o.width, height: o.height, bitrate: o.bitrate, framerate: fps, latencyMode: 'quality', bitrateMode: 'variable', hardwareAcceleration: 'prefer-software', ...(o.kind === 'mp4' ? {avc: {format: 'avc'}} : {})};
      const s = await VideoEncoder.isConfigSupported(config);
      if (!s.supported) return `encoder not supported: ${JSON.stringify(config)}`;
      let pending = Promise.resolve();
      const enc = new VideoEncoder({
        output: (chunk, meta) => {
          const u8 = new Uint8Array(chunk.byteLength); chunk.copyTo(u8);
          const desc = meta?.decoderConfig?.description ? new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : meta.decoderConfig.description.buffer) : null;
          pending = pending.then(() => window[bridge](i, b64(u8), chunk.type === 'key', desc ? b64(desc) : null));
        },
        error: e => { window.__encError = e.message; },
      });
      enc.configure(config);
      out.push({enc, o, canvas: (o.width && o.height) ? new OffscreenCanvas(o.width, o.height) : null, get pending() { return pending; }});
    }
    window.__encoders = out;
    return true;
  }, [outputs, fps, bridge]);
  if (ok !== true) throw Error(ok);
  await page.evaluate(src => { window.__encodeFrame = (0, eval)(src); }, `(${ENCODE_FRAME})`);
  return store;
}

// Encodes the current picture of `window.__frameSource()` (a canvas or an
// ImageBitmap) as frame `i` in every output. Every output copies the picture
// before anything waits: a WebGL canvas is only readable until the page next
// draws to the screen.
const ENCODE_FRAME = async ([i, fps, keyEvery]) => {
  const src = window.__frameSource();
  for (const e of window.__encoders) {
    const g = e.canvas.getContext('2d', {alpha: false});
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, e.canvas.width, e.canvas.height);
  }
  for (const e of window.__encoders) {
    const frame = new VideoFrame(e.canvas, {timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps)});
    e.enc.encode(frame, {keyFrame: i % keyEvery === 0});
    frame.close();
  }
  for (const e of window.__encoders) while (e.enc.encodeQueueSize > 3) await new Promise(r => setTimeout(r, 4));
  if (src.close) src.close();
  if (window.__encError) throw Error(window.__encError);
};

async function finish(page, outputs, store, fps, files) {
  await page.evaluate(async () => { for (const e of window.__encoders) await e.enc.flush(); for (const e of window.__encoders) await e.pending; for (const e of window.__encoders) e.enc.close(); });
  const written = [];
  for (const [i, o] of outputs.entries()) {
    const s = store[i], file = files[i];
    if (!s.frames.length) throw Error(`no frames came out for ${file}`);
    const buf = o.kind === 'mp4' ? writeMp4({width: o.width, height: o.height, fps, avcC: s.description, frames: s.frames})
      : writeWebm({width: o.width, height: o.height, fps, frames: s.frames, codec: o.codec.startsWith('av01') ? 'V_AV1' : 'V_VP9'});
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, buf);
    written.push({file, frames: s.frames.length, mb: buf.length / 1048576});
  }
  return written;
}

// A clip from the game's canvas. `step(i, t)` runs in Node before each frame
// (place the camera, take a shot); the clock then moves one frame and the
// frame is encoded. `files` lines up with `outputs`.
export async function recordCanvas(page, {seconds, fps = 60, outputs = [MASTER, WEB], files, step = null, keyEvery = fps * 2}) {
  const store = await openEncoders(page, outputs, fps);
  await page.evaluate(() => { window.__frameSource = () => window.__view.renderer.domElement; window.__vclock.start(); });
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    if (step) await step(i, i / fps);
    // Advance and encode in one go, so the canvas is read before anything is
    // composited over it.
    await page.evaluate(async ([i, fps, keyEvery]) => { window.__vclock.advance(1000 / fps); await window.__encodeFrame([i, fps, keyEvery]); }, [i, fps, keyEvery]);
  }
  await page.evaluate(() => window.__vclock.stop());
  return finish(page, outputs, store, fps, files);
}

// A clip of the whole page, interface included: each frame is a screenshot
// (the interface is the page, not the canvas). Slower, and the same clock.
export async function recordPage(page, {seconds, fps = 60, outputs = [MASTER, WEB], files, step = null, keyEvery = fps * 2}) {
  const store = await openEncoders(page, outputs, fps);
  await page.evaluate(() => window.__vclock.start());
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) {
    if (step) await step(i, i / fps);
    await page.evaluate(ms => window.__vclock.advance(ms), 1000 / fps);
    // JPEG at full quality: a 4K PNG is four times the bytes to hand across
    // for no difference the 80 Mbit/s master can keep.
    const shot = await page.screenshot({type: 'jpeg', quality: 100});
    await page.evaluate(async ([b64, i, fps, keyEvery]) => {
      const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
      const bmp = await createImageBitmap(blob);
      window.__frameSource = () => bmp;
      await window.__encodeFrame([i, fps, keyEvery]);
    }, [shot.toString('base64'), i, fps, keyEvery]);
  }
  await page.evaluate(() => window.__vclock.stop());
  return finish(page, outputs, store, fps, files);
}

// Opens each file in a <video> and checks it decodes to its size and length.
export async function checkVideos(browser, files) {
  const page = await browser.newPage();
  // A page of our own beside the files, so the videos load from the same place.
  const blank = path.join(path.dirname(path.resolve(files[0])), '.check.html');
  fs.writeFileSync(blank, '<!doctype html><title>check</title>');
  await page.goto(pathToFileURL(blank).href);
  const out = [];
  for (const f of files) {
    const r = await page.evaluate(async src => {
      const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = src; document.body.append(v);
      const res = await new Promise(res => { v.onloadeddata = () => res({ok: true}); v.onerror = () => res({ok: false, err: v.error && v.error.message}); setTimeout(() => res({ok: false, err: 'timeout'}), 20000); });
      const r2 = {...res, width: v.videoWidth, height: v.videoHeight, seconds: v.duration};
      v.remove(); return r2;
    }, pathToFileURL(path.resolve(f)).href);
    if (!r.ok || !r.width) throw Error(`${f} does not play: ${JSON.stringify(r)}`);
    out.push(`${path.basename(f)} ${r.width}x${r.height} ${r.seconds.toFixed(2)} s`);
  }
  await page.close();
  return out;
}
