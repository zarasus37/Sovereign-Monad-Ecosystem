// L2: Agent Core — Improvement agent capabilities, overview cards, and skills matrix
import { SkillCategory } from "@/backend";
import type { AgentCapabilities, AgentSkill, SkillsMatrix } from "@/backend";
import { LayerHeader } from "@/components/LayerHeader";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkillsMatrix } from "@/hooks/use-ecosystem";

// ─── Agent descriptions ───────────────────────────────────────────────────────
const AGENT_META: Record<string, { desc: string; domain: string }> = {
  Synapse: {
    domain: "Signal Intake & Routing",
    desc: "4-domain signal classification, conflict severity gap detection, adaptive blocking/escalation/aggregation",
  },
  Vox: {
    domain: "Narrative Intelligence",
    desc: "4-domain narrative capture, 100% fixture-verified truth verification, manipulation detection",
  },
  Pneuma: {
    domain: "Market Intelligence & Execution",
    desc: "Price/liquidity intake, latency penalty calculation, regime classification (NORMAL/STRESSED/CRISIS/RECOVERING)",
  },
};

// ─── Category grouping ────────────────────────────────────────────────────────
const CATEGORY_ORDER: SkillCategory[] = [
  SkillCategory.core,
  SkillCategory.domain,
  SkillCategory.integration,
  SkillCategory.integrity,
];

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  [SkillCategory.core]: "CORE SKILLS",
  [SkillCategory.domain]: "DOMAIN SKILLS",
  [SkillCategory.integration]: "INTEGRATION",
  [SkillCategory.integrity]: "INTEGRITY",
};

// ─── Agent Overview Card ──────────────────────────────────────────────────────
function AgentCard({
  agent,
  index,
}: { agent: AgentCapabilities; index: number }) {
  const meta = AGENT_META[agent.agentName];
  const rating = Number(agent.overallRating);
  const skillCount = agent.skills.length;
  const sharedCount = agent.skills.filter((s) => s.isShared).length;

  return (
    <div
      className="bg-card border border-border p-5 space-y-4 glow-cyan neon-border-cyan"
      data-ocid={`agentcore.agent.card.${index + 1}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm text-primary font-bold tracking-wider uppercase">
            {agent.agentName}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {meta?.domain ?? agent.domain}
          </div>
        </div>
        <Badge className="font-mono text-[9px] border text-secondary border-secondary/40 bg-secondary/10 whitespace-nowrap">
          LIVE · ADVISORY TIER
        </Badge>
      </div>

      {/* Rating bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="metric-label">Overall Rating</span>
          <span className="font-mono text-xs text-primary">{rating}/100</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-none">
          <div
            className="h-full bg-primary transition-all duration-700"
            style={{ width: `${rating}%` }}
          />
        </div>
      </div>

      {/* Skill counts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="metric-label">Skills</span>
          <div className="font-mono text-lg font-bold text-primary">
            {skillCount}
          </div>
        </div>
        <div>
          <span className="metric-label">Shared</span>
          <div className="font-mono text-lg font-bold text-secondary">
            {sharedCount}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border/40 pt-3">
        {meta?.desc}
      </p>
    </div>
  );
}

// ─── Skills Matrix Table ──────────────────────────────────────────────────────
function skillsByCategory(
  agents: AgentCapabilities[],
  category: SkillCategory,
): { name: string; isShared: boolean; levels: Map<string, bigint> }[] {
  const skillMap = new Map<
    string,
    { isShared: boolean; levels: Map<string, bigint> }
  >();
  for (const agent of agents) {
    for (const skill of agent.skills) {
      if (skill.category !== category) continue;
      if (!skillMap.has(skill.name)) {
        skillMap.set(skill.name, {
          isShared: skill.isShared,
          levels: new Map(),
        });
      }
      const entry = skillMap.get(skill.name)!;
      entry.levels.set(agent.agentName, skill.level);
      if (skill.isShared) entry.isShared = true;
    }
  }
  return Array.from(skillMap.entries()).map(([name, v]) => ({ name, ...v }));
}

function SkillCell({
  skill,
  agentName,
  levels,
}: {
  skill: { name: string; isShared: boolean; levels: Map<string, bigint> };
  agentName: string;
  levels: Map<string, bigint>;
}) {
  const level = levels.get(agentName);
  if (level === undefined) {
    return (
      <td className="px-3 py-2.5 text-center">
        <div
          className="inline-flex w-5 h-5 rounded-full border border-border/30 bg-muted/20"
          aria-label="Not present"
        />
      </td>
    );
  }
  return (
    <td className="px-3 py-2.5 text-center">
      <div className="inline-flex items-center justify-center relative">
        {skill.isShared ? (
          <span
            className="text-secondary text-base leading-none"
            title={`Level ${level} — shared skill`}
            aria-label={`Level ${level}, shared`}
          >
            ★
          </span>
        ) : (
          <div
            className="w-5 h-5 rounded-full bg-primary/20 border border-primary/60 flex items-center justify-center"
            aria-label={`Level ${level}`}
          >
            <span className="font-mono text-[8px] text-primary">
              {level.toString()}
            </span>
          </div>
        )}
      </div>
    </td>
  );
}

function CapabilityMatrix({ matrix }: { matrix: SkillsMatrix }) {
  const { agents } = matrix;
  const agentNames = agents.map((a) => a.agentName);

  return (
    <div
      className="bg-card border border-border"
      data-ocid="agentcore.matrix.panel"
    >
      <div className="panel-header">
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Capability Matrix
        </span>
        <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="text-secondary">★</span> Shared skill
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex w-3.5 h-3.5 rounded-full bg-primary/20 border border-primary/60" />{" "}
            Present
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex w-3.5 h-3.5 rounded-full border border-border/30 bg-muted/20" />{" "}
            Absent
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-ocid="agentcore.matrix.table">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 font-mono tracking-wider text-muted-foreground min-w-[200px]">
                SKILL
              </th>
              {agentNames.map((name) => (
                <th
                  key={name}
                  className="px-3 py-2 font-mono tracking-wider text-primary text-center"
                >
                  {name.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((category) => {
              const skills = skillsByCategory(agents, category);
              if (skills.length === 0) return null;
              return (
                <>
                  {/* Category header row */}
                  <tr
                    key={`cat-${category}`}
                    className="bg-muted/30 border-y border-border/60"
                  >
                    <td
                      colSpan={agentNames.length + 1}
                      className="px-4 py-1.5 font-mono text-[9px] tracking-[0.2em] text-muted-foreground/60 uppercase"
                    >
                      {CATEGORY_LABELS[category]}
                    </td>
                  </tr>

                  {skills.map((skill, i) => (
                    <tr
                      key={skill.name}
                      className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${
                        skill.isShared ? "bg-primary/5" : ""
                      }`}
                      data-ocid={`agentcore.skill.item.${i + 1}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              skill.isShared
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {skill.name}
                          </span>
                          {skill.isShared && (
                            <Badge className="font-mono text-[8px] border border-secondary/30 bg-secondary/10 text-secondary px-1 py-0">
                              SHARED
                            </Badge>
                          )}
                        </div>
                      </td>
                      {agentNames.map((agentName) => (
                        <SkillCell
                          key={agentName}
                          skill={skill}
                          agentName={agentName}
                          levels={skill.levels}
                        />
                      ))}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared Skills Highlight ──────────────────────────────────────────────────
function SharedSkillsPanel({ sharedSkills }: { sharedSkills: string[] }) {
  return (
    <div
      className="bg-card border border-secondary/30 p-5 space-y-3 neon-border-magenta"
      data-ocid="agentcore.sharedskills.panel"
    >
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-secondary" />
        <span className="font-mono text-xs tracking-widest text-secondary uppercase">
          Cross-Agent Shared Capabilities
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        These skills are present across multiple agents — they form the shared
        behavioral substrate that aligns the ecosystem. The{" "}
        <span className="text-secondary font-semibold">
          Aligning Adaptability / Self-Improving
        </span>{" "}
        capability binds all agents to continuous improvement under the Gnosis
        framework.
      </p>
      <div className="flex flex-wrap gap-2">
        {sharedSkills.map((skill) => (
          <Badge
            key={skill}
            className="font-mono text-[10px] border border-secondary/40 bg-secondary/10 text-secondary px-2 py-1"
          >
            ★ {skill}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgentCorePage() {
  const { data: matrix, isLoading, isError } = useSkillsMatrix();

  return (
    <Layout>
      <div className="space-y-6" data-ocid="agentcore.page">
        <LayerHeader
          layer={2}
          title="Agent Core"
          description="Improvement agent capabilities and skill composition"
        />

        {isLoading && (
          <div className="space-y-4" data-ocid="agentcore.loading_state">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {isError && (
          <div
            className="bg-card border border-destructive/40 p-8 flex items-center justify-center"
            data-ocid="agentcore.error_state"
          >
            <span className="font-mono text-xs text-destructive animate-pulse">
              ERROR LOADING SKILLS MATRIX
            </span>
          </div>
        )}

        {!isLoading && matrix && (
          <>
            {/* Agent overview cards */}
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              data-ocid="agentcore.agents.list"
            >
              {matrix.agents.map((agent, i) => (
                <AgentCard key={agent.agentName} agent={agent} index={i} />
              ))}
            </div>

            {/* Shared skills highlight */}
            {matrix.sharedSkills.length > 0 && (
              <SharedSkillsPanel sharedSkills={matrix.sharedSkills} />
            )}

            {/* Capability matrix table */}
            <CapabilityMatrix matrix={matrix} />
          </>
        )}
      </div>
    </Layout>
  );
}
