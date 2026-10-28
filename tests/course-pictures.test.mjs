// Where a saved course's picture is kept (src/course-pictures.js), with
// stand-ins for the browser's storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPictureStore, localBackend, LOCAL_LIMIT} from '../src/course-pictures.js';

const memoryStorage = () => { const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m}; };

test('with no IndexedDB, pictures are kept in their own localStorage entry and come back', async () => {
 const storage = memoryStorage(), store = createPictureStore({idb: null, storage});
 assert.equal(await store.put('c1', 'data:image/webp;base64,AAAA'), true);
 assert.equal(await store.get('c1'), 'data:image/webp;base64,AAAA');
 assert.equal(await store.get('c2'), null);
 await store.remove('c1');
 assert.equal(await store.get('c1'), null);
 assert.equal([...storage.m.keys()].length, 1, 'one entry, beside the library, not in it');
});

test('past what the fallback takes, a picture is not kept, and nothing throws', async () => {
 const store = createPictureStore({idb: null, storage: memoryStorage()});
 assert.equal(await store.put('big', 'x'.repeat(LOCAL_LIMIT + 10)), false);
 assert.equal(await store.get('big'), null);
});

test('a storage that refuses everything loses the picture, never the caller', async () => {
 const broken = {getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); }};
 const store = createPictureStore({idb: null, storage: broken});
 assert.equal(await store.put('c1', 'data:x'), false);
 assert.equal(await store.get('c1'), null);
 assert.equal(await store.remove('c1'), true);
});

test('IndexedDB is tried first; when it fails, the fallback serves', async () => {
 const idb = {open: () => { const r = {}; setTimeout(() => { r.error = Error('blocked'); r.onerror?.(); }, 0); return r; }};
 const storage = memoryStorage(), store = createPictureStore({idb, storage});
 assert.equal(await store.put('c1', 'data:pic'), true);
 assert.equal(await store.get('c1'), 'data:pic');
 assert.ok(storage.m.size === 1);
});

test('the fallback reads a damaged entry as empty rather than failing', async () => {
 const storage = memoryStorage();
 storage.setItem('fairway-course-pictures-v1', '{not json');
 const b = localBackend(storage);
 assert.equal(await b.get('x'), undefined);
});
