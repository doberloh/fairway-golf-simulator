// SEASONS (the US landscapes goal, 2 November 2026; PLAN.md section 3, local).
// Which season a date falls in, which season a round is played in, and what
// a landscape looks like then. Pure: no DOM, no three.js; tests/seasons.test.mjs.
//
// The owner's answers: a round's season is chosen when it starts -- today's
// (from the date, the default) or one the player picks -- and saved with the
// round, so a resumed round looks as it did. Snow is for looks only: a season
// never changes how a ball plays. Autumn is a season everywhere.
//
// Meteorological seasons, by whole months (PLACED: simpler than the
// equinoxes and what weather services report): spring March-May, summer
// June-August, autumn September-November, winter December-February. A
// tropical landscape (the record's `tropical`: the Keys, Hawaii) has one
// green look the year round, so its season is always summer and only its
// flowering would change.
//
// Built in steps: until the seasons are drawn (the goal's step 9) every
// season resolves to summer (`DRAWN`), so a round started in any season looks
// as the game always has, and the choice is already saved with it.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
// The seasons the game can draw so far. Step 9 lists all four.
export const DRAWN = ['summer'];

const BY_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer',
 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

// The season on a date in the northern hemisphere (every landscape so far is
// north of the equator; `south` flips it for one that is not).
export function seasonOf(date = new Date(), {south = false} = {}) {
 const s = BY_MONTH[date.getMonth()];
 return south ? SEASONS[(SEASONS.indexOf(s) + 2) % 4] : s;
}

// A round's season: `choice` is 'today' or one of SEASONS; anything else is
// today's. A tropical landscape is always summer. The answer is a season the
// game can draw (DRAWN), so an old or hand-made save never asks for a look
// that does not exist.
export function roundSeason(choice = 'today', {date = new Date(), tropical = false} = {}) {
 if (tropical) return 'summer';
 const s = SEASONS.includes(choice) ? choice : seasonOf(date);
 return DRAWN.includes(s) ? s : 'summer';
}

// Is `choice` something a round may carry: 'today' or a season.
export const validSeasonChoice = choice => choice === 'today' || SEASONS.includes(choice);

// What a landscape record changes in a season: a partial record laid over it
// (the turf, the leaves, the light), from the record's own `seasons` table.
// Summer is the record itself.
export function seasonLook(record, season) {
 if (season === 'summer' || !record?.seasons) return {};
 return record.seasons[season] || {};
}
