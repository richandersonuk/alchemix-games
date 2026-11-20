import { Droplets, Flame, Hammer, Zap, type LucideIcon } from 'lucide-react';
import type { DamageType, Verdict } from '../../types/chemistry';

export const DAMAGE_ICON: Record<DamageType, LucideIcon> = {
  thermal: Flame,
  electrical: Zap,
  shear: Hammer,
  solvent: Droplets,
};

export const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  counter: { label: 'Counters', cls: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300' },
  neutral: { label: 'Holds', cls: 'border-amber-400/40 bg-amber-500/10 text-amber-200' },
  weak: { label: 'Fails', cls: 'border-rose-400/50 bg-rose-500/15 text-rose-300' },
};
