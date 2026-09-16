'use strict';

/**
 * Claude API まわりの部品の見張り。
 *
 * 自動更新は「返ってきた文字列から JSON を取り出す」ところで失敗しやすい。
 * （実際に、返事が長すぎて途中で切れ、3回とも読めなかったことがある）
 * ここでは通信はせず、取り出しと使用量の記録だけを確かめる。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { extractJson, recordUsage, estimateCostUsd } = require('../lib/anthropic');

test('前置きや ``` の囲みが付いていても、JSON を取り出せる', () => {
  assert.deepStrictEqual(extractJson('{"id":"a"}'), { id: 'a' });
  assert.deepStrictEqual(extractJson('はい、書きました。\n```json\n{"id":"a"}\n```'), { id: 'a' });
  assert.deepStrictEqual(extractJson('```\n{"id":"a"}\n```\n以上です。'), { id: 'a' });
});

test('途中で切れた返事は、例外ではなく null で返る', () => {
  // ここで例外にすると、書き直しを頼めずに止まってしまう。
  assert.strictEqual(extractJson('{"id":"a","sections":[{"heading_en":"Wh'), null);
  assert.strictEqual(extractJson('JSONは出せません'), null);
});

test('使った量が、月ごとのファイルに積み上がる', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sij-usage-'));
  const usage = { input_tokens: 1000, output_tokens: 2000 };
  recordUsage({ script: 'test', model: 'claude-sonnet-5', usage }, dir);
  recordUsage({ script: 'test', model: 'claude-sonnet-5', usage }, dir);

  const file = fs.readdirSync(dir)[0];
  const rows = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  assert.strictEqual(rows.length, 1, '同じ日・同じスクリプトは1行にまとまる');
  assert.strictEqual(rows[0].calls, 2);
  assert.strictEqual(rows[0].input_tokens, 2000);
  assert.ok(rows[0].estimated_usd > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('価格表に無いモデルは、金額を 0 で埋めずに null にする', () => {
  // 確認できない数字は埋めない（DATA_QUALITY_POLICY.md と同じ扱い）。
  assert.strictEqual(estimateCostUsd({ model: 'unknown-model', input_tokens: 100 }), null);
});
