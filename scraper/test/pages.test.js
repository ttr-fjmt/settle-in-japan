'use strict';

/**
 * 書き出したページが、このサイトの約束を守っているかを見張る。
 *
 * 守る約束は3つ。
 *   1. 出典と最終確認日が、どのページにも必ず出ている
 *   2. 公式の文言（在留期間・活動内容）が、言い換えられずにページに出ている
 *   3. 確認できていない項目を、断定して書いていない
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { buildDetailPage, buildListPage, buildTopPage } = require('../generate-visa-pages');

const records = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'visa-types.json'), 'utf8')
);

test('どの在留資格のページにも、出典と最終確認日が入っている', () => {
  for (const r of records) {
    const html = buildDetailPage(r);
    assert.ok(html.includes(r.source_url), `${r.name_ja}: 出典URLが無い`);
    assert.ok(html.includes(r.source_checked_at), `${r.name_ja}: 最終確認日が無い`);
  }
});

test('公式の在留期間と活動内容が、そのままページに出ている', () => {
  for (const r of records) {
    const html = buildDetailPage(r);
    for (const period of r.periods_ja) {
      assert.ok(html.includes(period), `${r.name_ja}: 在留期間「${period}」がページに無い`);
    }
    for (const activity of r.activities_ja) {
      // 「<」などを含む文言はエスケープされるため、先頭20文字で確かめる
      assert.ok(html.includes(activity.slice(0, 20)), `${r.name_ja}: 活動内容がページに無い`);
    }
  }
});

test('確認できていない項目は「記載なし」と書き、断定しない', () => {
  const unknowns = records.filter(r => r.work_allowed === 'unknown' || r.family_stay === 'unknown');
  assert.ok(unknowns.length > 0, 'このテストの前提（unknown のレコードがある）が崩れています');

  for (const r of unknowns) {
    const html = buildDetailPage(r);
    assert.ok(html.includes('記載なし'), `${r.name_ja}: 「記載なし」と書かれていない`);
    assert.ok(!html.includes('就労できない</p>') || r.work_allowed === 'no', `${r.name_ja}: 断定している`);
  }
});

test('ページに、個別の判断を述べる表現が無い', () => {
  // 「あなたは申請できます」は行政書士・弁護士の領域（DECISIONS.md 2026-09-15）。
  const forbidden = ['あなたは', 'あなたの場合', '取得できます', '申請できます', '大丈夫です'];
  const pages = [buildTopPage(records), buildListPage(records), ...records.map(buildDetailPage)];
  const hits = [];
  pages.forEach((html, i) => {
    for (const word of forbidden) {
      if (html.includes(word)) hits.push(`ページ${i}: 「${word}」`);
    }
  });
  assert.deepStrictEqual(hits, [], hits.join('\n'));
});

test('一覧ページに、すべての在留資格へのリンクがある', () => {
  const html = buildListPage(records);
  for (const r of records) {
    assert.ok(html.includes(`/visa/${r.id}/`), `${r.name_ja} へのリンクが無い`);
    assert.ok(html.includes(r.name_ja), `${r.name_ja} が一覧に無い`);
  }
});

test('HTMLに入れてはいけない文字は、そのまま出さない', () => {
  const evil = {
    ...records[0],
    name_ja: '<script>alert(1)</script>',
    examples_ja: 'A & B "C"',
  };
  const html = buildDetailPage(evil);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'タグがそのまま出ている');
  assert.ok(html.includes('&lt;script&gt;'), 'エスケープされていない');
  assert.ok(html.includes('A &amp; B'), '&がエスケープされていない');
});

test('書き出したページが、いまのデータと一致している', () => {
  // データだけ更新してページを作り直し忘れる、という取り違えを止める。
  const listPath = path.join(__dirname, '..', '..', 'visa', 'index.html');
  if (!fs.existsSync(listPath)) return; // まだ書き出していない場合は何もしない
  assert.strictEqual(
    fs.readFileSync(listPath, 'utf8'),
    buildListPage(records),
    'visa/index.html が古いです。cd scraper && npm run pages で作り直してください'
  );
});
