# The 1.0 interface polish

The last goal before 1.0 (branch `ui-polish-1-0`, from 27 October 2026): every
screen polished at every screen size, the bugs found and fixed at their
cause, a shorter way into every mode, the course studio's settings condensed,
animation where it helps, real pictures of each landscape instead of the tiny
turning models, a picture for every saved course, plain words. The owner's
brief is local (`docs/reports/ui-polish-goal.md`); this is the record: the
checklist every change names, the rounds, the decisions and the rejected
alternatives.

**Merged into main on 29 October 2026** at the owner's word ("Lets do a
merge right now"), `--no-ff`, its 35 commits squashed to five on
`ui-polish-1-0-squashed`, each holding exactly the files of a commit that was
tested (the rules; the polish to the hand-over, 69b3407; square boxes,
2f90fb0; the owner's second list, 425e867; the merge's doc edits). The
round-by-round history stays on the local branch `ui-polish-1-0`. AGENTS.md's
section that unlocked the graphics card for this branch was deleted in the
merge, so main is back under the ordinary GPU rules. Not released; not
played by hand beyond the owner's one round of 28 October.

**Rules of this goal** (AGENTS.md's section for it, deleted at the merge): interface
only -- physics, scoring, formats, challenges and generation unchanged, the
fingerprint silent; **no performance cost on any tier** (the owner: "There
should be no performance hits for these changes allowed"), each change that
could move a frame measured against main's build; old saves, course codes
and friend's challenges still open; **a bug is confirmed on today's build
before anything is changed for it** (the owner, setting the goal).

**This page was cut down on 12 November 2026** (the owner: retire the
journals of finished branches). It keeps what the code and the tools still
point at: the checklist every interface change names (W1, G1, T2 and the
rest), the audit tool, the house style for how the game talks, and the design
of the studio's settings, the landscape and course pictures, the way into
every mode, the type on small desk screens, the menus' motion and what each
cost. **The record of the work itself -- the rounds, the bugs confirmed, the
phone and contrast rounds, the smoke run, the final audit, the hand-over, and
the owner's two lists after playing it (*Square boxes* and the foot, the
phone and the water) -- is in [history/UI_POLISH.md](history/UI_POLISH.md),
word for word.** A section named elsewhere and not on this page is there.
Search it; do not read it whole.

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
map, a shot, and (since 28 October 2026) the bag open, a phone's map chip on
and a Swing Meter shot in the air -- at sixteen sizes (phones both ways, tablets both ways,
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
