'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { validateAll } = require('../lib/schema');
const { verifyAll } = require('../lib/verify');

const DATA = path.join(__dirname, '..', '..', 'data', 'visa-types.json');
const SOURCES = path.join(__dirname, '..', '..', 'data', 'sources.json');
const records = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));

test('掲載データがスキーマを満たす', () => {
  const problems = validateAll(records);
  assert.deepStrictEqual(problems, [], '\n' + problems.join('\n'));
});

test('掲載データの記述が、公式ページの本文と一致する', () => {
  const unverified = verifyAll(records);
  assert.deepStrictEqual(
    unverified,
    [],
    '公式ページの本文に無い記述があります:\n' + JSON.stringify(unverified, null, 2)
  );
});

test('source_id は出典リストに登録されたものだけ', () => {
  const ids = new Set(sources.map(s => s.id));
  for (const r of records) {
    assert.ok(ids.has(r.source_id), `${r.id}: source_id "${r.source_id}" が sources.json にありません`);
  }
});

test('一覧表にある在留資格が、1つも欠けずに入っている', () => {
  // 取得し直したときに、表の形が変わって一部を取りこぼすことがある。
  // 29種類（号で分かれるものは号ごと）が揃っていることを、ここで見張る。
  const { STATUSES } = require('../extract-visa-types');
  const names = records.map(r => r.name_ja);
  for (const s of STATUSES) {
    assert.ok(
      names.some(n => n === s.name || n.startsWith(s.name + '１号') || n.startsWith(s.name)),
      `${s.name} が入っていません`
    );
  }
  assert.ok(records.length >= STATUSES.length, `件数が少なすぎます: ${records.length}`);
});

test('すべてのレコードに在留期間が1つ以上ある', () => {
  const missing = records.filter(r => !(r.periods_ja || []).length).map(r => r.name_ja);
  assert.deepStrictEqual(missing, [], '在留期間が空のレコード: ' + missing.join('、'));
});

test('家族滞在の対象は、公式ページの列挙どおりになっている', () => {
  // 家族滞在のページには対象の在留資格が列挙されており、その列挙がすべて。
  // ここがずれると「家族を呼べる」の表示が間違うので、本文から作り直して突き合わせる。
  const fs2 = require('fs');
  const dependentPath = path.join(__dirname, '..', '..', 'data', 'raw', 'visa-dependent.txt');
  if (!fs2.existsSync(dependentPath)) return; // 未取得なら判定しない

  const text = fs2.readFileSync(dependentPath, 'utf8').replace(/[\t\r]/g, '');
  const sentence = (text.match(/入管法別表第一の[^。]*扶養を受ける配偶者又は子として行う日常的な活動。/) || [''])[0];
  assert.ok(sentence, '家族滞在のページから、対象の在留資格を並べた文が見つかりません');

  for (const r of records) {
    if (r.family_stay === 'unknown') continue;
    // 号つきの名前（特定技能２号）を優先し、無ければ資格名で見る
    const listed = sentence.includes(r.name_ja) || (!/[１２３]号/.test(r.name_ja) && sentence.includes(r.name_ja));
    const expected = listed ? 'yes' : 'no';
    if (r.name_ja.includes('号') && !sentence.includes(r.name_ja)) {
      // 高度専門職のように、号の指定なしで挙がっているものは対象
      const base = r.name_ja.replace(/[１２３]号$/, '');
      const baseListedWithoutNumber =
        sentence.includes(base) && !new RegExp(`${base}[１２３]号`).test(sentence);
      assert.strictEqual(
        r.family_stay,
        baseListedWithoutNumber ? 'yes' : 'no',
        `${r.name_ja}: 家族滞在の判定が公式の列挙と合いません`
      );
      continue;
    }
    assert.strictEqual(r.family_stay, expected, `${r.name_ja}: 家族滞在の判定が公式の列挙と合いません`);
  }
});

test('家族滞在の判定には、根拠にした出典がついている', () => {
  const ids = new Set(sources.map(s => s.id));
  for (const r of records) {
    if (r.family_stay === 'unknown') {
      assert.ok(!r.family_stay_source_id, `${r.name_ja}: 未確認なのに出典がついている`);
      continue;
    }
    assert.ok(r.family_stay_source_id, `${r.name_ja}: 家族滞在の判定に出典がない`);
    assert.ok(ids.has(r.family_stay_source_id), `${r.name_ja}: 出典が sources.json にない`);
  }
});
