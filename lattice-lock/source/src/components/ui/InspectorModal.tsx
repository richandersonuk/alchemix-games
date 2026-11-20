import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BookOpen, ChevronDown, Microscope, RotateCw, X } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { BONDING_META, LATTICES } from '../../data/lattices';
import { matchupTable } from '../../engine/damageCalculator';
import type { LatticeId } from '../../types/chemistry';
import UnitCellMesh from '../canvas/UnitCellMesh';
import { DAMAGE_ICON, VERDICT_STYLE } from './damageIcons';
import { DAMAGE_META } from '../../data/waves';

export default function InspectorModal() {
  useUiTick();
  const id = engine.selection.inspect;
  if (!id) return null;
  return <Inspector key={id} id={id} />;
}

function Inspector({ id }: { id: LatticeId }) {
  const lat = LATTICES[id];
  const cell = useMemo(() => lat.buildCell(), [lat]);
  const table = useMemo(() => matchupTable(lat), [lat]);
  const [highlight, setHighlight] = useState(true);
  const [bonds, setBonds] = useState(true);
  const [electrons, setElectrons] = useState(true);
  const [rotate, setRotate] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const pausedByUs = useRef(false);

  // Pause combat while inspecting mid-wave
  useEffect(() => {
    if (engine.phase === 'wave' && !engine.paused) {
      engine.setPaused(true);
      pausedByUs.current = true;
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && engine.setInspect(null);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (pausedByUs.current) engine.setPaused(false);
    };
  }, []);

  const legend = useMemo(() => {
    const m = new Map<string, { label: string; color: string; count: number }>();
    for (const a of cell.atoms) {
      const k = `${a.element}${a.charge ?? ''}${a.interstitial ? 'i' : ''}`;
      const label = `${a.element}${a.charge ?? ''}${a.interstitial ? ' (interstitial)' : ''}`;
      const e = m.get(k);
      if (e) e.count++;
      else m.set(k, { label, color: a.color, count: 1 });
    }
    return [...m.values()];
  }, [cell]);

  const p = lat.properties;
  const bond = BONDING_META[lat.bonding];

  return (
    <div
      className="hud-safe pointer-events-auto fixed z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onClick={() => engine.setInspect(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${lat.name} unit cell inspector`}
        className="panel flex h-full max-h-[760px] w-full max-w-6xl flex-col overflow-hidden md:grid md:grid-cols-[1.25fr_1fr]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 3D view */}
        <div className="relative h-[42%] min-h-[180px] shrink-0 md:h-auto bg-[radial-gradient(ellipse_at_center,#0c1a2e_0%,#03060c_75%)]">
          <Canvas camera={{ position: [3.2, 2.4, 3.6], fov: 40 }} dpr={[1, 2]}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[4, 6, 3]} intensity={1.6} />
            <pointLight position={[-4, -2, -3]} intensity={0.6} color="#22d3ee" />
            <hemisphereLight args={['#bae6fd', '#0f172a', 0.6]} />
            <UnitCellMesh cell={cell} fitRadius={1.7} detail="high" highlightCoordination={highlight} showBonds={bonds} showElectrons={electrons} />
            <OrbitControls autoRotate={rotate} autoRotateSpeed={1.1} enablePan={false} minDistance={2.5} maxDistance={9} />
          </Canvas>
          <div className="absolute left-3 top-3 flex items-center gap-2 text-xs text-cyan-200/80">
            <Microscope className="h-4 w-4" /> {cell.label}
          </div>
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
            <Toggle on={highlight} set={setHighlight} label="Coordination" disabled={cell.centreAtomId === undefined} />
            <Toggle on={bonds} set={setBonds} label="Bonds" />
            {cell.electronSea && <Toggle on={electrons} set={setElectrons} label="e⁻ sea" />}
            <button type="button" onClick={() => setRotate(!rotate)} className={`chip px-2 py-1 ${rotate ? 'border-cyan-300/50 text-cyan-200' : 'border-slate-600 text-slate-400'}`} title="Auto-rotate">
              <RotateCw className="h-3 w-3" />
            </button>
          </div>
          <div className="absolute bottom-3 left-3 space-y-1 rounded-lg bg-slate-950/70 p-2 text-[11px]">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20" style={{ background: l.color }} />
                <span className="font-mono text-slate-200">{l.label}</span>
                <span className="text-slate-500">×{l.count}</span>
              </div>
            ))}
            <BondKey cellKinds={new Set(cell.bonds.map((b) => b.kind))} />
          </div>
          <p className="absolute bottom-3 right-3 hidden text-[10px] text-slate-500 sm:block">Drag to orbit · scroll or pinch to zoom</p>
        </div>

        {/* Info */}
        <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto border-cyan-400/10 md:border-l">
          <div className="flex items-start justify-between gap-3 border-b border-cyan-400/10 p-4">
            <div>
              <span className="chip mb-1.5" style={{ borderColor: bond.color + '66', color: bond.color }}>
                {bond.label}
              </span>
              <h2 className="text-2xl font-bold text-white">
                {lat.name} <span className="font-mono text-base text-slate-400">{lat.formula}</span>
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{lat.description}</p>
            </div>
            <button type="button" onClick={() => engine.setInspect(null)} className="tap-target -mr-2 -mt-2 shrink-0 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close inspector">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4">
            <div className="col-span-2 rounded-lg border border-amber-300/25 bg-amber-400/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Coordination</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-200">{cell.coordination.number}</span>
                <span className="text-sm text-amber-100/80">{cell.coordination.geometry}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{cell.coordination.detail}</p>
            </div>
            <Stat label={p.phaseChange === 'sublimes' ? 'Sublimes' : 'Melting point'} value={`${p.meltingPointK.toLocaleString()} K`} />
            <Stat label="Thermal conductivity" value={`${p.thermalConductivity} W/m·K`} />
            <Stat label="Conducts (solid)" value={p.conductsSolid ? 'Yes' : 'No'} />
            <Stat label="Hardness (Mohs)" value={String(p.hardnessMohs)} />
            {p.ionCharges && <Stat label="Ion charges" value={p.ionCharges} />}
            <Stat label="Integrity / Power / Range" value={`${lat.stats.maxIntegrity} / ${lat.stats.power} / ${lat.stats.range}`} />
          </div>

          <div className="px-4 pb-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300/80">Predicted threat response</h3>
            <div className="space-y-1">
              {table.map(({ threat, result }, i) => {
                const Icon = DAMAGE_ICON[threat.type];
                const v = VERDICT_STYLE[result.verdict];
                const isOpen = open === i;
                return (
                  <div key={threat.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50">
                    <button type="button" className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left" onClick={() => setOpen(isOpen ? null : i)}>
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: DAMAGE_META[threat.type].color }} />
                      <span className="flex-1 text-[12.5px] text-slate-200">
                        {threat.name} <span className="font-mono text-[10.5px] text-slate-500">{threat.intensity} {threat.unit}</span>
                      </span>
                      <span className={`chip ${v.cls}`}>{result.outcome}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-700/50 px-3 py-2 text-[12px] leading-relaxed text-slate-300">
                        <p className="font-medium text-slate-100">{result.title}</p>
                        <p className="mt-1">{result.rationale}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {result.keywords.map((k) => (
                            <span key={k} className="chip border-cyan-400/30 bg-cyan-500/10 text-cyan-200">{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-300/80">
              <BookOpen className="h-3.5 w-3.5" /> Mark-scheme points
            </h3>
            <ul className="space-y-1.5">
              {lat.examPoints.map((pt) => (
                <li key={pt} className="flex gap-2 text-[12.5px] leading-snug text-slate-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {pt}
                </li>
              ))}
            </ul>
            {lat.upgradeNote && (
              <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2.5 text-[12px] leading-relaxed text-cyan-100/90">
                <strong>Upgrade → {LATTICES[lat.upgradeTo!].name}:</strong> {lat.upgradeNote}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, set, label, disabled }: { on: boolean; set: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => set(!on)}
      className={`chip px-2 py-1 disabled:opacity-30 ${on ? 'border-cyan-300/50 bg-cyan-500/15 text-cyan-100' : 'border-slate-600 bg-slate-900/60 text-slate-400'}`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-sm text-slate-100">{value}</div>
    </div>
  );
}

const BOND_KEY: Record<string, { color: string; label: string; dashed?: boolean }> = {
  covalent: { color: '#e2e8f0', label: 'Covalent bond' },
  ionic: { color: '#94a3b8', label: 'Ionic attraction' },
  metallic: { color: '#fcd34d', label: 'Metallic (to neighbours)' },
  hydrogen: { color: '#60a5fa', label: 'Hydrogen bond', dashed: true },
  intermolecular: { color: '#a78bfa', label: 'Weak intermolecular force', dashed: true },
};

function BondKey({ cellKinds }: { cellKinds: Set<string> }) {
  return (
    <>
      {[...cellKinds].map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-2.5 border-t-2" style={{ borderColor: BOND_KEY[k].color, borderStyle: BOND_KEY[k].dashed ? 'dashed' : 'solid' }} />
          <span className="text-slate-300">{BOND_KEY[k].label}</span>
        </div>
      ))}
    </>
  );
}
