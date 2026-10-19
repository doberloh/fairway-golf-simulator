// The capture tools' video writers (tools/capture/mux.mjs): the files they make
// must hold together -- every box and element's size adds up to the file, the
// frame tables name every frame, and the key frames are marked -- because a
// file that is off by a byte plays in one player and not another. The real
// check, that the recordings play, runs in a browser at the end of every clip
// (record.mjs checkVideos).
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeMp4, writeWebm} from '../tools/capture/mux.mjs';

const frames = n => Array.from({length: n}, (_, i) => ({data: Buffer.from(Array.from({length: 50 + i}, (_, j) => (i * 7 + j) & 255)), key: i % 30 === 0}));

function mp4Boxes(buf, start = 0, end = buf.length, depth = 0, out = []) {
  let p = start;
  while (p < end) {
    let size = buf.readUInt32BE(p); const type = buf.toString('latin1', p + 4, p + 8); let head = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(p + 8)); head = 16; }
    assert.ok(size >= head && p + size <= end, `${type} at ${p} runs past its parent`);
    out.push({type, at: p, size, depth});
    if (['moov', 'trak', 'mdia', 'minf', 'dinf', 'stbl'].includes(type)) mp4Boxes(buf, p + head, p + size, depth + 1, out);
    p += size;
  }
  assert.equal(p, end, 'boxes fill their parent exactly');
  return out;
}

test('an MP4 from the writer: its boxes fill the file, moov comes before the frames, and the tables name every frame', () => {
  const f = frames(95);
  const buf = writeMp4({width: 3840, height: 2160, fps: 60, avcC: Buffer.from([1, 100, 0, 52, 255, 225, 0, 0]), frames: f});
  const boxes = mp4Boxes(buf);
  assert.deepEqual(boxes.filter(b => b.depth === 0).map(b => b.type), ['ftyp', 'moov', 'mdat']);
  const at = t => boxes.find(b => b.type === t);
  const stsz = at('stsz'), n = buf.readUInt32BE(stsz.at + 16);
  assert.equal(n, 95);
  for (let i = 0; i < n; i++) assert.equal(buf.readUInt32BE(stsz.at + 20 + i * 4), f[i].data.length);
  const stss = at('stss');
  assert.equal(buf.readUInt32BE(stss.at + 12), 4, 'key frames at 1, 31, 61, 91');
  const stco = at('stco'), offset = buf.readUInt32BE(stco.at + 16), mdat = at('mdat');
  assert.equal(offset, mdat.at + 8, 'the chunk offset points at the first frame');
  assert.deepEqual(buf.subarray(offset, offset + f[0].data.length), f[0].data);
  const mvhd = at('mvhd');
  assert.equal(buf.readUInt32BE(mvhd.at + 20) / buf.readUInt32BE(mvhd.at + 24) > 0, true);
  assert.equal(buf.readUInt32BE(mvhd.at + 24), 95 * 1000, 'duration: 95 frames of 1000 ticks');
});

function ebmlSize(buf, p) {
  const first = buf[p]; let len = 1; while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  let v = first & (0xff >> len); for (let i = 1; i < len; i++) v = v * 256 + buf[p + i];
  return {len, v};
}

test('a WebM from the writer: header, then one Segment whose size is the rest of the file, with a cluster per key frame and cues for each', () => {
  const f = frames(95);
  const buf = writeWebm({width: 1920, height: 1080, fps: 60, frames: f});
  assert.deepEqual([...buf.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
  const h = ebmlSize(buf, 4), segAt = 4 + h.len + h.v;
  assert.deepEqual([...buf.subarray(segAt, segAt + 4)], [0x18, 0x53, 0x80, 0x67]);
  const s = ebmlSize(buf, segAt + 4);
  assert.equal(segAt + 4 + s.len + s.v, buf.length, 'the Segment runs exactly to the end of the file');
  const count = (id) => { let n = 0, i = 0; const b = Buffer.from(id); while ((i = buf.indexOf(b, i)) >= 0) { n++; i++; } return n; };
  assert.equal(count([0x1f, 0x43, 0xb6, 0x75]) >= 4, true, 'a cluster for each of the four key frames');
  assert.ok(buf.includes(Buffer.from('V_VP9')));
});

test('the writers refuse what would make a broken file', () => {
  assert.throws(() => writeMp4({width: 2, height: 2, fps: 60, avcC: Buffer.from([1]), frames: []}), /no frames/);
  assert.throws(() => writeMp4({width: 2, height: 2, fps: 60, frames: frames(2)}), /avcC/);
  assert.throws(() => writeWebm({width: 2, height: 2, fps: 60, frames: [{data: Buffer.from([1]), key: false}]}), /key frame/);
});
