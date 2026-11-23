import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { AgentTableData } from '../../types/ehs';

const cell = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v));

function toCsv(columns: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [columns, ...rows].map(r => r.map(esc).join(',')).join('\n');
}

/** Compact data table chosen by the agent: sticky header, right-aligned numbers, scrolls inside, CSV download. */
export const AgentTable: React.FC<{ table: AgentTableData }> = ({ table }) => {
  const columns = useMemo(() => (Array.isArray(table?.columns) ? table.columns.map(String) : []), [table]);
  const rows = useMemo(() => (Array.isArray(table?.rows) ? table.rows.filter(Array.isArray) : []), [table]);
  const numericCol = useMemo(
    () => columns.map((_, ci) => rows.length > 0 && rows.every(r => r[ci] === null || r[ci] === undefined || typeof r[ci] === 'number')),
    [columns, rows]
  );
  if (columns.length === 0) return null;

  const download = () => {
    const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(table.title || 'ehs-agent-table').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-line-subtle bg-canvas-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line-subtle">
        <h4 className="text-sm font-bold text-ink-primary truncate">{table.title || 'Data'}</h4>
        <button
          type="button"
          onClick={download}
          className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-line-default text-[11px] font-semibold text-ink-primary hover:bg-canvas-subtle focus-ring"
        >
          <Download className="w-3 h-3" aria-hidden="true" />
          Download CSV
        </button>
      </div>
      <div className="overflow-auto max-h-[280px]">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-canvas-subtle text-ink-secondary z-10">
            <tr>
              {columns.map((c, ci) => (
                <th key={`${c}-${ci}`} className={`px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${numericCol[ci] ? 'text-right' : ''}`}>
                  {c.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-line-subtle even:bg-canvas-subtle/40 hover:bg-brand-subtle/50">
                {columns.map((_, ci) => (
                  <td key={ci} className={`px-3 py-1.5 whitespace-nowrap text-ink-primary ${numericCol[ci] ? 'text-right font-mono tabular-nums' : ''}`}>
                    {cell(r[ci])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-ink-muted">
                  No rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-1.5 text-[10px] font-mono text-ink-muted border-t border-line-subtle">
        {rows.length.toLocaleString('en-IN')} row{rows.length === 1 ? '' : 's'}
      </p>
    </div>
  );
};
