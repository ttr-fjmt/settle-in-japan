'use strict';

/**
 * 公開中の settle-in-japan.net が、リポジトリの状態どおりになっているかを確かめる。
 * main にマージして GitHub Pages の反映が終わったあとに実行する。
 *
 * 確かめること
 *   - トップ・在留資格の一覧・記事の一覧が開き、解析と広告のタグが入っている
 *   - サイトマップに、いまリポジトリにあるページがすべて入っている
 *   - 在留資格のページと記事のページが開き、出典と最終確認日が出ている
 *   - 固定ページ（よくある質問・プライバシーポリシー）が開く
 *   - SNS用の画像（OGP）が実際に置いてあり、画像として返ってくる
 *   - ロゴ・ads.txt・robots.txt が置いてある
 *
 * 確認対象は毎回 visa-types.json と data/articles/ から選ぶので、掲載が増えてもそのまま使える。
 * 反映直後は古い内容が返ることがあるので、失敗したら数分おいて再実行する。
 *
 * ※ クラウドのセッションからは settle-in-japan.net が許可ドメインに無く実行できない。
 *   パソコン側で実行するか、許可ドメインに足すこと。
 *
 * 実行: cd scraper && npm run verify-live   （問題があれば終了コード1）
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://settle-in-japan.net';
const GA_ID = 'G-44PECD16GK';
const ADSENSE = 'ca-pub-5761092657360295';

const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'visa-types.json'), 'utf8'));
const { readArticles } = require('./generate-article-pages');
const { pagePaths } = require('./generate-sitemap');
const { ogpFile } = require('./lib/ogp');

/**
 * 取得する。キャッシュを避けるため、毎回ちがう問い合わせを付ける。
 *
 * 【プロキシ対応】
 * パソコンからは直接つなぐ。クラウドのセッションは外に出るときプロキシを通るため、
 * 環境変数 HTTPS_PROXY があるときは、そこにトンネル（CONNECT）を掘ってから TLS でつなぐ。
 * 対応していないと、クラウドからは全部 403 になる（実際に起きた）。
 */
function openSocket(target) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return Promise.resolve(null); // 直接つなぐ

  const { hostname, port, username, password } = new URL(proxy);
  const headers = {};
  if (username) {
    headers['proxy-authorization'] =
      'Basic ' + Buffer.from(`${decodeURIComponent(username)}:${decodeURIComponent(password)}`).toString('base64');
  }
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: hostname,
      port: port || 80,
      method: 'CONNECT',
      path: `${target.hostname}:443`,
      headers,
    });
    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) return reject(new Error(`プロキシが ${res.statusCode} を返しました`));
      resolve(socket);
    });
    req.on('error', reject);
    req.end();
  });
}

async function get(url, { method = 'GET' } = {}) {
  const sep = url.includes('?') ? '&' : '?';
  const target = new URL(`${url}${sep}nocache=${Date.now()}`);
  const socket = await openSocket(target);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: target.hostname,
        servername: target.hostname,
        path: target.pathname + target.search,
        method,
        socket: socket || undefined,
        agent: socket ? false : undefined,
        headers: { 'user-agent': 'settle-in-japan-verify-live', host: target.hostname },
      },
      res => {
        let body = '';
        res.on('data', c => {
          body += c;
        });
        res.on('end', () =>
          resolve({ status: res.statusCode, body, type: res.headers['content-type'] || '' })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  let ok = true;
  const check = (label, cond, detail = '') => {
    console.log(`${cond ? '✔' : '✖'} ${label}${detail ? `  ${detail}` : ''}`);
    if (!cond) ok = false;
  };

  const articles = readArticles();

  // 1. 主要なページが開き、解析と広告のタグが入っている
  for (const [label, url] of [
    ['トップ', `${BASE}/`],
    ['在留資格の一覧', `${BASE}/visa/`],
    ['記事の一覧', `${BASE}/guide/`],
    ['よくある質問', `${BASE}/faq/`],
    ['プライバシーポリシー', `${BASE}/privacy/`],
  ]) {
    const res = await get(url);
    check(`${label}が開く`, res.status === 200, `HTTP ${res.status}`);
    if (res.status === 200) {
      check(`${label}に解析と広告のタグがある`, res.body.includes(GA_ID) && res.body.includes(ADSENSE));
      check(`${label}にOGP画像の指定がある`, res.body.includes('property="og:image"'));
    }
  }

  // 2. サイトマップに、いまあるページがすべて入っている
  const sitemap = await get(`${BASE}/sitemap.xml`);
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const missing = pagePaths(records, articles).filter(p => !locs.includes(`${BASE}${p}`));
  check('サイトマップに全ページが入っている', sitemap.status === 200 && missing.length === 0,
    `${locs.length} URL / 足りない ${missing.length}${missing.length ? '：' + missing.slice(0, 3).join(', ') : ''}`);

  // 3. 在留資格のページ（1件）に、出典と最終確認日が出ている
  const record = records[0];
  const visa = await get(`${BASE}/visa/${record.id}/`);
  check(`在留資格「${record.name_ja}」のページが開く`, visa.status === 200, `HTTP ${visa.status}`);
  if (visa.status === 200) {
    check('出典のURLが出ている', visa.body.includes(record.source_url));
    check('最終確認日が出ている', visa.body.includes(record.source_checked_at));
  }

  // 4. 記事（いちばん新しい1本）が開き、引用と出典が出ている
  if (articles.length) {
    const article = articles[0];
    const res = await get(`${BASE}/guide/${article.id}/`);
    check(`記事「${article.title_ja}」が開く`, res.status === 200, `HTTP ${res.status}`);
    if (res.status === 200) {
      const quote = article.sections.flatMap(s => s.quotes || [])[0];
      check('公式の引用が出ている', quote ? res.body.includes(quote.text.slice(0, 20)) : true);
      check('最終確認日が出ている', res.body.includes(article.published_at));
    }
  }

  // 5. SNS用の画像が実際に置いてある（リンクだけあって画像が無い、を防ぐ）
  for (const p of ['/', '/visa/', articles.length ? `/guide/${articles[0].id}/` : '/guide/']) {
    const res = await get(`${BASE}/${ogpFile(p)}`);
    check(`OGP画像がある（${p}）`, res.status === 200 && res.type.includes('image/png'), `HTTP ${res.status}`);
  }

  // 6. 公開に必要なファイル
  for (const [label, file, must] of [
    ['ads.txt', '/ads.txt', 'pub-5761092657360295'],
    ['robots.txt', '/robots.txt', 'sitemap.xml'],
  ]) {
    const res = await get(`${BASE}${file}`);
    check(`${label} が置いてある`, res.status === 200 && res.body.includes(must), `HTTP ${res.status}`);
  }
  for (const file of ['/favicon.svg', '/apple-touch-icon.png']) {
    const res = await get(`${BASE}${file}`);
    check(`${file} が置いてある`, res.status === 200, `HTTP ${res.status}`);
  }

  console.log(ok ? '\n公開サイトはリポジトリどおりです。' : '\n食い違いがあります（反映直後なら数分おいて再実行）。');
  if (!ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
