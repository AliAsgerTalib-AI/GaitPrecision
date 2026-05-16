import { useState, useMemo } from 'react';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Report from './components/Report';
import Profile from './components/Profile';
import SymmetryComparison from './components/SymmetryComparison';
import Recorder from './components/Recorder';
import { motion, AnimatePresence } from 'motion/react';

type View = 'home' | 'dashboard' | 'report' | 'recording' | 'profile';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');

  const renderView = useMemo(() => {
    switch (currentView) {
      case 'home':
        return (
          <Hero 
            onStartAnalysis={() => setCurrentView('recording')} 
            onUploadComplete={(file) => {
              console.log('File uploaded:', file.name);
              setCurrentView('dashboard');
            }}
          />
        );
      case 'recording':
        return (
          <Recorder 
            onComplete={(blob) => {
              console.log('Video captured:', blob.size);
              setCurrentView('dashboard');
            }} 
            onCancel={() => setCurrentView('home')} 
          />
        );
      case 'dashboard':
        return <Dashboard />;
      case 'report':
        return (
          <>
            <Report onViewProfile={() => setCurrentView('profile')} />
            <SymmetryComparison />
          </>
        );
      case 'profile':
        return <Profile />;
      default:
        return (
          <Hero 
            onStartAnalysis={() => setCurrentView('recording')} 
            onUploadComplete={() => setCurrentView('dashboard')}
          />
        );
    }
  }, [currentView]);

  return (
    <div className="min-h-screen bg-surface selection:bg-primary/20 selection:text-primary">
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

