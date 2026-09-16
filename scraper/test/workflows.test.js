'use strict';

/**
 * 毎日の公開が「ページの作り直し忘れ」で止まらないようにする検査。
 *
 * 右下のガイドには記事の一覧が入っているので、記事が1本増えると、固定ページ
 * （/privacy/ /faq/）を含むすべてのページの中身が変わる。作り直すスクリプトを
 * ワークフローに手で並べていたため privacy / faq が抜け、2026-09-17 の自動公開が
 * 「書き出したページが古い」という検査で止まった。
 *
 * そこで、作り直す一式は package.json の build-pages に一本化し、
 * ワークフローはそれを呼ぶだけにする。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SCRAPER = path.join(__dirname, '..');
const ROOT = path.join(SCRAPER, '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

const buildPages = JSON.parse(
  fs.readFileSync(path.join(SCRAPER, 'package.json'), 'utf8')
).scripts['build-pages'];

/** ページを書き出すスクリプト。新しく足したものも自動で検査の対象になる。 */
function pageGenerators() {
  return fs
    .readdirSync(SCRAPER)
    .filter(f => /^generate-.*(pages|sitemap|ogp-images)\.js$/.test(f))
    .sort();
}

test('ページを書き出すスクリプトは、すべて build-pages に入っている', () => {
  assert.ok(buildPages, 'package.json に build-pages がありません');
  for (const file of pageGenerators()) {
    assert.ok(
      buildPages.includes(file),
      `${file} が build-pages に入っていません（作り直し忘れになります）`
    );
  }
});

test('固定ページを作り直すスクリプトが、必ず入っている', () => {
  // 記事が増えると privacy / faq も変わる。ここが抜けて実際に自動公開が止まった。
  assert.ok(buildPages.includes('generate-static-pages.js'));
});

test('ワークフローは、スクリプトを並べずに build-pages を呼ぶ', () => {
  for (const file of ['publish-article.yml', 'translate.yml']) {
    const yml = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    assert.ok(
      yml.includes('npm run build-pages'),
      `${file} が build-pages を呼んでいません`
    );
    const handWritten = yml
      .split('\n')
      .filter(line => /^\s*node generate-.*\.js\s*$/.test(line));
    assert.deepStrictEqual(
      handWritten,
      [],
      `${file} にページを作るスクリプトが直接書かれています（build-pages にまとめてください）:\n${handWritten.join('\n')}`
    );
  }
});
