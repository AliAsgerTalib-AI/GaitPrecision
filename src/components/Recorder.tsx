import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Video, VideoOff, Square, RefreshCcw, CheckCircle2, ShieldCheck, Cpu, AlertCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface RecorderProps {
  onComplete: (videoBlob: Blob) => void;
  onCancel: () => void;
}

export default function Recorder({ onComplete, onCancel }: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordedData, setHasRecordedData] = useState(false);
  const [error, setError] = useState<{ title: string; message: string; type: 'permission' | 'device' | 'hardware' | 'unknown' } | null>(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<number | null>(null);

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
    onComplete(finalBlob);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-surface flex flex-col">
      {/* Top Header */}
      <div className="h-20 bg-surface-container/80 backdrop-blur-md border-b border-outline-variant flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-on-surface leading-tight">Live Capture Engine</h2>
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">Session_ID: GP-CAPT-2026</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg">
            <Cpu className="w-3 h-3 text-primary" />
            <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">WASM_ACCEL_ON</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high border border-outline-variant rounded-lg">
            <ShieldCheck className="w-3 h-3 text-secondary" />
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Encrypted Stream</span>
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
            
            {/* HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none p-12 flex flex-col justify-between">
              {/* Corner Accents */}
              <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-primary/40 rounded-tl-xl" />
              <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-primary/40 rounded-tr-xl" />
              <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-primary/40 rounded-bl-xl" />
              <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-primary/40 rounded-br-xl" />

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

                <div className="text-right space-y-1">
                  <div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Telemetry_Feeds</div>
                  <div className="flex flex-col gap-1 items-end">
                    <div className="w-32 h-1 bg-surface-container rounded-full overflow-hidden">
                       <motion.div 
                        animate={{ width: isRecording ? '85%' : '40%' }} 
                        className="h-full bg-primary" 
                       />
                    </div>
                    <div className="w-24 h-1 bg-surface-container rounded-full overflow-hidden">
                       <motion.div 
                        animate={{ width: isRecording ? '62%' : '20%' }} 
                        className="h-full bg-secondary" 
                       />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center items-center gap-12">
                <div className="text-center group">
                  <div className="font-mono text-[9px] text-on-surface-variant uppercase mb-2 tracking-[0.3em]">Pose_Lock</div>
                  <div className="w-10 h-10 border border-primary/20 rounded-full flex items-center justify-center animate-dash">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                  </div>
                </div>
                <div className="text-center opacity-40">
                  <div className="font-mono text-[9px] text-on-surface-variant uppercase mb-2 tracking-[0.3em]">Ang_Res</div>
                  <div className="font-mono text-xs text-on-surface font-bold italic">0.05°</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-32 bg-surface-container-low border-t border-outline-variant px-8 flex items-center justify-center gap-8 relative">
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
        
        {isRecording && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-3">
             <div className="flex flex-col items-end">
               <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold">Buffer Status</span>
               <span className="font-mono text-xs text-primary font-bold">LIVE_OPTIMAL</span>
             </div>
             <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-primary" />
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
