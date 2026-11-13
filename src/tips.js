// THE LOADING TIPS (the 1.0 polish, 27 October 2026; docs/UI_POLISH.md, P2).
//
// Shown one at a time on the start splash (index.html reads them from
// window.__FAIRWAY_SPLASH__, which vite.config.js writes from this list) and
// while a course grows (main.js `whileGenerating`). Every tip says something
// true of the game today: each was checked against the code when written, and
// `keys` names every key a tip mentions, so tests/tips.test.mjs fails the day
// one of those keys stops doing what keys.js says. A tip with no key is
// checked by the line beside it.
//
// Plain words: what to press and what happens, no selling (UI_POLISH.md, *How
// the game talks*).
export const TIPS = [
 {text: 'Q and E change club. Click the club box for the whole bag.', keys: ['Q', 'E']},
 {text: 'M opens the big map. Click anywhere on it to aim there.', keys: ['M']},
 {text: 'Esc pauses in every mode, the course studio too.', keys: ['Esc']},
 {text: 'V flies the camera anywhere over the course. V again brings it back to your ball.', keys: ['V']},
 {text: 'C shows the whole course from above. C again goes back to your ball.', keys: ['C']},
 {text: 'G looks at your aim point, then the green. Drag to turn round it.', keys: ['G']},
 {text: 'Tab shows every number of your last shot.', keys: ['Tab']},
 {text: 'T opens the tools: mulligan, replay, sim drop, shot views and your bag.', keys: ['T']},
 {text: 'H hides everything over the course. Esc brings it back.', keys: ['H', 'Esc']},
 {text: '? lists every key.', keys: ['?']},
 // hud-places.js: the map and the Tab numbers keep the place they are dragged to, per device.
 {text: 'Drag the small map or the shot numbers where you like them. They stay there.'},
 // weekly.js: the week's course from the date, DEFAULT_COURSE and the week's own length, the same on every copy.
 {text: 'The course of the week is the same course for everyone. A new one comes every Monday.'},
 // course-library.js exportCourse / importCourse; Saved courses has the import box.
 {text: 'A saved course can be sent as a short code. Paste a friend\'s code into Saved courses to play it.'},
 // ui-scale.js; Graphics, Text size, 75% to 200%.
 {text: 'Text size, in Graphics, makes everything on screen bigger or smaller.'},
];
