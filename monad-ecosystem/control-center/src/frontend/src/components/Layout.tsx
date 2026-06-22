// Sovereign Monad Control Center — Layout shell
// Header with neon branding + main content area
import React from "react";

import { cn } from "@/lib/utils";

import { useLocation, useNavigate } from "@tanstack/react-router";

const NAV_LAYERS = [
  { layer: 1, label: "Foundation & Axioms", route: "/" },
  { layer: 2, label: "Agent Core", route: "/agent-core" },
  { layer: 3, label: "Organ System", route: "/organ-system" },
  { layer: 4, label: "Signal Routing (Synapse)", route: "/synapse" },
  { layer: 5, label: "Narrative Intelligence (Vox)", route: "/vox" },
  { layer: 6, label: "Market Intelligence (Pneuma)", route: "/pneuma" },
  { layer: 7, label: "Forensic Analysis (Hepar)", route: "/hepar" },
  { layer: 8, label: "Capital Allocation (Cardia)", route: "/cardia" },
  { layer: 9, label: "Network Coordination", route: "/network" },
  { layer: 10, label: "Integrity & Gnosis", route: "/integrity" },
  { layer: 11, label: "Build Pipeline", route: "/pipeline" },
  { layer: 12, label: "Deployment Orchestration", route: "/deployment" },
  { layer: 13, label: "Cost & Infrastructure", route: "/cost" },
  { layer: 14, label: "Ecosystem Governance", route: "/governance" },
  { layer: 15, label: "System State & Observability", route: "/system-state" },
  { layer: 16, label: "LOGOC Corpus Explorer", route: "/logoc" },
  { layer: 17, label: "LOGOC Human Review", route: "/logoc-review" },
] as const;

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[240px] bg-[#0A0A0A] border-r border-border flex flex-col z-50 overflow-hidden"
      data-ocid="sidebar.panel"
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-5 h-5 relative flex items-center justify-center flex-shrink-0">
            <div className="absolute inset-0 neon-border-cyan opacity-70" />
            <div className="w-2 h-2 bg-primary" />
          </div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-bold leading-none">
            SOVEREIGN MONAD
          </span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground/50 uppercase ml-7">
          CONTROL CENTER
        </span>
      </div>

      {/* Nav layers */}
      <nav
        className="flex-1 overflow-y-auto py-2 scrollbar-hide"
        data-ocid="sidebar.nav"
      >
        {NAV_LAYERS.map((item) => {
          const isActive =
            item.route === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.route);
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => navigate({ to: item.route })}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-[7px] text-xs border-l-2 transition-smooth ${
                isActive
                  ? "border-l-primary text-foreground bg-primary/5"
                  : "border-l-transparent text-muted-foreground hover:text-foreground hover:border-l-primary/40"
              }`}
              data-ocid={`sidebar.layer${item.layer}.link`}
            >
              <span
                className={`flex-shrink-0 w-5 h-4 font-mono text-[9px] font-bold flex items-center justify-center border ${
                  isActive
                    ? "border-primary/60 text-primary"
                    : "border-border/60 text-muted-foreground/60"
                }`}
              >
                {item.layer}
              </span>
              <span className="truncate leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom status */}
      <div className="px-3 py-3 border-t border-border flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </div>
            <span className="font-mono text-[9px] text-primary tracking-widest uppercase">
              Online
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground/40">
            v1.0.0
          </span>
        </div>
        <div className="font-mono text-[9px] text-muted-foreground/30 tracking-wider">
          17-LAYER ECOSYSTEM OS
        </div>
      </div>
    </aside>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex" data-theme="dark">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main area: header + content + footer, offset by sidebar */}
      <div className="flex flex-col flex-1 min-w-0 ml-[240px]">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-40">
          <div className="px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-sm neon-border-cyan opacity-80" />
                <div className="w-3 h-3 bg-primary rounded-sm" />
              </div>
              <span className="font-mono text-sm tracking-[0.15em] text-primary uppercase font-semibold monospace-display">
                Sovereign Monad
              </span>
              <span className="hidden sm:block text-muted-foreground text-xs font-mono tracking-widest uppercase opacity-60">
                /
              </span>
              <span className="hidden sm:block text-muted-foreground text-xs font-mono tracking-widest uppercase opacity-60">
                Control Center
              </span>
            </div>
            <div className="flex items-center gap-4">
              <SystemClock />
              <div className="h-4 w-px bg-border" />
              <StatusIndicator />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className={cn("flex-1 px-6 py-6", className)}>{children}</main>

        {/* Footer */}
        <footer className="bg-card border-t border-border">
          <div className="px-6 h-10 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-mono tracking-wider">
              &copy; {new Date().getFullYear()}. Built with love using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors duration-200"
              >
                caffeine.ai
              </a>
            </span>
            <span className="text-muted-foreground text-xs font-mono tracking-wider opacity-40">
              v1.0.0
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SystemClock() {
  const [time, setTime] = React.useState(() =>
    new Date().toLocaleTimeString("en-US", { hour12: false }),
  );

  React.useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-muted-foreground text-xs font-mono tracking-widest monospace-display">
      {time}
    </span>
  );
}

function StatusIndicator() {
  return (
    <div className="flex items-center gap-2" aria-label="System online">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </div>
      <span className="text-primary text-xs font-mono tracking-widest uppercase monospace-display">
        Online
      </span>
    </div>
  );
}
