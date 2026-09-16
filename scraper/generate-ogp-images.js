'use strict';

/**
 * OGP画像（SNSやチャットでリンクを貼ったときに出る画像）を、ページごとに書き出す。
 *
 * 出力先: assets/ogp/<ページ名>.png（1200×630）
 *   /                     → assets/ogp/top.png
 *   /visa/                → assets/ogp/visa.png
 *   /visa/engineer/       → assets/ogp/visa-engineer.png
 *   /guide/first-14-days/ → assets/ogp/guide-first-14-days.png
 *
 * 画像の中身と名前の決め方は lib/ogp.js にある。ページの <head> も同じところから
 * URLを作るので、画像とページがずれない。
 *
 * すでにある画像は作り直さない（毎日1本ずつ記事を足すとき、増えた1枚だけ作れば済む）。
 * 見た目を変えたときは --all を付けて全部作り直す。
 *
 * 実行例:
 *   node generate-ogp-images.js          # 足りないぶんだけ
 *   node generate-ogp-images.js --all    # 全部作り直す
 *   node generate-ogp-images.js --list   # 何を作るかだけ見る
 */

const fs = require('node:fs');
const path = require('node:path');

const { ogpHtml, ogpFile, OGP_WIDTH, OGP_HEIGHT } = require('./lib/ogp');
const { renderPng, findBrowser } = require('./lib/render');
const { readArticles } = require('./generate-article-pages');

const ROOT = path.join(__dirname, '..');
const VISA_PATH = path.join(ROOT, 'data', 'visa-types.json');

const GROUP_KICKER = {
  work: 'Residence status / 在留資格（就労できる）',
  non_work: 'Residence status / 在留資格（就労できない）',
  designated: 'Residence status / 在留資格（特定活動）',
  status_based: 'Residence status / 在留資格（身分・地位）',
};

/** どのページに、どんな題名の画像を作るか。 */
function ogpTargets(records = JSON.parse(fs.readFileSync(VISA_PATH, 'utf8')), articles = readArticles()) {
  const targets = [
    {
      pagePath: '/',
      kicker: 'settle-in-japan.net',
      titleEn: 'Settling in Japan, explained from the official pages',
      titleJa: '日本で暮らしはじめるための手続きを、公式ページの記載にもとづいて',
    },
    {
      pagePath: '/visa/',
      kicker: 'Residence statuses / 在留資格',
      titleEn: `All ${records.length} residence statuses of Japan`,
      titleJa: `在留資格${records.length}種類の一覧（活動内容・在留期間・就労の可否）`,
    },
    {
      pagePath: '/guide/',
      kicker: 'Guides / 手続きの解説',
      titleEn: 'Step-by-step guides to the paperwork',
      titleJa: '手続きのやり方を、公式ページを引用しながら順を追って',
    },
  ];

  for (const record of records) {
    targets.push({
      pagePath: `/visa/${record.id}/`,
      kicker: GROUP_KICKER[record.group] || 'Residence status / 在留資格',
      titleEn: record.name_en,
      titleJa: `在留資格「${record.name_ja}」`,
    });
  }
  for (const article of articles) {
    targets.push({
      pagePath: `/guide/${article.id}/`,
      kicker: 'Guide / 手続きの解説',
      titleEn: article.title_en,
      titleJa: article.title_ja,
    });
  }
  return targets;
}

function main() {
  const all = process.argv.includes('--all');
  const listOnly = process.argv.includes('--list');
  const targets = ogpTargets();

  const todo = targets.filter(t => all || !fs.existsSync(path.join(ROOT, ogpFile(t.pagePath))));

  if (listOnly) {
    console.log(`全${targets.length}枚のうち、作るのは${todo.length}枚`);
    todo.forEach(t => console.log('  ' + ogpFile(t.pagePath)));
    return;
  }
  if (todo.length === 0) {
    console.log(`OGP画像は${targets.length}枚そろっています（作り直すには --all）`);
    return;
  }
  if (!findBrowser()) {
    // 画像が無いままページだけ出ると、SNSで画像の出ない見た目になる。黙って進めない。
    throw new Error(`OGP画像を${todo.length}枚作れません（ブラウザが見つかりません）`);
  }

  const browser = findBrowser();
  for (const target of todo) {
    const out = path.join(ROOT, ogpFile(target.pagePath));
    renderPng(ogpHtml(target), out, { width: OGP_WIDTH, height: OGP_HEIGHT, browser });
    console.log(`  ${ogpFile(target.pagePath)}`);
  }
  console.log(`OGP画像を${todo.length}枚書き出しました（全${targets.length}枚）`);
}

if (require.main === module) main();

module.exports = { ogpTargets };
