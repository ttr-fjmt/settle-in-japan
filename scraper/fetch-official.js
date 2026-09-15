'use strict';

/**
 * 公式ページを取得して、本文を data/raw/<id>.txt に保存する。
 *
 * 【なぜ分けてあるか】
 * クラウド（Claude Code on the web）のセッションは許可ドメインしか見られず、
 * moj.go.jp などの公式サイトには直接アクセスできない。GitHub Actions からは出られるので、
 * 「取得」は Actions（.github/workflows/fetch-official.yml）で、
 * 「読んでデータを作る」はクラウドのセッションで、と分けている。
 *
 * 保存するのは本文のテキストだけ（HTMLタグ・スクリプト・スタイルは落とす）。
 * data/visa-types.json に書いた文言がこの本文に実在するかを、npm test が照合する。
 *
 * 実行例:
 *   node fetch-official.js                 # sources.json の全件
 *   node fetch-official.js visa-list       # id を指定して1件だけ
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES_PATH = path.join(ROOT, 'data', 'sources.json');
const RAW_DIR = path.join(ROOT, 'data', 'raw');

const USER_AGENT =
  'settle-in-japan-bot/1.0 (+https://github.com/ttr-fjmt/settle-in-japan) 公式情報の照合用';

/** 連続アクセスの間隔。公式サイトに負荷をかけないため。 */
const DELAY_MS = 3000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** HTMLから本文テキストだけを取り出す。 */
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function readSources() {
  const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));
  if (!Array.isArray(sources)) throw new Error('data/sources.json は配列である必要があります');
  return sources;
}

async function fetchOne(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ja' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    // PDFはこのスクリプトでは本文を取り出さない。HTML版のページを sources.json に登録すること。
    throw new Error('PDFは対象外です（HTML版のページを登録してください）');
  }

  const text = htmlToText(await res.text());
  if (text.length < 200) throw new Error(`本文が短すぎます（${text.length}文字）。取得に失敗した可能性`);
  return text;
}

async function main() {
  const only = process.argv[2];
  const sources = readSources().filter(s => !only || s.id === only);
  if (sources.length === 0) {
    console.error(only ? `id "${only}" は sources.json にありません` : 'sources.json が空です');
    process.exit(1);
  }

  fs.mkdirSync(RAW_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  let ok = 0;
  const failures = [];

  for (const [i, source] of sources.entries()) {
    if (i > 0) await delay(DELAY_MS);
    try {
      const body = await fetchOne(source);
      const header = [
        `# ${source.title}`,
        `# 取得元: ${source.url}`,
        `# 取得日: ${today}`,
        '# このファイルは fetch-official.js が自動生成しています。手で編集しないこと。',
        '',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(RAW_DIR, `${source.id}.txt`), header + body + '\n');
      console.log(`[ok]   ${source.id}: ${body.length}文字 → data/raw/${source.id}.txt`);
      ok += 1;
    } catch (err) {
      console.warn(`[fail] ${source.id}: ${err.message}`);
      failures.push(source.id);
    }
  }

  console.log(`\nDone. ok=${ok} failed=${failures.length}`);
  if (failures.length) {
    // 失敗を握りつぶさない。取得できなかったページがあることを、実行結果として分かるようにする。
    console.log(`取得できなかったページ: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { htmlToText, readSources };
