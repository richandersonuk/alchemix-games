export type SolventId = 'water' | 'ethanol' | 'propanone' | 'butanol_buffer';

export type StationaryPhaseType = 'paper' | 'tlc_silica' | 'tlc_f254';

export type LocatingMethod = 'none' | 'uv' | 'ninhydrin';

export type GameMode = 'standard' | 'solvent-shifter' | 'contamination-hazard';

export interface SolventSpec {
  id: SolventId;
  name: string;
  shortName: string;
  formula: string;
  polarityLabel: string;
  /** Base upward capillary rise velocity in plate height units per second at baseline */
  capillarySpeed: number;
  /** Color for fluid reservoir and wet-plate tint */
  tintHex: string;
  meniscusHex: string;
}

export type PigmentState =
  | 'baseline'
  | 'surfing'
  | 'adsorbed'
  | 'locked_hit'
  | 'locked_miss'
  | 'washed_out';

export interface TrailParticle {
  u: number;
  h: number;
  radius: number;
  alpha: number;
  life: number;
}

export interface PigmentSpec {
  id: string;
  name: string;
  shortCode: string;
  colorHex: string;
  glowHex: string;
  /** Target Rf value calibrated from 10% pencil baseline to 90% limit */
  targetRf: number;
  /** ±Rf window allowed for target lock (default 0.03) */
  toleranceRf: number;
  /** Initial horizontal position on the pencil line (0..1) */
  startU: number;
  /** Relative solubility per solvent (0.02 = insoluble, 1.0 = ultra-mobile) */
  solubilityBySolvent: Record<SolventId, number>;
  /** Affinity to stationary silica/cellulose phase (higher = crisper stop / higher drag) */
  stationaryAffinity: number;
  /** Whether spot is colourless until UV lamp or Ninhydrin locating pulse is active */
  requiresLocating: LocatingMethod;
}

export interface TargetGateSpec {
  pigmentId: string;
  label: string;
  colorHex: string;
  targetRf: number;
  toleranceRf: number;
}

export type ObstacleType =
  | 'graphite_smudge'
  | 'dry_pocket'
  | 'ink_contaminant'
  | 'meniscus_wave';

export interface ObstacleSpec {
  id: string;
  type: ObstacleType;
  label: string;
  /** Center horizontal coordinate (0..1) */
  u: number;
  /** Center Rf coordinate (0.08..0.88) relative to baseline->limit */
  rf: number;
  /** Normalized width & Rf height */
  widthU: number;
  heightRf: number;
  /** Optional oscillation speed for moving hazards */
  driftAmpU?: number;
  driftSpeed?: number;
}

export interface PlateConfig {
  /** Pencil baseline height fraction from bottom of plate (0.10 = 10%) */
  baselineNorm: number;
  /** Solvent front termination fraction from bottom of plate (0.90 = 90%) */
  solventLimitNorm: number;
  /** Pre-set safe reservoir depth (below baseline) */
  reservoirDefaultNorm: number;
  /** Highest safe reservoir level before submerging baseline spots */
  reservoirMaxSafeNorm: number;
}

export interface LevelData {
  id: string;
  caseNumber: number;
  title: string;
  sampleSource: string;
  tier: 'KS3 / GCSE Foundation' | 'GCSE Higher' | 'GCSE Triple / AS Prep';
  specTag: string;
  mode: GameMode;
  stationaryPhase: StationaryPhaseType;
  /** Physical scale length (mm) from pencil baseline to solvent front limit */
  plateLengthMm: number;
  defaultSolvent: SolventId;
  availableSolvents: SolventId[];
  locatingAgent: LocatingMethod;
  /** Duration of solvent run in seconds (~14-24s paced for arcade feel) */
  baseFrontSpeed: number;
  allowInstantPour: boolean;
  briefing: string;
  markSchemeTip: string;
  pigments: PigmentSpec[];
  obstacles: ObstacleSpec[];
}

export type RunPhase = 'menu' | 'setup' | 'running' | 'finishing' | 'summary';

export interface SpotEvaluation {
  pigmentId: string;
  name: string;
  colorHex: string;
  targetRf: number;
  toleranceRf: number;
  measuredRf: number;
  spotDistanceMm: number;
  solventDistanceMm: number;
  deltaRf: number;
  hit: boolean;
  contaminated: boolean;
  washedOut: boolean;
  revealed: boolean;
  points: number;
}

export interface CaseRunSummary {
  level: LevelData;
  failedSubmersion: boolean;
  failureReason: string | null;
  solventFrontMm: number;
  solventFrontRf: number;
  spotEvaluations: SpotEvaluation[];
  hitsCount: number;
  totalSpots: number;
  totalScore: number;
  stars: 0 | 1 | 2 | 3;
  usedSolventSwitch: boolean;
  usedLocatingAgent: boolean;
  examinerFeedback: string[];
}
