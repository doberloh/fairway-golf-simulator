// VIDEO FILES FROM ENCODED FRAMES, with no encoder or muxer installed.
//
// The capture browser encodes frames itself (WebCodecs: H.264, VP9, AV1 in
// software, checked 18 October 2026 at 3840x2160, 60 fps), but hands back bare
// encoded frames, not a file. These two writers wrap them:
//
//   writeMp4  H.264 in an MP4, moov first ("fast start"): the masters. Every
//             editor opens it (Resolve, Premiere, Final Cut, a phone).
//   writeWebm VP9 (or AV1) in a WebM with cues: the website's clips, which
//             browsers play and loop.
//
// Both take {width, height, fps, frames: [{data: Buffer, key: boolean}]} with
// frames in order at a constant rate; writeMp4 also needs `avcC`, the decoder
// configuration WebCodecs gives with the first frame (`description`, when the
// encoder is configured with avc: {format: 'avc'}). Pure: no browser, no files
// -- each returns a Buffer. tests/capture-mux.test.mjs reads them back.

// ------------------------------------------------------------------ MP4
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff); return b; };
const u8 = n => Buffer.from([n & 0xff]);
const box = (type, ...parts) => { const body = Buffer.concat(parts.flat()); return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]); };
const full = (type, version, flags, ...parts) => box(type, u8(version), Buffer.from([(flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts);
const zeros = n => Buffer.alloc(n);
const MATRIX = Buffer.concat([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]);

export function writeMp4({width, height, fps, avcC, frames}) {
  if (!frames?.length) throw Error('writeMp4: no frames');
  if (!avcC?.length) throw Error('writeMp4: no avcC (configure the encoder with avc: {format: "avc"})');
  if (!frames[0].key) throw Error('writeMp4: the first frame must be a key frame');
  const timescale = Math.round(fps * 1000), delta = 1000, duration = frames.length * delta;
  const sizes = frames.map(f => f.data.length), dataBytes = sizes.reduce((a, b) => a + b, 0);
  const big = dataBytes + 16 > 0xffffffff - 1e6;
  const moov = offset => {
    const stsd = full('stsd', 0, 0, u32(1), box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height),
      u32(0x00480000), u32(0x00480000), u32(0), u16(1), (() => { const n = Buffer.alloc(32); const name = Buffer.from('Fairway capture'); n[0] = name.length; name.copy(n, 1); return n; })(),
      u16(0x18), u16(0xffff), box('avcC', Buffer.from(avcC))));
    const stts = full('stts', 0, 0, u32(1), u32(frames.length), u32(delta));
    const keys = frames.map((f, i) => f.key ? i + 1 : 0).filter(Boolean);
    const stss = full('stss', 0, 0, u32(keys.length), ...keys.map(u32));
    const stsz = full('stsz', 0, 0, u32(0), u32(frames.length), ...sizes.map(u32));
    const stsc = full('stsc', 0, 0, u32(1), u32(1), u32(frames.length), u32(1));
    const stco = big ? full('co64', 0, 0, u32(1), u32(Math.floor(offset / 2 ** 32)), u32(offset % 2 ** 32)) : full('stco', 0, 0, u32(1), u32(offset));
    const stbl = box('stbl', stsd, stts, stss, stsz, stsc, stco);
    const minf = box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
    const mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0)),
      full('hdlr', 0, 0, u32(0), Buffer.from('vide'), zeros(12), Buffer.from('VideoHandler\0')), minf);
    const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(duration), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width * 65536), u32(height * 65536));
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(2));
    return box('moov', mvhd, box('trak', tkhd, mdia));
  };
  const ftyp = box('ftyp', Buffer.from('isom'), u32(512), Buffer.from('isomiso2avc1mp41'));
  const mdatHead = big ? Buffer.concat([u32(1), Buffer.from('mdat'), u32(Math.floor((dataBytes + 16) / 2 ** 32)), u32((dataBytes + 16) % 2 ** 32)]) : Buffer.concat([u32(dataBytes + 8), Buffer.from('mdat')]);
  // moov's size does not depend on the offset it carries, so measure it once.
  const offset = ftyp.length + moov(0).length + mdatHead.length;
  return Buffer.concat([ftyp, moov(offset), mdatHead, ...frames.map(f => f.data)]);
}

// ------------------------------------------------------------------ WebM
// EBML: an element is its ID bytes, its size as a variable-length integer,
// then its data.
const vint = n => {
  for (let len = 1; len <= 8; len++) if (n < 2 ** (7 * len) - 1) {
    const b = Buffer.alloc(len); let v = n;
    for (let i = len - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); }
    b[0] |= 1 << (8 - len); return b;
  }
  throw Error('vint too large');
};
const el = (id, ...data) => { const body = Buffer.concat(data.flat()); return Buffer.concat([Buffer.from(id), vint(body.length), body]); };
const uint = n => { if (n === 0) return Buffer.from([0]); const out = []; let v = n; while (v > 0) { out.unshift(v % 256); v = Math.floor(v / 256); } return Buffer.from(out); };
const float64 = n => { const b = Buffer.alloc(8); b.writeDoubleBE(n); return b; };
const ID = {EBML: [0x1a, 0x45, 0xdf, 0xa3], EBMLVersion: [0x42, 0x86], EBMLReadVersion: [0x42, 0xf7], EBMLMaxIDLength: [0x42, 0xf2], EBMLMaxSizeLength: [0x42, 0xf3],
  DocType: [0x42, 0x82], DocTypeVersion: [0x42, 0x87], DocTypeReadVersion: [0x42, 0x85], Segment: [0x18, 0x53, 0x80, 0x67], SeekHead: [0x11, 0x4d, 0x9b, 0x74],
  Seek: [0x4d, 0xbb], SeekID: [0x53, 0xab], SeekPosition: [0x53, 0xac], Info: [0x15, 0x49, 0xa9, 0x66], TimecodeScale: [0x2a, 0xd7, 0xb1], Duration: [0x44, 0x89],
  MuxingApp: [0x4d, 0x80], WritingApp: [0x57, 0x41], Tracks: [0x16, 0x54, 0xae, 0x6b], TrackEntry: [0xae], TrackNumber: [0xd7], TrackUID: [0x73, 0xc5],
  TrackType: [0x83], FlagLacing: [0x9c], CodecID: [0x86], DefaultDuration: [0x23, 0xe3, 0x83], Video: [0xe0], PixelWidth: [0xb0], PixelHeight: [0xba],
  Cluster: [0x1f, 0x43, 0xb6, 0x75], Timecode: [0xe7], SimpleBlock: [0xa3], Cues: [0x1c, 0x53, 0xbb, 0x6b], CuePoint: [0xbb], CueTime: [0xb3],
  CueTrackPositions: [0xb7], CueTrack: [0xf7], CueClusterPosition: [0xf1]};

export function writeWebm({width, height, fps, frames, codec = 'V_VP9'}) {
  if (!frames?.length) throw Error('writeWebm: no frames');
  if (!frames[0].key) throw Error('writeWebm: the first frame must be a key frame');
  const frameMs = 1000 / fps;
  const header = el(ID.EBML, el(ID.EBMLVersion, uint(1)), el(ID.EBMLReadVersion, uint(1)), el(ID.EBMLMaxIDLength, uint(4)), el(ID.EBMLMaxSizeLength, uint(8)),
    el(ID.DocType, Buffer.from('webm')), el(ID.DocTypeVersion, uint(4)), el(ID.DocTypeReadVersion, uint(2)));
  const info = el(ID.Info, el(ID.TimecodeScale, uint(1e6)), el(ID.Duration, float64(frames.length * frameMs)),
    el(ID.MuxingApp, Buffer.from('Fairway capture')), el(ID.WritingApp, Buffer.from('Fairway capture')));
  const tracks = el(ID.Tracks, el(ID.TrackEntry, el(ID.TrackNumber, uint(1)), el(ID.TrackUID, uint(1)), el(ID.TrackType, uint(1)), el(ID.FlagLacing, uint(0)),
    el(ID.CodecID, Buffer.from(codec)), el(ID.DefaultDuration, uint(Math.round(1e9 / fps))), el(ID.Video, el(ID.PixelWidth, uint(width)), el(ID.PixelHeight, uint(height)))));
  // A cluster per key frame (the encoder is asked for one every two seconds),
  // each frame a SimpleBlock timed against its cluster's start.
  const clusters = []; let cur = null;
  frames.forEach((f, i) => {
    const t = Math.round(i * frameMs);
    if (f.key || !cur || t - cur.t > 30000) { cur = {t, blocks: []}; clusters.push(cur); }
    const rel = Buffer.alloc(2); rel.writeInt16BE(t - cur.t);
    cur.blocks.push(el(ID.SimpleBlock, Buffer.from([0x81]), rel, Buffer.from([f.key ? 0x80 : 0]), f.data));
  });
  const clusterEls = clusters.map(c => el(ID.Cluster, el(ID.Timecode, uint(c.t)), ...c.blocks));
  // Positions are counted from the start of the Segment's data. The SeekHead
  // is written with fixed-width positions so its size is known in advance.
  const pos8 = n => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
  const seekHead = (pInfo, pTracks, pCues) => el(ID.SeekHead,
    el(ID.Seek, el(ID.SeekID, Buffer.from(ID.Info)), el(ID.SeekPosition, pos8(pInfo))),
    el(ID.Seek, el(ID.SeekID, Buffer.from(ID.Tracks)), el(ID.SeekPosition, pos8(pTracks))),
    el(ID.Seek, el(ID.SeekID, Buffer.from(ID.Cues)), el(ID.SeekPosition, pos8(pCues))));
  const sh = seekHead(0, 0, 0).length, pInfo = sh, pTracks = pInfo + info.length;
  let p = pTracks + tracks.length; const clusterPos = clusterEls.map(c => { const at = p; p += c.length; return at; });
  const pCues = p;
  const cues = el(ID.Cues, ...clusters.map((c, i) => el(ID.CuePoint, el(ID.CueTime, uint(c.t)), el(ID.CueTrackPositions, el(ID.CueTrack, uint(1)), el(ID.CueClusterPosition, uint(clusterPos[i]))))));
  const body = Buffer.concat([seekHead(pInfo, pTracks, pCues), info, tracks, ...clusterEls, cues]);
  return Buffer.concat([header, Buffer.from(ID.Segment), vint(body.length), body]);
}
