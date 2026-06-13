"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Check, CornerDownRight, Send, SmilePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/_app.types";

const EMOJIS = ["⚽", "🔥", "😂", "😭", "🐐", "💀", "🎯", "🍻", "👏", "😱"];
/* reaction palette — must stay in sync with the router's REACTION_EMOJIS */
const REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "😢", "🐐", "💀"] as const;
type ReactionEmoji = (typeof REACTIONS)[number];

function isReactionEmoji(e: string): e is ReactionEmoji {
  return REACTIONS.some((r) => r === e);
}

type CommentItem =
  inferRouterOutputs<AppRouter>["comments"]["list"][number];
type Reaction = CommentItem["reactions"][number];

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
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const list = useQuery(trpc.comments.list.queryOptions({ matchId }));
  const reads = useQuery(trpc.comments.reads.queryOptions({ matchId }));
  const signedIn = !!session?.user;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: trpc.comments.list.queryKey({ matchId }) });
    qc.invalidateQueries({ queryKey: trpc.comments.reads.queryKey({ matchId }) });
    qc.invalidateQueries({ queryKey: trpc.comments.unread.queryKey() });
    /* refresh the per-match comment count on the cards */
    qc.invalidateQueries({ queryKey: trpc.matches.list.queryKey() });
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
        setReplyTo(null);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const react = useMutation(
    trpc.comments.react.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.comments.list.queryKey({ matchId }),
        }),
      onError: (e) => toast.error(e.message),
    }),
  );

  const all = list.data ?? [];

  /* build the 2-level tree: top-level newest first, replies oldest first */
  const tops = all
    .filter((c) => c.parentId == null)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const repliesByParent = new Map<number, CommentItem[]>();
  for (const c of all) {
    if (c.parentId == null) continue;
    const arr = repliesByParent.get(c.parentId) ?? [];
    arr.push(c);
    repliesByParent.set(c.parentId, arr);
  }
  for (const arr of repliesByParent.values()) {
    arr.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  /* mark read on open + whenever any newer comment lands while open */
  const newestId = all.length ? all[all.length - 1].id : undefined;
  useEffect(() => {
    if (session?.user && list.data) markRead.mutate({ matchId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, newestId, matchId]);

  function send() {
    const body = text.trim();
    if (!body) return;
    add.mutate({ matchId, body });
  }
  function onToggleReaction(commentId: number, emoji: string) {
    if (!signedIn || !isReactionEmoji(emoji)) return;
    react.mutate({ commentId, emoji });
  }

  /* read receipts for the latest top-level comment (exclude author + me) */
  const latest = tops[0];
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
      {signedIn ? (
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

      <div className="space-y-3">
        {list.isLoading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {tops.length === 0 && !list.isLoading && (
          <p className="text-xs text-muted-foreground">
            No comments yet — be the first to pop off. 🍿
          </p>
        )}
        {tops.map((c, i) => (
          <div key={c.id}>
            <CommentNode
              c={c}
              signedIn={signedIn}
              onReact={onToggleReaction}
              onReply={() => setReplyTo((id) => (id === c.id ? null : c.id))}
            />

            {/* read receipts on the latest top-level comment */}
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

            {/* replies (level 2) */}
            {(repliesByParent.get(c.id) ?? []).length > 0 && (
              <div className="ml-3 mt-2 space-y-2 border-l pl-3">
                {(repliesByParent.get(c.id) ?? []).map((r) => (
                  <CommentNode
                    key={r.id}
                    c={r}
                    signedIn={signedIn}
                    onReact={onToggleReaction}
                  />
                ))}
              </div>
            )}

            {/* reply composer */}
            {replyTo === c.id && signedIn && (
              <ReplyBox
                pending={add.isPending}
                onSend={(body) => add.mutate({ matchId, body, parentId: c.id })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentNode({
  c,
  signedIn,
  onReact,
  onReply,
}: {
  c: CommentItem;
  signedIn: boolean;
  onReact: (commentId: number, emoji: string) => void;
  onReply?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <UserAvatar name={c.name} image={c.image} className="size-6" />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-semibold">{c.name}</span>{" "}
          <span className="text-muted-foreground">{ago(c.createdAt)}</span>
        </p>
        <p className="break-words text-sm">{c.body}</p>
        <Reactions
          reactions={c.reactions}
          signedIn={signedIn}
          onToggle={(emoji) => onReact(c.id, emoji)}
          onReply={onReply}
        />
      </div>
    </div>
  );
}

function Reactions({
  reactions,
  signedIn,
  onToggle,
  onReply,
}: {
  reactions: Reaction[];
  signedIn: boolean;
  onToggle: (emoji: string) => void;
  onReply?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={!signedIn}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition-colors",
            r.mine
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "bg-muted/40 text-muted-foreground hover:bg-muted",
          )}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}

      {signedIn && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center rounded-full border px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
            title="Add reaction"
          >
            <SmilePlus className="size-3.5" />
          </button>
          {open && (
            <div className="absolute z-10 mt-1 flex gap-0.5 rounded-md border bg-popover p-1 shadow-md">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onToggle(e);
                    setOpen(false);
                  }}
                  className="rounded px-1 text-base transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {signedIn && onReply && (
        <button
          type="button"
          onClick={onReply}
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <CornerDownRight className="size-3" />
          Reply
        </button>
      )}
    </div>
  );
}

function ReplyBox({
  onSend,
  pending,
}: {
  onSend: (body: string) => void;
  pending: boolean;
}) {
  const [v, setV] = useState("");
  const submit = () => {
    const body = v.trim();
    if (!body) return;
    onSend(body);
    setV("");
  };
  return (
    <div className="mt-2 flex gap-2 pl-9">
      <Input
        value={v}
        onChange={(e) => setV(e.target.value.slice(0, 500))}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Reply…"
        className="h-8 text-sm"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <Button size="sm" disabled={pending || !v.trim()} onClick={submit}>
        Reply
      </Button>
    </div>
  );
}
