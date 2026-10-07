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
    buy: !!a[13], out: !!a[14], shop: a[15] >= 0 ? L.shop[a[15]] : '', cook: a[16] !== 0, places: a[17] || 0,
  }));
  // ワード検索用：ひらがな・カタカナ・全角半角の違いをなくした文字にする
  const kana = s => s.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // お店の種類は「外食の料理」にしぼったときだけ探す対象にする（ほかのときに、関係のない料理が出ないように）
  D.forEach(d => {
    d.text = kana([d.name, d.mats.join(' '), d.kubun, d.genre, d.zairyo].join(' '));
    d.textOut = d.text + ' ' + kana(d.shop);
  });
  // よくある言い換え（入力した言葉 → データの書き方。書き方が2通りある料理は両方を並べる）
  const WORDS = {
    // 肉・卵
    'とり': '鶏', '鳥': '鶏', 'ちきん': '鶏', 'ぶた': '豚', 'ぽーく': '豚', 'ぎゅう': '牛', 'びーふ': '牛', 'にく': '肉',
    '挽き肉': 'ひき肉', '挽肉': 'ひき肉', 'みんち': 'ひき肉', 'てば': '手羽', 'たまご': '卵', '玉子': '卵', 'だんご': '団子', '団子': 'だんご',
    // 魚介
    'さかな': '魚', 'さけ': '鮭', 'しゃけ': '鮭', '海老': 'えび', '蛸': 'たこ', '烏賊': 'いか', '鯖': 'さば', '鯵': 'あじ', '鰤': 'ぶり', '鰯': 'いわし', '鱈': 'たら', 'たい': '鯛',
    '牡蠣': 'かき', '鰻': 'うなぎ', '秋刀魚': 'さんま', '鮪': 'まぐろ', '鰹': 'かつお', '帆立': 'ほたて', 'さしみ': '刺身', '刺し身': '刺身',
    // 野菜・豆腐・調味料
    'やさい': '野菜', 'たまねぎ': '玉ねぎ', '玉葱': '玉ねぎ', 'ながねぎ': '長ねぎ', '葱': 'ねぎ', 'だいこん': '大根', 'はくさい': '白菜', '茄子': 'なす', '南瓜': 'かぼちゃ', '人参': 'にんじん',
    '芋': 'いも', 'ながいも': ['長いも', '長芋'], 'さといも': '里いも', 'ほうれんそう': 'ほうれん草', '椎茸': 'しいたけ', '茸': 'きのこ', '蓮根': 'れんこん', '牛蒡': 'ごぼう', '筍': 'たけのこ', '竹の子': 'たけのこ',
    '胡麻': 'ごま', '生姜': 'しょうが', '味噌': 'みそ', '醤油': 'しょうゆ', 'とうふ': '豆腐', 'どうふ': '豆腐', 'あつあげ': '厚揚げ', 'あぶらあげ': '油揚げ', 'なっとう': '納豆', 'はるさめ': '春雨',
    // 作り方
    'やき': '焼き', 'あげ': '揚げ', 'いため': '炒め', 'むし': '蒸し', 'あえ': '和え', '和え': 'あえ', 'づけ': '漬け', 'にもの': '煮物', 'にこみ': '煮込み', 'みそに': 'みそ煮', 'かくに': '角煮', 'しお': '塩',
    'からあげ': 'から揚げ', '唐揚': 'から揚', 'てんぷら': '天ぷら', '天麩羅': '天ぷら', 'てりやき': '照り焼き', 'てり焼き': '照り焼き', '照焼': '照り焼き', 'なんばん': '南蛮', 'たつた': '竜田',
    'あげだし': ['揚げ出し', '揚げだし'], '揚げだし': '揚げ出し', '揚げ出し': '揚げだし',
    // 料理の名前
    'ぎょうざ': '餃子', 'ぎょーざ': '餃子', '焼そば': '焼きそば', 'しゅーまい': 'しゅうまい', '焼売': 'しゅうまい', 'はるまき': '春巻', 'すぶた': '酢豚', 'まーぼー': '麻婆', '麻婆': 'まーぼー',
    'ほいこーろー': '回鍋肉', '回鍋肉': 'ほいこーろー', '青椒肉絲': 'ちんじゃおろーす', 'ばんばんじー': '棒棒鶏', 'ゆーりんちー': '油淋鶏', 'たんたん': '担々', '坦々': '担々', '担担': '担々', '担々': 'たんたん',
    'やきにく': ['焼肉', '焼き肉'], '焼き肉': '焼肉', '焼肉': '焼き肉', 'やきとり': '焼き鳥', '焼き鳥': 'やきとり', '焼鳥': ['焼き鳥', 'やきとり'], 'とんじる': ['豚汁', 'とん汁'], 'ぶたじる': '豚汁', '豚汁': 'とん汁',
    '豚かつ': 'とんかつ', 'おやこ': '親子', 'てんどん': '天丼', 'てんしんはん': '天津飯', 'おこのみ': 'お好み', 'ちゃわん': '茶碗', '茶わん': '茶碗', 'ひやし': '冷やし', '冷し': '冷やし',
    'ひややっこ': '冷奴', '冷ややっこ': '冷奴', '冷や奴': '冷奴', 'ゆどうふ': '湯豆腐', 'しらあえ': '白和え', 'すのもの': '酢の物', 'お浸し': 'おひたし', '金平': 'きんぴら', 'ぞうすい': '雑炊',
    'すぱげてぃ': 'すぱげってぃ', 'ぱすた': 'すぱげってぃ', 'やきめし': 'ちゃーはん', '焼き飯': 'ちゃーはん', '焼飯': 'ちゃーはん', '炒飯': 'ちゃーはん', '蕎麦': 'そば', '素麺': 'そうめん', 'びびんぱ': 'びびんば',
    // ご飯・汁・鍋・ジャンル・お店
    'ごはん': 'ご飯', '御飯': 'ご飯', 'たきこみ': '炊き込み', '炊込': '炊き込み', 'どんぶり': '丼', 'どん': '丼', 'なべ': '鍋', 'めん': '麺', 'しる': '汁', 'すし': '寿司', '鮨': '寿司',
    'わしょく': '和', 'ようしょく': '洋', 'ちゅうか': '中華', 'かんこく': '韓国', 'わふう': '和風', 'ようふう': '洋風', 'いざかや': '居酒屋', 'ていしょく': '定食',
  };
  const WORD_KEYS = Object.keys(WORDS).sort((a, b) => b.length - a.length);
  // 入力した言葉を、データの書き方に直した候補を並べる（どれか1つでも含む料理を探す）
  function variants(t) {
    const out = new Set([t]);
    // 言葉の中の言い換えを、長いものから順にまとめて置き換えた形（例：とりにく→鶏肉）
    let all = '';
    for (let i = 0; i < t.length;) {
      const k = WORD_KEYS.find(key => t.startsWith(key, i));
      if (k) { all += [].concat(WORDS[k])[0]; i += k.length; } else all += t[i++];
    }
    out.add(all);
    // 1か所だけ置き換えた形（例：ちきんなんばん→ちきん南蛮）
    WORD_KEYS.forEach(k => { if (t.includes(k)) [].concat(WORDS[k]).forEach(v => out.add(t.split(k).join(v))); });
    return [...out].map(kana);
  }

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
  const PHOTO_MIN = 12;        // 「定番の料理だけ」を効かせる下限（定番がこれより少ない種類は、定番以外も含めて選ぶ）
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
  // 効果音・BGM（sound.js）と、決まった瞬間の画面効果（fx.js）。読み込めていないときは、何もしない代わりを使う
  const SND = window.SND || { sfx() {}, ticks() {}, scene() {}, hot() {}, cut() {}, hush() {}, set() {}, on: false, ok: false };
  const FX = window.FX || { play() {}, warm() {} };
  const SAKURA_FX = ['#ffd1dc', '#fff0f5', '#ff9eb5', '#ffd166'];   // 着物のコンシェルジュのときの光の色（桜色）
  // 円盤の動き（cubic-bezier(.1, .62, .08, 1)）で、回し始めから何秒後に何度回っているかを求める（針の音を、回る速さに合わせるため）
  // n＝円盤のマスの数。針（真上＝270度）がマスの境目をはじくのは、270 を 1マスの角度で割った余りのぶん回ったときと、そこから1マスぶんごと（10マスなら 18度・54度・90度…）
  function wheelTicks(total, ms, n) {
    const bez = (u, a, b) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u, out = [];
    const seg = 360 / Math.max(1, n);
    let next = (270 % seg) || seg, last = -1;
    for (let i = 1; i <= 2000; i++) {
      const u = i / 2000, t = bez(u, .1, .08) * ms / 1000, deg = bez(u, .62, 1) * total;
      while (deg >= next) { if (t - last >= .05) { out.push(t); last = t; } next += seg; }   // 速すぎる所は間引く（1秒に20回まで）
    }
    return out;
  }
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

  // 決まった瞬間の紙吹雪（四角・丸・細長い紙が、中央と左右の下から舞う）。cols＝紙の色（指定が無ければ、いつもの色）
  function confetti(cols = ['#e8632a', '#f6bd60', '#84a59d', '#f28482', '#5ba85b', '#ffd166', '#6fa8ff']) {
    if (reduceMotion) return;
    const c = h('canvas', { class: 'confetti' });
    document.body.append(c);
    const W = c.width = window.innerWidth, H = c.height = window.innerHeight, x = c.getContext('2d');
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

  // ---------- 候補のしぼり込み（すべて／買える料理／外食の料理） ----------
  // 「今夜はどうする？」は、料理が決まったあとにカードの中で選ぶ（ways）。
  // ここは、さがす・おまかせの候補を先に絞りたいとき用。画面の上で常に選ぶ形をやめたので、前回の選択は持ち越さず、開くたびに「すべて」から始める
  const MODES = ['any', 'buy', 'out'];
  let mode = 'any';
  // 買える場所の名前（料理側は、買える場所を足し合わせた数で持つ。1＝コンビニ、2＝スーパー、4＝お弁当・持ち帰りの店）
  const PLACES = { 1: 'コンビニ', 2: 'スーパー', 4: 'お弁当・持ち帰りの店' };
  let epoch = 0;  // しぼり込みを変えるたびに1つ進める。回っている途中で変えたら、前の条件の結果は出さない
  // しぼり込みに合う料理か
  const inMode = d => mode === 'any' || (mode === 'buy' ? d.buy : d.out);
  const daysAgo = dstr => Math.round((new Date(TODAY) - new Date(dstr)) / 86400000);
  const avoidSet = () => new Set(recent.filter(r => daysAgo(r.d) < AVOID_DAYS).map(r => r.n));

  function decide(names) {
    recent = recent.filter(r => !names.includes(r.n));
    names.forEach(n => recent.unshift({ n, d: TODAY }));
    recent = recent.slice(0, 30);
    store.set('bangohan_recent', recent);
    renderRecent();
    // 今日の一品を（どの画面からでも）決めたら、「決め直す」の途中だった印を消して、決めたあとの表示にする
    if (todayDish && names.includes(todayDish.name)) todayReopened = false;
    renderTodayPick();
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
      h('figcaption', {}, p.ai ? '画像はイメージです'
        : h('a', { href: p.page, target: '_blank', rel: 'noopener', text: `写真：${p.by}／${p.lic}／Wikimedia Commons` })));
  }
  // 料理が決まったあとの「今夜はどうする？」。その料理でできる手段だけ押せる（できない手段は、うすく出して「目安なし」と書く）
  //   家で作る → 作り方の検索を開く／買って帰る・外で食べる → サイトの中で地図が開く
  function ways(d) {
    const tile = (on, icon, label, sub, attrs) => {
      const kids = [ART.ico2 ? h('img', { src: `art/ico_${icon}.webp`, alt: '', width: 40, height: 40 }) : null, h('b', { text: label }), h('small', { text: on ? sub : '目安なし' })];
      return on ? h(attrs.href ? 'a' : 'button', Object.assign({ class: 'way' }, attrs), kids)
        : h('button', { class: 'way', type: 'button', disabled: true }, kids);
    };
    return h('div', { class: 'ways' },
      h('p', { class: 'ways-title', text: '今夜はどうする？' }),
      h('div', { class: 'ways-row' },
        tile(d.cook, 'cook', '家で作る', '作り方を探す', { href: recipeUrl(d.name), target: '_blank', rel: 'noopener' }),
        tile(d.buy, 'buy', '買って帰る', '地図で探す', { type: 'button', onclick: () => openMap(d, 'buy') }),
        tile(d.out, 'out', '外で食べる', '地図で探す', { type: 'button', onclick: () => openMap(d, 'out') })));
  }
  // 料理名の下の一言
  function hint(d) {
    return '主な材料：' + d.mats.join('・');
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
      h('p', { class: 'mats', text: hint(d) }),
      // bare＝「今日の一品」用。決めるボタンと「今夜はどうする？」は、カードの外（renderTodayPick）で出す
      opt.bare ? null : ways(d),
      opt.bare ? null : h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => decide([d.name]), text: 'これに決定' }),
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
  // ページの背景：ページを切り替えるたびに、用意した絵からランダムに選ぶ（直前と同じ絵は続けて選ばない）
  const BGS = ['today', 'search', 'play', 'fortune', 'table'].filter(n => ART['page_' + n]);
  let lastView = '', bgFlip = 0;
  function pickBg() {
    const rest = BGS.filter(b => b !== document.body.dataset.bg);
    if (!rest.length) return;
    document.body.dataset.bg = rest[Math.floor(Math.random() * rest.length)];
    document.body.dataset.bgflip = String(bgFlip ^= 1);  // 絵が替わるたびに、ふわっと出す動きをやり直すための目印
  }
  function show(view) {
    if (view !== 'top' && view !== lastView) pickBg();
    lastView = view;
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + view));
    document.body.dataset.view = view;  // ページごとの背景と、トップ画面での見出し・下のメニューの出し分けに使う
    $$('.tabbar button').forEach(b => b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'));
    if (view === 'play') updatePoolNote();
    window.scrollTo(0, 0);
  }
  // いま流しているBGMの場面（roulette・slot・fortune。流していなければ空）
  let sceneNow = '';
  function playScene(name) { sceneNow = name; SND.scene(name); }
  // いま出ている遊びの画面（roulette・slot・fortune。遊びの画面でなければ空）
  function screenScene() {
    const view = document.body.dataset.view, game = ($('.game.is-active') || {}).id;
    return view === 'fortune' ? 'fortune' : view === 'play' && game === 'game-roulette' ? 'roulette' : view === 'play' && game === 'game-slot' ? 'slot' : '';
  }
  // その遊びが、いま回っている最中か
  function roundOn(scene) { return scene === 'roulette' ? wheelBusy : scene === 'slot' ? reelState.some(Boolean) : false; }
  // 遊びの音は、その遊びの画面が出ている間だけ鳴らす（回している途中で別の画面や別の遊びへ移ったら、そこでは鳴らさない）
  function gameSfx(scene, name, o) { if (screenScene() === scene) SND.sfx(name, o); }
  // BGMを盛り上げる・しずめるのも、その遊びのBGMを流しているときだけ
  function gameHot(scene, v) { if (sceneNow === scene) SND.hot(v); }
  function gameHush(scene, sec) { if (sceneNow === scene && screenScene() === scene) SND.hush(sec); }
  // 画面を切り替えたあと：BGMの場面と違う画面にいるなら、BGMと、予約してある音（針の音など）を止める。
  // 回している途中の遊びの画面へ戻ってきたときは、BGMを流し直す
  function sceneCheck() {
    const here = screenScene();
    if (sceneNow && here !== sceneNow) { sceneNow = ''; SND.scene(null); SND.cut(); }
    if (!sceneNow && here && roundOn(here)) playScene(here);
  }
  // 決まった瞬間に、舞台を小さく揺らす（動きを減らす設定のときは、スタイル側で止める）
  function shake(el) { if (!el) return; el.classList.remove('fx-shake'); void el.offsetWidth; el.classList.add('fx-shake'); setTimeout(() => el.classList.remove('fx-shake'), 400); }
  // 「音」のスイッチの見た目を、いまの設定に合わせる
  function soundLabel() {
    $$('.sound').forEach(b => {   // 「♪」は、ルーレットと献立スロットの「回す」の行と、占いの見出しの行にある
      b.hidden = !SND.ok;
      b.setAttribute('aria-checked', String(SND.on));   // 見た目は「♪」だけ。切ってあるときは、スタイル側で斜めの線を引く
      b.title = SND.on ? '音あり（押すと消えます）' : '音なし（押すと鳴ります）';
    });
  }
  function showGame(game) {
    $$('.seg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.game === game)));
    $$('.game').forEach(g => g.classList.toggle('is-active', g.id === 'game-' + game));
  }

  // 画面の行き来。ブラウザの「戻る」でも、画面左上の「戻る」ボタンでも、前の画面に戻れるようにする
  // top＝トップ画面（入口）。URLに行き先が無いときは、ここから始める
  const VIEWS = ['top', 'home', 'search', 'play', 'fortune'], GAMES = ['roulette', 'slot', 'duel'];
  const trail = [];   // 通ってきた画面
  let here = 'top';
  function render(place) {
    const [view, game] = place.split('/');
    const held = document.activeElement;
    show(VIEWS.includes(view) ? view : 'top');
    if (GAMES.includes(game)) showGame(game);
    // 外で食べるときは献立スロットを出さない（戻るや保存したURLで来ても、ルーレットを見せる）
    if (mode === 'out' && $('#game-slot').classList.contains('is-active')) showGame('roulette');
    $('#back').hidden = here === 'top';
    // 押したボタンやリンクが切り替えで隠れたときは、新しい画面の見出しにフォーカスを移す（キーボード・読み上げで迷子にならないように）
    if (held && held !== document.body && !held.getClientRects().length) $(document.body.dataset.view === 'top' ? '.top-title' : '.home-link').focus({ preventScroll: true });
    sceneCheck();
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
    const place = location.hash.slice(1) || 'top';
    if (place === here) return;
    if (trail.length && trail[trail.length - 1] === place) trail.pop(); else trail.push(here);
    here = place;
    render(place);
  }
  function goBack() {
    if (trail.length) history.back(); else go('top');
  }

  // 画面が縦に並ぶ幅（スマホなど）では、結果が出たらそこまで画面を送る
  const narrow = window.matchMedia('(max-width: 899px)');
  function bringIntoView(el) {
    if (narrow.matches) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  // ---------- 今日の一品 ----------
  function renderHome() {
    const rng = seeded('today|' + TODAY + '|any');
    // 今日の一品は、しぼり込みに関係なく全部の料理から選ぶ。定番が少なすぎる種類は、定番以外も含める
    const pool = k => { const all = D.filter(d => inSeason(d) && k(d)); const t = all.filter(d => d.teiban); return t.length >= 5 ? t : all; };
    const mains = pool(d => MAIN_KUBUN.includes(d.kubun));
    const sides = pool(d => d.kubun === '副菜');
    const soups = pool(d => d.kubun === '汁物');
    const shot = mains.filter(imgOf);
    const from = shot.length >= 20 ? shot : mains;  // 写真のある料理が十分あれば、その中から選ぶ
    const main = from[Math.floor(rng() * from.length)];
    const withs = [sides[Math.floor(rng() * sides.length)], soups[Math.floor(rng() * soups.length)]].filter(Boolean);
    $('#today-label').textContent = TODAY_LABEL + 'の一品';
    todayDish = main || null;
    $('#today-dish').replaceChildren(main ? dishCard(main, { big: true, bare: true }) : h('p', { class: 'note', text: 'この条件で提案できる料理がありません。' }));
    renderTodayPick();
    $('#today-with').hidden = withs.length === 0;
    $('#today-with').replaceChildren(
      h('p', { class: 'with-title', text: '合わせるなら' }),
      h('ul', {}, withs.map(d => h('li', {}, h('button', { class: 'link', type: 'button', onclick: () => openDetail(d), text: `${d.kubun}：${d.name}` })))));
  }

  // 今日の一品の下：まず「これに決定」か、ほかの方法で決めるかを選ぶ。
  // 「これに決定」を押したあとは、同じ場所に「今夜はどうする？」（作る・買う・外で食べる）を出す
  let todayDish = null, todayReopened = false;   // todayReopened＝決めたあとに「ほかの方法で決め直す」を押した
  function renderTodayPick() {
    const d = todayDish;
    const done = !!d && !todayReopened && recent.some(r => r.n === d.name && r.d === TODAY);
    $('#today-pick').hidden = done;
    $('#today-decide').hidden = !d;
    const box = $('#today-done');
    box.hidden = !done;
    box.replaceChildren(...(done ? [
      // 長い料理名で折り返すときに、「に決定！」の途中で切れないようにする
      h('p', { class: 'crown' }, `👑 「${d.name}`, h('span', { class: 'keep', text: '」に決定！' })),
      ways(d),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => openShare([d.name]), text: 'シェア' }),
        h('button', { class: 'link', type: 'button', text: 'ほかの方法で決め直す',
          onclick: () => { todayReopened = true; renderTodayPick(); $('#today-decide').focus({ preventScroll: true }); } })),
    ] : []));
  }

  // ---------- さがす ----------
  const F = { mats: new Set(), zairyo: new Set(), genre: new Set(), purpose: new Set(), season: new Set(), kubun: new Set(), shop: new Set() };
  let shown = PAGE;
  let query = [];  // ワード検索の言葉（空白で区切った分だけ、すべて含む料理を探す。1つの言葉につき、言い換えた候補を並べて持つ）
  const hasFilter = () => Object.values(F).some(s => s.size) || query.length > 0;
  const matchWords = d => {
    const text = mode === 'out' ? d.textOut : d.text;
    return query.every(vs => vs.some(v => text.includes(v)));
  };

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
    pickButtons($('#f-shop'), L.shop, F.shop);
  }
  function filtered() {
    const hit = d => d.mats.filter(m => F.mats.has(m)).length;
    return D
      .filter(d => inMode(d) && matchWords(d)
        && (!F.shop.size || F.shop.has(d.shop))
        && (!F.kubun.size || F.kubun.has(d.kubun))
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
          h('span', { class: 'row-meta', text: (mode === 'out' ? [d.shop, d.genre] : mode === 'buy' ? [d.kubun, d.genre] : [d.kubun, d.genre, d.mats.join('・')]).join('｜') })),
        hit > 0 && F.mats.size > 1 ? h('span', { class: 'row-hit', text: `材料${hit}つ一致` }) : null))));
    $('#result-more').hidden = list.length <= shown;
  }
  function clearFilters() {
    Object.values(F).forEach(s => s.clear());
    query = [];
    $('#q').value = '';
    $$('#view-search .pick').forEach(b => b.setAttribute('aria-pressed', 'false'));
    shown = PAGE;
    renderResults();
    resetRoulette();
  }

  // ---------- おまかせ（共通） ----------
  const teibanOnly = () => $('#teiban-only').checked;
  function base(test) {
    const all = D.filter(d => inMode(d) && inSeason(d) && test(d));
    const list = teibanOnly() ? all.filter(d => d.teiban) : all;
    return list.length < PHOTO_MIN ? all : list;  // 定番だけでは少なすぎるときは、定番以外も含める
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
    wrap.classList.remove('is-win', 'is-spinning', 'is-tense');
    if (sceneNow === 'roulette') SND.cut();   // 回っている途中で最初の状態に戻したときは、予約してある音もやめる
    gameHot('roulette', false);
    drawWheel(new Array(WHEEL_N).fill(null), -1);
    const win = $('#roulette-window');
    win.classList.remove('is-done'); win.textContent = '？';
    $('#roulette-go').textContent = '回す';
    $('#roulette-result').replaceChildren();
    wheelChara.reset();
    updatePoolNote();
  }

  // ---------- ゲームに出てくるキャラクター（ルーレット・献立スロット） ----------
  // 「回す」を押すと、横からキャラクターが歩いてくる。ルーレットでは円盤を回し、献立スロットでは回っている列を止める（スロットの動きは、スロットの節）。
  // ふだんは MUSUBI（おにぎりのコンシェルジュ）、たまに（RARE_RATE の割合で）着物のコンシェルジュが出る（2026-10-05 社長指示）
  // 絵は6コマ（歩く1・歩く2・手を伸ばす・回す・見守る・喜ぶ）。どのコマを出すかは data-pose でスタイル側が決める
  const CHARA_MAIN = ART.chara_musubi ? 'musubi' : '', CHARA_RARE = ART.chara_kimono ? 'kimono' : '';
  const RARE_RATE = 0.10;   // 着物のコンシェルジュが出る割合（10%＝平均で10回に1回。回すたびに毎回くじを引く。2026-10-07 社長指示）
  const WALK_MS = 1300, REACH_MS = 380, SWING_MS = 420, OUT_MS = 350;   // 歩く・手を伸ばす・回す・退場の長さ（スタイル側の動きと合わせる）
  const SAKURA = ['#ffd1dc', '#ffb7c5', '#ff9eb5', '#fff0f5', '#ffd166'];  // 着物のコンシェルジュのときの紙吹雪（桜色）
  const CHEER_MS = 1300;    // 止まったあと、喜ぶ姿と光の効果を見せてから結果のカードへ画面を送るまでの長さ
  // 絵は先に読み込んでおく。読み込めていないキャラクターは出さない（歩いてくる間、何も見えないことが無いように）
  const charaImg = {};
  function charaLoad(who) {
    if (who && !charaImg[who]) { charaImg[who] = new Image(); charaImg[who].src = `art/chara_${who}.webp`; }
  }
  const charaReady = who => !!who && !!charaImg[who] && charaImg[who].complete && charaImg[who].naturalWidth > 0;
  // だれを出すか：RARE_RATE の割合で着物のコンシェルジュ。絵がまだ読み込めていないときは、いま出ているキャラクター（now）のまま。だれも出せなければ空
  function charaPick(now) {
    charaLoad(CHARA_MAIN); charaLoad(CHARA_RARE);
    const who = Math.random() < RARE_RATE && charaReady(CHARA_RARE) ? CHARA_RARE : CHARA_MAIN;
    return charaReady(who) ? who : now;
  }
  // ルーレット用の動き。box＝キャラクターの枠（.chara-box）。無いとき（前の版の画面が端末に残っていて、プログラムだけ新しいとき）は、キャラクターなしで動く
  // stage＝はみ出しを切っている親。キャラクターは、その左のふちの外から歩いてくる
  function makeChara(box, stage) {
    let on = '';     // いま出ているキャラクター（いなければ空）
    let timer = 0;   // 「喜ぶ姿を見せてから、結果のカードへ画面を送る」の予約
    const pose = p => { if (box) box.dataset.pose = p; };
    return {
      rare: () => !!on && on === CHARA_RARE,
      cancel() { clearTimeout(timer); },   // 次に回すときは、前の回の予約を取り消す
      reset() {                            // 最初の状態に戻す（キャラクターを下げる）
        clearTimeout(timer);
        on = '';
        if (box) { box.hidden = true; box.dataset.pose = ''; }
      },
      // 回す前の動き。キャラクターが手をかけて回した瞬間に then を呼ぶ（then の中で、円盤やリールを回し始める）
      // at＝押したときの番号。途中でしぼり込みが変わって番号が進んだら、続きの動きはしない
      spin(at, then) {
        if (!box || !stage) { then(); return; }
        const who = charaPick(on);
        if (!who) { then(); return; }               // だれも出せないときは、キャラクターなしで回す
        const step = (ms, fn) => setTimeout(() => { if (at === epoch) fn(); }, ms);
        const show = () => { on = who; box.dataset.who = who; box.hidden = false; };
        if (reduceMotion) { show(); pose('watch'); then(); return; }  // 動きを減らす設定のときは、歩かせずに立たせるだけ
        const swing = () => {
          pose('reach');
          step(REACH_MS, () => { pose('swing'); then(); step(SWING_MS, () => { if (box.dataset.pose === 'swing') pose('watch'); }); });
        };
        const enter = () => {
          show();
          pose('');
          // 左のふちの外から、立つ場所まで歩く（歩く距離は画面の幅で変わるので、その場で測る）
          const from = box.getBoundingClientRect().right - stage.getBoundingClientRect().left;
          if (from <= 0) { swing(); return; }   // 別の画面へ移っていて測れないときは、歩かせずに立たせて回す
          box.style.setProperty('--from', `${-Math.ceil(from)}px`);
          void box.offsetWidth;
          pose('walk');
          if (who === CHARA_RARE) gameSfx('roulette', 'rare');
          step(WALK_MS, swing);
        };
        if (on === who) swing();                                 // 同じキャラクターがもういる：歩き直さず、その場で回す
        else if (on) { pose('out'); step(OUT_MS, enter); }       // 交代：いまのキャラクターが下がってから、次が歩いてくる
        else enter();
      },
      // 止まったあと：喜ぶ姿（kind＝cheer：跳ねる）を少し見せてから after を呼ぶ。キャラクターがいなければ、すぐ呼ぶ
      cheer(kind, at, after) {
        if (!on) { after(); return; }
        pose(kind);
        if (reduceMotion) after();
        else timer = setTimeout(() => { if (at === epoch) after(); }, CHEER_MS);
      },
    };
  }
  const wheelChara = makeChara($('#chara'), $('.wheel-stage'));   // ルーレット：円盤の左下に立つ
  function updatePoolNote() {
    const n = roulettePool().length;
    const what = { any: '今の季節に合う主役の料理', buy: '買って帰れる主役の料理', out: '外で食べられる主役の料理' }[mode];
    $('#roulette-pool').textContent = hasFilter() ? `「さがす」で絞った${n}件から選びます` : `${what}${n}件から選びます`;
    $('#roulette-go').disabled = n === 0 || wheelBusy;
  }
  function runRoulette() {
    const pool = roulettePool();
    if (!pool.length || wheelBusy) return;
    wheelBusy = true;
    wheelChara.cancel();  // 前の回の「結果のカードへ画面を送る」が残っていたら取り消す
    playScene('roulette'); gameSfx('roulette', 'tap');
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
    const at = epoch;
    const finish = () => {
      if (at !== epoch) return;  // 回っている途中でしぼり込みが変わった
      wheelBusy = false;
      wrap.classList.remove('is-spinning');
      wrap.classList.add('is-win');
      drawWheel(items, k);
      win.textContent = final.name;
      win.classList.add('is-done');
      btn.disabled = false;
      btn.textContent = 'もう一回';
      $('#roulette-result').replaceChildren(h('div', { class: 'panel panel-win reveal' }, h('p', { class: 'crown', text: '今夜はこれ！' }), dishCard(final)));
      // キャラクターがいるときは、喜ぶ姿（跳ねる）を少し見せてから、結果のカードへ画面を送る
      wheelChara.cheer('cheer', at, () => bringIntoView($('#roulette-result')));
      // 決まった瞬間：魔法が発動するような光と音（画面効果が使えないときは、紙吹雪）
      wrap.classList.remove('is-tense');
      gameHot('roulette', false);
      if (!wrap.getClientRects().length) return;   // 別の画面へ移っているときは、何も出さない
      gameSfx('roulette', 'win-roulette');
      if (window.FX && !reduceMotion) { FX.play('magic', wrap, { palette: wheelChara.rare() ? SAKURA_FX : undefined }); shake($('.wheel-stage')); }
      else confetti(wheelChara.rare() ? SAKURA : undefined);
    };
    // 円盤を回し始める（キャラクターがいるときは、キャラクターが回した瞬間に呼ばれる）
    const start = () => {
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
      gameSfx('roulette', 'spin'); gameHot('roulette', true); if (screenScene() === 'roulette') SND.ticks(wheelTicks(wheelDeg, SPIN_MS, items.length));   // 回り始めの音と、針がマスをはじく音（回る速さに合わせる）
      setTimeout(() => {   // 止まる2秒前に「？」を料理名に変える。ここから、決まるまで音と光を高めていく
        if (at !== epoch) return;
        drawWheel(items, -1);
        wrap.classList.add('is-tense');
        gameSfx('roulette', 'riser', { d: OPEN_MS / 1000 - .2 });
      }, SPIN_MS - OPEN_MS);
      setTimeout(() => { if (at === epoch) gameHush('roulette', .5); }, SPIN_MS - 220);   // 決まる直前の「間」：BGMを一瞬しずめる
      setTimeout(finish, SPIN_MS + 100);
    };
    wheelChara.spin(at, start);
  }

  // ---------- 献立スロット ----------
  const REELS = ['主菜', '副菜', '汁物'];
  const slot = [null, null, null];
  const held = [false, false, false];
  const cell = d => h('div', { class: 'cell' }, d ? [pic(d, 'pic-m'), h('span', { class: 'cell-name', text: d.name })] : h('span', { class: 'cell-q', text: '？' }));
  const reelState = [0, 0, 0];              // 列の様子：0＝止まっている／1＝回っている／2＝止まりかけ／3＝回っていて、「推す」が押された（キャラクターが止めに来るのを待っている）
  const reelStop = [null, null, null];      // 回っている列を止める関数
  const REEL_STOP_MS = 360;                 // 「推す」を押してから、列が止まるまでの長さ
  // 要素にいま掛かっている動き（transform）の、横・縦のずれ（px）を画面から読む。動いている最中の、その瞬間の位置が分かる
  const shiftOf = el => {
    const m = /^matrix(3d)?\(([^)]+)\)/.exec(getComputedStyle(el).transform);
    if (!m) return [0, 0];
    const v = m[2].split(',').map(Number);
    return m[1] ? [v[12], v[13]] : [v[4], v[5]];
  };
  let slotRun = 0;                          // 何回目の「回す」か（前の回の予約が、次の回の列を止めてしまわないように見分ける）
  let slotIdle = 0;                         // 「推す」が押されないままのときに、残りの列を止める予約

  // 列の下のボタン：回っている間は「推す」（押すと、キャラクターがその列を止めに行く）。料理が出て止まったら「固定」（押すと、次に回しても変わらない）
  function holdLabels() {
    $$('.hold').forEach(b => {
      const i = Number(b.dataset.hold);
      const fix = !!slot[i] && !reelState[i];
      b.textContent = fix ? '固定' : '推す';
      if (fix) b.setAttribute('aria-pressed', String(held[i])); else b.removeAttribute('aria-pressed');   // 読み上げ用：「固定」のときだけ、押してある・いないを伝える
      b.classList.toggle('is-live', reelState[i] === 1);   // 回っている（押せる）
      b.classList.toggle('is-wait', reelState[i] === 3);   // 押された（キャラクターが止めに来るのを待っている）
    });
  }
  // 列を止める（キャラクターが「推す」にタッチしたとき。キャラクターがいないときは、使う人が押したとき）
  function pushReel(i) {
    if (reelState[i] !== 1 && reelState[i] !== 3) return;
    gameSfx('slot', 'reelstop');
    const b = $(`[data-hold="${i}"]`);
    b.classList.add('is-touched');
    setTimeout(() => b.classList.remove('is-touched'), 280);
    reelStop[i]();
  }

  // 列を回し始める：止めるまで、写真と名前を縦に流し続ける。動きを減らす設定のときは、回さずにすぐ結果を出す
  function spinReel(i, pool, final, done) {
    const win = $(`[data-reel="${i}"]`), strip = win.firstElementChild;
    const at = epoch;
    let last = null;   // 止まる料理のマス（回し始めに作る）
    const settle = () => {
      if (at !== epoch) return;  // 回っている途中でしぼり込みが変わった
      strip.style.transition = 'none'; strip.style.transform = 'none';
      strip.replaceChildren(last || cell(final));
      win.classList.remove('is-spinning'); win.classList.add('is-done');
      reelState[i] = 0; reelStop[i] = null;
      done();
    };
    win.classList.remove('is-done');
    if (reduceMotion) { settle(); return; }
    const sample = shuffle(pool).slice(0, 6);  // 流す料理は6品を使い回す（読み込む写真を増やしすぎない）
    const loop = Array.from({ length: 6 }, (_, k) => sample[k % sample.length]);
    last = cell(final);                        // 止まる料理のマス。ここで作っておくと、回っている間に写真が読み込まれる
    // 6品を2回並べて、半分まで流したら頭に戻す（つなぎ目が見えない）。流す動きはスタイル側（.is-spinning）
    strip.style.transition = 'none'; strip.style.transform = '';
    strip.replaceChildren(...loop.concat(loop).map(cell));
    win.classList.add('is-spinning');
    reelState[i] = 1;
    reelStop[i] = () => {
      if (at !== epoch || (reelState[i] !== 1 && reelState[i] !== 3)) return;
      reelState[i] = 2;
      // 流すのをやめて、いま見えている所から3品ぶん送って、結果で止める
      const high = strip.firstElementChild.offsetHeight || 1, y = Math.max(0, -shiftOf(strip)[1]);
      const k = Math.floor(y / high);           // いま、いちばん上に見えているマスの番号
      win.classList.remove('is-spinning');
      strip.replaceChildren(cell(loop[k % 6]), cell(loop[(k + 1) % 6]), cell(loop[(k + 2) % 6]), last);
      strip.style.transform = `translateY(${-(y - k * high)}px)`;
      void strip.offsetHeight;  // ここで一度位置を確定させてから動かす
      strip.style.transition = `transform ${REEL_STOP_MS}ms cubic-bezier(.2, .9, .3, 1)`;
      strip.style.transform = `translateY(${strip.firstElementChild.offsetTop - strip.lastElementChild.offsetTop}px)`;
      holdLabels();
      setTimeout(settle, REEL_STOP_MS + 60);
    };
  }
  // そのしぼり込みで候補が無い列（「買える料理」の汁物など）は、回さずに「なし」と見せて理由を書く
  function markReels() {
    const none = [];
    REELS.forEach((kubun, i) => {
      const empty = base(d => d.kubun === kubun).length === 0;
      const win = $(`[data-reel="${i}"]`);
      win.classList.toggle('is-none', empty);
      $(`[data-hold="${i}"]`).disabled = empty;
      if (empty) { none.push(kubun); win.firstElementChild.replaceChildren(h('div', { class: 'cell' }, h('span', { class: 'cell-none', text: 'なし' }))); }
    });
    const what = mode === 'buy' ? '買って帰れる' : mode === 'out' ? '外で食べられる' : '今の季節に合う';
    const note = $('#slot-none');
    note.hidden = none.length === 0;
    note.textContent = none.length === REELS.length ? `${what}料理の候補がありません。`
      : none.length ? `${what}${none.join('・')}の候補が無いので、ほかの列だけ回します。` : '';
    $('#slot-go').disabled = none.length === REELS.length;
    holdLabels();
  }

  // 献立スロットのキャラクター：使う人が「推す」を押すと、その列のボタンまで行って、ぴょんと跳んでタッチして止める（押された順に）。
  // 全部止まったら、跳ねながら定位置（「回す」ボタンの左）へ戻って、両手で献立を案内する（2026-10-07 社長指示）
  // 絵の中の位置（枠の大きさに対する割合）：hand＝手を伸ばしたときの手の横の位置／top＝そのときの手の高さ（上から）／body＝体の左はし
  const SLOT_FIT = { musubi: { hand: .74, top: .45, body: .05 }, kimono: { hand: .66, top: .03, body: .18 } };
  const TOUCH_MS = 450, TOUCH_AT = 170;     // タッチの動きの長さと、そのうち手がボタンに届くまでの長さ
  const PRESENT_MS = 700;                   // 案内する姿を見せてから、結果のカードへ画面を送るまでの長さ
  const IDLE_MS = 8000;                     // 「推す」が押されないまま、これだけたったら、キャラクターが残りの列を止めに行く
  const slotChara = (() => {
    const box = $('#slot-chara'), stage = $('.machine');
    let on = '';        // いま出ているキャラクター（いなければ空）
    let timer = 0;      // 「案内する姿を見せてから、結果のカードへ画面を送る」の予約
    let seq = 0;        // 動きの通し番号（新しい動きが始まったら、前の動きの続きはしない）
    let cur = 0;        // 定位置からの横のずれ（px）
    let duty = null;    // この回の仕事：{ at＝押したときの番号, my＝通し番号, queue＝止めに行く列（押された順）, ready＝持ち場に着いたか, busy＝止めに行っている最中か }
    const pose = p => { box.dataset.pose = p; };
    const move = (dx, ms) => { box.style.transition = ms ? `transform ${ms}ms linear` : 'none'; box.style.transform = `translateX(${dx}px)`; cur = dx; };
    const show = who => { on = who; box.dataset.who = who; box.hidden = false; };
    // いま実際にいる横の位置（定位置からのずれ）。動いている最中は cur（行き先）と違うので、画面から読む
    const here = () => shiftOf(box)[0];
    // i 番目の列の「推す」に手が届く立ち位置（定位置からの横のずれ）と、手を届かせるために跳ぶ高さ
    const spot = i => {
      const b = $(`[data-hold="${i}"]`).getBoundingClientRect(), r = box.getBoundingClientRect(), s = stage.getBoundingClientRect(), fit = SLOT_FIT[on];
      const home = r.left - here();   // 定位置にいるときの、枠の左はし
      return {
        dx: Math.max(s.left + 2 - (home + fit.body * r.width), b.left + b.width * .55 - (home + fit.hand * r.width)),   // 体が筐体の左からはみ出さない範囲で
        hop: Math.max(0, Math.min(r.height * .45, r.top + fit.top * r.height - (b.bottom - 8))),   // 幅の狭い画面でも手が届く高さまで
      };
    };
    const step = (d, ms, fn) => setTimeout(() => { if (d === duty && d.at === epoch && d.my === seq) fn(); }, ms);
    // 押された列を、順に止めに行く
    const next = d => {
      while (d.queue.length && reelState[d.queue[0]] !== 3) d.queue.shift();   // もう止まっている列は飛ばす
      if (!d.queue.length) { d.busy = false; pose('watch'); return; }          // 次に押されるのを待つ
      d.busy = true;
      const i = d.queue.shift();
      if (!box.getClientRects().length) { pushReel(i); next(d); return; }   // 別の画面へ移っていて見えない：歩かせずに止めて、次へ
      const { dx, hop } = spot(i), from = here(), far = Math.abs(dx - from);
      const walk = far < 6 ? 0 : Math.max(220, Math.min(600, far / .24));       // 歩く長さ（1秒に240pxくらい。短すぎ・長すぎにしない）
      const touch = () => {
        box.style.setProperty('--hop', `${Math.round(hop)}px`);
        pose('touch');                                        // ぴょんと跳んで「推す」にタッチ
        step(d, TOUCH_AT, () => pushReel(i));
        step(d, TOUCH_MS, () => next(d));
      };
      if (!walk) { touch(); return; }
      pose(dx > from ? 'walk' : 'back');                      // 右へは歩く。左へは、前を向いたまま跳ねて戻る（絵は右向きしか無いため）
      move(dx, walk);
      step(d, walk, touch);
    };
    return {
      rare: () => !!on && on === CHARA_RARE,
      who: () => on,                       // いま出ているキャラクター（カットインの絵に使う）
      cancel() { clearTimeout(timer); },   // 次に回すときは、前の回の予約を取り消す
      reset() {                            // 最初の状態に戻す（キャラクターを下げる）
        clearTimeout(timer); seq++; duty = null;
        on = '';
        if (box) { box.hidden = true; box.dataset.pose = ''; move(0, 0); }
      },
      // 動きを減らす設定のとき：歩かせずに、定位置に立たせるだけ
      stand() {
        if (!box || !stage) return;
        const who = charaPick(on);
        if (who) { show(who); move(0, 0); pose('watch'); }
      },
      // 「回す」が押されたとき：持ち場（定位置）に着いて、「推す」が押されるのを待つ。キャラクターを出せないときは false を返す
      // at＝押したときの番号。途中でしぼり込みが変わって番号が進んだら、続きの動きはしない
      start(at) {
        duty = null;
        if (!box || !stage) return false;
        const who = charaPick(on);
        if (!who) return false;
        const d = duty = { at, my: ++seq, queue: [], ready: false, busy: false };
        const arrive = () => { d.ready = true; next(d); };
        const enter = () => {
          show(who); pose(''); move(0, 0);
          // 筐体の左のふちの外から、定位置まで歩いてくる（歩く距離は画面の幅で変わるので、その場で測る）
          const from = box.getBoundingClientRect().right - stage.getBoundingClientRect().left;
          if (from <= 0) { arrive(); return; }   // 別の画面へ移っていて測れないときは、歩かせずに立たせる
          move(-Math.ceil(from), 0); void box.offsetWidth;
          const walk = Math.max(300, Math.min(700, from / .24));
          pose('walk'); move(0, walk);
          if (who === CHARA_RARE) gameSfx('slot', 'rare');
          step(d, walk, arrive);
        };
        if (on === who) arrive();                                   // 同じキャラクターがもういる：そのまま待つ
        else if (on) { pose('out'); step(d, OUT_MS, enter); }       // 交代：いまのキャラクターが下がってから、次が歩いてくる
        else enter();
        return true;
      },
      // 「推す」が押された列を、止めに行く列に加える。引き受けられないとき（キャラクターがいない）は false を返す
      take(i) {
        const d = duty;
        if (!d || d.at !== epoch || d.my !== seq) return false;
        d.queue.push(i);
        if (d.ready && !d.busy) next(d);
        return true;
      },
      // 全部止まったあと：跳ねながら定位置へ戻って、両手で献立を案内する。その姿を少し見せてから after を呼ぶ
      finale(at, after) {
        const my = ++seq; duty = null;
        if (!on) { after(); return; }
        if (reduceMotion) { pose('present'); after(); return; }
        const back = Math.max(320, Math.min(620, Math.abs(here()) / .3));
        // やったー、と跳ねながら戻る（横の回転はしない）。喜ぶ姿は手を横に広げるので、定位置より左（左はしの列のそば）から戻るときは、
        // 手が筐体のふちで切れないように、前を向いたまま跳ねる姿にする
        const left = here() < -1;
        pose('watch'); move(0, back);
        setTimeout(() => { if (at === epoch && my === seq) pose(left ? 'back' : 'hop'); }, 90);
        setTimeout(() => { if (at === epoch && my === seq) pose('present'); }, back);
        timer = setTimeout(() => { if (at === epoch) after(); }, back + PRESENT_MS);
      },
    };
  })();

  // 「推す」が押された：キャラクターがいれば、その列を止めに行ってもらう。いなければ、その場で止める
  function askStop(i) {
    if (reelState[i] !== 1) return;
    gameSfx('slot', 'push');
    reelState[i] = 3;  // 先に「押された」印を付ける（キャラクターは、この印のある列だけ止めに行く）
    if (slotChara.take(i)) holdLabels(); else pushReel(i);
  }

  function runSlot() {
    const btn = $('#slot-go');
    btn.disabled = true;
    $('.machine').classList.remove('is-win');
    $('#slot-result').replaceChildren();
    slotChara.cancel();  // 前の回の「結果のカードへ画面を送る」が残っていたら取り消す
    const at = epoch, run = ++slotRun;
    const mine = () => at === epoch && run === slotRun;  // この回のまま（しぼり込みも変わらず、回し直してもいない）か
    // 回す列（「固定」にした列と、候補が無い列は回さない）
    const targets = [];
    REELS.forEach((kubun, i) => {
      if (held[i] && slot[i]) return;
      const pool = base(d => d.kubun === kubun);
      if (pool.length) targets.push([i, pool]);
    });
    playScene('slot'); gameSfx('slot', 'tap');
    if (!targets.length) { finishSlot(); return; }
    if (reduceMotion) slotChara.stand();
    let left = targets.length;
    targets.forEach(([i, pool]) => {
      slot[i] = pickFrom(pool);
      spinReel(i, pool, slot[i], () => {
        holdLabels();
        // あと1列になったら、最後の列を光らせて、音で高める（2列以上回していたときだけ）
        if (--left === 1 && targets.length > 1 && !reduceMotion && mine()) { $('.machine').classList.add('is-reach'); gameSfx('slot', 'reach'); }
        if (left === 0) finishSlot();
      });
    });
    if (!reduceMotion) { gameSfx('slot', 'spin'); gameHot('slot', true); }
    holdLabels();
    const order = targets.map(t => t[0]).filter(i => reelState[i] === 1);
    if (!order.length) return;  // 動きを減らす設定のときは、もう全部止まっている
    // 列は、使う人が「推す」を押すまで回り続ける。キャラクターは持ち場に着いて、押された列を止めに行く
    slotChara.start(at);
    // 「推す」が押されないままのときは、残りの列を左から順に止める（回りっぱなしにしない）
    clearTimeout(slotIdle);
    slotIdle = setTimeout(() => { if (mine()) order.forEach(askStop); }, IDLE_MS);
    setTimeout(() => { if (mine()) order.forEach(i => { if (reelState[i] === 1 || reelState[i] === 3) pushReel(i); }); }, IDLE_MS + 9000);  // 念のため：それでも止まらない列が残ったら、ここで止める
  }
  function finishSlot() {
    const btn = $('#slot-go');
    btn.disabled = false;
    btn.textContent = 'もう一回';
    clearTimeout(slotIdle);
    $('.machine').classList.remove('is-reach');
    gameHot('slot', false);
    const set = slot.filter(Boolean);
    if (!set.length) return;
    $('.machine').classList.add('is-win');
    $('#slot-result').replaceChildren(h('div', { class: 'panel panel-win' }, menuCard(set)));
    // キャラクターがいるときは、定位置へ戻って献立を案内する姿を見せてから、結果のカードへ画面を送る
    slotChara.finale(epoch, () => bringIntoView($('#slot-result')));
    // 決まった瞬間：筐体のまわりを光が回り、帯（カットイン）が横切る。音はファンファーレ（画面効果が使えないときは、紙吹雪）
    if (!$('#game-slot').getClientRects().length) return;   // 別の画面へ移っているときは、何も出さない
    gameHush('slot', .4); gameSfx('slot', 'win-slot');
    if (window.FX && !reduceMotion) { FX.play('jackpot', $('.machine'), { who: slotChara.who(), palette: slotChara.rare() ? SAKURA_FX : undefined }); shake($('.machine')); }
    else confetti(slotChara.rare() ? SAKURA : undefined);
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
      h('span', { class: 'duel-meta', text: mode === 'out' ? d.shop : `${d.kubun}・${d.genre}` }));
  }
  function renderDuel(keep) {
    $('#duel-progress').textContent = `第${duel.round}問／全${DUEL_ROUNDS}問　どっちが食べたい？`;
    renderDots(duel.round - 1);
    const a = duelButton(duel.left, 'left'), b = duelButton(duel.right, 'right');
    let locked = false;
    const cur = duel;
    const choose = (win, won, lost) => {
      if (locked) return;
      locked = true;
      won.classList.add('is-win');
      lost.classList.add('is-lose');
      const next = () => {
        if (duel !== cur) return;  // 勝ち負けの動きの途中でしぼり込みが変わった
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
    SND.cut(); playScene('fortune'); gameSfx('fortune', 'tap');
    const box = $('#fortune-result');
    const reveal = () => {
      const rng = seeded(`fortune|${TODAY}|${sign}`);
      const color = L.color[Math.floor(rng() * L.color.length)];
      // その色の料理を、主役の定番→定番→全部の順で探す（少なすぎる色でも必ず1品出す）
      const ok = d => d.color === color && inSeason(d);
      let pool = D.filter(d => ok(d) && d.teiban && MAIN_KUBUN.includes(d.kubun));
      if (pool.length < 3) pool = D.filter(d => ok(d) && d.teiban);
      if (pool.length < 3) pool = D.filter(ok);
      // その色の料理が1品も無いときは、色にこだわらず、主役の料理から選ぶ
      const noColor = pool.length === 0;
      if (noColor) pool = D.filter(d => inSeason(d) && MAIN_KUBUN.includes(d.kubun));
      if (!pool.length) pool = D;
      const shot = pool.filter(imgOf);
      if (shot.length >= 3) pool = shot;
      const dish = pool[Math.floor(rng() * pool.length)];
      box.replaceChildren(h('div', { class: 'panel panel-sky flip-in' },
        h('div', { class: 'sky' },
          signIcon(i, mark, 'sky'),
          h('p', { class: 'sky-title', text: `${TODAY_LABEL}の${sign}` }),
          h('p', { class: 'lucky' }, h('span', { class: 'dot dot-l', 'data-color': color }), `ラッキーカラーは「${color}」`)),
        h('p', { class: 'note', text: !dish ? '今の条件では、提案できる料理がありません。'
          : noColor ? `今の条件では${color}の料理が見つからないので、かわりに今日の一品をどうぞ。`
          : `食卓に${color}の一品をどうぞ。今日のラッキー晩御飯はこちら。` }),
        dish ? dishCard(dish) : null,
        h('p', { class: 'note' }, '占いは楽しみとしてお使いください。',
          h('a', { href: URANAI_URL, target: '_blank', rel: 'noopener', text: '「☆ねこ占ぽ」で星座占いを見る' }))));
      bringIntoView(box);
      // 結果が出た瞬間：星がまたたき、星座がつながる光と、ガラスの鐘の音
      if (!box.getClientRects().length) return;
      gameHush('fortune', .5); gameSfx('fortune', 'win-fortune');
      FX.play('mystic', box, {});   // 結果の入れ物（#fortune-result）を基準にする（中のカードは、出てくる動きの途中で形が変わるため）
    };
    if (reduceMotion) { reveal(); return; }
    // 結果の前に、水晶玉が光る「占い中」をはさむ
    box.replaceChildren(h('div', { class: 'panel panel-sky' },
      h('div', { class: 'sky gazing' }, h('span', { class: 'orb' }), h('p', { class: 'sky-title', text: `${sign}の今日を占っています…` }))));
    bringIntoView(box);
    gameSfx('fortune', 'charge', { d: 1.35 });   // 水晶玉が光っていく音
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

  // ---------- 地図で探す ----------
  // Google マップをページの中に出し、「探す言葉＋場所の言葉」を渡して、その近くの店に絞る。
  // 場所は町名・駅名の言葉で渡す（緯度経度で渡すと、地図は動いても店の印が Google の推定した場所の近くに出てしまうため）
  // 買うときに選べるお店の種類（bit＝料理データの「買える場所」の数、q＝地図に渡す言葉）
  const MAP_BUY = [
    { id: 'cvs', bit: 1, label: 'コンビニ', q: 'コンビニ' },
    { id: 'sup', bit: 2, label: 'スーパー', q: 'スーパーマーケット' },
    { id: 'depa', bit: 0, label: 'デパ地下', q: 'デパ地下' },
    { id: 'take', bit: 4, label: 'お弁当・持ち帰りの店', q: 'お弁当 持ち帰り' },
  ];
  // お店の種類 → [ボタンの言葉, 地図に渡す言葉]
  const MAP_SHOP = {
    '定食・和食': ['定食・和食の店', '定食 和食'], '寿司': ['寿司の店', '寿司'], 'うどん・そば': ['うどん・そばの店', 'うどん そば'], 'ラーメン': ['ラーメンの店', 'ラーメン'],
    '中華': ['中華料理の店', '中華料理'], '焼肉': ['焼肉の店', '焼肉'], '韓国料理': ['韓国料理の店', '韓国料理'], '洋食・ファミレス': ['洋食の店・ファミレス', '洋食 ファミレス'],
    'イタリアン': ['イタリアンの店', 'イタリアン'], 'カレー': ['カレーの店', 'カレー'], 'とんかつ・揚げ物': ['とんかつ・揚げ物の店', 'とんかつ'], '鍋': ['鍋料理の店', '鍋料理'],
    '居酒屋': ['居酒屋', '居酒屋'], 'お好み焼き・粉もの': ['お好み焼きの店', 'お好み焼き'], 'エスニック': ['エスニック料理の店', 'エスニック料理'], '郷土料理の店': ['郷土料理の店', '郷土料理'],
  };
  const MAP_MAX = 40;            // キーワード・場所の言葉の長さの上限（地図のURLが長くなりすぎないように）
  const FRESH_MS = 30 * 60000;   // 現在地を確かめてからこの時間は「現在地」として表示する。過ぎたら「前回の現在地」
  const LOC_RETRY_MS = 15000;    // 現在地の確認が返ってこないとき、この時間が過ぎたら押し直せるようにする
  const LOAD_MS = 15000;         // 地図の読み込みをこの時間待っても出ないときは、案内を出す
  let mapArea = String(store.get('bangohan_area', '') || '').slice(0, MAP_MAX);  // 場所の言葉（駅名・地名・現在地の町名）。次に開いたときのために、この端末にだけ残す
  let areaGeo = !!mapArea && store.get('bangohan_geo', 0) === 1;  // 場所の言葉が、現在地から調べた町名か（保存は次に開いたときのため）
  let mapItems = [], mapSel = '', mapWord = '';
  let locGen = 0, locStart = 0, locNext = 0;       // 現在地：何回目の確認か／確認を始めた時刻（0＝していない）／町名の検索を次にしてよい時刻
  let lastSpot = '', lastName = '', freshAt = 0;   // 最後に町名を調べた位置・その町名・現在地を確かめた時刻
  let mapOpener = null, mapClosing = false, mapTimer = 0, closeTimer = 0, mapInert = [], noteKind = '';

  const isFresh = () => freshAt > 0 && Date.now() - freshAt < FRESH_MS;
  // 現在地や読み込みについてのお知らせ（地図の説明の文とは別の行に出す）
  function note(msg, kind) {
    const n = $('#map-note');
    n.textContent = msg || '';
    noteKind = msg ? (kind || 'geo') : '';
  }
  // 地図が画面の外にあるときは、見える位置まで送る
  function showMap() {
    const body = $('.map-body'), fr = $('#map-frame');
    const bottom = fr.offsetTop + fr.offsetHeight - body.clientHeight;
    if (body.scrollTop < bottom) body.scrollTop = bottom;
  }

  // way＝カードの「今夜はどうする？」で押した手段（'buy'＝買って帰る／'out'＝外で食べる）
  function openMap(d, way) {
    if (!$('#mapbox').hidden) return;  // すでに開いている（キーボードで続けて押したときなど）
    const buy = way === 'buy' && d.buy, out = way === 'out' && d.out;
    mapItems = [];
    if (out) {
      mapItems.push({ id: 'dish', label: `「${d.name}」の店`, q: d.name });
      // 料理名と同じ言葉になる種類（ラーメンなど）は重ねて出さない
      if (MAP_SHOP[d.shop] && MAP_SHOP[d.shop][1] !== d.name) mapItems.push({ id: 'shop', label: MAP_SHOP[d.shop][0], q: MAP_SHOP[d.shop][1] });
    }
    // 持ち帰りの店で買える料理は、その料理を持ち帰れる店を探す。それ以外は、お弁当や持ち帰りの店を広く探す
    if (buy) mapItems.push(...MAP_BUY.map(m => m.id === 'take' && (d.places & 4) ? Object.assign({}, m, { q: d.name + ' 持ち帰り' }) : m));
    if (!mapItems.length) return;  // その手段では探せない料理（押せないボタンなので、通常は来ない）
    // 最初に選んでおく種類：食べに行ける料理は料理名、買う料理はスーパー（買える料理は、どれもスーパーで買える扱い）
    mapSel = out ? 'dish' : 'sup';
    mapWord = '';
    $('#map-title').textContent = `「${d.name}」を${out ? '食べに行く店' : '買える店'}を探す`;
    const marks = [1, 2, 4].filter(p => d.places & p).map(p => PLACES[p]);
    $('#map-hint').hidden = !(buy && marks.length);
    $('#map-hint').textContent = '買える場所の目安：' + marks.join('・');
    $('#map-chips').replaceChildren(
      ...mapItems.map(m => h('button', { class: 'pick', type: 'button', 'data-id': m.id, 'aria-pressed': 'false', text: m.label,
        onclick: () => { mapSel = m.id; mapWord = ''; $('#map-q').value = ''; $('#map-word').hidden = true; drawMap(); showMap(); } })),
      // 「キーワード」を押すと、言葉を入れる欄が出る
      h('button', { class: 'pick', type: 'button', id: 'map-word-chip', 'aria-pressed': 'false', 'aria-expanded': 'false', 'aria-controls': 'map-word', text: 'キーワード',
        onclick: () => { $('#map-word').hidden = false; drawMap(); $('#map-q').focus(); } }));
    $('#map-word').hidden = true;
    $('#map-q').value = '';
    $('#map-q').placeholder = `例：${d.name}`;
    $('#map-place').value = mapArea;
    $('#map-about').hidden = true;
    $('#map-about-btn').setAttribute('aria-expanded', 'false');
    note('');
    mapClosing = false;
    mapOpener = document.activeElement;
    $('#mapbox').hidden = false;
    // 開いている間は、裏の画面を操作できないようにする（閉じるときに戻す）
    mapInert = [...document.body.children].filter(el => el.id !== 'mapbox' && el.id !== 'toast' && el.tagName !== 'SCRIPT' && !el.inert);
    mapInert.forEach(el => { el.inert = true; });
    history.pushState({ map: true }, '');  // スマホの「戻る」で、地図だけを閉じられるようにする
    drawMap();
    $('.map-body').scrollTop = 0;
    const chips = $('#map-chips'), on = $('#map-chips .pick[aria-pressed="true"]');
    chips.scrollLeft = on ? on.offsetLeft - chips.offsetLeft - 14 : 0;
    $('#map-title').focus();
  }
  function drawMap() {
    const it = mapItems.find(m => m.id === mapSel) || mapItems[0];
    const q = mapWord || it.q;
    const full = mapArea ? q + ' ' + mapArea : q;
    const fromGeo = !!mapArea && areaGeo;                             // 場所の言葉が、現在地から調べた町名か
    const here = fromGeo && isFresh();                                  // そのうち、いま確かめたばかりのものか
    $$('#map-chips .pick[data-id]').forEach(b => b.setAttribute('aria-pressed', String(!mapWord && b.dataset.id === it.id)));
    $('#map-word-chip').setAttribute('aria-pressed', String(!!mapWord));
    $('#map-word-chip').setAttribute('aria-expanded', String(!$('#map-word').hidden));
    $('#map-here').setAttribute('aria-pressed', String(here));
    $('#map-status').textContent = mapArea ? `${here ? '現在地の町名' : fromGeo ? '前回の現在地の町名' : ''}「${mapArea}」の近くの「${q}」を表示しています。`
      : `「${q}」を表示しています。場所は Google マップが選んだものです。「現在地」を押すか、駅名・地名を入れると、その近くに絞れます。`;
    $('#map-osm').hidden = !fromGeo;  // 町名を調べた出典は、その町名を出しているときに並べて出す
    const src = 'https://www.google.com/maps?output=embed&hl=ja&q=' + encodeURIComponent(full);
    $('#map-open').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(full);
    const box = $('#map-frame');
    if (box.dataset.src === src) return;
    box.dataset.src = src;
    box.classList.add('is-loading');
    if (noteKind === 'load') note('');
    clearTimeout(mapTimer);
    // 読み込みが終わらないときは、別の開き方を案内する（読み込みの失敗そのものは、この画面からは分からない）
    mapTimer = setTimeout(() => {
      if (!box.classList.contains('is-loading') || noteKind) return;  // ほかのお知らせが出ているときは、読み込み中の表示のままにする
      box.classList.remove('is-loading');
      note('地図の読み込みに時間がかかっています。出ないときは、地図の下の「Google マップで開く」をお使いください。', 'load');
    }, LOAD_MS);
    // 枠ごと作り直す（中身だけ差し替えると、ブラウザの「戻る」の履歴に地図の切り替えが積まれてしまう）
    box.replaceChildren(h('iframe', { src, title: `${q}の地図`, referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: '',
      onload: () => { box.classList.remove('is-loading'); if (noteKind === 'load') note(''); } }));
  }
  // 位置から調べた住所を、地図に渡す町名の言葉にまとめる（都道府県＋郡＋市町村＋区＋町名）
  function areaName(a) {
    if (!a || typeof a !== 'object') return '';
    const pref = a.province || a.state || (a['ISO3166-2-lvl4'] === 'JP-13' ? '東京都' : '');
    // 町名は、丁目つきの名前（新宿三丁目など）を優先。大字と小字が別の名前のときは、広く知られている大字を使う
    const local = a.quarter && !String(a.neighbourhood || '').startsWith(a.quarter) ? a.quarter : (a.neighbourhood || a.quarter || '');
    return [pref, a.county, a.city || a.town || a.village || a.municipality, a.city_district || a.suburb, local]
      .filter(x => typeof x === 'string' && x).join('').slice(0, MAP_MAX);
  }
  // 現在地を使う。「現在地」を押したときにだけ動く（ブラウザが許可を確認する）
  function locate() {
    if (locStart && Date.now() - locStart < LOC_RETRY_MS) { note('現在地を確認しています…（位置情報の許可を聞かれていたら、答えてください）'); return; }
    if (!navigator.geolocation) { note('この端末では現在地を使えません。駅名・地名を入れると、その近くで探せます。'); return; }
    const gen = ++locGen;  // 途中で場所を入れた・地図を閉じた・押し直したときは番号が進むので、古い結果は捨てる
    locStart = Date.now();
    note('現在地を確認しています…');
    const end = msg => { locStart = 0; note(msg); };
    navigator.geolocation.getCurrentPosition(p => {
      if (gen !== locGen) return;
      // 位置は小数3けた（約100メートル単位）に丸めてから、町名を調べる
      const spot = p.coords.latitude.toFixed(3) + ',' + p.coords.longitude.toFixed(3);
      const done = name => {
        if (gen !== locGen) return;
        if (!name) { end('現在地の町名を調べられませんでした。駅名・地名を入れると、その近くで探せます。'); return; }
        lastSpot = spot; lastName = name; freshAt = Date.now();
        mapArea = name;
        areaGeo = true;
        store.set('bangohan_area', name); store.set('bangohan_geo', 1);
        $('#map-place').value = name;
        end('');
        drawMap();
        // 文字を打っている最中（キーワードの欄など）は、画面を送らない
        if (!/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '')) showMap();
      };
      if (spot === lastSpot && lastName) { done(lastName); return; }  // 同じ場所なら、町名を調べ直さない
      // 町名の検索は続けて呼ばない（提供元の決まり：毎秒1回まで。断られたあとは長めに待つ）
      if (Date.now() < locNext) { end('少し待ってから、もう一度「現在地」を押してください。'); return; }
      locNext = Date.now() + 3000;
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 10000);
      const [lat, lon] = spot.split(',');
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=ja&lat=${lat}&lon=${lon}`, ctl ? { signal: ctl.signal } : undefined)
        .then(r => {
          if (r.status === 429) locNext = Date.now() + 60000;
          return r.ok ? r.json() : Promise.reject(new Error(String(r.status)));
        })
        .then(j => done(areaName(j && j.address)))
        .catch(() => done(''))
        .then(() => clearTimeout(timer));
    }, err => {
      if (gen !== locGen) return;
      end(err && err.code === 1 ? '現在地の利用が許可されていません。駅名・地名を入れると、その近くで探せます。' : '現在地を確認できませんでした。駅名・地名を入れると、その近くで探せます。');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  function hideMap() {
    if ($('#mapbox').hidden) return;
    $('#mapbox').hidden = true;
    mapClosing = false;
    clearTimeout(mapTimer);
    clearTimeout(closeTimer);
    locGen++; locStart = 0;  // 確認の途中だった現在地の結果は使わない
    const box = $('#map-frame');
    box.replaceChildren();
    box.classList.remove('is-loading');
    delete box.dataset.src;
    mapInert.forEach(el => { el.inert = false; });
    mapInert = [];
    if (mapOpener && document.contains(mapOpener)) mapOpener.focus();  // 開いたときのボタンに戻す
    mapOpener = null;
  }
  function closeMap() {
    if (mapClosing) return;  // 閉じている途中にもう一度押されても、履歴を二重に戻さない
    if (history.state && history.state.map) {
      // 履歴に積んだ分を戻す（戻ると hideMap が呼ばれる）。戻りの合図が届かないときに備えて、少し待っても開いていたら直接閉じる
      mapClosing = true;
      history.back();
      closeTimer = setTimeout(hideMap, 700);
    } else hideMap();
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- 候補のしぼり込みを切り替える ----------
  function setMode(m) {
    mode = MODES.includes(m) ? m : 'any';
    refresh();
  }
  // しぼり込みが変わったら、さがす・おまかせをその条件に合わせ直す（今日の一品と占いは、しぼり込みに関係しない）
  function refresh() {
    document.body.dataset.mode = mode;
    $$('.modebar button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    // そのしぼり込みで使わない条件は外す（画面から隠れた条件が効いたままにならないように）。外したときは一言知らせる
    const dropped = (mode !== 'any' && F.mats.size > 0) || (mode !== 'out' && F.shop.size > 0);
    if (mode === 'buy' || mode === 'out') { F.mats.clear(); $$('#f-mats .pick').forEach(b => b.setAttribute('aria-pressed', 'false')); }
    if (mode !== 'out') { F.shop.clear(); $$('#f-shop .pick').forEach(b => b.setAttribute('aria-pressed', 'false')); }
    if (dropped) toast('しぼり込みに合わない条件（材料・お店の種類）は外しました');
    shown = PAGE;
    renderResults();
    // おまかせの結果は前の条件のものなので、最初の状態に戻す。回っている途中のものは止める
    epoch++;
    wheelBusy = false;
    resetRoulette();
    slot.fill(null); held.fill(false); reelState.fill(0); reelStop.fill(null); clearTimeout(slotIdle);
    $('.machine').classList.remove('is-reach');
    $$('.hold').forEach(b => b.setAttribute('aria-pressed', 'false'));
    $$('[data-reel] .strip').forEach(s => { s.style.transition = 'none'; s.style.transform = 'none'; s.replaceChildren(cell(null)); });
    $$('.reelwin').forEach(w => w.classList.remove('is-done', 'is-spinning'));
    $('#slot-result').replaceChildren(); $('.machine').classList.remove('is-win'); $('#slot-go').textContent = '回す';
    slotChara.reset();
    markReels();
    duel = null;
    $('#duel-area').replaceChildren(); $('#duel-result').replaceChildren();
    $('#duel-go').hidden = false; $('#duel-go').textContent = 'はじめる'; $('#duel-note').hidden = false;
    $('#duel-progress').textContent = 'どっちが食べたい？'; renderDots(0);
    if (mode === 'out' && here === 'play/slot') go('play/roulette');  // 外食の料理にしぼったときは献立スロットを出さない
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

  document.body.dataset.mode = mode;
  $$('.modebar button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  renderHome();
  renderRecent();
  buildFilters();
  renderResults();
  renderSigns();
  renderDots(0);
  renderCredits();
  buildBulbs();
  resetRoulette();
  markReels();

  $$('.tabbar button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => {
    // 献立スロットは外食の料理だけでは回せないので、「今日」の画面から来たときは、しぼり込みを「すべて」に戻す
    if (b.dataset.game === 'slot' && mode === 'out') { setMode('any'); toast('献立スロットは、すべての料理から回します'); }
    go(b.dataset.go + (b.dataset.game ? '/' + b.dataset.game : ''));
  }));
  $$('.seg button').forEach(b => b.addEventListener('click', () => go('play/' + b.dataset.game)));
  $('#back').addEventListener('click', goBack);
  window.addEventListener('hashchange', route);
  // 地図を開いたまま読み込み直したときは、履歴に残った地図の分を1つ戻す（「戻る」が1回空振りしないように）
  if (history.state && history.state.map) history.back();
  here = location.hash.slice(1) || 'top';  // 途中の画面を開き直したときは、その画面から始める。行き先が無ければトップ画面
  render(here);

  $$('.modebar button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  // トップ画面：ボタンを押したら「今日」の画面へ（作る・買う・外で食べるは、料理カードの中の「今夜はどうする？」で選ぶ）
  $('#top-go').addEventListener('click', () => go('home'));
  // 背景の絵は、開いて少ししてから先に読み込んでおく（切り替えたときに、絵が遅れて出ないように）
  setTimeout(() => BGS.forEach(n => { new Image().src = 'art/page_' + n + '.webp'; }), 1500);
  // ルーレットを回すキャラクターの絵も、同じく先に読み込んでおく
  setTimeout(() => { charaLoad(CHARA_MAIN); charaLoad(CHARA_RARE); }, 1500);
  $('.home-link').addEventListener('click', e => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;  // 新しいタブで開く操作などは、ブラウザに任せる
    e.preventDefault();
    go('top');
  });
  $('#q').addEventListener('input', e => {
    query = kana(e.target.value).split(/\s+/).filter(Boolean).map(variants);
    shown = PAGE;
    renderResults();
    resetRoulette();
  });
  $('#teiban-only').addEventListener('change', resetRoulette);
  $('#filter-clear').addEventListener('click', clearFilters);
  $('#filter-roulette').addEventListener('click', () => { go('play/roulette'); runRoulette(); });
  $('#result-more').addEventListener('click', () => { shown += PAGE; renderResults(); });
  $('#jump-results').addEventListener('click', () => $('#result-head').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }));
  $('#roulette-go').addEventListener('click', runRoulette);
  // 「音」のスイッチ：音あり・音なしを切り替えて、端末に覚えておく。入れたときは、短い音で「鳴ること」を知らせる
  soundLabel();
  $$('.sound').forEach(b => b.addEventListener('click', () => {
    SND.set(!SND.on);
    soundLabel();
    if (SND.on) { SND.sfx('push'); sceneCheck(); } else sceneNow = '';   // 回している途中で入れたときは、BGMも流しはじめる
    toast(SND.on ? '音を出します（回したときに鳴ります）' : '音を止めました');
  }));
  // カットインに使うキャラクターの絵を、先に読み込んでおく
  setTimeout(() => { FX.warm(CHARA_MAIN); FX.warm(CHARA_RARE); }, 1500);
  $('#slot-go').addEventListener('click', runSlot);
  $$('.hold').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.hold);
    if (reelState[i]) { askStop(i); return; }  // 回っている間は「推す」：押すと、キャラクターがその列を止めに行く
    if (!slot[i]) return;
    held[i] = !held[i];
    gameSfx('slot', 'hold');
    b.setAttribute('aria-pressed', String(held[i]));
  }));
  $('#duel-go').addEventListener('click', startDuel);
  $('#recent-clear').addEventListener('click', () => { recent = []; store.set('bangohan_recent', recent); renderRecent(); renderTodayPick(); });
  // 今日の一品の「これに決定」：決めたら、同じ場所に「今夜はどうする？」を出して、最初の札へ移る
  $('#today-decide').addEventListener('click', () => {
    if (!todayDish) return;
    decide([todayDish.name]);
    const first = $('#today-done .way:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  });
  $$('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  $$('[data-map-close]').forEach(b => b.addEventListener('click', closeMap));
  window.addEventListener('popstate', () => {
    if (!$('#mapbox').hidden) hideMap();
    else if (history.state && history.state.map) history.back();  // 閉じたあとに「進む」で地図の履歴へ入ったときは、そのまま戻す
  });
  $('#map-here').addEventListener('click', locate);
  $('#map-word').addEventListener('submit', e => {
    e.preventDefault();
    mapWord = $('#map-q').value.trim().slice(0, MAP_MAX);
    drawMap();
    e.currentTarget.querySelector('[type="submit"]').focus();  // 画面のキーボードを下げる（フォーカスは枠の中に残す）
    showMap();
  });
  $('#map-area').addEventListener('submit', e => {
    e.preventDefault();
    locGen++; locStart = 0; freshAt = 0;  // 自分で場所を入れたら、確認の途中だった現在地の結果は使わない
    note('');
    mapArea = $('#map-place').value.trim().slice(0, MAP_MAX);
    areaGeo = false;
    store.set('bangohan_area', mapArea); store.set('bangohan_geo', 0);
    drawMap();
    e.currentTarget.querySelector('[type="submit"]').focus();
    showMap();
  });
  // 現在地の確認中に場所を打ち始めたら、確認の結果は使わない（打っている文字を上書きしない）
  $('#map-place').addEventListener('input', () => { if (locStart) { locGen++; locStart = 0; note(''); } });
  $('#map-about-btn').addEventListener('click', e => {
    const box = $('#map-about');
    box.hidden = !box.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!box.hidden));
    if (!box.hidden) box.scrollIntoView({ block: 'nearest' });
  });
  // Esc は、地図が開いていれば地図だけを閉じる
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('#mapbox').hidden) closeMap(); else closeModal(); });
})();
