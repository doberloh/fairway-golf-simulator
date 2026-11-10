// THE TOOL PALETTE'S ICONS (the builder-ux goal, 10 November 2026): plain
// stroked drawings on a 24-unit square in the text's colour, so they follow
// the theme and the tool's state. Each is the inside of an <svg>.
const S = {
 move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
 select: '<path d="M5 3l13 9-6 1.5L9 20z"/><path d="M12.5 13.5l4 6" />',
 brush: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12c-2 2-3 4-3 8 4 0 6-1 8-3"/>',
 erase: '<path d="M16 4l5 5-10 10H6l-3-3z"/><path d="M9 11l5 5M11 19h10"/>',
 eraseAll: '<path d="M16 4l5 5-10 10H6l-3-3z"/><path d="M11 19h10M4 4l16 16" stroke-dasharray="2 2"/>',
 outline: '<path d="M4 18c0-6 4-12 9-12s7 4 7 7-3 5-6 5H4z"/><circle cx="4" cy="18" r="1.8"/><circle cx="13" cy="6" r="1.8"/><circle cx="20" cy="13" r="1.8"/>',
 smooth: '<path d="M3 15c3-6 6 2 9-4s6 2 9-2"/><path d="M3 20h18" opacity=".5"/>',
 creek: '<path d="M3 7c3-2 5 2 8 0s5 2 10 0M3 13c3-2 5 2 8 0s5 2 10 0M3 19c3-2 5 2 8 0s5 2 10 0"/>',
 bunker: '<ellipse cx="12" cy="14" rx="8" ry="5"/><path d="M8 13h.01M12 15h.01M15 12h.01M10 16h.01" stroke-width="2.5"/>',
 tree: '<path d="M12 3l6 9h-3l4 6H5l4-6H6z"/><path d="M12 18v3"/>',
 treeBrush: '<path d="M7 4l3.5 5h-2l2.5 4H4l2.5-4h-2zM17 8l3.5 5h-2l2.5 4H14l2.5-4h-2z"/>',
 treeZone: '<path d="M3 5h18v14H3z" stroke-dasharray="3 2"/><path d="M12 7l3 5h-6zM12 12v4"/>',
 treeErase: '<path d="M9 4l4 6H5zM9 10v4"/><path d="M14 14l6 6M20 14l-6 6"/>',
 sizeTree: '<path d="M10 5l4 6H6zM10 11v5"/><path d="M18 4v16M18 4l-2 2M18 4l2 2M18 20l-2-2M18 20l2-2"/>',
 cover: '<path d="M3 18l3-5 3 1 2-3 3 2 2-2 5 7z"/><circle cx="7" cy="8" r="2"/>',
 coverErase: '<path d="M3 18l3-5 3 1 2-3 3 2"/><path d="M14 13l6 6M20 13l-6 6"/>',
 home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
 homeZone: '<path d="M3 4h18v16H3z" stroke-dasharray="3 2"/><path d="M8 13l4-3.5 4 3.5v4H8z"/>',
 homeErase: '<path d="M4 11l6-5 6 5v7H4z"/><path d="M15 14l6 6M21 14l-6 6"/>',
 align: '<rect x="4" y="5" width="16" height="13"/><path d="M4 15l5-4 4 3 3-2 4 3"/><path d="M12 2v3M12 18v3" />',
 boundary: '<path d="M4 6l6-3 9 3 2 8-6 7-10-2z" stroke-dasharray="3 2"/>',
 measure: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
 mark: '<path d="M6 21V4"/><path d="M6 4l11 4-11 4"/>',
 raise: '<path d="M3 19c4-1 5-11 9-11s5 10 9 11"/><path d="M12 3v4M10 5l2-2 2 2"/>',
 lower: '<path d="M3 9c4 1 5 10 9 10s5-9 9-10"/><path d="M12 5v4M10 7l2 2 2-2"/>',
 flatten: '<path d="M3 15c3 0 4-3 6-3h6c2 0 3 3 6 3"/><path d="M8 9h8"/>',
 eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
 eyeOff: '<path d="M2 12s3.5-6 10-6c2 0 3.7.6 5 1.4M22 12s-3.5 6-10 6c-2 0-3.7-.6-5-1.4"/><path d="M4 20L20 4"/>',
};
export function icon(key) {
 const body = S[key] ?? S.select;
 return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
export const hasIcon = key => key in S;
// THE LAYER'S EYE (the builder-ux goal): open when the layer shows, struck
// through when it is hidden from view (the course keeps it either way).
export function eyeButton(doc, kind, name, hidden, onClick) {
 const b = doc.createElement('button');
 b.type = 'button'; b.className = 'cb-eye' + (hidden ? ' cb-hidden' : ''); b.dataset.eye = kind;
 b.title = hidden ? `${name} is hidden from view: click to show it (the course keeps it)` : `Hide ${name.toLowerCase()} from view (the course keeps it)`;
 b.setAttribute('aria-label', hidden ? `Show ${name}` : `Hide ${name}`); b.setAttribute('aria-pressed', String(hidden));
 b.innerHTML = icon(hidden ? 'eyeOff' : 'eye').replace('width="22" height="22"', 'width="18" height="18"');
 b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
 return b;
}
