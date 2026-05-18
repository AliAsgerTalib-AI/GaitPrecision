import { useState, useEffect, lazy, Suspense } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Share2, Calendar, Timer, Activity, ClipboardList, TrendingUp, Radio, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, fmtDate, fmtDuration } from '@/src/lib/utils';
import { loadSessions, deleteSession, clearAllSessions, type GaitSession } from '@/src/lib/sessionDb';
import { getProfile, getAgeGroup } from '@/src/lib/userProfile';
import { generateSessionPDF } from '@/src/lib/pdfReport';

const Gait3D = lazy(() => import('./Gait3D'));

// Resample an array to exactly n points (linear index interpolation).
function sampleToN(arr: number[], n: number): (number | null)[] {
  if (!arr.length) return Array(n).fill(null);
  if (arr.length === 1) return Array(n).fill(arr[0]);
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round((i / (n - 1)) * (arr.length - 1));
    return arr[idx];
  });
}

export default function Report({ onViewProfile }: { onViewProfile: () => void }) {
  const [sessions, setSessions] = useState<GaitSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<GaitSession | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<GaitSession | null>(null);
  const [compareB, setCompareB] = useState<GaitSession | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    loadSessions().then(setSessions).catch(console.error);
  }, []);

  async function handleDelete(id: string) {
    await deleteSession(id);
    setConfirmDeleteId(null);
    if (compareA?.id === id) setCompareA(null);
    if (compareB?.id === id) setCompareB(null);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  async function handleDeleteAll() {
    await clearAllSessions();
    setConfirmDeleteAll(false);
    setCompareA(null);
    setCompareB(null);
    setSessions([]);
  }

  function toggleCompare() {
    setCompareMode(m => !m);
    setCompareA(null);
    setCompareB(null);
  }

  function handleCompareClick(session: GaitSession) {
    if (compareA?.id === session.id) {
      // Deselect A — promote B into A slot
      setCompareA(compareB);
      setCompareB(null);
    } else if (compareB?.id === session.id) {
      setCompareB(null);
    } else if (!compareA) {
      setCompareA(session);
    } else if (!compareB) {
      setCompareB(session);
    } else {
      // Both slots taken — replace B with new pick
      setCompareB(session);
    }
  }

  // ── Comparison view ────────────────────────────────────────────────────
  if (compareMode && compareA && compareB) {
    const N = 100;
    const chartData = Array.from({ length: N }, (_, i) => ({
      pct: i,
      aLeft:  sampleToN(compareA.kneeAngles.left,  N)[i],
      aRight: sampleToN(compareA.kneeAngles.right, N)[i],
      bLeft:  sampleToN(compareB.kneeAngles.left,  N)[i],
      bRight: sampleToN(compareB.kneeAngles.right, N)[i],
    }));

    const diffRows = [
      {
        label: 'Symmetry Score',
        a: `${compareA.score}`,
        b: `${compareB.score}`,
        delta: compareB.score - compareA.score,
        unit: 'pts',
      },
      {
        label: 'Duration',
        a: fmtDuration(compareA.duration),
        b: fmtDuration(compareB.duration),
        delta: null as number | null,
        unit: '',
      },
      {
        label: 'Cadence',
        a: compareA.stride?.cadence ? `${compareA.stride.cadence} spm` : '—',
        b: compareB.stride?.cadence ? `${compareB.stride.cadence} spm` : '—',
        delta: (compareA.stride?.cadence && compareB.stride?.cadence)
          ? compareB.stride.cadence - compareA.stride.cadence
          : null,
        unit: 'spm',
      },
      {
        label: 'L Stance %',
        a: compareA.stride?.left ? `${compareA.stride.left.stancePercent}%` : '—',
        b: compareB.stride?.left ? `${compareB.stride.left.stancePercent}%` : '—',
        delta: (compareA.stride?.left && compareB.stride?.left)
          ? compareB.stride.left.stancePercent - compareA.stride.left.stancePercent
          : null,
        unit: '%',
      },
      {
        label: 'Frames',
        a: `${compareA.frameCount}`,
        b: `${compareB.frameCount}`,
        delta: compareB.frameCount - compareA.frameCount,
        unit: '',
      },
    ];

    return (
      <div className="pt-24 pb-12 px-6 max-w-[1440px] mx-auto w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center bg-surface-container p-6 rounded-2xl border border-outline-variant shadow-xl"
        >
          <div>
            <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary" />
              Session Comparison
            </h2>
            <p className="text-on-surface-variant font-mono text-[10px] uppercase tracking-widest mt-1">Bilateral knee flexion overlay — 0–100% session progress</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCompareB(null)}
              className="px-5 py-3 bg-surface-container-high border border-outline-variant rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:border-primary/50 transition-all text-primary"
            >
              Change_B
            </button>
            <button
              onClick={toggleCompare}
              className="px-5 py-3 bg-surface-container-high border border-outline-variant rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:border-error/50 transition-all text-on-surface-variant"
            >
              Exit_Compare
            </button>
          </div>
        </motion.div>

        {/* Session A / B labels */}
        <div className="grid grid-cols-2 gap-6">
          {([compareA, compareB] as const).map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-6 bg-surface-container-low border border-outline-variant rounded-2xl flex items-center gap-5"
            >
              <div className={cn(
                'w-5 h-5 rounded-full shrink-0',
                i === 0
                  ? 'bg-primary shadow-[0_0_12px_#57f1db]'
                  : 'bg-secondary shadow-[0_0_12px_#bcc7de]'
              )} />
              <div>
                <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Session {i === 0 ? 'A' : 'B'}</p>
                <p className="font-display font-bold text-on-surface text-lg">{s.label}</p>
                <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                  {fmtDate(s.date)} · {fmtDuration(s.duration)} · Score {s.score}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Overlaid knee angle chart */}
        <div className="glass-panel p-8 rounded-2xl space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Knee Flexion Overlay
            </h3>
            <div className="flex flex-wrap gap-6 font-mono text-[10px] font-bold tracking-widest">
              <span className="flex items-center gap-2"><span className="w-6 h-0.5 bg-primary inline-block rounded" /> A – Left</span>
              <span className="flex items-center gap-2"><span className="w-6 h-0.5 bg-primary/40 inline-block rounded border-dashed" style={{ borderBottom: '2px dashed #57f1db66' }} /> A – Right</span>
              <span className="flex items-center gap-2"><span className="w-6 h-0.5 bg-secondary inline-block rounded" /> B – Left</span>
              <span className="flex items-center gap-2"><span className="w-6 h-0.5 bg-secondary/40 inline-block rounded" style={{ borderBottom: '2px dashed #bcc7de66' }} /> B – Right</span>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="pct" hide />
                <YAxis hide domain={[0, 180]} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                  formatter={(v: number, name: string) => [v != null ? `${v.toFixed(1)}°` : '—', name]}
                />
                <Line type="monotone" dataKey="aLeft"  name="A – Left Knee"  stroke="#57f1db" strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="aRight" name="A – Right Knee" stroke="#57f1db" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls strokeOpacity={0.55} />
                <Line type="monotone" dataKey="bLeft"  name="B – Left Knee"  stroke="#bcc7de" strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="bRight" name="B – Right Knee" stroke="#bcc7de" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls strokeOpacity={0.55} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Metrics diff table */}
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-outline-variant bg-surface-container-high/40">
            <h3 className="font-display font-bold text-on-surface">Metrics Δ</h3>
          </div>
          <table className="w-full font-mono text-xs text-left">
            <thead>
              <tr className="bg-surface-container-highest/20">
                <th className="p-5 text-[10px] text-on-surface-variant uppercase tracking-[0.2em] font-bold border-b border-outline-variant">Metric</th>
                <th className="p-5 text-primary font-bold border-b border-outline-variant">Session A</th>
                <th className="p-5 text-secondary font-bold border-b border-outline-variant">Session B</th>
                <th className="p-5 text-[10px] text-on-surface-variant uppercase tracking-[0.2em] font-bold border-b border-outline-variant text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {diffRows.map((row, i) => (
                <tr key={i} className="border-b border-outline-variant/30 hover:bg-surface-container-high/20 transition-colors">
                  <td className="p-5 text-on-surface font-semibold">{row.label}</td>
                  <td className="p-5 text-primary font-bold">{row.a}</td>
                  <td className="p-5 text-secondary font-bold">{row.b}</td>
                  <td className="p-5 text-right font-bold">
                    {row.delta !== null ? (
                      <span className={row.delta > 0 ? 'text-primary' : row.delta < 0 ? 'text-error' : 'text-on-surface-variant'}>
                        {row.delta > 0 ? '+' : ''}{row.delta}{row.unit ? ` ${row.unit}` : ''}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────
  if (selectedSession) {
    const N = Math.min(300, selectedSession.kneeAngles.left.length);
    const leftSampled  = sampleToN(selectedSession.kneeAngles.left,  N);
    const rightSampled = sampleToN(selectedSession.kneeAngles.right, N);
    const chartData = leftSampled.map((knee, i) => ({
      time: i,
      knee,
      right: rightSampled[i],
    }));

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
              <p className="text-on-surface-variant font-mono text-[10px] uppercase tracking-widest">{selectedSession.label} // {fmtDate(selectedSession.date)}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => generateSessionPDF(selectedSession, getProfile(), getAgeGroup())}
              className="flex items-center gap-2 px-5 py-3 bg-primary/10 border border-primary/30 rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:bg-primary/20 transition-all text-primary"
            >
              <Download className="w-4 h-4" />
              Download_PDF
            </button>
            <button
              onClick={() => setSelectedSession(null)}
              className="px-6 py-3 bg-surface-container-high border border-outline-variant rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:border-primary/50 transition-all text-primary"
            >
              Close_Detail_View
            </button>
          </div>
        </motion.div>

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
                  <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest opacity-60">
                    {selectedSession.frameCount} frames captured
                  </span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 180]} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                        labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                        formatter={(v: number, name: string) => [`${v.toFixed(1)}°`, name === 'knee' ? 'Left Knee' : 'Right Knee']}
                      />
                      <Area type="monotone" dataKey="knee" stroke="#57f1db" fill="#57f1db" fillOpacity={0.1} strokeWidth={3} />
                      <Area type="monotone" dataKey="right" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.05} strokeWidth={2} />
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
                  <span className="text-xl font-display font-bold">{fmtDuration(selectedSession.duration)}</span>
                </div>
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                  <span className="block font-mono text-[9px] text-on-surface-variant uppercase mb-1">Frames Analyzed</span>
                  <span className="text-xl font-display font-bold">{selectedSession.frameCount.toLocaleString()}</span>
                </div>
                {selectedSession.stride?.cadence ? (
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                    <span className="block font-mono text-[9px] text-on-surface-variant uppercase mb-1">Cadence</span>
                    <span className="text-xl font-display font-bold text-primary">{selectedSession.stride.cadence} <span className="text-sm font-mono text-on-surface-variant">spm</span></span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Session list ───────────────────────────────────────────────────────
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
              Analysis Index
            </motion.h1>
            <button
              onClick={onViewProfile}
              className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-primary/20 transition-all"
            >
              Manage_Identity
            </button>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-3 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
            <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> SESSIONS: {sessions.length}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={toggleCompare}
            className={cn(
              'flex items-center gap-3 px-6 py-3 border font-mono text-xs font-bold rounded-xl transition-all active:scale-95',
              compareMode
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-surface-container-high border-outline-variant text-on-surface-variant hover:border-primary/50 hover:text-primary'
            )}
          >
            <TrendingUp className="w-4 h-4" />
            {compareMode ? 'EXIT_COMPARE' : 'COMPARE_SESSIONS'}
          </button>
          {sessions.length > 0 && (
            confirmDeleteAll ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAll}
                  className="flex items-center gap-2 px-6 py-3 bg-error/10 border border-error/40 text-error rounded-xl font-mono text-xs font-bold uppercase tracking-widest hover:bg-error/20 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" /> Confirm Delete All
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="px-4 py-3 bg-surface-container-high border border-outline-variant rounded-xl font-mono text-xs font-bold text-on-surface-variant hover:border-primary/50 transition-all active:scale-95"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="flex items-center gap-3 px-6 py-3 bg-surface-container-high border border-outline-variant text-on-surface-variant hover:border-error/50 hover:text-error font-mono text-xs font-bold rounded-xl transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                DELETE_ALL
              </button>
            )
          )}
        </div>
      </section>

      {/* Sessions Index List */}
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.3em] font-bold">Historical Capture Timeline</h3>
          {compareMode && (
            <p className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
              {!compareA ? 'Select Session A' : !compareB ? `A selected — pick Session B` : 'Both selected — view comparison'}
            </p>
          )}
        </div>

        {/* Active compare indicator — comparison view renders automatically once both A and B are set */}
        <AnimatePresence>
          {compareMode && compareA && compareB && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center p-5 bg-primary/5 border border-primary/30 rounded-2xl gap-3"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
                {compareA.label} vs {compareB.label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {sessions.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center border border-outline-variant border-dashed rounded-2xl gap-4">
            <Radio className="w-8 h-8 text-outline-variant" />
            <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-[0.25em] text-center">
              No sessions recorded — complete an analysis to begin building history
            </p>
          </div>
        )}

        {sessions.map((session, i) => {
          const isA = compareA?.id === session.id;
          const isB = compareB?.id === session.id;
          const isSelected = isA || isB;

          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => compareMode ? handleCompareClick(session) : setSelectedSession(session)}
              className={cn(
                'group glass-panel p-6 rounded-2xl border transition-all cursor-pointer flex justify-between items-center',
                isSelected
                  ? isA
                    ? 'border-primary bg-primary/5 shadow-[0_0_20px_rgba(87,241,219,0.1)]'
                    : 'border-secondary bg-secondary/5'
                  : 'border-outline-variant hover:border-primary'
              )}
            >
              <div className="flex items-center gap-8">
                <div className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center font-mono text-xs border transition-all',
                  isA
                    ? 'bg-primary text-on-primary border-primary font-bold text-sm'
                    : isB
                    ? 'bg-secondary/20 text-secondary border-secondary font-bold text-sm'
                    : 'bg-surface-container-high text-primary border-outline-variant group-hover:scale-105'
                )}>
                  {isA ? 'A' : isB ? 'B' : String(i + 1).padStart(3, '0')}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{session.label}</h4>
                  <div className="flex items-center gap-4 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {fmtDate(session.date)}</span>
                    <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> {fmtDuration(session.duration)}</span>
                    {session.stride?.cadence ? (
                      <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-primary" /> {session.stride.cadence} spm</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {confirmDeleteId === session.id ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="px-3 py-1.5 bg-error/10 border border-error/40 text-error rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-error/20 transition-all"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 bg-surface-container-high border border-outline-variant rounded-lg font-mono text-[10px] font-bold text-on-surface-variant hover:border-primary/50 transition-all"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                    className="p-2 rounded-lg text-on-surface-variant/30 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="text-right">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-tighter opacity-60 mb-1 font-bold">Score</p>
                  <p className="text-2xl font-display font-bold text-on-surface">{session.score}%</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
