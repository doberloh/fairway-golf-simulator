// FAIRWAY COURSE BUILDER, built the same single-file way as the game
// (docs/COURSE_BUILDER.md, *The program*). Its own config rather than a second
// entry point: vite-plugin-singlefile turns code splitting off, and rollup
// will not take two inputs without it (the contact sheet's reason too).
// Runs after the game's build, so it must not empty dist/.
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {GENERATOR_VERSION, SCHEMA_VERSION, BUILT_VERSION} from './src/settings-schema.js';

const commit = (() => { try { return execSync('git rev-parse --short HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim() || null; } catch { return null; } })();
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// The builder's own version line, like the game's (vite.config.js): which
// generator, schema and built-course reader it was made with.
const versions = {
 name: 'fairway-builder-versions',
 transformIndexHtml: () => [{tag: 'meta', attrs: {name: 'fairway-builder-versions', content: `generator=${GENERATOR_VERSION} schema=${SCHEMA_VERSION} built=${BUILT_VERSION}`}, injectTo: 'head-prepend'}],
};

export default defineConfig({
 plugins: [versions, viteSingleFile()],
 define: {__FAIRWAY_BUILD__: JSON.stringify({commit, built: new Date().toISOString(), version: pkg.version})},
 build: {target: 'es2022', assetsInlineLimit: 100000000, outDir: 'dist', emptyOutDir: false, rollupOptions: {input: 'builder.html'}},
});
