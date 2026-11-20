import { useState } from 'react';
import { BookOpen, Home, LogOut, Pause, Play, RotateCcw, Settings2, Trophy } from 'lucide-react';
import { engine, useUiTick } from '../../hooks/useEngine';
import { hubLabel } from '../../services/arcadeHub';
import Modal from './Modal';

export type PauseAction = 'resume' | 'settings' | 'howto' | 'scores' | 'restart' | 'menu' | 'quit';

export default function PauseMenu({ onAction }: { onAction: (a: PauseAction) => void }) {
  useUiTick();
  const [confirm, setConfirm] = useState<null | 'restart' | 'menu' | 'quit'>(null);
  const inRun = engine.runActive;

  const ask = (a: 'restart' | 'menu' | 'quit') => (inRun ? setConfirm(a) : onAction(a));

  return (
    <Modal title="Paused" icon={<Pause className="h-5 w-5 text-cyan-300" />} onClose={() => onAction('resume')} width="max-w-sm">
      {confirm ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-slate-300">
            {confirm === 'restart' ? 'Start a new run? ' : 'Leave this run? '}
            Your current progress {confirm === 'menu' ? 'stays paused until you start a new run.' : 'will be lost.'}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost min-h-[44px] flex-1" onClick={() => setConfirm(null)} data-autofocus>
              Cancel
            </button>
            <button type="button" className="btn-danger min-h-[44px] flex-1" onClick={() => onAction(confirm)}>
              {confirm === 'restart' ? 'Restart' : confirm === 'menu' ? 'Main menu' : 'Quit'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Item primary icon={<Play className="h-5 w-5" />} label="Resume" onClick={() => onAction('resume')} />
          <Item icon={<Settings2 className="h-5 w-5" />} label="Settings" onClick={() => onAction('settings')} />
          <Item icon={<BookOpen className="h-5 w-5" />} label="How to play" onClick={() => onAction('howto')} />
          <Item icon={<Trophy className="h-5 w-5" />} label="Scoreboard" onClick={() => onAction('scores')} />
          <Item icon={<RotateCcw className="h-5 w-5" />} label="Restart run" onClick={() => ask('restart')} />
          <Item icon={<Home className="h-5 w-5" />} label="Main menu" onClick={() => onAction('menu')} />
          <Item icon={<LogOut className="h-5 w-5" />} label={hubLabel()} onClick={() => ask('quit')} danger />
        </div>
      )}
    </Modal>
  );
}

function Item({ icon, label, onClick, primary, danger }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-autofocus={primary || undefined}
      className={`flex min-h-[46px] items-center gap-3 rounded-xl border px-4 text-left text-[15px] font-semibold transition active:scale-[0.99] ${
        primary
          ? 'border-cyan-300/50 bg-cyan-500/20 text-white hover:bg-cyan-400/30'
          : danger
            ? 'border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
            : 'border-slate-700/60 bg-slate-900/60 text-slate-200 hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
