'use strict';

/**
 * data/visa-types.json を検証する（npm run validate）。
 * スキーマの検証と、公式ページ本文との照合の両方を行う。
 */

const fs = require('fs');
const path = require('path');

const { validateAll } = require('./lib/schema');
const { verifyAll, loadRawText } = require('./lib/verify');

const DATA_PATH = path.join(__dirname, '..', 'data', 'visa-types.json');

function main() {
  const records = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`visa-types.json: ${records.length}件`);

  const problems = validateAll(records);
  const unverified = verifyAll(records);
  const notFetched = records.filter(r => loadRawText(r.source_id) == null);

  if (notFetched.length) {
    // 取得していないこと自体は失敗にしない（Actions で取得する前の状態がありうるため）。
    console.log(
      `\n公式ページを未取得のため照合できなかったレコード: ${notFetched.length}件\n` +
        `  → .github/workflows/fetch-official.yml を実行してください\n` +
        notFetched.map(r => `  - ${r.id}（source_id=${r.source_id}）`).join('\n')
    );
  }

  if (problems.length === 0 && unverified.length === 0) {
    console.log('\n検証に成功しました。');
    return;
  }

  if (problems.length) {
    console.error(`\nスキーマの問題: ${problems.length}件`);
    problems.forEach(p => console.error('  - ' + p));
  }
  if (unverified.length) {
    console.error(`\n公式ページの本文と一致しない記述: ${unverified.length}件`);
    unverified.forEach(u => {
      console.error(`  - ${u.id}`);
      u.missing.forEach(m => console.error(`      ${m}`));
    });
  }
  process.exit(1);
}

if (require.main === module) main();
