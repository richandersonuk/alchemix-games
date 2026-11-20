import { useState } from 'react';
import { CircleCheck, CircleX, GraduationCap, Info, ScrollText, TriangleAlert } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import type { LogSeverity } from '../../types/chemistry';

const SEV: Record<LogSeverity, { icon: typeof Info; cls: string; ring: string }> = {
  success: { icon: CircleCheck, cls: 'text-emerald-300', ring: 'border-emerald-400/25 bg-emerald-500/[0.06]' },
  fail: { icon: CircleX, cls: 'text-rose-300', ring: 'border-rose-400/30 bg-rose-500/[0.07]' },
  warning: { icon: TriangleAlert, cls: 'text-amber-300', ring: 'border-amber-400/25 bg-amber-500/[0.05]' },
  info: { icon: Info, cls: 'text-sky-300', ring: 'border-slate-600/40 bg-slate-800/30' },
};

type Filter = 'all' | 'success' | 'fail';

const fmt = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function ExamLogHUD({ compact }: { compact?: boolean }) {
  useUiTick();
  const [filter, setFilter] = useState<Filter>('all');
  const logs = engine.logs.filter((l) =>
    filter === 'all' ? true : filter === 'success' ? l.severity === 'success' : l.severity === 'fail' || l.severity === 'warning',
  );

  return (
    <section className={`panel pointer-events-auto flex min-h-0 flex-col overflow-hidden ${compact ? 'flex-1' : 'h-full'}`}>
      <header className="flex items-center justify-between gap-2 border-b border-cyan-400/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-cyan-300" />
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/90">Spectroscopy / Failure Log</h2>
            <p className="text-[10.5px] text-slate-500">Every interaction, explained the way the examiner wants it.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-200" title="Mark-scheme points earned">
          <GraduationCap className="h-3.5 w-3.5" />
          <span className="font-mono text-xs font-semibold">{engine.marks}</span>
        </div>
      </header>
      <div className="flex gap-1 border-b border-cyan-400/10 px-2 py-1.5">
        {(['all', 'success', 'fail'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${filter === f ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {f === 'fail' ? 'Failures' : f === 'success' ? 'Successes' : 'All'}
          </button>
        ))}
      </div>
      <ol className="scroll-thin flex-1 space-y-1.5 overflow-y-auto p-2" aria-live="polite">
        {logs.map((l) => {
          const s = SEV[l.severity];
          const Icon = s.icon;
          return (
            <li key={l.id} className={`animate-log-in rounded-lg border px-2.5 py-2 ${s.ring}`}>
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${s.cls}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[12.5px] font-semibold leading-snug ${s.cls}`}>{l.title}</p>
                    {l.marks ? <span className="chip shrink-0 border-emerald-400/50 bg-emerald-500/20 text-emerald-200">+{l.marks} mark</span> : null}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-300">{l.rationale}</p>
                  {l.keywords.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.keywords.map((k) => (
                        <span key={k} className="chip border-slate-500/40 bg-slate-800/60 text-slate-300">{k}</span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 font-mono text-[9.5px] text-slate-500">W{l.wave} · {fmt(l.time)}</p>
                </div>
              </div>
            </li>
          );
        })}
        {logs.length === 0 && <li className="p-4 text-center text-xs text-slate-500">No entries yet.</li>}
      </ol>
    </section>
  );
}
