import { SettingsStore } from '../settings';

export type SfxKind =
  | 'click'
  | 'place'
  | 'rotate'
  | 'remove'
  | 'pulse'
  | 'inject'
  | 'filter'
  | 'fizz'
  | 'flame'
  | 'rupture'
  | 'win'
  | 'fail';

// Chord progression (Am9 - Fmaj7 - Cmaj7 - Gadd9), notes in Hz
const CHORDS: Array<{ root: number; notes: number[] }> = [
  { root: 110.0, notes: [164.81, 196.0, 246.94, 261.63] },
  { root: 87.31, notes: [130.81, 164.81, 220.0, 261.63] },
  { root: 130.81, notes: [196.0, 246.94, 329.63, 392.0] },
  { root: 98.0, notes: [146.83, 220.0, 246.94, 293.66] },
];

const BEAT = 0.8; // seconds (75 bpm)
const BAR = BEAT * 4;

/**
 * Procedural audio: an ambient generative "laboratory" background loop
 * plus short synthesised sound effects. No audio files are required.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private timer: number | null = null;
  private nextBarTime = 0;
  private barIdx = 0;
  private bgmRunning = false;

  constructor(private settings: SettingsStore) {
    settings.onChange((s) => {
      this.applyVolumes(s.bgmVolume, s.sfxVolume);
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

  private applyVolumes(bgm: number, sfx: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bgmGain?.gain.setTargetAtTime(bgm * 0.7, t, 0.03);
    this.sfxGain?.gain.setTargetAtTime(sfx, t, 0.03);
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();

      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmBus = this.ctx.createGain();

      // Simple feedback delay for a roomy, ambient feel
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = BEAT * 0.75;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.38;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.45;
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
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Must be called from a user gesture the first time. */
  public startBgm(): void {
    const ctx = this.ensure();
    if (!ctx || this.bgmRunning) return;
    this.bgmRunning = true;
    this.nextBarTime = ctx.currentTime + 0.15;
    this.barIdx = 0;
    this.pump();
    this.timer = window.setInterval(() => this.pump(), 400);
  }

  public stopBgm(): void {
    this.bgmRunning = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pump(): void {
    if (!this.ctx || !this.bgmRunning) return;
    while (this.nextBarTime < this.ctx.currentTime + 2.5) {
      this.scheduleBar(this.nextBarTime, this.barIdx);
      this.nextBarTime += BAR;
      this.barIdx += 1;
    }
  }

  private scheduleBar(t0: number, idx: number): void {
    const ctx = this.ctx!;
    const bus = this.bgmBus!;
    const chord = CHORDS[idx % CHORDS.length];

    // Pad: two detuned triangle oscillators per note through a low-pass filter
    for (const f of chord.notes) {
      for (const det of [-6, 6]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.detune.value = det;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.022, t0 + 1.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + BAR + 1.0);
        osc.connect(lp);
        lp.connect(g);
        g.connect(bus);
        osc.start(t0);
        osc.stop(t0 + BAR + 1.1);
      }
    }

    // Bass note
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = chord.root;
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.linearRampToValueAtTime(0.07, t0 + 0.08);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + BAR * 0.95);
    bass.connect(bg);
    bg.connect(bus);
    bass.start(t0);
    bass.stop(t0 + BAR);

    // Soft plucked arpeggio (eighth notes) with random gaps
    const arpNotes = [...chord.notes, ...chord.notes.map((n) => n * 2)];
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.28) continue;
      const f = arpNotes[Math.floor(Math.random() * arpNotes.length)];
      const t = t0 + i * (BEAT / 2);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 0.75);
    }
  }

  public play(kind: SfxKind): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    if (this.settings.values.sfxVolume <= 0.001) return;
    const now = ctx.currentTime;
    const out = this.sfxGain;

    const tone = (
      freq: number,
      endFreq: number,
      dur: number,
      type: OscillatorType = 'sine',
      gainVal = 0.08,
      delay = 0
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + delay + dur);
      gain.gain.setValueAtTime(gainVal, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };

    switch (kind) {
      case 'click':
        tone(700, 520, 0.05, 'triangle', 0.07);
        break;
      case 'place':
        tone(520, 780, 0.07, 'triangle', 0.07);
        break;
      case 'rotate':
        tone(640, 720, 0.05, 'sine', 0.05);
        break;
      case 'remove':
        tone(420, 240, 0.08, 'triangle', 0.06);
        break;
      case 'pulse':
        tone(220, 340, 0.14, 'sine', 0.07);
        break;
      case 'inject':
        tone(880, 520, 0.09, 'sine', 0.06);
        break;
      case 'filter':
        tone(380, 620, 0.11, 'triangle', 0.06);
        break;
      case 'fizz':
        tone(1100, 1650, 0.12, 'sawtooth', 0.03);
        break;
      case 'flame':
        tone(180, 110, 0.18, 'sawtooth', 0.045);
        break;
      case 'rupture':
        tone(190, 65, 0.35, 'sawtooth', 0.12);
        break;
      case 'fail':
        tone(310, 220, 0.18, 'triangle', 0.09, 0);
        tone(220, 155, 0.25, 'triangle', 0.09, 0.16);
        break;
      case 'win':
        tone(523.25, 523.25, 0.16, 'triangle', 0.09, 0);
        tone(659.25, 659.25, 0.16, 'triangle', 0.09, 0.11);
        tone(783.99, 783.99, 0.22, 'triangle', 0.1, 0.22);
        tone(1046.5, 1046.5, 0.36, 'triangle', 0.11, 0.34);
        break;
    }
  }
}
