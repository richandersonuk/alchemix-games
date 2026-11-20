import { useEffect, useRef, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { WAVES } from '../../data/waves';

/** Big centred "WAVE CLEARED" notice shown for a few seconds after each wave. */
export default function WaveBanner() {
  useUiTick();
  const info = engine.waveCleared;
  const [shownId, setShownId] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!info || info.id === shownId) return;
    setShownId(info.id);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShownId(null), 4200);
  }, [info, shownId]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const visible = info && shownId === info.id && engine.phase === 'build';
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[22%] z-30 flex justify-center px-4" role="status" aria-live="assertive">
      <button
        type="button"
        onClick={() => setShownId(null)}
        className="pointer-events-auto animate-banner-in relative overflow-hidden rounded-2xl border border-emerald-300/50 bg-slate-950/85 px-6 py-4 text-center shadow-[0_0_60px_-10px_rgba(52,211,153,0.7)] backdrop-blur-md sm:px-10"
      >
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
      </button>
    </div>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${className}`}>{children}</span>;
}
