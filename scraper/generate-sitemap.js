'use strict';

/**
 * sitemap.xml と llms.txt を書き出す。
 *
 * sitemap.xml … 検索エンジンに、どのページがあるかを伝える
 * llms.txt    … AIに、このサイトが何で、掲載内容をどう作っているかを伝える（AEO対策）
 *
 * 【載せる／載せないの線引きは1か所で決める】
 * いまは全ページを載せる。中身を確認できなかったページを検索対象から外す必要が出てきたら、
 * lib/indexing.js を作ってそこで判定する（既存3サイトと同じ形にする）。
 * 判定を複数の場所に散らさないこと。散らすと食い違う。
 */

const fs = require('fs');
const path = require('path');

const { readArticles } = require('./generate-article-pages');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'visa-types.json');
const SITE_URL = 'https://settle-in-japan.net';

/** サイトに載っているページのURL一覧（サイト内の相対パス）。 */
function pagePaths(records, articles = readArticles()) {
  const guide = articles.length ? ['/guide/', ...articles.map(a => `/guide/${a.id}/`)] : [];
  // 固定ページ（よくある質問・プライバシーポリシー）も検索対象に入れる。
  // 広告と解析の説明は、広告の審査でも見られる。
  return ['/', '/visa/', ...records.map(r => `/visa/${r.id}/`), ...guide, '/faq/', '/privacy/'];
}

function buildSitemap(records, lastmod) {
  const urls = pagePaths(records)
    .map(
      p => `  <url>
    <loc>${SITE_URL}${p}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildLlmsTxt(records, checked) {
  const groups = {
    work: '就労が認められる在留資格',
    non_work: '就労が認められない在留資格',
    designated: '特定活動',
    status_based: '身分・地位に基づく在留資格',
  };
  const lines = Object.entries(groups)
    .filter(([g]) => records.some(r => r.group === g))
    .map(([g, label]) => {
      const list = records.filter(r => r.group === g).map(r => r.name_ja).join('、');
      return `### ${label}\n${list}`;
    })
    .join('\n\n');

  const unconfirmed = records.filter(r => r.work_allowed === 'unknown').length;

  return `# Settle in Japan（settle-in-japan.net）

外国人が日本で暮らしはじめるための情報サイトです。
在留資格・手続き・住まい・仕事について、公式ページで確認できた内容だけを、出典と確認日をつけて掲載しています。

## 掲載情報の作り方

- 制度の説明（活動内容・在留期間）は、出入国在留管理庁など**公式ページの日本語の文言をそのまま**掲載しています。
  法律の文言は訳し方で意味が変わるため、独自に翻訳・要約していません。
- 掲載している文言が公式ページの本文に実在するかを、公開前に機械的に照合しています。
- 公式ページに書かれていない項目は、推測で埋めず「記載なし（確認中）」と明示しています
  （現在、就労の可否が確認中のもの ${unconfirmed} 件）。
- 個別の申請についての判断（「この在留資格が取れる」など）は行いません。制度の説明と公式窓口の案内に徹しています。

## 在留資格の一覧（${records.length}件）

${SITE_URL}/visa/

${lines}

## 出典

出入国在留管理庁「在留資格一覧表」ほか公式ページ（最終確認日 ${checked}）
`;
}

function build404() {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found / ページが見つかりません | Settle in Japan</title>
<meta name="robots" content="noindex">
<style>
body{margin:0;background:#f2f4f7;color:#16212e;font:16px/1.8 "Hiragino Sans","Yu Gothic",system-ui,sans-serif;
display:grid;place-items:center;min-height:100vh;padding:24px}
.box{background:#fff;border:1px solid #dde3ea;padding:32px;max-width:32rem;text-align:center}
h1{font-size:1.3rem;margin:0 0 12px}
p{color:#4a586a;margin:0 0 8px}
a{color:#23438a}
@media(prefers-color-scheme:dark){
body{background:#11161d;color:#e9eef4}.box{background:#181f28;border-color:#2a3340}p{color:#aab6c4}a{color:#93b2ee}}
</style>
</head>
<body>
<div class="box">
<h1>Page not found / ページが見つかりません</h1>
<p>The page you are looking for is not here. It may have been moved.</p>
<p>お探しのページは見つかりませんでした。</p>
<p><a href="/">Top / トップへ</a> ・ <a href="/visa/">Residence statuses / 在留資格の一覧</a></p>
</div>
</body>
</html>
`;
}

function main() {
  const records = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const checked = records.map(r => r.source_checked_at).sort().pop();
  const today = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap(records, today));
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), buildLlmsTxt(records, checked));
  fs.writeFileSync(path.join(ROOT, '404.html'), build404());

  console.log(`sitemap.xml: ${pagePaths(records).length}件のURL`);
  console.log('llms.txt / 404.html も書き出しました');
}

if (require.main === module) main();

module.exports = { pagePaths, buildSitemap, buildLlmsTxt, build404 };
