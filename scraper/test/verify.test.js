'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalize, textAppearsIn, verifyRecord } = require('../lib/verify');

test('空白・字体の揺れは吸収する', () => {
  // 公式ページの本文は改行や全角スペースが入るため、そこで落ちてはいけない。
  assert.strictEqual(normalize('5 年'), normalize('5年'));
  assert.strictEqual(normalize('３月'), normalize('3月'));
  assert.strictEqual(normalize('1年\n又は\n3月'), normalize('1年又は3月'));
  assert.strictEqual(normalize('5年〜'), normalize('5年～'));
});

test('本文にある文言は見つかる', () => {
  const raw = '在留期間は、5年、3年、1年又は3月です。';
  assert.ok(textAppearsIn('5年', raw));
  assert.ok(textAppearsIn('1年又は3月', raw));
});

test('意味を変える言い換えは見つからない', () => {
  // ここが照合の要。「最長5年」は本文に無いので落ちる。
  const raw = '在留期間は、5年、3年、1年又は3月です。';
  assert.ok(!textAppearsIn('最長5年', raw));
  assert.ok(!textAppearsIn('10年', raw));
});

test('公式ページを未取得なら「判定していない」を返す（落とさない）', () => {
  const result = verifyRecord({ source_id: 'not-fetched-yet', periods_ja: ['5年'] }, {
    dir: fs.mkdtempSync(path.join(os.tmpdir(), 'sij-')),
  });
  assert.strictEqual(result.checked, false);
  assert.deepStrictEqual(result.missing, []);
});

test('取得済みなら、本文に無い記述を指摘する', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sij-'));
  fs.writeFileSync(
    path.join(dir, 'visa-list.txt'),
    '技術・人文知識・国際業務\n本邦の公私の機関との契約に基づいて行う業務に従事する活動\n5年、3年、1年又は3月\n'
  );

  const good = verifyRecord(
    {
      source_id: 'visa-list',
      activities_ja: ['本邦の公私の機関との契約に基づいて行う業務に従事する活動'],
      periods_ja: ['5年', '3年'],
    },
    { dir }
  );
  assert.strictEqual(good.checked, true);
  assert.deepStrictEqual(good.missing, []);

  const bad = verifyRecord(
    { source_id: 'visa-list', activities_ja: ['自由に働ける活動'], periods_ja: ['10年'] },
    { dir }
  );
  assert.strictEqual(bad.checked, true);
  assert.strictEqual(bad.missing.length, 2);
});
