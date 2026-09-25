// SOMEWHERE FOR THE GAME TO PUT A SCREENSHOT.
//
// A generation change that is about how something LOOKS cannot be signed off
// from a distribution, and the pictures have to end up in files if they are
// going to sit in a report. The obvious tool for that is a headless browser,
// and it is the wrong one here: it means a 300 MB dependency, a second
// rendering path that is not the one anybody plays on, and a software
// rasteriser whose frames take seconds.
//
// So the game photographs ITSELF, in whatever browser is already open, and
// posts the frame here. This process only writes files.
//
//   node tools/shot-sink.mjs --out bench/shots/after
//
// Then, in the page (console, or a driver):
//
//   await captureTo('http://127.0.0.1:4199', 'tee-mountain');
//
// The snippet is printed on start so it can be pasted without finding this
// file. THE CANVAS MUST BE READ INSIDE A requestAnimationFrame CALLBACK: a
// WebGL drawing buffer is cleared after compositing unless the context asked
// for `preserveDrawingBuffer`, so `toDataURL` from anywhere else returns a
// blank image. This project has been caught by that before.
import {createServer} from 'node:http';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
 const i = args.indexOf('--' + name);
 return i < 0 ? fallback : (args[i + 1] ?? true);
};

const outDir = path.resolve(ROOT, String(flag('out', 'bench/shots/latest')));
const port = Number(flag('port', 4199));
await mkdir(outDir, {recursive: true});

// A name becomes a filename, so it may not become a path. Anything that is not
// a plain word is refused rather than sanitised: a silently renamed file is a
// picture of the wrong thing in a report.
const safe = n => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(n);

let written = 0;
const server = createServer(async (req, res) => {
 try {
 // The page is served from another port, so every reply needs these.
 res.setHeader('access-control-allow-origin', '*');
 res.setHeader('access-control-allow-headers', 'content-type');
 if (req.method === 'OPTIONS') {res.writeHead(204); res.end(); return;}
 if (req.method !== 'POST') {res.writeHead(405); res.end('POST a data URL.'); return;}
 const url = new URL(req.url, 'http://x');
 const name = url.searchParams.get('name') || '';
 if (!safe(name)) {res.writeHead(400); res.end('Bad name.'); return;}
 let body = '';
 req.setEncoding('utf8');
 for await (const chunk of req) {
  body += chunk;
  if (body.length > 64 * 1024 * 1024) {res.writeHead(413); res.end('Too big.'); return;}
 }
 const m = /^data:image\/(png|jpeg);base64,(.+)$/s.exec(body.trim());
 if (!m) {res.writeHead(400); res.end('Expected a png or jpeg data URL.'); return;}
 const file = path.join(outDir, `${name}.${m[1] === 'jpeg' ? 'jpg' : 'png'}`);
 const bytes = Buffer.from(m[2], 'base64');
 // ALWAYS ANSWER, even when the write fails. The first version let the write
 // throw out of the handler, which sends no response at all -- and the page is
 // waiting on that fetch inside a requestAnimationFrame callback, so it hangs
 // forever with no error anywhere. It happened within an hour of being written:
 // a branch checkout removed the output directory under a running sink, and
 // every capture after that simply never returned.
 try {
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, bytes);
 } catch (e) {
  console.error(`could not write ${path.relative(ROOT, file)}: ${e.message}`);
  res.writeHead(500); res.end(e.message);
  return;
 }
 written++;
 console.log(`${path.relative(ROOT, file)}  ${(bytes.length / 1024).toFixed(0)} KB`);
 res.writeHead(200); res.end('ok');
 } catch (e) {
  // A client that never hears back is worse than one that hears "no".
  try { res.writeHead(500); res.end(String(e && e.message)); } catch {}
 }
});

server.listen(port, '127.0.0.1', () => {
 console.log(`shot sink on http://127.0.0.1:${port} -> ${path.relative(ROOT, outDir)}`);
 console.log(`
Paste into the page, then call captureTo(sink, name):

window.captureTo = (sink, name, quality) => new Promise((resolve, reject) => {
 const c = document.querySelector('canvas');
 if (!c) return reject(new Error('no canvas'));
 // INSIDE the frame callback, or the buffer has already been cleared.
 requestAnimationFrame(async () => {
  const url = quality ? c.toDataURL('image/jpeg', quality) : c.toDataURL('image/png');
  const r = await fetch(sink + '/?name=' + encodeURIComponent(name), {method: 'POST', body: url});
  resolve(r.ok ? name : 'failed: ' + r.status);
 });
});
`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
 console.log(`\n${written} file(s) written.`);
 server.close(() => process.exit(0));
});
