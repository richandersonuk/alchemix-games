import type { SpeciesTerm, StateNodeData, VectorArrow } from '../types/energetics.ts';

export interface StoichiometryCheckResult {
  balanced: boolean;
  reason?: string;
  suggestedMultiplier?: number;
  isStateMismatch?: boolean;
}

export function speciesKey(term: SpeciesTerm): string {
  return `${term.formula}(${term.state})`;
}

export function computeNodeSpeciesMap(node: StateNodeData): Record<string, number> {
  const map: Record<string, number> = {};
  for (const term of node.species) {
    const key = speciesKey(term);
    map[key] = (map[key] ?? 0) + term.moles;
  }
  return map;
}

/**
 * Returns the molar species difference (toNode - fromNode) across all chemical species.
 */
export function computeNodeSpeciesDelta(
  fromNode: StateNodeData,
  toNode: StateNodeData
): Record<string, number> {
  const fromMap = computeNodeSpeciesMap(fromNode);
  const toMap = computeNodeSpeciesMap(toNode);
  const keys = new Set([...Object.keys(fromMap), ...Object.keys(toMap)]);
  const delta: Record<string, number> = {};
  for (const key of keys) {
    const diff = (toMap[key] ?? 0) - (fromMap[key] ?? 0);
    if (Math.abs(diff) > 1e-6) {
      delta[key] = diff;
    }
  }
  return delta;
}

function stripState(key: string): string {
  const idx = key.lastIndexOf('(');
  return idx >= 0 ? key.slice(0, idx) : key;
}

/**
 * Validates that a placed EnthalpyVector (with its current reversed flag & multiplier)
 * balances all chemical species and state symbols between fromNode and toNode.
 */
export function validateEdgeStoichiometry(
  vector: VectorArrow,
  fromNode: StateNodeData,
  toNode: StateNodeData
): StoichiometryCheckResult {
  const actualDelta = computeNodeSpeciesDelta(fromNode, toNode);
  const sign = vector.reversed ? -1 : 1;
  const expectedDelta: Record<string, number> = {};

  for (const [key, unitAmount] of Object.entries(vector.unitSpeciesDelta)) {
    const scaled = sign * vector.multiplier * unitAmount;
    if (Math.abs(scaled) > 1e-6) {
      expectedDelta[key] = scaled;
    }
  }

  const allKeys = new Set([...Object.keys(actualDelta), ...Object.keys(expectedDelta)]);
  const mismatchedKeys: string[] = [];

  for (const key of allKeys) {
    const a = actualDelta[key] ?? 0;
    const e = expectedDelta[key] ?? 0;
    if (Math.abs(a - e) > 1e-5) {
      mismatchedKeys.push(key);
    }
  }

  if (mismatchedKeys.length === 0) {
    return { balanced: true };
  }

  // Detect state-symbol mismatch (same formula, different state symbol)
  const actualFormulas = new Map<string, string>();
  const expectedFormulas = new Map<string, string>();
  for (const key of Object.keys(actualDelta)) {
    actualFormulas.set(stripState(key), key);
  }
  for (const key of Object.keys(expectedDelta)) {
    expectedFormulas.set(stripState(key), key);
  }
  for (const [formula, actualKey] of actualFormulas.entries()) {
    const expectedKey = expectedFormulas.get(formula);
    if (expectedKey && expectedKey !== actualKey) {
      return {
        balanced: false,
        isStateMismatch: true,
        reason: `Standard state mismatch for ${formula}: expected ${expectedKey} but node contains ${actualKey}.`,
      };
    }
  }

  // Infer required integer multiplier if actualDelta is a clean positive multiple of unitSpeciesDelta
  let inferredMultiplier: number | undefined;
  const ratios: number[] = [];
  for (const [key, unitVal] of Object.entries(vector.unitSpeciesDelta)) {
    const signedUnit = sign * unitVal;
    const act = actualDelta[key] ?? 0;
    if (Math.abs(signedUnit) > 1e-6) {
      ratios.push(act / signedUnit);
    }
  }
  if (ratios.length > 0 && ratios.every((r) => r > 0 && Math.abs(r - Math.round(r)) < 1e-4 && Math.abs(r - ratios[0]) < 1e-4)) {
    const rounded = Math.round(ratios[0]);
    if (rounded >= 1 && rounded <= 10) {
      inferredMultiplier = rounded;
    }
  }

  if (inferredMultiplier !== undefined && inferredMultiplier !== vector.multiplier) {
    return {
      balanced: false,
      suggestedMultiplier: inferredMultiplier,
      reason: `Stoichiometry mismatch on ${vector.symbol}: set multiplier to ×${inferredMultiplier} (currently ×${vector.multiplier}) to balance the moles between states.`,
    };
  }

  return {
    balanced: false,
    reason: `Molar balance mismatch on ${vector.symbol} (${mismatchedKeys.join(', ')}). Check arrow direction and multiplier (currently ×${vector.multiplier}).`,
  };
}
