# 01: Vision and Rules

## The problem
Every time Dharma opens his phone or the internet to study, train or network, he gets pulled into feeds, recommendations and tab-switching. His plans live across Notion, YouTube, Chess.com, LeetCode, GitHub, Google Calendar, Obsidian, LinkedIn and X. Switching between them costs time and focus, and progress is scattered and hard to see.

## The product
**ONE** is a single environment that holds only what he needs, with zero distractions, daily progress tracking and a sense of levelling up. It replaces his Notion "Lock-In OS" as the main brain. Obsidian becomes a markdown backup.

## Who uses it
One person: Dharma. Single user, no sign-up, no multi-tenant features. Devices: a Windows laptop (Chrome/Edge) and an iPhone 13 (Safari).

## Goals ONE serves (context for design decisions)
- **Main target: career.** Become an AI Engineer or AI/ML Engineer (exact title undecided; both are in scope). Learn Python properly (he currently can't write it without AI), then LLM APIs, RAG and agents. Ship real projects, push to GitHub daily.
- **Mind:** rebuild attention span, memory and focus. Starting with chess and meditation; cube, mental math and memory palace come later.
- **Body:** mass gain from about 50 kg at 167 cm. Gym 3x/week at 6:30 AM, about 2,600 kcal and 90-100 g protein a day.
- **Persona:** speak fluent professional English (he translates from Marathi/Hindi in his head today), build presence and confidence, network on LinkedIn/X, publish posts.
- Everything except career is a side quest. When time conflicts, career wins. The UI should reflect this priority (CAREER first, and the minimum viable day is "Python Block 1 done").

## Structure
- **Home:** profile, today, stats, nightly review/journal
- **CAREER:** career, programming, study, college
- **MIND:** chess, meditation, focus, memory, mindset, philosophy
- **BODY:** gym, diet, water, physical progress
- **PERSONA:** communication, speaking, presence, networking, posting
- **Settings & Sync**

## Hard rules (do not break)
1. **No AI features in the app.** No LLM APIs, no chat, no AI tutor, no AI summaries, no AI tagging, no OCR+AI. Strip Cubicle's AI study guide and its `chat` serverless function. Dharma uses Claude outside the app. ONE's job is to keep clean, well-named data that Claude can read through Supabase.
2. **No infinite scroll anywhere.** Paginate or cap.
3. **No push notifications, no unread badges.** One exception: the 11:30 PM review reminder, delivered as a Google Calendar event with a reminder (not web push).
4. **No recommendation surfaces.** Videos are only ones Dharma approved. No "related", no "trending", and end-screen suggestions get covered.
5. **One accent colour per section.**
6. **Big numbers, few words.** Any screen should read in about 3 seconds.
7. **Dark mode default** (pure black). Light theme toggle.
8. **Free to run.** No paid services.
9. **Original art.** Style inspired by heyalok.com; assets and code are ours.
10. **Fast.** Opening the app and logging something should take seconds.

## Tone of UI copy
Dry, short, a little funny. Examples:
- Empty list: "Nothing here. Suspiciously quiet."
- Streak broken: "Streak reset. Gravity wins sometimes. Not twice."
- Review done: "Logged. Go sleep, Cooper."

Keep it rare and short. Function first.
