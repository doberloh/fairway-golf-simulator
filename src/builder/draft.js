// A DOOR 2 DRAFT (the owner, 1 November 2026: "save from any point in the
// builder"): a real course part way through door 2 -- the land built from the
// LIDAR, the trace's layers, trees and houses, the holes marked so far, the
// boundary, the name and landscape, and the step it was at -- in a
// `.fairway-draft` file (a ZIP), opened back at that step. Pure;
// tests/builder-draft.test.mjs.
//
// Not in a draft: the LIDAR files themselves (gigabytes; the land built from
// them is kept, so they are needed again only to build the land anew). The
// game does not open a draft. A draft is also the builder's section of a course
// file (course-doc.js `BUILDER_PART`), so a course saved from the editor reopens
// with all of this behind it.
import {writeZip, readZip, isZip} from '../zip.js';

// Version 2 (1 November 2026): what the 3D editor sent back (round-trip.js) --
// its shaping as a height difference (edits/land.bin, a float a land cell)
// and its creeks. A version 1 draft reads as one with neither.
// Version 3 (5 November 2026; the owner: "when reopening a builder file, we
// need to have everything"): the pictures (pictures/, picture-file.js says how
// each is packed and placed), OpenStreetMap's download as it came (osm/raw.json)
// with the map's own trees and the course picked, where the land is when the
// survey does not say (`geo`), and which picture was showing. A version 2 draft
// reads as one with none of them: its map data has no features behind it, and
// door 2 offers only what that can do.
// Version 4 (24 November 2026, branch builder-outlines; the owner: "I want
// these pixellated views gone from the builder entirely"): the trace's layers
// as outlines (trace/shapes.json, each layer a list of paths of whole
// centimetres, shapes.js `packSet`), and OpenStreetMap's trace as laid
// likewise (osm/shapes.json). A version 3 draft's masks of cells
// (trace/<layer>.bin, osm/codes.bin) are turned into outlines once, as it
// opens. An older builder refuses a version 4 draft in plain words (it
// could not read its layers).

import * as S from './shapes.js';
import {codesToShapes} from './trace-edit.js';
export const DRAFT_KIND = 'fairway-draft', DRAFT_VERSION = 4, DRAFT_EXT = '.fairway-draft';
const packShapes = m => JSON.stringify(Object.fromEntries([...m].filter(([, set]) => set.length).map(([k, set]) => [k, S.packSet(set)])));
const unpackShapes = t => new Map(Object.entries(JSON.parse(t)).map(([k, v]) => [k, S.unpackSet(v)]));
// The land's grids kept (`surface` is ground plus canopy, made again on reading).
const F32 = ['ground', 'canopy', 'intensity'], U8 = ['water', 'building', 'multi', 'noReturns', 'filled'];
const text = new TextDecoder();
const bytesOf = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

// `d`: {step, name, landscape, credits, holes, holesN, hole, boundary,
// traceMode, box, sources: [{name, crs}], view, picOffsets, osm, land|null,
// trees, trace: {shapes: Map kind -> set (shapes.js), hidden: [kind], trees, homes}|null,
// landEdits: Float32Array|null, creeks, rocks, geo: {lat, lon}|null, picShow,
// pics: [{group, label, provider, file, width, height, credit, place, pack:
// {image, type, nir}}]}.
export async function writeDraft(d) {
 const parts = [], land = d.land;
 const json = {kind: DRAFT_KIND, version: DRAFT_VERSION, step: d.step, name: d.name, named: !!d.named, landscape: d.landscape, credits: d.credits ?? [], holes: d.holes ?? [], holesN: d.holesN, hole: d.hole ?? 0,
  boundary: d.boundary ?? null, traceMode: d.traceMode ?? null, box: d.box ?? null, sources: (d.sources ?? []).map(s => ({name: s.name, crs: s.crs ?? null})), view: d.view ?? {}, picOffsets: d.picOffsets ?? {}, osm: d.osm ? {said: d.osm.said ?? '', trees: d.osm.trees ?? [], homes: d.osm.homes ?? [], osmTrees: d.osm.osmTrees ?? null, course: d.osm.course ?? null, shift: d.osm.shift ?? null, laid: d.osm.laid ?? null} : null,
  geo: d.geo ?? null, picShow: d.picShow ?? null, treePlan: d.treePlan ?? null, surround: d.surround ?? null, pics: (d.pics ?? []).map(({group, label, provider, file, width, height, credit, place, pack}) => ({group, label, provider: provider ?? null, file: file ?? null, width, height, credit: credit ?? null, place, type: pack.type, nir: !!pack.nir})),
  trees: d.trees ?? [], land: null, trace: null, creeks: d.creeks ?? [], rocks: d.rocks ?? [], landEdits: !!(land && d.landEdits)};
 if (land && d.landEdits) parts.push({name: 'edits/land.bin', data: bytesOf(d.landEdits)});
 if (land) {
  json.land = {nx: land.nx, nz: land.nz, cell: land.cell, halfX: land.halfX, halfZ: land.halfZ, center: land.center, unit: land.unit, method: land.method, points: land.points ?? 0, rgb: !!land.rgb, grids: [...F32, ...U8].filter(k => land[k])};
  for (const k of json.land.grids) parts.push({name: `land/${k}.bin`, data: bytesOf(land[k])});
  if (land.rgb) parts.push({name: 'land/rgb.bin', data: land.rgb});
  // THE FINE GROUND (22 November 2026; land.js `fine`): the half-metre detail
  // inside the course's outline, which the patches are made from. A draft
  // without it reads as before (still version 3: an older builder reading a
  // newer draft leaves the part alone and builds without patches).
  if (land.fine) { const {detail, ...f} = land.fine; json.land.fine = f; parts.push({name: 'land/fine.bin', data: bytesOf(detail)}); }
 }
 // The course's rough outline (door-real.js): [lon, lat] corners, or the
 // survey's own map units where it does not say where it lies (`detailMap`).
 json.detailRing = d.detailRing ?? null; json.detailMap = !!d.detailMap;
 if (d.osm?.shapes) parts.push({name: 'osm/shapes.json', data: packShapes(d.osm.shapes)});
 if (d.osm?.raw) parts.push({name: 'osm/raw.json', data: typeof d.osm.raw === 'string' ? d.osm.raw : JSON.stringify(d.osm.raw)});
 (d.pics ?? []).forEach((p, i) => {
  parts.push({name: `pictures/${i}.${p.pack.type}`, data: p.pack.image, store: p.pack.type === 'jpeg'});
  if (p.pack.nir) parts.push({name: `pictures/${i}.nir`, data: p.pack.nir});
 });
 if (d.trace) {
  json.trace = {hidden: d.trace.hidden ?? [], trees: d.trace.trees ?? [], homes: d.trace.homes ?? [], bunkers: d.trace.bunkers ?? [], creekLines: d.trace.creekLines ?? []};
  parts.push({name: 'trace/shapes.json', data: packShapes(d.trace.shapes)});
 }
 return writeZip([{name: 'draft.json', data: JSON.stringify(json)}, ...parts]);
}

// Whether a file's bytes are a draft (a ZIP holding draft.json).
export async function isDraft(bytes) { return isZip(bytes) && (await readZip(bytes, {only: name => name === 'draft.json'})).has('draft.json'); }

export async function readDraft(bytes) {
 const parts = await readZip(bytes), raw = parts.get('draft.json');
 if (!raw) throw Error('This is not a Fairway Course Builder draft.');
 const j = JSON.parse(text.decode(raw));
 if (j.kind !== DRAFT_KIND) throw Error('This is not a Fairway Course Builder draft.');
 if (!Number.isInteger(j.version) || j.version > DRAFT_VERSION) throw Error('This draft was made by a newer Fairway Course Builder. Update Fairway, then open it again.');
 const part = (name, n) => { const b = parts.get(name); if (!b || b.length !== n) throw Error(`This draft is damaged: ${name} is missing or the wrong size.`); return b; };
 let land = null;
 if (j.land) {
  const {nx, nz} = j.land, N = nx * nz;
  land = {...j.land}; delete land.grids; delete land.fine;
  if (j.land.fine) { const f = j.land.fine, b = part('land/fine.bin', f.nx * f.nz * 2); land.fine = {...f, detail: new Int16Array(b.slice().buffer)}; }
  for (const k of j.land.grids) { const b = part(`land/${k}.bin`, F32.includes(k) ? N * 4 : N); land[k] = F32.includes(k) ? new Float32Array(b.slice().buffer) : b.slice(); }
  land.rgb = j.land.rgb ? part('land/rgb.bin', N * 3).slice() : null;
  land.surface = Float32Array.from(land.ground, (g, k) => g + (land.canopy?.[k] ?? 0));
 }
 let trace = null;
 if (j.trace && land) {
  const N = land.nx * land.nz;
  let shapes;
  if (parts.has('trace/shapes.json')) shapes = unpackShapes(text.decode(parts.get('trace/shapes.json')));
  // A draft from before outlines: each layer's cells turned into outlines once.
  else { shapes = new Map(); for (const k of j.trace.layers ?? []) { const set = S.fromMask(part(`trace/${k}.bin`, N), land); if (set.length) shapes.set(k, set); } }
  trace = {shapes, hidden: j.trace.hidden, trees: j.trace.trees, homes: j.trace.homes, bunkers: j.trace.bunkers ?? [], creekLines: j.trace.creekLines ?? []};
 }
 const osmShapes = !j.osm || !land ? null : parts.has('osm/shapes.json') ? unpackShapes(text.decode(parts.get('osm/shapes.json'))) : parts.has('osm/codes.bin') ? codesToShapes(part('osm/codes.bin', land.nx * land.nz), land) : null;
 const osm = osmShapes ? {...j.osm, shapes: osmShapes, raw: parts.has('osm/raw.json') ? text.decode(parts.get('osm/raw.json')) : null} : null;
 const pics = (j.pics ?? []).map(({type, nir, ...p}, i) => {
  const image = parts.get(`pictures/${i}.${type}`);
  if (!image) throw Error(`This draft is damaged: its picture ${p.label} is missing.`);
  return {...p, pack: {type, image, nir: nir ? part(`pictures/${i}.nir`, p.width * p.height) : null}};
 });
 const landEdits = j.landEdits && land ? new Float32Array(part('edits/land.bin', land.nx * land.nz * 4).slice().buffer) : null;
 return {...j, land, trace, osm, landEdits, creeks: j.creeks ?? [], rocks: j.rocks ?? [], geo: j.geo ?? null, picShow: j.picShow ?? null, pics};
}
