import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudOff, Dices, Home, RotateCcw, Send, Skull, Trophy } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { WAVES } from '../../data/waves';
import { NAME_MAX, randomAlias } from '../../../shared/nameFilter.js';
import { lastName, submitScore, type SubmitError } from '../../services/scoreboard';
import { reportScoreToHub } from '../../services/arcadeHub';

const ERR_TEXT: Record<SubmitError, string> = {
  // Deliberately generic — the filter's rules are not revealed
  name: 'That name isn’t available. Please choose another, or roll a random one.',
  length: 'Names must be 3–16 characters.',
  charset: 'Use letters, numbers, spaces, dots, dashes or underscores (at least 2 letters).',
  invalid: 'This run couldn’t be verified, so it wasn’t submitted.',
  duplicate: 'This run has already been submitted.',
  rate: 'Too many submissions — wait a minute and try again.',
  offline: 'Scoreboard offline.',
};

export default function EndOverlay({ onScores, onMenu }: { onScores: (highlightId?: string) => void; onMenu: () => void }) {
  useUiTick();
  const { phase } = engine;
  if (phase !== 'victory' && phase !== 'defeat') return null;
  return <EndCard key={engine.runId} onScores={onScores} onMenu={onMenu} />;
}

function EndCard({ onScores, onMenu }: { onScores: (highlightId?: string) => void; onMenu: () => void }) {
  const win = engine.phase === 'victory';
  const summary = useMemo(() => engine.summary(), []);
  const score = engine.score;
  const [name, setName] = useState(lastName());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<SubmitError | null>(null);
  const [done, setDone] = useState<{ rank: number | null; online: boolean; id: string } | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportScoreToHub(score, summary);
  }, [score, summary]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await submitScore(name, engine.runId, summary);
    setBusy(false);
    if (r.ok) setDone({ rank: r.rank, online: r.online, id: r.entry.id });
    else setErr(r.error);
  };

  return (
    <div className="hud-safe fixed z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="panel scroll-thin max-h-full w-full max-w-md overflow-y-auto p-5 text-center sm:p-6">
        {win ? <Trophy className="mx-auto h-12 w-12 text-amber-300" /> : <Skull className="mx-auto h-12 w-12 text-rose-400" />}
        <h2 className="mt-2 text-2xl font-bold text-white">{win ? 'Lattice Locked!' : 'Core Collapsed'}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {win ? 'All ten waves neutralised. Structure → bonding → property: mastered.' : `Fell on wave ${engine.waveIndex + 1}: ${WAVES[engine.waveIndex]?.name ?? ''}.`}
        </p>

        <div className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-500/10 py-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">Score</div>
          <div className="font-mono text-4xl font-bold text-white">{score.toLocaleString()}</div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label="Marks" value={engine.marks} />
          <Stat label="Neutralised" value={engine.stats.neutralised} />
          <Stat label="Barriers lost" value={engine.stats.towersLost} />
        </div>

        {!done ? (
          <form
            className="mt-4 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void submit();
            }}
          >
            <label htmlFor="ll-name" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Name for the scoreboard
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="ll-name"
                value={name}
                maxLength={NAME_MAX}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="send"
                onChange={(e) => {
                  setName(e.target.value);
                  setErr(null);
                }}
                placeholder="e.g. Brave Quartz 42"
                className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => {
                  setName(randomAlias());
                  setErr(null);
                }}
                className="btn-ghost tap-target"
                title="Random name"
                aria-label="Random name"
              >
                <Dices className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Don’t use your real full name or anything personal.</p>
            {err && <p className="mt-2 rounded-md border border-rose-400/30 bg-rose-500/10 p-2 text-xs text-rose-200" role="alert">{ERR_TEXT[err]}</p>}
            <button type="submit" disabled={busy || name.trim().length < 3} className="btn-primary mt-3 min-h-[46px] w-full">
              <Send className="h-4 w-4" /> {busy ? 'Submitting…' : 'Submit score'}
            </button>
          </form>
        ) : (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {done.online ? (
              <>Submitted! {done.rank ? <>You placed <strong>#{done.rank}</strong> on the global scoreboard.</> : null}</>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CloudOff className="h-4 w-4" /> Global scoreboard not available — saved on this device.
              </span>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onScores(done?.id)} className="btn-ghost min-h-[44px]">
            <Trophy className="h-4 w-4" /> Scoreboard
          </button>
          <button type="button" onClick={() => engine.reset()} className="btn-ghost min-h-[44px]">
            <RotateCcw className="h-4 w-4" /> New run
          </button>
          <button type="button" onClick={onMenu} className="btn-ghost col-span-2 min-h-[44px]">
            <Home className="h-4 w-4" /> Main menu
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-900/70 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
