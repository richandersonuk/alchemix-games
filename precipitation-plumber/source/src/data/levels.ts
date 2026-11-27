import { Direction, GasId, IonId, PrecipitateId, ReagentId } from './reactions';

export type PipeVariant = 'straight' | 'elbow' | 'tee' | 'crossover';

/**
 * Level tiers follow the WJEC specifications:
 *  - GCSE Foundation / Higher: WJEC GCSE The Sciences (Double Award) 2.2.3 & 5.2.4
 *  - AS Level: WJEC AS Chemistry Unit 1.6 (The Periodic Table)
 *  - A2 Level: WJEC A2 Chemistry Units 3.3 (p-block) & 3.4 (d-block)
 *  - Exam Challenge: Multi-stream practicals combining GCSE, AS, and A2 techniques
 */
export type LevelTier =
  | 'GCSE Foundation'
  | 'GCSE Higher'
  | 'AS Level'
  | 'A2 Level'
  | 'Exam Challenge';

export interface SourceFixture {
  x: number;
  y: number;
  outDir: Direction;
  label: string;
  ions: Partial<Record<IonId, number>>;
  pulses: number;
}

export type DrainKind = 'flame' | 'limewater' | 'aqueous' | 'waste';

export interface DrainFixture {
  x: number;
  y: number;
  inDir: Direction;
  kind: DrainKind;
  label: string;
  shortLabel: string;
  targetIon?: IonId;
  targetGas?: GasId;
  requiredAmount: number;
}

export interface PrecipitateQuota {
  precipitate: PrecipitateId;
  requiredAmount: number;
  description: string;
}

export interface ObstacleFixture {
  x: number;
  y: number;
  label?: string;
}

export type LockedTileFixture =
  | { kind: 'pipe'; variant: PipeVariant; x: number; y: number; rotation: number }
  | { kind: 'injector'; reagent: ReagentId; x: number; y: number; rotation: number }
  | { kind: 'filter'; x: number; y: number; rotation: number };

export interface PaletteInventory {
  pipes: Partial<Record<PipeVariant, number>>;
  reagents: Partial<Record<ReagentId, number>>;
  filters: number;
}

export interface LevelDefinition {
  id: number;
  code: string;
  title: string;
  tier: LevelTier;
  /** Exact WJEC specification references this level assesses */
  specRef: string;
  brief: string;
  hint: string;
  cols: number;
  rows: number;
  sources: SourceFixture[];
  drains: DrainFixture[];
  precipitateQuotas: PrecipitateQuota[];
  inventory: PaletteInventory;
  obstacles?: ObstacleFixture[];
  lockedTiles?: LockedTileFixture[];
  /** Max standard pipes unfiltered slurry may cross before clogging (default 2) */
  maxSlurryPipes?: number;
  /** Minimum purity percentage required to pass (default 90) */
  minPurity?: number;
  /** Optimal player-placed tile count for 2★/3★ Par rating */
  parTiles: number;
  challengeTags?: string[];
}

export const LEVELS: LevelDefinition[] = [
  // ───────────────────────── GCSE FOUNDATION (3) ─────────────────────────
  {
    id: 1,
    code: 'LAB-01',
    title: 'Blue Precipitate Rescue',
    tier: 'GCSE Foundation',
    specRef: 'WJEC GCSE 5.2.4: copper(II) ions + NaOH · 2.2.3: Group 1 flame tests',
    brief:
      'Separate Cu²⁺ from Na⁺. Add sodium hydroxide to form a blue precipitate of copper(II) hydroxide, filter it off, then flame-test the clear solution for a yellow Na⁺ flame.',
    hint:
      'Place a NaOH injector, then a Filter Bed straight after it so the blue Cu(OH)₂ is trapped. The clear filtrate still contains Na⁺ ions and goes to the flame test.',
    cols: 8,
    rows: 6,
    parTiles: 8,
    sources: [
      {
        x: 0,
        y: 2,
        outDir: 'E',
        label: 'Cu²⁺ + Na⁺ solution',
        ions: { 'Cu2+': 1, 'Na+': 1, 'NO3-': 3 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'flame',
        label: 'Yellow flame test (Na⁺)',
        shortLabel: 'Na⁺ flame',
        targetIon: 'Na+',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'Cu(OH)2',
        requiredAmount: 3,
        description: 'Collect blue Cu(OH)₂(s) on a Filter Bed',
      },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { NaOH: 1, BaCl2: 1 },
      filters: 2,
    },
  },
  {
    id: 2,
    code: 'LAB-02',
    title: 'Rust-Brown & Brick-Red',
    tier: 'GCSE Foundation',
    specRef: 'WJEC GCSE 5.2.4: iron(III) + NaOH, Ca²⁺ flame test · 2.2.3: halides + AgNO₃',
    brief:
      'Two streams run past bench pillars! Precipitate Fe³⁺ as rust red-brown Fe(OH)₃(s) on Stream A, and remove Cl⁻ as white AgCl(s) on Stream B so Ca²⁺ burns clean brick-red.',
    hint:
      'Route around the bench pillars using 90° elbows. Stream A (top): NaOH then Filter Bed. Stream B (bottom): AgNO₃ then Filter Bed — do NOT add NaOH to Stream B or Ca(OH)₂ will precipitate!',
    cols: 8,
    rows: 6,
    parTiles: 16,
    challengeTags: ['🧱 Bench Pillars'],
    obstacles: [
      { x: 4, y: 1, label: 'Bench Pillar' },
      { x: 4, y: 4, label: 'Bench Pillar' },
    ],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'Fe³⁺ + Na⁺ solution',
        ions: { 'Fe3+': 1, 'Na+': 1, 'NO3-': 4 },
        pulses: 5,
      },
      {
        x: 0,
        y: 4,
        outDir: 'E',
        label: 'Ca²⁺ + Cl⁻ solution',
        ions: { 'Ca2+': 1, 'Cl-': 2 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'flame',
        label: 'Yellow flame test (Na⁺)',
        shortLabel: 'Na⁺ flame',
        targetIon: 'Na+',
        requiredAmount: 3,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'flame',
        label: 'Brick-red flame test (Ca²⁺)',
        shortLabel: 'Ca²⁺ flame',
        targetIon: 'Ca2+',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'Fe(OH)3',
        requiredAmount: 3,
        description: 'Collect red-brown Fe(OH)₃(s) on a Filter Bed',
      },
      {
        precipitate: 'AgCl',
        requiredAmount: 3,
        description: 'Collect white AgCl(s) on a Filter Bed',
      },
    ],
    inventory: {
      pipes: { straight: 8, elbow: 10 },
      reagents: { NaOH: 1, AgNO3: 1, BaCl2: 1 },
      filters: 3,
    },
  },
  {
    id: 3,
    code: 'LAB-03',
    title: 'Effervescent Detour',
    tier: 'GCSE Foundation',
    specRef: 'WJEC GCSE 5.2.4: sulfate ions + BaCl₂ · 5.2.2: carbonate + acid → CO₂ · 2.2.3: flame tests',
    brief:
      'Prove carbonate ions by bubbling CO₂ through limewater, collect the white barium sulfate precipitate on a Filter Bed, and flame-test the solution for crimson Li⁺.',
    hint:
      'Acidified BaCl₂ turns carbonate into CO₂ gas and sulfate into white BaSO₄ solid. Filter the BaSO₄ straight away, then use a T-Junction to split toward limewater and the Li⁺ flame test.',
    cols: 8,
    rows: 6,
    parTiles: 12,
    sources: [
      {
        x: 0,
        y: 2,
        outDir: 'E',
        label: 'Li⁺, CO₃²⁻ and SO₄²⁻ solution',
        ions: { 'Li+': 4, 'CO3_2-': 1, 'SO4_2-': 1 },
        pulses: 6,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'limewater',
        label: 'Limewater test (CO₂)',
        shortLabel: 'Limewater',
        targetGas: 'CO2',
        requiredAmount: 2,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'flame',
        label: 'Crimson flame test (Li⁺)',
        shortLabel: 'Li⁺ flame',
        targetIon: 'Li+',
        requiredAmount: 2,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'BaSO4',
        requiredAmount: 3,
        description: 'Collect white BaSO₄(s) on a Filter Bed',
      },
    ],
    inventory: {
      pipes: { straight: 12, elbow: 8, tee: 2 },
      reagents: { HCl: 2, BaCl2: 2 },
      filters: 2,
    },
  },

  // ───────────────────────── GCSE HIGHER (4) ─────────────────────────
  {
    id: 4,
    code: 'LAB-04',
    title: 'The Chloride Trap',
    tier: 'GCSE Higher',
    specRef: 'WJEC GCSE 2.2.3: halide ions + AgNO₃ · 5.2.2: carbonate test · 2.2.3: flame tests',
    brief:
      'Split a Li⁺, CO₃²⁻ and Br⁻ sample. Prove CO₂ in limewater and collect pure cream AgBr(s) without letting Cl⁻ from HCl spoil the halide test. Slurry settles fast here!',
    hint:
      'Never add HCl before AgNO₃: HCl introduces Cl⁻, giving a false white AgCl precipitate! Split with a T-Junction first: HCl → limewater on the top branch; AgNO₃ → Filter Bed immediately (within 1 pipe) → Li⁺ flame on the bottom branch.',
    cols: 8,
    rows: 6,
    parTiles: 16,
    maxSlurryPipes: 1,
    challengeTags: ['⚡ Rapid Settling'],
    sources: [
      {
        x: 0,
        y: 2,
        outDir: 'E',
        label: 'Li⁺, CO₃²⁻ and Br⁻ solution',
        ions: { 'Li+': 3, 'CO3_2-': 1, 'Br-': 1 },
        pulses: 6,
      },
    ],
    drains: [
      {
        x: 7,
        y: 0,
        inDir: 'W',
        kind: 'limewater',
        label: 'Limewater test (CO₂)',
        shortLabel: 'Limewater',
        targetGas: 'CO2',
        requiredAmount: 2,
      },
      {
        x: 7,
        y: 5,
        inDir: 'W',
        kind: 'flame',
        label: 'Crimson flame test (Li⁺)',
        shortLabel: 'Li⁺ flame',
        targetIon: 'Li+',
        requiredAmount: 2,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'AgBr',
        requiredAmount: 2.5,
        description: 'Collect pure cream AgBr(s), no white AgCl(s)',
      },
    ],
    inventory: {
      pipes: { straight: 14, elbow: 8, tee: 2 },
      reagents: { HCl: 2, AgNO3: 2 },
      filters: 2,
    },
  },
  {
    id: 5,
    code: 'LAB-05',
    title: 'Apple-Green & Exact Stock',
    tier: 'GCSE Higher',
    specRef: 'WJEC GCSE 5.2.4: Ba²⁺ flame test, Fe²⁺ + NaOH · 2.2.3: iodide + AgNO₃',
    brief:
      'Exact parts budget! Navigate around two bench pillars to isolate yellow AgI(s) and apple-green Ba²⁺ flame from Stream A, plus green Fe(OH)₂(s) and yellow Na⁺ flame from Stream B.',
    hint:
      'Every pipe in your inventory is needed! On Stream A, turn South right before pillar (4,2) with a rotated Filter Bed (N–S), then detour under pillar (6,3). Stream B uses NaOH → Filter Bed → elbow down to row 6.',
    cols: 8,
    rows: 6,
    parTiles: 16,
    challengeTags: ['🧱 Bench Pillars', '📦 Exact Stock'],
    obstacles: [
      { x: 3, y: 1, label: 'Bench Pillar' },
      { x: 5, y: 2, label: 'Bench Pillar' },
    ],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'Ba²⁺ + I⁻ solution',
        ions: { 'Ba2+': 2, 'I-': 1 },
        pulses: 5,
      },
      {
        x: 0,
        y: 4,
        outDir: 'E',
        label: 'Fe²⁺ + Na⁺ solution',
        ions: { 'Fe2+': 1, 'Na+': 1, 'NO3-': 3 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 2,
        inDir: 'W',
        kind: 'flame',
        label: 'Apple-green flame test (Ba²⁺)',
        shortLabel: 'Ba²⁺ flame',
        targetIon: 'Ba2+',
        requiredAmount: 3,
      },
      {
        x: 7,
        y: 5,
        inDir: 'W',
        kind: 'flame',
        label: 'Yellow flame test (Na⁺)',
        shortLabel: 'Na⁺ flame',
        targetIon: 'Na+',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'AgI',
        requiredAmount: 3,
        description: 'Collect yellow AgI(s) on a Filter Bed',
      },
      {
        precipitate: 'Fe(OH)2',
        requiredAmount: 3,
        description: 'Collect green Fe(OH)₂(s) on a Filter Bed',
      },
    ],
    inventory: {
      pipes: { straight: 6, elbow: 6 },
      reagents: { AgNO3: 1, NaOH: 1 },
      filters: 2,
    },
  },
  {
    id: 6,
    code: 'LAB-06',
    title: 'Cross-Over Conundrum',
    tier: 'GCSE Higher',
    specRef: 'WJEC GCSE 5.2.4: iron(II) ions + NaOH · 2.2.3: halides + AgNO₃, Group 1 flame tests',
    brief:
      'Two streams must cross without mixing. Stream A: remove iron(II) as a green precipitate, then flame-test Na⁺. Stream B: remove iodide as yellow silver iodide, then flame-test K⁺ (lilac).',
    hint:
      'Use a Cross-Over tile where the streams meet. Stream A: NaOH then Filter Bed. Stream B: AgNO₃ then Filter Bed. Do NOT add NaOH to Stream B — Na⁺ yellow flame would mask the lilac K⁺ flame!',
    cols: 8,
    rows: 6,
    parTiles: 17,
    challengeTags: ['╬ Crossing Streams'],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'Fe²⁺ + Na⁺ solution',
        ions: { 'Fe2+': 1, 'Na+': 1, 'NO3-': 3 },
        pulses: 5,
      },
      {
        x: 0,
        y: 4,
        outDir: 'E',
        label: 'K⁺ + I⁻ solution',
        ions: { 'K+': 2, 'I-': 1 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'flame',
        label: 'Lilac flame test (K⁺)',
        shortLabel: 'K⁺ flame',
        targetIon: 'K+',
        requiredAmount: 3,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'flame',
        label: 'Yellow flame test (Na⁺)',
        shortLabel: 'Na⁺ flame',
        targetIon: 'Na+',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'Fe(OH)2',
        requiredAmount: 3,
        description: 'Collect green Fe(OH)₂(s) on a Filter Bed',
      },
      {
        precipitate: 'AgI',
        requiredAmount: 3,
        description: 'Collect yellow AgI(s) on a Filter Bed',
      },
    ],
    inventory: {
      pipes: { straight: 12, elbow: 10, crossover: 2 },
      reagents: { NaOH: 1, AgNO3: 1, BaCl2: 1 },
      filters: 3,
    },
  },
  {
    id: 7,
    code: 'LAB-07',
    title: 'The Sabotaged Manifold',
    tier: 'GCSE Higher',
    specRef: 'WJEC GCSE 2.2.3 & 5.2.2: avoiding Cl⁻ contamination upstream of AgNO₃ · Lilac K⁺',
    brief:
      'A locked HCl injector sits directly inline toward Limewater, with a locked Cross-Over below! Split the K⁺ + CO₃²⁻ + I⁻ inflow BEFORE HCl so your AgI(s) avoids false AgCl(s).',
    hint:
      'Place a T-Junction at (2,2) BEFORE the locked HCl at (4,2). Route the East branch straight through HCl to Limewater; route the South branch down to (2,4), through AgNO₃ → Filter Bed → locked Cross-Over (5,4) → K⁺ Flame!',
    cols: 8,
    rows: 6,
    parTiles: 12,
    challengeTags: ['🔒 Locked Manifold', '🧱 Bench Pillars'],
    obstacles: [
      { x: 4, y: 2, label: 'Bench Pillar' },
      { x: 4, y: 4, label: 'Bench Pillar' },
    ],
    lockedTiles: [
      { kind: 'injector', reagent: 'HCl', x: 3, y: 1, rotation: 0 },
      { kind: 'pipe', variant: 'crossover', x: 4, y: 3, rotation: 0 },
    ],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'K⁺, CO₃²⁻ and I⁻ solution',
        ions: { 'K+': 4, 'CO3_2-': 1, 'I-': 1 },
        pulses: 6,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'limewater',
        label: 'Limewater test (CO₂)',
        shortLabel: 'Limewater',
        targetGas: 'CO2',
        requiredAmount: 2,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'flame',
        label: 'Lilac flame test (K⁺)',
        shortLabel: 'K⁺ flame',
        targetIon: 'K+',
        requiredAmount: 2,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'AgI',
        requiredAmount: 2.5,
        description: 'Collect pure yellow AgI(s), free of AgCl(s)',
      },
    ],
    inventory: {
      pipes: { straight: 8, elbow: 6, tee: 1 },
      reagents: { AgNO3: 1, NaOH: 1 },
      filters: 2,
    },
  },

  // ───────────────────────── AS LEVEL (3) ─────────────────────────
  {
    id: 8,
    code: 'LAB-08',
    title: 'Silver Halide Selectivity',
    tier: 'AS Level',
    specRef: 'WJEC AS Unit 1.6(o): Ag⁺ + halide ions, then dilute NH₃(aq) · 1.6(g): flame colours',
    brief:
      'A brine contains Cl⁻, Br⁻ and Na⁺. Precipitate both halides with acidified AgNO₃, use dilute NH₃(aq) to dissolve the white AgCl, and keep pure cream AgBr on a Filter Bed.',
    hint:
      'AgNO₃ gives white AgCl and cream AgBr together. Dilute NH₃(aq) dissolves AgCl but not AgBr. Put the Dil. NH₃ injector straight after AgNO₃ and before the Filter Bed.',
    cols: 8,
    rows: 6,
    parTiles: 9,
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'Na⁺, Cl⁻ and Br⁻ solution',
        ions: { 'Na+': 2, 'Cl-': 1, 'Br-': 1 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'flame',
        label: 'Yellow flame test (Na⁺)',
        shortLabel: 'Na⁺ flame',
        targetIon: 'Na+',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'AgBr',
        requiredAmount: 3,
        description: 'Collect pure cream AgBr(s), no white AgCl(s)',
      },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { AgNO3: 2, NH3_dilute: 2 },
      filters: 2,
    },
  },
  {
    id: 9,
    code: 'LAB-09',
    title: 'Sequential Salt Sieve',
    tier: 'AS Level',
    specRef: 'WJEC AS Unit 1.6(o): AgI vs AgCl in dil. NH₃ · 1.6(f): Mg²⁺ + OH⁻ & Ba²⁺ + SO₄²⁻',
    brief:
      'Two sequential separations! Stream A: separate Cl⁻ from I⁻ using AgNO₃ + dil. NH₃ before filtering AgI(s) and burning K⁺. Stream B: precipitate and filter BaSO₄(s) BEFORE precipitating Mg(OH)₂(s) into the Waste Sink.',
    hint:
      'Stream B requires TWO separate Filter Beds in series: BaCl₂ → Filter 1 (BaSO₄) → NaOH → Filter 2 (Mg(OH)₂) → Waste Sink! Any solids reaching the Waste Sink fail the practical.',
    cols: 8,
    rows: 6,
    parTiles: 12,
    challengeTags: ['🔬 Two-Stage Sieve'],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'K⁺, Cl⁻ and I⁻ solution',
        ions: { 'K+': 2, 'Cl-': 1, 'I-': 1 },
        pulses: 5,
      },
      {
        x: 0,
        y: 4,
        outDir: 'E',
        label: 'Mg²⁺ + SO₄²⁻ solution',
        ions: { 'Mg2+': 1, 'SO4_2-': 1, 'NO3-': 2 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'flame',
        label: 'Lilac flame test (K⁺)',
        shortLabel: 'K⁺ flame',
        targetIon: 'K+',
        requiredAmount: 3,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'waste',
        label: 'Clean Waste Sink',
        shortLabel: 'Waste sink',
        requiredAmount: 0,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'AgI',
        requiredAmount: 3,
        description: 'Collect yellow AgI(s), free of AgCl(s)',
      },
      {
        precipitate: 'BaSO4',
        requiredAmount: 3,
        description: 'Collect white BaSO₄(s) on Filter Bed 1',
      },
      {
        precipitate: 'Mg(OH)2',
        requiredAmount: 3,
        description: 'Collect white Mg(OH)₂(s) on Filter Bed 2',
      },
    ],
    inventory: {
      pipes: { straight: 8, elbow: 4 },
      reagents: { AgNO3: 1, NH3_dilute: 1, BaCl2: 1, NaOH: 1 },
      filters: 3,
    },
  },
  {
    id: 10,
    code: 'LAB-10',
    title: 'Triple Anion Triage',
    tier: 'AS Level',
    specRef: 'WJEC AS Unit 1.6(f),(g),(o): SO₄²⁻, Br⁻ & CO₃²⁻ selective separation (≥98% purity)',
    brief:
      'A 9×6 bench with 8 pulses of Li⁺, CO₃²⁻, SO₄²⁻ and Br⁻! Isolate ≥98% pure BaSO₄(s) on the top branch (feeding Limewater) and ≥98% pure AgBr(s) on the bottom branch (feeding Li⁺ Flame).',
    hint:
      'Split at (2,3) with a T-Junction. Top branch: Acidified BaCl₂ both decomposes CO₃²⁻ → CO₂(g) and precipitates BaSO₄(s) — filter it immediately! Bottom branch: Acidified AgNO₃ (in HNO₃) decomposes CO₃²⁻ cleanly and precipitates AgBr(s) without adding Cl⁻!',
    cols: 9,
    rows: 6,
    parTiles: 18,
    maxSlurryPipes: 1,
    minPurity: 98,
    challengeTags: ['⚡ Rapid Settling', '🎯 ≥98% Purity'],
    sources: [
      {
        x: 0,
        y: 2,
        outDir: 'E',
        label: 'Li⁺, CO₃²⁻, SO₄²⁻, Br⁻',
        ions: { 'Li+': 6, 'CO3_2-': 1, 'SO4_2-': 1, 'Br-': 1 },
        pulses: 8,
      },
    ],
    drains: [
      {
        x: 8,
        y: 0,
        inDir: 'W',
        kind: 'limewater',
        label: 'Limewater test (CO₂)',
        shortLabel: 'Limewater',
        targetGas: 'CO2',
        requiredAmount: 2,
      },
      {
        x: 8,
        y: 5,
        inDir: 'W',
        kind: 'flame',
        label: 'Crimson flame test (Li⁺)',
        shortLabel: 'Li⁺ flame',
        targetIon: 'Li+',
        requiredAmount: 2,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'BaSO4',
        requiredAmount: 3,
        description: 'Collect dense white BaSO₄(s) (≥98% purity)',
      },
      {
        precipitate: 'AgBr',
        requiredAmount: 3,
        description: 'Collect cream AgBr(s), zero AgCl (≥98% purity)',
      },
    ],
    inventory: {
      pipes: { straight: 14, elbow: 6, tee: 2 },
      reagents: { BaCl2: 1, AgNO3: 1, HCl: 1, NH3_dilute: 1 },
      filters: 3,
    },
  },

  // ───────────────────────── A2 LEVEL (4) ─────────────────────────
  {
    id: 11,
    code: 'LAB-11',
    title: 'Rust and Deep Blue',
    tier: 'A2 Level',
    specRef: 'WJEC A2 Unit 3.4(f): [Cu(NH₃)₄(H₂O)₂]²⁺ · 3.4(j): Fe³⁺ and Cu²⁺ with OH⁻',
    brief:
      'Separate Fe³⁺ and Cu²⁺. With excess ammonia, Cu(OH)₂ redissolves to form deep blue [Cu(NH₃)₄(H₂O)₂]²⁺, while rust-brown Fe(OH)₃ stays solid.',
    hint:
      'Inject excess NH₃(aq), then filter. Fe(OH)₃ is insoluble in excess ammonia and is trapped. The deep blue complex ion passes through into the collector.',
    cols: 8,
    rows: 6,
    parTiles: 8,
    sources: [
      {
        x: 0,
        y: 3,
        outDir: 'E',
        label: 'Fe³⁺ + Cu²⁺ solution',
        ions: { 'Fe3+': 1, 'Cu2+': 1, 'NO3-': 5 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'aqueous',
        label: 'Deep blue [Cu(NH₃)₄]²⁺ collector',
        shortLabel: 'Cu complex',
        targetIon: '[Cu(NH3)4]2+',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'Fe(OH)3',
        requiredAmount: 3,
        description: 'Collect red-brown Fe(OH)₃(s) on a Filter Bed',
      },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { NaOH: 1, NH3_dilute: 2, NH3_conc: 2 },
      filters: 2,
    },
  },
  {
    id: 12,
    code: 'LAB-12',
    title: 'The Amphoteric Discriminator',
    tier: 'A2 Level',
    specRef: 'WJEC A2 Unit 3.3(a): amphoteric behaviour of Al³⁺ · AS Unit 1.6(j): Group 2 hydroxides',
    brief:
      'Al³⁺ and Mg²⁺ both give white hydroxide precipitates with a little NaOH. Use excess NaOH so amphoteric Al(OH)₃ redissolves, leaving pure Mg(OH)₂ on the Filter Bed.',
    hint:
      'Put TWO NaOH injectors in series before the Filter Bed to reach excess alkali. Al(OH)₃ dissolves to form colourless [Al(OH)₄]⁻(aq). Mg(OH)₂ is insoluble in excess NaOH and is trapped.',
    cols: 8,
    rows: 6,
    parTiles: 7,
    sources: [
      {
        x: 0,
        y: 2,
        outDir: 'E',
        label: 'Al³⁺ + Mg²⁺ solution',
        ions: { 'Al3+': 1, 'Mg2+': 1, 'NO3-': 5 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 3,
        inDir: 'W',
        kind: 'aqueous',
        label: '[Al(OH)₄]⁻ collector',
        shortLabel: '[Al(OH)₄]⁻',
        targetIon: '[Al(OH)4]-',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'Mg(OH)2',
        requiredAmount: 3,
        description: 'Collect white Mg(OH)₂(s), free of Al(OH)₃',
      },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { NaOH: 3, NH3_dilute: 1 },
      filters: 2,
    },
  },
  {
    id: 13,
    code: 'LAB-13',
    title: 'Golden Rain of Lead(II)',
    tier: 'A2 Level',
    specRef: 'WJEC A2 Unit 3.3(a),(i): Pb²⁺(aq) with I⁻ (yellow PbI₂) & excess OH⁻ ([Pb(OH)₄]²⁻)',
    brief:
      'Split an 8-pulse Pb²⁺ + Mg²⁺ stream! Top branch: precipitate bright-yellow PbI₂(s) with KI(aq) and filter before the Waste Sink. Bottom branch: use Excess NaOH to trap white Mg(OH)₂(s) and recover [Pb(OH)₄]²⁻(aq).',
    hint:
      'Place a T-Junction at (2,3). Top branch: KI → Filter Bed → straight to Waste Sink (avoiding the pillar!). Bottom branch: Excess NaOH → Filter Bed → [Pb(OH)₄]²⁻ collector.',
    cols: 8,
    rows: 6,
    parTiles: 14,
    maxSlurryPipes: 1,
    challengeTags: ['⚡ Rapid Settling', '🧱 Bench Pillars'],
    obstacles: [
      { x: 4, y: 0, label: 'Bench Pillar' },
      { x: 4, y: 5, label: 'Bench Pillar' },
    ],
    sources: [
      {
        x: 0,
        y: 2,
        outDir: 'E',
        label: 'Pb²⁺ + Mg²⁺ solution',
        ions: { 'Pb2+': 2, 'Mg2+': 2, 'NO3-': 8 },
        pulses: 8,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'waste',
        label: 'Clean Waste Sink',
        shortLabel: 'Waste sink',
        requiredAmount: 0,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'aqueous',
        label: '[Pb(OH)₄]²⁻ collector',
        shortLabel: '[Pb(OH)₄]²⁻',
        targetIon: '[Pb(OH)4]2-',
        requiredAmount: 6,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'PbI2',
        requiredAmount: 5,
        description: 'Collect bright-yellow PbI₂(s) on a Filter Bed',
      },
      {
        precipitate: 'Mg(OH)2',
        requiredAmount: 5,
        description: 'Collect white Mg(OH)₂(s) on a Filter Bed',
      },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { KI: 1, NaOH_excess: 1, NaOH: 2 },
      filters: 3,
    },
  },
  {
    id: 14,
    code: 'LAB-14',
    title: 'Chromium Emerald Exchange',
    tier: 'A2 Level',
    specRef: 'WJEC A2 Unit 3.4(b),(f),(j): Cr³⁺ + excess OH⁻ → [Cr(OH)₆]³⁻ · Fe²⁺/Fe³⁺/Cu²⁺',
    brief:
      'Two crossing transition-metal streams with a locked Cross-Over! Stream A: separate green Fe(OH)₂(s) from Cr³⁺ using Excess NaOH to recover emerald [Cr(OH)₆]³⁻. Stream B: separate Fe(OH)₃(s) from Cu²⁺ using Excess NH₃.',
    hint:
      'Route both streams through the locked Cross-Over at (5,3). Stream A (top-left → bottom-right): Excess NaOH → Filter Fe(OH)₂ → cross N–S. Stream B (bottom-left → top-right): Excess NH₃ → Filter Fe(OH)₃ → cross W–E.',
    cols: 8,
    rows: 6,
    parTiles: 16,
    minPurity: 98,
    challengeTags: ['🔒 Locked Manifold', '🎯 ≥98% Purity'],
    lockedTiles: [{ kind: 'pipe', variant: 'crossover', x: 4, y: 2, rotation: 0 }],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'Cr³⁺ + Fe²⁺ solution',
        ions: { 'Cr3+': 1, 'Fe2+': 1, 'NO3-': 5 },
        pulses: 5,
      },
      {
        x: 0,
        y: 4,
        outDir: 'E',
        label: 'Cu²⁺ + Fe³⁺ solution',
        ions: { 'Cu2+': 1, 'Fe3+': 1, 'NO3-': 5 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'aqueous',
        label: 'Deep blue [Cu(NH₃)₄]²⁺ collector',
        shortLabel: 'Cu complex',
        targetIon: '[Cu(NH3)4]2+',
        requiredAmount: 3,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'aqueous',
        label: 'Emerald [Cr(OH)₆]³⁻ collector',
        shortLabel: '[Cr(OH)₆]³⁻',
        targetIon: '[Cr(OH)6]3-',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'Fe(OH)2',
        requiredAmount: 3,
        description: 'Collect green Fe(OH)₂(s) (≥98% purity)',
      },
      {
        precipitate: 'Fe(OH)3',
        requiredAmount: 3,
        description: 'Collect red-brown Fe(OH)₃(s) (≥98% purity)',
      },
    ],
    inventory: {
      pipes: { straight: 8, elbow: 8 },
      reagents: { NaOH_excess: 1, NaOH: 2, NH3_conc: 1, NH3_dilute: 1 },
      filters: 3,
    },
  },

  // ───────────────────────── EXAM CHALLENGE (2) ─────────────────────────
  {
    id: 15,
    code: 'LAB-15',
    title: 'Chief Analyst Certification',
    tier: 'Exam Challenge',
    specRef: 'WJEC A2 Unit 3.3(a) & 3.4(j) · AS Unit 1.6: sulfate test with Ba²⁺ (≥98% purity)',
    brief:
      'Dual-stream synthesis exam with bench pillars! Stream A: separate Al³⁺ and Fe³⁺ using excess NaOH. Stream B: remove SO₄²⁻ as BaSO₄(s) and collect blue Cu²⁺(aq).',
    hint:
      'Stream A: two NaOH injectors (or Excess NaOH) then Filter Bed (Fe(OH)₃ stays solid, Al(OH)₃ dissolves). Stream B: BaCl₂ then Filter Bed for white BaSO₄. Cross over between the pillars.',
    cols: 8,
    rows: 6,
    parTiles: 17,
    minPurity: 98,
    challengeTags: ['🧱 Bench Pillars', '🎯 ≥98% Purity'],
    obstacles: [
      { x: 2, y: 2, label: 'Bench Pillar' },
      { x: 6, y: 3, label: 'Bench Pillar' },
    ],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'Al³⁺ + Fe³⁺ solution',
        ions: { 'Al3+': 1, 'Fe3+': 1, 'NO3-': 6 },
        pulses: 5,
      },
      {
        x: 0,
        y: 4,
        outDir: 'E',
        label: 'Cu²⁺ + SO₄²⁻ solution',
        ions: { 'Cu2+': 1, 'SO4_2-': 1 },
        pulses: 5,
      },
    ],
    drains: [
      {
        x: 7,
        y: 1,
        inDir: 'W',
        kind: 'aqueous',
        label: 'Blue Cu²⁺(aq) collector',
        shortLabel: 'Cu²⁺(aq)',
        targetIon: 'Cu2+',
        requiredAmount: 3,
      },
      {
        x: 7,
        y: 4,
        inDir: 'W',
        kind: 'aqueous',
        label: '[Al(OH)₄]⁻ collector',
        shortLabel: '[Al(OH)₄]⁻',
        targetIon: '[Al(OH)4]-',
        requiredAmount: 3,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'Fe(OH)3',
        requiredAmount: 3,
        description: 'Collect red-brown Fe(OH)₃(s) (≥98% purity)',
      },
      {
        precipitate: 'BaSO4',
        requiredAmount: 3,
        description: 'Collect white BaSO₄(s) (≥98% purity)',
      },
    ],
    inventory: {
      pipes: { straight: 14, elbow: 10, crossover: 2, tee: 1 },
      reagents: { NaOH: 2, NaOH_excess: 1, BaCl2: 2, NH3_dilute: 1 },
      filters: 3,
    },
  },
  {
    id: 16,
    code: 'LAB-16',
    title: 'Grand Master Gauntlet',
    tier: 'Exam Challenge',
    specRef: 'WJEC A2 Unit 3.3(i) & 3.4(b),(f),(j) · AS 1.6 · Rapid Settling + ≥98% Purity',
    brief:
      'Final mastery challenge on a 9×6 bench! Stream A (Pb²⁺ + Cu²⁺): isolate PbCl₂(s), then complex Cu²⁺ to [Cu(NH₃)₄]²⁺. Stream B (Cr³⁺ + SO₄²⁻): isolate BaSO₄(s), then convert Cr³⁺ to [Cr(OH)₆]³⁻. Watch the pillars & locked bridge!',
    hint:
      'Stream A: Dil. HCl → Filter PbCl₂(s) immediately → Excess NH₃ → route N–S through locked Cross-Over (6,3), then jog East around pillar (6,5) to (9,5). Stream B: BaCl₂ → Filter BaSO₄(s) immediately → Excess NaOH → route W–E through (6,3) to (9,2).',
    cols: 9,
    rows: 6,
    parTiles: 18,
    maxSlurryPipes: 1,
    minPurity: 98,
    challengeTags: ['⚡ Rapid Settling', '🔒 Locked Manifold', '🎯 ≥98% Purity'],
    obstacles: [
      { x: 5, y: 0, label: 'Bench Pillar' },
      { x: 5, y: 4, label: 'Bench Pillar' },
      { x: 5, y: 5, label: 'Bench Pillar' },
    ],
    lockedTiles: [{ kind: 'pipe', variant: 'crossover', x: 5, y: 2, rotation: 0 }],
    sources: [
      {
        x: 0,
        y: 1,
        outDir: 'E',
        label: 'Pb²⁺ + Cu²⁺ solution',
        ions: { 'Pb2+': 1, 'Cu2+': 1, 'NO3-': 4 },
        pulses: 6,
      },
      {
        x: 0,
        y: 4,
        outDir: 'E',
        label: 'Cr³⁺ + SO₄²⁻ + Na⁺',
        ions: { 'Cr3+': 1, 'SO4_2-': 1, 'Na+': 2 },
        pulses: 6,
      },
    ],
    drains: [
      {
        x: 8,
        y: 1,
        inDir: 'W',
        kind: 'aqueous',
        label: 'Emerald [Cr(OH)₆]³⁻ collector',
        shortLabel: '[Cr(OH)₆]³⁻',
        targetIon: '[Cr(OH)6]3-',
        requiredAmount: 4,
      },
      {
        x: 8,
        y: 4,
        inDir: 'W',
        kind: 'aqueous',
        label: 'Deep blue [Cu(NH₃)₄]²⁺ collector',
        shortLabel: 'Cu complex',
        targetIon: '[Cu(NH3)4]2+',
        requiredAmount: 4,
      },
    ],
    precipitateQuotas: [
      {
        precipitate: 'PbCl2',
        requiredAmount: 4,
        description: 'Collect white PbCl₂(s) (≥98% purity)',
      },
      {
        precipitate: 'BaSO4',
        requiredAmount: 4,
        description: 'Collect white BaSO₄(s) (≥98% purity)',
      },
    ],
    inventory: {
      pipes: { straight: 6, elbow: 8 },
      reagents: { HCl: 1, NH3_conc: 1, BaCl2: 1, NaOH_excess: 1, AgNO3: 1 },
      filters: 3,
    },
  },
];
