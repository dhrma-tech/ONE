# 17: Seed Content (Dharma's real plans, pre-load these)

Everything here comes from Dharma's existing Notion plans (Oct 2026). Seed it into the database so ONE is useful on day one. **All of it must be editable in-app.**

## Profile
- Name: Dharmaraj Aparadh ("Dharma")
- Tagline: "AI Engineer in training" (target title undecided: AI Engineer vs AI/ML Engineer)
- Timezone: Asia/Kolkata
- Lock-in start date: ask Dharma (default to the first day he uses ONE)

## Daily rhythm (weekday default)
| Time | Block |
|---|---|
| 6:00 AM | Wake |
| 6:30 AM (Mon/Wed/Fri) | Gym |
| College hours | Naps, chess puzzles, outreach (~10 min), flashcards, English practice, college work |
| 5:30-6:10 PM | Cook, eat, pack the gym bag |
| 6:10-8:30 PM | **Block 1: Python, no AI** (the minimum viable day = Block 1 only, at least 90 min) |
| 8:30-10:30 PM | Block 2: LLM concepts |
| 10:30-11:30 PM | Block 3: Python practice/project (exam prep in exam mode) |
| 11:30 PM-12:00 AM | Nightly review, then relax. Lights out 12:00. |

Weekend: Saturday = batch cook + 3 h projects + outreach; Sunday = 6:00 wake, weigh-in, **8:00 AM weekly review**, 1 h social batch (draft the week's posts), 3 h projects, batch cook, rest/movie if earned.

## CAREER path seed
**Python lane** (gates beat dates: if a gate fails, repeat the week)
- Week 1: Diagnostic (no AI, no Google, 20 min): FizzBuzz, is-prime, sum of evens 1..N, largest in list without `max()`, count vowels. Then a review of PY4E Course 1 + Exercism basics. **Gate:** FizzBuzz + largest-in-list from memory in under 5 min.
- Weeks 2-3: PY4E Course 2 (data structures). Projects: log file analyser, JSON task manager.
- Week 4: PY4E Course 3 (web data & APIs). **Most important.** Project: first raw Anthropic API call with `requests`, no SDK.
- Weeks 5-6: OOP, error handling, venv, async basics, type hints, light SQLite. Refactor the task manager. **Milestone:** modify a feature in one of his AI-built projects by hand, no Claude Code.

**LLM lane** (parallel)
- W1: what LLMs are (tokens, context window, temperature)
- W2: prompt engineering (system prompts, few-shot, chain-of-thought)
- W3: structured output (JSON from models)
- W4: tool-calling concepts → converge with the first raw API call in Python
- W5: embeddings, chunking, RAG, evaluation
- W6: agents (ReAct, tool use, multi-agent)
- Rule: every concept → one thing shipped + one thing shared (post or commit). Boredom rule: rotate to the LLM block, never skip the Python block.

**Later stages:** LangChain/LangGraph agents → full-stack AI web apps (backend + frontend + deploy) → advanced (fine-tuning, LLM internals).

**AI rules during Python blocks:** no AI for assignments, practice or first drafts. Allowed: concept explanations, "why is this wrong" after 30 min stuck, code review after finishing. Pattern: write badly → get it working → ask for review → rewrite yourself.

**GitHub rule:** at least one real push every day inside the blocks; no fake or empty commits. Python practice → `python-foundations` repo; product work → its own repo.

**Practice platforms:** Exercism (Python), HackerRank (Python), py4e.com. Avoid LeetCode grinding (stats are still tracked).

**Learning resources:** Coursera Pro ("Python for Everybody", University of Michigan).

**Build focus:** Rocky (always-on personal AI agent for his Windows laptop). Other projects paused; SIH and Eureka at deadline-driven minimum.

## College seed
- B.Tech Mechatronics (SY), DBATU-affiliated, NEP 2020 syllabus (w.e.f. AY 2025-26).
- **Sem III (archive after 2026-12-05):** Engineering Mathematics III; Analog & Digital Electronics; Electronic Devices & Circuits (MDM); Material Science & Metallurgy; Renewable Energy Sources (open elective); Machine Drawing & CAD. No-ESE: Constitution of India (audit), Life of Bharat Ratna Dr Ambedkar (IKS).
- Marks scheme: theory = CA 20 + MSE 20 + ESE 60; pass = 40/100 and at least 20/60 in ESE; practical = CA 60 + ESE 40.
- **Sem IV:** empty, ready to fill.

## MIND seed
- Chess: Chess.com (username: ask). Lichess puzzles were in the old plan; Chess.com puzzles are fine now. 1-2 rapid games/week (15+10), review one loss.
- Meditation: daily, start at 5-10 min.
- Stuck ladder: 15 → 20 → 25 → 30 → 45 min.
- Focus: start at 25-minute phone-free blocks, +5 min/week up to 50.
- Flashcards: max 5 new/day, 10 min review.
- Phone rules (show as a checklist on Focus): Instagram + YouTube uninstalled; phone in another room during Blocks 1-2; charges outside arm's reach; no phone in bed; 15 min of book at 11:45 PM; 10-min boredom walk.
- Locked: cube (first target under 2 min), mental math (5 min/day), memory palace (2×15 min/week).

## BODY seed
- Stats: 167 cm, 50 kg (2026-10-11). Targets: 53-55 kg in 12 weeks; 60-62 kg in 9-12 months; 0.25-0.4 kg/week.
- Gym Mon/Wed/Fri 6:30 AM. Weeks 1-4: full body. Rotation A, B, A, then B, A, B.
- **Full Body A:** Leg press 3×8-12 · DB bench press or machine chest press 3×8-12 · Seated cable row 3×8-12 · DB shoulder press 2×8-12 · Biceps curl 2×10-12 · Plank 3×30 s
- **Full Body B:** DB Romanian deadlift 3×8-12 · Lat pulldown 3×8-12 · Incline DB press 3×8-12 · Leg curl 2×10-12 · DB lateral raise 2×12-15 · Triceps pushdown 2×10-12
- Rules: one light warm-up set per exercise; rest 2-3 min on big lifts, 60-90 s on small; stop with about 2 reps left; add reps to the top of the range, then the smallest weight jump; session < 60 min. Deload every 5th week. Weeks 5-12: 4-day upper/lower (detail after week 4).
- Nutrition: about 2,600 kcal, 90-100 g protein. If gain < 0.25 kg/week for 2 weeks → +200-300 kcal.
- Meal templates: pre-gym oats + peanut butter + jaggery (or banana); post-gym 3-4 eggs + rice/roti; lunch rice + dal + soya/paneer/chicken + ghee; evening almonds + PB sandwich + chana; dinner roti/rice + dal/chana + eggs/soya; before bed PB or eggs.
- Anti-procrastination: the word "tomorrow" is banned (replace it with a time); gym bag packed the night before; 2-minute rule (just get to the gym and warm up); never miss twice.

## PERSONA seed
- Diagnosis (for context): vocabulary is fine; the bottleneck is retrieval speed (thinks in Marathi/Hindi → translates); stalls after 2-3 sentences; tone too casual for interviews; introverted; nervous on the phone; switches to Marathi in pitch Q&A.
- Daily protocol (~40 min): 10 min English inner monologue/narration; 10 min shadowing; 10 min of 2-min recordings on random topics; talk to Claude in English; 1 real conversation.
- Speaking rules: never restart a sentence (rephrase and keep going); 2-sec pauses OK, fillers not; PREP structure; professional tone (slower, clear endings, voice drops); English-only zones: pitches, Q&A, interviews, professional chats.
- Extroversion ladder W1-W4 (see 10.2). Phone drill: answer within 3 rings for 14 days; 1 call/day (days 1-3 to a known person with a script: greeting, name, purpose, ask, thanks).
- Stage: lead the intro + problem statement at the next pitch; record a 3-min pitch weekly; a weekly mock interview with Claude (outside ONE).
- Baseline: 2 min, "Explain your best project to an interviewer." Redo at day 30/60/90. 90-day target: 5 min technical talk, no restarts, no Marathi switching, then Q&A.
- Social: LinkedIn 10 people + 3 companies/day (tiers A-D); 3 thoughtful comments/day; 2 posts/week (one Rocky build update, one learning lesson; links in the first comment); 1 real call/week. X: 3-5 posts/week, build-in-public with demo GIFs. Articles: 1 every 2 weeks (Hashnode first, cross-post to Substack and Dev.to with a canonical URL); first: "Calling the Anthropic API with raw requests"; second: "A RAG chunking experiment". Offline: one 5-minute talk a month at a college club. Social cap: 20-30 min/day.
- First-4-weeks targets: 70 connection requests/week, 2 real conversations/week, 2 LinkedIn + 3 X posts/week, 1 article by week 3. Market intel: 20 job posts + 8 conversations by week 4.
- Presence: front/centre seat always; eye contact 3-4 s, +1 s/week up to 5-6, break sideways; stillness; stand and move every 45-60 min; wall angels ×10; posture review via weekly full-body recording.
- Style: fit beats brand; slim fit, not skinny or baggy; solid colours (navy, charcoal, white, light blue, black, grey, olive); structured layers; skincare AM/PM (see 10.8); haircut every 3-4 weeks; beard sharp.

## Mentor tone (for UI copy only)
Harvey Specter for career/life (cold, sharp, short; praise only when earned); David Goggins for gym (no negotiation). Keep it light and short in the UI, never insulting.
