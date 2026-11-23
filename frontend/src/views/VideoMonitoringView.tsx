import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  DoorClosed,
  Film,
  Flame,
  HardHat,
  PersonStanding,
  RefreshCw,
  Settings2,
  Truck,
  UploadCloud,
  Video,
} from 'lucide-react';
import { LoadingSkeleton } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { VideoAnalysisWorkspace } from '../components/video/VideoAnalysisWorkspace';
import { DetectionUploadPanel } from '../components/video/DetectionUploadPanel';
import { VideoCard } from '../components/video/VideoCard';
import { AnalysisRecordDetail } from '../components/video/AnalysisRecordDetail';
import { Window } from '../components/ui/Window';
import { ehsApi, mediaUrl } from '../services/api';
import { useEhs } from '../context/EhsContext';
import { useAlerts } from '../context/AlertContext';
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

/** Display copy and ordering only — readiness, models and videos always come from the backend. */
const SCENARIO_ORDER: VideoUseCase[] = [
  'fall_detection',
  'smoke_fire',
  'exit_obstruction',
  'forklift_pedestrian',
  'machinery_proximity',
  'unsafe_climbing',
];

const SCENARIO_COPY: Record<VideoUseCase, { title: string; description: string }> = {
  fall_detection: {
    title: 'Fall & Posture Detection',
    description: 'Pose-based monitoring for worker slips, pre-fall instability and ground-level falls.',
  },
  smoke_fire: {
    title: 'Smoke & Fire Monitoring',
    description: 'Frame-level detection of visible flame and industrial smoke plumes.',
  },
  exit_obstruction: {
    title: 'Emergency Exit Obstruction',
    description: 'Egress corridor monitoring for blocked exit pathways and stationary obstacles.',
  },
  forklift_pedestrian: {
    title: 'Forklift–Pedestrian Near Miss',
    description: 'Proximity monitoring between industrial vehicles and pedestrians in shared aisles.',
  },
  machinery_proximity: {
    title: 'Moving Machinery Proximity',
    description: 'Perimeter monitoring for operator entry into active mechanical hazard zones.',
  },
  unsafe_climbing: {
    title: 'Unsafe Climbing / Working at Height',
    description: 'Ladder, platform and unprotected-edge monitoring for work at height.',
  },
};

export const VideoMonitoringView: React.FC = () => {
  const { facilityId } = useEhs();
  const { refresh: refreshAlerts } = useAlerts();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reviewInFlight = useRef(false);

  // 'library' = six scenario cards, 'workspace' = integrated analysis view. All selection
  // state lives in this parent so returning to the library never loses context.
  const [mode, setMode] = useState<'library' | 'workspace'>('library');

  const [library, setLibrary] = useState<VideoLibraryResponse | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [analyses, setAnalyses] = useState<VideoAnalysisResult[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);

  const [selectedVideo, setSelectedVideo] = useState<VideoLibraryItem | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [triggeringVideoId, setTriggeringVideoId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  // Records without a library video (direct API uploads) cannot open the workspace; show details instead.
  const [detailRecord, setDetailRecord] = useState<VideoAnalysisResult | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadLibraryAndHistory = async (silent = false) => {
    if (!silent) {
      setLibraryLoading(true);
      setAnalysesLoading(true);
    }
    setLibraryError(null);
    // The two requests are independent: the video cards show as soon as the library arrives (it is quick); the
    // analysis history needs the (slower) database and fills in afterwards.
    const libraryRequest = ehsApi
      .getVideoLibrary()
      .then(libRes => setLibrary(libRes))
      .catch((err: any) => setLibraryError(err?.message || 'Unable to load backend video library.'))
      .finally(() => setLibraryLoading(false));
    const historyRequest = ehsApi
      .getVideoAnalyses(facilityId, 30)
      .then(historyRes => setAnalyses(historyRes))
      .catch(() => undefined)
      .finally(() => setAnalysesLoading(false));
    await Promise.all([libraryRequest, historyRequest]);
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

  // Cards of videos that are being analysed keep updating even when no workspace or upload window is open.
  const anyProcessing = analyses.some(a => a.status === 'PROCESSING');
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = window.setInterval(() => void loadLibraryAndHistory(true), 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyProcessing, facilityId]);

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

  const scrollToTop = () => {
    window.setTimeout(() => {
      rootRef.current?.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 30);
  };

  const openWorkspace = (video: VideoLibraryItem, analysis?: VideoAnalysisResult | null) => {
    setSelectedVideo(video);
    setActionError(null);
    setReviewComment('');
    setActiveAnalysis(analysis !== undefined ? analysis : latestByVideoId.get(video.video_id) || null);
    setMode('workspace');
    scrollToTop();
  };

  const handleSelectVideo = (video: VideoLibraryItem) => {
    setSelectedVideo(video);
    setActionError(null);
    setReviewComment('');
    setActiveAnalysis(latestByVideoId.get(video.video_id) || null);
  };

  const handleAnalyzeVideo = async (video: VideoLibraryItem) => {
    setSelectedVideo(video);
    setActionError(null);
    setReviewComment('');
    setTriggeringVideoId(video.video_id);

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
    // Re-entry guard: state updates are async, so a rapid double-click would otherwise send twice.
    if (reviewInFlight.current) return;
    reviewInFlight.current = true;
    setReviewSaving(true);
    setActionError(null);
    try {
      const updated = await ehsApi.updateVideoReview(analysisId, decision, reviewComment);
      setActiveAnalysis(updated);
      setAnalyses(prev => prev.map(a => (a.analysis_id === analysisId ? updated : a)));
      setReviewComment('');
      // The backend links the review decision to the alert; refresh so the alert strip, bell and cards update now.
      void refreshAlerts();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to save human review decision.');
    } finally {
      reviewInFlight.current = false;
      setReviewSaving(false);
    }
  };

  const selectedGroup = library?.groups.find(g => g.use_case === selectedVideo?.use_case) || null;
  const selectedModelConfigured = selectedGroup?.model_status.configured ?? false;

  const orderedGroups = useMemo<VideoLibraryGroup[]>(() => {
    if (!library) return [];
    return SCENARIO_ORDER.map(k => library.groups.find(g => g.use_case === k)).filter(
      (g): g is VideoLibraryGroup => Boolean(g)
    );
  }, [library]);

  const libraryVideos = useMemo(
    () => orderedGroups.flatMap(group => group.videos.map(video => ({ video, group }))),
    [orderedGroups]
  );
  // Uploaded videos = analyses that do not come from the library, newest first.
  const uploadedVideos = useMemo(
    () => analyses.filter(a => !a.video_id).sort((x, y) => (y.created_at || '').localeCompare(x.created_at || '')),
    [analyses]
  );

  const scenarioVideos = selectedGroup ? selectedGroup.videos.filter(v => v.available) : [];
  const SelectedIcon = selectedVideo ? SCENARIO_ICONS[selectedVideo.use_case] || Video : Video;

  return (
    <div ref={rootRef} className="space-y-6 scroll-mt-20">
      {libraryError && (
        <ErrorState
          title="Unable to Load Video Library"
          message={libraryError}
          onRetry={() => loadLibraryAndHistory()}
        />
      )}

      {(
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-canvas-surface text-ink-primary border border-line-default">
                <Film className="w-3.5 h-3.5 text-brand-orange" />
                <span>{library ? `${library.total_videos} library videos` : 'Loading library…'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-canvas-surface text-ink-primary border border-line-default">
                <CheckCircle2 className="w-3.5 h-3.5 text-severity-success-dot" />
                <span>
                  {library
                    ? `${library.configured_models_count} of ${library.total_scenarios_count} models configured`
                    : 'Checking models…'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold transition-colors focus-ring"
              >
                <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload video</span>
              </button>
              <Link
                to="/monitoring/history"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary transition-colors focus-ring"
              >
                <Clock className="w-3.5 h-3.5 text-brand-orange" />
                <span>Detection history</span>
              </Link>
              <button
                type="button"
                onClick={() => loadLibraryAndHistory()}
                disabled={libraryLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary transition-colors disabled:opacity-50 focus-ring"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${libraryLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {libraryLoading && !library ? (
            <LoadingSkeleton count={3} className="h-56" />
          ) : (
            <>
              {analysesLoading && uploadedVideos.length === 0 && (
                <p className="text-xs font-mono text-ink-muted" role="status">
                  Loading your uploaded videos…
                </p>
              )}
              {uploadedVideos.length > 0 && (
                <section aria-label="Uploaded videos" className="space-y-3">
                  <h2 className="text-sm font-bold text-ink-primary">
                    Uploaded videos <span className="font-mono text-xs text-ink-muted">({uploadedVideos.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {uploadedVideos.map(row => {
                      const preview = row.annotated_video_url || row.original_video_url;
                      const poster = row.evidence_frame_url ? mediaUrl(row.evidence_frame_url) : null;
                      return (
                        <VideoCard
                          key={row.analysis_id}
                          title={row.filename}
                          scenario={SCENARIO_COPY[row.use_case]?.title ?? row.use_case}
                          src={preview ? mediaUrl(`${preview}#t=0.4`) : null}
                          poster={poster}
                          analysis={row}
                          actionLabel={row.status === 'PROCESSING' ? 'View progress' : 'View result'}
                          onOpen={() => setDetailRecord(row)}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              <section aria-label="Library videos" className="space-y-3">
                <h2 className="text-sm font-bold text-ink-primary">
                  Library videos <span className="font-mono text-xs text-ink-muted">({libraryVideos.length})</span>
                </h2>
                {libraryVideos.length === 0 ? (
                  <EmptyState title="No library videos" description="Videos placed in the server video library appear here. You can also upload your own video." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {libraryVideos.map(({ video, group }) => {
                      const ready = group.model_status.configured && video.available;
                      return (
                        <VideoCard
                          key={video.video_id}
                          title={video.title || video.filename}
                          scenario={SCENARIO_COPY[video.use_case]?.title ?? video.use_case_title}
                          src={video.available ? mediaUrl(`${video.stream_url}#t=0.4`) : null}
                          analysis={latestByVideoId.get(video.video_id) ?? null}
                          actionLabel={latestByVideoId.has(video.video_id) ? 'Open analysis' : 'Analyze video'}
                          actionDisabled={!ready}
                          actionHint={group.model_status.configured ? 'Video file not available' : group.model_status.message}
                          onOpen={() => openWorkspace(video)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          <Window open={uploadOpen} title="Upload a video for detection" onClose={() => setUploadOpen(false)} widthClass="max-w-4xl">
            <DetectionUploadPanel
              scenarios={orderedGroups.map(g => ({
                use_case: g.use_case,
                title: SCENARIO_COPY[g.use_case].title,
                configured: g.model_status.configured,
              }))}
              plantId={facilityId}
              onFinished={() => {
                void loadLibraryAndHistory(true);
                void refreshAlerts();
              }}
            />
          </Window>

          <Window
            open={detailRecord !== null}
            title={detailRecord ? `${detailRecord.filename} - ${detailRecord.analysis_id}` : 'Analysis'}
            onClose={() => setDetailRecord(null)}
            widthClass="max-w-4xl"
          >
            {detailRecord && <AnalysisRecordDetail record={detailRecord} onChanged={() => void loadLibraryAndHistory(true)} />}
          </Window>
        </>
      )}

      {/* The analysis of a library video opens in a window on top of the page */}
      <Window
        open={mode === 'workspace' && selectedVideo !== null}
        title={selectedVideo ? `${SCENARIO_COPY[selectedVideo.use_case]?.title ?? selectedVideo.use_case_title} - ${selectedVideo.title}` : 'Video analysis'}
        onClose={() => setMode('library')}
        widthClass="max-w-6xl"
      >
        {selectedVideo && (
          <VideoAnalysisWorkspace
            selectedVideo={selectedVideo}
            selectedGroup={selectedGroup}
            scenarioVideos={scenarioVideos}
            selectedModelConfigured={selectedModelConfigured}
            activeAnalysis={activeAnalysis}
            triggeringVideoId={triggeringVideoId}
            actionError={actionError}
            reviewComment={reviewComment}
            reviewSaving={reviewSaving}
            scenarioTitle={SCENARIO_COPY[selectedVideo.use_case]?.title ?? selectedVideo.use_case_title}
            ScenarioIcon={SelectedIcon}
            onSelectVideo={handleSelectVideo}
            onAnalyzeVideo={handleAnalyzeVideo}
            onReviewDecision={handleReviewDecision}
            onReviewCommentChange={setReviewComment}
            onBackToLibrary={() => setMode('library')}
          />
        )}
      </Window>
    </div>
  );
};
