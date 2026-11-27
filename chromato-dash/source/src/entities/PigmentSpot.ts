import {
  PigmentSpec,
  PigmentState,
  PlateConfig,
  TrailParticle,
} from '../types/chromatography';
import { DEFAULT_PLATE_CONFIG } from '../engine/RfCalculator';

const MAX_TRAIL_PARTICLES = 18;

export class PigmentSpot {
  public readonly spec: PigmentSpec;
  public u: number;
  public h: number;
  public vu = 0;
  public vh = 0;
  public state: PigmentState = 'baseline';
  public bleedRadius = 1.0;
  public dwellSec = 0;
  public contaminated = false;
  public contaminationFlash = 0;
  public revealed = false;
  public visibilityAlpha = 1;
  public pulsePhase = 0;
  public particles: TrailParticle[] = [];
  private particleEmitAcc = 0;

  constructor(spec: PigmentSpec, config: PlateConfig = DEFAULT_PLATE_CONFIG) {
    this.spec = spec;
    this.u = spec.startU;
    this.h = config.baselineNorm;
    this.revealed = spec.requiresLocating === 'none';
    this.visibilityAlpha = this.revealed ? 1 : 0.14;
  }

  public isLocked(): boolean {
    return (
      this.state === 'locked_hit' ||
      this.state === 'locked_miss' ||
      this.state === 'washed_out'
    );
  }

  public triggerContamination(): void {
    this.contaminated = true;
    this.contaminationFlash = 1.1;
  }

  public updateVisuals(dt: number, locatingActive: boolean, locatingType: string): void {
    this.pulsePhase += dt * 4.5;
    if (this.contaminationFlash > 0) {
      this.contaminationFlash = Math.max(0, this.contaminationFlash - dt * 1.4);
    }

    const matchesLocating =
      this.spec.requiresLocating === 'none' ||
      (locatingActive && locatingType === this.spec.requiresLocating);

    if (matchesLocating && this.spec.requiresLocating !== 'none') {
      this.revealed = true;
    }

    const targetAlpha =
      this.spec.requiresLocating === 'none'
        ? 1
        : matchesLocating
          ? 1
          : this.revealed
            ? 0.42
            : 0.11;

    this.visibilityAlpha += (targetAlpha - this.visibilityAlpha) * Math.min(1, dt * 8);

    // Emit faint droplet particles while surfing
    if (this.state === 'surfing' && this.vh > 0.006) {
      this.particleEmitAcc += dt;
      if (this.particleEmitAcc >= 0.045) {
        this.particleEmitAcc = 0;
        this.emitParticle();
      }
    }

    // Subtle silica adsorption bleed expand on settle
    if (this.state === 'adsorbed' || this.state === 'locked_hit' || this.state === 'locked_miss') {
      this.bleedRadius += (1.22 - this.bleedRadius) * Math.min(1, dt * 5);
    } else {
      this.bleedRadius += (1.0 - this.bleedRadius) * Math.min(1, dt * 7);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.alpha = Math.max(0, p.life / 0.55) * 0.55;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private emitParticle(): void {
    if (this.particles.length >= MAX_TRAIL_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push({
      u: this.u + (Math.random() - 0.5) * 0.016,
      h: this.h - 0.008,
      radius: 2.2 + Math.random() * 2.1,
      alpha: 0.55,
      life: 0.55,
    });
  }
}
