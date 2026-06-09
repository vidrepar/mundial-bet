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
   GOOGLE_CLIENT_ID=...                  # optional (email login works without it)
   GOOGLE_CLIENT_SECRET=...
   NEXT_PUBLIC_GOOGLE_ENABLED=true       # set once Google creds exist → shows the button
   DATABASE_URL=/app/data/mundial.db
   ALLOWED_EMAILS=you@gmail.com,mate1@...,mate2@...,mate3@...
   ADMIN_EMAILS=you@gmail.com
   CRON_SECRET=<random>
   # --- reminders, all optional ---
   TELEGRAM_BOT_TOKEN=...      # for Telegram DMs/group posts
   TELEGRAM_BOT_USERNAME=...   # bot handle (no @) — powers the in-app "Connect" button
   TELEGRAM_CHAT_ID=...        # group chat id for the summary post
   TELEGRAM_WEBHOOK_SECRET=... # random; guards /api/telegram/webhook
   ```
   Until `NEXT_PUBLIC_GOOGLE_ENABLED=true`, the login page shows email-only (no dead Google button).
5. Deploy. Migrations + fixtures seed on first boot. Add your domain in Coolify later.

### Reminders — pick any (all free)

`GET /api/cron/reminders?secret=$CRON_SECRET` computes who still owes picks on
matches within 6h and returns them as JSON (`recipients[]`), DMs linked Telegram
users, and posts a group summary. Drive it however you like:

**Option A — Gmail + Apps Script (no Telegram, no SMTP, no OAuth client).**
Open `apps-script/reminders.gs`, paste it into <https://script.google.com>, set
`APP_URL` + `CRON_SECRET`, authorize Gmail once, and add an hourly time-driven
trigger. It emails each player their outstanding picks from your own Gmail. Done.

**Option B — Telegram (personal DMs).**
1. Create a bot via [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME`.
2. After deploy, register the webhook:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```
3. Each friend hits **Connect** on the dashboard → links their chat → gets personal DMs.
4. Coolify → **Scheduled Tasks** → hourly: `curl -s "https://YOUR_DOMAIN/api/cron/reminders?secret=$CRON_SECRET"`.

Either way, the **Coolify hourly scheduled task** (Option B step 4) is what fires it
— Option A instead uses the Apps Script's own hourly trigger, so you don't even need Coolify cron.

## Admin: entering results

Sign in as an `ADMIN_EMAILS` user → open **Bet**, expand any locked match → the
amber "Admin · result" row lets you save the final score. Every bet on that match
is scored instantly and flows into the leaderboard, stats, analytics, and awards.
