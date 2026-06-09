"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/trpc/client";

export default function AnalyticsPage() {
  const trpc = useTRPC();
  const q = useQuery(trpc.analytics.summary.queryOptions());
  const d = q.data;

  const maxGoals = Math.max(1, ...(d?.goals.map((g) => g.avgGoals) ?? [1]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          The numbers that decide who buys the beers. 🍻
        </p>
      </div>

      {/* group's favourite scoreline */}
      {d?.favScoreline && (
        <Card className="pitch-gradient">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                The squad&rsquo;s favourite scoreline
              </p>
              <p className="text-4xl font-extrabold text-primary">
                {d.favScoreline.score}
              </p>
            </div>
            <Badge variant="secondary">{d.favScoreline.count} times</Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* head to head */}
        <Card>
          <CardHeader>
            <CardTitle>Head-to-head</CardTitle>
            <CardDescription>Total points, season long.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d?.headToHead.length ? (
              d.headToHead.map((h, i) => {
                const total = Math.max(1, h.aPts + h.bPts);
                const aPct = Math.round((h.aPts / total) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <UserAvatar
                          name={h.aName}
                          image={h.aImg}
                          className="size-5"
                        />
                        {h.aName} · {h.aPts}
                      </span>
                      <span className="flex items-center gap-1">
                        {h.bPts} · {h.bName}
                        <UserAvatar
                          name={h.bName}
                          image={h.bImg}
                          className="size-5"
                        />
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="bg-primary"
                        style={{ width: `${aPct}%` }}
                      />
                      <div
                        className="bg-blue-400"
                        style={{ width: `${100 - aPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>

        {/* goal appetite */}
        <Card>
          <CardHeader>
            <CardTitle>Goal appetite</CardTitle>
            <CardDescription>
              Avg goals predicted per match &amp; draw tendency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d?.goals.filter((g) => g.bets > 0).length ? (
              d.goals
                .filter((g) => g.bets > 0)
                .map((g) => (
                  <div key={g.userId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <UserAvatar
                          name={g.name}
                          image={g.image}
                          className="size-5"
                        />
                        {g.name}
                      </span>
                      <span className="text-muted-foreground">
                        {g.avgGoals} gpg · {g.drawShare}% draws
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${(g.avgGoals / maxGoals) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>

        {/* clutch */}
        <Card>
          <CardHeader>
            <CardTitle>Clutch gene</CardTitle>
            <CardDescription>Knockout vs group-stage points.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {d?.clutch.some((c) => c.group + c.ko > 0) ? (
              d.clutch.map((c) => (
                <div
                  key={c.userId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{c.name}</span>
                  <span className="flex gap-2">
                    <Badge variant="secondary">Group {c.group}</Badge>
                    <Badge variant="success">KO {c.ko}</Badge>
                  </span>
                </div>
              ))
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>

        {/* hall of fame */}
        <Card>
          <CardHeader>
            <CardTitle>Hall of exacts</CardTitle>
            <CardDescription>Perfect scorelines called. 🎯</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {d?.bestCalls.length ? (
              d.bestCalls.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      name={b.name}
                      image={b.image}
                      className="size-5"
                    />
                    {b.name}
                  </span>
                  <span className="text-muted-foreground">
                    {b.line}{" "}
                    <span className="text-xs">({b.stage})</span>
                  </span>
                </div>
              ))
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">
      Unlocks once matches are played.
    </p>
  );
}
