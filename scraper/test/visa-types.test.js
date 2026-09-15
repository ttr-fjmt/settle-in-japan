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
