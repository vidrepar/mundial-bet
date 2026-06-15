"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/trpc/client";

export default function RivalsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [pick, setPick] = useState("");

  const q = useQuery(trpc.rivals.get.queryOptions());
  const set = useMutation(
    trpc.rivals.set.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.rivals.get.queryKey() }),
      onError: (e) => toast.error(e.message),
    }),
  );
  const clear = useMutation(
    trpc.rivals.clear.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.rivals.get.queryKey() }),
    }),
  );
  const taunt = useMutation(
    trpc.chat.send.mutationOptions({
      onSuccess: () => toast.success("Taunt dropped in the group chat 🔥"),
      onError: (e) => toast.error(e.message),
    }),
  );

  const data = q.data;
  const rival = data?.rival ?? null;
  const h2h = data?.h2h ?? null;
  const members = data?.members ?? [];

  function sendTaunt() {
    if (!rival || !h2h) return;
    const me = h2h.wins;
    const them = h2h.losses;
    const line =
      me > them
        ? `@${rival.name} I'm beating you ${me}-${them} in our rivalry 😤 keep coping`
        : me < them
          ? `@${rival.name} you're up ${them}-${me} on me… enjoy it while it lasts 👀`
          : `@${rival.name} we're dead even ${me}-${them}. settle it on the next match ⚔️`;
    taunt.mutate({ body: line });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Swords className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">Rivalry</h1>
      </div>

      {q.isLoading && <Skeleton className="h-40 w-full" />}

      {!q.isLoading && !rival && (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick a rival to track your head-to-head and talk smack.
            </p>
            <div className="flex gap-2">
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Choose a rival…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Button disabled={!pick || set.isPending} onClick={() => set.mutate({ rivalId: pick })}>
                Set rival
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rival && h2h && (
        <>
          <Card className="overflow-hidden">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <UserAvatar name="You" image={null} className="size-12" />
                  <span className="text-xs text-muted-foreground">You</span>
                </div>
                <div className="text-2xl font-extrabold tabular-nums">
                  <span className="text-emerald-500">{h2h.wins}</span>
                  <span className="px-1 text-muted-foreground">–</span>
                  <span className="text-muted-foreground">{h2h.draws}</span>
                  <span className="px-1 text-muted-foreground">–</span>
                  <span className="text-red-500">{h2h.losses}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <UserAvatar name={rival.name} image={rival.image} className="size-12" />
                  <span className="text-xs text-muted-foreground">{rival.name}</span>
                </div>
              </div>
              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                <span>
                  Points: <b className="text-foreground">{h2h.myPts}</b> vs{" "}
                  <b className="text-foreground">{h2h.rivalPts}</b>
                </span>
                <span>{h2h.matches} shared matches</span>
              </div>
              <div className="flex justify-center gap-2">
                <Button onClick={sendTaunt} disabled={taunt.isPending} className="gap-1.5">
                  <Swords className="size-4" /> Send taunt
                </Button>
                <Button variant="ghost" onClick={() => clear.mutate()}>
                  Change rival
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground">
            Taunts post to the group chat tagging {rival.name}.
          </p>
        </>
      )}
    </div>
  );
}
