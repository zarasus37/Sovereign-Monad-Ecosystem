// Sovereign Monad Control Center — main dashboard page
// Composes MetricsPanel, ControlPanel, ConfigPanel, ActivityLog

import { ActivityLog } from "@/components/ActivityLog";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ControlPanel } from "@/components/ControlPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import { Badge } from "@/components/ui/badge";
import { useConfig, useControls } from "@/hooks/use-dashboard";

function DashboardHeader() {
  const { data: controls } = useControls();

  const isArmed = controls?.armed ?? false;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border"
      data-ocid="dashboard.header"
    >
      <div>
        <h1 className="text-sm font-mono tracking-[0.25em] uppercase text-primary font-semibold monospace-display">
          Sovereign Monad Control Center
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground tracking-widest mt-0.5">
          Real-time system monitoring and control
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          className={`font-mono text-[10px] tracking-widest uppercase border ${
            isArmed
              ? "bg-primary/10 text-primary border-primary/40"
              : "bg-destructive/10 text-destructive border-destructive/40"
          }`}
          data-ocid="dashboard.armed_status.badge"
        >
          {isArmed ? "● ARMED" : "○ DISARMED"}
        </Badge>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: config } = useConfig();

  return (
    <div className="space-y-8" data-ocid="dashboard.page">
      <DashboardHeader />
      <MetricsPanel config={config} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ControlPanel />
        <ConfigPanel />
      </div>
      <ActivityLog />
    </div>
  );
}
