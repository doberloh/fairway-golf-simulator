// EVERY KEY A ROUND ANSWERS TO, IN ONE TABLE (UI/UX pass, 21 October 2026).
//
// The in-round list (?), Help's essentials page and the tool column's labels
// used to be written separately, and they drifted: the list said "Tab: this
// list" after Tab became the shot numbers, Help left out G, V, M, H and A, and
// the tool called C "CAMERA" while Help called it the overview. They are all
// drawn from here now, so a key changes in one place.
//
// Pure: no DOM. main.js draws the lists and the tools from these.

// `keys` as printed on the keycaps; `words` what it does, in the list's voice;
// `tool` the tool column entry it drives, if any.
export const ROUND_KEYS = [
 {keys: ['Space'], words: 'Swing: start, set the distance, strike'},
 {keys: ['S', 'W', 'X'], words: 'Curve, height, spin (Shift + X for less spin)'},
 {keys: ['Enter'], words: 'Skip the flight; the next hole once a hole is done'},
 {keys: ['←', '→'], words: 'Turn the aim'},
 {keys: ['↑', '↓'], words: 'Aim point further / shorter'},
 {keys: ['A'], words: 'Aim back to the start'},
 {keys: ['Q', 'E'], words: 'Club up / down (I and K too)'},
 {keys: ['C'], words: 'Overview of the whole course, and back', tool: 'cam'},
 {keys: ['G'], words: 'Views: the aim point, the green, then back (drag to turn, wheel to zoom)', tool: 'green'},
 {keys: ['V'], words: 'Free flight (W A S D to fly, R F up and down)', tool: 'fly'},
 {keys: ['M'], words: 'The big map'},
 {keys: ['Tab'], words: 'Every number of the last shot', tool: 'shots'},
 {keys: ['T'], words: 'Tools: mulligan, replay, sim drop, shot views, your bag', tool: 'tools'},
 {keys: ['H'], words: 'Hide everything over the course'},
 {keys: ['F11'], words: 'Full screen', tool: 'full'},
 {keys: ['?'], words: 'This list of keys'},
 {keys: ['Esc'], words: 'Cancel a swing, close what is in front, or pause'},
];

// The tool column, top to bottom: what each is called, its key, its icon id.
// Named after what they do (C is the overview, G steps through the views).
// `range` only on the driving range.
export const TOOLS = [
 {id: 'cam', label: 'OVERVIEW', key: 'C'},
 {id: 'fly', label: 'FLY', key: 'V'},
 {id: 'green', label: 'VIEWS', key: 'G'},
 {id: 'shots', label: 'NUMBERS', key: 'TAB'},
 {id: 'tools', label: 'TOOLS', key: 'T'},
 {id: 'range', label: 'RANGE', key: 'R', range: true},
 {id: 'full', label: 'FULL SCREEN', key: 'F11'},
 {id: 'menu', label: 'MENU', key: 'ESC'},
];
export const toolsFor = ({range = false} = {}) => TOOLS.filter(t => !t.range || range);

// The keys Help's essentials page lists: the round's own, in its words.
export const helpKeys = () => ROUND_KEYS.map(k => [k.keys.join(' '), k.words]);

// THE STRIP BESIDE THE SWING METER, so a first-timer can see how to swing.
// A launch monitor swings for you; a touch screen taps the bar; a putt has no
// shape. `[[key, words]]`, or a single line for touch.
export function swingStrip({monitor = false, touch = false, putting = false} = {}) {
 if (monitor) return [['←→', 'AIM'], ['?', 'KEYS']];
 if (touch) return [['TAP', 'THE BAR TO SWING']];
 return [['SPACE', 'SWING'], ['← →', 'AIM'], ['↑ ↓', putting ? 'LENGTH' : 'DISTANCE'], ['?', 'ALL KEYS']];
}

// The first-swing coach: shown once per device, on a golfer's first swing
// with the Swing Meter. Three taps, in the meter's own words.
export const COACH_STEPS = ['TAP to start the swing', 'TAP when the marker reaches the distance', 'TAP on the line to strike'];
