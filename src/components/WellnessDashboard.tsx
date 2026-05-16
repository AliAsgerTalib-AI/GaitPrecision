import { Play, Activity, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGaitAnalyzer } from '../hooks/useGaitAnalyzer';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { saveSession, scoreFromAngles, statusFromScore, labelFromScore, type GaitSession } from '@/src/lib/sessionDb';

interface WellnessDashboardProps {
  videoSrc?: string | null;
}

function wellnessLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: 'Excellent', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' };
  if (score >= 70) return { label: 'Good', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' };
  if (score >= 50) return { label: 'Fair', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10 border-[#f59e0b]/20' };
  return { label: 'Needs Attention', color: 'text-error', bg: 'bg-error/10 border-error/20' };
}

function balanceLabel(asymmetry: number): { label: string; detail: string; color: string } {
  if (asymmetry <= 10) return { label: 'Well balanced', detail: 'Both legs are sharing the work evenly.', color: 'text-primary' };
  if (asymmetry <= 20) return { label: 'Slight imbalance', detail: 'One leg is doing a little more work. This is common.', color: 'text-[#f59e0b]' };
  return { label: 'Imbalance detected', detail: 'One leg is significantly carrying more load than the other.', color: 'text-error' };
}

function cadenceLabel(cadence: number): { label: string; detail: string } {
  if (cadence <= 0) return { label: '—', detail: 'Walk data still loading…' };
  if (cadence < 80) return { label: 'Slow pace', detail: 'Try to walk a little faster — aim for 100 steps per minute.' };
  if (cadence < 100) return { label: 'Moderate pace', detail: 'Good effort. A slightly brisker walk boosts heart health.' };
  if (cadence <= 120) return { label: 'Healthy pace', detail: 'Great rhythm! This is the ideal walking speed for fitness.' };
  return { label: 'Brisk pace', detail: 'Excellent walking speed.' };
}

function fallRisk(asymmetry: number, cadence: number, score: number): { level: 'Low' | 'Moderate' | 'Elevated'; color: string; dot: string; advice: string } {
  if ((asymmetry > 20 || cadence < 70 || score < 50) && cadence > 0) {
    return { level: 'Elevated', color: 'text-error', dot: 'bg-error', advice: 'Consider speaking with your doctor or physiotherapist about balance exercises.' };
  }
  if (asymmetry > 10 || (cadence > 0 && cadence < 90) || score < 70) {
    return { level: 'Moderate', color: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]', advice: 'Some imbalance detected. Balance and strength exercises can help.' };
  }
  return { level: 'Low', color: 'text-primary', dot: 'bg-primary', advice: 'Your walking pattern suggests a low fall risk. Keep it up!' };
}

export default function WellnessDashboard({ videoSrc }: WellnessDashboardProps) {
  const { videoRef, canvasRef, isReady, isProcessing, kneeAngles, hipAngles, ankleAngles, strideMetrics, startAnalysis } = useGaitAnalyzer();
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const currentLeftAngle = kneeAngles.left[kneeAngles.left.length - 1] || 0;
  const currentRightAngle = kneeAngles.right[kneeAngles.right.length - 1] || 0;
  const asymmetry = Math.abs(currentLeftAngle - currentRightAngle);
  const score = kneeAngles.left.length ? scoreFromAngles(kneeAngles) : 0;

  const autoStartedSrcRef = useRef<string | null>(null);
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
  }, [isReady, videoSrc, startAnalysis]);

  const latestRef = useRef({ kneeAngles, hipAngles, ankleAngles, strideMetrics });
  latestRef.current = { kneeAngles, hipAngles, ankleAngles, strideMetrics };

  const wasProcessingRef = useRef(false);
  useEffect(() => {
    const justFinished = wasProcessingRef.current && !isProcessing;
    wasProcessingRef.current = isProcessing;
    const { kneeAngles, hipAngles, ankleAngles, strideMetrics } = latestRef.current;
    if (!justFinished || !kneeAngles.left.length || !videoRef.current?.ended) return;
    const s = scoreFromAngles(kneeAngles);
    const session: GaitSession = {
      id: `SES-${Date.now()}`,
      date: Date.now(),
      duration: Math.round(videoRef.current.duration),
      label: labelFromScore(s),
      kneeAngles, hipAngles, ankleAngles,
      frameCount: kneeAngles.left.length,
      score: s,
      status: statusFromScore(s),
      stride: strideMetrics,
    };
    saveSession(session).catch(console.error);
  }, [isProcessing]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.clientWidth;
        canvasRef.current.height = videoRef.current.clientHeight;
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [videoRef, canvasRef]);

  const wellness = wellnessLabel(score);
  const balance = balanceLabel(asymmetry);
  const cadence = cadenceLabel(strideMetrics.cadence);
  const risk = fallRisk(asymmetry, strideMetrics.cadence, score);
  const hasData = kneeAngles.left.length > 0;

  if (isLoading) {
    return (
      <div className="pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <p className="text-lg text-on-surface font-medium">Getting ready…</p>
          <p className="text-sm text-on-surface-variant mt-1">This only takes a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Video Player */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div
            ref={containerRef}
            className="relative aspect-video bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant shadow-xl"
          >
            <video
              ref={videoRef}
              src={videoSrc ?? undefined}
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-all duration-1000',
                isProcessing ? 'opacity-30 grayscale contrast-125' : 'opacity-10'
              )}
              muted
              playsInline
            />

            {!videoSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-5">
                <div className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
                  <Play className="w-7 h-7 text-on-surface-variant" />
                </div>
                <p className="text-sm text-on-surface-variant text-center px-8">
                  No video loaded — record or upload a walk to get started
                </p>
              </div>
            )}

            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none drop-shadow-[0_0_15px_rgba(87,241,219,0.4)]" />

            {isProcessing && (
              <div className="absolute w-full h-0.5 bg-primary shadow-[0_0_20px_#57f1db] animate-scan z-20" />
            )}

            {/* Minimal status */}
            <div className="absolute top-4 left-4 z-20">
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md',
                isProcessing ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface/60 text-on-surface-variant border border-outline-variant/30'
              )}>
                <div className={cn('w-2 h-2 rounded-full', isProcessing ? 'bg-primary animate-pulse' : 'bg-on-surface-variant/40')} />
                {isProcessing ? 'Analyzing…' : 'Ready'}
              </div>
            </div>

            {/* Play button */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface/70 to-transparent p-6 z-20 flex items-center gap-4">
              <button
                onClick={startAnalysis}
                disabled={!isReady || isProcessing || !videoSrc}
                className="w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:shadow-none flex-shrink-0"
              >
                {isProcessing ? <Activity className="w-5 h-5 animate-pulse" /> : <Play className="fill-current w-5 h-5 ml-0.5" />}
              </button>
              <div>
                <p className="text-sm font-medium text-on-surface">{isProcessing ? 'Analysing your walk…' : videoSrc ? 'Press play to analyse' : 'Upload or record a video'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Your skeleton will appear as the video plays</p>
              </div>
            </div>
          </div>

          {/* Step balance bar */}
          <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant">
            <h3 className="text-base font-semibold text-on-surface mb-1">How You're Stepping</h3>
            <p className="text-sm text-on-surface-variant mb-5">The bar below shows how much time each leg spends on the ground.</p>

            <div className="h-14 w-full flex rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low">
              {strideMetrics.left.strideTime > 0 ? (
                <>
                  <div className="h-full bg-primary/40 flex items-center justify-center text-xs font-medium text-primary px-2 shrink-0" style={{ width: `${strideMetrics.left.stancePercent / 2}%` }}>
                    Left {strideMetrics.left.stancePercent}%
                  </div>
                  <div className="h-full bg-primary/10 flex items-center justify-center text-xs text-primary/60 px-2 shrink-0" style={{ width: `${strideMetrics.left.swingPercent / 2}%` }}>
                    swing
                  </div>
                  <div className="h-full bg-secondary/30 flex items-center justify-center text-xs font-medium text-secondary px-2 shrink-0" style={{ width: `${strideMetrics.right.stancePercent / 2}%` }}>
                    Right {strideMetrics.right.stancePercent}%
                  </div>
                  <div className="h-full bg-secondary/10 grow flex items-center justify-center text-xs text-secondary/60">swing</div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-on-surface-variant">
                  {isProcessing ? 'Detecting steps…' : 'Start analysis to see your step pattern'}
                </div>
              )}
            </div>

            {strideMetrics.cadence > 0 && (
              <p className="text-sm text-on-surface-variant mt-3 text-center">
                You're taking <strong className="text-on-surface">{strideMetrics.cadence} steps per minute</strong> — {cadence.label.toLowerCase()}
              </p>
            )}
          </div>
        </section>

        {/* Wellness Metrics */}
        <aside className="lg:col-span-5 flex flex-col gap-4">

          {/* Overall Wellness Score */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container p-6 rounded-2xl border border-outline-variant"
          >
            <p className="text-sm font-medium text-on-surface-variant mb-4">Overall Walking Score</p>
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-surface-container-high" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="#57f1db" strokeWidth="3"
                    strokeDasharray={`${hasData ? score : 0} 100`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-display font-bold text-on-surface">{hasData ? score : '—'}</span>
                </div>
              </div>
              <div>
                <p className={cn('text-2xl font-display font-bold', hasData ? wellness.color : 'text-on-surface-variant')}>
                  {hasData ? wellness.label : 'Waiting…'}
                </p>
                <p className="text-sm text-on-surface-variant mt-1">
                  {hasData ? 'Based on your knee and hip movement' : 'Score will appear once analysis starts'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Balance */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface-container p-6 rounded-2xl border border-outline-variant"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-on-surface-variant">Balance Check</p>
              <AnimatePresence>
                {hasData && asymmetry > 15 && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1 text-xs text-[#f59e0b]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Imbalance
                  </motion.div>
                )}
                {hasData && asymmetry <= 10 && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1 text-xs text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Balanced
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className={cn('text-xl font-display font-bold mb-1', hasData ? balance.color : 'text-on-surface-variant')}>
              {hasData ? balance.label : 'Waiting…'}
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
              {hasData ? balance.detail : 'Start analysis to check your balance.'}
            </p>

            {/* L/R bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-on-surface-variant w-5">Left</span>
              <div className="flex-1 h-3 bg-surface-container-low rounded-full relative border border-outline-variant/50">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-px h-full bg-outline-variant/40" />
                </div>
                <div
                  className={cn('absolute h-5 w-2 rounded-full -translate-y-1 transition-all duration-500 shadow-md', hasData && asymmetry > 15 ? 'bg-[#f59e0b]' : 'bg-primary')}
                  style={{ left: `${hasData ? Math.min(92, Math.max(8, 50 + (currentRightAngle - currentLeftAngle) * 2)) : 50}%` }}
                />
              </div>
              <span className="text-xs font-medium text-on-surface-variant w-6">Right</span>
            </div>
          </motion.div>

          {/* Walking Rhythm */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container p-6 rounded-2xl border border-outline-variant"
          >
            <p className="text-sm font-medium text-on-surface-variant mb-3">Walking Rhythm</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-display font-bold text-on-surface tabular-nums">
                {strideMetrics.cadence > 0 ? strideMetrics.cadence : '—'}
              </span>
              {strideMetrics.cadence > 0 && <span className="text-sm text-on-surface-variant">steps / min</span>}
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">{cadence.detail}</p>
          </motion.div>

          {/* Fall Risk */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn('p-6 rounded-2xl border', hasData ? risk.level === 'Elevated' ? 'bg-error/5 border-error/20' : risk.level === 'Moderate' ? 'bg-[#f59e0b]/5 border-[#f59e0b]/20' : 'bg-primary/5 border-primary/20' : 'bg-surface-container border-outline-variant')}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-on-surface-variant">Fall Risk</p>
              {/* Traffic lights */}
              <div className="flex gap-1.5">
                <div className={cn('w-3 h-3 rounded-full transition-all', hasData && risk.level === 'Low' ? 'bg-primary shadow-[0_0_8px_#57f1db]' : 'bg-surface-container-highest')} />
                <div className={cn('w-3 h-3 rounded-full transition-all', hasData && risk.level === 'Moderate' ? 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]' : 'bg-surface-container-highest')} />
                <div className={cn('w-3 h-3 rounded-full transition-all', hasData && risk.level === 'Elevated' ? 'bg-error shadow-[0_0_8px_theme(colors.red.500)]' : 'bg-surface-container-highest')} />
              </div>
            </div>
            <p className={cn('text-xl font-display font-bold mb-2', hasData ? risk.color : 'text-on-surface-variant')}>
              {hasData ? `${risk.level} Risk` : 'Waiting…'}
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {hasData ? risk.advice : 'Complete the analysis to see your fall risk assessment.'}
            </p>
            {!hasData && (
              <div className="flex items-center gap-2 mt-3 text-xs text-on-surface-variant opacity-60">
                <Info className="w-3.5 h-3.5" />
                Based on balance, cadence, and symmetry
              </div>
            )}
          </motion.div>
        </aside>
      </div>
    </div>
  );
}
