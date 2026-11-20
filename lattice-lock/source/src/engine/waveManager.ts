import type {
  DamageType,
  InteractionResult,
  LatticeId,
  LogEntry,
  LogSeverity,
  Outcome,
  ThreatId,
  ThreatState,
  TowerState,
  Vec3,
  Verdict,
} from '../types/chemistry';
import { LATTICES } from '../data/lattices';
import { DAMAGE_META, THREATS, WAVES, waveHpMultiplier } from '../data/waves';
import { resolveInteraction } from './damageCalculator';
import { PATH_LENGTH, isBuildable, samplePath, tileToWorld } from './map';
import { sfx } from './audio';
import { computeScore, type RunSummary } from '../../shared/scoring.js';

// ─────────────────────────────────────────────────────────────────────────────
// Game engine: wave spawning, pathing, tower ↔ threat resolution, win/loss.
// Plain TS (no React) so the Three.js render loop can read it every frame;
// React subscribes through two channels: `ui` (throttled) and `structure`.
// ─────────────────────────────────────────────────────────────────────────────

export type Phase = 'build' | 'wave' | 'victory' | 'defeat';

export type VisualEventKind = 'shatter' | 'melt' | 'dissolve' | 'zap' | 'neutralise' | 'core' | 'place' | 'upgrade' | 'graphitise';

export interface VisualEvent {
  kind: VisualEventKind;
  position: Vec3;
  color: string;
}

export interface Engagement {
  towerId: number;
  threatId: number;
  verdict: Verdict;
  type: DamageType;
}

export const START_MOLES = 260;
const REWARD_MULT = 1.3;
export const CORE_MAX = 100;
const HYDRATION_SECONDS = 6;
const GRAPHITISE_SECONDS = 3;
const MAX_LOGS = 80;

const DESTRUCTION_EVENT: Partial<Record<Outcome, VisualEventKind>> = {
  shattered: 'shatter',
  cleaved: 'shatter',
  fractured: 'shatter',
  melted: 'melt',
  vaporised: 'melt',
  dissolved: 'dissolve',
  eroded: 'dissolve',
  corroded: 'dissolve',
  breakdown: 'zap',
  electrolysed: 'zap',
};

const DESTRUCTION_VERB: Partial<Record<Outcome, string>> = {
  shattered: 'Barrier shattered',
  cleaved: 'Barrier cleaved',
  fractured: 'Barrier fractured',
  melted: 'Barrier melted',
  vaporised: 'Barrier vaporised',
  dissolved: 'Barrier dissolved',
  eroded: 'Barrier eroded',
  corroded: 'Barrier corroded away',
  breakdown: 'Barrier failed (breakdown)',
  electrolysed: 'Barrier short-circuited',
};

interface Selection {
  placing: LatticeId | null;
  towerId: number | null;
  inspect: LatticeId | null;
  hover: { x: number; z: number } | null;
  /** Touch placement: first tap previews here, second tap (or Build button) confirms. */
  pending: { x: number; z: number } | null;
}

const newRunId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const emptySelection = (): Selection => ({ placing: null, towerId: null, inspect: null, hover: null, pending: null });

export class GameEngine {
  phase: Phase = 'build';
  waveIndex = 0;
  moles = START_MOLES;
  core = CORE_MAX;
  marks = 0;
  towers: TowerState[] = [];
  threats: ThreatState[] = [];
  logs: LogEntry[] = [];
  engagements: Engagement[] = [];
  time = 0;
  waveTime = 0;
  speed = 1;
  paused = false;
  coreFlash = 0;
  waveTotal = 0;
  waveSpawned = 0;
  stats = { neutralised: 0, towersLost: 0, breaches: 0 };
  selection: Selection = emptySelection();
  runId = newRunId();
  /** Bumped whenever a log entry is added (compact UI shows toasts). */
  logVersion = 0;

  uiVersion = 0;
  structureVersion = 0;

  private queue: { at: number; threat: ThreatId }[] = [];
  private events: VisualEvent[] = [];
  private nextId = 1;
  private uiTimer = 0;
  private contacts = new Set<string>();
  private logKeys = new Set<string>();
  private markKeys = new Set<string>();
  private breachKeys = new Set<string>();
  private uiListeners = new Set<() => void>();
  private structureListeners = new Set<() => void>();

  constructor() {
    this.log('info', 'Spectrometer online', 'Place lattice barriers beside the lane. Each barrier interacts with the disruptor nearest the core within its range. Watch this log: every success and failure is explained in mark-scheme language.', ['structure', 'bonding', 'properties']);
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  subscribeUi = (fn: () => void) => {
    this.uiListeners.add(fn);
    return () => void this.uiListeners.delete(fn);
  };
  subscribeStructure = (fn: () => void) => {
    this.structureListeners.add(fn);
    return () => void this.structureListeners.delete(fn);
  };
  private emitUi() {
    this.uiVersion++;
    this.uiListeners.forEach((f) => f());
  }
  private bumpStructure() {
    this.structureVersion++;
    this.structureListeners.forEach((f) => f());
    this.emitUi();
  }

  drainEvents(): VisualEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  update(dtReal: number) {
    const dt0 = Math.min(dtReal, 0.1);
    this.coreFlash = Math.max(0, this.coreFlash - dt0 * 1.8);
    for (const t of this.towers) t.hitFlash = Math.max(0, t.hitFlash - dt0 * 2.5);

    if (this.phase === 'wave' && !this.paused) {
      let remaining = dt0 * this.speed;
      while (remaining > 1e-6 && this.phase === 'wave') {
        const step = Math.min(remaining, 1 / 30);
        this.step(step);
        remaining -= step;
      }
    } else if (this.phase !== 'wave') {
      this.engagements.length = 0;
    }

    this.uiTimer += dt0;
    if (this.uiTimer >= 0.1) {
      this.uiTimer = 0;
      this.emitUi();
    }
  }

  private step(dt: number) {
    this.time += dt;
    this.waveTime += dt;
    let structural = false;

    // Spawn
    while (this.queue.length && this.queue[0].at <= this.waveTime) {
      const q = this.queue.shift()!;
      this.spawnThreat(q.threat);
      structural = true;
    }

    for (const th of this.threats) th.slow = 1;
    this.engagements = [];

    // Towers engage
    const destroyed: { tower: TowerState; res: InteractionResult; threat: ThreatId }[] = [];
    for (const tower of this.towers) {
      const lat = LATTICES[tower.latticeId];
      let target: ThreatState | null = null;
      for (const th of this.threats) {
        if (th.hp <= 0) continue;
        const d = Math.hypot(th.position[0] - tower.position[0], th.position[2] - tower.position[2]);
        if (d <= lat.stats.range && (!target || th.progress > target.progress)) target = th;
      }
      tower.targetId = target ? target.id : null;
      if (!target) continue;

      const spec = THREATS[target.specId];
      const hydrated = tower.hydratedUntil > this.time;
      const res = resolveInteraction(lat, spec, { hydrated });

      target.hp -= lat.stats.power * res.threatDamageMult * dt;
      target.slow = Math.min(target.slow, res.slow);

      const dmg = res.instantDestroy ? tower.integrity + 1 : spec.aggression * res.towerDamageMult * dt;
      tower.integrity -= dmg;
      if (dmg > 0.02) {
        tower.hitFlash = Math.min(1, tower.hitFlash + 0.25 + dmg * 0.05);
        tower.hitType = spec.type;
      }
      if (res.hydrate) {
        if (!hydrated) {
          this.logOnce(`hyd:${this.waveIndex}:${tower.latticeId}`, 'warning', `${lat.formula} barrier hydrated — now conductive`, 'Water has freed ions at the surface. For the next few seconds this barrier contains mobile ions and will conduct an electrical arc instead of blocking it.', ['ions free to move', 'aqueous solution conducts']);
        }
        tower.hydratedUntil = this.time + HYDRATION_SECONDS;
      }
      if (res.graphitise) {
        tower.plasmaExposure += dt;
        if (tower.plasmaExposure >= GRAPHITISE_SECONDS) {
          this.graphitise(tower);
          structural = true;
        }
      }

      this.engagements.push({ towerId: tower.id, threatId: target.id, verdict: res.verdict, type: spec.type });
      this.noteInteraction(tower, target, res);
      if (target.hp <= 0) tower.neutralised++;
      if (tower.integrity <= 0) destroyed.push({ tower, res, threat: spec.id });
    }

    for (const d of destroyed) {
      this.destroyTower(d.tower, d.res);
      structural = true;
    }

    // Move threats
    const survivors: ThreatState[] = [];
    for (const th of this.threats) {
      const spec = THREATS[th.specId];
      if (th.hp <= 0) {
        this.moles += spec.reward * REWARD_MULT;
        this.stats.neutralised++;
        this.events.push({ kind: 'neutralise', position: [...th.position], color: spec.color });
        sfx.play('pop');
        structural = true;
        continue;
      }
      th.progress += spec.speed * th.slow * dt;
      if (th.progress >= PATH_LENGTH) {
        this.breach(th);
        structural = true;
        continue;
      }
      const s = samplePath(th.progress);
      th.heading = s.heading;
      th.position[0] = s.x + Math.cos(s.heading) * th.lane;
      th.position[2] = s.z - Math.sin(s.heading) * th.lane;
      survivors.push(th);
    }
    this.threats = survivors;

    if (this.core <= 0 && this.phase === 'wave') {
      this.core = 0;
      this.phase = 'defeat';
      this.paused = false;
      sfx.play('defeat');
      this.log('fail', 'Core lattice collapsed', 'The core took too many unblocked disruptors. Review the log: which bonding properties were missing from your lanes?', ['structure → bonding → property']);
      structural = true;
    } else if (this.phase === 'wave' && this.queue.length === 0 && this.threats.length === 0) {
      this.endWave();
      structural = true;
    }

    if (structural) this.bumpStructure();
  }

  private spawnThreat(id: ThreatId) {
    const spec = THREATS[id];
    const hp = spec.hp * waveHpMultiplier(this.waveIndex);
    const s = samplePath(0);
    this.threats.push({
      id: this.nextId++,
      specId: id,
      hp,
      maxHp: hp,
      progress: 0,
      position: [s.x, 0, s.z],
      heading: s.heading,
      slow: 1,
      lane: (Math.random() - 0.5) * 0.36,
    });
    this.waveSpawned++;
  }

  private noteInteraction(tower: TowerState, threat: ThreatState, res: InteractionResult) {
    const pair = `${tower.id}:${threat.id}`;
    if (this.contacts.has(pair)) return;
    this.contacts.add(pair);
    sfx.play(res.sfx);
    const lat = LATTICES[tower.latticeId];
    const key = `${this.waveIndex}:${lat.id}:${threat.specId}:${res.outcome}`;
    if (this.logKeys.has(key)) return;
    this.logKeys.add(key);
    let marks: number | undefined;
    if (res.verdict === 'counter') {
      const mk = `${lat.id}:${THREATS[threat.specId].type}:${res.outcome}`;
      if (!this.markKeys.has(mk)) {
        this.markKeys.add(mk);
        this.marks++;
        marks = 1;
      }
    }
    const sev: LogSeverity = res.verdict === 'counter' ? 'success' : res.verdict === 'weak' ? 'warning' : 'info';
    this.log(sev, res.title, res.rationale, res.keywords, marks);
  }

  private destroyTower(tower: TowerState, res: InteractionResult) {
    const lat = LATTICES[tower.latticeId];
    this.towers = this.towers.filter((t) => t !== tower);
    this.stats.towersLost++;
    if (this.selection.towerId === tower.id) this.selection.towerId = null;
    const kind = DESTRUCTION_EVENT[res.outcome] ?? 'shatter';
    this.events.push({ kind, position: [tower.position[0], 0.7, tower.position[2]], color: lat.accent });
    sfx.play(kind === 'shatter' ? 'crack' : kind === 'melt' ? 'hiss' : kind === 'dissolve' ? 'splash' : 'hum');
    if (kind === 'shatter') sfx.play('thud');
    this.log('fail', `${DESTRUCTION_VERB[res.outcome] ?? 'Barrier lost'}: ${lat.name} (${lat.formula})`, res.rationale, res.keywords);
  }

  private graphitise(tower: TowerState) {
    const g = LATTICES.graphite;
    const frac = tower.integrity / LATTICES.diamond.stats.maxIntegrity;
    tower.latticeId = 'graphite';
    tower.integrity = Math.max(20, g.stats.maxIntegrity * frac);
    tower.plasmaExposure = 0;
    this.events.push({ kind: 'graphitise', position: [tower.position[0], 0.75, tower.position[2]], color: '#94a3b8' });
    sfx.play('hiss');
    this.log('warning', 'Diamond graphitised under sustained plasma', 'The plasma supplied enough energy for the sp³ tetrahedral network to rearrange into flat sp² hexagonal layers. The barrier is now graphite: it conducts electricity, but its layers can slide.', ['sp³ → sp²', 'graphite is more stable', 'layers']);
  }

  private breach(th: ThreatState) {
    const spec = THREATS[th.specId];
    this.core = Math.max(0, this.core - spec.coreDamage);
    this.coreFlash = 1;
    this.stats.breaches++;
    this.events.push({ kind: 'core', position: [...th.position], color: spec.color });
    sfx.play('core');
    const k = `${this.waveIndex}:${spec.id}`;
    if (!this.breachKeys.has(k)) {
      this.breachKeys.add(k);
      this.log('fail', `Core breached by ${spec.name} (−${spec.coreDamage})`, `No barrier in its path neutralised this ${DAMAGE_META[spec.type].label.toLowerCase()} disruptor. ${DAMAGE_META[spec.type].counterHint}`, [DAMAGE_META[spec.type].label.toLowerCase(), 'match property to threat']);
    }
  }

  private endWave() {
    const w = WAVES[this.waveIndex];
    this.moles += w.bonus;
    for (const t of this.towers) {
      const max = LATTICES[t.latticeId].stats.maxIntegrity;
      t.integrity = Math.min(max, t.integrity + (max - t.integrity) * 0.5);
      t.hydratedUntil = 0;
    }
    this.contacts.clear();
    this.log('info', `Wave ${this.waveIndex + 1} "${w.name}" neutralised${w.bonus ? ` (+${w.bonus} mol)` : ''}`, 'Surviving barriers recrystallise between waves, recovering half their lost integrity.', []);
    this.waveIndex++;
    if (this.waveIndex >= WAVES.length) {
      this.phase = 'victory';
      sfx.play('victory');
      this.log('success', 'Core held — all ten waves defeated', `Final score: ${this.marks} mark-scheme points earned from correct structure → property matches.`, ['structure', 'bonding', 'properties']);
    } else {
      this.phase = 'build';
      sfx.play('upgrade');
    }
  }

  // ── Player actions ────────────────────────────────────────────────────────

  startWave() {
    if (this.phase !== 'build') return;
    const w = WAVES[this.waveIndex];
    this.queue = [];
    for (const g of w.groups) for (let i = 0; i < g.count; i++) this.queue.push({ at: g.delay + i * g.interval, threat: g.threat });
    this.queue.sort((a, b) => a.at - b.at);
    this.waveTotal = this.queue.length;
    this.waveSpawned = 0;
    this.waveTime = 0;
    this.phase = 'wave';
    this.selection.placing = null;
    sfx.play('wave');
    this.log('info', `Wave ${this.waveIndex + 1}: ${w.name}`, w.briefing, []);
    this.bumpStructure();
  }

  canPlace(x: number, z: number) {
    return isBuildable(x, z) && !this.towerAt(x, z);
  }

  towerAt(x: number, z: number) {
    return this.towers.find((t) => t.tile.x === x && t.tile.z === z) ?? null;
  }

  placeTower(id: LatticeId, x: number, z: number): boolean {
    const lat = LATTICES[id];
    if (!lat.buildable || !this.canPlace(x, z) || this.moles < lat.cost || this.phase === 'victory' || this.phase === 'defeat') {
      sfx.play('deny');
      return false;
    }
    this.moles -= lat.cost;
    const position = tileToWorld(x, z);
    this.towers.push({
      id: this.nextId++,
      latticeId: id,
      tile: { x, z },
      position,
      integrity: lat.stats.maxIntegrity,
      invested: lat.cost,
      targetId: null,
      hydratedUntil: 0,
      plasmaExposure: 0,
      hitFlash: 0,
      hitType: null,
      neutralised: 0,
    });
    this.events.push({ kind: 'place', position: [position[0], 0.2, position[2]], color: lat.accent });
    sfx.play('place');
    this.selection.pending = null;
    if (this.moles < lat.cost) this.selection.placing = null;
    this.bumpStructure();
    return true;
  }

  upgradeTower(towerId: number) {
    const t = this.towers.find((x) => x.id === towerId);
    if (!t) return;
    const lat = LATTICES[t.latticeId];
    if (!lat.upgradeTo || lat.upgradeCost === undefined || this.moles < lat.upgradeCost) {
      sfx.play('deny');
      return;
    }
    const next = LATTICES[lat.upgradeTo];
    this.moles -= lat.upgradeCost;
    t.integrity = next.stats.maxIntegrity * (t.integrity / lat.stats.maxIntegrity);
    t.latticeId = next.id;
    t.invested += lat.upgradeCost;
    t.plasmaExposure = 0;
    this.events.push({ kind: 'upgrade', position: [t.position[0], 0.75, t.position[2]], color: next.accent });
    sfx.play('upgrade');
    this.log('info', `Upgraded: ${lat.name} → ${next.name}`, lat.upgradeNote ?? '', next.examPoints.slice(-1));
    this.bumpStructure();
  }

  sellValue(t: TowerState) {
    const max = LATTICES[t.latticeId].stats.maxIntegrity;
    return Math.floor(t.invested * 0.6 * Math.max(0.25, t.integrity / max));
  }

  sellTower(towerId: number) {
    const t = this.towers.find((x) => x.id === towerId);
    if (!t) return;
    this.moles += this.sellValue(t);
    this.towers = this.towers.filter((x) => x !== t);
    this.selection.towerId = null;
    sfx.play('sell');
    this.bumpStructure();
  }

  // ── Selection / settings ──────────────────────────────────────────────────

  setPlacing(id: LatticeId | null) {
    this.selection.placing = id;
    this.selection.pending = null;
    if (id) this.selection.towerId = null;
    this.emitUi();
  }
  selectTower(id: number | null) {
    this.selection.towerId = id;
    this.selection.placing = null;
    this.selection.pending = null;
    this.emitUi();
  }
  setPending(tile: { x: number; z: number } | null) {
    this.selection.pending = tile;
    this.emitUi();
  }
  confirmPending() {
    const { placing, pending } = this.selection;
    if (placing && pending) this.placeTower(placing, pending.x, pending.z);
  }
  setInspect(id: LatticeId | null) {
    this.selection.inspect = id;
    this.emitUi();
  }
  setHover(tile: { x: number; z: number } | null) {
    const h = this.selection.hover;
    if (h?.x === tile?.x && h?.z === tile?.z) return;
    this.selection.hover = tile;
    this.emitUi();
  }
  clearSelection() {
    this.selection.placing = null;
    this.selection.towerId = null;
    this.selection.pending = null;
    this.emitUi();
  }
  hasSelection() {
    return !!(this.selection.placing || this.selection.towerId !== null || this.selection.pending);
  }
  setSpeed(s: number) {
    this.speed = s;
    this.emitUi();
  }
  setPaused(p: boolean) {
    this.paused = p;
    this.emitUi();
  }

  /** A run is "in progress" if the player has built or fought and it hasn't ended. */
  get runActive() {
    return (this.phase === 'build' || this.phase === 'wave') && (this.waveIndex > 0 || this.towers.length > 0 || this.phase === 'wave');
  }

  summary(): RunSummary {
    const victory = this.phase === 'victory';
    return {
      wavesCleared: victory ? WAVES.length : this.waveIndex,
      marks: this.marks,
      neutralised: this.stats.neutralised,
      coreRemaining: Math.max(0, Math.round(this.core)),
      victory,
      durationSec: Math.round(this.time),
      towersLost: this.stats.towersLost,
    };
  }

  get score() {
    return computeScore(this.summary());
  }

  reset() {
    this.phase = 'build';
    this.waveIndex = 0;
    this.moles = START_MOLES;
    this.core = CORE_MAX;
    this.marks = 0;
    this.towers = [];
    this.threats = [];
    this.logs = [];
    this.engagements = [];
    this.queue = [];
    this.events = [];
    this.time = 0;
    this.waveTime = 0;
    this.paused = false;
    this.speed = 1;
    this.stats = { neutralised: 0, towersLost: 0, breaches: 0 };
    this.selection = emptySelection();
    this.runId = newRunId();
    this.contacts.clear();
    this.logKeys.clear();
    this.markKeys.clear();
    this.breachKeys.clear();
    this.log('info', 'Lattice reset', 'New run started. Moles restored.', []);
    this.bumpStructure();
  }

  // ── Logging ───────────────────────────────────────────────────────────────

  private logOnce(key: string, sev: LogSeverity, title: string, rationale: string, keywords: string[]) {
    if (this.logKeys.has(key)) return;
    this.logKeys.add(key);
    this.log(sev, title, rationale, keywords);
  }

  private log(severity: LogSeverity, title: string, rationale: string, keywords: string[], marks?: number) {
    this.logs.unshift({ id: this.nextId++, time: this.time, wave: this.waveIndex + 1, severity, title, rationale, keywords, marks });
    if (this.logs.length > MAX_LOGS) this.logs.length = MAX_LOGS;
    this.logVersion++;
  }
}

export const engine = new GameEngine();
