import { useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  AGE_GROUP_LABELS,
  BENCHMARKS,
  getAgeGroup,
  saveAgeGroup,
  type AgeGroup,
} from '@/src/lib/userProfile';
import type { GaitSession } from '@/src/lib/sessionDb';

interface Props {
  session: GaitSession | null;
}

function CompareBar({ label, userValue, benchmark, unit, higherIsBetter = true }: {
  label: string;
  userValue: number;
  benchmark: number;
  unit: string;
  higherIsBetter?: boolean;
}) {
  const ratio = benchmark > 0 ? userValue / benchmark : 1;
  const isGood = higherIsBetter ? ratio >= 0.9 : ratio <= 1.1;
  const isGreat = higherIsBetter ? ratio >= 1.05 : ratio <= 0.95;
  const pct = Math.min(100, Math.round(ratio * 100));

  const barColor = isGreat ? 'bg-primary' : isGood ? 'bg-[#f59e0b]' : 'bg-error';
  const textColor = isGreat ? 'text-primary' : isGood ? 'text-[#f59e0b]' : 'text-error';
  const statusLabel = isGreat ? 'Above average' : isGood ? 'On track' : 'Below average';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-on-surface-variant">{label}</span>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs font-medium', textColor)}>{statusLabel}</span>
          <span className="text-sm font-display font-bold text-on-surface tabular-nums">{userValue} <span className="text-xs text-on-surface-variant font-normal">{unit}</span></span>
        </div>
      </div>
      <div className="relative h-2.5 bg-surface-container-low rounded-full border border-outline-variant/50">
        {/* benchmark marker */}
        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-outline-variant rounded-full" style={{ left: '100%', transform: 'translate(-50%, -50%)' }} />
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
        <span>0</span>
        <span>Average for your age: {benchmark} {unit}</span>
      </div>
    </div>
  );
}

export default function BenchmarkPanel({ session }: Props) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(getAgeGroup);
  const [open, setOpen] = useState(false);

  const handleSelect = (g: AgeGroup) => {
    saveAgeGroup(g);
    setAgeGroup(g);
    setOpen(false);
  };

  const bench = ageGroup ? BENCHMARKS[ageGroup] : null;
  const cadence = session?.stride?.cadence ?? 0;
  const score = session?.score ?? 0;

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-on-surface">How You Compare</h3>
            <p className="text-xs text-on-surface-variant">Compared to healthy adults in your age group</p>
          </div>
        </div>

        {/* Age group selector */}
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-container-high border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:border-primary/40 transition-colors"
          >
            {ageGroup ? AGE_GROUP_LABELS[ageGroup] : 'Set age group'}
            <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-surface-container border border-outline-variant rounded-xl shadow-xl overflow-hidden min-w-[160px]">
              {(Object.entries(AGE_GROUP_LABELS) as [AgeGroup, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className={cn(
                    'w-full text-left px-4 py-3 text-sm hover:bg-surface-container-high transition-colors',
                    ageGroup === key ? 'text-primary font-medium' : 'text-on-surface'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!ageGroup ? (
        <p className="text-sm text-on-surface-variant py-4 text-center border border-outline-variant border-dashed rounded-xl">
          Select your age group above to see how your results compare to others your age.
        </p>
      ) : !session ? (
        <p className="text-sm text-on-surface-variant py-4 text-center border border-outline-variant border-dashed rounded-xl">
          Record a walk to see your comparison.
        </p>
      ) : (
        <div className="space-y-5">
          <CompareBar
            label="Walking Score"
            userValue={score}
            benchmark={bench!.score}
            unit="/ 100"
          />
          {cadence > 0 && (
            <CompareBar
              label="Steps per Minute"
              userValue={cadence}
              benchmark={bench!.cadence}
              unit="spm"
            />
          )}
        </div>
      )}
    </div>
  );
}
