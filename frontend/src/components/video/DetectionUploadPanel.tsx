import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, UploadCloud, XCircle } from 'lucide-react';
import { ehsApi, mediaUrl } from '../../services/api';
import { VideoAnalysisResult, VideoUseCase } from '../../types/ehs';

export interface DetectionScenarioOption {
  use_case: VideoUseCase;
  title: string;
  configured: boolean;
}

interface DetectionUploadPanelProps {
  scenarios: DetectionScenarioOption[];
  plantId: string;
  /** Called once when an upload finishes (completed or failed) so the page can refresh its history. */
  onFinished: () => void;
}

const POLL_MS = 1500;

/**
 * Upload a video, watch it being analysed, then see the detection result.
 * The original file is shown while the model runs ("Analysing video..."); when the backend reports
 * completion the annotated video (with the detection boxes drawn) replaces it.
 */
export const DetectionUploadPanel: React.FC<DetectionUploadPanelProps> = ({ scenarios, plantId, onFinished }) => {
  const firstReady = scenarios.find(s => s.configured)?.use_case ?? scenarios[0]?.use_case ?? 'fall_detection';
  const [useCase, setUseCase] = useState<VideoUseCase>(firstReady);
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const finishedFor = useRef<string | null>(null);

  // Keep the selected scenario valid once the library has loaded.
  useEffect(() => {
    if (!scenarios.some(s => s.use_case === useCase) && scenarios.length) setUseCase(firstReady);
  }, [scenarios, useCase, firstReady]);

  // Local preview of the chosen file; released when replaced.
  useEffect(() => {
    if (!file) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Poll while the backend is analysing.
  const pollingId = analysis?.status === 'PROCESSING' ? analysis.analysis_id : null;
  useEffect(() => {
    if (!pollingId) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const latest = await ehsApi.getVideoAnalysisById(pollingId);
        if (!cancelled) setAnalysis(latest);
      } catch {
        // transient network error: keep polling
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollingId]);

  const status = analysis?.status;
  const isProcessing = status === 'PROCESSING';
  const isFailed = status === 'FAILED';
  const isDone = !!analysis && !isProcessing && !isFailed;

  useEffect(() => {
    if (analysis && !isProcessing && finishedFor.current !== analysis.analysis_id) {
      finishedFor.current = analysis.analysis_id;
      onFinished();
    }
  }, [analysis, isProcessing, onFinished]);

  const start = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setShowOriginal(false);
    try {
      const started = await ehsApi.uploadVideoForDetection(useCase, file, plantId);
      setAnalysis(started);
    } catch (err: any) {
      setError(err?.message || 'The video could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setError(null);
    setShowOriginal(false);
    finishedFor.current = null;
    if (inputRef.current) inputRef.current.value = '';
  };

  const annotatedUrl = analysis?.annotated_video_url ? mediaUrl(analysis.annotated_video_url) : null;
  const storedOriginalUrl = analysis?.original_video_url ? mediaUrl(analysis.original_video_url) : null;
  const playingAnnotated = isDone && !!annotatedUrl && !showOriginal;
  // While analysing we show the local file instantly; afterwards the copy stored on the server.
  const videoSrc = playingAnnotated ? annotatedUrl : isDone && storedOriginalUrl ? storedOriginalUrl : localUrl;
  const locked = isProcessing || uploading;
  const pct = Math.max(3, analysis?.progress_pct ?? 0);

  return (
    <section aria-label="Upload a video for detection" className="rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-brand-orange" aria-hidden="true" />
            Upload a video for detection
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Choose a scenario and a video. The model draws the detection boxes, which takes a little while.
          </p>
        </div>
        {(file || analysis) && !locked && (
          <button type="button" onClick={reset} className="text-xs font-semibold text-brand-primary hover:underline focus-ring rounded">
            Upload another video
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Controls */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-ink-secondary" htmlFor="detection-scenario">
            Detection scenario
          </label>
          <select
            id="detection-scenario"
            value={useCase}
            disabled={locked || !!analysis}
            onChange={e => setUseCase(e.target.value as VideoUseCase)}
            className="w-full h-10 px-3 rounded-lg border border-line-default bg-canvas-subtle text-sm font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-60"
          >
            {scenarios.map(s => (
              <option key={s.use_case} value={s.use_case} disabled={!s.configured}>
                {s.title}
                {s.configured ? '' : ' (model not configured)'}
              </option>
            ))}
          </select>

          <label className="block text-xs font-semibold text-ink-secondary" htmlFor="detection-file">
            Video file
          </label>
          <input
            ref={inputRef}
            id="detection-file"
            type="file"
            accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
            disabled={locked || !!analysis}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-ink-secondary file:mr-3 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-canvas-subtle file:text-ink-primary file:font-semibold hover:file:bg-canvas-muted disabled:opacity-60"
          />
          {file && (
            <p className="text-[11px] font-mono text-ink-muted truncate" title={file.name}>
              {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}

          <button
            type="button"
            onClick={start}
            disabled={!file || locked || !!analysis}
            className="w-full h-10 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:bg-canvas-subtle disabled:text-ink-muted disabled:border disabled:border-line-default disabled:cursor-not-allowed focus-ring"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Uploading…
              </>
            ) : (
              'Upload & analyse'
            )}
          </button>
          {error && (
            <p role="alert" className="text-xs text-severity-critical-text bg-severity-critical-bg border border-severity-critical-border rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Video + status */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-slate-900 aspect-video">
            {videoSrc ? (
              <video
                key={videoSrc}
                src={videoSrc}
                controls
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
                aria-label={playingAnnotated ? 'Video with detections drawn' : 'Uploaded video'}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[11px] font-mono text-slate-400 px-4 text-center">
                The video you choose appears here
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 backdrop-blur-sm px-4 py-3 space-y-2" role="status" aria-live="polite">
                <div className="flex items-center justify-between gap-3 text-white">
                  <span className="inline-flex items-center gap-2 text-sm font-bold">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-orange" aria-hidden="true" />
                    Analysing video…
                  </span>
                  <span className="font-mono text-sm">{analysis?.progress_pct ?? 0}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-brand-orange transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] font-mono text-slate-300 truncate">
                  {analysis?.current_stage || 'Starting detection'}
                  {analysis?.frames_processed ? ` · frame ${analysis.frames_processed}${analysis.total_frames ? ` / ${analysis.total_frames}` : ''}` : ''}
                </p>
              </div>
            )}
          </div>

          {isDone && analysis && (
            <div role="status" aria-live="polite" className="rounded-lg border border-severity-success-border bg-severity-success-bg px-4 py-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-severity-success-text">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Analysis completed
                </p>
                {annotatedUrl && (
                  <button
                    type="button"
                    onClick={() => setShowOriginal(v => !v)}
                    className="text-xs font-semibold text-brand-primary hover:underline focus-ring rounded"
                  >
                    {playingAnnotated ? 'Show original video' : 'Show detections'}
                  </button>
                )}
              </div>
              <p className="text-sm text-ink-primary font-semibold">
                {analysis.event_detected
                  ? `${analysis.event_label || 'Safety event detected'}${
                      analysis.event_timestamp_sec !== null ? ` at ${analysis.event_timestamp_sec.toFixed(1)}s` : ''
                    } - needs human review`
                  : 'No safety event detected'}
              </p>
              <p className="text-xs text-ink-secondary">{analysis.summary}</p>
              <p className="text-[11px] font-mono text-ink-muted">
                {analysis.analysis_id} · {analysis.model_used || 'CV worker'}
                {analysis.original_video_url ? ' · original video stored on the server' : ''}
              </p>
            </div>
          )}

          {isFailed && analysis && (
            <div role="alert" className="rounded-lg border border-severity-critical-border bg-severity-critical-bg px-4 py-3 space-y-1">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-severity-critical-text">
                <XCircle className="w-4 h-4" aria-hidden="true" />
                Analysis failed
              </p>
              <p className="text-xs text-ink-secondary">{analysis.error_message || analysis.summary}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
