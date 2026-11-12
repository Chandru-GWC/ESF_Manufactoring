import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Factory,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Video,
  Activity,
  Lock,
} from 'lucide-react';

// Locally hosted hero media, served from /public/media. No backend call is needed:
// the poster is always rendered, and the video fades in only once it has really loaded.
const HERO_VIDEO_SRC = '/media/hero-factory.mp4';
const HERO_POSTER_SRC = '/media/hero-poster.jpg';

const SOLUTIONS = [
  {
    title: 'Fall & Posture Detection',
    tag: 'Active Model • OpenFall',
    description:
      'Detects worker slips, pre-fall instability, and ground-level falls using pose biomechanics.',
    status: 'active',
  },
  {
    title: 'Smoke & Fire Monitoring',
    tag: 'Active Model • YOLOv8',
    description:
      'Flags early thermal flare-ups, visible flames, and industrial smoke plumes across bays.',
    status: 'active',
  },
  {
    title: 'Emergency Exit Obstruction',
    tag: 'Active Model • YOLOv8n',
    description:
      'Monitors plant egress pathways and fire doors for blocked corridors and stalled vehicles.',
    status: 'active',
  },
  {
    title: 'Forklift–Pedestrian Near Miss',
    tag: 'Scenario Folder Ready',
    description:
      'Monitors shared material-handling aisles for close-proximity vehicle and pedestrian conflicts.',
    status: 'roadmap',
  },
  {
    title: 'Moving Machinery Proximity',
    tag: 'Scenario Folder Ready',
    description:
      'Evaluates perimeter entry near active presses, robotics cells, and rotating industrial lines.',
    status: 'roadmap',
  },
  {
    title: 'Unsafe Climbing / At Height',
    tag: 'Scenario Folder Ready',
    description:
      'Identifies unguarded mezzanine work, ladder instability, and working-at-height hazards.',
    status: 'roadmap',
  },
];

const INDUSTRIES = [
  {
    name: 'Discrete & Automotive Manufacturing',
    detail: 'SMT lines, final assembly cells, press shops, and automated welding bays.',
  },
  {
    name: 'Warehousing & Logistics',
    detail: 'High-density racking, forklift intersections, loading docks, and egress corridors.',
  },
  {
    name: 'Process & Chemical Operations',
    detail: 'Permit-to-work isolation oversight, thermal ignition detection, and LOTO readiness.',
  },
  {
    name: 'Heavy Industrial Fabrication',
    detail: 'High-noise shop floors requiring rapid shift hazard correlation and CAPA follow-through.',
  },
];

export const LandingPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [isPaused, setIsPaused] = useState<boolean>(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setPrefersReducedMotion(mq.matches);
      if (mq.matches) {
        setIsPaused(true);
        videoRef.current?.pause();
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const togglePlayback = () => {
    const vid = videoRef.current;
    if (!vid) {
      setIsPaused(prev => !prev);
      return;
    }
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPaused(false);
    } else {
      vid.pause();
      setIsPaused(true);
    }
  };

  const mountVideo = !videoFailed && !prefersReducedMotion;
  const showVideo = mountVideo && videoReady;
  const posterSrc = HERO_POSTER_SRC;

  return (
    <div className="min-h-screen bg-canvas-app text-ink-primary font-sans">
      {/* Top Hero / Navigation Chrome */}
      <header className="sticky top-0 z-40 bg-canvas-surface/95 backdrop-blur-md border-b border-line-subtle">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 focus-ring rounded-lg shrink-0">
            <div className="w-8 h-8 rounded-lg bg-ink-primary flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-ink-primary block leading-none">
                EHS Safety AI
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                Industrial Intelligence
              </span>
            </div>
          </Link>

          <nav aria-label="Landing Navigation" className="hidden md:flex items-center gap-7 text-xs font-semibold text-ink-secondary">
            <a href="#platform" className="hover:text-ink-primary transition-colors">
              Our Platform
            </a>
            <a href="#solutions" className="hover:text-ink-primary transition-colors">
              Safety Solutions
            </a>
            <a href="#industries" className="hover:text-ink-primary transition-colors">
              Industries
            </a>
            <a href="#about" className="hover:text-ink-primary transition-colors">
              About
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/login"
              className="px-3.5 py-2 text-xs font-semibold text-ink-primary bg-canvas-surface hover:bg-canvas-subtle border border-line-default rounded-lg transition-colors focus-ring"
            >
              Sign In
            </Link>
            <Link
              to="/overview"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-hover rounded-lg transition-colors focus-ring"
            >
              <span>Explore Safety Platform</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Full-Screen Industrial Video Hero */}
      <section className="relative w-full min-h-[82vh] lg:min-h-[88vh] flex items-center overflow-hidden bg-slate-950 text-white">
        {/* Local Poster / Fallback Image Always Mounted Underneath */}
        <img
          src={posterSrc}
          alt="Industrial manufacturing floor safety monitoring backdrop"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Local Full-Bleed Factory Video when public/media/hero-factory.mp4 exists */}
        {mountVideo && (
          <video
            ref={videoRef}
            src={HERO_VIDEO_SRC}
            poster={posterSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            onLoadedData={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* High-Contrast Dark Scrim Overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/45"
          aria-hidden="true"
        />

        {/* Hero Foreground Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-mono uppercase tracking-wider text-slate-100">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Enterprise Environmental, Health & Safety AI</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-white">
              See the Risk. Prevent the Incident.
            </h1>

            <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl">
              AI-powered workplace safety intelligence that helps manufacturing teams identify dangerous conditions, prevent incidents and build safer operations.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/overview"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-brand-primary hover:bg-brand-hover rounded-lg shadow-elevated transition-colors focus-ring"
              >
                <span>Explore Safety Platform</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/25 rounded-lg transition-colors focus-ring"
              >
                <span>Sign In</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-white/15 text-xs">
              <div>
                <div className="font-mono font-bold text-white text-sm">Computer Vision</div>
                <div className="text-slate-300 mt-0.5">Fall, fire/smoke & exit monitoring</div>
              </div>
              <div>
                <div className="font-mono font-bold text-white text-sm">Neon PostgreSQL</div>
                <div className="text-slate-300 mt-0.5">Grounded operations & shift logs</div>
              </div>
              <div>
                <div className="font-mono font-bold text-white text-sm">Officer Review</div>
                <div className="text-slate-300 mt-0.5">Human confirmation on every alert</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Play / Pause Control + Reduced Motion / Poster Indicator */}
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={!showVideo}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/75 hover:bg-slate-950/90 text-white border border-white/20 text-[11px] font-mono transition-colors disabled:opacity-75 focus-ring"
            aria-label={
              !showVideo
                ? 'Static industrial poster active'
                : isPaused
                ? 'Play background factory video'
                : 'Pause background factory video'
            }
          >
            {!showVideo ? (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-300" />
                <span>
                  {prefersReducedMotion ? 'Reduced Motion • Poster Active' : 'Static Poster Mode'}
                </span>
              </>
            ) : isPaused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Play Ambient Video</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Video</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Our Platform */}
      <section id="platform" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-2xl mb-10">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-primary">
            Our Platform
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary mt-1.5">
            Unified vision intelligence and structured operational EHS telemetry
          </h2>
          <p className="text-sm text-ink-secondary mt-2 leading-relaxed">
            Bring proactive computer vision detection together with hazard observations, shift rosters, permit controls, and maintenance priorities in one verifiable workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-xl bg-canvas-surface border border-line-subtle shadow-sm-subtle space-y-3">
            <div className="w-10 h-10 rounded-lg bg-brand-subtle text-brand-primary flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-ink-primary">Safety Video Library</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Inspect controlled facility video clips by scenario, run real OpenFall and YOLOv8 pipelines, review evidence frames, and log officer confirmations.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-canvas-surface border border-line-subtle shadow-sm-subtle space-y-3">
            <div className="w-10 h-10 rounded-lg bg-severity-high-bg text-severity-high-text flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-ink-primary">Live Operations & 3D Twin</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Explore zone-level safety exposure across assembly, SMT, packaging, and warehouse bays backed by Neon PostgreSQL telemetry.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-canvas-surface border border-line-subtle shadow-sm-subtle space-y-3">
            <div className="w-10 h-10 rounded-lg bg-severity-success-bg text-severity-success-text flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-ink-primary">Multi-Agent EHS Copilot</h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Ask natural-language safety questions routed across specialized hazard, workforce, maintenance, CAPA, and permit analysts.
            </p>
          </div>
        </div>
      </section>

      {/* Safety Solutions */}
      <section id="solutions" className="bg-canvas-surface border-y border-line-subtle py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-primary">
                Safety Solutions
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary mt-1.5">
                Six core industrial monitoring scenarios
              </h2>
            </div>
            <Link
              to="/monitoring/video"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline"
            >
              <span>Open Safety Video Intelligence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SOLUTIONS.map(item => (
              <div
                key={item.title}
                className="p-5 rounded-xl bg-canvas-app border border-line-subtle space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                      item.status === 'active'
                        ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                        : 'bg-canvas-surface text-ink-muted border-line-default'
                    }`}
                  >
                    {item.status === 'active' && <CheckCircle2 className="w-3 h-3" />}
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-ink-primary">{item.title}</h3>
                <p className="text-xs text-ink-secondary leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-2xl mb-10">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-primary">
            Industries
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary mt-1.5">
            Engineered for high-throughput industrial sites
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INDUSTRIES.map(ind => (
            <div
              key={ind.name}
              className="p-5 rounded-xl bg-canvas-surface border border-line-subtle flex items-start gap-3.5"
            >
              <div className="w-9 h-9 rounded-lg bg-canvas-subtle border border-line-subtle flex items-center justify-center shrink-0">
                <Factory className="w-4 h-4 text-ink-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">{ind.name}</h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{ind.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About & Governance */}
      <section id="about" className="bg-canvas-surface border-t border-line-subtle py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-ink-primary">
              <Lock className="w-3.5 h-3.5 text-brand-primary" />
              <span>Evidence-First Safety Governance</span>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Every metric, AI analysis, and video detection event is traced to verified Neon PostgreSQL records and requires explicit human safety officer review before closure.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-xs font-semibold text-ink-primary bg-canvas-subtle hover:bg-canvas-muted border border-line-default rounded-lg transition-colors focus-ring"
            >
              Operator Sign In
            </Link>
            <Link
              to="/overview"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-hover rounded-lg transition-colors focus-ring"
            >
              <span>Launch Command Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

