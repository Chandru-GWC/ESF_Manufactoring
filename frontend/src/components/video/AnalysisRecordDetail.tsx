import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { ehsApi, mediaUrl } from '../../services/api';
import { VideoAnalysisResult } from '../../types/ehs';

/** Result of an uploaded video: both videos, summary and, when something was found, the detections. */
export const AnalysisRecordDetail: React.FC<{ record: VideoAnalysisResult; onChanged: () => void }> = ({ record, onChanged }) => {
  // Poll this record while it is being analysed so the window updates by itself.
  const [live, setLive] = useState(record);
  useEffect(() => setLive(record), [record]);
  useEffect(() => {
    if (live.status !== 'PROCESSING') return;
    const timer = window.setInterval(async () => {
      try {
        const next = await ehsApi.getVideoAnalysisById(live.analysis_id);
        setLive(next);
        if (next.status !== 'PROCESSING') onChanged();
      } catch {
        // keep polling
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [live.status, live.analysis_id, onChanged]);

  const failed = live.status === 'FAILED';
  const processing = live.status === 'PROCESSING';
  return (
    <section className="p-5 space-y-4" aria-label="Uploaded video result">
      <div className="space-y-1">
        <div className="text-sm font-bold text-ink-primary flex items-center gap-2">
          {failed && <XCircle className="w-4 h-4 text-severity-critical-text" aria-hidden="true" />}
          {processing && <Clock className="w-4 h-4 text-brand-orange" aria-hidden="true" />}
          {!failed && !processing && <CheckCircle2 className="w-4 h-4 text-severity-success-dot" aria-hidden="true" />}
          <span>
            {processing ? `Analysing video… ${live.progress_pct}%` : failed ? 'Analysis failed' : 'Analysis completed'}
          </span>
        </div>
        <div className="font-mono text-[11px] text-ink-muted">
          {live.filename} · {live.use_case.replace(/_/g, ' ')} · {live.analysis_id}
        </div>
        {processing && live.current_stage && <div className="text-xs text-ink-secondary">{live.current_stage}</div>}
      </div>

      {(live.original_video_url || live.annotated_video_url || live.evidence_frame_url) && (
        <div className={`grid grid-cols-1 gap-3 ${(live.original_video_url && live.annotated_video_url) || (live.evidence_frame_url && (live.original_video_url || live.annotated_video_url)) ? 'md:grid-cols-2' : ''}`}>
          {live.original_video_url && (
            <figure className="space-y-1">
              <video src={mediaUrl(live.original_video_url)} controls muted playsInline preload="metadata" className="w-full rounded-lg bg-slate-900 aspect-video object-contain" aria-label="Uploaded video" />
              <figcaption className="text-[11px] font-mono text-ink-muted">Uploaded video</figcaption>
            </figure>
          )}
          {live.annotated_video_url && (
            <figure className="space-y-1">
              <video src={mediaUrl(live.annotated_video_url)} controls muted playsInline preload="metadata" className="w-full rounded-lg bg-slate-900 aspect-video object-contain" aria-label="Video with detections" />
              <figcaption className="text-[11px] font-mono text-ink-muted">With detections drawn</figcaption>
            </figure>
          )}
          {live.evidence_frame_url && !live.annotated_video_url && (
            <figure className="space-y-1">
              <img src={mediaUrl(live.evidence_frame_url)} alt="Detection evidence frame" className="w-full rounded-lg bg-slate-900 aspect-video object-contain" />
              <figcaption className="text-[11px] font-mono text-ink-muted">Evidence frame snapshot</figcaption>
            </figure>
          )}
        </div>
      )}

      <p className="text-sm text-ink-secondary leading-relaxed">{failed ? live.error_message || live.summary : live.summary}</p>
      {!processing && !failed && (
        <p className="text-sm font-semibold text-ink-primary">
          {live.event_detected
            ? `${live.event_label || 'Safety event detected'}${live.event_timestamp_sec !== null ? ` at ${live.event_timestamp_sec.toFixed(1)}s` : ''} - needs human review`
            : 'No safety event detected'}
        </p>
      )}
    </section>
  );
};
