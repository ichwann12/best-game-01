// Sound, all synthesised in code with the Web Audio API — no audio files, no network.
// Every effect is a short oscillator or filtered-noise burst; the music is a quiet bass
// sequencer. The context is created only after a user gesture (unlock), so the title screen
// stays silent and the shot scenes never make a sound.
const NOTE = { A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, G1: 49, F2: 87.31 };

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;
  let lastShoot = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a user gesture; creates the context and starts the bass loop. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (musicTimer === null) {
      musicTimer = window.setInterval(() => {
        if (muted || !ctx || ctx.state !== 'running') return;
        playBassNote();
      }, 240);
    }
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function playBassNote() {
    const pattern = [NOTE.A1, 0, NOTE.A1, 0, NOTE.C2, 0, NOTE.E2, 0, NOTE.A1, 0, NOTE.G1, 0, NOTE.F2, 0, NOTE.E2, 0];
    const freq = pattern[musicStep % pattern.length];
    musicStep += 1;
    if (!freq || !ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  }

  return {
    unlock,
    isMuted: () => muted,
    toggleMute() {
      return setMuted(!muted);
    },
    shoot() {
      const now = performance.now();
      if (now - lastShoot < 45) return;
      lastShoot = now;
      tone(720, 0.07, 'square', 0.05, 240);
    },
    explosion(big) {
      noise(big ? 0.5 : 0.28, big ? 0.35 : 0.2, big ? 900 : 1400);
      tone(big ? 90 : 140, big ? 0.4 : 0.2, 'sine', 0.25, 40);
    },
    hit() {
      tone(180, 0.12, 'sawtooth', 0.18, 60);
      noise(0.08, 0.12, 2000);
    },
    pickup() {
      tone(880, 0.08, 'sine', 0.12);
      window.setTimeout(() => tone(1320, 0.1, 'sine', 0.1), 60);
    },
    wave() {
      tone(220, 0.18, 'triangle', 0.16, 440);
      window.setTimeout(() => tone(330, 0.18, 'triangle', 0.14, 660), 120);
    },
    boss() {
      tone(55, 0.7, 'sawtooth', 0.3, 110);
      noise(0.5, 0.15, 500);
    },
    upgrade() {
      [523, 659, 784].forEach((f, i) => window.setTimeout(() => tone(f, 0.14, 'sine', 0.12), i * 70));
    },
    gameOver() {
      [392, 311, 233, 175].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'triangle', 0.16), i * 160));
    },
    click() {
      tone(660, 0.05, 'sine', 0.08);
    },
  };
}
