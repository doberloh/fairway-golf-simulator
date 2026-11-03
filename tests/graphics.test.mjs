// A machine with no graphics card is known by its renderer's name
// (graphics.js isSoftwareRenderer; the US landscapes goal's profile).
import test from 'node:test';
import assert from 'node:assert/strict';

test('a software renderer is known by its name, and a real card is not', async () => {
 const {isSoftwareRenderer} = await import('../src/graphics.js');
 for (const n of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Mesa softpipe', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)'])
  assert.ok(isSoftwareRenderer(n), n);
 for (const n of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Apple M2', 'Mali-G78', '', undefined])
  assert.ok(!isSoftwareRenderer(n), String(n));
});
