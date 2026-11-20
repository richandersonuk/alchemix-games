import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { engine } from '../../hooks/useEngine';

/** Pauses combat while mounted (if it was running) and resumes on unmount. */
export function usePauseWhileOpen(open = true) {
  const paused = useRef(false);
  useEffect(() => {
    if (!open) return;
    if (engine.phase === 'wave' && !engine.paused) {
      engine.setPaused(true);
      paused.current = true;
    }
    return () => {
      if (paused.current) engine.setPaused(false);
      paused.current = false;
    };
  }, [open]);
}

export default function Modal({
  title,
  icon,
  onClose,
  children,
  width = 'max-w-lg',
  footer,
}: {
  title: string;
  icon?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
}) {
  usePauseWhileOpen();
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const c = card.current;
    (c?.querySelector<HTMLElement>('[data-autofocus]') ?? c?.querySelector<HTMLElement>('input, button'))?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="hud-safe fixed z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel flex max-h-full w-full ${width} flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-cyan-400/10 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            {icon}
            {title}
          </h2>
          {onClose && (
            <button type="button" onClick={onClose} className="tap-target rounded-md text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <footer className="border-t border-cyan-400/10 px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
