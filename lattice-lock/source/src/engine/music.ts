import { getAudioContext, onAudioUnlock } from './audioContext';
import { settings } from './settings';

// ─────────────────────────────────────────────────────────────────────────────
// Generative "crystalline" soundtrack — synthesised live, no audio files.
//
//  • Pads   : detuned saw voices through a breathing low-pass, long envelopes
//  • Arp    : glassy FM bells (2.0 / 3.5 ratio) with ping-pong dotted-8th delay
//  • Bass   : sub sine + filtered saw pulse (combat)
//  • Drums  : synthesised kick / clap / hats (combat), soft shaker (build)
//  • Space  : generated stereo convolution reverb
//
// Moods crossfade per layer, so moving from build → combat feels continuous.
// Progression: Dm9 – B♭maj7 – Fmaj7 – C(add9), two bars each at 92 BPM.
// ─────────────────────────────────────────────────────────────────────────────

export type Mood = 'off' | 'menu' | 'build' | 'combat' | 'victory' | 'defeat';

const BPM = 92;
const STEP = 60 / BPM / 4; // 16th note
const STEPS_PER_CHORD = 32; // 2 bars

interface Chord {
  pad: number[];
  arp: number[];
  bass: number;
}

const CHORDS: Chord[] = [
  { pad: [50, 57, 60, 64, 65], arp: [62, 65, 69, 72, 74, 76], bass: 38 }, // Dm9
  { pad: [46, 53, 57, 62, 65], arp: [58, 62, 65, 69, 70, 74], bass: 34 }, // B♭maj7
  { pad: [41, 53, 57, 60, 64], arp: [60, 65, 69, 72, 76, 77], bass: 41 }, // Fmaj7
  { pad: [48, 55, 60, 62, 64], arp: [60, 62, 64, 67, 72, 74], bass: 36 }, // C(add9)
];
// Victory lifts to the relative major; defeat sinks to a dark drone.
const VICTORY: Chord[] = [
  { pad: [53, 57, 60, 64, 67], arp: [65, 69, 72, 76, 79, 81], bass: 41 },
  { pad: [48, 55, 60, 64, 67], arp: [60, 64, 67, 72, 76, 79], bass: 36 },
];
const DEFEAT: Chord[] = [
  { pad: [38, 45, 50, 53], arp: [62, 65, 69], bass: 26 },
  { pad: [34, 46, 50, 53], arp: [58, 62, 65], bass: 22 },
];

type Layer = 'pad' | 'arp' | 'bass' | 'drums';

const MOODS: Record<Exclude<Mood, 'off'>, { gains: Record<Layer, number>; arpDensity: number; padCutoff: number; chords: Chord[] }> = {
  menu: { gains: { pad: 0.85, arp: 0.5, bass: 0, drums: 0 }, arpDensity: 0.38, padCutoff: 900, chords: CHORDS },
  build: { gains: { pad: 0.7, arp: 0.62, bass: 0.3, drums: 0.22 }, arpDensity: 0.55, padCutoff: 1200, chords: CHORDS },
  combat: { gains: { pad: 0.5, arp: 0.72, bass: 0.9, drums: 0.85 }, arpDensity: 0.85, padCutoff: 1900, chords: CHORDS },
  victory: { gains: { pad: 0.9, arp: 0.75, bass: 0.25, drums: 0 }, arpDensity: 0.7, padCutoff: 2200, chords: VICTORY },
  defeat: { gains: { pad: 0.75, arp: 0.2, bass: 0.4, drums: 0 }, arpDensity: 0.15, padCutoff: 600, chords: DEFEAT },
};

const ARP_PATTERN = [0, 2, 4, 1, 3, 5, 4, 2, 0, 3, 5, 2, 4, 1, 3, 5];
const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class MusicEngine {
  private ctx: AudioContext | null = null;
  private bus!: GainNode;
  private layers!: Record<Layer, GainNode>;
  private reverbSend!: GainNode;
  private delaySend!: GainNode;
  private padFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private chordIdx = 0;
  private mood: Mood = 'off';
  private wanted: Mood = 'off';

  constructor() {
    onAudioUnlock(() => this.apply());
    settings.subscribe(() => this.applyVolume());
  }

  setMood(m: Mood) {
    this.wanted = m;
    this.apply();
  }

  private apply() {
    const m = this.wanted;
    if (m === 'off') {
      this.fadeOut();
      return;
    }
    const c = getAudioContext();
    if (!c || c.state === 'closed') return;
    if (!this.ctx) this.build(c);
    const prev = this.mood;
    this.mood = m;
    const spec = MOODS[m];
    const t = c.currentTime;
    (Object.keys(this.layers) as Layer[]).forEach((l) => this.layers[l].gain.setTargetAtTime(spec.gains[l], t, 1.2));
    this.padFilter.frequency.setTargetAtTime(spec.padCutoff, t, 2);
    if (prev !== m && (m === 'victory' || m === 'defeat' || prev === 'victory' || prev === 'defeat')) {
      this.step = 0;
      this.chordIdx = 0;
    }
    this.applyVolume();
    if (this.timer === null) {
      this.nextTime = c.currentTime + 0.1;
      this.timer = window.setInterval(() => this.tick(), 25);
    }
  }

  private fadeOut() {
    if (!this.ctx) return;
    this.mood = 'off';
    this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    window.setTimeout(() => {
      if (this.mood === 'off' && this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }, 2500);
  }

  private applyVolume() {
    if (!this.ctx || this.mood === 'off') return;
    const { bgmVolume, muted } = settings.value;
    this.bus.gain.setTargetAtTime(muted ? 0 : bgmVolume * bgmVolume * 0.55, this.ctx.currentTime, 0.15);
  }

  // ── Graph ────────────────────────────────────────────────────────────────

  private build(c: AudioContext) {
    this.ctx = c;
    this.bus = c.createGain();
    this.bus.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.bus.connect(comp).connect(c.destination);

    // Reverb
    const conv = c.createConvolver();
    conv.buffer = this.impulse(c, 3.4, 2.4);
    const wet = c.createGain();
    wet.gain.value = 0.5;
    this.reverbSend = c.createGain();
    this.reverbSend.connect(conv).connect(wet).connect(this.bus);

    // Ping-pong dotted-eighth delay
    const dt = STEP * 3;
    const dl = c.createDelay(2);
    const dr = c.createDelay(2);
    dl.delayTime.value = dt;
    dr.delayTime.value = dt;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    const merger = c.createChannelMerger(2);
    this.delaySend = c.createGain();
    this.delaySend.connect(dl);
    dl.connect(tone).connect(dr);
    dr.connect(fb).connect(dl);
    dl.connect(merger, 0, 0);
    dr.connect(merger, 0, 1);
    const delayOut = c.createGain();
    delayOut.gain.value = 0.45;
    merger.connect(delayOut);
    delayOut.connect(this.bus);
    delayOut.connect(this.reverbSend);

    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padFilter.Q.value = 0.7;
    // Slow "breathing" LFO on pad cutoff
    const lfo = c.createOscillator();
    const lfoAmt = c.createGain();
    lfo.frequency.value = 0.07;
    lfoAmt.gain.value = 380;
    lfo.connect(lfoAmt).connect(this.padFilter.frequency);
    lfo.start();

    const mk = () => {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(this.bus);
      return g;
    };
    this.layers = { pad: mk(), arp: mk(), bass: mk(), drums: mk() };
    this.padFilter.connect(this.layers.pad);
    const padSend = c.createGain();
    padSend.gain.value = 0.7;
    this.layers.pad.connect(padSend).connect(this.reverbSend);
    const arpSend = c.createGain();
    arpSend.gain.value = 0.55;
    this.layers.arp.connect(arpSend).connect(this.reverbSend);
    const arpDelay = c.createGain();
    arpDelay.gain.value = 0.6;
    this.layers.arp.connect(arpDelay).connect(this.delaySend);
    const drumSend = c.createGain();
    drumSend.gain.value = 0.12;
    this.layers.drums.connect(drumSend).connect(this.reverbSend);

    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(c: AudioContext, seconds: number, decay: number) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ── Scheduler ────────────────────────────────────────────────────────────

  private tick() {
    const c = this.ctx;
    if (!c || this.mood === 'off' || c.state !== 'running') return;
    if (this.nextTime < c.currentTime - 0.25) this.nextTime = c.currentTime + 0.05; // resumed from background
    while (this.nextTime < c.currentTime + 0.15) {
      this.schedule(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step++;
    }
  }

  private schedule(step: number, t: number) {
    const mood = this.mood;
    if (mood === 'off') return;
    const spec = MOODS[mood];
    const chords = spec.chords;
    const inChord = step % STEPS_PER_CHORD;
    if (inChord === 0) {
      this.chordIdx = Math.floor(step / STEPS_PER_CHORD) % chords.length;
      this.pad(chords[this.chordIdx], t, STEPS_PER_CHORD * STEP);
    }
    const chord = chords[this.chordIdx] ?? chords[0];
    const s16 = step % 16;

    // Arpeggio
    if (spec.gains.arp > 0.01) {
      const strong = s16 % 4 === 0;
      if (strong || Math.random() < spec.arpDensity * (s16 % 2 === 0 ? 1 : 0.55)) {
        const idx = ARP_PATTERN[(step + this.chordIdx * 3) % ARP_PATTERN.length] % chord.arp.length;
        const oct = Math.random() < 0.18 ? 12 : 0;
        const vel = strong ? 0.22 : 0.12 + Math.random() * 0.06;
        this.bell(mtof(chord.arp[idx] + oct), t, vel, (step % 2) * 2 - 1);
      }
    }

    // Bass
    if (spec.gains.bass > 0.01) {
      if (mood === 'combat') {
        const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
        if (pat[s16]) this.bass(mtof(chord.bass + (s16 === 11 ? 12 : 0)), t, STEP * 2.2, 0.32);
      } else if (inChord % 16 === 0) {
        this.bass(mtof(chord.bass), t, STEP * 14, 0.25);
      }
    }

    // Drums
    if (spec.gains.drums > 0.01) {
      if (mood === 'combat') {
        if (s16 === 0 || s16 === 8 || (s16 === 10 && step % 32 >= 16)) this.kick(t);
        if (s16 === 4 || s16 === 12) this.clap(t);
        if (s16 % 2 === 0) this.hat(t, s16 % 4 === 2 ? 0.16 : 0.07, 0.04);
        else if (Math.random() < 0.4) this.hat(t, 0.045, 0.025);
      } else if (s16 % 4 === 2) {
        this.hat(t, 0.05, 0.08);
      }
    }
  }

  // ── Voices ───────────────────────────────────────────────────────────────

  private pad(ch: Chord, t: number, dur: number) {
    const c = this.ctx!;
    const attack = 1.6;
    const release = 2.4;
    for (const n of ch.pad) {
      const f = mtof(n);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + attack);
      g.gain.setValueAtTime(0.05, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
      g.connect(this.padFilter);
      for (const det of [-9, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det + (Math.random() - 0.5) * 4;
        o.connect(g);
        o.start(t);
        o.stop(t + dur + release + 0.1);
      }
      const sub = c.createOscillator();
      sub.type = 'triangle';
      sub.frequency.value = f / 2;
      const sg = c.createGain();
      sg.gain.value = 0.5;
      sub.connect(sg).connect(g);
      sub.start(t);
      sub.stop(t + dur + release + 0.1);
    }
  }

  private bell(f: number, t: number, vel: number, pan: number) {
    const c = this.ctx!;
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const modGain = c.createGain();
    const amp = c.createGain();
    const p = c.createStereoPanner();
    car.type = 'sine';
    mod.type = 'sine';
    car.frequency.value = f;
    mod.frequency.value = f * (Math.random() < 0.5 ? 2 : 3.5);
    modGain.gain.setValueAtTime(f * 1.6, t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vel, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    p.pan.value = pan * 0.45;
    mod.connect(modGain).connect(car.frequency);
    car.connect(amp).connect(p).connect(this.layers.arp);
    car.start(t);
    mod.start(t);
    car.stop(t + 1.5);
    mod.stop(t + 1.5);
  }

  private bass(f: number, t: number, dur: number, vel: number) {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vel * 0.6, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.layers.bass);
    const sine = c.createOscillator();
    sine.frequency.value = f;
    sine.connect(g);
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + dur * 0.8);
    const sg = c.createGain();
    sg.gain.value = 0.35;
    saw.connect(lp).connect(sg).connect(g);
    for (const o of [sine, saw]) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private kick(t: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(this.layers.drums);
    o.start(t);
    o.stop(t + 0.4);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, vel: number, dur: number, pan = 0) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    s.connect(f).connect(g).connect(p).connect(this.layers.drums);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.02);
  }

  private clap(t: number) {
    for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.011, 'bandpass', 1500, 1.2, 0.35, 0.05 + (i === 2 ? 0.16 : 0));
  }

  private hat(t: number, vel: number, dur: number) {
    this.noiseHit(t, 'highpass', 8000, 0.7, vel, dur, (Math.random() - 0.5) * 0.6);
  }
}

export const music = new MusicEngine();
