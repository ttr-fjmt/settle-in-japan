'use strict';

/**
 * 保存してある訳（data/translations/）を読む係。
 *
 * ページを作る側（既定の英語＋日本語のページ／各言語のページ）の両方から使う。
 * 「その記事の訳がどの言語にあるか」を1か所で持ち、hreflang（同じ内容の別言語）の
 * 出し方がずれないようにする。訳が無い言語を hreflang に書くと、404 を指すことになる。
 */

const fs = require('node:fs');
const path = require('node:path');

const { LOCALES, EXTRA_LOCALES } = require('./locales');

const ROOT = path.join(__dirname, '..', '..');
const TRANSLATIONS = path.join(ROOT, 'data', 'translations');

const readJson = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

/** その言語の、画面の文言と記事の訳。 */
function loadLocale(locale) {
  const ui = readJson(path.join(TRANSLATIONS, locale.code, 'ui.json'));
  const dir = path.join(TRANSLATIONS, locale.code, 'articles');
  const articles = fs.existsSync(dir)
    ? Object.fromEntries(
        fs
          .readdirSync(dir)
          .filter(f => f.endsWith('.json'))
          .map(f => {
            const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            return [data.id, data];
          })
      )
    : {};
  return { ui, articles };
}

/** 画面の文言と記事の訳がそろっている言語（ページを作れる言語）。 */
function readyLocales() {
  return EXTRA_LOCALES.filter(locale => loadLocale(locale).ui);
}

/** その記事の訳がある言語のコード。 */
function localesWithArticle(articleId) {
  return new Set(
    readyLocales()
      .filter(locale => loadLocale(locale).articles[articleId])
      .map(locale => locale.code)
  );
}

/**
 * 同じページが存在する言語の一覧。
 * codes を渡すと、その言語だけに絞る（記事ページ用）。渡さなければ、作れる言語すべて。
 */
function alternatesFor(pagePath, codes = null) {
  return LOCALES.filter(locale => {
    if (locale.isDefault) return true;
    if (!readyLocales().some(l => l.code === locale.code)) return false;
    return codes ? codes.has(locale.code) : true;
  }).map(locale => ({
    code: locale.code,
    hreflang: locale.hreflang,
    label: locale.label,
    href: `${locale.path}${pagePath}` || '/',
  }));
}

module.exports = { loadLocale, readyLocales, localesWithArticle, alternatesFor, TRANSLATIONS };
