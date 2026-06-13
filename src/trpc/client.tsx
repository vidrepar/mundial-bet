"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app.types";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

/* persist the whole query cache to localStorage → instant warm starts +
 * offline reads. Bumping CACHE_BUSTER invalidates every stored entry. */
const CACHE_BUSTER = "v1";
function getPersister() {
  if (typeof window === "undefined") return null;
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: "mundial-rq-cache",
  });
}

function getUrl() {
  const base =
    typeof window !== "undefined"
      ? ""
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  return `${base}/api/trpc`;
}

export function TRPCReactProvider(
  props: Readonly<{ children: React.ReactNode }>,
) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: getUrl() })],
    }),
  );
  const [persister] = useState(getPersister);

  const tree = (
    <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      {props.children}
    </TRPCProvider>
  );

  /* SSR / unsupported storage → plain provider; browser → localStorage-backed */
  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: CACHE_BUSTER,
      }}
    >
      {tree}
    </PersistQueryClientProvider>
  );
}
