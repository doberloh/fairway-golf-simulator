// A DOOR 2 DRAFT (the owner, 1 November 2026: "save from any point in the
// builder"): a real course part way through door 2 -- the land built from the
// LIDAR, the trace's layers, trees and houses, the holes marked so far, the
// boundary, the name and landscape, and the step it was at -- in a
// `.fairway-draft` file (a ZIP), opened back at that step. Pure;
// tests/builder-draft.test.mjs.
//
// Not in a draft: the LIDAR files themselves (gigabytes; the land built from
// them is kept, so they are needed again only to build the land anew) and the
// pictures (never saved, as in a course: fetched again, or brought again, and
// each picture's lining up IS kept). The game does not open a draft.
import {writeZip, readZip, isZip} from '../zip.js';

// Version 2 (1 November 2026): what the 3D editor sent back (round-trip.js) --
// its shaping as a height difference (edits/land.bin, a float a land cell)
// and its creeks. A version 1 draft reads as one with neither.

export const DRAFT_KIND = 'fairway-draft', DRAFT_VERSION = 2, DRAFT_EXT = '.fairway-draft';
// The land's grids kept (`surface` is ground plus canopy, made again on reading).
const F32 = ['ground', 'canopy', 'intensity'], U8 = ['water', 'building', 'multi', 'noReturns', 'filled'];
const text = new TextDecoder();
const bytesOf = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

// `d`: {step, name, landscape, credits, holes, holesN, hole, boundary,
// traceMode, box, sources: [{name, crs}], view, picOffsets, osm, land|null,
// trees, trace: {masks: Map kind -> Uint8Array, hidden: [kind], trees, homes}|null,
// landEdits: Float32Array|null, creeks, rocks}.
export async function writeDraft(d) {
 const parts = [], land = d.land;
 const json = {kind: DRAFT_KIND, version: DRAFT_VERSION, step: d.step, name: d.name, landscape: d.landscape, credits: d.credits ?? [], holes: d.holes ?? [], holesN: d.holesN, hole: d.hole ?? 0,
  boundary: d.boundary ?? null, traceMode: d.traceMode ?? null, box: d.box ?? null, sources: (d.sources ?? []).map(s => ({name: s.name, crs: s.crs ?? null})), view: d.view ?? {}, picOffsets: d.picOffsets ?? {}, osm: d.osm ? {said: d.osm.said ?? '', trees: d.osm.trees ?? [], homes: d.osm.homes ?? []} : null,
  trees: d.trees ?? [], land: null, trace: null, creeks: d.creeks ?? [], rocks: d.rocks ?? [], landEdits: !!(land && d.landEdits)};
 if (land && d.landEdits) parts.push({name: 'edits/land.bin', data: bytesOf(d.landEdits)});
 if (land) {
  json.land = {nx: land.nx, nz: land.nz, cell: land.cell, halfX: land.halfX, halfZ: land.halfZ, center: land.center, unit: land.unit, method: land.method, points: land.points ?? 0, rgb: !!land.rgb, grids: [...F32, ...U8].filter(k => land[k])};
  for (const k of json.land.grids) parts.push({name: `land/${k}.bin`, data: bytesOf(land[k])});
  if (land.rgb) parts.push({name: 'land/rgb.bin', data: land.rgb});
 }
 if (d.osm?.codes) parts.push({name: 'osm/codes.bin', data: d.osm.codes});
 if (d.trace) {
  json.trace = {layers: [...d.trace.masks.keys()], hidden: d.trace.hidden ?? [], trees: d.trace.trees ?? [], homes: d.trace.homes ?? [], bunkers: d.trace.bunkers ?? [], creekLines: d.trace.creekLines ?? []};
  for (const [k, m] of d.trace.masks) parts.push({name: `trace/${k}.bin`, data: m});
 }
 return writeZip([{name: 'draft.json', data: JSON.stringify(json)}, ...parts]);
}

// Whether a file's bytes are a draft (a ZIP holding draft.json).
export async function isDraft(bytes) { return isZip(bytes) && (await readZip(bytes)).has('draft.json'); }

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
  land = {...j.land}; delete land.grids;
  for (const k of j.land.grids) { const b = part(`land/${k}.bin`, F32.includes(k) ? N * 4 : N); land[k] = F32.includes(k) ? new Float32Array(b.slice().buffer) : b.slice(); }
  land.rgb = j.land.rgb ? part('land/rgb.bin', N * 3).slice() : null;
  land.surface = Float32Array.from(land.ground, (g, k) => g + (land.canopy?.[k] ?? 0));
 }
 let trace = null;
 if (j.trace && land) {
  const N = land.nx * land.nz, masks = new Map();
  for (const k of j.trace.layers) masks.set(k, part(`trace/${k}.bin`, N).slice());
  trace = {masks, hidden: j.trace.hidden, trees: j.trace.trees, homes: j.trace.homes, bunkers: j.trace.bunkers ?? [], creekLines: j.trace.creekLines ?? []};
 }
 const osm = j.osm && land && parts.has('osm/codes.bin') ? {...j.osm, codes: part('osm/codes.bin', land.nx * land.nz).slice()} : null;
 const landEdits = j.landEdits && land ? new Float32Array(part('edits/land.bin', land.nx * land.nz * 4).slice().buffer) : null;
 return {...j, land, trace, osm, landEdits, creeks: j.creeks ?? [], rocks: j.rocks ?? []};
}
