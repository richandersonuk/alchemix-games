import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleCheck, GraduationCap } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { SECTORS, WAVE_QUIZZES } from '../../data/waves';

/** "WAVE CLEARED" card shown after each wave; stays until the player presses Continue. */
export default function WaveBanner() {
  useUiTick();
  const info = engine.waveCleared;
  const [visibleId, setVisibleId] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ waveId: number; option: number } | null>(null);
  // Each wave's banner is shown exactly once: remember which ids we've already shown
  const seenId = useRef<number | null>(engine.waveCleared?.id ?? null);
  const continueBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!info || info.id === seenId.current) return;
    seenId.current = info.id;
    setPicked(null);
    setVisibleId(info.id);
  }, [info]);

  const visible = !!info && visibleId === info.id && engine.phase === 'build';

  // While open: focus Continue; Enter / Space / Esc dismiss it (and don't launch the next wave)
  useEffect(() => {
    if (!visible) return;
    continueBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement)?.closest('[data-quiz-opt]')) return;
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

  const campaignLen = SECTORS[engine.sectorId].waves.length;
  const quiz = WAVE_QUIZZES[(info.wave - 1) % WAVE_QUIZZES.length];
  const answeredThisWave = picked?.waveId === info.id || engine.quizAnsweredWave === engine.waveIndex;
  const chosenOption = picked?.waveId === info.id ? picked.option : null;
  const isCorrect = chosenOption === quiz.correctIndex;

  return (
    <div className="hud-safe fixed z-40 flex items-start justify-center overflow-y-auto bg-black/45 px-4 pb-6 pt-[10vh] short:pt-3" role="dialog" aria-modal="true" aria-label={`Wave ${info.wave} cleared`}>
      <div className="animate-banner-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-300/50 bg-slate-950/95 px-5 py-4 text-center shadow-[0_0_60px_-10px_rgba(52,211,153,0.7)] backdrop-blur-md sm:px-8">
        <span className="animate-banner-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
          <CircleCheck className="h-4 w-4" /> Lattice held
        </div>
        <div className="mt-1 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-[clamp(1.7rem,6vw,2.8rem)] font-bold leading-none tracking-tight text-transparent">
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
          Barriers recrystallised · Next:{' '}
          <span className="font-semibold text-slate-200">
            {engine.overtime ? `Overtime Wave ${info.wave + 1}` : `Wave ${info.wave + 1} of ${campaignLen}`} — {info.next}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-900/75 p-3 text-left">
          <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> Examiner Spot-Check
            </span>
            <span className="text-emerald-300">+25 mol · +1 mark</span>
          </div>
          <p className="mt-1 text-[12.5px] font-medium leading-snug text-slate-100">{quiz.question}</p>
          <div className="mt-2 space-y-1.5">
            {quiz.options.map((opt, idx) => {
              const selected = chosenOption === idx;
              const right = idx === quiz.correctIndex;
              let cls = 'border-slate-700/70 bg-slate-950/60 text-slate-200 hover:border-cyan-400/50 hover:bg-slate-800/80';
              if (answeredThisWave) {
                if (right) cls = 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100';
                else if (selected) cls = 'border-rose-400/60 bg-rose-500/20 text-rose-100';
                else cls = 'border-slate-800 bg-slate-950/40 text-slate-500';
              }
              return (
                <button
                  key={idx}
                  data-quiz-opt
                  type="button"
                  disabled={answeredThisWave}
                  onClick={() => {
                    if (answeredThisWave) return;
                    setPicked({ waveId: info.id, option: idx });
                    engine.answerWaveQuiz(idx === quiz.correctIndex, quiz.explanation);
                  }}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-[12px] leading-snug transition ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answeredThisWave && (
            <p className={`mt-2 text-[11.5px] leading-snug ${isCorrect ? 'text-emerald-200' : 'text-amber-200'}`}>
              <strong>{isCorrect ? 'Correct (+25 mol, +1 mark): ' : 'Mark scheme: '}</strong>
              {quiz.explanation}
            </p>
          )}
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
