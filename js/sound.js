/* 音效引擎：默认用 WebAudio 实时合成，不依赖任何音频文件
 * Sound.play(name)   —— UI 提示音（换挡、锁车、Autopilot、转向灯…）
 * Sound.music.*      —— 生成式背景音乐，用来模拟媒体播放器
 * 自定义音效包：在 sounds/pack.json 里把音效名映射到音频文件（如自己录的车内提示音），
 * 有文件的音效优先播放文件，其余继续用合成音。音效名见 sounds/README.md。
 */
(function () {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  let enabled = true;
  try { enabled = localStorage.getItem('driveos.sound') !== 'off'; } catch (e) {}

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.25; musicBus.connect(master);
      loadPack();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // 浏览器要求用户手势后才能出声
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, ensure, { once: false, passive: true }));

  // 自定义音效包（只在通过 http 打开时可用）
  const pack = {};
  async function loadPack() {
    if (location.protocol === 'file:') return;
    try {
      const res = await fetch('sounds/pack.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const map = await res.json();
      await Promise.all(Object.entries(map).filter(([k]) => !k.startsWith('_')).map(async ([name, file]) => {
        try { pack[name] = await ctx.decodeAudioData(await (await fetch('sounds/' + file)).arrayBuffer()); }
        catch (e) { console.warn('音效文件加载失败：', file); }
      }));
    } catch (e) { /* 没有音效包 */ }
  }
  function playBuffer(buf, { loop = false, gain = 1 } = {}) {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.loop = loop; g.gain.value = gain;
    src.connect(g); g.connect(sfxBus); src.start();
    return { src, g };
  }

  // 一个带包络的音
  function tone(freq, t0, dur, { type = 'sine', gain = 0.3, attack = 0.005, release, bus, detune = 0, slideTo } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const rel = release ?? dur;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + rel);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + attack + rel + 0.05);
  }
  function noise(t0, dur, { gain = 0.2, freq = 1200, q = 1, type = 'bandpass', sweepTo } = {}) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0); src.stop(t0 + dur);
  }
  // 转向灯“嗒-哒”：短促的木质敲击声（音高快速下滑的正弦 + 一点高频噪声），两下音高不同
  function click(t0, hi) {
    tone(hi ? 2600 : 1900, t0, 0.028, { gain: 0.32, attack: 0.001, slideTo: hi ? 1500 : 1100 });
    tone(hi ? 5200 : 3800, t0, 0.012, { gain: 0.05, attack: 0.001 });
    noise(t0, 0.012, { gain: 0.18, freq: hi ? 4500 : 3500, q: 3 });
  }
  // 柔和的钟琴音色：基音 + 少量泛音，快起慢收（车机提示音大多是这种干净的“叮”）
  function bell(freq, t0, dur, gain = 0.18) {
    tone(freq, t0, dur, { gain, attack: 0.004 });
    tone(freq * 2, t0, dur * 0.45, { gain: gain * 0.28, attack: 0.003 });
    tone(freq * 3.01, t0, dur * 0.25, { gain: gain * 0.1, attack: 0.002 });
  }

  const SFX = {
    tap(t) { tone(1650, t, 0.035, { type: 'sine', gain: 0.08 }); },
    toggle(t) { tone(1100, t, 0.04, { gain: 0.1 }); tone(1650, t + 0.04, 0.05, { gain: 0.08 }); },
    open(t) { tone(520, t, 0.25, { type: 'triangle', gain: 0.12, slideTo: 880 }); },
    close(t) { tone(880, t, 0.22, { type: 'triangle', gain: 0.12, slideTo: 520 }); },
    // 换挡：清脆短促的双音
    gear(t) { bell(1318.5, t, 0.22, 0.14); },
    gearP(t) { bell(987.8, t, 0.26, 0.14); },
    // Autopilot 启用：上行双音；退出：下行双音（Tesla 的经典提示）
    apOn(t) { bell(1174.7, t, 0.35, 0.17); bell(1568, t + 0.11, 0.6, 0.17); },
    apOff(t) { bell(1568, t, 0.35, 0.17); bell(1174.7, t + 0.11, 0.65, 0.17); },
    apUnavailable(t) { tone(660, t, 0.12, { type: 'triangle', gain: 0.18 }); tone(660, t + 0.18, 0.12, { type: 'triangle', gain: 0.18 }); },
    // 锁车：喇叭短鸣 + 继电器声
    lock(t) { noise(t, 0.05, { gain: 0.35, freq: 900, q: 2 }); tone(415, t + 0.02, 0.09, { type: 'sawtooth', gain: 0.07 }); tone(523, t + 0.02, 0.09, { type: 'sawtooth', gain: 0.05 }); },
    unlock(t) { noise(t, 0.04, { gain: 0.3, freq: 1400, q: 2 }); noise(t + 0.12, 0.04, { gain: 0.3, freq: 1400, q: 2 }); },
    chime(t) { bell(1318.5, t, 0.9, 0.16); },
    nav(t) { bell(987.8, t, 0.4, 0.15); bell(1318.5, t + 0.14, 0.7, 0.15); },
    navArrive(t) { [987.8, 1318.5, 1568].forEach((f, i) => bell(f, t + i * 0.14, 0.8, 0.13)); },
    warn(t) { for (let i = 0; i < 3; i++) tone(1480, t + i * 0.16, 0.09, { type: 'square', gain: 0.06 }); },
    error(t) { tone(330, t, 0.18, { type: 'triangle', gain: 0.2 }); },
    signalOn(t) { click(t, true); },
    signalOff(t) { click(t, false); },
    charge(t) { bell(1046.5, t, 0.4, 0.14); bell(1318.5, t + 0.12, 0.4, 0.14); bell(1568, t + 0.24, 0.8, 0.14); },
    door(t) { noise(t, 0.18, { gain: 0.25, freq: 300, q: 0.7, type: 'lowpass' }); tone(90, t, 0.15, { gain: 0.25 }); },
    frunk(t) { noise(t, 0.6, { gain: 0.12, freq: 600, q: 0.6, sweepTo: 1800 }); tone(180, t, 0.5, { type: 'sawtooth', gain: 0.025, slideTo: 240 }); },
    ring(t) { for (let i = 0; i < 2; i++) { tone(440, t + i * 0.45, 0.35, { gain: 0.08 }); tone(480, t + i * 0.45, 0.35, { gain: 0.08 }); } },
    hangup(t) { tone(480, t, 0.15, { gain: 0.1 }); tone(360, t + 0.18, 0.2, { gain: 0.1 }); },
    keypad(t) { tone(697 + Math.random() * 600, t, 0.1, { gain: 0.08 }); tone(1209 + Math.random() * 400, t, 0.1, { gain: 0.06 }); },
    // 玩具箱：排放测试模式 😄
    fart(t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t);
      for (let i = 0; i < 14; i++) o.frequency.setValueAtTime(70 + Math.random() * 60, t + i * 0.05);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.9);
      f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1);
      noise(t, 0.9, { gain: 0.15, freq: 220, q: 3 });
    },
    crash(t) {
      tone(70, t, 0.4, { gain: 0.6, slideTo: 35 });
      noise(t, 0.5, { gain: 0.7, freq: 700, q: 0.6, type: 'lowpass' });
      noise(t + 0.02, 0.35, { gain: 0.35, freq: 2500, q: 1.5, sweepTo: 600 });
      for (let i = 0; i < 6; i++) tone(2500 + Math.random() * 3000, t + 0.08 + i * 0.05, 0.12, { type: 'triangle', gain: 0.05 });
    },
    lightshow(t) { [523, 659, 784, 1046.5, 784, 659, 523, 784].forEach((f, i) => tone(f, t + i * 0.18, 0.3, { type: 'triangle', gain: 0.1 })); },
  };

  // ---------------------- 生成式背景音乐 ----------------------
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const music = {
    playing: false, track: null, step: 0, nextTime: 0, timer: null, filter: null,
    start(track) {
      if (!ensure()) return;
      this.track = track; this.playing = true; this.step = 0;
      this.nextTime = ctx.currentTime + 0.08;
      if (!this.filter) {
        this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 2400;
        const delay = ctx.createDelay(); delay.delayTime.value = 0.32;
        const fb = ctx.createGain(); fb.gain.value = 0.28;
        this.filter.connect(musicBus); this.filter.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(musicBus);
      }
      clearInterval(this.timer);
      this.timer = setInterval(() => this.schedule(), 40);
    },
    stop() { this.playing = false; clearInterval(this.timer); },
    schedule() {
      if (!this.playing || !enabled) return;
      const tr = this.track, spb = 60 / tr.bpm / 2; // 八分音符
      while (this.nextTime < ctx.currentTime + 0.15) {
        const s = this.step, t = this.nextTime;
        const bar = Math.floor(s / 8) % tr.chords.length, chord = tr.chords[bar], beat = s % 8;
        const out = this.filter;
        if (beat === 0) chord.forEach((n, i) => tone(midi(n), t, spb * 8, { type: 'sawtooth', gain: 0.022, attack: 0.25, release: spb * 8, bus: out, detune: i * 4 - 4 }));
        if (beat === 0 || beat === 3 || beat === 6) tone(midi(chord[0] - 12), t, spb * 1.5, { type: 'triangle', gain: 0.13, attack: 0.01, bus: out });
        const arp = tr.pattern[beat % tr.pattern.length];
        if (arp != null) tone(midi(chord[arp % chord.length] + 12 + (arp >= chord.length ? 12 : 0)), t, spb * 0.9, { type: 'square', gain: 0.025, bus: out });
        if (tr.drums) {
          if (beat % 4 === 0) tone(110, t, 0.18, { gain: 0.3, slideTo: 40, bus: out });
          if (beat % 2 === 1) noise(t, 0.04, { gain: 0.06, freq: 8000, q: 1, type: 'highpass' });
          if (beat === 4) noise(t, 0.14, { gain: 0.12, freq: 1800, q: 0.8 });
        }
        this.nextTime += spb; this.step++;
      }
    },
  };

  // 喇叭：两个略微失谐的锯齿波（约 F4 + A4，接近真实双音喇叭），按住持续发声
  let hornNodes = null;
  function horn(on) {
    if (on) {
      if (hornNodes || !enabled || !ensure()) return;
      if (pack.horn) { const n = playBuffer(pack.horn, { loop: true }); hornNodes = { g: n.g, oscs: [n.src] }; return; }
      const t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1800; f.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.03);
      const oscs = [349, 352, 440, 444].map(fr => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t); return o; });
      f.connect(g); g.connect(sfxBus);
      hornNodes = { g, oscs };
    } else if (hornNodes) {
      const { g, oscs } = hornNodes, t = ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      oscs.forEach(o => o.stop(t + 0.08)); hornNodes = null;
    }
  }

  window.Sound = {
    horn,
    get enabled() { return enabled; },
    get pack() { return Object.keys(pack); }, // 已加载的自定义音效
    setEnabled(v) {
      enabled = v;
      try { localStorage.setItem('driveos.sound', v ? 'on' : 'off'); } catch (e) {}
      if (master) master.gain.value = v ? 0.9 : 0;
    },
    play(name) {
      if (!enabled || !ensure()) return;
      if (pack[name]) return void playBuffer(pack[name]);
      if (SFX[name]) SFX[name](ctx.currentTime + 0.01);
    },
    setMusicVolume(v) { if (ensure()) musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    music,
  };
})();
