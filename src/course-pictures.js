// WHERE A SAVED COURSE'S PICTURE IS KEPT (the 1.0 polish, 27 October 2026;
// docs/UI_POLISH.md, *A picture for every saved course*).
//
// Not in the course library (course-library.js), which is one localStorage
// entry: the browser gives a page about 5 MB of localStorage in all, and two
// hundred pictures of 25-40 KB would take most of it from the saves, the
// profiles and the settings. So pictures go to IndexedDB, which a browser
// sizes in hundreds of megabytes, keyed by the course's id. Where IndexedDB is
// missing or refuses (some browsers on a file opened from disk), they fall
// back to their own localStorage entry, and past what that takes a course is
// simply kept without its picture: the card shows its landscape's pictures, as
// an old save does.
//
// Asynchronous, because IndexedDB is. `createPictureStore` takes its two
// back ends, so tests/course-pictures.test.mjs runs it in Node with stand-ins.
const DB = 'fairway-course-pictures', STORE = 'pictures', LOCAL = 'fairway-course-pictures-v1';
// What the localStorage fallback may hold, in characters (PLACED: a fifth of
// the usual 5 MB, about thirty pictures).
export const LOCAL_LIMIT = 1_000_000;

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
 return {get: id => run('readonly', s => s.get(id)), put: (id, url) => run('readwrite', s => s.put(url, id)), delete: id => run('readwrite', s => s.delete(id))};
}

export function localBackend(storage) {
 const read = () => { try { return JSON.parse(storage.getItem(LOCAL) || '{}') || {}; } catch { return {}; } };
 return {
  get: async id => read()[id] ?? undefined,
  put: async (id, url) => {
   const all = read(); all[id] = url;
   const text = JSON.stringify(all);
   if (text.length > LOCAL_LIMIT) throw Error('full');
   storage.setItem(LOCAL, text);
  },
  delete: async id => { const all = read(); delete all[id]; storage.setItem(LOCAL, JSON.stringify(all)); },
 };
}

export function createPictureStore({idb = globalThis.indexedDB, storage = globalThis.localStorage} = {}) {
 const primary = idb ? idbBackend(idb) : null, fallback = storage ? localBackend(storage) : null;
 // Try IndexedDB, then the fallback; never throw to the caller -- a picture
 // is never worth losing a save over.
 const tryBoth = async (f, none) => {
  for (const b of [primary, fallback]) { if (!b) continue; try { return await f(b); } catch {} }
  return none;
 };
 return {
  // The picture's data URL, or null.
  get: id => tryBoth(async b => { const v = await b.get(id); if (v == null) throw Error('none'); return v; }, null),
  // true when it was kept somewhere.
  put: (id, url) => tryBoth(async b => { await b.put(id, url); return true; }, false),
  remove: id => Promise.all([primary, fallback].filter(Boolean).map(b => b.delete(id).catch(() => {}))).then(() => true),
 };
}
