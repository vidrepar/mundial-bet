"use client";

import { useQuery } from "@tanstack/react-query";
import { BorderBeam } from "@/components/magicui/border-beam";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/trpc/client";

const MEDALS = ["🥇", "🥈", "🥉"];

function Delta({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-emerald-500">▲{delta}</span>;
  if (delta < 0) return <span className="text-red-500">▼{-delta}</span>;
  return <span className="text-muted-foreground">·</span>;
}

export default function LeaderboardPage() {
  const trpc = useTRPC();
  const q = useQuery(trpc.leaderboard.standings.queryOptions());
  const live = useQuery({
    ...trpc.leaderboard.live.queryOptions(),
    refetchInterval: 30_000,
  });
  const rows = q.data ?? [];
  const liveRows = live.data ?? [];
  const podium = rows.slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lestvica</h1>

      {q.isLoading && <Skeleton className="h-40 w-full" />}

      {/* live provisional standings while matches are on */}
      {liveRows.length > 0 && (
        <Card className="border-red-600/40">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-600" />
              </span>
              LIVE · if matches ended now
            </div>
            {liveRows.map((r) => (
              <div key={r.userId} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-5 text-center font-bold">{r.liveRank}</span>
                  <span className="w-7 text-center text-xs tabular-nums">
                    <Delta delta={r.delta} />
                  </span>
                  <UserAvatar name={r.name} image={r.image} className="size-6" />
                  <span className="font-medium">{r.name}</span>
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {r.prov !== 0 && (
                    <span className="font-medium text-primary">
                      {r.prov > 0 ? `+${r.prov}` : r.prov}
                    </span>
                  )}
                  <span className="text-base font-bold">{r.livePoints}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* podium */}
      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[1, 0, 2].map((idx) => {
            const r = podium[idx];
            if (!r) return <div key={idx} />;
            const tall = idx === 0;
            return (
              <Card
                key={r.userId}
                className={
                  "relative items-center overflow-hidden text-center " +
                  (tall ? "pt-8" : "pt-6 self-end")
                }
              >
                {tall && <BorderBeam size={120} duration={8} />}
                <CardContent className="flex flex-col items-center gap-1">
                  <div className="text-3xl">{MEDALS[idx]}</div>
                  <UserAvatar
                    name={r.name}
                    image={r.image}
                    className="size-12"
                  />
                  <p className="mt-1 font-semibold">{r.name}</p>
                  <p className="text-2xl font-extrabold text-primary">
                    <NumberTicker value={r.points} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    🎯 {r.exact} · ✅ {r.hits}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* full table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Pts</TableHead>
                <TableHead className="text-right">Exact</TableHead>
                <TableHead className="text-right">Hits</TableHead>
                <TableHead className="text-right">Missed</TableHead>
                <TableHead className="text-right">Hit %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-bold">
                    {MEDALS[r.rank - 1] ?? r.rank}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <UserAvatar
                        name={r.name}
                        image={r.image}
                        className="size-6"
                      />
                      <span className="font-medium">{r.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-base font-bold">
                    {r.points}
                  </TableCell>
                  <TableCell className="text-right">{r.exact}</TableCell>
                  <TableCell className="text-right">{r.hits}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.missed ? `−${r.missed}` : 0}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.hitRate}%
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !q.isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No players yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
