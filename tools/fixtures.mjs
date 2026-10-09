// The courses a measurement is taken over.
//
// THREE TIERS, BECAUSE THE COST OF ASKING IS WHAT DECIDES HOW OFTEN YOU ASK.
// A 9-hole world with water takes about 5 seconds to build, so a 30-course
// sweep is two and a half minutes of pure generation if nothing shares it. That
// is affordable once and ruinous as an inner loop: a session spent tuning one
// function against a full sweep burns most of an hour regenerating identical
// terrain.
//
// So `quick` is for iterating -- small enough to run after every edit, large
// enough to catch a rule that is outright broken -- and `full` is for the
// answer you report. `standard` is the middle one for a change you believe in
// but have not confirmed.
export const BIOMES = ['pnw', 'desert', 'mountain', 'links', 'midwest', 'redwood', 'autumn', 'haunted'];
export const COASTAL = ['island', 'links'];

// Water on, because most of what goes wrong goes wrong near water.
export const WATER = {rivers: 1, creeks: 2, water: 60, lakes: 1};

const TIERS = {
 quick:    {biomes: ['pnw', 'mountain'], seeds: ['S1', 'S2']},
 standard: {biomes: ['pnw', 'mountain', 'links'], seeds: ['S1', 'S2', 'S3', 'S4']},
 full:     {biomes: BIOMES, seeds: ['S1', 'S2', 'S3', 'S4', 'S5']},
};

// A settings object per course. `extra` overrides anything -- a sweep of one
// control is a fixture with that control set, not a different fixture.
export function fixture(tier = 'standard', extra = {}) {
 const t = TIERS[tier];
 if (!t) throw new Error(`unknown fixture tier "${tier}" (${Object.keys(TIERS).join(', ')})`);
 const out = [];
 for (const biome of t.biomes) for (const seed of t.seeds)
  out.push({seed, biome, holes: 9, trees: 0, ...WATER, ...extra});
 return out;
}

export const TIER_NAMES = Object.keys(TIERS);
