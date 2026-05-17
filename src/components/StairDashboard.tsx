import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Activity, Radio, Waves, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from 'recharts';
import { useStairAnalyzer } from '../hooks/useStairAnalyzer';
import { cn } from '@/src/lib/utils';

interface StairDashboardProps {
  videoSrc?: string | null;
}

// Convert interior angle → flexion degrees for display (higher = more bend = better)
const toFlex = (angle: number) => Math.round(180 - angle);

function consistencyLabel(sd: number): string {
  if (sd === 0) return '—';
  if (sd < 5)  return 'Excellent';
  if (sd < 10) return 'Good';
  if (sd < 15) return 'Fair';
  return 'Variable';
}

function consistencyColor(sd: number): string {
  if (sd === 0) return 'text-on-surface-variant';
  if (sd < 5)  return 'text-primary';
  if (sd < 10) return 'text-[#4ade80]';
  if (sd < 15) return 'text-[#f59e0b]';
  return 'text-error';
}

export default function StairDashboard({ videoSrc }: StairDashboardProps) {
  const { videoRef, canvasRef, isReady, isProcessing, metrics, startAnalysis } = useStairAnalyzer();
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
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
    stepCount, cadence,
    leftPeakAvg, rightPeakAvg,
    leftConsistency, rightConsistency,
    asymmetry, stepHistory, kneeAngles,
  } = metrics;

  const lFlex  = leftPeakAvg  > 0 ? toFlex(leftPeakAvg)  : 0;
  const rFlex  = rightPeakAvg > 0 ? toFlex(rightPeakAvg) : 0;

  // Chart: show flexion depth per step so higher bar = more bend
  const chartData = stepHistory.map(s => ({
    stepNum: s.stepNum,
    flex: toFlex(s.peak),
    leg: s.leg,
  }));

  // Sparkline points for knee angle trace
  const lPoints = kneeAngles.left.map((a, i) =>
    `${(i / Math.max(1, kneeAngles.left.length - 1)) * 100},${(a / 180) * 40}`).join(' ');
  const rPoints = kneeAngles.right.map((a, i) =>
    `${(i / Math.max(1, kneeAngles.right.length - 1)) * 100},${(a / 180) * 40}`).join(' ');

  if (isLoading) {
    return (
      <div className="pt-20 sm:pt-24 pb-12 px-3 sm:px-6 max-w-[1440px] mx-auto min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="aspect-video bg-surface-container-low rounded-2xl border border-outline-variant animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-shimmer" />
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
              <div className="font-mono text-[10px] text-primary uppercase tracking-[0.3em] font-bold">Initializing_Stair_Engine</div>
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

        {/* Left column: video + step chart */}
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

            {!videoSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-5">
                <div className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
                  <Play className="w-7 h-7 text-on-surface-variant" />
                </div>
                <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-[0.25em]">
                  No video loaded — record a stair climbing session
                </p>
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
                  <div className="bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg font-mono text-[10px]">
                    <span className="text-primary mr-2 uppercase">Steps:</span>
                    <span className="text-on-surface tabular-nums font-bold">{stepCount}</span>
                  </div>
                  <div className={cn(
                    'px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all flex items-center gap-2',
                    isProcessing
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-surface-container-high border-outline-variant text-on-surface-variant',
                  )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full bg-current', isProcessing && 'animate-pulse')} />
                    {isProcessing ? 'DETECTING' : 'STANDBY'}
                  </div>
                </div>

                {cadence > 0 && (
                  <div className="bg-surface/80 backdrop-blur-md border border-primary/30 px-3 py-1.5 rounded-lg font-mono text-[10px]">
                    <span className="text-primary mr-2 uppercase">Cadence:</span>
                    <span className="text-primary font-bold tabular-nums">{cadence} spm</span>
                  </div>
                )}
              </div>

              {/* No-step warning after processing for a while */}
              <AnimatePresence>
                {isProcessing && stepCount === 0 && kneeAngles.left.length >= 30 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-16 left-6 right-6 z-20 flex items-center gap-3 px-4 py-2.5 bg-[#f59e0b]/90 backdrop-blur-sm rounded-xl border border-[#f59e0b]/60 shadow-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-surface-container shrink-0" />
                    <p className="font-mono text-[10px] font-bold text-surface-container uppercase tracking-widest leading-relaxed">
                      No steps detected — ensure full leg is visible side-on and knee bends past 60°.
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
                    <span className="font-mono text-3xl text-on-surface font-bold tracking-tight leading-none tabular-nums">
                      {stepCount}
                    </span>
                    <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] mt-2 font-bold opacity-60">
                      Total Steps
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant shadow-sm uppercase font-bold">
                  <Radio className={cn('w-3 h-3 transition-colors', isProcessing ? 'text-primary' : 'text-outline')} />
                  Stair_Mode
                </div>
              </div>
            </div>
          </div>

          {/* Step flexion chart */}
          <div className="bg-surface-container p-6 sm:p-8 rounded-2xl border border-outline-variant shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 font-mono text-[8px] text-outline-variant uppercase">Step_Flexion_History</div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-on-surface mb-1">Peak Knee Flexion per Step</h3>
                <p className="text-on-surface-variant text-xs">Each bar is one step. Higher = more knee bend. Target: ≥ 80° for standard stairs.</p>
              </div>
              <div className="flex items-center gap-4 font-mono text-[10px] font-bold tracking-widest">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Left
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#a78bfa]" /> Right
                </span>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                    <XAxis
                      dataKey="stepNum"
                      tick={{ fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' }}
                      label={{ value: 'Step #', position: 'insideBottomRight', offset: -4, style: { fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' } }}
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
                        `${v}° (${props.payload.leg === 'left' ? 'L' : 'R'})`,
                        'Flexion',
                      ]}
                      labelFormatter={(v) => `Step ${v}`}
                    />
                    <ReferenceLine y={80} stroke="#57f1db" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '80° target', position: 'right', style: { fontFamily: 'monospace', fontSize: 8, fill: '#57f1db' } }} />
                    <Bar dataKey="flex" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.leg === 'left' ? '#57f1db' : '#a78bfa'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low">
                <span className="font-mono text-[10px] font-bold italic opacity-40 uppercase tracking-widest">
                  {isProcessing ? 'AWAITING FIRST STEP...' : 'AWAITING ANALYSIS'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Right column: metrics */}
        <aside className="lg:col-span-4 flex flex-col gap-4 sm:gap-6">
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant shadow-xl flex flex-col gap-4">

            {/* Step count + cadence */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Total Steps</p>
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', isProcessing ? 'text-primary' : 'text-on-surface')}>
                  {stepCount}
                </p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Cadence</p>
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', cadence > 0 && isProcessing ? 'text-primary' : 'text-on-surface')}>
                  {cadence > 0 ? cadence : '—'}
                  {cadence > 0 && <span className="text-sm text-primary ml-1">spm</span>}
                </p>
              </motion.div>
            </div>

            {/* Left leg metrics */}
            <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
              <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
                <Waves className="w-3 h-3 text-primary" /> Left Leg
              </p>
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest opacity-60">Peak Flexion</p>
                  <p className={cn('text-3xl font-display font-bold tabular-nums', lFlex > 0 ? 'text-primary' : 'text-on-surface-variant')}>
                    {lFlex > 0 ? lFlex : '—'}{lFlex > 0 && <span className="text-base text-primary ml-0.5">°</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest opacity-60">Consistency</p>
                  <p className={cn('font-mono text-xs font-bold', consistencyColor(leftConsistency))}>
                    {leftConsistency > 0 ? `±${leftConsistency.toFixed(1)}°` : '—'}
                  </p>
                  <p className={cn('font-mono text-[9px]', consistencyColor(leftConsistency))}>
                    {leftPeakAvg > 0 ? consistencyLabel(leftConsistency) : ''}
                  </p>
                </div>
              </div>
              {/* Sparkline */}
              <div className="h-8 opacity-60">
                <svg className="w-full h-full" viewBox="0 0 100 40">
                  {kneeAngles.left.length > 1 && (
                    <polyline fill="none" stroke="#57f1db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={lPoints} />
                  )}
                </svg>
              </div>
            </motion.div>

            {/* Right leg metrics */}
            <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
              <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
                <Waves className="w-3 h-3 text-[#a78bfa]" /> Right Leg
              </p>
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest opacity-60">Peak Flexion</p>
                  <p className={cn('text-3xl font-display font-bold tabular-nums', rFlex > 0 ? 'text-[#a78bfa]' : 'text-on-surface-variant')}>
                    {rFlex > 0 ? rFlex : '—'}{rFlex > 0 && <span className="text-base text-[#a78bfa] ml-0.5">°</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest opacity-60">Consistency</p>
                  <p className={cn('font-mono text-xs font-bold', consistencyColor(rightConsistency))}>
                    {rightConsistency > 0 ? `±${rightConsistency.toFixed(1)}°` : '—'}
                  </p>
                  <p className={cn('font-mono text-[9px]', consistencyColor(rightConsistency))}>
                    {rightPeakAvg > 0 ? consistencyLabel(rightConsistency) : ''}
                  </p>
                </div>
              </div>
              <div className="h-8 opacity-40">
                <svg className="w-full h-full" viewBox="0 0 100 40">
                  {kneeAngles.right.length > 1 && (
                    <polyline fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={rPoints} />
                  )}
                </svg>
              </div>
            </motion.div>

            {/* Asymmetry */}
            <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold">Step Asymmetry</p>
                <div className={cn(
                  'px-2 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-widest',
                  asymmetry > 15 ? 'bg-error/20 text-error' : 'bg-primary/20 text-primary',
                )}>
                  {asymmetry > 0 ? `${asymmetry.toFixed(1)}° Δ` : '—'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-on-surface-variant font-bold">L</span>
                <div className="flex-1 h-3 relative bg-surface-container rounded-full shadow-inner p-0.5">
                  <div className="absolute h-full w-px bg-outline-variant/30 left-1/2 -translate-x-1/2 z-10" />
                  <div
                    className={cn(
                      'absolute h-5 w-1.5 rounded-full z-20 transition-all duration-300 shadow-lg',
                      asymmetry > 15 ? 'bg-error shadow-error/40' : 'bg-primary shadow-primary/40',
                    )}
                    style={{ left: `${Math.min(95, Math.max(5, 50 + (rFlex - lFlex) * 2))}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-on-surface-variant font-bold">R</span>
              </div>
              <p className="text-[9px] text-on-surface-variant font-mono uppercase mt-3 text-center opacity-40">Flexion Differential</p>
            </motion.div>

            {/* Reference note */}
            <div className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
              <p className="font-mono text-[9px] text-on-surface-variant leading-relaxed opacity-60">
                Standard stair rise (~18 cm) requires ≥ 80° knee flexion. Consistency SD &lt; 5° indicates controlled, fatigue-free climbing. Asymmetry &gt; 15° may suggest compensation.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
