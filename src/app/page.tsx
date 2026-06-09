"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";
import { BorderBeam } from "@/components/magicui/border-beam";
import { GradientText } from "@/components/magicui/gradient-text";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { TelegramConnect } from "@/components/telegram-connect";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { fmtKickoff, timeUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function HomePage() {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const overview = useQuery(trpc.stats.overview.queryOptions());
  const standings = useQuery(trpc.leaderboard.standings.queryOptions());
  const open = useQuery(trpc.matches.list.queryOptions({ filter: "open" }));

  const next3 = (open.data ?? []).slice(0, 3);
  const ov = overview.data;

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="pitch-gradient relative overflow-hidden rounded-2xl border p-8">
        <BorderBeam size={160} duration={10} />
        <p className="text-sm font-medium text-primary">
          FIFA World Cup 2026 · friends pool
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
          <GradientText>Mundial &rsquo;26</GradientText>
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Predict every scoreline. <b>3</b> for exact, <b>1</b> for the right
          outcome, <b>0</b> if you whiff. Bets lock at kickoff.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/bet" className={cn(buttonVariants(), "gap-1")}>
            Place your picks <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/leaderboard"
            className={buttonVariants({ variant: "outline" })}
          >
            <Trophy className="size-4" /> Lestvica
          </Link>
        </div>
      </section>

      {/* quick stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Matches" value={ov?.totalMatches ?? 104} />
        <Stat label="Played" value={ov?.finishedMatches ?? 0} />
        <Stat label="Total bets" value={ov?.totalBets ?? 0} />
        <Stat
          label="Exact hits"
          value={ov?.exact ?? 0}
          accent
        />
      </section>

      {session?.user && <TelegramConnect />}

      {/* standings preview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Standings</h2>
          <Link
            href="/leaderboard"
            className="text-sm text-primary hover:underline"
          >
            Full table
          </Link>
        </div>
        <Card>
          <CardContent className="space-y-1">
            {standings.data?.length ? (
              standings.data.map((r) => (
                <div
                  key={r.userId}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <span className="w-6 text-center font-bold">
                    {MEDALS[r.rank - 1] ?? r.rank}
                  </span>
                  <UserAvatar name={r.name} image={r.image} className="size-7" />
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                    <span>🎯 {r.exact}</span>
                    <span className="text-base font-bold text-foreground">
                      {r.points} pts
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No players yet — be the first to sign in and bet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* next matches */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Next up</h2>
          <Link href="/bet" className="text-sm text-primary hover:underline">
            All matches
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {next3.map((m) => (
            <Link
              key={m.id}
              href="/bet"
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <Badge variant="secondary" className="mb-3">
                {m.stageLabel}
              </Badge>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>
                  {m.homeFlag} {m.homeTeam}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>
                  {m.awayFlag} {m.awayTeam}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {fmtKickoff(m.kickoff)} · {timeUntil(m.kickoff)}
              </p>
              {m.myBet && (
                <p className="mt-1 text-xs text-primary">
                  Your pick {m.myBet.predHome}–{m.myBet.predAway}
                </p>
              )}
            </Link>
          ))}
          {next3.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No upcoming matches to bet on.
            </p>
          )}
        </div>
      </section>

      {!session?.user && (
        <p className="text-center text-xs text-muted-foreground">
          Sign in (top right) with your Google account to start betting.
        </p>
      )}
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
          className={cn(
            "text-3xl font-extrabold",
            accent && "text-primary",
          )}
        >
          <NumberTicker value={value} />
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
