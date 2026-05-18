import { motion } from 'motion/react';
import { Dumbbell, Timer, Star } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { GaitSession } from '@/src/lib/sessionDb';
import { pickExercises, prescriptionTitle } from '@/src/lib/exercises';

interface Props {
  session: GaitSession | null;
}

export default function ExercisePrescription({ session }: Props) {
  const exercises = pickExercises(session);
  const { heading, subheading } = prescriptionTitle(session);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Dumbbell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-on-surface">{heading}</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">{subheading}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {exercises.map((ex, i) => (
          <motion.div
            key={ex.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-surface-container rounded-2xl border border-outline-variant p-5 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-display font-bold text-on-surface text-base leading-tight pr-2">{ex.name}</h4>
              <span className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                ex.difficulty === 'Easy'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-[#f59e0b]/10 text-[#f59e0b]'
              )}>
                {ex.difficulty}
              </span>
            </div>

            {/* Why */}
            <p className="text-xs text-on-surface-variant leading-relaxed mb-4">{ex.why}</p>

            {/* Steps */}
            <ol className="space-y-2 flex-1">
              {ex.steps.map((step, j) => (
                <li key={j} className="flex items-start gap-2 text-xs text-on-surface">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {j + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            {/* Frequency */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-outline-variant/50">
              <Timer className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs text-on-surface-variant">{ex.frequency}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-on-surface-variant text-center pt-1 flex items-center justify-center gap-1.5">
        <Star className="w-3 h-3 text-primary" />
        Always consult your doctor before starting a new exercise program.
      </p>
    </div>
  );
}
