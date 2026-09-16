'use strict';

/**
 * 広告（AdSense）の枠。
 *
 * 【自動広告を使わない理由】
 * このサイトには公式ページの引用が載っている。自動広告は引用のすぐ横や途中にも広告を入れるため、
 * 「どれが公式の文言で、どれが広告か」が読む人に分からなくなる。法律・手続きの情報でそれが起きると、
 * 誤解のもとになる。そこで置く場所をこちらで決め、次の線引きを守る。
 *
 *   - 引用（blockquote）のすぐ上下には置かない
 *   - 節の途中には入れない。節と節の切れ目にだけ置く
 *   - 1ページに2つまで
 *
 * 【番号が空のときは何も出さない】
 * 広告ユニットの番号（data-ad-slot）は AdSense の管理画面で作る。
 * data/ad-slots.json が空のあいだは枠を書き出さないので、審査中でもそのまま公開できる。
 */

const fs = require('node:fs');
const path = require('node:path');

const SLOTS_PATH = path.join(__dirname, '..', '..', 'data', 'ad-slots.json');
const ADSENSE_CLIENT = 'ca-pub-5761092657360295';

/** 置いてよい場所。ここに無い名前を使うと落ちる（置き場所を増やすときは必ずここに足す）。 */
const PLACEMENTS = ['article-top', 'article-bottom', 'visa-detail', 'top', 'guide-index'];

let cached = null;
function readSlots(file = SLOTS_PATH) {
  if (cached) return cached;
  cached = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return cached;
}

/** その場所の広告ユニット番号（未設定なら null）。 */
function slotId(placement, slots) {
  const table = slots || readSlots();
  if (!PLACEMENTS.includes(placement)) {
    throw new Error(`広告の置き場所 "${placement}" は決めていません（lib/ads.js の PLACEMENTS）`);
  }
  const id = String(table[placement] || '').trim();
  return /^\d+$/.test(id) ? id : null;
}

/**
 * 広告の枠。番号が未設定なら空文字を返す（＝何も表示されない）。
 * 「広告」と分かる見出しを添える。公式の情報と混ざって見えないようにするため。
 */
function adSlot(placement, slots) {
  const table = slots || readSlots();
  const id = slotId(placement, table);
  if (!id) return '';
  return `<div class="ad" role="complementary" aria-label="Advertisement / 広告">
<span class="ad-label">Advertisement / 広告</span>
<ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}"
     data-ad-slot="${id}" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

module.exports = { adSlot, slotId, readSlots, PLACEMENTS, ADSENSE_CLIENT, SLOTS_PATH };
