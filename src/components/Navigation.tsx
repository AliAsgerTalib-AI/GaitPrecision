import { ShieldCheck, Settings } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface NavigationProps {
  currentView: 'home' | 'dashboard' | 'report' | 'recording' | 'profile';
  onNavigate: (view: 'home' | 'dashboard' | 'report' | 'recording' | 'profile') => void;
}

export default function Navigation({ currentView, onNavigate }: NavigationProps) {
  if (currentView === 'recording') return null;

  const navItems = [
    { id: 'home', label: 'Technology' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'report', label: 'Reports' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
      <div className="flex justify-between items-center w-full px-6 max-w-[1440px] mx-auto h-16">
        <div className="flex items-center gap-8">
          <span 
            className="text-2xl font-display font-bold text-primary tracking-tight cursor-pointer"
            onClick={() => onNavigate('home')}
          >
            GaitPrecision
          </span>
          <nav className="hidden md:flex gap-6 items-center">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'home' || item.id === 'dashboard' || item.id === 'report' || item.id === 'profile') {
                    onNavigate(item.id as any);
                  }
                }}
                className={cn(
                  "font-mono text-xs uppercase tracking-wider transition-colors hover:text-primary",
                  currentView === item.id ? "text-primary border-b-2 border-primary pb-1 font-bold" : "text-on-surface-variant font-medium"
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_#2dd4bf]"></span>
            <span className="font-mono text-[10px] text-primary uppercase tracking-widest">Local Processing Only</span>
          </div>
          
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          
          <button 
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-mono text-xs font-bold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
            onClick={() => onNavigate('dashboard')}
          >
            <ShieldCheck className="w-4 h-4" />
            SECURE ANALYSIS
          </button>
        </div>
      </div>
    </header>
  );
}
