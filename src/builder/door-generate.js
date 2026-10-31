// Door 1, "Generate and modify a course" (stage 3 builds it).
import {show, setTitle, home, ui} from './builder.js';
export function open() {
 setTitle('Generate and modify');
 show(ui.el('section', {class: 'cb-doors'}, ui.el('p', {}, 'Generating a course to modify arrives in stage 3 of the builder.'), ui.el('button', {class: 'cb-btn', onclick: home}, 'Back')));
}
