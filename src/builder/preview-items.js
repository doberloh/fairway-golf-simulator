// WHAT THE PREVIEW SHOWS (the owner, 4 November 2026: "in both the 2d AND 3d
// editor, when selecting an outline or paint. We need to show the 3d model of
// the thing you are painting, placing, outlining, etc."): for a tool and a
// landscape, a small scene described in plain data -- its ground and the real
// models on it at their real sizes -- which preview.js draws. Pure, so what
// each tool shows is tested without a graphics card
// (tests/builder-preview.test.mjs).
//
// `item`: {kind: 'surface', surface} | {kind: 'tree'} | {kind: 'house'} |
// {kind: 'pond'} | {kind: 'creek'} | {kind: 'bunker'} |
// {kind: 'cover', cover, min, max}. Returns {title, ground, stripes, bowl,
// water, flag, golfer, pieces: [{family, size, by, x, z, leaf, bark, accent}],
// caption}; `by` says what `size` measures: 'height', or 'across' for a stone
// and a spreading plant. Null for a tool with nothing to show.
import {FAMILY_OF} from '../plant-families.js';
import {GROUNDS, GROUND_TINT, allows} from '../grounds.js';
import {GROUND_PLANTS, SPREAD_SIZED} from '../species.js';
import {SEASON_TINTS} from '../season-tints.js';
import {coverByKey} from './cover.js';

const look = (species, bio) => {
 const family = FAMILY_OF[species] ?? species, t = SEASON_TINTS[family]?.summer ?? {};
 return {family, leaf: t.leaf ?? bio.tree ?? '#4e7a38', bark: t.bark ?? '#5b4634', accent: t.accent ?? t.leaf ?? bio.tree ?? '#4e7a38'};
};
const plant = (species, bio, size, x, z) => ({...look(species, bio), size, by: SPREAD_SIZED.has(species) ? 'across' : 'height', x, z});
const stone = (bio, shape, size, x, z) => ({family: 'boulder' + (bio.rockStyle || 'round'), shape, size, by: 'across', x, z, leaf: bio.rock, bark: bio.rock, accent: bio.rockMoss ?? bio.rock});
const byWeight = list => [...list].sort((a, b) => b[1] - a[1]).map(p => p[0]);
const tall = bio => byWeight((bio.plants ?? []).filter(p => !GROUND_PLANTS.has(p[0])));
const low = bio => byWeight((bio.plants ?? []).filter(p => GROUND_PLANTS.has(p[0])));
const groundColour = (kind, bio) => bio.groundTints?.[kind] ?? GROUND_TINT[kind] ?? GROUNDS[kind]?.map ?? bio.rough;
// A row of three along the middle: where several pieces stand.
const ROW = [[-.75, .1], [.75, -.1], [0, -.5]];

function surface(kind, bio) {
 const fine = {title: '', ground: bio.rough, pieces: []};
 if (kind === 'green') return {...fine, title: 'Green', ground: bio.green, flag: true, caption: 'Cut short. The cup goes here.'};
 if (kind === 'fairway') return {...fine, title: 'Fairway', ground: bio.fairway, stripes: bio.semi, caption: 'Mown in stripes in the game.'};
 if (kind === 'semi') return {...fine, title: 'Semi-rough', ground: bio.semi, caption: 'The first cut, round the fairway.'};
 if (kind === 'tee') return {...fine, title: 'Tee', ground: bio.fairway, tee: true, caption: 'Where the hole starts.'};
 if (kind === 'sand') return {...fine, title: 'Bunker', ground: bio.rough, bowl: bio.sand, caption: 'Sand. Dig a bunker lowers the ground too.'};
 if (kind === 'water') return {...fine, title: 'Water', ground: bio.rough, water: bio.water || '#4a8fb0', caption: 'Its bed is dug and its banks graded when it goes in.'};
 if (kind === 'path' || kind === 'road') return {...fine, title: GROUNDS[kind]?.label ?? 'Path', ground: bio.rough, strip: GROUNDS[kind]?.map ?? '#b9b2a4'};
 if (kind === 'rough') {
  const grass = bio.longGrass?.families?.[0]?.[0];
  return {...fine, title: 'Rough', ground: bio.rough, pieces: grass ? [{family: grass, size: bio.longGrass.families[0][2] ?? .8, by: 'height', x: 0, z: 0, leaf: bio.longGrass.leaf, bark: bio.longGrass.leaf, accent: bio.longGrass.accent}] : [], caption: 'Takes every layer off, down to the landscape\'s rough.'};
 }
 // A ground type: what the game grows on it, in this landscape.
 const pieces = [];
 if (allows(kind, 'boulders')) pieces.push(stone(bio, 0, 1.4, ...ROW[0]));
 if (allows(kind, 'shrubs') && low(bio)[0]) pieces.push(plant(low(bio)[0], bio, 1.2, ...ROW[1]));
 if (allows(kind, 'trees') && tall(bio)[0]) pieces.push(plant(tall(bio)[0], bio, 7, ...ROW[2]));
 return {...fine, title: GROUNDS[kind]?.label ?? kind, ground: groundColour(kind, bio), pieces, caption: pieces.length ? 'With what the game grows on it here.' : 'Bare: nothing grows on it.'};
}

export function previewOf(item, bio) {
 if (!item || !bio) return null;
 if (item.kind === 'surface') return surface(item.surface, bio);
 if (item.kind === 'tree') {
  const list = tall(bio).slice(0, 3);
  return {title: 'Trees', ground: bio.rough, golfer: true, pieces: list.map((k, i) => plant(k, bio, [12, 9, 7][i], ...ROW[i])), caption: 'The landscape\'s own, in the game\'s models.'};
 }
 if (item.kind === 'house') return {title: 'House', ground: bio.rough, golfer: true, pieces: [{family: 'house', size: 7, by: 'height', x: 0, z: 0, leaf: '#b08a63', bark: '#7d6c55', accent: '#7d6c55'}], caption: 'Faces the nearest fairway, green or tee.'};
 if (item.kind === 'pond') return {...surface('water', bio), title: 'Pond'};
 if (item.kind === 'creek') return {...surface('water', bio), title: 'Creek', creek: true, water: null, strip: bio.water || '#4a8fb0', caption: 'Its channel is cut as it is drawn.'};
 if (item.kind === 'bunker') return surface('sand', bio);
 if (item.kind === 'cover') {
  const c = coverByKey(bio, item.cover); if (!c) return null;
  const {min, max} = item, mid = (min + max) / 2, sizes = [min, mid, max], xs = [-.8, 0, .8];
  // Mixed: a different plant at each size.
  const names = byWeight(c.plants), reach = Math.max(2, max);
  const pieces = sizes.map((size, i) => c.key === 'rocks' ? stone(bio, i, size, xs[i] * reach, 0) : plant(names[i % names.length], bio, size, xs[i] * reach, 0));
  return {title: c.label, ground: bio.rough, golfer: true, pieces, caption: `From ${min.toFixed(1)} m to ${max.toFixed(1)} m.`};
 }
 return null;
}
