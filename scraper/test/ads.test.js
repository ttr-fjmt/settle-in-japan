'use strict';

/**
 * 広告の枠の見張り。
 *
 * 【いちばん止めたいこと】
 * 公式ページの引用のすぐ隣に広告が出ること。どれが公式の文言でどれが広告か分からなくなり、
 * 法律・手続きの情報では誤解のもとになる。置き場所は節と節の切れ目だけにする。
 *
 * 【次に止めたいこと】
 * 番号（data-ad-slot）が未設定なのに空の枠を書き出すこと。審査中に空欄が出てしまう。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { adSlot, slotId, readSlots, PLACEMENTS, ADSENSE_CLIENT } = require('../lib/ads');
const { buildArticlePage, readArticles } = require('../generate-article-pages');
const { buildDetailPage, buildTopPage } = require('../generate-visa-pages');

const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));
const articles = readArticles();

test('番号が未設定のときは、広告の枠を書き出さない', () => {
  for (const placement of PLACEMENTS) {
    assert.strictEqual(adSlot(placement, {}), '', `${placement}: 空の枠が出ている`);
    assert.strictEqual(adSlot(placement, { [placement]: '' }), '');
    assert.strictEqual(adSlot(placement, { [placement]: 'これは番号ではない' }), '');
  }
});

test('番号を入れると、正しい形の枠が出る', () => {
  const html = adSlot('top', { top: '1234567890' });
  assert.ok(html.includes(`data-ad-client="${ADSENSE_CLIENT}"`), '広告主IDが入っていない');
  assert.ok(html.includes('data-ad-slot="1234567890"'), '広告ユニット番号が入っていない');
  assert.ok(html.includes('adsbygoogle'), '読み込みの呼び出しが無い');
  assert.ok(html.includes('広告'), '「広告」と分かる表示が無い');
});

test('決めていない置き場所は使えない', () => {
  assert.throws(() => adSlot('どこか'), /決めていません/);
});

test('広告は、節の中に入らない（＝引用のすぐ隣に出ない）', () => {
  // 各節は引用で終わるため、節の中に広告を入れると引用の真下に出る。
  // 節の外（本文の前・出典の前）にだけ置く。
  const slots = { 'article-top': '1111111111', 'article-bottom': '2222222222' };
  const html = buildArticlePage(articles[0], sources, { slots });

  const inside = [...html.matchAll(/<section>([\s\S]*?)<\/section>/g)].filter(m =>
    m[1].includes('<div class="ad"')
  );
  assert.strictEqual(inside.length, 0, '節の中に広告が入っています');

  // 引用と広告のあいだに、見出しか段落が必ずある（＝くっついていない）
  const ads = [...html.matchAll(/<div class="ad"/g)].map(m => m.index);
  for (const at of ads) {
    const before = html.slice(Math.max(0, at - 400), at);
    const after = html.slice(at, at + 400);
    if (before.includes('</blockquote>')) {
      const gap = before.slice(before.lastIndexOf('</blockquote>'));
      assert.ok(/<h2|<p/.test(gap), '引用のすぐ下に広告があります');
    }
    if (after.includes('<blockquote')) {
      const gap = after.slice(0, after.indexOf('<blockquote'));
      assert.ok(/<h2|<p/.test(gap), '広告のすぐ下に引用があります');
    }
  }
});

test('1ページに出す広告は2つまで', () => {
  const slots = Object.fromEntries(PLACEMENTS.map(p => [p, '1234567890']));
  const pages = [
    ['記事', buildArticlePage(articles[0], sources, { slots })],
    ['在留資格', buildDetailPage(records[0], { slots })],
    ['トップ', buildTopPage(records, 0, { slots })],
  ];
  for (const [name, html] of pages) {
    const count = (html.match(/<div class="ad"/g) || []).length;
    assert.ok(count <= 2, `${name}: 広告が${count}個あります（2つまで）`);
  }
});

test('いま置いてあるファイルには、広告の枠が入っていない（番号が未設定のため）', () => {
  // 審査中に空の枠が出ていないかの確認。番号を入れたあとは、この確認は自動で外れる。
  const configured = PLACEMENTS.filter(p => slotId(p, readSlots()));
  if (configured.length > 0) return;
  for (const file of ['index.html', 'guide/index.html', 'visa/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(!html.includes('<div class="ad"'), `${file} に空の広告枠が出ています`);
  }
});
