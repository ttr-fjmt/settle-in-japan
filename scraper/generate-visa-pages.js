'use strict';

/**
 * data/visa-types.json から、在留資格図鑑のページを書き出す。
 *
 *   /                  … サイトのトップ（いまは在留資格図鑑への入口だけ）
 *   /visa/             … 在留資格の一覧・比較表
 *   /visa/<id>/        … 在留資格ごとのページ
 *
 * 【翻訳しない】
 * 画面の見出しやボタンは英語と日本語で書くが、**制度の説明そのもの（活動内容・在留期間）は
 * 公式ページの日本語をそのまま載せる**。法律の条文を私たちが訳すと、訳し方しだいで意味が変わり、
 * 「公式に書かれていること」でなくなってしまう。英訳を載せるのは、公式の英語版で確認できたときだけ。
 * 日本語の原文をそのまま見せることは、窓口でこの画面を見せれば通じる、という実用面でも役に立つ。
 *
 * 【確認できていないことは、確認できていないと書く】
 * 就労の可否・家族帯同の可否が unknown のものは、空欄や「不可」にせず
 * 「一覧表に記載なし（確認中）」と表示する。
 *
 * 実行例:
 *   node generate-visa-pages.js
 *   node generate-visa-pages.js --dry-run
 */

const fs = require('fs');
const path = require('path');

const { VISA_GROUP_LABELS } = require('./lib/schema');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'visa-types.json');
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

/** 区分の見出し。英語と日本語を併記する。 */
const GROUP_HEADINGS = {
  work: { en: 'Work permitted', ja: VISA_GROUP_LABELS.work },
  non_work: { en: 'Work not permitted', ja: VISA_GROUP_LABELS.non_work },
  designated: { en: 'Designated individually', ja: VISA_GROUP_LABELS.designated },
  status_based: { en: 'Based on status', ja: VISA_GROUP_LABELS.status_based },
};
const GROUP_ORDER = ['work', 'non_work', 'designated', 'status_based'];

/** 就労の可否の表示。unknown は「不可」ではなく「記載なし」と書く。 */
const WORK_LABELS = {
  yes: { en: 'Yes', ja: '就労できる', tone: 'yes' },
  no: { en: 'No', ja: '就労できない', tone: 'no' },
  depends: { en: 'Depends', ja: '許可の内容による', tone: 'unknown' },
  unknown: { en: 'Not stated in the list', ja: '一覧表に記載なし（確認中）', tone: 'unknown' },
};

/**
 * 家族滞在の対象かどうかの表示。
 * 「家族を呼べるか」ではなく「家族滞在の対象か」と書く。外交・公用は在留資格そのものに
 * 家族の活動が含まれ、身分・地位に基づく資格には別の道があるため、no を「呼べない」と
 * 読ませてはいけない。
 */
const FAMILY_LABELS = {
  yes: { en: 'Yes', ja: '家族滞在の対象', tone: 'yes' },
  no: { en: 'Not on this route', ja: '家族滞在の対象ではない', tone: 'unknown' },
  depends: { en: 'Depends', ja: '許可の内容による', tone: 'unknown' },
  unknown: { en: 'Not confirmed', ja: '確認中', tone: 'unknown' },
};

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
<nav><a href="/visa/">Residence statuses / 在留資格</a></nav>
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

/** 出典の表示。すべてのページに、出典と最終確認日を必ず出す。 */
function sourceBlock(record) {
  return `<p class="source">Source / 出典: <a href="${escape(record.source_url)}" rel="nofollow">出入国在留管理庁「在留資格一覧表」</a><br>
Last checked / 最終確認日: ${escape(record.source_checked_at)}</p>`;
}

/** 在留資格ごとのページ。 */
function buildDetailPage(record) {
  const work = WORK_LABELS[record.work_allowed];
  const family = FAMILY_LABELS[record.family_stay];
  const body = `
<h1>${escape(record.name_en)}<span class="ja">${escape(record.name_ja)}</span></h1>
<p class="lead">${escape(GROUP_HEADINGS[record.group].en)} / ${escape(GROUP_HEADINGS[record.group].ja)}</p>

<div class="card">
  <h3>Activities / 本邦において行うことができる活動</h3>
  <ul class="official">
    ${record.activities_ja.map(a => `<li>${escape(a)}</li>`).join('\n    ')}
  </ul>
</div>
${
  record.examples_ja
    ? `<div class="card"><h3>Examples / 該当例</h3><p class="official">${escape(record.examples_ja)}</p></div>`
    : ''
}
<div class="card">
  <h3>Period of stay / 在留期間</h3>
  <p class="official">${record.periods_ja.map(escape).join('<br>')}</p>
</div>
<div class="card">
  <h3>Work / 就労</h3>
  <p><span class="pill ${work.tone}">${escape(work.en)}</span> ${escape(work.ja)}</p>
  <h3 style="margin-top:14px">Family on the Dependent status / 家族滞在の対象</h3>
  <p><span class="pill ${family.tone}">${escape(family.en)}</span> ${escape(family.ja)}</p>
  <p style="font-size:.85rem;color:var(--ink-2);margin:6px 0 0">Whether a spouse or child can stay on the <a href="/visa/dependent/">Dependent</a> status. Some statuses include family members in the status itself — see the activities above.<br>
  配偶者・子が「家族滞在」で在留できるかを示します。在留資格そのものに家族の活動が含まれるものもあります（上の活動内容をご覧ください）。</p>
</div>

<p class="note">The text above is quoted from the official list in Japanese, exactly as published. We do not translate it, because a translation of legal wording can change its meaning. Show this page at the counter if it helps.<br>
上の文章は、公式の一覧表の日本語をそのまま載せています。法律の文言は訳し方で意味が変わるため、私たちは翻訳しません。窓口ではこの画面をそのまま見せてください。</p>

${sourceBlock(record)}
<p><a href="/visa/">&larr; All residence statuses / 在留資格の一覧</a></p>
`;
  return layout({
    title: `${record.name_en}（${record.name_ja}）| ${SITE_NAME}`,
    description: `${record.name_ja}の活動内容・在留期間・就労の可否。出入国在留管理庁の在留資格一覧表（${record.source_checked_at} 確認）より。`,
    canonical: `${SITE_URL}/visa/${record.id}/`,
    body,
  });
}

/** 一覧・比較ページ。 */
function buildListPage(records) {
  const rows = group =>
    records
      .filter(r => r.group === group)
      .map(r => {
        const work = WORK_LABELS[r.work_allowed];
        return `<tr>
      <td class="name"><a href="/visa/${escape(r.id)}/">${escape(r.name_ja)}</a><small>${escape(r.name_en)}</small></td>
      <td><span class="pill ${work.tone}">${escape(work.en)}</span></td>
      <td>${r.periods_ja.map(escape).join('<br>')}</td>
      <td>${escape(r.examples_ja || '—')}</td>
    </tr>`;
      })
      .join('\n    ');

  const sections = GROUP_ORDER.filter(g => records.some(r => r.group === g))
    .map(
      g => `<h2>${escape(GROUP_HEADINGS[g].en)} <span class="ja">/ ${escape(GROUP_HEADINGS[g].ja)}</span></h2>
<div class="scroll"><table>
  <thead><tr>
    <th>Status / 在留資格</th><th>Work / 就労</th><th>Period of stay / 在留期間</th><th>Examples / 該当例</th>
  </tr></thead>
  <tbody>
    ${rows(g)}
  </tbody>
</table></div>`
    )
    .join('\n');

  const checked = records.map(r => r.source_checked_at).sort().pop();
  const body = `
<h1>Residence statuses of Japan<span class="ja">在留資格の一覧・比較</span></h1>
<p class="lead">All ${records.length} entries from the official list, with what each one allows you to do, how long you can stay, and whether you can work.<br>
公式の在留資格一覧表にある${records.length}件を、活動内容・在留期間・就労の可否で比べられるようにしたものです。</p>

<p class="note">Wording is quoted from the official list in Japanese, exactly as published — we do not translate legal wording. Items the official list does not state are marked "Not stated in the list" rather than guessed.<br>
文言は公式の一覧表の日本語そのままです。一覧表に書かれていない項目は、推測せず「記載なし」と表示しています。</p>

${sections}

<p class="source">Source / 出典: <a href="https://www.moj.go.jp/isa/applications/status/qaq5.html" rel="nofollow">出入国在留管理庁「在留資格一覧表」</a><br>
Last checked / 最終確認日: ${escape(checked)}</p>
`;
  return layout({
    title: `Residence statuses of Japan | ${SITE_NAME}`,
    description: `日本の在留資格${records.length}件を、活動内容・在留期間・就労の可否で比較。出入国在留管理庁の在留資格一覧表（${checked} 確認）より。`,
    canonical: `${SITE_URL}/visa/`,
    body,
  });
}

/** サイトのトップ。いまは在留資格図鑑への入口だけを出す。 */
function buildTopPage(records) {
  const body = `
<h1>Settle in Japan<span class="ja">日本で暮らしはじめる人のための情報</span></h1>
<p class="lead">Official rules on residence, procedures, housing and work — quoted from the source, with the date we last checked it.<br>
在留資格・手続き・住まい・仕事の情報を、公式ページで確認できたものだけ、出典と確認日をつけて載せます。</p>

<div class="card">
  <h3>Available now / いま見られるもの</h3>
  <p><a href="/visa/">Residence statuses of Japan — all ${records.length} entries compared</a><br>
  <a href="/visa/">在留資格の一覧・比較（${records.length}件）</a></p>
</div>

<p class="note">This site is being built. Sections on procedures after arrival, housing, money and consultation desks are not published yet.<br>
このサイトは準備中です。来日後の手続き・住まい・お金・相談窓口のページは、まだ公開していません。</p>
`;
  return layout({
    title: `${SITE_NAME} — information for people settling in Japan`,
    description: '外国人が日本で暮らしはじめるための情報。在留資格・手続き・住まい・仕事を、公式ページで確認できた内容だけ、出典つきで掲載します。',
    canonical: `${SITE_URL}/`,
    body,
  });
}

function main() {
  const records = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  if (records.length === 0) throw new Error('data/visa-types.json が空です');

  const files = [
    { path: 'index.html', html: buildTopPage(records) },
    { path: path.join('visa', 'index.html'), html: buildListPage(records) },
    ...records.map(r => ({ path: path.join('visa', r.id, 'index.html'), html: buildDetailPage(r) })),
  ];

  if (process.argv.includes('--dry-run')) {
    console.log(`[DRY RUN] ${files.length}ページ（書き込みません）`);
    files.forEach(f => console.log('  ' + f.path));
    return;
  }

  for (const f of files) {
    const full = path.join(ROOT, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.html);
  }
  console.log(`${files.length}ページを書き出しました（トップ1・一覧1・在留資格${records.length}）`);
}

if (require.main === module) main();

module.exports = { buildTopPage, buildListPage, buildDetailPage, WORK_LABELS };
