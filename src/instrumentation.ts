/* runs once when the Next server boots (Node runtime only) → self-seeds the DB
 * so a fresh Hetzner/Coolify deploy needs zero manual migrate/seed steps. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDatabase } = await import("./db/init");
    initDatabase();
  }
}
