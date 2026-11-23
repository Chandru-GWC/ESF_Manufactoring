import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { LoadingSkeleton } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Window } from '../components/ui/Window';
import { AnalysisRecordDetail } from '../components/video/AnalysisRecordDetail';
import { ehsApi } from '../services/api';
import { useEhs } from '../context/EhsContext';
import { VideoAnalysisResult } from '../types/ehs';

/** Detection history: every video analysis that was run, as a table on its own page. */
export const DetectionHistoryView: React.FC = () => {
  const { facilityId } = useEhs();
  const [analyses, setAnalyses] = useState<VideoAnalysisResult[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VideoAnalysisResult | null>(null);

  const load = useCallback(async () => {
    setAnalysesLoading(true);
    setError(null);
    try {
      setAnalyses(await ehsApi.getVideoAnalyses(facilityId, 200));
    } catch (err: any) {
      setError(err?.message || 'Unable to load the detection history.');
    } finally {
      setAnalysesLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Link
          to="/monitoring"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary transition-colors focus-ring"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to videos</span>
        </Link>
      </div>

      {error && <ErrorState title="Unable to Load Detection History" message={error} onRetry={() => void load()} />}

          <section className="rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-line-subtle flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-orange shrink-0" aria-hidden="true" />
                  <span>Detection history</span>
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Every analysis that was run. Select a row to see its videos and result.
                </p>
              </div>
              <span className="font-mono text-[11px] text-ink-secondary">{analyses.length} records</span>
            </div>
            {analysesLoading ? (
              <div className="p-5">
                <LoadingSkeleton count={3} className="h-10" />
              </div>
            ) : analyses.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No Video Analyses Recorded"
                  description="Run an analysis on the Safety Video Intelligence page and it will be listed here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-canvas-subtle border-b border-line-subtle text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      <th className="py-2.5 px-4">Analysis ID</th>
                      <th className="py-2.5 px-3">Video ID</th>
                      <th className="py-2.5 px-3">Use Case</th>
                      <th className="py-2.5 px-3">Filename</th>
                      <th className="py-2.5 px-3">Detection</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Human Review</th>
                      <th className="py-2.5 px-4">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {analyses.map(item => (
                      <tr
                        key={item.analysis_id}
                        onClick={() => setSelected(item)}
                        className="hover:bg-canvas-subtle/70 align-top cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-brand-primary whitespace-nowrap">
                          {item.analysis_id}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-ink-secondary whitespace-nowrap">
                          {item.video_id || 'Direct'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-ink-primary whitespace-nowrap">
                          {item.use_case.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-ink-secondary max-w-[180px] truncate" title={item.filename}>
                          {item.filename}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {item.status === 'PROCESSING' ? (
                            <span className="inline-flex items-center gap-1 text-brand-primary font-semibold">
                              Processing ({item.progress_pct}%)
                            </span>
                          ) : item.status === 'FAILED' ? (
                            <span className="text-severity-critical-text font-semibold">Failed</span>
                          ) : item.event_detected ? (
                            <span className="text-severity-critical-text font-semibold">
                              {item.event_label || 'Detected'}
                            </span>
                          ) : (
                            <span className="text-severity-success-text font-semibold">No Detection</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-ink-secondary whitespace-nowrap">
                          {item.event_timestamp_sec !== null ? `${item.event_timestamp_sec.toFixed(2)}s` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-ink-primary whitespace-nowrap">
                          {item.human_review_status.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-4 text-ink-secondary max-w-xs truncate" title={item.summary}>
                          {item.summary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

      <Window
        open={selected !== null}
        title={selected ? `${selected.filename} - ${selected.analysis_id}` : 'Analysis'}
        onClose={() => setSelected(null)}
        widthClass="max-w-4xl"
      >
        {selected && <AnalysisRecordDetail record={selected} onChanged={() => void load()} />}
      </Window>
    </div>
  );
};
