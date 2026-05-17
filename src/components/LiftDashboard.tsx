import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Activity, Radio, Waves, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from 'recharts';
import { useLiftAnalyzer, type LiftType } from '../hooks/useLiftAnalyzer';
import { cn } from '@/src/lib/utils';

interface LiftDashboardProps {
  videoSrc?: string | null;
}

// ── Deadlift helpers ──────────────────────────────────────────────────────────

// Convert hip interior angle to hinge depth label
function hingeLabel(angle: number): string {
  if (angle <= 75)  return 'Deep hinge';
  if (angle <= 100) return 'Good hinge';
  if (angle <= 120) return 'Partial hinge';
  return 'Minimal hinge';
}

function hingeColor(angle: number): string {
  if (angle <= 75)  return 'text-[#4ade80]';
  if (angle <= 100) return 'text-primary';
  if (angle <= 120) return 'text-[#f59e0b]';
  return 'text-error';
}

function backAngleLabel(angle: number): string {
  if (angle < 30)  return 'Upright';
  if (angle < 50)  return 'Good lean';
  if (angle < 65)  return 'High lean';
  return 'Excessive';
}

function backColor(angle: number): string {
  if (angle < 50) return 'text-primary';
  if (angle < 65) return 'text-[#f59e0b]';
  return 'text-error';
}

// ── OHP helpers ───────────────────────────────────────────────────────────────

function elbowLabel(angle: number): string {
  if (angle >= 165) return 'Locked';
  if (angle >= 145) return 'Near lock';
  if (angle >= 120) return 'Partial';
  return 'Bent';
}

function elbowColor(angle: number): string {
  if (angle >= 165) return 'text-[#4ade80]';
  if (angle >= 145) return 'text-primary';
  if (angle >= 120) return 'text-[#f59e0b]';
  return 'text-error';
}

function asymColor(asym: number): string {
  if (asym < 5)  return 'text-primary';
  if (asym < 12) return 'text-[#f59e0b]';
  return 'text-error';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LiftDashboard({ videoSrc }: LiftDashboardProps) {
  const {
    videoRef, canvasRef, isReady, isProcessing,
    liftType, setLiftType, metrics, startAnalysis,
  } = useLiftAnalyzer();

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
    if (video.readyState >= 3) { go(); }
    else { video.addEventListener('canplay', go, { once: true }); return () => video.removeEventListener('canplay', go); }
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
    repCount, liveHipAngle, liveBackAngle, avgMinHipAngle, avgBackAngle,
    liveLeftElbow, liveRightElbow, liveAsymmetry, pressHeight, avgAsymmetry,
    lockoutReached, repHistory, angleTrace,
  } = metrics;

  // Sparkline points (hip angle for DL, avg elbow for OHP)
  const sparkPoints = angleTrace.map((v, i) =>
    `${(i / Math.max(1, angleTrace.length - 1)) * 100},${(v / 180) * 40}`).join(' ');

  // Chart data
  const chartData = repHistory.map(r => ({
    rep:     r.repNum,
    // DL: hinge depth (180 - minHipAngle = flexion, higher = better)
    dlFlex:  r.minHipAngle != null ? Math.round(180 - r.minHipAngle) : 0,
    // OHP: avg elbow at lockout
    avgElbow: r.leftElbow != null && r.rightElbow != null ? Math.round((r.leftElbow + r.rightElbow) / 2) : 0,
    asym:    r.asymmetry != null ? Math.round(r.asymmetry) : 0,
    locked:  r.locked,
  }));

  const noDataFrames = angleTrace.length >= 30 && repCount === 0;

  if (isLoading) {
    return (
      <div className="pt-20 sm:pt-24 pb-12 px-3 sm:px-6 max-w-[1440px] mx-auto min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="aspect-video bg-surface-container-low rounded-2xl border border-outline-variant animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-shimmer" />
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
              <div className="font-mono text-[10px] text-primary uppercase tracking-[0.3em] font-bold">Initializing_Lift_Engine</div>
            </div>
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant h-48 animate-pulse" />
          </div>
          <aside className="lg:col-span-4">
            <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant h-full animate-pulse" />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 sm:pt-24 pb-12 px-3 sm:px-6 max-w-[1440px] mx-auto min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <section className="lg:col-span-8 flex flex-col gap-4 sm:gap-6">

          {/* Lift type selector */}
          <div className="flex gap-3">
            {(['deadlift', 'ohp'] as LiftType[]).map(lt => (
              <button
                key={lt}
                onClick={() => setLiftType(lt)}
                className={cn(
                  'flex-1 py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest transition-all border',
                  liftType === lt
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-primary/30',
                )}
              >
                {lt === 'deadlift' ? 'Deadlift — Hip Hinge' : 'Overhead Press — Elbow Lockout'}
              </button>
            ))}
          </div>

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
              muted playsInline
            />

            {!videoSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-5">
                <div className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
                  <Play className="w-7 h-7 text-on-surface-variant" />
                </div>
                <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-[0.25em]">
                  No video loaded — record a lifting session
                </p>
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full z-10 pointer-events-none drop-shadow-[0_0_15px_rgba(87,241,219,0.5)]"
            />

            {/* HUD */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {isProcessing && <div className="absolute w-full h-0.5 bg-primary shadow-[0_0_20px_#57f1db] animate-scan z-20" />}

              <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg font-mono text-[10px]">
                    <span className="text-primary mr-2 uppercase">Reps:</span>
                    <span className="text-on-surface tabular-nums font-bold text-sm">{repCount}</span>
                  </div>
                  <div className={cn(
                    'px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all flex items-center gap-2',
                    isProcessing ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-container-high border-outline-variant text-on-surface-variant',
                  )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full bg-current', isProcessing && 'animate-pulse')} />
                    {isProcessing ? 'TRACKING' : 'STANDBY'}
                  </div>
                </div>

                {/* OHP lockout indicator */}
                <AnimatePresence>
                  {liftType === 'ohp' && isProcessing && lockoutReached && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 bg-[#4ade80]/20 border border-[#4ade80]/40 px-3 py-1.5 rounded-lg backdrop-blur-md"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" />
                      <span className="font-mono text-[10px] text-[#4ade80] font-bold uppercase tracking-widest">Lockout</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* No-rep warning */}
              <AnimatePresence>
                {isProcessing && noDataFrames && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute top-16 left-6 right-6 z-20 flex items-center gap-3 px-4 py-2.5 bg-[#f59e0b]/90 backdrop-blur-sm rounded-xl border border-[#f59e0b]/60 shadow-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-surface-container shrink-0" />
                    <p className="font-mono text-[10px] font-bold text-surface-container uppercase tracking-widest leading-relaxed">
                      {liftType === 'deadlift'
                        ? 'No reps detected — ensure full body is visible side-on and hip clearly hinges.'
                        : 'No reps detected — ensure arms and shoulders are visible and wrists rise above shoulders.'}
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
                    {!isReady || isProcessing ? <Activity className="w-6 h-6 animate-pulse" /> : <Play className="fill-current w-6 h-6 ml-1" />}
                  </button>
                  <div className="flex flex-col ml-4">
                    <span className="font-mono text-4xl text-on-surface font-bold tracking-tight leading-none tabular-nums">{repCount}</span>
                    <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] mt-2 font-bold opacity-60">Reps</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant shadow-sm uppercase font-bold">
                  <Radio className={cn('w-3 h-3 transition-colors', isProcessing ? 'text-primary' : 'text-outline')} />
                  {liftType === 'deadlift' ? 'Deadlift_Mode' : 'OHP_Mode'}
                </div>
              </div>
            </div>
          </div>

          {/* Rep history chart */}
          <div className="bg-surface-container p-6 sm:p-8 rounded-2xl border border-outline-variant shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 font-mono text-[8px] text-outline-variant uppercase">Rep_History</div>

            {liftType === 'deadlift' ? (
              <>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-xl font-display font-bold text-on-surface mb-1">Hip Hinge Depth per Rep</h3>
                    <p className="text-on-surface-variant text-xs">Higher bar = deeper hinge. Target: ≥ 80° hip flexion (interior angle ≤ 100°).</p>
                  </div>
                  {avgMinHipAngle > 0 && (
                    <div className="text-right">
                      <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold opacity-60">Avg Hinge</p>
                      <p className="font-mono text-lg font-bold text-primary tabular-nums">{Math.round(180 - avgMinHipAngle)}°<span className="text-[10px] text-on-surface-variant ml-1">flex</span></p>
                    </div>
                  )}
                </div>
                {chartData.length > 0 ? (
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                        <XAxis dataKey="rep" tick={{ fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' }} />
                        <YAxis domain={[0, 130]} width={28} tick={{ fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' }} />
                        <Tooltip contentStyle={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontFamily: 'monospace', fontSize: 10 }}
                          formatter={(v: number) => [`${v}° hip flex`, 'Hinge depth']} labelFormatter={v => `Rep ${v}`} />
                        <ReferenceLine y={80} stroke="#57f1db" strokeDasharray="4 4" strokeOpacity={0.5}
                          label={{ value: '80° target', position: 'right', style: { fontFamily: 'monospace', fontSize: 8, fill: '#57f1db' } }} />
                        <Bar dataKey="dlFlex" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          {chartData.map((d, i) => (
                            <Cell key={i} fill={d.dlFlex >= 80 ? '#4ade80' : d.dlFlex >= 60 ? '#57f1db' : '#f59e0b'} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-36 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low">
                    <span className="font-mono text-[10px] font-bold italic opacity-40 uppercase tracking-widest">{isProcessing ? 'AWAITING FIRST REP...' : 'AWAITING ANALYSIS'}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-xl font-display font-bold text-on-surface mb-1">Elbow Angle at Lockout per Rep</h3>
                    <p className="text-on-surface-variant text-xs">Higher = more extension. Target: ≥ 165° for full lockout. Bars show avg; asymmetry dots above.</p>
                  </div>
                  {avgAsymmetry > 0 && (
                    <div className="text-right">
                      <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold opacity-60">Avg Asymmetry</p>
                      <p className={cn('font-mono text-lg font-bold tabular-nums', asymColor(avgAsymmetry))}>{avgAsymmetry.toFixed(1)}°</p>
                    </div>
                  )}
                </div>
                {chartData.length > 0 ? (
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                        <XAxis dataKey="rep" tick={{ fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' }} />
                        <YAxis domain={[100, 180]} width={28} tick={{ fontFamily: 'monospace', fontSize: 9, fill: 'var(--color-on-surface-variant)' }} />
                        <Tooltip contentStyle={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontFamily: 'monospace', fontSize: 10 }}
                          formatter={(v: number, n: string, props: any) => [
                            n === 'avgElbow' ? `${v}° avg elbow` : `${v}° L-R gap`,
                            n === 'avgElbow' ? 'Lockout' : 'Asymmetry',
                          ]} labelFormatter={v => `Rep ${v}`} />
                        <ReferenceLine y={165} stroke="#4ade80" strokeDasharray="4 4" strokeOpacity={0.5}
                          label={{ value: 'Lockout', position: 'right', style: { fontFamily: 'monospace', fontSize: 8, fill: '#4ade80' } }} />
                        <Bar dataKey="avgElbow" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          {chartData.map((d, i) => (
                            <Cell key={i} fill={d.locked ? '#4ade80' : d.avgElbow >= 145 ? '#57f1db' : '#f59e0b'} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-36 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low">
                    <span className="font-mono text-[10px] font-bold italic opacity-40 uppercase tracking-widest">{isProcessing ? 'AWAITING FIRST REP...' : 'AWAITING ANALYSIS'}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <aside className="lg:col-span-4 flex flex-col gap-4 sm:gap-6">
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant shadow-xl flex flex-col gap-4">

            {liftType === 'deadlift' ? (
              <>
                {/* Rep count */}
                <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Reps Completed</p>
                  <p className={cn('text-5xl font-display font-bold tabular-nums tracking-tighter', isProcessing ? 'text-primary' : 'text-on-surface')}>{repCount}</p>
                </motion.div>

                {/* Live hip hinge */}
                <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                  <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
                    <Waves className="w-3 h-3 text-primary" /> Hip Hinge Angle
                  </p>
                  <div className="flex justify-between items-end mb-2">
                    <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', hingeColor(liveHipAngle))}>
                      {Math.round(liveHipAngle)}<span className="text-xl ml-0.5">°</span>
                    </p>
                    <p className={cn('font-mono text-xs font-bold uppercase tracking-widest', hingeColor(liveHipAngle))}>
                      {liveHipAngle > 0 ? hingeLabel(liveHipAngle) : ''}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden mb-3">
                    <motion.div
                      className={cn('h-full rounded-full', liveHipAngle <= 100 ? 'bg-[#4ade80]' : liveHipAngle <= 120 ? 'bg-primary' : 'bg-[#f59e0b]')}
                      animate={{ width: `${Math.min(100, Math.max(0, (175 - liveHipAngle) / 100 * 100))}%` }}
                      transition={{ type: 'tween', duration: 0.15 }}
                    />
                  </div>
                  {/* Sparkline */}
                  <div className="h-8 opacity-60">
                    <svg className="w-full h-full" viewBox="0 0 100 40">
                      {angleTrace.length > 1 && <polyline fill="none" stroke="#57f1db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={sparkPoints} />}
                    </svg>
                  </div>
                </motion.div>

                {/* Back angle */}
                <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                  <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold">Back Angle (Torso)</p>
                  <div className="flex justify-between items-end mb-2">
                    <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', backColor(liveBackAngle))}>
                      {liveBackAngle > 0 ? `${Math.round(liveBackAngle)}°` : '—'}
                    </p>
                    <p className={cn('font-mono text-xs font-bold uppercase tracking-widest', backColor(liveBackAngle))}>
                      {liveBackAngle > 0 ? backAngleLabel(liveBackAngle) : ''}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', liveBackAngle < 50 ? 'bg-primary' : liveBackAngle < 65 ? 'bg-[#f59e0b]' : 'bg-error')}
                      animate={{ width: `${Math.min(100, liveBackAngle / 90 * 100)}%` }}
                      transition={{ type: 'tween', duration: 0.15 }}
                    />
                  </div>
                  {avgBackAngle > 0 && (
                    <p className="font-mono text-[9px] text-on-surface-variant mt-2 opacity-60">Session avg: {Math.round(avgBackAngle)}°</p>
                  )}
                </motion.div>

                {/* Avg hinge depth */}
                {avgMinHipAngle > 0 && (
                  <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                    <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Avg Hinge Depth</p>
                    <p className={cn('text-3xl font-display font-bold tabular-nums', hingeColor(avgMinHipAngle))}>
                      {Math.round(180 - avgMinHipAngle)}°<span className="text-sm ml-1 opacity-60">flex</span>
                    </p>
                    <p className={cn('font-mono text-[9px] mt-1', hingeColor(avgMinHipAngle))}>{hingeLabel(avgMinHipAngle)}</p>
                  </motion.div>
                )}

                <div className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                  <p className="font-mono text-[9px] text-on-surface-variant leading-relaxed opacity-60">
                    Conventional deadlift: hip hinge to ~80–100° of hip flexion. Back angle 30–50° from vertical is normal. Spine neutral throughout.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Rep count */}
                <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Reps Completed</p>
                  <p className={cn('text-5xl font-display font-bold tabular-nums tracking-tighter', isProcessing ? 'text-primary' : 'text-on-surface')}>{repCount}</p>
                </motion.div>

                {/* Left elbow */}
                <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                  <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
                    <Waves className="w-3 h-3 text-primary" /> Left Elbow
                  </p>
                  <div className="flex justify-between items-end mb-2">
                    <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', elbowColor(liveLeftElbow))}>
                      {liveLeftElbow > 0 ? `${Math.round(liveLeftElbow)}°` : '—'}
                    </p>
                    <p className={cn('font-mono text-xs font-bold uppercase tracking-widest', elbowColor(liveLeftElbow))}>
                      {liveLeftElbow > 0 ? elbowLabel(liveLeftElbow) : ''}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', liveLeftElbow >= 165 ? 'bg-[#4ade80]' : liveLeftElbow >= 145 ? 'bg-primary' : 'bg-[#f59e0b]')}
                      animate={{ width: `${Math.min(100, Math.max(0, (liveLeftElbow - 90) / 90 * 100))}%` }}
                      transition={{ type: 'tween', duration: 0.15 }}
                    />
                  </div>
                </motion.div>

                {/* Right elbow */}
                <motion.div whileHover={{ scale: 1.02 }} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                  <p className="font-mono text-[10px] text-on-surface-variant mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
                    <Waves className="w-3 h-3 text-[#a78bfa]" /> Right Elbow
                  </p>
                  <div className="flex justify-between items-end mb-2">
                    <p className={cn('text-4xl font-display font-bold tabular-nums tracking-tighter', elbowColor(liveRightElbow))}>
                      {liveRightElbow > 0 ? `${Math.round(liveRightElbow)}°` : '—'}
                    </p>
                    <p className={cn('font-mono text-xs font-bold uppercase tracking-widest', elbowColor(liveRightElbow))}>
                      {liveRightElbow > 0 ? elbowLabel(liveRightElbow) : ''}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', liveRightElbow >= 165 ? 'bg-[#4ade80]' : liveRightElbow >= 145 ? 'bg-[#a78bfa]' : 'bg-[#f59e0b]')}
                      animate={{ width: `${Math.min(100, Math.max(0, (liveRightElbow - 90) / 90 * 100))}%` }}
                      transition={{ type: 'tween', duration: 0.15 }}
                    />
                  </div>
                </motion.div>

                {/* Asymmetry + press height */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.div whileHover={{ scale: 1.02 }} className="p-4 bg-surface-container-low border border-outline-variant rounded-2xl">
                    <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Asymmetry</p>
                    <p className={cn('text-2xl font-display font-bold tabular-nums', asymColor(liveAsymmetry))}>
                      {liveLeftElbow > 0 ? `${liveAsymmetry.toFixed(1)}°` : '—'}
                    </p>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} className="p-4 bg-surface-container-low border border-outline-variant rounded-2xl">
                    <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Press Height</p>
                    <div className="h-10 bg-surface-container rounded-full overflow-hidden flex items-end">
                      <motion.div
                        className="w-full bg-primary rounded-full"
                        animate={{ height: `${Math.min(100, pressHeight / 0.25 * 100)}%` }}
                        transition={{ type: 'tween', duration: 0.15 }}
                      />
                    </div>
                  </motion.div>
                </div>

                {avgAsymmetry > 0 && (
                  <div className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                    <p className="font-mono text-[9px] text-on-surface-variant leading-relaxed opacity-60">
                      Avg asymmetry: {avgAsymmetry.toFixed(1)}°. OHP lockout: both elbows ≥ 165°. Asymmetry &gt; 10° may indicate shoulder mobility imbalance.
                    </p>
                  </div>
                )}

                <div className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/50">
                  <p className="font-mono text-[9px] text-on-surface-variant leading-relaxed opacity-60">
                    Overhead press: full lockout = elbows ≥ 165° with bar directly overhead. Symmetry within 5° = balanced pressing pattern.
                  </p>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
