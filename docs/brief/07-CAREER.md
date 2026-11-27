# 07: CAREER

Main target. Gets the most polish. Accent: CAREER colour. Banner: desk-at-night scene.

## Sub-pages (tabs)
`Path · Library · Practice · Build · News · Reading · Notes · College · Analytics`

### 7.1 Path
- Stages (seeded from 17-SEED-CONTENT): **Python Foundations → Data Structures → Web Data & APIs → OOP/Errors/Async/Typing/SQLite → LLM APIs & Prompting → Structured Output & Tool Calling → Embeddings/RAG/Evals → Agents → Full-stack AI apps & Deployment → Advanced (fine-tuning, internals)**.
- Python and LLM concepts run **in parallel** (Dharma gets bored with Python alone). Show two lanes: "Python lane" and "LLM lane".
- Each stage has **gates** (e.g. Week 1 gate: FizzBuzz + largest-in-list from memory in under 5 minutes, no AI).
- Daily structure (editable): Block 1 Python, no AI, 90+ min (the minimum viable day); Block 2 LLM concepts; Block 3 Python practice/project (becomes exam prep in exam mode).
- Tasks feed Home › Today and push to the "ONE" Google Calendar.
- Career title is undecided (AI Engineer vs AI/ML Engineer). Make the tagline/target title an editable setting, not hard-coded.

### 7.2 Library
Shared Library module (05.1). Seed topics from Cubicle's taxonomy (Python → LLM internals → MLOps). **Only approved videos show.** Start with Cubicle's catalogue imported into the **Inbox** (unapproved), so Dharma approves his picks.

### 7.3 Practice
- **LeetCode stats:** easy/medium/hard solved, total, ranking. Fetched server-side from LeetCode's **unofficial** public GraphQL endpoint (`https://leetcode.com/graphql`, query `matchedUser(username) { submitStatsGlobal … }`). It's undocumented and may break: handle failures gracefully, show the last snapshot with a "stale" tag, and never block the UI.
- **Problem log:** date, platform (LeetCode, Exercism, HackerRank, py4e), title, URL, difficulty, minutes, **stuck minutes**, solved?, notes. A quick-add form.
- Practice platforms Dharma uses: Exercism (Python track), HackerRank (Python), py4e.com. Avoid pushing LeetCode-grind culture; it's one input, not the goal.

### 7.4 Build
- **Projects board:** columns Idea / Building / Shipped / Paused. Seed it with Rocky (his always-on Windows AI agent; the build focus) and other repos he names.
- **GitHub:** contributions + pushes today/week for user `dhrma-tech` via the GitHub GraphQL API (`contributionsCollection`) with a fine-grained read-only token (server-side). Show his real GitHub contribution grid here.
- **Website Ideas board** (migrated from Notion, see 14): title, description, status (idea/validating/building/dropped), date.
- **Hackathon list** (migrated from Notion): name, link, dates, deadline (pushed to Calendar), team, status, notes.
- Dharma still has a standing habit of adding website ideas to Notion through Claude. ONE should accept the same "add idea" flow (a quick-add form). Optionally, a periodic import from Notion could be added later (log it as a future idea; not required).

### 7.5 News room
- Reuse Cubicle's `news` function (HN, lab blogs, papers, GitHub).
- **Hard cap: 10 items per day**, chosen by source rules (no AI ranking). After 10: "That's today's news. The rest can wait."
- Mark read / save to Reading list. No comments, no infinite list.

### 7.6 Reading list
- Save articles (URL → title via a server-side fetch of `<title>`/OpenGraph).
- **A one-line takeaway is required before marking one read.**
- Mirror read items + takeaways to Obsidian.

### 7.7 Notes
- Notes per topic (markdown editor, lightweight).
- **Spaced review** at 3 / 7 / 30 / 90 days (from Cubicle). Due reviews appear in Today.
- "Turn into post draft" button → PERSONA › Ideas bank.
- Mirror to Obsidian.

### 7.8 College
Built around how Dharma actually studies (DBATU-affiliated B.Tech Mechatronics, NEP 2020 syllabus).

- **Semester setup:** add a semester → subjects (name, code, credits, importance rank, whether it has an ESE) → units (number, title). **Archive** past semesters (read-only).
- **Unit tracker:** each unit is `Not started` / `In progress` / **`Cracked`**. **Cracked = concept + examples + every PYQ for that unit solved without notes.** Show a progress bar per subject.
- **Exam countdown + timetable:** paper dates with days left, pushed to the "ONE" calendar.
- **Milestone planner:** **4-day blocks** with **unit-level targets** (no subtopics), generated from exam dates + importance order. Editable. Dharma prefers milestones over hour-by-hour timetables.
- **PYQ bank:** upload or link papers (PDFs) per subject. Dharma **tags questions to units manually** (tick boxes; no OCR/AI). Track repeat frequency → show "most asked" per unit.
- **Study links per subject:** NotebookLM notebook URL, syllabus file/link, formula sheet, mind maps.
- **Submissions tracker:** assignments, practicals, journals: due date, done tick, counts per subject.
- **Marks & SGPA/CGPA:** theory = CA 20 + MSE 20 + ESE 60; pass needs 40/100 overall **and** at least 20/60 in ESE. Practical = CA 60 + ESE 40. Warn when a subject is close to failing. Make the SGPA/CGPA formula and grade-point table configurable (verify DBATU's current grading table; let Dharma edit it).
- **Exam mode switch:** when on, Home leads with exams, CAREER › Path Block 3 turns into exam prep, and other sections show minimum tasks only.
- Seed: Sem III (archive, since its exams end 2026-12-05) and an empty Sem IV ready to fill (see 17).

### 7.9 Analytics
- Contribution grid (CAREER done-days).
- Stat cards: Python hours this week, problems solved, pushes this week, videos done, notes reviewed.
- Trend: Python hours per week.
- Lagging in: e.g. "Block 1: 3 of 5 days. The snake is waiting."
