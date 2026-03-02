/**
 * SoundManager — Procedural Web Audio API sound effects.
 * No audio files required. All sounds are synthesised at runtime.
 */

type SoundType = 'jump' | 'score' | 'hit' | 'die' | 'menuClick' | 'countdown' | 'start'
              | 'coin' | 'bugCrunch' | 'poopSplash' | 'powerUp' | 'wind' | 'lightning'
              | 'sweat' | 'dizzy' | 'taunt' | 'blush';

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // Resume if browser auto-suspended it
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setEnabled(val: boolean): void {
    this.enabled = val;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  play(type: SoundType): void {
    if (!this.enabled) return;
    try {
      switch (type) {
        case 'jump':       return this.jump();
        case 'score':      return this.score();
        case 'hit':        return this.hit();
        case 'die':        return this.die();
        case 'menuClick':  return this.menuClick();
        case 'countdown':  return this.countdown();
        case 'start':      return this.start();
        case 'coin':       return this.coin();
        case 'bugCrunch':  return this.bugCrunch();
        case 'poopSplash': return this.poopSplash();
        case 'powerUp':    return this.powerUp();
        case 'wind':       return this.wind();
        case 'lightning':  return this.lightning();
        case 'sweat':      return this.sweat();
        case 'dizzy':      return this.dizzy();
        case 'taunt':      return this.taunt();
        case 'blush':      return this.blush();
      }
    } catch {
      // Ignore errors in unsupported environments
    }
  }

  // ── Jump: short rising chirp ─────────────────────────────
  private jump(): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(640, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  // ── Score point: short pleasant ding ────────────────────
  private score(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;

    [880, 1100].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const start = t + i * 0.06;
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  // ── Hit: percussive thud ─────────────────────────────────
  private hit(): void {
    const ctx = this.getCtx();
    const noise = this.createNoise(ctx, 0.12);
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.start(t);
    noise.stop(t + 0.12);
  }

  // ── Die: descending wail ─────────────────────────────────
  private die(): void {
    const ctx = this.getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  // ── Menu click: soft tick ────────────────────────────────
  private menuClick(): void {
    const ctx = this.getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = 520;

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // ── Countdown beep ───────────────────────────────────────
  private countdown(): void {
    const ctx = this.getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = 730;

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // ── Game start: ascending fanfare ────────────────────────
  private start(): void {
    const ctx = this.getCtx();
    const freqs = [523, 659, 784, 1046];
    const t = ctx.currentTime;

    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const start = t + i * 0.1;
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.start(start);
      osc.stop(start + 0.22);
    });
  }

  // ── Sweat: anxious rapid trill ────────────────────────
  private sweat(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    [320, 280, 350, 290].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const st = t + i * 0.045;
      gain.gain.setValueAtTime(0.06, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.06);
      osc.start(st);
      osc.stop(st + 0.06);
    });
  }

  // ── Dizzy: descending wobble after near-miss ────────────
  private dizzy(): void {
    const ctx  = this.getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(560, t);
    osc.frequency.setValueAtTime(480, t + 0.12);
    osc.frequency.setValueAtTime(540, t + 0.22);
    osc.frequency.setValueAtTime(420, t + 0.34);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.52);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    osc.start(t);
    osc.stop(t + 0.58);
  }

  // ── Taunt: cheeky raspberry fanfare ──────────────────
  private taunt(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    // Short descending "nyah nyah" pattern
    [700, 560, 700, 560, 420].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const st = t + i * 0.065;
      gain.gain.setValueAtTime(0.08, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.08);
      osc.start(st);
      osc.stop(st + 0.08);
    });
  }

  // ── Blush: soft cute ascending chime ─────────────────
  private blush(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    [880, 1100, 1320].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const st = t + i * 0.07;
      gain.gain.setValueAtTime(0.07, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.14);
      osc.start(st);
      osc.stop(st + 0.14);
    });
  }

  // ── Coin: bright ping ────────────────────────────────────
  private coin(): void {
    const ctx  = this.getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.linearRampToValueAtTime(1550, t + 0.05);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    osc.start(t);
    osc.stop(t + 0.10);
  }

  // ── Bug crunch: high-freq percussive burst ────────────────
  private bugCrunch(): void {
    const ctx    = this.getCtx();
    const noise  = this.createNoise(ctx, 0.09);
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    filter.type = 'bandpass';
    filter.frequency.value = 2800;
    filter.Q.value = 1.2;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    noise.start(t);
    noise.stop(t + 0.09);
  }

  // ── Poop splash: wet descending blob ─────────────────────
  private poopSplash(): void {
    const ctx  = this.getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.35);
    gain.gain.setValueAtTime(0.20, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // ── Power-up: rising 4-note fanfare ──────────────────────
  private powerUp(): void {
    const ctx = this.getCtx();
    const freqs = [523, 659, 784, 1046];
    const t = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = t + i * 0.065;
      gain.gain.setValueAtTime(0.10, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  // ── Wind: bandpass noise sweep ────────────────────────────
  private wind(): void {
    const ctx    = this.getCtx();
    const noise  = this.createNoise(ctx, 0.85);
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    filter.type = 'bandpass';
    const t = ctx.currentTime;
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.linearRampToValueAtTime(750, t + 0.85);
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.42);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    noise.start(t);
    noise.stop(t + 0.85);
  }

  // ── Lightning: white noise crack ──────────────────────────
  private lightning(): void {
    const ctx   = this.getCtx();
    const noise  = this.createNoise(ctx, 0.065);
    const gain   = ctx.createGain();
    noise.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
    noise.start(t);
    noise.stop(t + 0.065);
  }

  // ── Noise buffer helper ───────────────────────────────────
  private createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const sampleRate  = ctx.sampleRate;
    const frameCount  = Math.ceil(sampleRate * duration);
    const buffer      = ctx.createBuffer(1, frameCount, sampleRate);
    const data        = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  // ── Background Music (BGM) ──────────────────────────────
  //
  // Procedurally generated looping soundtrack:
  //   intensity 1 → ominous 90-BPM bass drone + kick on every beat
  //   intensity 2 → frantic 140-BPM drone + kick + snare

  private bgm: {
    droneOsc:   OscillatorNode;
    lfoOsc:     OscillatorNode;
    masterGain: GainNode;
    beatTimer:  ReturnType<typeof setInterval>;
    intensity:  1 | 2;
  } | null = null;

  /**
   * Start (or transition to) a given music intensity.
   * Safe to call repeatedly — skips restart if already at same level.
   */
  setMusicIntensity(level: 0 | 1 | 2): void {
    if (!this.enabled) return;
    if (level === 0) { this.stopBgm(); return; }
    if (this.bgm?.intensity === level) return; // already running at this level
    this.startBgm(level);
  }

  private startBgm(intensity: 1 | 2): void {
    this.stopBgm();
    try {
      const ctx = this.getCtx();
      const t   = ctx.currentTime;

      // Master gain — fade in over 1 s
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, t);
      masterGain.gain.linearRampToValueAtTime(0.13, t + 1.2);
      masterGain.connect(ctx.destination);

      // Bass drone oscillator (triangle = warmer tone)
      const droneOsc  = ctx.createOscillator();
      const droneGain = ctx.createGain();
      droneOsc.connect(droneGain);
      droneGain.connect(masterGain);
      droneOsc.type            = 'triangle';
      droneOsc.frequency.value = intensity === 1 ? 55 : 73.4; // A1 or D2
      droneGain.gain.value     = 0.65;
      droneOsc.start(t);

      // LFO — slow amplitude pulsing for eeriness
      const lfoOsc  = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfoOsc.connect(lfoGain);
      lfoGain.connect(droneGain.gain);
      lfoOsc.type            = 'sine';
      lfoOsc.frequency.value = intensity === 1 ? 0.5 : 1.3;
      lfoGain.gain.value     = 0.28;
      lfoOsc.start(t);

      // Scheduled beat pattern
      const bpm        = intensity === 1 ? 90 : 140;
      const intervalMs = Math.round((60 / bpm) * 1000);
      let   beatCount  = 0;

      const beatTimer = setInterval(() => {
        if (!this.enabled || !this.bgm) return;
        try {
          const now = this.ctx!.currentTime;
          if (beatCount % 4 === 0)               this._kick(now, intensity);
          if (beatCount % 4 === 2 && intensity === 2) this._snare(now);
          if (beatCount % 8 === 4)               this._hihat(now);
        } catch { /* ignore if ctx closed */ }
        beatCount++;
      }, intervalMs);

      this.bgm = { droneOsc, lfoOsc, masterGain, beatTimer, intensity };
    } catch { /* unsupported environment */ }
  }

  stopBgm(): void {
    if (!this.bgm) return;
    try {
      const ctx = this.getCtx();
      const t   = ctx.currentTime;
      this.bgm.masterGain.gain.linearRampToValueAtTime(0.001, t + 0.4);
      clearInterval(this.bgm.beatTimer);
      const { droneOsc, lfoOsc } = this.bgm;
      setTimeout(() => {
        try { droneOsc.stop(); } catch { /* already stopped */ }
        try { lfoOsc.stop();   } catch { /* already stopped */ }
      }, 450);
    } catch { /**/ }
    this.bgm = null;
  }

  private _kick(t: number, intensity: 1 | 2): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env); env.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(intensity === 1 ? 72 : 95, t);
    osc.frequency.exponentialRampToValueAtTime(1, t + 0.22);
    env.gain.setValueAtTime(0.38, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.start(t); osc.stop(t + 0.22);
  }

  private _snare(t: number): void {
    const ctx    = this.getCtx();
    const noise  = this.createNoise(ctx, 0.09);
    const filter = ctx.createBiquadFilter();
    const env    = ctx.createGain();
    noise.connect(filter); filter.connect(env); env.connect(ctx.destination);
    filter.type          = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value         = 0.6;
    env.gain.setValueAtTime(0.22, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    noise.start(t); noise.stop(t + 0.09);
  }

  private _hihat(t: number): void {
    const ctx   = this.getCtx();
    const noise = this.createNoise(ctx, 0.04);
    const filt  = ctx.createBiquadFilter();
    const env   = ctx.createGain();
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    filt.type = 'highpass'; filt.frequency.value = 8000;
    env.gain.setValueAtTime(0.08, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    noise.start(t); noise.stop(t + 0.04);
  }
}

// Singleton export
const soundManager = new SoundManager();
export default soundManager;
export type { SoundType };
