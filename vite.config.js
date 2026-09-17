import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({plugins:[viteSingleFile()],build:{target:'es2022',assetsInlineLimit:10000000},server:{port:5173}});
