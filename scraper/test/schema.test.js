'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { validateRecord, validateAll, isOfficialUrl, isIsoDate, VISA_GROUP } = require('../lib/schema');

/** 検証を通る最小のレコード。テストごとに一部だけ壊して使う。 */
const base = () => ({
  id: 'gijinkoku',
  name_ja: '技術・人文知識・国際業務',
  name_en: 'Engineer / Specialist in Humanities / International Services',
  group: 'work',
  activities_ja: ['本邦の公私の機関との契約に基づいて行う業務に従事する活動'],
  periods_ja: ['5年', '3年', '1年', '3月'],
  work_allowed: 'yes',
  family_stay: 'yes',
  source_id: 'visa-list',
  source_url: 'https://www.moj.go.jp/isa/applications/status/qaq5.html',
  source_checked_at: '2026-09-15',
  review_flags: [],
});

test('そろっているレコードは通る', () => {
  assert.deepStrictEqual(validateRecord(base()), []);
});

test('出典が無いレコードは落ちる', () => {
  const r = base();
  delete r.source_url;
  assert.ok(validateRecord(r).some(p => p.includes('source_url')));
});

test('最終確認日が無いレコードは落ちる', () => {
  const r = base();
  delete r.source_checked_at;
  assert.ok(validateRecord(r).some(p => p.includes('source_checked_at')));
});

test('最終確認日は実在する日付でなければ落ちる', () => {
  assert.ok(isIsoDate('2026-09-15'));
  assert.ok(!isIsoDate('2026-02-30'), '2月30日は存在しない');
  assert.ok(!isIsoDate('2026/09/15'));
  const r = base();
  r.source_checked_at = '2026-02-30';
  assert.ok(validateRecord(r).some(p => p.includes('source_checked_at')));
});

test('公式ドメイン以外を出典にすると落ちる', () => {
  // 解説として正しくても、制度の変更に追随する保証がないため出典にしない。
  assert.ok(isOfficialUrl('https://www.moj.go.jp/isa/applications/status/qaq5.html'));
  assert.ok(isOfficialUrl('https://www.mhlw.go.jp/stf/seisakunitsuite/index.html'));
  assert.ok(!isOfficialUrl('https://example-gyosei.com/visa'));
  assert.ok(!isOfficialUrl('https://note.com/someone/n/abc'));
  // moj.go.jp.example.com のような紛らわしいホストも弾く
  assert.ok(!isOfficialUrl('https://moj.go.jp.example.com/fake'));

  const r = base();
  r.source_url = 'https://example-gyosei.com/visa';
  assert.ok(validateRecord(r).some(p => p.includes('公式ドメイン')));
});

test('区分は決めた4つ以外を受け付けない', () => {
  const r = base();
  r.group = 'special';
  assert.ok(validateRecord(r).some(p => p.includes('group')));
  assert.deepStrictEqual(VISA_GROUP.length, 4);
});

test('確認できていない項目には理由の印が要る', () => {
  const r = base();
  r.work_allowed = 'unknown';
  assert.ok(validateRecord(r).some(p => p.includes('work_allowed')), '理由なしのunknownは落ちる');

  r.review_flags = ['work_allowed_unconfirmed'];
  assert.deepStrictEqual(validateRecord(r), [], '理由があれば通る');
});

test('在留期間は空でない文字列の配列', () => {
  const r = base();
  r.periods_ja = [];
  assert.ok(validateRecord(r).some(p => p.includes('periods_ja')));
  r.periods_ja = ['5年', ''];
  assert.ok(validateRecord(r).some(p => p.includes('periods_ja')));
});

test('idの重複は落ちる', () => {
  const problems = validateAll([base(), base()]);
  assert.ok(problems.some(p => p.includes('重複')));
});
