'use strict';

/**
 * ページの外側（<head>・ヘッダー・フッター・スタイル）と、アイコン・背景の絵を1か所にまとめる。
 *
 * 在留資格のページと記事のページで同じ見た目にするため。ここを直せば全ページに効く。
 * ページごとにスタイルを書くと、直し漏れが必ず出る。
 *
 * 【見た目の考え方】
 * 浮世絵（富嶽三十六景）の色づかいを借りる。藍（プルシアンブルー）・生成りの紙・朱の3色。
 * 地紋は青海波（せいがいは）を薄く敷き、富士と波の絵はヘッダーにだけ置く。
 *
 * 絵は自分たちで描いた SVG。外部の画像を読み込まない（読み込みが遅くならないため。
 * また、このサイトは通信の遅い環境からも見られる）。
 *
 * 【読みやすさを最優先する】
 * 背景の模様は、本文の下に敷かない。本文は必ず無地の紙の上に置く。
 * 模様が薄くても、文字の後ろにあると読みにくくなる。
 */

const { logoMark, SITE_NAME, SITE_URL } = require('./brand');
const { ogpUrl } = require('./ogp');
const { icon } = require('./icons');
const { guideWidget, GUIDE_WIDGET_CSS } = require('./guide-widget');
const { LOCALES } = require('./locales');

const GA_MEASUREMENT_ID = 'G-44PECD16GK';
const ADSENSE_CLIENT = 'ca-pub-5761092657360295';

const escape = s =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * アクセス解析と広告のタグ。既存3サイトと同じ作りに揃えている。
 *
 * ?ga=off を一度開くと、そのブラウザでは以後計測しない（?ga=on で解除、?ga=status で確認）。
 * 運営者自身のアクセスを数に入れないための仕組み。gtag の設定より前に置くこと
 * （最初のページビューが送られる前に効かせるため）。
 */
function headTags() {
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
<script>
(function () {
  var MEASUREMENT_ID = '${GA_MEASUREMENT_ID}';
  var KEY = 'analytics-opt-out';
  var mode = null;
  try {
    mode = new URLSearchParams(location.search).get('ga');
    if (mode === 'off') localStorage.setItem(KEY, '1');
    if (mode === 'on') localStorage.removeItem(KEY);
    if (localStorage.getItem(KEY) === '1') window['ga-disable-' + MEASUREMENT_ID] = true;
  } catch (e) {
    // プライベートモード等で localStorage が使えなくても、サイト本体は動かす。
  }
  if (mode !== 'off' && mode !== 'on' && mode !== 'status') return;
  var off = false;
  try { off = localStorage.getItem(KEY) === '1'; } catch (e) { off = false; }
  var text = off
    ? 'このブラウザからのアクセスは計測しません（解除するには ?ga=on）'
    : 'このブラウザからのアクセスを計測します（除外するには ?ga=off）';
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;' +
      'background:#16294a;color:#fff;font-size:13px;line-height:1.6;padding:12px 18px;border-radius:8px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:calc(100vw - 32px);text-align:center';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 8000);
  });
})();
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
</script>`;
}

/**
 * 青海波（せいがいは）の地紋。ヘッダーの帯にだけ敷く。
 * 60×30 の単位で繰り返す、日本の伝統的な波の模様。
 */
const SEIGAIHA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='30' viewBox='0 0 60 30'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.16' stroke-width='1.2'%3E%3Ccircle cx='30' cy='30' r='27'/%3E%3Ccircle cx='30' cy='30' r='19'/%3E%3Ccircle cx='30' cy='30' r='11'/%3E%3Ccircle cx='0' cy='30' r='27'/%3E%3Ccircle cx='0' cy='30' r='19'/%3E%3Ccircle cx='0' cy='30' r='11'/%3E%3Ccircle cx='60' cy='30' r='27'/%3E%3Ccircle cx='60' cy='30' r='19'/%3E%3Ccircle cx='60' cy='30' r='11'/%3E%3Ccircle cx='15' cy='0' r='27'/%3E%3Ccircle cx='45' cy='0' r='27'/%3E%3C/g%3E%3C/svg%3E")`;

/**
 * トップページの絵。富士と波を、浮世絵の色で描いたもの（自作のSVG）。
 * 文字は重ねない。絵の上に文字を置くと読みにくくなるため、絵は絵として独立させる。
 *
 * 【横長の帯にしている理由】
 * 以前は縦に大きい絵だったため、パソコンでもスマホでも、絵だけで最初の画面が埋まり、
 * 入口のタイルが下に押し出されていた。見せたいのは入口なので、絵は帯の高さに抑える。
 *
 * 【動きについて】
 * 波はゆっくり横に流し、日は静かに上下して光がまたたく。動きはCSSだけで作る（JavaScriptを使わない）。
 * 波の絵は同じ形を2つ並べて、1つぶん（1200）動かしたら元に戻す。継ぎ目が出ないようにするため。
 *
 * 目が疲れる速さにはしない。また、端末の設定で「視差効果を減らす」を選んでいる人には
 * 動きを止める（prefers-reduced-motion）。動きが苦手な人・乗り物酔いしやすい人がいるため。
 */
function heroArt() {
  const waveFront =
    'M0 130 C 120 104 210 156 330 130 C 450 104 540 156 660 130 C 780 104 870 156 990 130 C 1080 114 1140 122 1200 130 L1200 220 L0 220 Z';
  const waveBack =
    'M0 142 C 150 116 240 164 390 142 C 540 120 630 166 780 142 C 930 116 1020 164 1170 142 L1200 142 L1200 220 L0 220 Z';
  return `<div class="hero-art" role="img" aria-label="A stylised view of Mount Fuji beyond the waves / 波の向こうの富士山を描いた絵">
<svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8dcc4"/>
      <stop offset="70%" stop-color="#f2ead9"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a5183"/>
      <stop offset="100%" stop-color="#16294a"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="#c4573c" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#c4573c" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="frame"><rect width="1200" height="220"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="1200" height="220" fill="url(#sky)"/>

    <g class="sun">
      <circle cx="880" cy="62" r="92" fill="url(#glow)" class="sun-glow"/>
      <circle cx="880" cy="62" r="40" fill="#c4573c" opacity="0.85"/>
    </g>

    <path d="M476 140 L588 32 Q600 20 612 32 L724 140 Z" fill="#1f3a63"/>
    <path d="M555 72 L588 32 Q600 20 612 32 L645 72 L626 63 L610 76 L592 61 L572 76 Z" fill="#f5f0e6"/>

    <g class="sea-back" opacity="0.5">
      <g><path d="${waveBack}" fill="#2a5183"/></g>
      <g transform="translate(1200,0)"><path d="${waveBack}" fill="#2a5183"/></g>
    </g>
    <g class="sea-front">
      <g><path d="${waveFront}" fill="url(#sea)"/></g>
      <g transform="translate(1200,0)"><path d="${waveFront}" fill="url(#sea)"/></g>
    </g>

    <g class="foam" fill="none" stroke="#f5f0e6" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round">
      <path d="M90 176 q28 -16 56 0 q28 16 56 0"/>
      <path d="M430 184 q28 -16 56 0 q28 16 56 0" class="foam-2"/>
      <path d="M820 178 q28 -16 56 0 q28 16 56 0" class="foam-3"/>
    </g>
  </g>
</svg>
</div>`;
}

/**
 * ページの共通の外側。
 *
 * OGP画像は canonical から決める（/guide/xxx/ → /assets/ogp/guide-xxx.png）。
 * ページを作る側が指定し忘れても必ず入るようにするため、引数ではなく自動で導く。
 */
function layout({
  title,
  description,
  canonical,
  body,
  hero = '',
  locale = LOCALES[0],
  // その ページが存在する言語の一覧 [{ code, href }]。無い言語は出さない（404にしないため）
  alternates = [],
  ui = null,
}) {
  const pagePath = canonical.replace(SITE_URL, '') || '/';
  const ogImage = ogpUrl(pagePath);
  const label = key => (ui && ui[key]) || null;

  // 同じページの他言語版（hreflang）。検索エンジンに「これは同じ内容の別言語」と伝える
  const hreflangs = alternates
    .map(a => `<link rel="alternate" hreflang="${escape(a.hreflang || a.code)}" href="${escape(SITE_URL + a.href)}">`)
    .join('\n');
  const defaultAlternate = alternates.find(a => a.code === 'en');
  const xDefault = defaultAlternate
    ? `\n<link rel="alternate" hreflang="x-default" href="${escape(SITE_URL + defaultAlternate.href)}">`
    : '';

  // 言語の切り替え。ヘッダーが詰まらないよう、プルダウンにまとめる。
  // JavaScript を使わない details/summary なので、動かない環境でも開ける
  const current = alternates.find(a => a.code === locale.code);
  const switcher =
    alternates.length > 1
      ? `<details class="langs">
<summary aria-label="${escape(label('other_languages') || 'Language / 言語')}">
${icon('globe', 18)}<span>${escape((current && current.label) || locale.label)}</span>
</summary>
<ul>
${alternates
  .map(a =>
    a.code === locale.code
      ? `<li><span class="current" aria-current="true">${escape(a.label)}</span></li>`
      : `<li><a href="${escape(a.href)}" hreflang="${escape(a.hreflang || a.code)}" lang="${escape(a.hreflang || a.code)}">${escape(a.label)}</a></li>`
  )
  .join('\n')}
</ul>
</details>`
      : '';

  return `<!doctype html>
<html lang="${escape(locale.htmlLang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${escape(canonical)}">
${hreflangs}${xDefault}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(canonical)}">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="${escape(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escape(ogImage)}">
<meta name="theme-color" content="#16294a">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${headTags()}
<style>
/* 浮世絵の色：藍（プルシアンブルー）・生成りの紙・朱 */
:root{
  --paper:#f4efe4;        /* 生成り（地の色） */
  --surface:#fffdf8;      /* 本文を置く紙 */
  --surface-2:#f8f4ea;
  --ink:#1a2233;
  --ink-2:#4d5a6b;
  --ink-3:#7a8595;
  --line:#ddd4c2;
  --indigo:#1f3a63;       /* 藍 */
  --indigo-deep:#16294a;
  --indigo-soft:#e6ecf4;
  --vermilion:#c4573c;    /* 朱 */
  --vermilion-soft:#f7e9e4;
  --ok:#1f6b4f;
  --ok-soft:#e2efe8;
  --warn:#8a6d1f;
  --warn-soft:#f6efd9;
}
*{box-sizing:border-box}
/* ベトナム語の記号つき文字（ế ệ など）は、日本語フォントに入っていないことがある。
   先にラテン文字をきちんと持つフォントを置く。日本語はそのあとのフォントから出る */
body{margin:0;background:var(--paper);color:var(--ink);
  font:16px/1.85 system-ui,-apple-system,"Segoe UI","Hiragino Sans","Yu Gothic",Roboto,sans-serif}
.wrap{max-width:62rem;margin:0 auto;padding:28px 16px 64px}
a{color:var(--indigo)}
.icon{vertical-align:-4px;flex:none}

/* ヘッダー：藍地に青海波の地紋 */
header.site{background:var(--indigo-deep);background-image:${SEIGAIHA};color:#f4efe4;
  border-bottom:3px solid var(--vermilion)}
header.site .wrap{padding:12px 16px;display:flex;justify-content:space-between;align-items:center;
  gap:10px 24px;flex-wrap:wrap}
header.site .right{display:flex;align-items:center;gap:8px 20px;flex-wrap:wrap}
.brand{font-weight:700;font-size:1.05rem;text-decoration:none;color:#fffdf8;letter-spacing:.01em;
  display:inline-flex;align-items:center;gap:10px;background:#1b3053;padding:6px 14px 6px 8px;
  border-radius:999px;border:1px solid #3a5580}
.brand:hover{background:#22375c}
.brand .logo{flex:none;border-radius:8px}
.brand-text span{display:block;font-size:.72rem;font-weight:400;color:#c9d6e6}
/* ヘッダーの押せるものは、すべて塗りつぶしのボタンにする。
   背景の地紋（青海波）が透けると文字が読みにくくなるため、半透明にしない */
header.site nav{display:flex;gap:10px;flex-wrap:wrap}
header.site nav a,
details.langs summary{background:#22375c;color:#f2f6fb;text-decoration:none;font-size:.86rem;
  display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:999px;
  border:1px solid #3a5580;white-space:nowrap}
header.site nav a:hover,
details.langs summary:hover{background:#2e4a77;border-color:var(--vermilion);color:#fff}

/* トップの絵 */
.hero-art{line-height:0;background:#f2ead9}
/* 波は流れながら上下に揺れ、日は静かに上下する。動きはここだけ。本文には動きを入れない。
   「流れる」と「揺れる」を1つの要素で同時にはできないので、外側の入れ物を横に流し、
   中身の波そのものを上下させている */
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-1200px)}}
@keyframes driftBack{from{transform:translateX(0)}to{transform:translateX(-1200px)}}
@keyframes swell{0%{transform:translateY(8px)}100%{transform:translateY(-12px)}}
@keyframes swellBack{0%{transform:translateY(-7px)}100%{transform:translateY(8px)}}
@keyframes sunRise{0%{transform:translateY(7px)}100%{transform:translateY(-13px)}}
@keyframes sunGlow{0%{opacity:.5}100%{opacity:1}}
@keyframes bob{0%{transform:translateY(3px)}100%{transform:translateY(-7px)}}
.sea-front{animation:drift 10s linear infinite}
.sea-back{animation:driftBack 16s linear infinite}
.sea-front path{animation:swell 4.5s ease-in-out infinite alternate}
.sea-back path{animation:swellBack 6s ease-in-out infinite alternate}
.sun{animation:sunRise 13s ease-in-out infinite alternate;transform-origin:880px 62px}
.sun-glow{animation:sunGlow 3.5s ease-in-out infinite alternate}
.foam path{animation:bob 3s ease-in-out infinite alternate}
.foam .foam-2{animation-duration:3.8s;animation-delay:-1.2s}
.foam .foam-3{animation-duration:4.6s;animation-delay:-2.4s}
@media (prefers-reduced-motion:reduce){
  .sea-front,.sea-back,.sea-front path,.sea-back path,.sun,.sun-glow,.foam path{animation:none}
}
.hero-art svg{width:100%;height:clamp(140px,17vw,200px);display:block}

h1{font-size:clamp(1.55rem,5vw,2.15rem);line-height:1.3;margin:0 0 8px;letter-spacing:-.01em}
h1 .ja{display:block;font-size:.95rem;color:var(--ink-2);font-weight:400;margin-top:6px}
h2{font-size:1.2rem;margin:40px 0 12px;display:flex;align-items:center;gap:9px}
h2 .ja{font-weight:400;color:var(--ink-2);font-size:.85rem}
h2 .icon{color:var(--indigo)}
.lead{color:var(--ink-2);margin:0 0 22px}

/* 表：行を見分けやすくする */
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:3px;background:var(--surface)}
table{width:100%;border-collapse:collapse;font-size:.93rem}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top;
  line-break:strict;word-break:normal;overflow-wrap:normal}
th:nth-child(3),td:nth-child(3){min-width:15rem}
thead th{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);
  background:var(--surface-2);white-space:nowrap;border-bottom:2px solid var(--line)}
tbody tr:nth-child(even){background:var(--surface-2)}
tbody tr:hover{background:var(--indigo-soft)}
tbody tr:last-child td{border-bottom:0}
td.name{white-space:nowrap}
td.name a{font-weight:700;font-size:1rem;text-decoration:none;border-bottom:1px solid transparent}
td.name a:hover{border-bottom-color:var(--indigo)}
td.name small{display:block;font-weight:400;color:var(--ink-3);font-size:.8rem;margin-top:2px}

.pill{display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border-radius:999px;
  font-size:.78rem;font-weight:500;white-space:nowrap}
.pill.yes{background:var(--ok-soft);color:var(--ok)}
.pill.no{background:var(--vermilion-soft);color:var(--vermilion)}
.pill.unknown{background:var(--warn-soft);color:var(--warn)}

.card{background:var(--surface);border:1px solid var(--line);border-radius:3px;padding:18px 20px;margin-bottom:6px}
.card h3{margin:0 0 8px;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);
  display:flex;align-items:center;gap:7px}
.card h3 .icon{color:var(--indigo)}
.official{font-size:1rem;line-height:1.95}
.official li{margin-bottom:10px}

.note{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--indigo);
  padding:15px 18px;color:var(--ink-2);font-size:.9rem;margin:22px 0;border-radius:3px}
.source{margin-top:30px;padding-top:18px;border-top:2px solid var(--line);font-size:.85rem;color:var(--ink-2)}
.source ul{margin:6px 0;padding-left:1.2em}

/* 読み上げ用にだけ残す見出し（画面には出さない） */
.visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* トップ：まず読む1本 */
.start{display:flex;gap:18px;align-items:center;background:var(--indigo-deep);color:#fffdf8;
  border-radius:6px;padding:24px 26px;margin:0 0 34px;border-bottom:3px solid var(--vermilion)}
.start-body{flex:1;min-width:0}
.start-kicker{display:inline-block;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  background:var(--vermilion);color:#fff;padding:3px 10px;border-radius:999px;margin-bottom:10px}
.start-title{font-size:clamp(1.35rem,4vw,1.95rem);font-weight:700;line-height:1.3;margin:0 0 6px}
.start-title .ja{display:block;font-size:.88rem;color:#c9d6e6;font-weight:400;margin-top:4px}
.start-desc{margin:0 0 14px;color:#d8e2ee;font-size:.9rem;line-height:1.7}
.start-go{display:inline-block;font-weight:700;color:#fff;text-decoration:none;
  border-bottom:2px solid var(--vermilion);padding-bottom:2px}
.start-go:hover{color:#ffd9ce}
.start-art{color:#3a5f96;flex:none}

/* トップ：用事ごとの入口タイル */
h2.tiles-h{margin:0 0 14px;font-size:1.05rem}
h2.tiles-h .ja{font-weight:400;color:var(--ink-2);font-size:.82rem}
ul.tiles{list-style:none;margin:0 0 30px;padding:0;display:grid;gap:10px;
  grid-template-columns:repeat(3,1fr)}
ul.tiles li > *{display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;
  background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:20px 12px 16px;
  text-decoration:none;color:var(--ink);height:100%}
ul.tiles a:hover{border-color:var(--indigo);background:var(--indigo-soft)}
.tile-icon{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;
  background:var(--indigo-soft);color:var(--indigo);margin-bottom:6px}
.tile-en{font-weight:700;font-size:.95rem;line-height:1.35}
.tile-ja{font-size:.8rem;color:var(--ink-2)}
.tile-n{font-size:.7rem;color:var(--ink-3);border:1px solid var(--line);border-radius:999px;
  padding:1px 9px;margin-top:5px}
ul.tiles .soon > *{opacity:.6}
ul.tiles .soon .tile-icon{background:var(--surface-2)}

/* トップ：在留資格を選ぶ */
.pick{display:flex;gap:14px;align-items:center;background:var(--surface);border:1px solid var(--line);
  border-radius:6px;padding:16px 18px;margin-bottom:8px}
.pick-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;
  background:var(--vermilion-soft);color:var(--vermilion);flex:none}
.pick-body{min-width:0;flex:1}
.pick b{display:block;font-size:.95rem;margin-bottom:6px}
.pick b .ja{font-weight:400;color:var(--ink-2);font-size:.8rem;margin-left:8px}
.pick select{width:100%;max-width:26rem;padding:9px 10px;font:inherit;font-size:.88rem;
  border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--ink)}

@media (max-width:640px){
  ul.tiles{grid-template-columns:repeat(2,1fr)}
  .start{flex-direction:column;align-items:flex-start;padding:20px}
  .start-art{display:none}
}

/* 入口のカード（記事一覧） */
ul.cards{list-style:none;margin:0;padding:0;display:grid;gap:8px;
  grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))}
ul.cards .card{margin:0;display:flex;flex-direction:column;gap:4px}
ul.cards .card .head{display:flex;align-items:center;gap:9px;font-weight:700}
ul.cards .card .head .icon{color:var(--indigo)}
ul.cards .card a{text-decoration:none}
ul.cards .card a:hover .head{color:var(--indigo)}
ul.cards .card .ja{color:var(--ink-2);font-size:.88rem}
ul.cards .card p{margin:6px 0 0;font-size:.88rem;color:var(--ink-2);line-height:1.75}
ul.cards .card.soon{opacity:.72}
ul.cards .card .tag{align-self:flex-start;margin-top:8px;font-size:.72rem;padding:1px 8px;border-radius:999px;
  background:var(--surface-2);color:var(--ink-3);border:1px solid var(--line)}

/* 言語の切り替え（プルダウン）。ヘッダーに言語を並べると詰まって読みにくいため */
details.langs{position:relative}
details.langs summary{list-style:none;cursor:pointer}
details.langs summary::-webkit-details-marker{display:none}
details.langs summary::after{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;
  border-bottom:1.5px solid currentColor;transform:rotate(45deg);margin:-3px 0 0 2px}
details[open].langs summary{background:#2e4a77;border-color:var(--vermilion)}
details.langs ul{position:absolute;right:0;top:calc(100% + 8px);z-index:900;margin:0;padding:6px;
  list-style:none;min-width:12rem;background:var(--surface);border:1px solid var(--line);
  border-radius:6px;box-shadow:0 10px 28px rgba(22,41,74,.28)}
details.langs li{margin:0}
details.langs a,details.langs .current{display:block;padding:9px 12px;border-radius:4px;
  font-size:.88rem;text-decoration:none;color:var(--ink)}
details.langs a:hover{background:var(--indigo-soft);color:var(--indigo)}
details.langs .current{font-weight:700;background:var(--surface-2);color:var(--ink-2)}

/* 案内のリンク */
header.site nav{gap:18px}

/* 画面が狭いとき：1行目にロゴと言語、2行目に案内。日本語の併記は省いて詰まりを防ぐ */
@media (max-width:640px){
  header.site .wrap{gap:8px 12px}
  header.site .right{width:100%;justify-content:space-between;gap:8px 12px}
  header.site nav{gap:16px;font-size:.84rem}
  header.site nav .ja{display:none}
  header.site nav a,details.langs summary{padding:7px 12px;font-size:.8rem}
  .brand{padding:5px 12px 5px 6px}
}

/* 広告の枠。公式の情報と見分けがつくよう、必ず「広告」と添える */
.ad{margin:30px 0;padding:10px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.ad-label{display:block;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-3);margin-bottom:6px}

/* 記事一覧：分類へ飛ぶ小さな入口 */
nav.jump{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 30px}
nav.jump a{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;text-decoration:none;
  color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 13px}
nav.jump a:hover{border-color:var(--indigo);background:var(--indigo-soft)}
nav.jump .icon{color:var(--indigo)}
nav.jump .ja{color:var(--ink-2);font-size:.75rem}

/* 記事：英語と日本語を並べる。引用（公式の日本語）は見た目で区別する */
article section{margin-bottom:36px}
article h1{margin-bottom:10px}
p.en{margin:0 0 4px}
p.ja{margin:0 0 18px;color:var(--ink-2);font-size:.95rem}
blockquote.quote{margin:18px 0;padding:15px 18px;background:var(--surface);
  border:1px solid var(--line);border-left:4px solid var(--vermilion);border-radius:3px}
blockquote.quote p{margin:0 0 8px;font-size:.98rem;line-height:1.95}
blockquote.quote cite{font-style:normal;font-size:.8rem;color:var(--ink-2)}

footer.site{margin-top:52px;background:var(--indigo-deep);background-image:${SEIGAIHA};color:#d8e2ee}
footer.site .wrap{padding:24px 16px;font-size:.85rem}
footer.site a{color:#cfe0f2}
footer.site .foot-links{margin:14px 0 0;display:flex;flex-wrap:wrap;gap:6px 4px}

${GUIDE_WIDGET_CSS}

@media (prefers-color-scheme:dark){
  :root{
    --paper:#111821;--surface:#1a222e;--surface-2:#202936;--ink:#e9eef4;--ink-2:#aab6c4;--ink-3:#8593a3;
    --line:#2e3a49;--indigo:#93b2ee;--indigo-deep:#0e1723;--indigo-soft:#1b2740;
    --vermilion:#e0917a;--vermilion-soft:#2d1e1a;--ok:#7cc9a6;--ok-soft:#15281f;
    --warn:#d8c078;--warn-soft:#2a2617;
  }
  .hero-art{background:#1a222e}
  tbody tr:hover{background:var(--indigo-soft)}
}
</style>
</head>
<body>
<header class="site"><div class="wrap">
<a class="brand" href="${escape(locale.path || '/')}">${logoMark(34)}<span class="brand-text">${SITE_NAME}<span>${escape(label('site_tagline') || '日本移住ガイド')}</span></span></a>
<div class="right">
<nav>
  <a href="/visa/">${icon('card', 18)}${
    label('nav_visa')
      ? escape(label('nav_visa'))
      : 'Residence statuses<span class="ja"> / 在留資格</span>'
  }</a>
  <a href="${escape((locale.path || '') + '/guide/')}">${icon('guide', 18)}${
    label('nav_guide') ? escape(label('nav_guide')) : 'Guides<span class="ja"> / 手続きの解説</span>'
  }</a>
</nav>
${switcher}
</div>
</div></header>
${hero}
<main class="wrap">
${body}
</main>
<footer class="site"><div class="wrap">
${SITE_NAME} — information for people settling in Japan.<br>
This site explains the official rules and points you to official contacts. It does not give advice on individual cases.<br>
このサイトは制度の説明と公式窓口の案内を行うもので、個別の申請についての判断はしません。
<p class="foot-links"><a href="/">Top / トップ</a> ・ <a href="/visa/">Residence statuses / 在留資格</a> ・
<a href="/guide/">Guides / 手続きの解説</a> ・ <a href="/faq/">FAQ / よくある質問</a> ・
<a href="/privacy/">Privacy policy / プライバシーポリシー</a></p>
</div></footer>
${guideWidget()}
</body>
</html>
`;
}

module.exports = {
  layout,
  escape,
  headTags,
  icon,
  heroArt,
  SITE_NAME,
  SITE_URL,
  GA_MEASUREMENT_ID,
  ADSENSE_CLIENT,
};
