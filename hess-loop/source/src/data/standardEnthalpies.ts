import type { EnthalpyEntry } from '../types/energetics.ts';

/**
 * Curated UK A-Level (WJEC / AQA / OCR) standard thermochemical data at 298 K, 100 kPa.
 * Values are in kJ mol^-1.
 */
export const STANDARD_ENTHALPIES: EnthalpyEntry[] = [
  // Standard Enthalpies of Formation (ΔfH°)
  { id: 'df_c2h4_g', kind: 'formation', species: 'C2H4(g)', symbol: 'ΔfH°[C₂H₄(g)]', deltaH: 52.2, notes: 'From 2C(s) + 2H₂(g)' },
  { id: 'df_c2h6_g', kind: 'formation', species: 'C2H6(g)', symbol: 'ΔfH°[C₂H₆(g)]', deltaH: -84.7, notes: 'From 2C(s) + 3H₂(g)' },
  { id: 'df_ch4_g', kind: 'formation', species: 'CH4(g)', symbol: 'ΔfH°[CH₄(g)]', deltaH: -74.8, notes: 'From C(s) + 2H₂(g)' },
  { id: 'df_co_g', kind: 'formation', species: 'CO(g)', symbol: 'ΔfH°[CO(g)]', deltaH: -110.5, notes: 'From C(s) + ½O₂(g)' },
  { id: 'df_co2_g', kind: 'formation', species: 'CO2(g)', symbol: 'ΔfH°[CO₂(g)]', deltaH: -393.5, notes: 'From C(s) + O₂(g)' },
  { id: 'df_h2o_l', kind: 'formation', species: 'H2O(l)', symbol: 'ΔfH°[H₂O(l)]', deltaH: -285.8, notes: 'Standard state of water at 298 K' },
  { id: 'df_so2_g', kind: 'formation', species: 'SO2(g)', symbol: 'ΔfH°[SO₂(g)]', deltaH: -296.8, notes: 'From S(s) + O₂(g)' },
  { id: 'df_so3_g', kind: 'formation', species: 'SO3(g)', symbol: 'ΔfH°[SO₃(g)]', deltaH: -395.7, notes: 'From S(s) + 1.5O₂(g)' },
  { id: 'df_caco3_s', kind: 'formation', species: 'CaCO3(s)', symbol: 'ΔfH°[CaCO₃(s)]', deltaH: -1207.6, notes: 'From Ca(s) + C(s) + 1.5O₂(g)' },
  { id: 'df_cao_s', kind: 'formation', species: 'CaO(s)', symbol: 'ΔfH°[CaO(s)]', deltaH: -635.1, notes: 'From Ca(s) + ½O₂(g)' },
  { id: 'df_hbr_g', kind: 'formation', species: 'HBr(g)', symbol: 'ΔfH°[HBr(g)]', deltaH: -36.4, notes: 'From ½H₂(g) + ½Br₂(l) (liquid Br₂!)' },
  { id: 'df_lif_s', kind: 'formation', species: 'LiF(s)', symbol: 'ΔfH°[LiF(s)]', deltaH: -617.0, notes: 'From Li(s) + ½F₂(g)' },

  // Standard Enthalpies of Combustion (ΔcH°)
  { id: 'dc_c_s', kind: 'combustion', species: 'C(s)', symbol: 'ΔcH°[C(s)]', deltaH: -393.5, notes: 'Complete combustion to CO₂(g)' },
  { id: 'dc_h2_g', kind: 'combustion', species: 'H2(g)', symbol: 'ΔcH°[H₂(g)]', deltaH: -285.8, notes: 'Complete combustion to H₂O(l)' },
  { id: 'dc_co_g', kind: 'combustion', species: 'CO(g)', symbol: 'ΔcH°[CO(g)]', deltaH: -283.0, notes: 'Complete combustion to CO₂(g)' },
  { id: 'dc_ch4_g', kind: 'combustion', species: 'CH4(g)', symbol: 'ΔcH°[CH₄(g)]', deltaH: -890.3, notes: 'Produces CO₂(g) + 2H₂O(l)' },
  { id: 'dc_c2h6_g', kind: 'combustion', species: 'C2H6(g)', symbol: 'ΔcH°[C₂H₆(g)]', deltaH: -1559.7, notes: 'Produces 2CO₂(g) + 3H₂O(l)' },

  // Lattice, Hydration & Solution Enthalpies
  { id: 'dlatt_nacl', kind: 'lattice', species: 'NaCl(s)', symbol: 'ΔlattH°[NaCl(s)]', deltaH: -787.0, notes: 'Lattice formation: Na⁺(g) + Cl⁻(g) → NaCl(s)' },
  { id: 'dhyd_na', kind: 'hydration', species: 'Na+(g)', symbol: 'ΔhydH°[Na⁺(g)]', deltaH: -406.0, notes: 'Na⁺(g) → Na⁺(aq)' },
  { id: 'dhyd_cl', kind: 'hydration', species: 'Cl-(g)', symbol: 'ΔhydH°[Cl⁻(g)]', deltaH: -377.0, notes: 'Cl⁻(g) → Cl⁻(aq)' },
  { id: 'dlatt_mgcl2', kind: 'lattice', species: 'MgCl2(s)', symbol: 'ΔlattH°[MgCl₂(s)]', deltaH: -2526.0, notes: 'Lattice formation: Mg²⁺(g) + 2Cl⁻(g) → MgCl₂(s)' },
  { id: 'dhyd_mg', kind: 'hydration', species: 'Mg2+(g)', symbol: 'ΔhydH°[Mg²⁺(g)]', deltaH: -1921.0, notes: 'High charge density Mg²⁺(g) → Mg²⁺(aq)' },
  { id: 'dlatt_kbr', kind: 'lattice', species: 'KBr(s)', symbol: 'ΔlattH°[KBr(s)]', deltaH: -679.0, notes: 'Lattice formation: K⁺(g) + Br⁻(g) → KBr(s)' },
  { id: 'dhyd_k', kind: 'hydration', species: 'K+(g)', symbol: 'ΔhydH°[K⁺(g)]', deltaH: -322.0, notes: 'K⁺(g) → K⁺(aq)' },
  { id: 'dsol_kbr', kind: 'solution', species: 'KBr(s)', symbol: 'ΔsolH°[KBr(s)]', deltaH: 20.0, notes: 'KBr(s) → K⁺(aq) + Br⁻(aq)' },
  { id: 'dlatt_lif', kind: 'lattice', species: 'LiF(s)', symbol: 'ΔlattH°[LiF(s)]', deltaH: -1047.0, notes: 'Target Born-Haber lattice formation' },

  // Phase Changes, Atomisation, Ionisation, Electron Affinity & Mean Bond Enthalpies
  { id: 'dvap_h2o', kind: 'phase', species: 'H2O(l)', symbol: 'ΔvapH°[H₂O(l)]', deltaH: 44.0, notes: 'H₂O(l) → H₂O(g) latent heat of vaporisation' },
  { id: 'dvap_br2', kind: 'phase', species: 'Br2(l)', symbol: 'ΔvapH°[Br₂(l)]', deltaH: 30.9, notes: 'Br₂(l) → Br₂(g)' },
  { id: 'dat_li', kind: 'atomisation', species: 'Li(s)', symbol: 'ΔatH°[Li(s)]', deltaH: 159.0, notes: 'Li(s) → Li(g)' },
  { id: 'dat_f', kind: 'atomisation', species: '½F2(g)', symbol: 'ΔatH°[½F₂(g)]', deltaH: 79.0, notes: '½F₂(g) → F(g)' },
  { id: 'die1_li', kind: 'ionisation', species: 'Li(g)', symbol: 'Δie1H°[Li(g)]', deltaH: 520.0, notes: 'Li(g) → Li⁺(g) + e⁻' },
  { id: 'dea1_f', kind: 'electron_affinity', species: 'F(g)', symbol: 'Δea1H°[F(g)]', deltaH: -328.0, notes: 'F(g) + e⁻ → F⁻(g)' },

  // Reference Mean Bond Enthalpies (for data booklet comparison)
  { id: 'b_ch', kind: 'bond', species: 'C–H', symbol: 'E(C–H)', deltaH: 413.0, notes: 'Mean bond enthalpy (gaseous covalent)' },
  { id: 'b_cc_double', kind: 'bond', species: 'C=C', symbol: 'E(C=C)', deltaH: 614.0, notes: 'Mean bond enthalpy (gaseous covalent)' },
  { id: 'b_hh', kind: 'bond', species: 'H–H', symbol: 'E(H–H)', deltaH: 436.0, notes: 'Exact bond dissociation enthalpy' },
  { id: 'b_oo', kind: 'bond', species: 'O=O', symbol: 'E(O=O)', deltaH: 498.0, notes: 'Exact bond dissociation enthalpy' },
];

export const ENTHALPY_BY_ID: Record<string, EnthalpyEntry> = Object.fromEntries(
  STANDARD_ENTHALPIES.map((entry) => [entry.id, entry])
);
