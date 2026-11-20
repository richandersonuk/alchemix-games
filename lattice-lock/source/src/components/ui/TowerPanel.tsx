import { CircleArrowUp, Droplets, Eye, Trash2, X } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { BONDING_META, LATTICES } from '../../data/lattices';

/** Details + actions for the selected barrier on the board. */
export default function TowerPanel() {
  useUiTick();
  const id = engine.selection.towerId;
  const t = id !== null ? engine.towers.find((x) => x.id === id) : undefined;
  if (!t) return null;
  const lat = LATTICES[t.latticeId];
  const next = lat.upgradeTo ? LATTICES[lat.upgradeTo] : null;
  const frac = Math.max(0, t.integrity / lat.stats.maxIntegrity);
  const hydrated = t.hydratedUntil > engine.time;
  const canUpgrade = next && lat.upgradeCost !== undefined && engine.moles >= lat.upgradeCost;
  const bond = BONDING_META[lat.bonding];

  return (
    <section className="panel pointer-events-auto shrink-0 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="chip mb-1" style={{ borderColor: bond.color + '66', color: bond.color }}>
            {bond.label}
          </span>
          <h3 className="text-base font-bold leading-tight text-white">
            {lat.name} <span className="font-mono text-xs text-slate-400">{lat.formula}</span>
          </h3>
        </div>
        <button type="button" aria-label="Deselect" onClick={() => engine.selectTower(null)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-[10.5px] text-slate-400">
          <span>Lattice integrity</span>
          <span className="font-mono">
            {Math.ceil(t.integrity)} / {lat.stats.maxIntegrity}
          </span>
        </div>
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${frac * 100}%`, background: `hsl(${frac * 120} 85% 55%)` }} />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Mini label="Power" value={lat.stats.power} />
        <Mini label="Range" value={lat.stats.range} />
        <Mini label="Neutralised" value={t.neutralised} />
      </div>

      {hydrated && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-sky-400/30 bg-sky-500/10 p-2 text-[11px] leading-snug text-sky-200">
          <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Hydrated: dissolved ions are mobile — this barrier will conduct arcs.
        </p>
      )}
      {t.latticeId === 'diamond' && t.plasmaExposure > 0 && (
        <p className="mt-2 rounded-md border border-violet-400/30 bg-violet-500/10 p-2 text-[11px] text-violet-200">
          Graphitisation: {Math.min(100, Math.round((t.plasmaExposure / 3) * 100))}% sp³ → sp²
        </p>
      )}

      {next && (
        <div className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2">
          <p className="text-[11px] leading-snug text-slate-300">
            <strong className="text-cyan-200">→ {next.name}:</strong> {lat.upgradeNote}
          </p>
          <button type="button" disabled={!canUpgrade} onClick={() => engine.upgradeTower(t.id)} className="btn-primary mt-1.5 w-full py-1 text-xs">
            <CircleArrowUp className="h-3.5 w-3.5" /> Upgrade ({lat.upgradeCost} mol)
          </button>
        </div>
      )}

      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => engine.setInspect(lat.id)} className="btn-ghost flex-1 py-1 text-xs">
          <Eye className="h-3.5 w-3.5" /> Inspect
        </button>
        <button type="button" onClick={() => engine.sellTower(t.id)} className="btn-danger flex-1 py-1 text-xs">
          <Trash2 className="h-3.5 w-3.5" /> Reclaim +{engine.sellValue(t)}
        </button>
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-900/70 px-1 py-1">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-xs text-slate-100">{value}</div>
    </div>
  );
}
