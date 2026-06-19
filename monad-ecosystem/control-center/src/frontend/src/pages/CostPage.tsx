// L13: Cost & Infrastructure — live cost model + interactive estimator
import type { CostModel } from "@/backend";
import { LayerHeader } from "@/components/LayerHeader";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCostModel,
  useEstimateCost,
  useUpdateCostModel,
} from "@/hooks/use-ecosystem";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Cloud,
  Database,
  Server,
  Zap,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";

// ─── Local cost calculation (mirrors backend math) ───────────────
interface LocalCostPreview {
  cycleCost: number;
  rpcCost: number;
  gasCost: number;
  storageCost: number;
  totalUsd: number;
  totalIcp: number;
}

function calcLocalEstimate(
  cyclesPerHour: number,
  rpcCallsPerHour: number,
  gasFeePerTx: number,
  agentCount: number,
  storageGB: number,
): LocalCostPreview {
  const cycleCost = ((cyclesPerHour * 24 * 30) / 1_000_000_000) * 0.0001;
  const rpcCost = rpcCallsPerHour * 24 * 30 * 0.000001;
  const gasCost = gasFeePerTx * 100 * 0.00000005;
  const storageCost = storageGB * 0.5;
  const agentMultiplier = Math.max(1, agentCount);
  const totalUsd =
    (cycleCost + rpcCost + gasCost) * agentMultiplier + storageCost;
  const totalIcp = totalUsd / 8.5;
  return {
    cycleCost: cycleCost * agentMultiplier,
    rpcCost: rpcCost * agentMultiplier,
    gasCost: gasCost * agentMultiplier,
    storageCost,
    totalUsd,
    totalIcp,
  };
}

function fmt(n: number, decimals = 4): string {
  if (n === 0) return "0.0000";
  if (n < 0.0001) return "<0.0001";
  return n.toFixed(decimals);
}

function fmtLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

// ─── Scenarios ────────────────────────────────────────────────────
type Scenario = "development" | "advisory" | "production";

interface ScenarioConfig {
  label: string;
  description: string;
  cyclesPerHour: number;
  rpcCallsPerHour: number;
  gasFeePerTx: number;
  agentCount: number;
  storageGB: number;
}

const SCENARIOS: Record<Scenario, ScenarioConfig> = {
  development: {
    label: "Development",
    description: "Minimal agents, low RPC — for local testing and staging",
    cyclesPerHour: 100_000,
    rpcCallsPerHour: 50,
    gasFeePerTx: 10,
    agentCount: 2,
    storageGB: 1,
  },
  advisory: {
    label: "Advisory Tier",
    description: "Current production setup — balanced operational load",
    cyclesPerHour: 1_200_000,
    rpcCallsPerHour: 800,
    gasFeePerTx: 50,
    agentCount: 5,
    storageGB: 10,
  },
  production: {
    label: "Full Production",
    description: "Maximum agent load — all 15 layers at capacity",
    cyclesPerHour: 8_000_000,
    rpcCallsPerHour: 5_000,
    gasFeePerTx: 200,
    agentCount: 15,
    storageGB: 50,
  },
};

// ─── Parameter config ─────────────────────────────────────────────
const PARAMS = [
  {
    key: "cyclesPerHour" as const,
    label: "Cycles per Hour",
    sublabel: "IC compute",
    unit: "cycles/hr",
    min: 100_000,
    max: 10_000_000,
    step: 100_000,
  },
  {
    key: "rpcCallsPerHour" as const,
    label: "RPC Calls per Hour",
    sublabel: "External endpoints",
    unit: "calls/hr",
    min: 10,
    max: 10_000,
    step: 10,
  },
  {
    key: "gasFeePerTx" as const,
    label: "Gas Fee per Transaction",
    sublabel: "On-chain execution",
    unit: "gwei",
    min: 1,
    max: 1_000,
    step: 1,
  },
  {
    key: "agentCount" as const,
    label: "Active Agents",
    sublabel: "Running concurrently",
    unit: "agents",
    min: 1,
    max: 20,
    step: 1,
  },
  {
    key: "storageGB" as const,
    label: "Storage",
    sublabel: "Agent memory + audit logs",
    unit: "GB/mo",
    min: 1,
    max: 100,
    step: 1,
  },
] as const;

type FormValues = {
  cyclesPerHour: number;
  rpcCallsPerHour: number;
  gasFeePerTx: number;
  agentCount: number;
  storageGB: number;
};

const DEFAULT_FORM: FormValues = {
  cyclesPerHour: 1_200_000,
  rpcCallsPerHour: 800,
  gasFeePerTx: 50,
  agentCount: 5,
  storageGB: 10,
};

// ─── Subcomponents ────────────────────────────────────────────────
function CostTotalDisplay({
  preview,
  isFromBackend,
}: {
  preview: LocalCostPreview;
  isFromBackend?: boolean;
}) {
  const colorClass =
    preview.totalUsd < 100
      ? "text-primary"
      : preview.totalUsd < 500
        ? "text-accent"
        : "text-destructive";

  return (
    <div
      className="bg-card border border-border p-6 flex flex-col gap-3"
      data-ocid="cost.total_display"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Total Estimated Cost / Month
        </span>
        {isFromBackend && (
          <Badge className="font-mono text-[9px] bg-primary/10 text-primary border border-primary/30">
            LIVE
          </Badge>
        )}
      </div>
      <div className="flex items-end gap-6">
        <div>
          <div className={`font-mono text-4xl font-bold ${colorClass}`}>
            ${fmt(preview.totalUsd, 2)}
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">
            USD / month
          </div>
        </div>
        <div className="pb-1">
          <div className="font-mono text-xl text-secondary">
            {fmt(preview.totalIcp, 3)} ICP
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">
            ≈ at $8.50/ICP
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
        {[
          {
            label: "Compute Cycles",
            value: fmt(preview.cycleCost, 4),
            raw: `${fmtLarge(((preview.cycleCost / 0.0001) * 1e9) / (24 * 30))} cyc/hr`,
            icon: Zap,
            color: "text-primary",
          },
          {
            label: "RPC Endpoints",
            value: fmt(preview.rpcCost, 4),
            raw: `${fmtLarge(preview.rpcCost / (24 * 30 * 0.000001))} calls/hr`,
            icon: Activity,
            color: "text-primary",
          },
          {
            label: "Gas Fees",
            value: fmt(preview.gasCost, 4),
            raw: `${fmtLarge(preview.gasCost / (100 * 0.00000005))} gwei/tx`,
            icon: BarChart3,
            color: "text-accent",
          },
          {
            label: "Storage",
            value: fmt(preview.storageCost, 4),
            raw: `${fmt(preview.storageCost / 0.5, 1)} GB/mo`,
            icon: Database,
            color: "text-secondary",
          },
        ].map(({ label, value, raw, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-muted/30 border border-border/50 p-3 space-y-1"
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3 h-3 ${color}`} />
              <span className="metric-label text-[9px]">{label}</span>
            </div>
            <div className={`font-mono text-sm font-semibold ${color}`}>
              ${value}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/70">
              {raw}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SliderRow({
  param,
  value,
  onChange,
  index,
}: {
  param: (typeof PARAMS)[number];
  value: number;
  onChange: (v: number) => void;
  index: number;
}) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  return (
    <div className="space-y-2" data-ocid={`cost.param.item.${index + 1}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-foreground">
            {param.label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground ml-2">
            {param.sublabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={param.min}
            max={param.max}
            step={param.step}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v))
                onChange(Math.min(param.max, Math.max(param.min, v)));
            }}
            className="w-24 bg-input border border-border/60 px-2 py-1 font-mono text-xs text-right text-foreground focus:outline-none focus:border-primary/60 focus:ring-0"
            data-ocid={`cost.${param.key}.input`}
          />
          <span className="font-mono text-[10px] text-muted-foreground w-16 text-left">
            {param.unit}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 bg-muted rounded-none">
        <div
          className="absolute left-0 top-0 h-full bg-primary/60 transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={param.label}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground/50">
        <span>{fmtLarge(param.min)}</span>
        <span>{fmtLarge(param.max)}</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────
export default function CostPage() {
  const { data: costModel, isLoading } = useCostModel();
  const estimateCost = useEstimateCost();
  const updateCostModel = useUpdateCostModel();

  const [form, setForm] = React.useState<FormValues>(DEFAULT_FORM);
  const [activeScenario, setActiveScenario] = React.useState<Scenario | null>(
    null,
  );
  const [appliedOnce, setAppliedOnce] = React.useState(false);

  // Sync form from backend cost model on first load
  React.useEffect(() => {
    if (costModel && !appliedOnce) {
      setForm({
        cyclesPerHour: Number(costModel.cyclesPerHour),
        rpcCallsPerHour: Number(costModel.rpcCallsPerHour),
        gasFeePerTx: Number(costModel.gasFeePerTx),
        agentCount: Number(costModel.agentCount),
        storageGB: Number(costModel.storageGB),
      });
      setAppliedOnce(true);
    }
  }, [costModel, appliedOnce]);

  // Real-time local preview
  const preview = React.useMemo(
    () =>
      calcLocalEstimate(
        form.cyclesPerHour,
        form.rpcCallsPerHour,
        form.gasFeePerTx,
        form.agentCount,
        form.storageGB,
      ),
    [form],
  );

  function setParam<K extends keyof FormValues>(key: K, value: number) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setActiveScenario(null);
  }

  function applyScenario(s: Scenario) {
    const cfg = SCENARIOS[s];
    setForm({
      cyclesPerHour: cfg.cyclesPerHour,
      rpcCallsPerHour: cfg.rpcCallsPerHour,
      gasFeePerTx: cfg.gasFeePerTx,
      agentCount: cfg.agentCount,
      storageGB: cfg.storageGB,
    });
    setActiveScenario(s);
  }

  function buildCostModel(): CostModel {
    return {
      cyclesPerHour: BigInt(Math.round(form.cyclesPerHour)),
      rpcCallsPerHour: BigInt(Math.round(form.rpcCallsPerHour)),
      gasFeePerTx: BigInt(Math.round(form.gasFeePerTx)),
      agentCount: BigInt(Math.round(form.agentCount)),
      storageGB: BigInt(Math.round(form.storageGB)),
    };
  }

  function handleApply() {
    updateCostModel.mutate(buildCostModel(), {
      onSuccess: () => {
        estimateCost.mutate(buildCostModel());
        toast.success("Cost model applied to backend");
      },
      onError: (e) => toast.error(e.message),
    });
  }

  function handleReset() {
    setForm(DEFAULT_FORM);
    setActiveScenario(null);
  }

  const isApplying = updateCostModel.isPending;

  return (
    <Layout>
      <div className="space-y-6" data-ocid="cost.page">
        {/* Page Header */}
        <LayerHeader
          layer={13}
          title="Cost & Infrastructure"
          description="Internet Computer infrastructure spend modeling for the Sovereign Monad ecosystem"
        />

        {/* Loading state */}
        {isLoading && (
          <div
            className="bg-card border border-border p-4 flex items-center gap-2"
            data-ocid="cost.loading_state"
          >
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="font-mono text-xs text-muted-foreground animate-pulse">
              LOADING COST MODEL...
            </span>
          </div>
        )}

        {/* 1. Current Cost Estimate — big display */}
        <CostTotalDisplay preview={preview} isFromBackend={appliedOnce} />

        {/* 2 + 3. Scenario presets + Interactive config in a two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left col: Scenarios */}
          <div className="xl:col-span-1 bg-card border border-border">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Cost Scenarios
                </span>
              </div>
            </div>
            <div className="panel-content space-y-2">
              {(Object.entries(SCENARIOS) as [Scenario, ScenarioConfig][]).map(
                ([key, cfg], i) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => applyScenario(key)}
                    className={`w-full text-left p-3 border transition-smooth ${
                      activeScenario === key
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border"
                    }`}
                    data-ocid={`cost.scenario.item.${i + 1}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          activeScenario === key
                            ? "text-primary"
                            : "text-foreground"
                        }`}
                      >
                        {cfg.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {cfg.agentCount} agents
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 leading-snug">
                      {cfg.description}
                    </p>
                    <div className="font-mono text-[10px] text-primary/70 mt-2">
                      ~$
                      {fmt(
                        calcLocalEstimate(
                          cfg.cyclesPerHour,
                          cfg.rpcCallsPerHour,
                          cfg.gasFeePerTx,
                          cfg.agentCount,
                          cfg.storageGB,
                        ).totalUsd,
                        2,
                      )}
                      /mo
                    </div>
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Right col: Parameter sliders */}
          <div className="xl:col-span-2 bg-card border border-border">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                    Cost Model Configuration
                  </span>
                  <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                    Adjust parameters — preview updates instantly
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-primary animate-pulse">
                  LIVE PREVIEW
                </span>
              </div>
            </div>
            <div className="p-4 space-y-5">
              {PARAMS.map((param, i) => (
                <SliderRow
                  key={param.key}
                  param={param}
                  value={form[param.key]}
                  onChange={(v) => setParam(param.key, v)}
                  index={i}
                />
              ))}

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="flex-1 font-mono text-xs tracking-widest"
                  data-ocid="cost.apply_button"
                >
                  {isApplying ? "APPLYING..." : "APPLY MODEL"}
                </Button>
                <Button
                  type="button"
                  onClick={handleReset}
                  variant="outline"
                  className="font-mono text-xs tracking-widest bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40"
                  data-ocid="cost.reset_button"
                >
                  RESET TO DEFAULT
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Infrastructure Notes */}
        <div className="bg-card border border-border">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Infrastructure Notes
              </span>
            </div>
          </div>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/30"
            data-ocid="cost.notes.list"
          >
            {[
              {
                icon: Zap,
                color: "text-primary",
                bg: "bg-primary/10",
                title: "IC Cycles",
                body: "Cycles are consumed by compute operations on the Internet Computer — each canister call burns cycles proportional to execution complexity.",
              },
              {
                icon: Activity,
                color: "text-secondary",
                bg: "bg-secondary/10",
                title: "RPC Endpoint Calls",
                body: "RPC calls are used by Pneuma (Market Intelligence) for price data intake from external oracles and data providers.",
              },
              {
                icon: BarChart3,
                color: "text-accent",
                bg: "bg-accent/10",
                title: "Gas Fees",
                body: "Gas fees apply to on-chain execution transactions via Cardia — each state-change transaction on ICP incurs a per-cycle fee.",
              },
              {
                icon: Database,
                color: "text-primary",
                bg: "bg-primary/5",
                title: "Storage Costs",
                body: "Storage costs scale with agent memory and audit log retention — the Gnosis Integrity Layer preserves historical records for axiom drift analysis.",
              },
            ].map(({ icon: Icon, color, bg, title, body }, i) => (
              <div
                key={title}
                className="bg-card p-4 flex gap-3"
                data-ocid={`cost.note.item.${i + 1}`}
              >
                <div
                  className={`flex-shrink-0 w-7 h-7 ${bg} flex items-center justify-center mt-0.5`}
                >
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div>
                  <div
                    className={`font-mono text-xs font-semibold ${color} uppercase tracking-wide`}
                  >
                    {title}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
