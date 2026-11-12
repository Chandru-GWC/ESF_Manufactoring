import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DRAWER_TRANSITION } from '../../lib/motion';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footerActions,
  width = 'lg',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const widthClasses = {
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
  }[width];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 flex max-w-full pl-8 sm:pl-12">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={DRAWER_TRANSITION}
              className={cn(
                'w-screen bg-canvas-surface shadow-modal border-l border-line-subtle flex flex-col text-ink-primary',
                widthClasses
              )}
              role="dialog"
              aria-modal="true"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-line-subtle bg-canvas-subtle flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-base font-bold text-ink-primary font-mono">{title}</h2>
                    {badge}
                  </div>
                  {subtitle && <p className="text-xs text-ink-muted font-mono">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-canvas-muted transition-colors focus-ring shrink-0"
                  aria-label="Close inspector drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

              {/* Drawer Footer */}
              {footerActions && (
                <div className="p-4 border-t border-line-subtle bg-canvas-subtle flex items-center justify-end gap-2">
                  {footerActions}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
