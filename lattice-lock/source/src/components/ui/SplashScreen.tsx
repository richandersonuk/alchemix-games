import { useEffect, useState } from 'react';
import { BookOpen, LogOut, Play, RotateCcw, Settings2, Trophy } from 'lucide-react';
import { hubLabel } from '../../services/arcadeHub';

export type MenuAction = 'continue' | 'new' | 'howto' | 'scores' | 'settings' | 'quit';

/** Animated crystal logo (pure SVG/CSS — no assets). */
export function CrystalLogo({ size = 132 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden className="drop-shadow-[0_0_28px_rgba(34,211,238,0.55)]">
      <defs>
        <linearGradient id="ll-face" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#cffafe" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <g className="origin-center animate-[spin_24s_linear_infinite]" style={{ transformBox: 'fill-box' }}>
        <polygon points="60,4 108,32 108,88 60,116 12,88 12,32" fill="none" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1.5" />
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const r = (a * Math.PI) / 180;
          return <circle key={a} cx={60 + Math.sin(r) * 52} cy={60 - Math.cos(r) * 52} r="4" fill={a % 120 ? '#a78bfa' : '#4ade80'} />;
        })}
      </g>
      <g className="animate-[float_4s_ease-in-out_infinite]">
        <polygon points="60,22 86,48 60,98 34,48" fill="url(#ll-face)" opacity="0.95" />
        <polygon points="60,22 86,48 60,56" fill="#ecfeff" opacity="0.7" />
        <polygon points="34,48 60,56 60,98" fill="#155e75" opacity="0.55" />
        <line x1="34" y1="48" x2="86" y2="48" stroke="#ecfeff" strokeOpacity="0.6" />
      </g>
    </svg>
  );
}

export default function SplashScreen({
  stage,
  canContinue,
  onStart,
  onAction,
}: {
  stage: 'title' | 'menu';
  canContinue: boolean;
  onStart: () => void;
  onAction: (a: MenuAction) => void;
}) {
  // Any key also starts from the title card
  useEffect(() => {
    if (stage !== 'title') return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') onStart();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [stage, onStart]);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="hud-safe fixed z-40 overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(4,10,22,0.55)_0%,rgba(2,4,10,0.92)_70%)]"
      onClick={stage === 'title' ? onStart : undefined}
      role={stage === 'title' ? 'button' : undefined}
      aria-label={stage === 'title' ? 'Start' : undefined}
    >
     <div className="flex min-h-full flex-col items-center justify-center px-4 py-6 short:flex-row short:gap-10 short:py-3">
      <div className={`flex flex-col items-center text-center transition-all duration-1000 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <span className="short:hidden">
          <CrystalLogo size={stage === 'title' ? 140 : 96} />
        </span>
        <span className="hidden short:block">
          <CrystalLogo size={64} />
        </span>
        <h1 className="mt-4 bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-[clamp(2.4rem,9vw,5rem)] short:text-5xl font-bold leading-[0.95] tracking-tight text-transparent">
          Lattice Lock
        </h1>
        <p className="mt-1 text-[clamp(0.9rem,3.2vw,1.35rem)] font-medium uppercase tracking-[0.35em] text-cyan-300/90">Crystal Defender</p>
        <p className="mt-3 max-w-md text-sm text-slate-400 short:hidden">Structure · Bonding · Properties — defend the core with real crystal lattices.</p>
      </div>

      {stage === 'title' ? (
        <p className="mt-12 animate-pulse short:mt-0 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
          <span className="pointer-coarse:hidden">Click or press any key</span>
          <span className="hidden pointer-coarse:inline">Tap to start</span>
        </p>
      ) : (
        <nav className="mt-8 flex w-full max-w-xs flex-col gap-2.5 short:mt-0 short:gap-2" aria-label="Main menu">
          {canContinue && <MenuButton primary icon={<Play className="h-5 w-5" />} label="Continue" onClick={() => onAction('continue')} />}
          <MenuButton
            primary={!canContinue}
            icon={canContinue ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            label={canContinue ? 'New run' : 'Play'}
            onClick={() => onAction('new')}
          />
          <MenuButton icon={<BookOpen className="h-5 w-5" />} label="How to play" onClick={() => onAction('howto')} />
          <MenuButton icon={<Trophy className="h-5 w-5" />} label="Scoreboard" onClick={() => onAction('scores')} />
          <MenuButton icon={<Settings2 className="h-5 w-5" />} label="Settings" onClick={() => onAction('settings')} />
          <MenuButton icon={<LogOut className="h-5 w-5" />} label={hubLabel()} onClick={() => onAction('quit')} subtle />
        </nav>
      )}
     </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] uppercase tracking-[0.25em] text-slate-600 short:hidden">GCSE · A-Level Chemistry</p>
    </div>
  );
}

function MenuButton({ icon, label, onClick, primary, subtle }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-autofocus={primary || undefined}
      className={`flex min-h-[48px] short:min-h-[42px] items-center justify-center gap-2.5 rounded-xl border px-5 text-base font-semibold transition active:scale-[0.98] ${
        primary
          ? 'border-cyan-300/60 bg-cyan-500/25 text-white shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)] hover:bg-cyan-400/35'
          : subtle
            ? 'border-slate-700/60 bg-slate-900/40 text-slate-400 hover:text-slate-200'
            : 'border-slate-600/60 bg-slate-900/70 text-slate-100 hover:border-cyan-400/40 hover:bg-slate-800/80'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
