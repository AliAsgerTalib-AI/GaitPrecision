import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, ChevronRight, TrendingUp, Heart, Star, ArrowLeft, Activity, Download } from 'lucide-react';
import { loadSessions, type GaitSession } from '@/src/lib/sessionDb';
import { cn, fmtDate, fmtDuration } from '@/src/lib/utils';
import { getProfile, getAgeGroup } from '@/src/lib/userProfile';
import { generateSessionPDF } from '@/src/lib/pdfReport';
import WellnessTrend from './WellnessTrend';
import BenchmarkPanel from './BenchmarkPanel';
import ExercisePrescription from './ExercisePrescription';

function wellnessScore(score: number): { label: string; stars: number; color: string } {
  if (score >= 85) return { label: 'Excellent', stars: 5, color: 'text-primary' };
  if (score >= 70) return { label: 'Good', stars: 4, color: 'text-primary' };
  if (score >= 55) return { label: 'Fair', stars: 3, color: 'text-[#f59e0b]' };
  if (score >= 40) return { label: 'Needs Work', stars: 2, color: 'text-[#f59e0b]' };
  return { label: 'Needs Attention', stars: 1, color: 'text-error' };
}

function Stars({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <Star
          key={i}
          className={cn('w-4 h-4', i < count ? 'text-primary fill-primary' : 'text-outline-variant')}
        />
      ))}
    </div>
  );
}

function encouragement(sessions: GaitSession[]): string {
  if (sessions.length === 0) return '';
  if (sessions.length === 1) return 'Great first step! Record more walks to track your progress over time.';
  const latest = sessions[0].score;
  const previous = sessions[1].score;
  if (latest > previous) return `You improved by ${latest - previous} points since your last session. Keep it up!`;
  if (latest === previous) return 'Your score is holding steady. Consistency is key — great work!';
  return 'Every walk counts. Keep going — improvement takes time and you\'re on the right path.';
}

function SessionDetail({ session, onBack }: { session: GaitSession; onBack: () => void }) {
  const ws = wellnessScore(session.score);
  const cadence = session.stride?.cadence ?? 0;
  const asymmetry = session.kneeAngles.left.length
    ? Math.abs((session.kneeAngles.left.at(-1) ?? 0) - (session.kneeAngles.right.at(-1) ?? 0))
    : 0;
  const [downloading, setDownloading] = useState(false);

  function handleDownloadPDF() {
    setDownloading(true);
    try {
      generateSessionPDF(session, getProfile(), getAgeGroup());
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-2xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to history</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Preparing…' : 'Download PDF Report'}
          </button>
        </div>
        <h1 className="font-display text-3xl font-bold text-on-surface mb-1">Walk Session</h1>
        <p className="text-on-surface-variant">{fmtDate(session.date)} · {fmtDuration(session.duration)}</p>
      </motion.div>

      <div className="space-y-4">
        {/* Score card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-container p-6 rounded-2xl border border-outline-variant">
          <p className="text-sm text-on-surface-variant mb-4">Your Walking Score</p>
          <div className="flex items-center gap-5">
            <div className="text-5xl font-display font-bold text-on-surface">{session.score}</div>
            <div>
              <p className={cn('text-xl font-display font-bold', ws.color)}>{ws.label}</p>
              <Stars count={ws.stars} />
            </div>
          </div>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-surface-container p-5 rounded-2xl border border-outline-variant">
            <p className="text-xs text-on-surface-variant mb-2">Balance</p>
            <p className={cn('text-lg font-bold', asymmetry <= 10 ? 'text-primary' : asymmetry <= 20 ? 'text-[#f59e0b]' : 'text-error')}>
              {asymmetry <= 10 ? 'Balanced' : asymmetry <= 20 ? 'Slight imbalance' : 'Imbalanced'}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-surface-container p-5 rounded-2xl border border-outline-variant">
            <p className="text-xs text-on-surface-variant mb-2">Steps per Minute</p>
            <p className="text-lg font-bold text-on-surface">{cadence > 0 ? cadence : '—'}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="bg-surface-container p-5 rounded-2xl border border-outline-variant">
            <p className="text-xs text-on-surface-variant mb-2">Left Leg on Ground</p>
            <p className="text-lg font-bold text-on-surface">{session.stride?.left.stancePercent ? `${session.stride.left.stancePercent}%` : '—'}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-surface-container p-5 rounded-2xl border border-outline-variant">
            <p className="text-xs text-on-surface-variant mb-2">Right Leg on Ground</p>
            <p className="text-lg font-bold text-on-surface">{session.stride?.right.stancePercent ? `${session.stride.right.stancePercent}%` : '—'}</p>
          </motion.div>
        </div>

        {/* Tip */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="p-5 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-3">
          <Heart className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {ws.stars >= 4
              ? 'Your walking pattern looks great. Keep up your daily walks to maintain this score.'
              : ws.stars === 3
              ? 'Your walk is good but there\'s room to improve balance. Try standing on one foot for 30 seconds daily.'
              : 'Consider speaking with a physiotherapist about balance exercises tailored to your needs.'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function WellnessReport() {
  const [sessions, setSessions] = useState<GaitSession[]>([]);
  const [selected, setSelected] = useState<GaitSession | null>(null);

  useEffect(() => {
    loadSessions().then(setSessions).catch(console.error);
  }, []);

  if (selected) {
    return <SessionDetail session={selected} onBack={() => setSelected(null)} />;
  }

  const encouragementMsg = encouragement(sessions);
  const hasImprovement = sessions.length >= 2 && sessions[0].score > sessions[1].score;

  return (
    <div className="pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-2xl mx-auto min-h-screen">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="w-6 h-6 text-primary" />
          <h1 className="font-display text-3xl font-bold text-on-surface">Your Walking History</h1>
        </div>
        <p className="text-on-surface-variant">Each card below is one recorded walk session.</p>
      </motion.div>

      {/* Trend chart — only when there are 2+ sessions */}
      {sessions.length >= 2 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <WellnessTrend sessions={sessions} />
        </motion.div>
      )}

      {/* Age benchmark */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <BenchmarkPanel session={sessions[0] ?? null} />
      </motion.div>

      {/* Exercise prescription */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <ExercisePrescription session={sessions[0] ?? null} />
      </motion.div>

      {/* Encouragement banner */}
      <AnimatePresence>
        {encouragementMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex items-start gap-3 p-5 rounded-2xl border mb-6',
              hasImprovement ? 'bg-primary/5 border-primary/20' : 'bg-surface-container border-outline-variant'
            )}
          >
            <TrendingUp className={cn('w-5 h-5 flex-shrink-0 mt-0.5', hasImprovement ? 'text-primary' : 'text-on-surface-variant')} />
            <p className="text-sm text-on-surface-variant leading-relaxed">{encouragementMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session history */}
      <div className="pt-2">
        <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-4">Session History</h3>
      </div>

      {sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16 flex flex-col items-center text-center gap-4 border border-outline-variant border-dashed rounded-2xl"
        >
          <Activity className="w-10 h-10 text-outline-variant" />
          <div>
            <p className="font-semibold text-on-surface mb-1">No walks recorded yet</p>
            <p className="text-sm text-on-surface-variant">Record your first walk to start tracking your progress.</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => {
            const ws = wellnessScore(session.score);
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-surface-container rounded-2xl border border-outline-variant hover:border-primary/40 transition-all group"
              >
                <div className="flex items-center p-5 gap-3">
                  {/* Main card — click to open detail */}
                  <button
                    onClick={() => setSelected(session)}
                    className="flex-1 flex items-center gap-4 text-left min-w-0"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="font-display font-bold text-primary text-sm">{session.score}</span>
                    </div>
                    <div className="min-w-0">
                      <p className={cn('font-semibold text-base', ws.color)}>{ws.label}</p>
                      <Stars count={ws.stars} />
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-on-surface-variant">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(session.date)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration(session.duration)}</span>
                        {session.stride?.cadence ? <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{session.stride.cadence} spm</span> : null}
                      </div>
                    </div>
                  </button>

                  {/* PDF download */}
                  <button
                    onClick={() => generateSessionPDF(session, getProfile(), getAgeGroup())}
                    title="Download PDF report"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex-shrink-0 text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>

                  <ChevronRight
                    onClick={() => setSelected(session)}
                    className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors flex-shrink-0 cursor-pointer"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
