// A contact sheet: every picture in a folder as one image, to look a set over
// at a glance. Light work (a page of thumbnails); no capture build needed.
//   node tools/capture/contact-sheet.mjs <folder> [columns] [out.jpg]
// Uses the -thumb.jpg files when there are any, else every .jpg.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const dir = path.resolve(process.argv[2] || 'bench/shots/media/times');
const cols = Number(process.argv[3] || 4);
const out = path.resolve(process.argv[4] || path.join(dir, '_contact.jpg'));
let files = fs.readdirSync(dir).filter(f => f.endsWith('-thumb.jpg'));
if (!files.length) files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') && !f.startsWith('_'));
files.sort();
const html = `<!doctype html><style>body{margin:0;background:#111;font:12px sans-serif;color:#ddd}
.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:4px}figure{margin:0}img{width:100%;display:block}
figcaption{padding:2px 4px}</style><div class="g">${files.map(f => `<figure><img src="${pathToFileURL(path.join(dir, f)).href}"><figcaption>${f.replace(/-thumb\.jpg$|\.jpg$/, '')}</figcaption></figure>`).join('')}</div>`;
const tmp = path.join(dir, '_contact.html');
fs.writeFileSync(tmp, html);
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: cols * 400, height: 800}});
await p.goto(pathToFileURL(tmp).href);
await p.waitForLoadState('load');
await p.screenshot({path: out, fullPage: true, type: 'jpeg', quality: 85});
await b.close();
fs.unlinkSync(tmp);
console.log(`${out}: ${files.length} pictures`);
