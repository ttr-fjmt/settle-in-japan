'use strict';

/**
 * 多言語対応の見張り。
 *
 * 【いちばん止めたいこと】
 * 公式の引用が訳されること。訳した引用は窓口で通じず、「公式にそう書いてある」が崩れる。
 *
 * 【次に止めたいこと】
 * - 訳が無い言語を hreflang に書くこと（404を指してしまう）
 * - 訳が無いのに、その言語のページを作ってしまうこと（元の言語のまま出てしまう）
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { LOCALES, EXTRA_LOCALES, UI_SOURCE, UI_KEYS } = require('../lib/locales');
const { checkTranslatedArticle, checkUi } = require('../lib/translation-guards');
const { alternatesFor, localesWithArticle, readyLocales } = require('../lib/translations');
const { localePages } = require('../generate-locale-pages');
const { readArticles, buildArticlePage } = require('../generate-article-pages');
const { pagePaths } = require('../generate-sitemap');

const articles = readArticles();
const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));

test('対応言語の定義がそろっている', () => {
  const codes = new Set();
  for (const locale of LOCALES) {
    assert.ok(!codes.has(locale.code), `言語コードが重複: ${locale.code}`);
    codes.add(locale.code);
    assert.ok(locale.label, `${locale.code}: 画面に出す名前が無い`);
    assert.ok(locale.htmlLang, `${locale.code}: htmlLang が無い`);
    assert.ok(locale.hreflang, `${locale.code}: hreflang が無い`);
    if (!locale.isDefault) assert.match(locale.path, /^\/[a-z-]+$/, `${locale.code}: パスの形が違う`);
  }
  assert.strictEqual(LOCALES.filter(l => l.isDefault).length, 1, '既定の言語は1つ');
});

test('公式の引用を訳すと、検査に落ちる', () => {
  const original = {
    id: 'x',
    sections: [
      {
        heading_en: 'A',
        heading_ja: 'あ',
        body: [{ en: 'within 14 days', ja: '14日以内' }],
        quotes: [{ source_id: 's', text: '変更が生じた日から１４日以内' }],
      },
    ],
  };
  const base = { id: 'x', title: 'X', description: 'd' };

  const ok = {
    ...base,
    sections: [{ heading: 'A', body: ['trong vòng 14 ngày'], quotes: ['変更が生じた日から１４日以内'] }],
  };
  assert.deepStrictEqual(checkTranslatedArticle(original, ok, { code: 'vi' }), []);

  const translatedQuote = {
    ...base,
    sections: [{ heading: 'A', body: ['trong vòng 14 ngày'], quotes: ['trong vòng 14 ngày'] }],
  };
  assert.ok(
    checkTranslatedArticle(original, translatedQuote, { code: 'vi' }).some(p => p.includes('引用')),
    '訳された引用が素通りしています'
  );
});

test('数字が変わると、検査に落ちる', () => {
  const original = {
    id: 'x',
    sections: [
      { heading_en: 'A', heading_ja: 'あ', body: [{ en: '14 days', ja: '14日以内' }], quotes: [] },
    ],
  };
  const wrong = {
    id: 'x',
    title: 'X',
    description: 'd',
    sections: [{ heading: 'A', body: ['15 ngày'], quotes: [] }],
  };
  assert.ok(
    checkTranslatedArticle(original, wrong, { code: 'vi' }).some(p => p.includes('数字')),
    '数字の食い違いが素通りしています'
  );
});

test('節や段落が減ると、検査に落ちる', () => {
  const original = {
    id: 'x',
    sections: [
      { heading_en: 'A', heading_ja: 'あ', body: [{ en: 'a', ja: 'あ' }, { en: 'b', ja: 'い' }], quotes: [] },
      { heading_en: 'B', heading_ja: 'い', body: [{ en: 'c', ja: 'う' }], quotes: [] },
    ],
  };
  const dropped = {
    id: 'x',
    title: 'X',
    description: 'd',
    sections: [{ heading: 'A', body: ['a'], quotes: [] }],
  };
  assert.ok(checkTranslatedArticle(original, dropped, { code: 'vi' }).length > 0, '訳し飛ばしが素通り');
});

test('画面の文言は、すべて訳されていないと落ちる', () => {
  const partial = { ...UI_SOURCE, nav_visa: 'Tư cách lưu trú' };
  const problems = checkUi(UI_SOURCE, partial, { code: 'vi' });
  assert.ok(problems.length > 0, '日本語のままの文言が素通りしています');
  assert.ok(checkUi(UI_SOURCE, {}, { code: 'vi' }).length === UI_KEYS.length, '訳し漏れを数えられていない');
});

test('訳が無い言語のページは作らない', () => {
  const ready = readyLocales().map(l => l.code);
  const built = localePages({ articles, records }).map(f => f.path.split(path.sep)[0]);
  for (const dir of new Set(built)) {
    const locale = EXTRA_LOCALES.find(l => l.path === '/' + dir);
    assert.ok(locale, `知らない言語のページがあります: /${dir}/`);
    assert.ok(ready.includes(locale.code), `${locale.code}: 訳が無いのにページを作っています`);
  }
});

test('訳が無い言語を hreflang に出さない', () => {
  // 404を指す hreflang は、検索エンジンに誤った対応関係を教えてしまう。
  for (const article of articles) {
    const codes = localesWithArticle(article.id);
    const html = buildArticlePage(article, sources);
    for (const locale of EXTRA_LOCALES) {
      if (codes.has(locale.code)) continue;
      assert.ok(
        !html.includes(`href="https://settle-in-japan.net${locale.path}/guide/${article.id}/"`),
        `${article.id}: 訳が無い ${locale.code} へのリンクが出ています`
      );
    }
  }
});

test('サイトマップと、実際に作る言語ページが一致している', () => {
  const built = localePages({ articles, records }).map(f => '/' + f.path.replace(/index\.html$/, ''));
  const paths = pagePaths(records, articles);
  for (const p of built) assert.ok(paths.includes(p), `サイトマップに ${p} が無い`);
});

test('訳した記事には、原文の印と翻訳日が入っている', () => {
  // 原文が変わったのに訳が古いまま、を見つけるための印。
  for (const locale of readyLocales()) {
    const dir = path.join(ROOT, 'data', 'translations', locale.code, 'articles');
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      assert.ok(data.source_hash, `${locale.code}/${file}: 原文の印が無い`);
      assert.ok(data.translated_at, `${locale.code}/${file}: 翻訳日が無い`);
    }
  }
});
