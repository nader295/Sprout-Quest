import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/10 dark:bg-zinc-800/50", className)}
      {...props}
    />
  );
}

export { Skeleton };
