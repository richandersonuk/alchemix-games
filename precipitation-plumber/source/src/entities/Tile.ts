import {
  Direction,
  GasId,
  ION_DATA,
  IonId,
  PRECIPITATE_DATA,
  PrecipitateId,
} from '../data/reactions';
import { DrainFixture, SourceFixture } from '../data/levels';
import { FluidPacket } from './FluidPacket';

export type TileCategory = 'empty' | 'source' | 'pipe' | 'injector' | 'filter' | 'drain';

export const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

export function rotateDirection(dir: Direction, stepsClockwise: number): Direction {
  const idx = DIRECTIONS.indexOf(dir);
  const next = ((idx + stepsClockwise) % 4 + 4) % 4;
  return DIRECTIONS[next];
}

export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'N':
      return 'S';
    case 'S':
      return 'N';
    case 'E':
      return 'W';
    case 'W':
      return 'E';
  }
}

export function directionVector(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 'N':
      return { dx: 0, dy: -1 };
    case 'E':
      return { dx: 1, dy: 0 };
    case 'S':
      return { dx: 0, dy: 1 };
    case 'W':
      return { dx: -1, dy: 0 };
  }
}

export abstract class Tile {
  public readonly category: TileCategory;
  public x: number;
  public y: number;
  public rotation: number; // 0, 1, 2, 3 (90 deg clockwise steps)
  public fixed: boolean;

  constructor(category: TileCategory, x: number, y: number, rotation = 0, fixed = false) {
    this.category = category;
    this.x = x;
    this.y = y;
    this.rotation = ((rotation % 4) + 4) % 4;
    this.fixed = fixed;
  }

  public rotateClockwise(): void {
    if (!this.fixed) {
      this.rotation = (this.rotation + 1) % 4;
    }
  }

  /** All open ports on this tile in its current rotation */
  public abstract getOpenPorts(): Direction[];

  /** Given fluid entering through `entryPort` (side of this tile), returns outgoing port(s) */
  public abstract getExitPorts(entryPort: Direction): Direction[];

  /** Reset transient simulation state when resetting flow */
  public resetSimulationState(): void {
    // Subclasses override if stateful
  }
}

export class EmptyTile extends Tile {
  constructor(x: number, y: number) {
    super('empty', x, y, 0, false);
  }

  public getOpenPorts(): Direction[] {
    return [];
  }

  public getExitPorts(): Direction[] {
    return [];
  }
}

export class SourceTile extends Tile {
  public readonly outDir: Direction;
  public readonly label: string;
  public readonly ions: Partial<Record<IonId, number>>;
  public readonly totalPulses: number;
  public pulsesRemaining: number;
  public pulseFlash = 0;

  constructor(fixture: SourceFixture) {
    super('source', fixture.x, fixture.y, 0, true);
    this.outDir = fixture.outDir;
    this.label = fixture.label;
    this.ions = { ...fixture.ions };
    this.totalPulses = fixture.pulses;
    this.pulsesRemaining = fixture.pulses;
  }

  public getOpenPorts(): Direction[] {
    return [this.outDir];
  }

  public getExitPorts(): Direction[] {
    return [];
  }

  public override resetSimulationState(): void {
    this.pulsesRemaining = this.totalPulses;
    this.pulseFlash = 0;
  }
}

export class DrainTile extends Tile {
  public readonly inDir: Direction;
  public readonly kind: DrainFixture['kind'];
  public readonly label: string;
  public readonly shortLabel: string;
  public readonly targetIon?: IonId;
  public readonly targetGas?: GasId;
  public readonly requiredAmount: number;

  public collectedIons: Map<IonId, number> = new Map();
  public collectedGases: Map<GasId, number> = new Map();
  public solidContamination: Map<PrecipitateId, number> = new Map();
  public packetsReceived = 0;
  public limewaterCloudiness = 0; // 0..1
  public activeFlameHex: string | null = null;
  public activeFlameCoreHex: string | null = null;
  public flameIntensity = 0;

  constructor(fixture: DrainFixture) {
    super('drain', fixture.x, fixture.y, 0, true);
    this.inDir = fixture.inDir;
    this.kind = fixture.kind;
    this.label = fixture.label;
    this.shortLabel = fixture.shortLabel;
    this.targetIon = fixture.targetIon;
    this.targetGas = fixture.targetGas;
    this.requiredAmount = fixture.requiredAmount;
  }

  public getOpenPorts(): Direction[] {
    return [this.inDir];
  }

  public getExitPorts(): Direction[] {
    return [];
  }

  public receivePacket(packet: FluidPacket): string | null {
    this.packetsReceived += 1;
    let alertMsg: string | null = null;

    for (const [ion, amt] of packet.dissolvedIons.entries()) {
      if (amt > 0.001) {
        this.collectedIons.set(ion, (this.collectedIons.get(ion) ?? 0) + amt);
      }
    }

    for (const [gas, amt] of packet.evolvedGases.entries()) {
      if (amt > 0.001) {
        this.collectedGases.set(gas, (this.collectedGases.get(gas) ?? 0) + amt);
      }
    }

    for (const [ppt, amt] of packet.precipitates.entries()) {
      if (amt > 0.001) {
        this.solidContamination.set(ppt, (this.solidContamination.get(ppt) ?? 0) + amt);
        alertMsg = `CONTAMINATION at ${this.label}: Unfiltered ${PRECIPITATE_DATA[ppt].formula} sludge entered the chamber!`;
      }
    }

    if (this.kind === 'limewater') {
      const co2 = this.collectedGases.get('CO2') ?? 0;
      if (co2 > 0) {
        this.limewaterCloudiness = Math.min(1, co2 / Math.max(1, this.requiredAmount));
      }
    } else if (this.kind === 'flame') {
      this.updateFlameAppearance();
      const maskErr = this.getContaminationReason();
      if (maskErr && !alertMsg) {
        alertMsg = maskErr;
      }
    } else if (this.kind === 'aqueous') {
      const aqErr = this.getContaminationReason();
      if (aqErr && !alertMsg) {
        alertMsg = aqErr;
      }
    }

    return alertMsg;
  }

  private updateFlameAppearance(): void {
    // Dominant flame ion weighted by maskingWeight (e.g. Na+ glare masks K+)
    let bestIon: IonId | null = null;
    let bestScore = 0;

    for (const [ion, amt] of this.collectedIons.entries()) {
      const meta = ION_DATA[ion];
      if (meta?.flameColor && amt > 0.01) {
        const score = amt * meta.flameColor.maskingWeight;
        if (score > bestScore) {
          bestScore = score;
          bestIon = ion;
        }
      }
    }

    if (bestIon && ION_DATA[bestIon].flameColor) {
      this.activeFlameHex = ION_DATA[bestIon].flameColor!.hex;
      this.activeFlameCoreHex = ION_DATA[bestIon].flameColor!.coreHex;
      this.flameIntensity = 1;
    }
  }

  public getCollectedTargetAmount(): number {
    if (this.kind === 'limewater' && this.targetGas) {
      return this.collectedGases.get(this.targetGas) ?? 0;
    }
    if (this.targetIon) {
      return this.collectedIons.get(this.targetIon) ?? 0;
    }
    return 0;
  }

  public getTotalSolidContamination(): number {
    let total = 0;
    for (const v of this.solidContamination.values()) total += v;
    return total;
  }

  public getPurity(): number {
    const solids = this.getTotalSolidContamination();

    if (this.kind === 'limewater' && this.targetGas) {
      const gasAmt = this.collectedGases.get(this.targetGas) ?? 0;
      if (gasAmt <= 0.001 && solids <= 0.001) return 100;
      if (gasAmt <= 0.001) return 0;
      return Math.round((gasAmt / (gasAmt + solids * 2)) * 100);
    }

    if (this.kind === 'flame' && this.targetIon) {
      const targetAmt = this.collectedIons.get(this.targetIon) ?? 0;
      let weightedCompeting = solids * 2;

      for (const [ion, amt] of this.collectedIons.entries()) {
        if (ion === this.targetIon || amt <= 0.001) continue;
        const meta = ION_DATA[ion];
        // Competing flame ions or unseparated transition/group cations contaminate the flame test
        if (meta.flameColor) {
          weightedCompeting += amt * meta.flameColor.maskingWeight;
        } else if (meta.chargeType === 'cation' && !meta.isSpectator) {
          weightedCompeting += amt;
        }
      }

      if (targetAmt <= 0.001 && weightedCompeting <= 0.001) return 100;
      if (targetAmt <= 0.001) return 0;
      return Math.round((targetAmt / (targetAmt + weightedCompeting)) * 100);
    }

    if (this.kind === 'aqueous' && this.targetIon) {
      const targetAmt = this.collectedIons.get(this.targetIon) ?? 0;
      let foreignMetalOrComplex = solids * 2;

      for (const [ion, amt] of this.collectedIons.entries()) {
        if (ion === this.targetIon || amt <= 0.001) continue;
        const meta = ION_DATA[ion];
        // Spectator counter-ions (Na+, NH4+, NO3-, Cl-) from reagents are expected in aqueous filtrate;
        // unseparated heavy/group cations or wrong complexes reduce purity!
        if (
          !meta.isSpectator &&
          ion !== 'Na+' &&
          (meta.chargeType === 'cation' || meta.chargeType === 'complex')
        ) {
          foreignMetalOrComplex += amt;
        }
      }

      if (targetAmt <= 0.001 && foreignMetalOrComplex <= 0.001) return 100;
      if (targetAmt <= 0.001) return 0;
      return Math.round((targetAmt / (targetAmt + foreignMetalOrComplex)) * 100);
    }

    return 100;
  }

  public getContaminationReason(): string | null {
    if (this.getTotalSolidContamination() > 0.01) {
      const firstSolid = Array.from(this.solidContamination.keys())[0];
      return `Unfiltered ${PRECIPITATE_DATA[firstSolid].formula} solid entered ${this.label}! Place a Filter Bed upstream.`;
    }

    if (this.kind === 'flame' && this.targetIon) {
      if (this.targetIon === 'K+' && (this.collectedIons.get('Na+') ?? 0) > 0.05) {
        return `MARK-SCHEME ERROR: Intense Yellow Na⁺ flame masked the pale Lilac K⁺ flame! Use NH₃(aq) instead of NaOH.`;
      }
      for (const [ion, amt] of this.collectedIons.entries()) {
        if (ion !== this.targetIon && amt > 0.05 && !ION_DATA[ion].isSpectator) {
          if (ION_DATA[ion].chargeType === 'cation') {
            return `Cross-contamination: Unseparated ${ION_DATA[ion].formula} entered ${this.label}.`;
          }
        }
      }
    }

    if (this.kind === 'aqueous' && this.targetIon) {
      for (const [ion, amt] of this.collectedIons.entries()) {
        if (
          ion !== this.targetIon &&
          amt > 0.05 &&
          !ION_DATA[ion].isSpectator &&
          ion !== 'Na+' &&
          (ION_DATA[ion].chargeType === 'cation' || ION_DATA[ion].chargeType === 'complex')
        ) {
          return `Cross-contamination: Unseparated ${ION_DATA[ion].formula} entered ${this.label}.`;
        }
      }
    }

    return null;
  }

  public isQuotaMet(): boolean {
    return (
      this.getCollectedTargetAmount() + 0.01 >= this.requiredAmount && this.getPurity() >= 90
    );
  }

  public override resetSimulationState(): void {
    this.collectedIons.clear();
    this.collectedGases.clear();
    this.solidContamination.clear();
    this.packetsReceived = 0;
    this.limewaterCloudiness = 0;
    this.activeFlameHex = null;
    this.activeFlameCoreHex = null;
    this.flameIntensity = 0;
  }
}
