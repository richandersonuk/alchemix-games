import type {
  DamageType,
  InteractionResult,
  LatticeDefinition,
  ThreatId,
  ThreatSpec,
  Verdict,
} from '../types/chemistry';
import { THREATS, THREAT_ORDER } from '../data/waves';

// ─────────────────────────────────────────────────────────────────────────────
// Resolves an incoming threat against a lattice's bonding-derived properties.
// Every branch carries the mark-scheme rationale shown in the Failure Log.
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractionContext {
  /** Ionic barrier has been wetted by a solvent jet (ions mobile). */
  hydrated?: boolean;
}

type Partial = Omit<InteractionResult, 'slow'> & { slow?: number };
const r = (p: Partial): InteractionResult => ({ slow: 1, ...p });

export function resolveInteraction(
  lat: LatticeDefinition,
  threat: ThreatSpec,
  ctx: InteractionContext = {},
): InteractionResult {
  switch (threat.type) {
    case 'thermal':
      return thermal(lat, threat);
    case 'electrical':
      return electrical(lat, threat, !!ctx.hydrated);
    case 'shear':
      return shear(lat, threat);
    case 'solvent':
      return solvent(lat, threat);
  }
}

// ── Thermal ─────────────────────────────────────────────────────────────────

function thermal(lat: LatticeDefinition, t: ThreatSpec): InteractionResult {
  const p = lat.properties;
  const T = t.intensity;
  const mp = p.meltingPointK;

  if (t.cryo) {
    if (lat.id === 'ice') {
      return r({
        outcome: 'absorbed',
        verdict: 'counter',
        threatDamageMult: 1.6,
        towerDamageMult: 0.05,
        slow: 0.5,
        title: 'Cryogenic quench absorbed: H₂O(s) locked tighter at 77 K',
        rationale:
          'Lowering temperature to 77 K removes thermal kinetic energy from water molecules, strengthening the rigid hydrogen-bonded ice lattice.',
        keywords: ['lower kinetic energy', 'hydrogen bonds locked', 'molecular crystal'],
        sfx: 'thud',
      });
    }
    if (p.shear === 'brittle-ionic' || p.shear === 'soft-molecular') {
      return r({
        outcome: 'fractured',
        verdict: 'weak',
        threatDamageMult: 0.35,
        towerDamageMult: 2.6,
        title: `Thermal shock fracture: ${lat.formula} cracked at ${T} K`,
        rationale: `Rapid cooling from ambient to ${T} K creates steep contraction gradients across a low-conductivity, brittle lattice — ${lat.name} fractures under internal stress.`,
        keywords: ['thermal shock', 'low thermal conductivity', 'brittle fracture'],
        sfx: 'crack',
      });
    }
    return r({
      outcome: 'dissipated',
      verdict: 'counter',
      threatDamageMult: 1.25,
      towerDamageMult: 0.15,
      title: `Thermal shock survived: ${lat.name} resisted ${T} K quench`,
      rationale:
        lat.bonding === 'metallic'
          ? 'Non-directional metallic bonding and high thermal conductivity equalise temperature rapidly without brittle cleavage.'
          : lat.id === 'c60' || lat.id === 'polyethylene' || lat.id === 'thermoset'
            ? 'Flexible molecular packing or covalent cross-links accommodate thermal contraction without shattering.'
            : 'Strong covalent networks with high thermal conductivity or low thermal expansion resist cryogenic cracking.',
      keywords: ['thermal equilibration', 'no brittle cleavage', 'resists thermal shock'],
      sfx: 'clang',
    });
  }

  if (t.plasma && lat.id === 'diamond') {
    return r({
      outcome: 'graphitised',
      verdict: 'neutral',
      threatDamageMult: 1.4,
      towerDamageMult: 0.35,
      graphitise: true,
      title: `Graphitisation: ${T} K plasma is rearranging diamond`,
      rationale:
        'Diamond still conducts the heat away, but sustained extreme temperature supplies the activation energy for sp³ carbon to rearrange into the more stable sp² layers of graphite. Hold too long and the barrier converts.',
      keywords: ['sp³ → sp²', 'activation energy', 'graphite more stable'],
      sfx: 'hiss',
    });
  }

  if (t.plasma && lat.id === 'graphene') {
    return r({
      outcome: 'vaporised',
      verdict: 'weak',
      threatDamageMult: 0.7,
      towerDamageMult: 1.65,
      title: `Monolayer ablation: ${T} K plasma eroded graphene`,
      rationale:
        'Although graphene has high in-plane thermal conductivity, a single-atom-thick sheet has negligible bulk thermal mass and oxidises/ablates rapidly in ionised 2900 K plasma.',
      keywords: ['monolayer lacks bulk', 'plasma ablation', 'one atom thick'],
      sfx: 'hiss',
    });
  }

  if (t.plasma && lat.id === 'thermoset') {
    return r({
      outcome: 'vaporised',
      verdict: 'weak',
      threatDamageMult: 0.3,
      towerDamageMult: 3.5,
      title: `Thermoset charred: ${T} K plasma decomposed cross-links`,
      rationale:
        'Thermosetting polymers resist moderate heat without melting, but sustained 2900 K plasma breaks the C–C and C–S covalent bonds, charring the network.',
      keywords: ['thermal decomposition', 'covalent bonds broken', 'charring'],
      sfx: 'hiss',
    });
  }

  if (T >= mp) {
    if (lat.bonding === 'simple-molecular') {
      const sublimes = p.phaseChange === 'sublimes';
      return r({
        outcome: 'vaporised',
        verdict: 'weak',
        threatDamageMult: 0.1,
        towerDamageMult: 99,
        instantDestroy: true,
        title: `Barrier ${sublimes ? 'sublimed' : 'vaporised'}: ${lat.formula} gone at ${T} K`,
        rationale: `Only weak intermolecular forces hold ${lat.formula} molecules together, so very little energy is needed to separate them (${sublimes ? 'sublimes' : 'm.p.'} ≈ ${mp} K). The covalent bonds inside the molecules were NOT broken.`,
        keywords: ['weak intermolecular forces', 'low melting point', 'covalent bonds not broken'],
        sfx: 'hiss',
      });
    }
    const ionic = lat.bonding === 'giant-ionic';
    const covalent = lat.bonding === 'giant-covalent';
    return r({
      outcome: 'melted',
      verdict: 'weak',
      threatDamageMult: 0.2,
      towerDamageMult: 6,
      title: `Lattice melted: ${T} K exceeds m.p. of ${lat.formula} (${mp} K)`,
      rationale: ionic
        ? 'Enough energy was supplied to overcome the electrostatic attraction between the ions. The molten ions are now free to move — the barrier conducts and has lost its structure.'
        : covalent
          ? 'Extreme thermal energy broke enough strong covalent bonds in the giant network to melt the solid.'
          : 'Enough energy was supplied to overcome the metallic bonding (attraction between positive ions and delocalised electrons). The barrier has melted.',
      keywords: ionic
        ? ['overcome electrostatic attraction', 'ions free to move', 'molten conducts']
        : covalent
          ? ['strong covalent bonds broken', 'exceeds melting point']
          : ['overcome metallic bonding', 'energy supplied > bond strength'],
      sfx: 'hiss',
    });
  }

  if (lat.id === 'thermoset') {
    return r({
      outcome: 'absorbed',
      verdict: 'counter',
      threatDamageMult: 1.1,
      towerDamageMult: 0.25,
      title: `Cross-linked network held: ${lat.name} refused to melt at ${T} K`,
      rationale:
        'Unlike thermosoftening poly(ethene), covalent sulfur cross-links lock the chains together so they cannot slide apart when heated.',
      keywords: ['thermosetting polymer', 'covalent cross-links', 'does not melt'],
      sfx: 'hiss',
    });
  }

  const ratio = T / mp;
  const dissipation = Math.min(p.thermalConductivity / 400, 3);
  const eff = Math.max(0.5 + 0.5 * dissipation, p.thermalDurability * 0.5);
  const vuln = (ratio * ratio * 2) / p.thermalDurability / (1 + dissipation);
  const verdict: Verdict = vuln < 0.4 && eff >= 0.9 ? 'counter' : vuln > 0.9 ? 'weak' : 'neutral';

  let rationale: string;
  let keywords: string[];
  let title: string;
  switch (lat.bonding) {
    case 'giant-ionic':
      title = `Heat absorbed: ${lat.formula} lattice held at ${T} K`;
      rationale = `Strong electrostatic forces between oppositely charged ions act in all directions; a lot of energy is needed to overcome them (m.p. ${mp} K).${
        lat.id === 'mgo'
          ? ' Mg²⁺/O²⁻ carry double the charge of Na⁺/Cl⁻ and are smaller, so the attraction is far stronger — double thermal durability.'
          : ' The 1+/1− ions of NaCl are under strain this close to their melting point.'
      }`;
      keywords = ['strong electrostatic attraction', 'oppositely charged ions', 'lots of energy to overcome'];
      break;
    case 'giant-covalent':
      title = `Heat dissipated: ${lat.name} conducted the ${T} K wave away`;
      rationale =
        lat.id === 'diamond'
          ? 'A rigid network of strong covalent bonds passes lattice vibrations along extremely efficiently — diamond is the best thermal conductor known, despite having no free electrons. Many strong covalent bonds would have to break to melt it.'
          : 'Strong covalent bonds within the layers give a very high sublimation point, and delocalised electrons and in-plane vibrations carry the heat away.';
      keywords = ['many strong covalent bonds', 'very high melting point', 'lattice vibrations'];
      break;
    case 'metallic':
      title = `Heat ${dissipation >= 0.9 ? 'conducted' : 'absorbed'}: ${lat.name} at ${T} K`;
      rationale = `Strong attraction between positive ions and delocalised electrons gives a high melting point (${mp} K). Delocalised electrons move through the structure and transfer thermal energy quickly.`;
      keywords = ['delocalised electrons', 'good thermal conductor', 'strong metallic bonding'];
      break;
    default:
      title = `Heat absorbed by ${lat.formula}`;
      rationale = 'Below its melting point the barrier holds, but weak intermolecular forces offer little margin.';
      keywords = ['intermolecular forces'];
  }

  return r({
    outcome: dissipation >= 0.9 ? 'dissipated' : 'absorbed',
    verdict,
    threatDamageMult: eff,
    towerDamageMult: vuln,
    slow: lat.bonding === 'giant-ionic' ? 0.8 : 1,
    title,
    rationale,
    keywords,
    sfx: 'hiss',
  });
}

// ── Electrical ──────────────────────────────────────────────────────────────

function electrical(lat: LatticeDefinition, t: ThreatSpec, hydrated: boolean): InteractionResult {
  const p = lat.properties;
  const V = t.intensity;

  if (lat.bonding === 'giant-ionic' && hydrated) {
    return r({
      outcome: 'electrolysed',
      verdict: 'weak',
      threatDamageMult: 0.3,
      towerDamageMult: 1.9,
      title: `Wet ionic barrier conducted the ${V} kV arc`,
      rationale:
        'Water has freed ions from the lattice surface. Ions in solution are free to move and carry charge, so the dissolved/wet ionic compound now conducts — the arc tears straight through.',
      keywords: ['ions free to move in solution', 'aqueous ionic compounds conduct', 'carry charge'],
      sfx: 'hum',
    });
  }

  if (p.conductsSolid) {
    const eff = 0.9 + 0.4 * p.conductivityRank;
    const graphitic = lat.bonding === 'giant-covalent';
    return r({
      outcome: 'grounded',
      verdict: 'counter',
      threatDamageMult: eff,
      towerDamageMult: 0.1,
      title: `Discharge grounded: ${graphitic ? 'delocalised π electrons' : 'electron sea'} carried the ${V} kV arc`,
      rationale: graphitic
        ? 'Each carbon forms only three covalent bonds; the fourth outer electron is delocalised along the layer. These electrons move and carry the charge harmlessly to ground.'
        : 'Delocalised electrons are free to move through the metallic structure and carry the charge — the arc is safely channelled to ground.',
      keywords: graphitic
        ? ['3 bonds per carbon', 'one delocalised electron', 'electrons free to move']
        : ['delocalised electrons', 'free to move', 'carry charge'],
      sfx: 'hum',
    });
  }

  if (V <= p.breakdownKV) {
    const text =
      lat.bonding === 'giant-ionic'
        ? 'In the solid, ions are held in fixed positions in the lattice and cannot move, so there are no mobile charge carriers.'
        : lat.bonding === 'giant-covalent'
          ? 'All four outer electrons of each carbon are used in covalent bonds — there are no delocalised electrons to carry charge.'
          : 'The molecules have no overall charge and there are no free electrons or ions to carry the current.';
    return r({
      outcome: 'blocked',
      verdict: 'counter',
      threatDamageMult: 1.0,
      towerDamageMult: 0.05,
      slow: 0.45,
      title: `Arc blocked: ${lat.formula} insulated the ${V} kV discharge`,
      rationale: text,
      keywords:
        lat.bonding === 'giant-ionic'
          ? ['ions fixed in position', 'cannot move', 'solid does not conduct']
          : lat.bonding === 'giant-covalent'
            ? ['no delocalised electrons', 'all electrons in bonds']
            : ['no charged particles', 'molecules neutral'],
      sfx: 'thud',
    });
  }

  return r({
    outcome: 'breakdown',
    verdict: 'weak',
    threatDamageMult: 0.25,
    towerDamageMult: 2.5,
    title: `Dielectric breakdown: ${V} kV overwhelmed ${lat.formula}`,
    rationale: `Simple molecular solids are good insulators at low voltage (neutral molecules, no free electrons), but this ${V} kV field exceeded what a thin ${lat.formula} barrier can hold (~${p.breakdownKV} kV) and ionised a path straight through.`,
    keywords: ['good insulator at low voltage', 'no free electrons', 'breakdown (extension)'],
    sfx: 'hum',
  });
}

// ── Shear ───────────────────────────────────────────────────────────────────

function shear(lat: LatticeDefinition, t: ThreatSpec): InteractionResult {
  const P = `${t.intensity} MPa`;
  switch (lat.properties.shear) {
    case 'brittle-ionic': {
      const [c, a] = lat.id === 'mgo' ? ['Mg²⁺', 'O²⁻'] : ['Na⁺', 'Cl⁻'];
      return r({
        outcome: 'shattered',
        verdict: 'weak',
        threatDamageMult: 0.35,
        towerDamageMult: 4.2,
        title: `Barrier shattered: layer shift forced like ions (${c} next to ${c}) to repel`,
        rationale: `The ${P} force moved one layer of ions along by one position. ${c} ended up next to ${c} and ${a} next to ${a}; like charges repel and the lattice splits along a cleavage plane. Ionic compounds are brittle.`,
        keywords: ['layers shift', 'like charges line up', 'repel', 'brittle'],
        sfx: 'crack',
      });
    }
    case 'hard-network':
      return r({
        outcome: 'resisted',
        verdict: 'counter',
        threatDamageMult: 1.5,
        towerDamageMult: 0.3,
        title: `Impact resisted: ${lat.name}'s covalent network did not yield to ${P}`,
        rationale:
          lat.id === 'sio2'
            ? 'Each silicon is covalently bonded to four oxygens in a rigid tetrahedral network. There are no planes that can slide easily.'
            : 'Each carbon is held by four strong covalent bonds in a rigid three-dimensional tetrahedral network. There are no layers that can slide — diamond is the hardest natural substance.',
        keywords: ['4 strong covalent bonds', 'rigid 3D network', 'very hard'],
        sfx: 'clang',
      });
    case 'layer-slip':
      if (t.shearMode === 'glancing')
        return r({
          outcome: 'deflected',
          verdict: 'counter',
          threatDamageMult: 1.6,
          towerDamageMult: 0.1,
          slow: 0.6,
          title: 'Glancing blow deflected: graphite layers slid like a dry lubricant',
          rationale:
            'Only weak intermolecular forces hold the layers together, so the top layers slide easily over one another. The oblique impact skids off instead of breaking covalent bonds.',
          keywords: ['weak forces between layers', 'layers slide', 'lubricant'],
          sfx: 'thud',
        });
      return r({
        outcome: 'cleaved',
        verdict: 'weak',
        threatDamageMult: 0.3,
        towerDamageMult: 2.8,
        title: `Graphite cleaved: ${P} parallel shear peeled the layers apart`,
        rationale:
          'The force acted parallel to the layers. The forces between layers are weak, so the layers slid apart — graphite is soft (Mohs 1–2) even though each layer is held by strong covalent bonds.',
        keywords: ['weak forces between layers', 'layers slide apart', 'soft'],
        sfx: 'crack',
      });
    case 'tensile-sheet':
      if (t.shearMode === 'glancing') {
        return r({
          outcome: 'fractured',
          verdict: 'weak',
          threatDamageMult: 0.55,
          towerDamageMult: 1.85,
          title: `Monolayer punctured: ${P} glancing impact tore out-of-plane`,
          rationale:
            'Graphene is extraordinarily strong along its flat plane, but a one-atom-thick sheet lacks bulk thickness to absorb oblique out-of-plane impacts.',
          keywords: ['2D monolayer', 'out-of-plane puncture', 'one atom thick'],
          sfx: 'crack',
        });
      }
      return r({
        outcome: 'resisted',
        verdict: 'counter',
        threatDamageMult: 1.35,
        towerDamageMult: 0.4,
        title: 'Shear resisted: graphene sheet took the load in-plane',
        rationale:
          'A single continuous layer has no weak interlayer forces to fail. The load is spread across a network of strong covalent bonds — very high in-plane tensile strength.',
        keywords: ['single layer', 'strong covalent bonds', 'high tensile strength'],
        sfx: 'clang',
      });
    case 'molecular-lubricant':
      if (t.shearMode === 'glancing') {
        return r({
          outcome: 'deflected',
          verdict: 'counter',
          threatDamageMult: 1.65,
          towerDamageMult: 0.1,
          slow: 0.55,
          title: 'Glancing blow deflected: C₆₀ cages rolled like ball bearings',
          rationale:
            'Spherical C₆₀ molecules are held only by weak intermolecular forces, so they roll past each other and deflect oblique mechanical impacts.',
          keywords: ['spherical molecules', 'weak intermolecular forces', 'molecular lubricant'],
          sfx: 'thud',
        });
      }
      return r({
        outcome: 'fractured',
        verdict: 'weak',
        threatDamageMult: 0.4,
        towerDamageMult: 2.2,
        title: `C₆₀ lattice disrupted: ${P} shear separated the cages`,
        rationale:
          'Under direct parallel shear, the weak intermolecular forces between discrete C₆₀ molecules give way easily without breaking covalent bonds inside the cages.',
        keywords: ['weak intermolecular forces', 'discrete C₆₀ molecules'],
        sfx: 'crack',
      });
    case 'nanotube-cylinder':
      return r({
        outcome: 'resisted',
        verdict: 'counter',
        threatDamageMult: 1.65,
        towerDamageMult: 0.2,
        slow: 0.7,
        title: `Tube wall held: carbon nanotube resisted ${P} shear`,
        rationale:
          'Rolling sp² carbon into a seamless cylinder distributes both parallel tension and oblique impact across strong covalent bonds in three dimensions.',
        keywords: ['cylindrical fullerene', 'strong covalent bonds', '3D tensile rigidity'],
        sfx: 'clang',
      });
    case 'cross-linked':
      return r({
        outcome: 'resisted',
        verdict: 'counter',
        threatDamageMult: 1.35,
        towerDamageMult: 0.25,
        slow: 0.65,
        title: `Cross-links held: vulcanised polymer resisted ${P} shear`,
        rationale:
          'Covalent sulfur cross-links tie the hydrocarbon chains together so they cannot slide past one another permanently under shear.',
        keywords: ['covalent cross-links', 'chains anchored', 'thermoset rigidity'],
        sfx: 'clang',
      });
    case 'malleable':
      return r({
        outcome: 'deformed',
        verdict: 'counter',
        threatDamageMult: 1.15,
        towerDamageMult: 0.45,
        slow: 0.7,
        title: `Shockwave absorbed: ${lat.name} deformed instead of shattering`,
        rationale:
          'Layers of positive ions slid over each other, but the delocalised electrons kept attracting every ion. Metallic bonding is non-directional, so the metal bends (malleable) instead of breaking.',
        keywords: ['layers of ions slide', 'malleable', 'non-directional bonding'],
        sfx: 'clang',
      });
    case 'alloy-pinned':
      return r({
        outcome: 'pinned',
        verdict: 'counter',
        threatDamageMult: 2.0,
        towerDamageMult: 0.12,
        slow: 0.6,
        title: `Slip blocked: ${lat.id === 'brass' ? 'substitutional zinc' : 'interstitial carbon'} pinned the layers against ${P}`,
        rationale:
          lat.id === 'brass'
            ? 'Zinc atoms are a different size from copper ions, distorting the regular close-packed layers so they can no longer slide easily — brass is harder than pure copper.'
            : 'Carbon atoms are a different size from iron ions, so they distort the layers. The layers can no longer slide over one another easily — the alloy is much harder and stronger than pure iron.',
        keywords: ['different-sized atoms', 'distort the layers', 'layers cannot slide', 'alloy harder'],
        sfx: 'clang',
      });
    case 'brittle-molecular':
    case 'soft-molecular':
      return r({
        outcome: 'fractured',
        verdict: 'weak',
        threatDamageMult: 0.3,
        towerDamageMult: 3,
        title: `${lat.name} fractured: weak forces between molecules gave way`,
        rationale: `The covalent bonds inside each ${lat.formula} molecule are strong, but the ${
          lat.id === 'ice' ? 'hydrogen bonds' : 'London forces'
        } between molecules are weak and broke under ${P}.`,
        keywords: ['weak intermolecular forces', 'molecules separate'],
        sfx: 'crack',
      });
    case 'flexible-chains':
      return r({
        outcome: 'deformed',
        verdict: 'neutral',
        threatDamageMult: 0.9,
        towerDamageMult: 0.6,
        slow: 0.8,
        title: 'Poly(ethene) stretched: tangled chains slid but held',
        rationale:
          'Long chains are tangled together. The weak forces between chains let them slide and stretch, so the polymer is flexible, not brittle — but it is not strong.',
        keywords: ['long chains', 'weak forces between chains', 'flexible'],
        sfx: 'thud',
      });
  }
}

// ── Solvent ─────────────────────────────────────────────────────────────────

function solvent(lat: LatticeDefinition, t: ThreatSpec): InteractionResult {
  const p = lat.properties;
  const kind = t.solventKind ?? 'polar';

  if (kind === 'nonpolar') {
    if (p.solvent === 'non-polar') {
      return r({
        outcome: 'dissolved',
        verdict: 'weak',
        threatDamageMult: 0.35,
        towerDamageMult: 2.8,
        title: `Dissolved in hexane: non-polar ${lat.formula} matches non-polar C₆H₁₄`,
        rationale: `"Like dissolves like": both ${lat.formula} and hexane are non-polar, so dispersion forces between hexane and ${lat.formula} replace the weak intermolecular forces in the crystal.`,
        keywords: ['like dissolves like', 'non-polar solvent', 'weak intermolecular forces'],
        sfx: 'splash',
      });
    }
    if (p.solvent === 'swells-nonpolar') {
      return r({
        outcome: 'dissolved',
        verdict: 'weak',
        threatDamageMult: 0.45,
        towerDamageMult: 1.9,
        title: 'Polymer swelled: hexane penetrated poly(ethene) chains',
        rationale:
          'Poly(ethene) chains are non-polar and lack covalent cross-links, so non-polar hexane molecules slip between the chains, softening and swelling the barrier.',
        keywords: ['no cross-links', 'non-polar solvent', 'swells polymer'],
        sfx: 'splash',
      });
    }
    return r({
      outcome: 'repelled',
      verdict: 'counter',
      threatDamageMult: 1.25,
      towerDamageMult: 0.05,
      title: `Hexane repelled: ${lat.formula} is insoluble in non-polar solvent`,
      rationale:
        lat.bonding === 'giant-ionic'
          ? 'Non-polar hexane cannot form ion–dipole attractions to pull charged ions out of the ionic lattice.'
          : lat.id === 'ice'
            ? 'Polar hydrogen-bonded water molecules attract each other far more strongly than non-polar hexane ("like dissolves like").'
            : lat.id === 'thermoset'
              ? 'Covalent sulfur cross-links lock the chains together so non-polar solvent molecules cannot separate or swell them.'
              : 'Giant covalent networks and metallic lattices cannot be dissolved by weak dispersion forces from hexane.',
      keywords: ['insoluble in non-polar solvent', 'like dissolves like'],
      sfx: 'splash',
    });
  }

  if (kind === 'acid') {
    if (p.solvent === 'basic-oxide') {
      return r({
        outcome: 'dissolved',
        verdict: 'weak',
        threatDamageMult: 0.45,
        towerDamageMult: 2.4,
        hydrate: true,
        title: 'Acid–base reaction: H⁺ neutralised MgO lattice',
        rationale:
          'Magnesium oxide is a basic metal oxide: MgO(s) + 2H⁺(aq) → Mg²⁺(aq) + H₂O(l). The reaction breaks down the lattice and leaves mobile hydrated ions that conduct.',
        keywords: ['basic oxide', 'neutralisation', 'Mg²⁺ ions freed'],
        sfx: 'splash',
      });
    }
    if (p.solvent === 'dissolves') {
      return r({
        outcome: 'dissolved',
        verdict: 'weak',
        threatDamageMult: 0.4,
        towerDamageMult: 2.4,
        hydrate: true,
        title: `Acidic brine: ${lat.formula} dissolved in aqueous HCl`,
        rationale:
          'Polar water in the aqueous acid pulls Na⁺ and Cl⁻ ions from the lattice; mobile hydrated ions now conduct arcs.',
        keywords: ['aqueous acid', 'ions hydrated', 'solution conducts'],
        sfx: 'splash',
      });
    }
    if (p.solvent === 'corrodes') {
      const rate = lat.id === 'iron' ? 2.2 : 1.5;
      return r({
        outcome: 'corroded',
        verdict: 'weak',
        threatDamageMult: 0.5,
        towerDamageMult: rate,
        title: `Acid attack: ${lat.name} displaced H₂ from HCl(aq)`,
        rationale:
          'Iron lies above hydrogen in the reactivity series, so H⁺ oxidises iron atoms into Fe²⁺(aq) ions and hydrogen gas: Fe + 2H⁺ → Fe²⁺ + H₂.',
        keywords: ['above hydrogen in reactivity series', 'oxidation', 'acid + metal'],
        sfx: 'hiss',
      });
    }
    if (p.solvent === 'inert-metal') {
      return r({
        outcome: 'repelled',
        verdict: 'counter',
        threatDamageMult: 1.25,
        towerDamageMult: lat.id === 'copper' ? 0.08 : 0.2,
        title: `Acid resisted: ${lat.name} is below hydrogen in reactivity`,
        rationale:
          lat.id === 'copper'
            ? 'Copper is below hydrogen in the reactivity series, so it does not react with dilute hydrochloric acid.'
            : 'Brass is predominantly unreactive copper below hydrogen, resisting dilute acid attack far better than iron or steel.',
        keywords: ['below hydrogen in reactivity series', 'unreactive with dilute acid'],
        sfx: 'splash',
      });
    }
    if (p.solvent === 'erodes') {
      return r({
        outcome: 'eroded',
        verdict: 'weak',
        threatDamageMult: 0.5,
        towerDamageMult: 1.6,
        title: 'Ice eroded: aqueous acid melted hydrogen-bonded lattice',
        rationale:
          'Aqueous ions lower the freezing point and disrupt the weak hydrogen bonds holding H₂O molecules in solid ice.',
        keywords: ['freezing-point depression', 'hydrogen bonds broken'],
        sfx: 'splash',
      });
    }
    return r({
      outcome: 'repelled',
      verdict: 'counter',
      threatDamageMult: 1.3,
      towerDamageMult: 0.05,
      title: `Acid repelled: ${lat.name} is chemically unreactive`,
      rationale:
        lat.bonding === 'giant-covalent'
          ? 'Strong covalent bonds throughout the network are unattacked by aqueous H⁺ ions.'
          : 'Non-polar molecules do not react with or dissolve in aqueous acid.',
      keywords: ['chemically inert', 'insoluble in acid'],
      sfx: 'splash',
    });
  }

  switch (p.solvent) {
    case 'dissolves':
    case 'slightly-soluble':
    case 'basic-oxide': {
      const slight = p.solvent === 'slightly-soluble' || p.solvent === 'basic-oxide';
      const [c, a] = lat.id === 'mgo' ? ['Mg²⁺', 'O²⁻'] : ['Na⁺', 'Cl⁻'];
      return r({
        outcome: 'dissolved',
        verdict: slight ? 'neutral' : 'weak',
        threatDamageMult: slight ? 0.8 : 0.4,
        towerDamageMult: slight ? 0.8 : 2.4,
        hydrate: true,
        title: `${lat.formula} ${slight ? 'surface hydrating' : 'dissolving'}: water pulled ions from the lattice`,
        rationale: `Polar water molecules surround the ions — δ− oxygen is attracted to ${c}, δ+ hydrogen to ${a}. Ions are pulled out of the lattice and hydrated.${
          slight ? ' The stronger 2+/2− attraction in MgO makes it only sparingly soluble in pure water.' : ''
        } The wet barrier now contains mobile ions and will conduct.`,
        keywords: ['polar water', 'attracted to ions', 'ions hydrated', 'solution conducts'],
        sfx: 'splash',
      });
    }
    case 'insoluble':
      return r({
        outcome: 'repelled',
        verdict: 'counter',
        threatDamageMult: 1.3,
        towerDamageMult: 0,
        title: `Solvent repelled: ${lat.name} is insoluble`,
        rationale:
          'Attractions to water are far too weak to break the many strong covalent bonds in the giant network, so it does not dissolve.',
        keywords: ['giant covalent', 'insoluble', 'strong covalent bonds'],
        sfx: 'splash',
      });
    case 'inert-metal':
      return r({
        outcome: 'repelled',
        verdict: 'counter',
        threatDamageMult: 1.1,
        towerDamageMult: 0.12,
        title: `Solvent shed: ${lat.name} does not react with water`,
        rationale:
          'Copper sits low in the reactivity series and does not react with water. Metals do not dissolve in water — there are no separate ions or molecules for water to pull away.',
        keywords: ['unreactive metal', 'low in reactivity series', 'insoluble'],
        sfx: 'splash',
      });
    case 'corrodes': {
      const rate = p.corrosionRate ?? 0.5;
      return r({
        outcome: 'corroded',
        verdict: rate > 0.5 ? 'neutral' : 'counter',
        threatDamageMult: 1.0,
        towerDamageMult: rate,
        title: `${lat.name} ${rate > 0.5 ? 'rusting' : 'resisting corrosion'} in the water jet`,
        rationale:
          rate > 0.5
            ? 'Iron does not dissolve, but with water and oxygen present it slowly oxidises to rust (hydrated iron(III) oxide), weakening the barrier.'
            : 'Steel still rusts slowly in water and oxygen, but its alloyed structure holds firm — the barrier takes only light corrosion damage.',
        keywords: ['rusting needs water and oxygen', 'oxidation'],
        sfx: 'splash',
      });
    }
    case 'erodes':
      return r({
        outcome: 'eroded',
        verdict: 'weak',
        threatDamageMult: 0.6,
        towerDamageMult: 1.4,
        title: 'Ice eroding: warm water jet broke hydrogen bonds',
        rationale:
          'The jet transfers energy into the ice surface. Only weak hydrogen bonds hold the H₂O molecules in the lattice, so the surface melts away.',
        keywords: ['hydrogen bonds', 'weak intermolecular forces', 'low melting point'],
        sfx: 'splash',
      });
    case 'non-polar':
    case 'swells-nonpolar':
      return r({
        outcome: 'repelled',
        verdict: 'counter',
        threatDamageMult: lat.id === 'iodine' ? 0.9 : 1.05,
        towerDamageMult: lat.id === 'iodine' ? 0.25 : 0.05,
        title: `Solvent repelled: non-polar ${lat.formula} barely dissolves in water`,
        rationale:
          '"Like dissolves like": water is polar but these molecules are non-polar. Water molecules are more attracted to each other than to the barrier, so it stays undissolved.',
        keywords: ['non-polar', 'like dissolves like', 'insoluble in water'],
        sfx: 'splash',
      });
  }
}

// ── Predictions (shop + inspector) ──────────────────────────────────────────

const REPRESENTATIVE: Record<DamageType, ThreatId> = {
  thermal: 'thermal-wave',
  electrical: 'arc-discharge',
  shear: 'shear-parallel',
  solvent: 'solvent-jet',
};

export function predictMatchups(lat: LatticeDefinition): Record<DamageType, Verdict> {
  const out = {} as Record<DamageType, Verdict>;
  (Object.keys(REPRESENTATIVE) as DamageType[]).forEach((d) => {
    out[d] = resolveInteraction(lat, THREATS[REPRESENTATIVE[d]]).verdict;
  });
  return out;
}

export function matchupTable(lat: LatticeDefinition) {
  return THREAT_ORDER.map((id) => ({ threat: THREATS[id], result: resolveInteraction(lat, THREATS[id]) }));
}
