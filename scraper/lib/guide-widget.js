'use strict';

/**
 * 右下の追従ボタン（道案内）。
 *
 * 【何のためのものか】
 * このサイトは在留資格33件と解説記事100本を目指す作りで、目当ての情報にたどり着きにくい。
 * 読者は日本語が読めず、「自分が何を知らないか」も分からないことが多い。
 * そこで、どのページからでも2問で入口までたどり着ける道案内を、全ページの右下に置く。
 *
 * 【この道案内がやること・やらないこと】
 * やること　：いまの状況に近いページへ案内する（記事・在留資格のページ）
 * やらないこと：個別の判断（「この在留資格が取れる」など）。それは公式窓口の仕事
 *
 * 【リンク切れを作らない】
 * まだ書いていない題材は、リンクにせず「準備中（Coming soon）」と出す。
 * 何がある予定のサイトかは伝わるが、押しても何も無いページには飛ばさない。
 * どのリンクも実在するページかは npm test が確かめる（test/guide-widget.test.js）。
 *
 * 【データの持ち方】
 * 題材の割り振り（どの段階の、どの知りたいことか）はこのファイルの NEEDS だけで決める。
 * 100本すべてがちょうど1か所に入っているかをテストで見張る。
 */

const fs = require('node:fs');
const path = require('node:path');

const { icon } = require('./icons');

const ROOT = path.join(__dirname, '..', '..');

/**
 * 段階（1問目）と、知りたいこと（2問目）。
 * 数字は data/article-queue.json の題材の番号。ここに入れ忘れた題材はテストで落ちる。
 */
const STAGES = [
  {
    id: 'before',
    icon: 'move',
    label_en: 'Before you come to Japan',
    label_ja: 'これから日本へ来る',
    needs: [
      { id: 'which-status', en: 'Which status of residence', ja: 'どの在留資格か', topics: [1, 2, 5, 6, 7, 8, 9, 10, 11] },
      { id: 'applying', en: 'How to apply', ja: '申請のしかた', topics: [3, 4, 12, 13] },
      { id: 'packing', en: 'What to prepare', ja: '用意するもの', topics: [14, 15] },
    ],
  },
  {
    id: 'arrived',
    icon: 'card',
    label_en: 'I have just arrived',
    label_ja: '着いたばかり',
    needs: [
      { id: 'first-days', en: 'The first two weeks', ja: '最初の2週間', topics: [16, 17, 18, 20] },
      { id: 'insurance', en: 'Health insurance and pension', ja: '健康保険と年金', topics: [19, 24, 25] },
      { id: 'setting-up', en: 'Setting up daily life', ja: '生活の立ち上げ', topics: [21, 22, 23, 26, 30, 31, 32] },
      { id: 'housing', en: 'Finding a home', ja: '住まいを借りる', topics: [27, 28, 29] },
      { id: 'city-office', en: 'At the city office', ja: '役所の手続き', topics: [33, 34, 35] },
    ],
  },
  {
    id: 'living',
    icon: 'home',
    label_en: 'I am living in Japan',
    label_ja: 'もう暮らしている',
    needs: [
      { id: 'tax', en: 'Tax and your payslip', ja: '税金と給与', topics: [36, 37, 38, 39, 40] },
      { id: 'health', en: 'Insurance, pension, hospitals', ja: '保険・年金・病院', topics: [41, 42, 43, 44, 45] },
      { id: 'family', en: 'Family and children', ja: '家族と子ども', topics: [46, 47, 48, 49, 50, 51] },
      { id: 'work', en: 'Work and job hunting', ja: '仕事とルール', topics: [54, 55, 56, 57, 58, 59, 60] },
      { id: 'language', en: 'Learning Japanese', ja: '日本語を学ぶ', topics: [52, 53] },
    ],
  },
  {
    id: 'longer',
    icon: 'clock',
    label_en: 'Staying longer, or leaving',
    label_ja: '長く住む・帰国する',
    needs: [
      { id: 'renew', en: 'Renewing or changing status', ja: '在留期間の更新・変更', topics: [61, 62, 63, 64, 70] },
      { id: 'permanent', en: 'Permanent residence', ja: '永住と帰化', topics: [65, 66, 67] },
      { id: 'family-longer', en: 'Family and travel', ja: '家族を呼ぶ・再入国', topics: [68, 69] },
      { id: 'money-longer', en: 'Money, home and insurance', ja: 'お金・住まい・保険', topics: [71, 75, 76, 77, 79, 80] },
      { id: 'leaving', en: 'Leaving Japan', ja: '日本を離れる', topics: [72, 73, 74, 78, 100] },
    ],
  },
  {
    id: 'trouble',
    icon: 'health',
    label_en: 'Something has gone wrong',
    label_ja: '困っている',
    needs: [
      { id: 'documents', en: 'Lost card, passport, overstay', ja: 'カード・在留期間', topics: [81, 82, 83] },
      { id: 'work-trouble', en: 'Trouble at work', ja: '仕事のトラブル', topics: [84, 85, 86, 87, 97] },
      { id: 'money-trouble', en: 'Money and housing', ja: 'お金と住まい', topics: [92, 93, 94, 99] },
      { id: 'safety', en: 'Safety and disasters', ja: '安全・災害', topics: [96, 98] },
      { id: 'where-to-ask', en: 'Where to ask for help', ja: '相談できる窓口', topics: [88, 89, 90, 91, 95] },
    ],
  },
];

/** 割り振った題材の番号を全部（重なり・抜けの検査に使う）。 */
function assignedTopicNumbers() {
  return STAGES.flatMap(stage => stage.needs.flatMap(need => need.topics));
}

/**
 * 道案内が使うデータを組み立てる。
 * 公開済みの記事はリンクにし、まだのものは題名だけを「準備中」として持つ。
 */
function buildGuideData({ queue, articles, records }) {
  const articleById = new Map(articles.map(a => [a.id, a]));

  const stages = STAGES.map(stage => ({
    id: stage.id,
    icon: stage.icon,
    en: stage.label_en,
    ja: stage.label_ja,
    needs: stage.needs.map(need => ({
      en: need.en,
      ja: need.ja,
      items: need.topics.map(n => {
        const topic = queue.find(t => t.n === n);
        const article = topic ? articleById.get(topic.id) : null;
        return article
          ? { href: `/guide/${article.id}/`, en: article.title_en, ja: article.title_ja }
          : { en: null, ja: topic ? topic.title_ja : `#${n}` };
      }),
    })),
  }));

  const visas = records.map(r => ({ id: r.id, en: r.name_en, ja: r.name_ja }));
  return { stages, visas };
}

/** 道案内の見た目。ページ共通のスタイルに混ぜて使う。 */
const GUIDE_WIDGET_CSS = `
/* 右下の道案内。本文の邪魔をしないよう、閉じているときはボタンだけ */
#guide-widget{position:fixed;right:18px;bottom:18px;z-index:800;display:flex;flex-direction:column;
  align-items:flex-end;gap:10px}
#guide-widget[hidden]{display:none}

.guide-fab{display:inline-flex;align-items:center;gap:9px;text-align:left;border:0;cursor:pointer;
  background:var(--indigo-deep);color:#fffdf8;border-bottom:3px solid var(--vermilion);
  font:600 .9rem/1.2 inherit;padding:13px 18px;border-radius:999px;
  box-shadow:0 6px 20px rgba(22,41,74,.28)}
.guide-fab:hover{background:var(--indigo)}
.guide-fab .icon{color:#fffdf8}
.guide-fab .ja{display:block;font-weight:400;font-size:.75rem;color:#c9d6e6;margin-top:1px}
.guide-panel{width:min(24rem,calc(100vw - 36px));max-height:min(32rem,calc(100vh - 120px));
  overflow-y:auto;background:var(--surface);border:1px solid var(--line);border-radius:6px;
  box-shadow:0 12px 32px rgba(22,41,74,.22)}
.guide-panel[hidden]{display:none}
.guide-head{position:sticky;top:0;background:var(--indigo-deep);color:#fffdf8;padding:14px 16px;
  display:flex;justify-content:space-between;align-items:center;gap:10px}
.guide-head b{font-size:.95rem}
.guide-head span{display:block;font-weight:400;font-size:.75rem;color:#c9d6e6}
.guide-close{background:none;border:0;color:#fffdf8;font-size:1.3rem;line-height:1;cursor:pointer;padding:2px 6px}
.guide-body{padding:16px}
.guide-q{font-weight:700;font-size:.92rem;margin:0 0 4px}
.guide-q .ja{display:block;font-weight:400;font-size:.78rem;color:var(--ink-2)}
.guide-list{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}
.guide-list button,.guide-list a{display:flex;align-items:flex-start;gap:9px;width:100%;text-align:left;
  background:var(--surface-2);border:1px solid var(--line);border-radius:4px;padding:11px 13px;
  font:inherit;font-size:.87rem;color:var(--ink);cursor:pointer;text-decoration:none}
.guide-list button:hover,.guide-list a:hover{border-color:var(--indigo);background:var(--indigo-soft)}
.guide-list .ja{display:block;font-size:.78rem;color:var(--ink-2);margin-top:2px}
.guide-list .icon{color:var(--indigo);margin-top:2px}
.guide-list li.soon{background:var(--surface-2);border:1px dashed var(--line);border-radius:4px;
  padding:11px 13px;font-size:.87rem;color:var(--ink-3)}
.guide-list li.soon .tag{display:block;width:fit-content;font-size:.7rem;margin-top:6px;padding:1px 8px;
  border-radius:999px;border:1px solid var(--line);color:var(--ink-3)}
.guide-back{background:none;border:0;color:var(--ink-2);font:inherit;font-size:.8rem;cursor:pointer;
  padding:0 0 10px}
.guide-back:hover{color:var(--indigo)}
.guide-foot{border-top:1px solid var(--line);margin-top:16px;padding-top:14px}
.guide-foot select{width:100%;padding:9px 10px;font:inherit;font-size:.85rem;border:1px solid var(--line);
  border-radius:4px;background:var(--surface);color:var(--ink);margin-top:6px}
.guide-foot p{margin:0;font-size:.78rem;color:var(--ink-2)}
.guide-note{margin-top:14px;font-size:.75rem;color:var(--ink-3);line-height:1.7}
@media (max-width:480px){
  /* 画面が狭いときは日本語を省く。読者は英語で読む人が中心なので、英語を残す */
  #guide-widget{right:12px;bottom:12px}
  .guide-fab{padding:12px 16px}
  .guide-fab .ja{display:none}
}`;

/**
 * 道案内のHTML（ボタン・パネル・動き）。
 * JavaScript が動かない環境ではボタンを出さない（押しても何も起きないボタンを見せないため）。
 */
function guideWidgetHtml(data) {
  // <script> の中に JSON を書くので、"</script>" になりうる < を必ず逃がす。
  // 逃がさないと、題名に < が入った瞬間にページ全体が壊れる。
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<div id="guide-widget" hidden>
<div id="guide-panel" class="guide-panel" hidden role="dialog" aria-label="Where do I start? / どこから始める？"></div>
<button id="guide-fab" class="guide-fab" type="button" aria-expanded="false" aria-controls="guide-panel">
${icon('guide', 20)}<span><span class="en-long">Where do I start?</span><span class="ja">どこから始める？</span></span>
</button>
</div>
<script>
(function () {
  var DATA = ${json};
  var widget = document.getElementById('guide-widget');
  var fab = document.getElementById('guide-fab');
  var panel = document.getElementById('guide-panel');
  if (!widget || !fab || !panel) return;
  widget.hidden = false; // JavaScript が動くときだけ見せる

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var head = function () {
    return '<div class="guide-head"><b>Where do I start?<span>どこから始める？</span></b>' +
      '<button class="guide-close" type="button" aria-label="Close / 閉じる">&times;</button></div>';
  };
  var foot = function () {
    var options = DATA.visas.map(function (v) {
      return '<option value="/visa/' + esc(v.id) + '/">' + esc(v.en) + '（' + esc(v.ja) + '）</option>';
    }).join('');
    return '<div class="guide-foot">' +
      '<p>Find by residence status<br>在留資格から探す</p>' +
      '<select id="guide-visa"><option value="">— Select / 選んでください —</option>' + options + '</select>' +
      '<p class="guide-note">This guide only points to pages that explain the official rules. ' +
      'It does not decide individual cases — for that, please ask an official counter.<br>' +
      'この道案内は、制度を説明したページへの案内だけを行います。個別の判断はしません。</p>' +
      '<p class="guide-note"><a href="/guide/">All guides / 記事の一覧</a> ・ ' +
      '<a href="/visa/">All residence statuses / 在留資格の一覧</a></p>' +
      '</div>';
  };

  function renderStages() {
    var items = DATA.stages.map(function (stage, i) {
      return '<li><button type="button" data-stage="' + i + '"><span>' + esc(stage.en) +
        '<span class="ja">' + esc(stage.ja) + '</span></span></button></li>';
    }).join('');
    panel.innerHTML = head() + '<div class="guide-body">' +
      '<p class="guide-q">Where are you now?<span class="ja">いまどの段階ですか</span></p>' +
      '<ul class="guide-list">' + items + '</ul>' + foot() + '</div>';
  }

  function renderNeeds(stageIndex) {
    var stage = DATA.stages[stageIndex];
    var items = stage.needs.map(function (need, i) {
      return '<li><button type="button" data-stage="' + stageIndex + '" data-need="' + i + '"><span>' +
        esc(need.en) + '<span class="ja">' + esc(need.ja) + '</span></span></button></li>';
    }).join('');
    panel.innerHTML = head() + '<div class="guide-body">' +
      '<button class="guide-back" type="button" data-back="stages">&larr; Back / 戻る</button>' +
      '<p class="guide-q">What do you need?<span class="ja">何を知りたいですか（' + esc(stage.ja) + '）</span></p>' +
      '<ul class="guide-list">' + items + '</ul>' + foot() + '</div>';
  }

  function renderResult(stageIndex, needIndex) {
    var stage = DATA.stages[stageIndex];
    var need = stage.needs[needIndex];
    var ready = need.items.filter(function (item) { return item.href; });
    var soon = need.items.filter(function (item) { return !item.href; });

    var readyHtml = ready.map(function (item) {
      return '<li><a href="' + esc(item.href) + '"><span>' + esc(item.en) +
        '<span class="ja">' + esc(item.ja) + '</span></span></a></li>';
    }).join('');
    var soonHtml = soon.map(function (item) {
      return '<li class="soon">' + esc(item.ja) + '<span class="tag">Coming soon / 準備中</span></li>';
    }).join('');
    var none = ready.length === 0
      ? '<p class="guide-note">The pages for this topic are not written yet. ' +
        'この題材のページはまだありません。</p>'
      : '';

    panel.innerHTML = head() + '<div class="guide-body">' +
      '<button class="guide-back" type="button" data-back="' + stageIndex + '">&larr; Back / 戻る</button>' +
      '<p class="guide-q">' + esc(need.en) + '<span class="ja">' + esc(need.ja) + '</span></p>' +
      none + '<ul class="guide-list">' + readyHtml + soonHtml + '</ul>' + foot() + '</div>';
  }

  function open() {
    renderStages();
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
  }
  function close() {
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', function () { panel.hidden ? open() : close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  panel.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'guide-visa' && e.target.value) location.href = e.target.value;
  });
  panel.addEventListener('click', function (e) {
    var button = e.target.closest ? e.target.closest('button') : null;
    if (!button) return;
    if (button.classList.contains('guide-close')) return close();
    if (button.hasAttribute('data-back')) {
      var back = button.getAttribute('data-back');
      return back === 'stages' ? renderStages() : renderNeeds(Number(back));
    }
    if (button.hasAttribute('data-need')) {
      return renderResult(Number(button.getAttribute('data-stage')), Number(button.getAttribute('data-need')));
    }
    if (button.hasAttribute('data-stage')) return renderNeeds(Number(button.getAttribute('data-stage')));
  });
})();
</script>`;
}

/** リポジトリの中身から道案内のデータを読む（ページを作るたびに読み直さないよう覚えておく）。 */
let cached = null;
function guideData() {
  if (cached) return cached;
  const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const articlesDir = path.join(ROOT, 'data', 'articles');
  const articles = fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(articlesDir, f)))
    : [];
  cached = buildGuideData({
    queue: readJson(path.join(ROOT, 'data', 'article-queue.json')),
    articles,
    records: readJson(path.join(ROOT, 'data', 'visa-types.json')),
  });
  return cached;
}

/** ページに差し込む道案内。 */
function guideWidget() {
  return guideWidgetHtml(guideData());
}

module.exports = {
  STAGES,
  assignedTopicNumbers,
  buildGuideData,
  guideData,
  guideWidget,
  guideWidgetHtml,
  GUIDE_WIDGET_CSS,
};
