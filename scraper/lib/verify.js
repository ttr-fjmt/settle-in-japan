'use strict';

/**
 * 本文照合。このリポジトリでいちばん大事なガード。
 *
 * 【なぜ必要か】
 * AIに「公式ページに書かれていないことは書かないで」と指示するだけでは守られない
 * （既存3サイトで、指示に反して本文に無い内容が作られた実例が複数ある）。
 * そこで、書いた文言が保存済みの公式ページ本文に**実在するか**を機械的に確かめる。
 *
 * 【照合のしかた】
 * 公式ページの本文は、改行・空白・全角半角の揺れが大きい。そのままの一致は厳しすぎるので、
 * 「空白を取り除き、全角英数を半角に、カギ括弧や波ダッシュの字体差を吸収する」まで正規化してから比べる。
 * 意味を変える言い換え（「5年」→「最長5年」など）は、正規化しても一致しないので落ちる。それが狙い。
 */

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw');

/** 比較のための正規化。字体・空白の揺れだけを吸収し、語そのものは変えない。 */
function normalize(text) {
  return String(text == null ? '' : text)
    .normalize('NFKC') // 全角英数・全角記号を半角へ、互換文字を統一
    .replace(/[\s　]+/g, '') // 空白・改行・全角空白を除去
    .replace(/[〜～~]/g, '~') // 波ダッシュの字体差
    .replace(/[｢「]/g, '「')
    .replace(/[｣」]/g, '」')
    .replace(/[･・]/g, '・')
    .replace(/[，,]/g, '、');
}

/** data/raw/<sourceId>.txt を読む。無ければ null（＝まだ取得していない）。 */
function loadRawText(sourceId, dir = RAW_DIR) {
  const file = path.join(dir, `${sourceId}.txt`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

/** 文言が本文に実在するか。 */
function textAppearsIn(text, rawText) {
  if (!rawText) return false;
  const needle = normalize(text);
  if (!needle) return false;
  return normalize(rawText).includes(needle);
}

/**
 * 1レコードの「事実を書く項目」を本文と照合する。
 *
 * 戻り値:
 *   { checked: boolean, missing: string[] }
 *   checked=false は「公式ページをまだ取得していないので判定していない」という意味。
 *   取得していないことを理由に掲載を止めはしない（止めると何も載らない）。
 *   ただし missing が1つでもあれば、そのレコードは掲載しない。
 */
function verifyRecord(record, { dir = RAW_DIR } = {}) {
  const raw = loadRawText(record.source_id, dir);
  if (raw == null) return { checked: false, missing: [] };

  const missing = [];
  if (record.activities_ja && !textAppearsIn(record.activities_ja, raw)) {
    missing.push(`activities_ja: 公式ページの本文に見当たりません`);
  }
  for (const period of record.periods_ja || []) {
    if (!textAppearsIn(period, raw)) {
      missing.push(`periods_ja "${period}": 公式ページの本文に見当たりません`);
    }
  }
  return { checked: true, missing };
}

/** 全レコードを照合し、問題のあるものだけを返す。 */
function verifyAll(records, options = {}) {
  const results = [];
  for (const record of records) {
    const { checked, missing } = verifyRecord(record, options);
    if (checked && missing.length) results.push({ id: record.id, missing });
  }
  return results;
}

module.exports = { normalize, loadRawText, textAppearsIn, verifyRecord, verifyAll, RAW_DIR };
