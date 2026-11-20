import { getAudioContext, getMasterBus, onAudioUnlock } from './audioContext';
import { settings } from './settings';

// ─────────────────────────────────────────────────────────────────────────────
// Background music — streamed audio files.
//
// Tracks are streamed through <audio> elements (decoded by the browser's media
// pipeline, off the main thread), so 3D-rendering stalls can't make the music
// stutter or crackle, and phones don't hold ~100 MB of decoded PCM in memory.
// Each element is routed into Web Audio for volume, filtering and crossfades
// (element.volume is read-only on iOS).
//
//  • Two players per track ping-pong with a 4 s equal-power crossfade at the
//    loop point, so loops never gap or hard-cut.
//  • Moods crossfade between the "build" and "combat" tracks; menu and defeat
//    use a low-pass "underwater" version of the build track.
// ─────────────────────────────────────────────────────────────────────────────

export type Mood = 'off' | 'menu' | 'build' | 'combat' | 'victory' | 'defeat';

type TrackId = 'build' | 'combat';

const TRACK_URL: Record<TrackId, string> = {
  build: `${import.meta.env.BASE_URL}audio/bgm-build.mp3`,
  combat: `${import.meta.env.BASE_URL}audio/bgm-combat.mp3`,
};

const MOODS: Record<Exclude<Mood, 'off'>, { track: TrackId; cutoff: number; level: number }> = {
  menu: { track: 'build', cutoff: 2200, level: 0.85 },
  build: { track: 'build', cutoff: 20000, level: 1 },
  combat: { track: 'combat', cutoff: 20000, level: 1 },
  victory: { track: 'build', cutoff: 20000, level: 1 },
  defeat: { track: 'build', cutoff: 650, level: 0.8 },
};

const LOOP_XFADE = 4; // seconds
const MOOD_XFADE = 1.6; // seconds

interface Voice {
  el: HTMLAudioElement;
  gain: GainNode;
}

interface Track {
  id: TrackId;
  voices: [Voice, Voice];
  active: 0 | 1;
  out: GainNode;
  playing: boolean;
  crossfading: boolean;
}

class MusicPlayer {
  private ctx: AudioContext | null = null;
  private bus!: GainNode;
  private filter!: BiquadFilterNode;
  private tracks!: Record<TrackId, Track>;
  private mood: Mood = 'off';
  private wanted: Mood = 'off';
  private unlocked = false;
  private stopTimers: Partial<Record<TrackId, number>> = {};

  constructor() {
    onAudioUnlock(() => {
      this.unlocked = true;
      this.prime();
      this.apply();
    });
    settings.subscribe(() => this.applyVolume());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.tracks) return;
        if (document.hidden) this.eachVoice((v) => v.el.pause());
        else this.resumeAudible();
      });
    }
  }

  setMood(m: Mood) {
    this.wanted = m;
    this.apply();
  }

  /** Debug snapshot (window.__music in dev). */
  get state() {
    if (!this.tracks) return { mood: this.mood, ready: false };
    const t = (x: Track) => ({
      playing: x.playing,
      active: x.active,
      level: +x.out.gain.value.toFixed(2),
      voices: x.voices.map((v) => ({ paused: v.el.paused, time: +v.el.currentTime.toFixed(1), gain: +v.gain.gain.value.toFixed(2), ready: v.el.readyState })),
    });
    return { mood: this.mood, ctx: this.ctx?.state, build: t(this.tracks.build), combat: t(this.tracks.combat) };
  }

  // ── Graph ────────────────────────────────────────────────────────────────

  private build(c: AudioContext) {
    this.ctx = c;
    this.bus = c.createGain();
    this.bus.gain.value = 0;
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.5;
    this.filter.connect(this.bus).connect(getMasterBus(c));

    const mkTrack = (id: TrackId): Track => {
      const out = c.createGain();
      out.gain.value = 0;
      out.connect(this.filter);
      const mkVoice = (): Voice => {
        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.preload = 'auto';
        el.src = TRACK_URL[id];
        el.setAttribute('playsinline', '');
        const gain = c.createGain();
        gain.gain.value = 0;
        c.createMediaElementSource(el).connect(gain).connect(out);
        return { el, gain };
      };
      return { id, voices: [mkVoice(), mkVoice()], active: 0, out, playing: false, crossfading: false };
    };
    this.tracks = { build: mkTrack('build'), combat: mkTrack('combat') };
    window.setInterval(() => this.watchLoops(), 200);
  }

  /** iOS/Safari: each media element must be started once inside a user gesture. */
  private prime() {
    const c = getAudioContext();
    if (!c) return;
    if (!this.ctx) this.build(c);
    this.eachVoice((v) => {
      const p = v.el.play();
      p.then(() => {
        // Keep the one that's about to be used; park the rest
        if (!this.isWanted(v)) v.el.pause();
      }).catch(() => undefined);
    });
  }

  private isWanted(v: Voice) {
    if (this.mood === 'off') return false;
    const t = this.tracks[MOODS[this.mood].track];
    return t.playing && t.voices[t.active] === v;
  }

  private eachVoice(fn: (v: Voice, t: Track) => void) {
    (Object.values(this.tracks) as Track[]).forEach((t) => t.voices.forEach((v) => fn(v, t)));
  }

  // ── Mood control ─────────────────────────────────────────────────────────

  private apply() {
    if (!this.unlocked) return;
    const c = getAudioContext();
    if (!c) return;
    if (!this.ctx) this.build(c);
    const m = this.wanted;
    const prev = this.mood;
    this.mood = m;
    const now = c.currentTime;

    if (m === 'off') {
      (Object.values(this.tracks) as Track[]).forEach((t) => this.fadeTrack(t, 0));
      this.applyVolume();
      return;
    }
    const spec = MOODS[m];
    this.filter.frequency.setTargetAtTime(spec.cutoff, now, 0.5);
    this.applyVolume();

    (Object.values(this.tracks) as Track[]).forEach((t) => {
      if (t.id === spec.track) {
        // Combat restarts from its intro at each wave; build resumes where it was
        const restart = t.id === 'combat' && prev !== 'combat';
        this.startTrack(t, restart);
        this.fadeTrack(t, spec.level);
      } else {
        this.fadeTrack(t, 0);
      }
    });
  }

  private applyVolume() {
    if (!this.ctx || !this.bus) return;
    const { bgmVolume, muted } = settings.value;
    const on = this.mood !== 'off' && !muted;
    this.bus.gain.setTargetAtTime(on ? bgmVolume * bgmVolume * 0.7 : 0, this.ctx.currentTime, 0.15);
  }

  private fadeTrack(t: Track, level: number) {
    const c = this.ctx!;
    t.out.gain.cancelScheduledValues(c.currentTime);
    t.out.gain.setValueAtTime(t.out.gain.value, c.currentTime);
    t.out.gain.setTargetAtTime(level, c.currentTime, MOOD_XFADE / 3);
    window.clearTimeout(this.stopTimers[t.id]);
    if (level === 0 && t.playing) {
      // Pause once silent to save CPU/battery
      this.stopTimers[t.id] = window.setTimeout(() => {
        t.voices.forEach((v) => v.el.pause());
        t.playing = false;
        t.crossfading = false;
      }, MOOD_XFADE * 2000);
    }
  }

  private startTrack(t: Track, restart: boolean) {
    const c = this.ctx!;
    if (restart) {
      t.voices.forEach((x) => {
        x.el.pause();
        x.gain.gain.cancelScheduledValues(c.currentTime);
        x.gain.gain.setValueAtTime(0, c.currentTime);
      });
      t.crossfading = false;
      t.playing = false;
      t.voices[t.active].el.currentTime = 0;
    }
    const v = t.voices[t.active];
    if (!t.playing || v.el.paused) {
      v.gain.gain.cancelScheduledValues(c.currentTime);
      v.gain.gain.setValueAtTime(1, c.currentTime);
      void v.el.play().catch(() => undefined);
      t.playing = true;
    }
  }

  private resumeAudible() {
    (Object.values(this.tracks) as Track[]).forEach((t) => {
      if (!t.playing) return;
      t.voices.forEach((v, i) => {
        if (i === t.active || v.gain.gain.value > 0.01) void v.el.play().catch(() => undefined);
      });
    });
  }

  /** Ping-pong crossfade between a track's two players at the loop point. */
  private watchLoops() {
    const c = this.ctx;
    if (!c || document.hidden) return;
    (Object.values(this.tracks) as Track[]).forEach((t) => {
      if (!t.playing || t.crossfading) return;
      const cur = t.voices[t.active];
      const dur = cur.el.duration;
      if (!Number.isFinite(dur) || dur <= LOOP_XFADE * 2 || cur.el.paused) return;
      const remaining = dur - cur.el.currentTime;
      if (remaining > LOOP_XFADE) return;

      const nextIdx = (t.active ^ 1) as 0 | 1;
      const next = t.voices[nextIdx];
      const now = c.currentTime;
      const fade = Math.max(0.5, Math.min(LOOP_XFADE, remaining - 0.1));
      next.el.currentTime = 0;
      next.gain.gain.cancelScheduledValues(now);
      next.gain.gain.setValueAtTime(0, now);
      void next.el.play().catch(() => undefined);
      // Equal-power curves
      const n = 32;
      const up = new Float32Array(n);
      const down = new Float32Array(n);
      const from = cur.gain.gain.value;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        up[i] = Math.sin((x * Math.PI) / 2);
        down[i] = from * Math.cos((x * Math.PI) / 2);
      }
      next.gain.gain.setValueCurveAtTime(up, now + 0.02, fade);
      cur.gain.gain.cancelScheduledValues(now);
      cur.gain.gain.setValueCurveAtTime(down, now + 0.02, fade);
      t.crossfading = true;
      t.active = nextIdx;
      window.setTimeout(() => {
        cur.el.pause();
        t.crossfading = false;
      }, (fade + 0.3) * 1000);
    });
  }
}

export const music = new MusicPlayer();
