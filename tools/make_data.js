// サイト用のデータファイル（data.js）を作る
// 使い方: node tools/make_data.js
// 入力 : ../03_整理/料理データ.json
//        ../03_整理/scene/scene.json（料理名→買う・外食・お店の種類の札。無ければ全部「なし」）
//        ../03_整理/kyodo/結果.json（郷土料理の見直し結果。材料が手に入りにくい料理は「家で作る」の候補から外す。無ければ読み飛ばす）
// 出力 : data.js（window.DATA）
const fs = require('fs');
const path = require('path');

const read = (p, def) => { const f = path.join(__dirname, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def; };
const rows = read('../../03_整理/料理データ.json');
const scene = read('../../03_整理/scene/scene.json', {});
const place = read('../../03_整理/place/place.json', {});  // 料理名→どこで買えるか（コンビニ・スーパー・弁当や持ち帰りの店）
// 「手に入りにくい」と判定されたが、旬の時期には売り場に並ぶので「家で作る」に残す料理（はもは社長が画像を用意した料理）
const KEEP_COOK = new Set(['はもの焼き物', 'はも鍋', '松茸ご飯']);
const hard = new Set(read('../../03_整理/kyodo/結果.json', []).filter(v => v.availability === '手に入りにくい' && !KEEP_COOK.has(v.name)).map(v => v.name));

const labels = {
  kubun: ['主菜', '副菜', '汁物', 'ご飯もの', '麺', '鍋', '粉もの・パン'],
  zairyo: ['豚肉', '鶏肉', '牛肉', 'ひき肉', 'ハム・ソーセージ類', '魚', 'えび・いか・貝', '卵', '豆腐・大豆製品', '野菜', 'きのこ', 'いも', '米', '麺', 'その他'],
  genre: ['和', '洋', '中華', '韓国', 'エスニック', 'その他'],
  kisetsu: ['通年', '春', '夏', '秋', '冬'],
  volume: ['がっつり', 'ふつう', 'あっさり'],
  veg: ['多い', 'ふつう', '少ない'],
  effort: ['手軽', 'ふつう', 'じっくり'],
  tags: ['子ども向け', 'おつまみ', '節約', 'ごちそう', '辛い'],
  color: ['赤', '緑', '黄', '白', '茶', '黒'],
  shop: ['定食・和食', '寿司', 'うどん・そば', 'ラーメン', '中華', '焼肉', '韓国料理', '洋食・ファミレス', 'イタリアン', 'カレー', 'とんかつ・揚げ物', '鍋', '居酒屋', 'お好み焼き・粉もの', 'エスニック', '郷土料理の店'],
};
const idx = (key, v) => {
  const i = labels[key].indexOf(v);
  if (i < 0) throw new Error(`${key} に無い値: ${v}`);
  return i;
};
// 買える場所を1つの数にまとめる（1＝コンビニ、2＝スーパー、4＝弁当・持ち帰りの店。足し合わせる）。札が無い料理はスーパー扱い
const placeBits = name => { const p = place[name]; return p ? (p.cvs ? 1 : 0) + (p.sup ? 2 : 0) + (p.take ? 4 : 0) || 2 : 2; };
// 1料理＝[名前, 区分, 主材料, ジャンル, 季節, 材料, ボリューム, 野菜, 手間, 向き, 色, 定番, 掲載サイト数,
//          買える(0/1), 外食(0/1), お店の種類(無ければ-1), 家で作れる(0/1), 買える場所(上の数。買えない料理は0)]
const all = rows.map(r => {
  const s = scene[r.name] || {};
  return [
    r.name, idx('kubun', r.kubun), idx('zairyo', r.zairyo), idx('genre', r.genre), idx('kisetsu', r.kisetsu),
    r.materials, idx('volume', r.volume), idx('veg', r.veg), idx('effort', r.effort),
    r.tags.map(t => idx('tags', t)), idx('color', r.color), r.teiban ? 1 : 0, r.siteCount,
    s.buy ? 1 : 0, s.out ? 1 : 0, s.out && s.shop ? idx('shop', s.shop) : -1, hard.has(r.name) ? 0 : 1,
    s.buy ? placeBits(r.name) : 0,
  ];
});
// 作れない・買えない・外食にも無い料理は、どの手段でも手に入らないので載せない
const dishes = all.filter(d => d[13] || d[14] || d[16]);
const dropped = all.filter(d => !(d[13] || d[14] || d[16])).map(d => d[0]);
if (dropped.length) console.log(`載せない料理 ${dropped.length} 品：${dropped.join('、')}`);
const out = 'window.DATA = ' + JSON.stringify({ labels, dishes }) + ';\n';
fs.writeFileSync(path.join(__dirname, '../data.js'), out, 'utf8');
const n = k => dishes.filter(d => d[k]).length;
console.log(`料理 ${dishes.length} 件 / ${(out.length / 1024).toFixed(0)} KB ／ 買える ${n(13)}・外食 ${n(14)}・家で作れる ${n(16)}`);
