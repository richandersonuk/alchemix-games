import { PRECIPITATE_DATA, PrecipitateId, ReactionEvent } from '../data/reactions';
import { LevelDefinition } from '../data/levels';
import { FilterTile } from '../entities/FilterTile';
import { FluidPacket } from '../entities/FluidPacket';
import { InjectorTile } from '../entities/InjectorTile';
import { PipeTile } from '../entities/PipeTile';
import { DrainTile, oppositeDirection } from '../entities/Tile';
import { ChemistryEngine } from './ChemistryEngine';
import { Grid } from './Grid';

export type SimStatus = 'idle' | 'running' | 'won' | 'failed';

export interface SimCallbacks {
  onReactionEvents?: (events: ReactionEvent[]) => void;
  onStatusChange?: (status: SimStatus, reason?: string) => void;
  onSoundEffect?: (
    sfx: 'pulse' | 'inject' | 'filter' | 'fizz' | 'flame' | 'rupture' | 'win' | 'fail'
  ) => void;
}

export class FluidSimulator {
  public readonly grid: Grid;
  public readonly chemistry: ChemistryEngine;
  public level: LevelDefinition;
  public status: SimStatus = 'idle';
  public packets: FluidPacket[] = [];
  public speedMultiplier = 1;
  public failureReason: string | null = null;
  public spillLocation: { x: number; y: number; color: string } | null = null;

  private pulseTimer = 0;
  private readonly pulseInterval = 1.25; // seconds between pulses at 1x
  private readonly packetBaseSpeed = 1.45; // tiles per second at 1x
  private callbacks: SimCallbacks;

  constructor(grid: Grid, chemistry: ChemistryEngine, level: LevelDefinition, callbacks: SimCallbacks = {}) {
    this.grid = grid;
    this.chemistry = chemistry;
    this.level = level;
    this.callbacks = callbacks;
  }

  public setLevel(level: LevelDefinition): void {
    this.level = level;
    this.reset();
  }

  public start(): void {
    if (this.status === 'running') return;
    this.reset();
    this.status = 'running';
    this.pulseTimer = 0; // Immediately release first pulse on first tick
    this.emitFirstPulse();
    this.callbacks.onStatusChange?.('running');
  }

  public reset(): void {
    this.packets = [];
    this.status = 'idle';
    this.failureReason = null;
    this.spillLocation = null;
    this.pulseTimer = 0;
    this.grid.resetSimulationState();
    this.callbacks.onStatusChange?.('idle');
  }

  private emitFirstPulse(): void {
    this.releaseSourcePulses();
    this.pulseTimer = this.pulseInterval;
  }

  private releaseSourcePulses(): boolean {
    let emitted = false;
    for (const src of this.grid.getSources()) {
      if (src.pulsesRemaining > 0) {
        src.pulsesRemaining -= 1;
        src.pulseFlash = 1.0;
        const pkt = new FluidPacket({
          gridX: src.x,
          gridY: src.y,
          entryPort: null,
          exitPort: src.outDir,
          volume: 1.0,
          ions: src.ions,
        });
        pkt.processedCenter = true;
        this.packets.push(pkt);
        emitted = true;
      }
    }
    if (emitted) {
      this.callbacks.onSoundEffect?.('pulse');
    }
    return emitted;
  }

  public update(dt: number): void {
    // Decay visual tile flashes even if not actively propagating
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const t = this.grid.getTile(x, y);
        if (t instanceof InjectorTile && t.dropAnimTimer > 0) {
          t.dropAnimTimer = Math.max(0, t.dropAnimTimer - dt * 2.4);
        } else if (t instanceof FilterTile && t.filtrationFlash > 0) {
          t.filtrationFlash = Math.max(0, t.filtrationFlash - dt * 2.2);
        }
      }
    }
    for (const src of this.grid.getSources()) {
      if (src.pulseFlash > 0) {
        src.pulseFlash = Math.max(0, src.pulseFlash - dt * 2.5);
      }
    }

    if (this.status !== 'running') return;

    const scaledDt = Math.min(dt, 0.08) * this.speedMultiplier;

    // Timed source pulses
    const anyPulsesLeft = this.grid.getSources().some((s) => s.pulsesRemaining > 0);
    if (anyPulsesLeft) {
      this.pulseTimer -= scaledDt;
      if (this.pulseTimer <= 0) {
        this.releaseSourcePulses();
        this.pulseTimer = this.pulseInterval;
      }
    }

    // Advance packets
    const nextPackets: FluidPacket[] = [];
    const newlySpawnedSplits: FluidPacket[] = [];

    for (const pkt of this.packets) {
      pkt.progress += scaledDt * this.packetBaseSpeed;

      // Center-of-tile evaluation
      if (!pkt.processedCenter && pkt.progress >= 0.5) {
        pkt.processedCenter = true;
        const tile = this.grid.getTile(pkt.gridX, pkt.gridY);

        if (tile instanceof InjectorTile) {
          tile.triggerDropAnimation();
          const hadGas = pkt.hasGas('CO2');
          const events = this.chemistry.applyReagent(pkt, tile.reagent);
          if (events.length > 0) {
            this.callbacks.onReactionEvents?.(events);
          }
          if (!hadGas && pkt.hasGas('CO2')) {
            this.callbacks.onSoundEffect?.('fizz');
          } else {
            this.callbacks.onSoundEffect?.('inject');
          }
        } else if (tile instanceof FilterTile) {
          const hadSolids = pkt.hasPrecipitates();
          const events = this.chemistry.applyFilter(pkt, tile);
          if (events.length > 0) {
            this.callbacks.onReactionEvents?.(events);
          }
          if (hadSolids) {
            this.callbacks.onSoundEffect?.('filter');
          }
        } else if (tile instanceof PipeTile) {
          // Check unfiltered precipitate clogging standard pipes!
          if (pkt.hasPrecipitates()) {
            pkt.slurrySteps += 1;
            tile.sludgeLoad = Math.min(1, Math.max(tile.sludgeLoad, pkt.slurrySteps / 2.5));

            if (pkt.slurrySteps >= 3) {
              const domPpt = pkt.getDominantPrecipitate();
              const pptLabel = domPpt ? PRECIPITATE_DATA[domPpt].formula : 'precipitate';
              tile.ruptured = true;
              tile.clogPrecipitate = domPpt;
              this.spillLocation = { x: tile.x, y: tile.y, color: pkt.colorHex };
              this.triggerFailure(
                `PIPE RUPTURE at (${tile.x + 1}, ${tile.y + 1}): Unfiltered ${pptLabel} settled and clogged a standard pipe! Place a Filter Bed (or redissolving reagent) within 2 pipe tiles of precipitation.`
              );
              this.callbacks.onSoundEffect?.('rupture');
              return;
            }
          }

          // T-Junction stream splitting
          if (tile.variant === 'tee' && pkt.entryPort) {
            const exits = tile.getExitPorts(pkt.entryPort);
            if (exits.length === 2) {
              const branchA = pkt.cloneForSplit(exits[0], 0.5);
              const branchB = pkt.cloneForSplit(exits[1], 0.5);
              newlySpawnedSplits.push(branchA, branchB);
              continue; // Replace parent packet with the 2 split children
            }
          }
        }
      }

      // Tile boundary transition
      if (pkt.progress >= 1.0) {
        const neighbor = this.grid.getNeighbor(pkt.gridX, pkt.gridY, pkt.exitPort);
        const entryOnNeighbor = oppositeDirection(pkt.exitPort);

        if (!neighbor || !neighbor.getOpenPorts().includes(entryOnNeighbor)) {
          this.spillLocation = { x: pkt.gridX, y: pkt.gridY, color: pkt.colorHex };
          this.triggerFailure(
            `UNCONNECTED PIPE LEAK from (${pkt.gridX + 1}, ${pkt.gridY + 1}) heading ${pkt.exitPort}! Ensure every open pipe outlet connects cleanly to an apparatus port.`
          );
          this.callbacks.onSoundEffect?.('rupture');
          return;
        }

        if (neighbor instanceof DrainTile) {
          const contaminationMsg = neighbor.receivePacket(pkt);
          if (neighbor.kind === 'flame') {
            this.callbacks.onSoundEffect?.('flame');
          } else if (neighbor.kind === 'limewater' && pkt.hasGas('CO2')) {
            this.callbacks.onSoundEffect?.('fizz');
          }

          if (contaminationMsg) {
            this.callbacks.onReactionEvents?.([
              {
                summary: contaminationMsg,
                equation: 'Check separation sequence & reagent choice',
                severity: 'error',
              },
            ]);
          }
          // Packet absorbed by drain
          continue;
        }

        const nextExits = neighbor.getExitPorts(entryOnNeighbor);
        if (nextExits.length === 0) {
          this.spillLocation = { x: neighbor.x, y: neighbor.y, color: pkt.colorHex };
          this.triggerFailure(
            `BLOCKED FLOW at (${neighbor.x + 1}, ${neighbor.y + 1}): Fluid cannot exit this tile.`
          );
          return;
        }

        pkt.gridX = neighbor.x;
        pkt.gridY = neighbor.y;
        pkt.entryPort = entryOnNeighbor;
        pkt.exitPort = nextExits[0];
        pkt.progress = pkt.progress - 1.0;
        pkt.processedCenter = false;
      }

      nextPackets.push(pkt);
    }

    this.packets = [...nextPackets, ...newlySpawnedSplits];

    // Check completion when all sources have finished and all packets have drained
    const stillEmitting = this.grid.getSources().some((s) => s.pulsesRemaining > 0);
    if (!stillEmitting && this.packets.length === 0) {
      this.evaluateFinalOutcome();
    }
  }

  private triggerFailure(reason: string): void {
    this.status = 'failed';
    this.failureReason = reason;
    this.callbacks.onReactionEvents?.([
      {
        summary: reason,
        equation: 'Click RESET FLOW to adjust your pipeline',
        severity: 'error',
      },
    ]);
    this.callbacks.onStatusChange?.('failed', reason);
  }

  public getPrecipitateQuotaStatus(): Array<{
    precipitate: PrecipitateId;
    requiredAmount: number;
    collectedAmount: number;
    purity: number;
    met: boolean;
    filterCoord: { x: number; y: number } | null;
  }> {
    const filters = this.grid.getFilters();
    const usedFilters = new Set<FilterTile>();

    return this.level.precipitateQuotas.map((q) => {
      let bestFilter: FilterTile | null = null;
      let bestScore = -1;

      for (const f of filters) {
        if (usedFilters.has(f)) continue;
        const { amount, purity } = f.getPurityFor(q.precipitate);
        const score = amount * (purity / 100);
        if (amount > 0 && score > bestScore) {
          bestScore = score;
          bestFilter = f;
        }
      }

      if (!bestFilter) {
        return {
          precipitate: q.precipitate,
          requiredAmount: q.requiredAmount,
          collectedAmount: 0,
          purity: 100,
          met: false,
          filterCoord: null,
        };
      }

      usedFilters.add(bestFilter);
      const { amount, purity } = bestFilter.getPurityFor(q.precipitate);
      return {
        precipitate: q.precipitate,
        requiredAmount: q.requiredAmount,
        collectedAmount: amount,
        purity,
        met: amount + 0.01 >= q.requiredAmount && purity >= 90,
        filterCoord: { x: bestFilter.x, y: bestFilter.y },
      };
    });
  }

  private evaluateFinalOutcome(): void {
    // 1. Check any co-contaminated filter beds first
    for (const f of this.grid.getFilters()) {
      const dom = f.getDominantPrecipitate();
      if (dom.id && dom.purity < 90) {
        this.callbacks.onSoundEffect?.('fail');
        this.triggerFailure(
          `CROSS-CONTAMINATION on Filter Bed (${f.x + 1}, ${f.y + 1}): Mixed precipitates captured together (${dom.purity}% purity; ≥90% required).`
        );
        return;
      }
    }

    // 2. Check precipitate quotas
    const pptStatuses = this.getPrecipitateQuotaStatus();
    for (const st of pptStatuses) {
      if (!st.met) {
        const formula = PRECIPITATE_DATA[st.precipitate].formula;
        this.callbacks.onSoundEffect?.('fail');
        if (st.collectedAmount < 0.01) {
          this.triggerFailure(
            `MISSING ISOLATION: No ${formula} was recovered on a Filter Bed! Inject the appropriate reagent and filter the precipitate.`
          );
        } else if (st.purity < 90) {
          this.triggerFailure(
            `IMPURE PRECIPITATE: ${formula} purity was ${st.purity}% (≥90% required). Prevent co-precipitation or redissolve interfering solids first!`
          );
        } else {
          this.triggerFailure(
            `INSUFFICIENT YIELD: Collected ${st.collectedAmount.toFixed(1)} / ${st.requiredAmount} units of ${formula}.`
          );
        }
        return;
      }
    }

    // 3. Check all fixed DrainTile quotas
    for (const drn of this.grid.getDrains()) {
      if (drn.kind === 'waste') continue;
      const reason = drn.getContaminationReason();
      if (reason || drn.getPurity() < 90) {
        this.callbacks.onSoundEffect?.('fail');
        this.triggerFailure(
          reason ??
            `CROSS-CONTAMINATION at ${drn.label}: Purity ${drn.getPurity()}% is below the 90% GCSE recovery standard.`
        );
        return;
      }
      if (!drn.isQuotaMet()) {
        this.callbacks.onSoundEffect?.('fail');
        this.triggerFailure(
          `INCOMPLETE RECOVERY at ${drn.label}: Delivered ${drn.getCollectedTargetAmount().toFixed(1)} / ${drn.requiredAmount} required units.`
        );
        return;
      }
    }

    // Victory!
    this.status = 'won';
    this.callbacks.onSoundEffect?.('win');
    this.callbacks.onStatusChange?.('won');
  }
}
