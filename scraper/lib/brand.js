'use strict';

/**
 * ロゴと、SNSに出る画像（OGP画像）の絵をここにまとめる。
 *
 * 【考え方】
 * 見た目と同じ浮世絵の3色（藍・生成り・朱）で、富士と日と波だけを描く。
 * 小さく表示されても形が分かるように、線を細くしすぎない・要素を増やしすぎない。
 *
 * 絵はすべて自分たちで描いた SVG。外部の画像も、アイコン用フォントも読み込まない
 * （読み込みが遅くならないため。著作権の問題を起こさないため）。
 *
 * ロゴは3か所で使う。ここを直せば3か所とも変わる。
 *   1. ページのヘッダー（inline SVG）
 *   2. ファビコン（favicon.svg / apple-touch-icon.png / favicon.ico）
 *   3. OGP画像（SNSでリンクを貼ったときに出る画像）
 */

const SITE_NAME = 'Settle in Japan';
const SITE_URL = 'https://settle-in-japan.net';

const INDIGO = '#1f3a63';
const INDIGO_DEEP = '#16294a';
const PAPER = '#f4efe4';
const PAPER_LIGHT = '#fffdf8';
const VERMILION = '#c4573c';
const INK = '#1a2233';

/**
 * ロゴの中身（64×64 の座標で描く）。枠は含めない。
 * 日（朱）＋富士（藍）＋波（藍）。富士の雪は白に近い紙の色。小さくしても峰の形が分かるよう、雪は輪郭より内側に描く。
 */
function logoGlyph({ snow = PAPER_LIGHT } = {}) {
  return `<circle cx="45" cy="19" r="11" fill="${VERMILION}"/>
<path d="M9 42 L28 14 Q32 9 36 14 L55 42 Z" fill="${INDIGO}"/>
<path d="M21.5 24 L28.6 15 Q32 11.2 35.4 15 L42.5 24 L39 21.5 L35.3 24.6 L32 21.5 L28.7 24.6 L25 22 Z" fill="${snow}"/>
<g fill="none" stroke="${INDIGO}" stroke-width="2.8" stroke-linecap="round">
  <path d="M8 53 q6 -5 12 0 q6 5 12 0 q6 -5 12 0 q6 5 12 0"/>
</g>`;
}

/** ヘッダーに置く小さなロゴ（紙のタイルの上に描く）。 */
function logoMark(size = 30) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect width="64" height="64" rx="12" fill="${PAPER}"/>
${logoGlyph()}
</svg>`;
}

/** ファイルとして書き出すロゴ（favicon.svg / assets/logo.svg）。 */
function logoFile(size = 64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="Settle in Japan">
<title>Settle in Japan</title>
<rect width="64" height="64" rx="12" fill="${PAPER}"/>
${logoGlyph()}
</svg>
`;
}

/** ロゴ＋サイト名の横並び（OGP画像の足元に置く）。 */
function logoLockup(size = 56) {
  return `<span class="lockup">${logoMark(size)}<span class="lockup-text"><b>Settle in Japan</b><small>settle-in-japan.net</small></span></span>`;
}

/**
 * OGP画像の下の帯に置く絵（1200×200）。動かさない静止版。
 *
 * ヘッダーの絵をそのまま縮めると富士の頭が切れるので、帯の形に合わせて描き直したもの。
 * 水面から富士が立ち上がり、右上に日が出ている構図。文字は重ねない。
 */
function ogpArt() {
  const waveFront =
    'M0 130 C 120 112 210 148 330 130 C 450 112 540 148 660 130 C 780 112 870 148 990 130 C 1080 118 1140 124 1200 130 L1200 200 L0 200 Z';
  const waveBack =
    'M0 140 C 150 124 240 154 390 140 C 540 126 630 156 780 140 C 930 124 1020 154 1170 140 L1200 140 L1200 200 L0 200 Z';
  return `<svg viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#2a5183"/><stop offset="100%" stop-color="${INDIGO_DEEP}"/>
  </linearGradient>
</defs>
<circle cx="1040" cy="58" r="42" fill="${VERMILION}" opacity="0.85"/>
<path d="M676 140 L788 32 Q800 20 812 32 L924 140 Z" fill="${INDIGO}"/>
<path d="M755 72 L788 32 Q800 20 812 32 L845 72 L826 63 L810 76 L792 61 L772 76 Z" fill="#f5f0e6"/>
<path d="${waveBack}" fill="#2a5183" opacity="0.5"/>
<path d="${waveFront}" fill="url(#sea)"/>
<g fill="none" stroke="#f5f0e6" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round">
  <path d="M90 168 q28 -16 56 0 q28 16 56 0"/>
  <path d="M430 176 q28 -16 56 0 q28 16 56 0"/>
  <path d="M820 170 q28 -16 56 0 q28 16 56 0"/>
</g>
</svg>`;
}

module.exports = {
  SITE_NAME,
  SITE_URL,
  logoGlyph,
  logoMark,
  logoFile,
  logoLockup,
  ogpArt,
  INDIGO,
  INDIGO_DEEP,
  PAPER,
  PAPER_LIGHT,
  VERMILION,
  INK,
};
