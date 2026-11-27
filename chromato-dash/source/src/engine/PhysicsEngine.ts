import { SOLVENTS } from '../data/levels';
import {
  CaseRunSummary,
  LevelData,
  LocatingMethod,
  PlateConfig,
  RunPhase,
  SolventId,
} from '../types/chromatography';
import {
  DEFAULT_PLATE_CONFIG,
  evaluateCaseRun,
  isRfHit,
  normHToRelDist,
} from './RfCalculator';
import { SolventFront } from '../entities/SolventFront';
import { PigmentSpot } from '../entities/PigmentSpot';
import { TargetZone } from '../entities/TargetZone';
import { Obstacle } from '../entities/Obstacle';

export type EngineEventType =
  | 'pour'
  | 'hit'
  | 'miss'
  | 'hazard'
  | 'burst'
  | 'uv'
  | 'solvent'
  | 'fail'
  | 'complete';

export type EngineEventListener = (event: EngineEventType, detail?: string) => void;

export class PhysicsEngine {
  public readonly config: PlateConfig = DEFAULT_PLATE_CONFIG;
  public level: LevelData;
  public phase: RunPhase = 'setup';
  public reservoirH = 0;
  public solventFront: SolventFront;
  public spots: PigmentSpot[] = [];
  public zones: TargetZone[] = [];
  public obstacles: Obstacle[] = [];
  public activeSpotIndex = 0;

  public currentSolventId: SolventId;
  public pourHolding = false;
  public thumbHolding = false;
  public steerAxis = 0;

  public burstTimeLeft = 0;
  public burstCooldown = 0;
  public locatingTimeLeft = 0;
  public locatingCooldown = 0;

  public usedSolventSwitch = false;
  public usedLocatingAgent = false;
  public failedSubmersion = false;
  public failureReason: string | null = null;
  public statusBanner = 'Hold POUR SOLVENT into the green 4–9% zone below the 10% pencil line.';

  private bannerTimer = 0;
  private elapsedRunSec = 0;
  private listener: EngineEventListener | null = null;

  constructor(level: LevelData, listener?: EngineEventListener) {
    this.level = level;
    this.currentSolventId = level.defaultSolvent;
    this.solventFront = new SolventFront(
      SOLVENTS[this.currentSolventId],
      0,
      this.config,
    );
    this.listener = listener ?? null;
    this.loadLevel(level);
  }

  public loadLevel(level: LevelData): void {
    this.level = level;
    this.currentSolventId = level.defaultSolvent;
    this.phase = 'setup';
    this.reservoirH = 0.015;
    this.solventFront = new SolventFront(
      SOLVENTS[this.currentSolventId],
      this.reservoirH,
      this.config,
    );

    const sortedPigments = [...level.pigments].sort(
      (a, b) => a.targetRf - b.targetRf,
    );
    this.spots = sortedPigments.map((p) => new PigmentSpot(p, this.config));
    this.zones = sortedPigments.map(
      (p) =>
        new TargetZone(
          {
            pigmentId: p.id,
            label: p.shortCode,
            colorHex: p.colorHex,
            targetRf: p.targetRf,
            toleranceRf: p.toleranceRf,
          },
          this.config,
        ),
    );
    this.obstacles = level.obstacles.map((o) => new Obstacle(o, this.config));

    this.activeSpotIndex = 0;
    this.pourHolding = false;
    this.thumbHolding = false;
    this.steerAxis = 0;
    this.burstTimeLeft = 0;
    this.burstCooldown = 0;
    this.locatingTimeLeft = 0;
    this.locatingCooldown = 0;
    this.usedSolventSwitch = false;
    this.usedLocatingAgent = false;
    this.failedSubmersion = false;
    this.failureReason = null;
    this.elapsedRunSec = 0;

    if (level.caseNumber === 1) {
      this.setBanner(
        'Step 1: Hold POUR SOLVENT into the green 4–9% band (stop below 10%) or tap Quick Safe Fill.',
        6,
      );
    } else if (!level.allowInstantPour) {
      this.setBanner(
        'Exam Mode: Manually pour solvent into 4–9% — release before reaching 10%!',
        4.5,
      );
    } else {
      this.setBanner(
        'Hold POUR SOLVENT into the 4–9% band — never cover the 10% Pencil Line!',
        4,
      );
    }
  }

  public setBanner(msg: string, duration = 2.8): void {
    this.statusBanner = msg;
    this.bannerTimer = duration;
  }

  public startQuickSafePour(): void {
    if (this.phase !== 'setup') return;
    if (!this.level.allowInstantPour) return;
    this.reservoirH = this.config.reservoirDefaultNorm;
    this.listener?.('pour');
    this.beginCapillaryRun();
  }

  public beginCapillaryRun(): void {
    if (this.phase !== 'setup') return;
    if (this.reservoirH >= this.config.baselineNorm) {
      this.triggerSubmersionFail();
      return;
    }
    if (this.reservoirH < 0.032) {
      this.reservoirH = 0.042;
    }
    this.solventFront.h = this.reservoirH;
    this.phase = 'running';
    this.listener?.('pour');

    const activeName = this.getActiveSpot()?.spec.name ?? 'dye';
    if (this.level.caseNumber === 1) {
      this.setBanner(
        `Solvent climbing! Hold anywhere on the plate to surf ${activeName} into its target band, then release to lock.`,
        4.5,
      );
    } else if (this.level.locatingAgent !== 'none') {
      const toolName = this.level.locatingAgent === 'uv' ? 'UV 254nm' : 'NIN SPRAY';
      this.setBanner(
        `Colourless sample! Tap ${toolName} (or double-tap plate) to reveal spots.`,
        3.5,
      );
    } else {
      this.setBanner(
        `Solvent rising! Hold plate to surf ${activeName} up to its target Rf.`,
        3.2,
      );
    }
  }

  private triggerSubmersionFail(): void {
    this.failedSubmersion = true;
    this.failureReason =
      'Baseline Submerged! Reservoir rose above 10% and washed spots into the beaker.';
    for (const spot of this.spots) {
      spot.state = 'washed_out';
      spot.h = Math.max(0.03, this.reservoirH * 0.55);
    }
    this.phase = 'summary';
    this.listener?.('fail', this.failureReason);
  }

  public switchSolvent(targetId?: SolventId): boolean {
    if (this.phase !== 'running' && this.phase !== 'finishing') return false;
    if (this.level.availableSolvents.length < 2) return false;
    let nextId = targetId;
    if (!nextId) {
      const idx = this.level.availableSolvents.indexOf(this.currentSolventId);
      nextId =
        this.level.availableSolvents[(idx + 1) % this.level.availableSolvents.length];
    }
    if (!nextId || nextId === this.currentSolventId) return false;
    this.currentSolventId = nextId;
    this.solventFront.setSolvent(SOLVENTS[nextId]);
    this.usedSolventSwitch = true;
    this.setBanner(`Mobile Phase switched to ${SOLVENTS[nextId].shortName}!`, 2.6);
    this.listener?.('solvent', SOLVENTS[nextId].shortName);
    return true;
  }

  public triggerCapillaryBurst(): boolean {
    if (this.phase !== 'running') return false;
    if (this.burstCooldown > 0) return false;
    this.burstTimeLeft = 0.34;
    this.burstCooldown = 2.4;
    this.setBanner('Capillary Burst active!', 1.2);
    this.listener?.('burst');
    return true;
  }

  public triggerLocatingPulse(): boolean {
    if (this.phase !== 'running' && this.phase !== 'finishing') return false;
    if (this.locatingCooldown > 0 && this.locatingTimeLeft <= 0) return false;
    this.locatingTimeLeft = 4.6;
    this.locatingCooldown = 1.0;
    this.usedLocatingAgent = true;
    const label =
      this.level.locatingAgent === 'ninhydrin'
        ? 'Ninhydrin Spray Active — Amino Acids Revealed!'
        : 'UV 254 nm Lamp Active!';
    this.setBanner(label, 2.2);
    this.listener?.('uv', label);
    return true;
  }

  public selectActiveSpot(index: number): boolean {
    const spot = this.spots[index];
    if (!spot || spot.isLocked()) return false;
    this.activeSpotIndex = index;
    this.setBanner(`Selected: ${spot.spec.name} (Target Rf ${spot.spec.targetRf.toFixed(2)})`, 1.6);
    return true;
  }

  public nudgeHorizontal(deltaU: number): void {
    const active = this.getActiveSpot();
    if (!active || active.isLocked() || this.phase !== 'running') return;
    if (this.solventFront.h < this.config.baselineNorm) return;
    active.u = Math.max(0.13, Math.min(0.87, active.u + deltaU));
  }

  public getActiveSpot(): PigmentSpot | null {
    return this.spots[this.activeSpotIndex] ?? null;
  }

  public getActiveLocatingType(): LocatingMethod {
    if (this.locatingTimeLeft <= 0) return 'none';
    return this.level.locatingAgent === 'none' ? 'uv' : this.level.locatingAgent;
  }

  public update(dt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    }
    if (this.burstTimeLeft > 0) {
      this.burstTimeLeft = Math.max(0, this.burstTimeLeft - clampedDt);
    }
    if (this.burstCooldown > 0 && this.burstTimeLeft <= 0) {
      this.burstCooldown = Math.max(0, this.burstCooldown - clampedDt);
    }
    if (this.locatingTimeLeft > 0) {
      this.locatingTimeLeft = Math.max(0, this.locatingTimeLeft - clampedDt);
    } else if (this.locatingCooldown > 0) {
      this.locatingCooldown = Math.max(0, this.locatingCooldown - clampedDt);
    }

    if (this.phase === 'setup') {
      if (this.pourHolding) {
        this.reservoirH += 0.052 * clampedDt;
        this.solventFront.h = this.reservoirH;
        if (this.reservoirH >= this.config.baselineNorm) {
          this.pourHolding = false;
          this.triggerSubmersionFail();
        }
      }
      return;
    }

    if (this.phase !== 'running' && this.phase !== 'finishing') {
      return;
    }

    this.elapsedRunSec += clampedDt;
    const allLocked = this.spots.every((s) => s.isLocked());
    if (allLocked && this.phase === 'running') {
      this.phase = 'finishing';
      this.setBanner('All dyes locked! Solvent front completing capillary run...', 2.5);
    }

    const frontSpeed = this.level.baseFrontSpeed;
    this.solventFront.update(clampedDt, frontSpeed, this.phase === 'finishing');

    for (const zone of this.zones) {
      zone.update(clampedDt);
    }
    for (const obs of this.obstacles) {
      obs.update(clampedDt);
    }

    const activeSpot = this.getActiveSpot();
    const locatingType = this.getActiveLocatingType();
    const locatingActive = this.locatingTimeLeft > 0;

    for (let i = 0; i < this.spots.length; i++) {
      const spot = this.spots[i];
      spot.updateVisuals(clampedDt, locatingActive, locatingType);

      if (spot.isLocked()) continue;

      const zone = this.zones[i];
      const solubility = spot.spec.solubilityBySolvent[this.currentSolventId] ?? 0.5;
      const solventReachedSpot = this.solventFront.h >= spot.h + 0.004;

      if (!solventReachedSpot) {
        spot.state = 'baseline';
        spot.vh = 0;
        continue;
      }

      if (spot === activeSpot && this.phase === 'running') {
        this.updateActiveSpot(spot, zone, solubility, frontSpeed, clampedDt);
      } else {
        const maxPassiveH = zone.minH - 0.06;
        if (solubility > 0.14 && spot.h < maxPassiveH) {
          const creep = frontSpeed * 0.12 * solubility;
          spot.h = Math.min(maxPassiveH, spot.h + creep * clampedDt);
        }
        spot.vh = 0;
        spot.state = 'adsorbed';
      }

      const meniscusObs = this.obstacles.find(
        (o) => o.spec.type === 'meniscus_wave',
      );
      const localMeniscusH = this.solventFront.getHeightAt(
        spot.u,
        meniscusObs?.currentU,
      );
      const ceiling = Math.max(this.config.baselineNorm, localMeniscusH - 0.011);
      if (spot.h > ceiling) {
        spot.h = ceiling;
        spot.vh = Math.min(spot.vh, frontSpeed * 0.85);
      }
    }

    if (this.solventFront.h >= this.config.solventLimitNorm - 1e-4) {
      this.solventFront.h = this.config.solventLimitNorm;
      for (let i = 0; i < this.spots.length; i++) {
        const s = this.spots[i];
        const z = this.zones[i];
        if (!s.isLocked()) {
          const rf = normHToRelDist(s.h, this.config);
          const hit = isRfHit(rf, s.spec.targetRf, s.spec.toleranceRf);
          s.state = hit ? 'locked_hit' : 'locked_miss';
          z.lockState = hit ? 'hit' : 'miss';
        }
      }
      this.phase = 'summary';
      this.listener?.('complete');
    }
  }

  private updateActiveSpot(
    spot: PigmentSpot,
    zone: TargetZone,
    solubility: number,
    frontSpeed: number,
    dt: number,
  ): void {
    let hazardDrag = 1.0;
    let hazardDeflectU = 0;

    for (const obs of this.obstacles) {
      if (obs.overlapsSpot(spot.u, spot.h)) {
        if (obs.hitFlash <= 0.1) {
          this.listener?.('hazard', obs.spec.label);
        }
        obs.hitFlash = 1.0;
        if (obs.spec.type === 'dry_pocket') {
          hazardDrag = Math.min(hazardDrag, 0.3);
          this.setBanner('Dry Silica Pocket! Swipe ↑ or tap BURST to break free!', 1.2);
        } else if (obs.spec.type === 'graphite_smudge') {
          hazardDrag = Math.min(hazardDrag, 0.45);
          hazardDeflectU = (spot.u >= obs.currentU ? 1 : -1) * 0.22;
        } else if (obs.spec.type === 'ink_contaminant') {
          hazardDrag = Math.min(hazardDrag, 0.58);
          if (!spot.contaminated) {
            spot.triggerContamination();
            this.setBanner(`Contaminated by ${obs.spec.label}!`, 1.4);
          }
        } else if (obs.spec.type === 'meniscus_wave') {
          hazardDeflectU = Math.sin(this.elapsedRunSec * 7) * 0.26;
        }
      }
    }

    if (this.thumbHolding) {
      spot.state = 'surfing';
      spot.dwellSec = 0;

      if (solubility < 0.08 && this.burstTimeLeft <= 0) {
        spot.vh = Math.max(0, spot.vh - 2.0 * dt);
        if (this.level.availableSolvents.length > 1) {
          this.setBanner(
            `${spot.spec.shortCode} insoluble in ${SOLVENTS[this.currentSolventId].shortName} — tap Mobile Phase button!`,
            1.4,
          );
        }
      } else {
        const surfMultiplier = 1.05 + 1.75 * solubility;
        const burstAdd = this.burstTimeLeft > 0 ? 0.16 : 0;
        const targetVh = (frontSpeed * surfMultiplier + burstAdd) * hazardDrag;
        const accel = 4.8 + 2.2 * solubility;
        spot.vh += (targetVh - spot.vh) * Math.min(1, accel * dt);

        if (this.level.caseNumber === 1 && zone.containsHeight(spot.h)) {
          this.setBanner(
            `Inside ${spot.spec.shortCode} gate (${spot.spec.targetRf.toFixed(2)}) — release thumb now to adsorb!`,
            0.9,
          );
        }
      }

      const naturalDrift =
        Math.sin(this.elapsedRunSec * 3.1 + spot.h * 14) * 0.03;
      const steerVel = this.steerAxis * 0.36 + naturalDrift + hazardDeflectU;
      spot.vu = steerVel;
      spot.u = Math.max(0.13, Math.min(0.87, spot.u + spot.vu * dt));
      spot.h += Math.max(0, spot.vh) * dt;
    } else {
      spot.state = 'adsorbed';
      const decelRate = 2.2 + 4.4 * spot.spec.stationaryAffinity;
      spot.vh = Math.max(0, spot.vh - spot.vh * Math.min(1, decelRate * dt));
      if (spot.vh < 0.004) {
        spot.vh = 0;
      }
      spot.h += spot.vh * dt;

      if (spot.vh === 0) {
        spot.dwellSec += dt;
        const currentRf = normHToRelDist(spot.h, this.config);
        const hit = isRfHit(currentRf, spot.spec.targetRf, spot.spec.toleranceRf);

        if (hit && spot.dwellSec >= 0.2) {
          spot.state = 'locked_hit';
          zone.lockState = 'hit';
          this.setBanner(
            `${spot.spec.name} locked at Rf ${currentRf.toFixed(2)}!`,
            2.0,
          );
          this.listener?.('hit', spot.spec.name);
          this.advanceToNextSpot();
        } else if (
          currentRf > spot.spec.targetRf + spot.spec.toleranceRf &&
          spot.dwellSec >= 0.3
        ) {
          spot.state = 'locked_miss';
          zone.lockState = 'miss';
          this.setBanner(
            `${spot.spec.name} overshot (Rf ${currentRf.toFixed(2)}) — next dye active!`,
            2.0,
          );
          this.listener?.('miss', spot.spec.name);
          this.advanceToNextSpot();
        }
      }
    }
  }

  private advanceToNextSpot(): void {
    const nextIdx = this.spots.findIndex((s) => !s.isLocked());
    if (nextIdx !== -1) {
      this.activeSpotIndex = nextIdx;
      this.thumbHolding = false;
    }
  }

  public buildSummary(): CaseRunSummary {
    return evaluateCaseRun({
      level: this.level,
      solventFrontH: this.solventFront.h,
      spots: this.spots.map((s) => ({
        pigmentId: s.spec.id,
        name: s.spec.name,
        colorHex: s.spec.colorHex,
        targetRf: s.spec.targetRf,
        toleranceRf: s.spec.toleranceRf,
        hNorm: s.h,
        contaminated: s.contaminated,
        washedOut: s.state === 'washed_out',
        revealed: s.revealed,
      })),
      failedSubmersion: this.failedSubmersion,
      failureReason: this.failureReason,
      usedSolventSwitch: this.usedSolventSwitch,
      usedLocatingAgent: this.usedLocatingAgent,
      config: this.config,
    });
  }
}
