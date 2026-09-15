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
