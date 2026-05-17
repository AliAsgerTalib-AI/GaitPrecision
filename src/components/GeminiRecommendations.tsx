import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Activity, Footprints, CheckCircle2, Sparkles, AlertCircle, RefreshCcw } from 'lucide-react';
import { loadSessions, type GaitSession } from '@/src/lib/sessionDb';
import { mean } from '@/src/lib/utils';

interface Rec {
  title: string;
  description: string;
  actions: string[];
}

const CARD_ICONS = [Zap, Activity, Footprints] as const;

function buildPrompt(session: GaitSession): string {
  const L = session.kneeAngles.left;
  const R = session.kneeAngles.right;
  const lMean = mean(L), rMean = mean(R);
  const asym = Math.abs(lMean - rMean).toFixed(1);
  const lROM = (Math.max(...L) - Math.min(...L)).toFixed(1);
  const rROM = (Math.max(...R) - Math.min(...R)).toFixed(1);

  return `You are a clinical gait biomechanics specialist. Analyze this patient's data and give 3 targeted, actionable recommendations.

Patient data:
- Left knee mean flexion: ${lMean.toFixed(1)}°
- Right knee mean flexion: ${rMean.toFixed(1)}°
- Bilateral asymmetry: ${asym}°
- Left ROM: ${lROM}°, Right ROM: ${rROM}°
- Symmetry score: ${session.score}/100
- Duration: ${session.duration}s, frames analyzed: ${session.frameCount}
- Protocol: ${session.label}

Format — 3 sections separated by a line containing only "---".
Each section is exactly 4 lines (no blank lines within a section):
Line 1: Title (3–5 words)
Line 2: Two clinical sentences that cite the exact measured values above
Line 3: First specific intervention or exercise
Line 4: Second specific intervention or exercise
---
[section 2]
---
[section 3]

Start directly with the first title. No preamble, no trailing text.`;
}

function parseRecs(text: string, complete: boolean): Rec[] {
  const sections = text.split(/\n---\n?/);
  const targets = complete ? sections : sections.slice(0, -1);
  return targets.flatMap(sec => {
    const lines = sec.trim().split('\n').filter(Boolean);
    if (lines.length < 3) return [];
    return [{ title: lines[0], description: lines[1], actions: lines.slice(2, 4) }];
  });
}

type Status = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export default function GeminiRecommendations() {
  const [status, setStatus] = useState<Status>('idle');
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();

    setStreamText('');
    setError('');
    setStatus('loading');

    (async () => {
      const sessions = await loadSessions();
      const session = sessions[0];
      if (!session) { if (!cancelled) setStatus('idle'); return; }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt(session) }),
        signal: abort.signal,
      });

      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      if (!response.body) throw new Error('No response body');

      if (!cancelled) setStatus('streaming');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (cancelled) { reader.cancel(); return; }
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamText(acc);
      }

      if (!cancelled) setStatus('done');
    })().catch(err => {
      if (err.name === 'AbortError') return;
      if (!cancelled) { setError(err?.message ?? 'Request failed'); setStatus('error'); }
    });

    return () => { cancelled = true; abort.abort(); };
  }, [retryKey]);

  /* ── Error ── */
  if (status === 'error') {
    return (
      <div className="p-8 border border-error/30 bg-error/5 rounded-2xl flex items-center gap-6">
        <AlertCircle className="w-8 h-8 text-error shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-xs text-error font-bold uppercase tracking-widest mb-1">Analysis Failed</p>
          <p className="text-on-surface-variant text-sm">{error}</p>
        </div>
        <button
          onClick={() => setRetryKey(k => k + 1)}
          className="flex items-center gap-2 px-4 py-2 bg-surface-container-high border border-outline-variant rounded-lg font-mono text-xs font-bold hover:border-primary/50 transition-colors"
        >
          <RefreshCcw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  /* ── No session yet ── */
  if (status === 'idle') {
    return (
      <div className="py-12 flex items-center justify-center border border-outline-variant border-dashed rounded-2xl">
        <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-[0.25em]">
          Complete an analysis session to generate AI recommendations
        </p>
      </div>
    );
  }

  /* ── Streaming / Done ── */
  const isDone = status === 'done';
  const sections = streamText.split(/\n---\n?/);
  const completedRecs = parseRecs(streamText, isDone);
  const skeletonCount = Math.max(0, 3 - completedRecs.length);
  const activeStream = status === 'streaming' ? (sections.at(-1) ?? '') : '';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

      {/* Completed cards — fade in as each section finishes */}
      <AnimatePresence>
        {completedRecs.map((rec, i) => {
          const Icon = CARD_ICONS[i] ?? Zap;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5 }}
              className="bg-surface-container-low border border-outline-variant p-8 rounded-2xl flex flex-col group hover:border-primary/50 transition-all shadow-xl"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-8 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all shadow-lg">
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-display font-bold mb-4">{rec.title}</h3>
              <p className="text-on-surface-variant mb-8 flex-grow leading-relaxed">{rec.description}</p>
              <div className="space-y-3 mb-6">
                {rec.actions.map((action, j) => (
                  <div key={j} className="flex items-center gap-3 text-xs font-mono font-bold text-on-surface group-hover:text-primary transition-colors">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {action}
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-4 border-t border-outline-variant/30 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary/50" />
                <span className="font-mono text-[9px] text-primary/50 uppercase tracking-widest">Gemini AI</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Skeleton cards — the first one shows the live stream text */}
      {Array.from({ length: skeletonCount }, (_, k) => (
        <div key={`sk-${k}`} className="bg-surface-container-low border border-outline-variant p-8 rounded-2xl flex flex-col shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
          <div className="w-14 h-14 rounded-xl bg-surface-container-high mb-8 animate-pulse" />
          <div className="h-5 bg-surface-container-high rounded-lg w-3/4 mb-4 animate-pulse" />

          {k === 0 && activeStream ? (
            /* Live typewriter preview inside the first pending skeleton */
            <div className="flex-grow overflow-hidden">
              <p className="font-mono text-[10px] text-primary/70 leading-relaxed whitespace-pre-wrap line-clamp-5">
                {activeStream}
              </p>
              <span className="inline-block w-1.5 h-3.5 bg-primary/60 ml-0.5 animate-pulse align-middle" />
            </div>
          ) : (
            <div className="flex-grow space-y-2">
              <div className="h-3 bg-surface-container-high rounded animate-pulse" />
              <div className="h-3 bg-surface-container-high rounded w-5/6 animate-pulse" />
              <div className="h-3 bg-surface-container-high rounded w-4/6 animate-pulse" />
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-primary/30 animate-pulse" />
            <span className="font-mono text-[9px] text-primary/30 uppercase tracking-widest">Gemini AI</span>
          </div>
        </div>
      ))}
    </div>
  );
}
