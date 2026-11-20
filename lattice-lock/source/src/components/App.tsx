import { useCallback, useEffect, useState } from 'react';
import { Atom, GraduationCap, Hexagon, Menu, Shield, Waves } from 'lucide-react';
import { engine, useUiTick } from '../hooks/useEngine';
import { useLayout, type LayoutMode } from '../hooks/useLayout';
import { WAVES } from '../data/waves';
import { CORE_MAX } from '../engine/waveManager';
import { settings } from '../engine/settings';
import { unlockAudio } from '../engine/audioContext';
import { music, type Mood } from '../engine/music';
import { quitToHub } from '../services/arcadeHub';
import GameStage from './canvas/GameStage';
import TowerShop, { HOTKEY_LATTICES } from './ui/TowerShop';
import InspectorModal from './ui/InspectorModal';
import ExamLogHUD from './ui/ExamLogHUD';
import GameControls from './ui/GameControls';
import TowerPanel from './ui/TowerPanel';
import SplashScreen, { type MenuAction } from './ui/SplashScreen';
import SettingsPanel from './ui/SettingsPanel';
import ScoreboardPanel from './ui/ScoreboardPanel';
import HowToPlay from './ui/HowToPlay';
import PauseMenu, { type PauseAction } from './ui/PauseMenu';
import EndOverlay from './ui/EndOverlay';
import WaveBanner from './ui/WaveBanner';
import { CompactControls, CompactShop, CompactTopBar, LogDrawer, LogToast, PlacementBar } from './ui/CompactHud';

type Screen = 'title' | 'menu' | 'game';
type Overlay = null | 'pause' | 'settings' | 'howto' | 'scores';

export default function App() {
  const layout = useLayout();
  const [screen, setScreen] = useState<Screen>('title');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [returnTo, setReturnTo] = useState<Overlay>(null);
  const [highlight, setHighlight] = useState<string | undefined>();
  const [logOpen, setLogOpen] = useState(false);
  const [logSeen, setLogSeen] = useState(0);

  const open = useCallback((o: Overlay, from: Overlay = null) => {
    setReturnTo(from);
    setOverlay(o);
  }, []);
  const close = useCallback(() => {
    if (overlay === 'howto' && !settings.value.seenHowTo) settings.set({ seenHowTo: true });
    setOverlay(returnTo);
    setReturnTo(null);
  }, [overlay, returnTo]);

  const enterGame = useCallback(() => {
    if (engine.phase === 'wave') engine.setPaused(false);
    setScreen('game');
    if (!settings.value.seenHowTo) open('howto');
  }, [open]);

  const onMenuAction = (a: MenuAction) => {
    switch (a) {
      case 'continue':
        enterGame();
        break;
      case 'new':
        if (engine.runActive || engine.phase === 'victory' || engine.phase === 'defeat') engine.reset();
        enterGame();
        break;
      case 'howto':
      case 'scores':
      case 'settings':
        setHighlight(undefined);
        open(a);
        break;
      case 'quit':
        quitToHub();
        break;
    }
  };

  const toMenu = useCallback(() => {
    if (engine.phase === 'wave') engine.setPaused(true);
    engine.clearSelection();
    setOverlay(null);
    setReturnTo(null);
    setLogOpen(false);
    setScreen('menu');
  }, []);

  const onPauseAction = (a: PauseAction) => {
    switch (a) {
      case 'resume':
        setOverlay(null);
        break;
      case 'settings':
      case 'howto':
      case 'scores':
        setHighlight(undefined);
        open(a, 'pause');
        break;
      case 'restart':
        engine.reset();
        setOverlay(null);
        break;
      case 'menu':
        toMenu();
        break;
      case 'quit':
        quitToHub();
        break;
    }
  };

  // Keyboard (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'game' || overlay || engine.selection.inspect) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (logOpen) setLogOpen(false);
        else if (engine.hasSelection()) engine.clearSelection();
        else if (engine.phase === 'build' || engine.phase === 'wave') open('pause');
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (engine.phase === 'build') engine.startWave();
        else if (engine.phase === 'wave') engine.setPaused(!engine.paused);
      } else if (e.key.toLowerCase() === 'p' && engine.phase === 'wave') engine.setPaused(!engine.paused);
      else if (e.key.toLowerCase() === 'i') {
        const t = engine.towers.find((x) => x.id === engine.selection.towerId);
        const id = t?.latticeId ?? engine.selection.placing;
        if (id) engine.setInspect(id);
      } else if (e.key.toLowerCase() === 'u' && engine.selection.towerId !== null) engine.upgradeTower(engine.selection.towerId);
      else if (/^[0-9]$/.test(e.key)) {
        const id = HOTKEY_LATTICES[e.key === '0' ? 9 : Number(e.key) - 1];
        if (id) engine.setPlacing(engine.selection.placing === id ? null : id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, overlay, logOpen, open]);

  // Auto-pause when the app is backgrounded (phone call, tab switch, lock screen)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && screen === 'game' && engine.phase === 'wave' && !overlay) open('pause');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [screen, overlay, open]);

  const openLog = () => {
    setLogOpen(true);
    setLogSeen(engine.logVersion);
  };
  const closeLog = () => {
    setLogOpen(false);
    setLogSeen(engine.logVersion);
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-void font-sans text-slate-100">
      <GameStage attract={screen !== 'game'} layout={layout} />
      <MusicDirector screen={screen} />

      {screen === 'game' &&
        (layout === 'desktop' ? (
          <DesktopHud onMenu={() => open('pause')} />
        ) : (
          <CompactHud layout={layout} onMenu={() => open('pause')} onLog={openLog} logSeen={logSeen} />
        ))}
      {screen === 'game' && <WaveBanner />}
      {screen === 'game' && logOpen && <LogDrawer onClose={closeLog} />}
      {screen === 'game' && <InspectorModal />}
      {screen === 'game' && (
        <EndOverlay
          onScores={(id) => {
            setHighlight(id);
            open('scores');
          }}
          onMenu={() => {
            engine.reset();
            toMenu();
          }}
        />
      )}

      {screen !== 'game' && (
        <SplashScreen
          stage={screen === 'title' ? 'title' : 'menu'}
          canContinue={engine.runActive}
          onStart={() => {
            unlockAudio();
            setScreen('menu');
          }}
          onAction={onMenuAction}
        />
      )}

      {overlay === 'pause' && <PauseMenu onAction={onPauseAction} />}
      {overlay === 'settings' && <SettingsPanel onClose={close} />}
      {overlay === 'howto' && <HowToPlay onClose={close} cta={screen === 'game' && !settings.value.seenHowTo ? 'Enter build phase' : 'Got it'} />}
      {overlay === 'scores' && <ScoreboardPanel onClose={close} highlightId={highlight} />}
    </div>
  );
}

/** Crossfades the soundtrack to match what's on screen. */
function MusicDirector({ screen }: { screen: Screen }) {
  useUiTick();
  const phase = engine.phase;
  const mood: Mood =
    screen !== 'game' ? 'menu' : phase === 'wave' ? 'combat' : phase === 'victory' ? 'victory' : phase === 'defeat' ? 'defeat' : 'build';
  useEffect(() => {
    music.setMood(mood);
  }, [mood]);
  return null;
}

// ── Desktop HUD ─────────────────────────────────────────────────────────────

function DesktopHud({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="hud-safe pointer-events-none absolute">
      <TopBar onMenu={onMenu} />
      <TowerShop />
      <div className="pointer-events-none absolute bottom-3 right-3 top-[4.5rem] flex w-[22rem] flex-col gap-2">
        <TowerPanel />
        <ExamLogHUD compact />
      </div>
      <GameControls onMenu={onMenu} />
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  useUiTick();
  const core = engine.core / CORE_MAX;
  return (
    <header className="pointer-events-auto absolute inset-x-3 top-3 flex h-12 items-center gap-3">
      <button type="button" onClick={onMenu} className="panel flex h-full items-center gap-2.5 px-3 text-left hover:border-cyan-400/40" title="Menu (Esc)">
        <Hexagon className="h-6 w-6 text-cyan-300" strokeWidth={1.6} />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight text-white">
            Lattice Lock<span className="text-cyan-300">:</span> <span className="font-medium text-cyan-200/90">Crystal Defender</span>
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">Structure · Bonding · Properties</div>
        </div>
        <Menu className="ml-1 h-4 w-4 text-slate-400" />
      </button>
      <div className="panel flex h-full flex-1 items-center gap-5 px-4">
        <div className="flex min-w-[11rem] items-center gap-2" title="Core integrity">
          <Shield className={`h-4 w-4 ${core < 0.35 ? 'text-rose-400' : 'text-cyan-300'}`} />
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Core</span>
              <span className="font-mono">{Math.ceil(engine.core)}%</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${core * 100}%`, background: `hsl(${core * 185} 85% 55%)` }} />
            </div>
          </div>
        </div>
        <Stat icon={<Atom className="h-4 w-4 text-amber-300" />} label="Moles" value={`${Math.floor(engine.moles)} mol`} />
        <Stat icon={<Waves className="h-4 w-4 text-rose-300" />} label="Wave" value={`${Math.min(engine.waveIndex + 1, WAVES.length)} / ${WAVES.length}`} />
        <Stat icon={<GraduationCap className="h-4 w-4 text-emerald-300" />} label="Marks" value={String(engine.marks)} />
        <div className="ml-auto hidden items-center gap-2 text-[11px] xl:flex">
          <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${engine.phase === 'wave' ? 'bg-rose-500/20 text-rose-200' : 'bg-cyan-500/15 text-cyan-200'}`}>
            {engine.phase === 'wave' ? (engine.paused ? 'Paused' : 'Combat') : engine.phase === 'build' ? 'Build phase' : engine.phase}
          </span>
        </div>
      </div>
    </header>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="leading-tight">
        <div className="text-[10px] text-slate-400">{label}</div>
        <div className="font-mono text-sm font-semibold text-slate-100">{value}</div>
      </div>
    </div>
  );
}

// ── Phone / tablet HUD ──────────────────────────────────────────────────────

function CompactHud({ layout, onMenu, onLog, logSeen }: { layout: LayoutMode; onMenu: () => void; onLog: () => void; logSeen: number }) {
  useUiTick();
  const unread = engine.logVersion > logSeen;
  const top = <CompactTopBar onMenu={onMenu} onLog={onLog} unread={unread} />;

  if (layout === 'landscape') {
    return (
      <div className="hud-safe pointer-events-none absolute flex gap-2 p-2">
        <CompactShop vertical />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {top}
          <div className="flex justify-center">
            <LogToast onOpen={onLog} />
          </div>
          <div className="flex-1" />
          <div className="flex w-full max-w-[26rem] flex-col gap-2 self-center">
            <PlacementBar />
            <CompactControls />
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-2 right-2 top-14 flex w-[16.5rem] flex-col justify-end">
          <div className="scroll-thin max-h-full overflow-y-auto">
            <TowerPanel />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hud-safe pointer-events-none absolute flex flex-col gap-2 p-2">
      {top}
      <div className="flex justify-center">
        <LogToast onOpen={onLog} />
      </div>
      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        <div className="scroll-thin max-h-[42vh] overflow-y-auto">
          <TowerPanel />
        </div>
        <PlacementBar />
        <CompactControls />
        <CompactShop />
      </div>
    </div>
  );
}
