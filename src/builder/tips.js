// WHAT EACH BUTTON DOES, ON HOVER (the owner, 1 November 2026: "can we add on
// hover tooltips for buttons?"). The builder's element helper (builder.js
// `el`) gives every button a tooltip from here when it is made without one of
// its own: by its tool (`data-tool`) first, else by its label. A button whose
// words change with the state (Lock / Unlock) carries its own `title` where
// it is made. tests/builder-tips.test.mjs checks that every fixed label in the
// builder's source has one.

// Door 2's trace tools and the editor's, by `data-tool`.
export const TOOL_TIPS = {
 move: 'Drag the view; the wheel zooms',
 select: 'Click a shape to choose it: drag inside to move it, drag its anchors to turn it',
 brush: 'Paint the chosen layer by dragging (Brush size sets how wide)',
 erase: 'Take the chosen layer off by dragging; what lies under it shows',
 eraseAll: 'Take every layer off by dragging, down to rough',
 outline: 'Click round a shape corner by corner and fill it with the chosen layer (double-click or Enter closes)',
 smooth: 'Drag along a ragged edge to round it',
 creek: 'Click along a line to lay a creek; double-click or Enter ends it',
 bunker: 'Click to dig a bunker, as wide as the brush',
 tree: 'Click to stand one tree (not on mown ground, sand, water or a path)',
 treeBrush: 'Drag to scatter trees at random inside the brush, not in a line',
 sizeTree: 'Click a tree, then set its size under This tree',
 cover: 'Paint ground cover by dragging: rocks, bushes and the like, between the sizes set below',
 coverErase: 'Drag to take ground cover off',
 treeZone: 'Click round an area and fill it with trees at the density set below',
 treeErase: 'Drag to take trees off',
 home: 'Click to stand a house; it faces the nearest fairway, green or tee',
 homeZone: 'Click round a street or estate; houses line it 42 m apart',
 homeErase: 'Drag to take houses off',
 measure: 'Click two points: the yards, metres and rise or fall between them',
 shape: 'Drag a green, bunker, fairway, pond, tree or house to move it whole',
 turnShape: 'Press on a green, bunker, pond or house and drag round its middle to turn it',
 boundary: 'Click round the course corner by corner; outside it can then be filled with the landscape\'s wood',
};

// Every other button, by its label.
export const TIPS = {
 // The home screen and the top bar.
 'Back': 'Back to the builder\'s start (anything not saved is lost)',
 'Cancel': 'Stop this and keep what was there',
 'Take it over': 'Open this generated course in the editor to change anything',
 'Grow this course': 'Make a course from these settings and seed',
 // Door 2's plan.
 'Zoom in': 'Closer (or the wheel)',
 'Zoom out': 'Further (or the wheel)',
 'Whole land': 'Fit the whole land in view',
 // Door 2's steps.
 '1 LIDAR': 'Step 1: find, download or load the LIDAR, and box the property',
 '2 Land': 'Step 2: build the ground, the canopy and the trees',
 '3 Trace': 'Step 3: a picture, OpenStreetMap, and the surfaces traced',
 '4 Holes': 'Step 4: each hole\'s tees, aim points and green',
 '5 Name': 'Step 5: the course\'s name, landscape and credits',
 '6 Review': 'Step 6: the whole course painted as it will be built',
 'Next: build the land': 'Go on to step 2 once the property is boxed',
 'Next: trace the course': 'Go on to step 3 once the land is built',
 'Next: the holes': 'Go on to step 4 once the course is traced',
 'Next: the name': 'Go on to step 5 once every hole has a tee and a green',
 'Next: review the course': 'Go on to step 6: the course painted as it will be built',
 'Build the land': 'Make the ground, the canopy and the trees from every point inside the property',
 'Build it again': 'Make the land again from the LIDAR (the trace starts over)',
 'Fetch imagery for this land': 'Download the chosen provider\'s picture of this land, placed by itself',
 'A picture file': 'Bring a picture from this computer (a GeoTIFF or one with a world file places itself)',
 'The LIDAR\'s own': 'Use the survey\'s own colour or brightness as the picture',
 'Back to its position': 'Undo any dragging: the picture back where its position put it',
 'Find': 'Look the place up by name',
 'Picture on top': 'Draw the picture over the LIDAR',
 'LIDAR on top': 'Draw the LIDAR over the picture',
 'Fetch OpenStreetMap': 'Download the course as OpenStreetMap\'s mappers drew it (greens, fairways, bunkers, holes...)',
 'An OpenStreetMap file': 'Read an Overpass answer saved earlier (JSON)',
 'Refine with the picture': 'Line OpenStreetMap\'s shapes up with the picture and add clear greens it left out',
 'Refine with the LIDAR': 'Line OpenStreetMap\'s shapes up with the ground and add clear greens it left out (recommended with a survey)',
 'Keep it as drawn': 'Use OpenStreetMap\'s outlines exactly as mapped',
 'Auto trace': 'Find greens, tees, fairways, sand and water from the LIDAR (and the picture where it cannot tell)',
 'Auto trace again': 'Trace again from scratch (what is traced now is replaced)',
 'Manual trace': 'Start from a blank trace and draw every surface yourself',
 // The builder-ux goal (10 November 2026).
 'Draw it myself': 'Start from a blank trace and draw every surface yourself with the tools',
 'Next': 'Go on to the next step',
 'Bring it back': 'Open the work kept in this browser from last time, at the step it was on',
 'Discard': 'Throw away the work kept from last time',
 'Extrapolate': 'Lay the second layer in a band round the first (semi-rough round a fairway)',
 'Smooth all edges': 'Round every ragged edge of every layer',
 'Tidy specks': 'Take off tiny patches and fill tiny holes on every layer',
 'Undo': 'Take back the last change (Ctrl+Z)',
 'Redo': 'Put back what Undo took (Ctrl+Shift+Z or Ctrl+Y)',
 'Picture on/off': 'Show or hide the picture',
 'Trace on/off': 'Show or hide the traced surfaces',
 'Smooth / cell view': 'Show the trace as the course will draw it, or as its painted cells',
 'Draw the boundary': 'Click round the course corner by corner',
 'Draw it again': 'Click round the course again; the old line is replaced',
 'Back tee': 'Click the plan to place this hole\'s back tee',
 'Middle tee': 'Click the plan to place this hole\'s middle tee',
 'Front tee': 'Click the plan to place this hole\'s front tee',
 'Aim point': 'Click the plan to add a bend in this hole\'s line of play',
 'Green': 'Click the plan to place this hole\'s green (where the cup goes)',
 'Previous hole': 'Mark the hole before',
 'Next hole': 'Mark the hole after',
 'Clear this hole': 'Take off this hole\'s tees, aims and green',
 'Drop last aim': 'Take off this hole\'s last aim point',
 'Open in the editor': 'Open the course in the 3D editor, where it is saved as a playable file',
 // The editor.
 'From above': 'Look straight down on the whole course',
 'This hole': 'Frame the hole picked in the list',
 'Check the course': 'Look for holes too short or long, tees off the ground, greens too steep, and more',
 'Play a test round': 'A computer golfer plays every hole; its scores show where a hole plays badly',
 'Close': 'Close this course and go back to the builder\'s start (asks twice)',
 'Clear trees from tees and greens': 'Draw in every crown that reaches over a green or tee, and take out a tree with no room left; one Undo puts them back',
 'shown': 'Hide this layer from view (the course keeps it)',
 'hidden': 'Show this layer again',
};

// The tooltip for a button made with these attributes and words, or null.
export function tipFor(attrs, kids) {
 const tool = attrs?.['data-tool'];
 if (tool) { const k = String(tool).split(':')[0]; if (TOOL_TIPS[tool] ?? TOOL_TIPS[k]) return TOOL_TIPS[tool] ?? TOOL_TIPS[k]; }
 const words = kids.flat().filter(c => c != null && c !== false);
 return words.length === 1 && typeof words[0] === 'string' ? TIPS[words[0]] ?? null : null;
}
