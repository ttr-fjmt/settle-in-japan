'use strict';

/**
 * ロゴのファイルを書き出す。
 *
 *   favicon.svg          … ブラウザのタブに出る印（最近のブラウザはこれを見る）
 *   favicon.ico          … 昔からのブラウザ・一部の検索エンジン向け（32×32）
 *   apple-touch-icon.png … iPhone のホーム画面に追加したときの絵（180×180）
 *   assets/logo.svg      … サイトのロゴ（大きさを問わず使えるもの）
 *   assets/logo-512.png  … 画像でしか受け取れないところに出すとき用
 *
 * PNG は環境にあるブラウザで撮る（lib/render.js）。追加のパッケージは使わない。
 *
 * 実行例:
 *   node generate-brand-assets.js
 */

const fs = require('node:fs');
const path = require('node:path');

const { logoGlyph, logoFile, PAPER } = require('./lib/brand');
const { renderPng, pngToIco, findBrowser } = require('./lib/render');

const ROOT = path.join(__dirname, '..');

/** PNG に撮るための HTML。余白なしでロゴだけを置く。 */
function iconHtml(size, { radius = 0 } = {}) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}html,body{width:${size}px;height:${size}px;background:${PAPER};overflow:hidden}
svg{display:block}
</style></head>
<body>
<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
<rect width="64" height="64" rx="${radius}" fill="${PAPER}"/>
${logoGlyph()}
</svg>
</body></html>
`;
}

function main() {
  const svgFiles = [
    ['favicon.svg', logoFile(64)],
    [path.join('assets', 'logo.svg'), logoFile(256)],
  ];
  for (const [rel, svg] of svgFiles) {
    const full = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, svg);
    console.log(`書き出しました: ${rel}`);
  }

  if (!findBrowser()) {
    console.log('ブラウザが見つからないため、PNG（apple-touch-icon / favicon.ico）は作りませんでした');
    return;
  }

  // iPhone はホーム画面で角を自分で丸めるので、こちらは角丸にしない。
  renderPng(iconHtml(180), path.join(ROOT, 'apple-touch-icon.png'), { width: 180, height: 180 });
  console.log('書き出しました: apple-touch-icon.png（180×180）');

  renderPng(iconHtml(512, { radius: 64 }), path.join(ROOT, 'assets', 'logo-512.png'), {
    width: 512,
    height: 512,
  });
  console.log('書き出しました: assets/logo-512.png（512×512）');

  // ICO の中身は PNG。ブラウザのタブに出る大きさ（32×32）で入れる。
  const icoSource = path.join(ROOT, 'assets', '.favicon-source.png');
  renderPng(iconHtml(32), icoSource, { width: 32, height: 32 });
  fs.writeFileSync(path.join(ROOT, 'favicon.ico'), pngToIco(fs.readFileSync(icoSource), 32));
  fs.rmSync(icoSource);
  console.log('書き出しました: favicon.ico（32×32）');
}

if (require.main === module) main();

module.exports = { iconHtml };
