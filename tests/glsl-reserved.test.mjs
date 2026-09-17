import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// GLSL ES 3.0 keeps a list of words reserved for future use. Using one as a
// variable name is a hard compile error, and a fragment shader that fails to
// compile does not draw and does not obviously complain -- the scene simply
// renders as a flat wash of sky.
//
// This test exists because "float patch = ..." in the mist shader cost an
// evening:
//   ERROR: 0:196: 'patch' : Illegal use of reserved word
// three surfaced nothing usable. The error only appeared from
// gl.getShaderInfoLog() on the program that had failed to link.
const RESERVED = [
 'patch', 'sample', 'subroutine', 'common', 'partition', 'active', 'asm',
 'class', 'union', 'enum', 'typedef', 'template', 'this', 'resource', 'goto',
 'inline', 'noinline', 'public', 'static', 'extern', 'external', 'interface',
 'long', 'short', 'half', 'fixed', 'unsigned', 'superp', 'input', 'output',
 'filter', 'sizeof', 'cast', 'namespace', 'using',
];

const TYPES = 'float|int|uint|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|bvec2|bvec3|bvec4|uvec2|uvec3|uvec4|mat2|mat3|mat4';

// A GLSL type followed by the reserved word. That is the shape that actually
// breaks a shader, and it will not fire on "#include <common>" or on ordinary
// JavaScript that happens to use one of these as a name.
const declarationOf = word => new RegExp('\\b(?:' + TYPES + ')\\s+' + word + '\\b', 'g');

test('no GLSL reserved word is used as an identifier', () => {
 const dir = fileURLToPath(new URL('../src/', import.meta.url));
 const offences = [];
 for (const file of readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const source = readFileSync(join(dir, file), 'utf8');
  for (const word of RESERVED) {
   for (const hit of source.matchAll(declarationOf(word))) {
    const line = source.slice(0, hit.index).split('\n').length;
    offences.push(file + ':' + line + " declares '" + word + "' - reserved in GLSL ES 3.0");
   }
  }
 }
 assert.deepEqual(offences, [], 'reserved words used as identifiers:\n  ' + offences.join('\n  '));
});

test('the guard actually fires on the line that caused it', () => {
 // A green run only means something if the check can go red.
 assert.ok(declarationOf('patch').test('float patch=mistFbm(vMistWorld.xz);'),
  'the original offending declaration is detected');
 assert.ok(!declarationOf('common').test('#include <common>'),
  'an include is not a declaration');
 assert.ok(!declarationOf('sample').test('const sample = w => w.height(0,0);'),
  'plain JavaScript is not GLSL');
 assert.ok(declarationOf('sample').test('vec4 sample = texture2D(map, uv);'),
  'and a real GLSL declaration of another reserved word is caught too');
});
