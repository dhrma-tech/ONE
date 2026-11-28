# Deploy checklist

Short version. Everything works in local mode without any of this.

## 1. Supabase (free tier)
1. Create a project. Copy the URL, anon key and service role key.
2. Apply migrations in `supabase/` (`pnpm db:check` validates them first).
3. Create your user, copy its id into `ONE_OWNER_USER_ID`.

## 2. Vercel (Hobby, free)
1. Import the repo. Root stays the repo root; `vercel.json` handles the rest.
2. Add every variable from `.env.example` under Project Settings > Environment Variables.
3. Deploy. The daily cron in `vercel.json` starts on its own.

## 3. Variables
| Variable | Needed for |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Client sync |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ONE_OWNER_USER_ID` | Server routes, cron, import |
| `APP_ORIGIN`, `PORTFOLIO_ORIGIN` | OAuth redirects, public stats CORS |
| `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET` | Stored tokens, cron auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Calendar |
| `GITHUB_TOKEN`, `GITHUB_USERNAME` | GitHub grid |
| `YOUTUBE_API_KEY` | Video metadata |
| `BUFFER_ACCESS_TOKEN` | Post queue |
| `CHESSCOM_USER_AGENT_CONTACT` | Chess.com polite UA |

Missing a variable? That feature returns 409 and the UI falls back. Nothing breaks.

## 4. After deploy
Install the PWAs (see `docs/TESTING.md`), connect integrations in Settings, then switch on public stats if you want the portfolio widget.
