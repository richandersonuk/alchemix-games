export type Direction = 'N' | 'E' | 'S' | 'W';

export type IonId =
  | 'Cu2+'
  | 'Fe2+'
  | 'Fe3+'
  | 'Al3+'
  | 'Mg2+'
  | 'Ca2+'
  | 'Li+'
  | 'Na+'
  | 'K+'
  | 'NH4+'
  | 'Ba2+'
  | 'Ag+'
  | '[Al(OH)4]-'
  | '[Cu(NH3)4]2+'
  | '[Ag(NH3)2]+'
  | 'Cl-'
  | 'Br-'
  | 'I-'
  | 'SO4_2-'
  | 'CO3_2-'
  | 'NO3-';

export type PrecipitateId =
  | 'Cu(OH)2'
  | 'Fe(OH)2'
  | 'Fe(OH)3'
  | 'Al(OH)3'
  | 'Mg(OH)2'
  | 'Ca(OH)2'
  | 'AgCl'
  | 'AgBr'
  | 'AgI'
  | 'BaSO4'
  | 'BaCO3';

export type GasId = 'CO2';

export type ReagentId =
  | 'NaOH'
  | 'NaOH_excess'
  | 'NH3_dilute'
  | 'NH3_conc'
  | 'AgNO3'
  | 'BaCl2'
  | 'HCl';

export interface IonMetadata {
  id: IonId;
  formula: string;
  name: string;
  chargeType: 'cation' | 'anion' | 'complex';
  aqueousColor: string | null; // null = colourless
  flameColor?: {
    name: string;
    hex: string;
    coreHex: string;
    maskingWeight: number;
  };
  isSpectator?: boolean;
}

export interface PrecipitateMetadata {
  id: PrecipitateId;
  formula: string;
  name: string;
  markSchemeColor: string;
  colorHex: string;
  accentHex: string;
  oxidizesAtAir?: boolean; // Fe(OH)2 turns brown at air boundaries
  equation: string;
}

export interface ReagentMetadata {
  id: ReagentId;
  formula: string;
  shortLabel: string;
  name: string;
  bottleColor: string;
  description: string;
}

export const ION_DATA: Record<IonId, IonMetadata> = {
  'Cu2+': {
    id: 'Cu2+',
    formula: 'Cu²⁺(aq)',
    name: 'Copper(II) ion',
    chargeType: 'cation',
    aqueousColor: '#38bdf8',
    flameColor: {
      name: 'Green-Blue',
      hex: '#10b981',
      coreHex: '#6ee7b7',
      maskingWeight: 1.0,
    },
  },
  'Fe2+': {
    id: 'Fe2+',
    formula: 'Fe²⁺(aq)',
    name: 'Iron(II) ion',
    chargeType: 'cation',
    aqueousColor: '#86efac',
  },
  'Fe3+': {
    id: 'Fe3+',
    formula: 'Fe³⁺(aq)',
    name: 'Iron(III) ion',
    chargeType: 'cation',
    aqueousColor: '#f59e0b',
  },
  'Al3+': {
    id: 'Al3+',
    formula: 'Al³⁺(aq)',
    name: 'Aluminium ion',
    chargeType: 'cation',
    aqueousColor: null,
  },
  'Mg2+': {
    id: 'Mg2+',
    formula: 'Mg²⁺(aq)',
    name: 'Magnesium ion',
    chargeType: 'cation',
    aqueousColor: null,
  },
  'Ca2+': {
    id: 'Ca2+',
    formula: 'Ca²⁺(aq)',
    name: 'Calcium ion',
    chargeType: 'cation',
    aqueousColor: null,
    flameColor: {
      name: 'Brick-Red',
      hex: '#ea580c',
      coreHex: '#fdba74',
      maskingWeight: 1.0,
    },
  },
  'Li+': {
    id: 'Li+',
    formula: 'Li⁺(aq)',
    name: 'Lithium ion',
    chargeType: 'cation',
    aqueousColor: null,
    flameColor: {
      name: 'Crimson',
      hex: '#dc2626',
      coreHex: '#fca5a5',
      maskingWeight: 1.0,
    },
  },
  'Na+': {
    id: 'Na+',
    formula: 'Na⁺(aq)',
    name: 'Sodium ion',
    chargeType: 'cation',
    aqueousColor: null,
    flameColor: {
      name: 'Yellow',
      hex: '#facc15',
      coreHex: '#fef08a',
      maskingWeight: 2.0, // Strong yellow emission masks subtle flames like K+ lilac
    },
  },
  'K+': {
    id: 'K+',
    formula: 'K⁺(aq)',
    name: 'Potassium ion',
    chargeType: 'cation',
    aqueousColor: null,
    flameColor: {
      name: 'Lilac',
      hex: '#c084fc',
      coreHex: '#f3e8ff',
      maskingWeight: 1.0,
    },
  },
  'NH4+': {
    id: 'NH4+',
    formula: 'NH₄⁺(aq)',
    name: 'Ammonium ion',
    chargeType: 'cation',
    aqueousColor: null,
    isSpectator: true,
  },
  'Ba2+': {
    id: 'Ba2+',
    formula: 'Ba²⁺(aq)',
    name: 'Barium ion',
    chargeType: 'cation',
    aqueousColor: null,
    flameColor: {
      name: 'Apple-Green',
      hex: '#84cc16',
      coreHex: '#d9f99d',
      maskingWeight: 1.0,
    },
  },
  'Ag+': {
    id: 'Ag+',
    formula: 'Ag⁺(aq)',
    name: 'Silver(I) ion',
    chargeType: 'cation',
    aqueousColor: null,
  },
  '[Al(OH)4]-': {
    id: '[Al(OH)4]-',
    formula: '[Al(OH)₄]⁻(aq)',
    name: 'Tetrahydroxoaluminate(III)',
    chargeType: 'complex',
    aqueousColor: null,
  },
  '[Cu(NH3)4]2+': {
    id: '[Cu(NH3)4]2+',
    formula: '[Cu(NH₃)₄(H₂O)₂]²⁺(aq)',
    name: 'Tetraamminecopper(II)',
    chargeType: 'complex',
    aqueousColor: '#1d4ed8',
  },
  '[Ag(NH3)2]+': {
    id: '[Ag(NH3)2]+',
    formula: '[Ag(NH₃)₂]⁺(aq)',
    name: 'Diamminesilver(I)',
    chargeType: 'complex',
    aqueousColor: null,
  },
  'Cl-': {
    id: 'Cl-',
    formula: 'Cl⁻(aq)',
    name: 'Chloride ion',
    chargeType: 'anion',
    aqueousColor: null,
    isSpectator: true,
  },
  'Br-': {
    id: 'Br-',
    formula: 'Br⁻(aq)',
    name: 'Bromide ion',
    chargeType: 'anion',
    aqueousColor: null,
  },
  'I-': {
    id: 'I-',
    formula: 'I⁻(aq)',
    name: 'Iodide ion',
    chargeType: 'anion',
    aqueousColor: null,
  },
  'SO4_2-': {
    id: 'SO4_2-',
    formula: 'SO₄²⁻(aq)',
    name: 'Sulfate ion',
    chargeType: 'anion',
    aqueousColor: null,
  },
  'CO3_2-': {
    id: 'CO3_2-',
    formula: 'CO₃²⁻(aq)',
    name: 'Carbonate ion',
    chargeType: 'anion',
    aqueousColor: null,
  },
  'NO3-': {
    id: 'NO3-',
    formula: 'NO₃⁻(aq)',
    name: 'Nitrate ion',
    chargeType: 'anion',
    aqueousColor: null,
    isSpectator: true,
  },
};

export const PRECIPITATE_DATA: Record<PrecipitateId, PrecipitateMetadata> = {
  'Cu(OH)2': {
    id: 'Cu(OH)2',
    formula: 'Cu(OH)₂(s)',
    name: 'Copper(II) hydroxide',
    markSchemeColor: 'Blue gelatinous precipitate',
    colorHex: '#2563eb',
    accentHex: '#93c5fd',
    equation: 'Cu²⁺(aq) + 2OH⁻(aq) → Cu(OH)₂(s)',
  },
  'Fe(OH)2': {
    id: 'Fe(OH)2',
    formula: 'Fe(OH)₂(s)',
    name: 'Iron(II) hydroxide',
    markSchemeColor: 'Green precipitate (turns brown at air boundaries)',
    colorHex: '#4d7c0f',
    accentHex: '#92400e',
    oxidizesAtAir: true,
    equation: 'Fe²⁺(aq) + 2OH⁻(aq) → Fe(OH)₂(s)',
  },
  'Fe(OH)3': {
    id: 'Fe(OH)3',
    formula: 'Fe(OH)₃(s)',
    name: 'Iron(III) hydroxide',
    markSchemeColor: 'Rust red-brown precipitate',
    colorHex: '#9a3412',
    accentHex: '#fdba74',
    equation: 'Fe³⁺(aq) + 3OH⁻(aq) → Fe(OH)₃(s)',
  },
  'Al(OH)3': {
    id: 'Al(OH)3',
    formula: 'Al(OH)₃(s)',
    name: 'Aluminium hydroxide',
    markSchemeColor: 'White precipitate (amphoteric — redissolves in excess NaOH)',
    colorHex: '#f1f5f9',
    accentHex: '#cbd5e1',
    equation: 'Al³⁺(aq) + 3OH⁻(aq) → Al(OH)₃(s)',
  },
  'Mg(OH)2': {
    id: 'Mg(OH)2',
    formula: 'Mg(OH)₂(s)',
    name: 'Magnesium hydroxide',
    markSchemeColor: 'Insoluble white precipitate (insoluble in excess NaOH)',
    colorHex: '#e2e8f0',
    accentHex: '#94a3b8',
    equation: 'Mg²⁺(aq) + 2OH⁻(aq) → Mg(OH)₂(s)',
  },
  'Ca(OH)2': {
    id: 'Ca(OH)2',
    formula: 'Ca(OH)₂(s)',
    name: 'Calcium hydroxide',
    markSchemeColor: 'White precipitate (insoluble in excess NaOH; none in dilute NH₃)',
    colorHex: '#f8fafc',
    accentHex: '#cbd5e1',
    equation: 'Ca²⁺(aq) + 2OH⁻(aq) → Ca(OH)₂(s)',
  },
  AgCl: {
    id: 'AgCl',
    formula: 'AgCl(s)',
    name: 'Silver chloride',
    markSchemeColor: 'White precipitate (dissolves in dilute NH₃)',
    colorHex: '#f8fafc',
    accentHex: '#e2e8f0',
    equation: 'Ag⁺(aq) + Cl⁻(aq) → AgCl(s)',
  },
  AgBr: {
    id: 'AgBr',
    formula: 'AgBr(s)',
    name: 'Silver bromide',
    markSchemeColor: 'Cream precipitate (dissolves only in conc. NH₃)',
    colorHex: '#fde68a',
    accentHex: '#fef3c7',
    equation: 'Ag⁺(aq) + Br⁻(aq) → AgBr(s)',
  },
  AgI: {
    id: 'AgI',
    formula: 'AgI(s)',
    name: 'Silver iodide',
    markSchemeColor: 'Yellow precipitate (insoluble in conc. NH₃)',
    colorHex: '#facc15',
    accentHex: '#fef08a',
    equation: 'Ag⁺(aq) + I⁻(aq) → AgI(s)',
  },
  BaSO4: {
    id: 'BaSO4',
    formula: 'BaSO₄(s)',
    name: 'Barium sulfate',
    markSchemeColor: 'Dense white precipitate',
    colorHex: '#ffffff',
    accentHex: '#cbd5e1',
    equation: 'Ba²⁺(aq) + SO₄²⁻(aq) → BaSO₄(s)',
  },
  BaCO3: {
    id: 'BaCO3',
    formula: 'BaCO₃(s)',
    name: 'Barium carbonate',
    markSchemeColor: 'White precipitate (false sulfate positive if unacidified)',
    colorHex: '#e2e8f0',
    accentHex: '#94a3b8',
    equation: 'Ba²⁺(aq) + CO₃²⁻(aq) → BaCO₃(s)',
  },
};

export const REAGENT_DATA: Record<ReagentId, ReagentMetadata> = {
  NaOH: {
    id: 'NaOH',
    formula: 'NaOH(aq)',
    shortLabel: 'NaOH',
    name: 'Sodium Hydroxide (Dropwise)',
    bottleColor: '#38bdf8',
    description:
      'Precipitates Cu²⁺, Fe²⁺, Fe³⁺, Al³⁺, Mg²⁺, Ca²⁺. Chain 2 NaOH injectors for Excess NaOH (redissolves Al(OH)₃)! Adds Na⁺.',
  },
  NaOH_excess: {
    id: 'NaOH_excess',
    formula: 'Excess NaOH',
    shortLabel: 'xs NaOH',
    name: 'Excess Sodium Hydroxide',
    bottleColor: '#0ea5e9',
    description:
      'Precipitates hydroxides AND immediately redissolves amphoteric Al(OH)₃ into clear [Al(OH)₄]⁻(aq). Adds Na⁺.',
  },
  NH3_dilute: {
    id: 'NH3_dilute',
    formula: 'Dil. NH₃(aq)',
    shortLabel: 'Dil NH₃',
    name: 'Dilute Ammonia',
    bottleColor: '#818cf8',
    description:
      'Precipitates Cu²⁺, Fe²⁺, Fe³⁺, Al³⁺, Mg²⁺ (NOT Ca²⁺!). Dissolves AgCl(s). Leaves flame-clean NH₄⁺.',
  },
  NH3_conc: {
    id: 'NH3_conc',
    formula: 'Excess NH₃(aq)',
    shortLabel: 'xs NH₃',
    name: 'Excess Ammonia Solution',
    bottleColor: '#6366f1',
    description:
      'Excess ammonia redissolves Cu(OH)₂ to form deep blue [Cu(NH₃)₄(H₂O)₂]²⁺. Fe(OH)₃ stays solid.',
  },
  AgNO3: {
    id: 'AgNO3',
    formula: 'AgNO₃ / HNO₃',
    shortLabel: 'AgNO₃',
    name: 'Acidified Silver Nitrate',
    bottleColor: '#cbd5e1',
    description:
      'Acidified with dilute HNO₃ (removes CO₃²⁻ cleanly). Precipitates Cl⁻ (white AgCl), Br⁻ (cream AgBr), I⁻ (yellow AgI).',
  },
  BaCl2: {
    id: 'BaCl2',
    formula: 'BaCl₂ / HCl',
    shortLabel: 'BaCl₂',
    name: 'Acidified Barium Chloride',
    bottleColor: '#2dd4bf',
    description:
      'Precipitates SO₄²⁻ as dense white BaSO₄(s) and effervesces CO₃²⁻. Warning: introduces Cl⁻ into filtrate!',
  },
  HCl: {
    id: 'HCl',
    formula: 'Dil. HCl(aq)',
    shortLabel: 'Dil HCl',
    name: 'Dilute Hydrochloric Acid',
    bottleColor: '#fb7185',
    description:
      'Reacts with CO₃²⁻ → CO₂(g)↑ effervescence (turns limewater cloudy). Warning: introduces Cl⁻ ions!',
  },
};

export interface ReactionEvent {
  summary: string;
  equation: string;
  severity: 'reaction' | 'warning' | 'error';
}
