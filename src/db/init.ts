import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import { db } from "./index";
import { seedDatabase } from "./seed-core";

let initialised = false;

/* run once per process: apply migrations, ensure newer tables, then seed.
 * All steps are idempotent so this is safe on every cold start. */
export function initDatabase() {
  if (initialised) return;
  initialised = true;
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });

  /* comments table is managed here (kept out of the migration history to
   * avoid a drop/rename prompt from the removed telegram tables) */
  db.run(sql`
    CREATE TABLE IF NOT EXISTS comments (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      body text NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL
    )
  `);
  db.run(
    sql`CREATE INDEX IF NOT EXISTS comments_match_idx ON comments(match_id)`,
  );
  db.run(sql`
    CREATE TABLE IF NOT EXISTS comment_reads (
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      last_read_at integer NOT NULL,
      PRIMARY KEY (user_id, match_id)
    )
  `);
  db.run(sql`
    CREATE TABLE IF NOT EXISTS email_outbox (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      kind text NOT NULL UNIQUE,
      recipients text NOT NULL,
      subject text NOT NULL,
      html text NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      sent_at integer
    )
  `);
  db.run(
    sql`CREATE INDEX IF NOT EXISTS email_outbox_sent_idx ON email_outbox(sent_at)`,
  );

  const res = seedDatabase();
  console.log(
    `[db] ready · ${res.teams} teams · +${res.matchesInserted} matches`,
  );
}
