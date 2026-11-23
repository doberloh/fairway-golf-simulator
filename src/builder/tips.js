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
 'Edit in 3D editor': 'Open this generated course in the 3D editor to change it',
 'Generate course': 'Make a course from these settings and seed',
 // Door 2's plan.
 'Zoom in': 'Zoom in (or use the wheel)',
 'Zoom out': 'Zoom out (or use the wheel)',
 'Whole land': 'Fit the whole land in view',
 // Door 2's steps.
 '1 LIDAR': 'Step 1: find or load the LIDAR and box the course',
 '2 Land': 'Step 2: build the ground, canopy and trees',
 '3 Trace': 'Step 3: trace the course surfaces',
 '4 Holes': 'Step 4: place each hole\'s tees, aim points and green',
 '5 Name': 'Step 5: name, landscape and credits',
 '6 Review': 'Step 6: check the course and save it',
 'Build land': 'Build the ground, canopy and trees from the LIDAR inside the box',
 'Rebuild land': 'Build the land again from the LIDAR (clears the trace)',
 'Download photo': 'Download an aerial photo of this land from the chosen provider',
 'Open photo file': 'Open a photo from this computer (a GeoTIFF or a photo with a world file places itself)',
 'Use LIDAR colours': 'Show the LIDAR\'s own colour or brightness instead of a photo',
 'Reset photo position': 'Move the photo back to its original position',
 'Find place': 'Look the place up by name',
 'Put photo on top': 'Draw the photo over the LIDAR',
 'Put LIDAR on top': 'Draw the LIDAR over the photo',
 'Download OpenStreetMap': 'Download the course from OpenStreetMap (greens, fairways, bunkers, holes...)',
 'Open OpenStreetMap file': 'Open a saved Overpass answer (JSON)',
 'Align map to photo': 'Move OpenStreetMap\'s shapes onto the photo and add clear greens it is missing',
 'Align map to LIDAR': 'Move OpenStreetMap\'s shapes onto the LIDAR ground and add clear greens it is missing (recommended)',
 'Keep map as is': 'Use OpenStreetMap\'s outlines exactly as mapped',
 'Auto trace': 'Guess greens, tees, fairways, sand and water from the LIDAR and the photo',
 'Auto trace again': 'Auto trace again (replaces the current trace)',
 'Trace by hand': 'Start a blank trace and draw every surface yourself',
 'Next': 'Go to the next step',
 'Restore draft': 'Open the work kept in this browser from last time, at its step',
 'Delete draft': 'Delete the work kept in this browser from last time',
 'Add layer around': 'Lay the chosen layer in a band round the layer being painted (e.g. semi-rough round a fairway)',
 'Smooth all edges': 'Round every ragged edge of every layer',
 'Remove specks': 'Remove tiny patches and fill tiny holes on every layer',
 'Undo': 'Undo the last change (Ctrl+Z)',
 'Redo': 'Redo what Undo took back (Ctrl+Shift+Z or Ctrl+Y)',
 'Aim point': 'Click the plan to add a bend in this hole\'s line',
 'Green': 'Click the plan to place this hole\'s green',
 'Previous hole': 'Go to the previous hole',
 'Next hole': 'Go to the next hole',
 'Clear hole': 'Remove this hole\'s tees, aim points and green',
 'Remove last aim point': 'Remove this hole\'s last aim point',
 'Show': 'Go to this hole and show the problem',
 'Fix': 'Apply the suggested fix',
 'Open in 3D editor': 'Open the course in the 3D editor',
 // The editor.
 'View from above': 'Look straight down on the whole course',
 'View this hole': 'Frame the hole picked in the list',
 'Check course': 'Look for holes too short or long, tees off the ground, greens too steep, and more',
 'Play test round': 'A computer golfer plays every hole; its scores show holes that play badly',
 'Close': 'Close this course and go back to the builder\'s start (asks twice)',
 'Clear trees from tees and greens': 'Shrink every crown that reaches over a green or tee, and remove trees with no room; one Undo puts them back',
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
