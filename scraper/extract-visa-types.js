'use strict';

/**
 * 保存した「在留資格一覧表」の本文（data/raw/visa-list.txt）から、
 * data/visa-types.json を組み立てる。
 *
 * 【手で書き写さない理由】
 * 在留資格は29種類あり、活動内容は法律の条文そのままで長い。手で写すと必ず誤字が出るし、
 * 公式ページが更新されたときに作り直せない。ここを機械にやらせておけば、
 * 取得し直して再実行するだけで最新に合わせられる。
 *
 * 【本文のつくり】
 * 一覧表は「在留資格名 / 活動内容 / 該当例 / 在留期間」の4行が1組で並んでいる。
 * 高度専門職・特定技能・技能実習だけは「１号」「２号」に分かれ、活動がイ・ロ・ハと続く。
 * 表の区切り（一の表＝就労資格 … 五の表）も本文に書かれているので、就労の可否はそこから取る。
 *
 * 【書いていないことは埋めない】
 * 家族帯同の可否はこの一覧表に書かれていないので、すべて unknown にして理由を残す。
 * 身分・地位に基づく在留資格と特定活動の就労可否も、この表には書かれていないので unknown。
 * （それぞれの個別ページを取得したら埋める）
 *
 * 実行例:
 *   node extract-visa-types.js            # data/visa-types.json を書き出す
 *   node extract-visa-types.js --dry-run  # 書き出さずに結果を表示する
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW_PATH = path.join(ROOT, 'data', 'raw', 'visa-list.txt');
const OUT_PATH = path.join(ROOT, 'data', 'visa-types.json');
const SOURCE_ID = 'visa-list';
const SOURCE_URL = 'https://www.moj.go.jp/isa/applications/status/qaq5.html';

/** 在留資格の名前と、ページのURLに使う id。順番は一覧表の並びに合わせている。 */
const STATUSES = [
  { name: '外交', id: 'diplomat', en: 'Diplomat' },
  { name: '公用', id: 'official', en: 'Official' },
  { name: '教授', id: 'professor', en: 'Professor' },
  { name: '芸術', id: 'artist', en: 'Artist' },
  { name: '宗教', id: 'religious-activities', en: 'Religious Activities' },
  { name: '報道', id: 'journalist', en: 'Journalist' },
  { name: '高度専門職', id: 'highly-skilled-professional', en: 'Highly Skilled Professional' },
  { name: '経営・管理', id: 'business-manager', en: 'Business Manager' },
  { name: '法律・会計業務', id: 'legal-accounting-services', en: 'Legal / Accounting Services' },
  { name: '医療', id: 'medical-services', en: 'Medical Services' },
  { name: '研究', id: 'researcher', en: 'Researcher' },
  { name: '教育', id: 'instructor', en: 'Instructor' },
  { name: '技術・人文知識・国際業務', id: 'engineer-specialist', en: 'Engineer / Specialist in Humanities / International Services' },
  { name: '企業内転勤', id: 'intra-company-transferee', en: 'Intra-company Transferee' },
  { name: '介護', id: 'nursing-care', en: 'Nursing Care' },
  { name: '興行', id: 'entertainer', en: 'Entertainer' },
  { name: '技能', id: 'skilled-labor', en: 'Skilled Labor' },
  { name: '特定技能', id: 'specified-skilled-worker', en: 'Specified Skilled Worker' },
  { name: '技能実習', id: 'technical-intern-training', en: 'Technical Intern Training' },
  { name: '文化活動', id: 'cultural-activities', en: 'Cultural Activities' },
  { name: '短期滞在', id: 'temporary-visitor', en: 'Temporary Visitor' },
  { name: '留学', id: 'student', en: 'Student' },
  { name: '研修', id: 'trainee', en: 'Trainee' },
  { name: '家族滞在', id: 'dependent', en: 'Dependent' },
  { name: '特定活動', id: 'designated-activities', en: 'Designated Activities' },
  { name: '永住者', id: 'permanent-resident', en: 'Permanent Resident' },
  { name: '日本人の配偶者等', id: 'spouse-of-japanese-national', en: 'Spouse or Child of Japanese National' },
  { name: '永住者の配偶者等', id: 'spouse-of-permanent-resident', en: 'Spouse or Child of Permanent Resident' },
  { name: '定住者', id: 'long-term-resident', en: 'Long Term Resident' },
];

/** 「１号」「２号」のように号で分かれている在留資格。 */
const NUMBERED = new Set(['高度専門職', '特定技能', '技能実習']);
const NUMBER_MARKER = /^[１２３]号$/;

/** 本文を、空行を除いた行の配列にする（タブと改行コードは落とす）。 */
function readLines() {
  return fs
    .readFileSync(RAW_PATH, 'utf8')
    .split('\n')
    .map(l => l.replace(/\r/g, '').replace(/\t/g, '').trim());
}

/**
 * 在留期間の行か。
 * 一覧表の在留期間は「５年，３年，１年又は３月」「無期限」「外交活動の期間」
 * 「法務大臣が個々に指定する期間（３年を超えない範囲）」のいずれかの形をしている。
 */
function isPeriodLine(line) {
  if (!line || line.length > 160) return false;
  if (line === '無期限') return true;
  if (/活動の期間$/.test(line)) return true;
  if (/指定する期間/.test(line)) return true;
  // 「５年，３年，１年又は３月」「９０日、３０日又は１５日（…）」のような列挙
  return /^[０-９0-9]+[年月日]([，、,]|又は|[０-９0-9]+[年月日]|（[^）]*）|\s)*$/.test(line);
}

/** 活動の続き（イ・ロ・ハ・ニ）の行か。在留期間の行より後ろに続くことがある。 */
function isContinuationLine(line) {
  return /^[イロハニ]/.test(line);
}

/**
 * 表の1組（在留資格名の次から、次の在留資格名まで）を、
 * 活動内容・該当例・在留期間に振り分ける。
 *
 * 並びは「活動内容 → 該当例 → 在留期間」で、そのあとに活動の続き（ロ・ハなど）や
 * ページのフッターが続くことがある。そこで在留期間の行を先に見つけ、
 *   - その1つ前 → 該当例（ただしイ・ロ・ハで始まるなら活動の続きなので該当例は無し）
 *   - それより前 → 活動内容
 *   - 在留期間より後ろでイ・ロ・ハで始まる行 → 活動内容の続き
 * として振り分ける。フッターなど、それ以外の行は捨てる。
 */
function splitPart(part) {
  const periodIndex = part.findIndex(isPeriodLine);
  if (periodIndex < 0) return null;

  const hasExample = periodIndex > 0 && !isContinuationLine(part[periodIndex - 1]);
  const exampleIndex = hasExample ? periodIndex - 1 : -1;
  const activities = part.slice(0, hasExample ? periodIndex - 1 : periodIndex);
  const continuations = part.slice(periodIndex + 1).filter(isContinuationLine);

  return {
    activities: [...activities, ...continuations],
    example: hasExample ? part[exampleIndex] : null,
    period: part[periodIndex],
  };
}

/**
 * 表の区切り（一の表〜五の表）と、五の表の中の「本邦において有する身分または地位」から、
 * その行がどの区分に属するかを返す。
 */
function sectionAt(lines, index) {
  let section = null;
  for (let i = index; i >= 0; i -= 1) {
    const l = lines[i];
    if (/^五の表/.test(l)) return section === 'status_based' ? 'status_based' : 'designated';
    if (/^[三四]の表/.test(l)) return 'non_work';
    if (/^[一二]の表/.test(l)) return 'work';
    if (l === '本邦において有する身分または地位') section = 'status_based';
  }
  return null;
}

/** 在留資格ごとに、本文の担当範囲（次の在留資格の直前まで）を切り出す。 */
function regionsOf(lines) {
  // ページ上部のメニューにも同じ言葉が出るため、表が始まる「一の表」より後だけを見る。
  const tableStart = lines.findIndex(l => /^一の表/.test(l));
  const marks = STATUSES.map(s => ({
    ...s,
    line: lines.findIndex((l, i) => i > tableStart && l === s.name),
  }));
  const missing = marks.filter(m => m.line < 0);
  if (missing.length) {
    throw new Error('本文に見つからない在留資格があります: ' + missing.map(m => m.name).join('、'));
  }
  return marks.map((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].line : lines.length;
    return { ...m, body: lines.slice(m.line + 1, end).filter(Boolean) };
  });
}

/** 号で分かれていない資格を1件にまとめる。 */
function buildSimple(region, group, checkedAt) {
  const parts = splitPart(region.body);
  if (!parts) throw new Error(`${region.name}: 在留期間の行が見つかりません`);
  return [record(region.id, region.name, region.en, group, parts, checkedAt)];
}

/** 号で分かれている資格（高度専門職・特定技能・技能実習）を、号ごとの件にする。 */
function buildNumbered(region, group, checkedAt) {
  const body = region.body;
  const starts = [];
  body.forEach((l, i) => {
    if (NUMBER_MARKER.test(l)) starts.push({ number: l, at: i });
  });
  if (starts.length === 0) return buildSimple(region, group, checkedAt);

  const suffixes = { '１号': '1', '２号': '2', '３号': '3' };
  const romans = { '１号': 'i', '２号': 'ii', '３号': 'iii' };
  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : body.length;
    const parts = splitPart(body.slice(s.at + 1, end));
    if (!parts) throw new Error(`${region.name}${s.number}: 在留期間の行が見つかりません`);
    return record(
      `${region.id}-${suffixes[s.number]}`,
      `${region.name}${s.number}`,
      `${region.en} (${romans[s.number]})`,
      group,
      parts,
      checkedAt
    );
  });
}

function record(id, nameJa, nameEn, group, parts, checkedAt) {
  // 就労の可否は、一覧表が「就労資格／非就労資格」と書いている区分からだけ取る。
  // 身分・地位に基づく在留資格と特定活動は、この表に書かれていないので unknown のままにする。
  const workAllowed = group === 'work' ? 'yes' : group === 'non_work' ? 'no' : 'unknown';
  const flags = [];
  if (workAllowed === 'unknown') flags.push('work_allowed_unconfirmed');
  // 家族帯同の可否は、この一覧表には書かれていない。
  flags.push('family_stay_unconfirmed');

  return {
    id,
    name_ja: nameJa,
    name_en: nameEn,
    group,
    activities_ja: parts.activities,
    examples_ja: parts.example,
    periods_ja: [parts.period],
    work_allowed: workAllowed,
    family_stay: 'unknown',
    source_id: SOURCE_ID,
    source_url: SOURCE_URL,
    source_checked_at: checkedAt,
    review_flags: flags,
  };
}

/** 取得日は本文の先頭に書いてある（fetch-official.js が入れている）。 */
function fetchedDate(lines) {
  const line = lines.find(l => l.startsWith('# 取得日:'));
  const date = line && line.replace('# 取得日:', '').trim();
  if (!date) throw new Error('本文に取得日が見当たりません。fetch-official.js で取り直してください');
  return date;
}

function main() {
  const lines = readLines();
  const checkedAt = fetchedDate(lines);
  const records = [];

  for (const region of regionsOf(lines)) {
    const group = sectionAt(lines, region.line);
    if (!group) throw new Error(`${region.name}: どの表に属するか判定できません`);
    const built = NUMBERED.has(region.name)
      ? buildNumbered(region, group, checkedAt)
      : buildSimple(region, group, checkedAt);
    records.push(...built);
  }

  console.log(`在留資格: ${records.length}件（取得日 ${checkedAt}）`);
  for (const r of records) {
    console.log(
      `  ${r.id.padEnd(32)} ${r.name_ja.padEnd(16)} 就労=${r.work_allowed.padEnd(7)} ` +
        `活動${r.activities_ja.length}件 期間${r.periods_ja.length}件`
    );
  }

  if (process.argv.includes('--dry-run')) {
    console.log('\n[DRY RUN] 書き込みませんでした');
    return;
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(records, null, 2) + '\n');
  console.log(`\n${path.relative(ROOT, OUT_PATH)} に書き出しました`);
}

if (require.main === module) main();

module.exports = { isPeriodLine, isContinuationLine, splitPart, STATUSES };
