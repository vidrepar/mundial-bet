"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { CornerDownRight, ExternalLink, Hash, MessagesSquare, Search, Send, SmilePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MatchComments } from "@/components/match-comments";
import { NotificationToggle } from "@/components/notification-toggle";
import { useKeyboardPanel } from "@/components/use-keyboard-panel";
import { usePanel } from "@/components/use-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { fmtTime, timeUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/_app.types";

type ChatData = inferRouterOutputs<AppRouter>["chat"]["list"];
type ChatMsg = ChatData["messages"][number];
type ChipMatch = ChatData["matches"][number];
type Member = inferRouterOutputs<AppRouter>["chat"]["members"][number];
type Reaction = ChatMsg["reactions"][number];

const REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "😢", "🐐", "💀"] as const;
type ReactionEmoji = (typeof REACTIONS)[number];
const MENTION_RE = /@([\p{L}\p{N}_]*)$/u;

function isReactionEmoji(e: string): e is ReactionEmoji {
  return REACTIONS.some((r) => r === e);
}
function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function GroupChat() {
  const { data: session } = useSession();
  const [panel, setPanel] = usePanel();
  const trpc = useTRPC();

  const unread = useQuery({
    ...trpc.chat.unread.queryOptions(),
    enabled: !!session?.user,
    refetchInterval: 20_000,
  });

  if (!session?.user) return null;
  const count = unread.data?.count ?? 0;

  return (
    <>
      {panel === null && (
        <button
          type="button"
          onClick={() => setPanel("chat", { history: "push" })}
          aria-label="Open group chat"
          className="fixed bottom-5 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
        >
          <MessagesSquare className="size-6" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex size-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      )}
      {panel === "chat" && (
        <ChatPanel onClose={() => setPanel(null, { history: "replace" })} />
      )}
    </>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const me = session?.user?.id;
  const meName = session?.user?.name ?? "";

  const [text, setText] = useState("");
  const [attached, setAttached] = useState<ChipMatch | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [typers, setTypers] = useState<Record<string, { name: string; at: number }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const typingSentAt = useRef(0);
  useKeyboardPanel(panelRef);

  const chat = useQuery({ ...trpc.chat.list.queryOptions(), refetchInterval: 15_000 });
  const members = useQuery(trpc.chat.members.queryOptions());
  const seen = useQuery(trpc.chat.seen.queryOptions());

  const markRead = useMutation(
    trpc.chat.markRead.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.chat.unread.queryKey() }),
    }),
  );
  const send = useMutation(
    trpc.chat.send.mutationOptions({
      onSuccess: () => {
        setText("");
        setAttached(null);
        qc.invalidateQueries({ queryKey: trpc.chat.list.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.chat.unread.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const react = useMutation(
    trpc.chat.react.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.chat.list.queryKey() }),
      onError: (e) => toast.error(e.message),
    }),
  );
  const setTyping = useMutation(trpc.chat.setTyping.mutationOptions());

  /* live updates over SSE: refresh on activity, track typing, refresh seen */
  useEffect(() => {
    const es = new EventSource("/api/chat/stream");
    es.onmessage = (ev) => {
      let e;
      try {
        e = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (e.kind === "refresh") {
        qc.invalidateQueries({ queryKey: trpc.chat.list.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.chat.unread.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.chat.seen.queryKey() });
      } else if (e.kind === "seen") {
        qc.invalidateQueries({ queryKey: trpc.chat.seen.queryKey() });
      } else if (e.kind === "typing" && e.userId !== me) {
        setTypers((p) => ({ ...p, [e.userId]: { name: e.name, at: Date.now() } }));
      }
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* prune stale typing indicators */
  useEffect(() => {
    const t = setInterval(() => {
      setTypers((p) => {
        const now = Date.now();
        const next: typeof p = {};
        for (const [k, v] of Object.entries(p)) if (now - v.at < 3500) next[k] = v;
        return next;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const messages = chat.data?.messages ?? [];
  const matchLookup = chat.data?.matches ?? {};
  const tops = messages.filter((m) => m.parentId == null);
  const repliesByParent = new Map<number, ChatMsg[]>();
  for (const m of messages) {
    if (m.parentId == null) continue;
    const arr = repliesByParent.get(m.parentId) ?? [];
    arr.push(m);
    repliesByParent.set(m.parentId, arr);
  }
  const newestId = messages.length ? Math.max(...messages.map((m) => m.id)) : 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    if (chat.data) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestId]);

  function submit() {
    const body = text.trim();
    if ((!body && !attached) || send.isPending) return;
    send.mutate({ body, matchId: attached?.id });
  }
  function onToggleReaction(messageId: number, emoji: string) {
    if (isReactionEmoji(emoji)) react.mutate({ messageId, emoji });
  }
  function onComposerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.slice(0, 1000);
    setText(val);
    const caret = e.target.selectionStart ?? val.length;
    const mm = MENTION_RE.exec(val.slice(0, caret));
    setMentionQuery(mm ? mm[1].toLowerCase() : null);
    if (val && Date.now() - typingSentAt.current > 2000) {
      typingSentAt.current = Date.now();
      setTyping.mutate();
    }
  }
  function pickMention(member: Member) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(MENTION_RE, `@${member.name} `);
    setText(before + text.slice(caret));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  }

  const memberList = members.data ?? [];
  const mentionCandidates =
    mentionQuery === null
      ? []
      : memberList.filter((u) => u.id !== me).filter((u) => u.name.toLowerCase().includes(mentionQuery)).slice(0, 6);

  const latestTop = tops[tops.length - 1];
  const seenBy = latestTop
    ? (seen.data ?? []).filter(
        (r) =>
          r.userId !== latestTop.userId &&
          r.userId !== me &&
          new Date(r.lastReadAt).getTime() >= new Date(latestTop.createdAt).getTime(),
      )
    : [];
  const activeTypers = Object.values(typers);

  return (
    <div ref={panelRef} className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[70vh] sm:max-h-[680px] sm:w-[400px] sm:rounded-2xl sm:border sm:shadow-2xl">
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:rounded-t-2xl">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-lg">⚽</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">Mundial Group</p>
          <p className="truncate text-xs text-muted-foreground">
            {memberList.length} members · @ to tag, # for a match
          </p>
        </div>
        <NotificationToggle />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {chat.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {!chat.isLoading && tops.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hi 👋</p>
        )}
        {tops.map((m, i) => {
          const prev = tops[i - 1];
          const mine = m.userId === me;
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const startRun = newDay || !prev || prev.userId !== m.userId;
          const replies = repliesByParent.get(m.id) ?? [];
          const match = m.matchId != null ? matchLookup[m.matchId] : undefined;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] text-muted-foreground">
                    {dayLabel(m.createdAt)}
                  </span>
                </div>
              )}
              <MessageRow
                m={m}
                mine={mine}
                startRun={startRun}
                match={match}
                members={memberList}
                meName={meName}
                replyCount={replies.length}
                expanded={expandedId === m.id}
                onReact={onToggleReaction}
                onToggleThread={() => setExpandedId((id) => (id === m.id ? null : m.id))}
              />

              {i === tops.length - 1 && seenBy.length > 0 && (
                <div className="mt-1 flex items-center gap-1 pl-9 text-[10px] text-muted-foreground">
                  <span>Seen by</span>
                  <span className="flex -space-x-1">
                    {seenBy.slice(0, 6).map((r) => (
                      <UserAvatar key={r.userId} name={r.name} image={r.image} className="size-4 ring-1 ring-background" />
                    ))}
                  </span>
                </div>
              )}

              {expandedId === m.id && (
                <ThreadShell>
                  {match ? (
                    <>
                      <MatchThreadHeader match={match} onOpenPage={() => { onClose(); router.push(`/bet?m=${match.matchNumber}`); }} onClose={() => setExpandedId(null)} />
                      <MatchComments matchId={match.id} />
                    </>
                  ) : (
                    <ReplyThread
                      replies={replies}
                      members={memberList}
                      meName={meName}
                      onReact={onToggleReaction}
                      onSend={(body) => send.mutate({ body, parentId: m.id })}
                      pending={send.isPending}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </ThreadShell>
              )}
            </div>
          );
        })}
      </div>

      {activeTypers.length > 0 && (
        <div className="px-4 py-1 text-xs italic text-muted-foreground">
          {activeTypers.map((t) => t.name.split(" ")[0]).join(", ")}{" "}
          {activeTypers.length === 1 ? "is" : "are"} typing…
        </div>
      )}

      {pickerOpen && (
        <MatchPicker
          onPick={(m) => {
            setAttached(m);
            setPickerOpen(false);
            inputRef.current?.focus();
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {mentionCandidates.length > 0 && (
        <div className="border-t bg-popover px-2 py-1">
          {mentionCandidates.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pickMention(u)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <UserAvatar name={u.name} image={u.image} className="size-6" />
              <span className="truncate">{u.name}</span>
            </button>
          ))}
        </div>
      )}

      {attached && (
        <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
          <MatchChip m={attached} />
          <button type="button" onClick={() => setAttached(null)} className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Button
          variant={pickerOpen || attached ? "secondary" : "ghost"}
          size="icon"
          onClick={() => setPickerOpen((v) => !v)}
          title="Reference a match"
          className="shrink-0"
        >
          <Hash />
        </Button>
        <Input
          ref={inputRef}
          value={text}
          onChange={onComposerChange}
          onKeyDown={(e) => {
            if (mentionCandidates.length > 0) {
              if (e.key === "Enter") {
                e.preventDefault();
                pickMention(mentionCandidates[0]);
                return;
              }
              if (e.key === "Escape") {
                setMentionQuery(null);
                return;
              }
            }
            if (e.key === "Enter") submit();
          }}
          placeholder="Message the group…"
          className="h-10"
        />
        <Button size="icon" onClick={submit} disabled={send.isPending || (!text.trim() && !attached)} className="shrink-0">
          <Send />
        </Button>
      </div>
    </div>
  );
}

function ThreadShell({ children }: { children: React.ReactNode }) {
  return <div className="my-1 overflow-hidden rounded-xl border bg-card">{children}</div>;
}

function MatchThreadHeader({ match, onOpenPage, onClose }: { match: ChipMatch; onOpenPage: () => void; onClose: () => void }) {
  const live = match.status === "live";
  return (
    <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
      <span>{match.homeFlag}</span>
      <span className="truncate font-semibold">{match.homeTeam}</span>
      <span className="tabular-nums text-muted-foreground">
        {match.finished || live ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}` : "v"}
      </span>
      <span className="truncate font-semibold">{match.awayTeam}</span>
      <span>{match.awayFlag}</span>
      <span className="ml-1 shrink-0 text-muted-foreground">· {match.stageLabel}</span>
      <div className="ml-auto flex shrink-0 items-center">
        <button type="button" onClick={onOpenPage} title="Open match page" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ExternalLink className="size-3.5" />
        </button>
        <button type="button" onClick={onClose} title="Collapse" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function ReplyThread({
  replies,
  members,
  meName,
  onReact,
  onSend,
  pending,
  onClose,
}: {
  replies: ChatMsg[];
  members: Member[];
  meName: string;
  onReact: (id: number, e: string) => void;
  onSend: (body: string) => void;
  pending: boolean;
  onClose: () => void;
}) {
  const [v, setV] = useState("");
  const submit = () => {
    const body = v.trim();
    if (!body) return;
    onSend(body);
    setV("");
  };
  return (
    <div className="space-y-2 bg-muted/20 px-3 py-2">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>Thread · {replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
        <button type="button" onClick={onClose} className="rounded p-0.5 hover:bg-accent">
          <X className="size-3.5" />
        </button>
      </div>
      {replies.map((r) => (
        <div key={r.id} className="flex items-start gap-2">
          <UserAvatar name={r.name} image={r.image} className="size-6" />
          <div className="min-w-0 flex-1">
            <p className="text-xs">
              <span className="font-semibold">{r.name.split(" ")[0]}</span>{" "}
              <span className="text-muted-foreground">{fmtTime(r.createdAt)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{renderBody(r.body, members, meName)}</p>
            <Reactions reactions={r.reactions} onToggle={(e) => onReact(r.id, e)} />
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Reply…"
          className="h-8 text-sm"
        />
        <Button size="sm" disabled={pending || !v.trim()} onClick={submit}>
          Reply
        </Button>
      </div>
    </div>
  );
}

function MessageRow({
  m,
  mine,
  startRun,
  match,
  members,
  meName,
  replyCount,
  expanded,
  onReact,
  onToggleThread,
}: {
  m: ChatMsg;
  mine: boolean;
  startRun: boolean;
  match: ChipMatch | undefined;
  members: Member[];
  meName: string;
  replyCount: number;
  expanded: boolean;
  onReact: (id: number, e: string) => void;
  onToggleThread: () => void;
}) {
  const mentionsMe = !!meName && (m.body ?? "").includes(`@${meName}`);
  return (
    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && <div className="w-7 shrink-0">{startRun && <UserAvatar name={m.name} image={m.image} className="size-7" />}</div>}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-1.5 text-sm",
          mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
          !mine && mentionsMe && "ring-2 ring-amber-400/60",
        )}
      >
        {!mine && startRun && <p className="mb-0.5 text-xs font-semibold text-primary">{m.name}</p>}
        {match && (
          <button type="button" onClick={onToggleThread} className="mb-1 block w-full">
            <MatchChip m={match} />
          </button>
        )}
        {m.body && <p className="whitespace-pre-wrap break-words">{renderBody(m.body, members, meName)}</p>}
        <div className="mt-0.5 flex items-center justify-end gap-2">
          <span className={cn("text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {fmtTime(m.createdAt)}
          </span>
        </div>
        <Reactions reactions={m.reactions} onToggle={(e) => onReact(m.id, e)} light={mine} />
        <button
          type="button"
          onClick={onToggleThread}
          className={cn(
            "mt-1 flex items-center gap-1 text-[11px]",
            mine ? "text-primary-foreground/80" : "text-muted-foreground",
            "hover:underline",
          )}
        >
          <CornerDownRight className="size-3" />
          {match ? "Match thread" : replyCount > 0 ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "Reply"}
          {expanded ? " ·" : ""}
        </button>
      </div>
    </div>
  );
}

function Reactions({ reactions, onToggle, light }: { reactions: Reaction[] | undefined; onToggle: (e: string) => void; light?: boolean }) {
  const [open, setOpen] = useState(false);
  const rs = reactions ?? [];
  if (rs.length === 0 && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("mt-0.5 flex items-center rounded-full px-1 text-[11px] opacity-70 hover:opacity-100", light ? "text-primary-foreground" : "text-muted-foreground")}
        title="React"
      >
        <SmilePlus className="size-3.5" />
      </button>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {rs.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none",
            r.mine ? "border-primary/50 bg-primary/10 text-foreground" : "bg-background/60 text-muted-foreground hover:bg-muted",
          )}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center rounded-full border px-1.5 py-0.5 text-muted-foreground hover:bg-muted">
          <SmilePlus className="size-3.5" />
        </button>
        {open && (
          <div className="absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-md border bg-popover p-1 shadow-md">
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
    </div>
  );
}

/* render @mentions in a message body as highlighted chips */
function renderBody(body: string, members: Member[], meName: string) {
  if (!body) return [];
  const names = [...(members ?? [])].sort((a, b) => b.name.length - a.name.length);
  const out: React.ReactNode[] = [];
  let buf = "";
  let key = 0;
  const flush = () => {
    if (buf) {
      out.push(<span key={key++}>{buf}</span>);
      buf = "";
    }
  };
  let i = 0;
  while (i < body.length) {
    if (body[i] === "@") {
      const rest = body.slice(i + 1).toLowerCase();
      const hit = names.find((u) => rest.startsWith(u.name.toLowerCase()));
      if (hit) {
        flush();
        out.push(
          <span
            key={key++}
            className={cn("rounded px-1 font-semibold", hit.name === meName ? "bg-amber-400/25 text-amber-300" : "bg-primary/15 text-primary")}
          >
            @{hit.name}
          </span>,
        );
        i += 1 + hit.name.length;
        continue;
      }
    }
    buf += body[i];
    i++;
  }
  flush();
  return out;
}

function MatchChip({ m }: { m: ChipMatch }) {
  const live = m.status === "live";
  const showScore = m.finished || live;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs font-medium text-foreground">
      <span>{m.homeFlag}</span>
      <span className="truncate">{m.homeTeam}</span>
      <span className="tabular-nums text-muted-foreground">{showScore ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}` : "v"}</span>
      <span className="truncate">{m.awayTeam}</span>
      <span>{m.awayFlag}</span>
      {live ? (
        <span className="ml-0.5 font-bold text-red-600">{m.clock ? `LIVE ${m.clock}` : "LIVE"}</span>
      ) : m.finished ? (
        <span className="ml-0.5 text-muted-foreground">FT</span>
      ) : (
        <span className="ml-0.5 text-primary">{timeUntil(m.kickoff)}</span>
      )}
    </span>
  );
}

function MatchPicker({ onPick, onClose }: { onPick: (m: ChipMatch) => void; onClose: () => void }) {
  const trpc = useTRPC();
  const [q, setQ] = useState("");
  const list = useQuery(trpc.matches.list.queryOptions({ filter: "all" }));
  const rank = (s: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
  const all = [...(list.data ?? [])].sort(
    (a, b) => rank(a.status) - rank(b.status) || new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
  );
  const filtered = all
    .filter((m) => {
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return m.homeTeam.toLowerCase().includes(s) || m.awayTeam.toLowerCase().includes(s) || String(m.matchNumber) === s;
    })
    .slice(0, 40);

  return (
    <div className="border-t bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex flex-1 items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search to attach a match…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
      <div className="max-h-44 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches.</p>}
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() =>
              onPick({
                id: m.id,
                matchNumber: m.matchNumber,
                homeTeam: m.homeTeam,
                awayTeam: m.awayTeam,
                homeFlag: m.homeFlag,
                awayFlag: m.awayFlag,
                homeScore: m.homeScore,
                awayScore: m.awayScore,
                status: m.status,
                clock: m.clock,
                finished: m.finished,
                stageLabel: m.stageLabel,
                kickoff: m.kickoff,
              })
            }
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <span className="w-9 shrink-0 text-[10px] text-muted-foreground">#{m.matchNumber}</span>
            <span>{m.homeFlag}</span>
            <span className="truncate">{m.homeTeam}</span>
            <span className="text-muted-foreground">v</span>
            <span className="truncate">{m.awayTeam}</span>
            <span>{m.awayFlag}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {m.status === "live" ? "LIVE" : m.finished ? "FT" : timeUntil(m.kickoff)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
