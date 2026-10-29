# The 1.0 interface polish

The last goal before 1.0 (branch `ui-polish-1-0`, from 27 October 2026): every
screen polished at every screen size, the bugs found and fixed at their
cause, a shorter way into every mode, the course studio's settings condensed,
animation where it helps, real pictures of each landscape instead of the tiny
turning models, a picture for every saved course, plain words. The owner's
brief is local (`docs/reports/ui-polish-goal.md`); this is the record: the
checklist every change names, the rounds, the decisions and the rejected
alternatives.

**Rules of this goal** (AGENTS.md, *The 1.0 interface polish*): interface
only -- physics, scoring, formats, challenges and generation unchanged, the
fingerprint silent; **no performance cost on any tier** (the owner: "There
should be no performance hits for these changes allowed"), each change that
could move a frame measured against main's build; old saves, course codes
and friend's challenges still open; **a bug is confirmed on today's build
before anything is changed for it** (the owner, setting the goal).

## The checklist

From the research (RESEARCH.md, *Game interface practice, for the 1.0
polish*). Every change below names the line it serves; a change that serves
none is not made.

**Readable**
- R1. Text a player must read is at least the kit's floor as drawn: 13 px at
  1080p and below on a desk screen, scaled up with the screen above it; 11 px
  on a phone (ui-layout.js `TYPE.label`, `PHONE.smallestLabel`).
- R2. Text against what it sits on: 4.5:1, or 3:1 for large text (24 px, or
  18.7 px bold) and for a control that is switched off.
- R3. Nothing cut off, nothing on top of something else, nothing off the
  screen without a way to scroll to it.
- R4. Sentences in sentence case; one- and two-word labels may stay capitals
  (the Console Arcade look).

**Where am I**
- W1. One look for chosen, one for the cursor (*One look for chosen, one for
  the cursor*, below): yellow means chosen, white means where the keys are.
  Never two of the same in one list; never two cursors.
- W2. The cursor follows the keys, and a screen opens with it on the thing
  most likely to be pressed.
- W3. Back is one press (Esc, B, the Back button) and always in the same
  place; every screen has a way to the main menu.
- W4. The current step and what comes next are always shown.

**Getting there**
- G1. The fewest presses from the main menu to the first shot, counted per
  mode (*The way into every mode*); a step that asks nothing the player must
  answer is skipped or passed with a default.
- G2. One press to play again with the last setup.
- G3. Options that belong together are together; rarely changed ones folded
  away, never removed.

**Touch, keys and pads**
- T1. On a touch screen every control pressed in play is at least 44 px on
  its short side; nothing under 24 px.
- T2. Every screen works with the keyboard alone and a controller alone; a
  list wraps, a grid does not.
- T3. Pieces the player moves (the map, the Tab shot numbers) stay movable
  and stay on screen.

**Motion**
- M1. 100-300 ms, eased out coming in and in going out; a press or a cursor
  move about 120 ms, a screen or window about 200-260 ms.
- M2. Transform and opacity only; nothing during a swing or a flight; no
  cost on any tier.
- M3. Nothing waits for an animation; one interrupted ends in the right
  state.
- M4. Reduced motion (the system's setting) turns movement into a fade or
  nothing.

**Words**
- P1. Plain words that say what a thing does; no slogans, no hype, no
  needless "your"; the house style below.
- P2. Every tip and hint true of the game today.

## The audit tool

`tools/ui-audit.mjs` (rules in `tools/ui-audit-rules.mjs`, tested in
`tests/ui-audit-rules.test.mjs`) opens a capture build, walks every screen --
the main menu, every step of Play for every game type, Challenges, the
range's setup, the studio's setup, Saved courses, My profile's tabs, the
three settings screens, the launch monitor, Help, and in a round the round
screen with one and four golfers, the pause list, the scorecard, the big
map and a shot -- at sixteen sizes (phones both ways, tablets both ways,
laptops, 1080p, 1440p, 4K, ultrawide, and the Text size at its ends), and
reads from the page what it drew. Rules (the checklist line each serves):
overlap, clipped, offscreen (R3); off-centre (R3); two-highlights,
two-chosen, highlight-not-focus (W1, W2); small-target, tiny-target (T1);
contrast (R2); small-text (R1). What text sits on is read from the picture
itself, since the panels are leaning layers, gradients and glass over the
course. Findings explained in `tools/ui-audit-known.json` are listed apart.

**Faster, and unable to stall** (28 October 2026, during the square boxes).
A full run was about 50 minutes: sixteen sizes one after another, a fixed
pause before every picture, then pictures looked at one by one. Now four sizes
run side by side in one browser (`--jobs`, default 4); a pause ends once the
screen's animations have finished (fixed pauses are kept where the game is
building something no animation shows: a round starting, the studio growing,
the big map, a shot landing); and each screen has a contact sheet with every
size side by side (`sheets/<screen>.png`). Measured on the same build and the
same four sizes: the old tool 840 s, the new 276 s; every picture and finding
on the menus and sheets the same, the only differences in rounds -- the
flag's label and the turn banner over the moving course, which change with
the moment of the picture under either tool (all explained, none open). The
sixteen sizes: about 14 minutes. `--quick` (phone both ways, an upright
tablet, 1080p, 4K) is for a round of fixes; sixteen for the last.

The same day it hung for two and a half hours: the studio's save step leaves
the page holding its Save box, which marks the page stale so the next screen
starts fresh -- but a round screen ignored the mark and asked that page to
start a round, which waited for an answer to the box. A round now honours the
mark, and every screen has three minutes (`SCREEN_MS`) before it is written
down as `walk-failed` and its size goes on from a fresh page.

**Text past a box that scrolls is not cut off** (fixed in the audit, 28
October 2026). On a phone, Play's lower cards sit under the sheet's foot
until the player scrolls down to them; the audit measured them against the
sheet itself (which hides its overflow) and called every word on them
clipped -- most of its phone findings. It now notes the ways a scrolling box
between the text and its clip scrolls, and counts only the others.

**How it found the double yellow boxes.** Its *play-keys* screen opens Play
and presses Right then Down. On main's build (0.9.5) two cards in the game
list are outlined in the same yellow: the chosen card and the card the keys
are on. The cause is one rule, `#drawer .sx-card:is(.on,:focus-visible)::after`,
which gives the chosen state and the cursor the same ring.

## Rounds

(Each round: what was wrong, what changed, the pictures' folder under
`bench/shots/ui-audit/` or `bench/shots/ui-polish/`.)

**The rounds, item by item** (the goal asked five each; counted from the
sections below, not claimed). The sweeps after them -- the final audit, the
third look, and the five square-box rounds -- walked every screen at sixteen
sizes, these included.

| Item | Rounds written up | Where |
| --- | --- | --- |
| The way into every mode | 2 of its own (Tee off on every step; Play again), then every audit sweep | *The way into every mode* |
| The course studio | 1 of its own (five menus), then the tablet stack in square round 3 | *The course studio's settings*, *Square boxes* |
| Animation | 5 | *Animation* |
| The save-picture step | 1 of its own (box takes the arrows), then square rounds 1, 4 and 5 | *A picture for every saved course*, *Animation*, *Square boxes* |
| Square boxes (the owner's) | 5 | *Square boxes* |

### Before (main, 0.9.5)

The audit on main's build (`bench/shots/ui-audit/before/`) is the list every
later round is judged against; its numbers are under *The audit, before and
after* below once it has run at every size.

### The first changes (27 October 2026)

- **The double yellow boxes (W1).** Confirmed on main before any change: the
  audit's *play-keys* screen at 1280 x 720 showed Saved course and Friend
  challenge both ringed in yellow (`bench/shots/ui-audit/probe/1280x720/play-keys.png`).
  Cause: one rule for the chosen card and the cursor. Fixed at the cause, for
  every screen at once: a new colour, `--cursor` (white), for every
  `:focus-visible` rule that drew in the hot colour (38 rules in six
  stylesheets), the Play cards and the locker's tiles drawn by hand with both
  looks together. **Rejected:** making the arrows choose as they move (radio
  buttons do), which removes the second ring on the cards but not the
  chosen card beside a focused Next button -- still two yellow boxes; and
  dimming the chosen look instead, which would have changed what the owner
  approved for the locker and the cards. The locker already used white for
  the cursor (round 14), so white was the house look for it already.
- **Where the keys start (W2).** Every sheet opened with the focus on its
  close button in the far top corner (seen in the audit's pictures: BACK
  outlined in the old orange focus colour on the studio's setup). Now the
  open step's chosen card, else its first button or drop-down.
- **"MAKE IT YOURS" (P1, W4).** The eyebrow over every sheet's title was the
  same slogan on every sheet; it now says where the sheet was opened from.
  Play's title "Your next round" is now *Play*, the button pressed.
- **The launch monitor list (the owner's item 10).** Out of the game; one line
  points to the download's README.md, which lists them now (PLAYING.md too).
- **The loading tips (P2).** The five on the splash were each checked against
  the code: all true (Q/E and the club box opening the bag, M's map aiming
  where clicked, Esc pausing in every mode and the studio, V toggling free
  flight back, the week's course from the date). Reworded plainer, nine
  added (C, G, Tab, T, H, ?, moving the map and numbers, course codes, Text
  size), each checked the same way and recorded beside it in `src/tips.js`;
  a test holds every key they name to keys.js. They show while a course
  grows too, the longest wait after the start.

## The course studio's settings

The studio had **eight menus for 47 settings** (Course 3, Landscape 3,
Routing 5, Fairways & greens 11, Bunkers 3, Water 12, Trees & scenery 7,
Weather 2), and opened on Course -- holes, seed, length -- although its own
line says "choose the landscape you want, then grow it". Bunker shape sat
under Fairways & greens while the other three bunker settings had a menu of
their own.

**Round 1 (built; seen in the audit's pictures at sixteen sizes, not played
by hand).** Five menus: **Course** (the
landscape as pictures first, then holes, length, seed, and wind in a box of
its own), **Land & routing** (landform, elevation, blind tees, footprint,
spacing, doglegs), **Fairways, greens & bunkers** (all fourteen), **Water**,
**Trees & scenery**. Only the schema's `category` fields and the panel's
order changed: no setting was renamed, removed or re-ranged, so the saved
settings' shape is the same (no `SCHEMA_VERSION` bump) and the fingerprint is
silent. A first course now needs only the first menu. **Rejected:** a
separate "Basics" menu above the eight (more menus, not fewer), and folding
Water into Land & routing (twelve settings in five groups would make one
menu of twenty).

## Landscape pictures

The tiny turning 3D models on every course card (round 14) are replaced by
real pictures of each landscape, one after another (`src/picture-loop.js`,
`src/landscape-shots.js`), taken by `tools/capture/biome-shots.mjs`. The model
code is gone (`course-model.js`, `model-framing.js`, `model-cards.js` and its
test), which also stops the menu drawing those models on the game's renderer.
Built and wired; the pictures themselves are taken and picked in rounds
below.

## A picture for every saved course

Saving in the studio takes a picture in the save box itself
(main.js `showSavePicture`): the view on screen is taken at once, so a
one-press save still keeps one; From above, The first tee and a short hole
(course-file.js `pictureViews`) move the camera and take theirs; This view
takes the one on screen again; Frame it yourself steps the box aside for the
player to fly, Enter takes it and the box returns. The picture is 640 x 360
WebP, about 25-40 KB (PLACED), kept in IndexedDB beside the library
(`course-pictures.js`; its own localStorage entry where IndexedDB is missing,
past a million characters the course is kept without it), and leads the
course's card everywhere. **Sharing:** the course code is unchanged; Saved
courses' new **Save as file** writes `<name>.fairway` (course-file.js: the
course, its versions and its picture as JSON), opened by Import courses from
a file or dropped on the screen. **Rejected:** the picture in the course code
(tens of thousands of characters to paste), and the picture in the course
library's localStorage entry (two hundred pictures would take most of the
page's 5 MB from the saves and profiles).

## How the game talks (the house style)

The owner: "ensure that the UI doesnt read like an AI wrote it. Use plain
language. try to minimize 'make it yours', 'your course, your way' type
language." The rules the words pass works to, for whoever writes the next
label:

- **Say what it does, in the words a golfer uses.** *Save as file*, not
  *Export*; *Tee off*, not *Begin*; *Growing the landscape…*, not *Crafting
  your world*.
- **No slogans, no selling.** The game does not describe itself: no *make it
  yours*, *your way*, *unleash*, *immersive*, *journey*, *ready to…?*. A
  heading names a thing (*Play*, *Saved courses*), it does not cheer.
- **"Your" only where it tells the player whose.** *Your bag*, *your ball*,
  *your best run* say whose; *your landscape* while it grows, *your library*,
  *your shelf* say nothing (the first round removed them).
- **Short.** A button is one to three words; a line under it is one plain
  clause. A note is one sentence where one will do.
- **Sentence case for sentences; capitals only for one- or two-word labels**
  (the Console Arcade look), never for a line someone must read (R4).
- **No exclamation marks**, except a shout the game makes on the course
  (*In the hole!*, *Overswing!*).
- **Numbers as golfers say them**: *250 yd*, *E*, *+2*, *4 mph*.
- **Every tip and hint true today** (P2): a tip names its keys in
  `src/tips.js`, and tests/tips.test.mjs holds them to keys.js.

**The words, round 1 (27 October 2026).** *MAKE IT YOURS* over every sheet
became where the sheet was opened from; *Your next round* became *Play*;
*Growing your landscape* / *Rebuilding your course* / *Building your course*
/ *Shaping your landscape* lost their *your*; *Saved "X" to your library*
became *Saved "X"*; the save box's *Keep it in your course library* became
*Keep it in Saved courses*; Play's *YOUR SHELF* tag became *SAVED*, *N OF
YOURS* became *N SAVED*, *SHAPE YOUR OWN, THEN PLAY IT* became *BUILD ONE, THEN
PLAY IT*; the launch monitor screen's *Bring real ball data into your browser
with an Open Connect v1 compatible connector* became *Play with a launch
monitor, through any Open Connect v1 connector*. Searched for and found
nothing to change: exclamation marks (two game shouts kept), hype words
(*awesome*, *epic*, *ultimate*, *let's*, *get ready*). Left, because they
say whose: *your bag*, *your ball*, *your best*, *Your golfer*, *your name*.

## Bugs, each confirmed before it was changed

Each line: what it looked like, how it was confirmed on today's build, the
cause, the fix. (Reported bugs that no longer show are written down as gone,
not fixed.)

- **Two yellow boxes** -- see *The first changes* (W1).
- **Sheets opened with the keys on the close button** -- see *The first
  changes* (W2).
- **Text on the dark end of a highlighted box was weak** (TODO since phase
  1). Confirmed by computing every palette: onHot on a2 2.28:1 (Giant
  Redwood) to 5.47:1 (Links), under 4.5 on eight of ten. Cause: the
  gradient's dark end was a2, a deep colour, with dark text on it. Fixed in
  the palette, once for every screen: the gradient ends on `--a2-text`
  (ui-palette.js `textEnd`), the deepest mix of a1 toward a2 that keeps
  4.5:1 (Giant Redwood's end goes from #9f1239 to #d84e5d; Links, Desert and
  Island keep a2); a contrast rule holds every palette to it (R2).
- **A full store said nothing** (TODO). Confirmed in the code: `save()`
  swallowed the error, so Continue quietly stopped following the round.
  Now it says so once, until a save works again (P1).
- **A saved round deleted on one click, a saved course on two** (TODO, "pick
  one"). Confirmed in the code. Both ask twice now.

## The way into every mode

Counted by `tools/ui-flows.mjs` at 1280 x 720: from the main menu to a
swing ready (or the studio flying), with a mouse (one per press) and with the
keyboard or a controller (the fewest arrows by the game's own focus rule,
plus Enter, actually pressed). "Arrived" means the menu gone, no sheet open,
nothing growing, and a swing ready -- the first version counted a swing ready
behind the menu (its backdrop is a real hole) and passed paths that never
left it.

| Mode | main (0.9.5) mouse | keys | round 1 | round 3 | round 4-5 (now) |
| --- | --- | --- | --- | --- | --- |
| Course of the week | 3 | 6 | 2 / 5 | 2 / 5 | 2 / 5; by Enter on its card **3** keys |
| Endless | 4 | 9 | 3 / 6 | 3 / 6 | 3 / **4** |
| Saved course | 5 | 17 | 4 / 11 | 4 / 9 | 4 / **6** |
| Surprise me | 4 | 10 | 3 / 7 | 3 / 7 | 3 / **5** |
| New course in studio | 2 | 7 | 2 / 8 | 2 / 8 | 2 / 8 (R grows from anywhere) |
| Studio, on a chosen landscape | 4 | 19 | -- | -- | 3 / **9** |
| Driving range | 3 | **stuck** | 3 / 11 | 2 / 6 | 2 / 6 |
| A challenge | 3 | 7 | -- | 2 / 7 | 2 / 7; by Enter on its card **4** keys |
| Play again (last setup) | -- | -- | -- | 1 / 2 | 1 / 2 |

(mouse / keys.) **Round 4: chosen by the keys, the keys go to start** (main.js
`KEY_CHOICES`): after the last choice a screen asks -- a game that needs
nothing more, a saved course, a landscape, a format, a challenge -- is made
with Enter or a pad's A, the keys land on the start button. Only for a choice
the keys made (a click with no pointer, `detail` 0): a mouse is not moved.
Its first version jumped after Saved course and Friend challenge too, which
still ask for the course or the code: the saved course went from 9 keys to
13, so those two were left out (6). **Round 5:** the counter's paths only
used arrows; a keyboard player presses Enter on the card the keys start on,
which since round 4 lands them on start -- counted as its own path.

Round 2 added Play again; round 3 put the start button on every step of
Challenges and the range (a challenge's rules are fixed and who plays is set
already; the range opens on its last setup). The saved course by keys fell
from 11 to 9 when sheets stopped opening scrolled to their chosen card.

**Round 1: Tee off on every step of Play** (`finishAlways`): the later steps
are defaults (who plays, the format, the rules), so a player happy with them
starts from the first step. One press less for every Play mode by mouse,
three to six by keys. **The studio by keys is one press worse** (7 to 8):
its sheet now opens on the chosen landscape (W2) rather than the corner, and
Grow is further from there; R grows from anywhere on that sheet (its key is
shown on the button), which the counter does not use.

**A bug the counter found: the range could not be finished by keys.** On
main, the arrows moved the focus onto the range's Slope drop-down and could
not move it off: the 1.0 drop-down hides its native select (tabindex -1,
aria-hidden) behind its own button, but the menus' arrows (main.js
`moveFocus`) still listed every select, landed on the hidden one, and from
there the select kept the arrows -- quietly changing its value. Fixed at the
cause: the arrows skip anything taken out of the keys' way (tabindex -1,
aria-hidden), so they land on the drop-down's own button, where Enter opens
the list. And a plain select on a menu row (a seat's Plays with) now answers
as a console's option row does: left and right step its value, up and down
move on (XAG 112: focus can always leave by the input it came with).

**Round 2: Play again** (`src/last-play.js`, tested): the last setup started
from Play -- the course of the week, an endless run, a saved course or a
surprise nine, with the same golfers and format -- is a row under Play on the
main menu, its line saying what it will start (G2). One press. A friend's
challenge is not offered (one card, played once), nor a saved course since
deleted.

## Type on small desk screens

The before audit's biggest finding: **small text, 1,662 distinct** -- and
almost all of it at 1280 x 720, 1366 x 768 and 1024 x 768 (about 1,500 per
size) against about 120 at 1080p and above. Cause: the menus' sheets are
drawn at the round screen's compact scale (`--sheet-z`, round-hud.js
`COMPACT`, 0.7 -- the owner's call of 17 October 2026, "everything 40-50%
smaller", made for the round screen so the course gets the room back). On a
1080p screen that is 1.05 and the sheets' 13-14 px labels read 14-15 px; at
1280 x 720 it is 0.7 and they read 9-10 px, under both the Xbox guideline's
floor and the kit's own label size (13).

**Round 1: a floor for the sheets on a desk screen** (round-hud.js
`sheetScale`, `SHEET_FLOOR` 0.8, PLACED): a sheet is never drawn below 0.8
on a screen 1024 wide or more, so at 1280 x 720 a 14 px label reads 11.2 px
instead of 9.8. The round screen keeps COMPACT (the owner's call stands where
it was made), and phones keep their own scale. **Rejected:** the sheets at
1.0 there (their round-9 sizes laid out for a larger canvas would not fit
720 px tall), and raising every small font size in the stylesheets one by
one (dozens of hand-placed boxes sized for their text). What the floor costs
in fit is the audit's next run at 1024 x 768, 1280 x 720 and 1366 x 768.

## Readable and reachable: contrast and touch, round 1

**Text over the course** (R2). The Swing Meter's words and numbers (CARRY,
yards, SWING / SPACE, the tick distances, the club line) and the off-screen
pin's label sit on the course itself with a soft shadow: the audit read them
at 1.3-2.6:1 on bright autumn ground. They take one dark outline now
(`--outline`, round-hud.css: three tight shadows), the Xbox guideline's
remedy for text that must read on any ground; the audit counts an outlined
text as readable. **Rejected:** a panel behind the meter's text -- the owner
asked for nothing above the meter (round 14).

**Dim labels on the sheets** (R2). Written for the old light panels or
dimmed with opacity, they read 3.3-4.4:1: the scorecard's putts row, an
achievement's XP line, the studio's hole table header, the tabs' counts, the
foot's keys, the tabs not chosen. They take the palette's soft colour or full
ink, which the palette test holds at 4.5:1.

**Touch targets on a phone** (T1). The close button (27 px tall as drawn),
the steps (27), Back and Next (33), the pickers' arrows (21 x 27), the tee
choices (24), the drop-downs (31) and the tabs (30): 44 px as drawn now on
any phone, written against the phone sheets' zoom (`30.8px / --sheet-z`).
The info (i) keeps its 17 px circle and takes a 44 px invisible ring for the
finger (explained in the audit's known list, which measures the circle).

## Landscape pictures, rounds 1-2 (27 October 2026)

**Round 1.** Ten candidate views per landscape taken at Ultra, 3840 x 2160
(`biome-shots.mjs take --label r1`, about ten minutes a landscape), judged
on a contact sheet each. Kept: the afternoon from above, behind the first
green, a hole from the side or from high, an approach -- views that show the
landscape and still read when cropped to a wide card. Rejected everywhere:
the tee at eye height (a tree or long grass fills the front), the green close
to (a flat colour on a card), golden hour at a tee (too dark); golden hour
from above kept only where it is clear (Desert, Autumn -- elsewhere a brown
haze). **Round 2, Giant Redwood:** its views from 30-55 m stood inside the
crowns (the trees are over 100 m tall); three low views under the canopy
were added and two kept, the giant trunks being what that landscape is.
**Encoded:** 45 pictures, four or five per landscape, 960 wide WebP at 0.7,
1,709 KB -- about 2.2 MB of the page (budget 3 MB); the page is 13.8 MB
(11.4 on main). Every card that stands for all landscapes now starts on a
different one (its own key).

## Phones, round 1 (27 October 2026)

Found by the audit's runs on the branch at 390 x 844 and 844 x 390:

- **The studio wore the old interface on a phone** (a rounded glass panel,
  the old top bar, "Fly around with W A S D") and its 1.0 slab sat off the
  bottom: the 1.0 studio was written for screens 561 wide and up. A phone
  version of the same pieces (round-phone.css): the slab top left, the bar's
  four buttons as 44 px slanted rows two by two, no keyboard keys, the map
  top right. The bar sits outside #app, so its rules are a screen-size query.
- **Back went off a 390 px phone's left edge** once the start button showed
  on every step: on an upright phone the start button takes its own row.
  Not on a sideways phone, where two rows took a quarter of the height.
- **The sheet's title floated over the page scrolling under it**: a dark
  band behind the header on phones, as the foot has; and the header keeps
  the content's 22 px margin (it sat 2 px from the edges, on main too).
- **A sheet opened scrolled down** to its chosen card (this goal's start
  focus): it focuses without scrolling now, as *A different sheet opens at
  its top* (audit 6) requires.
- **The save box ran off both edges of a phone**: the boxes' width limit was
  worked out against the sheets' scale but drawn at that over 0.7. And in a
  box as tall as the save (its picture), the rows' shared lean carried the
  last ones off the left edge: on an upright phone the rows stand straight.
- **"NEXT THE WEE"**: beside the start button Next says NEXT alone.

**Studio round 2.** The Course menu's note was about yardage and sat over the
landscapes; the length's own help says it (and now that each golfer picks a
tee), so the note went. The landscape's label, "Surroundings", is
"Landscape" (a label, not the settings' shape: no schema bump).

**Studio round 3: More settings** (G3). In each menu the settings that shape
a course's detail rather than its character fold under a **More settings**
heading, one press away: hole spacing, the doglegs' turn and turning point,
blind tees, false fronts, raised and sunken greens, the pin of the day, the
greenside bunkers' gap, the depth of ponds and lakes, the rivers' and creeks'
shape, the fairway features and trees by the greens (PLACED; main.js
`STUDIO_MORE`). A group folds whole, by its first member. The arrows and
Enter now reach a fold's heading (`summary`), which they skipped.
**Rejected:** a Basic / Advanced switch for the whole studio (a second mode to
learn, and the owner's settings are all one screen).

**Type, round 2: a floor for every screen** (round-hud.js `SHEET_FLOORS`,
PLACED from the audit's runs). The full audit after round 1 showed the 0.8
floor left most labels at 11 px on a 1280 x 720 laptop, and that phones (10
px) and an upright tablet (7 px at 768 x 1024!) had the same problem. The
floors now: **0.93 from 1200 wide** (a 14 px label reads 13; 1280 x 720 and
1366 x 768 fit it), **0.8 from 1024** (a sideways tablet: at 0.93 the
profile's stats, Help's keys and the studio's fields ran out of their boxes),
**0.7 from 700** (an upright tablet), **0.55 below** (a phone, whose sheets
are drawn at that over 0.7: 0.79, so a 14 px label reads 11, the kit's phone
floor). On the screens tried, small text fell from 2,913 to 771 findings at
the desk sizes and from 3,796 to 1,505 on phones and the tablet. What it
broke, fixed in the same round: Back went off a 360 px phone on Challenges'
last step (the start button now always has a row of its own on an upright
phone, and wraps), and the audit had taken a wide table's sideways scroller
for the only way to reach what lay below the screen (it now asks for a
scroller that goes the right way).

## Animation

What moves (src/ui-motion.css, all inside `prefers-reduced-motion:
no-preference`): a sheet fades in (180 ms) and its page rises 10 px (220
ms, replayed when a step changes); a box over the screen settles in from 98%
(200 ms); the main menu's cursor slid its tile 6 px (120 ms; removed with the
slant, 28 October 2026 -- the tile now lights in place); a press
gives 3% (40 ms in, 120 ms back). Nothing on the way out; nothing on the
round screen. Checked by `tools/ui-motion-check.mjs` and
`tools/ui-motion-frames.mjs`.

- **Round 1** (the checker's first run, 12 of 15). The sheet's fade never
  ran: the 1.0 sheets set `animation:none` on the open sheet with a stronger
  selector (it replaced the old sliding drawer). The menu cursor's slide
  jumped: the press rule, stronger by its `#drawer`, replaced the tile's
  transition with its own. And an older transition showed up: the round
  screen blurring under an open sheet (`filter`, 180 ms) -- not this goal's,
  not motion (a blur, nothing moves), but not on the compositor either;
  left, and written down here.
- **Round 2.** The fade at the open-sheet rule's own strength; the tile's
  transition names both the slide and the press. 15 of 15.
- **Round 3.** The same at 390 x 844 and 3840 x 2160; the box over the screen
  seen settling (200 ms) and ending whole; a resize in the middle of a sheet
  arriving ends whole. 22 of 22.
- **Round 4.** Frame by frame, each animation stopped at 0, 45, 90, 135, 180
  and 220 ms (`ui-motion-frames.mjs`, contact sheet
  `bench/shots/ui-motion/r4/_frames.jpg`): the sheet fades in over the menu
  with its page rising, no piece arriving out of step, no flicker; the box
  arrives without a jump; the cursor's slide is small and even.
- **Round 5** -- the cost. Every animation runs only while a sheet or box
  arrives or a tile is pressed (a quarter of a second at most), on opacity and
  transforms alone, so the compositor draws it and no layout or paint runs;
  the menus they sit on measure no slower than main (below, *What it costs*).

**The studio from the main menu, round 4** is the way in's round 4 (above):
choosing a landscape by keys puts them on Grow this landscape -- from the
main menu to a course growing on a chosen landscape went from 19 keys on
main to 9 (and 4 clicks to 3). **Round 5** is the floor on the sheets'
type (*Type on small desk screens*), which the studio's setup carries most
of: its labels read 13 px on a laptop now.

**Inside the studio.** Round 1: Save course takes a picture (*A picture for
every saved course*). Round 2: the phone studio in the 1.0 look (*Phones,
round 1*). Round 3: More settings, which the studio's own Settings opens too
(the same sheet). Round 4: the save box fits a phone, its rows straight.
**Round 5: a box over the screen takes the arrows and a d-pad** (main.js
`focusScope`): the save, leave, version and welcome boxes were outside the
arrows' reach, so a controller could not move between the save box's picture
views or reach Save (XAG 112: focus can always move with the input in hand).

## What it costs

The goal allows no cost: no tier, menu, studio, round or start-up slower than
main. Every figure here is `tools/frame-ab.mjs` on this machine's card, main's
build (`bench/ab/main-plain`) and the branch's measured alternately, each in a
fresh browser, at 1600 x 900 at twice the pixels; the saved runs are
`bench/ab/polish-*.json` (local).

**Three figures, and why the third was added.** *CPU* is the game's own frame
callback; *GPU* is the graphics work timed inside it; the frame waits on the
larger. Both miss what the interface itself costs -- styles, layout,
painting, timers -- and they missed the old turning models too, which main
drew from a timer, outside the frame callback. So the tool now also reports
**page ms**: the browser's whole main-thread time per frame
(`Performance.getMetrics`, `TaskDuration`), which counts all of it.

**The menus are noisy, and the noise is not the code.** The main menu's
backdrop is a random hole at a random hour, so two builds first measured
different scenes (the first round, r1: Ultra's menu 5.98 against 1.71 ms --
meaningless); a seeded `Math.random` in the tool fixed that from r2 on. The
backdrop's camera still circles, so a sheet opened a moment later sees a
different part of the course: the Saved courses spot drew 4-6% more triangles
in one build on High and Medium, and its graphics time followed the
triangles, not the build. And the game's frame callback on the menus is
bimodal in BOTH builds, 1.1-4.8 ms run to run on Ultra with identical code
(the main menu itself, where the branch changed nothing that runs). A
two-run median lands on either mode; four to six runs settle it.

**The menus, by the whole page** (four rounds; six for High's studio and
Low's main menu):

| Tier | Spot | main page ms | branch page ms | Frame (larger of CPU and GPU) |
| --- | --- | --- | --- | --- |
| Low | Main menu | 0.79 | 0.78 | equal (0.51) |
| Low | Play, first step | 2.71 | 1.03 (-62%) | equal (0.8 against 0.7) |
| Low | Saved courses | 1.09 | 0.81 (-26%) | equal |
| Low | Studio setup | 1.61 | 0.84 (-48%) | equal |
| High | Main menu | 2.63 / 2.64 | 2.65 / 2.65 | equal (2.57) |
| High | Play, first step | 7.34 | 2.16 (-71%) | 2.49 against 2.54 (+2%) |
| High | Saved courses | 3.33 | 2.58 (-23%) | follows the triangles (+4.8% of them) |
| High | Studio setup | 3.03 | 2.03 (-33%) | 2.50 against 2.54 (+1%) |
| Ultra | Main menu | 4.28 | 3.88 (-9%) | equal within 2% |
| Ultra | Play, first step | 9.95 | 3.70 (-63%) | 3.46 against 3.38 (-2%) |
| Ultra | Saved courses | 4.98 | 4.32 (-13%) | 4.70 against 3.37 (-28%) |
| Ultra | Studio setup | 6.90 | 3.69 (-47%) | 3.43 against 3.31 (-3%) |

The turning models were the menus' real cost: Play's first step spent 7-10
ms of main thread a frame on them, and the pictures that replace them spend
under 1. The branch's frame callback reads 0.2 ms higher on the menus with
pictures (High's studio 1.0 against 1.2 in six runs of six; Play on Ultra
1.3 against 1.6) while the whole page is a third to two-thirds lower; the
graphics time on Play and the studio on High reads 1-2% higher with the same
draws and triangles. Both were chased: pictures held still against fading
(`bench/ab/still-pics`, High studio: page 2.27 still against 2.02 fading),
pictures without the fade against none (Ultra Play: frame callback 1.4
against 1.7, graphics 3.23 against 3.31), and none against all (Ultra
studio: 3.26 against 3.23). None of them moves the frame; what is left is the
compositor drawing a few pictures beside a 3D scene, which the graphics
timer partly sees and main's own models -- drawn from a timer -- never
showed in it at all. Low's main menu read +9% in a four-round run (0.72 against 0.79) and equal
in six (0.79 against 0.78): the main menu is where the branch changed
nothing that runs, and its page time split by kind (styles 0.017 ms a frame
in both, layout none, script 0.65-0.77 in both) shows no part apart.
**Judged: not slower.** The frame on every menu is the
graphics card's, equal within 2% or lower, and the whole page is lower.

**The final build, measured again** (after the final audit's changes, which
draw the main menu a little larger and give touch controls more room; r7,
four rounds, by the whole page): Low -- main menu 0.78 against 0.82 in four
rounds and **0.76 against 0.75 in six** (equal), Play's first step 2.84
against 1.08 (-62%), Saved courses 1.08 against 0.78 (-27%), the studio 1.33
against 0.84 (-37%), every frame the graphics card's within 3%; Ultra -- main
menu 4.07 against 3.69 (-10%), Play 10.69 against 3.68 (-66%), Saved courses
4.88 against 4.42 (-10%), the studio 6.63 against 3.79 (-43%); frame, mean of
spots, -9%.

**The square boxes, measured** (28 October 2026, four rounds, by the whole
page; `polish-square-low` / `-ultra`): Low -- every menu's frame equal (the
graphics time 0.49-0.50 against 0.50-0.52 ms, under the 0.7 ms the frame
callback takes), the page lower everywhere: Play's first step 2.77 against
1.00 (-64%), Saved courses -25%, the studio -51%, the main menu equal.
Ultra -- frame, mean of spots, -9.5%; its slowest frames (p95) 14.6 against
8.2 ms (-44%). The frame callback's two modes showed again in both builds
(main's Saved courses 4.8 then 1.8, the branch's studio 3.0 then 1.7);
start-up to the main menu split the same way, the branch's four runs 12.8,
13.0, 14.7 and 14.9 s against main's 13.1-13.2 -- styles alone changed, and
no start-up work. **Judged: not slower.**

**The pictures' schedule was changed by the measurements.** At first every
card changed at once, every 6.6 s: the studio's ten landscapes decoded and
faded ten pictures in one moment, and the studio read slower than main on
Ultra's processor in three runs of four. Now one card changes at a time, the
next on screen in turn, at least 3 s apart (`TICK_MIN_MS`; at 1.6 s apart
Play's first step still showed processor spikes), and each picture is its
own layer while it fades (`will-change:opacity`). The swapped-slot run (the
branch measured first, to rule out the order) read the studio 1.30 / 3.25
against main's 1.30 / 3.24 -- equal.

**The tiers, menus and round together** (r2, seeded, two rounds; mean of the
spots' frames): Low -7.7%, Medium +0.9%, High -1.6%; Ultra by four rounds
-10.4% (r2b) and -9.5% (r3). Medium's +0.9% is its Saved courses spot, the
triangles above.

**The round** (four rounds, by the whole page): Medium -- behind the ball on
the 1st 2.90 against 2.61 ms (-10%), on the 5th 1.31 against 1.13 (-14%),
the 1st tee's camera 1.92 against 1.74 (-10%); frame -6.3%. Low -- 3.04 against 2.76 (-9%), 1.38 against 1.27 (-7%), 1.91
against 1.79 (-6%); frame -5.6%. The round's
interface changed only in outlines, the cursor's colour and the touch rings,
so the round being lower is the models' code gone (it built and kept course
models while the menu was up).

**The wait at start** (start to the main menu, medians): Medium 16.61 s main
against 16.37 s, Low 16.67 against 16.40; Low, High and Ultra in r2 within half a second either way
(17.60/16.69, 17.47/17.25, 13.28/12.93), one slower run in either build
setting each spread. The tips the splash shows are in the page already; the
pictures are inlined WebP, about 2.2 MB of the page (DISTRIBUTION_REVIEW).

## Smoke: every journey (28 October 2026)

All 38 journeys of `tools/smoke.mjs` pass on this branch's build, with the
graphics card (logs `bench/shots/smoke-polish-r1.log` and `-r1b.log`,
local). The first run stopped at *bridge-bundle*: the build had been made
with a bare `vite build`, which does not bundle the launch monitor bridge
(`npm run build` does), and the runner THREW where the bridge would not
start, so the ten journeys after it never ran. Not the game: with the bridge
built, those ten passed. The runner now fails that one journey with what to
do (`npm run build`) and goes on (checked: the bridge file moved away,
*bridge-bundle* failed and *weekly* after it passed). No journey needed
changing for the polish: they find buttons by the names a player sees, and
the polish kept every name they press.

## The pieces a player moves (T3, 28 October 2026)

`tools/ui-movable-check.mjs` plays into a round at six sizes (1920 x 1080,
1280 x 720, 4K, a sideways tablet, a phone both ways) and drags the map by
its title bar and the shot numbers (Tab) by a tile. **All pass, on this
branch and on main alike:** each follows the pointer, stops inside the
playing area when dragged far past its edge, stays inside when the window
shrinks by 15%, and goes back on a double click. On a phone the map keeps its
own place (PLAYING.md: "a phone keep[s] their own places") and a drag leaves
it there; phones show no tiles (their shot panel is under the wind). The
first run's three failures were the check, not the game: it took the tiles
by the middle of their box -- at 4K the gap between two rows, where the
course takes the press -- and expected a phone's map to move. Nothing the
polish changed touches the drag (main.js `dragPiece`, `drawHudPlaces`); the
CSS it changed on the round screen (outlines, the cursor's colour) moves
nothing.

## The final audit (28 October 2026)

Every screen at all sixteen sizes (`--out final`, 51 minutes): 3,305
distinct findings, against main's run of the same tool. Each kind was split
into what main already had and what is new (the same element and rule), and
each new one looked at in its picture before anything changed.

**Fixed, each confirmed first:**
- **The studio's save box on a sideways phone** (new with the picture step):
  its name and Save ran under the screen's foot, out of reach. A box over the
  screen now scrolls when it is taller than the screen, from its top (auto
  margins, so a box that fits stays centred), and on a short screen the
  picture sits beside its view buttons. The first-visit welcome box, which
  ran past the foot the same way, scrolls too.
- **The main menu on a tablet**: drawn at the round screen's compact scale,
  its tiles were 22 px tall and their words about 8 px at 1024 x 768
  (main alike). It is never below the sheets' floor now (main.js
  `--menu-z`: the round's scale raised to the floor): 31 px tiles, no small
  text left on it. **First tried: the sheets' own scale** -- but that
  multiplies by the Text size, and at 150% on 1080p the week's card lay over
  the tiles; the round's scale, which the Text size barely moves, raised to
  the floor, does not -- once the floor is divided by #app's own Text size
  zoom (`--ui-zoom`): the last full audit found the menu at 200% on 1440p
  drawn twice main's size, its golfer card over the tiles. Re-audited at all
  sixteen sizes after: no finding on the main menu.
- **An upright tablet's sheets** (768 x 1024): drawn at 0.7, every label read
  under 10 px -- 1,278 small-text findings. A floor of 0.8 for a screen 700
  wide and 900 tall brings it to 328. **0.93 was tried first** and brought it
  to 61, but Play's start button went off the screen and the studio's menus
  ran into each other: rejected. At 0.8 My profile's scoring tiles ran
  their words out of their boxes; they now take as many to a row as are 9 em
  wide (four on a desk screen, as before).
- **Seven sheet texts small at every size**: the studio's hole table header,
  its group labels (Wind), its course shapes and Course length, My profile's
  locked looks and small units -- 9-11 px even at 1080p. 14 px now; the
  1080p small-text findings went from 50 to 4.
- **Touch sizes**: on any touch screen the sheets' steppers, sliders and tips
  switch take 30.8 px as drawn (they were 14-25 on a tablet); in a round on a
  phone the Tools window's buttons, the drop bar, the settings tabs, a
  window's Close and Explain and the keys along the foot take 44 px (they were
  27-37). Controls under 24 px outside the round went from 294 to 36 (the
  rest are check boxes and sliders inside a label that takes the press); in
  the round on a phone, under-44 controls from 194 to 54.
- **The studio's chosen menu half off a sideways phone**: its tabs scroll
  sideways and the chosen one was not brought into view (Trees & scenery,
  its count invisible at 1:1). A chosen tab in a row wider than the screen is
  scrolled into it now (main.js, the settings tabs' `show`).

- **Second pass (`--out final2`, after the fixes above: 142 distinct left,
  each looked at).** Endless's last landscape (Any) ran under the foot's
  keys on a sideways tablet: the sheet does not scroll there (its content box
  grows and the sheet clips it -- a spacer under the last row was tried and
  did nothing, so it was taken out); the landscapes go three to a row at 200 px
  now, and their column scrolls in its own room as Play's cards do -- at
  1366 x 768 three to a row still reached the foot. The studio's group labels (Ponds,
  Lakes, Rivers, Houses, 3.2-3.9:1) take the palette's soft colour. On any
  touch screen the round's and the studio's tool columns, the drop's fields,
  the big map's Done and the pause list's clock take 30.8 px (18-22 on a
  tablet). **Tried and taken back:** the map's three reading switches at 30.8
  px pushed the map's elevation line out of its box (fixed after: *Third
  look*, below).

**The audit itself, fixed twice more:** text past a box that scrolls that
way is reached, not cut off; and a box that scrolls but lies wholly off the
screen (Help's topic page on a sideways phone) does not hide the sheet
scrolling round it -- Help's whole page was reported off the screen.

**Explained, not changed** (`tools/ui-audit-known.json`, each with its
reason): the round screen's small type (the owner's compact scale, 17
October); the sheets' remaining small text at their floors, with the higher
floor that was measured and rejected; the Text size at its smallest; the flag
label, which is anchored in the world and passes under windows; pieces under
a window, the big map or the blurred pause screen, which cover them by
design; a check box or slider taken by the label round it; the round's
figures over the course, which carry an outline the sampled colour does not
see.

**Third look: the ones first explained as "open", fixed at the cause** (the
goal asks every bug fixed, not listed; each found with its excuse taken out
of the explained list, so the audit reported it raw):
- **Place ball read white on yellow, 1.8:1** (main alike): the bar's rule for
  every button (`:is(#dropBar,#pickBar)>button`, white) out-ranked the main
  choice's own rule (the palette's dark words); found by asking the browser
  which rules matched. The main choice's rule goes through the bar's id now.
- **The drop bar's lines and the Tools headings, 2.3-3.5:1 on a phone**: their
  colours were set inside the wide-screen block, so a phone fell back to the
  old light panels' dark green and faint grey. Set on every screen now.
- **Near misses on the highlight gradient** (a key cap, a tab's count,
  4.2-4.5:1): the gradient's dark end aimed at exactly 4.5, and by a box's
  slanted edge its fill blends with the dark panel, so the words' ground is
  darker than the end colour. The end aims at 6:1 now (ui-palette.js
  `TEXT_END_MIN`, tested on every landscape); key caps on main buttons sit
  on a light plate.
- **The chosen landscape's name, teal on dark teal, 4.0:1**: yellow now --
  chosen is yellow (W1).
- **A tee letter, 4.3:1 with full ink**: its see-through backing let a bright
  card picture show through on a phone; a dark backing now. The hole table's
  yards, the (i) and My profile's small counts take full ink.
- **Words over pictures and the course** (the ↓ on the cards, the week's
  captions, the main menu's links, a setting's value over its slider's fill):
  the round's dark outline (`--outline`). The audit counted text as outlined
  only if EVERY shadow was tight, so a soft glow beside the outline undid it;
  its own comment says two or more tight shadows, which it counts now.
- **The map's reading switches, 15 px on a touch tablet**: 25 px both ways
  (24 drew 23.9); the map's picture row gives up the height, nothing is cut.
  **The big map's Done** took no touch size: the open map's own rule reset it,
  out-ranking the touch rule; the touch rule ranks above it now.
- **The audit, once more:** words half under a sheet's fixed foot were read
  against the foot's buttons (Add player at 1.65:1, a picker's value at 2.3);
  it now checks the words at their top, middle and foot for something on top
  of them. The chosen card's caption under the foot's dark band on a sideways
  phone is explained (the band is drawn, not an element the audit can see).
  And words scrolled out of the box that clips or scrolls them (Endless's
  last landscape below its column's edge) are not judged for contrast: they
  are not drawn there. The chosen tab's count keeps a light halo round its
  dark figures (3.97:1 at the smallest Text size, by the fill's slanted end).

**Where the audit ends** (`--out final`, every screen at sixteen sizes, then
the main menu again after its last fix): **no finding left unexplained.**
Every entry in `tools/ui-audit-known.json` is a reason to keep, with what was
looked at; none is a fix left for later.

## A controller alone (T2, 28 October 2026)

`tools/ui-pad-check.mjs` stands a pretend standard pad in
`navigator.getGamepads` (a browser test cannot plug one in) and presses its
buttons a frame at a time, at six sizes (1080p, 1280 x 720, 4K, a sideways
tablet, a phone both ways): the d-pad moves the main menu down and back up, A
opens Play and the d-pad moves inside it, B closes it, A alone from the main
menu starts the course of the week and a swing can start, Start pauses, the
d-pad moves in the pause list, B resumes. **All 11 checks pass at every size.**

**A bug it found, confirmed on main first:** B (or Esc, or Back) closed a
sheet and left the focus on a button inside the hidden sheet, so the next
d-pad press started from nowhere -- it landed on Course studio, and A there
opened the studio. Main also failed the move inside Play (its sheets opened
with the focus on the close button; the polish's *Sheets open with the keys on
the chosen card* had already fixed that). Now the main menu remembers the tile
that opened a sheet and closing the sheet puts the cursor back on it (main.js
`returnMenuFocus`), else on the first tile. The check's own first run pressed
A once too often after the start button and reopened Play over the growing
course; it stops at a start button now.

## At hand-over (28 October 2026, after the third look)

- The first commit (9f13258) adds the brief's AGENTS.md section word for word
  (compared line by line with docs/reports/ui-polish-goal.md); AGENTS.md has
  not changed since.
- The build is fresh: dist/ was built after the last source change, and the
  smoke run used it -- **38 of 38 journeys pass**.
- The audit at every size: **0 findings left unexplained**; every remaining
  entry in `tools/ui-audit-known.json` is a reason to keep, none a fix put off.
- A controller alone: **11 of 11 at all six sizes**. Press counts unchanged
  (every mode shorter than main). Motion: 22 of 22.
- The menus on Low against main, four rounds, by the whole page: Play's first
  step -55%, Saved courses -28%, the studio -54%; the main menu 0.76 against
  0.80 (+5%) -- the same small four-round reading that came out equal in six
  rounds twice before (0.79/0.78, 0.76/0.75); frame, mean of spots, equal.
  The Ultra run of this last build was stopped when the owner started
  playing it by hand; Ultra's figures are the run before (r7, -9%).

## Square boxes (the owner's hand-play, 28 October 2026)

The owner played the branch and sent eight findings, then: "Its clear to me
that the slanted box style is a problem. Please iterate 5 times over all of
our UI and remove our slanted box style for just regular squares everywhere.
Test on all of our screen size options." The findings, and what each was:

1. **The main menu's Settings / Launch monitor / Help boxes not square with
   the menu.** The tiles' column was sized to its widest tile and centred in
   the menu, 47 px in from the logo and the links -- hidden by the slant.
2. **Saved course, with nothing saved, said "Import a code a friend sent".**
   Now "Build a course or import a code".
3. **A sideways scroll bar under Endless's landscapes.** The column that
   scrolls them (the final audit's fix) scrolled both ways; down only now.
4. **A square box behind the loading box**, and 5. **behind the Leave box**,
   and part of 8. **behind the Save box.** Two causes: the boxes' backing was
   a slanted layer over a square box, which showed past the slant; and the old
   pre-1.0 window's frosted blur (`backdrop-filter`) was never switched off
   under the 1.0 rows. The override had been written, but the build's CSS
   minifier kept only its `-webkit-` copy and dropped the standard one -- so
   it is written unprefixed.
6. **Extra box outlines on a chosen ball in the locker.** The highlight was a
   traced outline (drop shadows following the shape's edge), made for slanted
   shapes; it drew every edge it found. Every traced ring (eight rules) is a
   square box-shadow now.
7. **Vertical stacks and not.** The leaning stacks (each row slid sideways to
   lie on a slanted edge) are gone with the slant: every stack is vertical, the
   scoring box no longer runs into the tiles beside it.
8. **The Save box out of line and half slanted, half square.** Its rows were
   slid by the window lean (ui-windows.js `leanAsOne`), its picture cut to a
   slant; all gone.

**Round 1: the slant out at its source.** 191 skews (`transform:skewX(±12deg)`
on every coloured box's `::before` and its counter-skewed contents) set to
none; the lean code removed (ui-windows.js `leanAsOne` and `watchWindows`,
main.js `leanSeatRows` -- the seats' pickers slid with the seat's lean); the
pictures' slanted cut (`--lean`) set to 0; the eight traced rings made square.
The main menu's cursor no longer slides its tile 6 px (on square tiles it read
as out of line; the motion check now holds that it lights in place). The
handicap block on My profile, centred by an old rule, starts at the left.
The fire effect's flicker keeps its 5-degree skew: a flame, not a box.

**Round 2** (`--out sq2`, every screen at sixteen sizes): 3 findings. On an
upright tablet the golfer card now covered the main menu's tiles (full width
since round 1); under 960 px wide the card goes under the menu, bottom left.
The studio's landscape names took the outline (4.50:1 at the smallest Text
size). In the pictures: the sheets' content stood 25-50 px in from their
titles -- Play's cards, the seats, the steps -- room the slant's overhang had
needed. **Round 3:** every sheet's content starts on its title's edge; a box
that scrolls keeps 6 px inside for a ring and takes it back with a -6 px
margin. Measured, not by eye: every sheet's drawn boxes against its title at
1080p, 1280 x 720 and a phone (the remaining offsets are things inside boxes:
a golfer's ball, a number in a panel). It found Challenges and the course of
the week padded 24 px and Help's page 26, and a phone's content 22 px where
its title is 28. The full audit then found the studio's three columns too
narrow on an upright tablet (names wrapped into their sliders, the tabs ran
under the settings): under 960 px wide it stacks -- the menus as a row of
tabs, the settings full width, the facts under them.

**Round 4** (`--out sq4`, every screen at sixteen sizes): **0 findings.** In
the pictures, at the sizes not yet looked at: the turn flash on a sideways
phone was still the old rounded glass -- its square panel was set only in the
wide-screen block; a phone has it now. Every text field, select and text box
was rounded 5-9 px by the old base style, whose selector outranked the 1.0
override (`.field input:not(...):not(...)`): squared at the source, seven
rules (the arm switch's knob stays round). On a phone the studio's map read
through the save box: without the old frosted backing, the scene behind
showed in the gaps around the description and the picture. The line and the
picture have panels of their own now, and a box over the screen has one solid
backing exactly behind its square rows -- not the old misfitting box, which
stood out past slanted rows.

**Round 5** (the faster audit: `--out sq5`, every screen at sixteen sizes in
14 minutes; then `sq5b` on the fixed build). The audit found one thing: at
the largest Text sizes the studio's key hints stood in the Save box's name
field -- behind the box, but on a layer above it; a box asking a question
hides them now, as an open sheet already did. The contact sheets found the
rest. At 1280 x 720 the Save box ran past the foot of the screen, Go back cut
in half: its view buttons wrapped under the picture; beside it now on every
screen but an upright phone (a sideways phone's layout until now), about a
third shorter. On a sideways phone the next row of landscape cards showed
half through the band under Back / Next: the band faded in from clear; it is
solid now, a hard edge. And rounded corners were still everywhere the slant
had hidden them: the name field, every key plate (W A S D, ESC), and the old
base style's tiles, cards, chips and fields that phones and some boxes fall
back to -- 110 corners squared by one script that changed nothing but the
radius (checked against a copy taken before). Kept round, on purpose: the
balls, dots and toggles (`50%`), the score chips, skip pill, bag tags and
the turn banner's pill (999 px), and small bars and badges whose radius is
half their size (the XP and level bars, the level badge, the meter's marker,
the growing bar). Last, on an upright phone the shot chips read CURVE
STRAIGH and SPIN 0 cut: the italic value's last letter leans past its
clipped box (on main already); it has 3 px of room now. The kit's tests held
the slant (the panel leaning -12, selection traced in drop shadows) and now
hold the square: nothing in the kit leans or rounds, selection is a square
ring.

Then `sq5b`, the fixed build at sixteen sizes: **0 findings**, 846 s.
