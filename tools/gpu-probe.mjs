#!/usr/bin/env node
// Which GPU does a Playwright browser actually get?
//
// Asked before anything is measured, because headless Chromium falls back to a
// software rasteriser without saying so, and a frame time from SwiftShader
// answers a completely different question than one from the real card. Run this
// whenever the machine, the driver or the Playwright version changes.
import {chromium} from 'playwright';

const CONFIGS = [
 ['headless, default flags', {headless: true, args: []}],
 ['headless + gpu flags', {headless: true, args: [
   '--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist',
   '--enable-unsafe-webgpu', '--disable-gpu-vsync', '--disable-frame-rate-limit']}],
 ['headed, moved offscreen', {headless: false, args: [
   '--window-position=-3000,-3000', '--use-angle=default', '--ignore-gpu-blocklist',
   '--disable-gpu-vsync', '--disable-frame-rate-limit']}],
];

for (const [label, opts] of CONFIGS) {
 let browser;
 try {
  browser = await chromium.launch(opts);
  const page = await browser.newPage();
  const info = await page.evaluate(() => {
   const c = document.createElement('canvas');
   const gl = c.getContext('webgl2') || c.getContext('webgl');
   if (!gl) return {error: 'no webgl context at all'};
   const dbg = gl.getExtension('WEBGL_debug_renderer_info');
   return {
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    webgl2: !!c.getContext('webgl2'),
    timerQuery: !!(gl.getExtension('EXT_disjoint_timer_query_webgl2')
      || gl.getExtension('EXT_disjoint_timer_query')),
    maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
   };
  });
  const software = /swiftshader|llvmpipe|software|microsoft basic/i.test(info.renderer || '');
  console.log(`\n${label}`);
  console.log(`  renderer   ${info.renderer || info.error}`);
  console.log(`  vendor     ${info.vendor || '-'}`);
  console.log(`  webgl2     ${info.webgl2}   timer query ${info.timerQuery}   tex units ${info.maxTextureUnits}`);
  console.log(`  VERDICT    ${software ? 'SOFTWARE -- frame times mean nothing about real hardware' : 'real GPU'}`);
 } catch (e) {
  console.log(`\n${label}\n  FAILED ${e.message.split('\n')[0]}`);
 } finally {
  await browser?.close();
 }
}
