import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rectangular" | "circular" | "text" | "card";
  animate?: "pulse" | "shimmer" | "none";
}

export function Skeleton({ 
  className, 
  variant = "rectangular", 
  animate = "shimmer", 
  ...props 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-muted/30 overflow-hidden relative",
        
        // Variants
        variant === "circular" && "rounded-full aspect-square",
        variant === "rectangular" && "rounded-md",
        variant === "text" && "rounded-sm h-4 w-full",
        variant === "card" && "rounded-2xl h-48 w-full border border-border/10",
        
        // Animations
        animate === "pulse" && "animate-pulse",
        animate === "shimmer" && "skeleton-shimmer",
        
        className
      )}
      {...props}
    >
      {animate === "shimmer" && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      )}
    </div>
  );
}

// Pre-composed skeletons for common RomX platform components
export function ROMCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/40 bg-card/20">
      <div className="flex gap-3">
        <Skeleton variant="circular" className="h-12 w-12 shrink-0" />
        <div className="flex flex-col gap-2 w-full justify-center">
          <Skeleton variant="text" className="w-3/4 h-3.5" />
          <Skeleton variant="text" className="w-1/2 h-2.5 opacity-60" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="w-full h-32 rounded-lg mt-2" />
      <div className="flex justify-between items-center mt-1">
        <Skeleton variant="circular" className="h-6 w-16 rounded-full" />
        <Skeleton variant="circular" className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function UserProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Skeleton variant="circular" className="h-24 w-24 ring-4 ring-background" />
      <Skeleton variant="text" className="w-48 h-5" />
      <Skeleton variant="text" className="w-32 h-3 opacity-60 -mt-2" />
      <div className="flex gap-4 mt-2">
        <Skeleton variant="rectangular" className="w-24 h-16 rounded-xl" />
        <Skeleton variant="rectangular" className="w-24 h-16 rounded-xl" />
        <Skeleton variant="rectangular" className="w-24 h-16 rounded-xl" />
      </div>
    </div>
  );
}
