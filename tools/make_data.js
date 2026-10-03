// サイト用のデータファイル（data.js）を作る
// 使い方: node tools/make_data.js
// 入力 : ../03_整理/料理データ.json
// 出力 : data.js（window.DATA）
const fs = require('fs');
const path = require('path');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '../../03_整理/料理データ.json'), 'utf8'));
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
};
const idx = (key, v) => {
  const i = labels[key].indexOf(v);
  if (i < 0) throw new Error(`${key} に無い値: ${v}`);
  return i;
};
// 1料理＝[名前, 区分, 主材料, ジャンル, 季節, 材料, ボリューム, 野菜, 手間, 向き, 色, 定番, 掲載サイト数]
const dishes = rows.map(r => [
  r.name, idx('kubun', r.kubun), idx('zairyo', r.zairyo), idx('genre', r.genre), idx('kisetsu', r.kisetsu),
  r.materials, idx('volume', r.volume), idx('veg', r.veg), idx('effort', r.effort),
  r.tags.map(t => idx('tags', t)), idx('color', r.color), r.teiban ? 1 : 0, r.siteCount,
]);
const out = 'window.DATA = ' + JSON.stringify({ labels, dishes }) + ';\n';
fs.writeFileSync(path.join(__dirname, '../data.js'), out, 'utf8');
console.log(`料理 ${dishes.length} 件 / ${(out.length / 1024).toFixed(0)} KB`);
