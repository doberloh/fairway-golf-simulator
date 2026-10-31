// Door 2, "Generate a real life course" (stages 6-8 build it).
import {show, setTitle, home, ui} from './builder.js';
export function open() {
 setTitle('Real life course');
 show(ui.el('section', {class: 'cb-doors'}, ui.el('p', {}, 'Building from LIDAR arrives in stage 6 of the builder.'), ui.el('button', {class: 'cb-btn', onclick: home}, 'Back')));
}
