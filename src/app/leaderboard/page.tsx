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

export default function LeaderboardPage() {
  const trpc = useTRPC();
  const q = useQuery(trpc.leaderboard.standings.queryOptions());
  const rows = q.data ?? [];
  const podium = rows.slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lestvica</h1>

      {q.isLoading && <Skeleton className="h-40 w-full" />}

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
