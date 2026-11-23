import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MODAL_VARIANTS } from '../../lib/motion';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={onCancel}
            aria-hidden="true"
          />

          <motion.div
            ref={modalRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-desc"
            variants={MODAL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md bg-canvas-surface text-ink-primary rounded-xl shadow-modal border border-line-default p-6 z-10"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'p-2 rounded-lg border',
                    variant === 'danger'
                      ? 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
                      : variant === 'warning'
                      ? 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border'
                      : 'bg-brand-purple-soft text-brand-purple border-brand-purple/30'
                  )}
                >
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 id="modal-title" className="text-base font-semibold text-ink-primary">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="text-ink-muted hover:text-ink-primary p-1 rounded-lg hover:bg-canvas-muted focus-ring"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p id="modal-desc" className="text-xs text-ink-secondary leading-relaxed mb-6">
              {description}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 text-xs font-medium text-ink-primary bg-canvas-subtle border border-line-default hover:bg-canvas-muted rounded-lg transition-colors focus-ring"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  'px-3.5 py-2 text-xs font-semibold text-white rounded-lg transition-colors shadow-sm-subtle focus-ring',
                  variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : variant === 'warning'
                    ? 'bg-brand-orange hover:opacity-90'
                    : 'bg-brand-purple hover:bg-brand-hover'
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

