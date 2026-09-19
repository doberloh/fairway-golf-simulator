// The asset contact sheet, built the same way the game is: one self-contained
// HTML file. It is a local tool -- `npm run assets` writes dist/assets.html and
// nothing here goes near the game bundle.
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
export default defineConfig({
 root: 'preview',
 plugins: [viteSingleFile()],
 build: {target: 'es2022', assetsInlineLimit: 100000000, outDir: '../dist', emptyOutDir: false,
  rollupOptions: {input: 'preview/assets.html'}},
});
