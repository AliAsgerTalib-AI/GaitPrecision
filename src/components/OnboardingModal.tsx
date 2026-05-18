import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const STORAGE_KEY = 'gp_onboarded_v1';

const slides = [
  {
    title: 'Analyze your movement with AI',
    description:
      'GaitPrecision uses pose detection to measure knee, hip, and ankle angles in real time — processed entirely on your device. Nothing is uploaded.',
    visual: WelcomeSVG,
  },
  {
    title: 'Film from the side',
    description:
      'Position the camera at hip height, directly to your left or right. Front or rear views cannot compute accurate joint angles.',
    visual: SideViewSVG,
  },
  {
    title: 'Keep your full body in frame',
    description:
      'Your hips, knees, ankles, and feet must stay visible at all times. If any of the 6 tracked landmarks are cut off, that frame is skipped.',
    visual: FramingSVG,
  },
  {
    title: 'Walk naturally for 15–30 seconds',
    description:
      'The stride detector needs 4+ complete heel-strike cycles per leg to calculate cadence, stance time, and swing time accurately.',
    visual: DurationSVG,
  },
];

function WelcomeSVG() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      <path
        d="M20,80 Q40,50 60,80 Q80,110 100,60 Q120,10 140,80 Q160,150 180,60 Q200,10 220,80 Q240,130 260,80"
        stroke="#57f1db" strokeWidth="2.5" strokeOpacity="0.85" strokeLinecap="round"
      />
      <path
        d="M20,80 Q40,50 60,80 Q80,110 100,60 Q120,10 140,80 Q160,150 180,60 Q200,10 220,80 Q240,130 260,80 L260,150 L20,150 Z"
        fill="#57f1db" fillOpacity="0.04"
      />
      {[100, 140, 180].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={[60, 80, 60][i]} r="5" fill="#57f1db" fillOpacity="0.85" />
          <line x1={x} y1={[60, 80, 60][i]} x2={x} y2="138" stroke="#57f1db" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 2" />
          <text x={x} y="150" textAnchor="middle" fill="#57f1db" fontSize="7" fontFamily="monospace" fillOpacity="0.55">
            {['KNEE', 'HIP', 'ANKLE'][i]}
          </text>
        </g>
      ))}
      <line x1="210" y1="18" x2="210" y2="145" stroke="#57f1db" strokeWidth="1" strokeOpacity="0.35" />
      <rect x="205" y="18" width="10" height="127" fill="#57f1db" fillOpacity="0.03" />
    </svg>
  );
}

function SideViewSVG() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      <line x1="60" y1="148" x2="230" y2="148" stroke="#57f1db" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4 3" />
      {/* Walking figure */}
      <circle cx="165" cy="46" r="13" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.85" />
      <line x1="165" y1="59" x2="165" y2="102" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.85" />
      <line x1="165" y1="75" x2="151" y2="93" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="165" y1="75" x2="179" y2="89" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="165" y1="102" x2="152" y2="128" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.85" />
      <line x1="152" y1="128" x2="144" y2="148" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.85" />
      <line x1="165" y1="102" x2="177" y2="122" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.85" />
      <line x1="177" y1="122" x2="184" y2="143" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.85" />
      {/* Camera */}
      <rect x="28" y="86" width="36" height="24" rx="5" fill="#57f1db" fillOpacity="0.12" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="46" cy="98" r="7" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.7" />
      <rect x="58" y="93" width="6" height="5" rx="1" fill="#57f1db" fillOpacity="0.5" />
      {/* Arrow */}
      <line x1="64" y1="98" x2="147" y2="98" stroke="#57f1db" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="3 2" />
      <polygon points="147,94 155,98 147,102" fill="#57f1db" fillOpacity="0.4" />
      {/* Labels */}
      <text x="46" y="125" textAnchor="middle" fill="#57f1db" fontSize="8" fontFamily="monospace" fillOpacity="0.55">SIDE</text>
      <text x="100" y="93" textAnchor="middle" fill="#57f1db" fontSize="7" fontFamily="monospace" fillOpacity="0.45">HIP HEIGHT</text>
    </svg>
  );
}

function FramingSVG() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      <rect x="90" y="10" width="100" height="140" rx="6" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="5 3" />
      {/* Figure */}
      <circle cx="140" cy="36" r="11" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.9" />
      <line x1="140" y1="47" x2="140" y2="84" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.9" />
      <line x1="140" y1="62" x2="129" y2="76" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="140" y1="62" x2="151" y2="76" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="140" y1="84" x2="130" y2="112" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.9" />
      <line x1="130" y1="112" x2="127" y2="138" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.9" />
      <line x1="140" y1="84" x2="150" y2="112" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.9" />
      <line x1="150" y1="112" x2="153" y2="138" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.9" />
      {/* Joint dots */}
      {[[140, 84], [130, 112], [150, 112], [127, 138], [153, 138]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i > 2 ? 3 : 4} fill="#57f1db" fillOpacity="0.65" />
      ))}
      {/* Side labels */}
      <text x="82" y="38" textAnchor="end" fill="#57f1db" fontSize="8" fontFamily="monospace" fillOpacity="0.6">HIPS</text>
      <text x="82" y="141" textAnchor="end" fill="#57f1db" fontSize="8" fontFamily="monospace" fillOpacity="0.6">FEET</text>
      <text x="82" y="34" textAnchor="end" fill="#57f1db" fontSize="10" fillOpacity="0.7">✓</text>
      <text x="82" y="144" textAnchor="end" fill="#57f1db" fontSize="10" fillOpacity="0.7">✓</text>
    </svg>
  );
}

function DurationSVG() {
  return (
    <svg viewBox="0 0 280 160" className="w-full h-full" fill="none">
      <circle cx="140" cy="80" r="52" stroke="#57f1db" strokeWidth="1.5" strokeOpacity="0.18" />
      <circle cx="140" cy="80" r="52" stroke="#57f1db" strokeWidth="2.5" strokeOpacity="0.75"
        strokeDasharray="196" strokeDashoffset="65" strokeLinecap="round"
        transform="rotate(-90 140 80)"
      />
      <circle cx="140" cy="80" r="38" fill="#57f1db" fillOpacity="0.04" stroke="#57f1db" strokeWidth="1" strokeOpacity="0.25" />
      <line x1="140" y1="80" x2="140" y2="50" stroke="#57f1db" strokeWidth="2" strokeOpacity="0.85" strokeLinecap="round" />
      <line x1="140" y1="80" x2="158" y2="90" stroke="#57f1db" strokeWidth="2.5" strokeOpacity="0.85" strokeLinecap="round" />
      <circle cx="140" cy="80" r="3.5" fill="#57f1db" />
      <rect x="133" y="22" width="14" height="6" rx="2" fill="#57f1db" fillOpacity="0.4" />
      <text x="140" y="85" textAnchor="middle" fill="#57f1db" fontSize="13" fontFamily="monospace" fontWeight="bold" fillOpacity="0.85">15–30s</text>
      {/* Footprints */}
      {[75, 105, 135, 165, 195].map((x, i) => (
        <ellipse key={x} cx={x} cy={147} rx="5" ry="8" fill="#57f1db"
          fillOpacity={0.15 + (i % 2) * 0.12}
          transform={`rotate(${i % 2 === 0 ? -12 : 12} ${x} 147)`}
        />
      ))}
    </svg>
  );
}

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const next = () => {
    if (slide < slides.length - 1) {
      setDirection(1);
      setSlide(s => s + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = slides[slide];
  const Visual = current.visual;
  const isLast = slide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
        className="relative w-full max-w-sm bg-surface-container-low border border-outline-variant rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Skip */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-highest/60 text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Skip intro"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Visual */}
        <div className="h-44 bg-surface-container flex items-center justify-center px-8 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full"
            >
              <Visual />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="p-6 pt-5">
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-4">
            {slides.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i === slide ? 'bg-primary w-6' : 'bg-outline-variant w-2.5'
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <h2 className="font-display text-xl font-bold text-on-surface mb-2">{current.title}</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">{current.description}</p>
            </motion.div>
          </AnimatePresence>

          <button
            onClick={next}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-on-primary rounded-xl font-mono text-[11px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            {isLast ? 'Get started' : (
              <>Next <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
