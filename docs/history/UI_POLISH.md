# The 1.0 interface polish: the record of the work

**A journal, kept as it was written.** The 1.0 interface polish (branch
`ui-polish-1-0`, 27-29 October 2026, merged into main on 29 October and
released in 0.9.6) was recorded round by round in `docs/UI_POLISH.md`. On 12
November 2026 that page was cut down to the checklist and the designs the
code still points at, and the record of the work moved here, word for word
and in its order: the rounds, the bugs confirmed before they were changed,
the contrast and phone rounds, the smoke run, the final audit, the hand-over,
and the owner's two lists after playing it.

**Search this file; do not read it whole** (about 8 thousand tokens):
`grep -n "^## " docs/history/UI_POLISH.md` lists its sections. It is not
edited to keep up with the game. The checklist its rounds name (W1, G1, T2
and the rest) stayed in [../UI_POLISH.md](../UI_POLISH.md).

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
**Since then:** 169 pictures for 41 landscapes, retaken on generator 87's land
(4 November 2026, `biome-shots take --picks`): 6,259 KB, about 8.15 MB of the
page, past the 3 MB written for ten, so `encode` reports over budget (TODO).

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

## The owner's second list: the foot, the phone, the water (28 October 2026)

After playing again the owner sent nine findings; four of them asked for five
rounds each (the foot's two halves and the phone's map), and mid-way: "the
club/lie can ALL be one continuous box instead of separation between the
pieces." What each was, and what was done:

1. **The course studio rang Rivers and Creeks twice.** A group inside a card
   (Water's Rivers and Creeks): both took the focus-within ring. The ring is on
   the innermost box holding the focus now (`:not(:has(...:focus-within))`).
2. **Light shapes flashing across ponds.** The cat's paws (the cartoon
   overhaul's waves, round 18) drifted 160 m/s in any wind -- a unit slip,
   noise units for metres, times the water clock's 10. They drift at the
   wind's own speed now (RESEARCH.md, *cat's paws*: the pond's area changing a
   frame 3.2% -> 0.6%, measured from hole 1's bank in frames 0.22 s apart).
3. **The in-flight shot box ("Dustin · Driver", SKIP) was back** -- on phones,
   which still drew the old shot panel to carry Skip. Gone on every screen;
   Skip is in the meter's row (below), and off the meter a phone shows Skip
   alone bottom right.
4. **The club menu opened under everything on a phone**: the club box was
   layer 7 under the meter and the aim pad (8); open, it is 36, over the XP
   popup (34) too.
5. **The golfers back top right on an upright phone** (they were under the
   hole), wrapping into a second row with four; **6. the wind under the hole
   card** (it was top right).
7. **The map behind a button on a phone**, and **8. the lie in the club box**
   and **9. curve, height and spin in the meter, compacted**, five rounds each
   -- *THE FOOT, COMPACTED* in PROJECT_HANDOFF says how it is built.

The rounds, each audited at the round's screens (rest, four golfers, after a
shot, the bag open, the map chip on, a Swing Meter shot in the air -- the
audit's new `round-club`, `round-map` and `round-flight`), five sizes for the
first three and eight (both small phones and 4K added) for the last two:

- **Round 1** (`foot1`): the lie moved into the club box as a band on its top;
  curve, height and spin moved into the meter's row beside carry, total and
  apex; Skip into the same row in flight; MAP beside MENU. Found: the phone's
  Skip missing (an old rule hides every `.sm-skip` on a phone with
  `!important`), STRAIGHT cut to "STRAI..." (the six cells split evenly),
  MAP under the 44 px touch size and over the pin's yards at the top centre.
- **Round 2** (`foot2`, 0 findings): Skip shown on phones; the row's cells
  sized by their content; MAP 44 px, sideways under the golfers with the map
  under it. Found in the pictures: the sideways map ran behind the aim pad.
- **Round 3** (`foot3`, 0): the sideways map 118 tall; MENU as tall as MAP; Q
  and E inside the club box's panel (the lie band overhung it by their width).
- **Round 4** (`foot4`, 15 findings, all one cause): the lie line never wraps
  (a short club name had made the band too narrow and it broke into the box);
  the open bag over the XP popup. The 360-wide phone found the upright meter,
  366 wide, running 3 px off each side.
- **Round 5** (`foot5`, `foot5b`, 0 at eight sizes): the meter as wide as the
  screen allows; **one continuous box** -- one panel behind the lie, the code,
  the name and the keys, the code in the accent's letters, no filled square;
  and the lie as the box's first grid row, so the box takes the wider of its
  two rows (pinned on top, the band overhung the box whenever the lie's line
  was wider than the club's name).

The map's own changes were in rounds 1-3; rounds 4 and 5 audited it unchanged.
**Not played by hand**: seen in the audit's pictures only.

**The phone's bar** (the owner, asked what a phone's touch did to the
camera: "Add the views button that cycles the camera like the g button ...
also add a free flight button ... combine them all into one box with divider
lines"). A phone could not change the camera at all: the tool column is not
drawn there and the pause list hides its cameras. MENU, MAP, VIEWS and FLY are
one small panel now, thin lines between (12 px words, each 44 px tall): VIEWS
and FLY press G and V for you. Free flight on a phone had fallen back to the
old rounded bar with 30 px fly buttons; it is the 1.0 look now -- the fly pad
six 44 px buttons in the aim pad's corner, Jump to green a chip at the foot,
FLY lit and taking you back.

*Checked when the card was free* (29 October 2026). Smoke's phone journeys
passed their new VIEWS / FLY step, then failed the next one: it still
expected the old flight panel, which a phone has not drawn since the foot
was compacted -- the harness was wrong, not the game (the step had never run
on a phone before, both journeys stopping at the map), and now knows a phone
by its bar. The audit's pictures at four phone sizes (`bar1`-`bar5`) found
three faults, all fixed: flying, the club box, meter and aim pad stayed (a
big screen puts them away from 561 px up only), the aim pad's top arrow
showing over the fly pad and the club box under the chip; Jump to green's
picker hung below its chip (the chip stacked its words over an 84 px field;
now one 44 px row), and upright the chip beside the bar ran 14 px into the
fly pad on a 360-wide phone, so it has its own row above them; and from a
long hole's tee on an upright phone the pin's yards stood on the hole card
(its middle is under the card). Drawing the marker under the card hid half
the yards, so main.js keeps it just below the card instead (`holeCardRect`),
at every size. Then: 0 findings at six sizes; the phone journeys and the drag
check pass; frame against main (`polish-bar-low` / `-ultra`, the play
camera on tees 1, 5, 9 of autumn) -- Low the graphics card equal to 1%,
Ultra mean of spots +2.2% and p95 -0.7%, each tee's gap inside one build's
two runs. **Judged: not slower. Not played by hand.**

**Checked, and owed.** npm test 1138 of 1138; the fingerprint silent; the
controller, press-count and motion checks pass (22 of 22); smoke 36 of 38 --
`phone-portrait` and `phone-landscape` failed on their step that tapped the
map thumbnail, which is now behind MAP: the step presses MAP first now (and
checks the map is hidden before), **not yet re-run**. Also owed, stopped when
the owner started a game (the card was 97-99% busy): the drag check
(`ui-movable-check`, taught to press MAP on a phone) and a frame comparison
against main for the water shader's new uniform and the round screen's new
foot -- expected to cost nothing (one more uniform; fewer boxes), not measured.
