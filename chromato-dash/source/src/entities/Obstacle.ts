import { ObstacleSpec, PlateConfig } from '../types/chromatography';
import { DEFAULT_PLATE_CONFIG, rfToNormH } from '../engine/RfCalculator';

export class Obstacle {
  public readonly spec: ObstacleSpec;
  public currentU: number;
  public readonly centerH: number;
  public readonly minH: number;
  public readonly maxH: number;
  public hitFlash = 0;
  private phase = 0;

  constructor(spec: ObstacleSpec, config: PlateConfig = DEFAULT_PLATE_CONFIG) {
    this.spec = spec;
    this.currentU = spec.u;
    const span = config.solventLimitNorm - config.baselineNorm;
    this.centerH = rfToNormH(spec.rf, config);
    const halfH = (spec.heightRf * span) / 2;
    this.minH = this.centerH - halfH;
    this.maxH = this.centerH + halfH;
  }

  public update(dt: number): void {
    this.phase += dt * (this.spec.driftSpeed ?? 1.2);
    if (this.spec.driftAmpU) {
      this.currentU = Math.max(
        0.16,
        Math.min(0.84, this.spec.u + Math.sin(this.phase) * this.spec.driftAmpU),
      );
    }
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    }
  }

  public overlapsSpot(u: number, h: number, padU = 0.028, padH = 0.014): boolean {
    const halfW = this.spec.widthU / 2 + padU;
    return (
      Math.abs(u - this.currentU) <= halfW &&
      h >= this.minH - padH &&
      h <= this.maxH + padH
    );
  }
}
