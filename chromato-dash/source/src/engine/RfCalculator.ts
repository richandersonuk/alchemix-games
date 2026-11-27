import {
  CaseRunSummary,
  LevelData,
  PlateConfig,
  SpotEvaluation,
} from '../types/chromatography';

export const DEFAULT_PLATE_CONFIG: PlateConfig = {
  baselineNorm: 0.10,
  solventLimitNorm: 0.90,
  reservoirDefaultNorm: 0.055,
  reservoirMaxSafeNorm: 0.095,
};

/** Converts a normalized plate height [0..1] to normalized baseline-to-limit progress [0..1] */
export function normHToRelDist(
  hNorm: number,
  config: PlateConfig = DEFAULT_PLATE_CONFIG,
): number {
  const span = config.solventLimitNorm - config.baselineNorm;
  if (span <= 0) return 0;
  return Math.max(0, (hNorm - config.baselineNorm) / span);
}

/** Converts an Rf value [0..1] to normalized plate height [0.10..0.90] */
export function rfToNormH(
  rf: number,
  config: PlateConfig = DEFAULT_PLATE_CONFIG,
): number {
  const span = config.solventLimitNorm - config.baselineNorm;
  return config.baselineNorm + Math.max(0, Math.min(1, rf)) * span;
}

/** Measures travel distance in millimetres from the 10% pencil baseline */
export function normToDistanceMm(
  hNorm: number,
  plateLengthMm: number,
  config: PlateConfig = DEFAULT_PLATE_CONFIG,
): number {
  return normHToRelDist(hNorm, config) * plateLengthMm;
}

/** Computes Rf = distance travelled by substance / distance travelled by solvent front */
export function calculateRf(spotDistMm: number, solventDistMm: number): number {
  if (solventDistMm <= 0.5) return 0;
  return Math.max(0, Math.min(1, spotDistMm / solventDistMm));
}

export function roundRf(rf: number): number {
  return Math.round(rf * 100) / 100;
}

export function isRfHit(
  measuredRf: number,
  targetRf: number,
  tolerance = 0.03,
): boolean {
  return Math.abs(measuredRf - targetRf) <= tolerance + 1e-6;
}

export interface SpotEvalInput {
  pigmentId: string;
  name: string;
  colorHex: string;
  targetRf: number;
  toleranceRf: number;
  hNorm: number;
  contaminated: boolean;
  washedOut: boolean;
  revealed: boolean;
}

export function evaluateCaseRun(params: {
  level: LevelData;
  solventFrontH: number;
  spots: SpotEvalInput[];
  failedSubmersion: boolean;
  failureReason: string | null;
  usedSolventSwitch: boolean;
  usedLocatingAgent: boolean;
  config?: PlateConfig;
}): CaseRunSummary {
  const config = params.config ?? DEFAULT_PLATE_CONFIG;
  const solventDistMm = Math.max(
    0,
    normToDistanceMm(params.solventFrontH, params.level.plateLengthMm, config),
  );
  const solventFrontRf = calculateRf(solventDistMm, params.level.plateLengthMm);

  const evaluations: SpotEvaluation[] = [];
  let hitsCount = 0;
  let totalScore = 0;
  const feedback: string[] = [];

  if (params.failedSubmersion) {
    for (const s of params.spots) {
      evaluations.push({
        pigmentId: s.pigmentId,
        name: s.name,
        colorHex: s.colorHex,
        targetRf: s.targetRf,
        toleranceRf: s.toleranceRf,
        measuredRf: 0,
        spotDistanceMm: 0,
        solventDistanceMm: solventDistMm,
        deltaRf: -s.targetRf,
        hit: false,
        contaminated: s.contaminated,
        washedOut: true,
        revealed: s.revealed,
        points: 0,
      });
    }
    feedback.push(
      'Mark-Scheme Trap: The solvent reservoir rose above the 10% pencil baseline, dissolving the sample directly into the beaker instead of allowing capillary ascent.',
    );
    return {
      level: params.level,
      failedSubmersion: true,
      failureReason:
        params.failureReason ??
        'Baseline Submerged! Initial spots dissolved into the solvent reservoir.',
      solventFrontMm: Math.round(solventDistMm * 10) / 10,
      solventFrontRf: roundRf(solventFrontRf),
      spotEvaluations: evaluations,
      hitsCount: 0,
      totalSpots: params.spots.length,
      totalScore: 0,
      stars: 0,
      usedSolventSwitch: params.usedSolventSwitch,
      usedLocatingAgent: params.usedLocatingAgent,
      examinerFeedback: feedback,
    };
  }

  for (const s of params.spots) {
    const spotDistMm = normToDistanceMm(s.hNorm, params.level.plateLengthMm, config);
    const measuredRf = calculateRf(spotDistMm, Math.max(solventDistMm, 0.5));
    const deltaRf = measuredRf - s.targetRf;
    const hit = !s.washedOut && isRfHit(measuredRf, s.targetRf, s.toleranceRf);

    let pts = 0;
    if (hit) {
      hitsCount++;
      const precisionBonus = Math.round(
        Math.max(0, 1 - Math.abs(deltaRf) / Math.max(0.01, s.toleranceRf)) * 200,
      );
      pts = 300 + precisionBonus;
      if (!s.contaminated) pts += 75;
      if (s.revealed) pts += 50;
    } else {
      const proximity = Math.max(0, 1 - Math.abs(deltaRf) / 0.25);
      pts = Math.round(proximity * 120);
    }

    totalScore += pts;
    evaluations.push({
      pigmentId: s.pigmentId,
      name: s.name,
      colorHex: s.colorHex,
      targetRf: s.targetRf,
      toleranceRf: s.toleranceRf,
      measuredRf: roundRf(measuredRf),
      spotDistanceMm: Math.round(spotDistMm * 10) / 10,
      solventDistanceMm: Math.round(solventDistMm * 10) / 10,
      deltaRf: Math.round(deltaRf * 1000) / 1000,
      hit,
      contaminated: s.contaminated,
      washedOut: s.washedOut,
      revealed: s.revealed,
      points: pts,
    });
  }

  const ratio = params.spots.length > 0 ? hitsCount / params.spots.length : 0;
  const cleanBonus = evaluations.every((e) => !e.contaminated) ? 100 : 0;
  totalScore += cleanBonus;

  let stars: 0 | 1 | 2 | 3 = 0;
  if (hitsCount === params.spots.length && params.spots.length > 0) {
    const avgError =
      evaluations.reduce((acc, e) => acc + Math.abs(e.deltaRf), 0) /
      evaluations.length;
    const allClean = evaluations.every((e) => !e.contaminated && e.revealed);
    stars = allClean && avgError <= 0.018 ? 3 : 2;
  } else if (ratio >= 0.5 || hitsCount >= 1) {
    stars = 1;
  }

  if (hitsCount === params.spots.length) {
    feedback.push(
      `All ${hitsCount} components isolated within ±${params.spots[0]?.toleranceRf.toFixed(2) ?? '0.03'} Rf tolerance.`,
    );
  } else {
    const missed = evaluations.filter((e) => !e.hit).map((e) => e.name);
    feedback.push(
      `Missed target gate for: ${missed.join(', ')}. Release thumb slightly earlier so stationary phase adsorption locks on mark.`,
    );
  }

  if (params.level.locatingAgent !== 'none' && !params.usedLocatingAgent) {
    feedback.push(
      `Invisible spot warning: activate ${params.level.locatingAgent === 'uv' ? 'UV 254 nm lamp' : 'Ninhydrin spray'} to locate colourless spots cleanly.`,
    );
  }

  if (evaluations.some((e) => e.contaminated)) {
    feedback.push(
      'Contamination occurred: steer left/right while holding to avoid pencil smudges and dry silica pockets.',
    );
  }

  feedback.push(params.level.markSchemeTip);

  return {
    level: params.level,
    failedSubmersion: false,
    failureReason: null,
    solventFrontMm: Math.round(solventDistMm * 10) / 10,
    solventFrontRf: roundRf(solventFrontRf),
    spotEvaluations: evaluations,
    hitsCount,
    totalSpots: params.spots.length,
    totalScore,
    stars,
    usedSolventSwitch: params.usedSolventSwitch,
    usedLocatingAgent: params.usedLocatingAgent,
    examinerFeedback: feedback,
  };
}
