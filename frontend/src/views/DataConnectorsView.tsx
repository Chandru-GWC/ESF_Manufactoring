import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import {
  ConnectionTestResult,
  ConnectorResponse,
  DatabaseType,
  DriverStatusItem,
  PrimaryDatabaseInfo,
} from '../types/ehs';
import { Window } from '../components/ui/Window';
import { DatabaseExplorerDrawer } from '../components/connectors/DatabaseExplorerDrawer';

/**
 * Data Connectors: the platform's own database (Neon PostgreSQL, connected) plus the other systems that
 * can be connected. Click a card to see (or enter) host, port, database, username and password.
 */

interface CatalogEntry {
  id: string;
  name: string;
  subtitle: string;
  /** Backend adapter type. Null = no adapter exists yet (shown as "Coming soon"). */
  dbType: DatabaseType | null;
  defaultPort: number;
  hostHint: string;
  note?: string;
  /** File-based database: only a file path is needed (no host, port or login). */
  fileBased?: boolean;
}

const CATALOG: CatalogEntry[] = [
  { id: 'mysql', name: 'MySQL', subtitle: 'Relational database', dbType: 'mysql', defaultPort: 3306, hostHint: 'mysql.example.com' },
  { id: 'oracle', name: 'Oracle', subtitle: 'Oracle Database', dbType: 'oracle', defaultPort: 1521, hostHint: 'oracle.example.com', note: 'Database = the service name (for example ORCLPDB1).' },
  { id: 'sqlserver', name: 'SQL Server (SSMS)', subtitle: 'Microsoft SQL Server', dbType: 'sqlserver', defaultPort: 1433, hostHint: 'sqlserver.example.com' },
  { id: 'snowflake', name: 'Snowflake', subtitle: 'Cloud data warehouse', dbType: null, defaultPort: 443, hostHint: 'account.snowflakecomputing.com' },
  { id: 'mongodb', name: 'MongoDB', subtitle: 'Document database', dbType: 'mongodb', defaultPort: 27017, hostHint: 'mongo.example.com' },
  { id: 'sqlite', name: 'SQLite', subtitle: 'Local database file', dbType: 'sqlite', defaultPort: 0, hostHint: '', fileBased: true, note: 'Database = the path of the .db file on the server.' },
  { id: 'postgresql', name: 'PostgreSQL', subtitle: 'Another PostgreSQL server', dbType: 'postgresql', defaultPort: 5432, hostHint: 'postgres.example.com' },
];

type Selected = { kind: 'primary' } | { kind: 'catalog'; id: string } | null;

const inputCls =
  'w-full h-10 px-3 rounded-lg border border-line-default bg-canvas-subtle text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-60';

const StatusPill: React.FC<{ tone: 'ok' | 'bad' | 'idle' | 'soon'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls =
    tone === 'ok'
      ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
      : tone === 'bad'
      ? 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
      : tone === 'soon'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-canvas-subtle text-ink-secondary border-line-default';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${cls}`}>
      {tone === 'ok' && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
      {tone === 'bad' && <XCircle className="w-3 h-3" aria-hidden="true" />}
      {children}
    </span>
  );
};

const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono = true }) => (
  <div className="rounded-lg border border-line-subtle bg-canvas-subtle px-2.5 py-1.5">
    <dt className="text-[9px] font-mono uppercase tracking-wider text-ink-muted">{label}</dt>
    <dd className={`text-xs text-ink-primary break-all leading-snug ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</dd>
  </div>
);

export const DataConnectorsView: React.FC = () => {
  const [primary, setPrimary] = useState<PrimaryDatabaseInfo | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [connectors, setConnectors] = useState<ConnectorResponse[]>([]);
  const [drivers, setDrivers] = useState<DriverStatusItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Selected>(null);
  const [explorer, setExplorer] = useState<ConnectorResponse | null>(null);

  const loadPrimary = useCallback(async () => {
    setPrimaryLoading(true);
    try {
      setPrimary(await api.getPrimaryDatabase());
    } catch (err: any) {
      setPrimary(null);
      setLoadError(err?.message || 'Unable to read the primary database status.');
    } finally {
      setPrimaryLoading(false);
    }
  }, []);

  const loadConnectors = useCallback(async () => {
    try {
      const [list, driverRes] = await Promise.all([api.listConnectors(), api.getConnectorDriversStatus()]);
      setConnectors(list);
      setDrivers(driverRes.drivers);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load saved connectors.');
    }
  }, []);

  useEffect(() => {
    void loadPrimary();
    void loadConnectors();
  }, [loadPrimary, loadConnectors]);

  const choose = (next: Selected) => setSelected(next);

  const savedByType = useMemo(() => {
    const map = new Map<string, ConnectorResponse[]>();
    for (const c of connectors) map.set(c.db_type, [...(map.get(c.db_type) ?? []), c]);
    return map;
  }, [connectors]);

  const connectedCount =
    (primary?.status === 'CONNECTED' ? 1 : 0) + connectors.filter(c => c.status === 'CONNECTED').length;
  const selectedEntry = selected?.kind === 'catalog' ? CATALOG.find(c => c.id === selected.id) : undefined;

  return (
    <div className="w-full space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
            <span className="w-5 h-0.5 bg-brand-orange" aria-hidden="true" />
            Data Connectors
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary mt-2">Connected data sources</h1>
          <p className="text-sm text-ink-secondary mt-1">
            {connectedCount} connected. Click a card to see its connection details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadPrimary();
            void loadConnectors();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary focus-ring"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${primaryLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loadError && (
        <p role="alert" className="text-xs text-severity-critical-text bg-severity-critical-bg border border-severity-critical-border rounded-lg px-3 py-2">
          {loadError}
        </p>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => choose({ kind: 'primary' })}
          aria-pressed={selected?.kind === 'primary'}
          className={`text-left rounded-xl border p-4 space-y-3 bg-canvas-surface shadow-sm-subtle transition-colors focus-ring ${
            selected?.kind === 'primary' ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-line-subtle hover:border-line-default'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="p-2 rounded-lg bg-brand-subtle text-brand-primary">
              <Database className="w-5 h-5" aria-hidden="true" />
            </span>
            {primaryLoading && !primary ? (
              <StatusPill tone="idle">Checking…</StatusPill>
            ) : primary?.status === 'CONNECTED' ? (
              <StatusPill tone="ok">Connected</StatusPill>
            ) : (
              <StatusPill tone="bad">Not connected</StatusPill>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink-primary">{primary?.name ?? 'Neon PostgreSQL'}</h2>
            <p className="text-xs text-ink-secondary">Primary database · EHS data</p>
          </div>
          <p className="text-[11px] font-mono text-ink-muted truncate">
            {primary?.host ? `${primary.host}:${primary.port ?? ''}` : 'host not available'}
          </p>
        </button>

        {CATALOG.map(entry => {
          const saved = savedByType.get(entry.dbType ?? '') ?? [];
          const connected = saved.find(c => c.status === 'CONNECTED');
          const failed = !connected && saved.find(c => c.status === 'FAILED');
          const active = selected?.kind === 'catalog' && selected.id === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => choose({ kind: 'catalog', id: entry.id })}
              aria-pressed={active}
              className={`text-left rounded-xl border p-4 space-y-3 bg-canvas-surface shadow-sm-subtle transition-colors focus-ring ${
                active ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-line-subtle hover:border-line-default'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="p-2 rounded-lg bg-canvas-subtle text-ink-secondary">
                  <Database className="w-5 h-5" aria-hidden="true" />
                </span>
                {entry.dbType === null ? (
                  <StatusPill tone="soon">Coming soon</StatusPill>
                ) : connected ? (
                  <StatusPill tone="ok">Connected</StatusPill>
                ) : failed ? (
                  <StatusPill tone="bad">Failed</StatusPill>
                ) : (
                  <StatusPill tone="idle">Not connected</StatusPill>
                )}
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-primary">{entry.name}</h2>
                <p className="text-xs text-ink-secondary">{entry.subtitle}</p>
              </div>
              <p className="text-[11px] font-mono text-ink-muted">
                {saved.length > 0 ? `${saved.length} saved connection${saved.length > 1 ? 's' : ''}` : `Default port ${entry.defaultPort}`}
              </p>
            </button>
          );
        })}
      </div>

      {/* Details of the selected card: a window on top of the page, not the whole screen */}
      <Window
        open={selected !== null}
        title={`${selected?.kind === 'primary' ? primary?.name ?? 'Neon PostgreSQL' : selectedEntry?.name ?? ''} connection details`}
        onClose={() => setSelected(null)}
      >
        {selected?.kind === 'primary' && <PrimaryDetail info={primary} loading={primaryLoading} onRefresh={loadPrimary} />}
        {selectedEntry && (
          <CatalogDetail
            key={selectedEntry.id}
            entry={selectedEntry}
            saved={savedByType.get(selectedEntry.dbType ?? '') ?? []}
            driver={drivers.find(d => d.db_type === selectedEntry.dbType)}
            onChanged={loadConnectors}
            onBrowse={setExplorer}
          />
        )}
      </Window>

      <DatabaseExplorerDrawer isOpen={!!explorer} onClose={() => setExplorer(null)} connector={explorer} />
    </div>
  );
};

const PrimaryDetail: React.FC<{ info: PrimaryDatabaseInfo | null; loading: boolean; onRefresh: () => void }> = ({ info, loading, onRefresh }) => {
  if (!info) {
    return (
      <section className="p-5 text-sm text-ink-secondary">
        {loading ? 'Reading the primary database…' : 'The primary database status is not available.'}
      </section>
    );
  }
  return (
    <section className="p-4 space-y-3" aria-label="Primary database details">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
            {info.name}
            {info.status === 'CONNECTED' ? <StatusPill tone="ok">Connected</StatusPill> : <StatusPill tone="bad">Not connected</StatusPill>}
          </h3>
          <p className="text-[11px] text-ink-secondary mt-0.5">
            The platform's own database. The password is never sent to the browser.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary focus-ring"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Check again
        </button>
      </div>

      {info.error && (
        <p role="alert" className="text-xs text-severity-critical-text bg-severity-critical-bg border border-severity-critical-border rounded-lg px-3 py-2">
          {info.error}
        </p>
      )}

      <dl className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <Field label="Host" value={info.host} />
        <Field label="Port" value={info.port} />
        <Field label="Database" value={info.database_name} />
        <Field label="Username" value={info.username} />
        <Field label="Password" value={info.password_masked ?? 'not set'} />
        <Field label="SSL mode" value={info.ssl_mode} />
        <Field label="Schema" value={info.schema} />
        <Field label="Server version" value={info.server_version} />
        <Field label="Response time" value={info.latency_ms !== null ? `${info.latency_ms} ms` : null} />
      </dl>

      {info.tables.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1.5">Tables the platform reads</h4>
          <ul className="divide-y divide-line-subtle rounded-lg border border-line-subtle">
            {info.tables.map(t => (
              <li key={t.table} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="font-mono text-ink-primary">{t.table}</span>
                <span className="font-mono text-ink-secondary">{t.rows.toLocaleString('en-IN')} rows</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const CatalogDetail: React.FC<{
  entry: CatalogEntry;
  saved: ConnectorResponse[];
  driver?: DriverStatusItem;
  onChanged: () => void | Promise<void>;
  onBrowse: (c: ConnectorResponse) => void;
}> = ({ entry, saved, driver, onChanged, onBrowse }) => {
  const supported = entry.dbType !== null;
  const driverMissing = supported && driver && !driver.installed;
  const disabled = !supported || !!driverMissing;

  const [host, setHost] = useState('');
  const [port, setPort] = useState(String(entry.defaultPort));
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'test' | 'save' | string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const payload = () => ({
    db_type: entry.dbType as DatabaseType,
    host: entry.fileBased ? undefined : host.trim(),
    port: entry.fileBased ? undefined : Number(port) || entry.defaultPort,
    database_name: database.trim() || undefined,
    username: entry.fileBased ? undefined : username.trim() || undefined,
    password: entry.fileBased ? undefined : password || undefined,
  });
  const complete = entry.fileBased ? database.trim() !== '' : host.trim() !== '' && username.trim() !== '';

  const test = async () => {
    setBusy('test');
    setResult(null);
    try {
      const res: ConnectionTestResult = await api.testTransientConnection(payload());
      setResult({ ok: res.success, message: res.success ? `Connection works${res.latency_ms !== null ? ` (${res.latency_ms} ms)` : ''}.` : res.message });
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'The connection test failed.' });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setResult(null);
    try {
      await api.createConnector({ ...payload(), name: `${entry.name} - ${entry.fileBased ? database.trim() : host.trim()}`, test_before_save: true, read_only: true });
      setResult({ ok: true, message: 'Connected and saved.' });
      setPassword('');
      await onChanged();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'The connection could not be saved.' });
    } finally {
      setBusy(null);
    }
  };

  const retest = async (c: ConnectorResponse) => {
    setBusy(c.connector_id);
    setResult(null);
    try {
      const res = await api.testSavedConnector(c.connector_id);
      setResult({ ok: res.success, message: res.success ? `${c.name}: connection works.` : `${c.name}: ${res.message}` });
      await onChanged();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'The connection test failed.' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: ConnectorResponse) => {
    if (!window.confirm(`Delete the saved connection "${c.name}"?`)) return;
    setBusy(c.connector_id);
    try {
      await api.deleteConnector(c.connector_id);
      await onChanged();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'The connection could not be deleted.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="p-5 space-y-5" aria-label={`${entry.name} connection`}>
      <div>
        <h3 className="text-base font-bold text-ink-primary flex items-center gap-2">
          {entry.name}
          {!supported ? <StatusPill tone="soon">Coming soon</StatusPill> : saved.some(c => c.status === 'CONNECTED') ? <StatusPill tone="ok">Connected</StatusPill> : <StatusPill tone="idle">Not connected</StatusPill>}
        </h3>
        <p className="text-xs text-ink-secondary mt-0.5">{entry.subtitle}</p>
      </div>

      {!supported && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Snowflake is not supported yet: the platform has no Snowflake adapter or driver. The form below shows the details it will need.
        </p>
      )}
      {driverMissing && driver && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          The {driver.driver_name} driver is not installed on the server. Install it with <span className="font-mono">{driver.install_command}</span>.
        </p>
      )}

      {saved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">Saved connections</h4>
          {saved.map(c => (
            <div key={c.connector_id} className="rounded-lg border border-line-subtle p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-primary">{c.name}</span>
                  <StatusPill tone={c.status === 'CONNECTED' ? 'ok' : c.status === 'FAILED' ? 'bad' : 'idle'}>
                    {c.status === 'CONNECTED' ? 'Connected' : c.status === 'FAILED' ? 'Failed' : 'Not connected'}
                  </StatusPill>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void retest(c)} disabled={busy === c.connector_id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line-default text-xs font-semibold text-ink-primary hover:bg-canvas-subtle disabled:opacity-60 focus-ring">
                    {busy === c.connector_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Plug className="w-3.5 h-3.5" aria-hidden="true" />}
                    Test
                  </button>
                  <button type="button" onClick={() => onBrowse(c)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line-default text-xs font-semibold text-ink-primary hover:bg-canvas-subtle focus-ring">
                    <Search className="w-3.5 h-3.5" aria-hidden="true" />
                    Browse tables
                  </button>
                  <button type="button" onClick={() => void remove(c)} disabled={busy === c.connector_id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-severity-critical-border text-xs font-semibold text-severity-critical-text hover:bg-severity-critical-bg disabled:opacity-60 focus-ring">
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
              <dl className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <Field label="Host" value={c.host} />
                <Field label="Port" value={c.port} />
                <Field label="Database" value={c.database_name} />
                <Field label="Username" value={c.username} />
                <Field label="Password" value={c.masked_password ?? 'not set'} />
              </dl>
              {c.last_error_message && c.status === 'FAILED' && <p className="text-[11px] text-severity-critical-text">{c.last_error_message}</p>}
            </div>
          ))}
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">{saved.length > 0 ? 'Add another connection' : 'Connection details'}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {!entry.fileBased && (
            <>
          <label className="space-y-1 text-xs font-semibold text-ink-secondary">
            Host
            <input className={inputCls} value={host} onChange={e => setHost(e.target.value)} placeholder={entry.hostHint} disabled={disabled} autoComplete="off" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-ink-secondary">
            Port
            <input className={inputCls} value={port} onChange={e => setPort(e.target.value.replace(/\D/g, ''))} inputMode="numeric" disabled={disabled} />
          </label>
            </>
          )}
          <label className="space-y-1 text-xs font-semibold text-ink-secondary">
            {entry.fileBased ? 'Database file path' : 'Database'}
            <input className={inputCls} value={database} onChange={e => setDatabase(e.target.value)} disabled={disabled} autoComplete="off" />
          </label>
          {!entry.fileBased && (
            <>
          <label className="space-y-1 text-xs font-semibold text-ink-secondary">
            Username
            <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} disabled={disabled} autoComplete="off" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-ink-secondary">
            Password
            <span className="relative block">
              <input
                className={`${inputCls} pr-10`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={disabled}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                disabled={disabled}
                className="absolute inset-y-0 right-0 px-3 text-ink-muted hover:text-ink-primary focus-ring rounded-r-lg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>
            </>
          )}
        </div>
        {entry.note && <p className="text-[11px] text-ink-muted">{entry.note}</p>}

        {result && (
          <p role="status" className={`text-xs rounded-lg border px-3 py-2 ${result.ok ? 'text-severity-success-text bg-severity-success-bg border-severity-success-border' : 'text-severity-critical-text bg-severity-critical-bg border-severity-critical-border'}`}>
            {result.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void test()}
            disabled={disabled || !complete || busy !== null}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-line-default bg-canvas-surface text-sm font-semibold text-ink-primary hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {busy === 'test' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Test connection
          </button>
          <button
            type="submit"
            disabled={disabled || !complete || busy !== null}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-sm font-semibold disabled:bg-canvas-subtle disabled:text-ink-muted disabled:border disabled:border-line-default disabled:cursor-not-allowed focus-ring"
          >
            {busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save &amp; connect
          </button>
        </div>
        <p className="text-[11px] text-ink-muted">Passwords are encrypted on the server and only a mask is shown afterwards. Connections are read-only.</p>
      </form>
    </section>
  );
};
