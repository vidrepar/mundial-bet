"use client";

import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";

const COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#f87171"];

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
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  {tl?.series.map((s, i) => (
                    <Line
                      key={s.userId}
                      type="monotone"
                      dataKey={s.name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
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
