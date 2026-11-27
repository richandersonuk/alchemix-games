import { PlateConfig, TargetGateSpec } from '../types/chromatography';
import { DEFAULT_PLATE_CONFIG, rfToNormH } from '../engine/RfCalculator';

export type ZoneLockState = 'open' | 'hit' | 'miss';

export class TargetZone {
  public readonly spec: TargetGateSpec;
  public readonly minH: number;
  public readonly maxH: number;
  public readonly centerH: number;
  public lockState: ZoneLockState = 'open';
  public pulsePhase = 0;

  constructor(spec: TargetGateSpec, config: PlateConfig = DEFAULT_PLATE_CONFIG) {
    this.spec = spec;
    this.centerH = rfToNormH(spec.targetRf, config);
    this.minH = rfToNormH(Math.max(0, spec.targetRf - spec.toleranceRf), config);
    this.maxH = rfToNormH(Math.min(1, spec.targetRf + spec.toleranceRf), config);
  }

  public containsHeight(h: number): boolean {
    return h >= this.minH && h <= this.maxH;
  }

  public update(dt: number): void {
    this.pulsePhase += dt * 3.2;
  }
}
