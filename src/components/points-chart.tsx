"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#f87171"];

/* recharts is heavy (~100kB) — kept in its own module so the Stats page can
 * lazy-load it via next/dynamic instead of shipping it in the initial bundle. */
export function PointsChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { userId: string; name: string }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 8 }}>
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
          {series.map((s, i) => (
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
  );
}
