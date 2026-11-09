// A band of a built course's field, baked on another core (bake-pool.js).
import {bakeBuiltField} from './built-field.js';

self.onmessage = e => {
 const {id, doc, ex, ez, r0, r1} = e.data;
 try {
  const f = bakeBuiltField(doc, ex, ez, [r0, r1]);
  self.postMessage({id, ok: true, a: f.a, b: f.b}, [f.a.buffer, f.b.buffer]);
 } catch (err) { self.postMessage({id, ok: false, error: String(err?.message || err)}); }
};
