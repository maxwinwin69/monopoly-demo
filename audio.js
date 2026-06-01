'use strict';
// ════════════════════════════════════════════════════════════
//  星際賭場 — 音效系統（Web Audio API，無需外部音檔）
// ════════════════════════════════════════════════════════════

const AUDIO = (() => {
  let AC = null;
  let MASTER, SFX, BGM, REV;
  let _sfxOn = true, _bgmOn = true;
  let _bgmBeat = 0, _bgmNext = 0;

  // A 五聲小調 + 延伸 (55 Hz 起)
  const SCALE = [
    55, 65.4, 73.4, 82.4, 98,
    110, 130.8, 146.8, 164.8, 196,
    220, 261.6, 293.7, 329.6, 392, 440,
  ];
  // 背景琶音模式（SCALE 索引）
  const ARP_PAT = [4,6,8,6, 4,7,9,7, 5,8,10,8, 5,7,9,6];
  const BEAT_S  = 0.46; // 秒/拍

  // ── 初始化 ─────────────────────────────────────────────────
  function init() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC     = new (window.AudioContext || window.webkitAudioContext)();
      MASTER = mk('gain', { gain: 0.78 }, AC.destination);
      SFX    = mk('gain', { gain: 1.0  }, MASTER);
      BGM    = mk('gain', { gain: 0.20 }, MASTER);
      REV    = _makeReverb();
      _startBGM();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') AC.resume();
      });
    } catch (e) { console.warn('AudioContext 初始化失敗', e); }
  }

  // 便利建立 AudioNode
  function mk(type, params, dest) {
    const node = type === 'gain'
      ? AC.createGain()
      : AC.createBiquadFilter();
    Object.entries(params).forEach(([k, v]) => {
      if (node[k] && node[k].value !== undefined) node[k].value = v;
      else if (node[k] !== undefined) node[k] = v;
    });
    if (dest) node.connect(dest);
    return node;
  }

  // ── 殘響（卷積混響）────────────────────────────────────────
  function _makeReverb() {
    const conv = AC.createConvolver();
    const len  = AC.sampleRate * 1.8;
    const buf  = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.3);
    }
    conv.buffer = buf;
    conv.connect(BGM);
    return conv;
  }

  // ── 背景音樂調度器 ─────────────────────────────────────────
  function _startBGM() {
    _bgmNext = AC.currentTime + 0.15;
    _bgmBeat = 0;
    _scheduleBGM();
  }

  function _scheduleBGM() {
    if (!AC) return;
    while (_bgmNext < AC.currentTime + 0.3) {
      if (_bgmOn) _beatNotes(_bgmNext, _bgmBeat % ARP_PAT.length);
      _bgmNext += BEAT_S;
      _bgmBeat++;
    }
    setTimeout(_scheduleBGM, 55);
  }

  function _beatNotes(t, step) {
    const idx = ARP_PAT[step];

    // 低音鼓（每4拍）
    if (step % 4 === 0)
      _bgmOsc('sine', SCALE[0], t, BEAT_S * 4, 0.18, true);

    // 琶音旋律
    _bgmOsc('triangle', SCALE[idx], t, BEAT_S * 0.62, 0.09, false, true);

    // 和弦墊音（每8拍）
    if (step % 8 === 0)
      [2, 4, 6].forEach(i => _bgmOsc('sine', SCALE[i], t, BEAT_S * 8, 0.055, true, true));
  }

  function _bgmOsc(type, freq, t, dur, vol, pad, rev) {
    if (!AC) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    if (pad) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.38);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else {
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    }
    o.connect(g); g.connect(rev && REV ? REV : BGM);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ── 音效工具 ────────────────────────────────────────────────
  function _sfx(fn) {
    if (!_sfxOn || !AC) return;
    if (AC.state === 'suspended') AC.resume();
    fn(AC.currentTime);
  }

  function _osc(type, freq, t, dur, vol) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(SFX);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function _noise(t, dur, vol, cutoff) {
    const len = Math.ceil(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf;
    const flt = AC.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = cutoff || 3000;
    const g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(SFX);
    src.start(t); src.stop(t + dur);
  }

  function _freqRamp(t, start, end, dur, vol) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(start, t);
    o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(SFX);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ── 公開音效 API ────────────────────────────────────────────
  return {
    init,

    // 棋子每步移動聲
    step() {
      _sfx(t => {
        _osc('sine', 460 + Math.random() * 320, t, 0.065, 0.14);
      });
    },

    // 擲骰子
    dice() {
      _sfx(t => {
        _noise(t,        0.07, 0.42, 4000);
        _noise(t + 0.05, 0.06, 0.30, 2500);
        _noise(t + 0.10, 0.05, 0.20, 1600);
      });
    },

    // 獲獎（×1～×5 按倍率升音）
    prize(mult) {
      _sfx(t => {
        const NOTES = [523, 659, 784, 1047, 1319];
        const n = Math.min(mult, 5);
        for (let i = 0; i < n; i++) {
          _osc('triangle', NOTES[i],     t + i * 0.12, 0.30, 0.32);
          _osc('sine',     NOTES[i] * 2, t + i * 0.12, 0.20, 0.10);
        }
      });
    },

    // 宇宙爆炸 JACKPOT
    jackpot() {
      _sfx(t => {
        // 低頻爆炸
        _freqRamp(t, 110, 22, 0.65, 0.70);
        _noise(t, 0.45, 0.55, 750);

        // 快速上行琶音
        [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => {
          _osc('square',   f, t + 0.42 + i * 0.09, 0.55, 0.18);
          _osc('triangle', f, t + 0.42 + i * 0.09, 0.50, 0.14);
        });

        // 終止大和弦
        [523, 659, 784, 1047].forEach(f =>
          _osc('sine', f, t + 1.10, 0.95, 0.20));
      });
    },

    // 黑洞危險（pen = 罰款倍率）
    danger(pen) {
      _sfx(t => {
        for (let i = 0; i < pen; i++) {
          const dt = t + i * 0.27;
          _freqRamp(dt, 310, 45, 0.42, 0.50);
          _noise(dt, 0.18, 0.28, 600);
        }
      });
    },

    // 異次元隨機（FM 音效）
    random() {
      _sfx(t => {
        const car   = AC.createOscillator();
        const mod   = AC.createOscillator();
        const mGain = AC.createGain();
        const g     = AC.createGain();
        car.type = 'sine'; car.frequency.value = 440;
        mod.type = 'sine';
        mod.frequency.setValueAtTime(4, t);
        mod.frequency.linearRampToValueAtTime(18, t + 0.65);
        mGain.gain.setValueAtTime(190, t);
        mGain.gain.exponentialRampToValueAtTime(25, t + 0.65);
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.70);
        mod.connect(mGain); mGain.connect(car.frequency);
        car.connect(g); g.connect(SFX);
        car.start(t); mod.start(t);
        car.stop(t + 0.72); mod.stop(t + 0.72);
      });
    },

    // 經過出發點
    passStart() {
      _sfx(t => {
        _osc('sine', 880,  t,       0.18, 0.28);
        _osc('sine', 1320, t + 0.14, 0.15, 0.22);
        _osc('sine', 1760, t + 0.28, 0.12, 0.18);
      });
    },

    // 提領入帳
    cashOut() {
      _sfx(t => {
        // 金幣連擊
        for (let i = 0; i < 16; i++)
          _osc('sine', 900 + Math.random() * 950, t + i * 0.042, 0.11, 0.20);
        // 勝利和弦
        [523, 659, 784, 1047].forEach((f, i) => {
          _osc('triangle', f,     t + 0.60 + i * 0.07, 1.0, 0.22);
          _osc('sine',     f * 2, t + 0.60 + i * 0.07, 0.8, 0.10);
        });
      });
    },

    // 按鈕點擊聲
    click() {
      _sfx(t => _osc('sine', 900, t, 0.04, 0.10));
    },

    // 切換背景音樂
    toggleBGM() {
      _bgmOn = !_bgmOn;
      if (BGM) BGM.gain.setTargetAtTime(_bgmOn ? 0.20 : 0, AC.currentTime, 0.3);
      return _bgmOn;
    },

    // 切換音效
    toggleSFX() {
      _sfxOn = !_sfxOn;
      return _sfxOn;
    },

    get bgmOn() { return _bgmOn; },
    get sfxOn() { return _sfxOn; },
  };
})();
