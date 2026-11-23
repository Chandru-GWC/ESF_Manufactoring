import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface WindowProps {
  open: boolean;
  /** Small caption in the title bar, also used as the accessible name. */
  title: string;
  onClose: () => void;
  /** Tailwind max-width class, default max-w-3xl. */
  widthClass?: string;
  children: React.ReactNode;
}

/**
 * A window on top of the page (not full screen): opens near the top, dims the page behind it and scrolls inside
 * itself. Close with the X button, Esc or a click outside.
 */
export const Window: React.FC<WindowProps> = ({ open, title, onClose, widthClass = 'max-w-3xl', children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  // Rendered on <body>: inside the animated page container a transform would make `fixed` relative to that
  // container (shifted, partly un-dimmed) instead of the browser window.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 lg:pl-[14rem]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={e => e.stopPropagation()}
        className={`w-full ${widthClass} max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-canvas-surface border border-line-subtle shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 bg-canvas-surface border-b border-line-subtle">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-secondary">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-ink-secondary hover:bg-canvas-subtle hover:text-ink-primary focus-ring"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>,
    document.body
  );
};
