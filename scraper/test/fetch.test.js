'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { htmlToText, USER_AGENT } = require('../fetch-official');

test('HTMLから本文だけを取り出す', () => {
  const html = `
    <html><head><style>.a{color:red}</style><script>var x=1;</script></head>
    <body><h1>在留資格一覧表</h1>
    <table><tr><td>技術・人文知識・国際業務</td><td>5年、3年、1年又は3月</td></tr></table>
    <p>詳しくは&nbsp;窓口へ&lt;お問い合わせ&gt;ください。</p></body></html>`;
  const text = htmlToText(html);

  assert.ok(text.includes('在留資格一覧表'));
  assert.ok(text.includes('技術・人文知識・国際業務'));
  assert.ok(text.includes('5年、3年、1年又は3月'));
  assert.ok(text.includes('<お問い合わせ>'), '実体参照は文字に戻す');
  assert.ok(!text.includes('var x=1'), 'スクリプトは残さない');
  assert.ok(!text.includes('color:red'), 'スタイルは残さない');
  assert.ok(!/<[a-z]/i.test(text), 'タグが残っていない');
});

test('表のセルは区切りが残る（在留期間がつながらない）', () => {
  const text = htmlToText('<tr><td>5年</td><td>3年</td></tr>');
  assert.ok(!text.includes('5年3年'), 'セルが連結すると照合が壊れる');
});

test('名乗り（User-Agent）は ASCII だけ', () => {
  // HTTPヘッダーに日本語を入れると、送信前に例外になって1件も取得できない。
  // 実際に「公式情報の照合用」と書いて3ページすべてが失敗した。その再発をここで止める。
  assert.ok(USER_AGENT.length > 0);
  for (const ch of USER_AGENT) {
    assert.ok(ch.codePointAt(0) <= 0xff, `ASCII以外の文字が入っています: ${ch}`);
  }
  // 実際にヘッダーとして組み立てられるかも確かめる（ここで落ちれば取得も落ちる）
  assert.doesNotThrow(() => new Headers({ 'User-Agent': USER_AGENT }));
});

test('ページ内のリンクを「文字とURL」で取り出す', () => {
  const { extractLinks } = require('../fetch-official');
  const html = `
    <a href="/isa/applications/status/gijinkoku.html">技術・人文知識・国際業務</a>
    <a href="https://www.moj.go.jp/isa/applications/status/permanent.html">永住者</a>
    <a href="https://example.com/other">よその사이트</a>
    <a href="mailto:test@example.com">メール</a>
    <a href="/isa/applications/status/gijinkoku.html">技術・人文知識・国際業務</a>`;
  const links = extractLinks(html, 'https://www.moj.go.jp/isa/applications/status/index.html');

  assert.strictEqual(links.length, 2, '同じ公式サイトのリンクだけを、重複なく取る');
  assert.deepStrictEqual(links[0], {
    text: '技術・人文知識・国際業務',
    url: 'https://www.moj.go.jp/isa/applications/status/gijinkoku.html',
  });
  assert.ok(links.every(l => l.url.startsWith('https://www.moj.go.jp/')), '外部サイトとmailtoは除く');
});
