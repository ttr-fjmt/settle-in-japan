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
 * 【動きについて】
 * 波はゆっくり横に流し、日は静かに上下して光がまたたく。動きはCSSだけで作る（JavaScriptを使わない）。
 * 波の絵は同じ形を2つ並べて、1つぶん（800）動かしたら元に戻す。継ぎ目が出ないようにするため。
 *
 * 目が疲れる速さにはしない。また、端末の設定で「視差効果を減らす」を選んでいる人には
 * 動きを止める（prefers-reduced-motion）。動きが苦手な人・乗り物酔いしやすい人がいるため。
 */
function heroArt() {
  const wave = 'M0 196 C 90 176 150 214 240 196 C 330 178 390 214 480 196 C 570 178 630 214 720 196 C 760 188 780 192 800 196 L800 280 L0 280 Z';
  const waveBack = 'M0 202 C 100 186 160 216 260 202 C 360 188 420 218 520 202 C 620 186 680 216 780 202 C 790 200 795 201 800 202 L800 280 L0 280 Z';
  return `<div class="hero-art" role="img" aria-label="A stylised view of Mount Fuji beyond the waves / 波の向こうの富士山を描いた絵">
<svg viewBox="0 0 800 260" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8dcc4"/>
      <stop offset="60%" stop-color="#f2ead9"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a5183"/>
      <stop offset="100%" stop-color="#16294a"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="#c4573c" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#c4573c" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="frame"><rect width="800" height="260"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="800" height="260" fill="url(#sky)"/>

    <g class="sun">
      <circle cx="626" cy="74" r="70" fill="url(#glow)" class="sun-glow"/>
      <circle cx="626" cy="74" r="34" fill="#c4573c" opacity="0.85"/>
    </g>

    <path d="M255 182 L372 66 Q385 53 398 66 L515 182 Z" fill="#1f3a63"/>
    <path d="M338 100 L372 66 Q385 53 398 66 L432 100 L412 92 L396 104 L378 90 L358 104 Z" fill="#f5f0e6"/>
    <path d="M0 182 H800 V196 H0 Z" fill="#2a5183" opacity="0.35"/>

    <g class="sea-back" opacity="0.55">
      <path d="${waveBack}" fill="#2a5183"/>
      <path d="${waveBack}" fill="#2a5183" transform="translate(800,0)"/>
    </g>
    <g class="sea-front">
      <path d="${wave}" fill="url(#sea)"/>
      <path d="${wave}" fill="url(#sea)" transform="translate(800,0)"/>
    </g>

    <g class="foam" fill="none" stroke="#f5f0e6" stroke-opacity="0.5" stroke-width="2.5" stroke-linecap="round">
      <path d="M60 222 q22 -14 44 0 q22 14 44 0"/>
      <path d="M300 232 q22 -14 44 0 q22 14 44 0" class="foam-2"/>
      <path d="M560 224 q22 -14 44 0 q22 14 44 0" class="foam-3"/>
    </g>
  </g>
</svg>
</div>`;
}

/**
 * アイコン。線だけの簡単な形で、意味が伝わるものだけを使う。
 * 外部の画像やアイコン用フォントは読み込まない。
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

/**
 * ページの共通の外側。
 *
 * OGP画像は canonical から決める（/guide/xxx/ → /assets/ogp/guide-xxx.png）。
 * ページを作る側が指定し忘れても必ず入るようにするため、引数ではなく自動で導く。
 */
function layout({ title, description, canonical, body, hero = '' }) {
  const pagePath = canonical.replace(SITE_URL, '') || '/';
  const ogImage = ogpUrl(pagePath);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${escape(canonical)}">
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
body{margin:0;background:var(--paper);color:var(--ink);
  font:16px/1.85 "Hiragino Sans","Yu Gothic",system-ui,sans-serif}
.wrap{max-width:62rem;margin:0 auto;padding:28px 16px 64px}
a{color:var(--indigo)}
.icon{vertical-align:-4px;flex:none}

/* ヘッダー：藍地に青海波の地紋 */
header.site{background:var(--indigo-deep);background-image:${SEIGAIHA};color:#f4efe4;
  border-bottom:3px solid var(--vermilion)}
header.site .wrap{padding:14px 16px;display:flex;justify-content:space-between;align-items:center;
  gap:10px 20px;flex-wrap:wrap}
.brand{font-weight:700;font-size:1.05rem;text-decoration:none;color:#fffdf8;letter-spacing:.01em;
  display:inline-flex;align-items:center;gap:10px}
.brand .logo{flex:none;border-radius:8px}
.brand-text span{display:block;font-size:.72rem;font-weight:400;color:#c9d6e6}
header.site nav{display:flex;gap:16px;flex-wrap:wrap}
header.site nav a{color:#e8eef6;text-decoration:none;font-size:.9rem;display:inline-flex;align-items:center;gap:6px;
  padding:4px 0;border-bottom:1px solid transparent}
header.site nav a:hover{border-bottom-color:var(--vermilion)}

/* トップの絵 */
.hero-art{line-height:0;background:#f2ead9}
/* 波はゆっくり流れ、日は静かに上下する。動きはここだけ。本文には動きを入れない */
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-800px)}}
@keyframes driftBack{from{transform:translateX(0)}to{transform:translateX(-800px)}}
@keyframes sunRise{0%{transform:translateY(4px)}100%{transform:translateY(-8px)}}
@keyframes sunGlow{0%{opacity:.55}100%{opacity:1}}
@keyframes bob{0%{transform:translateY(0)}100%{transform:translateY(-4px)}}
.sea-front{animation:drift 26s linear infinite}
.sea-back{animation:driftBack 44s linear infinite}
.sun{animation:sunRise 30s ease-in-out infinite alternate;transform-origin:626px 74px}
.sun-glow{animation:sunGlow 7s ease-in-out infinite alternate}
.foam path{animation:bob 5s ease-in-out infinite alternate}
.foam .foam-2{animation-duration:6.5s;animation-delay:-2s}
.foam .foam-3{animation-duration:8s;animation-delay:-4s}
@media (prefers-reduced-motion:reduce){
  .sea-front,.sea-back,.sun,.sun-glow,.foam path{animation:none}
}
.hero-art svg{width:100%;height:auto;aspect-ratio:800/260;display:block}

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

/* 入口のカード（トップ・記事一覧） */
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
<a class="brand" href="/">${logoMark(34)}<span class="brand-text">${SITE_NAME}<span>日本移住ガイド</span></span></a>
<nav>
  <a href="/visa/">${icon('card', 18)}Residence statuses / 在留資格</a>
  <a href="/guide/">${icon('guide', 18)}Guides / 手続きの解説</a>
</nav>
</div></header>
${hero}
<main class="wrap">
${body}
</main>
<footer class="site"><div class="wrap">
${SITE_NAME} — information for people settling in Japan.<br>
This site explains the official rules and points you to official contacts. It does not give advice on individual cases.<br>
このサイトは制度の説明と公式窓口の案内を行うもので、個別の申請についての判断はしません。
</div></footer>
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
