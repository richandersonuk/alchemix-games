import {
  IonId,
  PRECIPITATE_DATA,
  PrecipitateId,
  ReactionEvent,
  ReagentId,
} from '../data/reactions';
import { FilterTile } from '../entities/FilterTile';
import { FluidPacket } from '../entities/FluidPacket';

export class ChemistryEngine {
  public applyReagent(packet: FluidPacket, reagent: ReagentId): ReactionEvent[] {
    const events: ReactionEvent[] = [];
    packet.reagentDoses[reagent] = (packet.reagentDoses[reagent] ?? 0) + 1;

    const naohStrength =
      (packet.reagentDoses['NaOH'] ?? 0) + (packet.reagentDoses['NaOH_excess'] ?? 0) * 2;
    const nh3Strength =
      (packet.reagentDoses['NH3_dilute'] ?? 0) + (packet.reagentDoses['NH3_conc'] ?? 0) * 2;
    const hasConcNH3 = (packet.reagentDoses['NH3_conc'] ?? 0) > 0;

    const addIon = (ion: IonId, delta: number) => {
      packet.dissolvedIons.set(ion, (packet.dissolvedIons.get(ion) ?? 0) + delta);
    };

    const consumeIon = (ion: IonId): number => {
      const amt = packet.dissolvedIons.get(ion) ?? 0;
      if (amt > 0.001) {
        packet.dissolvedIons.delete(ion);
        return amt;
      }
      return 0;
    };

    const addPrecipitate = (ppt: PrecipitateId, delta: number) => {
      packet.precipitates.set(ppt, (packet.precipitates.get(ppt) ?? 0) + delta);
    };

    const consumePrecipitate = (ppt: PrecipitateId): number => {
      const amt = packet.precipitates.get(ppt) ?? 0;
      if (amt > 0.001) {
        packet.precipitates.delete(ppt);
        return amt;
      }
      return 0;
    };

    if (reagent === 'NaOH' || reagent === 'NaOH_excess') {
      // Introduces Na+(aq) spectator cation
      addIon('Na+', 1.5 * packet.volume);

      const hydroxidePairs: Array<[IonId, PrecipitateId]> = [
        ['Cu2+', 'Cu(OH)2'],
        ['Fe2+', 'Fe(OH)2'],
        ['Fe3+', 'Fe(OH)3'],
        ['Mg2+', 'Mg(OH)2'],
        ['Ca2+', 'Ca(OH)2'],
      ];

      for (const [ion, ppt] of hydroxidePairs) {
        const amt = consumeIon(ion);
        if (amt > 0) {
          addPrecipitate(ppt, amt);
          const meta = PRECIPITATE_DATA[ppt];
          events.push({
            summary: `${meta.markSchemeColor}: ${meta.formula} formed.`,
            equation: meta.equation,
            severity: 'reaction',
          });
        }
      }

      // Amphoteric hydroxides: Al3+ and Pb2+, plus Cr3+ redissolution in excess NaOH
      const amphotericConfigs: Array<{
        ion: IonId;
        ppt: PrecipitateId;
        complex: IonId;
        label: string;
        pptFormula: string;
        complexFormula: string;
        directEq: string;
        redissolveEq: string;
      }> = [
        {
          ion: 'Al3+',
          ppt: 'Al(OH)3',
          complex: '[Al(OH)4]-',
          label: 'Al³⁺',
          pptFormula: 'Al(OH)₃(s)',
          complexFormula: '[Al(OH)₄]⁻(aq)',
          directEq: 'Al³⁺(aq) + 4OH⁻(aq) → [Al(OH)₄]⁻(aq)',
          redissolveEq: 'Al(OH)₃(s) + OH⁻(aq) → [Al(OH)₄]⁻(aq)',
        },
        {
          ion: 'Pb2+',
          ppt: 'Pb(OH)2',
          complex: '[Pb(OH)4]2-',
          label: 'Pb²⁺',
          pptFormula: 'Pb(OH)₂(s)',
          complexFormula: '[Pb(OH)₄]²⁻(aq)',
          directEq: 'Pb²⁺(aq) + 4OH⁻(aq) → [Pb(OH)₄]²⁻(aq)',
          redissolveEq: 'Pb(OH)₂(s) + 2OH⁻(aq) → [Pb(OH)₄]²⁻(aq)',
        },
        {
          ion: 'Cr3+',
          ppt: 'Cr(OH)3',
          complex: '[Cr(OH)6]3-',
          label: 'Cr³⁺',
          pptFormula: 'Cr(OH)₃(s)',
          complexFormula: '[Cr(OH)₆]³⁻(aq)',
          directEq: 'Cr³⁺(aq) + 6OH⁻(aq) → [Cr(OH)₆]³⁻(aq)',
          redissolveEq: 'Cr(OH)₃(s) + 3OH⁻(aq) → [Cr(OH)₆]³⁻(aq)',
        },
      ];

      for (const cfg of amphotericConfigs) {
        const ionAmt = consumeIon(cfg.ion);
        if (ionAmt > 0) {
          if (naohStrength >= 2) {
            addIon(cfg.complex, ionAmt);
            events.push({
              summary: `Excess NaOH: ${cfg.label} formed ${cfg.pptFormula} and immediately redissolved into ${cfg.complexFormula}!`,
              equation: cfg.directEq,
              severity: 'reaction',
            });
          } else {
            addPrecipitate(cfg.ppt, ionAmt);
            events.push({
              summary: `${PRECIPITATE_DATA[cfg.ppt].markSchemeColor}: ${cfg.pptFormula} formed (dropwise NaOH).`,
              equation: PRECIPITATE_DATA[cfg.ppt].equation,
              severity: 'reaction',
            });
          }
        }

        if (naohStrength >= 2) {
          const existingPpt = consumePrecipitate(cfg.ppt);
          if (existingPpt > 0) {
            addIon(cfg.complex, existingPpt);
            events.push({
              summary: `Excess NaOH redissolution! ${cfg.pptFormula} dissolved into ${cfg.complexFormula}.`,
              equation: cfg.redissolveEq,
              severity: 'reaction',
            });
          }
        }
      }
    } else if (reagent === 'NH3_dilute' || reagent === 'NH3_conc') {
      // Introduces flame-clean NH4+(aq)
      addIon('NH4+', 1.2 * packet.volume);

      // Precipitates Fe2+, Fe3+, Al3+, Pb2+, Cr3+, Mg2+ (NOT Ca2+!)
      const nh3PrecipPairs: Array<[IonId, PrecipitateId]> = [
        ['Fe2+', 'Fe(OH)2'],
        ['Fe3+', 'Fe(OH)3'],
        ['Al3+', 'Al(OH)3'],
        ['Pb2+', 'Pb(OH)2'],
        ['Cr3+', 'Cr(OH)3'],
        ['Mg2+', 'Mg(OH)2'],
      ];

      for (const [ion, ppt] of nh3PrecipPairs) {
        const amt = consumeIon(ion);
        if (amt > 0) {
          addPrecipitate(ppt, amt);
          const meta = PRECIPITATE_DATA[ppt];
          events.push({
            summary: `${meta.formula} precipitated with aqueous ammonia.`,
            equation: meta.equation,
            severity: 'reaction',
          });
        }
      }

      if ((packet.dissolvedIons.get('Ca2+') ?? 0) > 0.01 && reagent === 'NH3_dilute') {
        events.push({
          summary: `Ca²⁺(aq) stays in solution — no precipitate forms with dilute NH₃(aq)!`,
          equation: 'Ca²⁺(aq) + NH₃(aq) → No precipitate',
          severity: 'reaction',
        });
      }

      // Copper(II) with dilute vs excess/conc NH3
      const cuAmt = consumeIon('Cu2+');
      if (cuAmt > 0) {
        if (nh3Strength >= 2 || hasConcNH3) {
          addIon('[Cu(NH3)4]2+', cuAmt);
          events.push({
            summary: `Excess NH₃ formed deep blue soluble [Cu(NH₃)₄(H₂O)₂]²⁺(aq)!`,
            equation: 'Cu²⁺(aq) + 4NH₃(aq) + 2H₂O(l) → [Cu(NH₃)₄(H₂O)₂]²⁺(aq)',
            severity: 'reaction',
          });
        } else {
          addPrecipitate('Cu(OH)2', cuAmt);
          events.push({
            summary: `Blue gelatinous Cu(OH)₂(s) precipitated (flame-clean NH₄⁺ counter-ion).`,
            equation: 'Cu²⁺(aq) + 2OH⁻(aq) → Cu(OH)₂(s)',
            severity: 'reaction',
          });
        }
      }

      if (nh3Strength >= 2 || hasConcNH3) {
        const existingCuPpt = consumePrecipitate('Cu(OH)2');
        if (existingCuPpt > 0) {
          addIon('[Cu(NH3)4]2+', existingCuPpt);
          events.push({
            summary: `Blue Cu(OH)₂(s) redissolved in excess NH₃ to deep-blue [Cu(NH₃)₄(H₂O)₂]²⁺(aq)!`,
            equation: 'Cu(OH)₂(s) + 4NH₃(aq) + 2H₂O(l) → [Cu(NH₃)₄(H₂O)₂]²⁺(aq) + 2OH⁻(aq)',
            severity: 'reaction',
          });
        }
      }

      // Silver halide confirmation in dilute vs conc NH3
      const agClAmt = consumePrecipitate('AgCl');
      if (agClAmt > 0) {
        addIon('[Ag(NH3)2]+', agClAmt);
        addIon('Cl-', agClAmt);
        events.push({
          summary: `White AgCl(s) dissolved in ${hasConcNH3 ? 'conc.' : 'dilute'} NH₃(aq)!`,
          equation: 'AgCl(s) + 2NH₃(aq) → [Ag(NH₃)₂]⁺(aq) + Cl⁻(aq)',
          severity: 'reaction',
        });
      }

      if (hasConcNH3) {
        const agBrAmt = consumePrecipitate('AgBr');
        if (agBrAmt > 0) {
          addIon('[Ag(NH3)2]+', agBrAmt);
          addIon('Br-', agBrAmt);
          events.push({
            summary: `Cream AgBr(s) dissolved in concentrated NH₃(aq)!`,
            equation: 'AgBr(s) + 2NH₃(conc) → [Ag(NH₃)₂]⁺(aq) + Br⁻(aq)',
            severity: 'reaction',
          });
        }
      } else if ((packet.precipitates.get('AgBr') ?? 0) > 0.01) {
        events.push({
          summary: `Cream AgBr(s) remained insoluble in dilute NH₃(aq).`,
          equation: 'AgBr(s) + dil. NH₃(aq) → Insoluble',
          severity: 'reaction',
        });
      }

      if ((packet.precipitates.get('AgI') ?? 0) > 0.01) {
        events.push({
          summary: `Yellow AgI(s) remained completely insoluble in ${hasConcNH3 ? 'concentrated' : 'dilute'} NH₃(aq).`,
          equation: 'AgI(s) + NH₃(aq) → Insoluble',
          severity: 'reaction',
        });
      }
    } else if (reagent === 'HCl') {
      // Introduces Cl-(aq)!
      const pbAmt = consumeIon('Pb2+');
      if (pbAmt > 0) {
        addPrecipitate('PbCl2', pbAmt);
        events.push({
          summary: `White precipitate PbCl₂(s) formed with chloride ions.`,
          equation: PRECIPITATE_DATA.PbCl2.equation,
          severity: 'reaction',
        });
      }
      addIon('Cl-', 1.0 * packet.volume);

      const co3Amt = consumeIon('CO3_2-');
      if (co3Amt > 0) {
        packet.evolvedGases.set('CO2', (packet.evolvedGases.get('CO2') ?? 0) + co3Amt);
        events.push({
          summary: `Vigorous effervescence! Carbonate reacted with H⁺ to evolve CO₂(g) bubbles.`,
          equation: 'CO₃²⁻(aq) + 2H⁺(aq) → CO₂(g)↑ + H₂O(l)',
          severity: 'reaction',
        });
      }

      // Acid redissolves basic metal hydroxides if added downstream
      const basicHydroxides: Array<[PrecipitateId, IonId]> = [
        ['Cu(OH)2', 'Cu2+'],
        ['Fe(OH)2', 'Fe2+'],
        ['Fe(OH)3', 'Fe3+'],
        ['Al(OH)3', 'Al3+'],
        ['Pb(OH)2', 'Pb2+'],
        ['Cr(OH)3', 'Cr3+'],
        ['Mg(OH)2', 'Mg2+'],
        ['Ca(OH)2', 'Ca2+'],
        ['BaCO3', 'Ba2+'],
      ];
      for (const [ppt, ion] of basicHydroxides) {
        const amt = consumePrecipitate(ppt);
        if (amt > 0) {
          addIon(ion, amt);
          events.push({
            summary: `Dilute HCl neutralised and dissolved ${PRECIPITATE_DATA[ppt].formula}.`,
            equation: `${PRECIPITATE_DATA[ppt].formula} + H⁺(aq) → ${ion}(aq) + H₂O(l)`,
            severity: 'warning',
          });
        }
      }
    } else if (reagent === 'AgNO3') {
      // Acidified with dilute HNO3 -> removes CO3_2- cleanly without adding Cl-
      addIon('NO3-', 1.2 * packet.volume);

      const co3Amt = consumeIon('CO3_2-');
      if (co3Amt > 0) {
        packet.evolvedGases.set('CO2', (packet.evolvedGases.get('CO2') ?? 0) + co3Amt);
        events.push({
          summary: `Dilute HNO₃ in acidified AgNO₃ decomposed CO₃²⁻ → CO₂(g)↑ (preventing false Ag₂CO₃ precipitate).`,
          equation: 'CO₃²⁻(aq) + 2H⁺(HNO₃) → CO₂(g)↑ + H₂O(l)',
          severity: 'reaction',
        });
      }

      const addedHClUpstream =
        (packet.reagentDoses['HCl'] ?? 0) > 0 || (packet.reagentDoses['BaCl2'] ?? 0) > 0;

      const clAmt = consumeIon('Cl-');
      if (clAmt > 0) {
        addPrecipitate('AgCl', clAmt);
        if (addedHClUpstream) {
          events.push({
            summary: `MARK-SCHEME ERROR: Cl⁻ introduced by upstream HCl / BaCl₂ caused a false-positive white AgCl(s) precipitate!`,
            equation: 'Ag⁺(aq) + Cl⁻(from HCl/BaCl₂) → AgCl(s)',
            severity: 'error',
          });
        } else {
          events.push({
            summary: `White curdy precipitate AgCl(s) formed.`,
            equation: PRECIPITATE_DATA.AgCl.equation,
            severity: 'reaction',
          });
        }
      }

      const brAmt = consumeIon('Br-');
      if (brAmt > 0) {
        addPrecipitate('AgBr', brAmt);
        events.push({
          summary: `Cream precipitate AgBr(s) formed.`,
          equation: PRECIPITATE_DATA.AgBr.equation,
          severity: 'reaction',
        });
      }

      const iAmt = consumeIon('I-');
      if (iAmt > 0) {
        addPrecipitate('AgI', iAmt);
        events.push({
          summary: `Yellow precipitate AgI(s) formed.`,
          equation: PRECIPITATE_DATA.AgI.equation,
          severity: 'reaction',
        });
      }
    } else if (reagent === 'BaCl2') {
      // Acidified BaCl2 (with dilute HCl)
      const pbAmt = consumeIon('Pb2+');
      if (pbAmt > 0) {
        addPrecipitate('PbCl2', pbAmt);
        events.push({
          summary: `White precipitate PbCl₂(s) formed from Cl⁻ in acidified BaCl₂.`,
          equation: PRECIPITATE_DATA.PbCl2.equation,
          severity: 'reaction',
        });
      }
      addIon('Cl-', 1.2 * packet.volume);

      const co3Amt = consumeIon('CO3_2-');
      if (co3Amt > 0) {
        packet.evolvedGases.set('CO2', (packet.evolvedGases.get('CO2') ?? 0) + co3Amt);
        events.push({
          summary: `Acidified BaCl₂ decomposed CO₃²⁻ → CO₂(g)↑ (preventing false BaCO₃ precipitate).`,
          equation: 'CO₃²⁻(aq) + 2H⁺(aq) → CO₂(g)↑ + H₂O(l)',
          severity: 'reaction',
        });
      }

      const so4Amt = consumeIon('SO4_2-');
      if (so4Amt > 0) {
        addPrecipitate('BaSO4', so4Amt);
        events.push({
          summary: `Dense white precipitate BaSO₄(s) formed!`,
          equation: PRECIPITATE_DATA.BaSO4.equation,
          severity: 'reaction',
        });
      } else {
        // Excess unreacted Ba2+ remains if injected into sulfate-free stream
        addIon('Ba2+', 0.8 * packet.volume);
      }
    } else if (reagent === 'KI') {
      addIon('K+', 1.2 * packet.volume);

      const pbAmt = consumeIon('Pb2+');
      if (pbAmt > 0) {
        addPrecipitate('PbI2', pbAmt);
        events.push({
          summary: `Bright yellow precipitate PbI₂(s) formed ("Golden Rain" test)!`,
          equation: PRECIPITATE_DATA.PbI2.equation,
          severity: 'reaction',
        });
      } else {
        const agAmt = consumeIon('Ag+');
        if (agAmt > 0) {
          addPrecipitate('AgI', agAmt);
          events.push({
            summary: `Yellow precipitate AgI(s) formed.`,
            equation: PRECIPITATE_DATA.AgI.equation,
            severity: 'reaction',
          });
        } else {
          addIon('I-', 1.0 * packet.volume);
        }
      }
    }

    if (!packet.hasPrecipitates()) {
      packet.slurrySteps = 0;
    }

    packet.recalculateColor();
    return events;
  }

  public applyFilter(packet: FluidPacket, filter: FilterTile, minPurity = 90): ReactionEvent[] {
    const events: ReactionEvent[] = [];
    const retainedNames: string[] = [];

    for (const [ppt, amt] of packet.precipitates.entries()) {
      if (amt > 0.001) {
        filter.capturePrecipitate(ppt, amt);
        retainedNames.push(PRECIPITATE_DATA[ppt].formula);
      }
    }

    packet.precipitates.clear();
    packet.slurrySteps = 0;
    packet.recalculateColor();

    if (retainedNames.length > 0) {
      const dom = filter.getDominantPrecipitate();
      if (dom.purity < minPurity) {
        events.push({
          summary: `CO-PRECIPITATION WARNING: Filter Bed (${filter.x + 1},${filter.y + 1}) trapped mixed solids (${retainedNames.join(' + ')}) — purity ${dom.purity}% (<${minPurity}%)!`,
          equation: 'Separate ions selectively before filtration',
          severity: 'error',
        });
      } else {
        events.push({
          summary: `Filter Bed (${filter.x + 1},${filter.y + 1}) isolated pure ${retainedNames.join(', ')}; clear supernatant flows onward.`,
          equation: `${retainedNames[0]} retained (${dom.purity}% purity)`,
          severity: 'reaction',
        });
      }
    }

    return events;
  }
}
