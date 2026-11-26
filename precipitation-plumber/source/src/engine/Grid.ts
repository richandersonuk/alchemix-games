import { Direction } from '../data/reactions';
import { LevelDefinition } from '../data/levels';
import {
  directionVector,
  DrainTile,
  EmptyTile,
  oppositeDirection,
  SourceTile,
  Tile,
} from '../entities/Tile';
import { FilterTile } from '../entities/FilterTile';

export class Grid {
  public readonly cols: number;
  public readonly rows: number;
  private cells: Tile[][];

  constructor(cols = 8, rows = 6) {
    this.cols = cols;
    this.rows = rows;
    this.cells = [];
    for (let y = 0; y < rows; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < cols; x++) {
        row.push(new EmptyTile(x, y));
      }
      this.cells.push(row);
    }
  }

  public loadLevel(level: LevelDefinition): void {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.cells[y][x] = new EmptyTile(x, y);
      }
    }

    for (const src of level.sources) {
      if (this.inBounds(src.x, src.y)) {
        this.cells[src.y][src.x] = new SourceTile(src);
      }
    }

    for (const drn of level.drains) {
      if (this.inBounds(drn.x, drn.y)) {
        this.cells[drn.y][drn.x] = new DrainTile(drn);
      }
    }
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  public getTile(x: number, y: number): Tile | null {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y][x];
  }

  public setTile(tile: Tile): Tile | null {
    if (!this.inBounds(tile.x, tile.y)) return null;
    const prev = this.cells[tile.y][tile.x];
    if (prev.fixed) return null;
    this.cells[tile.y][tile.x] = tile;
    return prev;
  }

  public removePlayerTile(x: number, y: number): Tile | null {
    const existing = this.getTile(x, y);
    if (!existing || existing.fixed || existing.category === 'empty') {
      return null;
    }
    this.cells[y][x] = new EmptyTile(x, y);
    return existing;
  }

  public clearAllPlayerTiles(): Tile[] {
    const removed: Tile[] = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.cells[y][x];
        if (!t.fixed && t.category !== 'empty') {
          removed.push(t);
          this.cells[y][x] = new EmptyTile(x, y);
        }
      }
    }
    return removed;
  }

  public getNeighbor(x: number, y: number, dir: Direction): Tile | null {
    const { dx, dy } = directionVector(dir);
    return this.getTile(x + dx, y + dy);
  }

  public isPortConnected(x: number, y: number, dir: Direction): boolean {
    const here = this.getTile(x, y);
    const neighbor = this.getNeighbor(x, y, dir);
    if (!here || !neighbor) return false;
    return (
      here.getOpenPorts().includes(dir) &&
      neighbor.getOpenPorts().includes(oppositeDirection(dir))
    );
  }

  public getSources(): SourceTile[] {
    const list: SourceTile[] = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.cells[y][x];
        if (t instanceof SourceTile) list.push(t);
      }
    }
    return list;
  }

  public getDrains(): DrainTile[] {
    const list: DrainTile[] = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.cells[y][x];
        if (t instanceof DrainTile) list.push(t);
      }
    }
    return list;
  }

  public getFilters(): FilterTile[] {
    const list: FilterTile[] = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.cells[y][x];
        if (t instanceof FilterTile) list.push(t);
      }
    }
    return list;
  }

  public resetSimulationState(): void {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.cells[y][x].resetSimulationState();
      }
    }
  }
}
