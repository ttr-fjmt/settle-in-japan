'use strict';

/**
 * 記事が「公式に書かれていることだけ」を書いているかを確かめる。
 *
 * 【なぜテストの中ではなく、ここに置くのか】
 * 記事は毎日1本、GitHub Actions が自動で書く。書いたその場で同じ検査にかけて、
 * 落ちたものは**そもそも保存しない**ようにするため、検査そのものを部品にしてある。
 * `npm test` からも同じ関数を呼ぶので、自動で書いた記事と手で書いた記事に同じ線引きが効く。
 *
 * 【見ているところ】
 *   1. 引用（公式の文言）が、保存した公式ページの本文に実在するか
 *   2. 本文に書いた数字（14日・3月など）が、同じ節の引用に実在するか
 *   3. 個別の判断を述べる表現（「あなたは申請できます」など）が無いか
 *   4. 記事の形（英語と日本語が揃っている・最後の節は公式窓口の案内）になっているか
 *
 * 2つ目が肝。「14日以内」と書きたければ、14日と書かれた公式の文を引用するしかない。
 */

const { textAppearsIn, loadRawText } = require('./verify');

/**
 * 日本語の本文に出てくる「数字＋単位」。ここに挙げた単位だけを見張る。
 * 単位ごと引用に実在することを求める（「5年」を「最長5年」と書き換えるのを止めるため）。
 */
const NUMBER_PATTERN = /[０-９0-9]+\s*(日間|日|年間|年|か月|ヶ月|箇月|月|週間|時間|歳|円|割|%|％|種類|件|回|人)/g;

/**
 * 英語の本文に出てくる数字。英語は言い回しが自由なので、単位ではなく**数そのもの**が
 * 同じ節の引用（日本語）に出てくるかを見る。"within 14 days" なら「14」が引用にあること。
 */
const ENGLISH_NUMBER_PATTERN = /\b\d+(?:,\d{3})*\b/g;

/** 個別の判断を述べる表現。行政書士・弁護士の領域に踏み込まないための線引き。 */
const FORBIDDEN = ['あなたは', 'あなたの場合', '取得できます', '申請できます', '大丈夫です', '問題ありません'];

/** 最後の節は、公式窓口への案内で締める（個別の判断はしない、という姿勢を形にしたもの）。 */
const CLOSING_HEADING_JA = '自分の場合はどうなるか分からないとき';

/** 本文の分量の下限。これを下回るものは、公開できる記事になっていない。 */
const MIN_JA_CHARS = 350;
const MIN_TOTAL_CHARS = 1500;

const textOf = article =>
  article.sections
    .flatMap(s => [
      s.heading_en,
      s.heading_ja,
      ...s.body.flatMap(b => [b.en, b.ja]),
      ...(s.quotes || []).map(q => q.text),
    ])
    .concat([article.title_en, article.title_ja, article.description])
    .join('\n');

/** 記事の形（必要な項目が入っているか）。 */
function checkShape(article) {
  const problems = [];
  for (const key of ['id', 'title_en', 'title_ja', 'description', 'published_at', 'sources', 'sections']) {
    if (!article[key] || (Array.isArray(article[key]) && article[key].length === 0)) {
      problems.push(`${key} がありません`);
    }
  }
  if (problems.length) return problems;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.published_at)) {
    problems.push(`published_at の日付の形が違います: ${article.published_at}`);
  }
  if (article.sections.length < 4) {
    problems.push(`節が${article.sections.length}個しかありません（4個以上）`);
  }

  article.sections.forEach((section, i) => {
    const where = `節${i + 1}`;
    if (!section.heading_en || !section.heading_ja) problems.push(`${where}: 見出しが揃っていません`);
    if (!Array.isArray(section.body) || section.body.length === 0) {
      problems.push(`${where}: 本文がありません`);
      return;
    }
    for (const paragraph of section.body) {
      if (!paragraph.en || !paragraph.en.trim()) problems.push(`${where}: 英語が空の段落があります`);
      if (!paragraph.ja || !paragraph.ja.trim()) problems.push(`${where}: 日本語が空の段落があります`);
    }
    const isLast = i === article.sections.length - 1;
    const quotes = section.quotes || [];
    if (!isLast && quotes.length === 0) {
      problems.push(`${where}（${section.heading_ja}）: 引用がありません。公式の文言を引いてください`);
    }
  });

  const last = article.sections[article.sections.length - 1];
  if (last && last.heading_ja !== CLOSING_HEADING_JA) {
    problems.push(`最後の節の見出しは「${CLOSING_HEADING_JA}」にしてください（今は「${last.heading_ja}」）`);
  }
  return problems;
}

/** 分量。短すぎる記事は、読んだ人が行動できない。 */
function checkLength(article) {
  const problems = [];
  const ja = article.sections.flatMap(s => s.body.map(b => b.ja)).join('').length;
  const total = textOf(article).length;
  if (ja < MIN_JA_CHARS) problems.push(`日本語の本文が短すぎます（${ja}字。${MIN_JA_CHARS}字以上）`);
  if (total < MIN_TOTAL_CHARS) problems.push(`記事全体が短すぎます（${total}字。${MIN_TOTAL_CHARS}字以上）`);
  return problems;
}

/** 引用が、保存した公式ページの本文に実在するか。 */
function checkQuotes(article, { loadRaw = loadRawText } = {}) {
  const problems = [];
  for (const section of article.sections) {
    for (const quote of section.quotes || []) {
      const raw = loadRaw(quote.source_id);
      if (raw == null) {
        problems.push(`${quote.source_id} をまだ取得していません（data/raw に本文がありません）`);
        continue;
      }
      if (!textAppearsIn(quote.text, raw)) {
        problems.push(
          `引用「${quote.text.slice(0, 40)}…」が ${quote.source_id} の本文に見当たりません（言い換えず、原文のまま写してください）`
        );
      }
    }
  }
  return problems;
}

/** その節の引用に出てくる「数字＋単位」（書き直しを頼むときに、使える表記を示すため）。 */
function numbersInQuotes(quoted) {
  return [...new Set(String(quoted).match(NUMBER_PATTERN) || [])].map(n => n.replace(/\s/g, ''));
}

/** 本文に書いた数字が、同じ節の引用に実在するか。 */
function checkNumbers(article) {
  const problems = [];
  for (const section of article.sections) {
    const quoted = (section.quotes || []).map(q => q.text).join(' ');
    // 公式が「6月」と書いているものを「6か月」と書き換えると落ちる。使える表記を添えて返す。
    const available = numbersInQuotes(quoted);
    const hint = available.length
      ? `この節の引用にある表記は「${available.join('」「')}」です。そのまま使ってください`
      : 'この節の引用には数字がありません。数字を書かないか、数字のある公式の文を引いてください';
    for (const paragraph of section.body) {
      for (const found of String(paragraph.ja).match(NUMBER_PATTERN) || []) {
        const number = found.replace(/\s/g, '');
        if (!textAppearsIn(number, quoted)) {
          problems.push(`${section.heading_ja}: 「${number}」を裏づける引用がありません。${hint}`);
        }
      }
      for (const found of String(paragraph.en).match(ENGLISH_NUMBER_PATTERN) || []) {
        if (!textAppearsIn(found.replace(/,/g, ''), quoted)) {
          problems.push(
            `${section.heading_ja}: 英語の本文にある "${found}" を裏づける引用がありません。${hint}`
          );
        }
      }
    }
  }
  return problems;
}

/** 個別の判断を述べていないか。 */
function checkForbidden(article) {
  const text = textOf(article);
  return FORBIDDEN.filter(word => text.includes(word)).map(
    word => `「${word}」は使えません（個別の判断は行政書士・弁護士の領域）`
  );
}

/** 出典の付け方。引用元が記事の出典一覧に入っているか、出典が登録済みか。 */
function checkSources(article, { sources = [] } = {}) {
  const problems = [];
  const known = new Set(sources.map(s => s.id));
  for (const id of article.sources || []) {
    if (!known.has(id)) problems.push(`出典 "${id}" が data/sources.json にありません`);
  }
  for (const section of article.sections) {
    for (const quote of section.quotes || []) {
      if (!(article.sources || []).includes(quote.source_id)) {
        problems.push(`引用元 "${quote.source_id}" が記事の出典一覧に入っていません`);
      }
    }
  }
  return problems;
}

/**
 * 記事をすべての観点で確かめる。問題の一覧を返す（空なら合格）。
 * 自動で書いたときは、この一覧をそのままAIに返して書き直させる。
 */
function checkArticle(article, { sources = [], loadRaw = loadRawText } = {}) {
  const shape = checkShape(article);
  if (shape.length) return shape; // 形が壊れているときは、中身の検査に進めない
  return [
    ...checkLength(article),
    ...checkQuotes(article, { loadRaw }),
    ...checkNumbers(article),
    ...checkForbidden(article),
    ...checkSources(article, { sources }),
  ];
}

module.exports = {
  checkArticle,
  checkShape,
  checkLength,
  checkQuotes,
  checkNumbers,
  checkForbidden,
  checkSources,
  CLOSING_HEADING_JA,
  FORBIDDEN,
  numbersInQuotes,
  NUMBER_PATTERN,
  ENGLISH_NUMBER_PATTERN,
};
