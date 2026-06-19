// ActivityLog — Scrollable real-time log of system events
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityLog } from "@/hooks/use-dashboard";
import { formatTimestamp } from "@/lib/backend-client";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/types/dashboard";

const LOG_SKELETONS = [
  "ls1",
  "ls2",
  "ls3",
  "ls4",
  "ls5",
  "ls6",
  "ls7",
  "ls8",
] as const;

function logEntryVariant(entry: LogEntry): "cyan" | "magenta" | "orange" {
  const action = entry.action.toLowerCase();
  if (
    action.includes("config") ||
    action.includes("threshold") ||
    action.includes("polling")
  ) {
    return "orange";
  }
  if (
    action.includes("mode") ||
    action.includes("secondary") ||
    action.includes("primary")
  ) {
    return "magenta";
  }
  return "cyan";
}

function SectionHeader({
  label,
  variant,
  count,
}: {
  label: string;
  variant: "cyan" | "magenta" | "orange";
  count?: number;
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
      <h2 className="text-xs font-mono tracking-[0.2em] uppercase font-semibold monospace-display flex-1">
        {label}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-mono text-muted-foreground monospace-display">
          {count} entries
        </span>
      )}
    </div>
  );
}

export function ActivityLog() {
  const { data, isLoading, isError, refetch } = useActivityLog();

  // Show last 8 entries, newest first
  const entries = data ? [...data].reverse().slice(0, 8) : [];

  return (
    <section data-ocid="activity_log.section">
      <SectionHeader label="Activity Log" variant="cyan" count={data?.length} />
      {isError && (
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-accent text-xs font-mono"
            data-ocid="activity_log.error_state"
          >
            !! ACTIVITY LOG FETCH ERROR
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
      <div className="bg-card neon-border-cyan rounded-md overflow-hidden">
        <div className="h-[320px] overflow-y-auto">
          {isLoading ? (
            <div
              className="p-4 space-y-2"
              data-ocid="activity_log.loading_state"
            >
              {LOG_SKELETONS.map((id) => (
                <Skeleton key={id} className="h-5 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground"
              data-ocid="activity_log.empty_state"
            >
              <span className="text-xs font-mono tracking-widest opacity-50">
                {"// NO ACTIVITY YET"}
              </span>
              <span className="text-[10px] font-mono opacity-30">
                System events will appear here
              </span>
            </div>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-muted-foreground tracking-widest uppercase w-24">
                    TIME
                  </th>
                  <th className="text-left px-4 py-2 text-muted-foreground tracking-widest uppercase">
                    ACTION
                  </th>
                  <th className="text-left px-4 py-2 text-muted-foreground tracking-widest uppercase hidden md:table-cell">
                    PREV
                  </th>
                  <th className="text-left px-4 py-2 text-muted-foreground tracking-widest uppercase hidden md:table-cell">
                    NEW
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const rowKey = `${String(entry.timestamp)}-${i}`;
                  const variant = logEntryVariant(entry);
                  const colorClass = {
                    cyan: "text-primary",
                    magenta: "text-secondary",
                    orange: "text-accent",
                  }[variant];
                  return (
                    <tr
                      key={rowKey}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors duration-150"
                      data-ocid={`activity_log.item.${i + 1}`}
                    >
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 font-semibold tracking-wide",
                          colorClass,
                        )}
                      >
                        {entry.action}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                        {entry.oldValue}
                      </td>
                      <td className="px-4 py-2 text-foreground hidden md:table-cell">
                        {entry.newValue}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
