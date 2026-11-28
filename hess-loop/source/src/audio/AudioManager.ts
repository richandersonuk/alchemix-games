import type { SettingsStore } from '../settings.ts';

const CHORDS: Array<{ root: number; notes: number[] }> = [
  { root: 110.0, notes: [164.81, 220.0, 246.94, 329.63] }, // Am9
  { root: 87.31, notes: [174.61, 220.0, 261.63, 329.63] }, // Fmaj7
  { root: 130.81, notes: [196.0, 246.94, 293.66, 329.63] }, // Cmaj9
  { root: 98.0, notes: [146.83, 196.0, 246.94, 293.66] }, // G6
];

const BEAT_SEC = 0.8;
const BAR_SEC = BEAT_SEC * 4;

/**
 * Web Audio engine providing independent SFX & ambient laboratory switchboard BGM buses.
 */
export class AudioManager {
  private settings: SettingsStore;
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private timerId: number | null = null;
  private nextBarTime = 0;
  private barIdx = 0;
  private bgmRunning = false;

  constructor(settings: SettingsStore) {
    this.settings = settings;
    settings.onChange((s) => {
      this.applyVolumes(s.bgmVolume, s.sfxVolume);
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          void this.ctx.suspend();
        } else {
          void this.ctx.resume();
        }
      });
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      this.ctx = new AudioCtor();

      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmBus = this.ctx.createGain();

      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = BEAT_SEC * 0.75;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.28;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.34;

      delay.connect(fb);
      fb.connect(delay);
      this.bgmBus.connect(this.bgmGain);
      this.bgmBus.connect(delay);
      delay.connect(wet);
      wet.connect(this.bgmGain);

      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);

      this.applyVolumes(this.settings.values.bgmVolume, this.settings.values.sfxVolume);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private applyVolumes(bgmVolume: number, sfxVolume: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bgmGain?.gain.setTargetAtTime(clamp01(bgmVolume) * 0.6, t, 0.03);
    this.sfxGain?.gain.setTargetAtTime(clamp01(sfxVolume), t, 0.02);
  }

  startBgm(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.bgmRunning) return;
    this.bgmRunning = true;
    this.nextBarTime = ctx.currentTime + 0.1;
    this.barIdx = 0;
    this.pump();
    this.timerId = window.setInterval(() => this.pump(), 450);
  }

  stopBgm(): void {
    this.bgmRunning = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private pump(): void {
    if (!this.ctx || !this.bgmRunning) return;
    while (this.nextBarTime < this.ctx.currentTime + 2.4) {
      this.scheduleBar(this.nextBarTime, this.barIdx);
      this.nextBarTime += BAR_SEC;
      this.barIdx += 1;
    }
  }

  private scheduleBar(t0: number, idx: number): void {
    if (!this.ctx || !this.bgmBus) return;
    const ctx = this.ctx;
    const bus = this.bgmBus;
    const chord = CHORDS[idx % CHORDS.length];

    // Warm low-pass pad chord
    for (const freq of chord.notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 880;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.022, t0 + 0.85);
      gain.gain.linearRampToValueAtTime(0.0001, t0 + BAR_SEC + 0.35);
      osc.connect(lp).connect(gain).connect(bus);
      osc.start(t0);
      osc.stop(t0 + BAR_SEC + 0.4);
    }

    // Soft sub-bass root pulse
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = chord.root;
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.linearRampToValueAtTime(0.055, t0 + 0.08);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + BAR_SEC * 0.92);
    bass.connect(bg).connect(bus);
    bass.start(t0);
    bass.stop(t0 + BAR_SEC);

    // Subtle crystalline pulse arpeggio
    const pattern = [0, 2, 1, 3, 2, 0, 3, 1];
    for (let i = 0; i < 8; i++) {
      if ((idx + i) % 3 === 0) continue;
      const note = chord.notes[pattern[i] % chord.notes.length] * 2;
      const t = t0 + i * (BEAT_SEC / 2);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = note;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.028, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.54);
    }
  }

  private canPlaySfx(): boolean {
    return this.settings.values.sfxVolume > 0.005;
  }

  playClick(): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.055);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playWireLatch(): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.075);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playFlipClick(): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.045);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playStoichTick(multiplier: number): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 + multiplier * 75, now);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playFaultBuzz(): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.linearRampToValueAtTime(115, now + 0.22);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playEnergise(exothermic: boolean): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const freqs = exothermic ? [261.6, 329.6, 392.0, 523.3] : [523.3, 659.3, 784.0, 1046.5];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = exothermic ? 'triangle' : 'sine';
      const t0 = now + idx * 0.055;
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.09, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}
