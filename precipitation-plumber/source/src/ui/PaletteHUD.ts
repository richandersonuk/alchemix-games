import { REAGENT_DATA, ReagentId } from '../data/reactions';
import { PaletteInventory, PipeVariant } from '../data/levels';
import { FilterTile } from '../entities/FilterTile';
import { InjectorTile } from '../entities/InjectorTile';
import { PipeTile } from '../entities/PipeTile';
import { Tile } from '../entities/Tile';

export type SelectedTool =
  | { kind: 'pipe'; variant: PipeVariant }
  | { kind: 'injector'; reagent: ReagentId }
  | { kind: 'filter' }
  | { kind: 'eraser' };

const PIPE_LABELS: Record<PipeVariant, { name: string; sub: string; icon: string }> = {
  straight: { name: 'Straight Pipe', sub: 'Linear glass conduit', icon: '═' },
  elbow: { name: '90° Elbow', sub: 'Turns flow corner', icon: '╚' },
  tee: { name: 'T-Junction', sub: 'Splits stream 50 / 50', icon: '╩' },
  crossover: { name: 'Cross-Over', sub: 'Bridges 2 lines safely', icon: '╬' },
};

export class PaletteHUD {
  private container: HTMLElement;
  private remainingPipes: Partial<Record<PipeVariant, number>> = {};
  private remainingReagents: Partial<Record<ReagentId, number>> = {};
  private remainingFilters = 0;

  public selectedTool: SelectedTool = { kind: 'pipe', variant: 'straight' };
  public previewRotation = 0;
  private onChangeCallback?: () => void;

  constructor(container: HTMLElement, onChange?: () => void) {
    this.container = container;
    this.onChangeCallback = onChange;
  }

  public loadInventory(inv: PaletteInventory): void {
    this.remainingPipes = { ...inv.pipes };
    this.remainingReagents = { ...inv.reagents };
    this.remainingFilters = inv.filters;
    this.previewRotation = 0;

    // Default to first available pipe
    const firstPipe = (Object.keys(inv.pipes) as PipeVariant[]).find(
      (k) => (inv.pipes[k] ?? 0) > 0
    );
    if (firstPipe) {
      this.selectedTool = { kind: 'pipe', variant: firstPipe };
    } else {
      this.selectedTool = { kind: 'filter' };
    }
    this.render();
  }

  public rotatePreview(): void {
    this.previewRotation = (this.previewRotation + 1) % 4;
    this.render();
    this.onChangeCallback?.();
  }

  public canAffordSelected(): boolean {
    const t = this.selectedTool;
    if (t.kind === 'eraser') return true;
    if (t.kind === 'pipe') return (this.remainingPipes[t.variant] ?? 0) > 0;
    if (t.kind === 'injector') return (this.remainingReagents[t.reagent] ?? 0) > 0;
    if (t.kind === 'filter') return this.remainingFilters > 0;
    return false;
  }

  public createTileForSelected(x: number, y: number): Tile | null {
    if (!this.canAffordSelected()) return null;
    const t = this.selectedTool;
    if (t.kind === 'pipe') {
      this.remainingPipes[t.variant] = (this.remainingPipes[t.variant] ?? 1) - 1;
      this.render();
      return new PipeTile(t.variant, x, y, this.previewRotation);
    }
    if (t.kind === 'injector') {
      this.remainingReagents[t.reagent] = (this.remainingReagents[t.reagent] ?? 1) - 1;
      this.render();
      return new InjectorTile(t.reagent, x, y, this.previewRotation);
    }
    if (t.kind === 'filter') {
      this.remainingFilters -= 1;
      this.render();
      return new FilterTile(x, y, this.previewRotation);
    }
    return null;
  }

  public buildPreviewTile(x: number, y: number): Tile | null {
    const t = this.selectedTool;
    if (t.kind === 'pipe') return new PipeTile(t.variant, x, y, this.previewRotation);
    if (t.kind === 'injector') return new InjectorTile(t.reagent, x, y, this.previewRotation);
    if (t.kind === 'filter') return new FilterTile(x, y, this.previewRotation);
    return null;
  }

  public refundTile(tile: Tile): void {
    if (tile instanceof PipeTile) {
      this.remainingPipes[tile.variant] = (this.remainingPipes[tile.variant] ?? 0) + 1;
    } else if (tile instanceof InjectorTile) {
      this.remainingReagents[tile.reagent] = (this.remainingReagents[tile.reagent] ?? 0) + 1;
    } else if (tile instanceof FilterTile) {
      this.remainingFilters += 1;
    }
    this.render();
  }

  private isSelected(candidate: SelectedTool): boolean {
    if (this.selectedTool.kind !== candidate.kind) return false;
    if (candidate.kind === 'pipe' && this.selectedTool.kind === 'pipe') {
      return candidate.variant === this.selectedTool.variant;
    }
    if (candidate.kind === 'injector' && this.selectedTool.kind === 'injector') {
      return candidate.reagent === this.selectedTool.reagent;
    }
    return true;
  }

  public render(): void {
    const deg = this.previewRotation * 90;

    const pipeButtons = (Object.keys(PIPE_LABELS) as PipeVariant[])
      .filter((v) => this.remainingPipes[v] !== undefined)
      .map((variant) => {
        const qty = this.remainingPipes[variant] ?? 0;
        const meta = PIPE_LABELS[variant];
        const sel = this.isSelected({ kind: 'pipe', variant });
        return `
          <button class="palette-btn ${sel ? 'selected' : ''} ${qty <= 0 ? 'depleted' : ''}"
                  data-tool="pipe" data-variant="${variant}">
            <div class="palette-item-info">
              <span class="palette-item-name">${meta.icon} ${meta.name}</span>
              <span class="palette-item-sub">${meta.sub}</span>
            </div>
            <span class="palette-qty">×${qty}</span>
          </button>
        `;
      })
      .join('');

    const reagentButtons = (Object.keys(REAGENT_DATA) as ReagentId[])
      .filter((r) => this.remainingReagents[r] !== undefined)
      .map((reagent) => {
        const qty = this.remainingReagents[reagent] ?? 0;
        const meta = REAGENT_DATA[reagent];
        const sel = this.isSelected({ kind: 'injector', reagent });
        return `
          <button class="palette-btn ${sel ? 'selected' : ''} ${qty <= 0 ? 'depleted' : ''}"
                  data-tool="injector" data-reagent="${reagent}"
                  title="${meta.description}">
            <div style="display:flex;align-items:center;gap:8px;min-width:0;">
              <span class="reagent-swatch" style="background:${meta.bottleColor};"></span>
              <div class="palette-item-info">
                <span class="palette-item-name">💧 ${meta.formula}</span>
                <span class="palette-item-sub">${meta.name}</span>
              </div>
            </div>
            <span class="palette-qty">×${qty}</span>
          </button>
        `;
      })
      .join('');

    const filterSel = this.isSelected({ kind: 'filter' });
    const eraserSel = this.isSelected({ kind: 'eraser' });

    this.container.innerHTML = `
      <div>
        <div class="hud-section-title">
          <span>Orientation</span>
          <span>${deg}° CW</span>
        </div>
        <div class="rotation-bar">
          <span>Press <span class="kbd-tag">R</span> or Right-Click</span>
          <button id="btn-rotate-tool" class="ctrl-btn" style="padding:4px 9px;font-size:0.844rem;">↻ ROTATE</button>
        </div>
      </div>

      <div>
        <div class="hud-section-title"><span>Glassware Conduits</span></div>
        <div class="palette-list">${pipeButtons}</div>
      </div>

      <div>
        <div class="hud-section-title"><span>Reagent Injectors</span></div>
        <div class="palette-list">${reagentButtons}</div>
      </div>

      <div>
        <div class="hud-section-title"><span>Separation & Tools</span></div>
        <div class="palette-list">
          <button class="palette-btn ${filterSel ? 'selected' : ''} ${this.remainingFilters <= 0 ? 'depleted' : ''}"
                  data-tool="filter"
                  title="Traps solid precipitates onto filter paper while clear supernatant liquid passes through.">
            <div class="palette-item-info">
              <span class="palette-item-name">⏳ Buchner Filter Bed</span>
              <span class="palette-item-sub">Retains solid precipitate; passes filtrate</span>
            </div>
            <span class="palette-qty">×${this.remainingFilters}</span>
          </button>

          <button class="palette-btn ${eraserSel ? 'selected' : ''}" data-tool="eraser">
            <div class="palette-item-info">
              <span class="palette-item-name">🔧 Spanner / Remove</span>
              <span class="palette-item-sub">Dismantle tile & refund to stock</span>
            </div>
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-rotate-tool')?.addEventListener('click', () => {
      this.rotatePreview();
    });

    this.container.querySelectorAll<HTMLButtonElement>('.palette-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool === 'pipe' && btn.dataset.variant) {
          this.selectedTool = { kind: 'pipe', variant: btn.dataset.variant as PipeVariant };
        } else if (tool === 'injector' && btn.dataset.reagent) {
          this.selectedTool = { kind: 'injector', reagent: btn.dataset.reagent as ReagentId };
        } else if (tool === 'filter') {
          this.selectedTool = { kind: 'filter' };
        } else if (tool === 'eraser') {
          this.selectedTool = { kind: 'eraser' };
        }
        this.render();
        this.onChangeCallback?.();
      });
    });
  }
}
