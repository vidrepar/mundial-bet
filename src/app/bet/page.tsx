"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MatchBetCard } from "@/components/match-bet-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const FILTERS = [
  { k: "open", label: "Open" },
  { k: "all", label: "All" },
  { k: "finished", label: "Finished" },
] as const;

type Filter = (typeof FILTERS)[number]["k"];

export default function BetPage() {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const [filter, setFilter] = useState<Filter>("open");

  const matches = useQuery(trpc.matches.list.queryOptions({ filter }));
  const admin = useQuery({
    ...trpc.admin.amAdmin.queryOptions(),
    enabled: !!session?.user,
  });

  const signedIn = !!session?.user;
  const isAdmin = !!admin.data?.isAdmin;

  /* group matches by calendar day */
  const groups = new Map<string, NonNullable<typeof matches.data>>();
  for (const m of matches.data ?? []) {
    const key = fmtDay(m.kickoff);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Matches</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <Button
              key={f.k}
              size="sm"
              variant="ghost"
              onClick={() => setFilter(f.k)}
              className={cn(
                "h-7",
                filter === f.k && "bg-background shadow-sm",
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {!signedIn && (
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Sign in with Google to place your picks. You can browse the schedule
          either way.
        </div>
      )}

      {matches.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {matches.data?.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          Nothing here right now.
        </p>
      )}

      {[...groups.entries()].map(([day, ms]) => (
        <section key={day} className="space-y-3">
          <h2 className="sticky top-14 z-10 -mx-1 bg-background/80 px-1 py-1 text-sm font-semibold text-muted-foreground backdrop-blur">
            {day}
          </h2>
          {ms.map((m) => (
            <MatchBetCard
              key={m.id}
              match={m}
              signedIn={signedIn}
              isAdmin={isAdmin}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
