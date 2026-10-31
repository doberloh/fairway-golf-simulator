// WHERE A BUILT COURSE'S FILE IS KEPT, AND ITS DOCUMENT IN MEMORY (the course
// builder, stage 1; docs/COURSE_BUILDER.md, *Course files*).
//
// A built course is megabytes -- its land, its outlines, its trees -- so it
// cannot live in the course library, which is one localStorage entry
// (course-library.js). The library keeps a record naming the course and its
// file's HASH; the file's bytes go to IndexedDB under that hash, and are
// parsed into a document only when a round on it is about to start. The hash
// is also the course's identity everywhere else: the world cache key
// (main.js worldKeyFor), a saved round's settings (`settings.built`), and the
// check a friend's challenge makes that both players have the same course.
//
// With no IndexedDB (some browsers on a file opened from disk) a built course
// lives for the session only, and the import says so.
// `createBuiltStore` takes its back end so tests/built-store.test.mjs runs in Node.
import {readBuiltFile} from './course-doc.js';

const DB = 'fairway-built-courses', STORE = 'files';

export async function hashOf(bytes) {
 const d = await crypto.subtle.digest('SHA-256', bytes);
 return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

function idbBackend(idb) {
 let opening = null;
 const db = () => opening ??= new Promise((resolve, reject) => {
  const r = idb.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
 });
 const run = (mode, f) => db().then(d => new Promise((resolve, reject) => {
  const tx = d.transaction(STORE, mode), req = f(tx.objectStore(STORE));
  tx.oncomplete = () => resolve(req.result);
  tx.onerror = () => reject(tx.error);
 }));
 return {get: k => run('readonly', s => s.get(k)), put: (k, v) => run('readwrite', s => s.put(v, k)), delete: k => run('readwrite', s => s.delete(k))};
}
export const memoryBackend = () => { const m = new Map(); return {get: async k => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); }}; };

export function createBuiltStore({idb = globalThis.indexedDB, backend = null} = {}) {
 const files = backend || (idb ? idbBackend(idb) : memoryBackend());
 const docs = new Map(), session = new Map();
 return {
  // Keeps a file; returns {hash, doc, kept}: `kept` false when it could only
  // be held for this session.
  async put(bytes) {
   const doc = await readBuiltFile(bytes), hash = await hashOf(bytes);
   docs.set(hash, doc);
   let kept = true;
   try { await files.put(hash, bytes); } catch { kept = false; session.set(hash, bytes); }
   return {hash, doc, kept};
  },
  // The document, from memory or from the kept file; null when it is gone.
  async load(hash) {
   if (docs.has(hash)) return docs.get(hash);
   let bytes = session.get(hash);
   if (!bytes) try { bytes = await files.get(hash); } catch { bytes = null; }
   if (!bytes) return null;
   const doc = await readBuiltFile(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
   docs.set(hash, doc);
   return doc;
  },
  // Only what is already in memory: the synchronous paths (loadCourse) ask this.
  now: hash => docs.get(hash) ?? null,
  async bytes(hash) { const b = session.get(hash) ?? await files.get(hash).catch(() => null); return b ? new Uint8Array(b) : null; },
  async remove(hash) { docs.delete(hash); session.delete(hash); await files.delete(hash).catch(() => {}); },
  // Frees the parsed documents but the one named (a round on it may be next).
  forget(keep = null) { for (const k of [...docs.keys()]) if (k !== keep) docs.delete(k); },
 };
}
