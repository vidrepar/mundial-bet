"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useKeyboardPanel } from "@/components/use-keyboard-panel";
import { usePanel } from "@/components/use-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";
import { fmtKickoff } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

export function PrivateNotes() {
  const { data: session } = useSession();
  const [panel, setPanel] = usePanel();
  if (!session?.user) return null;
  return (
    <>
      {panel === null && (
        <button
          type="button"
          onClick={() => setPanel("notes", { history: "push" })}
          aria-label="Private notes"
          title="Private notes"
          className="fixed bottom-5 right-20 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-black shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
        >
          <NotebookPen className="size-6 text-black" />
        </button>
      )}
      {panel === "notes" && (
        <NotesPanel onClose={() => setPanel(null, { history: "replace" })} />
      )}
    </>
  );
}

function NotesPanel({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  useKeyboardPanel(panelRef);

  const list = useQuery(trpc.notes.list.queryOptions());
  const add = useMutation(
    trpc.notes.add.mutationOptions({
      onSuccess: () => {
        setText("");
        qc.invalidateQueries({ queryKey: trpc.notes.list.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const remove = useMutation(
    trpc.notes.remove.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.notes.list.queryKey() }),
    }),
  );

  const notes = list.data ?? [];
  function submit() {
    const body = text.trim();
    if (!body || add.isPending) return;
    add.mutate({ body });
  }

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[70vh] sm:max-h-[680px] sm:w-[400px] sm:rounded-2xl sm:border sm:shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:rounded-t-2xl">
        <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-lg">📝</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">Private notes</p>
          <p className="truncate text-xs text-muted-foreground">Only you can see these</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {list.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {!list.isLoading && notes.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No notes yet. Jot a prediction, a reminder, anything. 🤫
          </p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="group rounded-lg border bg-card px-3 py-2">
            <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{fmtKickoff(n.createdAt)}</span>
              <button
                type="button"
                onClick={() => remove.mutate({ id: n.id })}
                className="rounded p-1 text-muted-foreground opacity-60 hover:bg-accent hover:text-destructive group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Write a private note…"
          className="h-10"
        />
        <Button size="icon" onClick={submit} disabled={add.isPending || !text.trim()} className="shrink-0">
          <Plus />
        </Button>
      </div>
    </div>
  );
}
