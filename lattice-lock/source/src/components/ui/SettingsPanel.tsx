import { useId } from 'react';
import { Gauge, Maximize, Minimize, Music, Settings2, Volume2, VolumeX, Waves } from 'lucide-react';
import { settings, useSettings, type Quality } from '../../engine/settings';
import { sfx } from '../../engine/audio';
import { useFullscreen } from '../../hooks/useLayout';
import Modal from './Modal';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const fs = useFullscreen();

  return (
    <Modal title="Settings" icon={<Settings2 className="h-5 w-5 text-cyan-300" />} onClose={onClose} width="max-w-md">
      <div className="space-y-5">
        <Slider
          icon={<Music className="h-4 w-4 text-violet-300" />}
          label="Music (BGM)"
          value={s.bgmVolume}
          onChange={(v) => settings.set({ bgmVolume: v })}
        />
        <Slider
          icon={<Waves className="h-4 w-4 text-cyan-300" />}
          label="Sound effects (SFX)"
          value={s.sfxVolume}
          onChange={(v) => settings.set({ sfxVolume: v })}
          onCommit={() => sfx.play('place')}
        />

        <Row
          icon={s.muted ? <VolumeX className="h-4 w-4 text-rose-300" /> : <Volume2 className="h-4 w-4 text-emerald-300" />}
          label="Mute all audio"
        >
          <Switch on={s.muted} onChange={(v) => settings.set({ muted: v })} label="Mute all audio" />
        </Row>

        <Row icon={fs.active ? <Minimize className="h-4 w-4 text-cyan-300" /> : <Maximize className="h-4 w-4 text-cyan-300" />} label="Full screen">
          {fs.supported ? (
            <Switch on={fs.active} onChange={() => void fs.toggle()} label="Full screen" />
          ) : (
            <span className="max-w-[11rem] text-right text-[11px] leading-snug text-slate-500">
              Not supported here — use “Add to Home Screen” for a full-screen app.
            </span>
          )}
        </Row>

        <Row icon={<Gauge className="h-4 w-4 text-amber-300" />} label="Graphics">
          <div className="flex overflow-hidden rounded-lg border border-slate-600/60" role="radiogroup" aria-label="Graphics quality">
            {(['low', 'high'] as Quality[]).map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={s.quality === q}
                onClick={() => settings.set({ quality: q })}
                className={`min-h-[40px] px-4 text-sm font-semibold capitalize ${s.quality === q ? 'bg-cyan-500/25 text-cyan-100' : 'bg-slate-800/60 text-slate-400'}`}
              >
                {q}
              </button>
            ))}
          </div>
        </Row>
        <p className="-mt-3 text-[11px] text-slate-500">Low turns off shadows and reduces particles — best for older laptops and phones.</p>
      </div>
    </Modal>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

function Slider({
  icon,
  label,
  value,
  onChange,
  onCommit,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-slate-200">
          {icon}
          {label}
        </label>
        <span className="w-10 text-right font-mono text-xs text-slate-400">{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="range w-full"
        style={{ ['--fill' as string]: `${value * 100}%` }}
      />
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${on ? 'border-cyan-300/60 bg-cyan-500/40' : 'border-slate-600 bg-slate-800'}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );
}
