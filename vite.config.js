import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { GENERATOR_VERSION, SCHEMA_VERSION } from './src/settings-schema.js';

// A NAME FOR EACH BUILD, SO A BUG REPORT CAN BE TIED TO A TREE.
//
// Until this existed the app carried a settings SCHEMA version and a GENERATOR
// version and nothing that said which build was running. Ship three builds in
// three weeks and a tester's report cannot be matched to any of them, which
// means debugging something already fixed.
//
// The commit is read from git where git is there, and is absent where it is
// not -- somebody building from the source archive has no repository, and that
// is a normal way to build this, not an error. The timestamp always works, so
// an unstamped build is still distinguishable from another unstamped build.
// stdio silences git's own complaint when this is not a repository.
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim() || null;
  } catch { return null; }
})();

// THE VERSIONS, READABLE WITHOUT RUNNING THE GAME. The website lives in its
// own repository and builds its demo from the released Fairway.html, so it has
// no src/ to import. It still needs both numbers: the sample course code on its
// front page carries the generator and schema versions it was made under, and
// a code written by hand would greet every visitor with a version notice after
// the next generator bump. A meta tag costs fifty bytes and keeps the two
// repositories from sharing code. Do not remove it without telling the website.
const versions = {
  name: 'fairway-versions',
  transformIndexHtml: () => [{tag: 'meta', attrs: {name: 'fairway-versions', content: `generator=${GENERATOR_VERSION} schema=${SCHEMA_VERSION}`}, injectTo: 'head-prepend'}],
};

export default defineConfig({
  plugins: [versions, viteSingleFile()],
  define: {__FAIRWAY_BUILD__: JSON.stringify({commit, built: new Date().toISOString()})},
  build: {target: 'es2022', assetsInlineLimit: 10000000},
  server: {port: 5173},
});
