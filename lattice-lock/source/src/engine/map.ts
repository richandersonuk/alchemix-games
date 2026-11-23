import type { SectorId, Vec3 } from '../types/chemistry';

export const GRID_W = 14;
export const GRID_H = 9;

export interface SectorMapSpec {
  id: SectorId;
  coreTile: { x: number; z: number };
  lanes: [number, number][][];
}

export const SECTOR_MAPS: Record<SectorId, SectorMapSpec> = {
  foundation: {
    id: 'foundation',
    coreTile: { x: 13, z: 6 },
    lanes: [[[-1, 1], [4, 1], [4, 6], [8, 6], [8, 2], [11, 2], [11, 6], [13, 6]]],
  },
  reactor: {
    id: 'reactor',
    coreTile: { x: 13, z: 4 },
    lanes: [
      [[-1, 1], [5, 1], [5, 3], [9, 3], [9, 1], [12, 1], [12, 4], [13, 4]],
      [[-1, 7], [5, 7], [5, 5], [9, 5], [9, 7], [12, 7], [12, 4], [13, 4]],
    ],
  },
  crucible: {
    id: 'crucible',
    coreTile: { x: 13, z: 4 },
    lanes: [
      [[-1, 2], [3, 2], [3, 6], [7, 6], [7, 1], [11, 1], [11, 4], [13, 4]],
      [[-1, 6], [3, 6], [3, 2], [7, 2], [7, 7], [11, 7], [11, 4], [13, 4]],
    ],
  },
};

export const tileToWorld = (x: number, z: number): Vec3 => [x - (GRID_W - 1) / 2, 0, z - (GRID_H - 1) / 2];

const key = (x: number, z: number) => `${x},${z}`;

interface CompiledLane {
  pts: Vec3[];
  segLen: number[];
  totalLen: number;
}

interface CompiledSectorMap {
  id: SectorId;
  coreTile: { x: number; z: number };
  pathTiles: Set<string>;
  lanes: CompiledLane[];
}

function compileSectorMap(spec: SectorMapSpec): CompiledSectorMap {
  const pathTiles = new Set<string>();
  const lanes: CompiledLane[] = [];
  for (const waypoints of spec.lanes) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [x0, z0] = waypoints[i];
      const [x1, z1] = waypoints[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
      for (let s = 0; s <= steps; s++) {
        const x = x0 + Math.sign(x1 - x0) * s;
        const z = z0 + Math.sign(z1 - z0) * s;
        if (x >= 0 && x < GRID_W && z >= 0 && z < GRID_H) pathTiles.add(key(x, z));
      }
    }
    const pts = waypoints.map(([x, z]) => tileToWorld(x, z));
    const segLen: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      segLen.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]));
    }
    const totalLen = segLen.reduce((a, b) => a + b, 0);
    lanes.push({ pts, segLen, totalLen });
  }
  return { id: spec.id, coreTile: spec.coreTile, pathTiles, lanes };
}

const COMPILED: Record<SectorId, CompiledSectorMap> = {
  foundation: compileSectorMap(SECTOR_MAPS.foundation),
  reactor: compileSectorMap(SECTOR_MAPS.reactor),
  crucible: compileSectorMap(SECTOR_MAPS.crucible),
};

let activeMap: CompiledSectorMap = COMPILED.foundation;

export let CORE_TILE = activeMap.coreTile;
export let PATH_TILES = activeMap.pathTiles;
export let PATH_LENGTH = activeMap.lanes[0].totalLen;
export let PATH_WORLD_POINTS = activeMap.lanes[0].pts;

export function setActiveSectorMap(id: SectorId) {
  activeMap = COMPILED[id];
  CORE_TILE = activeMap.coreTile;
  PATH_TILES = activeMap.pathTiles;
  PATH_LENGTH = activeMap.lanes[0].totalLen;
  PATH_WORLD_POINTS = activeMap.lanes[0].pts;
}

export function getActiveSectorMap(): SectorId {
  return activeMap.id;
}

export function getActiveCoreTile() {
  return activeMap.coreTile;
}

export function getActiveLanesWorldPoints(): Vec3[][] {
  return activeMap.lanes.map((l) => l.pts);
}

export function getLaneLength(route = 0): number {
  const lane = activeMap.lanes[route] ?? activeMap.lanes[0];
  return lane.totalLen;
}

export const isPathTile = (x: number, z: number) => activeMap.pathTiles.has(key(x, z));
export const isCoreTile = (x: number, z: number) => x === activeMap.coreTile.x && z === activeMap.coreTile.z;
export const isBuildable = (x: number, z: number) =>
  x >= 0 && x < GRID_W && z >= 0 && z < GRID_H && !isPathTile(x, z) && !isCoreTile(x, z);

export function sampleLanePath(d: number, route = 0): { x: number; z: number; heading: number } {
  const lane = activeMap.lanes[route] ?? activeMap.lanes[0];
  let rem = Math.max(0, Math.min(d, lane.totalLen));
  for (let i = 0; i < lane.segLen.length; i++) {
    if (rem <= lane.segLen[i] || i === lane.segLen.length - 1) {
      const t = lane.segLen[i] === 0 ? 0 : Math.min(rem / lane.segLen[i], 1);
      const a = lane.pts[i];
      const b = lane.pts[i + 1];
      return {
        x: a[0] + (b[0] - a[0]) * t,
        z: a[2] + (b[2] - a[2]) * t,
        heading: Math.atan2(b[0] - a[0], b[2] - a[2]),
      };
    }
    rem -= lane.segLen[i];
  }
  const last = lane.pts[lane.pts.length - 1];
  return { x: last[0], z: last[2], heading: 0 };
}

export function samplePath(d: number): { x: number; z: number; heading: number } {
  return sampleLanePath(d, 0);
}
