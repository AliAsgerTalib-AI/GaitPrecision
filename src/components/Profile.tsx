import { motion, AnimatePresence } from 'motion/react';
import {
  User, History, Settings, Save, Activity, CheckCircle2, Download, X, FileJson, Upload, Trash2, Eye,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getProfile, saveProfile, type UserProfile } from '@/src/lib/userProfile';
import { loadSessions, clearAllSessions, deleteSession, type GaitSession } from '@/src/lib/sessionDb';
import { fmtDate, fmtDuration, cn, mean } from '@/src/lib/utils';
import { useAccessibility } from '@/src/contexts/AccessibilityContext';

const EMPTY: UserProfile = { name: '', age: '', gender: '', heightCm: '', weightKg: '', notes: '' };

function downloadSessionReport(session: GaitSession, profile: UserProfile | null) {
  const leftAngles  = session.kneeAngles.left;
  const rightAngles = session.kneeAngles.right;
  const report = {
    reportType: 'GaitPrecision Analysis Report',
    generatedAt: new Date().toISOString(),
    profile: profile ?? {},
    session: {
      id: session.id,
      label: session.label,
      date: new Date(session.date).toISOString(),
      durationSeconds: session.duration,
      frameCount: session.frameCount,
      symmetryScore: session.score,
      cadenceSpm: session.stride?.cadence ?? null,
      leftLeg: {
        stancePercent: session.stride?.left?.stancePercent ?? null,
        swingPercent:  session.stride?.left?.swingPercent  ?? null,
        strideTime:    session.stride?.left?.strideTime    ?? null,
        kneeAngle: leftAngles.length ? {
          min:  Math.min(...leftAngles).toFixed(1),
          max:  Math.max(...leftAngles).toFixed(1),
          mean: mean(leftAngles).toFixed(1),
        } : null,
      },
      rightLeg: {
        stancePercent: session.stride?.right?.stancePercent ?? null,
        swingPercent:  session.stride?.right?.swingPercent  ?? null,
        strideTime:    session.stride?.right?.strideTime    ?? null,
        kneeAngle: rightAngles.length ? {
          min:  Math.min(...rightAngles).toFixed(1),
          max:  Math.max(...rightAngles).toFixed(1),
          mean: mean(rightAngles).toFixed(1),
        } : null,
      },
    },
    note: 'Knee angles derived from MediaPipe PoseLandmarker GPU inference. Values are indicative; not a clinical diagnosis.',
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gait-report-${session.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Profile() {
  const { fontScale, setFontScale, highContrast, toggleHighContrast } = useAccessibility();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft]     = useState<UserProfile>(EMPTY);
  const [sessions, setSessions] = useState<GaitSession[]>([]);
  const [savedBanner, setSavedBanner] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = getProfile();
    if (stored) { setProfile(stored); setDraft(stored); }
    else setIsEditing(true);
    loadSessions().then(setSessions).catch(console.error);
  }, []);

  function handleSave() {
    saveProfile(draft);
    setProfile(draft);
    setIsEditing(false);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  }

  function handleCancel() {
    setDraft(profile ?? EMPTY);
    setIsEditing(false);
  }

  async function handleClearAll() {
    await clearAllSessions();
    setSessions([]);
    setConfirmClear(false);
  }

  async function handleDeleteSession(id: string) {
    await deleteSession(id);
    setSessions(s => s.filter(x => x.id !== id));
    setConfirmDeleteId(null);
  }

  function handleExportProfile() {
    const data = { profile, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gait-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        // Accept either { profile: {...} } wrapper or a raw UserProfile object
        const imported: unknown = parsed?.profile ?? parsed;
        const keys: (keyof UserProfile)[] = ['name', 'age', 'gender', 'heightCm', 'weightKg', 'notes'];
        if (typeof imported !== 'object' || imported === null || !('name' in imported)) {
          throw new Error('Missing required field: name');
        }
        const safe: UserProfile = { ...EMPTY };
        for (const k of keys) {
          if (k in (imported as object)) safe[k] = String((imported as Record<string, unknown>)[k] ?? '');
        }
        setDraft(safe);
        setImportError(null);
        setIsEditing(true);
      } catch (err) {
        setImportError((err as Error).message ?? 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported if needed
    e.target.value = '';
  }

  const field = (
    label: string,
    key: keyof UserProfile,
    opts?: { type?: string; placeholder?: string; as?: 'textarea' | 'select'; options?: string[] }
  ) => (
    <div className="space-y-1.5">
      <label className="font-mono text-[9px] text-on-surface-variant uppercase font-bold tracking-[0.15em]">{label}</label>
      {opts?.as === 'textarea' ? (
        <textarea
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
          rows={3}
          placeholder={opts.placeholder}
          className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors resize-none"
        />
      ) : opts?.as === 'select' ? (
        <select
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
          className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="">Select…</option>
          {opts.options!.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={opts?.type ?? 'text'}
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
          placeholder={opts?.placeholder}
          className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 transition-colors"
        />
      )}
    </div>
  );

  return (
    <div className="pt-24 pb-12 px-6 max-w-[1440px] mx-auto min-h-screen">
      {/* Hidden file input for JSON import */}
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Saved banner */}
      <AnimatePresence>
        {savedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-on-primary px-6 py-3 rounded-full font-mono text-xs font-bold shadow-2xl shadow-primary/30"
          >
            <CheckCircle2 className="w-4 h-4" /> Profile saved to local storage
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importError && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-error text-on-error px-6 py-3 rounded-full font-mono text-xs font-bold shadow-2xl"
          >
            Import failed: {importError}
            <button onClick={() => setImportError(null)} className="ml-2 opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left: Identity / Edit Form */}
        <aside className="lg:col-span-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface-container rounded-3xl border border-outline-variant p-8 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <User className="w-48 h-48" />
            </div>

            <AnimatePresence mode="wait">
              {isEditing ? (
                /* ── Edit form ── */
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="text-lg font-display font-bold text-on-surface mb-6 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />
                    {profile ? 'Edit Profile' : 'Create Profile'}
                  </h3>
                  <div className="space-y-4">
                    {field('Full Name', 'name', { placeholder: 'Your name' })}
                    {field('Age', 'age', { type: 'number', placeholder: 'e.g. 42' })}
                    {field('Gender', 'gender', {
                      as: 'select',
                      options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
                    })}
                    <div className="grid grid-cols-2 gap-3">
                      {field('Height (cm)', 'heightCm', { type: 'number', placeholder: '175' })}
                      {field('Weight (kg)', 'weightKg', { type: 'number', placeholder: '70' })}
                    </div>
                    {field('Notes', 'notes', { as: 'textarea', placeholder: 'Medical notes, conditions, etc.' })}
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleSave}
                      disabled={!draft.name.trim()}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Save className="w-3.5 h-3.5" /> Save Profile
                    </button>
                    {profile && (
                      <button
                        onClick={handleCancel}
                        className="p-3 bg-surface-container-high border border-outline-variant rounded-xl hover:bg-surface-variant transition-colors"
                      >
                        <X className="w-4 h-4 text-on-surface-variant" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                /* ── View card ── */
                <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary p-1 mb-6">
                      <div className="w-full h-full rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                        <User className="w-10 h-10" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-display font-bold text-on-surface mb-1">{profile?.name || '—'}</h2>
                    <p className="font-mono text-[10px] text-primary/70 uppercase tracking-[0.2em] font-bold">
                      {profile?.gender || ''}
                    </p>

                    <div className="mt-8 w-full space-y-4 text-left border-t border-outline-variant pt-8">
                      {[
                        { label: 'Age',    value: profile?.age    ? `${profile.age} yrs`  : '—' },
                        { label: 'Height', value: profile?.heightCm ? `${profile.heightCm} cm` : '—' },
                        { label: 'Weight', value: profile?.weightKg ? `${profile.weightKg} kg` : '—' },
                        { label: 'Notes',  value: profile?.notes  || '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="space-y-1">
                          <p className="font-mono text-[9px] text-on-surface-variant uppercase font-bold opacity-60">{label}</p>
                          <p className="font-mono text-sm text-on-surface break-words">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 w-full space-y-3">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="w-full flex items-center justify-center gap-2 bg-surface-container-high border border-outline-variant py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface-variant transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" /> Edit Profile
                      </button>
                      <button
                        onClick={handleExportProfile}
                        className="w-full flex items-center justify-center gap-2 bg-primary/10 border border-primary/20 py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download as JSON
                      </button>
                      <button
                        onClick={() => importRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 bg-surface-container-high border border-outline-variant py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface-variant transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" /> Import from JSON
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Data notice */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant p-5 text-center space-y-1">
            <p className="font-mono text-[9px] text-primary uppercase tracking-widest font-bold">On-Device Storage</p>
            <p className="text-xs text-on-surface-variant opacity-60">Profile is stored in your browser's local storage. No data leaves this device.</p>
          </div>

          {/* Accessibility panel */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant p-5 space-y-5">
            <p className="font-mono text-[9px] text-primary uppercase tracking-widest font-bold flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" /> Display
            </p>

            {/* Font size */}
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Text size</p>
              <div className="flex gap-2">
                {(['normal', 'large', 'xl'] as const).map((scale, i) => (
                  <button
                    key={scale}
                    onClick={() => setFontScale(scale)}
                    aria-pressed={fontScale === scale}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg border font-display font-bold transition-all',
                      ['text-sm', 'text-base', 'text-lg'][i],
                      fontScale === scale
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-high border-outline-variant text-on-surface-variant hover:border-primary/40'
                    )}
                  >
                    A
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-on-surface-variant/60 font-sans">
                {fontScale === 'normal' ? 'Standard' : fontScale === 'large' ? 'Large — easier to read' : 'Extra large'}
              </p>
            </div>

            {/* High contrast */}
            <div className="flex items-center justify-between pt-3 border-t border-outline-variant/40">
              <div className="space-y-0.5">
                <p className="font-mono text-[10px] text-on-surface uppercase tracking-widest font-bold">High contrast</p>
                <p className="text-[10px] text-on-surface-variant/60 font-sans">Brighter text and borders</p>
              </div>
              <button
                onClick={toggleHighContrast}
                aria-pressed={highContrast}
                className={cn(
                  'w-12 h-6 rounded-full p-1 transition-colors relative',
                  highContrast ? 'bg-primary' : 'bg-outline-variant'
                )}
              >
                <div className={cn(
                  'w-4 h-4 bg-surface rounded-full transition-transform shadow-sm',
                  highContrast ? 'translate-x-6' : 'translate-x-0'
                )} />
              </button>
            </div>
          </div>
        </aside>

        {/* Right: Real session history */}
        <main className="lg:col-span-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container rounded-3xl border border-outline-variant p-8 shadow-xl"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-display font-bold text-on-surface tracking-tight mb-2">Analysis History</h2>
                <p className="text-on-surface-variant text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> All sessions stored locally in IndexedDB.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl text-primary font-mono text-[11px] font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4" /> {sessions.length} RECORD{sessions.length !== 1 ? 'S' : ''}
                </div>
                {sessions.length > 0 && (
                  confirmClear ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-error uppercase tracking-widest font-bold">Delete all?</span>
                      <button
                        onClick={handleClearAll}
                        className="px-3 py-1.5 bg-error/10 border border-error/40 rounded-xl font-mono text-[10px] font-bold text-error uppercase tracking-widest hover:bg-error/20 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="p-1.5 bg-surface-container-high border border-outline-variant rounded-xl hover:bg-surface-variant transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-on-surface-variant" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      title="Delete all history"
                      className="p-2 bg-surface-container-high border border-outline-variant rounded-xl hover:border-error/50 hover:text-error text-on-surface-variant transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <History className="w-10 h-10 text-on-surface-variant opacity-30" />
                <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-widest font-bold opacity-50">No analysis records yet</p>
                <p className="text-sm text-on-surface-variant opacity-40">Complete a gait analysis session to see records here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-surface-container-low border border-outline-variant rounded-2xl p-6 hover:border-primary/40 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-5 min-w-0">
                        <div className="w-12 h-12 bg-surface-container-high rounded-xl flex items-center justify-center font-mono text-[10px] text-primary border border-outline-variant shrink-0 group-hover:scale-105 transition-transform">
                          {session.score}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-base font-bold text-on-surface mb-1 truncate group-hover:text-primary transition-colors">{session.label}</h4>
                          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                            <span>{fmtDate(session.date)}</span>
                            <span className="w-1 h-1 bg-outline-variant rounded-full" />
                            <span>{fmtDuration(session.duration)}</span>
                            {session.stride?.cadence && (
                              <>
                                <span className="w-1 h-1 bg-outline-variant rounded-full" />
                                <span>{session.stride.cadence} spm</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => downloadSessionReport(session, profile)}
                          title="Download JSON report"
                          className="p-2.5 bg-surface-container-high border border-outline-variant rounded-xl hover:border-primary/50 hover:text-primary text-on-surface-variant transition-all"
                        >
                          <FileJson className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === session.id ? (
                          <>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="px-3 py-2 bg-error/10 border border-error/40 rounded-xl font-mono text-[10px] font-bold text-error uppercase tracking-widest hover:bg-error/20 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-2.5 bg-surface-container-high border border-outline-variant rounded-xl hover:bg-surface-variant transition-colors"
                            >
                              <X className="w-4 h-4 text-on-surface-variant" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(session.id)}
                            title="Delete this record"
                            className="p-2.5 bg-surface-container-high border border-outline-variant rounded-xl hover:border-error/50 hover:text-error text-on-surface-variant transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Export all */}
          {sessions.length > 0 && (
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify({ sessions, profile, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `gait-all-sessions-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full flex items-center justify-center gap-3 py-5 border border-outline-variant border-dashed rounded-2xl font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.3em] hover:bg-surface-variant hover:border-primary/40 hover:text-primary transition-all"
            >
              <Download className="w-4 h-4" /> Export All Sessions as JSON
            </button>
          )}
        </main>

      </div>
    </div>
  );
}
