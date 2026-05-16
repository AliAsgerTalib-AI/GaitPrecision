import { Play, SkipBack, SkipForward, Maximize2, Radio, Activity, Waves, Gauge, Plus, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AnalysisSettings from './AnalysisSettings';
import { useGaitAnalyzer } from '../hooks/useGaitAnalyzer';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

export default function Dashboard() {
  const { videoRef, canvasRef, isReady, isProcessing, kneeAngles, startAnalysis } = useGaitAnalyzer();
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulate initial loading sequence for hardware and engine
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Get current metrics from real data
  const currentLeftAngle = kneeAngles.left[kneeAngles.left.length - 1] || 142;
  const currentRightAngle = kneeAngles.right[kneeAngles.right.length - 1] || 138;
  const asymmetry = Math.abs(currentLeftAngle - currentRightAngle);

  // Handle canvas sizing to match video aspect ratio
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (videoRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = videoRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [videoRef, canvasRef]);

  if (isLoading) {
    return (
      <div className="pt-24 pb-12 px-6 max-w-[1440px] mx-auto min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="aspect-video bg-surface-container-low rounded-2xl border border-outline-variant animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-shimmer" />
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
              <div className="font-mono text-[10px] text-primary uppercase tracking-[0.3em] font-bold">Initializing_Neural_Engine</div>
            </div>
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant h-40 animate-pulse" />
          </div>
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant h-full animate-pulse space-y-6">
               <div className="h-8 bg-surface-container-high rounded-lg w-1/3" />
               <div className="h-32 bg-surface-container-low rounded-xl" />
               <div className="h-32 bg-surface-container-low rounded-xl" />
               <div className="h-32 bg-surface-container-low rounded-xl" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-6 max-w-[1440px] mx-auto min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Analysis Player */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div 
            ref={containerRef}
            className="relative aspect-video bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant group shadow-2xl"
          >
            {/* RAW VIDEO FEED (Hidden by low opacity during processing) */}
            <video 
              ref={videoRef}
              src="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-all duration-1000",
                isProcessing ? "opacity-30 grayscale contrast-125" : "opacity-10"
              )}
              muted
              playsInline
              loop
            />

            {/* HIGH-PRECISION SKELETAL OVERLAY */}
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full z-10 pointer-events-none drop-shadow-[0_0_15px_rgba(87,241,219,0.5)]" 
            />

            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="relative w-full h-full">
                {/* Scanner Interface Line */}
                {isProcessing && (
                  <div className="absolute w-full h-0.5 bg-primary shadow-[0_0_20px_#57f1db] animate-scan z-20" />
                )}
                
                {/* Top Overlay HUD */}
                <div className="absolute top-6 left-6 right-6 flex justify-between">
                  <div className="flex gap-3">
                    <div className="bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg font-mono text-[10px]">
                      <span className="text-primary mr-2 uppercase">Time:</span> 
                      <span className="text-on-surface tabular-nums">
                        {videoRef.current?.currentTime.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className={cn(
                      "px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all flex items-center gap-2",
                      isProcessing 
                        ? "bg-primary/10 border-primary/20 text-primary" 
                        : "bg-surface-container-high border-outline-variant text-on-surface-variant"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full bg-current", isProcessing && "animate-pulse")} />
                      {isProcessing ? 'POSE_LOCKED' : 'STANDBY'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-surface/40 backdrop-blur px-3 py-1.5 rounded-lg border border-outline-variant/30 font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                    Telemetry_Feed: <span className={cn(isProcessing ? "text-primary" : "text-on-surface-variant")}>Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Player Controls Interface */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface/80 to-transparent p-8 z-20">
              <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden mb-6 cursor-pointer group/progress">
                <motion.div 
                  className="h-full bg-primary shadow-[0_0_10px_#57f1db]" 
                  animate={{ width: `${(videoRef.current?.currentTime || 0) / (videoRef.current?.duration || 1) * 100}%` }}
                  transition={{ type: "tween", duration: 0.1 }}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <button className="text-on-surface hover:text-primary transition-colors"><SkipBack /></button>
                  <button 
                    onClick={startAnalysis}
                    disabled={!isReady || isProcessing}
                    className="w-16 h-16 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:shadow-none"
                  >
                    {!isReady || isProcessing ? (
                      <Activity className="w-6 h-6 animate-pulse" />
                    ) : (
                      <Play className="fill-current w-6 h-6 ml-1" />
                    )}
                  </button>
                  <button className="text-on-surface hover:text-primary transition-colors"><SkipForward /></button>
                  
                  <div className="flex flex-col ml-4">
                    <span className="font-mono text-xl text-on-surface font-bold tracking-tight leading-none tabular-nums">
                      {videoRef.current?.currentTime.toFixed(2) || '0.00'}
                    </span>
                    <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] mt-2 font-bold opacity-60">Engine Timeline</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant shadow-sm uppercase font-bold">
                    <Radio className={cn("w-3 h-3 transition-colors", isProcessing ? "text-primary" : "text-outline")} />
                    Mediapipe_v3.0
                  </div>
                  <button className="p-3 hover:bg-surface-variant rounded-xl transition-colors text-on-surface-variant"><Maximize2 className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Biomechanical Analysis Dashboard */}
          <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 font-mono text-[8px] text-outline-variant uppercase">Spatial_Map_v0.2</div>
            <div className="flex justify-between items-end mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-display font-bold text-on-surface mb-2">Stride Cycle Segmentation</h3>
                <p className="text-on-surface-variant text-sm max-w-md">Real-time temporal gait parameters including stance-swing ratios and limb synchronization.</p>
              </div>
              <div className="font-mono text-[10px] flex gap-6 font-bold tracking-widest">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_#57f1db]"></span> STANCE</span>
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary/20"></span> SWING</span>
              </div>
            </div>
            
            <div className="h-20 w-full flex items-center gap-1 rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-low p-1.5 shadow-inner">
              <div className="h-full bg-primary/40 border-r border-primary/20 w-1/4 flex items-center justify-center font-mono text-[10px] font-bold text-primary rounded-l-xl">STANCE 62%</div>
              <div className="h-full bg-primary/5 border-r border-primary/10 w-[15%] flex items-center justify-center font-mono text-[10px] font-bold opacity-60">SWING 38%</div>
              <div className="h-full bg-primary/40 border-r border-primary/20 w-1/3 flex items-center justify-center font-mono text-[10px] font-bold text-primary">STANCE 61%</div>
              <div className="h-full bg-primary/20 grow flex items-center justify-center font-mono text-[10px] font-bold italic opacity-60 rounded-r-xl">OPTIMIZING...</div>
            </div>
            
            <div className="grid grid-cols-5 mt-6 px-2 font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em] font-bold">
              {['Contact', 'Mid-Stance', 'Terminal', 'Initial Swing', 'Terminal Swing'].map((ph, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="w-1 h-1 bg-outline-variant rounded-full" />
                  {ph}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Live Metric Analytics */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant h-full shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-display font-bold text-on-surface tracking-tight leading-none">Live Analytics</h2>
              <Radio className={cn("w-6 h-6 text-primary", isProcessing && "animate-pulse")} />
            </div>

            <div className="flex flex-col gap-6">
              {/* ASYMMETRY CRITICAL WARNING */}
              <AnimatePresence>
                {asymmetry > 15 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="p-5 bg-error/10 border border-error/30 text-error rounded-2xl flex gap-4 shadow-lg shadow-error/5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-error/5 rounded-full -translate-y-12 translate-x-12" />
                    <AlertCircle className="w-6 h-6 shrink-0 mt-1" />
                    <div className="relative z-10">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Asymmetry Violation</p>
                      <p className="text-sm font-sans font-medium mt-2 leading-relaxed">
                        Knee flexion deviation exceeds the safe biological baseline of 15.0°.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* LEFT KNEE METRIC */}
              <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-surface-container-low border border-outline-variant rounded-2xl relative overflow-hidden group transition-all shadow-sm">
                <div className="absolute top-0 right-0 p-3">
                   <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <p className="font-mono text-[10px] text-on-surface-variant mb-2 uppercase tracking-widest flex items-center gap-2 font-bold">
                  <Waves className="w-3 h-3 text-primary" /> Left Knee Flexion
                </p>
                <div className="flex justify-between items-end">
                   <p className={cn(
                     "text-5xl font-display font-bold text-on-surface tabular-nums tracking-tighter",
                     isProcessing && "text-primary"
                   )}>
                     {currentLeftAngle.toFixed(1)}<span className="text-primary italic ml-1">°</span>
                   </p>
                   <div className="w-24 h-12 opacity-60">
                     <svg className="w-full h-full" viewBox="0 0 100 40">
                        <polyline
                          fill="none"
                          stroke="#57f1db"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={kneeAngles.left.map((a, i) => `${(i / Math.max(1, kneeAngles.left.length - 1)) * 100},${40 - (a / 180) * 40}`).join(' ')}
                        />
                     </svg>
                   </div>
                </div>
              </motion.div>

              {/* RIGHT KNEE METRIC */}
              <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-surface-container-low border border-outline-variant rounded-2xl relative group transition-all shadow-sm">
                <div className="absolute top-0 right-0 p-3">
                   <div className="w-2 h-2 rounded-full bg-outline-variant" />
                </div>
                <p className="font-mono text-[10px] text-on-surface-variant mb-2 uppercase tracking-widest flex items-center gap-2 font-bold">
                  <Waves className="w-3 h-3 text-on-surface-variant" /> Right Knee Flexion
                </p>
                <div className="flex justify-between items-end">
                   <p className="text-5xl font-display font-bold text-on-surface tabular-nums tracking-tighter">
                     {currentRightAngle.toFixed(1)}<span className="text-outline-variant italic ml-1">°</span>
                   </p>
                   <div className="w-24 h-12 opacity-30">
                     <svg className="w-full h-full" viewBox="0 0 100 40">
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={kneeAngles.right.map((a, i) => `${(i / Math.max(1, kneeAngles.right.length - 1)) * 100},${40 - (a / 180) * 40}`).join(' ')}
                        />
                     </svg>
                   </div>
                </div>
              </motion.div>

              {/* DYNAMIC BALANCE INDEX */}
              <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-surface-container-low border border-outline-variant rounded-2xl group transition-colors hover:border-primary/50 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Symmetry Index</p>
                  <div className={cn(
                    "px-2 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-widest",
                    asymmetry > 15 ? "bg-error/20 text-error" : "bg-primary/20 text-primary"
                  )}>
                    {asymmetry.toFixed(1)}° Δ
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-on-surface-variant font-bold">L</span>
                  <div className="flex-1 h-3 flex gap-1 items-center justify-center relative bg-surface-container rounded-full shadow-inner p-0.5">
                    <div className="absolute h-full w-px bg-outline-variant/30 left-1/2 -translate-x-1/2 z-10" />
                    <div 
                      className={cn(
                        "absolute h-5 w-1.5 rounded-full z-20 transition-all duration-300 shadow-lg",
                        asymmetry > 15 ? "bg-error shadow-error/40" : "bg-primary shadow-primary/40"
                      )}
                      style={{ left: `${Math.min(95, Math.max(5, 50 + (currentRightAngle - currentLeftAngle) * 2))}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-on-surface-variant font-bold">R</span>
                </div>
                <p className="text-[10px] text-on-surface-variant font-mono uppercase mt-4 text-center opacity-40">Kinematic Differential</p>
              </motion.div>
            </div>

            <button className="w-full mt-8 py-5 bg-surface-container-low border border-outline-variant border-dashed rounded-2xl text-on-surface-variant font-mono text-[10px] font-bold tracking-[0.2em] hover:bg-surface-variant hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-3 group relative overflow-hidden">
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform relative z-10" />
              ADD_ANALYTICS_WIDGET
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </aside>

        {/* Configuration Hardware Section */}
        <div className="lg:col-span-12">
          <AnalysisSettings />
        </div>
      </div>
    </div>
  );
}
