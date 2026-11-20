import type {
  Atom,
  Bond,
  BondKind,
  BondingType,
  ElementSymbol,
  LatticeDefinition,
  LatticeId,
  UnitCell,
  Vec3,
} from '../types/chemistry';

// ─────────────────────────────────────────────────────────────────────────────
// Element display data (CPK-inspired, tuned for a dark scene)
// ─────────────────────────────────────────────────────────────────────────────

export const ELEMENT_INFO: Record<ElementSymbol, { name: string; color: string }> = {
  Na: { name: 'Sodium', color: '#a78bfa' },
  Cl: { name: 'Chlorine', color: '#4ade80' },
  Mg: { name: 'Magnesium', color: '#fde047' },
  O: { name: 'Oxygen', color: '#f87171' },
  C: { name: 'Carbon', color: '#94a3b8' },
  Cu: { name: 'Copper', color: '#f59e0b' },
  Fe: { name: 'Iron', color: '#cbd5e1' },
  H: { name: 'Hydrogen', color: '#f8fafc' },
  I: { name: 'Iodine', color: '#c026d3' },
};

export const BONDING_META: Record<
  BondingType,
  { label: string; color: string; summary: string }
> = {
  'giant-ionic': {
    label: 'Giant Ionic',
    color: '#a78bfa',
    summary: 'Oppositely charged ions held by strong electrostatic attraction in all directions.',
  },
  'giant-covalent': {
    label: 'Giant Covalent',
    color: '#38bdf8',
    summary: 'Every atom joined by strong covalent bonds in a continuous network.',
  },
  metallic: {
    label: 'Metallic',
    color: '#f59e0b',
    summary: 'Layers of positive ions in a sea of delocalised electrons.',
  },
  'simple-molecular': {
    label: 'Simple Molecular',
    color: '#4ade80',
    summary: 'Strong covalent bonds inside molecules, weak intermolecular forces between them.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Procedural unit-cell builders
// ─────────────────────────────────────────────────────────────────────────────

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

class CellBuilder {
  atoms: Atom[] = [];
  bonds: Bond[] = [];

  add(element: ElementSymbol, position: Vec3, radius: number, color?: string, extra: Partial<Atom> = {}) {
    const id = this.atoms.length;
    this.atoms.push({ id, element, position, radius, color: color ?? ELEMENT_INFO[element].color, ...extra });
    return id;
  }

  bond(a: number, b: number, kind: BondKind) {
    this.bonds.push({ a, b, kind });
  }

  bondByDistance(target: number, kind: BondKind, tol = 0.06, filter?: (a: Atom, b: Atom) => boolean) {
    const n = this.atoms.length;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const A = this.atoms[i];
        const B = this.atoms[j];
        if (Math.abs(dist(A.position, B.position) - target) <= tol * target && (!filter || filter(A, B))) {
          this.bonds.push({ a: i, b: j, kind });
        }
      }
  }
}

/** Rock-salt (NaCl-type) 3×3×3 ion block: 6:6 octahedral coordination. */
function rockSalt(o: {
  label: string;
  cation: ElementSymbol;
  anion: ElementSymbol;
  rc: number;
  ra: number;
  qc: string;
  qa: string;
  s: number;
}): UnitCell {
  const b = new CellBuilder();
  let centre = 0;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) {
        const cat = (i + j + k) % 2 === 1;
        const id = b.add(
          cat ? o.cation : o.anion,
          [(i - 1) * o.s, (j - 1) * o.s, (k - 1) * o.s],
          cat ? o.rc : o.ra,
          undefined,
          { charge: cat ? o.qc : o.qa },
        );
        if (i === 1 && j === 1 && k === 1) centre = id;
      }
  b.bondByDistance(o.s, 'ionic');
  return {
    label: o.label,
    atoms: b.atoms,
    bonds: b.bonds,
    centreAtomId: centre,
    box: [2 * o.s, 2 * o.s, 2 * o.s],
    coordination: {
      number: '6 : 6',
      geometry: 'Octahedral',
      detail: `Each ${o.cation}${o.qc} ion is surrounded by six ${o.anion}${o.qa} ions (and each ${o.anion}${o.qa} by six ${o.cation}${o.qc}). Ions alternate in all three directions — the "rock salt" face-centred cubic arrangement.`,
    },
  };
}

const FCC_FRAC: Vec3[] = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  [0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5],
];
const TETRA_FRAC: Vec3[] = [
  [0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75],
];

/** Diamond-cubic positions: FCC + 4 tetrahedral sites. Returns builder + centre id. */
function diamondPositions(b: CellBuilder, a: number, element: ElementSymbol, radius: number, color: string) {
  let centre = 0;
  [...FCC_FRAC, ...TETRA_FRAC].forEach((f, idx) => {
    const id = b.add(element, [(f[0] - 0.5) * a, (f[1] - 0.5) * a, (f[2] - 0.5) * a], radius, color);
    if (idx === FCC_FRAC.length) centre = id;
  });
  return { centre, bondLen: (Math.sqrt(3) / 4) * a };
}

function diamondCell(): UnitCell {
  const b = new CellBuilder();
  const a = 1.5;
  const { centre, bondLen } = diamondPositions(b, a, 'C', 0.11, '#e0f2fe');
  b.bondByDistance(bondLen, 'covalent');
  return {
    label: 'Diamond cubic',
    atoms: b.atoms,
    bonds: b.bonds,
    centreAtomId: centre,
    box: [a, a, a],
    coordination: {
      number: '4',
      geometry: 'Tetrahedral (109.5°)',
      detail:
        'Each carbon atom forms four strong covalent bonds to four other carbon atoms (sp³). The rigid 3D tetrahedral network has no delocalised electrons and no planes that can slide.',
    },
  };
}

/** Hexagonal sp² sheets (graphite / graphene). Each layer cut as a coronene-like flake. */
function hexLayers(o: { layers: number; b: number; spacing: number; radius: number; color: string; label: string }): UnitCell {
  const B = new CellBuilder();
  const s3 = Math.sqrt(3);
  const a1 = [s3 * o.b, 0];
  const a2 = [(s3 / 2) * o.b, 1.5 * o.b];
  const basis = [
    [0, 0],
    [(s3 / 2) * o.b, 0.5 * o.b],
  ];
  const heights: number[] = [];
  const layerOf: number[] = [];
  for (let L = 0; L < o.layers; L++) {
    const y = (L - (o.layers - 1) / 2) * o.spacing;
    heights.push(y);
    const shift = L % 2 === 1 ? basis[1] : [0, 0];
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++)
        for (const bs of basis) {
          const lx = i * a1[0] + j * a2[0] + bs[0];
          const lz = i * a1[1] + j * a2[1] + bs[1] - o.b; // hexagon centred on origin
          if (Math.hypot(lx, lz) <= o.radius + 1e-6) {
            B.add('C', [lx + shift[0], y, lz + shift[1]], 0.075, o.color);
            layerOf.push(L);
          }
        }
  }
  B.bondByDistance(o.b, 'covalent', 0.05, (p, q) => Math.abs(p.position[1] - q.position[1]) < 1e-4);
  // Weak forces between layers: atoms sitting directly above one another
  for (let i = 0; i < B.atoms.length; i++)
    for (let j = i + 1; j < B.atoms.length; j++) {
      if (Math.abs(layerOf[i] - layerOf[j]) !== 1) continue;
      const p = B.atoms[i].position;
      const q = B.atoms[j].position;
      if (Math.abs(p[0] - q[0]) < 1e-3 && Math.abs(p[2] - q[2]) < 1e-3 && Math.hypot(p[0], p[2]) < o.radius * 0.75)
        B.bond(i, j, 'intermolecular');
    }
  const mid = Math.floor(o.layers / 2);
  let centre = 0;
  let best = Infinity;
  B.atoms.forEach((at, idx) => {
    if (layerOf[idx] !== mid) return;
    const shift = mid % 2 === 1 ? basis[1] : [0, 0];
    const d = Math.hypot(at.position[0] - shift[0], at.position[2] - shift[1]);
    if (d < best - 1e-6) {
      best = d;
      centre = idx;
    }
  });
  return {
    label: o.label,
    atoms: B.atoms,
    bonds: B.bonds,
    centreAtomId: centre,
    electronSea: 'layers',
    layerHeights: heights,
    coordination: {
      number: '3',
      geometry: 'Trigonal planar (120°) within hexagonal rings',
      detail:
        o.layers > 1
          ? 'Each carbon forms three covalent bonds in flat hexagonal layers (sp²). The fourth outer electron is delocalised along the layer. Layers are held together only by weak intermolecular forces (≈3.35 Å apart).'
          : 'A single layer of graphite: each carbon bonded covalently to three others in hexagonal rings, with one delocalised electron per atom free to move across the sheet.',
    },
  };
}

/** Cuboctahedral cluster cut from an FCC (cubic close-packed) metal: shows 12-coordination. */
function fccCluster(o: { h: number; element: ElementSymbol; radius: number; label: string }): UnitCell {
  const b = new CellBuilder();
  let centre = 0;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        if (Math.abs(i + j + k) % 2 !== 0) continue;
        const id = b.add(o.element, [i * o.h, j * o.h, k * o.h], o.radius, undefined, { charge: '+' });
        if (i === 0 && j === 0 && k === 0) centre = id;
      }
  b.bondByDistance(o.h * Math.SQRT2, 'metallic');
  return {
    label: o.label,
    atoms: b.atoms,
    bonds: b.bonds,
    centreAtomId: centre,
    electronSea: 'volume',
    coordination: {
      number: '12',
      geometry: 'Cuboctahedral (cubic close-packed)',
      detail:
        'Each positive copper ion touches 12 neighbours — the most efficient packing possible. Metallic bonding is non-directional: the delocalised electron sea attracts every ion equally, so layers can slide without the bonding being broken.',
    },
  };
}

/** 2×2×2 block of body-centred cubic iron, optionally with interstitial carbon (steel). */
function bccBlock(o: { a: number; radius: number; color: string; interstitials?: Vec3[]; label: string }): UnitCell {
  const b = new CellBuilder();
  let centre = 0;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const id = b.add('Fe', [i * o.a, j * o.a, k * o.a], o.radius, o.color, { charge: '+' });
        if (i === 0 && j === 0 && k === 0) centre = id;
      }
  for (let i = -1; i <= 0; i++)
    for (let j = -1; j <= 0; j++)
      for (let k = -1; k <= 0; k++)
        b.add('Fe', [(i + 0.5) * o.a, (j + 0.5) * o.a, (k + 0.5) * o.a], o.radius, o.color, { charge: '+' });

  if (o.interstitials) {
    const sites = o.interstitials.map((s) => [s[0] * o.a, s[1] * o.a, s[2] * o.a] as Vec3);
    // Distort host lattice around each interstitial atom
    for (const at of b.atoms) {
      for (const s of sites) {
        const d = dist(at.position, s);
        if (d < o.a * 0.8 && d > 1e-6) {
          const push = (0.13 * o.a * (o.a * 0.8 - d)) / (o.a * 0.8);
          at.position = [
            at.position[0] + ((at.position[0] - s[0]) / d) * push,
            at.position[1] + ((at.position[1] - s[1]) / d) * push,
            at.position[2] + ((at.position[2] - s[2]) / d) * push,
          ];
        }
      }
    }
    sites.forEach((s) => b.add('C', s, o.radius * 0.5, '#1e293b', { interstitial: true }));
  }
  b.bondByDistance((Math.sqrt(3) / 2) * o.a, 'metallic', 0.2, (p, q) => !p.interstitial && !q.interstitial);
  return {
    label: o.label,
    atoms: b.atoms,
    bonds: b.bonds,
    centreAtomId: centre,
    box: [2 * o.a, 2 * o.a, 2 * o.a],
    electronSea: 'volume',
    coordination: {
      number: '8',
      geometry: 'Body-centred cubic',
      detail: o.interstitials
        ? 'Iron ions in a body-centred cubic arrangement, distorted by small interstitial carbon atoms. The different-sized atoms disrupt the regular layers so they can no longer slide easily.'
        : 'Each positive iron ion has 8 nearest neighbours at the corners of a cube. Layers of ions are regular, so they slide over one another when a force is applied — pure iron is soft and malleable.',
    },
  };
}

/** Cubic ice (Ic): oxygen on a diamond lattice; each H covalently bonded to one O and hydrogen-bonded to another. */
function iceCell(): UnitCell {
  const b = new CellBuilder();
  const a = 1.6;
  const { centre, bondLen } = diamondPositions(b, a, 'O', 0.12, ELEMENT_INFO.O.color);
  const oxygens = b.atoms.length;
  const hCount = new Array(oxygens).fill(0);
  const pairs: [number, number][] = [];
  for (let i = 0; i < oxygens; i++)
    for (let j = i + 1; j < oxygens; j++)
      if (Math.abs(dist(b.atoms[i].position, b.atoms[j].position) - bondLen) < 0.05 * bondLen) pairs.push([i, j]);
  // Prioritise the interior oxygens so the inspected centre obeys the ice rules exactly
  pairs.sort((p, q) => Number(q.includes(centre)) - Number(p.includes(centre)));
  for (const [i, j] of pairs) {
    let donor = hCount[i] <= hCount[j] ? i : j;
    if (i === centre && hCount[i] >= 2) donor = j;
    if (j === centre && hCount[j] >= 2) donor = i;
    const acceptor = donor === i ? j : i;
    if (hCount[donor] >= 2) {
      b.bond(i, j, 'hydrogen');
      continue;
    }
    hCount[donor]++;
    const p = b.atoms[donor].position;
    const q = b.atoms[acceptor].position;
    const t = 0.34;
    const h = b.add('H', [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t], 0.065);
    b.bond(donor, h, 'covalent');
    b.bond(h, acceptor, 'hydrogen');
  }
  return {
    label: 'Cubic ice (Ic)',
    atoms: b.atoms,
    bonds: b.bonds,
    centreAtomId: centre,
    box: [a, a, a],
    coordination: {
      number: '4 (2 covalent + 2 hydrogen bonds)',
      geometry: 'Tetrahedral open lattice',
      detail:
        'Each H₂O molecule is hydrogen-bonded to four neighbours in a tetrahedral open lattice — why ice is less dense than water. The O–H covalent bonds are strong; the hydrogen bonds (dashed) between molecules are weak.',
    },
  };
}

/** Solid iodine: I₂ molecules packed in a face-centred orthorhombic arrangement. */
function iodineCell(): UnitCell {
  const b = new CellBuilder();
  const dims: Vec3 = [1.25, 0.95, 1.55];
  const half = 0.19;
  FCC_FRAC.forEach((f) => {
    const c: Vec3 = [(f[0] - 0.5) * dims[0], (f[1] - 0.5) * dims[1], (f[2] - 0.5) * dims[2]];
    const sign = Math.round(f[0] * 2 + f[2] * 2) % 2 === 0 ? 1 : -1;
    const th = (32 * Math.PI) / 180;
    const d: Vec3 = [0, Math.sin(th) * sign * half, Math.cos(th) * half];
    const i1 = b.add('I', [c[0] - d[0], c[1] - d[1], c[2] - d[2]], 0.14);
    const i2 = b.add('I', [c[0] + d[0], c[1] + d[1], c[2] + d[2]], 0.14);
    b.bond(i1, i2, 'covalent');
  });
  return {
    label: 'Orthorhombic I₂ molecular crystal',
    atoms: b.atoms,
    bonds: b.bonds,
    box: dims,
    coordination: {
      number: '12 molecules',
      geometry: 'Face-centred molecular packing',
      detail:
        'Discrete I₂ molecules (one strong I–I covalent bond each) sit at the corners and face centres. Nothing but weak London dispersion forces holds neighbouring molecules together, so iodine sublimes easily.',
    },
  };
}

/** Poly(ethene): parallel zig-zag chains with weak forces between chains. */
function polyethyleneCell(): UnitCell {
  const b = new CellBuilder();
  const chains: [number, number][] = [
    [-0.27, -0.27],
    [-0.27, 0.27],
    [0.27, -0.27],
    [0.27, 0.27],
  ];
  const chainC: number[][] = [];
  chains.forEach(([yc, zc]) => {
    const ids: number[] = [];
    let prev = -1;
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.21;
      const zig = (i % 2 ? 1 : -1) * 0.065;
      const c = b.add('C', [x, yc + zig, zc], 0.08, '#64748b');
      ids.push(c);
      if (prev >= 0) b.bond(prev, c, 'covalent');
      prev = c;
      const sg = Math.sign(zig);
      for (const dz of [-0.1, 0.1]) {
        const h = b.add('H', [x, yc + zig + sg * 0.07, zc + dz], 0.045);
        b.bond(c, h, 'covalent');
      }
    }
    chainC.push(ids);
  });
  // Indicate weak intermolecular forces between neighbouring chains
  for (const [p, q] of [[0, 1], [2, 3], [0, 2], [1, 3]] as const)
    for (const i of [1, 3, 5]) b.bond(chainC[p][i], chainC[q][i], 'intermolecular');
  return {
    label: 'Poly(ethene) chain packing',
    atoms: b.atoms,
    bonds: b.bonds,
    centreAtomId: chainC[0][3],
    coordination: {
      number: '4 per carbon',
      geometry: 'Tetrahedral C along zig-zag chains',
      detail:
        'Each carbon has four covalent bonds (two C–C, two C–H). Very long chains are held to neighbouring chains only by weak intermolecular forces, so the polymer softens and melts at a low temperature.',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lattice catalogue
// ─────────────────────────────────────────────────────────────────────────────

export const LATTICES: Record<LatticeId, LatticeDefinition> = {
  nacl: {
    id: 'nacl',
    name: 'Sodium Chloride',
    formula: 'NaCl',
    bonding: 'giant-ionic',
    cost: 45,
    buildable: true,
    upgradeTo: 'mgo',
    upgradeCost: 55,
    upgradeNote:
      'Swap to Mg²⁺/O²⁻ ions: doubling both charges and shrinking the ions greatly strengthens the electrostatic attraction (m.p. 1074 K → 3125 K).',
    stats: { maxIntegrity: 180, power: 14, range: 2.2 },
    properties: {
      meltingPointK: 1074,
      phaseChange: 'melts',
      thermalConductivity: 6.5,
      thermalDurability: 1,
      conductsSolid: false,
      conductivityRank: 0,
      breakdownKV: 25,
      shear: 'brittle-ionic',
      solvent: 'dissolves',
      hardnessMohs: 2.5,
      ionCharges: 'Na⁺ / Cl⁻',
    },
    accent: '#a78bfa',
    tagline: 'Cheap arc insulator — brittle, water-soluble.',
    description:
      'A giant lattice of Na⁺ and Cl⁻ ions held by strong electrostatic forces in all directions. High melting point and a perfect insulator while solid — but shift one layer and like charges meet.',
    examPoints: [
      'Giant ionic lattice — strong electrostatic forces between oppositely charged ions.',
      'High melting point: lots of energy needed to overcome the attractions.',
      'Does not conduct when solid: ions are fixed in position.',
      'Conducts when molten or dissolved: ions are free to move and carry charge.',
      'Brittle: a force shifts layers so like-charged ions line up and repel.',
    ],
    buildCell: () => rockSalt({ label: 'Rock salt (NaCl) lattice', cation: 'Na', anion: 'Cl', rc: 0.14, ra: 0.21, qc: '⁺', qa: '⁻', s: 0.6 }),
  },
  mgo: {
    id: 'mgo',
    name: 'Magnesium Oxide',
    formula: 'MgO',
    bonding: 'giant-ionic',
    cost: 95,
    buildable: true,
    upgradeFrom: 'nacl',
    stats: { maxIntegrity: 300, power: 18, range: 2.2 },
    properties: {
      meltingPointK: 3125,
      phaseChange: 'melts',
      thermalConductivity: 45,
      thermalDurability: 2,
      conductsSolid: false,
      conductivityRank: 0,
      breakdownKV: 40,
      shear: 'brittle-ionic',
      solvent: 'slightly-soluble',
      hardnessMohs: 5.5,
      ionCharges: 'Mg²⁺ / O²⁻',
    },
    accent: '#fde047',
    tagline: 'Heat-proof refractory — double thermal durability.',
    description:
      'Same rock-salt structure as NaCl but with 2+ and 2− ions. Higher charge density means far stronger attraction — used to line furnaces. Still an ionic solid: still brittle.',
    examPoints: [
      'Ions have charges 2+ and 2− (vs 1+ and 1− in NaCl).',
      'Stronger electrostatic attraction → much more energy to overcome → higher melting point.',
      'Smaller ions pack more closely, strengthening the attraction further.',
      'Still brittle and still an insulator when solid.',
    ],
    buildCell: () => rockSalt({ label: 'Rock salt (MgO) lattice', cation: 'Mg', anion: 'O', rc: 0.12, ra: 0.19, qc: '²⁺', qa: '²⁻', s: 0.55 }),
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    formula: 'C (sp³)',
    bonding: 'giant-covalent',
    cost: 140,
    buildable: true,
    stats: { maxIntegrity: 320, power: 22, range: 2.4 },
    properties: {
      meltingPointK: 3820,
      phaseChange: 'sublimes',
      thermalConductivity: 2200,
      thermalDurability: 2,
      conductsSolid: false,
      conductivityRank: 0,
      breakdownKV: 200,
      shear: 'hard-network',
      solvent: 'insoluble',
      hardnessMohs: 10,
    },
    accent: '#bae6fd',
    tagline: 'Hardest barrier. Superb heat sink. Fears plasma.',
    description:
      'Every carbon covalently bonded to four others in a rigid tetrahedral network. Extremely hard, very high sublimation point and the best thermal conductor known — yet an electrical insulator.',
    examPoints: [
      'Each carbon forms 4 covalent bonds — giant covalent structure.',
      'Very hard: rigid 3D network of strong covalent bonds.',
      'Very high melting point: many strong covalent bonds must be broken.',
      'Does not conduct electricity: no delocalised electrons (all 4 outer electrons used in bonds).',
      'Extension: conducts heat extremely well via lattice vibrations (phonons).',
    ],
    buildCell: diamondCell,
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    formula: 'C (sp²)',
    bonding: 'giant-covalent',
    cost: 60,
    buildable: true,
    upgradeTo: 'graphene',
    upgradeCost: 90,
    upgradeNote:
      'Exfoliate to a single layer: with no weak interlayer forces left to fail, the sheet has enormous tensile strength and even better conductivity.',
    stats: { maxIntegrity: 170, power: 15, range: 2.2 },
    properties: {
      meltingPointK: 3900,
      phaseChange: 'sublimes',
      thermalConductivity: 600,
      thermalDurability: 1.6,
      conductsSolid: true,
      conductivityRank: 2,
      breakdownKV: 0,
      shear: 'layer-slip',
      solvent: 'insoluble',
      hardnessMohs: 1.5,
    },
    accent: '#64748b',
    tagline: 'Grounds arcs, deflects glancing blows, cleaves under parallel shear.',
    description:
      'Flat hexagonal layers of carbon, each atom bonded to three others. The fourth electron is delocalised, so graphite conducts. Weak forces between layers let them slide — a dry lubricant.',
    examPoints: [
      'Each carbon forms 3 covalent bonds in hexagonal layers.',
      'One delocalised electron per atom → conducts electricity.',
      'Weak intermolecular forces between layers → layers slide → soft and slippery.',
      'High melting point: strong covalent bonds within layers.',
    ],
    buildCell: () => hexLayers({ layers: 3, b: 0.3, spacing: 0.7, radius: 0.3 * 2.7, color: '#94a3b8', label: 'Hexagonal graphite (ABA stacking)' }),
  },
  graphene: {
    id: 'graphene',
    name: 'Graphene',
    formula: 'C (monolayer)',
    bonding: 'giant-covalent',
    cost: 150,
    buildable: false,
    upgradeFrom: 'graphite',
    stats: { maxIntegrity: 270, power: 24, range: 2.6 },
    properties: {
      meltingPointK: 3900,
      phaseChange: 'sublimes',
      thermalConductivity: 5000,
      thermalDurability: 1.8,
      conductsSolid: true,
      conductivityRank: 3,
      breakdownKV: 0,
      shear: 'tensile-sheet',
      solvent: 'insoluble',
      hardnessMohs: 1.5,
    },
    accent: '#22d3ee',
    tagline: 'Single-atom sheet. Conducts heat and charge superbly.',
    description:
      'One layer of graphite. A continuous sheet of strong covalent bonds with delocalised electrons: very high tensile strength, excellent electrical and thermal conductor.',
    examPoints: [
      'Single layer of graphite, one atom thick.',
      'Very strong: continuous network of covalent bonds.',
      'Conducts electricity: delocalised electrons move across the sheet.',
    ],
    buildCell: () => hexLayers({ layers: 1, b: 0.27, spacing: 0, radius: 0.27 * 3.7, color: '#a5f3fc', label: 'Graphene monolayer' }),
  },
  copper: {
    id: 'copper',
    name: 'Copper',
    formula: 'Cu',
    bonding: 'metallic',
    cost: 75,
    buildable: true,
    stats: { maxIntegrity: 220, power: 17, range: 2.2 },
    properties: {
      meltingPointK: 1358,
      phaseChange: 'melts',
      thermalConductivity: 400,
      thermalDurability: 1.2,
      conductsSolid: true,
      conductivityRank: 3,
      breakdownKV: 0,
      shear: 'malleable',
      solvent: 'inert-metal',
      hardnessMohs: 3,
    },
    accent: '#f59e0b',
    tagline: 'Best arc ground. Malleable. Unreactive to water.',
    description:
      'Close-packed positive copper ions in a sea of delocalised electrons. The mobile electrons carry charge and heat; non-directional bonding lets layers slide without shattering.',
    examPoints: [
      'Giant structure of positive ions surrounded by delocalised electrons.',
      'Strong electrostatic attraction between ions and electrons → high melting point.',
      'Good conductor of electricity and heat: delocalised electrons move through the structure.',
      'Malleable/ductile: layers of ions slide over each other.',
    ],
    buildCell: () => fccCluster({ h: 0.48, element: 'Cu', radius: 0.21, label: 'Cubic close-packed Cu cluster' }),
  },
  iron: {
    id: 'iron',
    name: 'Iron',
    formula: 'Fe',
    bonding: 'metallic',
    cost: 55,
    buildable: true,
    upgradeTo: 'steel',
    upgradeCost: 70,
    upgradeNote:
      'Alloying: add carbon atoms of a different size. They distort the layers of iron ions so the layers can no longer slide easily — the alloy is much harder and stronger.',
    stats: { maxIntegrity: 230, power: 14, range: 2.0 },
    properties: {
      meltingPointK: 1811,
      phaseChange: 'melts',
      thermalConductivity: 80,
      thermalDurability: 1.3,
      conductsSolid: true,
      conductivityRank: 2,
      breakdownKV: 0,
      shear: 'malleable',
      solvent: 'corrodes',
      corrosionRate: 0.7,
      hardnessMohs: 4,
    },
    accent: '#cbd5e1',
    tagline: 'Tough, cheap, conductive. Rusts. Upgrade to steel.',
    description:
      'Body-centred cubic iron. Regular layers of ions slide when stressed, so pure iron bends rather than breaking — but it is relatively soft and rusts in water and oxygen.',
    examPoints: [
      'Pure metals: regular layers of identical ions slide easily → soft and malleable.',
      'Conducts electricity: delocalised electrons.',
      'Rusts when exposed to water and oxygen.',
    ],
    buildCell: () => bccBlock({ a: 0.6, radius: 0.16, color: '#cbd5e1', label: 'Body-centred cubic iron (2×2×2 cells)' }),
  },
  steel: {
    id: 'steel',
    name: 'Carbon Steel',
    formula: 'Fe–C alloy',
    bonding: 'metallic',
    cost: 125,
    buildable: false,
    upgradeFrom: 'iron',
    stats: { maxIntegrity: 340, power: 20, range: 2.2 },
    properties: {
      meltingPointK: 1700,
      phaseChange: 'melts',
      thermalConductivity: 50,
      thermalDurability: 1.5,
      conductsSolid: true,
      conductivityRank: 1,
      breakdownKV: 0,
      shear: 'alloy-pinned',
      solvent: 'corrodes',
      corrosionRate: 0.35,
      hardnessMohs: 5.5,
    },
    accent: '#94a3b8',
    tagline: 'Shear-proof alloy. The answer to shockwaves.',
    description:
      'Iron with interstitial carbon atoms. The different-sized atoms distort the layers, pinning them in place so they cannot slide — dramatically raising yield strength.',
    examPoints: [
      'An alloy is a mixture of a metal with other elements.',
      'Different-sized atoms distort the layers in the structure.',
      'Layers can no longer slide over each other easily → harder and stronger than pure iron.',
    ],
    buildCell: () =>
      bccBlock({
        a: 0.6,
        radius: 0.16,
        color: '#94a3b8',
        interstitials: [
          [0.5, 0, 0],
          [-0.5, -0.5, -1],
          [0, 0.5, 0.5],
          [-1, -0.5, 0],
        ],
        label: 'Distorted BCC iron with interstitial carbon',
      }),
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    formula: 'H₂O(s)',
    bonding: 'simple-molecular',
    cost: 15,
    buildable: true,
    stats: { maxIntegrity: 70, power: 9, range: 1.8 },
    properties: {
      meltingPointK: 273,
      phaseChange: 'melts',
      thermalConductivity: 2.2,
      thermalDurability: 0.5,
      conductsSolid: false,
      conductivityRank: 0,
      breakdownKV: 1.5,
      shear: 'brittle-molecular',
      solvent: 'erodes',
      hardnessMohs: 1.5,
    },
    accent: '#bfdbfe',
    tagline: 'Dirt cheap. Blocks sparks. Gone in any heat.',
    description:
      'Water molecules hydrogen-bonded into an open tetrahedral lattice. Cheap and quick to deploy, but only weak intermolecular forces need to be overcome to melt it.',
    examPoints: [
      'Simple molecular: strong covalent O–H bonds within molecules.',
      'Weak hydrogen bonds between molecules → low melting point.',
      'When ice melts, covalent bonds are NOT broken — only intermolecular forces.',
      'Does not conduct: molecules have no overall charge.',
    ],
    buildCell: iceCell,
  },
  iodine: {
    id: 'iodine',
    name: 'Iodine',
    formula: 'I₂(s)',
    bonding: 'simple-molecular',
    cost: 25,
    buildable: true,
    stats: { maxIntegrity: 90, power: 10, range: 1.9 },
    properties: {
      meltingPointK: 387,
      phaseChange: 'sublimes',
      thermalConductivity: 0.45,
      thermalDurability: 0.6,
      conductsSolid: false,
      conductivityRank: 0,
      breakdownKV: 1.0,
      shear: 'soft-molecular',
      solvent: 'non-polar',
      hardnessMohs: 1,
    },
    accent: '#c026d3',
    tagline: 'Non-polar: shrugs off water. Sublimes in heat.',
    description:
      'A molecular crystal of I₂. Non-polar molecules barely dissolve in polar water ("like dissolves like"), but weak London forces mean it sublimes readily.',
    examPoints: [
      'Simple molecular: I₂ molecules held by weak intermolecular (London) forces.',
      'Low melting/sublimation point — little energy needed to separate molecules.',
      'Non-polar → very low solubility in water.',
      'Does not conduct electricity.',
    ],
    buildCell: iodineCell,
  },
  polyethylene: {
    id: 'polyethylene',
    name: 'Poly(ethene)',
    formula: '(C₂H₄)ₙ',
    bonding: 'simple-molecular',
    cost: 35,
    buildable: true,
    stats: { maxIntegrity: 125, power: 11, range: 2.0 },
    properties: {
      meltingPointK: 400,
      phaseChange: 'melts',
      thermalConductivity: 0.4,
      thermalDurability: 0.7,
      conductsSolid: false,
      conductivityRank: 0,
      breakdownKV: 20,
      shear: 'flexible-chains',
      solvent: 'non-polar',
      hardnessMohs: 1.5,
    },
    accent: '#86efac',
    tagline: 'Polymer insulator. Flexible, waterproof, low m.p.',
    description:
      'Long hydrocarbon chains. Covalent bonds along each chain, but weak forces between chains — flexible, waterproof and an excellent electrical insulator, though it melts easily.',
    examPoints: [
      'Polymers: very long molecules; intermolecular forces stronger than small molecules but still relatively weak.',
      'Insulator: no delocalised electrons or ions.',
      'Non-polar chains are insoluble in water.',
      'Low melting point compared with giant structures.',
    ],
    buildCell: polyethyleneCell,
  },
};

export const LATTICE_ORDER: LatticeId[] = [
  'nacl',
  'mgo',
  'diamond',
  'graphite',
  'graphene',
  'copper',
  'iron',
  'steel',
  'ice',
  'iodine',
  'polyethylene',
];
