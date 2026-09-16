'use strict';

/**
 * アイコン。線だけの簡単な形で、意味が伝わるものだけを使う。
 * 外部の画像やアイコン用フォントは読み込まない。
 *
 * ページの外側（page-layout.js）と、右下の道案内（guide-widget.js）の両方から使うので、
 * ここに分けてある。片方だけ直すとアイコンが食い違うため、増やすときもここ1か所で。
 */

const ICON_PATHS = {
  work: '<path d="M4 8h16v11H4z"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M4 13h16"/>',
  study: '<path d="M4 6h7a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H4z"/><path d="M20 6h-7a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h7z"/>',
  designated: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  status: '<path d="M12 4l7 4v5c0 4-3 6.5-7 7-4-.5-7-3-7-7V8z"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="12" r="2"/><path d="M14 10h4M14 14h4"/>',
  home: '<path d="M4 11l8-6 8 6"/><path d="M6 11v8h12v-8"/>',
  health: '<path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20z"/>',
  move: '<path d="M4 12h12"/><path d="M12 7l5 5-5 5"/><path d="M20 5v14"/>',
  guide: '<path d="M6 4h9l4 4v12H6z"/><path d="M15 4v4h4"/><path d="M9 13h7M9 16h7"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3.5 2"/>',
};

function icon(name, size = 22) {
  const paths = ICON_PATHS[name];
  if (!paths) throw new Error(`アイコン "${name}" は定義されていません`);
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

module.exports = { icon, ICON_PATHS };
