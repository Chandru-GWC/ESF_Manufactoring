import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Play,
  ShieldAlert,
  Video,
  XCircle,
  Camera,
  Layers,
  Cpu,
  UserCheck,
} from 'lucide-react';
import { CleanVideo } from '../ui/CleanVideo';
import { LinkedAlertStrip } from '../alerts/LinkedAlertStrip';
import { mediaUrl } from '../../services/api';
import {
  VideoAnalysisResult,
  VideoLibraryGroup,
  VideoLibraryItem,
} from '../../types/ehs';

interface VideoAnalysisWorkspaceProps {
  selectedVideo: VideoLibraryItem;
  selectedGroup: VideoLibraryGroup | null;
  scenarioVideos: VideoLibraryItem[];
  selectedModelConfigured: boolean;
  activeAnalysis: VideoAnalysisResult | null;
  triggeringVideoId: string | null;
  actionError: string | null;
  reviewComment: string;
  reviewSaving: boolean;
  scenarioTitle: string;
  ScenarioIcon: React.ComponentType<{ className?: string }>;
  onSelectVideo: (video: VideoLibraryItem) => void;
  onAnalyzeVideo: (video: VideoLibraryItem) => Promise<void>;
  onReviewDecision: (
    analysisId: string,
    decision: 'CONFIRMED' | 'DISMISSED'
  ) => Promise<void>;
  onReviewCommentChange: (comment: string) => void;
  onBackToLibrary: () => void;
}

/** Format file sizes in human-readable units */
function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Format duration in seconds */
function formatDuration(sec?: number | null): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—';
  return `${sec.toFixed(1)}s`;
}

/** Resolves visual status pill configuration */
function resolveStatusPill(
  analysis: VideoAnalysisResult | null,
  configured: boolean
): { label: string; className: string } {
  if (!configured) {
    return {
      label: 'Model not configured',
      className: 'bg-canvas-subtle text-ink-muted border-line-default',
    };
  }
  if (!analysis) {
    return {
      label: 'Model Ready',
      className: 'bg-severity-info-bg text-severity-info-text border-severity-info-border',
    };
  }
  if (analysis.status === 'PROCESSING') {
    return {
      label: `Processing ${analysis.progress_pct}%`,
      className: 'bg-severity-info-bg text-severity-info-text border-severity-info-border',
    };
  }
  if (analysis.status === 'FAILED') {
    return {
      label: 'Failed',
      className: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
    };
  }
  if (analysis.human_review_status === 'CONFIRMED') {
    return {
      label: 'Confirmed Detection',
      className: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
    };
  }
  if (analysis.human_review_status === 'DISMISSED') {
    return {
      label: 'Dismissed (False Positive)',
      className: 'bg-canvas-subtle text-ink-secondary border-line-default',
    };
  }
  if (analysis.event_detected) {
    return {
      label: 'Needs Human Review',
      className: 'bg-severity-high-bg text-severity-high-text border-severity-high-border',
    };
  }
  return {
    label: 'No Event Detected',
    className: 'bg-severity-success-bg text-severity-success-text border-severity-success-border',
  };
}

/** Clean collapsible panel for structured disclosure */
const WorkspaceCollapsible: React.FC<{
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon: Icon, hint, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line-subtle bg-canvas-surface overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 text-left hover:bg-canvas-subtle transition-colors focus-ring"
      >
        <span className="text-xs font-bold text-ink-primary flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-ink-muted shrink-0" />}
          <span>{title}</span>
          {hint && (
            <span className="font-mono text-[10px] font-semibold text-ink-muted">
              {hint}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-150 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="px-3.5 sm:px-4 pb-3.5 pt-1 border-t border-line-subtle/50">{children}</div>}
    </div>
  );
};

export const VideoAnalysisWorkspace: React.FC<VideoAnalysisWorkspaceProps> = ({
  selectedVideo,
  selectedGroup,
  scenarioVideos,
  selectedModelConfigured,
  activeAnalysis,
  triggeringVideoId,
  actionError,
  reviewComment,
  reviewSaving,
  scenarioTitle,
  ScenarioIcon,
  onSelectVideo,
  onAnalyzeVideo,
  onReviewDecision,
  onReviewCommentChange,
  onBackToLibrary,
}) => {
  const evidenceImgUrl = activeAnalysis?.evidence_frame_url
    ? mediaUrl(activeAnalysis.evidence_frame_url)
    : null;
  const annotatedVideoUrl = activeAnalysis?.annotated_video_url
    ? mediaUrl(activeAnalysis.annotated_video_url)
    : null;

  const isAnalysisReady =
    activeAnalysis &&
    activeAnalysis.status !== 'PROCESSING' &&
    activeAnalysis.status !== 'FAILED';

  return (
    <section>
      {/* 1. Header Toolbar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3 bg-canvas-subtle/70">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToLibrary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary transition-colors focus-ring shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <ScenarioIcon className="w-4 h-4 text-brand-orange shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-bold text-ink-primary truncate">
              {scenarioTitle}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-ink-muted">Video ID:</span>
          <span
            className="font-bold text-ink-primary truncate max-w-[200px]"
            title={selectedVideo.filename}
          >
            {selectedVideo.video_id}
          </span>
        </div>
      </div>

      {/* 2. Scenario Video Switcher (If multiple library clips available) */}
      {scenarioVideos.length > 1 && (
        <div
          className="px-4 sm:px-5 py-2.5 bg-canvas-subtle/30 border-b border-line-subtle flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Scenario videos"
        >
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">
            Available Clips ({scenarioVideos.length}):
          </span>
          {scenarioVideos.map(v => (
            <button
              key={v.video_id}
              type="button"
              onClick={() => onSelectVideo(v)}
              aria-pressed={selectedVideo.video_id === v.video_id}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors focus-ring max-w-[260px] truncate ${
                selectedVideo.video_id === v.video_id
                  ? 'bg-brand-primary text-white border-brand-primary shadow-xs'
                  : 'bg-canvas-surface text-ink-secondary border-line-subtle hover:text-ink-primary hover:border-line-default'
              }`}
              title={v.filename}
            >
              {v.title}
            </button>
          ))}
        </div>
      )}

      {/* Workspace Inner Container */}
      <div className="p-4 sm:p-5 lg:p-6 space-y-5 lg:space-y-6">
        {/* ========================================================================= */}
        {/* TOP SECTION — Balanced Two Columns:                                       */}
        {/* Left: Video Player, Stream Specs, Action Button                           */}
        {/* Right: Detection Summary, Annotated Output, Captured Evidence Frame       */}
        {/* The two columns naturally balance in height, eliminating blank areas!    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 lg:gap-6 items-start">
          {/* TOP LEFT COLUMN: Surveillance Video + Action Controls */}
          <div className="space-y-3.5 min-w-0">
            {/* Primary Surveillance Video Player */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-primary flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-brand-orange" />
                  <span>Primary Surveillance Stream</span>
                </span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {selectedVideo.fps ? `${selectedVideo.fps} FPS` : '15-30 FPS'}
                </span>
              </div>

              <CleanVideo
                key={selectedVideo.video_id}
                src={mediaUrl(selectedVideo.stream_url)}
                label={`${selectedVideo.title} preview`}
                fit="contain"
              />
            </div>

            {/* Video Stream Specifications */}
            <WorkspaceCollapsible title="Video stream specifications" icon={Layers} defaultOpen={false}>
              <div className="space-y-2 text-xs pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Scenario Domain</span>
                  <span className="font-semibold text-ink-primary">{selectedVideo.use_case_title}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Duration / File Size</span>
                  <span className="font-mono text-ink-primary">
                    {formatDuration(selectedVideo.duration_sec)} · {formatFileSize(selectedVideo.file_size_bytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Native Resolution</span>
                  <span className="font-mono text-ink-primary">
                    {selectedVideo.width && selectedVideo.height
                      ? `${selectedVideo.width} × ${selectedVideo.height}`
                      : '1080p HD'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Vision Model</span>
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      selectedModelConfigured ? 'text-severity-success-text' : 'text-ink-muted'
                    }`}
                  >
                    {selectedModelConfigured
                      ? selectedGroup?.model_status.model_name || 'Model Ready'
                      : 'Model not configured'}
                  </span>
                </div>
              </div>
            </WorkspaceCollapsible>

            {/* Re-Run Analysis Action Trigger */}
            <div className="pt-0.5 space-y-2">
              <button
                type="button"
                disabled={
                  !selectedModelConfigured ||
                  !selectedVideo.available ||
                  triggeringVideoId === selectedVideo.video_id ||
                  activeAnalysis?.status === 'PROCESSING'
                }
                onClick={() => onAnalyzeVideo(selectedVideo)}
                className="w-full h-10 px-4 rounded-xl bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-sm-subtle"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {!selectedModelConfigured
                    ? 'Model not configured'
                    : activeAnalysis?.status === 'PROCESSING'
                    ? 'Analysis Running...'
                    : triggeringVideoId === selectedVideo.video_id
                    ? 'Starting Worker...'
                    : activeAnalysis
                    ? 'Re-Run Safety Analysis'
                    : 'Analyze Video'}
                </span>
              </button>

              {!selectedModelConfigured && selectedGroup && (
                <p className="text-[11px] text-ink-secondary bg-canvas-subtle border border-line-subtle rounded-lg px-3 py-2 leading-relaxed">
                  {selectedGroup.model_status.message}
                </p>
              )}
            </div>
          </div>

          {/* TOP RIGHT COLUMN: Detection Summary, Annotated Output & Captured Evidence */}
          <div className="space-y-4 min-w-0">
            {/* Action Error Banner */}
            {actionError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-severity-critical-border bg-severity-critical-bg text-severity-critical-text text-xs flex items-start justify-between gap-3 shadow-xs"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
                {selectedModelConfigured && (
                  <button
                    type="button"
                    onClick={() => onAnalyzeVideo(selectedVideo)}
                    className="px-2.5 py-1 rounded bg-canvas-surface border border-severity-critical-border font-semibold shrink-0 hover:bg-canvas-subtle"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {/* Empty Ready State */}
            {!activeAnalysis ? (
              <div className="rounded-xl border border-dashed border-line-default bg-canvas-subtle/50 p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-canvas-surface border border-line-subtle flex items-center justify-center">
                  <Video className="w-5 h-5 text-ink-muted" />
                </div>
                <h4 className="text-sm font-bold text-ink-primary">
                  {selectedModelConfigured
                    ? 'Ready to Analyze Selected Video'
                    : 'Model Not Configured'}
                </h4>
                <p className="text-xs text-ink-secondary max-w-md leading-relaxed">
                  {selectedModelConfigured
                    ? `Preview '${selectedVideo.filename}' on the left, then click Analyze Video to run ${
                        selectedGroup?.model_status.model_name || 'the safety detector'
                      } and persist timestamped evidence in Neon PostgreSQL.`
                    : selectedGroup?.model_status.message}
                </p>
              </div>
            ) : activeAnalysis.status === 'PROCESSING' ? (
              /* Inference Running State */
              <div className="p-5 rounded-xl border border-line-subtle bg-canvas-subtle space-y-4 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-brand-primary block">
                      {activeAnalysis.analysis_id} · RUNNING INFERENCE
                    </span>
                    <span className="text-xs text-ink-secondary">
                      {activeAnalysis.current_stage || 'Processing video frames...'}
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-ink-primary tabular-nums">
                    {activeAnalysis.progress_pct}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-canvas-muted overflow-hidden">
                  <div
                    className="h-full bg-brand-primary transition-all duration-300"
                    style={{ width: `${Math.max(4, activeAnalysis.progress_pct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
                  <span>Model: {activeAnalysis.model_used || 'CV Worker'}</span>
                  <span>
                    Frames: {activeAnalysis.frames_processed}
                    {activeAnalysis.total_frames ? ` / ${activeAnalysis.total_frames}` : ''}
                  </span>
                </div>
              </div>
            ) : activeAnalysis.status === 'FAILED' ? (
              /* Failed Analysis State */
              <div className="p-5 rounded-xl border border-severity-critical-border bg-severity-critical-bg space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-severity-critical-text font-bold text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>Analysis Failed ({activeAnalysis.analysis_id})</span>
                  </div>
                  {selectedModelConfigured && (
                    <button
                      type="button"
                      onClick={() => onAnalyzeVideo(selectedVideo)}
                      className="px-3 py-1 rounded-lg bg-canvas-surface text-ink-primary border border-line-default text-xs font-semibold hover:bg-canvas-subtle"
                    >
                      Retry Analysis
                    </button>
                  )}
                </div>
                <p className="text-xs text-severity-critical-text">
                  {activeAnalysis.error_message || activeAnalysis.summary}
                </p>
              </div>
            ) : (
              /* Completed Top Right: Detection Summary & Evidence Frames */
              <div className="space-y-4">
                {/* Linked Alert Indicator (If hazard detected) */}
                {activeAnalysis.event_detected && (
                  <LinkedAlertStrip analysisId={activeAnalysis.analysis_id} />
                )}

                {/* 1. Detection Status & Summary Card */}
                <div className="p-4 rounded-xl border border-line-subtle bg-canvas-subtle space-y-3 text-xs shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {activeAnalysis.event_detected ? (
                        <ShieldAlert className="w-4 h-4 text-severity-critical-dot shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-severity-success-dot shrink-0" />
                      )}
                      <span className="font-bold text-sm text-ink-primary">
                        {activeAnalysis.event_detected
                          ? activeAnalysis.event_label || 'Safety Hazard Detected'
                          : 'No Safety Hazard Detected'}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                        resolveStatusPill(activeAnalysis, true).className
                      }`}
                    >
                      {resolveStatusPill(activeAnalysis, true).label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-canvas-surface border border-line-subtle">
                      <span className="text-[10px] text-ink-muted block uppercase font-mono">
                        Event Timestamp
                      </span>
                      <span className="font-mono text-xs font-bold text-ink-primary">
                        {activeAnalysis.event_timestamp_sec !== null
                          ? `${activeAnalysis.event_timestamp_sec.toFixed(2)}s`
                          : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-canvas-surface border border-line-subtle">
                      <span className="text-[10px] text-ink-muted block uppercase font-mono">
                        Model Confidence
                      </span>
                      <span className="font-mono text-xs font-bold text-ink-primary">
                        {activeAnalysis.confidence !== null
                          ? `${(activeAnalysis.confidence * 100).toFixed(1)}%`
                          : activeAnalysis.confidence_note || 'Rule-based verification'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-ink-secondary leading-relaxed pt-0.5">
                    {activeAnalysis.summary}
                  </p>
                </div>

                {/* 2. Evidence & Annotated Output (Equal Framing & Height Alignment) */}
                {(annotatedVideoUrl || evidenceImgUrl) && (
                  <WorkspaceCollapsible
                    title="Evidence & annotated output"
                    icon={Camera}
                    defaultOpen={true}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Annotated Detection Video with Controls */}
                      {annotatedVideoUrl && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted block">
                            Annotated Detection Output
                          </span>
                          <CleanVideo
                            key={annotatedVideoUrl}
                            src={annotatedVideoUrl}
                            label="Annotated detection output"
                            fit="contain"
                          />
                        </div>
                      )}

                      {/* Captured Evidence Frame with Matching 36px Footer Bar for Perfect Alignment */}
                      {evidenceImgUrl && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted block">
                            Captured Evidence Frame
                          </span>
                          <div className="rounded-lg overflow-hidden border border-line-subtle bg-slate-950 flex flex-col justify-between">
                            <div className="relative aspect-video overflow-hidden">
                              <img
                                src={evidenceImgUrl}
                                alt={`Evidence frame for ${activeAnalysis.analysis_id}`}
                                className="wm-crop absolute inset-0 w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex items-center justify-between px-3 h-9 bg-slate-900 text-slate-300 text-[10px] font-mono border-t border-slate-800">
                              <span className="truncate">
                                Frame @{' '}
                                {activeAnalysis.event_timestamp_sec !== null
                                  ? `${activeAnalysis.event_timestamp_sec.toFixed(2)}s`
                                  : 'Peak Hazard'}
                              </span>
                              <span className="text-slate-400 font-semibold shrink-0">
                                Still Snapshot
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </WorkspaceCollapsible>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM SECTION — Full Width Across Entire Workspace:                     */}
        {/* Starts directly after top section with consistent 16–20px spacing.       */}
        {/* - Detection Timeline                                                     */}
        {/* - Technical Specifications                                               */}
        {/* - Human Safety Officer Review                                            */}
        {/* Zero empty left column! Full content width utilization!                  */}
        {/* ========================================================================= */}
        {isAnalysisReady && (
          <div className="space-y-4 pt-4 border-t border-line-subtle/70">
            {/* 3. Detection Timeline (Full Width) */}
            {activeAnalysis.detection_events && activeAnalysis.detection_events.length > 0 && (
              <WorkspaceCollapsible
                title="Detection timeline"
                icon={Clock}
                hint={`${activeAnalysis.detection_events.length} events`}
                defaultOpen={false}
              >
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 pt-1">
                  {activeAnalysis.detection_events.map((ev, idx) => (
                    <div
                      key={`${ev.frame}-${ev.state}-${idx}`}
                      className="flex items-center justify-between gap-2 text-[11px] font-mono bg-canvas-subtle px-3 py-2 rounded-lg border border-line-subtle"
                    >
                      <span className="font-semibold text-ink-primary truncate">
                        {ev.state}
                        {ev.label ? ` — ${ev.label}` : ''}
                      </span>
                      <span className="text-ink-muted shrink-0">
                        Frame {ev.frame} · {ev.timestamp_sec.toFixed(2)}s
                      </span>
                    </div>
                  ))}
                </div>
              </WorkspaceCollapsible>
            )}

            {/* 4. Technical Specifications (Full Width 4-Column Grid) */}
            <WorkspaceCollapsible title="Technical specifications" icon={Cpu} defaultOpen={false}>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
                <div className="p-3 rounded-lg bg-canvas-subtle border border-line-subtle space-y-1">
                  <dt className="text-ink-muted text-[10px] font-mono uppercase">Analysis ID</dt>
                  <dd className="font-mono text-ink-primary font-bold text-xs truncate">
                    {activeAnalysis.analysis_id}
                  </dd>
                </div>
                <div className="p-3 rounded-lg bg-canvas-subtle border border-line-subtle space-y-1">
                  <dt className="text-ink-muted text-[10px] font-mono uppercase">Inference Model</dt>
                  <dd className="font-mono text-ink-primary font-bold text-xs truncate">
                    {activeAnalysis.model_used ||
                      selectedGroup?.model_status.model_name ||
                      '—'}
                  </dd>
                </div>
                <div className="p-3 rounded-lg bg-canvas-subtle border border-line-subtle space-y-1">
                  <dt className="text-ink-muted text-[10px] font-mono uppercase">Processed Frames</dt>
                  <dd className="font-mono text-ink-primary font-bold text-xs">
                    {activeAnalysis.frames_processed}
                    {activeAnalysis.total_frames
                      ? ` / ${activeAnalysis.total_frames}`
                      : ''}
                  </dd>
                </div>
                <div className="p-3 rounded-lg bg-canvas-subtle border border-line-subtle space-y-1">
                  <dt className="text-ink-muted text-[10px] font-mono uppercase">Target Facility</dt>
                  <dd className="font-mono text-ink-primary font-bold text-xs">
                    {activeAnalysis.plant_id || 'IN-KA-01'}
                  </dd>
                </div>
              </dl>
            </WorkspaceCollapsible>

            {/* 5. Human Safety Officer Review (Full Width) */}
            {activeAnalysis.event_detected && (
              <div className="p-4 sm:p-5 rounded-xl border border-line-subtle bg-canvas-subtle space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-sm text-ink-primary flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand-orange shrink-0" />
                    <span>Human Safety Officer Review</span>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-ink-secondary px-2.5 py-0.5 rounded-full bg-canvas-surface border border-line-subtle">
                    {activeAnalysis.human_review_status.replace(/_/g, ' ')}
                  </span>
                </div>

                {activeAnalysis.human_review_status === 'PENDING_REVIEW' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={reviewComment}
                      onChange={e => onReviewCommentChange(e.target.value)}
                      placeholder="Add safety officer verification note (optional)..."
                      aria-label="Safety officer review comment"
                      className="w-full h-10 px-3.5 rounded-lg border border-line-default bg-canvas-surface text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={reviewSaving}
                        onClick={() =>
                          onReviewDecision(activeAnalysis.analysis_id, 'CONFIRMED')
                        }
                        className="flex-1 h-10 px-4 rounded-lg bg-severity-critical-bg text-severity-critical-text border border-severity-critical-border text-xs font-semibold hover:opacity-90 disabled:opacity-50 focus-ring transition-opacity"
                      >
                        Confirm Safety Event
                      </button>
                      <button
                        type="button"
                        disabled={reviewSaving}
                        onClick={() =>
                          onReviewDecision(activeAnalysis.analysis_id, 'DISMISSED')
                        }
                        className="flex-1 h-10 px-4 rounded-lg bg-canvas-surface text-ink-primary border border-line-default text-xs font-semibold hover:bg-canvas-muted disabled:opacity-50 focus-ring transition-colors"
                      >
                        Dismiss False Positive
                      </button>
                    </div>
                  </div>
                ) : (
                  activeAnalysis.human_review_comment && (
                    <p className="text-xs text-ink-secondary bg-canvas-surface px-3.5 py-2.5 rounded-lg border border-line-subtle leading-relaxed">
                      <strong className="text-ink-primary">Officer Note:</strong>{' '}
                      {activeAnalysis.human_review_comment}
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
