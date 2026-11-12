import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, BellRing } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SeverityIndicator } from './SeverityIndicator';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  level: 'critical' | 'high' | 'warning' | 'info';
  read: boolean;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: NotificationItem[];
  onMarkAllAsRead?: () => void;
  onSelectNotification?: (item: NotificationItem) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllAsRead,
  onSelectNotification,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-4 top-14 w-80 sm:w-96 bg-canvas-surface border border-line-subtle rounded-xl shadow-elevated z-50 overflow-hidden flex flex-col max-h-[480px] text-ink-primary"
          >
            <div className="p-3.5 border-b border-line-subtle bg-canvas-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-brand-purple" />
                <h3 className="text-xs font-semibold text-ink-primary">Safety System Alerts</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {onMarkAllAsRead && notifications.some((n) => !n.read) && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-[11px] text-brand-purple hover:underline flex items-center gap-1 px-1.5 py-0.5"
                  >
                    <Check className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1 rounded text-ink-muted hover:text-ink-primary hover:bg-canvas-muted transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-line-subtle">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-muted">
                  No unread safety alerts or telemetry events.
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectNotification?.(item)}
                    className={cn(
                      'p-3 hover:bg-canvas-subtle transition-colors cursor-pointer text-left',
                      !item.read && 'bg-brand-blue-soft/20'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <SeverityIndicator level={item.level} />
                        <span className="text-xs font-medium text-ink-primary">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-ink-muted whitespace-nowrap">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-secondary line-clamp-2 pl-4">
                      {item.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
