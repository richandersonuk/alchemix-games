export type StateSymbol = 's' | 'l' | 'g' | 'aq';

export type CycleCategory = 'calorimetry' | 'formation' | 'bond' | 'solution' | 'bornhaber';

export type ExamBoard = 'WJEC' | 'AQA' | 'OCR';

export type NodeRole = 'source' | 'target' | 'intermediate' | 'trap';

export type ThermalSign = 'exothermic' | 'endothermic' | 'neutral';

export interface SpeciesTerm {
  formula: string;
  state: StateSymbol;
  moles: number;
  isSpectator?: boolean;
}

export interface StateNodeData {
  id: string;
  title: string;
  formulaText: string;
  species: SpeciesTerm[];
  nx: number;
  ny: number;
  role: NodeRole;
  badge?: string;
  trapReason?: string;
}

export interface VectorTemplate {
  id: string;
  standardFromId: string;
  standardToId: string;
  enthalpyRefId: string;
  symbol: string;
  baseDeltaH: number;
  requiredMultiplier: number;
  unitSpeciesDelta: Record<string, number>;
  curveOffset?: number;
  isTrap?: boolean;
  trapMessage?: string;
}

export interface VectorArrow {
  id: string;
  templateId: string;
  standardFromId: string;
  standardToId: string;
  enthalpyRefId: string;
  symbol: string;
  baseDeltaH: number;
  reversed: boolean;
  multiplier: number;
  unitSpeciesDelta: Record<string, number>;
  curveOffset: number;
  isTrap: boolean;
  trapMessage?: string;
}

export interface CycleScenario {
  id: string;
  number: number;
  code: string;
  title: string;
  category: CycleCategory;
  examBoards: ExamBoard[];
  examSource: string;
  targetLabel: string;
  targetEquation: string;
  targetDeltaH: number;
  targetMoles?: number;
  sourceNodeId: string;
  targetNodeId: string;
  nodes: StateNodeData[];
  transitions: VectorTemplate[];
  prewiredIds?: string[];
  hint: string;
  examinerNote: string;
  m1Rule: string;
}

export type CircuitState =
  | 'idle'
  | 'wiring'
  | 'fault'
  | 'energised_exothermic'
  | 'energised_endothermic';

export type FaultType =
  | 'open_circuit'
  | 'direction_mismatch'
  | 'stoichiometry_mismatch'
  | 'state_symbol_trap'
  | 'math_imbalance';

export interface CircuitFault {
  type: FaultType;
  headline: string;
  detail: string;
  offendingVectorId?: string;
  offendingNodeId?: string;
  isTargetDivisorFault?: boolean;
}

export interface MarkSchemeStep {
  code: string;
  title: string;
  detail: string;
}

export interface EvaluationResult {
  valid: boolean;
  calculatedDeltaH: number | null;
  routeTotalDeltaH?: number;
  targetDivisorUsed?: number;
  netLoopDeltaH: number | null;
  thermalSign: ThermalSign;
  orderedRoute: VectorArrow[];
  fault?: CircuitFault;
  markSchemeSteps: MarkSchemeStep[];
  starsAwarded: 0 | 1 | 2 | 3;
}

export interface EnthalpyEntry {
  id: string;
  kind: 'formation' | 'combustion' | 'lattice' | 'hydration' | 'solution' | 'phase' | 'atomisation' | 'ionisation' | 'electron_affinity' | 'bond';
  species: string;
  symbol: string;
  deltaH: number;
  notes: string;
}

export interface EquationPreviewState {
  expression: string;
  numericSumText: string;
  status: 'empty' | 'partial' | 'opposing' | 'ready' | 'trap';
  statusLabel: string;
}
