import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Activity, Radio, Waves, AlertTriangle, Upload, Video } from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from 'recharts';
import { useSquatAnalyzer, type SquatDepth } from '../hooks/useSquatAnalyzer';
import { cn } from '@/src/lib/utils';

interface SquatDashboardProps {
  videoSrc?: string | null;
  onRecord?: () => void;
  onUpload?: (file: File) => void;
}

const DEPTH_LABEL: Record<SquatDepth, string> = {
  partial:  'Partial',
  parallel: 'Parallel',
  deep:     'Deep',
};

const DEPTH_COLOR: Record<SquatDepth, string> = {
  partial:  'text-[#f59e0b]',
  parallel: 'text-primary',
  deep:     'text-[#4ade80]',
};

const DEPTH_BAR_COLOR: Record<SquatDepth, string> = {
  partial:  '#f59e0b',
  parallel: '#57f1db',
  deep:     '#4ade80',
};

// Convert interior angle to flexion degrees for display
const toFlex = (angle: number) => Math.round(180 - angle);

function backAngleFeedback(angle: number): { label: string; color: string } {
  if (angle < 20) return { label: 'Very upright', color: 'text-primary' };
  if (angle < 40) return { label: 'Good form',    color: 'text-[#4ade80]' };
  if (angle < 55) return { label: 'Slight lean',  color: 'text-[#f59e0b]' };
  return               { label: 'Excessive lean', color: 'text-error' };
}

export default function SquatDashboard({ videoSrc, onRecord, onUpload }: SquatDashboardProps) {
  const { videoRef, canvasRef, isReady, isProcessing, metrics, startAnalysis } = useSquatAnalyzer();
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { onUpload?.(file); e.target.value = ''; }
  }
  const autoStartedSrcRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isReady || !videoSrc || autoStartedSrcRef.current === videoSrc) return;
    const video = videoRef.current;
    if (!video) return;
    autoStartedSrcRef.current = videoSrc;
    const go = () => startAnalysis();
    if (video.readyState >= 3) {
      go();
    } else {
      video.addEventListener('canplay', go, { once: true });
      return () => video.removeEventListener('canplay', go);
    }
  }, [isReady, videoSrc, startAnalysis, videoRef]);

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
    repCount, avgDepth, depthConsistency,
    avgBackAngle, liveBackAngle, liveKneeAngle,
    repHistory, kneeAngles,
  } = metrics;

  const liveFlex  = toFlex(liveKneeAngle);
  const avgFlex   = avgDepth > 0 ? toFlex(avgDepth) : 0;
  const lastRep   = repHistory[repHistory.length - 1];
  const lastDepth = lastRep ? lastRep.depth : null;

  const backFeedback = backAngleFeedback(liveBackAngle);

  // Chart: depth per rep (flexion, higher bar = more bend = better)
  const chartData = repHistory.map(r => ({
    rep:   r.repNum,
    flex:  toFlex(r.peakAngle),
    depth: r.depth,
  }));

  // Sparkline for live knee angle
  const sparkPoints = kneeAngles.map((a, i) =>
    `${(i / Math.max(1, kneeAngles.length - 1)) * 100},${(a / 180) * 40}`).join(' ');

  if (isLoading) {
    return (
      <div className="pt-20 sm:pt-24 pb-12 px-3 sm:px-6 max-w-[1440px] mx-auto min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="aspect-video bg-surface-container-low rounded-2xl border border-outline-variant animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-shimmer" />
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
              <div className="font-mono text-[10px] text-primary uppercase tracking-[0.3em] font-bold">Initializing_Squat_Engine</div>
            </div>
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant h-48 animate-pulse" />
          </div>
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant h-full animate-pulse space-y-6">
              <div className="h-8 bg-surface-container-high rounded-lg w-1/3" />
              <div className="h-32 bg-surface-container-low rounded-xl" />
              <div className="h-32 bg-surface-container-low rounded-xl" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 sm:pt-24 pb-12 px-3 sm:px-6 max-w-[1440px] mx-auto min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

        {/* Left column: video + rep chart */}
        <section className="lg:col-span-8 flex flex-col gap-4 sm:gap-6">

          {/* Video player */}
          <div
            ref={containerRef}
            className="relative aspect-video bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant shadow-2xl"
          >
            <video
              ref={videoRef}
              src={videoSrc ?? undefined}
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-all duration-1000',
                isProcessing ? 'opacity-30 grayscale contrast-125' : 'opacity-10',
              )}
              muted
              playsInline
            />

            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

            {!videoSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-5">
                <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-[0.25em] opacity-50">No video loaded</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button onClick={onRecord} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                    <Video className="w-4 h-4" /> Record Session
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high border border-outline-variant rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:border-primary/50 hover:text-primary text-on-surface-variant transition-all">
                    <Upload className="w-4 h-4" /> Upload Video
                  </button>
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full z-10 pointer-events-none drop-shadow-[0_0_15px_rgba(87,241,219,0.5)]"
            />

            {/* HUD */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {isProcessing && (
                <div className="absolute w-full h-0.5 bg-primary shadow-[0_0_20px_#57f1db] animate-scan z-20" />
              )}

              <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                <div className="flex gap-3">
                  {/* Rep counter badge */}
                  <div className="bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg font-mono text-[10px]">
                    <span className="text-primary mr-2 uppercase">Reps:</span>
                    <span className="text-on-surface tabular-nums font-bold text-sm">{repCount}</span>
                  </div>
                  <div className={cn(
                    'px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all flex items-center gap-2',
                    isProcessing
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-surface-container-high border-outline-variant text-on-surface-variant',
                  )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full bg-current', isProcessing && 'animate-pulse')} />
                    {isProcessing ? 'TRACKING' : 'STANDBY'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg font-mono text-[10px]"
                      >
                        <span className="text-on-surface-variant mr-2 uppercase">Flex:</span>
                        <span className={cn('font-bold tabular-nums', liveFlex >= 80 ? 'text-[#4ade80]' : liveFlex >= 50 ? 'text-primary' : 'text-on-surface-variant')}>
                          {liveFlex}°
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <button onClick={() => fileInputRef.current?.click()} title="Upload video" className="bg-surface/80 backdrop-blur-md border border-outline-variant/60 p-1.5 rounded-lg hover:border-primary/50 hover:text-primary text-on-surface-variant transition-all">
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={onRecord} title="Record new session" className="bg-surface/80 backdrop-blur-md border border-outline-variant/60 p-1.5 rounded-lg hover:border-primary/50 hover:text-primary text-on-surface-variant transition-all">
                      <Video className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* No-rep warning */}
              <AnimatePresence>
                {isProcessing && repCount === 0 && kneeAngles.length >= 30 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-16 left-6 right-6 z-20 flex items-center gap-3 px-4 py-2.5 bg-[#f59e0b]/90 backdrop-blur-sm rounded-xl border border-[#f59e0b]/60 shadow-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-surface-container shrink-0" />
                    <p className="font-mono text-[10px] font-bold text-surface-container uppercase tracking-widest leading-relaxed">
                      No reps detected — ensure full leg is visible side-on and knee bends past 50°.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Last rep flash */}
              <AnimatePresence>
                {lastDepth && (
                  <motion.div
                    key={repCount}
                    initial={{ opacity: 0, scale: 1.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                  >
                    <p className={cn('font-display text-5xl font-bold', DEPTH_COLOR[lastDepth])}>
                      {DEPTH_LABEL[lastDepth]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface/80 to-transparent p-8 z-20">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <button
                    onClick={startAnalysis}
                    disabled={!isReady || isProcessing || !videoSrc}
                    className="w-16 h-16 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:shadow-none"
                  >
                    {!isReady || isProcessing ? (
                      <Activity className="w-6 h-6 animate-pulse" />
                    ) : (
                      <Play className="fill-current w-6 h-6 ml-1" />
                    )}
                  </button>

                  <div className="flex flex-col ml-4">
                    <span className="font-mono text-4xl text-on-surface font-bold tracking-tight leading-none tabular-nums">
                      {repCount}
                    </span>
                    <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] mt-2 font-bold opacity-60">
                      Reps Completed
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant shadow-sm uppercase font-bold">
                  <Radio className={cn('w-3 h-3 transition-colors', isProcessing ? 'text-primary' : 'text-outline')} />
                  Squat_Mode
                </div>
              </div>
            </div>
          </div>

          {/* Depth per rep chart */}
          <div className="bg-surface-container p-6 sm:p-8 rounded-2xl border border-outline-variant shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 font-mono text-[8px] text-outline-variant uppercase">Rep_Depth_History</div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-on-surface mb-1">Depth per Rep</h3>
                <p className="text-on-surface-variant text-xs">Each bar = one rep. Higher = deeper squat. Amber = partial, teal = parallel, green = deep.</p>
              </div>
              {avgFlex > 0 && (
                <div className="text-right">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold opacity-60">Avg Depth</p>
                  <p className="font-mono text-lg font-bold text-primary tabular-nums">{avgFlex}°<span className="text-[10px] text-on-surface-variant ml-1">flex</span></p>
                </div>
              )}
            </div>

            {chartData.length > 0 ? (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                    <XAxis
                      dataKey="rep"
                      tick={{ fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' }}
                      label={{ value: 'Rep #', position: 'insideBottomRight', offset: -4, style: { fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' } }}
                    />
                    <YAxis
                      domain={[0, 120]}
                      tick={{ fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' }}
                      width={28}
                      label={{ value: 'Flex °', angle: -90, position: 'insideLeft', style: { fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' } }}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontFamily: 'monospace', fontSize: 10 }}
                      formatter={(v: number, _: string, props: any) => [
                        `${v}° — ${DEPTH_LABEL[props.payload.depth as SquatDepth]}`,
                        'Flexion',
                      ]}
                      labelFormatter={(v) => `Rep ${v}`}
                    />
                    {/* Parallel reference line at 90° of flexion */}
                    <ReferenceLine y={90} stroke="#57f1db" strokeDasharray="4 4" strokeOpacity={0.5}
                      label={{ value: 'Parallel', position: 'right', style: { fontFamily: 'monospace', fontSize: 8, fill: '#57f1db' } }} />
                    <Bar dataKey="flex" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={DEPTH_BAR_COLOR[entry.depth]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low">
                <span className="font-mono text-[10px] font-bold italic opacity-40 uppercase tracking-widest">
                  {isProcessing ? 'AWAITING FIRST REP...' : 'AWAITING ANALYSIS'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Right column: metrics */}
        <aside className="lg:col-span-4 flex flex-col gap-4 sm:gap-6">
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant shadow-xl flex flex-col gap-4">

            {/* Rep count + avg depth */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Reps</p>
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', isProcessing ? 'text-primary' : 'text-on-surface')}>
                  {repCount}
                </p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Avg Depth</p>
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', avgFlex > 0 ? 'text-primary' : 'text-on-surface-variant')}>
                  {avgFlex > 0 ? avgFlex : '—'}{avgFlex > 0 && <span className="text-base text-primary ml-0.5">°</span>}
                </p>
              </motion.div>
            </div>

            {/* Live knee flexion */}
            <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
              <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
                <Waves className="w-3 h-3 text-primary" /> Live Knee Flexion
              </p>
              <div className="flex justify-between items-end mb-3">
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', isProcessing ? 'text-primary' : 'text-on-surface')}>
                  {liveFlex}<span className="text-primary italic text-xl ml-1">°</span>
                </p>
                <div className="text-right">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest opacity-60">Target</p>
                  <p className="font-mono text-[10px] text-on-surface-variant">≥ 90° parallel</p>
                </div>
              </div>
              {/* Depth bar */}
              <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', liveFlex >= 90 ? 'bg-[#4ade80]' : liveFlex >= 50 ? 'bg-primary' : 'bg-[#f59e0b]')}
                  animate={{ width: `${Math.min(100, liveFlex / 120 * 100)}%` }}
                  transition={{ type: 'tween', duration: 0.15 }}
                />
              </div>
              {/* Sparkline */}
              <div className="h-8 mt-3 opacity-60">
                <svg className="w-full h-full" viewBox="0 0 100 40">
                  {kneeAngles.length > 1 && (
                    <polyline fill="none" stroke="#57f1db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={sparkPoints} />
                  )}
                </svg>
              </div>
            </motion.div>

            {/* Back angle / torso lean */}
            <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
              <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold">Back Angle (Torso Lean)</p>
              <div className="flex justify-between items-end mb-2">
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', backFeedback.color)}>
                  {liveBackAngle > 0 ? `${Math.round(liveBackAngle)}°` : '—'}
                </p>
                <p className={cn('font-mono text-xs font-bold uppercase tracking-widest', backFeedback.color)}>
                  {liveBackAngle > 0 ? backFeedback.label : ''}
                </p>
              </div>
              <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', liveBackAngle < 40 ? 'bg-[#4ade80]' : liveBackAngle < 55 ? 'bg-[#f59e0b]' : 'bg-error')}
                  animate={{ width: `${Math.min(100, liveBackAngle / 90 * 100)}%` }}
                  transition={{ type: 'tween', duration: 0.15 }}
                />
              </div>
              {avgBackAngle > 0 && (
                <p className="font-mono text-[9px] text-on-surface-variant mt-2 opacity-60">
                  Session avg: {Math.round(avgBackAngle)}° lean
                </p>
              )}
            </motion.div>

            {/* Consistency */}
            <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
              <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold">Depth Consistency</p>
              <div className="flex justify-between items-end">
                <p className={cn(
                  'text-3xl font-display font-bold tabular-nums tracking-tighter',
                  depthConsistency === 0 ? 'text-on-surface-variant'
                    : depthConsistency < 8 ? 'text-primary'
                    : depthConsistency < 15 ? 'text-[#f59e0b]'
                    : 'text-error',
                )}>
                  {depthConsistency > 0 ? `±${depthConsistency.toFixed(1)}°` : '—'}
                </p>
                <p className={cn(
                  'font-mono text-xs font-bold uppercase tracking-widest',
                  depthConsistency === 0 ? 'text-on-surface-variant'
                    : depthConsistency < 8 ? 'text-primary'
                    : depthConsistency < 15 ? 'text-[#f59e0b]'
                    : 'text-error',
                )}>
                  {depthConsistency === 0 ? '' : depthConsistency < 8 ? 'Consistent' : depthConsistency < 15 ? 'Variable' : 'Inconsistent'}
                </p>
              </div>
            </motion.div>

            {/* Reference note */}
            <div className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
              <p className="font-mono text-[9px] text-on-surface-variant leading-relaxed opacity-60">
                Parallel squat: ≥ 90° knee flexion (thighs horizontal). Back lean 30–45° is normal for barbell squats; less for goblet squats. Consistency SD &lt; 8° = controlled reps.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
