// L9: Network Coordination — Kafka Signal Event Bus wiring diagram + topology stats
import { TopicRole } from "@/backend";
import type { KafkaConnection, KafkaTopic, KafkaTopology } from "@/backend";
import { LayerHeader } from "@/components/LayerHeader";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useKafkaTopology } from "@/hooks/use-ecosystem";

// ─── Static descriptions (topic id → description) ───────────────────────────
const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "pattern.analysis": "Signal classification & adaptive routing patterns",
  "narrative.output": "Narrative intelligence & truth-verified outputs",
  "market.signals": "Price, liquidity & regime classification events",
  "integrity.audit": "Gnosis integrity scores & axiom drift events",
  "execution.execution-plan": "Capital allocation & execution strategy plans",
  "system.state": "System-wide state broadcast & telemetry",
};

// ─── Role colors ─────────────────────────────────────────────────────────────
function roleColor(role: TopicRole) {
  switch (role) {
    case TopicRole.publisher:
      return "text-primary border-primary/40 bg-primary/10";
    case TopicRole.subscriber:
      return "text-secondary border-secondary/40 bg-secondary/10";
    case TopicRole.both:
      return "text-accent border-accent/40 bg-accent/10";
  }
}

function roleLine(role: TopicRole) {
  switch (role) {
    case TopicRole.publisher:
      return "stroke-[oklch(0.85_0.25_195)]";
    case TopicRole.subscriber:
      return "stroke-[oklch(0.7_0.33_305)]";
    case TopicRole.both:
      return "stroke-[oklch(0.65_0.25_40)]";
  }
}

function roleLabel(role: TopicRole) {
  switch (role) {
    case TopicRole.publisher:
      return "PUBLISH";
    case TopicRole.subscriber:
      return "SUBSCRIBE";
    case TopicRole.both:
      return "PUB/SUB";
  }
}

// ─── Wiring diagram layout constants ─────────────────────────────────────────
const DIAGRAM_WIDTH = 900;
const DIAGRAM_HEIGHT = 380;
const AGENT_X = 90;
const TOPIC_X = 810;
const PILL_W = 130;
const PILL_H = 28;

// ─── SVG Wiring Diagram ───────────────────────────────────────────────────────
function WiringDiagram({ connections }: { connections: KafkaConnection[] }) {
  // Derive unique agents and topics from live data; fall back to statics while empty
  const liveAgents = Array.from(new Set(connections.map((c) => c.fromAgent)));
  const liveTopics = Array.from(new Set(connections.map((c) => c.toTopic)));

  // Normalise: strip "agent." prefix for display labels
  const agentLabel = (a: string) => a.replace(/^\./, "").toUpperCase();

  const numAgents = liveAgents.length || 1;
  const numTopics = liveTopics.length || 1;
  const agentRowH = DIAGRAM_HEIGHT / (numAgents + 1);
  const topicRowH = DIAGRAM_HEIGHT / (numTopics + 1);

  const getAgentY = (idx: number) => (idx + 1) * agentRowH;
  const getTopicY = (idx: number) => (idx + 1) * topicRowH;

  return (
    <div
      className="bg-card border border-border overflow-x-auto"
      data-ocid="network.wiring.panel"
    >
      <div className="panel-header">
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Signal Event Bus — Agent-to-Topic Wiring
        </span>
        {/* Legend */}
        <div className="flex items-center gap-4">
          {(
            [TopicRole.publisher, TopicRole.subscriber, TopicRole.both] as const
          ).map((role) => (
            <div key={role} className="flex items-center gap-1.5">
              <div
                className={`w-3 h-0.5 ${
                  role === TopicRole.publisher
                    ? "bg-primary"
                    : role === TopicRole.subscriber
                      ? "bg-secondary"
                      : "bg-accent"
                }`}
              />
              <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                {roleLabel(role)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 min-w-[900px]">
        <svg
          viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
          width={DIAGRAM_WIDTH}
          height={DIAGRAM_HEIGHT}
          className="w-full max-w-[900px]"
          role="img"
          aria-label="Agent-to-Topic wiring diagram"
        >
          {/* Connection lines from live data */}
          {connections.map((conn, _i) => {
            const aIdx = liveAgents.indexOf(conn.fromAgent);
            const tIdx = liveTopics.indexOf(conn.toTopic);
            if (aIdx === -1 || tIdx === -1) return null;
            const x1 = AGENT_X + PILL_W / 2;
            const y1 = getAgentY(aIdx);
            const x2 = TOPIC_X - PILL_W / 2;
            const y2 = getTopicY(tIdx);
            const cx1 = x1 + (x2 - x1) * 0.45;
            const cx2 = x2 - (x2 - x1) * 0.45;
            const lineClass = roleLine(conn.connectionType);
            return (
              <path
                key={`conn-${conn.fromAgent}-${conn.toTopic}`}
                d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                fill="none"
                className={`${lineClass} opacity-60`}
                strokeWidth="1.5"
                strokeDasharray={
                  conn.connectionType === TopicRole.subscriber
                    ? "4 3"
                    : conn.connectionType === TopicRole.both
                      ? "6 2 2 2"
                      : "none"
                }
              />
            );
          })}

          {/* Agent nodes (left) */}
          {liveAgents.map((agent, i) => {
            const y = getAgentY(i);
            return (
              <g
                key={agent}
                transform={`translate(${AGENT_X - PILL_W / 2}, ${y - PILL_H / 2})`}
              >
                <rect
                  width={PILL_W}
                  height={PILL_H}
                  rx="2"
                  className="fill-[oklch(0.12_0_0)] stroke-[oklch(0.25_0.08_195)]"
                  strokeWidth="1"
                />
                <text
                  x={PILL_W / 2}
                  y={PILL_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-[oklch(0.85_0.25_195)] font-mono text-[11px] tracking-widest"
                  style={{
                    fontFamily: "GeistMono, monospace",
                    fontSize: 11,
                    letterSpacing: "0.12em",
                  }}
                >
                  {agentLabel(agent)}
                </text>
              </g>
            );
          })}

          {/* Topic nodes (right) */}
          {liveTopics.map((topic, i) => {
            const y = getTopicY(i);
            return (
              <g
                key={topic}
                transform={`translate(${TOPIC_X - PILL_W / 2}, ${y - PILL_H / 2})`}
              >
                <rect
                  width={PILL_W}
                  height={PILL_H}
                  rx="2"
                  className="fill-[oklch(0.14_0.02_195)] stroke-[oklch(0.35_0.12_195)]"
                  strokeWidth="1"
                />
                <text
                  x={PILL_W / 2}
                  y={PILL_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontFamily: "GeistMono, monospace",
                    fontSize: 9,
                    letterSpacing: "0.04em",
                    fill: "oklch(0.7 0.2 195)",
                  }}
                >
                  {topic}
                </text>
              </g>
            );
          })}

          {/* Column labels */}
          <text
            x={AGENT_X}
            y={14}
            textAnchor="middle"
            style={{
              fontFamily: "GeistMono, monospace",
              fontSize: 9,
              fill: "oklch(0.5 0 0)",
              letterSpacing: "0.15em",
            }}
          >
            AGENTS
          </text>
          <text
            x={TOPIC_X}
            y={14}
            textAnchor="middle"
            style={{
              fontFamily: "GeistMono, monospace",
              fontSize: 9,
              fill: "oklch(0.5 0 0)",
              letterSpacing: "0.15em",
            }}
          >
            TOPICS
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─── Topic Stats Card ─────────────────────────────────────────────────────────
function TopicCard({
  topic,
  connCount,
}: { topic: KafkaTopic; connCount: number }) {
  const description = TOPIC_DESCRIPTIONS[topic.id] ?? topic.description;
  return (
    <div className="bg-card border border-primary/20 p-4 space-y-2 neon-border-cyan glow-cyan">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] text-primary tracking-wider uppercase leading-tight">
          {topic.name}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/60">
          {connCount} conn
        </span>
      </div>
      <p className="text-xs text-muted-foreground/70 leading-snug">
        {description}
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div>
          <div className="metric-label">Messages</div>
          <div className="font-mono text-sm font-bold text-primary">
            {topic.messageCount.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="metric-label">Throughput</div>
          <div className="font-mono text-sm font-bold text-primary">
            {topic.throughput.toLocaleString()}/s
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Connection Table ─────────────────────────────────────────────────────────
function ConnectionTable({ connections }: { connections: KafkaConnection[] }) {
  return (
    <div className="bg-card border border-border">
      <div className="panel-header">
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Active Connections
        </span>
        <span className="font-mono text-xs text-primary">
          {connections.length} total
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-ocid="network.connections.table">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2 font-mono tracking-wider">
                AGENT
              </th>
              <th className="text-left px-4 py-2 font-mono tracking-wider">
                TOPIC
              </th>
              <th className="text-left px-4 py-2 font-mono tracking-wider">
                ROLE
              </th>
            </tr>
          </thead>
          <tbody>
            {connections.map((conn, i) => (
              <tr
                key={`${conn.fromAgent}-${conn.toTopic}`}
                className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                data-ocid={`network.connection.item.${i + 1}`}
              >
                <td className="px-4 py-3 font-mono text-foreground">
                  {conn.fromAgent}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {conn.toTopic}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={`font-mono text-[9px] border ${roleColor(conn.connectionType)}`}
                  >
                    {roleLabel(conn.connectionType)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────
function SummaryBar({ data }: { data: KafkaTopology }) {
  const avgThroughput =
    data.topics.length > 0
      ? data.topics.reduce((acc, t) => acc + Number(t.throughput), 0) /
        data.topics.length
      : 0;
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
      data-ocid="network.summary.panel"
    >
      {[
        { label: "Topics", value: data.topics.length },
        { label: "Connections", value: data.connections.length },
        {
          label: "Total Messages",
          value: Number(data.totalMessages).toLocaleString(),
        },
        { label: "Avg Throughput", value: `${avgThroughput.toFixed(0)}/s` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-card border border-border p-4 space-y-1">
          <span className="metric-label">{label}</span>
          <div className="metric-value">{value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const { data, isLoading, isError } = useKafkaTopology();

  return (
    <Layout>
      <div className="space-y-6" data-ocid="network.page">
        <LayerHeader
          layer={9}
          title="Network Coordination"
          description="Event bus topology and signal routing infrastructure"
        />

        {isLoading && (
          <div className="space-y-4" data-ocid="network.loading_state">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-[420px] w-full" />
          </div>
        )}

        {isError && (
          <div
            className="bg-card border border-destructive/40 p-8 flex items-center justify-center"
            data-ocid="network.error_state"
          >
            <span className="font-mono text-xs text-destructive animate-pulse">
              ERROR LOADING KAFKA TOPOLOGY
            </span>
          </div>
        )}

        {!isLoading && data && (
          <>
            <SummaryBar data={data} />
            <WiringDiagram connections={data.connections} />

            {/* Topic Stats Grid */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Topic Statistics
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                data-ocid="network.topics.list"
              >
                {data.topics.map((topic, i) => {
                  const connCount = data.connections.filter(
                    (c) => c.toTopic === topic.id,
                  ).length;
                  return (
                    <div
                      key={topic.id}
                      data-ocid={`network.topic.item.${i + 1}`}
                    >
                      <TopicCard topic={topic} connCount={connCount} />
                    </div>
                  );
                })}
              </div>
            </div>

            <ConnectionTable connections={data.connections} />
          </>
        )}
      </div>
    </Layout>
  );
}
