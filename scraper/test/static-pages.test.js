'use strict';

/**
 * 固定ページ（プライバシーポリシー・よくある質問）の見張り。
 *
 * 広告（AdSense）と解析（GA4）は Cookie を使うので、その説明が要る。
 * 抜けていても画面上は何も起きないため、テストで止める。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { buildPrivacyPage, buildFaqPage, FAQ, CONTACT } = require('../generate-static-pages');
const { pagePaths } = require('../generate-sitemap');
const { buildTopPage } = require('../generate-visa-pages');

const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));

test('プライバシーポリシーに、広告と解析と連絡先が書かれている', () => {
  const html = buildPrivacyPage();
  for (const word of [
    'アドセンス',
    'アナリティクス',
    'Cookie',
    CONTACT,
    '個別の事情についての判断',
  ]) {
    assert.ok(html.includes(word), `プライバシーポリシーに「${word}」が無い`);
  }
  assert.ok(html.includes('?ga=off'), '計測をやめる方法が書かれていない');
});

test('よくある質問に、個別の判断をしない旨が書かれている', () => {
  const html = buildFaqPage();
  assert.ok(FAQ.length >= 5, '質問が少なすぎます');
  assert.ok(html.includes('個別の判断はしません'), '個別の判断をしない旨が無い');
  assert.ok(html.includes('FRESC'), '公式の相談先の案内が無い');
  for (const item of FAQ) {
    assert.ok(item.q_en && item.q_ja, '質問に英語か日本語が無い');
    assert.ok(item.a_en && item.a_ja, '答えに英語か日本語が無い');
  }
});

test('固定ページにも、解析と広告のタグが入っている', () => {
  for (const html of [buildPrivacyPage(), buildFaqPage()]) {
    assert.ok(html.includes('G-44PECD16GK'), '解析タグが無い');
    assert.ok(html.includes('ca-pub-5761092657360295'), 'AdSenseのタグが無い');
  }
});

test('固定ページが書き出されていて、サイトマップにも入っている', () => {
  for (const dir of ['privacy', 'faq']) {
    const file = path.join(ROOT, dir, 'index.html');
    assert.ok(fs.existsSync(file), `/${dir}/ が書き出されていません`);
  }
  const paths = pagePaths(records);
  assert.ok(paths.includes('/privacy/'), 'サイトマップにプライバシーポリシーが無い');
  assert.ok(paths.includes('/faq/'), 'サイトマップによくある質問が無い');
});

test('どのページのフッターからも、両方のページへ行ける', () => {
  // 広告の審査では、どのページからもたどり着けることが見られる。
  const html = buildTopPage(records);
  assert.ok(html.includes('href="/privacy/"'), 'フッターにプライバシーポリシーのリンクが無い');
  assert.ok(html.includes('href="/faq/"'), 'フッターによくある質問のリンクが無い');
});

test('固定ページの書き出しが、いまの中身と一致している', () => {
  const pairs = [
    ['privacy', buildPrivacyPage()],
    ['faq', buildFaqPage()],
  ];
  for (const [dir, expected] of pairs) {
    const file = path.join(ROOT, dir, 'index.html');
    if (!fs.existsSync(file)) continue;
    assert.strictEqual(
      fs.readFileSync(file, 'utf8'),
      expected,
      `/${dir}/ が古いです。cd scraper && npm run static で作り直してください`
    );
  }
});
