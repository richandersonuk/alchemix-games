import { PlateConfig, SolventSpec } from '../types/chromatography';
import { DEFAULT_PLATE_CONFIG, normHToRelDist } from '../engine/RfCalculator';

export class SolventFront {
  public h: number;
  public wavePhase = 0;
  public solvent: SolventSpec;
  private config: PlateConfig;

  constructor(
    initialSolvent: SolventSpec,
    initialHeight: number,
    config: PlateConfig = DEFAULT_PLATE_CONFIG,
  ) {
    this.solvent = initialSolvent;
    this.h = initialHeight;
    this.config = config;
  }

  public setSolvent(solvent: SolventSpec): void {
    this.solvent = solvent;
  }

  /**
   * Capillary rise slows subtly near the top of the plate (Washburn-style deceleration)
   * unless fastFinish is triggered once all spots have locked.
   */
  public update(dt: number, levelBaseSpeed: number, fastFinish: boolean): void {
    this.wavePhase += dt * 4.2;
    const progress = normHToRelDist(this.h, this.config);
    const lucasWashburnFactor = fastFinish ? 3.8 : Math.max(0.68, 1.06 - 0.34 * progress);
    const combinedSpeed = Math.max(levelBaseSpeed, this.solvent.capillarySpeed * 0.92);
    this.h = Math.min(
      this.config.solventLimitNorm,
      this.h + combinedSpeed * lucasWashburnFactor * dt,
    );
  }

  /** Subtle meniscus distortion across horizontal coordinate u (0..1) */
  public getHeightAt(u: number, surgeU?: number): number {
    const edgeSmile = Math.pow((u - 0.5) * 2, 2) * 0.006;
    const ripple = Math.sin(u * Math.PI * 5 + this.wavePhase) * 0.0025;
    let surge = 0;
    if (surgeU !== undefined) {
      const dist = Math.abs(u - surgeU);
      if (dist < 0.16) {
        surge = (1 - dist / 0.16) * 0.012 * Math.sin(this.wavePhase * 1.4);
      }
    }
    return Math.min(0.96, this.h + edgeSmile + ripple + surge);
  }
}
