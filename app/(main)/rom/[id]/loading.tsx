import { Skeleton } from "@/components/ui/skeleton";

export default function RomDetailsLoading() {
  return (
    <div className="container mx-auto px-4 lg:px-8 py-8 md:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 row-span-full">
        <div className="lg:col-span-2 space-y-8">
          {/* Header Area */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Skeleton className="w-32 h-32 md:w-40 md:h-40 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-4 w-full">
              <Skeleton className="h-10 w-3/4" />
              <div className="flex gap-3">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-6 w-1/2" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="h-12 w-32 rounded-xl" />
                <Skeleton className="h-12 w-12 rounded-xl" />
              </div>
            </div>
          </div>
          
          {/* Main Info Box */}
          <div className="p-6 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          
          {/* Tabs Area */}
          <div className="space-y-6">
            <div className="flex gap-4 border-b border-white/10 pb-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="space-y-4 py-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          </div>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
