import React, { useEffect, useState } from 'react';
import { ehsApi } from '../../services/api';
import { useAlerts } from '../../context/AlertContext';
import type { SafetyAlertItem } from '../../types/ehs';
import { AlertSeverityBadge } from './AlertSeverityBadge';
import { AlertStatusBadge } from './AlertStatusBadge';

/** Slim strip shown on a video analysis when a real alert was raised for it. Renders nothing otherwise. */
export const LinkedAlertStrip: React.FC<{ analysisId: string }> = ({ analysisId }) => {
  const { version, openAlert } = useAlerts();
  const [alert, setAlert] = useState<SafetyAlertItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    ehsApi
      .getAlerts({ source_ref: analysisId, limit: 1 })
      .then(res => {
        if (!cancelled) setAlert(res.items[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setAlert(null);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId, version]);

  if (!alert) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-line-default bg-canvas-surface">
      <div className="flex flex-wrap items-center gap-2 min-w-0 text-xs">
        <AlertSeverityBadge severity={alert.severity} />
        <span className="font-semibold text-ink-primary">
          Safety alert <span className="font-mono">{alert.alert_id}</span> raised
        </span>
        <AlertStatusBadge status={alert.status} />
      </div>
      <button
        type="button"
        onClick={() => openAlert(alert.alert_id)}
        className="px-3 h-8 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary focus-ring"
      >
        Open alert
      </button>
    </div>
  );
};
