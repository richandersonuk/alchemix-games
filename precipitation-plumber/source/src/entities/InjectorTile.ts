import { Direction, ReagentId } from '../data/reactions';
import { oppositeDirection, rotateDirection, Tile } from './Tile';

export class InjectorTile extends Tile {
  public readonly reagent: ReagentId;
  public dropAnimTimer = 0; // 0..1 visual droplet flash when dosing a packet

  constructor(reagent: ReagentId, x: number, y: number, rotation = 0, fixed = false) {
    super('injector', x, y, rotation, fixed);
    this.reagent = reagent;
  }

  public getOpenPorts(): Direction[] {
    return (['W', 'E'] as Direction[]).map((d) => rotateDirection(d, this.rotation));
  }

  public getExitPorts(entryPort: Direction): Direction[] {
    const open = this.getOpenPorts();
    if (!open.includes(entryPort)) return [];
    return [oppositeDirection(entryPort)];
  }

  public triggerDropAnimation(): void {
    this.dropAnimTimer = 1.0;
  }

  public override resetSimulationState(): void {
    this.dropAnimTimer = 0;
  }
}
