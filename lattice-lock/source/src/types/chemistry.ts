// ─────────────────────────────────────────────────────────────────────────────
// Core chemistry + game domain types for Lattice Lock.
// ─────────────────────────────────────────────────────────────────────────────

export type Vec3 = [number, number, number];

/** The four classes of physical disruptor that attack the core. */
export type DamageType = 'thermal' | 'electrical' | 'shear' | 'solvent';

/** GCSE structure & bonding categories. */
export type BondingType = 'giant-ionic' | 'giant-covalent' | 'metallic' | 'simple-molecular';

export type LatticeId =
  | 'nacl'
  | 'mgo'
  | 'diamond'
  | 'graphite'
  | 'graphene'
  | 'copper'
  | 'iron'
  | 'steel'
  | 'ice'
  | 'iodine'
  | 'polyethylene';

export type ThreatId =
  | 'thermal-wave'
  | 'plasma-front'
  | 'arc-discharge'
  | 'static-spark'
  | 'shear-parallel'
  | 'shear-glancing'
  | 'solvent-jet';

export type ElementSymbol = 'Na' | 'Cl' | 'Mg' | 'O' | 'C' | 'Cu' | 'Fe' | 'H' | 'I';

// ── Unit-cell geometry ──────────────────────────────────────────────────────

export interface Atom {
  id: number;
  element: ElementSymbol;
  position: Vec3;
  radius: number;
  color: string;
  /** e.g. "+", "2−" – shown in the inspector legend. */
  charge?: string;
  /** Interstitial alloying atom (steel). */
  interstitial?: boolean;
}

export type BondKind = 'covalent' | 'ionic' | 'metallic' | 'intermolecular' | 'hydrogen';

export interface Bond {
  a: number;
  b: number;
  kind: BondKind;
}

export interface Coordination {
  number: string;
  geometry: string;
  detail: string;
}

export interface UnitCell {
  label: string;
  atoms: Atom[];
  bonds: Bond[];
  /** Atom whose coordination sphere the inspector highlights. */
  centreAtomId?: number;
  /** Draw a cell outline of this size (centred on origin). */
  box?: Vec3;
  /** Delocalised electrons: a 3D "sea" (metals) or planes (graphite/graphene). */
  electronSea?: 'volume' | 'layers';
  layerHeights?: number[];
  coordination: Coordination;
}

// ── Lattice (tower) definitions ─────────────────────────────────────────────

export type ShearResponse =
  | 'brittle-ionic'
  | 'hard-network'
  | 'layer-slip'
  | 'tensile-sheet'
  | 'malleable'
  | 'alloy-pinned'
  | 'brittle-molecular'
  | 'soft-molecular'
  | 'flexible-chains';

export type SolventResponse =
  | 'dissolves'
  | 'slightly-soluble'
  | 'insoluble'
  | 'inert-metal'
  | 'corrodes'
  | 'erodes'
  | 'non-polar';

export interface LatticeProperties {
  /** Melting / sublimation point in kelvin. */
  meltingPointK: number;
  phaseChange: 'melts' | 'sublimes';
  /** W m⁻¹ K⁻¹ (room temperature, approximate). */
  thermalConductivity: number;
  /** Multiplier on resistance to thermal damage (MgO = 2 × NaCl). */
  thermalDurability: number;
  conductsSolid: boolean;
  /** 0 = insulator … 3 = excellent conductor. */
  conductivityRank: 0 | 1 | 2 | 3;
  /** Approximate voltage the barrier can insulate before breakdown (kV). */
  breakdownKV: number;
  shear: ShearResponse;
  solvent: SolventResponse;
  corrosionRate?: number;
  hardnessMohs: number;
  ionCharges?: string;
}

export interface TowerStats {
  maxIntegrity: number;
  /** Base neutralisation rate (threat HP per second). */
  power: number;
  /** Interaction radius in tiles. */
  range: number;
}

export interface LatticeDefinition {
  id: LatticeId;
  name: string;
  formula: string;
  bonding: BondingType;
  cost: number;
  /** False for upgrade-only lattices (steel, graphene). */
  buildable: boolean;
  upgradeTo?: LatticeId;
  upgradeCost?: number;
  upgradeNote?: string;
  upgradeFrom?: LatticeId;
  stats: TowerStats;
  properties: LatticeProperties;
  accent: string;
  tagline: string;
  description: string;
  examPoints: string[];
  buildCell: () => UnitCell;
}

// ── Threats & waves ─────────────────────────────────────────────────────────

export interface ThreatSpec {
  id: ThreatId;
  type: DamageType;
  name: string;
  short: string;
  intensity: number;
  unit: string;
  hp: number;
  /** Tiles per second. */
  speed: number;
  /** Damage per second dealt to an engaged barrier at vulnerability 1. */
  aggression: number;
  coreDamage: number;
  reward: number;
  plasma?: boolean;
  shearMode?: 'parallel' | 'glancing';
  color: string;
  description: string;
}

export interface WaveGroup {
  threat: ThreatId;
  count: number;
  /** Seconds between spawns. */
  interval: number;
  /** Seconds after wave start before the first spawn. */
  delay: number;
}

export interface WaveDefinition {
  name: string;
  briefing: string;
  hint: string;
  groups: WaveGroup[];
  bonus: number;
}

// ── Interaction resolution ──────────────────────────────────────────────────

export type Outcome =
  | 'absorbed'
  | 'dissipated'
  | 'blocked'
  | 'grounded'
  | 'deflected'
  | 'deformed'
  | 'pinned'
  | 'resisted'
  | 'repelled'
  | 'shattered'
  | 'cleaved'
  | 'fractured'
  | 'dissolved'
  | 'melted'
  | 'vaporised'
  | 'breakdown'
  | 'electrolysed'
  | 'graphitised'
  | 'corroded'
  | 'eroded';

export type Verdict = 'counter' | 'neutral' | 'weak';

export type SfxName =
  | 'crack'
  | 'clang'
  | 'hum'
  | 'hiss'
  | 'splash'
  | 'thud'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'core'
  | 'wave'
  | 'pop'
  | 'deny'
  | 'victory'
  | 'defeat';

export interface InteractionResult {
  outcome: Outcome;
  verdict: Verdict;
  /** Multiplier on the tower's power → damage dealt to the threat. */
  threatDamageMult: number;
  /** Multiplier on the threat's aggression → damage dealt to the tower. */
  towerDamageMult: number;
  /** Speed multiplier applied to the threat while engaged (1 = none). */
  slow: number;
  instantDestroy?: boolean;
  /** Ionic lattice becomes hydrated (mobile ions → conductive). */
  hydrate?: boolean;
  /** Diamond accumulates sp³ → sp² conversion. */
  graphitise?: boolean;
  title: string;
  rationale: string;
  keywords: string[];
  sfx: SfxName;
}

// ── Runtime state ───────────────────────────────────────────────────────────

export interface TowerState {
  id: number;
  latticeId: LatticeId;
  tile: { x: number; z: number };
  position: Vec3;
  integrity: number;
  invested: number;
  targetId: number | null;
  hydratedUntil: number;
  plasmaExposure: number;
  hitFlash: number;
  hitType: DamageType | null;
  neutralised: number;
}

export interface ThreatState {
  id: number;
  specId: ThreatId;
  hp: number;
  maxHp: number;
  /** Distance travelled along the path (tiles). */
  progress: number;
  position: Vec3;
  heading: number;
  slow: number;
  lane: number;
}

export type LogSeverity = 'success' | 'fail' | 'info' | 'warning';

export interface LogEntry {
  id: number;
  time: number;
  wave: number;
  severity: LogSeverity;
  title: string;
  rationale: string;
  keywords: string[];
  marks?: number;
}
