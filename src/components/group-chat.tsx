"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ExternalLink,
  Hash,
  MessagesSquare,
  Search,
  Send,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MatchComments } from "@/components/match-comments";
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

const REF_RE = /#(\d+)/g;

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
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function GroupChat() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
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
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
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

      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const router = useRouter();
  const me = session?.user?.id;

  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<{
    msgId: number;
    match: ChipMatch;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = useQuery({
    ...trpc.chat.list.queryOptions(),
    refetchInterval: 5_000,
  });

  const markRead = useMutation(
    trpc.chat.markRead.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: trpc.chat.unread.queryKey() }),
    }),
  );
  const send = useMutation(
    trpc.chat.send.mutationOptions({
      onSuccess: () => {
        setText("");
        qc.invalidateQueries({ queryKey: trpc.chat.list.queryKey() });
        qc.invalidateQueries({ queryKey: trpc.chat.unread.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const messages = chat.data?.messages ?? [];
  const matchLookup = chat.data?.matches ?? {};
  const newestId = messages.length ? messages[messages.length - 1].id : 0;

  /* keep pinned to the bottom + mark read whenever new messages arrive */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    if (chat.data) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestId]);

  function submit() {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate({ body });
  }
  function insertRef(num: number) {
    setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}#${num} `);
    setPickerOpen(false);
    inputRef.current?.focus();
  }
  /* tap a match chip → expand its comment thread inline, right in the chat */
  function toggleThread(msgId: number, m: ChipMatch) {
    setExpanded((cur) =>
      cur && cur.msgId === msgId && cur.match.id === m.id
        ? null
        : { msgId, match: m },
    );
  }
  function openMatchPage(m: ChipMatch) {
    onClose();
    router.push(`/bet?m=${m.matchNumber}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[70vh] sm:max-h-[680px] sm:w-[400px] sm:rounded-2xl sm:border sm:shadow-2xl">
      {/* header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:rounded-t-2xl">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-lg">
          ⚽
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">Mundial Group</p>
          <p className="truncate text-xs text-muted-foreground">
            Bet-pool group chat · reference matches with #
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {chat.isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {!chat.isLoading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet — say hi 👋
          </p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.userId === me;
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const startRun =
            newDay || !prev || prev.userId !== m.userId || mine !== (prev.userId === me);
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
                matches={matchLookup}
                onChip={(match) => toggleThread(m.id, match)}
              />
              {expanded?.msgId === m.id && (
                <InlineThread
                  match={expanded.match}
                  onOpenPage={() => openMatchPage(expanded.match)}
                  onClose={() => setExpanded(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* match picker */}
      {pickerOpen && (
        <MatchPicker onPick={insertRef} onClose={() => setPickerOpen(false)} />
      )}

      {/* composer */}
      <div className="flex items-center gap-2 border-t px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Button
          variant={pickerOpen ? "secondary" : "ghost"}
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
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Message the group…"
          className="h-10"
        />
        <Button
          size="icon"
          onClick={submit}
          disabled={send.isPending || !text.trim()}
          className="shrink-0"
        >
          <Send />
        </Button>
      </div>
    </div>
  );
}

/* a match's full comment thread, expanded inline inside the chat stream */
function InlineThread({
  match,
  onOpenPage,
  onClose,
}: {
  match: ChipMatch;
  onOpenPage: () => void;
  onClose: () => void;
}) {
  const live = match.status === "live";
  return (
    <div className="my-1 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
        <span>{match.homeFlag}</span>
        <span className="truncate font-semibold">{match.homeTeam}</span>
        <span className="tabular-nums text-muted-foreground">
          {match.finished || live
            ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}`
            : "v"}
        </span>
        <span className="truncate font-semibold">{match.awayTeam}</span>
        <span>{match.awayFlag}</span>
        <span className="ml-1 shrink-0 text-muted-foreground">
          · {match.stageLabel}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <button
            type="button"
            onClick={onOpenPage}
            title="Open on the matches page"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Collapse thread"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <MatchComments matchId={match.id} />
    </div>
  );
}

function MessageRow({
  m,
  mine,
  startRun,
  matches,
  onChip,
}: {
  m: ChatMsg;
  mine: boolean;
  startRun: boolean;
  matches: Record<number, ChipMatch>;
  onChip: (m: ChipMatch) => void;
}) {
  return (
    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <div className="w-7 shrink-0">
          {startRun && (
            <UserAvatar name={m.name} image={m.image} className="size-7" />
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-1.5 text-sm",
          mine
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted",
        )}
      >
        {!mine && startRun && (
          <p className="mb-0.5 text-xs font-semibold text-primary">{m.name}</p>
        )}
        <p className="whitespace-pre-wrap break-words">
          {renderBody(m.body, matches, onChip)}
        </p>
        <span
          className={cn(
            "mt-0.5 block text-right text-[10px]",
            mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {fmtTime(m.createdAt)}
        </span>
      </div>
    </div>
  );
}

/* split a body into text + inline match chips on #<matchNumber> tokens */
function renderBody(
  body: string,
  matches: Record<number, ChipMatch>,
  onChip: (m: ChipMatch) => void,
) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const tok of body.matchAll(REF_RE)) {
    const idx = tok.index ?? 0;
    if (idx > last) out.push(<span key={key++}>{body.slice(last, idx)}</span>);
    const num = Number(tok[1]);
    const match = matches[num];
    if (match) {
      out.push(<MatchChip key={key++} m={match} onClick={() => onChip(match)} />);
    } else {
      out.push(<span key={key++}>{tok[0]}</span>);
    }
    last = idx + tok[0].length;
  }
  if (last < body.length) out.push(<span key={key++}>{body.slice(last)}</span>);
  return out;
}

function MatchChip({ m, onClick }: { m: ChipMatch; onClick: () => void }) {
  const live = m.status === "live";
  const showScore = m.finished || live;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-0.5 my-0.5 inline-flex max-w-full items-center gap-1 rounded-lg border bg-background px-2 py-1 align-middle text-xs font-medium text-foreground hover:bg-accent"
    >
      <span>{m.homeFlag}</span>
      <span className="truncate">{m.homeTeam}</span>
      <span className="tabular-nums text-muted-foreground">
        {showScore ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}` : "v"}
      </span>
      <span className="truncate">{m.awayTeam}</span>
      <span>{m.awayFlag}</span>
      {live ? (
        <span className="ml-0.5 font-bold text-red-600">LIVE</span>
      ) : m.finished ? (
        <span className="ml-0.5 text-muted-foreground">FT</span>
      ) : (
        <span className="ml-0.5 text-primary">{timeUntil(m.kickoff)}</span>
      )}
    </button>
  );
}

function MatchPicker({
  onPick,
  onClose,
}: {
  onPick: (num: number) => void;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const [q, setQ] = useState("");
  const list = useQuery(trpc.matches.list.queryOptions({ filter: "all" }));

  const rank = (s: string) =>
    s === "live" ? 0 : s === "scheduled" ? 1 : 2;
  const all = [...(list.data ?? [])].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
  );
  const filtered = all
    .filter((m) => {
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (
        m.homeTeam.toLowerCase().includes(s) ||
        m.awayTeam.toLowerCase().includes(s) ||
        String(m.matchNumber) === s
      );
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
            placeholder="Find a match to reference…"
            className="w-full bg-transparent text-sm outline-none"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
      <div className="max-h-44 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No matches.
          </p>
        )}
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m.matchNumber)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <span className="w-9 shrink-0 text-[10px] text-muted-foreground">
              #{m.matchNumber}
            </span>
            <span>{m.homeFlag}</span>
            <span className="truncate">{m.homeTeam}</span>
            <span className="text-muted-foreground">v</span>
            <span className="truncate">{m.awayTeam}</span>
            <span>{m.awayFlag}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {m.status === "live"
                ? "LIVE"
                : m.finished
                  ? "FT"
                  : timeUntil(m.kickoff)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
