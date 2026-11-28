import type {
  CycleScenario,
  EquationPreviewState,
  EvaluationResult,
  MarkSchemeStep,
  StateNodeData,
  ThermalSign,
  VectorArrow,
} from '../types/energetics.ts';
import { validateEdgeStoichiometry } from './Stoichiometry.ts';

export function getEffectiveFromId(vector: VectorArrow): string {
  return vector.reversed ? vector.standardToId : vector.standardFromId;
}

export function getEffectiveToId(vector: VectorArrow): string {
  return vector.reversed ? vector.standardFromId : vector.standardToId;
}

export function getEffectiveDeltaH(vector: VectorArrow): number {
  const sign = vector.reversed ? -1 : 1;
  return roundOneDecimal(sign * vector.multiplier * vector.baseDeltaH);
}

export function roundOneDecimal(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatSignedDeltaH(value: number): string {
  const rounded = roundOneDecimal(value);
  const absStr = Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${absStr}`;
  if (rounded < 0) return `−${absStr}`;
  return '0.0';
}

function findSimpleUndirectedPath(
  sourceId: string,
  targetId: string,
  vectors: VectorArrow[]
): VectorArrow[] | null {
  if (vectors.length === 0) return null;
  const visitedNodes = new Set<string>([sourceId]);
  const usedVectors = new Set<string>();
  const currentPath: VectorArrow[] = [];

  function dfs(currentNodeId: string): boolean {
    if (currentNodeId === targetId) {
      return currentPath.length > 0;
    }
    for (const vec of vectors) {
      if (usedVectors.has(vec.id)) continue;
      let neighbor: string | null = null;
      if (vec.standardFromId === currentNodeId) neighbor = vec.standardToId;
      else if (vec.standardToId === currentNodeId) neighbor = vec.standardFromId;
      if (!neighbor || visitedNodes.has(neighbor)) continue;

      visitedNodes.add(neighbor);
      usedVectors.add(vec.id);
      currentPath.push(vec);
      if (dfs(neighbor)) return true;
      currentPath.pop();
      usedVectors.delete(vec.id);
      visitedNodes.delete(neighbor);
    }
    return false;
  }

  return dfs(sourceId) ? [...currentPath] : null;
}

function getThermalSign(deltaH: number): ThermalSign {
  if (deltaH < -0.05) return 'exothermic';
  if (deltaH > 0.05) return 'endothermic';
  return 'neutral';
}

function buildMarkSchemeSteps(
  scenario: CycleScenario,
  orderedRoute: VectorArrow[],
  calculatedDeltaH: number,
  routeSum: number,
  targetDivisor: number
): MarkSchemeStep[] {
  const step2Lines = orderedRoute.map((vec) => {
    const eff = getEffectiveDeltaH(vec);
    const multTag = vec.multiplier > 1 ? `${vec.multiplier} × ` : '';
    const flipTag = vec.reversed ? '−' : '+';
    const baseStr = formatSignedDeltaH(vec.baseDeltaH);
    const effStr = formatSignedDeltaH(eff);
    const reasonNote = vec.reversed ? ' (arrow reversed: sign inverted)' : '';
    return `${flipTag}${multTag}(${baseStr}) = ${effStr} kJ mol⁻¹ for ${vec.symbol}${reasonNote}`;
  });

  const thermalWord =
    calculatedDeltaH < 0 ? 'Exothermic (ΔH < 0)' : calculatedDeltaH > 0 ? 'Endothermic (ΔH > 0)' : 'Thermoneutral';

  const m3Detail =
    targetDivisor > 1
      ? `Cycle sum = ${formatSignedDeltaH(routeSum)} kJ for ${targetDivisor} mol; ÷ ${targetDivisor} = ${formatSignedDeltaH(calculatedDeltaH)} kJ mol⁻¹ (${thermalWord}). Target ${scenario.targetLabel} = ${formatSignedDeltaH(scenario.targetDeltaH)} kJ mol⁻¹.`
      : `Indirect route sum = ${formatSignedDeltaH(calculatedDeltaH)} kJ mol⁻¹ (${thermalWord}). Direct target ${scenario.targetLabel} = ${formatSignedDeltaH(scenario.targetDeltaH)} kJ mol⁻¹ → Net loop = 0.0 kJ mol⁻¹.`;

  return [
    {
      code: 'M1',
      title: 'Thermochemical Cycle & Standard States',
      detail: scenario.m1Rule,
    },
    {
      code: 'M2',
      title: 'Vector Direction & Stoichiometry',
      detail: step2Lines.join(' · '),
    },
    {
      code: 'M3',
      title: targetDivisor > 1 ? 'Per-Mole Division & Verification' : 'Closed-Loop Verification (ΣΔH = 0)',
      detail: m3Detail,
    },
  ];
}

export function evaluateCircuit(
  scenario: CycleScenario,
  vectors: VectorArrow[],
  attemptsCount = 1,
  targetDivisor = 1
): EvaluationResult {
  const nodeMap = new Map<string, StateNodeData>(
    scenario.nodes.map((node) => [node.id, node])
  );

  // 1. Check for any state-symbol / latent-heat trap vectors or trap nodes
  for (const vec of vectors) {
    const fromNode = nodeMap.get(vec.standardFromId);
    const toNode = nodeMap.get(vec.standardToId);
    if (vec.isTrap || fromNode?.role === 'trap' || toNode?.role === 'trap') {
      const trapNode = fromNode?.role === 'trap' ? fromNode : toNode?.role === 'trap' ? toNode : undefined;
      return {
        valid: false,
        calculatedDeltaH: null,
        netLoopDeltaH: null,
        thermalSign: 'neutral',
        orderedRoute: [],
        fault: {
          type: 'state_symbol_trap',
          headline: 'Standard State / Latent Heat Trap Triggered',
          detail:
            vec.trapMessage ??
            trapNode?.trapReason ??
            'A wired state violates 298 K, 100 kPa standard state conventions. Cut the trap conduit and route via the true standard state.',
          offendingVectorId: vec.id,
          offendingNodeId: trapNode?.id,
        },
        markSchemeSteps: [],
        starsAwarded: 0,
      };
    }
  }

  // 2. Discover undirected chain connecting START to TARGET
  const undirectedPath = findSimpleUndirectedPath(
    scenario.sourceNodeId,
    scenario.targetNodeId,
    vectors
  );

  if (!undirectedPath) {
    const sourceNode = nodeMap.get(scenario.sourceNodeId);
    const targetNode = nodeMap.get(scenario.targetNodeId);
    return {
      valid: false,
      calculatedDeltaH: null,
      netLoopDeltaH: null,
      thermalSign: 'neutral',
      orderedRoute: [],
      fault: {
        type: 'open_circuit',
        headline: 'Open Switchboard Circuit',
        detail: `No continuous pathway connects ${sourceNode?.formulaText ?? 'START'} to ${targetNode?.formulaText ?? 'TARGET'}. Drag between state nodes through the intermediate states to close the Hess loop.`,
      },
      markSchemeSteps: [],
      starsAwarded: 0,
    };
  }

  // Check for extraneous stray wires not on the connecting path
  const pathVectorIds = new Set(undirectedPath.map((v) => v.id));
  const strayVector = vectors.find((v) => !pathVectorIds.has(v.id));
  if (strayVector) {
    return {
      valid: false,
      calculatedDeltaH: null,
      netLoopDeltaH: null,
      thermalSign: 'neutral',
      orderedRoute: undirectedPath,
      fault: {
        type: 'open_circuit',
        headline: 'Short-Circuit / Stray Wire Detected',
        detail: `Remove the extra wire (${strayVector.symbol}) that is not part of your active route from START to TARGET.`,
        offendingVectorId: strayVector.id,
      },
      markSchemeSteps: [],
      starsAwarded: 0,
    };
  }

  // 3. Walk along the route and verify vector arrow direction & sign inversion
  let cursor = scenario.sourceNodeId;
  for (const vec of undirectedPath) {
    const currentFrom = getEffectiveFromId(vec);
    const currentTo = getEffectiveToId(vec);

    if (currentFrom !== cursor) {
      const cursorNode = nodeMap.get(cursor);
      return {
        valid: false,
        calculatedDeltaH: null,
        netLoopDeltaH: null,
        thermalSign: 'neutral',
        orderedRoute: undirectedPath,
        fault: {
          type: 'direction_mismatch',
          headline: 'Opposing Vector Arrowhead!',
          detail: `At ${cursorNode?.formulaText ?? cursor}, the arrow for ${vec.symbol} points AGAINST your indirect route. Tap that arrow to flip its direction and invert its sign (−ΔH).`,
          offendingVectorId: vec.id,
          offendingNodeId: cursor,
        },
        markSchemeSteps: [],
        starsAwarded: 0,
      };
    }

    const fromNode = nodeMap.get(currentFrom);
    const toNode = nodeMap.get(currentTo);
    if (!fromNode || !toNode) {
      return {
        valid: false,
        calculatedDeltaH: null,
        netLoopDeltaH: null,
        thermalSign: 'neutral',
        orderedRoute: undirectedPath,
        fault: {
          type: 'open_circuit',
          headline: 'Disconnected Node Reference',
          detail: 'Reset the switchboard and rewire the cycle.',
          offendingVectorId: vec.id,
        },
        markSchemeSteps: [],
        starsAwarded: 0,
      };
    }

    // 4. Validate stoichiometry along this directed transition
    const stoich = validateEdgeStoichiometry(vec, fromNode, toNode);
    if (!stoich.balanced) {
      return {
        valid: false,
        calculatedDeltaH: null,
        netLoopDeltaH: null,
        thermalSign: 'neutral',
        orderedRoute: undirectedPath,
        fault: {
          type: stoich.isStateMismatch ? 'state_symbol_trap' : 'stoichiometry_mismatch',
          headline: stoich.isStateMismatch ? 'State Symbol Mismatch' : 'Stoichiometric Scaling Error',
          detail:
            stoich.reason ??
            `Adjust the mole multiplier on ${vec.symbol} to balance the chemical equation.`,
          offendingVectorId: vec.id,
        },
        markSchemeSteps: [],
        starsAwarded: 0,
      };
    }

    cursor = currentTo;
  }

  // 5. Sum effective enthalpies, apply per-mole target divisor, and verify closed loop
  const routeSum = roundOneDecimal(
    undirectedPath.reduce((acc, vec) => acc + getEffectiveDeltaH(vec), 0)
  );
  const requiredDivisor = scenario.targetMoles ?? 1;

  if (targetDivisor !== requiredDivisor) {
    const scaled = roundOneDecimal(routeSum / targetDivisor);
    return {
      valid: false,
      calculatedDeltaH: scaled,
      routeTotalDeltaH: routeSum,
      targetDivisorUsed: targetDivisor,
      netLoopDeltaH: null,
      thermalSign: getThermalSign(scaled),
      orderedRoute: undirectedPath,
      fault: {
        type: 'stoichiometry_mismatch',
        headline: 'Target Per-Mole Divisor Needed!',
        detail: `The balanced cycle solves for ${requiredDivisor} mol (total ${formatSignedDeltaH(routeSum)} kJ), whereas ${scenario.targetLabel} is defined per 1 mol. Tap the gold target busbar or bottom strip to set ÷${requiredDivisor}.`,
        isTargetDivisorFault: true,
      },
      markSchemeSteps: [],
      starsAwarded: 0,
    };
  }

  const calculatedDeltaH = roundOneDecimal(routeSum / requiredDivisor);
  const netLoopDeltaH = roundOneDecimal(calculatedDeltaH - scenario.targetDeltaH);

  if (Math.abs(netLoopDeltaH) > 0.15) {
    return {
      valid: false,
      calculatedDeltaH,
      routeTotalDeltaH: routeSum,
      targetDivisorUsed: requiredDivisor,
      netLoopDeltaH,
      thermalSign: getThermalSign(calculatedDeltaH),
      orderedRoute: undirectedPath,
      fault: {
        type: 'math_imbalance',
        headline: 'Hess Loop Does Not Sum to Zero',
        detail: `Your pathway evaluates to ${formatSignedDeltaH(calculatedDeltaH)} kJ mol⁻¹, leaving a residual of ${formatSignedDeltaH(netLoopDeltaH)} kJ mol⁻¹ against ${scenario.targetLabel}.`,
      },
      markSchemeSteps: [],
      starsAwarded: 0,
    };
  }

  const starsAwarded: 1 | 2 | 3 = attemptsCount <= 1 ? 3 : attemptsCount === 2 ? 2 : 1;

  return {
    valid: true,
    calculatedDeltaH,
    routeTotalDeltaH: routeSum,
    targetDivisorUsed: requiredDivisor,
    netLoopDeltaH: 0,
    thermalSign: getThermalSign(calculatedDeltaH),
    orderedRoute: undirectedPath,
    markSchemeSteps: buildMarkSchemeSteps(
      scenario,
      undirectedPath,
      calculatedDeltaH,
      routeSum,
      requiredDivisor
    ),
    starsAwarded,
  };
}

/**
 * Generates the live monospace arithmetic expression shown in Zone 2 (EquationPreview).
 */
export function buildEquationPreview(
  scenario: CycleScenario,
  vectors: VectorArrow[],
  targetDivisor = 1
): EquationPreviewState {
  if (vectors.length === 0) {
    return {
      expression: `${scenario.targetLabel} = [ Drag between nodes to wire route ]`,
      numericSumText: '?',
      status: 'empty',
      statusLabel: 'WIRE NODES',
    };
  }

  const hasTrap = vectors.some((v) => v.isTrap);
  const undirectedPath = findSimpleUndirectedPath(
    scenario.sourceNodeId,
    scenario.targetNodeId,
    vectors
  );

  // Order terms along the route if connected, otherwise in placement order
  const ordered = undirectedPath ?? vectors;
  const nodeMap = new Map(scenario.nodes.map((n) => [n.id, n]));

  let hasOpposingArrow = false;
  let hasStoichMismatch = false;

  if (undirectedPath) {
    let cursor = scenario.sourceNodeId;
    for (const vec of undirectedPath) {
      const fromId = getEffectiveFromId(vec);
      const toId = getEffectiveToId(vec);
      if (fromId !== cursor) {
        hasOpposingArrow = true;
        cursor = vec.standardFromId === cursor ? vec.standardToId : vec.standardFromId;
      } else {
        const fromNode = nodeMap.get(fromId);
        const toNode = nodeMap.get(toId);
        if (fromNode && toNode && !validateEdgeStoichiometry(vec, fromNode, toNode).balanced) {
          hasStoichMismatch = true;
        }
        cursor = toId;
      }
    }
  }

  const parts = ordered.map((vec) => {
    const baseStr = formatSignedDeltaH(vec.baseDeltaH);
    const prefix = vec.reversed ? '−' : '';
    const mult = vec.multiplier > 1 ? `${vec.multiplier}×` : '';
    return `[${prefix}${mult}(${baseStr})]`;
  });

  const rawSum = roundOneDecimal(
    ordered.reduce((acc, vec) => acc + getEffectiveDeltaH(vec), 0)
  );
  const requiredDivisor = scenario.targetMoles ?? 1;
  const sum = roundOneDecimal(rawSum / targetDivisor);
  const sumStr = `${formatSignedDeltaH(sum)} kJ mol⁻¹`;
  const joinedTerms = targetDivisor > 1 ? `(${parts.join(' + ')}) ÷ ${targetDivisor}` : parts.join(' + ');

  if (hasTrap) {
    return {
      expression: `${joinedTerms} = ${sumStr}`,
      numericSumText: sumStr,
      status: 'trap',
      statusLabel: 'STATE TRAP',
    };
  }

  if (!undirectedPath) {
    return {
      expression: `${parts.join(' + ')} + …`,
      numericSumText: sumStr,
      status: 'partial',
      statusLabel: 'OPEN LOOP',
    };
  }

  if (hasOpposingArrow) {
    return {
      expression: `${joinedTerms} = ${sumStr}`,
      numericSumText: sumStr,
      status: 'opposing',
      statusLabel: 'FLIP ARROW',
    };
  }

  if (hasStoichMismatch) {
    return {
      expression: `${joinedTerms} = ${sumStr}`,
      numericSumText: sumStr,
      status: 'partial',
      statusLabel: 'CHECK ×MOLES',
    };
  }

  if (targetDivisor !== requiredDivisor) {
    return {
      expression: `${joinedTerms} = ${sumStr}`,
      numericSumText: sumStr,
      status: 'partial',
      statusLabel: 'SET ÷MOLES',
    };
  }

  return {
    expression: `${joinedTerms} = ${sumStr}`,
    numericSumText: sumStr,
    status: 'ready',
    statusLabel: 'LOOP READY',
  };
}
