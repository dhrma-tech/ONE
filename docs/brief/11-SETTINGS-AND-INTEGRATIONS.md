# 11: Settings and Integrations

**Golden rule: verify every third-party API against its current official docs before building.** What's below was true as of 2026-11-27. If something changed, adapt and log it in DECISIONS.md.

## Settings page sections
1. **Profile:** name, photo, tagline, target title (AI Engineer / AI/ML Engineer, editable), lock-in start date, timezone (Asia/Kolkata).
2. **Appearance:** theme (dark default / light), section accents, reduced motion, font size.
3. **Integrations** (each with status: connected / error / stale + "Test" + "Disconnect"):
   - Google Calendar
   - GitHub
   - LeetCode
   - Chess.com
   - Apple Music
   - Buffer
   - Obsidian mirror
4. **Public stats** (for the portfolio): a switch per stat (off by default).
5. **Modules:** turn locked MIND modules on/off (cube, mental math, memory palace).
6. **Targets:** every numeric target in one place (calories, protein, water, weight targets, posts/week, outreach/day, stuck-ladder, Block 1 minutes).
7. **Data:** one-click **JSON export** of everything; import from JSON; "Mirror to Obsidian now".
8. **Account:** sign out; session list.

## Integration details

### Google Calendar
- Google Cloud project → enable the Calendar API → OAuth consent screen in **Testing** mode, Dharma's Google account as a test user (free; no verification needed for personal use).
- Scopes: the minimum needed (calendar events read/write + calendar list read).
- Server-side token exchange and **refresh-token storage** (encrypted, server-only).
- Create a dedicated **"ONE"** calendar for pushed events. Read events from his other calendars for Home.
- Note: Testing-mode refresh tokens can expire after about 7 days for some scopes/configurations. **Check the current Google policy.** If so, add an easy "Reconnect" prompt, or document how to publish the app in "Production" for a single user without verification (if allowed for these scopes).

### GitHub
- A fine-grained personal access token (read-only, `dhrma-tech`), stored server-side.
- GraphQL `user(login:"dhrma-tech"){ contributionsCollection { contributionCalendar { … } } }` for the grid; REST events for pushes today.
- Cache and refresh hourly.

### LeetCode
- **Unofficial** GraphQL at `https://leetcode.com/graphql` (no official API). Server-side only (CORS).
- Username in settings. Cache daily. Fail gracefully ("stale" badge).

### Chess.com
- **Published-Data API**, public, read-only, **no key**. `https://api.chess.com/pub/player/{username}/stats` and `/games/archives`.
- Server-side with a **User-Agent containing contact info** (Chess.com's request). Cache; respect ETag.

### Apple Music
- Embed player from `embed.music.apple.com` (Dharma pastes a playlist/album link from Apple Music → ONE converts it to the embed URL).
- Not signed in: **30-second previews**. Signed in on the widget (Apple Music subscriber): **full tracks**. No developer account needed for the embed. (MusicKit JS would need a paid Apple Developer account, so **don't use MusicKit**.)
- **Test** whether the widget sign-in persists inside installed PWAs (Chrome/Edge, iOS standalone) and later in Tauri. If it doesn't, offer an "Open in Apple Music" button as the fallback and log it.
- Mount the player once at the app root so it keeps playing across routes.

### Buffer
- Free plan: up to 3 channels, 10 queued posts per channel (refill as they publish), API access with 1 key (limits per Buffer's pricing page, Nov 2026; **verify**).
- Use Buffer's current public API (check their developer docs) to create posts in the queue for the X and LinkedIn channels.
- Fallbacks: X intent URL; LinkedIn copy-and-open (see 10.4).

### YouTube
- **YouTube Data API v3** (free with a daily quota) for video metadata on "Add video" (title, channel, duration). oEmbed as a no-key fallback.
- Player: IFrame Player API on `youtube-nocookie.com`.
- Frame thumbnails from `i.ytimg.com/vi/<id>/` (05.1).

### Obsidian
- See 05.6. Folder picker in Settings, the last mirror time, and errors.

## Secrets checklist (put in `.env.example`, values in NEEDS-FROM-DHARMA.md)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GITHUB_TOKEN`, `YOUTUBE_API_KEY`, `BUFFER_ACCESS_TOKEN`, `CHESSCOM_USER_AGENT_CONTACT`, `TOKEN_ENCRYPTION_KEY`. Usernames (Chess.com, LeetCode) go in Settings, not env.
