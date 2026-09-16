'use strict';

/**
 * OGP画像（SNSやチャットでリンクを貼ったときに出る画像）の作り方。
 *
 * 【なぜページごとに作るのか】
 * 1枚の共通画像を全ページに使うと、どのページを共有しても同じ絵になり、
 * 受け取った側は開くまで中身が分からない。ページの題名を焼き込んだ画像にすれば、
 * リンクを見ただけで「在留カードの記事だ」と分かる。クリックされる率が変わる。
 *
 * 【作り方】
 * HTML を組み立てて、ヘッドレスのブラウザで 1200×630 の PNG に撮る
 * （generate-ogp-images.js）。画像はリポジトリに置いて配信する。
 * 追加のパッケージは使わない。ブラウザは環境にあるものを探して使う。
 *
 * 【文字を絵の上に重ねない】
 * 題名は無地の紙の上に置き、富士と波の絵は下の帯に分ける。小さく表示されたときに
 * 文字が読めなくなるのを避けるため。ページの見た目と同じ考え方。
 */

const { logoMark, ogpArt, INDIGO_DEEP, PAPER, VERMILION, INK, SITE_URL } = require('./brand');

const OGP_WIDTH = 1200;
const OGP_HEIGHT = 630;
const OGP_DIR = 'assets/ogp';

const escape = s =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 青海波の地紋（帯にだけ敷く）。page-layout のものと同じ模様。 */
const SEIGAIHA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='30' viewBox='0 0 60 30'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.16' stroke-width='1.2'%3E%3Ccircle cx='30' cy='30' r='27'/%3E%3Ccircle cx='30' cy='30' r='19'/%3E%3Ccircle cx='30' cy='30' r='11'/%3E%3Ccircle cx='0' cy='30' r='27'/%3E%3Ccircle cx='0' cy='30' r='19'/%3E%3Ccircle cx='0' cy='30' r='11'/%3E%3Ccircle cx='60' cy='30' r='27'/%3E%3Ccircle cx='60' cy='30' r='19'/%3E%3Ccircle cx='60' cy='30' r='11'/%3E%3Ccircle cx='15' cy='0' r='27'/%3E%3Ccircle cx='45' cy='0' r='27'/%3E%3C/g%3E%3C/svg%3E")`;

/**
 * ページのパスから、画像の名前を決める。
 *   /                  → top
 *   /visa/             → visa
 *   /visa/engineer/    → visa-engineer
 *   /guide/            → guide
 *   /guide/first-14-days/ → guide-first-14-days
 * 1か所で決めることで、ページ側と画像を作る側の食い違いを防ぐ。
 */
function ogpSlug(pagePath) {
  const parts = String(pagePath).split('/').filter(Boolean);
  if (parts.length === 0) return 'top';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}-${parts.slice(1).join('-')}`;
}

/** ページのパスから、画像のURL（絶対URL）。OGPは相対パスを受け付けない読み手がいる。 */
function ogpUrl(pagePath) {
  return `${SITE_URL}/${OGP_DIR}/${ogpSlug(pagePath)}.png`;
}

/** 画像のリポジトリ内のパス。 */
function ogpFile(pagePath) {
  return `${OGP_DIR}/${ogpSlug(pagePath)}.png`;
}

/** 題名が長いときは文字を小さくする。はみ出して切れるより読める方がよい。 */
function titleSize(text) {
  const n = String(text).length;
  if (n <= 28) return 62;
  if (n <= 42) return 54;
  if (n <= 58) return 46;
  return 40;
}

/**
 * 画像のもとになる HTML。
 * 上：藍の帯にロゴ／中：紙の上に題名／下：富士と波の絵。
 */
function ogpHtml({ kicker, titleEn, titleJa }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${OGP_WIDTH}px;height:${OGP_HEIGHT}px}
body{background:${PAPER};color:${INK};
  font-family:"Liberation Sans","DejaVu Sans","Noto Sans JP","Noto Sans CJK JP","IPAPGothic","Hiragino Sans",sans-serif;
  display:flex;flex-direction:column}
.bar{height:92px;flex:none;background:${INDIGO_DEEP};background-image:${SEIGAIHA};
  border-bottom:4px solid ${VERMILION};color:#fffdf8;
  display:flex;align-items:center;justify-content:space-between;padding:0 48px}
.lockup{display:flex;align-items:center;gap:16px}
.lockup b{font-size:30px;letter-spacing:.01em}
.bar .url{font-size:20px;color:#c9d6e6}
.body{flex:1;padding:40px 56px 16px;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.kicker{font-size:22px;color:${VERMILION};font-weight:700;letter-spacing:.06em;margin-bottom:18px}
.title-en{font-size:${titleSize(titleEn)}px;line-height:1.24;font-weight:700;letter-spacing:-.01em}
.title-ja{font-size:${Math.max(24, Math.round(titleSize(titleJa) * 0.52))}px;line-height:1.5;color:#4d5a6b;margin-top:16px}
.art{height:200px;flex:none;line-height:0;overflow:hidden}
.art svg{width:100%;height:200px;display:block}
</style>
</head>
<body>
<div class="bar">
  <span class="lockup">${logoMark(52)}<b>Settle in Japan</b></span>
  <span class="url">settle-in-japan.net</span>
</div>
<div class="body">
  <div class="kicker">${escape(kicker)}</div>
  <div class="title-en">${escape(titleEn)}</div>
  <div class="title-ja">${escape(titleJa)}</div>
</div>
<div class="art">${ogpArt()}</div>
</body>
</html>
`;
}

module.exports = { ogpSlug, ogpUrl, ogpFile, ogpHtml, OGP_WIDTH, OGP_HEIGHT, OGP_DIR };
