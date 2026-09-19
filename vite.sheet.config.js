// The contact sheet, built the same single-file way as everything else.
//
// Its own config rather than a second entry point: vite-plugin-singlefile
// turns code splitting off, and rollup will not take two inputs without it.
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
export default defineConfig({
 root: 'preview',
 plugins: [viteSingleFile()],
 build: {target: 'es2022', assetsInlineLimit: 100000000, outDir: '../dist', emptyOutDir: false,
  rollupOptions: {input: 'preview/sheet.html'}},
});
