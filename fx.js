// 決まった瞬間の画面効果。絵の素材は使わず、その場で描く（canvas。光は加算で重ねる）。
// 使い方（app.js から）：FX.play('magic' | 'jackpot' | 'mystic', 効果を出す要素, { palette: 色の並び, who: カットインに出すキャラクター })
//   magic＝ルーレット：魔法陣・光の輪・放射の光・光の粒／jackpot＝献立スロット：虹色の枠・光の筋・カットイン・星／mystic＝占い：星のまたたき・星座の線・流れ星
// 動きを減らす設定のときは、何も出さない
(function () {
  'use strict';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv = null, g = null, W = 0, H = 0, layers = [], raf = 0, last = 0;

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    layers = layers.filter(fn => { g.save(); g.globalCompositeOperation = 'lighter'; const keep = fn(now, dt); g.restore(); return keep; });
    if (layers.length) raf = requestAnimationFrame(frame);
    else { raf = 0; cv.remove(); cv = null; window.removeEventListener('resize', fit); }
  }
  function add(fn) {
    if (!cv) {
      cv = document.createElement('canvas'); cv.className = 'fx-layer'; cv.setAttribute('aria-hidden', 'true');
      g = cv.getContext('2d'); document.body.append(cv); fit();
      window.addEventListener('resize', fit);
    }
    layers.push(fn);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  // ---------- 描く部品 ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const out3 = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);     // はじめ速く、あとゆっくり
  const bump = (t, a, b, c) => t < a ? 0 : t < b ? (t - a) / (b - a) : t < c ? 1 - (t - b) / (c - b) : 0;   // a で出はじめ、b でいちばん強く、c で消える
  const sprites = {};
  // 光の玉（まん中が白く、まわりが色のついた光）。何度も描くので、先に小さな絵にしておく
  function glow(col) {
    if (!sprites[col]) {
      const s = document.createElement('canvas'); s.width = s.height = 64;
      const x = s.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, '#fff'); gr.addColorStop(.22, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      sprites[col] = s;
    }
    return sprites[col];
  }
  function dot(x, y, r, col, a) { if (a <= 0 || r <= 0) return; g.globalAlpha = a; g.drawImage(glow(col), x - r, y - r, r * 2, r * 2); }
  // 光の輪（太くぼんやり＋細くはっきり、の2本で光って見せる）
  function ring(x, y, r, col, a, w) {
    if (a <= 0 || r <= 0) return;
    g.strokeStyle = col;
    g.globalAlpha = a * .35; g.lineWidth = w * 4; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.globalAlpha = a; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }
  // 画面全体が一瞬明るくなる
  function flash(x, y, a, col) {
    if (a <= 0) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(W, H));
    gr.addColorStop(0, col || '#fff'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  // まん中から放射する光の筋
  function rays(x, y, len, n, rot, col, a) {
    if (a <= 0) return;
    for (let i = 0; i < n; i++) {
      const ang = rot + i * TAU / n, wide = (i % 2 ? .05 : .09);
      const gr = g.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a * (i % 2 ? .5 : .8); g.fillStyle = gr;
      g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang - wide) * len, y + Math.sin(ang - wide) * len);
      g.lineTo(x + Math.cos(ang + wide) * len, y + Math.sin(ang + wide) * len);
      g.closePath(); g.fill();
    }
  }
  // 4つの光のとげ（キラッ）
  function spark(x, y, r, col, a, rot) {
    if (a <= 0) return;
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.globalAlpha = a; g.fillStyle = col;
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * .12, r * .12, r, 0); g.quadraticCurveTo(r * .12, -r * .12, 0, 0); g.fill(); }
    g.restore();
    dot(x, y, r * .5, col, a);
  }
  // 光の粒のあつまり。make(i) が1粒ずつ作る（x, y, vx, vy, life 寿命, size, col, drag 減速, grav 落ちる力, spin）
  function particles(n, make) {
    const ps = Array.from({ length: n }, (_, i) => Object.assign({ age: 0, px: null, py: null }, make(i)));
    return dt => {
      let alive = 0;
      for (const p of ps) {
        if (p.delay > 0) { p.delay -= dt; alive++; continue; }
        p.age += dt; if (p.age >= p.life) continue;
        alive++;
        p.px = p.x; p.py = p.y;
        p.vx *= Math.pow(p.drag || 1, dt * 60); p.vy = p.vy * Math.pow(p.drag || 1, dt * 60) + (p.grav || 0) * dt;
        if (p.swirl) { const c = Math.cos(p.swirl * dt), s = Math.sin(p.swirl * dt), vx = p.vx * c - p.vy * s; p.vy = p.vx * s + p.vy * c; p.vx = vx; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        const k = 1 - p.age / p.life, a = Math.min(1, k * 2.2);
        if (p.trail) { g.globalAlpha = a * .5; g.strokeStyle = p.col; g.lineWidth = p.size * .5; g.beginPath(); g.moveTo(p.x - p.vx * p.trail, p.y - p.vy * p.trail); g.lineTo(p.x, p.y); g.stroke(); }
        if (p.star) spark(p.x, p.y, p.size * (1.2 + Math.sin(p.age * 22 + p.size) * .5), p.col, a, p.age * (p.spin || 0));
        else dot(p.x, p.y, p.size * (.6 + k * .9), p.col, a);
      }
      return alive > 0;
    };
  }
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top }; };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ---------- ルーレット：魔法が発動する ----------
  function magic(el, o) {
    const pal = o.palette || ['#ffd166', '#fff1c9', '#7fe7ff', '#b79bff'], t0 = performance.now(), R0 = rect(el).w / 2;
    const burst = particles(120, i => {
      const a = Math.random() * TAU, sp = 140 + Math.random() * 520, r = R0 * (.15 + Math.random() * .5);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .6 + Math.random() * .9, size: 3 + Math.random() * 7, col: pick(pal), drag: .94, swirl: (Math.random() - .5) * 2.4, trail: .03, delay: Math.random() * .12, star: i % 9 === 0, spin: 3 };
    });
    const rise = particles(34, () => {
      const a = Math.random() * TAU;
      return { x: Math.cos(a) * R0 * 1.02, y: Math.sin(a) * R0 * 1.02, vx: 0, vy: -40 - Math.random() * 90, life: .9 + Math.random() * .8, size: 2 + Math.random() * 4, col: pick(pal), delay: .25 + Math.random() * .7, star: Math.random() < .3, spin: 2 };
    });
    add((now, dt) => {
      const t = (now - t0) / 1000;
      if (t > 2.1) return false;
      const c = rect(el), R = c.w / 2;
      flash(c.x, c.y, bump(t, 0, .04, .26) * .85, '#fffbe6');
      rays(c.x, c.y, R * 2.6, 14, t * .6, pal[0], bump(t, .02, .2, 1.5) * .22);
      rays(c.x, c.y, R * 1.9, 9, -t * .9 + 1, pal[2], bump(t, .08, .3, 1.3) * .16);
      // 光の輪が3つ、外へ広がる
      [[0, pal[1], 5], [.09, pal[2], 3], [.2, pal[3], 2.5]].forEach(([d, col, w]) => { const k = out3((t - d) / .75); if (t >= d) ring(c.x, c.y, R * (.3 + k * 1.5), col, (1 - k) * .9, w); });
      // 魔法陣：円盤のふちに、二重の輪・目盛り・星形が、逆向きに回りながら浮かぶ
      const ma = bump(t, .05, .3, 1.7);
      if (ma > 0) {
        ring(c.x, c.y, R * 1.06, pal[0], ma * .9, 2);
        ring(c.x, c.y, R * .93, pal[2], ma * .6, 1.2);
        g.save(); g.translate(c.x, c.y);
        g.save(); g.rotate(t * .9); g.strokeStyle = pal[1]; g.globalAlpha = ma * .8; g.lineWidth = 1.5;
        for (let i = 0; i < 36; i++) { g.rotate(TAU / 36); g.beginPath(); g.moveTo(R * .95, 0); g.lineTo(R * (i % 3 ? 1.0 : 1.04), 0); g.stroke(); }
        g.restore();
        g.rotate(-t * .6); g.strokeStyle = pal[3]; g.globalAlpha = ma * .55; g.lineWidth = 1.4;
        for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = k * Math.PI / 3 + i * TAU / 3; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R * .93, Math.sin(a) * R * .93); } g.stroke(); }
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; dot(Math.cos(a) * R * .93, Math.sin(a) * R * .93, 7, pal[1], ma); }
        g.restore();
      }
      g.save(); g.translate(c.x, c.y); burst(dt); rise(dt); g.restore();
      // 当たりのマス（針の下）に、強い光
      spark(c.x, c.t + R * .2, R * .5 * bump(t, 0, .12, .9), pal[1], bump(t, 0, .12, .9), t * 2);
      return true;
    });
  }

  // ---------- 献立スロット：大当たりの演出 ----------
  const faces = {};
  function face(who) { if (who && !faces[who]) { faces[who] = new Image(); faces[who].src = `art/chara_${who}.webp`; } return who ? faces[who] : null; }
  function jackpot(el, o) {
    const pal = o.palette || ['#ffd166', '#fff1c9', '#ff7eb6', '#7fe7ff', '#9dff8a'], t0 = performance.now(), img = face(o.who);
    const c0 = rect(el);
    // 下の両はしから、星が噴き上がる
    const fount = particles(90, i => {
      const left = i % 2 === 0, a = -Math.PI / 2 + (left ? 1 : -1) * (.25 + Math.random() * .5), sp = 420 + Math.random() * 520;
      return { x: left ? -c0.w / 2 + 12 : c0.w / 2 - 12, y: c0.h / 2 - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 900, life: .9 + Math.random() * .8, size: 4 + Math.random() * 7, col: pick(pal), drag: .985, delay: .1 + Math.random() * .5, star: i % 3 !== 0, spin: 4, trail: i % 3 ? 0 : .02 };
    });
    add((now, dt) => {
      const t = (now - t0) / 1000;
      if (t > 2.3) return false;
      const c = rect(el);
      flash(c.x, c.y, bump(t, 0, .03, .22) * .8, '#fff');
      // 筐体のまわりを、虹色の光が回る
      const fa = bump(t, 0, .12, 2.1);
      if (fa > 0) {
        const pad = 3, x = c.l - pad, y = c.t - pad, w = c.w + pad * 2, h = c.h + pad * 2, rad = 18;
        let st;
        if (g.createConicGradient) { st = g.createConicGradient(t * 5, c.x, c.y); ['#ff5e5e', '#ffd166', '#9dff8a', '#7fe7ff', '#b79bff', '#ff7eb6', '#ff5e5e'].forEach((col, i, a) => st.addColorStop(i / (a.length - 1), col)); }
        else st = `hsl(${(t * 400) % 360}, 100%, 65%)`;
        g.strokeStyle = st;
        const path = () => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
        g.globalAlpha = fa * .35; g.lineWidth = 16; path(); g.stroke();
        g.globalAlpha = fa; g.lineWidth = 4; path(); g.stroke();
        // 枠の上を、光の玉が走る
        for (let i = 0; i < 6; i++) { const u = ((t * .9 + i / 6) % 1) * (2 * (w + h)), p = u < w ? [x + u, y] : u < w + h ? [x + w, y + u - w] : u < 2 * w + h ? [x + w - (u - w - h), y + h] : [x, y + h - (u - 2 * w - h)]; dot(p[0], p[1], 14, '#fff1c9', fa); }
      }
      // 横に走る光の筋
      for (let i = 0; i < 7; i++) { const k = (t * 2.2 + i * .37) % 1, yy = c.t + c.h * ((i * .618) % 1), a = bump(t, .02, .15, 1.0) * (1 - k) * .5; if (a > 0) { g.globalAlpha = a; g.fillStyle = pal[i % pal.length]; g.fillRect(c.l - 30 + k * (c.w + 60) - 60, yy, 120, 2); } }
      g.save(); g.translate(c.x, c.y); fount(dt); g.restore();
      // カットイン：ななめの帯が横から入って、キャラクターと「決定！」を見せて、抜けていく
      const k = t < .16 ? out3(t / .16) : t < 1.05 ? 1 : 1 - out3((t - 1.05) / .22);
      if (t < 1.3 && k > 0) {
        const bh = Math.min(92, c.h * .2), by = c.t + c.h * .36, sx = (1 - k) * (t < .5 ? -W : W);
        g.globalCompositeOperation = 'source-over';
        g.save(); g.translate(sx, 0); g.transform(1, -.08, 0, 1, 0, W * .04);
        const band = g.createLinearGradient(0, by, 0, by + bh);
        band.addColorStop(0, '#5a0d1d'); band.addColorStop(.5, '#c9172f'); band.addColorStop(1, '#5a0d1d');
        g.globalAlpha = .94; g.fillStyle = band; g.fillRect(-20, by, W + 40, bh);
        g.fillStyle = '#ffd166'; g.fillRect(-20, by - 3, W + 40, 3); g.fillRect(-20, by + bh, W + 40, 3);
        // 帯の中を流れる光
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) { const u = ((t * 1.8 + i * .23) % 1) * (W + 200) - 100; g.globalAlpha = .25; g.fillStyle = '#fff1c9'; g.fillRect(u, by + 6 + i * (bh - 12) / 5, 90, 2); }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        const cx = Math.min(W, c.l + c.w) - 14;
        if (img && img.complete && img.naturalWidth) { const s = bh * 2.5, fw = img.naturalWidth / 6; g.drawImage(img, fw * 5, 0, fw, img.naturalHeight, Math.max(4, c.l) + 2, by + bh - s * .98, s, s); }
        g.font = `900 ${Math.round(bh * .56)}px "Hiragino Maru Gothic ProN","BIZ UDPGothic","Yu Gothic","Meiryo",sans-serif`;
        g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = 8; g.strokeStyle = '#3a0612'; g.strokeText('献立 決定！', cx, by + bh / 2 + 1);
        const tg = g.createLinearGradient(0, by, 0, by + bh); tg.addColorStop(.2, '#fffbe6'); tg.addColorStop(.6, '#ffd166'); tg.addColorStop(1, '#ff9f1c');
        g.fillStyle = tg; g.fillText('献立 決定！', cx, by + bh / 2 + 1);
        g.restore();
      }
      return true;
    });
  }

  // ---------- 占い：星がまたたき、星座がつながる ----------
  function mystic(el, o) {
    const pal = o.palette || ['#ffe9a8', '#b9a4ff', '#7fe7ff', '#ffffff'], t0 = performance.now(), c0 = rect(el), R = Math.min(c0.w, 360) * .46;
    // 星座：まん中のまわりに点を置いて、順に線でつなぐ
    const pts = Array.from({ length: 7 }, (_, i) => { const a = -Math.PI * .9 + i * (Math.PI * 1.8 / 6) + (Math.random() - .5) * .3, r = R * (.55 + Math.random() * .4); return [Math.cos(a) * r, Math.sin(a) * r * .62]; });
    const stars = particles(70, i => {
      const a = Math.random() * TAU, sp = 60 + Math.random() * 260;
      return { x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .7, life: .8 + Math.random() * 1.1, size: 3 + Math.random() * 6, col: pick(pal), drag: .95, delay: Math.random() * .25, star: i % 2 === 0, spin: 2.5 };
    });
    const fall = particles(5, i => ({ x: -R * 1.2 + Math.random() * R * 1.6, y: -R * 1.1, vx: 520 + Math.random() * 200, vy: 300 + Math.random() * 160, life: .55, size: 5, col: '#ffffff', trail: .09, delay: .3 + i * .22 }));
    add((now, dt) => {
      const t = (now - t0) / 1000;
      if (t > 2.2) return false;
      const c = rect(el), y = c.t + Math.min(c.h * .5, 120);
      flash(c.x, y, bump(t, 0, .05, .3) * .55, '#efe6ff');
      // むらさきの光のもや
      dot(c.x, y, R * 2.2 * out3(t / .5), pal[1], bump(t, 0, .25, 1.9) * .35);
      dot(c.x - R * .5, y + R * .1, R * 1.4, pal[2], bump(t, .1, .5, 1.8) * .18);
      [[0, pal[0], 3], [.14, pal[1], 2]].forEach(([d, col, w]) => { const k = out3((t - d) / .9); if (t >= d) ring(c.x, y, R * (.2 + k * 1.3), col, (1 - k) * .8, w); });
      // 12の点（星座の輪）が、ゆっくり回る
      const za = bump(t, .1, .4, 1.9);
      for (let i = 0; i < 12; i++) { const a = t * .5 + i * TAU / 12; spark(c.x + Math.cos(a) * R * 1.05, y + Math.sin(a) * R * .62, 7 + (i % 3 === 0 ? 5 : 0), pal[i % 2 ? 0 : 3], za * .9, a); }
      // 星座の線を、順に引く
      g.save(); g.translate(c.x, y); g.strokeStyle = pal[3]; g.lineWidth = 1.4;
      for (let i = 1; i < pts.length; i++) {
        const k = clamp((t - .15 - i * .09) / .14, 0, 1); if (k <= 0) break;
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        g.globalAlpha = bump(t, .1, .5, 2.0) * .8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); g.stroke();
      }
      pts.forEach(([px, py], i) => spark(px, py, 9 + Math.sin(t * 9 + i) * 3, pal[0], bump(t, .12 + i * .09, .25 + i * .09, 2.0), 0));
      stars(dt); fall(dt);
      g.restore();
      return true;
    });
  }

  const KINDS = { magic, jackpot, mystic };
  window.FX = {
    play(kind, el, o) { if (reduce || !el || !KINDS[kind] || !el.getClientRects().length) return; KINDS[kind](el, o || {}); },
    // カットインに使うキャラクターの絵を、先に読み込んでおく
    warm(who) { face(who); },
  };
})();
