// THE LAZ DECODER IN THE BUILDER'S PAGE (the course builder, stage 6):
// laz-perf's web build (Apache-2.0; docs/THIRD_PARTY_NOTICES.txt) with its
// WebAssembly inlined into the page by the build (a data URL, as every asset
// in the single file is) and handed in as `wasmBinary`, so the decoder never
// fetches its .wasm -- the builder makes no request. Created once, on the
// first LAZ file opened. Node (tests, tools) loads laz-perf's Node build
// itself and never imports this.
import createLazPerf from 'laz-perf/lib/web/laz-perf.js';
import wasmUrl from 'laz-perf/lib/web/laz-perf.wasm?url';

let made = null;
export function lazModule() {
 made ??= (async () => {
  const b64 = String(wasmUrl).split(',')[1];
  if (!b64) throw Error('The LAZ decoder was not built into this page.');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return createLazPerf({wasmBinary: bin});
 })();
 return made;
}
