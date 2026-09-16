'use strict';

/**
 * 右下の道案内（どこから始める？）の見張り。
 *
 * 道案内はサイト全体の入口になるので、壊れ方が目立つ。とくに次の2つを止める。
 *   1. まだ書いていないページへのリンク（押すと何も無い＝いちばん困る）
 *   2. 題材の入れ忘れ（100本のうち、どの入口からもたどり着けないものが出る）
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const {
  STAGES,
  assignedTopicNumbers,
  buildGuideData,
  guideData,
  guideWidgetHtml,
} = require('../lib/guide-widget');
const { buildTopPage, buildListPage, buildDetailPage } = require('../generate-visa-pages');
const { buildArticlePage, buildIndexPage, readArticles } = require('../generate-article-pages');

const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'article-queue.json'), 'utf8'));
const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));
const articles = readArticles();
const data = guideData();

test('100本の題材が、ちょうど1か所ずつ道案内に入っている', () => {
  const assigned = assignedTopicNumbers();
  const missing = queue.filter(t => !assigned.includes(t.n)).map(t => `#${t.n} ${t.title_ja}`);
  const duplicated = assigned.filter((n, i) => assigned.indexOf(n) !== i);
  assert.deepStrictEqual(missing, [], '\nどの入口からもたどり着けない題材:\n' + missing.join('\n'));
  assert.deepStrictEqual(duplicated, [], '\n2か所に入っている題材: ' + duplicated.join(', '));
});

test('道案内のリンク先が、すべて実際にあるページを指している', () => {
  const dead = [];
  for (const stage of data.stages) {
    for (const need of stage.needs) {
      for (const item of need.items) {
        if (!item.href) continue;
        const file = path.join(ROOT, item.href.replace(/^\//, ''), 'index.html');
        if (!fs.existsSync(file)) dead.push(item.href);
      }
    }
  }
  for (const visa of data.visas) {
    const file = path.join(ROOT, 'visa', visa.id, 'index.html');
    if (!fs.existsSync(file)) dead.push(`/visa/${visa.id}/`);
  }
  assert.deepStrictEqual(dead, [], '\n押しても何も無いリンク:\n' + dead.join('\n'));
});

test('まだ書いていない題材は、リンクにせず「準備中」として持つ', () => {
  const publishedIds = new Set(articles.map(a => a.id));
  const wrong = [];
  for (const stage of data.stages) {
    for (const need of stage.needs) {
      for (const item of need.items) {
        if (item.href && !publishedIds.has(item.href.split('/')[2])) wrong.push(item.href);
      }
    }
  }
  assert.deepStrictEqual(wrong, [], '公開していない記事へのリンクがあります:\n' + wrong.join('\n'));

  const soon = data.stages.flatMap(s => s.needs.flatMap(n => n.items)).filter(i => !i.href);
  assert.ok(soon.length > 0, 'このテストの前提（未公開の題材がある）が崩れています');
  assert.ok(soon.every(i => i.ja && !i.en), '準備中の項目は日本語の題名だけを持つ');
});

test('どのページにも道案内が入っている', () => {
  const pages = [
    ['トップ', buildTopPage(records)],
    ['在留資格の一覧', buildListPage(records)],
    ['在留資格の詳細', buildDetailPage(records[0])],
    ['記事の一覧', buildIndexPage(articles)],
    ['記事', buildArticlePage(articles[0], sources)],
  ];
  for (const [name, html] of pages) {
    assert.ok(html.includes('id="guide-widget"'), `${name}: 道案内が入っていない`);
    assert.ok(html.includes('どこから始める？'), `${name}: ボタンの文言が入っていない`);
  }
});

test('在留資格の選択肢に、掲載中の在留資格がすべて入っている', () => {
  assert.strictEqual(data.visas.length, records.length);
  for (const record of records) {
    assert.ok(data.visas.some(v => v.id === record.id), `${record.name_ja} が選択肢に無い`);
  }
});

test('道案内は、個別の判断をする書き方をしていない', () => {
  const html = guideWidgetHtml(data);
  for (const word of ['あなたは', 'あなたの場合', '取得できます', '申請できます']) {
    assert.ok(!html.includes(word), `道案内に「${word}」が入っている`);
  }
  assert.ok(html.includes('個別の判断はしません'), '個別の判断をしない旨の断りが無い');
});

test('題名に < が入っても、ページが壊れない', () => {
  // データは <script> の中に書き込まれる。逃がし忘れるとページ全体が壊れる。
  const broken = buildGuideData({
    queue: [{ n: 1, id: 'x', title_ja: '</script><script>alert(1)</script>', phase: 'before-arrival' }],
    articles: [],
    records: [],
  });
  const html = guideWidgetHtml(broken);
  assert.ok(!html.includes('</script><script>alert(1)'), 'タグがそのまま書き込まれています');
  assert.ok(html.includes('\\u003c'), '< が逃がされていません');
});

test('段階と知りたいことに、英語と日本語の両方がある', () => {
  for (const stage of STAGES) {
    assert.ok(stage.label_en && stage.label_ja, `${stage.id}: 見出しが揃っていない`);
    for (const need of stage.needs) {
      assert.ok(need.en && need.ja, `${stage.id}/${need.id}: 見出しが揃っていない`);
      assert.ok(need.topics.length > 0, `${stage.id}/${need.id}: 題材が入っていない`);
    }
  }
});
