'use strict';

/**
 * ロゴとOGP画像（SNSに出る画像）まわりの約束を見張る。
 *
 * ここが抜けても画面上は何も起きない。リンクを貼ったときに初めて
 * 「画像が出ない」「他人のサイトのように見える」と分かる。だからテストで止める。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { ogpSlug, ogpUrl, ogpFile } = require('../lib/ogp');
const { pagePaths } = require('../generate-sitemap');
const { ogpTargets } = require('../generate-ogp-images');
const { buildTopPage, buildListPage, buildDetailPage } = require('../generate-visa-pages');
const { buildArticlePage, buildIndexPage, readArticles } = require('../generate-article-pages');

const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));
const articles = readArticles();

test('ページのパスから、OGP画像の名前が一意に決まる', () => {
  assert.strictEqual(ogpSlug('/'), 'top');
  assert.strictEqual(ogpSlug('/visa/'), 'visa');
  assert.strictEqual(ogpSlug('/visa/diplomat/'), 'visa-diplomat');
  assert.strictEqual(ogpSlug('/guide/first-14-days/'), 'guide-first-14-days');
  // 名前がぶつからないこと（ぶつかると、別のページの画像が出る）
  const slugs = pagePaths(records, articles).map(ogpSlug);
  assert.strictEqual(new Set(slugs).size, slugs.length, '同じ名前になるページがあります');
});

test('どのページにも、OGP画像とファビコンの指定が入っている', () => {
  const pages = [
    ['トップ', buildTopPage(records)],
    ['在留資格の一覧', buildListPage(records)],
    ['在留資格の詳細', buildDetailPage(records[0])],
    ['記事の一覧', buildIndexPage(articles)],
    ['記事', buildArticlePage(articles[0], sources)],
  ];
  for (const [name, html] of pages) {
    assert.ok(html.includes('property="og:image"'), `${name}: og:image が無い`);
    assert.ok(
      html.includes('content="https://settle-in-japan.net/assets/ogp/'),
      `${name}: og:image が絶対URLになっていない（相対パスだと読めないSNSがある）`
    );
    assert.ok(
      html.includes('name="twitter:card" content="summary_large_image"'),
      `${name}: 大きい画像で出す指定が無い`
    );
    assert.ok(html.includes('href="/favicon.svg"'), `${name}: ファビコンの指定が無い`);
    assert.ok(html.includes('href="/apple-touch-icon.png"'), `${name}: ホーム画面用の絵の指定が無い`);
  }
});

test('ページが指しているOGP画像が、実際に置いてある', () => {
  // 画像を作り忘れたままページだけ更新すると、SNSで画像の出ないリンクになる。
  const missing = pagePaths(records, articles)
    .map(p => ogpFile(p))
    .filter(f => !fs.existsSync(path.join(ROOT, f)));
  assert.deepStrictEqual(
    missing,
    [],
    '次の画像がありません。cd scraper && npm run ogp で作ってください:\n' + missing.join('\n')
  );
});

test('OGP画像を作る対象と、サイトに載っているページが一致している', () => {
  const targets = ogpTargets(records, articles).map(t => t.pagePath).sort();
  const pages = pagePaths(records, articles).slice().sort();
  assert.deepStrictEqual(targets, pages, 'ページと画像の作り方がずれています');
});

test('OGP画像は 1200×630 で作られている', () => {
  // SNS側が想定する大きさ。ずれると切り取られる。PNG の先頭から幅と高さを読む。
  for (const p of ['/', '/visa/', '/guide/']) {
    const buffer = fs.readFileSync(path.join(ROOT, ogpFile(p)));
    assert.strictEqual(buffer.readUInt32BE(16), 1200, `${p} の画像の幅が違う`);
    assert.strictEqual(buffer.readUInt32BE(20), 630, `${p} の画像の高さが違う`);
  }
});

test('ロゴのファイルが揃っている', () => {
  for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'assets/logo.svg']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} が無い`);
  }
  const ico = fs.readFileSync(path.join(ROOT, 'favicon.ico'));
  assert.strictEqual(ico.readUInt16LE(2), 1, 'favicon.ico がアイコンの形になっていない');
  assert.ok(
    ico.slice(22, 26).toString('hex') === '89504e47',
    'favicon.ico の中身がPNGになっていない'
  );
  const svg = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
  assert.ok(svg.includes('<svg') && svg.includes('Settle in Japan'), 'favicon.svg の中身が違う');
});

test('OGP画像のURLは、ページのURLから作られる', () => {
  assert.strictEqual(
    ogpUrl('/guide/residence-card/'),
    'https://settle-in-japan.net/assets/ogp/guide-residence-card.png'
  );
});
