'use strict';

/**
 * HTML を PNG に撮る。ロゴ（favicon など）と OGP画像を作るのに使う。
 *
 * 【追加のパッケージを入れない】
 * このリポジトリは Node 22 の標準機能だけで動かす方針なので、画像化のライブラリは入れず、
 * 環境にあるブラウザをコマンドとして呼ぶ。
 *
 * 【使うのは chrome-headless-shell】
 * ふつうの Chrome を --headless で呼ぶと、指定した窓の大きさと実際に描かれる範囲がずれ、
 * 絵の下（およそ90px）が切れる。画面のない専用版（chrome-headless-shell / headless_shell）は
 * 指定どおりに描くので、そちらを優先して探す。ずれたまま作ると、切れた画像がSNSに出る。
 *
 * 探す順番:
 *   1. 環境変数 CHROME_PATH
 *   2. chrome-headless-shell（各所の定番の置き場所）
 *   3. ふつうの Chrome / Chromium（下が切れるため、その旨を警告する）
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** 画面のない専用版（指定どおりの大きさで描ける） */
const SHELL_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  `${os.homedir()}/.cache/puppeteer/chrome-headless-shell/linux-stable/chrome-headless-shell-linux64/chrome-headless-shell`,
  '/usr/bin/chrome-headless-shell',
];

/** ふつうの Chrome（見つかれば使うが、下が切れる） */
const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function firstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** 見つかったものを探す。専用版を優先。見つからなければ null。 */
function findBrowser() {
  const shell = firstExisting(SHELL_CANDIDATES);
  if (shell) return shell;

  const chrome = firstExisting(CHROME_CANDIDATES);
  if (chrome) return chrome;

  for (const name of ['chrome-headless-shell', 'google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const found = execFileSync('which', [name], { encoding: 'utf8' }).trim();
      if (found) return found;
    } catch {
      // 見つからないだけなので次を試す
    }
  }
  return null;
}

/** 画面のない専用版かどうか（名前で判断する）。 */
function isHeadlessShell(browser) {
  return /headless[-_]shell/.test(browser);
}

/** HTML を width×height の PNG にして outPath に書く。大きさはそのまま画素数になる。 */
function renderPng(html, outPath, { width, height, browser = findBrowser() } = {}) {
  if (!browser) {
    throw new Error(
      'ブラウザが見つかりません。chrome-headless-shell を入れるか、CHROME_PATH で場所を指定してください'
    );
  }
  if (!isHeadlessShell(browser)) {
    console.warn(
      `警告: ${browser} は画面つきの Chrome です。画像の下が切れることがあります（chrome-headless-shell を使ってください）`
    );
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sij-render-'));
  const src = path.join(dir, 'page.html');
  fs.writeFileSync(src, html);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  try {
    execFileSync(
      browser,
      [
        '--headless',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--window-size=${width},${height}`,
        '--virtual-time-budget=3000',
        `--screenshot=${outPath}`,
        `file://${src}`,
      ],
      { stdio: 'pipe' }
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (!fs.existsSync(outPath)) throw new Error(`PNG を書き出せませんでした: ${outPath}`);
  return outPath;
}

/**
 * PNG を ICO に包む（favicon.ico 用）。
 *
 * ICO は中に PNG をそのまま入れられる。ヘッダ6バイト＋1件ぶんの目録16バイトを付けるだけ。
 * 変換ライブラリを入れずに済ませるために、ここで組み立てる。
 */
function pngToIco(pngBuffer, size = 32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // 予約
  header.writeUInt16LE(1, 2); // 種類：アイコン
  header.writeUInt16LE(1, 4); // 枚数
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // 幅（256は0で表す）
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // 高さ
  entry.writeUInt8(0, 2); // 色数（PNGなので0）
  entry.writeUInt8(0, 3); // 予約
  entry.writeUInt16LE(1, 4); // カラープレーン
  entry.writeUInt16LE(32, 6); // 1画素あたりのビット数
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // データの開始位置
  return Buffer.concat([header, entry, pngBuffer]);
}

module.exports = { findBrowser, isHeadlessShell, renderPng, pngToIco };
