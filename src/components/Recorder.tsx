import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Video, Square, RefreshCcw, CheckCircle2, ShieldCheck, Cpu, AlertCircle, Circle, PersonStanding, Dumbbell, Weight, Zap, Info, Camera, Move, Timer, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useCameraSetup, type SetupChecks } from '@/src/hooks/useCameraSetup';

export type ActivityType = 'gait' | 'stair' | 'squat' | 'lift' | 'balance' | 'exercise';

interface RecorderProps {
  initialType?: ActivityType;
  onComplete: (videoBlob: Blob, type: ActivityType) => void;
  onCancel: () => void;
}

export default function Recorder({ initialType = 'gait', onComplete, onCancel }: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>(initialType);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [setupDone, setSetupDone] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordedData, setHasRecordedData] = useState(false);
  const [error, setError] = useState<{ title: string; message: string; type: 'permission' | 'device' | 'hardware' | 'unknown' } | null>(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [showTips, setShowTips] = useState(false);

  // Camera setup validation only runs for gait/stair modes (side-on view). Balance uses a frontal view.
  const { isReady: setupReady, checks, allPassed } = useCameraSetup(videoRef, !!stream && !setupDone && activityType !== 'balance' && activityType !== 'exercise');

  const setupCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 }
        },
        audio: false
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError({
          title: 'Permission Denied',
          message: 'Camera access was blocked. Please enable camera permissions in your browser settings to continue.',
          type: 'permission'
        });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError({
          title: 'Hardware Not Found',
          message: 'No compatible camera device was detected on this system. Please connect a camera and try again.',
          type: 'device'
        });
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError({
          title: 'Direct Hardware Access Failed',
          message: 'The camera is currently being used by another application or process. Please close other apps and retry.',
          type: 'hardware'
        });
      } else {
        setError({
          title: 'Initialization Failed',
          message: 'An unexpected system error occurred while starting the Capture Engine.',
          type: 'unknown'
        });
      }
    }
  };

  useEffect(() => {
    setupCamera();

    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];
    setHasRecordedData(false);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      setHasRecordedData(chunksRef.current.length > 0);
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);

    setDuration(0);
    timerRef.current = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    }
  };

  const finalizeRecording = () => {
    const finalBlob = new Blob(chunksRef.current, { type: 'video/webm' });
    onComplete(finalBlob, activityType);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-surface flex flex-col">
      {/* Top Header */}
      <div className="bg-surface-container/80 backdrop-blur-md border-b border-outline-variant flex items-center justify-between px-4 sm:px-8 h-16 sm:h-20" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-on-surface leading-tight">Live Capture Engine</h2>
            </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Activity type toggle */}
          <div className="flex rounded-lg border border-outline-variant overflow-hidden">
            {(
              [
                { type: 'gait',    icon: <Cpu className="w-3 h-3" />,                      label: 'Gait',    setup: false },
                { type: 'stair',   icon: <PersonStanding className="w-3 h-3" />,           label: 'Stairs',  setup: false },
                { type: 'squat',   icon: <Dumbbell className="w-3 h-3" />,                 label: 'Squat',   setup: false },
                { type: 'lift',    icon: <Weight className="w-3 h-3" />,                   label: 'Lifting', setup: false },
                { type: 'balance',  icon: <PersonStanding className="w-3 h-3 rotate-12" />, label: 'Balance',   setup: true  },
                { type: 'exercise', icon: <Zap className="w-3 h-3" />,                      label: 'Exercises', setup: false },
              ] as { type: ActivityType; icon: React.ReactNode; label: string; setup: boolean }[]
            ).map(({ type, icon, label, setup }, i, arr) => (
              <button
                key={type}
                onClick={() => { setActivityType(type); setSetupDone(setup); }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-all',
                  i > 0 && i < arr.length && 'border-l border-outline-variant',
                  activityType === type
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
                )}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-surface-container-high border border-outline-variant rounded-lg">
            <ShieldCheck className="w-3 h-3 text-secondary" />
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">On-Device</span>
          </div>
        </div>

        <button 
          onClick={onCancel}
          className="px-4 py-2 bg-surface-container-highest/50 border border-outline-variant rounded-lg font-mono text-[10px] text-on-surface hover:bg-surface-container-highest transition-colors uppercase tracking-widest font-bold"
        >
          Cancel_Abort
        </button>
      </div>

      {/* Main Viewfinder */}
      <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center p-8 max-w-md bg-surface-container-low rounded-3xl border border-outline-variant shadow-2xl">
            <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-error" />
            </div>
            <h3 className="text-3xl font-display font-bold text-on-surface mb-3">{error.title}</h3>
            <p className="text-on-surface-variant mb-8 leading-relaxed">{error.message}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setupCamera()}
                className="bg-primary text-on-primary px-8 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Retry_Initialization
              </button>
              <button 
                onClick={onCancel}
                className="bg-surface-container-high text-on-surface px-8 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:bg-surface-container-highest transition-all"
              >
                System_Exit
              </button>
            </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn(
                "w-full h-full object-cover transition-opacity duration-700",
                stream ? "opacity-40" : "opacity-0"
              )}
            />
            
            {/* ── Camera setup guide overlays ─────────────────────────────── */}
            <AnimatePresence>
              {!setupDone && stream && activityType !== 'balance' && activityType !== 'exercise' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none z-20"
                >
                  {/* Corridor — vertical zone */}
                  <div className="absolute inset-y-0 border-l border-r border-primary/20" style={{ left: '25%', right: '25%' }}>
                    <span className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/50 uppercase tracking-widest whitespace-nowrap">
                      {activityType === 'stair' ? 'climb stairs here' : activityType === 'squat' ? 'stand and squat here' : activityType === 'lift' ? 'perform lift here' : 'walk through here'}
                    </span>
                  </div>
                  <div className="absolute left-0 right-0 border-t border-dashed border-primary/20" style={{ top: '10%' }}>
                    <span className="absolute right-3 top-1 font-mono text-[8px] text-primary/40 uppercase tracking-widest">head clearance</span>
                  </div>
                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-primary/70" style={{ top: '52%' }}>
                    <span className="absolute left-3 -top-5 font-mono text-[9px] text-primary font-bold uppercase tracking-widest bg-surface/60 px-2 py-0.5 rounded">
                      ← align hips here
                    </span>
                    <span className="absolute right-3 -top-5 font-mono text-[9px] text-primary/60 uppercase tracking-widest bg-surface/60 px-2 py-0.5 rounded">
                      ~3 m / 10 ft
                    </span>
                  </div>
                  <div className="absolute left-0 right-0 border-t border-dashed border-primary/20" style={{ top: '90%' }}>
                    <span className="absolute right-3 top-1 font-mono text-[8px] text-primary/40 uppercase tracking-widest">foot clearance</span>
                  </div>
                </motion.div>
              )}

              {/* Balance / Exercise mode — frontal view guide */}
              {stream && (activityType === 'balance' || activityType === 'exercise') && !isRecording && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none z-20"
                >
                  {/* Center column — stand here */}
                  <div className="absolute inset-y-0 border-l border-r border-primary/30" style={{ left: '35%', right: '35%' }}>
                    <span className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/60 uppercase tracking-widest whitespace-nowrap">stand here</span>
                  </div>
                  {/* Head clearance */}
                  <div className="absolute left-0 right-0 border-t border-dashed border-primary/20" style={{ top: '8%' }}>
                    <span className="absolute right-3 top-1 font-mono text-[8px] text-primary/40 uppercase tracking-widest">head</span>
                  </div>
                  {/* Hip line */}
                  <div className="absolute left-0 right-0 border-t border-dashed border-primary/40" style={{ top: '50%' }}>
                    <span className="absolute left-3 top-1 font-mono text-[8px] text-primary/50 uppercase tracking-widest">hip midpoint</span>
                  </div>
                  {/* Feet line */}
                  <div className="absolute left-0 right-0 border-t border-dashed border-primary/20" style={{ top: '92%' }}>
                    <span className="absolute right-3 top-1 font-mono text-[8px] text-primary/40 uppercase tracking-widest">feet</span>
                  </div>
                  {/* Instruction badge */}
                  <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-surface/80 backdrop-blur-sm border border-primary/30 rounded-xl px-4 py-2 whitespace-nowrap">
                    <p className="font-mono text-[9px] text-primary uppercase tracking-widest font-bold">
                      {activityType === 'exercise' ? 'Face camera · Full body · ~2 m away' : 'Face camera · Full body in frame · ~2 m away'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none p-4 sm:p-12 flex flex-col justify-between">
              {/* Corner Accents */}
              <div className="absolute top-4 left-4 sm:top-8 sm:left-8 w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-l-2 border-primary/40 rounded-tl-xl" />
              <div className="absolute top-4 right-4 sm:top-8 sm:right-8 w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-r-2 border-primary/40 rounded-tr-xl" />
              <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-l-2 border-primary/40 rounded-bl-xl" />
              <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-r-2 border-primary/40 rounded-br-xl" />

              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]",
                      isRecording ? "text-error animate-pulse bg-error" : "text-primary bg-primary"
                    )} />
                    <span className="font-mono text-xs text-on-surface uppercase tracking-[0.2em] font-bold">
                      {isRecording ? "REC_ACTIVE" : "STANDBY"}
                    </span>
                  </div>
                  <div className="font-mono text-4xl font-bold text-on-surface tabular-nums">
                    {formatTime(duration)}
                  </div>
                </div>

              </div>

            </div>
          </>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-surface-container-low border-t border-outline-variant px-4 sm:px-8 relative" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <AnimatePresence mode="wait">

          {/* ── Setup checklist ────────────────────────────────────────────── */}
          {!setupDone && stream && activityType !== 'balance' && activityType !== 'exercise' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="py-5 space-y-4"
            >
              {/* Compact tip bar */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-outline-variant">
                <div className="flex items-center gap-3">
                  {[
                    { icon: Camera, label: 'Side view' },
                    { icon: Move, label: 'Full body' },
                    { icon: Timer, label: '15–30 s' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1 font-mono text-[9px] text-on-surface-variant/70">
                      <Icon className="w-3 h-3 text-primary/70 flex-shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowTips(s => !s)}
                  className="flex items-center gap-1 font-mono text-[9px] text-primary/60 hover:text-primary transition-colors"
                  aria-label="Toggle recording tips"
                >
                  <Info className="w-3.5 h-3.5" />
                  Tips
                  <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', showTips && 'rotate-180')} />
                </button>
              </div>

              {/* Expanded tips */}
              <AnimatePresence>
                {showTips && (
                  <motion.div
                    key="tips"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { icon: Camera, title: 'Side view', detail: 'Camera at hip height, perpendicular to your path' },
                        { icon: Move,   title: 'Full body', detail: 'Hips to feet visible in frame at all times' },
                        { icon: Timer,  title: '15–30 s',   detail: 'Needs 4+ heel-strike cycles per leg' },
                      ].map(({ icon: Icon, title, detail }) => (
                        <div key={title} className="bg-surface-container rounded-xl p-2.5 border border-outline-variant">
                          <Icon className="w-3.5 h-3.5 text-primary mb-1.5" />
                          <p className="font-mono text-[9px] font-bold text-on-surface uppercase tracking-widest mb-0.5">{title}</p>
                          <p className="font-mono text-[8px] text-on-surface-variant/70 leading-tight">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                  {setupReady ? 'Camera Setup Validation' : 'Loading detection engine…'}
                </p>
                <span className={cn(
                  'font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded',
                  allPassed ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
                )}>
                  {Object.values(checks).filter(Boolean).length}/4 passed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: 'legsVisible',   label: 'Full leg visible',  detail: 'Both legs must be in frame' },
                    { key: 'cameraLevel',   label: 'Camera level',      detail: 'No lateral tilt' },
                    { key: 'cameraHeight',  label: 'Camera height',     detail: 'Align lens with subject\'s hips' },
                    { key: 'distance',      label: 'Subject distance',  detail: '~3 m / 10 ft from camera' },
                  ] as { key: keyof SetupChecks; label: string; detail: string }[]
                ).map(({ key, label, detail }) => {
                  const passed = checks[key];
                  return (
                    <div key={key} className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all',
                      passed
                        ? 'bg-primary/8 border-primary/25 text-primary'
                        : 'bg-surface-container border-outline-variant text-on-surface-variant'
                    )}>
                      {passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        : <Circle className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-30" />
                      }
                      <div>
                        <p className="font-mono text-[9px] font-bold uppercase tracking-widest leading-none">{label}</p>
                        <p className="font-mono text-[8px] opacity-60 mt-0.5">{detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setSetupDone(true)}
                disabled={!allPassed}
                className={cn(
                  'w-full py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest transition-all',
                  allPassed
                    ? 'bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/20'
                    : 'bg-surface-container border border-outline-variant text-on-surface-variant opacity-50 cursor-not-allowed'
                )}
              >
                {allPassed ? 'Setup Confirmed — Start Recording' : 'Adjust camera to continue'}
              </button>

              <button
                onClick={() => setSetupDone(true)}
                className="w-full text-center font-mono text-[9px] text-on-surface-variant uppercase tracking-widest opacity-40 hover:opacity-70 transition-opacity pb-1"
              >
                Skip setup (data quality may be reduced)
              </button>
            </motion.div>
          )}

          {/* ── Recording controls (existing) ────────────────────────────── */}
          {(setupDone || !stream) && (
        <div className="flex items-center justify-center gap-8 min-h-[8rem]">
        <AnimatePresence mode="wait">
          {!isRecording && !hasRecordedData ? (
            <motion.button
              key="start"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={startRecording}
              className="w-20 h-20 bg-error/10 border-4 border-error rounded-full flex items-center justify-center group hover:bg-error/20 transition-all shadow-lg shadow-error/10"
            >
              <div className="w-14 h-14 bg-error rounded-full group-hover:scale-110 child-transition" />
            </motion.button>
          ) : isRecording ? (
            <motion.button
              key="stop"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={stopRecording}
              className="w-20 h-20 bg-surface-container border-4 border-outline rounded-full flex items-center justify-center group hover:border-on-surface transition-all"
            >
              <Square className="w-8 h-8 text-on-surface fill-current" />
            </motion.button>
          ) : (
            <motion.div 
              key="actions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-6"
            >
              <button
                onClick={() => {
                  chunksRef.current = [];
                  setHasRecordedData(false);
                  setDuration(0);
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 bg-surface-container-high border border-outline-variant rounded-xl flex items-center justify-center group-hover:border-primary/50 transition-colors">
                  <RefreshCcw className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
                </div>
                <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold">Retake</span>
              </button>
              
              <button 
                onClick={finalizeRecording}
                className="bg-primary text-on-primary px-10 py-5 rounded-2xl flex items-center gap-4 font-display text-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
              >
                <CheckCircle2 className="w-6 h-6" />
                Analyze Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        </div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
