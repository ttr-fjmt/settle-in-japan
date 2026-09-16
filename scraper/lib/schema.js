'use strict';

/**
 * 在留資格図鑑（data/visa-types.json）のスキーマ。
 *
 * 【なぜ1か所にまとめるか】
 * 既存3サイトで、同じ意味の分類が実装ごとに割れて増え続けた経緯がある。
 * 分類と許容値はこのファイルだけで決め、他のファイルはここを読む。
 *
 * 【このサイト特有の考え方】
 * 在留資格の情報は、間違えると人の生活に実害が出る。そのため
 *   - 事実を書く項目は、公式ページの本文にある文言をそのまま使う（言い換えない）
 *   - 確認できない項目は null / 'unknown' のままにし、review_flags に理由を残す
 * を守る。言い換えると lib/verify.js の照合に落ちる。それが狙い。
 */

/**
 * 在留資格の区分。出入国在留管理庁「在留資格一覧表」の分け方に合わせている。
 * 勝手に増やさない（増やすときは、公式一覧表のどの区分に対応するかを README に残す）。
 */
const VISA_GROUP = [
  'work', // 就労が認められる在留資格
  'non_work', // 就労が認められない在留資格
  'status_based', // 身分・地位に基づく在留資格（就労の制限なし）
  'designated', // 特定活動（個々の許可の内容による）
];

const VISA_GROUP_LABELS = {
  work: '就労が認められる在留資格',
  non_work: '就労が認められない在留資格',
  status_based: '身分・地位に基づく在留資格',
  designated: '特定活動',
};

/** 就労・家族帯同など「できる／できない」を表す値。確認できないものは unknown のまま残す。 */
const TRISTATE = ['yes', 'no', 'depends', 'unknown'];

/**
 * 出典として認めるホスト。
 * 個人ブログ・まとめサイト・行政書士事務所のサイトは出典にしない
 * （制度を所管していないため。解説としては正しくても、変更に追随する保証がない）。
 */
const OFFICIAL_HOSTS = [
  'moj.go.jp', // 出入国在留管理庁・法務省
  'mhlw.go.jp', // 厚生労働省
  'mofa.go.jp', // 外務省
  'nta.go.jp', // 国税庁
  'nenkin.go.jp', // 日本年金機構
  'digital.go.jp', // デジタル庁
  'e-gov.go.jp', // e-Gov（法令）
  'soumu.go.jp', // 総務省
  'mext.go.jp', // 文部科学省（子どもの就学）
  'cfa.go.jp', // こども家庭庁（児童手当・保育）
  'npa.go.jp', // 警察庁（運転免許・自転車防犯登録）
  'customs.go.jp', // 税関（持ち込みの制限）
];

/** 確認できなかったことを残すための印。理由の分からない空欄を作らないための仕組み。 */
const REVIEW_FLAGS = [
  'work_allowed_unconfirmed',
  'family_stay_unconfirmed',
  'period_unconfirmed',
  'source_outdated',
];

/** 1レコードの形。required は「これが無いと掲載しない」項目。 */
const FIELDS = {
  id: { type: 'string', required: true, pattern: /^[a-z0-9-]+$/ },
  name_ja: { type: 'string', required: true },
  name_en: { type: 'string', required: true },
  group: { type: 'enum', required: true, values: VISA_GROUP },
  /**
   * 公式一覧表の「本邦において行うことができる活動」の文言を、そのまま1つずつ入れる。
   * 高度専門職・特定技能・技能実習のように活動がイ・ロ・ハと分かれている資格があるため配列。
   * つなげて1文にすると本文照合に落ちる（つないだ文は本文に存在しないため）。
   */
  activities_ja: { type: 'string[]', required: true, verifyAgainstSource: true },
  /** 公式一覧表の「該当例」の文言。該当例の欄が無い資格もあるので必須にしない */
  examples_ja: { type: 'string', required: false, verifyAgainstSource: true },
  /** 公式一覧表の「在留期間」の文言をそのまま、1つずつ入れる */
  periods_ja: { type: 'string[]', required: true, verifyAgainstSource: true },
  work_allowed: { type: 'enum', required: true, values: TRISTATE },
  /**
   * 配偶者・子が「家族滞在」の在留資格で在留できるか。
   * 家族滞在のページに対象の在留資格が列挙されており、そこにあるかどうかで決める。
   * no は「家族を呼べない」という意味ではない（外交・公用は在留資格そのものに家族の活動が
   * 含まれ、身分・地位に基づく資格には別の道がある）。画面では「家族滞在の対象」と表示する。
   */
  family_stay: { type: 'enum', required: true, values: TRISTATE },
  /** family_stay の根拠にした出典（sources.json の id）。unknown のときは持たない */
  family_stay_source_id: { type: 'string', required: false },
  source_id: { type: 'string', required: true },
  source_url: { type: 'string', required: true, official: true },
  source_checked_at: { type: 'date', required: true },
  review_flags: { type: 'enum[]', required: false, values: REVIEW_FLAGS },
};

/** 出典として認められるURLか。 */
function isOfficialUrl(url) {
  let host;
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return false;
  }
  return OFFICIAL_HOSTS.some(h => host === h || host.endsWith('.' + h));
}

/** YYYY-MM-DD 形式か（存在する日付かどうかまで見る）。 */
function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * 1レコードを検証し、問題点の配列を返す（問題が無ければ空配列）。
 * 例外は投げない。呼び出し側がまとめて報告できるようにするため。
 */
function validateRecord(record, index = 0) {
  const where = `[${index}] ${record && record.id ? record.id : '(idなし)'}`;
  const problems = [];
  if (!record || typeof record !== 'object') return [`${where}: レコードがオブジェクトではありません`];

  for (const [key, rule] of Object.entries(FIELDS)) {
    const value = record[key];
    const missing = value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (rule.required && missing) {
      problems.push(`${where}: ${key} が空です`);
      continue;
    }
    if (missing) continue;

    if (rule.type === 'string' && typeof value !== 'string') {
      problems.push(`${where}: ${key} は文字列である必要があります`);
    }
    if (rule.pattern && !rule.pattern.test(String(value))) {
      problems.push(`${where}: ${key} の形式が不正です（${value}）`);
    }
    if (rule.type === 'enum' && !rule.values.includes(value)) {
      problems.push(`${where}: ${key} の値 "${value}" は許容されていません（${rule.values.join(' / ')}）`);
    }
    if (rule.type === 'string[]') {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v.trim())) {
        problems.push(`${where}: ${key} は空でない文字列の配列である必要があります`);
      }
    }
    if (rule.type === 'enum[]') {
      if (!Array.isArray(value) || value.some(v => !rule.values.includes(v))) {
        problems.push(`${where}: ${key} に許容されていない値が含まれています`);
      }
    }
    if (rule.type === 'date' && !isIsoDate(value)) {
      problems.push(`${where}: ${key} は YYYY-MM-DD 形式の日付である必要があります（${value}）`);
    }
    if (rule.official && !isOfficialUrl(value)) {
      problems.push(`${where}: ${key} が公式ドメインではありません（${value}）。出典は ${OFFICIAL_HOSTS.join(' / ')} のみ`);
    }
  }

  // 確認できていない項目には、必ず理由の印を残す。
  const flags = record.review_flags || [];
  if (record.work_allowed === 'unknown' && !flags.includes('work_allowed_unconfirmed')) {
    problems.push(`${where}: work_allowed が unknown なのに review_flags に理由がありません`);
  }
  if (record.family_stay === 'unknown' && !flags.includes('family_stay_unconfirmed')) {
    problems.push(`${where}: family_stay が unknown なのに review_flags に理由がありません`);
  }
  return problems;
}

/** 全レコードを検証する。id の重複もここで見る。 */
function validateAll(records) {
  const problems = [];
  if (!Array.isArray(records)) return ['visa-types.json は配列である必要があります'];

  const seen = new Set();
  records.forEach((record, i) => {
    problems.push(...validateRecord(record, i));
    const id = record && record.id;
    if (id) {
      if (seen.has(id)) problems.push(`id が重複しています: ${id}`);
      seen.add(id);
    }
  });
  return problems;
}

module.exports = {
  VISA_GROUP,
  VISA_GROUP_LABELS,
  TRISTATE,
  OFFICIAL_HOSTS,
  REVIEW_FLAGS,
  FIELDS,
  isOfficialUrl,
  isIsoDate,
  validateRecord,
  validateAll,
};
