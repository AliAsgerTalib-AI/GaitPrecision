import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Activity, Radio, Waves } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from 'recharts';
import { useBalanceAnalyzer, type BalanceLeg } from '../hooks/useBalanceAnalyzer';
import { cn } from '@/src/lib/utils';

interface BalanceDashboardProps {
  videoSrc?: string | null;
}

function scoreLabel(s: number): string {
  if (s >= 80) return 'Excellent';
  if (s >= 60) return 'Good';
  if (s >= 40) return 'Fair';
  return 'Poor';
}

function scoreColor(s: number): string {
  if (s >= 80) return 'text-primary';
  if (s >= 60) return 'text-[#4ade80]';
  if (s >= 40) return 'text-[#f59e0b]';
  return 'text-error';
}

function scoreBg(s: number): string {
  if (s >= 80) return 'bg-primary/20 text-primary border-primary/30';
  if (s >= 60) return 'bg-[#4ade80]/20 text-[#4ade80] border-[#4ade80]/30';
  if (s >= 40) return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
  return 'bg-error/20 text-error border-error/30';
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 10);
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}.${ms}s`;
}

export default function BalanceDashboard({ videoSrc }: BalanceDashboardProps) {
  const {
    videoRef, canvasRef, isReady, isProcessing,
    activeLeg, setActiveLeg, metrics, startAnalysis,
  } = useBalanceAnalyzer();

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

  const { swayAmplitude, holdDuration, balanceScore, swaySeries } = metrics;

  // Mean X for reference line
  const meanX = swaySeries.length > 0
    ? swaySeries.reduce((s, p) => s + p.x, 0) / swaySeries.length
    : 0.5;

  // Last 150 points for the live chart
  const chartData = swaySeries.slice(-150).map(p => ({ t: p.t.toFixed(1), x: p.x }));

  // Sway in display units: SD * 1000, labelled "mU"
  const swayDisplay = (swayAmplitude * 1000).toFixed(1);

  if (isLoading) {
    return (
      <div className="pt-20 sm:pt-24 pb-12 px-3 sm:px-6 max-w-[1440px] mx-auto min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="aspect-video bg-surface-container-low rounded-2xl border border-outline-variant animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-shimmer" />
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
              <div className="font-mono text-[10px] text-primary uppercase tracking-[0.3em] font-bold">Initializing_Balance_Engine</div>
            </div>
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant h-40 animate-pulse" />
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

        {/* Left column: video + sway trace */}
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
                  No video loaded — record a balance session
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

              <div className="absolute top-6 left-6 right-6 flex justify-between">
                <div className="flex gap-3">
                  <div className="bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg font-mono text-[10px]">
                    <span className="text-primary mr-2 uppercase">Hold:</span>
                    <span className="text-on-surface tabular-nums">{formatDuration(holdDuration)}</span>
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

                {/* Live score badge in corner */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold border',
                        scoreBg(balanceScore),
                      )}
                    >
                      {scoreLabel(balanceScore).toUpperCase()} · {balanceScore}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Vertical center line — helps user see lateral drift */}
              {isProcessing && (
                <div className="absolute inset-y-0 left-1/2 -translate-x-px w-px bg-primary/20 z-10">
                  <span className="absolute top-16 left-2 font-mono text-[8px] text-primary/40 uppercase tracking-widest whitespace-nowrap">
                    center
                  </span>
                </div>
              )}
            </div>

            {/* Bottom control bar */}
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
                    <span className="font-mono text-xl text-on-surface font-bold tracking-tight leading-none tabular-nums">
                      {formatDuration(holdDuration)}
                    </span>
                    <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] mt-2 font-bold opacity-60">
                      Hold Duration
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant shadow-sm uppercase font-bold">
                  <Radio className={cn('w-3 h-3 transition-colors', isProcessing ? 'text-primary' : 'text-outline')} />
                  Balance_Mode
                </div>
              </div>
            </div>
          </div>

          {/* Sway trace chart */}
          <div className="bg-surface-container p-6 sm:p-8 rounded-2xl border border-outline-variant shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 font-mono text-[8px] text-outline-variant uppercase">Lateral_Sway_Trace</div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-on-surface mb-1">Hip Sway Trajectory</h3>
                <p className="text-on-surface-variant text-xs">Lateral position of the stance-side hip over time. Flatter = better stability.</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold opacity-60">SD (rolling 1.5 s)</p>
                <p className="font-mono text-lg font-bold text-primary tabular-nums">{swayDisplay}<span className="text-[10px] text-on-surface-variant ml-1">mU</span></p>
              </div>
            </div>

            {chartData.length > 5 ? (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                    <XAxis dataKey="t" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontFamily: 'monospace', fontSize: 10 }}
                      labelFormatter={(v) => `t=${v}s`}
                      formatter={(v: number) => [(v * 1000).toFixed(2) + ' mU', 'Position']}
                    />
                    <ReferenceLine y={meanX} stroke="#57f1db" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <Line
                      type="monotone"
                      dataKey="x"
                      stroke="#57f1db"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low">
                <span className="font-mono text-[10px] font-bold italic opacity-40 uppercase tracking-widest">
                  {isProcessing ? 'COLLECTING DATA...' : 'AWAITING ANALYSIS'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Right column: metrics */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant shadow-xl">

            {/* Stance leg selector */}
            <div className="mb-8">
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-3">
                Stance Leg
              </p>
              <div className="flex gap-2">
                {(['left', 'right'] as BalanceLeg[]).map((leg) => (
                  <button
                    key={leg}
                    onClick={() => setActiveLeg(leg)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest transition-all border',
                      activeLeg === leg
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/30',
                    )}
                  >
                    {leg === 'left' ? 'Left' : 'Right'}
                  </button>
                ))}
              </div>
            </div>

            {/* Balance score */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-surface-container-low border border-outline-variant rounded-2xl mb-4 relative overflow-hidden group"
            >
              <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
                <Waves className="w-3 h-3 text-primary" /> Balance Score
              </p>
              <div className="flex justify-between items-end">
                <div>
                  <p className={cn('text-6xl font-display font-bold tabular-nums tracking-tighter', scoreColor(balanceScore))}>
                    {balanceScore}
                  </p>
                  <p className={cn('font-mono text-xs font-bold uppercase tracking-widest mt-1', scoreColor(balanceScore))}>
                    {scoreLabel(balanceScore)}
                  </p>
                </div>
                {/* Arc gauge */}
                <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="4" className="text-surface-container-high" />
                  <circle
                    cx="28" cy="28" r="22"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke={balanceScore >= 80 ? '#57f1db' : balanceScore >= 60 ? '#4ade80' : balanceScore >= 40 ? '#f59e0b' : '#ef4444'}
                    strokeDasharray={`${(balanceScore / 100) * 138.2} 138.2`}
                    className="transition-all duration-500"
                  />
                </svg>
              </div>
            </motion.div>

            {/* Sway amplitude */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-surface-container-low border border-outline-variant rounded-2xl mb-4 group"
            >
              <p className="font-mono text-[10px] text-on-surface-variant mb-2 uppercase tracking-widest font-bold">
                Sway Amplitude
              </p>
              <div className="flex justify-between items-end">
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', isProcessing ? 'text-primary' : 'text-on-surface')}>
                  {swayDisplay}<span className="text-primary italic text-lg ml-1">mU</span>
                </p>
                <div className="text-right">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">Reference</p>
                  <p className="font-mono text-[10px] text-on-surface-variant">≤ 10 mU healthy</p>
                </div>
              </div>
              {/* Bar */}
              <div className="mt-3 h-1.5 bg-surface-container rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', swayAmplitude * 1000 <= 10 ? 'bg-primary' : swayAmplitude * 1000 <= 25 ? 'bg-[#f59e0b]' : 'bg-error')}
                  animate={{ width: `${Math.min(100, swayAmplitude * 1000 / 55 * 100)}%` }}
                  transition={{ type: 'tween', duration: 0.3 }}
                />
              </div>
            </motion.div>

            {/* Hold duration */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-surface-container-low border border-outline-variant rounded-2xl mb-4 group"
            >
              <p className="font-mono text-[10px] text-on-surface-variant mb-2 uppercase tracking-widest font-bold">
                Hold Duration
              </p>
              <div className="flex justify-between items-end">
                <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', isProcessing ? 'text-primary' : 'text-on-surface')}>
                  {formatDuration(holdDuration)}
                </p>
                <div className="text-right">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">Target</p>
                  <p className="font-mono text-[10px] text-on-surface-variant">30 s eyes open</p>
                </div>
              </div>
              {/* Progress toward 30s target */}
              <div className="mt-3 h-1.5 bg-surface-container rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${Math.min(100, (holdDuration / 30) * 100)}%` }}
                  transition={{ type: 'tween', duration: 0.3 }}
                />
              </div>
              {holdDuration >= 30 && (
                <p className="font-mono text-[9px] text-primary uppercase tracking-widest mt-2 font-bold">
                  30 s target reached
                </p>
              )}
            </motion.div>

            {/* Clinical reference note */}
            <div className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
              <p className="font-mono text-[9px] text-on-surface-variant leading-relaxed opacity-60">
                Romberg test reference: healthy adults maintain single-leg stance for 30 s (eyes open)
                with minimal sway. Score ≥ 80 = low fall risk.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
