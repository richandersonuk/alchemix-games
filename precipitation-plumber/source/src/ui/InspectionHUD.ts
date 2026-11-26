import {
  ION_DATA,
  IonId,
  PRECIPITATE_DATA,
  PrecipitateId,
  REAGENT_DATA,
  ReactionEvent,
} from '../data/reactions';
import { FluidSimulator } from '../engine/FluidSimulator';
import { FilterTile } from '../entities/FilterTile';
import { FluidPacket } from '../entities/FluidPacket';
import { InjectorTile } from '../entities/InjectorTile';
import { PipeTile } from '../entities/PipeTile';
import { DrainTile, SourceTile, Tile } from '../entities/Tile';

export class InspectionHUD {
  private container: HTMLElement;
  private reactionLogs: ReactionEvent[] = [];
  private hoveredCell: { x: number; y: number } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setHoveredCell(coord: { x: number; y: number } | null): void {
    this.hoveredCell = coord;
  }

  public pushEvents(events: ReactionEvent[]): void {
    for (const ev of events) {
      // Deduplicate consecutive identical messages so multi-pulse feeds stay readable
      const top = this.reactionLogs[0];
      if (top && top.summary === ev.summary) continue;
      this.reactionLogs.unshift(ev);
    }
    if (this.reactionLogs.length > 18) {
      this.reactionLogs.length = 18;
    }
  }

  public clearLogs(): void {
    this.reactionLogs = [];
  }

  public render(sim: FluidSimulator): void {
    const pptStatuses = sim.getPrecipitateQuotaStatus();
    const drains = sim.grid.getDrains().filter((d) => d.kind !== 'waste');

    const pptHtml = pptStatuses
      .map((st) => {
        const meta = PRECIPITATE_DATA[st.precipitate];
        const pct = Math.min(100, Math.round((st.collectedAmount / st.requiredAmount) * 100));
        const contaminated = st.collectedAmount > 0.01 && st.purity < 90;
        const cls = st.met ? 'met' : contaminated ? 'contaminated' : '';
        const fillCol = contaminated ? '#f43f5e' : st.met ? '#10b981' : '#38bdf8';

        return `
          <div class="quota-row ${cls}">
            <div class="quota-header">
              <span><span class="color-dot" style="background:${meta.colorHex};"></span> ${meta.formula}</span>
              <span style="color:${contaminated ? '#fda4af' : st.met ? '#6ee7b7' : '#cbd5e1'};">
                ${st.purity}% purity ${st.met ? '✓' : ''}
              </span>
            </div>
            <div class="quota-meta">
              <span>Filter Bed Solid</span>
              <span>${st.collectedAmount.toFixed(1)} / ${st.requiredAmount} mol</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%;background:${fillCol};"></div>
            </div>
          </div>
        `;
      })
      .join('');

    const drainHtml = drains
      .map((drn) => {
        const collected = drn.getCollectedTargetAmount();
        const purity = drn.getPurity();
        const met = drn.isQuotaMet();
        const contaminated =
          (drn.packetsReceived > 0 && purity < 90) || drn.getTotalSolidContamination() > 0.01;
        const pct = Math.min(100, Math.round((collected / drn.requiredAmount) * 100));
        const cls = met ? 'met' : contaminated ? 'contaminated' : '';
        const fillCol = contaminated ? '#f43f5e' : met ? '#10b981' : '#38bdf8';

        let dotColor = '#38bdf8';
        if (drn.kind === 'flame' && drn.targetIon && ION_DATA[drn.targetIon].flameColor) {
          dotColor = ION_DATA[drn.targetIon].flameColor!.hex;
        } else if (drn.kind === 'limewater') {
          dotColor = '#f8fafc';
        } else if (drn.targetIon && ION_DATA[drn.targetIon].aqueousColor) {
          dotColor = ION_DATA[drn.targetIon].aqueousColor!;
        }

        return `
          <div class="quota-row ${cls}">
            <div class="quota-header">
              <span><span class="color-dot" style="background:${dotColor};"></span> ${drn.label}</span>
              <span style="color:${contaminated ? '#fda4af' : met ? '#6ee7b7' : '#cbd5e1'};">
                ${purity}% purity ${met ? '✓' : ''}
              </span>
            </div>
            <div class="quota-meta">
              <span>Cell (${drn.x + 1}, ${drn.y + 1})</span>
              <span>${collected.toFixed(1)} / ${drn.requiredAmount} mol</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%;background:${fillCol};"></div>
            </div>
          </div>
        `;
      })
      .join('');

    const inspectorHtml = this.buildCellInspector(sim);

    const logsHtml =
      this.reactionLogs.length === 0
        ? `<div style="font-size:0.875rem;color:var(--text-muted);">Release the contaminated solution to observe live GCSE mark-scheme observations and ionic equations.</div>`
        : this.reactionLogs
            .slice(0, 8)
            .map(
              (ev) => `
              <div class="log-entry ${ev.severity}">
                <div>${ev.summary}</div>
                <div class="log-eq">${ev.equation}</div>
              </div>
            `
            )
            .join('');

    this.container.innerHTML = `
      <div>
        <div class="hud-section-title">
          <span>Target Recovery Quotas</span>
          <span>≥90% PURITY</span>
        </div>
        <div class="info-card">
          ${pptHtml}
          ${drainHtml}
        </div>
      </div>

      <div>
        <div class="hud-section-title"><span>Live Apparatus Inspector</span></div>
        <div class="info-card">
          ${inspectorHtml}
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;min-height:140px;">
        <div class="hud-section-title"><span>Mark-Scheme Observation Log</span></div>
        <div class="info-card" style="flex:1;overflow-y:auto;">
          ${logsHtml}
        </div>
      </div>
    `;
  }

  private buildCellInspector(sim: FluidSimulator): string {
    if (!this.hoveredCell) {
      return `<div style="font-size:0.875rem;color:var(--text-muted);">Hover over any grid cell, reagent dispenser, filter bed, or flowing packet to inspect its chemical species.</div>`;
    }

    const { x, y } = this.hoveredCell;
    const tile: Tile | null = sim.grid.getTile(x, y);
    if (!tile) return '';

    const packetsHere: FluidPacket[] = sim.packets.filter(
      (p) => p.gridX === x && p.gridY === y
    );

    const header = `<div style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;font-weight:700;color:#e0f2fe;">Cell (${x + 1}, ${y + 1}) — ${this.describeTileTitle(tile)}</div>`;

    let details = '';
    if (tile instanceof SourceTile) {
      const badges = Object.keys(tile.ions)
        .map((k) => this.renderIonBadge(k as IonId))
        .join(' ');
      details = `
        <div style="font-size:0.875rem;color:var(--text-muted);">Inflow Reservoir · Pulses left: <strong>${tile.pulsesRemaining}/${tile.totalPulses}</strong></div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">${badges}</div>
      `;
    } else if (tile instanceof InjectorTile) {
      const rMeta = REAGENT_DATA[tile.reagent];
      details = `
        <div style="font-size:0.875rem;color:#bae6fd;">${rMeta.name}</div>
        <div style="font-size:0.844rem;color:var(--text-muted);line-height:1.35;">${rMeta.description}</div>
      `;
    } else if (tile instanceof FilterTile) {
      const solids = Array.from(tile.capturedSolids.entries());
      if (solids.length === 0) {
        details = `<div style="font-size:0.875rem;color:var(--text-muted);">Clean filter paper — waiting to trap solid precipitates while passing dissolved ions.</div>`;
      } else {
        const dom = tile.getDominantPrecipitate();
        const chips = solids
          .map(([p, amt]) => this.renderPrecipBadge(p, amt))
          .join(' ');
        details = `
          <div style="font-size:0.875rem;">Filter Cake Purity: <strong style="color:${dom.purity >= 90 ? '#6ee7b7' : '#fda4af'};">${dom.purity}%</strong></div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${chips}</div>
        `;
      }
    } else if (tile instanceof DrainTile) {
      const reason = tile.getContaminationReason();
      const ions = Array.from(tile.collectedIons.entries())
        .filter(([, v]) => v > 0.02)
        .map(([k]) => this.renderIonBadge(k))
        .join(' ');
      details = `
        <div style="font-size:0.875rem;color:var(--text-muted);">Purity: <strong>${tile.getPurity()}%</strong> · Collected: <strong>${tile.getCollectedTargetAmount().toFixed(1)} / ${tile.requiredAmount}</strong></div>
        ${ions ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${ions}</div>` : ''}
        ${reason ? `<div style="font-size:0.844rem;color:#fda4af;">${reason}</div>` : ''}
      `;
    } else if (tile instanceof PipeTile) {
      details = `<div style="font-size:0.875rem;color:var(--text-muted);">Sludge accumulation: <strong>${Math.round(tile.sludgeLoad * 100)}%</strong> ${tile.ruptured ? '· <span style="color:#f43f5e;font-weight:700;">RUPTURED!</span>' : ''}</div>`;
    } else {
      details = `<div style="font-size:0.875rem;color:var(--text-muted);">Empty workbench slot. Click to place selected apparatus.</div>`;
    }

    if (packetsHere.length > 0) {
      const p = packetsHere[0];
      const ionChips = Array.from(p.dissolvedIons.keys())
        .map((i) => this.renderIonBadge(i))
        .join(' ');
      const pptChips = Array.from(p.precipitates.entries())
        .map(([id, amt]) => this.renderPrecipBadge(id, amt))
        .join(' ');
      const gasBadge = p.hasGas('CO2')
        ? `<span class="chem-badge">🫧 CO₂(g)↑</span>`
        : '';

      details += `
        <div style="margin-top:4px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.16);font-size:0.844rem;">
          <div style="color:#7dd3fc;margin-bottom:4px;font-weight:600;">Traversing Fluid Packet:</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${ionChips} ${pptChips} ${gasBadge}</div>
        </div>
      `;
    }

    return `${header}${details}`;
  }

  private describeTileTitle(tile: Tile): string {
    if (tile instanceof SourceTile) return tile.label;
    if (tile instanceof DrainTile) return tile.label;
    if (tile instanceof InjectorTile) return REAGENT_DATA[tile.reagent].formula;
    if (tile instanceof FilterTile) return 'Buchner Filter Bed';
    if (tile instanceof PipeTile) return `${tile.variant.toUpperCase()} PIPE`;
    return 'Empty Slot';
  }

  private renderIonBadge(ion: IonId): string {
    const meta = ION_DATA[ion];
    const dot = meta.aqueousColor ?? meta.flameColor?.hex ?? '#94a3b8';
    return `<span class="chem-badge"><span class="color-dot" style="background:${dot};"></span>${meta.formula}</span>`;
  }

  private renderPrecipBadge(ppt: PrecipitateId, amt: number): string {
    const meta = PRECIPITATE_DATA[ppt];
    return `<span class="chem-badge"><span class="color-dot" style="background:${meta.colorHex};"></span>${meta.formula} (${amt.toFixed(1)})</span>`;
  }
}
