// Which stand-in shape the 3D editor draws for a species, pure. The editor
// does not draw the game's models; it says what grows where (view.js). It used
// to draw one shape for a whole landscape, so Desert Palms, whose `treeKind` is
// the desert's low spreading crown, showed a wood of round heads with not a
// palm among them (the owner, 5 November 2026). Now each tree's shape comes
// from the species the game will draw there: a palm's head on its stem, a cone
// for a conifer, and the landscape's own broadleaf shape for the rest.
import {CONIFERS, PALMS} from '../built-world.js';

const NEEDLED = ['pine', 'spruce'], LEAFY = ['oak', 'cactus', 'shrub'];
export function standIn(bio, kind) {
 if (PALMS.has(kind)) return 'palm';
 if (CONIFERS.has(kind)) return NEEDLED.includes(bio.treeKind) ? bio.treeKind : 'pine';
 return LEAFY.includes(bio.treeKind) ? bio.treeKind : 'oak';
}
