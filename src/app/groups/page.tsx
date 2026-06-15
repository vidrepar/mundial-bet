"use client";

import { useQuery } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { fmtKickoff } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

export default function GroupsPage() {
  const trpc = useTRPC();
  const q = useQuery({
    ...trpc.groups.overview.queryOptions(),
    refetchInterval: 30_000,
  });
  const groups = q.data ?? [];
  const [sel, setSel] = useState<string | null>(null);
  const active = groups.find((g) => g.name === sel) ?? groups[0];

  async function share() {
    const url = window.location.href;
    const title = "Mundial '26 — Groups";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied 📋");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Button variant="secondary" size="sm" onClick={share} className="gap-1.5">
          <Share2 className="size-4" /> Share
        </Button>
      </div>

      {q.isLoading && <Skeleton className="h-64 w-full" />}

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {groups.map((g) => (
            <Button
              key={g.name}
              size="sm"
              variant="ghost"
              onClick={() => setSel(g.name)}
              className={cn("h-8 w-9 p-0 font-bold", active?.name === g.name && "bg-accent")}
            >
              {g.name}
            </Button>
          ))}
        </div>
      )}

      {active && (
        <div className="space-y-4">
          {/* group table */}
          <Card>
            <CardContent>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">Group {active.name}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">P</TableHead>
                    <TableHead className="text-right">W</TableHead>
                    <TableHead className="text-right">D</TableHead>
                    <TableHead className="text-right">L</TableHead>
                    <TableHead className="text-right">GD</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.table.map((t, i) => (
                    <TableRow key={t.team} className={cn(i < 2 && "bg-emerald-500/5")}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span>{t.flag}</span>
                          {t.team}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{t.p}</TableCell>
                      <TableCell className="text-right">{t.w}</TableCell>
                      <TableCell className="text-right">{t.d}</TableCell>
                      <TableCell className="text-right">{t.l}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.gd > 0 ? `+${t.gd}` : t.gd}
                      </TableCell>
                      <TableCell className="text-right text-base font-bold">{t.pts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* per-group prediction leaderboard */}
          {active.standings.length > 0 && (
            <Card>
              <CardContent className="space-y-1">
                <p className="mb-1 text-sm font-semibold text-muted-foreground">
                  Group {active.name} predictors
                </p>
                {active.standings.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-4 font-bold">{i + 1}</span>
                      <UserAvatar name={s.name} image={s.image} className="size-6" />
                      {s.name}
                    </span>
                    <span className="font-bold text-primary">{s.points}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* fixtures + everyone's picks */}
          <div className="space-y-2">
            {active.fixtures.map((f) => (
              <Card key={f.id}>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      <span>{f.homeFlag}</span>
                      {f.homeTeam}
                    </span>
                    <span className="tabular-nums font-bold">
                      {f.finished || f.homeScore != null ? `${f.homeScore ?? 0} – ${f.awayScore ?? 0}` : "vs"}
                    </span>
                    <span className="flex items-center gap-2 font-medium">
                      {f.awayTeam}
                      <span>{f.awayFlag}</span>
                    </span>
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground">{fmtKickoff(f.kickoff)}</p>
                  {f.locked ? (
                    f.picks.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 border-t pt-2">
                        {f.picks.map((p) => (
                          <span
                            key={p.name}
                            className="flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
                          >
                            <UserAvatar name={p.name} image={p.image} className="size-4" />
                            <span className="tabular-nums font-medium">
                              {p.predHome}–{p.predAway}
                            </span>
                            {p.points != null && p.points > 0 && (
                              <Badge variant="success" className="px-1 py-0 text-[10px]">
                                +{p.points}
                              </Badge>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="border-t pt-2 text-center text-xs text-muted-foreground">
                        No picks.
                      </p>
                    )
                  ) : (
                    <p className="border-t pt-2 text-center text-xs text-muted-foreground">
                      Picks hidden until kickoff.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!q.isLoading && groups.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">No groups yet.</p>
      )}
    </div>
  );
}
