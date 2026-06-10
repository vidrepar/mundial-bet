"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";

const EMOJIS = ["⚽", "🔥", "😂", "😭", "🐐", "💀", "🎯", "🍻", "👏", "😱"];

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function MatchComments({ matchId }: { matchId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [text, setText] = useState("");

  const list = useQuery(trpc.comments.list.queryOptions({ matchId }));
  const reads = useQuery(trpc.comments.reads.queryOptions({ matchId }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: trpc.comments.list.queryKey({ matchId }) });
    qc.invalidateQueries({ queryKey: trpc.comments.reads.queryKey({ matchId }) });
    qc.invalidateQueries({ queryKey: trpc.comments.unread.queryKey() });
  };

  const markRead = useMutation(
    trpc.comments.markRead.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.comments.unread.queryKey() });
        qc.invalidateQueries({
          queryKey: trpc.comments.reads.queryKey({ matchId }),
        });
      },
    }),
  );
  const add = useMutation(
    trpc.comments.add.mutationOptions({
      onSuccess: () => {
        setText("");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  /* mark the thread read on open + whenever a newer comment lands while open */
  const latestId = list.data?.[0]?.id;
  useEffect(() => {
    if (session?.user && list.data) markRead.mutate({ matchId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, latestId, matchId]);

  function send() {
    const body = text.trim();
    if (!body) return;
    add.mutate({ matchId, body });
  }

  /* read receipts for the latest comment (exclude its author + myself) */
  const latest = list.data?.[0];
  const seenBy = latest
    ? (reads.data ?? []).filter(
        (r) =>
          r.userId !== latest.userId &&
          new Date(r.lastReadAt).getTime() >=
            new Date(latest.createdAt).getTime(),
      )
    : [];

  return (
    <div className="space-y-3 border-t bg-muted/20 px-4 py-3">
      {session?.user ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setText((t) => t + e)}
                className="rounded-md px-1.5 py-0.5 text-base transition-transform hover:scale-125"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Talk trash… ⚽🔥"
              className="h-9"
            />
            <Button
              size="icon"
              onClick={send}
              disabled={add.isPending || !text.trim()}
            >
              <Send />
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sign in to join the chat.</p>
      )}

      <div className="space-y-2">
        {list.isLoading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {list.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No comments yet — be the first to pop off. 🍿
          </p>
        )}
        {list.data?.map((c, i) => (
          <div key={c.id}>
            <div className="flex items-start gap-2">
              <UserAvatar name={c.name} image={c.image} className="size-6" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-semibold">{c.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {ago(c.createdAt)}
                  </span>
                </p>
                <p className="break-words text-sm">{c.body}</p>
              </div>
            </div>
            {/* read receipts on the latest comment */}
            {i === 0 && seenBy.length > 0 && (
              <div className="mt-1 flex items-center gap-1 pl-8 text-[10px] text-muted-foreground">
                <Check className="size-3 text-primary" />
                <span>Seen by</span>
                <span className="flex -space-x-1">
                  {seenBy.slice(0, 5).map((r) => (
                    <UserAvatar
                      key={r.userId}
                      name={r.name}
                      image={r.image}
                      className="size-4 ring-1 ring-background"
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
