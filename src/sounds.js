// ── GrammarX Sound Engine ─────────────────────────────────────────────────────
// Pure Web Audio API — zero external files, works offline

let _ctx = null;
let _muted = false;
let _bgPlaying = false;
let _bgTimer = null;

/** Lazy AudioContext — created on first user interaction */
function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/** Schedule a single oscillator tone */
function tone(type, freq, startT, dur, vol, freqEnd = null) {
  const c = ctx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, startT);
  if (freqEnd != null)
    o.frequency.exponentialRampToValueAtTime(freqEnd, startT + dur * 0.88);
  g.gain.setValueAtTime(vol, startT);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur * 0.92);
  o.start(startT);
  o.stop(startT + dur + 0.05);
}

// ── Background music ──────────────────────────────────────────────────────────
// Upbeat 8-bit loop — C major pentatonic, ~4.5s cycle
const _MELODY = [
  // Phrase 1: ascending arpeggio C5→C6
  [523,0.15],[659,0.15],[784,0.15],[1047,0.15],
  // Phrase 2: descent G5→G4
  [784,0.15],[659,0.15],[523,0.15],[392,0.15],
  // Phrase 3: Am climb A4→G5
  [440,0.15],[523,0.15],[659,0.15],[784,0.15],
  // Phrase 4: resolve E5→G4
  [659,0.30],[523,0.15],[392,0.15],
  // Phrase 5: F passage
  [349,0.15],[440,0.15],[523,0.15],[659,0.15],
  // Phrase 6: F5 back down
  [698,0.15],[659,0.15],[523,0.15],[440,0.15],
  // Phrase 7: G run
  [392,0.15],[494,0.15],[587,0.15],[784,0.15],
  // Phrase 8: landing C5
  [523,0.45],
];

// Simple bass root notes (1 note per 2 phrases = 0.60s each)
const _BASS = [
  [131,0.60],[131,0.60], // C2
  [110,0.60],[110,0.60], // A1
  [175,0.60],[175,0.60], // F2
  [98, 0.60],[98, 0.45], // G1
];

function _scheduleBg() {
  if (!_bgPlaying || _muted) return;
  const c = ctx();
  let mt = c.currentTime + 0.05;

  // Melody — triangle wave, very soft
  _MELODY.forEach(([f, d]) => {
    tone('triangle', f, mt, d * 0.85, 0.055);
    mt += d;
  });

  // Bass — sine wave, subtle
  let bt = c.currentTime + 0.05;
  _BASS.forEach(([f, d]) => {
    tone('sine', f, bt, d * 0.6, 0.07);
    bt += d;
  });

  const totalDur = _MELODY.reduce((s, [, d]) => s + d, 0);
  _bgTimer = setTimeout(_scheduleBg, (totalDur - 0.15) * 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────
const SFX = {
  /** ✅ Correct answer — ascending major arpeggio chime */
  correct() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    [[523,0],[659,0.08],[784,0.16],[1047,0.24]].forEach(([f,dt]) =>
      tone('sine', f, t+dt, 0.28, 0.22));
  },

  /** ❌ Wrong answer — descending sawtooth buzz */
  wrong() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    tone('sawtooth', 230, t, 0.40, 0.18, 95);
  },

  /** ⏰ Time expired — two low blips */
  timeout() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    tone('square', 280, t,      0.13, 0.14);
    tone('square', 190, t+0.18, 0.24, 0.14);
  },

  /** 🕐 Timer tick — soft click for normal countdown */
  tick() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    tone('sine', 750, t, 0.04, 0.07);
  },

  /** 🔴 Timer tick — sharp beep for last 3 seconds */
  urgentTick() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    tone('square', 1100, t, 0.055, 0.11);
  },

  /** 🔔 New round — quick ascending sweep */
  roundStart() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    [[440,0],[554,0.07],[659,0.14],[880,0.21]].forEach(([f,dt]) =>
      tone('triangle', f, t+dt, 0.14, 0.18));
  },

  /** 🚀 Game starting — short fanfare */
  gameStart() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    [[523,0,0.12],[659,0.12,0.12],[784,0.24,0.12],[1047,0.36,0.55]]
      .forEach(([f,dt,d]) => tone('triangle', f, t+dt, d, 0.22));
  },

  /** 🏆 Victory — classic end-game fanfare */
  victory() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    [
      [523,0,0.10],[523,0.10,0.10],[523,0.20,0.10],
      [523,0.30,0.28],[415,0.30,0.28],
      [466,0.60,0.28],[523,0.88,0.58],
    ].forEach(([f,dt,d]) => tone('triangle', f, t+dt, d, 0.22));
  },

  /** 👋 Player joined lobby — double ping */
  playerJoin() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    tone('sine', 600, t,      0.10, 0.12);
    tone('sine', 950, t+0.11, 0.16, 0.12);
  },

  /** 🖱 Generic UI click */
  click() {
    if (_muted) return;
    const c = ctx(); const t = c.currentTime;
    tone('sine', 480, t, 0.04, 0.06);
  },

  // ── Music control ───────────────────────────────────────────────────────────
  startMusic() {
    if (_bgPlaying) return;
    _bgPlaying = true;
    _scheduleBg();
  },
  stopMusic() {
    _bgPlaying = false;
    clearTimeout(_bgTimer);
  },

  // ── Mute ───────────────────────────────────────────────────────────────────
  setMuted(val) {
    _muted = val;
    if (val) this.stopMusic();
  },
  getMuted() { return _muted; },
  toggleMute() {
    _muted = !_muted;
    if (_muted) this.stopMusic();
    return _muted;
  },
};

export default SFX;
