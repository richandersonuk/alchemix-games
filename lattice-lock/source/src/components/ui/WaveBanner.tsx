import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { WAVES } from '../../data/waves';

/** "WAVE CLEARED" card shown after each wave; stays until the player presses Continue. */
export default function WaveBanner() {
  useUiTick();
  const info = engine.waveCleared;
  const [visibleId, setVisibleId] = useState<number | null>(null);
  // Each wave's banner is shown exactly once: remember which ids we've already shown
  const seenId = useRef<number | null>(engine.waveCleared?.id ?? null);
  const continueBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!info || info.id === seenId.current) return;
    seenId.current = info.id;
    setVisibleId(info.id);
  }, [info]);

  const visible = !!info && visibleId === info.id && engine.phase === 'build';

  // While open: focus Continue; Enter / Space / Esc dismiss it (and don't launch the next wave)
  useEffect(() => {
    if (!visible) return;
    continueBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setVisibleId(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [visible]);

  if (!visible || !info) return null;

  return (
    <div className="hud-safe fixed z-40 flex items-start justify-center bg-black/40 px-4 pt-[18vh] short:pt-4" role="dialog" aria-modal="true" aria-label={`Wave ${info.wave} cleared`}>
      <div className="animate-banner-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-300/50 bg-slate-950/90 px-6 py-4 text-center shadow-[0_0_60px_-10px_rgba(52,211,153,0.7)] backdrop-blur-md sm:px-10">
        <span className="animate-banner-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
          <CircleCheck className="h-4 w-4" /> Lattice held
        </div>
        <div className="mt-1 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-[clamp(1.8rem,7vw,3.2rem)] font-bold leading-none tracking-tight text-transparent">
          Wave {info.wave} cleared
        </div>
        <div className="mt-1 text-sm text-slate-300">“{info.name}” neutralised</div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[12px]">
          {info.bonus > 0 && <Pill className="border-amber-300/40 bg-amber-400/10 text-amber-200">+{info.bonus} mol bonus</Pill>}
          <Pill className="border-cyan-300/40 bg-cyan-400/10 text-cyan-100">{info.neutralised} disruptors stopped</Pill>
          {info.marks > 0 && <Pill className="border-emerald-300/40 bg-emerald-400/10 text-emerald-100">+{info.marks} marks</Pill>}
          {info.lost > 0 && <Pill className="border-rose-300/40 bg-rose-400/10 text-rose-200">{info.lost} barrier{info.lost > 1 ? 's' : ''} lost</Pill>}
        </div>
        <div className="mt-2 text-[12px] text-slate-400">
          Barriers recrystallised · Next: <span className="font-semibold text-slate-200">Wave {info.wave + 1} of {WAVES.length} — {info.next}</span>
        </div>
        <button
          ref={continueBtn}
          type="button"
          onClick={() => setVisibleId(null)}
          className="btn-primary relative mt-4 min-h-[46px] w-full max-w-xs text-base"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${className}`}>{children}</span>;
}
