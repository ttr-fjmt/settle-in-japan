'use strict';

/**
 * 対応言語のページを書き出す（/easy/ と /vi/）。
 *
 *   /<言語>/            … その言語のトップ
 *   /<言語>/guide/      … 記事の一覧
 *   /<言語>/guide/<id>/ … 記事
 *   /<言語>/visa/       … 在留資格の一覧
 *   /<言語>/visa/<id>/  … 在留資格
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
const { VISA_GROUP } = require('./lib/schema');
const { UI_SOURCE } = require('./lib/locales');
const { checkUi } = require('./lib/translation-guards');

const ROOT = path.join(__dirname, '..');

/** 就労・家族滞在の表示。値は画面の文言（ui）から取る。 */
const WORK_TONE = { yes: 'yes', no: 'no', depends: 'unknown', unknown: 'unknown' };
const FAMILY_TONE = { yes: 'yes', no: 'unknown', depends: 'unknown', unknown: 'unknown' };
const GROUP_ICON = { work: 'work', non_work: 'study', designated: 'designated', status_based: 'status' };

/**
 * 在留資格のページ（言語版）。
 *
 * **活動内容・在留期間・該当例は、元のレコードから日本語のまま出す。**
 * 訳すのは名前・説明・見出しだけ。訳した公式文言を窓口で見せても通じないため
 * （lib/locales.js の冒頭に理由を書いてある）。
 */
function buildVisaDetailPage(record, translated, locale, ui, alternates) {
  const official = text => `<span lang="ja">${escape(text)}</span>`;
  const body = `
<h1>${escape(translated.name)}<span class="ja" lang="ja">${escape(record.name_ja)}</span></h1>
<p class="lead">${icon(GROUP_ICON[record.group] || 'status', 18)} ${escape(ui[`group_${record.group}`] || '')}</p>
<p>${escape(translated.description)}</p>

<div class="card">
  <h3>${icon('guide', 16)}${escape(ui.visa_activities)}</h3>
  <ul class="official">
    ${record.activities_ja.map(a => `<li>${official(a)}</li>`).join('\n    ')}
  </ul>
</div>
${
  record.examples_ja
    ? `<div class="card"><h3>${icon('status', 16)}${escape(ui.visa_examples)}</h3><p class="official">${official(record.examples_ja)}</p></div>`
    : ''
}
<div class="card">
  <h3>${icon('clock', 16)}${escape(ui.visa_period)}</h3>
  <p class="official">${record.periods_ja.map(official).join('<br>')}</p>
</div>
<div class="card">
  <h3>${icon('work', 16)}${escape(ui.visa_work)}</h3>
  <p><span class="pill ${WORK_TONE[record.work_allowed] || 'unknown'}">${escape(ui[`work_${record.work_allowed}`] || '')}</span></p>
  <h3 style="margin-top:16px">${icon('home', 16)}${escape(ui.visa_family)}</h3>
  <p><span class="pill ${FAMILY_TONE[record.family_stay] || 'unknown'}">${escape(ui[`family_${record.family_stay}`] || '')}</span></p>
  <p style="font-size:.85rem;color:var(--ink-2);margin:6px 0 0">${escape(ui.visa_family_note)}</p>
</div>

<p class="note">${escape(ui.visa_official_note)}<br>
${escape(ui.translated_note)}</p>

<div class="source">
<p>${escape(ui.sources_label)}</p>
<ul>
<li lang="ja"><a href="${escape(record.source_url)}" rel="nofollow">出入国在留管理庁</a></li>
</ul>
<p>${escape(ui.last_checked)}: ${escape(record.source_checked_at)}</p>
</div>
<p><a href="${escape(locale.path)}/visa/">&larr; ${escape(ui.back_to_visa)}</a></p>
`;
  return layout({
    title: `${translated.name}（${record.name_ja}）| ${SITE_NAME}`,
    description: translated.description,
    canonical: `${SITE_URL}${locale.path}/visa/${record.id}/`,
    locale,
    ui,
    alternates,
    body,
  });
}

/** 在留資格の一覧（言語版）。分類ごとにまとめる。 */
function buildVisaListPage(records, visaTranslations, locale, ui, alternates) {
  const groups = VISA_GROUP.map(group => {
    const rows = records
      .filter(r => r.group === group)
      .map(record => {
        const t = visaTranslations[record.id];
        return `<li class="card"><a href="${escape(locale.path)}/visa/${escape(record.id)}/">
  <span class="head">${icon(GROUP_ICON[group] || 'status')}${escape(t.name)}<span class="ja" lang="ja">${escape(record.name_ja)}</span></span>
  <p>${escape(t.description)}</p>
</a></li>`;
      })
      .join('\n');
    if (!rows) return '';
    return `<h2 class="tiles-h">${icon(GROUP_ICON[group] || 'status', 20)}${escape(ui[`group_${group}`] || '')}</h2>
<ul class="cards">
${rows}
</ul>`;
  })
    .filter(Boolean)
    .join('\n');

  const body = `
<h1>${escape(ui.visa_title)}</h1>
<p class="lead">${escape(ui.visa_lead)}</p>
${groups}
<p class="note">${escape(ui.visa_official_note)}</p>
<p class="note">${escape(ui.no_advice)}</p>
`;
  return layout({
    title: `${ui.visa_title} | ${SITE_NAME}`,
    description: ui.visa_lead,
    canonical: `${SITE_URL}${locale.path}/visa/`,
    locale,
    ui,
    alternates,
    body,
  });
}


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
<a href="${escape(locale.path)}/visa/">${escape(ui.nav_visa)}（${records.length}）</a></p>
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

  // 在留資格のページを作れる言語（33件すべての訳がある言語だけ）。hreflang をここから出す。
  const visaLocales = new Set(
    EXTRA_LOCALES.filter(locale => {
      const data = loaded.get(locale.code);
      return data.ui && visa.every(record => data.visa[record.id]);
    }).map(locale => locale.code)
  );

  for (const locale of EXTRA_LOCALES) {
    const { ui, articles: translations, visa: visaTranslations } = loaded.get(locale.code);
    // 画面の文言が無い・足りない言語はページを作らない。
    // 文言を足したのに訳し直していないと、見出しが空のページができてしまう。
    if (!ui || checkUi(UI_SOURCE, ui, { code: locale.code, allowSameAsSource: true }).length > 0) {
      continue;
    }

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

    // 在留資格。訳が1件でも欠けていれば、その言語では一覧も詳細も作らない
    // （一部だけ英語のまま混ざったページを出さないため）。
    const visaReady = visa.every(record => visaTranslations[record.id]);
    if (!visaReady) continue;

    files.push({
      path: path.join(locale.path.replace(/^\//, ''), 'visa', 'index.html'),
      html: buildVisaListPage(visa, visaTranslations, locale, ui, alternatesFor('/visa/', visaLocales)),
    });
    for (const record of visa) {
      files.push({
        path: path.join(locale.path.replace(/^\//, ''), 'visa', record.id, 'index.html'),
        html: buildVisaDetailPage(
          record,
          visaTranslations[record.id],
          locale,
          ui,
          alternatesFor(`/visa/${record.id}/`, visaLocales)
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
