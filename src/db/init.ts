import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import { db } from "./index";
import { seedDatabase } from "./seed-core";

let initialised = false;

/* run once per process: apply migrations, then seed fixtures.
 * Both steps are idempotent so this is safe on every cold start. */
export function initDatabase() {
  if (initialised) return;
  initialised = true;
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  const res = seedDatabase();
  console.log(
    `[db] ready · ${res.teams} teams · +${res.matchesInserted} matches`,
  );
}
