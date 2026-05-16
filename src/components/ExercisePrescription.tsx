import { motion } from 'motion/react';
import { Dumbbell, Timer, Star } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { GaitSession } from '@/src/lib/sessionDb';

interface Exercise {
  name: string;
  why: string;
  steps: string[];
  frequency: string;
  difficulty: 'Easy' | 'Moderate';
}

const LIBRARY: Record<string, Exercise[]> = {
  asymmetry: [
    {
      name: 'Single-Leg Stand',
      why: 'Strengthens the hip stabilisers that keep each leg doing equal work.',
      steps: [
        'Stand next to a wall or sturdy chair for safety.',
        'Lift one foot slightly off the ground and hold for 10 seconds.',
        'Switch legs. Complete 5 holds per side.',
      ],
      frequency: '3 sets, twice daily',
      difficulty: 'Easy',
    },
    {
      name: 'Side-Step Walking',
      why: 'Activates the outer hip muscles that control lateral balance.',
      steps: [
        'Stand tall with feet together.',
        'Step sideways 10 steps to the right, then 10 back to the left.',
        'Keep your toes pointing forward the whole time.',
      ],
      frequency: '3 rounds, once daily',
      difficulty: 'Easy',
    },
    {
      name: 'Hip Abductor Squeeze',
      why: 'Directly trains the muscles that balance your pelvis during each step.',
      steps: [
        'Sit upright in a firm chair with a rolled towel or pillow between your knees.',
        'Squeeze the towel firmly for 5 seconds, then release.',
        'Complete 15 repetitions.',
      ],
      frequency: '3 sets, daily',
      difficulty: 'Easy',
    },
  ],
  cadence: [
    {
      name: 'Marching in Place',
      why: 'Trains your legs to move faster without requiring a long walking space.',
      steps: [
        'Stand tall, holding a chair back if needed.',
        'Lift each knee to hip height in a marching motion.',
        'Keep a brisk, rhythmic pace for 30 seconds, then rest 15 seconds.',
      ],
      frequency: '5 rounds, once daily',
      difficulty: 'Easy',
    },
    {
      name: 'Brisk Walk Intervals',
      why: 'Builds the habit of walking at a faster, healthier pace.',
      steps: [
        'Walk at your normal comfortable pace for 2 minutes.',
        'Then walk as briskly as you safely can for 1 minute.',
        'Repeat 4–5 times on a flat, clear path.',
      ],
      frequency: 'Every other day',
      difficulty: 'Moderate',
    },
    {
      name: 'Heel-to-Toe Walking',
      why: 'Improves foot placement rhythm and coordination with each stride.',
      steps: [
        'Find a clear line on the floor or use a piece of tape.',
        'Walk along it placing your heel directly in front of your opposite toe.',
        'Do 20 steps forward, pause, then 20 steps back.',
      ],
      frequency: 'Daily, 3 rounds',
      difficulty: 'Moderate',
    },
  ],
  fallRisk: [
    {
      name: 'Sit-to-Stand Practice',
      why: 'Leg strength from sitting to standing is one of the strongest predictors of fall prevention.',
      steps: [
        'Sit in a sturdy chair with your feet flat on the floor.',
        'Cross your arms over your chest (no hands on chair).',
        'Slowly stand up, hold 1 second, sit back down slowly. Do 10 repetitions.',
      ],
      frequency: '3 sets, daily',
      difficulty: 'Moderate',
    },
    {
      name: 'Tandem Walking',
      why: 'Challenges your balance system the same way uneven ground does.',
      steps: [
        'Walk alongside a wall or hallway you can touch for safety.',
        'Place one foot directly in front of the other, heel to toe.',
        'Take 20 steps forward. Pause. Walk back.',
      ],
      frequency: '3 rounds, daily',
      difficulty: 'Moderate',
    },
    {
      name: 'Seated Leg Raises',
      why: 'Builds the quadriceps strength that prevents the knees from buckling.',
      steps: [
        'Sit upright in a chair with your back straight.',
        'Slowly raise one leg until it is straight out in front of you.',
        'Hold for 3 seconds, lower slowly. 10 reps each leg.',
      ],
      frequency: '3 sets, daily',
      difficulty: 'Easy',
    },
  ],
  general: [
    {
      name: 'Calf Raises',
      why: 'Strong calves improve push-off power with every step.',
      steps: [
        'Stand behind a chair, holding the back for support.',
        'Rise up onto your toes as high as comfortable.',
        'Hold for 2 seconds, then lower slowly. 15 repetitions.',
      ],
      frequency: '3 sets, daily',
      difficulty: 'Easy',
    },
    {
      name: 'Chair Squats',
      why: 'Builds overall leg strength — the foundation of healthy walking.',
      steps: [
        'Stand in front of a chair with feet shoulder-width apart.',
        'Slowly bend your knees as if about to sit, stopping just before you touch the seat.',
        'Hold 2 seconds, stand back up. 10 repetitions.',
      ],
      frequency: '3 sets, daily',
      difficulty: 'Moderate',
    },
    {
      name: 'Figure-8 Walking',
      why: 'Improves turning stability and full-body coordination.',
      steps: [
        'Place two objects (cups, books) about 3 feet apart.',
        'Walk in a slow figure-8 pattern around them.',
        'Continue for 3–5 minutes.',
      ],
      frequency: 'Once daily',
      difficulty: 'Easy',
    },
  ],
};

function pickExercises(session: GaitSession | null): Exercise[] {
  if (!session) return LIBRARY.general;

  const asymmetry = session.kneeAngles.left.length
    ? Math.abs(
        (session.kneeAngles.left.at(-1) ?? 0) - (session.kneeAngles.right.at(-1) ?? 0)
      )
    : 0;
  const cadence = session.stride?.cadence ?? 0;
  const score = session.score;

  // High fall risk: low score + imbalance
  if (score < 60 || asymmetry > 20) return LIBRARY.fallRisk;
  // Significant asymmetry
  if (asymmetry > 12) return LIBRARY.asymmetry;
  // Low cadence (and we have cadence data)
  if (cadence > 0 && cadence < 90) return LIBRARY.cadence;
  // Good score — general maintenance
  return LIBRARY.general;
}

function prescriptionTitle(session: GaitSession | null): { heading: string; subheading: string } {
  if (!session) return { heading: 'Getting Started Exercises', subheading: 'These exercises support healthy walking for everyone.' };

  const asymmetry = session.kneeAngles.left.length
    ? Math.abs((session.kneeAngles.left.at(-1) ?? 0) - (session.kneeAngles.right.at(-1) ?? 0))
    : 0;
  const cadence = session.stride?.cadence ?? 0;
  const score = session.score;

  if (score < 60 || asymmetry > 20) return {
    heading: 'Balance & Stability Exercises',
    subheading: 'Your results suggest focusing on balance and leg strength to reduce fall risk.',
  };
  if (asymmetry > 12) return {
    heading: 'Balance & Symmetry Exercises',
    subheading: 'One leg is working harder than the other. These exercises help even things out.',
  };
  if (cadence > 0 && cadence < 90) return {
    heading: 'Walking Pace Exercises',
    subheading: 'Your walking pace is a little slow. These exercises will help you walk more energetically.',
  };
  return {
    heading: 'Maintenance Exercises',
    subheading: 'Your walking is in good shape. These exercises will keep it that way.',
  };
}

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
