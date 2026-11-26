import {
  Direction,
  GasId,
  ION_DATA,
  IonId,
  PRECIPITATE_DATA,
  PrecipitateId,
  ReagentId,
} from '../data/reactions';

let nextPacketUid = 1;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

export class FluidPacket {
  public readonly id: number;
  public volume: number;
  public dissolvedIons: Map<IonId, number>;
  public precipitates: Map<PrecipitateId, number>;
  public evolvedGases: Map<GasId, number>;
  public reagentDoses: Partial<Record<ReagentId, number>>;
  public colorHex: string;

  /** Number of consecutive standard PipeTiles traversed while carrying unfiltered solids */
  public slurrySteps = 0;

  /** Grid traversal state */
  public gridX: number;
  public gridY: number;
  public entryPort: Direction | null; // Side of current tile through which packet entered (null on spawn)
  public exitPort: Direction; // Side of current tile toward which packet exits
  public progress: number; // 0..1 across current tile
  public processedCenter = false; // Whether center-of-tile reaction/filter has triggered

  constructor(params: {
    gridX: number;
    gridY: number;
    entryPort: Direction | null;
    exitPort: Direction;
    volume?: number;
    ions?: Partial<Record<IonId, number>>;
  }) {
    this.id = nextPacketUid++;
    this.gridX = params.gridX;
    this.gridY = params.gridY;
    this.entryPort = params.entryPort;
    this.exitPort = params.exitPort;
    this.volume = params.volume ?? 1.0;
    this.dissolvedIons = new Map();
    this.precipitates = new Map();
    this.evolvedGases = new Map();
    this.reagentDoses = {};
    this.progress = params.entryPort === null ? 0.5 : 0.0;

    if (params.ions) {
      for (const [k, v] of Object.entries(params.ions)) {
        if (v && v > 0) {
          this.dissolvedIons.set(k as IonId, v);
        }
      }
    }

    this.colorHex = '#bae6fd';
    this.recalculateColor();
  }

  public cloneForSplit(exitPort: Direction, fraction: number): FluidPacket {
    const child = new FluidPacket({
      gridX: this.gridX,
      gridY: this.gridY,
      entryPort: this.entryPort,
      exitPort,
      volume: this.volume * fraction,
    });
    // Concentrations stay proportional; extensive mass is scaled via packet.volume or stored molarity:
    // Note: dissolvedIons/precipitates/evolvedGases store molar concentration per unit volume,
    // and DrainTile / FilterTile multiply by packet.volume! Wait — let's keep amounts directly as
    // absolute molar quantities in the packet so conservation of mass is 100% transparent!
    child.volume = this.volume * fraction;
    for (const [k, v] of this.dissolvedIons.entries()) {
      child.dissolvedIons.set(k, v * fraction);
    }
    for (const [k, v] of this.precipitates.entries()) {
      child.precipitates.set(k, v * fraction);
    }
    for (const [k, v] of this.evolvedGases.entries()) {
      child.evolvedGases.set(k, v * fraction);
    }
    child.reagentDoses = { ...this.reagentDoses };
    child.slurrySteps = this.slurrySteps;
    child.progress = 0.5;
    child.processedCenter = true;
    child.recalculateColor();
    return child;
  }

  public hasPrecipitates(): boolean {
    for (const v of this.precipitates.values()) {
      if (v > 0.001) return true;
    }
    return false;
  }

  public hasGas(gas: GasId = 'CO2'): boolean {
    return (this.evolvedGases.get(gas) ?? 0) > 0.001;
  }

  public getDominantPrecipitate(): PrecipitateId | null {
    let best: PrecipitateId | null = null;
    let max = 0;
    for (const [p, v] of this.precipitates.entries()) {
      if (v > max) {
        max = v;
        best = p;
      }
    }
    return best;
  }

  public recalculateColor(): void {
    // Blend suspended precipitates strongly, else blend coloured aqueous ions, else clear water tint
    let totalWeight = 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    for (const [ppt, amt] of this.precipitates.entries()) {
      if (amt <= 0.001) continue;
      const [r, g, b] = hexToRgb(PRECIPITATE_DATA[ppt].colorHex);
      const w = amt * 2.6;
      rSum += r * w;
      gSum += g * w;
      bSum += b * w;
      totalWeight += w;
    }

    for (const [ion, amt] of this.dissolvedIons.entries()) {
      if (amt <= 0.001) continue;
      const col = ION_DATA[ion]?.aqueousColor;
      if (!col) continue;
      const [r, g, b] = hexToRgb(col);
      const w = amt * 1.2;
      rSum += r * w;
      gSum += g * w;
      bSum += b * w;
      totalWeight += w;
    }

    if (totalWeight <= 0.001) {
      // Colourless aqueous solution (clear water-cyan tint)
      this.colorHex = '#bae6fd';
      return;
    }

    this.colorHex = rgbToHex(rSum / totalWeight, gSum / totalWeight, bSum / totalWeight);
  }
}
