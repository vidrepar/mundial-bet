"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Lock, MessageCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MatchComments } from "@/components/match-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { fmtKickoff, timeUntil } from "@/lib/format";
import { maxPoints } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

type MatchRow = {
  id: number;
  stage: string;
  stageLabel: string;
  groupName: string | null;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  venue: string;
  kickoff: string;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
  locked: boolean;
  myBet: { predHome: number; predAway: number; points: number | null } | null;
  betCount: number;
};

function pointsBadge(points: number | null, stage: string) {
  if (points == null) return null;
  if (points <= 0) return <Badge variant="outline">+0</Badge>;
  if (points === maxPoints(stage))
    return <Badge variant="success">🎯 +{points}</Badge>;
  return <Badge variant="success">+{points}</Badge>;
}

export function MatchBetCard({
  match,
  signedIn,
  isAdmin = false,
  unread = 0,
}: {
  match: MatchRow;
  signedIn: boolean;
  isAdmin?: boolean;
  unread?: number;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [home, setHome] = useState(match.myBet?.predHome?.toString() ?? "");
  const [away, setAway] = useState(match.myBet?.predAway?.toString() ?? "");
  const [hint, setHint] = useState<"idle" | "saving" | "saved">("idle");
  const [picksOpen, setPicksOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const place = useMutation(
    trpc.bets.place.mutationOptions({
      onSuccess: () => {
        setHint("saved");
        qc.invalidateQueries({ queryKey: trpc.matches.list.queryKey() });
      },
      onError: (e) => {
        setHint("idle");
        toast.error(e.message);
      },
    }),
  );

  const canBet = signedIn && !match.locked;

  /* auto-save the prediction (debounced) once both scores are valid */
  useEffect(() => {
    if (!canBet) return;
    const ph = Number.parseInt(home, 10);
    const pa = Number.parseInt(away, 10);
    if (Number.isNaN(ph) || Number.isNaN(pa)) return;
    if (match.myBet?.predHome === ph && match.myBet?.predAway === pa) return;
    setHint("saving");
    const t = setTimeout(
      () => place.mutate({ matchId: match.id, predHome: ph, predAway: pa }),
      700,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, canBet]);

  const picks = useQuery({
    ...trpc.bets.forMatch.queryOptions({ matchId: match.id }),
    enabled: picksOpen && match.locked,
  });

  const hasResult = match.finished && match.homeScore != null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {/* meta row */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {match.stageLabel}
          </span>
          {match.groupName && (
            <Badge variant="secondary">Group {match.groupName}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {match.locked ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" />
              {hasResult ? "FT" : "Locked"}
            </span>
          ) : (
            <span className="text-primary">{timeUntil(match.kickoff)}</span>
          )}
        </div>
      </div>

      {/* teams + scores */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4">
        <div className="flex items-center gap-2 justify-self-start">
          <span className="text-2xl">{match.homeFlag}</span>
          <span className="font-semibold">{match.homeTeam}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          {hasResult ? (
            <div className="text-xl font-bold tabular-nums">
              {match.homeScore} – {match.awayScore}
            </div>
          ) : canBet ? (
            <div className="flex items-center gap-1">
              <Input
                inputMode="numeric"
                value={home}
                onChange={(e) =>
                  setHome(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
                }
                className="h-10 w-12 text-center text-lg"
                placeholder="–"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                inputMode="numeric"
                value={away}
                onChange={(e) =>
                  setAway(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
                }
                className="h-10 w-12 text-center text-lg"
                placeholder="–"
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">vs</div>
          )}
          <span className="text-[10px] text-muted-foreground">
            {fmtKickoff(match.kickoff)}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <span className="font-semibold">{match.awayTeam}</span>
          <span className="text-2xl">{match.awayFlag}</span>
        </div>
      </div>

      {/* action row */}
      <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {match.myBet ? (
            <span>
              Your pick:{" "}
              <span className="font-semibold text-foreground">
                {match.myBet.predHome}–{match.myBet.predAway}
              </span>
            </span>
          ) : (
            <span>{match.betCount} picks in</span>
          )}
          {pointsBadge(match.myBet?.points ?? null, match.stage)}
          {canBet && hint !== "idle" && (
            <span className="text-primary">
              {hint === "saving" ? "saving…" : "saved ✓"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              title="Comments"
              onClick={() => setChatOpen((v) => !v)}
            >
              <MessageCircle />
            </Button>
            {unread > 0 && !chatOpen && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          {match.locked && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPicksOpen((v) => !v)}
            >
              Picks
              <ChevronDown
                className={cn(
                  "transition-transform",
                  picksOpen && "rotate-180",
                )}
              />
            </Button>
          )}
          {isAdmin && match.locked && (
            <Button
              size="icon"
              variant={hasResult ? "ghost" : "secondary"}
              title="Enter result (admin)"
              className="rounded-full"
              onClick={() => setResultOpen((v) => !v)}
            >
              <Plus />
            </Button>
          )}
        </div>
      </div>

      {/* reveal everyone's picks (only once locked) */}
      {picksOpen && match.locked && (
        <div className="space-y-1 border-t bg-muted/30 px-4 py-3">
          {picks.isLoading && (
            <p className="text-xs text-muted-foreground">Loading picks…</p>
          )}
          {picks.data?.bets.length === 0 && (
            <p className="text-xs text-muted-foreground">No picks made.</p>
          )}
          {picks.data?.bets.map((b) => (
            <div
              key={b.userId}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <UserAvatar name={b.name} image={b.image} className="size-5" />
                {b.name}
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="font-medium">
                  {b.predHome}–{b.predAway}
                </span>
                {pointsBadge(b.points, match.stage)}
              </span>
            </div>
          ))}
        </div>
      )}

      {resultOpen && isAdmin && match.locked && <ResultEntry match={match} />}

      {chatOpen && <MatchComments matchId={match.id} />}
    </Card>
  );
}

function ResultEntry({ match }: { match: MatchRow }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [h, setH] = useState(match.homeScore?.toString() ?? "");
  const [a, setA] = useState(match.awayScore?.toString() ?? "");
  const setResult = useMutation(
    trpc.matches.setResult.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Result saved · scored ${r.scored} bets`);
        qc.invalidateQueries();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  return (
    <div className="flex items-center justify-end gap-2 border-t border-dashed bg-primary/5 px-4 py-2">
      <span className="mr-auto text-xs font-medium text-primary">
        Final score
      </span>
      <Input
        value={h}
        onChange={(e) => setH(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
        className="h-8 w-12 text-center"
        placeholder="H"
      />
      <span className="text-muted-foreground">:</span>
      <Input
        value={a}
        onChange={(e) => setA(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
        className="h-8 w-12 text-center"
        placeholder="A"
      />
      <Button
        size="sm"
        disabled={setResult.isPending}
        onClick={() =>
          setResult.mutate({
            matchId: match.id,
            homeScore: Number.parseInt(h, 10) || 0,
            awayScore: Number.parseInt(a, 10) || 0,
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
