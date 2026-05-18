import { Play, Activity, AlertTriangle, CheckCircle2, Info, Upload, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGaitAnalyzer } from '../hooks/useGaitAnalyzer';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { saveSession, scoreFromAngles, type GaitSession } from '@/src/lib/sessionDb';
import { getNormsFromProfile } from '@/src/lib/normativeRanges';
import { getAgeGroup, AGE_GROUP_LABELS, BENCHMARKS } from '@/src/lib/userProfile';

interface WellnessDashboardProps {
  videoSrc?: string | null;
  onRecord?: () => void;
  onUpload?: (file: File) => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1] as const;
type SpeedOption = typeof SPEED_OPTIONS[number];

function generateDiagnosis(score: number, asymmetry: number, cadence: number, riskLevel: 'Low' | 'Moderate' | 'Elevated') {
  let headline: string;
  let summary: string;
  let color: string;
  const findings: string[] = [];

  if (score >= 85) {
    headline = 'Excellent Walking Pattern';
    summary = 'Your gait analysis shows excellent biomechanical quality across all measured parameters. Your movement patterns are well within healthy norms.';
    color = 'text-primary';
  } else if (score >= 70) {
    headline = 'Good Walking Pattern';
    summary = 'Your gait shows a good foundation with minor areas that could benefit from targeted attention.';
    color = 'text-primary';
  } else if (score >= 50) {
    headline = 'Fair Walking Pattern — Some Areas to Watch';
    summary = 'Your walking pattern shows functional movement with some compensatory mechanics that may benefit from professional guidance.';
    color = 'text-[#f59e0b]';
  } else {
    headline = 'Walking Pattern Needs Professional Attention';
    summary = 'Your gait analysis has identified several biomechanical concerns. A physiotherapist evaluation is recommended.';
    color = 'text-error';
  }

  if (asymmetry <= 10) {
    findings.push('Symmetrical loading — left and right legs are sharing the work evenly, indicating good neuromuscular control.');
  } else if (asymmetry <= 20) {
    findings.push(`Mild asymmetry of ${asymmetry.toFixed(0)}° detected. One leg is doing slightly more work — common in most adults but worth monitoring.`);
  } else {
    findings.push(`Significant asymmetry of ${asymmetry.toFixed(0)}° detected. One side is carrying considerably more load, increasing long-term joint stress.`);
  }

  if (cadence > 0) {
    if (cadence < 80) {
      findings.push(`Cadence of ${cadence} spm is below recommended levels. A slower cadence increases ground-reaction forces and fall risk.`);
    } else if (cadence < 100) {
      findings.push(`Cadence of ${cadence} spm is moderate. Aim for 100–120 spm for optimal cardiovascular and joint benefit.`);
    } else if (cadence <= 120) {
      findings.push(`Cadence of ${cadence} spm falls within the ideal healthy range (100–120 spm) — excellent walking rhythm.`);
    } else {
      findings.push(`Brisk cadence of ${cadence} spm — great for cardiovascular health and metabolic efficiency.`);
    }
  }

  if (riskLevel === 'Elevated') {
    findings.push('Multiple gait indicators converge on elevated fall risk. Immediate assessment by a healthcare professional is advised.');
  } else if (riskLevel === 'Moderate') {
    findings.push('Moderate fall risk indicators present. Balance training and targeted hip strengthening are recommended.');
  } else {
    findings.push('Overall fall risk is low — gait stability indicators are within safe limits.');
  }

  let recommendation: string;
  if (riskLevel === 'Elevated' || score < 50) {
    recommendation = 'Schedule an appointment with a physiotherapist or sports medicine physician. A detailed functional movement assessment can identify the root causes and guide an appropriate rehabilitation programme.';
  } else if (riskLevel === 'Moderate' || score < 70) {
    recommendation = 'Consider adding balance and coordination exercises to your weekly routine — single-leg stance, heel-toe walking, and hip strengthening are excellent starting points. Reassess in 4–6 weeks to track improvement.';
  } else {
    recommendation = 'Maintain your current activity level. Complement your healthy walking mechanics with resistance training and flexibility work for long-term mobility and joint health.';
  }

  return { headline, summary, findings, recommendation, color };
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

export default function WellnessDashboard({ videoSrc, onRecord, onUpload }: WellnessDashboardProps) {
  const { videoRef, canvasRef, isReady, isProcessing, kneeAngles, hipAngles, ankleAngles, strideMetrics, startAnalysis, getSessionData } = useGaitAnalyzer();
  const [isLoading, setIsLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState<SpeedOption>(1);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { onUpload?.(file); e.target.value = ''; }
  }

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
    const sync = () => { v.playbackRate = playbackRate; };
    v.addEventListener('canplay', sync);
    return () => v.removeEventListener('canplay', sync);
  }, [playbackRate, videoSrc, videoRef]);

  useEffect(() => {
    if (isProcessing) setAnalysisComplete(false);
  }, [isProcessing]);

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

  const strideRef = useRef(strideMetrics);
  strideRef.current = strideMetrics;

  const wasProcessingRef = useRef(false);
  useEffect(() => {
    const justFinished = wasProcessingRef.current && !isProcessing;
    wasProcessingRef.current = isProcessing;
    if (!justFinished || !videoRef.current?.ended) return;

    const { kneeAngles, hipAngles, ankleAngles } = getSessionData();
    if (!kneeAngles.left.length) return;

    const s = scoreFromAngles(kneeAngles);
    const now = new Date();
    const session: GaitSession = {
      id: `SES-${Date.now()}`,
      date: Date.now(),
      duration: Math.round(videoRef.current.duration),
      label: `Session ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      kneeAngles, hipAngles, ankleAngles,
      frameCount: kneeAngles.left.length,
      score: s,
      stride: strideRef.current,
    };
    saveSession(session).catch(console.error);
    setAnalysisComplete(true);
  }, [isProcessing, getSessionData]);

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

  const ageGroup = getAgeGroup();
  const norms = getNormsFromProfile();
  const ageLabel = ageGroup ? AGE_GROUP_LABELS[ageGroup] : null;
  const ageBenchmark = ageGroup ? BENCHMARKS[ageGroup] : null;

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
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-5">
                <p className="text-sm text-on-surface-variant opacity-60">No video loaded</p>
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

            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none drop-shadow-[0_0_15px_rgba(87,241,219,0.4)]" />

            {isProcessing && (
              <div className="absolute w-full h-0.5 bg-primary shadow-[0_0_20px_#57f1db] animate-scan z-20" />
            )}

            {/* Record / upload actions */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
              <button onClick={() => fileInputRef.current?.click()} title="Upload video" className="bg-surface/80 backdrop-blur-md border border-outline-variant/60 p-1.5 rounded-lg hover:border-primary/50 hover:text-primary text-on-surface-variant transition-all">
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button onClick={onRecord} title="Record new session" className="bg-surface/80 backdrop-blur-md border border-outline-variant/60 p-1.5 rounded-lg hover:border-primary/50 hover:text-primary text-on-surface-variant transition-all">
                <Video className="w-3.5 h-3.5" />
              </button>
            </div>

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
              {videoSrc && (
                <div className="ml-auto flex items-center gap-0.5">
                  {SPEED_OPTIONS.map(rate => (
                    <button
                      key={rate}
                      onClick={() => {
                        setPlaybackRate(rate);
                        if (videoRef.current) videoRef.current.playbackRate = rate;
                      }}
                      className={cn(
                        'px-2 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wide transition-all',
                        playbackRate === rate
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      )}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                {ageBenchmark && (
                  <p className="text-xs text-on-surface-variant/60 mt-1.5">
                    Typical for {ageLabel}: ≥{ageBenchmark.score}
                  </p>
                )}
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
            <p className="text-xs text-on-surface-variant/60 mt-2">
              {ageLabel
                ? `Norm (${ageLabel}): ${norms.cadence.mean} ± ${norms.cadence.sd} spm · ${norms.cadence.source}`
                : `Population norm: ${norms.cadence.mean} ± ${norms.cadence.sd} spm · ${norms.cadence.source}`}
            </p>
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

      {/* Diagnosis panel */}
      <AnimatePresence>
        {analysisComplete && hasData && (() => {
          const dx = generateDiagnosis(score, asymmetry, strideMetrics.cadence, risk.level);
          return (
            <motion.div
              key="diagnosis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mt-6 bg-surface-container rounded-2xl border border-outline-variant overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-outline-variant/50 flex items-start gap-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', risk.level === 'Elevated' ? 'bg-error/10' : risk.level === 'Moderate' ? 'bg-[#f59e0b]/10' : 'bg-primary/10')}>
                  {risk.level === 'Low' ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <AlertTriangle className={cn('w-5 h-5', risk.level === 'Elevated' ? 'text-error' : 'text-[#f59e0b]')} />}
                </div>
                <div>
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Analysis Complete — Diagnosis</p>
                  <h2 className={cn('text-xl font-display font-bold', dx.color)}>{dx.headline}</h2>
                  <p className="text-sm text-on-surface-variant mt-1 leading-relaxed max-w-2xl">{dx.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-outline-variant/50">
                {/* Findings */}
                <div className="px-6 py-5">
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-on-surface-variant/60 mb-3">Key Findings</p>
                  <ul className="space-y-3">
                    {dx.findings.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant leading-relaxed">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendation */}
                <div className="px-6 py-5">
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-on-surface-variant/60 mb-3">Recommendation</p>
                  <p className="text-sm text-on-surface leading-relaxed">{dx.recommendation}</p>
                  <p className="text-xs text-on-surface-variant/40 mt-4 italic">This analysis is for informational purposes only and does not constitute medical advice.</p>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
