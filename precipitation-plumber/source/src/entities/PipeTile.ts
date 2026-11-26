import { Direction, PrecipitateId } from '../data/reactions';
import { PipeVariant } from '../data/levels';
import { oppositeDirection, rotateDirection, Tile } from './Tile';

export class PipeTile extends Tile {
  public readonly variant: PipeVariant;
  public sludgeLoad = 0; // 0..1 visual build-up when unfiltered slurry passes through
  public ruptured = false;
  public clogPrecipitate: PrecipitateId | null = null;

  constructor(variant: PipeVariant, x: number, y: number, rotation = 0, fixed = false) {
    super('pipe', x, y, rotation, fixed);
    this.variant = variant;
  }

  public getOpenPorts(): Direction[] {
    switch (this.variant) {
      case 'straight':
        return (['W', 'E'] as Direction[]).map((d) => rotateDirection(d, this.rotation));
      case 'elbow':
        return (['N', 'E'] as Direction[]).map((d) => rotateDirection(d, this.rotation));
      case 'tee':
        return (['W', 'N', 'E'] as Direction[]).map((d) => rotateDirection(d, this.rotation));
      case 'crossover':
        return ['N', 'E', 'S', 'W'];
    }
  }

  public getExitPorts(entryPort: Direction): Direction[] {
    if (this.ruptured) return [];
    const open = this.getOpenPorts();
    if (!open.includes(entryPort)) return [];

    if (this.variant === 'crossover') {
      // Two isolated non-mixing channels: N<->S and E<->W
      return [oppositeDirection(entryPort)];
    }

    return open.filter((p) => p !== entryPort);
  }

  public override resetSimulationState(): void {
    this.sludgeLoad = 0;
    this.ruptured = false;
    this.clogPrecipitate = null;
  }
}
