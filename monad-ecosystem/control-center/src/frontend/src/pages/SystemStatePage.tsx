import { LayerHeader } from "@/components/LayerHeader";
// L15: System State & Observability — comprehensive system monitoring
import { Layout } from "@/components/Layout";
import { useActivityLog, useControls, useMetrics } from "@/hooks/use-dashboard";
import { Activity } from "lucide-react";

export default function SystemStatePage() {
  const { data: metrics } = useMetrics();
  const { data: controls } = useControls();
  const { data: log } = useActivityLog();

  return (
    <Layout>
      <div className="space-y-6" data-ocid="system_state.page">
        <LayerHeader
          layer={15}
          title="System State & Observability"
          description="Full observability layer — live metrics, control states, and activity logs from across the ecosystem."
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "CPU Load", value: metrics ? `${metrics.cpuLoad}%` : "—" },
            {
              label: "Memory",
              value: metrics ? `${metrics.memoryUsage}%` : "—",
            },
            { label: "Uptime", value: metrics ? `${metrics.uptime}s` : "—" },
            { label: "Primary Mode", value: controls?.primaryMode ?? "—" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-card border border-border p-4 space-y-1"
            >
              <span className="metric-label">{s.label}</span>
              <div className="metric-value capitalize">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border">
            <div className="panel-header">
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Control State
              </span>
            </div>
            <div className="panel-content">
              {[
                { label: "Armed", value: controls?.armed ? "YES" : "NO" },
                { label: "Primary Mode", value: controls?.primaryMode ?? "—" },
                {
                  label: "Secondary Mode",
                  value: controls?.secondaryMode ?? "—",
                },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex justify-between py-2 border-b border-border/40 last:border-0"
                >
                  <span className="text-sm text-muted-foreground">
                    {r.label}
                  </span>
                  <span className="font-mono text-sm text-primary capitalize">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-primary" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Activity Log
                </span>
              </div>
            </div>
            <div
              className="overflow-y-auto max-h-64"
              data-ocid="system_state.activity_log"
            >
              {log?.map((entry, i) => (
                <div
                  key={`${entry.action}-${entry.timestamp.toString()}`}
                  className="px-4 py-2 border-b border-border/40 last:border-0 text-xs"
                  data-ocid={`system_state.log.item.${i + 1}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-secondary">
                      {entry.action}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {new Date(
                        Number(entry.timestamp) / 1_000_000,
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground/70 mt-0.5">
                    {entry.oldValue} → {entry.newValue}
                  </div>
                </div>
              )) ?? (
                <div
                  className="px-4 py-6 text-center"
                  data-ocid="system_state.log.empty_state"
                >
                  <span className="font-mono text-xs text-muted-foreground/40">
                    No activity recorded
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
