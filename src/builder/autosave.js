// NEVER LOSE WORK (the builder-ux goal, item 12, 10 November 2026): door 2's
// draft kept in this browser's own storage (IndexedDB) every few minutes and
// at every step, so a closed tab, a crash or a power cut costs a few minutes
// at most; the next visit offers it back. One draft is kept -- the latest --
// with its name, step and time. Nothing leaves the machine. A browser that
// refuses storage (a private window) simply keeps none.
// Its own database: 'fairway-builder' is the LIDAR folder's (lidar-folder.js), at
// version 1 with no store for this, which made every keep fail silently.
const DB = 'fairway-builder-autosave', STORE = 'autosave', KEY = 'door2';
function db() {
 return new Promise((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(Error('no storage'));
  const q = indexedDB.open(DB, 1);
  q.onupgradeneeded = () => q.result.createObjectStore(STORE);
  q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
 });
}
const run = async (mode, f) => { const d = await db(); try { return await new Promise((res, rej) => { const t = d.transaction(STORE, mode), q = f(t.objectStore(STORE)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); } finally { d.close(); } };
// {bytes, name, step, at} -> kept.
export async function keepDraft(bytes, {name, step}) { try { await run('readwrite', s => s.put({bytes, name, step, at: Date.now()}, KEY)); return true; } catch { return false; } }
export async function keptDraft() { try { return (await run('readonly', s => s.get(KEY))) ?? null; } catch { return null; } }
export async function dropDraft() { try { await run('readwrite', s => s.delete(KEY)); } catch { /* none kept */ } }
