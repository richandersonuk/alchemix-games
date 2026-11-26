import { Direction, GasId, IonId, PrecipitateId, ReagentId } from './reactions';

export type PipeVariant = 'straight' | 'elbow' | 'tee' | 'crossover';

/**
 * Level tiers follow the WJEC specifications:
 *  - GCSE Foundation / Higher: WJEC GCSE The Sciences (Double Award) 2.2.3 & 5.2.4
 *  - AS Level: WJEC AS Chemistry Unit 1.6 (The Periodic Table)
 *  - A2 Level: WJEC A2 Chemistry Units 3.3 (p-block) & 3.4 (d-block)
 */
export type LevelTier = 'GCSE Foundation' | 'GCSE Higher' | 'AS Level' | 'A2 Level';

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
}

export const LEVELS: LevelDefinition[] = [
  // ───────────────────────── GCSE FOUNDATION ─────────────────────────
  {
    id: 1,
    code: 'LAB-01',
    title: 'Blue Precipitate Rescue',
    tier: 'GCSE Foundation',
    specRef: 'WJEC GCSE 5.2.4: copper(II) ions + NaOH · 2.2.3: Group 1 flame tests',
    brief:
      'Separate Cu²⁺ from Na⁺. Add sodium hydroxide to make a blue precipitate of copper(II) hydroxide, filter it off, then flame-test the clear solution for a yellow Na⁺ flame.',
    hint:
      'Place a NaOH injector, then a Filter Bed straight after it so the blue Cu(OH)₂ is trapped. The clear filtrate still contains Na⁺ ions and goes to the flame test.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 2, outDir: 'E', label: 'Cu²⁺ + Na⁺ solution', ions: { 'Cu2+': 1, 'Na+': 1, 'NO3-': 3 }, pulses: 5 },
    ],
    drains: [
      { x: 7, y: 4, inDir: 'W', kind: 'flame', label: 'Yellow flame test (Na⁺)', shortLabel: 'Na⁺ flame', targetIon: 'Na+', requiredAmount: 3 },
    ],
    precipitateQuotas: [
      { precipitate: 'Cu(OH)2', requiredAmount: 3, description: 'Collect blue Cu(OH)₂(s) on a Filter Bed (90% purity or more)' },
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
    title: 'Effervescent Detour',
    tier: 'GCSE Foundation',
    specRef: 'WJEC GCSE 5.2.4: sulfate ions + BaCl₂ · 5.2.3: acid + carbonate → CO₂ · 2.2.3: flame tests',
    brief:
      'Prove carbonate ions by bubbling CO₂ through limewater, collect the white barium sulfate precipitate on a Filter Bed, and flame-test the solution for crimson Li⁺.',
    hint:
      'Acidified BaCl₂ turns carbonate into CO₂ gas and sulfate into white BaSO₄ solid. Filter the BaSO₄ straight away, then use a T-Junction to send one stream to the limewater and one to the flame test.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 2, outDir: 'E', label: 'Li⁺, CO₃²⁻ and SO₄²⁻ solution', ions: { 'Li+': 4, 'CO3_2-': 1, 'SO4_2-': 1 }, pulses: 6 },
    ],
    drains: [
      { x: 7, y: 1, inDir: 'W', kind: 'limewater', label: 'Limewater test (CO₂)', shortLabel: 'Limewater', targetGas: 'CO2', requiredAmount: 2 },
      { x: 7, y: 4, inDir: 'W', kind: 'flame', label: 'Crimson flame test (Li⁺)', shortLabel: 'Li⁺ flame', targetIon: 'Li+', requiredAmount: 2 },
    ],
    precipitateQuotas: [
      { precipitate: 'BaSO4', requiredAmount: 3, description: 'Collect white BaSO₄(s) on a Filter Bed (90% purity or more)' },
    ],
    inventory: {
      pipes: { straight: 12, elbow: 8, tee: 2 },
      reagents: { HCl: 2, BaCl2: 2 },
      filters: 2,
    },
  },

  // ───────────────────────── GCSE HIGHER ─────────────────────────
  {
    id: 3,
    code: 'LAB-03',
    title: 'The Chloride Trap',
    tier: 'GCSE Higher',
    specRef: 'WJEC GCSE 2.2.3: halide ions + AgNO₃ · 5.2.3: carbonate test · 2.2.3: flame tests',
    brief:
      'Split a Li⁺, CO₃²⁻ and Br⁻ sample. Prove CO₂ in limewater and collect pure cream silver bromide, without letting extra chloride ions from HCl spoil the halide test.',
    hint:
      'Never add HCl before AgNO₃: HCl contains Cl⁻, which gives a false white AgCl precipitate. Use a T-Junction first. One branch gets HCl, then limewater. The other gets AgNO₃, a Filter Bed, then the Li⁺ flame test.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 2, outDir: 'E', label: 'Li⁺, CO₃²⁻ and Br⁻ solution', ions: { 'Li+': 3, 'CO3_2-': 1, 'Br-': 1 }, pulses: 6 },
    ],
    drains: [
      { x: 7, y: 0, inDir: 'W', kind: 'limewater', label: 'Limewater test (CO₂)', shortLabel: 'Limewater', targetGas: 'CO2', requiredAmount: 2 },
      { x: 7, y: 5, inDir: 'W', kind: 'flame', label: 'Crimson flame test (Li⁺)', shortLabel: 'Li⁺ flame', targetIon: 'Li+', requiredAmount: 2 },
    ],
    precipitateQuotas: [
      { precipitate: 'AgBr', requiredAmount: 2.5, description: 'Collect pure cream AgBr(s), no white AgCl(s) (90% purity or more)' },
    ],
    inventory: {
      pipes: { straight: 14, elbow: 8, tee: 2 },
      reagents: { HCl: 2, AgNO3: 2 },
      filters: 2,
    },
  },
  {
    id: 4,
    code: 'LAB-04',
    title: 'Cross-Over Conundrum',
    tier: 'GCSE Higher',
    specRef: 'WJEC GCSE 5.2.4: iron(II) ions + NaOH · 2.2.3: halides + AgNO₃, Group 1 flame tests',
    brief:
      'Two streams must cross without mixing. Stream A: remove iron(II) as a green precipitate, then flame-test Na⁺. Stream B: remove iodide as yellow silver iodide, then flame-test K⁺ (lilac).',
    hint:
      'Use a Cross-Over tile where the streams meet. Stream A: NaOH then Filter Bed. Stream B: AgNO₃ then Filter Bed. Do NOT add NaOH to stream B: the Na⁺ yellow flame would hide the lilac K⁺ flame.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 1, outDir: 'E', label: 'Fe²⁺ + Na⁺ solution', ions: { 'Fe2+': 1, 'Na+': 1, 'NO3-': 3 }, pulses: 5 },
      { x: 0, y: 4, outDir: 'E', label: 'K⁺ + I⁻ solution', ions: { 'K+': 2, 'I-': 1 }, pulses: 5 },
    ],
    drains: [
      { x: 7, y: 1, inDir: 'W', kind: 'flame', label: 'Lilac flame test (K⁺)', shortLabel: 'K⁺ flame', targetIon: 'K+', requiredAmount: 3 },
      { x: 7, y: 4, inDir: 'W', kind: 'flame', label: 'Yellow flame test (Na⁺)', shortLabel: 'Na⁺ flame', targetIon: 'Na+', requiredAmount: 3 },
    ],
    precipitateQuotas: [
      { precipitate: 'Fe(OH)2', requiredAmount: 3, description: 'Collect green Fe(OH)₂(s) on a Filter Bed (90% purity or more)' },
      { precipitate: 'AgI', requiredAmount: 3, description: 'Collect yellow AgI(s) on a Filter Bed (90% purity or more)' },
    ],
    inventory: {
      pipes: { straight: 12, elbow: 10, crossover: 2 },
      reagents: { NaOH: 1, AgNO3: 1, BaCl2: 1 },
      filters: 3,
    },
  },

  // ───────────────────────── AS LEVEL ─────────────────────────
  {
    id: 5,
    code: 'LAB-05',
    title: 'Silver Halide Selectivity',
    tier: 'AS Level',
    specRef: 'WJEC AS Unit 1.6(o): Ag⁺ + halide ions, then dilute NH₃(aq) · 1.6(g): flame colours',
    brief:
      'A brine contains Cl⁻, Br⁻ and Na⁺. Precipitate both halides with acidified AgNO₃, use dilute NH₃(aq) to dissolve the white AgCl, and keep pure cream AgBr on a Filter Bed.',
    hint:
      'AgNO₃ gives white AgCl and cream AgBr together. Dilute NH₃(aq) dissolves AgCl but not AgBr. Put the NH₃ injector straight after AgNO₃ and before the Filter Bed. The Na⁺ left in solution goes to the flame test.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 1, outDir: 'E', label: 'Na⁺, Cl⁻ and Br⁻ solution', ions: { 'Na+': 2, 'Cl-': 1, 'Br-': 1 }, pulses: 5 },
    ],
    drains: [
      { x: 7, y: 4, inDir: 'W', kind: 'flame', label: 'Yellow flame test (Na⁺)', shortLabel: 'Na⁺ flame', targetIon: 'Na+', requiredAmount: 3 },
    ],
    precipitateQuotas: [
      { precipitate: 'AgBr', requiredAmount: 3, description: 'Collect pure cream AgBr(s), no white AgCl(s) (90% purity or more)' },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { AgNO3: 2, NH3_dilute: 2 },
      filters: 2,
    },
  },

  // ───────────────────────── A2 LEVEL ─────────────────────────
  {
    id: 6,
    code: 'LAB-06',
    title: 'Rust and Deep Blue',
    tier: 'A2 Level',
    specRef: 'WJEC A2 Unit 3.4(f): [Cu(NH₃)₄(H₂O)₂]²⁺ · 3.4(j): Fe³⁺ and Cu²⁺ with OH⁻',
    brief:
      'Separate Fe³⁺ and Cu²⁺. With excess ammonia, Cu(OH)₂ redissolves to form deep blue [Cu(NH₃)₄(H₂O)₂]²⁺, while rust-brown Fe(OH)₃ stays solid.',
    hint:
      'Inject excess NH₃(aq) (the "Excess NH₃" injector), then filter. Fe(OH)₃ is insoluble in excess ammonia and is trapped. The deep blue complex ion passes through into the collector.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 3, outDir: 'E', label: 'Fe³⁺ + Cu²⁺ solution', ions: { 'Fe3+': 1, 'Cu2+': 1, 'NO3-': 5 }, pulses: 5 },
    ],
    drains: [
      { x: 7, y: 1, inDir: 'W', kind: 'aqueous', label: 'Deep blue [Cu(NH₃)₄]²⁺ collector', shortLabel: 'Cu complex', targetIon: '[Cu(NH3)4]2+', requiredAmount: 3 },
    ],
    precipitateQuotas: [
      { precipitate: 'Fe(OH)3', requiredAmount: 3, description: 'Collect red-brown Fe(OH)₃(s) on a Filter Bed (90% purity or more)' },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { NaOH: 1, NH3_dilute: 2, NH3_conc: 2 },
      filters: 2,
    },
  },
  {
    id: 7,
    code: 'LAB-07',
    title: 'The Amphoteric Discriminator',
    tier: 'A2 Level',
    specRef: 'WJEC A2 Unit 3.3(a): amphoteric behaviour of Al³⁺ · AS Unit 1.6(j): Group 2 hydroxides',
    brief:
      'Al³⁺ and Mg²⁺ both give white hydroxide precipitates with a little NaOH. Use excess NaOH so amphoteric Al(OH)₃ redissolves, leaving pure Mg(OH)₂ on the Filter Bed.',
    hint:
      'Put TWO NaOH injectors in series before the Filter Bed to reach excess alkali. Al(OH)₃ dissolves to form colourless [Al(OH)₄]⁻(aq). Mg(OH)₂ is insoluble in excess NaOH and is trapped.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 2, outDir: 'E', label: 'Al³⁺ + Mg²⁺ solution', ions: { 'Al3+': 1, 'Mg2+': 1, 'NO3-': 5 }, pulses: 5 },
    ],
    drains: [
      { x: 7, y: 3, inDir: 'W', kind: 'aqueous', label: '[Al(OH)₄]⁻ collector', shortLabel: '[Al(OH)₄]⁻', targetIon: '[Al(OH)4]-', requiredAmount: 3 },
    ],
    precipitateQuotas: [
      { precipitate: 'Mg(OH)2', requiredAmount: 3, description: 'Collect white Mg(OH)₂(s), free of Al(OH)₃ (90% purity or more)' },
    ],
    inventory: {
      pipes: { straight: 10, elbow: 6, tee: 1 },
      reagents: { NaOH: 3, NH3_dilute: 1 },
      filters: 2,
    },
  },
  {
    id: 8,
    code: 'LAB-08',
    title: 'Chief Analyst Certification',
    tier: 'A2 Level',
    specRef: 'WJEC A2 Unit 3.3(a) and 3.4(j) · AS Unit 1.6: sulfate test with Ba²⁺',
    brief:
      'Final exam. Stream A: separate Al³⁺ and Fe³⁺ using excess NaOH. Stream B: remove SO₄²⁻ as BaSO₄ and collect the blue Cu²⁺ solution. The streams cross over.',
    hint:
      'Stream A: two NaOH injectors, then a Filter Bed (Fe(OH)₃ stays solid, Al(OH)₃ dissolves). Stream B: BaCl₂ then a Filter Bed for the white BaSO₄. Use a Cross-Over where the streams meet.',
    cols: 8,
    rows: 6,
    sources: [
      { x: 0, y: 1, outDir: 'E', label: 'Al³⁺ + Fe³⁺ solution', ions: { 'Al3+': 1, 'Fe3+': 1, 'NO3-': 6 }, pulses: 5 },
      { x: 0, y: 4, outDir: 'E', label: 'Cu²⁺ + SO₄²⁻ solution', ions: { 'Cu2+': 1, 'SO4_2-': 1 }, pulses: 5 },
    ],
    drains: [
      { x: 7, y: 1, inDir: 'W', kind: 'aqueous', label: 'Blue Cu²⁺(aq) collector', shortLabel: 'Cu²⁺(aq)', targetIon: 'Cu2+', requiredAmount: 3 },
      { x: 7, y: 4, inDir: 'W', kind: 'aqueous', label: '[Al(OH)₄]⁻ collector', shortLabel: '[Al(OH)₄]⁻', targetIon: '[Al(OH)4]-', requiredAmount: 3 },
    ],
    precipitateQuotas: [
      { precipitate: 'Fe(OH)3', requiredAmount: 3, description: 'Collect red-brown Fe(OH)₃(s) on a Filter Bed (90% purity or more)' },
      { precipitate: 'BaSO4', requiredAmount: 3, description: 'Collect white BaSO₄(s) on a Filter Bed (90% purity or more)' },
    ],
    inventory: {
      pipes: { straight: 14, elbow: 10, crossover: 2, tee: 1 },
      reagents: { NaOH: 2, NaOH_excess: 1, BaCl2: 2, NH3_dilute: 1 },
      filters: 3,
    },
  },
];
