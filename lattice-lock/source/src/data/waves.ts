import type { DamageType, SectorId, ThreatId, ThreatSpec, WaveDefinition, WaveQuiz } from '../types/chemistry';

export const DAMAGE_META: Record<
  DamageType,
  { label: string; color: string; counterHint: string; physics: string }
> = {
  thermal: {
    label: 'Thermal',
    color: '#fb923c',
    physics: 'High kinetic/vibrational energy — overcomes forces between particles.',
    counterHint: 'High melting point giant structures (MgO, diamond, graphite). Keep simple molecular barriers away.',
  },
  electrical: {
    label: 'Electrical',
    color: '#7dd3fc',
    physics: 'High-voltage current seeking a path through the lattice.',
    counterHint: 'Ground it with delocalised electrons (Cu, graphite) or block it with a solid insulator (dry NaCl, diamond).',
  },
  shear: {
    label: 'Shear',
    color: '#fbbf24',
    physics: 'Directional mechanical force that pushes layers sideways.',
    counterHint: 'Malleable metals deform without shattering; steel pins its layers; diamond is too rigid to slip. Never ionic.',
  },
  solvent: {
    label: 'Solvent',
    color: '#38bdf8',
    physics: 'Polar water molecules (δ+ H, δ− O) that attract ions out of a lattice.',
    counterHint: 'Insoluble covalent networks and non-polar molecules. Ionic lattices dissolve and then conduct.',
  },
};

export const THREATS: Record<ThreatId, ThreatSpec> = {
  'thermal-wave': {
    id: 'thermal-wave',
    type: 'thermal',
    name: 'Thermal Conduction Wave',
    short: 'Heat Wave',
    intensity: 750,
    unit: 'K',
    hp: 60,
    speed: 1.1,
    aggression: 14,
    coreDamage: 8,
    reward: 6,
    color: '#fb923c',
    description: 'A 750 K pulse of vibrational energy. Melts anything held only by weak intermolecular forces.',
  },
  'plasma-front': {
    id: 'plasma-front',
    type: 'thermal',
    name: 'Plasma Front',
    short: 'Plasma',
    intensity: 2900,
    unit: 'K',
    hp: 190,
    speed: 0.72,
    aggression: 30,
    coreDamage: 16,
    reward: 15,
    plasma: true,
    color: '#c4b5fd',
    description: 'Sustained 2900 K ionised gas. Melts most metals; graphitises diamond and ablates monolayer graphene.',
  },
  'cryo-shock': {
    id: 'cryo-shock',
    type: 'thermal',
    name: 'Cryogenic Thermal Shock',
    short: '77 K Quench',
    intensity: 77,
    unit: 'K',
    hp: 75,
    speed: 1.2,
    aggression: 18,
    coreDamage: 8,
    reward: 7,
    cryo: true,
    color: '#38bdf8',
    description: 'Liquid-nitrogen thermal contraction pulse (77 K). Locks ice tighter; shatters brittle, low-conductivity ionic and molecular crystals.',
  },
  'arc-discharge': {
    id: 'arc-discharge',
    type: 'electrical',
    name: 'Electrical Arc Discharge',
    short: '10 kV Arc',
    intensity: 10,
    unit: 'kV',
    hp: 55,
    speed: 1.55,
    aggression: 16,
    coreDamage: 8,
    reward: 6,
    color: '#7dd3fc',
    description: 'A 10 kV arc. Grounded by delocalised electrons; blocked by solid ionic or covalent insulators.',
  },
  'static-spark': {
    id: 'static-spark',
    type: 'electrical',
    name: 'Static Spark',
    short: 'Spark',
    intensity: 0.8,
    unit: 'kV',
    hp: 30,
    speed: 2.0,
    aggression: 8,
    coreDamage: 4,
    reward: 3,
    color: '#e0f2fe',
    description: 'Fast, low-voltage static. Any insulator can stop it — even ice.',
  },
  'shear-parallel': {
    id: 'shear-parallel',
    type: 'shear',
    name: 'Shear Stress Wave',
    short: 'Shear',
    intensity: 120,
    unit: 'MPa',
    hp: 90,
    speed: 0.95,
    aggression: 22,
    coreDamage: 10,
    reward: 8,
    shearMode: 'parallel',
    color: '#fbbf24',
    description: 'A 120 MPa shockwave pushing parallel to lattice planes. Forces layers to slip.',
  },
  'shear-glancing': {
    id: 'shear-glancing',
    type: 'shear',
    name: 'Glancing Cleavage Impact',
    short: 'Glancing',
    intensity: 80,
    unit: 'MPa',
    hp: 70,
    speed: 1.25,
    aggression: 18,
    coreDamage: 8,
    reward: 7,
    shearMode: 'glancing',
    color: '#fb7185',
    description: 'Oblique 80 MPa impacts. A slippery layered surface can deflect them.',
  },
  'solvent-jet': {
    id: 'solvent-jet',
    type: 'solvent',
    name: 'Polar Solvent Jet',
    short: 'H₂O Jet',
    intensity: 1.85,
    unit: 'D',
    hp: 70,
    speed: 1.05,
    aggression: 16,
    coreDamage: 8,
    reward: 7,
    solventKind: 'polar',
    color: '#38bdf8',
    description: 'High-pressure water (dipole 1.85 D). Hydrates and dissolves ionic lattices.',
  },
  'nonpolar-jet': {
    id: 'nonpolar-jet',
    type: 'solvent',
    name: 'Non-Polar Hexane Jet',
    short: 'Hexane Jet',
    intensity: 0.0,
    unit: 'D',
    hp: 75,
    speed: 1.1,
    aggression: 18,
    coreDamage: 8,
    reward: 7,
    solventKind: 'nonpolar',
    color: '#a3e635',
    description: 'Non-polar hydrocarbon stream (C₆H₁₄, 0 D). "Like dissolves like": dissolves iodine and C₆₀, swells poly(ethene), repelled by ionic and cross-linked solids.',
  },
  'acid-jet': {
    id: 'acid-jet',
    type: 'solvent',
    name: 'Acidic Proton Jet',
    short: 'HCl(aq) Jet',
    intensity: 1.0,
    unit: 'M H⁺',
    hp: 85,
    speed: 1.05,
    aggression: 20,
    coreDamage: 10,
    reward: 8,
    solventKind: 'acid',
    color: '#4ade80',
    description: '1.0 M aqueous H⁺ stream. Neutralises basic oxides like MgO and corrodes reactive metals above hydrogen, while unreactive Cu/Brass and covalent networks hold.',
  },
};

export const THREAT_ORDER: ThreatId[] = [
  'thermal-wave',
  'plasma-front',
  'cryo-shock',
  'arc-discharge',
  'static-spark',
  'shear-parallel',
  'shear-glancing',
  'solvent-jet',
  'nonpolar-jet',
  'acid-jet',
];

export const WAVES: WaveDefinition[] = [
  {
    name: 'First Light',
    briefing: 'Thermal conduction waves probe the outer lanes.',
    hint: 'Heat must overcome the forces between particles. Giant structures need a lot of energy; ice and iodine need almost none.',
    groups: [{ threat: 'thermal-wave', count: 8, interval: 1.5, delay: 0 }],
    bonus: 50,
  },
  {
    name: 'Arc Storm',
    briefing: 'Static sparks, then 10 kV arcs.',
    hint: 'Two valid answers: delocalised electrons carry the charge to ground, or a solid with no mobile charge carriers blocks it. Simple molecular solids only stop low voltages.',
    groups: [
      { threat: 'static-spark', count: 6, interval: 0.9, delay: 0 },
      { threat: 'arc-discharge', count: 8, interval: 1.3, delay: 6 },
    ],
    bonus: 60,
  },
  {
    name: 'Shear Front',
    briefing: 'Mechanical shockwaves with thermal cover.',
    hint: 'What happens when a layer of an ionic lattice shifts by one ion? Metals have non-directional bonding…',
    groups: [
      { threat: 'thermal-wave', count: 4, interval: 1.5, delay: 0 },
      { threat: 'shear-parallel', count: 7, interval: 1.7, delay: 3 },
    ],
    bonus: 70,
  },
  {
    name: 'Brine Tide',
    briefing: 'Polar solvent jets followed by arcs.',
    hint: 'Water pulls ions out of an ionic lattice. Once the ions are free to move, does that barrier still insulate?',
    groups: [
      { threat: 'solvent-jet', count: 9, interval: 1.3, delay: 0 },
      { threat: 'arc-discharge', count: 6, interval: 1.4, delay: 7 },
    ],
    bonus: 80,
  },
  {
    name: 'Glancing Blows',
    briefing: 'Oblique impacts, then parallel shear.',
    hint: 'Graphite layers slide — great against a glancing blow, terrible against a force parallel to the layers.',
    groups: [
      { threat: 'shear-glancing', count: 9, interval: 1.1, delay: 0 },
      { threat: 'shear-parallel', count: 5, interval: 1.8, delay: 6 },
    ],
    bonus: 90,
  },
  {
    name: 'Mixed Assault',
    briefing: 'All four disruptor classes at once.',
    hint: 'No single lattice counters everything. Layer your defence so each lane covers every damage type.',
    groups: [
      { threat: 'thermal-wave', count: 6, interval: 1.6, delay: 0 },
      { threat: 'arc-discharge', count: 6, interval: 1.6, delay: 2 },
      { threat: 'solvent-jet', count: 6, interval: 1.6, delay: 5 },
      { threat: 'shear-parallel', count: 6, interval: 1.6, delay: 8 },
    ],
    bonus: 100,
  },
  {
    name: 'Plasma Dawn',
    briefing: 'Heat waves escort 2900 K plasma fronts.',
    hint: 'Plasma melts copper and iron. MgO and graphite survive. Diamond will hold — until sustained heat rearranges sp³ carbon into sp².',
    groups: [
      { threat: 'thermal-wave', count: 8, interval: 1.0, delay: 0 },
      { threat: 'plasma-front', count: 4, interval: 3.2, delay: 4 },
    ],
    bonus: 120,
  },
  {
    name: 'Electrolysis',
    briefing: 'Solvent jets and arcs arrive together.',
    hint: 'A wet ionic barrier conducts. Put insoluble conductors or non-polar insulators where water and current mix.',
    groups: [
      { threat: 'solvent-jet', count: 12, interval: 0.95, delay: 0 },
      { threat: 'arc-discharge', count: 12, interval: 0.95, delay: 2 },
      { threat: 'static-spark', count: 10, interval: 0.6, delay: 10 },
    ],
    bonus: 130,
  },
  {
    name: 'Fracture Cascade',
    briefing: 'Heavy mechanical stress with plasma support.',
    hint: 'Alloys resist slip because different-sized atoms distort the layers. Upgrade iron to steel.',
    groups: [
      { threat: 'shear-parallel', count: 12, interval: 1.0, delay: 0 },
      { threat: 'shear-glancing', count: 10, interval: 0.9, delay: 4 },
      { threat: 'plasma-front', count: 3, interval: 4, delay: 8 },
    ],
    bonus: 150,
  },
  {
    name: 'Cataclysm',
    briefing: 'Everything. Hold the lattice.',
    hint: 'Revise: structure → bonding → property. Every barrier should be in a lane where its property is the answer.',
    groups: [
      { threat: 'thermal-wave', count: 10, interval: 1.1, delay: 0 },
      { threat: 'arc-discharge', count: 12, interval: 1.0, delay: 3 },
      { threat: 'solvent-jet', count: 12, interval: 1.0, delay: 6 },
      { threat: 'shear-parallel', count: 12, interval: 1.0, delay: 9 },
      { threat: 'shear-glancing', count: 10, interval: 1.0, delay: 12 },
      { threat: 'static-spark', count: 12, interval: 0.5, delay: 14 },
      { threat: 'plasma-front', count: 6, interval: 3.0, delay: 16 },
    ],
    bonus: 0,
  },
];

/** HP scaling per wave (0-based index). */
export const waveHpMultiplier = (waveIndex: number) =>
  waveIndex < WAVES.length ? 1 + 0.14 * waveIndex : 1 + 0.14 * (WAVES.length - 1) + 0.22 * (waveIndex - WAVES.length + 1);

export interface SectorMeta {
  id: SectorId;
  name: string;
  subtitle: string;
  badge: string;
  description: string;
  waves: WaveDefinition[];
}

const REACTOR_WAVES: WaveDefinition[] = [
  {
    name: 'Thermal Gradient',
    briefing: '750 K heat pulses and 77 K cryogenic quenches enter the dual streams.',
    hint: 'Cryogenic shock fractures brittle low-conductivity crystals (NaCl, I₂), whereas metals and giant covalent networks conduct the gradient away — and Ice locks tighter at 77 K.',
    groups: [
      { threat: 'thermal-wave', count: 4, interval: 1.5, delay: 0 },
      { threat: 'cryo-shock', count: 4, interval: 1.5, delay: 4 },
    ],
    bonus: 55,
  },
  {
    name: 'Dielectric Surge',
    briefing: 'Static sparks followed by 10 kV arcs across both reactor lanes.',
    hint: 'Cover both upper and lower streams with either solid insulators (SiO₂, NaCl, poly(ethene)) or delocalised conductors (Copper, Graphite).',
    groups: [
      { threat: 'static-spark', count: 6, interval: 0.9, delay: 0 },
      { threat: 'arc-discharge', count: 8, interval: 1.25, delay: 5 },
    ],
    bonus: 65,
  },
  {
    name: 'Like Dissolves Like',
    briefing: 'Non-polar hexane jets paired with parallel mechanical shear.',
    hint: 'Hexane dissolves non-polar I₂ and C₆₀ and swells un-crosslinked poly(ethene). Vulcanise poly(ethene) into a cross-linked thermoset, or use Brass/Steel against shear.',
    groups: [
      { threat: 'nonpolar-jet', count: 6, interval: 1.4, delay: 0 },
      { threat: 'shear-parallel', count: 5, interval: 1.6, delay: 4 },
    ],
    bonus: 75,
  },
  {
    name: 'Proton Etch',
    briefing: '1.0 M HCl(aq) acid jets followed by high-voltage arcs.',
    hint: 'MgO is a basic oxide (neutralised by acid) and Iron sits above hydrogen in the reactivity series. Copper and Brass are below hydrogen — or use insoluble SiO₂.',
    groups: [
      { threat: 'acid-jet', count: 8, interval: 1.3, delay: 0 },
      { threat: 'arc-discharge', count: 7, interval: 1.3, delay: 6 },
    ],
    bonus: 85,
  },
  {
    name: 'Ballistic Quench',
    briefing: 'Glancing cleavage impacts alongside 77 K cryogenic shock.',
    hint: 'Graphene monolayers puncture under glancing blows! C₆₀ cages deflect glancing hits like ball bearings, and Carbon Nanotubes (C₆₀ upgrade) resist shear in every direction.',
    groups: [
      { threat: 'shear-glancing', count: 8, interval: 1.1, delay: 0 },
      { threat: 'cryo-shock', count: 6, interval: 1.5, delay: 5 },
    ],
    bonus: 95,
  },
  {
    name: 'Solvent Triad',
    briefing: 'Heat, hexane, acid, and arcs converge on the junction.',
    hint: 'Notice how Poly(ethene) fails in hexane and heat, while cross-linked Vulcanised Polymer holds against both — and Copper/Brass resist acid and ground arcs.',
    groups: [
      { threat: 'thermal-wave', count: 6, interval: 1.4, delay: 0 },
      { threat: 'nonpolar-jet', count: 6, interval: 1.4, delay: 2 },
      { threat: 'acid-jet', count: 6, interval: 1.4, delay: 5 },
      { threat: 'arc-discharge', count: 6, interval: 1.4, delay: 8 },
    ],
    bonus: 110,
  },
  {
    name: 'Thermal Extremes',
    briefing: '77 K cryogenic quench followed by 2900 K plasma fronts.',
    hint: 'Diamond conducts both extremes well (until plasma graphitises it), while monolayer graphene ablates rapidly under sustained 2900 K plasma. MgO handles plasma heat cleanly.',
    groups: [
      { threat: 'cryo-shock', count: 7, interval: 1.1, delay: 0 },
      { threat: 'plasma-front', count: 5, interval: 3.0, delay: 4 },
    ],
    bonus: 125,
  },
  {
    name: 'Corrosive Electrolyte',
    briefing: 'Water, acid, and arcs flood both lanes simultaneously.',
    hint: 'Never place NaCl or MgO where water/acid meets current — hydrated mobile ions conduct! Copper → Brass, SiO₂, and Thermoset stay rock-solid here.',
    groups: [
      { threat: 'solvent-jet', count: 10, interval: 0.95, delay: 0 },
      { threat: 'acid-jet', count: 10, interval: 0.95, delay: 2 },
      { threat: 'arc-discharge', count: 14, interval: 0.85, delay: 5 },
    ],
    bonus: 140,
  },
  {
    name: 'Allotrope Crucible',
    briefing: 'Heavy parallel & glancing shear backed by plasma fronts.',
    hint: 'Combine Brass/Steel (pinned alloy layers), Carbon Nanotubes (3D sp² tubes), and SiO₂/Diamond near the junction.',
    groups: [
      { threat: 'shear-parallel', count: 10, interval: 1.0, delay: 0 },
      { threat: 'shear-glancing', count: 10, interval: 0.95, delay: 3 },
      { threat: 'plasma-front', count: 5, interval: 3.2, delay: 8 },
    ],
    bonus: 160,
  },
  {
    name: 'Reactor Overload',
    briefing: 'All ten physical and chemical disruptors across both reactor lanes.',
    hint: 'Layer your junction: Brass + CNT + SiO₂ + Thermoset + MgO cover every thermal, electrical, shear, and solvent niche.',
    groups: [
      { threat: 'thermal-wave', count: 10, interval: 1.1, delay: 0 },
      { threat: 'cryo-shock', count: 8, interval: 1.1, delay: 2 },
      { threat: 'arc-discharge', count: 12, interval: 1.0, delay: 4 },
      { threat: 'solvent-jet', count: 8, interval: 1.1, delay: 6 },
      { threat: 'nonpolar-jet', count: 8, interval: 1.1, delay: 8 },
      { threat: 'acid-jet', count: 8, interval: 1.1, delay: 10 },
      { threat: 'shear-parallel', count: 8, interval: 1.0, delay: 12 },
      { threat: 'shear-glancing', count: 6, interval: 1.0, delay: 14 },
      { threat: 'plasma-front', count: 6, interval: 2.8, delay: 16 },
    ],
    bonus: 0,
  },
];

const CRUCIBLE_WAVES: WaveDefinition[] = [
  {
    name: 'Cold Solvent Probe',
    briefing: 'Cryogenic shock and hexane jets test the twin crossroads.',
    hint: 'Notice the contrast: Ice absorbs 77 K cryo shock and repels hexane, while NaCl repels hexane but fractures under 77 K thermal shock.',
    groups: [
      { threat: 'cryo-shock', count: 4, interval: 1.4, delay: 0 },
      { threat: 'nonpolar-jet', count: 4, interval: 1.4, delay: 3 },
    ],
    bonus: 60,
  },
  {
    name: 'Acidic Discharge',
    briefing: '10 kV arcs and 1.0 M acid jets interleave down the crossing lanes.',
    hint: 'Copper grounds the arcs and ignores HCl(aq) because Cu is below hydrogen in reactivity. SiO₂ blocks arcs and resists acid too.',
    groups: [
      { threat: 'arc-discharge', count: 8, interval: 1.15, delay: 0 },
      { threat: 'acid-jet', count: 6, interval: 1.25, delay: 3 },
    ],
    bonus: 70,
  },
  {
    name: 'Slip & Swell',
    briefing: 'Glancing impacts with non-polar hexane jets.',
    hint: 'C₆₀ deflects glancing hits, but hexane dissolves it! Graphite deflects glancing hits and is insoluble, or upgrade Poly(ethene) → Thermoset.',
    groups: [
      { threat: 'shear-glancing', count: 6, interval: 1.2, delay: 0 },
      { threat: 'nonpolar-jet', count: 5, interval: 1.4, delay: 3 },
    ],
    bonus: 80,
  },
  {
    name: 'Etch & Fracture',
    briefing: 'Acid jets weaken iron and MgO while parallel shear hits.',
    hint: 'Steel still corrodes slowly in acid; upgrade Copper → Brass for a shear-pinned alloy that ignores dilute acid.',
    groups: [
      { threat: 'acid-jet', count: 8, interval: 1.1, delay: 0 },
      { threat: 'shear-parallel', count: 7, interval: 1.3, delay: 4 },
    ],
    bonus: 90,
  },
  {
    name: 'Quench & Blaze',
    briefing: 'Rapid swings between 77 K cryo shock and 750 K heat waves.',
    hint: 'High thermal conductivity networks (SiO₂, Diamond, Graphite, CNT) and cross-linked Thermoset survive both thermal extremes.',
    groups: [
      { threat: 'cryo-shock', count: 7, interval: 1.1, delay: 0 },
      { threat: 'thermal-wave', count: 7, interval: 1.1, delay: 3 },
    ],
    bonus: 100,
  },
  {
    name: 'Crossroads Siege',
    briefing: 'Hexane, acid, arcs, and parallel shear hit the central crossover.',
    hint: 'Build high-value covalent networks (SiO₂, CNT, Thermoset) and Brass near the central lane crossover where both paths meet.',
    groups: [
      { threat: 'nonpolar-jet', count: 6, interval: 1.2, delay: 0 },
      { threat: 'acid-jet', count: 6, interval: 1.2, delay: 2 },
      { threat: 'arc-discharge', count: 6, interval: 1.2, delay: 4 },
      { threat: 'shear-parallel', count: 6, interval: 1.2, delay: 6 },
    ],
    bonus: 115,
  },
  {
    name: 'Superheated Quench',
    briefing: '2900 K plasma fronts escorted by 77 K cryo shocks.',
    hint: 'Watch Diamond plasma exposure carefully; support with CNT, Graphite, and SiO₂.',
    groups: [
      { threat: 'plasma-front', count: 6, interval: 2.5, delay: 0 },
      { threat: 'cryo-shock', count: 6, interval: 1.3, delay: 3 },
    ],
    bonus: 135,
  },
  {
    name: 'Universal Solvent',
    briefing: 'Polar water, non-polar hexane, acid, and 10 kV arcs together.',
    hint: 'Only giant covalent lattices (SiO₂, CNT, Thermoset) and unreactive metals (Copper, Brass) shrug off all three solvents.',
    groups: [
      { threat: 'solvent-jet', count: 8, interval: 1.0, delay: 0 },
      { threat: 'nonpolar-jet', count: 8, interval: 1.0, delay: 2 },
      { threat: 'acid-jet', count: 8, interval: 1.0, delay: 4 },
      { threat: 'arc-discharge', count: 10, interval: 0.9, delay: 6 },
    ],
    bonus: 150,
  },
  {
    name: 'Tectonic Plasma',
    briefing: 'Relentless parallel & glancing shear with sustained plasma.',
    hint: 'Carbon Nanotubes handle both shear modes and conduct heat; pair with Brass/Steel and Diamond.',
    groups: [
      { threat: 'shear-parallel', count: 9, interval: 0.95, delay: 0 },
      { threat: 'shear-glancing', count: 9, interval: 0.95, delay: 3 },
      { threat: 'plasma-front', count: 7, interval: 2.5, delay: 6 },
    ],
    bonus: 175,
  },
  {
    name: 'Synoptic Singularity',
    briefing: 'Full-spectrum assault across the Crucible Matrix.',
    hint: 'Every chemical principle matters: reactivity series, polarity, cross-linking, alloying, and allotrope geometry.',
    groups: [
      { threat: 'cryo-shock', count: 8, interval: 1.0, delay: 0 },
      { threat: 'thermal-wave', count: 8, interval: 1.0, delay: 2 },
      { threat: 'arc-discharge', count: 12, interval: 0.9, delay: 4 },
      { threat: 'solvent-jet', count: 8, interval: 1.0, delay: 6 },
      { threat: 'nonpolar-jet', count: 8, interval: 1.0, delay: 8 },
      { threat: 'acid-jet', count: 8, interval: 1.0, delay: 10 },
      { threat: 'shear-parallel', count: 8, interval: 0.95, delay: 12 },
      { threat: 'shear-glancing', count: 7, interval: 0.95, delay: 14 },
      { threat: 'plasma-front', count: 7, interval: 2.4, delay: 16 },
    ],
    bonus: 0,
  },
];

export const SECTORS: Record<SectorId, SectorMeta> = {
  foundation: {
    id: 'foundation',
    name: 'Foundation Lattice',
    subtitle: 'Introductory Campaign · 1 Lane',
    badge: 'Campaign 1',
    description: 'The classic 10-wave single-lane campaign covering giant ionic, giant covalent, metallic, and simple molecular structures.',
    waves: WAVES,
  },
  reactor: {
    id: 'reactor',
    name: 'Dual-Stream Reactor',
    subtitle: 'Intermediate · 2 Converging Lanes',
    badge: 'Campaign 2',
    description: 'Bifurcated upper and lower streams introducing Cryogenic Shock, Hexane jets, and Acidic H⁺ streams.',
    waves: REACTOR_WAVES,
  },
  crucible: {
    id: 'crucible',
    name: 'Crucible Matrix',
    subtitle: 'Advanced · Twin Crossroads',
    badge: 'Campaign 3',
    description: 'Interlocking figure-of-eight lanes testing alloys, cross-linked thermosets, SiO₂, fullerenes, and nanotubes.',
    waves: CRUCIBLE_WAVES,
  },
};

export function generateOvertimeWave(waveIndex: number): WaveDefinition {
  const tier = waveIndex - WAVES.length + 1;
  const scale = 1 + Math.floor(tier * 0.6);
  const interval = Math.max(0.45, 0.95 - tier * 0.04);
  const pool: ThreatId[] = [
    'thermal-wave',
    'cryo-shock',
    'arc-discharge',
    'shear-parallel',
    'shear-glancing',
    'solvent-jet',
    'nonpolar-jet',
    'acid-jet',
    'plasma-front',
  ];
  const groups = pool.map((threat, idx) => ({
    threat,
    count: (threat === 'plasma-front' ? 3 : 5) + scale,
    interval: threat === 'plasma-front' ? Math.max(1.4, 2.5 - tier * 0.1) : interval,
    delay: idx * 1.6,
  }));
  return {
    name: `Overtime Tier ${tier}`,
    briefing: `Endless wave ${waveIndex + 1}: disruptor integrity ×${waveHpMultiplier(waveIndex).toFixed(2)}.`,
    hint: 'Overtime scales HP and spawn cadence endlessly. Upgrade to Brass, Steel, CNT, and Thermoset and watch Diamond plasma exposure.',
    groups,
    bonus: 140 + tier * 20,
  };
}

export const WAVE_QUIZZES: WaveQuiz[] = [
  {
    question: 'Why does magnesium oxide (MgO) have a much higher melting point than sodium chloride (NaCl)?',
    options: [
      'Mg²⁺ and O²⁻ ions have greater charges and smaller radii, giving stronger electrostatic attraction.',
      'MgO contains covalent bonds between magnesium and oxygen atoms.',
      'MgO has delocalised electrons that strengthen its lattice.',
    ],
    correctIndex: 0,
    explanation: 'Doubly charged Mg²⁺/O²⁻ ions attract each other much more strongly than Na⁺/Cl⁻, requiring far more energy to overcome.',
  },
  {
    question: 'Why does solid sodium chloride NOT conduct electricity, even though it is made of charged ions?',
    options: [
      'The electrons are used up in ionic bonds.',
      'The ions are held in fixed positions in the lattice and cannot move.',
      'Sodium chloride consists of neutral molecules when solid.',
    ],
    correctIndex: 1,
    explanation: 'In a solid ionic lattice, ions can only vibrate in fixed positions; mobile charge carriers only form when molten or dissolved.',
  },
  {
    question: 'Why are ionic crystals brittle when struck with a parallel shear force?',
    options: [
      'The covalent bonds inside the ions snap.',
      'Delocalised electrons escape from the lattice.',
      'Shifting a layer lines up like-charged ions, which repel and split the crystal.',
    ],
    correctIndex: 2,
    explanation: 'Displacing one plane by a single ion places + next to + and − next to −; electrostatic repulsion cleaves the lattice.',
  },
  {
    question: 'Why does a wet ionic barrier fail against an electrical arc after being hit by a water jet?',
    options: [
      'Polar water molecules hydrate and free the ions so they can move and carry charge.',
      'Water turns ionic bonds into metallic bonds.',
      'Water reacts with the ions to form pure metal.',
    ],
    correctIndex: 0,
    explanation: 'Aqueous ionic solutions contain mobile hydrated cations and anions free to move and conduct current.',
  },
  {
    question: 'Why can graphite conduct electricity along its layers while diamond cannot?',
    options: [
      'Diamond has weak intermolecular forces that block electrons.',
      'Each carbon in graphite forms 3 covalent bonds, leaving 1 delocalised electron per atom free to move.',
      'Graphite contains mobile metal ions between the carbon sheets.',
    ],
    correctIndex: 1,
    explanation: 'Diamond uses all 4 outer electrons in sp³ covalent bonds; graphite uses 3 in sp² bonds and delocalises the 4th across the rings.',
  },
  {
    question: 'Why do iodine (I₂) and ice (H₂O) melt or sublime at much lower temperatures than diamond?',
    options: [
      'Their internal covalent bonds are much weaker than carbon–carbon bonds.',
      'Only weak intermolecular forces between molecules must be overcome, not covalent bonds.',
      'Simple molecular solids have no electrostatic forces inside their atoms.',
    ],
    correctIndex: 1,
    explanation: 'Melting or subliming a molecular solid separates whole molecules by overcoming weak intermolecular forces (London / hydrogen bonds).',
  },
  {
    question: 'Why is steel harder and less malleable than pure iron?',
    options: [
      'Different-sized carbon atoms distort the regular iron layers so they can no longer slide easily.',
      'Carbon forms an ionic lattice with iron ions.',
      'Steel has no delocalised electrons.',
    ],
    correctIndex: 0,
    explanation: 'Interstitial carbon atoms disrupt the uniform iron planes, pinning slip planes and raising shear resistance.',
  },
  {
    question: 'Why does non-polar hexane dissolve solid iodine (I₂) while failing to dissolve NaCl?',
    options: [
      'Hexane molecules are too large to fit between I₂ molecules.',
      'Like dissolves like: hexane forms London forces with non-polar I₂, but cannot hydrate charged ions.',
      'Iodine is ionic while NaCl is covalent.',
    ],
    correctIndex: 1,
    explanation: 'Non-polar solvents interact via dispersion forces with non-polar molecules, whereas polar water is needed to hydrate ions.',
  },
  {
    question: 'Why does vulcanised cross-linked polymer resist melting and solvent swelling unlike poly(ethene)?',
    options: [
      'It becomes a metallic alloy when sulfur is added.',
      'Strong covalent cross-links lock the polymer chains together into a single rigid network.',
      'Sulfur atoms increase the hydrogen bonding between chains.',
    ],
    correctIndex: 1,
    explanation: 'Covalent cross-links prevent chains from sliding apart when heated or penetrated by non-polar solvent molecules.',
  },
  {
    question: 'Why does copper resist 1.0 M HCl(aq) acid while iron corrodes rapidly?',
    options: [
      'Copper is below hydrogen in the reactivity series and does not displace H₂ from acid.',
      'Copper has a giant covalent structure.',
      'Copper forms an unreactive ionic oxide that cannot dissolve.',
    ],
    correctIndex: 0,
    explanation: 'Iron is above hydrogen in the reactivity series (Fe + 2H⁺ → Fe²⁺ + H₂), whereas copper is below hydrogen and unreactive with dilute acid.',
  },
];
