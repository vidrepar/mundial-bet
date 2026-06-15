"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";

/* lazy-load the chart (recharts) so it never bloats the initial Stats bundle */
const PointsChart = dynamic(
  () => import("@/components/points-chart").then((m) => m.PointsChart),
  { ssr: false, loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-muted" /> },
);

export default function StatsPage() {
  const trpc = useTRPC();
  const overview = useQuery(trpc.stats.overview.queryOptions());
  const timeline = useQuery(trpc.stats.pointsTimeline.queryOptions());

  const ov = overview.data;
  const tl = timeline.data;

  /* shape recharts rows: one point per finished match, a column per player */
  const chartData =
    tl?.labels.map((l, i) => {
      const row: Record<string, string | number> = { name: l.label };
      for (const s of tl.series) row[s.name] = s.points[i];
      return row;
    }) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stats</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total bets" value={ov?.totalBets ?? 0} />
        <Stat label="Bets scored" value={ov?.scoredBets ?? 0} />
        <Stat label="Exact hits" value={ov?.exact ?? 0} accent />
        <Stat label="Exact rate %" value={ov?.exactRate ?? 0} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Points race</CardTitle>
          <CardDescription>
            Cumulative points across played matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              The race chart unlocks once results start coming in. 📈
            </p>
          ) : (
            <PointsChart data={chartData} series={tl?.series ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card className="py-4">
      <CardContent>
        <p
          className={
            "text-3xl font-extrabold " + (accent ? "text-primary" : "")
          }
        >
          <NumberTicker value={value} />
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
