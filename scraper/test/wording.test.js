'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

/**
 * 個別の相談に答える文章が混じっていないかを見張る。
 *
 * 「あなたはこの在留資格を取得できます」といった個別判断は、行政書士・弁護士の資格が
 * 必要な領域に踏み込むおそれがある（DECISIONS.md 2026-09-15）。
 * 方針として書くだけでは守られないので、機械的にも止める。
 */
const FORBIDDEN = [
  'あなたは',
  'あなたの場合',
  '取得できます',
  '申請できます',
  '認められます',
  '問題ありません',
  '大丈夫です',
];

const records = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'visa-types.json'), 'utf8')
);

test('掲載データに、個別の判断を述べる表現が無い', () => {
  const hits = [];
  for (const r of records) {
    const text = [r.activities_ja, ...(r.periods_ja || []), r.summary_ja || ''].join(' ');
    for (const word of FORBIDDEN) {
      if (text.includes(word)) hits.push(`${r.id}: 「${word}」`);
    }
  }
  assert.deepStrictEqual(hits, [], '個別の判断を述べる表現が含まれています:\n' + hits.join('\n'));
});

test('禁止語のリストが空になっていない', () => {
  // リストごと消してテストを通す、という事故を防ぐ
  assert.ok(FORBIDDEN.length >= 5);
});
