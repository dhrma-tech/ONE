# 06: Home

The command centre. Desktop is a full-width bento grid; phone is a single column in this order.

## Blocks
1. **Banner scene** (Home art, see 03) + **profile card**
   - Photo, name "Dharmaraj Aparadh", tagline (editable, default "AI Engineer in training"), **Day N** of lock-in (from `profile.lock_in_start_date`), overall level + XP bar, overall streak.
2. **Today**
   - The **One Thing** pinned on top (big, with a checkbox).
   - Today's tasks from all 4 sections, grouped and colour-tagged by section accent. Quick check-off. Add task inline.
   - Today's Google Calendar events (read-only list with times).
3. **Master contribution grid** (a year): the level is based on how many sections were done that day. Settle animation.
4. **4 section tiles** in heyalok's numbered index-row style (`01 CAREER`, `02 MIND`, `03 BODY`, `04 PERSONA`): today's completion % (ring), streak, one key stat (Python hours this week / Chess.com rapid / latest weight / posts this week), and "Enter →".
5. **Week strip:** focus hours, gym sessions x/3, GitHub pushes, current weekly grade (A-F, live).
6. **Focus timer** (terminal strip with `Run`).
7. **Next up:** the single next video from the highest-priority section (usually CAREER).
8. **Nightly review + journal (one form)**: becomes prominent from 9 PM; the calendar reminder fires at 11:30 PM.
   - Gym done / missed / rest day (auto-filled from the BODY log if logged)
   - Calories, protein (auto from BODY › Diet if logged)
   - Water (auto from BODY › Water)
   - Python Block 1 minutes (auto from focus sessions)
   - GitHub pushes (auto from the GitHub snapshot)
   - Stuck minutes (longest)
   - Outreach done (auto from PERSONA › Connections)
   - English speaking minutes (auto from PERSONA)
   - Journal: **went well / didn't / lesson** (3 short lines)
   - Lights-out time (planned)
   - **Tomorrow's One Thing** (becomes tomorrow's pinned task)
   - Submit → toast "Logged. Go sleep, Cooper." → XP → Obsidian mirror → the day's grid cell updates.
   - Auto-filled fields stay editable.
9. **Achievements shelf:** recent unlocks + next 3 locked.
10. **Quote block** (heyalok style): one line a day. Original lines in a Harvey Specter / David Goggins *spirit*, or real quotes with correct attribution. Don't invent quotes and attribute them to real people. Keep a list of about 60 and rotate.
11. **Exam mode banner:** when exam mode is on, Home leads with the exam countdown and today's units, and other sections shrink to minimum tasks.
12. **Music corner** (global, see 05.9).
13. **Footer** (heyalok style, with a curved notch): quick links, a version, and "Day N. Keep going."

## Weekly grade (computed live, finalised on Sunday)
9 checks, pass/fail:
1. Gym 3 of 3 (a 20-minute minimum session counts)
2. Sunday weigh-in logged
3. Python Block 1 done ≥ 5 of 7 days
4. GitHub push ≥ 6 of 7 days (real work only; trust Dharma's tick)
5. Nightly review submitted ≥ 6 of 7 days
6. Outreach ≥ 5 days + 2 posts published + 1 real conversation
7. Flashcards ≥ 5 days + stuck-minutes ladder target met
8. Lights out by 12:15 AM ≥ 5 nights (from the review)
9. Meditation ≥ 5 days *(new: replaces the old expense check, since expenses stay in Notion)*

Grade: 9 = A, 7-8 = B, 5-6 = C, 3-4 = D, 0-2 = F.

**Reward rule** (show it on the grade card): 2 episodes are unlocked only with gym 3/3 + weigh-in logged + Block 1 ≥ 5/7.

**Sunday weekly review screen** (Sunday 8:00 AM, also a calendar event): pulls the week's data, grade, top 3 wins and fails (Dharma types them), next week's top 3 priorities → saved to `weekly_grades` and mirrored to Obsidian.
