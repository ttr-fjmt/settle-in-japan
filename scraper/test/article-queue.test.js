'use strict';

/**
 * 毎日1本ずつ記事を出す仕組みの見張り。
 *
 * 題材リスト（data/article-queue.json）は、自動更新が「次に何を書くか」を決める唯一のもと。
 * ここが崩れると、同じ記事を二度書いたり、題材が尽きたことに気づけなかったりする。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { shouldPublishToday, pickTopic, TARGET_COUNT } = require('../write-next-article');

const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'article-queue.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));
const plan = fs.readFileSync(path.join(ROOT, 'docs', 'article-plan.md'), 'utf8');
const articleIds = fs
  .readdirSync(path.join(ROOT, 'data', 'articles'))
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace(/\.json$/, ''));

test('題材は100本あり、番号もIDも重なっていない', () => {
  assert.strictEqual(queue.length, TARGET_COUNT, '題材の数が100ではありません');
  assert.strictEqual(new Set(queue.map(t => t.id)).size, queue.length, '同じIDの題材があります');
  assert.strictEqual(new Set(queue.map(t => t.n)).size, queue.length, '同じ番号の題材があります');
  queue.forEach((t, i) => assert.strictEqual(t.n, i + 1, `${t.id}: 番号が並んでいません`));
});

test('題材リストと、docs/article-plan.md の題目が一致している', () => {
  // 人が読む一覧（article-plan.md）と、機械が読む一覧（article-queue.json）がずれると、
  // 「書いたつもりの題材」と「実際に書かれる題材」が食い違う。
  const missing = queue.filter(t => !plan.includes(t.title_ja)).map(t => `#${t.n} ${t.title_ja}`);
  assert.deepStrictEqual(missing, [], '\n一覧に無い題材:\n' + missing.join('\n'));
});

test('公開済みの印と、実際の記事ファイルが一致している', () => {
  const marked = queue.filter(t => t.status === 'published').map(t => t.id).sort();
  assert.deepStrictEqual(
    marked,
    articleIds.slice().sort(),
    '題材リストの「公開済み」と data/articles/ の中身が食い違っています'
  );
});

test('題材が挙げている出典は、すべて出典リストにある', () => {
  const known = new Set(sources.map(s => s.id));
  const unknown = [];
  for (const topic of queue) {
    for (const id of topic.sources) {
      if (!known.has(id)) unknown.push(`${topic.id}: ${id}`);
    }
  }
  assert.deepStrictEqual(unknown, [], '\n' + unknown.join('\n'));
});

test('公開のペースは、100本までは毎日・その後は週1本', () => {
  assert.strictEqual(shouldPublishToday(5).publish, true, '100本未満は毎日書く');
  assert.strictEqual(shouldPublishToday(99).publish, true, '100本未満は毎日書く');

  // 2026-09-21 は月曜日（日本時間）
  const monday = new Date('2026-09-21T03:00:00Z');
  const tuesday = new Date('2026-09-22T03:00:00Z');
  assert.strictEqual(shouldPublishToday(100, monday).publish, true, '100本到達後の月曜は書く');
  assert.strictEqual(shouldPublishToday(100, tuesday).publish, false, '100本到達後の平日は書かない');
});

test('出典が取れていない題材は、次の1本に選ばれない', () => {
  // 出典待ちの題材を選んでしまうと、本文の無いまま書くことになる。
  const { topic } = pickTopic(queue);
  if (topic) {
    assert.ok(topic.sources.length > 0, `${topic.id}: 出典が登録されていない題材が選ばれました`);
    for (const id of topic.sources) {
      assert.ok(
        fs.existsSync(path.join(ROOT, 'data', 'raw', `${id}.txt`)),
        `${topic.id}: ${id} の本文が取得されていません`
      );
    }
  }
});

test('すでに書いた記事は、もう一度選ばれない', () => {
  const { topic } = pickTopic(queue);
  if (topic) assert.ok(!articleIds.includes(topic.id), `${topic.id}: すでに公開済みです`);
});
