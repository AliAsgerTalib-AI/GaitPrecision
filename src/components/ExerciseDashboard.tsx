import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Activity, Radio, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
  LineChart, Line,
} from 'recharts';
import { useExerciseAnalyzer, type ExerciseType, type ExerciseDepth, VALGUS_WARN, VALGUS_BAD } from '../hooks/useExerciseAnalyzer';
import { cn } from '@/src/lib/utils';

interface ExerciseDashboardProps {
  videoSrc?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEPTH_LABEL: Record<ExerciseDepth, string> = {
  partial:  'Partial',
  parallel: 'Parallel',
  deep:     'Deep',
};

const DEPTH_BAR: Record<ExerciseDepth, string> = {
  partial:  '#f59e0b',
  parallel: '#57f1db',
  deep:     '#4ade80',
};

const EXERCISE_LABEL: Record<ExerciseType, string> = {
  squat:    'Squat',
  lunge:    'Lunge',
  hiphinge: 'Hip Hinge',
};

const EXERCISE_ANGLE_LABEL: Record<ExerciseType, string> = {
  squat:    'Knee angle',
  lunge:    'Lead knee',
  hiphinge: 'Hip angle',
};

function valgusColor(v: number): string {
  if (v >= VALGUS_BAD)  return 'text-error';
  if (v >= VALGUS_WARN) return 'text-[#f59e0b]';
  return 'text-[#4ade80]';
}

function valgusLabel(v: number): string {
  if (v >= VALGUS_BAD)  return 'Valgus!';
  if (v >= VALGUS_WARN) return 'Watch';
  return 'Aligned';
}

function valgusBarPct(v: number): number {
  return Math.min(100, Math.round((Math.max(0, v) / VALGUS_BAD) * 100));
}

function valgusBarColor(v: number): string {
  if (v >= VALGUS_BAD)  return 'bg-error';
  if (v >= VALGUS_WARN) return 'bg-[#f59e0b]';
  return 'bg-[#4ade80]';
}

function toFlex(angle: number) { return Math.round(180 - angle); }

function depthColor(depth: ExerciseDepth): string {
  if (depth === 'deep')     return 'text-[#4ade80]';
  if (depth === 'parallel') return 'text-primary';
  return 'text-[#f59e0b]';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseDashboard({ videoSrc }: ExerciseDashboardProps) {
  const {
    videoRef, canvasRef, metrics, isReady, isProcessing,
    exerciseType, setExerciseType, startAnalysis,
  } = useExerciseAnalyzer();

  const containerRef        = useRef<HTMLDivElement>(null);
  const autoStartedSrcRef   = useRef<string | null>(null);

  // Auto-start when video is ready
  useEffect(() => {
    if (!isReady || !videoSrc || autoStartedSrcRef.current === videoSrc) return;
    const video = videoRef.current;
    if (!video) return;
    autoStartedSrcRef.current = videoSrc;
    const go = () => startAnalysis();
    if (video.readyState >= 3) go();
    else {
      video.addEventListener('canplay', go, { once: true });
      return () => video.removeEventListener('canplay', go);
    }
  }, [isReady, videoSrc, startAnalysis, videoRef]);

  // Keep canvas sized to video
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width  = videoRef.current.clientWidth;
        canvasRef.current.height = videoRef.current.clientHeight;
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [videoRef, canvasRef]);

  const {
    repCount, liveAngle, liveLeftValgus, liveRightValgus,
    avgDepth, depthConsistency, avgLeftValgus, avgRightValgus,
    repHistory, angleTrace,
  } = metrics;

  const latestRep  = repHistory[repHistory.length - 1];
  const showValgus = exerciseType !== 'hiphinge';

  const chartData = repHistory.map(r => ({
    rep:   r.repNum,
    flex:  toFlex(r.peakAngle),
    depth: r.depth,
    vl:    r.leftValgus,
    vr:    r.rightValgus,
  }));

  return (
    <div className="min-h-screen bg-surface text-on-surface">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-outline-variant bg-surface-container-low/60 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-on-surface">Exercise Analysis</h1>
              <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                {EXERCISE_LABEL[exerciseType]} · Rep counting + valgus detection
              </p>
            </div>
          </div>

          {/* Exercise sub-selector */}
          <div className="flex rounded-xl border border-outline-variant overflow-hidden">
            {(['squat', 'lunge', 'hiphinge'] as ExerciseType[]).map((t, i, arr) => (
              <button
                key={t}
                onClick={() => setExerciseType(t)}
                className={cn(
                  'px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-all',
                  i > 0 && 'border-l border-outline-variant',
                  exerciseType === t
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
                )}
              >
                {EXERCISE_LABEL[t]}
              </button>
            ))}
          </div>

          {/* HUD badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high border border-outline-variant rounded-lg">
              <Radio className={cn('w-3 h-3', isProcessing ? 'text-primary animate-pulse' : 'text-on-surface-variant')} />
              <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold">
                {isProcessing ? 'Live' : isReady ? 'Ready' : 'Loading…'}
              </span>
            </div>
            <div className="px-4 py-2 bg-surface-container-highest rounded-xl border border-primary/20 text-center">
              <div className="font-mono text-2xl font-bold text-primary tabular-nums">{repCount}</div>
              <div className="font-mono text-[8px] text-on-surface-variant uppercase tracking-widest">Reps</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* Left — video */}
        <div className="space-y-4">
          {/* Video + canvas */}
          <div
            ref={containerRef}
            className="relative bg-black rounded-3xl overflow-hidden border border-outline-variant aspect-video"
          >
            <video
              ref={videoRef}
              src={videoSrc ?? undefined}
              autoPlay loop muted playsInline
              className="w-full h-full object-contain"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />

            {/* Loading overlay */}
            <AnimatePresence>
              {!isReady && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                >
                  <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="font-mono text-xs text-on-surface-variant uppercase tracking-widest">Loading pose engine…</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Depth flash on new rep */}
            <AnimatePresence>
              {latestRep && (
                <motion.div
                  key={latestRep.repNum}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1,  scale: 1 }}
                  exit={{   opacity: 0,  scale: 1.15 }}
                  transition={{ duration: 0.35 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none"
                >
                  <div className={cn(
                    'px-5 py-2 rounded-full border font-mono text-sm font-bold uppercase tracking-widest backdrop-blur-sm',
                    latestRep.depth === 'deep'     ? 'bg-[#4ade80]/20 border-[#4ade80]/40 text-[#4ade80]'
                  : latestRep.depth === 'parallel' ? 'bg-primary/20 border-primary/40 text-primary'
                  :                                  'bg-[#f59e0b]/20 border-[#f59e0b]/40 text-[#f59e0b]',
                  )}>
                    Rep {latestRep.repNum} · {DEPTH_LABEL[latestRep.depth]}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Corner accents */}
            {['tl','tr','bl','br'].map(c => (
              <div key={c} className={cn(
                'absolute w-6 h-6 border-primary/30',
                c === 'tl' && 'top-3 left-3 border-t-2 border-l-2 rounded-tl-lg',
                c === 'tr' && 'top-3 right-3 border-t-2 border-r-2 rounded-tr-lg',
                c === 'bl' && 'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg',
                c === 'br' && 'bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg',
              )} />
            ))}
          </div>

          {/* Angle trace */}
          {angleTrace.length > 4 && (
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4">
              <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
                {EXERCISE_ANGLE_LABEL[exerciseType]} trace (°)
              </p>
              <ResponsiveContainer width="100%" height={70}>
                <LineChart data={angleTrace}>
                  <Line type="monotone" dataKey="angle" stroke="#57f1db" strokeWidth={1.5} dot={false} />
                  <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.5} />
                  <YAxis domain={[60, 180]} hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right — stats */}
        <div className="space-y-4">

          {/* Live angle */}
          <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
              Live · {EXERCISE_ANGLE_LABEL[exerciseType]}
            </p>
            <div className="flex items-end gap-3 mb-3">
              <span className="font-mono text-4xl font-bold text-primary tabular-nums">{liveAngle}°</span>
              <span className="font-mono text-xs text-on-surface-variant mb-1">
                {toFlex(liveAngle)}° flex
              </span>
            </div>
            {/* Flex bar */}
            <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full transition-colors',
                  toFlex(liveAngle) < 60  ? 'bg-[#f59e0b]'
                : toFlex(liveAngle) < 90  ? 'bg-primary'
                :                           'bg-[#4ade80]',
                )}
                animate={{ width: `${Math.min(100, (toFlex(liveAngle) / 120) * 100)}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>
          </div>

          {/* Valgus indicators (squat / lunge only) */}
          {showValgus && (
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5 space-y-4">
              <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                Knee alignment (valgus)
              </p>

              {([
                { label: 'Left knee',  live: liveLeftValgus,  avg: avgLeftValgus },
                { label: 'Right knee', live: liveRightValgus, avg: avgRightValgus },
              ] as const).map(({ label, live, avg }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] text-on-surface-variant">{label}</span>
                    <span className={cn('font-mono text-[10px] font-bold', valgusColor(live))}>
                      {valgusLabel(live)}
                    </span>
                  </div>
                  {/* Valgus bar */}
                  <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden mb-1">
                    <motion.div
                      className={cn('h-full rounded-full', valgusBarColor(live))}
                      animate={{ width: `${valgusBarPct(live)}%` }}
                      transition={{ duration: 0.15 }}
                    />
                  </div>
                  <p className="font-mono text-[8px] text-on-surface-variant/50">
                    Avg per rep: {(avg * 100).toFixed(0)}% hip-width offset
                  </p>
                </div>
              ))}

              {(liveLeftValgus >= VALGUS_WARN || liveRightValgus >= VALGUS_WARN) && (
                <div className="flex items-start gap-2 bg-[#f59e0b]/8 border border-[#f59e0b]/20 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0 mt-0.5" />
                  <p className="font-mono text-[9px] text-[#f59e0b] leading-relaxed">
                    Knee tracking inside ankle — focus on pushing knees out over toes.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Depth summary */}
          <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-4">Depth summary</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container rounded-xl px-3 py-3 text-center">
                <div className="font-mono text-xl font-bold text-on-surface tabular-nums">
                  {avgDepth === 180 ? '—' : `${toFlex(avgDepth)}°`}
                </div>
                <div className="font-mono text-[8px] text-on-surface-variant uppercase tracking-widest mt-0.5">Avg flex</div>
              </div>
              <div className="bg-surface-container rounded-xl px-3 py-3 text-center">
                <div className="font-mono text-xl font-bold text-on-surface tabular-nums">
                  {depthConsistency === 0 ? '—' : `±${depthConsistency}°`}
                </div>
                <div className="font-mono text-[8px] text-on-surface-variant uppercase tracking-widest mt-0.5">Consistency</div>
              </div>
            </div>

            {/* Latest rep depth pill */}
            {latestRep && (
              <div className={cn(
                'mt-3 text-center font-mono text-xs font-bold uppercase tracking-widest py-2 rounded-xl border',
                latestRep.depth === 'deep'     ? 'bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80]'
              : latestRep.depth === 'parallel' ? 'bg-primary/10 border-primary/20 text-primary'
              :                                  'bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#f59e0b]',
              )}>
                Last rep: {DEPTH_LABEL[latestRep.depth]}
              </div>
            )}
          </div>

          {/* Rep history chart */}
          {chartData.length > 0 && (
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">Rep history</p>
                <div className="flex items-center gap-3">
                  {(['deep','parallel','partial'] as ExerciseDepth[]).map(d => (
                    <span key={d} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: DEPTH_BAR[d] }} />
                      <span className="font-mono text-[8px] text-on-surface-variant">{DEPTH_LABEL[d]}</span>
                    </span>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData} barSize={14}>
                  <XAxis dataKey="rep" tick={{ fontFamily: 'monospace', fontSize: 9, fill: '#888' }} />
                  <YAxis domain={[0, 120]} tick={{ fontFamily: 'monospace', fontSize: 9, fill: '#888' }} />
                  <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.6} label={{ value: '90°', position: 'right', fontSize: 9, fill: '#f59e0b', fontFamily: 'monospace' }} />
                  <Tooltip
                    contentStyle={{ background: '#1a2232', border: '1px solid #334155', borderRadius: 8, fontFamily: 'monospace', fontSize: 10 }}
                    formatter={(v: number, _: string, entry: any) => [`${v}° flex · ${DEPTH_LABEL[entry.payload.depth]}`, 'Depth']}
                    labelFormatter={(l: number) => `Rep ${l}`}
                  />
                  <Bar dataKey="flex">
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={DEPTH_BAR[d.depth]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Valgus per rep — only for squat/lunge */}
          {showValgus && repHistory.length > 0 && (
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
              <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
                Per-rep valgus severity
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {[...repHistory].reverse().map(r => {
                  const worst = Math.max(r.leftValgus, r.rightValgus);
                  return (
                    <div key={r.repNum} className="flex items-center gap-3">
                      <span className="font-mono text-[9px] text-on-surface-variant w-10 shrink-0">Rep {r.repNum}</span>
                      <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', valgusBarColor(worst))}
                          style={{ width: `${valgusBarPct(worst)}%` }}
                        />
                      </div>
                      <span className={cn('font-mono text-[9px] w-14 text-right', valgusColor(worst))}>
                        {valgusLabel(worst)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {repCount === 0 && isReady && (
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6 text-center">
              <Play className="w-8 h-8 text-primary/40 mx-auto mb-3" />
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
                Perform a {EXERCISE_LABEL[exerciseType].toLowerCase()} to start tracking
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
