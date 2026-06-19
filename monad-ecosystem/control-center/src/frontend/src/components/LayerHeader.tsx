// LayerHeader — reusable header for each 15-layer page
import { cn } from "@/lib/utils";

interface LayerHeaderProps {
  layer: number;
  title: string;
  description: string;
  className?: string;
}

export function LayerHeader({
  layer,
  title,
  description,
  className,
}: LayerHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 pb-4 border-b border-border",
        className,
      )}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center">
        <span className="font-mono text-xs font-bold text-primary">
          L{layer}
        </span>
      </div>
      <div>
        <h1 className="font-mono text-sm tracking-[0.2em] uppercase text-foreground font-semibold">
          {title}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
