import type { Vec3 } from '../types/chemistry';

export const GRID_W = 14;
export const GRID_H = 9;

/** Lane waypoints in tile coordinates. Starts just off the board. */
export const WAYPOINTS: [number, number][] = [
  [-1, 1],
  [4, 1],
  [4, 6],
  [8, 6],
  [8, 2],
  [11, 2],
  [11, 6],
  [13, 6],
];

export const CORE_TILE = { x: 13, z: 6 };

export const tileToWorld = (x: number, z: number): Vec3 => [x - (GRID_W - 1) / 2, 0, z - (GRID_H - 1) / 2];

const key = (x: number, z: number) => `${x},${z}`;

export const PATH_TILES = new Set<string>();
for (let i = 0; i < WAYPOINTS.length - 1; i++) {
  const [x0, z0] = WAYPOINTS[i];
  const [x1, z1] = WAYPOINTS[i + 1];
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let s = 0; s <= steps; s++) {
    const x = x0 + Math.sign(x1 - x0) * s;
    const z = z0 + Math.sign(z1 - z0) * s;
    if (x >= 0 && x < GRID_W && z >= 0 && z < GRID_H) PATH_TILES.add(key(x, z));
  }
}

export const isPathTile = (x: number, z: number) => PATH_TILES.has(key(x, z));
export const isCoreTile = (x: number, z: number) => x === CORE_TILE.x && z === CORE_TILE.z;
export const isBuildable = (x: number, z: number) =>
  x >= 0 && x < GRID_W && z >= 0 && z < GRID_H && !isPathTile(x, z) && !isCoreTile(x, z);

// ── Path sampling ───────────────────────────────────────────────────────────

const PTS = WAYPOINTS.map(([x, z]) => tileToWorld(x, z));
const SEG_LEN: number[] = [];
for (let i = 0; i < PTS.length - 1; i++)
  SEG_LEN.push(Math.hypot(PTS[i + 1][0] - PTS[i][0], PTS[i + 1][2] - PTS[i][2]));
export const PATH_LENGTH = SEG_LEN.reduce((a, b) => a + b, 0);
export const PATH_WORLD_POINTS = PTS;

export function samplePath(d: number): { x: number; z: number; heading: number } {
  let rem = Math.max(0, Math.min(d, PATH_LENGTH));
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (rem <= SEG_LEN[i] || i === SEG_LEN.length - 1) {
      const t = SEG_LEN[i] === 0 ? 0 : Math.min(rem / SEG_LEN[i], 1);
      const a = PTS[i];
      const b = PTS[i + 1];
      return {
        x: a[0] + (b[0] - a[0]) * t,
        z: a[2] + (b[2] - a[2]) * t,
        heading: Math.atan2(b[0] - a[0], b[2] - a[2]),
      };
    }
    rem -= SEG_LEN[i];
  }
  const last = PTS[PTS.length - 1];
  return { x: last[0], z: last[2], heading: 0 };
}
