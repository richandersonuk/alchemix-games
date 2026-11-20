import type { SfxName } from '../types/chemistry';
import { getAudioContext, getMasterBus } from './audioContext';
import { settings } from './settings';

// ─────────────────────────────────────────────────────────────────────────────
// Fully synthesised Web Audio sound effects — no asset files.
// ─────────────────────────────────────────────────────────────────────────────

const THROTTLE_MS: Partial<Record<SfxName, number>> = { core: 220, pop: 60, hum: 140, hiss: 140, splash: 140 };

class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last: Partial<Record<SfxName, number>> = {};

  private ensure() {
    const c = getAudioContext();
    if (!c) return null;
    if (!this.ctx) {
      this.ctx = c;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp).connect(getMasterBus(c));
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
      settings.subscribe(() => this.applyVolume());
    }
    if (c.state === 'suspended' && !document.hidden) void c.resume();
    return c;
  }

  private applyVolume() {
    if (!this.master || !this.ctx) return;
    const { sfxVolume, muted } = settings.value;
    this.master.gain.setTargetAtTime(muted ? 0 : sfxVolume * sfxVolume * 0.6, this.ctx.currentTime, 0.02);
  }

  play(name: SfxName) {
    const { muted, sfxVolume } = settings.value;
    if (muted || sfxVolume <= 0.001) return;
    const now = performance.now();
    const gap = THROTTLE_MS[name] ?? 80;
    if (now - (this.last[name] ?? 0) < gap) return;
    this.last[name] = now;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'crack':
        this.noiseBurst(t, 0.12, 'highpass', 2500, 0.7);
        this.noiseBurst(t + 0.035, 0.08, 'highpass', 4000, 0.4);
        this.tone(t, 'sine', 3400, 1500, 0.18, 0.18);
        this.tone(t + 0.02, 'triangle', 5200, 2600, 0.12, 0.1);
        break;
      case 'clang':
        [1, 2.76, 5.4, 8.93].forEach((m, i) => this.tone(t, i % 2 ? 'sine' : 'triangle', 300 * m, 300 * m * 0.995, 0.9 / (i + 1), 0.16 / (i + 1)));
        this.noiseBurst(t, 0.03, 'bandpass', 3000, 0.3);
        break;
      case 'hum': {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc2.type = 'square';
        osc.frequency.value = 100;
        osc2.frequency.value = 50.5;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2400, t);
        f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        osc.connect(f);
        osc2.connect(f);
        f.connect(g).connect(this.master);
        osc.start(t);
        osc2.start(t);
        osc.stop(t + 0.35);
        osc2.stop(t + 0.35);
        this.noiseBurst(t, 0.05, 'bandpass', 6000, 0.35);
        break;
      }
      case 'hiss':
        this.noiseBurst(t, 0.45, 'bandpass', 5200, 0.22, 0.04);
        break;
      case 'splash':
        this.noiseBurst(t, 0.3, 'lowpass', 1400, 0.3, 0.01);
        for (let i = 0; i < 3; i++) {
          const st = t + 0.04 + Math.random() * 0.15;
          const f0 = 500 + Math.random() * 600;
          this.tone(st, 'sine', f0, f0 * 1.9, 0.06, 0.08);
        }
        break;
      case 'thud':
        this.tone(t, 'sine', 180, 60, 0.18, 0.25);
        this.noiseBurst(t, 0.05, 'lowpass', 800, 0.2);
        break;
      case 'place':
        this.tone(t, 'sine', 660, 990, 0.12, 0.15);
        this.tone(t + 0.06, 'triangle', 1320, 1320, 0.15, 0.06);
        break;
      case 'clear':
        // Rising major fanfare + glassy shimmer
        [587, 740, 880, 1175].forEach((f, i) => this.tone(t + i * 0.09, 'triangle', f, f, 0.5, 0.13));
        [1760, 2349, 2960].forEach((f, i) => this.tone(t + 0.38 + i * 0.05, 'sine', f, f * 1.01, 0.9, 0.05));
        this.noiseBurst(t + 0.36, 0.6, 'highpass', 7000, 0.05, 0.05);
        break;
      case 'upgrade':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.07, 'triangle', f, f, 0.22, 0.12));
        break;
      case 'sell':
        this.tone(t, 'triangle', 880, 440, 0.18, 0.12);
        break;
      case 'pop':
        this.tone(t, 'sine', 900, 1500, 0.06, 0.07);
        break;
      case 'core':
        this.tone(t, 'sine', 90, 35, 0.5, 0.5);
        this.noiseBurst(t, 0.25, 'lowpass', 500, 0.5);
        break;
      case 'wave':
        this.tone(t, 'sawtooth', 55, 110, 1.1, 0.12, 0.4);
        this.tone(t, 'sine', 110, 220, 1.1, 0.15, 0.4);
        break;
      case 'deny':
        this.tone(t, 'square', 160, 120, 0.15, 0.08);
        break;
      case 'victory':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.12, 'triangle', f, f, 0.8, 0.12));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.18, 'sawtooth', f, f * 0.97, 0.5, 0.08));
        break;
    }
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, vol: number, attack = 0.002) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
}

export const sfx = new SoundBoard();
