import { PrimaryMode, SecondaryMode } from "@/backend";
// ControlPanel — Armed toggle, Primary Mode, Secondary Mode selectors
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useControls,
  useSetArmed,
  useSetPrimaryMode,
  useSetSecondaryMode,
} from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRIMARY_MODES: PrimaryMode[] = [
  PrimaryMode.standby,
  PrimaryMode.active,
  PrimaryMode.diagnostic,
];
const SECONDARY_MODES: SecondaryMode[] = [
  SecondaryMode.monitor,
  SecondaryMode.control,
  SecondaryMode.optimize,
];

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

export function ControlPanel() {
  const { data, isLoading, isError, refetch } = useControls();
  const setArmed = useSetArmed();
  const setPrimary = useSetPrimaryMode();
  const setSecondary = useSetSecondaryMode();

  function handleArmedToggle(checked: boolean) {
    setArmed.mutate(checked, {
      onSuccess: () =>
        toast.success(`System ${checked ? "ARMED" : "DISARMED"}`),
      onError: (err) =>
        toast.error(
          `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
        ),
    });
  }

  function handlePrimaryMode(mode: PrimaryMode) {
    setPrimary.mutate(mode, {
      onSuccess: () => toast.success(`Primary mode: ${mode}`),
      onError: (err) =>
        toast.error(
          `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
        ),
    });
  }

  function handleSecondaryMode(mode: SecondaryMode) {
    setSecondary.mutate(mode, {
      onSuccess: () => toast.success(`Secondary mode: ${mode}`),
      onError: (err) =>
        toast.error(
          `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
        ),
    });
  }

  return (
    <section data-ocid="controls.section">
      <SectionHeader label="Controls" variant="magenta" />
      {isError && (
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-accent text-xs font-mono"
            data-ocid="controls.error_state"
          >
            !! CONTROLS FETCH ERROR
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

      <div className="bg-card neon-border-magenta rounded-md p-4 space-y-5">
        {/* Armed toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-mono tracking-widest uppercase text-secondary monospace-display">
              System Status
            </Label>
            {isLoading ? (
              <Skeleton className="h-4 w-24 mt-1" />
            ) : (
              <p
                className={cn(
                  "text-xs font-mono mt-1 font-semibold tracking-widest monospace-display",
                  data?.armed ? "text-primary" : "text-muted-foreground",
                )}
              >
                {data?.armed ? "● ARMED // ACTIVE" : "○ DISARMED // SAFE"}
              </p>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-11" />
          ) : (
            <Switch
              checked={data?.armed ?? false}
              onCheckedChange={handleArmedToggle}
              disabled={setArmed.isPending}
              data-ocid="controls.armed.toggle"
              aria-label="Toggle armed state"
            />
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Primary mode */}
        <div className="space-y-2">
          <Label className="text-xs font-mono tracking-widest uppercase text-secondary monospace-display">
            Primary Mode
          </Label>
          {isLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {PRIMARY_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={data?.primaryMode === mode ? "default" : "outline"}
                  className={cn(
                    "font-mono text-xs tracking-widest uppercase",
                    data?.primaryMode === mode
                      ? "bg-secondary text-secondary-foreground"
                      : "border-secondary/40 text-muted-foreground hover:border-secondary hover:text-secondary",
                  )}
                  onClick={() => handlePrimaryMode(mode)}
                  disabled={setPrimary.isPending}
                  data-ocid={`controls.primary_mode.${mode}`}
                >
                  {mode}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Secondary mode */}
        <div className="space-y-2">
          <Label className="text-xs font-mono tracking-widest uppercase text-secondary monospace-display">
            Secondary Mode
          </Label>
          {isLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {SECONDARY_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={data?.secondaryMode === mode ? "default" : "outline"}
                  className={cn(
                    "font-mono text-xs tracking-widest uppercase",
                    data?.secondaryMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "border-primary/40 text-muted-foreground hover:border-primary hover:text-primary",
                  )}
                  onClick={() => handleSecondaryMode(mode)}
                  disabled={setSecondary.isPending}
                  data-ocid={`controls.secondary_mode.${mode}`}
                >
                  {mode}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
