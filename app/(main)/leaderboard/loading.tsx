import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col items-center justify-center gap-4 mb-12">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-12 items-end justify-center max-w-2xl mx-auto">
        {/* Ranked 2 */}
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-16 w-16 md:h-20 md:w-20 rounded-full" />
          <Skeleton className="h-24 w-full rounded-t-lg bg-zinc-800/60" />
        </div>
        {/* Ranked 1 */}
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-full" />
          <Skeleton className="h-32 w-full rounded-t-lg bg-amber-500/20" />
        </div>
        {/* Ranked 3 */}
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-16 w-16 md:h-20 md:w-20 rounded-full" />
          <Skeleton className="h-20 w-full rounded-t-lg bg-yellow-700/30" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/40 border border-white/5">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-5 w-48" />
            <div className="flex-1" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
