import { TRPCError } from "@trpc/server";

/* local errors helper (no @repo/lib/errors in this standalone app).
 * Aliased class keeps construction in one place + a clean call-site API. */
const Trpc = TRPCError;

export const TrpcError = {
  unauthorized: (message?: string) =>
    new Trpc({ code: "UNAUTHORIZED", message }),
  forbidden: (message?: string) => new Trpc({ code: "FORBIDDEN", message }),
  notFound: (message?: string) => new Trpc({ code: "NOT_FOUND", message }),
  badRequest: (message?: string) => new Trpc({ code: "BAD_REQUEST", message }),
  conflict: (message?: string) => new Trpc({ code: "CONFLICT", message }),
};
