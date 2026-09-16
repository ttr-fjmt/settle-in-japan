'use strict';

/**
 * 翻訳の検査。翻訳は機械がやるので、**訳したあとに機械で確かめる**。
 *
 * 【いちばん止めたいこと】
 * 公式の引用が訳されてしまうこと。訳した引用を窓口で見せても通じないし、
 * 「公式にそう書いてある」という前提が崩れる。引用は1文字も変えずに日本語のまま残す。
 *
 * 【次に止めたいこと】
 *   - 数字が変わる／消える（14日が15日になる、期限が消える）
 *   - 節や段落が減る（訳し飛ばし）
 *   - 訳し漏れ（元の英語がそのまま残る）
 *
 * 訳文の「言い回しの良し悪し」は機械では測れない。ここで見るのは**壊れていないこと**だけ。
 */

const { normalize } = require('./verify');

/** 本文に出てくる数字（半角・全角）。単位は問わず、数そのものを見る。 */
const NUMBERS = /[0-9０-９]+/g;

const numbersIn = text => (String(text).match(NUMBERS) || []).map(n => n.normalize('NFKC'));

/** 訳した記事が、元の記事と同じ形・同じ数字・同じ引用を保っているか。 */
function checkTranslatedArticle(original, translated, { code = '' } = {}) {
  const problems = [];
  const at = where => `${code}/${original.id}${where ? ' ' + where : ''}`;

  for (const key of ['id', 'title', 'description', 'sections']) {
    if (!translated[key]) problems.push(`${at()}: ${key} がありません`);
  }
  if (problems.length) return problems;

  if (translated.id !== original.id) problems.push(`${at()}: id が違います`);
  if (translated.sections.length !== original.sections.length) {
    problems.push(
      `${at()}: 節の数が違います（元 ${original.sections.length} → 訳 ${translated.sections.length}）`
    );
    return problems;
  }

  original.sections.forEach((section, i) => {
    const t = translated.sections[i];
    const where = `節${i + 1}`;
    if (!t.heading || !t.heading.trim()) problems.push(`${at(where)}: 見出しが空です`);
    if (!Array.isArray(t.body) || t.body.length !== section.body.length) {
      problems.push(
        `${at(where)}: 段落の数が違います（元 ${section.body.length} → 訳 ${(t.body || []).length}）`
      );
      return;
    }

    // 数字：元（日本語）に出てくる数と、訳文の数がそろっているか
    section.body.forEach((paragraph, j) => {
      const before = numbersIn(paragraph.ja).sort();
      const after = numbersIn(t.body[j]).sort();
      if (before.join(',') !== after.join(',')) {
        problems.push(
          `${at(where)}: ${j + 1}つ目の段落で数字が変わっています（元 ${before.join('・') || 'なし'} → 訳 ${after.join('・') || 'なし'}）`
        );
      }
    });

    // 引用：日本語のまま、1文字も変えずに残っているか
    const quotes = section.quotes || [];
    const translatedQuotes = t.quotes || [];
    if (translatedQuotes.length !== quotes.length) {
      problems.push(`${at(where)}: 引用の数が違います`);
      return;
    }
    quotes.forEach((quote, j) => {
      if (normalize(quote.text) !== normalize(translatedQuotes[j])) {
        problems.push(`${at(where)}: 引用が書き換えられています（公式の日本語のまま残してください）`);
      }
    });
  });

  return problems;
}

/** 画面の文言が、すべて訳されているか（訳し漏れ・日本語のままの残りを見つける）。 */
function checkUi(source, translated, { code = '', allowSameAsSource = false } = {}) {
  const problems = [];
  for (const key of Object.keys(source)) {
    const value = translated[key];
    if (!value || !String(value).trim()) {
      problems.push(`${code}: 画面の文言 "${key}" が訳されていません`);
      continue;
    }
    if (!allowSameAsSource && String(value).trim() === String(source[key]).trim()) {
      problems.push(`${code}: 画面の文言 "${key}" が日本語のままです`);
    }
  }
  const extra = Object.keys(translated).filter(k => !(k in source));
  if (extra.length) problems.push(`${code}: 知らない文言があります（${extra.join(', ')}）`);
  return problems;
}

module.exports = { checkTranslatedArticle, checkUi, numbersIn };
