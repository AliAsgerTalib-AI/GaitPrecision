import { Settings2, Sliders, Target, ShieldCheck, Info, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import type { GaitConfig } from '@/src/hooks/useGaitAnalyzer';
import { DEFAULT_CONFIG } from '@/src/hooks/useGaitAnalyzer';

interface AnalysisSettingsProps {
  onApply: (config: GaitConfig) => void;
  onReset: () => void;
  onOpenGlossary?: () => void;
}

export default function AnalysisSettings({ onApply, onReset, onOpenGlossary }: AnalysisSettingsProps) {
  const [sensitivity, setSensitivity] = useState(DEFAULT_CONFIG.sensitivity);
  const [ankleThreshold, setAnkleThreshold] = useState(DEFAULT_CONFIG.ankleThreshold);
  const [kneeThreshold, setKneeThreshold] = useState(DEFAULT_CONFIG.kneeThreshold);
  const [autoScale, setAutoScale] = useState(DEFAULT_CONFIG.autoScale);

  return (
    <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant shadow-xl mt-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-primary" />
            Engine Configuration
          </h2>
          <p className="text-on-surface-variant text-sm mt-1 font-sans">Tune biomechanical processing parameters for specific subjects.</p>
        </div>
        <div className="flex items-center gap-3">
          {onOpenGlossary && (
            <button
              onClick={onOpenGlossary}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-high text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all"
            >
              <BookOpen className="w-3 h-3" />
              <span className="font-mono text-[9px] uppercase tracking-widest font-bold">Explain Parameters</span>
            </button>
          )}
          <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="font-mono text-[9px] text-primary uppercase tracking-widest font-bold">Local Config Only</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Detection Sensitivity */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest flex items-center gap-2 font-bold">
                <Sliders className="w-3 h-3 text-primary" /> Stride Sensitivity
              </label>
              <p className="font-sans text-[10px] text-on-surface-variant/60 mt-0.5">How precisely each step is detected</p>
            </div>
            <span className="font-mono text-xs text-primary font-bold">{sensitivity}%</span>
          </div>
          <div className="relative pt-1">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={sensitivity} 
              onChange={(e) => setSensitivity(parseInt(e.target.value))}
              className="w-full h-3 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary" 
            />
            <div className="flex justify-between mt-2 font-mono text-[8px] text-outline uppercase">
              <span>Coarse</span>
              <span>Ultra-Fine</span>
            </div>
          </div>
          <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant flex gap-3">
            <Info className="w-4 h-4 text-on-surface-variant shrink-0" />
            <p className="text-[10px] text-on-surface-variant font-sans leading-relaxed italic">
              Increase if steps are being missed; decrease if false steps are appearing.
            </p>
          </div>
        </div>

        {/* Angle Thresholds */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest flex items-center gap-2 font-bold">
                <Target className="w-3 h-3 text-secondary" /> Ankle Trigger (°)
              </label>
              <p className="font-sans text-[10px] text-on-surface-variant/60 mt-0.5">Foot angle that marks a heel strike</p>
            </div>
            <span className="font-mono text-xs text-secondary font-bold">{ankleThreshold}°</span>
          </div>
          <div className="relative pt-1">
            <input 
              type="range" 
              min="5" 
              max="45" 
              value={ankleThreshold} 
              onChange={(e) => setAnkleThreshold(parseInt(e.target.value))}
              className="w-full h-3 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary" 
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest flex items-center gap-2 font-bold">
                <Target className="w-3 h-3 text-primary" /> Knee Lockout (°)
              </label>
              <p className="font-sans text-[10px] text-on-surface-variant/60 mt-0.5">Angle at which the knee is considered fully straight</p>
            </div>
            <span className="font-mono text-xs text-primary font-bold">{kneeThreshold}°</span>
          </div>
          <div className="relative pt-1">
            <input 
              type="range" 
              min="0" 
              max="180" 
              value={kneeThreshold} 
              onChange={(e) => setKneeThreshold(parseInt(e.target.value))}
              className="w-full h-3 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary" 
            />
          </div>
        </div>

        {/* Binary Toggles & System State */}
        <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="font-mono text-[10px] text-on-surface font-bold uppercase tracking-widest">Auto-Scale Skeleton</span>
              <p className="text-[9px] text-on-surface-variant font-sans">Dynamic normalization per frame</p>
            </div>
            <button 
              onClick={() => setAutoScale(!autoScale)}
              className={cn(
                "w-12 h-6 rounded-full p-1 transition-colors relative",
                autoScale ? "bg-primary" : "bg-outline-variant"
              )}
            >
              <div className={cn(
                "w-4 h-4 bg-surface rounded-full transition-transform shadow-sm",
                autoScale ? "translate-x-6" : "translate-x-0"
              )} />
            </button>
          </div>

          <div className="pt-4 border-t border-outline-variant/30 flex flex-col gap-3">
             <button
               onClick={() => onApply({ sensitivity, kneeThreshold, ankleThreshold, autoScale })}
               className="w-full py-3 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/10"
             >
               Apply_Parameters
             </button>
             <button
               onClick={() => {
                 setSensitivity(DEFAULT_CONFIG.sensitivity);
                 setKneeThreshold(DEFAULT_CONFIG.kneeThreshold);
                 setAnkleThreshold(DEFAULT_CONFIG.ankleThreshold);
                 setAutoScale(DEFAULT_CONFIG.autoScale);
                 onReset();
               }}
               className="w-full py-2 bg-surface-container-high text-on-surface-variant font-mono text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg border border-outline-variant hover:bg-outline-variant transition-colors"
             >
               Reset_Defaults
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
