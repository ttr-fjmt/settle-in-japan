'use strict';

/**
 * 記事が「公式に書かれていることだけ」を書いているかを見張る。
 *
 * 検査の中身は lib/article-guards.js にある（毎日の自動更新でも同じ検査を使うため）。
 * ここでは「掲載してある記事が全部その検査を通ること」と、
 * 「書き出したページが記事データと一致していること」を確かめる。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { checkArticle, checkNumbers, checkQuotes } = require('../lib/article-guards');
const { readArticles, buildArticlePage } = require('../generate-article-pages');

const ROOT = path.join(__dirname, '..', '..');
const articles = readArticles();
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));

test('記事が1本以上ある', () => {
  assert.ok(articles.length > 0, 'data/articles/ に記事がありません');
});

test('掲載中の記事が、すべて公式照合の検査を通る', () => {
  const problems = [];
  for (const article of articles) {
    for (const problem of checkArticle(article, { sources })) {
      problems.push(`${article.id}: ${problem}`);
    }
  }
  assert.deepStrictEqual(problems, [], '\n' + problems.join('\n'));
});

test('引用を1文字でも言い換えると、検査に落ちる', () => {
  // この検査そのものが効いていることを確かめる（落ちない検査は無いのと同じ）。
  const article = JSON.parse(JSON.stringify(articles[0]));
  const section = article.sections.find(s => (s.quotes || []).length > 0);
  section.quotes[0].text = section.quotes[0].text.replace(/。$/, '') + 'など。';
  assert.ok(checkQuotes(article).length > 0, '言い換えた引用が素通りしています');
});

test('引用に無い数字を本文に書くと、検査に落ちる', () => {
  const article = JSON.parse(JSON.stringify(articles[0]));
  article.sections[0].body[0].ja += 'これは37日以内に行います。';
  const problems = checkNumbers(article);
  assert.ok(problems.some(p => p.includes('37日')), '裏づけの無い数字が素通りしています');
});

test('記事のページに、出典と最終確認日が出ている', () => {
  for (const article of articles) {
    const html = buildArticlePage(article, sources);
    assert.ok(html.includes(article.published_at), `${article.id}: 最終確認日が無い`);
    for (const id of article.sources) {
      const source = sources.find(s => s.id === id);
      assert.ok(html.includes(source.url), `${article.id}: ${id} の出典URLが無い`);
    }
  }
});

test('書き出した記事のページが、いまのデータと一致している', () => {
  for (const article of articles) {
    const file = path.join(ROOT, 'guide', article.id, 'index.html');
    if (!fs.existsSync(file)) continue;
    assert.strictEqual(
      fs.readFileSync(file, 'utf8'),
      buildArticlePage(article, sources),
      `${article.id}: ページが古いです。cd scraper && npm run articles で作り直してください`
    );
  }
});
