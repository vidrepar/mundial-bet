# Live Scores + Savage Notification Engine — Design

**Date:** 2026-06-11
**Status:** Approved decisions, pending implementation
**App:** mundial-bet (fifa), WC 2026 friends betting pool, 5 players

## Goal

1. Auto-populate live match scores + status (not started / live / finished) from a free,
   no-auth API — polling **only while a match is live**, zero external calls otherwise.
2. Show live status + score in the app (LIVE badge, auto-refresh).
3. Email **everyone** on **match result** (score + points + standings, savage tone) and on
   **new comments** (batched ~30 min digest, savage tone).

## Locked decisions

| Decision | Choice |
|---|---|
| Score API | ESPN hidden scoreboard (`fifa.world`), free, no key |
| Poll trigger | Coolify scheduled task, `* * * * *` (every min), curl internal route |
| Auto-score on finish | Yes (cron sets final + scores bets); admin `setResult`/`reopen` stays as override |
| Email events | Match **result + standings** only (no kickoff, no daily digest) |
| Comments | Batched digest, ~30 min |
| Tone | **Savage roast** |
| Email transport | Gmail Apps Script **Web App** (push). Coolify is the ONLY scheduler; Apps Script is a triggerless Gmail relay |

## Architecture

```
Coolify task (1/min, the ONLY scheduler)
  └─► GET /api/cron/tick ──► ESPN poll ──► update matches (score/status)
                          └─► auto-score bets on finish
                          └─► enqueue email_outbox rows (result:<id>, comments:<bucket>)
                          └─► POST unsent rows ──► Apps Script Web App (doPost) ──► Gmail
                              ◄── {sent:[ids]} ── mark sentAt
```

Single source of truth for "what to send" = `email_outbox`. `/tick` (server) does ALL the
logic and pushes ready emails to the Apps Script. The Apps Script is a **triggerless Web App**
whose entire job is `GmailApp.sendEmail` — a dumb Gmail relay, write once, never edit.

### Data — one new table

```ts
email_outbox = {
  id: integer pk,
  kind: text,            // dedupe key: "result:42", "comments:586400"
  recipients: text,      // csv of emails (broadcast = all users)
  subject: text,
  html: text,
  createdAt: timestamp,
  sentAt: timestamp|null // null = unsent
}
// unique index on kind → idempotent enqueue, nothing sends twice
```

No other new tables. Watermarks derived from the outbox itself:
- result email already sent? → row with `kind = result:<matchId>` exists.
- last comment digest time → `max(createdAt)` of rows where `kind LIKE 'comments:%'`.

### ESPN client + match join (`src/lib/espn.ts`)

- `GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD`
  (date key from kickoff in America/New_York; tournament is in US/CA/MX so ESPN's US-date
  grouping aligns. ≤2 fetches/min only if a slate straddles the date boundary.)
- Per event: `competitions[0].status.type.state` ∈ `pre|in|post`; `competitors[]` give
  `team.abbreviation` (FIFA tri-code) + `score`.
- **Join key = unordered tri-code pair** e.g. `{MEX,RSA}` → local match via `teams.code`.
  Verified: our `teams.code` == ESPN abbreviations (MEX, RSA, KOR, CZE, …). Unmatched events
  are logged, never crash.
- Assign home/away by code (swap if ESPN orientation differs).

### Tick route (`/api/cron/tick`, secret-guarded)

1. Find local matches in **live window**: `kickoff − 5min ≤ now ≤ kickoff + 180min` AND `not finished`.
2. If none → return immediately (`{ok:true, live:0}`), **no ESPN call**.
3. Else fetch ESPN for the needed date key(s), join, then per match:
   - `pre` → leave scheduled.
   - `in` → `status=live`, update scores (no bet scoring).
   - `post` & local not finished → set final score, `status=finished`, `finished=true`,
     run `scoreBet` for all bets, enqueue `result:<matchId>` email.
4. Comment digest: if `now − lastDigest ≥ 30min` and comments exist since `lastDigest`,
   enqueue one digest per match with new comments (`kind = comments:<floor(now/30min)>`).
5. **Flush:** select `email_outbox` where `sentAt IS NULL`, POST them to `APPSCRIPT_WEBAPP_URL`
   as `{secret, emails:[{id, to:[...], subject, html}]}`; mark `sentAt=now` for ids the relay
   confirms. Unsent rows simply retry next tick (idempotent; `kind` prevents re-enqueue).

### Apps Script Web App (`apps-script/relay.gs`) — replaces dead reminders.gs

Triggerless. Deployed as a Web App (Execute as: me · Access: anyone). `doPost(e)`:
validate `secret`, then for each email `GmailApp.sendEmail(to, subject, '', {htmlBody, name:"Mundial '26"})`
guarded by `MailApp.getRemainingDailyQuota()`, return `{sent:[ids]}`. ~20 lines, never edited.
Secret kept out of git (placeholder in repo). Its `/exec` URL → Coolify env `APPSCRIPT_WEBAPP_URL`.

### Display (client)

- Match cards / bet page: `scheduled` → kickoff time; `live` → **LIVE** badge + live score;
  `finished` → final score. (`status` + scores already in `shapeMatch`.)
- `matches.list` query: `refetchInterval = 30s` only while any match is `live`.

### Savage copy (`src/lib/emails.ts`), built from leaderboard data

Result email example:
> **FT: Mexico 2–1 South Africa** 🇲🇽
> Tadej called it dead on (+3, smug bastard). Jan said 0–0 — bro watched a different sport.
> 📊 **Standings:** 1. Tadej 14 · 2. Vid 11 · … · 5. Andraž 4 — *someone do a welfare check on Andraž.*

Comment digest example:
> **3 new jabs on Brazil v Morocco** 💬
> Blaž: "Brazil by 4 easy" · Vid: "cope" · Jan: "…". Get in there →

## Edge cases / flags

- **Penalties / extra time (knockouts):** group stage (now→~Jun 27) unaffected. ESPN `post`
  score for a shootout needs care (FT vs aggregate). Revisit before R32; for now auto-score
  all, admin can `reopen`/`setResult` to fix.
- **Gmail cap:** ~100 recipient-sends/24h consumer. Chosen events (result + batched comments)
  keep us well under. Quota guard in Apps Script prevents hard failure.
- **Secret:** never committed; lives in Coolify env (`CRON_SECRET`).

## Out of scope (now)

Kickoff emails, daily digest, you-owe-picks reminders (the old dead path), unsubscribe.
Outbox architecture supports adding them later with one new producer each.

## Deliverables / units

1. `email_outbox` schema + migration + `enqueueEmail(kind, recipients, subject, html)` helper.
2. `src/lib/espn.ts` — fetch + tri-code join.
3. `src/lib/emails.ts` — savage result + comment-digest HTML builders (uses leaderboard).
4. `/api/cron/tick` route (ESPN poll + enqueue + flush-to-relay).
5. `apps-script/relay.gs` triggerless Web App (placeholder secret) + deploy instructions.
6. New env `APPSCRIPT_WEBAPP_URL` (the `/exec` URL) set in Coolify.
7. Client: LIVE badge + live score + conditional 30s refetch.
8. Coolify scheduled task `* * * * *` → curl `/api/cron/tick`. (Sole scheduler.)
