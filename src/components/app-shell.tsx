"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { GroupChat } from "@/components/group-chat";
import { Nav } from "@/components/nav";
import { PrivateNotes } from "@/components/private-notes";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";

/* Gate the whole app behind login: signed-out users only ever see /login
 * (no nav, no content). The Suspense boundary also satisfies nuqs/useSearchParams
 * during static generation. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const authed = !!session?.user;

  useEffect(() => {
    if (!isPending && !authed && pathname !== "/login") {
      router.replace("/login");
    }
  }, [isPending, authed, pathname, router]);

  /* branded skeleton during the auth check → instant paint, no white flash */
  if (isPending) {
    return (
      <>
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            <span className="text-xl">⚽</span>
            <Skeleton className="h-6 w-28" />
            <Skeleton className="ml-auto size-7 rounded-full" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-24 pt-6">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </main>
      </>
    );
  }
  if (!authed && pathname !== "/login") return null;

  return (
    <>
      {authed && <Nav />}
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      {authed && (
        <Suspense fallback={null}>
          <PrivateNotes />
          <GroupChat />
        </Suspense>
      )}
    </>
  );
}
