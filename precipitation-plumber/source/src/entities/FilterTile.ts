import { Direction, PRECIPITATE_DATA, PrecipitateId } from '../data/reactions';
import { oppositeDirection, rotateDirection, Tile } from './Tile';

export class FilterTile extends Tile {
  public capturedSolids: Map<PrecipitateId, number> = new Map();
  public filtrationFlash = 0;

  constructor(x: number, y: number, rotation = 0, fixed = false) {
    super('filter', x, y, rotation, fixed);
  }

  public getOpenPorts(): Direction[] {
    return (['W', 'E'] as Direction[]).map((d) => rotateDirection(d, this.rotation));
  }

  public getExitPorts(entryPort: Direction): Direction[] {
    const open = this.getOpenPorts();
    if (!open.includes(entryPort)) return [];
    return [oppositeDirection(entryPort)];
  }

  public capturePrecipitate(id: PrecipitateId, amount: number): void {
    if (amount <= 0) return;
    this.capturedSolids.set(id, (this.capturedSolids.get(id) ?? 0) + amount);
    this.filtrationFlash = 1.0;
  }

  public getTotalMass(): number {
    let sum = 0;
    for (const v of this.capturedSolids.values()) sum += v;
    return sum;
  }

  public getDominantPrecipitate(): {
    id: PrecipitateId | null;
    amount: number;
    purity: number;
    colorHex: string;
  } {
    const total = this.getTotalMass();
    if (total <= 0.001) {
      return { id: null, amount: 0, purity: 100, colorHex: '#334155' };
    }

    let bestId: PrecipitateId | null = null;
    let bestAmt = 0;
    for (const [id, amt] of this.capturedSolids.entries()) {
      if (amt > bestAmt) {
        bestAmt = amt;
        bestId = id;
      }
    }

    const purity = Math.round((bestAmt / total) * 100);
    const colorHex = bestId ? PRECIPITATE_DATA[bestId].colorHex : '#94a3b8';
    return { id: bestId, amount: bestAmt, purity, colorHex };
  }

  public getPurityFor(target: PrecipitateId): { amount: number; purity: number } {
    const total = this.getTotalMass();
    const amt = this.capturedSolids.get(target) ?? 0;
    if (total <= 0.001) return { amount: 0, purity: 100 };
    return { amount: amt, purity: Math.round((amt / total) * 100) };
  }

  public override resetSimulationState(): void {
    this.capturedSolids.clear();
    this.filtrationFlash = 0;
  }
}
