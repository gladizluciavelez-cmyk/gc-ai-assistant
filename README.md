# GC Assistant (dashboard app)

An AI assistant for a general contractor (GC): tracks projects and permits,
generates a daily task plan from recent emails, scrapes public bid listings,
and can add pre-bid meetings to Google Calendar. Built with Next.js (App
Router), Prisma/Postgres, NextAuth (Google), and the Anthropic API — deployed
on Vercel.

## Two-service architecture

This is one of **two separate Vercel deployments** that together make up the
whole system:

1. **`gc-ai-assistant`** (this repo) — the dashboard UI, project/permit
   tracking, Google Calendar, bid scraping, and daily task planning.
2. **`gc-email-agent`** (sibling project) — owns Gmail access exclusively:
   reads the GC's inbox and writes classified emails to a table both
   services share. It has its own deploy, its own cron, its own env vars.
   See that project's README for why it's split out.

They're connected two ways: a **shared Postgres database** (this app owns
the schema/migrations; the email agent reads/writes a subset of the same
tables), and a **server-to-server call** — this app's `/api/gmail/sync`
route is a thin proxy that forwards to the email agent's `/api/sync`
endpoint using a shared secret, so the "Sync Gmail" button in the UI works
the same as before. This app never talks to the Gmail API directly anymore.

## What's built vs. what's stubbed

| Feature | Status |
|---|---|
| Gmail sync (`/api/gmail/sync`) | Working — proxies to the separate `gc-email-agent` service |
| Daily task plan generator (`/api/tasks/generate`) | Working |
| Google Calendar event creation (`/api/calendar/create-event`) | Working |
| Miami-Dade bid scraper (`/api/scrape/miami-dade`) | Working — public static HTML, no login/robots.txt blocker |
| DemandStar bid scraper (`/api/scrape/demandstar`) | **Stub only** — see comments in the route file. It's a JS-rendered app that likely needs a login; needs a decision on headless-browser scraping vs. parsing DemandStar's own notification emails |
| BidNet Direct | **Not built** — its robots.txt explicitly blocks AI bots (`ClaudeBot`, `anthropic-ai`), and it's a paid login-walled platform. See "BidNet" section below. |
| Project/subcontractor/permit tracking | Data model built (Prisma schema); UI is read-only so far — no create/edit forms yet |

## 1. Prerequisites

- A Postgres database. Easiest options: [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) or [Neon](https://neon.tech) (both have free tiers).
- A Google Cloud project with OAuth credentials.
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com)).
- A Vercel account.

## 2. Google Cloud setup (Gmail + Calendar access)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (or use an existing one).
2. Enable **Gmail API** and **Google Calendar API** (APIs & Services → Library).
3. APIs & Services → OAuth consent screen:
   - User type: External (unless the GC has a Google Workspace org, then Internal is simpler).
   - Add scopes: `.../auth/gmail.readonly` and `.../auth/calendar.events`.
   - **Important:** `gmail.readonly` and `calendar.events` are Google "restricted/sensitive" scopes. For anyone outside a small list of test users, Google requires an app verification process (can take days/weeks and may ask for a security assessment). While in "Testing" mode, add the GC's Google account under **Test users** — that works immediately with no verification needed, and is fine for a single-GC internal tool.
4. APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.
   - Authorized redirect URI: `https://<your-vercel-domain>/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local dev).
5. Copy the Client ID and Client Secret into your env vars.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` — from your Postgres provider
- `NEXTAUTH_URL` — `http://localhost:3000` locally, your Vercel URL in production
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from step 2
- `ANTHROPIC_API_KEY` — from Anthropic console
- `CRON_SECRET` — `openssl rand -base64 24` (also set this in Vercel's project env vars; Vercel Cron sends it automatically as a Bearer token)
- `EMAIL_AGENT_URL` — the deployed URL of the `gc-email-agent` service (e.g. `https://gc-email-agent.vercel.app`)
- `AGENT_SHARED_SECRET` — `openssl rand -base64 24`; **must match exactly** the value set in `gc-email-agent`'s env vars

## 4. Local setup

```bash
npm install
npx prisma migrate dev --name init   # creates tables in your Postgres DB
npm run dev
```

Visit `http://localhost:3000`, click "Connect Google," sign in with the GC's
account, and grant Gmail + Calendar access.

## 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect the GitHub repo in the Vercel dashboard. Either way:

1. Add all env vars from step 3 in Vercel → Project → Settings → Environment Variables.
2. Update the Google OAuth redirect URI (step 2) to include your production `*.vercel.app` (or custom) domain.
3. Run `npx prisma migrate deploy` against the production `DATABASE_URL` (or wire it into your build step) so tables exist before first use. **Do this before deploying `gc-email-agent`** — that service assumes the tables already exist and never runs migrations itself.
4. Deploy `gc-email-agent` as its own separate Vercel project (see its README), pointed at the same `DATABASE_URL`, then come back and set this app's `EMAIL_AGENT_URL` to that deployment's URL.
5. The cron job in `vercel.json` runs daily at 11:20 UTC — 20 minutes after `gc-email-agent`'s cron (11:00 UTC), so today's task plan is generated after that day's emails are synced. Adjust both for the GC's timezone (11:00 UTC is ~6–7am US Eastern depending on DST). Vercel Cron is enabled automatically on deploy for Pro/Enterprise plans; on the Hobby plan crons are limited to once a day per project, which matches this setup (one cron per project, two projects).

## 6. On the bid sites

- **Miami-Dade** (`miamidade.gov/apps/ISD/stratproc`): public, static HTML, no login, robots.txt only blocks `/private/` and auth flows — safe to scrape as built.
- **DemandStar**: robots.txt on `network.demandstar.com` allows crawling, but the actual bid browser at `demandstar.com/app/browse-bids/...` is a client-rendered app that needs JavaScript, and full listings likely require a free account. Two paths forward, need your input:
  1. If the GC has (or gets) a DemandStar account with saved-search email notifications turned on, the Gmail sync pipeline can classify and parse those emails directly — no scraping needed, most robust option.
  2. Otherwise, this needs a headless-browser scraper (Playwright) with a remote/serverless Chromium (Vercel functions can't bundle a full browser — options include Browserless.io or `@sparticuz/chromium`), and possibly stored DemandStar login credentials, which is a real credential-security tradeoff worth discussing before building.
- **BidNet Direct**: not built. Its robots.txt explicitly disallows `ClaudeBot` and `anthropic-ai` by name, and it's a paid, login-walled platform. If the GC has a paid account, ask whether BidNet offers email notifications for saved searches — same email-parsing approach as DemandStar would sidestep the policy issue.

## 7. What's not built yet (next steps)

- Create/edit UI for Projects, Subcontractors, and Permits (schema exists, no forms yet).
- Linking parsed emails/bids to a specific `Project` automatically (currently `projectHint` is generated but not auto-matched — would need fuzzy matching or a manual "assign to project" step in the UI).
- Multi-user support beyond a single GC login (schema supports multiple users, but the dashboard doesn't yet have per-user routing/permissions beyond NextAuth sessions).
