import { useEffect, useMemo, useRef, useState } from 'react';
import { Atom, Check, ChevronUp, CircleCheck, CircleX, FastForward, GraduationCap, Info, Lightbulb, Menu, Pause, Play, ScrollText, Shield, TriangleAlert, Waves, X } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { BONDING_META, LATTICES, LATTICE_ORDER } from '../../data/lattices';
import { DAMAGE_META, THREATS, WAVES } from '../../data/waves';
import { predictMatchups } from '../../engine/damageCalculator';
import { CORE_MAX } from '../../engine/waveManager';
import type { DamageType, LogEntry } from '../../types/chemistry';
import { DAMAGE_ICON, VERDICT_STYLE } from './damageIcons';
import ExamLogHUD from './ExamLogHUD';

// ─────────────────────────────────────────────────────────────────────────────
// Touch-first HUD for phones and tablets (portrait + landscape).
// ─────────────────────────────────────────────────────────────────────────────


export function CompactTopBar({ onMenu, onLog, unread }: { onMenu: () => void; onLog: () => void; unread: boolean }) {
  useUiTick();
  const core = engine.core / CORE_MAX;
  return (
    <header className="pointer-events-auto flex h-11 items-center gap-1.5">
      <button type="button" onClick={onMenu} className="panel tap-target shrink-0 text-slate-200" aria-label="Pause menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="panel flex h-full min-w-0 flex-1 items-center gap-3 px-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5" title="Core integrity">
          <Shield className={`h-4 w-4 shrink-0 ${core < 0.35 ? 'text-rose-400' : 'text-cyan-300'}`} />
          <div className="h-1.5 min-w-[2.5rem] flex-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${core * 100}%`, background: `hsl(${core * 185} 85% 55%)` }} />
          </div>
          <span className="font-mono text-[11px] text-slate-300">{Math.ceil(engine.core)}</span>
        </div>
        <Chip icon={<Atom className="h-3.5 w-3.5 text-amber-300" />} value={`${Math.floor(engine.moles)}`} label="moles" />
        <Chip icon={<Waves className="h-3.5 w-3.5 text-rose-300" />} value={engine.overtime ? `OT ${engine.waveIndex + 1}` : `${Math.min(engine.waveIndex + 1, WAVES.length)}/${WAVES.length}`} label="wave" />
        <Chip icon={<GraduationCap className="h-3.5 w-3.5 text-emerald-300" />} value={String(engine.marks)} label="marks" />
      </div>
      <button type="button" onClick={onLog} className="panel tap-target relative shrink-0 text-cyan-200" aria-label="Open failure log">
        <ScrollText className="h-5 w-5" />
        {unread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-400" />}
      </button>
    </header>
  );
}

function Chip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono text-[12px] font-semibold text-slate-100" aria-label={`${value} ${label}`}>
      {icon}
      {value}
    </span>
  );
}

/** Horizontal (portrait) or vertical (landscape) lattice tray. */
export function CompactShop({ vertical }: { vertical?: boolean }) {
  useUiTick();
  const preds = useMemo(() => Object.fromEntries(LATTICE_ORDER.map((id) => [id, predictMatchups(LATTICES[id])])), []);
  const ended = engine.phase === 'victory' || engine.phase === 'defeat';
  return (
    <div
      className={`panel pointer-events-auto scroll-thin ${
        vertical ? 'flex h-full w-[10.75rem] flex-col gap-1.5 overflow-y-auto p-1.5' : 'flex w-full snap-x gap-1.5 overflow-x-auto p-1.5'
      }`}
      style={{ overscrollBehavior: 'contain' }}
      aria-label="Lattice tray"
    >
      {LATTICE_ORDER.map((id) => {
        const lat = LATTICES[id];
        const selected = engine.selection.placing === id;
        const afford = engine.moles >= lat.cost;
        const usable = lat.buildable && afford && !ended;
        const p = preds[id];
        return (
          <div
            key={id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-disabled={!usable}
            onClick={() => usable && engine.setPlacing(selected ? null : id)}
            className={`relative shrink-0 snap-start rounded-lg border px-2 py-1.5 ${vertical ? 'w-full' : 'w-[calc(50%-3px)] max-w-[13.5rem]'} ${
              selected ? 'border-cyan-300/80 bg-cyan-500/20' : usable ? 'border-slate-700/70 bg-slate-900/70 active:bg-slate-800' : 'border-slate-800 bg-slate-900/40'
            }`}
          >
            <span className="absolute inset-x-2 top-0 h-0.5 rounded-full" style={{ background: BONDING_META[lat.bonding].color }} />
            <div className={`flex items-start justify-between gap-1 ${!usable && lat.buildable ? 'opacity-50' : ''}`}>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-tight text-slate-100">{lat.name}</div>
                <div className="truncate text-[10px] text-slate-400">
                  <span className="font-mono">{lat.formula}</span>
                  <span style={{ color: BONDING_META[lat.bonding].color }}> · {BONDING_META[lat.bonding].label}</span>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Inspect ${lat.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  engine.setInspect(id);
                }}
                className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 active:bg-slate-700"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-1">
              <div className="flex gap-1">
                {(Object.keys(p) as DamageType[]).map((d) => {
                  const Icon = DAMAGE_ICON[d];
                  return (
                    <span
                      key={d}
                      className={`chip px-1 py-1 ${VERDICT_STYLE[p[d]].cls}`}
                      title={`${DAMAGE_META[d].label}: ${VERDICT_STYLE[p[d]].label}`}
                      aria-label={`${DAMAGE_META[d].label}: ${VERDICT_STYLE[p[d]].label}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  );
                })}
              </div>
              <span className={`font-mono text-[12px] font-semibold ${lat.buildable ? (afford ? 'text-cyan-200' : 'text-rose-300') : 'text-slate-500'}`}>
                {lat.buildable ? `${lat.cost}` : 'upg'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Shown while a lattice is selected on touch screens: what it is, how it fares against each
 * threat (in words, not just colours), then confirms the build once a tile is tapped.
 */
export function PlacementBar() {
  useUiTick();
  const { placing, pending } = engine.selection;
  const preds = useMemo(() => Object.fromEntries(LATTICE_ORDER.map((id) => [id, predictMatchups(LATTICES[id])])), []);
  if (!placing) return null;
  const lat = LATTICES[placing];
  const p = preds[placing];
  const ok = pending ? engine.canPlace(pending.x, pending.z) && engine.moles >= lat.cost : false;
  return (
    <div className="panel pointer-events-auto px-2.5 py-2" role="region" aria-label={`${lat.name} selected`}>
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lat.accent }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-[14px] font-bold text-white">{lat.name}</span>
            <span className="font-mono text-[11px] text-slate-400">{lat.formula}</span>
            <span className="ml-auto shrink-0 font-mono text-[12px] font-semibold text-cyan-200">{lat.cost} mol</span>
          </div>
          <div className="text-[11px] leading-snug text-slate-400">
            <span style={{ color: BONDING_META[lat.bonding].color }}>{BONDING_META[lat.bonding].label}</span>
            <span className="short:hidden"> · {lat.tagline}</span>
          </div>
        </div>
        <button type="button" onClick={() => engine.setInspect(placing)} className="btn-ghost tap-target shrink-0" aria-label={`Inspect ${lat.name} unit cell`}>
          <Info className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => engine.clearSelection()} className="btn-ghost tap-target shrink-0" aria-label="Cancel placement">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1 short:grid-cols-4">
        {(Object.keys(p) as DamageType[]).map((d) => {
          const Icon = DAMAGE_ICON[d];
          return (
            <span key={d} className={`chip justify-start gap-1.5 px-2 py-1 text-[11px] ${VERDICT_STYLE[p[d]].cls}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                <span className="short:hidden">{DAMAGE_META[d].label}: </span>
                <strong>{VERDICT_STYLE[p[d]].label}</strong>
              </span>
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-2 border-t border-slate-700/50 pt-1.5 short:mt-1 short:pt-1">
        <span className="min-w-0 flex-1 text-[12.5px] text-slate-200">
          {pending ? (ok ? <>Build here?</> : 'Can’t build on that tile — tap another') : 'Tap a free tile beside the lane'}
        </span>
        {pending && ok && (
          <button type="button" onClick={() => engine.confirmPending()} className="btn-primary min-h-[40px] px-3 text-sm">
            <Check className="h-4 w-4" /> Build
          </button>
        )}
      </div>
    </div>
  );
}

/** Wave launcher / combat strip. */
export function CompactControls() {
  useUiTick();
  const [open, setOpen] = useState(false);
  const { phase, waveIndex, overtime } = engine;
  const wave = engine.currentWave();
  if (phase === 'victory' || phase === 'defeat') return null;

  if (phase === 'wave') {
    const remaining = engine.waveTotal - engine.waveSpawned + engine.threats.length;
    const progress = engine.waveTotal ? 1 - remaining / engine.waveTotal : 0;
    return (
      <div className="panel pointer-events-auto flex items-center gap-2 px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span className="truncate font-semibold text-slate-200">W{waveIndex + 1} · {wave.name}</span>
            <span className="font-mono">{remaining} left</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <button type="button" onClick={() => engine.setPaused(!engine.paused)} className="btn-ghost tap-target" aria-label={engine.paused ? 'Resume' : 'Pause'}>
          {engine.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => engine.setSpeed((engine.speed % 3) + 1)} className="btn-ghost min-h-[40px] min-w-[52px] px-2 text-sm" aria-label="Change speed">
          <FastForward className="h-4 w-4" />
          {engine.speed}×
        </button>
      </div>
    );
  }

  const counts = new Map<string, number>();
  for (const g of wave.groups) counts.set(g.threat, (counts.get(g.threat) ?? 0) + g.count);
  return (
    <div className="panel pointer-events-auto px-2 py-1.5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex min-h-[40px] min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={open}>
          <ChevronUp className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? '' : 'rotate-180'}`} />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-rose-300/80">
              {overtime ? `Overtime W${waveIndex + 1}` : `Wave ${waveIndex + 1}/${WAVES.length}`}
            </span>
            <span className="block truncate text-[14px] font-bold leading-tight text-white">{wave.name}</span>
          </span>
        </button>
        <button type="button" onClick={() => engine.startWave()} className="btn-primary min-h-[42px] px-4">
          <Play className="h-4 w-4" /> Launch
        </button>
      </div>
      {open && (
        <div className="mt-1.5 border-t border-slate-700/50 pt-1.5">
          <p className="text-[12px] text-slate-400">{wave.briefing}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {[...counts.entries()].map(([id, n]) => {
              const spec = THREATS[id as keyof typeof THREATS];
              const Icon = DAMAGE_ICON[spec.type];
              return (
                <span key={id} className="chip border-slate-600/60 bg-slate-900/70 py-1 text-[11px] text-slate-200">
                  <Icon className="h-3 w-3" style={{ color: DAMAGE_META[spec.type].color }} />
                  {n}× {spec.short}
                </span>
              );
            })}
          </div>
          <p className="mt-1.5 flex gap-1.5 rounded-md border border-amber-300/25 bg-amber-400/5 p-1.5 text-[11.5px] leading-snug text-amber-100/90">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {wave.hint}
          </p>
        </div>
      )}
    </div>
  );
}

/** Brief pop-up of the newest notable log entry, so learning isn't hidden in a drawer. */
export function LogToast({ onOpen }: { onOpen: () => void }) {
  useUiTick();
  const [entry, setEntry] = useState<LogEntry | null>(null);
  const seen = useRef(engine.logVersion);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (engine.logVersion === seen.current) return;
    seen.current = engine.logVersion;
    const latest = engine.logs[0];
    if (!latest || latest.severity === 'info') return;
    setEntry(latest);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setEntry(null), 4200);
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!entry) return null;
  const Icon = entry.severity === 'success' ? CircleCheck : entry.severity === 'fail' ? CircleX : TriangleAlert;
  const color = entry.severity === 'success' ? 'text-emerald-300' : entry.severity === 'fail' ? 'text-rose-300' : 'text-amber-300';
  return (
    <button type="button" onClick={onOpen} className="panel pointer-events-auto flex w-full max-w-md animate-log-in items-start gap-2 px-3 py-2 text-left">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <span className={`flex-1 text-[12.5px] font-semibold leading-snug ${color}`}>{entry.title}</span>
      {entry.marks ? <span className="chip shrink-0 border-emerald-400/50 bg-emerald-500/20 text-emerald-200">+1</span> : null}
    </button>
  );
}

export function LogDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="hud-safe fixed z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div className="flex h-full w-[min(92vw,24rem)] flex-col p-2" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1.5 flex justify-end">
          <button type="button" onClick={onClose} className="panel tap-target text-slate-200" aria-label="Close log">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ExamLogHUD />
        </div>
      </div>
    </div>
  );
}
