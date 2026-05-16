import { createContext, useContext, useState } from 'react';

export type AppMode = 'advanced' | 'wellness';

interface ModeContextValue {
  mode: AppMode;
  toggle: () => void;
}

const ModeContext = createContext<ModeContextValue>({ mode: 'advanced', toggle: () => {} });

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppMode>('advanced');
  return (
    <ModeContext.Provider value={{ mode, toggle: () => setMode(m => m === 'advanced' ? 'wellness' : 'advanced') }}>
      {children}
    </ModeContext.Provider>
  );
}

export const useMode = () => useContext(ModeContext);
