import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, BellRing, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AppNotificationItem } from '../../types/ehs';
import { SEVERITY_STYLE, notificationKindLabel, relativeTime } from '../alerts/alertUtils';

/** Legacy shape still referenced by EhsContext; the panel itself now shows backend notifications. */
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
  notifications?: AppNotificationItem[];
  unreadCount?: number;
  onMarkAllAsRead?: () => void;
  onSelectNotification?: (item: AppNotificationItem) => void;
  onViewAll?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  onMarkAllAsRead,
  onSelectNotification,
  onViewAll,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Notifications"
            className="fixed left-2 right-2 sm:left-auto sm:right-4 top-[68px] sm:w-96 bg-canvas-surface border border-line-subtle rounded-xl shadow-elevated z-50 overflow-hidden flex flex-col max-h-[calc(100vh-88px)] sm:max-h-[520px] text-ink-primary"
          >
            <div className="p-3.5 border-b border-line-subtle bg-canvas-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-brand-orange" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-ink-primary">Notifications</h3>
                {unreadCount > 0 && <span className="font-mono text-[10px] text-ink-muted">{unreadCount} unread</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {onMarkAllAsRead && unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllAsRead}
                    className="text-[11px] text-brand-primary hover:underline flex items-center gap-1 px-1.5 py-1 focus-ring rounded"
                  >
                    <Check className="w-3 h-3" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded text-ink-muted hover:text-ink-primary hover:bg-canvas-muted transition-colors focus-ring"
                  aria-label="Close notifications"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <ul className="overflow-y-auto flex-1 divide-y divide-line-subtle">
              {notifications.length === 0 ? (
                <li className="py-12 text-center text-xs text-ink-muted">No notifications yet.</li>
              ) : (
                notifications.map(item => (
                  <li key={item.notification_id}>
                    <button
                      type="button"
                      onClick={() => onSelectNotification?.(item)}
                      className={cn(
                        'w-full p-3 text-left hover:bg-canvas-subtle transition-colors flex gap-2.5 focus-ring',
                        !item.read && 'bg-brand-peach-soft/40'
                      )}
                    >
                      <span className={cn('w-1 rounded-full shrink-0', SEVERITY_STYLE[item.severity]?.bar ?? 'bg-ink-muted')} aria-hidden="true" />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wide text-ink-secondary">
                            {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" aria-label="Unread" />}
                            {notificationKindLabel(item.kind, item.escalation_level)}
                            <span className={cn('px-1.5 py-0.5 rounded border normal-case', SEVERITY_STYLE[item.severity]?.badge)}>
                              {SEVERITY_STYLE[item.severity]?.label ?? item.severity}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-ink-muted whitespace-nowrap">{relativeTime(item.created_at)}</span>
                        </span>
                        <span className={cn('block text-xs text-ink-primary leading-snug', !item.read && 'font-semibold')}>{item.title}</span>
                        <span className="block text-[11px] text-ink-secondary line-clamp-2">{item.message}</span>
                        {item.recipient && item.kind !== 'ALERT' && (
                          <span className="block text-[10px] text-ink-muted">To: {item.recipient}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="px-3.5 py-2.5 border-t border-line-subtle bg-canvas-subtle/60 space-y-1">
              {onViewAll && (
                <button
                  type="button"
                  onClick={onViewAll}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline focus-ring rounded"
                >
                  View all alerts <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
              <p className="text-[10px] text-ink-muted">Notifications are in-app only. Email, SMS and push are not configured.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
