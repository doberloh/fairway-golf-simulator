// One frame of a video as a picture, to check a recording without a player.
//   node tools/capture/frame-grab.mjs <video> <seconds> [out.jpg]
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const [video, at = '1', outArg] = process.argv.slice(2);
if (!video) throw Error('usage: node tools/capture/frame-grab.mjs <video> <seconds> [out.jpg]');
const src = path.resolve(video), out = path.resolve(outArg || src.replace(/\.(mp4|webm)$/, `-${at}s.jpg`));
const blank = path.join(path.dirname(src), '.check.html');
fs.writeFileSync(blank, '<!doctype html><title>grab</title>');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(pathToFileURL(blank).href);
// A video from a file cannot be read back through a canvas (it taints it), so
// the video element itself is photographed, at its own size.
const size = await p.evaluate(async ([url, t]) => {
 const v = document.createElement('video'); v.id = 'v'; v.muted = true; v.src = url;
 v.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;object-fit:fill';
 document.body.style.margin = '0'; document.body.append(v);
 await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(Error('cannot play')); });
 v.currentTime = t; await new Promise(r => v.onseeked = r);
 return [v.videoWidth, v.videoHeight];
}, [pathToFileURL(src).href, Number(at)]);
await p.setViewportSize({width: size[0], height: size[1]});
await p.waitForTimeout(300);
const shot = await p.screenshot({type: 'jpeg', quality: 92});
fs.writeFileSync(out, shot);
await b.close();
console.log(out);
