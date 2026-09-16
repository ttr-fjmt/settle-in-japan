'use strict';

/**
 * トップページのタイル（探しているものから選ぶ入口）の分類。
 *
 * 【なぜ「時期」ではなく「用事」で分けるのか】
 * もとは「来日直後」「長く住む」と時期で分けていたが、探す人は
 * 「在留カード」「健康保険」と**用事**で探す。自分が今どの時期かは、本人にも分かりにくい。
 * （右下の道案内は「時期 → 用事」の2問。こちらは用事そのものを並べた入口）
 *
 * 【100本の題材を、ちょうど1か所ずつ入れる】
 * どのタイルからもたどり着けない記事が出ないよう、題材の番号
 * （data/article-queue.json の n）で割り当て、抜けと重なりをテストで見張る。
 *
 * 件数（「記事3本」など）は公開済みの記事から数える。中身の無いタイルは
 * 「準備中」と薄く出す。押しても何も無いページには飛ばさない。
 */

const CATEGORIES = [
  {
    id: 'visa',
    icon: 'status',
    en: 'Visa types',
    ja: '在留資格',
    href: '/visa/',
    topics: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 61, 62, 63, 65, 66, 67, 69, 80],
  },
  {
    id: 'residence-card',
    icon: 'card',
    en: 'Residence card',
    ja: '在留カード',
    topics: [18, 20, 64, 70, 81, 82, 83],
  },
  {
    id: 'city-office',
    icon: 'guide',
    en: 'City office',
    ja: '役所の手続き',
    topics: [16, 17, 21, 23, 26, 31, 32, 33, 34, 35, 74, 77, 78, 100],
  },
  {
    id: 'housing',
    icon: 'home',
    en: 'Housing',
    ja: '住まい',
    topics: [27, 28, 29, 30, 71, 92, 93],
  },
  {
    id: 'health',
    icon: 'health',
    en: 'Health & hospitals',
    ja: '健康保険と医療',
    topics: [19, 25, 43, 44, 45, 46, 47, 51, 75, 76, 97],
  },
  {
    id: 'money',
    icon: 'money',
    en: 'Tax & pension',
    ja: '税金と年金',
    topics: [22, 24, 36, 37, 38, 39, 40, 41, 42, 72, 73],
  },
  {
    id: 'work',
    icon: 'work',
    en: 'Working in Japan',
    ja: '働く',
    topics: [54, 55, 56, 57, 58, 59, 60, 84, 85, 86, 87],
  },
  {
    id: 'family',
    icon: 'family',
    en: 'Family & school',
    ja: '家族と学校',
    topics: [10, 48, 49, 50, 52, 53, 68, 79, 95],
  },
  {
    id: 'help',
    icon: 'help',
    en: 'In trouble',
    ja: '困ったとき',
    topics: [88, 89, 90, 91, 94, 96, 98, 99],
  },
];

/** 分類に入れた題材の番号を全部（抜け・重なりの検査に使う）。 */
function assignedTopicNumbers() {
  return CATEGORIES.flatMap(c => c.topics);
}

/** 題材の番号から、どの分類か。 */
function categoryOf(n) {
  return CATEGORIES.find(c => c.topics.includes(n)) || null;
}

/**
 * 分類ごとの中身をまとめる。
 * count は公開済みの記事の数。articles は公開済みの記事、queue は題材リスト。
 */
function categorise({ queue, articles }) {
  const byId = new Map(articles.map(a => [a.id, a]));
  return CATEGORIES.map(category => {
    const topics = category.topics
      .map(n => queue.find(t => t.n === n))
      .filter(Boolean);
    const published = topics.map(t => byId.get(t.id)).filter(Boolean);
    return { ...category, topics, articles: published, count: published.length };
  });
}

module.exports = { CATEGORIES, assignedTopicNumbers, categoryOf, categorise };
