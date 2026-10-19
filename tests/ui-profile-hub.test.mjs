import test from 'node:test';
import assert from 'node:assert/strict';
import {tabOfHeading, overviewTiles, HUB_TABS} from '../src/ui-profile-hub.js';

// The hub sorts the old My profile page into its tabs by the headings the page
// already writes. A heading it does not know would leave its section on no tab
// at all, so every heading renderProfile writes is named here.
test('every section of the old page has a tab', () => {
 const page = {'Your look': 'Locker', 'Achievements 3 of 18': 'Achievements', Challenges: 'Achievements', Overall: 'Stats', Scoring: 'Stats', Bag: 'Bag', 'Round history': 'History', 'Back up & move': 'History'};
 for (const [heading, tab] of Object.entries(page)) assert.equal(tabOfHeading(heading), tab, heading);
 assert.equal(tabOfHeading('Something new'), null);
 for (const tab of Object.values(page)) assert.ok(HUB_TABS.includes(tab));
});

test('the overview shows the eight numbers the mockup chose, and a dash for none', () => {
 const none = overviewTiles({bests: {}, scoringAverage: {}, greens: {hit: 0, of: 0}, fairways: {hit: 0, of: 0}, types: {}});
 assert.deepEqual(none.map(t => t.label), ['BEST 18', 'LONGEST DRIVE', 'FASTEST BALL', 'PAR 4 AVERAGE', 'GREENS IN REG', 'FAIRWAYS HIT', 'PUTTS PER HOLE', 'BIRDIES']);
 assert.equal(none[0].value, '—');
 assert.equal(none[4].unit, '');
 assert.equal(none[7].value, '0');
 const some = overviewTiles({best18: {t: {score: 78}}, bests: {longestDrive: 302, ballSpeed: 168.42}, scoringAverage: {4: 4.3}, greens: {hit: 13, of: 25}, fairways: {hit: 11, of: 18}, puttsPerHole: 1.78, types: {birdie: 63}});
 assert.deepEqual(some.map(t => t.value + t.unit), ['78', '302YD', '168.4MPH', '4.30', '52%', '61%', '1.78', '63']);
});
