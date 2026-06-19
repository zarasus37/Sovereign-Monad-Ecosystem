// ConfigPanel — CPU/Memory thresholds, polling interval, response delay
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfig, useUpdateConfig } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const CONFIG_FIELDS = [
  { key: "cpuThreshold" as const, label: "CPU Threshold", unit: "%" },
  { key: "memoryThreshold" as const, label: "Memory Threshold", unit: "%" },
  { key: "pollingInterval" as const, label: "Polling Interval", unit: "ms" },
  { key: "responseDelay" as const, label: "Response Delay", unit: "ms" },
];

type ConfigForm = {
  cpuThreshold: string;
  memoryThreshold: string;
  pollingInterval: string;
  responseDelay: string;
};

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

export function ConfigPanel() {
  const { data, isLoading, isError, refetch } = useConfig();
  const updateConfig = useUpdateConfig();

  const [form, setForm] = useState<ConfigForm>({
    cpuThreshold: "",
    memoryThreshold: "",
    pollingInterval: "",
    responseDelay: "",
  });
  const [dirty, setDirty] = useState(false);

  // Populate form when config loads
  useEffect(() => {
    if (data && !dirty) {
      setForm({
        cpuThreshold: String(Number(data.cpuThreshold)),
        memoryThreshold: String(Number(data.memoryThreshold)),
        pollingInterval: String(Number(data.pollingInterval)),
        responseDelay: String(Number(data.responseDelay)),
      });
    }
  }, [data, dirty]);

  function handleChange(field: keyof ConfigForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  }

  function handleCancel() {
    if (!data) return;
    setForm({
      cpuThreshold: String(Number(data.cpuThreshold)),
      memoryThreshold: String(Number(data.memoryThreshold)),
      pollingInterval: String(Number(data.pollingInterval)),
      responseDelay: String(Number(data.responseDelay)),
    });
    setDirty(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateConfig.mutate(
      {
        cpuThreshold: Number(form.cpuThreshold),
        memoryThreshold: Number(form.memoryThreshold),
        pollingInterval: Number(form.pollingInterval),
        responseDelay: Number(form.responseDelay),
      },
      {
        onSuccess: () => {
          toast.success("Configuration saved");
          setDirty(false);
        },
        onError: (err) =>
          toast.error(
            `Save failed: ${err instanceof Error ? err.message : "unknown error"}`,
          ),
      },
    );
  }

  // Compare form to saved values
  const savedValues = data
    ? {
        cpuThreshold: String(Number(data.cpuThreshold)),
        memoryThreshold: String(Number(data.memoryThreshold)),
        pollingInterval: String(Number(data.pollingInterval)),
        responseDelay: String(Number(data.responseDelay)),
      }
    : null;

  const hasChanges =
    savedValues !== null &&
    CONFIG_FIELDS.some(({ key }) => form[key] !== savedValues[key]);

  return (
    <section data-ocid="config.section">
      <SectionHeader label="Configuration" variant="orange" />
      {isError && (
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-accent text-xs font-mono"
            data-ocid="config.error_state"
          >
            !! CONFIG FETCH ERROR
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
      <form
        onSubmit={handleSave}
        className="bg-card neon-border-orange rounded-md p-4 space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          {CONFIG_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className="space-y-1">
              <Label
                htmlFor={`config-${key}`}
                className="text-xs font-mono tracking-widest uppercase text-accent monospace-display"
              >
                {label}
              </Label>
              {isLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      id={`config-${key}`}
                      type="number"
                      value={form[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="font-mono text-sm bg-input border-border focus:border-accent pr-10"
                      data-ocid={`config.${key}.input`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                      {unit}
                    </span>
                  </div>
                  {savedValues && form[key] !== savedValues[key] && (
                    <p className="text-[10px] font-mono text-muted-foreground">
                      saved:{" "}
                      <span className="text-accent monospace-display">
                        {savedValues[key]}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          {hasChanges && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="font-mono text-xs tracking-widest uppercase border-border text-muted-foreground hover:text-foreground"
              data-ocid="config.cancel_button"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!hasChanges || updateConfig.isPending || isLoading}
            className="font-mono text-xs tracking-widest uppercase bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
            data-ocid="config.save_button"
          >
            {updateConfig.isPending ? "Saving..." : "Apply Changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
