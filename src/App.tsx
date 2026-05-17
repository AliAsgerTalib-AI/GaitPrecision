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
import WellnessHome from './components/WellnessHome';
import WellnessDashboard from './components/WellnessDashboard';
import WellnessReport from './components/WellnessReport';
import { ModeProvider, useMode } from './lib/modeContext';
import { motion, AnimatePresence } from 'motion/react';

type View = 'home' | 'dashboard' | 'report' | 'recording' | 'profile' | 'help';

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
            onUploadComplete={(file) => { setVideo(file); setCurrentView('dashboard'); }}
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
        };
        if (activityType === 'balance') return <BalanceDashboard videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'stair')   return <StairDashboard   videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'squat')   return <SquatDashboard   videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'lift')    return <LiftDashboard    videoSrc={videoSrc} {...dashProps} />;
        if (activityType === 'exercise') return <ExerciseDashboard videoSrc={videoSrc} {...dashProps} />;
        return mode === 'wellness'
          ? <WellnessDashboard videoSrc={videoSrc} />
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
        <div className="border-t border-outline-variant/30 py-6 text-center">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-[0.2em] opacity-60">
            © 2026 GaitPrecision. Built with WASM & WebAssembly. All biometric data remains on-device.
          </p>
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

