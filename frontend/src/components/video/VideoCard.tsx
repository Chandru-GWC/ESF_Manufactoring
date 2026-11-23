import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { VideoAnalysisResult } from '../../types/ehs';

interface VideoCardProps {
  title: string;
  scenario: string;
  /** Video shown as the card preview (first frame). */
  src: string | null;
  /** Latest analysis of this video, if any. */
  analysis: VideoAnalysisResult | null;
  actionLabel: string;
  actionDisabled?: boolean;
  actionHint?: string;
  onOpen: () => void;
}

type Tone = 'info' | 'ok' | 'bad' | 'warn' | 'idle';

const TONES: Record<Tone, string> = {
  info: 'bg-severity-info-bg text-severity-info-text border-severity-info-border',
  ok: 'bg-severity-success-bg text-severity-success-text border-severity-success-border',
  bad: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
  warn: 'bg-severity-high-bg text-severity-high-text border-severity-high-border',
  idle: 'bg-canvas-subtle text-ink-secondary border-line-default',
};

function describe(a: VideoAnalysisResult | null): { label: string; tone: Tone } {
  if (!a) return { label: 'Not analysed', tone: 'idle' };
  if (a.status === 'PROCESSING') return { label: `Analysing ${a.progress_pct}%`, tone: 'info' };
  if (a.status === 'FAILED') return { label: 'Analysis failed', tone: 'bad' };
  if (a.human_review_status === 'CONFIRMED') return { label: 'Confirmed detection', tone: 'bad' };
  if (a.human_review_status === 'DISMISSED') return { label: 'Dismissed', tone: 'idle' };
  if (a.event_detected) return { label: 'Needs review', tone: 'warn' };
  return { label: 'Analysis completed', tone: 'ok' };
}

/** One video as a card: preview, scenario, analysis status and one action. */
export const VideoCard: React.FC<VideoCardProps> = ({ title, scenario, src, analysis, actionLabel, actionDisabled, actionHint, onOpen }) => {
  const status = describe(analysis);
  // Only start downloading the preview when the card is (almost) on screen: 20 videos at once would block the page.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  const processing = analysis?.status === 'PROCESSING';
  return (
    <article className="flex flex-col rounded-xl bg-canvas-surface border border-line-subtle shadow-sm-subtle overflow-hidden">
      <div ref={frameRef} className="relative aspect-video overflow-hidden bg-slate-900">
        {src && visible ? (
          <video src={src} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" aria-label={`${title} preview`} />
        ) : !src ? (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono text-slate-400">No preview</div>
        ) : null}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${TONES[status.tone]}`}>
          {processing && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
          {status.label}
        </span>
        {processing && (
          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 px-3 py-2 space-y-1">
            <div className="h-1 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-brand-orange transition-all duration-500" style={{ width: `${Math.max(3, analysis?.progress_pct ?? 0)}%` }} />
            </div>
            <p className="text-[10px] font-mono text-slate-300 truncate">{analysis?.current_stage || 'Starting detection'}</p>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-bold text-ink-primary truncate" title={title}>
          {title}
        </h3>
        <p className="text-xs text-ink-secondary truncate">{scenario}</p>
        <button
          type="button"
          onClick={onOpen}
          disabled={actionDisabled}
          title={actionDisabled ? actionHint : undefined}
          className="mt-auto h-9 px-3 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:bg-canvas-subtle disabled:text-ink-muted disabled:border disabled:border-line-default disabled:cursor-not-allowed focus-ring"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
