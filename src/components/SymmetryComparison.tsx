import { Scale, CheckCircle2, ChevronRight, Zap, Footprints, Activity } from 'lucide-react';
import { motion } from 'motion/react';

const metrics = [
  { name: 'Stance Time', left: '0.62s', right: '0.65s', variance: '4.1%', type: 'error' },
  { name: 'Swing Time', left: '0.38s', right: '0.39s', variance: '0.8%', type: 'primary' },
  { name: 'Peak Knee Flexion', left: '64.2°', right: '58.1°', variance: '11.4%', type: 'error' },
  { name: 'Step Length', left: '72.4 cm', right: '74.1 cm', variance: '2.4%', type: 'primary' },
];

export default function SymmetryComparison() {
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
                <tr key={idx} className="hover:bg-surface-container-high/30 transition-colors border-b border-outline-variant/30 group">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actionable Recommendations */}
      <section className="space-y-8">
        <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-primary" />
          Clinical Action Plan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <motion.div whileHover={{ y: -5 }} className="bg-surface-container-low border border-outline-variant p-8 rounded-2xl flex flex-col group hover:border-primary/50 transition-all shadow-xl">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-8 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all shadow-lg">
              <Zap className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-display font-bold mb-4">Mobility Drills</h3>
            <p className="text-on-surface-variant mb-8 flex-grow leading-relaxed">Focus on sagittal plane mechanics. Asymmetric flexion suggests hamstring tension on right posterior chain.</p>
            <div className="space-y-3 mb-10">
              {['Dynamic Hip Opening (3x15)', 'Eccentric Hamstring Loading'].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-mono font-bold text-on-surface group-hover:text-primary transition-colors">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> {item}
                </div>
              ))}
            </div>
            <button className="w-full py-4 bg-surface-container-high border border-outline-variant text-xs font-mono font-bold tracking-widest rounded-xl hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center gap-2 group/btn shadow-md">
              VIEW DEMO VIDEO <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* Card 2 */}
          <motion.div whileHover={{ y: -5 }} className="bg-surface-container-low border border-outline-variant p-8 rounded-2xl flex flex-col group hover:border-primary/50 transition-all shadow-xl">
             <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-8 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all shadow-lg">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-display font-bold mb-4">Cadence Tuning</h3>
            <p className="text-on-surface-variant mb-8 flex-grow leading-relaxed">Current 162 SPM is sub-optimal. Target 170-174 SPM to reduce ground reaction forces by 12%.</p>
            <div className="bg-surface-container-lowest p-5 border border-outline-variant rounded-xl mb-10 shadow-inner">
               <div className="flex justify-between items-end mb-3">
                 <span className="font-mono text-[10px] text-on-surface-variant font-bold uppercase">Target Zone</span>
                 <span className="font-mono text-[10px] text-primary font-bold">172 SPM</span>
               </div>
               <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                 <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-primary shadow-[0_0_8px_#57f1db]" />
               </div>
            </div>
            <button className="w-full py-4 bg-surface-container-high border border-outline-variant text-xs font-mono font-bold tracking-widest rounded-xl hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center gap-2 group/btn shadow-md">
              CONFIG METRONOME <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* Card 3 */}
          <motion.div whileHover={{ y: -5 }} className="bg-surface-container-low border border-outline-variant p-8 rounded-2xl flex flex-col group hover:border-primary/50 transition-all shadow-xl">
             <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-8 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all shadow-lg">
              <Footprints className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-display font-bold mb-4">Footwear Guidance</h3>
            <p className="text-on-surface-variant mb-8 flex-grow leading-relaxed">Mid-stance pronation detected on left. Stability-oriented medical-grade orthotics recommended.</p>
            <div className="flex flex-wrap gap-2 mb-10">
              {['HIGH STABILITY', '6mm DROP', 'NEUTRAL HEEL'].map((tag, i) => (
                <span key={i} className="px-2.5 py-1.5 bg-secondary-container/20 text-on-secondary-container border border-secondary-container/30 font-mono text-[9px] font-bold rounded-lg tracking-wider">
                  {tag}
                </span>
              ))}
            </div>
            <button className="w-full py-4 bg-surface-container-high border border-outline-variant text-xs font-mono font-bold tracking-widest rounded-xl hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center gap-2 group/btn shadow-md">
              COMPARE GEAR <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
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
