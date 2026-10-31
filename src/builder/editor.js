// The editor both doors end in (stages 3-5 build it).
import {show, setTitle, home, ui} from './builder.js';
export function openEditor(doc) {
 setTitle(doc.name);
 show(ui.el('section', {class: 'cb-doors'}, ui.el('p', {}, `${doc.name}: ${doc.holes.length} holes in ${doc.landscape}. The editor arrives in stage 3.`), ui.el('button', {class: 'cb-btn', onclick: home}, 'Back')));
}
