import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isAllowed } from "@/lib/env";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  /* email+password works with zero external setup (Google has no CLI to mint a
   * web OAuth client). Google is enabled too once creds are filled in. */
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
  },
  /* only you + invited friends may create an account */
  databaseHooks: {
    user: {
      create: {
        before: async (u) => {
          if (!isAllowed(u.email)) {
            throw new APIError("FORBIDDEN", {
              message: "This email isn't invited to the pool.",
            });
          }
          return { data: u };
        },
      },
    },
  },
});
