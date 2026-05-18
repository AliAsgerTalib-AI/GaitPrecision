import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type FontScale = 'normal' | 'large' | 'xl';

interface AccessibilityState {
  fontScale: FontScale;
  highContrast: boolean;
  setFontScale: (scale: FontScale) => void;
  toggleHighContrast: () => void;
}

const AccessibilityContext = createContext<AccessibilityState | null>(null);

const LS_FONT_SCALE = 'gp_font_scale';
const LS_HIGH_CONTRAST = 'gp_high_contrast';

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(
    () => (localStorage.getItem(LS_FONT_SCALE) as FontScale | null) ?? 'normal'
  );
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem(LS_HIGH_CONTRAST) === 'true'
  );

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-font-scale', fontScale);
    localStorage.setItem(LS_FONT_SCALE, fontScale);
  }, [fontScale]);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-high-contrast', String(highContrast));
    localStorage.setItem(LS_HIGH_CONTRAST, String(highContrast));
  }, [highContrast]);

  function setFontScale(scale: FontScale) {
    setFontScaleState(scale);
  }

  function toggleHighContrast() {
    setHighContrast(v => !v);
  }

  return (
    <AccessibilityContext.Provider value={{ fontScale, highContrast, setFontScale, toggleHighContrast }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
