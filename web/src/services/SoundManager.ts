/**
 * SoundManager — Procedural Web Audio API sound effects.
 * No audio files required. All sounds are synthesised at runtime.
 */

type SoundType = 'jump' | 'score' | 'hit' | 'die' | 'menuClick' | 'countdown' | 'start';

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
        case 'jump':      return this.jump();
        case 'score':     return this.score();
        case 'hit':       return this.hit();
        case 'die':       return this.die();
        case 'menuClick': return this.menuClick();
        case 'countdown': return this.countdown();
        case 'start':     return this.start();
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
}

// Singleton export
const soundManager = new SoundManager();
export default soundManager;
export type { SoundType };
