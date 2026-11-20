import { BookOpen } from 'lucide-react';
import { BONDING_META } from '../../data/lattices';
import { DAMAGE_META } from '../../data/waves';
import type { BondingType, DamageType } from '../../types/chemistry';
import { useCoarsePointer } from '../../hooks/useLayout';
import { DAMAGE_ICON } from './damageIcons';
import Modal from './Modal';

export default function HowToPlay({ onClose, cta = 'Got it' }: { onClose: () => void; cta?: string }) {
  const touch = useCoarsePointer();
  return (
    <Modal
      title="How to play"
      icon={<BookOpen className="h-5 w-5 text-cyan-300" />}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-primary min-h-[44px] px-6" data-autofocus>
            {cta}
          </button>
        </div>
      }
    >
      <p className="text-[15px] leading-relaxed text-slate-300">
        Physical disruptors are pouring down the lane toward the core crystal. Build barrier towers from <em>real</em> lattices. Every barrier behaves
        exactly as its structure and bonding predict, and every success or failure is logged in mark-scheme language — earn{' '}
        <strong className="text-emerald-300">marks</strong> for each correct structure → property match.
      </p>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-rose-300/80">The four disruptors</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(Object.keys(DAMAGE_META) as DamageType[]).map((d) => {
          const Icon = DAMAGE_ICON[d];
          return (
            <div key={d} className="flex gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: DAMAGE_META[d].color }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: DAMAGE_META[d].color }}>
                  {DAMAGE_META[d].label}
                </div>
                <p className="text-xs leading-snug text-slate-400">{DAMAGE_META[d].physics}</p>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-cyan-300/80">The four structures</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(Object.keys(BONDING_META) as BondingType[]).map((b) => (
          <div key={b} className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5">
            <div className="text-sm font-semibold" style={{ color: BONDING_META[b].color }}>
              {BONDING_META[b].label}
            </div>
            <p className="text-xs leading-snug text-slate-400">{BONDING_META[b].summary}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-slate-400">Controls</h3>
      {touch ? (
        <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] text-slate-300 sm:grid-cols-2">
          <li>Tap a lattice in the tray, then tap a tile</li>
          <li>Tap the same tile again (or <Kbd>Build</Kbd>) to confirm</li>
          <li>Drag with one finger to orbit the camera</li>
          <li>Pinch to zoom in on unit cells</li>
          <li>Tap a barrier to upgrade, inspect or reclaim it</li>
          <li><Kbd>ⓘ</Kbd> on any lattice opens its 3D unit cell</li>
        </ul>
      ) : (
        <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] text-slate-300 sm:grid-cols-2">
          <li><Kbd>Click</Kbd> lattice → <Kbd>Click</Kbd> tile to build</li>
          <li><Kbd>Drag</Kbd> orbit camera · <Kbd>Scroll</Kbd> zoom</li>
          <li><Kbd>1</Kbd>–<Kbd>9</Kbd> quick-select lattice</li>
          <li><Kbd>Space</Kbd> launch wave / pause</li>
          <li><Kbd>I</Kbd> inspect unit cell · <Kbd>U</Kbd> upgrade</li>
          <li><Kbd>Esc</Kbd> cancel / menu · right-click cancel</li>
        </ul>
      )}
    </Modal>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">{children}</kbd>;
}
