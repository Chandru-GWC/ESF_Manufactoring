import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface CleanVideoProps {
  src: string;
  label: string;
  fit?: 'cover' | 'contain';
  className?: string;
}

function fmt(t: number): string {
  if (!Number.isFinite(t)) return '0:00';
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

/**
 * Video preview with a custom control bar. The picture is cropped slightly (`.wm-crop`)
 * so the generator watermark in the bottom-right corner of our own generated clips is not
 * shown. Only the displayed preview is cropped — source files are never modified.
 * Controls live outside the cropped frame so they are never clipped.
 */
export const CleanVideo: React.FC<CleanVideoProps> = ({ src, label, fit = 'cover', className = '' }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [src]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div className={`rounded-lg overflow-hidden border border-line-subtle bg-slate-950 ${className}`}>
      <div className="relative aspect-video overflow-hidden">
        <video
          ref={ref}
          src={src}
          muted
          playsInline
          preload="metadata"
          aria-label={label}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          className={`wm-crop absolute inset-0 w-full h-full cursor-pointer ${
            fit === 'cover' ? 'object-cover' : 'object-contain'
          }`}
        />
      </div>
      <div className="flex items-center gap-2 px-2.5 h-9 bg-slate-900 text-slate-200">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          className="p-1 rounded hover:bg-white/10 focus-ring"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={time}
          onChange={e => {
            const v = ref.current;
            if (v) v.currentTime = Number(e.target.value);
          }}
          aria-label={`Seek ${label}`}
          className="flex-1 h-1 accent-orange-500"
        />
        <span className="font-mono text-[10px] tabular-nums text-slate-400 w-[74px] text-right">
          {fmt(time)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
};
