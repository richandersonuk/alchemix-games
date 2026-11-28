import type { EnthalpyEntry } from '../types/energetics.ts';

/**
 * Curated UK A-Level (WJEC / AQA / OCR) standard thermochemical data at 298 K, 100 kPa.
 * Includes WJEC GCE Chemistry Teachers' Guide practicals & Unit 2/3 past papers (2017-2025).
 * Values are in kJ mol^-1.
 */
export const STANDARD_ENTHALPIES: EnthalpyEntry[] = [
  // Standard Enthalpies of Formation (ΔfHθ)
  { id: 'df_c2h4_g', kind: 'formation', species: 'C2H4(g)', symbol: 'ΔfHθ[C₂H₄(g)]', deltaH: 52.2, notes: 'From 2C(s) + 2H₂(g)' },
  { id: 'df_c2h6_g', kind: 'formation', species: 'C2H6(g)', symbol: 'ΔfHθ[C₂H₆(g)]', deltaH: -84.7, notes: 'From 2C(s) + 3H₂(g)' },
  { id: 'df_ch4_g', kind: 'formation', species: 'CH4(g)', symbol: 'ΔfHθ[CH₄(g)]', deltaH: -74.8, notes: 'From C(s) + 2H₂(g)' },
  { id: 'df_ch4_75', kind: 'formation', species: 'CH4(g)', symbol: 'ΔfHθ[CH₄(g)]', deltaH: -75.0, notes: 'WJEC data value for C(s) + 2H₂(g) → CH₄(g)' },
  { id: 'df_co_g', kind: 'formation', species: 'CO(g)', symbol: 'ΔfHθ[CO(g)]', deltaH: -110.5, notes: 'From C(s) + ½O₂(g)' },
  { id: 'df_co_111', kind: 'formation', species: 'CO(g)', symbol: 'ΔfHθ[CO(g)]', deltaH: -111.0, notes: 'WJEC 2025 U3 Q9(a) ΔfHθ[CO(g)]' },
  { id: 'df_co2_g', kind: 'formation', species: 'CO2(g)', symbol: 'ΔfHθ[CO₂(g)]', deltaH: -393.5, notes: 'From C(s) + O₂(g)' },
  { id: 'df_h2o_l', kind: 'formation', species: 'H2O(l)', symbol: 'ΔfHθ[H₂O(l)]', deltaH: -285.8, notes: 'Standard state of water at 298 K' },
  { id: 'df_h2o_286', kind: 'formation', species: 'H2O(l)', symbol: 'ΔfHθ[H₂O(l)]', deltaH: -286.0, notes: 'WJEC paper rounded ΔfHθ[H₂O(l)]' },
  { id: 'df_h2o2_l', kind: 'formation', species: 'H2O2(l)', symbol: 'ΔfHθ[H₂O₂(l)]', deltaH: -237.0, notes: 'WJEC 2018 U3 Q11 calculated ΔfHθ[H₂O₂(l)]' },
  { id: 'df_hno3_l', kind: 'formation', species: 'HNO3(l)', symbol: 'ΔfHθ[HNO₃(l)]', deltaH: -173.0, notes: 'WJEC 2017 U3 Q10' },
  { id: 'df_nocl_g', kind: 'formation', species: 'NOCl(g)', symbol: 'ΔfHθ[NOCl(g)]', deltaH: 53.0, notes: 'WJEC 2017 U3 Q10' },
  { id: 'df_hcl_g', kind: 'formation', species: 'HCl(g)', symbol: 'ΔfHθ[HCl(g)]', deltaH: -92.3, notes: 'WJEC 2017 U3 Q10 target ΔfHθ[HCl(g)]' },
  { id: 'df_so2_297', kind: 'formation', species: 'SO2(g)', symbol: 'ΔfHθ[SO₂(g)]', deltaH: -297.0, notes: 'WJEC 2024 U3 Q8(d) ΔfHθ[SO₂(g)]' },
  { id: 'df_so3_395', kind: 'formation', species: 'SO3(g)', symbol: 'ΔfHθ[SO₃(g)]', deltaH: -395.5, notes: 'WJEC 2024 U3 Q8(d) target ΔfHθ[SO₃(g)]' },
  { id: 'df_k2cro4_s', kind: 'formation', species: 'K2CrO4(s)', symbol: 'ΔfHθ[K₂CrO₄(s)]', deltaH: -1382.0, notes: 'WJEC 2023 U3 Q8(d)' },
  { id: 'df_cr2o3_s', kind: 'formation', species: 'Cr2O3(s)', symbol: 'ΔfHθ[Cr₂O₃(s)]', deltaH: -1128.0, notes: 'WJEC 2023 U3 Q8(d)' },
  { id: 'df_k2cr2o7_s', kind: 'formation', species: 'K2Cr2O7(s)', symbol: 'ΔfHθ[K₂Cr₂O₇(s)]', deltaH: -2033.0, notes: 'WJEC 2023 U3 Q8(d) target ΔfHθ[K₂Cr₂O₇(s)]' },
  { id: 'df_agbr_s', kind: 'formation', species: 'AgBr(s)', symbol: 'ΔfHθ[AgBr(s)]', deltaH: -100.35, notes: 'WJEC 2024 U3 Q9(a)(ii) target ΔfHθ[AgBr(s)]' },
  { id: 'df_ch3i_l', kind: 'formation', species: 'CH3I(l)', symbol: 'ΔfHθ[CH₃I(l)]', deltaH: -14.0, notes: 'WJEC 2025 U3 Q9(a)' },
  { id: 'df_ch3coi_l', kind: 'formation', species: 'CH3COI(l)', symbol: 'ΔfHθ[CH₃COI(l)]', deltaH: -162.0, notes: 'WJEC 2025 U3 Q9(a)' },
  { id: 'df_caco3_s', kind: 'formation', species: 'CaCO3(s)', symbol: 'ΔfHθ[CaCO₃(s)]', deltaH: -1207.6, notes: 'From Ca(s) + C(s) + 1.5O₂(g)' },
  { id: 'df_cao_s', kind: 'formation', species: 'CaO(s)', symbol: 'ΔfHθ[CaO(s)]', deltaH: -635.1, notes: 'From Ca(s) + ½O₂(g)' },
  { id: 'df_hbr_g', kind: 'formation', species: 'HBr(g)', symbol: 'ΔfHθ[HBr(g)]', deltaH: -36.4, notes: 'From ½H₂(g) + ½Br₂(l) (liquid Br₂!)' },
  { id: 'df_nacl_s', kind: 'formation', species: 'NaCl(s)', symbol: 'ΔfHθ[NaCl(s)]', deltaH: -411.0, notes: 'WJEC 2022 U3 Q8(b)' },
  { id: 'df_cacl2_s', kind: 'formation', species: 'CaCl2(s)', symbol: 'ΔfHθ[CaCl₂(s)]', deltaH: -795.0, notes: 'WJEC 2019 U3 Q9(a)' },

  // Standard Enthalpies of Combustion (ΔcHθ)
  { id: 'dc_c_s', kind: 'combustion', species: 'C(s)', symbol: 'ΔcHθ[C(s)]', deltaH: -393.5, notes: 'Complete combustion to CO₂(g)' },
  { id: 'dc_h2_g', kind: 'combustion', species: 'H2(g)', symbol: 'ΔcHθ[H₂(g)]', deltaH: -285.8, notes: 'Complete combustion to H₂O(l)' },
  { id: 'dc_ch3oh_l', kind: 'combustion', species: 'CH3OH(l)', symbol: 'ΔcHθ[CH₃OH(l)]', deltaH: -726.0, notes: 'WJEC Teachers Guide methanol calorimetry' },
  { id: 'dc_c2h5oh_l', kind: 'combustion', species: 'C2H5OH(l)', symbol: 'ΔcHθ[C₂H₅OH(l)]', deltaH: -1367.3, notes: 'WJEC Teachers Guide ethanol calorimetry' },
  { id: 'dc_c2h6_g', kind: 'combustion', species: 'C2H6(g)', symbol: 'ΔcHθ[C₂H₆(g)]', deltaH: -1559.7, notes: 'Produces 2CO₂(g) + 3H₂O(l)' },

  // Lattice, Hydration & Solution Enthalpies
  { id: 'dlatt_nacl_22', kind: 'lattice', species: 'NaCl(s)', symbol: 'Δlatt formHθ[NaCl(s)]', deltaH: -771.0, notes: 'WJEC 2022 U3 Q8(b) Born-Haber target' },
  { id: 'dlatt_cacl2', kind: 'lattice', species: 'CaCl2(s)', symbol: 'Δlatt formHθ[CaCl₂(s)]', deltaH: -2222.0, notes: 'WJEC 2019 U3 Q9(a) Born-Haber target' },
  { id: 'dlatt_cacl2_17', kind: 'lattice', species: 'CaCl2(s)', symbol: 'Δlatt formHθ[CaCl₂(s)]', deltaH: -2237.0, notes: 'WJEC 2017 U3 Q3 lattice formation' },
  { id: 'dhyd_cacl2_17', kind: 'hydration', species: 'Ca2+(g) + 2Cl-(g)', symbol: 'ΣΔhydHθ[Ca²⁺ + 2Cl⁻]', deltaH: -2378.0, notes: 'WJEC 2017 U3 Q3 total hydration' },
  { id: 'dsol_cacl2', kind: 'solution', species: 'CaCl2(s)', symbol: 'ΔsolHθ[CaCl₂(s)]', deltaH: -141.0, notes: 'WJEC 2017 U3 Q3 target ΔsolHθ' },
  { id: 'dlatt_agcl', kind: 'lattice', species: 'AgCl(s)', symbol: 'Δlatt formHθ[AgCl(s)]', deltaH: -905.0, notes: 'WJEC 2023 U3 Q2' },
  { id: 'dhyd_ag', kind: 'hydration', species: 'Ag+(g)', symbol: 'ΔhydHθ[Ag⁺(g)]', deltaH: -464.0, notes: 'WJEC 2023 U3 Q2' },
  { id: 'dhyd_cl_23', kind: 'hydration', species: 'Cl-(g)', symbol: 'ΔhydHθ[Cl⁻(g)]', deltaH: -364.0, notes: 'WJEC 2023 U3 Q2' },
  { id: 'dsol_agcl', kind: 'solution', species: 'AgCl(s)', symbol: 'ΔsolHθ[AgCl(s)]', deltaH: 77.0, notes: 'WJEC 2023 U3 Q2 insoluble chloride ΔsolHθ' },
  { id: 'dlatt_mgcl2', kind: 'lattice', species: 'MgCl2(s)', symbol: 'Δlatt formHθ[MgCl₂(s)]', deltaH: -2526.0, notes: 'Lattice formation: Mg²⁺(g) + 2Cl⁻(g) → MgCl₂(s)' },
  { id: 'dhyd_mg', kind: 'hydration', species: 'Mg2+(g)', symbol: 'ΔhydHθ[Mg²⁺(g)]', deltaH: -1921.0, notes: 'High charge density Mg²⁺(g) → Mg²⁺(aq)' },
  { id: 'dhyd_cl', kind: 'hydration', species: 'Cl-(g)', symbol: 'ΔhydHθ[Cl⁻(g)]', deltaH: -377.0, notes: 'Cl⁻(g) → Cl⁻(aq)' },
  { id: 'dlatt_break_baso4', kind: 'lattice', species: 'BaSO4(s)', symbol: 'Δlatt breakHθ[BaSO₄]', deltaH: 2474.0, notes: 'WJEC 2025 U3 Q7(a) endothermic lattice dissociation' },
  { id: 'dhyd_ba', kind: 'hydration', species: 'Ba2+(g)', symbol: 'ΔhydHθ[Ba²⁺(g)]', deltaH: -1360.0, notes: 'WJEC 2025 U3 Q7(a)' },
  { id: 'dhyd_so4', kind: 'hydration', species: 'SO42-(g)', symbol: 'ΔhydHθ[SO₄²⁻(g)]', deltaH: -1059.0, notes: 'WJEC 2025 U3 Q7(a)' },
  { id: 'dsol_baso4', kind: 'solution', species: 'BaSO4(s)', symbol: 'ΔsolHθ[BaSO₄(s)]', deltaH: 55.0, notes: 'WJEC 2025 U3 Q7(a) insoluble sulfate ΔsolHθ' },

  // Phase Changes, Atomisation, Ionisation, Electron Affinity & Mean Bond Enthalpies
  { id: 'dvap_h2o', kind: 'phase', species: 'H2O(l)', symbol: 'ΔvapHθ[H₂O(l)]', deltaH: 44.0, notes: 'H₂O(l) → H₂O(g) latent heat of vaporisation' },
  { id: 'dvap_br2', kind: 'phase', species: 'Br2(l)', symbol: 'ΔvapHθ[Br₂(l)]', deltaH: 30.9, notes: 'Br₂(l) → Br₂(g)' },
  { id: 'dat_c', kind: 'atomisation', species: 'C(s)', symbol: 'ΔatHθ[C(s)]', deltaH: 715.0, notes: 'C(s, graphite) → C(g)' },
  { id: 'dat_h', kind: 'atomisation', species: '½H2(g)', symbol: 'ΔatHθ[½H₂(g)]', deltaH: 218.0, notes: '½H₂(g) → H(g) (= ½ E(H–H))' },
  { id: 'dat_na', kind: 'atomisation', species: 'Na(s)', symbol: 'ΔatHθ[Na(s)]', deltaH: 109.0, notes: 'WJEC 2022 U3 Q8(b)' },
  { id: 'dat_ca', kind: 'atomisation', species: 'Ca(s)', symbol: 'ΔatHθ[Ca(s)]', deltaH: 178.0, notes: 'WJEC 2019 U3 Q9(a)' },
  { id: 'dat_cl', kind: 'atomisation', species: '½Cl2(g)', symbol: 'ΔatHθ[½Cl₂(g)]', deltaH: 121.0, notes: '½Cl₂(g) → Cl(g) (= ½ E(Cl–Cl) = 121)' },
  { id: 'die1_na', kind: 'ionisation', species: 'Na(g)', symbol: 'Δie1Hθ[Na(g)]', deltaH: 494.0, notes: 'WJEC 2022 U3 Q8(b)' },
  { id: 'die12_ca', kind: 'ionisation', species: 'Ca(g)', symbol: 'Δie(1+2)Hθ[Ca(g)]', deltaH: 1735.0, notes: 'WJEC 2019 U3 Q9(a) 1st + 2nd IE of Ca' },
  { id: 'dea1_cl', kind: 'electron_affinity', species: 'Cl(g)', symbol: 'Δea1Hθ[Cl(g)]', deltaH: -364.0, notes: 'WJEC 2019/2022 U3 Cl(g) + e⁻ → Cl⁻(g)' },
  { id: 'b_ch_19', kind: 'bond', species: 'C–H', symbol: 'E(C–H)', deltaH: 415.5, notes: 'WJEC 2019 AS U2 Q7(c) mean C–H bond enthalpy in CH₄' },
  { id: 'b_ci', kind: 'bond', species: 'C–I', symbol: 'E(C–I)', deltaH: 240.0, notes: 'WJEC 2025 U3 Q9(a)' },
  { id: 'b_co_triple', kind: 'bond', species: 'C≡O', symbol: 'E(C≡O)', deltaH: 1072.0, notes: 'WJEC 2025 U3 Q9(a)' },
  { id: 'b_cc', kind: 'bond', species: 'C–C', symbol: 'E(C–C)', deltaH: 346.0, notes: 'WJEC 2025 U3 Q9(a)' },
  { id: 'b_co_double', kind: 'bond', species: 'C=O', symbol: 'E(C=O)', deltaH: 745.0, notes: 'WJEC 2025 U3 Q9(a)' },
];

export const ENTHALPY_BY_ID: Record<string, EnthalpyEntry> = Object.fromEntries(
  STANDARD_ENTHALPIES.map((entry) => [entry.id, entry])
);
