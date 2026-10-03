// 料理の写真を Wikipedia（日本語版）の公式API から探す（AIを使わないプログラム処理）
// 使い方: node tools/fetch_photos.js
// しくみ: 料理名と同じ題の記事を探し、その記事の代表写真と、作者・ライセンスを取得する。
//         写真そのものは保存しない（表示用のURLと出典だけを記録する）。
// 入力 : ../03_整理/料理データ.json、tools/photo_reject.json（目で見て外した料理名。無ければ読み飛ばす）
// 出力 : photos.js（window.DATA.images）、tools/photo_candidates.json（確認用）
const fs = require('fs');
const path = require('path');

const API = 'https://ja.wikipedia.org/w/api.php';
const UA = 'bangohan-draft/0.1 (dinner suggestion site, local draft; low volume)';
const WIDTH = 640;
const SMALL = 330;       // 一覧・二択・スロットで使う小さいサイズ
const GAP = 1500;        // 1回ごとの間隔（ミリ秒）。相手に負担をかけない
const MAX_LEN = 12;      // これより長い名前は記事がまず無いので調べない
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if ((res.status !== 429 && res.status !== 503) || attempt >= 6) throw new Error(`HTTP ${res.status}`);
    // 相手が混んでいる合図。指定された秒数（無ければ回数に応じた秒数）だけ待ってやり直す
    await sleep(1000 * Math.max(Number(res.headers.get('retry-after')) || 0, 10 * attempt));
  }
}

// 料理データの表記（ひらがな寄り）と、記事の題（漢字・カタカナ寄り）の違いを埋める言い換え
const SWAP = [
  ['しょうが', ['生姜']], ['から揚げ', ['唐揚げ']], ['えび', ['エビ', '海老']], ['いか', ['イカ']], ['たこ', ['タコ']],
  ['みそ', ['味噌']], ['しょうゆ', ['醤油']], ['ご飯', ['ごはん', '飯']], ['卵', ['玉子', 'たまご']], ['なす', ['ナス', '茄子']],
  ['にら', ['ニラ']], ['ねぎ', ['ネギ']], ['れんこん', ['レンコン', '蓮根']], ['ごぼう', ['ゴボウ', '牛蒡']], ['かぼちゃ', ['カボチャ', '南瓜']],
  ['きゅうり', ['キュウリ']], ['にんじん', ['ニンジン', '人参']], ['じゃがいも', ['ジャガイモ']], ['さば', ['サバ', '鯖']], ['あじ', ['アジ']],
  ['いわし', ['イワシ']], ['さんま', ['サンマ']], ['ぶり', ['ブリ']], ['たら', ['タラ']], ['鮭', ['サケ', 'シャケ']], ['たい', ['タイ', '鯛']],
  ['まぐろ', ['マグロ']], ['かつお', ['カツオ']], ['うなぎ', ['ウナギ', '鰻']], ['とんかつ', ['豚カツ', 'トンカツ']], ['かつ', ['カツ']],
  ['うどん', ['饂飩']], ['そば', ['蕎麦']], ['すし', ['寿司']], ['もち', ['餅']], ['豆腐', ['どうふ']], ['マーボー', ['麻婆']], ['シュウマイ', ['焼売']],
  ['ギョーザ', ['餃子']], ['チャーハン', ['炒飯']], ['ホイコーロー', ['回鍋肉']], ['チンジャオロース', ['青椒肉絲']],
];
const HEAD = /^(豚の|鶏の|牛の|豚肉の|鶏肉の|牛肉の)/;

// 記事の題を名指しする料理（言い換えでは別の記事に飛んでしまうもの）
const TITLE = { 'ゴーヤチャンプルー': 'ゴーヤーチャンプルー', 'ステーキ': 'ビーフステーキ' };

function variants(name) {
  if (TITLE[name]) return [TITLE[name]];
  const out = [name];
  const push = v => { if (v && !out.includes(v)) out.push(v); };
  let all = name;
  for (const [from, tos] of SWAP) {
    if (!name.includes(from)) continue;
    tos.forEach(to => push(name.split(from).join(to)));
    all = all.split(from).join(tos[0]);
  }
  push(all);
  // 「豚の」「鶏の」などを外した題（例：鶏のから揚げ→唐揚げ）は最後に試す
  out.slice().forEach(v => { if (HEAD.test(v)) push(v.replace(HEAD, '')); });
  return out.slice(0, 10);
}

const strip = html => String(html || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const okLicense = s => /^(CC0|Public domain|PD\b|CC BY(-SA)? \d(\.\d)?)/i.test(s || '');

(async () => {
  const dishes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../03_整理/料理データ.json'), 'utf8'));
  const rejectPath = path.join(__dirname, 'photo_reject.json');
  const reject = new Set(fs.existsSync(rejectPath) ? JSON.parse(fs.readFileSync(rejectPath, 'utf8')) : []);

  // 1) 題の候補 → 記事 → 代表写真のファイル名
  const want = new Map();  // 題の候補 → その候補を使う料理名
  dishes.filter(d => d.name.length <= MAX_LEN).forEach(d => variants(d.name).forEach(v => { if (!want.has(v)) want.set(v, []); want.get(v).push(d.name); }));
  const cachePath = path.join(__dirname, 'photo_cache.json');
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : { asked: [], page: {} };
  const asked = new Set(cache.asked);
  const page = new Map(Object.entries(cache.page));  // 題の候補 → { title, file }
  const save = () => fs.writeFileSync(cachePath, JSON.stringify({ asked: [...asked], page: Object.fromEntries(page) }), 'utf8');
  const titles = [...want.keys()].filter(t => !asked.has(t));
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await api({ action: 'query', redirects: '1', prop: 'pageimages|pageprops', piprop: 'name', pilimit: '50', ppprop: 'disambiguation', titles: batch.join('|') });
    const q = j.query || {};
    const hop = new Map();
    (q.normalized || []).forEach(n => hop.set(n.from, n.to));
    (q.redirects || []).forEach(n => hop.set(n.from, n.to));
    const pages = new Map((q.pages || []).map(p => [p.title, p]));
    for (const t of batch) {
      let cur = t;
      for (let k = 0; k < 4 && hop.has(cur); k++) cur = hop.get(cur);
      const p = pages.get(cur);
      if (!p || p.missing || p.invalid || !p.pageimage) continue;
      if (p.pageprops && 'disambiguation' in p.pageprops) continue;
      page.set(t, { title: p.title, file: p.pageimage });
    }
    batch.forEach(t => asked.add(t));
    save();
    process.stdout.write(`\r記事を確認中 ${Math.min(i + 50, titles.length)}/${titles.length}`);
    await sleep(GAP);
  }
  console.log();

  // 2) 写真のファイル → 表示用URL・作者・ライセンス
  const files = [...new Set([...page.values()].map(p => p.file))];
  const info = new Map();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(WIDTH),
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Restrictions', titles: batch.map(f => 'File:' + f).join('|') });
    const q = j.query || {};
    const back = new Map();
    (q.normalized || []).forEach(n => back.set(n.to, n.from));
    (q.pages || []).forEach(p => {
      const ii = p.imageinfo && p.imageinfo[0];
      if (!ii) return;
      const m = ii.extmetadata || {};
      const key = (back.get(p.title) || p.title).replace(/^File:/, '').replace(/^ファイル:/, '');
      info.set(key.replace(/ /g, '_'), {
        src: ii.thumburl || ii.url, page: ii.descriptionurl, mime: ii.mime, width: ii.width,
        lic: strip(m.LicenseShortName && m.LicenseShortName.value), licUrl: (m.LicenseUrl && m.LicenseUrl.value) || '',
        by: strip(m.Artist && m.Artist.value).slice(0, 60), restrictions: strip(m.Restrictions && m.Restrictions.value),
      });
    });
    process.stdout.write(`\r写真の出典を確認中 ${Math.min(i + 40, files.length)}/${files.length}`);
    await sleep(GAP);
  }
  console.log();

  // 2b) 一覧や小さな枠で使う、小さいサイズの表示用URL（同じ写真の縮小版）
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(SMALL), titles: batch.map(f => 'File:' + f).join('|') });
    const q = j.query || {};
    const back = new Map();
    (q.normalized || []).forEach(n => back.set(n.to, n.from));
    (q.pages || []).forEach(p => {
      const ii = p.imageinfo && p.imageinfo[0];
      const key = (back.get(p.title) || p.title).replace(/^File:/, '').replace(/^ファイル:/, '').replace(/ /g, '_');
      if (ii && info.has(key)) info.get(key).sm = ii.thumburl || ii.url;
    });
    process.stdout.write(`\r小さいサイズを確認中 ${Math.min(i + 40, files.length)}/${files.length}`);
    await sleep(GAP);
  }
  console.log();

  // 3) 料理ごとに、使える写真を1枚決める
  const images = {}, candidates = [], skipped = {};
  const skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
  for (const d of dishes) {
    let hit = null, via = null;
    for (const v of variants(d.name)) { if (page.has(v)) { hit = page.get(v); via = v; break; } }
    if (!hit) { skip('記事か代表写真がない'); continue; }
    const f = info.get(hit.file.replace(/ /g, '_'));
    if (!f) { skip('写真の情報が取れない'); continue; }
    if (!/^image\/(jpeg|png|webp)$/.test(f.mime)) { skip('写真でない（図・記号など）'); continue; }
    if (f.width < 400) { skip('小さすぎる'); continue; }
    if (!okLicense(f.lic)) { skip('ライセンスが対象外：' + (f.lic || '不明')); continue; }
    if (f.restrictions) { skip('利用上の制限あり'); continue; }
    const rec = { name: d.name, teiban: d.teiban, kubun: d.kubun, article: hit.title, via, ...f };
    candidates.push(rec);
    if (reject.has(d.name)) { skip('目で見て外した'); continue; }
    images[d.name] = { src: f.src, sm: f.sm || f.src, page: f.page, by: f.by || '作者表示なし', lic: f.lic, licUrl: f.licUrl };
  }

  fs.writeFileSync(path.join(__dirname, 'photo_candidates.json'), JSON.stringify(candidates, null, 1), 'utf8');
  fs.writeFileSync(path.join(__dirname, '../photos.js'), 'window.DATA.images = ' + JSON.stringify(images) + ';\n', 'utf8');
  const teiban = dishes.filter(d => d.teiban);
  console.log(`写真が付いた料理 ${Object.keys(images).length}/${dishes.length}（定番 ${teiban.filter(d => images[d.name]).length}/${teiban.length}）`);
  console.log('付かなかった理由', JSON.stringify(skipped));
  const lic = {};
  Object.values(images).forEach(i => { lic[i.lic] = (lic[i.lic] || 0) + 1; });
  console.log('ライセンスの内訳', JSON.stringify(lic));
})().catch(e => { console.error('\n失敗:', e.message); process.exit(1); });
