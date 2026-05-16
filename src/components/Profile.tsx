import { motion } from 'motion/react';
import { User, Shield, History, Calendar, ExternalLink, Settings, LogOut, Activity, ChevronRight, Save } from 'lucide-react';
import { useState } from 'react';

interface AnalysisRecord {
  id: string;
  date: string;
  type: string;
  score: number;
  status: 'Critical' | 'Stable' | 'Improved';
}

const PAST_RECORDS: AnalysisRecord[] = [
  { id: 'ANL-9042', date: '2026-05-12', type: 'Asymmetry Run', score: 84, status: 'Stable' },
  { id: 'ANL-8821', date: '2026-04-28', type: 'Gait Efficiency', score: 91, status: 'Improved' },
  { id: 'ANL-8503', date: '2026-04-15', type: 'Load Distribution', score: 68, status: 'Critical' },
];

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: 'Dr. Sarah Jenkins',
    id: 'PX-2049-SJ',
    email: 'jenkins.s@clinical-node.io',
    specialization: 'Biomechanical Engineering',
    clearance: 'Level-4 Senior Analyst'
  });

  return (
    <div className="pt-24 pb-12 px-6 max-w-[1440px] mx-auto min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: User Identity Column */}
        <aside className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface-container rounded-3xl border border-outline-variant p-8 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <User className="w-48 h-48" />
            </div>

            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary p-1 mb-6">
                <div className="w-full h-full rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                  <User className="w-10 h-10" />
                </div>
              </div>
              <h2 className="text-2xl font-display font-bold text-on-surface mb-1">{profile.name}</h2>
              <p className="font-mono text-[10px] text-primary uppercase tracking-[0.2em] font-bold">{profile.clearance}</p>
              
              <div className="mt-8 w-full space-y-4 text-left border-t border-outline-variant pt-8">
                <div className="space-y-1">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase font-bold opacity-60">System ID</p>
                  <p className="font-mono text-sm text-on-surface">{profile.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase font-bold opacity-60">Auth Network</p>
                  <p className="font-mono text-sm text-on-surface">{profile.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-mono text-[9px] text-on-surface-variant uppercase font-bold opacity-60">Department</p>
                  <p className="font-mono text-sm text-on-surface">{profile.specialization}</p>
                </div>
              </div>

              <div className="mt-8 flex gap-3 w-full">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex-1 bg-surface-container-high border border-outline-variant py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
                >
                  {isEditing ? <Save className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                  {isEditing ? 'Sync_Update' : 'Edit_Identity'}
                </button>
                <button className="p-3 bg-error/10 border border-error/20 text-error rounded-xl hover:bg-error/20 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>

          <div className="bg-surface-container rounded-3xl border border-outline-variant p-8 shadow-xl">
            <h3 className="text-sm font-mono font-bold text-on-surface uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Security Protocols
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant/30">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase">Biometric Auth</span>
                <span className="text-[10px] font-bold text-primary font-mono lowercase">verified</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 opacity-50">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase">Remote Access</span>
                <span className="text-[10px] font-bold text-on-surface-variant font-mono lowercase">restricted</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: Records Timeline Column */}
        <main className="lg:col-span-8 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container rounded-3xl border border-outline-variant p-8 shadow-xl h-full"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-display font-bold text-on-surface tracking-tight mb-2">Analysis Archival</h2>
                <p className="text-on-surface-variant text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> Retrieve historical session logs and diagnostic telemetry.
                </p>
              </div>
              <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl text-primary font-mono text-[11px] font-bold flex items-center gap-2">
                <Activity className="w-4 h-4" /> {PAST_RECORDS.length} RECORDS FOUND
              </div>
            </div>

            <div className="space-y-4">
              {PAST_RECORDS.map((record, index) => (
                <motion.div 
                  key={record.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative bg-surface-container-low border border-outline-variant rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-primary/5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-surface-container-high rounded-xl flex items-center justify-center font-mono text-[10px] text-primary border border-outline-variant group-hover:scale-110 transition-transform">
                        {record.id.split('-')[1]}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{record.type}</h4>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-[10px] text-on-surface-variant flex items-center gap-1.5 font-bold uppercase tracking-widest">
                            <Calendar className="w-3 h-3" /> {record.date}
                          </span>
                          <span className="w-1 h-1 bg-outline-variant rounded-full" />
                          <span className="font-mono text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-1.5">
                            ID: {record.id}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="font-mono text-[9px] text-on-surface-variant uppercase font-bold opacity-60 mb-1">Health Score</p>
                        <p className="text-2xl font-display font-bold text-on-surface">{record.score}%</p>
                      </div>
                      <div className={`px-4 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest border ${
                        record.status === 'Improved' ? 'bg-primary/10 border-primary/20 text-primary' : 
                        record.status === 'Stable' ? 'bg-secondary/10 border-secondary/20 text-on-surface-variant' :
                        'bg-error/10 border-error/20 text-error'
                      }`}>
                        {record.status}
                      </div>
                      <ChevronRight className="w-5 h-5 text-on-surface-variant opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button className="w-full mt-10 py-5 border border-outline-variant border-dashed rounded-2xl font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.3em] hover:bg-surface-variant hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-3">
              <ExternalLink className="w-4 h-4" /> Load_More_Protocol_Logs
            </button>
          </motion.div>
        </main>

      </div>
    </div>
  );
}
