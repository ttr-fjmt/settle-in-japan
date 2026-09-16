'use strict';

/**
 * ページの外側（<head>・ヘッダー・フッター・スタイル）を1か所にまとめる。
 *
 * 在留資格のページと記事のページで同じ見た目にするため。ここを直せば全ページに効く。
 * ページごとにスタイルを書くと、直し漏れが必ず出る。
 */

const SITE_NAME = 'Settle in Japan';
const SITE_URL = 'https://settle-in-japan.net';
const GA_MEASUREMENT_ID = 'G-44PECD16GK';
const ADSENSE_CLIENT = 'ca-pub-5761092657360295';

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
      'background:#16212e;color:#fff;font-size:13px;line-height:1.6;padding:12px 18px;border-radius:8px;' +
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

const escape = s =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** ページの共通の外側。スタイルは1か所にまとめる（ページごとに書かない）。 */
function layout({ title, description, canonical, body }) {
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
<meta name="twitter:card" content="summary">
${headTags()}
<style>
:root{--ground:#f2f4f7;--surface:#fff;--ink:#16212e;--ink-2:#4a586a;--line:#dde3ea;--indigo:#23438a;--ok:#1f6b4f;--ok-bg:#e4f1eb;--no:#8a3a2a;--no-bg:#f8ebe7;--unknown:#6d5a1f;--unknown-bg:#f6f0dd}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.8 "Hiragino Sans","Yu Gothic",system-ui,sans-serif}
.wrap{max-width:60rem;margin:0 auto;padding:24px 16px 64px}
a{color:var(--indigo)}
header.site{background:var(--surface);border-bottom:1px solid var(--line)}
header.site .wrap{padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.brand{font-weight:700;text-decoration:none;color:var(--ink)}
.brand span{display:block;font-size:.72rem;font-weight:400;color:var(--ink-2)}
h1{font-size:clamp(1.5rem,5vw,2.1rem);line-height:1.3;margin:0 0 6px}
h1 .ja{display:block;font-size:.95rem;color:var(--ink-2);font-weight:400;margin-top:4px}
h2{font-size:1.15rem;margin:36px 0 10px}
h2 .ja{font-weight:400;color:var(--ink-2);font-size:.85rem}
.lead{color:var(--ink-2);margin:0 0 20px}
table{width:100%;border-collapse:collapse;background:var(--surface);font-size:.92rem}
.scroll{overflow-x:auto;border:1px solid var(--line)}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;line-break:strict;word-break:normal;overflow-wrap:normal}
th:nth-child(3),td:nth-child(3){min-width:15rem}
thead th{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);background:#fafbfc;white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td.name{white-space:nowrap;font-weight:700}
td.name small{display:block;font-weight:400;color:var(--ink-2)}
.pill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:.78rem;white-space:nowrap}
.pill.yes{background:var(--ok-bg);color:var(--ok)}
.pill.no{background:var(--no-bg);color:var(--no)}
.pill.unknown{background:var(--unknown-bg);color:var(--unknown)}
.card{background:var(--surface);border:1px solid var(--line);padding:18px 20px;margin-bottom:2px}
.card h3{margin:0 0 8px;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.official{font-size:1rem;line-height:1.9}
.official li{margin-bottom:10px}
.note{background:var(--surface);border-left:3px solid var(--indigo);padding:14px 16px;color:var(--ink-2);font-size:.9rem;margin:20px 0}
.source{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);font-size:.85rem;color:var(--ink-2)}
.source ul{margin:6px 0;padding-left:1.2em}
/* 記事：英語と日本語を並べる。引用（公式の日本語）は見た目で区別する。 */
article section{margin-bottom:34px}
article h1{margin-bottom:10px}
p.en{margin:0 0 4px}
p.ja{margin:0 0 18px;color:var(--ink-2);font-size:.95rem}
blockquote.quote{margin:18px 0;padding:14px 18px;background:var(--surface);border-left:3px solid var(--indigo)}
blockquote.quote p{margin:0 0 8px;font-size:.98rem;line-height:1.9}
blockquote.quote cite{font-style:normal;font-size:.8rem;color:var(--ink-2)}
ul.cards{list-style:none;margin:0;padding:0;display:grid;gap:2px}
ul.cards .card{padding:18px 20px}
ul.cards .card .ja{display:block;color:var(--ink-2);font-size:.9rem;margin-top:2px}
ul.cards .card p{margin:8px 0 0;font-size:.9rem;color:var(--ink-2)}
footer.site{margin-top:48px;border-top:1px solid var(--line);background:var(--surface)}
footer.site .wrap{padding:20px 16px;font-size:.85rem;color:var(--ink-2)}
@media(prefers-color-scheme:dark){
:root{--ground:#11161d;--surface:#181f28;--ink:#e9eef4;--ink-2:#aab6c4;--line:#2a3340;--indigo:#93b2ee;--ok:#7cc9a6;--ok-bg:#15281f;--no:#e5a08c;--no-bg:#2d1e1a;--unknown:#d8c078;--unknown-bg:#2a2617}
thead th{background:#1d242e}
}
</style>
</head>
<body>
<header class="site"><div class="wrap">
<a class="brand" href="/">${SITE_NAME}<span>日本移住ガイド</span></a>
<nav><a href="/visa/">Residence statuses / 在留資格</a> ・ <a href="/guide/">Guides / 手続きの解説</a></nav>
</div></header>
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


module.exports = { layout, escape, headTags, SITE_NAME, SITE_URL, GA_MEASUREMENT_ID, ADSENSE_CLIENT };
