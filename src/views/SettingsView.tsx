import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Sun, Lock, CheckCircle2, RefreshCw, Info, BookMarked, ShieldCheck } from 'lucide-react';
import { useEhs, REGULATORY_FRAMEWORKS } from '../context/EhsContext';
import { RegulatoryFramework } from '../types/ehs';

export const SettingsView: React.FC = () => {
  const {
    authUser,
    regulatoryFramework,
    setRegulatoryFramework,
    framework,
    overviewSummary,
    isDataConnected,
    isLoading,
    reloadAllData,
    lastSyncedAt,
  } = useEhs();

  const totalRows = overviewSummary
    ? overviewSummary.total_ehs_events +
      overviewSummary.total_workforce_records +
      overviewSummary.total_maintenance_work_orders
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Settings & Database Status"
        description="Inspect live Neon PostgreSQL connection state, operator session status, and reference terminology context."
        breadcrumbs={[
          { label: 'Insights & Admin' },
          { label: 'System Settings', active: true },
        ]}
        meta={
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
              isDataConnected
                ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                : 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isDataConnected ? 'Neon Connected' : 'Connecting...'}
          </span>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Enterprise Light Design System Posture */}
        <section className="p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle border-t-2 border-t-brand-primary space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                <Sun className="w-4 h-4 text-brand-primary" />
                <span>Enterprise Light Interface & Token System</span>
              </h2>
              <p className="text-xs text-ink-secondary mt-1">
                High-contrast light workspace standardized on semantic CSS custom properties.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg border border-line-subtle bg-canvas-subtle">
            <div>
              <span className="text-xs font-semibold text-ink-primary block">
                Active Visual Mode: Enterprise Light
              </span>
              <span className="text-[11px] font-mono text-ink-muted">
                Primary Font: Manrope • Telemetry: JetBrains Mono
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md bg-severity-success-bg text-severity-success-text border border-severity-success-border">
              <ShieldCheck className="w-3.5 h-3.5" />
              Enforced
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="p-2 rounded-lg border border-line-subtle bg-canvas-subtle text-center">
              <div className="w-full h-3 rounded bg-canvas-app border border-line-default mb-1.5" />
              <div className="text-[10px] font-mono text-ink-secondary">Canvas</div>
            </div>
            <div className="p-2 rounded-lg border border-line-subtle bg-canvas-subtle text-center">
              <div className="w-full h-3 rounded bg-brand-primary mb-1.5" />
              <div className="text-[10px] font-mono text-ink-secondary">Primary</div>
            </div>
            <div className="p-2 rounded-lg border border-line-subtle bg-canvas-subtle text-center">
              <div className="w-full h-3 rounded bg-brand-orange mb-1.5" />
              <div className="text-[10px] font-mono text-ink-secondary">Hazard</div>
            </div>
            <div className="p-2 rounded-lg border border-line-subtle bg-canvas-subtle text-center">
              <div className="w-full h-3 rounded bg-severity-success-dot mb-1.5" />
              <div className="text-[10px] font-mono text-ink-secondary">Verified</div>
            </div>
          </div>

          {authUser && (
            <div className="p-3 rounded-lg border border-line-subtle bg-canvas-subtle text-xs flex items-center justify-between">
              <div>
                <span className="text-ink-muted text-[11px] block">Signed-In Operator</span>
                <span className="font-semibold text-ink-primary">{authUser.full_name}</span>{' '}
                <span className="font-mono text-[11px] text-ink-muted">({authUser.email})</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-brand-subtle text-brand-primary font-mono text-[10px] font-semibold uppercase">
                {authUser.role}
              </span>
            </div>
          )}
        </section>

        {/* Reference Terminology Context */}
        <section className="p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle border-t-2 border-t-brand-blue space-y-4">
          <div>
            <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-brand-blue" />
              <span>Reference Standard Context (Display Only)</span>
            </h2>
            <p className="text-xs text-ink-secondary mt-1">
              Select terminology reference metadata shown in exports and reports.
            </p>
          </div>

          <select
            aria-label="Reference Standard Selector"
            value={regulatoryFramework}
            onChange={e => setRegulatoryFramework(e.target.value as RegulatoryFramework)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-line-default bg-canvas-subtle text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {Object.values(REGULATORY_FRAMEWORKS).map(f => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>

          <div className="p-3 rounded-lg bg-canvas-subtle border border-line-subtle text-[11px] text-ink-secondary flex items-start gap-2">
            <Info className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
            <span>
              <strong>Not an Automated Compliance Engine:</strong> {framework.authority} references are informational display notes only. Backend records are stored as verified operational facts.
            </span>
          </div>
        </section>

        {/* Neon Database Connection Panel */}
        <section className="p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle md:col-span-2 border-t-2 border-t-brand-orange space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand-orange" />
                <span>Neon PostgreSQL Backend Connection</span>
              </h2>
              <p className="text-xs text-ink-secondary mt-1">
                Isolated schema <code className="font-mono text-brand-primary">ehs_core</code> served via FastAPI REST endpoints.
              </p>
            </div>
            <button
              type="button"
              onClick={() => reloadAllData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-line-default bg-canvas-subtle hover:bg-canvas-muted text-ink-primary transition-colors disabled:opacity-50 focus-ring self-start"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-primary' : ''}`} />
              <span>Verify & Resync</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-line-subtle bg-canvas-subtle">
              <span className="text-ink-muted block text-[11px]">Backend Connection</span>
              <span className="font-mono font-bold text-ink-primary mt-0.5 block">
                {isDataConnected ? 'ACTIVE (SSL Required)' : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="p-3 rounded-lg border border-line-subtle bg-canvas-subtle">
              <span className="text-ink-muted block text-[11px]">Verified Fleet Records</span>
              <span className="font-mono font-bold text-ink-primary mt-0.5 block tabular-nums">
                {totalRows !== null ? `${totalRows.toLocaleString('en-IN')} rows` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-lg border border-line-subtle bg-canvas-subtle">
              <span className="text-ink-muted block text-[11px]">Last Verified Sync</span>
              <span className="font-mono font-bold text-ink-primary mt-0.5 block">
                {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : '—'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
