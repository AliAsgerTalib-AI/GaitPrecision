import { useRef, useState } from 'react';
import { Upload, Video, Activity, ScrollText, Zap, ShieldAlert, Cpu, DatabaseZap } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface HeroProps {
  onStartAnalysis: () => void;
  onUploadComplete: (file: File) => void;
}

export default function Hero({ onStartAnalysis, onUploadComplete }: HeroProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onUploadComplete(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadComplete(file);
    }
  };

  return (
    <div className="pt-20 sm:pt-24 min-h-screen">
      {/* Hero Content */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 inline-flex items-center px-4 py-1 rounded-full border border-primary/30 bg-primary/5 shadow-inner"
        >
          <span className="font-mono text-[10px] text-primary tracking-widest">V2.4.0 WASM ENGINE ACTIVE</span>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-4xl sm:text-5xl md:text-6xl text-on-surface max-w-4xl mb-4 sm:mb-6 leading-[1.1] tracking-tight"
        >
          Clinical Gait Analysis. <span className="text-primary italic">100% On-Device.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-sans text-base sm:text-xl text-on-surface-variant max-w-2xl mb-8 sm:mb-12"
        >
          Secure, real-time biomechanical assessment powered by MediaPipe and WebAssembly. No biometric data ever leaves your hardware.
        </motion.p>

        {/* Dropzone Area */}
        <div className="w-full max-w-3xl aspect-video relative">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            onClick={(e) => {
              // Only trigger onStartAnalysis if we didn't click a child button specifically for file upload
              onStartAnalysis();
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden dotted-pattern shadow-2xl",
              isDragging ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-low hover:border-primary/50"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex flex-col items-center relative z-10 p-8">
              <div className="w-20 h-20 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-primary/40 transition-all shadow-lg">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-semibold mb-2 group-hover:text-primary transition-colors">
                <span className="sm:hidden">Tap to Record</span>
                <span className="hidden sm:inline">Record or Drop Video</span>
              </h3>
              <p className="font-mono text-xs text-on-surface-variant mb-6 uppercase tracking-widest">Supports .MP4, .MOV, .AVI (Max 500MB)</p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-6 py-2 bg-surface-container-highest border border-outline-variant rounded-lg font-mono text-[10px] text-on-surface hover:text-primary hover:border-primary/50 transition-all uppercase tracking-widest font-bold"
              >
                <span className="sm:hidden">Choose from Gallery</span>
                <span className="hidden sm:inline">Choose Local File</span>
              </button>
            </div>

            {isDragging && (
              <div className="absolute inset-0 z-20 bg-primary/10 flex items-center justify-center backdrop-blur-[2px]">
                <div className="font-display text-4xl font-bold text-primary animate-pulse">Release to Upload</div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Privacy Indicators */}
      <section className="bg-surface-container-lowest py-10 border-y border-outline-variant mt-10">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-wrap justify-center gap-x-16 gap-y-6">
          {[
            { icon: ShieldAlert, text: 'Privacy-First' },
            { icon: Cpu, text: 'Local Processing' },
            { icon: Zap, text: 'Zero Latency' },
            { icon: DatabaseZap, text: 'No Cloud Storage' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              <item.icon className="w-5 h-5 text-primary" />
              <span className="font-mono text-[10px] text-on-surface tracking-widest uppercase font-bold">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Technology Teaser */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <div className="mb-12">
          <h2 className="text-3xl font-display font-bold mb-2">Precision Engine Assets</h2>
          <div className="h-1 w-20 bg-primary rounded-full shadow-[0_0_10px_#57f1db]" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Video, title: 'Pose Detection', desc: 'MediaPipe tracking 33 skeletal keypoints with sub-millimeter precision directly in-browser.' },
            { icon: Activity, title: 'Real-time Analysis', desc: 'High-performance WebAssembly modules execute biomechanical math at native speeds.' },
            { icon: ScrollText, title: 'Detailed Reports', desc: 'Instantly generate clinical-grade PDF and CSV exports including stride length and cadence.' },
          ].map((item, idx) => (
            <motion.div 
              key={idx} 
              whileHover={{ y: -5 }}
              className="p-8 bg-surface-container-low border border-outline-variant rounded-2xl hover:border-primary/40 transition-colors group"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-surface-container-high rounded-xl mb-6 border border-outline-variant group-hover:border-primary/20">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h4 className="text-xl font-display font-bold mb-3">{item.title}</h4>
              <p className="text-on-surface-variant leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
