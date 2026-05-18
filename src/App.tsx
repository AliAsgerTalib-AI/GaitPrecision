import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import BalanceDashboard from './components/BalanceDashboard';
import StairDashboard from './components/StairDashboard';
import SquatDashboard from './components/SquatDashboard';
import LiftDashboard from './components/LiftDashboard';
import ExerciseDashboard from './components/ExerciseDashboard';
import Report from './components/Report';
import Profile from './components/Profile';
import SymmetryComparison from './components/SymmetryComparison';
import Recorder, { type ActivityType } from './components/Recorder';
import HowToRecord from './components/HowToRecord';
import Glossary from './components/Glossary';
import WellnessHome from './components/WellnessHome';
import WellnessDashboard from './components/WellnessDashboard';
import WellnessReport from './components/WellnessReport';
import { ModeProvider, useMode } from './lib/modeContext';
import { motion, AnimatePresence } from 'motion/react';

type View = 'home' | 'dashboard' | 'report' | 'recording' | 'profile' | 'help' | 'glossary';

function AppInner() {
  const { mode } = useMode();
  const [currentView, setCurrentView] = useState<View>('home');
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('gait');
  const prevVideoSrc = useRef<string | null>(null);

  // Revoke the previous object URL when a new one replaces it.
  useEffect(() => {
    const prev = prevVideoSrc.current;
    prevVideoSrc.current = videoSrc;
    if (prev && prev !== videoSrc) URL.revokeObjectURL(prev);
  }, [videoSrc]);

  const setVideo = useCallback((source: Blob | File) => {
    setVideoSrc(URL.createObjectURL(source));
  }, []);

  const renderView = useMemo(() => {
    switch (currentView) {
      case 'home':
        return mode === 'wellness' ? (
          <WellnessHome
            onStartRecording={() => setCurrentView('recording')}
            onUploadComplete={(file) => { setVideo(file); setCurrentView('dashboard'); }}
            onHowToRecord={() => setCurrentView('help')}
          />
        ) : (
          <Hero
            onStartAnalysis={(type) => { setActivityType(type); setCurrentView('recording'); }}
            onUploadComplete={(file, type) => { setActivityType(type); setVideo(file); setCurrentView('dashboard'); }}
            onHome={() => setCurrentView('home')}
          />
        );
      case 'recording':
        return (
          <Recorder
            initialType={activityType}
            onComplete={(blob, type) => {
              setActivityType(type);
              setVideo(blob);
              setCurrentView('dashboard');
            }}
            onCancel={() => setCurrentView('home')}
          />
        );
      case 'dashboard': {
        const dashProps = {
          onRecord: () => setCurrentView('recording'),
          onUpload: (file: File) => setVideo(file),
          onOpenGlossary: () => setCurrentView('glossary'),
        };
        if (activityType === 'balance') return <BalanceDashboard videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'stair')   return <StairDashboard   videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'squat')   return <SquatDashboard   videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'lift')    return <LiftDashboard    videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'exercise') return <ExerciseDashboard videoSrc={videoSrc} {...dashProps} />;
        return mode === 'wellness'
          ? <WellnessDashboard videoSrc={videoSrc} {...dashProps} />
          : <Dashboard videoSrc={videoSrc} {...dashProps} />;
      }
      case 'report':
        return mode === 'wellness' ? (
          <WellnessReport />
        ) : (
          <>
            <Report onViewProfile={() => setCurrentView('profile')} />
            <SymmetryComparison />
          </>
        );
      case 'profile':
        return <Profile />;
      case 'help':
        return <HowToRecord />;
      case 'glossary':
        return <Glossary />;
    }
  }, [currentView, videoSrc, setVideo, activityType, mode]);

  return (
    <div className="min-h-screen bg-surface selection:bg-primary/20 selection:text-primary pb-16 md:pb-0">
      <Navigation currentView={currentView} onNavigate={setCurrentView} />
      
      <main className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderView}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant mt-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-6 text-center">
          <button onClick={() => setCurrentView('home')} className="focus:outline-none" aria-label="Go to home">
            <img src="/logo.png" alt="Symphery" className="h-12 w-auto opacity-70 hover:opacity-100 transition-opacity" />
          </button>

          <div className="max-w-2xl space-y-2">
            <p className="font-sans text-[11px] text-on-surface-variant/70 leading-relaxed">
              <span className="font-semibold text-on-surface-variant">Legal Disclaimer:</span> GaitPrecision is intended for informational and research purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making any clinical decisions based on this tool. All biomechanical data is processed locally on your device and never transmitted to external servers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest">
            <span>© 2026 Symphery</span>
            <span className="hidden sm:inline opacity-30">|</span>
            <a href="mailto:aliasgertalib@gmail.com" className="hover:text-primary transition-colors">
              aliasgertalib@gmail.com
            </a>
            <span className="hidden sm:inline opacity-30">|</span>
            <span>All biometric data remains on-device</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ModeProvider>
      <AppInner />
    </ModeProvider>
  );
}

