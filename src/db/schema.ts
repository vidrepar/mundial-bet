import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
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
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
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

export const comments = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("comments_match_idx").on(t.matchId)],
);

/* outbound email queue — producers enqueue pre-rendered HTML, the Apps Script
 * relay drains it. `kind` is a dedupe key so nothing ever sends twice. */
export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull().unique(),
    recipients: text("recipients").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    sentAt: integer("sent_at", { mode: "timestamp" }),
  },
  (t) => [index("email_outbox_sent_idx").on(t.sentAt)],
);

/* per-user last-read marker per match → unread badges + read receipts */
export const commentReads = sqliteTable(
  "comment_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    lastReadAt: integer("last_read_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.matchId] })],
);
