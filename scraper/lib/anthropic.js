'use strict';

/**
 * Claude API を呼ぶための最小限の部品。
 *
 * 【パッケージを入れない】
 * 公式SDKは使わず、Node 22 の fetch でそのまま呼ぶ。このリポジトリの方針
 * （依存パッケージなし）を保つため。使う機能は「文章を1回頼む」だけなので、これで足りる。
 *
 * 【APIキーはリポジトリに置かない】
 * 環境変数 ANTHROPIC_API_KEY から読む。設定は GitHub の Actions secrets に置く。
 * クラウドのセッションにキーを置かない（CLAUDE.md の決めごと）。
 *
 * 【いくらかかったかを残す】
 * 呼ぶたびに data/usage-log/YYYY-MM.json に積み上げる。記録は絶対に処理を止めない。
 * 価格表に無いモデルは 0 で埋めず null にする（確認できない数字は埋めない、と同じ扱い）。
 */

const fs = require('node:fs');
const path = require('node:path');

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const LOG_DIR = process.env.USAGE_LOG_DIR || path.join(__dirname, '..', '..', 'data', 'usage-log');

/** 公開価格（USD / 100万トークン）。モデルを増やしたらここにも足す。 */
const MODEL_PRICING = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-5': { input: 5, output: 25 },
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** 日本時間の日付（記録の日付をそろえるため）。 */
function jstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function estimateCostUsd({ model, input_tokens, output_tokens }) {
  const price = MODEL_PRICING[model];
  if (!price) return null;
  return ((input_tokens || 0) / 1e6) * price.input + ((output_tokens || 0) / 1e6) * price.output;
}

/** 使った量を月ごとのファイルに積み上げる。失敗しても処理は止めない。 */
function recordUsage({ script, model, usage }, logDir = LOG_DIR) {
  try {
    const date = jstDate();
    fs.mkdirSync(logDir, { recursive: true });
    const file = path.join(logDir, `${date.slice(0, 7)}.json`);
    const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    let row = rows.find(r => r.date === date && r.script === script && r.model === model);
    if (!row) {
      row = { date, script, model, calls: 0, input_tokens: 0, output_tokens: 0, estimated_usd: 0 };
      rows.push(row);
    }
    row.calls += 1;
    row.input_tokens += usage.input_tokens || 0;
    row.output_tokens += usage.output_tokens || 0;
    const cost = estimateCostUsd({ model, ...row });
    row.estimated_usd = cost == null ? null : Number(cost.toFixed(4));
    if (cost == null) row.unpriced = true;
    fs.writeFileSync(file, JSON.stringify(rows, null, 2) + '\n');
  } catch (error) {
    console.warn(`使用量の記録に失敗しました（処理は続けます）: ${error.message}`);
  }
}

/**
 * Claude に1回頼む。戻り値は本文の文字列。
 * 混み合っているとき（429・5xx）は間を空けて3回まで試す。
 */
async function ask({ system, prompt, model = DEFAULT_MODEL, maxTokens = 8000, script = 'unknown' }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません（Actions secrets に入れてください）');

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: new Headers({
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        }),
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (error) {
      lastError = error;
      await sleep(attempt * 4000);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`API が ${response.status} を返しました`);
      await sleep(attempt * 8000);
      continue;
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API が ${response.status} を返しました: ${body.slice(0, 500)}`);
    }

    const data = await response.json();
    recordUsage({ script, model, usage: data.usage || {} });
    return (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
  }
  throw lastError || new Error('API を呼べませんでした');
}

/**
 * 返事の中から JSON を取り出す。前後の説明や ```json の囲みが付いていても拾う。
 * 取り出せなければ null（呼び出し側が「書き直し」を頼めるように、例外にはしない）。
 */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

module.exports = { ask, extractJson, recordUsage, estimateCostUsd, jstDate, DEFAULT_MODEL, MODEL_PRICING };
