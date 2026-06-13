import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /* serve cached data instantly, revalidate in the background */
        staleTime: 60 * 1000,
        /* keep entries 24h so the localStorage persister can rehydrate them */
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnReconnect: true,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
