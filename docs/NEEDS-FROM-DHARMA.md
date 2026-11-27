# Needs from Dharma

Everything below is mocked or behind a flag. The app works without it (local mode). Put secrets in `apps/web/.env.local` (never committed) and in Vercel env vars. Tick items when done.

## Accounts and keys
- [ ] **Supabase project** (free). Create one project, then give: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. In Auth settings: **disable sign-ups** after your first magic-link login, set Site URL + redirect URL to the Vercel URL (and `http://localhost:5173`). Then run the migrations (`pnpm db:push`, see README). After your first login, copy your user id into `ONE_OWNER_USER_ID`.
- [ ] **Vercel project** (Hobby): import the GitHub repo, Root Directory `apps/web`. Add the env vars from `.env.example`.
- [ ] **GitHub token**: fine-grained PAT, read-only, public repos → `GITHUB_TOKEN`.
- [ ] **Google Calendar**: Google Cloud project → enable Calendar API → OAuth consent screen (External) → add yourself as test user → **Publish app ("In production")** so tokens don't expire after 7 days (you'll see an "unverified app" screen once; click Advanced → continue). Create an OAuth client (Web) with redirect `https://<your-vercel-domain>/api/google/callback` (+ `http://localhost:5173/api/google/callback`). Give `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- [ ] **YouTube Data API key** (optional; oEmbed works without it, but no duration) → `YOUTUBE_API_KEY`.
- [ ] **Buffer**: connect X + LinkedIn channels in Buffer, create a personal API key in Buffer settings → `BUFFER_ACCESS_TOKEN`.
- [ ] **Chess.com contact** for the polite User-Agent (an email or URL you're fine with Chess.com seeing) → `CHESSCOM_USER_AGENT_CONTACT`.
- [ ] Generate two random secrets (README shows the command): `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`.

## Usernames and choices (enter in Settings, no code change)
- [ ] Chess.com username
- [ ] LeetCode username
- [ ] Lock-in start date (default: the first day you open ONE)
- [ ] Apple Music playlist/album link for the music corner
- [ ] Water target (left blank on purpose; set it with your doctor's advice)
- [ ] Meal template calories/protein: prefilled with **estimates** marked "est."; correct them once.
- [ ] Target title: "AI Engineer" or "AI/ML Engineer" (tagline is editable)

## Decisions
- [ ] **Licence:** ONE is GPL-3.0 because it includes BOBBY. Keep GPL-3.0, or relicense BOBBY (you own it) and make ONE MIT? Default: GPL-3.0.
- [ ] **DBATU grade table:** the default grade-point table is editable in College › Marks. Verify it against your current DBATU rules.

## Data
- [ ] **Notion export**: export these 4 pages as **Markdown & CSV, include subpages** into `scripts/import/notion/input/` (gitignored): LinkedIn Outreach Tracker, X Follow List, Website Ideas, Hackathon List. Then `pnpm import:notion --dry-run`, then without `--dry-run`.
  - Faster alternative: ask Claude in the claude.ai chat (it has Notion + Supabase connectors) to copy the rows into the tables described in `docs/SCHEMA.md` once the Supabase project exists.

## Manual tests only you can do
- [ ] iPhone 13: Add to Home Screen for the 5 URLs; check login per app (steps in `docs/TESTING.md`).
- [ ] Apple Music widget sign-in inside installed PWAs and the desktop app.
- [ ] Microphone recording on iPhone Safari (PERSONA › Speak).
