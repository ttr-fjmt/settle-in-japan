'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { isOfficialUrl } = require('../lib/schema');

const sources = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'sources.json'), 'utf8')
);

test('出典リストは1件以上ある', () => {
  assert.ok(Array.isArray(sources) && sources.length > 0);
});

test('すべての出典が公式ドメインで、必要な項目がそろっている', () => {
  const ids = new Set();
  for (const s of sources) {
    assert.ok(s.id && /^[a-z0-9-]+$/.test(s.id), `id の形式が不正: ${s.id}`);
    assert.ok(!ids.has(s.id), `id が重複: ${s.id}`);
    ids.add(s.id);
    assert.ok(s.title, `${s.id}: title が無い`);
    assert.ok(s.publisher, `${s.id}: publisher（どこが出しているか）が無い`);
    assert.ok(s.note, `${s.id}: note（何に使うか）が無い`);
    assert.ok(isOfficialUrl(s.url), `${s.id}: 公式ドメインではない（${s.url}）`);
    assert.ok(s.url.startsWith('https://'), `${s.id}: https ではない`);
  }
});
