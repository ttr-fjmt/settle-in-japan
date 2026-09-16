'use strict';

/**
 * トップの入口タイル（用事ごとの分類）の見張り。
 *
 * ここが崩れると、「どのタイルからもたどり着けない記事」や
 * 「押しても何も無いタイル」ができる。どちらも画面を見ただけでは気づけない。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { CATEGORIES, assignedTopicNumbers, categorise, categoryOf } = require('../lib/categories');
const { ICON_PATHS } = require('../lib/icons');
const { buildTopPage } = require('../generate-visa-pages');
const { buildIndexPage, readArticles } = require('../generate-article-pages');

const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'article-queue.json'), 'utf8'));
const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
const articles = readArticles();

test('100本の題材が、ちょうど1つの分類に入っている', () => {
  const assigned = assignedTopicNumbers();
  const missing = queue.filter(t => !assigned.includes(t.n)).map(t => `#${t.n} ${t.title_ja}`);
  const duplicated = assigned.filter((n, i) => assigned.indexOf(n) !== i);
  assert.deepStrictEqual(missing, [], '\nどの入口にも入っていない題材:\n' + missing.join('\n'));
  assert.deepStrictEqual(duplicated, [], '\n2つの分類に入っている題材: ' + duplicated.join(', '));
});

test('分類の見た目（アイコン・英語・日本語）がそろっている', () => {
  const ids = new Set();
  for (const category of CATEGORIES) {
    assert.ok(!ids.has(category.id), `id が重複: ${category.id}`);
    ids.add(category.id);
    assert.ok(ICON_PATHS[category.icon], `${category.id}: アイコン "${category.icon}" が無い`);
    assert.ok(category.en && category.ja, `${category.id}: 英語か日本語の名前が無い`);
    assert.ok(category.topics.length > 0, `${category.id}: 題材が入っていない`);
  }
});

test('トップのタイルは、中身のあるものだけリンクにする', () => {
  const html = buildTopPage(records, 0, { queue, articles });
  const groups = categorise({ queue, articles });

  for (const group of groups) {
    const isVisa = group.id === 'visa';
    const count = isVisa ? records.length : group.count;
    const href = isVisa ? '/visa/' : `/guide/#${group.id}`;
    if (count > 0) {
      assert.ok(html.includes(`href="${href}"`), `${group.ja}: リンクになっていない`);
    } else {
      assert.ok(!html.includes(`href="${href}"`), `${group.ja}: 記事が無いのにリンクになっている`);
      assert.ok(html.includes('Coming soon / 準備中'), `${group.ja}: 準備中の表示が無い`);
    }
  }
  assert.strictEqual(
    (html.match(/<li class="tile(?: soon)?"/g) || []).length,
    CATEGORIES.length,
    'タイルの数が分類の数と合っていない'
  );
});

test('タイルの飛び先が、記事一覧に実在する', () => {
  // /guide/#health のような飛び先は、一覧側に id="health" が無いとどこにも飛ばない。
  const index = buildIndexPage(articles, { queue });
  for (const group of categorise({ queue, articles })) {
    if (group.id === 'visa' || group.count === 0) continue;
    assert.ok(index.includes(`id="${group.id}"`), `記事一覧に ${group.id} の見出しが無い`);
  }
});

test('記事一覧に、公開中の記事がちょうど1回ずつ出ている', () => {
  const index = buildIndexPage(articles, { queue });
  for (const article of articles) {
    // 右下の道案内も同じリンクを持っているので、一覧のカードだけを数える
    const count = (index.match(new RegExp(`<a href="/guide/${article.id}/"`, 'g')) || []).length;
    assert.strictEqual(count, 1, `${article.id}: 一覧に${count}回出ています（1回であるべき）`);
  }
});

test('記事の少ない分類から先に書く', () => {
  // 題材リストの順のまま書くと、入口タイルが1つずつしか埋まらない。
  const { pickTopic } = require('../write-next-article');
  const { topic } = pickTopic(queue);
  if (!topic) return; // 書ける題材が無いときは何も確かめない

  const counts = new Map(categorise({ queue, articles }).map(c => [c.id, c.count]));
  const chosen = categoryOf(topic.n);
  assert.ok(chosen, `${topic.id}: どの分類にも入っていない`);

  const ready = queue.filter(
    t => t.status === 'pending' && t.sources.length > 0 && categoryOf(t.n)
  );
  const smallest = Math.min(...ready.map(t => counts.get(categoryOf(t.n).id) ?? 0));
  assert.strictEqual(
    counts.get(chosen.id) ?? 0,
    smallest,
    `${topic.title_ja}（${chosen.ja}）より記事の少ない分類が残っています`
  );
});
