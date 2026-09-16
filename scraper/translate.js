'use strict';

/**
 * 記事と画面の文言を、対応言語に訳す。
 *
 * 【訳すもの・訳さないもの】
 *   訳す  ：私たちの言葉（題名・説明・見出し・本文・画面の文言）
 *   訳さない：公式の引用。**日本語のまま1文字も変えずに残す**
 *             （訳し方で意味が変わる／窓口でそのまま見せるため）
 *
 * 【訳したあとに必ず検査する】
 * lib/translation-guards.js で、引用が変わっていないか・数字が増減していないか・
 * 節や段落が減っていないかを機械的に確かめる。落ちたものは**保存しない**。
 *
 * 【原文が変わったら訳し直す】
 * 元の記事の内容から求めた印（source_hash）を訳と一緒に保存し、
 * 印が変わっていたら訳し直す。原文だけ新しくて訳が古い、という状態を作らない。
 *
 * 実行例:
 *   node translate.js                 # 足りないぶん・古くなったぶんだけ訳す
 *   node translate.js --locale vi     # 言語を指定
 *   node translate.js --dry-run       # 何を訳すかだけ見る（APIは呼ばない）
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { ask, extractJson } = require('./lib/anthropic');
const { EXTRA_LOCALES, UI_SOURCE } = require('./lib/locales');
const { checkTranslatedArticle, checkUi } = require('./lib/translation-guards');
const { readArticles } = require('./generate-article-pages');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'translations');
const MAX_ATTEMPTS = 3;

/** 原文の印。訳し直すべきかの判定に使う。 */
function sourceHash(article) {
  const text = JSON.stringify([
    article.title_en,
    article.title_ja,
    article.description,
    article.sections.map(s => [s.heading_en, s.heading_ja, s.body, (s.quotes || []).map(q => q.text)]),
  ]);
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const readJson = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/** 言語ごとの、訳し方の注意。 */
function styleNote(locale) {
  if (locale.code === 'ja-easy') {
    return `【やさしい日本語で書き直してください】
- 1文を短くする（40字くらいまで）。1文に1つのことだけ書く
- むずかしい言葉は、やさしい言葉に言いかえる（例：「届出」→「とどけで（役所に知らせること）」）
- ただし**制度の名前はそのまま**使う（「在留カード」「国民健康保険」など）。言いかえると窓口で通じない
- 漢字の言葉より、ふだん話す言葉を選ぶ
- 「〜してください」「〜が必要です」のように、はっきり書く`;
  }
  return `【${locale.label} に訳してください】
- 日本で暮らしはじめたばかりの人が読みます。やさしい言い回しにしてください
- 制度の名前（在留カード、国民健康保険など）は、訳したあとに（日本語）を添えてください。
  窓口で日本語を見せる必要があるためです`;
}

function articlePrompt(article, locale) {
  const sections = article.sections.map((s, i) => ({
    index: i,
    heading_en: s.heading_en,
    heading_ja: s.heading_ja,
    body_ja: s.body.map(b => b.ja),
    body_en: s.body.map(b => b.en),
    quotes: (s.quotes || []).map(q => q.text),
  }));

  return `次の記事を訳してください。

${styleNote(locale)}

【絶対に守ること】
- **quotes（公式の引用）は訳さない。** 日本語のまま、1文字も変えずにそのまま返す
- **数字を変えない・減らさない・増やさない**（14日を「2週間」に言いかえるのも不可）
- 節の数、段落の数を変えない
- 「あなたは〜できます」のような、読む人の事情を決めつける書き方をしない

【出力の形（JSONだけ。前置きも ${'```'} の囲みも付けない）】
{
  "id": "${article.id}",
  "title": "題名",
  "description": "検索結果に出る説明（100〜140字ぶんくらい）",
  "sections": [
    { "heading": "見出し", "body": ["段落1", "段落2"], "quotes": ["引用は日本語のままコピー"] }
  ]
}

【元の記事】
題名（英）: ${article.title_en}
題名（日）: ${article.title_ja}
説明: ${article.description}

${JSON.stringify(sections, null, 2)}`;
}

function uiPrompt(locale) {
  return `次の画面の文言を訳してください。

${styleNote(locale)}

【出力の形（JSONだけ）】
元と同じ鍵（key）をすべて持つオブジェクト。値だけを訳す。鍵は変えない。

${JSON.stringify(UI_SOURCE, null, 2)}`;
}

async function translateArticle(article, locale) {
  let problems = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const retry = problems.length
      ? `\n\n【前回の訳は次の点で受け付けられませんでした。直してください】\n${problems.map(p => '- ' + p).join('\n')}`
      : '';
    const { text, stopReason } = await ask({
      system: `あなたは、日本で暮らしはじめる外国人向けの解説記事を訳す翻訳者です。公式の引用は訳さず日本語のまま残します。`,
      prompt: articlePrompt(article, locale) + retry,
      maxTokens: 16000,
      script: 'translate',
    });
    const translated = extractJson(text);
    if (!translated) {
      problems = [
        stopReason === 'max_tokens'
          ? '長すぎて途中で切れました。短くまとめてください'
          : 'JSON として読めませんでした。JSON だけを出力してください',
      ];
      continue;
    }
    problems = checkTranslatedArticle(article, translated, { code: locale.code });
    if (problems.length === 0) return { translated, attempts: attempt };
    console.log(`    検査に通りませんでした（${problems.length}件）`);
    problems.forEach(p => console.log('      - ' + p));
  }
  return { translated: null, problems };
}

async function translateUi(locale) {
  let problems = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const retry = problems.length
      ? `\n\n【前回は次の点で受け付けられませんでした】\n${problems.map(p => '- ' + p).join('\n')}`
      : '';
    const { text } = await ask({
      system: 'あなたは、行政手続きの案内サイトの画面文言を訳す翻訳者です。',
      prompt: uiPrompt(locale) + retry,
      maxTokens: 4000,
      script: 'translate',
    });
    const translated = extractJson(text);
    if (!translated) {
      problems = ['JSON として読めませんでした'];
      continue;
    }
    // やさしい日本語は、元と同じ文言になることがある（制度の名前など）
    problems = checkUi(UI_SOURCE, translated, {
      code: locale.code,
      allowSameAsSource: locale.code === 'ja-easy',
    });
    if (problems.length === 0) return translated;
    problems.forEach(p => console.log('      - ' + p));
  }
  return null;
}

/** 何を訳す必要があるか（訳が無い・原文が変わった）。 */
function pending(locale, articles) {
  const uiFile = path.join(OUT_DIR, locale.code, 'ui.json');
  const ui = readJson(uiFile);
  const needUi = !ui || checkUi(UI_SOURCE, ui, { code: locale.code, allowSameAsSource: true }).length > 0;

  const needArticles = articles.filter(article => {
    const saved = readJson(path.join(OUT_DIR, locale.code, 'articles', `${article.id}.json`));
    return !saved || saved.source_hash !== sourceHash(article);
  });
  return { needUi, needArticles };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const only = process.argv.indexOf('--locale');
  const locales = only === -1 ? EXTRA_LOCALES : EXTRA_LOCALES.filter(l => l.code === process.argv[only + 1]);
  if (locales.length === 0) throw new Error('その言語は対応言語に入っていません（lib/locales.js）');

  const articles = readArticles();
  let wrote = 0;

  for (const locale of locales) {
    const { needUi, needArticles } = pending(locale, articles);
    console.log(`\n[${locale.code}] 画面の文言: ${needUi ? '訳す' : '最新'} ／ 記事: ${needArticles.length}本`);
    if (dryRun) {
      needArticles.forEach(a => console.log('  - ' + a.id));
      continue;
    }

    if (needUi) {
      const ui = await translateUi(locale);
      if (ui) {
        writeJson(path.join(OUT_DIR, locale.code, 'ui.json'), ui);
        wrote += 1;
        console.log('  画面の文言を訳しました');
      } else {
        console.error('  画面の文言を訳せませんでした（保存しません）');
      }
    }

    for (const article of needArticles) {
      console.log(`  ${article.id} …`);
      const { translated, problems } = await translateArticle(article, locale);
      if (!translated) {
        console.error(`  ${article.id}: ${MAX_ATTEMPTS}回試しても検査に通らなかったため保存しません`);
        (problems || []).forEach(p => console.error('    - ' + p));
        continue;
      }
      writeJson(path.join(OUT_DIR, locale.code, 'articles', `${article.id}.json`), {
        ...translated,
        source_hash: sourceHash(article),
        translated_at: new Date().toISOString().slice(0, 10),
      });
      wrote += 1;
      console.log(`  ${article.id}: 訳しました`);
    }
  }
  console.log(`\n${wrote}件を保存しました`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { sourceHash, pending, articlePrompt, uiPrompt };
