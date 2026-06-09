"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";

export function TelegramConnect() {
  const trpc = useTRPC();
  const status = useQuery(trpc.telegram.status.queryOptions());

  const link = useMutation(
    trpc.telegram.linkUrl.mutationOptions({
      onSuccess: (r) => window.open(r.url, "_blank"),
      onError: (e) => toast.error(e.message),
    }),
  );
  const unlink = useMutation(
    trpc.telegram.unlink.mutationOptions({
      onSuccess: () => {
        toast.success("Telegram disconnected");
        status.refetch();
      },
    }),
  );

  if (!status.data) return null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Send className="size-5 text-sky-400" />
          <div>
            <p className="text-sm font-semibold">Match reminders</p>
            <p className="text-xs text-muted-foreground">
              {status.data.linked
                ? `Connected${status.data.username ? ` as @${status.data.username}` : ""} — you'll get a DM before matches you haven't bet on.`
                : "Connect Telegram for a personal nudge before kickoff."}
            </p>
          </div>
        </div>
        {status.data.linked ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => unlink.mutate()}
            disabled={unlink.isPending}
          >
            <Check className="size-4 text-emerald-400" /> Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => link.mutate()}
            disabled={link.isPending || !status.data.configured}
            title={
              status.data.configured ? "" : "Set TELEGRAM_BOT_USERNAME first"
            }
          >
            <Send className="size-4" /> Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
