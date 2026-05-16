import { useRef } from 'react';
import { Video, Upload, ShieldCheck, Heart, TrendingUp, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface WellnessHomeProps {
  onStartRecording: () => void;
  onUploadComplete: (file: File) => void;
  onHowToRecord: () => void;
}

const benefits = [
  {
    icon: Heart,
    title: 'Understand Your Balance',
    description: 'See how evenly you share weight between your left and right leg while walking.',
  },
  {
    icon: TrendingUp,
    title: 'Track Your Progress',
    description: 'Compare sessions over time and celebrate improvements in your walking health.',
  },
  {
    icon: ShieldCheck,
    title: 'Private & Secure',
    description: 'Your video never leaves your device. All analysis happens right here, locally.',
  },
];

export default function WellnessHome({ onStartRecording, onUploadComplete, onHowToRecord }: WellnessHomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadComplete(file);
  };

  return (
    <div className="pt-20 sm:pt-24 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <Heart className="w-9 h-9 text-primary" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-on-surface mb-4 leading-tight">
            Check Your Walking Health
          </h1>
          <p className="text-lg text-on-surface-variant leading-relaxed max-w-xl mx-auto">
            Record a short walk and get a clear, easy-to-understand report about your balance, stride, and fall risk — in seconds.
          </p>
        </motion.div>

        {/* Action Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
        >
          {/* Record */}
          <button
            onClick={onStartRecording}
            className="group flex flex-col items-center gap-5 p-8 bg-primary text-on-primary rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-primary/20"
          >
            <div className="w-16 h-16 rounded-full bg-on-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Video className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-xl font-display font-bold mb-1">Record a Walk</p>
              <p className="text-sm opacity-80 leading-snug">Use your camera to record yourself walking for 15–30 seconds</p>
            </div>
          </button>

          {/* Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="group flex flex-col items-center gap-5 p-8 bg-surface-container border-2 border-outline-variant rounded-2xl hover:border-primary/50 hover:bg-surface-container-high active:scale-95 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-xl font-display font-bold text-on-surface mb-1">Upload a Video</p>
              <p className="text-sm text-on-surface-variant leading-snug">Already have a video? Upload it here to get your results</p>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
        </motion.div>

        {/* How to record tip */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={onHowToRecord}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary transition-colors mb-12"
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-sm font-medium">Not sure how to record? See our step-by-step guide</span>
        </motion.button>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <h2 className="text-center text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-6">What you'll learn</h2>
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.07 }}
                className="flex items-start gap-5 p-5 bg-surface-container rounded-2xl border border-outline-variant"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-on-surface mb-1">{b.title}</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{b.description}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
