import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { GaitSession } from '@/src/lib/sessionDb';

interface Props {
  sessions: GaitSession[];
}

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { date, score, label } = payload[0].payload;
  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-3 shadow-xl text-sm">
      <p className="text-on-surface-variant text-xs mb-1">{fmt(date)}</p>
      <p className="font-display font-bold text-on-surface text-lg">{score}<span className="text-xs text-on-surface-variant ml-1">/ 100</span></p>
      <p className="text-primary text-xs mt-0.5">{label}</p>
    </div>
  );
}

export default function WellnessTrend({ sessions }: Props) {
  // oldest → newest for chart
  const data = [...sessions].reverse().map(s => ({
    date: s.date,
    score: s.score,
    label: s.label,
    dateLabel: fmt(s.date),
  }));

  const latest = sessions[0].score;
  const previous = sessions[1].score;
  const delta = latest - previous;

  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? 'text-primary' : delta < 0 ? 'text-error' : 'text-on-surface-variant';
  const trendText = delta > 0 ? `+${delta} points since last session` : delta < 0 ? `${delta} points since last session` : 'Same score as last session';

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg font-bold text-on-surface">Your Progress Over Time</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">Walking score from each recorded session</p>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          {trendText}
        </div>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#57f1db" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#57f1db" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="dateLabel" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {/* Zone reference lines */}
            <ReferenceLine y={85} stroke="#57f1db" strokeDasharray="4 4" strokeOpacity={0.3} label={{ value: 'Excellent', position: 'insideTopRight', fill: '#57f1db', fontSize: 9, opacity: 0.5 }} />
            <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.3} label={{ value: 'Good', position: 'insideTopRight', fill: '#f59e0b', fontSize: 9, opacity: 0.5 }} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#57f1db"
              strokeWidth={2.5}
              fill="url(#scoreGrad)"
              dot={{ fill: '#57f1db', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: '#57f1db', strokeWidth: 2, stroke: '#0b1326' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Zone legend */}
      <div className="flex items-center gap-6 mt-4 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary rounded inline-block" /> Excellent (85+)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#f59e0b] rounded inline-block" /> Good (70+)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-error rounded inline-block" /> Needs Work (&lt;70)</span>
      </div>
    </div>
  );
}
