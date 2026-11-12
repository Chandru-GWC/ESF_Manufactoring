import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  DoorClosed,
  Eye,
  Film,
  Flame,
  HardHat,
  PersonStanding,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Video,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingSkeleton } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { API_BASE_URL, ehsApi } from '../services/api';
import { useEhs } from '../context/EhsContext';
import {
  VideoAnalysisResult,
  VideoLibraryGroup,
  VideoLibraryItem,
  VideoLibraryResponse,
  VideoUseCase,
} from '../types/ehs';

const SCENARIO_ICONS: Record<VideoUseCase, React.ComponentType<{ className?: string }>> = {
  fall_detection: PersonStanding,
  smoke_fire: Flame,
  exit_obstruction: DoorClosed,
  forklift_pedestrian: Truck,
  machinery_proximity: Settings2,
  unsafe_climbing: HardHat,
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDuration(sec?: number | null): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—';
  return `${sec.toFixed(1)}s`;
}

function resolveStatusPill(analysis: VideoAnalysisResult | null, configured: boolean): {
  label: string;
  className: string;
} {
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

export const VideoMonitoringView: React.FC = () => {
  const { facilityId } = useEhs();
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const [library, setLibrary] = useState<VideoLibraryResponse | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [analyses, setAnalyses] = useState<VideoAnalysisResult[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [scenarioFilter, setScenarioFilter] = useState<'ALL' | VideoUseCase>('ALL');

  const [selectedVideo, setSelectedVideo] = useState<VideoLibraryItem | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [triggeringVideoId, setTriggeringVideoId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  const loadLibraryAndHistory = async (silent = false) => {
    if (!silent) {
      setLibraryLoading(true);
      setAnalysesLoading(true);
    }
    setLibraryError(null);
    try {
      const [libRes, historyRes] = await Promise.all([
        ehsApi.getVideoLibrary(),
        ehsApi.getVideoAnalyses(facilityId, 30),
      ]);
      setLibrary(libRes);
      setAnalyses(historyRes);

      // Select first available library video automatically on initial load
      setSelectedVideo(prev => {
        if (prev) return prev;
        for (const grp of libRes.groups) {
          if (grp.videos.length > 0) return grp.videos[0];
        }
        return null;
      });
    } catch (err: any) {
      setLibraryError(err?.message || 'Unable to load backend video library.');
    } finally {
      setLibraryLoading(false);
      setAnalysesLoading(false);
    }
  };

  useEffect(() => {
    loadLibraryAndHistory();
  }, [facilityId]);

  // Keep activeAnalysis synced when a polling job updates
  const pollingAnalysisId = activeAnalysis?.status === 'PROCESSING' ? activeAnalysis.analysis_id : null;

  useEffect(() => {
    if (!pollingAnalysisId) return;
    let cancelled = false;

    const timer = window.setInterval(async () => {
      try {
        const updated = await ehsApi.getVideoAnalysisById(pollingAnalysisId);
        if (cancelled) return;
        setActiveAnalysis(updated);
        setAnalyses(prev => {
          const exists = prev.some(a => a.analysis_id === updated.analysis_id);
          if (!exists) return [updated, ...prev];
          return prev.map(a => (a.analysis_id === updated.analysis_id ? updated : a));
        });
      } catch {
        // Keep polling transiently until resolved
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollingAnalysisId]);

  // Map video_id -> latest VideoAnalysisResult for card badges
  const latestByVideoId = useMemo(() => {
    const map = new Map<string, VideoAnalysisResult>();
    for (const row of analyses) {
      if (row.video_id && !map.has(row.video_id)) {
        map.set(row.video_id, row);
      }
    }
    return map;
  }, [analyses]);

  // All videos flat lookup
  const allVideosMap = useMemo(() => {
    const map = new Map<string, VideoLibraryItem>();
    if (!library) return map;
    for (const grp of library.groups) {
      for (const vid of grp.videos) {
        map.set(vid.video_id, vid);
      }
    }
    return map;
  }, [library]);

  // Filter scenario groups by search query & scenario pill
  const filteredGroups = useMemo<VideoLibraryGroup[]>(() => {
    if (!library) return [];
    const q = searchQuery.trim().toLowerCase();
    return library.groups
      .filter(grp => scenarioFilter === 'ALL' || grp.use_case === scenarioFilter)
      .map(grp => {
        if (!q) return grp;
        const matchedVideos = grp.videos.filter(
          v =>
            v.title.toLowerCase().includes(q) ||
            v.filename.toLowerCase().includes(q) ||
            v.video_id.toLowerCase().includes(q) ||
            grp.title.toLowerCase().includes(q)
        );
        return { ...grp, videos: matchedVideos };
      });
  }, [library, scenarioFilter, searchQuery]);

  const handleSelectVideo = (video: VideoLibraryItem, scrollToPanel = true) => {
    setSelectedVideo(video);
    setActionError(null);
    setReviewComment('');
    const existing = latestByVideoId.get(video.video_id) || null;
    setActiveAnalysis(existing);
    if (scrollToPanel && workspaceRef.current) {
      workspaceRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleAnalyzeVideo = async (video: VideoLibraryItem) => {
    setSelectedVideo(video);
    setActionError(null);
    setReviewComment('');
    setTriggeringVideoId(video.video_id);
    if (workspaceRef.current) {
      workspaceRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    try {
      const started = await ehsApi.analyzeLibraryVideo(video.video_id, facilityId);
      setActiveAnalysis(started);
      setAnalyses(prev => [started, ...prev.filter(a => a.analysis_id !== started.analysis_id)]);
    } catch (err: any) {
      setActionError(err?.message || 'Unable to start safety CV analysis for selected clip.');
    } finally {
      setTriggeringVideoId(null);
    }
  };

  const handleReviewDecision = async (
    analysisId: string,
    decision: 'CONFIRMED' | 'DISMISSED'
  ) => {
    setReviewSaving(true);
    setActionError(null);
    try {
      const updated = await ehsApi.updateVideoReview(analysisId, decision, reviewComment);
      setActiveAnalysis(updated);
      setAnalyses(prev => prev.map(a => (a.analysis_id === analysisId ? updated : a)));
      setReviewComment('');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to save human review decision.');
    } finally {
      setReviewSaving(false);
    }
  };

  const handleInspectHistoryRow = (row: VideoAnalysisResult) => {
    setActionError(null);
    setReviewComment('');
    if (row.video_id && allVideosMap.has(row.video_id)) {
      setSelectedVideo(allVideosMap.get(row.video_id) || null);
    }
    setActiveAnalysis(row);
    if (workspaceRef.current) {
      workspaceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectedGroup = library?.groups.find(g => g.use_case === selectedVideo?.use_case) || null;
  const selectedModelConfigured = selectedGroup?.model_status.configured ?? false;

  const evidenceImgUrl = activeAnalysis?.evidence_frame_url
    ? `${API_BASE_URL}${activeAnalysis.evidence_frame_url}`
    : null;
  const annotatedVideoUrl = activeAnalysis?.annotated_video_url
    ? `${API_BASE_URL}${activeAnalysis.annotated_video_url}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Safety Video Intelligence"
        description="Inspect controlled video library footage across six workplace safety scenarios, execute configured CV models, and log human officer confirmations."
        breadcrumbs={[
          { label: 'Safety Monitoring' },
          { label: 'Safety Video Intelligence', active: true },
        ]}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-canvas-subtle text-ink-primary border border-line-default">
              <Film className="w-3.5 h-3.5 text-brand-primary" />
              <span>{library ? `${library.total_videos} Library Videos` : 'Loading Library...'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-severity-success-bg text-severity-success-text border border-severity-success-border">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {library
                  ? `${library.configured_models_count} / ${library.total_scenarios_count} Models Configured`
                  : 'Checking Models...'}
              </span>
            </span>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => loadLibraryAndHistory()}
            disabled={libraryLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary transition-colors disabled:opacity-50 focus-ring"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-primary ${libraryLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Library</span>
          </button>
        }
      />

      {libraryError && (
        <ErrorState
          title="Unable to Load Video Library"
          message={libraryError}
          onRetry={() => loadLibraryAndHistory()}
        />
      )}

      {/* Search & Scenario Filters */}
      <section className="p-4 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search videos by filename, title, scenario, or video ID..."
              aria-label="Search library videos"
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-line-default bg-canvas-subtle text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-canvas-surface"
            />
          </div>

          <div className="text-[11px] font-mono text-ink-muted">
            Source: <code className="text-ink-primary">backend/storage/video_library/</code> • Formats: MP4, MOV, AVI, WEBM
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScenarioFilter('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors focus-ring ${
              scenarioFilter === 'ALL'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-canvas-subtle text-ink-secondary border-line-subtle hover:text-ink-primary'
            }`}
          >
            All Scenarios ({library?.total_videos ?? 0})
          </button>
          {library?.groups.map(grp => (
            <button
              key={grp.use_case}
              type="button"
              onClick={() => setScenarioFilter(grp.use_case)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors focus-ring ${
                scenarioFilter === grp.use_case
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-canvas-subtle text-ink-secondary border-line-subtle hover:text-ink-primary'
              }`}
            >
              <span>{grp.title}</span>
              <span className="font-mono text-[10px] opacity-80">({grp.videos.length})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Active Selected Video Preview + Analysis & Review Workspace */}
      <section
        ref={workspaceRef}
        className="rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-line-subtle flex flex-wrap items-center justify-between gap-2 bg-canvas-subtle/60">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-brand-primary" />
            <h2 className="text-sm font-bold text-ink-primary">
              Video Inspection & Detection Workspace
            </h2>
          </div>
          {selectedVideo && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-canvas-surface border border-line-subtle text-brand-primary font-semibold">
                {selectedVideo.video_id}
              </span>
              <span className="text-ink-secondary truncate max-w-[240px]">{selectedVideo.filename}</span>
            </div>
          )}
        </div>

        {!selectedVideo ? (
          <div className="p-8">
            <EmptyState
              title="Select a Video from the Library Below"
              description="Choose any discovered scenario clip below to stream a preview, execute a configured safety model, and inspect annotated evidence."
            />
          </div>
        ) : (
          <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Library Video Stream Preview */}
            <div className="lg:col-span-5 space-y-3">
              <div className="rounded-lg border border-line-subtle bg-slate-950 overflow-hidden aspect-video flex items-center justify-center">
                <video
                  key={selectedVideo.video_id}
                  src={`${API_BASE_URL}${selectedVideo.stream_url}`}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-3 rounded-lg bg-canvas-subtle border border-line-subtle space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Scenario</span>
                  <span className="font-semibold text-ink-primary">{selectedVideo.use_case_title}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Duration / Size</span>
                  <span className="font-mono text-ink-primary">
                    {formatDuration(selectedVideo.duration_sec)} • {formatFileSize(selectedVideo.file_size_bytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Resolution</span>
                  <span className="font-mono text-ink-primary">
                    {selectedVideo.width && selectedVideo.height
                      ? `${selectedVideo.width}x${selectedVideo.height}${selectedVideo.fps ? ` @ ${selectedVideo.fps}fps` : ''}`
                      : 'Video Stream'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Model Readiness</span>
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

              <button
                type="button"
                disabled={
                  !selectedModelConfigured ||
                  !selectedVideo.available ||
                  triggeringVideoId === selectedVideo.video_id ||
                  activeAnalysis?.status === 'PROCESSING'
                }
                onClick={() => handleAnalyzeVideo(selectedVideo)}
                className="w-full h-10 px-4 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
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
                <p className="text-[11px] text-ink-secondary bg-canvas-subtle border border-line-subtle rounded-lg px-3 py-2">
                  {selectedGroup.model_status.message}
                </p>
              )}
            </div>

            {/* Right: Execution Progress, Detection Output, Evidence, Annotated Player & Human Review */}
            <div className="lg:col-span-7 space-y-4">
              {actionError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg border border-severity-critical-border bg-severity-critical-bg text-severity-critical-text text-xs flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{actionError}</span>
                  </div>
                  {selectedModelConfigured && (
                    <button
                      type="button"
                      onClick={() => handleAnalyzeVideo(selectedVideo)}
                      className="px-2.5 py-1 rounded bg-canvas-surface border border-severity-critical-border font-semibold shrink-0 hover:bg-canvas-subtle"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {!activeAnalysis ? (
                <div className="h-full min-h-[260px] rounded-xl border border-dashed border-line-default bg-canvas-subtle/50 p-6 flex flex-col items-center justify-center text-center space-y-2">
                  <Video className="w-8 h-8 text-ink-muted" />
                  <h3 className="text-sm font-bold text-ink-primary">
                    {selectedModelConfigured ? 'Ready to Analyze Selected Video' : 'Model Not Configured'}
                  </h3>
                  <p className="text-xs text-ink-secondary max-w-md">
                    {selectedModelConfigured
                      ? `Preview '${selectedVideo.filename}' on the left, then click Analyze Video to run ${selectedGroup?.model_status.model_name || 'the safety detector'} and persist timestamped evidence in Neon PostgreSQL.`
                      : selectedGroup?.model_status.message}
                  </p>
                </div>
              ) : activeAnalysis.status === 'PROCESSING' ? (
                <div className="p-5 rounded-xl border border-line-subtle bg-canvas-subtle space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-brand-primary block">
                        {activeAnalysis.analysis_id} • RUNNING INFERENCE
                      </span>
                      <span className="text-xs text-ink-secondary">
                        {activeAnalysis.current_stage || 'Processing video frames...'}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold text-ink-primary tabular-nums">
                      {activeAnalysis.progress_pct}%
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-canvas-muted overflow-hidden">
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
                <div className="p-5 rounded-xl border border-severity-critical-border bg-severity-critical-bg space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-severity-critical-text font-bold text-sm">
                      <XCircle className="w-4 h-4" />
                      <span>Analysis Failed ({activeAnalysis.analysis_id})</span>
                    </div>
                    {selectedModelConfigured && (
                      <button
                        type="button"
                        onClick={() => handleAnalyzeVideo(selectedVideo)}
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
                <div className="space-y-4">
                  {/* Result Summary Card */}
                  <div className="p-4 rounded-xl border border-line-subtle bg-canvas-subtle space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {activeAnalysis.event_detected ? (
                          <ShieldAlert className="w-4 h-4 text-severity-critical-dot" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-severity-success-dot" />
                        )}
                        <span className="font-bold text-ink-primary">
                          {activeAnalysis.event_detected
                            ? activeAnalysis.event_label || 'Safety Event Detected'
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
                        <span className="text-[10px] text-ink-muted block">Analysis ID</span>
                        <span className="font-mono font-semibold text-brand-primary">
                          {activeAnalysis.analysis_id}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
                        <span className="text-[10px] text-ink-muted block">Event Timestamp</span>
                        <span className="font-mono font-semibold text-ink-primary">
                          {activeAnalysis.event_timestamp_sec !== null
                            ? `${activeAnalysis.event_timestamp_sec.toFixed(2)}s`
                            : '—'}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
                        <span className="text-[10px] text-ink-muted block">Confidence</span>
                        <span className="font-mono font-semibold text-ink-primary">
                          {activeAnalysis.confidence !== null
                            ? `${(activeAnalysis.confidence * 100).toFixed(1)}%`
                            : activeAnalysis.confidence_note || 'State Machine'}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
                        <span className="text-[10px] text-ink-muted block">Frames Processed</span>
                        <span className="font-mono font-semibold text-ink-primary">
                          {activeAnalysis.frames_processed}
                          {activeAnalysis.total_frames ? ` / ${activeAnalysis.total_frames}` : ''}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-ink-secondary leading-relaxed">{activeAnalysis.summary}</p>
                  </div>

                  {/* Annotated Video + Evidence Frame Side by Side */}
                  {(annotatedVideoUrl || evidenceImgUrl) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {annotatedVideoUrl && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                            Annotated Detection Output
                          </span>
                          <video
                            key={annotatedVideoUrl}
                            src={annotatedVideoUrl}
                            controls
                            preload="metadata"
                            playsInline
                            className="w-full rounded-lg border border-line-subtle bg-slate-950 aspect-video object-contain"
                          />
                        </div>
                      )}
                      {evidenceImgUrl && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                            Captured Evidence Frame
                          </span>
                          <img
                            src={evidenceImgUrl}
                            alt={`Evidence frame for ${activeAnalysis.analysis_id}`}
                            className="w-full rounded-lg border border-line-subtle object-cover aspect-video"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Event Timeline */}
                  {activeAnalysis.detection_events && activeAnalysis.detection_events.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                        Detection Timeline ({activeAnalysis.detection_events.length})
                      </span>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {activeAnalysis.detection_events.map((ev, idx) => (
                          <div
                            key={`${ev.frame}-${ev.state}-${idx}`}
                            className="flex items-center justify-between gap-2 text-[11px] font-mono bg-canvas-subtle px-2.5 py-1.5 rounded border border-line-subtle"
                          >
                            <span className="font-semibold text-ink-primary">
                              {ev.state}
                              {ev.label ? ` — ${ev.label}` : ''}
                            </span>
                            <span className="text-ink-muted">
                              Frame {ev.frame} • {ev.timestamp_sec.toFixed(2)}s
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Human Review Controls */}
                  {activeAnalysis.event_detected && (
                    <div className="p-4 rounded-xl border border-line-subtle bg-canvas-subtle space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-ink-primary">
                          Human Safety Officer Review
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-ink-secondary">
                          {activeAnalysis.human_review_status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {activeAnalysis.human_review_status === 'PENDING_REVIEW' ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}
                            placeholder="Add officer verification note (optional)..."
                            aria-label="Safety officer review comment"
                            className="w-full h-9 px-3 rounded-lg border border-line-default bg-canvas-surface text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={reviewSaving}
                              onClick={() => handleReviewDecision(activeAnalysis.analysis_id, 'CONFIRMED')}
                              className="flex-1 h-9 px-3 rounded-lg bg-severity-critical-bg text-severity-critical-text border border-severity-critical-border text-xs font-semibold hover:opacity-90 disabled:opacity-50 focus-ring"
                            >
                              Confirm Safety Event
                            </button>
                            <button
                              type="button"
                              disabled={reviewSaving}
                              onClick={() => handleReviewDecision(activeAnalysis.analysis_id, 'DISMISSED')}
                              className="flex-1 h-9 px-3 rounded-lg bg-canvas-surface text-ink-primary border border-line-default text-xs font-semibold hover:bg-canvas-muted disabled:opacity-50 focus-ring"
                            >
                              Dismiss False Positive
                            </button>
                          </div>
                        </div>
                      ) : (
                        activeAnalysis.human_review_comment && (
                          <p className="text-xs text-ink-secondary bg-canvas-surface px-3 py-2 rounded-lg border border-line-subtle">
                            <strong>Officer Note:</strong> {activeAnalysis.human_review_comment}
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Scenario Video Library Groups (NO Manual Upload Button) */}
      {libraryLoading ? (
        <div className="space-y-4">
          <LoadingSkeleton count={3} className="h-28" />
        </div>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map(grp => {
            const Icon = SCENARIO_ICONS[grp.use_case] || Video;
            const configured = grp.model_status.configured;

            return (
              <section
                key={grp.use_case}
                className="rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden"
              >
                <div className="px-4 sm:px-5 py-3.5 border-b border-line-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-canvas-subtle border border-line-subtle flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-ink-primary" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-ink-primary">{grp.title}</h3>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-canvas-subtle text-ink-muted border border-line-subtle">
                          {grp.videos.length} {grp.videos.length === 1 ? 'Video' : 'Videos'}
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary mt-0.5">{grp.description}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      title={grp.model_status.message}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                        configured
                          ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                          : 'bg-canvas-subtle text-ink-muted border-line-default'
                      }`}
                    >
                      {configured ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {configured
                          ? `Model Ready • ${grp.model_status.model_name}`
                          : 'Model not configured'}
                      </span>
                    </span>
                  </div>
                </div>

                {grp.videos.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title={`No Videos in ${grp.title}`}
                      description={`Place MP4, MOV, AVI, or WEBM footage inside backend/storage/video_library/${grp.use_case}/ and refresh to inspect or run detection.${
                        !configured ? ' (Note: Detector model for this scenario is not configured yet.)' : ''
                      }`}
                    />
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {grp.videos.map(video => {
                      const latest = latestByVideoId.get(video.video_id) || null;
                      const pill = resolveStatusPill(latest, configured);
                      const isSelected = selectedVideo?.video_id === video.video_id;

                      return (
                        <article
                          key={video.video_id}
                          className={`rounded-xl border bg-canvas-app overflow-hidden flex flex-col transition-shadow ${
                            isSelected
                              ? 'border-brand-primary ring-2 ring-brand-primary/20 shadow-elevated'
                              : 'border-line-subtle hover:border-line-default'
                          }`}
                        >
                          <div className="relative bg-slate-950 aspect-video overflow-hidden">
                            <video
                              src={`${API_BASE_URL}${video.stream_url}#t=0.4`}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 text-white font-mono text-[10px] border border-white/15">
                              {video.video_id}
                            </span>
                            <span
                              className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                                video.available
                                  ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                                  : 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
                              }`}
                            >
                              {video.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>

                          <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-brand-primary">
                                  {video.use_case_title}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${pill.className}`}
                                >
                                  {pill.label}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-ink-primary line-clamp-1" title={video.title}>
                                {video.title}
                              </h4>
                              <p className="text-[11px] font-mono text-ink-muted truncate" title={video.filename}>
                                {video.filename}
                              </p>
                              <div className="flex items-center justify-between text-[11px] font-mono text-ink-secondary pt-1">
                                <span>Duration: {formatDuration(video.duration_sec)}</span>
                                <span>{formatFileSize(video.file_size_bytes)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-line-subtle">
                              <button
                                type="button"
                                onClick={() => handleSelectVideo(video, true)}
                                className="flex-1 h-8 px-2.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary inline-flex items-center justify-center gap-1.5 transition-colors focus-ring"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>
                              <button
                                type="button"
                                disabled={!configured || !video.available || triggeringVideoId === video.video_id}
                                onClick={() => handleAnalyzeVideo(video)}
                                title={configured ? `Analyze ${video.filename}` : grp.model_status.message}
                                className="flex-1 h-8 px-2.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>
                                  {!configured
                                    ? 'Not Configured'
                                    : triggeringVideoId === video.video_id
                                    ? 'Starting...'
                                    : 'Analyze'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Persisted Video Safety Analyses Log */}
      <section className="rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-line-subtle flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-primary shrink-0" aria-hidden="true" />
              <span>Persisted Video Safety Detection Log</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Verified detection records stored in Neon PostgreSQL (<code className="font-mono">ehs_core.video_safety_analyses</code>).
            </p>
          </div>
          <span className="font-mono text-[11px] text-ink-secondary">{analyses.length} Records</span>
        </div>

        {analysesLoading ? (
          <div className="p-5">
            <LoadingSkeleton count={3} className="h-10" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No Video Analyses Recorded"
              description="Select a library video above and click Analyze to persist verified CV results."
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
                    onClick={() => handleInspectHistoryRow(item)}
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
    </div>
  );
};
