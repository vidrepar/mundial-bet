import { initTRPC } from "@trpc/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { TrpcError } from "@/lib/errors";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers: opts.headers });
  return { user: session?.user ?? null, headers: opts.headers };
};

const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create();

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

/* must be signed in */
export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw TrpcError.unauthorized();
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/* must be the pool admin (enters match results) */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdmin(ctx.user.email)) throw TrpcError.forbidden("Admins only.");
  return next({ ctx });
});
