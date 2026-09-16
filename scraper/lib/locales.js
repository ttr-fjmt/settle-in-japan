'use strict';

/**
 * 対応言語の定義と、画面の文言（UI）。
 *
 * 【いちばん大事な決めごと】
 * **公式の文言は、どの言語のページでも日本語のまま出す。**
 * 在留資格の活動内容・在留期間・該当例、記事の引用がそれにあたる。理由は2つ。
 *   1. 法律の文言は訳し方で意味が変わる。「その訳が正しい」と誰も保証できない
 *   2. 窓口で見せるため。役所の人が読めるのは日本語
 * 訳すのは「私たちの言葉」（説明・見出し・画面の文言）だけ。
 *
 * 【段階的に増やす】（DECISIONS.md 2026-09-15）
 * 第1段階：やさしい日本語・英語／第2段階：ベトナム語・中国語簡体字・ネパール語／
 * 第3段階：インドネシア語・ミャンマー語・ポルトガル語・韓国語。
 * いきなり全部に広げない。更新が追いつかず情報が古くなるのが、この分野では最大のリスク。
 */

/**
 * 既定（ルート）は英語＋日本語の2言語併記のまま。
 * 追加の言語は /easy/ /vi/ のように下にぶら下げる。
 */
const LOCALES = [
  {
    code: 'en',
    path: '',
    htmlLang: 'ja',
    label: 'English / 日本語',
    isDefault: true,
    hreflang: 'en',
  },
  {
    code: 'ja-easy',
    path: '/easy',
    htmlLang: 'ja',
    label: 'やさしい にほんご',
    hreflang: 'ja',
  },
  {
    code: 'vi',
    path: '/vi',
    htmlLang: 'vi',
    label: 'Tiếng Việt',
    hreflang: 'vi',
  },
];

/** 追加した言語（既定以外）。翻訳が必要なのはこれ。 */
const EXTRA_LOCALES = LOCALES.filter(l => !l.isDefault);

const localeOf = code => LOCALES.find(l => l.code === code) || null;

/**
 * 画面の文言。ここにある日本語を元に各言語へ訳す（data/translations/<code>/ui.json）。
 * 鍵（key）を増やしたら、翻訳もやり直す必要がある。テストが未翻訳を見つける。
 */
const UI_SOURCE = {
  site_tagline: '日本で暮らしはじめる人のための情報',
  nav_visa: '在留資格',
  nav_guide: '手続きの解説',
  nav_faq: 'よくある質問',
  nav_privacy: 'プライバシーポリシー',
  top_start_kicker: '着いたばかりの人はここから',
  top_find: '探しているものから',
  top_pick_visa: '在留資格から調べる',
  top_select_placeholder: '選んでください',
  guides_title: '手続きの解説',
  guides_lead: '手続きのやり方を、公式ページを引用しながら順を追って説明します。',
  quote_note:
    'この部分は、公式ページに書かれている日本語をそのまま載せています。訳すと意味が変わることがあるため、翻訳していません。窓口では、この部分をそのまま見せてください。',
  sources_label: '出典',
  last_checked: '最終確認日',
  back_to_guides: '記事の一覧にもどる',
  no_advice:
    'このサイトは制度の説明と公式窓口の案内を行うもので、個別の申請についての判断はしません。',
  coming_soon: '準備中',
  other_languages: 'ほかの言語',
  translated_note:
    'このページの説明は機械で翻訳しています。公式の文言（日本語）だけが正式なものです。',
};

const UI_KEYS = Object.keys(UI_SOURCE);

module.exports = { LOCALES, EXTRA_LOCALES, localeOf, UI_SOURCE, UI_KEYS };
