'use strict';

/**
 * 対応言語のページを書き出す（/easy/ と /vi/）。
 *
 *   /<言語>/            … その言語のトップ
 *   /<言語>/guide/      … 記事の一覧
 *   /<言語>/guide/<id>/ … 記事
 *
 * 【この言語のページで守ること】
 * - **公式の引用は日本語のまま**。引用の手前に「ここは日本語のままです」とその言語で断る
 * - 訳が無い記事のページは**作らない**。中途半端に元の言語のまま出さない
 *   （訳が古い／無いページを出すより、無いほうがよい）
 * - 出典と最終確認日は、元の記事と同じものを出す
 *
 * 実行例:
 *   node generate-locale-pages.js
 */

const fs = require('node:fs');
const path = require('node:path');

const { layout, escape, icon, SITE_NAME, SITE_URL } = require('./lib/page-layout');
const { EXTRA_LOCALES } = require('./lib/locales');
const { readArticles } = require('./generate-article-pages');
const { loadLocale, alternatesFor } = require('./lib/translations');

const ROOT = path.join(__dirname, '..');

function buildArticlePage(article, translated, locale, ui, sources, alternates) {
  const sections = article.sections
    .map((section, i) => {
      const t = translated.sections[i];
      const paragraphs = t.body.map(p => `<p>${escape(p)}</p>`).join('\n');
      const quotes = (section.quotes || [])
        .map(quote => {
          const source = sources.find(s => s.id === quote.source_id);
          const label = source ? `${source.publisher}「${source.title}」` : quote.source_id;
          return `<blockquote class="quote" lang="ja">
  <p>${escape(quote.text)}</p>
  <cite><a href="${escape(source ? source.url : '#')}" rel="nofollow">${escape(label)}</a></cite>
</blockquote>`;
        })
        .join('\n');
      return `<section>
<h2>${icon(section.icon || 'guide', 20)}${escape(t.heading)}</h2>
${paragraphs}
${quotes}
</section>`;
    })
    .join('\n');

  const used = sources.filter(s => article.sources.includes(s.id));
  const body = `
<article>
<h1>${escape(translated.title)}</h1>
<p class="lead">${escape(translated.description)}</p>

<p class="note">${escape(ui.quote_note)}<br>
<span lang="ja">${escape(ui.translated_note)}</span></p>

${sections}

<div class="source">
<p>${escape(ui.sources_label)}</p>
<ul>
${used.map(s => `<li lang="ja">${escape(s.publisher)}「<a href="${escape(s.url)}" rel="nofollow">${escape(s.title)}</a>」</li>`).join('\n')}
</ul>
<p>${escape(ui.last_checked)}: ${escape(article.published_at)}</p>
</div>
<p><a href="${escape(locale.path)}/guide/">&larr; ${escape(ui.back_to_guides)}</a></p>
</article>
`;
  return layout({
    title: `${translated.title} | ${SITE_NAME}`,
    description: translated.description,
    canonical: `${SITE_URL}${locale.path}/guide/${article.id}/`,
    locale,
    ui,
    alternates,
    body,
  });
}

function buildIndexPage(entries, locale, ui, alternates) {
  const items = entries
    .map(
      ({ article, translated }) => `<li class="card"><a href="${escape(locale.path)}/guide/${escape(article.id)}/">
  <span class="head">${icon(article.icon || 'guide')}${escape(translated.title)}</span>
  <p>${escape(translated.description)}</p>
</a></li>`
    )
    .join('\n');

  const body = `
<h1>${escape(ui.guides_title)}</h1>
<p class="lead">${escape(ui.guides_lead)}</p>
<ul class="cards">
${items}
</ul>
<p class="note">${escape(ui.no_advice)}</p>
`;
  return layout({
    title: `${ui.guides_title} | ${SITE_NAME}`,
    description: ui.guides_lead,
    canonical: `${SITE_URL}${locale.path}/guide/`,
    locale,
    ui,
    alternates,
    body,
  });
}

function buildTopPage(entries, locale, ui, alternates, records) {
  const first = entries[0];
  const cards = entries
    .map(
      ({ article, translated }) => `<li class="card"><a href="${escape(locale.path)}/guide/${escape(article.id)}/">
  <span class="head">${icon(article.icon || 'guide')}${escape(translated.title)}</span>
  <p>${escape(translated.description)}</p>
</a></li>`
    )
    .join('\n');

  const body = `
<h1>${escape(SITE_NAME)}<span class="ja">${escape(ui.site_tagline)}</span></h1>

${
  first
    ? `<div class="start">
  <div class="start-body">
    <span class="start-kicker">${escape(ui.top_start_kicker)}</span>
    <p class="start-title">${escape(first.translated.title)}</p>
    <p class="start-desc">${escape(first.translated.description)}</p>
    <a class="start-go" href="${escape(locale.path)}/guide/${escape(first.article.id)}/">${escape(ui.nav_guide)} &rarr;</a>
  </div>
  <div class="start-art">${icon('clock', 92)}</div>
</div>`
    : ''
}

<h2 class="tiles-h">${escape(ui.top_find)}</h2>
<ul class="cards">
${cards}
</ul>

<p class="note">${escape(ui.quote_note)}</p>
<p class="note">${escape(ui.no_advice)}<br>
<a href="/visa/">${escape(ui.nav_visa)}（English / 日本語・${records.length}）</a></p>
`;
  return layout({
    title: `${SITE_NAME} — ${ui.site_tagline}`,
    description: ui.site_tagline,
    canonical: `${SITE_URL}${locale.path}/`,
    locale,
    ui,
    alternates,
    body,
  });
}

/** 書き出すページの一覧（テストからも使う）。 */
function localePages({ articles = readArticles(), records = null } = {}) {
  const visa = records || JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
  const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));
  const files = [];

  // 記事ごとに「訳がある言語」を集める（hreflang を正しく出すため）
  const translatedBy = new Map(articles.map(a => [a.id, new Set()]));
  const loaded = new Map();
  for (const locale of EXTRA_LOCALES) {
    const data = loadLocale(locale);
    loaded.set(locale.code, data);
    for (const id of Object.keys(data.articles)) {
      if (translatedBy.has(id)) translatedBy.get(id).add(locale.code);
    }
  }

  for (const locale of EXTRA_LOCALES) {
    const { ui, articles: translations } = loaded.get(locale.code);
    if (!ui) continue; // 画面の文言が無い言語はページを作らない

    const entries = articles
      .filter(a => translations[a.id])
      .map(a => ({ article: a, translated: translations[a.id] }));
    if (entries.length === 0) continue;

    const topAlternates = alternatesFor('/');
    files.push({
      path: path.join(locale.path.replace(/^\//, ''), 'index.html'),
      html: buildTopPage(entries, locale, ui, topAlternates, visa),
    });
    files.push({
      path: path.join(locale.path.replace(/^\//, ''), 'guide', 'index.html'),
      html: buildIndexPage(entries, locale, ui, alternatesFor('/guide/')),
    });
    for (const entry of entries) {
      files.push({
        path: path.join(locale.path.replace(/^\//, ''), 'guide', entry.article.id, 'index.html'),
        html: buildArticlePage(
          entry.article,
          entry.translated,
          locale,
          ui,
          sources,
          alternatesFor(`/guide/${entry.article.id}/`, translatedBy.get(entry.article.id))
        ),
      });
    }
  }
  return files;
}

function main() {
  const files = localePages();
  if (files.length === 0) {
    console.log('訳がまだ無いため、言語ページは作りませんでした（node translate.js を先に実行）');
    return;
  }
  for (const file of files) {
    const full = path.join(ROOT, file.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.html);
  }
  console.log(`言語ページを${files.length}枚書き出しました`);
  files.forEach(f => console.log('  /' + f.path.replace(/index\.html$/, '')));
}

if (require.main === module) main();

module.exports = { localePages };
