# Mundial '26 ⚽ — Friends Bet Pool

A tiny, private World Cup 2026 prediction pool for you + 3 mates. Predict every
scoreline, lock in before kickoff, climb the lestvica, win bragging rights.

**Stack:** Next.js 15 (App Router) · tRPC v11 (TanStack Query, no server actions)
· Drizzle + SQLite (better-sqlite3) · BetterAuth (Google) · Tailwind v4 +
shadcn-style UI + Magic-UI effects · Telegram reminders via Coolify cron.

## Scoring

| Result                                   | Points |
| ---------------------------------------- | ------ |
| Exact scoreline                          | **3**  |
| Right outcome (W/D/L), wrong score       | **1**  |
| Wrong outcome                            | **0**  |

Tweak in `src/lib/scoring.ts`. Betting **locks at kickoff** (server-enforced).

## Features

- Google login, restricted to an email allowlist (you + friends).
- Bet / edit a scoreline on any match until it kicks off; picks reveal once locked.
- **Lestvica** (leaderboard) with podium, exact/outcome breakdown, hit-rate.
- **Stats** — cumulative points race chart, totals.
- **Analytics** — head-to-head, goal appetite, clutch (KO vs group), hall of exacts.
- **Awards** — Nostradamus, Sniper, On Fire, Underdog Whisperer, Goal Glutton, Iron Bettor.
- Admin (you) enters final scores → all bets auto-scored.
- Telegram reminders for matches with missing picks (free).
- **Self-seeding:** migrations + 104 real fixtures run automatically on boot.

## Local dev

```bash
pnpm install
cp .env.example .env        # already created for you with secrets
pnpm dev                    # http://localhost:3000  (auto-migrates + seeds)
```

The 104 matches (real UTC kickoffs, venues, group-stage teams) seed themselves on
first server start via `src/instrumentation.ts`. To reseed manually: `pnpm db:seed`.

## Google login (one-time, 2 min)

Google has **no CLI/API** to create a *Web* OAuth client with custom redirect URIs,
so this single step is done in the console:

1. Open <https://console.cloud.google.com/apis/credentials> (any project).
2. **Create credentials → OAuth client ID → Web application**.
3. **Authorized redirect URIs** — add:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR_DOMAIN/api/auth/callback/google` (after you set the domain)
4. **Authorized JavaScript origins** — add `http://localhost:3000` and `https://YOUR_DOMAIN`.
5. Copy the Client ID + secret into `.env`, or run:

```bash
./scripts/set-google.sh <CLIENT_ID> <CLIENT_SECRET>
```

Then set `ALLOWED_EMAILS` (comma-separated) so only your group can sign in, and
restart `pnpm dev`. `ADMIN_EMAILS` (defaults to you) can enter match results.

## Deploy — Hetzner + Coolify

1. Push this repo to GitHub/Gitea.
2. Coolify → **New Resource → from your repo → Build pack: Dockerfile**.
3. **Persistent storage:** add a volume mounted at `/app/data` (keeps the SQLite db + bets).
4. **Environment variables:**
   ```
   BETTER_AUTH_URL=https://YOUR_DOMAIN
   NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
   BETTER_AUTH_SECRET=<openssl rand -base64 32>
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   DATABASE_URL=/app/data/mundial.db
   ALLOWED_EMAILS=you@gmail.com,mate1@...,mate2@...,mate3@...
   ADMIN_EMAILS=you@gmail.com
   TELEGRAM_BOT_TOKEN=...      # optional, for reminders
   TELEGRAM_CHAT_ID=...        # your group chat id
   CRON_SECRET=<random>
   ```
5. Deploy. Migrations + fixtures seed on first boot. Add your domain in Coolify later.

### Reminders (free, Telegram)

1. Create a bot with [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN`.
2. Add the bot to your group, send a message, then grab the chat id from
   `https://api.telegram.org/bot<token>/getUpdates` → `TELEGRAM_CHAT_ID`.
3. Coolify → your app → **Scheduled Tasks** → add an hourly cron:
   ```
   curl -s "https://YOUR_DOMAIN/api/cron/reminders?secret=$CRON_SECRET"
   ```
   It pings the group about matches kicking off within 6h that still need picks.

## Admin: entering results

Sign in as an `ADMIN_EMAILS` user → open **Bet**, expand any locked match → the
amber "Admin · result" row lets you save the final score. Every bet on that match
is scored instantly and flows into the leaderboard, stats, analytics, and awards.
