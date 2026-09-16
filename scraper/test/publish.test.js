'use strict';

/**
 * 公開に必要な約束を見張る。
 *
 * 公開まわりは「入れ忘れても画面上は何も起きない」ので、気づけないまま放置されやすい。
 * 解析タグが抜けていても、サイトマップが古くても、見た目は正常に見える。だからテストで止める。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { buildTopPage, buildListPage, buildDetailPage } = require('../generate-visa-pages');
const { pagePaths, buildSitemap, buildLlmsTxt } = require('../generate-sitemap');

const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
const GA_ID = 'G-44PECD16GK';
const ADSENSE = 'ca-pub-5761092657360295';

test('どのページにも、アクセス解析とAdSenseのタグが入っている', () => {
  const pages = [buildTopPage(records), buildListPage(records), buildDetailPage(records[0])];
  for (const html of pages) {
    assert.ok(html.includes(GA_ID), '解析タグが無い');
    assert.ok(html.includes(ADSENSE), 'AdSenseのタグが無い');
    assert.ok(html.includes('analytics-opt-out'), '運営者自身を除外するスイッチが無い');
  }
});

test('除外スイッチは、gtag の設定より前に置く', () => {
  // 後ろに置くと、最初のページビューが送られてしまう。
  const html = buildTopPage(records);
  assert.ok(
    html.indexOf('analytics-opt-out') < html.indexOf("gtag('config'"),
    '除外スイッチが gtag の設定より後ろにある'
  );
});

test('公開に必要なファイルが揃っている', () => {
  for (const f of ['CNAME', 'ads.txt', 'robots.txt', 'sitemap.xml', 'llms.txt', '404.html']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} が無い`);
  }
  assert.strictEqual(fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim(), 'settle-in-japan.net');
  assert.ok(fs.readFileSync(path.join(ROOT, 'ads.txt'), 'utf8').includes('pub-5761092657360295'));
  assert.ok(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8').includes('settle-in-japan.net/sitemap.xml'));
});

test('サイトマップに、掲載しているページがすべて入っている', () => {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  for (const p of pagePaths(records)) {
    assert.ok(xml.includes(`https://settle-in-japan.net${p}`), `${p} がサイトマップに無い`);
  }
  // 作り直し忘れの検出（URLの数が合っているか）
  const count = (xml.match(/<loc>/g) || []).length;
  assert.strictEqual(count, pagePaths(records).length, 'sitemap.xml が古いです。npm run sitemap で作り直してください');
});

test('llms.txt に、掲載件数と情報の作り方が書かれている', () => {
  const txt = buildLlmsTxt(records, '2026-09-15');
  assert.ok(txt.includes(`${records.length}件`), '掲載件数が無い');
  assert.ok(txt.includes('推測で埋めず'), '情報の作り方の説明が無い');
  assert.ok(txt.includes('個別の申請についての判断'), '個別相談をしない旨が無い');
});

test('サイトマップは正しいXMLの形をしている', () => {
  const xml = buildSitemap(records, '2026-09-15');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(xml.trimEnd().endsWith('</urlset>'));
});
