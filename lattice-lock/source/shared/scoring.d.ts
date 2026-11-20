export interface RunSummary {
  wavesCleared: number;
  marks: number;
  neutralised: number;
  coreRemaining: number;
  victory: boolean;
  durationSec: number;
  towersLost: number;
}
export declare const MAX_WAVES: number;
export declare const WAVE_THREATS: number[];
export declare const MAX_MARKS: number;
export declare function computeScore(s: RunSummary): number;
export declare function validateSummary(raw: unknown): { ok: true; summary: RunSummary } | { ok: false };
