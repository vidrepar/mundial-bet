"use client";

import { Skeleton } from "@/components/ui/skeleton";

/* route-level Suspense shell → instant paint on client navigation */
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
