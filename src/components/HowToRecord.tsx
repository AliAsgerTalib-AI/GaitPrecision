import { motion } from 'motion/react';
import {
  Sun,
  Smartphone,
  Move,
  Timer,
  CheckCircle2,
  XCircle,
  Camera,
  Eye,
  Footprints,
  AlertTriangle,
} from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Sun,
    title: 'Environment & Lighting',
    description: 'Choose a well-lit, open space with a plain or uncluttered background. Even indoor lighting works — avoid strong backlighting (e.g. standing in front of a window).',
    dos: ['Well-lit hallway or room', 'Plain wall or floor background', 'Outdoor path in daylight'],
    donts: ['Dark or dim lighting', 'Busy/patterned background', 'Backlit against windows'],
  },
  {
    number: '02',
    icon: Camera,
    title: 'Camera Angle — Side View',
    description: 'Film from the side (sagittal plane). The algorithm computes knee, hip, and ankle angles using geometry — a direct side view gives the most accurate readings. Front or rear views will degrade results.',
    dos: ['Directly to your left or right', 'Camera at hip-to-waist height', 'Phone held steady or propped up'],
    donts: ['Filming from the front or back', 'Angled diagonally', 'Camera held too high or low'],
  },
  {
    number: '03',
    icon: Eye,
    title: 'Framing — Full Lower Body',
    description: 'Keep your hips, knees, ankles, and feet fully visible at all times. The system tracks 6 key landmarks (both hips, knees, and ankles). If any are cut off, that frame is skipped.',
    dos: ['Hips to feet in frame at all times', 'Walk parallel to the camera', 'Leave space above hips and below feet'],
    donts: ['Cropping feet out of frame', 'Walking toward or away from camera', 'Getting too close to the camera'],
  },
  {
    number: '04',
    icon: Move,
    title: 'How to Walk',
    description: 'Walk naturally in a straight line at your normal pace. Do not alter your gait for the camera — the goal is to capture your real walking pattern, not a modified one.',
    dos: ['Normal, relaxed walking pace', 'Straight line parallel to camera', 'Arms at your sides naturally'],
    donts: ['Exaggerating your steps', 'Walking on tiptoe or heel', 'Stopping or changing speed'],
  },
  {
    number: '05',
    icon: Timer,
    title: 'Duration — 15 to 30 Seconds',
    description: 'Record at least 15–30 seconds of continuous walking. The stride detector needs 4 complete heel-strike cycles per leg for cadence and stance/swing percentages to stabilize. Longer clips give better averages.',
    dos: ['15–30 seconds minimum', 'Continuous, uninterrupted walking', 'Multiple passes back and forth is fine'],
    donts: ['Clips shorter than 10 seconds', 'Stopping mid-recording', 'Pausing or hesitating while walking'],
  },
  {
    number: '06',
    icon: Smartphone,
    title: 'Device & Setup',
    description: 'Have a second person film you, or prop your phone on a stable surface at hip height. The recorder uses the rear camera at 1080p/60fps for highest accuracy.',
    dos: ['Stable mount or second person filming', 'Rear camera (landscape orientation)', 'Phone at hip-to-waist height'],
    donts: ['Handheld shaky recording', 'Selfie/front camera', 'Phone tilted at an angle'],
  },
];

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
      className="bg-surface-container rounded-2xl border border-outline-variant overflow-hidden"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-5 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-mono text-[10px] text-primary uppercase tracking-[0.2em] mb-1">{step.number}</div>
            <h3 className="font-display text-lg font-bold text-on-surface">{step.title}</h3>
          </div>
        </div>

        <p className="text-on-surface-variant text-sm leading-relaxed mb-6">{step.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">Do</span>
            </div>
            <ul className="space-y-2">
              {step.dos.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-on-surface-variant">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-4 h-4 text-error" />
              <span className="font-mono text-[10px] text-error uppercase tracking-widest font-bold">Avoid</span>
            </div>
            <ul className="space-y-2">
              {step.donts.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-on-surface-variant">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-error flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function HowToRecord() {
  return (
    <div className="pt-20 sm:pt-24 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-primary/30 bg-primary/5 mb-4">
            <Footprints className="w-3 h-3 text-primary mr-2" />
            <span className="font-mono text-[10px] text-primary tracking-widest uppercase">Recording Guide</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-on-surface mb-3">
            How to Record for Best Results
          </h1>
          <p className="text-on-surface-variant max-w-2xl leading-relaxed">
            GaitPrecision uses MediaPipe pose detection to track 33 body landmarks in real time.
            Follow these steps to get the most accurate knee, hip, and ankle angle measurements from your recording.
          </p>
        </motion.div>

        {/* Quick summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/20 mb-10"
        >
          <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-xs font-bold text-primary uppercase tracking-widest mb-1">Quick Summary</p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Film from the <strong className="text-on-surface">side</strong>, keep your full lower body
              (<strong className="text-on-surface">hips to feet</strong>) in frame, walk
              <strong className="text-on-surface"> normally</strong> in good light for
              <strong className="text-on-surface"> 15–30 seconds</strong>.
            </p>
          </div>
        </motion.div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 text-center font-mono text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60"
        >
          All video data is processed locally on your device — nothing is uploaded.
        </motion.p>
      </div>
    </div>
  );
}
