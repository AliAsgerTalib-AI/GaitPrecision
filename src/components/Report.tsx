import { useState, lazy, Suspense } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Share2, FileDown, Fingerprint, Calendar, Timer, Activity, ClipboardList, TrendingUp, Radio } from 'lucide-react';
import { motion } from 'motion/react';

// Lazy import keeps Three.js / WebGL code out of the server-side module graph.
// The dynamic boundary means the chunk is only evaluated in a browser context.
const Gait3D = lazy(() => import('./Gait3D'));

const mockChartData = Array.from({ length: 40 }, (_, i) => ({
  time: i,
  knee: 40 + Math.sin(i * 0.3) * 30 + Math.random() * 5,
  ankle: 10 + Math.cos(i * 0.3) * 15 + Math.random() * 3,
}));

const SESSIONS = [
  { id: 'SES-001', date: 'OCT 24, 2026', type: 'Reflex Baseline Protocol', score: 94, duration: '04M 12S', status: 'Stable' },
  { id: 'SES-002', date: 'OCT 12, 2026', type: 'Post-Op Kinematic Follow-up', score: 82, duration: '03M 45S', status: 'Improved' },
  { id: 'SES-003', date: 'SEP 28, 2026', type: 'Stance Stability Analysis', score: 71, duration: '02M 30S', status: 'Critical' },
];

export default function Report({ onViewProfile }: { onViewProfile: () => void }) {
  const [selectedSession, setSelectedSession] = useState<typeof SESSIONS[0] | null>(null);

  if (selectedSession) {
    return (
      <div className="pt-24 pb-12 px-6 max-w-[1440px] mx-auto w-full space-y-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-between items-center bg-surface-container p-6 rounded-2xl border border-outline-variant shadow-xl"
        >
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setSelectedSession(null)}
              className="p-3 bg-surface-container-high hover:bg-surface-variant rounded-xl border border-outline-variant transition-all"
            >
              <Share2 className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <h2 className="text-2xl font-display font-bold text-on-surface">Analysis Trace: {selectedSession.id}</h2>
              <p className="text-on-surface-variant font-mono text-[10px] uppercase tracking-widest">{selectedSession.type} // {selectedSession.date}</p>
            </div>
          </div>
          <button 
            onClick={() => setSelectedSession(null)}
            className="px-6 py-3 bg-surface-container-high border border-outline-variant rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:border-primary/50 transition-all text-primary"
          >
            Close_Detail_View
          </button>
        </motion.div>

        {/* Detailed Metrics (Reusing the existing detailed view logic) */}
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="glass-panel p-8 rounded-2xl space-y-12">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-display font-bold text-on-surface">Precision Biometrics</h3>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-on-surface-variant tracking-widest uppercase">Engine Confidence</p>
                  <p className="text-4xl font-display font-bold text-primary italic">{selectedSession.score}<span className="text-lg">/100</span></p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-primary font-bold uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Joint Flexion Dynamics
                  </span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 100]} />
                      <Area type="monotone" dataKey="knee" stroke="#57f1db" fill="#57f1db" fillOpacity={0.1} strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-2xl">
              <Suspense fallback={<div className="w-full aspect-video bg-surface-container-low rounded-2xl animate-pulse" />}>
                <Gait3D />
              </Suspense>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="glass-panel p-8 rounded-2xl bg-surface-container">
              <h4 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-6">Diagnostic Summary</h4>
              <div className="space-y-4">
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                  <span className="block font-mono text-[9px] text-on-surface-variant uppercase mb-1">Session Duration</span>
                  <span className="text-xl font-display font-bold">{selectedSession.duration}</span>
                </div>
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                  <span className="block font-mono text-[9px] text-on-surface-variant uppercase mb-1">Baseline Status</span>
                  <span className={`text-xl font-display font-bold ${selectedSession.status === 'Critical' ? 'text-error' : 'text-primary'}`}>
                    {selectedSession.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-6 max-w-[1440px] mx-auto w-full space-y-8">
      {/* Patient Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-surface-container-low p-8 border border-outline-variant rounded-2xl shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl font-display font-bold text-on-surface tracking-tight"
            >
              Analysis Index: Marcus Thorne
            </motion.h1>
            <button 
              onClick={onViewProfile}
              className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-primary/20 transition-all"
            >
              Manage_Identity
            </button>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-3 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
            <span className="flex items-center gap-2"><Fingerprint className="w-4 h-4 text-primary" /> ID: GP-8829-X</span>
            <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> SESSIONS: {SESSIONS.length}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-3 px-6 py-3 bg-primary text-on-primary font-mono text-xs font-bold rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20">
            <FileDown className="w-4 h-4" />
            GENERATE_AGGREGATE_REPORT
          </button>
        </div>
      </section>

      {/* Sessions Index List */}
      <div className="grid grid-cols-1 gap-4">
        <h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.3em] font-bold px-2">Historical Capture Timeline</h3>
        {SESSIONS.map((session, i) => (
          <motion.div 
            key={session.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => setSelectedSession(session)}
            className="group glass-panel p-6 rounded-2xl border border-outline-variant hover:border-primary transition-all cursor-pointer flex justify-between items-center"
          >
            <div className="flex items-center gap-8">
              <div className="w-14 h-14 bg-surface-container-high rounded-xl flex items-center justify-center font-mono text-xs text-primary border border-outline-variant group-hover:scale-105 transition-transform">
                {session.id.split('-')[1]}
              </div>
              <div>
                <h4 className="text-xl font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{session.type}</h4>
                <div className="flex items-center gap-4 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {session.date}</span>
                  <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> {session.duration}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-12">
              <div className="text-right">
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-tighter opacity-60 mb-1 font-bold">Score</p>
                <p className="text-2xl font-display font-bold text-on-surface">{session.score}%</p>
              </div>
              <div className={`px-4 py-1.5 rounded-lg font-mono text-[9px] font-bold uppercase tracking-widest border ${
                session.status === 'Improved' ? 'bg-primary/10 border-primary/20 text-primary' : 
                session.status === 'Stable' ? 'bg-secondary/10 border-secondary/20 text-on-surface-variant' :
                'bg-error/10 border-error/20 text-error'
              }`}>
                {session.status}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

