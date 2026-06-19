import { ExternalLink, Search, Mail, FileText, CheckCircle, Activity, LayoutGrid } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LayerHeader } from "@/components/LayerHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const AZURE_LINK = "https://portal.azure.com/#resource/subscriptions/21542ebf-fe5c-4d86-a556-2e9279e8c147/resourceGroups/sovereign-monad-rg/providers/Microsoft.Web/sites/hepar-commercial-pipeline";

const PIPELINE_STAGES = [
  {
    name: "Lead Scan",
    icon: <Search className="w-4 h-4" />,
    status: "active",
    metric: "142 leads found today",
    health: 98,
    desc: "Scanning LinkedIn and commercial directories for SME targets."
  },
  {
    name: "Assignment Trigger",
    icon: <LayoutGrid className="w-4 h-4" />,
    status: "active",
    metric: "42 assigned",
    health: 100,
    desc: "Routing leads to specialized outreach agents based on domain."
  },
  {
    name: "Proposal Gen",
    icon: <FileText className="w-4 h-4" />,
    status: "active",
    metric: "28 generated",
    health: 95,
    desc: "Creating personalized social publish proposals for identified leads."
  },
  {
    name: "Outreach & Follow-up",
    icon: <Mail className="w-4 h-4" />,
    status: "active",
    metric: "12 responses",
    health: 88,
    desc: "Managing multi-channel touchpoints and automated follow-up sequences."
  },
  {
    name: "Closing Engine",
    icon: <CheckCircle className="w-4 h-4" />,
    status: "idle",
    metric: "4 pending",
    health: 92,
    desc: "Finalizing commercial contracts and ecosystem onboarding."
  }
];

export default function HepaPage() {
  return (
    <Layout>
      <div className="space-y-6" data-ocid="hepar.page">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <LayerHeader 
            layer={7} 
            title="Forensic Analysis (Hepar)" 
            description="Commercial Intelligence, Revenue Forensic, and Autonomous Sales Pipeline." 
          />
          <Button 
            variant="outline" 
            className="font-mono text-xs border-primary/40 text-primary hover:border-primary gap-2 h-9"
            onClick={() => window.open(AZURE_LINK, "_blank")}
          >
            <ExternalLink className="w-3 h-3" />
            OPEN AZURE PIPELINE
          </Button>
        </div>

        {/* Commercial Nerve Center Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="LEADS SCANNED" value="1,284" trend="+12%" variant="cyan" />
          <StatCard title="PROPOSALS SENT" value="342" trend="+5%" variant="magenta" />
          <StatCard title="CONVERSION RATE" value="14.2%" trend="+2.1%" variant="cyan" />
          <StatCard title="REVENUE AT RISK" value="$42,400" trend="-4%" variant="orange" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pipeline Stages */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-2">Commercial Pipeline Execution</h3>
            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage.name} className="bg-card border border-border p-4 rounded-sm flex items-center justify-between hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-border bg-muted/20 flex items-center justify-center text-primary">
                      {stage.icon}
                    </div>
                    <div>
                      <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest">{stage.name}</div>
                      <div className="font-mono text-[9px] text-muted-foreground mt-0.5">{stage.desc}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-primary tabular-nums">{stage.metric}</div>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", stage.status === "active" ? "bg-primary" : "bg-muted-foreground")} />
                      <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-tighter">{stage.status} // {stage.health}% Health</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Monitor */}
          <div className="space-y-4">
            <h3 className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-2">Activity Monitor</h3>
            <div className="bg-card border border-border rounded-sm h-[400px] overflow-hidden flex flex-col">
              <div className="p-3 border-b border-border bg-muted/10 flex justify-between items-center">
                <span className="font-mono text-[9px] text-muted-foreground uppercase">Hepar Event Stream</span>
                <Activity className="w-3 h-3 text-primary animate-pulse" />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <LogItem time="22:14:12" action="LEAD_SCAN" detail="Found 12 new SME targets in 'Real Estate' sector." variant="cyan" />
                <LogItem time="21:58:05" action="PROP_GEN" detail="Generated social-publish proposal for 'Apex Ventures'." variant="magenta" />
                <LogItem time="21:42:30" action="OUTREACH" detail="Automated follow-up sent to 'Summit Partners' (Touchpoint 3)." variant="cyan" />
                <LogItem time="21:15:00" action="CLOSE" detail="Contract signature pending for 'NorthStar Group'." variant="orange" />
                <LogItem time="20:55:12" action="MONITOR" detail="Commercial pipeline health nominal. No latency detected." variant="cyan" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, trend, variant }: { title: string, value: string, trend: string, variant: "cyan" | "magenta" | "orange" }) {
  const colorClass = {
    cyan: "text-primary",
    magenta: "text-secondary",
    orange: "text-accent",
  }[variant];

  return (
    <div className="bg-card border border-border p-4 rounded-sm">
      <div className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase mb-1">{title}</div>
      <div className="flex items-baseline justify-between">
        <div className={cn("font-mono text-xl font-bold tabular-nums", colorClass)}>{value}</div>
        <div className="font-mono text-[9px] text-primary bg-primary/10 px-1 rounded-sm">{trend}</div>
      </div>
    </div>
  );
}

function LogItem({ time, action, detail, variant }: { time: string, action: string, detail: string, variant: "cyan" | "magenta" | "orange" }) {
  const colorClass = {
    cyan: "text-primary border-primary/20",
    magenta: "text-secondary border-secondary/20",
    orange: "text-accent border-accent/20",
  }[variant];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-muted-foreground/60">{time}</span>
        <span className={cn("font-mono text-[8px] border px-1 rounded-sm uppercase tracking-tighter", colorClass)}>{action}</span>
      </div>
      <p className="font-mono text-[10px] text-foreground leading-tight">{detail}</p>
    </div>
  );
}
