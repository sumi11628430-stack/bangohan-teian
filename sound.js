// 効果音とBGM。音の素材ファイルは使わず、その場で合成して鳴らす（Web Audio API）。
// 使い方（app.js から）：SND.sfx('win-roulette')／SND.scene('roulette')＝その場面のBGMを流す・SND.scene(null)＝止める／SND.set(true|false)＝音あり・音なし
// 音は、使う人が画面を押したあとでないと鳴らせない（ブラウザの決まり）。押した流れの中で呼ばれたときに、音の用意をする
(function () {
  'use strict';
  const KEY = 'bangohan_sound';
  const AC = window.AudioContext || window.webkitAudioContext;
  let on = true;   // 音あり・音なし（端末に覚えておく。最初は音あり＝2026-10-07 社長判断。見出しの右上のスイッチで切れる）
  try { const v = localStorage.getItem(KEY); if (v != null) on = v === '1'; } catch (e) { /* 覚えられない端末では、毎回「音あり」から */ }

  let ctx = null, master = null, sfxBus = null, bgmBus = null, verb = null;
  let seqBus = null;   // 先の時刻まで予約しておく音（針の音・高まる音）の通り道。途中でやめるときは、これごと切る
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);   // 音の高さ（MIDIの番号）→ 周波数

  // 残響（ホールの響き）：だんだん小さくなる雑音を、響きの型として使う
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const w = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
        last = last * .35 + w * .65;   // 高い音を少し丸める
        d[i] = last;
      }
    }
    return buf;
  }
  function setup() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? .9 : 0;
    const comp = ctx.createDynamicsCompressor();   // 音が割れないように、大きすぎる所をおさえる
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .18;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .85; sfxBus.connect(master);
    seqBus = ctx.createGain(); seqBus.connect(sfxBus);
    bgmBus = ctx.createGain(); bgmBus.gain.value = .3; bgmBus.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(2.2, 2.6);
    const wet = ctx.createGain(); wet.gain.value = .55;
    verb.connect(wet); wet.connect(master);
  }
  // 押した流れの中で呼ぶ：音の用意をして、止まっていたら動かす
  function unlock() {
    if (!on) return false;
    setup();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ---------- 音の部品 ----------
  // 波をひとつ鳴らす。o＝{ type 波の形, f 高さ(Hz), to 終わりの高さ, t 始まり, a 立ち上がり, d 長さ, g 大きさ, det ずらし(セント), dest 出す先, rev 残響へ送る量, lp ローパスの高さ, lpTo 終わりの高さ, q }
  function tone(o) {
    const t = o.t, d = o.d, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    if (o.det) osc.detune.value = o.det;
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(o.g, t + (o.a || .005));
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    let out = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || .7;
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + d);
      osc.connect(f); out = f;
    }
    out.connect(g); g.connect(o.dest);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(verb); }
    osc.start(t); osc.stop(t + d + .05);
  }
  let noiseBuf = null;
  // 雑音（シャー・シュッ）をフィルターに通して鳴らす。o＝{ kind フィルターの種類, f, to, q, t, a, d, g, dest, rev }
  function noise(o) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = o.t, d = o.d, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.kind || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(o.g, t + (o.a || .004));
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    src.connect(f); f.connect(g); g.connect(o.dest);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(verb); }
    src.start(t, Math.random()); src.stop(t + d + .05);
  }
  // 鐘・ガラスのような音（高さの違う正弦波を重ねる）
  function bell(t, m, g, d, dest, rev) {
    const f = hz(m);
    tone({ t, f, d, g, dest, rev });
    tone({ t, f: f * 2.01, d: d * .7, g: g * .45, dest, rev });
    tone({ t, f: f * 3.02, d: d * .4, g: g * .18, dest, rev });
  }
  // 明るく広がる和音（少しずらした のこぎり波を重ねて、フィルターを開く）
  function stab(t, notes, g, d, dest, rev, open) {
    notes.forEach(m => [-9, 0, 8].forEach(det => tone({ type: 'sawtooth', t, f: hz(m), det, d, g: g / 3, a: .012, lp: 600, lpTo: open || 5200, q: 1.2, dest, rev })));
  }
  // 低い一撃（ドン）
  function boom(t, g, dest) {
    tone({ t, f: 130, to: 42, d: .42, g, dest });
    noise({ kind: 'lowpass', f: 900, to: 120, t, d: .25, g: g * .5, dest });
  }
  // きらめき（高い雑音が、こまかく震えながら消える）
  function shimmer(t, d, g, dest) {
    noise({ kind: 'highpass', f: 7000, t, a: .05, d, g, dest, rev: .5 });
    for (let i = 0; i < 9; i++) tone({ t: t + i * d / 11 + Math.random() * .03, f: 2400 + Math.random() * 3600, d: .22, g: g * .55, dest, rev: .7 });
  }

  // ---------- 効果音 ----------
  const SFX = {
    // ボタンを押した
    tap: t => { tone({ t, f: 880, to: 640, d: .07, g: .22, dest: sfxBus }); noise({ kind: 'highpass', f: 4000, t, d: .02, g: .12, dest: sfxBus }); },
    // 回り始め（シュワッ）
    spin: t => {
      noise({ f: 300, to: 3600, q: 1.4, t, a: .12, d: .55, g: .32, dest: sfxBus, rev: .25 });
      tone({ type: 'sawtooth', t, f: 110, to: 520, d: .5, g: .14, a: .1, lp: 400, lpTo: 3000, dest: sfxBus });
    },
    // 円盤の針がマスをはじく
    tick: t => { tone({ t, f: 1500, to: 900, d: .035, g: .16, dest: seqBus }); noise({ kind: 'highpass', f: 5000, t, d: .012, g: .1, dest: seqBus }); },
    // 料理名が見えた（止まる2秒前）：だんだん高まる
    riser: (t, o) => {
      const d = (o && o.d) || 2;
      noise({ f: 400, to: 7000, q: 2, t, a: d * .9, d, g: .2, dest: seqBus });
      [0, 7].forEach(det => tone({ type: 'sawtooth', t, f: 196, to: 784, det, d, g: .07, a: d * .85, lp: 500, lpTo: 6000, dest: seqBus }));
      [0, 2, 4, 7, 9].forEach((s, i) => bell(t + i * .07, 76 + s, .1, .5, seqBus, .6));
    },
    // ルーレットが決まった：魔法が発動するような、広がる音
    'win-roulette': t => {
      boom(t, .7, sfxBus);
      noise({ kind: 'highpass', f: 5000, t, d: 1.1, g: .22, dest: sfxBus, rev: .6 });
      stab(t, [65, 69, 72, 76, 79], .5, 1.5, sfxBus, .5);                       // F のメジャー9
      [77, 81, 84, 88, 91, 93, 96, 100].forEach((m, i) => bell(t + .08 + i * .055, m, .16, .9, sfxBus, .8));
      shimmer(t + .35, 1.3, .1, sfxBus);
    },
    // スロットの列が1つ止まった（ドン）
    reelstop: t => { tone({ t, f: 170, to: 70, d: .14, g: .5, dest: sfxBus }); noise({ f: 2800, q: 2, t, d: .05, g: .2, dest: sfxBus }); bell(t + .01, 84, .08, .25, sfxBus, .4); },
    // 「推す」を押した
    push: t => { tone({ type: 'triangle', t, f: 660, to: 990, d: .09, g: .25, dest: sfxBus }); tone({ t: t + .06, f: 1320, d: .1, g: .14, dest: sfxBus, rev: .3 }); },
    // 「固定」を押した（カチッ）
    hold: t => { tone({ t, f: 2000, to: 1500, d: .03, g: .18, dest: sfxBus }); tone({ t: t + .05, f: 1200, to: 900, d: .04, g: .18, dest: sfxBus }); },
    // あと1列（最後の列を待つ間）：鼓動のように高まる
    reach: t => { [0, .28, .56, .84].forEach((dt, i) => { tone({ t: t + dt, f: 95, to: 60, d: .16, g: .32 + i * .04, dest: sfxBus }); bell(t + dt, 88 + i, .05, .2, sfxBus, .5); }); },
    // スロットが決まった：はなやかなファンファーレ
    'win-slot': t => {
      boom(t, .75, sfxBus);
      noise({ kind: 'highpass', f: 6000, t, d: .9, g: .2, dest: sfxBus, rev: .5 });
      [[60, 0], [64, .09], [67, .18], [72, .27]].forEach(([m, dt]) => stab(t + dt, [m, m + 12], .34, .3, sfxBus, .3, 7000));   // ド・ミ・ソ・ド
      stab(t + .4, [60, 64, 67, 72, 76], .55, 1.4, sfxBus, .55, 6500);
      for (let i = 0; i < 14; i++) bell(t + .45 + i * .06 + Math.random() * .02, 84 + [0, 4, 7, 12, 16][i % 5], .09, .5, sfxBus, .7);   // コインが降るようなきらめき
      shimmer(t + .5, 1.4, .1, sfxBus);
    },
    // 占い：水晶玉が光っていく（結果が出るまでの間）
    charge: (t, o) => {
      const d = (o && o.d) || 1.4;
      [57, 64, 69].forEach((m, i) => tone({ type: 'triangle', t, f: hz(m), to: hz(m + 7), det: i * 6 - 6, d, g: .09, a: d * .8, lp: 500, lpTo: 4200, dest: seqBus }));
      noise({ f: 900, to: 5200, q: 3, t, a: d * .9, d, g: .1, dest: seqBus });
      for (let i = 0; i < 10; i++) bell(t + d * (1 - Math.pow(1 - i / 10, 2)) * .95, 81 + [0, 3, 7, 10, 12][i % 5], .06, .3, seqBus, .8);
    },
    // 占いの結果が出た：ガラスの鐘が広がる
    'win-fortune': t => {
      tone({ t, f: 110, to: 55, d: .6, g: .4, dest: sfxBus });
      [[69, 0], [72, .1], [76, .2], [83, .32], [88, .46], [84, .62]].forEach(([m, dt]) => bell(t + dt, m, .2, 1.6, sfxBus, .9));   // A・C・E・B の、澄んだ和音
      [57, 64, 72].forEach((m, i) => tone({ type: 'triangle', t, f: hz(m), det: i * 5 - 5, d: 2, g: .08, a: .3, lp: 1600, dest: sfxBus, rev: .8 }));
      shimmer(t + .2, 1.6, .08, sfxBus);
    },
    // めずらしいキャラクターが出てきた：ハープのように駆け上がる
    rare: t => { [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 88].forEach((m, i) => bell(t + i * .04, m + 5, .1, .7, sfxBus, .8)); },
  };
  function sfx(name, o) {
    if (!on || !unlock() || !SFX[name]) return;
    SFX[name](ctx.currentTime + ((o && o.at) || 0) + .01, o);
  }
  // 円盤の針の音を、回る速さに合わせてまとめて予約する。times＝回し始めからの秒（マスの境目を通る時刻）
  function ticks(times) {
    if (!on || !unlock()) return;
    const t0 = ctx.currentTime + .01;
    times.forEach(s => SFX.tick(t0 + s));
  }

  // ---------- BGM（くり返す音楽を、その場で演奏する） ----------
  // 1小節＝16コマ。和音（chords）は1小節ごと。step(曲, コマ番号, 時刻, 1コマの長さ) が、そのコマで鳴らす音を決める
  const SONGS = {
    // ルーレット：明るいショーの舞台。軽く弾むリズム
    roulette: {
      bpm: 112, swing: .14,
      chords: [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 58]],   // Fmaj7・Dm7・B♭maj7・C7
      step(s, i, t, dur) {
        const bar = Math.floor(i / 16) % 4, k = i % 16, ch = s.chords[bar];
        if (k === 0 || k === 6 || k === 8) kick(t, .5);
        if (k === 4 || k === 12) clap(t, .22);
        if (k % 2 === 0) hat(t, k % 4 === 2 ? .09 : .05);
        if (s.hot && k % 2 === 1) hat(t, .04);
        if ([0, 3, 6, 8, 11, 14].includes(k)) bass(t, ch[0] - 12 + (k === 11 ? 7 : 0), dur * 1.6, .3);
        if (k % 2 === 0) pluck(t, ch[[0, 2, 1, 3, 2, 1, 3, 2][k / 2]] + 12, dur * 1.8, .1);
        if (k === 0) pad(t, ch, dur * 16, .05);
      },
    },
    // 献立スロット：にぎやかで、前へ進むリズム
    slot: {
      bpm: 126, swing: 0,
      chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],   // Am7・Fmaj7・Cmaj7・G7
      step(s, i, t, dur) {
        const bar = Math.floor(i / 16) % 4, k = i % 16, ch = s.chords[bar];
        if (k % 4 === 0) kick(t, .55);
        if (k === 4 || k === 12) clap(t, .2);
        if (k % 4 === 2) hat(t, .1);
        if (s.hot && k % 2 === 1) hat(t, .05);
        if (k % 4 === 2) bass(t, ch[0] - 12, dur * 1.4, .3);
        if (k % 4 === 3) bass(t, ch[0], dur * .9, .2);
        pluck(t, ch[[0, 1, 2, 3, 2, 1][k % 6]] + 12 + (k % 8 === 7 ? 12 : 0), dur * 1.2, .07);
        if (k === 0) pad(t, ch, dur * 16, .05);
      },
    },
    // 占い：静かで、ふしぎな夜空
    fortune: {
      bpm: 76, swing: 0,
      chords: [[57, 60, 64, 71], [53, 57, 60, 64], [50, 53, 57, 64], [52, 55, 59, 62]],   // Am9・Fmaj7・Dm9・Em7
      step(s, i, t, dur) {
        const bar = Math.floor(i / 16) % 4, k = i % 16, ch = s.chords[bar];
        if (k === 0) { pad(t, ch, dur * 16, .09); bass(t, ch[0] - 12, dur * 14, .22); }
        if ([0, 3, 6, 10, 13].includes(k)) bell(t, ch[[0, 2, 3, 1, 2][[0, 3, 6, 10, 13].indexOf(k)]] + 12 + (bar % 2 ? 12 : 0), .1, 1.6, bgmBus, .9);
        if (k % 4 === 2) hat(t, .025);
      },
    },
  };
  // 打楽器と楽器（BGM用）
  function kick(t, g) { tone({ t, f: 150, to: 46, d: .22, g, dest: bgmBus }); duck(t); }
  function clap(t, g) { noise({ f: 1800, q: 1.2, t, d: .13, g, dest: bgmBus, rev: .25 }); }
  function hat(t, g) { noise({ kind: 'highpass', f: 8000, t, d: .04, g, dest: bgmBus }); }
  function bass(t, m, d, g) { tone({ type: 'sawtooth', t, f: hz(m), d, g, a: .01, lp: 700, lpTo: 180, q: 2, dest: bgmBus }); tone({ t, f: hz(m), d, g: g * .8, dest: bgmBus }); }
  function pluck(t, m, d, g) { [-6, 6].forEach(det => tone({ type: 'sawtooth', t, f: hz(m), det, d, g, lp: 3800, lpTo: 500, q: 2.5, dest: bgmBus, rev: .35 })); }
  let padGain = null;
  function pad(t, notes, d, g) {
    notes.forEach((m, i) => [-8, 7].forEach(det => tone({ type: 'sawtooth', t, f: hz(m + 12), det: det + i, d: d * 1.05, g, a: d * .2, lp: 1300, q: .8, dest: padGain || bgmBus, rev: .5 })));
  }
  // キック（ドン）のたびに、広がる和音を一瞬しずめる（今っぽい、うねる感じ）
  function duck(t) { if (!padGain) return; padGain.gain.cancelScheduledValues(t); padGain.gain.setValueAtTime(.35, t); padGain.gain.linearRampToValueAtTime(1, t + .24); }

  let song = null, timer = 0;
  function pump() {
    if (!song || !ctx) return;
    const dur = 60 / song.def.bpm / 4;
    while (song.next < ctx.currentTime + .15) {
      const late = song.i % 2 ? song.def.swing * dur : 0;
      song.def.step(song, song.i, song.next + late, dur);
      song.i++; song.next += dur;
    }
  }
  function stopSong() {
    clearInterval(timer); timer = 0;
    if (song && ctx) { const g = bgmBus.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(.0001, t + .35); }
    song = null;
  }
  // 場面のBGMを流す（name＝roulette・slot・fortune）。null で止める。押した流れの中で呼ぶこと
  function scene(name) {
    if (!name || !SONGS[name] || !on) { stopSong(); return; }
    if (song && song.name === name) return;
    stopSong();
    if (!unlock()) return;
    const t = ctx.currentTime;
    if (!padGain) { padGain = ctx.createGain(); padGain.connect(bgmBus); const s = ctx.createGain(); s.gain.value = .4; padGain.connect(s); s.connect(verb); }
    // 前の曲の残りをしぼってから、新しい曲をふわっと入れる
    const g = bgmBus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(.0001, g.value), t); g.linearRampToValueAtTime(.0001, t + .3); g.linearRampToValueAtTime(.3, t + .9);
    song = { name, def: SONGS[name], chords: SONGS[name].chords, i: 0, next: t + .35, hot: false };
    timer = setInterval(pump, 30);
    pump();
  }
  // 盛り上げる・戻す（回っている間は、リズムを細かくする）
  function hot(v) { if (song) song.hot = !!v; }
  // 予約してある音（針の音・高まる音）を、途中でやめる（回っている途中で最初の状態に戻したとき）
  function cut() {
    if (!ctx || !seqBus) return;
    const old = seqBus, t = ctx.currentTime;
    old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0, t + .05);
    setTimeout(() => old.disconnect(), 120);
    seqBus = ctx.createGain(); seqBus.connect(sfxBus);
  }
  // 決まる直前の「間」：BGMを一瞬しずめて、決まった音を前に出す。sec＝しずめておく長さ
  function hush(sec) {
    if (!ctx || !song) return;
    const g = bgmBus.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(.0001, g.value), t);
    g.linearRampToValueAtTime(.04, t + .08); g.setValueAtTime(.04, t + sec); g.linearRampToValueAtTime(.3, t + sec + 1.2);
  }

  function set(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* 覚えられなくても、この場では切り替わる */ }
    if (!on) { stopSong(); if (master) master.gain.setTargetAtTime(0, ctx.currentTime, .03); }
    else if (unlock()) master.gain.setTargetAtTime(.9, ctx.currentTime, .03);
  }
  // 画面を離れている間（別のタブ・画面オフ）は、音を止める
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (on) ctx.resume();
  });

  window.SND = { sfx, ticks, scene, hot, cut, hush, set, get on() { return on; }, get ok() { return !!AC; } };
})();
