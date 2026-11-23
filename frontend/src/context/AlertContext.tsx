import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ehsApi } from '../services/api';
import { useEhs } from './EhsContext';
import type { AlertSummary, AppNotificationItem } from '../types/ehs';

const POLL_MS = 30_000;

interface AlertContextValue {
  /** Live alert counts (null until first load or when signed out). */
  summary: AlertSummary | null;
  notifications: AppNotificationItem[];
  unreadCount: number;
  unreadCriticalOrHigh: number;
  /** Bumped after any change so lists/panels know to refetch. */
  version: number;
  refresh: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Alert detail panel (one place, opened from anywhere in the app). */
  openAlertId: string | null;
  openAlert: (alertId: string) => void;
  closeAlert: () => void;
  /** Full alert list drawer. */
  alertCenterOpen: boolean;
  openAlertCenter: () => void;
  closeAlertCenter: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { facilityId } = useEhs();
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCriticalOrHigh, setUnreadCriticalOrHigh] = useState(0);
  const [version, setVersion] = useState(0);
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const [alertCenterOpen, setAlertCenterOpen] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [sum, notes] = await Promise.all([ehsApi.getAlertSummary(facilityId), ehsApi.getNotifications(30)]);
      setSummary(sum);
      setNotifications(notes.items);
      setUnreadCount(notes.unread_count);
      setUnreadCriticalOrHigh(notes.unread_critical_or_high);
      setVersion(v => v + 1);
    } catch {
      // Keep the last known values; the bell simply stops updating until the backend is reachable.
    } finally {
      inFlight.current = false;
    }
  }, [facilityId]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      await ehsApi.markNotificationsRead(ids);
      await refresh();
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    await ehsApi.markAllNotificationsRead();
    await refresh();
  }, [refresh]);

  const value = useMemo<AlertContextValue>(
    () => ({
      summary,
      notifications,
      unreadCount,
      unreadCriticalOrHigh,
      version,
      refresh,
      markRead,
      markAllRead,
      openAlertId,
      openAlert: setOpenAlertId,
      closeAlert: () => setOpenAlertId(null),
      alertCenterOpen,
      openAlertCenter: () => setAlertCenterOpen(true),
      closeAlertCenter: () => setAlertCenterOpen(false),
    }),
    [summary, notifications, unreadCount, unreadCriticalOrHigh, version, refresh, markRead, markAllRead, openAlertId, alertCenterOpen]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
};

export function useAlerts(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used inside <AlertProvider>');
  return ctx;
}
