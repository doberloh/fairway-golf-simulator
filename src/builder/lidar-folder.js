// THE LIDAR FOLDER (the owner, 1 November 2026: "when downloading LIDAR files
// into the browser. Are those files saved?, make sure that they go somewhere
// local always. We don't want the user needing to re download the files").
//
// One folder on the player's own disk, picked once and remembered (the
// browser keeps the folder's handle in IndexedDB, and asks again for leave
// to use it on the next visit): every LIDAR door 2 downloads is written
// there as it arrives, and read from there instead of downloaded when the
// same search asks for it again. Files from sites the builder cannot save
// from -- rockyweb's tiles, the state portals' ZIPs -- land in the browser's
// own download folder, so Downloads is the folder suggested, and Load from
// the folder reads them all. Where the browser cannot pick a folder (Firefox
// and Safari have no showDirectoryPicker), each download is saved as a file
// the browser's way, into its download folder -- still never kept only in the
// page. Nothing here goes online.
//
// Pure but for the browser's own objects, which are passed in or looked for:
// tests/lidar-folder.test.mjs drives it with fake folders.

// What door 2 reads (formats.js), and the ZIPs that hold them.
export const LIDAR_FILE = /\.(las|laz|e57|ply|pts|ptx|xyz|txt|csv|tif|tiff|asc|flt|bil|hgt|zip|prj|hdr)$/i;
export const canPick = () => typeof globalThis.showDirectoryPicker === 'function';

const DB = 'fairway-builder', STORE = 'handles', KEY = 'lidar-folder';
function db() {
 return new Promise((ok, no) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}
async function tx(mode, f) { const d = await db(); return new Promise((ok, no) => { const t = d.transaction(STORE, mode), r = f(t.objectStore(STORE)); t.oncomplete = () => { d.close(); ok(r?.result); }; t.onerror = () => { d.close(); no(t.error); }; }); }
// The folder picked on an earlier visit, or null.
export async function recallFolder() { try { return (await tx('readonly', s => s.get(KEY))) ?? null; } catch { return null; } }
export async function rememberFolder(dir) { try { await tx('readwrite', s => s.put(dir, KEY)); } catch { /* a private window: kept for this visit only */ } }

// Leave to read and write it: asked for (a prompt) only when `ask`, which
// must be inside a press.
export async function allowed(dir, ask = false) {
 if (!dir?.queryPermission) return !!dir;
 const how = {mode: 'readwrite'};
 if (await dir.queryPermission(how) === 'granted') return true;
 return ask ? await dir.requestPermission(how) === 'granted' : false;
}
export async function pickFolder() {
 const dir = await globalThis.showDirectoryPicker({id: 'fairway-lidar', mode: 'readwrite', startIn: 'downloads'});
 await rememberFolder(dir);
 return dir;
}

// A file in the folder, whole (`size` when known: a browser download not
// yet finished is a .crdownload, or the name at a smaller size), or null.
export async function fileIn(dir, name, size = null) {
 if (!dir) return null;
 try { const f = await (await dir.getFileHandle(name)).getFile(); return size == null || f.size === size ? f : null; } catch { return null; }
}
export async function bytesIn(dir, name) { const f = await fileIn(dir, name); return f ? new Uint8Array(await f.arrayBuffer()) : null; }
// Written whole: to a temporary name the browser renames when done, so a
// download cut off leaves no half file under the real name.
export async function saveIn(dir, name, bytes) {
 const w = await (await dir.getFileHandle(name, {create: true})).createWritable();
 try { await w.write(bytes); await w.close(); } catch (e) { await w.abort?.(); throw e; }
}
// A file taken out of the folder: only ever one the builder made, whose every
// piece is in the file that replaced it (door-real.js keepAll checks that first).
export async function removeIn(dir, name) { try { await dir.removeEntry(name); return true; } catch { return false; } }
// Where no folder can be picked: the browser saves it, into its downloads.
export function saveAsDownload(name, bytes) {
 const url = URL.createObjectURL(new Blob([bytes])), a = document.createElement('a');
 a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
 setTimeout(() => URL.revokeObjectURL(url), 60e3);
}
// Every LIDAR file in the folder and the folders one down in it (a DNR ZIP
// unpacked makes laz/ and dtm/): [{name, path, file}], by name.
export async function listIn(dir, depth = 1) {
 const out = [];
 const walk = async (d, at, left) => {
  for await (const [name, h] of d.entries()) {
   if (h.kind === 'directory') { if (left > 0) await walk(h, at + name + '/', left - 1); }
   else if (LIDAR_FILE.test(name) && !/\.crdownload$/i.test(name)) out.push({name, path: at + name, file: await h.getFile()});
  }
 };
 await walk(dir, '', depth);
 return out.sort((a, b) => a.path.localeCompare(b.path));
}

// Which of the folder's files lie over the place searched for: a kept USGS
// square by the middle in its name (lidar-search.js squareName), a LAS or
// LAZ by its header's bounds carried to degrees (`toDegrees(crs)`, a
// converter, or null where the grid is not known). Others are not known.
// Returns true, false, or null.
export async function overPlace(entry, box, {parseHeader, toDegrees}) {
 const m = entry.name.match(/_(-?\d+\.\d+)_(-?\d+\.\d+)_(\d+)m\.ept\.zip$/i);
 const hits = (lon0, lat0, lon1, lat1) => lon1 >= box.lon0 && lon0 <= box.lon1 && lat1 >= box.lat0 && lat0 <= box.lat1;
 if (m) { const lat = +m[1], lon = +m[2], h = +m[3] / 2 / 111320, w = h / Math.cos(lat * Math.PI / 180); return hits(lon - w, lat - h, lon + w, lat + h); }
 if (!/\.la[sz]$/i.test(entry.name)) return null;
 try {
  const head = new Uint8Array(await entry.file.slice(0, 100).arrayBuffer()), at = new DataView(head.buffer).getUint32(96, true);
  const h = parseHeader(new Uint8Array(await entry.file.slice(0, Math.min(entry.file.size, at + 4)).arrayBuffer()));
  const conv = toDegrees(h.crs); if (!conv) return null;
  const c = [[h.bounds.minX, h.bounds.minY], [h.bounds.maxX, h.bounds.minY], [h.bounds.minX, h.bounds.maxY], [h.bounds.maxX, h.bounds.maxY]].map(([x, y]) => conv(x, y));
  return hits(Math.min(...c.map(q => q.x)), Math.min(...c.map(q => q.y)), Math.max(...c.map(q => q.x)), Math.max(...c.map(q => q.y)));
 } catch { return null; }
}
