import { useState } from 'react';
import { FastForward, Lightbulb, Menu, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { settings, useSettings } from '../../engine/settings';
import { engine, useUiTick } from '../../hooks/useEngine';
import { DAMAGE_META, THREATS, WAVES } from '../../data/waves';
import { DAMAGE_ICON } from './damageIcons';

export default function GameControls({ onMenu }: { onMenu: () => void }) {
  useUiTick();
  const [hint, setHint] = useState(false);
  const { phase, waveIndex } = engine;
  const wave = WAVES[Math.min(waveIndex, WAVES.length - 1)];

  // Aggregate threat counts for the preview
  const counts = new Map<string, number>();
  for (const g of wave.groups) counts.set(g.threat, (counts.get(g.threat) ?? 0) + g.count);

  const remaining = engine.waveTotal - engine.waveSpawned + engine.threats.length;
  const progress = engine.waveTotal ? 1 - remaining / engine.waveTotal : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-[19rem] max-lg:px-3">
      <div className="panel pointer-events-auto w-full max-w-2xl px-3 py-2.5">
        {phase === 'build' && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-rose-300/80">Incoming · Wave {waveIndex + 1} / {WAVES.length}</div>
                <div className="truncate text-base font-bold text-white">{wave.name}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => setHint(!hint)} className={`btn-ghost px-2 ${hint ? 'border-amber-300/50 text-amber-200' : ''}`} title="Examiner hint">
                  <Lightbulb className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => engine.startWave()} className="btn-primary px-4">
                  <Play className="h-4 w-4" /> Launch wave <kbd className="ml-1 rounded bg-slate-900/60 px-1 font-mono text-[10px] text-cyan-300/80">Space</kbd>
                </button>
              </div>
            </div>
            <p className="mt-1 text-[12px] text-slate-400">{wave.briefing}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[...counts.entries()].map(([id, n]) => {
                const spec = THREATS[id as keyof typeof THREATS];
                const Icon = DAMAGE_ICON[spec.type];
                return (
                  <span key={id} className="chip border-slate-600/60 bg-slate-900/70 py-1 text-[11px] text-slate-200" title={spec.description}>
                    <Icon className="h-3 w-3" style={{ color: DAMAGE_META[spec.type].color }} />
                    {n}× {spec.short}
                    <span className="font-mono text-slate-500">{spec.intensity} {spec.unit}</span>
                  </span>
                );
              })}
            </div>
            {hint && <p className="mt-2 rounded-md border border-amber-300/25 bg-amber-400/5 p-2 text-[12px] leading-relaxed text-amber-100/90">{wave.hint}</p>}
          </div>
        )}

        {phase === 'wave' && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">Wave {waveIndex + 1}: {wave.name}</span>
                <span className="font-mono">{remaining} disruptors left</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
            <button type="button" onClick={() => engine.setPaused(!engine.paused)} className="btn-ghost px-2" title="Pause (P)">
              {engine.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <div className="flex overflow-hidden rounded-lg border border-slate-600/50">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => engine.setSpeed(s)}
                  className={`flex items-center gap-0.5 px-2 py-1.5 text-xs font-semibold ${engine.speed === s ? 'bg-cyan-500/25 text-cyan-100' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'}`}
                >
                  {s === 1 ? <Play className="h-3 w-3" /> : <FastForward className="h-3 w-3" />}
                  {s}×
                </button>
              ))}
            </div>
            <Extras onMenu={onMenu} />
          </div>
        )}

        {phase === 'build' && (
          <div className="mt-2 flex justify-end border-t border-slate-700/40 pt-2">
            <Extras onMenu={onMenu} />
          </div>
        )}
        {(phase === 'victory' || phase === 'defeat') && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Run complete.</span>
            <button type="button" onClick={() => engine.reset()} className="btn-primary">
              <RotateCcw className="h-4 w-4" /> New run
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Extras({ onMenu }: { onMenu: () => void }) {
  const { muted } = useSettings();
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => settings.set({ muted: !muted })} className="btn-ghost px-2" title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onMenu} className="btn-ghost px-2" title="Menu (Esc)" aria-label="Menu">
        <Menu className="h-4 w-4" />
      </button>
    </div>
  );
}
