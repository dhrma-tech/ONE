# 14: Data Migration from Notion

Dharma's current system is a Notion hub called **"Lock-In OS"** (private). ONE replaces it as the main brain.

## Migrate into ONE
| Notion page | Goes to | Notes |
|---|---|---|
| LinkedIn Outreach Tracker | PERSONA › Connections (`contacts`) | 130+ rows (numbered, `name / title / note / linkedin URL`). About 64 of the original 98 people had **unverified URLs**: import with `verified=false`. Keep tier info where present. |
| X Follow List | PERSONA › X Follows (`x_follows`) | Rows like `date / @handle / name, company / why / first reply`. |
| Website Ideas | CAREER › Build (`website_ideas`) | One idea per entry. |
| Hackathon List | CAREER › Build (`hackathons`) | Some entries are only links (lnkd.in): import the URL and mark it "needs details". |
| Python & Tech Plan, 90-day plan, Gym Plan, English Plan, Social Plan, Mind Plan, Presence Plan, Style Plan, Daily & Weekly System | Seed paths, templates, checklists, targets | Already summarised in `17-SEED-CONTENT.md`; use that as the seed source. |

## Stays in Notion (do NOT migrate)
Expense Tracker, To-Do (and its category pages), Buying List, Saved Links, Rocky page, Weekly Review DB, Market Intel DB (start fresh in ONE; optional import if Dharma asks).

## How
You (Claude Code in the IDE) probably **don't** have Notion access. So:
1. Write `scripts/import/notion/` importers that read **Notion's export** (Markdown & CSV, "Include subpages") for the four pages above, normalise them, dedupe, and upsert into Supabase.
2. Add a dry-run mode that prints counts and the first 5 parsed rows per table.
3. Log in NEEDS-FROM-DHARMA.md: "Export these 4 Notion pages as Markdown & CSV into `scripts/import/notion/input/` (gitignored)."
4. Alternative (faster for Dharma): Claude in the claude.ai chat has Notion + Supabase connectors and can do the migration directly once the tables exist. Mention this in NEEDS-FROM-DHARMA.md as an option, and make sure `docs/SCHEMA.md` is clear enough for it.
5. **Make sure `scripts/import/notion/input/` is gitignored**, since it contains personal contact data.
