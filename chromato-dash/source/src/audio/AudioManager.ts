import { SettingsStore } from '../settings';

export type SfxKind =
  | 'click'
  | 'pour'
  | 'hit'
  | 'miss'
  | 'hazard'
  | 'burst'
  | 'uv'
  | 'solvent'
  | 'complete'
  | 'fail';

const CHORDS: Array<{ root: number; notes: number[] }> = [
  { root: 130.81, notes: [196.0, 246.94, 293.66, 329.63] }, // Cmaj9
  { root: 110.0, notes: [164.81, 196.0, 246.94, 293.66] }, // Am9
  { root: 87.31, notes: [174.61, 220.0, 261.63, 329.63] }, // Fmaj7
  { root: 98.0, notes: [146.83, 196.0, 246.94, 293.66] }, // G6
];

const BEAT_SEC = 0.75; // 80 BPM gentle laboratory groove
const BAR_SEC = BEAT_SEC * 4;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private timerId: number | null = null;
  private nextBarTime = 0;
  private barIdx = 0;
  private bgmRunning = false;

  constructor(private settings: SettingsStore) {
    settings.onChange((s) => {
      this.applyVolumes(s.masterVolume, s.bgmVolume, s.sfxVolume);
    });

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.ctx.suspend().catch(() => {});
      } else {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();

      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmBus = this.ctx.createGain();

      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = BEAT_SEC * 0.75;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.3;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.35;

      delay.connect(fb);
      fb.connect(delay);
      this.bgmBus.connect(this.bgmGain);
      this.bgmBus.connect(delay);
      delay.connect(wet);
      wet.connect(this.bgmGain);

      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);

      const v = this.settings.values;
      this.applyVolumes(v.masterVolume, v.bgmVolume, v.sfxVolume);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private applyVolumes(master: number, bgm: number, sfx: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bgmGain?.gain.setTargetAtTime(master * bgm * 0.65, t, 0.03);
    this.sfxGain?.gain.setTargetAtTime(master * sfx, t, 0.02);
  }

  public startBgm(): void {
    const ctx = this.ensure();
    if (!ctx || this.bgmRunning) return;
    this.bgmRunning = true;
    this.nextBarTime = ctx.currentTime + 0.12;
    this.barIdx = 0;
    this.pump();
    this.timerId = window.setInterval(() => this.pump(), 400);
  }

  public stopBgm(): void {
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
    const ctx = this.ctx!;
    const bus = this.bgmBus!;
    const chord = CHORDS[idx % CHORDS.length];

    // Warm translucent pad
    for (const freq of chord.notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 950;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.024, t0 + 0.9);
      gain.gain.linearRampToValueAtTime(0.0001, t0 + BAR_SEC + 0.4);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(bus);
      osc.start(t0);
      osc.stop(t0 + BAR_SEC + 0.45);
    }

    // Soft pulse bass
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = chord.root;
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.linearRampToValueAtTime(0.06, t0 + 0.08);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + BAR_SEC * 0.92);
    bass.connect(bg);
    bg.connect(bus);
    bass.start(t0);
    bass.stop(t0 + BAR_SEC);

    // Subtle glass marimba pluck pattern
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
      g.gain.linearRampToValueAtTime(0.032, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 0.55);
    }
  }

  public play(kind: SfxKind): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    if (this.settings.values.masterVolume <= 0 || this.settings.values.sfxVolume <= 0) {
      return;
    }

    const now = ctx.currentTime;
    const tone = (
      type: OscillatorType,
      f1: number,
      f2: number,
      dur: number,
      vol = 0.14,
      delay = 0,
    ): void => {
      const t = now + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f1, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };

    switch (kind) {
      case 'click':
        tone('sine', 640, 480, 0.06, 0.08);
        break;
      case 'pour':
        tone('sine', 340, 520, 0.12, 0.1);
        break;
      case 'hit':
        tone('sine', 523.25, 783.99, 0.14, 0.16);
        tone('triangle', 783.99, 1046.5, 0.16, 0.12, 0.07);
        break;
      case 'miss':
      case 'hazard':
        tone('triangle', 240, 130, 0.18, 0.14);
        break;
      case 'fail':
        tone('sawtooth', 210, 95, 0.25, 0.11);
        tone('triangle', 165, 80, 0.28, 0.12, 0.12);
        break;
      case 'burst':
        tone('sine', 440, 920, 0.14, 0.12);
        break;
      case 'uv':
        tone('sine', 880, 1180, 0.13, 0.11);
        break;
      case 'solvent':
        tone('triangle', 520, 390, 0.13, 0.11);
        tone('sine', 390, 620, 0.13, 0.1, 0.06);
        break;
      case 'complete':
        tone('sine', 523.25, 659.25, 0.16, 0.14, 0);
        tone('sine', 659.25, 783.99, 0.16, 0.14, 0.09);
        tone('sine', 783.99, 1046.5, 0.24, 0.16, 0.18);
        break;
    }
  }
}
