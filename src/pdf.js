// A PDF, written by hand.
//
// The range's session report (range-report.js) is a real .pdf the player can
// keep, print or send, and the game is one offline file with no account and no
// fetched anything -- so it cannot hand the job to a service, and a PDF library
// is 300 KB or more of bundle for a few pages of text and lines. The format is
// old and plain: numbered objects, a table of their byte offsets, and pages
// whose drawing is a short list of operators. This writes exactly that much --
// the two standard Helvetica faces every reader carries (nothing embedded),
// text, lines, rectangles and circles, in colour -- and nothing else.
//
// No DOM and no three.js: it runs in Node, which is how tests/range-report
// checks the file is well formed (every offset in the table lands on its
// object). Coordinates are points from the TOP-LEFT of a US Letter page, the
// way a layout is thought about; the writer turns them over for PDF.

export const PAGE = {width: 612, height: 792};

// Helvetica's advance widths (thousandths of the type size), ASCII 32-126, from
// Adobe's published metrics for the standard fonts. Bold is wider in the
// letters; it is approximated as 6% wider, which is near enough to centre and
// right-align a heading. Figures are 556 in both, so number columns align
// exactly.
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722,
 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333,
 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

// Text goes out in WinAnsi, one byte a character. The handful of typographic
// characters the report uses are mapped to their WinAnsi places; anything else
// outside Latin-1 becomes '?', rather than corrupting the string.
const WIN = {'—': 0x97, '–': 0x96, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85};
export function winAnsi(s) {
 let out = '';
 for (const ch of String(s)) {
  const c = ch.codePointAt(0);
  out += WIN[ch] ? String.fromCharCode(WIN[ch]) : c < 256 ? ch : '?';
 }
 return out;
}
export function textWidth(s, size, bold = false) {
 let w = 0;
 for (const ch of winAnsi(s)) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? W[c - 32] : 556; }
 return w * size / 1000 * (bold ? 1.06 : 1);
}
const esc = s => winAnsi(s).replace(/[\\()]/g, m => '\\' + m);
const num = v => (Math.round(v * 100) / 100).toString();
const rgb = hex => {
 const h = String(hex || '#000').replace('#', ''), full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
 return [0, 2, 4].map(i => num(parseInt(full.slice(i, i + 2), 16) / 255)).join(' ');
};

// One page's drawing, as PDF operators.
class Page {
 constructor() { this.ops = []; }
 y(v) { return PAGE.height - v; }
 text(x, y, s, {size = 10, bold = false, color = '#1d2a22', align = 'left'} = {}) {
  const w = textWidth(s, size, bold), left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(color)} rg ${num(left)} ${num(this.y(y))} Td (${esc(s)}) Tj ET`);
  return w;
 }
 line(x1, y1, x2, y2, {width = .6, color = '#1d2a22', dash = null} = {}) {
  this.ops.push(`q ${num(width)} w ${rgb(color)} RG ${dash ? `[${dash.join(' ')}] 0 d ` : ''}${num(x1)} ${num(this.y(y1))} m ${num(x2)} ${num(this.y(y2))} l S Q`);
 }
 rect(x, y, w, h, {fill = null, stroke = null, width = .6} = {}) {
  const op = fill && stroke ? 'B' : fill ? 'f' : 'S';
  this.ops.push(`q ${fill ? rgb(fill) + ' rg ' : ''}${stroke ? rgb(stroke) + ' RG ' + num(width) + ' w ' : ''}${num(x)} ${num(this.y(y + h))} ${num(w)} ${num(h)} re ${op} Q`);
 }
 // Four Bezier quarters; 0.5523 is the usual constant for a circle.
 circle(cx, cy, r, {fill = null, stroke = null, width = .6} = {}) {
  const k = .5523 * r, x = cx, y = this.y(cy), p = (a, b) => `${num(a)} ${num(b)}`;
  const path = `${p(x + r, y)} m ${p(x + r, y + k)} ${p(x + k, y + r)} ${p(x, y + r)} c ${p(x - k, y + r)} ${p(x - r, y + k)} ${p(x - r, y)} c `
   + `${p(x - r, y - k)} ${p(x - k, y - r)} ${p(x, y - r)} c ${p(x + k, y - r)} ${p(x + r, y - k)} ${p(x + r, y)} c`;
  const op = fill && stroke ? 'B' : fill ? 'f' : 'S';
  this.ops.push(`q ${fill ? rgb(fill) + ' rg ' : ''}${stroke ? rgb(stroke) + ' RG ' + num(width) + ' w ' : ''}${path} ${op} Q`);
 }
 // An ellipse turned by `angle` radians (counter-clockwise on the page).
 ellipse(cx, cy, rx, ry, angle = 0, style = {}) {
  const c = Math.cos(-angle), s = Math.sin(-angle);
  this.ops.push(`q 1 0 0 1 ${num(cx)} ${num(this.y(cy))} cm ${num(c)} ${num(s)} ${num(-s)} ${num(c)} 0 0 cm ${num(rx)} 0 0 ${num(ry)} 0 0 cm`);
  // Drawn as a unit circle in the scaled frame; the line width is scaled back.
  const k = .5523, p = (a, b) => `${num(a)} ${num(b)}`;
  const path = `${p(1, 0)} m ${p(1, k)} ${p(k, 1)} ${p(0, 1)} c ${p(-k, 1)} ${p(-1, k)} ${p(-1, 0)} c ${p(-1, -k)} ${p(-k, -1)} ${p(0, -1)} c ${p(k, -1)} ${p(1, -k)} ${p(1, 0)} c`;
  const {fill = null, stroke = null, width = .6} = style, op = fill && stroke ? 'B' : fill ? 'f' : 'S';
  this.ops.push(`${fill ? rgb(fill) + ' rg ' : ''}${stroke ? rgb(stroke) + ' RG ' + num(width / Math.max(rx, ry, 1e-6)) + ' w ' : ''}${path} ${op} Q`);
 }
}

export class PdfDocument {
 constructor({title = 'Fairway', author = 'Fairway'} = {}) { this.pages = []; this.title = title; this.author = author; }
 addPage() { const p = new Page(); this.pages.push(p); return p; }
 // The whole file, as bytes. Every object's byte offset is recorded as it is
 // written, which is what the cross-reference table needs; one character is
 // one byte throughout, because everything is WinAnsi.
 bytes() {
  if (!this.pages.length) this.addPage();
  const objects = [];
  const add = body => { objects.push(body); return objects.length; };
  const catalog = add(null), pages = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const page of this.pages) {
   const stream = page.ops.join('\n');
   const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
   kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objects[pages - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${esc(this.title)}) /Author (${esc(this.author)}) /Producer (Fairway) >>`);
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
 }
}
