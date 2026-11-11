// PUBLISHED FLIGHTS the air model (src/aero.js) is fitted to and checked
// against: ball speed (mph), launch (deg) and spin (rpm) in; carry (yd), peak
// height (yd) and landing angle (deg) out. tools/flight-fit.mjs fits them,
// tools/ball-bench.mjs and tests/aero.test.mjs check a few. Sources and what
// each is worth are in docs/BALL_PHYSICS.md, *The air*.

// TrackMan's normalised 6 iron (77 F, sea level, a premium ball), calm and in a
// CONSTANT wind (the table's own footnote: no change of wind with height).
// Model output with stated air and stated wind: the best single target there
// is. trackman.com, "The 2023 PGA & LPGA Tour Averages" pages' 6-iron tables.
export const NORMALISED = [
 {club: 'PGA 6 iron', mph: 130, vla: 14.7, spin: 6088, rows: [
  {wind: 0, carry: 184, apex: 33.8, land: 48.0}, {wind: -10, carry: 166, apex: 38.1, land: 58.1}, {wind: -20, carry: 143, apex: 42.8, land: 69.5},
  {wind: 10, carry: 198, apex: 29.7, land: 39.5}, {wind: 20, carry: 207, apex: 26.1, land: 32.7}]},
 {club: 'LPGA 6 iron', mph: 110, vla: 18.6, spin: 5950, rows: [
  {wind: 0, carry: 152, apex: 27.7, land: 45.6}, {wind: -10, carry: 139, apex: 31.3, land: 55.6}, {wind: -20, carry: 121, apex: 35.3, land: 67.4},
  {wind: 10, carry: 161, apex: 24.5, land: 37.7}, {wind: 20, carry: 167, apex: 21.7, land: 31.7}]},
];

// TrackMan's driver optimizer charts (2010): model output, "no wind, flat
// terrain, sea level, premium balls". [ball mph, launch, spin, carry yd].
// Carry-optimised rows (attack -5 / 0 / +5) and total-optimised rows.
export const DRIVER_CHART = [
 [104, 14.6, 3722, 143], [107, 16.3, 3121, 154], [108, 19.2, 2720, 164], [113, 12.9, 3652, 160], [115, 15.5, 3179, 171], [116, 18.0, 2648, 181],
 [121, 11.9, 3669, 175], [123, 14.5, 3164, 187], [124, 17.0, 2596, 197], [129, 11.1, 3689, 191], [131, 13.4, 3093, 203], [132, 16.4, 2633, 214],
 [137, 9.9, 3626, 207], [138, 12.7, 3114, 219], [140, 15.7, 2595, 231], [144, 9.6, 3722, 222], [146, 12.1, 3118, 235], [148, 14.9, 2538, 247],
 [152, 8.7, 3675, 237], [154, 11.2, 3038, 251], [155, 14.5, 2563, 263], [160, 7.7, 3570, 252], [162, 10.5, 2970, 266], [163, 13.7, 2435, 279],
 [168, 7.0, 3548, 266], [170, 9.8, 2919, 281], [171, 13.0, 2358, 295], [176, 6.1, 3433, 281], [178, 9.3, 2890, 296], [179, 12.6, 2343, 310],
 [107, 11.8, 3214, 140], [109, 13.0, 2506, 147], [111, 15.3, 1976, 156], [115, 10.1, 3078, 154], [117, 12.1, 2494, 163], [118, 14.8, 2005, 174],
 [123, 9.3, 3110, 169], [125, 11.7, 2568, 180], [126, 14.0, 1964, 189], [131, 8.5, 3122, 185], [132, 10.8, 2517, 196], [134, 13.8, 2021, 207],
 [138, 7.9, 3144, 201], [140, 10.5, 2565, 213], [141, 13.0, 1948, 223], [146, 7.2, 3118, 216], [148, 10.0, 2570, 230], [149, 12.4, 1887, 239],
 [154, 6.4, 3071, 231], [156, 9.1, 2461, 243], [157, 11.7, 1810, 254], [162, 5.6, 3005, 245], [163, 8.7, 2471, 260], [165, 11.1, 1716, 268],
 [170, 5.3, 3030, 261], [171, 8.0, 2396, 274], [172, 10.7, 1681, 285], [178, 4.5, 2929, 273], [179, 7.7, 2382, 290], [180, 10.3, 1636, 300],
];

// TrackMan's tour averages, 2023 season ("2024" tables). MEASURED flights, but
// raw: "altitude and weather have not been taken into consideration", so
// expect 2-3% in carry either way. [club, ball mph, launch, spin, apex yd,
// land deg, carry yd].
export const TOUR = {
 PGA: [['Driver', 171, 10.4, 2545, 35, 39, 282], ['3 wood', 162, 9.3, 3663, 32, 44, 249], ['5 wood', 156, 9.7, 4322, 33, 48, 236], ['Hybrid', 149, 10.2, 4587, 31, 49, 231],
  ['3 iron', 145, 10.3, 4404, 30, 48, 218], ['4 iron', 140, 10.8, 4782, 31, 49, 209], ['5 iron', 135, 11.9, 5280, 33, 50, 199], ['6 iron', 130, 14.0, 6204, 32, 50, 188],
  ['7 iron', 123, 16.1, 7124, 34, 51, 176], ['8 iron', 118, 17.8, 8078, 33, 51, 164], ['9 iron', 112, 20.0, 8793, 32, 52, 152], ['PW', 104, 23.7, 9316, 32, 52, 142]],
 LPGA: [['Driver', 143, 12.6, 2506, 26, 36, 223], ['3 wood', 135, 11.6, 2595, 25, 38, 200], ['5 wood', 130, 12.3, 4320, 25, 43, 189], ['Hybrid', 125, 13.9, 4504, 25, 45, 178],
  ['4 iron', 118, 13.9, 4608, 25, 43, 175], ['5 iron', 114, 14.6, 4966, 25, 45, 166], ['6 iron', 111, 16.7, 5904, 25, 46, 155], ['7 iron', 106, 18.5, 6630, 26, 47, 143],
  ['8 iron', 102, 20.8, 7413, 27, 47, 133], ['9 iron', 95, 23.5, 7605, 27, 48, 123], ['PW', 88, 25.2, 8465, 27, 48, 111]],
};

// The USGA's worked example from its indoor test range model: 160 mph, 10 deg,
// 2,520 rpm (42 rev/s) at 75 F flies 257.64 yd in 6.39 s. The only published
// flight TIME found for any club.
export const USGA_EXAMPLE = {mph: 160, vla: 10, spin: 2520, tempC: 23.9, carry: 257.64, hang: 6.39};
