import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { DashboardExportFormat } from '../../types/ehs';

interface ExportMenuProps {
  /** Resolves when the file has been handed to the browser; throws a readable Error on failure. */
  onExport: (format: DashboardExportFormat) => Promise<unknown>;
}

const ITEMS: { format: DashboardExportFormat; label: string; hint: string; icon: typeof FileText }[] = [
  { format: 'xlsx', label: 'Excel (.xlsx)', hint: 'The whole table', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', hint: 'A report with the figures', icon: FileText },
];

/** "Export as" dropdown: Excel or PDF. Closes on outside click or Escape; shows a spinner while the file is prepared. */
export const ExportMenu: React.FC<ExportMenuProps> = ({ onExport }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DashboardExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (format: DashboardExportFormat) => {
    setOpen(false);
    setBusy(format);
    setError(null);
    try {
      await onExport(format);
    } catch (err: any) {
      setError(err?.message || 'The file could not be created.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-3">
      {error && (
        <span
          role="alert"
          className="text-[11px] text-severity-critical-text bg-severity-critical-bg border border-severity-critical-border rounded-md px-2 py-1 max-w-[260px] truncate"
          title={error}
        >
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={busy !== null}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary transition-colors disabled:opacity-70 focus-ring"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="w-3.5 h-3.5 text-brand-primary" aria-hidden="true" />
        )}
        <span>{busy ? 'Preparing…' : 'Export as'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="menu"
          aria-label="Export as"
          className="absolute right-0 top-full mt-1.5 z-20 w-52 rounded-xl border border-line-subtle bg-canvas-surface shadow-xl p-1"
        >
          {ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.format} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void run(item.format)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-canvas-subtle focus-ring"
                >
                  <Icon className={`w-4 h-4 shrink-0 ${item.format === 'xlsx' ? 'text-green-600' : 'text-red-600'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-ink-primary">{item.label}</span>
                    <span className="block text-[10.5px] text-ink-muted">{item.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
