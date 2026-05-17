import {
  ShieldCheck,
  Home,
  Activity,
  ScrollText,
  User,
  HelpCircle,
  Heart,
  FlaskConical,
  BookOpen,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useMode } from "@/src/lib/modeContext";

type View = "home" | "dashboard" | "report" | "recording" | "profile" | "help" | "glossary";

interface NavigationProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const navItems = [
  { id: "home" as const, label: "Technology", mobileLabel: "Home", Icon: Home },
  {
    id: "dashboard" as const,
    label: "Dashboard",
    mobileLabel: "Analysis",
    Icon: Activity,
  },
  {
    id: "report" as const,
    label: "Reports",
    mobileLabel: "Reports",
    Icon: ScrollText,
  },
  {
    id: "profile" as const,
    label: "Profile",
    mobileLabel: "Profile",
    Icon: User,
  },
  {
    id: "help" as const,
    label: "How to Record",
    mobileLabel: "Help",
    Icon: HelpCircle,
  },
  {
    id: "glossary" as const,
    label: "Glossary",
    mobileLabel: "Glossary",
    Icon: BookOpen,
  },
];

export default function Navigation({
  currentView,
  onNavigate,
}: NavigationProps) {
  const { mode, toggle } = useMode();
  if (currentView === "recording") return null;

  return (
    <>
      {/* Desktop / Tablet top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-4 sm:px-6 max-w-[1440px] mx-auto h-16">
          <div className="flex items-center gap-8">
            <button
              onClick={() => onNavigate("home")}
              className="flex items-center gap-2 focus:outline-none"
              aria-label="Go to home"
            >
              <img src="/logo.png" alt="Symphery" className="h-9 w-auto" />
            </button>
            <nav className="hidden md:flex gap-6 items-center">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "font-mono text-xs uppercase tracking-wider transition-colors hover:text-primary",
                    currentView === item.id
                      ? "text-primary border-b-2 border-primary pb-1 font-bold"
                      : "text-on-surface-variant font-medium",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mode toggle */}
            <button
              onClick={toggle}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                mode === "wellness"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary",
              )}
            >
              {mode === "wellness" ? (
                <Heart className="w-3.5 h-3.5" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {mode === "wellness" ? "Wellness" : "Advanced"}
              </span>
            </button>

            <button
              className="hidden sm:flex bg-primary text-on-primary px-4 py-2 rounded-lg font-mono text-xs font-bold items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
              onClick={() => onNavigate("dashboard")}
            >
              <ShieldCheck className="w-4 h-4" />
              {mode === "wellness" ? "ANALYSE WALK" : "SECURE ANALYSIS"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-md border-t border-outline-variant"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex-1 flex flex-col items-center py-3 gap-1 transition-colors",
                currentView === item.id
                  ? "text-primary"
                  : "text-on-surface-variant",
              )}
            >
              <item.Icon className="w-5 h-5" />
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold">
                {item.mobileLabel}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
