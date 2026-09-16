'use strict';

/**
 * data/articles/*.json から解説記事のページを書き出す。
 *
 *   /guide/            … 記事の一覧
 *   /guide/<id>/       … 記事
 *
 * 【記事の作り】
 * 本文（自分たちの言葉）と、引用（公式ページの文言そのまま）を分けて持つ。
 *   - 引用は data/raw/<source_id>.txt に実在するかを npm test が照合する
 *   - 本文に数字（14日、3月など）を書くときは、その数字を含む引用がその節にあること
 * この2つで「公式に書かれていないことを書かない」を機械的に守る。
 *
 * 英語と日本語を並べて書く。読者は日本語が読めない人が中心だが、
 * 引用だけは日本語のまま見せる（窓口でそのまま見せられるようにするため。翻訳すると意味が変わる）。
 *
 * 実行例:
 *   node generate-article-pages.js
 *   node generate-article-pages.js --dry-run
 */

const fs = require('fs');
const path = require('path');

const { layout, escape, SITE_NAME, SITE_URL } = require('./lib/page-layout');

const ROOT = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'data', 'articles');
const SOURCES_PATH = path.join(ROOT, 'data', 'sources.json');

/** 記事をすべて読む（公開日の新しい順）。 */
function readArticles(dir = ARTICLES_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
}

function readSources() {
  return JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));
}

/** 引用の見せ方。公式の日本語をそのまま出し、どこから取ったかを必ず添える。 */
function quoteBlock(quote, sources) {
  const source = sources.find(s => s.id === quote.source_id);
  const label = source ? `${source.publisher}「${source.title}」` : quote.source_id;
  const href = source ? source.url : '#';
  return `<blockquote class="quote">
  <p>${escape(quote.text)}</p>
  <cite><a href="${escape(href)}" rel="nofollow">${escape(label)}</a></cite>
</blockquote>`;
}

function buildArticlePage(article, sources) {
  const sections = article.sections
    .map(section => {
      const paragraphs = section.body
        .map(
          p => `<p class="en">${escape(p.en)}</p>
<p class="ja">${escape(p.ja)}</p>`
        )
        .join('\n');
      const quotes = (section.quotes || []).map(q => quoteBlock(q, sources)).join('\n');
      return `<section>
<h2>${escape(section.heading_en)} <span class="ja">/ ${escape(section.heading_ja)}</span></h2>
${paragraphs}
${quotes}
</section>`;
    })
    .join('\n');

  const used = sources.filter(s => article.sources.includes(s.id));
  const sourceList = used
    .map(
      s => `<li>${escape(s.publisher)}「<a href="${escape(s.url)}" rel="nofollow">${escape(s.title)}</a>」</li>`
    )
    .join('\n');

  const body = `
<article>
<h1>${escape(article.title_en)}<span class="ja">${escape(article.title_ja)}</span></h1>
<p class="lead">${escape(article.description)}</p>

<p class="note">This page explains what the official pages say, quoting them in Japanese. It does not give advice on individual cases. Show the quoted Japanese at the counter if it helps.<br>
このページは公式ページに書かれていることを、日本語の原文を引用しながら説明しています。個別の事情についての判断はしません。窓口では引用部分をそのまま見せてください。</p>

${sections}

<div class="source">
<p>Sources / 出典</p>
<ul>
${sourceList}
</ul>
<p>Last checked / 最終確認日: ${escape(article.published_at)}</p>
</div>
<p><a href="/guide/">&larr; All guides / 記事の一覧</a></p>
</article>
`;
  return layout({
    title: `${article.title_en}（${article.title_ja}）| ${SITE_NAME}`,
    description: article.description,
    canonical: `${SITE_URL}/guide/${article.id}/`,
    body,
  });
}

function buildIndexPage(articles) {
  const items = articles
    .map(
      a => `<li class="card">
  <a href="/guide/${escape(a.id)}/"><strong>${escape(a.title_en)}</strong></a>
  <span class="ja">${escape(a.title_ja)}</span>
  <p>${escape(a.description)}</p>
</li>`
    )
    .join('\n');

  const body = `
<h1>Guides<span class="ja">手続きの解説</span></h1>
<p class="lead">Step-by-step explanations of the procedures, quoting the official pages.<br>
手続きのやり方を、公式ページを引用しながら順を追って説明します。</p>
<ul class="cards">
${items}
</ul>
`;
  return layout({
    title: `Guides | ${SITE_NAME}`,
    description: '日本で暮らしはじめるための手続きを、公式ページの記載にもとづいて解説します。',
    canonical: `${SITE_URL}/guide/`,
    body,
  });
}

function main() {
  const articles = readArticles();
  if (articles.length === 0) {
    console.log('記事がありません（data/articles/ が空）');
    return;
  }
  const sources = readSources();
  const files = [
    { path: path.join('guide', 'index.html'), html: buildIndexPage(articles) },
    ...articles.map(a => ({
      path: path.join('guide', a.id, 'index.html'),
      html: buildArticlePage(a, sources),
    })),
  ];

  if (process.argv.includes('--dry-run')) {
    console.log(`[DRY RUN] ${files.length}ページ`);
    files.forEach(f => console.log('  ' + f.path));
    return;
  }
  for (const f of files) {
    const full = path.join(ROOT, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.html);
  }
  console.log(`記事${articles.length}本と一覧を書き出しました`);
}

if (require.main === module) main();

module.exports = { readArticles, buildArticlePage, buildIndexPage };
