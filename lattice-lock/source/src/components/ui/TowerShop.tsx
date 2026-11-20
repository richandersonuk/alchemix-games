import { useMemo } from 'react';
import { ArrowUpRight, Info } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { BONDING_META, LATTICES, LATTICE_ORDER } from '../../data/lattices';
import { DAMAGE_META } from '../../data/waves';
import { predictMatchups } from '../../engine/damageCalculator';
import type { BondingType, DamageType, LatticeDefinition } from '../../types/chemistry';
import { DAMAGE_ICON, VERDICT_STYLE } from './damageIcons';

const GROUPS: BondingType[] = ['giant-ionic', 'giant-covalent', 'metallic', 'simple-molecular'];

/** Hotkey order: buildable lattices only. */
export const HOTKEY_LATTICES = LATTICE_ORDER.filter((id) => LATTICES[id].buildable);

export default function TowerShop() {
  useUiTick();
  const predictions = useMemo(
    () => Object.fromEntries(LATTICE_ORDER.map((id) => [id, predictMatchups(LATTICES[id])])),
    [],
  );

  return (
    <aside className="panel pointer-events-auto absolute bottom-3 left-3 top-[4.5rem] flex w-[17.5rem] flex-col overflow-hidden">
      <header className="border-b border-cyan-400/10 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/90">Lattice Foundry</h2>
        <p className="text-[11px] text-slate-400">Click a lattice, then a free tile. Right-click / Esc cancels.</p>
      </header>
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-2">
        {GROUPS.map((g) => (
          <section key={g}>
            <div className="mb-1 flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full" style={{ background: BONDING_META[g].color }} />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BONDING_META[g].color }}>
                {BONDING_META[g].label}
              </h3>
            </div>
            <p className="mb-1.5 px-1 text-[10.5px] leading-snug text-slate-500">{BONDING_META[g].summary}</p>
            <div className="space-y-1.5">
              {LATTICE_ORDER.filter((id) => LATTICES[id].bonding === g).map((id) => (
                <ShopCard key={id} lat={LATTICES[id]} pred={predictions[id]} hotkey={HOTKEY_LATTICES.indexOf(id) + 1} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function ShopCard({ lat, pred, hotkey }: { lat: LatticeDefinition; pred: Record<DamageType, keyof typeof VERDICT_STYLE>; hotkey: number }) {
  const selected = engine.selection.placing === lat.id;
  const affordable = engine.moles >= lat.cost;
  const disabled = !lat.buildable || !affordable || engine.phase === 'victory' || engine.phase === 'defeat';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && engine.setPlacing(selected ? null : lat.id)}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && engine.setPlacing(selected ? null : lat.id)}
      className={`group relative rounded-lg border px-2.5 py-2 transition ${
        selected
          ? 'border-cyan-300/70 bg-cyan-500/15 animate-pulse-ring'
          : disabled
            ? 'cursor-default border-slate-700/40 bg-slate-900/40'
            : 'cursor-pointer border-slate-700/60 bg-slate-900/60 hover:border-cyan-400/40 hover:bg-slate-800/70'
      }`}
    >
      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: lat.accent }} />
      <div className="flex items-start justify-between gap-2">
        <div className={`min-w-0 ${disabled && lat.buildable ? 'opacity-55' : ''}`}>
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-[13px] font-semibold text-slate-100">{lat.name}</span>
            <span className="font-mono text-[10.5px] text-slate-400">{lat.formula}</span>
          </div>
          <p className="text-[10.5px] leading-snug text-slate-400">{lat.tagline}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {lat.buildable ? (
            <span className={`font-mono text-[12px] font-semibold ${affordable ? 'text-cyan-200' : 'text-rose-300'}`}>{lat.cost} mol</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
              <ArrowUpRight className="h-3 w-3" /> via {LATTICES[lat.upgradeFrom!].name}
            </span>
          )}
          <button
            type="button"
            aria-label={`Inspect ${lat.name} unit cell`}
            title="Inspect unit cell (3D)"
            onClick={(e) => {
              e.stopPropagation();
              engine.setInspect(lat.id);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-700/60 hover:text-cyan-200"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        {(Object.keys(pred) as DamageType[]).map((d) => {
          const Icon = DAMAGE_ICON[d];
          return (
            <span key={d} className={`chip ${VERDICT_STYLE[pred[d]].cls}`} title={`${DAMAGE_META[d].label}: ${VERDICT_STYLE[pred[d]].label}`}>
              <Icon className="h-3 w-3" />
            </span>
          );
        })}
        {hotkey > 0 && <span className="ml-auto font-mono text-[10px] text-slate-500">[{hotkey === 10 ? 0 : hotkey}]</span>}
      </div>
    </div>
  );
}
