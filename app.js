(function () {
  'use strict';

  // ---------- データ ----------
  const L = window.DATA.labels;
  const IMG = window.DATA.images || {};   // 料理名→写真（表示用URL・小さいサイズ・出典ページ・作者・ライセンス）。無い料理は色のお皿を出す
  const ART = window.ART || {};           // GPTで作った背景・飾りの絵のうち、使えるもの
  const GEN = window.DATA.gen || {};      // 料理名→GPTで作った料理の画像（実写の無い料理用）
  const D = window.DATA.dishes.map(a => ({
    name: a[0], kubun: L.kubun[a[1]], zairyo: L.zairyo[a[2]], genre: L.genre[a[3]], kisetsu: L.kisetsu[a[4]],
    mats: a[5], volume: L.volume[a[6]], veg: L.veg[a[7]], effort: L.effort[a[8]],
    tags: a[9].map(t => L.tags[t]), color: L.color[a[10]], teiban: !!a[11], sites: a[12],
  }));

  const SITE_NAME = '毎日の晩御飯の提案';
  const URANAI_URL = 'https://uranai-yakata.netlify.app/zodiac.html';
  const MAIN_KUBUN = ['主菜', 'ご飯もの', '麺', '鍋'];
  const AVOID_DAYS = 3;        // 決めた料理をおまかせの候補から外す日数
  const PAGE = 40;             // 一覧に一度に出す件数
  const MAT_MIN = 8;           // 材料の選択肢に出す下限（その材料を使う料理の数）
  const DUEL_ROUNDS = 10;      // 二択の問題数
  const WHEEL_N = 10;          // ルーレットの円盤に並べる料理の数
  const SPIN_MS = 5000;        // ルーレットが回っている時間（ミリ秒）
  const OPEN_MS = 2000;        // 止まる何ミリ秒前に「？」を料理名に変えるか
  const PHOTO_MIN = 12;        // 「写真のある料理だけ」を効かせる下限（これより少ないときは全体から選ぶ）
  const FONT = '"Hiragino Maru Gothic ProN","BIZ UDPGothic","Yu Gothic","Meiryo",sans-serif';

  // 目的の札（複数選ぶと、すべてに当てはまる料理だけ）
  const PURPOSE = {
    'がっつり': d => d.volume === 'がっつり',
    'あっさり': d => d.volume === 'あっさり',
    '野菜たっぷり': d => d.veg === '多い',
    '手軽': d => d.effort === '手軽',
    '節約': d => d.tags.includes('節約'),
    '子ども向け': d => d.tags.includes('子ども向け'),
    'おつまみ': d => d.tags.includes('おつまみ'),
    'ごちそう': d => d.tags.includes('ごちそう'),
  };

  // 材料の並べ方（この順で見出しを付ける。ここに無い材料は「その他」へ）
  const MAT_CAT = [
    ['肉', ['豚こま肉', '豚バラ肉', '豚ロース肉', '豚かたまり肉', '鶏もも肉', '鶏むね肉', 'ささみ', '手羽', '牛薄切り肉', '牛かたまり肉', '合いびき肉', '豚ひき肉', '鶏ひき肉', 'ベーコン', 'ハム', 'ソーセージ']],
    ['魚介', ['鮭', 'サーモン', 'さば', 'あじ', 'いわし', 'さんま', 'ぶり', 'たら', 'さわら', 'たい', 'まぐろ', 'えび', 'いか', 'たこ', 'あさり', 'ほたて', 'かき', 'しらす', 'ツナ缶', 'さば缶', 'かまぼこ']],
    ['野菜', ['キャベツ', '白菜', '玉ねぎ', '長ねぎ', 'にんじん', '大根', 'かぶ', 'じゃがいも', 'さつまいも', '里いも', '長いも', 'かぼちゃ', 'なす', 'ピーマン', 'パプリカ', 'トマト', 'きゅうり', 'ズッキーニ', 'ゴーヤ', 'オクラ', 'ほうれん草', '小松菜', 'チンゲン菜', '水菜', 'にら', 'レタス', 'ブロッコリー', 'アスパラガス', 'もやし', 'れんこん', 'ごぼう', 'たけのこ', '冬瓜', '豆苗', 'とうもろこし', 'アボカド']],
    ['きのこ', ['しめじ', 'しいたけ', 'えのき', 'まいたけ', 'エリンギ', 'マッシュルーム']],
    ['卵・大豆・乳', ['卵', '豆腐', '厚揚げ', '油揚げ', '大豆', 'チーズ', '牛乳']],
    ['ご飯・麺', ['米', 'もち', 'うどん', 'そば', 'そうめん', 'パスタ', '中華麺', '春雨', 'パン', '餃子の皮']],
  ];
  const MAT_SKIP = ['しょうが', 'パン粉', 'のり'];  // 調味料・常備品寄りなので選択肢に出さない

  // 星座（絵が無いときは記号を出す。記号は絵文字にならないよう文字として出す）
  const SIGNS = [['おひつじ座', '♈'], ['おうし座', '♉'], ['ふたご座', '♊'], ['かに座', '♋'], ['しし座', '♌'], ['おとめ座', '♍'],
    ['てんびん座', '♎'], ['さそり座', '♏'], ['いて座', '♐'], ['やぎ座', '♑'], ['みずがめ座', '♒'], ['うお座', '♓']];

  // ---------- 小道具 ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
    return e;
  }
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const now = new Date();
  const pad2 = n => String(n).padStart(2, '0');
  const TODAY = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const TODAY_LABEL = `${now.getMonth() + 1}月${now.getDate()}日（${'日月火水木金土'[now.getDay()]}）`;
  const SEASON = (m => (m >= 3 && m <= 5) ? '春' : (m >= 6 && m <= 8) ? '夏' : (m >= 9 && m <= 11) ? '秋' : '冬')(now.getMonth() + 1);
  const inSeason = d => d.kisetsu === '通年' || d.kisetsu === SEASON;

  // 日付などの文字から、毎回同じ並びの乱数を作る（今日の一品・占いは誰が開いても同じ結果にする）
  function seeded(str) {
    let x = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { x = Math.imul(x ^ str.charCodeAt(i), 3432918353); x = x << 13 | x >>> 19; }
    x = Math.imul(x ^ x >>> 16, 2246822507); x = Math.imul(x ^ x >>> 13, 3266489909);
    let a = (x ^ x >>> 16) >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // 決まった瞬間の紙吹雪（四角・丸・細長い紙が、中央と左右の下から舞う）
  function confetti() {
    if (reduceMotion) return;
    const c = h('canvas', { class: 'confetti' });
    document.body.append(c);
    const W = c.width = window.innerWidth, H = c.height = window.innerHeight, x = c.getContext('2d');
    const cols = ['#e8632a', '#f6bd60', '#84a59d', '#f28482', '#5ba85b', '#ffd166', '#6fa8ff'];
    const ps = Array.from({ length: 130 }, (_, i) => {
      const from = i % 3;  // 0=中央 1=左下 2=右下
      return {
        x: from === 0 ? W / 2 + (Math.random() - .5) * W * .4 : from === 1 ? W * .05 : W * .95,
        y: from === 0 ? H * .4 : H * .85,
        vx: from === 0 ? (Math.random() - .5) * 11 : (from === 1 ? 1 : -1) * (3 + Math.random() * 9),
        vy: -Math.random() * (from === 0 ? 11 : 17) - 4,
        s: 6 + Math.random() * 8, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6, vr: (Math.random() - .5) * .5, k: i % 4,
      };
    });
    let t = 0;
    (function frame() {
      x.clearRect(0, 0, W, H);
      ps.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .36; p.vx *= .99; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - t / 130);
        if (p.k === 0) { x.beginPath(); x.arc(0, 0, p.s / 2.4, 0, Math.PI * 2); x.fill(); }
        else if (p.k === 1) x.fillRect(-p.s / 2, -p.s / 6, p.s, p.s / 3);
        else x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
        x.restore();
      });
      if (++t < 130) requestAnimationFrame(frame); else c.remove();
    })();
    setTimeout(() => c.remove(), 3500);  // 画面が裏にあって動きが止まった場合の後始末
  }

  // ---------- 最近決めた料理（かぶり防止） ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境では記録なしで動かす */ } },
  };
  let recent = store.get('bangohan_recent', []);
  const daysAgo = dstr => Math.round((new Date(TODAY) - new Date(dstr)) / 86400000);
  const avoidSet = () => new Set(recent.filter(r => daysAgo(r.d) < AVOID_DAYS).map(r => r.n));

  function decide(names) {
    recent = recent.filter(r => !names.includes(r.n));
    names.forEach(n => recent.unshift({ n, d: TODAY }));
    recent = recent.slice(0, 30);
    store.set('bangohan_recent', recent);
    renderRecent();
    toast(`決定！${AVOID_DAYS}日間は候補から外します`);
  }
  function renderRecent() {
    $('#recent-box').hidden = recent.length === 0;
    $('#recent-list').replaceChildren(...recent.slice(0, 10).map(r => {
      const n = daysAgo(r.d);
      return h('li', {}, h('span', { text: r.n }), h('small', { text: n === 0 ? '今日' : `${n}日前` }));
    }));
  }

  function pickFrom(pool, rng) {
    const avoid = avoidSet();
    const ok = pool.filter(d => !avoid.has(d.name));
    const src = ok.length ? ok : pool;
    return src[Math.floor((rng || Math.random)() * src.length)];
  }

  // ---------- 料理カード ----------
  const recipeUrl = name => 'https://www.google.com/search?q=' + encodeURIComponent(name + ' レシピ');

  // その料理の画像。実写があれば実写、無ければGPTで作った画像（ai: true）、どちらも無ければ null
  function imgOf(d) {
    if (IMG[d.name]) return IMG[d.name];
    if (GEN[d.name]) return { src: 'gen/' + GEN[d.name], sm: 'gen/' + GEN[d.name], ai: true };
    return null;
  }
  // 料理の小さな絵。画像がある料理は画像（小さいサイズ）、無い料理はその料理の色のお皿
  function pic(d, cls) {
    const p = imgOf(d);
    const box = h('span', { class: 'pic' + (cls ? ' ' + cls : '') + (p ? ' has-img' : '') + (p && p.ai ? ' is-ai' : ''), 'data-color': d.color, 'aria-hidden': 'true' });
    // 一覧の小さな写真だけ「見えたら読み込む」。二択やスロットはすぐ見せたいので先に読み込む
    if (p) box.append(h('img', { src: p.sm || p.src, alt: '', loading: cls === 'pic-s' ? 'lazy' : 'eager' }));
    return box;
  }
  // 大きな写真（出典つき）。写真が無い料理は null
  function hero(d) {
    const p = imgOf(d);
    if (!p) return null;
    return h('figure', { class: 'hero' },
      h('img', { src: p.src, alt: d.name + (p.ai ? 'のイメージ画像' : 'の写真'), loading: 'lazy' }),
      h('figcaption', {}, p.ai ? '画像はAIで作成したイメージです'
        : h('a', { href: p.page, target: '_blank', rel: 'noopener', text: `写真：${p.by}／${p.lic}／Wikimedia Commons` })));
  }
  function chips(d) {
    const list = [d.kubun, d.genre];
    if (d.kisetsu !== '通年') list.push(d.kisetsu + 'の料理');
    if (d.teiban) list.push('定番');
    return h('div', { class: 'chips' }, list.map(t => h('span', { class: 'chip', text: t })));
  }
  function dishCard(d, opt) {
    opt = opt || {};
    const photo = hero(d);
    return h('article', { class: 'dish' + (opt.big ? ' dish-big' : '') + (opt.reveal ? ' reveal' : '') },
      photo,
      h('div', { class: 'dish-head' }, photo ? null : pic(d), h('div', { class: 'dish-title' }, h('h3', { class: 'dish-name', text: d.name }), chips(d))),
      h('p', { class: 'mats', text: '主な材料：' + d.mats.join('・') }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => decide([d.name]), text: 'これに決定' }),
        h('a', { class: 'btn', href: recipeUrl(d.name), target: '_blank', rel: 'noopener', text: '作り方を探す' }),
        h('button', { class: 'btn', type: 'button', onclick: () => openShare([d.name]), text: 'シェア' })));
  }
  function menuCard(set) {
    return h('article', { class: 'dish reveal' },
      h('p', { class: 'crown', text: '今夜の献立' }),
      h('ul', { class: 'menu-list' }, set.map(d => h('li', {}, pic(d, 'pic-m'), h('span', { class: 'menu-text' }, h('b', { text: d.kubun }),
        h('button', { class: 'link', type: 'button', onclick: () => openDetail(d), text: d.name }))))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => decide(set.map(d => d.name)), text: 'この献立に決定' }),
        h('button', { class: 'btn', type: 'button', onclick: () => openShare(set.map(d => d.name)), text: 'シェア' })));
  }

  // ---------- 画面の切り替え ----------
  function show(view) {
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + view));
    $$('.tabbar button').forEach(b => b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'));
    if (view === 'play') updatePoolNote();
    window.scrollTo(0, 0);
  }
  function showGame(game) {
    $$('.seg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.game === game)));
    $$('.game').forEach(g => g.classList.toggle('is-active', g.id === 'game-' + game));
  }

  // 画面の行き来。ブラウザの「戻る」でも、画面左上の「戻る」ボタンでも、前の画面に戻れるようにする
  const VIEWS = ['home', 'search', 'play', 'fortune'], GAMES = ['roulette', 'slot', 'duel'];
  const trail = [];   // 通ってきた画面
  let here = 'home';
  function render(place) {
    const [view, game] = place.split('/');
    show(VIEWS.includes(view) ? view : 'home');
    if (GAMES.includes(game)) showGame(game);
    $('#back').hidden = here === 'home';
  }
  function go(place) {
    if (place !== here) {
      trail.push(here);
      here = place;
      location.hash = place;  // 履歴に残す。このあと届く hashchange は here と同じなので何もしない
    }
    render(place);
  }
  function route() {  // ブラウザの戻る・進むで来たとき
    const place = location.hash.slice(1) || 'home';
    if (place === here) return;
    if (trail.length && trail[trail.length - 1] === place) trail.pop(); else trail.push(here);
    here = place;
    render(place);
  }
  function goBack() {
    if (trail.length) history.back(); else go('home');
  }

  // 画面が縦に並ぶ幅（スマホなど）では、結果が出たらそこまで画面を送る
  const narrow = window.matchMedia('(max-width: 899px)');
  function bringIntoView(el) {
    if (narrow.matches) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  // ---------- 今日の一品 ----------
  function renderHome() {
    const rng = seeded('today|' + TODAY);
    const pool = k => D.filter(d => d.teiban && inSeason(d) && k(d));
    const mains = pool(d => MAIN_KUBUN.includes(d.kubun));
    const sides = pool(d => d.kubun === '副菜');
    const soups = pool(d => d.kubun === '汁物');
    const shot = mains.filter(imgOf);
    const from = shot.length >= 20 ? shot : mains;  // 写真のある料理が十分あれば、その中から選ぶ
    const main = from[Math.floor(rng() * from.length)];
    const withs = [sides[Math.floor(rng() * sides.length)], soups[Math.floor(rng() * soups.length)]];
    $('#today-label').textContent = TODAY_LABEL + 'の一品';
    $('#today-dish').replaceChildren(dishCard(main, { big: true }));
    $('#today-with').replaceChildren(
      h('p', { class: 'with-title', text: '合わせるなら' }),
      h('ul', {}, withs.map(d => h('li', {}, h('button', { class: 'link', type: 'button', onclick: () => openDetail(d), text: `${d.kubun}：${d.name}` })))));
  }

  // ---------- さがす ----------
  const F = { mats: new Set(), zairyo: new Set(), genre: new Set(), purpose: new Set(), season: new Set(), kubun: new Set() };
  let shown = PAGE;
  const hasFilter = () => Object.values(F).some(s => s.size);

  function pickButtons(box, items, set) {
    box.append(...items.map(key => {
      const b = h('button', { class: 'pick', type: 'button', 'aria-pressed': 'false', text: key });
      b.addEventListener('click', () => {
        if (set.has(key)) set.delete(key); else set.add(key);
        b.setAttribute('aria-pressed', String(set.has(key)));
        shown = PAGE;
        renderResults();
        resetRoulette();
      });
      return b;
    }));
  }
  function buildFilters() {
    const count = new Map();
    D.forEach(d => d.mats.forEach(m => count.set(m, (count.get(m) || 0) + 1)));
    const usable = m => (count.get(m) || 0) >= MAT_MIN && !MAT_SKIP.includes(m);
    const listed = new Set(MAT_CAT.flatMap(c => c[1]));
    const others = [...count.keys()].filter(m => usable(m) && !listed.has(m)).sort((a, b) => count.get(b) - count.get(a));
    const box = $('#f-mats');
    MAT_CAT.concat([['その他', others]]).forEach(([cat, mats]) => {
      const list = mats.filter(usable);
      if (!list.length) return;
      const picks = h('div', { class: 'picks' });
      pickButtons(picks, list, F.mats);
      box.append(h('p', { class: 'matcat', text: cat }), picks);
    });
    pickButtons($('#f-zairyo'), L.zairyo.filter(z => z !== 'その他'), F.zairyo);
    pickButtons($('#f-genre'), L.genre.filter(g => g !== 'その他'), F.genre);
    pickButtons($('#f-purpose'), Object.keys(PURPOSE), F.purpose);
    pickButtons($('#f-season'), ['春', '夏', '秋', '冬'], F.season);
    pickButtons($('#f-kubun'), L.kubun, F.kubun);
  }
  function filtered() {
    const hit = d => d.mats.filter(m => F.mats.has(m)).length;
    return D
      .filter(d => (!F.kubun.size || F.kubun.has(d.kubun))
        && (!F.zairyo.size || F.zairyo.has(d.zairyo))
        && (!F.genre.size || F.genre.has(d.genre))
        && (!F.season.size || F.season.has(d.kisetsu))
        && [...F.purpose].every(k => PURPOSE[k](d))
        && (!F.mats.size || hit(d) > 0))
      .map(d => ({ d, hit: F.mats.size ? hit(d) : 0 }))
      .sort((a, b) => b.hit - a.hit || (b.d.teiban - a.d.teiban) || b.d.sites - a.d.sites);
  }
  function renderResults() {
    const list = filtered();
    $('#result-count').textContent = `${list.length}件`;
    $('#filter-clear').hidden = !hasFilter();
    $('#filter-roulette').disabled = list.length === 0;
    $('#result-list').replaceChildren(...list.slice(0, shown).map(({ d, hit }) =>
      h('li', {}, h('button', { class: 'row', type: 'button', onclick: () => openDetail(d) },
        pic(d, 'pic-s'),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-name', text: d.name }), h('br'),
          h('span', { class: 'row-meta', text: [d.kubun, d.genre, d.mats.join('・')].join('｜') })),
        hit > 0 && F.mats.size > 1 ? h('span', { class: 'row-hit', text: `材料${hit}つ一致` }) : null))));
    $('#result-more').hidden = list.length <= shown;
  }
  function clearFilters() {
    Object.values(F).forEach(s => s.clear());
    $$('#view-search .pick').forEach(b => b.setAttribute('aria-pressed', 'false'));
    shown = PAGE;
    renderResults();
    resetRoulette();
  }

  // ---------- おまかせ（共通） ----------
  const teibanOnly = () => $('#teiban-only').checked;
  const photoOnly = () => $('#photo-only').checked;
  function base(test) {
    const list = D.filter(d => inSeason(d) && (!teibanOnly() || d.teiban) && test(d));
    if (!photoOnly()) return list;
    const shot = list.filter(imgOf);
    return shot.length >= PHOTO_MIN ? shot : list;  // 写真つきが少なすぎる種類は全体から選ぶ
  }

  // ---------- ルーレット（円盤） ----------
  const WHEEL_COLORS = ['#f6bd60', '#fdf0d5', '#f5cac3', '#a8c9b8', '#f28482', '#ffe8a3', '#f4a261', '#cfe1b9', '#e9c46a', '#fbd1a2'];
  let wheelDeg = 0, wheelBusy = false;

  function roulettePool() {
    return hasFilter() ? filtered().map(x => x.d) : base(d => MAIN_KUBUN.includes(d.kubun));
  }
  // items: 円盤に並べる料理（null のマスは「？」）。win: 当たったマスの番号（決まる前は -1）
  function drawWheel(items, win) {
    const c = $('#wheel'), x = c.getContext('2d'), R = c.width / 2, n = items.length, seg = Math.PI * 2 / n;
    const dim = i => win >= 0 && i !== win;
    x.clearRect(0, 0, c.width, c.height);
    items.forEach((d, i) => {
      const mid = i * seg + seg / 2;
      x.beginPath(); x.moveTo(R, R); x.arc(R, R, R - 10, i * seg, (i + 1) * seg); x.closePath();
      x.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      x.fill();
      if (dim(i)) { x.fillStyle = 'rgba(255,255,255,.6)'; x.fill(); }  // 外れたマスは白っぽく薄くする
      x.strokeStyle = '#ffffff'; x.lineWidth = 5; x.stroke();
      x.fillStyle = dim(i) ? 'rgba(58,42,30,.4)' : '#3a2a1e';
      x.textBaseline = 'middle';
      if (!d) {
        // 「？」は回転させず、まっすぐ立てて書く
        x.textAlign = 'center'; x.font = `bold 62px ${FONT}`;
        x.fillText('？', R + Math.cos(mid) * R * .62, R + Math.sin(mid) * R * .62);
        return;
      }
      // 料理名は中心から外へ向けて書く。入りきらない名前は小さくし、それでも長ければ「…」で切る
      x.save(); x.translate(R, R); x.rotate(mid);
      x.textAlign = 'right';
      const max = R - 112;
      let size = 32, label = d.name;
      x.font = `bold ${size}px ${FONT}`;
      while (x.measureText(label).width > max && size > 22) { size -= 2; x.font = `bold ${size}px ${FONT}`; }
      if (x.measureText(label).width > max) {
        while (label.length > 1 && x.measureText(label + '…').width > max) label = label.slice(0, -1);
        label += '…';
      }
      x.fillText(label, R - 30, 0);
      x.restore();
    });
    // 中心が明るく、ふちが少し暗い、立体感のための光
    const g = x.createRadialGradient(R, R, R * .1, R, R, R);
    g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(90,40,10,.14)');
    x.beginPath(); x.arc(R, R, R - 10, 0, Math.PI * 2); x.fillStyle = g; x.fill();
    if (win >= 0) {  // 当たったマスを金色のふちで囲む
      x.beginPath(); x.moveTo(R, R); x.arc(R, R, R - 14, win * seg, (win + 1) * seg); x.closePath();
      x.strokeStyle = '#ffb703'; x.lineWidth = 12; x.lineJoin = 'round'; x.stroke();
    }
    x.beginPath(); x.arc(R, R, R - 8, 0, Math.PI * 2); x.strokeStyle = '#c64e1b'; x.lineWidth = 14; x.stroke();
  }
  function buildBulbs() {
    const box = $('.wheel-bulbs');
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      box.append(h('span', { class: 'bulb' + (i % 2 ? ' alt' : ''), style: `left:${(50 + 50 * Math.cos(a)).toFixed(2)}%;top:${(50 + 50 * Math.sin(a)).toFixed(2)}%` }));
    }
  }
  // 回す前の姿に戻す：円盤は全部「？」、結果は空
  function resetRoulette() {
    if (wheelBusy) return;
    const wheel = $('#wheel'), wrap = $('.wheel-wrap');
    wheelDeg = 0;
    wheel.style.transition = 'none'; wheel.style.transform = 'none';
    wrap.classList.remove('is-win', 'is-spinning');
    drawWheel(new Array(WHEEL_N).fill(null), -1);
    const win = $('#roulette-window');
    win.classList.remove('is-done'); win.textContent = '？';
    $('#roulette-go').textContent = '回す';
    $('#roulette-result').replaceChildren();
    updatePoolNote();
  }
  function updatePoolNote() {
    const n = roulettePool().length;
    $('#roulette-pool').textContent = hasFilter() ? `「さがす」で絞った${n}件から選びます` : `今の季節に合う主役の料理${n}件から選びます`;
    $('#roulette-go').disabled = n === 0 || wheelBusy;
  }
  function runRoulette() {
    const pool = roulettePool();
    if (!pool.length || wheelBusy) return;
    wheelBusy = true;
    const btn = $('#roulette-go'), win = $('#roulette-window'), wheel = $('#wheel'), wrap = $('.wheel-wrap');
    btn.disabled = true;
    $('#roulette-result').replaceChildren();
    wrap.classList.remove('is-win');
    win.classList.remove('is-done');
    win.textContent = 'なにが出るかな…';
    const final = pickFrom(pool);
    const items = shuffle([final].concat(shuffle(pool.filter(d => d !== final)).slice(0, WHEEL_N - 1)));
    const k = items.indexOf(final);
    // 回し始めは全部「？」。まっすぐ立った「？」から始めるため、円盤の向きを元に戻しておく
    wheel.style.transition = 'none';
    wheel.style.transform = 'none';
    drawWheel(new Array(items.length).fill(null), -1);
    // 針は真上（270度の位置）。当たりのマスの中ほどが針の下に来る角度まで回す
    const seg = 360 / items.length;
    const mid = k * seg + seg / 2 + (Math.random() - .5) * seg * .6;
    wheelDeg = (((270 - mid) % 360) + 360) % 360;
    const finish = () => {
      wheelBusy = false;
      wrap.classList.remove('is-spinning');
      wrap.classList.add('is-win');
      drawWheel(items, k);
      win.textContent = final.name;
      win.classList.add('is-done');
      btn.disabled = false;
      btn.textContent = 'もう一回';
      $('#roulette-result').replaceChildren(h('div', { class: 'panel panel-win reveal' }, h('p', { class: 'crown', text: '今夜はこれ！' }), dishCard(final)));
      bringIntoView($('#roulette-result'));
      confetti();
    };
    if (reduceMotion) {
      wheel.style.transform = `rotate(${wheelDeg}deg)`;
      finish();
      return;
    }
    void wheel.offsetWidth;  // 向きを戻した状態を一度確定させてから回す
    wrap.classList.add('is-spinning');
    wheelDeg += 360 * 7;
    wheel.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.1, .62, .08, 1)`;
    wheel.style.transform = `rotate(${wheelDeg}deg)`;
    setTimeout(() => drawWheel(items, -1), SPIN_MS - OPEN_MS);  // 止まる2秒前に「？」を料理名に変える
    setTimeout(finish, SPIN_MS + 100);
  }

  // ---------- 献立スロット ----------
  const REELS = ['主菜', '副菜', '汁物'];
  const slot = [null, null, null];
  const held = [false, false, false];
  const cell = d => h('div', { class: 'cell' }, d ? [pic(d, 'pic-m'), h('span', { class: 'cell-name', text: d.name })] : h('span', { class: 'cell-q', text: '？' }));

  // 写真と名前を縦に流してから止める
  function spinReel(win, pool, ms, final, done) {
    const strip = win.firstElementChild;
    const settle = () => {
      strip.style.transition = 'none'; strip.style.transform = 'none';
      strip.replaceChildren(cell(final));
      win.classList.remove('is-spinning'); win.classList.add('is-done');
      done();
    };
    win.classList.remove('is-done');
    if (reduceMotion) { settle(); return; }
    const sample = shuffle(pool).slice(0, 6);  // 流す料理は6品を使い回す（読み込む写真を増やしすぎない）
    const list = Array.from({ length: 17 }, (_, i) => sample[i % sample.length]).concat(final);
    strip.replaceChildren(...list.map(cell));
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    void strip.offsetHeight;  // ここで一度位置を確定させてから動かす
    win.classList.add('is-spinning');
    strip.style.transition = `transform ${ms}ms cubic-bezier(.15, .7, .2, 1)`;
    // 最後のマス（当たり）の位置まで、実際の高さを測って動かす
    strip.style.transform = `translateY(${strip.firstElementChild.offsetTop - strip.lastElementChild.offsetTop}px)`;
    setTimeout(settle, ms + 80);
  }
  function runSlot() {
    const btn = $('#slot-go');
    btn.disabled = true;
    $('.machine').classList.remove('is-win');
    $('#slot-result').replaceChildren();
    let left = 0;
    REELS.forEach((kubun, i) => {
      if (held[i] && slot[i]) return;
      const pool = base(d => d.kubun === kubun);
      if (!pool.length) return;
      left++;
      slot[i] = pickFrom(pool);
      spinReel($(`[data-reel="${i}"]`), pool, 1500 + i * 800, slot[i], () => { if (--left === 0) finishSlot(); });
    });
    if (left === 0) finishSlot();
  }
  function finishSlot() {
    const btn = $('#slot-go');
    btn.disabled = false;
    btn.textContent = 'もう一回';
    const set = slot.filter(Boolean);
    if (!set.length) return;
    $('.machine').classList.add('is-win');
    $('#slot-result').replaceChildren(h('div', { class: 'panel panel-win' }, menuCard(set)));
    bringIntoView($('#slot-result'));
    confetti();
  }

  // ---------- 二択（10問） ----------
  let duel = null;
  function renderDots(done) {
    $('#duel-dots').replaceChildren(...Array.from({ length: DUEL_ROUNDS }, (_, i) => h('span', { class: 'dotp' + (i < done ? ' is-on' : '') })));
  }
  function startDuel() {
    const pool = base(d => MAIN_KUBUN.includes(d.kubun));
    const avoid = avoidSet();
    const cand = pool.filter(d => !avoid.has(d.name));
    const src = shuffle(cand.length > DUEL_ROUNDS ? cand : pool);
    if (src.length <= DUEL_ROUNDS) { toast('候補が足りません。「定番の料理だけ」を外してください'); return; }
    duel = { queue: src.slice(0, DUEL_ROUNDS + 1), round: 1 };
    duel.left = duel.queue.shift();
    duel.right = duel.queue.shift();
    $('#duel-go').hidden = true;
    $('#duel-note').hidden = true;
    $('#duel-result').replaceChildren();
    renderDuel();
  }
  function duelButton(d, side) {
    return h('button', { class: 'duel-btn enter-' + side, type: 'button' },
      pic(d, 'pic-l'),
      h('span', { class: 'duel-name', text: d.name }),
      h('span', { class: 'duel-meta', text: `${d.kubun}・${d.genre}` }));
  }
  function renderDuel(keep) {
    $('#duel-progress').textContent = `第${duel.round}問／全${DUEL_ROUNDS}問　どっちが食べたい？`;
    renderDots(duel.round - 1);
    const a = duelButton(duel.left, 'left'), b = duelButton(duel.right, 'right');
    let locked = false;
    const choose = (win, won, lost) => {
      if (locked) return;
      locked = true;
      won.classList.add('is-win');
      lost.classList.add('is-lose');
      const next = () => {
        if (duel.round >= DUEL_ROUNDS) { finishDuel(win); return; }
        duel.round++;
        // 勝った料理は残り、負けた側に次の料理が入る
        const dish = duel.queue.shift();
        const stay = win === duel.left ? 'left' : 'right';
        if (stay === 'left') duel.right = dish; else duel.left = dish;
        renderDuel(stay);
      };
      if (reduceMotion) next(); else setTimeout(next, 560);  // 勝ち負けの動きを見せてから次へ
    };
    a.addEventListener('click', () => choose(duel.left, a, b));
    b.addEventListener('click', () => choose(duel.right, b, a));
    // 残った側は動かさず、入れ替わった側だけ入ってくる動きを付ける
    if (keep === 'left') a.classList.remove('enter-left');
    if (keep === 'right') b.classList.remove('enter-right');
    const vs = h('span', { class: 'duel-vs slam' }, ART.vs_badge ? h('img', { src: 'art/vs_badge.webp', alt: 'VS' }) : 'VS');
    $('#duel-area').replaceChildren(a, vs, b);
  }
  function finishDuel(win) {
    $('#duel-progress').textContent = `${DUEL_ROUNDS}問を勝ち抜きました`;
    renderDots(DUEL_ROUNDS);
    $('#duel-area').replaceChildren();
    const btn = $('#duel-go');
    btn.hidden = false;
    btn.textContent = 'もう一回';
    $('#duel-result').replaceChildren(h('div', { class: 'panel panel-win reveal' }, h('p', { class: 'crown', text: '👑 今夜の1品' }), dishCard(win, { big: true })));
    bringIntoView($('#duel-result'));
    duel = null;
    confetti();
  }

  // ---------- 占い ----------
  const signIcon = (i, mark, cls) => ART.zodiac
    ? h('img', { class: cls + '-img', src: `art/zodiac_${i + 1}.webp`, alt: '' })
    : h('span', { class: cls + '-mark', text: mark + '︎', 'aria-hidden': 'true' });
  function renderSigns() {
    $('#signs').append(...SIGNS.map(([sign, mark], i) => h('button', { class: 'sign', type: 'button', 'aria-pressed': 'false', onclick: e => {
      $$('#signs .sign').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      showFortune(sign, mark, i);
    } }, signIcon(i, mark, 'sign'), h('span', { class: 'sign-name', text: sign }))));
  }
  let fortuneTimer;
  function showFortune(sign, mark, i) {
    clearTimeout(fortuneTimer);
    const box = $('#fortune-result');
    const reveal = () => {
      const rng = seeded(`fortune|${TODAY}|${sign}`);
      const color = L.color[Math.floor(rng() * L.color.length)];
      // その色の料理を、主役の定番→定番→全部の順で探す（少なすぎる色でも必ず1品出す）
      const ok = d => d.color === color && inSeason(d);
      let pool = D.filter(d => ok(d) && d.teiban && MAIN_KUBUN.includes(d.kubun));
      if (pool.length < 3) pool = D.filter(d => ok(d) && d.teiban);
      if (pool.length < 3) pool = D.filter(ok);
      const shot = pool.filter(imgOf);
      if (shot.length >= 3) pool = shot;
      const dish = pool[Math.floor(rng() * pool.length)];
      box.replaceChildren(h('div', { class: 'panel panel-sky flip-in' },
        h('div', { class: 'sky' },
          signIcon(i, mark, 'sky'),
          h('p', { class: 'sky-title', text: `${TODAY_LABEL}の${sign}` }),
          h('p', { class: 'lucky' }, h('span', { class: 'dot dot-l', 'data-color': color }), `ラッキーカラーは「${color}」`)),
        h('p', { class: 'note', text: `食卓に${color}の一品をどうぞ。今日のラッキー晩御飯はこちら。` }),
        dishCard(dish),
        h('p', { class: 'note' }, '占いは楽しみとしてお使いください。',
          h('a', { href: URANAI_URL, target: '_blank', rel: 'noopener', text: '「☆ねこ占ぽ」で星座占いを見る' }))));
      bringIntoView(box);
    };
    if (reduceMotion) { reveal(); return; }
    // 結果の前に、水晶玉が光る「占い中」をはさむ
    box.replaceChildren(h('div', { class: 'panel panel-sky' },
      h('div', { class: 'sky gazing' }, h('span', { class: 'orb' }), h('p', { class: 'sky-title', text: `${sign}の今日を占っています…` }))));
    bringIntoView(box);
    fortuneTimer = setTimeout(reveal, 1400);
  }

  // ---------- くわしく見る・シェア ----------
  function openModal(...kids) {
    $('#modal-body').replaceChildren(...kids);
    $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }
  function openDetail(d) { openModal(dishCard(d, { big: true })); }

  function wrap(ctx, text, max) {
    const out = [];
    let line = '';
    for (const ch of text) {
      if (line && ctx.measureText(line + ch).width > max) { out.push(line); line = ch; } else line += ch;
    }
    if (line) out.push(line);
    return out;
  }
  function drawCard(names) {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1080;
    const x = c.getContext('2d');
    const font = (px, w) => `${w || 'bold'} ${px}px ${FONT}`;
    x.fillStyle = '#fff7ec'; x.fillRect(0, 0, 1080, 1080);
    x.fillStyle = '#e8632a'; x.fillRect(0, 0, 1080, 150);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ffffff'; x.font = font(54); x.fillText(`${TODAY_LABEL}の晩ごはん`, 540, 78);
    x.fillStyle = '#7a6657'; x.font = font(64); x.fillText('今夜は', 540, 262);
    // 料理名は、枠（縦480）に収まる大きさまで文字を小さくする
    let size = names.length === 1 ? 112 : 72, lines;
    for (;;) {
      x.font = font(size);
      lines = names.flatMap(n => wrap(x, n, 940));
      if (lines.length * size * 1.3 <= 480 || size <= 40) break;
      size -= 6;
    }
    x.fillStyle = '#3a2a1e';
    const lh = size * 1.3;
    let y = 560 - (lines.length - 1) * lh / 2;
    lines.forEach(l => { x.fillText(l, 540, y); y += lh; });
    x.fillStyle = '#e8632a'; x.font = font(84); x.fillText('に決定！', 540, 880);
    x.fillStyle = '#7a6657'; x.font = font(38, 'normal'); x.fillText(SITE_NAME, 540, 1010);
    return c;
  }
  function openShare(names) {
    const canvas = drawCard(names);
    const url = canvas.toDataURL('image/png');
    const text = `今夜は「${names.join('・')}」に決定！ #今日の晩ごはん`;
    const kids = [
      h('p', { class: 'eyebrow', text: 'シェア用の画像' }),
      h('img', { class: 'share-img', src: url, alt: `今夜は${names.join('、')}に決定` }),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-primary', href: url, download: `bangohan_${TODAY}.png`, text: '画像を保存' }),
        h('a', { class: 'btn', href: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener', text: 'Xに書く' }),
        h('a', { class: 'btn', href: 'https://line.me/R/share?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener', text: 'LINEで送る' })),
    ];
    // スマホなど、画像つきの共有ができる環境だけボタンを足す
    if (navigator.canShare && canvas.toBlob) {
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `bangohan_${TODAY}.png`, { type: 'image/png' });
        if (!navigator.canShare({ files: [file] })) return;
        $('#modal-body .actions').prepend(h('button', { class: 'btn btn-primary', type: 'button', text: '画像つきで共有',
          onclick: () => navigator.share({ files: [file], text }).catch(() => {}) }));
      });
    }
    openModal(...kids);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- 写真の出典 ----------
  function renderCredits() {
    const names = Object.keys(IMG);
    $('#credits-box').hidden = names.length === 0;
    $('#credits-count').textContent = `（${names.length}枚）`;
    $('#credits').replaceChildren(...names.map(n => h('li', {},
      h('a', { href: IMG[n].page, target: '_blank', rel: 'noopener', text: n }), `：${IMG[n].by}／${IMG[n].lic}`)));
  }

  // ---------- はじめに ----------
  // 使える絵に合わせて、画面に目印を付ける（スタイル側で背景を切り替える）
  Object.keys(ART).forEach(k => { if (ART[k]) document.body.classList.add('art-' + k.split('_')[0]); });

  renderHome();
  renderRecent();
  buildFilters();
  renderResults();
  renderSigns();
  renderDots(0);
  renderCredits();
  buildBulbs();
  resetRoulette();

  $$('.tabbar button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go + (b.dataset.game ? '/' + b.dataset.game : ''))));
  $$('.seg button').forEach(b => b.addEventListener('click', () => go('play/' + b.dataset.game)));
  $('#back').addEventListener('click', goBack);
  window.addEventListener('hashchange', route);
  here = location.hash.slice(1) || 'home';  // 途中の画面を開き直したときは、その画面から始める
  render(here);

  $('#teiban-only').addEventListener('change', resetRoulette);
  $('#photo-only').addEventListener('change', resetRoulette);
  $('#filter-clear').addEventListener('click', clearFilters);
  $('#filter-roulette').addEventListener('click', () => { go('play/roulette'); runRoulette(); });
  $('#result-more').addEventListener('click', () => { shown += PAGE; renderResults(); });
  $('#jump-results').addEventListener('click', () => $('#result-head').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }));
  $('#roulette-go').addEventListener('click', runRoulette);
  $('#slot-go').addEventListener('click', runSlot);
  $$('.hold').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.hold);
    if (!slot[i]) return;
    held[i] = !held[i];
    b.setAttribute('aria-pressed', String(held[i]));
  }));
  $('#duel-go').addEventListener('click', startDuel);
  $('#recent-clear').addEventListener('click', () => { recent = []; store.set('bangohan_recent', recent); renderRecent(); });
  $$('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
})();
