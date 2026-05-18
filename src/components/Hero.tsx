import { useRef, useState } from "react";
import {
  Upload,
  Zap,
  ShieldAlert,
  Cpu,
  DatabaseZap,
  PersonStanding,
  Dumbbell,
  Weight,
  Activity,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { ActivityType } from "./Recorder";

interface HeroProps {
  onStartAnalysis: (type: ActivityType) => void;
  onUploadComplete: (file: File, type: ActivityType) => void;
  onHome: () => void;
}

const MODES: {
  type: ActivityType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}[] = [
  {
    type: "gait",
    icon: Cpu,
    label: "Gait Walk",
    desc: "Knee flexion, cadence & symmetry index",
  },
  {
    type: "stair",
    icon: PersonStanding,
    label: "Stair Climb",
    desc: "Step count, cadence & leg asymmetry",
  },
  {
    type: "squat",
    icon: Dumbbell,
    label: "Squat",
    desc: "Depth, rep count & knee valgus",
  },
  {
    type: "lift",
    icon: Weight,
    label: "Weight Lifting",
    desc: "Deadlift & overhead press form",
  },
  {
    type: "balance",
    icon: Activity,
    label: "Balance",
    desc: "Sway analysis & stability score",
  },
  {
    type: "exercise",
    icon: Zap,
    label: "Exercises",
    desc: "Lunges, hip hinges & form check",
  },
];

export default function Hero({
  onStartAnalysis,
  onUploadComplete,
  onHome,
}: HeroProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) setPendingFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPendingFile(file); e.target.value = ''; }
  };

  const handleModeSelect = (type: ActivityType) => {
    if (pendingFile) { onUploadComplete(pendingFile, type); setPendingFile(null); }
  };

  return (
    <div className="pt-20 sm:pt-24 min-h-screen">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className=" font-extrabold font-serif:text-xl text-on-surface-variant max-w-2xl mb-3  tracking-wide"
        >
          GaitPrecision
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-sans text-sm sm:text-base text-on-surface-variant/60 max-w-2xl mb-10 sm:mb-14 tracking-tight"
        >
          Real-time Biomechanical Assessment
        </motion.p>

        {/* Activity Mode Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-4xl mb-10"
        >
          <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.25em] font-bold mb-5 opacity-60">
            Choose Analysis Mode
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {MODES.map(({ type, icon: Icon, label, desc }, i) => (
              <motion.button
                key={type}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + i * 0.05 }}
                onClick={() => onStartAnalysis(type)}
                className="group flex flex-col items-center gap-3 p-4 bg-surface-container border border-outline-variant rounded-2xl hover:border-primary/50 hover:bg-surface-container-high transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/15 transition-all">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="w-full">
                  <p className="font-mono text-[10px] font-bold text-on-surface uppercase tracking-wider leading-none mb-1">
                    {label}
                  </p>
                  <p className="font-mono text-[8px] text-on-surface-variant opacity-60 leading-snug">
                    {desc}
                  </p>
                </div>
                <div className="flex items-center gap-1 mt-auto pt-1 font-mono text-[8px] text-primary font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  <Video className="w-3 h-3" /> Record
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Upload Existing Video */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-3xl"
        >
          <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.25em] font-bold mb-5 opacity-60">
            Or Upload Existing Video
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center py-10 cursor-pointer transition-all group relative overflow-hidden dotted-pattern",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-outline-variant bg-surface-container-low hover:border-primary/40",
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col items-center relative z-10 gap-3">
              <div className="w-14 h-14 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center group-hover:scale-110 group-hover:border-primary/40 transition-all shadow-lg">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-display text-base font-semibold text-on-surface group-hover:text-primary transition-colors">
                  <span className="sm:hidden">Tap to choose video</span>
                  <span className="hidden sm:inline">
                    Drop video here or click to browse
                  </span>
                </p>
                <p className="font-mono text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest opacity-60">
                  Supports .MP4 .MOV .AVI — Max 500 MB
                </p>
              </div>
            </div>
            {isDragging && (
              <div className="absolute inset-0 z-20 bg-primary/10 flex items-center justify-center backdrop-blur-[2px]">
                <div className="font-display text-3xl font-bold text-primary animate-pulse">
                  Release to Upload
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Analysis mode picker modal — shown after a video is selected for upload */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl bg-surface-container border border-outline-variant rounded-2xl p-8 shadow-2xl"
          >
            <div className="mb-6">
              <h2 className="text-xl font-display font-bold text-on-surface mb-1">Choose Analysis Mode</h2>
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60">
                Select the type of analysis to run on <span className="text-primary">{pendingFile.name}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {MODES.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => handleModeSelect(type)}
                  className="group flex flex-col items-center gap-3 p-4 bg-surface-container-low border border-outline-variant rounded-2xl hover:border-primary/50 hover:bg-surface-container-high transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/15 transition-all">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="w-full">
                    <p className="font-mono text-[10px] font-bold text-on-surface uppercase tracking-wider leading-none mb-1">{label}</p>
                    <p className="font-mono text-[8px] text-on-surface-variant opacity-60 leading-snug">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingFile(null)}
              className="w-full py-2.5 border border-outline-variant rounded-xl font-mono text-xs text-on-surface-variant hover:border-primary/50 hover:text-primary transition-all"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
