import { LayerHeader } from "@/components/LayerHeader";
// Generic stub page — used for layers not yet fully implemented
import { Layout } from "@/components/Layout";

interface StubPageProps {
  layer: number;
  title: string;
  description: string;
}

export default function StubPage({ layer, title, description }: StubPageProps) {
  return (
    <Layout>
      <div className="space-y-6" data-ocid={`layer${layer}.page`}>
        <LayerHeader layer={layer} title={title} description={description} />
        <div className="bg-card border border-border p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
          <div className="w-16 h-16 border border-primary/30 bg-primary/5 flex items-center justify-center">
            <span className="font-mono text-lg font-bold text-primary">
              L{layer}
            </span>
          </div>
          <div className="text-center space-y-2">
            <p className="font-mono text-sm tracking-widest uppercase text-muted-foreground">
              Module Initializing
            </p>
            <p className="text-xs text-muted-foreground/60 max-w-xs">
              {title} — full panel implementation deploying in next wave.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="font-mono text-[10px] text-accent tracking-widest uppercase">
              Awaiting Deployment
            </span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
