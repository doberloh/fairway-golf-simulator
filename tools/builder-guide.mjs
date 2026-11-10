#!/usr/bin/env node
// THE BUILDER GUIDE, BUILT (the builder-ux goal, item 22, 10 November 2026;
// the owner: "Include screenshots ... Ship it in the game zip files").
// docs/BUILDER_GUIDE.md and its pictures (docs/builder-guide/*.webp, taken by
// tools/capture/builder-guide.mjs) made into ONE page with the pictures inside
// it -- offline, like the game -- at dist/builder-guide.html, which the
// release packs beside Fairway Builder.html as "Fairway Builder Guide.html".
// A Markdown file in a zip shows no pictures, hence the page. Run by
// `npm run build`; the Markdown is the guide's one source.
//
// It reads the small part of Markdown the guide uses: # and ## headings,
// paragraphs, - and 1. lists, a picture alone on its line, **bold**, `code`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs', 'BUILDER_GUIDE.md'), OUT = path.join(ROOT, 'dist', 'builder-guide.html');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/[*][*]([^*]+)[*][*]/g, '<b>$1</b>').replace(/ -- /g, ' &ndash; ');
const picture = (alt, src) => {
 const file = path.join(ROOT, 'docs', src);
 if (!fs.existsSync(file)) throw Error(`The guide names a picture that is not there: ${src} (run tools/capture/builder-guide.mjs)`);
 return `<figure><img src="data:image/webp;base64,${fs.readFileSync(file).toString('base64')}" alt="${esc(alt)}" loading="lazy"><figcaption>${inline(alt)}</figcaption></figure>`;
};

export function guideHtml(md) {
 const out = [], lines = md.replace(/\r/g, '').split('\n');
 let para = [], list = null;
 const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
 for (const line of lines) {
  const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
  if (!line.trim()) { flush(); continue; }
  if (img) { flush(); out.push(picture(img[1], img[2])); continue; }
  const h = line.match(/^(#{1,3}) (.*)$/);
  if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
  const li = line.match(/^(-|[0-9]+[.]) (.*)$/);
  if (li) { if (para.length) flush(); const tag = li[1] === '-' ? 'ul' : 'ol'; if (!list || list.tag !== tag) { flush(); list = {tag, items: []}; } list.items.push(li[2]); continue; }
  if (list && /^ {2,}/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
  para.push(line.trim());
 }
 flush();
 return out.join('\n');
}

const body = guideHtml(fs.readFileSync(SRC, 'utf8'));
const title = (fs.readFileSync(SRC, 'utf8').match(/^# (.*)$/m)?.[1] ?? 'Fairway Course Builder guide').replace(/:.*/, '');
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} guide</title>
<style>
:root{--bg:#061513;--panel:#0b2420;--fg:#e6f4ef;--muted:#a7d8cf;--accent:#5eead4;--hot:#fde68a;--line:rgba(94,234,212,.25);color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px max(16px,env(safe-area-inset-left)) 80px}
h1{font:800 clamp(30px,5vw,44px)/1.05 "Arial Narrow",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.01em;margin:0 0 18px;color:var(--fg)}
h2{font:800 24px/1.15 "Arial Narrow",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em;margin:44px 0 10px;color:var(--accent);border-top:1px solid var(--line);padding-top:22px}
p,li{max-width:70ch}
b{color:#fff}
code{font:14px ui-monospace,Consolas,monospace;background:var(--panel);padding:1px 5px;border-radius:4px}
ul,ol{padding-left:24px}
li{margin:4px 0}
figure{margin:18px 0 26px}
figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:6px}
figcaption{color:var(--muted);font-size:14px;margin-top:6px}
</style></head>
<body><main>
${body}
</main></body></html>
`;
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
 fs.mkdirSync(path.dirname(OUT), {recursive: true});
 fs.writeFileSync(OUT, page);
 console.log(`dist/builder-guide.html  ${(page.length / 1024).toFixed(0)} kB`);
}
