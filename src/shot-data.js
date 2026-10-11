// WHAT A SHOT IS WORTH SHOWING, IN ONE LIST.
//
// The five numbers the model actually runs on -- ball speed, launch angle,
// launch direction, spin and spin axis -- are validated hard in
// `parseLaunchMessage`, because a bad one means no shot. Everything else a
// launch monitor sends is extra: club speed, attack angle, path, face, the
// spin split, the device's own distances. None of it reaches the physics, all
// of it is worth looking at, and NOT ONE FIELD OF IT MAY EVER STOP A SHOT
// BEING PLAYED. That asymmetry is the whole design of this file.
//
// One registry, and everything derives from it: the grid in the course card,
// the checklist in the panel, the validation of a saved record, the tests. Add
// a field here and it appears in all four. Add it in two places and they drift.
import {MPH, YARD} from './physics.js';

const FOOT = 0.3048;

// null, not 0. A field the device did not send is BLANK in the grid. A zero is
// a reading -- "your club path was dead straight" -- and printing one for a
// number nobody measured is the kind of lie that gets acted on.
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const div = (a, b) => a != null && b != null && b !== 0 ? a / b : null;
const sub = (a, b) => a != null && b != null ? a - b : null;

// Sided readings print the side rather than a minus sign, because that is how
// they are spoken: "two right", not "minus two".
//
// THE SIDE GOES AFTER THE UNIT, and that is why these return a unit of their
// own instead of using the field's. Written the other way the degree sign ends
// up stranded past the side letter -- "1.1L °" -- and face impact came out as
// "2.1 heel mm", which is not a thing anybody says. A field's `get` may return
// either a string, which uses the unit declared beside it, or {value, unit} to
// replace the unit for this one reading.
const sided = (v, dp, unit, right = 'R', left = 'L') =>
 v == null ? null : {value: Math.abs(v).toFixed(dp), unit: `${unit}${unit ? ' ' : ''}${v >= 0 ? right : left}`};
const fixed = (v, dp) => v == null ? null : v.toFixed(dp);
const signed = (v, dp) => v == null ? null : (v > 0 ? '+' : '') + v.toFixed(dp);

// `get` is handed the whole record and returns the STRING to print, already in
// the unit named beside it. Formatting lives with the field because the unit,
// the precision and the sign convention are one decision, not three.
export const SHOT_FIELDS = [
 // --- The five. Always available: a keyboard shot has them too, because the
 // model needs them whether a monitor supplied them or the swing did.
 {id: 'ballSpeed', group: 'ball', label: 'Ball speed', unit: 'mph',
  get: r => fixed(div(num(r?.shot?.speed), MPH), 1)},
 {id: 'launch', group: 'ball', label: 'Launch angle', unit: '°',
  get: r => fixed(num(r?.shot?.vla), 1)},
 {id: 'direction', group: 'ball', label: 'Launch direction', unit: '°',
  get: r => sided(num(r?.shot?.hla), 1, '°')},
 {id: 'spin', group: 'ball', label: 'Spin', unit: 'rpm',
  get: r => fixed(num(r?.shot?.spin), 0)},
 {id: 'spinAxis', group: 'ball', label: 'Spin axis', unit: '°',
  get: r => sided(num(r?.shot?.spinAxis), 1, '°')},

 // --- The spin split. A monitor that sends back/side directly is believed; one
 // that sends total and axis has it resolved here rather than at the parser, so
 // the number shown is always the number the device meant.
 {id: 'backSpin', group: 'ball', label: 'Backspin', unit: 'rpm',
  get: r => {
   const b = num(r?.shot?.extra?.backSpin);
   if (b != null) return fixed(b, 0);
   const s = num(r?.shot?.spin), a = num(r?.shot?.spinAxis);
   return s == null || a == null ? null : fixed(s * Math.cos(a * Math.PI / 180), 0);
  }},
 {id: 'sideSpin', group: 'ball', label: 'Sidespin', unit: 'rpm',
  get: r => {
   const v = num(r?.shot?.extra?.sideSpin);
   if (v != null) return sided(v, 0, 'rpm');
   const s = num(r?.shot?.spin), a = num(r?.shot?.spinAxis);
   return s == null || a == null ? null : sided(s * Math.sin(a * Math.PI / 180), 0, 'rpm');
  }},

 // --- The club. Monitor only, and blank without one by design.
 {id: 'clubSpeed', group: 'club', label: 'Club speed', unit: 'mph',
  get: r => fixed(div(num(r?.shot?.extra?.clubSpeed), MPH), 1)},
 {id: 'smash', group: 'club', label: 'Smash factor', unit: '',
  get: r => fixed(div(num(r?.shot?.speed), num(r?.shot?.extra?.clubSpeed)), 2)},
 {id: 'attack', group: 'club', label: 'Attack angle', unit: '°',
  get: r => signed(num(r?.shot?.extra?.attack), 1)},
 {id: 'path', group: 'club', label: 'Club path', unit: '°',
  get: r => signed(num(r?.shot?.extra?.path), 1)},
 {id: 'faceToTarget', group: 'club', label: 'Face to target', unit: '°',
  get: r => signed(num(r?.shot?.extra?.faceToTarget), 1)},
 // Face to path is what actually curves the ball, and no monitor sends it --
 // every one of them sends the two angles it comes from. Derived here so it can
 // be read off the card instead of done in your head over the next shot.
 {id: 'faceToPath', group: 'club', label: 'Face to path', unit: '°',
  get: r => signed(sub(num(r?.shot?.extra?.faceToTarget), num(r?.shot?.extra?.path)), 1)},
 {id: 'loft', group: 'club', label: 'Dynamic loft', unit: '°',
  get: r => fixed(num(r?.shot?.extra?.loft), 1)},
 {id: 'lie', group: 'club', label: 'Lie angle', unit: '°',
  get: r => fixed(num(r?.shot?.extra?.lie), 1)},
 {id: 'closure', group: 'club', label: 'Closure rate', unit: '°/s',
  get: r => fixed(num(r?.shot?.extra?.closureRate), 1)},
 {id: 'impactH', group: 'club', label: 'Impact across', unit: 'mm',
  get: r => sided(num(r?.shot?.extra?.impactHorizontal), 1, 'mm', 'toe', 'heel')},
 {id: 'impactV', group: 'club', label: 'Impact height', unit: 'mm',
  get: r => sided(num(r?.shot?.extra?.impactVertical), 1, 'mm', 'high', 'low')},

 // --- What OUR model did with the shot. Not the device's opinion.
 {id: 'carry', group: 'flight', label: 'Carry', unit: 'yd',
  get: r => fixed(div(num(r?.result?.carry), YARD), 0)},
 {id: 'total', group: 'flight', label: 'Total', unit: 'yd',
  get: r => fixed(div(num(r?.result?.total), YARD), 0)},
 {id: 'apex', group: 'flight', label: 'Apex', unit: 'ft',
  get: r => fixed(div(num(r?.result?.apex), FOOT), 0)},
 {id: 'offline', group: 'flight', label: 'Offline', unit: 'yd',
  get: r => sided(div(offline(r), YARD), 1, 'yd')},
 // THE BALL'S TIME IN THE AIR, to its first touchdown. This read `time` until
 // 10 October 2026, which is when the ball STOPPED -- a drive that hangs 6.5 s
 // and rolls for four more showed 10.8. A record saved before `hang` existed
 // shows a dash rather than that number.
 {id: 'hang', group: 'flight', label: 'Hang time', unit: 's',
  get: r => fixed(num(r?.result?.hang), 1)},
 {id: 'descent', group: 'flight', label: 'Descent', unit: '°',
  get: r => fixed(num(r?.result?.descentAngle), 1)},
 {id: 'landing', group: 'flight', label: 'Landing speed', unit: 'mph',
  get: r => fixed(div(num(r?.result?.landingSpeed), MPH), 1)},

 // --- The device's OWN distances, where it sends them. Kept apart from ours
 // and labelled as the monitor's, because the two will not agree and a player
 // comparing them must be able to see which is which.
 {id: 'deviceCarry', group: 'device', label: 'Monitor carry', unit: 'yd',
  get: r => fixed(div(num(r?.shot?.extra?.deviceCarry), YARD), 1)},
 {id: 'deviceTotal', group: 'device', label: 'Monitor total', unit: 'yd',
  get: r => fixed(div(num(r?.shot?.extra?.deviceTotal), YARD), 1)},
];

// Sideways distance from the line the ball was aimed down, which is the only
// one of these that needs geometry rather than a lookup. Positive is right.
function offline(r) {
 const o = r?.shot?.origin, e = r?.result?.end, a = num(r?.aim ?? r?.shot?.aim);
 if (!o || !e || a == null) return null;
 const rad = a * Math.PI / 180;
 // The aim bearing points along (sin a, cos a). The golfer's right of it is
 // (-cos a, sin a): a hole's local +x is the player's LEFT (renderer.js).
 return (e.z - o.z) * Math.sin(rad) - (e.x - o.x) * Math.cos(rad);
}

export const FIELD_GROUPS = [
 {id: 'ball', label: 'The ball'},
 {id: 'club', label: 'The club'},
 {id: 'flight', label: 'The flight'},
 {id: 'device', label: 'From the monitor'},
];

const BY_ID = new Map(SHOT_FIELDS.map(f => [f.id, f]));
export const fieldById = id => BY_ID.get(id) ?? null;

// THE DEFAULT SET IS EVERY FIELD A KEYBOARD SHOT CAN FILL, AND NOTHING ELSE.
// Club speed, attack angle and the rest need a monitor sending ClubData, and a
// grid of eight em dashes is what a new player would otherwise open the game to.
// They are one tick away in the panel the moment a device is plugged in.
export const DEFAULT_FIELDS =
 ['ballSpeed', 'launch', 'direction', 'spin', 'spinAxis', 'carry', 'total', 'apex'];
// 0 IS "FIT TO WIDTH": as many tiles across as the shot panel has room for, so
// dragging its corner wider lays the same tiles out in fewer rows. It is the
// default since the numbers moved to their own panel along the bottom of the
// course (10 October 2026); a fixed count is still there for anyone who wants
// the grid to keep its shape whatever the panel's size.
export const DEFAULT_COLUMNS = 0;
export const COLUMN_CHOICES = [0, 2, 3, 4, 6, 8];
// More than this and the panel crowds the course on a laptop.
export const MAX_FIELDS = 12;

// v2 when the grid became the shot panel. A v1 record's FIELDS and their order
// are kept -- they are the player's choice -- but its column count is not: it
// was picked for a card down the side of the screen, and three across in a
// panel along the bottom is a tall narrow block over the course.
const KEY = 'fairway-shot-data-v2', OLD_KEY = 'fairway-shot-data-v1';

// Unknown ids are DROPPED rather than rejected, so retiring a field later
// leaves an old saved record still usable instead of resetting someone's whole
// layout. Duplicates are dropped for the same reason.
const clean = s => {
 const seen = new Set();
 const fields = (Array.isArray(s?.fields) ? s.fields : DEFAULT_FIELDS)
  .filter(id => BY_ID.has(id) && !seen.has(id) && seen.add(id))
  .slice(0, MAX_FIELDS);
 return {
  fields: fields.length ? fields : [...DEFAULT_FIELDS],
  columns: COLUMN_CHOICES.includes(s?.columns) ? s.columns : DEFAULT_COLUMNS,
 };
};

export function loadShotData() {
 try {
  const now = localStorage.getItem(KEY);
  if (now != null) return clean(JSON.parse(now));
  const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
  return clean(old ? {fields: old.fields, columns: DEFAULT_COLUMNS} : null);
 } catch {
  return clean(null);
 }
}

// Whether the player has ever saved a choice in Shot data. Launch-monitor mode
// shows its own grouped set -- ball, club, result -- until they have, because
// the default eight are what a keyboard shot can fill, not what a monitor does.
export function hasCustomShotData() {
 try { return localStorage.getItem(KEY) != null || localStorage.getItem(OLD_KEY) != null; } catch { return false; }
}

// A TILE DRAGGED ONTO ANOTHER takes that tile's place, and everything between
// shuffles along one -- the way a list reorders under a finger, rather than the
// two swapping, which moves a tile nobody touched. Unknown ids leave the list
// as it was, so a stale drag can never lose a field.
export function moveField(fields, id, onto) {
 const from = fields.indexOf(id), to = fields.indexOf(onto);
 if (from < 0 || to < 0 || from === to) return [...fields];
 const next = [...fields];
 next.splice(from, 1);
 next.splice(to, 0, id);
 return next;
}

// THE SHOT AS IT STANDS PART WAY THROUGH ITS FLIGHT, for the panel's live
// tiles. Everything the strike fixed -- the five, the club -- is the record's
// own. What the flight decides is read at time `t` off the flight itself:
//
//   carry  the ground covered so far while the ball is up, frozen at the first
//          touchdown, where it equals the model's carry exactly (physics.js
//          measures it at that instant, the same way)
//   total  the ground covered so far, all the way to rest
//   apex   the highest it has been so far
//   hang   the seconds it has been up, frozen at touchdown
//   offline where it is now, across the aim line
//
// Descent and landing speed exist only at touchdown, so before it they are
// blank -- a dash, not a guess. Past the last point the record is returned
// as it is: the finished numbers ARE the live ones by then.
//
// Counting up gives nothing away. The rule since 26 September was that carry
// and total never show while the ball flies, because the whole flight is
// simulated at the strike and printing its result spoils the shot. A number
// that climbs with the ball is a reading, not a prediction.
export function liveRecord(record, t) {
 const r = record?.result, pts = r?.points, o = record?.shot?.origin;
 if (!r || !o || !Array.isArray(pts) || pts.length < 2) return record;
 const last = pts[pts.length - 1];
 if (!(t < last.t)) return record;
 let i = 0;
 while (i < pts.length - 2 && pts[i + 1].t <= t) i++;
 const a = pts[i], b = pts[i + 1], f = Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1)));
 const p = {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f};
 const along = Math.hypot(p.x - o.x, p.z - o.z);
 // A putt, or anything else that never left the ground, has no hang: it is
 // "landed" from the start, its carry is the model's (zero) and only the
 // total counts.
 const up = r.hang > 0 && t < r.hang;
 let apex = 0;
 for (let k = 1; k <= i; k++) apex = Math.max(apex, pts[k].y - pts[0].y);
 apex = Math.min(r.apex ?? apex, Math.max(apex, p.y - pts[0].y));
 return {...record, live: true, result: {...r,
  carry: up ? along : r.carry,
  total: along,
  apex,
  hang: up ? t : r.hang,
  descentAngle: up ? null : r.descentAngle,
  landingSpeed: up ? null : r.landingSpeed,
  end: p,
 }};
}

export function saveShotData(prefs) {
 const next = clean(prefs);
 try {
  localStorage.setItem(KEY, JSON.stringify(next));
 } catch {}
 return next;
}

// One row per configured field: what to print, and what it is. A field with no
// reading returns a dash, never a zero, and never disappears -- a tile that
// comes and goes as the device warms up is worse than a blank one.
export function shotGrid(record, prefs) {
 const {fields, columns} = clean(prefs);
 return {
  columns,
  cells: fields.map(id => {
   const f = BY_ID.get(id);
   let got = null;
   // A field must not be able to break the card. They read from a saved record
   // that may predate the field, from a device's arbitrary JSON, and from a
   // result the flight may have ended early -- so every one is caught.
   try { got = record ? f.get(record) : null; } catch { got = null; }
   const value = got == null ? null : typeof got === 'object' ? got.value : got;
   const unit = got != null && typeof got === 'object' ? got.unit : f.unit;
   return {id, label: f.label, unit, value: value ?? '—', blank: value == null};
  }),
 };
}
