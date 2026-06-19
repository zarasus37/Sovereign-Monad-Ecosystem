// MetricsPanel — CPU, Memory, Uptime, and Timestamp metric cards
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics } from "@/hooks/use-dashboard";
import { formatTimestamp, formatUptime } from "@/lib/backend-client";
import { cn } from "@/lib/utils";
import type { Config } from "@/types/dashboard";

const METRIC_SKELETONS = ["m1", "m2", "m3", "m4"] as const;

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  variant: "cyan" | "magenta" | "orange";
  barPercent?: number;
  isLoading?: boolean;
  exceeded?: boolean;
  "data-ocid"?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  variant,
  barPercent,
  isLoading,
  exceeded,
  "data-ocid": ocid,
}: MetricCardProps) {
  const borderClass = exceeded
    ? "neon-border-orange"
    : {
        cyan: "neon-border-cyan",
        magenta: "neon-border-magenta",
        orange: "neon-border-orange",
      }[variant];

  const barClass = exceeded
    ? "bg-accent"
    : { cyan: "bg-primary", magenta: "bg-secondary", orange: "bg-accent" }[
        variant
      ];

  const labelClass = exceeded
    ? "text-accent"
    : {
        cyan: "text-primary",
        magenta: "text-secondary",
        orange: "text-accent",
      }[variant];

  return (
    <div
      className={cn(
        "bg-card rounded-md p-4 flex flex-col gap-2 transition-all duration-500",
        borderClass,
        exceeded && "animate-pulse",
      )}
      data-ocid={ocid}
    >
      <span
        className={cn(
          "text-xs font-mono tracking-widest uppercase monospace-display",
          labelClass,
        )}
      >
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-8 w-3/4" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-mono font-semibold text-foreground monospace-display">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-mono text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      )}
      {barPercent !== undefined && !isLoading && (
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              barClass,
            )}
            style={{ width: `${Math.min(100, barPercent)}%` }}
          />
        </div>
      )}
      {exceeded && !isLoading && (
        <span className="text-[10px] font-mono text-accent uppercase tracking-widest monospace-display">
          !! THRESHOLD EXCEEDED
        </span>
      )}
    </div>
  );
}

function SectionHeader({
  label,
  variant,
}: {
  label: string;
  variant: "cyan" | "magenta" | "orange";
}) {
  const colorClass = {
    cyan: "text-primary border-primary/40",
    magenta: "text-secondary border-secondary/40",
    orange: "text-accent border-accent/40",
  }[variant];

  return (
    <div
      className={cn("flex items-center gap-3 mb-3 pb-2 border-b", colorClass)}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <h2 className="text-xs font-mono tracking-[0.2em] uppercase font-semibold monospace-display">
        {label}
      </h2>
    </div>
  );
}

interface MetricsPanelProps {
  config?: Config;
}

export function MetricsPanel({ config }: MetricsPanelProps) {
  const { data, isLoading, isError, refetch } = useMetrics();

  const cpuVal = data ? Number(data.cpuLoad) : 0;
  const memVal = data ? Number(data.memoryUsage) : 0;
  const cpuThreshold = config ? Number(config.cpuThreshold) : 80;
  const memThreshold = config ? Number(config.memoryThreshold) : 80;

  return (
    <section data-ocid="metrics.section">
      <SectionHeader label="System Metrics" variant="cyan" />
      {isError && (
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-accent text-xs font-mono"
            data-ocid="metrics.error_state"
          >
            !! METRICS FETCH ERROR
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="font-mono text-xs border-accent/40 text-accent hover:border-accent h-6 px-2"
            onClick={() => refetch()}
          >
            RETRY
          </Button>
        </div>
      )}
      {isLoading && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          data-ocid="metrics.loading_state"
        >
          {METRIC_SKELETONS.map((id) => (
            <div
              key={id}
              className="bg-card neon-border-cyan rounded-md p-4 space-y-3"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-1 w-full" />
            </div>
          ))}
        </div>
      )}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="CPU Load"
            value={data ? String(cpuVal) : "—"}
            unit="%"
            variant={cpuVal > cpuThreshold ? "orange" : "cyan"}
            barPercent={data ? cpuVal : undefined}
            exceeded={data ? cpuVal > cpuThreshold : false}
            data-ocid="metrics.cpu.card"
          />
          <MetricCard
            label="Memory"
            value={data ? String(memVal) : "—"}
            unit="%"
            variant={memVal > memThreshold ? "orange" : "magenta"}
            barPercent={data ? memVal : undefined}
            exceeded={data ? memVal > memThreshold : false}
            data-ocid="metrics.memory.card"
          />
          <MetricCard
            label="Uptime"
            value={data ? formatUptime(data.uptime) : "—"}
            variant="cyan"
            data-ocid="metrics.uptime.card"
          />
          <MetricCard
            label="Last Updated"
            value={data ? formatTimestamp(data.timestamp) : "—"}
            variant="orange"
            data-ocid="metrics.timestamp.card"
          />
        </div>
      )}
    </section>
  );
}
