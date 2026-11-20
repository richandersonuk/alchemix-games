import { useCallback, useEffect, useState } from 'react';
import { CloudOff, Crown, Medal, RefreshCw, Smartphone, Trophy } from 'lucide-react';
import { ScoreboardNotConfigured, fetchGlobalScores, getLocalScores, type ScoreEntry } from '../../services/scoreboard';
import Modal from './Modal';

type Tab = 'global' | 'device';

export default function ScoreboardPanel({ onClose, highlightId }: { onClose: () => void; highlightId?: string }) {
  const [tab, setTab] = useState<Tab>('global');
  const [global, setGlobal] = useState<ScoreEntry[] | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'unconfigured'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setGlobal(await fetchGlobalScores(25));
      setState('ok');
    } catch (err) {
      setState(err instanceof ScoreboardNotConfigured ? 'unconfigured' : 'offline');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = tab === 'global' ? global ?? [] : getLocalScores();

  return (
    <Modal title="Scoreboard" icon={<Trophy className="h-5 w-5 text-amber-300" />} onClose={onClose} width="max-w-lg">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 overflow-hidden rounded-lg border border-slate-600/60" role="tablist">
          {(['global', 'device'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 text-sm font-semibold ${tab === t ? 'bg-cyan-500/25 text-cyan-100' : 'bg-slate-800/60 text-slate-400'}`}
            >
              {t === 'global' ? <Trophy className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              {t === 'global' ? 'Global' : 'This device'}
            </button>
          ))}
        </div>
        {tab === 'global' && (
          <button type="button" onClick={() => void load()} className="btn-ghost tap-target" aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {tab === 'global' && (state === 'offline' || state === 'unconfigured') && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-400">
          <CloudOff className="h-8 w-8 text-slate-500" />
          {state === 'unconfigured' ? 'The global scoreboard isn’t switched on for this site yet.' : 'The online scoreboard can’t be reached right now.'}
          <span className="text-xs text-slate-500">
            Your scores are still saved on this device —{' '}
            <button type="button" className="underline decoration-dotted underline-offset-2 hover:text-slate-300" onClick={() => setTab('device')}>
              see This device
            </button>
            .
          </span>
        </div>
      )}
      {tab === 'global' && state === 'loading' && !global && <p className="py-8 text-center text-sm text-slate-500">Loading…</p>}

      {(tab === 'device' || state === 'ok' || state === 'loading') && rows.length > 0 && (
        <ol className="space-y-1">
          {rows.map((e, i) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${e.id === highlightId ? 'border-cyan-300/60 bg-cyan-500/15' : 'border-slate-700/50 bg-slate-900/50'}`}
            >
              <span className="w-7 text-center font-mono text-sm font-bold text-slate-400">
                {i === 0 ? <Crown className="mx-auto h-4 w-4 text-amber-300" /> : i < 3 ? <Medal className={`mx-auto h-4 w-4 ${i === 1 ? 'text-slate-300' : 'text-amber-600'}`} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-100">{e.name}</span>
                <span className="text-[11px] text-slate-500">
                  {e.victory ? 'All waves cleared' : `Wave ${e.wavesCleared + 1}`} · {e.marks} marks · {new Date(e.date).toLocaleDateString()}
                </span>
              </span>
              <span className="font-mono text-base font-bold text-cyan-200">{e.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
      {(tab === 'device' || state === 'ok') && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No scores yet — be the first to lock the lattice.</p>
      )}
    </Modal>
  );
}
