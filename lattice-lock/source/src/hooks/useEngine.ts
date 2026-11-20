import { useSyncExternalStore } from 'react';
import { engine } from '../engine/waveManager';

/** Re-render on throttled UI ticks (≈10 Hz) and on any selection/structure change. */
export function useUiTick() {
  return useSyncExternalStore(engine.subscribeUi, () => engine.uiVersion);
}

/** Re-render only when towers/threats are added, removed or transformed. */
export function useStructureTick() {
  return useSyncExternalStore(engine.subscribeStructure, () => engine.structureVersion);
}

export { engine };
