import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';

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

export default defineConfig({
  plugins: [viteSingleFile()],
  define: {__FAIRWAY_BUILD__: JSON.stringify({commit, built: new Date().toISOString()})},
  build: {target: 'es2022', assetsInlineLimit: 10000000},
  server: {port: 5173},
});
