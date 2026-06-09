import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/* ----------------------------------------------------------------------------
 * BetterAuth core tables (must match BetterAuth's expected schema 1:1)
 * -------------------------------------------------------------------------- */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  /* per-user Telegram link for personal reminders (set via the bot) */
  telegramChatId: text("telegram_chat_id"),
  telegramUsername: text("telegram_username"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/* one-time tokens that bind a Telegram chat to a user via the bot's /start */
export const telegramLink = sqliteTable("telegram_link", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(
    sql`(unixepoch())`,
  ),
});

/* ----------------------------------------------------------------------------
 * Domain tables — teams, matches, bets
 * -------------------------------------------------------------------------- */

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  code: text("code").notNull(),
  flag: text("flag").notNull().default("🏳️"),
  groupName: text("group_name"),
});

export const matches = sqliteTable(
  "matches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchNumber: integer("match_number").notNull().unique(),
    roundNumber: integer("round_number").notNull(),
    /* group | r32 | r16 | qf | sf | third | final */
    stage: text("stage").notNull(),
    stageLabel: text("stage_label").notNull(),
    groupName: text("group_name"),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    homeFlag: text("home_flag").notNull().default("🏳️"),
    awayFlag: text("away_flag").notNull().default("🏳️"),
    venue: text("venue").notNull(),
    kickoffUtc: integer("kickoff_utc", { mode: "timestamp" }).notNull(),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    /* scheduled | live | finished */
    status: text("status").notNull().default("scheduled"),
    finished: integer("finished", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("matches_kickoff_idx").on(t.kickoffUtc)],
);

export const bets = sqliteTable(
  "bets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    predHome: integer("pred_home").notNull(),
    predAway: integer("pred_away").notNull(),
    /* null until the match is scored */
    points: integer("points"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("bets_user_match_uq").on(t.userId, t.matchId),
    index("bets_match_idx").on(t.matchId),
    index("bets_user_idx").on(t.userId),
  ],
);
