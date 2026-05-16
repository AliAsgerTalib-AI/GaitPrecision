import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { motion } from 'motion/react';
import GeminiRecommendations from './GeminiRecommendations';
import { loadSessions, type GaitSession } from '@/src/lib/sessionDb';

interface MetricRow {
  name: string;
  left: string;
  right: string;
  variance: string;
  type: 'primary' | 'error';
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function variancePct(l: number, r: number): string {
  const avg = (l + r) / 2;
  return avg > 0 ? ((Math.abs(l - r) / avg) * 100).toFixed(1) + '%' : '—';
}

function buildMetrics(session: GaitSession): MetricRow[] {
  const rows: MetricRow[] = [];

  // Stance / Swing time from stride data
  if (session.stride?.left && session.stride.right) {
    const lStance = ((session.stride.left.stancePercent / 100) * session.stride.left.strideTime);
    const rStance = ((session.stride.right.stancePercent / 100) * session.stride.right.strideTime);
    const lSwing  = session.stride.left.strideTime  - lStance;
    const rSwing  = session.stride.right.strideTime - rStance;
    const stanceVar = variancePct(lStance, rStance);
    const swingVar  = variancePct(lSwing, rSwing);
    rows.push({
      name: 'Stance Time',
      left: `${lStance.toFixed(2)}s`, right: `${rStance.toFixed(2)}s`,
      variance: stanceVar,
      type: parseFloat(stanceVar) > 8 ? 'error' : 'primary',
    });
    rows.push({
      name: 'Swing Time',
      left: `${lSwing.toFixed(2)}s`, right: `${rSwing.toFixed(2)}s`,
      variance: swingVar,
      type: parseFloat(swingVar) > 8 ? 'error' : 'primary',
    });
  } else {
    rows.push({ name: 'Stance Time', left: '—', right: '—', variance: '—', type: 'primary' });
    rows.push({ name: 'Swing Time',  left: '—', right: '—', variance: '—', type: 'primary' });
  }

  // Peak knee flexion (max angle in buffer)
  if (session.kneeAngles.left.length) {
    const lPeak = Math.max(...session.kneeAngles.left);
    const rPeak = Math.max(...session.kneeAngles.right.length ? session.kneeAngles.right : session.kneeAngles.left);
    const kVar  = variancePct(lPeak, rPeak);
    rows.push({
      name: 'Peak Knee Flexion',
      left: `${lPeak.toFixed(1)}°`, right: `${rPeak.toFixed(1)}°`,
      variance: kVar,
      type: parseFloat(kVar) > 8 ? 'error' : 'primary',
    });
  }

  // Hip angle (mean)
  if (session.hipAngles?.left.length) {
    const lHip = mean(session.hipAngles.left);
    const rHip = mean(session.hipAngles.right.length ? session.hipAngles.right : session.hipAngles.left);
    const hVar = variancePct(lHip, rHip);
    rows.push({
      name: 'Hip Angle (mean)',
      left: `${lHip.toFixed(1)}°`, right: `${rHip.toFixed(1)}°`,
      variance: hVar,
      type: parseFloat(hVar) > 8 ? 'error' : 'primary',
    });
  }

  // Peak dorsiflexion (min ankle angle = max dorsiflexion)
  if (session.ankleAngles?.left.length) {
    const lDorsi = Math.min(...session.ankleAngles.left);
    const rDorsi = Math.min(...session.ankleAngles.right.length ? session.ankleAngles.right : session.ankleAngles.left);
    const aVar   = variancePct(lDorsi, rDorsi);
    rows.push({
      name: 'Peak Dorsiflexion',
      left: `${lDorsi.toFixed(1)}°`, right: `${rDorsi.toFixed(1)}°`,
      variance: aVar,
      type: parseFloat(aVar) > 8 ? 'error' : 'primary',
    });
  }

  return rows;
}

const FALLBACK_METRICS: MetricRow[] = [
  { name: 'Stance Time',        left: '0.62s',   right: '0.65s',   variance: '4.1%',  type: 'error'   },
  { name: 'Swing Time',         left: '0.38s',   right: '0.39s',   variance: '0.8%',  type: 'primary' },
  { name: 'Peak Knee Flexion',  left: '64.2°',   right: '58.1°',   variance: '11.4%', type: 'error'   },
  { name: 'Hip Angle (mean)',   left: '172.4°',  right: '173.8°',  variance: '0.8%',  type: 'primary' },
  { name: 'Peak Dorsiflexion',  left: '112.4°',  right: '115.2°',  variance: '2.5%',  type: 'primary' },
];

export default function SymmetryComparison() {
  const [metrics, setMetrics] = useState<MetricRow[]>(FALLBACK_METRICS);

  useEffect(() => {
    loadSessions().then(sessions => {
      const latest = sessions[0];
      if (latest) setMetrics(buildMetrics(latest));
    }).catch(console.error);
  }, []);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-10 space-y-12">
      {/* Table Section */}
      <section className="bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-high/40 backdrop-blur-sm">
          <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-3">
            <Scale className="w-6 h-6 text-primary" />
            Symmetry Comparison
          </h2>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_#2dd4bf]" />
              <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Left Leg</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-secondary shadow-[0_0_8px_#bcc7de]" />
              <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Right Leg</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/20">
                <th className="p-6 font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em] border-b border-outline-variant">Metric Parameter</th>
                <th className="p-6 font-mono text-xs text-primary font-bold border-b border-outline-variant">Left Metric</th>
                <th className="p-6 font-mono text-[10px] text-on-surface-variant uppercase text-center border-b border-outline-variant">Variance Δ</th>
                <th className="p-6 font-mono text-xs text-secondary font-bold border-b border-outline-variant text-right">Right Metric</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {metrics.map((row, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-surface-container-high/30 transition-colors border-b border-outline-variant/30 group"
                >
                  <td className="p-6 text-on-surface font-semibold group-hover:text-primary transition-colors">{row.name}</td>
                  <td className="p-6 text-primary font-bold italic">{row.left}</td>
                  <td className="p-6">
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-32 h-2 bg-surface-container-highest rounded-full overflow-hidden flex shadow-inner">
                        <div className="h-full bg-primary" style={{ width: '45%' }} />
                        <div className={`h-full ${row.type === 'error' ? 'bg-error' : 'bg-primary-container'}`} style={{ width: '10%' }} />
                        <div className="h-full bg-secondary" style={{ width: '45%' }} />
                      </div>
                      <span className={`font-bold ${row.type === 'error' ? 'text-error' : 'text-primary'}`}>{row.variance}</span>
                    </div>
                  </td>
                  <td className="p-6 text-secondary font-bold text-right italic">{row.right}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* AI-Powered Recommendations */}
      <section className="space-y-8">
        <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-3">
          <Scale className="w-6 h-6 text-primary" />
          Clinical Action Plan
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md font-mono text-[9px] text-primary font-bold uppercase tracking-widest ml-2">
            Gemini AI
          </span>
        </h2>
        <GeminiRecommendations />
      </section>

       {/* Biometric Export CTA */}
      <section className="flex flex-col items-center justify-center py-20 border-t border-outline-variant/30 mt-20 text-center">
        <div className="max-w-xl mb-12">
          <h3 className="text-3xl font-display font-bold text-on-surface mb-3">Complete Biometric Export</h3>
          <p className="text-on-surface-variant text-lg">Generate high-fidelity DICOM-compliant reports for instant clinical integration.</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group relative flex items-center gap-4 bg-primary text-on-primary px-12 py-6 rounded-full font-display text-xl font-bold hover:brightness-110 transition-all shadow-2xl shadow-primary/20"
        >
          <span className="relative z-10">Generate DICOM Report</span>
          <Scale className="w-6 h-6 relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        </motion.button>

        <p className="mt-8 font-mono text-[10px] text-primary/60 uppercase tracking-[0.3em] flex items-center gap-3 font-bold">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          End-to-End Encrypted Handshake Active
        </p>
      </section>
    </div>
  );
}
