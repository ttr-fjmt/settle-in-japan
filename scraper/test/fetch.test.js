'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { htmlToText } = require('../fetch-official');

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
