"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Nav } from "@/components/nav";
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

  if (isPending) return null;
  if (!authed && pathname !== "/login") return null;

  return (
    <>
      {authed && <Nav />}
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </>
  );
}
