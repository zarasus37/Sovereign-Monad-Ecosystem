// L12: Deployment Orchestration — full step-by-step deploy management
import { DeployStepStatus } from "@/backend";
import { LayerHeader } from "@/components/LayerHeader";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DeployStep,
  useDeploymentConfig,
  useDeploymentSteps,
  useMarkStepComplete,
  useResetDeployment,
} from "@/hooks/use-ecosystem";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  RefreshCw,
  RotateCcw,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Static step definitions ───────────────────────────────────

const STEP_META: Record<
  number,
  { component: string; description: string; command: string; notes: string }
> = {
  1: {
    component: "HEPAR",
    description:
      "Deploy Hepar forensic intelligence engine — validates all incoming signals through four-stage pipeline (Static → Symbolic → Monte Carlo → Consensus)",
    command:
      "docker compose -f docker-compose.hepar.yml up -d && dfx deploy hepar --network ic",
    notes:
      "Hepar must be live before routing agents. Four-stage forensic pipeline: Static Analysis → Symbolic Execution → Monte Carlo Simulation → Consensus Fusion",
  },
  2: {
    component: "SYNAPSE",
    description:
      "Deploy Synapse signal intake and adaptive routing — classifies all signals across IMMEDIATE/STANDARD/LONGITUDINAL/Founder Review domains",
    command:
      "docker compose -f docker-compose.synapse.yml up -d && dfx deploy synapse --network ic",
    notes:
      "Synapse depends on Hepar being operational. Routes signals to appropriate processing queues.",
  },
  3: {
    component: "VOX",
    description:
      "Deploy Vox narrative intelligence and truth verification — captures narrative data, verifies truth claims, detects manipulation",
    command:
      "docker compose -f docker-compose.vox.yml up -d && dfx deploy vox --network ic",
    notes:
      "Vox subscribes to pattern.analysis from Synapse. Distributes verified narratives as INTERNAL/NDA/PUBLIC.",
  },
  4: {
    component: "PNEUMA",
    description:
      "Deploy Pneuma market intelligence and execution engine — processes price/liquidity data, classifies market regimes",
    command:
      "docker compose -f docker-compose.pneuma.yml up -d && dfx deploy pneuma --network ic",
    notes:
      "Pneuma currently CAPITAL-GATED. Publishes to market.signals and execution.execution-plan.",
  },
  5: {
    component: "CARDIA",
    description:
      "Deploy Cardia capital allocation engine — manages capital authorization and execution gating",
    command:
      "docker compose -f docker-compose.cardia.yml up -d && dfx deploy cardia --network ic",
    notes:
      "CAPITAL-GATED: Requires explicit authorization before activating. Subscribes to execution.execution-plan from Pneuma.",
  },
  6: {
    component: "ECOSYSTEM COORDINATION",
    description:
      "Activate full ecosystem coordination — all organs online, Gnosis Integrity Layer monitoring active",
    command: "docker compose -f docker-compose.sovereign-monad.yml up -d",
    notes:
      "Final step. All agents must be live and verified before activating full coordination. Gnosis Integrity Layer begins continuous axiom compliance monitoring.",
  },
};

const DOCKER_COMPOSE_SNIPPET = `version: '3.8'
services:
  hepar:
    image: sovereign-monad/hepar:latest
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      - NODE_ENV=production
      - NETWORK_ID=ic-mainnet

  synapse:
    image: sovereign-monad/synapse:latest
    restart: unless-stopped
    depends_on: [hepar]
    ports:
      - "8002:8002"
    environment:
      - HEPAR_ENDPOINT=http://hepar:8001

  vox:
    image: sovereign-monad/vox:latest
    restart: unless-stopped
    depends_on: [synapse]
    ports:
      - "8003:8003"

  pneuma:
    image: sovereign-monad/pneuma:latest
    restart: unless-stopped
    depends_on: [synapse]
    ports:
      - "8004:8004"
    environment:
      - CAPITAL_GATE=enabled

  cardia:
    image: sovereign-monad/cardia:latest
    restart: unless-stopped
    depends_on: [pneuma]
    ports:
      - "8005:8005"
    environment:
      - CAPITAL_GATE=enabled
      - AUTHORIZATION_REQUIRED=true

  gnosis-layer:
    image: sovereign-monad/gnosis:latest
    restart: unless-stopped
    depends_on: [hepar, synapse, vox, pneuma, cardia]
    ports:
      - "8010:8010"`;

// ─── Helpers ───────────────────────────────────────────────────

function stepBorderClass(status: DeployStepStatus): string {
  switch (status) {
    case DeployStepStatus.complete:
      return "border-primary/60 neon-border-cyan";
    case DeployStepStatus.running:
      return "border-secondary/60 neon-border-magenta";
    case DeployStepStatus.failed:
      return "border-destructive/60 neon-border-orange";
    default:
      return "border-border";
  }
}

function stepBadgeClass(status: DeployStepStatus): string {
  switch (status) {
    case DeployStepStatus.complete:
      return "bg-primary/10 text-primary border-primary/40";
    case DeployStepStatus.running:
      return "bg-secondary/10 text-secondary border-secondary/40";
    case DeployStepStatus.failed:
      return "bg-destructive/10 text-destructive border-destructive/40";
    case DeployStepStatus.skipped:
      return "bg-muted/60 text-muted-foreground border-border";
    default:
      return "bg-muted/40 text-muted-foreground border-border/60";
  }
}

function StepIcon({ status }: { status: DeployStepStatus }) {
  switch (status) {
    case DeployStepStatus.complete:
      return <CheckCircle className="w-5 h-5 text-primary" />;
    case DeployStepStatus.running:
      return <RefreshCw className="w-5 h-5 text-secondary animate-spin" />;
    case DeployStepStatus.failed:
      return <XCircle className="w-5 h-5 text-destructive" />;
    default:
      return <Clock className="w-5 h-5 text-muted-foreground/60" />;
  }
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied to clipboard`);
  });
}

// ─── Step Card ─────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onMarkComplete,
  isPending,
}: {
  step: DeployStep;
  index: number;
  onMarkComplete: (n: bigint) => void;
  isPending: boolean;
}) {
  const meta = STEP_META[Number(step.stepNumber)];
  const component = meta?.component ?? step.component;
  const description = meta?.description ?? step.description;
  const command = meta?.command ?? step.command;
  const notes = meta?.notes ?? step.notes;
  const isCapitalGated = notes?.includes("CAPITAL-GATED");

  return (
    <div
      className={`bg-card border p-5 transition-smooth ${stepBorderClass(step.status)}`}
      data-ocid={`deployment.step.item.${index + 1}`}
    >
      <div className="flex items-start gap-4">
        {/* Step number + icon */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2 pt-0.5">
          <div
            className={`w-9 h-9 border flex items-center justify-center ${
              step.status === DeployStepStatus.complete
                ? "border-primary/50 bg-primary/10"
                : step.status === DeployStepStatus.failed
                  ? "border-destructive/50 bg-destructive/10"
                  : step.status === DeployStepStatus.running
                    ? "border-secondary/50 bg-secondary/10"
                    : "border-border/60 bg-muted/20"
            }`}
          >
            <span
              className={`font-mono text-sm font-bold ${
                step.status === DeployStepStatus.complete
                  ? "text-primary"
                  : step.status === DeployStepStatus.failed
                    ? "text-destructive"
                    : step.status === DeployStepStatus.running
                      ? "text-secondary"
                      : "text-muted-foreground"
              }`}
            >
              {step.stepNumber.toString()}
            </span>
          </div>
          <StepIcon status={step.status} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-foreground tracking-[0.15em] uppercase">
              {component}
            </span>
            {isCapitalGated && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 bg-secondary/10 border border-secondary/40 text-secondary tracking-widest uppercase">
                CAPITAL-GATED
              </span>
            )}
            <span
              className={`ml-auto font-mono text-[10px] px-2 py-0.5 border tracking-widest uppercase ${stepBadgeClass(step.status)}`}
            >
              {step.status.toUpperCase()}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>

          {/* Command block */}
          <div className="relative group">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border border-border/40 border-b-0">
              <span className="font-mono text-[9px] text-muted-foreground/50 tracking-widest uppercase">
                COMMAND
              </span>
              <button
                type="button"
                aria-label="Copy command"
                onClick={() => copyToClipboard(command, "Command")}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-primary text-muted-foreground"
                data-ocid={`deployment.step.copy_command.${index + 1}`}
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <code className="block font-mono text-[11px] text-secondary bg-muted/20 border border-border/40 px-3 py-2.5 break-all leading-relaxed">
              {command}
            </code>
          </div>

          {/* Notes */}
          {notes && (
            <p className="text-[11px] text-accent/80 leading-relaxed font-mono border-l-2 border-accent/30 pl-3">
              {notes}
            </p>
          )}
        </div>

        {/* Action button */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2 pt-0.5">
          {step.status === DeployStepStatus.pending && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMarkComplete(step.stepNumber)}
              disabled={isPending}
              className="font-mono text-[10px] tracking-widest border-primary/40 text-primary hover:bg-primary/10 whitespace-nowrap"
              data-ocid={`deployment.step.complete_button.${index + 1}`}
            >
              <Zap className="w-3 h-3 mr-1.5" />
              MARK COMPLETE
            </Button>
          )}
          {step.status === DeployStepStatus.failed && (
            <>
              <span className="font-mono text-[9px] text-destructive tracking-widest uppercase">
                RETRY
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarkComplete(step.stepNumber)}
                disabled={isPending}
                className="font-mono text-[10px] tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap"
                data-ocid={`deployment.step.retry_button.${index + 1}`}
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                MARK COMPLETE
              </Button>
            </>
          )}
          {step.status === DeployStepStatus.skipped && (
            <span className="font-mono text-[10px] text-muted-foreground/50 tracking-widest uppercase border border-border/40 px-2 py-1">
              SKIPPED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────

function ProgressSection({ steps }: { steps: DeployStep[] }) {
  const total = steps.length;
  const complete = steps.filter(
    (s) => s.status === DeployStepStatus.complete,
  ).length;
  const pending = steps.filter(
    (s) => s.status === DeployStepStatus.pending,
  ).length;
  const failed = steps.filter(
    (s) => s.status === DeployStepStatus.failed,
  ).length;
  const skipped = steps.filter(
    (s) => s.status === DeployStepStatus.skipped,
  ).length;
  const running = steps.filter(
    (s) => s.status === DeployStepStatus.running,
  ).length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div
      className="bg-card border border-border p-5 space-y-4"
      data-ocid="deployment.progress.panel"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Deployment Progress
        </span>
        <span className="font-mono text-sm font-bold text-foreground">
          {complete}
          <span className="text-muted-foreground font-normal"> / {total}</span>
          <span className="text-[10px] text-muted-foreground/60 ml-1.5 font-normal tracking-wider">
            steps complete
          </span>
        </span>
      </div>

      <div className="h-3 bg-muted/40 w-full overflow-hidden border border-border/40">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
          data-ocid="deployment.progress.bar"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          { label: "Complete", count: complete, color: "text-primary" },
          { label: "Pending", count: pending, color: "text-muted-foreground" },
          { label: "Running", count: running, color: "text-secondary" },
          { label: "Failed", count: failed, color: "text-destructive" },
          {
            label: "Skipped",
            count: skipped,
            color: "text-muted-foreground/50",
          },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`font-mono text-sm font-bold ${s.color}`}>
              {s.count}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60 tracking-wider uppercase">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Docker Compose Reference ──────────────────────────────────

function DockerComposeSection() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bg-card border border-border"
      data-ocid="deployment.docker_compose.panel"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors"
        data-ocid="deployment.docker_compose.toggle"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Docker Compose Reference
          </span>
          <span className="font-mono text-[9px] px-2 py-0.5 bg-muted/40 border border-border/40 text-muted-foreground/60 tracking-widest uppercase">
            Full Stack
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div
          className="border-t border-border"
          data-ocid="deployment.docker_compose.content"
        >
          <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20 border-b border-border/40">
            <span className="font-mono text-[9px] tracking-widest text-muted-foreground/50 uppercase">
              docker-compose.sovereign-monad.yml
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                copyToClipboard(DOCKER_COMPOSE_SNIPPET, "Docker Compose config")
              }
              className="font-mono text-[10px] tracking-widest h-7 px-3 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
              data-ocid="deployment.docker_compose.copy_button"
            >
              <Copy className="w-3 h-3 mr-1.5" />
              COPY
            </Button>
          </div>
          <pre className="overflow-x-auto px-5 py-4 font-mono text-[11px] text-secondary leading-relaxed bg-muted/10">
            <code>{DOCKER_COMPOSE_SNIPPET}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Deployed Components ───────────────────────────────────────

function DeployedComponentsSection({ components }: { components: string[] }) {
  return (
    <div
      className="bg-card border border-border p-5 space-y-3"
      data-ocid="deployment.deployed_components.panel"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Deployed Components
        </span>
        <Badge className="font-mono text-[9px] bg-primary/10 text-primary border border-primary/30 rounded-none">
          {components.length} Active
        </Badge>
      </div>

      {components.length === 0 ? (
        <p
          className="text-xs text-muted-foreground/50 font-mono"
          data-ocid="deployment.deployed_components.empty_state"
        >
          No components deployed yet.
        </p>
      ) : (
        <div
          className="flex flex-wrap gap-2"
          data-ocid="deployment.deployed_components.list"
        >
          {components.map((c, i) => (
            <div
              key={c}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 border border-primary/20"
              data-ocid={`deployment.component.item.${i + 1}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-mono text-[11px] text-foreground/80 uppercase tracking-wider">
                {c}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reset Section ─────────────────────────────────────────────

function ResetSection({
  onReset,
  isPending,
}: {
  onReset: () => void;
  isPending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    onReset();
    setConfirming(false);
  }

  return (
    <div
      className="bg-card border border-destructive/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      data-ocid="deployment.reset.panel"
    >
      <div className="space-y-0.5">
        <span className="font-mono text-xs font-semibold text-destructive tracking-widest uppercase">
          Reset Deployment
        </span>
        <p className="text-xs text-muted-foreground">
          Resets all deployment steps to PENDING. This does not undeploy any
          running containers.
        </p>
      </div>

      {confirming ? (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="font-mono text-[10px] text-destructive tracking-wider">
            Are you sure? This resets all step statuses.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleConfirm}
            disabled={isPending}
            className="font-mono text-[10px] tracking-widest border-destructive/50 text-destructive hover:bg-destructive/10"
            data-ocid="deployment.reset.confirm_button"
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            CONFIRM RESET
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(false)}
            className="font-mono text-[10px] tracking-widest border-border/60 text-muted-foreground hover:text-foreground"
            data-ocid="deployment.reset.cancel_button"
          >
            CANCEL
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          className="flex-shrink-0 font-mono text-[10px] tracking-widest border-destructive/30 text-destructive hover:bg-destructive/10"
          data-ocid="deployment.reset_button"
        >
          <RotateCcw className="w-3 h-3 mr-1.5" />
          RESET DEPLOYMENT
        </Button>
      )}
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────

function DeploymentSkeleton() {
  return (
    <div className="space-y-4" data-ocid="deployment.loading_state">
      <Skeleton className="h-20 w-full bg-muted/40" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 w-full bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function DeploymentPage() {
  const { data: steps, isLoading, isError } = useDeploymentSteps();
  const { data: deployConfig } = useDeploymentConfig();
  const markComplete = useMarkStepComplete();
  const resetDeploy = useResetDeployment();

  function handleMarkComplete(stepNumber: bigint) {
    markComplete.mutate(stepNumber, {
      onSuccess: () =>
        toast.success(`Step ${stepNumber.toString()} marked complete`),
      onError: (e) => toast.error(e.message),
    });
  }

  function handleReset() {
    resetDeploy.mutate(undefined, {
      onSuccess: () =>
        toast.success("Deployment reset — all steps set to PENDING"),
      onError: (e) => toast.error(e.message),
    });
  }

  const sortedSteps = steps
    ? [...steps].sort((a, b) => Number(a.stepNumber) - Number(b.stepNumber))
    : [];

  return (
    <Layout>
      <div className="space-y-6" data-ocid="deployment.page">
        {/* Section 1: Page Header */}
        <div
          className="flex flex-col gap-4 pb-4 border-b border-border"
          data-ocid="deployment.header"
        >
          <LayerHeader
            layer={12}
            title="DEPLOYMENT ORCHESTRATION"
            description="Sovereign Monad ecosystem deployment sequence and Docker Compose integration"
          />

          {deployConfig && (
            <div className="flex flex-wrap items-center gap-3 ml-14">
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/30 bg-primary/5">
                <span className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase">
                  ENV
                </span>
                <span className="font-mono text-[11px] text-primary font-semibold">
                  {deployConfig.environment}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-secondary/30 bg-secondary/5">
                <span className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase">
                  NET
                </span>
                <span className="font-mono text-[11px] text-secondary font-semibold">
                  {deployConfig.networkId}
                </span>
              </div>
              {deployConfig.lastDeployTime && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border/40 bg-muted/20">
                  <Clock className="w-3 h-3 text-muted-foreground/60" />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Last deploy:{" "}
                    {new Date(
                      Number(deployConfig.lastDeployTime) / 1_000_000,
                    ).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span>Live — polling every 3s</span>
        </div>

        {/* Section 2: Progress */}
        {sortedSteps.length > 0 && <ProgressSection steps={sortedSteps} />}

        {/* Section 3: Deployment Steps */}
        {isLoading && <DeploymentSkeleton />}

        {isError && (
          <div
            className="bg-card border border-destructive/40 p-6 flex items-center gap-4"
            data-ocid="deployment.error_state"
          >
            <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <p className="font-mono text-xs font-semibold text-destructive uppercase tracking-widest">
                Deployment Feed Unavailable
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Unable to retrieve deployment steps from the backend. Retrying…
              </p>
            </div>
          </div>
        )}

        {!isLoading && sortedSteps.length > 0 && (
          <div className="space-y-3" data-ocid="deployment.steps.list">
            {sortedSteps.map((step, i) => (
              <StepCard
                key={step.stepNumber.toString()}
                step={step}
                index={i}
                onMarkComplete={handleMarkComplete}
                isPending={markComplete.isPending}
              />
            ))}
          </div>
        )}

        {/* Section 4: Docker Compose Reference */}
        <DockerComposeSection />

        {/* Section 5: Deployed Components */}
        {deployConfig && (
          <DeployedComponentsSection
            components={deployConfig.deployedComponents}
          />
        )}

        {/* Section 6: Reset Deployment */}
        <ResetSection onReset={handleReset} isPending={resetDeploy.isPending} />
      </div>
    </Layout>
  );
}
