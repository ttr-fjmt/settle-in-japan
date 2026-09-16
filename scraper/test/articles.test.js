'use strict';

/**
 * 記事が「公式に書かれていることだけ」を書いているかを見張る。
 *
 * 記事は在留資格のデータと違って、自分たちの言葉で書く部分がある。
 * そこが緩むと、公式に無いことが混じる。そこで2つの角度から止める。
 *
 *   1. 引用（公式の文言）が、保存した公式ページの本文に実在するか
 *   2. 本文に書いた数字（14日・3月など）が、同じ節の引用に実在するか
 *
 * 2つ目が肝。「14日以内」と書きたければ、14日と書かれた公式の文を引用するしかない。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { textAppearsIn, loadRawText } = require('../lib/verify');
const { readArticles, buildArticlePage } = require('../generate-article-pages');

const ROOT = path.join(__dirname, '..', '..');
const articles = readArticles();
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));
const sourceIds = new Set(sources.map(s => s.id));

/** 本文に出てくる「数字＋単位」。ここに挙げた単位だけを見張る。 */
const NUMBER_PATTERN = /[０-９0-9]+\s*(日|年|月|歳|円|%|％)/g;

test('記事が1本以上ある', () => {
  assert.ok(articles.length > 0, 'data/articles/ に記事がありません');
});

test('引用が、公式ページの本文に実在する', () => {
  const missing = [];
  for (const article of articles) {
    for (const section of article.sections) {
      for (const quote of section.quotes || []) {
        const raw = loadRawText(quote.source_id);
        if (raw == null) {
          missing.push(`${article.id}: ${quote.source_id} をまだ取得していません`);
          continue;
        }
        if (!textAppearsIn(quote.text, raw)) {
          missing.push(`${article.id}: 引用「${quote.text.slice(0, 30)}…」が ${quote.source_id} に見当たりません`);
        }
      }
    }
  }
  assert.deepStrictEqual(missing, [], '\n' + missing.join('\n'));
});

test('本文に書いた数字は、同じ節の引用に実在する', () => {
  // 「14日以内」と書きたければ、14日と書かれた公式の文を引用する。
  // 引用のない節に数字を書くことはできない。
  const unbacked = [];
  for (const article of articles) {
    for (const section of article.sections) {
      const quoted = (section.quotes || []).map(q => q.text).join(' ');
      for (const paragraph of section.body) {
        const text = `${paragraph.en} ${paragraph.ja}`;
        for (const found of text.match(NUMBER_PATTERN) || []) {
          const number = found.replace(/\s/g, '');
          if (!textAppearsIn(number, quoted)) {
            unbacked.push(`${article.id} / ${section.heading_ja}: 「${number}」を裏づける引用がありません`);
          }
        }
      }
    }
  }
  assert.deepStrictEqual(unbacked, [], '\n' + unbacked.join('\n'));
});

test('記事が挙げている出典は、すべて出典リストにある', () => {
  for (const article of articles) {
    for (const id of article.sources) {
      assert.ok(sourceIds.has(id), `${article.id}: 出典 "${id}" が sources.json にありません`);
    }
    for (const section of article.sections) {
      for (const quote of section.quotes || []) {
        assert.ok(
          article.sources.includes(quote.source_id),
          `${article.id}: 引用元 "${quote.source_id}" が記事の出典一覧に入っていません`
        );
      }
    }
  }
});

test('記事に、個別の判断を述べる表現が無い', () => {
  const forbidden = ['あなたは', 'あなたの場合', '取得できます', '申請できます', '大丈夫です', '問題ありません'];
  const hits = [];
  for (const article of articles) {
    const html = buildArticlePage(article, sources);
    for (const word of forbidden) {
      if (html.includes(word)) hits.push(`${article.id}: 「${word}」`);
    }
  }
  assert.deepStrictEqual(hits, [], hits.join('\n'));
});

test('記事のページに、出典と最終確認日が出ている', () => {
  for (const article of articles) {
    const html = buildArticlePage(article, sources);
    assert.ok(html.includes(article.published_at), `${article.id}: 最終確認日が無い`);
    for (const id of article.sources) {
      const source = sources.find(s => s.id === id);
      assert.ok(html.includes(source.url), `${article.id}: ${id} の出典URLが無い`);
    }
  }
});

test('記事は、英語と日本語の両方で書かれている', () => {
  for (const article of articles) {
    for (const section of article.sections) {
      for (const paragraph of section.body) {
        assert.ok(paragraph.en && paragraph.en.trim(), `${article.id}: 英語が空の段落があります`);
        assert.ok(paragraph.ja && paragraph.ja.trim(), `${article.id}: 日本語が空の段落があります`);
      }
    }
  }
});

test('書き出した記事のページが、いまのデータと一致している', () => {
  for (const article of articles) {
    const file = path.join(ROOT, 'guide', article.id, 'index.html');
    if (!fs.existsSync(file)) continue;
    assert.strictEqual(
      fs.readFileSync(file, 'utf8'),
      buildArticlePage(article, sources),
      `${article.id}: ページが古いです。cd scraper && npm run articles で作り直してください`
    );
  }
});
