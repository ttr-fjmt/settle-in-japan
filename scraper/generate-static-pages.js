'use strict';

/**
 * 固定ページ（プライバシーポリシー・よくある質問）を書き出す。
 *
 *   /privacy/ … Cookie・広告・アクセス解析の扱い
 *   /faq/     … このサイトが何で、何をしない場所なのか
 *
 * 【なぜ必要か】
 * 広告（AdSense）とアクセス解析（GA4）は Cookie を使うため、その旨を説明したページが要る。
 * 既存3サイトにも同じページがあり、文面はそれに揃えている。
 *
 * 【このサイト固有の事情】
 * 扱うのが法律・行政手続きなので、FAQ で「個別の判断はしない」ことをはっきり書く。
 * 「私はどの在留資格が取れますか」に答えないのは、行政書士・弁護士の資格が要る領域だから。
 *
 * 実行例:
 *   node generate-static-pages.js
 */

const fs = require('node:fs');
const path = require('node:path');

const { layout, escape, icon, SITE_NAME, SITE_URL } = require('./lib/page-layout');

const ROOT = path.join(__dirname, '..');
const OPERATOR = 'Tatsuro Fujimoto';
const CONTACT = 'fujimoto.mainly@gmail.com';
const ESTABLISHED = '2026-09-16';

/** 英語と日本語を並べた段落。 */
const p = (en, ja) => `<p class="en">${en}</p>\n<p class="ja">${ja}</p>`;

/** 見出し付きの節。 */
const section = (iconName, en, ja, html) => `<section>
<h2>${icon(iconName, 20)}${escape(en)} <span class="ja">/ ${escape(ja)}</span></h2>
${html}
</section>`;

function buildPrivacyPage() {
  const body = `
<article>
<h1>Privacy policy<span class="ja">プライバシーポリシー</span></h1>
<p class="lead">Last updated / 制定日: ${ESTABLISHED}</p>

${section(
  'guide',
  'Who runs this site',
  '運営者',
  p(
    `This site is run by ${OPERATOR} as an individual.`,
    `本サイトは ${OPERATOR} が個人で運営しています。`
  )
)}

${section(
  'card',
  'Personal information',
  '個人情報の取得について',
  p(
    'This site has no contact form and no accounts, and does not collect names, email addresses or similar information directly. If such a feature is added, this policy will be updated first.',
    '本サイトはお問い合わせフォームや会員登録機能を提供しておらず、氏名・メールアドレス等の個人情報を直接取得することはありません。今後そうした機能を追加する場合は、本ポリシーを改定のうえ、取得目的と利用範囲を明記します。'
  )
)}

${section(
  'clock',
  'Cookies',
  'Cookieについて',
  p(
    'This site may use cookies. You can disable cookies in your browser settings, though some parts of the site may then not work as intended.',
    '本サイトでは、サービス向上のため Cookie を使用する場合があります。Cookie はブラウザの設定により無効にできますが、その場合、本サイトの一部が正常に動作しない可能性があります。'
  )
)}

${section(
  'money',
  'Advertising (Google AdSense)',
  '第三者配信の広告について',
  p(
    'This site uses Google AdSense, a third-party advertising service. Advertising providers may use cookies — which do not include your name, address, email address or phone number — about your visits to this and other sites in order to show advertisements for goods and services. You can turn this off, and read the details, in Google Ads Settings and the Google AdSense programme policies.',
    '本サイトでは、第三者配信の広告サービス（Google アドセンス）を利用しています。このような広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、本サイトや他サイトへのアクセスに関する情報「Cookie」（氏名・住所・メールアドレス・電話番号は含まれません）を使用することがあります。設定を無効にする方法や詳細については、Google の広告設定および Google アドセンス プログラム ポリシーをご確認ください。'
  ) +
    `\n<p class="note"><a href="https://www.google.com/settings/ads" rel="nofollow">Google Ads Settings / Google 広告設定</a> ・
<a href="https://policies.google.com/technologies/ads" rel="nofollow">How Google uses cookies in advertising / 広告における Cookie の使用</a></p>`
)}

${section(
  'search',
  'Analytics (Google Analytics)',
  'アクセス解析について',
  p(
    'This site uses Google Analytics, which uses cookies to collect traffic data. The data is collected anonymously and does not identify individuals. You can refuse the collection by disabling cookies in your browser.',
    '本サイトでは、Google によるアクセス解析ツール「Google アナリティクス」を利用しています。Google アナリティクスはトラフィックデータの収集のために Cookie を使用しています。このデータは匿名で収集されており、個人を特定するものではありません。ブラウザの設定で Cookie を無効にすることで、収集を拒否できます。'
  ) +
    '\n' +
    p(
      'You can also turn measurement off for this site only: open <a href="/?ga=off">/?ga=off</a> once in that browser. To turn it back on, open <a href="/?ga=on">/?ga=on</a>.',
      'このサイトだけ計測を止めることもできます。そのブラウザで <a href="/?ga=off">/?ga=off</a> を一度開いてください。戻すときは <a href="/?ga=on">/?ga=on</a> を開きます。'
    )
)}

${section(
  'status',
  'Where the information comes from',
  '掲載情報の出所と正確性',
  p(
    'The residence-status data and the guides on this site are built from the official pages of Japanese government bodies — the Immigration Services Agency, the Ministry of Health, Labour and Welfare, the Ministry of Internal Affairs and Communications and others. Wording taken from those pages is quoted in Japanese and checked automatically against the saved page text before publication. Even so, the rules change, and we do not guarantee that everything here is accurate, complete or current. Always check the official page, which we link from every page.',
    '本サイトの在留資格のデータと解説記事は、出入国在留管理庁・厚生労働省・総務省など、日本の公的機関の公式ページをもとに作成しています。公式ページの文言は日本語のまま引用し、公開前に保存したページ本文と機械的に照合しています。それでも制度は変わります。情報の正確性・完全性・最新性を保証するものではありません。実際の手続きにあたっては、各ページに掲載している公式ページを必ずご確認ください。'
  )
)}

${section(
  'help',
  'We do not decide individual cases',
  '個別の判断はしません',
  p(
    'This site explains what the official pages say and points you to official desks. It does not judge individual cases — whether a particular status of residence can be granted, whether a particular application will succeed, and so on. Please ask the official desk listed on each page.',
    '本サイトは、公式ページに書かれている制度の説明と、公式窓口の案内を行うものです。個別の事情についての判断（この在留資格が取れるか、この申請が通るかなど）は行いません。各ページに記載した公式の窓口へご相談ください。'
  )
)}

${section(
  'move',
  'Disclaimer',
  '免責事項',
  p(
    'The operator accepts no liability for any loss arising from the use of the information on this site, nor for the content of external sites linked from it.',
    '本サイトに掲載する情報の利用により生じたいかなる損害についても、運営者は責任を負いかねます。本サイトからリンクする外部サイトの内容についても、運営者は責任を負いません。'
  )
)}

${section(
  'home',
  'Changes to this policy',
  '本ポリシーの改定',
  p(
    'This policy may be changed without notice. The revised policy takes effect when it is published on this page.',
    '本サイトは、必要に応じて本ポリシーの内容を予告なく変更することがあります。変更後のポリシーは、本ページに掲載した時点から効力を生じるものとします。'
  )
)}

${section(
  'family',
  'Contact',
  'お問い合わせ',
  p(
    `For corrections, removal requests or anything else, please write to <a href="mailto:${CONTACT}">${CONTACT}</a>. There is no contact form. We use your message only to reply and to correct what is published.`,
    `掲載内容の修正・削除のご依頼、その他のお問い合わせは <a href="mailto:${CONTACT}">${CONTACT}</a> までお願いいたします。お問い合わせフォームは設けておりません。いただいたメールの内容は、返信および掲載内容の修正のためにのみ利用します。`
  )
)}
</article>
`;
  return layout({
    title: `Privacy policy（プライバシーポリシー）| ${SITE_NAME}`,
    description:
      'Settle in Japan における Cookie・広告（Google アドセンス）・アクセス解析（Google アナリティクス）の取り扱いと、掲載情報の出所について。',
    canonical: `${SITE_URL}/privacy/`,
    body,
  });
}

/** よくある質問。このサイトが「何をする場所で、何をしない場所か」をはっきりさせる。 */
const FAQ = [
  {
    icon: 'guide',
    q_en: 'What is this site?',
    q_ja: 'このサイトは何ですか',
    a_en:
      'A guide for people settling in Japan. It explains residence statuses and the paperwork of daily life, using only what can be confirmed on the official pages of Japanese government bodies, with the source and the date we last checked it on every page.',
    a_ja:
      '日本で暮らしはじめる人のための情報サイトです。在留資格と、暮らしに必要な手続きについて、日本の公的機関の公式ページで確認できた内容だけを、出典と最終確認日をつけて掲載しています。',
  },
  {
    icon: 'help',
    q_en: 'Can you tell me which status of residence I can get?',
    q_ja: '私はどの在留資格が取れますか',
    a_en:
      'No. This site explains the rules and points you to official desks; it does not judge individual cases. In Japan, advising on an individual application is work reserved for licensed professionals. For your own case, please contact the Immigration Services Agency information centre or the Foreign Residents Support Centre (FRESC).',
    a_ja:
      'お答えできません。本サイトは制度の説明と公式窓口の案内を行うもので、個別の判断はしません。日本では、個別の申請についての判断は資格を持つ専門家の業務とされています。ご自身の場合については、出入国在留総合インフォメーションセンターや外国人在留支援センター（FRESC）へご相談ください。',
  },
  {
    icon: 'card',
    q_en: 'Why are the quotations left in Japanese?',
    q_ja: 'なぜ引用が日本語のままなのですか',
    a_en:
      'Because a translation can change what a rule means. We keep the official wording in Japanese so that you can show it at the counter exactly as the office expects to read it. The explanation around the quotation is in English.',
    a_ja:
      '訳し方によって、制度の意味が変わってしまうためです。公式の文言は日本語のまま載せているので、窓口でそのまま見せられます。文言のまわりの説明は英語で書いています。',
  },
  {
    icon: 'status',
    q_en: 'What does "not stated" mean on a page?',
    q_ja: '「記載なし」と書かれているのは何ですか',
    a_en:
      'It means the official page does not say. We do not fill such gaps with guesses; the item stays marked as unconfirmed until we find an official page that states it.',
    a_ja:
      '公式ページに書かれていない、という意味です。確認できない項目を推測で埋めることはしません。それを書いた公式ページが見つかるまで、確認中のままにしています。',
  },
  {
    icon: 'clock',
    q_en: 'How often is the site updated?',
    q_ja: 'どのくらいの頻度で更新されますか',
    a_en:
      'A new guide is published every day until there are 100 of them, then once a week. Before publication, every quotation is checked automatically against the saved text of the official page; anything that does not match is not published.',
    a_ja:
      '解説記事は、100本になるまで毎日1本、その後は週1本のペースで公開しています。公開前に、引用が保存した公式ページの本文に実在するかを機械的に照合しており、一致しないものは公開しません。',
  },
  {
    icon: 'money',
    q_en: 'Is the site free? Are there advertisements?',
    q_ja: '利用は無料ですか。広告はありますか',
    a_en:
      'The site is free to use and carries advertising, which pays for running it. How advertising and analytics use cookies is described in the privacy policy.',
    a_ja:
      '無料でご利用いただけます。運営費用にあてるため広告を掲載しています。広告とアクセス解析における Cookie の扱いは、プライバシーポリシーに記載しています。',
  },
  {
    icon: 'search',
    q_en: 'I found something that looks wrong.',
    q_ja: '間違いを見つけました',
    a_en: `Please write to <a href="mailto:${CONTACT}">${CONTACT}</a> with the page address. Corrections are made against the official page.`,
    a_ja: `<a href="mailto:${CONTACT}">${CONTACT}</a> まで、該当ページのアドレスを添えてお知らせください。公式ページと照らして修正します。`,
  },
];

function buildFaqPage() {
  const items = FAQ.map(
    item => `<section>
<h2>${icon(item.icon, 20)}${escape(item.q_en)} <span class="ja">/ ${escape(item.q_ja)}</span></h2>
<p class="en">${item.a_en}</p>
<p class="ja">${item.a_ja}</p>
</section>`
  ).join('\n');

  const body = `
<article>
<h1>Frequently asked questions<span class="ja">よくある質問</span></h1>
<p class="lead">What this site is, and what it does not do.<br>
このサイトが何で、何をしない場所なのかをまとめています。</p>
${items}
<p class="note"><a href="/privacy/">Privacy policy / プライバシーポリシー</a></p>
</article>
`;
  return layout({
    title: `FAQ（よくある質問）| ${SITE_NAME}`,
    description:
      'Settle in Japan についてのよくある質問。掲載情報の作り方、個別の判断をしない理由、引用を日本語のままにしている理由など。',
    canonical: `${SITE_URL}/faq/`,
    body,
  });
}

function main() {
  const pages = [
    ['privacy', buildPrivacyPage()],
    ['faq', buildFaqPage()],
  ];
  for (const [dir, html] of pages) {
    const full = path.join(ROOT, dir, 'index.html');
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, html);
    console.log(`書き出しました: /${dir}/`);
  }
}

if (require.main === module) main();

module.exports = { buildPrivacyPage, buildFaqPage, FAQ, CONTACT };
